import { describe, it, expect } from 'vitest';
import {
  getSocialLinkConfig,
  normalizeUserLink,
  detectMismatchedNetwork
} from '../social-link-placeholder';

describe('Universal Social Link Placeholder Engine', () => {
  it('should return VK group placeholder for VK subscribers', () => {
    const config = getSocialLinkConfig('vk', 'subscribers');
    expect(config.networkName).toBe('ВКонтакте');
    expect(config.badge).toBe('Группа / Паблик');
    expect(config.placeholder).toContain('vk.com/public');
  });

  it('should return VK Wall placeholder for VK likes/views', () => {
    const config = getSocialLinkConfig('vk', 'likes');
    expect(config.badge).toBe('Запись на стене');
    expect(config.placeholder).toContain('vk.com/wall-');
  });

  it('should return Telegram channel placeholder for TG subscribers', () => {
    const config = getSocialLinkConfig('telegram', 'subscribers');
    expect(config.networkName).toBe('Telegram');
    expect(config.badge).toBe('Канал Telegram');
    expect(config.placeholder).toContain('t.me/channel_name');
  });

  it('should return YouTube Shorts placeholder for YT shorts', () => {
    const config = getSocialLinkConfig('youtube', 'shorts');
    expect(config.networkName).toBe('YouTube');
    expect(config.badge).toBe('YouTube Shorts');
    expect(config.placeholder).toContain('youtube.com/shorts/');
  });

  it('should return Instagram Reels placeholder for IG reels', () => {
    const config = getSocialLinkConfig('instagram', 'reels');
    expect(config.networkName).toBe('Instagram');
    expect(config.badge).toBe('Instagram Reels');
    expect(config.placeholder).toContain('instagram.com/reel/');
  });

  it('should auto-normalize links without https://', () => {
    expect(normalizeUserLink('vk.com/club123456')).toBe('https://vk.com/club123456');
    expect(normalizeUserLink('t.me/durov')).toBe('https://t.me/durov');
    expect(normalizeUserLink('https://t.me/durov')).toBe('https://t.me/durov');
  });

  it('should detect cross-network mismatch (e.g. TG link for VK service)', () => {
    const mismatch = detectMismatchedNetwork('https://t.me/durov', 'vk');
    expect(mismatch.isMismatch).toBe(true);
    expect(mismatch.detectedNetworkName).toBe('Telegram');
    expect(mismatch.expectedNetworkName).toBe('ВКонтакте');
  });

  it('should not flag mismatch for valid target network', () => {
    const match = detectMismatchedNetwork('https://vk.com/public123456', 'vk');
    expect(match.isMismatch).toBe(false);
  });
});
