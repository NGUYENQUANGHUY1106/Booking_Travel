CREATE TABLE "ReviewActionAudit" (
  "id" TEXT NOT NULL, "reviewId" TEXT NOT NULL, "actorId" TEXT NOT NULL,
  "action" VARCHAR(32) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewActionAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReviewActionAudit_reviewId_createdAt_idx" ON "ReviewActionAudit"("reviewId", "createdAt");
ALTER TABLE "ReviewActionAudit" ADD CONSTRAINT "ReviewActionAudit_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewActionAudit" ADD CONSTRAINT "ReviewActionAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
