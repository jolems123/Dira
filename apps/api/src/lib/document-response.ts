/** Keep untrusted upload names out of response header syntax and paths. */
export function safeAttachmentName(filename: string): string {
  const safe = filename
    .replace(/\.\./g, '_')
    .replace(/["\\\\\r\n:\/\x00-\x1f]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 180);
  return safe || 'document';
}
