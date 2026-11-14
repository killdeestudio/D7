/* D-7 재난 생존 — 화면
 * 모든 화면 문구는 t('한국어 원문')으로 쓴다. 영어는 i18n-en.js 사전에서 찾는다.
 * 지역(대한민국/북미)은 region.js가 기관 이름·단위·화폐를 바꾼다.
 */
(function () {
  'use strict';
  const { STATS, JOBS, SCENARIOS, DEATHS, ITEMS } = window.D7_DATA;
  const D7 = window.D7;
  const R = window.D7_REGION;
  const EN = window.D7_EN || {};
  const SFX = window.D7Sound || { play() {}, toggle() { return false; }, unlock() {}, enabled: false };
  const $ = id => document.getElementById(id);
  const STORE = 'd7-records-v1';
  const SAVE = 'd7-save-v2';
  const PREFS = 'd7-prefs-v1';

  /* ---------- 저장소 (실패해도 게임은 진행) ---------- */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 무시 */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } },
  };

  let prefs = (() => {
    try { const p = JSON.parse(store.get(PREFS)); if (p && p.lang && p.region) return p; } catch (e) { /* 무시 */ }
    const ko = /^ko/i.test(navigator.language || '');
    return { lang: ko ? 'ko' : 'en', region: ko ? 'kr' : 'na' };
  })();

  let st = null;
  let pick = { job: null, sc: 'random' };
  let armed = null;
  let busy = false;

  /* ---------- 번역·현지화 ---------- */
  const t = s => (prefs.lang === 'en' && EN[s] != null ? EN[s] : s);
  const regionNow = () => (st ? st.region : prefs.region);
  // 게임마다 달라지는 값: {STATE} 사는 주 이름, {GUN_WAIT} 그 주의 총기 대기·허가 일수
  function gameVars(out) {
    const place = st ? st.place : (prefs.region === 'na' ? prefs.place : null);
    const law = st ? st.gun : R.gunLaw(place);
    return out.split('{STATE}').join(R.placeName(place, prefs.lang) || R.placeName({ code: 'CA' }, prefs.lang))
      .split('{GUN_WAIT}').join(law ? law.days : 10);
  }
  function tv(s, vars) {
    let out = t(s);
    for (const k in (vars || {})) out = out.split('{' + k + '}').join(vars[k]);
    return R.localize(gameVars(out), regionNow(), prefs.lang);
  }
  const L = s => R.localize(gameVars(t(s)), regionNow(), prefs.lang);
  const money = n => R.fmtMoney(n, regionNow());
  const itemIcon = id => ITEMS[id].svg || ITEMS[id].icon;
  const itemName = id => itemIcon(id) + ' ' + t(ITEMS[id].name);
  const scenView = s => Object.assign({}, s, s[regionNow()] || {});
  function cardView(c) {
    const o = c[regionNow()] || {};
    return {
      who: o.who || c.who, text: o.text || c.text,
      L: (o.L && o.L.t) || c.L.t, R: (o.R && o.R.t) || c.R.t,
    };
  }
  function msgText(m) {
    const vars = Object.assign({}, m.vars);
    if (vars.item) vars.item = itemName(vars.item);
    return tv(m.t, vars);
  }

  function applyStatic() {
    document.documentElement.lang = prefs.lang;
    document.title = t('D-7 재난 생존');
    document.querySelectorAll('[data-i18n]').forEach(el => {
      if (el.dataset.ko == null) el.dataset.ko = el.innerHTML.trim();
      el.innerHTML = L(el.dataset.ko);
    });
    document.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === prefs.lang));
    document.querySelectorAll('[data-region]').forEach(b => {
      b.textContent = R.REGIONS[b.dataset.region].flag + ' ' + t(R.REGIONS[b.dataset.region].name);
      b.classList.toggle('on', b.dataset.region === prefs.region);
    });
    const snd = SFX.enabled ? '🔊' : '🔇';
    $('btn-sound').textContent = snd;
    $('btn-sound-title').textContent = snd + ' ' + (SFX.enabled ? t('켜짐') : t('꺼짐'));
    const place = prefs.region === 'na' && prefs.place ? prefs.place : null;
    $('place-line').textContent = place ? '📍 ' + R.placeName(place, prefs.lang) + ' ' + (place.postal || '') : '';
    renderRecords();
    renderResume();
    renderJobs();
  }
  function savePrefs() { store.set(PREFS, JSON.stringify(prefs)); applyStatic(); }
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => { prefs.lang = b.dataset.lang; SFX.play('tap'); savePrefs(); }));
  document.querySelectorAll('[data-region]').forEach(b => b.addEventListener('click', () => { prefs.region = b.dataset.region; SFX.play('tap'); savePrefs(); }));
  const toggleSound = () => { SFX.toggle(); applyStatic(); };
  $('btn-sound-title').addEventListener('click', toggleSound);
  $('btn-sound').addEventListener('click', toggleSound);
  document.addEventListener('pointerdown', () => SFX.unlock(), { once: true });

  /* ---------- 기록 ---------- */
  function loadRecords() {
    try { return JSON.parse(store.get(STORE)) || {}; } catch (e) { return {}; }
  }
  function saveRecord(s) {
    const r = loadRecords();
    const prev = r[s.job] || { plays: 0, wins: 0, best: null };
    prev.plays++;
    if (s.won) {
      prev.wins++;
      const sc = D7.score(s);
      if (!prev.best || sc > prev.best.score) prev.best = { score: sc, grade: D7.grade(s), sc: s.sc };
    }
    r[s.job] = prev;
    store.set(STORE, JSON.stringify(r));
  }
  function renderRecords() {
    const r = loadRecords();
    const lines = JOBS.filter(j => r[j.id]).map(j => {
      const x = r[j.id];
      return `${j.icon} ${t(j.name)} ${tv('{w}/{p} 생존', { w: x.wins, p: x.plays })}${x.best ? ' · ' + tv('최고 {g}', { g: x.best.grade }) : ''}`;
    });
    $('records').innerHTML = lines.length ? '<b>' + t('내 기록') + '</b><br>' + lines.join('<br>') : '';
  }

  /* ---------- 이어하기 ---------- */
  const saveGame = () => { if (st && !st.over) store.set(SAVE, D7.serialize(st)); };
  const clearSave = () => store.del(SAVE);
  function loadSave() {
    const raw = store.get(SAVE);
    if (!raw) return null;
    try { return D7.restore(raw); } catch (e) { return null; }
  }
  function renderResume() {
    const s = loadSave();
    const b = $('btn-resume');
    b.hidden = !s;
    if (s) {
      const j = D7.job(s.job);
      b.textContent = `${t('이어하기')} · ${j.icon} ${t(j.who)} · ${D7.dayLabel(s.day)}`;
    }
  }
  $('btn-resume').addEventListener('click', () => {
    const s = loadSave();
    if (!s) { renderResume(); return; }
    st = s;
    pick = { job: s.job, sc: s.pickSc || s.sc };
    buildHud(); show('s-game');
    if (st.current) renderCard(st.current); else nextCard();
  });

  /* ---------- 화면 전환 ---------- */
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    if (id === 's-title') { renderRecords(); renderResume(); }
  }
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { SFX.play('tap'); show(b.dataset.go); }));
  $('btn-how').addEventListener('click', () => { SFX.play('tap'); show('s-how'); });
  $('btn-start').addEventListener('click', () => {
    SFX.play('tap'); st = null;
    if (prefs.region === 'na') { openZip(); return; }
    renderJobs(); show('s-job');
  });

  /* ---------- 북미: 우편번호 ---------- */
  function lawText(law) {
    if (!law) return '';
    if (law.kind === 'wait') return tv('총기: 신원조회 후 {n}일 대기', { n: law.days });
    if (law.kind === 'permit') return tv('총기: 구매 허가증 필요 (약 {n}일)', { n: law.days });
    if (law.kind === 'banned') return t('총기: 권총 구매 불가 (캐나다)');
    return t('총기: 대기 기간 없음');
  }
  function zipPreview() {
    const place = R.placeFromPostal($('zip-input').value);
    const out = $('zip-result');
    if (!$('zip-input').value.trim()) { out.textContent = ''; return null; }
    out.classList.toggle('bad', !place);
    out.textContent = place ? '📍 ' + R.placeName(place, prefs.lang) + ' · ' + lawText(R.gunLaw(place)) : t('알 수 없는 우편번호예요. 미국 5자리 또는 캐나다 A1A 형식으로 넣어주세요.');
    return place;
  }
  function openZip() {
    $('zip-input').value = prefs.place && prefs.place.postal ? prefs.place.postal : '';
    zipPreview(); show('s-zip');
    setTimeout(() => { try { $('zip-input').focus(); } catch (e) { /* 무시 */ } }, 50);
  }
  $('zip-input').addEventListener('input', zipPreview);
  $('zip-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-zip-ok').click(); });
  $('btn-zip-ok').addEventListener('click', () => {
    const place = zipPreview();
    if (!place) { SFX.play('bad'); $('zip-input').focus(); return; }
    SFX.play('tap'); prefs.place = place; savePrefs(); renderJobs(); show('s-job');
  });
  $('btn-zip-skip').addEventListener('click', () => {
    SFX.play('tap'); prefs.place = { code: 'CA', country: 'US', postal: '' }; savePrefs(); renderJobs(); show('s-job');
  });
  $('btn-menu').addEventListener('click', () => { saveGame(); st = null; applyStatic(); show('s-title'); toast(t('저장했습니다. 이어하기로 돌아올 수 있어요.')); });

  /* ---------- 직업/재난 선택 ---------- */
  function renderJobs() {
    $('job-list').innerHTML = JOBS.map(j => `
      <button class="pick" data-job="${j.id}">
        <div class="ic">${j.icon}</div>
        <div class="nm">${t(j.name)} · ${t(j.who)}<small>${money(j.money)}</small></div>
        <div class="bl">${L(j.blurb)}</div>
        <div class="pc">${j.pros.map(p => `<div class="p">＋ ${L(p)}</div>`).join('')}${j.cons.map(c => `<div class="c">－ ${L(c)}</div>`).join('')}${((j.regionItems || {})[prefs.region] || []).filter(i => !(i === 'gun' && prefs.place && prefs.place.country === 'CA')).map(i => `<div class="p">＋ ${itemName(i)}</div>`).join('')}</div>
      </button>`).join('');
    $('job-list').querySelectorAll('.pick').forEach(b => b.addEventListener('click', () => {
      SFX.play('tap'); pick.job = b.dataset.job; renderScenarios(); show('s-sc');
    }));
  }
  function renderScenarios() {
    const rows = [{ id: 'random', icon: '❓', name: '알 수 없음 (추천)', teaser: '무엇이 올지는 D-7 뉴스로 알게 된다. 진짜 재난처럼.', endDay: null }]
      .concat(SCENARIOS.map(scenView));
    const local = R.hazards(prefs.region, prefs.region === 'na' ? prefs.place : null);
    $('sc-list').innerHTML = rows.map(s => `
      <button class="pick${s.id === 'random' ? ' rec' : ''}" data-sc="${s.id}">
        <div class="ic">${s.icon}</div>
        <div class="nm"><span>${L(s.name)}${local.includes(s.id) ? ` <span class="tag">${t('이 지역 주의')}</span>` : ''}</span>${s.endDay ? `<small>${tv('D+{n}까지', { n: s.endDay })}</small>` : ''}</div>
        <div class="bl">${L(s.teaser)}</div>
      </button>`).join('');
    $('sc-list').querySelectorAll('.pick').forEach(b => b.addEventListener('click', () => {
      SFX.play('tap'); pick.sc = b.dataset.sc; startIntro();
    }));
  }

  function startIntro() {
    st = D7.newGame(pick.job, pick.sc, null, prefs.region, prefs.region === 'na' ? prefs.place : null);
    if (st.place && st.place.country === 'CA') st.items = st.items.filter(i => i !== 'gun' && i !== 'gunsafe');
    const j = D7.job(st.job), s = scenView(D7.scen(st.sc));
    const news = st.revealed
      ? `<p>📺 <b>${t('속보')}</b> — ${L(s.teaser)}</p>
         <p class="note">${tv('재난까지 7일. 가진 돈 {money}.', { money: money(st.money) })}
         ${s.cashOnly ? t('재난이 오면 카드·계좌가 막힐 수 있다.') : ''} ${tv('상황은 <b>D+{n}</b>쯤 끝난다고 한다.', { n: s.endDay })}</p>`
      : `<p>📺 <b>${t('속보')}</b> — ${t('무언가 다가오고 있다. 아직 무엇인지는 모른다.')}</p>
         <p class="note">${tv('재난까지 7일. 가진 돈 {money}.', { money: money(st.money) })} ${t('카드가 막힐 수 있으니 현금도 생각해두자.')}</p>`;
    $('intro-body').innerHTML = `
      <div class="big">${j.icon}</div>
      <h3>${t(j.who)} · ${t(j.name)}</h3>
      <div class="box"><p>${L(j.blurb)}</p></div>
      ${st.place ? `<div class="box"><p>📍 <b>${R.placeName(st.place, prefs.lang)}</b> ${st.place.postal || ''}</p><p class="note">${lawText(st.gun)}</p></div>` : ''}
      <div class="box">${news}</div>`;
    show('s-intro');
  }
  $('btn-begin').addEventListener('click', () => { SFX.play('tap'); buildHud(); show('s-game'); nextCard(); });

  /* ---------- HUD ---------- */
  function buildHud() {
    $('stats').innerHTML = STATS.map(s => `
      <div class="stat" id="st-${s.key}" title="${t(s.name)}">
        <div class="fill"></div><span class="ico">${s.icon}</span><span class="val"></span><span class="dot"></span>
      </div>`).join('');
    const j = D7.job(st.job);
    $('me').textContent = `${j.icon} ${t(j.who)}`;
    renderHud();
  }
  function renderHud(delta, added) {
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
    const s = scenView(D7.scen(st.sc));
    const pre = st.day < 0;
    const sub = !st.revealed ? t('정체불명의 경보')
      : pre ? tv('{sc} 경보', { sc: L(s.short) }) : tv('{sc} · D+{n}까지', { sc: L(s.short), n: s.endDay });
    $('day').innerHTML = `${D7.dayLabel(st.day)}<small>${sub}</small>`;
    $('money').innerHTML = pre
      ? `${t('자산')} <b>${money(st.money)}</b><br>${t('현금')} ${money(st.cash)}`
      : `${s.cashOnly ? t('현금') : t('자금')} <b>${money(st.money)}</b>${st.frozen > 0 ? `<br>${t('동결')} ${money(st.frozen)}` : ''}`;
    const span = 7 + (st.revealed ? s.endDay : 14);
    $('tl-dday').style.left = (7 / span * 100) + '%';
    const done = st.day + 7 + st.slot / D7.perDay(st);
    $('tl-fill').style.width = Math.min(100, done / span * 100) + '%';
    renderItems(added);
  }
  function renderItems(added) {
    $('items').innerHTML = st.items.map(it => `<button class="item${added && added.includes(it) ? ' new' : ''}" data-it="${it}" aria-label="${t(ITEMS[it].name)}">${itemIcon(it)}</button>`).join('');
    $('items').querySelectorAll('.item').forEach(b => b.addEventListener('click', () => toast(itemName(b.dataset.it))));
  }
  let toastT;
  function toast(text) {
    const el = $('toast'); el.innerHTML = text; el.hidden = false;
    el.parentElement.classList.contains('active') || document.querySelector('.screen.active').appendChild(el);
    clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 1800);
  }

  /* ---------- 카드 ---------- */
  const card = $('card');
  function disarm() {
    armed = null;
    $('btn-L').classList.remove('armed'); $('btn-R').classList.remove('armed');
  }
  function nextCard() {
    renderCard(D7.drawCard(st));
    saveGame();
  }
  function renderCard(c) {
    disarm(); busy = false;
    const v = cardView(c);
    renderHud();
    $('prompt').textContent = L(v.text);
    $('portrait').textContent = v.who[0];
    $('who').textContent = L(v.who[1]);
    $('btn-L').textContent = '← ' + L(v.L);
    $('btn-R').textContent = L(v.R) + ' →';
    $('btn-L').disabled = $('btn-R').disabled = false;
    card.classList.toggle('strike', !!c.strike);
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
      const v = cardView(st.current);
      label.textContent = L(side === 'L' ? v.L : v.R);
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
    disarm();
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
    SFX.play('tap');
    toast(t('한 번 더 누르면 확정'));
  }));
  // 키보드 (버튼에 포커스가 있으면 브라우저 기본 동작에 맡겨 두 번 눌리지 않게)
  document.addEventListener('keydown', e => {
    if (!$('s-game').classList.contains('active') || e.repeat) return;
    const onButton = e.target && e.target.tagName === 'BUTTON';
    if (!$('result').hidden && (e.key === 'Enter' || e.key === ' ')) {
      if (!onButton) { e.preventDefault(); $('btn-next').click(); }
      return;
    }
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
    SFX.play('swipe');
    if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) { /* 무시 */ }
    if (st.over) clearSave(); else saveGame();
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

  function playFor(res) {
    if (res.dead) return SFX.play('death');
    if (res.won) return SFX.play('win');
    if (res.strike) return SFX.play('strike');
    if (res.money < 0) SFX.play('coin');
    const net = Object.values(res.delta).reduce((a, b) => a + b, 0);
    if (net >= 6) SFX.play('good'); else if (net <= -6) SFX.play('bad');
    if (res.day) setTimeout(() => SFX.play('day'), 350);
  }

  function after(res) {
    const total = Object.assign({}, res.delta);
    if (res.day) for (const k in res.day.decay) total[k] = (total[k] || 0) + res.day.decay[k];
    renderHud(total, res.added);
    playFor(res);
    if (res.won || res.dead) {
      saveRecord(st);
      setTimeout(() => ending(res), res.dead ? 650 : 300);
      return;
    }
    const parts = [];
    if (res.msgs.length) parts.push(res.msgs.map(m => `<p class="${m.ok ? 'ok' : ''}">${m.ok ? '✔ ' : ''}${msgText(m)}</p>`).join(''));
    const bought = res.added.filter(i => !(res.day && res.day.delivered.includes(i)));
    if (bought.length) parts.push(`<p class="ok">${t('획득')}: ${bought.map(itemName).join(', ')}</p>`);
    if (res.cashAdded) parts.push(`<p class="ok">💵 ${tv('현금 {a} 인출 (지갑 {b})', { a: money(res.cashAdded), b: money(st.cash) })}</p>`);
    if (res.msgs.length || bought.length) parts.push(chips(res.delta, res.money));
    if (res.day) {
      const isDday = res.day.label === 'D-Day';
      const note = isDday ? t('오늘이다. 준비한 만큼 버틴다.') : st.day >= 1 ? t('하루가 지났다. 버티는 데만 이만큼 들었다.') : t('대비할 시간이 하루 줄었다.');
      parts.push(`<div class="newday"><h4>${isDday ? '⚠️ ' : '🌅 '}${res.day.label}</h4><p>${note}</p>
        ${res.day.msgs.map(m => `<p class="ok">${msgText(m)}</p>`).join('')}${chips(res.day.decay, 0)}</div>`);
    }
    if (!parts.length) { nextCard(); return; }
    $('toast').hidden = true;
    $('result-body').innerHTML = parts.join('');
    $('result').hidden = false;
  }
  $('btn-next').addEventListener('click', () => {
    if ($('result').hidden) return;
    $('result').hidden = true;
    SFX.play('tap');
    nextCard();
  });

  /* ---------- 엔딩 ---------- */
  function ending(res) {
    const j = D7.job(st.job), s = scenView(D7.scen(st.sc));
    const statRow = STATS.map(x => `${x.icon} ${st.stats[x.key]}`).join(' · ');
    const items = st.items.map(itemIcon).join(' ') || t('없음');
    const tips = `<div class="box"><h4>${tv('실제로 도움이 되는 대비 ({sc})', { sc: L(s.name) })}</h4><ul>${s.tips.map(x => `<li>${L(x)}</li>`).join('')}</ul></div>`;
    let head;
    if (st.won) {
      head = `
        <div class="big">🌤️</div>
        <h2>${t('살아남았다')}</h2>
        <p class="sub">${L(s.endReason)}</p>
        <div class="grade">${D7.grade(st)}</div>
        <p class="sub">“${t(D7.epithet(st))}” · ${tv('점수 {n}', { n: D7.score(st) })}</p>`;
    } else {
      const d = DEATHS[st.death];
      head = `
        <div class="big">${d.icon}</div>
        <h2>${t(d.title)}</h2>
        <p class="sub">${t(d.text)}</p>
        <p class="sub">${tv('<b>{day}</b>, {who}({job})의 {sc} 생존은 여기까지였다.', { day: D7.dayLabel(st.day), who: t(j.who), job: t(j.name), sc: L(s.name) })}${res.diedOvernight ? '<br>' + t('밤사이 버티지 못했다.') : ''}</p>`;
    }
    $('end-body').innerHTML = `${head}
      <div class="row"><span>${statRow}</span></div>
      <div class="row"><span>${t('소지품')} ${items}</span></div>
      ${st.karma ? `<div class="row"><span>🤝 ${tv('남을 도운 횟수 {n}', { n: st.karma })}</span></div>` : ''}
      ${tips}
      <div class="btns">
        <button class="btn primary" id="again">${t('같은 인물로 다시')}</button>
        <button class="btn ghost" id="change">${t('다른 인물 선택')}</button>
        <button class="btn ghost" id="home">${t('처음으로')}</button>
      </div>`;
    $('again').addEventListener('click', () => { SFX.play('tap'); st = null; startIntro(); });
    $('change').addEventListener('click', () => { SFX.play('tap'); st = null; renderJobs(); show('s-job'); });
    $('home').addEventListener('click', () => { SFX.play('tap'); st = null; applyStatic(); show('s-title'); });
    show('s-end');
  }

  applyStatic();

  /* ---------- 앱(안드로이드·iOS) ---------- */
  const Cap = window.Capacitor;
  const native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
  if (native && Cap.Plugins && Cap.Plugins.App) {
    const App = Cap.Plugins.App;
    // 안드로이드 뒤로 가기: 게임 중이면 저장하고 처음 화면으로, 처음 화면이면 앱 종료
    App.addListener('backButton', () => {
      const cur = document.querySelector('.screen.active');
      const id = cur ? cur.id : 's-title';
      if (id === 's-title') { App.exitApp(); return; }
      if (id === 's-game') { if (!$('result').hidden) return; $('btn-menu').click(); return; }
      if (id === 's-sc') { show('s-job'); return; }
      if (id === 's-intro') { st = null; show('s-sc'); return; }
      st = null; applyStatic(); show('s-title');
    });
    App.addListener('pause', saveGame);
  } else if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
