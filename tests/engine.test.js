/* 실행: npm test  (node --test) */
const test = require('node:test');
const assert = require('node:assert');
const D7 = require('../www/js/engine.js');
const DATA = require('../www/js/data.js');
const { JOBS, SCENARIOS, CARDS, FILLERS, ITEMS, STRIKES } = DATA;

const allCards = CARDS.concat(FILLERS);
const jobIds = JOBS.map(j => j.id), scIds = SCENARIOS.map(s => s.id);

test('카드 데이터 무결성: id 중복 없음, 참조하는 아이템·직업·재난·연결 카드가 존재', () => {
  const ids = new Set();
  for (const c of allCards) {
    assert.ok(!ids.has(c.id), 'duplicate id ' + c.id); ids.add(c.id);
    assert.ok(c.text && c.who && c.L && c.R, 'incomplete ' + c.id);
    const w = c.when || {};
    for (const j of (w.job || []).concat(w.notJob || [])) assert.ok(jobIds.includes(j), c.id + ' job ' + j);
    for (const s of (w.sc || []).concat(w.notSc || [])) assert.ok(scIds.includes(s), c.id + ' sc ' + s);
    for (const r of w.region || []) assert.ok(D7.REGIONS.includes(r), c.id + ' region ' + r);
    for (const it of [w.has, w.not].filter(Boolean)) assert.ok(ITEMS[it], c.id + ' item ' + it);
    if (c.scripted) assert.ok(typeof w.day === 'number', c.id + ' scripted needs day');
    for (const side of ['L', 'R']) {
      const ch = c[side];
      assert.ok(ch.t, c.id + side + ' label');
      const outs = [ch].concat(ch.cond || [], ch.rand || []);
      for (const o of outs) {
        for (const it of (o.add || []).concat(o.del || [], o.has ? [o.has] : [], o.deliver ? [o.deliver.item] : [])) assert.ok(ITEMS[it], c.id + ' item ' + it);
        if (o.next) assert.ok(allCards.find(x => x.id === o.next), c.id + ' next ' + o.next);
        if (o.job) assert.ok(jobIds.includes(o.job));
      }
      if (ch.rand) assert.ok(Math.abs(ch.rand.reduce((a, r) => a + r.p, 0) - 1) < 1e-9, c.id + ' rand sums to 1');
    }
  }
  for (const s of scIds) assert.ok(STRIKES[s], 'strike for ' + s);
  for (const j of JOBS) for (const it of j.items.concat(...Object.values(j.regionItems || {}))) assert.ok(ITEMS[it]);
});

test('모든 직업×재난×지역 조합이 무한루프 없이 끝난다', () => {
  for (const j of jobIds) for (const s of scIds) for (const rg of D7.REGIONS) for (let seed = 0; seed < 15; seed++) {
    const st = D7.newGame(j, s, seed, rg);
    let n = 0;
    while (!st.over) { D7.drawCard(st); D7.choose(st, st.rng() < 0.5 ? 'L' : 'R'); assert.ok(++n < 400); }
    assert.ok(st.won || st.death);
    if (st.won) assert.strictEqual(st.day, D7.scen(s).endDay + 1);
  }
});

test('D-7 첫 카드는 재난 뉴스, D-4 첫 카드는 ATM, D-Day 첫 카드는 재난', () => {
  const st = D7.newGame('doctor', 'quake', 1);
  assert.strictEqual(D7.drawCard(st).id, 'eq_n7');
  const seen = {};
  while (st.day <= 0 && !st.over) {
    const c = D7.drawCard(st);
    if (st.slot === 0) seen[st.day] = c.id;
    D7.choose(st, 'R');
  }
  assert.strictEqual(seen[-4], 'p_atm');
  assert.strictEqual(seen[0], 'strike');
});

test('결제망 마비 재난: 뽑아둔 현금만 남고 나머지는 동결', () => {
  const st = D7.newGame('banker', 'blackout', 3);
  st.stats = { hp: 100, mind: 100, food: 100, safe: 100 };
  st.cash = 5000;
  st.day = 0; st.slot = 0;
  D7.drawCard(st);
  D7.choose(st, 'R');
  assert.strictEqual(st.money, 5000);
  assert.strictEqual(st.frozen, 300000 - 5000);
});

test('감염병은 결제망이 유지된다', () => {
  const st = D7.newGame('banker', 'pandemic', 3);
  st.stats = { hp: 100, mind: 100, food: 100, safe: 100 };
  st.day = 0; st.slot = 0;
  D7.drawCard(st); D7.choose(st, 'R');
  assert.strictEqual(st.money, 300000);
});

test('돈이 부족하면 구매하지 못하고 아이템도 얻지 못한다', () => {
  const st = D7.newGame('farmer', 'quake', 1);
  st.money = 50;
  st.current = CARDS.find(c => c.id === 'p_lock');
  const res = D7.choose(st, 'R');
  assert.ok(!st.items.includes('lock'));
  assert.strictEqual(st.money, 50);
  assert.strictEqual(res.msgs[0].t, D7.MSG_POOR);
});

test('조건부 결과: 구급상자가 있으면 부상이 가볍다', () => {
  const a = D7.newGame('banker', 'quake', 1), b = D7.newGame('banker', 'quake', 1);
  for (const st of [a, b]) { st.day = 2; st.current = CARDS.find(c => c.id === 'q_cut'); }
  b.items.push('medkit');
  D7.choose(a, 'R'); D7.choose(b, 'R');
  assert.ok(b.stats.hp > a.stats.hp);
});

test('직업 보정: 퇴역군인은 안전 손실이 줄어든다', () => {
  const v = D7.newGame('veteran', 'quake', 1), f = D7.newGame('farmer', 'quake', 1);
  v.stats.safe = f.stats.safe = 50;
  for (const st of [v, f]) { st.day = 2; st.current = CARDS.find(c => c.id === 'q_vigil'); D7.choose(st, 'L'); }
  assert.ok(50 - v.stats.safe < 50 - f.stats.safe);
});

test('스탯이 0이 되면 사망 처리', () => {
  const st = D7.newGame('banker', 'typhoon', 1);
  st.day = 2; st.stats.hp = 5;
  st.current = CARDS.find(c => c.id === 'ty_mud');
  const res = D7.choose(st, 'R');
  assert.strictEqual(res.dead, 'hp');
  assert.ok(st.over && !st.won);
});

test('[검수 수정] cond가 맞아도 선택지의 플래그(karma)가 유지된다', () => {
  for (const [id, sc, prep] of [['eq_trapped', 'quake', st => st.items.push('toolkit')],
    ['q_cry', 'quake', st => { st.flags.firstAid = true; }], ['bo_stuck', 'blackout', st => st.items.push('toolkit')]]) {
    const st = D7.newGame('banker', sc, 1);
    st.day = 2; prep(st);
    st.current = CARDS.find(c => c.id === id);
    D7.choose(st, 'R');
    assert.ok(st.flags.karma, id + ' keeps karma');
    assert.strictEqual(st.karma, 1);
  }
});

test('[검수 수정] 연결 카드가 있어도 그날의 고정 카드가 먼저 나온다', () => {
  const st = D7.newGame('banker', 'quake', 1);
  st.stats = { hp: 100, mind: 100, food: 100, safe: 100 };
  st.day = 0; st.slot = 2;
  st.current = CARDS.find(c => c.id === 'q_child');
  D7.choose(st, 'R');
  assert.strictEqual(st.day, 1);
  assert.strictEqual(D7.drawCard(st).id, 'eq_d1');
  D7.choose(st, 'R');
  assert.strictEqual(D7.drawCard(st).id, 'q_child2');
});

test('[검수 수정] 재난 카드 미리보기는 완화 효과를 반영한다', () => {
  const a = D7.newGame('banker', 'quake', 1), b = D7.newGame('banker', 'quake', 1);
  b.items.push('reinforce'); b.flags.earlyAlert = true;
  for (const st of [a, b]) { st.day = 0; st.slot = 0; D7.drawCard(st); }
  assert.strictEqual(D7.preview(a, 'R').stats.hp, 2);
  assert.strictEqual(D7.preview(b, 'R').stats.hp, 1);
});

test('모든 재난에 D-7 뉴스, 재난 카드, 종료일 카드가 있다', () => {
  for (const s of SCENARIOS) {
    assert.ok(CARDS.find(c => c.scripted && c.when.day === -7 && c.when.sc && c.when.sc.includes(s.id)), s.id + ' D-7');
    assert.ok(STRIKES[s.id], s.id + ' strike');
    assert.ok(CARDS.find(c => c.scripted && c.when.day === s.endDay && c.when.sc && c.when.sc.includes(s.id)), s.id + ' end');
  }
});

test('알 수 없는 재난은 D-7 뉴스를 본 뒤에 공개된다', () => {
  const st = D7.newGame('doctor', 'random', 5);
  assert.strictEqual(st.revealed, false);
  D7.drawCard(st); D7.choose(st, 'L');
  assert.strictEqual(st.revealed, true);
  assert.strictEqual(D7.newGame('doctor', 'quake', 5).revealed, true);
});

test('지역: 북미 전용 카드는 대한민국에서 안 나오고, 북미 퇴역군인은 총을 갖고 시작', () => {
  const kr = D7.newGame('veteran', 'quake', 1, 'kr'), na = D7.newGame('veteran', 'quake', 1, 'na');
  assert.ok(!kr.items.includes('gun'));
  assert.ok(na.items.includes('gun'));
  for (let seed = 0; seed < 40; seed++) {
    const st = D7.newGame('doctor', 'quake', seed, 'kr');
    while (!st.over) { const c = D7.drawCard(st); assert.ok(!c.id.startsWith('na_'), c.id); D7.choose(st, 'R'); }
  }
});

test('북미 총기 구매: 신원조회 후 10일 뒤 수령 (D-7 구매 → D+3)', () => {
  const st = D7.newGame('doctor', 'quake', 1, 'na');
  st.stats = { hp: 100, mind: 100, food: 100, safe: 100 };
  st.current = CARDS.find(c => c.id === 'na_gun');
  const res = D7.choose(st, 'R');
  assert.ok(!st.items.includes('gun'));
  assert.deepStrictEqual(res.msgs[0].vars, { item: 'gun', day: 'D+3' });
  let got = null;
  while (!st.over && st.day < 4) {
    const c = D7.drawCard(st);
    if (c.strike || st.day < 0) st.stats = { hp: 100, mind: 100, food: 100, safe: 100 };
    const r = D7.choose(st, 'L');
    if (r.day && r.day.delivered.includes('gun')) got = st.day;
    st.stats = { hp: 100, mind: 100, food: 100, safe: 100 };
  }
  assert.strictEqual(got, 3);
  assert.ok(st.items.includes('gun'));
});

test('이어하기: 저장 후 불러오면 같은 카드·같은 난수로 이어진다', () => {
  const a = D7.newGame('farmer', 'typhoon', 9, 'na');
  for (let i = 0; i < 10; i++) { D7.drawCard(a); D7.choose(a, i % 2 ? 'L' : 'R'); }
  D7.drawCard(a);
  const b = D7.restore(D7.serialize(a));
  assert.strictEqual(b.current.id, a.current.id);
  for (let i = 0; i < 20 && !a.over; i++) {
    D7.choose(a, 'R'); D7.choose(b, 'R');
    if (a.over) break;
    assert.strictEqual(D7.drawCard(a).id, D7.drawCard(b).id);
  }
  assert.deepStrictEqual(a.stats, b.stats);
  assert.strictEqual(D7.restore('{"v":1}'), null);
});

test('지역 단위·화폐 변환', () => {
  const R = require('../www/js/region.js');
  assert.strictEqual(R.localize('{C:43}, {EMS}, $150', 'kr', 'ko'), '43℃, 119, ₩195,000');
  assert.strictEqual(R.localize('{C:43}, {EMS}, $150', 'na', 'en'), '109°F, 911, $150');
  assert.strictEqual(R.localize('{STORM} {MS:60} {L:4} {M:10}', 'na', 'ko'), '허리케인 134 mph 1갤런 30피트');
});
