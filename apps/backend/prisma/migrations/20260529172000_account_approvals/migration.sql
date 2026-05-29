CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED');
CREATE TYPE "ApprovalType" AS ENUM ('REGISTER', 'EMAIL_CHANGE');
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "User"
  ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "pendingEmail" TEXT;

UPDATE "User" SET "accountStatus" = 'APPROVED';

CREATE TABLE "ApprovalRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "ApprovalType" NOT NULL,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "requestedEmail" TEXT,
  "note" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ApprovalRequest"
  ADD CONSTRAINT "ApprovalRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ApprovalRequest_status_createdAt_idx" ON "ApprovalRequest"("status", "createdAt");
CREATE INDEX "Donation_userId_createdAt_idx" ON "Donation"("userId", "createdAt");
CREATE INDEX "Donation_paymentStatus_createdAt_idx" ON "Donation"("paymentStatus", "createdAt");
