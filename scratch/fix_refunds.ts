import { db } from '../src/lib/db';

async function main() {
  console.log('Starting ledger fix...');
  const updated = await db.ledgerEntry.updateMany({
    where: {
      transactionType: 'PAYMENT',
      amount: { gt: 0 },
      OR: [
        { reason: { contains: 'возврат' } },
        { reason: { contains: 'Отмена' } },
        { reason: { contains: 'Возврат' } },
        { reason: { contains: 'отмен' } },
      ]
    },
    data: {
      transactionType: 'REFUND'
    }
  });
  console.log(`Updated ${updated.count} ledger entries to REFUND`);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
