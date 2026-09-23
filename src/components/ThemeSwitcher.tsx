'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

interface ThemeSwitcherProps {
  variant?: 'full' | 'toggle' | 'pill';
  className?: string;
}

export function ThemeSwitcher({ variant = 'full', className = '' }: ThemeSwitcherProps) {
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    if (variant === 'toggle') {
      return (
        <div className={`w-8 h-8 rounded-xl bg-muted/50 ${className}`} />
      );
    }
    return null;
  }

  const currentTheme = theme || 'light';
  const isDark = resolvedTheme === 'dark' || currentTheme.includes('dark') || currentTheme === 'dark';
  const currentAccent = currentTheme.includes('emerald')
    ? 'emerald'
    : currentTheme.includes('violet')
    ? 'violet'
    : currentTheme.includes('warm')
    ? 'warm'
    : currentTheme.includes('telegram')
    ? 'telegram'
    : 'sky';

  const toggleTheme = () => {
    if (isDark) {
      setTheme(currentTheme.includes('-') ? `${currentAccent}-light` : 'light');
    } else {
      setTheme(currentTheme.includes('-') ? `${currentAccent}-dark` : 'dark');
    }
  };

  const setMode = (mode: 'light' | 'dark') => {
    setTheme(currentTheme.includes('-') ? `${currentAccent}-${mode}` : mode);
  };

  const setAccent = (accent: 'sky' | 'emerald' | 'violet' | 'warm' | 'telegram') => {
    const mode = isDark ? 'dark' : 'light';
    setTheme(`${accent}-${mode}`);
  };

  if (variant === 'toggle') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200 cursor-pointer active:scale-95 ${className}`}
        title={isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
        aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
      >
        {isDark ? <Sun className="w-4 h-4 text-warning" /> : <Moon className="w-4 h-4" />}
      </button>
    );
  }

  const accents: Array<{ name: 'sky' | 'emerald' | 'violet' | 'warm' | 'telegram'; label: string; colorClass: string }> = [
    { name: 'sky', label: 'Sky Blue', colorClass: 'bg-primary' },
    { name: 'emerald', label: 'Emerald Green', colorClass: 'bg-success' },
    { name: 'violet', label: 'Violet', colorClass: 'bg-info' },
    { name: 'warm', label: 'Warm Amber', colorClass: 'bg-warning' },
    { name: 'telegram', label: 'Telegram Blue', colorClass: 'bg-brand-telegram' },
  ];

  return (
    <div
      className={`flex items-center gap-2.5 bg-card/85 backdrop-blur-md border border-border/50 p-2 rounded-full shadow-lg select-none w-fit mx-auto transition-all duration-200 hover:shadow-xl hover:border-border ${className}`}
    >
      <div className="flex gap-1 items-center bg-muted/50 p-1 rounded-full shrink-0">
        <button
          type="button"
          onClick={() => setMode('light')}
          className={`p-1.5 rounded-full transition-colors cursor-pointer ${
            !isDark
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Светлая тема"
          aria-label="Светлая тема"
        >
          <Sun className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setMode('dark')}
          className={`p-1.5 rounded-full transition-colors cursor-pointer ${
            isDark
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Тёмная тема"
          aria-label="Тёмная тема"
        >
          <Moon className="w-4 h-4" />
        </button>
      </div>

      <div className="w-[1px] h-6 bg-border/50 shrink-0" />

      <div className="flex gap-2 pr-1 shrink-0">
        {accents.map((t) => (
          <button
            key={t.name}
            type="button"
            onClick={() => setAccent(t.name)}
            className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${t.colorClass} ${
              currentAccent === t.name
                ? 'scale-125 ring-2 ring-offset-2 ring-primary'
                : 'hover:scale-110 opacity-70 hover:opacity-100'
            }`}
            title={`Цветовой акцент: ${t.label}`}
            aria-label={`Цветовой акцент: ${t.label}`}
          />
        ))}
      </div>
    </div>
  );
}
