/* 번역이 필요한 한국어 문구를 모두 뽑는다 (데이터 + 화면 + 엔진 메시지).
 * 실행: node tools/extract-strings.js > tools/strings-ko.json
 * tests/i18n.test.js 가 같은 함수로 i18n-en.js 누락을 검사한다. */
const fs = require('fs');
const path = require('path');
const HANGUL = /[가-힣]/;
const ROOT = path.join(__dirname, '..', 'www');

function collect() {
  const out = new Set();
  const walk = v => {
    if (typeof v === 'string') { if (HANGUL.test(v)) out.add(v); }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  const DATA = require(path.join(ROOT, 'js', 'data.js'));
  const D7 = require(path.join(ROOT, 'js', 'engine.js'));
  const R = require(path.join(ROOT, 'js', 'region.js'));
  walk(DATA);
  [D7.MSG_POOR, D7.MSG_CASHONLY, D7.MSG_ORDERED, D7.MSG_DELIVERED, ...D7.EPITHETS].forEach(walk);
  Object.values(R.REGIONS).forEach(r => walk(r.name));
  const ui = fs.readFileSync(path.join(ROOT, 'js', 'ui.js'), 'utf8');
  for (const m of ui.matchAll(/\b(?:t|tv|L)\('((?:[^'\\]|\\.)*)'/g)) if (HANGUL.test(m[1])) out.add(m[1]);
  for (const m of ui.matchAll(/(?:name|teaser): '((?:[^'\\]|\\.)*)'/g)) if (HANGUL.test(m[1])) out.add(m[1]);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const m of html.matchAll(/<(\w+)[^>]*\sdata-i18n[^>]*>([\s\S]*?)<\/\1>/g)) out.add(m[2].trim());
  return [...out];
}
module.exports = collect;
if (require.main === module) process.stdout.write(JSON.stringify(collect(), null, 1));
