import { test, expect } from '@playwright/test';

test.describe('Frontend Routing Crawl', () => {
  // A set to keep track of visited URLs so we don't visit them multiple times
  const visited = new Set<string>();
  const toVisit: string[] = ['/'];
  const failedUrls: { url: string, status: number | null }[] = [];

  test('Crawl public pages for 404 and 500 errors', async ({ page, context }) => {
    // We will start at the home page
    while (toVisit.length > 0) {
      const path = toVisit.shift()!;
      if (visited.has(path)) continue;
      
      visited.add(path);
      
      console.log(`Crawling: ${path}`);
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      
      if (!response) {
        failedUrls.push({ url: path, status: null });
        continue;
      }

      if (response.status() >= 400) {
        failedUrls.push({ url: path, status: response.status() });
        continue;
      }

      // Ensure that there is no Next.js Not Found UI rendered even if status is 200 (sometimes happens with static exports)
      const isNotFoundUI = await page.getByText('Страница не найдена').isVisible();
      if (isNotFoundUI) {
        failedUrls.push({ url: path, status: 404 });
        continue;
      }

      // Collect all internal links on this page
      const hrefs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
          .map(a => a.getAttribute('href'))
          .filter(href => href && href.startsWith('/')); // Only internal relative links
      });

      // Filter out anchors (#) and duplicates, and add to the visit queue
      for (const href of hrefs) {
        if (!href) continue;
        const cleanPath = href.split('#')[0]; // Remove hash
        if (cleanPath === '' || cleanPath === '/') continue;
        
        // Don't crawl API routes or admin routes in this public test
        if (cleanPath.startsWith('/api') || cleanPath.startsWith('/admin')) continue;
        
        // Don't automatically crawl auth actions
        if (cleanPath === '/login' || cleanPath === '/register' || cleanPath === '/logout') continue;

        if (!visited.has(cleanPath) && !toVisit.includes(cleanPath)) {
          toVisit.push(cleanPath);
        }
      }
    }

    if (failedUrls.length > 0) {
      console.error('Found broken links:', failedUrls);
    }
    
    expect(failedUrls).toHaveLength(0);
  });
});
