// Validates glossary/*.json. Exit code 1 and a list of errors when invalid.
import { fileURLToPath } from 'node:url';
import { loadGlossary, validate } from './lib.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const glossary = loadGlossary(root);
const errors = validate(glossary);
if (errors.length) {
  console.error(errors.map((e) => `✖ ${e}`).join('\n'));
  console.error(`\n${errors.length} error(s).`);
  process.exit(1);
}
const byCategory = glossary.categories.map((c) => `${c.id}: ${glossary.entries.filter((e) => e.category === c.id).length}`);
console.log(`✔ ${glossary.entries.length} entries valid (${byCategory.join(', ')})`);
