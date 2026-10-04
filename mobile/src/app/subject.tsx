import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookOpen, ChartColumn, Leaf, Sparkles } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { meanMastery } from '@/domain/format';
import type { Subject } from '@/domain/types';
import { subjectTitles } from '@/domain/subjects';
import { BackLink, Card, Empty, Eyebrow, IconTile, Pill, Ring, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { subjectTheme, tokens, useTheme } from '@/ui/theme';

const subjectIcon: Record<Subject, typeof BookOpen> = {
  MATH: ChartColumn, ENGLISH: BookOpen, FILIPINO: Leaf, SCIENCE: Sparkles,
};

/** Mastery bands drive the trailing pill: Done / a percentage / Start. */
function band(mastery: number | undefined, theme: { muted: string; surfaceAlt: string }) {
  if (mastery === undefined) return { detail: 'Not started', label: 'Start', color: theme.muted, tint: theme.surfaceAlt };
  if (mastery >= 0.9) return { detail: `Mastered · ${Math.round(mastery * 100)}%`, label: 'Done', color: tokens.state.success, tint: tokens.tint.success };
  return { detail: `Proficient · ${Math.round(mastery * 100)}%`, label: `${Math.round(mastery * 100)}%`, color: tokens.brand.sunDeep, tint: tokens.tint.sunDeep };
}

export default function SubjectScreen() {
  const { packId } = useLocalSearchParams<{ packId?: string }>();
  const { learning, packs } = useApp();
  const theme = useTheme();
  const router = useRouter();

  const pack = packs.find((item) => item.id === packId);
  if (!pack) {
    return (
      <Screen chrome title="Subject" caption="Not found">
        <Empty title="This subject is not on this tablet" text="Go back to Subjects and pick another." />
      </Screen>
    );
  }

  const { lessons } = pack;
  const tone = subjectTheme[pack.subject];
  const masteryFor = (skillCode: string) => learning.skills.find((skill) => skill.skillId === skillCode)?.mastery;
  const packSkills = learning.skills.filter((skill) => lessons.some((lesson) => lesson.skillCode === skill.skillId));
  const overall = meanMastery(packSkills);

  return (
    <Screen chrome title={`${subjectTitles[pack.subject]} ${pack.grade}`} caption={`${pack.title} · on device`}>
      <BackLink label="Subjects" onPress={() => router.back()} />

      <Card>
        <Row style={{ gap: 12 }}>
          <IconTile icon={subjectIcon[pack.subject]} color={tone.brand} tint={tone.tint} size={46} />
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="titleM" lines={1}>{pack.title}</T>
            <T variant="bodyS" color={theme.muted} lines={1}>
              {`${subjectTitles[pack.subject]} ${pack.grade} · ${lessons.length} lesson${lessons.length === 1 ? '' : 's'}`}
            </T>
          </View>
          <Ring value={overall} size={52} color={tone.brand} />
        </Row>
      </Card>

      <Eyebrow>Lessons</Eyebrow>
      {lessons.map((lesson, index) => {
        const status = band(masteryFor(lesson.skillCode), theme);
        return (
          <Card key={lesson.id} index={index} onPress={() => router.push({ pathname: '/lesson', params: { lessonId: lesson.id } })}>
            <Row style={{ gap: 11 }}>
              <IconTile icon={BookOpen} color={tone.brand} tint={tone.tint} />
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="titleS" lines={1}>{lesson.title}</T>
                <T variant="bodyS" color={theme.muted}>{status.detail}</T>
              </View>
              <Pill color={status.color} tint={status.tint}>{status.label}</Pill>
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}
