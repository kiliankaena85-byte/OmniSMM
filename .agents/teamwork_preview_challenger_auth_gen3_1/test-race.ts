import { requestMagicLink } from '../../src/actions/auth/request-magic-link';

async function main() {
  console.log("Starting race condition test...");
  
  const email = `race-${Date.now()}@test.com`;
  
  const promises = [];
  for (let i = 0; i < 5; i++) {
    const formData = new FormData();
    formData.append('email', email);
    promises.push(requestMagicLink(null, formData));
  }
  
  try {
    const results = await Promise.allSettled(promises);
    console.log(results);
  } catch (e) {
    console.error(e);
  }
}

main();
