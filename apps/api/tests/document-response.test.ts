import { describe, expect, it } from 'vitest';
import { safeAttachmentName } from '../src/lib/document-response';

describe('document response filename safety', () => {
  it('removes control characters and header delimiters', () => {
    expect(safeAttachmentName('invoice"\\r\\nX-Injected: yes.pdf')).toBe('invoice_X-Injected_ yes.pdf');
  });
  it('does not permit path separators or traversal', () => {
    expect(safeAttachmentName('../private\\\\report.pdf')).toBe('private_report.pdf');
  });
  it('uses a neutral fallback for invalid filenames', () => {
    expect(safeAttachmentName('\\r\\n')).toBe('document');
  });
});
