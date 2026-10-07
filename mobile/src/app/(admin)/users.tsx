import { Users } from 'lucide-react-native';

import { AdminSidebar, ComingSoonTab } from '@/ui/admin';
import { Screen } from '@/ui/screen';

export default function UsersTab() {
  return (
    <Screen chrome title="User Management" menu={AdminSidebar}>
      <ComingSoonTab icon={Users} title="User Management" />
    </Screen>
  );
}
