/** The Shop: Cosmetics (badges) bought with Coins. Pure; the balance is replayed, never stored. */
export interface Cosmetic { id: string; name: string; price: number; }
/** Permanent. The price is recorded so a later catalog change never alters the balance. */
export interface Purchase { cosmeticId: string; price: number; at: string; }

export const CATALOG: Cosmetic[] = [
  { id: 'badge-star', name: 'Star Badge', price: 25 },
  { id: 'badge-book', name: 'Bookworm Badge', price: 30 },
  { id: 'badge-rocket', name: 'Rocket Badge', price: 40 },
  { id: 'badge-crown', name: 'Crown Badge', price: 50 },
];

export const balance = (earned: number, purchases: Purchase[]) => earned - purchases.reduce((sum, p) => sum + p.price, 0);

export function buy(earned: number, purchases: Purchase[], cosmeticId: string, now: string): Purchase {
  const item = CATALOG.find((c) => c.id === cosmeticId);
  if (!item) throw new Error('That badge is not in the Shop.');
  if (purchases.some((p) => p.cosmeticId === cosmeticId)) throw new Error('You already own this badge.');
  const have = balance(earned, purchases);
  if (have < item.price) throw new Error(`You need ${item.price - have} more Coins for the ${item.name}.`);
  return { cosmeticId, price: item.price, at: now };
}
