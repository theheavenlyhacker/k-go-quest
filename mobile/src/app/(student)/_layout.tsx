import { Tabs } from 'expo-router';
import { NavBar, type NavBarProps } from '@/ui/chrome';

export default function StudentTabs() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <NavBar {...(props as unknown as NavBarProps)} />}
    >
      <Tabs.Screen name="learn" options={{ title: 'Learn' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="rewards" options={{ title: 'Shop' }} />
    </Tabs>
  );
}
