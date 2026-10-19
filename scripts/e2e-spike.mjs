#!/usr/bin/env node
/**
 * /spike のスモークテスト。
 *
 * `pnpm build` 済みの dist を vite preview で配信し、Playwright（chromium）で
 * hello / select / 画像プリセットの実行、無限ループの停止、Service Worker 登録後の
 * オフラインリロードでの再実行を確認する。vitest とは別系統（`pnpm e2e:spike`）。
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = process.env.SPIKE_E2E_PORT ?? '4173';
const BASE_URL = `http://127.0.0.1:${PORT}`;
const RUN_TIMEOUT_MS = 120_000;

const log = (step, message) => {
  console.log(`[e2e-spike] ${step}: ${message}`);
};

const waitForServer = async (url, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // サーバー起動待ち
    }
    if (Date.now() > deadline) throw new Error(`preview server did not start: ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
};

const waitForEnabled = async (locator, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await locator.isEnabled()) return;
    if (Date.now() > deadline) throw new Error('button did not become enabled');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
};

const runPreset = async (page, presetName, expectedText) => {
  await page.getByRole('button', { name: presetName, exact: true }).click();
  await page.getByRole('button', { name: '実行', exact: true }).click();
  await page
    .getByTestId('run-status')
    .first()
    .waitFor({ state: 'visible', timeout: RUN_TIMEOUT_MS });
  const status = await page.getByTestId('run-status').first().textContent();
  if (!status?.startsWith('終了')) throw new Error(`${presetName}: unexpected status: ${status}`);
  await waitForEnabled(page.getByRole('button', { name: '実行', exact: true }), 30_000);
  await page.getByTestId('go-output').getByText(expectedText).first().waitFor({
    state: 'visible',
    timeout: RUN_TIMEOUT_MS,
  });
  log('run', `${presetName} -> ${expectedText}`);
};

const main = async () => {
  const server = spawn(
    'pnpm',
    ['exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', PORT, '--strictPort'],
    { stdio: ['ignore', 'pipe', 'pipe'], env: process.env },
  );
  let serverLog = '';
  server.stdout.on('data', (chunk) => {
    serverLog += chunk;
  });
  server.stderr.on('data', (chunk) => {
    serverLog += chunk;
  });

  let browser;
  try {
    await waitForServer(BASE_URL, 30_000);
    log('server', `${BASE_URL} is ready`);

    browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', (error) => console.error('[e2e-spike] pageerror:', error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') console.error('[e2e-spike] console.error:', message.text());
    });

    await page.goto(`${BASE_URL}/spike`, { waitUntil: 'load' });

    // 1. hello
    await runPreset(page, 'Hello, 世界', 'Hello, 世界');

    // 2. Tour の concurrency/select.go
    await runPreset(page, 'select（Tour）', 'quit');

    // 3. 画像プリセット（pic.ShowImage の IMAGE: 行）
    await page.getByRole('button', { name: '画像（Tour）', exact: true }).click();
    await waitForEnabled(page.getByRole('button', { name: '実行', exact: true }), 30_000);
    await page.getByRole('button', { name: '実行', exact: true }).click();
    await page
      .getByTestId('run-status')
      .first()
      .waitFor({ state: 'visible', timeout: RUN_TIMEOUT_MS });
    const image = page.getByTestId('go-image').first();
    await image.waitFor({ state: 'visible', timeout: RUN_TIMEOUT_MS });
    const imageSrc = await image.getAttribute('src');
    if (!imageSrc?.startsWith('data:image/png;base64,')) {
      throw new Error(`image preset: unexpected src: ${imageSrc?.slice(0, 40)}`);
    }
    const imageWidth = await image.evaluate((element) => element.naturalWidth);
    if (imageWidth !== 256) throw new Error(`image preset: unexpected width: ${imageWidth}`);
    log('run', `画像（Tour） -> png ${imageWidth}px`);

    // 4. 無限ループを停止ボタンで止める
    await page.getByRole('button', { name: '無限ループ', exact: true }).click();
    await waitForEnabled(page.getByRole('button', { name: '実行', exact: true }), 30_000);
    await page.getByRole('button', { name: '実行', exact: true }).click();
    await page.getByTestId('go-output').getByText('running 0').first().waitFor({
      state: 'visible',
      timeout: RUN_TIMEOUT_MS,
    });
    await page.getByRole('button', { name: '停止', exact: true }).click();
    await page
      .getByTestId('run-status')
      .filter({ hasText: '実行を停止しました' })
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 });
    await waitForEnabled(page.getByRole('button', { name: '実行', exact: true }), 30_000);
    log('stop', '無限ループを停止できた');

    // 5. Service Worker 登録 → オフラインでリロード → hello 実行
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    // registerType: 'autoUpdate' は skipWaiting + clientsClaim なので、
    // 初回インストールでもリロードなしにこのページが SW の制御下に入る。
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
      timeout: 60_000,
    });
    log('sw', 'Service Worker がページを制御した');
    await context.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    await runPreset(page, 'Hello, 世界', 'Hello, 世界');
    await context.setOffline(false);
    log('offline', 'オフラインリロード後も hello を実行できた');

    log('done', 'すべての確認に成功した');
  } catch (error) {
    console.error('[e2e-spike] FAILED:', error);
    if (serverLog.length > 0) console.error('[e2e-spike] server output:\n', serverLog);
    process.exitCode = 1;
  } finally {
    await browser?.close();
    server.kill('SIGTERM');
  }
};

await main();
