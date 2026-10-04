import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import type { DownloadedPack } from '../domain/packs';
import type { Pack, Profile } from '../domain/types';
import { starterPacks } from '../content/starter-pack';
import { demoHistory, grade, growth, learningState, type Attempt, type Grade, type LearningState } from '../domain/engine';
import { balance as coinBalance, buy, type Purchase } from '../domain/shop';
import { confirmCaretaker, setupStep, type SetupStep } from '../domain/setup';
import { isIdle, isValidPin, lockedOut, recordFailure, type Lockout } from '../domain/pin-lock';
import { getRepository } from '../data/storage';
import { pinDigest } from '../data/crypto';
import { vault } from '../data/vault';

export type Appearance = 'light' | 'dark' | 'system';
interface Preferences { appearance: Appearance; language: string; }
interface Notice { message: string; kind: 'success' | 'error' | 'info'; }
/** One Profile's place in this Shared Tablet's monthly standings: Growth counts only, never Attempts. */
export interface Standing { id: string; alias: string; up: number; mastered: number; }
interface AppContextValue {
  ready: boolean; profiles: Profile[]; profile: Profile | null; locked: boolean; caretaker: boolean;
  /** Everything this tablet can practise from: the Starter Pack, plus every Downloaded Pack. */
  packs: Pack[];
  /** The Downloaded Packs with when each was taken from the server. The single reader of the Pack cache. */
  downloaded: DownloadedPack[];
  /** Re-reads the Downloaded Packs after one has been saved. */
  reloadPacks(): Promise<void>;
  attempts: Attempt[]; learning: LearningState; purchases: Purchase[]; balance: number;
  notice: Notice | null; preferences: Preferences;
  toast(message: string, kind?: Notice['kind']): void; dismiss(): void;
  step: SetupStep; saveCaretakerId(id: string): Promise<void>; caretakerSignedOut(): void; setCaretakerPin(pin: string): Promise<void>; finishSetup(): Promise<void>;
  createProfile(alias: string, pin: string, openAfter?: boolean): Promise<void>;
  openCaretaker(pin: string): Promise<void>; closeCaretaker(): void;
  /** Forgot-PIN: throws unless the Clerk account is the one saved at Setup; always signs out. */
  confirmCaretakerAccount(userId: string, signOut: () => Promise<void>): Promise<void>;
  resetCaretakerPin(pin: string): Promise<void>;
  /** The Demo Learner's Profile ID, once Setup has made it. */
  demoId: string | null; resetDemo(): Promise<void>;
  deleteProfile(id: string): Promise<void>; resetProfilePin(id: string, pin: string): Promise<void>;
  /** Read-only look at one Profile's data, for the Caretaker. */
  viewProfile(id: string): Promise<{ attempts: Attempt[]; purchases: Purchase[] }>;
  /** Every Profile on this Shared Tablet ranked by this month's Growth. Any Learner may read it; it carries no one's Attempts. */
  standings(): Promise<Standing[]>;
  selectProfile(id: string | null): void; lock(): void; unlock(pin: string): Promise<void>;
  answer(exerciseId: string, selectedOption: number): Promise<Grade>;
  buyBadge(cosmeticId: string): Promise<void>;
  updatePreferences(change: Partial<Preferences>): Promise<void>;
}
const AppContext = createContext<AppContextValue | null>(null);
const defaults: Preferences = { appearance: 'light', language: 'en' };
const pinKey = (id: string) => `kgo-pin-${id}`;
const CARETAKER_ID = 'kgo-caretaker-id';
const CARETAKER_PIN = 'kgo-caretaker-pin';
const SETUP_DONE = 'kgo-setup-done';
const DEMO_ID = 'kgo-demo-id';
// Same verifier as Profile PINs, keyed by a fixed owner instead of a Profile ID.
const CARETAKER_OWNER = 'caretaker';
const lockoutKey = (id: string) => `kgo-lockout-${id}`;
const WAIT_MESSAGE = 'Too many wrong PINs. Wait 5 minutes, then try again.';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [locked, setLocked] = useState(true);
  const [caretaker, setCaretaker] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  // Downloaded Packs sit beside the Starter Pack rather than replacing it, so a
  // tablet that has never been online keeps exactly the content it shipped with.
  const [downloaded, setDownloaded] = useState<DownloadedPack[]>([]);
  const packs = useMemo(() => [...starterPacks, ...downloaded.map((entry) => entry.pack)], [downloaded]);
  const learning = useMemo(() => learningState(packs, attempts), [packs, attempts]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const balance = coinBalance(learning.coins, purchases);
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [saved, setSaved] = useState({ hasCaretaker: false, pinSet: false, done: false });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [demoId, setDemoId] = useState<string | null>(null);
  const profileRef = useRef(profile); const attemptsRef = useRef(attempts); const purchasesRef = useRef(purchases); const packsRef = useRef(packs);
  const lockedRef = useRef(locked); const caretakerRef = useRef(caretaker); const lastInteraction = useRef(0);

  const toast = useCallback((message: string, kind: Notice['kind'] = 'info') => setNotice({ message, kind }), []);
  // Refs mirror committed state so async handlers read fresh values; set after every commit, never during render.
  useEffect(() => { profileRef.current = profile; attemptsRef.current = attempts; purchasesRef.current = purchases; lockedRef.current = locked; caretakerRef.current = caretaker; packsRef.current = packs; });

  const forget = () => { attemptsRef.current = []; setAttempts([]); purchasesRef.current = []; setPurchases([]); };
  const lock = useCallback(() => { lockedRef.current = true; setLocked(true); }, []);
  const loadLocal = useCallback(async (owner: string) => {
    const repo = await getRepository();
    const [log, bought] = await Promise.all([repo.attempts(owner), repo.purchases(owner)]);
    if (profileRef.current?.id === owner && !lockedRef.current) { attemptsRef.current = log; setAttempts(log); purchasesRef.current = bought; setPurchases(bought); }
  }, []);

  /**
   * Re-reads the Content Packs this tablet has downloaded.
   *
   * A failure here is never fatal: the Starter Pack is compiled into the app,
   * so practice continues with it alone and the Caretaker is told the rest
   * could not be read.
   */
  const readPacks = useCallback(async () => (await getRepository()).downloadedPacks(), []);
  const reloadPacks = useCallback(async () => { setDownloaded(await readPacks()); }, [readPacks]);

  // `readPacks` answers rather than writing state, so the Packs land after the
  // read and never during the effect itself.
  useEffect(() => {
    let live = true;
    void readPacks()
      .then((next) => { if (live) setDownloaded(next); })
      .catch(() => { if (live) toast('Downloaded Content Packs could not be read.', 'error'); });
    return () => { live = false; };
  }, [readPacks, toast]);

  useEffect(() => { void (async () => {
    try {
      const [labels, prefs, id, pin, done, demo] = await Promise.all([vault.get('kgo-profiles'), vault.get('kgo-preferences'), vault.get(CARETAKER_ID), vault.get(CARETAKER_PIN), vault.get(SETUP_DONE), vault.get(DEMO_ID)]);
      setSaved({ hasCaretaker: Boolean(id), pinSet: Boolean(pin), done: Boolean(done) }); setDemoId(demo);
      if (labels) setProfiles(JSON.parse(labels)); if (prefs) setPreferences({ ...defaults, ...JSON.parse(prefs) });
    } catch { toast('Profiles on this tablet could not be restored.', 'error'); }
    finally { setReady(true); }
  })(); }, [toast]);

  useEffect(() => {
    lastInteraction.current = Date.now();
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') { if (profileRef.current) lock(); setCaretaker(false); }
      if (state === 'active') lastInteraction.current = Date.now();
    });
    const timer = setInterval(() => {
      if (!isIdle(lastInteraction.current, Date.now())) return;
      if (profileRef.current) lock();
      if (caretakerRef.current) setCaretaker(false);
    }, 15000);
    return () => { listener.remove(); clearInterval(timer); };
  }, [lock]);

  const open = async (next: Profile) => {
    profileRef.current = next; setProfile(next); forget();
    lockedRef.current = false; setLocked(false); lastInteraction.current = Date.now();
    try { await loadLocal(next.id); }
    catch (error) { lock(); throw error; }
  };
  // Two steps so Setup stays on the sign-in step (Clerk mounted) until the Clerk sign-out has finished.
  const saveCaretakerId = (id: string) => vault.set(CARETAKER_ID, id);
  const caretakerSignedOut = () => setSaved((s) => ({ ...s, hasCaretaker: true }));
  const setCaretakerPin = async (pin: string) => {
    if (!isValidPin(pin)) throw new Error('Choose a 6-digit PIN.');
    await vault.set(CARETAKER_PIN, await pinDigest(CARETAKER_OWNER, pin)); setSaved((s) => ({ ...s, pinSet: true }));
  };
  const finishSetup = async () => {
    if (!profiles.length) throw new Error('Create at least one profile first.');
    // The Demo Learner has no PIN until the Caretaker sets one (Reset PIN), so nobody can open it before then.
    // Reuse the saved Demo Learner on a retry, so a half-finished Setup never leaves a second one.
    const id = await vault.get(DEMO_ID) ?? randomUUID();
    await vault.set(DEMO_ID, id); await seedDemo(id);
    const all = profiles.some((p) => p.id === id) ? profiles : [...profiles, { id, alias: 'Demo Learner' }];
    await vault.set('kgo-profiles', JSON.stringify(all)); setProfiles(all); setDemoId(id);
    await vault.set(SETUP_DONE, '1'); setSaved((s) => ({ ...s, done: true }));
  };
  const seedDemo = async (id: string) => {
    const repo = await getRepository();
    await repo.deleteOwner(id);
    for (const a of demoHistory(packsRef.current, new Date())) await repo.record(id, a);
  };
  const resetDemo = async () => {
    requireCaretaker();
    if (!demoId) throw new Error('There is no Demo Learner on this tablet.');
    await seedDemo(demoId);
  };
  const createProfile = async (alias: string, pin: string, openAfter = true) => {
    const name = alias.trim();
    if (!name) throw new Error('Enter a name for this profile.');
    if (!isValidPin(pin)) throw new Error('Choose a 6-digit PIN.');
    const next = { id: randomUUID(), alias: name };
    const all = [...profiles, next];
    await vault.set(pinKey(next.id), await pinDigest(next.id, pin));
    await vault.set('kgo-profiles', JSON.stringify(all)); setProfiles(all);
    if (openAfter) await open(next);
  };
  const selectProfile = (id: string | null) => {
    const next = profiles.find((p) => p.id === id) ?? null;
    profileRef.current = next; setProfile(next); lock(); forget();
  };
  /** Checks a PIN against its stored verifier, with the shared 5-failure wait. */
  const checkPin = async (owner: string, verifierKey: string, pin: string, mismatch: string) => {
    const lockout = JSON.parse(await vault.get(lockoutKey(owner)) ?? '{"failed":0,"until":0}') as Lockout;
    if (lockedOut(lockout, Date.now())) throw new Error(WAIT_MESSAGE);
    const verifier = await vault.get(verifierKey);
    if (!verifier || verifier !== await pinDigest(owner, pin)) {
      await vault.set(lockoutKey(owner), JSON.stringify(recordFailure(lockout, Date.now())));
      throw new Error(mismatch);
    }
    await vault.remove(lockoutKey(owner));
  };
  const unlock = async (pin: string) => {
    const active = profileRef.current; if (!active) throw new Error('Choose a profile first.');
    await checkPin(active.id, pinKey(active.id), pin, 'That PIN does not match this profile.');
    await open(active);
  };
  const openCaretaker = async (pin: string) => {
    await checkPin(CARETAKER_OWNER, CARETAKER_PIN, pin, 'That PIN does not match the Caretaker PIN.');
    // Set the ref now: the Caretaker screens mount in the next commit and read it before the sync effect runs.
    lastInteraction.current = Date.now(); caretakerRef.current = true; setCaretaker(true);
  };
  const confirmCaretakerAccount = async (userId: string, signOut: () => Promise<void>) => confirmCaretaker(userId, await vault.get(CARETAKER_ID), signOut);
  // Only the PIN verifier and its wait change; Profiles, Attempts and Purchases are not touched.
  const resetCaretakerPin = async (pin: string) => {
    if (!isValidPin(pin)) throw new Error('Choose a 6-digit PIN.');
    await vault.set(CARETAKER_PIN, await pinDigest(CARETAKER_OWNER, pin)); await vault.remove(lockoutKey(CARETAKER_OWNER));
  };
  const closeCaretaker = () => { caretakerRef.current = false; setCaretaker(false); };
  const requireCaretaker = () => { if (!caretakerRef.current) throw new Error('Enter the Caretaker PIN first.'); };
  const deleteProfile = async (id: string) => {
    requireCaretaker();
    await (await getRepository()).deleteOwner(id);
    await Promise.all([vault.remove(pinKey(id)), vault.remove(lockoutKey(id)), vault.remove(`kgo-key-${id}`)]);
    const all = profiles.filter((p) => p.id !== id);
    await vault.set('kgo-profiles', JSON.stringify(all)); setProfiles(all);
  };
  const resetProfilePin = async (id: string, pin: string) => {
    requireCaretaker();
    if (!isValidPin(pin)) throw new Error('Choose a 6-digit PIN.');
    await vault.set(pinKey(id), await pinDigest(id, pin)); await vault.remove(lockoutKey(id));
  };
  const viewProfile = async (id: string) => {
    requireCaretaker();
    const repo = await getRepository();
    const [attempts, purchases] = await Promise.all([repo.attempts(id), repo.purchases(id)]);
    return { attempts, purchases };
  };
  /**
   * Ranks the Profiles on this Shared Tablet by this month's Growth.
   *
   * Only the two Growth counts cross between Profiles — never Attempts,
   * Mastery or Coins — so a Learner sees who is improving without seeing
   * anyone's answers. Improvement is what ranks, not totals, so a Learner who
   * started lower can still come first. A Profile whose rows cannot be opened
   * counts as no movement rather than dropping out of the standings.
   */
  const standings = useCallback(async (): Promise<Standing[]> => {
    const repo = await getRepository();
    const now = new Date();
    const rows = await Promise.all(profiles.map(async (p) => {
      const log = await repo.attempts(p.id).catch((): Attempt[] => []);
      const month = growth(packs, log, now).thisMonth;
      return { id: p.id, alias: p.alias, up: month.up, mastered: month.mastered };
    }));
    return rows.sort((a, b) => b.up - a.up || b.mastered - a.mastered || a.alias.localeCompare(b.alias));
  }, [packs, profiles]);
  const answer = async (exerciseId: string, selectedOption: number) => {
    const active = profileRef.current;
    if (!active || lockedRef.current) throw new Error('Unlock your profile to save an answer.');
    const result = grade(packsRef.current, attemptsRef.current, { id: randomUUID(), exerciseId, selectedOption }, new Date().toISOString());
    await (await getRepository()).record(active.id, result.attempt);
    const next = [...attemptsRef.current, result.attempt];
    attemptsRef.current = next; setAttempts(next);
    return result;
  };
  const buyBadge = async (cosmeticId: string) => {
    const active = profileRef.current;
    if (!active || lockedRef.current) throw new Error('Unlock your profile to use the Shop.');
    const purchase = buy(learningState(packsRef.current, attemptsRef.current).coins, purchasesRef.current, cosmeticId, new Date().toISOString());
    // Claim the ref before the await so a second tap sees the spend; roll back if the save fails.
    const before = purchasesRef.current;
    purchasesRef.current = [...before, purchase]; setPurchases(purchasesRef.current);
    try { await (await getRepository()).recordPurchase(active.id, purchase); }
    catch (error) {
      if (profileRef.current?.id === active.id && purchasesRef.current.includes(purchase)) { purchasesRef.current = before; setPurchases(before); }
      throw error;
    }
  };
  const updatePreferences = async (change: Partial<Preferences>) => { const next = { ...preferences, ...change }; await vault.set('kgo-preferences', JSON.stringify(next)); setPreferences(next); };
  return <AppContext.Provider value={{ ready, profiles, profile, locked, caretaker, packs, downloaded, reloadPacks, attempts, learning, purchases, balance, notice, preferences, toast, dismiss: () => setNotice(null), step: setupStep(saved), saveCaretakerId, caretakerSignedOut, setCaretakerPin, finishSetup, createProfile, openCaretaker, closeCaretaker, confirmCaretakerAccount, resetCaretakerPin, demoId, resetDemo, deleteProfile, resetProfilePin, viewProfile, standings, selectProfile, lock, unlock, answer, buyBadge, updatePreferences }}>
    <InteractionBoundary onTouch={() => { lastInteraction.current = Date.now(); }}>{children}</InteractionBoundary>
  </AppContext.Provider>;
}
// Touches update inactivity without recording what a learner tapped or typed.
function InteractionBoundary({ onTouch, children }: { onTouch: () => void; children: React.ReactNode }) {
  return <View style={{ flex: 1 }} onTouchStart={onTouch}>{children}</View>;
}
export function useApp() { const value = useContext(AppContext); if (!value) throw new Error('AppProvider is required'); return value; }
