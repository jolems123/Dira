-- CreateEnum
CREATE TYPE "DeliveryKind" AS ENUM ('DISPATCH', 'RECEIPT');

-- DropIndex
DROP INDEX "Invoice_invoiceNumber_key";

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "attachmentKey" TEXT,
ADD COLUMN     "dispatchReference" TEXT,
ADD COLUMN     "kind" "DeliveryKind" NOT NULL DEFAULT 'DISPATCH';

-- AlterTable
ALTER TABLE "DeliveryItem" ADD COLUMN     "purchaseOrderItemId" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "attachmentKey" TEXT,
ADD COLUMN     "decisionAt" TIMESTAMP(3),
ADD COLUMN     "decisionBy" TEXT,
ADD COLUMN     "decisionReason" TEXT,
ADD COLUMN     "invoiceDate" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "purchaseOrderItemId" TEXT;

-- AlterTable
ALTER TABLE "PaymentRecord" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedBy" TEXT,
ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "paymentTerms" TEXT;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "awardReason" TEXT,
ADD COLUMN     "awardedAt" TIMESTAMP(3),
ADD COLUMN     "awardedBy" TEXT,
ADD COLUMN     "revisedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Delivery_purchaseOrderId_idx" ON "Delivery"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "Invoice_buyerOrganizationId_idx" ON "Invoice"("buyerOrganizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_supplierOrganizationId_invoiceNumber_key" ON "Invoice"("supplierOrganizationId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_invoiceId_reference_key" ON "PaymentRecord"("invoiceId", "reference");

-- CreateIndex
CREATE INDEX "PurchaseOrder_buyerOrganizationId_idx" ON "PurchaseOrder"("buyerOrganizationId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierOrganizationId_idx" ON "PurchaseOrder"("supplierOrganizationId");

-- CreateIndex
CREATE INDEX "Quotation_rfqId_idx" ON "Quotation"("rfqId");

-- CreateIndex
CREATE INDEX "Quotation_supplierOrganizationId_idx" ON "Quotation"("supplierOrganizationId");

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RFQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_buyerOrganizationId_fkey" FOREIGN KEY ("buyerOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierOrganizationId_fkey" FOREIGN KEY ("supplierOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RFQ"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

