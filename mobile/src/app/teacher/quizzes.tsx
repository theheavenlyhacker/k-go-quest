import { QuizBuilderBody } from '@/ui/teacher-tabs';
import { TeacherScreen } from '@/ui/teacher-chrome';

export default function Quizzes() {
  return (
    <TeacherScreen title="Quiz Builder">
      <QuizBuilderBody />
    </TeacherScreen>
  );
}
