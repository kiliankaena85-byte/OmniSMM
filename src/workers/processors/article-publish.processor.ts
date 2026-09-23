import { Job } from 'bullmq';
import { db } from '../../lib/db';
import { logger } from '../../lib/logger';

const log = logger.child({ component: 'ArticlePublishWorker' });

export default async function articlePublishProcessor(job: Job) {
  try {
    log.info(`[${job.id}] Starting automated article publishing tick...`);

    // Find the highest priority DRAFT article
    const articleToPublish = await db.article.findFirst({
      where: {
        status: 'DRAFT'
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' } // Older drafts first if priorities are equal
      ]
    });

    if (!articleToPublish) {
      log.info(`[${job.id}] No DRAFT articles found to publish.`);
      return { publishedCount: 0 };
    }

    // Publish it
    const published = await db.article.update({
      where: { id: articleToPublish.id },
      data: {
        status: 'PUBLISHED',
        updatedAt: new Date() // Force timestamp update just in case
      }
    });

    log.info(`[${job.id}] Successfully published article: "${published.title}" (Priority: ${published.priority})`);
    
    return { publishedCount: 1, publishedArticleId: published.id };
  } catch (error) {
    log.error(`[${job.id}] Error during article publishing: ${(error as Error).message}`);
    throw error;
  }
}
