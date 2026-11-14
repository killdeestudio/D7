/* D-7 재난 생존 — 게임 엔진 (화면과 분리된 순수 로직, Node에서도 테스트 가능)
 * 엔진이 내보내는 메시지는 { t: 한국어 원문(번역 키), ok?, vars? } 형식. 화면에서 번역한다.
 */
(function (root) {
  'use strict';
  const DATA = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.D7_DATA;
  const { STATS, JOBS, SCENARIOS, STRIKES, CARDS, FILLERS, ITEMS } = DATA;
  const KEYS = STATS.map(s => s.key);
  const PRE_PER_DAY = 3;
  const RECENT = 6;
  const SAVE_VERSION = 2;

  const MSG_POOR = '돈이 모자라 아무것도 사지 못했다.';
  const MSG_CASHONLY = '💳 결제망 마비 — 이제 현금 {money}만 쓸 수 있다';
  const MSG_ORDERED = '⏳ {item} 수령 예정일: {day}';
  const MSG_DELIVERED = '📦 대기 기간이 끝나 {item}을(를) 받았다';
  const REGIONS = ['kr', 'na'];

  /* mulberry32: 상태(st.rs)를 저장해두면 이어하기 후에도 같은 난수열이 이어진다 */
  function nextRand(st) {
    st.rs = (st.rs + 0x6D2B79F5) >>> 0;
    let t = st.rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function attachRng(st) { st.rng = () => nextRand(st); return st; }

  const job = id => JOBS.find(j => j.id === id);
  const scen = id => SCENARIOS.find(s => s.id === id);
  const cardById = id => CARDS.find(c => c.id === id) || FILLERS.find(c => c.id === id);

  function newGame(jobId, scenarioId, seed, region) {
    const st = attachRng({ rs: (seed == null ? (Date.now() ^ (Math.random() * 1e9)) : seed) >>> 0 });
    const random = scenarioId === 'random' || !scenarioId;
    const sid = random ? SCENARIOS[Math.floor(st.rng() * SCENARIOS.length)].id : scenarioId;
    const j = job(jobId);
    if (!j || !scen(sid)) throw new Error('unknown job/scenario');
    return Object.assign(st, {
      v: SAVE_VERSION,
      job: j.id, sc: sid, pickSc: random ? 'random' : sid, revealed: !random,
      region: REGIONS.includes(region) ? region : 'kr', pending: [],
      day: -7, slot: 0,
      stats: Object.assign({}, j.stats),
      money: j.money, cash: 0, frozen: 0,
      items: j.items.concat((j.regionItems || {})[REGIONS.includes(region) ? region : 'kr'] || []),
      flags: {}, karma: 0,
      seen: {}, recent: [], queue: [],
      current: null, over: false, won: false, death: null,
      log: [],
    });
  }

  const dayLabel = d => (d < 0 ? 'D' + d : d === 0 ? 'D-Day' : 'D+' + d);
  const phaseOf = st => (st.day < 0 ? 'pre' : 'post');
  const perDay = st => (st.day < 0 ? PRE_PER_DAY : st.day === 0 ? 3 : scen(st.sc).perDay);
  const has = (st, it) => st.items.includes(it);

  function eligible(st, c, scriptedPass) {
    const w = c.when || {};
    if (w.phase && w.phase !== phaseOf(st)) return false;
    if (w.region && !w.region.includes(st.region)) return false;
    if (w.sc && !w.sc.includes(st.sc)) return false;
    if (w.notSc && w.notSc.includes(st.sc)) return false;
    if (w.cashOnly != null && !!scen(st.sc).cashOnly !== w.cashOnly) return false;
    if (w.job && !w.job.includes(st.job)) return false;
    if (w.notJob && w.notJob.includes(st.job)) return false;
    if (w.has && !has(st, w.has)) return false;
    if (w.not && has(st, w.not)) return false;
    if (w.flag && !st.flags[w.flag]) return false;
    if (w.noflag && st.flags[w.noflag]) return false;
    if (w.minDay != null && st.day < w.minDay) return false;
    if (w.maxDay != null && st.day > w.maxDay) return false;
    if (w.minMoney != null && st.money < w.minMoney) return false;
    if (c.scripted) return !!scriptedPass && w.day === st.day && !st.seen[c.id];
    if (w.day != null && w.day !== st.day) return false;
    if (c.once !== false && st.seen[c.id]) return false;
    if (c.once === false && st.recent.includes(c.id)) return false;
    return true;
  }

  function weightOf(c) {
    if (c.w === 0) return 0;
    let w = c.w == null ? 1 : c.w;
    const wh = c.when || {};
    if (wh.job) w *= 2;
    if (wh.sc) w *= 1.5;
    return w;
  }

  function strikeCard(st) {
    const s = STRIKES[st.sc];
    return { id: 'strike', strike: true, who: s.who, text: s.text, L: s.L, R: s.R, na: s.na, kr: s.kr };
  }

  /* 재난 당일 피해 계산 (choose와 preview가 같이 쓴다) */
  function strikeFx(st, ch) {
    const s = STRIKES[st.sc];
    const fx = Object.assign({}, s.base);
    const msgs = [];
    for (const m of s.mitigate) {
      if ((m.has && has(st, m.has)) || (m.flag && st.flags[m.flag])) {
        for (const k in m.fx) fx[k] = (fx[k] || 0) + m.fx[k];
        msgs.push({ t: m.msg, ok: true });
      }
    }
    for (const k in ch.fx) fx[k] = (fx[k] || 0) + ch.fx[k];
    return { fx, msgs };
  }

  function drawCard(st) {
    if (st.over) return null;
    let card = null;
    // 하루의 첫 장: 재난 카드 → 그날의 고정(스크립트) 카드가 연결 카드보다 먼저
    if (st.day === 0 && st.slot === 0) card = strikeCard(st);
    if (!card && st.slot === 0) card = CARDS.find(c => c.scripted && eligible(st, c, true)) || null;
    if (!card && st.queue.length) card = cardById(st.queue.shift());
    if (!card) {
      const pool = CARDS.filter(c => !c.scripted && eligible(st, c)).map(c => [c, weightOf(c)]).filter(p => p[1] > 0);
      if (pool.length) {
        const total = pool.reduce((a, p) => a + p[1], 0);
        let r = st.rng() * total;
        for (const [c, w] of pool) { r -= w; if (r <= 0) { card = c; break; } }
        if (!card) card = pool[pool.length - 1][0];
      }
    }
    if (!card) card = FILLERS.find(c => c.when.phase === phaseOf(st));
    st.current = card;
    return card;
  }

  /* cond 항목: 문자열 has/not/job/flag 는 "조건", 나머지(배열 flag 포함)는 "결과" */
  function condMatches(st, c) {
    if (c.has && !has(st, c.has)) return false;
    if (c.not && has(st, c.not)) return false;
    if (typeof c.flag === 'string' && !st.flags[c.flag]) return false;
    if (c.job && c.job !== st.job) return false;
    return true;
  }
  function condEffect(c) {
    const e = Object.assign({}, c);
    delete e.has; delete e.not; delete e.job;
    if (typeof e.flag === 'string') delete e.flag;
    return e;
  }

  /* 선택지를 실제 결과로 확정 (돈 부족 → cond → rand) */
  function resolve(st, ch) {
    const base = ch.$ || 0;
    if (base < 0 && st.money < -base) return { fx: { mind: -3 }, msg: MSG_POOR, poor: true };
    const out = Object.assign({}, ch);
    delete out.cond; delete out.rand;
    const merge = e => {
      const flags = (out.flag || []).concat(e.flag || []);
      Object.assign(out, e);
      if (flags.length) out.flag = flags;
    };
    if (ch.cond) {
      const hit = ch.cond.find(c => condMatches(st, c));
      if (hit) merge(condEffect(hit));
    }
    if (ch.rand) {
      let r = st.rng();
      let pick = ch.rand[ch.rand.length - 1];
      for (const o of ch.rand) { r -= o.p; if (r <= 0) { pick = o; break; } }
      const e = Object.assign({}, pick); delete e.p;
      merge(e);
    }
    return out;
  }

  /* 직업 보정 적용 후 스탯 변경, 실제 변화량 반환 */
  function applyFx(st, fx) {
    const m = job(st.job).mods || {};
    const delta = {};
    for (const k of KEYS) {
      let v = (fx && fx[k]) || 0;
      if (!v) continue;
      const mod = m[k] || {};
      if (v > 0 && mod.gain) v = Math.round(v * mod.gain);
      if (v < 0 && mod.loss) v = Math.round(v * mod.loss);
      const before = st.stats[k];
      st.stats[k] = Math.max(0, Math.min(100, before + v));
      delta[k] = st.stats[k] - before;
    }
    return delta;
  }

  function spend(st, amount) {
    st.money = Math.max(0, st.money + amount);
    if (st.cash > st.money) st.cash = st.money;
  }

  function checkDeath(st) {
    const worst = KEYS.find(k => st.stats[k] <= 0) || null;
    if (worst) { st.over = true; st.death = worst; }
    return worst;
  }

  /* 재난 후 하루가 지날 때마다 소모 */
  function dailyDecay(st) {
    const d = Object.assign({ hp: 0, mind: 0, food: 0, safe: 0 }, scen(st.sc).decay);
    const extra = job(st.job).extraDecay || {};
    for (const k in extra) d[k] += extra[k];
    for (const it of ['water', 'food', 'filter', 'well', 'seeds']) if (has(st, it)) d.food -= 1;
    if (st.flags.handPump) d.food -= 1;
    if (st.flags.family) d.food += 1;
    if (has(st, 'radio')) d.mind -= 1;
    if (has(st, 'neighbors')) d.mind -= 1;
    if (has(st, 'medkit')) d.hp -= 1;
    if (has(st, 'lock') || has(st, 'guard')) d.safe -= 1;
    if (has(st, 'bunker')) { d.food -= 2; d.safe -= 2; d.mind -= 1; }
    if (has(st, 'cooler') && st.sc === 'heatwave') d.hp -= 1;
    if ((st.sc === 'blackout' || st.sc === 'heatwave') && (has(st, 'generator') || has(st, 'solar'))) d.mind -= 1;
    const fx = {};
    for (const k of KEYS) if (d[k] > 0) fx[k] = -d[k];
    return applyFx(st, fx);
  }

  function choose(st, side) {
    const card = st.current;
    if (!card || st.over) return null;
    const ch = side === 'L' ? card.L : card.R;
    const res = { side, card: card.id, strike: !!card.strike, msgs: [], delta: {}, money: 0, added: [], day: null };
    const merge = d => { for (const k in d) res.delta[k] = (res.delta[k] || 0) + d[k]; };

    if (card.strike) {
      const sf = strikeFx(st, ch);
      merge(applyFx(st, sf.fx));
      if (ch.msg) res.msgs.push({ t: ch.msg });
      res.msgs.push(...sf.msgs);
      if (scen(st.sc).cashOnly) {
        st.frozen = st.money - st.cash;
        st.money = st.cash;
        res.msgs.push({ t: MSG_CASHONLY, vars: { money: '$' + st.money.toLocaleString('en-US') } });
      }
    } else {
      const out = resolve(st, ch);
      merge(applyFx(st, out.fx));
      if (out.$) { const before = st.money; spend(st, out.$); res.money = st.money - before; }
      if (out.cash) {
        const before = st.cash;
        st.cash = Math.min(st.money, st.cash + out.cash);
        res.cashAdded = st.cash - before;
      }
      for (const it of out.add || []) if (!has(st, it)) { st.items.push(it); res.added.push(it); }
      for (const it of out.del || []) st.items = st.items.filter(x => x !== it);
      for (const f of out.flag || []) { st.flags[f] = true; if (f === 'karma') st.karma++; }
      if (out.deliver) {
        const due = st.day + out.deliver.days;
        st.pending.push({ item: out.deliver.item, day: due });
        st.flags[out.deliver.item + 'Ordered'] = true;
        res.msgs.push({ t: MSG_ORDERED, vars: { item: out.deliver.item, day: dayLabel(due) } });
      }
      if (out.msg) res.msgs.push({ t: out.msg });
      if (out.next && !out.poor) st.queue.push(out.next);
      if (card.scripted && card.when.day === -7) st.revealed = true;
    }

    st.seen[card.id] = (st.seen[card.id] || 0) + 1;
    st.recent.push(card.id);
    if (st.recent.length > RECENT) st.recent.shift();
    st.log.push({ day: st.day, card: card.id, side });
    st.current = null;
    st.revealed = st.revealed || st.day >= 0;

    if (checkDeath(st)) { res.dead = st.death; return res; }

    st.slot++;
    if (st.slot >= perDay(st)) {
      st.slot = 0;
      st.day++;
      const endDay = scen(st.sc).endDay;
      if (st.day > endDay) {
        st.over = true; st.won = true; res.won = true;
        return res;
      }
      res.day = { label: dayLabel(st.day), decay: st.day >= 1 ? dailyDecay(st) : {}, msgs: [], delivered: [] };
      for (const p of st.pending.filter(x => x.day <= st.day)) {
        if (!has(st, p.item)) { st.items.push(p.item); res.added.push(p.item); res.day.delivered.push(p.item); }
        res.day.msgs.push({ t: MSG_DELIVERED, vars: { item: p.item }, ok: true });
      }
      st.pending = st.pending.filter(x => x.day > st.day);
      if (checkDeath(st)) { res.dead = st.death; res.diedOvernight = true; }
    }
    return res;
  }

  /* 드래그 중 미리보기: 어떤 스탯이 얼마나(크기만) 변하는가 */
  function preview(st, side) {
    const card = st.current;
    if (!card) return { stats: {}, money: false };
    const ch = side === 'L' ? card.L : card.R;
    const stats = {};
    const fx = card.strike ? strikeFx(st, ch).fx : (ch.fx || {});
    for (const k of KEYS) if (fx[k]) stats[k] = Math.abs(fx[k]) >= 10 ? 2 : 1;
    if (ch.rand) for (const o of ch.rand) for (const k in (o.fx || {})) if (o.fx[k]) stats[k] = 2;
    return { stats, money: !!(ch.$ || ch.cash) };
  }

  /* 이어하기: 함수(rng)와 카드 객체를 빼고 저장, 불러올 때 다시 붙인다 */
  function serialize(st) {
    const o = Object.assign({}, st, { current: st.current ? st.current.id : null });
    delete o.rng;
    return JSON.stringify(o);
  }
  function restore(json) {
    const o = JSON.parse(json);
    if (!o || o.v !== SAVE_VERSION || !job(o.job) || !scen(o.sc) || o.over) return null;
    attachRng(o);
    o.current = o.current === 'strike' ? strikeCard(o) : (o.current ? cardById(o.current) || null : null);
    return o;
  }

  function score(st) {
    const sum = KEYS.reduce((a, k) => a + st.stats[k], 0);
    return sum + st.items.length * 3 + st.karma * 5;
  }

  function grade(st) {
    const s = score(st);
    return s >= 300 ? 'S' : s >= 240 ? 'A' : s >= 180 ? 'B' : 'C';
  }

  function epithet(st) {
    const s = st.stats;
    if (st.karma >= 4) return '동네의 영웅';
    if (KEYS.every(k => s[k] < 30)) return '간신히 살아남은 자';
    const top = KEYS.reduce((a, k) => (s[k] > s[a] ? k : a), KEYS[0]);
    return { hp: '강철 체력', mind: '흔들리지 않는 마음', food: '든든한 곳간', safe: '철벽 요새' }[top];
  }

  const API = {
    newGame, drawCard, choose, preview, dayLabel, score, grade, epithet, serialize, restore,
    job, scen, has, phaseOf, perDay, KEYS, ITEMS, REGIONS, MSG_POOR, MSG_CASHONLY, MSG_ORDERED, MSG_DELIVERED,
    EPITHETS: ['동네의 영웅', '간신히 살아남은 자', '강철 체력', '흔들리지 않는 마음', '든든한 곳간', '철벽 요새'],
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.D7 = API;
})(typeof window !== 'undefined' ? window : globalThis);
