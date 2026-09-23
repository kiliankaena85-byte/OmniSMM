import { execSync } from 'child_process';

const API_URL = 'http://localhost:8100/api/knowledge';

interface KnowledgeEntry {
  content: string;
  category: string;
  title: string;
  tags: string[];
  metadata?: Record<string, any>;
}

// Smmplan-specific architecture decisions, pricing rules, and coding conventions
const entries: KnowledgeEntry[] = [
  {
    title: 'Smmplan Core Stack & Environment Conventions',
    category: 'architecture_decisions',
    tags: ['stack', 'versions', 'nextjs', 'react', 'tailwind', 'eslint'],
    content: `## Smmplan Technology Stack (February 2026)
- **Framework**: Next.js 16.2.6 (App Router, Turbopack enabled)
- **UI**: React 19.2.6 (strict mode)
- **Styling**: Tailwind CSS 4.0.0 (CSS-first config, using '@theme' directive in globals.css)
- **Component Library**: HeroUI v3 (dot notation API like '<Table.Header>')
- **ORM**: Prisma 5 (PostgreSQL database client)
- **AI Model**: 'gemini-3.5-flash' (use this exact model name for AI logic in the code)
- **Linting**: ESLint 10 (Flat Config in 'eslint.config.mjs')
- **Testing**: Vitest 4 for unit and integration testing`
  },
  {
    title: 'Smmplan Pricing Model & Financial Calculations',
    category: 'business_rules',
    tags: ['pricing', 'currency', 'markup', 'usd', 'rub'],
    content: `## Pricing Model - Critical Rules
1. **Providers rate**: Providers store 'rate' in USD per 1000 items (industry standard for SMM panels).
2. **Catalog calculation fields**:
   - 'pricePer1kRub' = rate * markup * usdToRub (Calculates retail price per 1000 items in Rubles).
   - 'pricePerUnitRub' = pricePer1kRub / 1000 (Calculates retail price per 1 unit in Rubles).
3. **UI Requirements**:
   - The user MUST ALWAYS see the price per 1 unit ('pricePerUnitRub'), displayed as '₽ / шт'.
   - NEVER show 'pricePer1kRub' directly in the client catalog or UI.
   - Do not divide 'pricePer1kRub' manually inside React components; always read 'pricePerUnitRub' directly from the data object.`
  },
  {
    title: 'Smmplan Link Analyzer targetType Mapping',
    category: 'business_rules',
    tags: ['target-type', 'category', 'links', 'validation'],
    content: `## Link Analyzer targetType Mapping Rules
1. **targetType**: Defines what kind of link is expected from the client (channel, post, story, custom).
2. **Category to targetType Mapping**:
   - 'Подписчики / Участники / Бусты / Группы / Друзья' -> 'CHANNEL' (expects profile or channel link)
   - 'Лайки / Просмотры / Комментарии / Реакции / Репосты' -> 'POST' (expects specific post link)
   - 'Stories' -> 'STORY' (expects profile link)
   - 'Звёзды' -> 'CUSTOM'
3. **Validation Fallback**: Use 'inferTargetTypeFromCategory(categoryName)' from 'src/utils/target-type.ts' as the fallback. Never hardcode fallback defaults like 'service.targetType || "POST"' directly in orders.`
  },
  {
    title: 'Smmplan Payment Gateway API Rules',
    category: 'business_rules',
    tags: ['payments', 'yookassa', 'robokassa', 'billing', 'fallback'],
    content: `## Payment Gateway Integration Rules
1. **Real API execution**: API requests to gateways (YooKassa, Robokassa) must run. Local mock redirect '/api/dev/mock-payment' is ONLY allowed if all gateway credentials in settings are empty or set to default placeholders ('test_shop_id', 'test_login').
2. **Test keys fallback**: In development environment, if real credentials have default placeholders, but test keys are configured (e.g. 'yookassaTestShopId'), the application must switch to these test keys and make real API requests.`
  },
  {
    title: 'Smmplan Base UI Select Pattern',
    category: 'coding_conventions',
    tags: ['select', 'base-ui', 'ui-components', 'pattern'],
    content: `## Base UI Select (@base-ui/react) Convention
1. **Trigger label resolving**: The 'label' prop on 'SelectItem' only works for keyboard typeahead, NOT for rendering the selected value in the Select trigger.
2. **Trigger formatting**: Use a children function inside '<SelectValue>' to resolve custom CUIDs or IDs to names:
   \`\`\`tsx
   <SelectValue placeholder="-- Выберите --">
     {(value: string) => {
       if (!value) return null;
       return items.find(item => item.id === value)?.name ?? value;
     }}
   </SelectValue>
   \`\`\`
   Do not use self-closing '<SelectValue />' when values are CUIDs or database IDs.`
  },
  {
    title: 'Smmplan Production Deployment & Worker Configuration',
    category: 'architecture_decisions',
    tags: ['deployment', 'workers', 'pm2', 'docker', 'nginx', 'bullmq'],
    content: `## Production Deployment & Daemon Setup
1. **Workers execution**: The background processing workers (running BullMQ task indexer via 'npm run worker') must run in parallel with Next.js web server ('next start'). If workers aren't active, tasks remain stuck in Redis as 'PENDING'.
2. **Nginx config reload**: After restarting Docker containers, Nginx configuration must be reloaded to clean cache and restore upstream links:
   'docker compose exec nginx nginx -s reload'`
  },
  {
    title: 'Smmplan Provider Catalog Cherry-Picking',
    category: 'architecture_decisions',
    tags: ['catalog', 'redis', 'cherry-pick', 'synchronization'],
    content: `## Provider Synchronization Rules
1. **Shadow Catalog (Redis Buffer)**: Never write raw provider service list (5000+ items) directly to the PostgreSQL 'Service' table. Store provider API lists in a Redis cache key 'provider:{id}:catalog'.
2. **Cherry-Pick Import**: The admin works with the catalog front-end using Redis cache. Only selected items mapped with AI categories are imported into PostgreSQL.
3. **Margin & Pricing recalculation**: The Margin Worker must recalculate retail rates based on CB RF currency cross-rates (USD/RUB) and target margins rather than just disabling services when provider rates increase.
4. **Zombie Eraser**: Nightly cron jobs must set 'isActive = false' for services deleted from provider's endpoint.`
  },
  {
    title: 'Smmplan UI & UX Density: App Interface vs Landing Page',
    category: 'coding_conventions',
    tags: ['ui', 'ux', 'density', 'landing', 'app-router', 'design-system'],
    content: `## UI & UX Density Rules: App Interface vs Landing Page
1. **App Interface (User Dashboard & Admin Panel)**:
   - **Visual Style**: Sleek API design (inspired by Stripe/Vercel), dark mode first, high data density.
   - **Data Density**: Compact tables, zero unnecessary whitespace, clear borders (using tone contrast instead of 1px solid lines), and multi-column info blocks to reduce vertical scrolling.
   - **Typography**: Small, crisp font sizes, tighter line heights for fast data scanning.
   - **Interactions**: Instant feedback, micro-animations, keyboard-friendly navigation.
2. **Landing Page (Public Web Site)**:
   - **Visual Style**: Clean, modern, conversion-focused layout (optimized for RuNet visual culture).
   - **Whitespace**: Generous margins and paddings, large headings (Outfit/Inter), readable Cyrillic typography (with +15-20% text expansion accounted for).
   - **Interactions**: Smooth scroll-based animations, engaging hover states, clear CTAs (Call to Actions) with conversion triggers (e.g. secure payment badges).
   - **Goal**: High emotional trust and conversion. Avoid API dashboard complexity; keep layouts simple and visual.`
  }
];

async function run() {
  console.log('Starting Smmplan Knowledge Base bootstrap...');
  
  for (const entry of entries) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      });
      
      if (response.ok) {
        console.log(`✅ Seeded: "${entry.title}"`);
      } else {
        const errText = await response.text();
        console.error(`❌ Failed to seed "${entry.title}": ${response.status} - ${errText}`);
      }
    } catch (error: any) {
      console.error(`❌ Network error seeding "${entry.title}": ${error.message}`);
    }
  }
  
  console.log('Bootstrap execution finished.');
}

run();
