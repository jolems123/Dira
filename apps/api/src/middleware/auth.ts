import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/access-token';
import { bearerCredential } from '../lib/bearer-credential';
import { selectActiveMembership } from '../lib/active-membership';
import { mayAccessProtectedRoute } from '../lib/access-eligibility';
import { prisma } from '../db';
import { env } from '../lib/env';
import { isCanonicalAuthIdentity, isCanonicalAuthContext } from '../lib/canonical-auth-identity';

export type AuthenticatedRequest = Request & {
  user?: { id: string; organizationId?: string; role?: string };
};

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = bearerCredential(req.header('authorization'));
  if (!token) return res.status(401).json({ message: 'Authentication required' });

  let payload: ReturnType<typeof verifyAccessToken>;
  try {
    payload = verifyAccessToken(token, env.jwtAccessSecret);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired access token' });
  }

  if (!isCanonicalAuthIdentity(payload.sub)) return res.status(401).json({ message: 'Invalid session' });

  try {
    const user = await prisma.user.findUnique({
      where: { id: String(payload.sub) },
      include: { organizationMembers: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } } },
    });
    if (!user || !mayAccessProtectedRoute(user)) return res.status(401).json({ message: 'Invalid session' });
    const membership = selectActiveMembership(user.organizationMembers);
    if (!membership) return res.status(403).json({ message: 'Active organisation membership required' });
    const context = { id: user.id, organizationId: membership.organizationId, role: membership.role };
    if (!isCanonicalAuthContext(context)) return res.status(403).json({ message: 'Invalid organisation membership' });
    req.user = context;
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!isCanonicalAuthContext(req.user) || !roles.includes(req.user!.role!)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    return next();
  };
}
