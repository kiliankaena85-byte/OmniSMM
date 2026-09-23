import fs from 'fs';
import path from 'path';

function extractConfig() {
  const logPath = 'C:\\Users\\Артём\\.gemini\\antigravity\\brain\\857024a9-4565-4e38-b47e-1189f06c735a\\.system_generated\\logs\\transcript.jsonl';
  const outputPath = 'd:\\SMM_plan_2\\clash\\config.yaml';

  console.log(`Reading log from: ${logPath}`);
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'USER_INPUT' && obj.content && obj.content.includes('socks-port:')) {
        // Found it! Clean up formatting: extract the YAML block
        let yamlContent = obj.content;
        
        // Remove <USER_REQUEST> tags if present
        yamlContent = yamlContent.replace('<USER_REQUEST>', '').replace('</USER_REQUEST>', '').trim();

        // Create directory if it doesn't exist
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, yamlContent, 'utf8');
        console.log(`Successfully wrote full configuration to ${outputPath}. Length: ${yamlContent.length} chars.`);
        return;
      }
    } catch (err) {
      // Ignore parse errors on other lines
    }
  }

  console.error('Could not find the user request with socks-port in the transcript.');
}

extractConfig();
