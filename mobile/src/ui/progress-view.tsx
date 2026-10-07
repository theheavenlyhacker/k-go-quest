import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Award, Flame, Gauge, Gift, TriangleAlert } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { meanMastery, pct } from '@/domain/format';
import { growth, type Attempt, type LearningState, type UploadRecord } from '@/domain/engine';
import { badges, dailyAnswers, recentAchievements, streak } from '@/domain/progress';
import type { Purchase } from '@/domain/shop';
import { subjectTitles } from '@/domain/subjects';
import { Bar, Card, Eyebrow, Button, Row, T } from '@/ui/primitives';
import { radius, useSubjectTheme, tokens, useTheme } from '@/ui/theme';

/**
 * My Progress — Figma 34:893 (light) and 255:481 (dark).
 *
 * `readOnly` is the Caretaker's view of someone else's Profile: same numbers,
 * no Lesson links.
 */
export function ProgressView({ learning, attempts, balance, purchases = [], uploads, readOnly = false }: { learning: LearningState; attempts: Attempt[]; balance: number; purchases?: Purchase[]; uploads?: ReadonlyMap<string, UploadRecord>; readOnly?: boolean }) {
  const router = useRouter();
  const { packs } = useApp();
  const theme = useTheme();
  const subjectTheme = useSubjectTheme();
  // Read once when the screen opens: a render-time clock would be impure, and
  // a week boundary crossing mid-session is not worth a re-render.
  const [now] = useState(() => Date.now());

  const month = useMemo(() => growth(packs, attempts, new Date(now), uploads), [packs, attempts, now, uploads]);
  const overall = meanMastery(learning.skills);
  const days = dailyAnswers(attempts, now);
  const busiest = Math.max(1, ...days.map((d) => d.count));
  const achievements = recentAchievements(purchases);
  const flagged = learning.skills.filter((skill) => skill.plateau);
  const statuses = [...learning.statuses.values()];
  const marked = statuses.filter((s) => s === 'marked').length;
  const corrected = statuses.filter((s) => s === 'corrected').length;

  return (
    <>
      {/* stats (450:226) */}
      <Row style={{ gap: 8, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <Stat icon={Gauge} color={tokens.brand.limeDeep} value={pct(overall)} label="Mastery" index={0} />
        <Stat icon={Flame} color={tokens.brand.sunDeep} value={`${streak(attempts, now)}`} label="Day streak" index={1} />
        <Stat icon={Award} color={tokens.brand.grape} value={`${badges(purchases).length}`} label="Badges" index={2} />
      </Row>

      {marked || corrected ? (
        <Card style={{ gap: 4 }}>
          {marked ? <T variant="bodyS" color={theme.secondary}>{`${marked} answer${marked === 1 ? '' : 's'} marked by your school.`}</T> : null}
          {corrected ? <T variant="bodyS" color={theme.secondary}>{`${corrected} answer${corrected === 1 ? '' : 's'} corrected by your school. Mastery and Coins were updated.`}</T> : null}
        </Card>
      ) : null}

      {/* by-subject (450:174) */}
      <Card style={{ gap: 16, padding: 16 }}>
        <T variant="titleM">Mastery by Subject</T>
        {packs.map((pack) => {
          const tone = subjectTheme[pack.subject];
          const skills = learning.skills.filter((skill) => pack.skills.some((spec) => spec.id === skill.skillId));
          const level = meanMastery(skills);
          return (
            <View key={pack.id} accessible accessibilityLabel={`${subjectTitles[pack.subject]} ${pack.grade}: ${pack.title}. Mastery ${pct(level)}`} style={{ gap: 8 }}>
              <Row style={{ gap: 12, alignItems: 'flex-start' }}>
                <View style={{ width: 32, height: 32, borderRadius: radius.sm, backgroundColor: tone.tint, alignItems: 'center', justifyContent: 'center' }}>
                  <T variant="titleS" color={tone.brand}>{subjectTitles[pack.subject][0]}</T>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="titleS">{`${subjectTitles[pack.subject]} ${pack.grade}: ${pack.title}`}</T>
                  <T variant="bodyS" color={theme.muted}>{level === null ? 'Not practised on this tablet yet' : 'Estimated from Counted Attempts'}</T>
                </View>
                <T variant="titleS" color={tone.brand}>{pct(level)}</T>
              </Row>
              <Bar value={level ?? 0} color={tone.brand} height={6} />
            </View>
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
              <Pressable key={skill.skillId} style={{ minHeight: 44, justifyContent: 'center' }} accessibilityRole="link" onPress={() => router.push({ pathname: '/lesson', params: { lessonId: lesson.id } })}>
                <T variant="bodyS" color={theme.navActive}>{`${title} · ${pct(skill.mastery)} — open the Lesson`}</T>
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      <Card index={4} style={{ gap: 10, padding: 16 }}>
        <T variant="titleM">My Practice This Week</T>
        <View
          accessible
          accessibilityLabel={`Answers each day this week: ${days.map((d) => d.count).join(', ')}`}
          style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 84 }}
        >
          {days.map((d, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%' }}>
              <View style={{ width: '100%', height: Math.max(3, (d.count / busiest) * 58), borderRadius: radius.sm / 2, backgroundColor: d.count ? theme.navActive : theme.surfaceAlt }} />
              <T variant="dataS" color={theme.muted}>{d.label}</T>
            </View>
          ))}
        </View>
        <T variant="bodyS" color={theme.muted}>Answers saved each day. This tablet counts answers, not minutes.</T>
      </Card>

      <Card style={{ gap: 8 }}>
        <T variant="titleM">Growth this month</T>
        <T variant="bodyS" color={theme.secondary}>{`${month.thisMonth.up} Skills improved · ${month.thisMonth.mastered} became Mastered`}</T>
        <T variant="bodyS" color={theme.muted}>{`Last month: ${month.lastMonth.up} Skills improved · ${month.lastMonth.mastered} became Mastered`}</T>
      </Card>

      <Eyebrow>Recent achievements</Eyebrow>

      {achievements.length ? (
        <Card index={5} style={{ gap: 11 }}>
          {achievements.map((a) => (
            <Row key={a.id} style={{ gap: 11 }}>
              <Award size={18} color={tokens.brand.grape} />
              <T variant="titleS" style={{ flex: 1 }}>{a.name}</T>
              <T variant="bodyS" color={theme.muted}>{new Date(a.at).toLocaleDateString()}</T>
            </Row>
          ))}
        </Card>
      ) : (
        <Card index={5}>
          <Row style={{ gap: 11 }}>
            <Award size={18} color={theme.muted} />
            <T variant="bodyS" color={theme.muted} style={{ flex: 1 }}>No badges yet. Coins from first answers buy them in My Rewards.</T>
          </Row>
        </Card>
      )}

      <T variant="bodyS" color={theme.muted}>
        {`${balance} Coins available. Mastery is an estimate from your first answer to each question, never a grade.`}
      </T>
      {readOnly ? null : <Button title="My Rewards" icon={Gift} onPress={() => router.push('/(student)/rewards')} />}
    </>
  );
}

/** stat/… (450:227): one number, one word, nothing invented. */
function Stat({ icon: Icon, color, value, label, index }: { icon: typeof Flame; color: string; value: string; label: string; index: number }) {
  const theme = useTheme();
  return (
    <Card index={index} style={{ flex: 1, minWidth: 90, alignItems: 'flex-start', gap: 4, padding: 12 }}>
      <Icon size={21} color={color} strokeWidth={1.9} />
      <T variant="displayL">{value}</T>
      <T variant="bodyS" color={theme.muted} style={{ textAlign: 'center' }}>{label}</T>
    </Card>
  );
}
