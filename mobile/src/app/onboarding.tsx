import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInRight, FadeOut } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { BookOpen, ChevronRight, Download, Gift, Leaf, Mic, Trophy, WifiOff } from 'lucide-react-native';

import { vault } from '@/data/vault';
import { Button, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { radius, tokens, useTheme } from '@/ui/theme';

const steps = [
  {
    hero: WifiOff,
    corners: [Download, BookOpen, Leaf],
    title: 'No signal? No problem.',
    body: 'Over 1,000 Khan Academy modules in Math, Science, English and Filipino live on the tablet itself. Lessons open with the radio off and cost zero data.',
    cta: 'Next',
  },
  {
    hero: Mic,
    corners: [BookOpen, Leaf, Download],
    title: 'A tutor that speaks your language.',
    body: 'The on-device voice tutor explains hard steps in Tagalog, Cebuano or Ilocano, and the OCR evaluator checks your handwritten solution line by line.',
    cta: 'Next',
  },
  {
    hero: Trophy,
    corners: [Gift, Trophy, Leaf],
    title: 'Your growth carries the guild.',
    body: 'Classrooms compete in monthly barangay leagues ranked on improvement, not raw scores. Khan-Coins turn into rice, school supplies and solar lamps at the hub.',
    cta: 'Get started',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const theme = useTheme();
  const [step, setStep] = useState(0);
  const current = steps[step];
  const Hero = current.hero;

  const finish = () => {
    void vault.set('kgo-onboarded', '1').catch(() => undefined);
    router.replace('/sign-in');
  };

  return (
    <Screen refreshable={false} contentStyle={{ flexGrow: 1, gap: 0 }}>
      <Animated.View key={step} entering={FadeInRight.duration(280)} exiting={FadeOut.duration(120)} style={{ gap: 18 }}>
        <LinearGradient
          colors={['#0c4a3e', '#17604f']}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ height: 262, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        >
          <Hero size={74} color={tokens.brand.limeDeep} strokeWidth={1.5} />
          {current.corners.map((Corner, index) => (
            <View
              key={index}
              style={{
                position: 'absolute',
                width: 38, height: 38, borderRadius: radius.sm,
                backgroundColor: 'rgba(255,255,255,0.14)',
                alignItems: 'center', justifyContent: 'center',
                top: index === 0 ? 22 : undefined,
                bottom: index === 0 ? undefined : index === 1 ? 74 : 40,
                right: index === 0 ? 22 : index === 2 ? 64 : undefined,
                left: index === 1 ? 26 : undefined,
              }}
            >
              <Corner size={18} color="#ffffff" />
            </View>
          ))}
        </LinearGradient>

        <View style={{ gap: 10 }}>
          <T variant="eyebrow" uppercase color={theme.muted}>{`Step ${step + 1} of ${steps.length}`}</T>
          <T variant="displayL" style={{ fontSize: 27, lineHeight: 32 }}>{current.title}</T>
          <T variant="bodyM" color={theme.secondary}>{current.body}</T>
        </View>
      </Animated.View>

      <View style={{ flex: 1 }} />

      <Row style={{ justifyContent: 'center', gap: 6, paddingVertical: 18 }}>
        {steps.map((_, index) => (
          <View
            key={index}
            style={{
              width: index === step ? 22 : 7, height: 7, borderRadius: radius.pill,
              backgroundColor: index === step ? tokens.brand.limeDeep : theme.border,
            }}
          />
        ))}
      </Row>

      <Button
        title={current.cta}
        icon={ChevronRight}
        onPress={() => (step + 1 < steps.length ? setStep(step + 1) : finish())}
      />
      <Button title="Skip" variant="outline" style={{ borderColor: 'transparent' }} onPress={finish} />
    </Screen>
  );
}
