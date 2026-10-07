import { ChartColumn } from 'lucide-react-native';

import { Empty } from '@/ui/primitives';
import { TeacherScreen } from '@/ui/teacher-chrome';

export default function Insights() {
  return (
    <TeacherScreen title="Learner Insights">
      <Empty icon={ChartColumn} title="Learner Insights are coming soon" text="Search your Learners and see who needs attention. This arrives in a coming update." />
    </TeacherScreen>
  );
}
