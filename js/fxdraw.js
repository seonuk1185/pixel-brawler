// 코드로 매 장면 그리는 도트 효과 (2026-11-06, 우리 ourfx.js 의 novaRing 을 게임으로 옮김 — 외부 코드 안 씀)
// 9단계 마왕군 장군 화염 고리: 반지름이 계속 바뀌므로 그림을 늘리지 않고 매 장면 그 반지름으로 한 점씩 다시 그린다.
//   좌표 = 게임 도트. 작은 캔버스(도트 1:1)에 점을 찍고 → 부드럽게 하기 끄고 그대로 붙임 → HD 화면에서도 도트가 또렷함.
//   R = 고리 수치(config general.attacks.shockwave.rings, actorScale 곱한 뒤): r0, rMax, speed, ryMax, ringRx.
//   밝은 테두리(맞는 선) = 반지름 r 바로 안쪽 2도트 → 맞는 띠(r ± band) 한가운데. 판정은 main.js ringsStep 그대로.
(function () {
  // 지옥불 색: 흰 노랑 심지 → 주황 → 진홍 → 검붉은 끝 → 그을음
  var HF = { w: '#fff2c4', l: '#ffd25a', y: '#ff9a26', m: '#f05a16', r: '#c42414', d: '#7c0e14', k: '#3e0a12', s: '#22121a', sc: '#160c0e' };
  var BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  function dith(x, y, lv) { return BAY[y & 3][x & 3] < lv * 16; }   // lv 0..1 = 점 채우는 비율(바둑판 섞기)
  function hash(x, y, s) {
    var h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  var CC = {};
  function col(c) { var v = CC[c]; if (!v) v = CC[c] = [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; return v; }

  // 점 찍는 판: 고리마다 자기 판(o = 고리 객체에 붙여 둠) → 뒤쪽 반·앞쪽 반을 따로 그려도 한 장면에 한 번만 찍음
  var cv = null, cg = null, img = null, W = 0, Hh = 0;
  function board(o, w, h) {
    if (!o.cv) { o.cv = document.createElement('canvas'); o.cg = o.cv.getContext('2d'); }
    cv = o.cv; cg = o.cg;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; o.img = null; }
    W = w; Hh = h;
    if (!o.img) o.img = cg.createImageData(w, h);
    img = o.img; img.data.fill(0);
  }
  function set(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= Hh) return;
    var k = (y * W + x) * 4, v = col(c), d = img.data; d[k] = v[0]; d[k + 1] = v[1]; d[k + 2] = v[2]; d[k + 3] = 255;
  }
  // 고리 하나를 판에 찍음: cx,cy = 판 안의 가운데, tMs = 고리가 생긴 뒤 시간, seed = 고리마다 다른 불꽃 모양
  function novaRing(R, cx, cy, tMs, seed) {
    var life = (R.rMax - R.r0) / R.speed * 1000, u = clamp(tMs / life, 0, 1), r = Math.min(R.rMax, R.r0 + R.speed * tMs / 1000);
    var ry = Math.max(1, Math.min(r, R.ringRx) / R.ringRx * R.ryMax);
    var fade = u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25, fi = Math.floor(tMs / 50);
    var power = u < 0.12 ? 0.55 + u / 0.12 * 0.45 : u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45 * 0.8;
    // 1) 지나간 자리 그을음 + 바닥 열기(안쪽 띠) + 맞는 선
    for (var y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++) for (var x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
      var a = (x - cx) / r, b = (y - cy) / ry, q = Math.sqrt(a * a + b * b), dd = (1 - q) * r;   // dd = 고리 선에서 안쪽으로 몇 도트(가로 기준)
      if (dd < -1.5 || dd > 26) continue;
      if (dd < 0) { if (dith(x, y, 0.5 * fade)) set(x, y, HF.r); continue; }
      if (dd < 2.2) { set(x, y, fade > 0.5 ? (dd < 1 ? HF.l : HF.y) : HF.m); continue; }
      if (dd < 7) { if (dith(x, y, (0.75 - dd / 12) * fade)) set(x, y, dd < 4.5 ? HF.m : HF.r); continue; }
      if (dith(x, y, (0.55 - dd / 50) * fade)) set(x, y, hash(x, y, fi) < 0.06 ? HF.r : dd < 14 ? HF.k : HF.sc);
    }
    // 2) 불꽃 혀: 뒤쪽 반 먼저(위), 앞쪽 반 나중
    var circ = Math.PI * (3 * (r + ry) - Math.sqrt((3 * r + ry) * (r + 3 * ry))), NS = 128, step = Math.max(1, Math.round(NS * 3.6 / circ));
    [false, true].forEach(function (front) {
      for (var k = 0; k < NS; k += step) {
        var ang = (k + hash(k, 0, seed) * 0.6) / NS * Math.PI * 2, sn = Math.sin(ang); if ((sn >= 0) !== front) continue;
        var bx = cx + Math.cos(ang) * r, by = cy + sn * ry;
        var ph = (tMs / (260 + 120 * hash(k, 1, seed)) + hash(k, 2, seed)) % 1, lf = Math.sin(Math.PI * ph);
        var h = (7 + 16 * hash(k, 3, seed)) * lf * power * (front ? 1 : 0.85);
        if (h < 1.5) { if (fade > 0.2) set(bx, by - 1, HF.y); continue; }
        var lean = Math.cos(ang) * 0.35, sway = (hash(k, fi, seed) - 0.5) * 0.6, wb = h > 9 ? 2 : 1;
        for (var j = 0; j < h; j++) {
          var v = j / h, wd = Math.round(wb * (1 - v * v) + 0.2), ox = (lean + sway) * j * (0.4 + v);
          var c = v < 0.15 ? HF.w : v < 0.32 ? HF.l : v < 0.5 ? HF.y : v < 0.68 ? HF.m : v < 0.84 ? HF.r : HF.d;
          if (ph > 0.7 && v > 0.55) c = v > 0.8 ? HF.k : HF.d;
          for (var w = -wd; w <= wd; w++) set(bx + ox + w, by - j, (Math.abs(w) === wd && wd > 0 && v > 0.15) ? (v < 0.5 ? HF.m : HF.r) : c);
        }
        if (ph > 0.75 && h > 6) { set(bx + lean * h * 1.2, by - h - 2, HF.s); set(bx + lean * h * 1.2 + 1, by - h - 3, HF.s); }
      }
    });
    // 3) 불티: 고리에서 솟아 바깥·위로
    for (var e = 0; e < 26; e++) {
      var t0 = hash(e, 5, seed) * life * 0.8, age = tMs - t0; if (age < 0 || age > 420) continue;
      var ea = hash(e, 6, seed) * Math.PI * 2, er = Math.min(R.rMax, R.r0 + R.speed * t0 / 1000), ery = Math.min(er, R.ringRx) / R.ringRx * R.ryMax;
      set(cx + Math.cos(ea) * (er + age * 0.02), cy + Math.sin(ea) * ery - age * 0.05 - 4, age < 150 ? HF.l : age < 300 ? HF.y : HF.r);
    }
    return { r: r, ry: ry };
  }

  // 화면에 고리 하나: o = 고리 객체(판을 붙여 둠), x,y = 고리 가운데(화면 도트, 바닥), tMs, seed.
  //   part = 'back'(가운데 줄 위쪽 = 먼 쪽 반) / 'front'(아래쪽 = 가까운 쪽 반) / 없으면 전부. 판 크기 = 고리 크기 + 불꽃 높이만큼만
  function nova(ctx, o, R, x, y, tMs, seed, part) {
    var t = Math.max(0, tMs);
    if (o.novaT !== t || !o.cv) {
      var r = Math.min(R.rMax, R.r0 + R.speed * t / 1000), ry = Math.max(1, Math.min(r, R.ringRx) / R.ringRx * R.ryMax);
      var up = 30, w = Math.ceil(r * 2 + 12), h = Math.ceil(ry * 2 + up + 8);
      board(o, w, h);
      o.ncx = w >> 1; o.ncy = Math.ceil(ry) + up;
      novaRing(R, o.ncx, o.ncy, t, seed);
      o.cg.putImageData(o.img, 0, 0); o.novaT = t;
    }
    var c = o.cv, X = Math.round(x) - o.ncx, Y = Math.round(y) - o.ncy, sm = ctx.imageSmoothingEnabled;
    var y0 = part === 'front' ? o.ncy : 0, y1 = part === 'back' ? o.ncy : c.height;
    ctx.imageSmoothingEnabled = false;
    if (y1 > y0) ctx.drawImage(c, 0, y0, c.width, y1 - y0, X, Y + y0, c.width, y1 - y0);
    ctx.imageSmoothingEnabled = sm;
  }

  window.FXDraw = { nova: nova, novaRing: novaRing, colors: HF };
})();
