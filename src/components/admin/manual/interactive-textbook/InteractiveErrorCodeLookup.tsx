'use client';

import React, { useState } from 'react';
import { Search, AlertTriangle, Check, Copy, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ProviderErrorCode {
  code: string;
  meaning: string;
  action: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  clientScript: string;
}

const ERROR_CODES_REGISTRY: ProviderErrorCode[] = [
  {
    code: 'not_enough_funds / insufficient_balance',
    meaning: 'На шлюзе поставщика закончились денежные средства (баланс на нуле)',
    action: 'P0 Инцидент! Не отменять заказ. Срочно пополнить баланс провайдера в Казначействе (/admin/finance/treasury) либо переключить заказ на дублера через Failover.',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! Заказ находится в обработке и выполняется на резервной серверной линии. Ожидаемое время завершения — до 15 минут!»',
  },
  {
    code: 'invalid_link / bad_url_format',
    meaning: 'Формат ссылки некорректен или не поддерживается поставщиком (например, приватная ссылка или пробелы)',
    action: 'Проверить targetType услуги и ссылку клиента. Перезапустить с каноническим форматом либо оформить 100% авто-возврат на баланс.',
    severity: 'MEDIUM',
    clientScript: '«Здравствуйте! Ссылка в заказе указана в неподдерживаемом формате. Средства возвращены на ваш баланс в полном объеме — пожалуйста, оформите заказ заново с прямой публичной ссылкой!»',
  },
  {
    code: 'quantity_out_of_range (min/max)',
    meaning: 'Заказанный объем меньше minQty или превышает maxQty услуги поставщика',
    action: 'Сверить service.minQty и service.maxQty с параметрами поставщика. При Drip-Feed проверить соблюдение инварианта floor(Q/N) >= minQty.',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! Объем заказа превысил текущие лимиты поставщика. Мы скорректировали настройки тарифа и вернули неиспользованный остаток средств на ваш баланс.»',
  },
  {
    code: 'service_disabled / inactive',
    meaning: 'Провайдер временно или навсегда отключил услугу / снял тариф с продажи',
    action: 'Переключить зависший заказ через Failover Routing на резервного поставщика. В каталоге перевести услугу в статус DISABLED.',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! Данная услуга сейчас обновляется поставщиком. Заказ переведен на альтернативный скоростной сервер без изменения стоимости!»',
  },
  {
    code: 'account_private / restricted',
    meaning: 'Целевой профиль, канал или группа закрыта настройками приватности',
    action: 'Уведомить клиента о необходимости сделать аккаунт публичным. Отменить заказ с 100% авто-возвратом средств на баланс.',
    severity: 'LOW',
    clientScript: '«Здравствуйте! Ваш аккаунт или канал закрыт настройками приватности. Пожалуйста, откройте его в настройках соцсети и перезапустите заказ с баланса!»',
  },
  {
    code: 'order_already_exists / duplicate',
    meaning: 'Повторный заказ на ту же ссылку до завершения предыдущего активного заказа',
    action: 'Большинство поставщиков блокируют параллельные дубли на одну ссылку. Дождаться COMPLETED предыдущего либо вернуть средства за дубликат.',
    severity: 'LOW',
    clientScript: '«Здравствуйте! Предыдущий заказ на эту же ссылку еще выполняется поставщиком. Средства за повторный заказ возвращены на ваш баланс — дождитесь завершения текущего заказа!»',
  },
  {
    code: 'rate_limited / 429_too_many_requests',
    meaning: 'Превышен лимит параллельных обращений к API внешнего поставщика',
    action: 'BullMQ автоматически повторит попытку через экспоненциальный бэкофф. Ручного вмешательства не требуется.',
    severity: 'MEDIUM',
    clientScript: '«Здравствуйте! Идет распределение запросов по пулам серверов. Скорость выполнения будет восстановлена автоматически в течение нескольких минут.»',
  },
  {
    code: 'bad_gateway_502 / bad_gateway',
    meaning: 'Сервер шлюза поставщика недоступен или вернул ошибку 502 Bad Gateway',
    action: 'Ожидать восстановления серверов провайдера либо переключить заказы на дублера через резервный шлюз.',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! На стороне внешнего шлюза зафиксирован технический сбой. Заказ находится в очереди и будет отправлен сразу после восстановления связи.»',
  },
  {
    code: 'gateway_timeout_504',
    meaning: 'Сервер поставщика не ответил в течение установленного таймаута (AbortSignal)',
    action: 'Запустить фоновую проверку статуса через scripts/audit-orders.ts. Не дублировать запрос вручную без проверки idempotencyKey.',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! Запрос принят системой, идет синхронизация статуса со сторонним сервером. Заказ будет обработан в штатном режиме.»',
  },
  {
    code: 'invalid_api_key / auth_failed',
    meaning: 'Неверный, просроченный или отозванный токен доступа к API провайдера',
    action: 'P0 Инцидент! Обновить API-ключ в /admin/providers в защищенном хранилище Vault (SystemSettings).',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! Идет плановое обновление сертификатов безопасности шлюза. Ваш заказ находится в приоритетной очереди.»',
  },
  {
    code: 'service_not_found / 404',
    meaning: 'Услуга не найдена по указанному externalServiceId (провайдер сменил ID)',
    action: 'Перепривязать локальную услугу к новому ID поставщика в /admin/catalog. Запустить повторную синхронизацию.',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! Мы обновляем связку с каталогом поставщика. Заказ будет отправлен в течение 10-15 минут.»',
  },
  {
    code: 'link_already_used / in_progress',
    meaning: 'По указанной ссылке уже идет активная накрутка другой системой',
    action: 'Дождаться завершения активной фазы накрутки сторонней системой либо вернуть средства.',
    severity: 'LOW',
    clientScript: '«Здравствуйте! По данной ссылке зафиксирована активность другой системы. Рекомендуем дождаться завершения предыдущей накрутки во избежание списаний соцсетью.»',
  },
  {
    code: 'target_not_found / deleted',
    meaning: 'Целевой пост, видео или канал удален автором либо забанен соцсетью',
    action: 'Проверить доступность ссылки в браузере в режиме инкогнито. Если страница удалена — отменить с возвратом.',
    severity: 'LOW',
    clientScript: '«Здравствуйте! Целевая публикация или канал недоступны (удалены автором или заблокированы платформой). Средства возвращены на ваш баланс!»',
  },
  {
    code: 'blocked_by_provider / flagged',
    meaning: 'Целевая ссылка или домен внесен в черный список провайдера (фрод/спам)',
    action: 'Связаться с поддержкой поставщика, перенаправить поток на независимого дублера.',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! По данной ссылке на стороне поставщика сработал фильтр безопасности. Мы проверяем заказ на альтернативной линии.»',
  },
  {
    code: 'duplicate_order / hash_collision',
    meaning: 'Идентичный заказ уже отправлен поставщику с тем же хэшем параметров',
    action: 'Проверить наличие дублирующего заказа в реестре по idempotencyKey. Исключить повторное списание.',
    severity: 'LOW',
    clientScript: '«Здравствуйте! Система зафиксировала повторную отправку и предотвратила двойное списание. Средства в безопасности!»',
  },
  {
    code: 'parameter_missing / required_field',
    meaning: 'Не передан обязательный параметр (например, список комментариев, ID опроса)',
    action: 'Проверить кастомные поля услуги в /admin/catalog. Запросить у клиента недостающие данные.',
    severity: 'MEDIUM',
    clientScript: '«Здравствуйте! Для выполнения заказа требуются дополнительные параметры (текст комментариев или вариант опроса). Уточните их в ответе на этот тикет!»',
  },
  {
    code: 'maintenance_mode / provider_downtime',
    meaning: 'Поставщик проводит технические работы на своих серверах',
    action: 'Временно заморозить отправку на данного провайдера на 1 час. Очередь BullMQ накопит заказы.',
    severity: 'MEDIUM',
    clientScript: '«Здравствуйте! На линии поставщика ведутся плановые регламентные работы. Все заказы сохраняются в очереди и запустятся автоматически.»',
  },
  {
    code: 'unauthorized_ip / whitelist_error',
    meaning: 'Исходящий IP-адрес сервера OmniSMM не внесен в белый список провайдера',
    action: 'Прописать текущий исходящий IP сервера в личной панели поставщика.',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! Идет синхронизация сетевых маршрутов. Задержка не превысит 10 минут.»',
  },
  {
    code: 'currency_mismatch / fx_error',
    meaning: 'Поставщик сменил валюту тарифа (например, с USD на RUB или EUR)',
    action: 'Обновить валюту провайдера в /admin/providers и нажать «Синхронизировать курс ЦБ РФ».',
    severity: 'MEDIUM',
    clientScript: '«Здравствуйте! Мы актуализируем валютные курсы шлюза. Заказ обрабатывается.»',
  },
  {
    code: 'refill_not_available / guarantee_expired',
    meaning: 'Истек срок гарантии на докрутку (30 дней) или лимит докруток исчерпан',
    action: 'Отклонить заявку на докрутку (Refill) с разъяснением клиенту условий тарифа.',
    severity: 'LOW',
    clientScript: '«Здравствуйте! Гарантийный период докрутки по данному тарифу завершился (30 дней с момента заказа). Рекомендуем оформить новый заказ с гарантией!»',
  },
  {
    code: 'cancel_not_allowed / order_locked',
    meaning: 'Отмена заказа невозможна, так как поставщик уже начал открутку',
    action: 'Дождаться завершения заказа. Если объем откручен не полностью — оформить частичный возврат.',
    severity: 'LOW',
    clientScript: '«Здравствуйте! Заказ уже передан на серверы соцсети и не может быть отозван мгновенно. Если итоговый объем будет неполным, разница вернется автоматически!»',
  },
  {
    code: 'drip_feed_floor_violation',
    meaning: 'Объем на один запуск Drip-Feed меньше минимального лимита услуги (floor(Q/N) < minQty)',
    action: 'Скорректировать количество запусков N или увеличить общий объем Q до minQty * N.',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! При настройке интервального запуска объем одной пачки оказался ниже допустимого минимума. Мы скорректировали параметры для корректного старта.»',
  },
  {
    code: 'target_type_mismatch',
    meaning: 'Тип услуги (например, POST) несовместим со ссылкой (например, ссылка на канал CHANNEL)',
    action: 'Использовать resolveServiceTargetType() для автоматического подбора совместимой услуги.',
    severity: 'MEDIUM',
    clientScript: '«Здравствуйте! Выбранная услуга предназначена для публикаций, а ссылка ведет на канал. Мы подобрали аналогичную услугу для канала и перевели заказ!»',
  },
  {
    code: 'ssrf_blocked / private_ip',
    meaning: 'Целевая ссылка резолвится во внутренний IP-адрес (127.0.0.1, 192.168.*, 10.*)',
    action: 'SSRF-атака предотвращена на уровне Link Engine! Заказ заблокирован, IP клиента записан в аудит.',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! Указанный адрес является внутренним и заблокирован системой безопасности платформы. Введите публичную ссылку на соцсеть.»',
  },
  {
    code: 'bot_conflict_409',
    meaning: 'Конфликт экземпляров Telegram-бота (terminated by other getUpdates request)',
    action: 'Вызвать deleteWebhook({ drop_pending_updates: true }) и перезапустить процесс бота.',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! Telegram-уведомления синхронизируются. Все статусы доступны в веб-кабинете.»',
  },
  {
    code: 'fiscal_receipt_failed',
    meaning: 'Сбой онлайн-кассы 54-ФЗ при формировании кассового чека (НДС 22% / УСН)',
    action: 'Проверить ReceiptLog в /admin/transactions. При необходимости отправить чек вручную через ОФД.',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! Оплата успешно зачислена на баланс. Электронный чек 54-ФЗ формируется оператором фискальных данных и поступит на вашу почту.»',
  },
  {
    code: 'post_comments_disabled',
    meaning: 'Комментарии к целевой публикации закрыты автором в настройках приватности',
    action: 'Уведомить клиента открыть комментарии к посту и перезапустить заказ.',
    severity: 'LOW',
    clientScript: '«Здравствуйте! Автор публикации отключил возможность оставлять комментарии. Пожалуйста, включите комментарии к посту и перезапустите заказ с баланса!»',
  },
  {
    code: 'geo_restriction / country_blocked',
    meaning: 'Услуга недоступна для выбранного географического региона аудитории',
    action: 'Переключить тариф на общемировую аудиторию (Worldwide / СНГ) в настройках заказа.',
    severity: 'MEDIUM',
    clientScript: '«Здравствуйте! Гео-таргетинг данного тарифа не поддерживает указанную локацию. Мы перевели заказ на международную линию аналогичного качества.»',
  },
  {
    code: 'username_invalid / bad_handle',
    meaning: 'Имя пользователя содержит недопустимые символы или кириллицу',
    action: 'Очистить @handle от лишних знаков и эмодзи, перепроверить ссылку.',
    severity: 'LOW',
    clientScript: '«Здравствуйте! В юзернейме обнаружены некорректные символы. Пожалуйста, укажите точное имя пользователя латиницей без спецсимволов!»',
  },
  {
    code: 'profile_age_restriction / 18_plus',
    meaning: 'Профиль помечен как 18+ и требует авторизации для просмотра контента',
    action: 'Услуги на профили 18+ поддерживаются только специальными провайдерами с cookie-сессиями.',
    severity: 'MEDIUM',
    clientScript: '«Здравствуйте! Контент помечен возрастным ограничением 18+. Заказ направлен поставщику со специальными подтвержденными профилями.»',
  },
  {
    code: 'speed_limit_reached / throttle',
    meaning: 'Достигнут безопасный суточный лимит скорости накрутки на целевой ресурс',
    action: 'Включен защитный интервал для предотвращения списаний и теневого бана соцсети.',
    severity: 'LOW',
    clientScript: '«Здравствуйте! Для защиты вашего канала от списаний скорость плавно распределена во времени. Накрутка идет безопасным органическим темпом.»',
  },
  {
    code: 'runs_count_invalid',
    meaning: 'Количество повторов в Drip-Feed выходит за рамки допустимого диапазона (1..100)',
    action: 'Скорректировать число запусков в мастере Drip-Feed.',
    severity: 'LOW',
    clientScript: '«Здравствуйте! Количество запусков должно составлять от 1 до 100. Мы скорректировали интервал для стабильной работы.»',
  },
  {
    code: 'interval_too_low',
    meaning: 'Интервал между запусками Drip-Feed меньше минимально допустимых 5 минут',
    action: 'Установить интервал не менее 5 минут между итерациями.',
    severity: 'LOW',
    clientScript: '«Здравствуйте! Минимальный интервал между запусками составляет 5 минут для соблюдения лимитов соцсети.»',
  },
  {
    code: 'insufficient_user_balance',
    meaning: 'У пользователя недостаточно средств для списания стоимости заказа',
    action: 'Предложить пополнить баланс через ЮKassa, СБП или CryptoBot.',
    severity: 'LOW',
    clientScript: '«Здравствуйте! На вашем балансе недостаточно средств. Вы можете пополнить счет через СБП или банковскую карту в разделе Пополнить баланс!»',
  },
  {
    code: 'ledger_integrity_violation',
    meaning: 'Попытка изменения баланса в обход двойной бухгалтерской записи WalletOps',
    action: 'P0 Инцидент безопасности! Транзакция заблокирована на уровне базы данных PostgreSQL.',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! Система завершает проверку финансовых проводок. Ваш баланс будет обновлен автоматически.»',
  },
  {
    code: 'order_in_quarantine',
    meaning: 'Заказ переведен в антифрод-карантин из-за подозрительной активности',
    action: 'Проверить заказ в /admin/fraud-monitor. При отсутствии признаков фрода нажать «Одобрить».',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! Заказ проходит стандартную автоматическую проверку безопасности. Ожидайте активации в течение 10 минут!»',
  },
  {
    code: 'partial_refund_pending',
    meaning: 'Заказ выполнен частично, сформирована проводка на возврат разницы клиенту',
    action: 'Проверить статус заказа в реестре, возврат за неоткрученный остаток начисляется автоматически.',
    severity: 'LOW',
    clientScript: '«Здравствуйте! Заказ выполнен частично из-за ограничений соцсети. Средства за невыполненную часть уже возвращены на ваш баланс!»',
  },
  {
    code: 'network_binding_error',
    meaning: 'Ошибка привязки сетевого сокета (сервер не слушает 0.0.0.0:3000)',
    action: 'Проверить переменные HOSTNAME="0.0.0.0" и PORT="3000" в конфигурации сервиса.',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! Серверная инфраструктура перезапускается. Платформа станет доступна через минуту.»',
  },
  {
    code: 'api_schema_validation_failed',
    meaning: 'Ответ внешнего шлюза не соответствует ожидаемому контракту Zod DTO',
    action: 'Проверить логи провайдера в /admin/logs. Обновить маппер ответа поставщика.',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! Ответ шлюза обрабатывается службой интеграции. Заказ поставлен на повторную проверку.»',
  },
  {
    code: 'redis_circuit_breaker_open',
    meaning: 'Предохранитель провайдера сработал из-за серии последовательных сбоев',
    action: 'Шлюз временно изолирован на 60 секунд. Заказы автоматически перенаправляются на дублера.',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! Нагрузка на шлюз перераспределена на резервную серверную стойку.»',
  },
  {
    code: 'provider_endpoint_ssl_error',
    meaning: 'Сбой SSL/TLS рукопожатия с API провайдера (просрочен сертификат)',
    action: 'Проверить валидность SSL-сертификата домена провайдера с хоста.',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! Внешний шлюз обновляет криптографический сертификат. Заказ в очереди.»',
  },
  {
    code: 'unsupported_social_network',
    meaning: 'Ссылка принадлежит социальной сети, не поддерживаемой каталогом OmniSMM',
    action: 'Отклонить заказ с причиной UNSUPPORTED_PLATFORM и полным возвратом средств.',
    severity: 'LOW',
    clientScript: '«Здравствуйте! Данная социальная сеть пока не поддерживается нашей платформой. Средства возвращены на ваш баланс!»',
  },
  {
    code: 'zero_unknown_platform_rejected',
    meaning: 'Услуга провайдера отбракована на входе из-за неопределенной соцсети (Zero-Unknown Guard)',
    action: 'Услуги с platform === "other" | "unknown" категорически запрещено импортировать без ручной привязки.',
    severity: 'MEDIUM',
    clientScript: '«Здравствуйте! Услуга снята с публикации для уточнения технических характеристик.»',
  },
  {
    code: 'price_drift_detected',
    meaning: 'Цена поставщика изменилась более чем на 25% при фоновой синхронизации',
    action: 'Услуга переведена в ценовой карантин (/admin/catalog?filter=quarantine) для ручного подтверждения маржи.',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! Тариф проходит плановую калибровку себестоимости. Заказ в обработке.»',
  },
  {
    code: 'micro_price_anomaly',
    meaning: 'Цена за 1000 единиц у провайдера меньше 0.01 ₽ — подозрение на валютную ошибку',
    action: 'Автоматическая блокировка услуги. Проверить валюту тарифа поставщика.',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! Тариф проверяется финансовой службой перед активацией.»',
  },
  {
    code: 'toxic_service_keyword',
    meaning: 'Услуга содержит запрещенные слова («снос», «жалоба», «деанон»)',
    action: 'Услуга перманентно заблокирована комплаенс-фильтром каталога.',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! Данный тип услуг противоречит правилам безопасности платформы и заблокирован.»',
  },
  {
    code: 'idempotency_collision',
    meaning: 'Зафиксирован повторный запрос с идентичным ключом idempotencyKey',
    action: 'Система вернула кэшированный результат предыдущего запроса без повторного списания денег.',
    severity: 'LOW',
    clientScript: '«Здравствуйте! Повторный клик обработан безопасно — повторного списания не произошло!»',
  },
  {
    code: 'vault_decryption_failed',
    meaning: 'Ошибка расшифровки секрета AES-256-GCM в SystemSettings',
    action: 'Проверить переменную окружения ENCRYPTION_KEY на сервере.',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! Идет проверка ключей шифрования. Заказ выполняется штатно.»',
  },
  {
    code: 'cookie_tenant_mismatch',
    meaning: 'Запрос отправлен с кукой чужого бренда (изоляция SMMplan / SMMflux)',
    action: 'Кука x_admin_tenant автоматически нормализована в соответствии с хостом запроса.',
    severity: 'LOW',
    clientScript: '«Здравствуйте! Сессия привязана к текущей витрине платформы.»',
  },
  {
    code: 'vat_rate_mismatch',
    meaning: 'Неверная ставка НДС при формировании чека ЮKassa (22% vs Без НДС)',
    action: 'Сверить годовой оборот компании с порогом 20 млн ₽ (п. 1 ст. 145 НК РФ) и актуализировать vat_code.',
    severity: 'HIGH',
    clientScript: '«Здравствуйте! Фискальный чек формируется в соответствии с действующим налоговым законодательством.»',
  },
  {
    code: 'custom_comments_empty',
    meaning: 'Клиент выбрал тариф со своими комментариями, но поле списка комментариев пусто',
    action: 'Уведомить клиента заполнить список текстов для комментариев построчно.',
    severity: 'LOW',
    clientScript: '«Здравствуйте! Для выбранной услуги необходимо указать тексты комментариев (по одному на строку). Пожалуйста, укажите их в заказе!»',
  },
  {
    code: 'poll_option_missing',
    meaning: 'Для накрутки опроса не указан порядковый номер или название варианта ответа',
    action: 'Запросить у клиента номер варианта ответа в опросе и запустить заказ.',
    severity: 'LOW',
    clientScript: '«Здравствуйте! Уточните, за какой именно вариант ответа в опросе необходимо проголосовать (номер или текст варианта)?»',
  },
];

export function InteractiveErrorCodeLookup() {
  const [search, setSearch] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const filtered = ERROR_CODES_REGISTRY.filter((item) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      item.code.toLowerCase().includes(q) ||
      item.meaning.toLowerCase().includes(q) ||
      item.action.toLowerCase().includes(q)
    );
  });

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(id);
      toast.success('Скрипт для тикета скопирован');
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      toast.error('Не удалось скопировать');
    }
  };

  return (
    <div className="my-6 p-4 sm:p-5 rounded-2xl bg-card border border-border/80 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-border/60 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-indigo-500" />
          <h3 className="text-sm font-bold text-foreground">
            Справочник кодов ошибок провайдеров API (Том VIII, Глава 37)
          </h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
          50+ Кодов API
        </span>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по ошибке (например: private, balance, rate limit, duplicate)..."
          className="w-full h-10 pl-10 pr-10 text-xs rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground font-bold"
          >
            ✕
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {filtered.map((item, idx) => (
          <div key={idx} className="p-3.5 rounded-xl bg-muted/30 border border-border/60 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                    item.severity === 'HIGH'
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                      : item.severity === 'MEDIUM'
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                  }`}
                >
                  {item.severity}
                </span>
                <span className="text-xs font-bold text-foreground font-mono">{item.code}</span>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(item.clientScript, `err-${idx}`)}
                className="px-2.5 py-1 rounded-lg bg-background hover:bg-muted text-xs font-semibold text-foreground border border-border flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                {copiedCode === `err-${idx}` ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedCode === `err-${idx}` ? 'Скопировано' : 'Скопировать ответ'}</span>
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Значение:</strong> {item.meaning}
            </p>
            <p className="text-xs text-foreground bg-background/60 p-2 rounded-lg border border-border/40 leading-relaxed">
              <strong>Действие оператора:</strong> {item.action}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
