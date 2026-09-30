import { assertSafeUrl } from '@/utils/ssrf-guard';

export interface StreamViewerTask {
  id: string;
  targetUrl: string;
  platform: 'TWITCH' | 'KICK' | 'YOUTUBE_LIVE';
  viewersTarget: number;
  durationMinutes: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'STOPPED';
  activeViewersCount: number;
  startedAt?: number;
  stoppedAt?: number;
}

export interface StreamManifestInfo {
  masterPlaylistUrl: string;
  mediaPlaylistUrl: string;
  chunkUrls: string[];
}

/**
 * Headless HLS Стриминг-движок (Tier-0 Infrastructure)
 * Высокопроизводительный легковесный симулятор зрителей для прямых трансляций Twitch / Kick.
 * Не требует видеокарт (GPU) и браузеров. Скачивает первые диапазоны чанков (.ts)
 * через Range-запросы, эмулируя поведение нативного видеоплеера.
 */
export class HeadlessStreamEngine {
  private static readonly USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  ];

  private activeTasks: Map<string, StreamViewerTask> = new Map();

  /**
   * Парсит .m3u8 манифест и извлекает список медиа-чанков (.ts)
   */
  public parseM3u8Manifest(manifestContent: string, baseUrl: string): string[] {
    const lines = manifestContent.split('\n');
    const chunkUrls: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Строка содержит URL чанка
      try {
        const resolvedUrl = new URL(trimmed, baseUrl).toString();
        chunkUrls.push(resolvedUrl);
      } catch {
        // Пропускаем некорректные URI
      }
    }

    return chunkUrls;
  }

  /**
   * Эмулирует 1 цикл воспроизведения чанка (Range: bytes=0-65535)
   * Скачивает только первые 64 КБ медиа-файла для фиксации на CDN провайдера
   */
  public async simulateChunkPlayback(options: {
    chunkUrl: string;
    proxyUrl?: string;
    timeoutMs?: number;
  }): Promise<{ success: boolean; bytesFetched: number; statusCode: number }> {
    const { chunkUrl, timeoutMs = 5000 } = options;
    await assertSafeUrl(chunkUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const randomUa =
      HeadlessStreamEngine.USER_AGENTS[
        Math.floor(Math.random() * HeadlessStreamEngine.USER_AGENTS.length)
      ];

    try {
      const res = await fetch(chunkUrl, {
        method: 'GET',
        headers: {
          'User-Agent': randomUa,
          Range: 'bytes=0-65535', // Запрашиваем первые 64 КБ чанка
          Accept: '*/*',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 206 Partial Content или 200 OK свидетельствуют об успешной фиксации
      if (res.status === 206 || res.status === 200) {
        const buffer = await res.arrayBuffer();
        return {
          success: true,
          bytesFetched: buffer.byteLength,
          statusCode: res.status,
        };
      }

      return {
        success: false,
        bytesFetched: 0,
        statusCode: res.status,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Создает и регистрирует задачу удержания зрителей
   */
  public createStreamTask(options: {
    targetUrl: string;
    platform: 'TWITCH' | 'KICK' | 'YOUTUBE_LIVE';
    viewersTarget: number;
    durationMinutes: number;
  }): StreamViewerTask {
    const id = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const task: StreamViewerTask = {
      id,
      targetUrl: options.targetUrl,
      platform: options.platform,
      viewersTarget: options.viewersTarget,
      durationMinutes: options.durationMinutes,
      status: 'PENDING',
      activeViewersCount: 0,
    };

    this.activeTasks.set(id, task);
    return task;
  }

  /**
   * Запускает эмуляцию стрима
   */
  public startStreamTask(taskId: string): boolean {
    const task = this.activeTasks.get(taskId);
    if (!task || task.status === 'RUNNING') return false;

    task.status = 'RUNNING';
    task.startedAt = Date.now();
    // В боевом режиме воркеры выходят на целевой объем за 30-90 секунд
    task.activeViewersCount = task.viewersTarget;
    return true;
  }

  /**
   * Останавливает задачу стрима
   */
  public stopStreamTask(taskId: string): boolean {
    const task = this.activeTasks.get(taskId);
    if (!task) return false;

    task.status = 'STOPPED';
    task.stoppedAt = Date.now();
    task.activeViewersCount = 0;
    return true;
  }

  /**
   * Получает задачу по ID
   */
  public getTask(taskId: string): StreamViewerTask | undefined {
    return this.activeTasks.get(taskId);
  }

  /**
   * Возвращает список всех активных стримов
   */
  public getActiveTasks(): StreamViewerTask[] {
    return Array.from(this.activeTasks.values()).filter((t) => t.status === 'RUNNING');
  }
}
