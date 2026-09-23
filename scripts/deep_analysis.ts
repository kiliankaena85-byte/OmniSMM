import * as fs from 'fs';
import * as path from 'path';

interface ServiceItem {
  id: string;
  numericId: number;
  network: string;
  category: string;
  categorySlug: string;
  name: string;
  slug: string | null;
  description: string | null;
  rate: number;
  markup: number;
  providerCurrency: string;
  pricePer1kRub: number;
  pricePerUnitRub: number;
  minQty: number;
  maxQty: number;
  targetType: string;
  effectiveTargetType: string;
  providerId: string | null;
  providerName: string;
  externalId: string | null;
  qualityTier: string;
  isRefillEnabled: boolean;
  isCancelEnabled: boolean;
  isDripFeedEnabled: boolean;
  badge: string | null;
  warrantyDays: number | null;
  isActive: boolean;
  issues: string[];
  warnings: string[];
}

interface ReportData {
  generatedAt: string;
  usdToRub: number;
  networkSummaries: Record<string, any>;
  totalServices: number;
  servicesWithIssuesCount: number;
  servicesWithWarningsCount: number;
  services: ServiceItem[];
}

const report: ReportData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'audit_video_services_report.json'), 'utf-8'));

let md = `# 📊 ПОЛНЫЙ АУДИТ КАТАЛОГА ВИДЕО И ВИЗУАЛЬНЫХ СОЦСЕТЕЙ (YouTube, Instagram, TikTok, Likee)
*Дата проведения аудита: 30 августа 2026 г.*  
*Текущий кросс-курс USD/RUB:* **${report.usdToRub} ₽**  
*Всего проверено услуг в 4 соцсетях:* **${report.totalServices} шт.**

---

## 🧭 ОБЩАЯ СВОДКА ПО СОЦСЕТЯМ

| Соцсеть | Категорий | Всего услуг | Активных | Выявлено критических аномалий |
| :--- | :---: | :---: | :---: | :---: |
`;

for (const [netKey, s] of Object.entries(report.networkSummaries)) {
  const netServices = report.services.filter(srv => srv.network === netKey);
  const criticals = netServices.filter(srv => srv.issues.length > 0 || srv.pricePerUnitRub > 100 || srv.pricePer1kRub > 50000).length;
  md += `| **${s.networkName}** (${netKey}) | ${s.categoriesCount} | ${s.servicesCount} | ${s.activeServicesCount} | **${criticals}** |\n`;
}

md += `\n---\n\n`;

// Deep Network by Network
const networks = ['youtube', 'instagram', 'tiktok', 'likee'];

for (const net of networks) {
  const netSummary = report.networkSummaries[net];
  const netServices = report.services.filter(s => s.network === net);

  md += `## 🌐 1. СОЦИАЛЬНАЯ СЕТЬ: ${netSummary.networkName.toUpperCase()} (${netServices.length} услуг)\n\n`;

  const categories = Array.from(new Set(netServices.map(s => s.category)));

  for (const catName of categories) {
    const catServices = netServices.filter(s => s.category === catName);
    md += `### 📁 Категория: ${catName} (${catServices.length} услуг)\n\n`;
    md += `| ID | Название услуги | Базовая ставка | Markup | Розница (₽/1k) | За 1 шт | Лимиты | Target | Провайдер | Гарантия / Бейдж |\n`;
    md += `| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

    for (const s of catServices) {
      const priceWarn = (s.pricePer1kRub > 50000 || s.pricePerUnitRub > 50) ? ' 🚨' : '';
      const currIcon = s.providerCurrency === 'USD' ? '$' : '₽';
      md += `| **#${s.numericId}** | ${s.name} | ${s.rate} ${currIcon} | x${s.markup} | **${s.pricePer1kRub.toLocaleString('ru-RU')} ₽**${priceWarn} | **${s.pricePerUnitRub.toFixed(2)} ₽** | ${s.minQty.toLocaleString('ru-RU')} - ${s.maxQty.toLocaleString('ru-RU')} | \`${s.targetType}\` | ${s.providerName} (#${s.externalId}) | ${s.isRefillEnabled ? `♻️ ${s.warrantyDays ?? 30}д` : '—'} / \`${s.qualityTier}\` |\n`;
    }
    md += `\n`;
  }
  md += `---\n\n`;
}

// Write file
fs.writeFileSync(path.join(process.cwd(), 'audit_summary_generated.md'), md, 'utf-8');
console.log('Generated audit_summary_generated.md successfully');
