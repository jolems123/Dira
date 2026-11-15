import { describe, expect, it } from 'vitest';
import { resolveStoragePath, validateUpload } from '../src/lib/uploads';

const candidate = (filename: string, mimeType: string, content: Buffer, size = content.length) =>
  validateUpload({ filename, mimeType, content, size });

describe('document upload byte validation', () => {
  it('accepts a valid PDF and assigns a storage key', () => {
    const result = candidate('quote.pdf', 'application/pdf', Buffer.from('%PDF-1.7\nquote'));
    expect(result.ok).toBe(true);
    expect(result.storageName).toMatch(/\.pdf$/);
  });

  it('rejects a declared size that differs from actual bytes', () => {
    expect(candidate('quote.pdf', 'application/pdf', Buffer.from('%PDF-1.7'), 100).ok).toBe(false);
  });

  it('rejects missing content even when the claimed size is positive', () => {
    expect(validateUpload({ filename: 'quote.pdf', mimeType: 'application/pdf', size: 20 }).ok).toBe(false);
  });

  it('rejects a forged WebP payload', () => {
    expect(candidate('image.webp', 'image/webp', Buffer.from('not a real WebP file')).ok).toBe(false);
  });

  it('accepts a WebP RIFF container signature', () => {
    const bytes = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(8)]);
    expect(candidate('image.webp', 'image/webp', bytes).ok).toBe(true);
  });

  it('rejects binary data masquerading as CSV', () => {
    expect(candidate('data.csv', 'text/csv', Buffer.from([97, 44, 98, 0, 99])).ok).toBe(false);
  });
});


describe('storage path boundary validation', () => {
  it('rejects empty and dot-only storage keys rather than resolving to the upload directory', () => {
    for (const key of ['', '.', '  ']) {
      expect(() => resolveStoragePath('/tmp/dira-uploads', key)).toThrow('Invalid storage path');
    }
  });

  it('accepts a normal generated storage key inside the upload directory', () => {
    expect(resolveStoragePath('/tmp/dira-uploads', 'upload-123.pdf')).toBe('/tmp/dira-uploads/upload-123.pdf');
  });
});
