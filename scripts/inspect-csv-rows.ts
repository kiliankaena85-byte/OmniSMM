import * as fs from 'fs';
import * as readline from 'readline';

async function main() {
  const filePath = 'C:\\Users\\Артём\\Desktop\\active_services_export.csv';
  if (!fs.existsSync(filePath)) {
    console.log('File not found:', filePath);
    return;
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let count = 0;
  for await (const line of rl) {
    console.log(`[Row ${count}]: ${line}`);
    count++;
    if (count > 25) break;
  }
}

main();
