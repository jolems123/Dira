import { describe, expect, it } from 'vitest';
import { validateProductionEnvironment } from '../src/lib/env-validation';

const valid = {
  NODE_ENV: 'production', DATABASE_URL: 'postgresql://example.invalid/dira?sslmode=require',
  JWT_ACCESS_SECRET: 'aB3!7xY9pQ2@kL5#nM8$rT4%uV6&wZ1*eF0?gH3+'.slice(0,40), JWT_REFRESH_SECRET: 'bC4@8yZ0qR3#lM6$oN9%sU5^vW7*xA2(fG1)hJ4='.slice(0,40),
  WEB_ORIGIN: 'https://dira.example', API_URL: 'https://api.dira.example',
  FILE_STORAGE_PROVIDER: 's3', FILE_S3_REGION: 'us-east-1',
  FILE_S3_BUCKET: 'private-example', FILE_S3_ACCESS_KEY_ID: 'example-key',
  FILE_S3_SECRET_ACCESS_KEY: 'example-secret',
};

describe('production environment validation', () => {
  it('accepts explicitly configured production settings', () => {
    expect(() => validateProductionEnvironment(valid)).not.toThrow();
  });
  it.each(['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL', 'WEB_ORIGIN', 'API_URL', 'FILE_S3_BUCKET'])(
    'rejects missing %s', (key) => {
      expect(() => validateProductionEnvironment({ ...valid, [key]: '' })).toThrow();
    },
  );
  it.each(['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'])('rejects weak/default %s', (key) => {
    expect(() => validateProductionEnvironment({ ...valid, [key]: 'local-secret' })).toThrow();
    expect(() => validateProductionEnvironment({ ...valid, [key]: 'x'.repeat(31) })).toThrow();
  });
  it('rejects matching signing secrets', () => {
    expect(() => validateProductionEnvironment({ ...valid, JWT_REFRESH_SECRET: valid.JWT_ACCESS_SECRET })).toThrow();
  });
  it.each(['http://example.org', '*', 'http://localhost:3000'])('rejects unsafe web origins', (origin) => {
    expect(() => validateProductionEnvironment({ ...valid, WEB_ORIGIN: origin })).toThrow();
  });
  it('rejects missing or non-postgres database URLs without disclosing credentials', () => {
    expect(() => validateProductionEnvironment({ ...valid, DATABASE_URL: 'mysql://somewhere' })).toThrow(/DATABASE_URL/);
  });
  it('does not require production credentials during local development', () => {
    expect(() => validateProductionEnvironment({ NODE_ENV: 'test' })).not.toThrow();
  });
});
