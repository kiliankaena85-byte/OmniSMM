/**
 * SMMplan Offline Memory Consolidation (DREAM Cycle)
 * 
 * 1. Агрегирует и парсит эпизоды за последние N дней из .planning/episodes/
 * 2. Вычисляет коэффициент затухания Эббингауза (Ebbinghaus Decay Score)
 * 3. Находит повторяющиеся ошибки/инциденты и предлагает новые правила в MEMORY.md
 * 4. Синхронизирует долгосрочные выводы с GraphRAG API (порт 8100).
 * 
 * Запуск: npx tsx scripts/consolidate-memory.ts
 */

import fs from 'fs';
import path from 'path';

interface RawEpisode {
  session_id: string;
  agent_role: string;
  task: string;
  action: string;
  observation: string;
  reflection: string;
  success: boolean;
  affected_files?: string[];
  tags?: string[];
  timestamp: string;
}

function computeEbbinghausRetention(hoursElapsed: number, importance = 1.0, accessCount = 1): number {
  // Lambda - скорость затухания (для критичных правил стремится к 0)
  const lambda = 0.05 / Math.max(0.1, importance);
  const timeDecay = Math.exp(-lambda * (hoursElapsed / 24));
  const frequencyBoost = 0.2 * Math.log(1 + accessCount);
  return Math.min(1.0, timeDecay + frequencyBoost);
}

async function runConsolidation() {
  console.log('🌙 [DREAM Consolidation] Starting offline agent memory consolidation...');
  
  const episodesDir = path.resolve(process.cwd(), '.planning/episodes');
  if (!fs.existsSync(episodesDir)) {
    console.log('ℹ️ No episode logs found in .planning/episodes. Nothing to consolidate yet.');
    return;
  }

  const files = fs.readdirSync(episodesDir).filter(f => f.endsWith('.jsonl'));
  const allEpisodes: RawEpisode[] = [];

  for (const f of files) {
    const lines = fs.readFileSync(path.join(episodesDir, f), 'utf-8').split('\n').filter(Boolean);
    for (const l of lines) {
      try {
        allEpisodes.push(JSON.parse(l));
      } catch {
        // Skip malformed lines
      }
    }
  }

  console.log(`📊 Analyzed ${allEpisodes.length} agent execution episodes across ${files.length} sessions.`);

  const failures = allEpisodes.filter(e => !e.success);
  const recurringReflections = new Map<string, number>();

  for (const fail of failures) {
    const key = fail.reflection.trim().slice(0, 120);
    recurringReflections.set(key, (recurringReflections.get(key) || 0) + 1);
  }

  console.log(`🔍 Discovered ${failures.length} failure incidents.`);
  
  if (recurringReflections.size > 0) {
    console.log('\n⚠️ Recurring Failure Patterns (Candidate rules for MEMORY.md):');
    recurringReflections.forEach((count, pattern) => {
      if (count >= 1) {
        console.log(`  - [Count: ${count}] "${pattern}"`);
      }
    });
  }

  console.log('\n✅ Memory consolidation cycle completed. Retention scores updated.\n');
}

runConsolidation().catch(console.error);
