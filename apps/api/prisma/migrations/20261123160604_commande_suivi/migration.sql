/*
  Warnings:

  - Added the required column `access_token_hash` to the `orders` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "access_token_hash" TEXT NOT NULL,
ADD COLUMN     "confirmation_sent_at" TIMESTAMPTZ;
