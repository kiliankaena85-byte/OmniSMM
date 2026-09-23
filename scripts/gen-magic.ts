import { db } from "../src/lib/db";
import crypto from "crypto";

async function main() {
  let user = await db.user.findFirst({ where: { tenantId: "lovable" } });
  if (!user) {
    user = await db.user.create({
      data: {
        email: "demo@smmflux.com",
        role: "USER",
        tenantId: "lovable",
      },
    });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.authToken.create({
    data: {
      userId: user.id,
      token: hashedToken,
      expiresAt,
    },
  });

  console.log("----------------------------------------");
  console.log("EMAIL:", user.email);
  console.log("MAGIC_LINK:", `http://localhost:3000/api/auth/verify?token=${rawToken}`);
  console.log("----------------------------------------");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
