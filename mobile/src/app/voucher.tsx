import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { Button, Card, Empty, IconTile, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { radius, tokens, useTheme } from '@/ui/theme';

/** Short human-readable code printed under the QR, derived from the id. */
const shortCode = (id: string, cost: number) => `KGQ-${id.replace(/[^0-9a-z]/gi, '').slice(0, 2).toUpperCase()}-${cost}${id.replace(/[^0-9a-z]/gi, '').slice(2, 4).toUpperCase()}`;

export default function VoucherScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { snapshot } = useApp();
  const theme = useTheme();
  const router = useRouter();

  const voucher = snapshot.vouchers.find((item) => item.redemption.id === id);
  if (!voucher) {
    return (
      <Screen chrome title="Voucher" caption="Not found on this device">
        <Empty title="No such voucher" text="Open it again from My Rewards. Vouchers stay on the device they were issued to." />
      </Screen>
    );
  }

  const reward = snapshot.rewards.find((item) => item.id === voucher.redemption.rewardId);
  const claimed = voucher.redemption.status === 'CLAIMED';
  const preview = voucher.claimMode === 'DESIGN_PREVIEW';

  return (
    <Screen chrome title="Voucher" caption="Show this at the Siklab hub">
      <Card style={{ alignItems: 'center', gap: 14, paddingVertical: 24 }}>
        <IconTile icon={Check} color={claimed ? theme.muted : tokens.brand.limeDeep} tint={claimed ? theme.surfaceAlt : tokens.tint.lime} size={56} />
        <T variant="displayL">{claimed ? 'Voucher claimed' : 'Voucher ready'}</T>
        <T variant="bodyM" color={theme.muted} style={{ textAlign: 'center' }}>
          {`${reward?.title ?? 'Reward'} · ${voucher.redemption.cost} Khan-Coins`}
        </T>
        <View style={{ padding: 18, backgroundColor: '#ffffff', borderRadius: radius.md, borderWidth: 1, borderColor: theme.border }}>
          <QRCode value={voucher.qrToken} size={150} backgroundColor="#ffffff" color="#0c4a3e" />
        </View>
        <T variant="dataS" color={theme.navActive} style={{ fontSize: 13, letterSpacing: 1.4 }}>
          {shortCode(voucher.redemption.id, voucher.redemption.cost)}
        </T>
        <T variant="bodyS" color={theme.muted} style={{ textAlign: 'center', maxWidth: 280 }}>
          {preview
            ? 'This is a sample voucher from the design preview. It cannot be redeemed.'
            : 'Show this at your barangay Siklab hub. The hub scanner reads it offline.'}
        </T>
      </Card>
      <Button title="Back to rewards" onPress={() => router.back()} />
    </Screen>
  );
}
