-- Preuve de l'acceptation des CGU (inscription) et des CGV (commande). Colonnes facultatives : migration additive.
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" TIMESTAMPTZ, ADD COLUMN "terms_version" TEXT;
ALTER TABLE "orders" ADD COLUMN "cgv_accepted_at" TIMESTAMPTZ, ADD COLUMN "cgv_version" TEXT;
