import { Tabs } from 'expo-router';
import { NavBar, type NavBarProps } from '@/ui/chrome';

export default function AdminTabs() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <NavBar {...(props as unknown as NavBarProps)} />}
    >
      <Tabs.Screen name="schools" options={{ title: 'Schools' }} />
      <Tabs.Screen name="impact" options={{ title: 'Impact' }} />
      <Tabs.Screen name="devices" options={{ title: 'Devices' }} />
      <Tabs.Screen name="content" options={{ title: 'Content' }} />
      <Tabs.Screen name="users" options={{ title: 'Users' }} />
    </Tabs>
  );
}
