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
    for (const it of [w.has, w.not].filter(Boolean)) assert.ok(ITEMS[it], c.id + ' item ' + it);
    if (c.scripted) assert.ok(typeof w.day === 'number', c.id + ' scripted needs day');
    for (const side of ['L', 'R']) {
      const ch = c[side];
      assert.ok(ch.t, c.id + side + ' label');
      const outs = [ch].concat(ch.cond || [], ch.rand || []);
      for (const o of outs) {
        for (const it of (o.add || []).concat(o.del || [], o.has ? [o.has] : [])) assert.ok(ITEMS[it], c.id + ' item ' + it);
        if (o.next) assert.ok(allCards.find(x => x.id === o.next), c.id + ' next ' + o.next);
        if (o.job) assert.ok(jobIds.includes(o.job));
      }
      if (ch.rand) assert.ok(Math.abs(ch.rand.reduce((a, r) => a + r.p, 0) - 1) < 1e-9, c.id + ' rand sums to 1');
    }
  }
  for (const s of scIds) assert.ok(STRIKES[s], 'strike for ' + s);
  for (const j of JOBS) for (const it of j.items) assert.ok(ITEMS[it]);
});

test('모든 직업×재난 조합이 무한루프 없이 끝난다', () => {
  for (const j of jobIds) for (const s of scIds) for (let seed = 0; seed < 30; seed++) {
    const st = D7.newGame(j, s, seed);
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
  assert.match(res.msgs[0], /돈이 모자라/);
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
