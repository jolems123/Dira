import jwt from 'jsonwebtoken';

export const ACCESS_TOKEN_ISSUER = 'dira-api';
export const ACCESS_TOKEN_AUDIENCE = 'dira-web';
export const ACCESS_TOKEN_ALGORITHM = 'HS256' as const;

/** Access tokens never carry organisation or role claims: membership is loaded server-side. */
export function signAccessToken(userId: string, secret: string): string {
  return jwt.sign({ sub: userId }, secret, {
    algorithm: ACCESS_TOKEN_ALGORITHM,
    issuer: ACCESS_TOKEN_ISSUER,
    audience: ACCESS_TOKEN_AUDIENCE,
    expiresIn: '15m',
  });
}

export function verifyAccessToken(token: string, secret: string): jwt.JwtPayload {
  const claims = jwt.verify(token, secret, {
    algorithms: [ACCESS_TOKEN_ALGORITHM],
    issuer: ACCESS_TOKEN_ISSUER,
    audience: ACCESS_TOKEN_AUDIENCE,
    clockTolerance: 0,
  });
  if (typeof claims === 'string' || typeof claims.sub !== 'string' || !claims.sub) {
    throw new Error('Invalid access-token subject');
  }
  return claims;
}
