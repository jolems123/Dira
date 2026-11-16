import { describe, expect, it } from 'vitest';
import { passwordInput } from '../src/lib/password-input';

describe('authentication password input bounds', () => {
  it('accepts valid minimum and maximum length passwords', () => {
    expect(passwordInput.safeParse('a'.repeat(8)).success).toBe(true);
    expect(passwordInput.safeParse('a'.repeat(128)).success).toBe(true);
  });

  it('rejects passwords that would cause excessive hashing or comparison work', () => {
    for (const value of ['', 'a'.repeat(7), 'a'.repeat(129), 'a'.repeat(100000), 42, null, undefined]) {
      expect(passwordInput.safeParse(value).success).toBe(false);
    }
  });
});
