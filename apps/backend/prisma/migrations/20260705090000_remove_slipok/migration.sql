DROP INDEX IF EXISTS "Donation_slipTransactionRef_key";

ALTER TABLE "Donation"
  DROP COLUMN IF EXISTS "verifiedAt",
  DROP COLUMN IF EXISTS "slipTransactionRef",
  DROP COLUMN IF EXISTS "slipVerification";

ALTER TABLE "PayoutAccount"
  DROP COLUMN IF EXISTS "slipOkBranchId",
  DROP COLUMN IF EXISTS "slipOkApiKeyEncrypted";
