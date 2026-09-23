/**
 * Test what Cloudflare origin fetch does
 */
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || 'b67ab9748fc5f42587bc0d455faf0fdd';

async function main() {
  // Check SSL/TLS encryption mode in Cloudflare
  const sslRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/settings/ssl`, {
    headers: { 'Authorization': `Bearer ${API_TOKEN}` }
  });
  const ssl = await sslRes.json() as any;
  console.log('SSL mode:', ssl.result);

  // Check Origin Rules
  const originRules = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets/phases/http_request_origin/entrypoint`, {
    headers: { 'Authorization': `Bearer ${API_TOKEN}` }
  });
  const origin = await originRules.json() as any;
  console.log('Origin rules:', origin);
}

main().catch(console.error);
