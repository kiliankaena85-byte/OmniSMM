const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  const r = await p.systemSettings.updateMany({
    data: { siteName: "SMMplan", legalCompanyName: "SMMplan" },
  });
  console.log("Updated settings rows:", r.count);
}

main()
  .catch((e) => console.error(e))
  .finally(() => p.$disconnect());
