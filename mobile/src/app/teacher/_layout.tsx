import { Tabs } from 'expo-router';

import { NavBar } from '@/ui/chrome';
import { TEACHER_TABS } from '@/ui/teacher-chrome';
import { TeacherProvider } from '@/state/teacher-context';

/** The Teacher shell. Guarded in the root layout on the Caretaker's Server Account role. */
export default function TeacherTabs() {
  return (
    <TeacherProvider>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <NavBar tabs={TEACHER_TABS} {...props} />}>
        {TEACHER_TABS.map((tab) => <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />)}
        <Tabs.Screen name="learner/[id]" options={{ href: null }} />
      </Tabs>
    </TeacherProvider>
  );
}
