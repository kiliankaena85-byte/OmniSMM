/**
 * Attach custom domain ru.smmplan.pro to Cloudflare Worker
 */

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || '';
const SCRIPT_NAME = 'smmplan-russia-gateway';
const CUSTOM_HOSTNAME = 'ru.smmplan.pro';

async function main() {
  console.log(`Binding custom domain: ${CUSTOM_HOSTNAME} to Worker ${SCRIPT_NAME}...`);

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/domains`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      environment: 'production',
      hostname: CUSTOM_HOSTNAME,
      service: SCRIPT_NAME,
      zone_id: ZONE_ID,
    }),
  });

  const data = await res.json() as { success: boolean; result: any; errors: any[] };
  console.log('Custom Domain Result:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
