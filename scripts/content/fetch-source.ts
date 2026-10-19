import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TOUR_SOURCE_DIR, WEBSITE_CACHE_DIR } from './paths.ts';
import { SOURCE_COMMIT, SOURCE_REPOSITORY } from './source.ts';

const REPOSITORY_URL = `https://github.com/${SOURCE_REPOSITORY}.git`;

function git(args: string[]): string {
  return execFileSync('git', args, {
    cwd: WEBSITE_CACHE_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function hasGitRepository(): boolean {
  return fs.existsSync(path.join(WEBSITE_CACHE_DIR, '.git'));
}

function currentHead(): string | null {
  try {
    return git(['rev-parse', 'HEAD']);
  } catch {
    return null;
  }
}

/**
 * `golang/website` の固定コミットから `_content/tour/` だけを `.cache/` に取得する。
 * 2 回目以降はキャッシュを使う。
 */
export function ensureTourSource(): string {
  fs.mkdirSync(WEBSITE_CACHE_DIR, { recursive: true });

  if (!hasGitRepository()) {
    // 空でない壊れたキャッシュが残っていると git init が失敗するので、いったん消す。
    fs.rmSync(WEBSITE_CACHE_DIR, { recursive: true, force: true });
    fs.mkdirSync(WEBSITE_CACHE_DIR, { recursive: true });
    process.stdout.write(`fetch: init ${path.relative(process.cwd(), WEBSITE_CACHE_DIR)}\n`);
    git(['init', '--quiet']);
    git(['remote', 'add', 'origin', REPOSITORY_URL]);
    git(['sparse-checkout', 'init', '--cone']);
    git(['sparse-checkout', 'set', '_content/tour']);
  }

  if (currentHead() !== SOURCE_COMMIT) {
    process.stdout.write(`fetch: ${SOURCE_REPOSITORY}@${SOURCE_COMMIT.slice(0, 7)}\n`);
    git(['remote', 'set-url', 'origin', REPOSITORY_URL]);
    git(['fetch', '--depth', '1', 'origin', SOURCE_COMMIT]);
    git(['checkout', '--quiet', '--detach', 'FETCH_HEAD']);
    git(['sparse-checkout', 'set', '_content/tour']);
  }

  const head = currentHead();
  if (head !== SOURCE_COMMIT) {
    throw new Error(
      `expected ${SOURCE_COMMIT} but got ${head ?? '(none)'} in ${WEBSITE_CACHE_DIR}`,
    );
  }
  if (!fs.existsSync(TOUR_SOURCE_DIR)) {
    throw new Error(`_content/tour not found after fetch: ${TOUR_SOURCE_DIR}`);
  }
  return TOUR_SOURCE_DIR;
}
