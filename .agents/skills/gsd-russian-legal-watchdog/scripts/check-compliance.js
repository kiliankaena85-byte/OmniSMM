/**
 * (c) 2026 Smmplan.
 * Russian Legal Watchdog Compliance Script.
 * Scans directories for legal policies, GDPR checklists, ФЗ-152, and company requisites.
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../../../../');
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m'; // No Color

let hasFailures = false;

function printSuccess(message) {
    console.log(`${GREEN}[PASS]${NC} ${message}`);
}

function printWarning(message) {
    console.log(`${YELLOW}[WARN]${NC} ${message}`);
}

function printError(message) {
    console.log(`${RED}[FAIL]${NC} ${message}`);
    hasFailures = true;
}

// 1. Check Legal Documents
const legalPages = [
    { name: 'Privacy Policy', relPath: 'src/app/legal/privacy/page.tsx' },
    { name: 'Terms of Service', relPath: 'src/app/legal/terms/page.tsx' },
    { name: 'Refund Policy', relPath: 'src/app/legal/refund/page.tsx' }
];

console.log('=== Checking Legal Pages ===');
legalPages.forEach(p => {
    const fullPath = path.join(ROOT_DIR, p.relPath);
    if (!fs.existsSync(fullPath)) {
        printError(`Файл ${p.name} отсутствует по пути: ${p.relPath}`);
        return;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Check for template bracket placeholders
    const hasBrackets = /\[[А-Яа-яA-Za-z\s/._-]+\]/.test(content);
    if (hasBrackets) {
        printError(`Файл ${p.name} содержит незаполненные шаблоны в квадратных скобках ([...]).`);
    } else {
        printSuccess(`Файл ${p.name} не содержит шаблонных скобок.`);
    }

    // Check for SettingsProvider usage (dynamic requisites bind)
    if (content.includes('SettingsProvider.getContactAndLegalSettings') || content.includes('getContactAndLegalSettings')) {
        printSuccess(`Файл ${p.name} использует динамическую привязку реквизитов.`);
    } else {
        printWarning(`Файл ${p.name} может содержать захардкоженные реквизиты. Рекомендуется использовать SettingsProvider.`);
    }
});

// 2. Check forms for personal data consent links
console.log('\n=== Checking GDPR / 15-ФЗ Consent inside Forms ===');
const formFiles = [
    { name: 'Legal Checkbox', relPath: 'src/components/landing/order-engine/LegalCheckbox.tsx' },
    { name: 'Mobile Checkout Wizard', relPath: 'src/components/landing/order-engine/MobileWizard.tsx' },
    { name: 'Guest Support Form', relPath: 'src/components/support/GuestSupportOptions.tsx' },
    { name: 'Login Form', relPath: 'src/app/(auth)/login/login-form.tsx' }
];

formFiles.forEach(f => {
    const fullPath = path.join(ROOT_DIR, f.relPath);
    if (!fs.existsSync(fullPath)) {
        printError(`Форма ${f.name} отсутствует по пути: ${f.relPath}`);
        return;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const hasConsentText = content.includes('согласие') || content.includes('соглашаетесь') || content.includes('персональных данных') || content.includes('политикой') || content.includes('Офертой') || content.includes('Политикой');
    const hasPolicyLink = content.includes('/legal/privacy') || content.includes('LEGAL.PRIVACY') || content.includes('privacy');

    if (hasConsentText && hasPolicyLink) {
        printSuccess(`Форма ${f.name} содержит согласие на обработку персональных данных и ссылку на политику.`);
    } else {
        printError(`Форма ${f.name} не содержит явного согласия с Политикой конфиденциальности или ссылки на /legal/privacy.`);
    }
});

// 3. Check requisites layout
console.log('\n=== Checking Requisites in Footer ===');
const footerPath = path.join(ROOT_DIR, 'src/components/landing/MegaFooter.tsx');
if (fs.existsSync(footerPath)) {
    const content = fs.readFileSync(footerPath, 'utf8');
    const hasRequisites = content.includes('ИНН') || content.includes('ОГРН') || content.includes('SettingsProvider');
    const hasPolicyLink = (content.includes('/legal/privacy') || content.includes('LEGAL.PRIVACY')) && (content.includes('/legal/terms') || content.includes('LEGAL.TERMS'));

    if (hasRequisites) {
        printSuccess('Футер содержит блок реквизитов (ИНН/ОГРН).');
    } else {
        printWarning('В футере не найдены упоминания ИНН/ОГРН. Убедитесь, что реквизиты выводятся динамически.');
    }

    if (hasPolicyLink) {
        printSuccess('Футер содержит ссылки на Политику конфиденциальности и Пользовательское соглашение.');
    } else {
        printError('В футере отсутствуют ссылки на юридические документы (/legal/privacy, /legal/terms).');
    }
} else {
    printError('Файл футера MegaFooter.tsx не найден.');
}

console.log('\n=== Compliance Summary ===');
if (hasFailures) {
    console.log(`${RED}AUDIT FAILED: Обнаружены критические несоответствия законодательству РФ.${NC}`);
    process.exit(1);
} else {
    console.log(`${GREEN}AUDIT SUCCESS: Сайт соответствует основным требованиям законодательства РФ 2026 года.${NC}`);
    process.exit(0);
}
