import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findAnomalies() {
  const services = await prisma.service.findMany({
    include: { category: true }
  });

  console.log(`Analyzing ${services.length} services for anomalies...`);

  const anomalies = [];

  for (const s of services) {
    const catName = s.category?.name || 'NO_CATEGORY';
    const nameLower = s.name.toLowerCase();
    
    // 1. Emojis in description but not in Reactions category
    const hasEmojis = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu.test(s.description || '') || /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu.test(s.name);
    if (hasEmojis && !catName.toLowerCase().includes('реакц') && !catName.toLowerCase().includes('эмодзи')) {
      anomalies.push({ id: s.numericId, issue: 'Has Emojis but not Reactions category', name: s.name, cat: catName });
    }

    // 2. Name suggests Subscribers but category is different
    if (nameLower.includes('подписчик') || nameLower.includes('участник')) {
      if (!catName.toLowerCase().includes('подписчик') && !catName.toLowerCase().includes('групп')) {
        anomalies.push({ id: s.numericId, issue: 'Name says Subscribers but Category is different', name: s.name, cat: catName });
      }
    }

    // 3. Name suggests Likes but category is different
    if (nameLower.includes('лайк') && !nameLower.includes('дизлайк') && !nameLower.includes('автолайк')) {
      if (!catName.toLowerCase().includes('лайк')) {
        anomalies.push({ id: s.numericId, issue: 'Name says Likes but Category is different', name: s.name, cat: catName });
      }
    }

    // 4. Short name
    if (s.name.length < 5) {
      anomalies.push({ id: s.numericId, issue: 'Name too short', name: s.name, cat: catName });
    }
    
    // 5. Name ends with colon or strange characters
    if (s.name.trim().endsWith(':')) {
      anomalies.push({ id: s.numericId, issue: 'Name ends with colon', name: s.name, cat: catName });
    }

    // 6. TargetType mismatch with category
    // Just some basic checks
    if (catName.toLowerCase().includes('подписчик') && s.targetType === 'POST') {
       anomalies.push({ id: s.numericId, issue: 'Category Subscribers but targetType POST', name: s.name, cat: catName });
    }
  }

  // Group by issue
  const grouped = anomalies.reduce((acc, curr) => {
    acc[curr.issue] = acc[curr.issue] || [];
    acc[curr.issue].push(curr);
    return acc;
  }, {} as Record<string, any[]>);

  for (const [issue, items] of Object.entries(grouped)) {
    console.log(`\n--- Issue: ${issue} (${items.length} services) ---`);
    for (const item of items.slice(0, 5)) { // show up to 5 examples
      console.log(`ID: ${item.id} | Name: "${item.name}" | Cat: "${item.cat}"`);
    }
    if (items.length > 5) {
      console.log(`... and ${items.length - 5} more.`);
    }
  }
}

findAnomalies().catch(console.error).finally(() => prisma.$disconnect());
