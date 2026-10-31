CREATE TYPE "OwnerApplicationStatus" AS ENUM ('DRAFT', 'PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');
CREATE TYPE "OwnerDocumentPurpose" AS ENUM ('IDENTITY', 'BUSINESS_LICENSE');
CREATE TYPE "PrivateMediaStatus" AS ENUM ('RESERVED', 'READY');

CREATE TABLE "PrivateMediaObject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "OwnerDocumentPurpose" NOT NULL,
    "status" "PrivateMediaStatus" NOT NULL DEFAULT 'RESERVED',
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "expectedSize" INTEGER NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrivateMediaObject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HotelOwnerApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OwnerApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "businessName" TEXT,
    "businessAddress" TEXT,
    "representativeName" TEXT,
    "businessRegistrationNumber" TEXT,
    "businessPhone" TEXT,
    "identityDocumentId" TEXT,
    "businessLicenseDocumentId" TEXT,
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HotelOwnerApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivateMediaObject_objectKey_key" ON "PrivateMediaObject"("objectKey");
CREATE INDEX "PrivateMediaObject_userId_purpose_status_idx" ON "PrivateMediaObject"("userId", "purpose", "status");
CREATE UNIQUE INDEX "HotelOwnerApplication_userId_key" ON "HotelOwnerApplication"("userId");
CREATE UNIQUE INDEX "HotelOwnerApplication_identityDocumentId_key" ON "HotelOwnerApplication"("identityDocumentId");
CREATE UNIQUE INDEX "HotelOwnerApplication_businessLicenseDocumentId_key" ON "HotelOwnerApplication"("businessLicenseDocumentId");
CREATE INDEX "HotelOwnerApplication_status_submittedAt_idx" ON "HotelOwnerApplication"("status", "submittedAt");

ALTER TABLE "PrivateMediaObject" ADD CONSTRAINT "PrivateMediaObject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelOwnerApplication" ADD CONSTRAINT "HotelOwnerApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelOwnerApplication" ADD CONSTRAINT "HotelOwnerApplication_identityDocumentId_fkey" FOREIGN KEY ("identityDocumentId") REFERENCES "PrivateMediaObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HotelOwnerApplication" ADD CONSTRAINT "HotelOwnerApplication_businessLicenseDocumentId_fkey" FOREIGN KEY ("businessLicenseDocumentId") REFERENCES "PrivateMediaObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
