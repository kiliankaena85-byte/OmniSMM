'use client';

import React from 'react';
import { ServiceCard, ServiceCardData } from './ServiceCard';

interface CatalogGridProps {
  services: ServiceCardData[];
  onSelectService?: (service: ServiceCardData) => void;
}

export function CatalogGrid({ services, onSelectService }: CatalogGridProps) {
  if (!services || services.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-card/50 border border-dashed border-border rounded-2xl">
        <p className="text-sm font-semibold text-foreground">Услуги не найдены</p>
        <p className="text-xs text-muted-foreground mt-1">Попробуйте изменить параметры поиска или фильтры</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
      {services.map((service) => (
        <ServiceCard
          key={service.id}
          service={service}
          onSelect={onSelectService}
        />
      ))}
    </div>
  );
}
