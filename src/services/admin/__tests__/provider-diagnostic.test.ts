import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderDiagnosticService } from '../provider-diagnostic.service';

describe('ProviderDiagnosticService', () => {
  describe('sanitizeUrl', () => {
    it('strips trailing slashes correctly', () => {
      const res = ProviderDiagnosticService.sanitizeUrl('https://vexboost.ru/api/v2///');
      expect(res.cleanUrl).toBe('https://vexboost.ru/api/v2');
    });

    it('adds https:// if protocol is missing', () => {
      const res = ProviderDiagnosticService.sanitizeUrl('soc-proof.su/api/v2');
      expect(res.cleanUrl).toBe('https://soc-proof.su/api/v2');
    });

    it('suggests /api/v2 when bare domain is entered', () => {
      const res = ProviderDiagnosticService.sanitizeUrl('https://smmprime.com/');
      expect(res.cleanUrl).toBe('https://smmprime.com');
      expect(res.suggestedUrl).toBe('https://smmprime.com/api/v2');
    });

    it('handles empty input gracefully', () => {
      const res = ProviderDiagnosticService.sanitizeUrl('   ');
      expect(res.cleanUrl).toBe('');
    });
  });

  describe('sanitizeKey', () => {
    it('removes spaces and zero-width characters', () => {
      const dirtyKey = '  \u200B5jG8DOFkpi1302QMSrEnc46ViH558qamfsPScvoLD14w4f34yyVrogaoVtts \n ';
      const cleanKey = ProviderDiagnosticService.sanitizeKey(dirtyKey);
      expect(cleanKey).toBe('5jG8DOFkpi1302QMSrEnc46ViH558qamfsPScvoLD14w4f34yyVrogaoVtts');
    });
  });

  describe('translateError', () => {
    it('translates invalid API key to clear Russian advice', () => {
      const res = ProviderDiagnosticService.translateError(new Error('Invalid API key'), 'https://panel.com/api/v2');
      expect(res.message).toContain('Неверный API-ключ');
      expect(res.suggestedFix).toContain('настройках вашего аккаунта');
    });

    it('translates 404 with missing /api/v2 suggestion', () => {
      const res = ProviderDiagnosticService.translateError(new Error('404 Not Found'), 'https://panel.com');
      expect(res.message).toContain('404');
      expect(res.suggestedUrl).toBe('https://panel.com/api/v2');
    });

    it('translates timeout errors', () => {
      const res = ProviderDiagnosticService.translateError(new Error('ETIMEDOUT connection timeout'), 'https://panel.com/api/v2');
      expect(res.message).toContain('Таймаут');
    });

    it('translates Cloudflare / WAF 403 errors', () => {
      const res = ProviderDiagnosticService.translateError(new Error('403 Forbidden Cloudflare WAF'), 'https://panel.com/api/v2');
      expect(res.message).toContain('Cloudflare');
    });
  });
});
