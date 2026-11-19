import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../prisma/migrations/20261119070000_email_verification_tokens/migration.sql', import.meta.url), 'utf8');

test('email verification credentials are hashed, expiring and single-use', () => {
  const model = schema.match(/model EmailVerificationToken \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(model, 'missing EmailVerificationToken model');
  assert.match(model, /tokenHash\s+String\s+@unique/);
  assert.match(model, /expiresAt\s+DateTime/);
  assert.match(model, /usedAt\s+DateTime\?/);
  assert.match(model, /user\s+User\s+@relation/);
  assert.doesNotMatch(model, /\btoken\s+String/);
  assert.match(schema, /emailVerificationTokens\s+EmailVerificationToken\[\]/);
  assert.match(migration, /CREATE TABLE "EmailVerificationToken"/);
  assert.match(migration, /CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key"/);
  assert.match(migration, /REFERENCES "User"\("id"\)/);
});
