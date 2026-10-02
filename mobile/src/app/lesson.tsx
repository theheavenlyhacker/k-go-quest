import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { Check, CircleCheck, Lightbulb, Play, RefreshCw, TriangleAlert, WifiOff } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { subjectTitles } from '@/data/preview';
import type { Exercise } from '@/domain/types';
import { Action, BackLink, Card, Empty, Pill, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { radius, tokens, useTheme } from '@/ui/theme';

type Verdict = 'correct' | 'wrong' | 'saved';

export default function ModuleScreen() {
  const { lessonId, exerciseId } = useLocalSearchParams<{ lessonId?: string; exerciseId?: string }>();
  const { snapshot, outcomes, queued, queue, sync, preferences } = useApp();
  const theme = useTheme();
  const router = useRouter();
  const [playlist, setPlaylist] = useState<Exercise[] | null>(null);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [hintOpen, setHintOpen] = useState(false);

  const found = (() => {
    for (const entry of snapshot.downloads) {
      for (const lesson of entry.lessons) {
        if (lesson.id === lessonId || lesson.exercises.some((item) => item.id === exerciseId)) return { pack: entry.pack, lesson };
      }
    }
    return null;
  })();

  if (!found) {
    return (
      <Screen chrome title="Module" caption="Not on this device">
        <Empty title="This module is not on this device" text="Go back to the Offline Library and download the pack it belongs to." />
      </Screen>
    );
  }

  const { pack, lesson } = found;
  const answered = new Set([...outcomes.map((row) => row.input.exerciseId), ...queued.map((item) => item.input.exerciseId)]);
  const unanswered = lesson.exercises.filter((item) => !answered.has(item.id));
  const set = playlist ?? unanswered;
  const exercise = playlist ? playlist[index] : unanswered[0];
  const hint = lesson.hints[preferences.language] ?? lesson.hints.en;
  const reward = set.reduce((total, item) => total + item.coinAward, 0);

  return (
    <Screen chrome title="Module" caption="Playing from device storage">
      <BackLink label="Back to modules" onPress={() => router.back()} />

      <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
        <LinearGradient colors={['#0c4a3e', '#126655']} start={{ x: 0, y: 0 }} end={{ x: 0.78, y: 1 }} style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Play this module aloud"
            onPress={() => Speech.speak(lesson.body, { language: preferences.language === 'tl' ? 'fil-PH' : 'en-US' })}
            style={({ pressed }) => ({ width: 58, height: 58, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
          >
            <Play size={22} color="#ffffff" fill="#ffffff" />
          </Pressable>
          <Row style={{ position: 'absolute', top: 12, left: 12, gap: 5, backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill }}>
            <WifiOff size={11} color="#ffffff" />
            <T variant="labelPill" color="#ffffff">Playing offline</T>
          </Row>
        </LinearGradient>
        <View style={{ padding: 14, gap: 4 }}>
          <T variant="titleM">{lesson.title}</T>
          <T variant="bodyS" color={theme.muted}>{`${subjectTitles[pack.subject]} ${pack.grade} · ${lesson.skillCode}`}</T>
        </View>
      </Card>

      {exercise ? (
        <Card style={{ gap: 10 }}>
          <Row style={{ gap: 8 }}>
            <T variant="titleM" style={{ flex: 1 }}>Practice set</T>
            <Pill color={tokens.brand.sunDeep} tint={tokens.tint.sun}>{`+${reward} KC`}</Pill>
          </Row>
          <T variant="bodyM" color={theme.secondary}>{exercise.prompt}</T>
          {exercise.options.map((option, optionIndex) => (
            <Option
              key={`${exercise.id}-${optionIndex}`}
              letter={String.fromCharCode(65 + optionIndex)}
              label={option}
              selected={choice === optionIndex}
              state={optionState(verdict, exercise, optionIndex, choice)}
              disabled={verdict !== null}
              onPress={() => setChoice(optionIndex)}
            />
          ))}
        </Card>
      ) : (
        <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
          <CircleCheck size={42} color={tokens.state.success} />
          <T variant="titleM">Practice set complete</T>
          <T variant="bodyS" color={theme.muted} style={{ textAlign: 'center', maxWidth: 280 }}>
            Your answers are on this device. The school server confirms them and awards coins on the next sync.
          </T>
          <Action title="Sync now" icon={RefreshCw} task={sync} />
        </Card>
      )}

      {hint ? (
        <Card onPress={() => setHintOpen((open) => !open)} style={{ backgroundColor: tokens.tint.sun, borderColor: `${tokens.state.warning}40` }}>
          <Row style={{ alignItems: 'flex-start' }}>
            <Lightbulb size={18} color={tokens.brand.sunDeep} />
            <View style={{ flex: 1, gap: 4 }}>
              <T variant="titleS" color={tokens.brand.sunDeep}>{hintOpen ? 'Hint' : 'I do not understand — show a hint'}</T>
              {hintOpen ? <T variant="bodyM">{hint}</T> : null}
            </View>
          </Row>
        </Card>
      ) : null}

      {exercise ? (
        <Action
          title={verdict ? 'Next question' : 'Check answer'}
          disabled={choice === null}
          task={async () => {
            if (choice === null) return;
            if (!verdict) {
              await queue(exercise.id, choice, pack);
              if (!playlist) { setPlaylist(unanswered); setIndex(0); }
              setVerdict(exercise.correctOption === undefined ? 'saved' : exercise.correctOption === choice ? 'correct' : 'wrong');
              return;
            }
            setVerdict(null);
            setChoice(null);
            setIndex((current) => current + 1);
          }}
        />
      ) : null}

      {verdict ? <VerdictBar kind={verdict} coins={exercise?.coinAward ?? 0} /> : null}
    </Screen>
  );
}

function optionState(verdict: Verdict | null, exercise: Exercise, optionIndex: number, choice: number | null): 'idle' | 'right' | 'wrong' {
  if (!verdict || verdict === 'saved' || exercise.correctOption === undefined) return 'idle';
  if (optionIndex === exercise.correctOption) return 'right';
  if (optionIndex === choice) return 'wrong';
  return 'idle';
}

function Option({ letter, label, selected, state, disabled, onPress }: {
  letter: string; label: string; selected: boolean; state: 'idle' | 'right' | 'wrong'; disabled: boolean; onPress: () => void;
}) {
  const theme = useTheme();
  const border = state === 'right' ? tokens.brand.limeDeep : state === 'wrong' ? tokens.state.critical : selected ? theme.navActive : theme.borderStrong;
  const background = state === 'right' ? tokens.tint.lime : state === 'wrong' ? `${tokens.state.critical}14` : selected ? tokens.tint.forestBright : 'transparent';
  const keyBackground = state === 'right' ? tokens.brand.limeDeep : state === 'wrong' ? tokens.state.critical : theme.surfaceAlt;
  const keyColor = state === 'idle' ? theme.muted : '#ffffff';
  return (
    <Pressable
      accessibilityRole="radio" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11,
        borderRadius: radius.sm, borderWidth: state === 'idle' && !selected ? 1 : 1.6,
        borderColor: border, backgroundColor: background, opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{ width: 20, height: 20, borderRadius: radius.sm, backgroundColor: keyBackground, alignItems: 'center', justifyContent: 'center' }}>
        <T variant="dataS" color={keyColor}>{letter}</T>
      </View>
      <T variant="bodyM" style={{ flex: 1 }}>{label}</T>
      {state === 'right' ? <Check size={17} color={tokens.brand.limeDeep} /> : null}
      {state === 'wrong' ? <TriangleAlert size={17} color={tokens.state.critical} /> : null}
    </Pressable>
  );
}

/** The full-width result bar that sits above the nav bar in 07b / 07c. */
function VerdictBar({ kind, coins }: { kind: Verdict; coins: number }) {
  const background = kind === 'wrong' ? tokens.state.critical : '#0c4a3e';
  const Icon = kind === 'wrong' ? TriangleAlert : kind === 'correct' ? Check : RefreshCw;
  const message = kind === 'correct'
    ? `Correct! +${coins} Khan-Coins earned`
    : kind === 'wrong'
      ? 'Not quite — the correct answer is shown above'
      : 'Saved on this device — checked when you sync';
  return (
    <Animated.View entering={SlideInDown.duration(280)} style={{ backgroundColor: background, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Animated.View entering={FadeIn.delay(120)}><Icon size={18} color="#ffffff" /></Animated.View>
      <T variant="bodyM" color="#ffffff" style={{ flex: 1 }}>{message}</T>
    </Animated.View>
  );
}
