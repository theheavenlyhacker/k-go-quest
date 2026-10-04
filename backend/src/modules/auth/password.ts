import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [algorithm, salt, encoded] = hash.split('$');
  if (algorithm !== 'scrypt' || !salt || !encoded) return false;
  const expected = Buffer.from(encoded, 'hex');
  const actual = await derive(password, salt);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
