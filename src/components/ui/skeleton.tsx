import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 💀 Атомарный компонент Skeleton для отображения мерцающих плейсхолдеров во время загрузки данных.
 * Полностью опирается на семантический токен bg-muted/60 и анимацию animate-pulse из Tailwind CSS v4.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-muted/60 dark:bg-muted/40",
        className
      )}
      {...props}
    />
  );
}
