/** Keep untrusted upload names out of response header syntax and paths. */
export function safeAttachmentName(filename: string): string {
  // Normalize compatibility glyphs before path and device-name checks.
  // Preserve explicit dot-lookalike neutralization before NFKC maps them to dots.
  // Lone UTF-16 surrogates are not valid Unicode scalar values and can be\n  // substituted inconsistently when encoding a Content-Disposition header.\n  const normalized = filename.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/gu, '')\n    .replace(/[\u2024\uFE52\uFF0E]/gu, '_').normalize('NFKC');
  const safe = normalized
    .replace(/\.\./g, '_')
    // Dot lookalikes can disguise a file's true extension in download dialogs.
    .replace(/[\u2024\uFE52\uFF0E]/gu, '_')
    // Unicode format controls can reverse or hide extensions in file dialogs.
    .replace(/[\u00AD\u034F\u061C\u180E\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFE00-\uFE0F\uFEFF\uFFF9-\uFFFB\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/gu, '')
    .replace(/["\\\r\n:\/\x00-\x1f\x7f-\x9f\u2044\u2215\uFF0F\uFF3C]+/gu, '_')
    .replace(/^[._\s]+|[._\s]+$/g, '');

  // Limit both code points and UTF-8 bytes; slicing UTF-16 can split emoji.
  let limited = '';
  let bytes = 0;
  let points = 0;
  for (const character of safe) {
    const size = Buffer.byteLength(character, 'utf8');
    if (points >= 180 || bytes + size > 255) break;
    limited += character;
    bytes += size;
    points++;
  }
  limited = limited.replace(/[._\s]+$/g, '');
  // Windows treats these basenames as devices even with an extension.
  return /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\s*\.|$)/i.test(limited)
    ? '_' + limited
    : limited || 'document';
}
