import { useState } from 'react';
import { View } from 'react-native';
import { Shield, Sparkles } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { initials } from '@/domain/format';
import type { LeagueRow } from '@/domain/types';
import { Card, Empty, Eyebrow, Pill, Pills, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { radius, tokens, useTheme } from '@/ui/theme';

type Scope = 'school' | 'grade' | 'division';
const scopes = [
  { label: 'Barangay', value: 'school' as const },
  { label: 'Grade', value: 'grade' as const },
  { label: 'Division', value: 'division' as const },
];
const podiumTone = [tokens.brand.sunDeep, tokens.brand.sky, tokens.state.critical];

export default function League() {
  const { snapshot } = useApp();
  const theme = useTheme();
  const [scope, setScope] = useState<Scope>('school');

  const league = snapshot.league;
  const mine = snapshot.classrooms[0];
  const rows: LeagueRow[] = (league?.items ?? []).filter((row) => {
    if (scope === 'grade') return !mine || row.grade === mine.grade;
    if (scope === 'school') return !mine || snapshot.classrooms.some((classroom) => classroom.id === row.classroomId) || row.grade === mine.grade;
    return true;
  });
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  if (!league?.items.length) {
    return (
      <Screen chrome title="Monthly League" caption="Not synced yet">
        <Empty title="No standings yet" text="Classroom standings appear once your school has synced a month of practice." />
      </Screen>
    );
  }

  return (
    <Screen chrome title="Monthly League" caption={`${league.month} · ${league.timezone}`}>
      <Pills items={scopes} value={scope} onChange={setScope} />

      {podium.length ? (
        <Row style={{ gap: 9, alignItems: 'stretch' }}>
          {[podium[1], podium[0], podium[2]].filter(Boolean).map((row) => {
            const place = rows.indexOf(row);
            const tone = podiumTone[place] ?? theme.muted;
            const leader = place === 0;
            return (
              <Card key={row.classroomId} style={{ flex: 1, alignItems: 'center', gap: 5, paddingVertical: 14, paddingHorizontal: 8, borderColor: leader ? tone : theme.border, borderWidth: leader ? 1.6 : 1 }}>
                <T variant="dataS" color={tone}>{`${place + 1}${['st', 'nd', 'rd'][place] ?? 'th'}`}</T>
                <Shield size={19} color={tone} />
                <T variant="titleS" lines={1} style={{ textAlign: 'center' }}>{row.name}</T>
                <T variant="dataS" color={tone}>{`+${row.growthPercentagePoints.toFixed(1)} pts`}</T>
              </Card>
            );
          })}
        </Row>
      ) : null}

      <Card style={{ backgroundColor: tokens.tint.lime, borderColor: `${tokens.brand.limeDeep}45` }}>
        <Row style={{ alignItems: 'flex-start', gap: 10 }}>
          <Sparkles size={17} color={tokens.brand.limeDeep} />
          <T variant="bodyS" color={theme.secondary} style={{ flex: 1 }}>
            Growth-Delta ranking: your class climbs on how much each learner improves, not on who was already ahead.
          </T>
        </Row>
      </Card>

      <Eyebrow>Standings · mastery delta</Eyebrow>
      {rest.length ? rest.map((row, index) => {
        const isMine = mine?.id === row.classroomId;
        return (
          <Card
            key={row.classroomId}
            index={index}
            style={isMine ? { backgroundColor: tokens.tint.sun, borderColor: `${tokens.brand.sun}90`, borderWidth: 1.6 } : undefined}
          >
            <Row style={{ gap: 11 }}>
              <T variant="dataS" color={theme.muted} style={{ width: 14 }}>{row.rank}</T>
              <View style={{ width: 34, height: 34, borderRadius: radius.sm, backgroundColor: isMine ? tokens.brand.sun : theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <T variant="titleS" color={isMine ? '#ffffff' : theme.muted}>{initials(row.name)}</T>
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <T variant="titleS" lines={1}>{isMine ? `${row.name} · your class` : row.name}</T>
                <T variant="bodyS" color={theme.muted}>{`Grade ${row.grade} · ${row.participatingLearners}/${row.enrolledLearners} practising`}</T>
              </View>
              <Pill color={tokens.state.success} tint={tokens.tint.success}>{`▲ ${row.growthPercentagePoints.toFixed(0)}`}</Pill>
            </Row>
          </Card>
        );
      }) : (
        <T variant="bodyS" color={theme.muted}>No other classes in this view yet.</T>
      )}

      <T variant="bodyS" color={theme.muted}>{league.policy}</T>
    </Screen>
  );
}
