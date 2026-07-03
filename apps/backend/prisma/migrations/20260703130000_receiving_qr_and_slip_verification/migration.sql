ALTER TYPE "DonationStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

ALTER TABLE "PayoutAccount"
  ALTER COLUMN "accountName" DROP NOT NULL,
  ALTER COLUMN "bankName" DROP NOT NULL,
  ALTER COLUMN "accountNumber" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "receivingQrImageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "receivingQrPayload" TEXT;

ALTER TABLE "Donation"
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "slipTransactionRef" TEXT,
  ADD COLUMN IF NOT EXISTS "slipVerification" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "Donation_slipTransactionRef_key"
  ON "Donation"("slipTransactionRef");
