import fs from 'fs';
import path from 'path';

export interface SchemaModelField {
  name: string;
  type: string;
  isNullable: boolean;
  hasDefault: boolean;
}

export interface SchemaModel {
  name: string;
  fields: SchemaModelField[];
  uniqueConstraints: string[];
  indexes: string[];
}

export interface SchemaScanResult {
  models: SchemaModel[];
  enums: string[];
  timestamp: string;
}

export function scanSchema(): SchemaScanResult {
  const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    return { models: [], enums: [], timestamp: new Date().toISOString() };
  }

  const content = fs.readFileSync(schemaPath, 'utf8');
  const lines = content.split('\n');

  const models: SchemaModel[] = [];
  const enums: string[] = [];

  let currentModel: SchemaModel | null = null;
  let inEnum = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith('model ')) {
      const parts = line.split(/\s+/);
      currentModel = {
        name: parts[1],
        fields: [],
        uniqueConstraints: [],
        indexes: []
      };
      continue;
    }

    if (line.startsWith('enum ')) {
      const parts = line.split(/\s+/);
      enums.push(parts[1]);
      inEnum = true;
      continue;
    }

    if (line === '}') {
      if (currentModel) {
        models.push(currentModel);
        currentModel = null;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      inEnum = false;
      continue;
    }

    if (currentModel) {
      if (line.includes('@@unique')) {
        currentModel.uniqueConstraints.push(line);
      } else if (line.includes('@@index')) {
        currentModel.indexes.push(line);
      } else if (line && !line.startsWith('//') && !line.startsWith('@@')) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const fieldName = parts[0];
          const fieldType = parts[1];
          currentModel.fields.push({
            name: fieldName,
            type: fieldType,
            isNullable: fieldType.endsWith('?'),
            hasDefault: line.includes('@default')
          });
        }
      }
    }
  }

  return {
    models,
    enums,
    timestamp: new Date().toISOString()
  };
}

if (require.main === module) {
  const result = scanSchema();
  const outDir = path.resolve(process.cwd(), '.antigravity/evidence/scanners');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'schema-scanner.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
