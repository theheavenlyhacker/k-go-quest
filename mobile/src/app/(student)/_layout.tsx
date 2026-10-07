import { Tabs } from 'expo-router';
import { LEARNER_TABS, NavBar, type NavBarProps } from '@/ui/chrome';

export default function StudentTabs() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <NavBar {...(props as unknown as NavBarProps)} tabs={LEARNER_TABS} />}
    >
      <Tabs.Screen name="learn" options={{ title: 'Learn' }} />
      <Tabs.Screen name="league" options={{ title: 'League' }} />
      <Tabs.Screen name="tutor" options={{ title: 'Tutor' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="rewards" options={{ title: 'Rewards' }} />
    </Tabs>
  );
}
