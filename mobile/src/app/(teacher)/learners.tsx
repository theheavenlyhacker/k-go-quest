import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { ago, initials, meanMastery, pct } from '@/domain/format';
import { Bar, Card, Empty, Eyebrow, Pill, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { radius, tokens, useTheme } from '@/ui/theme';
import { band } from './class';

export default function Learners() {
  const { snapshot, classroomId } = useApp();
  const theme = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const classroom = snapshot.classrooms.find((item) => item.id === classroomId) ?? snapshot.classrooms[0];
  const report = snapshot.reports.find((item) => item.classroomId === classroom?.id);
  const learners = (report?.learners ?? [])
    .map((learner) => ({ learner, mastery: meanMastery(learner.skills) }))
    // Risk first: flagged, then stale, then lowest estimate.
    .sort((a, b) => {
      const risk = (item: typeof a) =>
        (item.learner.learningStatus === 'TEACHER_REVIEW_SUGGESTED' ? 0 : item.learner.connectivityStatus === 'NO_RECENT_SYNC' ? 1 : 2);
      return risk(a) - risk(b) || (a.mastery ?? 0) - (b.mastery ?? 0);
    })
    .filter(({ learner }) => learner.alias.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Screen chrome title="Student Insights" caption="Growth, risk and next actions">
      <Row style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: radius.sm, paddingHorizontal: 13, minHeight: 47, gap: 10 }}>
        <Search size={17} color={theme.muted} />
        <TextInput
          accessibilityLabel="Search learners"
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${report?.learners.length ?? 0} learners`}
          placeholderTextColor={theme.muted}
          style={{ flex: 1, color: theme.text, fontFamily: 'PublicSans_400Regular', fontSize: 13, paddingVertical: 12 }}
        />
      </Row>

      <Eyebrow>Ranked by risk, not by score</Eyebrow>

      {learners.length ? learners.map(({ learner, mastery }, index) => {
        const tone = band(mastery);
        const flagged = learner.learningStatus === 'TEACHER_REVIEW_SUGGESTED';
        const stale = learner.connectivityStatus === 'NO_RECENT_SYNC';
        return (
          <Card key={learner.id} index={index} onPress={() => router.push({ pathname: '/learner', params: { id: learner.id } })} style={{ gap: 9 }}>
            <Row style={{ gap: 11 }}>
              <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <T variant="titleS" color={theme.muted}>{initials(learner.alias)}</T>
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <T variant="titleS" lines={1}>{learner.alias}</T>
                <T variant="bodyS" color={theme.muted}>{classroom?.name ?? ''}</T>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <T variant="titleS">{pct(mastery)}</T>
                {flagged ? (
                  <Pill color={tokens.state.critical} tint={`${tokens.state.critical}1A`}>Review</Pill>
                ) : stale ? (
                  <Pill color={tokens.brand.sunDeep} tint={tokens.tint.sun}>No sync</Pill>
                ) : (
                  <Pill color={tokens.state.success} tint={tokens.tint.success}>On track</Pill>
                )}
              </View>
            </Row>
            <Bar value={mastery ?? 0} color={tone.color} />
            <T variant="bodyS" color={theme.secondary}>
              {learner.reason ?? (stale ? `No sync for a while — last seen ${ago(learner.lastSyncAt).toLowerCase()}` : learner.skills.length ? 'On track — no rule triggered' : 'No practice data yet')}
            </T>
          </Card>
        );
      }) : (
        <Empty title="No learners match" text={query ? 'Try a different name.' : 'Once learners are enrolled and have synced, they appear here ranked by risk.'} />
      )}
    </Screen>
  );
}
