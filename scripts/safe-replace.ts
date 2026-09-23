import * as fs from "fs";
import * as path from "path";

function walkDir(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (
        !fullPath.includes("node_modules") &&
        !fullPath.includes(".git") &&
        !fullPath.includes(".next")
      ) {
        results = results.concat(walkDir(fullPath));
      }
    } else if (
      file.endsWith(".ts") ||
      file.endsWith(".tsx") ||
      file.endsWith(".md")
    ) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = walkDir("d:/SMM_plan_2");
let changed = 0;
files.forEach((file) => {
  const content = fs.readFileSync(file, "utf8");
  if (content.includes("smmplan.ru")) {
    fs.writeFileSync(
      file,
      content.replace(/smmplan\.ru/g, "smmplan.pro"),
      "utf8"
    );
    changed++;
  }
});
console.log(`Replaced smmplan.ru with smmplan.pro in ${changed} files safely.`);
