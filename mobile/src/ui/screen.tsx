import React, { useState } from 'react';
import { RefreshControl, ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useApp } from '../state/app-context';
import { tokens, useTheme } from './theme';
import { AppBar, Sidebar, SyncBanner } from './chrome';
import { Row, T } from './primitives';

/**
 * Page frame. `chrome` screens get the forest App Bar and the sidebar menu;
 * the auth and player screens opt out and render a plain heading instead.
 */
export function Screen({ title, caption, right, children, contentStyle, refreshable = true, chrome = false, statusBarStyle }: {
  title?: string;
  caption?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  contentStyle?: ViewStyle;
  refreshable?: boolean;
  chrome?: boolean;
  /** Light for screens whose top is the forest app bar or gradient; dark for
   *  the cream ones, where white status text would be invisible. */
  statusBarStyle?: 'light' | 'dark';
}) {
  const { busy, syncing, sync } = useApp();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [menu, setMenu] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: theme.page }}>
      <StatusBar style={statusBarStyle ?? (chrome || theme.dark ? 'light' : 'dark')} />
      {chrome ? <AppBar title={title ?? ''} subtitle={caption} onMenu={() => setMenu(true)} /> : null}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          {
            paddingHorizontal: 18,
            paddingTop: chrome ? 16 : insets.top + 16,
            paddingBottom: (chrome ? 24 : insets.bottom + 40),
            gap: 11,
            maxWidth: 640,
            width: '100%',
            alignSelf: 'center',
          },
          contentStyle,
        ]}
        refreshControl={refreshable ? <RefreshControl refreshing={busy || syncing} tintColor={tokens.brand.limeDeep} onRefresh={() => { void sync().catch(() => undefined); }} /> : undefined}
      >
        {!chrome && title ? (
          <Row style={{ alignItems: 'flex-start', marginBottom: 4 }}>
            <View style={{ flex: 1, gap: 3 }}>
              <T variant="displayL">{title}</T>
              {caption ? <T variant="bodyS" color={theme.muted}>{caption}</T> : null}
            </View>
            {right}
          </Row>
        ) : null}
        {chrome && right ? <View style={{ alignItems: 'flex-end' }}>{right}</View> : null}
        {children}
      </ScrollView>
      {chrome ? <SyncBanner /> : null}
      {chrome ? <Sidebar open={menu} onClose={() => setMenu(false)} /> : null}
    </View>
  );
}
