import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Delete, Lock } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { initials } from '@/domain/format';
import { Card, IconBox, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { palette, useTheme } from '@/ui/theme';

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export default function LockScreen() {
  const { profile, unlock, selectProfile, toast } = useApp();
  const theme = useTheme();
  const [entry, setEntry] = useState('');
  const [working, setWorking] = useState(false);

  const submit = async (value: string) => {
    setWorking(true);
    try {
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
    <Screen contentStyle={{ justifyContent: 'center', flexGrow: 1, maxWidth: 420 }}>
      <View style={{ alignItems: 'center', gap: 14 }}>
        <IconBox icon={Lock} size={58} color={palette.green} />
        <T heading size={25} style={{ textAlign: 'center' }}>Enter your PIN</T>
        <T size={12} color={theme.muted} style={{ textAlign: 'center', maxWidth: 290 }}>Your saved lessons and answers stay on this device.</T>
      </View>

      {profile ? (
        <Card style={{ alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 16 }}>
          <Row style={{ gap: 10 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.soft, alignItems: 'center', justifyContent: 'center' }}>
              <T size={12} bold>{initials(profile.alias)}</T>
            </View>
            <T size={12} bold>{profile.alias}</T>
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

      <Pressable accessibilityRole="button" onPress={() => selectProfile(null)} style={{ padding: 14, alignItems: 'center' }}>
        <T size={12} color={palette.blue} bold>Switch profile</T>
      </Pressable>
    </Screen>
  );
}
