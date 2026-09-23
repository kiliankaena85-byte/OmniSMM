import { describe, it, expect } from 'vitest';
import { SmartAnalyzerLogic } from '@/services/providers/smart-analyzer.logic';

describe('SmartAnalyzerLogic Golden Suite (TDD Wave 2)', () => {
  it('detects Telegram Views correctly', () => {
    const res = SmartAnalyzerLogic.detectSync(
      'Telegram Просмотры на пост [Быстрые] [Без списаний]',
      'Быстрый старт, высокое качество',
      'Telegram Views'
    );
    expect(res.platform).toBe('TELEGRAM');
    expect(res.category).toBe('VIEWS');
    expect(res.targetType).toBe('POST');
  });

  it('detects Telegram Subscribers with Warranty', () => {
    const res = SmartAnalyzerLogic.detectSync(
      'Telegram Подписчики на канал 30 дней гарантия ♻️ [RU]',
      'Подписчики для каналов и групп, гарантия 30 дней',
      'Telegram Subscribers'
    );
    expect(res.platform).toBe('TELEGRAM');
    expect(res.category).toBe('SUBSCRIBERS');
    expect(res.targetType).toBe('CHANNEL');
    expect(res.warranty).toBe(30);
    expect(res.geo).toBe('Россия');
  });

  it('detects Telegram Stars as CUSTOM targetType', () => {
    const res = SmartAnalyzerLogic.detectSync(
      'Telegram Stars ⭐ Звезды Телеграм [Мгновенно]',
      'Покупка звезд в Telegram',
      'Stars'
    );
    expect(res.platform).toBe('TELEGRAM');
    expect(res.category).toBe('STARS');
    expect(res.targetType).toBe('CUSTOM');
  });

  it('detects Telegram Boosts for Channels', () => {
    const res = SmartAnalyzerLogic.detectSync(
      'Telegram Бусты для канала [Level Boost] 30 Days',
      'Голоса для буста канала',
      'Boosts'
    );
    expect(res.platform).toBe('TELEGRAM');
    expect(res.category).toBe('BOOSTS');
    expect(res.targetType).toBe('CHANNEL');
  });

  it('detects VK Friends and Groups correctly', () => {
    const resFriends = SmartAnalyzerLogic.detectSync(
      'VK Добавить в друзья на профиль [Живые]',
      'Накрутка друзей ВКонтакте',
      'VK Friends'
    );
    expect(resFriends.platform).toBe('VK');
    expect(resFriends.category).toBe('FRIENDS');
    expect(resFriends.targetType).toBe('CHANNEL');

    const resGroups = SmartAnalyzerLogic.detectSync(
      'ВКонтакте Подписчики в группу / сообщество',
      'Вступления в группы',
      'VK Groups'
    );
    expect(resGroups.platform).toBe('VK');
    expect(resGroups.category).toBe('GROUPS');
    expect(resGroups.targetType).toBe('CHANNEL');
  });

  it('detects YouTube Views and Channel Subscribers', () => {
    const resViews = SmartAnalyzerLogic.detectSync(
      'YouTube Просмотры на видео [Удержание 2-5 мин]',
      'Качественные просмотры',
      'YouTube Views'
    );
    expect(resViews.platform).toBe('YOUTUBE');
    expect(resViews.category).toBe('VIEWS');
    expect(resViews.targetType).toBe('POST');

    const resSubs = SmartAnalyzerLogic.detectSync(
      'YouTube Подписчики на канал [Реальные]',
      'Подписчики YouTube',
      'YouTube Subscribers'
    );
    expect(resSubs.platform).toBe('YOUTUBE');
    expect(resSubs.category).toBe('SUBSCRIBERS');
    expect(resSubs.targetType).toBe('CHANNEL');
  });

  it('detects Custom Comments and Poll customDataTypes', () => {
    const resComments = SmartAnalyzerLogic.detectSync(
      'Telegram Свои комментарии (по списку заказчика)',
      'Текст каждого комментария с новой строки',
      'Comments'
    );
    expect(resComments.customDataType).toBe('TEXTAREA');

    const resPolls = SmartAnalyzerLogic.detectSync(
      'VK Опросы / Голосование (укажите номер ответа)',
      'Номер ответа в опросе',
      'Polls'
    );
    expect(resPolls.customDataType).toBe('NUMBER');
  });

  it('respects Strict No-Refill Negative Guard', () => {
    const res = SmartAnalyzerLogic.detectSync(
      'Instagram Followers [No Refill] [Non-Drop 0d refill]',
      'Услуга без гарантии и без восстановления',
      'Followers'
    );
    expect(res.warranty).toBe(0);
  });
});
