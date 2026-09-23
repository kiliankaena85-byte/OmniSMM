import { describe, it, expect } from 'vitest';
import * as settingsFacade from '@/actions/admin/settings';

describe('Settings Actions Decomposition Contract', () => {
  it('should export all original action functions with identical names', () => {
    expect(typeof settingsFacade.updateUserRole).toBe('function');
    expect(typeof settingsFacade.updateStaffGeminiApiKeyAction).toBe('function');
    expect(typeof settingsFacade.updateGlobalSettings).toBe('function');
    expect(typeof settingsFacade.getMaskedPaymentSecrets).toBe('function');
    expect(typeof settingsFacade.testSmtpConnectionAction).toBe('function');
    expect(typeof settingsFacade.testGeminiAiConnectionAction).toBe('function');
    expect(typeof settingsFacade.testTelegramBotConnectionAction).toBe('function');
    expect(typeof settingsFacade.testYooKassaConnectionAction).toBe('function');
    expect(typeof settingsFacade.testAlfaBankConnectionAction).toBe('function');
    expect(typeof settingsFacade.disconnectTelegramBotAction).toBe('function');
  });
});
