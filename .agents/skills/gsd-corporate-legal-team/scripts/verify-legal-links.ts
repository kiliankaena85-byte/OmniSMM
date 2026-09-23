import * as fs from 'fs';
import * as path from 'path';

function walkDir(dir: string, callback: (filePath: string) => void) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        walkDir(filePath, callback);
      }
    } else {
      callback(filePath);
    }
  }
}

async function main() {
  console.log('⚖️ Running Legal Compliance Link Checker...');
  const srcDir = path.join(process.cwd(), 'src');
  
  let formsChecked = 0;
  let complianceViolations = 0;

  walkDir(srcDir, (filePath) => {
    const ext = path.extname(filePath);
    if (ext === '.tsx' || ext === '.ts') {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Look for forms, inputs, checkboxes or drawers
      const isFormOrDrawer = content.includes('<form') || content.includes('Drawer') || content.includes('Modal') || content.includes('Input') || content.includes('Checkbox');
      
      if (isFormOrDrawer) {
        formsChecked++;
        
        // 1. Check for FZ-152 (Consent to Personal Data processing) in fields
        const hasPrivacyLink = content.includes('/legal/privacy') || content.includes('/legal/privacy-policy') || content.includes('privacy');
        const hasTermsLink = content.includes('/legal/terms') || content.includes('/legal/terms-of-service') || content.includes('terms');
        const hasCheckbox = content.includes('Checkbox') || content.includes('type="checkbox"');

        // Check if there is a submit button but no privacy link or checkbox
        const hasSubmitButton = content.includes('type="submit"') || content.includes('submit') || content.includes('Button');
        
        if (hasSubmitButton && !hasPrivacyLink && (filePath.includes('register') || filePath.includes('checkout') || filePath.includes('payment') || filePath.includes('order'))) {
          console.warn(`[WARN] Form file: ${path.relative(process.cwd(), filePath)} has a submit action but no link to privacy policy (/legal/privacy).`);
          complianceViolations++;
        }

        // 2. Check for pre-checked FZ-152 checkboxes (Non-compliant under RKN rules)
        if (hasCheckbox) {
          const isDefaultChecked = content.includes('defaultChecked={true}') || content.includes('defaultChecked') || content.includes('isSelected={true}');
          if (isDefaultChecked && (content.includes('согласен') || content.includes('оферт') || content.includes('данн'))) {
            console.error(`[FAIL] File: ${path.relative(process.cwd(), filePath)} has a legal checkbox that is pre-checked by default! This violates FZ-152 (RKN compliance).`);
            complianceViolations++;
          }
        }
      }
    }
  });

  console.log(`\nLegal Link Audit Completed:`);
  console.log(`- Files/Forms Analyzed: ${formsChecked}`);
  console.log(`- Compliance Warnings/Violations Found: ${complianceViolations}`);

  if (complianceViolations > 0) {
    console.error('❌ Compliance audit failed. Please fix warnings/failures.');
    process.exit(1);
  } else {
    console.log('✅ Legal compliance audit passed successfully!');
    process.exit(0);
  }
}

main().catch(console.error);
