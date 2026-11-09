# ЦК19 — мини-приложение в MAX

Полный перенос функционала чат-бота `max_bot` в мини-приложение MAX.
Интерфейс — SPA без сборки, backend — Express + MySQL (Sequelize).

## Дизайн и айдентика

Дизайн основан на клиентской презентации `pres.pdf` (AVACADA, «Цифровой куратор ЦК19»).

- **Палитра**: тёмный `#0d0d0d`, бумажный `#f5f0f8`, белый `#ffffff`.
- **Акценты**: маджента `#c24c96`, лаванда `#a47eb7`, розовый `#d76a8f`, персиковый `#e0907a`.
- **Чередование**: тёмные и светлые экраны — как слайды презентации.
- **Типографика**: крупные разрежённые заголовки КАПСОМ (Manrope, 800), тонкие mono-лейблы (JetBrains Mono), капс-подписи, нумерованные шаги 01–06.
- **Иконки**: Font Awesome 6.5.2, тематические, корпоративного цвета (маджента).
- **Анимации**:
  - Карточки интересов — тёплая медленная пульсация (`warmPulse` / `warmGlow`), у каждой карточки свой цикл и оттенок.
  - Экран «О центре» — вращающийся конический орб, пульсирующий статус-пилюля (открыто/закрыто по текущему времени), таймлайн расписания с подсветкой сегодняшней строки, каскадное появление секций (`riseIn`).
  - Искры-ромбики (`spark`) на hero-экранах.

### Экраны и темы

| Экран | Тема | Ключевые элементы |
|---|---|---|
| Онбординг | Тёмный | Hero-slide, шаги 01–03, FA-иконки |
| Главное меню | Светлый | Tile-grid, wide-плитка афиши |
| О центре | Тёмный | Орб 19, open-pill, адрес-карточка, расписание-таймлайн, контакты-плитки |
| Контакты | Светлый | 4 contact-tile (телефон, почта, VK, Telegram) |
| Интересы | Светлый | Pulse-grid 6 карточек, статус-карта, подписка |
| Профиль | Тёмный | Hero + stats + info-card + бейдж подписки |
| Бонусы | Светлый | Steps 01–03 (викторина → купон → лидерборд) |
| Викторина | Тёмный | Progress, вопрос-карточка, опции с подсветкой, факт-карточка |
| Результат | Тёмный | Score-ring, ticket-купон с вырезами |
| Купон | Тёмный | Ticket-билет, кнопка «отметить полученным» |
| Лидерборд | Светлый | Топ-10 с crown/medal-иконками |
| Отзывы | Светлый | 4-шаговый мультистеп-форм с FA-прогрессом |
| Поделиться | Светлый | Текст, ссылка, кнопки Telegram/MAX/WhatsApp |

## Структура

```
cc19_miniapp/
├── public/
│   ├── index.html          # Точка входа
│   ├── css/styles.css      # Дизайн всех экранов
│   └── js/
│       ├── data.js         # Вопросы викторины, тексты, ссылки, события
│       ├── templates.js    # HTML-шаблоны экранов
│       ├── api.js          # API-клиент + localStorage fallback
│       └── app.js          # Навигация и вся клиентская логика
├── server/
│   ├── index.js            # Express: статика + REST API + webhook
│   ├── db.js               # Sequelize-модели и работа с MySQL
│   ├── max-api.js          # Отправка сообщений в MAX, рассылка
│   └── webhook.js          # Обработка событий MAX (канал, /start)
├── package.json
├── .env.example
└── README.md
```

## Запуск

```powershell
cd cc19_miniapp
npm install
Copy-Item .env.example .env
# заполните DATABASE_URL, MAX_BOT_TOKEN, MAX_ADMIN_ID и остальные поля
npm start
```

Открыть: `http://localhost:3000`.

Приложение автоматически:
1. Подключается к той же MySQL-базе, что и `max_bot`.
2. Создаёт недостающие таблицы `coupon_claims` и `feedback` (существующие не меняет).
3. Отдаёт статику и API с одного origin.

Если MySQL или backend недоступны, мини-приложение продолжает работать в локальном режиме на `localStorage`. Это удобно для демо и статического деплоя.

## Статический деплой

Можно выложить только папку `public/` на любой HTTPS-хостинг. В этом случае работают все экраны, викторина, купоны, лидерборд и отзывы в локальном режиме.

Чтобы статическая версия обращалась к отдельному backend, задайте перед загрузкой `api.js`:

```html
<script>
  window.CC19_API_BASE = 'https://api.example.com';
</script>
```

Или в консоли браузера:

```js
localStorage.setItem('cc19_api_base', 'https://api.example.com');
```

## API

| Метод | Endpoint | Назначение |
|---|---|---|
| GET | `/api/health` | Состояние сервера и БД |
| GET | `/api/consent?userId=` | Проверка согласия на обработку ПД |
| POST | `/api/onboarding/accept` | Сохранение согласия + аналитика |
| GET | `/api/profile?userId=&name=` | Профиль: баллы, ранг, подписка, купоны |
| GET | `/api/subscription?userId=` | Статус подписки на события |
| POST | `/api/subscription/subscribe` | Подписаться на все события |
| POST | `/api/subscription/unsubscribe` | Отписаться |
| POST | `/api/quiz/result` | Результат викторины, лидерборд, купон |
| GET | `/api/leaderboard` | Топ-10 |
| GET | `/api/coupons/latest?userId=` | Последний купон |
| POST | `/api/coupons/claim` | Отметить купон полученным |
| POST | `/api/feedback` | Сохранить отзыв и отправить админу в MAX |
| POST | `/api/analytics` | Событие аналитики |
| POST | `/webhook` | Посты канала MAX → рассылка подписчикам |

## Таблицы БД

Переиспользуются таблицы `max_bot`:

`users`, `privacy_consents`, `quiz_results`, `quiz_completions`, `user_progress`,
`leaderboard`, `achievements`, `analytics`, `promo_codes`, `stickers`,
`sticker_packs`, `user_event_subscriptions`.

Добавлены:

- `coupon_claims` — статус «купон получен».
- `feedback` — история отзывов (дублируется администратору в MAX).

## MAX Bridge

Подключается через CDN:

```html
<script src="https://st.max.ru/js/max-web-app.js"></script>
```

Используется:

- `WebApp.initDataUnsafe.user` — имя и ID пользователя;
- `WebApp.ready()` / `WebApp.expand()` — инициализация;
- `WebApp.openLink(url)` — внешние ссылки;
- `WebApp.close()` — закрытие.

Если Bridge недоступен (локальный запуск), создаётся стабильный отрицательный guest ID.

> Для production рекомендуется добавить проверку подписи `initData` на backend,
> чтобы доверять `userId` из MAX WebApp.

## Уведомления о событиях

Подписка хранится в `user_event_subscriptions`. При новом посте в канале MAX
(`MAX_CHANNEL_ID`) webhook вызывает `broadcastPost()` и отправляет пост всем
подписчикам через MAX API — так же, как `max_bot/webhook.js`.
