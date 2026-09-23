import { db } from '../src/lib/db';

async function main() {
  const userId = "cmr5t0aig000aaoz13bjytiyr";
  const user = await db.user.findUnique({
    where: { id: userId }
  });
  
  if (user) {
    console.log(`SUCCESS! User email: ${user.email}`);
    console.log(`Balance (raw value from DB):`, user.balance.toString());
    const balanceNum = typeof user.balance === 'bigint' ? Number(user.balance) : user.balance;
    console.log(`Balance in RUB:`, balanceNum / 100);
  } else {
    console.log("User not found!");
  }
}

main().catch(console.error);
