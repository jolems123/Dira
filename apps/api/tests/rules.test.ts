import { describe, expect, it } from 'vitest';
import { INVOICE_TRANSITIONS, PO_TRANSITIONS, QUOTE_TRANSITIONS, canTransition, evaluateThreeWayMatch, isQuoteExpired } from '../src/lib/procurement-rules';
import { MAX_UPLOAD_BYTES, resolveStoragePath, validateUpload } from '../src/lib/uploads';

const basePo = {
  id: 'po-1',
  poNumber: 'PO-1',
  currency: 'BWP',
  total: 1000,
  items: [{ id: 'line-1', name: 'Widget', quantity: 10, unitPrice: 100 }],
};

function match(overrides: Partial<Parameters<typeof evaluateThreeWayMatch>[0]> = {}) {
  return evaluateThreeWayMatch({
    purchaseOrder: basePo,
    receiptItems: [{ purchaseOrderItemId: 'line-1', receivedQuantity: 10, rejectedQuantity: 0 }],
    invoice: {
      id: 'inv-1',
      invoiceNumber: 'INV-1',
      currency: 'BWP',
      total: 1000,
      subtotal: 1000,
      tax: 0,
      items: [{ purchaseOrderItemId: 'line-1', description: 'Widget', quantity: 10, unitPrice: 100 }],
    },
    siblingInvoices: [],
    ...overrides,
  });
}

describe('three-way match rules', () => {
  it('matches a clean PO / receipt / invoice triple', () => {
    const result = match();
    expect(result.matched).toBe(true);
    expect(result.blocking).toBe(0);
    expect(result.lines[0].receivedQuantity).toBe(10);
  });

  it('detects a missing goods receipt', () => {
    const result = match({ receiptItems: [] });
    expect(result.exceptions.map((exception) => exception.code)).toContain('MISSING_RECEIPT');
    expect(result.matched).toBe(false);
  });

  it('detects a quantity mismatch against the receipt', () => {
    const result = match({
      receiptItems: [{ purchaseOrderItemId: 'line-1', receivedQuantity: 4, rejectedQuantity: 0 }],
      invoice: {
        id: 'inv-1', invoiceNumber: 'INV-1', currency: 'BWP', total: 1000, subtotal: 1000, tax: 0,
        items: [{ purchaseOrderItemId: 'line-1', description: 'Widget', quantity: 10, unitPrice: 100 }],
      },
    });
    expect(result.exceptions.map((exception) => exception.code)).toContain('QUANTITY_MISMATCH');
  });

  it('discounts rejected quantities from the received total', () => {
    const result = match({
      receiptItems: [{ purchaseOrderItemId: 'line-1', receivedQuantity: 10, rejectedQuantity: 3 }],
    });
    expect(result.lines[0].receivedQuantity).toBe(7);
    expect(result.exceptions.map((exception) => exception.code)).toContain('QUANTITY_MISMATCH');
  });

  it('detects a price mismatch', () => {
    const result = match({
      invoice: {
        id: 'inv-1', invoiceNumber: 'INV-1', currency: 'BWP', total: 1200, subtotal: 1200, tax: 0,
        items: [{ purchaseOrderItemId: 'line-1', description: 'Widget', quantity: 10, unitPrice: 120 }],
      },
    });
    const codes = result.exceptions.map((exception) => exception.code);
    expect(codes).toContain('PRICE_MISMATCH');
    expect(codes).toContain('OVER_INVOICING');
  });

  it('detects a currency mismatch', () => {
    const result = match({
      invoice: {
        id: 'inv-1', invoiceNumber: 'INV-1', currency: 'USD', total: 1000, subtotal: 1000, tax: 0,
        items: [{ purchaseOrderItemId: 'line-1', description: 'Widget', quantity: 10, unitPrice: 100 }],
      },
    });
    expect(result.exceptions.map((exception) => exception.code)).toContain('CURRENCY_MISMATCH');
  });

  it('detects a duplicate invoice number for the same supplier', () => {
    const result = match({
      siblingInvoices: [{ id: 'inv-2', invoiceNumber: 'INV-1', total: 1000, purchaseOrderId: 'po-1' }],
    });
    expect(result.exceptions.find((exception) => exception.code === 'DUPLICATE_INVOICE')?.severity).toBe('BLOCKING');
  });

  it('warns about an identical total on the same PO', () => {
    const result = match({
      siblingInvoices: [{ id: 'inv-2', invoiceNumber: 'INV-9', total: 1000, purchaseOrderId: 'po-1' }],
    });
    expect(result.exceptions.find((exception) => exception.code === 'DUPLICATE_INVOICE')?.severity).toBe('WARNING');
    expect(result.matched).toBe(true);
  });

  it('detects an invoice subtotal that disagrees with its line items', () => {
    const result = match({
      invoice: {
        id: 'inv-1', invoiceNumber: 'INV-1', currency: 'BWP', total: 1000, subtotal: 900, tax: 0,
        items: [{ purchaseOrderItemId: 'line-1', description: 'Widget', quantity: 10, unitPrice: 100 }],
      },
    });
    expect(result.exceptions.map((exception) => exception.code)).toContain('PRICE_MISMATCH');
  });

  it('flags invoice lines not linked to a PO line', () => {
    const result = match({
      invoice: {
        id: 'inv-1', invoiceNumber: 'INV-1', currency: 'BWP', total: 1000, subtotal: 1000, tax: 0,
        items: [{ purchaseOrderItemId: null, description: 'Mystery fee', quantity: 10, unitPrice: 100 }],
      },
    });
    expect(result.exceptions.map((exception) => exception.code)).toContain('UNMATCHED_INVOICE_LINE');
  });
});

describe('state machines', () => {
  it('permits only valid quote transitions', () => {
    expect(canTransition(QUOTE_TRANSITIONS, 'SUBMITTED', 'AWARDED')).toBe(true);
    expect(canTransition(QUOTE_TRANSITIONS, 'AWARDED', 'REVISED')).toBe(false);
    expect(canTransition(QUOTE_TRANSITIONS, 'WITHDRAWN', 'SUBMITTED')).toBe(false);
    expect(canTransition(QUOTE_TRANSITIONS, 'EXPIRED', 'AWARDED')).toBe(false);
  });

  it('rejects backward PO transitions', () => {
    expect(canTransition(PO_TRANSITIONS, 'ISSUED', 'ACKNOWLEDGED')).toBe(true);
    expect(canTransition(PO_TRANSITIONS, 'DELIVERED', 'ACKNOWLEDGED')).toBe(false);
    expect(canTransition(PO_TRANSITIONS, 'CLOSED', 'DELIVERED')).toBe(false);
    expect(canTransition(PO_TRANSITIONS, 'CANCELLED', 'ISSUED')).toBe(false);
  });

  it('rejects invalid invoice transitions', () => {
    expect(canTransition(INVOICE_TRANSITIONS, 'SUBMITTED', 'APPROVED')).toBe(true);
    expect(canTransition(INVOICE_TRANSITIONS, 'PAID', 'REJECTED')).toBe(false);
    expect(canTransition(INVOICE_TRANSITIONS, 'VOID', 'APPROVED')).toBe(false);
    expect(canTransition(INVOICE_TRANSITIONS, 'SUBMITTED', 'PAID')).toBe(false);
  });

  it('treats a past validity date as expired', () => {
    expect(isQuoteExpired(new Date(Date.now() - 1000))).toBe(true);
    expect(isQuoteExpired(new Date(Date.now() + 1000))).toBe(false);
    expect(isQuoteExpired(null)).toBe(false);
  });
});

describe('upload security', () => {
  const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);

  it('accepts a well-formed PDF', () => {
    const result = validateUpload({ filename: 'invoice.pdf', mimeType: 'application/pdf', size: 2048, content: pdf });
    expect(result.ok).toBe(true);
    expect(result.storageName).toMatch(/\.pdf$/);
    expect(result.storageName).not.toContain('invoice');
  });

  it('rejects path traversal in the filename', () => {
    for (const filename of ['../../etc/passwd.pdf', '..\\..\\windows\\system32\\a.pdf', 'sub/dir/file.pdf']) {
      expect(validateUpload({ filename, mimeType: 'application/pdf', size: 100, content: pdf }).ok).toBe(false);
    }
  });

  it('rejects double extensions', () => {
    expect(validateUpload({ filename: 'invoice.pdf.exe', mimeType: 'application/pdf', size: 100, content: pdf }).ok).toBe(false);
    expect(validateUpload({ filename: 'report.php.png', mimeType: 'image/png', size: 100 }).ok).toBe(false);
  });

  it('rejects empty and oversized files', () => {
    expect(validateUpload({ filename: 'a.pdf', mimeType: 'application/pdf', size: 0 }).ok).toBe(false);
    expect(validateUpload({ filename: 'a.pdf', mimeType: 'application/pdf', size: MAX_UPLOAD_BYTES + 1 }).ok).toBe(false);
  });

  it('rejects disallowed MIME types and extensions', () => {
    expect(validateUpload({ filename: 'a.exe', mimeType: 'application/octet-stream', size: 100 }).ok).toBe(false);
    expect(validateUpload({ filename: 'a.pdf', mimeType: 'text/html', size: 100 }).ok).toBe(false);
  });

  it('rejects a MIME type that disagrees with the extension', () => {
    expect(validateUpload({ filename: 'a.png', mimeType: 'application/pdf', size: 100 }).ok).toBe(false);
  });

  it('rejects content whose magic bytes disagree with the declared type', () => {
    const html = Buffer.from('<html><script>alert(1)</script>');
    expect(validateUpload({ filename: 'a.pdf', mimeType: 'application/pdf', size: html.length, content: html }).ok).toBe(false);
  });

  it('rejects null bytes in the filename', () => {
    expect(validateUpload({ filename: 'a\0.pdf', mimeType: 'application/pdf', size: 100 }).ok).toBe(false);
  });

  it('never resolves a storage path outside the upload root', () => {
    const root = process.platform === 'win32' ? 'D:\\dira-uploads' : '/var/dira-uploads';
    const resolved = resolveStoragePath(root, 'abc.pdf');
    expect(resolved.startsWith(root)).toBe(true);
    expect(() => resolveStoragePath(root, '../../etc/passwd')).toThrow();
  });
});
