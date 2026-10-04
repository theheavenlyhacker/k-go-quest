import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CloudOff, Shield, Sparkles, Trophy, Users } from 'lucide-react-native';

import { useApp, type Standing } from '@/state/app-context';
import { useOnline } from '@/state/online-context';
import { initials, pct } from '@/domain/format';
import { Bar, Card, Empty, Eyebrow, Pill, Pills, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { elevation, radius, tokens, useTheme } from '@/ui/theme';

/**
 * Monthly League — 02 · Monthly League (448:58).
 *
 * The design ranks barangays and schools against each other, which needs a
 * server. This build ranks the Profiles on this Shared Tablet, which needs
 * nothing — so the screen is whole with the radio off and gains the wider
 * scopes when one is reachable. Ranking is by improvement, not by totals, so a
 * Learner who started lower can still come first, and the only thing that
 * crosses between Profiles is the two Growth counts: nobody sees anyone else's
 * answers.
 */
type Scope = 'tablet' | 'barangay' | 'division';

const SCOPES = [
  { label: 'Tablet', value: 'tablet' as const },
  { label: 'Barangay', value: 'barangay' as const },
  { label: 'Division', value: 'division' as const },
];

/** podium/1st · 2nd · 3rd (448:68–448:85): first place is bordered and lifted. */
const PLACES = [
  { label: '1st', color: tokens.brand.sun },
  { label: '2nd', color: tokens.brand.sky },
  { label: '3rd', color: tokens.state.critical },
] as const;

/** The design paints the podium 2nd · 1st · 3rd, so the winner sits in the middle. */
const PODIUM = [1, 0, 2] as const;

export default function League() {
  const { profiles, profile, standings } = useApp();
  const { state } = useOnline();
  const theme = useTheme();
  const [scope, setScope] = useState<Scope>('tablet');
  const [rows, setRows] = useState<Standing[] | 'error' | null>(null);

  useFocusEffect(
    useCallback(() => {
      // Re-read on every visit: the Learner may have just finished practising.
      let live = true;
      void standings()
        .then((next) => { if (live) setRows(next); })
        .catch(() => { if (live) setRows('error'); });
      return () => { live = false; };
    }, [standings]),
  );

  const caption = scope === 'tablet' ? 'This tablet · this month' : 'Needs a connection';

  return (
    <Screen chrome title="Monthly League" caption={caption}>
      <Pills items={SCOPES} value={scope} onChange={setScope} />

      {scope !== 'tablet' ? (
        <>
          <Card style={{ gap: 10 }}>
            <Row style={{ gap: 11 }}>
              <CloudOff size={19} color={theme.muted} />
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="titleS">{scope === 'barangay' ? 'Barangay standings' : 'Division standings'}</T>
                <T variant="bodyS" color={theme.muted}>
                  {state === 'READY'
                    ? 'Ranking across tablets is still being built on the server. The tablet standings below work today.'
                    : 'Other tablets can only be ranked once this one reaches the school server. Your own standings keep working.'}
                </T>
              </View>
            </Row>
          </Card>
          <Note />
        </>
      ) : rows === null ? (
        <Card><T variant="bodyM" color={theme.muted}>{'Counting this month’s Growth…'}</T></Card>
      ) : rows === 'error' ? (
        <>
          <Empty icon={Users} title="Could not read the standings" text="Some Profiles on this tablet could not be opened just now. Lock and unlock your Profile, then come back." />
          <Note />
        </>
      ) : profiles.length < 2 ? (
        <>
          <Empty icon={Users} title="The league needs a second Profile" text="Standings compare the Profiles on this tablet. Ask your Caretaker to add another one and this fills in." />
          <Note />
        </>
      ) : (
        <>
          <Podium rows={rows} youId={profile?.id ?? null} />
          <Note />
          <Eyebrow>Top learners · mastery delta</Eyebrow>
          {rows.map((row, index) => <StandingRow key={row.id} row={row} rank={index + 1} you={profile?.id === row.id} index={index} />)}
          <Chase rows={rows} youId={profile?.id ?? null} />
        </>
      )}
    </Screen>
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
          Growth-Delta ranking: you climb on how much you improve, not on who was already ahead.
        </T>
      </Row>
    </Card>
  );
}

function Podium({ rows, youId }: { rows: Standing[]; youId: string | null }) {
  const theme = useTheme();
  const top = rows.slice(0, 3);
  return (
    <Row style={{ gap: 8, alignItems: 'flex-end' }}>
      {PODIUM.filter((place) => top[place]).map((place) => {
        const row = top[place];
        const style = PLACES[place];
        const first = place === 0;
        return (
          <Card
            key={row.id}
            index={place}
            style={{
              flex: 1, alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 12,
              borderWidth: first ? 2 : 1, borderColor: first ? tokens.brand.sun : theme.border,
              ...(first ? elevation.raised : null),
            }}
          >
            <T variant="labelPill" color={style.color}>{style.label}</T>
            <Shield size={22} color={style.color} strokeWidth={1.9} />
            <T variant="labelPill" style={{ textAlign: 'center' }} lines={2}>{youId === row.id ? 'You' : row.alias}</T>
            <T variant="dataS" color={style.color}>{`${row.up} up`}</T>
          </Card>
        );
      })}
    </Row>
  );
}

/** row/1–5 (448:91–448:145): the YOU row is the sun-tinted one. */
function StandingRow({ row, rank, you, index }: { row: Standing; rank: number; you: boolean; index: number }) {
  const theme = useTheme();
  return (
    <Card index={index} style={you ? { backgroundColor: tokens.tint.sun, borderColor: tokens.brand.sun } : undefined}>
      <Row style={{ gap: 10 }}>
        <T variant="dataS" color={theme.muted}>{`${rank}`}</T>
        <View style={{ width: 32, height: 32, borderRadius: radius.sm, backgroundColor: you ? tokens.brand.sun : theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <T variant="labelPill" color={you ? theme.text : theme.navActive}>{initials(row.alias)}</T>
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <T variant="titleS" lines={1}>{you ? 'You' : row.alias}</T>
          <T variant="bodyS" color={theme.muted}>{`${row.mastered} newly Mastered`}</T>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3 }}>
          <T variant="dataM">{pct(row.mastery)}</T>
          <Pill color={tokens.state.success} tint={tokens.tint.success}>{`▲ ${row.up}`}</Pill>
        </View>
      </Row>
    </Card>
  );
}

/** guild (448:146): how far the Learner is from first, with the gap drawn. */
function Chase({ rows, youId }: { rows: Standing[]; youId: string | null }) {
  const theme = useTheme();
  const leader = rows[0];
  const you = rows.find((row) => row.id === youId);
  if (!leader || !you) return null;
  const behind = leader.up - you.up;
  return (
    <Card style={{ gap: 9 }}>
      <Row style={{ gap: 9 }}>
        <Trophy size={19} color={tokens.brand.sunDeep} />
        <T variant="bodyS" color={theme.secondary} style={{ flex: 1 }}>
          {behind <= 0
            ? 'You are top of this tablet this month. The count resets when the month does.'
            : `You are ${behind} improvement${behind === 1 ? '' : 's'} from 1st place this month.`}
        </T>
      </Row>
      <Bar value={leader.up ? you.up / leader.up : 0} color={tokens.brand.sun} />
    </Card>
  );
}
