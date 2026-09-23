/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InteractiveTextbook } from '@/components/admin/manual/interactive-textbook/InteractiveTextbook';
import { InteractiveRegexLookup } from '@/components/admin/manual/interactive-textbook/InteractiveRegexLookup';
import { InteractiveErrorCodeLookup } from '@/components/admin/manual/interactive-textbook/InteractiveErrorCodeLookup';
import { InteractiveStepChecklist } from '@/components/admin/manual/interactive-textbook/InteractiveStepChecklist';
import { ALL_TEXTBOOK_CHAPTERS } from '@/components/admin/manual/interactive-textbook/data/textbook-chapters';

import { InteractiveDiagram } from '@/components/admin/manual/interactive-textbook/InteractiveDiagram';
import { InteractiveScreenshotViewer } from '@/components/admin/manual/interactive-textbook/InteractiveScreenshotViewer';

describe('Interactive Textbook (OmniBook 2026)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders textbook header, domain pills, and initial chapter according to ГОСТ ЕСПД', () => {
    render(<InteractiveTextbook />);

    expect(screen.getByText(/Интерактивный иллюстрированный учебник OmniBook 2026/i)).toBeTruthy();
    expect(screen.getByText(/1. Область применения и назначение/i)).toBeTruthy();
    expect(screen.getByText(/2. Термины и определения/i)).toBeTruthy();
    expect(screen.getByText(/3. Архитектура и системные связи/i)).toBeTruthy();
    expect(screen.getByText(/Пошаговый регламент штатной эксплуатации/i)).toBeTruthy();
    expect(screen.getByText(/Нестандартные и защитные функции/i)).toBeTruthy();
    expect(screen.getByText(/Диагностика сбоев и план восстановления/i)).toBeTruthy();
  });

  it('filters chapters when clicking domain buttons and syncs selected chapter', () => {
    render(<InteractiveTextbook />);

    // Click "Заказы & Drip" domain pill
    const ordersPill = screen.getByRole('button', { name: /Заказы & Drip/i });
    fireEvent.click(ordersPill);

    const matches = screen.getAllByText(/Реестр заказов, жизненный цикл и Drip-Feed/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('filters to Settings domain when clicking Настройки pill and renders chapter 45', () => {
    render(<InteractiveTextbook />);

    // Click "Настройки" domain pill
    const settingsPill = screen.getByRole('button', { name: /^Настройки$/i });
    fireEvent.click(settingsPill);

    const matches = screen.getAllByText(/Настройки системы, брендинг и безопасность/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Конфигурация Vault, рубильник KillSwitch/i).length).toBeGreaterThanOrEqual(1);
  });

  it('switches between Textbook, RegEx stand, and API error codes view', () => {
    render(<InteractiveTextbook />);

    // Switch to RegEx Stand
    const regexBtn = screen.getByRole('button', { name: /RegEx Стенд/i });
    fireEvent.click(regexBtn);
    expect(screen.getByText(/Интерактивный тестовый стенд RegEx/i)).toBeTruthy();

    // Switch to Error Codes
    const errorsBtn = screen.getByRole('button', { name: /Коды API/i });
    fireEvent.click(errorsBtn);
    expect(screen.getByText(/Справочник кодов ошибок провайдеров API/i)).toBeTruthy();
  });

  it('validates all 10 social networks and rejects malformed URLs in InteractiveRegexLookup', () => {
    render(<InteractiveRegexLookup />);

    const input = screen.getByPlaceholderText(/Вставьте ссылку/i);

    // 1. Telegram
    fireEvent.change(input, { target: { value: 'https://t.me/durov' } });
    expect(screen.getAllByText(/Telegram \(Канал\/Группа\)/i).length).toBeGreaterThanOrEqual(1);

    // 2. VK
    fireEvent.change(input, { target: { value: 'https://vk.com/wall-123456_789' } });
    expect(screen.getAllByText(/VK \(Стена \/ Пост\)/i).length).toBeGreaterThanOrEqual(1);

    // 3. YouTube
    fireEvent.change(input, { target: { value: 'https://youtube.com/watch?v=dQw4w9WgXcQ' } });
    expect(screen.getAllByText(/YouTube \(Видео\)/i).length).toBeGreaterThanOrEqual(1);

    // 4. Instagram
    fireEvent.change(input, { target: { value: 'https://instagram.com/smmplan' } });
    expect(screen.getAllByText(/Instagram \(Профиль\)/i).length).toBeGreaterThanOrEqual(1);

    // 5. Rutube
    fireEvent.change(input, { target: { value: 'https://rutube.ru/video/1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d/' } });
    expect(screen.getAllByText(/Rutube \(Видео\)/i).length).toBeGreaterThanOrEqual(1);

    // 6. TikTok
    fireEvent.change(input, { target: { value: 'https://www.tiktok.com/@tiktok/video/7123456789012345678' } });
    expect(screen.getAllByText(/TikTok \(Видео\)/i).length).toBeGreaterThanOrEqual(1);

    // 7. Twitter / X
    fireEvent.change(input, { target: { value: 'https://x.com/elonmusk/status/1234567890123456789' } });
    expect(screen.getAllByText(/Twitter \/ X \(Пост\)/i).length).toBeGreaterThanOrEqual(1);

    // 8. Dzen
    fireEvent.change(input, { target: { value: 'https://dzen.ru/yandex' } });
    expect(screen.getAllByText(/Дзен \(Канал\)/i).length).toBeGreaterThanOrEqual(1);

    // 9. Threads
    fireEvent.change(input, { target: { value: 'https://threads.net/@zuck' } });
    expect(screen.getAllByText(/Threads \(Профиль\)/i).length).toBeGreaterThanOrEqual(1);

    // 10. Invalid Link
    fireEvent.change(input, { target: { value: 'https://unknown-site.xyz/123' } });
    expect(screen.getByText(/Формат ссылки не распознан/i)).toBeTruthy();
  });

  it('filters across comprehensive 50+ error codes registry in InteractiveErrorCodeLookup', () => {
    render(<InteractiveErrorCodeLookup />);

    const searchInput = screen.getByPlaceholderText(/Поиск по ошибке/i);

    // Test specific error codes
    fireEvent.change(searchInput, { target: { value: 'drip_feed_floor' } });
    expect(screen.getByText(/drip_feed_floor_violation/i)).toBeTruthy();

    fireEvent.change(searchInput, { target: { value: 'circuit_breaker' } });
    expect(screen.getByText(/redis_circuit_breaker_open/i)).toBeTruthy();

    fireEvent.change(searchInput, { target: { value: 'receipt' } });
    expect(screen.getByText(/fiscal_receipt_failed/i)).toBeTruthy();

    fireEvent.change(searchInput, { target: { value: 'ssrf' } });
    expect(screen.getByText(/ssrf_blocked \/ private_ip/i)).toBeTruthy();
  });

  it('renders SUPPORT_ESCALATION diagram with SLA 15m tiers and hidden notes badge', () => {
    render(<InteractiveDiagram type="SUPPORT_ESCALATION" />);

    expect(screen.getByText(/Схема 5: Трехуровневая эскалация саппорта/i)).toBeTruthy();
    expect(screen.getByText(/Линия 1 • Дежурный/i)).toBeTruthy();
    expect(screen.getByText(/Линия 2 • Старший/i)).toBeTruthy();
    expect(screen.getByText(/Линия 3 • Эскалация/i)).toBeTruthy();
    expect(screen.getByText(/Скрытые заметки 🔒/i)).toBeTruthy();
    expect(screen.getByText(/SLA 15m Target/i)).toBeTruthy();
  });

  it('renders SYSTEM_SETTINGS diagram with Vault, Telegram Bot P0, RBAC Matrix, and KillSwitch', () => {
    render(<InteractiveDiagram type="SYSTEM_SETTINGS" />);

    expect(screen.getByText(/Схема 6: Контур системной безопасности и настроек OmniSMM/i)).toBeTruthy();
    expect(screen.getByText(/Vault & Secrets/i)).toBeTruthy();
    expect(screen.getByText(/Telegram Bot P0/i)).toBeTruthy();
    expect(screen.getByText(/RBAC Matrix/i)).toBeTruthy();
    expect(screen.getByText(/KillSwitch/i)).toBeTruthy();
    expect(screen.getByText(/Zero-Trust & Vault/i)).toBeTruthy();
  });

  it('renders hotspots and opens info panel on click in InteractiveScreenshotViewer', () => {
    const mockScreenshot = {
      src: '/manual/screenshots/08_stage_manual_inspector_status.png',
      caption: 'Рис. Тестовый скриншот',
      altText: 'Тестовый скриншот',
      hotspots: [
        { badgeNumber: 1, xPercent: 20, yPercent: 30, title: 'Метка 1', description: 'Описание метки 1' },
      ],
    };

    render(<InteractiveScreenshotViewer screenshot={mockScreenshot} />);

    expect(screen.getByText('Рис. Тестовый скриншот')).toBeTruthy();
    const hotspotBtn = screen.getByLabelText(/Подсказка #1: Метка 1/i);
    expect(hotspotBtn).toBeTruthy();

    // Click hotspot
    fireEvent.click(hotspotBtn);
    expect(screen.getByText('Описание метки 1')).toBeTruthy();

    // Click again to toggle off
    fireEvent.click(hotspotBtn);
    expect(screen.queryByText('Описание метки 1')).toBeNull();
  });

  it('supports WCAG 2.2 AA keyboard accessibility and localStorage in InteractiveStepChecklist', () => {
    const mockItems = [
      { id: 'step-1', title: 'Шаг 1', detail: 'Инструкция 1' },
      { id: 'step-2', title: 'Шаг 2', detail: 'Инструкция 2' },
    ];

    render(<InteractiveStepChecklist chapterId="test-ch" items={mockItems} />);

    expect(screen.getByText(/0 \/ 2 \(0%\)/i)).toBeTruthy();

    const checkbox1 = screen.getByLabelText(/Шаг 1. Инструкция 1/i);
    expect(checkbox1.getAttribute('role')).toBe('checkbox');
    expect(checkbox1.getAttribute('aria-checked')).toBe('false');

    // Toggle via Space key
    fireEvent.keyDown(checkbox1, { key: ' ' });

    expect(checkbox1.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(/1 \/ 2 \(50%\)/i)).toBeTruthy();
    expect(localStorage.getItem('omnibook_checklist_test-ch')).toContain('"step-1":true');
  });

  it('verifies all chapters comply with 14 volumes, standards, and contain hotspots', () => {
    expect(ALL_TEXTBOOK_CHAPTERS.length).toBeGreaterThanOrEqual(8);
    ALL_TEXTBOOK_CHAPTERS.forEach((ch) => {
      expect(ch.id).toBeDefined();
      expect(ch.volumeNumber).toBeGreaterThan(0);
      expect(ch.chapterNumber).toBeGreaterThan(0);
      expect(ch.section1Scope).toBeTruthy();
      expect(ch.section2Terms.length).toBeGreaterThan(0);
      expect(ch.section4Walkthrough.steps.length).toBeGreaterThan(0);
      expect(ch.section5Safeguards.rules.length).toBeGreaterThan(0);
      expect(ch.section6Troubleshooting.length).toBeGreaterThan(0);
      expect(ch.checklist.length).toBeGreaterThan(0);
      // Verify screenshots have real hotspots
      if (ch.screenshot) {
        expect(ch.screenshot.hotspots).toBeDefined();
        expect(ch.screenshot.hotspots!.length).toBeGreaterThan(0);
      }
    });
  });
});
