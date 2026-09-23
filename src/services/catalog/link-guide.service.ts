/**
 * src/services/catalog/link-guide.service.ts
 * Central Backend-Driven Link Guide Service for Multi-Device Instructions (iOS / Android / Desktop).
 */

export interface LinkGuideStep {
  stepNumber: number;
  title: string;
  instruction: string;
  buttonHighlight: string;
  sampleUrl: string;
}

export interface PlatformDeviceGuide {
  device: 'ios' | 'android' | 'desktop';
  label: string;
  icon: string;
  badge: string;
  steps: LinkGuideStep[];
  mediaGroupAlbumNote: string;
}

export interface AlbumSyncGuidance {
  title: string;
  badge: string;
  explanation: string;
  recommendation: string;
  firstStepExample: string;
  lastStepExample: string;
}

export interface ServiceLinkGuidePayload {
  hasGuide: boolean;
  serviceType: 'TELEGRAM_VIEWS_PHOTO' | 'GENERIC';
  title: string;
  devices: PlatformDeviceGuide[];
  albumSyncGuidance?: AlbumSyncGuidance;
}

export class LinkGuideService {
  /**
   * Determines whether a service requires a Telegram photo/media link guide.
   */
  static isTelegramViewsService(networkSlug?: string | null, categorySlug?: string | null, serviceName?: string | null): boolean {
    const isTg = (networkSlug || '').toLowerCase() === 'telegram';
    if (!isTg) return false;

    const cat = (categorySlug || '').toLowerCase();
    const name = (serviceName || '').toLowerCase();

    const isViews = cat.includes('view') || cat.includes('просмотр') || name.includes('просмотр') || name.includes('view');
    return isViews;
  }

  /**
   * Generates the multi-device guide payload for Telegram photo & album views.
   */
  static getTelegramPhotoViewsGuide(): ServiceLinkGuidePayload {
    return {
      hasGuide: true,
      serviceType: 'TELEGRAM_VIEWS_PHOTO',
      title: 'Как скопировать ссылку на фото / альбом в Telegram',
      albumSyncGuidance: {
        title: 'Синхронизация просмотров для альбомов (Медиагрупп)',
        badge: '⚡ Рекомендация для 100% точности',
        explanation: 'В Telegram счётчики просмотров на iOS/Android считываются с последнего элемента медиагруппы, а на Desktop/Web — с первого. Чтобы счётчик обновился одинаково на всех устройствах пользователей, оформите 2 отдельных заказа: один на первое медиа альбома, второй — на последнее.',
        recommendation: 'Оформите 2 заказа: на 1-е и на последнее медиа альбома.',
        firstStepExample: 'https://t.me/channel_name/101 (Первое фото альбома — для Desktop/Web)',
        lastStepExample: 'https://t.me/channel_name/105 (Последнее фото альбома — для iOS/Android)'
      },
      devices: [
        {
          device: 'ios',
          label: 'iPhone (iOS)',
          icon: '🍏',
          badge: 'iOS / iPadOS',
          steps: [
            {
              stepNumber: 1,
              title: 'Откройте фото на весь экран',
              instruction: 'Тапните по нужной фотографии прямо в посте, чтобы она открылась в полноэкранном режиме.',
              buttonHighlight: 'Тап по фото',
              sampleUrl: 'https://t.me/durov/150',
            },
            {
              stepNumber: 2,
              title: 'Нажмите меню «•••»',
              instruction: 'В правом верхнем углу экрана нажмите на значок трех горизонтальных точек «•••».',
              buttonHighlight: 'Кнопка «•••» в углу',
              sampleUrl: 'https://t.me/durov/150',
            },
            {
              stepNumber: 3,
              title: 'Выберите «Копировать ссылку»',
              instruction: 'В появившемся меню нажмите пункт «Копировать ссылку» (Copy Link).',
              buttonHighlight: '«Копировать ссылку»',
              sampleUrl: 'https://t.me/durov/150?single',
            },
          ],
          mediaGroupAlbumNote: 'Для альбома из нескольких фото: скопируйте ссылку на первое фото (t.me/.../150) и на последнее (t.me/.../154), чтобы просмотры распределились на весь альбом.'
        },
        {
          device: 'android',
          label: 'Android',
          icon: '🤖',
          badge: 'Samsung / Xiaomi / Honor',
          steps: [
            {
              stepNumber: 1,
              title: 'Разверните фото на полный экран',
              instruction: 'Нажмите на фотографию в ленте канала, чтобы открыть галерею просмотра.',
              buttonHighlight: 'Клик по фото',
              sampleUrl: 'https://t.me/durov/150',
            },
            {
              stepNumber: 2,
              title: 'Нажмите меню «⋮»',
              instruction: 'В правом верхнем углу нажмите на вертикальное троеточие «⋮».',
              buttonHighlight: 'Меню «⋮»',
              sampleUrl: 'https://t.me/durov/150',
            },
            {
              stepNumber: 3,
              title: 'Нажмите «Копировать ссылку»',
              instruction: 'Выберите пункт «Копировать ссылку». Ссылка готова для вставки в поле заказа.',
              buttonHighlight: '«Копировать ссылку»',
              sampleUrl: 'https://t.me/durov/150',
            },
          ],
          mediaGroupAlbumNote: 'Если в посте несколько фото: скопируйте ссылку на первое и последнее фото альбома для равномерного начисления просмотров.'
        },
        {
          device: 'desktop',
          label: 'Компьютер',
          icon: '💻',
          badge: 'Windows / Mac / Web',
          steps: [
            {
              stepNumber: 1,
              title: 'Наведите курсор на фото',
              instruction: 'Наведите курсор мыши на нужную фотографию в сообщении канала.',
              buttonHighlight: 'Наведение мыши',
              sampleUrl: 'https://t.me/durov/150',
            },
            {
              stepNumber: 2,
              title: 'Правый клик (ПКМ)',
              instruction: 'Нажмите правую кнопку мыши прямо по фотографии.',
              buttonHighlight: 'Правая кнопка мыши',
              sampleUrl: 'https://t.me/durov/150',
            },
            {
              stepNumber: 3,
              title: '«Копировать ссылку на сообщение»',
              instruction: 'В открывшемся контекстном меню выберите «Копировать ссылку на сообщение».',
              buttonHighlight: '«Копировать ссылку на сообщение»',
              sampleUrl: 'https://t.me/durov/150',
            },
          ],
          mediaGroupAlbumNote: 'Для медиагруппы: кликните правой кнопкой мыши по первому и последнему фото в альбоме.'
        }
      ]
    };
  }

  /**
   * Checks if a URL is likely a Telegram post or specific media item that could be part of an album.
   */
  static isTelegramAlbumCandidate(url?: string | null): boolean {
    if (!url) return false;
    const lower = url.toLowerCase().trim();
    const isTg = lower.includes('t.me/') || lower.includes('telegram.me/') || lower.includes('telegram.dog/');
    if (!isTg) return false;

    // Matches /c/123/456 or /channel/456 or /channel/456?single
    return /\/(?:c\/\d+\/|\w+\/)(\d+)/i.test(lower);
  }

  /**
   * Returns a friendly, actionable advice string for Telegram album orders.
   */
  static getTelegramAlbumAdvice(url?: string | null): string {
    const isSingle = (url || '').toLowerCase().includes('single');
    if (isSingle) {
      return 'Вы указали ссылку на отдельное медиа из альбома. Для равномерного отображения просмотров на iOS и Android оформите второй заказ на последнее фото альбома.';
    }
    return 'Если этот пост содержит альбом (медиагруппу), для синхронизации просмотров на iOS и Android оформите 2 заказа: на первое и последнее фото альбома.';
  }
}
