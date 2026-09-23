import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const provider = await prisma.provider.findUnique({ where: { id: 'cmp9nffg50000objamyycgytu' } });
    if (!provider) return console.log("Provider not found");

    console.log(`Fetching from ${provider.apiUrl}...`);
    const res = await fetch(provider.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ key: provider.apiKey, action: 'services' })
    });
    const services = await res.json();
    console.log(`Fetched ${services.length} services from Vexboost`);
    
    // Check categories
    const cats = new Set();
    for (const s of services) {
        cats.add(s.category);
    }
    console.log(`Unique categories: ${cats.size}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
