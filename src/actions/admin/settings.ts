'use server';

/**
 * Settings Actions Facade
 * Provides 100% backward-compatible exports for all system settings actions.
 * Concrete implementations are decomposed into domain-specific modules in './settings/'.
 * Next.js 'use server' requires every export to be an async function (no re-export syntax).
 */

import {
  updateUserRole as _updateUserRole,
  updateStaffGeminiApiKeyAction as _updateStaffGeminiApiKeyAction,
} from './settings/settings-role.action';

import {
  updateGlobalSettings as _updateGlobalSettings,
} from './settings/settings-update.action';

import {
  getMaskedPaymentSecrets as _getMaskedPaymentSecrets,
  generateInboundSecretAction as _generateInboundSecretAction,
} from './settings/settings-secrets.action';

import {
  testSmtpConnectionAction as _testSmtpConnectionAction,
  testGeminiAiConnectionAction as _testGeminiAiConnectionAction,
  testTelegramBotConnectionAction as _testTelegramBotConnectionAction,
  testYooKassaConnectionAction as _testYooKassaConnectionAction,
  testAlfaBankConnectionAction as _testAlfaBankConnectionAction,
  disconnectTelegramBotAction as _disconnectTelegramBotAction,
} from './settings/settings-diagnostics.action';

export async function updateUserRole(...args: Parameters<typeof _updateUserRole>) {
  return _updateUserRole(...args);
}

export async function updateStaffGeminiApiKeyAction(...args: Parameters<typeof _updateStaffGeminiApiKeyAction>) {
  return _updateStaffGeminiApiKeyAction(...args);
}

export async function updateGlobalSettings(...args: Parameters<typeof _updateGlobalSettings>) {
  return _updateGlobalSettings(...args);
}

export async function getMaskedPaymentSecrets(...args: Parameters<typeof _getMaskedPaymentSecrets>) {
  return _getMaskedPaymentSecrets(...args);
}

export async function generateInboundSecretAction(...args: Parameters<typeof _generateInboundSecretAction>) {
  return _generateInboundSecretAction(...args);
}

export async function testSmtpConnectionAction(...args: Parameters<typeof _testSmtpConnectionAction>) {
  return _testSmtpConnectionAction(...args);
}

export async function testGeminiAiConnectionAction(...args: Parameters<typeof _testGeminiAiConnectionAction>) {
  return _testGeminiAiConnectionAction(...args);
}

export async function testTelegramBotConnectionAction(...args: Parameters<typeof _testTelegramBotConnectionAction>) {
  return _testTelegramBotConnectionAction(...args);
}

export async function testYooKassaConnectionAction(...args: Parameters<typeof _testYooKassaConnectionAction>) {
  return _testYooKassaConnectionAction(...args);
}

export async function testAlfaBankConnectionAction(...args: Parameters<typeof _testAlfaBankConnectionAction>) {
  return _testAlfaBankConnectionAction(...args);
}

export async function disconnectTelegramBotAction(...args: Parameters<typeof _disconnectTelegramBotAction>) {
  return _disconnectTelegramBotAction(...args);
}
