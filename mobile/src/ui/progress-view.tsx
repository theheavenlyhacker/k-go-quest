import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { pct } from '@/domain/format';
import { MASTERED_AT, growth, type Attempt, type LearningState } from '@/domain/engine';
import { starterPacks } from '@/content/starter-pack';
import { subjectTitles } from '@/domain/subjects';
import { Bar, Card, Eyebrow, Pill, Row, T } from '@/ui/primitives';
import { subjectTheme, tokens, useTheme } from '@/ui/theme';

/** The Progress body. `readOnly` is the Caretaker's view: no Lesson links, no Screen chrome. */
export function ProgressView({ learning, attempts, balance, readOnly = false }: { learning: LearningState; attempts: Attempt[]; balance: number; readOnly?: boolean }) {
  const router = useRouter();
  const g = useMemo(() => growth(starterPacks, attempts, new Date()), [attempts]);
  const theme = useTheme();

  return (
    <>
      <Card style={{ backgroundColor: tokens.tint.sun, borderColor: `${tokens.brand.sun}80`, gap: 6 }}>
        <Eyebrow>Coins</Eyebrow>
        <T variant="displayL" style={{ fontSize: 34, lineHeight: 38 }}>{balance}</T>
      </Card>

      <Card style={{ gap: 8 }}>
        <Eyebrow>Growth</Eyebrow>
        <Row style={{ gap: 16 }}>
          {([['Skills that went up', 'up'], ['Became Mastered', 'mastered']] as const).map(([label, key]) => (
            <View key={key} style={{ flex: 1, gap: 2 }}>
              <T variant="displayL" style={{ fontSize: 30, lineHeight: 34 }}>{g.thisMonth[key]}</T>
              <T variant="bodyS">{label}</T>
              <T variant="bodyS" color={theme.muted}>{`Last month: ${g.lastMonth[key]}`}</T>
            </View>
          ))}
        </Row>
      </Card>

      {starterPacks.map((pack) => {
        const tone = subjectTheme[pack.subject];
        return (
          <View key={pack.id} style={{ gap: 8 }}>
            <Eyebrow>{`${subjectTitles[pack.subject]} ${pack.grade}`}</Eyebrow>
            <Card style={{ gap: 14 }}>
              {pack.skills.map((spec) => {
                const skill = learning.skills.find((s) => s.skillId === spec.id);
                const lesson = pack.lessons.find((l) => l.skillCode === spec.id);
                const name = lesson?.title ?? spec.id;
                if (!skill) return null;
                return (
                  <View key={spec.id} style={{ gap: 7 }}>
                    <Row style={{ gap: 11 }}>
                      <View style={{ flex: 1, gap: 1 }}>
                        <T variant="titleS">{name}</T>
                        <T variant="bodyS" color={theme.muted}>{`Mastery estimate: ${pct(skill.mastery)}`}</T>
                      </View>
                      {skill.mastered ? <Pill color={tokens.state.success} tint={tokens.tint.lime}>Mastered</Pill> : null}
                    </Row>
                    <Bar value={skill.mastery} color={tone.brand} />
                    {skill.plateau && readOnly ? (
                      <Pill color={tokens.state.critical} tint={tokens.tint.warning}>Plateau Flag</Pill>
                    ) : skill.plateau ? (
                      <Pressable accessibilityRole="link" onPress={() => lesson && router.push({ pathname: '/lesson', params: { lessonId: lesson.id } })}>
                        <T variant="bodyS" color={theme.muted}>Taking your time on this one? Review the Lesson or listen to its Hint.</T>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </Card>
          </View>
        );
      })}

      <T variant="bodyS" color={theme.muted}>
        {`Mastery is an estimate from your first answer to each question. A skill is Mastered at ${pct(MASTERED_AT)}.`}
      </T>
    </>
  );
}
