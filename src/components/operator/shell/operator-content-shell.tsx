import * as React from 'react';

interface OperatorContentShellProps {
  children: React.ReactNode;
}

export function OperatorContentShell({ children }: OperatorContentShellProps) {
  return (
    <div className="flex-1 max-h-screen overflow-hidden p-0 md:p-4 z-10 relative flex flex-col">
      {/* Glow highlight backdrop */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full filter blur-3xl pointer-events-none z-0" />
      
      <main 
        id="main-content" 
        tabIndex={-1} 
        className="flex-1 w-full overflow-x-hidden overflow-y-auto scrollbar-hide relative transition-all duration-300 bg-card md:rounded-[24px] md:border md:border-border/40 md:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] outline-none z-10"
      >
        <div className="min-h-full w-full p-4 md:p-8 lg:p-10 select-text">
          {children}
        </div>
      </main>
    </div>
  );
}
