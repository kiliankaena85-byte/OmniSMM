'use client';

import * as React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface MarketingTabsProps {
  promocodesContent: React.ReactNode;
  referralsContent: React.ReactNode;
}

export function MarketingTabs({ promocodesContent, referralsContent }: MarketingTabsProps) {
  return (
    <Tabs defaultValue="promocodes">
      <TabsList className="bg-muted/50 p-1 rounded-lg border border-border/60 shadow-xs">
        <TabsTrigger value="promocodes" className="rounded-md px-5 py-1.5 font-bold uppercase tracking-wider text-xs">
          Промокоды
        </TabsTrigger>
        <TabsTrigger value="referrals" className="rounded-md px-5 py-1.5 font-bold uppercase tracking-wider text-xs">
          Партнерская программа
        </TabsTrigger>
      </TabsList>

      <TabsContent value="promocodes">
        <div className="pt-4">{promocodesContent}</div>
      </TabsContent>
      <TabsContent value="referrals">
        <div className="pt-4">{referralsContent}</div>
      </TabsContent>
    </Tabs>
  );
}
