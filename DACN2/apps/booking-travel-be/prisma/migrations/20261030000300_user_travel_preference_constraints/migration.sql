ALTER TABLE "UserPreference"
ALTER COLUMN "accommodationTypes" SET NOT NULL,
ALTER COLUMN "tripTypes" SET NOT NULL,
ALTER COLUMN "preferredAmenities" SET NOT NULL,
ALTER COLUMN "preferredAreas" SET NOT NULL;

ALTER TABLE "UserPreference"
ADD CONSTRAINT "UserPreference_budgetMin_check" CHECK ("budgetMin" IS NULL OR "budgetMin" >= 0),
ADD CONSTRAINT "UserPreference_budgetMax_check" CHECK ("budgetMax" IS NULL OR "budgetMax" >= 0),
ADD CONSTRAINT "UserPreference_budgetRange_check" CHECK ("budgetMin" IS NULL OR "budgetMax" IS NULL OR "budgetMin" <= "budgetMax"),
ADD CONSTRAINT "UserPreference_currency_check" CHECK ("currency" = 'VND');
