import { gcm } from '@noble/ciphers/aes.js';
import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils.js';
import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytesAsync } from 'expo-crypto';
import type { Cipher } from './repository';
import { vault } from './vault';

/**
 * Encryption for the on-device Attempt log.
 *
 * expo-crypto provides secure randomness and digests but no symmetric cipher,
 * so AES-256-GCM comes from @noble/ciphers — audited, pure JS, no native
 * module, which keeps the app inside Expo Go. The key is 32 random bytes held
 * in the platform keystore via expo-secure-store; it never leaves the device.
 *
 * Each record is bound to its owner and cache key through the additional
 * authenticated data, so a row cannot be lifted from one learner's profile and
 * replayed into another's on a shared tablet.
 */
const FORMAT = 'v1';
const NONCE_BYTES = 12;
const KEY_BYTES = 32;

const keys = new Map<string, Promise<Uint8Array>>();

function keyFor(owner: string): Promise<Uint8Array> {
  if (!keys.has(owner)) {
    keys.set(
      owner,
      (async () => {
        const name = `kgo-key-${owner}`;
        const stored = await vault.get(name);
        if (stored) return hexToBytes(stored);
        const fresh = await getRandomBytesAsync(KEY_BYTES);
        const bytes = Uint8Array.from(fresh);
        await vault.set(name, bytesToHex(bytes));
        return bytes;
      })().catch((error: unknown) => {
        keys.delete(owner);
        throw error;
      }),
    );
  }
  return keys.get(owner)!;
}

const aad = (owner: string, key: string) => utf8ToBytes(`${owner}/${key}`);

export const cipher: Cipher = {
  async encrypt(owner, key, value) {
    const secret = await keyFor(owner);
    const nonce = Uint8Array.from(await getRandomBytesAsync(NONCE_BYTES));
    const sealed = gcm(secret, nonce, aad(owner, key)).encrypt(utf8ToBytes(JSON.stringify(value)));
    // Self-describing so a future format change can be detected rather than
    // silently mis-parsed.
    return `${FORMAT}.${bytesToHex(nonce)}.${bytesToHex(sealed)}`;
  },
  async decrypt<T>(owner: string, key: string, value: string) {
    const [format, nonce, sealed] = value.split('.');
    if (format !== FORMAT || !nonce || !sealed) {
      throw new Error('This cached record is in an unsupported format.');
    }
    const secret = await keyFor(owner);
    const plain = gcm(secret, hexToBytes(nonce), aad(owner, key)).decrypt(hexToBytes(sealed));
    return JSON.parse(bytesToUtf8(plain)) as T;
  },
};

export const digest = (text: string) => digestStringAsync(CryptoDigestAlgorithm.SHA256, text);

export async function pinDigest(owner: string, pin: string) {
  // Device-bound pepper: the verifier is useless without the keystore entry,
  // so a copied database cannot be used to test PIN guesses offline.
  const pepper = bytesToHex(await keyFor(owner));
  return digest(`${pepper}/${owner}/${pin}`);
}
