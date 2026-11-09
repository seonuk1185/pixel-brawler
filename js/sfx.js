// =====================================================================
//  효과음 (sfx.js, 2026-11-07, 형님 「효과음 먼저, BGM 중간, 목소리 마지막」)
//  - 소리 파일 없이 브라우저 소리 장치(Web Audio)로 그 자리에서 만든 옛날 게임기(칩튠) 소리.
//    삐 소리(오실레이터) + 쉬익 소리(잡음) + 커졌다 작아지는 모양(엔벨로프) + 간단한 거르개(필터)
//  - 쓰기: SFX.play('hit') / SFX.play('multiKill', { n: 8 }) / SFX.play('pop', { v: 0.6 })  (opts.v = 크기 배율, opts.k = 높이 배율)
//  - 크기·제한 수치 = config.js audio. 소리 끄기 = 오른쪽 위 스피커 버튼 · PC M 키(브라우저에 저장)
//  - 섞기: 소리마다 → 효과음 크기(sfx) → 누르개(컴프레서: 몹이 한꺼번에 맞아도 안 터지게) → 전체 크기(master) → 스피커
//    소리마다 동시에 나는 수(cap)와 다시 날 때까지 최소 간격(gap ms)을 둠 + 전체 동시 소리 수(maxVoices)
//  - 폰: 처음 화면을 누르거나 키를 누를 때 소리 장치를 깨움(브라우저 규칙). 탭을 숨기면 멈춤
// =====================================================================
(function () {
  var CFG = window.CFG || {}, AU = CFG.audio || {};
  var SAVE = 'pixelBrawler.muted';
  var ac = null, bus = null, master = null, comp = null;
  var muted = false;
  try { muted = localStorage.getItem(SAVE) === '1'; } catch (e) {}
  if (AU.on === false) muted = true;

  // ---------- 소리 만드는 도구 (x = 소리 장치, out = 보낼 곳, t = 시작 시각(초), k = 높이 배율) ----------
  // 잡음(쉬익) 1초짜리: 소리 장치마다 한 번 만들어 계속 씀(시작 자리를 매번 다르게)
  function noiseBuf(x) {
    if (x.__nb) return x.__nb;
    var n = Math.floor(x.sampleRate * 1), b = x.createBuffer(1, n, x.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    x.__nb = b;
    return b;
  }
  // 커졌다 작아지는 모양: a 초 동안 v 까지 → d 초에 거의 0
  function env(g, t, v, a, d, hold) {
    var G = g.gain;
    G.setValueAtTime(0.0001, t);
    G.linearRampToValueAtTime(v, t + a);
    if (hold) G.setValueAtTime(v, t + a + hold);
    G.exponentialRampToValueAtTime(0.0001, t + d);
  }
  function ramp(P, t, f0, f1, d, lin) {
    P.setValueAtTime(f0, t);
    if (f1 != null && f1 !== f0) { if (lin) P.linearRampToValueAtTime(f1, t + d); else P.exponentialRampToValueAtTime(Math.max(1, f1), t + d); }
  }
  // 삐 소리: o = { w: 파형(square·triangle·sawtooth·sine), f: 시작 높이(Hz), f2: 끝 높이, fd: 높이 바뀌는 시간, d: 길이, v: 크기, a: 커지는 시간, at: 늦게 시작, lp: 거르개 높이, hold: 버팀 }
  function tone(x, out, t, k, o) {
    var t0 = t + (o.at || 0), d = o.d || 0.1;
    var s = x.createOscillator(), g = x.createGain();
    s.type = o.w || 'square';
    ramp(s.frequency, t0, o.f * k, o.f2 != null ? o.f2 * k : null, o.fd || d, o.lin);
    env(g, t0, o.v || 0.1, o.a || 0.003, d, o.hold);
    var last = s;
    if (o.lp) { var f = x.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || 0.7; s.connect(f); last = f; }
    last.connect(g); g.connect(out);
    s.start(t0); s.stop(t0 + d + 0.03);
  }
  // 쉬익 소리: o = { ft: 거르개 종류(bandpass·lowpass·highpass), f·f2: 거르개 높이(처음→끝), q, d, v, a, at, rate: 재생 빠르기 }
  function noise(x, out, t, k, o) {
    var t0 = t + (o.at || 0), d = o.d || 0.1, nb = noiseBuf(x);
    var s = x.createBufferSource(), f = x.createBiquadFilter(), g = x.createGain();
    s.buffer = nb; s.loop = true;
    if (o.rate) s.playbackRate.value = o.rate;
    f.type = o.ft || 'bandpass'; f.Q.value = o.q != null ? o.q : 1;
    ramp(f.frequency, t0, (o.f || 1000) * k, o.f2 != null ? o.f2 * k : null, o.fd || d);
    env(g, t0, o.v || 0.2, o.a || 0.002, d, o.hold);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t0, Math.random() * 0.8); s.stop(t0 + d + 0.03);
  }
  // 음 이름 → 높이(Hz). 'C5' 'E6' 'G#4'
  var NOTE = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };
  function hz(n) { var m = /^([A-G]#?)(\d)$/.exec(n); return 440 * Math.pow(2, (NOTE[m[1]] + (+m[2] - 4) * 12) / 12); }
  // 짧은 가락: notes = ['C5','E5',...], step = 음 사이 초, o = 음 하나 모양
  function arp(x, out, t, k, notes, step, o) {
    notes.forEach(function (n, i) {
      if (!n) return;
      var q = {}; for (var kk in o) q[kk] = o[kk];
      q.f = hz(n); q.at = (o.at || 0) + i * step;
      if (i === notes.length - 1 && o.lastD) q.d = o.lastD;
      tone(x, out, t, k, q);
    });
  }

  // ---------- 소리 목록 ----------
  // cap = 동시에 나는 수, gap = 같은 소리 최소 간격(ms), vary = 높이 흔들림(±, 같은 소리가 기계처럼 안 들리게), p = 전체 동시 수 제한을 안 받음(중요한 소리)
  var S = {};
  function def(name, o, fn) { o.fn = fn; S[name] = o; }

  // 휘두르기(직업마다): 맨손 = 짧은 바람 / 검 = 날카로운 바람 / 지팡이 = 낮은 바람 + 반짝
  def('swingFist', { cap: 3, gap: 45, vary: 0.12 }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'bandpass', f: 1400, f2: 600, q: 1.4, d: 0.09, v: 0.5 });
  });
  // 2026-11-06 형님: 칼 소리가 어색(얇은 「칙」+「삐」) → 「휙~」 바람 가르는 소리: 낮은 데서 높이 쓸어 올라가는 바람 + 내려오는 꼬리 + 아주 작은 쇳바람. 삐 소리 뺌
  def('swingSword', { cap: 3, gap: 45, vary: 0.1 }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'bandpass', f: 520, f2: 2300, fd: 0.08, q: 0.7, d: 0.17, v: 0.55, a: 0.045 });
    noise(x, o, t, k, { ft: 'bandpass', f: 2400, f2: 700, q: 0.9, d: 0.12, v: 0.3, a: 0.02, at: 0.06 });
    noise(x, o, t, k, { ft: 'highpass', f: 5000, d: 0.05, v: 0.05, a: 0.01, at: 0.04 });
  });
  def('swingStaff', { cap: 3, gap: 45, vary: 0.1 }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'bandpass', f: 900, f2: 380, q: 1.2, d: 0.16, v: 0.45, a: 0.02 });
    tone(x, o, t, k, { w: 'sine', f: 1300, f2: 1900, d: 0.09, v: 0.035, at: 0.02 });
  });
  // 큰 휘두르기: 더 길고 낮은 「후웅~」(올라가는 바람 + 긴 꼬리)
  def('swingHeavy', { cap: 2, gap: 60, vary: 0.08 }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'bandpass', f: 300, f2: 1700, fd: 0.11, q: 0.6, d: 0.26, v: 0.6, a: 0.07 });
    noise(x, o, t, k, { ft: 'bandpass', f: 1700, f2: 380, q: 0.8, d: 0.2, v: 0.32, a: 0.03, at: 0.1 });
  });
  // 암살자(2026-11-09): 단검 = 짧고 날카로운 「쉭」 / 마무리 = 「쉬익」 두 겹 / 던지기 = 「휙」 / 독 = 보글 · 「치익」 / 그림자 = 낮은 「쉬우웅」 / 연막탄 = 「펑」 + 연기
  def('swingDagger', { cap: 3, gap: 35, vary: 0.14 }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'bandpass', f: 1800, f2: 4200, fd: 0.05, q: 1.1, d: 0.08, v: 0.42, a: 0.01 });
    noise(x, o, t, k, { ft: 'highpass', f: 6000, d: 0.04, v: 0.06, a: 0.005, at: 0.02 });
  });
  def('swingDaggerHeavy', { cap: 2, gap: 60, vary: 0.08 }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'bandpass', f: 900, f2: 3600, fd: 0.09, q: 0.8, d: 0.18, v: 0.5, a: 0.03 });
    noise(x, o, t, k, { ft: 'bandpass', f: 2600, f2: 900, q: 1.0, d: 0.12, v: 0.3, a: 0.02, at: 0.08 });
  });
  def('daggerThrow', { cap: 3, gap: 45, vary: 0.12 }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'bandpass', f: 2200, f2: 800, q: 1.3, d: 0.1, v: 0.35, a: 0.01 });
    tone(x, o, t, k, { w: 'triangle', f: 900, f2: 1400, d: 0.04, v: 0.05 });
  });
  def('poison', { cap: 2, gap: 90, vary: 0.1 }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'sine', f: 260, f2: 520, d: 0.07, v: 0.12 });
    tone(x, o, t, k, { w: 'sine', f: 330, f2: 700, d: 0.06, v: 0.1, at: 0.07 });
    noise(x, o, t, k, { ft: 'highpass', f: 3500, d: 0.18, v: 0.12, a: 0.02, at: 0.03 });
  });
  def('shadow', { cap: 2, gap: 100, vary: 0.05 }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'bandpass', f: 260, f2: 900, fd: 0.12, q: 0.7, d: 0.3, v: 0.45, a: 0.05 });
    tone(x, o, t, k, { w: 'sawtooth', f: 90, f2: 55, d: 0.26, v: 0.08, lp: 600 });
  });
  def('smoke', { cap: 2, gap: 100, vary: 0.06 }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'sine', f: 140, f2: 50, d: 0.16, v: 0.4 });
    noise(x, o, t, k, { ft: 'lowpass', f: 1400, f2: 400, d: 0.4, v: 0.4, a: 0.01 });
  });
  // 법사 평타 마법탄 쏨: 작은 「퓻」
  def('magicShot', { cap: 2, gap: 60, vary: 0.08 }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'square', f: 700, f2: 1500, d: 0.08, v: 0.045, lp: 3000 });
    noise(x, o, t, k, { ft: 'highpass', f: 3000, d: 0.06, v: 0.06 });
  });
  // 궁수 화살 쏨(2026-11-09): 시위 「팅」 + 바람 가르는 「슉」 / 힘 모아 쏨: 더 낮고 길게
  def('bowShot', { cap: 3, gap: 45, vary: 0.1 }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'triangle', f: 330, f2: 180, d: 0.07, v: 0.16 });
    noise(x, o, t, k, { ft: 'bandpass', f: 2600, f2: 900, q: 1.2, d: 0.12, v: 0.2, a: 0.01 });
  });
  def('bowHeavy', { cap: 2, gap: 80, vary: 0.06 }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'triangle', f: 220, f2: 90, d: 0.16, v: 0.24 });
    noise(x, o, t, k, { ft: 'bandpass', f: 1800, f2: 500, q: 1, d: 0.26, v: 0.3, a: 0.01 });
    tone(x, o, t, k, { w: 'sine', f: 110, f2: 45, d: 0.2, v: 0.35 });
  });
  // 맞힘: 둔탁한 「퍽」(낮은 몸통 + 짧은 딱)
  def('hit', { cap: 4, gap: 30, vary: 0.14 }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'sine', f: 170, f2: 55, d: 0.12, v: 0.55 });
    tone(x, o, t, k, { w: 'square', f: 110, f2: 60, d: 0.05, v: 0.06, lp: 900 });
    noise(x, o, t, k, { ft: 'lowpass', f: 2800, f2: 500, q: 0.8, d: 0.06, v: 0.32 });
  });
  // 마무리 타·넘어뜨림: 더 묵직하게
  def('hitHeavy', { cap: 3, gap: 45, vary: 0.1 }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'sine', f: 140, f2: 38, d: 0.24, v: 0.75 });
    tone(x, o, t, k, { w: 'square', f: 95, f2: 40, d: 0.1, v: 0.09, lp: 700 });
    noise(x, o, t, k, { ft: 'lowpass', f: 3200, f2: 300, q: 0.8, d: 0.14, v: 0.45 });
  });
  // 치명타: 「퍽」 + 위에서 「팅」
  def('crit', { cap: 2, gap: 55, vary: 0.06 }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'sine', f: 160, f2: 45, d: 0.16, v: 0.6 });
    noise(x, o, t, k, { ft: 'lowpass', f: 4000, f2: 600, d: 0.07, v: 0.35 });
    tone(x, o, t, k, { w: 'square', f: 1760, f2: 1680, d: 0.14, v: 0.055, lp: 5000 });
    tone(x, o, t, k, { w: 'triangle', f: 2637, d: 0.12, v: 0.06, at: 0.02 });
  });
  // 방패에 막힘: 「챙」
  def('block', { cap: 2, gap: 70, vary: 0.05 }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'square', f: 1480, d: 0.14, v: 0.04, lp: 6000 });
    tone(x, o, t, k, { w: 'square', f: 2217, d: 0.11, v: 0.03, lp: 6000 });
    noise(x, o, t, k, { ft: 'highpass', f: 4000, d: 0.05, v: 0.18 });
  });
  // 잡몹 쓰러져 펑
  def('pop', { cap: 4, gap: 35, vary: 0.18 }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'square', f: 520, f2: 110, d: 0.13, v: 0.07, lp: 2400 });
    noise(x, o, t, k, { ft: 'bandpass', f: 1100, f2: 300, q: 0.8, d: 0.12, v: 0.22 });
  });
  // 보스 쓰러짐: 크게 쾅 + 내려가는 소리
  def('bossDown', { cap: 1, gap: 400, p: true }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'sine', f: 90, f2: 25, d: 1.1, v: 0.9 });
    noise(x, o, t, k, { ft: 'lowpass', f: 2600, f2: 90, d: 1.2, v: 0.75 });
    tone(x, o, t, k, { w: 'sawtooth', f: 440, f2: 55, d: 0.9, v: 0.08, lp: 1400 });
  });
  // 몇 마리 잡기(5 KILL!): 올라가는 「띠링」, 마리가 많을수록 길게(5 · 8 · 12)
  def('multiKill', { cap: 1, gap: 120, p: true }, function (x, o, t, k, op) {
    var n = (op && op.n) || 3, notes = ['C6', 'E6', 'G6'];
    if (n >= 5) notes.push('C7');
    if (n >= 8) notes.push('E7');
    if (n >= 12) notes.push('G7');
    arp(x, o, t, 1, notes, 0.055, { w: 'square', d: 0.09, v: 0.05, lp: 6000, lastD: 0.28 });
    arp(x, o, t, 0.5, notes, 0.055, { w: 'triangle', d: 0.1, v: 0.08, lastD: 0.3 });
  });
  // 콤보 50 · 100 … : 짧은 두 음
  def('combo', { cap: 1, gap: 200, p: true }, function (x, o, t, k) {
    arp(x, o, t, 1, ['G6', 'D7'], 0.06, { w: 'square', d: 0.08, v: 0.045, lp: 6000, lastD: 0.18 });
    arp(x, o, t, 1, ['G5', 'D6'], 0.06, { w: 'triangle', d: 0.09, v: 0.08, lastD: 0.2 });
  });
  // 레벨업: 「빠바바밤」
  def('levelUp', { cap: 1, gap: 300, p: true }, function (x, o, t, k) {
    arp(x, o, t, 1, ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'], 0.06, { w: 'square', d: 0.08, v: 0.05, lp: 5000, lastD: 0.4 });
    arp(x, o, t, 1, ['C4', '', 'G4', '', 'C5', 'E5'], 0.06, { w: 'triangle', d: 0.12, v: 0.1, lastD: 0.45 });
  });
  // 음식 먹음: 「와삭 냠」
  def('food', { cap: 1, gap: 120, p: true }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'bandpass', f: 1800, q: 1.5, d: 0.05, v: 0.3 });
    noise(x, o, t, k, { ft: 'bandpass', f: 1400, q: 1.5, d: 0.05, v: 0.25, at: 0.07 });
    tone(x, o, t, k, { w: 'triangle', f: 523, f2: 784, d: 0.1, v: 0.12, at: 0.13 });
  });
  // 물약 마심: 「꿀꺽꿀꺽 반짝」
  def('potion', { cap: 1, gap: 120, p: true }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'sine', f: 280, f2: 620, d: 0.08, v: 0.3 });
    tone(x, o, t, k, { w: 'sine', f: 300, f2: 680, d: 0.08, v: 0.28, at: 0.1 });
    arp(x, o, t, 1, ['E6', 'G6', 'C7'], 0.05, { w: 'triangle', d: 0.1, v: 0.06, at: 0.2, lastD: 0.25 });
  });
  // 경험치 구슬 닿음: 아주 작은 「틱」(많이 겹치지 않게 간격 넉넉히)
  def('orb', { cap: 2, gap: 55, vary: 0.2 }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'sine', f: 2100, f2: 2700, d: 0.045, v: 0.06 });
  });
  // 점프 · 착지 · 회피
  def('jump', { cap: 1, gap: 80, vary: 0.05 }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'square', f: 230, f2: 470, d: 0.09, v: 0.09, lp: 1800 });
    noise(x, o, t, k, { ft: 'bandpass', f: 700, f2: 1400, d: 0.08, v: 0.08 });
  });
  def('land', { cap: 1, gap: 80, vary: 0.08 }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'lowpass', f: 700, f2: 180, d: 0.08, v: 0.28 });
    tone(x, o, t, k, { w: 'sine', f: 95, f2: 50, d: 0.07, v: 0.3 });
  });
  def('dodge', { cap: 1, gap: 100, vary: 0.06 }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'bandpass', f: 900, f2: 2800, q: 1.6, d: 0.17, v: 0.26, a: 0.03 });
    tone(x, o, t, k, { w: 'sine', f: 500, f2: 900, d: 0.1, v: 0.04 });
  });
  // 플레이어가 맞음 / 쓰러짐
  def('playerHurt', { cap: 1, gap: 90, vary: 0.06, p: true }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'square', f: 420, f2: 140, d: 0.16, v: 0.07, lp: 2200 });
    tone(x, o, t, k, { w: 'sine', f: 150, f2: 55, d: 0.14, v: 0.5 });
    noise(x, o, t, k, { ft: 'lowpass', f: 1800, f2: 400, d: 0.09, v: 0.3 });
  });
  def('playerDown', { cap: 1, gap: 600, p: true }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'square', f: 440, f2: 98, d: 0.55, v: 0.07, lp: 1800 });
    tone(x, o, t, k, { w: 'sine', f: 120, f2: 40, d: 0.4, v: 0.6 });
    noise(x, o, t, k, { ft: 'lowpass', f: 1200, f2: 150, d: 0.35, v: 0.35 });
  });

  // ---------- 기술 ----------
  // 기술 쓰기 시작할 때(직업 기술 id → 소리). 날아가는 것·터지는 것은 그 순간 따로(skills.js)
  var CAST = { dash: 'skDash', counter: 'skDash', spin: 'skSpin', upper: 'skUpper', slam: 'skLeap', holy: 'skHoly',
               bolt: 'charge', rise: 'charge', meteor: 'charge', pillar: 'charge' };
  def('charge', { cap: 2, gap: 80, vary: 0.04 }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'triangle', f: 500, f2: 1100, d: 0.16, v: 0.07 });
    tone(x, o, t, k, { w: 'square', f: 1000, f2: 2200, d: 0.12, v: 0.025, lp: 4000, at: 0.03 });
  });
  // 돌진베기: 「쉬이익—」
  def('skDash', { cap: 2, gap: 80, vary: 0.05 }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'bandpass', f: 1400, f2: 4200, q: 1.8, d: 0.26, v: 0.36, a: 0.02 });
    tone(x, o, t, k, { w: 'sawtooth', f: 180, f2: 520, d: 0.22, v: 0.06, lp: 1400 });
  });
  // 회전베기: 바람 세 번
  def('skSpin', { cap: 2, gap: 120, vary: 0.04 }, function (x, o, t, k) {
    for (var i = 0; i < 3; i++) noise(x, o, t, k * (1 + i * 0.08), { ft: 'bandpass', f: 2600, f2: 800, q: 2, d: 0.12, v: 0.26, a: 0.02, at: i * 0.11 });
  });
  // 올려베기: 올라가는 바람
  def('skUpper', { cap: 2, gap: 100, vary: 0.04 }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'bandpass', f: 600, f2: 3400, q: 1.6, d: 0.22, v: 0.32, a: 0.02 });
    tone(x, o, t, k, { w: 'square', f: 160, f2: 640, d: 0.18, v: 0.05, lp: 1600 });
  });
  // 대지 내려찍기: 뛰어오름(가벼운 바람) → 쾅(skSlam)
  def('skLeap', { cap: 1, gap: 100 }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'bandpass', f: 400, f2: 1300, d: 0.2, v: 0.16, a: 0.04 });
  });
  def('skSlam', { cap: 2, gap: 100, vary: 0.05, p: true }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'sine', f: 95, f2: 30, d: 0.5, v: 0.9 });
    tone(x, o, t, k, { w: 'square', f: 62, f2: 30, d: 0.2, v: 0.1, lp: 500 });
    noise(x, o, t, k, { ft: 'lowpass', f: 1400, f2: 120, d: 0.55, v: 0.7 });
  });
  // 검기 날림: 「슈잉」
  def('skWave', { cap: 2, gap: 90, vary: 0.04 }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'sawtooth', f: 1100, f2: 320, d: 0.3, v: 0.07, lp: 3000 });
    noise(x, o, t, k, { ft: 'highpass', f: 2800, f2: 1600, d: 0.26, v: 0.16, a: 0.02 });
    tone(x, o, t, k, { w: 'triangle', f: 1760, f2: 1320, d: 0.2, v: 0.04 });
  });
  // 성검 낙뢰: 시작 = 거룩한 화음, 칼이 꽂힐 때마다 = 「지직 쾅」(holyBolt)
  def('skHoly', { cap: 1, gap: 200 }, function (x, o, t, k) {
    arp(x, o, t, 1, ['E5', 'G#5', 'B5', 'E6'], 0.05, { w: 'triangle', d: 0.35, v: 0.06, lastD: 0.5 });
    noise(x, o, t, k, { ft: 'highpass', f: 5000, d: 0.4, v: 0.06, a: 0.1 });
  });
  def('holyBolt', { cap: 3, gap: 55, vary: 0.08 }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'highpass', f: 2400, d: 0.13, v: 0.32 });
    tone(x, o, t, k, { w: 'square', f: 1900, f2: 220, d: 0.1, v: 0.05, lp: 5000 });
    tone(x, o, t, k, { w: 'sine', f: 130, f2: 40, d: 0.2, v: 0.5 });
  });
  // 화염구: 던짐 「후웅」 → 터짐 「콰광」
  def('fireball', { cap: 2, gap: 90, vary: 0.05 }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'lowpass', f: 700, f2: 2200, d: 0.26, v: 0.32, a: 0.04 });
    tone(x, o, t, k, { w: 'sawtooth', f: 110, f2: 230, d: 0.22, v: 0.08, lp: 700 });
  });
  def('fireBoom', { cap: 2, gap: 80, vary: 0.08 }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'lowpass', f: 2200, f2: 160, d: 0.5, v: 0.6 });
    tone(x, o, t, k, { w: 'sine', f: 115, f2: 35, d: 0.36, v: 0.7 });
  });
  // 번개: 「파지직」
  def('lightning', { cap: 3, gap: 45, vary: 0.1 }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'highpass', f: 1600, d: 0.05, v: 0.42 });
    noise(x, o, t, k, { ft: 'highpass', f: 2200, d: 0.05, v: 0.3, at: 0.035 });
    noise(x, o, t, k, { ft: 'bandpass', f: 1200, q: 0.7, d: 0.22, v: 0.25, at: 0.06 });
    tone(x, o, t, k, { w: 'square', f: 2400, f2: 300, d: 0.08, v: 0.04, lp: 6000 });
    tone(x, o, t, k, { w: 'sine', f: 110, f2: 40, d: 0.22, v: 0.45 });
  });
  // 얼음창: 던짐 「쉬잉(차가운)」 → 맞음 「쨍그랑」
  def('iceSpear', { cap: 2, gap: 90, vary: 0.05 }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'triangle', f: 1900, f2: 3200, d: 0.13, v: 0.07 });
    tone(x, o, t, k, { w: 'sine', f: 3100, d: 0.22, v: 0.03, at: 0.04 });
    noise(x, o, t, k, { ft: 'highpass', f: 5500, d: 0.16, v: 0.12, a: 0.02 });
  });
  def('iceHit', { cap: 2, gap: 60, vary: 0.1 }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'square', f: 2600, d: 0.06, v: 0.04, lp: 7000 });
    tone(x, o, t, k, { w: 'square', f: 3500, d: 0.05, v: 0.03, lp: 7000, at: 0.03 });
    noise(x, o, t, k, { ft: 'highpass', f: 4500, d: 0.12, v: 0.26 });
  });
  // 메테오: 떨어짐 「휘이잉」 → 「콰아앙」
  def('meteorFall', { cap: 2, gap: 120 }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'bandpass', f: 3200, f2: 500, q: 2, d: 0.42, v: 0.3, a: 0.08 });
    tone(x, o, t, k, { w: 'sawtooth', f: 1300, f2: 220, d: 0.42, v: 0.045, lp: 2400, a: 0.08 });
  });
  def('meteorBoom', { cap: 2, gap: 120, vary: 0.05, p: true }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'sine', f: 75, f2: 24, d: 0.9, v: 1 });
    tone(x, o, t, k, { w: 'square', f: 55, f2: 26, d: 0.3, v: 0.12, lp: 400 });
    noise(x, o, t, k, { ft: 'lowpass', f: 3200, f2: 100, d: 1.0, v: 0.8 });
  });
  // 순간이동: 「퓨웅」
  def('blink', { cap: 1, gap: 120, vary: 0.04 }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'sine', f: 500, f2: 2600, d: 0.12, v: 0.1 });
    tone(x, o, t, k, { w: 'triangle', f: 2600, f2: 700, d: 0.14, v: 0.06, at: 0.11 });
    noise(x, o, t, k, { ft: 'highpass', f: 3500, d: 0.1, v: 0.1 });
  });
  // 불기둥: 「화르르륵」
  def('firePillar', { cap: 2, gap: 120, vary: 0.05 }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'bandpass', f: 380, f2: 1500, q: 0.8, d: 0.65, v: 0.55, a: 0.05 });
    tone(x, o, t, k, { w: 'sine', f: 85, f2: 55, d: 0.5, v: 0.55 });
    noise(x, o, t, k, { ft: 'highpass', f: 3000, d: 0.5, v: 0.08, a: 0.1 });
  });
  // 땅 융기(돌기둥): 「우르릉 콱」
  def('earthRise', { cap: 2, gap: 100, vary: 0.06 }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'lowpass', f: 520, f2: 220, d: 0.45, v: 0.6 });
    tone(x, o, t, k, { w: 'sine', f: 60, f2: 120, d: 0.3, v: 0.55 });
    noise(x, o, t, k, { ft: 'bandpass', f: 2000, q: 1.2, d: 0.06, v: 0.3, at: 0.05 });
  });

  // ---------- 각성 ----------
  // 시작: 낮게 우르릉 → 쭉 올라감 → 화음
  def('awaken', { cap: 1, gap: 500, p: true }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'sine', f: 60, f2: 30, d: 0.5, v: 0.8 });
    tone(x, o, t, k, { w: 'sawtooth', f: 110, f2: 880, d: 0.6, v: 0.09, lp: 2600 });
    noise(x, o, t, k, { ft: 'bandpass', f: 400, f2: 4000, q: 1, d: 0.6, v: 0.25, a: 0.1 });
    arp(x, o, t, 1, ['A5', 'C#6', 'E6', 'A6'], 0.03, { w: 'triangle', d: 0.5, v: 0.06, at: 0.45, lastD: 0.6 });
    arp(x, o, t, 1, ['A4', 'E5'], 0.0, { w: 'square', d: 0.5, v: 0.035, lp: 3000, at: 0.45 });
  });
  // 끝 폭발: 크게 쾅 + 반짝
  def('awakenEnd', { cap: 1, gap: 500, p: true }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'sine', f: 80, f2: 24, d: 1.0, v: 1 });
    noise(x, o, t, k, { ft: 'lowpass', f: 4000, f2: 110, d: 1.1, v: 0.85 });
    tone(x, o, t, k, { w: 'square', f: 60, f2: 28, d: 0.35, v: 0.12, lp: 500 });
    noise(x, o, t, k, { ft: 'highpass', f: 5000, d: 0.6, v: 0.08, a: 0.05, at: 0.05 });
  });

  // ---------- 보스 ----------
  // 등장 컷인: 낮은 북 + 뿔피리 두 번
  def('bossIntro', { cap: 1, gap: 800, p: true }, function (x, o, t, k) {
    for (var i = 0; i < 2; i++) {
      var at = i * 0.42;
      tone(x, o, t, k, { w: 'sine', f: 70, f2: 40, d: 0.5, v: 0.9, at: at });
      noise(x, o, t, k, { ft: 'lowpass', f: 400, f2: 120, d: 0.3, v: 0.5, at: at });
      tone(x, o, t, k, { w: 'sawtooth', f: i ? 98 : 110, d: 0.4, v: 0.1, lp: 520, a: 0.04, at: at, hold: 0.1 });
      tone(x, o, t, k, { w: 'sawtooth', f: i ? 147 : 165, d: 0.4, v: 0.07, lp: 520, a: 0.04, at: at, hold: 0.1 });
    }
  });
  // 분노·각성: 으르렁(낮은 잡음 + 두 톱니가 어긋나 떨림)
  def('bossRoar', { cap: 1, gap: 800, p: true }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'bandpass', f: 320, f2: 170, q: 2.5, d: 0.95, v: 0.75, a: 0.12 });
    tone(x, o, t, k, { w: 'sawtooth', f: 82, f2: 55, d: 0.95, v: 0.14, lp: 520, a: 0.1 });
    tone(x, o, t, k, { w: 'sawtooth', f: 87, f2: 58, d: 0.95, v: 0.12, lp: 520, a: 0.1 });
    tone(x, o, t, k, { w: 'sine', f: 55, f2: 35, d: 0.8, v: 0.5, a: 0.1 });
  });

  // ---------- 판 · 화면 ----------
  def('wave', { cap: 1, gap: 400, p: true }, function (x, o, t, k) {
    arp(x, o, t, 1, ['C6', 'G6'], 0.09, { w: 'square', d: 0.09, v: 0.05, lp: 5000, lastD: 0.2 });
    arp(x, o, t, 1, ['C5', 'G5'], 0.09, { w: 'triangle', d: 0.1, v: 0.09, lastD: 0.22 });
  });
  def('waveClear', { cap: 1, gap: 400, p: true }, function (x, o, t, k) {
    arp(x, o, t, 1, ['E6', 'G6', 'C7'], 0.07, { w: 'square', d: 0.08, v: 0.08, lp: 6000, lastD: 0.25 });
  });
  // 스테이지 클리어: 짧은 팡파레
  def('stageClear', { cap: 1, gap: 1500, p: true }, function (x, o, t, k) {
    arp(x, o, t, 1, ['G5', 'C6', 'E6', 'G6', '', 'E6', 'G6'], 0.1, { w: 'square', d: 0.1, v: 0.055, lp: 5000, lastD: 0.6 });
    arp(x, o, t, 1, ['C4', '', 'G4', '', 'C5', '', 'C5'], 0.1, { w: 'triangle', d: 0.18, v: 0.12, lastD: 0.6 });
  });
  // 게임 오버: 내려가는 가락
  def('fail', { cap: 1, gap: 1500, p: true }, function (x, o, t, k) {
    arp(x, o, t, 1, ['E5', 'D#5', 'D5', 'C#5'], 0.18, { w: 'square', d: 0.16, v: 0.05, lp: 3000 });
    tone(x, o, t, k, { w: 'square', f: hz('C4'), d: 0.6, v: 0.05, lp: 2000, at: 0.74, hold: 0.15 });
    tone(x, o, t, k, { w: 'triangle', f: hz('C3'), d: 0.7, v: 0.12, at: 0.74, hold: 0.15 });
  });
  // 메뉴 버튼 누름: 작은 「딱」
  def('click', { cap: 1, gap: 40, vary: 0.03, p: true }, function (x, o, t, k) {
    tone(x, o, t, k, { w: 'square', f: 1200, d: 0.03, v: 0.06, lp: 5000 });
    tone(x, o, t, k, { w: 'triangle', f: 1800, d: 0.04, v: 0.04, at: 0.012 });
  });
  // 기술 칸 열림 알림: 맑은 차임
  def('unlock', { cap: 1, gap: 500, p: true }, function (x, o, t, k) {
    arp(x, o, t, 1, ['G6', 'C7', 'E7'], 0.08, { w: 'triangle', d: 0.35, v: 0.08, lastD: 0.6 });
    arp(x, o, t, 1, ['C6', 'G6'], 0.12, { w: 'square', d: 0.2, v: 0.025, lp: 4000, lastD: 0.5 });
  });
  // 적 총알·탄: 아주 작게
  def('enemyShot', { cap: 2, gap: 90, vary: 0.1 }, function (x, o, t, k) {
    noise(x, o, t, k, { ft: 'highpass', f: 2600, d: 0.06, v: 0.12 });
    tone(x, o, t, k, { w: 'square', f: 900, f2: 300, d: 0.06, v: 0.025, lp: 3000 });
  });

  // ---------- 소리 장치 ----------
  // 섞는 줄: 소리 → bus(효과음 크기) → comp(누르개) → master(전체 크기, 끄면 0) → 스피커
  function chain(x) {
    var b = x.createGain(), c = x.createDynamicsCompressor(), m = x.createGain();
    b.gain.value = AU.sfx != null ? AU.sfx : 0.7;
    var L = AU.limiter || {};
    c.threshold.value = L.threshold != null ? L.threshold : -16;
    c.knee.value = L.knee != null ? L.knee : 10;
    c.ratio.value = L.ratio != null ? L.ratio : 8;
    c.attack.value = L.attack != null ? L.attack : 0.003;
    c.release.value = L.release != null ? L.release : 0.18;
    m.gain.value = AU.master != null ? AU.master : 0.8;
    b.connect(c); c.connect(m); m.connect(x.destination);
    return { bus: b, comp: c, master: m };
  }
  function ensure() {
    if (ac) return ac;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ac = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ac = new AC(); } catch (e2) { return null; } }
    var c = chain(ac); bus = c.bus; comp = c.comp; master = c.master;
    if (muted) master.gain.value = 0;
    noiseBuf(ac);
    return ac;
  }
  // 처음 누름·키(사용자 손짓) 때 깨움. iOS 옛 버전은 소리 없는 한 조각을 틀어야 열림
  var unlocked = false;
  function unlock() {
    if (muted || document.hidden) return;
    if (!ensure()) return;
    if (ac.state !== 'running') { try { ac.resume(); } catch (e) {} }
    if (!unlocked) {
      unlocked = true;
      try { var s = ac.createBufferSource(); s.buffer = ac.createBuffer(1, 1, 22050); s.connect(ac.destination); s.start(0); } catch (e) {}
    }
  }
  ['pointerdown', 'touchstart', 'touchend', 'keydown', 'mousedown'].forEach(function (ev) {
    window.addEventListener(ev, unlock, { capture: true, passive: true });
  });
  // 탭을 숨기면 멈춤, 다시 보이면 깨움(꺼 둔 상태면 그대로)
  document.addEventListener('visibilitychange', function () {
    if (!ac) return;
    try { if (document.hidden) ac.suspend(); else if (!muted) ac.resume(); } catch (e) {}
  });

  // ---------- 틀기 ----------
  var last = {}, live = {}, allEnds = [];
  var stats = { played: 0, dropped: 0 };
  function prune(arr, now) { for (var i = arr.length - 1; i >= 0; i--) if (arr[i] <= now) arr.splice(i, 1); }
  // 소리 길이(초, 대충): 동시에 나는 수를 셀 때 씀. 한 번 재 두고 씀
  var LEN = {};
  function lenOf(name) {
    if (LEN[name] != null) return LEN[name];
    var D = S[name], mx = 0.1;
    // 가짜 장치로 그려 보며 가장 늦게 끝나는 시각을 잼
    var fake = {
      sampleRate: 8000, __nb: {},
      createOscillator: function () { return { frequency: P(), connect: nop, start: nop, stop: function (t) { mx = Math.max(mx, t); } }; },
      createBufferSource: function () { return { playbackRate: P(), connect: nop, start: nop, stop: function (t) { mx = Math.max(mx, t); } }; },
      createBiquadFilter: function () { return { frequency: P(), Q: P(), connect: nop }; },
      createGain: function () { return { gain: P(), connect: nop }; }
    };
    function nop() {}
    function P() { return { value: 0, setValueAtTime: nop, linearRampToValueAtTime: nop, exponentialRampToValueAtTime: nop }; }
    try { D.fn(fake, {}, 0, 1, { n: 12 }); } catch (e) {}
    return (LEN[name] = mx);
  }
  // 한 소리 내기. 소리 장치가 아직 없거나(손짓 전) 꺼져 있으면 아무것도 안 함. 돌려주는 값 = 냈으면 true
  function play(name, opts) {
    var D = S[name];
    if (!D || muted || !ac || ac.state !== 'running') return false;
    var now = ac.currentTime, ms = now * 1000;
    if (D.gap && last[name] != null && ms - last[name] < D.gap) { stats.dropped++; return false; }
    var L = live[name] || (live[name] = []);
    prune(L, now);
    if (D.cap && L.length >= D.cap) { stats.dropped++; return false; }
    prune(allEnds, now);
    if (!D.p && allEnds.length >= (AU.maxVoices || 18)) { stats.dropped++; return false; }
    last[name] = ms;
    var k = (opts && opts.k) || 1;
    if (D.vary) k *= 1 + (Math.random() * 2 - 1) * D.vary;
    var v = (opts && opts.v != null ? opts.v : 1) * (AU.vol && AU.vol[name] != null ? AU.vol[name] : 1);
    var out = bus;
    if (v !== 1) { out = ac.createGain(); out.gain.value = v; out.connect(bus); }
    var t = now + 0.005;
    try { D.fn(ac, out, t, k, opts || {}); } catch (e) { return false; }
    var end = now + lenOf(name);
    L.push(end); allEnds.push(end);
    stats.played++;
    return true;
  }

  // ---------- 끄기 / 켜기 ----------
  var btns = [];
  function paint() {
    btns.forEach(function (b) {
      b.classList.toggle('off', muted);
      b.setAttribute('aria-pressed', muted ? 'true' : 'false');
      b.setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기');
      b.title = (muted ? '소리 켜기' : '소리 끄기') + ' (M)';
    });
  }
  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem(SAVE, muted ? '1' : '0'); } catch (e) {}
    if (muted) { if (ac) { master.gain.value = 0; try { ac.suspend(); } catch (e) {} } }
    else { unlock(); if (ac) master.gain.value = AU.master != null ? AU.master : 0.8; }
    paint();
  }
  function toggle() { setMuted(!muted); if (!muted) play('click'); return muted; }
  // 스피커 버튼(index.html .sndbtn) + PC M 키
  function bindButtons() {
    btns = Array.prototype.slice.call(document.querySelectorAll('.sndbtn'));
    btns.forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); toggle(); b.blur(); });
    });
    paint();
    // 메뉴·창 버튼 누름 = 작은 「딱」(폰 조작 버튼 .btns · 스피커 버튼은 빼고. 키보드로 고른 것도 click 으로 옴)
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest && e.target.closest('button, a[href], summary');
      if (!b || b.closest('.btns') || b.classList.contains('sndbtn') || b.disabled) return;
      play('click');
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindButtons); else bindButtons();
  window.addEventListener('keydown', function (e) {
    if (e.code !== 'KeyM' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    var tg = e.target && e.target.tagName;
    if (tg === 'INPUT' || tg === 'TEXTAREA') return;
    toggle();
  });

  // ---------- 시험용: 소리를 파일처럼 미리 그리기(OfflineAudioContext) ----------
  // list = [이름 또는 { name, opts }], gap = 소리 사이 빈 시간(초) → Promise(Float32Array, sampleRate)
  function render(list, gap, rate) {
    rate = rate || 44100; gap = gap == null ? 0.4 : gap;
    var items = list.map(function (q) { return typeof q === 'string' ? { name: q, opts: {} } : q; });
    var t = 0.05, at = [];
    items.forEach(function (q) { at.push(t); t += lenOf(q.name) + gap; });
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var x = new OAC(1, Math.ceil((t + 0.1) * rate), rate), c = chain(x);
    items.forEach(function (q, i) {
      var D = S[q.name], out = c.bus, v = (q.opts.v != null ? q.opts.v : 1) * (AU.vol && AU.vol[q.name] != null ? AU.vol[q.name] : 1);
      if (v !== 1) { out = x.createGain(); out.gain.value = v; out.connect(c.bus); }
      D.fn(x, out, at[i], q.opts.k || 1, q.opts);
    });
    return x.startRendering().then(function (buf) { return { data: buf.getChannelData(0), rate: rate, at: at }; });
  }

  window.SFX = {
    play: play,
    // 기술 시작 소리(skills.js start): 기술 id → 소리 이름
    cast: function (id) { var n = CAST[id]; return n ? play(n) : false; },
    // 휘두르기(main.js): 무기 → 소리
    swing: function (wk, heavy) { return play(heavy ? (wk === 'dagger' ? 'swingDaggerHeavy' : 'swingHeavy') : wk === 'fist' ? 'swingFist' : wk === 'staff' || wk === 'wand' ? 'swingStaff' : wk === 'dagger' ? 'swingDagger' : 'swingSword'); },
    toggle: toggle, setMuted: setMuted, isMuted: function () { return muted; },
    unlock: unlock, names: function () { return Object.keys(S); },
    state: function () { return { ctx: ac ? ac.state : 'none', muted: muted, stats: stats, live: allEnds.length }; },
    len: lenOf, render: render
  };
})();
