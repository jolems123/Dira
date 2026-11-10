import { describe, expect, it } from 'vitest';
import { safeAttachmentName } from '../src/lib/document-response';

describe('document response filename safety', () => {
  it('removes actual CRLF header injection and delimiters', () => {
    expect(safeAttachmentName('invoice"\r\nX-Injected: yes.pdf')).toBe('invoice_X-Injected_ yes.pdf');
  });
  it('does not permit path separators or traversal', () => {
    expect(safeAttachmentName('../private\\report.pdf')).toBe('private_report.pdf');
  });
  it('uses a neutral fallback for invalid filenames', () => {
    expect(safeAttachmentName('\r\n')).toBe('document');
  });
  it('strips control bytes and null characters', () => {
    expect(safeAttachmentName('a\0b\tc.pdf')).toBe('a_b_c.pdf');
  });
  it('removes Unicode bidi override characters used to spoof extensions', () => {
    expect(safeAttachmentName('invoice\u202Efdp.exe')).toBe('invoicefdp.exe');
  });
  it('removes Unicode line and paragraph separators', () => {
    expect(safeAttachmentName('invoice\u2028X-Fake.pdf')).toBe('invoiceX-Fake.pdf');
  });
  it('does not expose hidden or dot-only download names', () => {
    expect(safeAttachmentName('...')).toBe('document');
    expect(safeAttachmentName('.env')).toBe('env');
  });
  it('removes trailing Windows-ambiguous dots and spaces', () => {
    expect(safeAttachmentName('invoice.pdf.  ')).toBe('invoice.pdf');
  });
});
