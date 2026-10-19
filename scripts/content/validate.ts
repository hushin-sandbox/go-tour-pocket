import { validateContent } from './validate-content.ts';

const result = validateContent();

for (const issue of result.issues) {
  const location = issue.blockId === undefined ? `[${issue.lesson}]` : `[${issue.blockId}]`;
  process.stdout.write(`validate: ${issue.level} ${location} ${issue.message}\n`);
}

process.stdout.write(
  `validate: ${result.errorCount} errors, ${result.warningCount} warnings, ` +
    `${result.translatedLessons} translated lessons\n`,
);
if (result.missingLessons.length > 0) {
  process.stdout.write(`validate: no ja translation: ${result.missingLessons.join(', ')}\n`);
}
if (result.errorCount > 0) {
  process.exitCode = 1;
}
