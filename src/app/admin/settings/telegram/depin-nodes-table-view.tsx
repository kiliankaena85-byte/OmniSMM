'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sliders, ExternalLink, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { DePinNodeAdminItem } from '@/actions/admin/depin/depin-admin-actions';

import { formatRelativeTime, CopyBtn } from './depin-helpers';

interface DePinNodesTableViewProps {
  nodes: DePinNodeAdminItem[];
  filteredNodes: DePinNodeAdminItem[];
  loading: boolean;
  onOpenEditNode: (node: DePinNodeAdminItem) => void;
}

export function DePinNodesTableView({
  nodes,
  filteredNodes,
  loading,
  onOpenEditNode,
}: DePinNodesTableViewProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-border/60 bg-muted/30 text-muted-foreground font-semibold">
            <th className="py-2.5 px-3">Узел (Node ID)</th>
            <th className="py-2.5 px-3">Telegram / Аккаунт</th>
            <th className="py-2.5 px-3 text-right">Баланс (PTS)</th>
            <th className="py-2.5 px-3 text-right">В рублях</th>
            <th className="py-2.5 px-3 text-right">Эскроу</th>
            <th className="py-2.5 px-3 text-center">Задачи / Сбои</th>
            <th className="py-2.5 px-3 text-center">Репутация</th>
            <th className="py-2.5 px-3">Активность</th>
            <th className="py-2.5 px-3 text-right">Действие</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {loading && nodes.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-8 text-center text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                Загрузка реестра узлов...
              </td>
            </tr>
          ) : filteredNodes.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-8 text-center text-muted-foreground">
                Узлов по заданному фильтру не найдено.
              </td>
            </tr>
          ) : (
            filteredNodes.map((node) => {
              const isHighTrust = node.reputation >= 90;
              const isMedTrust = node.reputation >= 70 && node.reputation < 90;

              return (
                <tr key={node.id} className="hover:bg-muted/20 transition-colors">
                  {/* Node ID */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1 font-mono text-[11px] font-semibold text-foreground">
                      <span>{node.id}</span>
                      <CopyBtn text={node.id} />
                    </div>
                  </td>

                  {/* Telegram / User */}
                  <td className="py-2.5 px-3">
                    {node.telegramId ? (
                      <div className="space-y-0.5">
                        <a
                          href={`https://t.me/${node.telegramId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-bold text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <span>ID: {node.telegramId}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        {node.linkedUserEmail && (
                          <Link
                            href={`/admin/clients?search=${encodeURIComponent(node.telegramId)}`}
                            className="text-[10px] text-muted-foreground hover:text-foreground block truncate max-w-[140px]"
                          >
                            {node.linkedUserEmail}
                          </Link>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">Web-аноним</span>
                    )}
                  </td>

                  {/* Credits Balance */}
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-400">
                    {node.creditsBalance.toLocaleString('ru')} PTS
                  </td>

                  {/* Rubles */}
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                    {node.rublesEquivalent.toFixed(2)} ₽
                  </td>

                  {/* Escrow */}
                  <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                    {node.escrowCredits > 0 ? (
                      <span className="text-indigo-400 font-semibold">{node.escrowCredits} PTS</span>
                    ) : (
                      '0'
                    )}
                  </td>

                  {/* Tasks / Failed */}
                  <td className="py-2.5 px-3 text-center font-mono">
                    <span className="text-foreground font-semibold">{node.totalCompletedTasks}</span>
                    {node.tasksFailed > 0 && (
                      <span className="text-rose-400 font-bold ml-1" title="Ошибки / нарушения">
                        (-{node.tasksFailed})
                      </span>
                    )}
                  </td>

                  {/* Reputation */}
                  <td className="py-2.5 px-3 text-center">
                    <Badge
                      intent="outline"
                      className={`text-[10px] font-bold px-2 py-0.5 ${
                        isHighTrust
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : isMedTrust
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {node.reputation}%
                    </Badge>
                  </td>

                  {/* Last active */}
                  <td className="py-2.5 px-3 text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatRelativeTime(node.lastActiveAt)}
                  </td>

                  {/* Action */}
                  <td className="py-2.5 px-3 text-right">
                    <Button
                      type="button"
                      intent="secondary"
                      size="sm"
                      onClick={() => onOpenEditNode(node)}
                      className="h-7 text-[11px] px-2.5 font-semibold cursor-pointer gap-1"
                    >
                      <Sliders className="w-3 h-3" />
                      <span>Управление</span>
                    </Button>
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
