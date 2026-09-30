import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { OmniAstEngine } from '../../../scripts/design-engine/ast-engine';

describe('OmniDesign Local AST Engine (OmniAstEngine)', () => {
  const engine = new OmniAstEngine();
  const testDir = path.resolve(process.cwd(), '.planning/test_ast');
  const testFilePath = path.join(testDir, 'SampleWidget.tsx');

  const sampleComponentCode = `"use client";

import React from "react";

export function SampleWidget() {
  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard Title</h1>
        <button className="px-4 py-2 bg-purple-600 text-white hover:bg-purple-500 rounded-md">
          Action Button
        </button>
      </header>
      <main className="grid grid-cols-2 gap-4">
        <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <p className="text-sm text-slate-400">Card Content</p>
          <img src="/logo.svg" alt="Logo" className="w-12 h-12" />
        </section>
        <aside>
          <span>Sidebar</span>
        </aside>
      </main>
    </div>
  );
}
`;

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    fs.writeFileSync(testFilePath, sampleComponentCode, 'utf-8');
  });

  afterEach(() => {
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    if (fs.existsSync(testDir)) {
      try {
        fs.rmdirSync(testDir);
      } catch {
        // ignore if directory not empty
      }
    }
  });

  describe('inspectJsxNodes', () => {
    it('1. should inspect all JSX nodes from file and return tags, classes, and lines', () => {
      const nodes = engine.inspectJsxNodes(testFilePath);
      expect(nodes.length).toBeGreaterThan(0);

      const tags = nodes.map((n) => n.tag);
      expect(tags).toContain('div');
      expect(tags).toContain('header');
      expect(tags).toContain('h1');
      expect(tags).toContain('button');
      expect(tags).toContain('main');
      expect(tags).toContain('section');
      expect(tags).toContain('p');
      expect(tags).toContain('img');
      expect(tags).toContain('aside');
      expect(tags).toContain('span');

      const buttonNode = nodes.find((n) => n.tag === 'button');
      expect(buttonNode).toBeDefined();
      expect(buttonNode?.className).toContain('bg-purple-600');
      expect(buttonNode?.line).toBe(10);
    });

    it('2. should inspect in-memory code string without file access', () => {
      const snippet = '<div className="test-box"><span className="text-sm">Hi</span><br /></div>';
      const nodes = engine.inspectJsxNodes(snippet);
      expect(nodes).toHaveLength(3);
      expect(nodes[0].tag).toBe('div');
      expect(nodes[0].className).toBe('test-box');
      expect(nodes[1].tag).toBe('span');
      expect(nodes[1].className).toBe('text-sm');
      expect(nodes[2].tag).toBe('br');
      expect(nodes[2].className).toBe('');
    });
  });

  describe('tagComponentTree', () => {
    it('3. should inject hierarchical data-omni-path into all JSX elements', () => {
      const tagged = engine.tagComponentTree(sampleComponentCode, 'SampleWidget');

      expect(tagged).toContain('data-omni-path="SampleWidget/div[0]"');
      expect(tagged).toContain('data-omni-path="SampleWidget/div[0]/header[0]"');
      expect(tagged).toContain('data-omni-path="SampleWidget/div[0]/header[0]/button[0]"');
      expect(tagged).toContain('data-omni-path="SampleWidget/div[0]/main[0]/section[0]/img[0]"');
      expect(tagged).toContain('data-omni-path="SampleWidget/div[0]/main[0]/aside[0]/span[0]"');

      // Verify original code was not broken
      expect(tagged).toContain('export function SampleWidget()');
      expect(tagged).toContain('import React from "react";');
    });

    it('4. should update existing data-omni-path attribute instead of duplicating', () => {
      const preTagged = '<div data-omni-path="OldComp/div[0]"><button data-omni-path="OldComp/div[0]/button[0]">Save</button></div>';
      const retagged = engine.tagComponentTree(preTagged, 'NewComp');

      expect(retagged).toContain('data-omni-path="NewComp/div[0]"');
      expect(retagged).toContain('data-omni-path="NewComp/div[0]/button[0]"');
      expect(retagged).not.toContain('OldComp');
      // Ensure no double attributes
      const occurrences = (retagged.match(/data-omni-path=/g) || []).length;
      expect(occurrences).toBe(2);
    });
  });

  describe('mutateClasses', () => {
    it('5. should mutate classes by tag name with tailwind-merge conflict resolution', () => {
      const result = engine.mutateClasses(testFilePath, 'button', {
        addClasses: ['bg-primary', 'rounded-xl'],
        removeClasses: ['text-white'],
      });

      expect(result.success).toBe(true);
      expect(result.oldClasses).toContain('bg-purple-600');
      // tailwind-merge should resolve bg-purple-600 vs bg-primary in favor of bg-primary
      expect(result.newClasses).toContain('bg-primary');
      expect(result.newClasses).not.toContain('bg-purple-600');
      // rounded-xl overrides rounded-md
      expect(result.newClasses).toContain('rounded-xl');
      expect(result.newClasses).not.toContain('rounded-md');
      // text-white was removed
      expect(result.newClasses).not.toContain('text-white');

      // Check file on disk was modified
      const updatedFile = fs.readFileSync(testFilePath, 'utf-8');
      expect(updatedFile).toContain(result.newClasses);
      expect(updatedFile).not.toContain('bg-purple-600');
    });

    it('6. should mutate classes by structural data-omni-path', () => {
      // First tag the file
      const tagged = engine.tagComponentTree(sampleComponentCode, 'SampleWidget');
      fs.writeFileSync(testFilePath, tagged, 'utf-8');

      const targetPath = 'SampleWidget/div[0]/header[0]/h1[0]';
      const result = engine.mutateClasses(testFilePath, targetPath, {
        addClasses: ['text-4xl', 'tracking-tight', 'text-foreground'],
        removeClasses: ['text-white'],
      });

      expect(result.success).toBe(true);
      expect(result.oldClasses).toBe('text-2xl font-bold text-white');
      expect(result.newClasses).toContain('text-4xl');
      expect(result.newClasses).not.toContain('text-2xl');
      expect(result.newClasses).toContain('text-foreground');
      expect(result.newClasses).not.toContain('text-white');

      const fileContent = fs.readFileSync(testFilePath, 'utf-8');
      expect(fileContent).toContain(result.newClasses);
    });

    it('7. should add className to element that had none before', () => {
      const result = engine.mutateClasses(testFilePath, 'aside', {
        addClasses: ['w-64', 'bg-card', 'border-l', 'p-4'],
      });

      expect(result.success).toBe(true);
      expect(result.oldClasses).toBe('');
      expect(result.newClasses).toBe('w-64 bg-card border-l p-4');

      const fileContent = fs.readFileSync(testFilePath, 'utf-8');
      expect(fileContent).toContain('<aside className="w-64 bg-card border-l p-4">');
    });

    it('8. should return error if node is not found', () => {
      const result = engine.mutateClasses(testFilePath, 'NonExistentComponent', {
        addClasses: ['p-4'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('9. should return error if file does not exist', () => {
      const result = engine.mutateClasses('/non/existent/path/Component.tsx', 'button', {
        addClasses: ['p-4'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('10. should safely mutate classes on self-closing elements (img)', () => {
      const result = engine.mutateClasses(testFilePath, 'img', {
        addClasses: ['w-16', 'h-16', 'rounded-full'],
        removeClasses: ['w-12'],
      });

      expect(result.success).toBe(true);
      expect(result.newClasses).toContain('w-16');
      expect(result.newClasses).not.toContain('w-12');
      expect(result.newClasses).toContain('rounded-full');

      const content = fs.readFileSync(testFilePath, 'utf-8');
      expect(content).toContain(`className="${result.newClasses}"`);
    });

    it('11. should handle empty inputs gracefully without throwing', () => {
      expect(engine.inspectJsxNodes('')).toEqual([]);
      expect(engine.tagComponentTree('', 'EmptyComp')).toBe('');
      const emptyResult = engine.mutateClasses(testFilePath, 'button', {});
      expect(emptyResult.success).toBe(true);
    });

    it('12. should handle template literal className without corrupting with backticks', () => {
      const codeWithTemplate = '<div className={`px-4 py-2 text-white`}><span>Label</span></div>';
      const nodes = engine.inspectJsxNodes(codeWithTemplate);
      expect(nodes[0].className).toBe('px-4 py-2 text-white');
      expect(nodes[0].className).not.toContain('`');

      const mutated = engine.mutateCode(codeWithTemplate, 'div', {
        addClasses: ['bg-primary'],
        removeClasses: ['text-white'],
      });
      expect(mutated.success).toBe(true);
      expect(mutated.newClasses).toBe('px-4 py-2 bg-primary');
      expect(mutated.modifiedCode).toBe('<div className="px-4 py-2 bg-primary"><span>Label</span></div>');
      expect(mutated.modifiedCode).not.toContain('`');
    });

    it('13. should traverse, tag, and mutate JSX elements inside props (e.g. rightIcon={<ArrowRight />})', () => {
      const codeWithPropJsx = '<FluxButton variant="primary" rightIcon={<ArrowRight className="w-4 h-4 text-white" />}>Submit</FluxButton>';

      // Tagging should inject data-omni-path into the prop element as well
      const tagged = engine.tagComponentTree(codeWithPropJsx, 'Widget');
      expect(tagged).toContain('data-omni-path="Widget/FluxButton[0]"');
      expect(tagged).toContain('data-omni-path="Widget/FluxButton[0]/ArrowRight[0]"');

      // Mutation by tag name of the prop element
      const mutatedByTag = engine.mutateCode(codeWithPropJsx, 'ArrowRight', {
        addClasses: ['text-primary', 'w-5', 'h-5'],
        removeClasses: ['text-white'],
      });
      expect(mutatedByTag.success).toBe(true);
      expect(mutatedByTag.newClasses).toContain('text-primary');
      expect(mutatedByTag.newClasses).toContain('w-5 h-5');
      expect(mutatedByTag.newClasses).not.toContain('w-4');
      expect(mutatedByTag.newClasses).not.toContain('text-white');
      expect(mutatedByTag.modifiedCode).toContain('className="text-primary w-5 h-5"');

      // Mutation by structural path without bracket index
      const mutatedByPath = engine.mutateCode(tagged, 'FluxButton/ArrowRight', {
        addClasses: ['opacity-90'],
      });
      expect(mutatedByPath.success).toBe(true);
      expect(mutatedByPath.newClasses).toContain('opacity-90');
    });

    it('14. should match structural paths without explicit bracket indices (e.g. header/button)', () => {
      const code = '<div><header><button className="btn-old">Click</button></header></div>';
      const tagged = engine.tagComponentTree(code, 'App');
      const result = engine.mutateCode(tagged, 'header/button', {
        addClasses: ['btn-new'],
        removeClasses: ['btn-old'],
      });
      expect(result.success).toBe(true);
      expect(result.newClasses).toBe('btn-new');
    });

    it('15. should handle elements with spread attributes and mutate className cleanly', () => {
      const codeSpreadWithClass = '<button {...props} className="px-4 py-2">Click</button>';
      const mutated1 = engine.mutateCode(codeSpreadWithClass, 'button', { addClasses: ['rounded-lg'] });
      expect(mutated1.success).toBe(true);
      expect(mutated1.modifiedCode).toContain('<button {...props} className="px-4 py-2 rounded-lg">');

      const codeSpreadNoClass = '<input {...props} type="text" />';
      const mutated2 = engine.mutateCode(codeSpreadNoClass, 'input', { addClasses: ['border p-2'] });
      expect(mutated2.success).toBe(true);
      expect(mutated2.modifiedCode).toContain('<input className="border p-2" {...props} type="text" />');
    });

    it('16. should handle dot-notation components (e.g. Table.Header, Table.Column)', () => {
      const code = '<Table.Header><Table.Column className="font-medium">Title</Table.Column></Table.Header>';
      const nodes = engine.inspectJsxNodes(code);
      expect(nodes.map((n) => n.tag)).toEqual(['Table.Header', 'Table.Column']);

      const mutated = engine.mutateCode(code, 'Table.Column', {
        addClasses: ['text-primary', 'font-bold'],
        removeClasses: ['font-medium'],
      });
      expect(mutated.success).toBe(true);
      expect(mutated.newClasses).toBe('text-primary font-bold');
      expect(mutated.modifiedCode).toContain('<Table.Column className="text-primary font-bold">');
    });

    it('17. should properly handle multi-class strings and whitespace in addClasses/removeClasses', () => {
      const code = '<div className="px-4 py-2 bg-purple-600">Box</div>';
      const mutated = engine.mutateCode(code, 'div', {
        addClasses: ['  bg-primary rounded-xl  ', 'text-white shadow-md'],
        removeClasses: ['  bg-purple-600  '],
      });
      expect(mutated.success).toBe(true);
      expect(mutated.newClasses).toContain('bg-primary');
      expect(mutated.newClasses).toContain('rounded-xl');
      expect(mutated.newClasses).toContain('text-white');
      expect(mutated.newClasses).toContain('shadow-md');
      expect(mutated.newClasses).not.toContain('bg-purple-600');
    });
  });
});

