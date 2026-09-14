-- CreateEnum
CREATE TYPE "ScheduleFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY');

-- AlterTable
ALTER TABLE "PurchaseRequest" ADD COLUMN     "sourceRequestId" TEXT,
ADD COLUMN     "templateId" TEXT;

-- CreateTable
CREATE TABLE "ProcurementTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "department" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "leadTimeDays" INTEGER,
    "preferredSupplierIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdBy" TEXT,
    "frequency" "ScheduleFrequency",
    "scheduleActive" BOOLEAN NOT NULL DEFAULT false,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(18,2) NOT NULL,
    "unit" TEXT,
    "estimatedUnitPrice" DECIMAL(18,2),
    "specifications" TEXT,

    CONSTRAINT "ProcurementTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcurementTemplate_scheduleActive_nextRunAt_idx" ON "ProcurementTemplate"("scheduleActive", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementTemplate_organizationId_name_key" ON "ProcurementTemplate"("organizationId", "name");

-- CreateIndex
CREATE INDEX "PurchaseRequest_sourceRequestId_idx" ON "PurchaseRequest"("sourceRequestId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_templateId_idx" ON "PurchaseRequest"("templateId");

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_sourceRequestId_fkey" FOREIGN KEY ("sourceRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProcurementTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementTemplate" ADD CONSTRAINT "ProcurementTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementTemplateItem" ADD CONSTRAINT "ProcurementTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProcurementTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
