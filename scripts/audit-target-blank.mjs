import fs from 'fs';
import path from 'path';

function walk(dir) {
  const files = fs.readdirSync(dir);
  let res = [];
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) res.push(...walk(full));
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) res.push(full);
  }
  return res;
}

const all = walk('src');
let count = 0;
const affectedFiles = new Set();

for (const file of all) {
  let content = fs.readFileSync(file, 'utf-8');
  let fileChanged = false;
  
  // Replace <a ... target="_blank" ...> or <Link ... target="_blank" ...>
  // that do not have rel=
  const tagRegex = /(<(?:a|Link)\b)([^>]*\btarget=["']_blank["'][^>]*>)/gi;
  const newContent = content.replace(tagRegex, (match, prefix, rest) => {
    if (!rest.includes('rel=') || !rest.includes('noopener')) {
      count++;
      affectedFiles.add(file);
      fileChanged = true;
      if (rest.includes('rel=')) {
        // Replace existing rel attribute to include noopener noreferrer
        return `${prefix}${rest.replace(/rel=["'][^"']*["']/i, 'rel="noopener noreferrer"')}`;
      } else {
        // Insert rel="noopener noreferrer" right after target="_blank"
        return `${prefix}${rest.replace(/(target=["']_blank["'])/i, '$1 rel="noopener noreferrer"')}`;
      }
    }
    return match;
  });

  if (fileChanged) {
    fs.writeFileSync(file, newContent, 'utf-8');
  }
}

console.log(`Secured ${count} target="_blank" occurrences across ${affectedFiles.size} files.`);
