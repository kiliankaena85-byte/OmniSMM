import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

const UI_COMPONENTS_DIR = path.join(process.cwd(), 'src/components/ui');
const RAG_API_URL = "http://localhost:8100/api/knowledge";

interface ComponentASTData {
  fileName: string;
  componentNames: string[];
  interfaces: string[];
  usedTokens: string[];
}

function parseFile(filePath: string): ComponentASTData {
  const content = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const data: ComponentASTData = {
    fileName: path.basename(filePath),
    componentNames: [],
    interfaces: [],
    usedTokens: []
  };

  const tokens = new Set<string>();

  function visit(node: ts.Node) {
    // 1. Extract interfaces
    if (ts.isInterfaceDeclaration(node)) {
      const interfaceName = node.name.text;
      const members = node.members.map(m => m.name?.getText(sourceFile)).filter(Boolean).join(', ');
      data.interfaces.push(`Interface ${interfaceName} { ${members} }`);
    }

    if (ts.isExportSpecifier(node)) {
      data.componentNames.push(node.name.text);
    }
    
    // 2. Extract Component Names (inline export const / function)
    if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      if (node.parent && node.parent.parent && ts.isVariableStatement(node.parent.parent)) {
         const hasExport = node.parent.parent.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
         if (hasExport) {
            data.componentNames.push(node.name.text);
         }
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      data.componentNames.push(node.name.text);
    }

    // 3. Extract Tailwind Tokens (naive extraction for strings that look like tailwind classes)
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const text = node.text;
      const classes = text.split(/\s+/);
      for (const cls of classes) {
        if (cls.includes('-') && !cls.includes(':') && cls.length > 3) {
          tokens.add(cls);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  data.usedTokens = Array.from(tokens).slice(0, 30); // Limit to top 30 tokens for context brevity

  return data;
}

async function uploadToRAG(data: ComponentASTData, dryRun: boolean) {
  const componentNames = data.componentNames.length > 0 ? data.componentNames.join(', ') : data.fileName.replace('.tsx', '');
  const title = `UI Component: ${componentNames}`;
  
  const content = `
File: ${data.fileName}
Component Names: ${componentNames}
Interfaces: ${data.interfaces.length > 0 ? data.interfaces.join(' | ') : 'None'}
Used Tailwind Tokens (Sample): ${data.usedTokens.join(', ')}

Rules for AI:
1. Always use the specified Tailwind semantic tokens when using this component.
2. Follow the props signature exactly as defined in the Interfaces.
`;

  const payload = {
    title,
    category: "ui_components",
    content: content.trim(),
    tags: ["ui", "component", "design-system", "ast-extracted"],
    confidence_score: 1.0,
  };

  if (dryRun) {
    console.log(`\n--- [DRY RUN] ${data.fileName} ---\n`, JSON.stringify(payload, null, 2));
    return;
  }

  try {
    const res = await fetch(RAG_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`Failed to upload ${data.fileName}: ${res.statusText}`);
    } else {
      console.log(`✅ Uploaded ${data.fileName} AST to GraphRAG.`);
    }
  } catch (err: any) {
    console.error(`Error uploading ${data.fileName}:`, err.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (!fs.existsSync(UI_COMPONENTS_DIR)) {
    console.error(`UI Directory not found: ${UI_COMPONENTS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(UI_COMPONENTS_DIR).filter(f => f.endsWith('.tsx'));
  
  const targetFile = args.find(a => a.endsWith('.tsx') && !a.startsWith('--'));
  const filesToProcess = targetFile ? [targetFile] : files;

  if (filesToProcess.length === 0) {
     console.log("No files to process.");
     return;
  }

  console.log(`Parsing ${filesToProcess.length} files...`);

  for (const file of filesToProcess) {
    const filePath = path.join(UI_COMPONENTS_DIR, file);
    try {
      const astData = parseFile(filePath);
      await uploadToRAG(astData, dryRun);
    } catch (e) {
      console.error(`Error parsing ${file}:`, e);
    }
  }
}

main();
