import { guideTelegram } from './pillars/guide-telegram';
import { guideInstagram } from './pillars/guide-instagram';
import { smmApiGuide } from './pillars/smm-api-guide';
import { howToChooseSmmPanel } from './pillars/how-to-choose-smm-panel';
import { guideVk } from './pillars/guide-vk';
import { glossaryTerms, GlossaryTerm } from './glossary';

import { telegramClusters, ClusterArticle } from './clusters/telegram';
import { instagramClusters } from './clusters/instagram';
import { apiClusters } from './clusters/api';
import { chooseClusters } from './clusters/choose';
import { vkClusters } from './clusters/vk';

export interface PillarPage {
  slug: string;
  title: string;
  metaTitle: string;
  excerpt: string;
  contentHtml: string;
  faq: Array<{ question: string; answer: string }>;
  readTimeMinutes: number;
  network: string;
  category: string;
  parentPillar?: string;
}

export const pillarPages: PillarPage[] = [
  guideTelegram,
  guideInstagram,
  smmApiGuide,
  howToChooseSmmPanel,
  guideVk,
];

export const clusterArticles: ClusterArticle[] = [
  ...telegramClusters,
  ...instagramClusters,
  ...apiClusters,
  ...chooseClusters,
  ...vkClusters,
];

export {
  guideTelegram,
  guideInstagram,
  smmApiGuide,
  howToChooseSmmPanel,
  guideVk,
  glossaryTerms,
  telegramClusters,
  instagramClusters,
  apiClusters,
  chooseClusters,
  vkClusters,
};

export type { GlossaryTerm, ClusterArticle };
