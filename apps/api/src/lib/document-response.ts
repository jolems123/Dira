/** Keep untrusted upload names out of response header syntax and paths. */
export function safeAttachmentName(filename: string): string {
  const safe = filename
    .replace(/\.\./g, '_')
    // Unicode format controls can reverse or hide extensions in file dialogs.
    .replace(/[\u061C\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]/g, '')
    .replace(/["\\\\\r\n:\/\x00-\x1f\x7f-\x9f]+/g, '_')
    .replace(/^[._\s]+|[._\s]+$/g, '')
    .slice(0, 180)
    // Truncation can expose a trailing dot or space that was not trailing before.
    .replace(/[._\s]+$/g, '');
  // Windows treats these basenames as devices even when followed by an extension.
  // Prefixing preserves the visible name while making it a regular filename.
  return /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\\.|$)/i.test(safe)
    ? '_' + safe
    : safe || 'document';
}
