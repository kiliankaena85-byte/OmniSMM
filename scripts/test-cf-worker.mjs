const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '5914b5f5d96041994b68108a8b1df1bd';
const SCRIPT_NAME = 'depin';

async function test() {
  const formData = new FormData();
  const meta = {
    main_module: 'worker.js',
    compatibility_date: '2024-09-23',
    compatibility_flags: ['nodejs_compat']
  };
  formData.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }), 'metadata.json');
  formData.append('worker.js', new Blob(['export default { fetch(req) { return new Response("DePIN TMA Cloudflare Gateway Active!"); } };'], { type: 'application/javascript+module' }), 'worker.js');

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${CF_TOKEN}` },
    body: formData
  });
  const json = await res.json();
  console.log('Upload Result:', JSON.stringify(json, null, 2));

  // Enable subdomain route
  const subRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}/subdomain`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true })
  });
  const subJson = await subRes.json();
  console.log('Subdomain Result:', JSON.stringify(subJson, null, 2));
}

test().catch(console.error);
