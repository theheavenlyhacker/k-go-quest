import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookOpen, ChartColumn, Leaf, Sparkles } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { meanMastery } from '@/domain/format';
import type { Subject } from '@/domain/types';
import { subjectTitles } from '@/data/preview';
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
  const { snapshot } = useApp();
  const theme = useTheme();
  const router = useRouter();

  const entry = snapshot.downloads.find((item) => item.pack.id === packId);
  if (!entry) {
    return (
      <Screen chrome title="Subject" caption="Not on this device">
        <Empty title="This pack is not downloaded" text="Go back to the Offline Library and download it while you have signal." />
      </Screen>
    );
  }

  const { pack, lessons } = entry;
  const tone = subjectTheme[pack.subject];
  const skills = snapshot.progress?.skills ?? [];
  const masteryFor = (skillCode: string) => skills.find((skill) => skill.skillCode === skillCode)?.mastery;
  const packSkills = skills.filter((skill) => lessons.some((lesson) => lesson.skillCode === skill.skillCode));
  const overall = meanMastery(packSkills);

  return (
    <Screen chrome title={`${subjectTitles[pack.subject]} ${pack.grade}`} caption={`${pack.title} · cached`}>
      <BackLink label="Offline Library" onPress={() => router.back()} />

      <Card>
        <Row style={{ gap: 12 }}>
          <IconTile icon={subjectIcon[pack.subject]} color={tone.brand} tint={tone.tint} size={46} />
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="titleM" lines={1}>{pack.title}</T>
            <T variant="bodyS" color={theme.muted} lines={1}>
              {`${subjectTitles[pack.subject]} ${pack.grade} · ${lessons.length} module${lessons.length === 1 ? '' : 's'}`}
            </T>
          </View>
          <Ring value={overall} size={52} color={tone.brand} />
        </Row>
      </Card>

      <Eyebrow>Modules</Eyebrow>
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
