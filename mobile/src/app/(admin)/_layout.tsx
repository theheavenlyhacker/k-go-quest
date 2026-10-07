import { Tabs } from 'expo-router';
import { ADMIN_TABS } from '@/ui/admin';
import { NavBar } from '@/ui/chrome';
import { AdminProvider } from '@/state/admin-context';

/** The LGU Admin shell. The root layout only mounts it for a live LGU_ADMIN session. */
export default function AdminTabs() {
  return (
    <AdminProvider>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <NavBar tabs={ADMIN_TABS} {...props} />}>
        {ADMIN_TABS.map((tab) => <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />)}
      </Tabs>
    </AdminProvider>
  );
}
