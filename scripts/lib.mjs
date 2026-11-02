// Load, validate and export the glossary. No dependencies: Node >= 20.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const REPOSITORY = 'https://github.com/qelunai/vietnamese-culture-glossary';
export const REVIEW_STATUSES = ['needs-native-review', 'reviewed'];

const TEXT_FIELDS = ['vi', 'en', 'zh', 'ko', 'definition_vi', 'definition_en'];
const ENTRY_FIELDS = ['id', 'category', 'vi', 'han', 'en', 'zh', 'ko', 'definition_vi', 'definition_en', 'related', 'sources', 'review'];
const CATEGORY_FIELDS = ['id', 'vi', 'en', 'zh', 'ko'];
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Han characters (CJK unified, extension A, compatibility), plus middle dot and
// ideographic punctuation used between paired names.
const HAN = /^[㐀-䶿一-鿿豈-﫿、·・、 ]+$/u;

const isText = (v) => typeof v === 'string' && v.trim() !== '';

/** Reads glossary/categories.json and every other glossary/*.json (one file per category). */
export function loadGlossary(root) {
  const dir = join(root, 'glossary');
  const categories = JSON.parse(readFileSync(join(dir, 'categories.json'), 'utf8'));
  const entries = [];
  for (const category of categories) {
    const file = join(dir, `${category.id}.json`);
    for (const entry of JSON.parse(readFileSync(file, 'utf8'))) {
      entries.push({ id: entry.id, category: category.id, ...entry });
    }
  }
  const known = new Set(['categories.json', ...categories.map((c) => `${c.id}.json`)]);
  const stray = readdirSync(dir).filter((f) => f.endsWith('.json') && !known.has(f));
  if (stray.length) throw new Error(`glossary/ has files for no category: ${stray.join(', ')}`);
  return { categories, entries };
}

function checkNfc(value, where, errors) {
  if (typeof value === 'string') {
    if (value !== value.normalize('NFC')) errors.push(`${where}: text is not Unicode NFC`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => checkNfc(v, `${where}[${i}]`, errors));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) checkNfc(v, `${where}.${k}`, errors);
  }
}

/** Returns a list of human readable errors; empty when the glossary is valid. */
export function validate({ categories, entries }) {
  const errors = [];
  const categoryIds = new Set();
  for (const c of categories) {
    const where = `category "${c.id}"`;
    for (const k of Object.keys(c)) if (!CATEGORY_FIELDS.includes(k)) errors.push(`${where}: unknown field "${k}"`);
    for (const k of CATEGORY_FIELDS) if (!isText(c[k])) errors.push(`${where}: ${k} is missing or empty`);
    if (categoryIds.has(c.id)) errors.push(`duplicate category "${c.id}"`);
    categoryIds.add(c.id);
    checkNfc(c, where, errors);
  }

  const ids = new Set();
  for (const e of entries) {
    if (ids.has(e.id)) errors.push(`duplicate id "${e.id}"`);
    ids.add(e.id);
  }

  entries.forEach((e, i) => {
    const where = `entry "${e.id ?? `#${i}`}"`;
    for (const k of Object.keys(e)) if (!ENTRY_FIELDS.includes(k)) errors.push(`${where}: unknown field "${k}"`);
    if (typeof e.id !== 'string' || !ID.test(e.id)) errors.push(`${where}: id must be kebab-case ASCII (a-z, 0-9, -)`);
    if (!categoryIds.has(e.category)) errors.push(`${where}: unknown category "${e.category}"`);
    for (const k of TEXT_FIELDS) if (!isText(e[k])) errors.push(`${where}: ${k} is missing or empty`);
    if (typeof e.han !== 'string') errors.push(`${where}: han must be a string (empty when not Hán Việt)`);
    else if (e.han !== '' && !HAN.test(e.han)) errors.push(`${where}: han must contain only Han characters`);

    if (!Array.isArray(e.related)) errors.push(`${where}: related must be an array`);
    else {
      const seen = new Set();
      for (const r of e.related) {
        if (r === e.id) errors.push(`${where}: related refers to itself`);
        else if (!ids.has(r)) errors.push(`${where}: unknown related id "${r}"`);
        if (seen.has(r)) errors.push(`${where}: repeats related id "${r}"`);
        seen.add(r);
      }
    }

    if (!Array.isArray(e.sources)) errors.push(`${where}: sources must be an array`);
    else {
      for (const s of e.sources) {
        let ok = false;
        try {
          ok = new URL(s).protocol === 'https:';
        } catch {}
        if (!ok) errors.push(`${where}: source "${s}" must be an https URL`);
      }
    }

    const review = e.review;
    if (!review || typeof review !== 'object' || Array.isArray(review)) errors.push(`${where}: review must be an object with zh and ko`);
    else {
      for (const lang of ['zh', 'ko']) {
        if (!REVIEW_STATUSES.includes(review[lang])) {
          errors.push(`${where}: review.${lang} must be one of ${REVIEW_STATUSES.join(', ')}`);
        }
      }
      for (const k of Object.keys(review)) if (!['zh', 'ko'].includes(k)) errors.push(`${where}: unknown field "review.${k}"`);
    }
    checkNfc(e, where, errors);
  });
  return errors;
}

/** The published JSON: metadata, categories, entries in a fixed key order. */
export function toJson({ categories, entries }, { version }) {
  const out = {
    name: 'vietnamese-culture-glossary',
    version,
    license: 'CC-BY-4.0',
    repository: REPOSITORY,
    categories: categories.map((c) => Object.fromEntries(CATEGORY_FIELDS.map((k) => [k, c[k]]))),
    entries: entries.map((e) => Object.fromEntries(ENTRY_FIELDS.map((k) => [k, e[k]]))),
  };
  return `${JSON.stringify(out, null, 2)}\n`;
}

const CSV_COLUMNS = ['id', 'category', 'vi', 'han', 'en', 'zh', 'ko', 'definition_vi', 'definition_en', 'related', 'sources', 'review_zh', 'review_ko'];

function csvField(value) {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** RFC 4180 CSV, UTF-8 without BOM; lists joined with "|". */
export function toCsv({ entries }) {
  const rows = [CSV_COLUMNS];
  for (const e of entries) {
    rows.push([
      e.id, e.category, e.vi, e.han, e.en, e.zh, e.ko, e.definition_vi, e.definition_en,
      e.related.join('|'), e.sources.join('|'), e.review.zh, e.review.ko,
    ]);
  }
  return rows.map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}
