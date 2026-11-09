ALTER TABLE "HotelRestrictionAudit" ADD COLUMN "actorRole" "UserRole" NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "HotelRestrictionAudit" ALTER COLUMN "actorRole" DROP DEFAULT;
