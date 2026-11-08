/** Validate only production configuration. Never include secret values in errors. */
export function validateProductionEnvironment(values: NodeJS.ProcessEnv | Record<string, string | undefined>): void {
  if (values.NODE_ENV !== 'production') return;

  const required = [
    'DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'WEB_ORIGIN',
    'API_URL', 'FILE_S3_REGION', 'FILE_S3_BUCKET', 'FILE_S3_ACCESS_KEY_ID',
    'FILE_S3_SECRET_ACCESS_KEY',
  ] as const;
  for (const key of required) {
    if (!values[key]?.trim()) throw new Error(`Missing required production setting: ${key}`);
  }

  const knownDefaults = new Set([
    'local-secret', 'local-refresh-secret', 'changeme', 'change-me', 'secret',
    'password', 'your-secret', 'replace-me', 'development-secret',
  ]);
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    const value = values[key]!;
    if (value.length < 32 || knownDefaults.has(value.toLowerCase()) || /^(.)(\1)+$/.test(value)) {
      throw new Error(`Unsafe production setting: ${key}; use at least 32 non-trivial characters`);
    }
  }
  if (values.JWT_ACCESS_SECRET === values.JWT_REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }

  const databaseUrl = values.DATABASE_URL!;
  try {
    const url = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname || url.pathname === '/') {
      throw new Error('invalid');
    }
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }

  for (const key of ['WEB_ORIGIN', 'API_URL'] as const) {
    const raw = values[key]!;
    try {
      const url = new URL(raw);
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.pathname !== '/' || url.search || url.hash || raw.includes('*')) {
        throw new Error('invalid');
      }
    } catch {
      throw new Error(`${key} must be a single HTTPS origin with no credentials, path or wildcard`);
    }
  }
  if (values.FILE_STORAGE_PROVIDER !== 's3') {
    throw new Error('FILE_STORAGE_PROVIDER=s3 is required in production');
  }
}
