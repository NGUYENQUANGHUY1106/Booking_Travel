-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "VerificationPurpose" AS ENUM ('REGISTRATION');

-- CreateEnum
CREATE TYPE "VerificationChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "VerificationDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "User"
  ALTER COLUMN "email" DROP NOT NULL,
  ALTER COLUMN "isActive" SET DEFAULT false,
  ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

-- Existing seeded/system accounts stay usable. New accounts use the schema default below.
ALTER TABLE "User"
  ALTER COLUMN "status" SET DEFAULT 'PENDING_VERIFICATION';

-- CreateTable
CREATE TABLE "VerificationCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "purpose" "VerificationPurpose" NOT NULL,
  "channel" "VerificationChannel" NOT NULL,
  "target" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "resendAvailableAt" TIMESTAMP(3) NOT NULL,
  "sendCount" INTEGER NOT NULL DEFAULT 1,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "deliveryStatus" "VerificationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationCode_sessionId_key" ON "VerificationCode"("sessionId");

-- CreateIndex
CREATE INDEX "VerificationCode_userId_purpose_consumedAt_idx" ON "VerificationCode"("userId", "purpose", "consumedAt");

-- CreateIndex
CREATE INDEX "VerificationCode_target_purpose_expiresAt_idx" ON "VerificationCode"("target", "purpose", "expiresAt");

-- AddForeignKey
ALTER TABLE "VerificationCode"
  ADD CONSTRAINT "VerificationCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
