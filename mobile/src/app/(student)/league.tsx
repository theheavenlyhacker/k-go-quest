import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Trophy, Users } from 'lucide-react-native';

import { useApp, type Standing } from '@/state/app-context';
import { initials } from '@/domain/format';
import { Card, Empty, Eyebrow, Info, Pill, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { radius, tokens, useTheme } from '@/ui/theme';

/** Podium colours for 1st, 2nd and 3rd, matching Monthly League (139:2738). */
const PLACES = [
  { label: '1st', color: tokens.brand.sunDeep, tint: tokens.tint.sun },
  { label: '2nd', color: tokens.state.success, tint: tokens.tint.forestBright },
  { label: '3rd', color: tokens.state.critical, tint: tokens.tint.warning },
] as const;

/** The design paints the podium 2nd · 1st · 3rd, so the winner sits in the middle. */
const PODIUM = [1, 0, 2] as const;

/**
 * Monthly League.
 *
 * The standings are the Profiles on this Shared Tablet, ranked by how many
 * Skills each Learner improved this calendar month. Improvement ranks, not
 * totals, so a Learner who started lower can still come first — and because the
 * only thing that crosses between Profiles is those two counts, nobody sees
 * anyone else's answers. It needs no network, which is why it is this tablet
 * rather than the barangay.
 */
export default function League() {
  const { profiles, profile, standings } = useApp();
  const theme = useTheme();
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

  if (profiles.length < 2) {
    return (
      <Screen chrome title="Monthly League" caption="This tablet · this month">
        <Empty
          icon={Users}
          title="The league needs a second Profile"
          text="Standings compare the Profiles on this tablet. Ask your Caretaker to add another one and this fills in."
        />
        <About />
      </Screen>
    );
  }

  if (rows === null) {
    return (
      <Screen chrome title="Monthly League" caption="This tablet · this month">
        <Card><T variant="bodyM" color={theme.muted}>{'Counting this month’s Growth…'}</T></Card>
      </Screen>
    );
  }

  if (rows === 'error') {
    return (
      <Screen chrome title="Monthly League" caption="This tablet · this month">
        <Empty
          icon={Users}
          title="Could not read the standings"
          text="Some Profiles on this tablet could not be opened just now. Lock and unlock your Profile, then come back."
        />
        <About />
      </Screen>
    );
  }

  const top = rows.slice(0, 3);

  return (
    <Screen chrome title="Monthly League" caption="This tablet · this month">
      <Row style={{ gap: 9, alignItems: 'flex-end' }}>
        {PODIUM.filter((place) => top[place]).map((place) => {
          const row = top[place];
          const style = PLACES[place];
          const first = place === 0;
          const size = first ? 46 : 38;
          return (
            <Card
              key={row.id}
              index={place}
              style={{ flex: 1, alignItems: 'center', gap: 7, paddingVertical: first ? 17 : 12, borderColor: first ? style.color : theme.border, borderWidth: first ? 1.6 : 1 }}
            >
              <T variant="labelPill" color={theme.muted}>{style.label}</T>
              <View style={{ width: size, height: size, borderRadius: radius.pill, backgroundColor: style.tint, alignItems: 'center', justifyContent: 'center' }}>
                <Trophy size={first ? 22 : 18} color={style.color} strokeWidth={1.9} />
              </View>
              <T variant="titleS" lines={1}>{profile?.id === row.id ? 'You' : row.alias}</T>
              <T variant="bodyS" color={style.color}>{`${row.up} up`}</T>
            </Card>
          );
        })}
      </Row>

      <Row style={{ marginTop: 6 }}>
        <Eyebrow style={{ flex: 1 }}>Top Learners</Eyebrow>
        <Eyebrow>Skills up</Eyebrow>
      </Row>

      {rows.map((row, index) => {
        const you = profile?.id === row.id;
        return (
          <Card
            key={row.id}
            index={index}
            style={you ? { backgroundColor: tokens.tint.sun, borderColor: `${tokens.brand.sun}80` } : undefined}
          >
            <Row style={{ gap: 11 }}>
              <T variant="dataS" color={theme.muted}>{`${index + 1}`}</T>
              <View style={{ width: 34, height: 34, borderRadius: radius.pill, backgroundColor: you ? '#ffffff' : tokens.tint.forestBright, alignItems: 'center', justifyContent: 'center' }}>
                <T variant="titleS" color={theme.navActive}>{initials(row.alias)}</T>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Row style={{ gap: 6 }}>
                  <T variant="titleS" lines={1}>{you ? 'You' : row.alias}</T>
                  {you ? <Pill color={tokens.brand.sunDeep} tint="#ffffff">You</Pill> : null}
                </Row>
                <T variant="bodyS" color={theme.muted}>{`${row.mastered} newly Mastered`}</T>
              </View>
              <T variant="titleM" color={tokens.state.success}>{`${row.up}`}</T>
            </Row>
          </Card>
        );
      })}

      <About />
    </Screen>
  );
}

function About() {
  return (
    <Info
      icon={Trophy}
      color={tokens.brand.sky}
      title="How this league works"
      text="It ranks the Profiles on this tablet by how many Skills each Learner improved this month — improvement, not totals, so a Learner who started lower can still come first. Only those counts are shared between Profiles: nobody sees anyone else's answers, and nothing leaves the tablet."
    />
  );
}
