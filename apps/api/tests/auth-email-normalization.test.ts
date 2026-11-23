import { describe, expect, it } from 'vitest';
import { canonicalEmail } from '../src/lib/auth-email';

describe('canonicalEmail', () => {
  it('trims surrounding whitespace and normalizes case', () => {
    expect(canonicalEmail('  Person@Example.COM  ')).toBe('person@example.com');
  });

  it('does not change internal whitespace or silently rewrite invalid addresses', () => {
    expect(canonicalEmail('a b@example.com')).toBe('a b@example.com');
  });

  it('is stable on already canonical email input', () => {
    expect(canonicalEmail('person@example.com')).toBe('person@example.com');
  });
});
