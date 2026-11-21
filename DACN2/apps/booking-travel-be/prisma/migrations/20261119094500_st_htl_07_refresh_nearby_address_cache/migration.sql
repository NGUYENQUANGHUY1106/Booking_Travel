UPDATE "NearbyPlaceCache"
SET "expiresAt" = CURRENT_TIMESTAMP - INTERVAL '1 day'
WHERE "address" IS NULL;
