import { useLocalSearchParams, useRouter } from 'expo-router';
import { UserX } from 'lucide-react-native';

import { learnerDetail } from '@/domain/teacher';
import { LearnerDetailBody, useReadyTeacher } from '@/ui/teacher-insights';
import { TeacherScreen } from '@/ui/teacher-chrome';
import { BackLink, Empty } from '@/ui/primitives';

/** One Learner's Mastery per Skill, reached from Student Insights. */
export default function LearnerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { frame, data } = useReadyTeacher();
  const learner = data ? learnerDetail(data.report, id, data.classroom.grade, data.streaks, Date.parse(data.loadedAt)) : null;
  return (
    <TeacherScreen title={learner?.alias ?? 'Learner'} caption="Mastery by Skill">
      <BackLink label="Learner Insights" onPress={() => router.navigate('/teacher/insights')} />
      {frame}
      {data && !learner ? <Empty icon={UserX} title="Learner not found" text="This Learner is no longer in your Classroom." /> : null}
      {learner ? <LearnerDetailBody learner={learner} /> : null}
    </TeacherScreen>
  );
}
