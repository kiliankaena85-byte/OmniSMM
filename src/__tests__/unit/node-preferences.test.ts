import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateNodePrefsSchema } from '@/actions/organic/contracts';

// RED PHASE: импорт ещё не существует
import { updateNodePreferencesAction } from '@/actions/organic/campaign';

vi.mock('@/lib/db', () => ({
  db: {
    dePinNode: {
      update: vi.fn().mockResolvedValue({
        id: 'tg_123',
        acceptsViewTasks: true,
        acceptsReactTasks: false,
        acceptsFollowTasks: false,
      }),
      upsert: vi.fn().mockResolvedValue({ id: 'tg_123' }),
    },
  },
}));

describe('UpdateNodePrefsSchema', () => {
  it('validates correctly with all fields', () => {
    const result = UpdateNodePrefsSchema.safeParse({
      nodeId: 'tg_123456',
      acceptsViewTasks: true,
      acceptsReactTasks: false,
      acceptsFollowTasks: false,
    });
    expect(result.success).toBe(true);
  });

  it('fails with short nodeId', () => {
    const result = UpdateNodePrefsSchema.safeParse({ nodeId: 'x' });
    expect(result.success).toBe(false);
  });

  it('allows partial update (only one flag)', () => {
    const result = UpdateNodePrefsSchema.safeParse({
      nodeId: 'tg_123456',
      acceptsFollowTasks: true,
    });
    expect(result.success).toBe(true);
  });
});

describe('updateNodePreferencesAction', () => {
  it('returns success on valid input', async () => {
    const result = await updateNodePreferencesAction({
      nodeId: 'tg_123456',
      acceptsReactTasks: false,
    });
    expect(result.success).toBe(true);
  });

  it('returns error on invalid nodeId', async () => {
    const result = await updateNodePreferencesAction({ nodeId: 'x' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
