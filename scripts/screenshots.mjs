// Screenshot harness: loads the content script at document start (like Firefox does)
// into real YouTube via headless Chrome. Usage: node shoot.mjs <extDir> <outDir> [icons|yt|all]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const [extDir, outDir, which = 'all'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const css = fs.readFileSync(path.join(extDir, 'calm.css'), 'utf8');
const js = fs.readFileSync(path.join(extDir, 'content.js'), 'utf8');
const iconSvg = fs.readFileSync(path.join(extDir, 'icons/icon.svg'), 'utf8');

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--lang=en-US', '--hide-scrollbars'],
});

async function icons() {
  const page = await browser.newPage();
  await page.setViewport({ width: 720, height: 320, deviceScaleFactor: 2 });
  const uri = 'data:image/svg+xml,' + encodeURIComponent(iconSvg);
  const row = (bg, fg) => `
    <div style="background:${bg};color:${fg};display:flex;gap:28px;align-items:end;padding:22px 28px">
      ${[16, 24, 32, 48, 96].map((s) => `<div style="text-align:center;font:11px system-ui"><img src="${uri}" width="${s}" height="${s}"><br>${s}</div>`).join('')}
      <div style="display:flex;align-items:center;gap:8px;background:${bg === '#fff' ? '#f0f0f4' : '#2b2a33'};padding:8px 12px;border-radius:8px;font:13px system-ui">
        <img src="${uri}" width="16" height="16">YouTube</div>
    </div>`;
  await page.setContent(`<body style="margin:0">${row('#fff', '#333')}${row('#1c1b22', '#ddd')}</body>`);
  await page.screenshot({ path: path.join(outDir, 'icon-preview.png') });

  for (const s of [48, 96, 128]) {
    await page.setViewport({ width: s, height: s, deviceScaleFactor: 1 });
    await page.setContent(`<body style="margin:0;background:transparent"><img src="${uri}" width="${s}" height="${s}" style="display:block"></body>`);
    await page.screenshot({ path: path.join(outDir, `icon-${s}.png`), omitBackground: true });
  }
  await page.close();
}

async function yt(name, { scheme = 'dark', enabled = true, setup } = {}) {
  const page = await browser.newPage();
  await page.setBypassCSP(true);
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await page.setViewport({ width: 1280, height: 760, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument(
    `if (location.hostname === 'www.youtube.com') {
      localStorage.setItem('calmyt:enabled', ${JSON.stringify(enabled ? '1' : '0')});
      const __run = () => {
        const style = document.createElement('style');
        style.textContent = ${JSON.stringify(css)};
        document.documentElement.append(style);
        ${js}
      };
      if (document.documentElement) __run();
      else new MutationObserver((m, o) => {
        if (document.documentElement) { o.disconnect(); __run(); }
      }).observe(document, { childList: true });
    }`
  );
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto('https://www.youtube.com/', { waitUntil: 'networkidle2', timeout: 60000 });
  // Dismiss a consent interstitial if one shows up (decline non-essential).
  const reject = await page.$('button[aria-label^="Reject"]');
  if (reject) {
    await reject.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
  }
  await new Promise((r) => setTimeout(r, 1200));
  if (setup) await setup(page);
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  const report = await page.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-calmyt'),
    dark: document.documentElement.hasAttribute('dark'),
    favicon: [...document.querySelectorAll('link[rel~=icon]')].map((l) => l.href.slice(0, 30)),
    active: document.activeElement?.id,
  }));
  console.log(name, JSON.stringify(report));
  await page.close();
}

if (which === 'icons' || which === 'all') await icons();
if (which === 'yt' || which === 'all') {
  await yt('calm-dark');
  await yt('calm-light', { scheme: 'light', setup: (p) => p.mouse.click(40, 700) });
  await yt('calm-typing', {
    scheme: 'dark',
    setup: async (p) => {
      await p.mouse.click(40, 700);
      await p.keyboard.type('slow mornings jazz', { delay: 30 });
    },
  });
  await yt('feed-with-toggle', { scheme: 'dark', enabled: false });
}
await browser.close();
