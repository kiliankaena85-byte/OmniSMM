import fs from 'node:fs';
import path from 'node:path';

export interface KnowledgeArticle {
  slug: string;
  title: string;
  category: string;
  content: string;
  keywords: string[];
}

class AiKnowledgeRetrieverService {
  private articlesCache: KnowledgeArticle[] | null = null;
  private readonly knowledgeDir = path.join(process.cwd(), 'src', 'data', 'knowledge');

  /**
   * Loads and parses all MDX/MD knowledge articles into memory.
   */
  public getArticles(): KnowledgeArticle[] {
    if (this.articlesCache) return this.articlesCache;

    try {
      if (!fs.existsSync(this.knowledgeDir)) {
        return [];
      }

      const files = fs.readdirSync(this.knowledgeDir);
      const loaded: KnowledgeArticle[] = [];

      for (const file of files) {
        if (!file.endsWith('.md') && !file.endsWith('.mdx')) continue;

        const fullPath = path.join(this.knowledgeDir, file);
        const stat = fs.statSync(fullPath);
        if (stat.size > 64 * 1024) continue; // Skip oversized files to prevent OOM
        // audit-ignore: knowledge base markdown files are verified small static documents (<64KB)
        const raw = fs.readFileSync(fullPath, 'utf8');

        // Extract metadata from frontmatter or heading
        const titleMatch = raw.match(/title:\s*["']([^"']+)["']/i) || raw.match(/^#\s+(.+)$/m);
        const categoryMatch = raw.match(/category:\s*["']([^"']+)["']/i);
        const keywordsMatch = raw.match(/seo_keywords:\s*["']([^"']+)["']/i);

        const title = titleMatch ? titleMatch[1].trim() : file.replace(/\.mdx?$/, '');
        const category = categoryMatch ? categoryMatch[1].trim() : 'Общее';
        const keywords = keywordsMatch 
          ? keywordsMatch[1].toLowerCase().split(',').map((k) => k.trim()) 
          : [];

        // Clean markdown content (strip frontmatter)
        const cleanContent = raw.replace(/^---[\s\S]*?---/m, '').trim();

        loaded.push({
          slug: file.replace(/\.mdx?$/, ''),
          title,
          category,
          content: cleanContent,
          keywords: [...keywords, title.toLowerCase(), file.toLowerCase()],
        });
      }

      this.articlesCache = loaded;
      return loaded;
    } catch (err) {
      console.error('[AiKnowledgeRetriever] Failed to load articles:', err);
      return [];
    }
  }

  /**
   * Retrieves the top relevant knowledge snippet for the given ticket query and service names.
   * @param query Combined user text or inquiry
   * @param services Array of recent service names or error messages
   * @returns Formatted markdown excerpt (up to 1200 chars) for prompt grounding
   */
  public findRelevantKnowledge(query: string, services: string[] = []): string | null {
    const articles = this.getArticles();
    if (articles.length === 0) return null;

    const normalizedQuery = (query + ' ' + services.join(' ')).toLowerCase();

    // Score each article based on keyword and title match
    const scored = articles.map((article) => {
      let score = 0;

      // 1. Direct title match in query
      if (normalizedQuery.includes(article.slug.replace(/-/g, ' '))) score += 10;

      // 2. Keyword matches
      for (const kw of article.keywords) {
        if (kw && normalizedQuery.includes(kw)) {
          score += 5;
        }
      }

      // 3. Specific SMM Domain Heuristics
      if (normalizedQuery.includes('отмен') || normalizedQuery.includes('cancel')) {
        if (article.slug.includes('canceled') || article.slug.includes('target-type')) score += 8;
      }
      if (normalizedQuery.includes('списан') || normalizedQuery.includes('упал') || normalizedQuery.includes('отпис')) {
        if (article.slug.includes('refill') || article.slug.includes('drops') || article.slug.includes('dogs')) score += 8;
      }
      if (normalizedQuery.includes('telegram') || normalizedQuery.includes('тг') || normalizedQuery.includes('телеграм')) {
        if (article.slug.includes('telegram')) score += 6;
      }
      if (normalizedQuery.includes('vk') || normalizedQuery.includes('вк') || normalizedQuery.includes('контакт')) {
        if (article.slug.includes('vk')) score += 6;
      }
      if (normalizedQuery.includes('instagram') || normalizedQuery.includes('инст')) {
        if (article.slug.includes('instagram')) score += 6;
      }
      if (normalizedQuery.includes('youtube') || normalizedQuery.includes('ютуб')) {
        if (article.slug.includes('youtube')) score += 6;
      }

      return { article, score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best || best.score <= 3) {
      // Fallback default helpful article
      const defaultArticle = articles.find((a) => a.slug === 'order-canceled-reasons') || articles[0];
      if (defaultArticle) {
        return `### База Знаний: ${defaultArticle.title}\n${defaultArticle.content.slice(0, 1000)}...`;
      }
      return null;
    }

    // Return the top matched article content snippet
    return `### База Знаний: ${best.article.title}\n${best.article.content.slice(0, 1200)}...`;
  }
}

export const aiKnowledgeRetriever = new AiKnowledgeRetrieverService();
