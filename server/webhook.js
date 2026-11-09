import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { broadcastPost, extractPostContent, sendWelcome, MAX_CHANNEL_ID } from './max-api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env'), override: false });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), override: false });
dotenv.config({ path: path.join(__dirname, '..', '..', 'max_bot', '.env'), override: false });

export const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

const processedPosts = new Set();
const MAX_PROCESSED = 1000;

function getUserIdFromUpdate(update) {
  const user =
    update.user ||
    update.message?.sender ||
    update.callback?.user ||
    update.bot_started?.user ||
    {};
  return user.user_id || user.id;
}

function rememberPost(messageId) {
  if (processedPosts.has(messageId)) return false;
  processedPosts.add(messageId);
  if (processedPosts.size > MAX_PROCESSED) {
    const items = [...processedPosts];
    items.slice(0, 500).forEach((id) => processedPosts.delete(id));
  }
  return true;
}

async function handleChannelPost(update) {
  const { chat_id, message } = update;

  if (!message) return { ok: true, skipped: 'no_message' };

  const messageId = message.body?.mid || message.message_id || Date.now();
  if (!rememberPost(messageId)) {
    return { ok: true, skipped: 'duplicate' };
  }

  console.log(`📮 Новый пост в канале ${chat_id}: ${messageId}`);

  const postContent = extractPostContent(message);
  if (!postContent.text && !postContent.hasMedia) {
    return { ok: true, skipped: 'empty' };
  }

  const result = await broadcastPost(postContent);
  return { ok: true, broadcast: result };
}

async function handleDialogMessage(update) {
  const message = update.message || {};
  const text = (message.body?.text || '').trim();
  const userId = getUserIdFromUpdate(update);

  if (!userId) return { ok: true, skipped: 'no_user' };

  if (text === '/start') {
    await sendWelcome(userId);
    return { ok: true, action: 'welcome' };
  }

  await sendWelcome(userId);
  return { ok: true, action: 'hint' };
}

export async function routeUpdate(update) {
  const { update_type, message, chat_id } = update;

  if (update_type === 'bot_started') {
    console.log('🚀 Событие: bot_started');
    const userId = getUserIdFromUpdate(update);
    if (userId) await sendWelcome(userId);
    return { ok: true, action: 'bot_started' };
  }

  if (update_type === 'message_created') {
    const chatType = message?.recipient?.chat_type;

    if (chatType === 'dialog') {
      console.log('💬 Личное сообщение');
      return handleDialogMessage(update);
    }

    if (chat_id === MAX_CHANNEL_ID || chatType === 'channel') {
      console.log('📢 Пост из канала');
      return handleChannelPost(update);
    }

    return { ok: true, skipped: 'unknown_chat' };
  }

  if (update_type === 'message_callback') {
    // Мини-приложение обрабатывает кнопки на клиенте.
    return { ok: true, skipped: 'callback' };
  }

  return { ok: true, skipped: 'unknown_update' };
}
