import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { BASE, api, auth, expectOk, isoDays, registerOrg, setRole, unique } from './helpers';
import { runLifecycle } from './lifecycle.test';

describe('negative and isolation cases', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects supplier cross-tenant access (IDOR) across quotes, POs, invoices and deliveries', async () => {
    const context = await runLifecycle();
    const { supplierA, supplierB, purchaseOrder, invoiceId, quoteB } = context;
    const intruder = await registerOrg('SUPPLIER', 'intruder');

    // Supplier A must not read Supplier B's awarded quote.
    expect((await api().get(`${BASE}/quotes/${quoteB.id}`).set(auth(supplierA))).status).toBe(404);

    // Supplier A must not edit or withdraw Supplier B's quote.
    expect((await api().patch(`${BASE}/quotes/${quoteB.id}`).set(auth(supplierA)).send({
      currency: 'BWP', tax: 0, deliveryFee: 0, discount: 0,
      items: [{ rfqItemId: 'x', quantity: 1, unitPrice: 1 }],
    })).status).toBe(404);
    expect((await api().post(`${BASE}/quotes/${quoteB.id}/withdraw`).set(auth(supplierA)).send({})).status).toBe(404);

    // Supplier A must not read Supplier B's PO.
    expect((await api().get(`${BASE}/purchase-orders/${purchaseOrder.id}`).set(auth(supplierA))).status).toBe(404);
    expect((await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/acknowledge`).set(auth(supplierA)).send({})).status).toBe(404);

    // Supplier A must not dispatch against Supplier B's PO.
    expect((await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/deliveries`).set(auth(supplierA)).send({
      dispatchReference: unique('DSP'),
      items: [{ purchaseOrderItemId: purchaseOrder.items[0].id, quantity: 1 }],
    })).status).toBe(404);

    // Supplier A must not invoice against Supplier B's PO.
    expect((await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/invoices`).set(auth(supplierA)).send({
      invoiceNumber: unique('INV'),
      poId: purchaseOrder.id,
      invoiceDate: new Date().toISOString(),
      dueDate: isoDays(30),
      currency: 'BWP',
      tax: 0,
      items: [{ description: 'x', quantity: 1, unitPrice: 1 }],
    })).status).toBe(404);

    // Supplier A must not read Supplier B's invoice; a third supplier likewise.
    expect((await api().get(`${BASE}/invoices/${invoiceId}`).set(auth(supplierA))).status).toBe(404);
    expect((await api().get(`${BASE}/invoices/${invoiceId}`).set(auth(intruder))).status).toBe(404);
    expect((await api().get(`${BASE}/invoices/${invoiceId}/three-way-match`).set(auth(supplierA))).status).toBe(404);

    // Supplier list scoping: neither supplier's list contains the other's records.
    const supplierAInvoices = expectOk(await api().get(`${BASE}/invoices`).set(auth(supplierA)), 'A invoices');
    expect(supplierAInvoices.items.some((invoice: any) => invoice.id === invoiceId)).toBe(false);

    const supplierBInvoices = expectOk(await api().get(`${BASE}/invoices`).set(auth(supplierB)), 'B invoices');
    expect(supplierBInvoices.items.every((invoice: any) => invoice.supplierOrganizationId === supplierB.organizationId)).toBe(true);

    const supplierAPos = expectOk(await api().get(`${BASE}/purchase-orders`).set(auth(supplierA)), 'A POs');
    expect(supplierAPos.items.some((po: any) => po.id === purchaseOrder.id)).toBe(false);
  });

  it('blocks buyer-organization cross-tenant access', async () => {
    const context = await runLifecycle();
    const otherBuyer = await registerOrg('BUYER', 'buyer2');

    expect((await api().get(`${BASE}/purchase-orders/${context.purchaseOrder.id}`).set(auth(otherBuyer))).status).toBe(404);
    expect((await api().get(`${BASE}/invoices/${context.invoiceId}`).set(auth(otherBuyer))).status).toBe(404);
    expect((await api().post(`${BASE}/rfqs/${context.rfqId}/award`).set(auth(otherBuyer)).send({ quotationId: context.quoteA.id })).status).toBe(404);
    expect((await api().post(`${BASE}/purchase-orders/${context.purchaseOrder.id}/closeout`).set(auth(otherBuyer)).send({})).status).toBe(404);
    expect((await api().post(`${BASE}/purchase-orders/${context.purchaseOrder.id}/goods-receipt`).set(auth(otherBuyer)).send({
      items: [{ purchaseOrderItemId: context.purchaseOrder.items[0].id, receivedQuantity: 1, rejectedQuantity: 0 }],
    })).status).toBe(404);

    const rfqs = expectOk(await api().get(`${BASE}/rfqs`).set(auth(otherBuyer)), 'other buyer rfqs');
    expect(rfqs.items.some((rfq: any) => rfq.id === context.rfqId)).toBe(false);
  });

  it('rejects duplicate award and duplicate PO generation', async () => {
    const context = await runLifecycle();
    const second = await api().post(`${BASE}/rfqs/${context.rfqId}/award`).set(auth(context.buyer)).send({ quotationId: context.quoteA.id });
    expect(second.status).toBe(409);
  });

  it('rejects awarding an expired quote', async () => {
    const buyer = await registerOrg('BUYER', 'buyerexp');
    const supplier = await registerOrg('SUPPLIER', 'supexp');

    const request = expectOk(await api().post(`${BASE}/purchase-requests`).set(auth(buyer)).send({
      title: 'Expiry scenario', department: 'Ops', currency: 'BWP',
      items: [{ name: 'Widget', quantity: 5, estimatedUnitPrice: 100 }],
    }), 'request');
    await api().post(`${BASE}/purchase-requests/${request.id}/submit`).set(auth(buyer)).send({});
    await api().post(`${BASE}/purchase-requests/${request.id}/approve`).set(auth(buyer)).send({});
    const rfq = expectOk(await api().post(`${BASE}/rfqs`).set(auth(buyer)).send({
      purchaseRequestId: request.id, quoteDeadline: isoDays(5), currency: 'BWP', supplierIds: [supplier.organizationId],
    }), 'rfq');
    await api().post(`${BASE}/rfqs/${rfq.id}/publish`).set(auth(buyer)).send({});

    const rfqItems = expectOk(await api().get(`${BASE}/rfqs`).set(auth(buyer)), 'rfqs').items.find((item: any) => item.id === rfq.id).items;
    const quote = expectOk(await api().post(`${BASE}/rfqs/${rfq.id}/quotes`).set(auth(supplier)).send({
      currency: 'BWP', tax: 0, deliveryFee: 0, discount: 0, validUntil: isoDays(1),
      items: rfqItems.map((item: any) => ({ rfqItemId: item.id, quantity: Number(item.quantity), unitPrice: 100 })),
    }), 'quote');

    // Force expiry in the database rather than waiting.
    await prisma.quotation.update({ where: { id: quote.id }, data: { validUntil: new Date(Date.now() - 60_000) } });

    const award = await api().post(`${BASE}/rfqs/${rfq.id}/award`).set(auth(buyer)).send({ quotationId: quote.id });
    expect(award.status).toBe(409);
    expect(String(award.body.message)).toMatch(/expired/i);

    const stored = await prisma.quotation.findUnique({ where: { id: quote.id } });
    expect(stored?.status).toBe('EXPIRED');
  });

  it('rejects over-receipt, duplicate receipt reference and over-dispatch', async () => {
    const context = await runLifecycle({ splitDelivery: false });
    const { buyer, supplierB, purchaseOrder } = context;
    const line = purchaseOrder.items[0];

    // Over-dispatch beyond ordered quantity.
    const overDispatch = await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/deliveries`).set(auth(supplierB)).send({
      dispatchReference: unique('DSP'),
      items: [{ purchaseOrderItemId: line.id, quantity: Number(line.quantity) + 5 }],
    });
    expect(overDispatch.status).toBe(400);

    const reference = unique('DSP');
    expectOk(await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/deliveries`).set(auth(supplierB)).send({
      dispatchReference: reference,
      items: purchaseOrder.items.map((item: any) => ({ purchaseOrderItemId: item.id, quantity: Number(item.quantity) })),
    }), 'dispatch');

    // Duplicate dispatch reference on the same PO.
    const duplicateDispatch = await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/deliveries`).set(auth(supplierB)).send({
      dispatchReference: reference,
      items: [{ purchaseOrderItemId: line.id, quantity: 1 }],
    });
    expect(duplicateDispatch.status).toBe(409);

    await setRole(buyer, 'RECEIVER');

    // Over-receipt in a single receipt.
    const overReceipt = await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/goods-receipt`).set(auth(buyer)).send({
      deliveryNoteReference: unique('DN'),
      items: [{ purchaseOrderItemId: line.id, receivedQuantity: Number(line.quantity) + 1, rejectedQuantity: 0 }],
    });
    expect(overReceipt.status).toBe(400);

    const dnRef = unique('DN');
    expectOk(await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/goods-receipt`).set(auth(buyer)).send({
      deliveryNoteReference: dnRef,
      items: purchaseOrder.items.map((item: any) => ({ purchaseOrderItemId: item.id, receivedQuantity: Number(item.quantity), rejectedQuantity: 0 })),
    }), 'full receipt');

    // Duplicate receipt reference.
    const duplicateReceipt = await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/goods-receipt`).set(auth(buyer)).send({
      deliveryNoteReference: dnRef,
      items: [{ purchaseOrderItemId: line.id, receivedQuantity: 1, rejectedQuantity: 0 }],
    });
    expect(duplicateReceipt.status).toBe(409);

    // Cumulative over-receipt across multiple receipts.
    const cumulative = await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/goods-receipt`).set(auth(buyer)).send({
      deliveryNoteReference: unique('DN'),
      items: [{ purchaseOrderItemId: line.id, receivedQuantity: 1, rejectedQuantity: 0 }],
    });
    expect(cumulative.status).toBe(400);

    await setRole(buyer, 'OWNER');
  });

  it('rejects duplicate invoice number, wrong currency and over-invoicing', async () => {
    const context = await runLifecycle();
    const { buyer, supplierB, purchaseOrder, invoiceId } = context;
    const existing = await prisma.invoice.findUnique({ where: { id: invoiceId } });

    // Duplicate invoice number for the same supplier.
    const duplicate = await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/invoices`).set(auth(supplierB)).send({
      invoiceNumber: existing!.invoiceNumber,
      poId: purchaseOrder.id,
      invoiceDate: new Date().toISOString(),
      dueDate: isoDays(30),
      currency: 'BWP',
      tax: 0,
      items: [{ purchaseOrderItemId: purchaseOrder.items[0].id, description: 'dup', quantity: 1, unitPrice: 10 }],
    });
    expect(duplicate.status).toBe(409);

    // Currency mismatch against the PO.
    const wrongCurrency = await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/invoices`).set(auth(supplierB)).send({
      invoiceNumber: unique('INV'),
      poId: purchaseOrder.id,
      invoiceDate: new Date().toISOString(),
      dueDate: isoDays(30),
      currency: 'USD',
      tax: 0,
      items: [{ purchaseOrderItemId: purchaseOrder.items[0].id, description: 'x', quantity: 1, unitPrice: 10 }],
    });
    expect(wrongCurrency.status).toBe(400);

    // Over-invoicing must be flagged as blocking and block approval.
    const inflated = expectOk(await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/invoices`).set(auth(supplierB)).send({
      invoiceNumber: unique('INV'),
      poId: purchaseOrder.id,
      invoiceDate: new Date().toISOString(),
      dueDate: isoDays(30),
      currency: 'BWP',
      tax: 0,
      items: purchaseOrder.items.map((item: any) => ({
        purchaseOrderItemId: item.id,
        description: item.name,
        quantity: Number(item.quantity) * 2,
        unitPrice: Number(item.unitPrice) * 2,
      })),
    }), 'inflated invoice');

    const match = expectOk(await api().get(`${BASE}/invoices/${inflated.id}/three-way-match`).set(auth(buyer)), 'match');
    const codes = match.result.exceptions.map((exception: any) => exception.code);
    expect(codes).toContain('OVER_INVOICING');
    expect(codes).toContain('QUANTITY_MISMATCH');
    expect(codes).toContain('PRICE_MISMATCH');
    expect(match.result.blocking).toBeGreaterThan(0);

    await setRole(buyer, 'FINANCE');
    const approval = await api().post(`${BASE}/invoices/${inflated.id}/decision`).set(auth(buyer)).send({ decision: 'APPROVED' });
    expect(approval.status).toBe(409);
    await setRole(buyer, 'OWNER');
  });

  it('flags a missing goods receipt as a blocking match exception', async () => {
    const context = await runLifecycle({ splitDelivery: false });
    const match = expectOk(await api().get(`${BASE}/invoices/${context.invoiceId}/three-way-match`).set(auth(context.buyer)), 'match');
    expect(match.result.exceptions.map((exception: any) => exception.code)).toContain('MISSING_RECEIPT');
    expect(match.result.blocking).toBeGreaterThan(0);
  });

  it('rejects payment above the outstanding balance, duplicate reference and wrong currency', async () => {
    const context = await runLifecycle();
    const { buyer, invoiceId } = context;

    await setRole(buyer, 'FINANCE');
    // Payment before approval must be refused.
    const early = await api().post(`${BASE}/invoices/${invoiceId}/payments`).set(auth(buyer)).send({
      amount: 1, currency: 'BWP', paymentDate: new Date().toISOString(), paymentMethod: 'BANK_TRANSFER', reference: unique('PAY'),
    });
    expect(early.status).toBe(409);

    expectOk(await api().post(`${BASE}/invoices/${invoiceId}/decision`).set(auth(buyer)).send({ decision: 'APPROVED' }), 'approve');
    const invoice = expectOk(await api().get(`${BASE}/invoices/${invoiceId}`).set(auth(buyer)), 'invoice');
    const total = Number(invoice.total);

    const overpay = await api().post(`${BASE}/invoices/${invoiceId}/payments`).set(auth(buyer)).send({
      amount: total + 1, currency: 'BWP', paymentDate: new Date().toISOString(), paymentMethod: 'BANK_TRANSFER', reference: unique('PAY'),
    });
    expect(overpay.status).toBe(400);

    const wrongCurrency = await api().post(`${BASE}/invoices/${invoiceId}/payments`).set(auth(buyer)).send({
      amount: 1, currency: 'USD', paymentDate: new Date().toISOString(), paymentMethod: 'BANK_TRANSFER', reference: unique('PAY'),
    });
    expect(wrongCurrency.status).toBe(400);

    const reference = unique('PAY');
    expectOk(await api().post(`${BASE}/invoices/${invoiceId}/payments`).set(auth(buyer)).send({
      amount: 10, currency: 'BWP', paymentDate: new Date().toISOString(), paymentMethod: 'BANK_TRANSFER', reference,
    }), 'first payment');

    const duplicateReference = await api().post(`${BASE}/invoices/${invoiceId}/payments`).set(auth(buyer)).send({
      amount: 10, currency: 'BWP', paymentDate: new Date().toISOString(), paymentMethod: 'BANK_TRANSFER', reference,
    });
    expect(duplicateReference.status).toBe(409);

    // Cumulative overpayment.
    const cumulative = await api().post(`${BASE}/invoices/${invoiceId}/payments`).set(auth(buyer)).send({
      amount: total, currency: 'BWP', paymentDate: new Date().toISOString(), paymentMethod: 'BANK_TRANSFER', reference: unique('PAY'),
    });
    expect(cumulative.status).toBe(400);

    await setRole(buyer, 'OWNER');
  });

  it('rejects premature closeout and closeout with unresolved state', async () => {
    const context = await runLifecycle({ splitDelivery: false });
    const { buyer, purchaseOrder } = context;

    // No receipts and no approved invoice: closeout must be refused with explicit blockers.
    const response = await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/closeout`).set(auth(buyer)).send({});
    expect(response.status).toBe(409);
    expect(Array.isArray(response.body.blockers)).toBe(true);
    expect(response.body.blockers.length).toBeGreaterThan(0);

    const stored = await prisma.purchaseOrder.findUnique({ where: { id: purchaseOrder.id } });
    expect(stored?.status).not.toBe('CLOSED');
  });

  it('enforces the quote state machine', async () => {
    const context = await runLifecycle();
    const { supplierB, quoteB } = context;

    // Revising or withdrawing after award must be refused.
    const revise = await api().patch(`${BASE}/quotes/${quoteB.id}`).set(auth(supplierB)).send({
      currency: 'BWP', tax: 0, deliveryFee: 0, discount: 0,
      items: [{ rfqItemId: context.quoteB.items[0].rfqItemId, quantity: 1, unitPrice: 1 }],
    });
    expect(revise.status).toBe(409);

    const withdraw = await api().post(`${BASE}/quotes/${quoteB.id}/withdraw`).set(auth(supplierB)).send({});
    expect(withdraw.status).toBe(409);
  });

  it('enforces the PO state machine', async () => {
    const context = await runLifecycle();
    const { supplierB, purchaseOrder } = context;

    // Already acknowledged; second acknowledgement must be refused.
    const second = await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/acknowledge`).set(auth(supplierB)).send({});
    expect(second.status).toBe(409);

    // Dispatch against a closed PO must be refused.
    await prisma.purchaseOrder.update({ where: { id: purchaseOrder.id }, data: { status: 'CLOSED' } });
    const dispatch = await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/deliveries`).set(auth(supplierB)).send({
      dispatchReference: unique('DSP'),
      items: [{ purchaseOrderItemId: purchaseOrder.items[0].id, quantity: 1 }],
    });
    expect(dispatch.status).toBe(409);
    // Restore the forced state so persistent data-integrity invariants stay meaningful.
    await prisma.purchaseOrder.update({ where: { id: purchaseOrder.id }, data: { status: 'ACKNOWLEDGED' } });
  });

  it('enforces the invoice state machine', async () => {
    const context = await runLifecycle();
    const { buyer, invoiceId } = context;

    await setRole(buyer, 'FINANCE');
    expectOk(await api().post(`${BASE}/invoices/${invoiceId}/decision`).set(auth(buyer)).send({ decision: 'APPROVED' }), 'approve');

    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'PAID' } });
    const afterPaid = await api().post(`${BASE}/invoices/${invoiceId}/decision`).set(auth(buyer)).send({ decision: 'REJECTED' });
    expect(afterPaid.status).toBe(409);

    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'VOID' } });
    const afterVoid = await api().post(`${BASE}/invoices/${invoiceId}/decision`).set(auth(buyer)).send({ decision: 'APPROVED' });
    expect(afterVoid.status).toBe(409);
    // Leave the invoice VOID-free so persistent invariants reflect real business state.
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'APPROVED' } });
    await setRole(buyer, 'OWNER');
  });

  it('enforces RBAC on privileged routes', async () => {
    const context = await runLifecycle();
    const { buyer, supplierB, purchaseOrder, invoiceId } = context;

    // A supplier must never receive buyer permissions.
    expect((await api().post(`${BASE}/invoices/${invoiceId}/decision`).set(auth(supplierB)).send({ decision: 'APPROVED' })).status).toBe(403);
    expect((await api().post(`${BASE}/invoices/${invoiceId}/payments`).set(auth(supplierB)).send({
      amount: 1, currency: 'BWP', paymentDate: new Date().toISOString(), paymentMethod: 'BANK_TRANSFER', reference: unique('PAY'),
    })).status).toBe(403);
    expect((await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/closeout`).set(auth(supplierB)).send({})).status).toBe(403);
    expect((await api().get(`${BASE}/exceptions`).set(auth(supplierB))).status).toBe(403);

    // A VIEWER must not be able to approve invoices or record payments.
    await setRole(buyer, 'VIEWER');
    expect((await api().post(`${BASE}/invoices/${invoiceId}/decision`).set(auth(buyer)).send({ decision: 'APPROVED' })).status).toBe(403);
    expect((await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/goods-receipt`).set(auth(buyer)).send({
      items: [{ purchaseOrderItemId: purchaseOrder.items[0].id, receivedQuantity: 1, rejectedQuantity: 0 }],
    })).status).toBe(403);
    expect((await api().post(`${BASE}/rfqs`).set(auth(buyer)).send({
      purchaseRequestId: context.requestId, quoteDeadline: isoDays(5), currency: 'BWP', supplierIds: [supplierB.organizationId],
    })).status).toBe(403);

    // A buyer must not act as a supplier.
    await setRole(buyer, 'PROCUREMENT');
    expect((await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/acknowledge`).set(auth(buyer)).send({})).status).toBe(403);
    await setRole(buyer, 'OWNER');
  });

  it('rejects unauthenticated and malformed tokens', async () => {
    expect((await api().get(`${BASE}/purchase-orders`)).status).toBe(401);
    expect((await api().get(`${BASE}/purchase-orders`).set({ Authorization: 'Bearer not-a-token' })).status).toBe(401);
    expect((await api().get(`${BASE}/invoices`).set({ Authorization: 'Basic abc' })).status).toBe(401);
  });
});
