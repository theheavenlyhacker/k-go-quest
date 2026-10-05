import { lazy, Suspense, useState } from 'react';

import { useApp } from '@/state/app-context';
import { isValidPin } from '@/domain/pin-lock';
import { Action, BackLink, Field, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';

// Clerk loads only here, and only while the Caretaker is signing in.
const CaretakerSignIn = lazy(() => import('@/ui/caretaker-sign-in'));

/** Sign in again to the Setup Caretaker Account, then choose a new Caretaker PIN. */
export function ForgotPin({ onDone }: { onDone: () => void }) {
  const { confirmCaretakerAccount, resetCaretakerPin, accountLinked, toast } = useApp();
  const [verified, setVerified] = useState(false);
  const [pin, setPin] = useState('');
  return (
    <Screen title="Caretaker" caption="Forgot Caretaker PIN">
      <BackLink label="Back" onPress={onDone} />
      {!accountLinked ? (
        <>
          <T size={13} bold>No Caretaker Account is linked to this tablet.</T>
          <T size={12}>
            This tablet was set up without a network, so there is nothing to sign in to and
            the PIN cannot be recovered here. If you still know the PIN, open the Caretaker
            screen and link an account — it takes a network once, and it is what makes this
            screen work later.
          </T>
        </>
      ) : verified ? (
        <>
          <T size={12}>Signed in. Choose a new 6-digit Caretaker PIN. Profiles are not changed.</T>
          <Field label="New Caretaker PIN" value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry maxLength={6} />
          <Action title="Save new PIN" disabled={!isValidPin(pin)} task={async () => { await resetCaretakerPin(pin); toast('Caretaker PIN changed.', 'success'); onDone(); }} />
        </>
      ) : (
        <>
          <T size={12}>This needs a network. Sign in with the Caretaker Account you used at Setup.</T>
          <Suspense fallback={<T size={12}>Loading sign-in...</T>}>
            <CaretakerSignIn onSignedIn={async (id, signOut) => { await confirmCaretakerAccount(id, signOut); setVerified(true); }} />
          </Suspense>
        </>
      )}
    </Screen>
  );
}
