import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BookOpen, CircleCheck, CloudDownload, CloudOff, Coins, Flame, Library, RefreshCw, type LucideIcon } from 'lucide-react-native';

import { quests } from '@/domain/engine';
import { gradingLabel, gradingMode } from '@/domain/grading-mode';
import { downloadedCount, libraryProgress } from '@/domain/library';
import { knownSubject } from '@/domain/packs';
import { streak } from '@/domain/progress';
import { useApp } from '@/state/app-context';
import { useLibrary } from '@/state/library';
import type { Subject } from '@/domain/types';
import { subjectTitles } from '@/domain/subjects';
import { Action, Bar, Card, Empty, Eyebrow, IconTile, Pill, Pills, Row, T } from '@/ui/primitives';
import { LessonPath } from '@/ui/lesson-path';
import { Screen } from '@/ui/screen';
import { useSubjectTheme, tokens, useTheme } from '@/ui/theme';

const subjectLabel = (subject: string) => { const known = knownSubject(subject); return known ? subjectTitles[known] : subject; };

const subjectIcon: Record<Subject, LucideIcon> = {
  MATH: BookOpen, ENGLISH: BookOpen, FILIPINO: BookOpen, SCIENCE: BookOpen,
};

/** One Subject in the Library: the same card whether the Pack is on the tablet or still to download. */
function PackCard({ index, icon, tone, title, detail, marker, label, progress, onPress }: {
  index: number; icon: LucideIcon; tone: { brand: string; tint: string }; title: string; detail: string;
  marker: LucideIcon; label: string; progress?: number; onPress?: () => void;
}) {
  const Marker = marker;
  const theme = useTheme();
  return (
    <Card index={index} onPress={onPress} style={{ minHeight: 44, padding: 16 }}>
      <View accessible={!onPress} accessibilityLabel={onPress ? undefined : label} style={{ gap: 9 }}>
        <Row style={{ gap: 11 }}>
          <IconTile icon={icon} color={tone.brand} tint={tone.tint} size={36} />
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="titleM" lines={2}>{title}</T>
            <T variant="bodyS" color={theme.muted} lines={2}>{detail}</T>
          </View>
          <Marker size={20} color={progress === undefined ? tokens.brand.sunDeep : tokens.state.success} />
        </Row>
        {progress === undefined ? null : <Bar value={progress} color={tone.brand} height={3} />}
      </View>
    </Card>
  );
}


export default function Learn() {
  const theme = useTheme();
  const router = useRouter();
  const subjectTheme = useSubjectTheme();
  const { attempts, packs, downloaded, profile, balance } = useApp();
  const [mode, setMode] = useState<'path' | 'library'>('path');
  const [selectedPackId, setSelectedPackId] = useState('');
  const [now] = useState(() => Date.now());
  const selectedPack = packs.find(pack => pack.id === selectedPackId) ?? packs[0];
  const { banner, syncNow, busy, offers, retry } = useLibrary();
  const count = downloadedCount(downloaded.length, offers);
  const needDownload = offers?.status === 'ready' ? offers.offers.filter((o) => o.status === 'NEW') : [];
  const nextQuests = quests(packs, attempts);

  return (
    <Screen chrome title="Learn" caption="Small steps. Big progress.">
      <Row style={{ alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}><T variant="titleM">Ready, {profile?.alias ?? 'Learner'}?</T><T variant="bodyS" color={theme.muted}>One lesson closer to your next level.</T></View>
        <View style={{ gap: 6, alignItems: 'flex-end' }}><Pill icon={Coins} color={tokens.brand.sunDeep} tint={tokens.tint.sun}>{balance} Coins</Pill><Row style={{ gap: 5 }}><Flame size={14} color={tokens.brand.coral} /><T variant="labelPill" color={tokens.brand.coral}>{streak(attempts, now)} day streak</T></Row></View>
      </Row>
      <Pills items={[{ label: 'Learning path', value: 'path' as const }, { label: 'Offline Library', value: 'library' as const }]} value={mode} onChange={setMode} />
      {mode === 'path' && selectedPack ? <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
          {packs.map(pack => { const active = pack.id === selectedPack.id; const tone = subjectTheme[pack.subject]; return <Pressable key={pack.id} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`Choose ${subjectTitles[pack.subject]} ${pack.grade}: ${pack.title}`} onPress={() => setSelectedPackId(pack.id)} style={{ minHeight: 44, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 14, borderWidth: 2, borderColor: active ? tone.brand : theme.border, backgroundColor: active ? tone.tint : theme.surface }}><T variant="titleS" color={active ? tone.brand : theme.muted}>{subjectTitles[pack.subject]} {pack.grade}</T></Pressable>; })}
        </ScrollView>
        <LessonPath key={selectedPack.id} pack={selectedPack} attempts={attempts} />
      </> : null}
      {banner ? (
        <Card style={{ gap: 10, backgroundColor: theme.surfaceAlt }}>
          <Row style={{ gap: 10 }}>
            <CloudOff size={17} color={theme.muted} />
            <T variant="bodyS" color={theme.secondary} style={{ flex: 1 }}>{banner.text}</T>
          </Row>
          <Action
            title="Sync"
            icon={RefreshCw}
            variant="soft"
            disabled={!banner.canSync || busy}
            task={syncNow}
          />
        </Card>
      ) : null}

      {mode === 'library' ? <>
      <Eyebrow>Your subjects · MATATAG Grade 5</Eyebrow>

      {packs.length ? null : (
        <Empty icon={Library} title="No subjects on this tablet" text="The Starter Pack is built into the app. If it is missing, ask your Caretaker to reinstall the app." />
      )}

      {packs.map((pack, index) => {
        // A Downloaded Pack carries no answer key, so saying "On device" here
        // would promise instant marking this tablet cannot give.
        const mode = gradingMode(pack);
        const { done, total, fraction } = libraryProgress(pack, attempts);
        const title = `${subjectTitles[pack.subject]} ${pack.grade}: ${pack.title}`;
        const detail = `${done} of ${total} lesson${total === 1 ? '' : 's'} · ${mode === 'ON_DEVICE' ? 'works offline' : 'answers go up when online'}`;
        const isDownloaded = downloaded.some((d) => d.pack.id === pack.id);
        return (
          <PackCard
            key={pack.id} index={index} icon={subjectIcon[pack.subject]} tone={subjectTheme[pack.subject]}
            title={title} detail={detail} marker={CircleCheck} progress={fraction}
            label={`${title}. ${detail}. ${isDownloaded ? 'Downloaded' : 'Built in'}. ${gradingLabel(mode)}.`}
            onPress={() => router.push({ pathname: '/subject', params: { packId: pack.id } })}
          />
        );
      })}

      {/* Offered by the server but not on this tablet: shown, so a Learner can
          see what a Caretaker could still download. */}
      {needDownload.map((offer, index) => {
        const title = `${subjectLabel(offer.summary.subject)} ${offer.summary.grade}: ${offer.summary.title}`;
        return (
          <PackCard
            key={offer.summary.id} index={packs.length + index} icon={CloudDownload}
            tone={{ brand: theme.muted, tint: theme.surfaceAlt }} title={title}
            detail="Needs download · ask your Caretaker" marker={CloudDownload}
            label={`${title}. Needs download. Ask your Caretaker.`}
          />
        );
      })}

      {offers?.status === 'loading' ? (
        <Card style={{ minHeight: 44 }}>
          <Row style={{ gap: 11 }}>
            <ActivityIndicator color={theme.muted} />
            <T variant="bodyS" color={theme.muted} style={{ flex: 1 }}>Checking the school server for more Content Packs…</T>
          </Row>
        </Card>
      ) : offers?.status === 'error' ? (
        <Card style={{ gap: 10 }}>
          <Row style={{ gap: 11 }}>
            <IconTile icon={CloudOff} color={tokens.state.warning} tint={tokens.tint.warning} />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="titleS">The school server did not answer</T>
              <T variant="bodyS" color={theme.muted}>What is on this tablet still works.</T>
            </View>
          </Row>
          <Action title="Try again" icon={RefreshCw} variant="soft" task={async () => { retry(); }} />
        </Card>
      ) : null}

      {/* The Starter Pack is not a Downloaded Pack, and without the server's list there is no total to draw. */}
      {count.downloaded > 0 || count.total !== null ? (
        <Card style={{ gap: 8 }}>
          <View
            accessible
            accessibilityLabel={count.total === null ? `${count.downloaded} Content Packs downloaded` : `Downloaded ${count.downloaded} of ${count.total} Content Packs`}
            style={{ gap: 8 }}
          >
            <Row style={{ gap: 8 }}>
              <T variant="titleS" style={{ flex: 1 }}>{`Downloaded ${count.downloaded}`}</T>
              {count.total === null ? null : <T variant="dataS" color={theme.muted}>{`of ${count.total}`}</T>}
            </Row>
            {count.total === null ? null : <Bar value={count.total ? count.downloaded / count.total : 0} color={tokens.brand.sun} />}
          </View>
        </Card>
      ) : null}
      </> : null}
      {nextQuests.length ? (
        <>
          <Eyebrow>Quests · practise next</Eyebrow>
          {nextQuests.map((q, index) => {
            const lesson = packs.flatMap((p) => p.lessons).find((l) => l.id === q.lessonId)!;
            const exercise = lesson.exercises.find((e) => e.id === q.exerciseId)!;
            return (
              <Card key={q.exerciseId} index={index} onPress={() => router.push({ pathname: '/lesson', params: { lessonId: q.lessonId, exerciseId: q.exerciseId } })}>
                <T variant="titleS" lines={2}>{exercise.prompt}</T>
                <T variant="bodyS" color={theme.muted} lines={1}>{`${lesson.title} · Mastery ${Math.round(q.mastery * 100)}%`}</T>
              </Card>
            );
          })}
        </>
      ) : null}

    </Screen>
  );
}
