import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { BookOpen, ChartColumn, Info as InfoIcon, Layers, Leaf, Sparkles } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import type { Subject } from '@/domain/types';
import { subjectTitles } from '@/data/preview';
import { Action, Bar, Card, Empty, Eyebrow, IconTile, Info, Pill, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { subjectTheme, tokens, useTheme } from '@/ui/theme';

const subjectIcon: Record<Subject, typeof BookOpen> = {
  MATH: ChartColumn, ENGLISH: BookOpen, FILIPINO: Leaf, SCIENCE: Sparkles,
};

export default function Content() {
  const { snapshot, mutate } = useApp();
  const theme = useTheme();
  const router = useRouter();

  const packs = snapshot.packs;
  const published = packs.filter((pack) => pack.published);
  const ratio = packs.length ? published.length / packs.length : 0;

  return (
    <Screen chrome title="Content Management" caption="Packs, versions and publishing">
      <Card style={{ gap: 10 }}>
        <Row>
          <T variant="titleM" style={{ flex: 1 }}>Published coverage</T>
          <Pill color={tokens.state.success} tint={tokens.tint.success}>{`${Math.round(ratio * 100)}%`}</Pill>
        </Row>
        <Bar value={ratio} color={tokens.brand.limeDeep} />
        <T variant="bodyS" color={theme.secondary}>
          {`${published.length} of ${packs.length} pack${packs.length === 1 ? '' : 's'} published to learners. Published packs are immutable — a change means a new version.`}
        </T>
      </Card>

      <Eyebrow>Content packs</Eyebrow>
      {packs.length ? packs.map((pack, index) => {
        const tone = subjectTheme[pack.subject];
        return (
          <Card key={pack.id} index={index} style={{ gap: 10 }} onPress={() => router.push({ pathname: '/pack', params: { packId: pack.id } })}>
            <Row style={{ gap: 11 }}>
              <IconTile icon={subjectIcon[pack.subject]} color={tone.brand} tint={tone.tint} />
              <View style={{ flex: 1, gap: 3 }}>
                <T variant="titleS">{pack.title}</T>
                <T variant="dataS" color={theme.muted}>
                  {`${subjectTitles[pack.subject]} · Grade ${pack.grade} · v${pack.version}`}
                </T>
              </View>
              <Pill
                color={pack.published ? tokens.state.success : tokens.brand.sunDeep}
                tint={pack.published ? tokens.tint.success : tokens.tint.sun}
              >
                {pack.published ? 'Published' : 'Staged'}
              </Pill>
            </Row>
            <T variant="bodyS" color={theme.muted}>{pack.attribution}</T>
            {!pack.published ? (
              <Action
                title="Publish to learners"
                variant="soft"
                task={() => mutate('POST', `content/packs/${pack.id}/publish`, {})}
              />
            ) : null}
          </Card>
        );
      }) : (
        <Empty icon={Layers} title="No packs yet" text="Content packs are created through the API, then published here once every lesson has exercises." />
      )}

      <Info
        icon={InfoIcon}
        color={tokens.brand.sky}
        title="Staged packs never reach this list"
        text="GET /content/packs always filters to published:true, so the ?status=draft call the app makes returns nothing. Until that endpoint accepts a status filter for admins, you cannot see or publish a draft from here."
      />
    </Screen>
  );
}
