/* 밸런스 시뮬레이션: 무작위 / 간단한 전략으로 수천 판을 돌려 직업·재난별 생존율을 본다.
 * 실행: node tests/simulate.js [판수]
 */
const D7 = require('../www/js/engine.js');
const { JOBS, SCENARIOS } = require('../www/js/data.js');
const N = +process.argv[2] || 2000;

// 똑똑한 플레이어: 미리보기 대신 실제 결과를 복제 상태에서 계산해 가장 약한 스탯을 지키는 쪽 선택
function smartPick(st) {
  const c = st.current;
  let best = 'L', bestScore = -1e9;
  for (const side of ['L', 'R']) {
    const ch = c[side];
    const fx = Object.assign({}, c.strike ? {} : ch.fx);
    if (ch.cond) { const h = ch.cond.find(x => (!x.has || st.items.includes(x.has)) && (!x.job || x.job === st.job) && (!x.flag || st.flags[x.flag])); if (h && h.fx) Object.assign(fx, h.fx); }
    if (ch.rand) for (const o of ch.rand) for (const k in o.fx) fx[k] = (fx[k] || 0) + o.p * o.fx[k];
    let s = 0;
    for (const k of D7.KEYS) { const v = st.stats[k] + (fx[k] || 0); s += Math.min(v, 70) + (v < 25 ? (v - 25) * 3 : 0); }
    if (ch.add) s += 6 * ch.add.length;
    if (ch.$ && ch.$ < 0 && st.money < -ch.$) s -= 5;
    if (s > bestScore) { bestScore = s; best = side; }
  }
  return best;
}

function run(jobId, scId, strategy, seed) {
  const st = D7.newGame(jobId, scId, seed, process.env.REGION || 'kr');
  let guard = 0;
  while (!st.over && guard++ < 500) {
    D7.drawCard(st);
    D7.choose(st, strategy === 'random' ? (st.rng() < 0.5 ? 'L' : 'R') : smartPick(st));
  }
  if (guard >= 500) throw new Error('infinite loop');
  return st;
}

for (const strat of ['random', 'smart']) {
  console.log(`\n== ${strat} (${N}판씩) ==`);
  const header = 'job'.padEnd(10) + SCENARIOS.map(s => s.id.padStart(10)).join('') + '   주요 사망원인';
  console.log(header);
  for (const j of JOBS) {
    let line = j.id.padEnd(10);
    const deaths = {};
    for (const s of SCENARIOS) {
      let win = 0;
      for (let i = 0; i < N; i++) {
        const st = run(j.id, s.id, strat, i * 7919 + 13);
        if (st.won) win++; else deaths[st.death] = (deaths[st.death] || 0) + 1;
      }
      line += ((win / N * 100).toFixed(0) + '%').padStart(10);
    }
    console.log(line + '   ' + JSON.stringify(deaths));
  }
}
