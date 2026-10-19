import path from 'node:path';

/** リポジトリのルート。scripts/content/*.ts から 2 つ上。 */
export const ROOT_DIR = path.resolve(import.meta.dirname, '..', '..');

/** 取得元を展開するキャッシュ。`.gitignore` の `.cache/` で無視される。 */
export const CACHE_DIR = path.join(ROOT_DIR, '.cache');
export const WEBSITE_CACHE_DIR = path.join(CACHE_DIR, 'website');

/** `golang/website` の `_content/tour/`。fetch 後のパス。 */
export const TOUR_SOURCE_DIR = path.join(WEBSITE_CACHE_DIR, '_content', 'tour');

export const CONTENT_EN_DIR = path.join(ROOT_DIR, 'content', 'en');
export const CONTENT_JA_DIR = path.join(ROOT_DIR, 'content', 'ja');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
export const TOUR_IMAGES_DIR = path.join(PUBLIC_DIR, 'tour', 'images');
