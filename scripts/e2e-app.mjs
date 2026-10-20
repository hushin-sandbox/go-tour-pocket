#!/usr/bin/env node
/**
 * アプリ全体の通し e2e。
 *
 * `pnpm build` 済みの dist を vite preview で配信し、Playwright（chromium の
 * iPhone 13 エミュレーションと 1280x800 のデスクトップ）で次を確認する。
 *
 *   1. 一覧 → basics/1 を開く → 対訳が出る → 表示モードを切り替える → 次へで 2 ページ目
 *   2. コードを実行して出力が出る。実 wasm で Ctrl + Enter の整形（gofmt 済みになる）と
 *      Shift + Enter の実行も確認する。basics/3 ではコードパターンのチップで原文の
 *      エラーを直し、3.14159 が出力される
 *   3. 一覧の「続きから」が最後に開いたページを指す。一覧下部の /licenses リンクが
 *      フルリロードなしで /licenses を開く
 *   4. Service Worker の制御下でオフラインにし、未読の concurrency/1 を開いて
 *      本文の表示・コード実行ができる（オフラインリロードも含む）
 *   5. オフラインで /licenses を、目次シートのリンク（クライアント遷移）と直接アクセスの
 *      両方から開ける。ライセンス本文は JS チャンクに埋め込まれていて、
 *      precache 対象外の licenses.json は取得しない
 *   6. デスクトップ幅（1280x800）では本文とコードが 2 カラムになり、コードは Header の
 *      下に貼り付いてスクロールしても見え続ける。Header の表示設定、コード実行、
 *      PageDown でのページ送りも確認する
 *
 * vitest / Storybook とは別系統（`pnpm e2e`）。`pnpm e2e:spike` は /spike 専用で残す。
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium, devices } from 'playwright';

const PORT = process.env.APP_E2E_PORT ?? '4174';
const BASE_URL = `http://127.0.0.1:${PORT}`;
const RUN_TIMEOUT_MS = 120_000;

/** インデントと空行を崩した Go のコード。gofmt で下の形に整形される。 */
const MANGLED_CODE = 'package main\nimport "fmt"\nfunc main(){fmt.Println("formatted")}';
const FORMATTED_CODE = 'package main\n\nimport "fmt"\n\nfunc main() { fmt.Println("formatted") }\n';

const log = (step, message) => {
  console.log(`[e2e-app] ${step}: ${message}`);
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

/** 画面中央に寄せてからマウスで押す。位置を決めてクリックすると安定する。 */
const clickCentered = async (page, locator) => {
  await locator.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  const box = await locator.boundingBox();
  if (box === null) throw new Error('element is not visible');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

/** レッスン画面のコード実行ボタンを押し、終了（またはエラー）まで待つ。 */
const runCode = async (page) => {
  const runButton = page.getByRole('button', { name: '実行', exact: true });
  await waitForEnabled(runButton, 60_000);
  await clickCentered(page, runButton);
  const output = page.getByRole('log');
  await output
    .getByText(/終了（\d+ ms）/)
    .first()
    .waitFor({ timeout: RUN_TIMEOUT_MS });
  await waitForEnabled(runButton, 30_000);
  return output;
};

/** Header 右端の「表示設定」を開く。 */
const openDisplaySettings = async (page) => {
  await page.getByRole('button', { name: '表示設定' }).click();
  const dialog = page.getByRole('dialog', { name: '表示設定' });
  await dialog.waitFor();
  return dialog;
};

/** 表示設定のシート／ダイアログを閉じる。 */
const closeDisplaySettings = async (page) => {
  const dialog = page.getByRole('dialog', { name: '表示設定' });
  await dialog.getByRole('button', { name: '表示設定を閉じる' }).click();
  await dialog.waitFor({ state: 'hidden' });
};

/** CodeMirror の本文を行単位で取り出す（textContent は改行を保たないため）。 */
const readEditorLines = (editor) =>
  editor.evaluate((element) =>
    Array.from(element.querySelectorAll('.cm-line'), (line) => line.textContent ?? ''),
  );

/** 末尾の空行（文書末の改行）は挿入経路で揺れるので無視して比べる。 */
const normalizeLines = (lines) => {
  const copy = [...lines];
  while (copy.length > 0 && copy.at(-1) === '') copy.pop();
  return copy;
};

/** エディタの本文が期待どおりの行になるまで待つ。 */
const waitForEditorLines = async (editor, expected, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const lines = await readEditorLines(editor);
    if (JSON.stringify(normalizeLines(lines)) === JSON.stringify(normalizeLines(expected))) {
      return;
    }
    if (Date.now() > deadline) {
      throw new Error(`エディタの本文が一致しない: ${JSON.stringify(lines)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

const main = async () => {
  if (!existsSync('dist/index.html')) {
    throw new Error('dist がありません。先に `pnpm build` を実行してください');
  }

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
    const context = await browser.newContext({
      ...devices['iPhone 13'],
      locale: 'ja-JP',
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') console.error('[e2e-app] console.error:', message.text());
    });

    // 1. 一覧から basics/1 を開く
    await page.goto(BASE_URL, { waitUntil: 'load' });
    await page.getByRole('heading', { level: 1, name: 'Go Tour Pocket' }).waitFor();
    await page.locator('summary').filter({ hasText: 'パッケージ、変数、関数' }).click();
    await page.locator('a[href="/tour/basics/1"]').first().click();
    await page.waitForURL('**/tour/basics/1');
    await page.getByRole('heading', { level: 1, name: 'パッケージ' }).waitFor();
    log('open', '一覧から /tour/basics/1 を開いた');

    // 対訳（英語 → 日本語）が出ている
    const englishParagraph = page.getByText('Every Go program is made up of packages.');
    const japaneseParagraph = page.getByText(
      'すべての Go プログラムはパッケージで構成されています。',
    );
    await englishParagraph.waitFor();
    assert.ok(await japaneseParagraph.isVisible(), '日本語訳が表示されていない');
    log('bilingual', '英語と日本語の対訳が表示された');

    // 表示モード: 英語のみ → 訳を開く → 日本語のみ → 対訳
    // （切り替えは Header 右端の「表示設定」メニューから行う）
    let settings = await openDisplaySettings(page);
    await settings.getByRole('button', { name: '英語のみ', exact: true }).click();
    await closeDisplaySettings(page);
    await japaneseParagraph.waitFor({ state: 'hidden' });
    assert.ok(await englishParagraph.isVisible(), '英語の本文が表示されていない');
    await page.getByRole('button', { name: '訳を表示' }).first().click();
    await japaneseParagraph.waitFor({ state: 'visible' });
    settings = await openDisplaySettings(page);
    await settings.getByRole('button', { name: '日本語のみ', exact: true }).click();
    await closeDisplaySettings(page);
    assert.ok(await japaneseParagraph.isVisible(), '日本語の本文が表示されていない');
    await englishParagraph.waitFor({ state: 'hidden' });
    settings = await openDisplaySettings(page);
    await settings.getByRole('button', { name: '対訳', exact: true }).click();
    await closeDisplaySettings(page);
    await englishParagraph.waitFor({ state: 'visible' });
    log(
      'display-mode',
      'Header の表示設定から 対訳 → 英語のみ → 訳を開く → 日本語のみ → 対訳 を切り替えられた',
    );

    // 前へ・次へには PageUp / PageDown のショートカットがあることを示す
    assert.equal(
      await page.getByRole('link', { name: /前へ/ }).getAttribute('aria-keyshortcuts'),
      'PageUp',
    );
    assert.equal(
      await page.getByRole('link', { name: /次へ/ }).getAttribute('aria-keyshortcuts'),
      'PageDown',
    );
    log('shortcut-hint', '前へ・次へに aria-keyshortcuts が付いている');

    // 次へで 2 ページ目
    await page.getByRole('link', { name: /次へ/ }).click();
    await page.waitForURL('**/tour/basics/2');
    await page.getByRole('heading', { level: 1, name: 'インポート' }).waitFor();
    log('next', '/tour/basics/2 へ進んだ');

    // 2. コード実行（imports.go）
    const output = await runCode(page);
    await output
      .getByText(/Now you have/)
      .first()
      .waitFor({ timeout: RUN_TIMEOUT_MS });
    log('run', 'basics/2 のコードが実行できた');

    // 2b. 実 wasm の整形（Ctrl + Enter）と、Shift + Enter のショートカット実行
    const editor = page.getByRole('textbox', { name: /imports.go のコード/ });
    await clickCentered(page, editor);
    await page.keyboard.press('Control+a');
    await page.keyboard.insertText(MANGLED_CODE);
    await waitForEditorLines(editor, MANGLED_CODE.split('\n'), 10_000);

    await page.keyboard.press('Control+Enter');
    await waitForEditorLines(editor, FORMATTED_CODE.split('\n'), 30_000);
    log('format', 'Ctrl + Enter で実 wasm の gofmt 整形ができた');

    await page.keyboard.press('Shift+Enter');
    const formatOutput = page.getByRole('log');
    await formatOutput.getByText('formatted').first().waitFor({ timeout: RUN_TIMEOUT_MS });
    await formatOutput
      .getByText(/終了（\d+ ms）/)
      .first()
      .waitFor({ timeout: RUN_TIMEOUT_MS });
    await waitForEnabled(page.getByRole('button', { name: '実行', exact: true }), 30_000);
    log('shortcut-run', 'Shift + Enter で編集したコードを実行できた');

    // 2c. コードパターンのチップ: 原文はエラー、math.Pi に直すと 3.14159 が出る
    await page.getByRole('link', { name: /次へ/ }).click();
    await page.waitForURL('**/tour/basics/3');
    await page.getByRole('heading', { level: 1, name: 'エクスポートされた名前' }).waitFor();

    const patternGroup = page.getByRole('group', { name: 'コードのパターン' });
    await patternGroup.waitFor();
    const originalChip = patternGroup.getByRole('button', { name: '原文' });
    const fixedChip = patternGroup.getByRole('button', { name: 'math.Pi に修正' });
    assert.equal(
      await originalChip.getAttribute('aria-pressed'),
      'true',
      '原文のコードなのに「原文」のチップが選択されていない',
    );

    const patternRunButton = page.getByRole('button', { name: '実行', exact: true });
    await waitForEnabled(patternRunButton, 60_000);
    await clickCentered(page, patternRunButton);
    const errorOutput = page.getByRole('log');
    await errorOutput
      .getByText(/エラー:/)
      .first()
      .waitFor({ timeout: RUN_TIMEOUT_MS });
    await waitForEnabled(patternRunButton, 30_000);
    log('pattern-original', 'basics/3 の原文はエラーになった');

    const patternEditor = page.getByRole('textbox', { name: /exported-names.go のコード/ });
    await clickCentered(page, fixedChip);
    await page.waitForFunction(
      (element) => element?.getAttribute('aria-pressed') === 'true',
      await fixedChip.elementHandle(),
      { timeout: 10_000 },
    );
    await page.waitForFunction(
      (element) => element?.textContent?.includes('math.Pi'),
      await patternEditor.elementHandle(),
      { timeout: 10_000 },
    );
    assert.equal(
      await originalChip.getAttribute('aria-pressed'),
      'false',
      'パターンに切り替えたのに「原文」のチップが選択されたまま',
    );
    log('pattern-switch', 'チップで「math.Pi に修正」に切り替えた');

    const patternOutput = await runCode(page);
    await patternOutput
      .getByText(/3\.14159/)
      .first()
      .waitFor({ timeout: RUN_TIMEOUT_MS });
    log('pattern-run', '修正したパターンで 3.14159 が出力された');

    // 「続きから」の確認は basics/2 を最後に開いた状態で行うので戻る
    await page.getByRole('link', { name: /前へ/ }).click();
    await page.waitForURL('**/tour/basics/2');
    await page.getByRole('heading', { level: 1, name: 'インポート' }).waitFor();

    // 3. 「続きから」が最後に開いたページ（basics/2）を指す
    await page.getByRole('link', { name: 'Go Tour Pocket' }).click();
    await page.waitForURL(BASE_URL + '/');

    // 一覧下部の /licenses がクライアント遷移になっている（フルリロードしない）。
    // フルリロードが起きると window のマーカーが消えるので、それで判定する。
    await page.evaluate(() => {
      window.e2eSpaMarker = true;
    });
    await page.getByRole('link', { name: 'ライセンス', exact: true }).click();
    await page.waitForURL('**/licenses');
    await page.getByRole('table', { name: 'ライセンスの要約' }).waitFor();
    assert.equal(
      await page.evaluate(() => window.e2eSpaMarker),
      true,
      '一覧下部の /licenses リンクでフルリロードが起きた',
    );
    log('licenses-link', '一覧下部から /licenses へクライアント遷移した');
    await page.goBack();
    await page.waitForURL(BASE_URL + '/');
    await page.getByRole('heading', { level: 1, name: 'Go Tour Pocket' }).waitFor();

    const continueSection = page.locator('section[aria-labelledby="continue-heading"]');
    await continueSection.waitFor();
    const continueText = await continueSection.innerText();
    assert.match(continueText, /インポート/, '「続きから」が最後のページを指していない');
    assert.match(continueText, /ページ 2 \/ 17/, '「続きから」のページ番号が違う');
    await continueSection.getByRole('link').click();
    await page.waitForURL('**/tour/basics/2');
    log('resume', '「続きから」が basics/2 を指していた');

    // 4. Service Worker を有効にしてオフラインへ
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    // registerType: 'autoUpdate' は skipWaiting + clientsClaim なので、
    // 初回インストールでもリロードなしにこのページが SW の制御下に入る。
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
      timeout: 60_000,
    });
    await page.getByRole('heading', { level: 1, name: 'インポート' }).waitFor();
    log('sw', 'Service Worker がページを制御した');

    await context.setOffline(true);
    await page.waitForFunction(() => !navigator.onLine);
    await page.getByRole('link', { name: 'Go Tour Pocket' }).click();
    await page.waitForURL(BASE_URL + '/');
    await page.getByRole('heading', { level: 1, name: 'Go Tour Pocket' }).waitFor();
    assert.ok(
      await page.locator('header').getByText('オフライン', { exact: true }).isVisible(),
      'オフライン表示がヘッダに出ていない',
    );
    log('offline', 'オフラインで一覧に戻れた');

    // まだ開いていない concurrency/1 を一覧から開く
    await page.locator('summary').filter({ hasText: '並行性' }).click();
    await page.locator('a[href="/tour/concurrency/1"]').first().click();
    await page.waitForURL('**/tour/concurrency/1');
    await page.getByRole('heading', { level: 1, name: 'ゴルーチン' }).waitFor();
    assert.ok(
      await page.getByText('Goroutines').first().isVisible(),
      '英語の見出しが表示されていない',
    );
    log('offline-lesson', '未読の concurrency/1 をオフラインで開けた');

    const offlineOutput = await runCode(page);
    await offlineOutput.getByText('hello').first().waitFor({ timeout: RUN_TIMEOUT_MS });
    log('offline-run', 'オフラインで concurrency/1 のコードが実行できた');

    // オフラインでリロードしても同じページが開ける
    await page.reload({ waitUntil: 'load' });
    await page.getByRole('heading', { level: 1, name: 'ゴルーチン' }).waitFor();
    log('offline-reload', 'オフラインでリロードしても表示できた');

    // 5. オフラインで /licenses。データは JS チャンクに埋め込まれているので、
    //    precache 対象外の licenses.json を取得しなくても表示できる。
    const licensesJsonRequests = [];
    page.on('request', (request) => {
      if (request.url().endsWith('/licenses.json')) licensesJsonRequests.push(request.url());
    });

    await page.getByRole('button', { name: '目次', exact: true }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'ライセンス' }).click();
    await page.waitForURL('**/licenses');
    await page.getByRole('table', { name: 'ライセンスの要約' }).waitFor();
    await page.getByRole('rowheader', { name: /A Tour of Go の本文/ }).waitFor();
    log('offline-licenses', 'オフラインで目次シートから /licenses を開けた（クライアント遷移）');

    await page.goto(`${BASE_URL}/licenses`, { waitUntil: 'load' });
    await page.getByRole('heading', { level: 1, name: 'ライセンス' }).waitFor();
    await page.getByRole('table', { name: 'ライセンスの要約' }).waitFor();
    await page.getByRole('rowheader', { name: /A Tour of Go の本文/ }).waitFor();
    log('offline-licenses-goto', 'オフラインで /licenses に直接アクセスしても表示できた');
    assert.deepEqual(
      licensesJsonRequests,
      [],
      '/licenses.json を取得しようとした（precache 対象外なので、データは JS チャンクに埋め込む）',
    );

    await context.setOffline(false);

    assert.deepEqual(pageErrors, [], `pageerror が発生した: ${pageErrors.join(' / ')}`);

    // 6. デスクトップ幅（1280x800）では、本文とコードの 2 カラムになり、
    //    コードは Header の下に貼り付いてスクロールしても見え続ける。
    //    コード実行と PageDown でのページ送りもここで確かめる。
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'ja-JP',
    });
    const desktopPage = await desktopContext.newPage();
    const desktopErrors = [];
    desktopPage.on('pageerror', (error) => desktopErrors.push(error.message));

    await desktopPage.goto(`${BASE_URL}/tour/welcome/1`, { waitUntil: 'load' });
    await desktopPage.getByRole('heading', { level: 1, name: 'Hello, 世界' }).waitFor();

    const headerBox = await desktopPage.getByRole('banner').boundingBox();
    const articleBox = await desktopPage.getByRole('article').boundingBox();
    const codeRegion = desktopPage.getByRole('region', { name: /のコード例$/ });
    const codeBox = await codeRegion.boundingBox();
    assert.ok(headerBox && articleBox && codeBox, '2 カラムの要素が見つからない');
    assert.ok(
      codeBox.x >= articleBox.x + articleBox.width - 1,
      '本文の右側にコードが並んでいない（2 カラムになっていない）',
    );
    assert.ok(
      headerBox.y + headerBox.height <= codeBox.y + 1,
      'コードが Header の下から始まっていない',
    );
    assert.ok(
      codeBox.y + codeBox.height <= 800,
      'コードがビューポートの高さいっぱいに収まっていない',
    );
    assert.equal(
      await codeRegion.evaluate((element) => getComputedStyle(element.parentElement).position),
      'sticky',
      '右カラムが sticky になっていない',
    );
    log('desktop-columns', '1280x800 で本文とコードの 2 カラムになった');

    // 本文をスクロールしても右カラムは Header の下に残る。
    // 先に少しスクロールして sticky が効いた位置（Header の直下）を覚え、
    // さらにスクロールしても同じ位置にいることを確かめる。
    await desktopPage.evaluate(() => window.scrollTo(0, 200));
    await desktopPage.waitForFunction(() => window.scrollY >= 200);
    const stickyBox = await codeRegion.boundingBox();
    assert.ok(stickyBox.y >= headerBox.y + headerBox.height - 1, '右カラムが Header に重なった');
    await desktopPage.evaluate(() => window.scrollTo(0, 600));
    await desktopPage.waitForFunction(() => window.scrollY >= 600);
    const stickyBoxAfter = await codeRegion.boundingBox();
    assert.ok(
      Math.abs(stickyBoxAfter.y - stickyBox.y) <= 1,
      'スクロールで右カラムが動いてしまった',
    );
    log('desktop-sticky', 'スクロールしてもコードの右カラムが Header の下に残った');

    // 表示設定は Header のメニューから（デスクトップでも同じ）
    await desktopPage.evaluate(() => window.scrollTo(0, 0));
    const desktopSettings = await openDisplaySettings(desktopPage);
    await desktopSettings.getByRole('button', { name: '英語のみ', exact: true }).click();
    await closeDisplaySettings(desktopPage);
    await desktopPage
      .getByText('ページの移動には、次の方法を使います。')
      .waitFor({ state: 'hidden' });
    log('desktop-display-mode', 'Header の表示設定から英語のみに切り替えられた');

    // コード実行（エディタは右カラムの中でスクロールする）
    const desktopOutput = await runCode(desktopPage);
    await desktopOutput.getByText('Hello, 世界').first().waitFor({ timeout: RUN_TIMEOUT_MS });
    log('desktop-run', 'デスクトップでもコードが実行できた');

    // エディタの外にフォーカスを移してから PageDown で次のページへ
    await desktopPage.getByRole('heading', { level: 1, name: 'Hello, 世界' }).click();
    await desktopPage.keyboard.press('PageDown');
    await desktopPage.waitForURL('**/tour/welcome/2');
    await desktopPage.getByRole('heading', { level: 1, name: 'Go local' }).waitFor();
    log('desktop-pagedown', 'PageDown で welcome/2 へ進んだ');

    assert.deepEqual(
      desktopErrors,
      [],
      `desktop pageerror が発生した: ${desktopErrors.join(' / ')}`,
    );
    await desktopContext.close();

    log('done', 'すべての確認に成功した');
  } catch (error) {
    console.error('[e2e-app] FAILED:', error);
    if (serverLog.length > 0) console.error('[e2e-app] server output:\n', serverLog);
    process.exitCode = 1;
  } finally {
    await browser?.close();
    server.kill('SIGTERM');
  }
};

await main();
