/* 영어 번역 누락 검사: 화면·카드에 나오는 모든 한국어 문구에 영어가 있어야 한다 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const collect = require('../tools/extract-strings.js');

test('모든 한국어 문구에 영어 번역이 있고 자리표시자가 일치한다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'www', 'js', 'i18n-en.js'), 'utf8');
  const sandbox = {};
  new Function('window', src)(sandbox);
  const EN = sandbox.D7_EN;
  const ph = s => (s.match(/\{[A-Za-z_]+(?::-?[\d.]+)?\}|\$[\d,]+/g) || []).sort().join(' ');
  const missing = [], bad = [];
  for (const k of collect()) {
    if (EN[k] == null) missing.push(k);
    else if (/[가-힣]/.test(EN[k]) || ph(k) !== ph(EN[k])) bad.push(k);
  }
  assert.deepStrictEqual(missing, [], 'missing translations');
  assert.deepStrictEqual(bad, [], 'bad translations');
});
