import * as dotenv from 'dotenv';
dotenv.config();
import { db } from '@/lib/db';

async function main() {
  console.log('=== INSPECTING RAW IMPORTED SERVICES ===\n');

  const networks = ['likee', 'rutube', 'ok', 'twitch', 'twitter', 'facebook', 'dzen', 'max'];
  for (const slug of networks) {
    const net = await db.network.findFirst({
      where: { slug },
      include: {
        categories: {
          include: {
            services: true
          }
        }
      }
    });

    if (!net) continue;
    console.log(`\n🌐 Network: ${net.name} (${net.slug})`);
    for (const cat of net.categories) {
      console.log(`  📁 Category: "${cat.name}" (${cat.id}) - ${cat.services.length} services`);
      for (const s of cat.services) {
        console.log(`    - [${s.id}] name: "${s.name}", description: "${s.description}", providerServiceId: ${s.providerServiceId}`);
      }
    }
  }
}

main().then(() => process.exit(0)).catch(err => { console.error('FATAL:', err); process.exit(1); });
