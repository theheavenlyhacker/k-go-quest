import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ClipboardList, CircleHelp, CloudOff, Download, Folder, LayoutDashboard, LogOut, Settings, Tablet, TrendingUp, User, Users, type LucideIcon } from 'lucide-react-native';

import { ago } from '../domain/format';
import { useOnline } from '../state/online-context';
import type { AdminLoad } from '../state/admin-data';
import { Sidebar, type NavTabSpec } from './chrome';
import { Button, Empty, Info, Pill, Sheet, T } from './primitives';
import { tokens, useTheme } from './theme';

/** The Admin's tabs (Nav Bar · Admin). Names are the route files in `(admin)`. */
export const ADMIN_TABS: NavTabSpec[] = [
  { name: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { name: 'report', label: 'LGU Report', icon: TrendingUp },
  { name: 'devices', label: 'Devices', icon: Tablet },
  { name: 'content', label: 'Content', icon: Folder },
  { name: 'users', label: 'Users', icon: Users },
];

/** Admin Sidebar (321:10). Items with no screen yet open the "coming soon" sheet. */
export function AdminSidebar({ open, onClose, schoolName, teachers }: { open: boolean; onClose: () => void; schoolName?: string; teachers?: number }) {
  const { server, signOut } = useOnline();
  const [soon, setSoon] = useState<string | null>(null);
  const later = (label: string) => () => setSoon(label);
  const items: { icon: LucideIcon; label: string; value?: string; active?: boolean }[] = [
    { icon: User, label: 'My Profile', active: true },
    { icon: Settings, label: 'School Settings' },
    { icon: Users, label: 'Manage Staff', value: teachers === undefined ? undefined : `${teachers} Teachers` },
    { icon: Download, label: 'Data Export' },
    { icon: ClipboardList, label: 'System Logs' },
    { icon: CircleHelp, label: 'Help & FAQ' },
  ];
  return (
    <>
      <Sidebar
        open={open}
        onClose={onClose}
        header={{
          name: server?.user.alias ?? 'LGU Admin',
          detail: schoolName ? `School Admin · ${schoolName}` : 'School Admin',
          pill: <Pill color={tokens.brand.sky} tint={tokens.tint.sky} icon={Settings}>Administrator Access</Pill>,
        }}
        items={items.map((item) => ({ ...item, onPress: later(item.label) }))}
        action={{ icon: LogOut, label: 'Sign out', destructive: true, onPress: () => { onClose(); void signOut(); } }}
      />
      <ComingSoonSheet feature={soon} onClose={() => setSoon(null)} />
    </>
  );
}

/** A bottom sheet for an Admin item whose screen is a later ticket. */
export function ComingSoonSheet({ feature, onClose }: { feature: string | null; onClose: () => void }) {
  return (
    <Sheet visible={feature !== null} title="Coming soon" onClose={onClose}>
      <T variant="bodyM">{`${feature ?? ''} is not built yet. It will appear here in a later update.`}</T>
      <Button title="Got it" onPress={onClose} />
    </Sheet>
  );
}

/** The designed placeholder for a tab whose ticket has not landed. */
export function ComingSoonTab({ icon, title }: { icon: LucideIcon; title: string }) {
  return <Empty icon={icon} title="Coming soon" text={`${title} is on its way. The rest of the Admin shell works today.`} />;
}

/** Loading and error states shared by every Admin screen that loads data. */
export function LoadGate({ load, children }: { load: AdminLoad & { reload: () => void }; children: (data: Extract<AdminLoad, { status: 'ready' }>) => React.ReactNode }) {
  const theme = useTheme();
  if (load.status === 'loading')
    return (
      <View accessibilityRole="progressbar" accessibilityLabel="Loading the school report" style={{ alignItems: 'center', gap: 10, paddingVertical: 48 }}>
        <ActivityIndicator color={theme.navActive} />
        <T variant="bodyS" color={theme.muted}>Loading the school report...</T>
      </View>
    );
  if (load.status === 'error')
    return (
      <>
        <Info icon={LayoutDashboard} color={tokens.state.critical} title="Could not load the school report" text="Check the connection to the school server, then try again." />
        <Button title="Try again" variant="soft" onPress={load.reload} />
      </>
    );
  return (
    <>
      {load.data.stale ? (
        <Info
          icon={CloudOff}
          color={tokens.state.warning}
          title={load.data.loadedAt ? `Last updated ${ago(load.data.loadedAt)}` : 'Last updated'}
          text="The school server cannot be reached, so this is the last report saved on this tablet. It refreshes when the connection returns."
        />
      ) : null}
      {children(load)}
    </>
  );
}
