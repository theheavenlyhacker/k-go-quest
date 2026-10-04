import { lazy, Suspense, useState } from 'react';

import { useApp } from '@/state/app-context';
import { keepCaretaker } from '@/domain/setup';
import { isValidPin } from '@/domain/pin-lock';
import { Action, Card, Eyebrow, Field, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';

// Loaded on demand so the app never touches Clerk while starting.
const CaretakerSignIn = lazy(() => import('@/ui/caretaker-sign-in'));

/** First launch on a Shared Tablet: Caretaker Account, Caretaker PIN, first Profiles. */
export default function Setup() {
  const { step } = useApp();
  return (
    <Screen title="Set up this tablet" caption="You are the Caretaker. Learners never need a network.">
      {step === 'sign-in' ? <SignInStep /> : step === 'caretaker-pin' ? <PinStep /> : <ProfilesStep />}
    </Screen>
  );
}

function SignInStep() {
  const { saveCaretakerId, caretakerSignedOut } = useApp();
  // Only after the Clerk sign-out has finished does Setup leave this step and unmount Clerk.
  const onSignedIn = async (id: string, signOut: () => Promise<void>) => { await keepCaretaker(id, saveCaretakerId, signOut); caretakerSignedOut(); };
  return (
    <>
      <T size={12}>Setup needs a network only for this sign-in. Use the email of your Caretaker Account.</T>
      <Suspense fallback={<T size={12}>Loading sign-in...</T>}><CaretakerSignIn onSignedIn={onSignedIn} /></Suspense>
    </>
  );
}

function PinStep() {
  const { setCaretakerPin } = useApp();
  const [pin, setPin] = useState('');
  return (
    <>
      <T size={12}>Signed in. Choose a 6-digit Caretaker PIN. You will use it offline to manage profiles.</T>
      <Field label="Caretaker PIN" value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry maxLength={6} />
      <Action title="Save PIN" disabled={!isValidPin(pin)} task={() => setCaretakerPin(pin)} />
    </>
  );
}

function ProfilesStep() {
  const { profiles, createProfile, finishSetup } = useApp();
  const [alias, setAlias] = useState('');
  const [pin, setPin] = useState('');
  return (
    <>
      <T size={13} bold>Do not use a legal name. Use a nickname or alias.</T>
      <T size={12}>Add a profile for each learner.</T>
      {profiles.length ? <Eyebrow>Created: {profiles.map((p) => p.alias).join(', ')}</Eyebrow> : null}
      <Card>
        <Field label="Alias" value={alias} onChangeText={setAlias} placeholder="Juan" autoCapitalize="words" maxLength={30} />
        <Field label="6-digit PIN" value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry maxLength={6} />
        <Action title="Add profile" variant="soft" disabled={!alias.trim() || !isValidPin(pin)} task={async () => { await createProfile(alias, pin, false); setAlias(''); setPin(''); }} />
      </Card>
      <Action title="Finish setup" disabled={!profiles.length} task={finishSetup} />
    </>
  );
}
