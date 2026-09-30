/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * OmniDesign MCP Hub — Tool Declarations and Dispatcher.
 */

import fs from 'fs';
import { McpToolDefinition } from './types';
import { OmniAstEngine, ClassMutation } from '../../design-engine/ast-engine';
import { validateDesignTokens } from './token-validator';
import { generateCandidate } from './candidate-generator';

const astEngine = new OmniAstEngine();

export const OMNIDESIGN_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'inspect_jsx_nodes',
    description: 'Inspects JSX tree using native TypeScript Compiler API; returns tag names, classes, line numbers and data-omni-path attributes.',
    inputSchema: {
      type: 'object',
      properties: {
        filePathOrCode: { type: 'string', description: 'File path to .tsx file or raw TSX/JSX code snippet' },
        filePath: { type: 'string', description: 'Optional explicit file path' },
        code: { type: 'string', description: 'Optional explicit TSX/JSX code' },
      },
    },
  },
  {
    name: 'tag_component_tree',
    description: 'Deterministically injects hierarchical data-omni-path attributes into JSX tree for robust visual targeting.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Raw TSX/JSX component source code' },
        filePath: { type: 'string', description: 'Optional file path to read code from' },
        componentName: { type: 'string', description: 'Root component name (e.g. "OrderWizard")' },
      },
      required: ['componentName'],
    },
  },
  {
    name: 'mutate_classes',
    description: 'Deterministic Zero-Token CSS class mutation with tailwind-merge conflict resolution (0 tokens).',
    inputSchema: {
      type: 'object',
      properties: {
        structuralPath: { type: 'string', description: 'Target node structural path or tag name (e.g. "button[0]")' },
        filePath: { type: 'string', description: 'File path to modify directly on disk' },
        code: { type: 'string', description: 'Raw code to mutate in-memory' },
        mutation: { type: 'object', description: 'Class mutation object { addClasses?: string[], removeClasses?: string[] }' },
      },
      required: ['structuralPath', 'mutation'],
    },
  },
  {
    name: 'validate_design_tokens',
    description: 'Audits files or snippets against Obsidian Slate & Cobalt Matrix standards (banned colors, acid-neon gradients, inline styles).',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File or directory path to audit' },
        code: { type: 'string', description: 'Raw TSX code snippet to audit' },
        brand: { type: 'string', description: 'Brand target: "smmplan" | "smmflux" | "all"' },
      },
    },
  },
  {
    name: 'generate_design_candidate',
    description: 'Assembles clean React 19 & HeroUI v3 component complying with Obsidian Slate & Cobalt Matrix standards (<= 200 lines).',
    inputSchema: {
      type: 'object',
      properties: {
        componentName: { type: 'string', description: 'Name of the component (e.g. "CobaltMetricsCard")' },
        brand: { type: 'string', description: 'Brand target: "smmflux" | "smmplan"' },
        category: { type: 'string', description: 'Category: "card" | "table" | "wizard" | "button" | "badge" | "hud"' },
        title: { type: 'string', description: 'Title or heading for the component' },
        description: { type: 'string', description: 'Short description copy' },
      },
      required: ['componentName'],
    },
  },
];

export async function executeOmniDesignTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  switch (toolName) {
    case 'inspect_jsx_nodes': {
      let source = (args.filePathOrCode as string) || (args.code as string) || (args.filePath as string) || '';
      if (!source) throw new Error('inspect_jsx_nodes requires filePathOrCode, filePath, or code');
      if (args.filePath && typeof args.filePath === 'string') {
        if (!fs.existsSync(args.filePath)) throw new Error(`File not found: ${args.filePath}`);
        source = args.filePath;
      }
      const nodes = astEngine.inspectJsxNodes(source);
      return { totalNodes: nodes.length, nodes };
    }

    case 'tag_component_tree': {
      let code = (args.code as string) || '';
      const filePath = args.filePath as string | undefined;
      const componentName = (args.componentName as string) || 'Component';
      if (!code && filePath) {
        if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
        code = fs.readFileSync(filePath, 'utf-8');
      }
      if (!code) throw new Error('tag_component_tree requires code or valid filePath');
      const taggedCode = astEngine.tagComponentTree(code, componentName);
      return { componentName, taggedCode };
    }

    case 'mutate_classes': {
      const structuralPath = args.structuralPath as string;
      const mutation = (args.mutation || {}) as ClassMutation;
      const filePath = args.filePath as string | undefined;
      const code = args.code as string | undefined;

      if (!structuralPath) throw new Error('mutate_classes requires structuralPath');
      if (filePath) {
        return astEngine.mutateClasses(filePath, structuralPath, mutation);
      }
      if (code) {
        return astEngine.mutateCode(code, structuralPath, mutation);
      }
      throw new Error('mutate_classes requires either filePath or code');
    }

    case 'validate_design_tokens': {
      const pathArg = args.path as string | undefined;
      const codeArg = args.code as string | undefined;
      const brand = args.brand as 'smmplan' | 'smmflux' | 'all' | undefined;
      if (!pathArg && !codeArg) {
        throw new Error('validate_design_tokens requires path or code');
      }
      return validateDesignTokens({ path: pathArg, code: codeArg, brand });
    }

    case 'generate_design_candidate': {
      const componentName = (args.componentName as string) || 'GeneratedWidget';
      const brand = args.brand as 'smmflux' | 'smmplan' | undefined;
      const category = args.category as 'card' | 'table' | 'wizard' | 'button' | 'badge' | 'hud' | 'custom' | undefined;
      const title = args.title as string | undefined;
      const description = args.description as string | undefined;

      return generateCandidate({ componentName, brand, category, title, description });
    }

    default:
      throw new Error(`Unknown OmniDesign tool: ${toolName}`);
  }
}
