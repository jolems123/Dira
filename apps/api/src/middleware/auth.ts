import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/access-token';
import { prisma } from '../db';
import { env } from '../lib/env';

export type AuthenticatedRequest = Request & {
  user?: { id: string; organizationId?: string; role?: string };
};

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return res.status(401).json({ message: 'Authentication required' });

  try {
    const payload = verifyAccessToken(token, env.jwtAccessSecret);
    const user = await prisma.user.findUnique({
      where: { id: String(payload.sub) },
      include: { organizationMembers: { where: { status: 'ACTIVE' }, take: 1, orderBy: { createdAt: 'asc' } } },
    });
    if (!user || user.status !== 'ACTIVE') return res.status(401).json({ message: 'Invalid session' });
    if (user.organizationMembers.length === 0) return res.status(403).json({ message: 'Active organisation membership required' });
    req.user = {
      id: user.id,
      organizationId: user.organizationMembers[0]?.organizationId,
      role: user.organizationMembers[0]?.role,
    };
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired access token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    return next();
  };
}
