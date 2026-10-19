#!/usr/bin/env node
/**
 * Service Worker の自動更新（registerType: 'autoUpdate'）の e2e。
 *
 * `pnpm build` 済みの dist を 2 つに複製し、それぞれ index.html の
 * title に別の目印を入れて、sw.js の precache revision も新しい index.html の
 * md5 に合わせて書き換える（sw.js が同一のままだと更新と判定されない）。
 * 自前の静的サーバーで配信先を old → new に差し替え、old の SW が入った
 * ページをリロード（開き直し）したときに、新 SW が skipWaiting + clientsClaim で
 * 自動的に有効になり、新しい index.html が表示されることを確認する。
 *
 * vitest / Storybook とは別系統（`pnpm e2e:update`）。`pnpm e2e` からも走る。
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const PORT = process.env.UPDATE_E2E_PORT ?? '4175';
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SW_TIMEOUT_MS = 60_000;
const UPDATE_TIMEOUT_MS = 30_000;
const FALLBACK_UPDATE_TIMEOUT_MS = 60_000;

const log = (step, message) => {
  console.log(`[e2e-update] ${step}: ${message}`);
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

const buildTitle = (marker) => `Go Tour Pocket [e2e ${marker}]`;

/**
 * index.html の title を目印に差し替え、sw.js の precache にある index.html の
 * revision を新しい内容の md5 に書き換える。dist 本体は触らず、複製に対して行う。
 */
const patchBuild = async (directory, marker) => {
  const indexPath = join(directory, 'index.html');
  const swPath = join(directory, 'sw.js');

  const originalIndex = await readFile(indexPath, 'utf8');
  const indexHtml = originalIndex.replace(
    /<title>[^<]*<\/title>/,
    `<title>${buildTitle(marker)}</title>`,
  );
  if (indexHtml === originalIndex) {
    throw new Error(`${indexPath} の <title> を置き換えられなかった`);
  }

  const originalSw = await readFile(swPath, 'utf8');
  const revision = createHash('md5').update(indexHtml).digest('hex');
  const swJs = originalSw.replace(
    /(url:"index\.html",revision:)"[^"]*"/,
    (_match, prefix) => `${prefix}"${revision}"`,
  );
  if (swJs === originalSw) {
    throw new Error(`${swPath} の index.html の revision を書き換えられなかった`);
  }

  await writeFile(indexPath, indexHtml);
  await writeFile(swPath, swJs);
  return buildTitle(marker);
};

/**
 * 配信するディレクトリを getDirectory() で切り替えられる静的サーバー。
 * ファイルがなければ index.html を返す（SPA のクライアント遷移用）。
 */
const startStaticServer = (getDirectory) => {
  const server = createServer((request, response) => {
    void (async () => {
      const directory = getDirectory();
      try {
        const pathname = decodeURIComponent(
          new URL(request.url ?? '/', 'http://127.0.0.1').pathname,
        );
        let filePath = normalize(join(directory, pathname));
        if (!filePath.startsWith(directory)) {
          response.writeHead(403);
          response.end();
          return;
        }
        if (existsSync(filePath) && statSync(filePath).isDirectory()) {
          filePath = join(filePath, 'index.html');
        }
        if (!existsSync(filePath)) {
          filePath = join(directory, 'index.html');
        }
        const body = await readFile(filePath);
        response.writeHead(200, {
          'content-type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
          // SW の更新確認で古い sw.js を掴まないようにする
          'cache-control': 'no-store',
        });
        response.end(body);
      } catch (error) {
        console.error('[e2e-update] server error:', error);
        response.writeHead(500);
        response.end('internal server error');
      }
    })();
  });
  return server;
};

/** 自動リロード中は execution context が切れることがあるので、失敗は無視して poll する。 */
const waitForTitle = async (page, expected, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    let title = null;
    try {
      title = await page.title();
    } catch {
      // リロードの途中。次の周回で確認する
    }
    if (title === expected) return;
    if (Date.now() > deadline) {
      throw new Error(`title "${expected}" にならなかった（現在: ${title ?? 'unknown'}）`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
};

/** 自動リロードと競合して reload が中断されることがあるので、失敗は無視する。 */
const reloadIgnoringInterruption = async (page) => {
  try {
    await page.reload({ waitUntil: 'load', timeout: UPDATE_TIMEOUT_MS });
  } catch {
    // 自動リロードが先に走った。waitForTitle 側で確認する
  }
};

const main = async () => {
  if (!existsSync('dist/index.html')) {
    throw new Error('dist がありません。先に `pnpm build` を実行してください');
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'go-tour-e2e-update-'));
  const oldDir = join(tempDir, 'old');
  const newDir = join(tempDir, 'new');
  await cp('dist', oldDir, { recursive: true });
  await cp('dist', newDir, { recursive: true });
  const oldTitle = await patchBuild(oldDir, 'old');
  const newTitle = await patchBuild(newDir, 'new');

  let currentDirectory = oldDir;
  const server = startStaticServer(() => currentDirectory);
  await new Promise((resolve) => server.listen(Number(PORT), '127.0.0.1', resolve));
  log('server', `${BASE_URL} is ready`);

  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors = [];
    const watchPage = (target) => {
      target.on('pageerror', (error) => pageErrors.push(error.message));
      target.on('console', (message) => {
        if (message.type() === 'error')
          console.error('[e2e-update] console.error:', message.text());
      });
    };
    watchPage(page);

    // 1. 旧ビルドを配信し、SW に制御させる
    await page.goto(BASE_URL, { waitUntil: 'load' });
    await page.getByRole('heading', { level: 1, name: 'Go Tour Pocket' }).waitFor();
    assert.equal(await page.title(), oldTitle, '旧ビルドの目印が表示されていない');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
      timeout: SW_TIMEOUT_MS,
    });
    log('sw', '旧ビルドの Service Worker がページを制御した');

    // 2. 配信先を新ビルド（index.html の title が違う）に差し替える
    currentDirectory = newDir;
    log('swap', '配信先を新ビルドに差し替えた');

    // 3. 開き直し（リロード）。旧 SW が旧 index.html を返したあと、ブラウザの
    //    更新確認で新 SW が skipWaiting + clientsClaim で有効になり、
    //    autoUpdate の registerSW がページを自動リロードする。
    await reloadIgnoringInterruption(page);
    try {
      await waitForTitle(page, newTitle, UPDATE_TIMEOUT_MS);
      log('update', 'リロード後に自動的に新ビルドへ切り替わった');
    } catch {
      // ブラウザの更新確認が throttle された環境向けの保険。アプリが表示復帰時・
      // 1 時間ごとに呼ぶのと同じ registration.update() をここから起こす。
      log('update', 'リロードだけでは切り替わらなかったので registration.update() を呼ぶ');
      try {
        await page.evaluate(() =>
          navigator.serviceWorker.getRegistration().then((registration) => registration?.update()),
        );
      } catch {
        // すでに自動リロードが始まっていた場合は無視してよい
      }
      await waitForTitle(page, newTitle, FALLBACK_UPDATE_TIMEOUT_MS);
      log('update', 'registration.update() から自動的に新ビルドへ切り替わった');
    }

    // 4. 新しい SW の制御下で開き直しても新ビルドのまま
    await page.close();
    const reopened = await context.newPage();
    watchPage(reopened);
    await reopened.goto(BASE_URL, { waitUntil: 'load' });
    await reopened.getByRole('heading', { level: 1, name: 'Go Tour Pocket' }).waitFor();
    assert.equal(await reopened.title(), newTitle, '開き直したら旧ビルドに戻った');
    log('reopen', '開き直しても新ビルドのまま');

    assert.deepEqual(pageErrors, [], `pageerror が発生した: ${pageErrors.join(' / ')}`);
    log('done', 'すべての確認に成功した');
  } catch (error) {
    console.error('[e2e-update] FAILED:', error);
    process.exitCode = 1;
  } finally {
    await browser?.close();
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    await rm(tempDir, { recursive: true, force: true });
  }
};

await main();
