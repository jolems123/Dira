import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { Actor, BASE, api, auth, expectOk, isoDays, registerOrg, setRole, unique } from './helpers';

export interface LifecycleContext {
  buyer: Actor;
  supplierA: Actor;
  supplierB: Actor;
  requestId: string;
  rfqId: string;
  quoteA: any;
  quoteB: any;
  purchaseOrder: any;
  invoiceId: string;
}

/**
 * Drives the canonical procure-to-pay chain end to end against the live database.
 * Exported so negative/IDOR suites can reuse a fully populated scenario.
 */
export async function runLifecycle(options: { splitDelivery?: boolean } = {}): Promise<LifecycleContext> {
  const buyer = await registerOrg('BUYER', 'buyer');
  const supplierA = await registerOrg('SUPPLIER', 'supa');
  const supplierB = await registerOrg('SUPPLIER', 'supb');

  await setRole(buyer, 'OWNER');

  const request = expectOk(
    await api().post(`${BASE}/purchase-requests`).set(auth(buyer)).send({
      title: 'Office laptops',
      department: 'IT',
      currency: 'BWP',
      requiredBy: isoDays(30),
      items: [
        { name: 'Laptop 14"', quantity: 10, unit: 'unit', estimatedUnitPrice: 6000 },
        { name: 'Docking station', quantity: 10, unit: 'unit', estimatedUnitPrice: 1200 },
      ],
    }),
    'create request',
  );

  await api().post(`${BASE}/purchase-requests/${request.id}/submit`).set(auth(buyer)).send({});
  expectOk(await api().post(`${BASE}/purchase-requests/${request.id}/approve`).set(auth(buyer)).send({ comment: 'Approved' }), 'approve request');

  const rfq = expectOk(
    await api().post(`${BASE}/rfqs`).set(auth(buyer)).send({
      purchaseRequestId: request.id,
      quoteDeadline: isoDays(7),
      requiredBy: isoDays(30),
      currency: 'BWP',
      supplierIds: [supplierA.organizationId, supplierB.organizationId],
    }),
    'create rfq',
  );
  await api().post(`${BASE}/rfqs/${rfq.id}/publish`).set(auth(buyer)).send({});

  const rfqDetail = expectOk(await api().get(`${BASE}/rfqs`).set(auth(buyer)), 'list rfqs');
  const rfqRecord = rfqDetail.items.find((item: any) => item.id === rfq.id);
  const rfqItems = rfqRecord.items;

  const quoteA = expectOk(
    await api().post(`${BASE}/rfqs/${rfq.id}/quotes`).set(auth(supplierA)).send({
      currency: 'BWP',
      tax: 0,
      deliveryFee: 0,
      discount: 0,
      deliveryDays: 14,
      paymentTerms: 'NET30',
      validUntil: isoDays(20),
      items: rfqItems.map((item: any, index: number) => ({
        rfqItemId: item.id,
        quantity: Number(item.quantity),
        unitPrice: index === 0 ? 6500 : 1400,
      })),
    }),
    'supplier A quote',
  );

  const quoteB = expectOk(
    await api().post(`${BASE}/rfqs/${rfq.id}/quotes`).set(auth(supplierB)).send({
      currency: 'BWP',
      tax: 0,
      deliveryFee: 0,
      discount: 0,
      deliveryDays: 10,
      paymentTerms: 'NET30',
      validUntil: isoDays(20),
      items: rfqItems.map((item: any, index: number) => ({
        rfqItemId: item.id,
        quantity: Number(item.quantity),
        unitPrice: index === 0 ? 6000 : 1200,
      })),
    }),
    'supplier B quote',
  );

  const award = expectOk(
    await api().post(`${BASE}/rfqs/${rfq.id}/award`).set(auth(buyer)).send({
      quotationId: quoteB.id,
      awardReason: 'Best total cost and shortest lead time',
    }),
    'award',
  );
  const purchaseOrder = award.purchaseOrder;

  expectOk(await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/acknowledge`).set(auth(supplierB)).send({ notes: 'Confirmed' }), 'acknowledge');

  const poLines: any[] = purchaseOrder.items;

  if (options.splitDelivery !== false) {
    expectOk(
      await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/deliveries`).set(auth(supplierB)).send({
        dispatchReference: unique('DSP'),
        expectedDeliveryDate: isoDays(5),
        items: poLines.map((line) => ({ purchaseOrderItemId: line.id, quantity: 4 })),
      }),
      'dispatch 1',
    );

    await setRole(buyer, 'RECEIVER');
    const receipt1 = expectOk(
      await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/goods-receipt`).set(auth(buyer)).send({
        deliveryNoteReference: unique('DN'),
        items: poLines.map((line) => ({ purchaseOrderItemId: line.id, receivedQuantity: 4, rejectedQuantity: 0, condition: 'GOOD' })),
      }),
      'receipt 1',
    );
    expect(receipt1.summary.every((line: any) => line.remaining === 6)).toBe(true);
    await setRole(buyer, 'OWNER');

    expectOk(
      await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/deliveries`).set(auth(supplierB)).send({
        dispatchReference: unique('DSP'),
        expectedDeliveryDate: isoDays(9),
        items: poLines.map((line) => ({ purchaseOrderItemId: line.id, quantity: 6 })),
      }),
      'dispatch 2',
    );

    await setRole(buyer, 'RECEIVER');
    const receipt2 = expectOk(
      await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/goods-receipt`).set(auth(buyer)).send({
        deliveryNoteReference: unique('DN'),
        items: poLines.map((line) => ({ purchaseOrderItemId: line.id, receivedQuantity: 6, rejectedQuantity: 0, condition: 'GOOD' })),
      }),
      'receipt 2',
    );
    expect(receipt2.summary.every((line: any) => line.remaining === 0)).toBe(true);
    await setRole(buyer, 'OWNER');
  }

  const invoice = expectOk(
    await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/invoices`).set(auth(supplierB)).send({
      invoiceNumber: unique('INV'),
      poId: purchaseOrder.id,
      invoiceDate: new Date().toISOString(),
      dueDate: isoDays(30),
      currency: 'BWP',
      tax: Number(purchaseOrder.tax),
      items: poLines.map((line) => ({
        purchaseOrderItemId: line.id,
        description: line.name,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
      })),
    }),
    'invoice',
  );

  return {
    buyer,
    supplierA,
    supplierB,
    requestId: request.id,
    rfqId: rfq.id,
    quoteA,
    quoteB,
    purchaseOrder,
    invoiceId: invoice.id,
  };
}

describe('procure-to-pay lifecycle', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('completes request → approval → RFQ → quotes → award → PO → delivery → receipt → invoice → approval → payment → closeout', async () => {
    const context = await runLifecycle();
    const { buyer, supplierB, purchaseOrder, invoiceId } = context;

    const match = expectOk(await api().get(`${BASE}/invoices/${invoiceId}/three-way-match`).set(auth(buyer)), 'match');
    expect(match.result.blocking).toBe(0);
    expect(match.result.matched).toBe(true);

    await setRole(buyer, 'FINANCE');
    const approved = expectOk(
      await api().post(`${BASE}/invoices/${invoiceId}/decision`).set(auth(buyer)).send({ decision: 'APPROVED', reason: 'Matched' }),
      'approve invoice',
    );
    expect(approved.status).toBe('APPROVED');

    const invoiceDetail = expectOk(await api().get(`${BASE}/invoices/${invoiceId}`).set(auth(buyer)), 'invoice detail');
    const total = Number(invoiceDetail.total);

    const partial = expectOk(
      await api().post(`${BASE}/invoices/${invoiceId}/payments`).set(auth(buyer)).send({
        amount: Number((total / 2).toFixed(2)),
        currency: 'BWP',
        paymentDate: new Date().toISOString(),
        paymentMethod: 'BANK_TRANSFER',
        reference: unique('PAY'),
      }),
      'partial payment',
    );
    expect(partial.invoice.status).toBe('PARTIALLY_PAID');

    // Closeout must be refused while a balance remains.
    const prematureCloseout = await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/closeout`).set(auth(buyer)).send({});
    expect(prematureCloseout.status).toBe(409);

    const final = expectOk(
      await api().post(`${BASE}/invoices/${invoiceId}/payments`).set(auth(buyer)).send({
        amount: Number(partial.outstanding),
        currency: 'BWP',
        paymentDate: new Date().toISOString(),
        paymentMethod: 'BANK_TRANSFER',
        reference: unique('PAY'),
      }),
      'final payment',
    );
    expect(final.invoice.status).toBe('PAID');

    const closed = expectOk(await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/closeout`).set(auth(buyer)).send({}), 'closeout');
    expect(closed.status).toBe('CLOSED');
    expect(closed.closedAt).toBeTruthy();
    expect(closed.closedBy).toBe(buyer.userId);

    const stored = await prisma.purchaseOrder.findUnique({ where: { id: purchaseOrder.id } });
    expect(stored?.status).toBe('CLOSED');

    // Losing supplier's quote must have been rejected by the award.
    const losing = await prisma.quotation.findUnique({ where: { id: context.quoteA.id } });
    expect(losing?.status).toBe('REJECTED');

    const winning = await prisma.quotation.findUnique({ where: { id: context.quoteB.id } });
    expect(winning?.status).toBe('AWARDED');
    expect(winning?.awardedBy).toBe(buyer.userId);
    expect(winning?.awardReason).toBeTruthy();

    // Audit trail must record each critical transition.
    const actions = await prisma.auditLog.findMany({
      where: { organizationId: buyer.organizationId },
      select: { action: true },
    });
    const seen = new Set(actions.map((entry) => entry.action));
    for (const action of ['AWARD_QUOTATION', 'GOODS_RECEIPT', 'INVOICE_DECISION', 'RECORD_PAYMENT', 'CLOSEOUT_PROCUREMENT']) {
      expect(seen.has(action), `missing audit action ${action}`).toBe(true);
    }

    const supplierDashboard = expectOk(await api().get(`${BASE}/supplier/dashboard`).set(auth(supplierB)), 'supplier dashboard');
    expect(supplierDashboard.awards).toBeGreaterThanOrEqual(1);
    expect(supplierDashboard.outstandingReceivable).toBe(0);
  });
});
