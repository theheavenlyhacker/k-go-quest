import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { CloudOff, Link2, Link2Off, RefreshCw, Server, Upload } from 'lucide-react-native';

import { useOnline } from '@/state/online-context';
import type { UploadSummary } from '@/domain/online';
import { Action, Button, Card, Eyebrow, Field, Info, Pill, Row, Sheet, T } from '@/ui/primitives';
import { tokens, useTheme } from '@/ui/theme';

/**
 * The Caretaker's half of Online Mode.
 *
 * Every state here is written out rather than shown as a spinner: "offline" is
 * a normal state for this app, not a failure, and a Caretaker in a barangay
 * hall needs to know which of the four it is without guessing.
 */
export function ServerPanel() {
  const { apiUrl, state, server, signIn, signOut, busy, check } = useOnline();
  const theme = useTheme();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');

  if (!apiUrl)
    return (
      <Info
        icon={CloudOff}
        color={tokens.brand.sky}
        title="Online Mode is off on this tablet"
        text="No school server address is set, so nothing is uploaded and nothing is downloaded. Everything else works exactly as it does now."
      />
    );

  if (state === 'UNREACHABLE')
    return (
      <Card style={{ gap: 10 }}>
        <Row style={{ gap: 11 }}>
          <CloudOff size={19} color={theme.muted} />
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="titleS">No connection to the school server</T>
            <T variant="bodyS" color={theme.muted}>Practice is unaffected. Answers are kept and go up the next time this tablet finds Wi-Fi.</T>
          </View>
        </Row>
        <Action title="Check again" icon={RefreshCw} variant="soft" task={check} />
      </Card>
    );

  if (server && state === 'READY')
    return (
      <Card style={{ gap: 10 }}>
        <Row style={{ gap: 11 }}>
          <Server size={19} color={tokens.state.success} />
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="titleS">{server.user.alias}</T>
            <T variant="bodyS" color={theme.muted}>{`Signed in as ${server.user.loginId}`}</T>
          </View>
          <Pill color={tokens.state.success}>{server.user.role === 'LGU_ADMIN' ? 'LGU admin' : 'Teacher'}</Pill>
        </Row>
        <Action title="Sign out of the server" variant="outline" task={signOut} />
      </Card>
    );

  return (
    <Card style={{ gap: 10 }}>
      <T variant="titleS">{state === 'EXPIRED' ? 'Sign in again' : 'Connect this tablet'}</T>
      <T variant="bodyS" color={theme.muted}>
        {state === 'EXPIRED'
          ? 'This tablet was signed in before, but the session is too old to use. Signing in again restores uploads.'
          : 'Signing in lets this tablet upload answers and receive new Content Packs. Learners never sign in.'}
      </T>
      <Field label="Teacher or LGU login" value={loginId} onChangeText={setLoginId} autoCapitalize="none" autoCorrect={false} placeholder="teacher-demo" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
      <Action
        title="Sign in"
        icon={Server}
        disabled={busy || loginId.trim().length < 3 || password.length < 8}
        task={async () => { await signIn(loginId, password); setPassword(''); }}
      />
    </Card>
  );
}

/**
 * One Profile's link to a Learner account, and its upload backlog.
 *
 * A Profile that is not linked is not broken — it is the normal state, and the
 * counts still read correctly, because an Attempt that has never been uploaded
 * is pending rather than missing.
 */
export function ProfileSync({ id, alias }: { id: string; alias: string }) {
  const { links, state, linkProfile, unlinkProfile, sync, summary, busy } = useOnline();
  const theme = useTheme();
  const link = links[id];
  const [counts, setCounts] = useState<UploadSummary | null>(null);
  const [linking, setLinking] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => { void summary(id).then(setCounts).catch(() => setCounts(null)); }, [id, summary]);
  useEffect(refresh, [refresh, tick]);

  return (
    <View style={{ gap: 8 }}>
      <Row style={{ gap: 8 }}>
        <Eyebrow style={{ flex: 1 }}>Server</Eyebrow>
        {counts ? (
          <T variant="bodyS" color={theme.muted}>
            {`${counts.pending} waiting · ${counts.uploaded} uploaded${counts.review ? ` · ${counts.review} not sent` : ''}`}
          </T>
        ) : null}
      </Row>

      {link ? (
        <>
          <Row style={{ gap: 9 }}>
            <Link2 size={16} color={tokens.state.success} />
            <T variant="bodyS" style={{ flex: 1 }}>{`Linked to ${link.serverAlias || 'a Learner account'}`}</T>
          </Row>
          <Row style={{ gap: 8 }}>
            <Action
              title="Sync now"
              icon={Upload}
              variant="soft"
              style={{ flex: 1 }}
              disabled={state !== 'READY' || busy}
              task={async () => { await sync(id); setTick((n) => n + 1); }}
            />
            <Button title="Unlink" icon={Link2Off} variant="outline" style={{ flex: 1 }} onPress={() => void unlinkProfile(id).then(refresh)} />
          </Row>
          {state !== 'READY' ? (
            <T variant="bodyS" color={theme.muted}>Sync needs the Caretaker signed in to the server and a connection.</T>
          ) : null}
        </>
      ) : (
        <>
          <T variant="bodyS" color={theme.muted}>
            Not linked. {alias}&apos;s answers stay on this tablet until a Learner account is attached.
          </T>
          <Button title="Link to a Learner account" icon={Link2} variant="soft" onPress={() => setLinking(true)} />
        </>
      )}

      <Sheet visible={linking} title={`Link ${alias}`} onClose={() => setLinking(false)}>
        <T variant="bodyS" color={theme.muted}>
          Enter the Learner&apos;s own server login. The server files answers under the account that made them, so this is typed once by you and never by the Learner.
        </T>
        <Field label="Learner login" value={loginId} onChangeText={setLoginId} autoCapitalize="none" autoCorrect={false} placeholder="student-demo" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
        <Action
          title="Link this Profile"
          disabled={busy || loginId.trim().length < 3 || password.length < 8}
          task={async () => {
            await linkProfile(id, loginId, password);
            setPassword(''); setLoginId(''); setLinking(false); setTick((n) => n + 1);
          }}
        />
      </Sheet>
    </View>
  );
}
