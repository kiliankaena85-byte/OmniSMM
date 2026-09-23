/**
 * Level 1 Service: Runbook Markdown Formatter (Rospatent & GOST ESPD Standard)
 */

import type { AdminRunbook } from '@/types/admin-ai-manual';

export function formatRunbookToPatentMarkdown(runbook: AdminRunbook): string {
  const parts: string[] = [];

  parts.push(`# РЕГЛАМЕНТ ТЕХНИЧЕСКОЙ ЭКСПЛУАТАЦИИ`);
  parts.push(`## Программный комплекс «OmniSMM 1.0» (SMMplan / SMMflux)`);
  parts.push(`**Стандарт оформления:** ГОСТ ЕСПД 19.505-79 / Регламент Роспатента для ЭВМ`);
  parts.push(`**Глава ${runbook.chapterNumber}. ${runbook.chapterTitle}**`);
  parts.push(`**Статья регламента:** ${runbook.title}`);
  parts.push(`- **Идентификатор модуля:** \`${runbook.id}\``);
  parts.push(`- **Целевой интерфейс:** \`${runbook.targetRoute}\``);
  parts.push(`- **Расчетное время выполнения:** ~${runbook.estimatedMinutes} мин.`);
  parts.push(`- **Тематические метки:** ${runbook.tags.map((t) => `\`#${t}\``).join(' ')}`);
  parts.push(`\n---\n`);

  parts.push(`### 1. ОБЛАСТЬ ПРИМЕНЕНИЯ И НАЗНАЧЕНИЕ`);
  parts.push(runbook.scopeAndObjectives || runbook.summary);
  parts.push(``);

  parts.push(`### 2. ТЕРМИНЫ, СОКРАЩЕНИЯ И ОПРЕДЕЛЕНИЯ`);
  if (runbook.termsAndDefinitions && runbook.termsAndDefinitions.length > 0) {
    parts.push(`| Термин / Сокращение | Определение и техническое значение |`);
    parts.push(`| :--- | :--- |`);
    runbook.termsAndDefinitions.forEach((item) => {
      parts.push(`| **${item.term}** | ${item.definition} |`);
    });
  } else {
    parts.push(`*Специальные термины не установлены. Применяются базовые определения стандартов OmniSMM 1.0.*`);
  }
  parts.push(``);

  parts.push(`### 3. ТЕХНИЧЕСКАЯ СУЩНОСТЬ И АРХИТЕКТУРА МОДУЛЯ`);
  if (runbook.technicalArchitecture) {
    const arch = runbook.technicalArchitecture;
    if (arch.description) parts.push(`*Описание архитектурного слоя:* ${arch.description}\n`);
    if (arch.prismaTables?.length) {
      parts.push(`- **Реляционные таблицы (Prisma Schema):** ${arch.prismaTables.map((t) => `\`${t}\``).join(', ')}`);
    }
    if (arch.serverActions?.length) {
      parts.push(`- **Точки входа (Server Actions / Handlers):** ${arch.serverActions.map((a) => `\`${a}()\``).join(', ')}`);
    }
    if (arch.level1Services?.length) {
      parts.push(`- **Сервисный слой ядра (Level 1 Services):** ${arch.level1Services.map((s) => `\`${s}\``).join(', ')}`);
    }
  } else {
    parts.push(`*Модуль опирается на общую доменную архитектуру и сервисы ядра платформы.*`);
  }
  if (runbook.relatedFiles?.length) {
    parts.push(`- **Исходные файлы модуля:**\n${runbook.relatedFiles.map((f) => `  - \`${f}\``).join('\n')}`);
  }
  parts.push(``);

  parts.push(`### 4. ПОШАГОВЫЙ РЕГЛАМЕНТ ШТАТНОЙ ЭКСПЛУАТАЦИИ`);
  if (runbook.steps && runbook.steps.length > 0) {
    runbook.steps.forEach((s) => {
      parts.push(`#### Шаг ${s.stepNumber}. ${s.title}`);
      parts.push(`${s.instruction}`);
      if (s.actionUrl) {
        parts.push(`> 🔗 **Интерфейс выполнения:** [${s.actionLabel || 'Перейти к разделу'}](${s.actionUrl})`);
      }
      if (s.warningNote) {
        parts.push(`> ⚠️ **Предостережение оператора:** ${s.warningNote}`);
      }
      parts.push(``);
    });
  } else {
    parts.push(`*Специальные пошаговые инструкции не требуются.*\n`);
  }

  parts.push(`### 5. НЕСТАНДАРТНЫЕ И ЗАЩИТНЫЕ ФУНКЦИИ`);
  if (runbook.protectiveMechanisms && runbook.protectiveMechanisms.length > 0) {
    runbook.protectiveMechanisms.forEach((p) => {
      parts.push(`- **${p.title}** ${p.ruleCode ? `(\`${p.ruleCode}\`)` : ''}: ${p.description}`);
    });
  } else {
    parts.push(`*Специальные защитные механизмы не заданы. Действуют общесистемные политики безопасности.*`);
  }
  parts.push(``);

  parts.push(`### 6. ДИАГНОСТИКА СБОЕВ И ПЛАН ВОССТАНОВЛЕНИЯ`);
  if (runbook.troubleshooting && runbook.troubleshooting.length > 0) {
    runbook.troubleshooting.forEach((t, i) => {
      parts.push(`#### 6.${i + 1}. ${t.scenario}`);
      parts.push(`- **Симптомы сбоя:** ${t.symptoms}`);
      parts.push(`- **План восстановления:** ${t.remedy}`);
      if (t.files?.length) {
        parts.push(`- **Участвующие компоненты:** ${t.files.map((f) => `\`${f}\``).join(', ')}`);
      }
      parts.push(``);
    });
  } else {
    parts.push(`*Типовые нештатные ситуации и сбои для данного модуля не зафиксированы.*`);
    parts.push(``);
  }

  parts.push(`\n---\n*Документ подготовлен в соответствии с регламентом Роспатента и стандартами надежности OmniSMM 1.0.*`);
  return parts.join('\n');
}

export function formatConsolidatedManualToPatentMarkdown(runbooks: AdminRunbook[]): string {
  const parts: string[] = [];

  parts.push(`# СВОДНОЕ РУКОВОДСТВО ПО ТЕХНИЧЕСКОЙ ЭКСПЛУАТАЦИИ И АРХИТЕКТУРЕ`);
  parts.push(`## Программный комплекс управления мульти-тенантной платформой «OmniSMM 1.0»`);
  parts.push(`*(Бренды: SMMplan.pro & SMMflux.ru)*\n`);
  parts.push(`**Стандарт оформления:** ГОСТ ЕСПД 19.505-79 / Требования Роспатента к описанию программ для ЭВМ`);
  parts.push(`**Версия платформы:** 1.0 (Релиз 2026 года)`);
  parts.push(`**Дата формирования документа:** ${new Date().toISOString().split('T')[0]}`);
  parts.push(`**Гриф документа:** Для внутреннего использования системными администраторами и инженерами`);
  parts.push(`\n---\n`);

  parts.push(`## СОДЕРЖАНИЕ СВОДНОГО РУКОВОДСТВА\n`);
  runbooks.forEach((r) => {
    parts.push(`- [Глава ${r.chapterNumber}: ${r.title}](#глава-${r.chapterNumber}-${r.id})`);
  });
  parts.push(`\n---\n`);

  runbooks.forEach((r) => {
    parts.push(`<a id="глава-${r.chapterNumber}-${r.id}"></a>`);
    parts.push(formatRunbookToPatentMarkdown(r));
    parts.push(`\n\n`);
  });

  return parts.join('\n');
}
