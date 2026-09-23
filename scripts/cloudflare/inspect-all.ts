const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || 'b67ab9748fc5f42587bc0d455faf0fdd';

async function cfGet(path: string) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  return await res.json() as any;
}

async function run() {
  console.log('--- CLOUDFLARE DNS RECORDS ---');
  const dns = await cfGet(`/zones/${ZONE_ID}/dns_records`);
  if (dns.result) {
    for (const r of dns.result) {
      console.log(`[${r.type}] ${r.name} -> ${r.content} (proxied: ${r.proxied})`);
    }
  } else {
    console.log('DNS query error:', dns.errors);
  }

  console.log('\n--- CLOUDFLARE PAGE RULES ---');
  const pr = await cfGet(`/zones/${ZONE_ID}/pagerules`);
  if (pr.result) {
    for (const r of pr.result) {
      console.log(`Rule #${r.priority} (${r.status}): ${r.targets?.[0]?.constraint?.value} -> ${r.actions?.[0]?.value?.url}`);
    }
  } else {
    console.log('Page rules error:', pr.errors);
  }

  console.log('\n--- CLOUDFLARE REDIRECT RULES (Rulesets) ---');
  const rulesets = await cfGet(`/zones/${ZONE_ID}/rulesets`);
  if (rulesets.result) {
    for (const rs of rulesets.result) {
      console.log(`Ruleset: ${rs.name} (${rs.phase})`);
      const rulesetDetail = await cfGet(`/zones/${ZONE_ID}/rulesets/${rs.id}`);
      if (rulesetDetail.result?.rules) {
        for (const rule of rulesetDetail.result.rules) {
          console.log(`  Rule: ${rule.description} | ${rule.expression} -> ${JSON.stringify(rule.action_parameters || rule.action)}`);
        }
      }
    }
  }
}

run().catch(console.error);
