'use client';

/**
 * Root Coordinator: Admin AI Operating Manual & Copilot (OmniManual 1.0)
 * Complies with Clean Architecture Level 3 Presentation Layer (<= 200 lines)
 */

import React, { useState, useEffect } from 'react';
import type { AdminAiManualWidgetProps, ManualTabType } from './types';
import type { DockerMemoryStatus } from '@/types/admin-ai-manual';
import { getDockerMemoryStatusAction } from '@/actions/admin/ai-manual/guides.action';
import { ManualFloatingTrigger } from './sub/ManualFloatingTrigger';
import { ManualHeader } from './sub/ManualHeader';
import { ManualChatTab } from './sub/ManualChatTab';
import { ManualGuidesTab } from './sub/ManualGuidesTab';
import { ManualInspectorTab } from './sub/ManualInspectorTab';

export const AdminAiManualWidget: React.FC<AdminAiManualWidgetProps> = ({
  userRole = 'SUPPORT',
  activeTenantId = 'smmplan',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ManualTabType>('chat');
  const [memoryStatus, setMemoryStatus] = useState<DockerMemoryStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // Initial fetch of Docker Vector Memory status
  useEffect(() => {
    let isMounted = true;
    getDockerMemoryStatusAction()
      .then((res) => {
        if (isMounted && res.success && res.status) {
          setMemoryStatus(res.status);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingStatus(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Global Keyboard Shortcut: Ctrl + / or Cmd + /
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '/' || e.key === '.')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* Floating Trigger Button */}
      <ManualFloatingTrigger
        isOpen={isOpen}
        onToggle={() => setIsOpen(true)}
      />

      {/* Slide-in Drawer Container */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Интерактивная инструкция и ИИ-консультант"
          className="fixed inset-0 z-50 flex justify-end bg-background/40 backdrop-blur-xs transition-opacity duration-200"
        >
          {/* Backdrop dismiss */}
          <div
            className="absolute inset-0 cursor-pointer"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Body */}
          <div className="relative w-full max-w-[480px] h-full bg-background border-l border-border/80 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
            <ManualHeader
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onClose={() => setIsOpen(false)}
              memoryStatus={memoryStatus}
              isLoadingStatus={isLoadingStatus}
            />

            <div className="flex-1 min-h-0 overflow-hidden relative">
              {activeTab === 'chat' && (
                <ManualChatTab
                  userRole={userRole}
                  activeTenantId={activeTenantId}
                />
              )}
              {activeTab === 'guides' && <ManualGuidesTab />}
              {activeTab === 'inspector' && <ManualInspectorTab />}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
