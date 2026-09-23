import { describe, it, expect, beforeEach } from 'vitest';

describe('Table Density System Architecture', () => {
  let mockStorage: Record<string, string> = {};
  let mockAttributes: Record<string, string> = {};
  let mockClasses: Set<string> = new Set();

  beforeEach(() => {
    mockStorage = {};
    mockAttributes = {};
    mockClasses = new Set();
  });

  function getSavedDensity(): 'compact' | 'comfortable' {
    const val = mockStorage['admin_compact_density'];
    return val === 'true' || val === 'compact' ? 'compact' : 'comfortable';
  }

  function applyDensity(density: 'compact' | 'comfortable') {
    mockStorage['admin_compact_density'] = density === 'compact' ? 'true' : 'false';
    mockAttributes['data-density'] = density;
    if (density === 'compact') {
      mockClasses.add('compact-density');
    } else {
      mockClasses.delete('compact-density');
    }
  }

  it('should initialize with comfortable density by default when no storage exists', () => {
    const density = getSavedDensity();
    expect(density).toBe('comfortable');
  });

  it('should apply data-density="compact" and compact-density class when enabled', () => {
    applyDensity('compact');
    expect(mockStorage['admin_compact_density']).toBe('true');
    expect(mockAttributes['data-density']).toBe('compact');
    expect(mockClasses.has('compact-density')).toBe(true);
  });

  it('should remove compact-density class and set comfortable density when toggled off', () => {
    applyDensity('compact');
    expect(mockClasses.has('compact-density')).toBe(true);

    // Toggle off
    applyDensity('comfortable');
    expect(mockStorage['admin_compact_density']).toBe('false');
    expect(mockAttributes['data-density']).toBe('comfortable');
    expect(mockClasses.has('compact-density')).toBe(false);
  });
});
