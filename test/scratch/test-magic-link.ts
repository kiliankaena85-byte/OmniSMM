import { requestMagicLink } from './src/actions/auth/request-magic-link';

async function run() {
  const formData = new FormData();
  formData.append('email', 'test@example.com');
  
  const res = await requestMagicLink(null, formData);
  console.log('Result:', res);
}

run().catch(console.error);
