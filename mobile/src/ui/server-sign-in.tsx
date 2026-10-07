import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Eye, EyeOff, Lock, Mail, TriangleAlert, WifiOff, type LucideIcon } from 'lucide-react-native';

import { useOnline } from '@/state/online-context';
import { canSubmit, FORGOT_PASSWORD, signInProblem, type SignInProblem } from '@/domain/sign-in';
import { Button, Eyebrow, Info, Row, Sheet, T } from '@/ui/primitives';
import { elevation, radius, tokens, useTheme } from '@/ui/theme';

const logo = require('../../assets/images/kgo-logo.png') as number;

/** One icon-led input, the Figma Login "Frame" field. 52 tall clears the 44pt touch minimum. */
function IconField({ label, icon: Icon, right, ...props }: React.ComponentProps<typeof TextInput> & { label: string; icon: LucideIcon; right?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Eyebrow>{label}</Eyebrow>
      <Row style={{ gap: 10, minHeight: 52, paddingHorizontal: 16, borderRadius: radius.md, borderWidth: 1, backgroundColor: theme.surface, borderColor: theme.border, ...elevation.card }}>
        <Icon size={18} color={theme.muted} />
        <TextInput
          accessibilityLabel={label} placeholderTextColor={theme.muted} {...props}
          style={{ flex: 1, minHeight: 44, color: theme.text, fontFamily: 'PublicSans_400Regular', fontSize: 13 }}
        />
        {right}
      </Row>
    </View>
  );
}

/** The Caretaker's Server Account sign-in, styled after the Figma Login frame (node 112:3). */
export function ServerSignIn({ expired }: { expired: boolean }) {
  const { signIn, busy } = useOnline();
  const theme = useTheme();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [problem, setProblem] = useState<SignInProblem | null>(null);
  const [forgot, setForgot] = useState(false);

  const submit = async () => {
    setProblem(null);
    try { await signIn(loginId, password); setPassword(''); } catch (error) { setProblem(signInProblem(error)); }
  };
  const enter = (index: number) => FadeInDown.delay(index * 60).duration(260).reduceMotion(ReduceMotion.System);

  return (
    <View style={{ gap: 18 }}>
      <Animated.View
        entering={enter(0)}
        style={{ backgroundColor: theme.appbar, borderRadius: radius.lg, paddingVertical: 24, paddingHorizontal: 20, alignItems: 'center', gap: 6 }}
      >
        <Image source={logo} accessibilityLabel="K-Go Quests logo" style={{ width: 96, height: 96 }} contentFit="contain" />
        <T variant="displayL" color={theme.onBrand}>K-Go Quests</T>
        <T variant="bodyS" color={theme.onBrand} style={{ opacity: 0.85, textAlign: 'center' }}>Learning that reaches every barangay</T>
      </Animated.View>

      <Animated.View entering={enter(1)} style={{ gap: 4 }}>
        <T variant="displayL" heading>Welcome Back!</T>
        <T variant="bodyM" color={theme.secondary}>
          {expired ? 'This tablet was signed in before, but the session is too old to use. Sign in again to restore uploads.' : 'Sign in with the Teacher or LGU account that manages this tablet.'}
        </T>
      </Animated.View>

      <Animated.View entering={enter(2)} style={{ gap: 16 }}>
        <IconField
          label="Email or login" icon={Mail} value={loginId} onChangeText={setLoginId}
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" placeholder="Enter your email or login"
        />
        <IconField
          label="Password" icon={Lock} value={password} onChangeText={setPassword}
          secureTextEntry={!visible} textContentType="password" placeholder="Enter your password" onSubmitEditing={submit}
          right={
            <Pressable
              accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'}
              hitSlop={8} onPress={() => setVisible((v) => !v)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              {visible ? <EyeOff size={18} color={theme.muted} /> : <Eye size={18} color={theme.muted} />}
            </Pressable>
          }
        />
        <Pressable
          accessibilityRole="button" accessibilityLabel="Forgot password?" onPress={() => setForgot(true)}
          style={{ alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' }}
        >
          <T variant="titleS" color={theme.navActive}>Forgot password?</T>
        </Pressable>
      </Animated.View>

      {problem ? (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Info
            icon={problem.kind === 'connection' ? WifiOff : TriangleAlert}
            color={problem.kind === 'connection' ? tokens.brand.sky : tokens.state.critical}
            title={problem.kind === 'connection' ? 'No connection' : problem.kind === 'learner' ? 'Learner account' : 'Could not sign in'}
            text={problem.message}
          />
        </View>
      ) : null}

      <Animated.View entering={enter(3)}>
        <Button title="Log In" loading={busy} disabled={!canSubmit(loginId, password, busy)} onPress={() => void submit()} style={{ minHeight: 52 }} />
      </Animated.View>

      <Sheet visible={forgot} title="Forgot password?" onClose={() => setForgot(false)}>
        <T variant="bodyM" color={theme.secondary}>{FORGOT_PASSWORD}</T>
        <Button title="Got it" variant="soft" onPress={() => setForgot(false)} />
      </Sheet>
    </View>
  );
}
