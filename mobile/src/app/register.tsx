import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IdCard, ShieldCheck } from 'lucide-react-native';

import { Card, Info, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { radius, tokens, useTheme } from '@/ui/theme';

/**
 * Accounts are provisioned by an LGU administrator — the API has no public
 * registration endpoint — so this explains how to get an ID rather than
 * pretending to create one.
 */
export default function Register() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <Screen refreshable={false} statusBarStyle="light" contentStyle={{ paddingHorizontal: 0, paddingTop: 0, gap: 0 }}>
      <LinearGradient
        colors={['#0c4a3e', '#17604f']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 26, paddingBottom: 34, paddingHorizontal: 24, alignItems: 'center', gap: 10, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg }}
      >
        <Image source={require('@/assets/images/kgo-logo.png')} style={{ width: 64, height: 64, borderRadius: radius.md }} contentFit="contain" />
        <T variant="displayL" color="#ffffff">K-Go Quests</T>
        <T variant="bodyS" color="#ffffff" style={{ opacity: 0.72, textAlign: 'center' }}>Learning that reaches every barangay</T>
      </LinearGradient>

      <View style={{ paddingHorizontal: 20, paddingTop: 22, gap: 14 }}>
        <View style={{ gap: 5 }}>
          <T variant="displayL" style={{ fontSize: 28, lineHeight: 33 }}>Create your quest ID</T>
          <T variant="bodyM" color={theme.muted}>Your name never leaves the tablet — you get an anonymised system ID.</T>
        </View>

        <Card style={{ gap: 12 }}>
          <Row style={{ gap: 11 }}>
            <View style={{ width: 38, height: 38, borderRadius: radius.sm, backgroundColor: tokens.tint.forestBright, alignItems: 'center', justifyContent: 'center' }}>
              <IdCard size={19} color={theme.navActive} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="titleS">Your school issues the ID</T>
              <T variant="bodyS" color={theme.muted}>
                A teacher or LGU administrator creates learner IDs in the K-Go console. Ask yours for a quest ID and a starting password.
              </T>
            </View>
          </Row>
        </Card>

        <Info
          icon={ShieldCheck}
          color={tokens.state.success}
          title="Stored as an anonymised ID"
          text="No photos, no location, no personal identifiers. Guardian consent and retention follow the Data Privacy Act of 2012."
        />

        <Row style={{ justifyContent: 'center', gap: 5, paddingTop: 10, paddingBottom: 24 }}>
          <T variant="bodyS" color={theme.muted}>Already have an account?</T>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <T variant="titleS" color={theme.navActive}>Log in</T>
          </Pressable>
        </Row>
      </View>
    </Screen>
  );
}
