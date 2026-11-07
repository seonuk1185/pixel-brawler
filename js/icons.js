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
    holy: ['#8a6418', '#2e2008'], blood: ['#6e1a26', '#26080c']
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
    blood: ['#ffa0a0', '#d0303a', '#6a0c14']    // 투지·반격 = 진홍
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
    ice: function (g) {                     // 얼음창: 비스듬히 날아가는 얼음 창
      for (var i = 0; i < 12; i++) { g.px(2 + i, 21 - i, K.i3); g.px(3 + i, 21 - i, K.i4); g.px(2 + i, 20 - i, K.i2); }
      g.poly([[23.5, 0.5], [14, 4], [12.5, 11.5], [20, 10]], function (x, y) { var s = x + y; return s < 23 ? K.i0 : s > 24 ? K.i2 : K.wht; });
      g.line(22, 1, 14, 9, K.wht);
      g.outline();
      g.spark(6, 6, false, K.i1); g.spark(20, 17, false, K.i1); g.px(9, 22, K.i1); g.px(2, 14, K.i0);
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
    fireball: ['화염구', 'mage', 'active', 'fire'], bolt: ['번개', 'mage', 'active', 'storm'], rise: ['땅 융기', 'mage', 'active', 'earth'],
    amp: ['원소 증폭', 'mage', 'passive', 'arcane'], flow: ['마나 순환', 'mage', 'passive', 'ice'], ice: ['얼음창', 'mage', 'active', 'ice'],
    meteor: ['메테오', 'mage', 'active', 'fire'], blink: ['순간이동', 'mage', 'active', 'arcane'], shield: ['마나 방패', 'mage', 'passive', 'ice'],
    pillar: ['불기둥', 'mage', 'active', 'fire'], brand: ['원소 낙인', 'mage', 'passive', 'arcane'],
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
