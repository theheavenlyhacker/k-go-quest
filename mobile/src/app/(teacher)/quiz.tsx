import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Camera, Check, Circle, Printer, Sparkles } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import type { Quiz } from '@/domain/types';
import { subjectTitles } from '@/data/preview';
import { Action, Card, Empty, Eyebrow, Info, Pill, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { radius, subjectTheme, tokens, useTheme } from '@/ui/theme';

export default function QuizBuilder() {
  const { snapshot, classroomId, api, preview, toast } = useApp();
  const theme = useTheme();
  const [picked, setPicked] = useState<string[]>([]);
  const [quiz, setQuiz] = useState<Quiz | null>(null);

  const classroom = snapshot.classrooms.find((item) => item.id === classroomId) ?? snapshot.classrooms[0];
  const report = snapshot.reports.find((item) => item.classroomId === classroom?.id);

  // The competency list is whatever this class has actually practised.
  const competencies = Array.from(
    new Map(
      (report?.learners ?? [])
        .flatMap((learner) => learner.skills)
        .map((skill) => [skill.skillCode, skill]),
    ).values(),
  ).sort((a, b) => a.skillCode.localeCompare(b.skillCode));

  const toggle = (code: string) =>
    setPicked((current) => (current.includes(code) ? current.filter((item) => item !== code) : [...current, code].slice(0, 20)));

  if (!classroom) {
    return (
      <Screen chrome title="MATATAG Quiz Builder" caption="No class assigned">
        <Empty title="No class yet" text="Quizzes are built per classroom. Once one is assigned to you it appears here." />
      </Screen>
    );
  }

  return (
    <Screen chrome title="MATATAG Quiz Builder" caption="Generate, print, camera-grade">
      <Card style={{ gap: 11 }}>
        <Row>
          <T variant="titleM" style={{ flex: 1 }}>1 · Pick MATATAG competencies</T>
          {picked.length ? <Pill color={tokens.brand.sky} tint={tokens.tint.sky}>{`${picked.length} picked`}</Pill> : null}
        </Row>
        {competencies.length ? competencies.map((skill) => {
          const on = picked.includes(skill.skillCode);
          const tone = subjectTheme[skill.subject];
          return (
            <Pressable
              key={skill.skillCode}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => toggle(skill.skillCode)}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 11, padding: 11,
                borderRadius: radius.sm, borderWidth: on ? 1.6 : 1,
                borderColor: on ? tokens.brand.limeDeep : theme.borderStrong,
                backgroundColor: on ? tokens.tint.lime : 'transparent',
                opacity: pressed ? 0.75 : 1,
              })}
            >
              {on
                ? <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: tokens.brand.limeDeep, alignItems: 'center', justifyContent: 'center' }}><Check size={13} color="#ffffff" /></View>
                : <Circle size={22} color={theme.borderStrong} />}
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="dataS" color={theme.muted}>{skill.skillCode}</T>
                <T variant="bodyM">{subjectTitles[skill.subject]}</T>
              </View>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone.brand }} />
            </Pressable>
          );
        }) : (
          <T variant="bodyS" color={theme.muted}>No competencies yet — they appear once your learners have synced practice.</T>
        )}
      </Card>

      <Card style={{ gap: 11 }}>
        <T variant="titleM">2 · Generate the paper quiz</T>
        <T variant="bodyM" color={theme.secondary}>
          The builder pulls items from the published exercise bank for this grade and returns a printable set with an answer key.
        </T>
        <Row style={{ gap: 7, flexWrap: 'wrap' }}>
          <Pill color={tokens.brand.sky} tint={tokens.tint.sky}>20 items</Pill>
          <Pill color={tokens.brand.grape} tint={tokens.tint.grape}>Teacher only</Pill>
          <Pill color={tokens.brand.limeDeep} tint={tokens.tint.lime}>Answer key</Pill>
        </Row>
        <Action
          title="Generate quiz"
          icon={Sparkles}
          disabled={!picked.length}
          task={async () => {
            if (preview) { toast('Quiz generation needs a live teacher account — the preview has no server.', 'error'); return; }
            const result = await api.call<Quiz>('POST', `quizzes/classrooms/${classroom.id}/build`, { skillCodes: picked, itemCount: 20 });
            setQuiz(result);
            if (!result.actualItems) toast('No published items matched those competencies for this grade.', 'error');
          }}
        />
      </Card>

      {quiz ? (
        <Animated.View entering={FadeIn.duration(260)} style={{ gap: 11 }}>
          <Eyebrow>{`Generated · ${quiz.actualItems} of ${quiz.requestedItems} items`}</Eyebrow>
          {quiz.questions.map((question, index) => (
            <Card key={question.id} index={index} style={{ gap: 7 }}>
              <Row>
                <T variant="dataS" color={theme.muted} style={{ flex: 1 }}>{question.skillCode}</T>
                <T variant="dataS" color={theme.muted}>{`#${index + 1}`}</T>
              </Row>
              <T variant="bodyM">{question.prompt}</T>
              {question.options.map((option, optionIndex) => (
                <Row key={`${question.id}-${optionIndex}`} style={{ gap: 8 }}>
                  <T variant="dataS" color={theme.muted}>{String.fromCharCode(65 + optionIndex)}</T>
                  <T variant="bodyS" style={{ flex: 1 }}>{option}</T>
                </Row>
              ))}
            </Card>
          ))}
          <Card style={{ gap: 7 }}>
            <Row style={{ gap: 9 }}>
              <Printer size={17} color={theme.muted} />
              <T variant="titleS" style={{ flex: 1 }}>Answer key</T>
            </Row>
            <Row style={{ gap: 10, flexWrap: 'wrap' }}>
              {quiz.answerKey.map((entry, index) => (
                <Pill key={entry.exerciseId} color={theme.navActive} tint={tokens.tint.forestBright}>
                  {`${index + 1}${String.fromCharCode(65 + entry.correctOption)}`}
                </Pill>
              ))}
            </Row>
          </Card>
        </Animated.View>
      ) : null}

      <Card style={{ gap: 9, opacity: 0.75 }}>
        <Row style={{ gap: 9 }}>
          <Camera size={18} color={theme.muted} />
          <T variant="titleM" style={{ flex: 1 }}>3 · Camera auto-grade</T>
        </Row>
        <T variant="bodyS" color={theme.muted}>
          Scanning printed papers is designed but not implemented — it needs the on-device OCR model. Grade on paper for now; the answer key above prints with the quiz.
        </T>
      </Card>

      <Info
        color={tokens.brand.sky}
        icon={Printer}
        title="Printing"
        text="The generated quiz is JSON today. Wiring it to expo-print would give you a paper-ready PDF — say the word and I will add it."
      />
    </Screen>
  );
}
