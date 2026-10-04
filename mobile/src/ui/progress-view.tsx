import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CircleCheck, Clock, Flame, TriangleAlert } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { meanMastery, pct } from '@/domain/format';
import { MASTERED_AT, growth, learningState, type Attempt, type LearningState } from '@/domain/engine';
import type { Pack } from '@/domain/types';
import { subjectTitles } from '@/domain/subjects';
import { Bar, Card, Eyebrow, Pill, Ring, Row, T, Trend } from '@/ui/primitives';
import { radius, subjectTheme, tokens, useTheme } from '@/ui/theme';

const WEEK = 7 * 24 * 60 * 60 * 1000;
const WEEKS = 10;

/** Mean Mastery at ten weekly cut-offs, replayed from the Attempt log. */
function weekly(packs: Pack[], log: Attempt[], now: number): number[] {
  const points: number[] = [];
  for (let week = WEEKS - 1; week >= 0; week -= 1) {
    const cutoff = now - week * WEEK;
    const skills = learningState(packs, log.filter((a) => Date.parse(a.at) <= cutoff)).skills;
    points.push(meanMastery(skills) ?? 0);
  }
  return points;
}

/** Consecutive days up to today on which the Learner answered at least once. */
function streak(log: Attempt[], now: number): number {
  const days = new Set(log.map((a) => new Date(a.at).toDateString()));
  let count = 0;
  for (let back = 0; back < 365; back += 1) {
    const day = new Date(now - back * 24 * 60 * 60 * 1000).toDateString();
    if (days.has(day)) count += 1;
    else if (back > 0) break;
  }
  return count;
}

/**
 * My Progress — 04 · My Progress (450:154).
 *
 * `readOnly` is the Caretaker's view of someone else's Profile: same numbers,
 * no Lesson links.
 */
export function ProgressView({ learning, attempts, balance, readOnly = false }: { learning: LearningState; attempts: Attempt[]; balance: number; readOnly?: boolean }) {
  const router = useRouter();
  const { packs } = useApp();
  const theme = useTheme();
  // Read once when the screen opens: a render-time clock would be impure, and
  // a week boundary crossing mid-session is not worth a re-render.
  const [now] = useState(() => Date.now());

  const trend = useMemo(() => weekly(packs, attempts, now), [packs, attempts, now]);
  const month = useMemo(() => growth(packs, attempts, new Date(now)), [packs, attempts, now]);
  const overall = meanMastery(learning.skills);
  // Percentage points gained across the window the sparkline draws.
  const gained = Math.round((trend[trend.length - 1] - trend[0]) * 100);
  const mastered = learning.skills.filter((skill) => skill.mastered).length;
  const thisWeek = attempts.filter((a) => now - Date.parse(a.at) < WEEK).length;
  const flagged = learning.skills.filter((skill) => skill.plateau);

  return (
    <>
      {/* mastery (450:156) */}
      <Card style={{ gap: 12 }}>
        <Row style={{ gap: 10 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Eyebrow>Mastery this quarter</Eyebrow>
            <T variant="displayXL">{pct(overall)}</T>
            <Pill color={tokens.state.success} tint={tokens.tint.success}>
              {gained > 0 ? `▲ ${gained} pts this quarter` : `${month.thisMonth.up} skills up this month`}
            </Pill>
          </View>
          <Ring value={overall} size={62} suffix="" color={tokens.brand.limeDeep} />
        </Row>
        <Trend values={trend} />
        <T variant="bodyS" color={theme.muted}>
          {`Ten weeks of Individual Mastery Delta, replayed from every answer saved on this tablet. A skill counts as Mastered at ${pct(MASTERED_AT)}.`}
        </T>
      </Card>

      <Eyebrow>By subject</Eyebrow>

      {/* by-subject (450:174) */}
      <Card style={{ gap: 13 }}>
        {packs.map((pack) => {
          const tone = subjectTheme[pack.subject];
          const skills = learning.skills.filter((skill) => pack.skills.some((spec) => spec.id === skill.skillId));
          const level = meanMastery(skills);
          return (
            <Row key={pack.id} style={{ gap: 11 }}>
              <Ring value={level} size={44} suffix="" color={tone.brand} />
              <View style={{ flex: 1, gap: 4 }}>
                <T variant="titleS">{`${subjectTitles[pack.subject]} ${pack.grade}`}</T>
                <T variant="bodyS" color={theme.muted} lines={1}>
                  {level === null ? 'Not practised on this tablet yet' : pack.title}
                </T>
                <Bar value={level ?? 0} color={tone.brand} />
              </View>
            </Row>
          );
        })}
      </Card>

      {/* plateau (450:219) — only when there is one, and it names the Skills. */}
      {flagged.length ? (
        <Card style={{ backgroundColor: tokens.tint.warning, borderColor: tokens.state.warning, gap: 9 }}>
          <Row style={{ gap: 11 }}>
            <View style={{ width: 38, height: 38, borderRadius: radius.sm, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' }}>
              <TriangleAlert size={19} color={tokens.state.warning} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="titleS">{flagged.length === 1 ? 'One plateau flagged' : `${flagged.length} plateaus flagged`}</T>
              <T variant="bodyS" color={theme.secondary}>
                {readOnly
                  ? 'At least five answers on each of these and Mastery is still low. Worth a small-group review.'
                  : 'Five or more answers here and the estimate has not moved. Reviewing the Lesson or its Hint usually shifts it.'}
              </T>
            </View>
          </Row>
          {flagged.map((skill) => {
            const lesson = packs.flatMap((p) => p.lessons).find((l) => l.skillCode === skill.skillId);
            const title = lesson?.title ?? skill.skillId;
            if (readOnly || !lesson) return <T key={skill.skillId} variant="bodyS" color={theme.secondary}>{`${title} · ${pct(skill.mastery)}`}</T>;
            return (
              <Pressable key={skill.skillId} accessibilityRole="link" onPress={() => router.push({ pathname: '/lesson', params: { lessonId: lesson.id } })}>
                <T variant="bodyS" color={theme.navActive}>{`${title} · ${pct(skill.mastery)} — open the Lesson`}</T>
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      {/* stats (450:226) */}
      <Row style={{ gap: 10, alignItems: 'stretch' }}>
        <Stat icon={Flame} color={tokens.brand.sunDeep} value={`${streak(attempts, now)}`} label="day answer streak" />
        <Stat icon={CircleCheck} color={tokens.state.success} value={`${mastered}`} label="skills mastered" />
        <Stat icon={Clock} color={tokens.brand.sky} value={`${thisWeek}`} label="answers this week" />
      </Row>

      <T variant="bodyS" color={theme.muted}>
        {`${balance} Coins earned from first answers. Mastery is an estimate from your first answer to each question, never a grade.`}
      </T>
    </>
  );
}

/** stat/… (450:227): one number, one word, nothing invented. */
function Stat({ icon: Icon, color, value, label }: { icon: typeof Flame; color: string; value: string; label: string }) {
  const theme = useTheme();
  return (
    <Card style={{ flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 14 }}>
      <Icon size={21} color={color} strokeWidth={1.9} />
      <T variant="displayL">{value}</T>
      <T variant="bodyS" color={theme.muted} style={{ textAlign: 'center' }}>{label}</T>
    </Card>
  );
}
