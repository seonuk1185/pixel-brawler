// 기술 아이콘 (우리가 코드로 그린 도트 그림, 2026-11-06 시안 → 게임: 폰 기술 버튼 · 기술 창 · 칸 열림 알림). 그림 파일 없음 · 남의 그림 안 씀 · AI 생성 아님
//   한 칸 = 24 x 24 도트 그림 + (원하면) 32 x 32 금테 액자. 크기를 키울 땐 가장 가까운 점으로(번짐 없음)
//   쓰는 법:
//     PixelIcons.draw(ctx, 'dash', 48)                 → ctx 의 (0,0)에 48px 로 (기본 = 액자 없음, 바탕색 있음)
//     PixelIcons.draw(ctx, 'dash', 64, 10, 10, { frame: true, gray: true })
//     PixelIcons.dataURL('fireball', 48)               → 'data:image/png;base64,...' (CSS background 등)
//     PixelIcons.canvas('ice', 2)                      → 24 x 2 = 48px 캔버스 (정수 배)
//     PixelIcons.ids / PixelIcons.meta[id] = { name, cls, kind: 'active' | 'passive', theme }
//   opts: frame = 금테 액자(32칸) 포함 / bg = 바탕색(기본 true) / gray = 잠김(회색)
(function (root) {
  'use strict';
  var N = 24;
  // ---------- 색 (게임 UI 「A 정통 판타지」 색과 맞춤) ----------
  var K = {
    ink: '#1a0e08', wht: '#ffffff',
    s0: '#f4f8ff', s1: '#c8d4e4', s2: '#8e9cb4', s3: '#55607a',             // 강철
    g0: '#fff0a0', g1: '#f2c14e', g2: '#c8902a', g3: '#8a5a14',             // 금
    b0: '#b07a44', b1: '#7a4a22', b2: '#4e2c12',                            // 나무 손잡이
    r0: '#ff7a6a', r1: '#e0303a', r2: '#8a1420',                            // 빨강
    f0: '#fff6c0', f1: '#ffd040', f2: '#ff8a1a', f3: '#e0401a', f4: '#8a1a0a', // 불
    i0: '#e8fbff', i1: '#a8ecff', i2: '#5ac8f0', i3: '#2a7ad0', i4: '#1a3a8a', // 얼음
    m0: '#a8dcff', m1: '#3a8ae8', m2: '#1e4aa8',                            // 마나
    p0: '#f0d8ff', p1: '#c890ff', p2: '#8a4ae0', p3: '#4e2290',             // 보라(마법)
    e0: '#e8c490', e1: '#b8844c', e2: '#7e5230', e3: '#4a2e18',             // 흙·바위
    c0: '#eceaf6', c1: '#b0a8cc', c2: '#6e6690'                             // 구름
  };
  // 바탕(액자 안) 색: [가운데, 바깥] — 기술 갈래마다
  var THEME = {
    steel: ['#3e5478', '#1c2640'], fire: ['#7a2412', '#2e0c08'], ice: ['#2a5a8e', '#0e1e3a'],
    storm: ['#4a2e86', '#1a1036'], earth: ['#5e3e22', '#24160a'], arcane: ['#4e2a74', '#1c0e2e'],
    holy: ['#8a6418', '#2e2008'], blood: ['#6e1a26', '#26080c'], dark: ['#3e1048', '#120416'],   // dark = 흑마법사(2026-11-08)
    blade: ['#5a1a24', '#1e080c'], shadow: ['#1a2456', '#080c22'], venom: ['#2a4a14', '#0c1a06'],   // 암살자(2026-11-09): 단검 = 1차 · 그림자 = 그림자 무사 · 독 = 독술사
    wind: ['#1e5a3e', '#0a2216'], snipe: ['#2a4a6a', '#0c1828'], wild: ['#4a5a14', '#1a2006']        // 궁수(2026-11-09): 바람 = 1차 · 저격 = 저격수 · 숲 = 레인저
  };
  // 액자(테두리) 색: [밝은, 가운데, 어두운] — 작게 봐도 갈래가 보이게 원소 색으로
  var FRAME = {
    steel: ['#fff0a0', '#f2c14e', '#8a5a14'],   // 칼 = 금
    holy:  ['#fffbe0', '#ffd23f', '#a8741a'],   // 성검 = 밝은 금
    fire:  ['#ffb08a', '#e8401a', '#7a1408'],   // 불 = 빨강·주황
    ice:   ['#e0faff', '#5ad0f0', '#1a5a9a'],   // 얼음·마나 = 하늘
    storm: ['#fffbb0', '#f0d020', '#8a6a08'],   // 번개 = 노랑
    earth: ['#e8c490', '#a8743c', '#4e2c12'],   // 흙 = 갈색
    arcane:['#f0d8ff', '#a868f0', '#4e2290'],   // 마법 = 보라
    blood: ['#ffa0a0', '#d0303a', '#6a0c14'],   // 투지·반격 = 진홍
    dark:  ['#f0b8ff', '#9a2ac0', '#3a0848'],   // 어둠 = 검보라(흑마법사, 2026-11-08)
    wind:  ['#d8fff0', '#4ad89a', '#14603a'],   // 궁수 바람 = 민트(2026-11-09)
    snipe: ['#eef8ff', '#8fc8f0', '#2a5a8a'],   // 저격수 = 은빛 하늘
    wild:  ['#f0ffc0', '#a8d840', '#4a6a10'],   // 레인저 = 숲 연두
    blade: ['#ffc8d0', '#e83a50', '#6a0a18'],   // 암살자 단검 = 진홍(2026-11-09)
    shadow:['#d0dcff', '#5a7ae8', '#141e5a'],   // 그림자 무사 = 짙은 남색 · 하늘
    venom: ['#e0ffc0', '#7ad040', '#24500a']    // 독술사 = 독초록
  };

  // ---------- 24 x 24 그림판 ----------
  function Grid() { this.p = []; for (var i = 0; i < N * N; i++) this.p.push(null); }
  var GP = Grid.prototype;
  GP.px = function (x, y, c) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= N || y >= N) return; this.p[y * N + x] = c; };
  GP.get = function (x, y) { if (x < 0 || y < 0 || x >= N || y >= N) return null; return this.p[y * N + x]; };
  GP.rect = function (x, y, w, h, c) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.px(x + i, y + j, c); };
  GP.line = function (x0, y0, x1, y1, c) {
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, er = dx + dy;
    for (var n = 0; n < 200; n++) {
      this.px(x0, y0, c); if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * er; if (e2 >= dy) { er += dy; x0 += sx; } if (e2 <= dx) { er += dx; y0 += sy; }
    }
  };
  // 채운 동그라미. c = 색 또는 function(거리, x, y) → 색
  GP.disc = function (cx, cy, r, c) {
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      if (d <= r + 0.35) { var col = typeof c === 'function' ? c(d, x, y) : c; if (col) this.px(x, y, col); }
    }
  };
  // 고리(각도 = 화면 기준, 0 = 오른쪽, 90 = 아래, 180 = 왼쪽, 270 = 위). c = 색 또는 function(0~1 진행) → 색
  GP.ring = function (cx, cy, r0, r1, a0, a1, c) {
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      if (d < r0 || d > r1) continue;
      var a = Math.atan2(y - cy, x - cx) * 180 / Math.PI; if (a < 0) a += 360;
      var t = a1 >= a0 ? (a >= a0 && a <= a1 ? (a - a0) / (a1 - a0) : -1)
                        : (a >= a0 ? (a - a0) / (360 - a0 + a1) : a <= a1 ? (a + 360 - a0) / (360 - a0 + a1) : -1);
      if (t < 0) continue;
      var col = typeof c === 'function' ? c(t, d) : c; if (col) this.px(x, y, col);
    }
  };
  GP.ellipse = function (cx, cy, rx, ry, c) {
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var v = (x - cx) * (x - cx) / (rx * rx) + (y - cy) * (y - cy) / (ry * ry);
      if (v <= 1.05) { var col = typeof c === 'function' ? c(v, x, y) : c; if (col) this.px(x, y, col); }
    }
  };
  // 다각형 채우기(점 = [[x,y],...], 칸 가운데 기준). c = 색 또는 function(x, y) → 색
  GP.poly = function (pts, c) {
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var px = x + 0.5, py = y + 0.5, ins = false;
      for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) ins = !ins;
      }
      if (ins) { var col = typeof c === 'function' ? c(x, y) : c; if (col) this.px(x, y, col); }
    }
  };
  // 글자처럼 그리는 작은 도트 지도: rows = ['..ab', ...], map = { a: 색 }
  GP.map = function (x0, y0, rows, map) {
    for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) {
      var ch = rows[j][i]; if (map[ch]) this.px(x0 + i, y0 + j, map[ch]);
    }
  };
  // 테두리: 칠한 칸 둘레(상하좌우) 빈 칸을 진한 색으로 → 도트 그림 특유의 검은 윤곽
  GP.outline = function (c) {
    var add = [];
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      if (this.get(x, y)) continue;
      if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push([x, y]);
    }
    for (var k = 0; k < add.length; k++) this.px(add[k][0], add[k][1], c || K.ink);
  };
  // 반짝이(+ 모양)
  GP.spark = function (x, y, big, c) {
    this.px(x, y, K.wht);
    var cc = c || K.g0;
    this.px(x - 1, y, cc); this.px(x + 1, y, cc); this.px(x, y - 1, cc); this.px(x, y + 1, cc);
    if (big) { this.px(x - 2, y, cc); this.px(x + 2, y, cc); this.px(x, y - 2, cc); this.px(x, y + 2, cc); }
  };

  // ---------- 자주 쓰는 조각 ----------
  // 비스듬한 검: 칼끝(tx,ty), 칼날 길이 len, dir = 1(오른쪽 위로) / -1(왼쪽 위로). gold = 금빛 칼날(성검)
  function diagSword(g, tx, ty, len, dir, gold) {
    var L = gold ? K.g0 : K.s0, M = gold ? K.g1 : K.s1, D = gold ? K.g2 : K.s2;
    for (var i = 0; i < len; i++) {
      var x = tx - i * dir, y = ty + i;
      g.px(x, y + 1, D); g.px(x - dir, y, M); g.px(x, y, L);
    }
    g.px(tx + dir, ty - 1, L);
    var bx = tx - len * dir, by = ty + len;
    for (var k = -3; k <= 3; k++) { g.px(bx + k * dir + dir, by + k, k < 0 ? K.g1 : K.g2); g.px(bx + k * dir, by + k, k < 0 ? K.g0 : K.g1); }
    for (var j = 1; j <= 3; j++) { g.px(bx - j * dir, by + j, j % 2 ? K.b1 : K.b0); g.px(bx - j * dir + dir, by + j, K.b2); }
    g.rect(dir > 0 ? bx - 5 : bx + 4, by + 4, 2, 2, K.g1); g.px(dir > 0 ? bx - 5 : bx + 5, by + 4, K.g0);
  }
  // 궁수(2026-11-09): 화살 한 대 — 깃(뒤 x0,y0) → 촉(앞 x1,y1). head = 촉 색, sh = 대 색
  function arrow(g, x0, y0, x1, y1, head, sh) {
    g.line(x0, y0, x1, y1, sh || K.b0);
    var dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
    g.px(x1, y1, K.wht); g.px(x1 - dx, y1, head || K.s1); g.px(x1, y1 - dy, head || K.s1); g.px(x1 - dx, y1 - dy, head || K.s2);
    if (!dx) { g.px(x1 - 1, y1 - dy, head || K.s1); g.px(x1 + 1, y1 - dy, head || K.s1); }
    if (!dy) { g.px(x1 - dx, y1 - 1, head || K.s1); g.px(x1 - dx, y1 + 1, head || K.s1); }
    g.px(x0 - dy, y0 + dx, K.r0); g.px(x0 + dy, y0 - dx, K.r0); g.px(x0, y0, K.wht);
  }
  // 활(왼쪽이 손잡이, 오른쪽으로 휜 나무 활 + 시위)
  function bow(g, cx, top, bot) {
    var h = bot - top;
    for (var i = 0; i <= h; i++) { var t = i / h, x = cx + Math.round(Math.sin(t * Math.PI) * 5); g.px(x, top + i, K.b0); g.px(x + 1, top + i, K.b1); }
    g.line(cx, top, cx, bot, K.c0);
    g.rect(cx + 4, top + Math.floor(h / 2) - 1, 2, 3, K.b2);
  }
  var MINT = '#7affc0', MINTD = '#2aa86a', ICE = '#bfe6ff', LEAF = '#b8ff6a';
  // 단검(암살자, 2026-11-09): (x0,y0) = 손잡이 끝 → (x1,y1) = 칼끝. 앞 32% 손잡이 · 코등이 · 은빛 날
  var CRIM = '#ff4a5a', CRIMD = '#8a0a1a', NAVY = '#6a8aff', NAVYD = '#1a2a7a', VEN = '#8ae05a', VEND = '#2a6a10';
  function dagger(g, x0, y0, x1, y1, blade) {
    var dx = x1 - x0, dy = y1 - y0, n = Math.max(Math.abs(dx), Math.abs(dy)), px = -dy / (n || 1), py = dx / (n || 1);
    for (var i = 0; i <= n; i++) {
      var t = i / n, x = x0 + dx * t, y = y0 + dy * t;
      if (t < 0.32) { g.px(x, y, K.b1); g.px(x + px * 0.6, y + py * 0.6, K.b2); }
      else { g.px(x, y, t > 0.9 ? K.wht : (blade || K.s0)); g.px(x + px, y + py, K.s2); }
    }
    var gx = x0 + dx * 0.32, gy = y0 + dy * 0.32;
    for (var k = -2; k <= 2; k++) g.px(gx + px * k, gy + py * k, k ? K.g1 : K.g0);
  }
  // 아래를 향한 곧은 검(x = 칼날 왼쪽, 칼날 폭 3): 손잡이 위 → 칼끝 tipY
  function downSword(g, x, topY, tipY, gold) {
    var L = gold ? K.g0 : K.s0, M = gold ? K.g1 : K.s1, D = gold ? K.g2 : K.s2;
    g.rect(x, topY, 3, 2, K.g1); g.px(x + 1, topY, K.r1);                  // 손잡이 머리(붉은 보석)
    g.rect(x, topY + 2, 3, 3, K.b1); g.px(x + 1, topY + 3, K.b0);
    g.rect(x - 3, topY + 5, 9, 2, K.g1); g.rect(x - 3, topY + 6, 9, 1, K.g2); g.px(x + 1, topY + 5, K.g0);
    for (var y = topY + 7; y < tipY - 1; y++) { g.px(x, y, L); g.px(x + 1, y, M); g.px(x + 2, y, D); }
    g.px(x + 1, tipY - 1, M); g.px(x, tipY - 1, L); g.px(x + 1, tipY, L);
  }
  // 하트(x0,y0 = 왼쪽 위, 11 x 10)
  function heart(g, x0, y0, half) {
    g.map(x0, y0, [
      '.aab...aab.',
      'aabbb.abbbc',
      'abwbbbbbbbc',
      'abbbbbbbbcc',
      'abbbbbbbbcc',
      '.bbbbbbbcc.',
      '..bbbbbcc..',
      '...bbbcc...',
      '....bcc....',
      '.....c.....'
    ], { a: K.r0, b: K.r1, c: K.r2, w: K.wht });
    if (half) for (var j = 0; j < 10; j++) for (var i = 6; i < 11; i++) if (g.get(x0 + i, y0 + j)) g.px(x0 + i, y0 + j, j % 2 === i % 2 ? K.r2 : '#4a0a10');
  }

  // ---------- 아이콘 22개 (growth/config SKILL_TREE 순서, 2026-11-06 칼날 폭풍 +1) ----------
  var ART = {
    // ===== 암살자(2026-11-09): 단검 = 진홍 · 그림자 무사 = 남색 · 독술사 = 독초록 =====
    ashadow: function (g) { g.rect(1, 11, 9, 3, '#2a2a34'); g.line(1, 12, 9, 12, CRIM); dagger(g, 8, 15, 21, 9); g.outline(); g.spark(20, 5, false, CRIM); },
    arise: function (g) { dagger(g, 6, 20, 13, 4); dagger(g, 12, 21, 19, 6); g.outline(); g.ring(12, 12, 9, 10.5, 200, 300, CRIM); g.spark(17, 3, false); },
    afan: function (g) { dagger(g, 3, 12, 20, 4); dagger(g, 3, 12, 21, 12); dagger(g, 3, 12, 20, 20); g.outline(); g.spark(21, 8, false, CRIM); },
    awhirl: function (g) { g.ring(12, 12, 7, 9, 0, 300, CRIM); dagger(g, 12, 12, 20, 5); dagger(g, 12, 12, 4, 19); g.outline(); g.spark(4, 4, false, CRIM); },
    ablink: function (g) { g.disc(7, 15, 5, function (d) { return d < 2 ? '#5a5a66' : '#2a2a34'; }); dagger(g, 21, 6, 10, 15); g.outline(); g.spark(5, 5, true, CRIM); },
    asmoke: function (g) { g.disc(10, 15, 6, function (d) { return d < 3 ? '#6a6a76' : '#34343e'; }); g.disc(16, 13, 4, '#4a4a56'); g.disc(12, 7, 3, '#1a1a22'); g.px(13, 4, K.f1); g.px(14, 3, K.f0); g.outline(); g.spark(19, 5, false, CRIM); },
    amast: function (g) { dagger(g, 4, 20, 20, 4); dagger(g, 20, 20, 4, 4); g.outline(); g.spark(12, 3, true); },
    akeen: function (g) { g.ring(12, 12, 7, 8.5, 0, 359, CRIM); g.ring(12, 12, 3, 4, 0, 359, CRIMD); g.px(12, 12, K.wht); dagger(g, 2, 22, 11, 13); g.outline(); },
    aecho: function (g) { dagger(g, 4, 18, 18, 4, '#ffb0b8'); dagger(g, 7, 21, 21, 7); g.outline(); g.line(3, 14, 13, 4, CRIM); g.spark(20, 3, false, CRIM); },
    aorbit: function (g) { g.ring(12, 13, 7, 8, 0, 359, '#ffb0c0'); dagger(g, 6, 7, 11, 2, '#ffd8e0'); dagger(g, 19, 12, 22, 18, '#ffd8e0'); dagger(g, 7, 20, 2, 16, '#ffd8e0'); g.outline(); g.px(12, 13, CRIM); },
    avenom: function (g) { dagger(g, 4, 20, 19, 5, VEN); g.outline(); g.disc(17, 18, 3, VEN); g.px(17, 18, '#e0ffc0'); g.px(20, 14, VEN); },
    aexec: function (g) { g.disc(12, 10, 6, function (d) { return d < 4 ? '#ffd0d0' : '#c83040'; }); g.rect(9, 15, 7, 3, '#c83040'); g.rect(10, 9, 2, 2, '#3a0610'); g.rect(13, 9, 2, 2, '#3a0610'); g.outline(); g.line(3, 21, 21, 3, CRIM); },
    sclone: function (g) { g.disc(8, 12, 5, NAVYD); g.rect(5, 15, 6, 6, NAVYD); g.disc(16, 12, 5, '#2a3a8a'); g.rect(13, 15, 6, 6, '#2a3a8a'); g.px(9, 11, NAVY); g.px(17, 11, NAVY); g.outline(); g.spark(20, 4, false, NAVY); },
    sshade: function (g) { g.disc(12, 9, 5, NAVYD); g.rect(8, 13, 9, 8, NAVYD); g.px(14, 8, '#c8d8ff'); g.outline(); g.ring(12, 13, 9, 10, 200, 340, NAVY); },
    sflash: function (g) { g.line(2, 20, 21, 3, NAVY); g.line(2, 3, 21, 20, NAVY); g.line(3, 20, 21, 4, '#c8d8ff'); g.outline(); g.spark(12, 12, true, NAVY); g.px(4, 12, NAVYD); g.px(20, 12, NAVYD); },
    sstorm: function (g) { g.ring(8, 12, 6, 8, 280, 440, NAVY); g.ring(16, 12, 6, 8, 100, 260, NAVY); g.outline(); g.line(9, 7, 15, 17, '#c8d8ff'); g.line(15, 7, 9, 17, '#c8d8ff'); },
    smoon: function (g) { g.disc(12, 12, 9, function (d) { return d < 7 ? '#c8d8ff' : NAVY; }); g.disc(16, 9, 8, '#141e5a'); g.outline(); g.spark(5, 18, true, NAVY); },
    pdarts: function (g) { [[3, 6, 20, 3], [3, 12, 21, 12], [3, 18, 20, 21]].forEach(function (q) { g.line(q[0], q[1], q[2], q[3], VEN); g.px(q[2], q[3], '#e0ffc0'); }); g.outline(); g.disc(5, 12, 2, VEND); },
    pplague: function (g) { g.disc(12, 12, 5, VEN); g.disc(5, 6, 3, VEND); g.disc(19, 6, 3, VEND); g.disc(5, 19, 3, VEND); g.disc(19, 19, 3, VEND); g.px(11, 11, '#1a2a08'); g.px(13, 11, '#1a2a08'); g.outline(); },
    pcloud: function (g) { g.disc(8, 14, 5, '#3a6a2a'); g.disc(15, 12, 6, '#4a7a30'); g.disc(12, 17, 5, '#2a5a1a'); g.px(13, 11, VEN); g.px(8, 14, VEN); g.outline(); g.rect(4, 3, 4, 5, '#8ae05a'); g.rect(5, 2, 2, 1, K.b1); },
    ppool: function (g) { g.ellipse(12, 18, 10, 3, function (v) { return v < 0.5 ? VEN : VEND; }); g.px(8, 16, '#e0ffc0'); g.px(15, 17, '#e0ffc0'); g.rect(10, 4, 4, 6, '#8ae05a'); g.rect(11, 3, 2, 1, K.b1); g.outline(); },
    perupt: function (g) { g.poly([[5, 22], [9, 6], [12, 12], [15, 2], [19, 22]], function (x, y) { return y < 10 ? '#e0ffc0' : y < 16 ? VEN : VEND; }); g.outline(); g.disc(12, 8, 2, '#5a2a7a'); g.spark(4, 6, true, VEN); },
    // 3차(2026-11-10): 검성 = 금빛 칼 · 성검 / 현자 = 불 · 얼음 · 번개가 섞인 원소
    sswave: function (g) { g.ring(9, 12, 7, 9, 290, 430, K.g1); g.ring(15, 12, 7, 9, 290, 430, K.g0); g.outline(); g.spark(20, 12, true, K.g1); },
    ssaura: function (g) { g.ring(12, 13, 8, 9, 0, 359, K.g2); g.line(12, 3, 12, 14, K.s0); g.line(10, 5, 14, 5, K.g1); g.line(5, 12, 9, 20, K.s1); g.line(19, 12, 15, 20, K.s1); g.outline(); g.spark(4, 4, false, K.g0); },
    ssrain: function (g) { [[6, 2], [12, 5], [18, 1]].forEach(function (q) { g.line(q[0], q[1], q[0], q[1] + 10, K.s0); g.line(q[0] - 2, q[1] + 2, q[0] + 2, q[1] + 2, K.g1); }); g.rect(3, 19, 18, 2, K.g2); g.outline(); g.spark(12, 18, true, K.g0); },
    ssflash: function (g) { g.line(1, 13, 22, 11, K.wht); g.line(1, 14, 22, 12, K.g1); g.line(4, 10, 20, 9, K.g0); g.outline(); g.spark(12, 12, true, K.g0); },
    ssjudge: function (g) { g.line(12, 1, 12, 17, K.s0); g.line(11, 1, 11, 16, K.s1); g.line(8, 5, 16, 5, K.g1); g.rect(10, 6, 4, 2, K.g2); g.ring(12, 20, 6, 8, 180, 360, K.g1); g.outline(); g.spark(5, 3, false, K.g0); g.spark(19, 3, false, K.g0); },
    sgorb: function (g) { g.disc(12, 12, 7, function (d) { return d < 2 ? K.wht : d < 4 ? K.f1 : K.i2; }); g.ring(12, 12, 8, 9, 30, 160, K.f2); g.ring(12, 12, 8, 9, 210, 340, K.i1); g.outline(); g.spark(20, 4, false, K.g0); },
    sgcycle: function (g) { g.disc(12, 4, 3, K.f2); g.disc(5, 17, 3, K.i2); g.disc(19, 17, 3, K.g1); g.ring(12, 12, 7, 8, 0, 359, '#c8b8ff'); g.outline(); g.px(12, 12, K.wht); },
    sgstorm: function (g) { g.rect(5, 6, 4, 14, K.f2); g.rect(10, 3, 4, 17, K.i2); g.rect(15, 7, 4, 13, K.g1); g.rect(3, 20, 18, 2, K.g2); g.outline(); g.spark(12, 2, true, K.wht); },
    sgnova: function (g) { g.ring(12, 15, 8, 10, 0, 359, K.g1); g.disc(12, 15, 4, function (d) { return d < 2 ? K.wht : K.f1; }); g.disc(4, 9, 3, K.i2); g.disc(20, 9, 3, K.f2); g.outline(); },
    sgdoom: function (g) { g.disc(8, 7, 4, function (d) { return d < 2 ? K.wht : K.f1; }); g.line(10, 9, 15, 15, K.f2); g.disc(15, 17, 5, function (d) { return d < 3 ? '#140828' : '#6a3ad0'; }); g.ring(15, 17, 5, 7, 0, 359, K.g1); g.outline(); g.spark(20, 4, false, K.wht); },
    // 신궁(궁수 3차 a, 2026-11-10): 은빛 · 얼음 화살
    dvlance: function (g) { [6, 12, 18].forEach(function (y) { g.line(2, y, 19, y, K.i1); g.px(20, y, K.wht); g.px(19, y - 1, K.i0); g.px(19, y + 1, K.i0); }); g.outline(); g.spark(4, 3, false, K.i0); },
    dveye: function (g) { g.ellipse(12, 12, 8, 5, K.i3); g.disc(12, 12, 3, function (d) { return d < 1.5 ? K.wht : K.i1; }); g.outline(); g.line(3, 21, 20, 4, K.i0); g.px(20, 4, K.wht); },
    // 숲의 수호자(3차 궁수 b, 2026-11-10): 잎 · 덩굴 · 정령 매
    // 그림자 군주(암살자 3차 a, 2026-11-10): 검정 + 남색 그림자
    smwave: function (g) { g.ring(9, 12, 7, 9, 290, 430, NAVYD); g.ring(14, 12, 7, 9, 290, 430, NAVY); g.outline(); g.spark(20, 12, false, '#c0d8ff'); },
    smshade: function (g) { g.ring(12, 13, 8, 9, 0, 359, NAVYD); g.line(5, 6, 10, 11, NAVY); g.line(19, 6, 14, 11, NAVY); g.line(12, 20, 12, 15, '#c0d8ff'); g.outline(); g.px(12, 13, '#c0d8ff'); },
    smrain: function (g) { [[6, 2], [12, 5], [18, 1]].forEach(function (q) { g.line(q[0], q[1], q[0], q[1] + 10, NAVY); g.px(q[0], q[1] + 10, '#c0d8ff'); }); g.rect(3, 19, 18, 2, NAVYD); g.outline(); },
    smflash: function (g) { g.line(1, 13, 22, 11, '#141e5a'); g.line(1, 14, 22, 12, NAVY); g.line(4, 10, 20, 9, '#c0d8ff'); g.outline(); g.spark(12, 12, true, NAVY); },
    smjudge: function (g) { g.disc(12, 11, 9, function (d) { return d < 6 ? '#141e5a' : NAVY; }); g.line(12, 2, 12, 20, '#c0d8ff'); g.line(9, 6, 15, 6, NAVY); g.outline(); g.spark(4, 19, false, '#c0d8ff'); },
    fgwind: function (g) { g.line(2, 12, 20, 12, K.e1); g.line(17, 9, 21, 12, '#c8ff9a'); g.line(17, 15, 21, 12, '#c8ff9a'); g.ring(8, 12, 4, 6, 0, 359, '#4ab830'); g.ring(13, 12, 4, 6, 0, 359, '#7ae05a'); g.outline(); g.px(21, 12, K.wht); },
    fgspirit: function (g) { g.poly([[2, 10], [12, 14], [22, 8], [16, 15], [12, 20], [8, 15]], '#7ae05a'); g.disc(12, 13, 2, '#e8ffd8'); g.outline(); g.px(13, 12, K.ink); g.spark(4, 4, false, '#c8ff9a'); },
    fgroots: function (g) { g.rect(5, 8, 3, 13, K.e2); g.rect(11, 4, 3, 17, '#3a7a20'); g.rect(17, 9, 3, 12, K.e2); g.px(4, 10, '#7ae05a'); g.px(14, 6, '#7ae05a'); g.px(20, 11, '#7ae05a'); g.rect(2, 20, 20, 2, K.e1); g.outline(); },
    fgstorm: function (g) { g.ring(12, 12, 6, 8, 20, 330, '#7ae05a'); g.ring(12, 12, 2, 4, 200, 520, '#c8ff9a'); g.line(3, 21, 19, 5, K.e1); g.px(19, 5, K.wht); g.outline(); g.spark(20, 19, false, '#c8ff9a'); },
    fgjudge: function (g) { g.line(12, 1, 12, 16, '#c8ff9a'); g.line(11, 1, 11, 15, '#4ab830'); g.line(9, 13, 12, 17, '#e8ffd8'); g.line(15, 13, 12, 17, '#e8ffd8'); g.rect(4, 19, 3, 4, K.e2); g.rect(17, 19, 3, 4, K.e2); g.ring(12, 21, 6, 8, 180, 360, '#7ae05a'); g.outline(); g.spark(4, 4, false, K.wht); },
    dvrain: function (g) { [[5, 1], [11, 4], [17, 0]].forEach(function (q) { g.line(q[0], q[1], q[0], q[1] + 11, K.i0); g.px(q[0], q[1] + 12, K.wht); g.px(q[0] - 1, q[1] + 11, K.i1); g.px(q[0] + 1, q[1] + 11, K.i1); }); g.rect(3, 20, 18, 2, K.i3); g.outline(); },
    dvpierce: function (g) { g.line(1, 12, 20, 12, K.i0); g.line(1, 11, 20, 11, K.i1); g.px(21, 11, K.wht); g.px(22, 12, K.wht); g.disc(19, 12, 4, function (d) { return d < 2 ? K.wht : K.i2; }); g.outline(); g.spark(5, 5, false, K.i0); },
    dvsky: function (g) { g.line(12, 1, 12, 18, K.i0); g.line(11, 1, 11, 17, K.i1); g.px(12, 19, K.wht); g.px(11, 18, K.wht); g.line(9, 2, 12, 5, K.i2); g.line(15, 2, 12, 5, K.i2); g.ring(12, 20, 6, 8, 180, 360, K.i1); g.outline(); g.spark(4, 4, false, K.wht); g.spark(20, 4, false, K.wht); },
    // 마검왕(2026-11-10): 보라 · 검정 마력 검
    mkcross: function (g) { g.line(3, 3, 20, 20, K.p1); g.line(3, 20, 20, 3, K.p1); g.line(4, 3, 21, 20, K.p0); g.outline(); g.spark(12, 12, true, K.p0); },
    mkblades: function (g) { g.ring(12, 13, 8, 9, 0, 359, K.p2); g.line(12, 2, 12, 12, K.s1); g.line(4, 13, 9, 20, K.s2); g.line(20, 13, 15, 20, K.s2); g.px(12, 9, K.r1); g.outline(); },
    mkrain: function (g) { [[6, 2], [12, 4], [18, 1]].forEach(function (q) { g.line(q[0], q[1], q[0], q[1] + 11, K.s2); g.line(q[0] - 2, q[1] + 2, q[0] + 2, q[1] + 2, K.p1); }); g.rect(3, 19, 18, 2, K.p3); g.outline(); g.spark(12, 18, true, K.p0); },
    mkrift: function (g) { g.line(2, 18, 8, 12, K.p1); g.line(8, 12, 13, 16, K.p1); g.line(13, 16, 21, 6, K.p1); g.disc(19, 8, 3, function (d) { return d < 2 ? K.p0 : K.p2; }); g.outline(); g.spark(6, 6, false, K.p0); },
    mkking: function (g) { g.line(12, 1, 12, 17, K.s2); g.line(11, 1, 11, 16, K.s3); g.line(8, 5, 16, 5, K.p1); g.px(12, 5, K.r1); g.ring(12, 20, 6, 8, 180, 360, K.p1); g.outline(); g.spark(5, 3, false, K.p0); g.spark(19, 3, false, K.p0); },
    // 3차 심연술사(2026-11-10): 검정 · 검보라 해골 · 촉수 · 문
    abhex: function (g) { g.disc(15, 11, 5, function (d) { return d < 3 ? K.p0 : K.p2; }); g.rect(13, 10, 2, 2, K.ink); g.rect(16, 10, 2, 2, K.ink); g.line(2, 9, 9, 10, K.p1); g.line(3, 13, 9, 12, K.p2); g.outline(); g.spark(20, 4, false, K.p1); },
    absoul: function (g) { g.ring(12, 13, 8, 9, 0, 359, K.p2); g.disc(12, 8, 4, function (d) { return d < 2 ? K.p0 : K.p1; }); g.px(11, 8, K.ink); g.px(13, 8, K.ink); g.disc(5, 17, 2, K.p1); g.disc(19, 17, 2, K.p1); g.outline(); g.px(12, 18, K.r1); },
    abmaw: function (g) { g.line(6, 21, 7, 8, K.p3); g.line(11, 21, 12, 4, K.p2); g.line(16, 21, 17, 7, K.p3); g.px(6, 7, K.p0); g.px(12, 3, K.p0); g.px(17, 6, K.p0); g.ellipse(12, 21, 9, 2, K.p2); g.outline(); },
    abnova: function (g) { g.ring(12, 15, 8, 10, 0, 359, K.p1); g.disc(12, 15, 4, function (d) { return d < 2 ? K.p0 : K.p3; }); g.disc(4, 9, 3, K.p2); g.disc(20, 9, 3, K.p2); g.outline(); },
    abgate: function (g) { g.rect(7, 4, 10, 16, K.p3); g.rect(9, 6, 6, 13, '#140828'); g.disc(12, 12, 3, function (d) { return d < 1 ? K.p0 : K.p1; }); g.rect(5, 20, 14, 2, K.p2); g.outline(); g.spark(20, 3, false, K.p0); },
    // ===== 궁수(2026-11-09) =====
    pshot: function (g) { g.rect(3, 11, 16, 2, MINTD); arrow(g, 2, 12, 21, 12, K.wht, K.b0); g.outline(); g.ring(8, 12, 3, 4, 0, 359, MINT); g.ring(13, 12, 3, 4, 0, 359, MINT); g.spark(20, 8, false, MINT); },
    upshot: function (g) { arrow(g, 7, 4, 12, 15, K.s1); g.outline(); g.ellipse(12, 18, 8, 2.5, MINTD); g.ellipse(12, 18, 5, 1.5, MINT); g.line(6, 14, 4, 6, MINT); g.line(18, 14, 20, 6, MINT); g.spark(12, 3, false, MINT); },
    multi: function (g) { arrow(g, 3, 12, 20, 5); arrow(g, 3, 12, 21, 12); arrow(g, 3, 12, 20, 19); g.outline(); g.spark(21, 8, false, MINT); },
    rain: function (g) { [[5, 3], [10, 1], [15, 4], [19, 2]].forEach(function (q) { arrow(g, q[0], q[1], q[0], q[1] + 13, K.s1); }); g.outline(); g.rect(2, 20, 20, 1, K.e1); g.spark(12, 19, false, K.g0); },
    leap: function (g) { g.ring(12, 12, 8, 9.5, 160, 380, MINT); arrow(g, 9, 9, 20, 18, K.s1); g.outline(); g.spark(5, 5, false, MINT); },
    burst: function (g) { arrow(g, 2, 14, 14, 10, K.f2); g.disc(16, 9, 5, function (d) { return d < 2 ? K.f0 : d < 3.5 ? K.f1 : K.f2; }); g.outline(); g.spark(20, 4, true, K.f1); },
    aim: function (g) { bow(g, 6, 2, 21); arrow(g, 4, 12, 21, 12); g.outline(); g.spark(19, 6, false); },
    focus: function (g) { g.ring(12, 12, 7, 8.5, 0, 359, K.r1); g.ring(12, 12, 3, 4, 0, 359, K.r0); g.line(12, 1, 12, 6, K.r1); g.line(12, 18, 12, 23, K.r1); g.line(1, 12, 6, 12, K.r1); g.line(18, 12, 23, 12, K.r1); g.px(12, 12, K.wht); g.outline(); },
    split: function (g) { arrow(g, 2, 12, 11, 12); arrow(g, 11, 12, 20, 6, MINT, MINTD); arrow(g, 11, 12, 20, 18, MINT, MINTD); g.outline(); g.spark(11, 12, false, MINT); },
    volley: function (g) { arrow(g, 6, 20, 6, 6, K.g0, K.g2); arrow(g, 12, 21, 12, 3, K.g0, K.g2); arrow(g, 18, 20, 18, 6, K.g0, K.g2); g.outline(); g.spark(12, 2, true); },
    gale: function (g) { g.ring(12, 12, 6, 8, 0, 300, MINT); g.ring(12, 12, 3, 4.5, 90, 400, '#d8fff0'); g.outline(); g.line(2, 18, 8, 16, MINT); g.line(16, 6, 22, 4, MINT); },
    mark: function (g) { g.ring(12, 12, 6, 8, 0, 359, K.f2); g.line(12, 2, 12, 7, K.f3); g.line(12, 17, 12, 22, K.f3); g.line(2, 12, 7, 12, K.f3); g.line(17, 12, 22, 12, K.f3); g.map(10, 9, ['..a..', '.aaa.', 'a.a.a', '..a..'], { a: K.f1 }); g.outline(); },
    snipe: function (g) { g.rect(2, 11, 20, 2, ICE); arrow(g, 1, 12, 22, 12, K.wht, K.s0); g.outline(); g.ring(17, 12, 4, 5, 0, 359, K.r1); g.spark(4, 6, false, ICE); },
    deadeye: function (g) { g.ring(12, 12, 7, 8.5, 0, 359, ICE); g.ring(12, 12, 3, 4, 0, 359, K.r1); g.px(12, 12, K.wht); g.outline(); g.spark(19, 5, true, K.g0); },
    ballista: function (g) { g.poly([[2, 10], [16, 10], [16, 7], [22, 12], [16, 17], [16, 14], [2, 14]], function (x) { return x > 15 ? K.s0 : x > 8 ? K.s1 : K.s2; }); g.outline(); g.line(1, 7, 6, 7, ICE); g.line(1, 17, 6, 17, ICE); },
    rapid: function (g) { arrow(g, 2, 6, 19, 6, ICE); arrow(g, 4, 12, 22, 12, K.wht); arrow(g, 2, 18, 19, 18, ICE); g.outline(); },
    skyfall: function (g) { g.rect(10, 1, 4, 14, ICE); g.poly([[6, 13], [18, 13], [12, 21]], function (y) { return K.s0; }); g.outline(); g.ellipse(12, 21, 9, 2, '#ffffff'); g.spark(4, 4, true, ICE); g.spark(20, 6, false, ICE); },
    tempest: function (g) { [[5, 2], [11, 0], [17, 3]].forEach(function (q) { arrow(g, q[0], q[1], q[0] + 2, q[1] + 11, K.s1); }); g.outline(); g.ring(12, 18, 5, 7, 180, 520, LEAF); },
    hawk: function (g) { g.poly([[2, 8], [9, 10], [12, 7], [15, 10], [22, 7], [16, 14], [13, 18], [10, 14]], function (x, y) { return y < 10 ? K.b0 : y < 14 ? K.b1 : K.e0; }); g.px(12, 8, K.wht); g.px(13, 9, K.f1); g.outline(); },
    trap: function (g) { g.ring(12, 15, 7, 8.5, 180, 360, K.s2); for (var i = 0; i < 6; i++) g.px(5 + i * 3, 9 + (i % 2), K.s0); g.rect(10, 15, 4, 3, K.s2); g.px(12, 16, K.f1); g.outline(); g.line(4, 21, 20, 21, LEAF); },
    twister: function (g) { for (var y = 3; y < 21; y += 3) { var w = Math.round(9 - y * 0.35); g.line(12 - w, y, 12 + w, y, y % 6 ? LEAF : '#e8ffe0'); } arrow(g, 4, 9, 13, 12); g.outline(); },
    barrage: function (g) { for (var i = 0; i < 6; i++) arrow(g, 3 + i * 3, 1 + (i % 2) * 3, 3 + i * 3, 11 + (i % 2) * 3, i % 2 ? K.g0 : K.s1); g.outline(); g.rect(2, 20, 20, 1, LEAF); g.spark(12, 18, true); },
    // ===== 기사 =====
    dash: function (g) {                    // 돌진베기: 오른쪽으로 내지르는 칼 + 뒤로 남는 바람 줄
      g.rect(9, 11, 11, 1, K.s0); g.rect(9, 12, 13, 1, K.wht); g.rect(9, 13, 11, 1, K.s2); g.px(20, 12, K.s0);
      g.rect(7, 7, 1, 11, K.g0); g.rect(8, 7, 1, 11, K.g2); g.px(7, 12, K.r1);
      g.rect(3, 11, 4, 3, K.b1); g.px(4, 12, K.b0); g.px(6, 12, K.b0);
      g.rect(1, 11, 2, 3, K.g1); g.px(1, 11, K.g0);
      g.outline();
      g.rect(0, 4, 9, 1, K.i1); g.rect(2, 7, 4, 1, K.i2); g.rect(1, 17, 5, 1, K.i2); g.rect(0, 20, 10, 1, K.i1);
      g.rect(12, 5, 7, 1, K.i2); g.rect(13, 19, 6, 1, K.i2);
      g.spark(22, 9, false);
    },
    spin: function (g) {                    // 회전베기: 한 바퀴 도는 칼 + 둥근 칼바람
      g.ring(12, 12, 8.6, 11, 200, 150, function (t) { return t > 0.85 ? K.wht : t > 0.6 ? K.i0 : t > 0.35 ? K.i1 : t > 0.15 ? K.i2 : K.i3; });
      g.outline();
      diagSword(g, 16, 6, 8, 1);
      g.outline();
      g.spark(20, 3, false, K.i1);
    },
    upper: function (g) {                   // 올려베기: 아래에서 위로 그리는 반달 + 위 화살표
      g.ring(22, 23, 15, 17.4, 180, 270, function (t) { return t > 0.8 ? K.wht : t > 0.5 ? K.i0 : t > 0.25 ? K.i1 : K.i2; });
      g.outline();
      diagSword(g, 18, 8, 8, 1);
      g.outline();
      g.map(1, 1, ['...a...', '..aba..', '.abbba.', 'aabbbaa', '..bbb..', '..bbb..', '..bbb..'], { a: K.g0, b: K.g1 });
      g.outline();
    },
    mastery: function (g) {                 // 검 숙련(늘 켜짐): 엇갈린 두 칼 + 반짝
      diagSword(g, 19, 3, 11, 1);
      diagSword(g, 4, 3, 11, -1);
      g.outline();
      g.spark(11, 2, true);
    },
    skin: function (g) {                    // 강철 피부(늘 켜짐): 강철 방패 + 리벳
      var pts = [[3, 2], [21, 2], [21, 12], [12, 22], [3, 12]];
      g.poly(pts, function (x, y) { return x < 12 ? (y < 8 ? K.s0 : K.s1) : (y < 8 ? K.s1 : K.s2); });
      // 금 테두리: 칠한 칸 중 바깥이 빈 칸
      var edge = [];
      for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (g.get(x, y) && (!g.get(x - 1, y) || !g.get(x + 1, y) || !g.get(x, y - 1) || !g.get(x, y + 1))) edge.push([x, y]);
      edge.forEach(function (e) { g.px(e[0], e[1], e[1] < 4 || e[0] < 12 ? K.g1 : K.g2); });
      g.rect(11, 4, 2, 15, K.s3); g.rect(5, 8, 15, 2, K.s3);
      g.rect(11, 4, 1, 15, K.s1); g.rect(5, 8, 15, 1, K.s0);
      [[5, 4], [18, 4], [5, 12], [18, 12]].forEach(function (p) { g.px(p[0], p[1], K.ink); });
      g.px(6, 5, K.wht); g.px(7, 6, K.wht);
      g.outline();
    },
    wave: function (g) {                    // 검기 날리기: 날아가는 초승달 검기
      g.disc(14, 12, 9.5, function (d, x, y) {
        var dx = x - 9.5, dy = y - 12; if (Math.sqrt(dx * dx + dy * dy) <= 8.6) return null;
        return d > 8.4 ? K.wht : d > 6.8 ? K.i0 : K.i1;
      });
      g.outline();
      g.rect(0, 7, 6, 1, K.i2); g.rect(2, 12, 7, 1, K.i1); g.rect(0, 17, 5, 1, K.i2);
      g.spark(22, 4, false, K.i1); g.spark(21, 20, false, K.i1);
    },
    slam: function (g) {                    // 대지 내려찍기: 땅에 꽂힌 칼 + 갈라진 땅 + 튀는 돌
      g.rect(0, 18, 24, 6, K.e2); g.rect(0, 18, 24, 1, K.e1); g.rect(0, 22, 24, 2, K.e3);
      downSword(g, 11, 0, 19);
      g.outline();
      g.line(12, 19, 7, 23, K.ink); g.line(12, 19, 17, 23, K.ink); g.line(12, 19, 3, 21, K.ink); g.line(12, 19, 21, 21, K.ink);
      g.rect(0, 18, 24, 1, K.e1);
      g.rect(10, 18, 5, 1, K.f1);
      [[4, 13], [19, 12], [2, 9], [21, 16]].forEach(function (p, i) { g.rect(p[0], p[1], 2, 2, i % 2 ? K.e1 : K.e0); });
      g.line(8, 16, 5, 15, K.f1); g.line(16, 16, 19, 15, K.f1); g.px(7, 13, K.f0); g.px(17, 13, K.f0);
    },
    grit: function (g) {                    // 투지(늘 켜짐): 반쯤 빈 하트 + 타오르는 불
      g.poly([[3, 14], [5, 4], [8, 9], [11, 1], [14, 8], [17, 3], [20, 14]], K.f3);
      g.poly([[6, 14], [7, 8], [9, 11], [11, 5], [14, 11], [16, 8], [17, 14]], K.f2);
      g.poly([[8, 14], [10, 9], [12, 11], [14, 9], [15, 14]], K.f1);
      heart(g, 6, 11, true);
      g.outline();
      g.line(12, 11, 11, 14, K.ink); g.line(11, 14, 13, 17, K.ink); g.px(12, 19, K.ink);
    },
    counter: function (g) {                 // 반격(늘 켜짐): 막는 방패 + 되받아 베는 칼 + 번쩍
      diagSword(g, 20, 3, 10, 1);
      g.outline();
      g.poly([[1, 9], [12, 9], [12, 15], [6.5, 22], [1, 15]], function (x, y) { return x < 6 ? K.s0 : K.s2; });
      g.rect(2, 10, 9, 1, K.s1);
      [[1, 9], [11, 9], [1, 14], [11, 14], [5, 20], [7, 20]].forEach(function (p) { g.px(p[0], p[1], K.g1); });
      g.rect(6, 10, 1, 10, K.r1); g.rect(3, 13, 7, 1, K.r1);
      g.outline();
      g.map(13, 14, ['aa..', 'a.a.', 'a..a', '...a'], { a: K.r0 }); g.map(19, 15, ['.b', 'bb', '.b'], { b: K.r0 });
      g.spark(21, 2, true);
    },
    storm: function (g) {                   // 칼날 폭풍(2026-11-06): 아래로 좁아지는 회오리(칼바람 띠) + 휩쓸려 도는 작은 칼 두 자루
      var C = [K.wht, K.i0, K.i1, K.i2, K.i1, K.i2, K.i3];
      for (var i = 6; i >= 0; i--) {   // 아래(좁음)부터 그려서 위 띠가 앞에 보이게
        var cy = 3.5 + i * 2.9, rx = 10.5 - i * 1.35, cx = 12 + (i % 2 ? 1 : -1) * (i * 0.25);
        g.ellipse(cx, cy, rx, 1.9, C[i]);
        g.line(Math.round(cx - rx + 1), Math.round(cy + 1), Math.round(cx + rx - 1), Math.round(cy + 1), i < 2 ? K.i1 : K.i3);
      }
      g.outline();
      // 휩쓸려 도는 작은 칼(왼쪽 위 · 오른쪽 아래)
      g.line(1, 10, 4, 7, K.s0); g.line(2, 10, 5, 7, K.s2); g.px(1, 11, K.g1); g.px(0, 12, K.b1);
      g.line(19, 20, 22, 17, K.s0); g.line(20, 20, 23, 17, K.s2); g.px(19, 21, K.g1); g.px(18, 22, K.b1);
      g.spark(21, 3, false, K.i1); g.spark(3, 19, false, K.i1);
    },
    holy: function (g) {                    // 성검 낙뢰(필살): 금빛 성검 + 양옆 번개
      g.disc(12, 7, 6, function (d) { return d > 4.5 ? null : d > 2.5 ? '#f8e0a0' : K.f0; });
      downSword(g, 11, 1, 23, true);
      g.outline();
      g.poly([[4, 0], [1, 7], [4, 7], [2, 14], [7, 5], [4, 5], [6, 0]], K.f1);
      g.poly([[19, 0], [17, 7], [20, 7], [18, 14], [23, 5], [20, 5], [21, 0]], K.f1);
      g.line(4, 1, 3, 5, K.wht); g.line(20, 1, 19, 5, K.wht);
      g.outline();
      g.spark(6, 18, false); g.spark(18, 19, false);
    },
    // ===== 1차 기사 새 기술(2026-11-08) =====
    shards: function (g) {                  // 칼날 파편(늘 켜짐): 가운데 터짐 + 사방으로 튀는 칼날 조각 6개
      g.disc(12, 12, 3.4, function (d) { return d > 2.4 ? K.i1 : K.wht; });
      [[12, 1, 0, 1], [21, 6, -1, 1], [21, 18, -1, -1], [12, 23, 0, -1], [3, 18, 1, -1], [3, 6, 1, 1]].forEach(function (q) {
        var x = q[0], y = q[1], dx = q[2], dy = q[3];
        g.line(x, y, x + dx * 4, y + dy * 4, K.s0); g.line(x + (dx ? 0 : 1), y + (dx ? 1 : 0), x + dx * 4 + (dx ? 0 : 1), y + dy * 4 + (dx ? 1 : 0), K.s2);
      });
      g.outline();
      g.spark(12, 12, false, K.i1);
      g.px(7, 9, K.i2); g.px(17, 9, K.i2); g.px(7, 15, K.i2); g.px(17, 15, K.i2);
    },
    thrust: function (g) {                  // 연속 찌르기: 오른쪽으로 뻗는 칼 + 겹친 찌르기 줄 세 개
      g.rect(6, 11, 14, 1, K.s0); g.rect(6, 12, 16, 1, K.wht); g.rect(6, 13, 14, 1, K.s2); g.px(21, 12, K.s0);
      g.rect(4, 8, 1, 9, K.g0); g.rect(5, 8, 1, 9, K.g2);
      g.rect(1, 11, 3, 3, K.b1); g.px(2, 12, K.b0);
      g.outline();
      g.rect(9, 5, 11, 1, K.i1); g.rect(13, 4, 7, 1, K.wht); g.rect(9, 19, 11, 1, K.i1); g.rect(13, 20, 7, 1, K.wht);
      g.rect(14, 8, 6, 1, K.i2); g.rect(14, 16, 6, 1, K.i2);
      g.spark(22, 4, false, K.i1); g.spark(22, 20, false, K.i1);
    },
    pressure: function (g) {                // 끌어당기는 검압(늘 켜짐): 가운데 칼 + 안쪽으로 모이는 바람 화살 넷
      g.ring(12, 12, 9, 10.6, 0, 359, function (t) { return (Math.floor(t * 12) % 2) ? K.i1 : K.i2; });
      g.outline();
      diagSword(g, 16, 5, 9, 1);
      g.outline();
      g.map(1, 10, ['a..', 'aa.', 'aaa', 'aa.', 'a..'], { a: K.wht }); g.map(20, 10, ['..a', '.aa', 'aaa', '.aa', '..a'], { a: K.wht });
      g.spark(12, 2, false, K.i1);
    },
    // ===== 성기사(2차, 2026-11-08) =====
    aegis: function (g) {                   // 신성 가호(늘 켜짐): 금빛 후광 + 금테 방패 + 가운데 하트 빛
      g.ring(12, 12, 9.4, 11.2, 0, 359, function (t) { return (Math.floor(t * 16) % 2) ? K.g0 : K.g1; });
      g.outline();
      g.poly([[5, 4], [19, 4], [19, 12], [12, 20], [5, 12]], function (x, y) { return x < 12 ? (y < 9 ? K.g0 : K.g1) : (y < 9 ? K.g1 : K.g2); });
      g.outline();
      g.rect(11, 6, 2, 10, K.wht); g.rect(8, 9, 8, 2, K.wht);
      g.px(11, 6, K.f0); g.px(12, 15, K.g0);
      g.spark(3, 3, false); g.spark(21, 20, false);
    },
    cross: function (g) {                   // 심판의 십자: 땅에 새긴 금빛 십자 + 위로 솟는 빛기둥
      g.rect(0, 19, 24, 5, K.e2); g.rect(0, 19, 24, 1, K.e1); g.rect(0, 22, 24, 2, K.e3);
      [[3, 3], [7, 0], [12, 1], [17, 0], [21, 4]].forEach(function (p, i) {
        for (var y = p[1]; y < 19; y++) g.px(p[0], y, y < p[1] + 4 ? K.g0 : (i % 2 ? K.f0 : K.wht));
        g.px(p[0] + 1, 18, K.g0); g.px(p[0] - 1, 18, K.g0);
      });
      g.rect(10, 6, 4, 13, K.g1); g.rect(6, 9, 12, 4, K.g1);
      g.rect(11, 6, 2, 13, K.f0); g.rect(6, 10, 12, 2, K.f0);
      g.rect(11, 10, 2, 2, K.wht);
      g.outline();
      g.rect(2, 20, 20, 1, K.g0); g.rect(9, 20, 6, 1, K.wht);
    },
    charge: function (g) {                  // 성스러운 돌격: 금빛 방패 구슬에 싸여 오른쪽으로 돌진 + 뒤로 남는 금빛 줄
      g.disc(14, 12, 8.6, function (d) { return d > 7.6 ? K.g0 : d > 6 ? K.g1 : d > 3.5 ? '#c89a3a' : K.g2; });
      g.outline();
      g.rect(12, 8, 3, 9, K.s0); g.rect(15, 8, 1, 9, K.s2); g.rect(10, 10, 7, 2, K.s1); g.px(13, 9, K.r1);
      g.ring(14, 12, 8.6, 10.4, 300, 60, function (t) { return t > 0.3 && t < 0.7 ? K.wht : K.f0; });
      g.rect(0, 6, 5, 1, K.g1); g.rect(1, 11, 4, 1, K.g0); g.rect(0, 16, 5, 1, K.g1); g.rect(2, 19, 3, 1, K.g2);
      g.spark(22, 3, false);
    },
    // ===== 2차 갈래 B (2026-11-08): 마검사 · 흑마법사 =====
    arcwave: function (g) {                 // 마력 검기: 겹쳐 날아가는 보라 초승달 세 줄기
      [[9, 5, 0.7], [15, 12, 1], [9, 19, 0.7]].forEach(function (q) {
        g.disc(q[0], q[1], 5.5 * q[2] + 1.5, function (d, x, y) { var dx = x - (q[0] - 3), dy = y - q[1]; if (Math.sqrt(dx * dx + dy * dy) <= 5.4 * q[2] + 1) return null; return d > 5.2 * q[2] + 0.8 ? K.wht : d > 4 * q[2] ? K.p0 : K.p1; });
      });
      g.outline();
      g.rect(0, 11, 6, 1, K.p1); g.rect(0, 5, 3, 1, K.p2); g.rect(0, 19, 3, 1, K.p2);
      g.spark(22, 4, false, K.p0);
    },
    infuse: function (g) {                  // 마력 부여(늘 켜짐): 보라 기운이 감도는 비스듬한 칼 + 칼끝 작은 터짐
      diagSword(g, 19, 3, 13, 1);
      g.outline();
      g.ring(12, 13, 7.5, 9, 120, 300, function (t) { return t > 0.4 && t < 0.6 ? K.wht : K.p1; });
      g.disc(20, 4, 2.6, function (d) { return d < 1.2 ? K.wht : K.p0; });
      g.px(4, 6, K.p0); g.px(6, 3, K.p1); g.px(17, 20, K.p1);
    },
    rift: function (g) {                    // 차원 베기: 가로로 그은 보라 베기 줄 + 줄 위로 찢어진 세로 틈 셋
      g.rect(1, 12, 22, 2, K.p1); g.rect(3, 12, 18, 1, K.wht);
      [[6, 0.8], [12, 1], [18, 0.8]].forEach(function (q) {
        var hh = Math.round(6 * q[1]);
        g.ellipse(q[0], 12.5, 2, hh, function (v) { return v < 0.45 ? '#12041e' : v < 0.85 ? K.p3 : K.p0; });
      });
      g.outline();
      g.spark(21, 4, false, K.p0); g.spark(3, 20, false, K.p0);
    },
    msword: function (g) {                  // 마검 소환: 아래를 향해 떠 있는 보라 마력 검 셋(가운데 크게)
      [[4, 2, 13], [10, 0, 19], [17, 2, 13]].forEach(function (q, i) {
        var x = q[0];
        g.rect(x, q[1], 3, 2, K.g1); g.rect(x - 1, q[1] + 2, 5, 1, K.g2);
        for (var y = q[1] + 3; y < q[2]; y++) { g.px(x, y, K.p0); g.px(x + 1, y, i === 1 ? K.wht : K.p1); g.px(x + 2, y, K.p2); }
        g.px(x + 1, q[2], K.p0);
      });
      g.outline();
      g.rect(2, 21, 20, 1, K.p1); g.px(11, 21, K.wht); g.spark(21, 17, false, K.p0);
    },
    unleash: function (g) {                 // 마검 해방(필살, 2026-11-09 게임 그림에 맞춤): 땅을 타고 오른쪽으로 밀려가는 검은 기운 파도(보라 테) + 튀는 돌
      g.rect(0, 21, 24, 3, K.e3); g.rect(0, 21, 24, 1, K.p2);
      g.poly([[0, 21], [5, 16], [7, 18], [11, 11], [13, 14], [17, 4], [19, 9], [21, 6], [22, 21]], function (x, y) { return y > 17 ? K.p2 : y > 12 ? K.p3 : '#12041e'; });
      g.outline(K.p1);
      g.line(9, 18, 16, 8, K.p3); g.line(14, 19, 19, 10, K.p3);
      g.rect(2, 20, 20, 1, K.p0); g.px(18, 20, K.wht);
      g.px(9, 7, K.c2); g.px(10, 6, K.c1); g.px(14, 2, K.c2); g.px(22, 3, K.c1); g.px(4, 12, K.c2);
      g.spark(22, 1, false, K.p0);
    },
    darkorb: function (g) {                 // 어둠의 구체: 검은 속 + 검보라 테 + 둘레 어둠 조각 + 뒤로 남는 꼬리
      g.disc(14, 12, 6.6, function (d, x, y) { return d < 4 ? '#0a0210' : d < 5.4 ? '#6a1a8a' : (x + y < 26 ? '#d070e0' : '#8a2ab0'); });
      g.outline();
      g.rect(0, 10, 6, 1, '#8a2ab0'); g.rect(1, 13, 5, 1, '#d070e0'); g.rect(0, 16, 4, 1, '#6a1a8a');
      g.px(12, 10, '#ff9af0'); g.px(13, 9, K.wht);
      g.px(21, 4, '#ff9af0'); g.px(22, 19, '#d070e0'); g.px(7, 4, '#d070e0');
    },
    leech: function (g) {                   // 생명 흡수(늘 켜짐): 붉은 하트로 빨려 드는 붉은 기운 줄기
      g.disc(12, 13, 5, function (d) { return d < 2 ? K.r0 : d < 3.6 ? K.r1 : K.r2; });
      g.disc(9, 10, 3, K.r1); g.disc(15, 10, 3, K.r1);
      g.poly([[6, 12], [18, 12], [12, 19]], K.r1);
      g.px(9, 9, K.r0); g.px(10, 9, '#ffd0d0');
      g.outline();
      [[2, 2], [21, 3], [2, 21], [21, 21]].forEach(function (q) { g.px(q[0], q[1], '#ff5a6a'); });
      g.line(3, 3, 6, 6, '#c01a3a'); g.line(20, 4, 17, 7, '#c01a3a'); g.line(3, 20, 6, 17, '#c01a3a'); g.line(20, 20, 17, 17, '#c01a3a');
    },
    swamp: function (g) {                   // 저주의 늪: 땅에 펼친 검보라 웅덩이 + 소용돌이 + 오르는 기포
      g.ellipse(12, 17, 11, 5, function (v) { return v < 0.35 ? '#0a0210' : v < 0.7 ? '#3a0a50' : '#8a2ab0'; });
      g.outline();
      g.ring(12, 17, 3, 4.2, 0, 300, function () { return '#d070e0'; });
      g.disc(7, 9, 1.6, '#d070e0'); g.disc(15, 6, 2, '#8a2ab0'); g.disc(18, 11, 1.3, '#ff9af0');
      g.px(7, 8, K.wht); g.px(15, 5, '#ffd8f4');
    },
    wraith: function (g) {                  // 악령 회오리(2026-11-08 망령 소환을 바꿈): 검보라 소용돌이 고리 둘 + 휘도는 검은 해골 악령 셋(빨간 눈 · 꼬리)
      g.ring(12, 12, 8.5, 10.5, 200, 110, function (t) { return t > 0.75 ? '#8a2ab0' : t > 0.35 ? '#3a0a50' : '#1a0628'; });
      g.ring(12, 12, 4.5, 6.2, 20, 290, function (t) { return t > 0.7 ? '#d070e0' : '#6a1a8a'; });
      g.disc(12, 12, 2.4, '#0a0210');
      [[5, 6, 1], [18, 9, -1], [10, 18, 1]].forEach(function (q) {
        var x = q[0], y = q[1];
        g.rect(x - 2, y - 2, 5, 4, '#0a0210'); g.rect(x - 1, y + 2, 3, 1, '#0a0210');
        g.rect(x - 2 - 2 * q[2], y + 1, 2, 1, '#2a0838');
      });
      g.outline('#8a2ab0');
      [[5, 6], [18, 9], [10, 18]].forEach(function (q) { g.px(q[0] - 1, q[1] - 1, '#ff2a3a'); g.px(q[0] + 1, q[1] - 1, '#ff2a3a'); });
      g.px(21, 3, '#d070e0'); g.px(2, 20, '#d070e0'); g.px(20, 20, '#8a2ab0');
    },
    abyss: function (g) {                   // 심연의 문(필살): 땅에 선 거대한 검은 문(검보라 테) + 빨려 드는 화살
      g.ellipse(12, 11, 6.5, 10, function (v) { return v < 0.55 ? '#06000a' : v < 0.8 ? '#6a1a8a' : '#d070e0'; });
      g.outline();
      g.ring(12, 11, 2, 3.2, 30, 280, function () { return '#8a2ab0'; });
      g.rect(2, 22, 20, 1, '#8a2ab0');
      g.map(0, 8, ['a..', '.a.', 'a..'], { a: '#ffd8f4' }); g.map(21, 8, ['..a', '.a.', '..a'], { a: '#ffd8f4' });
      g.px(12, 1, K.wht); g.px(5, 3, '#ff9af0'); g.px(19, 18, '#ff9af0');
    },
    // ===== 법사 =====
    fireball: function (g) {                // 화염구: 오른쪽으로 날아가는 불덩이 + 불꼬리
      g.poly([[12, 5], [1, 2], [6, 9], [0, 12], [6, 15], [1, 21], [13, 19]], K.f3);
      g.poly([[12, 8], [5, 6], [8, 10], [4, 12], [8, 14], [5, 18], [13, 16]], K.f2);
      g.disc(15, 12, 6.4, function (d, x, y) {
        var e = Math.sqrt((x - 16.5) * (x - 16.5) + (y - 10.5) * (y - 10.5));
        return e < 2 ? K.f0 : e < 3.6 ? K.f1 : d > 5.6 ? K.f3 : K.f2;
      });
      g.outline();
      g.px(17, 9, K.wht); g.px(3, 4, K.f1); g.px(2, 18, K.f1); g.px(9, 22, K.f2);
    },
    bolt: function (g) {                    // 번개: 먹구름 + 내리꽂는 번개
      g.disc(6, 6, 3.6, K.c1); g.disc(12, 4.5, 4.4, K.c1); g.disc(18, 6, 3.6, K.c1); g.rect(4, 6, 16, 4, K.c1);
      g.disc(11, 3.5, 2.6, K.c0); g.disc(6, 5.5, 1.8, K.c0); g.rect(4, 9, 16, 1, K.c2);
      g.poly([[13, 9], [7, 16], [11, 16], [8, 23], [17, 13], [13, 13], [16, 9]], function (x, y) { return K.f1; });
      g.line(13, 10, 9, 15, K.wht); g.line(12, 16, 10, 20, K.f0);
      g.outline();
      g.px(4, 15, K.p1); g.px(19, 18, K.p1); g.px(3, 20, K.p1);
      g.spark(20, 14, false);
    },
    rise: function (g) {                    // 땅 융기(띄우기): 보라 마법진 위로 솟는 돌기둥 + 뜬 돌
      g.ellipse(12, 20, 11, 3.2, function (v) { return v > 0.62 ? K.p1 : K.p3; });
      g.poly([[7, 21], [7, 6], [9, 4], [12, 5], [14, 3], [16, 6], [16, 21]], function (x, y) { return x < 9 ? '#d8c8b0' : x < 14 ? '#a89478' : '#6e5e4a'; });
      g.line(8, 10, 11, 9, '#4a3e30'); g.line(11, 9, 12, 12, '#4a3e30'); g.line(13, 14, 15, 13, '#4a3e30'); g.line(9, 16, 11, 17, '#4a3e30');
      g.px(9, 7, K.wht); g.px(13, 5, '#f0e8d8');
      g.outline();
      g.ellipse(12, 20.5, 11, 3, function (v, x, y) { return y > 20 && (x < 7 || x > 16) ? (v > 0.6 ? K.p1 : null) : null; });
      g.rect(3, 4, 2, 2, '#a89478'); g.rect(19, 1, 3, 2, '#d8c8b0'); g.rect(19, 10, 2, 2, '#a89478');
      g.line(4, 8, 4, 12, K.p0); g.line(19, 14, 19, 17, K.p0); g.line(21, 4, 21, 7, K.p0);
      g.px(3, 9, K.p0); g.px(20, 14, K.p0); g.px(4, 14, K.p1);
    },
    amp: function (g) {                     // 원소 증폭(늘 켜짐): 보라 수정구 + 둘레 세 원소(불·얼음·번개)
      g.ring(12, 12, 8.4, 9.4, 0, 359, function (t) { return Math.floor(t * 24) % 2 ? K.p2 : null; });
      g.disc(12, 12, 5.4, function (d, x, y) { var e = Math.sqrt((x - 10.5) * (x - 10.5) + (y - 10.5) * (y - 10.5)); return e < 1.6 ? K.wht : e < 3 ? K.p0 : d > 4.5 ? K.p3 : K.p1; });
      g.disc(12, 3, 2.2, function (d) { return d < 1 ? K.f1 : K.f3; });
      g.disc(4, 17, 2.2, function (d) { return d < 1 ? K.i0 : K.i3; });
      g.disc(20, 17, 2.2, function (d) { return d < 1 ? K.f0 : K.f1; });
      g.outline();
      g.map(10, 19, ['..a..', '.aaa.', 'aa.aa'], { a: K.g1 });
    },
    flow: function (g) {                    // 마나 순환(늘 켜짐): 도는 두 화살표 + 마나 방울
      g.ring(12, 12, 8, 10, 200, 330, K.m0);
      g.ring(12, 12, 8, 10, 20, 150, K.m1);
      g.poly([[19.5, 2], [23.5, 9], [16, 8]], K.m0);
      g.poly([[4.5, 22], [0.5, 15], [8, 16]], K.m1);
      g.poly([[12, 6], [8.5, 13], [15.5, 13]], K.m1); g.disc(12, 14, 3.6, function (d, x, y) { return x < 11 && y < 14 ? K.m0 : d > 2.8 ? K.m2 : K.m1; });
      g.outline();
      g.px(11, 9, K.wht); g.px(10, 12, K.wht);
    },
    ice: function (g) {                     // 빙산 솟구치기: 땅에서 앞으로 갈수록 커지는 얼음 줄 + 맨 끝 송곳 빙산
      function crag(cx, hw, top, lean) {    // 왼쪽 면 밝게 · 오른쪽 면 어둡게
        g.poly([[cx - hw, 21], [cx + lean, top], [cx + hw, 21]], function (x) { return x < cx + lean * 0.5 ? K.i0 : K.i2; });
      }
      crag(3, 1.8, 17.5, 0.4); crag(7.5, 2.4, 14, 0.6); crag(12.5, 3, 10, 0.8);
      g.poly([[15.5, 21], [17.5, 13], [20.6, 0.5], [20.2, 13], [23.5, 21]], function (x, y) { return x < 19.6 - (21 - y) * 0.05 ? K.i0 : K.i2; });   // 송곳 빙산
      g.outline();
      g.line(20, 4, 18, 14, K.wht); g.line(12, 12, 11, 16, K.wht); g.px(7, 16, K.wht);
      g.rect(0, 21, 24, 2, K.i3); g.rect(0, 23, 24, 1, K.i4);   // 언 땅
      g.px(5, 21, K.i1); g.px(10, 22, K.i1); g.px(17, 21, K.i1);
      g.spark(6, 6, false, K.i1); g.px(2, 12, K.i0);
    },
    meteor: function (g) {                  // 메테오: 불꼬리를 끌고 떨어지는 운석
      g.poly([[5, 11], [22, 0], [24, 3], [12, 19]], K.f3);
      g.poly([[8, 12], [21, 2], [11, 16]], K.f2);
      g.poly([[10, 13], [19, 5], [11, 14]], K.f1);
      g.outline();
      g.disc(8, 16, 5.6, function (d, x, y) { var u = x - y; return d > 4.6 && u > -6 ? K.f2 : u < -10 ? K.e3 : u < -7 ? K.e2 : K.e1; });
      g.px(6, 15, K.e3); g.px(9, 18, K.e3); g.px(5, 18, K.e3); g.px(7, 13, K.e0);
      g.outline();
      g.px(22, 8, K.f1); g.px(17, 13, K.f2); g.px(15, 2, K.f1);
    },
    blink: function (g) {                   // 순간이동: 흐려지는 왼쪽 문 → 화살표 → 오른쪽 문
      g.ellipse(5, 13, 3.4, 7.6, function (v, x, y) { return v > 0.55 ? ((x + y) % 2 ? K.p2 : null) : null; });
      g.ellipse(17, 12, 5, 9.4, function (v, x, y) { return v > 0.62 ? K.p1 : v > 0.3 ? K.p2 : K.p3; });
      g.ellipse(17, 12, 2, 4.6, K.p0);
      g.outline();
      g.px(17, 11, K.wht); g.px(17, 12, K.wht);
      for (var x = 5; x <= 10; x += 2) g.px(x, 12, K.wht);
      g.map(9, 10, ['a..', 'aa.', 'aaa', 'aa.', 'a..'], { a: K.wht });
      g.spark(4, 3, false, K.p0); g.px(22, 22, K.p0); g.px(1, 21, K.p1);
    },
    shield: function (g) {                  // 마나 방패(늘 켜짐): 파란 기운 육각 방패 + 가운데 마나 수정
      var hex = []; for (var k = 0; k < 6; k++) { var a = (k * 60 - 90) * Math.PI / 180; hex.push([12 + 10.8 * Math.cos(a), 12 + 10.8 * Math.sin(a)]); }
      g.poly(hex, function (x, y) { return (x + y) % 4 === 0 || (x - y + 24) % 4 === 0 ? K.m1 : K.m2; });
      var edge = [];
      for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (g.get(x, y) && (!g.get(x - 1, y) || !g.get(x + 1, y) || !g.get(x, y - 1) || !g.get(x, y + 1))) edge.push([x, y]);
      edge.forEach(function (e) { g.px(e[0], e[1], e[1] < 12 ? K.i0 : K.m0); });
      g.poly([[12, 5], [16.5, 12], [12, 19], [7.5, 12]], function (x, y) { return x < 12 ? (y < 12 ? K.wht : K.i1) : (y < 12 ? K.i1 : K.i2); });
      g.outline();
    },
    pillar: function (g) {                  // 불기둥: 바닥에서 크게 솟는 불 기둥
      g.rect(0, 20, 24, 4, K.e3); g.rect(0, 20, 24, 1, K.e2);
      for (var y = 0; y < 21; y++) {
        var w = 3.2 + y * 0.16 + Math.sin(y * 1.3) * 1.1, c = 12;
        for (var x = 0; x < N; x++) {
          var d = Math.abs(x + 0.5 - c);
          if (d < w) g.px(x, y, d < w * 0.35 && y > 4 ? (y > 12 ? K.f0 : K.f1) : d < w * 0.7 ? K.f2 : K.f3);
        }
      }
      g.poly([[5, 20], [3, 12], [7, 17]], K.f3); g.poly([[19, 20], [21, 11], [17, 17]], K.f3);
      g.outline();
      g.ellipse(12, 20.5, 9, 1.6, function (v) { return v > 0.4 ? K.f1 : K.f0; });
      g.px(3, 5, K.f1); g.px(20, 3, K.f2); g.px(21, 8, K.f1); g.px(2, 1, K.f2);
    },
    brand: function (g) {                   // 원소 낙인(늘 켜짐): 적에게 찍히는 불타는 마법 문양
      g.ring(12, 12, 8.6, 10.6, 0, 359, function (t) { return K.f2; });
      g.ring(12, 12, 9.6, 10.6, 0, 359, function (t) { return K.f1; });
      g.outline();
      g.line(12, 4, 5, 16, K.f1); g.line(12, 4, 19, 16, K.f1); g.line(5, 16, 19, 16, K.f1);
      g.map(10, 9, ['..a..', '.aba.', 'abcba', 'abcba', '.aaa.'], { a: K.f3, b: K.f1, c: K.f0 });
      g.outline();
      [[12, 1], [1, 12], [22, 12], [12, 22]].forEach(function (p) { g.px(p[0], p[1], K.f0); });
      g.spark(20, 3, false);
    },
    // ===== 법사 새 기술(2026-11-08) =====
    eshard: function (g) {                  // 원소 파편(늘 켜짐): 가운데 마법 터짐 + 사방으로 튀는 불 · 얼음 조각(번갈아)
      g.disc(12, 12, 3.6, function (d) { return d > 2.6 ? K.p1 : K.p0; });
      [[12, 2, 0, 1], [20, 5, -1, 1], [21, 17, -1, -1], [12, 21, 0, -1], [3, 17, 1, -1], [4, 5, 1, 1]].forEach(function (q, i) {
        var x = q[0], y = q[1], dx = q[2], dy = q[3], c0 = i % 2 ? K.i0 : K.f1, c1 = i % 2 ? K.i2 : K.f3;
        g.px(x, y, c0); g.px(x + dx, y + dy, c0); g.px(x + dx * 2, y + dy * 2, c1); g.px(x + (dy ? 1 : 0), y + (dx ? 1 : 0), c1);
      });
      g.outline();
      g.spark(12, 12, false, K.p0);
      g.px(8, 8, K.f2); g.px(16, 8, K.i1); g.px(8, 16, K.i1); g.px(16, 16, K.f2);
    },
    gravity: function (g) {                 // 중력 구체: 검은 속 보라 구체 + 기울어진 고리 + 빨려드는 화살 넷
      g.disc(12, 12, 6.4, function (d, x, y) { return d < 3.2 ? '#12041e' : d < 4.6 ? K.p3 : (x + y < 22 ? K.p1 : K.p2); });
      g.outline();
      g.ellipse(12, 12, 10.5, 3.2, function (v, x, y) { return v > 0.62 && (y > 12 || Math.abs(x - 12) > 6) ? K.p0 : null; });
      g.px(10, 10, K.p0); g.px(11, 9, K.wht);
      g.map(1, 2, ['a..', '.a.', '..a'], { a: K.wht }); g.map(20, 2, ['..a', '.a.', 'a..'], { a: K.wht });
      g.map(1, 19, ['..a', '.a.', 'a..'], { a: K.wht }); g.map(20, 19, ['a..', '.a.', '..a'], { a: K.wht });
    },
    vortex: function (g) {                  // 마력 소용돌이(늘 켜짐): 바닥 보라 나선 + 위로 넓어지는 작은 깔때기
      g.ellipse(12, 20, 10, 2.8, function (v) { return v > 0.6 ? K.p1 : K.p3; });
      for (var y = 4; y < 20; y++) {
        var w = 1.5 + (20 - y) * 0.45, sx = Math.sin(y * 0.8) * 1.2;
        g.px(12 + sx - w, y, K.p2); g.px(12 + sx + w, y, K.p1);
        if (y % 3 === 0) for (var x = Math.round(12 + sx - w) + 1; x < 12 + sx + w; x++) g.px(x, y, (x + y) % 2 ? K.p0 : K.p1);
      }
      g.outline();
      g.spark(5, 4, false, K.p0); g.spark(19, 7, false, K.p0);
    },
    echain: function (g) {                  // 원소 연쇄(늘 켜짐): 줄줄이 터지는 세 폭발(작은 → 큰)
      [[5, 17, 3.2], [12, 12, 4], [19, 6, 4.6]].forEach(function (b, i) {
        g.disc(b[0], b[1], b[2], function (d) { return d < b[2] * 0.4 ? K.f0 : d < b[2] * 0.75 ? (i === 1 ? K.p1 : K.f1) : (i === 1 ? K.p2 : K.f2); });
      });
      g.outline();
      g.line(7, 15, 9, 14, K.f1); g.line(14, 10, 16, 8, K.f1);
      g.spark(19, 6, false); g.px(2, 22, K.f2); g.px(22, 14, K.p0);
    },
    frost: function (g) {                   // 빙결 폭풍: 구름에서 비스듬히 쏟아지는 얼음 + 땅의 얼음 덩어리
      g.disc(6, 5, 3.4, K.c0); g.disc(12, 4, 4.2, K.c0); g.disc(18, 5, 3.4, K.c0); g.rect(4, 5, 16, 3, K.c0); g.rect(4, 8, 16, 1, K.c1);
      for (var i = 0; i < 5; i++) { var x0 = 4 + i * 4; g.line(x0, 11, x0 - 2, 16, i % 2 ? K.i1 : K.i0); }
      g.poly([[3, 23], [5, 18], [8, 17], [10, 20], [13, 16], [17, 18], [21, 17], [22, 23]], function (x, y) { return y < 19 ? K.i0 : (x + y) % 3 ? K.i2 : K.i1; });
      g.outline();
      g.px(14, 18, K.wht); g.px(6, 19, K.wht); g.spark(21, 12, false, K.i1);
    },
    judgment: function (g) {                // 천둥 심판: 하늘에서 땅까지 굵은 번개 기둥 + 땅 큰 빛 + 둘레 작은 번개
      g.rect(9, 0, 6, 24, '#2a6ab0');
      g.poly([[14, 0], [8, 9], [12, 9], [9, 18], [16, 8], [12, 8], [16, 0]], K.wht);
      g.line(13, 1, 10, 8, K.i0); g.line(11, 10, 10, 16, K.i0);
      g.ellipse(12, 21, 10, 2.6, function (v) { return v < 0.4 ? K.wht : v < 0.8 ? K.f0 : K.f1; });
      g.outline();
      g.line(3, 8, 5, 12, K.f1); g.line(5, 12, 3, 16, K.f1); g.line(21, 6, 19, 11, K.f1); g.line(19, 11, 21, 15, K.f1);
      g.spark(4, 3, false); g.spark(20, 2, false, K.i1);
    },
    // 날렵한 몸놀림(기사 · 법사 늘 켜짐, 2026-11-08): 겹친 하늘색 화살 두 개(회피 2번) + 뒤로 남는 속도 줄
    nimble: function (g) {
      [[2, 0.55], [10, 1]].forEach(function (q) {
        var x = q[0];
        g.poly([[x, 3], [x + 5, 3], [x + 11, 12], [x + 5, 21], [x, 21], [x + 6, 12]], function (px, py) {
          var t = (py - 3) / 18; return q[1] < 1 ? (t < 0.5 ? K.i2 : K.i3) : (t < 0.35 ? K.i0 : t < 0.7 ? K.i1 : K.i2);
        });
      });
      g.outline();
      g.line(0, 7, 2, 7, K.i1); g.line(0, 17, 2, 17, K.i1);
      g.spark(21, 4, false, K.i0);
    },
    // ===== 모든 직업 (2026-11-07 PC 아래 막대: 회피 칸 · 평타 · 점프 칸) =====
    dodge: function (g) {                   // 회피: 몸을 굴려 피하는 하늘색 반원 화살표 + 뒤로 남는 속도 줄 + 먼지
      g.ring(11, 15, 6, 9, 185, 345, function (t) { return t < 0.3 ? K.i3 : t < 0.65 ? K.i2 : K.i1; });
      g.map(15, 13, ['aaaaaaa', '.abbba.', '..aba..', '...a...'], { a: K.i1, b: K.i0 });
      g.outline();
      g.ring(11, 15, 8, 8.6, 220, 320, function () { return K.i0; });
      g.line(1, 9, 4, 9, K.i1); g.line(0, 12, 3, 12, K.i2); g.line(1, 15, 3, 15, K.i1);
      g.px(4, 21, K.e1); g.px(6, 22, K.e2); g.px(19, 21, K.e1); g.px(17, 22, K.e2); g.px(12, 22, K.e1);
    },
    atk: function (g) {                     // 평타: 비스듬한 칼 + 하얀 칼바람
      diagSword(g, 20, 2, 12, 1);
      g.outline();
      g.ring(10, 13, 9, 10.4, 200, 300, function (t) { return t < 0.5 ? K.s1 : K.wht; });
      g.spark(5, 4, false);
    },
    jump: function (g) {                    // 점프: 위로 솟는 금빛 화살표 + 땅 + 먼지
      g.poly([[12, 1.5], [20, 10], [15, 10], [15, 17], [9, 17], [9, 10], [4, 10]], function (x, y) { return x < 11 ? K.g0 : x < 13 ? K.g1 : K.g2; });
      g.outline();
      g.rect(3, 20, 18, 2, K.e1); g.rect(3, 21, 18, 1, K.e2);
      g.px(5, 18, K.e0); g.px(19, 18, K.e0); g.px(7, 17, K.e1); g.px(17, 17, K.e1);
    }
  };

  var META = {
    dash: ['돌진베기', 'knight', 'active', 'steel'], spin: ['회전베기', 'knight', 'active', 'steel'], upper: ['올려베기', 'knight', 'active', 'steel'],
    mastery: ['검 숙련', 'knight', 'passive', 'steel'], skin: ['강철 피부', 'knight', 'passive', 'steel'], wave: ['검기 날리기', 'knight', 'active', 'steel'],
    slam: ['대지 내려찍기', 'knight', 'active', 'earth'], grit: ['투지', 'knight', 'passive', 'blood'], counter: ['반격', 'knight', 'passive', 'blood'],
    storm: ['칼날 폭풍', 'knight', 'active', 'steel'], holy: ['성검 낙뢰', 'knight', 'active', 'holy'],
    shards: ['칼날 파편', 'knight', 'passive', 'steel'], thrust: ['연속 찌르기', 'knight', 'active', 'steel'], pressure: ['끌어당기는 검압', 'knight', 'passive', 'ice'],   // 1차 기사(2026-11-08)
    aegis: ['신성 가호', 'knight', 'passive', 'holy'], cross: ['심판의 십자', 'knight', 'active', 'holy'], charge: ['성스러운 돌격', 'knight', 'active', 'holy'],   // 성기사(2차, 2026-11-08)
    fireball: ['화염구', 'mage', 'active', 'fire'], bolt: ['번개', 'mage', 'active', 'storm'], rise: ['땅 융기', 'mage', 'active', 'earth'],
    amp: ['원소 증폭', 'mage', 'passive', 'arcane'], flow: ['마나 순환', 'mage', 'passive', 'ice'], ice: ['빙하 균열', 'mage', 'active', 'ice'],
    meteor: ['메테오', 'mage', 'active', 'fire'], blink: ['순간이동', 'mage', 'active', 'arcane'], shield: ['마나 방패', 'mage', 'passive', 'ice'],
    pillar: ['불기둥', 'mage', 'active', 'fire'], brand: ['원소 낙인', 'mage', 'passive', 'arcane'],
    eshard: ['원소 파편', 'mage', 'passive', 'fire'], gravity: ['중력 구체', 'mage', 'active', 'arcane'], vortex: ['마력 소용돌이', 'mage', 'passive', 'arcane'],   // 1차 법사(2026-11-08)
    echain: ['원소 연쇄', 'mage', 'passive', 'fire'], frost: ['빙결 폭풍', 'mage', 'active', 'ice'], judgment: ['천둥 심판', 'mage', 'active', 'storm'],     // 대마법사(2차, 2026-11-08)
    arcwave: ['마력 검기', 'knight', 'active', 'arcane'], infuse: ['마력 부여', 'knight', 'passive', 'arcane'], rift: ['차원 베기', 'knight', 'active', 'arcane'],   // 마검사(2차 갈래 B, 2026-11-08)
    msword: ['마검 소환', 'knight', 'active', 'arcane'], unleash: ['마검 해방', 'knight', 'active', 'arcane'],
    darkorb: ['어둠의 구체', 'mage', 'active', 'dark'], leech: ['생명 흡수', 'mage', 'passive', 'blood'], swamp: ['저주의 늪', 'mage', 'active', 'dark'],   // 흑마법사(2차 갈래 B, 2026-11-08)
    wraith: ['악령 회오리', 'mage', 'active', 'dark'], abyss: ['심연의 문', 'mage', 'active', 'dark'],
    nimble: ['날렵한 몸놀림', 'all', 'passive', 'ice'],   // 기사 · 법사 늘 켜진 기술(2026-11-08)
    // 암살자(2026-11-09): 1차 = 단검(blade) · 그림자 무사 = shadow · 독술사 = venom
    ashadow: ['그림자 습격', 'assassin', 'active', 'blade'], arise: ['칼날 올려치기', 'assassin', 'active', 'blade'], afan: ['단검 부채', 'assassin', 'active', 'blade'],
    awhirl: ['칼날 회오리', 'assassin', 'active', 'blade'], ablink: ['그림자 걸음', 'assassin', 'active', 'blade'], asmoke: ['연막탄', 'assassin', 'active', 'blade'],
    amast: ['단검 숙련', 'assassin', 'passive', 'blade'], akeen: ['급소 노리기', 'assassin', 'passive', 'blood'], aecho: ['잔영 베기', 'assassin', 'passive', 'blade'],
    aorbit: ['떠도는 단검', 'assassin', 'passive', 'blade'], avenom: ['독 바르기', 'assassin', 'passive', 'venom'], aexec: ['처형', 'assassin', 'passive', 'blood'],
    sclone: ['그림자 분신', 'assassin', 'active', 'shadow'], sshade: ['그림자 동행', 'assassin', 'passive', 'shadow'], sflash: ['그림자 난무', 'assassin', 'active', 'shadow'],
    sstorm: ['암영 십자참', 'assassin', 'active', 'shadow'], smoon: ['월영참', 'assassin', 'active', 'shadow'],
    pdarts: ['독침 부채', 'assassin', 'active', 'venom'], pplague: ['역병 전염', 'assassin', 'passive', 'venom'], pcloud: ['독구름', 'assassin', 'active', 'venom'],
    ppool: ['맹독 웅덩이', 'assassin', 'active', 'venom'], perupt: ['역병 폭발', 'assassin', 'active', 'venom'],
    // 3차(2026-11-10): 검성(기사) · 현자(법사)
    sswave: ['성검 파도', 'knight', 'active', 'holy'], ssaura: ['검성의 경지', 'knight', 'passive', 'holy'], ssrain: ['천검 강림', 'knight', 'active', 'holy'],
    ssflash: ['일섬', 'knight', 'active', 'holy'], ssjudge: ['천상의 심판', 'knight', 'active', 'holy'],
    sgorb: ['원소 융합탄', 'mage', 'active', 'fire'], sgcycle: ['원소 순환', 'mage', 'passive', 'arcane'], sgstorm: ['삼원소 폭풍', 'mage', 'active', 'storm'],
    sgnova: ['원소 대폭발', 'mage', 'active', 'fire'], sgdoom: ['종말의 별', 'mage', 'active', 'arcane'],
    smwave: ['그림자 초승달', 'assassin', 'active', 'shadow'], smshade: ['군주의 그림자 칼날', 'assassin', 'passive', 'shadow'], smrain: ['그림자 칼날비', 'assassin', 'active', 'shadow'],
    smflash: ['그림자 섬광', 'assassin', 'active', 'shadow'], smjudge: ['그림자 군주 강림', 'assassin', 'active', 'shadow'],   // 그림자 군주(2026-11-10)
    fgwind: ['대풍 화살', 'archer', 'active', 'wild'], fgspirit: ['숲의 정령 매', 'archer', 'passive', 'wild'], fgroots: ['가시나무 대지', 'archer', 'active', 'wild'],
    fgstorm: ['폭풍의 숲', 'archer', 'active', 'wild'], fgjudge: ['대자연의 심판', 'archer', 'active', 'wild'],   // 숲의 수호자(3차, 2026-11-10)
    dvlance: ['빙결 삼연시', 'archer', 'active', 'snipe'], dveye: ['신궁의 눈', 'archer', 'passive', 'snipe'], dvrain: ['천궁 유성우', 'archer', 'active', 'snipe'],
    dvpierce: ['천궁 관통', 'archer', 'active', 'snipe'], dvsky: ['천궁의 심판', 'archer', 'active', 'snipe'],   // 신궁(3차, 2026-11-10)
    mkcross: ['마검 십자참', 'knight', 'active', 'arcane'], mkblades: ['떠도는 마검', 'knight', 'passive', 'arcane'], mkrain: ['마검 폭우', 'knight', 'active', 'arcane'],
    mkrift: ['차원 붕괴', 'knight', 'active', 'arcane'], mkking: ['마검왕 강림', 'knight', 'active', 'arcane'],
    abhex: ['저주 해골탄', 'mage', 'active', 'dark'], absoul: ['흡혼의 해골', 'mage', 'passive', 'dark'], abmaw: ['심연의 손아귀', 'mage', 'active', 'dark'],
    abnova: ['심연 파동', 'mage', 'active', 'dark'], abgate: ['심연의 문', 'mage', 'active', 'dark'],   // 심연술사(3차, 2026-11-10)
    // 궁수(2026-11-09): 1차 = 바람(wind) · 저격수 = snipe · 레인저 = wild
    pshot: ['관통 화살', 'archer', 'active', 'wind'], upshot: ['솟구치는 화살', 'archer', 'active', 'wind'], multi: ['부채꼴 화살', 'archer', 'active', 'wind'],
    rain: ['화살비', 'archer', 'active', 'wind'], leap: ['공중제비 사격', 'archer', 'active', 'wind'], burst: ['폭발 화살', 'archer', 'active', 'fire'],
    aim: ['활 숙련', 'archer', 'passive', 'wind'], focus: ['집중', 'archer', 'passive', 'blood'], split: ['갈래 화살', 'archer', 'passive', 'wind'],
    volley: ['자동 연사', 'archer', 'passive', 'holy'], gale: ['바람의 가호', 'archer', 'passive', 'wind'], mark: ['사냥꾼의 표식', 'archer', 'passive', 'fire'],
    snipe: ['저격', 'archer', 'active', 'snipe'], deadeye: ['필중', 'archer', 'passive', 'snipe'], ballista: ['대포 화살', 'archer', 'active', 'snipe'],
    rapid: ['속사', 'archer', 'active', 'snipe'], skyfall: ['천공의 일격', 'archer', 'active', 'snipe'],
    tempest: ['화살 폭풍', 'archer', 'active', 'wild'], hawk: ['매 동료', 'archer', 'passive', 'wild'], trap: ['덫 설치', 'archer', 'active', 'wild'],
    twister: ['회오리 화살', 'archer', 'active', 'wild'], barrage: ['천 개의 화살', 'archer', 'active', 'wild'],
    dodge: ['회피', 'all', 'active', 'ice'], atk: ['평타', 'all', 'active', 'steel'], jump: ['점프', 'all', 'active', 'earth']
  };
  // 견습 기본기 올려치기(2026-11-07): 올려베기 그림을 흙색 액자로(새 그림 없음)
  META.nupper = ['올려치기', 'novice', 'active', 'earth'];
  if (ART.upper && !ART.nupper) ART.nupper = ART.upper;
  var meta = {}; Object.keys(META).forEach(function (k) { var m = META[k]; meta[k] = { name: m[0], cls: m[1], kind: m[2], theme: m[3] }; });

  // ---------- 한 장 만들기 ----------
  var cache = {};
  function hex(c) { var n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function lerp(a, b, t) { return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); }); }
  // 바탕: 가운데 밝고 바깥 어두운 4단계 + 경계는 바둑판 섞기(도트 그림식 그러데이션)
  function paintBg(put, x0, y0, n, theme) {
    var T = THEME[theme] || THEME.steel, A = hex(T[0]), B = hex(T[1]), c = (n - 1) / 2;
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var d = Math.sqrt((x - c) * (x - c) * 0.8 + (y - c + 2) * (y - c + 2)) / (n * 0.62);
      var q = d * 4 + (((x + y) & 1) ? 0.25 : -0.25);
      put(x0 + x, y0 + y, lerp(A, B, Math.max(0, Math.min(3, Math.floor(q))) / 3));
    }
  }
  function build(id, o) {
    o = o || {};
    var key = id + '|' + !!o.frame + '|' + (o.bg !== false) + '|' + !!o.gray;
    if (cache[key]) return cache[key];
    var m = meta[id] || { theme: 'steel', kind: 'active' }, S = o.frame ? 32 : N, off = o.frame ? 4 : 0;
    var cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    var cx = cv.getContext('2d'), img = cx.createImageData(S, S), D = img.data;
    function put(x, y, rgb, a) { if (x < 0 || y < 0 || x >= S || y >= S) return; var i = (y * S + x) * 4; D[i] = rgb[0]; D[i + 1] = rgb[1]; D[i + 2] = rgb[2]; D[i + 3] = a == null ? 255 : a; }
    if (o.frame) {
      // 액자 색 = 원소(갈래) 색: 칼 = 금 · 불 = 빨강 · 얼음/마나 = 하늘 · 번개 = 노랑 · 흙 = 갈색 · 마법 = 보라 · 피 = 진홍 (FRAME)
      //   쓰는 기술 = 네모 액자(원소 색 한 겹) / 늘 켜진 기술 = 둥근(팔각) 은빛 액자 + 안쪽 원소 색 한 줄
      var pas = m.kind === 'passive', F = FRAME[m.theme] || FRAME.steel, ink = hex(K.ink), in2 = hex('#2a1608');
      var hi = hex(pas ? '#ffffff' : F[0]), mid = hex(pas ? '#c8ccd8' : F[1]), lo = hex(pas ? '#6a7088' : F[2]);
      var cut = pas ? 6 : 1;   // 귀퉁이 깎는 정도(늘 켜짐 = 둥글게)
      paintBg(put, 3, 3, 26, m.theme);
      for (var i = 0; i < S; i++) for (var j = 0; j < S; j++) {
        var e = Math.min(i, j, S - 1 - i, S - 1 - j);
        var ci = Math.min(i, S - 1 - i), cj = Math.min(j, S - 1 - j), dg = ci + cj - cut;   // 대각선 깎기
        if (dg < 0) { put(i, j, [0, 0, 0], 0); continue; }
        var ee = Math.min(e, dg);
        if (ee === 0) put(i, j, ink);
        else if (ee === 1) put(i, j, i + j < S - 1 ? hi : lo);
        else if (ee === 2) put(i, j, pas ? hex(F[1]) : mid);
        else if (ee === 3) put(i, j, in2);
      }
      if (!pas) [[0, 0], [S - 1, 0], [0, S - 1], [S - 1, S - 1]].forEach(function (p) { put(p[0], p[1], [0, 0, 0], 0); });
    } else if (o.bg !== false) paintBg(put, 0, 0, N, m.theme);
    var g = new Grid(); if (ART[id]) ART[id](g);
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var c = g.p[y * N + x]; if (c) put(off + x, off + y, hex(c)); }
    if (o.gray) for (var k = 0; k < D.length; k += 4) { var l = Math.round((D[k] * 0.3 + D[k + 1] * 0.59 + D[k + 2] * 0.11) * 0.75); D[k] = l; D[k + 1] = l * 0.95; D[k + 2] = l * 0.88; }
    cx.putImageData(img, 0, 0);
    cache[key] = cv;
    return cv;
  }

  var PixelIcons = {
    ids: Object.keys(META), meta: meta, theme: THEME, frameColors: FRAME, colors: K,
    // 버튼·기술 창 CSS 테두리용: 그 기술의 액자 색 [밝은, 가운데, 어두운]
    frame: function (id) { var m = meta[id]; return FRAME[(m && m.theme) || 'steel'] || FRAME.steel; },
    // 바탕 그림 원본(24 또는 32칸) 캔버스
    source: function (id, opts) { return build(id, opts); },
    // ctx 에 그리기 (가장 가까운 점 확대 → 정수 배일 때 가장 또렷)
    draw: function (ctx, id, size, x, y, opts) {
      var src = build(id, opts), sm = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(src, x || 0, y || 0, size, size);
      ctx.imageSmoothingEnabled = sm;
    },
    // 정수 배 캔버스 (scale = 2 → 48px, 액자 포함이면 64px)
    canvas: function (id, scale, opts) {
      var src = build(id, opts), cv = document.createElement('canvas');
      cv.width = src.width * scale; cv.height = src.height * scale;
      var c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(src, 0, 0, cv.width, cv.height);
      return cv;
    },
    dataURL: function (id, size, opts) {
      var cv = document.createElement('canvas'); cv.width = cv.height = size;
      PixelIcons.draw(cv.getContext('2d'), id, size, 0, 0, opts);
      return cv.toDataURL('image/png');
    }
  };
  root.PixelIcons = PixelIcons;
})(typeof window !== 'undefined' ? window : this);
