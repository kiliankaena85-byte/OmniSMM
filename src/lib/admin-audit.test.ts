import { describe, test, expect } from 'vitest';
import { safeSerialize } from './admin-audit';

describe('safeSerialize', () => {
  test('should serialize simple object', () => {
    const obj = { a: 1, b: 'hello' };
    const res = safeSerialize(obj);
    expect(res).toBe(JSON.stringify(obj));
  });

  test('should handle BigInt successfully', () => {
    const obj = { a: BigInt(1), b: BigInt("1234567890123456789") };
    const res = safeSerialize(obj);
    const parsed = JSON.parse(res!);
    expect(parsed.a).toBe('1');
    expect(parsed.b).toBe('1234567890123456789');
  });

  test('should scrub sensitive keys recursively', () => {
    const obj = {
      user: 'admin',
      password: 'mypassword',
      nested: {
        token: 'mytoken',
        secret: 'mysecret',
        safeField: 'ok'
      }
    };
    const res = safeSerialize(obj);
    const parsed = JSON.parse(res!);
    expect(parsed.password).toBe('[SCRUBBED]');
    expect(parsed.nested.token).toBe('[SCRUBBED]');
    expect(parsed.nested.secret).toBe('[SCRUBBED]');
    expect(parsed.nested.safeField).toBe('ok');
  });

  test('should protect against circular references', () => {
    const obj: any = { name: 'circular' };
    obj.self = obj;
    const res = safeSerialize(obj);
    const parsed = JSON.parse(res!);
    expect(parsed.name).toBe('circular');
    expect(parsed.self).toBe('[Circular]');
  });
});
