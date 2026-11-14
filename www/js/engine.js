/* D-7 재난 생존 — 게임 엔진 (화면과 분리된 순수 로직, Node에서도 테스트 가능) */
(function (root) {
  'use strict';
  const DATA = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.D7_DATA;
  const { STATS, JOBS, SCENARIOS, STRIKES, CARDS, FILLERS, ITEMS } = DATA;
  const KEYS = STATS.map(s => s.key);
  const PRE_PER_DAY = 3;
  const RECENT = 6;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const job = id => JOBS.find(j => j.id === id);
  const scen = id => SCENARIOS.find(s => s.id === id);
  const cardById = id => CARDS.find(c => c.id === id) || FILLERS.find(c => c.id === id);

  function newGame(jobId, scenarioId, seed) {
    const rng = mulberry32(seed == null ? (Date.now() ^ (Math.random() * 1e9)) : seed);
    const sid = scenarioId === 'random' || !scenarioId
      ? SCENARIOS[Math.floor(rng() * SCENARIOS.length)].id : scenarioId;
    const j = job(jobId);
    if (!j || !scen(sid)) throw new Error('unknown job/scenario');
    return {
      rng, job: j.id, sc: sid,
      day: -7, slot: 0,
      stats: Object.assign({}, j.stats),
      money: j.money, cash: 0, frozen: 0,
      items: j.items.slice(),
      flags: {}, karma: 0,
      seen: {}, recent: [], queue: [],
      current: null, over: false, won: false, death: null,
      log: [],
    };
  }

  const dayLabel = d => (d < 0 ? 'D' + d : d === 0 ? 'D-Day' : 'D+' + d);
  const phaseOf = st => (st.day < 0 ? 'pre' : 'post');
  const perDay = st => (st.day < 0 ? PRE_PER_DAY : st.day === 0 ? 3 : scen(st.sc).perDay);
  const has = (st, it) => st.items.includes(it);

  function eligible(st, c, scriptedPass) {
    const w = c.when || {};
    if (w.phase && w.phase !== phaseOf(st)) return false;
    if (w.sc && !w.sc.includes(st.sc)) return false;
    if (w.notSc && w.notSc.includes(st.sc)) return false;
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
    return { id: 'strike', strike: true, who: s.who, text: s.text, L: s.L, R: s.R };
  }

  function drawCard(st) {
    if (st.over) return null;
    let card = null;
    if (st.queue.length) card = cardById(st.queue.shift());
    if (!card && st.day === 0 && st.slot === 0) card = strikeCard(st);
    if (!card && st.slot === 0) card = CARDS.find(c => c.scripted && eligible(st, c, true));
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

  function matches(st, c) {
    if (c.has && !has(st, c.has)) return false;
    if (c.not && has(st, c.not)) return false;
    if (c.flag && !st.flags[c.flag]) return false;
    if (c.job && c.job !== st.job) return false;
    return true;
  }

  /* 선택지를 실제 결과로 확정 (cond → rand → 돈 부족 처리) */
  function resolve(st, ch) {
    const base = ch.$ || 0;
    if (base < 0 && st.money < -base) {
      return { fx: { mind: -3 }, $: 0, msg: '돈이 모자라 아무것도 사지 못했다.', poor: true };
    }
    let out = Object.assign({}, ch);
    delete out.cond; delete out.rand;
    if (ch.cond) {
      const hit = ch.cond.find(c => matches(st, c));
      if (hit) { out = Object.assign(out, hit); delete out.has; delete out.job; delete out.flag; delete out.not; }
    }
    if (ch.rand) {
      let r = st.rng();
      let pick = ch.rand[ch.rand.length - 1];
      for (const o of ch.rand) { r -= o.p; if (r <= 0) { pick = o; break; } }
      out = Object.assign(out, pick); delete out.p;
    }
    // cond/rand가 flag를 문자열로 덮어쓴 경우 대비
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
    let worst = null;
    for (const k of KEYS) if (st.stats[k] <= 0 && !worst) worst = k;
    if (worst) { st.over = true; st.death = worst; }
    return worst;
  }

  /* 재난 후 하루가 지날 때마다 소모 */
  function dailyDecay(st) {
    const d = Object.assign({ hp: 0, mind: 0, food: 0, safe: 0 }, scen(st.sc).decay);
    for (const it of ['water', 'food', 'filter', 'well', 'seeds']) if (has(st, it)) d.food -= 1;
    if (st.flags.handPump) d.food -= 1;
    if (st.flags.family) d.food += 1;
    if (has(st, 'radio')) d.mind -= 1;
    if (has(st, 'neighbors')) d.mind -= 1;
    if (has(st, 'medkit')) d.hp -= 1;
    if (has(st, 'lock') || has(st, 'guard')) d.safe -= 1;
    if (has(st, 'bunker')) { d.food -= 2; d.safe -= 2; d.mind -= 1; }
    if (st.sc === 'blackout' && (has(st, 'generator') || has(st, 'solar'))) d.mind -= 1;
    const fx = {};
    for (const k of KEYS) if (d[k] > 0) fx[k] = -d[k];
    return applyFx(st, fx);
  }

  function choose(st, side) {
    const card = st.current;
    if (!card || st.over) return null;
    const ch = side === 'L' ? card.L : card.R;
    const res = { side, card: card.id, msgs: [], delta: {}, money: 0, added: [], day: null };
    const merge = d => { for (const k in d) res.delta[k] = (res.delta[k] || 0) + d[k]; };

    if (card.strike) {
      const s = STRIKES[st.sc];
      const fx = Object.assign({}, s.base);
      for (const m of s.mitigate) {
        if ((m.has && has(st, m.has)) || (m.flag && st.flags[m.flag])) {
          for (const k in m.fx) fx[k] = (fx[k] || 0) + m.fx[k];
          res.msgs.push('✔ ' + m.msg);
        }
      }
      for (const k in ch.fx) fx[k] = (fx[k] || 0) + ch.fx[k];
      merge(applyFx(st, fx));
      if (ch.msg) res.msgs.unshift(ch.msg);
      if (scen(st.sc).cashOnly) {
        st.frozen = st.money - st.cash;
        st.money = st.cash;
        res.msgs.push('💳 결제망 마비 — 이제 현금 $' + st.money.toLocaleString('en-US') + '만 쓸 수 있다');
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
      if (out.msg) res.msgs.push(out.msg);
      if (out.next && !out.poor) st.queue.push(out.next);
    }

    st.seen[card.id] = (st.seen[card.id] || 0) + 1;
    st.recent.push(card.id);
    if (st.recent.length > RECENT) st.recent.shift();
    st.log.push({ day: st.day, card: card.id, side });
    st.current = null;

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
      res.day = { label: dayLabel(st.day), decay: st.day >= 1 ? dailyDecay(st) : {} };
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
    const fx = card.strike ? Object.assign({}, STRIKES[st.sc].base, ch.fx) : (ch.fx || {});
    for (const k of KEYS) if (fx[k]) stats[k] = Math.abs(fx[k]) >= 10 ? 2 : 1;
    if (ch.rand) for (const o of ch.rand) for (const k in (o.fx || {})) if (o.fx[k]) stats[k] = 2;
    return { stats, money: !!(ch.$ || ch.cash) };
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
    newGame, drawCard, choose, preview, dayLabel, score, grade, epithet,
    job, scen, has, phaseOf, perDay, mulberry32, KEYS, ITEMS,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.D7 = API;
})(typeof window !== 'undefined' ? window : globalThis);
