CREATE TYPE "HotelMediaStatus" AS ENUM ('RESERVED', 'READY');

ALTER TABLE "Hotel"
  ADD COLUMN "district" TEXT,
  ADD COLUMN "ward" TEXT,
  ADD COLUMN "provinceUnitId" TEXT,
  ADD COLUMN "districtUnitId" TEXT,
  ADD COLUMN "wardUnitId" TEXT;

CREATE TABLE "HotelMedia" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "expectedSize" INTEGER NOT NULL,
  "status" "HotelMediaStatus" NOT NULL DEFAULT 'RESERVED',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isCover" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "HotelMedia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HotelMedia_objectKey_key" ON "HotelMedia"("objectKey");
CREATE INDEX "HotelMedia_hotelId_status_sortOrder_idx" ON "HotelMedia"("hotelId", "status", "sortOrder");
CREATE INDEX "HotelMedia_ownerId_createdAt_idx" ON "HotelMedia"("ownerId", "createdAt");
CREATE UNIQUE INDEX "HotelMedia_one_cover_per_hotel" ON "HotelMedia"("hotelId") WHERE "isCover" = true AND "deletedAt" IS NULL AND "status" = 'READY';
ALTER TABLE "HotelMedia" ADD CONSTRAINT "HotelMedia_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AmenityCatalog" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "AmenityCatalog_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HotelAmenity" (
  "hotelId" TEXT NOT NULL,
  "amenityId" TEXT NOT NULL,
  CONSTRAINT "HotelAmenity_pkey" PRIMARY KEY ("hotelId", "amenityId")
);
ALTER TABLE "HotelAmenity" ADD CONSTRAINT "HotelAmenity_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelAmenity" ADD CONSTRAINT "HotelAmenity_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "AmenityCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "AmenityCatalog" ("id", "name") VALUES
  ('WIFI', 'Wi-Fi'),
  ('POOL', 'Hồ bơi'),
  ('BREAKFAST', 'Bữa sáng'),
  ('PARKING', 'Bãi đỗ xe'),
  ('AIR_CONDITIONING', 'Điều hòa'),
  ('RESTAURANT', 'Nhà hàng');

CREATE TABLE "HotelSubmission" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HotelSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HotelSubmission_hotelId_version_key" ON "HotelSubmission"("hotelId", "version");
CREATE INDEX "HotelSubmission_ownerId_submittedAt_idx" ON "HotelSubmission"("ownerId", "submittedAt");
ALTER TABLE "HotelSubmission" ADD CONSTRAINT "HotelSubmission_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
