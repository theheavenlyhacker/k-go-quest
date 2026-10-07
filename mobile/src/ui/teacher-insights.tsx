import { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CloudOff, Search, Users } from 'lucide-react-native';

import { ago, pct } from '../domain/format';
import { insights, searchLearners, type InsightLearner, type LearnerDetail } from '../domain/teacher';
import { useTeacher, type TeacherLoad } from '../state/teacher-context';
import { Bar, Button, Card, Empty, Eyebrow, Field, Info, ListRow, Pill, Row, T } from './primitives';
import { tokens, useTheme } from './theme';

/** Loading and error frames shared by the Insights list and the Learner detail. Returns the data once ready. */
export function useReadyTeacher(): { frame: React.ReactNode; data: Extract<TeacherLoad, { status: 'ready' }>['data'] | null } {
  const { load, reload } = useTeacher();
  const theme = useTheme();
  if (load.status === 'loading')
    return {
      data: null,
      frame: (
        <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
          <ActivityIndicator accessibilityLabel="Loading your Learners" color={theme.navActive} />
          <T variant="bodyS" color={theme.muted}>Loading your Learners...</T>
        </Card>
      ),
    };
  if (load.status === 'error')
    return {
      data: null,
      frame: (
        <View style={{ gap: 11 }}>
          <Info icon={CloudOff} color={tokens.state.critical} title="Could not load your Learners" text={load.message} />
          <Button title="Try again" variant="soft" onPress={reload} />
        </View>
      ),
    };
  return { frame: null, data: load.data };
}

const detailLine = (learner: InsightLearner) =>
  `Grade ${learner.grade} · ${learner.streak ? `${learner.streak}-day streak` : 'No streak yet'}${learner.lastPracticeAt ? ` · Practised ${ago(learner.lastPracticeAt)}` : ''}`;

/** Student Insights (277:73): search by alias, Needs attention, All Learners. */
export function InsightsBody() {
  const { frame, data } = useReadyTeacher();
  const theme = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const view = useMemo(
    () => (data ? insights(data.report, data.classroom.grade, Date.parse(data.loadedAt)) : null),
    [data],
  );
  if (!data || !view) return <>{frame}</>;
  if (!view.all.length)
    return <Empty icon={Users} title="No Learners yet" text="Learners appear here once the LGU Admin enrols them in this Classroom." />;

  const open = (learner: InsightLearner) => router.navigate({ pathname: '/teacher/learner/[id]', params: { id: learner.id } });
  const attention = searchLearners(view.needsAttention, query);
  const all = searchLearners(view.all, query);
  return (
    <>
      <Field label="Search Learners" icon={Search} value={query} onChangeText={setQuery} placeholder="Search by alias" autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
      {!all.length ? (
        <Empty icon={Search} title="No Learner found" text={`No Learner in this Classroom has the alias "${query.trim()}".`} />
      ) : (
        <>
          {attention.length ? (
            <>
              <Eyebrow style={{ marginTop: 5 }}>{`Needs attention (${attention.length})`}</Eyebrow>
              <Card index={1} style={{ paddingVertical: 4 }}>
                {attention.map((learner) => (
                  <ListRow key={learner.id} title={learner.alias} detail={learner.attention ?? undefined} onPress={() => open(learner)}
                    right={<Pill color={tokens.state.critical}>Review</Pill>} />
                ))}
              </Card>
            </>
          ) : null}
          <Eyebrow style={{ marginTop: 5 }}>{`All Learners (${all.length})`}</Eyebrow>
          <Card index={2} style={{ paddingVertical: 4 }}>
            {all.map((learner) => (
              <ListRow key={learner.id} title={learner.alias} detail={detailLine(learner)} onPress={() => open(learner)}
                right={<T variant="titleS" color={theme.navActive}>{pct(learner.mastery)}</T>} />
            ))}
          </Card>
        </>
      )}
    </>
  );
}

/** One Learner's Mastery per Skill, weakest first. */
export function LearnerDetailBody({ learner }: { learner: LearnerDetail }) {
  const theme = useTheme();
  return (
    <>
      <Card style={{ gap: 4 }}>
        <T variant="displayL" color={theme.navActive}>{pct(learner.mastery)}</T>
        <T variant="bodyS" color={theme.muted}>{`Average Mastery · ${detailLine(learner)}`}</T>
        {learner.attention ? <Row style={{ marginTop: 6 }}><Pill color={tokens.state.critical}>{learner.attention}</Pill></Row> : null}
      </Card>
      <Eyebrow style={{ marginTop: 5 }}>Mastery by Skill</Eyebrow>
      <Card index={1} style={{ gap: 14 }}>
        {learner.skills.length ? learner.skills.map((skill) => (
          <View key={skill.code} style={{ gap: 6 }} accessible accessibilityLabel={`${skill.label}, ${skill.subjectTitle}, ${pct(skill.mastery)} Mastery`}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <T variant="titleS">{skill.label}</T>
                <T variant="bodyS" color={theme.muted}>{`${skill.subjectTitle} · ${skill.attempts} Attempts`}</T>
              </View>
              <T variant="titleS" color={skill.mastery < 0.4 ? tokens.state.critical : theme.navActive}>{pct(skill.mastery)}</T>
            </Row>
            <Row><Bar value={skill.mastery} color={skill.mastery < 0.4 ? tokens.state.critical : theme.navActive} height={6} /></Row>
          </View>
        )) : <T variant="bodyS" color={theme.muted}>Skills appear after this Learner answers their first Exercises.</T>}
      </Card>
    </>
  );
}
