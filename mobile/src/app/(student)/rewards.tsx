import { Pressable, View } from 'react-native';
import { Award, BookOpen, Crown, Flame, Rocket, Star } from 'lucide-react-native';

import { CATALOG, type Cosmetic } from '@/domain/shop';
import { useApp } from '@/state/app-context';
import { Bar, Card, Eyebrow, Pill, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { radius, tokens, useTheme } from '@/ui/theme';

/** Each badge's glyph and tint, keyed by catalogue id. */
const LOOK: Record<string, { icon: typeof Award; color: string; tint: string }> = {
  'badge-star': { icon: Star, color: tokens.brand.sunDeep, tint: tokens.tint.sun },
  'badge-book': { icon: BookOpen, color: tokens.brand.limeDeep, tint: tokens.tint.lime },
  'badge-rocket': { icon: Rocket, color: tokens.brand.sky, tint: tokens.tint.sky },
  'badge-crown': { icon: Crown, color: tokens.brand.grape, tint: tokens.tint.grape },
};

/**
 * My Rewards — 05 · My Rewards (451:202).
 *
 * The design redeems vouchers at a barangay hub, which needs a server and a
 * supply chain. What a Learner can actually unlock on this tablet today is a
 * Cosmetic, bought with Coins, so that is what fills the same cards. Coins have
 * no value outside the app, and a Cosmetic never changes what or how a Learner
 * practises.
 */
export default function Rewards() {
  const { balance, purchases, buyBadge, toast } = useApp();
  const theme = useTheme();
  const owned = new Set(purchases.map((p) => p.cosmeticId));
  const next = CATALOG.filter((item) => !owned.has(item.id)).sort((a, b) => a.price - b.price)[0];

  return (
    <Screen chrome title="My Rewards" caption="Spend Coins on badges">
      {/* khan-coins (451:204) */}
      <Card style={{ backgroundColor: tokens.tint.sun, borderColor: tokens.brand.sun, gap: 11 }}>
        <Row style={{ gap: 10, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Eyebrow>Coins</Eyebrow>
            <T variant="displayXL">{balance}</T>
          </View>
          <Pill color={tokens.state.success} tint={tokens.tint.success}>{`${owned.size} of ${CATALOG.length} owned`}</Pill>
        </Row>
        {next ? (
          <>
            <Row style={{ gap: 8 }}>
              <T variant="bodyS" color={theme.secondary} style={{ flex: 1 }}>Next badge unlock</T>
              <T variant="dataS" color={theme.secondary}>{`${balance} / ${next.price}`}</T>
            </Row>
            <Bar value={next.price ? balance / next.price : 1} color={tokens.brand.sunDeep} />
            <Row style={{ gap: 7 }}>
              <Flame size={13} color={tokens.brand.sunDeep} />
              <T variant="bodyS" color={theme.secondary} style={{ flex: 1 }}>
                {balance >= next.price
                  ? `Enough for the ${next.name}.`
                  : `${next.price - balance} more Coins for the ${next.name}.`}
              </T>
            </Row>
          </>
        ) : (
          <Row style={{ gap: 7 }}>
            <Flame size={13} color={tokens.brand.sunDeep} />
            <T variant="bodyS" color={theme.secondary} style={{ flex: 1 }}>Every badge on this tablet is yours. Coins keep adding up.</T>
          </Row>
        )}
      </Card>

      <Eyebrow>Available on this tablet</Eyebrow>

      {CATALOG.map((item, index) => (
        <Badge
          key={item.id}
          item={item}
          index={index}
          owned={owned.has(item.id)}
          balance={balance}
          onBuy={async () => { await buyBadge(item.id); toast(`You got the ${item.name}!`, 'success'); }}
        />
      ))}
    </Screen>
  );
}

/** voucher/… (451:221): icon, name, category, price, blurb, then one clear action. */
function Badge({ item, index, owned, balance, onBuy }: { item: Cosmetic; index: number; owned: boolean; balance: number; onBuy: () => Promise<void> }) {
  const theme = useTheme();
  const look = LOOK[item.id] ?? { icon: Award, color: tokens.brand.sunDeep, tint: tokens.tint.sun };
  const Icon = look.icon;
  const affordable = balance >= item.price;
  return (
    <Card index={index} style={{ gap: 9 }}>
      <Row style={{ gap: 11 }}>
        <View style={{ width: 38, height: 38, borderRadius: radius.sm, backgroundColor: look.tint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={19} color={look.color} strokeWidth={1.9} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <T variant="titleM">{item.name}</T>
          <Eyebrow>{item.category}</Eyebrow>
        </View>
        <Pill color={tokens.brand.sunDeep} tint={tokens.tint.sun}>{`${item.price} Coins`}</Pill>
      </Row>
      <T variant="bodyS" color={theme.secondary}>{item.blurb}</T>
      <Row style={{ gap: 8 }}>
        <T variant="bodyS" color={owned || affordable ? theme.secondary : theme.muted} style={{ flex: 1 }}>
          {owned ? 'Yours' : affordable ? 'Ready to unlock' : `Need ${item.price - balance} more Coins`}
        </T>
        {owned ? (
          <Pill color={tokens.state.success} tint={tokens.tint.success}>Owned</Pill>
        ) : (
          <Unlock name={item.name} disabled={!affordable} onPress={onBuy} />
        )}
      </Row>
    </Card>
  );
}

/** btn/sun and btn/ghost (451:234, 451:279): compact, right-aligned, two states only. */
function Unlock({ name, disabled, onPress }: { name: string; disabled: boolean; onPress: () => Promise<void> }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={disabled ? `${name} locked, not enough Coins` : `Unlock ${name}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => { void onPress().catch(() => undefined); }}
      style={({ pressed }) => ({
        minHeight: 44, minWidth: 44, paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
        backgroundColor: disabled ? 'transparent' : tokens.brand.sun,
        borderWidth: disabled ? 1 : 0, borderColor: theme.borderStrong,
        opacity: disabled ? 0.5 : pressed ? 0.78 : 1,
      })}
    >
      <T variant="titleS" color={disabled ? theme.muted : '#0c4a3e'}>{disabled ? 'Locked' : 'Unlock'}</T>
    </Pressable>
  );
}
