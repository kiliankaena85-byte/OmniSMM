'use client';

import React, { useState, useTransition } from 'react';
import { Table } from '@/components/admin/hero-ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  compensateServiceMarginAction,
  getServicePriceHistoryAction,
  type DriftCandidate,
} from '@/actions/admin/catalog/price-drift';
import { PriceHistoryChart } from '@/components/admin/catalog/PriceHistoryChart';

export function DriftClient({ initialData }: { initialData: DriftCandidate[] }) {
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [chartData, setChartData] = useState<{ date: string; rate: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [selectedService, setSelectedService] = useState<DriftCandidate | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCompensate = (serviceId: string) => {
    setLoadingIds(prev => new Set(prev).add(serviceId));
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const res = await compensateServiceMarginAction(serviceId);
        if (res.success) {
          setData(prev => prev.filter(s => s.id !== serviceId));
        } else {
          setErrorMessage(res.error || 'Ошибка компенсации маржи');
        }
      } catch {
        setErrorMessage('Сбой соединения при компенсации маржи');
      } finally {
        setLoadingIds(prev => {
          const next = new Set(prev);
          next.delete(serviceId);
          return next;
        });
      }
    });
  };

  const handleViewHistory = async (service: DriftCandidate) => {
    setSelectedService(service);
    setChartLoading(true);
    setIsModalOpen(true);
    try {
      const res = await getServicePriceHistoryAction(service.id);
      if (res.success && res.data) {
        setChartData(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setChartLoading(false);
    }
  };

  return (
    <>
      {errorMessage && (
        <div className="mb-4 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-xs underline hover:opacity-80">Закрыть</button>
        </div>
      )}
      <div className="bg-card border border-border rounded-xl overflow-hidden w-full">
        <Table aria-label="Таблица дрейфа цен">
          <Table.ScrollContainer>
            <Table.Content>
              <Table.Header>
                <Table.Column isRowHeader>ID</Table.Column>
                <Table.Column>ПРОВАЙДЕР</Table.Column>
                <Table.Column>НАЗВАНИЕ</Table.Column>
                <Table.Column>ИЗМЕНЕНИЕ ЦЕНЫ</Table.Column>
                <Table.Column>ДРЕЙФ ЗА 30 ДН.</Table.Column>
                <Table.Column>МАРЖА (ЦЕЛЬ / ФАКТ)</Table.Column>
                <Table.Column>ДЕЙСТВИЯ</Table.Column>
              </Table.Header>
              <Table.Body emptyContent="Нет услуг с плавным дрейфом маржи (5-20%).">
                {data.map((service) => (
                  <Table.Row key={service.id}>
                    <Table.Cell className="font-mono text-sm text-muted-foreground">
                      {service.numericId}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{service.providerName}</span>
                        <span className="text-xs text-muted-foreground">
                          ID: {service.providerId?.slice(0, 8)}
                        </span>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="max-w-[200px] truncate" title={service.name}>
                      {service.name}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground line-through text-sm">
                          ${service.oldRate.toFixed(4)}
                        </span>
                        <span className="text-destructive font-medium">
                          ${service.currentRate.toFixed(4)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        С {new Date(service.historicalDate).toLocaleDateString('ru-RU')}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="px-2 py-1 bg-warning/20 text-warning text-xs rounded-md">
                        +{(service.driftPercent * 100).toFixed(1)}%
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className="text-muted-foreground">{service.configuredMarkup.toFixed(2)}x</span>
                        <span>/</span>
                        <span className={service.actualMarkup < service.configuredMarkup ? 'text-destructive font-medium' : 'text-success font-medium'}>
                          {service.actualMarkup.toFixed(2)}x
                        </span>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Button 
                          size="sm" 
                          intent="outline" 
                          onClick={() => handleViewHistory(service)}
                        >
                          График
                        </Button>
                        <Button 
                          size="sm" 
                          intent="primary"
                          disabled={isPending || loadingIds.has(service.id)}
                          onClick={() => handleCompensate(service.id)}
                        >
                          Компенсировать
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>История цен: {selectedService?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {chartLoading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Загрузка данных...
              </div>
            ) : (
              <PriceHistoryChart data={chartData} />
            )}
          </div>
          <DialogFooter>
            <Button intent="outline" onClick={() => setIsModalOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
