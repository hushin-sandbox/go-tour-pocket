import fs from 'node:fs';
import { CONTENT_VARIANTS_DIR } from './paths.ts';
import { validateContent } from './validate-content.ts';
import { formatVariantIssue, validateVariants } from './validate-variants.ts';

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

let variantsErrorCount = 0;
if (fs.existsSync(CONTENT_VARIANTS_DIR)) {
  const variants = validateVariants();
  for (const issue of variants.issues) {
    process.stdout.write(`validate-variants: ${formatVariantIssue(issue)}\n`);
  }
  process.stdout.write(
    `validate-variants: ${variants.errorCount} errors, ${variants.warningCount} warnings, ` +
      `${variants.patternVariants} patterns in ${variants.patternPages} pages ` +
      `(${variants.variantLessons} lessons)\n`,
  );
  variantsErrorCount = variants.errorCount;
} else {
  // パターンは任意。執筆途中でディレクトリごと無いことをエラーにはしない。
  process.stdout.write('validate-variants: no patterns (content/variants is absent)\n');
}

if (result.errorCount > 0 || variantsErrorCount > 0) {
  process.exitCode = 1;
}
