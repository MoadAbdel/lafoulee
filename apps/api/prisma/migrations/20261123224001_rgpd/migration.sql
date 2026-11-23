-- AlterTable
ALTER TABLE "email_tokens" ADD COLUMN     "metadata" JSONB;

-- CreateTable
CREATE TABLE "consent_logs" (
    "id" UUID NOT NULL,
    "consent_id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "choices" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_logs_consent_id_idx" ON "consent_logs"("consent_id");

-- CreateIndex
CREATE INDEX "consent_logs_created_at_idx" ON "consent_logs"("created_at");

-- CreateIndex
CREATE INDEX "email_tokens_expires_at_idx" ON "email_tokens"("expires_at");
