ALTER TABLE "Donation" ADD COLUMN "providerTransactionId" TEXT;

CREATE UNIQUE INDEX "Donation_providerTransactionId_key" ON "Donation"("providerTransactionId");
