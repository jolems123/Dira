import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

describe('development seed safety', () => {
  it('refuses to run with production environment settings', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const result = spawnSync(process.execPath, [resolve(root, '../../node_modules/tsx/dist/cli.mjs'), 'prisma/seed.ts'], {
      cwd: root,
      env: { ...process.env, NODE_ENV: 'production', DIRA_ALLOW_DEV_SEED: '1' },
      encoding: 'utf8',
      timeout: 10000,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain('Development seed is forbidden in production');
  });
});
