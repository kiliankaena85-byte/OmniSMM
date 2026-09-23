import { verifySession } from './src/lib/session';
import 'dotenv/config';

async function test() {
  console.log("DEV_AUTO_LOGIN:", process.env.DEV_AUTO_LOGIN);
  console.log("DEV_BYPASS_EMAIL:", process.env.DEV_BYPASS_EMAIL);
  const result = await verifySession();
  console.log("Result:", result);
}
test().catch(console.error);
