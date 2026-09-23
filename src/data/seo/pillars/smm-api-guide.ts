export const smmApiGuide = {
  slug: 'smm-api-guide',
  title: 'SMM API для агентств и реселлеров',
  metaTitle: 'SMM API v2 для агентств и реселлеров | Документация SMMplan',
  excerpt: 'Полное техническое руководство по интеграции SMM API v2: стандарты REST/Form-data, методы balance, services, add, status, примеры cURL и Python.',
  network: 'api',
  category: 'Биллинг и Лимиты',
  readTimeMinutes: 16,
  faq: [
    {
      question: 'Как получить API-ключ для интеграции?',
      answer: 'API-ключ генерируется в личном кабинете пользователя в разделе «Настройки → API». Ключ выдается в единственном экземпляре с префиксом smm_.',
    },
    {
      question: 'Совместим ли SMMplan API со стандартными SMM-панелями?',
      answer: 'Да, наш API v2 полностью соответствует общепринятому индустриальному стандарту SMM API (поддерживаются все базовые действия action=balance, services, add, status и т.д.).',
    },
    {
      question: 'Какое ограничение на количество запросов в минуту (Rate Limit)?',
      answer: 'Стандартный лимит составляет 50 запросов в минуту на один API-ключ. Для крупный реселлеров лимит может быть расширен по запросу в поддержку.',
    },
    {
      question: 'Как обрабатываются ошибки при невалидных параметрах?',
      answer: 'Сервер возвращает JSON-ответ с описанием ошибки в поле "error" и соответствующим HTTP-кодом ответа.',
    },
    {
      question: 'В какой валюте производятся все расчёты по API?',
      answer: 'Все балансы, стоимость услуг и списания в API v2 производятся строго в российских рублях (RUB).',
    },
  ],
  contentHtml: `
    <p>Современные SMM-агентства, сервис-провайдеры, владельцы собственных платформ и разработчики автоматизированных сервисов требуют быстрого, надежного и стабильного программного интерфейса взаимодействия с поставщиками ресурсов. Платформа SMMplan предоставляет разработчикам удобный <strong>SMM API v2</strong>, построенный на базе общепринятого индустриального стандарта со 100% обратной совместимостью с популярными движками реселлинга и скриптами управления цифровыми услугами.</p>

    <p>В данном подробном руководстве мы детально разберем все доступные действия API v2, структуру передаваемых данных, методы авторизации, способы автоматической обработки ошибок, архитектурные принципы взаимодействия, а также примеры написания собственного скрипта на Python и сетевых команд cURL.</p>

    <h2>Что такое SMM API и зачем он нужен бизнесу</h2>
    <p>SMM API (<a href="/knowledge/glossary/api">Application Programming Interface</a>) дает возможность внешним информационным системам в автономном режиме запрашивать баланс аккаунта, выгружать актуальный номенклатурный каталог услуг с розничными ценами, автоматически оформлять новые одиночные или пакетные заказы, а также контролировать текущий статус их исполнения в режиме реального времени без прямого участия оператора.</p>
    <p>Основные преимущества использования API v2 для реселлеров и агентств:</p>
    <ul>
      <li><strong>Полная автоматизация обработки заказов:</strong> заявки ваших клиентов мгновенно передаются в исполнение без промежуточных ручных действий со стороны администраторов.</li>
      <li><strong>Синхронизация каталогов и цен:</strong> автоматический импорт актуального списка услуг, их характеристик и минимальных порогов количества.</li>
      <li><strong>Пакетное выполнение (Batch operations):</strong> экономия сетевого трафика и времени за счет отправки до 50 заказов в одном HTTP-запросе.</li>
      <li><strong>Высокая надежность и обработка исключений:</strong> прозрачная система кодов ошибок, гарантирующая точный учет каждого списания средств.</li>
      <li><strong>Гибкость интеграции:</strong> полная совместимость с любымиязыками программирования (Python, PHP, JavaScript, Go, Ruby, C#).</li>
    </ul>

    <h2>Авторизация и безопасность программных запросов</h2>
    <p>Все программные обращения к API отправляются с использованием протокола защищенного соединения HTTPS методом <code>POST</code> на единую точку входа (Base URL):</p>
    <pre><code>https://test.smmplan.pro/api/v2</code></pre>
    <p>Аутентификация осуществляется путем передачи вашего секретного API-ключа в параметре <code>key</code> тела каждого POST-запроса (стандарт кодирования <code>application/x-www-form-urlencoded</code>):</p>
    <pre><code>key=smm_xxxxxxxxxxxxxxxxxxxxxxxx</code></pre>
    <p>Обратите внимание: храните ваш ключ в строгой конфиденциальности на стороне сервера. Запрещено передавать ключ в открытом виде в клиентском JavaScript-коде браузера или публичных репозиториях.</p>

    <h2>Подробный обзор доступных эндпоинтов (8 действий API v2)</h2>

    <h3>1. Запрос баланса счета (action=balance)</h3>
    <p>Возвращает информацию о текущем финансовом балансе вашей учетной записи в рублях.</p>
    <pre><code>curl -X POST https://test.smmplan.pro/api/v2 \\
  -d "key=smm_your_key&action=balance"</code></pre>
    <p>Пример успешного JSON-ответа:</p>
    <pre><code>{
  "balance": "1500.0000",
  "currency": "RUB"
}</code></pre>

    <h3>2. Выгрузка списка услуг (action=services)</h3>
    <p>Возвращает массив всех доступных для заказа активных услуг с указанием лимитов, категорий и розничной стоимости за 1000 единиц (по стандарту SMM-панелей).</p>
    <pre><code>curl -X POST https://test.smmplan.pro/api/v2 \\
  -d "key=smm_your_key&action=services"</code></pre>

    <h3>3. Оформление нового заказа (action=add)</h3>
    <p>Создает одиночный заказ на выбранную услугу с передачей целевой ссылки и количества.</p>
    <pre><code>curl -X POST https://test.smmplan.pro/api/v2 \\
  -d "key=smm_your_key&action=add&service=101&link=https://t.me/example&quantity=500"</code></pre>

    <h3>4. Пакетное создание заказов (action=add_multi)</h3>
    <p>Позволяет за одно HTTP-соединение отправить в обработку массив до 50 заказов, что значительно экономит сетевые накладные расходы.</p>

    <h3>5. Проверка статуса заказа (action=status)</h3>
    <p>Возвращает актуальное состояние исполнения заказа (PENDING, IN_PROGRESS, COMPLETED, CANCELLED). Для пакетной проверки передайте список ID через запятую (до 100 за раз).</p>
    <pre><code>curl -X POST https://test.smmplan.pro/api/v2 \\
  -d "key=smm_your_key&action=status&order=12345"</code></pre>

    <h3>6. Запрос отмены заказа (action=cancel)</h3>
    <p>Инициирует попытку отмены выполняемого заказа, если данная опция предусмотрена техническими параметрами услуги.</p>

    <h3>7. Запрос докрутки (action=refill)</h3>
    <p>Запускает процедуру бесплатной гарантийной компенсации показателей (<a href="/knowledge/glossary/refill">Refill</a>) при возникновении естественного оттока.</p>

    <h3>8. Проверка статуса докрутки (action=refill_status)</h3>
    <p>Возвращает текущую стадию выполнения ранее созданной заявки на докрутку.</p>

    <h2>Пример боевой интеграции на Python</h2>
    <p>Готовый код для подключения вашего сервиса к SMMplan API v2 с обработкой ошибок и тайм-аутов:</p>
    <pre><code>import requests
import time

API_URL = "https://test.smmplan.pro/api/v2"
API_KEY = "smm_your_secret_key_here"

def check_account_balance():
    payload = {
        "key": API_KEY,
        "action": "balance"
    }
    try:
        response = requests.post(API_URL, data=payload, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print("Ошибка сети при проверке баланса:", e)
        return None

def place_smm_order(service_id, target_link, quantity):
    payload = {
        "key": API_KEY,
        "action": "add",
        "service": service_id,
        "link": target_link,
        "quantity": quantity
    }
    try:
        response = requests.post(API_URL, data=payload, timeout=15)
        return response.json()
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}

if __name__ == "__main__":
    print("Текущий баланс:", check_account_balance())
</code></pre>

    <h2>Rate Limits и серверные ограничения</h2>
    <table>
      <thead>
        <tr>
          <th>Параметр</th>
          <th>Лимит платформы</th>
          <th>Поведение при выходе за лимит</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Запросов в минуту</td>
          <td>50 req / min</td>
          <td>Возврат HTTP 429 (Too many requests)</td>
        </tr>
        <tr>
          <td>Пакетный add_multi</td>
          <td>До 50 заказов</td>
          <td>Отклонение пакета с ошибкой</td>
        </tr>
        <tr>
          <td>Пакетная проверка status</td>
          <td>До 100 ID за раз</td>
          <td>Усечение запроса</td>
        </tr>
      </tbody>
    </table>

    <h2>Рекомендации по обработке ошибок и таймаутов</h2>
    <p>При построении надежной интеграции учитывайте следующие сетевые аспекты:</p>
    <ol>
      <li><strong>Обработка статусов HTTP:</strong> отслеживайте ответы сервера 429 (превышение лимита) и 500 (временная недоступность). Реализуйте повторный запрос через экспоненциальную паузу (Exponential Backoff).</li>
      <li><strong>Валидация ссылок перед отправкой:</strong> проверяйте корректность формата URLs на стороне вашего приложения до вызова API.</li>
      <li><strong>Кэширование списка услуг:</strong> не запрашивайте <code>action=services</code> при каждом заказе клиентов. Кэшируйте каталог на 10–30 минут в вашей локальной БД.</li>
      <li><strong>Логирование ответов:</strong> сохраняйте ID заказов и ответы сервера в журнал для упрощения отладки в случае обращения в техническую поддержку.</li>
    </ol>

    <h2>Читайте также по теме SMM API</h2>
    <ul className="space-y-2 my-4">
      <li><a href="/knowledge/kak-poluchit-api-kluch">Как получить API-ключ SMM-панели</a></li>
      <li><a href="/knowledge/api-metod-add">SMM API: создание заказа (метод add)</a></li>
      <li><a href="/knowledge/api-status-zakaza">SMM API: проверка статуса заказа</a></li>
      <li><a href="/knowledge/api-refill">SMM API: докрутка (refill) заказов</a></li>
      <li><a href="/knowledge/reselling-smm">Как заработать на реселлинге SMM-услуг</a></li>
    </ul>

    <h2>Как построить реселлинговый бизнес на базе SMMplan</h2>
    <p>Подключив SMMplan по API в качестве основного поставщика, вы можете установить собственную наценку (<a href="/knowledge/glossary/markup">Markup</a>) от 30% до 200%. Наша платформа берет на себя автоматический контроль качества провайдеров, систему Эластичного Карантина (<a href="/knowledge/glossary/quarantine">Quarantine</a>) и отслеживание курсов валют.</p>

    <div className="my-8 p-6 bg-primary/10 border border-primary/20 rounded-2xl text-center space-y-4">
      <h3 className="text-xl font-bold text-foreground">Получите ваш API-ключ прямо сейчас</h3>
      <p className="text-sm text-muted-foreground max-w-xl mx-auto">Перейдите в личный кабинет, создайте ключ и начните автоматическую интеграцию вашего сервиса с SMMplan.</p>
      <a href="/dashboard/settings/api" className="inline-block px-6 py-3 bg-primary text-primary-foreground font-bold rounded-full hover:opacity-90 transition-opacity">Перейти к созданию API-ключа</a>
    </div>
  `,
};
