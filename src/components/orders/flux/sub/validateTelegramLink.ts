export interface TelegramLinkValidationResult {
  valid: boolean;
  message: string;
  postId?: string;
  isSingle?: boolean;
}

export function validateTelegramLink(testLink: string): TelegramLinkValidationResult | null {
  if (!testLink.trim()) return null;
  const lower = testLink.toLowerCase().trim();
  if (lower.includes('t.me/') || lower.includes('telegram.me/')) {
    const isSingle = lower.includes('?single');
    const parts = lower.split('/');
    const lastPart = parts[parts.length - 1]?.split('?')[0];
    const isPost = !isNaN(Number(lastPart));

    if (isPost) {
      return {
        valid: true,
        postId: lastPart,
        isSingle,
        message: `Хэш найден: Публикация #${lastPart} ${isSingle ? '(конкретное фото)' : '(пост)'}`
      };
    }
    return {
      valid: true,
      message: 'Канонический URL Telegram подтвержден'
    };
  }
  return {
    valid: false,
    message: 'Требуется формат https://t.me/channel/123'
  };
}
