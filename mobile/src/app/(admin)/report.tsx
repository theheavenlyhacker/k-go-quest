import { useState } from 'react';
import { View } from 'react-native';
import { Download, TrendingUp } from 'lucide-react-native';

import { impactReport, quarterOptions } from '@/domain/admin';
import { useAdminData } from '@/state/admin-data';
import { AdminSidebar, ComingSoonSheet, LoadGate } from '@/ui/admin';
import { Bar, Button, Card, Empty, Eyebrow, Pills, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { tokens, useTheme } from '@/ui/theme';

/** LGU Impact Report (277:382). */
export default function Report() {
  const load = useAdminData();
  const theme = useTheme();
  const [picked, setPicked] = useState<string | null>(null);
  const [soon, setSoon] = useState(false);
  return (
    <Screen chrome title="LGU Impact Report" menu={AdminSidebar}>
      <LoadGate load={load}>
        {({ data, today }) => {
          const options = quarterOptions(data.reach, today);
          const quarter = options.some((o) => o.value === picked) ? picked! : options[0].value;
          const { tiles, barangays } = impactReport(data.reach, quarter);
          return (
            <>
              <Pills items={options.slice(0, 4)} value={quarter} onChange={setPicked} />
              {barangays.length === 0 ? (
                <Empty icon={TrendingUp} title="No reach recorded" text="No Learners practised in this quarter. Pick another quarter." />
              ) : (
                <>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
                    {tiles.map((tile, i) => (
                      <Card key={tile.key} index={i} style={{ flexBasis: '47%', flexGrow: 1 }}>
                        <View accessible accessibilityLabel={`${tile.label}: ${tile.value}`} style={{ gap: 2 }}>
                          <T variant="displayL" color={tile.tone === 'warning' ? tokens.state.warning : theme.navActive}>{tile.value}</T>
                          <T variant="bodyS" color={theme.muted}>{tile.label}</T>
                        </View>
                      </Card>
                    ))}
                  </View>
                  <Eyebrow>Reach by barangay</Eyebrow>
                  <Card index={4} style={{ gap: 14 }}>
                    {barangays.map((b) => (
                      <View key={b.name} accessible accessibilityLabel={`${b.name}: ${b.learners} Learners`} style={{ gap: 6 }}>
                        <Row>
                          <T variant="titleS" style={{ flex: 1 }}>{b.name}</T>
                          <T variant="bodyS" color={theme.muted}>{b.learners.toLocaleString('en-US')}</T>
                        </Row>
                        <Bar value={b.share} color={theme.navActive} />
                      </View>
                    ))}
                  </Card>
                  <T variant="bodyS" color={theme.muted}>{data.impact.disclaimer}</T>
                </>
              )}
              <Button title="Export PDF Report" variant="soft" icon={Download} onPress={() => setSoon(true)} />
              <ComingSoonSheet feature={soon ? 'Export PDF Report' : null} onClose={() => setSoon(false)} />
            </>
          );
        }}
      </LoadGate>
    </Screen>
  );
}
