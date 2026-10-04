import { useState } from 'react';
import { useRouter } from 'expo-router';

import { useApp } from '@/state/app-context';
import { isValidPin } from '@/domain/pin-lock';
import { ForgotPin } from '@/ui/forgot-caretaker-pin';
import { Action, BackLink, Field, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { useTheme } from '@/ui/theme';

export default function CaretakerPin() {
  const { openCaretaker } = useApp();
  const router = useRouter();
  const theme = useTheme();
  const [pin, setPin] = useState('');
  const [forgot, setForgot] = useState(false);
  if (forgot) return <ForgotPin onDone={() => setForgot(false)} />;
  return (
    <Screen title="Caretaker" caption="Enter the Caretaker PIN">
      <BackLink label="Back" onPress={() => router.back()} />
      <Field label="Caretaker PIN" value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry maxLength={6} placeholder="••••••" />
      <Action title="Open Caretaker screen" disabled={!isValidPin(pin)} task={async () => { try { await openCaretaker(pin); } finally { setPin(''); } }} />
      <Action title="Forgot Caretaker PIN" variant="soft" task={async () => setForgot(true)} />
      <T size={12} color={theme.muted}>After 5 wrong PINs you must wait 5 minutes.</T>
    </Screen>
  );
}
