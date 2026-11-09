import { Sequelize, DataTypes } from 'sequelize';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env мини-приложения, затем корневой .env и .env старого бота.
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: false });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), override: false });
dotenv.config({ path: path.join(__dirname, '..', '..', 'max_bot', '.env'), override: false });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('⚠️ DATABASE_URL не задан — backend будет работать в локальном режиме без MySQL.');
}

const mysqlUrl = (DATABASE_URL || 'mysql://root:root@localhost:3306/cc19').replace(
  'mysql+aiomysql://',
  'mysql://'
);

export const sequelize = new Sequelize(mysqlUrl, {
  dialect: 'mysql',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

// === Модели (совместимы с таблицами max_bot) ===

export const User = sequelize.define(
  'User',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tg_id: { type: DataTypes.BIGINT, unique: true, allowNull: false },
    username: { type: DataTypes.STRING(255), allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'users', timestamps: false }
);

export const PrivacyConsent = sequelize.define(
  'PrivacyConsent',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    consented_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'privacy_consents', timestamps: false }
);

export const QuizResult = sequelize.define(
  'QuizResult',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    score: { type: DataTypes.INTEGER, allowNull: false },
    correct_answers: { type: DataTypes.INTEGER, allowNull: false },
    total_questions: { type: DataTypes.INTEGER, allowNull: false },
    time_taken: { type: DataTypes.FLOAT, allowNull: false },
    meta: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'quiz_results', timestamps: false }
);

export const QuizCompletion = sequelize.define(
  'QuizCompletion',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    completed_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    score: { type: DataTypes.INTEGER, allowNull: false },
  },
  { tableName: 'quiz_completions', timestamps: false }
);

export const UserProgress = sequelize.define(
  'UserProgress',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    current_score: { type: DataTypes.INTEGER, defaultValue: 0 },
    questions_answered: { type: DataTypes.INTEGER, defaultValue: 0 },
    last_update: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'user_progress', timestamps: false }
);

export const Leaderboard = sequelize.define(
  'Leaderboard',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    username: { type: DataTypes.STRING(255), allowNull: false },
    score: { type: DataTypes.INTEGER, defaultValue: 0 },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'leaderboard', timestamps: false }
);

export const Achievement = sequelize.define(
  'Achievement',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    achievement_name: { type: DataTypes.STRING(255), allowNull: false },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'achievements', timestamps: false }
);

export const Analytics = sequelize.define(
  'Analytics',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    event: { type: DataTypes.STRING(100), allowNull: false },
    meta: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'analytics', timestamps: false }
);

export const PromoCode = sequelize.define(
  'PromoCode',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    code: { type: DataTypes.STRING(128), allowNull: false },
    source: { type: DataTypes.STRING(64), allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'promo_codes', timestamps: false }
);

export const Sticker = sequelize.define(
  'Sticker',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_tg_id: { type: DataTypes.INTEGER, allowNull: false },
    pack_name: { type: DataTypes.STRING(255), allowNull: true },
    file_id: { type: DataTypes.STRING(512), allowNull: false },
    file_unique_id: { type: DataTypes.STRING(512), allowNull: true },
    file_type: { type: DataTypes.STRING(32), allowNull: true },
    emoji: { type: DataTypes.STRING(16), allowNull: true },
    added_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    visible: { type: DataTypes.INTEGER, defaultValue: 1 },
    source: { type: DataTypes.STRING(64), allowNull: true },
    moderated: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  { tableName: 'stickers', timestamps: false }
);

export const StickerPack = sequelize.define(
  'StickerPack',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), unique: true, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    is_active: { type: DataTypes.INTEGER, defaultValue: 1 },
  },
  { tableName: 'sticker_packs', timestamps: false }
);

export const UserEventSubscription = sequelize.define(
  'UserEventSubscription',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    subscribed_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    unsubscribed_at: { type: DataTypes.DATE, allowNull: true },
    is_subscribed: { type: DataTypes.INTEGER, defaultValue: 1 },
  },
  {
    tableName: 'user_event_subscriptions',
    timestamps: false,
    indexes: [{ fields: ['user_id'], unique: true }],
  }
);

// Новая таблица мини-приложения: отметка «купон получен».
export const CouponClaim = sequelize.define(
  'CouponClaim',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    code: { type: DataTypes.STRING(128), allowNull: false, unique: true },
    claimed_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'coupon_claims', timestamps: false }
);

// Новая таблица мини-приложения: отзывы (плюс отправка администратору в MAX).
export const Feedback = sequelize.define(
  'Feedback',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: true },
    name: { type: DataTypes.STRING(255), allowNull: true },
    email: { type: DataTypes.STRING(255), allowNull: true },
    visit_date: { type: DataTypes.STRING(32), allowNull: true },
    feedback_text: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'feedback', timestamps: false }
);

User.hasMany(UserEventSubscription, { foreignKey: 'user_id', as: 'eventSubscriptions' });
UserEventSubscription.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// === Функции ===

export async function initDatabase() {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL не задан');
  }
  await sequelize.authenticate();
  console.log('✅ База данных подключена');
  await sequelize.sync({ alter: false });
  console.log('✅ Таблицы синхронизированы');
  return true;
}

export async function getOrCreateUser(tgId, username = null) {
  const [user, created] = await User.findOrCreate({
    where: { tg_id: tgId },
    defaults: { username: username || null, created_at: new Date() },
  });

  if (!created && username && user.username !== username) {
    await user.update({ username });
  }

  return { user, created };
}

export async function savePrivacyConsent(tgId, username) {
  const { user } = await getOrCreateUser(tgId, username);
  await PrivacyConsent.create({ user_id: user.id, consented_at: new Date() });
  return user;
}

export async function hasPrivacyConsent(tgId) {
  const user = await User.findOne({ where: { tg_id: tgId } });
  if (!user) return false;
  const count = await PrivacyConsent.count({ where: { user_id: user.id } });
  return count > 0;
}

export async function saveQuizResult(
  tgId,
  username,
  score,
  correctAnswers,
  totalQuestions,
  timeTaken,
  meta = null
) {
  const { user } = await getOrCreateUser(tgId, username);

  try {
    await QuizResult.create({
      user_id: user.id,
      score,
      correct_answers: correctAnswers,
      total_questions: totalQuestions,
      time_taken: timeTaken,
      meta: meta ? JSON.stringify(meta) : null,
      created_at: new Date(),
    });
  } catch (error) {
    // В исходной таблице max_bot колонка time_taken может быть INT —
    // тогда сохраняем округлённое значение, чтобы результат не потерялся.
    console.warn('⚠️ time_taken не сохранён как дробное, повтор с округлением:', error.message);
    await QuizResult.create({
      user_id: user.id,
      score,
      correct_answers: correctAnswers,
      total_questions: totalQuestions,
      time_taken: Math.round(timeTaken),
      meta: meta ? JSON.stringify(meta) : null,
      created_at: new Date(),
    });
  }

  await QuizCompletion.create({
    user_id: user.id,
    completed_at: new Date(),
    score,
  });

  const existingProgress = await UserProgress.findOne({ where: { user_id: user.id } });
  if (existingProgress) {
    await existingProgress.update({
      current_score: (existingProgress.current_score || 0) + score,
      questions_answered: (existingProgress.questions_answered || 0) + totalQuestions,
      last_update: new Date(),
    });
  } else {
    await UserProgress.create({
      user_id: user.id,
      current_score: score,
      questions_answered: totalQuestions,
      last_update: new Date(),
    });
  }

  return user.id;
}

export async function updateLeaderboard(tgId, username, score) {
  const { user } = await getOrCreateUser(tgId, username);
  await Leaderboard.create({
    user_id: user.id,
    username: username || user.username || 'Гость',
    score,
    timestamp: new Date(),
  });
}

export async function getLeaderboard(limit = 10) {
  const results = await Leaderboard.findAll({
    order: [['score', 'DESC']],
    limit,
  });
  return results.map((row) => ({
    user_id: row.user_id,
    username: row.username,
    score: row.score,
  }));
}

async function computeRank(userId) {
  const allLeaders = await Leaderboard.findAll({
    where: { user_id: userId },
    order: [['score', 'DESC']],
  });

  if (allLeaders.length === 0) return '—';

  const bestScore = allLeaders[0].score;
  const rankResult = await sequelize.query(
    'SELECT COUNT(DISTINCT user_id) as rank FROM leaderboard WHERE score > :score',
    { replacements: { score: bestScore }, type: sequelize.QueryTypes.SELECT }
  );

  return rankResult.length > 0 ? '#' + (rankResult[0].rank + 1) : '#1';
}

export async function getUserRank(tgId) {
  const { user } = await getOrCreateUser(tgId, '');
  return computeRank(user.id);
}

export async function addAchievement(tgId, achievementName, username = '') {
  const { user } = await getOrCreateUser(tgId, username);
  await Achievement.create({
    user_id: user.id,
    achievement_name: achievementName,
    timestamp: new Date(),
  });
}

export async function saveAnalytics(tgId, event, meta = {}) {
  let userId = null;
  if (tgId) {
    try {
      const { user } = await getOrCreateUser(tgId, '');
      userId = user.id;
    } catch (error) {
      console.error('saveAnalytics: failed to resolve user', error.message);
    }
  }
  await Analytics.create({
    user_id: userId,
    event,
    meta: JSON.stringify(meta),
    created_at: new Date(),
  });
}

export async function getUserProgress(tgId) {
  const { user } = await getOrCreateUser(tgId, '');
  const progress = await UserProgress.findOne({ where: { user_id: user.id } });
  if (!progress) return { score: 0, questions_answered: 0 };
  return {
    score: progress.current_score || 0,
    questions_answered: progress.questions_answered || 0,
  };
}

export async function saveBonusCoupon(tgId, username, couponCode) {
  const { user } = await getOrCreateUser(tgId, username);
  return PromoCode.create({
    user_id: user.id,
    code: couponCode,
    source: 'bonus_quiz',
    created_at: new Date(),
  });
}

export async function getUserCoupons(tgId) {
  const { user } = await getOrCreateUser(tgId, '');
  const coupons = await PromoCode.findAll({
    where: { user_id: user.id },
    order: [['created_at', 'DESC']],
  });
  return coupons.map((row) => ({
    code: row.code,
    source: row.source,
    created_at: row.created_at,
  }));
}

export async function getLatestCoupon(tgId, username = '') {
  const { user } = await getOrCreateUser(tgId, username);
  const coupon = await PromoCode.findOne({
    where: { user_id: user.id },
    order: [['created_at', 'DESC']],
  });

  if (!coupon) return null;

  const claim = await CouponClaim.findOne({ where: { code: coupon.code } });

  return {
    code: coupon.code,
    issuedAt: coupon.created_at,
    status: claim ? 'Завершен' : 'Активный',
    username: username || user.username || '',
  };
}

export async function claimCoupon(tgId, code) {
  const { user } = await getOrCreateUser(tgId, '');
  const coupon = await PromoCode.findOne({
    where: { user_id: user.id, code },
  });

  if (!coupon) return { ok: false, reason: 'not_found' };

  await CouponClaim.findOrCreate({
    where: { code },
    defaults: { user_id: user.id, claimed_at: new Date() },
  });

  return { ok: true, status: 'Завершен' };
}

export async function subscribeToAllEvents(tgId, username) {
  const { user } = await getOrCreateUser(tgId, username);
  const [subscription, created] = await UserEventSubscription.findOrCreate({
    where: { user_id: user.id },
    defaults: {
      subscribed_at: new Date(),
      is_subscribed: 1,
    },
  });

  if (!created && subscription.is_subscribed === 0) {
    await subscription.update({
      subscribed_at: new Date(),
      unsubscribed_at: null,
      is_subscribed: 1,
    });
  }

  return { subscription, created };
}

export async function unsubscribeFromAllEvents(tgId) {
  const { user } = await getOrCreateUser(tgId, '');
  const subscription = await UserEventSubscription.findOne({
    where: { user_id: user.id, is_subscribed: 1 },
  });

  if (subscription) {
    await subscription.update({
      unsubscribed_at: new Date(),
      is_subscribed: 0,
    });
    return true;
  }

  return false;
}

export async function isSubscribedToEvents(tgId) {
  const { user } = await getOrCreateUser(tgId, '');
  const subscription = await UserEventSubscription.findOne({
    where: { user_id: user.id, is_subscribed: 1 },
  });
  return !!subscription;
}

export async function getSubscriptionDate(tgId) {
  const { user } = await getOrCreateUser(tgId, '');
  const subscription = await UserEventSubscription.findOne({
    where: { user_id: user.id, is_subscribed: 1 },
  });
  return subscription ? subscription.subscribed_at : null;
}

export async function getEventSubscribers() {
  const subscriptions = await UserEventSubscription.findAll({
    where: { is_subscribed: 1 },
    include: [{ model: User, as: 'user' }],
  });

  return subscriptions
    .filter((row) => row.user)
    .map((row) => ({
      tg_id: row.user.tg_id,
      subscribed_at: row.subscribed_at,
      user_id: row.user_id,
    }));
}

export async function saveFeedback(tgId, data) {
  let userId = null;
  if (tgId) {
    try {
      const { user } = await getOrCreateUser(tgId, data.name || '');
      userId = user.id;
    } catch {
      userId = null;
    }
  }

  return Feedback.create({
    user_id: userId,
    name: data.name || null,
    email: data.email || null,
    visit_date: data.date || null,
    feedback_text: data.feedback || null,
    created_at: new Date(),
  });
}

export async function getUserProfile(tgId, username = '') {
  const { user } = await getOrCreateUser(tgId, username);
  const progress = await UserProgress.findOne({ where: { user_id: user.id } });
  const rank = await computeRank(user.id);
  const subscription = await UserEventSubscription.findOne({
    where: { user_id: user.id, is_subscribed: 1 },
  });
  const couponsCount = await PromoCode.count({ where: { user_id: user.id } });

  return {
    id: user.tg_id,
    name: username || user.username || 'Гость',
    memberSince: user.created_at,
    subscribed: !!subscription,
    subscriptionLabel: subscription ? 'Все события ЦК19' : '—',
    score: progress ? progress.current_score || 0 : 0,
    rank,
    couponsCount,
  };
}

export async function getUserConsent(tgId) {
  return hasPrivacyConsent(tgId);
}
