import { useState } from 'react';
import { ClerkProvider, useClerk, useSignIn } from '@clerk/expo';

import { signInMessage } from '../domain/setup';
import { Action, Field, T } from '@/ui/primitives';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * Email-code sign-in for the Caretaker Account. Loaded only by Setup and the
 * forgot-PIN flow, so Clerk is never imported or mounted at app start.
 * `onSignedIn` gets the Clerk user ID and a sign-out it must call before finishing.
 */
export type OnSignedIn = (userId: string, signOut: () => Promise<void>) => Promise<void>;
export default function CaretakerSignIn({ onSignedIn }: { onSignedIn: OnSignedIn }) {
  if (!publishableKey) return <T size={12}>Setup needs EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. See mobile/.env.example.</T>;
  // No token cache: the session is never persisted, and we sign out right away.
  return <ClerkProvider publishableKey={publishableKey}><EmailCode onSignedIn={onSignedIn} /></ClerkProvider>;
}

const friendly = (e: unknown) => new Error(signInMessage(e instanceof Error ? e.message : String(e)));
const check = ({ error }: { error: { message: string } | null }) => { if (error) throw new Error(error.message); };

function EmailCode({ onSignedIn }: { onSignedIn: OnSignedIn }) {
  const { signIn } = useSignIn();
  const clerk = useClerk();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);

  const send = async () => {
    try {
      check(await signIn.create({ identifier: email.trim() }));
      check(await signIn.emailCode.sendCode());
    } catch (e) { throw friendly(e); }
    setSent(true);
  };
  const verify = async () => {
    try {
      check(await signIn.emailCode.verifyCode({ code: code.trim() }));
      check(await signIn.finalize());
    } catch (e) { throw friendly(e); }
    try {
      const id = clerk.user?.id;
      if (!id) { await clerk.signOut(); throw new Error('Sign-in did not finish. Try again.'); }
      await onSignedIn(id, () => clerk.signOut());
    } catch (e) {
      // The session is already ended; start over so the Caretaker can retry without going Back.
      setSent(false); setCode('');
      throw friendly(e);
    }
  };

  return sent ? (
    <>
      <Field label="Code from your email" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={8} />
      <Action title="Verify code" disabled={code.length < 6} task={verify} />
    </>
  ) : (
    <>
      <Field label="Caretaker email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      <Action title="Email me a code" disabled={!email.includes('@')} task={send} />
    </>
  );
}
