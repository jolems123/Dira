/** Keep untrusted upload names out of response header syntax and paths. */
export function safeAttachmentName(filename: string): string {
  const safe = filename
    .replace(/\.\./g, '_')
    // Dot lookalikes can disguise a file's true extension in download dialogs.
    .replace(/[\u2024\uFE52\uFF0E]/gu, '_')
    // Unicode format controls can reverse or hide extensions in file dialogs.
    .replace(/[\u00AD\u034F\u061C\u180E\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFE00-\uFE0F\uFEFF\uFFF9-\uFFFB\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/gu, '')
    .replace(/["\\\\\r\n:\/\x00-\x1f\x7f-\x9f\u2044\u2215\uFF0F\uFF3C]+/gu, '_')
    .replace(/^[._\s]+|[._\s]+$/g, '')
    .slice(0, 180)
    // Truncation can expose a trailing dot or space that was not trailing before.
    .replace(/[._\s]+$/g, '');
  // Windows treats these basenames as devices even when followed by an extension.
  // Prefixing preserves the visible name while making it a regular filename.
  return /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\s*\.|$)/i.test(safe)
    ? '_' + safe
    : safe || 'document';
}
