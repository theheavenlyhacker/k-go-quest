import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { initials } from '@/domain/format';
import { Button, Card, Eyebrow, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { useTheme } from '@/ui/theme';

/** Profile picker. Only the Caretaker, behind the Caretaker PIN, creates Profiles. */
export default function Picker() {
  const { profiles, selectProfile } = useApp();
  const theme = useTheme();
  const router = useRouter();
  return (
    <Screen title="Who is learning?" caption="Pick your name, then enter your PIN">
      <Eyebrow>Profiles on this tablet</Eyebrow>
      {profiles.map((p) => (
        <Card key={p.id} onPress={() => selectProfile(p.id)}>
          <Row style={{ gap: 12 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.soft, alignItems: 'center', justifyContent: 'center' }}>
              <T size={13} bold>{initials(p.alias)}</T>
            </View>
            <T variant="titleS">{p.alias}</T>
          </Row>
        </Card>
      ))}
      <Button title="Caretaker" icon={ShieldCheck} variant="soft" onPress={() => router.push('/caretaker-pin')} />
    </Screen>
  );
}
