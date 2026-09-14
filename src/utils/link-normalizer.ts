/**
 * Utility library for social media URL normalization and cleanup.
 * Prevents orders failure due to UTM tracking garbage or incorrect username formatting.
 */

export const MAX_SAFE_URL_LENGTH = 2048;

/**
 * Strips tracking parameters from social media URLs while maintaining their core identity.
 * Handles parameters like utm_*, igsh, fbclid, w (in some contexts).
 */
export function stripQueryParams(url: string): string {
  if (!url) return "";
  const bounded = url.length > MAX_SAFE_URL_LENGTH ? url.slice(0, MAX_SAFE_URL_LENGTH) : url;
  const trimmed = bounded.trim();

  // Try parsing with standard URL parser
  try {
    const parsed = new URL(trimmed);
    const searchParams = parsed.searchParams;
    
    // BUG-3 fix (SIL-2026): split into exact-match set and prefix-match list
    // Prevents "si" from greedily matching sidebar/size/signal on third-party sites
    const exactBlocklist = new Set(["igsh", "igshid", "fbclid", "gclid", "yclid", "ttref", "feature", "si", "ref"]);
    const prefixBlocklist = ["utm_"];

    const keysToDelete: string[] = [];
    searchParams.forEach((_, key) => {
      if (exactBlocklist.has(key) || prefixBlocklist.some(p => key.startsWith(p))) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(k => searchParams.delete(k));

    let result = parsed.toString();
    
    // Remove trailing slash if there are no search params left (clean look)
    if (parsed.search === "" && result.endsWith("/")) {
      result = result.slice(0, -1);
    }
    
    return result;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    // If not a valid absolute URL, do a regex search/replace for common tracking query params
    let cleaned = trimmed;
    cleaned = cleaned.replace(/[?&](igsh|igshid|utm_[a-z0-9_]+|fbclid|yclid|gclid|feature|si|ref)=[^&\s]+/gi, "");
    cleaned = cleaned.replace(/[?&]$/, "");
    return cleaned;
  }
}

/**
 * Infers the platform name from the input string (URL or handle).
 */
export function inferPlatformFromInput(input: string): "instagram" | "telegram" | "vk" | null {
  if (!input) return null;
  const bounded = input.length > MAX_SAFE_URL_LENGTH ? input.slice(0, MAX_SAFE_URL_LENGTH) : input;
  const str = bounded.toLowerCase();
  
  if (str.includes("instagram.com") || str.includes("instagr.am")) {
    return "instagram";
  }
  if (str.includes("t.me") || str.includes("telegram.me")) {
    return "telegram";
  }
  if (str.includes("vk.com") || str.includes("vkontakte.ru")) {
    return "vk";
  }
  
  return null;
}

/**
 * Converts a raw username or handle (e.g. '@username' or 'username') into a full platform URL.
 * If the input already looks like a URL, it is returned query-stripped.
 */
export function normalizeUsername(input: string, platform: string): string {
  if (!input) return "";
  const bounded = input.length > MAX_SAFE_URL_LENGTH ? input.slice(0, MAX_SAFE_URL_LENGTH) : input;
  const trimmed = bounded.trim();

  // If already looks like a full URL, just clean it
  if (/^https?:\/\//i.test(trimmed)) {
    return stripQueryParams(trimmed);
  }

  // Remove leading @ if present
  const cleanHandle = trimmed.replace(/^@/, "");

  // Basic alphanumeric + underscores + dots validation for social handles
  const isValidHandle = /^[a-zA-Z0-9_.]{2,32}$/.test(cleanHandle);
  if (!isValidHandle) {
    return trimmed; // Return as-is if it has invalid chars (could be an invalid link)
  }

  const normPlatform = platform.toLowerCase();
  switch (normPlatform) {
    case "instagram":
      return `https://instagram.com/${cleanHandle}`;
    case "telegram":
      return `https://t.me/${cleanHandle}`;
    case "vk":
      return `https://vk.com/${cleanHandle}`;
    default:
      return trimmed;
  }
}
