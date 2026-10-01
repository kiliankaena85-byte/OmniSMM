'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Eye, Heart, MessageSquare, ArrowUpRight, Coins, BookmarkCheck } from 'lucide-react';
import type { DePinTargetAdminItem } from '@/actions/admin/depin/depin-admin-actions';

interface DePinTargetsTableViewProps {
  targets: DePinTargetAdminItem[];
  currentView: 'targets' | 'info';
}

function formatRelativeTime(dateInput: Date | string | number): string {
  const date = new Date(dateInput);
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return 'только что';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ч назад`;
  return `${Math.floor(diffHours / 24)} дн назад`;
}

export function DePinTargetsTableView({ targets, currentView }: DePinTargetsTableViewProps) {
  if (currentView === 'info') {
    return (
      <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-4 text-xs leading-relaxed text-muted-foreground">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-foreground">Сквозной бухгалтерский учет DePIN (Ledger-First)</h4>
            <p>
              Заработанные поинты (OmniCredits) хранятся в защищенной таблице <code>DePinNode</code> с инвариантом <code>CHECK (creditsBalance &gt;= 0)</code>.
              При выводе средств пользователем в мини-приложении:
            </p>
            <ul className="list-disc list-inside space-y-0.5 pt-1">
              <li>Курс обмена зафиксирован: <strong>100 PTS = 1.00 ₽</strong>;</li>
              <li>Списание и зачисление происходят внутри сериализуемой транзакции <code>runSerializableTransaction</code>;</li>
              <li>В официальном бухгалтерском леджере формируется проводка типа <code>COMPENSATION</code> с уникальным ключом идемпотентности <code>depin_reward_*</code>;</li>
              <li>Все выплаты доступны финансовой службе в основном финансовом хабе платформы.</li>
            </ul>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-border/60">
          <span className="font-medium text-foreground">Перейти к детальным финансовым проводкам выплат:</span>
          <Link
            href="/admin/finance"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all text-xs"
          >
            <span>Открыть /admin/finance (Леджер)</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-border/60 bg-muted/30 text-muted-foreground font-semibold">
            <th className="py-2.5 px-3">Канал / Пост</th>
            <th className="py-2.5 px-3">Тип задания</th>
            <th className="py-2.5 px-3">Прогресс выполнения</th>
            <th className="py-2.5 px-3 text-center">Статус</th>
            <th className="py-2.5 px-3">Создано</th>
            <th className="py-2.5 px-3 text-right">Ссылка</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {targets.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-8 text-center text-muted-foreground">
                Очередь заданий пуста. Нажмите «Добавить задание», чтобы направить распределенный трафик узлов.
              </td>
            </tr>
          ) : (
            targets.map((t) => {
              const percent = Math.min(100, Math.round((t.completedViews / t.targetViews) * 100));

              return (
                <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-foreground">
                    @{t.channel} <span className="text-muted-foreground font-mono">#{t.postId}</span>
                  </td>

                  <td className="py-2.5 px-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted/50 border border-border/60">
                      {t.type.includes('VIEW') && <Eye className="w-3 h-3 text-blue-400" />}
                      {t.type.includes('REACT') && <Heart className="w-3 h-3 text-rose-400" />}
                      {t.type.includes('COMMENT') && <MessageSquare className="w-3 h-3 text-amber-400" />}
                      {t.type}
                    </span>
                  </td>

                  <td className="py-2.5 px-3">
                    <div className="space-y-1 max-w-[180px]">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span>{t.completedViews} из {t.targetViews}</span>
                        <span className="font-bold">{percent}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="py-2.5 px-3 text-center">
                    <Badge
                      intent="outline"
                      className={`text-[10px] font-bold ${
                        t.status === 'COMPLETED'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                      }`}
                    >
                      {t.status}
                    </Badge>
                  </td>

                  <td className="py-2.5 px-3 text-[11px] text-muted-foreground">
                    {formatRelativeTime(t.createdAt)}
                  </td>

                  <td className="py-2.5 px-3 text-right">
                    <a
                      href={`https://t.me/${t.channel}/${t.postId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-semibold"
                    >
                      <span>Пост</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
