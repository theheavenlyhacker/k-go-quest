import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import * as Speech from 'expo-speech';
import { Check, Lightbulb, PenLine, Play, Square, Volume2 } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import type { Lesson, Pack } from '@/domain/types';
import { fields, type Stroke } from '@/domain/ink';
import { ACCURACY, OVERALL_ACCURACY, certainty, read, spell } from '@/domain/recognise';
import { hintSteps } from '@/domain/hint-steps';
import { HINT_LANGUAGES, matchVoice, type InstalledVoice } from '@/domain/hint-voice';
import { subjectTitles } from '@/domain/subjects';
import { Action, Bar, Card, Empty, Eyebrow, IconTile, Info, Pill, Pills, Row, Sheet, T } from '@/ui/primitives';
import { FieldPreview, InkPad, PAD_HEIGHT, PAD_THICKNESS } from '@/ui/ink-pad';
import { Screen } from '@/ui/screen';
import { radius, subjectTheme, tokens, useTheme } from '@/ui/theme';

/**
 * Hints: the Figma "AI Tutor" layout, without the tutor. A Hint is fixed text a
 * Pack Author wrote for one Lesson, so nothing here asks a question or invents
 * an answer; the tablet reads a Hint aloud only when it has a voice for it.
 */
type Mode = 'type' | 'handwriting' | 'voice';

const MODES = [
  { label: 'Type', value: 'type' as const },
  { label: 'Handwriting', value: 'handwriting' as const },
  { label: 'Voice', value: 'voice' as const },
];

type Topic = { pack: Pack; lesson: Lesson };

export default function Hints() {
  const { learning, preferences, updatePreferences, packs } = useApp();
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('type');
  const [picking, setPicking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<InstalledVoice[] | null>(null);
  const [done, setDone] = useState<number[]>([]);
  const [chosen, setChosen] = useState<Topic | null>(null);

  useEffect(() => {
    Speech.getAvailableVoicesAsync().then(setVoices).catch(() => setVoices([]));
    return () => { Speech.stop(); };
  }, []);

  const topics: Topic[] = packs.flatMap((pack) => pack.lessons.map((lesson) => ({ pack, lesson })));
  const masteryOf = (t: Topic) => learning.skills.find((s) => s.skillId === t.lesson.skillCode)?.mastery ?? null;
  // Default to whatever the Learner is weakest at and actually has downloaded.
  const weakest = [...topics].sort((a, b) => (masteryOf(a) ?? 1) - (masteryOf(b) ?? 1))[0];
  const topic = chosen ?? weakest ?? null;

  const available = HINT_LANGUAGES.filter((l) => topic?.lesson.hints[l.code]);
  const language = available.find((l) => l.code === preferences.language) ?? available[0] ?? null;
  const hint = language && topic ? topic.lesson.hints[language.code] : '';
  const steps = hintSteps(hint);
  const voice = language && voices ? matchVoice(language.code, voices) : null;
  const mastery = topic ? masteryOf(topic) : null;

  const stop = () => { Speech.stop(); setSpeaking(false); };
  const toggleSpeech = () => {
    if (speaking || !voice) { stop(); return; }
    setSpeaking(true);
    Speech.speak(hint, { voice: voice.identifier, language: voice.language, onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false), onError: () => setSpeaking(false) });
  };
  const choose = (next: Topic | null) => { stop(); setDone([]); setChosen(next); };

  if (!topics.length) {
    return (
      <Screen chrome title="Hints" caption="Written by your Pack Author, on this tablet">
        <Empty icon={Lightbulb} title="No Lessons on this tablet" text="Hints belong to Lessons. Download a Content Pack from the Offline Library and its Hints appear here." />
      </Screen>
    );
  }

  return (
    <Screen chrome title="Hints" caption={language ? `${language.label} · works offline` : 'Written by your Pack Author, on this tablet'}>
      <Pills items={MODES} value={mode} onChange={(value) => { stop(); setMode(value); }} />

      {topic ? (
        <Card onPress={() => setPicking(true)} accessibilityLabel={`Lesson: ${topic.lesson.title}, ${subjectTitles[topic.pack.subject]} ${topic.pack.grade}. Double tap to change.`}>
          <Row style={{ gap: 11 }}>
            <IconTile icon={Lightbulb} color={subjectTheme[topic.pack.subject].brand} tint={subjectTheme[topic.pack.subject].tint} />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="titleS" lines={1}>{topic.lesson.title}</T>
              <T variant="bodyS" color={theme.muted}>{`${subjectTitles[topic.pack.subject]} ${topic.pack.grade} · tap to change Lesson`}</T>
            </View>
            {mastery !== null ? <Pill color={tokens.brand.sky} tint={tokens.tint.sky}>{`${Math.round(mastery * 100)}%`}</Pill> : null}
          </Row>
          {mastery !== null ? <Bar value={mastery} color={subjectTheme[topic.pack.subject].brand} /> : null}
        </Card>
      ) : null}

      {mode === 'handwriting' ? <Handwriting /> : null}

      {topic ? (
        <Card style={{ gap: 11 }}>
          <Row style={{ gap: 11 }}>
            <IconTile icon={Lightbulb} color={tokens.brand.sunDeep} tint={tokens.tint.sun} size={34} />
            <T variant="titleM" style={{ flex: 1 }}>{language ? `Hint · ${language.label}` : 'Hint'}</T>
          </Row>
          {steps.length ? (
            <>
              <T variant="bodyM">{'Check your steps.'}</T>
              <Animated.View entering={FadeIn.duration(220).reduceMotion(ReduceMotion.System)} style={{ gap: 8 }}>
                {steps.map((step, index) => <StepRow key={`${topic.lesson.id}-${language?.code}-${index}`} index={index} text={step} checked={done.includes(index)} onToggle={() => setDone((now) => now.includes(index) ? now.filter((i) => i !== index) : [...now, index])} />)}
              </Animated.View>
            </>
          ) : (
            <T variant="bodyM" color={theme.muted}>This Lesson has no written Hint yet.</T>
          )}

          {available.length ? (
            <Row style={{ gap: 8, flexWrap: 'wrap' }}>
              {available.map((item) => {
                const active = item.code === language?.code;
                return (
                  <Pressable
                    key={item.code}
                    accessibilityRole="button"
                    accessibilityLabel={`Hint in ${item.label}`}
                    accessibilityState={{ selected: active }}
                    onPress={() => { stop(); void updatePreferences({ language: item.code }); }}
                    style={{ minHeight: 44, minWidth: 44, paddingHorizontal: 14, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? tokens.tint.sun : theme.surfaceAlt, borderWidth: 1, borderColor: active ? tokens.brand.sun : theme.border }}
                  >
                    <T variant="titleS" color={active ? tokens.brand.sunDeep : theme.secondary}>{item.label}</T>
                  </Pressable>
                );
              })}
            </Row>
          ) : null}

          {hint && (mode === 'voice' || voice) ? (
            voice ? (
              <Action title={speaking ? 'Stop' : 'Read the Hint aloud'} icon={speaking ? Square : Play} task={async () => toggleSpeech()} />
            ) : (
              <T variant="bodyS" color={tokens.brand.sunDeep}>
                {voices ? `No ${language?.label ?? ''} voice is installed on this tablet, so this Hint is text only.` : 'Checking for a voice…'}
              </T>
            )
          ) : null}
        </Card>
      ) : null}

      <Info
        color={tokens.brand.sky}
        icon={Volume2}
        title="What a Hint is"
        text="A Hint is written by the Pack Author for this Lesson and saved on the tablet. Nothing is generated, and it works with the radio off."
      />

      <Sheet visible={picking} title="Choose a Lesson" onClose={() => setPicking(false)}>
        {topics.map((item) => (
          <Card key={item.lesson.id} accessibilityLabel={`${item.lesson.title}, ${subjectTitles[item.pack.subject]} ${item.pack.grade}`} onPress={() => { choose(item); setPicking(false); }}>
            <Row style={{ gap: 11 }}>
              <IconTile icon={Lightbulb} color={subjectTheme[item.pack.subject].brand} tint={subjectTheme[item.pack.subject].tint} size={34} />
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="titleS" lines={1}>{item.lesson.title}</T>
                <T variant="bodyS" color={theme.muted}>{`${subjectTitles[item.pack.subject]} ${item.pack.grade}`}</T>
              </View>
            </Row>
          </Card>
        ))}
      </Sheet>
    </Screen>
  );
}

/** One step of a Hint. The Learner ticks it off themselves: the tablet cannot say whether a step is right. */
function StepRow({ index, text, checked, onToggle }: { index: number; text: string; checked: boolean; onToggle: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={`Step ${index + 1}: ${text}`}
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.sm, borderWidth: 1, backgroundColor: checked ? tokens.tint.success : theme.surfaceAlt, borderColor: checked ? tokens.state.success : theme.border }}
    >
      <T variant="dataS" color={theme.muted}>{`Step ${index + 1}`}</T>
      <T variant="bodyM" style={{ flex: 1 }} color={checked ? tokens.state.success : theme.text}>{text}</T>
      {checked ? <Check size={18} color={tokens.state.success} /> : null}
    </Pressable>
  );
}

/**
 * Handwriting: the tablet reads what a Learner wrote.
 *
 * The model is a small convolutional network trained from scratch on MNIST
 * digits and a drawn fraction bar — about 27,000 numbers, running as plain
 * arithmetic on this device. No server, no download, nothing sent anywhere.
 *
 * Nothing here is graded. The point is to find out whether the tablet can read
 * this Learner's handwriting before that ever decides anything, which is also
 * why the measured accuracy is on the screen rather than in a document.
 */
function Handwriting() {
  const theme = useTheme();
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [width, setWidth] = useState(0);

  // Reading is a few hundred thousand multiplications: fast enough to redo on
  // every stroke, so there is no button to press and nothing to wait for.
  const shapes = width ? fields(strokes, width, PAD_HEIGHT, PAD_THICKNESS) : [];
  const readings = read(shapes);
  const sure = certainty(readings);

  return (
    <View style={{ gap: 11 }} onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}>
      <Card style={{ gap: 11 }}>
        <Row style={{ gap: 11 }}>
          <IconTile icon={PenLine} color={tokens.brand.grape} tint={tokens.tint.grape} />
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="titleM">Write it and I will read it</T>
            <T variant="bodyS" color={theme.muted}>Digits 0 to 9 and the fraction bar — try 3/4.</T>
          </View>
        </Row>
        <InkPad strokes={strokes} onChange={setStrokes} />
      </Card>

      {readings.length ? (
        <Animated.View entering={FadeIn.duration(220)} style={{ gap: 11 }}>
          <Card style={{ gap: 11 }}>
            <Row>
              <Eyebrow style={{ flex: 1 }}>Read as</Eyebrow>
              <Pill
                color={sure >= 0.9 ? tokens.state.success : sure >= 0.6 ? tokens.brand.sunDeep : tokens.state.critical}
                tint={sure >= 0.9 ? tokens.tint.success : sure >= 0.6 ? tokens.tint.sun : tokens.tint.warning}
              >
                {`${Math.round(sure * 100)}% sure`}
              </Pill>
            </Row>
            <T variant="displayXL">{spell(readings)}</T>
            <Row style={{ gap: 9, flexWrap: 'wrap' }}>
              {readings.map((reading, index) => (
                <Row key={index} style={{ gap: 7 }}>
                  <FieldPreview field={shapes[index]} />
                  <View style={{ gap: 1 }}>
                    <T variant="titleM">{reading.symbol}</T>
                    <T variant="dataS" color={theme.muted}>{`${Math.round(reading.confidence * 100)}%`}</T>
                  </View>
                </Row>
              ))}
            </Row>
            <T variant="bodyS" color={theme.muted}>
              The small squares are exactly what the model sees: your writing cropped, scaled and centred. If one looks wrong, that symbol was written too close to its neighbour.
            </T>
          </Card>

          {sure < 0.6 ? (
            <Info
              color={tokens.state.warning}
              icon={PenLine}
              title="Not confident about that one"
              text="Try writing it larger, with a clear gap before the next symbol. Low confidence means the model is guessing, and a guess should never be treated as an answer."
            />
          ) : null}
        </Animated.View>
      ) : null}

      <Info
        color={tokens.brand.sky}
        icon={PenLine}
        title="What this model is"
        text={`Trained from scratch on handwritten digits, ${Math.round(OVERALL_ACCURACY * 100)}% correct on held-out writing. The fraction bar is the weakest at ${Math.round((ACCURACY['/'] ?? 0) * 100)}%, because it was drawn rather than collected from real learners. Nothing here is graded or counted — reading your writing is not the same as marking it.`}
      />
    </View>
  );
}
