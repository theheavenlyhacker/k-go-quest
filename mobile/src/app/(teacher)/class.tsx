import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { CloudOff, TriangleAlert } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { ago, meanMastery, pct } from '@/domain/format';
import type { LearnerReport, Subject } from '@/domain/types';
import { subjects, subjectTitles } from '@/data/preview';
import { Button, Card, Empty, Eyebrow, Pill, Pills, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { radius, tokens, useTheme } from '@/ui/theme';

/** Heatmap bands: mastered / developing / needs help. */
export function band(value: number | null) {
  if (value === null) return { color: '#d9d4c6', label: 'No data' };
  if (value >= 0.8) return { color: tokens.brand.limeDeep, label: 'Mastered' };
  if (value >= 0.4) return { color: tokens.brand.sunDeep, label: 'Developing' };
  return { color: tokens.state.critical, label: 'Needs help' };
}

const subjectMastery = (learner: LearnerReport, subject: Subject) =>
  meanMastery(learner.skills.filter((skill) => skill.subject === subject));

export default function ClassOverview() {
  const { snapshot, classroomId, setClassroom, toast } = useApp();
  const theme = useTheme();
  const router = useRouter();

  const classroom = snapshot.classrooms.find((item) => item.id === classroomId) ?? snapshot.classrooms[0];
  const report = snapshot.reports.find((item) => item.classroomId === classroom?.id);
  const learners = report?.learners ?? [];
  const classMastery = meanMastery(
    learners.flatMap((learner) => learner.skills),
  );
  const attempts = learners.reduce((total, learner) => total + learner.skills.reduce((sum, skill) => sum + skill.attempts, 0), 0);
  const flagged = learners.filter((learner) => learner.learningStatus === 'TEACHER_REVIEW_SUGGESTED');
  const stale = learners.filter((learner) => learner.connectivityStatus === 'NO_RECENT_SYNC');
  const activeSubjects = subjects.filter((subject) => learners.some((learner) => subjectMastery(learner, subject) !== null));

  if (!classroom) {
    return (
      <Screen chrome title="Class Overview" caption="No classroom assigned">
        <Empty title="No class yet" text="An LGU administrator assigns classrooms to teachers. Once yours is assigned it appears here." />
      </Screen>
    );
  }

  return (
    <Screen chrome title="Class Overview" caption={`${classroom.name} · ${learners.length} learner${learners.length === 1 ? '' : 's'}`}>
      {snapshot.classrooms.length > 1 ? (
        <Pills
          items={snapshot.classrooms.slice(0, 3).map((item) => ({ label: item.name, value: item.id }))}
          value={classroom.id}
          onChange={(value) => { void setClassroom(value).catch((error: unknown) => toast(error instanceof Error ? error.message : 'Could not load that class.', 'error')); }}
        />
      ) : null}

      <Row style={{ gap: 11, alignItems: 'stretch' }}>
        <Card style={{ flex: 1, gap: 7 }}>
          <Eyebrow>Class mastery</Eyebrow>
          <T variant="displayL" style={{ fontSize: 30, lineHeight: 34 }}>{pct(classMastery)}</T>
          <Pill color={tokens.state.success} tint={tokens.tint.lime}>{`${learners.length} learners`}</Pill>
        </Card>
        <Card style={{ flex: 1, gap: 7 }}>
          <Eyebrow>Practice attempts</Eyebrow>
          <T variant="displayL" style={{ fontSize: 30, lineHeight: 34 }}>{attempts}</T>
          <T variant="bodyS" color={theme.muted}>confirmed by the server</T>
        </Card>
      </Row>

      {activeSubjects.length ? (
        <Card style={{ gap: 12 }}>
          <Row>
            <T variant="titleM" style={{ flex: 1 }}>Competency heatmap</T>
            <T variant="bodyS" color={theme.muted}>{`${learners.length} learners`}</T>
          </Row>
          {activeSubjects.map((subject) => (
            <Row key={subject} style={{ gap: 10 }}>
              <T variant="bodyS" style={{ width: 54 }}>{subjectTitles[subject]}</T>
              <Row style={{ flex: 1, gap: 4, flexWrap: 'wrap' }}>
                {learners.slice(0, 20).map((learner) => (
                  <View
                    key={`${subject}-${learner.id}`}
                    accessibilityLabel={`${learner.alias} ${subjectTitles[subject]} ${band(subjectMastery(learner, subject)).label}`}
                    style={{ width: 17, height: 17, borderRadius: 5, backgroundColor: band(subjectMastery(learner, subject)).color }}
                  />
                ))}
              </Row>
            </Row>
          ))}
          <Row style={{ gap: 14, flexWrap: 'wrap' }}>
            {[tokens.brand.limeDeep, tokens.brand.sunDeep, tokens.state.critical].map((color, index) => (
              <Row key={color} style={{ gap: 6 }}>
                <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: color }} />
                <T variant="bodyS" color={theme.muted}>{['Mastered', 'Developing', 'Needs help'][index]}</T>
              </Row>
            ))}
          </Row>
        </Card>
      ) : null}

      {flagged.length ? (
        <Card style={{ backgroundColor: `${tokens.state.critical}0C`, borderColor: `${tokens.state.critical}45`, gap: 12 }}>
          <Row style={{ alignItems: 'flex-start', gap: 11 }}>
            <TriangleAlert size={19} color={tokens.state.critical} />
            <T variant="bodyM" color={theme.secondary} style={{ flex: 1 }}>
              {`${flagged.length} learner${flagged.length === 1 ? '' : 's'} flagged for review — sustained practice with low estimated mastery.`}
            </T>
          </Row>
          <Button title="Open the group" onPress={() => router.push('/(teacher)/learners')} />
        </Card>
      ) : null}

      {stale.length ? (
        <>
          <Eyebrow>Not synced recently</Eyebrow>
          {stale.slice(0, 6).map((learner, index) => (
            <Card key={learner.id} index={index} onPress={() => router.push({ pathname: '/learner', params: { id: learner.id } })}>
              <Row style={{ gap: 11 }}>
                <View style={{ width: 34, height: 34, borderRadius: radius.sm, backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                  <CloudOff size={16} color={theme.muted} />
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <T variant="titleS">{learner.alias}</T>
                  <T variant="bodyS" color={theme.muted}>{`Last sync ${ago(learner.lastSyncAt).toLowerCase()}`}</T>
                </View>
                <Pill color={tokens.brand.sunDeep} tint={tokens.tint.sun}>Check in</Pill>
              </Row>
            </Card>
          ))}
        </>
      ) : null}

      {report ? <T variant="bodyS" color={theme.muted}>{report.decisionPolicy}</T> : null}
    </Screen>
  );
}
