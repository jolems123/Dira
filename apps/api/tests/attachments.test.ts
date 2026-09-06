import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { api, auth, BASE } from './helpers';
import { runLifecycle } from './lifecycle.test';

describe('real document storage endpoints', () => {
  it('uploads, lists, downloads, rejects invalid content, and enforces entity authorization', async () => {
    const context = await runLifecycle();
    const valid = await api()
      .post(`${BASE}/documents`)
      .set(auth(context.supplierB))
      .field('entityType', 'QUOTATION')
      .field('entityId', context.quoteB.id)
      .field('documentType', 'QUOTE')
      .attach('file', Buffer.from('%PDF-1.7\nDira quote evidence'), { filename: 'quote.pdf', contentType: 'application/pdf' });
    expect(valid.status).toBe(201);
    const documentId = valid.body.document.id;

    const listed = await api().get(`${BASE}/documents/QUOTATION/${context.quoteB.id}`).set(auth(context.buyer));
    expect(listed.status).toBe(200);
    expect(listed.body.items).toHaveLength(1);

    const downloaded = await api().get(`${BASE}/documents/${documentId}/content`).set(auth(context.buyer));
    expect(downloaded.status).toBe(200);
    expect(downloaded.body.toString()).toContain('%PDF-1.7');

    const duplicate = await api()
      .post(`${BASE}/documents`)
      .set(auth(context.supplierB))
      .field('entityType', 'QUOTATION').field('entityId', context.quoteB.id).field('documentType', 'QUOTE')
      .attach('file', Buffer.from('%PDF-1.7\nDira quote evidence'), { filename: 'copy.pdf', contentType: 'application/pdf' });
    expect(duplicate.status).toBe(409);

    const bad = await api()
      .post(`${BASE}/documents`)
      .set(auth(context.supplierB))
      .field('entityType', 'QUOTATION').field('entityId', context.quoteB.id).field('documentType', 'QUOTE')
      .attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'invoice.html', contentType: 'text/html' });
    expect(bad.status).toBe(400);

    const unauthorized = await api().get(`${BASE}/documents/${documentId}/content`).set(auth(context.supplierA));
    expect(unauthorized.status).toBe(404);
  });

  afterAll(async () => prisma.$disconnect());
});
