/** The Shop: Cosmetics (badges) bought with Coins. Pure; the balance is replayed, never stored. */
export interface Cosmetic { id: string; name: string; price: number; category: string; blurb: string; }
/** Permanent. The price is recorded so a later catalog change never alters the balance. */
export interface Purchase { cosmeticId: string; price: number; at: string; }

export const CATALOG: Cosmetic[] = [
  { id: 'badge-star', name: 'Star Badge', price: 25, category: 'First steps', blurb: 'A gold star for the Profile that answered its first questions right.' },
  { id: 'badge-book', name: 'Bookworm Badge', price: 30, category: 'Reading', blurb: 'For the Learner who keeps going back to the Lesson before answering.' },
  { id: 'badge-rocket', name: 'Rocket Badge', price: 40, category: 'Fast progress', blurb: 'Earned by moving several Skills up inside one month.' },
  { id: 'badge-crown', name: 'Crown Badge', price: 50, category: 'Mastery', blurb: 'The most expensive badge on the tablet. Mastering Skills is how it is paid for.' },
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
