/**
 * Try configuring Cloudflare Redirect Rules via modern Rulesets API
 */

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || 'b67ab9748fc5f42587bc0d455faf0fdd';

async function main() {
  console.log('Testing Rulesets API for Redirect Rules...');

  const body = {
    rules: [
      {
        description: 'Redirect smmplan.pro to Tailscale Funnel',
        expression: '(http.host eq "smmplan.pro" or http.host eq "www.smmplan.pro" or http.host eq "test.smmplan.pro")',
        action: 'redirect',
        action_parameters: {
          from_value: {
            status_code: 302,
            target_url: {
              value: 'https://desktop-25m6el7.tailbb9d28.ts.net',
            },
            preserve_query_string: true,
          },
        },
        enabled: true,
      },
    ],
  };

  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/rulesets/phases/http_request_dynamic_redirect/entrypoint`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as { success: boolean; result?: any; errors?: any[] };
  console.log('Ruleset API Response:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
