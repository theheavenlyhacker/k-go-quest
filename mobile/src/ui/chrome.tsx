import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Award, BookOpen, Check, ChevronRight, CircleHelp, Coins, Download, Gift, Globe, Info, Layers, LayoutGrid, LogOut, MapPin, Repeat2, School, ShieldCheck, Smartphone, Sparkles, Trophy, UserCog, UserPlus, Users, ClipboardList, ChartColumn } from 'lucide-react-native';

import { useApp } from '../state/app-context';
import { initials } from '../domain/format';
import { elevation, radius, tokens, useTheme } from './theme';
import { Eyebrow, Pill, Pills, Row, T } from './primitives';

const SIDEBAR_WIDTH = 293;

export interface SyncPulse {
  /** Logs in the outbox when this sync started. */
  pushed: number;
  /** Seconds the sync took, for the "pushed in 5 s" line. */
  seconds: number;
}

/**
 * Watches the sync lifecycle so the app bar and status strip can show
 * "Syncing N logs…" while it runs and "Synced · just now" briefly after.
 */
export function useSyncPulse() {
  const { syncing, queued } = useApp();
  const [done, setDone] = useState<SyncPulse | null>(null);
  const started = useRef<{ at: number; count: number } | null>(null);
  const was = useRef(syncing);

  useEffect(() => {
    if (syncing && !was.current) {
      started.current = { at: Date.now(), count: queued.length };
      setDone(null);
    }
    if (!syncing && was.current && started.current) {
      const { at, count } = started.current;
      started.current = null;
      if (count > 0) setDone({ pushed: count, seconds: Math.max(1, Math.round((Date.now() - at) / 1000)) });
    }
    was.current = syncing;
  }, [syncing, queued.length]);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(null), 6000);
    return () => clearTimeout(timer);
  }, [done]);

  return { syncing, justSynced: done };
}

/** App Bar (443:34): hamburger, title + subtitle, live sync pill. */
export function AppBar({ title, subtitle, onMenu }: { title: string; subtitle?: string; onMenu: () => void }) {
  const { online, syncing, queued, preview } = useApp();
  const { justSynced } = useSyncPulse();
  const insets = useSafeAreaInsets();
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = syncing
      ? withRepeat(withTiming(0.25, { duration: 620, easing: Easing.inOut(Easing.quad) }), -1, true)
      : withTiming(1, { duration: 200 });
  }, [syncing, pulse]);
  const dot = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const live = preview
    ? tokens.brand.grape
    : syncing ? tokens.brand.sun
    : justSynced ? '#ffffff'
    : online ? tokens.state.success
    : tokens.brand.sun;
  const label = preview
    ? 'Preview'
    : syncing ? `Syncing ${queued.length} log${queued.length === 1 ? '' : 's'}…`
    : justSynced ? 'Synced · just now'
    : online ? 'Online'
    : `Offline · ${queued.length} queued`;
  // 01d fills the pill rather than tinting it, so a finished sync reads at a glance.
  const pillFill = justSynced && !syncing ? tokens.brand.limeDeep : 'rgba(255,255,255,0.14)';
  const pillBorder = justSynced && !syncing ? tokens.brand.limeDeep : 'rgba(255,255,255,0.18)';

  return (
    <View style={[{ backgroundColor: '#0c4a3e', paddingTop: insets.top + 2, paddingBottom: 16, paddingHorizontal: 18, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg }, elevation.appbar]}>
      <Row style={{ gap: 13 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Open menu" onPress={onMenu} hitSlop={12} style={{ gap: 4.5 }}>
          {[20, 14, 18].map((width, index) => (
            <View key={index} style={{ width, height: 2, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.92)' }} />
          ))}
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="displayL" color="#ffffff" lines={1}>{title}</T>
          {subtitle ? <T variant="bodyS" color="#ffffff" style={{ opacity: 0.72 }} lines={1}>{subtitle}</T> : null}
        </View>
        <Row style={{ gap: 6, backgroundColor: pillFill, borderWidth: 1, borderColor: pillBorder, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill }}>
          <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: live }, dot]} />
          <T variant="labelPill" color="#ffffff">{label}</T>
        </Row>
      </Row>
    </View>
  );
}

/** Nav Bar · Student (472:152): indicator sits above the glyph. */
const TABS = [
  // Nav Bar · Student (472:152)
  { name: 'learn', label: 'Learn', icon: BookOpen },
  { name: 'league', label: 'League', icon: Trophy },
  { name: 'tutor', label: 'Tutor', icon: Sparkles },
  { name: 'progress', label: 'Progress', icon: ChartColumn },
  { name: 'rewards', label: 'Rewards', icon: Gift },
  // Nav Bar · Teacher
  { name: 'class', label: 'Class', icon: LayoutGrid },
  { name: 'learners', label: 'Learners', icon: Users },
  { name: 'alerts', label: 'Alerts', icon: ShieldCheck },
  { name: 'quiz', label: 'Quiz', icon: ClipboardList },
  { name: 'grow', label: 'Grow', icon: Award },
  // Nav Bar · LGU Admin
  { name: 'schools', label: 'Schools', icon: School },
  { name: 'impact', label: 'Impact', icon: ChartColumn },
  { name: 'devices', label: 'Devices', icon: Smartphone },
  { name: 'content', label: 'Content', icon: Layers },
  { name: 'users', label: 'Users', icon: UserPlus },
] as const;

/** Shape of the slice of the tab-bar props this component reads. */
export interface NavBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit(event: { type: 'tabPress'; target: string; canPreventDefault: true }): { defaultPrevented: boolean };
    navigate(name: string): void;
  };
}

export function NavBar({ state, navigation }: NavBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 7, paddingBottom: 9 + insets.bottom, paddingHorizontal: 4, flexDirection: 'row' }}>
      {state.routes.map((route, index) => {
        const tab = TABS.find((item) => item.name === route.name);
        if (!tab) return null;
        const active = state.index === index;
        return (
          <NavTab
            key={route.key}
            label={tab.label}
            icon={tab.icon}
            active={active}
            color={active ? theme.navActive : theme.muted}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!active && !event.defaultPrevented) navigation.navigate(route.name);
            }}
          />
        );
      })}
    </View>
  );
}

function NavTab({ label, icon: Icon, active, color, onPress }: { label: string; icon: typeof BookOpen; active: boolean; color: string; onPress: () => void }) {
  const progress = useSharedValue(active ? 1 : 0);
  useEffect(() => { progress.value = withSpring(active ? 1 : 0, { damping: 16, stiffness: 240 }); }, [active, progress]);
  const indicator = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ scaleX: 0.4 + progress.value * 0.6 }] }));
  const glyph = useAnimatedStyle(() => ({ transform: [{ translateY: -progress.value * 1.5 }] }));
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label} onPress={onPress} style={{ flex: 1, alignItems: 'center', gap: 3, paddingBottom: 4 }}>
      <Animated.View style={[{ width: 22, height: 3, borderRadius: 2, backgroundColor: tokens.brand.limeDeep }, indicator]} />
      <Animated.View style={glyph}><Icon size={21} color={color} strokeWidth={active ? 2.1 : 1.8} /></Animated.View>
      <T variant="labelNav" color={color}>{label}</T>
    </Pressable>
  );
}

/**
 * The strip above the nav bar in 01c / 01d: forest background, a line about
 * what the sync is doing, and nothing at all when idle.
 */
export function SyncBanner() {
  const { preview } = useApp();
  const { syncing, justSynced } = useSyncPulse();
  if (preview || (!syncing && !justSynced)) return null;
  const Icon = syncing ? Info : Check;
  const message = syncing
    ? 'Hub node detected — encrypted burst sync started'
    : `${justSynced?.pushed} progress log${justSynced?.pushed === 1 ? '' : 's'} pushed in ${justSynced?.seconds} s · league updated`;
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(220)}
      pointerEvents="none"
      style={{
        position: 'absolute', left: 14, right: 14, bottom: 12,
        backgroundColor: '#0c4a3e', borderRadius: radius.md,
        paddingHorizontal: 15, paddingVertical: 14,
        flexDirection: 'row', alignItems: 'center', gap: 11,
      }}
    >
      <Icon size={18} color={tokens.brand.limeDeep} />
      <T variant="bodyM" color="#ffffff" style={{ flex: 1 }}>{message}</T>
    </Animated.View>
  );
}

/** Sidebar Menu (455:301): slides in over a scrim. */
export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session, snapshot, preferences, updatePreferences, logout, toast } = useApp();
  const theme = useTheme();
  const router = useRouter();
  const shift = useSharedValue(open ? 0 : -SIDEBAR_WIDTH);
  useEffect(() => { shift.value = withSpring(open ? 0 : -SIDEBAR_WIDTH, { damping: 22, stiffness: 210 }); }, [open, shift]);
  const panel = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value }] }));
  const scrim = useAnimatedStyle(() => ({ opacity: 1 - Math.abs(shift.value) / SIDEBAR_WIDTH }));
  const coins = snapshot.progress?.coinBalance ?? session?.user.coins ?? 0;
  const megabytes = Math.round(JSON.stringify(snapshot.downloads).length / 1024);

  if (!open) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,30,25,0.5)' }, scrim]}>
        <Pressable accessibilityLabel="Close menu" onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, width: SIDEBAR_WIDTH, backgroundColor: theme.surface }, panel]}>
        <SidebarBody
          alias={session?.user.alias ?? 'Learner'}
          detail={snapshot.classrooms[0]?.name ?? 'No classroom yet'}
          coins={coins}
          megabytes={megabytes}
          language={preferences.language}
          appearance={preferences.appearance}
          onAppearance={(value) => { void updatePreferences({ appearance: value }); }}
          onProfile={() => { onClose(); router.push('/profile'); }}
          onClose={onClose}
          onLogout={() => { onClose(); void logout().catch((error: unknown) => toast(error instanceof Error ? error.message : 'Sign out failed.', 'error')); }}
        />
      </Animated.View>
    </View>
  );
}

function SidebarBody({ alias, detail, coins, megabytes, language, appearance, onAppearance, onProfile, onClose, onLogout }: {
  alias: string; detail: string; coins: number; megabytes: number; language: string;
  appearance: 'light' | 'dark' | 'system'; onAppearance: (value: 'light' | 'dark' | 'system') => void;
  onProfile: () => void; onClose: () => void; onLogout: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const languageLabel = language === 'tl' ? 'Tagalog' : language === 'ceb' ? 'Cebuano' : 'English';
  const items = [
    { icon: UserCog, label: 'My Profile', value: undefined as string | undefined, active: true, onPress: onProfile },
    { icon: Repeat2, label: 'Switch Profile', value: undefined, active: false, onPress: onClose },
    { icon: Download, label: 'Downloaded Content', value: `${megabytes} MB`, active: false, onPress: undefined },
    { icon: Globe, label: 'Language', value: languageLabel, active: false, onPress: undefined },
    { icon: MapPin, label: 'Siklab Hub Locator', value: undefined, active: false, onPress: undefined },
    { icon: CircleHelp, label: 'Help & FAQ', value: undefined, active: false, onPress: undefined },
  ];
  return (
    <View style={{ flex: 1 }}>
      <Row style={{ gap: 12, paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: tokens.tint.forestBright, alignItems: 'center', justifyContent: 'center' }}>
          <T variant="titleM" color={theme.navActive}>{initials(alias)}</T>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="titleM" lines={1}>{alias}</T>
          <T variant="bodyS" color={theme.muted} lines={1}>{detail}</T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={onClose} hitSlop={10}>
          <T variant="titleM" color={theme.muted}>✕</T>
        </Pressable>
      </Row>

      <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4, flexDirection: 'row' }}>
        <Pill color={tokens.brand.sunDeep} tint={tokens.tint.sun} icon={Coins}>{`${coins} Khan-Coins`}</Pill>
      </View>

      <View style={{ paddingHorizontal: 8, paddingVertical: 10, gap: 2 }}>
        {items.map((item, index) => (
          <Animated.View key={item.label} entering={FadeIn.delay(60 + index * 35).duration(220)}>
            <Pressable
              accessibilityRole="button" disabled={!item.onPress} onPress={item.onPress}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: radius.sm, backgroundColor: item.active ? tokens.tint.lime : 'transparent', opacity: pressed && item.onPress ? 0.65 : 1 })}
            >
              <item.icon size={19} color={theme.text} strokeWidth={1.8} />
              <T variant={item.active ? 'titleS' : 'bodyM'} style={{ flex: 1 }}>{item.label}</T>
              {item.value ? <T variant="bodyS" color={theme.muted}>{item.value}</T> : null}
              <ChevronRight size={15} color={theme.muted} />
            </Pressable>
          </Animated.View>
        ))}
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 8 }}>
        <Eyebrow>Appearance</Eyebrow>
        <Pills
          items={[{ label: 'Light', value: 'light' as const }, { label: 'Dark', value: 'dark' as const }, { label: 'System', value: 'system' as const }]}
          value={appearance}
          onChange={onAppearance}
        />
        <T variant="bodyS" color={theme.muted}>Dims every screen for shared tablets after dark.</T>
      </View>

      <View style={{ flex: 1 }} />
      <Pressable
        accessibilityRole="button" onPress={onLogout}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 18, paddingTop: 16, paddingBottom: insets.bottom + 22, borderTopWidth: 1, borderTopColor: theme.border, opacity: pressed ? 0.6 : 1 })}
      >
        <LogOut size={17} color={tokens.state.critical} strokeWidth={1.8} />
        <T variant="titleM" color={tokens.state.critical}>Logout</T>
      </Pressable>
    </View>
  );
}
