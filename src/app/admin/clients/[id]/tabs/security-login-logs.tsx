'use client';

import React from 'react';
import { Shield } from 'lucide-react';
import { LoginLogDTO } from './types';

interface SecurityLoginLogsProps {
  loginLogs: LoginLogDTO[];
}

export function SecurityLoginLogs({ loginLogs }: SecurityLoginLogsProps) {
  return (
    <div className="bg-card/60 backdrop-blur-md border border-border/50 shadow-sm rounded-2xl p-5 ring-1 ring-border/5 space-y-3.5 md:col-span-2 lg:col-span-1">
      <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
        <span className="bg-primary/10 text-primary p-1 rounded-md">
          <Shield className="w-3.5 h-3.5" />
        </span>
        Журнал авторизаций (Logs)
      </h3>
      {loginLogs.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 italic py-3">
          Логи авторизации отсутствуют
        </p>
      ) : (
        <div className="overflow-x-auto scrollbar-hide max-h-[160px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 text-[9px] uppercase font-bold tracking-wider text-muted-foreground">
                <th className="pb-2 pr-2">Дата</th>
                <th className="pb-2 px-1">IP</th>
                <th className="pb-2 pl-1 text-right">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-xs">
              {loginLogs.map(log => (
                <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                  <td className="py-1.5 pr-2 font-mono tabular-nums text-muted-foreground text-[10px]">
                    {new Date(log.createdAt).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-1.5 px-1 font-mono text-foreground text-[10px]">
                    {log.ipAddress}
                  </td>
                  <td className="py-1.5 pl-1 text-right">
                    {log.success ? (
                      <span className="inline-flex items-center text-[8px] font-bold uppercase text-emerald-700 bg-success/15 px-1.5 py-0.2 rounded-full">
                        OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[8px] font-bold uppercase text-rose-700 bg-destructive/15 px-1.5 py-0.2 rounded-full">
                        Сбой
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
