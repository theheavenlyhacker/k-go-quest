import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Eye, EyeOff, Lock, Mail, TriangleAlert, WifiOff, type LucideIcon } from 'lucide-react-native';

import { useOnline } from '@/state/online-context';
import { canSubmit, FORGOT_PASSWORD, signInProblem, type SignInProblem } from '@/domain/sign-in';
import { Button, Field, Info, Sheet, T } from '@/ui/primitives';
import { radius, tokens, useTheme } from '@/ui/theme';

const logo = require('../../assets/images/kgo-logo.png') as number;

/** How each kind of problem looks. Colours are the existing state tokens. */
const LOOK: Record<SignInProblem['kind'], { icon: LucideIcon; color: string; title: string }> = {
  connection: { icon: WifiOff, color: tokens.state.warning, title: 'No connection' },
  credentials: { icon: TriangleAlert, color: tokens.state.critical, title: 'Could not sign in' },
  learner: { icon: TriangleAlert, color: tokens.state.critical, title: 'Learner account' },
  other: { icon: TriangleAlert, color: tokens.state.critical, title: 'Could not sign in' },
};

/** The Caretaker's Server Account sign-in, styled after the Figma Login frame (node 112:3). */
export function ServerSignIn({ expired }: { expired: boolean }) {
  const { signIn, busy } = useOnline();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [problem, setProblem] = useState<SignInProblem | null>(null);
  const [forgot, setForgot] = useState(false);

  // On success the panel is replaced by the signed-in card, so there is nothing to reset here.
  const submit = async () => {
    setProblem(null);
    try { await signIn(email, password); } catch (error) { setProblem(signInProblem(error)); }
  };
  const enter = (index: number) => FadeInDown.delay(index * 60).duration(260).reduceMotion(ReduceMotion.System);
  const look = problem ? LOOK[problem.kind] : null;

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
        {/* Default keyboard: a Server Account's name need not be an email address (teacher-demo). */}
        <Field
          label="Email" icon={Mail} value={email} onChangeText={setEmail}
          autoCapitalize="none" autoCorrect={false} textContentType="username" placeholder="Enter your email"
        />
        <Field
          label="Password" icon={Lock} value={password} onChangeText={setPassword}
          secureTextEntry={!visible} textContentType="password" placeholder="Enter your password" onSubmitEditing={() => void submit()}
          right={
            <Pressable
              accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'}
              accessibilityHint="Toggles whether the password is readable"
              onPress={() => setVisible((v) => !v)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {visible ? <EyeOff size={18} color={theme.muted} /> : <Eye size={18} color={theme.muted} />}
              </View>
            </Pressable>
          }
        />
        <Pressable
          accessibilityRole="button" accessibilityLabel="Forgot password?" accessibilityHint="Explains who can reset your password"
          onPress={() => setForgot(true)} style={{ alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' }}
        >
          <T variant="titleS" color={theme.navActive}>Forgot password?</T>
        </Pressable>
      </Animated.View>

      {problem && look ? (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Info icon={look.icon} color={look.color} title={look.title} text={problem.message} />
        </View>
      ) : null}

      <Animated.View entering={enter(3)}>
        <Button title="Log In" loading={busy} disabled={!canSubmit(email, password, busy)} onPress={() => void submit()} />
      </Animated.View>

      <Sheet visible={forgot} title="Forgot password?" onClose={() => setForgot(false)}>
        <T variant="bodyM" color={theme.secondary}>{FORGOT_PASSWORD}</T>
        <Button title="Got it" variant="soft" onPress={() => setForgot(false)} />
      </Sheet>
    </View>
  );
}
