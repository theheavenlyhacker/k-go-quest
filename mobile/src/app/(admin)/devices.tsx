import { Tablet } from 'lucide-react-native';

import { AdminSidebar, ComingSoonTab } from '@/ui/admin';
import { Screen } from '@/ui/screen';

export default function Devices() {
  return (
    <Screen chrome title="Device Management" menu={AdminSidebar}>
      <ComingSoonTab icon={Tablet} title="Device Management" />
    </Screen>
  );
}
