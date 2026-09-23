'use client';

import * as React from 'react';
import { DataTable } from '@/components/ui/data-table';
import { columns, ClientColumn } from './columns';

interface ClientTableProps {
  data: ClientColumn[];
}

export function ClientTable({ data }: ClientTableProps) {
  return (
    <div 
      className="w-full overflow-hidden compact-density [&_table]:w-full [&_table]:table-auto [&_th]:px-2.5 [&_th]:py-2 [&_td]:px-2.5 [&_td]:py-2 [&_.overflow-x-auto]:overflow-x-hidden" 
      data-density="compact"
    >
      <DataTable 
        columns={columns} 
        data={data}
        hideClientPagination={true}
      />
    </div>
  );
}
