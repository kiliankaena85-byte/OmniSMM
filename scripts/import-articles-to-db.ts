import { PrismaClient, ArticleStatus } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function run() {
  const dir = path.join(process.cwd(), 'src', 'data', 'knowledge');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') || f.endsWith('.mdx'));
  
  console.log(`🔍 Found ${files.length} articles to import.`);
  
  let priority = 1;
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    // Default values
    let title = file.replace(/\.mdx?$/, '');
    let description = '';
    let category = 'knowledge';
    let body = content;
    
    // Parse frontmatter
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (match) {
      const frontmatter = match[1];
      body = match[2].trim();
      
      const titleMatch = frontmatter.match(/title:\s*"([^"]+)"/);
      if (titleMatch) title = titleMatch[1];
      
      const descMatch = frontmatter.match(/description:\s*"([^"]+)"/);
      if (descMatch) description = descMatch[1];
      
      const catMatch = frontmatter.match(/category:\s*"([^"]+)"/);
      if (catMatch) category = catMatch[1];
    }
    
    const slug = file.replace(/\.mdx?$/, '');

    try {
      await prisma.article.upsert({
        where: { slug: slug },
        update: {
          title,
          description,
          content: body,
          category,
          priority: priority,
          status: ArticleStatus.PUBLISHED // Import as published or drip-feed
        },
        create: {
          slug,
          title,
          description,
          content: body,
          category,
          priority: priority,
          status: ArticleStatus.PUBLISHED
        }
      });
      console.log(`✅ Imported: ${slug} (priority: ${priority})`);
      priority++;
    } catch (error: any) {
      console.error(`❌ Error importing ${slug}: ${error.message}`);
    }
  }
  
  console.log(`\n🎉 Finished importing ${files.length} articles into the database!`);
  await prisma.$disconnect();
}

run().catch(console.error);
