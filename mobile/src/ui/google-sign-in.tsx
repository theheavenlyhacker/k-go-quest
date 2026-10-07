import { useState } from 'react';
import { ActivityIndicator, Image, Pressable } from 'react-native';
import { ClerkProvider, useClerk } from '@clerk/expo';
import { useSSO } from '@clerk/expo/experimental';

import { useApp } from '@/state/app-context';
import { keepCaretaker } from '@/domain/setup';
import { Info, T } from '@/ui/primitives';
import { elevation, radius, tokens, useTheme } from '@/ui/theme';

const MARK = require('../../assets/images/google.png') as number;
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * "Continue with Google" — the Caretaker Account, reached through Google
 * instead of an email code.
 *
 * It answers *who owns this tablet*, not which school it reports to: a Role
 * comes from a Server Account, which is the form above this button. Signing in
 * here is what makes a forgotten Caretaker PIN recoverable later, so a tablet
 * that takes this path can skip Setup's own sign-in step.
 *
 * Clerk is imported only by this file and by the Setup sign-in, both lazily, so
 * the app never touches it while starting.
 */
export default function GoogleSignIn({ onDone }: { onDone: () => void }) {
  // The key is compiled into the build, so its absence is a build mistake, not
  // a runtime one. Better a missing button than one that cannot work.
  if (!publishableKey) return null;
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <GoogleButton onDone={onDone} />
    </ClerkProvider>
  );
}

function GoogleButton({ onDone }: { onDone: () => void }) {
  const { saveCaretakerId, caretakerSignedOut } = useApp();
  const { startSSOFlow } = useSSO();
  const clerk = useClerk();
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const press = async () => {
    setProblem(null);
    setBusy(true);
    try {
      const { createdSessionId } = await startSSOFlow({ strategy: 'oauth_google' });
      // A cancelled browser sheet is not a failure; it leaves nothing behind.
      if (!createdSessionId) return;
      const id = clerk.user?.id;
      if (!id) {
        await clerk.signOut();
        throw new Error('Google sign-in did not finish. Try again.');
      }
      // The session ends at once: this tablet keeps the account's ID, never its session.
      await keepCaretaker(id, saveCaretakerId, () => clerk.signOut());
      caretakerSignedOut();
      onDone();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Google sign-in did not work. Try again.');
    } finally { setBusy(false); }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => { void press(); }}
        style={({ pressed }) => [{
          minHeight: 52, borderRadius: radius.sm, borderWidth: 1,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
          backgroundColor: theme.surface, borderColor: theme.borderStrong,
          opacity: busy ? 0.45 : pressed ? 0.78 : 1,
        }, elevation.card]}
      >
        {busy ? <ActivityIndicator size="small" color={theme.text} /> : <Image source={MARK} resizeMode="contain" style={{ width: 19, height: 19 }} />}
        <T variant="titleS">Continue with Google</T>
      </Pressable>
      {problem ? <Info title="Could not continue" text={problem} color={tokens.state.critical} /> : null}
    </>
  );
}
