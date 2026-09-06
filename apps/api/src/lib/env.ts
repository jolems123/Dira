import * as path from 'node:path';
import * as fs from 'node:fs';
import * as dotenv from 'dotenv';

/**
 * The API runs from apps/api but the canonical .env lives at the monorepo root,
 * so walk upwards until one is found. Existing process env always wins.
 */
function loadEnvFiles() {
  let dir = process.cwd();
  for (let depth = 0; depth < 5; depth += 1) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) dotenv.config({ path: candidate });
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

loadEnvFiles();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:Kampala2020%40%26@localhost:5432/dira_db?schema=public',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? 'local-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'local-refresh-secret',
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  apiUrl: process.env.API_URL ?? 'http://localhost:4000',
  fileStorageProvider: process.env.FILE_STORAGE_PROVIDER ?? 'local',
  fileLocalRoot: process.env.FILE_LOCAL_ROOT ?? path.resolve(process.cwd(), '..', '..', 'var', 'documents'),
  fileS3Endpoint: process.env.FILE_S3_ENDPOINT,
  fileS3Region: process.env.FILE_S3_REGION,
  fileS3Bucket: process.env.FILE_S3_BUCKET,
  fileS3AccessKeyId: process.env.FILE_S3_ACCESS_KEY_ID,
  fileS3SecretAccessKey: process.env.FILE_S3_SECRET_ACCESS_KEY,
};

if (env.nodeEnv === 'production' && env.fileStorageProvider !== 's3') {
  throw new Error('FILE_STORAGE_PROVIDER=s3 is required in production');
}
if (env.fileStorageProvider === 's3' && (!env.fileS3Endpoint || !env.fileS3Region || !env.fileS3Bucket || !env.fileS3AccessKeyId || !env.fileS3SecretAccessKey)) {
  throw new Error('Incomplete S3 file storage configuration');
}
