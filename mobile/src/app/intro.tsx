import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { Award, BookOpen, Lightbulb, type LucideIcon } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { introSlides, nextSlide, primaryLabel } from '@/domain/intro';
import { Button, T } from '@/ui/primitives';
import { elevation, tokens, useTheme } from '@/ui/theme';

const art: Record<(typeof introSlides)[number]['key'], { icon: LucideIcon; color: string; tint: string }> = {
  learn: { icon: BookOpen, color: tokens.brand.limeDeep, tint: tokens.tint.success },
  hints: { icon: Lightbulb, color: tokens.brand.sunDeep, tint: tokens.tint.sun },
  coins: { icon: Award, color: tokens.brand.sky, tint: tokens.tint.sky },
};

/** Three slides, once per Shared Tablet. Finishing or skipping saves the flag; the router guards do the rest. */
export default function Intro() {
  const { finishIntro, toast } = useApp();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const slide = introSlides[index];
  const { icon: Icon, color, tint } = art[slide.key];
  const finish = () => { void finishIntro().catch(() => toast('Could not save that you have seen the intro.', 'error')); };
  const next = () => { const step = nextSlide(index); if (step.done) finish(); else setIndex(step.index); };
  return (
    <View style={{ flex: 1, backgroundColor: theme.page, paddingTop: 44 }}>
      <View style={{ height: 48, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Skip intro" onPress={finish} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
          <T variant="titleS" color={theme.secondary}>Skip</T>
        </Pressable>
      </View>
      <Animated.View key={slide.key} entering={reduced ? undefined : FadeIn.duration(260)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 28 }}>
        <View accessible={false} style={[{ width: 148, height: 148, borderRadius: 74, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.dark ? theme.surface : tint }, elevation.raised]}>
          <Icon size={64} color={color} strokeWidth={1.5} />
        </View>
        <View style={{ gap: 12, alignItems: 'center' }} accessibilityRole="header">
          <T variant="displayXL" style={{ textAlign: 'center' }}>{slide.title}</T>
          <T variant="bodyM" color={theme.secondary} style={{ textAlign: 'center' }}>{slide.body}</T>
        </View>
      </Animated.View>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={`Slide ${index + 1} of ${introSlides.length}`} style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', paddingBottom: 8 }}>
        {introSlides.map((s, i) => (
          <View key={s.key} style={{ height: 8, width: i === index ? 26 : 8, borderRadius: 4, backgroundColor: i === index ? theme.navActive : theme.borderStrong }} />
        ))}
      </View>
      <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 36 }}>
        <Button title={primaryLabel(index)} onPress={next} style={{ minHeight: 52 }} />
      </View>
    </View>
  );
}
