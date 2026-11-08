import { describe, expect, it } from 'vitest';
import { api, BASE, registerOrg } from './helpers';

function cookieFrom(response: { headers: Record<string, unknown> }): string {
  const value = response.headers['set-cookie'];
  const raw = Array.isArray(value) ? value[0] : String(value ?? '');
  return raw.split(';')[0];
}

describe('refresh token replay protection', () => {
  it('rotates a refresh token and revokes the session after replay', async () => {
    const actor = await registerOrg('BUYER', 'Replay');
    const login = await api().post(`${BASE}/auth/login`).send({ email: actor.email, password: 'StrongPassw0rd!' });
    expect(login.status).toBe(200);
    const initialCookie = cookieFrom(login);
    const first = await api().post(`${BASE}/auth/refresh`).set('Cookie', initialCookie);
    expect(first.status).toBe(200);
    const rotatedCookie = cookieFrom(first);

    const replay = await api().post(`${BASE}/auth/refresh`).set('Cookie', initialCookie);
    expect(replay.status).toBe(401);
    const subsequent = await api().post(`${BASE}/auth/refresh`).set('Cookie', rotatedCookie);
    expect(subsequent.status).toBe(401);
  });

  it('allows at most one rotation for simultaneous requests', async () => {
    const actor = await registerOrg('BUYER', 'Race');
    const login = await api().post(`${BASE}/auth/login`).send({ email: actor.email, password: 'StrongPassw0rd!' });
    expect(login.status).toBe(200);
    const cookie = cookieFrom(login);
    const results = await Promise.all([
      api().post(`${BASE}/auth/refresh`).set('Cookie', cookie),
      api().post(`${BASE}/auth/refresh`).set('Cookie', cookie),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 401)).toHaveLength(1);
  });
});
