import { ClassOverviewBody } from '@/ui/teacher-overview';
import { TeacherScreen } from '@/ui/teacher-chrome';
import { useTeacher } from '@/state/teacher-context';

export default function ClassOverview() {
  const { load } = useTeacher();
  const caption = load.status === 'ready' ? `Grade ${load.data.classroom.grade} · ${load.data.classroom.name}` : undefined;
  return (
    <TeacherScreen title="Class Overview" caption={caption}>
      <ClassOverviewBody />
    </TeacherScreen>
  );
}
