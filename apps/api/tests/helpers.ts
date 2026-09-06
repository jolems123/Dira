import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/db';

export const api = () => request(app);
export const BASE = '/api/v1';

export interface Actor {
  token: string;
  userId: string;
  organizationId: string;
  email: string;
}

let counter = 0;
export function unique(prefix: string) {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function isoDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export async function registerOrg(kind: 'BUYER' | 'SUPPLIER', label: string): Promise<Actor> {
  const email = `${unique(label)}@dira.test`;
  const response = await api()
    .post(`${BASE}/auth/register`)
    .send({
      email,
      password: 'StrongPassw0rd!',
      firstName: label,
      lastName: 'Tester',
      organizationName: `${label} ${unique('org')}`,
      organizationType: kind,
    });
  if (response.status !== 201) {
    throw new Error(`register failed (${response.status}): ${JSON.stringify(response.body)}`);
  }
  return {
    token: response.body.accessToken,
    userId: response.body.user.id,
    organizationId: response.body.user.organizationId,
    email,
  };
}

/** Buyer flows span several roles; tests switch the actor's single membership role on demand. */
export async function setRole(actor: Actor, role: string) {
  await prisma.organizationMember.updateMany({
    where: { userId: actor.userId, organizationId: actor.organizationId },
    data: { role: role as never },
  });
}

export function auth(actor: Actor) {
  return { Authorization: `Bearer ${actor.token}` };
}

export function expectOk(response: request.Response, label: string) {
  if (response.status >= 400) {
    throw new Error(`${label} failed (${response.status}): ${JSON.stringify(response.body)}`);
  }
  return response.body;
}
