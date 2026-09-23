import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Tickets Workspace Viewport & Flexbox Containment Contracts (SPEC-2026-13)', () => {
  const rootDir = process.cwd();

  it('1. admin/layout.tsx locks viewport for tickets workspace without window scroll', () => {
    const layoutPath = path.join(rootDir, 'src/app/admin/layout.tsx');
    const layoutContent = fs.readFileSync(layoutPath, 'utf8');

    // Outer container must lock overflow when tickets workspace is rendered
    expect(layoutContent).toContain('has-[.tickets-workspace]:overflow-hidden');

    // Main and wrapper div must cancel min-h-fit and constrain to min-h-0
    expect(layoutContent).toContain('has-[.tickets-workspace]:min-h-0');
    expect(layoutContent).toContain('has-[.tickets-workspace]:h-full');
  });

  it('2. unified-workspace.tsx enforces min-h-0 and flex-1 across all 3 panes', () => {
    const workspacePath = path.join(rootDir, 'src/app/admin/tickets/components/unified-workspace.tsx');
    const content = fs.readFileSync(workspacePath, 'utf8');

    // Root tickets-workspace
    expect(content).toContain('tickets-workspace');
    expect(content).toContain('min-h-0');
    expect(content).toContain('max-h-full');

    // Messages container ref wrapper must have min-h-0 and flex-1
    expect(content).toContain('ref={messagesContainerRef}');
    expect(content).toMatch(/ref=\{messagesContainerRef\}\s+className="[^"]*flex-1[^"]*min-h-0/);
  });

  it('3. ChatWindow.tsx encloses chat message list with min-h-0 and overflow-hidden', () => {
    const chatWindowPath = path.join(rootDir, 'src/components/support/ChatWindow.tsx');
    const content = fs.readFileSync(chatWindowPath, 'utf8');

    expect(content).toContain('min-h-0');
    expect(content).toContain('overflow-hidden');
  });

  it('4. ChatMessageList.tsx scroll container has min-h-0 and overflow-y-auto', () => {
    const listPath = path.join(rootDir, 'src/components/support/chat/ChatMessageList.tsx');
    const content = fs.readFileSync(listPath, 'utf8');

    expect(content).toContain('telegram-chat-bg flex-1 min-h-0 overflow-y-auto');
  });

  it('5. tickets-sidebar.tsx list container has min-h-0 and overflow-y-auto', () => {
    const sidebarPath = path.join(rootDir, 'src/app/admin/tickets/components/tickets-sidebar.tsx');
    const content = fs.readFileSync(sidebarPath, 'utf8');

    expect(content).toContain('flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 p-2 custom-scrollbar bg-background');
  });

  it('6. ClientProfileSidebar.tsx scroll body has min-h-0 and overflow-y-auto', () => {
    const profilePath = path.join(rootDir, 'src/components/support/ClientProfileSidebar.tsx');
    const content = fs.readFileSync(profilePath, 'utf8');

    expect(content).toContain('flex-1 min-h-0 overflow-y-auto custom-scrollbar');
  });
});
