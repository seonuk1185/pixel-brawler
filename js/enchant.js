// 무기 강화 · 속성 부여 (2026-11-06, 형님 승인. 수치 = config enchant, 계산·저장 = growth.js 의 Growth.weapon, 창 = main.js 「강화」)
//   이 파일이 하는 것:
//   1) 원소 오라: 무기 그림 둘레에 속성 색 빛 + 작은 불티(코드로 그림, 우리 시안 art-elements\weaponAura.js 를 옮김).
//      속성 1개 = 그 오라, 2개 = 주인공 + 옅은 둘째(번갈아 숨쉼), 3개 = 오로라(청록 → 초록 → 보라 연기가 무기에서 피어오름)
//      entities.js drawWeapon 이 부름: 무기 뒤(back) → 무기 그림 → 무기 앞(front)
//   2) 속성 효과: main.js onHit 가 데미지를 준 뒤 Enchant.onHit 를 부름 → 화상·독(지속 피해) · 느려짐·얼음 · 튀는 번개 · 흡혈 + 맞은 곳 속성 색 불티
//      지속 피해 숫자는 작게 · 색(불 = 주황, 독 = 초록) · 화면 전체 개수 제한(config enchant.dotNum)
//   3) 바닥에 떨어진 강화석 · 속성 결정(코드로 그린 도트): 밟으면 주움(물약처럼). main.js 가 drop 을 부르고, 주우면 H.got
//   그림·코드 모두 우리 것(남의 그림·코드 안 씀)
(function () {
  var CFG = null, EN = null, H = null;
  var TAU = Math.PI * 2;
  function AS() { return (CFG && CFG.actorScale) || 1; }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // ================= 1) 원소 오라 =================
  // glow = 빛 색, core = 가운데 밝은 색, a = 빛 세기
  var EL = {
    fire:      { glow: '#ff6a10', core: '#ffc23a', a: 0.95 },
    ice:       { glow: '#7cc8ff', core: '#e8f8ff', a: 0.75 },
    lightning: { glow: '#4aa8ff', core: '#fff4a0', a: 0.8 },
    darkness:  { glow: '#7a2cff', core: '#2a0844', a: 0.85 },
    poison:    { glow: '#5cff2a', core: '#c8ff7a', a: 0.7 },
    wind:      { glow: '#d8fff0', core: '#ffffff', a: 0.28 },   // 바람 = 옅은 흰초록·은빛, 빛은 아주 약하게(감도는 바람 줄이 주인공, 오로라와 헷갈리지 않게)
    light:     { glow: '#ffcf55', core: '#fffbe0', a: 0.85 }
  };
  var LAYER = [{ s: 1, glow: 'B', core: 'A' }, { s: 0.55, glow: 'A' }, { s: 0.45, glow: 'R' }];
  function hash(a, b) { var v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); }
  function flick(t, seed) { return 0.5 + 0.22 * Math.sin(t * 13.1 + seed) + 0.16 * Math.sin(t * 23.7 + seed * 2.3) + 0.12 * Math.sin(t * 7.3 + seed * 4.1); }
  function life(t, P, h) { var v = t / P + h, c = Math.floor(v); return { ph: v - c, c: c }; }

  // 무기 그림마다 한 번: 흰 실루엣(3배 크게) + 흐린 복사 3개(R·A·B) + 세로줄마다 칠한 위·아래(불티 나오는 자리)
  var SS = 3, PAD = 11;
  var auraCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  var hasFilter = (function () { try { var g = mk(2, 2).getContext('2d'); g.filter = 'blur(1px)'; return g.filter === 'blur(1px)'; } catch (e) { return false; } })();
  function prep(img, w, h) {
    var m = auraCache && auraCache.get(img);
    if (m && m.w === w) return m;
    var W = Math.ceil((w + PAD * 2) * SS), Hh = Math.ceil((h + PAD * 2) * SS);
    var sil = mk(W, Hh), g = sil.getContext('2d');
    g.drawImage(img, PAD * SS, PAD * SS, w * SS, h * SS);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, W, Hh);
    function blur(r, boost) {
      var c = mk(W, Hh), q = c.getContext('2d'), i;
      if (hasFilter) { q.filter = 'blur(' + (r * SS) + 'px)'; for (i = 0; i < boost; i++) q.drawImage(sil, 0, 0); return c; }
      // 흐리기가 없는 브라우저(예전 사파리): 실루엣을 둥글게 돌려 찍어 번진 빛 흉내
      var n = 10, R = r * SS * 1.4;
      q.globalAlpha = Math.min(1, boost / n * 1.6);
      for (i = 0; i < n; i++) { var an = i / n * TAU; q.drawImage(sil, Math.cos(an) * R, Math.sin(an) * R); }
      q.globalAlpha = 1; q.drawImage(sil, 0, 0);
      return c;
    }
    var pc = mk(Math.max(1, Math.round(w)), Math.max(1, Math.round(h))), pg = pc.getContext('2d'); pg.drawImage(img, 0, 0, pc.width, pc.height);
    var d = pg.getImageData(0, 0, pc.width, pc.height).data, prof = [], x0 = -1, x1 = -1;
    for (var x = 0; x < pc.width; x++) {
      var top = -1, bot = -1;
      for (var y = 0; y < pc.height; y++) if (d[(y * pc.width + x) * 4 + 3] > 110) { if (top < 0) top = y; bot = y; }
      prof.push(top < 0 ? null : [top, bot + 1]);
      if (top >= 0) { if (x0 < 0) x0 = x; x1 = x; }
    }
    m = { w: w, h: h, W: W, H: Hh, sil: sil, R: blur(1.0, 2), A: blur(2.2, 3), B: blur(4.6, 4), prof: prof, x0: Math.max(0, x0), x1: Math.max(0, x1), tint: {} };
    if (auraCache) auraCache.set(img, m);
    return m;
  }
  function tinted(m, which, col) {
    var k = which + col;
    if (m.tint[k]) return m.tint[k];
    var c = mk(m.W, m.H), g = c.getContext('2d');
    g.drawImage(m[which], 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, m.W, m.H);
    return (m.tint[k] = c);
  }
  function drawGlow(ctx, m, which, col, a, grow, dx, dy) {
    if (a <= 0.01) return;
    var c = tinted(m, which, col), ww = m.w + PAD * 2, hh = m.h + PAD * 2, cx = m.w / 2, cy = m.h / 2;
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(c, cx - ww * grow / 2 + (dx || 0), cy - hh * grow / 2 + (dy || 0), ww * grow, hh * grow);
  }
  // 부드러운 둥근 연기 한 덩이(색마다 그라데이션 그림 하나)
  var puffCache = {};
  function puffImg(rgb) {
    var c = puffCache[rgb];
    if (!c) {
      c = mk(32, 32); var g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(' + rgb + ',1)'); gr.addColorStop(0.5, 'rgba(' + rgb + ',0.5)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = gr; g.fillRect(0, 0, 32, 32); puffCache[rgb] = c;
    }
    return c;
  }
  function puff(ctx, rgb, x, y, rx, ry, a) {
    if (a <= 0.01) return;
    ctx.globalAlpha = Math.min(1, a); ctx.drawImage(puffImg(rgb), x - rx, y - ry, rx * 2, ry * 2);
  }
  // 불티 자리: 칼 = 칼날(손잡이 빼고), 지팡이 = 머리 쪽
  function spawnRange(m, kind) { var span = m.x1 - m.x0; return kind === 'staff' ? [m.x0 + span * 0.62, m.x1] : [m.x0 + span * 0.24, m.x1]; }
  function spawn(m, R, i, c, salt) {
    var x = R[0] + hash(i * 7.1 + c * 3.3, salt) * (R[1] - R[0]), xi = Math.round(x), p = m.prof[xi];
    for (var k = 1; !p && k < 8; k++) p = m.prof[xi - k] || m.prof[xi + k];
    p = p || [m.h / 2 - 1, m.h / 2 + 1];
    return { x: x + 0.5, y: p[0] + hash(i * 3.7 + c * 1.9, salt + 1) * (p[1] - p[0]), top: p[0], bot: p[1] };
  }
  function px(ctx, col, x, y, s, a) {
    if (a <= 0.02) return;
    ctx.globalAlpha = Math.min(1, a); ctx.fillStyle = col; ctx.fillRect(x - s / 2, y - s / 2, s, s);
  }
  function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); }
  // 속성마다 무기 앞 불티(시간만으로 정해짐: 따로 기억하는 것 없음)
  var PART = {
    fire: function (ctx, m, R, P) {   // 위로 날리는 불씨(노랑 → 주황 → 빨강)
      var n = Math.round(9 * P.s); ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < n; i++) {
        var L = life(P.t, 0.5, hash(i, 1)), p = spawn(m, R, i, L.c, 2), ph = L.ph;
        var rise = ph * (5 + 5 * hash(i, 4)), wig = Math.sin(P.t * 14 + i * 2.1) * 0.7 * ph;
        px(ctx, ph < 0.25 ? '#fff2a8' : ph < 0.55 ? '#ffb43a' : '#ff5a1a', p.x + P.up.x * rise - P.up.y * wig, p.y + P.up.y * rise + P.up.x * wig, ph < 0.4 ? 1.3 : 1, (1 - ph * ph) * 0.9);
      }
    },
    ice: function (ctx, m, R, P) {    // 찬 김 + 반짝
      var i, n = Math.round(5 * P.s);
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < n; i++) {
        var L = life(P.t, 1.0, hash(i, 11)), p = spawn(m, R, i, L.c, 12), ph = L.ph, rise = ph * 6, r = 1.5 + ph * 3, dr = Math.sin(ph * 3 + i) * 1.2;
        puff(ctx, '225,244,255', p.x + P.up.x * rise - P.up.y * dr, p.y + P.up.y * rise + P.up.x * dr, r * 1.3, r, 0.35 * Math.sin(Math.PI * ph));
      }
      n = Math.round(4 * P.s);
      for (i = 0; i < n; i++) {
        var L2 = life(P.t, 0.5, hash(i, 13)), q = spawn(m, R, i, L2.c, 14), a2 = Math.sin(Math.PI * L2.ph);
        px(ctx, '#ffffff', q.x, q.y, 1, a2);
        if (a2 > 0.7) { px(ctx, '#bfe6ff', q.x - 1, q.y, 0.8, a2 * 0.6); px(ctx, '#bfe6ff', q.x + 1, q.y, 0.8, a2 * 0.6); px(ctx, '#bfe6ff', q.x, q.y - 1, 0.8, a2 * 0.6); px(ctx, '#bfe6ff', q.x, q.y + 1, 0.8, a2 * 0.6); }
      }
    },
    // 번개(2026-11-06 형님: 「전기가 더 잘 보이게」): 칼날 가장자리를 따라 지지직 튀는 작은 지그재그 여러 개(흰·하늘 심) +
    //   가끔 칼날에서 바깥으로 뛰쳐나가는 큰 번개 한 줄기. 1/20초마다 모양이 바뀜
    lightning: function (ctx, m, R, P) {
      var bucket = Math.floor(P.t * 20), arcs = P.s > 0.7 ? 5 : 2; ctx.globalCompositeOperation = 'lighter';
      function bolt(pts, big) {
        ctx.globalAlpha = big ? 0.55 : 0.45; ctx.strokeStyle = '#3a8cff'; ctx.lineWidth = big ? 3 : 2.2; poly(ctx, pts);
        ctx.globalAlpha = 0.85; ctx.strokeStyle = '#9fd8ff'; ctx.lineWidth = big ? 1.6 : 1.2; poly(ctx, pts);
        ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = big ? 0.8 : 0.6; poly(ctx, pts);
      }
      for (var j = 0; j < arcs; j++) {   // 가장자리를 기는 작은 지그재그
        if (hash(bucket * 5 + j + P.seed, 22) > 0.8) continue;
        var xa = R[0] + hash(bucket * 3 + j, 23) * (R[1] - R[0]) * 0.85, xb = Math.min(R[1] + 1, xa + 4 + 7 * hash(bucket + j, 24));
        var side = hash(bucket + j * 7, 25) < 0.5 ? -1 : 1, pts = [];
        for (var k = 0; k <= 5; k++) {
          var x = xa + (xb - xa) * k / 5, p = m.prof[Math.round(x)] || [m.h / 2, m.h / 2], e = side < 0 ? p[0] : p[1];
          pts.push([x, e + side * ((k === 0 || k === 5) ? 0 : 0.6 + 2.6 * hash(bucket * 11 + j * 13 + k, 26)) * (k % 2 ? 1 : 0.4)]);
        }
        bolt(pts, false);
        if (hash(bucket + j, 27) < 0.5) px(ctx, '#ffffff', pts[0][0], pts[0][1], 1.4, 0.9);   // 튀는 끝 불똥
      }
      // 큰 번개: 칼날 한 점에서 바깥(위·아래)으로 8~14 점 뻗는 갈래 번개(1/20초 중 약 35%)
      if (P.s > 0.7 && hash(bucket, 28 + P.seed) < 0.35) {
        var x0 = R[0] + hash(bucket, 29) * (R[1] - R[0]), p0 = m.prof[Math.round(x0)] || [m.h / 2, m.h / 2], sd = hash(bucket, 30) < 0.5 ? -1 : 1;
        var L = 8 + 6 * hash(bucket, 31), dx = (hash(bucket, 32) * 2 - 1) * 6, pts2 = [];
        for (var q = 0; q <= 6; q++) { var f = q / 6; pts2.push([x0 + dx * f + (q && q < 6 ? (hash(bucket * 7 + q, 33) * 2 - 1) * 2.4 : 0), (sd < 0 ? p0[0] : p0[1]) + sd * L * f]); }
        bolt(pts2, true);
        var br = pts2[3], pts3 = [br, [br[0] + 3 * (dx > 0 ? -1 : 1), br[1] + sd * 2.5], [br[0] + 4 * (dx > 0 ? -1 : 1), br[1] + sd * 5]];   // 곁가지
        bolt(pts3, false);
        px(ctx, '#ffffff', pts2[6][0], pts2[6][1], 1.6, 1);
      }
    },
    darkness: function (ctx, m, R, P) {    // 검보라 연기 줄기 + 보라 불티
      var i, n = Math.round(6 * P.s);
      ctx.globalCompositeOperation = 'source-over';
      for (i = 0; i < n; i++) {
        var L = life(P.t, 1.0, hash(i, 31)), p = spawn(m, R, i, L.c, 32), ph = L.ph;
        var rise = ph * 8, wave = Math.sin(ph * 7 + i * 1.3) * (0.6 + ph * 1.6), r = 0.9 + ph * 2;
        ctx.globalAlpha = 0.45 * Math.sin(Math.PI * Math.min(1, ph * 1.15)); ctx.fillStyle = i % 2 ? '#1c0630' : '#3d1266';
        ctx.beginPath(); ctx.arc(p.x + P.up.x * rise - P.up.y * wave, p.y + P.up.y * rise + P.up.x * wave, r, 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
      n = Math.round(3 * P.s);
      for (i = 0; i < n; i++) { var L2 = life(P.t, 0.667, hash(i, 33)), q = spawn(m, R, i, L2.c, 34), rr = L2.ph * 5; px(ctx, '#b77cff', q.x + P.up.x * rr, q.y + P.up.y * rr, 1, Math.sin(Math.PI * L2.ph)); }
    },
    poison: function (ctx, m, R, P) {      // 올라가다 터지는 거품 + 떨어지는 방울
      var i, n = Math.round(4 * P.s);
      ctx.globalCompositeOperation = 'source-over';
      for (i = 0; i < n; i++) {
        var L = life(P.t, 0.667, hash(i, 41)), p = spawn(m, R, i, L.c, 42), ph = L.ph, rise = ph * 6, x = p.x + P.up.x * rise, y = p.y + P.up.y * rise;
        if (ph < 0.85) { ctx.globalAlpha = 0.85; ctx.strokeStyle = '#9dff4a'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(x, y, 0.7 + ph * 1.1, 0, TAU); ctx.stroke(); }
        else { var dd = 1.2 + (ph - 0.85) * 10; px(ctx, '#9dff4a', x - dd, y, 0.7, 0.8); px(ctx, '#9dff4a', x + dd, y, 0.7, 0.8); px(ctx, '#9dff4a', x, y - dd, 0.7, 0.8); }
      }
      n = P.s > 0.7 ? 2 : 0;
      for (i = 0; i < n; i++) {
        var L2 = life(P.t, 1.0, hash(i, 43)), q = spawn(m, R, i, L2.c, 44), f = L2.ph * L2.ph * 10, by = P.up.y < 0 ? q.bot : q.top;
        ctx.globalAlpha = (1 - L2.ph) * 0.9; ctx.fillStyle = '#62d81c'; ctx.fillRect(q.x - P.up.x * f - 0.5, by - P.up.y * f - 0.5, 1, 1.2 + L2.ph * 1.5);
      }
    },
    // 바람(2026-11-06 형님: 오로라와 확실히 다르게): 연기 없이, 빠르게 무기를 휘감아 도는 은빛·옅은 초록 바람 줄(움직임 선)
    wind: function (ctx, m, R, P) {
      var n = Math.round(5 * P.s); ctx.globalCompositeOperation = 'lighter';
      var x0 = m.x0 + (m.x1 - m.x0) * 0.1, x1 = m.x1;
      for (var i = 0; i < n; i++) {
        var L = life(P.t, 0.32, hash(i, 51)), side = i % 2 ? 1 : -1;
        for (var k = 0; k < 12; k++) {
          var ph = L.ph - k * 0.022; if (ph < 0) continue;
          var x = x0 - 4 + ph * (x1 - x0 + 8), p = m.prof[Math.max(m.x0, Math.min(m.x1, Math.round(x)))] || [m.h / 2, m.h / 2];
          var mid = (p[0] + p[1]) / 2, hh = (p[1] - p[0]) / 2 + 2.5 + hash(i + L.c, 52) * 2;
          var sp = Math.sin(ph * TAU * 2.2 + i * 1.7), front = Math.cos(ph * TAU * 2.2 + i * 1.7) * side > 0;   // 감아 돌기: 앞쪽 반 바퀴는 밝게, 뒤쪽은 흐리게
          px(ctx, k === 0 ? '#ffffff' : (k < 4 ? '#e8fff6' : '#b8e8d8'), x, mid + side * sp * hh, k === 0 ? 1.1 : 0.75, (1 - k / 12) * Math.sin(Math.PI * ph) * (front ? 0.95 : 0.35));
        }
      }
    },
    light: function (ctx, m, R, P) {       // 떠오르며 반짝이는 금빛 알갱이
      var n = Math.round(6 * P.s); ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < n; i++) {
        var L = life(P.t, 1.0, hash(i, 61)), p = spawn(m, R, i, L.c, 62), rise = L.ph * 5;
        var tw = Math.sin(Math.PI * L.ph) * (0.6 + 0.4 * Math.sin(P.t * 18 + i));
        px(ctx, '#fff3b8', p.x + P.up.x * rise, p.y + P.up.y * rise, 1, tw);
        if (tw > 0.85) { px(ctx, '#ffe08a', p.x + P.up.x * rise - 1, p.y + P.up.y * rise, 0.7, 0.5); px(ctx, '#ffe08a', p.x + P.up.x * rise + 1, p.y + P.up.y * rise, 0.7, 0.5); }
      }
    }
  };
  // 속성 3개 = 오로라 연기: 천천히 피어오르는 연기 줄기, 뿌리 청록 → 초록 → 진한 보라 → 분홍 끝(2026-11-06 형님: 바람과 헷갈리지 않게 보라·분홍을 진하게)
  var AUR = [[30, 226, 200], [70, 255, 130], [160, 60, 255], [255, 80, 200]];
  function mixc(a, b, f) { return Math.round(a[0] + (b[0] - a[0]) * f) + ',' + Math.round(a[1] + (b[1] - a[1]) * f) + ',' + Math.round(a[2] + (b[2] - a[2]) * f); }
  function aurCol(u) { var s = u * 3, i = Math.min(2, Math.floor(s)); return mixc(AUR[i], AUR[i + 1], s - i); }
  function aurora(ctx, m, kind, t, up, pass) {
    if (pass === 'back') {
      ctx.globalCompositeOperation = 'lighter';
      var f = flick(t * 0.4, 0.9);
      drawGlow(ctx, m, 'B', '#2fd6b4', 0.42 * (0.85 + 0.25 * f), 1.02);
      drawGlow(ctx, m, 'A', '#b46aff', 0.16 + 0.08 * Math.sin(t * 1.3), 1.0);   // 보라 숨결
      return;
    }
    var R = kind === 'staff' ? [m.x0 + (m.x1 - m.x0) * 0.45, m.x1] : spawnRange(m, kind);
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 12; i++) {
      var L = life(t, 2.0, hash(i, 71)), p = spawn(m, R, i, L.c, 72), lp = L.ph, fade = Math.sin(Math.PI * Math.min(1, lp * 1.05)) * 0.38;
      for (var k = 0; k < 5; k++) {
        var u = k / 4, rise = 1 + lp * 11 + u * (2.5 + lp * 7), sway = Math.sin(lp * 4 + i * 1.9 + u * 1.6) * (0.4 + lp * 2 + u * 1.2);
        var c = aurCol(Math.min(1, u * 0.75 + lp * 0.35)), rr = 1.0 + lp * 1.8 + u * 0.8;
        puff(ctx, c, p.x + up.x * rise - up.y * sway, p.y + up.y * rise + up.x * sway, rr, rr, fade * (u > 0.7 ? 1.1 : 1 - u * 0.3));
      }
    }
  }
  // 오라 그리기: ctx = drawWeapon 이 손 자리로 옮기고 돌린 상태(1 = 1 도트). img = 실제 무기 그림(HD 면 _k), wDef = config art.weapons 항목
  //   단위 맞춤: 1배 그림 1점 = weaponScale 도트 → ctx 를 weaponScale 배로 키우고 1배 그림 점 단위로 그림(불티 크기가 그림 점과 같게)
  //   angle = 돌린 각도(라디안, 연기·불씨가 화면 위로 오르게), pass = 'back'(무기 뒤 빛) / 'front'(무기 앞 불티)
  function aura(ctx, wDef, img, els, angle, pass, t) {
    if (!els || !els.length || !img) return;
    var WS = (CFG && CFG.weaponScale) || 1, k = img._k || 1;
    var w = img.width * k / WS, h = img.height * k / WS, gx = wDef.grip.x * k / WS, gy = wDef.grip.y * k / WS;
    var m = prep(img, w, h), up = { x: -Math.sin(angle || 0), y: -Math.cos(angle || 0) };
    var n = Math.min(3, els.length), kind = wDef.kind || (w > 60 ? 'staff' : 'sword');
    t = t != null ? t : performance.now() / 1000;
    ctx.save();
    ctx.scale(WS, WS);
    ctx.translate(-gx - (img._ox || 0) * k / WS, -gy - (img._oy || 0) * k / WS);
    if (n === 3) aurora(ctx, m, kind, t, up, pass);
    else if (pass === 'back') {
      for (var i = n - 1; i >= 0; i--) {   // 옅은 층부터, 주인공 빛이 맨 위
        var E = EL[els[i]]; if (!E) continue;
        var Ly = LAYER[i], f = flick(t, i * 1.7 + 0.3);
        var breathe = n > 1 ? 0.7 + 0.3 * Math.sin(t * Math.PI + i * TAU / n) : 1;   // 2개 = 번갈아 숨쉼(색이 섞여 탁해지지 않게)
        var a = E.a * Ly.s * breathe * (0.75 + 0.35 * f);
        ctx.globalCompositeOperation = 'lighter';
        if (els[i] === 'fire') drawGlow(ctx, m, Ly.glow, E.glow, a * 0.55, 1.0 + 0.04 * f, up.x * (0.8 + 1.4 * f), up.y * (0.8 + 1.4 * f));   // 위로 핥는 불꽃
        if (els[i] === 'darkness') { ctx.globalCompositeOperation = 'source-over'; drawGlow(ctx, m, 'B', '#12021f', 0.55 * Ly.s * breathe, 1.03); ctx.globalCompositeOperation = 'lighter'; }
        drawGlow(ctx, m, Ly.glow, E.glow, a, 1.0 + 0.03 * (f - 0.5));
        if (i === 0) drawGlow(ctx, m, 'B', E.glow, a * 0.45, 1.14 + 0.04 * f);   // 주인공 속성: 바깥 큰 빛 한 겹 더(게임 화면에서 잘 보이게)
        if (Ly.core && els[i] !== 'darkness') drawGlow(ctx, m, Ly.core, E.core, a * 0.35, 1.0);
        if (els[i] === 'lightning' && hash(Math.floor(t * 15), 99) < 0.25) drawGlow(ctx, m, 'A', '#cfe6ff', 0.5 * Ly.s, 1.0);
      }
    } else {
      var R = spawnRange(m, kind);
      for (var j = 0; j < n; j++) { var fn = PART[els[j]]; if (fn) fn(ctx, m, R, { t: t + j * 0.31, s: j === 0 ? 1 : 0.35, up: up, seed: j * 3 }); }
    }
    ctx.restore();
  }

  // +10 신화 고유 효과(js/mythicfx.js): 오라와 같은 단위 맞춤(1배 그림 점). power = 속성 오라도 있으면 조금 약하게(0.7)
  function mythic(ctx, wDef, img, angle, pass, power, t) {
    if (!window.MythicFx || !img) return;
    var WS = (CFG && CFG.weaponScale) || 1, k = img._k || 1;
    ctx.save();
    ctx.scale(WS, WS);
    MythicFx.draw(ctx, { grip: { x: wDef.grip.x * k / WS, y: wDef.grip.y * k / WS }, size: [img.width * k / WS, img.height * k / WS], kind: wDef.kind || 'sword' }, img,
      t != null ? t : performance.now() / 1000, angle, { pass: pass, power: power == null ? 1 : power });
    ctx.restore();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  // ================= 2) 속성 효과 =================
  var FXC = null;              // config enchant.fx
  var tracked = [];            // 화상·독·얼음 상태가 있는 적
  var arcs = [], mists = [];   // 튀는 번개 줄 · 법사 마법 자리 속성 안개
  var numT = [];               // 지속 피해 숫자 시각(화면 전체 개수 제한)
  var chainT = [];             // 튄 번개 시각(1초 제한)
  var ls = { t: 0, used: 0, acc: 0 };   // 흡혈: 1초 동안 찬 양
  var mistT = {};              // 속성별 마지막 안개 시각
  var sparkT = 0;              // 맞은 곳 불티(한 장면에 몇 번만)
  var now = 0;                 // 게임 시간(ms)
  var LOG = null;              // 시험 기록(GAME.test.elLog): { burn, poison, spread, slow, freeze, chain, lifesteal, resonance, crit }
  function st(e) { if (!e._el) { e._el = { burn: null, poi: null, iceN: 0, frzT: 0, frzCd: 0, darkT: 0, litT: 0 }; tracked.push(e); } return e._el; }
  function log(k, n) { if (LOG) { LOG[k] = (LOG[k] || 0) + (n == null ? 1 : n); } }
  function alive(e) { return e && e.alive && e.alive() && !e.remove; }
  function isBig(e) { return !!(e.T && (e.T.boss || e.mid || e.T.midBoss || e.T.poise)); }

  // 지속 피해 · 튀는 번개 데미지: 맞는 동작 없이 체력만(번쩍 조금). 쓰러뜨리면 main.js 의 H.kill(보통 쓰러짐 길로)
  //   마왕(각성하는 보스)은 각성 문턱 아래로 지속 피해만으로는 안 내려감(각성 연출을 건너뛰지 않게)
  function hurt(e, n, style) {
    if (!alive(e) || e.hidden || e.state === 'awaken' || (e.teleInvuln && e.teleInvuln())) return 0;
    n = Math.max(1, Math.round(n));
    var T = e.T;
    if (T && T.awaken && !e.awakened) { n = Math.min(n, e.hp - Math.ceil(e.maxHp * T.enrageAt) - 1); if (n <= 0) return 0; }
    if (e.hp - n <= 0) { n = e.hp; H.kill(e, n); }
    else { e.hp -= n; e.flashT = Math.max(e.flashT || 0, 40); }
    num(e, n, style);
    return n;
  }
  function num(e, n, style) {
    var D = EN.dotNum || {};
    while (numT.length && now - numT[0] > (D.gapMs || 250)) numT.shift();
    if (numT.length >= (D.max || 6)) return;
    numT.push(now);
    FX.damage(e.x, e.y - e.T.height - 4 * AS(), n, false, CFG.juice, null, style, (e.id || 'e') + ':' + style, true);
  }

  // main.js onHit 가 데미지를 준 뒤: p = 플레이어, e = 맞은 적(살아 있든 방금 쓰러졌든), dmg = 준 데미지,
  //   o = { els: 켜진 속성, k: 효과 세기(법사 평타 = mageBasic), x, y: 맞은 곳, skill: 기술 타, mage: 법사 }
  function onHit(p, e, dmg, o) {
    var els = o.els; if (!els || !els.length || !e || !e.T || !(dmg > 0)) return;
    var k = o.k || 1, F = FXC, s = st(e), live = alive(e);
    els.forEach(function (el) {
      var q = F[el];
      if (el === 'fire' && live) {
        var b = s.burn || (s.burn = { pool: 0, t: 0, tick: 0 });
        b.pool = Math.min(b.pool + dmg * q.pct * k, Math.max(b.pool, dmg * q.cap * k));
        b.t = q.ms; if (!(b.tick > 0)) b.tick = q.tick;
      } else if (el === 'poison' && live) {
        var P = s.poi || (s.poi = { n: 0, per: 0, t: 0, tick: 0 });
        P.n = Math.min(q.max, P.n + 1); P.per = Math.max(P.per * 0.9, dmg * q.pct * k); P.t = q.ms; if (!(P.tick > 0)) P.tick = q.tick;
        P.spreadDone = false;
      } else if (el === 'ice' && live) {
        var K = isBig(e) ? q.bossSlow : q.slow;
        if (!(e.slowT > 0) || (e.slowK || 1) >= K) e.slowK = K;
        e.slowT = Math.max(e.slowT || 0, q.ms);
        log('slow');
        if (!isBig(e) && !(s.frzCd > 0) && ++s.iceN >= q.freezeHits) {
          s.iceN = 0; s.frzT = q.freezeMs; s.frzCd = q.freezeMs + q.freezeCdMs;
          e.slowT = Math.max(e.slowT, q.freezeMs); e.slowK = 0.02;
          log('freeze');
          if (window.Skills && Skills.debris) Skills.debris(e.x, e.y - e.T.height * 0.5, e.y, 8, { cols: ['#ffffff', '#d8f8ff', '#9fe8ff'], glow: true, sp: 140, size: 1.4, ms: 380 });
        }
      } else if (el === 'lightning' && !o.chained) {
        while (chainT.length && now - chainT[0] > 1000) chainT.shift();
        if (chainT.length < q.capPerSec && Math.random() < q.chance) {
          var near = H.enemies().filter(function (t) { return t !== e && alive(t) && !t.hidden && Math.abs(t.x - e.x) < q.r * AS() / 0.55 && Math.abs(t.y - e.y) < 30 * AS() / 0.55; })
            .sort(function (a, b) { return Math.abs(a.x - e.x) - Math.abs(b.x - e.x); }).slice(0, q.n);
          if (near.length) chainT.push(now);
          near.forEach(function (t) {
            var y0 = e.y - e.T.height * 0.55, y1 = t.y - t.T.height * 0.55;
            arcs.push({ x0: e.x, y0: y0, x1: t.x, y1: y1, t: 0, life: 170, seed: Math.random() * 100 });
            var n = hurt(t, dmg * q.pct * k, 'chain');
            if (n) { log('chain'); log('chainDmg', n); }
            if (alive(t)) onHit(p, t, Math.round(dmg * q.pct * k), { els: els.filter(function (x) { return x !== 'lightning'; }), k: k * 0.5, chained: true });   // 튄 번개도 다른 속성은 약하게 묻음
          });
        }
      } else if (el === 'light' && !o.chained && p && p.state !== 'dead') {
        if (now - ls.t > 1000) { ls.t = now; ls.used = 0; }
        var capN = p.maxHp * q.capPerSec - ls.used;
        var hl = Math.min(Math.max(0, capN), dmg * q.pct * k);
        if (hl > 0) {
          ls.used += hl; ls.acc += hl;
          var whole = Math.floor(ls.acc);
          if (whole > 0 && p.hp < p.maxHp) {
            ls.acc -= whole; whole = Math.min(whole, p.maxHp - p.hp); p.hp += whole;
            log('lifesteal', whole);
            FX.damage(p.x, p.y - (p.z || 0) - 112 * AS(), whole, false, CFG.juice, null, 'heal', 'player:el', true);
          } else if (p.hp >= p.maxHp) ls.acc = Math.min(ls.acc, 1);
        }
      }
    });
    // 맞은 곳 속성 색 불티(한 장면에 4번까지, 튄 번개 빼고)
    if (!o.chained && sparkT < 4 && window.Skills && Skills.debris) {
      sparkT++;
      var c0 = EN.el[els[0]], c1 = EN.el[els[els.length - 1]];
      Skills.debris(o.x != null ? o.x : e.x, o.y != null ? o.y : e.y - e.T.height * 0.5, e.y, o.skill ? 5 : 3, { cols: ['#ffffff', c0.col, c0.col2, c1.col], glow: true, sp: 150, size: 1.3, ms: 300 });
    }
    if (els.indexOf('darkness') >= 0 && live) s.darkT = 1600;   // 어둠: 머리 위 보라 문양 잠깐
    if (els.indexOf('light') >= 0 && live) s.litT = 500;
    // 기술 맞은 곳 = 속성 터짐(법사는 크게, 기사 기술은 작게). 속성마다 0.12초에 하나(메테오 · 몹 떼에 여러 번 맞아도 한 번)
    if (o.skill && !o.chained) els.forEach(function (el, i) {
      if (now - (mistT[el] || -1e9) < 120) return;
      mistT[el] = now;
      burst(el, o.x != null ? o.x : e.x, o.y != null ? o.y : e.y - e.T.height * 0.5, e.y, o.mage ? (i === 0 ? 1.3 : 0.85) : (i === 0 ? 0.6 : 0.35), p);
    });
  }

  // ---------- 법사 기술 속성 연출(2026-11-06 형님: 「확실히 보이게」) ----------
  //   (a) 날아가는 마법(마법탄 · 화염구 · 얼음창 · 검기) · 떨어지는 운석에 속성 꼬리 + 둘레 빛 (속성 첫째 = 가장 세게, 나머지 작게)
  //   (b) 맞은 곳 속성 터짐: 불 = 불꽃 터짐 / 독 = 1초 남는 독 구름 / 얼음 = 깨지는 얼음 + 서리 고리 / 번개 = 사방으로 튀는 번개 /
  //       바람 = 소용돌이 / 어둠 = 검은 연기 / 빛 = 번쩍 + 플레이어에게 날아가는 빛 알갱이
  //   (c) 적 상태: 불탐(깜빡이는 불씨) · 독(초록 빛 + 거품) · 얼음(얼음 덩이) · 어둠(머리 위 보라 문양)
  //   파티클은 pts(최대 220개) + Skills.debris/glow/wave(사냥 손맛 캡 안)
  var pts = [], trailT = 0;
  function addPt(o) { if (pts.length < 220) pts.push(o); }
  function trailAt(el, x, y, k) {
    var E = EN.el[el], r = Math.random;
    if (el === 'fire') addPt({ x: x, y: y, vx: (r() - 0.5) * 30, vy: -30 - r() * 40, g: -20, t: 0, life: 380, s: 2.2 * k, c: [ '#fff2a8', '#ffb43a', '#ff5a1a'] });
    else if (el === 'poison') addPt({ x: x + (r() - 0.5) * 6, y: y, vx: (r() - 0.5) * 12, vy: 10, g: 260, t: 0, life: 520, s: 2 * k, c: ['#d8ff8a', '#7ee03a', '#3a9a1a'], drip: true });
    else if (el === 'ice') addPt({ x: x + (r() - 0.5) * 8, y: y + (r() - 0.5) * 8, vx: (r() - 0.5) * 20, vy: (r() - 0.5) * 20, g: 30, t: 0, life: 420, s: 1.6 * k, c: ['#ffffff', '#d8f8ff', '#8fd8ff'], tw: true });
    else if (el === 'lightning') { if (r() < 0.5 * k + 0.2) arcs.push({ x0: x + (r() - 0.5) * 10, y0: y + (r() - 0.5) * 10, x1: x + (r() - 0.5) * 34 * k, y1: y + (r() - 0.5) * 26 * k, t: 0, life: 90, seed: r() * 100, small: true }); }
    else if (el === 'wind') { var a = r() * TAU; addPt({ x: x + Math.cos(a) * 9, y: y + Math.sin(a) * 6, vx: -Math.sin(a) * 90, vy: Math.cos(a) * 60, g: 0, t: 0, life: 260, s: 1.3 * k, c: ['#ffffff', '#e8fff6', '#b8e8d8'], streak: true }); }
    else if (el === 'darkness') addPt({ x: x + (r() - 0.5) * 6, y: y + (r() - 0.5) * 6, vx: (r() - 0.5) * 16, vy: -14, g: -10, t: 0, life: 600, s: 4 * k, c: ['#3d1266', '#1c0630'], smoke: true });
    else if (el === 'light') addPt({ x: x + (r() - 0.5) * 8, y: y + (r() - 0.5) * 8, vx: (r() - 0.5) * 14, vy: -18, g: -10, t: 0, life: 500, s: 1.5 * k, c: ['#ffffff', '#fff3b8', '#ffd23f'], tw: true });
  }
  // 터짐 하나(k = 크기 · 세기)
  function burst(el, x, y, floor, k, p) {
    var S = window.Skills, E = EN.el[el], A = AS() / 0.55, i;
    if (!S) return;
    S.glow(x, y, 50 * A * k, E.col, 380, 0.9 * k);
    S.wave(x, floor, 58 * A * k, { flat: 0.3, w: 3, ms: 380, color: E.col2, glow: E.col, ground: true, noMax: true });   // 속성 색 고리(모든 속성)
    if (el === 'fire') {
      S.debris(x, y, floor, Math.round(12 * k), { cols: ['#fff2a8', '#ffb43a', '#ff5a1a', '#ff3a10'], glow: true, sp: 220, size: 1.8, ms: 460, g: 120 });
      S.wave(x, floor, 46 * A * k, { flat: 0.3, w: 3, ms: 300, color: '#ffd27a', glow: '#ff6a10', ground: true, noMax: true });
    } else if (el === 'poison') {
      if (mists.length < 16) mists.push({ x: x, y: floor, h: 18 * A, el: 'poison', t: 0, life: 1100, r: 44 * A * k });
      S.debris(x, y, floor, Math.round(8 * k), { cols: ['#d8ff8a', '#7ee03a', '#3a9a1a'], glow: false, sp: 120, size: 2, ms: 600, g: 380 });
      for (i = 0; i < Math.round(5 * k); i++) addPt({ x: x + (Math.random() - 0.5) * 30 * k, y: floor - Math.random() * 10, vx: 0, vy: -20 - Math.random() * 20, g: 0, t: 0, life: 700, s: 2.4 * k, c: ['#c8ff7a'], bubble: true });
    } else if (el === 'ice') {
      S.debris(x, y, floor, Math.round(12 * k), { cols: ['#ffffff', '#d8f8ff', '#9fe8ff', '#6ac8ff'], glow: true, sp: 200, size: 1.9, ms: 520, g: 420, spread: 1.6 });
      S.wave(x, floor, 50 * A * k, { flat: 0.32, w: 3, ms: 360, color: '#ffffff', glow: '#7fd8ff', ground: true, noMax: true });
    } else if (el === 'lightning') {
      for (i = 0; i < Math.round(4 * k) + 1; i++) { var a = Math.random() * TAU, L = (24 + Math.random() * 26) * A * k; arcs.push({ x0: x, y0: y, x1: x + Math.cos(a) * L, y1: y + Math.sin(a) * L * 0.6, t: 0, life: 160, seed: Math.random() * 100 }); }
      S.debris(x, y, floor, Math.round(8 * k), { cols: ['#ffffff', '#fff6a0', '#5ae6ff'], glow: true, sp: 260, size: 1.3, ms: 260 });
    } else if (el === 'wind') {
      for (i = 0; i < Math.round(14 * k); i++) { var b = i / (14 * k) * TAU; addPt({ x: x + Math.cos(b) * 6, y: y + Math.sin(b) * 4, vx: -Math.sin(b) * 160 + Math.cos(b) * 50, vy: (Math.cos(b) * 100 + Math.sin(b) * 30) * 0.55, g: 0, t: 0, life: 360, s: 1.5 * k, c: ['#ffffff', '#e8fff6', '#b8e8d8'], streak: true }); }
      S.wave(x, floor, 40 * A * k, { flat: 0.4, w: 2, ms: 300, color: '#f2fff8', glow: '#a8f7e2', ground: true, noMax: true });
    } else if (el === 'darkness') {
      for (i = 0; i < Math.round(7 * k); i++) addPt({ x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 14, vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 30, g: -10, t: 0, life: 700, s: 6 * k, c: ['#3d1266', '#1c0630', '#5a1a8a'], smoke: true });
      S.debris(x, y, floor, Math.round(6 * k), { cols: ['#b77cff', '#7a2cff'], glow: true, sp: 160, size: 1.4, ms: 420 });
    } else if (el === 'light') {
      S.glow(x, y, 52 * A * k, '#fffbe0', 220, 0.8 * k);
      if (p) for (i = 0; i < Math.round(5 * k); i++) addPt({ x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 12, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 60, g: 0, t: 0, life: 1400, s: 1.8, c: ['#ffffff', '#fff3b8'], home: p, wait: 180 + Math.random() * 120 });
    }
  }
  function ptsStep(dt) {
    var s = dt / 1000;
    for (var i = pts.length - 1; i >= 0; i--) {
      var q = pts[i]; q.t += dt;
      if (q.home && q.t > q.wait) {   // 빛 알갱이: 플레이어에게 빨려 듦
        var tx = q.home.x, ty = q.home.y - (q.home.z || 0) - 40 * AS(), dx = tx - q.x, dy = ty - q.y, d = Math.hypot(dx, dy) || 1, mx = 140 + (q.t - q.wait) * 0.9;
        q.vx += (dx / d * mx - q.vx) * Math.min(1, s * 8); q.vy += (dy / d * mx - q.vy) * Math.min(1, s * 8);
        if (d < 8) { pts.splice(i, 1); continue; }
      } else { q.vy += (q.g || 0) * s; if (!q.home) { q.vx *= Math.exp(-s * 2); } else { q.vx *= Math.exp(-s * 4); q.vy *= Math.exp(-s * 4); } }
      q.x += q.vx * s; q.y += q.vy * s;
      if (q.t >= q.life) pts.splice(i, 1);
    }
  }
  function drawPts(ctx, camX) {
    pts.forEach(function (q) {
      var u = q.t / q.life, a = q.tw ? Math.sin(Math.PI * u) : 1 - u * u, c = q.c[Math.min(q.c.length - 1, Math.floor(u * q.c.length))], x = q.x - camX;
      if (q.smoke) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.5 * Math.sin(Math.PI * Math.min(1, u * 1.2)); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, q.y, q.s * (0.5 + u), 0, TAU); ctx.fill(); return; }
      ctx.globalCompositeOperation = q.drip || q.bubble ? 'source-over' : 'lighter';
      if (q.bubble) { ctx.globalAlpha = 0.85 * (1 - u); ctx.strokeStyle = c; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(x, q.y, q.s * (0.6 + u * 0.6), 0, TAU); ctx.stroke(); return; }
      ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = c;
      if (q.streak) { ctx.save(); ctx.translate(x, q.y); ctx.rotate(Math.atan2(q.vy, q.vx)); ctx.fillRect(-q.s * 3, -q.s * 0.35, q.s * 6, q.s * 0.7); ctx.restore(); return; }
      ctx.fillRect(x - q.s / 2, q.y - q.s / 2, q.s, q.drip ? q.s * 1.6 : q.s);
    });
  }
  // 날아가는 마법 · 운석 둘레 빛 + 꼬리(매 장면)
  var flying = [];
  function trailStep(dt) {
    flying.length = 0;
    var p = H.player && H.player(), els = p && p.els;
    if (!els || !els.length) return;
    (window.Projectiles ? Projectiles.list : []).forEach(function (q) { if (!q.dead) flying.push({ x: q.x, y: q.y, big: false }); });
    if (window.Skills && Skills.meteorsNow) Skills.meteorsNow().forEach(function (m) { flying.push({ x: m.x, y: m.y, big: true }); });
    if (!flying.length) return;
    trailT -= dt;
    if (trailT > 0) return;
    trailT = 20;
    flying.forEach(function (f) { els.forEach(function (el, i) { var k = (i === 0 ? 1 : 0.55) * (f.big ? 1.6 : 1); trailAt(el, f.x, f.y, k); if (i === 0 || f.big) trailAt(el, f.x, f.y, k); }); });
  }
  function drawFlying(ctx, camX) {
    var p = H.player && H.player(), els = p && p.els;
    if (!els || !els.length || !flying.length) return;
    var t = now / 1000;
    ctx.globalCompositeOperation = 'lighter';
    flying.forEach(function (f) {
      els.forEach(function (el, i) {
        var R = (f.big ? 40 : 22) * AS() / 0.55 * (i === 0 ? 1 : 0.7) * (1 + 0.1 * Math.sin(t * 20 + i));
        puff(ctx, rgbOf(EN.el[el].col), f.x - camX, f.y, R, R * 0.8, i === 0 ? 0.85 : 0.5);
      });
    });
  }

  // 매 장면: 지속 피해 · 얼음 시간 · 독 퍼짐 · 번개 줄 · 안개
  function update(dt) {
    now += dt; sparkT = 0;
    trailStep(dt); ptsStep(dt);
    var F = FXC;
    for (var i = tracked.length - 1; i >= 0; i--) {
      var e = tracked[i], s = e._el;
      if (s.frzT > 0) s.frzT -= dt;
      if (s.frzCd > 0) s.frzCd -= dt;
      if (s.darkT > 0) s.darkT -= dt;
      if (s.litT > 0) s.litT -= dt;
      if (!alive(e)) {
        // 독 걸린 채 쓰러짐 → 가까운 적에게 독 절반이 옮음(한 번)
        var P0 = s.poi;
        if (P0 && P0.n > 0 && P0.t > 0 && !P0.spreadDone && e.state === 'dead') {
          P0.spreadDone = true;
          var q = F.poison, nn = Math.max(1, Math.ceil(P0.n / 2));
          var near = H.enemies().filter(function (t) { return t !== e && alive(t) && Math.abs(t.x - e.x) < q.r * AS() / 0.55 && Math.abs(t.y - e.y) < 30 * AS() / 0.55; })
            .sort(function (a, b) { return Math.abs(a.x - e.x) - Math.abs(b.x - e.x); }).slice(0, q.spreadN);
          near.forEach(function (t) {
            var S = st(t), P = S.poi || (S.poi = { n: 0, per: 0, t: 0, tick: 0 });
            P.n = Math.min(q.max, Math.max(P.n, nn)); P.per = Math.max(P.per, P0.per); P.t = q.ms; if (!(P.tick > 0)) P.tick = q.tick;
            arcs.push({ x0: e.x, y0: e.y - e.T.height * 0.4, x1: t.x, y1: t.y - t.T.height * 0.4, t: 0, life: 320, seed: 0, poison: true });
            log('spread');
          });
          mists.push({ x: e.x, y: e.y, h: e.T.height * 0.3, el: 'poison', t: 0, life: 900, r: 30 * AS() / 0.55 });
        }
        if (!e.remove && e.state === 'dead' && !(P0 && !P0.spreadDone && P0.t > 0)) { tracked.splice(i, 1); e._el = null; }
        else if (e.remove) { tracked.splice(i, 1); e._el = null; }
        continue;
      }
      var b = s.burn;
      if (b && b.t > 0) {
        b.t -= dt; b.tick -= dt;
        if (b.tick <= 0) {
          var left = Math.max(1, Math.ceil((b.t + F.fire.tick) / F.fire.tick)), d = b.pool / left;
          b.pool -= d; b.tick += F.fire.tick;
          if (d >= 0.5) { var n1 = hurt(e, d, 'dot_fire'); log('burn'); log('burnDmg', n1); }
        }
        if (b.t <= 0) s.burn = null;
      }
      var P = s.poi;
      if (P && P.t > 0 && alive(e)) {
        P.t -= dt; P.tick -= dt;
        if (P.tick <= 0) { P.tick += F.poison.tick; var n2 = hurt(e, P.n * P.per, 'dot_poison'); log('poison'); log('poisonDmg', n2); }
        if (P.t <= 0) { P.n = 0; }
      }
    }
    for (var a = arcs.length - 1; a >= 0; a--) if ((arcs[a].t += dt) >= arcs[a].life) arcs.splice(a, 1);
    for (var m = mists.length - 1; m >= 0; m--) if ((mists[m].t += dt) >= mists[m].life) mists.splice(m, 1);
  }

  // 적 위 표시(몸 앞): 불타는 적 = 작은 불씨, 독 = 초록 거품, 얼음 = 하늘색 얼음 덩이
  function rgbOf(h) { var n = parseInt(h.slice(1), 16); return (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255); }
  function drawOver(ctx, camX) {
    var t = now / 1000;
    ctx.save();
    // 안개(바닥에 깔림)
    mists.forEach(function (q) {
      var u = q.t / q.life, a = Math.sin(Math.PI * Math.min(1, u * 1.3)) * (q.el === 'poison' ? 0.42 : 0.3), col = rgbOf(EN.el[q.el].col);
      ctx.globalCompositeOperation = q.el === 'darkness' ? 'source-over' : 'lighter';
      for (var j = 0; j < 3; j++) {
        var rx = q.r * (0.6 + 0.5 * u) * (1 - j * 0.2), dx = (j - 1) * q.r * 0.45 + Math.sin(t * 2 + j) * 3;
        puff(ctx, col, q.x - camX + dx, q.y - q.h * (0.3 + 0.5 * u) - j * 3, rx, rx * 0.55, a);
      }
    });
    tracked.forEach(function (e) {
      if (!alive(e)) return;
      var s = e._el, x = e.x - camX, top = e.y - e.T.height, h = e.T.height, wR = e.T.radius || 12;
      ctx.globalCompositeOperation = 'lighter';
      if (s.burn && s.burn.t > 0) for (var i = 0; i < 4; i++) {
        var L = life(t, 0.55, hash(i, e.id || 1)), px0 = x + (hash(i + L.c, 3) * 2 - 1) * wR * 0.8, py = e.y - h * (0.2 + 0.6 * hash(i + L.c, 4)) - L.ph * 10;
        px(ctx, L.ph < 0.4 ? '#fff0a0' : L.ph < 0.7 ? '#ff9a2a' : '#ff4a10', px0, py, L.ph < 0.5 ? 2 : 1.5, (1 - L.ph) * 0.9);
      }
      if (s.burn && s.burn.t > 0) puff(ctx, '255,110,30', x, e.y - h * 0.45, wR * 1.2, h * 0.5, 0.22 + 0.12 * Math.sin(t * 25 + (e.id || 0)));   // 불탐: 깜빡이는 주황 빛
      if (s.poi && s.poi.t > 0 && s.poi.n > 0) {
        puff(ctx, '90,255,40', x, e.y - h * 0.45, wR * 1.15, h * 0.5, 0.12 + 0.04 * s.poi.n);   // 독: 초록 빛(겹이 많을수록 진함)
        ctx.globalCompositeOperation = 'source-over';
        for (var j = 0; j < Math.min(5, 1 + s.poi.n); j++) {
          var L2 = life(t, 0.8, hash(j, (e.id || 1) + 9)), bx = x + (hash(j + L2.c, 7) * 2 - 1) * wR * 0.7, by = top + h * 0.25 - L2.ph * 9;
          ctx.globalAlpha = (1 - L2.ph) * 0.85; ctx.strokeStyle = '#8dff3a'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.arc(bx, by, 0.9 + L2.ph * 1.2, 0, TAU); ctx.stroke();
        }
      }
      if (s.darkT > 0) {   // 어둠: 머리 위 보라 문양(빙글 도는 마름모 + 눈)
        var da = Math.min(1, s.darkT / 300), my = top - 8 * AS() / 0.55, rr = 5, an = t * 3;
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.85 * da; ctx.strokeStyle = '#b46aff'; ctx.lineWidth = 1.2;
        ctx.beginPath(); for (var q2 = 0; q2 < 4; q2++) { var aa = an + q2 * Math.PI / 2; ctx[q2 ? 'lineTo' : 'moveTo'](x + Math.cos(aa) * rr, my + Math.sin(aa) * rr * 0.6); } ctx.closePath(); ctx.stroke();
        ctx.fillStyle = '#e8c8ff'; ctx.fillRect(x - 1, my - 1, 2, 2);
      }
      if (s.frzT > 0) {   // 얼음: 몸 위에 하늘색 얼음 덩이(반투명) + 테두리
        var a = Math.min(1, s.frzT / 200);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.32 * a; ctx.fillStyle = '#bfefff';
        ctx.fillRect(x - wR * 0.95, top + h * 0.05, wR * 1.9, h * 0.95);
        ctx.globalAlpha = 0.8 * a; ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 1;
        ctx.strokeRect(x - wR * 0.95 + 0.5, top + h * 0.05 + 0.5, wR * 1.9 - 1, h * 0.95 - 1);
        ctx.globalAlpha = 0.9 * a; ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - wR * 0.6, top + h * 0.15, 1.5, h * 0.3); ctx.fillRect(x - wR * 0.45, top + h * 0.12, 1, h * 0.12);
      }
    });
    // 튀는 번개 줄(하늘·흰 지그재그) · 독이 옮는 줄(초록 점선)
    ctx.globalCompositeOperation = 'lighter';
    arcs.forEach(function (q) {
      var u = q.t / q.life, pts = [], n = 6;
      for (var k = 0; k <= n; k++) {
        var f = k / n, j = (k === 0 || k === n) ? 0 : (hash(k + Math.floor(q.t / 40), q.seed) * 2 - 1) * 7;
        pts.push([q.x0 + (q.x1 - q.x0) * f - camX, q.y0 + (q.y1 - q.y0) * f + j - (q.poison ? Math.sin(f * Math.PI) * 14 : 0)]);
      }
      if (q.poison) {
        ctx.globalAlpha = 0.8 * (1 - u); ctx.fillStyle = '#8dff3a';
        for (var z = 0; z < 8; z++) { var ff = (z / 8 + u) % 1, i0 = Math.min(n - 1, Math.floor(ff * n)), w0 = ff * n - i0; ctx.fillRect(pts[i0][0] + (pts[i0 + 1][0] - pts[i0][0]) * w0 - 1, pts[i0][1] + (pts[i0 + 1][1] - pts[i0][1]) * w0 - 1, 2, 2); }
        return;
      }
      ctx.globalAlpha = 0.5 * (1 - u); ctx.strokeStyle = '#5ab4ff'; ctx.lineWidth = q.small ? 2 : 3; poly(ctx, pts);
      ctx.globalAlpha = 1 - u; ctx.strokeStyle = '#fffbe0'; ctx.lineWidth = q.small ? 0.8 : 1.1; poly(ctx, pts);
    });
    drawFlying(ctx, camX);
    drawPts(ctx, camX);
    ctx.restore();
  }

  // ================= 3) 바닥의 강화석 · 속성 결정 =================
  var items = [];
  // 도트 그림(0.5 도트 점, 물약병과 같은 방식): 강화석 = 푸른 회색 원석 + 하늘색 결, 결정 = 길쭉한 마름모(속성 색 3단)
  var art = {};
  function shade(hex, k) { var n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; function f(v) { return Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); } return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')'; }
  function paint(W, Hh, fn, PAL) {
    var m = [], x, y;
    for (y = 0; y < Hh; y++) for (x = 0; x < W; x++) m.push(fn(x, y));
    var c = mk(W, Hh), g = c.getContext('2d');
    g.fillStyle = '#140a14';
    for (y = 0; y < Hh; y++) for (x = 0; x < W; x++) {
      if (m[y * W + x]) continue;
      if ((x > 0 && m[y * W + x - 1]) || (x < W - 1 && m[y * W + x + 1]) || (y > 0 && m[(y - 1) * W + x]) || (y < Hh - 1 && m[(y + 1) * W + x])) g.fillRect(x, y, 1, 1);
    }
    for (y = 0; y < Hh; y++) for (x = 0; x < W; x++) { var k = m[y * W + x]; if (k) { g.fillStyle = PAL[k]; g.fillRect(x, y, 1, 1); } }
    c._k = 0.5; c._dots = true;
    return c;
  }
  function stoneImg() {
    if (art.stone) return art.stone;
    // 20x18 점: 깎인 원석(팔각) — 왼쪽 위 밝은 면 · 가운데 · 오른쪽 아래 어두운 면 + 하늘색 결 두 줄 + 반짝
    var cx = 9.5, cy = 9.5;
    art.stone = paint(20, 18, function (x, y) {
      var dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (Math.abs(dx) + Math.abs(dy) * 1.1 > 11 || Math.abs(dx) > 8.6 || dy < -7.6 || dy > 7.6) return null;
      if ((x === 6 && y === 5) || (x === 7 && y === 4) || (x === 5 && y === 6)) return 'shine';
      if ((x - y === 3 && x > 8 && x < 15) || (x + y === 19 && x > 9 && x < 15)) return 'vein';
      return dx + dy < -4 ? 'light' : dx + dy > 4 ? 'dark' : 'mid';
    }, { light: '#c8d8ec', mid: '#8aa0bc', dark: '#4e5e7a', vein: '#7fe0ff', shine: '#ffffff' });
    return art.stone;
  }
  function crysImg(el) {
    if (art[el]) return art[el];
    var E = EN.el[el], cx = 6.5, cy = 11;
    // 14x22 점: 길쭉한 마름모 결정. 왼쪽 면 밝음 · 오른쪽 면 어두움 · 가운데 줄 · 반짝
    art[el] = paint(14, 22, function (x, y) {
      var dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (Math.abs(dx) / 6.2 + Math.abs(dy) / 10.6 > 1) return null;
      if ((x === 4 && (y === 6 || y === 7)) || (x === 5 && y === 5)) return 'shine';
      if (Math.abs(dx) < 0.6) return 'mid';
      return dx < 0 ? (dy < 0 ? 'light' : 'mid') : (dy < 0 ? 'mid' : 'dark');
    }, { light: E.col2, mid: E.col, dark: shade(E.col, -0.45), shine: '#ffffff' });
    return art[el];
  }
  // 강화석(kind 'stone') 또는 결정(kind 'crys', el = 속성) 하나 떨어뜨림
  function drop(kind, el, x, y, dir) {
    var P = EN;
    items.push({ kind: kind, el: el || null, x: x + (dir || 1) * 6 * AS(), y: y, vx: (dir || 1) * (24 + Math.random() * 20) * AS(), z: 0, vz: Math.sqrt(2 * 900 * P.hop) * (0.85 + Math.random() * 0.3), t: 0, bounced: false, ph: Math.random() * 6 });
  }
  // tiny = 끌려 들어와 주움(던전 끌어당김): 큰 빛·불티 대신 들어간 자리에 작은 반짝(+ 모양 별)만
  function pick(f, p, tiny) {
    if (H.got) H.got(f.kind, f.el);
    var col = f.kind === 'stone' ? ['#e8f4ff', '#7fe0ff'] : [EN.el[f.el].col2, EN.el[f.el].col];
    var y = p.y - (p.z || 0) - 100 * AS();
    FX.damage(p.x, y, f.kind === 'stone' ? '강화석 +1' : EN.el[f.el].name + ' 결정 +1', false, CFG.juice, null, f.kind === 'stone' ? 'stone' : 'el_' + f.el, 'player:pick' + (f.el || ''), false);
    if (tiny) { twinkles.push({ x: f.x, y: f.y - f.z, t: 0, col: col[1] }); if (twinkles.length > 24) twinkles.shift(); return; }
    if (window.Skills && Skills.glow) Skills.glow(p.x, p.y - 30 * AS(), 26 * AS() / 0.55, col[1], 320, 0.6);
    if (window.Skills && Skills.debris) Skills.debris(p.x, p.y - 16 * AS(), p.y, 8, { cols: ['#ffffff', col[0], col[1]], glow: true, sp: 120, size: 1.3, ms: 460, g: -80, spread: 0.7 });
  }
  // ---------- 끌어당김(2026-11-07 던전 전용, config dungeons.○○.magnet): 작은 블랙홀에 빨려 들듯 ----------
  //   떨어지고 M.delayMs 뒤 플레이어 가로 M.r · 위아래 M.depth 안에 들면 붙잡힘(f.mag) → M.ms 동안 M.turns 바퀴 빙글 돌며
  //   (바닥 원근이라 위아래는 납작하게) 가슴 높이로 빨려 들고, 끝으로 갈수록 빨라지며 M.shrink 배까지 작아짐 → 들어가는 순간 작은 반짝(twinkles)
  //   MAG = null 이면(판) 예전처럼 밟아서 주움. main.js 가 판 · 던전을 시작할 때 setMagnet(그 판 magnet 또는 null)
  var MAG = null, twinkles = [];
  function setMagnet(M) { MAG = M && M.on !== false ? M : null; }
  function magnetStep(f, p, dt) {
    var M = f.mag, cy = 22 * AS() / 0.55;   // 빨려 드는 곳 = 플레이어 가슴(바닥에서 cy 도트 위)
    M.t += dt;
    var u = Math.min(1, M.t / M.ms), e = u * u * (3 - 2 * u) * 0.35 + u * u * 0.65;   // 처음엔 천천히, 끝에 휙
    var r = M.r0 * (1 - e), a = M.a0 + M.dir * M.turns * Math.PI * 2 * e;
    if (!f.tr) f.tr = [];
    f.tr.unshift(f.x, f.y - f.z); if (f.tr.length > 8) f.tr.length = 8;
    f.x = p.x + Math.cos(a) * r; f.y = p.y + Math.sin(a) * r * 0.45;
    f.z = M.z0 + (cy - M.z0) * e + Math.sin(e * Math.PI) * 6;
    f.sc = 1 - (1 - (MAG && MAG.shrink != null ? MAG.shrink : 0.5)) * e;
    return u >= 1;
  }
  function twinkleStep(dt) { for (var i = twinkles.length - 1; i >= 0; i--) { twinkles[i].t += dt; if (twinkles[i].t > 260) twinkles.splice(i, 1); } }
  // 들어간 순간 작은 반짝: 속성 색 작은 네모 빛 + 하얀 + 모양 별(커졌다 작아짐)
  function drawTwinkles(ctx, camX) {
    if (!twinkles.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    twinkles.forEach(function (w) {
      var k = w.t / 260, a = Math.sin(Math.min(1, k * 1.6) * Math.PI), L = 1 + 3.5 * Math.sin(k * Math.PI), x = snapPx(w.x - camX), y = snapPx(w.y);
      ctx.globalAlpha = a * 0.55; ctx.fillStyle = w.col; ctx.fillRect(x - 2, y - 2, 4, 4);
      ctx.globalAlpha = a; ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 0.5, y - L, 1, L * 2); ctx.fillRect(x - L, y - 0.5, L * 2, 1);
    });
    ctx.restore();
  }
  function updateItems(dt, p) {
    var s = dt / 1000, g = 900, PK = EN.pickup;
    twinkleStep(dt);
    for (var i = items.length - 1; i >= 0; i--) {
      var f = items[i];
      f.t += dt;
      // 끌어당김(던전): 붙잡힌 것은 빙글 돌며 빨려 듦(바닥 튀기 · 화면 띠 안으로 당기기 없음)
      if (f.mag) {
        if (!p || p.state === 'dead') { f.mag = null; f.sc = 1; f.tr = null; f.z = 0; f.vz = 0; f.vx = 0; continue; }   // 쓰러지면 그 자리에 떨어짐(끝에 저절로 주움)
        if (magnetStep(f, p, dt)) { items.splice(i, 1); pick(f, p, true); }
        continue;
      }
      if (MAG && p && p.state !== 'dead' && f.t >= (MAG.delayMs || 0) && Math.abs(p.x - f.x) <= MAG.r && Math.abs(p.y - f.y) <= (MAG.depth || MAG.r)) {
        var dx = f.x - p.x, dy = (f.y - p.y) / 0.45;
        f.mag = { t: 0, ms: MAG.ms || 500, r0: Math.max(4, Math.hypot(dx, dy)), a0: Math.atan2(dy, dx), dir: dx >= 0 ? -1 : 1, turns: MAG.turns != null ? MAG.turns : 1, z0: f.z };
        continue;
      }
      if (f.z > 0 || f.vz > 0) {
        f.x += f.vx * s; f.z += f.vz * s; f.vz -= g * s;
        if (f.z <= 0) { f.z = 0; if (!f.bounced) { f.bounced = true; f.vz = -f.vz * 0.3; f.vx *= 0.4; } else { f.vz = 0; f.vx = 0; } }
      }
      if (H.view) { var V = H.view(); f.y = Math.max(V.laneTop, Math.min(V.laneBottom, f.y)); f.x = Math.max(V.x0 + 8, Math.min(V.x1 - 8, f.x)); }
      if (p && p.state !== 'dead' && f.t >= (EN.pickupDelayMs || 0) && Math.abs(p.x - f.x) <= PK.r && Math.abs(p.y - f.y) <= PK.depth) {
        items.splice(i, 1); pick(f, p);
      }
    }
  }
  // 판을 깸: 바닥에 남은 것 전부 주움(돌려주는 값 = 주운 수)
  function collectAll(p) { var n = items.length; while (items.length) pick(items.pop(), p); return n; }
  function drawItem(ctx, camX, f) {
    var img = f.kind === 'stone' ? stoneImg() : crysImg(f.el), col = f.kind === 'stone' ? '#7fe0ff' : EN.el[f.el].col;
    var bob = f.z > 0 || f.mag ? 0 : Math.sin(f.t / 260 + f.ph) * 1.5 - 1.5, x = snapPx(f.x - camX), y = snapPx(f.y - f.z + bob), hh = img.height * 0.5;
    if (f.mag && f.tr && f.tr.length > 2) {   // 빨려 드는 꼬리: 지나온 자리에 옅어지는 작은 점
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = col;
      for (var q = 0; q < f.tr.length; q += 2) { ctx.globalAlpha = 0.5 * (1 - q / f.tr.length); ctx.fillRect(snapPx(f.tr[q] - camX) - 1, snapPx(f.tr[q + 1]) - hh * 0.5 - 1, 2, 2); }
      ctx.restore();
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    var r = 11, gr = ctx.createRadialGradient(x, y - hh * 0.5, 0, x, y - hh * 0.5, r);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.4 + 0.15 * Math.sin(f.t / 170 + f.ph); ctx.fillStyle = gr; ctx.fillRect(x - r, y - hh * 0.5 - r, r * 2, r * 2);
    ctx.restore();
    ctx.save(); ctx.translate(x, y);
    if (f.sc != null && f.sc !== 1) { ctx.translate(0, -hh * 0.5); ctx.scale(f.sc, f.sc); ctx.translate(0, hh * 0.5); }   // 빨려 들며 작아짐
    Assets.blit(ctx, img, img.width / 2, img.height);
    var ph = ((f.t + f.ph * 300) % 1300) / 1300;
    if (ph < 0.2) { var a = Math.sin(ph / 0.2 * Math.PI), L = 1 + 2.5 * a; ctx.globalAlpha = a; ctx.fillStyle = '#ffffff'; ctx.fillRect(-2.5, -hh + 1 - L, 1, L * 2); ctx.fillRect(-2 - L, -hh + 0.5, L * 2, 1); }
    ctx.restore();
  }
  function addDraw(ents, ctx, camX) { items.forEach(function (f) { ents.push({ y: f.y - 1, d: function () { drawItem(ctx, camX, f); } }); }); }
  function drawUnder(ctx, camX) { items.forEach(function (f) { if (f.mag) return; window.drawShadow(ctx, snapPx(f.x - camX), snapPx(f.y), EN.shadow * (1 - Math.min(0.5, f.z / 30))); }); }
  function snapPx(v) { return window.snapPx ? window.snapPx(v) : v; }

  // 창(main.js)에서 쓰는 작은 그림: 강화석 · 결정 그림을 data URL 로(한 번만)
  var urlCache = {};
  function iconUrl(kind, el) {
    var key = kind + (el || '');
    if (urlCache[key]) return urlCache[key];
    var img = kind === 'stone' ? stoneImg() : crysImg(el);
    try { urlCache[key] = img.toDataURL(); } catch (e) { urlCache[key] = ''; }
    return urlCache[key];
  }

  window.Enchant = {
    // hooks = { enemies(), kill(e, n), view(), got(kind, el) }
    init: function (cfg, hooks) {
      CFG = cfg; EN = cfg.enchant; H = hooks || {}; FXC = EN ? EN.fx : null;
      if (EN) EN.order.forEach(function (k) {   // 결정 주운 글자 모양: 속성 색(config damageText 에 el_불 … 를 만듦)
        var E = EN.el[k];
        CFG.damageText['el_' + k] = { font: 'large', scale: 1, bold: true, top: E.col2, bottom: E.col, outline: '#1a0e14', shadow: 'rgba(10,6,10,0.4)', pop: { top: '#ffffff', bottom: E.col2 } };
      });
    },
    on: function () { return !!EN; },
    aura: aura, mythic: mythic, colors: EL,
    onHit: onHit, update: update, drawOver: drawOver, hurt: hurt,
    drop: drop, updateItems: updateItems, collectAll: collectAll, addDraw: addDraw, drawUnder: drawUnder, items: items,
    setMagnet: setMagnet, drawTwinkles: drawTwinkles,   // 끌어당김(2026-11-07 던전 전용)
    stoneImg: stoneImg, crysImg: crysImg, iconUrl: iconUrl,
    // 판 다시 시작 · 판 바꾸기: 상태 전부 비움
    reset: function () { tracked.forEach(function (e) { e._el = null; }); tracked.length = 0; arcs.length = 0; mists.length = 0; items.length = 0; twinkles.length = 0; numT.length = 0; chainT.length = 0; pts.length = 0; flying.length = 0; },
    // 시험용: 기록 켜기(GAME.test.elLog(true)) / 읽기
    log: function (on) { if (on === true) LOG = {}; else if (on === false) LOG = null; return LOG; },
    logAdd: log,
    state: function () { return { tracked: tracked.length, arcs: arcs.length, mists: mists.length, items: items.length, pts: pts.length, flying: flying.length }; }
  };
})();
