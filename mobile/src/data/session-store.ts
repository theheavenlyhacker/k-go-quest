import type { TokenStore } from '../domain/client';
import type { Session } from '../domain/server';
import { sessionKey } from '../domain/online';

/**
 * Where server Sessions live.
 *
 * A Session has to be in three places at once: in memory, because `ApiClient`
 * reads it synchronously inside a request; in the vault, because it must
 * survive the app closing; and in front of React, because the Caretaker screen
 * re-renders when it changes. Keeping those three in step was open-coded at six
 * sites inside `online-context.tsx`, and two of them had drifted — signing out
 * deleted the Session while invalidating marked it revoked, so "this Session is
 * gone" had two different meanings depending on which path you came down.
 *
 * Both meanings are real, so both are here, named: `invalidate` leaves a
 * revoked Session behind, which is what turns the next request into "sign in
 * again" rather than "no session"; `forget` leaves nothing, which is what a
 * deleted or unlinked Profile needs.
 */

/** The platform adapters in `vault.ts` and `vault.web.ts` both satisfy this. */
export interface Vault {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface SessionStore {
  /** The Session for one owner, synchronously. Null when there is none. */
  get(owner: string): Session | null;
  /** What `ApiClient` takes. Callers never build one of these by hand. */
  tokens(owner: string): TokenStore;
  /** Load saved Sessions for these owners. Unreadable ones are simply absent. */
  restore(owners: string[]): Promise<void>;
  /** Drop this owner's Session entirely: memory and vault, nothing revoked behind. */
  forget(owner: string): Promise<void>;
  /** Called after every change, so React can subscribe instead of mirroring. */
  subscribe(listener: () => void): () => void;
}

export function createSessionStore(vault: Vault): SessionStore {
  const sessions = new Map<string, Session>();
  const listeners = new Set<() => void>();
  const announce = () => { for (const listener of listeners) listener(); };

  const store: SessionStore = {
    get: (owner) => sessions.get(owner) ?? null,

    tokens: (owner) => ({
      read: () => store.get(owner),
      write: async (session) => {
        sessions.set(owner, session);
        await vault.set(sessionKey(owner), JSON.stringify(session));
        announce();
      },
      invalidate: async () => {
        const current = sessions.get(owner);
        // Kept, marked: a request that arrives after this says "sign in again".
        if (current) sessions.set(owner, { ...current, revoked: true });
        await vault.remove(sessionKey(owner));
        announce();
      },
    }),

    restore: async (owners) => {
      const read = async (owner: string) => {
        const stored = await vault.get(sessionKey(owner));
        if (!stored) return;
        try { sessions.set(owner, JSON.parse(stored) as Session); }
        catch { /* an unreadable Session is simply absent */ }
      };
      await Promise.all(owners.map(read));
      announce();
    },

    forget: async (owner) => {
      sessions.delete(owner);
      await vault.remove(sessionKey(owner));
      announce();
    },

    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };

  return store;
}
