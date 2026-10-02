import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Delete, Lock, ShieldCheck } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { initials } from '@/domain/format';
import { Card, IconBox, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { palette, useTheme } from '@/ui/theme';

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export default function LockScreen() {
  const { session, pinConfigured, unlock, setPin, logout, toast } = useApp();
  const theme = useTheme();
  const [entry, setEntry] = useState('');
  const [confirming, setConfirming] = useState('');
  const [working, setWorking] = useState(false);

  const creating = !pinConfigured;
  const stage = creating && confirming ? 'confirm' : creating ? 'create' : 'unlock';
  const heading = stage === 'confirm' ? 'Repeat your PIN' : stage === 'create' ? 'Create a 6-digit PIN' : 'Enter your PIN';
  const caption = stage === 'unlock'
    ? 'Your saved lessons and answers stay on this device.'
    : 'You will use this PIN to open K-Go Quests without a connection.';

  const submit = async (value: string) => {
    setWorking(true);
    try {
      if (stage === 'create') { setConfirming(value); setEntry(''); return; }
      if (stage === 'confirm') {
        if (value !== confirming) { setConfirming(''); setEntry(''); throw new Error('Those PINs did not match. Start again.'); }
        await setPin(value);
        return;
      }
      await unlock(value);
    } catch (error) {
      setEntry('');
      toast(error instanceof Error ? error.message : 'That did not work. Try again.', 'error');
    } finally {
      setWorking(false);
    }
  };

  const press = (key: string) => {
    if (working) return;
    if (key === 'del') { setEntry((current) => current.slice(0, -1)); return; }
    if (!key || entry.length >= 6) return;
    const next = entry + key;
    setEntry(next);
    if (next.length === 6) void submit(next);
  };

  return (
    <Screen refreshable={false} contentStyle={{ justifyContent: 'center', flexGrow: 1, maxWidth: 420 }}>
      <View style={{ alignItems: 'center', gap: 14 }}>
        <IconBox icon={creating ? ShieldCheck : Lock} size={58} color={palette.green} />
        <T heading size={25} style={{ textAlign: 'center' }}>{heading}</T>
        <T size={12} color={theme.muted} style={{ textAlign: 'center', maxWidth: 290 }}>{caption}</T>
      </View>

      {session ? (
        <Card style={{ alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16 }}>
          <Row style={{ gap: 10 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.soft, alignItems: 'center', justifyContent: 'center' }}>
              <T size={12} bold>{initials(session.user.alias)}</T>
            </View>
            <T size={12} bold>{session.user.alias}</T>
          </Row>
        </Card>
      ) : null}

      <Row style={{ justifyContent: 'center', gap: 13, marginVertical: 10 }}>
        {Array.from({ length: 6 }, (_, index) => (
          <View
            key={index}
            style={{
              width: 15, height: 15, borderRadius: 8, borderWidth: 1.5,
              borderColor: index < entry.length ? palette.green : theme.border,
              backgroundColor: index < entry.length ? palette.green : 'transparent',
            }}
          />
        ))}
      </Row>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
        {keys.map((key, index) => (
          <Pressable
            key={`${key}-${index}`}
            disabled={!key || working}
            accessibilityRole="button"
            accessibilityLabel={key === 'del' ? 'Delete last digit' : key || undefined}
            onPress={() => press(key)}
            style={({ pressed }) => ({
              width: 76, height: 62, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
              backgroundColor: key ? theme.card : 'transparent',
              borderWidth: key ? 1 : 0, borderColor: theme.border,
              opacity: pressed && key ? 0.6 : 1,
            })}
          >
            {key === 'del' ? <Delete size={21} color={theme.text} /> : <T heading size={22}>{key}</T>}
          </Pressable>
        ))}
      </View>

      <Pressable accessibilityRole="button" onPress={() => { void logout(); }} style={{ padding: 14, alignItems: 'center' }}>
        <T size={12} color={palette.blue} bold>Use a different account</T>
      </Pressable>
    </Screen>
  );
}
