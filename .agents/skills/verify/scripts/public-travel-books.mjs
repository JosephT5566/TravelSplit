import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preview } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const books = [
  { path: '/2026-shimanami', heading: /^瀨戶內\s*島波海道$/ },
  { path: '/2026-hokkaido-car', heading: /^北緯 45°\s*夏日公路$/ },
];

async function checkBook(browser, origin, evidence, { path, heading }) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
    serviceWorkers: 'block',
  });
  const blockedHosts = new Set();
  const pageErrors = [];
  const name = path.slice(1);

  try {
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      blockedHosts.add(url.host);
      return route.abort();
    });
    await context.routeWebSocket('**/*', (socket) => socket.close());

    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const response = await page.goto(origin + path);
    assert.equal(response?.status(), 200, path);

    const title = page.getByRole('heading', { level: 1, name: heading });
    await title.waitFor({ state: 'visible', timeout: 10_000 });
    await page.screenshot({ path: join(evidence, name + '.png') });
    await writeFile(join(evidence, name + '.aria.yml'), await page.locator('body').ariaSnapshot());
    assert.deepEqual(pageErrors, [], path + ' had uncaught browser errors');
    assert.equal(blockedHosts.has('auth.verify.invalid'), false, path + ' requested the auth proxy');
    assert.equal(blockedHosts.has('api.verify.invalid'), false, path + ' requested the expense API');
    console.log('PASS', path);
  } finally {
    await context.close();
    await writeFile(
      join(evidence, name + '.json'),
      JSON.stringify({ blockedHosts: [...blockedHosts], pageErrors }, null, 2) + '\n',
    );
  }
}

const evidence = await mkdtemp(join(tmpdir(), 'tripsplit-verify-'));
console.log('Evidence directory:', evidence);
const server = await preview({
  appType: 'mpa',
  configFile: false,
  build: { outDir: 'out' },
  preview: { host: '127.0.0.1', port: 0 },
});

try {
  const { port } = server.httpServer.address();
  const browser = await chromium.launch();
  try {
    for (const book of books) {
      await checkBook(browser, `http://127.0.0.1:${port}`, evidence, book);
    }
  } finally {
    await browser.close();
  }
} finally {
  await server.close();
}
