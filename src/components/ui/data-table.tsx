'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  Table as ReactTable,
} from '@tanstack/react-table';

import { Table } from '@/components/admin/hero-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  renderToolbar?: (table: ReactTable<TData>) => React.ReactNode;
  hideClientPagination?: boolean;
  initialColumnVisibility?: VisibilityState;
  renderMobileView?: (table: ReactTable<TData>) => React.ReactNode;
  meta?: Record<string, any>;
  compact?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = 'Поиск...',
  renderToolbar,
  hideClientPagination = false,
  initialColumnVisibility = {},
  renderMobileView,
  meta,
  compact = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(initialColumnVisibility);
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    meta,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className="relative">
      {renderToolbar && renderToolbar(table)}
      <div className="flex items-center py-4 justify-between gap-4">
        {searchKey && (
          <Input
            placeholder={searchPlaceholder}
            value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ''}
            onChange={(event) =>
              table.getColumn(searchKey)?.setFilterValue(event.target.value)
            }
            className="max-w-sm"
          />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className="ml-auto flex px-4 h-9 font-medium text-sm border-border border bg-card shadow-sm hover:bg-muted/50 items-center justify-center gap-2 rounded-lg">
            Вид колонок
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className={cn("rounded-xl border border-border/60 overflow-hidden bg-card shadow-md ring-1 ring-border/5", renderMobileView ? "hidden lg:block" : "")}>
        <Table className="h-full w-full">
          <Table.ScrollContainer>
            <Table.Content aria-label="Data Table" className={cn("w-full", compact && "table-fixed")}>
              <Table.Header className="bg-muted/40">
                {table.getFlatHeaders().map((header, index) => {
                  const colMeta = header.column.columnDef.meta as { width?: string } | undefined;
                  const widthStyle = colMeta?.width
                    ? { width: colMeta.width }
                    : header.column.columnDef.size
                      ? { width: `${header.column.columnDef.size}px` }
                      : undefined;

                  return (
                    <Table.Column
                      isRowHeader={index === 0}
                      key={header.id}
                      style={widthStyle}
                      className={cn(
                        "text-left font-bold text-muted-foreground uppercase tracking-wider transition-all duration-150",
                        compact
                          ? "py-2 px-2.5 text-[11px]"
                          : "py-[var(--table-head-py,1rem)] px-[var(--table-head-px,1.5rem)] text-xs"
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </Table.Column>
                  );
                })}
              </Table.Header>
              <Table.Body>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <Table.Row
                      key={row.id}
                      data-state={row.getIsSelected() && 'selected'}
                      className="hover:bg-muted/30 even:bg-muted/10 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <Table.Cell
                          key={cell.id}
                          className={cn(
                            "text-foreground transition-all duration-150",
                            compact
                              ? "py-2 px-2.5 text-xs"
                              : "py-[var(--table-cell-py,1.25rem)] px-[var(--table-cell-px,1.5rem)] text-[length:var(--table-font,0.875rem)]"
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </Table.Cell>
                      ))}
                    </Table.Row>
                  ))
                ) : []}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
        {!table.getRowModel().rows?.length && (
          <div className="h-24 w-full flex items-center justify-center text-sm text-muted-foreground bg-card">
            Нет результатов.
          </div>
        )}
      </div>

      {renderMobileView && (
        <div className="block lg:hidden space-y-4">
          {table.getRowModel().rows?.length ? (
            renderMobileView(table)
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
              Нет результатов.
            </div>
          )}
        </div>
      )}
      {!hideClientPagination && (
        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="flex-1 text-sm text-muted-foreground">
            Выбрано: {table.getFilteredSelectedRowModel().rows.length} из{' '}
            {table.getFilteredRowModel().rows.length} строк.
          </div>
          <div className="space-x-2">
            <Button
              intent="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Пред
            </Button>
            <Button
              intent="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              След
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
