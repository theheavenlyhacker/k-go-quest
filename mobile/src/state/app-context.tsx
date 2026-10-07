import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import type { DownloadedPack } from '../domain/packs';
import type { Pack, Profile, SkillParameters } from '../domain/types';
import { starterPacks } from '../content/starter-pack';
import { applySkillParametersToPacks, demoHistory, grade, learningState, type Attempt, type Grade, type LearningState, type UploadRecord } from '../domain/engine';
import { balance as coinBalance, buy, type Purchase } from '../domain/shop';
import { caretakerState, confirmCaretaker, keepCaretaker, setupStep, type SetupStep } from '../domain/setup';
import { isIdle, isValidPin, lockedOut, recordFailure, remaining, type Lockout } from '../domain/pin-lock';
import { getRepository } from '../data/storage';
import { pinDigest } from '../data/crypto';
import { vault } from '../data/vault';

export type Appearance = 'light' | 'dark' | 'system';
interface Preferences { appearance: Appearance; language: string; }
interface Notice { message: string; kind: 'success' | 'error' | 'info'; }
export interface ActiveModelRecord {
  version: string;
  source: string;
  fittedAt: string;
  parameters: Record<string, SkillParameters>;
}
interface AppContextValue {
  ready: boolean; profiles: Profile[]; profile: Profile | null; locked: boolean; caretaker: boolean;
  /** Everything this tablet can practise from: the Starter Pack, plus every Downloaded Pack. */
  packs: Pack[];
  activeModel: ActiveModelRecord | null;
  saveActiveModel(model: ActiveModelRecord | null): Promise<void>;
  /** The Downloaded Packs with when each was taken from the server. The single reader of the Pack cache. */
  downloaded: DownloadedPack[];
  /** Re-reads the Downloaded Packs after one has been saved. */
  reloadPacks(): Promise<void>;
  attempts: Attempt[]; learning: LearningState;
  /** Re-reads what the server said about this Profile's Attempts, after a sync, so Mastery and Coins catch up. */
  reloadVerdicts(profileId: string): Promise<void>; uploads: Map<string, UploadRecord>; purchases: Purchase[]; balance: number;
  notice: Notice | null; preferences: Preferences;
  toast(message: string, kind?: Notice['kind']): void; dismiss(): void;
  /** False until the intro has been finished or skipped once on this Shared Tablet. */
  introSeen: boolean; finishIntro(): Promise<void>;
  /** False until the sign-in screen has been passed, signed in or not. Once per Shared Tablet. */
  signInSeen: boolean; finishSignIn(): Promise<void>;
  step: SetupStep; saveCaretakerId(id: string): Promise<void>; caretakerSignedOut(): void; setCaretakerPin(pin: string): Promise<void>; finishSetup(): Promise<void>;
  /** Finishes Setup's first step with no network. No account, so no PIN recovery until one is linked. */
  setUpWithoutAccount(): Promise<void>;
  /** True once a Caretaker Account is attached — the only thing that makes Forgot-PIN possible. */
  accountLinked: boolean;
  linkCaretakerAccount(userId: string, signOut: () => Promise<void>): Promise<void>;
  createProfile(alias: string, pin: string, openAfter?: boolean): Promise<void>;
  openCaretaker(pin: string): Promise<void>; closeCaretaker(): void;
  /** Forgot-PIN: throws unless the Clerk account is the one saved at Setup; always signs out. */
  confirmCaretakerAccount(userId: string, signOut: () => Promise<void>): Promise<void>;
  resetCaretakerPin(pin: string): Promise<void>;
  /** The Demo Learner's Profile ID, once Setup has made it. */
  demoId: string | null; resetDemo(): Promise<void>;
  deleteProfile(id: string): Promise<void>; resetProfilePin(id: string, pin: string): Promise<void>;
  /** Minutes this Profile is locked out for; 0 when it is not. */
  lockoutFor(id: string): Promise<number>;
  /** Caretaker: let a locked-out Learner back in, keeping their PIN. */
  clearLockout(id: string): Promise<void>;
  /** Read-only look at one Profile's data, for the Caretaker. */
  viewProfile(id: string): Promise<{ attempts: Attempt[]; purchases: Purchase[]; uploads: Map<string, UploadRecord> }>;
  selectProfile(id: string | null): void; lock(): void; unlock(pin: string): Promise<void>;
  answer(exerciseId: string, selectedOption: number): Promise<Grade>;
  buyBadge(cosmeticId: string): Promise<void>;
  updatePreferences(change: Partial<Preferences>): Promise<void>;
}
const AppContext = createContext<AppContextValue | null>(null);
const defaults: Preferences = { appearance: 'light', language: 'en' };
const pinKey = (id: string) => `kgo-pin-${id}`;
const CARETAKER_ID = 'kgo-caretaker-id';
// Set when Setup finished with no network, so the step is not asked for again.
const CARETAKER_LOCAL = 'kgo-caretaker-local';
const CARETAKER_PIN = 'kgo-caretaker-pin';
const SETUP_DONE = 'kgo-setup-done';
const DEMO_ID = 'kgo-demo-id';
const INTRO_SEEN = 'kgo-intro-seen';
const SIGN_IN_SEEN = 'kgo-sign-in-seen';
// Same verifier as Profile PINs, keyed by a fixed owner instead of a Profile ID.
const CARETAKER_OWNER = 'caretaker';
const lockoutKey = (id: string) => `kgo-lockout-${id}`;
const NO_LOCKOUT: Lockout = { failed: 0, until: 0 };
// Says how long is actually left rather than repeating the full wait, so a
// Learner who comes back after four minutes is not told to wait five more.
const waitMessage = (minutes: number) =>
  `Too many wrong PINs. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or ask your Caretaker to let you back in.`;

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
  const [activeModel, setActiveModel] = useState<ActiveModelRecord | null>(null);
  const effectivePacks = useMemo(() => {
    if (!activeModel?.parameters) return packs;
    return applySkillParametersToPacks(packs, activeModel.parameters);
  }, [packs, activeModel]);
  const [uploads, setUploads] = useState<Map<string, UploadRecord>>(new Map());
  const learning = useMemo(() => learningState(effectivePacks, attempts, uploads), [effectivePacks, attempts, uploads]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const balance = coinBalance(learning.coins, purchases);
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [saved, setSaved] = useState({ hasCaretaker: false, pinSet: false, done: false });
  const [accountLinked, setAccountLinked] = useState(false);
  const [introSeen, setIntroSeen] = useState(false);
  const [signInSeen, setSignInSeen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [demoId, setDemoId] = useState<string | null>(null);
  const profileRef = useRef(profile); const attemptsRef = useRef(attempts); const uploadsRef = useRef(uploads); const purchasesRef = useRef(purchases); const packsRef = useRef(effectivePacks);
  const lockedRef = useRef(locked); const caretakerRef = useRef(caretaker); const lastInteraction = useRef(0);

  const toast = useCallback((message: string, kind: Notice['kind'] = 'info') => setNotice({ message, kind }), []);
  const saveActiveModel = useCallback(async (model: ActiveModelRecord | null) => {
    setActiveModel(model);
    if (model) {
      await vault.set('kgo-active-model', JSON.stringify(model));
    } else {
      await vault.remove('kgo-active-model');
    }
  }, []);
  // Refs mirror committed state so async handlers read fresh values; set after every commit, never during render.
  useEffect(() => { profileRef.current = profile; attemptsRef.current = attempts; uploadsRef.current = uploads; purchasesRef.current = purchases; lockedRef.current = locked; caretakerRef.current = caretaker; packsRef.current = effectivePacks; });

  const forget = () => { attemptsRef.current = []; setAttempts([]); uploadsRef.current = new Map(); setUploads(new Map()); purchasesRef.current = []; setPurchases([]); };
  const lock = useCallback(() => { lockedRef.current = true; setLocked(true); }, []);
  const loadLocal = useCallback(async (owner: string) => {
    const repo = await getRepository();
    const [log, bought, verdicts] = await Promise.all([repo.attempts(owner), repo.purchases(owner), repo.uploads(owner)]);
    if (profileRef.current?.id === owner && !lockedRef.current) { attemptsRef.current = log; setAttempts(log); uploadsRef.current = verdicts; setUploads(verdicts); purchasesRef.current = bought; setPurchases(bought); }
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
      const [labels, prefs, id, local, pin, done, demo, intro, savedModel, signedIn] = await Promise.all([
        vault.get('kgo-profiles'),
        vault.get('kgo-preferences'),
        vault.get(CARETAKER_ID),
        vault.get(CARETAKER_LOCAL),
        vault.get(CARETAKER_PIN),
        vault.get(SETUP_DONE),
        vault.get(DEMO_ID),
        vault.get(INTRO_SEEN),
        vault.get('kgo-active-model'),
        vault.get(SIGN_IN_SEEN),
      ]);
      setIntroSeen(Boolean(intro)); setSignInSeen(Boolean(signedIn));
      const caretakerAccount = caretakerState(id, Boolean(local));
      setSaved({ hasCaretaker: caretakerAccount.present, pinSet: Boolean(pin), done: Boolean(done) }); setAccountLinked(caretakerAccount.linked); setDemoId(demo);
      if (labels) setProfiles(JSON.parse(labels)); if (prefs) setPreferences({ ...defaults, ...JSON.parse(prefs) });
      if (savedModel) {
        try { setActiveModel(JSON.parse(savedModel) as ActiveModelRecord); } catch {}
      }
    } catch { setIntroSeen(true); toast('Profiles on this tablet could not be restored.', 'error'); }
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
  // The Learner moves on first; a failed save only means the intro may show once more.
  const finishIntro = async () => {
    setIntroSeen(true);
    try { await vault.set(INTRO_SEEN, '1'); } catch { toast('Could not save that you have seen the intro.', 'error'); }
  };
  // Signed in or walked past: either way the door is done with. A failed write
  // costs the Caretaker the screen again, never a session and never any data.
  const finishSignIn = async () => {
    setSignInSeen(true);
    try { await vault.set(SIGN_IN_SEEN, '1'); } catch { /* shown again next launch, which is harmless */ }
  };
  // Two steps so Setup stays on the sign-in step (Clerk mounted) until the Clerk sign-out has finished.
  const saveCaretakerId = (id: string) => vault.set(CARETAKER_ID, id);
  const caretakerSignedOut = () => { setSaved((s) => ({ ...s, hasCaretaker: true })); setAccountLinked(true); };
  // Setup with the radio off. Everything a Learner does works the same; what is
  // missing is the proof of identity that Forgot-PIN needs, and the screen says so.
  const setUpWithoutAccount = async () => {
    await vault.set(CARETAKER_LOCAL, '1'); setSaved((s) => ({ ...s, hasCaretaker: true }));
  };
  const linkCaretakerAccount = async (userId: string, signOut: () => Promise<void>) => {
    await keepCaretaker(userId, saveCaretakerId, signOut);
    await vault.remove(CARETAKER_LOCAL); setAccountLinked(true);
  };
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
  const readLockout = async (owner: string): Promise<Lockout> => {
    try { return JSON.parse(await vault.get(lockoutKey(owner)) ?? 'null') as Lockout ?? NO_LOCKOUT; }
    catch { return NO_LOCKOUT; }
  };
  /** What the Caretaker screen shows: how long this Profile is shut out for. */
  const lockoutFor = useCallback(async (id: string) => remaining(await readLockout(id), Date.now()), []);
  /**
   * Lets a Learner back in without changing the PIN they already know.
   *
   * Resetting the PIN also cleared the lockout, but it made a child learn a new
   * PIN because they mistyped the old one five times. The wait is there to stop
   * someone guessing at a tablet, not to punish a bad morning.
   */
  const clearLockout = async (id: string) => {
    requireCaretaker();
    await vault.remove(lockoutKey(id));
  };
  const checkPin = async (owner: string, verifierKey: string, pin: string, mismatch: string) => {
    const lockout = await readLockout(owner);
    if (lockedOut(lockout, Date.now())) throw new Error(waitMessage(remaining(lockout, Date.now())));
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
    const [attempts, purchases, uploads] = await Promise.all([repo.attempts(id), repo.purchases(id), repo.uploads(id)]);
    return { attempts, purchases, uploads };
  };
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
    const purchase = buy(learningState(packsRef.current, attemptsRef.current, uploadsRef.current).coins, purchasesRef.current, cosmeticId, new Date().toISOString());
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
  return <AppContext.Provider value={{ ready, profiles, profile, locked, caretaker, packs: effectivePacks, activeModel, saveActiveModel, downloaded, reloadPacks, attempts, learning, reloadVerdicts: loadLocal, uploads, purchases, balance, notice, preferences, toast, dismiss: () => setNotice(null), step: setupStep(saved), introSeen, finishIntro, signInSeen, finishSignIn, saveCaretakerId, caretakerSignedOut, setUpWithoutAccount, accountLinked, linkCaretakerAccount, setCaretakerPin, finishSetup, createProfile, openCaretaker, closeCaretaker, confirmCaretakerAccount, resetCaretakerPin, demoId, resetDemo, deleteProfile, resetProfilePin, lockoutFor, clearLockout, viewProfile, selectProfile, lock, unlock, answer, buyBadge, updatePreferences }}>
    <InteractionBoundary onTouch={() => { lastInteraction.current = Date.now(); }}>{children}</InteractionBoundary>
  </AppContext.Provider>;
}
// Touches update inactivity without recording what a learner tapped or typed.
function InteractionBoundary({ onTouch, children }: { onTouch: () => void; children: React.ReactNode }) {
  return <View style={{ flex: 1 }} onTouchStart={onTouch}>{children}</View>;
}
export function useApp() { const value = useContext(AppContext); if (!value) throw new Error('AppProvider is required'); return value; }
