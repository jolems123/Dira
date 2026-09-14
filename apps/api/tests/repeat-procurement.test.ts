import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { runDueSchedules } from '../src/lib/repeat-procurement';
import { Actor, BASE, api, auth, expectOk, isoDays, registerOrg, setRole, unique } from './helpers';
import { runLifecycle } from './lifecycle.test';

/** Request → RFQ → quote (unit prices only, VAT left to the server) → award → acknowledged PO. */
async function awardedOrder(buyer: Actor, supplier: Actor) {
  await setRole(buyer, 'OWNER');
  const request = expectOk(
    await api().post(`${BASE}/purchase-requests`).set(auth(buyer)).send({
      title: 'Printer paper',
      department: 'Admin',
      items: [
        { name: 'A4 paper ream', quantity: 20, unit: 'ream', estimatedUnitPrice: 25_000 },
        { name: 'Toner', quantity: 2, unit: 'unit', estimatedUnitPrice: 300_000 },
      ],
    }),
    'create request',
  );
  await api().post(`${BASE}/purchase-requests/${request.id}/submit`).set(auth(buyer)).send({});
  expectOk(await api().post(`${BASE}/purchase-requests/${request.id}/approve`).set(auth(buyer)).send({}), 'approve');
  const rfq = expectOk(
    await api().post(`${BASE}/rfqs`).set(auth(buyer)).send({ purchaseRequestId: request.id, quoteDeadline: isoDays(7), supplierIds: [supplier.organizationId] }),
    'create rfq',
  );
  await api().post(`${BASE}/rfqs/${rfq.id}/publish`).set(auth(buyer)).send({});
  const quote = expectOk(
    await api().post(`${BASE}/rfqs/${rfq.id}/quotes`).set(auth(supplier)).send({
      deliveryFee: 10_000,
      paymentTerms: 'Net 14',
      validUntil: isoDays(20),
      items: rfq.items.map((item: any) => ({ rfqItemId: item.id, unitPrice: item.name === 'Toner' ? 280_000 : 24_000 })),
    }),
    'quote',
  );
  const award = expectOk(await api().post(`${BASE}/rfqs/${rfq.id}/award`).set(auth(buyer)).send({ quotationId: quote.id }), 'award');
  expectOk(await api().post(`${BASE}/purchase-orders/${award.purchaseOrder.id}/acknowledge`).set(auth(supplier)).send({}), 'acknowledge');
  return { request, rfq, quote, purchaseOrder: award.purchaseOrder };
}

describe('automatic calculations', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('derives request budgets, quote totals and quantities, invoices and payments without retyping', async () => {
    const buyer = await registerOrg('BUYER', 'calcbuyer');
    const supplier = await registerOrg('SUPPLIER', 'calcsup');
    const { request, quote, purchaseOrder } = await awardedOrder(buyer, supplier);

    // 20 × 25,000 + 2 × 300,000 = 1,100,000; + 18% VAT = 1,298,000
    expect(Number(request.estimatedBudget)).toBe(1_298_000);

    // Quantities came from the RFQ; VAT is charged on subtotal + delivery.
    expect(Number(quote.subtotal)).toBe(1_040_000);
    expect(Number(quote.tax)).toBe(189_000);
    expect(Number(quote.total)).toBe(1_239_000);

    const lines: any[] = purchaseOrder.items;
    await setRole(buyer, 'RECEIVER');
    expectOk(
      await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/goods-receipt`).set(auth(buyer)).send({
        deliveryNoteReference: unique('DN'),
        items: lines.map((line) => ({ purchaseOrderItemId: line.id, receivedQuantity: line.name === 'Toner' ? 2 : 10 })),
      }),
      'partial receipt',
    );

    const draft = expectOk(await api().get(`${BASE}/purchase-orders/${purchaseOrder.id}/invoice-draft`).set(auth(supplier)), 'invoice draft');
    expect(draft.basis).toBe('RECEIVED');
    expect(draft.vatRegistered).toBe(true);
    expect(draft.subtotal).toBe(800_000);
    expect(draft.tax).toBe(144_000);
    expect(new Date(draft.dueDate).getTime() - new Date(draft.invoiceDate).getTime()).toBe(14 * 86_400_000);

    // Submitting with no lines, dates or number bills exactly what the draft showed.
    const invoice = expectOk(
      await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/invoices`).set(auth(supplier)).send({ poId: purchaseOrder.id }),
      'auto invoice',
    );
    expect(Number(invoice.total)).toBe(944_000);
    expect(invoice.invoiceNumber).toBe(draft.invoiceNumber);

    const after = expectOk(await api().get(`${BASE}/purchase-orders/${purchaseOrder.id}/invoice-draft`).set(auth(supplier)), 'draft after invoice');
    expect(after.subtotal).toBe(0);
    const empty = await api().post(`${BASE}/purchase-orders/${purchaseOrder.id}/invoices`).set(auth(supplier)).send({ poId: purchaseOrder.id });
    expect(empty.status).toBe(409);

    await setRole(buyer, 'FINANCE');
    expectOk(await api().post(`${BASE}/invoices/${invoice.id}/decision`).set(auth(buyer)).send({ decision: 'APPROVED' }), 'approve invoice');
    const payment = expectOk(
      await api().post(`${BASE}/invoices/${invoice.id}/payments`).set(auth(buyer)).send({ paymentMethod: 'MOBILE_MONEY', reference: unique('PAY') }),
      'pay outstanding',
    );
    expect(Number(payment.payment.amount)).toBe(944_000);
    expect(payment.invoice.status).toBe('PAID');
  });
});

describe('repeated procurement', () => {
  it('repeats a past request with last-paid prices and suggests the same suppliers', async () => {
    const context = await runLifecycle();
    const { buyer, supplierA, supplierB } = context;

    const repeated = expectOk(await api().post(`${BASE}/purchase-requests/${context.requestId}/repeat`).set(auth(buyer)).send({}), 'repeat');
    expect(repeated.status).toBe('DRAFT');
    expect(repeated.sourceRequestId).toBe(context.requestId);
    const prices = Object.fromEntries(repeated.items.map((item: any) => [item.name, Number(item.estimatedUnitPrice)]));
    expect(prices).toEqual({ 'Laptop 14"': 6000, 'Docking station': 1200 });
    expect(Number(repeated.estimatedBudget)).toBe(84_960); // (60,000 + 12,000) × 1.18
    expect(repeated.requiredBy).toBeTruthy();

    const suggestions = expectOk(await api().get(`${BASE}/purchase-requests/${repeated.id}/supplier-suggestions`).set(auth(buyer)), 'suggestions');
    expect(suggestions.basedOn).toBe('REPEAT');
    expect(new Set(suggestions.supplierIds)).toEqual(new Set([supplierA.organizationId, supplierB.organizationId]));
    expect(suggestions.lastAwardedSupplierId).toBe(supplierB.organizationId);

    const outsider = await registerOrg('BUYER', 'outsider');
    await setRole(outsider, 'OWNER');
    expect((await api().post(`${BASE}/purchase-requests/${context.requestId}/repeat`).set(auth(outsider)).send({})).status).toBe(404);
  });

  it('saves a request as a template, drafts from it, and runs its schedule exactly once per period', async () => {
    const context = await runLifecycle();
    const { buyer } = context;
    const name = unique('Monthly laptops ');

    const template = expectOk(
      await api().post(`${BASE}/templates`).set(auth(buyer)).send({ name, sourceRequestId: context.requestId }),
      'template from request',
    );
    expect(template.items).toHaveLength(2);
    expect(template.preferredSupplierIds).toHaveLength(2);
    expect(template.leadTimeDays).toBe(30);

    const duplicate = await api().post(`${BASE}/templates`).set(auth(buyer)).send({ name, sourceRequestId: context.requestId });
    expect(duplicate.status).toBe(409);

    const drafted = expectOk(await api().post(`${BASE}/templates/${template.id}/requests`).set(auth(buyer)).send({}), 'use template');
    expect(drafted.templateId).toBe(template.id);
    expect(Number(drafted.items.find((item: any) => item.name === 'Laptop 14"').estimatedUnitPrice)).toBe(6000);

    const noFrequency = await api().patch(`${BASE}/templates/${template.id}`).set(auth(buyer)).send({ scheduleActive: true });
    expect(noFrequency.status).toBe(400);

    const firstRun = new Date(Date.now() - 60_000);
    expectOk(
      await api().patch(`${BASE}/templates/${template.id}`).set(auth(buyer)).send({ frequency: 'MONTHLY', scheduleActive: true, nextRunAt: firstRun.toISOString() }),
      'activate schedule',
    );

    const [runA, runB] = await Promise.all([runDueSchedules(), runDueSchedules()]);
    const mine = [...runA, ...runB].filter((request) => request.templateId === template.id);
    expect(mine).toHaveLength(1);

    const stored = await prisma.procurementTemplate.findUniqueOrThrow({ where: { id: template.id } });
    expect(stored.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
    expect(stored.lastRunAt).toBeTruthy();
    expect((await runDueSchedules()).filter((request) => request.templateId === template.id)).toHaveLength(0);

    const scheduledSuggestions = expectOk(await api().get(`${BASE}/purchase-requests/${mine[0].id}/supplier-suggestions`).set(auth(buyer)), 'template suggestions');
    expect(scheduledSuggestions.basedOn).toBe('TEMPLATE');
    expect(scheduledSuggestions.supplierIds).toHaveLength(2);

    const outsider = await registerOrg('BUYER', 'tplout');
    await setRole(outsider, 'OWNER');
    expect((await api().get(`${BASE}/templates/${template.id}`).set(auth(outsider))).status).toBe(404);
    expect((await api().delete(`${BASE}/templates/${template.id}`).set(auth(outsider))).status).toBe(404);
    expect((await api().delete(`${BASE}/templates/${template.id}`).set(auth(buyer))).status).toBe(204);
  });
});
