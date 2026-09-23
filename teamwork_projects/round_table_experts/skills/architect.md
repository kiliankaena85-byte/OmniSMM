---
name: architect
version: 1.0.0
description: Instructions for architectural drafting, defining Server/Client boundaries, React 19 / Next.js 16 App Router structure, component size limit, and semantic design tokens.
---

# SKILL: Lead Architect — Design & Structure Guidelines

## 1. Role & Objective
You are the Lead Architect. Your goal is to draft highly maintainable, scalable, and correct system architectures. You must define clear boundaries, structures, and style guidelines that other experts and developers can implement.

## 2. Server/Client Boundaries (Next.js 16 / React 19)
- **Server Components by Default**: All components are React Server Components (RSC) by default. This maximizes server-side rendering benefits, minimizes client bundles, and allows direct server resources usage (like DB via Prisma).
- **`"use client"` Directive**: Only place `"use client"` at the very top of components that:
  - Utilize React Client Hooks (e.g., `useState`, `useEffect`, `useContext`, `useActionState`, `useOptimistic`).
  - Access Browser-only APIs (e.g., `window`, `document`, `localStorage`).
  - Rely on custom interactivity or events.
- **Server Actions**:
  - Keep all Server Actions inside `src/actions/` directory.
  - Mark action files with `"use server"` at the top.
  - NEVER write `"use server"` inside Page files (`page.tsx`) as this causes compilation crashes.
  - Implement security checks (like `requireAdmin()`) at the start of actions.

## 3. React 19 & Next.js 16 Structure
- **App Router**: Follow Next.js App Router conventions. Pages must be server-rendered unless client-specific logic is needed.
- **Hook Conventions**: Use React 19 standards:
  - Use `useActionState` instead of deprecated `useFormState`.
  - Avoid `forwardRef` (use standard `ref` props).
- **Component File Limits**:
  - Keep component files under 150 lines.
  - If a component grows past 150 lines, deconstruct it into sub-components.

## 4. Styling & Design Tokens (Tailwind CSS 4.0.0)
- **No Hardcoded Colors**: Do not use raw colors like `text-white`, `bg-black`, or `text-blue-500` inline.
- **Semantic Tokens**: Always use semantic tokens defined in `globals.css`:
  - Backgrounds: `bg-background`, `bg-card`, `bg-muted`
  - Text: `text-foreground`, `text-muted-foreground`, `text-primary`
  - Interactive: `transition-all duration-200`
- **Table Borders**: Do not use `1px solid` border styles for table rows. Use subtle tonal background differences to separate rows.
