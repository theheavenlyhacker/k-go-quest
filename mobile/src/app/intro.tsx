import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { Award, BookOpen, Sparkle, type LucideIcon } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { introSlides, nextSlide, primaryLabel } from '@/domain/intro';
import { Button, T } from '@/ui/primitives';
import { elevation, radius, tokens, type, useTheme } from '@/ui/theme';

const art: Record<(typeof introSlides)[number]['key'], { icon: LucideIcon; color: string; tint: string }> = {
  learn: { icon: BookOpen, color: tokens.brand.teal, tint: '#e6f4ee' },
  hints: { icon: Sparkle, color: tokens.brand.sun, tint: tokens.tint.sun },
  coins: { icon: Award, color: tokens.brand.sky, tint: tokens.tint.sky },
};

/** Three slides, once per Shared Tablet. Finishing or skipping saves the flag; the router guards do the rest. */
export default function Intro() {
  const { finishIntro } = useApp();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const slide = introSlides[index];
  const { icon: Icon, color, tint } = art[slide.key];
  const finish = () => { void finishIntro(); };
  const next = () => { const step = nextSlide(index); if (step.done) finish(); else setIndex(step.index); };
  return (
    <View style={{ flex: 1, backgroundColor: theme.page, paddingTop: insets.top, overflow: 'hidden' }}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', top: -90, left: -80, width: 180, height: 180, borderRadius: 90, backgroundColor: theme.dark ? '#3ecdb014' : '#0e5e5614' }} />
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', bottom: -30, right: -100, width: 220, height: 220, borderRadius: 110, backgroundColor: theme.dark ? '#3ecdb014' : '#0e5e5614' }} />
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <View style={{ minHeight: 48, alignItems: 'flex-end', justifyContent: 'center', paddingRight: insets.right + 12, paddingLeft: insets.left }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Skip intro" onPress={finish} style={{ minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
          <T variant="titleS" color={theme.secondary}>Skip</T>
        </Pressable>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 40 + Math.max(insets.left, insets.right), paddingVertical: 24 }}>
        <Animated.View key={slide.key} entering={reduced ? undefined : FadeIn.duration(260)} style={{ width: '100%', maxWidth: 360, alignSelf: 'center', alignItems: 'center', gap: 28 }}>
          <View accessible={false} style={[{ width: 148, height: 148, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.dark ? '#1a3328' : tint }, elevation.raised]}>
            <Icon size={64} color={slide.key === 'learn' && theme.dark ? theme.navActive : color} strokeWidth={1.5} />
          </View>
          <View style={{ width: '100%', gap: 12, alignItems: 'center' }}>
            <Text accessibilityRole="header" style={[type.displayXL, { color: theme.text, textAlign: 'center', maxWidth: 295 }]}>{slide.title}</Text>
            <T variant="bodyM" color={theme.secondary} style={{ textAlign: 'center', maxWidth: 295 }}>{slide.body}</T>
          </View>
        </Animated.View>
      </ScrollView>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={`Slide ${index + 1} of ${introSlides.length}`} accessibilityValue={{ min: 1, max: introSlides.length, now: index + 1 }} style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', paddingBottom: 8 }}>
        {introSlides.map((s, i) => (
          <View key={s.key} style={{ height: 8, width: i === index ? 26 : 8, borderRadius: radius.pill, backgroundColor: i === index ? theme.navActive : theme.borderStrong }} />
        ))}
      </View>
      <View style={{ width: '100%', maxWidth: 408, alignSelf: 'center', paddingHorizontal: 24 + Math.max(insets.left, insets.right), paddingTop: 28, paddingBottom: insets.bottom + 36 }}>
        <Button title={primaryLabel(index)} onPress={next} style={{ minHeight: 52 }} />
      </View>
    </View>
  );
}
