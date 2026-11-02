import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../scripts/lib.mjs';

const categories = [
  { id: 'lich', vi: 'Lịch và thời gian', en: 'Calendar and time', zh: '历法与时间', ko: '역법과 시간' },
];

function entry(over = {}) {
  return {
    id: 'am-lich',
    category: 'lich',
    vi: 'âm lịch',
    han: '陰曆',
    en: 'lunar calendar',
    zh: '农历',
    ko: '음력',
    definition_vi: 'Lịch tính tháng theo tuần trăng.',
    definition_en: 'A calendar whose months follow the phases of the moon.',
    related: [],
    sources: [],
    review: { zh: 'needs-native-review', ko: 'needs-native-review' },
    ...over,
  };
}

const run = (entries, cats = categories) => validate({ categories: cats, entries });

test('a valid glossary has no errors', () => {
  assert.deepEqual(run([entry(), entry({ id: 'thang-nhuan', vi: 'tháng nhuận', related: ['am-lich'] })]), []);
});

test('duplicate ids are reported', () => {
  const errors = run([entry(), entry()]);
  assert.ok(errors.some((e) => e.includes('duplicate id "am-lich"')), errors.join('\n'));
});

test('ids must be kebab-case ASCII', () => {
  for (const id of ['Am-lich', 'âm-lịch', 'am_lich', 'am--lich', '-am', '']) {
    const errors = run([entry({ id })]);
    assert.ok(errors.some((e) => e.includes('id')), `${id}: ${errors.join('\n')}`);
  }
});

test('related must point to existing ids, not itself, without repeats', () => {
  assert.ok(run([entry({ related: ['khong-co'] })]).some((e) => e.includes('unknown related id "khong-co"')));
  assert.ok(run([entry({ related: ['am-lich'] })]).some((e) => e.includes('refers to itself')));
  const twice = [entry({ related: ['b', 'b'] }), entry({ id: 'b' })];
  assert.ok(run(twice).some((e) => e.includes('repeats related id "b"')));
});

test('required fields must be present and non-empty', () => {
  for (const field of ['vi', 'en', 'zh', 'ko', 'definition_vi', 'definition_en']) {
    assert.ok(run([entry({ [field]: '' })]).some((e) => e.includes(field)), `${field} empty`);
    assert.ok(run([entry({ [field]: '   ' })]).some((e) => e.includes(field)), `${field} blank`);
    const missing = entry();
    delete missing[field];
    assert.ok(run([missing]).some((e) => e.includes(field)), `${field} missing`);
  }
});

test('han may be empty but must be a string of Han characters when set', () => {
  assert.deepEqual(run([entry({ han: '' })]), []);
  assert.ok(run([entry({ han: 'am lich' })]).some((e) => e.includes('han')));
  const missing = entry();
  delete missing.han;
  assert.ok(run([missing]).some((e) => e.includes('han')));
});

test('unknown fields are rejected', () => {
  assert.ok(run([entry({ note: 'x' })]).some((e) => e.includes('unknown field "note"')));
});

test('category must exist', () => {
  assert.ok(run([entry({ category: 'khac' })]).some((e) => e.includes('unknown category "khac"')));
});

test('categories need an id and four names', () => {
  const errors = run([entry()], [{ id: 'lich', vi: 'Lịch', en: '', zh: '历', ko: '역' }]);
  assert.ok(errors.some((e) => e.includes('category "lich"') && e.includes('en')));
});

test('text must be Unicode NFC', () => {
  const decomposed = 'âm lịch'.normalize('NFD');
  assert.notEqual(decomposed, 'âm lịch');
  assert.ok(run([entry({ vi: decomposed })]).some((e) => e.includes('NFC')));
});

test('sources must be https URLs', () => {
  assert.deepEqual(run([entry({ sources: ['https://vi.wikipedia.org/wiki/%C3%82m_l%E1%BB%8Bch'] })]), []);
  assert.ok(run([entry({ sources: ['http://example.com'] })]).some((e) => e.includes('source')));
  assert.ok(run([entry({ sources: ['xem sách'] })]).some((e) => e.includes('source')));
});

test('review must name zh and ko with a known status', () => {
  assert.ok(run([entry({ review: { zh: 'ok', ko: 'needs-native-review' } })]).some((e) => e.includes('review.zh')));
  assert.ok(run([entry({ review: { zh: 'reviewed' } })]).some((e) => e.includes('review.ko')));
  assert.deepEqual(run([entry({ review: { zh: 'reviewed', ko: 'needs-native-review' } })]), []);
});

test('related and sources must be arrays', () => {
  assert.ok(run([entry({ related: 'thang-nhuan' })]).some((e) => e.includes('related')));
  assert.ok(run([entry({ sources: null })]).some((e) => e.includes('sources')));
});
