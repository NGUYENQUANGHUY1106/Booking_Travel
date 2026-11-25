ALTER TABLE "OwnerPromotion" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'OWNER';
ALTER TABLE "OwnerPromotion" ADD CONSTRAINT "OwnerPromotion_source_check" CHECK ("source" = 'OWNER');
