'use client';
import { HeroUIProvider } from '@heroui/system';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <NextThemesProvider 
      nonce={nonce}
      attribute="class" 
      defaultTheme="light" 
      enableSystem={false}
      storageKey="smmplan-theme"
      disableTransitionOnChange={false}
      themes={[
        'light', 
        'dark', 
        'sky-light', 
        'sky-dark', 
        'emerald-light', 
        'emerald-dark', 
        'violet-light', 
        'violet-dark', 
        'warm-light', 
        'warm-dark', 
        'telegram-light', 
        'telegram-dark'
      ]}
      value={{
        'light': 'light',
        'dark': 'dark',
        'sky-light': 'sky-light',
        'sky-dark': 'sky-dark',
        'emerald-light': 'emerald-light',
        'emerald-dark': 'emerald-dark',
        'violet-light': 'violet-light',
        'violet-dark': 'violet-dark',
        'warm-light': 'warm-light',
        'warm-dark': 'warm-dark',
        'telegram-light': 'telegram-light',
        'telegram-dark': 'telegram-dark'
      }}
    >
      <HeroUIProvider>{children}</HeroUIProvider>
    </NextThemesProvider>
  );
}
