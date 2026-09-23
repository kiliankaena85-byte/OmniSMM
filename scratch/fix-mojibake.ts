import fs from 'fs';
import path from 'path';

function decodeMojibake(str: string): string {
  const bytes: number[] = [];
  const cp1251 = "" +
    "ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏ" + // 0x80 - 0x8F
    "ђ‘’“”•–—\x00™љ›њќћџ" + // 0x90 - 0x9F
    " ЎўЈ¤Ґ¦§Ё©Є«¬­®Ї" + // 0xA0 - 0xAF
    "°±Ііґµ¶·ё№є»јЅѕї" + // 0xB0 - 0xBF
    "АБВГДЕЖЗИЙКЛМНОП" + // 0xC0 - 0xCF
    "РСТУФХЦЧШЩЪЫЬЭЮЯ" + // 0xD0 - 0xDF
    "абвгдежзийклмноп" + // 0xE0 - 0xEF
    "рстуфхцчшщъыьэюя";  // 0xF0 - 0xFF

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const code = char.charCodeAt(0);
    if (code <= 0x7F) {
      bytes.push(code);
    } else {
      const index = cp1251.indexOf(char);
      if (index !== -1) {
        bytes.push(0x80 + index);
      } else {
        // Fallback for non-cp1251 characters: convert back to utf-8 bytes
        const buf = Buffer.from(char, 'utf-8');
        for (let j = 0; j < buf.length; j++) {
          bytes.push(buf[j]);
        }
      }
    }
  }
  return Buffer.from(bytes).toString('utf-8');
}

const filePath = path.join(process.cwd(), 'src/app/admin/dashboard/page.tsx');
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Only decode if we detect Mojibake pattern (e.g. Р”Р or Р°Р)
  if (content.includes('Р”') || content.includes('Р°') || content.includes('Сѓ')) {
    const decoded = decodeMojibake(content);
    fs.writeFileSync(filePath, decoded, 'utf-8');
    console.log('Successfully decoded Mojibake in src/app/admin/dashboard/page.tsx!');
  } else {
    console.log('No Mojibake pattern found in the file.');
  }
} else {
  console.error('File not found:', filePath);
}
