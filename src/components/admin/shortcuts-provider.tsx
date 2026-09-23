'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ShortcutsModal } from './shortcuts-modal';
import {
  DEFAULT_HOTKEYS,
  type HotkeyConfig,
  ShortcutsContext,
  useShortcuts,
} from './shortcuts-context';

export { DEFAULT_HOTKEYS, type HotkeyConfig, useShortcuts };

export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [hotkeysEnabled, setHotkeysEnabled] = useState(true);
  const [hotkeys, setHotkeys] = useState<HotkeyConfig[]>(DEFAULT_HOTKEYS);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [lastKey, setLastKey] = useState<{ key: string; time: number } | null>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const savedEnabled = localStorage.getItem('admin_hotkeys_enabled');
      if (savedEnabled !== null) {
        setHotkeysEnabled(savedEnabled === 'true');
      }
      const savedHotkeys = localStorage.getItem('admin_custom_hotkeys');
      if (savedHotkeys) {
        setHotkeys(JSON.parse(savedHotkeys));
      }
    } catch {}
  }, []);

  const saveHotkeys = (updated: HotkeyConfig[]) => {
    setHotkeys(updated);
    try {
      localStorage.setItem('admin_custom_hotkeys', JSON.stringify(updated));
    } catch {}
  };

  const updateHotkey = (id: string, newKeys: string[]) => {
    const updated = hotkeys.map((h) => (h.id === id ? { ...h, keys: newKeys } : h));
    saveHotkeys(updated);
  };

  const resetHotkeys = () => {
    saveHotkeys(DEFAULT_HOTKEYS);
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!hotkeysEnabled) return;

      // Ignore when typing inside form inputs
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isInput) return;

      const now = Date.now();
      
      // Normalize key using physical e.code (e.g., KeyG -> 'g') so Russian layout works 100% reliably
      const normalizedKey = e.code.startsWith('Key') 
        ? e.code.slice(3).toLowerCase() 
        : e.code === 'Slash' 
          ? '/' 
          : e.key.toLowerCase();

      // Check for single-key actions (Help '?' or Search '/')
      if (e.key === '?' || (e.shiftKey && e.code === 'Slash') || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsHelpOpen((prev) => !prev);
        return;
      }

      if (normalizedKey === '/' || e.code === 'Slash') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"][placeholder*="Поиск"]') as HTMLInputElement | null;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // Check two-key sequences (e.g., 'g' then 'o')
      if (lastKey && now - lastKey.time < 1200) {
        const sequence = [lastKey.key, normalizedKey];
        const match = hotkeys.find(
          (h) => h.keys.length === 2 && h.keys[0] === sequence[0] && h.keys[1] === sequence[1]
        );

        if (match && match.path) {
          e.preventDefault();
          router.push(match.path);
          setLastKey(null);
          return;
        }
      }

      // Record first key of potential sequence ('g' on QWERTY or 'п' on ЙЦУКЕН)
      if (normalizedKey === 'g') {
        setLastKey({ key: 'g', time: now });
      } else {
        setLastKey(null);
      }
    },
    [hotkeysEnabled, hotkeys, lastKey, router]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <ShortcutsContext.Provider
      value={{
        hotkeysEnabled,
        setHotkeysEnabled: (val) => {
          setHotkeysEnabled(val);
          try {
            localStorage.setItem('admin_hotkeys_enabled', String(val));
          } catch {}
        },
        hotkeys,
        updateHotkey,
        resetHotkeys,
        isHelpOpen,
        setIsHelpOpen,
      }}
    >
      {children}
      <ShortcutsModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </ShortcutsContext.Provider>
  );
}

