import { describe, it, expect } from 'vitest';
import { redactSensitiveTokens, sanitizeLogObject, SENSITIVE_PATTERNS } from '@/lib/logger/sensitive-data-filter';

describe('Sensitive Data Filter Suite (P3-25)', () => {
  it('exposes extensible SENSITIVE_PATTERNS array', () => {
    expect(Array.isArray(SENSITIVE_PATTERNS)).toBe(true);
    expect(SENSITIVE_PATTERNS.length).toBeGreaterThanOrEqual(8);
  });

  it('redacts passwords in database connection URIs', () => {
    const raw = 'Connecting to postgresql://admin:superSecretPassword123@db.internal:5432/main';
    const redacted = redactSensitiveTokens(raw);
    expect(redacted).toBe('Connecting to postgresql://admin:*****@db.internal:5432/main');
  });

  it('redacts mongodb+srv, mysql, mariadb, amqp, clickhouse and custom scheme connection strings', () => {
    const mongoRaw = 'Connecting to mongodb+srv://clusterUser:myP%40ssw%40rd123@cluster0.mongodb.net/test';
    expect(redactSensitiveTokens(mongoRaw)).toBe('Connecting to mongodb+srv://clusterUser:*****@cluster0.mongodb.net/test');

    const mysqlRaw = 'mysql://user:pass123@mysql.internal:3306/app';
    expect(redactSensitiveTokens(mysqlRaw)).toBe('mysql://user:*****@mysql.internal:3306/app');

    const clickhouseRaw = 'clickhouse://ch_user:secretPass@ch.internal:8123/default';
    expect(redactSensitiveTokens(clickhouseRaw)).toBe('clickhouse://ch_user:*****@ch.internal:8123/default');

    const customSchemeRaw = 'mycustomscheme://opUser:secretToken@custom.internal:9000';
    expect(redactSensitiveTokens(customSchemeRaw)).toBe('mycustomscheme://opUser:*****@custom.internal:9000');
  });

  it('redacts scheme-less URLs and passwords containing %40 or literal @', () => {
    const schemeless = 'Connecting to admin:pass%40word123@db.internal:5432/db';
    expect(redactSensitiveTokens(schemeless)).toBe('Connecting to admin:*****@db.internal:5432/db');

    const schemelessAt = 'Connecting to admin:p@ss@word!123@db.internal:5432/db';
    expect(redactSensitiveTokens(schemelessAt)).toBe('Connecting to admin:*****@db.internal:5432/db');

    const mongoLiteralAt = 'Connecting to mongodb+srv://admin:p@ssword@cluster.net/db';
    expect(redactSensitiveTokens(mongoLiteralAt)).toBe('Connecting to mongodb+srv://admin:*****@cluster.net/db');

    const mongoMultiAt = 'Connecting to mongodb+srv://admin:p@ss@word!123@cluster.net/db?authSource=admin';
    expect(redactSensitiveTokens(mongoMultiAt)).toBe('Connecting to mongodb+srv://admin:*****@cluster.net/db?authSource=admin');

    const httpAt = 'Connecting to http://proxyUser:myP@ssword@proxy.internal:8080/v1';
    expect(redactSensitiveTokens(httpAt)).toBe('Connecting to http://proxyUser:*****@proxy.internal:8080/v1');
  });

  it('redacts unquoted password key-value parameters', () => {
    const unquoted1 = 'user_event password=superSecretPassword123 status=ok';
    expect(redactSensitiveTokens(unquoted1)).toBe('user_event password="[REDACTED]" status=ok');

    const unquoted2 = 'config password: mySecretPass123';
    expect(redactSensitiveTokens(unquoted2)).toBe('config password: "[REDACTED]"');
  });

  it('redacts Redis connection credentials', () => {
    const raw = 'Connecting to redis://default:secretAuthToken@redis.internal:6379';
    const redacted = redactSensitiveTokens(raw);
    expect(redacted).toBe('Connecting to redis://default:*****@redis.internal:6379');
  });

  it('redacts bearer tokens and API keys in JSON and strings', () => {
    const raw = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token12345';
    const redacted = redactSensitiveTokens(raw);
    expect(redacted).toContain('Bearer "[REDACTED]"');
  });

  it('sanitizes nested log objects cleanly', () => {
    const obj = {
      message: 'User login attempt',
      password: 'MySecretPassword!',
      apiKey: 'sec_12345678901234567890',
      safeField: 'hello',
    };

    const sanitized = sanitizeLogObject(obj);
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.apiKey).toBe('[REDACTED]');
    expect(sanitized.safeField).toBe('hello');
  });
});
