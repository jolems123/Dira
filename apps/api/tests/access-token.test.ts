import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { signAccessToken, verifyAccessToken } from '../src/lib/access-token';

const secret = 'Example-Strong-Access-Token-Key-For-Tests-Only-123456';

describe('access token claim verification', () => {
  it('accepts properly issued short-lived HS256 tokens', () => {
    const token = signAccessToken('user-1', secret);
    expect(verifyAccessToken(token, secret).sub).toBe('user-1');
  });
  it('rejects tokens without the expected issuer or audience', () => {
    const token = jwt.sign({ sub: 'user-1' }, secret, { algorithm: 'HS256', expiresIn: '15m' });
    expect(() => verifyAccessToken(token, secret)).toThrow();
  });
  it('rejects other signing algorithms even with the same secret', () => {
    const token = jwt.sign({ sub: 'user-1' }, secret, { algorithm: 'HS384', issuer: 'dira-api', audience: 'dira-web', expiresIn: '15m' });
    expect(() => verifyAccessToken(token, secret)).toThrow();
  });
  it('rejects expired tokens', () => {
    const token = jwt.sign({ sub: 'user-1' }, secret, { algorithm: 'HS256', issuer: 'dira-api', audience: 'dira-web', expiresIn: -1 });
    expect(() => verifyAccessToken(token, secret)).toThrow();
  });
});
