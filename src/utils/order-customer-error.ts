/**
 * Zero Vendor Leak & Customer-Facing Error Sanitizer (RAC-2026 / CWE-209 Gate)
 * 
 * Strict Invariants:
 * 1. ZERO Vendor/Provider Leaks: Never expose upstream names (e.g. Vexboost, Soc-Rocket, SmmPrime).
 * 2. ZERO Internal Tech Leaks: Never expose SSRF tags, Clash/Mihomo, DNS errors, admin URLs, or operator instructions.
 * 3. Orders in PENDING_CHECK, PENDING, or PROVISIONING never display technical error alerts to the user.
 * 4. Only genuine, actionable user errors (private profile, invalid link, deleted post) are translated cleanly.
 */

export function getCustomerFacingOrderError(
  status: string,
  rawError: string | null | undefined
): string | null {
  if (!rawError || typeof rawError !== 'string') {
    return null;
  }

  const trimmed = rawError.trim();
  if (!trimmed) {
    return null;
  }

  // 1. Orders undergoing automated verification or pending start do NOT show technical error alerts
  const normalizedStatus = status.toUpperCase();
  if (
    normalizedStatus === 'PENDING_CHECK' ||
    normalizedStatus === 'PENDING' ||
    normalizedStatus === 'PROVISIONING' ||
    normalizedStatus === 'AWAITING_PAYMENT'
  ) {
    return null;
  }

  const lower = trimmed.toLowerCase();

  // 2. Identify and isolate network / SSRF / system flags so they are NEVER confused with user privacy
  const isSsrfOrInternalNetwork =
    lower.includes('private ip') ||
    lower.includes('ssrf') ||
    lower.includes('private network') ||
    lower.includes('blocked url') ||
    lower.includes('clash') ||
    lower.includes('mihomo') ||
    lower.includes('dns-резолв') ||
    lower.includes('шлюз');

  // 3. Genuine User Actionable Issues
  // A. Private Account / Channel / Group
  if (
    !isSsrfOrInternalNetwork &&
    (lower.includes('account is private') ||
      lower.includes('profile is private') ||
      lower.includes('channel is private') ||
      lower.includes('group is private') ||
      lower.includes('target is private') ||
      lower.includes('is private') ||
      lower.includes('closed profile') ||
      lower.includes('profile is closed') ||
      lower.includes('приватный') ||
      lower.includes('закрытый') ||
      lower.includes('закрыт аккаунт') ||
      lower.includes('закрытый профиль') ||
      lower.includes('закрытый канал'))
  ) {
    return 'Целевой аккаунт или канал закрыт настройками приватности. Пожалуйста, откройте доступ к профилю/каналу.';
  }

  // B. Invalid Link / Format Mismatch
  if (
    lower.includes('invalid link') ||
    lower.includes('bad link') ||
    lower.includes('link is broken') ||
    lower.includes('невалидная ссылка') ||
    lower.includes('некорректная ссылка') ||
    lower.includes('неверная ссылка') ||
    lower.includes('link format') ||
    lower.includes('invalid url') ||
    lower.includes('wrong link')
  ) {
    return 'Указана некорректная ссылка на объект. Пожалуйста, проверьте правильность формата ссылки.';
  }

  // C. Post or Target Deleted / Not Found
  if (
    lower.includes('post not found') ||
    lower.includes('not found') ||
    lower.includes('объект не найден') ||
    lower.includes('пост удален') ||
    lower.includes('страница не найдена') ||
    lower.includes('404')
  ) {
    return 'Публикация или страница по указанной ссылке не найдена либо была удалена.';
  }

  // D. Limits (Min / Max quantity)
  if (
    lower.includes('too small') ||
    lower.includes('too large') ||
    lower.includes('exceed limit') ||
    lower.includes('превышен лимит')
  ) {
    return 'Объём заказа не соответствует допустимым границам услуги.';
  }

  // 4. Default Calm Fallback for All Technical / Upstream / Margin / Network Glitches
  return 'Временная техническая задержка выполнения. Заказ обрабатывается системой.';
}
