import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Download, Globe, Languages, Lock, LogOut, MapPin, Repeat2, Wifi } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { ago, initials, roleName } from '@/domain/format';
import { Action, BackLink, Card, Eyebrow, IconTile, Pill, Pills, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { radius, tokens, useTheme } from '@/ui/theme';

const appearances = [
  { label: 'Light', value: 'light' as const },
  { label: 'Dark', value: 'dark' as const },
  { label: 'System', value: 'system' as const },
];
const languages = [
  { label: 'English', value: 'en' },
  { label: 'Tagalog', value: 'tl' },
  { label: 'Cebuano', value: 'ceb' },
];

export default function Profile() {
  const { session, snapshot, outcomes, queued, preferences, updatePreferences, lock, logout, sync, preview, apiUrl } = useApp();
  const theme = useTheme();
  const router = useRouter();

  const coins = snapshot.progress?.coinBalance ?? session?.user.coins ?? 0;
  const skills = snapshot.progress?.skills ?? [];
  const mastered = skills.filter((skill) => skill.mastery >= 0.9).length;
  const classroom = snapshot.classrooms[0];
  const school = snapshot.schools.find((item) => item.id === classroom?.schoolId);

  const stats = [
    { value: coins, label: 'Khan-Coins', color: theme.text },
    { value: mastered, label: 'skills mastered', color: tokens.state.success },
    { value: outcomes.length, label: 'answers confirmed', color: theme.text },
  ];

  const account = [
    { icon: Repeat2, tint: tokens.tint.sky, color: tokens.brand.sky, title: 'Switch profile', detail: 'Shared tablet — reopen another learner' },
    { icon: Download, tint: tokens.tint.limeDeep, color: tokens.brand.limeDeep, title: 'Downloaded content', detail: `${snapshot.downloads.length} pack${snapshot.downloads.length === 1 ? '' : 's'} on this device` },
    { icon: Globe, tint: tokens.tint.grape, color: tokens.brand.grape, title: 'Language', detail: `${languages.find((item) => item.value === preferences.language)?.label ?? 'English'} · hints and voice` },
    { icon: MapPin, tint: tokens.tint.sun, color: tokens.brand.sunDeep, title: 'Siklab hub locator', detail: 'Needs a hub directory from your LGU' },
  ];

  return (
    <Screen chrome title="My Profile" caption={`${session?.user.alias ?? ''} · ${session?.user.loginId ?? ''}`}>
      <BackLink label="Back" onPress={() => router.back()} />

      <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 22 }}>
        <View style={{ width: 68, height: 68, borderRadius: radius.md, backgroundColor: tokens.brand.sun, alignItems: 'center', justifyContent: 'center' }}>
          <T variant="displayL" color="#ffffff">{initials(session?.user.alias ?? '')}</T>
        </View>
        <T variant="displayL">{session?.user.alias}</T>
        <T variant="bodyS" color={theme.muted} style={{ textAlign: 'center' }}>
          {[classroom?.name, school?.name, session ? roleName(session.user.role) : null].filter(Boolean).join(' · ')}
        </T>
        <T variant="dataS" color={theme.navActive}>{`Anonymised ID · ${session?.user.loginId ?? '—'}`}</T>
      </Card>

      <Row style={{ gap: 11, alignItems: 'stretch' }}>
        {stats.map((stat) => (
          <Card key={stat.label} style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 16 }}>
            <T variant="displayL" color={stat.color}>{stat.value}</T>
            <T variant="bodyS" color={theme.muted} style={{ textAlign: 'center' }}>{stat.label}</T>
          </Card>
        ))}
      </Row>

      <Eyebrow>Account</Eyebrow>
      {account.map((item, index) => (
        <Card key={item.title} index={index}>
          <Row style={{ gap: 11 }}>
            <IconTile icon={item.icon} color={item.color} tint={item.tint} />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="titleS">{item.title}</T>
              <T variant="bodyS" color={theme.muted}>{item.detail}</T>
            </View>
          </Row>
        </Card>
      ))}

      <Eyebrow>Appearance</Eyebrow>
      <Pills items={appearances} value={preferences.appearance} onChange={(value) => { void updatePreferences({ appearance: value }); }} />

      <Eyebrow>Hint language</Eyebrow>
      <Pills items={languages} value={preferences.language} onChange={(value) => { void updatePreferences({ language: value }); }} />

      <Eyebrow>This device</Eyebrow>
      <Card style={{ gap: 11 }}>
        <Row style={{ gap: 9 }}>
          <Wifi size={17} color={theme.muted} />
          <T variant="bodyS" color={theme.secondary} style={{ flex: 1 }}>
            {preferences.wifiOnly ? 'Syncs on Wi-Fi only' : 'Syncs on any connection'}
          </T>
          <Action title={preferences.wifiOnly ? 'On' : 'Off'} variant="soft" task={() => updatePreferences({ wifiOnly: !preferences.wifiOnly })} />
        </Row>
        <Row style={{ gap: 9 }}>
          <Languages size={17} color={theme.muted} />
          <T variant="bodyS" color={theme.secondary} style={{ flex: 1 }}>{preview ? 'Design preview — no server' : apiUrl}</T>
        </Row>
        <Row style={{ gap: 9 }}>
          <Lock size={17} color={theme.muted} />
          <T variant="bodyS" color={theme.secondary} style={{ flex: 1 }}>
            {session ? `Offline access until ${new Date(session.offlineUntil).toLocaleDateString()}` : '—'}
          </T>
        </Row>
        {queued.length ? <Pill color={tokens.brand.sunDeep} tint={tokens.tint.sun}>{`${queued.length} answer${queued.length === 1 ? '' : 's'} queued · last sync ${ago(snapshot.refreshedAt).toLowerCase()}`}</Pill> : null}
      </Card>

      <Action title="Sync now" variant="soft" task={sync} />
      <Action title="Lock this device" variant="outline" icon={Lock} task={async () => { lock(); }} />
      <Action title="Sign out" variant="danger" icon={LogOut} task={logout} />
      <T variant="bodyS" color={theme.muted} style={{ textAlign: 'center' }}>
        Signing out keeps saved answers on this device. Sign in again to send them.
      </T>
    </Screen>
  );
}
