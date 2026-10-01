const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  await p.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: 'cmuow3vf8000513thl580rm5s' },
      data: { status: 'SUCCEEDED' }
    });
    await tx.order.update({
      where: { id: 'cmuow3ver000313thudslzgz1' },
      data: { status: 'PENDING' }
    });
  });
  console.log('SUCCESSFULLY CONFIRMED ORDER & PAYMENT IN DB');
}

main().catch(console.error).finally(() => p.$disconnect());
