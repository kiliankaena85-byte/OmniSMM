const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts') || file.endsWith('.js')) results.push(file);
    }
  });
  return results;
}

const files = walk('e2e');
let changedFiles = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const oldContent = content;
  content = content.replace(/where:\s*{\s*email:\s*([^,}]+)\s*}/g, "where: { email_tenantId: { email: $1, tenantId: 'smmplan' } }");
  if (oldContent !== content) {
    fs.writeFileSync(file, content, 'utf8');
    changedFiles++;
    console.log(`Updated ${file}`);
  }
});

console.log('Replaced in ' + changedFiles + ' files.');
