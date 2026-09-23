/**
 * Safe SVG Sanitizer & Validator (OWASP A03/A07 Pentest Immunity)
 * Sanitizes arbitrary SVG strings to prevent Stored XSS, XXE, and script execution.
 */

const MAX_SVG_BYTES = 32 * 1024; // 32 KB limit

// Allowed SVG tags in a strict whitelist
const ALLOWED_TAGS = new Set([
  'svg', 'g', 'path', 'circle', 'rect', 'ellipse', 'line', 'polyline', 'polygon',
  'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask',
  'symbol', 'use', 'title', 'desc', 'text', 'tspan'
]);

/**
 * Checks if a string looks like inline SVG markup
 */
export function isSvgMarkup(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.startsWith('<svg') && trimmed.endsWith('</svg>');
}

/**
 * Validates and sanitizes raw SVG markup.
 * Returns sanitized SVG string or returns error.
 */
export function sanitizeSvg(rawSvg: string): { success: boolean; sanitized?: string; error?: string } {
  if (!rawSvg || typeof rawSvg !== 'string') {
    return { success: false, error: 'SVG контент не может быть пустым' };
  }

  const trimmed = rawSvg.trim();

  // 1. Size check
  if (Buffer.byteLength(trimmed, 'utf8') > MAX_SVG_BYTES) {
    return { success: false, error: `Размер SVG превышает допустимый лимит (макс. 32 КБ)` };
  }

  // 2. Reject XXE entity expansions / DOCTYPE
  if (/<!DOCTYPE/i.test(trimmed) || /<!ENTITY/i.test(trimmed)) {
    return { success: false, error: 'SVG содержит недопустимые DOCTYPE/ENTITY объявления (XXE защита)' };
  }

  // 3. Reject active script tags, foreignObject, iframe, embed, object
  if (/<script\b/i.test(trimmed) || /<foreignObject\b/i.test(trimmed) || /<iframe\b/i.test(trimmed) || /<embed\b/i.test(trimmed) || /<object\b/i.test(trimmed)) {
    return { success: false, error: 'SVG содержит запрещенные исполняемые теги (script/foreignObject/iframe)' };
  }

  // 4. Reject dangerous inline JS attributes (on*, javascript:, vbscript:, data:text/html)
  if (/\bon\w+\s*=/i.test(trimmed)) {
    return { success: false, error: 'SVG содержит запрещенные обработчики событий (onload/onclick и др.)' };
  }
  if (/(?:href|xlink:href)\s*=\s*["']?\s*(?:javascript|vbscript|data:text\/html):/i.test(trimmed)) {
    return { success: false, error: 'SVG содержит псевдопротоколы javascript: в ссылках' };
  }

  // 5. Check basic SVG structure
  const svgOpenMatch = trimmed.match(/<svg\b([^>]*)>/i);
  if (!svgOpenMatch || !trimmed.endsWith('</svg>')) {
    return { success: false, error: 'Некорректная структура SVG (отсутствует корневой тег <svg> ... </svg>)' };
  }

  // 6. Clean attributes on the root <svg> tag
  let rootAttrs = svgOpenMatch[1] || '';
  
  // Extract or ensure viewBox
  if (!/viewBox\s*=/i.test(rootAttrs)) {
    const widthMatch = rootAttrs.match(/width\s*=\s*["']?(\d+)["']?/i);
    const heightMatch = rootAttrs.match(/height\s*=\s*["']?(\d+)["']?/i);
    if (widthMatch && heightMatch) {
      rootAttrs += ` viewBox="0 0 ${widthMatch[1]} ${heightMatch[1]}"`;
    } else {
      rootAttrs += ` viewBox="0 0 24 24"`;
    }
  }

  // Strip harmful attributes from the entire content
  const cleaned = trimmed
    // Remove comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove CDATA
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    // Remove on* handlers
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Remove style attributes with expressions or urls
    .replace(/\s+style\s*=\s*["'][^"']*(?:expression|behavior|url\s*\()[^"']*["']/gi, '');

  // 7. Ensure valid tag names
  const tagRegex = /<\/?([a-zA-Z0-9:-]+)/g;
  let match;
  while ((match = tagRegex.exec(cleaned)) !== null) {
    const tagName = match[1].toLowerCase();
    if (!ALLOWED_TAGS.has(tagName) && !tagName.startsWith('svg:')) {
      return { success: false, error: `SVG содержит неподдерживаемый или небезопасный тег <${match[1]}>` };
    }
  }

  return { success: true, sanitized: cleaned };
}

/**
 * Normalizes any icon descriptor into canonical format:
 * - "lucide:<name>"
 * - "brand:<slug>"
 * - "custom:<sanitized_svg>"
 * - null/undefined if empty
 */
export function normalizeIconDescriptor(raw: string | null | undefined): { 
  success: boolean; 
  normalized: string | null; 
  error?: string;
} {
  if (!raw || typeof raw !== 'string') {
    return { success: true, normalized: null };
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    return { success: true, normalized: null };
  }

  // Already prefixed
  if (trimmed.startsWith('lucide:')) {
    const iconName = trimmed.slice(7).trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(iconName)) {
      return { success: false, normalized: null, error: 'Неверное имя Lucide иконки' };
    }
    return { success: true, normalized: `lucide:${iconName}` };
  }

  if (trimmed.startsWith('brand:')) {
    const slug = trimmed.slice(6).trim().toLowerCase();
    if (!/^[a-z0-9-_]+$/.test(slug)) {
      return { success: false, normalized: null, error: 'Неверный slug бренда' };
    }
    return { success: true, normalized: `brand:${slug}` };
  }

  if (trimmed.startsWith('custom:')) {
    const svgBody = trimmed.slice(7).trim();
    const sanitizeResult = sanitizeSvg(svgBody);
    if (!sanitizeResult.success) {
      return { success: false, normalized: null, error: sanitizeResult.error };
    }
    return { success: true, normalized: `custom:${sanitizeResult.sanitized}` };
  }

  // Raw SVG without prefix
  if (isSvgMarkup(trimmed)) {
    const sanitizeResult = sanitizeSvg(trimmed);
    if (!sanitizeResult.success) {
      return { success: false, normalized: null, error: sanitizeResult.error };
    }
    return { success: true, normalized: `custom:${sanitizeResult.sanitized}` };
  }

  // Plain identifier (e.g. "heart" -> "lucide:heart", "telegram" -> "brand:telegram")
  const lower = trimmed.toLowerCase();
  if (['telegram', 'vk', 'instagram', 'youtube', 'tiktok', 'twitch', 'discord', 'pinterest', 'twitter', 'x', 'facebook', 'spotify', 'soundcloud', 'ok', 'odnoklassniki', 'whatsapp', 'viber', 'snapchat', 'reddit', 'linkedin', 'dzen', 'rutube', 'kick', 'steam', 'threads', 'medium', 'likee', 'kwai', 'max'].includes(lower)) {
    return { success: true, normalized: `brand:${lower}` };
  }

  if (/^[a-z0-9-]+$/.test(lower)) {
    return { success: true, normalized: `lucide:${lower}` };
  }

  return { success: false, normalized: null, error: 'Нераспознанный формат иконки' };
}
