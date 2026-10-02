import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CloudOff, TriangleAlert, Wifi } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { ago, initials, meanMastery, pct } from '@/domain/format';
import { subjectTitles } from '@/data/preview';
import { BackLink, Bar, Card, Empty, Eyebrow, Pill, Ring, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { radius, subjectTheme, tokens, useTheme } from '@/ui/theme';

export default function LearnerDetail() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { snapshot } = useApp();
  const theme = useTheme();
  const router = useRouter();

  const report = snapshot.reports.find((item) => item.learners.some((learner) => learner.id === id));
  const learner = report?.learners.find((item) => item.id === id);
  const classroom = snapshot.classrooms.find((item) => item.id === report?.classroomId);

  if (!learner) {
    return (
      <Screen chrome title="Learner" caption="Not in this class report">
        <Empty title="Learner not found" text="Open them again from Student Insights. Reports cover the classes assigned to you." />
      </Screen>
    );
  }

  const mastery = meanMastery(learner.skills);
  const stale = learner.connectivityStatus === 'NO_RECENT_SYNC';
  const flagged = learner.learningStatus === 'TEACHER_REVIEW_SUGGESTED';

  return (
    <Screen chrome title={learner.alias} caption={classroom?.name ?? 'Learner detail'}>
      <BackLink label="Back to learners" onPress={() => router.back()} />

      <Card>
        <Row style={{ gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <T variant="titleM" color={theme.muted}>{initials(learner.alias)}</T>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <T variant="titleM">{learner.alias}</T>
            <T variant="bodyS" color={theme.muted}>{`Last sync ${ago(learner.lastSyncAt).toLowerCase()}`}</T>
            <Pill color={stale ? tokens.brand.sunDeep : tokens.state.success} tint={stale ? tokens.tint.sun : tokens.tint.success} icon={stale ? CloudOff : Wifi}>
              {stale ? 'No recent sync' : 'Syncing normally'}
            </Pill>
          </View>
          <Ring value={mastery} size={60} color={tokens.brand.limeDeep} />
        </Row>
      </Card>

      {flagged ? (
        <Card style={{ backgroundColor: `${tokens.state.critical}0C`, borderColor: `${tokens.state.critical}45` }}>
          <Row style={{ alignItems: 'flex-start', gap: 11 }}>
            <TriangleAlert size={18} color={tokens.state.critical} />
            <View style={{ flex: 1, gap: 4 }}>
              <T variant="titleS">Teacher review suggested</T>
              <T variant="bodyS" color={theme.secondary}>
                {learner.reason ?? 'Sustained practice with low estimated mastery. This is a rule-based signal — you decide what to do.'}
              </T>
            </View>
          </Row>
        </Card>
      ) : null}

      <Eyebrow>Skills</Eyebrow>
      {learner.skills.length ? learner.skills.map((skill, index) => (
        <Card key={skill.skillCode} index={index} style={{ gap: 8 }}>
          <Row>
            <View style={{ flex: 1, gap: 1 }}>
              <T variant="titleS" lines={1}>{skill.skillCode}</T>
              <T variant="bodyS" color={theme.muted}>
                {`${subjectTitles[skill.subject]} · ${skill.correctAttempts}/${skill.attempts} correct`}
              </T>
            </View>
            <T variant="titleS">{pct(skill.mastery)}</T>
          </Row>
          <Bar value={skill.mastery} color={subjectTheme[skill.subject].brand} />
        </Card>
      )) : (
        <Empty title="No practice data" text="This learner has not synced any answers yet." />
      )}

      {report ? <T variant="bodyS" color={theme.muted}>{report.decisionPolicy}</T> : null}
    </Screen>
  );
}
