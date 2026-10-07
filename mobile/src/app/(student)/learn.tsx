import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { BookOpen, ChartColumn, CircleCheck, CloudDownload, CloudOff, Leaf, RefreshCw, Sparkles } from 'lucide-react-native';

import { quests } from '@/domain/engine';
import { gradingLabel, gradingMode } from '@/domain/grading-mode';
import { libraryProgress, storage, syncBanner } from '@/domain/library';
import { knownSubject, type PackOffer } from '@/domain/packs';
import { useApp } from '@/state/app-context';
import { useOnline } from '@/state/online-context';
import type { Subject } from '@/domain/types';
import { subjectTitles } from '@/domain/subjects';
import { Action, Bar, Card, Eyebrow, IconTile, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { subjectTheme, tokens, useTheme } from '@/ui/theme';

const subjectLabel = (subject: string) => { const known = knownSubject(subject); return known ? subjectTitles[known] : subject; };

const subjectIcon: Record<Subject, typeof BookOpen> = {
  MATH: ChartColumn, ENGLISH: BookOpen, FILIPINO: Leaf, SCIENCE: Sparkles,
};

export default function Learn() {
  const theme = useTheme();
  const router = useRouter();
  const { attempts, packs, profile } = useApp();
  const { state, links, summary, sync, serverPacks, busy } = useOnline();
  const [pending, setPending] = useState(0);
  const [sent, setSent] = useState(0);
  const [fetched, setOffers] = useState<PackOffer[] | 'loading' | 'error'>('loading');

  // Only a Linked Profile uploads anything, so only then is anything "waiting".
  const linked = Boolean(profile && links[profile.id]);
  useEffect(() => {
    if (!profile || !linked) return;
    void summary(profile.id).then((s) => setPending(s.pending)).catch(() => setPending(0));
  }, [profile, linked, summary, attempts.length, sent]);

  useEffect(() => {
    if (state !== 'READY') return;
    void serverPacks().then(setOffers).catch(() => setOffers('error'));
  }, [serverPacks, state]);

  // Offline there is no list to wait for, so nothing is "loading" or "failed".
  const offers = state === 'READY' ? fetched : [];
  const needDownload = Array.isArray(offers) ? offers.filter((o) => o.status === 'NEW') : [];
  const { held, total } = storage(packs.length, needDownload.length);
  const banner = syncBanner(linked ? pending : 0, state);
  const nextQuests = quests(packs, attempts);

  const lessonCount = packs.reduce((total, pack) => total + pack.lessons.length, 0);

  return (
    <Screen chrome title="Subjects" caption={`${lessonCount} lesson${lessonCount === 1 ? '' : 's'} on this tablet`}>
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
            task={async () => { if (profile) { await sync(profile.id); setSent((n) => n + 1); } }}
          />
        </Card>
      ) : null}

      <Eyebrow>Your subjects · MATATAG Grade 5</Eyebrow>

      {packs.map((pack, index) => {
        const tone = subjectTheme[pack.subject];
        // A Downloaded Pack carries no answer key, so saying "On device" here
        // would promise instant marking this tablet cannot give.
        const mode = gradingMode(pack);
        const onDevice = mode === 'ON_DEVICE';
        const { done, total, fraction } = libraryProgress(pack, attempts);
        const title = `${subjectTitles[pack.subject]} ${pack.grade}: ${pack.title}`;
        const detail = `${done} of ${total} lesson${total === 1 ? '' : 's'} · ${onDevice ? 'works offline' : 'answers go up when online'}`;
        return (
          <Card key={pack.id} index={index} onPress={() => router.push({ pathname: '/subject', params: { packId: pack.id } })}>
            <View accessible accessibilityLabel={`${title}. ${detail}. Downloaded. ${gradingLabel(mode)}.`} style={{ gap: 9 }}>
              <Row style={{ gap: 11 }}>
                <IconTile icon={subjectIcon[pack.subject]} color={tone.brand} tint={tone.tint} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="titleM" lines={2}>{title}</T>
                  <T variant="bodyS" color={theme.muted} lines={2}>{detail}</T>
                </View>
                <CircleCheck size={20} color={tokens.state.success} />
              </Row>
              <Bar value={fraction} color={tone.brand} />
            </View>
          </Card>
        );
      })}

      {/* Offered by the server but not on this tablet: shown, never hidden, so
          the Learner can see what a Caretaker could still download. */}
      {needDownload.map((offer, index) => (
        <Card key={offer.summary.id} index={packs.length + index}>
          <View accessible accessibilityLabel={`${offer.summary.title}. Needs download. Ask your Caretaker.`}>
            <Row style={{ gap: 11 }}>
              <IconTile icon={CloudDownload} color={theme.muted} tint={theme.surfaceAlt} />
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="titleM" lines={2}>{`${subjectLabel(offer.summary.subject)} ${offer.summary.grade}: ${offer.summary.title}`}</T>
                <T variant="bodyS" color={theme.muted}>Needs download · ask your Caretaker</T>
              </View>
              <CloudDownload size={20} color={tokens.brand.sunDeep} />
            </Row>
          </View>
        </Card>
      ))}
      {offers === 'error' ? <T variant="bodyS" color={theme.muted}>The school server did not send its list of Content Packs. What is on this tablet still works.</T> : null}
      {offers === 'loading' ? <T variant="bodyS" color={theme.muted}>Checking the school server for more Content Packs…</T> : null}

      <Card style={{ gap: 8 }}>
        <View accessible accessibilityLabel={`Downloaded ${held} of ${total} Content Packs`} style={{ gap: 8 }}>
          <Row style={{ gap: 8 }}>
            <T variant="titleS" style={{ flex: 1 }}>{`Downloaded ${held}`}</T>
            <T variant="dataS" color={theme.muted}>{`of ${total}`}</T>
          </Row>
          <Bar value={total ? held / total : 1} color={tokens.brand.sun} />
        </View>
      </Card>
    </Screen>
  );
}
