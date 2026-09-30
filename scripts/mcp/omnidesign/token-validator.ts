/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * OmniDesign MCP Hub — Token Validator (Obsidian Slate & Cobalt Matrix).
 */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { TokenViolation, ValidateDesignTokensResult } from './types';

interface PatternRule {
  pattern: RegExp;
  reason: string;
  replacement: string;
  isNeon?: boolean;
}

const DESIGN_RULES: PatternRule[] = [
  { pattern: /from-purple-600\s+via-fuchsia-600\s+to-pink-600/, reason: 'Acid-neon generic slop gradient', replacement: 'bg-[#0B0E14] or bg-background with border-border/40', isNeon: true },
  { pattern: /\b(from|via|to)-(fuchsia|pink|purple)-(400|500|600|700)\b/, reason: 'Acid-neon magenta/fuchsia token violation', replacement: 'primary or cobalt matrix token (e.g. bg-primary/10)', isNeon: true },
  { pattern: /shadow-\[0_0_\d+px_rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)\]/, reason: 'Aggressive neon glow anti-pattern', replacement: 'subtle border (border-border/40) or shadow-sm' },
  { pattern: /\bbg-black\b/, reason: 'Raw black background', replacement: 'bg-background or bg-[#0B0E14]' },
  { pattern: /\bbg-white\b/, reason: 'Raw white background', replacement: 'bg-card or bg-background' },
  { pattern: /\btext-black\b/, reason: 'Raw black text', replacement: 'text-foreground' },
  { pattern: /\btext-white\b/, reason: 'Raw white text', replacement: 'text-foreground or text-primary-foreground' },
  { pattern: /\b(bg|text|border)-(blue|red|green|gray|slate|zinc|fuchsia|pink|purple|cyan)-\d+\b/, reason: 'Unsemantic raw Tailwind palette color', replacement: 'semantic token (bg-primary, text-primary, bg-muted, bg-card, text-muted-foreground)' },
  { pattern: /style=\{\{[^}]*(?:background|backgroundColor|color|border|borderColor)\s*:\s*(?!['"`]?var\(--)[^}]*\}\}/i, reason: 'Raw inline styles bypassing Tailwind 4 tokens', replacement: 'Tailwind classes with semantic tokens' },
];

function isAllowedTextWhite(context: string): boolean {
  return context.includes('bg-primary') ||
    context.includes('bg-destructive') ||
    context.includes('bg-green-500') ||
    context.includes('bg-emerald-500') ||
    context.includes('bg-gradient-to-r');
}

export function validateCode(code: string, fileName = 'snippet.tsx', brand?: string): TokenViolation[] {
  const violations: TokenViolation[] = [];
  const seen = new Set<string>();
  const lines = code.split('\n');

  const addViolation = (line: number, matched: string, rule: PatternRule, snippet: string) => {
    const key = `${line}:${matched}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push({
      file: fileName,
      line,
      matched,
      reason: rule.reason,
      replacement: rule.replacement,
      codeSnippet: snippet.slice(0, 100),
    });
  };

  // 1. AST pass for exact JSX attributes (multiline className, style expressions)
  try {
    const isTsx = fileName.endsWith('.tsx') || fileName.endsWith('.jsx');
    const sf = ts.createSourceFile(isTsx ? fileName : 'comp.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    const checkText = (text: string, pos: number) => {
      const line = sf.getLineAndCharacterOfPosition(pos).line + 1;
      const lineText = lines[line - 1] ?? '';
      for (const rule of DESIGN_RULES) {
        const match = text.match(rule.pattern);
        if (match) {
          if (match[0] === 'text-white' && (isAllowedTextWhite(lineText) || isAllowedTextWhite(text))) continue;
          addViolation(line, match[0], rule, lineText.trim() || text.trim());
        }
      }
    };

    const visit = (node: ts.Node) => {
      if (ts.isJsxAttribute(node)) {
        const attrName = ts.isIdentifier(node.name) ? node.name.text : node.name.name.text;
        if (attrName === 'className' || attrName === 'class') {
          if (node.initializer) {
            const collectStrings = (expr: ts.Node) => {
              if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
                checkText(expr.text, expr.getStart(sf));
              } else if (ts.isTemplateExpression(expr)) {
                checkText(expr.head.text, expr.head.getStart(sf));
                expr.templateSpans.forEach((s) => checkText(s.literal.text, s.literal.getStart(sf)));
              }
              ts.forEachChild(expr, collectStrings);
            };
            collectStrings(node.initializer);
          }
        } else if (attrName === 'style' && node.initializer) {
          const styleText = node.initializer.getText(sf);
          const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
          const lineText = lines[line - 1] ?? '';
          if (/(?:background|backgroundColor|color|border|borderColor)\s*:\s*['"`]?(?!var\(--)[^'"`}]+['"`]?/i.test(styleText)) {
            addViolation(line, styleText.slice(0, 40), DESIGN_RULES[DESIGN_RULES.length - 1], lineText.trim());
          }
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sf);
  } catch {
    // AST parse fallback
  }

  // 2. Line-by-line fallback and complementary pass
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    for (const rule of DESIGN_RULES) {
      const match = trimmed.match(rule.pattern);
      if (match) {
        if (match[0] === 'text-white' && isAllowedTextWhite(trimmed)) continue;
        addViolation(idx + 1, match[0], rule, trimmed);
      }
    }
  });

  return violations;
}

function collectSourceFiles(target: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(target)) return fileList;
  const stat = fs.statSync(target);
  if (!stat.isDirectory()) {
    if (target.endsWith('.tsx') || target.endsWith('.jsx') || target.endsWith('.ts')) fileList.push(target);
    return fileList;
  }
  for (const entry of fs.readdirSync(target)) {
    if (['node_modules', '.next', '__tests__', '.git'].includes(entry)) continue;
    const full = path.join(target, entry);
    if (fs.statSync(full).isDirectory()) collectSourceFiles(full, fileList);
    else if (full.endsWith('.tsx') || full.endsWith('.jsx')) fileList.push(full);
  }
  return fileList;
}

export function validateDesignTokens(options: { path?: string; code?: string; brand?: 'smmplan' | 'smmflux' | 'all' }): ValidateDesignTokensResult {
  const violations: TokenViolation[] = [];
  let scannedFilesCount = 0;

  if (options.code) {
    violations.push(...validateCode(options.code, options.path || 'inline.tsx', options.brand));
    scannedFilesCount = 1;
  } else if (options.path) {
    const fullPath = path.isAbsolute(options.path) ? options.path : path.resolve(process.cwd(), options.path);
    const files = collectSourceFiles(fullPath);
    scannedFilesCount = files.length;
    for (const f of files) {
      try {
        const content = fs.readFileSync(f, 'utf-8');
        const relativeName = path.relative(process.cwd(), f);
        violations.push(...validateCode(content, relativeName, options.brand));
      } catch {
        // file read error handled gracefully
      }
    }
  }

  return {
    valid: violations.length === 0,
    violationsCount: violations.length,
    scannedFilesCount,
    violations,
  };
}
