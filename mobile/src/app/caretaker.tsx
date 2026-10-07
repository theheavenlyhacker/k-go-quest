import { lazy, Suspense, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LockKeyhole, Plus, School } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { useOnline } from '@/state/online-context';
import { canOpenAdmin } from '@/domain/admin';
import { learningState } from '@/domain/engine';
import { COMPILED_MODEL_METADATA } from '@/content/fitted-parameters';
import type { Pack } from '@/domain/types';
import { isValidPin } from '@/domain/pin-lock';
import { Action, BackLink, Button, Card, Eyebrow, Field, Pill, Row, Sheet, T } from '@/ui/primitives';
import { PackLibrary } from '@/ui/pack-library';
import { ProfileSync, ServerPanel } from '@/ui/server-panel';
import { Screen } from '@/ui/screen';
import { tokens, useTheme } from '@/ui/theme';

// Clerk is loaded only when a Caretaker actually chooses to link an account.
const CaretakerSignIn = lazy(() => import('@/ui/caretaker-sign-in'));

const lessonTitle = (packs: Pack[], skillId: string) => packs.flatMap((p) => p.lessons).find((l) => l.skillCode === skillId)?.title ?? skillId;

/** Every Profile with its Plateau Flags, and the Caretaker's Profile actions. */
export default function Caretaker() {
  const { profiles, closeCaretaker, createProfile, deleteProfile, accountLinked, toast, activeModel } = useApp();
  const [adding, setAdding] = useState(false);
  const router = useRouter();
  const theme = useTheme();
  const { state, server } = useOnline();
  const modelInfo = activeModel ?? COMPILED_MODEL_METADATA;
  const dateStr = modelInfo.fittedAt ? modelInfo.fittedAt.slice(0, 10) : '2026-10-04';
  return (
    <Screen title="Caretaker" caption="Profiles on this tablet">
      <BackLink label="Close Caretaker screen" onPress={closeCaretaker} />
      {accountLinked ? null : <LinkAccountCard />}
      <Eyebrow>School server</Eyebrow>
      <ServerPanel />
      {canOpenAdmin(state, server) ? <Button title="Open the LGU Admin shell" icon={School} onPress={() => router.push('/dashboard')} /> : null}
      <Eyebrow>Skill Parameters</Eyebrow>
      <Card style={{ gap: 4 }}>
        <T size={12} color={theme.muted}>
          {`Skill Parameters: ${modelInfo.version} · ${modelInfo.source} · fitted ${dateStr}`}
        </T>
      </Card>
      <Eyebrow>Content Packs</Eyebrow>
      <PackLibrary />
      <Eyebrow>Profiles</Eyebrow>
      {profiles.map((p) => (
        <ProfileCard key={p.id} id={p.id} alias={p.alias} onOpen={() => router.push({ pathname: '/caretaker-profile', params: { id: p.id } })}
          onDelete={() => Alert.alert(`Delete ${p.alias}?`, 'This removes the Profile and all of its answers and purchases. It cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => void deleteProfile(p.id).catch(() => toast('Could not delete this Profile.', 'error')) },
          ])} />
      ))}
      {profiles.length ? null : <T size={12} color={theme.muted}>No Profiles yet.</T>}
      <Button title="Add Profile" icon={Plus} variant="soft" onPress={() => setAdding(true)} />
      <Sheet visible={adding} title="Add a Profile" onClose={() => setAdding(false)}>
        <AddProfileForm onCreate={async (alias, pin) => { await createProfile(alias, pin, false); setAdding(false); }} />
      </Sheet>
    </Screen>
  );
}

/**
 * Shown only on a tablet set up with no network. Linking is the one thing that
 * makes a forgotten Caretaker PIN recoverable, so this sits at the top until
 * it is done rather than hiding in a settings list.
 */
function LinkAccountCard() {
  const { linkCaretakerAccount, toast } = useApp();
  const [signingIn, setSigningIn] = useState(false);
  return (
    <>
      <Eyebrow>Caretaker Account</Eyebrow>
      <Card style={{ gap: 8 }}>
        <T size={12}>
          This tablet was set up without one. Until an account is linked, a forgotten
          Caretaker PIN cannot be recovered — the only way back would be erasing the tablet.
        </T>
        <Button title="Link a Caretaker Account" icon={LockKeyhole} variant="soft" onPress={() => setSigningIn(true)} />
      </Card>
      <Sheet visible={signingIn} title="Link a Caretaker Account" onClose={() => setSigningIn(false)}>
        <T size={12}>This needs a network once. Use the email of your Caretaker Account.</T>
        <Suspense fallback={<T size={12}>Loading sign-in...</T>}>
          <CaretakerSignIn onSignedIn={async (id, signOut) => {
            await linkCaretakerAccount(id, signOut);
            setSigningIn(false); toast('Caretaker Account linked.', 'success');
          }} />
        </Suspense>
      </Sheet>
    </>
  );
}

function ProfileCard({ id, alias, onOpen, onDelete }: { id: string; alias: string; onOpen: () => void; onDelete: () => void }) {
  const { viewProfile, resetProfilePin, lockoutFor, clearLockout, demoId, resetDemo, toast, packs } = useApp();
  const theme = useTheme();
  const [flags, setFlags] = useState<string[] | 'error' | null>(null);
  const [resetting, setResetting] = useState(false);
  const [history, setHistory] = useState(0);
  const [locked, setLocked] = useState(0);
  // ponytail: one read per card; fine for the handful of Profiles on one tablet.
  useEffect(() => {
    void viewProfile(id)
      .then(({ attempts, uploads }) => setFlags(learningState(packs, attempts, uploads).skills.filter((s) => s.plateau).map((s) => lessonTitle(packs, s.skillId))))
      .catch(() => setFlags('error'));
  }, [id, viewProfile, history, packs]);
  // Re-read on every refresh so a wait that has expired stops being advertised.
  useEffect(() => {
    let live = true;
    lockoutFor(id).then((minutes) => { if (live) setLocked(minutes); }).catch(() => { if (live) setLocked(0); });
    return () => { live = false; };
  }, [id, lockoutFor, history]);
  return (
    <Card onPress={onOpen} style={{ gap: 8 }}>
      <T variant="titleS">{alias}</T>
      <Row style={{ flexWrap: 'wrap', gap: 6 }}>
        {flags === null ? <T size={12} color={theme.muted}>Loading...</T>
          : flags === 'error' ? <T size={12} color={tokens.state.critical}>Could not load Plateau Flags</T>
          : flags.length ? flags.map((f) => <Pill key={f} color={tokens.state.critical} tint={tokens.tint.warning}>{`Plateau Flag: ${f}`}</Pill>)
          : <T size={12} color={theme.muted}>No Plateau Flags</T>}
      </Row>
      {locked ? (
        <Row style={{ gap: 9 }}>
          <LockKeyhole size={16} color={tokens.state.critical} />
          <T size={12} color={theme.secondary} style={{ flex: 1 }}>
            {`Locked out for ${locked} more minute${locked === 1 ? '' : 's'} after too many wrong PINs.`}
          </T>
          <Action
            title="Let back in"
            variant="soft"
            task={async () => {
              await clearLockout(id);
              setHistory((n) => n + 1);
              toast(`${alias} can try their PIN again.`, 'success');
            }}
          />
        </Row>
      ) : null}
      <ProfileSync id={id} alias={alias} />
      <Row style={{ gap: 8 }}>
        <Button title="Reset PIN" variant="outline" onPress={() => setResetting(true)} style={{ flex: 1 }} />
        <Button title="Delete" variant="danger" onPress={onDelete} style={{ flex: 1 }} />
      </Row>
      {id === demoId ? <Action title="Reset demo" variant="outline" task={async () => { await resetDemo(); setHistory((n) => n + 1); toast('Demo Learner history restored.', 'success'); }} /> : null}
      <Sheet visible={resetting} title={`New PIN for ${alias}`} onClose={() => setResetting(false)}>
        <ResetPinForm onReset={async (pin) => { await resetProfilePin(id, pin); setResetting(false); toast(`PIN changed for ${alias}.`, 'success'); }} />
      </Sheet>
    </Card>
  );
}

function AddProfileForm({ onCreate }: { onCreate: (alias: string, pin: string) => Promise<void> }) {
  const theme = useTheme();
  const [alias, setAlias] = useState('');
  const [pin, setPin] = useState('');
  return (
    <>
      <T size={12} color={theme.muted}>Use an alias or first name. Never the Learner&apos;s legal name.</T>
      <Field label="Alias" value={alias} onChangeText={setAlias} placeholder="Juan" autoCapitalize="words" maxLength={30} />
      <Field label="6-digit PIN" value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, ''))} placeholder="••••••" keyboardType="number-pad" secureTextEntry maxLength={6} />
      <Action title="Create Profile" disabled={!alias.trim() || !isValidPin(pin)} task={() => onCreate(alias, pin)} />
    </>
  );
}

function ResetPinForm({ onReset }: { onReset: (pin: string) => Promise<void> }) {
  const [pin, setPin] = useState('');
  return (
    <>
      <T size={12}>The Learner keeps their answers and purchases.</T>
      <Field label="New 6-digit PIN" value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, ''))} placeholder="••••••" keyboardType="number-pad" secureTextEntry maxLength={6} />
      <Action title="Reset PIN" disabled={!isValidPin(pin)} task={() => onReset(pin)} />
    </>
  );
}
