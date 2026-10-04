import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Speech from 'expo-speech';
import { CircleHelp, Lightbulb, Mic, PenLine, Play, Search, Square, Volume2 } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import type { Lesson, Pack } from '@/domain/types';
import { starterPacks } from '@/content/starter-pack';
import { subjectTitles } from '@/domain/subjects';
import { Action, Bar, Card, Empty, Eyebrow, IconTile, Info, Pill, Pills, Row, Sheet, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { radius, subjectTheme, tokens, useTheme } from '@/ui/theme';

type Mode = 'type' | 'handwriting' | 'voice';

const MODES = [
  { label: 'Type', value: 'type' as const },
  { label: 'Handwriting', value: 'handwriting' as const },
  { label: 'Voice', value: 'voice' as const },
];

/** Hint languages the packs can carry, in the order the design shows them. */
const LANGUAGES = [
  { label: 'English', value: 'en', speech: 'en-US' },
  { label: 'Tagalog', value: 'tl', speech: 'fil-PH' },
  { label: 'Cebuano', value: 'ceb', speech: 'fil-PH' },
  { label: 'Ilocano', value: 'ilo', speech: 'fil-PH' },
];

type Topic = { pack: Pack; lesson: Lesson };

/**
 * Ranks downloaded lessons against a typed question by word overlap.
 *
 * This is retrieval over the authored content already on the device — not a
 * generated answer. The tutor can only say what a teacher wrote into the pack,
 * which is why it keeps working with the radio off.
 */
function search(topics: Topic[], question: string): Topic | null {
  const words = question.toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => w.length > 2) ?? [];
  if (!words.length) return null;
  let best: { topic: Topic; score: number } | null = null;
  for (const topic of topics) {
    const haystack = `${topic.lesson.title} ${topic.lesson.skillCode} ${topic.lesson.body} ${topic.pack.title}`.toLowerCase();
    const score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { topic, score };
  }
  return best ? best.topic : null;
}

export default function Tutor() {
  const { learning, preferences, updatePreferences, toast } = useApp();
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('voice');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<Topic | null>(null);
  const [picking, setPicking] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const topics: Topic[] = starterPacks.flatMap((pack) =>
    pack.lessons.map((lesson) => ({ pack, lesson })),
  );
  // Default to whatever the learner is weakest at and actually has downloaded.
  const weakest = [...topics].sort(
    (a, b) =>
      (learning.skills.find((s) => s.skillId === a.lesson.skillCode)?.mastery ?? 1) -
      (learning.skills.find((s) => s.skillId === b.lesson.skillCode)?.mastery ?? 1),
  )[0];
  const [chosen, setChosen] = useState<Topic | null>(null);
  const topic = answer ?? chosen ?? weakest ?? null;

  const available = LANGUAGES.filter((l) => topic?.lesson.hints[l.value]);
  const language = available.find((l) => l.value === preferences.language) ?? available[0] ?? LANGUAGES[0];
  const hint = topic?.lesson.hints[language.value] ?? topic?.lesson.hints.en ?? '';
  const mastery = topic ? learning.skills.find((s) => s.skillId === topic.lesson.skillCode)?.mastery ?? null : null;

  const say = (text: string) => {
    if (!text) return;
    Speech.stop();
    setSpeaking(true);
    Speech.speak(text, {
      language: language.speech,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => { setSpeaking(false); toast('This device has no voice installed for that language.', 'error'); },
    });
  };

  if (!topics.length) {
    return (
      <Screen chrome title="AI Tutor" caption="Type, write or speak — all on device">
        <Empty
          icon={Lightbulb}
          title="Nothing downloaded to tutor on"
          text="The tutor explains lessons stored on this device. Download a pack from the Offline Library and it will have something to work with."
        />
      </Screen>
    );
  }

  return (
    <Screen chrome title="AI Tutor" caption={mode === 'voice' ? `${language.label} voice · runs offline` : 'Type, write or speak — all on device'}>
      <Pills items={MODES} value={mode} onChange={(value) => { Speech.stop(); setSpeaking(false); setMode(value); }} />

      {topic ? (
        <Card onPress={() => setPicking(true)}>
          <Row style={{ gap: 11 }}>
            <IconTile
              icon={Lightbulb}
              color={subjectTheme[topic.pack.subject].brand}
              tint={subjectTheme[topic.pack.subject].tint}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="titleS" lines={1}>{topic.lesson.title}</T>
              <T variant="bodyS" color={theme.muted}>
                {`${subjectTitles[topic.pack.subject]} ${topic.pack.grade} · tap to change topic`}
              </T>
            </View>
            {mastery !== null ? <Pill color={tokens.brand.sky} tint={tokens.tint.sky}>{`${Math.round(mastery * 100)}%`}</Pill> : null}
          </Row>
          {mastery !== null ? <Bar value={mastery} color={subjectTheme[topic.pack.subject].brand} /> : null}
        </Card>
      ) : null}

      {mode === 'type' ? (
        <>
          <Card style={{ gap: 11 }}>
            <Row>
              <T variant="titleM" style={{ flex: 1 }}>Ask the tutor</T>
              <Pill color={tokens.brand.grape} tint={tokens.tint.grape}>Typed · offline</Pill>
            </Row>
            <Eyebrow>Your question</Eyebrow>
            <Row style={{ backgroundColor: theme.surface, borderWidth: 1.4, borderColor: theme.navActive, borderRadius: radius.sm, paddingHorizontal: 13, minHeight: 49, gap: 10 }}>
              <CircleHelp size={17} color={theme.navActive} />
              <TextInput
                accessibilityLabel="Your question"
                value={question}
                onChangeText={setQuestion}
                placeholder="How do I add 3/4 and 2/6?"
                placeholderTextColor={theme.muted}
                style={{ flex: 1, color: theme.text, fontFamily: 'PublicSans_400Regular', fontSize: 13, paddingVertical: 13 }}
              />
            </Row>
            <Action
              title="Ask the tutor"
              icon={Search}
              disabled={question.trim().length < 3}
              task={async () => {
                const found = search(topics, question);
                setAnswer(found);
                if (!found) toast('No downloaded lesson covers that yet. Try a word from the lesson title.', 'info');
              }}
            />
            <T variant="bodyS" color={theme.muted}>
              The tutor searches the lessons saved on this device and reads back what your teacher wrote. It does not invent answers.
            </T>
          </Card>

          {answer ? (
            <Animated.View entering={FadeIn.duration(260)} style={{ gap: 11 }}>
              <Eyebrow>From your saved lessons</Eyebrow>
              <Card style={{ gap: 10 }}>
                <T variant="titleS">{answer.lesson.title}</T>
                <T variant="bodyM" color={theme.secondary}>{answer.lesson.body}</T>
                {hint ? (
                  <Card style={{ backgroundColor: tokens.tint.sun, borderColor: `${tokens.state.warning}40` }}>
                    <Row style={{ alignItems: 'flex-start' }}>
                      <Lightbulb size={17} color={tokens.brand.sunDeep} />
                      <View style={{ flex: 1, gap: 3 }}>
                        <T variant="titleS" color={tokens.brand.sunDeep}>{`Hint · ${language.label}`}</T>
                        <T variant="bodyM">{hint}</T>
                      </View>
                    </Row>
                  </Card>
                ) : null}
                <Action title={speaking ? 'Stop' : 'Read it aloud'} icon={speaking ? Square : Volume2} variant="soft"
                  task={async () => { if (speaking) { Speech.stop(); setSpeaking(false); } else say(`${answer.lesson.body} ${hint}`); }} />
              </Card>
            </Animated.View>
          ) : null}
        </>
      ) : null}

      {mode === 'voice' ? (
        <Card style={{ backgroundColor: '#0c4a3e', borderColor: '#0c4a3e', gap: 12 }}>
          <Row style={{ gap: 12 }}>
            <View style={{ width: 42, height: 42, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
              <Mic size={20} color="#ffffff" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="titleM" color="#ffffff">On-device voice tutor</T>
              <T variant="bodyS" color="#ffffff" style={{ opacity: 0.72 }}>Runs on the tablet — no server, no data</T>
            </View>
          </Row>

          <T variant="eyebrow" uppercase color="#ffffff" style={{ opacity: 0.72 }}>Tutor language</T>
          <Row style={{ backgroundColor: 'rgba(255,255,255,0.12)', padding: 4, borderRadius: radius.sm, gap: 3 }}>
            {(available.length ? available : [LANGUAGES[0]]).slice(0, 3).map((item) => {
              const active = item.value === language.value;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => { void updatePreferences({ language: item.value }); }}
                  style={{ flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center', backgroundColor: active ? '#ffffff' : 'transparent' }}
                >
                  <T variant="titleS" color={active ? theme.navActive : '#ffffff'}>{item.label}</T>
                </Pressable>
              );
            })}
          </Row>
          <T variant="bodyS" color="#ffffff" style={{ opacity: 0.72 }}>
            {available.length > 3
              ? `Also in this pack: ${available.slice(3).map((l) => l.label).join(', ')}.`
              : 'Languages appear here when the pack carries a hint written in them.'}
          </T>

          <Pressable
            accessibilityRole="button"
            disabled={!hint}
            onPress={() => { if (speaking) { Speech.stop(); setSpeaking(false); } else say(hint); }}
            style={({ pressed }) => ({
              backgroundColor: hint ? tokens.brand.limeDeep : 'rgba(255,255,255,0.18)',
              borderRadius: radius.sm, minHeight: 48, alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row', gap: 8, opacity: pressed ? 0.8 : 1,
            })}
          >
            {speaking ? <Square size={17} color="#0c4a3e" /> : <Play size={17} color={hint ? '#0c4a3e' : '#ffffff'} />}
            <T variant="titleM" color={hint ? '#0c4a3e' : '#ffffff'}>{speaking ? 'Stop' : 'Play the hint'}</T>
          </Pressable>
          {!hint ? <T variant="bodyS" color="#ffffff" style={{ opacity: 0.72 }}>This lesson has no written hint yet.</T> : null}
        </Card>
      ) : null}

      {mode === 'handwriting' ? (
        <Empty
          icon={PenLine}
          title="Handwriting reading is not built yet"
          text="Checking handwritten working needs the on-device OCR model, which is the next piece of ML work. Until it ships, use Type or Voice — both run offline today."
        />
      ) : null}

      <Card style={{ gap: 10, opacity: 0.7 }}>
        <Row>
          <T variant="titleM" style={{ flex: 1 }}>Concept retelling</T>
          <Pill color={tokens.brand.sunDeep} tint={tokens.tint.sun}>+8 KC bonus</Pill>
        </Row>
        <T variant="bodyM" color={theme.secondary}>
          Explain in your own words why the denominators have to match, and earn a bonus.
        </T>
        <T variant="bodyS" color={theme.muted}>
          Not available yet: scoring an explanation needs a model that is still being built. Awarding coins before it exists would mean paying out on a score nothing actually computed.
        </T>
      </Card>

      <Info
        color={tokens.brand.sky}
        icon={Volume2}
        title="What this tutor is"
        text="It speaks and searches the lessons already saved on this device, in the language you pick. Everything runs on the tablet — nothing is sent anywhere, and it works with the radio off."
      />

      <Sheet visible={picking} title="Choose a topic" onClose={() => setPicking(false)}>
        {topics.map((item) => (
          <Card key={item.lesson.id} onPress={() => { setChosen(item); setAnswer(null); setPicking(false); }}>
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
