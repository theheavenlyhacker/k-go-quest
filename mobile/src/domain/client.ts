import type { Session } from './server';

export class ApiError extends Error {
  constructor(public status: number, message: string, public retryAfterMs = 0) { super(message); this.name = 'ApiError'; }
  get retryable() { return this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 500; }
}
export interface TokenStore { read(): Session | null; write(session: Session): Promise<void>; invalidate(owner: string): Promise<void>; }
export class ApiClient {
  private refreshJob: Promise<void> | null = null;
  constructor(private base: () => string, private tokens: TokenStore, private transport: typeof fetch = fetch) {}
  private async request<T>(method: string, route: string, body: unknown, token?: string): Promise<T> {
    let response: Response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      response = await this.transport(`${this.base().replace(/\/$/, '')}/${route}`, {
        method, signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch { throw new ApiError(0, 'Cannot reach the school server. Your saved work is still on this device.'); }
    finally { clearTimeout(timeout); }
    let data: unknown;
    try { data = await response.json(); } catch { throw new ApiError(response.ok ? 502 : response.status, 'The server returned an unreadable response. Please try again.'); }
    if (!response.ok) {
      const error = data as { message?: string | string[] };
      const message = Array.isArray(error.message) ? error.message.join('. ') : error.message;
      const retry = Number(response.headers.get('retry-after') ?? '0');
      throw new ApiError(response.status, typeof message === 'string' ? message : 'The request could not be completed.', Number.isFinite(retry) ? retry * 1000 : 0);
    }
    return data as T;
  }
  public<T>(method: string, route: string, body?: unknown) { return this.request<T>(method, route, body); }
  async call<T>(method: string, route: string, body?: unknown): Promise<T> {
    const original = this.tokens.read();
    if (!original || original.revoked) throw new ApiError(401, 'Sign in to continue.');
    try { return await this.request<T>(method, route, body, original.accessToken); }
    catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      if (this.tokens.read()?.user.id !== original.user.id) throw new ApiError(401, 'The active profile changed.');
      if (!this.refreshJob) {
        this.refreshJob = (async () => {
          // Another request may already have refreshed the access token.
          if (this.tokens.read()?.accessToken !== original.accessToken) return;
          try {
            const result = await this.public<Pick<Session, 'accessToken' | 'refreshToken' | 'expiresIn'>>('POST', 'auth/refresh', { refreshToken: original.refreshToken, deviceId: original.deviceId });
            if (this.tokens.read()?.user.id !== original.user.id) throw new ApiError(401, 'The active profile changed.');
            await this.tokens.write({ ...original, ...result });
          } catch (failure) {
            if (failure instanceof ApiError && failure.status === 401) await this.tokens.invalidate(original.user.id);
            throw failure;
          }
        })().finally(() => { this.refreshJob = null; });
      }
      await this.refreshJob;
      const current = this.tokens.read();
      if (!current || current.user.id !== original.user.id || current.revoked) throw new ApiError(401, 'Sign in again to reconnect this profile.');
      try { return await this.request<T>(method, route, body, current.accessToken); }
      catch (failure) {
        if (failure instanceof ApiError && failure.status === 401) await this.tokens.invalidate(original.user.id);
        throw failure;
      }
    }
  }
}

export function resolveApiUrl(explicit: string | undefined, platform: string, metroHost: string, development: boolean): string {
  const host = metroHost.split(':')[0] || (platform === 'android' ? '10.0.2.2' : 'localhost');
  const value = explicit?.trim() || `http://${platform === 'web' ? 'localhost' : host}:3000/api/v1`;
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || (!development && url.protocol !== 'https:'))
    throw new Error('Set a valid HTTPS API address. HTTP is allowed only in development.');
  return value.replace(/\/$/, '').replace(/(?:\/api\/v1)?$/, '/api/v1');
}
