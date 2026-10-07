import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CloudOff, Star, Users } from 'lucide-react-native';

import { classOverview } from '../domain/teacher';
import { pct } from '../domain/format';
import { useTeacher } from '../state/teacher-context';
import { Bar, Button, Card, Empty, Eyebrow, IconTile, Info, Row, T } from './primitives';
import { tokens, useTheme } from './theme';

/** Class Overview (277:10): tiles, Subject bars, today's highlight. */
export function ClassOverviewBody() {
  const { load, reload } = useTeacher();
  const theme = useTheme();
  const router = useRouter();

  if (load.status === 'loading')
    return (
      <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
        <ActivityIndicator accessibilityLabel="Loading your Classroom" color={theme.navActive} />
        <T variant="bodyS" color={theme.muted}>Loading your Classroom...</T>
      </Card>
    );
  if (load.status === 'error')
    return (
      <View style={{ gap: 11 }}>
        <Info icon={CloudOff} color={tokens.state.critical} title="Could not load your Classroom" text={load.message} />
        <Button title="Try again" variant="soft" onPress={reload} />
      </View>
    );

  const view = classOverview(load.data.report);
  if (!view.tiles.learners)
    return <Empty icon={Users} title="No Learners yet" text="Learners appear here once the LGU Admin enrols them in this Classroom." />;

  const tiles = [
    { value: `${view.tiles.learners}`, label: 'Learners', color: theme.navActive },
    { value: pct(view.tiles.averageMastery), label: 'Avg Mastery', color: theme.navActive },
    { value: `${view.tiles.needHelp}`, label: 'Need help', color: tokens.state.critical },
  ];
  return (
    <>
      <Row style={{ gap: 10, alignItems: 'stretch' }}>
        {tiles.map((tile, index) => (
          <Card key={tile.label} index={index} style={{ flex: 1, gap: 2, padding: 12 }}>
            <View accessible accessibilityLabel={`${tile.value} ${tile.label}`}>
              <T variant="displayL" color={tile.color}>{tile.value}</T>
              <T variant="bodyS" color={theme.muted}>{tile.label}</T>
            </View>
          </Card>
        ))}
      </Row>

      <Eyebrow style={{ marginTop: 5 }}>Subject progress</Eyebrow>
      <Card index={3} style={{ gap: 14 }}>
        {view.subjects.length ? view.subjects.map((bar) => (
          <View key={bar.subject} style={{ gap: 6 }} accessible accessibilityLabel={`${bar.title}, ${pct(bar.mastery)} Mastery`}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="titleS">{bar.title}</T>
              <T variant="titleS" color={theme.navActive}>{pct(bar.mastery)}</T>
            </Row>
            <Row><Bar value={bar.mastery} color={theme.navActive} height={6} /></Row>
          </View>
        )) : <T variant="bodyS" color={theme.muted}>Subject progress appears after your Learners answer their first Exercises.</T>}
      </Card>

      <Eyebrow style={{ marginTop: 5 }}>Today&apos;s highlights</Eyebrow>
      <Card index={4} style={{ gap: 12 }}>
        {view.highlight ? (
          <Row style={{ gap: 10 }}>
            <IconTile icon={Star} color={tokens.brand.sun} tint={tokens.tint.sun} size={40} />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="titleS">{`Top Mastery: ${view.highlight.alias}`}</T>
              <T variant="bodyS" color={theme.muted}>{`${pct(view.highlight.mastery)} Mastery. Great job!`}</T>
            </View>
          </Row>
        ) : <T variant="bodyS" color={theme.muted}>Highlights appear once a Learner has Mastery to celebrate.</T>}
        <Button title="View Learner Insights" onPress={() => router.navigate('/teacher/insights')} />
      </Card>
    </>
  );
}
