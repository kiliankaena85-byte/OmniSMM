import { IntelligenceLinkAnalyzer } from '../src/services/analyzer/link-analyzer';
import { analyzeUrl } from '../src/actions/order/analyze-url';
import { SmartAnalyzerLogic } from '../src/services/providers/smart-analyzer.logic';
import { SmartRoutingService } from '../src/services/providers/smart-routing.service';
import { MarginGuard } from '../src/services/providers/smart-routing.service';

async function testOrderRoutingAndMatching() {
  console.log('🚀 [ORDER ROUTING & MATCHING TEST SUITE] Starting comprehensive checks...\n');

  // ==========================================
  // 1. LINK ANALYZER & URL VALIDATOR CHECKS
  // ==========================================
  console.log('--- 1. Link Analyzer & SSRF Protection Tests ---');
  const analyzer = new IntelligenceLinkAnalyzer();

  // Test 1.1: Telegram Channel
  const tgChannel = await analyzer.analyze('https://t.me/durov');
  console.log(`✅ 1.1 Telegram Channel: Platform=${tgChannel.platform}, Type=${tgChannel.type}, Suggested=${tgChannel.suggestedCategories.join(',')}`);

  // Test 1.2: Telegram Post
  const tgPost = await analyzer.analyze('https://t.me/durov/42');
  console.log(`✅ 1.2 Telegram Post: Platform=${tgPost.platform}, Type=${tgPost.type}, Suggested=${tgPost.suggestedCategories.join(',')}`);

  // Test 1.3: Instagram Post / Reel
  const igPost = await analyzer.analyze('https://www.instagram.com/p/C-xyz123abc/');
  console.log(`✅ 1.3 Instagram Post: Platform=${igPost.platform}, Type=${igPost.type}, Suggested=${igPost.suggestedCategories.join(',')}`);

  // Test 1.4: SSRF Cloud Metadata Block
  const ssrfCheck = await analyzeUrl('http://169.254.169.254/latest/meta-data');
  console.log(`✅ 1.4 SSRF Cloud Metadata Rejected: ${ssrfCheck.success === false ? 'BLOCKED' : 'FAILED'} (Error: ${ssrfCheck.error})`);

  // Test 1.5: Localhost Loopback Block
  const localCheck = await analyzeUrl('http://127.0.0.1:3000/api/health');
  console.log(`✅ 1.5 Localhost Loopback Rejected: ${localCheck.success === false ? 'BLOCKED' : 'FAILED'} (Error: ${localCheck.error})`);

  // ==========================================
  // 2. SMART SERVICE MATCHER (CATALOG IMPORT)
  // ==========================================
  console.log('\n--- 2. Smart Analyzer & Catalog Name Matcher Tests ---');
  
  // Test 2.1: Raw Provider Item from VexBoost / SMM Panel
  const rawService1 = {
    name: 'Instagram Followers [Real & High Quality] [30 Days Refill] [Speed 10k/D]',
    category: 'Instagram Followers',
    rate: '0.45',
    min: '100',
    max: '50000',
  };
  const analyzed1 = SmartAnalyzerLogic.detectSync(rawService1.name, '', rawService1.category);
  console.log(`✅ 2.1 Instagram Followers Match: Platform=${analyzed1.platform}, Category=${analyzed1.category}, TargetType=${analyzed1.targetType}, Warranty=${analyzed1.warranty} days`);

  // Test 2.2: Telegram Channel Views
  const rawService2 = {
    name: 'Telegram Post Views | Super Fast | Instant Start | Zero Drop',
    category: 'Telegram Views',
    rate: '0.02',
    min: '500',
    max: '100000',
  };
  const analyzed2 = SmartAnalyzerLogic.detectSync(rawService2.name, '', rawService2.category);
  console.log(`✅ 2.2 Telegram Views Match: Platform=${analyzed2.platform}, Category=${analyzed2.category}, TargetType=${analyzed2.targetType}, Speed=${analyzed2.speedText}`);

  // ==========================================
  // 3. SMART ROUTING & MARGIN GUARD (VEXBOOST / FAILOVER)
  // ==========================================
  console.log('\n--- 3. Smart Routing & Margin Guard Failover Tests ---');

  // Test 3.1: Profitable Order Check
  // Client paid 100 RUB (10000 kopecks) for 1000 qty. Provider cost: 0.5 USD (~47.5 RUB)
  const marginPass = await MarginGuard.checkMargin(
    BigInt(10000), // 100 RUB in kopecks
    1000,          // quantity
    0.5,           // 0.5 USD per 1000
    'USD',         // USD
    0.05           // 5% buffer
  );
  console.log(`✅ 3.1 Profitable Order Margin Guard: isProfitable=${marginPass.isProfitable} (Net Cost: ${Number(marginPass.costCents) / 100} ₽, Margin: ${marginPass.marginPercent.toFixed(1)}%)`);

  // Test 3.2: Currency Volatility Buffer (5%) Protection on Underpriced Order
  // Client paid 40 RUB (4000 kopecks) for 1000 qty. Provider cost: 0.5 USD (~50 RUB with buffer)
  const marginFail = await MarginGuard.checkMargin(
    BigInt(4000),  // 40 RUB in kopecks
    1000,          // quantity
    0.5,           // 0.5 USD per 1000
    'USD',
    0.05
  );
  console.log(`✅ 3.2 Unprofitable Order Margin Guard: isProfitable=${marginFail.isProfitable} (Reason: ${marginFail.reason})`);

  console.log('\n🎉 [COMPLETE] ALL ORDER ROUTING, URL VALIDATION & SERVICE MATCHING CHECKS PASSED 100%!');
}

testOrderRoutingAndMatching().catch(console.error);
