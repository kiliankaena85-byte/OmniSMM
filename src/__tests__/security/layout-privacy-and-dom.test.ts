import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Layout JSON-LD & DOM Privacy Invariants (P1-7)', () => {
  it('does not contain personal email infosokoloff in layout.tsx or emergency-email.ts', () => {
    const layoutContent = fs.readFileSync(path.join(process.cwd(), 'src/app/layout.tsx'), 'utf8');
    const emailContent = fs.readFileSync(path.join(process.cwd(), 'src/lib/emergency-email.ts'), 'utf8');

    expect(layoutContent.includes('infosokoloff')).toBe(false);
    expect(emailContent.includes('infosokoloff')).toBe(false);
  });

  it('does not render data-tenant attribute in root layout html or body', () => {
    const layoutContent = fs.readFileSync(path.join(process.cwd(), 'src/app/layout.tsx'), 'utf8');

    expect(layoutContent.includes('data-tenant={tenantId}')).toBe(false);
  });
});
