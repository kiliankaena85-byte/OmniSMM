import { describe, it, expect } from 'vitest';
import { ErrorInterpreter } from '@/lib/telemetry/error-interpreter';

describe('ErrorInterpreter & Incident Translator Suite', () => {
  it('correctly translates Prisma & OpenSSL shared library errors into Database incident cards', () => {
    const rawError = 'Unable to require(`/app/node_modules/.prisma/client/libquery_engine-linux-musl.so.node`). Details: Error loading shared library libssl.so.1.1';
    const incident = ErrorInterpreter.interpret(rawError, 'CRITICAL');

    expect(incident.category).toBe('DATABASE');
    expect(incident.title).toContain('Сбой подключения к базе данных');
    expect(incident.whatHappened).toContain('базе данных');
    expect(incident.impactOnUsers).toContain('не видят каталог услуг');
    expect(incident.actionPlan).toContain('docker ps');
    expect(incident.severity).toBe('CRITICAL');
  });

  it('correctly translates YooKassa misconfigured webhook secrets into Actionable Config Warnings', () => {
    const rawError = 'MISCONFIGURED_WEBHOOK_SECRET: yookassa secret not set';
    const incident = ErrorInterpreter.interpret(rawError, 'WARNING');

    expect(incident.category).toBe('CONFIG');
    expect(incident.title).toContain('настройка вебхука ЮKassa');
    expect(incident.actionPlan).toContain('YOOKASSA_WEBHOOK_SECRET');
  });

  it('correctly translates SMM Provider insufficient balance into Provider warnings', () => {
    const rawError = 'Provider JustAnotherPanel returned code 402: Insufficient balance on account';
    const incident = ErrorInterpreter.interpret(rawError, 'WARNING');

    expect(incident.category).toBe('PROVIDER');
    expect(incident.title).toContain('Закончился баланс у поставщика');
    expect(incident.actionPlan).toContain('Пополните баланс');
  });

  it('correctly translates Cloudflare 502 Tunnel errors into Network incident cards', () => {
    const rawError = 'Cloudflare Tunnel 502 Bad Gateway: connection refused to 127.0.0.1:3000';
    const incident = ErrorInterpreter.interpret(rawError, 'CRITICAL');

    expect(incident.category).toBe('NETWORK');
    expect(incident.title).toContain('Сбой сетевого туннеля Cloudflare');
    expect(incident.actionPlan).toContain('start-tunnel.ps1');
  });

  it('suppresses / classifies dev RAG memory noise as INFO with zero user impact', () => {
    const rawError = 'Docker heracleum_rag_memory connection timeout on 8100/api/search';
    const incident = ErrorInterpreter.interpret(rawError, 'INFO');

    expect(incident.category).toBe('DEV_NOISE');
    expect(incident.impactOnUsers).toContain('Нулевое влияние');
    expect(incident.severity).toBe('INFO');
  });

  it('safely escapes special HTML characters in Telegram formatted cards', () => {
    const maliciousInput = '<script>alert("xss")</script> & "injection" > test';
    const formatted = ErrorInterpreter.formatTelegramMessage(maliciousInput, 'CRITICAL');

    expect(formatted).not.toContain('<script>');
    expect(formatted).toContain('&lt;script&gt;');
    expect(formatted).toContain('&amp;');
    expect(formatted).toContain('&gt;');
  });
});
