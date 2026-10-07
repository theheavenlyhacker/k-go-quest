import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Folder, Tablet, TrendingUp, Users } from 'lucide-react-native';

import { engagementSeries, dashboardTiles } from '@/domain/admin';
import { useAdminData } from '@/state/admin-data';
import { AdminSidebar, LoadGate } from '@/ui/admin';
import { Card, Empty, Eyebrow, ListRow, Pill, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { tokens, useTheme } from '@/ui/theme';

const LINKS = [
  { name: 'report', label: 'LGU Impact Report', icon: TrendingUp },
  { name: 'devices', label: 'Device Management', icon: Tablet },
  { name: 'content', label: 'Content Management', icon: Folder },
  { name: 'users', label: 'User Management', icon: Users },
] as const;

const CHART_HEIGHT = 110;

/** School Dashboard (277:325). */
export default function Dashboard() {
  const load = useAdminData();
  const router = useRouter();
  const theme = useTheme();
  const schoolName = load.status === 'ready' ? load.data.schoolName : undefined;
  const teachers = load.status === 'ready' ? load.data.users.filter((u) => u.role === 'TEACHER' && u.active !== false).length : undefined;
  return (
    <Screen
      chrome
      title="School Dashboard"
      caption={schoolName}
      menu={(props) => <AdminSidebar {...props} schoolName={schoolName} teachers={teachers} />}
    >
      <LoadGate load={load}>
        {({ data, today }) => {
          if (!data.impact.activeStudents)
            return <Empty icon={Users} title="No Learners yet" text="Once Learners are enrolled and practising, the school's numbers appear here." />;
          const engagement = engagementSeries(data.engagement, today);
          const change = engagement.changePercent;
          return (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
                {dashboardTiles(data).map((tile, i) => (
                  <Card key={tile.key} index={i} style={{ flexBasis: '47%', flexGrow: 1 }}>
                    <View accessible accessibilityLabel={`${tile.label}: ${tile.value}`} style={{ gap: 2 }}>
                      <T variant="displayL" color={tile.tone === 'warning' ? tokens.state.warning : theme.navActive}>{tile.value}</T>
                      <T variant="bodyS" color={theme.muted}>{tile.label}</T>
                    </View>
                  </Card>
                ))}
              </View>

              <Eyebrow>Weekly engagement</Eyebrow>
              <Card index={4} style={{ gap: 14 }}>
                <Row>
                  <T variant="titleM" style={{ flex: 1 }}>Active Learners</T>
                  {change === null ? null : (
                    <Pill color={change >= 0 ? tokens.state.success : tokens.state.critical} tint={change >= 0 ? tokens.tint.success : tokens.tint.warning}>
                      {`${change >= 0 ? '+' : ''}${change}% on last week`}
                    </Pill>
                  )}
                </Row>
                <View
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={`Active Learners this week: ${engagement.bars.map((b) => `${b.label} ${b.value}`).join(', ')}`}
                  style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: CHART_HEIGHT + 20 }}
                >
                  {engagement.bars.map((bar, i) => (
                    <View key={bar.date} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                      <Animated.View
                        entering={FadeIn.delay(i * 45).duration(260)}
                        style={{ width: 22, height: Math.max(4, bar.height * CHART_HEIGHT), borderRadius: 6, backgroundColor: bar.today ? theme.navActive : `${theme.navActive}40` }}
                      />
                      <T variant="labelNav" color={bar.today ? theme.text : theme.muted}>{bar.label}</T>
                    </View>
                  ))}
                </View>
              </Card>

              <Eyebrow>Quick links</Eyebrow>
              <Card index={5} style={{ paddingVertical: 4 }}>
                {LINKS.map((link) => (
                  <ListRow key={link.name} title={link.label} icon={link.icon} onPress={() => router.navigate(`/${link.name}`)} />
                ))}
              </Card>
            </>
          );
        }}
      </LoadGate>
    </Screen>
  );
}
