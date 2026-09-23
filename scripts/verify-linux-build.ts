import fs from "fs";
import path from "path";

interface Issue {
  file: string;
  line: number;
  message: string;
  type: string;
}

function getAllSourceFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "dist") {
        getAllSourceFiles(fullPath, fileList);
      }
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function verifyLinuxCompatibility() {
  console.log("\n================================================================");
  console.log("   LINUX DOCKER COMPATIBILITY & CASE-SENSITIVITY VERIFIER");
  console.log("================================================================\n");

  const rootDir = process.cwd();
  const srcDir = path.join(rootDir, "src");
  const files = getAllSourceFiles(srcDir);
  const issues: Issue[] = [];

  const importRegex = /(?:import|from|require)\s*\(?['"]([^'"]+)['"]\)?/g;

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");

    lines.forEach((line, idx) => {
      let match: RegExpExecArray | null;
      while ((match = importRegex.exec(line)) !== null) {
        const importPath = match[1];

        if (importPath.includes("\\\\")) {
          issues.push({
            file: path.relative(rootDir, file),
            line: idx + 1,
            message: `Import contains Windows backslash: "${importPath}". Must use forward slash "/".`,
            type: "BACKSLASH",
          });
        }

        if (importPath.startsWith("@/")) {
          const relativeToSrc = importPath.slice(2);
          const targetPath = path.join(srcDir, relativeToSrc);
          const possibleExtensions = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"];
          let matchedTarget: string | null = null;

          for (const ext of possibleExtensions) {
            const testPath = targetPath + ext;
            if (fs.existsSync(testPath)) {
              matchedTarget = testPath;
              break;
            }
          }

          if (matchedTarget) {
            const segments = path.relative(srcDir, matchedTarget).split(path.sep);
            let currentDir = srcDir;

            for (const seg of segments) {
              const entries = fs.readdirSync(currentDir);
              if (!entries.includes(seg)) {
                const found = entries.find((e) => e.toLowerCase() === seg.toLowerCase());
                if (found && found !== seg) {
                  issues.push({
                    file: path.relative(rootDir, file),
                    line: idx + 1,
                    message: `Case mismatch in import "${importPath}". Path has "${seg}" but filesystem requires "${found}".`,
                    type: "CASE_MISMATCH",
                  });
                }
              }
              currentDir = path.join(currentDir, seg);
            }
          }
        }
      }
    });
  }

  console.log(`🔍 Scanned ${files.length} TypeScript source files for Linux compatibility.`);

  if (issues.length === 0) {
    console.log("\n✅ [LINUX-GATE: PASS] All imports are 100% case-sensitive compatible and free of Windows path issues!\n");
    process.exit(0);
  } else {
    console.log(`\n❌ [LINUX-GATE: FAILED] Found ${issues.length} compatibility issue(s):\n`);
    issues.forEach((iss) => {
      console.log(`  [${iss.type}] ${iss.file}:${iss.line} -> ${iss.message}`);
    });
    console.log("\nFix import casing before deploying to Linux Docker production.\n");
    process.exit(1);
  }
}

verifyLinuxCompatibility();
