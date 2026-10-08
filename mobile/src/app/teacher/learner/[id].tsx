import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { UserX } from 'lucide-react-native';

import type { QuizResults } from '@/domain/quiz';
import { learnerDetail, parseProgressSkills, type ReportSkill } from '@/domain/teacher';
import { useOnline } from '@/state/online-context';
import { TEACHER_DATA_SOURCE } from '@/state/teacher-context';
import { LearnerDetailBody, useReadyTeacher } from '@/ui/teacher-insights';
import { TeacherScreen } from '@/ui/teacher-chrome';
import { ActivityIndicator } from 'react-native';
import { BackLink, Card, Empty, Info, T } from '@/ui/primitives';

/** One Learner's Mastery per Skill, reached from Student Insights. */
export default function LearnerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { frame, data } = useReadyTeacher();
  const { caretakerGet } = useOnline();
  // Live: this Learner's own per-Skill Mastery from the server. Until it arrives (or if it cannot), the report's Skills stand in.
  const [progress, setProgress] = useState<{ id: string; skills: ReportSkill[] } | null>(null);
  useEffect(() => {
    if (TEACHER_DATA_SOURCE !== 'live') return;
    let live = true;
    caretakerGet(`learning/learners/${id}/progress`)
      .then((raw) => { if (live) setProgress({ id, skills: parseProgressSkills(raw) }); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [caretakerGet, id]);
  const [paperResults, setPaperResults] = useState<{ id: string; rows: { quizId: string; title: string; score: number; total: number }[] } | null>(null);
  const [paperError, setPaperError] = useState<string | null>(null);
  const quizzes = data?.quizzes;
  useEffect(() => {
    if (TEACHER_DATA_SOURCE !== 'live' || !quizzes) return;
    let live = true;
    Promise.all(quizzes.filter((q) => q.status === 'PUBLISHED').map((q) => caretakerGet<QuizResults>(`quizzes/${q.id}/results`)))
      .then((results) => {
        if (live) {
          setPaperResults({ id, rows: results.flatMap((r) => r.learners.filter((l) => l.studentId === id)
            .map((l) => ({ quizId: r.quizId, title: r.title, score: l.score, total: r.total }))) });
          setPaperError(null);
        }
      }).catch((e: unknown) => { if (live) setPaperError(e instanceof Error ? e.message : 'Please try again.'); });
    return () => { live = false; };
  }, [caretakerGet, id, quizzes]);
  const skills = progress?.id === id ? progress.skills : undefined;
  const learner = data ? learnerDetail(data.report, id, data.classroom.grade, Date.parse(data.loadedAt), skills) : null;
  return (
    <TeacherScreen title={learner?.alias ?? 'Learner'} caption="Mastery by Skill">
      <BackLink label="Learner Insights" onPress={() => router.navigate('/teacher/insights')} />
      {frame}
      {data && !learner ? <Empty icon={UserX} title="Learner not found" text="This Learner is no longer in your Classroom." /> : null}
      {learner ? <LearnerDetailBody learner={learner} /> : null}
      {learner && TEACHER_DATA_SOURCE === 'live' ? <Card>
        <T variant="titleS">Paper quiz</T>
        {paperError ? <Info title="Could not load paper results" text={paperError} /> : paperResults?.id !== id ? <ActivityIndicator accessibilityLabel="Loading paper results" />
          : paperResults.rows.length ? paperResults.rows.map((row) => <T key={row.quizId} variant="bodyS">{`${row.title}: ${row.score} / ${row.total}`}</T>)
            : <T variant="bodyS">No marked papers yet.</T>}
        <T variant="bodyS">Paper results do not change Mastery or Coins.</T>
      </Card> : null}
    </TeacherScreen>
  );
}
