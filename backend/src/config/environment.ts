import Joi from 'joi';

export function validateEnvironment(input: Record<string, unknown>) {
  const schema = Joi.object({
    NODE_ENV: Joi.string()
      .valid('development', 'test', 'production')
      .default('development'),
    PORT: Joi.number().port().default(3000),
    DATABASE_URL: Joi.string()
      .uri({ scheme: ['postgres', 'postgresql'] })
      .required(),
    DATABASE_SSL: Joi.boolean().default(false),
    DATABASE_SCHEMA: Joi.string()
      .pattern(/^[a-z][a-z0-9_]{0,62}$/)
      .invalid('pg_catalog', 'pg_temp', 'pg_toast')
      .default('kgo'),
    DATABASE_CA_PATH: Joi.string().allow('').optional(),
    // The CA itself, for platforms that only give you environment variables.
    DATABASE_CA: Joi.string().allow('').optional(),
    JWT_SECRET: Joi.string().min(48).required(),
    JWT_ISSUER: Joi.string().default('kgo-quests'),
    CORS_ORIGINS: Joi.string().default(
      'http://localhost:8081,http://localhost:19006',
    ),
    SWAGGER_ENABLED: Joi.boolean().default(false),
    TRUST_PROXY_HOPS: Joi.number().integer().min(0).max(5).default(0),
  }).unknown(true);
  const { error, value } = schema.validate(input, { abortEarly: false });
  if (error)
    throw new Error(
      `Invalid environment configuration: ${error.details.map((d) => d.path.join('.')).join(', ')}`,
    );
  const env = value as Record<string, unknown>;
  const databaseUrl = new URL(String(env.DATABASE_URL));
  if (
    [...databaseUrl.searchParams.keys()].some(
      (key) =>
        key.toLowerCase().startsWith('ssl') ||
        ['options', 'search_path'].includes(key.toLowerCase()),
    )
  ) {
    throw new Error(
      'Configure database TLS and schema through dedicated environment values, not URL parameters',
    );
  }
  if (String(env.JWT_SECRET).startsWith('replace-'))
    throw new Error('Generate a unique JWT_SECRET before starting');
  const origins = String(env.CORS_ORIGINS)
    .split(',')
    .map((s) => s.trim());
  if (origins.some((s) => s === '*' || !/^https?:\/\/[^/]+$/.test(s)))
    throw new Error(
      'CORS_ORIGINS must contain explicit HTTP(S) origins without paths',
    );
  if (
    env.NODE_ENV === 'production' &&
    (env.SWAGGER_ENABLED ||
      !env.DATABASE_SSL ||
      origins.some((s) => !s.startsWith('https://')))
  ) {
    throw new Error(
      'Production requires database TLS, HTTPS CORS origins, and disabled Swagger',
    );
  }
  return env;
}
