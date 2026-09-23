const fs = require('fs');
const path = require('path');

const targets = [
  path.join(__dirname, '../src/app'),
  path.join(__dirname, '../src/components'),
  path.join(__dirname, '../src/data/knowledge')
];

// Регулярные выражения для замены (включая регистр)
const replacements = [
  // Склонения с большой буквы
  { pattern: /Накрутка/g, replacement: 'Продвижение' },
  { pattern: /Накрутки/g, replacement: 'Продвижения' },
  { pattern: /Накрутку/g, replacement: 'Продвижение' },
  { pattern: /Накрутке/g, replacement: 'Продвижении' },
  { pattern: /Накрутить/g, replacement: 'Продвинуть' },
  { pattern: /Накрутим/g, replacement: 'Продвинем' },
  { pattern: /Накручено/g, replacement: 'Выполнено' },
  
  // Склонения с маленькой буквы
  { pattern: /накрутка/g, replacement: 'продвижение' },
  { pattern: /накрутки/g, replacement: 'продвижения' },
  { pattern: /накрутку/g, replacement: 'продвижение' },
  { pattern: /накрутке/g, replacement: 'продвижении' },
  { pattern: /накрутить/g, replacement: 'продвинуть' },
  { pattern: /накрутим/g, replacement: 'продвинем' },
  { pattern: /накручено/g, replacement: 'выполнено' },
  { pattern: /накручивает/g, replacement: 'продвигает' },
  { pattern: /накручивание/g, replacement: 'продвижение' },
  { pattern: /накручивания/g, replacement: 'продвижения' }
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Не трогаем системные импорты или специфичные системные куски, если вдруг встретятся
  for (const { pattern, replacement } of replacements) {
    content = content.replace(pattern, replacement);
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${path.relative(path.join(__dirname, '..'), filePath)}`);
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.mdx') || file.endsWith('.md')) {
      processFile(fullPath);
    }
  });
}

console.log("Starting UI masking replacements...");
targets.forEach(target => {
  console.log(`Scanning target: ${target}`);
  walk(target);
});
console.log("UI masking finished!");
