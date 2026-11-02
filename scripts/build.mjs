// Writes dist/glossary.json and dist/glossary.csv from glossary/*.json.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGlossary, toCsv, toJson, validate } from './lib.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const glossary = loadGlossary(root);
const errors = validate(glossary);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'glossary.json'), toJson(glossary, { version }));
writeFileSync(join(root, 'dist', 'glossary.csv'), toCsv(glossary));
console.log(`dist/: ${glossary.entries.length} entries`);
