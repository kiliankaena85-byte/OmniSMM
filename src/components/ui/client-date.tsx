'use client';

import { useState, useEffect } from 'react';

type Props = {
  date: string | Date;
  format?: 'time' | 'date' | 'date-short' | 'datetime';
  className?: string;
};

const FORMAT_OPTIONS: Record<string, Intl.DateTimeFormatOptions> = {
  time: { hour: '2-digit', minute: '2-digit' },
  date: { day: '2-digit', month: '2-digit', year: 'numeric' },
  'date-short': { day: '2-digit', month: '2-digit' },
  datetime: { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' },
};

/**
 * Client-only date renderer that prevents Hydration Mismatch.
 *
 * Problem: Server renders dates in UTC (Docker TZ), client renders in MSK (UTC+3).
 * Solution: Render a non-breaking space on server, format only after mount in useEffect.
 * The <time> element with dateTime attribute preserves SEO semantics.
 */
export function ClientDate({ date, format = 'datetime', className }: Props) {
  const [formatted, setFormatted] = useState<string>('\u00A0');

  useEffect(() => {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      setFormatted('—');
      return;
    }
    setFormatted(d.toLocaleString('ru-RU', FORMAT_OPTIONS[format]));
  }, [date, format]);

  const isoDate = (() => {
    try { return new Date(date).toISOString(); } catch { return undefined; }
  })();

  return (
    <time
      dateTime={isoDate}
      className={className}
      suppressHydrationWarning
    >
      {formatted}
    </time>
  );
}
