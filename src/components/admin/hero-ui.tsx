'use client';

import React from "react";
import {
  Table as ShadcnTable,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
export { Button } from "@/components/ui/button";

interface TableColumnProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children?: React.ReactNode;
  className?: string;
  isRowHeader?: boolean;
}

const TableColumn = ({ children, className }: TableColumnProps) => (
  <TableHead className={cn("text-muted-foreground font-bold border-b border-border/80 bg-muted/30 py-4 px-6 text-xs uppercase tracking-wider", className)}>{children}</TableHead>
);

const TableHeaderComponent = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <TableHeader className={className}>
    <TableRow className="hover:bg-transparent border-b border-border/80">{children}</TableRow>
  </TableHeader>
);

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children?: React.ReactNode;
  className?: string;
}

const TableCellComponent = ({ children, className }: TableCellProps) => (
  <TableCell className={cn("text-foreground border-b border-border/50 align-middle py-5 px-6", className)}>{children}</TableCell>
);

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children?: React.ReactNode;
  className?: string;
}

const TableRowComponent = ({ children, className }: TableRowProps) => (
  <TableRow className={cn("hover:bg-muted/50 even:bg-muted/20 border-b border-border/50 transition-all duration-150 group", className)}>{children}</TableRow>
);

interface TableBodyProps {
  children?: React.ReactNode;
  emptyContent?: React.ReactNode;
  renderEmptyState?: () => React.ReactNode;
}

const TableBodyComponent = ({ children, emptyContent, renderEmptyState }: TableBodyProps) => {
  const content = React.Children.toArray(children).filter(Boolean);
  if (content.length === 0) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={100} className="text-center py-12 text-warm-text/60 font-medium">
            {renderEmptyState ? renderEmptyState() : emptyContent || "Нет данных"}
          </TableCell>
        </TableRow>
      </TableBody>
    );
  }
  return <TableBody>{children}</TableBody>;
};

interface TableScrollContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
}

const TableScrollContainer = ({ children, className, ...props }: TableScrollContainerProps) => (
  <div className={cn("w-full overflow-x-auto", className)} {...props}>
    {children}
  </div>
);

interface TableContentProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children?: React.ReactNode;
  className?: string;
}

const TableContent = ({ children, "aria-label": ariaLabel, className }: TableContentProps) => (
  <ShadcnTable aria-label={ariaLabel} className={className}>
    {children}
  </ShadcnTable>
);

interface MainTableProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}

export const Table = Object.assign(
  ({ children, "aria-label": ariaLabel, className }: MainTableProps) => {
    let hasWrapperChild = false;
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child)) {
        if (child.type === TableScrollContainer || child.type === TableContent) {
          hasWrapperChild = true;
        }
      }
    });

    if (hasWrapperChild) {
      return (
        <div className={cn("w-full", className)} aria-label={ariaLabel} data-slot="table-root-wrapper">
          {children}
        </div>
      );
    }

    return (
      <div className={cn("relative w-full overflow-x-auto", className)}>
        <ShadcnTable aria-label={ariaLabel}>
          {children}
        </ShadcnTable>
      </div>
    );
  },
  {
    Header: TableHeaderComponent,
    Column: TableColumn,
    Body: TableBodyComponent,
    Row: TableRowComponent,
    Cell: TableCellComponent,
    Container: TableScrollContainer,
    ScrollContainer: TableScrollContainer,
    Content: TableContent,
  }
);
