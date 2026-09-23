import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { updateProvider } from '../actions/admin/providers/crud';
import { providerService } from '../services/providers/provider.service';
import { VaultService } from '../lib/vault';

vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn((_section, _action, callback) =>
    callback({ id: 'test-admin-id', email: 'admin@smmplan.pro', role: 'SUPERADMIN' }),
  ),
  requireOwnerPermission: vi.fn((callback) =>
    callback({ id: 'test-admin-id', email: 'admin@smmplan.pro', role: 'SUPERADMIN' }),
  ),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: Function) => fn,
}));

const prisma = new PrismaClient();

describe('BLOCK 23: Zero-Downtime Dynamic API Key Hot-Reload (No Server Restart)', () => {
  let providerId = '';

  beforeEach(async () => {
    // 1. Create a provider with Initial API Key v1
    const p = await prisma.provider.create({
      data: {
        name: 'Dynamic Test Provider (Hot Reload)',
        apiUrl: 'https://dynamic-api.example.com/api/v2',
        apiKey: VaultService.encrypt('old_api_key_v1'),
        isActive: true,
        balanceCurrency: 'RUB',
      },
    });
    providerId = p.id;
  });

  afterEach(async () => {
    await prisma.provider.deleteMany({ where: { id: providerId } });
  });

  // --------------------------------------------------------------------------
  // 1. Verify Initial Decryption & Instance Creation
  // --------------------------------------------------------------------------
  it('Key Reload 1: Initial provider instance uses old key v1', async () => {
    const providerRecord = await prisma.provider.findUnique({ where: { id: providerId } });
    expect(providerRecord).toBeDefined();

    const instance = (await providerService.getProviderInstance(providerRecord!)) as unknown as { apiKey: string };
    expect(instance.apiKey).toBe('old_api_key_v1');
  });

  // --------------------------------------------------------------------------
  // 2. Hot-Reload: Admin changes API Key in UI -> Next request gets new key immediately!
  // --------------------------------------------------------------------------
  it('Key Reload 2: Updating API key takes effect instantly without server restart', async () => {
    // Admin saves new API key v2 via updateProvider Action
    const updateRes = await updateProvider(providerId, {
      name: 'Dynamic Test Provider (Hot Reload)',
      apiUrl: 'https://dynamic-api.example.com/api/v2',
      apiKey: 'fresh_new_live_api_key_v2', // Updated key!
      isActive: true,
      balanceCurrency: 'RUB',
    });

    expect(updateRes.success).toBe(true);

    // Fetch provider fresh from DB (as Order Processor does on every dispatch)
    const freshRecord = await prisma.provider.findUnique({ where: { id: providerId } });
    expect(freshRecord).toBeDefined();

    // Verify instance gets new key dynamically in 0ms!
    const newInstance = (await providerService.getProviderInstance(freshRecord!)) as unknown as { apiKey: string };
    expect(newInstance.apiKey).toBe('fresh_new_live_api_key_v2');
    expect(newInstance.apiKey).not.toBe('old_api_key_v1');
  });
});
