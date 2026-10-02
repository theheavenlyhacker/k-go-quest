import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Flame, Gift, Ticket } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { ago } from '@/domain/format';
import { Action, Bar, Card, Empty, Eyebrow, IconTile, Pill, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { tokens, useTheme } from '@/ui/theme';

export default function Rewards() {
  const { session, snapshot, redeem } = useApp();
  const theme = useTheme();
  const router = useRouter();
  const coins = snapshot.progress?.coinBalance ?? session?.user.coins ?? 0;
  const affordable = snapshot.rewards.filter((reward) => reward.cost > coins).sort((a, b) => a.cost - b.cost);
  const next = affordable[0];

  return (
    <Screen chrome title="My Rewards" caption="Redeem Khan-Coins at the hub">
      <Card style={{ backgroundColor: tokens.tint.sun, borderColor: `${tokens.brand.sun}80`, gap: 11 }}>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Eyebrow>Khan-Coins</Eyebrow>
            <T variant="displayL" style={{ fontSize: 34, lineHeight: 38 }}>{coins}</T>
          </View>
          {snapshot.vouchers.length ? <Pill color={tokens.state.success} tint={tokens.tint.success}>{`${snapshot.vouchers.length} voucher${snapshot.vouchers.length === 1 ? '' : 's'}`}</Pill> : null}
        </Row>
        {next ? (
          <>
            <Row style={{ gap: 8 }}>
              <T variant="bodyS" color={theme.secondary} style={{ flex: 1 }}>Next voucher unlock</T>
              <T variant="dataS" color={theme.secondary}>{`${coins} / ${next.cost}`}</T>
            </Row>
            <Bar value={coins / next.cost} color={tokens.brand.sunDeep} />
            <Row style={{ gap: 7 }}>
              <Flame size={14} color={tokens.state.critical} />
              <T variant="bodyS" color={theme.secondary}>{`${next.cost - coins} coins to the ${next.title}.`}</T>
            </Row>
          </>
        ) : (
          <T variant="bodyS" color={theme.secondary}>You can afford every reward on offer right now.</T>
        )}
      </Card>

      {snapshot.vouchers.length ? (
        <>
          <Eyebrow>Your vouchers</Eyebrow>
          {snapshot.vouchers.map((voucher, index) => {
            const reward = snapshot.rewards.find((item) => item.id === voucher.redemption.rewardId);
            const claimed = voucher.redemption.status === 'CLAIMED';
            return (
              <Card key={voucher.redemption.id} index={index} onPress={() => router.push({ pathname: '/voucher', params: { id: voucher.redemption.id } })}>
                <Row style={{ gap: 11 }}>
                  <IconTile icon={Ticket} color={claimed ? theme.muted : tokens.state.success} tint={claimed ? theme.surfaceAlt : tokens.tint.success} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="titleS" lines={1}>{reward?.title ?? 'Reward voucher'}</T>
                    <T variant="bodyS" color={theme.muted}>{`${voucher.redemption.cost} Khan-Coins · issued ${ago(voucher.redemption.createdAt).toLowerCase()}`}</T>
                  </View>
                  <Pill color={claimed ? theme.muted : tokens.state.success} tint={claimed ? theme.surfaceAlt : tokens.tint.success}>
                    {claimed ? 'Claimed' : 'Ready'}
                  </Pill>
                </Row>
              </Card>
            );
          })}
        </>
      ) : null}

      <Eyebrow>Available at your hub</Eyebrow>
      {snapshot.rewards.length ? (
        snapshot.rewards.map((reward, index) => {
          const unlockable = coins >= reward.cost && reward.stock > 0;
          return (
            <Card key={reward.id} index={index} style={{ gap: 11 }}>
              <Row style={{ alignItems: 'flex-start', gap: 11 }}>
                <IconTile icon={Gift} color={unlockable ? tokens.brand.limeDeep : theme.muted} tint={unlockable ? tokens.tint.limeDeep : theme.surfaceAlt} />
                <View style={{ flex: 1, gap: 3 }}>
                  <T variant="titleS">{reward.title}</T>
                  <T variant="bodyS" color={theme.muted}>
                    {reward.stock > 0 ? `${reward.stock} left at the hub` : 'Out of stock'}
                  </T>
                </View>
                <Pill color={tokens.brand.sunDeep} tint={tokens.tint.sun}>{`${reward.cost} KC`}</Pill>
              </Row>
              <Row style={{ gap: 11 }}>
                <T variant="bodyS" color={theme.muted} style={{ flex: 1 }}>
                  {reward.stock < 1 ? 'Unavailable' : unlockable ? 'Ready to redeem' : `${reward.cost - coins} more coins needed`}
                </T>
                <Action
                  title="Unlock"
                  variant={unlockable ? 'accent' : 'outline'}
                  disabled={!unlockable}
                  style={{ paddingHorizontal: 26 }}
                  task={async () => {
                    const voucher = await redeem(reward);
                    router.push({ pathname: '/voucher', params: { id: voucher.redemption.id } });
                  }}
                />
              </Row>
            </Card>
          );
        })
      ) : (
        <Empty icon={Gift} title="No rewards yet" text="Your LGU has not published rewards for this jurisdiction. Your coins keep adding up in the meantime." />
      )}
    </Screen>
  );
}
