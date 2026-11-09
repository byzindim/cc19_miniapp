// Проверка РЕАЛЬНЫХ кликов мышью: никаких заглушек window.open.
// Фиксируем фактические новые вкладки через CDP-события Target.targetCreated.
import WebSocket from 'ws';

const APP = 'http://127.0.0.1:3111/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connect(url) {
  const ws = new WebSocket(url, { perMessageDeflate: false });
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function makeRpc(ws) {
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(JSON.stringify(m.error)));
      else resolve(m.result);
      return;
    }
    events.push(m);
  });
  const send = (method, params = {}) => {
    id += 1;
    const mid = id;
    return new Promise((resolve, reject) => {
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  };
  return { send, events };
}

const version = await fetch('http://127.0.0.1:9222/json/version').then((r) => r.json());
const list = await fetch('http://127.0.0.1:9222/json/list').then((r) => r.json());
const pageTarget = list.find((t) => t.type === 'page');

const browser = makeRpc(await connect(version.webSocketDebuggerUrl));
const page = makeRpc(await connect(pageTarget.webSocketDebuggerUrl));

// Следим за новыми вкладками на уровне браузера.
await browser.send('Target.setDiscoverTargets', { discover: true });
const newTabs = [];
browser.events
  .filter((m) => m.method === 'Target.targetCreated')
  .forEach((m) => newTabs.push(m.params.targetInfo.url));

const drainTabs = () => {
  const found = newTabs.filter((u) => u !== 'about:blank');
  newTabs.length = 0;
  return found;
};

const ev = async (expression) => {
  const r = await page.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || 'ev fail');
  }
  return r.result.value;
};

await page.send('Page.enable');
await page.send('Runtime.enable');
await page.send('Emulation.setDeviceMetricsOverride', {
  width: 430,
  height: 932,
  deviceScaleFactor: 1,
  mobile: true,
});

await page.send('Page.navigate', { url: APP });
await sleep(2500);

// Ключевая предпроверка: мост действительно недоступен, заглушек нет.
const env = await ev(`(() => ({
  webAppLoaded: typeof window.WebApp === 'object' && window.WebApp !== null,
  openLinkFn: typeof (window.WebApp || {}).openLink,
  bridgeActive: App.bridgeActive(),
  openLinkNative: window.open.toString().includes('[native code]') ||
    !window.open.toString().includes('__opened'),
  initDataUnsafe: JSON.stringify((window.WebApp || {}).initDataUnsafe || {}),
}))()`);
console.log('ENV: ' + JSON.stringify(env));

// Настоящий клик мышью по координатам элемента.
async function realClick(selector, screen) {
  await ev(`App.goTo(${JSON.stringify(screen)}, { force: true })`);
  await sleep(900);
  const box = await ev(`(() => {
    const el = document.querySelector('[data-screen=${JSON.stringify(screen)}] ${selector}');
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  })()`);
  if (!box) return { ok: false, reason: 'element not found' };

  drainTabs();
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: box.x,
    y: box.y,
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: box.x,
    y: box.y,
    button: 'left',
    clickCount: 1,
  });
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: box.x,
    y: box.y,
    button: 'left',
    clickCount: 1,
  });
  await sleep(1600);
  const opened = drainTabs();
  return { ok: true, tabs: opened };
}

const CASES = [
  ['Меню: Афиша', 'main', '[data-link-key="AFISHA"]', 'https://cc19.ru/'],
  ['О центре: Telegram', 'center', '.contact-tile[data-link-key="TELEGRAM"]', 'https://t.me/cc19art'],
  ['О центре: ВКонтакте', 'center', '.contact-tile[data-link-key="VK"]', 'https://vk.com/centreforculture19'],
  ['О центре: Макс-канал', 'center', '[data-link-key="MAX_CHANNEL"]', 'https://max.ru/id5406448280_gos'],
  ['О центре: Сайт', 'center', '[data-link-key="SITE"]', 'https://cc19.ru'],
  ['О центре: Схема проезда', 'center', '.address-card', 'yandex.ru/maps'],
  ['Контакты: Telegram', 'contacts', '.contact-tile[data-link-key="TELEGRAM"]', 'https://t.me/cc19art'],
  ['Контакты: ВКонтакте', 'contacts', '.contact-tile[data-link-key="VK"]', 'https://vk.com/centreforculture19'],
  ['Онбординг: Согласие', 'onboarding', '[data-link-key="CONSENT"]', 'cc19.ru/'],
  ['Онбординг: Политика', 'onboarding', '[data-link-key="POLICY"]', 'cc19.ru/'],
  ['Викторина: старт игры', 'quiz', '[data-action="quiz:start"]', null],
  ['Бонус: карточкаLeaderboard', 'bonus', '.cta-card[data-nav="leaderboard"]', null],
];

const results = [];
for (const [label, screen, selector, expect] of CASES) {
  const r = await realClick(selector, screen);
  if (expect === null) {
    // Внутренний переход: проверяем смену экрана, вкладок быть не должно.
    const landed = await ev('document.querySelector(".screen.active")?.dataset.screen');
    const tabs = r.tabs || [];
    results.push({
      label,
      pass: r.ok && tabs.length === 0,
      detail: 'screen=' + landed + ', tabs=' + JSON.stringify(tabs),
    });
    continue;
  }
  const tabs = r.tabs || [];
  const match = tabs.find((u) => u.startsWith(expect) || u.includes(expect));
  results.push({
    label,
    pass: r.ok && !!match,
    detail: r.ok
      ? 'открыто вкладок=' + tabs.length + ' -> ' + JSON.stringify(tabs)
      : r.reason,
  });
}

console.log('\n=== РЕАЛЬНЫЕ КЛИКИ ===');
results.forEach((r) => console.log((r.pass ? 'PASS' : 'FAIL') + ' | ' + r.label + ' | ' + r.detail));

const fails = results.filter((r) => !r.pass).length;
console.log('\nИТОГО FAIL: ' + fails + ' из ' + results.length);

browser.send('Browser.close').catch(() => {});
process.exit(fails ? 1 : 0);
