/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Provider API Key Encryption at Rest (AES-256-GCM).
 */

import { VaultService } from '@/lib/vault';

/**
 * Encrypts provider API key using AES-256-GCM via VaultService.
 * Format: iv:authTag:cipherHex
 */
export function encryptProviderSecret(plainSecret: string): string {
  if (!plainSecret || typeof plainSecret !== 'string' || !plainSecret.trim()) {
    throw new Error('[ProviderSecrets] plainSecret must be a non-empty string');
  }
  return VaultService.encrypt(plainSecret.trim());
}

/**
 * Decrypts provider API key from AES-256-GCM via VaultService.
 * Strictly throws on invalid payload or decryption failure.
 */
export function decryptProviderSecret(cipherText: string): string {
  if (!cipherText || typeof cipherText !== 'string' || !cipherText.trim()) {
    throw new Error('[ProviderSecrets] cipherText must be a non-empty string');
  }
  return VaultService.decrypt(cipherText);
}

/**
 * Masks provider API key for safe UI and logs display.
 */
export function maskProviderKey(key: string): string {
  try {
    if (!key || typeof key !== 'string' || key.length < 8) return '••••••••';
    const clean = key.includes(':') ? decryptProviderSecret(key) : key;
    if (clean.length <= 8) return '••••••••';
    return `••••••••${clean.slice(-4)}`;
  } catch {
    return '••••••••';
  }
}
