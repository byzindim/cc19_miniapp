// HTML-шаблоны экранов в визуальном языке презентации ЦК19.

function tplHeader(title, opts = {}) {
  const back =
    opts.back === false
      ? '<button class="header-back is-hidden" aria-hidden="true"></button>'
      : '<button class="header-back" data-back aria-label="Назад"><i class="fa-solid fa-arrow-left"></i></button>';
  const right =
    opts.home === false
      ? '<button class="header-menu is-hidden" aria-hidden="true"></button>'
      : '<button class="header-menu" data-home aria-label="На главную"><i class="fa-solid fa-house"></i></button>';
  const logo = opts.logo ? '<div class="header-logo">ЦК19</div>' : '';
  return `<div class="header">${back}<div class="header-title">${logo}<span>${title}</span></div>${right}</div>`;
}

window.SCREEN_TEMPLATES = {};

/* ============ Онбординг ============ */

window.SCREEN_TEMPLATES.onboarding = `${tplHeader('ЦК19', { back: false, home: false, logo: true })}
<div class="content">
  <div class="hero-slide">
    <span class="spark" style="left:12%;top:22%"></span>
    <span class="spark spark--lav spark--sm" style="left:78%;top:16%;animation-delay:1.4s"></span>
    <span class="spark spark--sm" style="left:88%;top:62%;animation-delay:2.6s"></span>
    <div class="hero-slide__label">Центр культуры · Новосибирск</div>
    <h1 class="display">Привет,<br><span id="onboardingName">друг</span>!</h1>
    <p class="hero-slide__sub">Цифровой гид по выставкам и событиям ЦК19.</p>
    <div class="hero-meta">
      <span class="chip"><i class="fa-solid fa-location-dot"></i> Свердлова, 13</span>
      <span class="chip"><i class="fa-solid fa-clock"></i> Ср–Вс</span>
    </div>
  </div>

  <div class="kicker">Перед началом</div>
  <div class="steps">
    <button class="step-row" data-link-key="CONSENT">
      <span class="step-num">01</span>
      <span class="step-body">
        <span class="step-title"><i class="fa-solid fa-file-signature"></i> Форма согласия</span>
        <span class="step-desc">Согласие на обработку персональных данных</span>
      </span>
    </button>
    <button class="step-row" data-link-key="POLICY">
      <span class="step-num">02</span>
      <span class="step-body">
        <span class="step-title"><i class="fa-solid fa-shield-halved"></i> Политика конфиденциальности</span>
        <span class="step-desc">Как мы работаем с вашими данными</span>
      </span>
    </button>
    <div class="step-row" style="cursor:default">
      <span class="step-num">03</span>
      <span class="step-body">
        <span class="step-title"><i class="fa-solid fa-circle-check"></i> Принять и начать</span>
        <span class="step-desc">Нажмите «Принять», чтобы продолжить</span>
      </span>
    </div>
  </div>

  <button class="btn btn-primary" data-action="onboarding:accept">
    <i class="fa-solid fa-check"></i> Принять
  </button>
  <p class="hint mt-12">Нажимая «Принять», вы соглашаетесь на обработку персональных данных.</p>
</div>`;

/* ============ Главное меню ============ */

window.SCREEN_TEMPLATES.main = `${tplHeader('ЦК19', { back: false, home: false, logo: true })}
<div class="content">
  <div class="kicker">Навигация</div>
  <h1 class="page-title">Выберите<br>раздел</h1>
  <p class="page-subtitle">Афиша, интересы, бонусы и профиль — всё о Центре культуры в одном месте.</p>

  <div class="menu-grid">
    <button class="tile tile--link" data-link-key="AFISHA">
      <span class="tile-icon"><i class="fa-solid fa-masks-theater"></i></span>
      <span class="tile-title">Афиша</span>
      <i class="fa-solid fa-arrow-up-right-from-square tile-arrow"></i>
    </button>

    <button class="tile" data-nav="bonus">
      <span class="tile-icon"><i class="fa-solid fa-gift"></i></span>
      <span class="tile-title">Получить бонус</span>
      <i class="fa-solid fa-chevron-right tile-arrow"></i>
    </button>

    <button class="tile" data-nav="interests">
      <span class="tile-icon"><i class="fa-solid fa-bullseye"></i></span>
      <span class="tile-title">Интересы</span>
      <i class="fa-solid fa-chevron-right tile-arrow"></i>
    </button>

    <button class="tile" data-nav="profile">
      <span class="tile-icon"><i class="fa-solid fa-user"></i></span>
      <span class="tile-title">Профиль</span>
      <i class="fa-solid fa-chevron-right tile-arrow"></i>
    </button>

    <button class="tile" data-nav="feedback">
      <span class="tile-icon"><i class="fa-solid fa-comment-dots"></i></span>
      <span class="tile-title">Отзывы</span>
      <i class="fa-solid fa-chevron-right tile-arrow"></i>
    </button>

    <button class="tile" data-nav="center">
      <span class="tile-icon"><i class="fa-solid fa-location-dot"></i></span>
      <span class="tile-title">О центре</span>
      <i class="fa-solid fa-chevron-right tile-arrow"></i>
    </button>
  </div>
</div>`;

/* ============ О центре (рендерится в app.js) ============ */

window.SCREEN_TEMPLATES.center = `${tplHeader('О центре')}
<div class="content" id="centerContent"></div>`;

/* ============ Контакты ============ */

window.SCREEN_TEMPLATES.contacts = `${tplHeader('Контакты')}
<div class="content">
  <div class="kicker">Связаться</div>
  <h1 class="page-title">Контакты</h1>
  <p class="page-subtitle">Позвоните, напишите или приходите — мы на связи.</p>

  <div class="contact-grid">
    <a class="contact-tile" href="tel:+73832090486">
      <i class="fa-solid fa-phone"></i>
      <strong>+7 (383) 209–04–86</strong>
      <span>телефон</span>
    </a>
    <a class="contact-tile" href="mailto:info_cc19@list.ru">
      <i class="fa-solid fa-envelope"></i>
      <strong>info_cc19@list.ru</strong>
      <span>почта</span>
    </a>
    <button class="contact-tile" data-link-key="VK">
      <i class="fa-brands fa-vk"></i>
      <strong>ВКонтакте</strong>
      <span>сообщество</span>
    </button>
    <button class="contact-tile" data-link-key="TELEGRAM">
      <i class="fa-brands fa-telegram"></i>
      <strong>Telegram</strong>
      <span>канал</span>
    </button>
  </div>

  <div class="text-block text-block--flat">
    <p class="small">Касса закрывается за 30 минут до окончания работы. Понедельник и вторник — выходные.</p>
  </div>

  <button class="btn btn-secondary" data-nav="center"><i class="fa-solid fa-arrow-left"></i> Назад</button>
</div>`;

/* ============ Интересы ============ */

window.SCREEN_TEMPLATES.interests = `${tplHeader('Интересы')}
<div class="content">
  <div class="kicker">Будьте в курсе</div>
  <h1 class="page-title">Что вам<br>интересно</h1>
  <p class="page-subtitle">Узнайте первым о новых событиях Центра — подписка на рассылку в один шаг.</p>

  <div class="pulse-grid" id="interestsCards"></div>

  <div class="status-card">
    <div>
      <strong id="interestsStatusTitle">Проверяем подписку…</strong>
      <span id="interestsStatusText">Пожалуйста, подождите</span>
    </div>
    <span class="badge" id="interestsBadge">…</span>
  </div>

  <button class="btn btn-primary" id="interestsAction" data-action="interests:toggle" disabled>
    <i class="fa-solid fa-envelope-open-text"></i> Подписаться на рассылку
  </button>
  <button class="btn btn-secondary" data-nav="main"><i class="fa-solid fa-arrow-left"></i> Назад</button>
</div>`;

/* ============ Профиль ============ */

window.SCREEN_TEMPLATES.profile = `${tplHeader('Профиль')}
<div class="content">
  <div class="kicker">ART PROFILE</div>
  <h1 class="page-title">Профиль</h1>
  <div id="profileContent">
    <div class="card">
      <div class="skeleton skeleton-line"></div>
      <div class="skeleton skeleton-line"></div>
      <div class="skeleton skeleton-line"></div>
    </div>
  </div>
  <button class="btn btn-primary" data-nav="share"><i class="fa-solid fa-share-nodes"></i> Поделиться приложением</button>
  <button class="btn btn-secondary" data-nav="main"><i class="fa-solid fa-arrow-left"></i> Назад</button>
</div>`;

/* ============ Поделиться ============ */

window.SCREEN_TEMPLATES.share = `${tplHeader('Поделиться')}
<div class="content">
  <div class="kicker">Пригласите друзей</div>
  <h1 class="page-title">Поделиться</h1>
  <div class="text-block">
    <p id="shareMessage">Приглашаю в мини-приложение ЦК19 — цифровой гид по выставкам и событиям Центра.</p>
  </div>
  <div class="share-link"><i class="fa-solid fa-link"></i><span id="shareLinkText"></span></div>
  <button class="btn btn-primary" data-action="share:copy"><i class="fa-solid fa-copy"></i> Скопировать ссылку</button>
  <div class="btn-row mt-12">
    <button class="btn btn-secondary" data-action="share:telegram"><i class="fa-brands fa-telegram"></i> Telegram</button>
    <button class="btn btn-secondary" data-action="share:max"><i class="fa-solid fa-comment"></i> MAX</button>
  </div>
  <button class="btn btn-secondary mt-12" data-action="share:whatsapp"><i class="fa-brands fa-whatsapp"></i> WhatsApp</button>
  <button class="btn btn-ghost mt-12" data-nav="profile"><i class="fa-solid fa-arrow-left"></i> Назад</button>
</div>`;

/* ============ Бонусы ============ */

window.SCREEN_TEMPLATES.bonus = `${tplHeader('Бонусы')}
<div class="content">
  <div class="kicker">Играйте и получайте</div>
  <h1 class="page-title">Бонусы<br>ЦК19</h1>
  <p class="page-subtitle">Отвечайте на вопросы, зарабатывайте баллы и обменивайте их на бонусы.</p>

  <div class="cta-list">
    <button class="cta-card" data-nav="quiz">
      <span class="cta-num">01</span>
      <span class="cta-icon"><i class="fa-solid fa-clapperboard"></i></span>
      <span class="cta-body">
        <span class="cta-title">Викторина</span>
        <span class="cta-desc">10 вопросов о культуре и ЦК19 · до 100 баллов</span>
      </span>
      <span class="cta-cta">
        <i class="fa-solid fa-play"></i> <span class="cta-cta-label">Нажать</span>
      </span>
    </button>

    <button class="cta-card" data-nav="coupon">
      <span class="cta-num">02</span>
      <span class="cta-icon"><i class="fa-solid fa-ticket"></i></span>
      <span class="cta-body">
        <span class="cta-title">Получить купон</span>
        <span class="cta-desc">Стикерпак на кассе при результате от 8/10</span>
      </span>
      <span class="cta-cta">
        <i class="fa-solid fa-arrow-right"></i> <span class="cta-cta-label">Забрать</span>
      </span>
    </button>

    <button class="cta-card" data-nav="leaderboard">
      <span class="cta-num">03</span>
      <span class="cta-icon"><i class="fa-solid fa-ranking-star"></i></span>
      <span class="cta-body">
        <span class="cta-title">Лидерборд</span>
        <span class="cta-desc">Топ-10 игроков по баллам</span>
      </span>
      <span class="cta-cta">
        <i class="fa-solid fa-arrow-right"></i> <span class="cta-cta-label">Открыть</span>
      </span>
    </button>
  </div>

  <button class="btn btn-secondary" data-nav="main"><i class="fa-solid fa-arrow-left"></i> Назад</button>
</div>`;

/* ============ Викторина / результат / купон / лидерборд / отзывы ============ */

window.SCREEN_TEMPLATES.quiz = `${tplHeader('Викторина')}
<div class="content" id="quizContent"></div>`;

window.SCREEN_TEMPLATES.result = `${tplHeader('Результат')}
<div class="content" id="resultContent"></div>`;

window.SCREEN_TEMPLATES.coupon = `${tplHeader('Купон')}
<div class="content" id="couponContent"></div>`;

window.SCREEN_TEMPLATES.leaderboard = `${tplHeader('Лидерборд')}
<div class="content" id="leaderboardContent"></div>`;

window.SCREEN_TEMPLATES.feedback = `${tplHeader('Отзывы')}
<div class="content" id="feedbackContent"></div>`;
