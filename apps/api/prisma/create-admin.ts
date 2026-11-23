/**
 * Crée (ou réinitialise) un compte administrateur avec sa double authentification.
 * Usage (depuis apps/api) : npm run admin:create -- admin@exemple.fr
 *
 * Affiche une seule fois :
 * - un mot de passe généré aléatoirement ;
 * - un QR code à scanner avec une application d'authentification (TOTP).
 * Ni le mot de passe ni le secret TOTP ne sont stockés en clair.
 */
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "@node-rs/argon2";
import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { encrypt } from "../src/common/crypto.js";
import { emailSchema } from "@lafoulee/shared";

const email = emailSchema.parse(process.argv[2]);
const { DATABASE_URL, TOTP_ENC_KEY } = process.env;
if (!DATABASE_URL || !TOTP_ENC_KEY) throw new Error("DATABASE_URL et TOTP_ENC_KEY sont requises");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

async function main() {
  const password = randomBytes(18).toString("base64url");
  const secret = generateSecret();
  const fields = {
    passwordHash: await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
    role: "ADMIN" as const,
    emailVerifiedAt: new Date(),
    totpSecretEnc: encrypt(secret, TOTP_ENC_KEY!),
  };
  await prisma.user.upsert({ where: { email }, update: fields, create: { email, firstName: "Admin", ...fields } });
  // Toute session ouverte avant la réinitialisation est fermée.
  await prisma.refreshToken.updateMany({
    where: { user: { email }, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const uri = generateURI({ issuer: "La Foulée", label: email, secret });
  console.log(`\nCompte administrateur prêt : ${email}`);
  console.log(`Mot de passe (affiché une seule fois) : ${password}\n`);
  console.log("Scannez ce QR code avec votre application d'authentification :\n");
  console.log(await QRCode.toString(uri, { type: "terminal", small: true }));
  console.log(`Ou saisissez ce secret à la main : ${secret}\n`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
