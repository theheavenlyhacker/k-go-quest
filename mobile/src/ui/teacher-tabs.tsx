import React, { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Award, CloudOff, Download, GraduationCap, Pencil, Plus, ClipboardList } from 'lucide-react-native';

import { credentialRows, levelCard, quizCards } from '../domain/teacher-rewards';
import { useTeacher, type TeacherData } from '../state/teacher-context';
import { ComingSoonSheet } from './admin';
import { CreateQuizSheet, EditQuizSheet } from './quiz-builder';
import { Bar, Button, Card, Empty, Eyebrow, IconTile, Info, Pill, Row, T } from './primitives';
import { MIN_TOUCH, subjectTheme, tokens, useTheme } from './theme';

/** Loading and error states shared by the Quizzes and Rewards tabs. */
function TeacherGate({ children }: { children: (data: TeacherData) => React.ReactNode }) {
  const { load, reload } = useTeacher();
  const theme = useTheme();
  if (load.status === 'loading')
    return (
      <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
        <ActivityIndicator accessibilityLabel="Loading" color={theme.navActive} />
        <T variant="bodyS" color={theme.muted}>Loading...</T>
      </Card>
    );
  if (load.status === 'error')
    return (
      <View style={{ gap: 11 }}>
        <Info icon={CloudOff} color={tokens.state.critical} title="Could not load this screen" text={load.message} />
        <Button title="Try again" variant="soft" onPress={reload} />
      </View>
    );
  return <>{children(load.data)}</>;
}

/** Quiz Builder (277:199): the list and the create and edit sheets. */
export function QuizBuilderBody() {
  const theme = useTheme();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <TeacherGate>
      {(data) => {
        const cards = quizCards(data.quizzes);
        return (
          <>
            <Card index={0} onPress={() => setCreating(true)} accessibilityLabel="Create New Quiz" style={{ borderStyle: 'dashed', borderColor: theme.borderStrong }}>
              <Row style={{ minHeight: MIN_TOUCH }}>
                <IconTile icon={Plus} color={theme.navActive} tint={tokens.tint.forestBright} size={40} />
                <View style={{ flex: 1 }}>
                  <T variant="titleS">Create New Quiz</T>
                  <T variant="bodyS" color={theme.muted}>Build an assessment for your Classroom</T>
                </View>
              </Row>
            </Card>
            <Eyebrow style={{ marginTop: 5 }}>Your quizzes</Eyebrow>
            {cards.length ? cards.map((quiz, index) => {
              const brand = subjectTheme[data.quizzes[index]!.subject];
              return (
                <Card key={quiz.id} index={index + 1} style={{ gap: 10 }}>
                  <Row style={{ alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={`${quiz.title}, ${quiz.subjectTitle}, ${quiz.strand}, ${quiz.questions}, ${quiz.statusLabel}`}>
                      <T variant="titleS">{quiz.title}</T>
                      <T variant="bodyS" color={theme.muted}>{`${quiz.subjectTitle} · ${quiz.strand}`}</T>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${quiz.title}`}
                      onPress={() => setEditing(quiz.id)}
                      style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', marginTop: -8, marginRight: -8 }}
                    >
                      <Pencil size={18} color={theme.muted} />
                    </Pressable>
                  </Row>
                  <Row>
                    <Pill color={brand.brand} tint={brand.tint}>{quiz.subjectTitle}</Pill>
                    <Pill color={quiz.published ? tokens.state.success : tokens.state.warning} tint={quiz.published ? tokens.tint.success : tokens.tint.warning}>{quiz.statusLabel}</Pill>
                    <T variant="bodyS" color={theme.muted} style={{ marginLeft: 'auto' }}>{quiz.questions}</T>
                  </Row>
                </Card>
              );
            }) : <Empty icon={ClipboardList} title="No quizzes yet" text="Create your first quiz and it appears here as a Draft." />}
            <CreateQuizSheet visible={creating} classroomId={data.classroom.id} onClose={() => setCreating(false)} />
            <EditQuizSheet quizId={editing} onClose={() => setEditing(null)} />
          </>
        );
      }}
    </TeacherGate>
  );
}

/** Rewards & Credentials (277:262). Download is "coming soon". */
export function TeacherRewardsBody() {
  const theme = useTheme();
  const [soon, setSoon] = useState<string | null>(null);
  return (
    <TeacherGate>
      {(data) => {
        const level = levelCard(data.impactPoints);
        const rows = credentialRows(data.rewards.credentials);
        return (
          <>
            <Card index={0} style={{ gap: 10 }}>
              <View accessible accessibilityLabel={`Level ${level.level}, ${level.points} Impact Points, ${level.toNext} to the next level`} style={{ gap: 10 }}>
                <Row>
                  <IconTile icon={Award} color={tokens.brand.sunDeep} tint={tokens.tint.sun} size={44} />
                  <View style={{ flex: 1 }}>
                    <T variant="titleM">{`Level ${level.level}`}</T>
                    <T variant="bodyS" color={theme.muted}>{`${level.points.toLocaleString('en-US')} Impact Points`}</T>
                  </View>
                </Row>
                <Bar value={level.progress} color={tokens.brand.sun} height={8} />
                <T variant="bodyS" color={theme.muted}>{`${level.toNext.toLocaleString('en-US')} Impact Points to Level ${level.level + 1}`}</T>
              </View>
            </Card>

            <Eyebrow style={{ marginTop: 5 }}>Badges</Eyebrow>
            {data.rewards.badges.length ? (
              <Row style={{ flexWrap: 'wrap' }}>
                {data.rewards.badges.map((badge) => <Pill key={badge.id} color={tokens.brand.grape} tint={tokens.tint.grape} icon={Award}>{badge.label}</Pill>)}
              </Row>
            ) : <T variant="bodyS" color={theme.muted}>Badges you earn appear here.</T>}

            <Eyebrow style={{ marginTop: 5 }}>Training credentials</Eyebrow>
            {rows.length ? rows.map((row, index) => (
              <Card key={row.id} index={index + 1}>
                <Row style={{ minHeight: MIN_TOUCH }}>
                  <IconTile icon={GraduationCap} color={theme.navActive} tint={tokens.tint.forestBright} size={40} />
                  <View style={{ flex: 1 }} accessible accessibilityLabel={`${row.title}, ${row.detail}`}>
                    <T variant="titleS">{row.title}</T>
                    <T variant="bodyS" color={theme.muted}>{row.detail}</T>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Download ${row.title}`}
                    onPress={() => setSoon('Downloading a credential')}
                    style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Download size={20} color={theme.navActive} />
                  </Pressable>
                </Row>
              </Card>
            )) : <Empty icon={GraduationCap} title="No credentials yet" text="Finish a training course and its credential appears here." />}
            <ComingSoonSheet feature={soon} onClose={() => setSoon(null)} />
          </>
        );
      }}
    </TeacherGate>
  );
}
