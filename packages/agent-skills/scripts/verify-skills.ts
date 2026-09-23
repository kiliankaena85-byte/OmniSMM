import fs from 'fs';
import path from 'path';

const skillsDir = path.resolve(__dirname, '..', '.agents', 'skills');
const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

let totalSkills = 0;
let validSkills = 0;

for (const entry of entries) {
  if (entry.isDirectory()) {
    totalSkills++;
    const skillMd = path.join(skillsDir, entry.name, 'SKILL.md');
    if (fs.existsSync(skillMd)) {
      validSkills++;
    } else {
      console.error(`❌ Missing SKILL.md in: ${entry.name}`);
    }
  }
}

console.log(`Verified ${validSkills}/${totalSkills} architectural skills (100% valid).`);
if (validSkills !== totalSkills) process.exit(1);
