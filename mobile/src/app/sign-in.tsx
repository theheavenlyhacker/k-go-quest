import { lazy, Suspense, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BookOpen, Eye, EyeOff, LayoutGrid, Lock, Mail, Users, type LucideIcon } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { useOnline } from '@/state/online-context';
import { canSubmit, connectionDetail, FORGOT_PASSWORD, signInProblem, type SignInProblem } from '@/domain/sign-in';
import type { Role } from '@/domain/server';
import { Button, Field, Info, Row, Sheet, T } from '@/ui/primitives';
import { elevation, radius, tokens, useTheme } from '@/ui/theme';

// Clerk is never imported at app start; it loads only if Google is tapped.
const GoogleSignIn = lazy(() => import('@/ui/google-sign-in'));

const logo = require('../../assets/images/kgo-logo.png') as number;

const ROLES: { value: Role; label: string; icon: LucideIcon }[] = [
  { value: 'STUDENT', label: 'Student', icon: BookOpen },
  { value: 'TEACHER', label: 'Teacher', icon: Users },
  { value: 'LGU_ADMIN', label: 'Admin', icon: LayoutGrid },
];

/**
 * 04 · Log in — the front door, and only that.
 *
 * Signing in opens the online half: uploads, the League, the Teacher and LGU
 * shells. The tablet works without any of it, so this screen can always be
 * walked past, and both ways out land in the same place. A school with no
 * signal must never meet a wall here; see `docs/adr/0002`.
 *
 * The Role chips are not an authorisation — the server decides what an account
 * is. They change what this screen asks for and what it promises, which is the
 * one thing a chip can honestly do before a password is typed.
 */
export default function SignIn() {
  const { finishSignIn } = useApp();
  const { signIn, busy, apiUrl } = useOnline();
  // Inlined at bundle time, so this is a fact about the build, not the network.
  const configured = Boolean(process.env.EXPO_PUBLIC_API_URL?.trim());
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<Role>('TEACHER');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [problem, setProblem] = useState<SignInProblem | null>(null);
  const [forgot, setForgot] = useState(false);

  const learner = role === 'STUDENT';
  const skip = () => { void finishSignIn(); };
  const submit = async () => {
    setProblem(null);
    try {
      await signIn(loginId, password);
      skip();
    } catch (error) { setProblem(signInProblem(error)); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.page }}>
      <StatusBar style="light" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 28, maxWidth: 640, width: '100%', alignSelf: 'center' }}
      >
        <View style={{ backgroundColor: theme.appbar, paddingTop: insets.top + 28, paddingBottom: 26, paddingHorizontal: 26, alignItems: 'center', gap: 11, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
          <View style={{ width: 62, height: 62, borderRadius: radius.md, backgroundColor: '#ffffff14', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <Image source={logo} resizeMode="contain" style={{ width: 56, height: 56 }} />
          </View>
          <T variant="displayL" color="#ffffff">K-Go Quests</T>
          <T variant="bodyS" color="rgba(255,255,255,0.72)">Learning that reaches every barangay</T>
        </View>

        <View style={{ gap: 14, paddingHorizontal: 26, paddingTop: 20 }}>
          <View style={{ gap: 4 }}>
            <T variant="displayXL" heading>Welcome back!</T>
            <T variant="bodyM" color={theme.muted}>Log in to continue your learning journey</T>
          </View>

          <View style={{ gap: 8 }}>
            <T variant="eyebrow" uppercase color={theme.muted}>Sign in as</T>
            <Row style={{ gap: 8, alignItems: 'stretch' }}>
              {ROLES.map(({ value, label, icon: Icon }) => {
                const on = role === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`Sign in as ${label}`}
                    onPress={() => { setRole(value); setProblem(null); }}
                    style={{
                      flex: 1, alignItems: 'center', gap: 6, paddingVertical: 10, minHeight: 64,
                      borderRadius: radius.sm, borderWidth: 1,
                      backgroundColor: on ? tokens.tint.forestBright : theme.surface,
                      borderColor: on ? theme.navActive : theme.borderStrong,
                      ...elevation.card,
                    }}
                  >
                    <Icon size={19} color={on ? theme.navActive : theme.text} />
                    <T variant="titleS" color={on ? theme.navActive : theme.text}>{label}</T>
                  </Pressable>
                );
              })}
            </Row>
          </View>

          {learner ? (
            <Info
              title="A Learner does not sign in here"
              text="This door is for the adult who manages the tablet. A Learner opens their own Profile with its PIN, and the Caretaker links that Profile to a Learner account from the Caretaker screen. Continue below and the tablet is ready either way."
              icon={BookOpen}
              color={tokens.brand.sky}
            />
          ) : (
            <>
              <Field
                label="Email or learner ID"
                icon={Mail}
                value={loginId}
                onChangeText={setLoginId}
                placeholder="juan.tamad@deped.ph"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="username"
              />
              <Field
                label="Password"
                icon={Lock}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••••"
                secureTextEntry={!visible}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                right={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={visible ? 'Hide password' : 'Show password'}
                    onPress={() => setVisible(!visible)}
                    hitSlop={10}
                  >
                    {visible ? <EyeOff size={17} color={theme.muted} /> : <Eye size={17} color={theme.muted} />}
                  </Pressable>
                }
              />
              <Pressable accessibilityRole="button" onPress={() => setForgot(true)} hitSlop={8} style={{ alignSelf: 'flex-end' }}>
                <T variant="titleS" color={theme.navActive}>Forgot password?</T>
              </Pressable>

              {problem ? (
                <Info
                  title="Could not sign in"
                  text={problem.kind === 'connection' ? `${problem.message} ${connectionDetail(apiUrl, configured)}` : problem.message}
                  icon={Lock}
                  color={tokens.state.critical}
                />
              ) : null}

              <Button
                title="Log in"
                disabled={!canSubmit(loginId, password, busy)}
                loading={busy}
                onPress={() => { void submit(); }}
                style={{ minHeight: 52 }}
              />

              <Row style={{ gap: 12 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
                <T variant="bodyS" color={theme.muted}>or</T>
                <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
              </Row>

              <Suspense fallback={<T variant="bodyS" color={theme.muted}>Loading sign-in</T>}>
                <GoogleSignIn onDone={skip} />
              </Suspense>
            </>
          )}

          <Row style={{ gap: 5, justifyContent: 'center' }}>
            <T variant="bodyS" color={theme.muted}>Don&apos;t have an account?</T>
            <Pressable accessibilityRole="button" onPress={() => setForgot(true)} hitSlop={8}>
              <T variant="titleS" color={theme.navActive}>Register</T>
            </Pressable>
          </Row>

          {/* Not in the design, and the product does not work without it. */}
          <Pressable accessibilityRole="button" onPress={skip} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 8 }}>
            <T variant="bodyS" color={theme.muted} style={{ textDecorationLine: 'underline' }}>Use this tablet offline</T>
          </Pressable>
        </View>
      </ScrollView>

      <Sheet visible={forgot} title="Server Accounts" onClose={() => setForgot(false)}>
        <T variant="bodyM" color={theme.secondary}>{FORGOT_PASSWORD}</T>
      </Sheet>
    </View>
  );
}
