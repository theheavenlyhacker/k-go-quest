import { ClipboardList } from 'lucide-react-native';

import { Empty } from '@/ui/primitives';
import { TeacherScreen } from '@/ui/teacher-chrome';

export default function Quizzes() {
  return (
    <TeacherScreen title="Quizzes">
      <Empty icon={ClipboardList} title="Quizzes are coming soon" text="Build and manage quizzes for your Classroom. This arrives in a coming update." />
    </TeacherScreen>
  );
}
