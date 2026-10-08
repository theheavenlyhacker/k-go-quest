import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Award, Bell, CloudOff, ChartColumn, ClipboardList, CircleHelp, Download, GraduationCap, LayoutGrid, LogOut, ShieldAlert, User, Users } from 'lucide-react-native';

import { ago } from '../domain/format';
import { useApp } from '../state/app-context';
import { useOnline } from '../state/online-context';
import { useTeacher } from '../state/teacher-context';
import { AppBar, Sidebar, type NavTabSpec, type SidebarItem } from './chrome';
import { Info, ListRow, Pill, Sheet, T } from './primitives';
import { tokens, useTheme } from './theme';

/** The Teacher's tabs (Figma bottom-navigation, 277:37). */
export const TEACHER_TABS: NavTabSpec[] = [
  { name: 'class', label: 'Class', icon: LayoutGrid },
  { name: 'insights', label: 'Insights', icon: ChartColumn },
  { name: 'alerts', label: 'Alerts', icon: ShieldAlert },
  { name: 'quizzes', label: 'Quizzes', icon: ClipboardList },
  { name: 'rewards', label: 'Rewards', icon: Award },
];

/** Page frame for the Teacher shell: App Bar, scrolling content, Teacher sidebar. */
export function TeacherScreen({ title, caption, children }: { title: string; caption?: string; children: React.ReactNode }) {
  const theme = useTheme();
  const { load } = useTeacher();
  const [menu, setMenu] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: theme.page }}>
      <StatusBar style="light" />
      <AppBar title={title} subtitle={caption} onMenu={() => setMenu(true)} trailing={null} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24, gap: 11, maxWidth: 640, width: '100%', alignSelf: 'center' }}
      >
        {load.status === 'ready' && load.data.stale ? (
          <Info icon={CloudOff} color={tokens.state.warning} title={`Last updated ${ago(load.data.loadedAt)}`} text="The school server cannot be reached, so this is the last report saved on this tablet. It refreshes when the connection returns." />
        ) : null}
        {children}
      </ScrollView>
      <TeacherSidebar open={menu} onClose={() => setMenu(false)} />
    </View>
  );
}

/** Teacher sidebar (319:10). Items with no screen yet open a "coming soon" sheet. */
function TeacherSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { server, signOut } = useOnline();
  const { closeCaretaker } = useApp();
  const { load, select } = useTeacher();
  const theme = useTheme();
  const [picking, setPicking] = useState(false);
  const [soon, setSoon] = useState<string | null>(null);
  const data = load.status === 'ready' ? load.data : null;
  const later = (label: string) => () => { onClose(); setSoon(label); };
  const items: SidebarItem[] = [
    { icon: ArrowLeft, label: 'Back to this tablet', onPress: () => { onClose(); closeCaretaker(); } },
    { icon: User, label: 'My Profile', active: true, onPress: later('My Profile') },
    { icon: Users, label: 'My Classes', value: data ? `${data.classrooms.length}` : undefined, onPress: data && data.classrooms.length > 1 ? () => { onClose(); setPicking(true); } : later('My Classes') },
    { icon: Bell, label: 'Notification Settings', onPress: later('Notification Settings') },
    { icon: Download, label: 'Offline Sync', value: data ? ago(data.loadedAt) : undefined, onPress: later('Offline Sync') },
    { icon: GraduationCap, label: 'Training Center', onPress: later('Training Center') },
    { icon: CircleHelp, label: 'Help & FAQ', onPress: later('Help & FAQ') },
  ];
  return (
    <>
      <Sidebar
        open={open}
        onClose={onClose}
        header={{
          name: server?.user.alias ?? 'Teacher',
          detail: data ? `Teacher · Grade ${data.classroom.grade} · ${data.classroom.name}` : 'Teacher',
          pill: data ? <Pill color={tokens.brand.sunDeep} tint={tokens.tint.sun} icon={Award}>{`${data.impactPoints.toLocaleString('en-US')} Impact Points · Demo`}</Pill> : undefined,
        }}
        items={items}
        action={{ icon: LogOut, label: 'Sign out', destructive: true, onPress: () => { onClose(); void signOut(); } }}
      />
      <Sheet visible={picking} title="My Classes" onClose={() => setPicking(false)}>
        {data?.classrooms.map((room) => (
          <ListRow key={room.id} title={room.name} detail={`Grade ${room.grade}`} right={room.id === data.classroom.id ? <Pill>Open</Pill> : undefined}
            onPress={() => { setPicking(false); select(room.id); }} />
        ))}
      </Sheet>
      <Sheet visible={soon !== null} title={soon ?? ''} onClose={() => setSoon(null)}>
        <T variant="bodyM" color={theme.secondary}>This part of the Teacher shell is coming soon. Nothing on this tablet is lost in the meantime.</T>
      </Sheet>
    </>
  );
}
