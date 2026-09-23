import { db } from '../src/lib/db';

async function checkTickets() {
  const tickets = await db.ticket.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      user: { select: { email: true } },
      messages: { take: 2, orderBy: { createdAt: 'asc' } }
    }
  });

  console.log(`Всего тикетов в БД: ${tickets.length}`);
  for (const t of tickets) {
    console.log(`[${t.id}] #${t.numericId || t.id.slice(0, 8)} | User: ${t.user?.email} | Subject: ${t.subject} | Status: ${t.status} | Source: ${t.source || 'WEB'}`);
    for (const m of t.messages) {
      console.log(`   -> [${m.sender}] ${m.text.slice(0, 80)}...`);
    }
  }
}

checkTickets().catch(console.error).finally(() => process.exit(0));
