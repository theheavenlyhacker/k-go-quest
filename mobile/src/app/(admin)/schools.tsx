import { useState } from 'react';
import { View } from 'react-native';
import { Info as InfoIcon, Plus, School as SchoolIcon } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { pct } from '@/domain/format';
import { Action, Card, Empty, Eyebrow, Field, IconTile, Info, Pill, Ring, Row, Section, Sheet, T, Trend } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { tokens, useTheme } from '@/ui/theme';

export default function Schools() {
  const { snapshot, mutate } = useApp();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const impact = snapshot.impact;
  const index = impact?.meanEstimatedMastery ?? null;
  const participation = impact && impact.activeStudents ? impact.studentsWithPractice / impact.activeStudents : null;

  return (
    <Screen chrome title="School Dashboard" caption={impact ? `${impact.schools} school${impact.schools === 1 ? '' : 's'} · ${impact.activeStudents.toLocaleString()} active learners` : 'Not synced yet'}>
      {impact ? (
        <Card style={{ gap: 12 }}>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 8 }}>
              <Eyebrow>Division mastery index</Eyebrow>
              <T variant="displayL" style={{ fontSize: 32, lineHeight: 36 }}>
                {index === null ? '—' : (index * 100).toFixed(1)}
              </T>
              {participation !== null ? (
                <Pill color={tokens.state.success} tint={tokens.tint.lime}>{`${pct(participation)} of learners practising`}</Pill>
              ) : null}
            </View>
            <Ring value={index} size={62} color={tokens.brand.sky} />
          </Row>
          {snapshot.history.length > 1 ? <Trend values={snapshot.history.map((point) => point.mastery)} color={tokens.brand.sky} /> : null}
          <T variant="bodyS" color={theme.muted}>
            {`${impact.schools} schools · ${impact.studentsWithPractice.toLocaleString()} of ${impact.activeStudents.toLocaleString()} learners with practice · ${impact.attempts.toLocaleString()} attempts.`}
          </T>
        </Card>
      ) : null}

      <Section title="Schools" caption={`${snapshot.schools.length} in your jurisdiction`} />
      {snapshot.schools.length ? snapshot.schools.map((school, index2) => (
        <Card key={school.id} index={index2}>
          <Row style={{ gap: 11 }}>
            <IconTile icon={SchoolIcon} color={tokens.brand.sky} tint={tokens.tint.sky} />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="titleS">{school.name}</T>
              <T variant="bodyS" color={theme.muted}>
                {`${snapshot.users.filter((user) => user.schoolId === school.id).length} account${snapshot.users.filter((user) => user.schoolId === school.id).length === 1 ? '' : 's'}`}
              </T>
            </View>
          </Row>
        </Card>
      )) : (
        <Empty icon={SchoolIcon} title="No schools yet" text="Add the first school in your jurisdiction, then create teacher and learner accounts under it." />
      )}

      <Action title="Add a school" icon={Plus} variant="soft" task={async () => { setOpen(true); }} />

      <Info
        icon={InfoIcon}
        color={tokens.brand.sky}
        title="Per-school mastery needs an endpoint"
        text="The design ranks schools by risk, but reports/impact only aggregates the whole jurisdiction. A per-school breakdown would fill these cards in."
      />

      <Sheet visible={open} title="Add a school" onClose={() => setOpen(false)}>
        <Field label="School name" value={name} onChangeText={setName} placeholder="Pembo Elementary School" />
        <Action
          title="Create school"
          disabled={name.trim().length < 2}
          task={async () => {
            await mutate('POST', 'schools', { name: name.trim() });
            setName('');
            setOpen(false);
          }}
        />
      </Sheet>
    </Screen>
  );
}
