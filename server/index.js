import express from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as db from './db.js';
import { sendToAdmin } from './max-api.js';
import { routeUpdate, WEBHOOK_SECRET } from './webhook.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env'), override: false });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), override: false });
dotenv.config({ path: path.join(__dirname, '..', '..', 'max_bot', '.env'), override: false });

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

let dbReady = false;
let dbError = null;

app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Max-User-Id');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

function requireDb(req, res, next) {
  if (!dbReady) {
    return res.status(503).json({
      ok: false,
      offline: true,
      error: 'База данных недоступна',
    });
  }
  next();
}

function userIdFrom(req) {
  const raw = req.body?.userId ?? req.query?.userId ?? req.header('x-max-user-id');
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

function nameFrom(req) {
  return String(req.body?.name ?? req.query?.name ?? '').trim();
}

function requireUser(req, res, next) {
  const userId = userIdFrom(req);
  if (!userId) {
    return res.status(400).json({ ok: false, error: 'userId обязателен' });
  }
  req.userId = userId;
  next();
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

function validateEmail(value) {
  return EMAIL_RE.test(String(value || '').trim());
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
  return String(day).padStart(2, '0') + '.' + String(month).padStart(2, '0') + '.' + year;
}

function getRecommendationEvent(score) {
  const events = [
    {
      id: 1,
      title: 'Лекция №1 «Современное неевропейское искусство»',
      date: '28.03',
      time: '17:00',
      description: '500 руб.',
      url: 'https://cc19.ru/events/',
    },
    {
      id: 2,
      title: 'Встреча в рамках проекта «Книжный клуб ЦК19»',
      date: '22.03',
      time: '12:00',
      description: 'Нон-фикшн и художественная проза о художниках.',
      url: 'https://cc19.ru/product/vstrecha-v-ramkah-proekta-czk19-knizhnyj-klub/',
    },
    {
      id: 3,
      title: 'Концерт фортепианной музыки «Новая встреча»',
      date: '15.03',
      time: '17:00',
      description: '300/400 руб.',
      url: 'https://cc19.ru/events/',
    },
  ];

  if (score >= 70) return events[0];
  if (score >= 50) return events[1];
  return events[2];
}

function generateBonusCouponCode(userId, username, issuedAt) {
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

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    db: dbReady,
    dbError,
    time: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', db: dbReady, dbError, time: new Date().toISOString() });
});

app.get(
  '/api/consent',
  requireDb,
  requireUser,
  asyncRoute(async (req, res) => {
    const consent = await db.getUserConsent(req.userId);
    res.json({ ok: true, consent });
  })
);

app.post(
  '/api/onboarding/accept',
  requireDb,
  requireUser,
  asyncRoute(async (req, res) => {
    const name = nameFrom(req);
    const user = await db.savePrivacyConsent(req.userId, name);
    await db.saveAnalytics(req.userId, 'onboarding_completed');
    res.json({
      ok: true,
      acceptedAt: new Date().toISOString(),
      userId: user.tg_id,
    });
  })
);

app.get(
  '/api/profile',
  requireDb,
  requireUser,
  asyncRoute(async (req, res) => {
    const profile = await db.getUserProfile(req.userId, nameFrom(req));
    res.json({ ok: true, profile });
  })
);

app.get(
  '/api/subscription',
  requireDb,
  requireUser,
  asyncRoute(async (req, res) => {
    const subscribed = await db.isSubscribedToEvents(req.userId);
    const subscribedAt = subscribed ? await db.getSubscriptionDate(req.userId) : null;
    res.json({ ok: true, subscribed, subscribedAt });
  })
);

app.post(
  '/api/subscription/subscribe',
  requireDb,
  requireUser,
  asyncRoute(async (req, res) => {
    await db.subscribeToAllEvents(req.userId, nameFrom(req));
    const subscribedAt = await db.getSubscriptionDate(req.userId);
    await db.saveAnalytics(req.userId, 'subscription_enabled');
    res.json({ ok: true, subscribed: true, subscribedAt });
  })
);

app.post(
  '/api/subscription/unsubscribe',
  requireDb,
  requireUser,
  asyncRoute(async (req, res) => {
    await db.unsubscribeFromAllEvents(req.userId);
    await db.saveAnalytics(req.userId, 'subscription_disabled');
    res.json({ ok: true, subscribed: false });
  })
);

app.post(
  '/api/quiz/result',
  requireDb,
  requireUser,
  asyncRoute(async (req, res) => {
    const score = Number(req.body?.score);
    const correctCount = Number(req.body?.correctCount);
    const total = Number(req.body?.total) || 10;
    const timeTaken = Number(req.body?.timeTaken) || 0;

    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return res.status(400).json({ ok: false, error: 'Некорректный score' });
    }
    if (!Number.isFinite(correctCount) || correctCount < 0 || correctCount > total) {
      return res.status(400).json({ ok: false, error: 'Некорректный correctCount' });
    }

    const name = nameFrom(req) || 'Гость';

    await db.updateLeaderboard(req.userId, name, score);
    await db.saveQuizResult(req.userId, name, score, correctCount, total, timeTaken);
    await db.saveAnalytics(req.userId, 'quiz_completed', {
      score,
      correctCount,
      total,
    });

    let coupon = null;
    if (score >= 80) {
      const issuedAt = new Date();
      const code = generateBonusCouponCode(req.userId, name, issuedAt);
      await db.saveBonusCoupon(req.userId, name, code);
      coupon = {
        code,
        issuedAt: issuedAt.toISOString(),
        status: 'Активный',
        username: name,
      };
    }

    const accuracy = total ? Number(((correctCount / total) * 100).toFixed(2)) : 0;

    res.json({
      ok: true,
      result: {
        score,
        correctCount,
        total,
        accuracy,
        timeTaken,
        coupon,
        recommendation: score < 80 ? getRecommendationEvent(score) : null,
      },
    });
  })
);

app.get(
  '/api/leaderboard',
  requireDb,
  asyncRoute(async (req, res) => {
    const leaderboard = await db.getLeaderboard(10);
    res.json({ ok: true, leaderboard });
  })
);

app.get(
  '/api/coupons/latest',
  requireDb,
  requireUser,
  asyncRoute(async (req, res) => {
    const coupon = await db.getLatestCoupon(req.userId, nameFrom(req));
    res.json({ ok: true, coupon });
  })
);

app.post(
  '/api/coupons/claim',
  requireDb,
  requireUser,
  asyncRoute(async (req, res) => {
    const code = String(req.body?.code || '').trim();
    if (!code) {
      return res.status(400).json({ ok: false, error: 'code обязателен' });
    }

    const result = await db.claimCoupon(req.userId, code);
    if (!result.ok) {
      return res.status(404).json({ ok: false, error: 'Купон не найден' });
    }

    await db.saveAnalytics(req.userId, 'coupon_claimed', { code });
    res.json({ ok: true, status: result.status });
  })
);

app.post(
  '/api/feedback',
  requireDb,
  requireUser,
  asyncRoute(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim();
    const date = String(req.body?.date || '').trim();
    const feedback = String(req.body?.feedback || '').trim();

    if (!name) {
      return res.status(400).json({ ok: false, error: 'Укажите имя' });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ ok: false, error: 'Некорректный email' });
    }

    const normalizedDate = normalizeRuDate(date);
    if (!normalizedDate) {
      return res.status(400).json({ ok: false, error: 'Некорректная дата' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [day, month, year] = normalizedDate.split('.').map(Number);
    const visitDate = new Date(year, month - 1, day);
    visitDate.setHours(0, 0, 0, 0);
    if (visitDate > today) {
      return res.status(400).json({ ok: false, error: 'Дата из будущего' });
    }

    if (!feedback) {
      return res.status(400).json({ ok: false, error: 'Укажите отзыв' });
    }

    await db.saveFeedback(req.userId, {
      name,
      email,
      date: normalizedDate,
      feedback,
    });

    const adminText = [
      'Новый отзыв от мини-приложения ЦК19 (MAX):',
      `Имя: ${name || '(не указано)'}`,
      `Почта: ${email || '(не указана)'}`,
      `Дата: ${normalizedDate || '(не указана)'}`,
      `Отзыв: ${feedback || '(пусто)'}`,
      `max_user_id: ${req.userId}`,
    ].join('\n');

    await sendToAdmin(adminText);
    await db.saveAnalytics(req.userId, 'feedback_sent');

    res.json({ ok: true });
  })
);

app.post(
  '/api/analytics',
  requireDb,
  requireUser,
  asyncRoute(async (req, res) => {
    const event = String(req.body?.event || '').trim();
    if (!event) {
      return res.status(400).json({ ok: false, error: 'event обязателен' });
    }
    await db.saveAnalytics(req.userId, event, req.body?.meta || {});
    res.json({ ok: true });
  })
);

app.post('/webhook', async (req, res) => {
  if (WEBHOOK_SECRET) {
    const receivedSecret = req.header('x-max-bot-api-secret');
    if (receivedSecret !== WEBHOOK_SECRET) {
      return res.status(401).json({ ok: false, error: 'Invalid secret' });
    }
  }

  const update = req.body || {};
  console.log('📥 Webhook событие:', update.update_type);

  try {
    const result = await routeUpdate(update);
    res.json({ success: true, ...result });
  } catch (error) {
    // MAX повторяет доставку при 5xx, поэтому отвечаем 200 и логируем ошибку.
    console.error('❌ Ошибка обработки webhook:', error.message);
    res.json({ success: true, error: error.message });
  }
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path === '/webhook') return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((error, req, res, next) => {
  console.error('❌ API error:', error);
  res.status(error.status || 500).json({
    ok: false,
    error: error.message || 'Внутренняя ошибка сервера',
  });
});

async function start() {
  try {
    await db.initDatabase();
    dbReady = true;
  } catch (error) {
    dbReady = false;
    dbError = error.message;
    console.warn('⚠️ MySQL недоступен, мини-приложение будет работать в локальном режиме.');
    console.warn('   Причина:', error.message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 ЦК19 mini-app: http://localhost:${PORT}`);
    console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
    console.log(`🗄️  MySQL: ${dbReady ? 'подключена' : 'недоступна (localStorage fallback)'}`);
  });
}

start();
