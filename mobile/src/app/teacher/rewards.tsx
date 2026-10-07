import { Award } from 'lucide-react-native';

import { Empty } from '@/ui/primitives';
import { TeacherScreen } from '@/ui/teacher-chrome';

export default function TeacherRewards() {
  return (
    <TeacherScreen title="Rewards">
      <Empty icon={Award} title="Rewards are coming soon" text="Your Impact Points, badges and training credentials. This arrives in a coming update." />
    </TeacherScreen>
  );
}
