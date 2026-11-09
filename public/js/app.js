// Основная логика мини-приложения ЦК19.

const SCREEN_NAMES = [
  'onboarding',
  'main',
  'center',
  'contacts',
  'interests',
  'profile',
  'share',
  'bonus',
  'quiz',
  'result',
  'coupon',
  'leaderboard',
  'feedback',
];

// Чередование тёмных и бумажных экранов — как слайды презентации.
const SCREEN_THEMES = {
  onboarding: 'dark',
  main: 'light',
  center: 'dark',
  contacts: 'light',
  interests: 'light',
  profile: 'dark',
  share: 'light',
  bonus: 'light',
  quiz: 'dark',
  result: 'dark',
  coupon: 'dark',
  leaderboard: 'light',
  feedback: 'light',
};

const App = {
  screen: null,
  history: [],
  user: { id: 0, name: 'друг', username: '' },
  profile: null,
  lastResult: null,
  shareText: SHARE_TEXT,
  interestsSubscribed: false,
  busy: false,
  _toastTimer: null,

  async init() {
    this.mountTemplates();
    this.initUser();
    this.bindEvents();

    await API.init(this.user);

    let consent = false;
    try {
      consent = await API.getConsent(this.user);
    } catch {
      consent = Store.getConsent();
    }

    const start = consent ? 'main' : 'onboarding';
    this.history = [start];
    this.goTo(start, { replace: true, force: true });
    API.track(this.user, 'miniapp_opened', { screen: start });

    if (this.bridgeActive()) {
      try {
        window.WebApp.ready();
      } catch {
        // MAX Bridge может быть недоступен при локальном запуске.
      }
      try {
        if (typeof window.WebApp.expand === 'function') window.WebApp.expand();
      } catch {
        // Не критично.
      }
    }
  },

  mountTemplates() {
    const root = document.getElementById('screens');
    if (!root) return;
    root.innerHTML = '';
    SCREEN_NAMES.forEach((name) => {
      const screen = document.createElement('div');
      screen.className = 'screen';
      screen.dataset.screen = name;
      // Каждый экран оформлен в своей тональности, как слайды презентации.
      screen.dataset.theme = SCREEN_THEMES[name] || 'dark';
      screen.innerHTML = (window.SCREEN_TEMPLATES && window.SCREEN_TEMPLATES[name]) || '';
      root.appendChild(screen);
    });
  },

  initUser() {
    const webApp = window.WebApp || {};
    const initData = webApp.initDataUnsafe || {};
    const raw = initData.user || initData.user_info || {};

    let id = raw.id || raw.user_id || initData.user_id;
    if (!id) {
      const saved = Number(localStorage.getItem('cc19_guest_id'));
      if (saved && Number.isFinite(saved)) {
        id = saved;
      } else {
        id = -Math.floor(100000000 + Math.random() * 900000000);
        localStorage.setItem('cc19_guest_id', String(id));
      }
    }

    const firstName = raw.first_name || raw.name || '';
    const lastName = raw.last_name || '';
    const stored = Store.read();
    const name =
      firstName ||
      lastName ||
      localStorage.getItem('cc19_name') ||
      (stored && stored.name) ||
      'друг';
    if (firstName) localStorage.setItem('cc19_name', firstName);

    this.user = {
      id,
      name,
      username: raw.username || '',
    };

    Store.ensure(name);
  },

  bindEvents() {
    document.addEventListener('click', async (event) => {
      if (event.target.closest('[data-stop]')) return;

      const actionEl = event.target.closest('[data-action]');
      if (actionEl) {
        const action = actionEl.dataset.action;
        if (action === 'modal:close') {
          this.closeModal();
          return;
        }
        event.preventDefault();
        await this.handleAction(action, actionEl);
        return;
      }

      const navEl = event.target.closest('[data-nav]');
      if (navEl) {
        event.preventDefault();
        const target = navEl.dataset.nav;
        if (target === 'share' && this.screen === 'profile') this.shareText = SHARE_TEXT;
        this.goTo(target);
        return;
      }

      const backEl = event.target.closest('[data-back]');
      if (backEl) {
        event.preventDefault();
        this.back();
        return;
      }

      const homeEl = event.target.closest('[data-home]');
      if (homeEl) {
        event.preventDefault();
        this.home();
        return;
      }

      const linkKeyEl = event.target.closest('[data-link-key]');
      if (linkKeyEl) {
        event.preventDefault();
        this.openLink(LINKS[linkKeyEl.dataset.linkKey]);
        return;
      }

      const linkEl = event.target.closest('[data-link]');
      if (linkEl) {
        event.preventDefault();
        this.openLink(linkEl.dataset.link);
      }
    });

    window.addEventListener('popstate', () => this.back());
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.closeModal();
    });
  },

  async handleAction(action, element) {
    switch (action) {
      case 'onboarding:accept':
        await this.acceptOnboarding();
        break;
      case 'interests:toggle':
        await this.toggleSubscription();
        break;
      case 'quiz:start':
        Quiz.start();
        break;
      case 'quiz:answer':
        Quiz.answer(Number(element.dataset.index));
        break;
      case 'quiz:next':
        Quiz.next();
        break;
      case 'quiz:share':
        this.shareResult();
        break;
      case 'coupon:claim':
        await this.claimCoupon(element.dataset.code);
        break;
      case 'feedback:next':
        Feedback.next();
        break;
      case 'feedback:prev':
        Feedback.prev();
        break;
      case 'feedback:submit':
        await Feedback.submit();
        break;
      case 'share:copy':
        this.copy(LINKS.BOT);
        break;
      case 'share:telegram':
        this.shareToTelegram();
        break;
      case 'share:max':
        this.shareToMax();
        break;
      case 'share:whatsapp':
        this.shareToWhatsApp();
        break;
      default:
        break;
    }
  },

  goTo(name, options = {}) {
    const target = document.querySelector('[data-screen="' + name + '"]');
    if (!target) return;
    if (this.screen === name && !options.force) return;

    if (this.screen === 'feedback' && name !== 'feedback') {
      Feedback.active = false;
    }

    const current = document.querySelector('.screen.active');
    if (current && current !== target) {
      current.classList.remove('active');
      current.classList.add('slide-left');
      const previous = current;
      setTimeout(() => previous.classList.remove('slide-left'), 320);
    }

    if (!options.silent) {
      if (options.replace) {
        this.history[this.history.length - 1] = name;
      } else if (this.history[this.history.length - 1] !== name) {
        this.history.push(name);
      }
    }

    this.screen = name;
    target.classList.add('active');

    const content = target.querySelector('.content');
    if (content) content.scrollTop = 0;

    const enter = this.onEnter[name];
    if (enter) enter();
  },

  back() {
    if (this.screen === 'feedback' && Feedback.active && Feedback.stepIndex > 0) {
      Feedback.prev();
      return;
    }

    if (this.screen === 'result') {
      this.home();
      return;
    }

    if (this.screen === 'onboarding') {
      this.close();
      return;
    }

    if (this.history.length > 1) {
      this.history.pop();
      const previous = this.history[this.history.length - 1];
      this.goTo(previous, { replace: true, force: true });
      return;
    }

    this.home();
  },

  home() {
    this.history = ['main'];
    this.goTo('main', { replace: true, force: true });
  },

  close() {
    if (this.bridgeActive() && typeof window.WebApp.close === 'function') {
      try {
        window.WebApp.close();
        return;
      } catch {
        // fallback ниже
      }
    }
    this.showToast('Закрытие приложения');
  },

  // MAX Bridge реально подключён только внутри клиента MAX: тогда есть initData/user.
  // Вне MAX SDK существует, но openLink/ready лишь пишут в консоль и ничего не делают.
  bridgeActive() {
    const wa = window.WebApp;
    if (!wa || typeof wa.openLink !== 'function') return false;
    const data = wa.initDataUnsafe || {};
    if (data.user || data.userInfo) return true;
    return typeof wa.initData === 'string' && wa.initData.length > 0;
  },

  openLink(url) {
    if (!url) return;

    // Внутри MAX просим открыть ссылку нативным клиентом.
    if (this.bridgeActive()) {
      try {
        window.WebApp.openLink(url);
        return;
      } catch {
        // падаем в браузерный fallback
      }
    }

    let opened = null;
    try {
      // Без 'noopener' в features: иначе Chrome возвращает null даже при успехе,
      // и код ниже открыл бы вторую вкладку.
      opened = window.open(url, '_blank');
    } catch {
      opened = null;
    }
    if (opened) {
      try {
        opened.opener = null;
      } catch {
        // не критично
      }
      return;
    }

    // Popup заблокирован: клик по временной ссылке в рамках user gesture.
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  },

  copy(text) {
    const onSuccess = () => this.showToast('Ссылка скопирована!');
    const fallback = () => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        onSuccess();
      } catch {
        this.showToast('Не удалось скопировать ссылку');
      }
      document.body.removeChild(textarea);
    };

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(onSuccess).catch(fallback);
    } else {
      fallback();
    }
  },

  showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  },

  openModal(title, text) {
    const overlay = document.getElementById('modal');
    const titleEl = document.getElementById('modalTitle');
    const textEl = document.getElementById('modalText');
    if (!overlay || !titleEl || !textEl) return;
    titleEl.textContent = title;
    textEl.textContent = text;
    overlay.classList.add('show');
  },

  closeModal() {
    const overlay = document.getElementById('modal');
    if (overlay) overlay.classList.remove('show');
  },

  shareResult() {
    const score = this.lastResult ? this.lastResult.score : 0;
    const template =
      score >= 80
        ? 'Я знаю о ЦК19 на {score} баллов! А ты сможешь побить мой результат?'
        : 'У меня {score} баллов в викторине ЦК19! Проверь свои знания культуры!';
    this.shareText = template.replace('{score}', String(score));
    this.goTo('share');
  },

  shareToTelegram() {
    const text = this.shareText || SHARE_TEXT;
    const url =
      'https://t.me/share/url?url=' +
      encodeURIComponent(LINKS.BOT) +
      '&text=' +
      encodeURIComponent(text);
    this.openLink(url);
  },

  shareToMax() {
    const text = this.shareText || SHARE_TEXT;
    this.openLink('https://max.ru/:share?text=' + encodeURIComponent(text));
  },

  shareToWhatsApp() {
    const text = this.shareText || SHARE_TEXT;
    const fullText = text.includes(LINKS.BOT) ? text : text + ' ' + LINKS.BOT;
    this.openLink('https://api.whatsapp.com/send?text=' + encodeURIComponent(fullText));
  },

  async acceptOnboarding() {
    if (this.busy) return;
    this.busy = true;

    const button = document.querySelector('[data-action="onboarding:accept"]');
    if (button) {
      button.disabled = true;
      button.textContent = 'Сохраняем…';
    }

    try {
      const result = await API.acceptOnboarding(this.user);
      API.track(this.user, 'onboarding_completed');
      this.history = ['main'];
      this.goTo('main', { replace: true, force: true });
      this.showToast(
        result.online
          ? 'Принято. Добро пожаловать!'
          : 'Принято. Добро пожаловать! Данные сохранены на устройстве.'
      );
    } finally {
      this.busy = false;
      if (button) {
        button.disabled = false;
        button.innerHTML = '<i class="fa-solid fa-check"></i> Принять';
      }
    }
  },

  async toggleSubscription() {
    if (this.busy) return;
    this.busy = true;

    const button = document.getElementById('interestsAction');
    const wasSubscribed = !!this.interestsSubscribed;
    if (button) {
      button.disabled = true;
      button.textContent = wasSubscribed ? 'Отписываем…' : 'Подписываем…';
    }

    try {
      const result = wasSubscribed
        ? await API.unsubscribe(this.user)
        : await API.subscribe(this.user);

      this.interestsSubscribed = !!result.subscribed;
      API.track(this.user, wasSubscribed ? 'subscription_disabled' : 'subscription_enabled');
      this.showToast(
        wasSubscribed
          ? 'Вы отписались от уведомлений о событиях.'
          : 'Отлично! Вы подписались на уведомления обо всех событиях ЦК19.'
      );
      await this.renderInterests();
    } finally {
      this.busy = false;
    }
  },

  async renderInterests() {
    const cards = document.getElementById('interestsCards');
    if (cards && !cards.dataset.ready) {
      cards.innerHTML = INTERESTS.map(
        (item, index) => `
          <div class="pulse-card">
            <span class="pulse-card__icon"><i class="fa-solid ${escapeAttr(item.icon)}"></i></span>
            <span class="pulse-card__title">${escapeHtml(item.title)}</span>
            <span class="pulse-card__index">0${index + 1}</span>
          </div>`
      ).join('');
      cards.dataset.ready = '1';
    }

    const titleEl = document.getElementById('interestsStatusTitle');
    const statusEl = document.getElementById('interestsStatusText');
    const badgeEl = document.getElementById('interestsBadge');
    const button = document.getElementById('interestsAction');
    if (!titleEl || !statusEl || !badgeEl || !button) return;

    titleEl.textContent = 'Проверяем подписку…';
    statusEl.textContent = 'Пожалуйста, подождите';
    badgeEl.innerHTML = '<i class="fa-solid fa-circle-notch"></i>';
    badgeEl.className = 'badge';
    button.disabled = true;

    const data = await API.getSubscription(this.user);
    this.interestsSubscribed = !!data.subscribed;

    if (data.subscribed) {
      titleEl.textContent = 'Вы подписаны';
      statusEl.textContent = data.online
        ? 'Уведомления о новых событиях включены'
        : 'Уведомления включены · локальный режим';
      badgeEl.innerHTML = '<i class="fa-solid fa-check"></i> активно';
      badgeEl.className = 'badge badge--green';
      button.className = 'btn btn-danger';
      button.innerHTML = '<i class="fa-solid fa-bell-slash"></i> Отписаться от рассылки';
    } else {
      titleEl.textContent = 'Вы не подписаны';
      statusEl.textContent = data.online
        ? 'Подпишитесь, чтобы получать уведомления о новых событиях'
        : 'Подписка не оформлена · локальный режим';
      badgeEl.innerHTML = '<i class="fa-solid fa-bell"></i> выключено';
      badgeEl.className = 'badge';
      button.className = 'btn btn-primary';
      button.innerHTML = '<i class="fa-solid fa-envelope-open-text"></i> Подписаться на рассылку';
    }

    button.disabled = false;
  },

  async renderProfile() {
    const container = document.getElementById('profileContent');
    if (!container) return;

    const profile = await API.getProfile(this.user);
    this.profile = profile;

    container.innerHTML = `
      <div class="profile-hero">
        <span class="spark" style="right:16%;top:24%"></span>
        <span class="spark spark--lav spark--sm" style="right:28%;bottom:22%;animation-delay:1.2s"></span>
        <div class="kicker">Участник</div>
        <div class="profile-hero__name">${escapeHtml(profile.name)}</div>
        <div class="profile-hero__meta">ID ${escapeHtml(profile.id)} · с ${formatDateRu(
      profile.memberSince
    )}</div>
      </div>

      <div class="profile-stats">
        <div class="stat stat--accent">
          <span class="stat-value">${Number(profile.score) || 0}</span>
          <span class="stat-label">баллы</span>
        </div>
        <div class="stat">
          <span class="stat-value">${escapeHtml(profile.rank || '—')}</span>
          <span class="stat-label">ранг</span>
        </div>
        <div class="stat">
          <span class="stat-value">${Number(profile.couponsCount) || 0}</span>
          <span class="stat-label">купоны</span>
        </div>
      </div>

      <div class="card">
        <div class="info-list">
          <div class="info-row">
            <span class="info-label"><i class="fa-solid fa-bell"></i> Подписки</span>
            <span class="info-value">${escapeHtml(profile.subscriptionLabel || '—')}</span>
          </div>
          <div class="info-row">
            <span class="info-label"><i class="fa-solid fa-user"></i> Имя</span>
            <span class="info-value">${escapeHtml(profile.name)}</span>
          </div>
          <div class="info-row">
            <span class="info-label"><i class="fa-solid fa-fingerprint"></i> ID</span>
            <span class="info-value">${escapeHtml(profile.id)}</span>
          </div>
        </div>
      </div>

      ${
        profile.subscribed
          ? '<div class="badge badge--green"><i class="fa-solid fa-check"></i> подписка активна</div>'
          : '<div class="badge"><i class="fa-solid fa-bell-slash"></i> подписка не оформлена</div>'
      }
      ${
        profile.online
          ? ''
          : '<p class="hint mt-12">Локальный режим: данные сохранены на этом устройстве.</p>'
      }
    `;
  },

  renderCenter() {
    const container = document.getElementById('centerContent');
    if (!container) return;

    const dayLabels = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    const pad = (value) => String(value).padStart(2, '0');
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours() + now.getMinutes() / 60;
    const today = CENTER.schedule.find((row) => row.weekdays.includes(day));

    const nextOpen = (() => {
      for (let offset = 1; offset <= 7; offset += 1) {
        const target = (day + offset) % 7;
        const row = CENTER.schedule.find(
          (item) => !item.closed && item.weekdays.includes(target)
        );
        if (row) return { offset, row };
      }
      return null;
    })();
    const nextLabel = nextOpen
      ? nextOpen.offset === 1
        ? 'завтра'
        : dayLabels[(day + nextOpen.offset) % 7]
      : '';

    let statusText = 'Режим работы';
    let statusClass = 'open-pill--closed';
    if (!today || today.closed) {
      statusText = nextOpen
        ? `Выходной · откроемся ${nextLabel} в ${pad(nextOpen.row.open)}:00`
        : 'Выходной';
    } else if (hour < today.open) {
      statusText = `Откроемся в ${pad(today.open)}:00`;
    } else if (hour < today.close) {
      statusText = `Открыто до ${pad(today.close)}:00`;
      statusClass = '';
    } else {
      statusText = nextOpen
        ? `Закрыто · откроемся ${nextLabel} в ${pad(nextOpen.row.open)}:00`
        : 'Закрыто';
    }

    const scheduleRows = CENTER.schedule
      .map((row) => {
        const isToday = row.weekdays.includes(day);
        const classes = [
          'schedule-row',
          isToday ? 'schedule-row--today' : '',
          row.closed ? 'schedule-row--closed' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const time = row.closed
          ? 'выходной'
          : `${pad(row.open)}:00 – ${pad(row.close)}:00`;
        return `<div class="${classes}">
          <span class="schedule-days">${escapeHtml(row.short)}${isToday ? ' · сегодня' : ''}</span>
          <span class="schedule-time">${escapeHtml(time)}</span>
        </div>`;
      })
      .join('');

    container.innerHTML = `
      <div class="center-hero">
        <span class="spark" style="left:84%;top:16%"></span>
        <span class="spark spark--lav spark--sm" style="left:70%;bottom:18%;animation-delay:1.6s"></span>
        <span class="spark spark--sm" style="left:90%;bottom:44%;animation-delay:3.1s"></span>
        <div class="center-orb"><span>19</span></div>
        <div class="kicker">Новосибирск · Свердлова, 13</div>
        <h1 class="page-title">Центр<br>культуры</h1>
        <p>Художественная институция в центре Новосибирска: выставки, лекции, концерты и мастер-классы на двух этажах и шести залах.</p>
        <div class="open-pill ${statusClass}">
          <span class="open-dot"></span>${escapeHtml(statusText)}
        </div>
      </div>

      <div class="center-section">
        <div class="section-label"><i class="fa-solid fa-location-dot"></i> Как добраться</div>
        <button class="address-card" data-link-key="MAP">
          <span class="address-icon"><i class="fa-solid fa-map-location-dot"></i></span>
          <span class="address-text">
            <strong>${escapeHtml(CENTER.address)}</strong>
            <span>${escapeHtml(CENTER.city)} · ${escapeHtml(CENTER.metro)}</span>
          </span>
          <i class="fa-solid fa-arrow-up-right-from-square go"></i>
        </button>
      </div>

      <div class="center-section">
        <div class="section-label"><i class="fa-regular fa-clock"></i> Режим работы</div>
        <div class="schedule">${scheduleRows}</div>
        <p class="hint mt-12">${escapeHtml(CENTER.note)}</p>
      </div>

      <div class="center-section">
        <div class="section-label"><i class="fa-solid fa-tower-broadcast"></i> Связаться</div>
        <div class="contact-grid">
          <a class="contact-tile" href="${escapeAttr(CENTER.phoneHref)}">
            <i class="fa-solid fa-phone"></i>
            <strong>${escapeHtml(CENTER.phone)}</strong>
            <span>телефон</span>
          </a>
          <a class="contact-tile" href="${escapeAttr(CENTER.emailHref)}">
            <i class="fa-solid fa-envelope"></i>
            <strong>${escapeHtml(CENTER.email)}</strong>
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
      </div>

      <button class="btn btn-primary" data-link-key="MAX_CHANNEL">
        <i class="fa-solid fa-bullhorn"></i> Макс-канал ЦК19
      </button>
      <button class="btn btn-secondary" data-link-key="SITE">
        <i class="fa-solid fa-globe"></i> Сайт центра
      </button>
      <button class="btn btn-secondary" data-nav="contacts">
        <i class="fa-solid fa-address-book"></i> Все контакты
      </button>
      <button class="btn btn-ghost" data-nav="main">
        <i class="fa-solid fa-arrow-left"></i> В меню
      </button>
    `;
  },

  renderShare() {
    const text = this.shareText || SHARE_TEXT;
    const message = document.getElementById('shareMessage');
    const link = document.getElementById('shareLinkText');
    if (message) message.textContent = text;
    if (link) link.textContent = LINKS.BOT;
  },

  async renderResult() {
    const container = document.getElementById('resultContent');
    if (!container) return;

    const result = this.lastResult;
    if (!result) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa-solid fa-clapperboard"></i></div>
          <strong>Результат не найден</strong>
          <p>Пройдите викторину, чтобы увидеть результат.</p>
        </div>
        <button class="btn btn-primary" data-nav="quiz">
          <i class="fa-solid fa-play"></i> Начать викторину
        </button>
        <button class="btn btn-secondary" data-nav="main">
          <i class="fa-solid fa-arrow-left"></i> В меню
        </button>
      `;
      return;
    }

    const score = Number(result.score) || 0;
    const correctCount = Number(result.correctCount) || 0;
    const total = Number(result.total) || QUIZ_QUESTIONS.length;
    const accuracy = Number(result.accuracy) || 0;
    const timeTaken = Number(result.timeTaken) || 0;
    const coupon = result.coupon;
    const recommendation = result.recommendation;

    container.innerHTML = `
      <div class="result-hero">
        <div class="score-ring">
          <span class="score-value">${correctCount}/${total}</span>
          <span class="score-label">правильных ответов</span>
        </div>
        <h1 class="page-title">Викторина завершена!</h1>
        <p class="page-subtitle">Спасибо за участие!</p>
      </div>

      <div class="result-stats">
        <div class="stat"><span class="stat-value">${accuracy}%</span><span class="stat-label">Точность</span></div>
        <div class="stat"><span class="stat-value">${timeTaken}</span><span class="stat-label">Секунд</span></div>
        <div class="stat"><span class="stat-value">${score}</span><span class="stat-label">Баллов</span></div>
      </div>

      ${
        score >= 80 && coupon
          ? `
            <div class="text-block text-block--accent">
              <p><strong>Круто, ты прошёл викторину!</strong></p>
              <p>Получи стикерпак на кассе ЦК19. Купон уже в разделе «Купоны».</p>
            </div>
            ${ticketHtml(coupon)}
          `
          : `
            <div class="text-block">
              <p>Пока без купона Бонус. Нужен результат от 8/10.</p>
            </div>
            ${
              recommendation
                ? `<div class="recommendation">
                    <div class="rec-title">${escapeHtml(recommendation.title)}</div>
                    <div class="rec-meta">${escapeHtml(recommendation.date)} ${escapeHtml(
                    recommendation.time
                  )}<br>${escapeHtml(recommendation.description)}</div>
                  </div>
                  <button class="btn btn-secondary" data-link="${escapeAttr(
                    recommendation.url
                  )}">Перейти к событию</button>`
                : ''
            }
          `
      }

      <div class="nav-menu mt-16">
        <button class="btn btn-primary" data-action="quiz:share"><i class="fa-solid fa-share-nodes"></i> Поделиться результатом</button>
        <button class="btn btn-secondary" data-nav="leaderboard"><i class="fa-solid fa-ranking-star"></i> Показать лидерборд</button>
        <button class="btn btn-secondary" data-nav="coupon"><i class="fa-solid fa-ticket"></i> Получить купон</button>
        <button class="btn btn-secondary" data-nav="main"><i class="fa-solid fa-arrow-left"></i> В меню</button>
      </div>
    `;
  },

  async renderCoupon() {
    const container = document.getElementById('couponContent');
    if (!container) return;

    container.innerHTML = `
      <div class="card">
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line"></div>
      </div>
    `;

    const data = await API.getLatestCoupon(this.user);
    const coupon = data.coupon;

    if (!coupon) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa-solid fa-ticket"></i></div>
          <strong>Купона пока нет</strong>
          <p>У тебя пока нет купона Бонус. Пройди викторину и получи результат от 8/10.</p>
        </div>
        <button class="btn btn-primary" data-nav="quiz">
          <i class="fa-solid fa-clapperboard"></i> Пройти викторину
        </button>
        <button class="btn btn-secondary" data-nav="main">
          <i class="fa-solid fa-arrow-left"></i> В меню
        </button>
      `;
      return;
    }

    const active = (coupon.status || 'Активный') === 'Активный';
    container.innerHTML = `
      <div class="kicker">Бонус</div>
      <h1 class="page-title">Купон</h1>
      ${ticketHtml(coupon)}
      ${
        active
          ? `<button class="btn btn-primary" data-action="coupon:claim" data-code="${escapeAttr(
              coupon.code
            )}"><i class="fa-solid fa-circle-check"></i> Отметить как полученный</button>`
          : `<div class="text-block text-block--flat"><p class="small muted">Купон уже использован. Спасибо!</p></div>`
      }
      <button class="btn btn-secondary mt-12" data-nav="bonus"><i class="fa-solid fa-arrow-left"></i> Назад</button>
      ${
        data.online
          ? ''
          : '<p class="hint mt-12">Локальный режим: купон сохранён на этом устройстве.</p>'
      }
    `;
  },

  async claimCoupon(code) {
    if (this.busy || !code) return;
    this.busy = true;
    try {
      const result = await API.claimCoupon(this.user, code);
      if (result.ok) {
        API.track(this.user, 'coupon_claimed', { code });
        this.showToast('Отлично! Стикерпак отмечен как полученный.');
        await this.renderCoupon();
      } else {
        this.showToast('Купон не найден или уже истёк.');
      }
    } finally {
      this.busy = false;
    }
  },

  async renderLeaderboard() {
    const container = document.getElementById('leaderboardContent');
    if (!container) return;

    container.innerHTML = `
      <div class="card">
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line"></div>
      </div>
    `;

    const data = await API.getLeaderboard(this.user);
    const list = data.leaderboard || [];

    if (!list.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa-solid fa-ranking-star"></i></div>
          <strong>Лидерборд пока пуст</strong>
          <p>Станьте первым, кто пройдёт викторину!</p>
        </div>
        <button class="btn btn-primary" data-nav="quiz">
          <i class="fa-solid fa-clapperboard"></i> Пройти викторину
        </button>
        <button class="btn btn-secondary" data-nav="bonus">
          <i class="fa-solid fa-arrow-left"></i> Назад
        </button>
      `;
      return;
    }

    const rows = list
      .map((entry, index) => {
        const rank = index + 1;
        const name = entry.username || entry.name || 'User ' + (entry.user_id || '');
        const medal = rank === 1 ? 'fa-crown' : rank <= 3 ? 'fa-medal' : '';
        return `<div class="lb-row ${rank <= 3 ? 'lb-row--top' : ''}">
          <div class="lb-rank">${medal ? `<i class="fa-solid ${medal}"></i>` : rank}</div>
          <div class="lb-name">${escapeHtml(name)}</div>
          <div class="lb-score">${Number(entry.score) || 0} баллов</div>
        </div>`;
      })
      .join('');

    container.innerHTML = `
      <div class="kicker">Топ игроков</div>
      <h1 class="page-title">Лидерборд</h1>
      <p class="page-subtitle">Топ-10 игроков викторины «Закулисье ЦК19»</p>
      <div class="leaderboard">${rows}</div>
      <button class="btn btn-secondary mt-16" data-nav="bonus"><i class="fa-solid fa-arrow-left"></i> Назад</button>
      ${
        data.online
          ? ''
          : '<p class="hint mt-12">Локальный режим: показаны результаты с этого устройства.</p>'
      }
    `;
  },

  onEnter: {
    onboarding() {
      const nameEl = document.getElementById('onboardingName');
      if (nameEl) nameEl.textContent = App.user.name || 'друг';
    },

    main() {},

    center() {
      App.renderCenter();
    },

    contacts() {},

    interests() {
      App.renderInterests();
    },

    profile() {
      App.renderProfile();
    },

    share() {
      App.renderShare();
    },

    bonus() {},

    quiz() {
      Quiz.enter();
    },

    result() {
      App.renderResult();
    },

    coupon() {
      App.renderCoupon();
    },

    leaderboard() {
      App.renderLeaderboard();
    },

    feedback() {
      Feedback.enter();
    },
  },
};

const Quiz = {
  state: null,

  enter() {
    this.state = null;
    this.renderIntro();
  },

  renderIntro() {
    const container = document.getElementById('quizContent');
    if (!container) return;
    container.innerHTML = `
      <div class="kicker">Закулисье ЦК19</div>
      <h1 class="page-title">Викторина</h1>
      <div class="text-block text-block--accent">
        <p>Добро пожаловать в викторину «Закулисье ЦК19»!</p>
        <p>Отвечайте на вопросы, зарабатывайте баллы и узнавайте интересные факты о культуре!</p>
      </div>
      <div class="status-card">
        <div>
          <strong>10 вопросов</strong>
          <span>По 10 баллов за правильный ответ</span>
        </div>
        <span class="badge badge--accent">до 100</span>
      </div>
      <button class="btn btn-primary" data-action="quiz:start"><i class="fa-solid fa-play"></i> Начать</button>
      <button class="btn btn-secondary" data-nav="bonus"><i class="fa-solid fa-arrow-left"></i> Назад</button>
    `;
  },

  start() {
    this.state = {
      index: 0,
      score: 0,
      startTime: Date.now(),
      answered: false,
      selected: null,
      finished: false,
    };
    this.renderQuestion();
  },

  renderQuestion() {
    const container = document.getElementById('quizContent');
    const state = this.state;
    if (!container || !state) return;

    const question = QUIZ_QUESTIONS[state.index];
    const progress = Math.floor((state.index / QUIZ_QUESTIONS.length) * 100);
    const letters = ['А', 'Б', 'В', 'Г'];

    container.innerHTML = `
      <div class="quiz-progress">
        <div class="progress-meta">
          <span>Вопрос <strong>${state.index + 1}/${QUIZ_QUESTIONS.length}</strong></span>
          <span>Текущий результат: <strong>${state.score}</strong> баллов</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
      </div>

      <div class="question-card">
        <div class="question-number">Вопрос ${state.index + 1}</div>
        <div class="question-text">${formatText(question.question)}</div>
      </div>

      <div class="options" id="quizOptions">
        ${question.options
          .map(
            (option, index) => `
            <button class="option" data-action="quiz:answer" data-index="${index}">
              <span class="option-letter">${letters[index]}</span>
              <span class="option-text">${escapeHtml(option)}</span>
            </button>`
          )
          .join('')}
      </div>

      <div id="quizFeedback"></div>
    `;
  },

  answer(index) {
    const state = this.state;
    if (!state || state.answered) return;

    const question = QUIZ_QUESTIONS[state.index];
    const correct = question.correct === index;
    state.answered = true;
    state.selected = index;

    if (correct) state.score += 10;

    const options = document.querySelectorAll('#quizOptions .option');
    options.forEach((option, optionIndex) => {
      option.classList.add('disabled');
      if (optionIndex === question.correct) option.classList.add('correct');
      else if (optionIndex === index) option.classList.add('wrong');
      else option.classList.add('dimmed');
    });

    const feedback = document.getElementById('quizFeedback');
    if (feedback) {
      feedback.innerHTML = `
        <div class="feedback-card ${correct ? 'feedback-card--good' : 'feedback-card--bad'}">
          <div class="feedback-title">${
            correct
              ? '<i class="fa-solid fa-circle-check"></i> БРАВО! +10 баллов'
              : '<i class="fa-solid fa-circle-xmark"></i> Неправильно!'
          }</div>
          <div class="fact">${
            correct
              ? '<i class="fa-solid fa-lightbulb"></i> ' + formatText(question.fact)
              : '<i class="fa-solid fa-arrow-right"></i> Поехали дальше'
          }</div>
        </div>
        <button class="btn btn-primary" data-action="quiz:next">${
          state.index + 1 >= QUIZ_QUESTIONS.length
            ? '<i class="fa-solid fa-flag-checkered"></i> Показать результат'
            : '<i class="fa-solid fa-arrow-right"></i> Следующий вопрос'
        }</button>
      `;
    }

    API.track(App.user, 'quiz_answer', {
      question: state.index + 1,
      correct,
    });
  },

  next() {
    const state = this.state;
    if (!state) return;

    state.index += 1;
    state.answered = false;
    state.selected = null;

    if (state.index >= QUIZ_QUESTIONS.length) {
      this.finish();
      return;
    }

    this.renderQuestion();
  },

  async finish() {
    const state = this.state;
    if (!state || state.finished) return;
    state.finished = true;

    const timeTaken = Number(((Date.now() - state.startTime) / 1000).toFixed(2));
    const container = document.getElementById('quizContent');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa-solid fa-circle-notch"></i></div>
          <strong>Считаем результат…</strong>
          <p>Сохраняем баллы и проверяем купон.</p>
        </div>
      `;
    }

    const result = await API.submitQuiz(App.user, {
      score: state.score,
      timeTaken,
    });

    App.lastResult = result;
    API.track(App.user, 'quiz_completed', {
      score: state.score,
      correctCount: result.correctCount,
      total: result.total,
    });
    App.goTo('result', { replace: true });
  },
};

const Feedback = {
  active: false,
  stepIndex: 0,
  data: {},
  error: '',

  steps: ['name', 'email', 'date', 'text', 'confirm'],

  start() {
    this.active = true;
    this.stepIndex = 0;
    this.data = {};
    this.error = '';
    this.render();
  },

  enter() {
    if (!this.active) this.start();
    else this.render();
  },

  render() {
    const container = document.getElementById('feedbackContent');
    if (!container) return;

    const step = this.steps[this.stepIndex];

    if (step === 'confirm') {
      container.innerHTML = `
        <div class="kicker">Проверьте отзыв</div>
        <h1 class="page-title">Всё верно?</h1>
        <div class="preview">
          <div class="preview-row"><span>Имя</span><strong>${escapeHtml(this.data.name || '')}</strong></div>
          <div class="preview-row"><span>Почта</span><strong>${escapeHtml(this.data.email || '')}</strong></div>
          <div class="preview-row"><span>Дата</span><strong>${escapeHtml(this.data.date || '')}</strong></div>
          <div class="preview-row"><span>Отзыв</span><strong>${escapeHtml(this.data.feedback || '')}</strong></div>
        </div>
        ${this.error ? `<div class="error">${escapeHtml(this.error)}</div>` : ''}
        <button class="btn btn-primary" data-action="feedback:submit"><i class="fa-solid fa-paper-plane"></i> Отправить</button>
        <button class="btn btn-secondary" data-action="feedback:prev"><i class="fa-solid fa-arrow-left"></i> Назад</button>
        <button class="btn btn-ghost" data-nav="main">Отменить</button>
      `;
      return;
    }

    const stepNumber = this.stepIndex + 1;
    const stepInfo = {
      name: {
        kicker: 'Обратная связь',
        title: 'Как вас зовут?',
        label: 'Имя',
        placeholder: 'Иван',
        hint: 'Например: Иван',
        type: 'text',
        value: this.data.name || '',
        autocomplete: 'name',
      },
      email: {
        kicker: 'Обратная связь',
        title: 'Почта для связи',
        label: 'Email',
        placeholder: 'ivan@email.com',
        hint: 'Например: ivan@email.com',
        type: 'email',
        value: this.data.email || '',
        autocomplete: 'email',
      },
      date: {
        kicker: 'Обратная связь',
        title: 'Дата посещения',
        label: 'Дата',
        placeholder: '25.10.2025',
        hint: 'Формат: 25.10.2025',
        type: 'text',
        value: this.data.date || '',
        autocomplete: 'off',
      },
      text: {
        kicker: 'Обратная связь',
        title: 'Ваш отзыв',
        label: 'Отзыв',
        placeholder: 'Опишите ваши впечатления…',
        hint: 'Расскажите, что понравилось или что можно улучшить.',
        type: 'textarea',
        value: this.data.feedback || '',
        autocomplete: 'off',
      },
    }[step];

    const field =
      stepInfo.type === 'textarea'
        ? `<textarea class="textarea" id="fbInput" placeholder="${escapeAttr(
            stepInfo.placeholder
          )}">${escapeHtml(stepInfo.value)}</textarea>`
        : `<input class="input" id="fbInput" type="${escapeAttr(
            stepInfo.type
          )}" value="${escapeAttr(stepInfo.value)}" placeholder="${escapeAttr(
            stepInfo.placeholder
          )}" autocomplete="${escapeAttr(stepInfo.autocomplete)}">`;

    container.innerHTML = `
      <div class="kicker">${stepInfo.kicker}</div>
      <h1 class="page-title">${stepInfo.title}</h1>
      <div class="progress-meta">
        <span>Шаг <strong>${stepNumber}/4</strong></span>
        <span class="muted">${step === 'date' ? 'Необязательно указывать будущую дату' : 'Заполните поле'}</span>
      </div>
      <div class="progress-track mb-0"><div class="progress-fill" style="width:${(stepNumber / 4) * 100}%"></div></div>
      <div class="form mt-16">
        <div class="field">
          <label for="fbInput">${stepInfo.label}</label>
          ${field}
          <span class="hint">${stepInfo.hint}</span>
        </div>
        ${this.error ? `<div class="error">${escapeHtml(this.error)}</div>` : ''}
        <button class="btn btn-primary" data-action="feedback:next">Далее</button>
        <button class="btn btn-secondary" data-nav="main">Отменить</button>
      </div>
    `;
  },

  next() {
    const input = document.getElementById('fbInput');
    const value = input ? input.value : '';
    const step = this.steps[this.stepIndex];
    this.error = '';

    if (step === 'name') {
      const name = String(value || '').trim();
      if (!name) {
        this.error = 'Укажите, пожалуйста, ваше имя.';
        this.render();
        return;
      }
      this.data.name = name;
    } else if (step === 'email') {
      const email = normalizeEmail(value);
      if (!validateEmail(email)) {
        this.error = 'Некорректный email. Введите, пожалуйста, в формате ivan@email.com.';
        this.render();
        return;
      }
      this.data.email = email;
    } else if (step === 'date') {
      const normalized = normalizeRuDate(value);
      if (!normalized) {
        this.error = 'Некорректная дата. Введите, пожалуйста, в формате 25.10.2025.';
        this.render();
        return;
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [day, month, year] = normalized.split('.').map(Number);
      const inputDate = new Date(year, month - 1, day);
      inputDate.setHours(0, 0, 0, 0);
      if (inputDate > today) {
        this.error = 'Хм, твоя дата из будущего. Укажите пожалуйста текущую или прошлую дату.';
        this.render();
        return;
      }
      this.data.date = normalized;
    } else if (step === 'text') {
      const text = String(value || '').trim();
      if (!text) {
        this.error = 'Опишите, пожалуйста, ваш отзыв.';
        this.render();
        return;
      }
      this.data.feedback = text;
    }

    this.stepIndex += 1;
    this.render();
  },

  prev() {
    if (this.stepIndex <= 0) return;
    this.stepIndex -= 1;
    this.error = '';
    this.render();
  },

  async submit() {
    if (App.busy) return;
    App.busy = true;

    try {
      await API.sendFeedback(App.user, this.data);
      API.track(App.user, 'feedback_sent');
      if (this.data.name) {
        Store.setName(this.data.name);
        App.user.name = this.data.name;
      }
      this.active = false;
      App.history = ['main'];
      App.goTo('main', { replace: true, force: true });
      App.showToast('Спасибо! Отзыв отправлен администратору.');
    } finally {
      App.busy = false;
    }
  },
};

/* Helpers */

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, (char) => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char];
  });
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function formatText(value) {
  return escapeHtml(value)
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

function ticketHtml(coupon) {
  const status = coupon.status || 'Активный';
  const isActive = status === 'Активный';
  const name = coupon.username || App.user.name || 'Участник';
  return `
    <div class="ticket">
      <div class="ticket-head">
        <span class="ticket-brand"><i class="fa-solid fa-ticket"></i> ЦК19 · БОНУС</span>
        <span class="ticket-status ${isActive ? '' : 'ticket-status--done'}">${escapeHtml(status)}</span>
      </div>
      <div class="ticket-row"><span>Участник</span><strong>${escapeHtml(name)}</strong></div>
      <div class="ticket-row"><span>Дата</span><strong>${formatDateRu(coupon.issuedAt)}</strong></div>
      <div class="ticket-code">${escapeHtml(coupon.code)}</div>
      <div class="ticket-note">Покажите купон на кассе ЦК19.</div>
    </div>
  `;
}

const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

function normalizeEmail(value) {
  return String(value || '').trim();
}

function validateEmail(value) {
  return EMAIL_RE.test(normalizeEmail(value));
}

function normalizeRuDate(value) {
  const raw = String(value || '').trim();
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return (
    String(day).padStart(2, '0') + '.' + String(month).padStart(2, '0') + '.' + year
  );
}

document.addEventListener('DOMContentLoaded', () => App.init());
