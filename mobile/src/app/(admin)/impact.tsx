import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { FileText, ShieldCheck } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { escapeHtml, pct } from '@/domain/format';
import { Action, Card, Empty, Eyebrow, Info, Pill, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { tokens, useTheme } from '@/ui/theme';

export default function Impact() {
  const { snapshot, toast } = useApp();
  const theme = useTheme();
  const impact = snapshot.impact;

  if (!impact) {
    return (
      <Screen chrome title="LGU Impact Report" caption="For SEF and SK budget renewal">
        <Empty icon={FileText} title="No report yet" text="The impact report is generated from synced practice logs. Reconnect to pull the latest figures." />
      </Screen>
    );
  }

  const participation = impact.activeStudents ? impact.studentsWithPractice / impact.activeStudents : null;
  const stats = [
    { label: 'Mean estimated mastery', value: pct(impact.meanEstimatedMastery), detail: 'across learners with practice' },
    { label: 'Participation', value: pct(participation), detail: 'of active learners practising' },
    { label: 'Practice attempts', value: impact.attempts.toLocaleString(), detail: 'confirmed by the server' },
    { label: 'Schools covered', value: String(impact.schools), detail: 'in this jurisdiction' },
  ];

  const compile = async () => {
    const rows = stats.map((stat) => `<tr><td>${escapeHtml(stat.label)}</td><td class="v">${escapeHtml(stat.value)}</td><td class="d">${escapeHtml(stat.detail)}</td></tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      body{font-family:-apple-system,system-ui,sans-serif;color:#10221d;padding:40px;}
      h1{font-size:22px;margin:0 0 4px;} .sub{color:#71877d;font-size:12px;margin-bottom:24px;}
      table{width:100%;border-collapse:collapse;} td{padding:10px 8px;border-bottom:1px solid #e5dfd1;font-size:13px;}
      .v{font-weight:700;text-align:right;white-space:nowrap;} .d{color:#71877d;font-size:11px;}
      .note{margin-top:26px;padding:14px;background:#f4f0e5;border-radius:10px;color:#3c544b;font-size:11px;line-height:1.5;}
    </style></head><body>
      <h1>K-Go Quests — LGU Impact Report</h1>
      <div class="sub">Jurisdiction ${escapeHtml(impact.jurisdictionId)} · generated ${escapeHtml(new Date(impact.generatedAt).toLocaleString())}</div>
      <table>${rows}</table>
      <div class="note">${escapeHtml(impact.disclaimer)}</div>
    </body></html>`;
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'LGU Impact Report' });
    else toast('The report PDF was created but this device cannot share files.', 'info');
  };

  return (
    <Screen chrome title="LGU Impact Report" caption="For SEF and SK budget renewal">
      <Card style={{ gap: 11 }}>
        <Row>
          <T variant="titleM" style={{ flex: 1 }}>LGU impact report</T>
          <Pill color={tokens.brand.sky} tint={tokens.tint.sky}>{new Date(impact.generatedAt).toLocaleDateString()}</Pill>
        </Row>
        <T variant="bodyM" color={theme.secondary}>
          Generated from anonymised practice logs. Formatted for Local School Board and SK budget renewal hearings.
        </T>
        <Row style={{ gap: 7, flexWrap: 'wrap' }}>
          <Pill color={tokens.brand.limeDeep} tint={tokens.tint.lime}>SDG 4.1</Pill>
          <Pill color={tokens.brand.limeDeep} tint={tokens.tint.lime}>SDG 4.5</Pill>
          <Pill color={tokens.brand.grape} tint={tokens.tint.grape}>RA 7160 · SEF</Pill>
        </Row>
      </Card>

      <Row style={{ gap: 11, flexWrap: 'wrap', alignItems: 'stretch' }}>
        {stats.map((stat) => (
          <Card key={stat.label} style={{ flexGrow: 1, flexBasis: '45%', gap: 6 }}>
            <Eyebrow>{stat.label}</Eyebrow>
            <T variant="displayL" style={{ fontSize: 27, lineHeight: 31 }}>{stat.value}</T>
            <T variant="bodyS" color={theme.muted}>{stat.detail}</T>
          </Card>
        ))}
      </Row>

      <Info
        icon={ShieldCheck}
        color={tokens.state.success}
        title="What this report will not claim"
        text={impact.disclaimer}
      />

      <Info
        icon={FileText}
        color={tokens.brand.sky}
        title="Cost and hours-saved tiles are omitted"
        text="The design shows cost per learner and teacher hours returned. The server deliberately does not infer those, so showing them would be inventing figures for a budget hearing."
      />

      <Action title="Compile board packet" icon={FileText} task={compile} />
      <T variant="bodyS" color={theme.muted} style={{ textAlign: 'center' }}>
        Produces a PDF of the figures above, with the server disclaimer attached.
      </T>
    </Screen>
  );
}
