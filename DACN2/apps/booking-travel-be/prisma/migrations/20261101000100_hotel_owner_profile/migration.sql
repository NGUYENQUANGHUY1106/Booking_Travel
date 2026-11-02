-- Drafts can be created before the location step. Existing location values are preserved.
ALTER TABLE "Hotel"
  ALTER COLUMN "addressLine" DROP NOT NULL,
  ALTER COLUMN "city" DROP NOT NULL,
  ALTER COLUMN "province" DROP NOT NULL,
  ADD COLUMN "accommodationType" "AccommodationPreferenceType",
  ADD COLUMN "contactEmail" TEXT,
  ADD COLUMN "contactPhone" TEXT,
  ADD COLUMN "checkInTime" VARCHAR(5),
  ADD COLUMN "checkOutTime" VARCHAR(5),
  ADD COLUMN "profileVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "clientDraftId" TEXT;

CREATE UNIQUE INDEX "Hotel_ownerId_clientDraftId_key" ON "Hotel"("ownerId", "clientDraftId");

CREATE TABLE "HotelPolicy" (
  "hotelId" TEXT NOT NULL,
  "cancellationPolicy" TEXT,
  "houseRules" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HotelPolicy_pkey" PRIMARY KEY ("hotelId")
);

ALTER TABLE "HotelPolicy" ADD CONSTRAINT "HotelPolicy_hotelId_fkey"
  FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
