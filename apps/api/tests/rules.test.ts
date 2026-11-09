import { describe, expect, it } from 'vitest';
import { INVOICE_TRANSITIONS, PO_TRANSITIONS, QUOTE_TRANSITIONS, UGANDA_VAT_RATE, round2, advanceSchedule, calculateTotals, canTransition, evaluateThreeWayMatch, invoiceableLines, isQuoteExpired, nextOccurrence, paymentTermDays, resolveTax } from '../src/lib/procurement-rules';
import { MAX_UPLOAD_BYTES, resolveStoragePath, validateUpload } from '../src/lib/uploads';

const basePo = {
  id: 'po-1',
  poNumber: 'PO-1',
  currency: 'UGX',
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
      currency: 'UGX',
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
  it('blocks malformed purchase order quantities and prices before matching', () => {
    for (const [quantity, unitPrice] of [[Number.NaN, 100], [-1, 100], [10, Number.POSITIVE_INFINITY], [10, -1]]) {
      const result = match({
        purchaseOrder: { ...basePo, items: [{ id: 'line-1', name: 'Widget', quantity, unitPrice }] },
      });
      expect(result.matched).toBe(false);
      expect(result.exceptions.some((exception) => exception.code === 'INVALID_PO_LINE' && exception.severity === 'BLOCKING')).toBe(true);
    }
  });

  it('matches a clean PO / receipt / invoice triple', () => {
    const result = match();
    expect(result.matched).toBe(true);
    expect(result.blocking).toBe(0);
    expect(result.lines[0].receivedQuantity).toBe(10);
  });

  it('blocks invalid receipt quantities instead of treating them as verified goods', () => {
    const result = match({
      receiptItems: [{ purchaseOrderItemId: 'line-1', receivedQuantity: 2, rejectedQuantity: 7 }],
    });
    expect(result.matched).toBe(false);
    expect(result.exceptions.map((item) => item.code)).toContain('INVALID_RECEIPT_QUANTITY');
    expect(result.lines[0].receivedQuantity).toBe(0);
  });

  it('blocks negative or nonfinite invoice quantities', () => {
    for (const quantity of [-1, Number.NaN]) {
      const result = match({
        invoice: {
          id: 'inv-1', invoiceNumber: 'INV-1', currency: 'UGX', total: 1000, subtotal: 1000, tax: 0,
          items: [{ purchaseOrderItemId: 'line-1', description: 'Widget', quantity, unitPrice: 100 }],
        },
      });
      expect(result.exceptions.map((item) => item.code)).toContain('INVALID_INVOICE_QUANTITY');
      expect(result.matched).toBe(false);
    }
  });

  it('blocks unlinked goods receipts even when their quantity is positive', () => {
    const result = match({
      receiptItems: [{ purchaseOrderItemId: null, receivedQuantity: 10, rejectedQuantity: 0 }],
    });
    expect(result.matched).toBe(false);
    expect(result.exceptions.some((exception) => exception.code === 'UNMATCHED_RECEIPT_LINE' && exception.severity === 'BLOCKING')).toBe(true);
    expect(result.exceptions.map((exception) => exception.code)).toContain('MISSING_RECEIPT');
    expect(result.lines[0].receivedQuantity).toBe(0);
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
        id: 'inv-1', invoiceNumber: 'INV-1', currency: 'UGX', total: 1000, subtotal: 1000, tax: 0,
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
        id: 'inv-1', invoiceNumber: 'INV-1', currency: 'UGX', total: 1200, subtotal: 1200, tax: 0,
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
        id: 'inv-1', invoiceNumber: 'INV-1', currency: 'UGX', total: 1000, subtotal: 900, tax: 0,
        items: [{ purchaseOrderItemId: 'line-1', description: 'Widget', quantity: 10, unitPrice: 100 }],
      },
    });
    expect(result.exceptions.map((exception) => exception.code)).toContain('PRICE_MISMATCH');
  });

  it('blocks invoice lines referencing a nonexistent PO item instead of silently omitting them', () => {
    const result = match({
      invoice: {
        id: 'inv-1', invoiceNumber: 'INV-1', currency: 'UGX', total: 1000, subtotal: 1000, tax: 0,
        items: [{ purchaseOrderItemId: 'another-po-line', description: 'Unrelated item', quantity: 10, unitPrice: 100 }],
      },
    });
    expect(result.matched).toBe(false);
    expect(result.exceptions.some((exception) => exception.code === 'UNMATCHED_INVOICE_LINE' && exception.severity === 'BLOCKING')).toBe(true);
  });

  it('blocks receipts referencing items outside the purchase order', () => {
    const result = match({
      receiptItems: [{ purchaseOrderItemId: 'another-po-line', receivedQuantity: 10, rejectedQuantity: 0 }],
    });
    expect(result.matched).toBe(false);
    expect(result.exceptions.some((exception) => exception.code === 'UNMATCHED_RECEIPT_LINE' && exception.severity === 'BLOCKING')).toBe(true);
  });

  it('flags invoice lines not linked to a PO line', () => {
    const result = match({
      invoice: {
        id: 'inv-1', invoiceNumber: 'INV-1', currency: 'UGX', total: 1000, subtotal: 1000, tax: 0,
        items: [{ purchaseOrderItemId: null, description: 'Mystery fee', quantity: 10, unitPrice: 100 }],
      },
    });
    expect(result.exceptions.map((exception) => exception.code)).toContain('UNMATCHED_INVOICE_LINE');
  });
});

describe('invoiceable quantities across partial receipts', () => {
  it('uses dispatch only for lines without any receipt, not as a PO-wide fallback', () => {
    const result = invoiceableLines({
      items: [
        { id: 'a', name: 'Received item', quantity: 10, unitPrice: 1 },
        { id: 'b', name: 'Unreceived item', quantity: 10, unitPrice: 1 },
      ],
      deliveries: [
        { kind: 'DISPATCH', items: [
          { purchaseOrderItemId: 'a', orderedQuantity: 10, receivedQuantity: 0, rejectedQuantity: 0 },
          { purchaseOrderItemId: 'b', orderedQuantity: 10, receivedQuantity: 0, rejectedQuantity: 0 },
        ] },
        { kind: 'RECEIPT', items: [
          { purchaseOrderItemId: 'a', orderedQuantity: 10, receivedQuantity: 4, rejectedQuantity: 0 },
        ] },
      ],
      invoices: [],
    });
    expect(result.lines.find((line) => line.purchaseOrderItemId === 'a')?.quantity).toBe(4);
    expect(result.lines.find((line) => line.purchaseOrderItemId === 'b')?.quantity).toBe(10);
  });
  it('does not substitute dispatch for a line with an explicit zero receipt', () => {
    const result = invoiceableLines({
      items: [{ id: 'a', name: 'Rejected item', quantity: 5, unitPrice: 1 }],
      deliveries: [
        { kind: 'DISPATCH', items: [{ purchaseOrderItemId: 'a', orderedQuantity: 5, receivedQuantity: 0, rejectedQuantity: 0 }] },
        { kind: 'RECEIPT', items: [{ purchaseOrderItemId: 'a', orderedQuantity: 5, receivedQuantity: 5, rejectedQuantity: 5 }] },
      ],
      invoices: [],
    });
    expect(result.lines[0].quantity).toBe(0);
  });
});

describe('Uganda VAT', () => {
  it('applies the 18% standard rate when no tax is supplied', () => {
    expect(UGANDA_VAT_RATE).toBe(0.18);
    expect(resolveTax(1_000_000)).toBe(180_000);
  });

  it('respects an explicit tax amount, including zero for non-registered suppliers', () => {
    expect(resolveTax(1_000_000, 0)).toBe(0);
    expect(resolveTax(1_000_000, 50_000)).toBe(50_000);
  });

  it('never charges VAT on a negative taxable amount', () => {
    expect(resolveTax(-100)).toBe(0);
  });
});

describe('decimal rounding safety', () => {
  it('rounds half a cent deterministically rather than using binary toFixed', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
  });
  it('avoids floating-point accumulation in invoice totals', () => {
    const result = calculateTotals({ lines: [{ quantity: 1, unitPrice: 0.1 }, { quantity: 1, unitPrice: 0.2 }], tax: 0 });
    expect(result.subtotal).toBe(0.3);
    expect(result.total).toBe(0.3);
  });
  it('rounds tax precisely on fractional line totals', () => {
    expect(resolveTax(0.15)).toBe(0.03);
  });
});

describe('document arithmetic', () => {
  it('totals lines, charges VAT on subtotal + delivery - discount', () => {
    const totals = calculateTotals({ lines: [{ quantity: 3, unitPrice: 10_000 }, { quantity: 2, unitPrice: null }], deliveryFee: 5_000, discount: 5_000 });
    expect(totals).toEqual({ lineTotals: [30_000, 0], subtotal: 30_000, deliveryFee: 5_000, discount: 5_000, tax: 5_400, total: 35_400 });
    expect(calculateTotals({ lines: [{ quantity: 1, unitPrice: 100 }], tax: 0 }).total).toBe(100);
  });

  it('reads payment terms', () => {
    expect(paymentTermDays('NET30')).toBe(30);
    expect(paymentTermDays('Net 45 days')).toBe(45);
    expect(paymentTermDays('Cash on delivery')).toBe(0);
    expect(paymentTermDays(undefined)).toBe(30);
  });

  it('bills received quantities not yet invoiced, falling back to dispatched', () => {
    const items = [{ id: 'a', name: 'Paper', quantity: 10, unitPrice: 5 }, { id: 'b', name: 'Pens', quantity: 4, unitPrice: 2 }];
    const dispatchOnly = invoiceableLines({ items, deliveries: [{ kind: 'DISPATCH', items: [{ purchaseOrderItemId: 'a', orderedQuantity: 6, receivedQuantity: 0, rejectedQuantity: 0 }] }], invoices: [] });
    expect(dispatchOnly.basis).toBe('DISPATCHED');
    expect(dispatchOnly.lines.map((line) => line.quantity)).toEqual([6, 0]);

    const received = invoiceableLines({
      items,
      deliveries: [{ kind: 'RECEIPT', items: [{ purchaseOrderItemId: 'a', orderedQuantity: 10, receivedQuantity: 9, rejectedQuantity: 1 }, { purchaseOrderItemId: 'b', orderedQuantity: 4, receivedQuantity: 4, rejectedQuantity: 0 }] }],
      invoices: [
        { status: 'APPROVED', items: [{ purchaseOrderItemId: 'a', quantity: 5 }] },
        { status: 'REJECTED', items: [{ purchaseOrderItemId: 'b', quantity: 4 }] },
      ],
    });
    expect(received.basis).toBe('RECEIVED');
    expect(received.lines.map((line) => line.quantity)).toEqual([3, 4]);
  });
});

describe('invoice quantity safety', () => {
  it('does not allow a malformed receipt with more rejected than received to create negative billable quantities', () => {
    const result = invoiceableLines({
      items: [{ id: 'line', name: 'Supplies', quantity: 10, unitPrice: 5 }],
      deliveries: [{ kind: 'RECEIPT', items: [{ purchaseOrderItemId: 'line', orderedQuantity: 10, receivedQuantity: 2, rejectedQuantity: 7 }] }],
      invoices: [],
    });
    expect(result.lines[0].deliveredQuantity).toBe(0);
    expect(result.lines[0].quantity).toBe(0);
  });
});

describe('nonfinite invoiceable quantity regression', () => {
  it('never exposes NaN or Infinity as a billable quantity when historical rows are malformed', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const result = invoiceableLines({
        items: [{ id: 'line', name: 'Supplies', quantity: 10, unitPrice: 5 }],
        deliveries: [{ kind: 'RECEIPT', items: [{ purchaseOrderItemId: 'line', orderedQuantity: 10, receivedQuantity: bad, rejectedQuantity: 0 }] }],
        invoices: [],
      });
      expect(Number.isFinite(result.lines[0].deliveredQuantity)).toBe(true);
      expect(result.lines[0].quantity).toBe(0);
    }
  });
});

describe('recurring schedules', () => {
  it('steps weekly, monthly and quarterly, clamping month ends', () => {
    expect(nextOccurrence(new Date('2026-01-31T08:00:00Z'), 'MONTHLY').toISOString()).toBe('2026-02-28T08:00:00.000Z');
    expect(nextOccurrence(new Date('2026-11-30T08:00:00Z'), 'QUARTERLY').toISOString()).toBe('2027-02-28T08:00:00.000Z');
    expect(nextOccurrence(new Date('2026-09-14T08:00:00Z'), 'WEEKLY').toISOString()).toBe('2026-09-21T08:00:00.000Z');
  });

  it('skips missed periods instead of building a backlog', () => {
    const next = advanceSchedule(new Date('2026-01-01T00:00:00Z'), 'MONTHLY', new Date('2026-05-15T00:00:00Z'));
    expect(next.toISOString()).toBe('2026-06-01T00:00:00.000Z');
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
    const result = validateUpload({ filename: 'invoice.pdf', mimeType: 'application/pdf', size: pdf.length, content: pdf });
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
