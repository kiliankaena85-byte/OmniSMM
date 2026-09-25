/**
 * @file zero-any-ratchet.test.ts
 * 🛡️ Unit test suite for the Zero-Any AST Ratchet Scanner and compile-time gate.
 */

import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import path from 'path';
import { ZeroAnyRatchetScanner } from '../../../scripts/lint-zero-any';

describe('🛡️ Zero-Any AST Ratchet Scanner & Prevention Gate', () => {
  const scanner = new ZeroAnyRatchetScanner();

  it('1. Correctly detects `any` type annotations via TypeScript Compiler API', () => {
    const dirtySnippet = `
      function test(arg: any): any {
        const val = arg as any;
        return val;
      }
    `;

    const sourceFile = ts.createSourceFile('test-dirty.ts', dirtySnippet, ts.ScriptTarget.Latest, true);
    const anyNodes: number[] = [];

    const visit = (node: ts.Node) => {
      if (node.kind === ts.SyntaxKind.AnyKeyword) {
        anyNodes.push(node.getStart());
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    // 3 occurrences: arg: any, ): any, as any
    expect(anyNodes.length).toBe(3);
  });

  it('2. Does NOT flag safe types (unknown, never, void, string, Record<string, unknown>)', () => {
    const cleanSnippet = `
      interface TestPayload {
        id: string;
        meta: Record<string, unknown>;
        handler: () => void;
      }

      function safeProcess(input: unknown): never {
        throw new Error('Fatal');
      }
    `;

    const sourceFile = ts.createSourceFile('test-clean.ts', cleanSnippet, ts.ScriptTarget.Latest, true);
    const anyNodes: number[] = [];

    const visit = (node: ts.Node) => {
      if (node.kind === ts.SyntaxKind.AnyKeyword) {
        anyNodes.push(node.getStart());
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    expect(anyNodes.length).toBe(0);
  });

  it('3. Verifies that multitenant-e2e-matrix.test.ts is strictly Zero-Any compliant', () => {
    const filePath = path.resolve(__dirname, '../multitenant-e2e-matrix.test.ts');
    const { occurrences, count } = scanner.scanFile(filePath);

    expect(count).toBe(0);
    expect(occurrences).toEqual([]);
  });

  it('4. Verifies that true-multitenancy-full-isolation.test.ts is strictly Zero-Any compliant', () => {
    const filePath = path.resolve(__dirname, 'true-multitenancy-full-isolation.test.ts');
    const { occurrences, count } = scanner.scanFile(filePath);

    expect(count).toBe(0);
    expect(occurrences).toEqual([]);
  });

  it('5. Whole codebase scan respects the baseline ratchet without new violations', () => {
    const { report } = scanner.runScan('src');
    expect(report.passed).toBe(true);
    expect(report.newViolations.length).toBe(0);
  });
});
