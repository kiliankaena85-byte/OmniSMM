const fs = require('fs');
const path = require('path');

function scanPublicHtmlFiles() {
  const publicDir = path.join(__dirname, '../public');
  if (!fs.existsSync(publicDir)) return [];
  
  const files = fs.readdirSync(publicDir);
  return files.filter(f => f.endsWith('.html')).map(f => path.join(publicDir, f));
}

console.log('Prototypes in public/:', scanPublicHtmlFiles());
