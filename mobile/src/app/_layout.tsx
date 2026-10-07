import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { PublicSans_400Regular, PublicSans_700Bold } from '@expo-google-fonts/public-sans';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { ReduceMotion, ReducedMotionConfig } from 'react-native-reanimated';
import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react-native';

import { AppProvider, useApp } from '@/state/app-context';
import { OnlineProvider } from '@/state/online-context';
import { T } from '@/ui/primitives';
import { palette, useTheme } from '@/ui/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Outfit_600SemiBold, Outfit_700Bold, PublicSans_400Regular, PublicSans_700Bold, IBMPlexMono_500Medium });
  // Rendering before the fonts resolve would flash system type through every primitive.
  if (!fontsLoaded && !fontError) return null;
  return (
    <AppProvider>
      {/* Entrance motion and bar fills drop to nothing when the system asks for reduced motion. */}
      <ReducedMotionConfig mode={ReduceMotion.System} />
      {/* Online Mode wraps the app but never gates it: with no server, every
          screen below behaves exactly as it does offline. */}
      <OnlineProvider>
        <Shell />
      </OnlineProvider>
    </AppProvider>
  );
}

function Shell() {
  const { ready, profile, locked, caretaker, step } = useApp();
  const setUp = step === 'done';
  const theme = useTheme();
  useEffect(() => { void SystemUI.setBackgroundColorAsync(theme.page).catch(() => undefined); }, [theme.page]);
  useEffect(() => { if (ready) void SplashScreen.hideAsync(); }, [ready]);
  if (!ready) return null;


  return (
    <>
      {/* Edge-to-edge: the forest app bar paints under the status bar, and the
          Android navigation bar stays hidden until swiped, so a shared tablet
          reads as a single full-screen app rather than a browser in a chrome. */}
      <StatusBar style="light" />
      <NavigationBar hidden style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.page } }}>
        <Stack.Protected guard={!setUp}>
          <Stack.Screen name="setup" />
        </Stack.Protected>
        <Stack.Protected guard={setUp && !profile && !caretaker}>
          <Stack.Screen name="index" />
          <Stack.Screen name="caretaker-pin" />
        </Stack.Protected>
        <Stack.Protected guard={setUp && !profile && caretaker}>
          <Stack.Screen name="caretaker" />
          <Stack.Screen name="caretaker-profile" />
        </Stack.Protected>
        <Stack.Protected guard={setUp && Boolean(profile) && locked}>
          <Stack.Screen name="lock" />
        </Stack.Protected>
        <Stack.Protected guard={setUp && Boolean(profile) && !locked}>
          <Stack.Screen name="(student)" />
          <Stack.Screen name="subject" />
          <Stack.Screen name="lesson" />
        </Stack.Protected>
      </Stack>
      <Toast />
    </>
  );
}

function Toast() {
  const { notice, dismiss } = useApp();
  const theme = useTheme();
  const close = useRef(dismiss);
  useEffect(() => { close.current = dismiss; }, [dismiss]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => close.current(), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  const color = notice.kind === 'error' ? palette.red : notice.kind === 'success' ? palette.green : palette.blue;
  const Icon = notice.kind === 'error' ? TriangleAlert : notice.kind === 'success' ? CircleCheck : Info;
  return (
    <View pointerEvents="box-none" style={styles.host}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Dismiss message: ${notice.message}`}
        onPress={dismiss}
        style={[styles.toast, { backgroundColor: theme.card, borderColor: color }]}
      >
        <Icon size={18} color={color} />
        <T size={12} style={{ flex: 1 }}>{notice.message}</T>
        <X size={15} color={theme.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, bottom: 34, alignItems: 'center', paddingHorizontal: 16 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 11, maxWidth: 520, width: '100%', borderWidth: 1, borderRadius: 14, paddingHorizontal: 15, paddingVertical: 13 },
});
