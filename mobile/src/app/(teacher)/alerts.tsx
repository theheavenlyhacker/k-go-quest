import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { CloudOff, Info as InfoIcon, ShieldCheck, TriangleAlert } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { ago, initials } from '@/domain/format';
import { Card, Empty, Eyebrow, Info, Pill, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { radius, tokens, useTheme } from '@/ui/theme';

export default function Alerts() {
  const { snapshot, classroomId } = useApp();
  const theme = useTheme();
  const router = useRouter();

  const classroom = snapshot.classrooms.find((item) => item.id === classroomId) ?? snapshot.classrooms[0];
  const report = snapshot.reports.find((item) => item.classroomId === classroom?.id);
  const learners = report?.learners ?? [];
  const flagged = learners.filter((learner) => learner.learningStatus === 'TEACHER_REVIEW_SUGGESTED');
  const stale = learners.filter((learner) => learner.connectivityStatus === 'NO_RECENT_SYNC');

  return (
    <Screen chrome title="Safeguard & Alerts" caption={classroom?.name ?? 'No class assigned'}>
      <Info
        icon={InfoIcon}
        color={tokens.brand.sky}
        title="Rule-based signals only"
        text="These come from practice data: sustained low mastery, and devices that have not synced. Message safeguarding is designed but has no API behind it yet."
      />

      {flagged.length ? (
        <>
          <Eyebrow>Learning signals</Eyebrow>
          {flagged.map((learner, index) => (
            <Card key={learner.id} index={index} onPress={() => router.push({ pathname: '/learner', params: { id: learner.id } })} style={{ backgroundColor: `${tokens.state.critical}0A`, borderColor: `${tokens.state.critical}3D` }}>
              <Row style={{ gap: 11, alignItems: 'flex-start' }}>
                <View style={{ width: 34, height: 34, borderRadius: radius.sm, backgroundColor: `${tokens.state.critical}1A`, alignItems: 'center', justifyContent: 'center' }}>
                  <TriangleAlert size={17} color={tokens.state.critical} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <T variant="titleS">{learner.alias}</T>
                  <T variant="bodyS" color={theme.secondary}>{learner.reason ?? 'Sustained practice with low estimated mastery.'}</T>
                </View>
                <Pill color={tokens.state.critical} tint={`${tokens.state.critical}1A`}>Review</Pill>
              </Row>
            </Card>
          ))}
        </>
      ) : null}

      {stale.length ? (
        <>
          <Eyebrow>Connectivity</Eyebrow>
          {stale.map((learner, index) => (
            <Card key={learner.id} index={index} onPress={() => router.push({ pathname: '/learner', params: { id: learner.id } })}>
              <Row style={{ gap: 11 }}>
                <View style={{ width: 34, height: 34, borderRadius: radius.sm, backgroundColor: tokens.tint.sun, alignItems: 'center', justifyContent: 'center' }}>
                  <CloudOff size={17} color={tokens.brand.sunDeep} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="titleS">{learner.alias}</T>
                  <T variant="bodyS" color={theme.muted}>{`Last sync ${ago(learner.lastSyncAt).toLowerCase()}`}</T>
                </View>
                <View style={{ width: 30, height: 30, borderRadius: radius.sm, backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                  <T variant="bodyS" color={theme.muted}>{initials(learner.alias)}</T>
                </View>
              </Row>
            </Card>
          ))}
        </>
      ) : null}

      {!flagged.length && !stale.length ? (
        <Empty icon={ShieldCheck} title="Nothing needs you right now" text="No learner has triggered a review rule, and every device in this class has synced recently." />
      ) : null}
    </Screen>
  );
}
