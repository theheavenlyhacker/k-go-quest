import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CloudOff, Shield, Sparkles, Trophy, TriangleAlert } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { useOnline } from '@/state/online-context';
import { ApiError } from '@/domain/client';
import { growth } from '@/domain/engine';
import { leagueView, type LeagueScope } from '@/domain/league';
import type { LeagueReport, LeagueRow } from '@/domain/server';
import { Bar, Card, Empty, Eyebrow, Pill, Pills, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { elevation, radius, tokens, useTheme } from '@/ui/theme';

/**
 * Monthly League — 02 · Monthly League (448:58).
 *
 * A League ranks Classrooms by how much their Learners' Mastery improved, never
 * by totals, and it exists only once this Shared Tablet has reached the server.
 * A Learner never sees a named Learner's place: what they see about themselves
 * is their own Growth, which compares them only with their own last month.
 */
const SCOPES = [
  { label: 'Grade', value: 'grade' as const },
  { label: 'Division', value: 'division' as const },
];

/** podium/1st · 2nd · 3rd (448:68–448:85): first place is bordered and lifted. */
const PLACES = [
  { label: '1st', color: tokens.brand.sun },
  { label: '2nd', color: tokens.brand.sky },
  { label: '3rd', color: tokens.state.critical },
] as const;

const points = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)} pts`;

/** null is loading; 'none' is a tablet that has never connected, or a Profile with no Classroom to ask about. */
type Report = LeagueReport | 'error' | 'none' | null;

export default function League() {
  const { profile, packs, attempts } = useApp();
  const { league, links } = useOnline();
  const theme = useTheme();
  const [scope, setScope] = useState<LeagueScope>('grade');
  const [report, setReport] = useState<Report>(null);
  const month = useMemo(() => growth(packs, attempts, new Date()), [packs, attempts]);
  const profileId = profile?.id ?? null;

  useFocusEffect(
    useCallback(() => {
      // Re-read on every visit: the month moves while the Learner practises.
      let live = true;
      if (!profileId) return undefined;
      setReport(null);
      league(profileId)
        .then((next) => { if (live) setReport(next ?? 'none'); })
        .catch((error: unknown) => { if (live) setReport(error instanceof ApiError && error.status === 0 ? 'none' : 'error'); });
      return () => { live = false; };
    }, [league, profileId]),
  );

  const view = report && typeof report === 'object'
    ? leagueView(report, profileId ? links[profileId]?.classroomId ?? null : null, scope)
    : null;

  return (
    <Screen chrome title="Monthly League" caption={report && typeof report === 'object' ? `Classrooms · ${report.month}` : 'Classrooms · this month'}>
      {report === null ? (
        <Card accessibilityLabel="Loading the League"><T variant="bodyM" color={theme.muted}>{'Counting this month’s improvement…'}</T></Card>
      ) : report === 'error' ? (
        <Empty icon={TriangleAlert} title="Could not read the League" text="The school server did not answer properly just now. Your own Growth below is unaffected." />
      ) : report === 'none' || !view ? (
        <Empty icon={CloudOff} title="The League needs a connection" text="Classrooms are ranked once this tablet has reached the school server. Your own Growth keeps working without it." />
      ) : (
        <>
          <Pills items={SCOPES} value={scope} onChange={setScope} />
          {view.rows.length === 0 ? (
            <Empty icon={Trophy} title="No Classrooms to rank yet" text="Nobody has practised in this group this month." />
          ) : (
            <>
              <Podium rows={view.podium} mineId={view.mine?.classroomId ?? null} />
              <Note />
              <Eyebrow>Classrooms · Mastery improvement</Eyebrow>
              {view.rows.map((row, index) => <ClassroomRow key={row.classroomId} row={row} mine={row.classroomId === view.mine?.classroomId} index={index} />)}
              {view.mine && view.behind !== null ? <TeamProgress mine={view.mine} leader={view.rows[0]} behind={view.behind} /> : null}
            </>
          )}
        </>
      )}

      <Eyebrow>Your Growth this month</Eyebrow>
      <Card
        style={{ gap: 6 }}
        accessibilityLabel={`Your Growth this month: ${month.thisMonth.up} Skills improved, ${month.thisMonth.mastered} newly Mastered. Last month: ${month.lastMonth.up} and ${month.lastMonth.mastered}.`}
      >
        <Row style={{ gap: 18 }}>
          <Stat value={month.thisMonth.up} label="Skills improved" last={month.lastMonth.up} />
          <Stat value={month.thisMonth.mastered} label="Newly Mastered" last={month.lastMonth.mastered} />
        </Row>
        <T variant="bodyS" color={theme.muted}>Growth compares you only with your own last month.</T>
      </Card>
    </Screen>
  );
}

function Stat({ value, label, last }: { value: number; label: string; last: number }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, gap: 1 }}>
      <T variant="displayXL">{`${value}`}</T>
      <T variant="titleS">{label}</T>
      <T variant="bodyS" color={theme.muted}>{`Last month ${last}`}</T>
    </View>
  );
}

/** note (448:86): why the ranking is what it is, where a Learner will read it. */
function Note() {
  const theme = useTheme();
  return (
    <Card style={{ backgroundColor: tokens.tint.lime, borderColor: tokens.brand.limeDeep, gap: 0 }}>
      <Row style={{ gap: 10 }}>
        <Sparkles size={19} color={tokens.brand.limeDeep} />
        <T variant="bodyS" color={theme.secondary} style={{ flex: 1 }}>
          Classrooms climb on how much their Mastery improves, not on who was already ahead.
        </T>
      </Row>
    </Card>
  );
}

function Podium({ rows, mineId }: { rows: LeagueRow[]; mineId: string | null }) {
  const theme = useTheme();
  return (
    <Row style={{ gap: 8, alignItems: 'flex-end' }}>
      {rows.map((row) => {
        const place = PLACES[row.rank - 1] ?? PLACES[2];
        const first = row.rank === 1;
        return (
          <Card
            key={row.classroomId}
            index={row.rank - 1}
            accessibilityLabel={`${place.label} place: ${row.name}${row.classroomId === mineId ? ', your Classroom' : ''}, ${points(row.growthPercentagePoints)}`}
            style={{
              flex: 1, alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 12,
              borderWidth: first ? 2 : 1, borderColor: first ? tokens.brand.sun : theme.border,
              ...(first ? elevation.raised : null),
            }}
          >
            <T variant="labelPill" color={place.color}>{place.label}</T>
            <Shield size={22} color={place.color} strokeWidth={1.9} />
            <T variant="labelPill" style={{ textAlign: 'center' }} lines={2}>{row.classroomId === mineId ? 'Your Classroom' : row.name}</T>
            <T variant="dataS" color={place.color}>{points(row.growthPercentagePoints)}</T>
          </Card>
        );
      })}
    </Row>
  );
}

/** row/1–5 (448:91–448:145): the Learner's own Classroom is the sun-tinted one. */
function ClassroomRow({ row, mine, index }: { row: LeagueRow; mine: boolean; index: number }) {
  const theme = useTheme();
  return (
    <Card
      index={index}
      accessibilityLabel={`${row.rank}. ${mine ? 'Your Classroom, ' : ''}${row.name}, grade ${row.grade}, ${row.participatingLearners} of ${row.enrolledLearners} Learners practised, ${points(row.growthPercentagePoints)}`}
      style={mine ? { backgroundColor: tokens.tint.sun, borderColor: tokens.brand.sun } : undefined}
    >
      <Row style={{ gap: 10 }}>
        <T variant="dataS" color={theme.muted}>{`${row.rank}`}</T>
        <View style={{ width: 32, height: 32, borderRadius: radius.sm, backgroundColor: mine ? tokens.brand.sun : theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <T variant="labelPill" color={mine ? theme.text : theme.navActive}>{`G${row.grade}`}</T>
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <T variant="titleS" lines={1}>{mine ? 'Your Classroom' : row.name}</T>
          <T variant="bodyS" color={theme.muted}>{`${row.participatingLearners} of ${row.enrolledLearners} Learners practised`}</T>
        </View>
        <Pill color={tokens.state.success} tint={tokens.tint.success}>{`▲ ${points(row.growthPercentagePoints)}`}</Pill>
      </Row>
    </Card>
  );
}

/** guild (448:146): team progress, how far the Learner's Classroom is from first, with the gap drawn. */
function TeamProgress({ mine, leader, behind }: { mine: LeagueRow; leader: LeagueRow; behind: number }) {
  const theme = useTheme();
  const share = leader.growthPercentagePoints > 0 ? Math.max(0, mine.growthPercentagePoints) / leader.growthPercentagePoints : 1;
  return (
    <Card style={{ gap: 9 }}>
      <Row style={{ gap: 9 }}>
        <Trophy size={19} color={tokens.brand.sunDeep} />
        <T variant="bodyS" color={theme.secondary} style={{ flex: 1 }}>
          {behind <= 0
            ? 'Your Classroom is first this month. The count resets when the month does.'
            : `Your Classroom is ${behind.toFixed(1)} points from 1st place this month.`}
        </T>
      </Row>
      <Bar value={Math.min(1, share)} color={tokens.brand.sun} />
    </Card>
  );
}
