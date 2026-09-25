'use client';

import { useState, useTransition } from 'react';
import { getSystemLogs } from '@/actions/admin/system-logs';
import {
  type LogCategory,
  type SystemLogsResult,
  type AnyLogItemDTO,
  type SecurityEventDTO,
  type LoginLogDTO,
  type AdminAuditLogDTO,
  type TelegramErrorLogDTO,
} from '@/types/system-logs.dto';
import { SecurityTable } from './security-table';
import { LoginsTable } from './logins-table';
import { AuditTable } from './audit-table';
import { TelegramTable } from './telegram-table';
import { LogDetailsModal } from './log-details-modal';
import { LogsStatCards } from './logs-stat-cards';
import { LogsFilterBar } from './logs-filter-bar';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/admin/hero-ui';

interface SystemLogsClientProps {
  initialData: SystemLogsResult<AnyLogItemDTO>;
}

export function SystemLogsClient({ initialData }: SystemLogsClientProps) {
  const [data, setData] = useState<SystemLogsResult<AnyLogItemDTO>>(initialData);
  const [category, setCategory] = useState<LogCategory>(initialData.category || 'security');
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('ALL');
  const [page, setPage] = useState(initialData.page || 1);
  const [isPending, startTransition] = useTransition();

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    data: unknown;
  }>({
    isOpen: false,
    title: '',
    data: null,
  });

  const fetchLogs = (newCategory = category, newPage = page, newSeverity = severity, newSearch = search) => {
    startTransition(async () => {
      const res = await getSystemLogs({
        category: newCategory,
        page: newPage,
        pageSize: 25,
        severity: newSeverity === 'ALL' ? undefined : newSeverity,
        search: newSearch.trim() || undefined,
      });
      if (res.success) {
        setData(res.data);
      }
    });
  };

  const handleCategoryChange = (newCat: LogCategory) => {
    setCategory(newCat);
    setPage(1);
    setSeverity('ALL');
    fetchLogs(newCat, 1, 'ALL', search);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchLogs(category, newPage, severity, search);
  };

  return (
    <div className="space-y-5">
      <LogsStatCards
        stats={data.stats}
        activeCategory={category}
        onSelectCategory={handleCategoryChange}
      />

      <LogsFilterBar
        category={category}
        search={search}
        severity={severity}
        isPending={isPending}
        onCategoryChange={handleCategoryChange}
        onSearchChange={setSearch}
        onSearchSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          fetchLogs(category, 1, severity, search);
        }}
        onSeverityChange={(e) => {
          const val = e.target.value;
          setSeverity(val);
          setPage(1);
          fetchLogs(category, 1, val, search);
        }}
        onRefresh={() => fetchLogs()}
      />

      {/* Tables Stream View */}
      <div className={`transition-opacity duration-200 ${isPending ? 'opacity-60' : 'opacity-100'}`}>
        {category === 'security' && (
          <SecurityTable
            items={data.items as SecurityEventDTO[]}
            onInspect={(item: SecurityEventDTO) =>
              setModalState({
                isOpen: true,
                title: `Событие: ${item.event}`,
                subtitle: `IP: ${item.ip || '—'} | Уровень: ${item.severity}`,
                data: item.details,
              })
            }
          />
        )}
        {category === 'logins' && <LoginsTable items={data.items as LoginLogDTO[]} />}
        {category === 'audit' && (
          <AuditTable
            items={data.items as AdminAuditLogDTO[]}
            onInspect={(item: AdminAuditLogDTO) =>
              setModalState({
                isOpen: true,
                title: `Аудит: ${item.action}`,
                subtitle: `Администратор: ${item.adminEmail} | Объект: ${item.targetType} [${item.target}]`,
                data: {
                  oldValue: item.oldValue,
                  newValue: item.newValue,
                  ipAddress: item.ipAddress,
                  adminId: item.adminId,
                },
              })
            }
          />
        )}
        {category === 'telegram' && (
          <TelegramTable
            items={data.items as TelegramErrorLogDTO[]}
            onInspect={(item: TelegramErrorLogDTO) =>
              setModalState({
                isOpen: true,
                title: `Сбой Telegram: ${item.errorMessage}`,
                subtitle: `Источник: ${item.source} | Ошибка: ${item.errorCode || '—'}`,
                data: {
                  stackTrace: item.stackTrace,
                  updateData: item.updateData,
                  userId: item.userId,
                  chatId: item.chatId,
                },
              })
            }
          />
        )}
      </div>

      {/* Pagination Footer */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between px-2 pt-2 text-xs text-muted-foreground">
          <div>
            Показано {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} из {data.total} записей
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handlePageChange(data.page - 1)}
              disabled={data.page <= 1 || isPending}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-2 font-mono font-medium text-foreground">
              {data.page} / {data.totalPages}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handlePageChange(data.page + 1)}
              disabled={data.page >= data.totalPages || isPending}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Inspection Modal */}
      <LogDetailsModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, title: '', data: null })}
        title={modalState.title}
        subtitle={modalState.subtitle}
        data={modalState.data}
      />
    </div>
  );
}
