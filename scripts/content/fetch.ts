import { ensureTourSource } from './fetch-source.ts';
import { SOURCE_COMMIT, SOURCE_REPOSITORY } from './source.ts';

try {
  const tourDir = ensureTourSource();
  process.stdout.write(
    `fetch: ${SOURCE_REPOSITORY}@${SOURCE_COMMIT} を ${tourDir} に用意しました\n`,
  );
} catch (error) {
  process.stderr.write(`fetch: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
