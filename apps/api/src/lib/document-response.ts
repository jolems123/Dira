/** Keep untrusted upload names out of response header syntax and paths. */
export function safeAttachmentName(filename: string): string {
  const safe = filename
    .replace(/\.\./g, '_')
    // Unicode format controls can reverse or hide extensions in file dialogs.
    .replace(/[\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]/g, '')
    .replace(/["\\\\\r\n:\/\x00-\x1f]+/g, '_')
    .replace(/^[._\s]+|[._\s]+$/g, '')
    .slice(0, 180)
    // Truncation can expose a trailing dot or space that was not trailing before.
    .replace(/[._\s]+$/g, '');
  return safe || 'document';
}
