import { TrendingUp } from 'lucide-react-native';

import { AdminSidebar, ComingSoonTab } from '@/ui/admin';
import { Screen } from '@/ui/screen';

export default function Report() {
  return (
    <Screen chrome title="LGU Impact Report" menu={AdminSidebar}>
      <ComingSoonTab icon={TrendingUp} title="LGU Impact Report" />
    </Screen>
  );
}
