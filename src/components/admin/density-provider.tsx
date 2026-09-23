'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type TableDensity = 'compact' | 'comfortable';

interface DensityContextType {
  density: TableDensity;
  isCompact: boolean;
  setDensity: (density: TableDensity) => void;
  toggleDensity: () => void;
}

const DensityContext = createContext<DensityContextType | undefined>(undefined);

const STORAGE_KEY = 'admin_compact_density';

export function DensityProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensityState] = useState<TableDensity>('comfortable');
  const [mounted, setMounted] = useState(false);

  const applyDensityToDOM = useCallback((newDensity: TableDensity) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const isComp = newDensity === 'compact';
    
    root.setAttribute('data-density', newDensity);
    if (isComp) {
      root.classList.add('compact-density');
    } else {
      root.classList.remove('compact-density');
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const initialDensity: TableDensity = saved === 'true' || saved === 'compact' ? 'compact' : 'comfortable';
      setDensityState(initialDensity);
      applyDensityToDOM(initialDensity);
    } catch {
      // Ignore localStorage errors in restricted environments
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue !== null) {
        const next: TableDensity = e.newValue === 'true' || e.newValue === 'compact' ? 'compact' : 'comfortable';
        setDensityState(next);
        applyDensityToDOM(next);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [applyDensityToDOM]);

  const setDensity = useCallback((newDensity: TableDensity) => {
    setDensityState(newDensity);
    applyDensityToDOM(newDensity);
    try {
      localStorage.setItem(STORAGE_KEY, newDensity === 'compact' ? 'true' : 'false');
      document.cookie = `x_admin_density=${newDensity}; path=/; max-age=31536000; SameSite=Lax`;
      window.dispatchEvent(new CustomEvent('table-density-change', { detail: { density: newDensity } }));
    } catch {}
  }, [applyDensityToDOM]);

  const toggleDensity = useCallback(() => {
    const next = density === 'compact' ? 'comfortable' : 'compact';
    setDensity(next);
  }, [density, setDensity]);

  return (
    <DensityContext.Provider
      value={{
        density: mounted ? density : 'comfortable',
        isCompact: mounted && density === 'compact',
        setDensity,
        toggleDensity,
      }}
    >
      {children}
    </DensityContext.Provider>
  );
}

export function useDensity() {
  const ctx = useContext(DensityContext);
  if (!ctx) {
    return {
      density: 'comfortable' as TableDensity,
      isCompact: false,
      setDensity: () => {},
      toggleDensity: () => {},
    };
  }
  return ctx;
}
