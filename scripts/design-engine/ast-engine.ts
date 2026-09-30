/**
 * OmniDesign Local AST Engine (OmniAstEngine v2.0)
 *
 * Детерминированный визуальный AST-движок на базе нативного TypeScript Compiler API
 * и tailwind-merge для Zero-Token визуальных правок и инъекции структурных путей.
 */
import fs from 'fs';
import ts from 'typescript';
import { twMerge } from 'tailwind-merge';

export interface JsxNodeInfo { tag: string; className: string; omniPath?: string; structuralPath: string; line: number; }
export interface ClassMutation { addClasses?: string[]; removeClasses?: string[]; }
export interface MutationResult { success: boolean; modifiedCode?: string; oldClasses?: string; newClasses?: string; error?: string; }

function safeExists(p: string): boolean {
  if (!p || p.includes('\n') || p.includes('<')) return false;
  try { return fs.existsSync(p); } catch { return false; }
}

function getTagName(tn: ts.JsxTagNameExpression, sf: ts.SourceFile): string {
  if (ts.isIdentifier(tn)) return tn.text;
  if (ts.isPropertyAccessExpression(tn)) return `${getTagName(tn.expression, sf)}.${tn.name.text}`;
  return tn.getText(sf);
}

function getJsxAttr(attrs: ts.JsxAttributes, name: string): ts.JsxAttribute | undefined {
  return attrs.properties.find((p): p is ts.JsxAttribute =>
    ts.isJsxAttribute(p) && (ts.isIdentifier(p.name) ? p.name.text : p.name.name.text) === name
  );
}

function getAttrValue(attr: ts.JsxAttribute | undefined, sf: ts.SourceFile): string | undefined {
  if (!attr?.initializer) return undefined;
  const init = attr.initializer;
  if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression) {
    const e = init.expression;
    return (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) ? e.text : e.getText(sf);
  }
  return undefined;
}

export class OmniAstEngine {
  inspectJsxNodes(filePathOrCode: string): JsxNodeInfo[] {
    const code = safeExists(filePathOrCode) ? fs.readFileSync(filePathOrCode, 'utf-8') : filePathOrCode;
    const isTsx = filePathOrCode.endsWith('.tsx') || filePathOrCode.endsWith('.jsx');
    const sf = ts.createSourceFile(isTsx ? filePathOrCode : 'comp.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const results: JsxNodeInfo[] = [];

    const visit = (node: ts.Node, parentPath: string, counters: Record<string, number>) => {
      const elem = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : undefined;
      let currentPath = parentPath;
      const childCounters: Record<string, number> = {};
      if (elem) {
        const tag = getTagName(elem.tagName, sf);
        const idx = counters[tag] ?? 0;
        counters[tag] = idx + 1;
        currentPath = parentPath ? `${parentPath}/${tag}[${idx}]` : `${tag}[${idx}]`;
        const className = getAttrValue(getJsxAttr(elem.attributes, 'className'), sf) ?? '';
        const omniPath = getAttrValue(getJsxAttr(elem.attributes, 'data-omni-path'), sf);
        const { line } = sf.getLineAndCharacterOfPosition(elem.getStart(sf));
        results.push({ tag, className, omniPath, structuralPath: currentPath, line: line + 1 });
        for (const p of elem.attributes.properties) {
          if (ts.isJsxAttribute(p) && p.initializer) visit(p.initializer, currentPath, childCounters);
        }
      }
      if (ts.isJsxElement(node)) {
        for (const child of node.children) visit(child, currentPath, childCounters);
      } else if (!elem) {
        ts.forEachChild(node, (c) => visit(c, parentPath, counters));
      }
    };

    visit(sf, '', {});
    return results;
  }

  tagComponentTree(code: string, componentName: string): string {
    const sf = ts.createSourceFile('temp.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const edits: Array<{ start: number; end: number; text: string }> = [];

    const walk = (node: ts.Node, parentPath: string, counters: Record<string, number>) => {
      const elem = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : undefined;
      let currentPath = parentPath;
      const childCounters: Record<string, number> = {};

      if (elem) {
        const tag = getTagName(elem.tagName, sf);
        const idx = counters[tag] ?? 0;
        counters[tag] = idx + 1;
        currentPath = parentPath ? `${parentPath}/${tag}[${idx}]` : `${componentName}/${tag}[${idx}]`;

        const existing = getJsxAttr(elem.attributes, 'data-omni-path');
        edits.push(existing
          ? { start: existing.getStart(sf), end: existing.getEnd(), text: `data-omni-path="${currentPath}"` }
          : { start: elem.tagName.getEnd(), end: elem.tagName.getEnd(), text: ` data-omni-path="${currentPath}"` });

        for (const p of elem.attributes.properties) {
          if (ts.isJsxAttribute(p) && p.initializer) walk(p.initializer, currentPath, childCounters);
        }
      }

      if (ts.isJsxElement(node)) {
        for (const child of node.children) walk(child, currentPath, childCounters);
      } else if (!elem) {
        ts.forEachChild(node, (child) => walk(child, parentPath, counters));
      }
    };

    walk(sf, '', {});
    edits.sort((a, b) => b.start - a.start);
    return edits.reduce((res, e) => res.slice(0, e.start) + e.text + res.slice(e.end), code);
  }

  mutateCode(code: string, structuralPath: string, mutation: ClassMutation, fileHint = 'comp.tsx'): MutationResult {
    const sf = ts.createSourceFile(fileHint, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let targetElem: ts.JsxOpeningLikeElement | undefined;
    let targetOldClass = '';
    const normTarget = structuralPath.replace(/\[\d+\]/g, '');

    const findMatch = (node: ts.Node, parentPath: string, counters: Record<string, number>): boolean => {
      if (targetElem) return true;
      const elem = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : undefined;
      let currentPath = parentPath;
      const childCounters: Record<string, number> = {};

      if (elem) {
        const tag = getTagName(elem.tagName, sf);
        const idx = counters[tag] ?? 0;
        counters[tag] = idx + 1;
        currentPath = parentPath ? `${parentPath}/${tag}[${idx}]` : `${tag}[${idx}]`;

        const omniVal = getAttrValue(getJsxAttr(elem.attributes, 'data-omni-path'), sf);
        const normCurrent = currentPath.replace(/\[\d+\]/g, '');
        const isMatch =
          omniVal === structuralPath ||
          tag === structuralPath ||
          currentPath === structuralPath ||
          `${tag}[${idx}]` === structuralPath ||
          (omniVal !== undefined && (omniVal.endsWith(structuralPath) || omniVal.replace(/\[\d+\]/g, '').endsWith(normTarget))) ||
          currentPath.endsWith(structuralPath) ||
          normCurrent.endsWith(normTarget);

        if (isMatch) {
          targetElem = elem;
          targetOldClass = getAttrValue(getJsxAttr(elem.attributes, 'className'), sf) ?? '';
          return true;
        }
        for (const p of elem.attributes.properties) {
          if (ts.isJsxAttribute(p) && p.initializer && findMatch(p.initializer, currentPath, childCounters)) return true;
        }
      }

      if (ts.isJsxElement(node)) {
        for (const child of node.children) {
          if (findMatch(child, currentPath, childCounters)) return true;
        }
      } else if (!elem) {
        let found = false;
        ts.forEachChild(node, (child) => {
          if (!found && findMatch(child, parentPath, counters)) found = true;
        });
        if (found) return true;
      }
      return false;
    };

    findMatch(sf, '', {});
    if (!targetElem) return { success: false, error: `JSX node matching "${structuralPath}" not found` };

    const classAttr = getJsxAttr(targetElem.attributes, 'className');
    let tokens = targetOldClass.trim() ? targetOldClass.trim().split(/\s+/) : [];
    if (mutation.removeClasses?.length) {
      const rm = new Set(mutation.removeClasses.flatMap((c) => c.trim().split(/\s+/)).filter(Boolean));
      tokens = tokens.filter((c) => !rm.has(c));
    }
    if (mutation.addClasses?.length) {
      tokens.push(...mutation.addClasses.flatMap((c) => c.trim().split(/\s+/)).filter(Boolean));
    }
    const newClasses = twMerge(tokens.join(' '));

    const modifiedCode = classAttr
      ? code.slice(0, classAttr.getStart(sf)) + `className="${newClasses}"` + code.slice(classAttr.getEnd())
      : code.slice(0, targetElem.tagName.getEnd()) + ` className="${newClasses}"` + code.slice(targetElem.tagName.getEnd());

    return { success: true, modifiedCode, oldClasses: targetOldClass, newClasses };
  }

  mutateClasses(filePath: string, structuralPath: string, mutation: ClassMutation): MutationResult {
    const isFile = safeExists(filePath);
    if (!isFile && !filePath.includes('<')) return { success: false, error: `File not found: ${filePath}` };
    const code = isFile ? fs.readFileSync(filePath, 'utf-8') : filePath;
    const result = this.mutateCode(code, structuralPath, mutation, filePath);
    if (result.success && result.modifiedCode && isFile) fs.writeFileSync(filePath, result.modifiedCode, 'utf-8');
    return result;
  }
}
