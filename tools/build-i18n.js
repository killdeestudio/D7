/* tools/en-part-*.json 번역을 합쳐 www/js/i18n-en.js 를 만든다.
 * 실행: node tools/build-i18n.js   (누락·한글 남은 번역·자리표시자 불일치가 있으면 실패) */
const fs = require('fs');
const path = require('path');
const collect = require('./extract-strings.js');
const dir = __dirname;
const en = {};
for (const f of fs.readdirSync(dir).filter(f => /^en-part-\d+\.json$/.test(f)).sort()) Object.assign(en, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const need = collect();
const problems = [];
const ph = s => (s.match(/\{[A-Za-z_]+(?::-?[\d.]+)?\}|\$[\d,]+/g) || []).sort().join(' ');
for (const k of need) {
  if (en[k] == null) { problems.push('missing: ' + k); continue; }
  if (/[가-힣]/.test(en[k])) problems.push('hangul left: ' + k);
  if (ph(k) !== ph(en[k])) problems.push('placeholder mismatch: ' + k + ' => ' + en[k]);
}
const out = {};
for (const k of need) if (en[k] != null) out[k] = en[k];
fs.writeFileSync(path.join(dir, '..', 'www', 'js', 'i18n-en.js'),
  '/* 영어 번역 사전 (한국어 원문 → 영어). tools/build-i18n.js 로 생성 */\nwindow.D7_EN = ' + JSON.stringify(out, null, 1) + ';\n');
console.log('strings', need.length, 'translated', Object.keys(out).length);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
