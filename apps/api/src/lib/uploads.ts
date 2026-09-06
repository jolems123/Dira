import path from 'node:path';
import crypto from 'node:crypto';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.csv', '.xlsx', '.docx']);

const ALLOWED_MIME_TYPES = new Map<string, string[]>([
  ['application/pdf', ['.pdf']],
  ['image/png', ['.png']],
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/webp', ['.webp']],
  ['text/csv', ['.csv']],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ['.xlsx']],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', ['.docx']],
]);

/** Leading magic bytes keyed by extension family. */
const MAGIC_BYTES: Array<{ extensions: string[]; signature: number[] }> = [
  { extensions: ['.pdf'], signature: [0x25, 0x50, 0x44, 0x46] },
  { extensions: ['.png'], signature: [0x89, 0x50, 0x4e, 0x47] },
  { extensions: ['.jpg', '.jpeg'], signature: [0xff, 0xd8, 0xff] },
  { extensions: ['.xlsx', '.docx'], signature: [0x50, 0x4b, 0x03, 0x04] },
];

export interface UploadCandidate {
  filename: string;
  mimeType: string;
  size: number;
  content?: Buffer;
}

export interface UploadValidationResult {
  ok: boolean;
  errors: string[];
  storageName?: string;
  extension?: string;
}

export function validateUpload(candidate: UploadCandidate): UploadValidationResult {
  const errors: string[] = [];
  const rawName = candidate.filename ?? '';

  if (!rawName.trim()) errors.push('Filename is required');
  if (rawName.includes('\0')) errors.push('Filename contains a null byte');
  if (/[\\/]/.test(rawName) || rawName.includes('..')) {
    errors.push('Filename must not contain path separators or traversal sequences');
  }
  const baseName = path.basename(rawName);
  if (baseName !== rawName) errors.push('Filename must not contain a path');

  if (candidate.size <= 0) errors.push('File is empty');
  if (candidate.size > MAX_UPLOAD_BYTES) errors.push(`File exceeds the ${MAX_UPLOAD_BYTES} byte limit`);

  const extension = path.extname(baseName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) errors.push(`Extension ${extension || '(none)'} is not allowed`);

  // Reject double extensions such as invoice.pdf.exe or report.php.png
  const segments = baseName.split('.').slice(1);
  if (segments.length > 1) {
    const inner = segments.slice(0, -1).map((segment) => `.${segment.toLowerCase()}`);
    if (inner.some((candidateExtension) => ALLOWED_EXTENSIONS.has(candidateExtension) || /\.(exe|sh|bat|cmd|js|php|dll|ps1|jar)$/.test(candidateExtension))) {
      errors.push('Filenames with multiple extensions are not allowed');
    }
  }

  const allowedForMime = ALLOWED_MIME_TYPES.get(candidate.mimeType);
  if (!allowedForMime) {
    errors.push(`MIME type ${candidate.mimeType || '(none)'} is not allowed`);
  } else if (!allowedForMime.includes(extension)) {
    errors.push(`MIME type ${candidate.mimeType} does not match extension ${extension}`);
  }

  if (candidate.content && candidate.content.length > 0) {
    const rule = MAGIC_BYTES.find((entry) => entry.extensions.includes(extension));
    if (rule) {
      const header = [...candidate.content.subarray(0, rule.signature.length)];
      if (rule.signature.some((byte, index) => header[index] !== byte)) {
        errors.push('File content does not match its declared type');
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    errors: [],
    extension,
    storageName: `${Date.now()}-${crypto.randomUUID()}${extension}`,
  };
}

/**
 * Resolves a storage name inside the configured upload root and guarantees the
 * result never escapes that root.
 */
export function resolveStoragePath(uploadRoot: string, storageName: string): string {
  const root = path.resolve(uploadRoot);
  if (storageName !== path.basename(storageName) || storageName.includes('..') || /[\\/]/.test(storageName)) {
    throw Object.assign(new Error('Invalid storage path'), { status: 400 });
  }
  const resolved = path.resolve(root, storageName);
  if (resolved !== path.join(root, storageName)) {
    throw Object.assign(new Error('Invalid storage path'), { status: 400 });
  }
  return resolved;
}
