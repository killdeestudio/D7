/* D-7 재난 생존 — 화면 */
(function () {
  'use strict';
  const { STATS, JOBS, SCENARIOS, DEATHS, ITEMS } = window.D7_DATA;
  const D7 = window.D7;
  const $ = id => document.getElementById(id);
  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  const STORE = 'd7-records-v1';

  let st = null;          // 현재 게임 상태
  let pick = { job: null, sc: 'random' };
  let armed = null;       // 버튼 1차 탭(미리보기) 상태
  let busy = false;

  /* ---------- 저장 (실패해도 게임은 진행) ---------- */
  function loadRecords() {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; }
  }
  function saveRecord(s) {
    try {
      const r = loadRecords();
      const key = s.job;
      const prev = r[key] || { plays: 0, wins: 0, best: null };
      prev.plays++;
      if (s.won) {
        prev.wins++;
        const sc = D7.score(s);
        if (!prev.best || sc > prev.best.score) prev.best = { score: sc, grade: D7.grade(s), sc: s.sc };
      }
      r[key] = prev;
      localStorage.setItem(STORE, JSON.stringify(r));
    } catch (e) { /* 무시 */ }
  }
  function renderRecords() {
    const r = loadRecords();
    const lines = JOBS.filter(j => r[j.id]).map(j => {
      const x = r[j.id];
      return `${j.icon} ${j.name} ${x.wins}/${x.plays} 생존${x.best ? ' · 최고 ' + x.best.grade : ''}`;
    });
    $('records').innerHTML = lines.length ? '<b>내 기록</b><br>' + lines.join('<br>') : '';
  }

  /* ---------- 화면 전환 ---------- */
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    if (id === 's-title') renderRecords();
  }
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go)));
  $('btn-how').addEventListener('click', () => show('s-how'));

  /* ---------- 직업/재난 선택 ---------- */
  function renderJobs() {
    $('job-list').innerHTML = JOBS.map(j => `
      <button class="pick" data-job="${j.id}">
        <div class="ic">${j.icon}</div>
        <div class="nm">${j.name} · ${j.who}<small>${money(j.money)}</small></div>
        <div class="bl">${j.blurb}</div>
        <div class="pc">${j.pros.map(p => `<div class="p">＋ ${p}</div>`).join('')}${j.cons.map(c => `<div class="c">－ ${c}</div>`).join('')}</div>
      </button>`).join('');
    $('job-list').querySelectorAll('.pick').forEach(b => b.addEventListener('click', () => {
      pick.job = b.dataset.job; renderScenarios(); show('s-sc');
    }));
  }
  function renderScenarios() {
    const rows = [{ id: 'random', icon: '❓', name: '알 수 없음 (추천)', teaser: '무엇이 올지는 D-7 뉴스로 알게 된다. 진짜 재난처럼.', endDay: null }]
      .concat(SCENARIOS);
    $('sc-list').innerHTML = rows.map(s => `
      <button class="pick${s.id === 'random' ? ' rec' : ''}" data-sc="${s.id}">
        <div class="ic">${s.icon}</div>
        <div class="nm">${s.name}${s.endDay ? `<small>D+${s.endDay}까지</small>` : ''}</div>
        <div class="bl">${s.teaser}</div>
      </button>`).join('');
    $('sc-list').querySelectorAll('.pick').forEach(b => b.addEventListener('click', () => {
      pick.sc = b.dataset.sc; startIntro();
    }));
  }

  function startIntro() {
    st = D7.newGame(pick.job, pick.sc);
    const j = D7.job(st.job), s = D7.scen(st.sc);
    $('intro-body').innerHTML = `
      <div class="big">${j.icon}</div>
      <h3>${j.who} · ${j.name}</h3>
      <div class="box"><p>${j.blurb}</p></div>
      <div class="box"><p>📺 <b>속보</b> — ${s.teaser}</p>
        <p style="margin-top:8px;color:var(--mute);font-size:14px">재난까지 7일. 가진 돈 ${money(st.money)}.
        ${s.cashOnly ? '재난이 오면 카드·계좌가 막힐 수 있다.' : ''} 상황은 <b>D+${s.endDay}</b>쯤 끝난다고 한다.</p></div>`;
    show('s-intro');
  }
  $('btn-begin').addEventListener('click', () => { buildHud(); show('s-game'); nextCard(); });

  /* ---------- HUD ---------- */
  function buildHud() {
    $('stats').innerHTML = STATS.map(s => `
      <div class="stat" id="st-${s.key}" title="${s.name}">
        <div class="fill"></div><span class="ico">${s.icon}</span><span class="val"></span><span class="dot"></span>
      </div>`).join('');
    const j = D7.job(st.job), s = D7.scen(st.sc);
    $('me').textContent = `${j.icon} ${j.who}`;
    const span = 7 + s.endDay;
    $('tl-dday').style.left = (7 / span * 100) + '%';
    renderHud();
  }
  function renderHud(delta) {
    for (const s of STATS) {
      const el = $('st-' + s.key), v = st.stats[s.key];
      el.querySelector('.fill').style.height = v + '%';
      el.querySelector('.val').textContent = v;
      el.classList.toggle('low', v <= 20);
      if (delta && delta[s.key]) {
        el.classList.remove('flash-up', 'flash-down'); void el.offsetWidth;
        el.classList.add(delta[s.key] > 0 ? 'flash-up' : 'flash-down');
      }
    }
    const s = D7.scen(st.sc);
    const pre = st.day < 0;
    $('day').innerHTML = `${D7.dayLabel(st.day)}<small>${pre ? s.short + ' 경보' : s.short + ' · D+' + s.endDay + '까지'}</small>`;
    $('money').innerHTML = pre
      ? `자산 <b>${money(st.money)}</b><br>현금 ${money(st.cash)}`
      : `${s.cashOnly ? '현금' : '자금'} <b>${money(st.money)}</b>${st.frozen > 0 ? `<br>동결 ${money(st.frozen)}` : ''}`;
    const span = 7 + s.endDay, done = st.day + 7 + st.slot / D7.perDay(st);
    $('tl-fill').style.width = Math.min(100, done / span * 100) + '%';
    renderItems();
  }
  function renderItems(added) {
    $('items').innerHTML = st.items.map(it => {
      const I = ITEMS[it];
      return `<button class="item${added && added.includes(it) ? ' new' : ''}" data-it="${it}" aria-label="${I.name}">${I.icon}</button>`;
    }).join('');
    $('items').querySelectorAll('.item').forEach(b => b.addEventListener('click', () => toast(ITEMS[b.dataset.it].icon + ' ' + ITEMS[b.dataset.it].name)));
  }
  let toastT;
  function toast(t) {
    const el = $('toast'); el.textContent = t; el.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 1600);
  }

  /* ---------- 카드 ---------- */
  const card = $('card');
  function nextCard() {
    armed = null; busy = false;
    const c = D7.drawCard(st);
    renderHud();
    $('prompt').textContent = c.text;
    $('portrait').textContent = c.who[0];
    $('who').textContent = c.who[1];
    $('btn-L').textContent = '← ' + c.L.t;
    $('btn-R').textContent = c.R.t + ' →';
    $('btn-L').classList.remove('armed'); $('btn-R').classList.remove('armed');
    $('btn-L').disabled = $('btn-R').disabled = false;
    card.style.background = c.strike ? '#f1c9b8' : '';
    card.classList.remove('anim');
    card.style.transform = ''; card.style.opacity = '';
    card.classList.remove('enter'); void card.offsetWidth; card.classList.add('enter');
    setPreview(null);
  }

  function setPreview(side) {
    const label = $('choice-label');
    const p = side ? D7.preview(st, side) : { stats: {} };
    for (const s of STATS) {
      const dot = $('st-' + s.key).querySelector('.dot');
      dot.className = 'dot' + (p.stats[s.key] ? ' on' + p.stats[s.key] : '');
    }
    $('money').classList.toggle('ping', !!p.money);
    if (side) {
      const c = st.current;
      label.textContent = side === 'L' ? c.L.t : c.R.t;
      label.className = 'choice-label ' + (side === 'L' ? 'left' : 'right');
      label.style.opacity = 1;
    } else {
      label.style.opacity = 0;
    }
  }

  // 드래그
  let drag = null;
  card.addEventListener('pointerdown', e => {
    if (busy) return;
    drag = { x: e.clientX, dx: 0, id: e.pointerId };
    card.setPointerCapture(e.pointerId);
    card.classList.remove('anim', 'enter');
  });
  card.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dx = e.clientX - drag.x;
    card.style.transform = `translateX(${drag.dx}px) rotate(${drag.dx / 18}deg)`;
    setPreview(Math.abs(drag.dx) > 24 ? (drag.dx < 0 ? 'L' : 'R') : null);
  });
  const endDrag = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = drag.dx; drag = null;
    const limit = Math.min(110, card.offsetWidth * 0.38);
    if (Math.abs(dx) > limit) commit(dx < 0 ? 'L' : 'R');
    else { card.classList.add('anim'); card.style.transform = ''; setPreview(null); }
  };
  card.addEventListener('pointerup', endDrag);
  card.addEventListener('pointercancel', endDrag);

  // 버튼: 1번 탭 = 미리보기, 2번 탭 = 확정
  ['L', 'R'].forEach(side => $('btn-' + side).addEventListener('click', () => {
    if (busy) return;
    if (armed === side) { commit(side); return; }
    armed = side;
    $('btn-L').classList.toggle('armed', side === 'L');
    $('btn-R').classList.toggle('armed', side === 'R');
    card.classList.add('anim');
    card.style.transform = `translateX(${side === 'L' ? -26 : 26}px) rotate(${side === 'L' ? -4 : 4}deg)`;
    setPreview(side);
    toast('한 번 더 누르면 확정');
  }));
  // 키보드
  document.addEventListener('keydown', e => {
    if (!$('s-game').classList.contains('active')) return;
    if (!$('result').hidden && (e.key === 'Enter' || e.key === ' ')) { $('btn-next').click(); return; }
    if (e.key === 'ArrowLeft') $('btn-L').click();
    if (e.key === 'ArrowRight') $('btn-R').click();
  });

  function commit(side) {
    if (busy) return;
    busy = true;
    $('toast').hidden = true;
    $('btn-L').disabled = $('btn-R').disabled = true;
    setPreview(null);
    card.classList.add('anim');
    card.style.transform = `translateX(${side === 'L' ? -140 : 140}%) rotate(${side === 'L' ? -24 : 24}deg)`;
    card.style.opacity = 0;
    const res = D7.choose(st, side);
    if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) { /* 무시 */ }
    setTimeout(() => after(res), 260);
  }

  function chips(delta, moneyDelta) {
    const out = [];
    for (const s of STATS) {
      const v = delta[s.key];
      if (v) out.push(`<span class="chip ${v > 0 ? 'up' : 'down'}">${s.icon} ${v > 0 ? '+' : ''}${v}</span>`);
    }
    if (moneyDelta) out.push(`<span class="chip ${moneyDelta > 0 ? 'up' : 'down'}">💵 ${moneyDelta > 0 ? '+' : '−'}${money(Math.abs(moneyDelta))}</span>`);
    return out.length ? `<div class="deltas">${out.join('')}</div>` : '';
  }

  function after(res) {
    const total = Object.assign({}, res.delta);
    if (res.day) for (const k in res.day.decay) total[k] = (total[k] || 0) + res.day.decay[k];
    renderHud(total);
    renderItems(res.added);
    if (res.won || res.dead) {
      saveRecord(st);
      setTimeout(() => ending(res), res.dead ? 650 : 300);
      return;
    }
    const parts = [];
    if (res.msgs.length) parts.push(res.msgs.map(m => `<p class="${m.startsWith('✔') ? 'ok' : ''}">${m}</p>`).join(''));
    if (res.added.length) parts.push(`<p class="ok">획득: ${res.added.map(i => ITEMS[i].icon + ' ' + ITEMS[i].name).join(', ')}</p>`);
    if (res.cashAdded) parts.push(`<p class="ok">💵 현금 ${money(res.cashAdded)} 인출 (지갑 ${money(st.cash)})</p>`);
    const showDelta = res.msgs.length || res.added.length;
    if (showDelta) parts.push(chips(res.delta, res.money));
    if (res.day) {
      const isDday = res.day.label === 'D-Day';
      const decay = chips(res.day.decay, 0);
      parts.push(`<div class="newday"><h4>${isDday ? '⚠️ ' : '🌅 '}${res.day.label}</h4>
        <p>${isDday ? '오늘이다. 준비한 만큼 버틴다.' : st.day >= 1 ? '하루가 지났다. 버티는 데만 이만큼 들었다.' : '대비할 시간이 하루 줄었다.'}</p>${decay}</div>`);
    }
    if (!parts.length) { nextCard(); return; }
    $('toast').hidden = true;
    $('result-body').innerHTML = parts.join('');
    $('result').hidden = false;
  }
  $('btn-next').addEventListener('click', () => { $('result').hidden = true; nextCard(); });

  /* ---------- 엔딩 ---------- */
  function ending(res) {
    const j = D7.job(st.job), s = D7.scen(st.sc);
    const statRow = STATS.map(x => `${x.icon} ${st.stats[x.key]}`).join(' · ');
    const items = st.items.map(i => ITEMS[i].icon).join(' ') || '없음';
    const tips = `<div class="box"><h4>실제로 도움이 되는 대비 (${s.name})</h4><ul>${s.tips.map(t => `<li>${t}</li>`).join('')}</ul></div>`;
    let head;
    if (st.won) {
      head = `
        <div class="big">🌤️</div>
        <h2>살아남았다</h2>
        <p class="sub">${s.endReason}</p>
        <div class="grade">${D7.grade(st)}</div>
        <p class="sub">“${D7.epithet(st)}” · 점수 ${D7.score(st)}</p>`;
    } else {
      const d = DEATHS[st.death];
      head = `
        <div class="big">${d.icon}</div>
        <h2>${d.title}</h2>
        <p class="sub">${d.text}</p>
        <p class="sub"><b>${D7.dayLabel(st.day)}</b>, ${j.who}(${j.name})의 ${s.name} 생존은 여기까지였다.${res.diedOvernight ? '<br>밤사이 버티지 못했다.' : ''}</p>`;
    }
    $('end-body').innerHTML = `${head}
      <div class="row"><span>${statRow}</span></div>
      <div class="row"><span>소지품 ${items}</span></div>
      ${st.karma ? `<div class="row"><span>🤝 남을 도운 횟수 ${st.karma}</span></div>` : ''}
      ${tips}
      <div class="btns">
        <button class="btn primary" id="again">같은 인물로 다시</button>
        <button class="btn ghost" id="change">다른 인물 선택</button>
      </div>`;
    $('again').addEventListener('click', () => startIntro());
    $('change').addEventListener('click', () => show('s-job'));
    show('s-end');
  }

  renderJobs();
  renderRecords();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
