import { View } from 'react-native';
import { Tablet } from 'lucide-react-native';

import { deviceRows, deviceTiles, type DeviceStatus } from '@/domain/admin';
import { useAdminData } from '@/state/admin-data';
import { AdminSidebar, LoadGate } from '@/ui/admin';
import { Card, Empty, Eyebrow, IconTile, Pill, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { tokens, useTheme } from '@/ui/theme';

const CHIP: Record<DeviceStatus, { color: string; tint: string }> = {
  Online: { color: tokens.state.success, tint: tokens.tint.success },
  'Needs update': { color: tokens.state.warning, tint: tokens.tint.warning },
  'Needs Update': { color: tokens.state.warning, tint: tokens.tint.warning },
  Offline: { color: tokens.state.critical, tint: tokens.tint.warning },
};

/** Device Management (277:439). */
export default function Devices() {
  const load = useAdminData();
  const theme = useTheme();
  return (
    <Screen chrome title="Device Management" menu={AdminSidebar}>
      <LoadGate load={load}>
        {({ data }) => {
          if (!data.devices.length)
            return <Empty icon={Tablet} title="No Shared Tablets yet" text="Shared Tablets appear here once they report to the school server." />;
          return (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
                {deviceTiles(data.devices).map((tile, i) => (
                  <Card key={tile.key} index={i} style={{ flexBasis: '30%', flexGrow: 1 }}>
                    <View accessible accessibilityLabel={`${tile.label}: ${tile.value}`} style={{ gap: 2 }}>
                      <T variant="displayL" color={tile.tone === 'warning' ? tokens.state.warning : theme.navActive}>{tile.value}</T>
                      <T variant="bodyS" color={theme.muted}>{tile.label}</T>
                    </View>
                  </Card>
                ))}
              </View>
              <Eyebrow>Shared Tablets</Eyebrow>
              {deviceRows(data.devices).map((row, i) => (
                <Card key={row.id} index={Math.min(i, 8) + 3} accessibilityLabel={`${row.name}, ${row.context}, ${row.detail}, ${row.status}`}>
                  <Row>
                    <IconTile icon={Tablet} color={theme.navActive} tint={tokens.tint.forestBright} />
                    <View style={{ flex: 1 }}>
                      <T variant="titleS">{row.name}</T>
                      <T variant="bodyS" color={theme.muted}>{row.context}</T>
                      <T variant="bodyS" color={theme.muted}>{row.detail}</T>
                    </View>
                    <Pill color={CHIP[row.status].color} tint={CHIP[row.status].tint}>{row.status}</Pill>
                  </Row>
                </Card>
              ))}
            </>
          );
        }}
      </LoadGate>
    </Screen>
  );
}
