ALTER TABLE "Message" ADD COLUMN "readAt" TIMESTAMP(3);

CREATE INDEX "Message_conversationId_readAt_idx"
ON "Message"("conversationId", "readAt");
