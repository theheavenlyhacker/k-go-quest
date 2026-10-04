import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';

import { serverExerciseId } from '../content/catalog';
import { AttemptOutbox } from '../data/outbox';
import { getRepository } from '../data/storage';
import { vault } from '../data/vault';
import { ApiClient, ApiError, resolveApiUrl, type TokenStore } from '../domain/client';
import {
  BATCH_LIMIT, CARETAKER_OWNER, LINKS_KEY, onlineState, parseLinks, sessionKey, uploadSummary,
  type OnlineState, type UploadSummary,
} from '../domain/online';
import type { Link, Page, ServerClassroom, ServerUser, Session, SyncResponse } from '../domain/server';
import { SyncEngine, type SyncSummary } from '../domain/sync';

/**
 * Online Mode.
 *
 * Deliberately a separate provider from `AppProvider`: everything in there has
 * to keep working with the radio off, and the clearest way to guarantee that is
 * for the offline half not to import any of this. If this provider threw on
 * every call, practice would be unaffected.
 *
 * See `docs/online-mode.md`.
 */

/** The backend's refresh tokens last at most seven days, so a session is useless after that without a server. */
const OFFLINE_WINDOW = 7 * 24 * 60 * 60 * 1000;
const DEVICE_KEY = 'kgo-device-id';
/** How often the clock behind the EXPIRED state is re-read. A minute is well inside a seven-day window. */
const CLOCK_TICK = 60_000;

interface LoginResponse { accessToken: string; refreshToken: string; expiresIn: number; user: ServerUser }

interface OnlineValue {
  /** null when no valid API address is configured; Online Mode is then simply unavailable. */
  apiUrl: string | null;
  state: OnlineState;
  /** The Caretaker's server session. Teacher and admin screens are gated on its role. */
  server: Session | null;
  links: Record<string, Link>;
  busy: boolean;
  signIn(loginId: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  linkProfile(profileId: string, loginId: string, password: string): Promise<void>;
  unlinkProfile(profileId: string): Promise<void>;
  sync(profileId: string): Promise<SyncSummary>;
  summary(profileId: string): Promise<UploadSummary>;
  /** Re-asks whether the server is reachable. Safe to call often; it sends one unauthenticated request. */
  check(): Promise<void>;
}

const OnlineContext = createContext<OnlineValue | null>(null);

function address(): string | null {
  try {
    return resolveApiUrl(process.env.EXPO_PUBLIC_API_URL, Platform.OS, Constants.expoConfig?.hostUri ?? '', __DEV__);
  } catch {
    // A missing or unusable address is not an error: the tablet just stays offline.
    return null;
  }
}

export function OnlineProvider({ children }: { children: React.ReactNode }) {
  const [apiUrl] = useState(address);
  const [server, setServer] = useState<Session | null>(null);
  const [links, setLinks] = useState<Record<string, Link>>({});
  const [reachable, setReachable] = useState(false);
  const [busy, setBusy] = useState(false);
  // A session's offline window is compared against the clock, and a render has
  // to be pure, so the clock is state a timer advances rather than a Date.now()
  // call in the body below.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => { setNow(Date.now()); }, CLOCK_TICK);
    return () => clearInterval(id);
  }, []);

  // Sessions must be readable synchronously by the API client, so the vault is
  // mirrored here rather than read on each request.
  const sessions = useRef(new Map<string, Session>());
  const engines = useRef(new Map<string, SyncEngine>());

  useEffect(() => {
    void (async () => {
      const [caretaker, raw] = await Promise.all([vault.get(sessionKey(CARETAKER_OWNER)), vault.get(LINKS_KEY)]);
      const saved = parseLinks(raw);
      setLinks(saved);
      const restore = async (owner: string) => {
        const stored = await vault.get(sessionKey(owner));
        if (!stored) return;
        try { sessions.current.set(owner, JSON.parse(stored) as Session); } catch { /* an unreadable session is simply absent */ }
      };
      await Promise.all(Object.keys(saved).map(restore));
      if (caretaker) {
        try {
          const parsed = JSON.parse(caretaker) as Session;
          sessions.current.set(CARETAKER_OWNER, parsed);
          setServer(parsed);
        } catch { /* ignore */ }
      }
    })();
  }, []);

  const store = useCallback((owner: string): TokenStore => ({
    read: () => sessions.current.get(owner) ?? null,
    write: async (session) => {
      sessions.current.set(owner, session);
      await vault.set(sessionKey(owner), JSON.stringify(session));
      if (owner === CARETAKER_OWNER) setServer(session);
    },
    invalidate: async () => {
      const current = sessions.current.get(owner);
      if (current) sessions.current.set(owner, { ...current, revoked: true });
      await vault.remove(sessionKey(owner));
      if (owner === CARETAKER_OWNER) setServer(current ? { ...current, revoked: true } : null);
    },
  }), []);

  /** Every request goes through here so one unreachable call updates the whole app's idea of being online. */
  const watched = useCallback(async <T,>(work: () => Promise<T>): Promise<T> => {
    try {
      const result = await work();
      setReachable(true);
      return result;
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) setReachable(false);
      throw error;
    }
  }, []);

  const client = useCallback((owner: string) => new ApiClient(() => apiUrl ?? '', store(owner)), [apiUrl, store]);

  const device = useCallback(async () => {
    const saved = await vault.get(DEVICE_KEY);
    if (saved) return saved;
    const fresh = randomUUID();
    await vault.set(DEVICE_KEY, fresh);
    return fresh;
  }, []);

  const login = useCallback(async (loginId: string, password: string): Promise<Session> => {
    if (!apiUrl) throw new Error('This tablet has no school server address configured.');
    const deviceId = await device();
    const result = await watched(() =>
      client(CARETAKER_OWNER).public<LoginResponse>('POST', 'auth/login', { loginId: loginId.trim().toLowerCase(), password, deviceId }),
    );
    return { ...result, deviceId, offlineUntil: Date.now() + OFFLINE_WINDOW };
  }, [apiUrl, client, device, watched]);

  const signIn = useCallback(async (loginId: string, password: string) => {
    setBusy(true);
    try {
      const session = await login(loginId, password);
      if (session.user.role === 'STUDENT')
        throw new Error('This is a Learner account. Sign in with the Teacher or LGU account that manages this tablet.');
      await store(CARETAKER_OWNER).write(session);
    } finally { setBusy(false); }
  }, [login, store]);

  const signOut = useCallback(async () => {
    const current = sessions.current.get(CARETAKER_OWNER);
    // Best effort: a tablet that cannot reach the server still forgets the session.
    if (current) await client(CARETAKER_OWNER).call('POST', 'auth/logout', {}).catch(() => undefined);
    sessions.current.delete(CARETAKER_OWNER);
    await vault.remove(sessionKey(CARETAKER_OWNER));
    setServer(null);
  }, [client]);

  const saveLinks = useCallback(async (next: Record<string, Link>) => {
    await vault.set(LINKS_KEY, JSON.stringify(next));
    setLinks(next);
  }, []);

  /**
   * Ties one Profile to a Learner account.
   *
   * The Learner's own credentials are used, not the Caretaker's, because the
   * server authorises an upload as the Learner whose Attempts they are. The
   * Caretaker types them once here; the Learner never sees a password again.
   */
  const linkProfile = useCallback(async (profileId: string, loginId: string, password: string) => {
    setBusy(true);
    try {
      const session = await login(loginId, password);
      if (session.user.role !== 'STUDENT')
        throw new Error('A Profile links to a Learner account. That account is a teacher or an administrator.');
      sessions.current.set(profileId, session);
      const page = await watched(() => client(profileId).call<Page<ServerClassroom>>('GET', 'classrooms?page=1&limit=20'));
      const classroom = page.items[0];
      if (!classroom) {
        sessions.current.delete(profileId);
        throw new Error('That Learner is not enrolled in a classroom yet, so there is nowhere to file their answers.');
      }
      await vault.set(sessionKey(profileId), JSON.stringify(session));
      await saveLinks({ ...links, [profileId]: { profileId, learnerId: session.user.id, classroomId: classroom.id, serverAlias: session.user.alias } });
    } finally { setBusy(false); }
  }, [client, links, login, saveLinks, watched]);

  const unlinkProfile = useCallback(async (profileId: string) => {
    sessions.current.delete(profileId);
    engines.current.delete(profileId);
    await vault.remove(sessionKey(profileId));
    const next = { ...links };
    delete next[profileId];
    await saveLinks(next);
  }, [links, saveLinks]);

  const sync = useCallback(async (profileId: string): Promise<SyncSummary> => {
    const link = links[profileId];
    if (!link) throw new Error('Link this Profile to a Learner account before syncing.');
    if (!sessions.current.get(profileId)) throw new Error('This Profile’s link has expired. Link it again.');
    const repo = await getRepository();
    const api = client(profileId);
    let engine = engines.current.get(profileId);
    if (!engine) {
      engine = new SyncEngine(
        new AttemptOutbox(repo, link.classroomId, serverExerciseId),
        (batch) => watched(() => api.call<SyncResponse>('POST', 'learning/sync', { attempts: batch })),
        // Uploads are per Profile, not per open screen: a Learner may lock the
        // tablet mid-sync and their answers should still finish going up.
        () => true,
      );
      engines.current.set(profileId, engine);
    }
    return engine.run(profileId);
  }, [client, links, watched]);

  /**
   * Asks the server whether it is there.
   *
   * Any answer at all means reachable — a 503 from a half-started server still
   * proves the network works, and telling a Caretaker they are offline when
   * they are not sends them looking for the wrong problem.
   */
  const probe = useCallback(async (): Promise<boolean> => {
    if (!apiUrl) return false;
    try {
      await client(CARETAKER_OWNER).public('GET', 'health');
      return true;
    } catch (error) {
      return !(error instanceof ApiError && error.status === 0);
    }
  }, [apiUrl, client]);

  const check = useCallback(async () => {
    if (!apiUrl) return;
    setReachable(await probe());
  }, [apiUrl, probe]);

  // One probe on mount. `probe` answers rather than writing state, so the
  // answer lands after the await and never during the effect itself.
  useEffect(() => {
    let live = true;
    void probe().then((answer) => { if (live) setReachable(answer); });
    return () => { live = false; };
  }, [probe]);

  const summary = useCallback(async (profileId: string) => {
    const repo = await getRepository();
    const [attempts, uploads] = await Promise.all([repo.attempts(profileId), repo.uploads(profileId)]);
    return uploadSummary(attempts, uploads);
  }, []);

  const value: OnlineValue = {
    apiUrl,
    state: onlineState(reachable, server, now),
    server,
    links,
    busy,
    signIn,
    signOut,
    linkProfile,
    unlinkProfile,
    sync,
    summary,
    check,
  };
  return <OnlineContext.Provider value={value}>{children}</OnlineContext.Provider>;
}

export function useOnline() {
  const value = useContext(OnlineContext);
  if (!value) throw new Error('OnlineProvider is required');
  return value;
}

export { BATCH_LIMIT };
