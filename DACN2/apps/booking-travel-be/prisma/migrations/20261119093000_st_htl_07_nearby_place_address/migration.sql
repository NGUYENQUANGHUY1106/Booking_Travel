ALTER TABLE "NearbyPlaceCache"
ADD COLUMN "address" TEXT;

-- Existing cache rows do not contain provider address data, so refresh them once.
UPDATE "NearbyPlaceCache"
SET "expiresAt" = CURRENT_TIMESTAMP
WHERE "expiresAt" > CURRENT_TIMESTAMP;
