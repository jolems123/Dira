-- Switch launch market from Botswana (BWP) to Uganda (UGX).
ALTER TABLE "PurchaseRequest" ALTER COLUMN "currency" SET DEFAULT 'UGX';
ALTER TABLE "RFQ" ALTER COLUMN "currency" SET DEFAULT 'UGX';
ALTER TABLE "Quotation" ALTER COLUMN "currency" SET DEFAULT 'UGX';
ALTER TABLE "PurchaseOrder" ALTER COLUMN "currency" SET DEFAULT 'UGX';
ALTER TABLE "Invoice" ALTER COLUMN "currency" SET DEFAULT 'UGX';
ALTER TABLE "PaymentRecord" ALTER COLUMN "currency" SET DEFAULT 'UGX';
