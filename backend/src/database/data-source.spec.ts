import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { databaseCertificate, databaseOptions } from './data-source';

const PEM = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n';

describe('finding the database CA', () => {
  it('has nothing to offer when neither variable is set', () => {
    expect(databaseCertificate({})).toBeUndefined();
    expect(
      databaseCertificate({ DATABASE_CA: '  ', DATABASE_CA_PATH: '' }),
    ).toBeUndefined();
  });

  it('reads the certificate from a file when given a path', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'kgo-ca-')), 'ca.pem');
    writeFileSync(path, PEM);
    expect(databaseCertificate({ DATABASE_CA_PATH: path })).toBe(PEM);
  });

  it('takes the certificate straight from the environment', () => {
    expect(databaseCertificate({ DATABASE_CA: PEM })).toBe(PEM);
  });

  /**
   * Railway, Render and Fly all keep an environment variable on one line, so a
   * pasted PEM can arrive with its newlines escaped. Node's TLS stack needs the
   * real ones back, or the handshake fails on an unreadable certificate.
   */
  it('puts back newlines a dashboard escaped', () => {
    const escaped =
      '-----BEGIN CERTIFICATE-----\\nMIIB\\n-----END CERTIFICATE-----\\n';
    expect(databaseCertificate({ DATABASE_CA: escaped })).toBe(PEM);
  });

  it('prefers the pasted certificate over a path that may not exist there', () => {
    expect(
      databaseCertificate({
        DATABASE_CA: PEM,
        DATABASE_CA_PATH: '/no/such/ca.pem',
      }),
    ).toBe(PEM);
  });

  it('still fails loudly if the path it was given is wrong', () => {
    expect(() =>
      databaseCertificate({ DATABASE_CA_PATH: '/no/such/ca.pem' }),
    ).toThrow();
  });
});

describe('the connection it builds', () => {
  const url = 'postgresql://kgo:secret@db.example.net:12590/kgo';

  it('verifies the certificate chain, with or without a CA of its own', () => {
    for (const ca of [PEM, undefined]) {
      const options = databaseOptions(url, true, ca) as {
        ssl: { rejectUnauthorized: boolean; ca?: string };
      };
      expect(options.ssl.rejectUnauthorized).toBe(true);
      expect(options.ssl.ca).toBe(ca);
    }
  });

  it('leaves TLS off only when it was asked to', () => {
    expect((databaseOptions(url, false) as { ssl: false }).ssl).toBe(false);
  });
});
