import { useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';

import { alerts, type AlertPriority } from '../domain/teacher';
import { useTeacher } from '../state/teacher-context';
import { Button, Card, Empty, Eyebrow, Pill, Row, T } from './primitives';
import { useReadyTeacher } from './teacher-insights';
import { tokens, useTheme } from './theme';

const chip: Record<AlertPriority, { label: string; color: string }> = {
  high: { label: 'High priority', color: tokens.state.critical },
  medium: { label: 'Medium priority', color: tokens.state.warning },
  low: { label: 'Low priority', color: tokens.brand.sky },
};

/** Alerts (277:136): tiles and a card per open alert; Review opens the Learner, Resolve dismisses it here only. */
export function AlertsBody() {
  const { frame, data } = useReadyTeacher();
  const { resolved, resolve } = useTeacher();
  const theme = useTheme();
  const router = useRouter();
  const view = useMemo(() => (data ? alerts(data.report, Date.parse(data.loadedAt), resolved) : null), [data, resolved]);
  if (!data || !view) return <>{frame}</>;

  const tiles = [
    { value: view.tiles.open, label: 'Open alerts', color: theme.navActive },
    { value: view.tiles.resolved, label: 'Resolved (7 days)', color: theme.navActive },
    { value: view.tiles.high, label: 'High priority', color: tokens.state.critical },
  ];
  return (
    <>
      <Row style={{ gap: 10, alignItems: 'stretch' }}>
        {tiles.map((tile, index) => (
          <Card key={tile.label} index={index} style={{ flex: 1, gap: 2, padding: 12 }}>
            <View accessible accessibilityLabel={`${tile.value} ${tile.label}`}>
              <T variant="displayL" color={tile.color}>{`${tile.value}`}</T>
              <T variant="bodyS" color={theme.muted}>{tile.label}</T>
            </View>
          </Card>
        ))}
      </Row>
      {view.open.length ? (
        <>
          <Eyebrow style={{ marginTop: 5 }}>{`Open alerts (${view.open.length})`}</Eyebrow>
          {view.open.map((alert, index) => (
            <Card key={alert.id} index={index + 3} style={{ gap: 8 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Pill color={chip[alert.priority].color}>{chip[alert.priority].label}</Pill>
                <T variant="bodyS" color={theme.muted}>{alert.relative}</T>
              </Row>
              <T variant="titleS">{alert.title}</T>
              <T variant="bodyS" color={theme.muted}>{alert.description}</T>
              <Row style={{ gap: 10 }}>
                <Button title="Review" style={{ flex: 1 }} accessibilityLabel={`Review ${alert.title}`} onPress={() => router.navigate({ pathname: '/teacher/learner/[id]', params: { id: alert.learnerId } })} />
                <Button title="Resolve" variant="outline" style={{ flex: 1 }} accessibilityLabel={`Resolve ${alert.title}`} onPress={() => resolve(alert.id)} />
              </Row>
            </Card>
          ))}
        </>
      ) : (
        <Empty icon={ShieldCheck} title="All clear" text="No open alerts. Plateau Flags and Learners who have not synced will appear here." />
      )}
    </>
  );
}
