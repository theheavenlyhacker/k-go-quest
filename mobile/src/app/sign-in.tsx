import React, { useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Building2, Eye, EyeOff, GraduationCap, Lock, Mail, Presentation } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import type { Role } from '@/domain/types';
import { Action, Card, Eyebrow, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { radius, tokens, useTheme } from '@/ui/theme';

const roles: { role: Role; label: string; icon: typeof GraduationCap }[] = [
  { role: 'STUDENT', label: 'Student', icon: GraduationCap },
  { role: 'TEACHER', label: 'Teacher', icon: Presentation },
  { role: 'LGU_ADMIN', label: 'Admin', icon: Building2 },
];

export default function SignIn() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, toast, profiles, selectProfile } = useApp();
  const theme = useTheme();
  const [role, setRole] = useState<Role>('STUDENT');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);

  return (
    <Screen refreshable={false} statusBarStyle="light" contentStyle={{ paddingHorizontal: 0, paddingTop: 0, gap: 0 }}>
      <LinearGradient
        colors={['#0c4a3e', '#17604f']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 26, paddingBottom: 34, paddingHorizontal: 24, alignItems: 'center', gap: 10, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg }}
      >
        <Image source={require('@/assets/images/kgo-logo.png')} style={{ width: 64, height: 64, borderRadius: radius.md }} contentFit="contain" />
        <T variant="displayL" color="#ffffff">K-Go Quests</T>
        <T variant="bodyS" color="#ffffff" style={{ opacity: 0.72, textAlign: 'center' }}>Learning that reaches every barangay</T>
      </LinearGradient>

      <View style={{ paddingHorizontal: 20, paddingTop: 22, gap: 14 }}>
        <View style={{ gap: 5 }}>
          <T variant="displayL" style={{ fontSize: 28, lineHeight: 33 }}>Welcome back!</T>
          <T variant="bodyM" color={theme.muted}>Log in to continue your learning journey</T>
        </View>

        <IconField
          label="Email or learner ID" icon={Mail} value={loginId} onChangeText={setLoginId}
          placeholder="juan.tamad" autoCapitalize="none" autoComplete="username"
        />
        <IconField
          label="Password" icon={Lock} value={password} onChangeText={setPassword}
          placeholder="At least 12 characters" secureTextEntry={!reveal} autoCapitalize="none" autoComplete="current-password"
          trailing={
            <Pressable accessibilityRole="button" accessibilityLabel={reveal ? 'Hide password' : 'Show password'} onPress={() => setReveal((on) => !on)} hitSlop={8}>
              {reveal ? <EyeOff size={17} color={theme.muted} /> : <Eye size={17} color={theme.muted} />}
            </Pressable>
          }
        />
        <Pressable
          accessibilityRole="button"
          style={{ alignSelf: 'flex-end' }}
          onPress={() => toast('Password resets are done by your LGU administrator in person — there is no self-service reset.', 'info')}
        >
          <T variant="titleS" color={theme.navActive}>Forgot password?</T>
        </Pressable>

        <Eyebrow>Sign in as</Eyebrow>
        <Row style={{ gap: 10, alignItems: 'stretch' }}>
          {roles.map((option) => {
            const active = role === option.role;
            return (
              <Pressable
                key={option.role} accessibilityRole="button" accessibilityState={{ selected: active }}
                onPress={() => setRole(option.role)}
                style={({ pressed }) => ({
                  flex: 1, alignItems: 'center', gap: 7, paddingVertical: 15, borderRadius: radius.sm,
                  borderWidth: active ? 1.6 : 1, borderColor: active ? theme.navActive : theme.borderStrong,
                  backgroundColor: active ? tokens.tint.forestBright : theme.surface,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <option.icon size={19} color={active ? theme.navActive : theme.text} strokeWidth={1.8} />
                <T variant="titleS" color={active ? theme.navActive : theme.text}>{option.label}</T>
              </Pressable>
            );
          })}
        </Row>

        <Action
          title="Log in"
          disabled={loginId.trim().length < 3 || password.length < 12}
          task={async () => { await login(loginId.trim().toLowerCase(), password, role); }}
        />

        {profiles.length ? (
          <>
            <Row style={{ gap: 10 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
              <T variant="bodyS" color={theme.muted}>or</T>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
            </Row>
            <Eyebrow>Saved on this device</Eyebrow>
            {profiles.map((profile) => (
              <Card key={profile.id} onPress={() => { void selectProfile(profile.id).catch((error: unknown) => toast(error instanceof Error ? error.message : 'Sign in online to reconnect.', 'error')); }}>
                <Row>
                  <View style={{ flex: 1 }}>
                    <T variant="titleS">{profile.alias}</T>
                    <T variant="bodyS" color={theme.muted}>Unlock with your PIN</T>
                  </View>
                </Row>
              </Card>
            ))}
          </>
        ) : null}

        <Row style={{ justifyContent: 'center', gap: 5, paddingTop: 6, paddingBottom: 20 }}>
          <T variant="bodyS" color={theme.muted}>Do not have an account?</T>
          <Pressable accessibilityRole="button" onPress={() => router.push('/register')}>
            <T variant="titleS" color={theme.navActive}>Register</T>
          </Pressable>
        </Row>
      </View>
    </Screen>
  );
}

function IconField({ label, icon: Icon, trailing, ...props }: TextInputProps & { label: string; icon: typeof Mail; trailing?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <Eyebrow>{label}</Eyebrow>
      <Row style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: radius.sm, paddingHorizontal: 13, minHeight: 49, gap: 10 }}>
        <Icon size={17} color={theme.muted} />
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={theme.muted}
          {...props}
          style={{ flex: 1, color: theme.text, fontFamily: 'PublicSans_400Regular', fontSize: 13, paddingVertical: 13 }}
        />
        {trailing}
      </Row>
    </View>
  );
}
