import { Folder } from 'lucide-react-native';

import { AdminSidebar, ComingSoonTab } from '@/ui/admin';
import { Screen } from '@/ui/screen';

export default function Content() {
  return (
    <Screen chrome title="Content Management" menu={AdminSidebar}>
      <ComingSoonTab icon={Folder} title="Content Management" />
    </Screen>
  );
}
