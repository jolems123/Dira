import * as dotenv from 'dotenv';

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:Kampala2020%40%26@localhost:5432/dira_db?schema=public',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? 'local-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'local-refresh-secret',
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  apiUrl: process.env.API_URL ?? 'http://localhost:4000',
};
