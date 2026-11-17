CREATE TABLE "Landmark" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "addressLine" TEXT,
    "city" TEXT,
    "province" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "location" geography(Point,4326) GENERATED ALWAYS AS (
      ST_SetSRID(ST_MakePoint("longitude"::double precision, "latitude"::double precision), 4326)::geography
    ) STORED,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Landmark_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Landmark_normalizedName_key" ON "Landmark"("normalizedName");
CREATE INDEX "Landmark_city_isActive_idx" ON "Landmark"("city", "isActive");
CREATE INDEX "Landmark_location_gist_idx" ON "Landmark" USING GIST ("location");
