import { describe, expect, it, vi } from 'vitest';
import { requireRole, type AuthenticatedRequest } from './auth';
import type { NextFunction, Response } from 'express';

function evaluate(user?: AuthenticatedRequest['user']) {
  const status = vi.fn().mockReturnThis();
  const json = vi.fn();
  const next = vi.fn();
  requireRole('ADMIN')({ user } as AuthenticatedRequest, { status, json } as unknown as Response, next as NextFunction);
  return { status, json, next };
}

describe('role checks require an authenticated tenant context', () => {
  it.each([undefined, '', ' ', ' tenant ', 42])('denies invalid organisation ID %s', (organizationId) => {
    const result = evaluate({ id: 'user-1', role: 'ADMIN', organizationId } as AuthenticatedRequest['user']);
    expect(result.status).toHaveBeenCalledWith(403);
    expect(result.next).not.toHaveBeenCalled();
  });
  it('denies insufficient role even with valid tenant', () => {
    expect(evaluate({ id: 'user-1', organizationId: 'tenant-1', role: 'BUYER' }).status).toHaveBeenCalledWith(403);
  });
  it('allows a matching role with a canonical tenant', () => {
    expect(evaluate({ id: 'user-1', organizationId: 'tenant-1', role: 'ADMIN' }).next).toHaveBeenCalledOnce();
  });
});
