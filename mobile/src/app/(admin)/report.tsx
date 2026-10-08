import { useState } from 'react';
import { View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Download, TrendingUp } from 'lucide-react-native';

import { quarterOptions } from '@/domain/admin';
import { formatImpactReport, impactReportHtml } from '@/domain/impact-report';
import { useAdminData } from '@/state/admin-data';
import { AdminSidebar, LoadGate } from '@/ui/admin';
import { Action, Bar, Card, Empty, Eyebrow, Pills, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { tokens, useTheme } from '@/ui/theme';

/** LGU Impact Report (277:382). */
export default function Report() {
  const load = useAdminData();
  const theme = useTheme();
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <Screen chrome title="LGU Impact Report" menu={AdminSidebar}>
      <LoadGate load={load}>
        {({ data, today }) => {
          const options = quarterOptions([
            ...data.reach,
            ...(data.impactReports ?? []).flatMap((r) => r.quarter ? [{ quarter: r.quarter }] : []),
          ], today);
          const quarter = options.some((o) => o.value === picked) ? picked! : options[0].value;
          const report = data.impactReports?.find((r) => r.quarter === quarter)
            ?? (data.impact.quarter === quarter ? data.impact : null);
          const view = report ? formatImpactReport(report) : null;
          const { tiles, barangays } = view ?? { tiles: [], barangays: [] };
          return (
            <>
              {view && <T variant="bodyS" color={theme.muted}>Jurisdiction: {view.jurisdiction} · {view.quarter}</T>}
              <Pills items={options.slice(0, 4)} value={quarter} onChange={setPicked} />
              {!view ? <Empty icon={TrendingUp} title="Report unavailable" text="Reload to fetch this quarter’s report." /> : (
                <>
                  {barangays.length === 0 && (
                    <Empty icon={TrendingUp} title="No barangay reach recorded" text="No reach by barangay is recorded in this quarter. Pick another quarter." />
                  )}
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
                </>
              )}
              <T variant="bodyS" color={theme.muted}>{view?.disclaimer ?? data.impact.disclaimer}</T>
              <T variant="bodyS" color={theme.muted}>{view?.dataQuality ?? 'Data quality: No report available for this quarter.'}</T>
              <Action title="Export PDF Report" variant="soft" icon={Download} disabled={!view} task={async () => {
                if (!view) return;
                if (!(await Sharing.isAvailableAsync())) throw new Error('PDF sharing is unavailable on this device.');
                const { uri } = await Print.printToFileAsync({ html: impactReportHtml(view) });
                await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: '.pdf', dialogTitle: 'Share LGU Impact Report' });
              }} />
            </>
          );
        }}
      </LoadGate>
    </Screen>
  );
}
