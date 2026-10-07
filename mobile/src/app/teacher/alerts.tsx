import { ShieldAlert } from 'lucide-react-native';

import { Empty } from '@/ui/primitives';
import { TeacherScreen } from '@/ui/teacher-chrome';

export default function Alerts() {
  return (
    <TeacherScreen title="Alerts">
      <Empty icon={ShieldAlert} title="Alerts are coming soon" text="Plateau Flags and Learners who have not synced will be listed here. This arrives in a coming update." />
    </TeacherScreen>
  );
}
