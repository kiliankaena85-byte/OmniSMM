import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  TenantThemeService, 
  THEME_PRESETS, 
  TenantThemeConfig,
  sanitizeColor
} from '@/services/tenant/tenant-theme.service';

describe('TenantThemeService - White-Label Design System', () => {
  beforeEach(() => {
    TenantThemeService.clearCache();
    vi.restoreAllMocks();
  });

  describe('Sanitization & Security', () => {
    it('allows valid hex colors (#123, #123456, #12345678)', () => {
      expect(sanitizeColor('#0369a1')).toBe('#0369a1');
      expect(sanitizeColor('#abc')).toBe('#abc');
      expect(sanitizeColor('#10b981aa')).toBe('#10b981aa');
    });

    it('allows valid rgba / rgb colors', () => {
      expect(sanitizeColor('rgba(16, 185, 129, 0.35)')).toBe('rgba(16, 185, 129, 0.35)');
      expect(sanitizeColor('rgb(255, 255, 255)')).toBe('rgb(255, 255, 255)');
    });

    it('rejects CSS injection attempts (url, expression, semicolons, brackets)', () => {
      expect(sanitizeColor('red; background: url(https://evil.com)')).toBeNull();
      expect(sanitizeColor('expression(alert(1))')).toBeNull();
      expect(sanitizeColor('}</style><script>alert(1)</script>')).toBeNull();
      expect(sanitizeColor('javascript:void(0)')).toBeNull();
    });
  });

  describe('Theme Presets', () => {
    it('has standard presets defined with all required tokens', () => {
      const presets = ['sky', 'violet', 'emerald', 'amber', 'rose', 'indigo', 'slate'] as const;
      
      for (const preset of presets) {
        const theme = THEME_PRESETS[preset];
        expect(theme).toBeDefined();
        expect(theme.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(theme.primaryForeground).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(theme.secondary).toBeDefined();
        expect(theme.secondaryForeground).toBeDefined();
        expect(theme.ring).toBeDefined();
        expect(theme.darkPrimary).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    it('defaults smmplan to sky and flux to violet', async () => {
      const smmplanTheme = await TenantThemeService.getTheme('smmplan');
      expect(smmplanTheme.preset).toBe('sky');
      expect(smmplanTheme.primaryColor).toBe(THEME_PRESETS.sky.primary);

      const fluxTheme = await TenantThemeService.getTheme('flux');
      expect(fluxTheme.preset).toBe('violet');
      expect(fluxTheme.primaryColor).toBe(THEME_PRESETS.violet.primary);
    });

    it('defaults unknown arbitrary tenant to safe preset', async () => {
      const brandTheme = await TenantThemeService.getTheme('alpha-brand');
      expect(brandTheme).toBeDefined();
      expect(brandTheme.primaryColor).toBeDefined();
    });
  });

  describe('CSS Variables Generation', () => {
    it('generates valid scoped CSS with root and dark mode overrides', () => {
      const config: TenantThemeConfig = {
        preset: 'emerald',
        primaryColor: '#047857',
        primaryForeground: '#ffffff',
        secondaryColor: '#d1fae5',
        secondaryForeground: '#047857',
        ringColor: '#a7f3d0',
        borderRadius: '1rem',
        darkPrimaryColor: '#10b981',
      };

      const css = TenantThemeService.generateCss(config, 'emerald-tenant');

      // Light mode / root tokens
      expect(css).toContain('--color-primary: #047857;');
      expect(css).toContain('--color-primary-foreground: #ffffff;');
      expect(css).toContain('--color-secondary: #d1fae5;');
      expect(css).toContain('--radius: 1rem;');

      // Dark mode tokens
      expect(css).toContain('--color-primary: #10b981;');
      expect(css).toContain('.dark');
    });

    it('sanitizes malicious colors in custom config before CSS generation', () => {
      const maliciousConfig: TenantThemeConfig = {
        preset: 'custom',
        primaryColor: 'red; } body { display:none } /*',
        borderRadius: '20px; alert(1)',
      };

      const css = TenantThemeService.generateCss(maliciousConfig, 'hacker-tenant');

      // Must NOT contain the raw injected CSS payload
      expect(css).not.toContain('body { display:none }');
      expect(css).not.toContain('alert(1)');
    });
  });
});
