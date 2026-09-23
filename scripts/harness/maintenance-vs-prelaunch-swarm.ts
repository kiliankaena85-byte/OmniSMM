import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();
fs.writeFileSync('scripts/harness/swarm-test.json', JSON.stringify({ status: 'OK' }), 'utf-8');
console.log('Swarm test prepared');
