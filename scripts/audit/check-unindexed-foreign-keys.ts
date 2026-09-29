/**
 * check-unindexed-foreign-keys.ts
 * Скрипт статического анализа prisma/schema.prisma на наличие внешних ключей без B-Tree индексов.
 * В PostgreSQL отсутствие индекса на FK приводит к Sequential Scan при удалении/обновлении родительской записи.
 */

import fs from 'fs';
import path from 'path';

const SCHEMA_PATH = path.join(process.cwd(), 'prisma', 'schema.prisma');

interface MissingIndexFinding {
  model: string;
  field: string;
  targetModel: string;
}

export function findUnindexedForeignKeys(schemaContent: string): MissingIndexFinding[] {
  const lines = schemaContent.split('\n');
  const missing: MissingIndexFinding[] = [];

  let currentModel: string | null = null;
  const modelFields = new Map<string, string[]>();
  const modelIndexes = new Map<string, Set<string>>();
  const modelUniques = new Map<string, Set<string>>();
  const modelRelations = new Map<string, Array<{ field: string; targetModel: string }>>();

  // First pass: collect models, fields, relations, indexes, and uniques
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('model ')) {
      currentModel = trimmed.split(/\s+/)[1];
      modelFields.set(currentModel, []);
      modelIndexes.set(currentModel, new Set());
      modelUniques.set(currentModel, new Set());
      modelRelations.set(currentModel, []);
      continue;
    }

    if (!currentModel || trimmed.startsWith('//') || trimmed === '}') {
      if (trimmed === '}') currentModel = null;
      continue;
    }

    // Check relation: e.g. user User @relation(fields: [userId], references: [id])
    if (trimmed.includes('@relation') && trimmed.includes('fields:')) {
      const fieldsMatch = trimmed.match(/fields:\s*\[([^\]]+)\]/);
      const targetModelMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)/);
      if (fieldsMatch && targetModelMatch) {
        const fields = fieldsMatch[1].split(',').map((s) => s.trim());
        const targetModel = targetModelMatch[2];
        for (const f of fields) {
          modelRelations.get(currentModel)?.push({ field: f, targetModel });
        }
      }
    }

    // Check @@index([field1, field2])
    if (trimmed.startsWith('@@index(')) {
      const idxMatch = trimmed.match(/@@index\(\[([^\]]+)\]/);
      if (idxMatch) {
        const idxFields = idxMatch[1].split(',').map((s) => s.trim());
        // The first column in compound index covers single-column lookups in B-Tree
        if (idxFields[0]) {
          modelIndexes.get(currentModel)?.add(idxFields[0]);
        }
      }
    }

    // Check @@unique([field1])
    if (trimmed.startsWith('@@unique(')) {
      const uqMatch = trimmed.match(/@@unique\(\[([^\]]+)\]/);
      if (uqMatch) {
        const uqFields = uqMatch[1].split(',').map((s) => s.trim());
        if (uqFields[0]) {
          modelUniques.get(currentModel)?.add(uqFields[0]);
        }
      }
    }

    // Check inline @unique or @id
    if (trimmed.includes('@unique') || trimmed.includes('@id')) {
      const fieldName = trimmed.split(/\s+/)[0];
      modelUniques.get(currentModel)?.add(fieldName);
    }
  }

  // Second pass: check which relations lack an index or unique constraint
  for (const [model, relations] of modelRelations.entries()) {
    const indexes = modelIndexes.get(model) || new Set();
    const uniques = modelUniques.get(model) || new Set();

    for (const rel of relations) {
      if (!indexes.has(rel.field) && !uniques.has(rel.field)) {
        missing.push({
          model,
          field: rel.field,
          targetModel: rel.targetModel,
        });
      }
    }
  }

  return missing;
}

if (process.argv[1]?.includes('check-unindexed-foreign-keys.ts')) {
  const content = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  const missing = findUnindexedForeignKeys(content);

  console.log(`🔍 [PostgreSQL FK Audit] Scanned schema: ${SCHEMA_PATH}`);
  if (missing.length === 0) {
    console.log(`✅ [PASS] All Foreign Key fields have covering B-Tree indexes!`);
  } else {
    console.log(`⚠️ [WARNING] Found ${missing.length} Foreign Keys without B-Tree indexes:`);
    missing.forEach((m) => {
      console.log(`   - Model [${m.model}]: field "${m.field}" -> references ${m.targetModel}`);
    });
  }
}
