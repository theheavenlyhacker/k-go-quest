import { Tabs } from 'expo-router';
import { NavBar, type NavBarProps } from '@/ui/chrome';

export default function TeacherTabs() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <NavBar {...(props as unknown as NavBarProps)} />}
    >
      <Tabs.Screen name="class" options={{ title: 'Class' }} />
      <Tabs.Screen name="learners" options={{ title: 'Learners' }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts' }} />
      <Tabs.Screen name="quiz" options={{ title: 'Quiz' }} />
      <Tabs.Screen name="grow" options={{ title: 'Grow' }} />
    </Tabs>
  );
}
