import { describe, expect, it, vi } from 'vitest';
import { CARETAKER_OWNER, sessionKey } from '../domain/online';
import type { Session } from '../domain/server';
import { createSessionStore, type Vault } from './session-store';

/** Second adapter at the vault seam, beside vault.ts and vault.web.ts. */
const fakeVault = (): Vault & { keys: () => string[] } => {
  const values = new Map<string, string>();
  return {
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => { values.set(key, value); },
    remove: async (key) => { values.delete(key); },
    keys: () => [...values.keys()],
  };
};

const session = (id: string): Session => ({
  user: { id, loginId: `login-${id}`, alias: id, role: 'STUDENT', jurisdictionId: 'j', schoolId: 's', coins: 0 },
  accessToken: 'a', refreshToken: 'r', expiresIn: 900, deviceId: 'd', offlineUntil: 9e15,
});

describe('reading and writing', () => {
  it('has no Session until one is written', () => {
    expect(createSessionStore(fakeVault()).get('profile-1')).toBeNull();
  });

  it('writes to memory and the vault in one call', async () => {
    const vault = fakeVault();
    const store = createSessionStore(vault);
    await store.tokens('profile-1').write(session('profile-1'));
    expect(store.get('profile-1')?.user.id).toBe('profile-1');
    expect(vault.keys()).toEqual([sessionKey('profile-1')]);
  });

  it('keeps owners apart', async () => {
    const store = createSessionStore(fakeVault());
    await store.tokens('profile-1').write(session('profile-1'));
    await store.tokens(CARETAKER_OWNER).write(session('caretaker'));
    expect(store.get('profile-1')?.user.id).toBe('profile-1');
    expect(store.get(CARETAKER_OWNER)?.user.id).toBe('caretaker');
  });

  it('reads the same Session through the TokenStore ApiClient takes', async () => {
    const store = createSessionStore(fakeVault());
    const tokens = store.tokens('profile-1');
    await tokens.write(session('profile-1'));
    expect(tokens.read()).toEqual(store.get('profile-1'));
  });
});

describe('the two ways a Session goes away', () => {
  it('invalidate leaves it revoked, so the next request says sign in again', async () => {
    const vault = fakeVault();
    const store = createSessionStore(vault);
    await store.tokens('profile-1').write(session('profile-1'));
    await store.tokens('profile-1').invalidate();
    expect(store.get('profile-1')?.revoked).toBe(true);
    expect(vault.keys()).toEqual([]);
  });

  it('forget leaves nothing behind', async () => {
    const vault = fakeVault();
    const store = createSessionStore(vault);
    await store.tokens('profile-1').write(session('profile-1'));
    await store.forget('profile-1');
    expect(store.get('profile-1')).toBeNull();
    expect(vault.keys()).toEqual([]);
  });

  it('invalidating an owner that has none still clears the vault', async () => {
    const vault = fakeVault();
    const store = createSessionStore(vault);
    await vault.set(sessionKey('stale'), 'whatever');
    await store.tokens('stale').invalidate();
    expect(store.get('stale')).toBeNull();
    expect(vault.keys()).toEqual([]);
  });
});

describe('restore', () => {
  it('loads every owner it is given', async () => {
    const vault = fakeVault();
    await vault.set(sessionKey('profile-1'), JSON.stringify(session('profile-1')));
    await vault.set(sessionKey(CARETAKER_OWNER), JSON.stringify(session('caretaker')));
    const store = createSessionStore(vault);
    await store.restore(['profile-1', CARETAKER_OWNER]);
    expect(store.get('profile-1')?.user.id).toBe('profile-1');
    expect(store.get(CARETAKER_OWNER)?.user.id).toBe('caretaker');
  });

  it('treats an unreadable Session as absent rather than throwing', async () => {
    const vault = fakeVault();
    await vault.set(sessionKey('profile-1'), '{ not json');
    const store = createSessionStore(vault);
    await expect(store.restore(['profile-1'])).resolves.toBeUndefined();
    expect(store.get('profile-1')).toBeNull();
  });

  it('ignores an owner with nothing saved', async () => {
    const store = createSessionStore(fakeVault());
    await store.restore(['never-linked']);
    expect(store.get('never-linked')).toBeNull();
  });
});

describe('subscribe', () => {
  it('announces every change, so nothing has to mirror the Session', async () => {
    const store = createSessionStore(fakeVault());
    const listener = vi.fn();
    store.subscribe(listener);
    await store.tokens(CARETAKER_OWNER).write(session('caretaker'));
    await store.tokens(CARETAKER_OWNER).invalidate();
    await store.forget(CARETAKER_OWNER);
    await store.restore([]);
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('stops announcing once unsubscribed', async () => {
    const store = createSessionStore(fakeVault());
    const listener = vi.fn();
    store.subscribe(listener)();
    await store.tokens('profile-1').write(session('profile-1'));
    expect(listener).not.toHaveBeenCalled();
  });
});
