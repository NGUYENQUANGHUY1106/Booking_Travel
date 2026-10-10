CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE "AdministrativeLevel" AS ENUM ('COUNTRY', 'PROVINCE', 'DISTRICT', 'COMMUNE');
CREATE TYPE "AdministrativeCatalogMode" AS ENUM ('CURRENT', 'LEGACY');
CREATE TYPE "AdministrativeUnitStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MERGED', 'DISSOLVED');
CREATE TYPE "AdministrativeUnitType" AS ENUM ('COUNTRY', 'PROVINCE', 'MUNICIPALITY', 'CITY', 'URBAN_DISTRICT', 'RURAL_DISTRICT', 'TOWN', 'WARD', 'COMMUNE', 'TOWNSHIP', 'SPECIAL_ZONE', 'UNKNOWN');
CREATE TYPE "AdministrativeAliasKind" AS ENUM ('FORMER_NAME', 'ALTERNATIVE_NAME', 'SEARCH_NAME');
CREATE TYPE "AdministrativeTransitionType" AS ENUM ('MERGED_INTO', 'SPLIT_INTO', 'RENAMED_TO', 'PARTIALLY_TRANSFERRED_TO');
CREATE TYPE "ImportRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "AddressMode" AS ENUM ('CURRENT', 'LEGACY');

CREATE TABLE "DataSource" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "publisher" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "retrievedAt" TIMESTAMP(3) NOT NULL,
  "effectiveFrom" TIMESTAMP(3),
  "license" TEXT,
  "coverage" TEXT NOT NULL,
  "checksum" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportRun" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "datasetVersion" TEXT NOT NULL,
  "status" "ImportRunStatus" NOT NULL DEFAULT 'RUNNING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "insertedCount" INTEGER NOT NULL DEFAULT 0,
  "updatedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "errorReport" JSONB,
  CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdministrativeUnit" (
  "id" TEXT NOT NULL,
  "officialCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "level" "AdministrativeLevel" NOT NULL,
  "unitType" "AdministrativeUnitType" NOT NULL,
  "catalogMode" "AdministrativeCatalogMode" NOT NULL,
  "status" "AdministrativeUnitStatus" NOT NULL DEFAULT 'ACTIVE',
  "parentId" TEXT,
  "sourceId" TEXT NOT NULL,
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3),
  "legalDocument" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdministrativeUnit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdministrativeUnitAlias" (
  "id" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "kind" "AdministrativeAliasKind" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdministrativeUnitAlias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdministrativeTransition" (
  "id" TEXT NOT NULL,
  "fromUnitId" TEXT NOT NULL,
  "toUnitId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "relationType" "AdministrativeTransitionType" NOT NULL,
  "confidence" DECIMAL(5,4),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdministrativeTransition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Street" (
  "id" TEXT NOT NULL,
  "officialCode" TEXT,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "validFrom" TIMESTAMP(3),
  "validTo" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Street_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StreetAdministrativeUnit" (
  "streetId" TEXT NOT NULL,
  "administrativeUnitId" TEXT NOT NULL,
  CONSTRAINT "StreetAdministrativeUnit_pkey" PRIMARY KEY ("streetId", "administrativeUnitId")
);

CREATE TABLE "SavedAddress" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "label" TEXT,
  "mode" "AddressMode" NOT NULL,
  "countryCode" TEXT NOT NULL DEFAULT 'VN',
  "provinceUnitId" TEXT NOT NULL,
  "districtUnitId" TEXT,
  "communeUnitId" TEXT NOT NULL,
  "streetId" TEXT,
  "streetText" TEXT,
  "addressLine" TEXT NOT NULL,
  "postalCode" TEXT,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "formattedAddress" TEXT NOT NULL,
  "administrativeSnapshot" JSONB NOT NULL,
  "datasetVersion" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SavedAddress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DataSource_key_key" ON "DataSource"("key");
CREATE INDEX "ImportRun_sourceId_datasetVersion_idx" ON "ImportRun"("sourceId", "datasetVersion");
CREATE INDEX "ImportRun_status_startedAt_idx" ON "ImportRun"("status", "startedAt");
CREATE INDEX "AdministrativeUnit_catalogMode_level_status_idx" ON "AdministrativeUnit"("catalogMode", "level", "status");
CREATE INDEX "AdministrativeUnit_parentId_status_idx" ON "AdministrativeUnit"("parentId", "status");
CREATE INDEX "AdministrativeUnit_normalizedName_idx" ON "AdministrativeUnit"("normalizedName");
CREATE INDEX "AdministrativeUnit_officialCode_idx" ON "AdministrativeUnit"("officialCode");
CREATE UNIQUE INDEX "AdministrativeUnit_officialCode_catalogMode_validFrom_key" ON "AdministrativeUnit"("officialCode", "catalogMode", "validFrom");
CREATE INDEX "AdministrativeUnitAlias_normalizedName_idx" ON "AdministrativeUnitAlias"("normalizedName");
CREATE UNIQUE INDEX "AdministrativeUnitAlias_unitId_normalizedName_kind_key" ON "AdministrativeUnitAlias"("unitId", "normalizedName", "kind");
CREATE INDEX "AdministrativeTransition_fromUnitId_idx" ON "AdministrativeTransition"("fromUnitId");
CREATE INDEX "AdministrativeTransition_toUnitId_idx" ON "AdministrativeTransition"("toUnitId");
CREATE UNIQUE INDEX "AdministrativeTransition_fromUnitId_toUnitId_relationType_key" ON "AdministrativeTransition"("fromUnitId", "toUnitId", "relationType");
CREATE INDEX "Street_normalizedName_idx" ON "Street"("normalizedName");
CREATE INDEX "Street_officialCode_idx" ON "Street"("officialCode");
CREATE INDEX "StreetAdministrativeUnit_administrativeUnitId_idx" ON "StreetAdministrativeUnit"("administrativeUnitId");
CREATE INDEX "SavedAddress_ownerId_deletedAt_idx" ON "SavedAddress"("ownerId", "deletedAt");
CREATE INDEX "SavedAddress_ownerId_isDefault_deletedAt_idx" ON "SavedAddress"("ownerId", "isDefault", "deletedAt");
CREATE INDEX "SavedAddress_provinceUnitId_idx" ON "SavedAddress"("provinceUnitId");
CREATE INDEX "SavedAddress_districtUnitId_idx" ON "SavedAddress"("districtUnitId");
CREATE INDEX "SavedAddress_communeUnitId_idx" ON "SavedAddress"("communeUnitId");
CREATE INDEX "AdministrativeUnit_normalizedName_trgm_idx" ON "AdministrativeUnit" USING GIN ("normalizedName" gin_trgm_ops);
CREATE INDEX "AdministrativeUnitAlias_normalizedName_trgm_idx" ON "AdministrativeUnitAlias" USING GIN ("normalizedName" gin_trgm_ops);
CREATE INDEX "Street_normalizedName_trgm_idx" ON "Street" USING GIN ("normalizedName" gin_trgm_ops);
CREATE UNIQUE INDEX "SavedAddress_one_default_per_owner" ON "SavedAddress"("ownerId") WHERE "isDefault" = true AND "deletedAt" IS NULL;

ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdministrativeUnit" ADD CONSTRAINT "AdministrativeUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AdministrativeUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdministrativeUnit" ADD CONSTRAINT "AdministrativeUnit_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdministrativeUnitAlias" ADD CONSTRAINT "AdministrativeUnitAlias_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "AdministrativeUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdministrativeUnitAlias" ADD CONSTRAINT "AdministrativeUnitAlias_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdministrativeTransition" ADD CONSTRAINT "AdministrativeTransition_fromUnitId_fkey" FOREIGN KEY ("fromUnitId") REFERENCES "AdministrativeUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdministrativeTransition" ADD CONSTRAINT "AdministrativeTransition_toUnitId_fkey" FOREIGN KEY ("toUnitId") REFERENCES "AdministrativeUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdministrativeTransition" ADD CONSTRAINT "AdministrativeTransition_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Street" ADD CONSTRAINT "Street_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StreetAdministrativeUnit" ADD CONSTRAINT "StreetAdministrativeUnit_streetId_fkey" FOREIGN KEY ("streetId") REFERENCES "Street"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StreetAdministrativeUnit" ADD CONSTRAINT "StreetAdministrativeUnit_administrativeUnitId_fkey" FOREIGN KEY ("administrativeUnitId") REFERENCES "AdministrativeUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedAddress" ADD CONSTRAINT "SavedAddress_provinceUnitId_fkey" FOREIGN KEY ("provinceUnitId") REFERENCES "AdministrativeUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SavedAddress" ADD CONSTRAINT "SavedAddress_districtUnitId_fkey" FOREIGN KEY ("districtUnitId") REFERENCES "AdministrativeUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SavedAddress" ADD CONSTRAINT "SavedAddress_communeUnitId_fkey" FOREIGN KEY ("communeUnitId") REFERENCES "AdministrativeUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SavedAddress" ADD CONSTRAINT "SavedAddress_streetId_fkey" FOREIGN KEY ("streetId") REFERENCES "Street"("id") ON DELETE SET NULL ON UPDATE CASCADE;
