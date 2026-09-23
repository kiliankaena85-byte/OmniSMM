/**
 * Rotate Cloudflare DNS proxy to force assignment of an alternate IP pool
 */

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || 'b67ab9748fc5f42587bc0d455faf0fdd';

async function main() {
  console.log('1. Fetching current DNS records for test.smmplan.pro...');
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?name=test.smmplan.pro`, {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json() as { success: boolean; result: any[] };
  if (!data.success || data.result.length === 0) {
    console.error('Record not found:', data);
    return;
  }

  const record = data.result[0];
  console.log(`Current record: ${record.id} (${record.name} -> ${record.content}) [proxied: ${record.proxied}]`);

  // Toggle proxy off
  console.log('\n2. Toggling proxy OFF...');
  const offRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${record.id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ proxied: false }),
  });
  console.log('Proxy OFF result:', (await offRes.json()).success ? '✅ Success' : '❌ Failed');

  // Wait 2 seconds
  await new Promise(r => setTimeout(r, 2000));

  // Toggle proxy back ON to get fresh IP pool assignment
  console.log('\n3. Toggling proxy back ON (forcing IP pool re-allocation)...');
  const onRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${record.id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ proxied: true }),
  });
  console.log('Proxy ON result:', (await onRes.json()).success ? '✅ Success' : '❌ Failed');

  // Query fresh DNS IPs
  await new Promise(r => setTimeout(r, 3000));
  const dnsRes = await fetch('https://cloudflare-dns.com/dns-query?name=test.smmplan.pro&type=A', {
    headers: { 'accept': 'application/dns-json' },
  });
  const dnsJson = await dnsRes.json();
  console.log('\n4. Freshly allocated IPs for test.smmplan.pro:');
  console.log(dnsJson.Answer);
}

main().catch(console.error);
