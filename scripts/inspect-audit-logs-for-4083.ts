import { db } from '../src/lib/db';

async function main() {
  console.log('Inspecting AuditLogs for service...');
  const logs = await db.auditLog.findMany({
    where: {
      OR: [
        { details: { contains: '4083' } },
        { details: { contains: 'cmqo62poy000euhtshmyrvtbp' } }
      ]
    },
    take: 10
  });
  console.log('AuditLog matches:', JSON.stringify(logs, null, 2));

  const adminLogs = await db.adminAuditLog.findMany({
    where: {
      OR: [
        { target: 'cmqo62poy000euhtshmyrvtbp' },
        { oldValue: { contains: 'cmqo62poy000euhtshmyrvtbp' } },
        { newValue: { contains: 'cmqo62poy000euhtshmyrvtbp' } },
        { oldValue: { contains: '4083' } },
        { newValue: { contains: '4083' } }
      ]
    },
    take: 10
  });
  console.log('AdminAuditLog matches:', JSON.stringify(adminLogs, null, 2));
}

main().finally(async () => {
  await db.$disconnect();
});
