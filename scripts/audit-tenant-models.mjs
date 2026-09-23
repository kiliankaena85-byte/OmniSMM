import fs from 'fs';

const schema = fs.readFileSync('prisma/schema.prisma', 'utf-8');
const models = [];
let currentModel = null;

for (const line of schema.split(/\r?\n/)) {
  const modelMatch = line.match(/^model\s+(\w+)\s+\{/);
  if (modelMatch) {
    currentModel = { name: modelMatch[1], fields: [], hasTenantId: false, uniqueClauses: [], userRelations: [] };
    models.push(currentModel);
  } else if (currentModel) {
    if (line.trim().startsWith('}')) {
      currentModel = null;
    } else {
      const fieldMatch = line.trim().match(/^(\w+)\s+([\w\[\]\?]+)/);
      if (fieldMatch) {
        const fieldName = fieldMatch[1];
        const fieldType = fieldMatch[2];
        currentModel.fields.push({ name: fieldName, type: fieldType });
        if (fieldName === 'tenantId') {
          currentModel.hasTenantId = true;
        }
        if (fieldType === 'User' || fieldName === 'userId') {
          currentModel.userRelations.push(fieldName);
        }
      }
      if (line.includes('@@unique') || line.includes('@unique')) {
        currentModel.uniqueClauses.push(line.trim());
      }
    }
  }
}

console.log('=== TOTAL MODELS IN PRISMA: ' + models.length + ' ===\n');

const withTenant = models.filter(m => m.hasTenantId);
const withoutTenant = models.filter(m => !m.hasTenantId);
const withoutTenantWithUser = withoutTenant.filter(m => m.userRelations.length > 0);
const withoutTenantNoUser = withoutTenant.filter(m => m.userRelations.length === 0);

console.log('--- MODELS WITH tenantId (' + withTenant.length + ') ---');
console.log(withTenant.map(m => m.name).join(', '));

console.log('\n--- MODELS WITHOUT tenantId BUT CONNECTED TO USER (' + withoutTenantWithUser.length + ') [HIGH RISK OF LEAK] ---');
for (const m of withoutTenantWithUser) {
  console.log(`- ${m.name} (user fields: ${m.userRelations.join(', ')})`);
}

console.log('\n--- MODELS WITHOUT tenantId AND NO USER RELATION (' + withoutTenantNoUser.length + ') ---');
console.log(withoutTenantNoUser.map(m => m.name).join(', '));
