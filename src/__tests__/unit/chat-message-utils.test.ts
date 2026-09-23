import { describe, it, expect } from 'vitest';
import {
  getAvatarGradient,
  getInitials,
  formatChatDateDivider,
  isDifferentChatDay,
} from '@/components/support/chat/messages/chat-message-utils';

describe('chat-message-utils (SPEC-2026-WAVE-9)', () => {
  it('deterministic gradient selection produces stable output for the same email', () => {
    const grad1 = getAvatarGradient('support@smmplan.pro');
    const grad2 = getAvatarGradient('support@smmplan.pro');
    expect(grad1).toBe(grad2);
    expect(grad1).toContain('from-');
  });

  it('generates correct initials for users, operators, and internal notes', () => {
    expect(getInitials('USER', 'john.doe@gmail.com')).toBe('JO');
    expect(getInitials('USER')).toBe('CL');
    expect(getInitials('INTERNAL')).toBe('🔒');
    expect(getInitials('STAFF')).toBe('OP');
  });

  it('formats date dividers for today, yesterday and past dates', () => {
    const now = new Date();
    expect(formatChatDateDivider(now)).toBe('Сегодня');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatChatDateDivider(yesterday)).toBe('Вчера');

    const past = new Date('2024-05-15T12:00:00Z');
    const formatted = formatChatDateDivider(past);
    expect(formatted).toContain('15');
    expect(formatted).toContain('2024');
  });

  it('detects day transitions between messages', () => {
    const day1 = new Date('2026-03-01T10:00:00Z');
    const day1Later = new Date('2026-03-01T18:00:00Z');
    const day2 = new Date('2026-03-02T09:00:00Z');

    expect(isDifferentChatDay(day1, day1Later)).toBe(false);
    expect(isDifferentChatDay(day1, day2)).toBe(true);
    expect(isDifferentChatDay(undefined, day2)).toBe(true);
  });
});
