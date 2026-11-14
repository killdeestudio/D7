/* D-7 재난 생존 — 효과음 (Web Audio로 합성, 음원 파일 없음)
 * 브라우저 정책상 첫 터치/클릭 이후에만 소리가 난다.
 */
(function (root) {
  'use strict';
  const KEY = 'd7-sound';
  let ctx = null;
  let enabled = true;
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch (e) { /* 무시 */ }

  function ac() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, opt) {
    const c = ac(); if (!c) return;
    const o = opt || {};
    const t0 = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.15, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, opt) {
    const c = ac(); if (!c) return;
    const o = opt || {};
    const t0 = c.currentTime + (o.delay || 0);
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1200, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(o.vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t0); src.stop(t0 + dur);
  }

  const SFX = {
    tap: () => tone(660, 0.05, { type: 'triangle', vol: 0.06 }),
    swipe: () => noise(0.18, { freq: 900, to: 2400, vol: 0.12 }),
    coin: () => { tone(988, 0.08, { type: 'square', vol: 0.05 }); tone(1319, 0.18, { type: 'square', vol: 0.05, delay: 0.07 }); },
    good: () => { tone(523, 0.12, { vol: 0.09 }); tone(784, 0.22, { vol: 0.09, delay: 0.08 }); },
    bad: () => tone(196, 0.3, { type: 'triangle', to: 130, vol: 0.14 }),
    day: () => { tone(523, 0.9, { vol: 0.07 }); tone(784, 0.9, { vol: 0.05, delay: 0.02 }); },
    strike: () => { noise(1.6, { filter: 'lowpass', freq: 160, to: 60, vol: 0.5 }); tone(55, 1.4, { type: 'sawtooth', to: 35, vol: 0.12 }); },
    death: () => { tone(330, 1.3, { type: 'sawtooth', to: 70, vol: 0.08 }); tone(165, 1.5, { to: 50, vol: 0.1, delay: 0.1 }); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.09, delay: i * 0.12 })),
  };

  const API = {
    play(name) { if (enabled && SFX[name]) try { SFX[name](); } catch (e) { /* 무시 */ } },
    get enabled() { return enabled; },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) { /* 무시 */ }
      if (enabled) API.play('tap');
      return enabled;
    },
    unlock() { if (enabled) ac(); },
  };
  root.D7Sound = API;
})(window);
