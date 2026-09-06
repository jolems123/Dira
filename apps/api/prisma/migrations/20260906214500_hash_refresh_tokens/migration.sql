ALTER TABLE "RefreshToken" ADD COLUMN "tokenHash" TEXT;
UPDATE "RefreshToken" SET "tokenHash" = encode(sha256(convert_to("token", 'UTF8')), 'hex');
ALTER TABLE "RefreshToken" ALTER COLUMN "tokenHash" SET NOT NULL;
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
ALTER TABLE "RefreshToken" DROP COLUMN "token";
