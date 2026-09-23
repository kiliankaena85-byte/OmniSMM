import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), '.next', 'required-server-files.json');
if (fs.existsSync(file)) {
  const content = fs.readFileSync(file, 'utf-8');
  console.log('Original cacheHandler line:', content.split('\n').find(l => l.includes('cacheHandler')));
  const fixed = content.replace(/\\\\/g, '/');
  console.log('Fixed cacheHandler line:', fixed.split('\n').find(l => l.includes('cacheHandler')));
} else {
  console.log('File not found');
}
