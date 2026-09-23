import * as fs from 'fs';
import * as readline from 'readline';

async function main() {
  const filePath = 'C:\\Users\\Артём\\Desktop\\active_services_export.csv';
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  console.log('=== LIKEE SERVICES IN CSV ===');
  for await (const line of rl) {
    if (line.includes(',Likee,') || line.includes(',Одноклассники,') || line.includes(',Вконтакте,') || line.includes(',YouTube,')) {
      console.log(line);
    }
  }
}

main();
