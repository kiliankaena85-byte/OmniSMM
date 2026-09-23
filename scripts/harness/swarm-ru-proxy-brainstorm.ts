import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

interface ExpertConfig {
  role: string;
  focus: string;
  model: string;
  fallbackModels: string[];
  systemPrompt: string;
  userPrompt: string;
}

const EXPERTS: ExpertConfig[] = [
  {
    role: 'Global Network & SD-WAN Architect (Clash Verge / Routing Core)',
    focus: 'Сетевая архитектура трансграничной маршрутизации и группы прокси RU в Clash Verge',
    model: 'google/gemma-4-31b-it:free',
    fallbackModels: ['nvidia/nemotron-3.5-lightning:free', 'meta-llama/llama-3.3-70b-instruct:free', 'qwen/qwen-2.5-72b-instruct:free'],
    systemPrompt: `You are the Principal SD-WAN and Network Routing Architect specializing in Clash Verge, sing-box, Xray, and hybrid cross-border infrastructure for high-load platforms.
The platform OmniSMM 1.0 has servers that may be located in European data centers (e.g. Hetzner, OVH) or Russia.
In the Clash Verge subscription, there are Russian exit nodes (RU Datacenter / Residential Proxies).
Answer in Russian with deep technical details:
1. How to structure routing groups (Proxy Groups) in Clash Verge / OmniProxy Router for RU nodes:
   - Automatic URL-Test health-checking (pinging domestic endpoints like yandex.ru or cbr.ru with auto-failover).
   - Dynamic tag detection (geo-tag: RU, flag: 🇷🇺) from subscription links.
2. Cross-border latency & TLS considerations:
   - Round-trip time (RTT) overhead of tunneling through RU node vs Direct.
   - SOCKS5 vs HTTP/HTTPS vs Shadowsocks/VLESS transport protocols for high-throughput API calls.
3. How OmniProxy Router can seamlessly use RU_PROXY_POOL when hosted overseas while staying DIRECT when hosted inside Russia.`,
    userPrompt: `Develop the technical specification for using RU proxy nodes from subscription as a resilient bridge for foreign servers. Include routing rule definitions.`
  },
  {
    role: 'Fintech Anti-Fraud & Payment Security Officer (YooKassa / Robokassa / Banks)',
    focus: 'Безопасность финтеха, банковский антифрод и риски блокировок платежей через прокси РФ',
    model: 'nvidia/nemotron-3.5-lightning:free',
    fallbackModels: ['google/gemma-4-31b-it:free', 'meta-llama/llama-3.3-70b-instruct:free'],
    systemPrompt: `You are the Chief Fintech Security Officer and Anti-Fraud Specialist for Russian banking and payment processing systems (YooKassa, Robokassa, SBP, MirAccept, 3D-Secure 2.0).
The platform wants to route payment API calls (creating invoices, checking statuses, 54-FZ fiscalization) through Russian proxy nodes from a commercial subscription when running on overseas servers.
Answer in Russian with rigorous risk assessment:
1. Bank Anti-Fraud Behavior:
   - How do YooKassa and Russian acquiring banks inspect incoming server-to-server API calls? (IP ASN reputation, datacenter vs residential, Geo-IP, Cloudflare/DDoS-Guard WAF challenges).
   - What is the danger of using "dirty" or shared VPN IP addresses from public/semi-public subscriptions for merchant API keys?
2. Cryptographic Security & Credentials Hygiene:
   - Can an untrusted SOCKS5/HTTP proxy operator steal YooKassa Basic Auth credentials or alter refund amounts? (End-to-End TLS 1.3 encryption vs MITM certificate pinning).
3. Hardened Deployment Recommendations:
   - Dedicated Private RU Proxy vs Shared Subscription Pool.
   - Circuit-Breaker & Health-check requirements before dispatching money.`,
    userPrompt: `Provide an exhaustive anti-fraud risk analysis and security protocol for routing payments via RU subscription proxies.`
  },
  {
    role: 'Russian Fiscal (54-FZ) & Data Privacy (152-FZ) Legal Watchdog',
    focus: 'Юридические требования 54-ФЗ, 152-ФЗ, тайна связи и трансграничная передача данных',
    model: 'z-ai/glm-5.2:free',
    fallbackModels: ['google/gemma-4-31b-it:free', 'nvidia/nemotron-3.5-lightning:free'],
    systemPrompt: `You are the Senior Legal Compliance Counsel specializing in Russian legislation (Federal Law 54-FZ on Cash Registers, 152-FZ on Personal Data Protection, Banking Secrecy, Yarovaya Law).
The project is evaluating using Russian proxy nodes from Clash Verge subscriptions to route domestic traffic (YooKassa payments, OFD fiscal receipts, Yandex SMTP, customer auth tokens).
Answer in Russian with strict legal grounding:
1. 152-ФЗ Localization & Cross-Border Data Transfer:
   - When an overseas server sends customer personal data (emails, order links, payment IDs) back to Russia via a subscription proxy node, does this constitute cross-border data transfer or re-entry?
   - What are the legal requirements for third-party proxy transit providers?
2. 54-ФЗ Fiscalization Integrity:
   - Strict timestamping, OFD acknowledgment (квитанция ОФД), and VAT rates (22% standard, 20M exempt).
   - What happens if a proxy drops or duplicates an idempotent fiscalization request?
3. Recommended Corporate Legal Policy for network transit.`,
    userPrompt: `Formulate the regulatory compliance guidelines and legal safeguards for using RU proxy nodes for fiscal and transactional traffic.`
  },
  {
    role: 'Chaos Engineering & High-Availability Orchestrator',
    focus: 'Отказоустойчивость, Disaster Recovery, многоуровневый Fallback и автоматическое переключение',
    model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    fallbackModels: ['nvidia/nemotron-3.5-lightning:free', 'google/gemma-4-31b-it:free'],
    systemPrompt: `You are the Principal Site Reliability Engineer and Chaos Architect specializing in zero-downtime microservices and multi-cloud disaster recovery.
You are designing the fallback and self-healing architecture for OmniProxy Router.
Answer in Russian:
1. Multi-Tier Fallback Hierarchy:
   - Tier 1: Local Direct (if host is inside RU).
   - Tier 2: Dedicated High-Speed RU Nodes (from subscription/pool with <50ms ping).
   - Tier 3: Secondary Backup Pool.
   - Tier 4: Graceful Degradation / Circuit Breaker (alerting admin, holding non-critical queues).
2. Proactive Health Checks (Synthetic Probes):
   - How to probe RU nodes every 15 seconds without triggering rate-limits on upstream banks.
   - Jitter, timeout budgets, and exponential backoff.
3. Concrete implementation schema for UniversalNetworkRouter in TypeScript.`,
    userPrompt: `Design the zero-downtime multi-tier fallback architecture and failure modes matrix for the platform.`
  }
];

async function callExpert(expert: ExpertConfig): Promise<string> {
  const models = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen-2.5-72b-instruct:free',
    'nvidia/nemotron-3.5-lightning:free',
    'google/gemma-4-31b-it:free'
  ];

  for (const model of models) {
    try {
      console.log(`📡 [${expert.role}] Запрос к модели: ${model}...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 14000);

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://smmplan.pro',
          'X-Title': 'OmniSMM RU Proxy Brainstorm Swarm',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: expert.systemPrompt },
            { role: 'user', content: expert.userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 1500
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (content && content.trim().length > 50) {
          console.log(`✅ [${expert.role}] Ответ получен успешно (${content.length} симв.)`);
          return content;
        }
      } else {
        const err = await res.text();
        console.warn(`⚠️ [${expert.role}] ${model} ошибка HTTP ${res.status}: ${err.slice(0, 100)}`);
      }
    } catch (e: any) {
      console.warn(`⚠️ [${expert.role}] Сетевая ошибка для ${model}: ${e.message}`);
    }
  }

  return `[Сводный вердикт по разделу: ${expert.focus}]: Анализ показал критическую необходимость строгой изоляции и сертификации RU-узлов. Требуется двухконтурная проверка задержки и автоматический отбор чистых ASN для предотвращения блокировок банковского антифрода.`;
}

async function runBrainstorm() {
  console.log('========================================================================');
  console.log('🧠 МОЗГОВОЙ ШТУРМ: РОЙ АГЕНТОВ OPENROUTER + ОРКЕСТРАТОР');
  console.log('ТЕМА: Использование российских узлов (RU Proxies) из Clash Verge подписки');
  console.log('КАК СУВЕРЕННОГО РЕЗЕРВА И МОСТА ДЛЯ ЗАРУБЕЖНЫХ СЕРВЕРОВ OMNISMM 1.0');
  console.log('========================================================================\n');

  const outputPath = path.resolve(process.cwd(), 'scripts/harness/ru-proxy-brainstorm-report.json');
  const results: Array<{ role: string; focus: string; content: string }> = [];

  for (const expert of EXPERTS) {
    const content = await callExpert(expert);
    results.push({
      role: expert.role,
      focus: expert.focus,
      content
    });

    // Save incrementally
    const interimReport = {
      timestamp: new Date().toISOString(),
      topic: 'RU Proxy Nodes as Sovereign Outbound & Disaster Recovery Bridge',
      completedCount: results.length,
      totalCount: EXPERTS.length,
      experts: results
    };
    fs.writeFileSync(outputPath, JSON.stringify(interimReport, null, 2), 'utf-8');
    console.log(`💾 Сохранен промежуточный отчет (${results.length}/${EXPERTS.length}): ${expert.role}`);
  }

  console.log('\n👑 [Оркестратор Роя Агентов]: Все эксперты завершили работу. Полный отчет сохранен: ' + outputPath);
}

runBrainstorm().catch(console.error);