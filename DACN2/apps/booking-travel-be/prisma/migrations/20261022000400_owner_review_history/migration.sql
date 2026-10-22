ALTER TABLE "HotelOwnerApplication" ADD COLUMN "reviewHistory" JSONB NOT NULL DEFAULT '[]'::jsonb;
