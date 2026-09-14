'use client';

/**
 * Feature Flags Client Component
 * 
 * Renders interactive toggle table for feature flags.
 * Uses optimistic updates for instant UI feedback.
 * 
 * Design decisions:
 * - Three-state toggle: OFF → TEST → ON (click cycles through)
 * - Toast notification on every state change
 * - Badge colors: green=ON, yellow=TEST, gray=OFF
 * - Grouped by category for better readability
 */

import { useOptimistic, useTransition } from 'react';
import { setFeatureFlagState } from '@/actions/admin/feature-flags';
import type { FeatureFlagDTO, FlagKey, FlagState } from '@/services/system/feature-flag.service';
import { toast } from 'sonner';
import { Table } from '@/components/admin/hero-ui';

interface Props {
  initialFlags: FeatureFlagDTO[];
}

const STATE_CONFIG: Record<FlagState, { label: string; badge: string; next: FlagState }> = {
  ON:   { label: 'Включён', badge: 'bg-success/15 text-success border border-emerald-500/30 font-bold shadow-sm', next: 'OFF' },
  TEST: { label: 'Тест',    badge: 'bg-warning/15 text-warning border border-amber-500/30 font-bold shadow-sm', next: 'ON' },
  OFF:  { label: 'Выключен', badge: 'bg-muted/60 text-muted-foreground border border-border font-medium', next: 'TEST' },
};

const PREDEFINED_GROUPS = [
  { label: '📦 Заказы',       keys: ['drip_feed'] },
  { label: '📢 Маркетинг',    keys: ['promo_codes'] },
] as const;

export function FeatureFlagsClient({ initialFlags }: Props) {
  const [isPending, startTransition] = useTransition();
  const [optimisticFlags, setOptimisticFlags] = useOptimistic(
    initialFlags,
    (state, { key, newState }: { key: string; newState: FlagState }) =>
      state.map(f => f.key === key ? { ...f, state: newState } : f)
  );

  const flagMap = new Map(optimisticFlags.map(f => [f.key, f]));

  // Build groups including any uncategorized flags dynamically
  const groupedKeys = new Set<string>(PREDEFINED_GROUPS.flatMap(g => g.keys));
  const ungroupedFlags = optimisticFlags.filter(f => !groupedKeys.has(f.key));

  const allGroups = [
    ...PREDEFINED_GROUPS.map(g => ({
      label: g.label,
      flags: g.keys.map(k => flagMap.get(k)).filter(Boolean) as FeatureFlagDTO[],
    })),
    ...(ungroupedFlags.length > 0 ? [{ label: '⚙️ Системные и прочие', flags: ungroupedFlags }] : []),
  ];

  function handleToggle(flag: FeatureFlagDTO) {
    const nextState = STATE_CONFIG[flag.state].next;
    startTransition(async () => {
      setOptimisticFlags({ key: flag.key, newState: nextState });
      const result = await setFeatureFlagState(flag.key as FlagKey, nextState);
      if (!result.success) {
        toast.error('Ошибка при изменении флага');
      } else {
        toast.success(`${flag.label}: ${STATE_CONFIG[nextState].label}`);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground bg-card border border-border/70 rounded-lg p-3 shadow-xs">
        <span className="font-semibold text-foreground">Режимы:</span>
        <span className="px-2 py-0.5 rounded-md font-semibold bg-success/15 text-success border border-emerald-500/30">Включён</span>
        <span>для всех</span>
        <span className="px-2 py-0.5 rounded-md font-semibold bg-warning/15 text-warning border border-amber-500/30">Тест</span>
        <span>для тестовых аккаунтов</span>
        <span className="px-2 py-0.5 rounded-md font-medium bg-muted text-muted-foreground border border-border">Выключен</span>
        <span>отключён</span>
      </div>

      {/* Groups */}
      {allGroups.map(group => {
        const groupFlags = group.flags;
        if (!groupFlags.length) return null;

        return (
          <div key={group.label} className="bg-card border border-border/70 rounded-lg overflow-hidden shadow-xs">
            <div className="px-4 py-2 border-b border-border/60 bg-muted/40">
              <h2 className="text-xs font-semibold text-foreground tracking-wide uppercase">{group.label}</h2>
            </div>
            <Table aria-label={`Группа флагов: ${group.label}`}>
              <Table.ScrollContainer>
                <Table.Content>
                  <Table.Header>
                    <Table.Column isRowHeader>ОПИСАНИЕ</Table.Column>
                    <Table.Column>КЛЮЧ</Table.Column>
                    <Table.Column>ИЗМЕНЕНО</Table.Column>
                    <Table.Column>ДЕЙСТВИЕ</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {groupFlags.map(flag => {
                      const config = STATE_CONFIG[flag.state];
                      return (
                        <Table.Row key={flag.key}>
                          <Table.Cell>
                            <div className="font-medium text-foreground text-sm">{flag.label}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{flag.description}</div>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-xs text-muted-foreground font-mono">{flag.key}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-xs text-muted-foreground">
                              {flag.updatedBy
                                ? <span title={`Изменено: ${flag.updatedAt.toLocaleString('ru')}`}>{flag.updatedBy}</span>
                                : '—'}
                            </span>
                          </Table.Cell>
                          <Table.Cell className="text-right">
                            <button
                              onClick={() => handleToggle(flag)}
                              disabled={isPending}
                              aria-label={`Изменить флаг ${flag.label}: текущее состояние ${config.label}`}
                              className={`
                                px-3 py-1 rounded-full text-xs font-medium
                                transition-all duration-200
                                ${config.badge}
                                hover:opacity-80 active:scale-95
                                disabled:opacity-50 disabled:cursor-not-allowed
                                cursor-pointer
                              `}
                            >
                              {config.label}
                            </button>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </div>
        );
      })}

      <p className="text-xs text-muted-foreground text-center">
        Нажмите на статус для переключения: Выключен → Тест → Включён → Выключен
      </p>
    </div>
  );
}
