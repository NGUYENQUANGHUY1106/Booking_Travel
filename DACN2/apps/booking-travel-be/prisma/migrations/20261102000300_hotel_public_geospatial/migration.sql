CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE "Hotel"
  ADD COLUMN "isVisible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "location" geography(Point,4326) GENERATED ALWAYS AS (
    CASE
      WHEN "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180
      THEN ST_SetSRID(ST_MakePoint("longitude"::double precision, "latitude"::double precision), 4326)::geography
      ELSE NULL
    END
  ) STORED;

CREATE INDEX "Hotel_location_gist_idx" ON "Hotel" USING GIST ("location") WHERE "deletedAt" IS NULL AND "status" = 'APPROVED' AND "isVisible" = true;
CREATE INDEX "Hotel_public_visibility_idx" ON "Hotel" ("status", "isVisible", "deletedAt");
CREATE INDEX "HotelAmenity_amenityId_hotelId_idx" ON "HotelAmenity" ("amenityId", "hotelId");
