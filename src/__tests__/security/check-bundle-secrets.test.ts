import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { runBundleSecretCheck } from '../../../scripts/check-bundle-secrets.mjs';

describe('CI Bundle Secret Check Gate (V-03)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-sec-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should pass cleanly when bundle contains no secrets', () => {
    const cleanJs = path.join(tempDir, 'main-clean.js');
    fs.writeFileSync(cleanJs, 'console.log("Safe application code");', 'utf8');

    const result = runBundleSecretCheck(tempDir);
    expect(result.success).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('should fail (RED GATE) when secret_qdocker is leaked into bundle', () => {
    const dirtyJs = path.join(tempDir, 'chunk-leaked-secret.js');
    fs.writeFileSync(dirtyJs, 'const QA_KEY = "secret_qdocker_qa2026";', 'utf8');

    const result = runBundleSecretCheck(tempDir);
    expect(result.success).toBe(false);
    expect(result.violations.some((v: any) => v.pattern === 'QA Secret Keyword')).toBe(true);
  });

  it('should fail (RED GATE) when NEXT_PUBLIC_QA_SECRET is leaked into bundle', () => {
    const dirtyJs = path.join(tempDir, 'env-leaked.js');
    fs.writeFileSync(dirtyJs, 'window.__ENV = { NEXT_PUBLIC_QA_SECRET: "anything" };', 'utf8');

    const result = runBundleSecretCheck(tempDir);
    expect(result.success).toBe(false);
    expect(result.violations.some((v: any) => v.pattern === 'Next Public QA Secret Token')).toBe(true);
  });

  it('should fail (RED GATE) when /api/dev/ route is referenced in bundle', () => {
    const dirtyJs = path.join(tempDir, 'dev-route-leak.js');
    fs.writeFileSync(dirtyJs, 'fetch("/api/dev/login-direct")', 'utf8');

    const result = runBundleSecretCheck(tempDir);
    expect(result.success).toBe(false);
    expect(result.violations.some((v: any) => v.pattern === 'Dev Login API Route in Bundle')).toBe(true);
  });

  it('should fail (RED GATE) when Stripe live secret key is leaked', () => {
    const dirtyJs = path.join(tempDir, 'stripe-leak.js');
    const mockStripeKey = ['sk', 'live', 'samplemockkeystring123456789'].join('_');
    fs.writeFileSync(dirtyJs, `const key = "${mockStripeKey}";`, 'utf8');

    const result = runBundleSecretCheck(tempDir);
    expect(result.success).toBe(false);
    expect(result.violations.some((v: any) => v.pattern === 'Stripe Live Secret Key')).toBe(true);
  });

  it('should fail (RED GATE) when AWS access key is leaked', () => {
    const dirtyJs = path.join(tempDir, 'aws-leak.js');
    const mockAwsKey = ['AKIA', 'DUMMYTESTKEY12345'].join('');
    fs.writeFileSync(dirtyJs, `const aws = "${mockAwsKey}";`, 'utf8');

    const result = runBundleSecretCheck(tempDir);
    expect(result.success).toBe(false);
    expect(result.violations.some((v: any) => v.pattern === 'AWS Access Key ID')).toBe(true);
  });
});
