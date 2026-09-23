import { parseArgs } from "util";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Error: Running this script in production is strictly forbidden.");
    process.exitCode = 1;
    return;
  }

  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      email: {
        type: "string",
      },
      password: {
        type: "string",
      },
    },
    allowPositionals: true,
  });

  const email = values.email || positionals[0];
  const password = values.password || positionals[1];

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/set-admin-password.ts --email <email> --password <password>");
    process.exitCode = 1; return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      console.error(`User with email ${email} not found.`);
      process.exitCode = 1; return;
    }

    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      console.warn(`Warning: User ${email} is not an OWNER or ADMIN. Updating password anyway.`);
    }

    const passwordHash = await hashPassword(password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.session.deleteMany({ where: { userId: user.id } }),
      prisma.authToken.deleteMany({ where: { userId: user.id } }),
    ]);

    console.log(`Successfully updated password for user ${email}.`);
  } catch (error) {
    console.error("Error updating password:", error);
    process.exitCode = 1; return;
  } finally {
    await prisma.$disconnect();
  }
}

main();
