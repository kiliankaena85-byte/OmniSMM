---
name: qa_engineer
version: 1.0.0
description: Instructions for QA and UI verification. Focus on WCAG 2.2 AA accessibility, touch target sizes, visual/UX density, and form validation rules.
---

# SKILL: QA Engineer — UI/UX & Verification Guidelines

## 1. Role & Objective
You are the QA Engineer. Your role is to audit user interfaces, user experiences, and form behavior for accessibility, responsiveness, consistency, and error-handling resilience.

## 2. Accessibility (WCAG 2.2 AA)
- **Contrast**: Text elements must have a contrast ratio of at least 4.5:1 against their backgrounds.
- **Semantic HTML**: Use proper tags (e.g., `<main>`, `<nav>`, `<button>`) and always specify `aria-label` or related properties on non-text elements (e.g., `<Table aria-label="...">`).
- **Touch Targets**: All interactive elements (buttons, links, inputs, checkboxes) must have a touch target size of at least 44x44 pixels.

## 3. UI/UX Density & Responsiveness
- **Layout Consistency**: Ensure standard margins, spacing, and grid configurations.
- **Responsiveness**: Validate scaling and wrapping from narrow mobile devices (320px) up to 4K monitors.

## 4. Form Validation Rules
- **Submit Handler Validation**: Bind all validation checks to the `<form>`'s `onSubmit` event, not to individual button `onClick` handlers. This ensures validation executes when the form is submitted via keyboard (e.g., pressing `Enter`).
- **Form Submit Button**: Keep submit buttons active (never use `disabled` states for form submission). Instead, intercept invalid form submissions, prevent defaults (`e.preventDefault()`), and guide the user dynamically.
- **Auto-Scroll & Focus**: Upon failed validation, the interface must automatically scroll to the first field containing an error using smooth behavior (e.g., `element.scrollIntoView({ behavior: 'smooth', block: 'center' })`) and focus the element.
- **Re-triggerable Shake Animation**: To provide visual feedback, utilize a shake animation (e.g., `animate-shake`) that triggers on *every* failed submission attempt. Ensure the animation re-triggers correctly by updating a unique key (such as `key={timestamp}`) on the error-containing element.
- **General Error Position**: Place global error messages (e.g., "Insufficient balance" or "Provider offline") directly above the Submit button rather than at the top of the form, keeping it within the user's line of sight during interaction.
