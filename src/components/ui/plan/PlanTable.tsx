'use client';

import React from "react";

const PlanTableContext = React.createContext<{ compact?: boolean }>({ compact: false });

export interface PlanTableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  compact?: boolean;
}

export function PlanTable({ 
  children, 
  className = "", 
  containerClassName = "", 
  compact = false, 
  ...props 
}: PlanTableProps) {
  return (
    <PlanTableContext.Provider value={{ compact }}>
      <div className={`w-full overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-sm ${containerClassName}`}>
        <table className={`w-full text-left text-sm border-collapse ${className}`} {...props}>
          {children}
        </table>
      </div>
    </PlanTableContext.Provider>
  );
}

export function PlanTableHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { compact } = React.useContext(PlanTableContext);
  return (
    <thead className={`bg-muted/40 border-b border-border text-xs uppercase font-bold text-muted-foreground ${compact ? 'text-[11px]' : ''} ${className}`}>
      {children}
    </thead>
  );
}

export function PlanTableRow({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr 
      onClick={onClick}
      className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {children}
    </tr>
  );
}

export function PlanTableCell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { compact } = React.useContext(PlanTableContext);
  const defaultPadding = compact ? "px-2.5 py-2 text-xs" : "px-4 py-3.5";
  return <td className={`${defaultPadding} text-foreground align-middle ${className}`}>{children}</td>;
}

export function PlanTableHeadCell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { compact } = React.useContext(PlanTableContext);
  const defaultPadding = compact ? "px-2.5 py-2 text-[11px]" : "px-4 py-3";
  return <th className={`${defaultPadding} font-extrabold text-foreground select-none ${className}`}>{children}</th>;
}
