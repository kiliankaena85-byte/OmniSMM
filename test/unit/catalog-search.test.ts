import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockServiceDb = { findMany: vi.fn() };
  const mockProviderDb = { findMany: vi.fn() };
  const mockNetworkDb = { findMany: vi.fn() };
  return { mockServiceDb, mockProviderDb, mockNetworkDb };
});

vi.mock('@/lib/db', () => ({
  db: {
    service: mocks.mockServiceDb,
    provider: mocks.mockProviderDb,
    network: mocks.mockNetworkDb,
  },
}));

import { adminCatalogService } from '@/services/admin/catalog.service';

describe('Catalog Intelligent Search (5-Vector Auto-recognition)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockServiceDb.findMany.mockResolvedValue([]);
    mocks.mockProviderDb.findMany.mockResolvedValue([]);
    mocks.mockNetworkDb.findMany.mockResolvedValue([]);
  });

  it('No search param: returns base list without OR clauses', async () => {
    await adminCatalogService.listServices({});

    expect(mocks.mockServiceDb.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    );
  });

  it('Numeric search (e.g. "123"): matches numeric ID, name contains, and external ID', async () => {
    await adminCatalogService.listServices({ search: '123' });

    expect(mocks.mockServiceDb.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { numericId: 123 },
            { name: { contains: '123', mode: 'insensitive' } },
            { externalId: '123' },
            { externalId: '123' },
          ],
        },
      })
    );
  });

  it('Text search (e.g. "likes"): matches name contains and external ID', async () => {
    await adminCatalogService.listServices({ search: 'likes' });

    expect(mocks.mockServiceDb.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: 'likes', mode: 'insensitive' } },
            { externalId: 'likes' },
          ],
        },
      })
    );
  });

  it('Provider recognition: matches provider name or ID', async () => {
    mocks.mockProviderDb.findMany.mockResolvedValue([
      { id: 'p-1', name: 'JustAnotherSMM' },
      { id: 'p-2', name: 'SuperSMM' },
    ]);

    await adminCatalogService.listServices({ search: 'supersmm' });

    expect(mocks.mockProviderDb.findMany).toHaveBeenCalled();
    expect(mocks.mockServiceDb.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: 'supersmm', mode: 'insensitive' } },
            { externalId: 'supersmm' },
            { providerId: 'p-2' },
          ],
        },
      })
    );
  });

  it('Social network recognition: matches network slug', async () => {
    mocks.mockNetworkDb.findMany.mockResolvedValue([
      { id: 'net-tg', slug: 'telegram' },
      { id: 'net-vk', slug: 'vkontakte' },
    ]);

    await adminCatalogService.listServices({ search: 'telegram' });

    expect(mocks.mockNetworkDb.findMany).toHaveBeenCalled();
    expect(mocks.mockServiceDb.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: 'telegram', mode: 'insensitive' } },
            { externalId: 'telegram' },
            { category: { networkId: 'net-tg' } },
          ],
        },
      })
    );
  });
});
