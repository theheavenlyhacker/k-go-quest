import { describe, expect, it } from 'vitest';
import { CATALOG, balance, buy, type Purchase } from './shop';

const NOW = '2026-01-01T00:00:00.000Z';
const [cheap, dear] = [CATALOG[0], CATALOG[CATALOG.length - 1]];

describe('Shop', () => {
  it('sells about four badges priced 25 to 50 Coins', () => {
    expect(CATALOG).toHaveLength(4);
    for (const c of CATALOG) { expect(c.price).toBeGreaterThanOrEqual(25); expect(c.price).toBeLessThanOrEqual(50); }
  });
  it('balance is earned Coins minus recorded prices', () => {
    const spent: Purchase[] = [{ cosmeticId: 'a', price: 25, at: NOW }, { cosmeticId: 'b', price: 30, at: NOW }];
    expect(balance(100, spent)).toBe(45);
    expect(balance(100, [])).toBe(100);
  });
  it('records the Cosmetic, price and time', () => {
    expect(buy(100, [], cheap.id, NOW)).toEqual({ cosmeticId: cheap.id, price: cheap.price, at: NOW });
  });
  it('refuses a badge the Learner cannot afford', () => {
    expect(() => buy(dear.price - 1, [], dear.id, NOW)).toThrow(/Coins/);
    expect(balance(dear.price - 1, [])).toBeGreaterThanOrEqual(0);
  });
  it('allows spending down to exactly zero', () => {
    const p = buy(cheap.price, [], cheap.id, NOW);
    expect(balance(cheap.price, [p])).toBe(0);
  });
  it('refuses a second purchase of the same badge', () => {
    const p = buy(500, [], cheap.id, NOW);
    expect(() => buy(500, [p], cheap.id, NOW)).toThrow(/already/);
  });
  it('refuses an unknown badge', () => expect(() => buy(500, [], 'nope', NOW)).toThrow());
  it('keeps a recorded price fixed when the catalog price changes', () => {
    const old: Purchase = { cosmeticId: cheap.id, price: 10, at: NOW };
    expect(balance(100, [old])).toBe(90);
  });
});
