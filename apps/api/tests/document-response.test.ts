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
  it('removes DEL, C1 controls and Arabic letter mark from attachment names', () => {
    expect(safeAttachmentName('invoice\u007f\u0085\u061c.pdf')).toBe('invoice.pdf');
  });
  it('does not expose hidden or dot-only download names', () => {
    expect(safeAttachmentName('...')).toBe('document');
    expect(safeAttachmentName('.env')).toBe('env');
  });
  it('neutralizes Windows device names, including names with extensions', () => {
    for (const name of ['CON', 'con.pdf', 'PRN.txt', 'AUX', 'NUL.csv', 'COM1.pdf', 'LPT9.docx']) {
      expect(safeAttachmentName(name)).toBe('_' + name);
    }
    expect(safeAttachmentName('invoice-CON.pdf')).toBe('invoice-CON.pdf');
    expect(safeAttachmentName('COM9.txt')).toBe('_COM9.txt');
    expect(safeAttachmentName('LPT1.pdf')).toBe('_LPT1.pdf');
  });
  it('removes trailing Windows-ambiguous dots and spaces', () => {
    expect(safeAttachmentName('invoice.pdf.  ')).toBe('invoice.pdf');
  });
  it('does not leave trailing dots after truncating an overlong filename', () => {
    const result = safeAttachmentName('a'.repeat(179) + '.pdf');
    expect(result.length).toBeLessThanOrEqual(180);
    expect(result.endsWith('.')).toBe(false);
  });
  it('neutralizes legacy Windows superscript device aliases', () => {
    for (const name of ['COM¹.txt', 'COM²', 'COM³.csv', 'LPT¹.pdf', 'LPT²', 'LPT³.docx']) {
      expect(safeAttachmentName(name)).toBe('_' + name);
    }
  });

  it('neutralizes Windows device aliases with spaces before extensions', () => {
    for (const name of ['CON .pdf', 'PRN  .txt', 'COM1 .csv', 'LPT² .docx']) {
      expect(safeAttachmentName(name)).toBe('_' + name);
    }
  });
  it('removes invisible format and interlinear annotation controls from filenames', () => {
    expect(safeAttachmentName('invoice\u00ad\u034f\u180e\ufff9\ufffa\ufffb.pdf')).toBe('invoice.pdf');
  });
  it('removes deprecated Unicode directional controls that can disguise extensions', () => {
    expect(safeAttachmentName('invoice\\u206A\\u206B\\u206C\\u206D\\u206E\\u206F.pdf')).toBe('invoice.pdf');
  });
});
