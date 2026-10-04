import { View } from 'react-native';
import { Award } from 'lucide-react-native';

import { CATALOG } from '@/domain/shop';
import { useApp } from '@/state/app-context';
import { Action, Card, Eyebrow, IconTile, Pill, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { tokens } from '@/ui/theme';

export default function Shop() {
  const { balance, purchases, buyBadge, toast } = useApp();
  const owned = new Set(purchases.map((p) => p.cosmeticId));

  return (
    <Screen chrome title="Shop" caption="Spend your Coins on badges">
      <Card style={{ backgroundColor: tokens.tint.sun, borderColor: `${tokens.brand.sun}80`, gap: 6 }}>
        <Eyebrow>Coins</Eyebrow>
        <T variant="displayL" style={{ fontSize: 34, lineHeight: 38 }}>{balance}</T>
      </Card>
      {CATALOG.map((item, i) => (
        <Card key={item.id} index={i} style={{ gap: 12 }}>
          <Row>
            <IconTile icon={Award} color={tokens.brand.sunDeep} tint={tokens.tint.sun} />
            <View style={{ flex: 1 }}>
              <T variant="titleS">{item.name}</T>
              <T variant="bodyS">{`${item.price} Coins`}</T>
            </View>
            {owned.has(item.id) ? <Pill>Owned</Pill> : null}
          </Row>
          {owned.has(item.id) ? null : (
            <Action title={`Buy for ${item.price} Coins`} variant={balance >= item.price ? 'accent' : 'outline'}
              task={async () => { await buyBadge(item.id); toast(`You got the ${item.name}!`, 'success'); }} />
          )}
        </Card>
      ))}
    </Screen>
  );
}
