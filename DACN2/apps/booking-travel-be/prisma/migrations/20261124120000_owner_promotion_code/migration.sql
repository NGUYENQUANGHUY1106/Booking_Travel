ALTER TABLE "OwnerPromotion" ADD COLUMN "code" VARCHAR(64);
UPDATE "OwnerPromotion" SET "code" = 'OWN-' || UPPER("id");
ALTER TABLE "OwnerPromotion" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "OwnerPromotion_code_key" ON "OwnerPromotion"("code");
