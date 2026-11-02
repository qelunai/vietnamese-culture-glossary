import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { toCsv, toJson, loadGlossary, validate } from '../scripts/lib.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

const data = {
  categories: [{ id: 'lich', vi: 'Lịch', en: 'Calendar', zh: '历法', ko: '역법' }],
  entries: [
    {
      id: 'am-lich',
      category: 'lich',
      vi: 'âm lịch',
      han: '陰曆',
      en: 'lunar calendar',
      zh: '农历',
      ko: '음력',
      definition_vi: 'Lịch "âm", tính theo trăng, có dấu phẩy, và\nxuống dòng.',
      definition_en: 'A calendar.',
      related: ['b', 'c'],
      sources: [],
      review: { zh: 'needs-native-review', ko: 'reviewed' },
    },
  ],
};

test('csv has a header, quotes fields with commas, quotes and newlines', () => {
  const csv = toCsv(data);
  const [header] = csv.split('\r\n');
  assert.equal(
    header,
    'id,category,vi,han,en,zh,ko,definition_vi,definition_en,related,sources,review_zh,review_ko',
  );
  assert.ok(csv.includes('"Lịch ""âm"", tính theo trăng, có dấu phẩy, và\nxuống dòng."'));
  assert.ok(csv.includes(',b|c,'));
  assert.ok(csv.endsWith('needs-native-review,reviewed\r\n'));
  assert.ok(csv.startsWith('﻿') === false);
});

test('json output is stable and ends with a newline', () => {
  const json = toJson(data, { version: '1.2.3' });
  const parsed = JSON.parse(json);
  assert.equal(parsed.version, '1.2.3');
  assert.equal(parsed.license, 'CC-BY-4.0');
  assert.equal(parsed.entries.length, 1);
  assert.ok(json.endsWith('}\n'));
  assert.equal(toJson(data, { version: '1.2.3' }), json);
});

test('the glossary in this repo is valid', () => {
  const glossary = loadGlossary(root);
  assert.deepEqual(validate(glossary), []);
  assert.ok(glossary.entries.length >= 120, `only ${glossary.entries.length} entries`);
});

test('dist files are up to date with glossary/', () => {
  const glossary = loadGlossary(root);
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(readFileSync(new URL('../dist/glossary.json', import.meta.url), 'utf8'), toJson(glossary, { version }));
  assert.equal(readFileSync(new URL('../dist/glossary.csv', import.meta.url), 'utf8'), toCsv(glossary));
});
