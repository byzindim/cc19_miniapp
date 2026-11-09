// API-клиент и локальное хранилище.
// Если backend доступен — данные сохраняются в MySQL, как в max_bot.
// Если backend недоступен — приложение продолжает работать на localStorage.

const STORAGE_KEY = 'cc19_miniapp_state_v1';

const Store = {
  read() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  },

  write(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage может быть недоступен в приватном режиме — молча игнорируем.
    }
  },

  ensure(name) {
    const state = this.read();
    if (!state.firstSeen) state.firstSeen = new Date().toISOString();
    if (name && !state.name) state.name = name;
    this.write(state);
    return state;
  },

  setName(name) {
    if (!name) return;
    const state = this.read();
    state.name = name;
    this.write(state);
  },

  getConsent() {
    return !!this.read().consent;
  },

  setConsent(value) {
    const state = this.read();
    state.consent = !!value;
    if (!state.consentAt) state.consentAt = new Date().toISOString();
    this.write(state);
  },

  getSubscription() {
    const state = this.read();
    return {
      subscribed: !!state.subscribed,
      subscribedAt: state.subscribedAt || null,
    };
  },

  setSubscribed(value) {
    const state = this.read();
    state.subscribed = !!value;
    state.subscribedAt = value ? new Date().toISOString() : state.subscribedAt || null;
    this.write(state);
  },

  getResults() {
    return this.read().results || [];
  },

  saveResult(result) {
    const state = this.read();
    state.results = state.results || [];
    state.results.push({ ...result, createdAt: new Date().toISOString() });
    this.write(state);
  },

  getCoupons() {
    return this.read().coupons || [];
  },

  saveCoupon(coupon) {
    if (!coupon || !coupon.code) return;
    const state = this.read();
    state.coupons = state.coupons || [];
    if (!state.coupons.some((item) => item.code === coupon.code)) {
      state.coupons.push({
        code: coupon.code,
        issuedAt: coupon.issuedAt || new Date().toISOString(),
        status: coupon.status || 'Активный',
        username: coupon.username || state.name || '',
      });
    }
    this.write(state);
  },

  getLatestCoupon() {
    const coupons = this.getCoupons();
    if (!coupons.length) return null;
    return coupons
      .slice()
      .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())[0];
  },

  claimCoupon(code) {
    const state = this.read();
    state.coupons = state.coupons || [];
    const coupon = state.coupons.find((item) => item.code === code);
    if (coupon) coupon.status = 'Завершен';
    this.write(state);
    return coupon || null;
  },

  saveFeedback(data) {
    const state = this.read();
    state.feedback = state.feedback || [];
    state.feedback.push({ ...data, createdAt: new Date().toISOString() });
    this.write(state);
  },

  track(event, meta = {}) {
    const state = this.read();
    state.analytics = state.analytics || [];
    state.analytics.push({ event, meta, createdAt: new Date().toISOString() });
    this.write(state);
  },

  getProfile(user, username) {
    const state = this.read();
    const results = state.results || [];
    const score = results.reduce((sum, item) => sum + (Number(item.score) || 0), 0);
    const bestScore = results.reduce((max, item) => Math.max(max, Number(item.score) || 0), 0);
    const leaderboard = this.getLeaderboard(user);
    const rank = results.length
      ? '#' + (1 + leaderboard.filter((item) => item.score > bestScore).length)
      : '—';

    return {
      id: user.id,
      name: username || state.name || user.name || 'Гость',
      memberSince: state.firstSeen || new Date().toISOString(),
      subscribed: !!state.subscribed,
      subscriptionLabel: state.subscribed ? 'Все события ЦК19' : '—',
      score,
      rank,
      couponsCount: (state.coupons || []).length,
      online: false,
    };
  },

  getLeaderboard(user) {
    const state = this.read();
    const name = state.name || user.name || 'Гость';
    return (state.results || [])
      .slice()
      .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
      .slice(0, 10)
      .map((item) => ({
        user_id: user.id,
        username: name,
        score: Number(item.score) || 0,
      }));
  },
};

const API = {
  base: window.CC19_API_BASE || localStorage.getItem('cc19_api_base') || '',
  online: false,
  checked: false,

  url(path) {
    return this.base.replace(/\/$/, '') + path;
  },

  async init(user) {
    Store.ensure(user && user.name);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const response = await fetch(this.url('/api/health'), {
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await response.json().catch(() => null);
      this.online = response.ok && (!data || data.db !== false);
    } catch {
      this.online = false;
    }
    this.checked = true;
    return this.online;
  },

  async request(path, options = {}) {
    if (!this.online) throw new Error('offline');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const headers = { ...(options.headers || {}) };
    if (options.body) headers['Content-Type'] = 'application/json';

    try {
      const response = await fetch(this.url(path), {
        ...options,
        headers,
        signal: controller.signal,
        cache: 'no-store',
      });

      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!response.ok) {
        const error = new Error((data && data.error) || 'HTTP ' + response.status);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } finally {
      clearTimeout(timer);
    }
  },

  identity(user) {
    return {
      userId: user.id,
      name: user.name,
      username: user.username || '',
    };
  },

  query(params) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        search.set(key, String(value));
      }
    });
    const result = search.toString();
    return result ? '?' + result : '';
  },

  async getConsent(user) {
    if (this.online) {
      try {
        const data = await this.request('/api/consent' + this.query({ userId: user.id }));
        if (data && data.consent) {
          Store.setConsent(true);
          return true;
        }
      } catch {
        // fallback ниже
      }
    }
    return Store.getConsent();
  },

  async acceptOnboarding(user) {
    try {
      const data = await this.request('/api/onboarding/accept', {
        method: 'POST',
        body: JSON.stringify(this.identity(user)),
      });
      Store.setConsent(true);
      return { ok: true, online: true, acceptedAt: data && data.acceptedAt };
    } catch {
      Store.setConsent(true);
      return { ok: true, online: false };
    }
  },

  async getProfile(user) {
    if (this.online) {
      try {
        const data = await this.request('/api/profile' + this.query(this.identity(user)));
        if (data && data.profile) {
          Store.setSubscribed(data.profile.subscribed);
          if (data.profile.name) Store.setName(data.profile.name);
          return { ...data.profile, online: true };
        }
      } catch {
        // fallback ниже
      }
    }
    return Store.getProfile(user, user.name);
  },

  async getSubscription(user) {
    if (this.online) {
      try {
        const data = await this.request('/api/subscription' + this.query({ userId: user.id }));
        Store.setSubscribed(data && data.subscribed);
        return {
          subscribed: !!(data && data.subscribed),
          subscribedAt: data && data.subscribedAt,
          online: true,
        };
      } catch {
        // fallback ниже
      }
    }
    const local = Store.getSubscription();
    return { ...local, online: false };
  },

  async subscribe(user) {
    try {
      const data = await this.request('/api/subscription/subscribe', {
        method: 'POST',
        body: JSON.stringify(this.identity(user)),
      });
      Store.setSubscribed(true);
      return { subscribed: true, subscribedAt: data && data.subscribedAt, online: true };
    } catch {
      Store.setSubscribed(true);
      return { subscribed: true, subscribedAt: new Date().toISOString(), online: false };
    }
  },

  async unsubscribe(user) {
    try {
      await this.request('/api/subscription/unsubscribe', {
        method: 'POST',
        body: JSON.stringify(this.identity(user)),
      });
      Store.setSubscribed(false);
      return { subscribed: false, online: true };
    } catch {
      Store.setSubscribed(false);
      return { subscribed: false, online: false };
    }
  },

  async submitQuiz(user, payload) {
    const total = QUIZ_QUESTIONS.length;
    const correctCount = Math.round(payload.score / 10);
    const accuracy = total ? Number(((correctCount / total) * 100).toFixed(2)) : 0;
    const localResult = {
      score: payload.score,
      correctCount,
      total,
      timeTaken: payload.timeTaken,
      accuracy,
    };

    Store.saveResult(localResult);

    if (this.online) {
      try {
        const data = await this.request('/api/quiz/result', {
          method: 'POST',
          body: JSON.stringify({
            ...this.identity(user),
            score: payload.score,
            correctCount,
            total,
            timeTaken: payload.timeTaken,
          }),
        });

        if (data && data.result) {
          if (data.result.coupon) Store.saveCoupon(data.result.coupon);
          return { ...data.result, online: true };
        }
      } catch {
        // fallback ниже
      }
    }

    let coupon = null;
    if (payload.score >= 80) {
      coupon = {
        code: generateCouponCode(user.id, user.name, new Date()),
        issuedAt: new Date().toISOString(),
        status: 'Активный',
        username: user.name,
      };
      Store.saveCoupon(coupon);
    }

    return {
      ...localResult,
      coupon,
      recommendation: payload.score < 80 ? getRecommendationEvent(payload.score) : null,
      online: false,
    };
  },

  async getLeaderboard(user) {
    if (this.online) {
      try {
        const data = await this.request('/api/leaderboard');
        if (data && Array.isArray(data.leaderboard)) {
          return { leaderboard: data.leaderboard, online: true };
        }
      } catch {
        // fallback ниже
      }
    }
    return { leaderboard: Store.getLeaderboard(user), online: false };
  },

  async getLatestCoupon(user) {
    if (this.online) {
      try {
        const data = await this.request('/api/coupons/latest' + this.query({ userId: user.id }));
        if (data && data.coupon) {
          Store.saveCoupon(data.coupon);
          return { coupon: data.coupon, online: true };
        }
        if (data && data.coupon === null) {
          return { coupon: Store.getLatestCoupon(), online: true };
        }
      } catch {
        // fallback ниже
      }
    }
    return { coupon: Store.getLatestCoupon(), online: false };
  },

  async claimCoupon(user, code) {
    try {
      const data = await this.request('/api/coupons/claim', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, code }),
      });
      Store.claimCoupon(code);
      return { ok: !!(data && data.ok), status: (data && data.status) || 'Завершен', online: true };
    } catch {
      const coupon = Store.claimCoupon(code);
      return { ok: !!coupon, status: 'Завершен', online: false };
    }
  },

  async sendFeedback(user, data) {
    try {
      await this.request('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({ ...this.identity(user), ...data }),
      });
      Store.saveFeedback(data);
      return { ok: true, online: true };
    } catch {
      Store.saveFeedback(data);
      return { ok: true, online: false };
    }
  },

  track(user, event, meta = {}) {
    Store.track(event, meta);
    if (!this.online) return;
    this.request('/api/analytics', {
      method: 'POST',
      body: JSON.stringify({ ...this.identity(user), event, meta }),
    }).catch(() => {});
  },
};

function generateCouponCode(userId, username, issuedAt) {
  const date = issuedAt instanceof Date ? issuedAt : new Date(issuedAt);
  const raw = String(username || '').replace(/^@/, '');
  const safe = raw.replace(/[^A-Za-z0-9_-]/g, '');
  const handle = safe ? safe.slice(0, 12).toUpperCase() : 'USER' + String(userId).slice(-6);
  const ymd =
    date.getFullYear() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');
  const short = date.getTime().toString(36).toUpperCase().slice(-6);
  return `CC19-BONUS-${handle}-${ymd}-${short}`;
}

function formatDateRu(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return (
    String(date.getDate()).padStart(2, '0') +
    '.' +
    String(date.getMonth() + 1).padStart(2, '0') +
    '.' +
    date.getFullYear()
  );
}
