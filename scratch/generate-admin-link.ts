import { db } from "../src/lib/db";
import crypto from "crypto";

async function main() {
  const email = "art@artmspektr.ru";
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.error("User not found!");
    return;
  }
  
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  
  await db.authToken.deleteMany({ where: { userId: user.id } });
  await db.authToken.create({
    data: {
      userId: user.id,
      token: hashedToken,
      expiresAt,
    },
  });
  
  console.log(`\nMAGIC LINK FOR ${email}:`);
  console.log(`http://localhost:3000/api/auth/verify?token=${rawToken}\n`);
}

main().catch(console.error);
