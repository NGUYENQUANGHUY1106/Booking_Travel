CREATE TYPE "UserGender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

ALTER TABLE "User"
ADD COLUMN "avatarUrl" TEXT,
ADD COLUMN "dateOfBirth" DATE,
ADD COLUMN "gender" "UserGender",
ADD COLUMN "nationality" TEXT,
ADD COLUMN "address" TEXT;
