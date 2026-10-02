import { View } from 'react-native';
import { Award, Gift, Trophy } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { Bar, Card, Empty, Eyebrow, IconTile, Pill, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { radius, tokens, useTheme } from '@/ui/theme';

export default function Grow() {
  const { snapshot, classroomId } = useApp();
  const theme = useTheme();

  const classroom = snapshot.classrooms.find((item) => item.id === classroomId) ?? snapshot.classrooms[0];
  const standing = snapshot.league?.items.find((row) => row.classroomId === classroom?.id);

  return (
    <Screen chrome title="Rewards & Credentials" caption="Micro-credentials and grants">
      {standing ? (
        <Card style={{ backgroundColor: '#0c4a3e', borderColor: '#0c4a3e', gap: 12 }}>
          <Row style={{ gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
              <Trophy size={21} color={tokens.brand.limeDeep} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="titleM" color="#ffffff">{`League rank #${standing.rank}`}</T>
              <T variant="bodyS" color="#ffffff" style={{ opacity: 0.72 }}>{`${classroom?.name} · ${snapshot.league?.month ?? ''}`}</T>
            </View>
          </Row>
          <Row style={{ gap: 9 }}>
            <T variant="bodyS" color="#ffffff" style={{ flex: 1, opacity: 0.84 }}>
              {`${standing.participatingLearners} of ${standing.enrolledLearners} learners practising`}
            </T>
            <T variant="dataS" color="#ffffff">{`+${standing.growthPercentagePoints.toFixed(1)} pts`}</T>
          </Row>
          <Bar value={standing.enrolledLearners ? standing.participatingLearners / standing.enrolledLearners : 0} color={tokens.brand.limeDeep} />
        </Card>
      ) : null}

      <Eyebrow>Micro-credentials</Eyebrow>
      <Empty
        icon={Award}
        title="No credentials API yet"
        text="Teacher micro-credentials and classroom technology grants are designed but have no endpoint behind them. Nothing here is invented — this fills in once the server exposes them."
      />

      <Eyebrow>Reward catalogue for your learners</Eyebrow>
      {snapshot.rewards.length ? snapshot.rewards.map((reward, index) => (
        <Card key={reward.id} index={index}>
          <Row style={{ gap: 11 }}>
            <IconTile icon={Gift} color={tokens.brand.limeDeep} tint={tokens.tint.limeDeep} />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="titleS">{reward.title}</T>
              <T variant="bodyS" color={theme.muted}>{reward.stock > 0 ? `${reward.stock} left at the hub` : 'Out of stock'}</T>
            </View>
            <Pill color={tokens.brand.sunDeep} tint={tokens.tint.sun}>{`${reward.cost} KC`}</Pill>
          </Row>
        </Card>
      )) : (
        <T variant="bodyS" color={theme.muted}>Your LGU has not published any rewards yet.</T>
      )}
    </Screen>
  );
}
