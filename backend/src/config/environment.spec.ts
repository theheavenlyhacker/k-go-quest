import { validateEnvironment } from './environment';
describe('Environment safeguards', () => {
  const base = {
    DATABASE_URL: 'postgresql://test:test@localhost/test',
    JWT_SECRET: 'a'.repeat(64),
  };
  it('rejects missing secrets and wildcard CORS', () => {
    expect(() =>
      validateEnvironment({ DATABASE_URL: base.DATABASE_URL }),
    ).toThrow();
    expect(() => validateEnvironment({ ...base, CORS_ORIGINS: '*' })).toThrow();
  });
  it('requires TLS and disabled docs in production', () => {
    expect(() =>
      validateEnvironment({ ...base, NODE_ENV: 'production' }),
    ).toThrow();
    expect(
      validateEnvironment({
        ...base,
        NODE_ENV: 'production',
        DATABASE_SSL: 'true',
        SWAGGER_ENABLED: 'false',
        CORS_ORIGINS: 'https://app.example.com',
      }).DATABASE_SSL,
    ).toBe(true);
  });
  it('rejects unsafe schema identifiers and TLS overrides in URLs', () => {
    for (const name of ['kgo,public', 'kgo;DROP SCHEMA public', 'pg_catalog'])
      expect(() =>
        validateEnvironment({ ...base, DATABASE_SCHEMA: name }),
      ).toThrow();
    expect(() =>
      validateEnvironment({
        ...base,
        DATABASE_URL: base.DATABASE_URL + '?sslmode=no-verify',
      }),
    ).toThrow();
    expect(validateEnvironment(base).DATABASE_SCHEMA).toBe('kgo');
    expect(() =>
      validateEnvironment({
        ...base,
        DATABASE_URL: base.DATABASE_URL + '?options=-c%20search_path%3Dpublic',
      }),
    ).toThrow();
  });
});
