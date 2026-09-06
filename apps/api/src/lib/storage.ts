import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env';

export interface StorageProvider {
  put(key: string, content: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

function safeKey(key: string) {
  if (!key || key.includes('..') || /[\\/]/.test(key) || key !== path.basename(key)) {
    throw Object.assign(new Error('Invalid storage key'), { status: 400 });
  }
}

class LocalStorageProvider implements StorageProvider {
  constructor(private readonly root: string) {}
  private file(key: string) { safeKey(key); return path.join(this.root, key); }
  async put(key: string, content: Buffer, _mimeType: string) {
    await fs.mkdir(this.root, { recursive: true });
    await fs.writeFile(this.file(key), content, { flag: 'wx' });
  }
  async get(key: string) { return fs.readFile(this.file(key)); }
  async delete(key: string) { await fs.unlink(this.file(key)); }
  async exists(key: string) { try { await fs.access(this.file(key)); return true; } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; } }
  async getSignedUrl(key: string) { safeKey(key); return `${env.apiUrl}/api/v1/documents/${encodeURIComponent(key)}/content`; }
}

class S3StorageProvider implements StorageProvider {
  private readonly client = new S3Client({
    endpoint: env.fileS3Endpoint,
    region: env.fileS3Region,
    credentials: { accessKeyId: env.fileS3AccessKeyId!, secretAccessKey: env.fileS3SecretAccessKey! },
    forcePathStyle: true,
  });
  private command<T extends object>(factory: (input: { Bucket: string; Key: string }) => T, key: string) {
    safeKey(key);
    return factory({ Bucket: env.fileS3Bucket!, Key: key });
  }
  async put(key: string, content: Buffer, mimeType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: env.fileS3Bucket!, Key: key, Body: content, ContentType: mimeType }));
  }
  async get(key: string) {
    const response = await this.client.send(this.command((input) => new GetObjectCommand(input), key));
    if (!response.Body) throw Object.assign(new Error('Document content unavailable'), { status: 404 });
    return Buffer.from(await response.Body.transformToByteArray());
  }
  async delete(key: string) { await this.client.send(this.command((input) => new DeleteObjectCommand(input), key)); }
  async exists(key: string) { try { await this.client.send(this.command((input) => new HeadObjectCommand(input), key)); return true; } catch (error: unknown) { const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode; if (status === 404) return false; throw error; } }
  async getSignedUrl(key: string, expiresInSeconds = 300) { return getSignedUrl(this.client, this.command((input) => new GetObjectCommand(input), key), { expiresIn: expiresInSeconds }); }
}

export const storage: StorageProvider = env.fileStorageProvider === 's3'
  ? new S3StorageProvider()
  : new LocalStorageProvider(env.fileLocalRoot);

export function checksum(content: Buffer) {
  return crypto.createHash('sha256').update(content).digest('hex');
}
