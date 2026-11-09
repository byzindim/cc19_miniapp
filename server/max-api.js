import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEventSubscribers } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env'), override: false });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), override: false });
dotenv.config({ path: path.join(__dirname, '..', '..', 'max_bot', '.env'), override: false });

const MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN;
const MAX_ADMIN_ID = process.env.MAX_ADMIN_ID ? Number(process.env.MAX_ADMIN_ID) : null;
const MINIAPP_URL = process.env.MINIAPP_URL || 'https://cc19.ru';

export const MAX_CHANNEL_ID = process.env.MAX_CHANNEL_ID
  ? Number(process.env.MAX_CHANNEL_ID)
  : -69548267582878;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendMessage(userId, text, attachments = []) {
  if (!MAX_BOT_TOKEN) {
    throw new Error('MAX_BOT_TOKEN не задан');
  }

  const url = `https://platform-api.max.ru/messages?user_id=${encodeURIComponent(userId)}`;
  const body = {
    text,
    format: 'html',
    notify: true,
  };

  if (attachments && attachments.length > 0) {
    body.attachments = attachments;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: MAX_BOT_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}

async function sendMessageToChat(chatId, text) {
  if (!MAX_BOT_TOKEN) {
    throw new Error('MAX_BOT_TOKEN не задан');
  }

  const url = `https://platform-api.max.ru/messages?chat_id=${encodeURIComponent(chatId)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: MAX_BOT_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      format: 'html',
      notify: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}

export async function sendToAdmin(text) {
  if (!MAX_ADMIN_ID) {
    console.warn('⚠️ MAX_ADMIN_ID не задан — отзыв сохранён только в БД.');
    return false;
  }

  try {
    await sendMessage(MAX_ADMIN_ID, text);
    return true;
  } catch (firstError) {
    try {
      await sendMessageToChat(MAX_ADMIN_ID, text);
      return true;
    } catch (secondError) {
      console.error(
        '❌ Не удалось отправить отзыв администратору:',
        firstError.message,
        secondError.message
      );
      return false;
    }
  }
}

export async function sendWelcome(userId) {
  const text = [
    '👋 Добро пожаловать в ЦК19!',
    '',
    'Это цифровой гид по выставкам и событиям Центра.',
    `Откройте мини-приложение: ${MINIAPP_URL}`,
  ].join('\n');

  return sendMessage(userId, text);
}

export function extractPostContent(message) {
  let text = message.body?.text || message.text || '';
  const attachments = message.body?.attachments || message.attachments || [];

  const linkAttachments = attachments.filter((item) => item.type === 'link');
  const mediaAttachments = attachments.filter((item) =>
    ['photo', 'video', 'audio', 'document', 'sticker'].includes(item.type)
  );

  let linkUrl = null;
  let linkTitle = 'Подробнее о проекте';

  if (linkAttachments.length > 0) {
    const link = linkAttachments[0];
    linkUrl = link.url || link.link?.url || link.action?.url;
    linkTitle = link.title || link.link?.title || link.text || 'Подробнее о проекте';

    text = text.replace(/\n?\n?Подробнее о проекте/g, '').trim();
  }

  return {
    text,
    attachments: mediaAttachments,
    linkUrl,
    linkTitle,
    hasMedia: mediaAttachments.length > 0,
    format: message.body?.format || message.format || 'html',
  };
}

async function sendPostToUser(userId, postContent) {
  const { text, attachments, linkUrl, format } = postContent;

  let fullText = text;
  if (linkUrl) {
    fullText = fullText + '\n\n' + linkUrl;
  }

  if (!attachments || attachments.length === 0) {
    fullText = '🆕 <b>Новое событие в ЦК19!</b>\n\n' + fullText;
  }

  const url = `https://platform-api.max.ru/messages?user_id=${encodeURIComponent(userId)}`;
  const body = {
    text: fullText,
    format: format || 'html',
    notify: true,
  };

  if (attachments && attachments.length > 0) {
    body.attachments = attachments;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: MAX_BOT_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}

export async function broadcastPost(postContent) {
  let subscribers = [];
  try {
    subscribers = await getEventSubscribers();
  } catch (error) {
    console.error('❌ Ошибка получения подписчиков:', error.message);
    return { sent: 0, errors: 0, total: 0 };
  }

  if (subscribers.length === 0) {
    return { sent: 0, errors: 0, total: 0 };
  }

  let sent = 0;
  let errors = 0;

  for (const subscriber of subscribers) {
    try {
      await sendPostToUser(subscriber.tg_id, postContent);
      sent += 1;
      await sleep(50);
    } catch (error) {
      errors += 1;
      console.error(`❌ Ошибка отправки ${subscriber.tg_id}:`, error.message);
    }
  }

  console.log(`🎉 Рассылка завершена: ${sent} успешно, ${errors} ошибок`);
  return { sent, errors, total: subscribers.length };
}
