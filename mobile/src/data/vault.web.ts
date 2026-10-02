// Browser previews intentionally keep credentials and keys in memory only.
// The production offline client is Android/iOS, backed by SecureStore + SQLite.
const values = new Map<string, string>();
export const vault = {
  get: async (key: string) => values.get(key) ?? null,
  set: async (key: string, value: string) => { values.set(key, value); },
  remove: async (key: string) => { values.delete(key); },
};
