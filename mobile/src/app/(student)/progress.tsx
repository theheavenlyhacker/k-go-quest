import { View } from 'react-native';
import { Flame, RefreshCw, TriangleAlert } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { meanMastery, pct } from '@/domain/format';
import type { Subject } from '@/domain/types';
import { subjects, subjectTitles, subjectTopics } from '@/data/preview';
import { Action, Bar, Card, Empty, Eyebrow, Pill, Ring, Row, T, Trend } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { subjectTheme, tokens, useTheme } from '@/ui/theme';

export default function Progress() {
  const { snapshot, queued, sync } = useApp();
  const theme = useTheme();
  const skills = snapshot.progress?.skills ?? [];
  const overall = meanMastery(skills);
  const history = snapshot.history;
  const delta = history.length > 1 ? Math.round((history[history.length - 1].mastery - history[0].mastery) * 100) : null;
  const pending = queued.filter((item) => item.state === 'PENDING');

  const bySubject = subjects
    .map((subject: Subject) => ({ subject, value: meanMastery(skills.filter((skill) => skill.subject === subject)) }))
    .filter((row): row is { subject: Subject; value: number } => row.value !== null);

  // Same rule the server reports: sustained practice with low estimated mastery.
  const flagged = skills.find((skill) => skill.attempts >= 5 && skill.mastery < 0.4);

  return (
    <Screen chrome title="My Progress" caption="Individual Mastery Delta">
      {overall === null ? (
        <Empty title="No practice data yet" text="Answer a few questions in the Offline Library. Your mastery delta appears here after the first sync." />
      ) : (
        <>
          <Card style={{ gap: 12 }}>
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 8 }}>
                <Eyebrow>Mastery this quarter</Eyebrow>
                <T variant="displayL" style={{ fontSize: 34, lineHeight: 38 }}>{pct(overall)}</T>
                {delta !== null ? (
                  <Pill color={tokens.state.success} tint={tokens.tint.lime}>
                    {`${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)} pts since your first sync`}
                  </Pill>
                ) : null}
              </View>
              <Ring value={overall} size={62} color={tokens.brand.limeDeep} />
            </Row>
            <Trend values={history.map((point) => point.mastery)} />
            <T variant="bodyS" color={theme.muted}>
              {history.length > 1
                ? `${history.length} snapshots of Individual Mastery Delta. Gaps are periods you practised offline before syncing.`
                : 'Your trend line appears once you have synced a few times.'}
            </T>
          </Card>

          <Eyebrow>By subject</Eyebrow>
          <Card style={{ gap: 14 }}>
            {bySubject.map((row) => {
              const tone = subjectTheme[row.subject];
              return (
                <View key={row.subject} style={{ gap: 7 }}>
                  <Row style={{ gap: 11 }}>
                    <Ring value={row.value} size={38} color={tone.brand} />
                    <View style={{ flex: 1, gap: 1 }}>
                      <T variant="titleS">{`${subjectTitles[row.subject]} 5`}</T>
                      <T variant="bodyS" color={theme.muted}>{subjectTopics[row.subject]}</T>
                    </View>
                  </Row>
                  <Bar value={row.value} color={tone.brand} />
                </View>
              );
            })}
          </Card>
        </>
      )}

      {flagged ? (
        <Card style={{ backgroundColor: tokens.tint.sunDeep, borderColor: `${tokens.state.warning}55` }}>
          <Row style={{ alignItems: 'flex-start', gap: 12 }}>
            <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
              <TriangleAlert size={19} color={tokens.state.warning} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <T variant="titleS">{`${subjectTitles[flagged.subject]} plateau flagged`}</T>
              <T variant="bodyS" color={theme.secondary}>
                {`${flagged.attempts} attempts on ${flagged.skillCode} with estimated mastery at ${pct(flagged.mastery)}. Your teacher sees this signal and decides what to do next.`}
              </T>
            </View>
          </Row>
        </Card>
      ) : null}

      {pending.length ? (
        <Card style={{ gap: 10 }}>
          <Row style={{ gap: 9 }}>
            <Flame size={17} color={tokens.brand.sunDeep} />
            <T variant="titleS" style={{ flex: 1 }}>{`${pending.length} answer${pending.length === 1 ? '' : 's'} waiting`}</T>
          </Row>
          <T variant="bodyS" color={theme.muted}>They are saved on this device and count once the school server confirms them.</T>
          <Action title="Sync now" icon={RefreshCw} variant="soft" task={sync} />
        </Card>
      ) : null}

      {snapshot.progress ? (
        <T variant="bodyS" color={theme.muted}>
          {`Estimates from ${snapshot.progress.model.version} — a practice signal, not a graded assessment.`}
        </T>
      ) : null}
    </Screen>
  );
}
