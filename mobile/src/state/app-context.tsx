import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';
import * as Network from 'expo-network';
import type { ApiClient as Client } from '../domain/client';
import { ApiClient, ApiError, resolveApiUrl } from '../domain/client';
import { retryDelay, SyncEngine } from '../domain/sync';
import type { AttemptInput, AttemptResult, ClassReport, Classroom, Impact, League, Pack, PackDownload, Page, Progress, Quest, QueuedAttempt, Reward, Role, School, Session, Snapshot, User, Voucher, AuditEvent } from '../domain/types';
import { emptySnapshot } from '../domain/types';
import { meanMastery } from '../domain/format';
import { getRepository } from '../data/storage';
import { digest, pinDigest } from '../data/crypto';
import { vault } from '../data/vault';
import { previewSession, previewSnapshot } from '../data/preview';

export type Appearance = 'light' | 'dark' | 'system';
interface ProfileLabel { id: string; alias: string; role: Role; }
interface Preferences { appearance: Appearance; language: string; wifiOnly: boolean; }
interface Notice { message: string; kind: 'success' | 'error' | 'info'; }
interface AppContextValue {
  ready: boolean; session: Session | null; locked: boolean; pinConfigured: boolean; needsLogin: boolean;
  preview: boolean; snapshot: Snapshot; queued: QueuedAttempt[]; outcomes: { input: AttemptInput; result: AttemptResult }[];
  profiles: ProfileLabel[]; busy: boolean; syncing: boolean; online: boolean; notice: Notice | null; preferences: Preferences;
  api: Client; apiUrl: string; classroomId: string; setClassroom(id: string): Promise<void>;
  toast(message: string, kind?: Notice['kind']): void; dismiss(): void;
  login(loginId: string, password: string, expectedRole: Role): Promise<void>;
  logout(): Promise<void>; lock(): void; unlock(pin: string): Promise<void>; setPin(pin: string): Promise<void>; selectProfile(id: string): Promise<void>;
  startPreview(role: Role): void; refresh(): Promise<void>; sync(): Promise<void>; download(pack: Pack): Promise<void>;
  queue(exerciseId: string, selectedOption: number, pack: Pack): Promise<void>; redeem(reward: Reward): Promise<Voucher>;
  mutate<T>(method: string, route: string, body?: unknown): Promise<T>;
  updatePreferences(change: Partial<Preferences>): Promise<void>;
  updatePreview(update: (snapshot: Snapshot) => Snapshot): void;
}
const AppContext = createContext<AppContextValue | null>(null);
const sessionKey = (id: string) => `kgo-session-${id}`;
const defaults: Preferences = { appearance: 'light', language: 'en', wifiOnly: true };

/** The provider's latest committed state, as the API client sees it. */
interface ClientBridge {
  session: Session | null;
  apiUrl: string;
  write(next: Session): Promise<void>;
  invalidate(owner: string): Promise<void>;
}

/**
 * Built outside the component on purpose: these closures read the bridge, and
 * React forbids reading a ref during render. Out here they are plain functions
 * the client calls later, once the provider has refreshed `bridge.current`.
 */
function createClient(bridge: { current: ClientBridge }) {
  return new ApiClient(() => bridge.current.apiUrl, {
    read: () => bridge.current.session,
    write: (next) => bridge.current.write(next),
    invalidate: (owner) => bridge.current.invalidate(owner),
  });
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [locked, setLocked] = useState(true);
  const [pinConfigured, setPinConfigured] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [preview, setPreview] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [queued, setQueued] = useState<QueuedAttempt[]>([]);
  const [outcomes, setOutcomes] = useState<{ input: AttemptInput; result: AttemptResult }[]>([]);
  const [profiles, setProfiles] = useState<ProfileLabel[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [serverAvailable, setServerAvailable] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [classroomId, setClassroomId] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const network = Network.useNetworkState();
  const sessionRef = useRef(session); const snapshotRef = useRef(snapshot);
  const lockedRef = useRef(locked); const previewRef = useRef(preview);
  const refreshJob = useRef<Promise<void> | null>(null);
  const syncJob = useRef<Promise<void> | null>(null);
  const failures = useRef(0); const lastInteraction = useRef(0);
  const pinSetupOwner = useRef<string | null>(null);
  const apiUrl = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL, Platform.OS, Constants.expoConfig?.hostUri ?? '', __DEV__);
  const apiUrlRef = useRef(apiUrl);
  const online = network.isConnected !== false && serverAvailable;
  const sessionId = session?.user.id;

  const toast = useCallback((message: string, kind: Notice['kind'] = 'info') => setNotice({ message, kind }), []);
  const replaceSession = useCallback(async (next: Session) => {
    sessionRef.current = next; setSession(next);
    if (!next.user.id.startsWith('preview-')) await vault.set(sessionKey(next.user.id), JSON.stringify(next));
  }, []);
  const invalidateSession = useCallback(async (owner: string) => {
    if (sessionRef.current?.user.id === owner) {
      await replaceSession({ ...sessionRef.current, revoked: true, accessToken: '', refreshToken: '' });
      setNeedsLogin(true); lockedRef.current = true; setLocked(true);
    }
  }, [replaceSession]);
  const bridge = useRef<ClientBridge>({ session: null, apiUrl, write: replaceSession, invalidate: invalidateSession });
  // Created once: the client owns the refresh single-flight, so rebuilding it
  // mid-session would let two refreshes race. createClient only stores the ref
  // object; every read of bridge.current happens inside the client's own
  // methods, long after render, which is why the rule is waived on this line.
  // eslint-disable-next-line react-hooks/refs -- the ref is stored here, never read during render
  const [api] = useState(() => createClient(bridge));
  // Mirror the latest committed state into the refs and the client holder, so
  // async callbacks read fresh values. After every commit, not during render:
  // nothing reads these while rendering, and the handlers that need a value
  // sooner still assign the ref directly before calling setState. This effect
  // is declared before the restore effect, so the holder is populated first.
  useEffect(() => {
    sessionRef.current = session;
    snapshotRef.current = snapshot;
    lockedRef.current = locked;
    previewRef.current = preview;
    apiUrlRef.current = apiUrl;
    bridge.current = { session, apiUrl, write: replaceSession, invalidate: invalidateSession };
  });
  const commit = useCallback(async (owner: string, next: Snapshot) => {
    await (await getRepository()).save(owner, next);
    if (sessionRef.current?.user.id === owner && !lockedRef.current) { snapshotRef.current = next; setSnapshot(next); }
  }, []);
  const loadLocal = useCallback(async (owner: string) => {
    const repo = await getRepository();
    const [next, queue, confirmed] = await Promise.all([repo.snapshot(owner), repo.queued(owner), repo.outcomes(owner)]);
    if (sessionRef.current?.user.id === owner && !lockedRef.current) {
      snapshotRef.current = next; setSnapshot(next); setQueued(queue); setOutcomes(confirmed);
      setClassroomId((id) => next.classrooms.some((c) => c.id === id) ? id : next.classrooms[0]?.id ?? '');
    }
  }, []);
  const list = useCallback(async <T,>(route: string): Promise<T[]> => {
    const items: T[] = [];
    for (let page = 1; page <= 10; page++) {
      const result = await api.call<Page<T>>('GET', `${route}${route.includes('?') ? '&' : '?'}page=${page}&limit=100`);
      items.push(...result.items);
      if (items.length >= result.total) return items;
    }
    throw new ApiError(413, 'This list is too large for one tablet refresh. Ask your administrator to narrow the dataset.');
  }, [api]);
  const refresh = useCallback((): Promise<void> => {
    if (refreshJob.current) return refreshJob.current;
    const active = sessionRef.current;
    if (!active || lockedRef.current) return Promise.resolve();
    if (previewRef.current) { setServerAvailable(true); return Promise.resolve(); }
    refreshJob.current = (async () => {
      setBusy(true);
      try {
        const user = await api.call<User>('GET', 'auth/me');
        if (sessionRef.current?.user.id !== active.user.id || lockedRef.current) return;
        await replaceSession({ ...sessionRef.current, user });
        const next = await (await getRepository()).snapshot(active.user.id);
        const [classrooms, packs, league] = await Promise.all([list<Classroom>('classrooms'), list<Pack>('content/packs'), api.call<League>('GET', 'reports/league')]);
        next.classrooms = classrooms; next.packs = packs; next.league = league;
        if (user.role === 'STUDENT') {
          const [progress, quests, rewards, vouchers] = await Promise.all([
            api.call<Progress>('GET', 'learning/progress/me'), api.call<{ items: Quest[] }>('GET', 'learning/quests'), list<Reward>('rewards'), list<Voucher>('rewards/redemptions/me'),
          ]);
          next.progress = progress; next.quests = quests.items; next.rewards = rewards; next.vouchers = vouchers;
          const mastery = meanMastery(progress.skills);
          if (mastery !== null && next.history.at(-1)?.mastery !== mastery) next.history = [...next.history, { at: new Date().toISOString(), mastery }].slice(-30);
        } else if (user.role === 'TEACHER') {
          next.reports = await Promise.all(classrooms.slice(0, 10).map((classroom) => api.call<ClassReport>('GET', `reports/classrooms/${classroom.id}`)));
          next.schools = await list<School>('schools');
          next.rewards = await list<Reward>('rewards');
        } else {
          const [schools, users, impact, drafts, rewards, audit] = await Promise.all([
            list<School>('schools'), list<User>('users'), api.call<Impact>('GET', 'reports/impact'), list<Pack>('content/packs?status=draft'), list<Reward>('rewards?status=all'), api.call<Page<AuditEvent>>('GET', 'reports/audit?limit=50'),
          ]);
          next.schools = schools; next.users = users; next.impact = impact; next.packs = [...packs, ...drafts]; next.rewards = rewards; next.audit = audit.items;
        }
        if (sessionRef.current?.user.id !== active.user.id || lockedRef.current) return;
        next.refreshedAt = new Date().toISOString();
        await commit(active.user.id, next); setServerAvailable(true);
        setClassroomId((id) => next.classrooms.some((c) => c.id === id) ? id : next.classrooms[0]?.id ?? '');
      } catch (error) {
        if (error instanceof ApiError && error.status === 0) setServerAvailable(false);
        throw error;
      } finally { setBusy(false); }
    })().finally(() => { refreshJob.current = null; });
    return refreshJob.current;
  }, [api, commit, list, replaceSession]);

  const sync = useCallback((): Promise<void> => {
    if (syncJob.current) return syncJob.current;
    const active = sessionRef.current;
    if (!active || lockedRef.current) return Promise.resolve();
    syncJob.current = (async () => {
      setSyncing(true);
      try {
        if (previewRef.current) {
          const repo = await getRepository(); const inputs = await repo.pending(active.user.id, 100);
          const previous = await repo.outcomes(active.user.id);
          const results = inputs.map((input) => ({ clientAttemptId: input.clientAttemptId, correct: input.selectedOption === 0, duplicate: false, awardedCoins: input.selectedOption === 0 && !previous.some((row) => row.input.exerciseId === input.exerciseId) ? 5 : 0 }));
          const balance = (snapshotRef.current.progress?.coinBalance ?? 128) + results.reduce((sum, r) => sum + r.awardedCoins, 0);
          await repo.acknowledge(active.user.id, { results, coinBalance: balance, awardedCoins: results.reduce((sum, r) => sum + r.awardedCoins, 0), modelVersion: 'preview', serverTime: new Date().toISOString() });
          await loadLocal(active.user.id); toast(`${inputs.length} sample answer${inputs.length === 1 ? '' : 's'} synced.`, 'success');
        } else {
          if (active.user.role === 'STUDENT') {
            const engine = new SyncEngine(await getRepository(), (attempts) => api.call('POST', 'learning/sync', { attempts }), (owner) => sessionRef.current?.user.id === owner && !lockedRef.current);
            const result = await engine.run(active.user.id);
            await loadLocal(active.user.id);
            if (result.review) toast(`${result.review} answer${result.review === 1 ? '' : 's'} need review. They are still saved on this device.`, 'error');
            else if (result.accepted + result.duplicate) toast('Your saved answers are synced.', 'success');
          }
          await refresh();
        }
        failures.current = 0; setRetryAt(0); setServerAvailable(true);
      } catch (error) {
        if (error instanceof ApiError && error.retryable) { failures.current++; setRetryAt(Date.now() + Math.max(error.retryAfterMs, retryDelay(failures.current))); if (error.status === 0) setServerAvailable(false); }
        if (sessionRef.current?.user.id === active.user.id && !lockedRef.current) await loadLocal(active.user.id);
        throw error;
      } finally { setSyncing(false); }
    })().finally(() => { syncJob.current = null; });
    return syncJob.current;
  }, [api, loadLocal, refresh, toast]);

  useEffect(() => { void (async () => {
    try {
      const [labels, prefs, activeId] = await Promise.all([vault.get('kgo-profiles'), vault.get('kgo-preferences'), vault.get('kgo-active')]);
      if (labels) setProfiles(JSON.parse(labels)); if (prefs) setPreferences({ ...defaults, ...JSON.parse(prefs) });
      if (activeId) { const stored = await vault.get(sessionKey(activeId)); if (stored) { const cached = JSON.parse(stored) as Session; sessionRef.current = cached; setSession(cached); setNeedsLogin(Boolean(cached.revoked)); setPinConfigured(Boolean(await vault.get(`kgo-pin-${activeId}`))); } }
    } catch { toast('Secure profiles could not be restored. Sign in to reconnect; cached work was not erased.', 'error'); }
    finally { setReady(true); }
  })(); }, [toast]);
  useEffect(() => {
    if (!sessionId || locked || preview || network.isConnected === false) return;
    const wifiAllowed = !preferences.wifiOnly || network.type === Network.NetworkStateType.WIFI || Platform.OS === 'web';
    if (!wifiAllowed) return;
    const delay = Math.max(0, retryAt - Date.now());
    const timer = setTimeout(() => { void sync().catch(() => { /* Saved queue remains visible; retry is scheduled. */ }); }, delay);
    return () => clearTimeout(timer);
  }, [sessionId, locked, preview, network.isConnected, network.type, preferences.wifiOnly, retryAt, sync]);
  useEffect(() => {
    lastInteraction.current = Date.now();
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && sessionRef.current && !previewRef.current) { lockedRef.current = true; setLocked(true); }
      if (state === 'active') lastInteraction.current = Date.now();
    });
    const timer = setInterval(() => { if (sessionRef.current && !previewRef.current && Date.now() - lastInteraction.current > 5 * 60000) { lockedRef.current = true; setLocked(true); } }, 15000);
    return () => { listener.remove(); clearInterval(timer); };
  }, []);
  const login = async (loginId: string, password: string, expectedRole: Role) => {
    if (syncJob.current || refreshJob.current) throw new Error('Wait for the current sync to finish before changing profiles.');
    const storedDevice = await vault.get('kgo-device'); const deviceId = storedDevice ?? randomUUID();
    if (!storedDevice) await vault.set('kgo-device', deviceId);
    const result = await api.public<Omit<Session, 'deviceId' | 'offlineUntil'>>('POST', 'auth/login', { loginId, password, deviceId });
    if (result.user.role !== expectedRole) toast('Opening the role assigned to this account.', 'info');
    const next: Session = { ...result, deviceId, offlineUntil: Date.now() + 7 * 86400000 };
    setPreview(false); previewRef.current = false; setNeedsLogin(false); lockedRef.current = true; setLocked(true);
    setSnapshot(emptySnapshot()); setQueued([]); setOutcomes([]); setClassroomId('');
    await replaceSession(next); await vault.set('kgo-active', next.user.id);
    const labels = [...profiles.filter((p) => p.id !== next.user.id), { id: next.user.id, alias: next.user.alias, role: next.user.role }].slice(-8);
    await vault.set('kgo-profiles', JSON.stringify(labels)); setProfiles(labels);
    // A successful online password login authorizes creating or resetting the local PIN.
    pinSetupOwner.current = next.user.id; setPinConfigured(false);
  };
  const unlock = async (pin: string) => {
    const active = sessionRef.current;
    if (!active || active.revoked || active.offlineUntil < Date.now()) { setNeedsLogin(true); throw new Error('Sign in online again to reconnect this profile. Your saved answers are retained.'); }
    const lockout = JSON.parse(await vault.get(`kgo-lockout-${active.user.id}`) ?? '{"failed":0,"until":0}') as { failed: number; until: number };
    if (lockout.until > Date.now()) throw new Error('Too many PIN attempts. Try again in a few minutes.');
    const verifier = await vault.get(`kgo-pin-${active.user.id}`);
    if (!verifier || verifier !== await pinDigest(active.user.id, pin)) {
      const failed = lockout.until && lockout.until <= Date.now() ? 1 : lockout.failed + 1;
      await vault.set(`kgo-lockout-${active.user.id}`, JSON.stringify({ failed, until: failed >= 5 ? Date.now() + 5 * 60000 : 0 }));
      throw new Error('That PIN does not match this profile.');
    }
    await vault.remove(`kgo-lockout-${active.user.id}`);
    lockedRef.current = false; setLocked(false); lastInteraction.current = Date.now();
    try { await loadLocal(active.user.id); }
    catch (error) { lockedRef.current = true; setLocked(true); throw error; }
  };
  const setPin = async (pin: string) => {
    const active = sessionRef.current; if (!active) throw new Error('Sign in first.');
    if (pinSetupOwner.current !== active.user.id || active.revoked) throw new Error('Sign in online before creating a new PIN.');
    if (!/^\d{6}$/.test(pin)) throw new Error('Choose a 6-digit PIN.');
    await vault.set(`kgo-pin-${active.user.id}`, await pinDigest(active.user.id, pin)); setPinConfigured(true);
    await unlock(pin);
    pinSetupOwner.current = null;
  };
  const logout = async () => {
    if (syncJob.current || refreshJob.current) throw new Error('Wait for the current sync to finish before signing out.');
    if (sessionRef.current && !previewRef.current) { try { await api.call('POST', 'auth/logout', {}); } catch (error) { if (!(error instanceof ApiError) || error.status !== 401) throw new Error('Reconnect to securely sign out. You can lock this device while offline.'); } }
    const owner = sessionRef.current?.user.id;
    if (owner && !owner.startsWith('preview-')) { const old = sessionRef.current!; await vault.set(sessionKey(owner), JSON.stringify({ ...old, accessToken: '', refreshToken: '', revoked: true })); }
    await vault.remove('kgo-active'); sessionRef.current = null; setSession(null); setPreview(false); previewRef.current = false; setLocked(true); lockedRef.current = true; setSnapshot(emptySnapshot()); setQueued([]); setOutcomes([]); setNeedsLogin(false);
  };
  const selectProfile = async (id: string) => {
    if (syncJob.current || refreshJob.current) throw new Error('Wait for sync to finish first.');
    const value = await vault.get(sessionKey(id)); if (!value) throw new Error('Sign in online to reconnect this profile.');
    const active = JSON.parse(value) as Session; sessionRef.current = active; setSession(active); setPreview(false); previewRef.current = false; lockedRef.current = true; setLocked(true); setNeedsLogin(Boolean(active.revoked)); setSnapshot(emptySnapshot()); setQueued([]); setOutcomes([]); setPinConfigured(Boolean(await vault.get(`kgo-pin-${id}`))); await vault.set('kgo-active', id);
  };
  const startPreview = (role: Role) => {
    if (syncJob.current || refreshJob.current) { toast('Wait for sync to finish before opening a preview.', 'error'); return; }
    const active = previewSession(role); const next = previewSnapshot();
    sessionRef.current = active; setSession(active); setPreview(true); previewRef.current = true; lockedRef.current = false; setLocked(false); setNeedsLogin(false); setPinConfigured(true); snapshotRef.current = next; setSnapshot(next); setQueued([]); setOutcomes([]); setClassroomId(next.classrooms[0].id); setNotice(null);
    void getRepository().then((repo) => repo.save(active.user.id, next)).catch(() => toast('Preview storage could not be opened.', 'error'));
  };
  const download = async (pack: Pack) => {
    const active = sessionRef.current; if (!active || lockedRef.current) throw new Error('Unlock your profile first.');
    if (previewRef.current) return;
    const data = await api.call<PackDownload>('GET', `content/packs/${pack.id}/download`);
    if (data.pack.id !== pack.id || data.gradingMode !== 'SERVER_ON_SYNC' || await digest(JSON.stringify({ pack: data.pack, lessons: data.lessons })) !== data.checksum) throw new Error('The content checksum does not match. Nothing was saved; try again.');
    if (sessionRef.current?.user.id !== active.user.id || lockedRef.current) throw new Error('Unlock the original profile to save this download.');
    await commit(active.user.id, { ...snapshotRef.current, downloads: [...snapshotRef.current.downloads.filter((d) => d.pack.id !== pack.id), data] }); toast('Lesson pack saved for offline learning.', 'success');
  };
  const queue = async (exerciseId: string, selectedOption: number, pack: Pack) => {
    const active = sessionRef.current;
    if (!active || active.user.role !== 'STUDENT' || lockedRef.current) throw new Error('Unlock a student profile to save an answer.');
    const classroom = snapshotRef.current.classrooms.find((c) => c.grade === pack.grade);
    if (!classroom) throw new Error('Ask your teacher to enroll you in a classroom for this grade.');
    const exercise = snapshotRef.current.downloads.flatMap((d) => d.lessons).flatMap((l) => l.exercises).find((e) => e.id === exerciseId);
    if (!exercise || !Number.isInteger(selectedOption) || selectedOption < 0 || selectedOption >= exercise.options.length) throw new Error('Choose an answer from a downloaded lesson.');
    await (await getRepository()).queue(active.user.id, { clientAttemptId: randomUUID(), classroomId: classroom.id, exerciseId, selectedOption, occurredAt: new Date().toISOString() });
    await loadLocal(active.user.id); toast('Answer saved. Correctness and coins are confirmed when you sync.', 'success');
  };
  const redeem = async (reward: Reward): Promise<Voucher> => {
    const active = sessionRef.current; if (!active || lockedRef.current || active.user.role !== 'STUDENT') throw new Error('Unlock a student profile first.');
    const repo = await getRepository(); const requestId = await repo.redemptionRequest(active.user.id, reward.id, randomUUID);
    let voucher: Voucher;
    if (previewRef.current) {
      const balance = snapshotRef.current.progress?.coinBalance ?? 0;
      if (balance < reward.cost || !reward.stock) throw new Error('Not enough sample coins or stock.');
      voucher = { redemption: { id: randomUUID(), studentId: active.user.id, rewardId: reward.id, requestId, cost: reward.cost, status: 'ISSUED', createdAt: new Date().toISOString(), claimedAt: null }, qrToken: 'KGO-DESIGN-PREVIEW-NOT-REDEEMABLE', claimMode: 'DESIGN_PREVIEW' };
      const next = { ...snapshotRef.current, vouchers: [...snapshotRef.current.vouchers, voucher], progress: snapshotRef.current.progress ? { ...snapshotRef.current.progress, coinBalance: balance - reward.cost } : null, rewards: snapshotRef.current.rewards.map((r) => r.id === reward.id ? { ...r, stock: r.stock - 1 } : r) };
      await commit(active.user.id, next);
    } else {
      voucher = await api.call('POST', 'rewards/redemptions', { requestId, rewardId: reward.id });
      // Save the issued voucher before retiring its idempotency key.
      const cached = await repo.snapshot(active.user.id);
      await commit(active.user.id, { ...cached, vouchers: [...cached.vouchers.filter((v) => v.redemption.id !== voucher.redemption.id), voucher] });
    }
    await repo.finishRedemption(active.user.id, reward.id);
    if (!previewRef.current) await refresh().catch(() => toast('Voucher issued. Reconnect to refresh your balance.', 'info'));
    return voucher;
  };
  const mutate = async <T,>(method: string, route: string, body?: unknown): Promise<T> => {
    if (previewRef.current) throw new Error('This management action needs a live administrator account.');
    if (lockedRef.current) throw new Error('Unlock your profile first.');
    const result = await api.call<T>(method, route, body);
    await refresh().catch(() => toast('Saved on the server. Reconnect to refresh this screen.', 'info')); return result;
  };
  const setClassroom = async (id: string) => {
    setClassroomId(id); const active = sessionRef.current;
    if (active?.user.role === 'TEACHER' && !previewRef.current && !snapshotRef.current.reports.some((r) => r.classroomId === id)) {
      const report = await api.call<ClassReport>('GET', `reports/classrooms/${id}`);
      await commit(active.user.id, { ...snapshotRef.current, reports: [...snapshotRef.current.reports.filter((r) => r.classroomId !== id), report] });
    }
  };
  const updatePreferences = async (change: Partial<Preferences>) => { const next = { ...preferences, ...change }; await vault.set('kgo-preferences', JSON.stringify(next)); setPreferences(next); };
  const updatePreview = (update: (next: Snapshot) => Snapshot) => { if (!previewRef.current || !sessionRef.current) return; const owner = sessionRef.current.user.id; const next = update(snapshotRef.current); snapshotRef.current = next; setSnapshot(next); void getRepository().then((repo) => repo.save(owner, next)).catch(() => toast('Preview changes could not be cached.', 'error')); };
  return <AppContext.Provider value={{ ready, session, locked, pinConfigured, needsLogin, preview, snapshot, queued, outcomes, profiles, busy, syncing, online, notice, preferences, api, apiUrl, classroomId, setClassroom, toast, dismiss: () => setNotice(null), login, logout, lock: () => { lockedRef.current = true; setLocked(true); }, unlock, setPin, selectProfile, startPreview, refresh, sync, download, queue, redeem, mutate, updatePreferences, updatePreview }}>
    <React.Fragment><InteractionBoundary onTouch={() => { lastInteraction.current = Date.now(); }}>{children}</InteractionBoundary></React.Fragment>
  </AppContext.Provider>;
}
// Touches update inactivity without recording what a learner tapped or typed.
function InteractionBoundary({ onTouch, children }: { onTouch: () => void; children: React.ReactNode }) {
  return <View style={{ flex: 1 }} onTouchStart={onTouch}>{children}</View>;
}
export function useApp() { const value = useContext(AppContext); if (!value) throw new Error('AppProvider is required'); return value; }
