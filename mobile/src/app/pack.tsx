import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookOpen, ChartColumn, Info as InfoIcon, Leaf, Sparkles, TriangleAlert } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import type { PackDownload, Subject } from '@/domain/types';
import { subjectTitles } from '@/data/preview';
import { Action, BackLink, Bar, Card, Empty, Eyebrow, IconTile, Info, Pill, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { subjectTheme, tokens, useTheme } from '@/ui/theme';

const subjectIcon: Record<Subject, typeof BookOpen> = {
  MATH: ChartColumn, ENGLISH: BookOpen, FILIPINO: Leaf, SCIENCE: Sparkles,
};

export default function PackDetail() {
  const { packId } = useLocalSearchParams<{ packId?: string }>();
  const { snapshot, api, mutate, preview, toast } = useApp();
  const theme = useTheme();
  const router = useRouter();
  const [detail, setDetail] = useState<PackDownload | null>(null);
  const [loading, setLoading] = useState(true);

  const pack = snapshot.packs.find((item) => item.id === packId);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!packId || preview) { setLoading(false); return; }
      try {
        const result = await api.call<PackDownload>('GET', `content/packs/${packId}/download`);
        if (active) setDetail(result);
      } catch (error) {
        if (active) toast(error instanceof Error ? error.message : 'Could not load this pack.', 'error');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [packId, api, preview, toast]);

  if (!pack) {
    return (
      <Screen chrome title="Content pack" caption="Not found">
        <Empty title="Pack not in this jurisdiction" text="Open it again from Content Management." />
      </Screen>
    );
  }

  const tone = subjectTheme[pack.subject];
  const lessons = detail?.lessons ?? [];
  // The publish gate is "every lesson has at least one exercise", so that is
  // the only readiness number the server actually supports.
  const ready = lessons.filter((lesson) => lesson.exercises.length > 0);
  const readiness = lessons.length ? ready.length / lessons.length : 0;

  return (
    <Screen chrome title={pack.title} caption={`${lessons.length || '—'} lesson${lessons.length === 1 ? '' : 's'} · v${pack.version} ${pack.published ? 'published' : 'staged'}`}>
      <BackLink label="Content Management" onPress={() => router.back()} />

      <Card style={{ gap: 11 }}>
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
        {lessons.length ? (
          <>
            <Row style={{ gap: 8 }}>
              <T variant="bodyS" color={theme.secondary} style={{ flex: 1 }}>Lessons ready to publish</T>
              <T variant="dataS" color={theme.muted}>{`${Math.round(readiness * 100)}%`}</T>
            </Row>
            <Bar value={readiness} color={tokens.brand.limeDeep} />
          </>
        ) : null}
        <T variant="bodyS" color={theme.muted}>{pack.attribution}</T>
      </Card>

      {loading ? (
        <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
          <ActivityIndicator color={tokens.brand.limeDeep} />
        </Card>
      ) : preview ? (
        <Info icon={InfoIcon} color={tokens.brand.grape} title="Preview mode" text="Pack contents load from a live administrator account." />
      ) : lessons.length ? (
        <>
          <Eyebrow>Units</Eyebrow>
          {lessons.map((lesson, index) => {
            const complete = lesson.exercises.length > 0;
            return (
              <Card key={lesson.id} index={index}>
                <Row style={{ gap: 11 }}>
                  <IconTile
                    icon={complete ? subjectIcon[pack.subject] : TriangleAlert}
                    color={complete ? tokens.state.success : tokens.brand.sunDeep}
                    tint={complete ? tokens.tint.success : tokens.tint.sun}
                  />
                  <View style={{ flex: 1, gap: 3 }}>
                    <T variant="titleS" lines={1}>{lesson.title}</T>
                    <T variant="dataS" color={theme.muted}>
                      {`${lesson.skillCode} · ${lesson.exercises.length} item${lesson.exercises.length === 1 ? '' : 's'}`}
                    </T>
                  </View>
                  <Pill
                    color={complete ? tokens.state.success : tokens.brand.sunDeep}
                    tint={complete ? tokens.tint.success : tokens.tint.sun}
                  >
                    {complete ? 'Ready' : 'Needs items'}
                  </Pill>
                </Row>
              </Card>
            );
          })}
        </>
      ) : (
        <Empty title="No lessons returned" text="A staged pack cannot be downloaded, so its contents are not visible here yet." />
      )}

      {!pack.published ? (
        <Action title={`Publish v${pack.version}`} task={() => mutate('POST', `content/packs/${pack.id}/publish`, {})} />
      ) : null}

      <Info
        icon={InfoIcon}
        color={tokens.brand.sky}
        title="Reviewer assignment is not in the API"
        text="The design assigns a curriculum reviewer per unit and tracks Mapped / Review / Author states. There is no reviewer model on the server, so units show the publish-readiness the server does enforce."
      />
    </Screen>
  );
}
