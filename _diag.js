// Диагностика: доходит ли клик до обработчика и что выполняется.
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
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(JSON.stringify(m.error)));
      else resolve(m.result);
    }
  });
  const send = (method, params = {}) => {
    id += 1;
    const mid = id;
    return new Promise((resolve, reject) => {
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  };
  return { send };
}

const version = await fetch('http://127.0.0.1:9222/json/version').then((r) => r.json());
const list = await fetch('http://127.0.0.1:9222/json/list').then((r) => r.json());
const page = makeRpc(await connect(list.find((t) => t.type === 'page').webSocketDebuggerUrl));
const browser = makeRpc(await connect(version.webSocketDebuggerUrl));

const ev = async (expression) => {
  const r = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'ev fail');
  return r.result.value;
};

await page.send('Page.enable');
await page.send('Runtime.enable');
await page.send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 1, mobile: true });
await page.send('Page.navigate', { url: APP });
await sleep(2500);

// Шпион: пишем каждый вызов openLink и каждое созданное <a>, не меняя логику.
await ev(`(() => {
  window.__trace = [];
  const realOpen = window.open.bind(window);
  window.open = function (u, t, f) {
    const res = realOpen(u, t, f);
    window.__trace.push({ via: 'window.open', url: String(u), returned: res ? 'WindowProxy' : 'null' });
    return res;
  };
  const realClick = HTMLElement.prototype.click;
  HTMLElement.prototype.click = function () {
    if (this.tagName === 'A') {
      window.__trace.push({ via: 'anchor.click', url: this.href, target: this.target });
    }
    return realClick.apply(this, arguments);
  };
  const origOpenLink = App.openLink.bind(App);
  App.openLink = function (u) {
    window.__trace.push({ via: 'App.openLink', url: String(u), bridge: App.bridgeActive() });
    return origOpenLink(u);
  };
})()`);

await ev(`App.goTo('main', { force: true })`);
await sleep(1000);

const box = await ev(`(() => {
  const el = document.querySelector('[data-screen="main"] [data-link-key="AFISHA"]');
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);

// Что реально под курсором в этих координатах?
const hit = await ev(`(() => {
  const el = document.elementFromPoint(${box.x}, ${box.y});
  const path = [];
  let cur = el;
  while (cur && path.length < 6) {
    path.push(cur.tagName + (cur.className && typeof cur.className === 'string' ? '.' + cur.className.split(' ')[0] : ''));
    cur = cur.parentElement;
  }
  return { topmost: path[0], path, isTileOrChild: !!(el && el.closest('[data-link-key="AFISHA"]')) };
})()`);
console.log('HIT TEST: ' + JSON.stringify(hit, null, 2));

await ev('window.__trace = []');
await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
await sleep(1500);

console.log('\nTRACE после реального клика мышью:');
console.log(JSON.stringify(await ev('window.__trace'), null, 2));

// Для сравнения: программный клик
await ev('window.__trace = []');
await ev(`document.querySelector('[data-screen="main"] [data-link-key="AFISHA"]').click()`);
await sleep(1200);
console.log('\nTRACE после el.click():');
console.log(JSON.stringify(await ev('window.__trace'), null, 2));

await browser.send('Browser.close').catch(() => {});
process.exit(0);
