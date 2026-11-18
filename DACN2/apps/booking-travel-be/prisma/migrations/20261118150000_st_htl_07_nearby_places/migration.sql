CREATE TABLE "NearbyPlaceCache" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerPlaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "sourceUrl" TEXT,
    "attribution" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NearbyPlaceCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NearbyPlaceCache_hotelId_provider_providerPlaceId_key"
ON "NearbyPlaceCache"("hotelId", "provider", "providerPlaceId");

CREATE INDEX "NearbyPlaceCache_hotelId_category_distanceMeters_idx"
ON "NearbyPlaceCache"("hotelId", "category", "distanceMeters");

CREATE INDEX "NearbyPlaceCache_expiresAt_idx"
ON "NearbyPlaceCache"("expiresAt");

ALTER TABLE "NearbyPlaceCache"
ADD CONSTRAINT "NearbyPlaceCache_hotelId_fkey"
FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
