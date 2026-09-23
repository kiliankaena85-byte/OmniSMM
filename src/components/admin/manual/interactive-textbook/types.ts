/**
 * Interactive Textbook (OmniManual 1.0)
 * Level 0 Domain Types & Schemas
 * Standard: ГОСТ ЕСПД 19.505-79 / Роспатент / ISO 9241-110
 */

export type TextbookDomainId =
  | 'ARCH'
  | 'DASHBOARD'
  | 'ORDERS'
  | 'TICKETS'
  | 'CATALOG'
  | 'PROVIDERS'
  | 'FINANCE'
  | 'SETTINGS'
  | 'RUNBOOKS';

export interface TextbookDomain {
  id: TextbookDomainId;
  title: string;
  shortTitle: string;
  icon: string;
  colorClass: string;
  description: string;
  volumeNumber: number;
}

export type CalloutType = 'NOTE' | 'TIP' | 'WARNING' | 'CRITICAL' | 'LEGAL';

export interface CalloutBadge {
  type: CalloutType;
  title: string;
  content: string;
  codeSnippet?: string;
  ruleReference?: string;
}

export interface ScreenshotHotspot {
  xPercent: number;
  yPercent: number;
  title: string;
  description: string;
  badgeNumber: number;
}

export interface TextbookScreenshot {
  src: string;
  caption: string;
  altText: string;
  hotspots?: ScreenshotHotspot[];
}

export type DiagramType =
  | 'TOPOLOGY'
  | 'ORDER_FLOW'
  | 'LEDGER_AUDIT'
  | 'CIRCUIT_BREAKER'
  | 'SUPPORT_ESCALATION'
  | 'SYSTEM_SETTINGS';

export interface TextbookChecklistItem {
  id: string;
  title: string;
  detail: string;
  isMandatory?: boolean;
}

export interface TextbookTerm {
  term: string;
  definition: string;
}

export interface TroubleshootingCase {
  scenario: string;
  symptoms: string;
  solution: string;
  emergencyCommand?: string;
}

export interface TextbookChapter {
  id: string;
  domainId: TextbookDomainId;
  volumeNumber: number;
  chapterNumber: number;
  title: string;
  subtitle: string;
  readTimeMinutes: number;
  iconName: string;
  targetRoute?: string;
  // ГОСТ ЕСПД 19.505-79 6 mandatory sections
  section1Scope: string;
  section2Terms: TextbookTerm[];
  section3Architecture: {
    description: string;
    diagramType?: DiagramType;
    coreTables?: string[];
    coreActions?: string[];
  };
  section4Walkthrough: {
    steps: Array<{
      stepNumber: number;
      title: string;
      description: string;
      actionUrl?: string;
      actionLabel?: string;
    }>;
  };
  section5Safeguards: {
    rules: Array<{
      code: string;
      name: string;
      description: string;
    }>;
  };
  section6Troubleshooting: TroubleshootingCase[];
  // Interactive additions
  callouts: CalloutBadge[];
  screenshot?: TextbookScreenshot;
  checklist: TextbookChecklistItem[];
  tags: string[];
}
