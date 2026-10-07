import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { UserX } from 'lucide-react-native';

import { learnerDetail, parseProgressSkills, type ReportSkill } from '@/domain/teacher';
import { useOnline } from '@/state/online-context';
import { TEACHER_DATA_SOURCE } from '@/state/teacher-context';
import { LearnerDetailBody, useReadyTeacher } from '@/ui/teacher-insights';
import { TeacherScreen } from '@/ui/teacher-chrome';
import { BackLink, Empty } from '@/ui/primitives';

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
  const skills = progress?.id === id ? progress.skills : undefined;
  const learner = data ? learnerDetail(data.report, id, data.classroom.grade, Date.parse(data.loadedAt), skills) : null;
  return (
    <TeacherScreen title={learner?.alias ?? 'Learner'} caption="Mastery by Skill">
      <BackLink label="Learner Insights" onPress={() => router.navigate('/teacher/insights')} />
      {frame}
      {data && !learner ? <Empty icon={UserX} title="Learner not found" text="This Learner is no longer in your Classroom." /> : null}
      {learner ? <LearnerDetailBody learner={learner} /> : null}
    </TeacherScreen>
  );
}
