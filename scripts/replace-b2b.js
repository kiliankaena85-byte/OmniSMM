const fs = require('fs');
const path = require('path');

const targetDirs = ['src', 'prisma', 'docs', '.agents', 'scripts'];
const specificFiles = ['AGENTS.md', 'CURRENT_STATE.md'];

const replacements = [
  // Exact model and variable names
  { from: /ApiConfig/g, to: 'ApiConfig' },
  { from: /apiConfig/g, to: 'apiConfig' },
  { from: /ApiRequestLog/g, to: 'ApiRequestLog' },
  { from: /apiRequestLog/g, to: 'apiRequestLog' },
  { from: /isApiEnabled/g, to: 'isApiEnabled' },
  { from: /ApiWebhookCard/g, to: 'ApiWebhookCard' },
  { from: /api-auth/g, to: 'api-auth' },
  { from: /corporate-invoice/g, to: 'corporate-invoice' },
  { from: /api-tab/g, to: 'api-tab' },
  { from: /api-vault-encryption/g, to: 'api-vault-encryption' },
  { from: /services\/api/g, to: 'services/api' },
  
  // Broader text and UI terminology
  { from: /Panel API/g, to: 'Panel API' },
  { from: /Panel API/g, to: 'Panel API' },
  { from: /API клиенты/g, to: 'API клиенты' },
  { from: /API клиент/g, to: 'API клиент' },
  { from: /API-клиент/g, to: 'API-клиент' },
  { from: /API/g, to: 'API' },
  { from: /api/g, to: 'api' },
  { from: /Api/g, to: 'Api' },
];

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (['node_modules', '.next', '.git', 'archive'].includes(file)) continue;
      processDirectory(fullPath);
    } else {
      if (!fullPath.match(/\.(ts|tsx|js|jsx|json|md|mdx|prisma)$/)) continue;
      processFile(fullPath);
    }
  }
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  
  for (const rule of replacements) {
    newContent = newContent.replace(rule.from, rule.to);
  }
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

console.log('Starting global replace...');

for (const dir of targetDirs) {
  if (fs.existsSync(dir)) {
    processDirectory(dir);
  }
}

for (const file of specificFiles) {
  if (fs.existsSync(file)) {
    processFile(file);
  }
}

console.log('Replace complete.');
