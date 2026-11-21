import { describe, expect, it } from 'vitest';
import { safeAttachmentName } from '../src/lib/document-response';

describe('document response filename safety', () => {
  it('strips header injection, path separators and control bytes', () => {
    expect(safeAttachmentName('report\r\nX-Injected: yes.pdf')).toBe('report_X-Injected_ yes.pdf');
    expect(safeAttachmentName('../secret\\invoice.pdf')).toBe('secret_invoice.pdf');
    expect(safeAttachmentName('a\0b.pdf')).toBe('a_b.pdf');
  });

  it('removes Unicode direction, format, tag and variation controls', () => {
    expect(safeAttachmentName('invoice\u202Efdp.exe')).toBe('invoicefdp.exe');
    expect(safeAttachmentName('invoice\u206A\u206F.pdf')).toBe('invoice.pdf');
    expect(safeAttachmentName('invoice\uFE0F\u{E0100}\u{E0001}\u{E0061}.pdf')).toBe('invoice.pdf');
    expect(safeAttachmentName('in\u00AD\u034F\u180Evoice.pdf')).toBe('invoice.pdf');
  });

  it('neutralizes Unicode lookalike path separators', () => {
    expect(safeAttachmentName('folder\u2215invoice.pdf')).toBe('folder_invoice.pdf');
    expect(safeAttachmentName('folder\u2044invoice.pdf')).toBe('folder_invoice.pdf');
    expect(safeAttachmentName('folder\uFF0Finvoice.pdf')).toBe('folder_invoice.pdf');
    expect(safeAttachmentName('folder\uFF3Cinvoice.pdf')).toBe('folder_invoice.pdf');
  });

  it('neutralizes Unicode dot lookalikes in download names', () => {
    expect(safeAttachmentName('invoice\u2024pdf')).toBe('invoice_pdf');
    expect(safeAttachmentName('invoice\uFF0Eexe')).toBe('invoice_exe');
    expect(safeAttachmentName('invoice\uFE52html')).toBe('invoice_html');
  });

  it('normalizes compatibility glyphs before checking paths and reserved names', () => {
    expect(safeAttachmentName('ＣＯＮ.txt')).toBe('_CON.txt');
    expect(safeAttachmentName('folder／invoice.pdf')).toBe('folder_invoice.pdf');
    expect(safeAttachmentName('report．exe')).toBe('report_exe');
  });

  it('prevents Windows device names and empty filenames', () => {
    expect(safeAttachmentName('CON.txt')).toBe('_CON.txt');
    expect(safeAttachmentName('LPT1.pdf')).toBe('_LPT1.pdf');
    expect(safeAttachmentName('...')).toBe('document');
  });

  it('removes trailing dot after truncation', () => {
    expect(safeAttachmentName('a'.repeat(179) + '.pdf')).toBe('a'.repeat(179));
    expect(safeAttachmentName('x'.repeat(200))).toHaveLength(180);
  });
  it('does not split a Unicode surrogate pair at the filename length boundary', () => {
    const result = safeAttachmentName('a'.repeat(179) + '😀' + '.pdf');
    expect(result).toBe('a'.repeat(179) + '😀');
    expect(result).not.toContain('\uFFFD');
    expect(Array.from(result)).toHaveLength(180);
  });
  it('limits UTF-8 bytes as well as Unicode code points', () => {
    const result = safeAttachmentName('😀'.repeat(100) + '.pdf');
    expect(Buffer.byteLength(result, 'utf8')).toBeLessThanOrEqual(255);
    expect(result).not.toContain('\uFFFD');
  });
  it('removes unpaired UTF-16 surrogates from response filenames', () => {
    expect(safeAttachmentName('report\\uD800.pdf')).toBe('report.pdf');
    expect(safeAttachmentName('report\\uDC00.pdf')).toBe('report.pdf');
    expect(safeAttachmentName('report😀.pdf')).toBe('report😀.pdf');
  });

});
