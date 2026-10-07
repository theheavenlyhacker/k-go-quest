import { InsightsBody } from '@/ui/teacher-insights';
import { TeacherScreen } from '@/ui/teacher-chrome';

export default function Insights() {
  return (
    <TeacherScreen title="Learner Insights">
      <InsightsBody />
    </TeacherScreen>
  );
}
