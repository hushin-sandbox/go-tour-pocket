import { buildContent } from './build-content.ts';

try {
  const result = buildContent();
  const pages = result.lessons.reduce((total, lesson) => total + lesson.pages.length, 0);
  const code = result.lessons.reduce(
    (total, lesson) => total + lesson.pages.filter((page) => page.code !== undefined).length,
    0,
  );
  process.stdout.write(
    `build: ${result.lessons.length} lessons, ${pages} pages, ${code} code pages, ` +
      `${result.images.length} images\n`,
  );
} catch (error) {
  process.stderr.write(`build: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
