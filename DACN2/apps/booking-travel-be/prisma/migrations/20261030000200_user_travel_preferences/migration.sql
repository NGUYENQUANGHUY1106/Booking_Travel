CREATE TYPE "AccommodationPreferenceType" AS ENUM ('HOTEL', 'RESORT', 'VILLA', 'APARTMENT', 'HOMESTAY', 'HOSTEL');
CREATE TYPE "TravelTripType" AS ENUM ('SOLO', 'COUPLE', 'FAMILY', 'FRIENDS', 'BUSINESS', 'WELLNESS');
CREATE TYPE "TravelAmenityPreference" AS ENUM ('WIFI', 'BREAKFAST', 'POOL', 'PARKING', 'SPA', 'GYM', 'BEACH', 'AIRPORT_SHUTTLE', 'PET_FRIENDLY', 'FAMILY_ROOM');
CREATE TYPE "TravelAreaPreference" AS ENUM ('BEACHFRONT', 'CITY_CENTER', 'QUIET', 'NEAR_AIRPORT', 'NEAR_ATTRACTIONS', 'NIGHTLIFE', 'LOCAL_CULTURE', 'NATURE');

CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "accommodationTypes" "AccommodationPreferenceType"[] DEFAULT ARRAY[]::"AccommodationPreferenceType"[],
    "tripTypes" "TravelTripType"[] DEFAULT ARRAY[]::"TravelTripType"[],
    "preferredAmenities" "TravelAmenityPreference"[] DEFAULT ARRAY[]::"TravelAmenityPreference"[],
    "preferredAreas" "TravelAreaPreference"[] DEFAULT ARRAY[]::"TravelAreaPreference"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");
CREATE INDEX "UserPreference_updatedAt_idx" ON "UserPreference"("updatedAt");

ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
