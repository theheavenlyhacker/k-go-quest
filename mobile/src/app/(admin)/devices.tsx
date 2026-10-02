import { View } from 'react-native';
import { Info as InfoIcon, ScrollText, Smartphone } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { ago } from '@/domain/format';
import { Card, Empty, Eyebrow, IconTile, Info, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { radius, tokens, useTheme } from '@/ui/theme';

/** Audit actions carry their own colour so a scan reads at a glance. */
const toneFor = (action: string) => {
  if (action.startsWith('AUTH') || action.includes('PASSWORD')) return { color: tokens.brand.sky, tint: tokens.tint.sky };
  if (action.includes('VOUCHER') || action.includes('REWARD')) return { color: tokens.brand.sunDeep, tint: tokens.tint.sun };
  if (action.includes('PUBLISH') || action.includes('CONTENT') || action.includes('LESSON') || action.includes('EXERCISE')) return { color: tokens.brand.grape, tint: tokens.tint.grape };
  return { color: tokens.brand.limeDeep, tint: tokens.tint.limeDeep };
};

export default function Devices() {
  const { snapshot } = useApp();
  const theme = useTheme();
  const audit = snapshot.audit;

  return (
    <Screen chrome title="Device Management" caption="Activity trail across your jurisdiction">
      <Info
        icon={InfoIcon}
        color={tokens.brand.sky}
        title="No device registry yet"
        text="The design lists tablets, their cached packs and push state. The server records a deviceId on each session but has no devices table, so there is nothing to list. What it does keep is the audit trail below."
      />

      <Eyebrow>Audit trail</Eyebrow>
      {audit.length ? audit.map((event, index) => {
        const tone = toneFor(event.action);
        return (
          <Card key={event.id} index={index}>
            <Row style={{ gap: 11 }}>
              <IconTile icon={ScrollText} color={tone.color} tint={tone.tint} size={34} />
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="titleS">{event.action.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}</T>
                <T variant="dataS" color={theme.muted}>{ago(event.createdAt)}</T>
              </View>
              {event.targetId ? (
                <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: theme.surfaceAlt }}>
                  <T variant="dataS" color={theme.muted}>{event.targetId.slice(0, 6)}</T>
                </View>
              ) : null}
            </Row>
          </Card>
        );
      }) : (
        <Empty icon={Smartphone} title="No audit events yet" text="Every sign-in, publish and voucher issue is recorded here once activity starts." />
      )}

      {audit.length ? (
        <T variant="bodyS" color={theme.muted}>
          {`Showing the ${audit.length} most recent events. Audit records are never deleted by the app.`}
        </T>
      ) : null}
    </Screen>
  );
}
