/** コンテンツの取得元。ここを変えたら `node scripts/content/fetch.ts` からやり直す。 */
export const SOURCE_REPOSITORY = 'golang/website';

/**
 * `d1edce5` のフルハッシュ。
 * `git ls-remote https://github.com/golang/website.git HEAD` で確認した。
 */
export const SOURCE_COMMIT = 'd1edce5b8ec957935895f507f3253d6e02447a6c';
