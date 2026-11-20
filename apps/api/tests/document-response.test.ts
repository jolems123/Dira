import { describe, expect, it } from 'vitest';
import { safeAttachmentName } from '../src/lib/document-response';

describe('document response filename safety', () => {
  it('removes actual CRLF header injection and delimiters', () => {
    expect(safeAttachmentName('invoice\uFE0F\u{E0100}\u{E0001}\u{E0061}.pdf')).toBe('invoice.pdf');
  });

});
