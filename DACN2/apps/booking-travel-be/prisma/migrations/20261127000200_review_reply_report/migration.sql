CREATE TABLE "ReviewReplyReport" (
  "id" TEXT NOT NULL, "replyId" TEXT NOT NULL, "reporterId" TEXT NOT NULL,
  "reason" VARCHAR(500) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewReplyReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReviewReplyReport_replyId_reporterId_key" ON "ReviewReplyReport"("replyId", "reporterId");
CREATE INDEX "ReviewReplyReport_createdAt_idx" ON "ReviewReplyReport"("createdAt");
ALTER TABLE "ReviewReplyReport" ADD CONSTRAINT "ReviewReplyReport_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "ReviewReply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewReplyReport" ADD CONSTRAINT "ReviewReplyReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
