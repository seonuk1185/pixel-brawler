// 타격 효과: 화면 흔들림, 베기 궤적, 불똥, 데미지 숫자, 하얀 번쩍
(function () {
  var list = [];          // 떠 있는 효과들
  var shake = { t: 0, dur: 1, mag: 0, x: 0, y: 0 };
  // 캐릭터 크기(config actorScale): 불똥 튀는 거리·코드로 그린 번쩍 크기·데미지 숫자 떠오르는 높이에 곱한다(숫자 글자 모양·크기는 config damageText)
  function AS() { return (window.CFG && window.CFG.actorScale) || 1; }

  // ----- 데미지 숫자 도트 글꼴 (2026-11-03 새로 그림: 모서리를 둥글게 깎은 숫자) -----
  // small = 4x6, big = 5x7, large = 6x8 두꺼운 획, mid = 6x10 두꺼운 획(보통 타), huge = 6x12(마무리 타). 글자 사이 1도트
  // 모양 바꾸기: '#' = 칠함, '.' = 빈칸. 크기·색·테두리는 config.js 의 damageText
  var FONTS = {
    small: { h: 6, g: {
      '0': ['.##.', '#..#', '#..#', '#..#', '#..#', '.##.'],
      '1': ['..#.', '.##.', '..#.', '..#.', '..#.', '.###'],
      '2': ['.##.', '#..#', '...#', '..#.', '.#..', '####'],
      '3': ['.##.', '#..#', '..#.', '...#', '#..#', '.##.'],
      '4': ['#..#', '#..#', '#..#', '.###', '...#', '...#'],
      '5': ['####', '#...', '###.', '...#', '#..#', '.##.'],
      '6': ['.##.', '#...', '###.', '#..#', '#..#', '.##.'],
      '7': ['####', '...#', '..#.', '..#.', '.#..', '.#..'],
      '8': ['.##.', '#..#', '.##.', '#..#', '#..#', '.##.'],
      '9': ['.##.', '#..#', '#..#', '.###', '...#', '.##.'],
      '!': ['#', '#', '#', '#', '.', '#'] } },
    big: { h: 7, g: {
      '0': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
      '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
      '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
      '3': ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'],
      '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
      '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
      '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
      '7': ['#####', '....#', '...#.', '..#..', '..#..', '.#...', '.#...'],
      '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
      '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
      '!': ['#', '#', '#', '#', '#', '.', '#'] } },
    // large = 6x8 두꺼운 획(2도트) 숫자: 마무리 타 「22!」 전용
    large: { h: 8, g: {
      '0': ['.####.', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
      '1': ['..##..', '.###..', '..##..', '..##..', '..##..', '..##..', '..##..', '.####.'],
      '2': ['.####.', '##..##', '....##', '...##.', '..##..', '.##...', '##....', '######'],
      '3': ['.####.', '##..##', '....##', '..###.', '....##', '....##', '##..##', '.####.'],
      '4': ['...##.', '..###.', '.####.', '##.##.', '######', '...##.', '...##.', '...##.'],
      '5': ['######', '##....', '#####.', '....##', '....##', '....##', '##..##', '.####.'],
      '6': ['..###.', '.##...', '##....', '#####.', '##..##', '##..##', '##..##', '.####.'],
      '7': ['######', '....##', '...##.', '...##.', '..##..', '..##..', '.##...', '.##...'],
      '8': ['.####.', '##..##', '##..##', '.####.', '##..##', '##..##', '##..##', '.####.'],
      '9': ['.####.', '##..##', '##..##', '##..##', '.#####', '....##', '...##.', '.###..'],
      '!': ['##', '##', '##', '##', '##', '..', '##', '##'] } },
    // mid = 6x10 두꺼운 획(2도트) 둥근 숫자: 보통 타 (폰에서도 잘 읽히게, 2026-11-03)
    mid: { h: 10, g: {
      '0': ['.####.', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
      '1': ['..##..', '.###..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '.####.'],
      '2': ['.####.', '##..##', '....##', '....##', '...##.', '..##..', '.##...', '##....', '##....', '######'],
      '3': ['.####.', '##..##', '....##', '....##', '..###.', '....##', '....##', '....##', '##..##', '.####.'],
      '4': ['...##.', '..###.', '.####.', '##.##.', '##.##.', '######', '...##.', '...##.', '...##.', '...##.'],
      '5': ['######', '##....', '##....', '#####.', '....##', '....##', '....##', '....##', '##..##', '.####.'],
      '6': ['..###.', '.##...', '##....', '##....', '#####.', '##..##', '##..##', '##..##', '##..##', '.####.'],
      '7': ['######', '....##', '....##', '...##.', '...##.', '..##..', '..##..', '.##...', '.##...', '.##...'],
      '8': ['.####.', '##..##', '##..##', '##..##', '.####.', '##..##', '##..##', '##..##', '##..##', '.####.'],
      '9': ['.####.', '##..##', '##..##', '##..##', '##..##', '.#####', '....##', '....##', '...##.', '.###..'],
      '!': ['##', '##', '##', '##', '##', '##', '..', '..', '##', '##'] } }
  };
  // huge = mid 를 세로로 늘린 6x12 (윗부분·아랫부분의 곧은 줄을 한 줄씩 더): 마무리 타
  FONTS.huge = { h: 12, g: {} };
  Object.keys(FONTS.mid.g).forEach(function (c) {
    var g = FONTS.mid.g[c], o = [];
    g.forEach(function (row, i) { o.push(row); if (i === 2 || i === 7) o.push(row); });
    FONTS.huge.g[c] = o;
  });
  // giant = mid 를 가로·세로로 늘린 7x14 (가운데에 한 칸을 끼우고, 곧은 줄을 더): 기술 숫자 (2026-11-03)
  //   끼우는 칸 = 양옆(가운데 두 칸)이 둘 다 칠해져 있을 때만 칠함 → 「0」 속은 넓어지고 「1」 기둥은 너무 뚱뚱해지지 않음
  //   굵게(bold)와 함께 쓰면 옆 획이 3도트 → 마무리 숫자(huge)보다 확실히 크고 묵직하게 보인다
  FONTS.giant = { h: 14, g: {} };
  Object.keys(FONTS.mid.g).forEach(function (c) {
    var g = FONTS.mid.g[c], o = [];
    g.forEach(function (row, i) {
      var r = row.length === 6 ? row.slice(0, 3) + (row[2] === '#' && row[3] === '#' ? '#' : '.') + row.slice(3) : row;
      o.push(r); if (i === 1 || i === 3 || i === 6 || i === 8) o.push(r);
    });
    FONTS.giant.g[c] = o;
  });
  // 글자 → 작은 그림(캔버스)으로 한 번 만들어 두고 재사용
  //   st = { font, scale, bold, top, bottom(아래 1/3 색 → 살짝 입체), outline(1도트 테두리, 대각선은 안 칠해 둥글게), shadow(1도트 아래 그림자) }
  var textCache = {}, textCacheN = 0;
  function textSprite(str, st) {
    var key = str + '|' + JSON.stringify(st);
    if (textCache[key]) return textCache[key];
    if (textCacheN > 300) { textCache = {}; textCacheN = 0; }
    var F = FONTS[st.font] || FONTS.small, bold = st.bold ? 1 : 0;
    // 1) 칠할 점(글자 1배 기준)
    var pts = [], W = 0;
    for (var i = 0; i < str.length; i++) {
      var g = F.g[str[i]]; if (!g) continue;
      var gw = g[0].length;
      for (var r = 0; r < F.h; r++) for (var c = 0; c < gw; c++) if (g[r][c] === '#') {
        pts.push([W + c, r]); if (bold) pts.push([W + c + 1, r]);
      }
      W += gw + bold + 1;
    }
    W = Math.max(1, W - 1);
    var pad = 2, cw = W + pad * 2, ch = F.h + pad * 2 + 1;
    var m = new Uint8Array(cw * ch);
    pts.forEach(function (p) { m[(p[1] + pad) * cw + p[0] + pad] = 1; });
    // 2) 테두리 = 위아래좌우 한 칸만(대각선은 비움 → 모서리가 둥글게 보임)
    var o = new Uint8Array(cw * ch);
    for (var y = 0; y < ch; y++) for (var x = 0; x < cw; x++) {
      if (m[y * cw + x]) continue;
      if ((x > 0 && m[y * cw + x - 1]) || (x < cw - 1 && m[y * cw + x + 1]) ||
          (y > 0 && m[(y - 1) * cw + x]) || (y < ch - 1 && m[(y + 1) * cw + x])) o[y * cw + x] = 1;
    }
    var k = Math.max(1, st.scale | 0);
    var cv = document.createElement('canvas'); cv.width = cw * k; cv.height = ch * k;
    var g2 = cv.getContext('2d');
    function put(mask, col, dy) {
      if (!col) return;
      g2.fillStyle = col;
      for (var y = 0; y < ch; y++) for (var x = 0; x < cw; x++) if (mask[y * cw + x]) g2.fillRect(x * k, (y + dy) * k, k, k);
    }
    // 3) 그림자(테두리+글자를 1도트 아래로) → 테두리 → 글자(위 2/3 = top 색, 아래 1/3 = bottom 색)
    if (st.shadow) { var u = new Uint8Array(cw * ch); for (var q = 0; q < u.length; q++) u[q] = m[q] | o[q]; put(u, st.shadow, 1); }
    put(o, st.outline, 0);
    var split = pad + Math.ceil(F.h * 2 / 3), mt = new Uint8Array(cw * ch), mb = new Uint8Array(cw * ch);
    for (var q2 = 0; q2 < m.length; q2++) if (m[q2]) { if (((q2 / cw) | 0) < split) mt[q2] = 1; else mb[q2] = 1; }
    put(mt, st.top, 0); put(mb, st.bottom || st.top, 0);
    var res = { img: cv, w: cw * k, pad: pad * k };
    textCache[key] = res; textCacheN++;
    return res;
  }
  // 글자 가운데 = x, 글자 윗줄 = y. 매끈한 화면(renderScale > 1)이면 둥근 글꼴(Fredoka)로 그린 부드러운 숫자
  function drawPixelText(ctx, str, x, y, st) {
    var R = (window.CFG && CFG.view.renderScale) || 1;
    // 글자가 섞인 줄(「+13 XP」「LEVEL UP!」, 2026-11-05 성장)은 도트 글꼴에 글자가 없어서 도트 화면(?rs=1)에서도 부드러운 글꼴로
    if (R > 1 || /[^0-9!]/.test(str)) { drawSmoothText(ctx, str, x, y, st, R); return; }
    var t = textSprite(str, st);
    ctx.drawImage(t.img, Math.round(x - t.w / 2), Math.round(y) - t.pad);
  }

  // ----- 매끈한 데미지 숫자 (2026-11-03 HD): 도트 글꼴과 같은 높이·색·테두리·그림자, 둥근 굵은 글꼴 -----
  //   글꼴 = game/fonts/dmg.woff2 (Fredoka Bold, 숫자와 ! 만 남긴 2KB, OFL). 아직 안 불러왔으면 굵은 기본 글꼴
  //   높이(도트) = 도트 글꼴 높이(mid 10, huge 12, giant 14 …), 테두리 1도트 바깥, 아래 1/3 은 bottom 색(살짝 입체)
  var FONT_H = { small: 6, big: 7, large: 8, mid: 10, huge: 12, giant: 14 };
  var fontReady = false, smoothCache = {}, smoothN = 0;
  if (document.fonts && document.fonts.load) {
    document.fonts.load('700 20px DmgFont', '0123456789!').then(function (l) { if (l && l.length) { fontReady = true; smoothCache = {}; smoothN = 0; } }).catch(function () {});
  }
  function smoothSprite(str, st, R) {
    var key = str + '|' + JSON.stringify(st) + '|' + R + '|' + fontReady;
    if (smoothCache[key]) return smoothCache[key];
    if (smoothN > 300) { smoothCache = {}; smoothN = 0; }
    var h = (FONT_H[st.font] || 8) * Math.max(1, st.scale || 1);   // 숫자 높이(도트)
    var size = h / 0.72 * (st.bold ? 1.08 : 1);                   // 글꼴 크기(도트): 숫자 높이 ≈ 0.72em
    var ol = st.outline ? 1.15 : 0, sh = st.shadow ? 1 : 0, pad = 3 + ol;
    // DmgFont 에 없는 글자(+ · 영어)는 뒤의 굵은 기본 글꼴로 채움
    var fam = (fontReady ? 'DmgFont, ' : '') + '"Arial Black", "Arial Rounded MT Bold", sans-serif';
    var c = document.createElement('canvas'), g = c.getContext('2d');
    var font = '700 ' + (size * R).toFixed(2) + 'px ' + fam;
    g.font = font;
    var tw = g.measureText(str).width / R + (st.bold ? size * 0.04 : 0);
    var w = tw + pad * 2, hh = h + pad * 2 + sh;
    c.width = Math.ceil(w * R); c.height = Math.ceil(hh * R);
    g = c.getContext('2d'); g.scale(R, R);
    g.font = '700 ' + size.toFixed(2) + 'px ' + fam;
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    var bx = w / 2, by = pad + h;   // 글자 바닥(숫자 아래 끝)
    g.lineJoin = 'round'; g.miterLimit = 2;
    if (st.shadow) { g.fillStyle = st.shadow; g.strokeStyle = st.shadow; g.lineWidth = ol * 2; g.strokeText(str, bx, by + sh); g.fillText(str, bx, by + sh); }
    if (st.outline) { g.strokeStyle = st.outline; g.lineWidth = ol * 2 + (st.bold ? 0.4 : 0); g.strokeText(str, bx, by); }
    var gr = g.createLinearGradient(0, pad, 0, pad + h);
    gr.addColorStop(0, st.top); gr.addColorStop(0.58, st.top);
    gr.addColorStop(0.72, st.bottom || st.top); gr.addColorStop(1, st.bottom || st.top);
    g.fillStyle = gr;
    if (st.bold) { g.strokeStyle = gr; g.lineWidth = size * 0.05; g.strokeText(str, bx, by); }
    g.fillText(str, bx, by);
    var res = { img: c, w: w, h: hh, pad: pad };
    smoothCache[key] = res; smoothN++;
    return res;
  }
  function drawSmoothText(ctx, str, x, y, st, R) {
    var t = smoothSprite(str, st, R);
    ctx.drawImage(t.img, x - t.w / 2, y - t.pad, t.w, t.h);
  }

  // ----- 하얀 실루엣 (맞은 순간 번쩍) -----
  var scratch = document.createElement('canvas');
  var sctx = scratch.getContext('2d');
  function whiteSilhouette(img, sx, sy, sw, sh, alpha) {
    if (scratch.width < sw || scratch.height < sh) { scratch.width = Math.max(scratch.width, sw); scratch.height = Math.max(scratch.height, sh); }
    sctx.imageSmoothingEnabled = false;
    sctx.clearRect(0, 0, scratch.width, scratch.height);
    sctx.globalCompositeOperation = 'source-over';
    sctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    sctx.globalCompositeOperation = 'source-atop';
    sctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
    sctx.fillRect(0, 0, sw, sh);
    sctx.globalCompositeOperation = 'source-over';
    return scratch;
  }

  // ----- 데미지 숫자 쌓기 (2026-11-03) -----
  //   groups = 숫자 묶음 { key(대상), x, y(처음 높이), dy(비켜 선 양), t(나이), n(줄 수), top(다음 줄 높이), rise, riseMs, open }
  //   줄(list 의 'dmg') = { g, off(묶음 바닥에서 위로), jx(좌우 어긋남), w, h(글자 상자 도트) }
  var groups = [], dmgUid = 0;
  // 사냥 손맛 숫자(2026-11-07, config hunt.dmgNum, main.js 가 판마다 FX.setHunt 로 넣음 · 끈 판 = null):
  //   데미지가 클수록 숫자 크게(zoom) · 새 숫자 살짝 흩어짐(spread) · 모든 숫자 튀어나옴(pop, 치명타·마무리는 critPop + 뒤 주황 번쩍) · 화면 숫자 최대 max
  var HN = null;
  function numZoom(n) {
    if (!HN || !HN.size || typeof n !== 'number') return 1;
    var Z = HN.size, u = (n - Z.ref[0]) / Math.max(1, Z.ref[1] - Z.ref[0]);
    return Z.min + (Z.max - Z.min) * Math.max(0, Math.min(1, u));
  }
  function stackCfg() {
    var D = (window.CFG && CFG.damageText) || {};
    return D.stack || { windowMs: 480, cap: 5, gap: 1, jitter: [0] };
  }
  // 줄의 글자 모양(config damageText): 모양 이름 → 마무리 → 보통
  function dmgStyle(f) {
    var D = (window.CFG && window.CFG.damageText) || {};
    return (f.style && D[f.style]) || (f.crit ? D.crit : D.normal) || { font: 'small', top: '#ffffff', outline: '#2a1020' };
  }
  // 글자 상자 크기(도트): 튀어나올 때(pop, 굵게) 기준으로 넉넉하게
  function lineSize(f) {
    var st = dmgStyle(f), h = (FONT_H[st.font] || 8) * Math.max(1, st.scale || 1) * (st.zoom || 1) * (f.zoom || 1);   // zoom = 각성 숫자 크게(2026-11-06 밤) · f.zoom = 사냥 손맛 데미지 크기
    var cw = h * 0.62 * (st.bold || (st.pop && st.pop.bold) ? 1.12 : 1);
    return { w: f.str.length * cw + 2.5, h: h + 1.6 };
  }
  function easeRise(u) { return 1 - Math.pow(1 - Math.min(1, u), 3); }
  // 줄의 글자 바닥 가운데(도트), tau ms 뒤
  function linePos(f, tau) {
    var g = f.g, D = (window.CFG && CFG.damageText) || {};
    var lift = (D.lift != null ? D.lift : 20) * AS();
    return { x: g.x + (f.jx || 0), y: g.y + g.dy - lift - easeRise((g.t + tau) / g.riseMs) * g.rise - f.off };
  }
  // 새 줄이 지금 떠 있는 다른 묶음의 줄과 겹치나(앞으로 0.45초 동안). 겹친 양(도트²)의 합, 안 겹치면 0
  function collides(line) {
    var tot = 0, taus = [0, 120, 260, 450];
    list.forEach(function (f) {
      if (f.type !== 'dmg' || f === line || f.g === line.g) return;
      for (var i = 0; i < taus.length; i++) {
        var tau = taus[i];
        if (f.t + tau > f.life * 0.85 || tau > line.life * 0.85) continue;   // 그때 이미 거의 사라짐
        var a = linePos(line, tau), b = linePos(f, tau);
        var ox = Math.min(a.x + line.w / 2, b.x + f.w / 2) - Math.max(a.x - line.w / 2, b.x - f.w / 2);
        var oy = Math.min(a.y, b.y) - Math.max(a.y - line.h, b.y - f.h);
        if (ox > -3 && oy > -1) tot += (ox + 3) * (oy + 1);   // 옆으로는 3도트 띄움(「17!」「14!」가 붙어 「1714!」로 안 보이게)
      }
    });
    return tot;
  }

  var FX = {
    list: list,
    drawPixelText: drawPixelText,
    whiteSilhouette: whiteSilhouette,

    shake: function (mag, ms) {
      if (mag >= shake.mag * (shake.t / shake.dur || 0)) { shake.mag = mag; shake.t = ms; shake.dur = ms; }
    },
    // 흔들림은 히트스톱 중에도 진짜 시간으로 돈다
    updateShake: function (dtMs) {
      if (shake.t > 0) {
        shake.t -= dtMs;
        var k = Math.max(0, shake.t / shake.dur), m = shake.mag * k;
        shake.x = Math.round((Math.random() * 2 - 1) * m);
        shake.y = Math.round((Math.random() * 2 - 1) * m * 0.6);
      } else { shake.x = shake.y = 0; }
      return shake;
    },

    // 베기 궤적: 중심(cx,cy), 바라보는 방향 dir(1/-1)
    // look = { rot(도), sx, sy, flipY } 타마다 다른 방향으로 그림을 돌리고 뒤집기
    slash: function (cx, cy, dir, arc, color, ms, sprites, look) {
      // 맞는 순간 화면이 멈추므로, 궤적은 이미 거의 그어진 상태로 시작한다
      list.push({ type: 'slash', x: cx, y: cy, dir: dir, arc: arc, color: color, t: ms * 0.28, life: ms, sprites: sprites, look: look || null });
    },
    // 찌르기: 앞쪽으로 뻗는 짧은 직선 (cx,cy = 시작점, len = 길이)
    thrust: function (cx, cy, dir, len, color, ms) {
      list.push({ type: 'thrust', x: cx, y: cy, dir: dir, len: len, color: color, t: ms * 0.2, life: ms });
    },
    // scale = 불똥 그림 크기 배율(맨손은 작게, 없으면 1)
    impact: function (x, y, dir, color, count, big, sprites, scale) {
      var parts = [];
      for (var i = 0; i < count; i++) {
        var a = (Math.random() * 1.6 - 0.8) + (dir > 0 ? 0 : Math.PI) + (Math.random() < 0.3 ? Math.PI : 0) * 0.6;
        var sp = (60 + Math.random() * (big ? 160 : 110)) * AS();
        parts.push({ x: 0, y: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40 * AS(), s: Math.random() < 0.35 ? 2 : 1 });
      }
      var life = big ? 260 : 200, spr = sprites && sprites.length ? sprites : null;
      // 그림 효과는 2번째 장(가장 크게 터진 장)부터 → 멈춘 순간에 크게 보임
      list.push({ type: 'impact', x: x, y: y, dir: dir, color: color, t: spr ? life / spr.length : 0, life: life, parts: parts, big: big, sprites: spr,
        look: scale && scale !== 1 ? { sx: scale, sy: scale } : null });
    },
    // color = 숫자 색(없으면 흰색/치명타 노랑). 플레이어가 맞으면 빨강
    // style = CFG.damageText 의 모양 이름(기술 숫자 skill_knight 등). 없으면 보통/마무리
    // key = 맞은 대상(적 id / 'dummy' / 'player'). 같은 대상이 짧은 시간(stack.windowMs)에 또 맞으면 숫자를 한 줄 위에 쌓는다
    //   (메이플처럼 줄 세움, 한 묶음은 같이 떠오름). 다른 묶음의 숫자와 겹치면 위·옆으로 비켜 선다 (2026-11-03)
    // merge = 빠른 연타(달리며 공격의 밀고 가는 타): 같은 대상의 같은 모양 숫자가 아직 떠 있으면 새 줄 대신 그 숫자에 더해서
    //   「합계」로 다시 튀어나오게 함(4 → 8 → 12 …) → 작은 숫자가 줄줄이 쌓이지 않음
    damage: function (x, y, n, crit, J, color, style, key, merge) {
      var SC = stackCfg();
      key = key || ('k' + (++dmgUid));
      if (merge) {
        for (var mi = list.length - 1; mi >= 0; mi--) {
          var mf = list[mi];
          if (mf.type !== 'dmg' || !mf.merge || mf.g.key !== key || mf.style !== (style || null) || mf.t > (SC.windowMs || 480)) continue;
          mf.val += n; mf.n = String(mf.val); mf.t = 0;
          var ms = lineSize({ str: mf.n, crit: false, style: mf.style }); mf.w = ms.w;
          mf.g.x = x + mf.g.dx;
          return;
        }
      }
      var now = { str: String(n) + (crit ? '!' : ''), crit: crit, color: color || null, style: style || null, zoom: color ? 1 : numZoom(n) };
      var life = J.dmgMs * (style && style !== 'push' ? 1.25 : 1);
      var sz = lineSize(now);
      // 같은 대상의 열린 묶음(최근 + 줄 수가 cap 미만)
      var g = null;
      for (var i = groups.length - 1; i >= 0; i--) {
        var q = groups[i];
        if (q.key !== key || !q.open) continue;
        if (q.t <= SC.windowMs && q.n < SC.cap) { g = q; break; }
        q.open = false;
        // 꽉 차서 닫힌 묶음은 곧 사라지게(새 묶음이 그 자리에 올라옴)
        if (q.n >= SC.cap) list.forEach(function (f) { if (f.type === 'dmg' && f.g === q) f.t = Math.max(f.t, f.life * 0.62); });
      }
      var line = { type: 'dmg', n: now.str, crit: crit, t: 0, life: life, color: now.color, style: now.style, w: sz.w, h: sz.h,
                   merge: !!merge, val: +n, zoom: now.zoom };
      var sp = HN && !color ? (HN.spread || 0) : 0;   // 사냥 손맛: 살짝 흩어짐(플레이어가 맞은 숫자는 그대로)
      var jit = SC.jitter || [0];
      if (g) {
        // 쌓기: 묶음 맨 위에 한 줄. 다른 묶음 숫자와 겹치면 조금씩 더 위로
        line.g = g; line.jx = jit[g.n % jit.length] + (Math.random() * 2 - 1) * sp * 0.6; line.off = g.top;
        g.x = x + g.dx;   // 묶음은 대상을 따라감(밀려가는 적 위에 계속)
        var off0 = line.off, jx0 = line.jx, bestC = null;
        search: for (var k = 0; k <= 10; k++) for (var s2 = 0; s2 < 3; s2++) {
          line.off = off0 + k * 4; line.jx = jx0 + [0, 8, -8][s2];
          var cc = collides(line);
          if (!cc) { bestC = null; break search; }
          if (!bestC || cc < bestC.c) bestC = { c: cc, off: line.off, jx: line.jx };
        }
        if (bestC) { line.off = bestC.off; line.jx = bestC.jx; }
      } else {
        g = { key: key, x: x, y: y, dx: 0, dy: 0, t: 0, n: 0, top: 0, open: true,
              rise: J.dmgRise * AS() * (style && style !== 'push' ? 1.2 : 1), riseMs: life / 1.6 };
        groups.push(g);
        line.g = g; line.jx = 0; line.off = 0;
        if (sp) { x += (Math.random() * 2 - 1) * sp; y -= Math.random() * sp * 0.6; g.y = y; }
        // 새 묶음 자리: 그대로 → 위로 조금씩 → 옆으로 비켜 보기. 다 겹치면 처음 자리(가장 덜 겹치는 곳)
        var tries = [[0, 0], [0, -7], [0, -14], [9, -4], [-9, -4], [0, -21], [12, -12], [-12, -12], [0, -28], [14, -20], [-14, -20], [0, -35], [0, -42]], best = null;
        for (var a = 0; a < tries.length; a++) {
          g.dx = tries[a][0]; g.x = x + g.dx; g.dy = tries[a][1];
          var c = collides(line);
          if (!c) { best = null; break; }
          if (!best || c < best.c) best = { c: c, a: a };
        }
        if (best) { g.dx = tries[best.a][0]; g.x = x + g.dx; g.dy = tries[best.a][1]; }
      }
      g.top = line.off + sz.h + (SC.gap != null ? SC.gap : 1);
      g.n++;
      list.push(line);
      // 사냥 손맛: 화면 숫자가 max 개를 넘으면 가장 오래된 숫자부터 지움(폰 성능 · 너무 빽빽하지 않게)
      if (HN && HN.max) {
        var cnt = 0, li;
        for (li = list.length - 1; li >= 0; li--) if (list[li].type === 'dmg') cnt++;
        for (li = 0; li < list.length && cnt > HN.max; li++) if (list[li].type === 'dmg') { list.splice(li, 1); li--; cnt--; }
      }
    },
    setHunt: function (h) { HN = h || null; },
    groups: groups,
    // 그림 묶음을 한 색으로 물들인 복사본(기술 효과 그림이 아직 없을 때 기존 그림을 불·번개 색으로). k = 물들이는 세기(0~1)
    //   같은 묶음·색이면 한 번만 만든다
    tinted: function (frames, color, k) {
      if (!frames || !frames.length || !color) return frames;
      frames._tint = frames._tint || {};
      var key = color + '|' + (k == null ? 0.6 : k);
      if (frames._tint[key]) return frames._tint[key];
      var out = frames.map(function (im) {
        if (!im) return im;
        var c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
        var g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        g.drawImage(im, 0, 0);
        g.globalCompositeOperation = 'source-atop'; g.globalAlpha = k == null ? 0.6 : k;
        g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
        return Assets.copyMeta(im, c);
      });
      frames._tint[key] = out;
      return out;
    },
    // 그림 여러 장을 한 번 재생하는 효과(오크 돌진 먼지). pivot = 그림 속 기준점(바닥 가운데), flip = 좌우 뒤집기
    // under = true 면 캐릭터보다 뒤(바닥)에 그림, scale = 크기 배율(없으면 1, 법사 마법 터짐·반짝임)
    // opt = { alpha, add(true = 빛 더하기) }
    sprite: function (x, y, frames, fps, pivot, flip, under, scale, opt) {
      list.push({ type: 'sprite', x: x, y: y, frames: frames, step: 1000 / fps, pivot: pivot, flip: !!flip, under: !!under, t: 0, life: frames.length * 1000 / fps, scale: scale || 1,
                  alpha: opt && opt.alpha != null ? opt.alpha : null, add: !!(opt && opt.add) });
    },


    update: function (dtMs) {
      for (var i = list.length - 1; i >= 0; i--) {
        var f = list[i]; f.t += dtMs;
        if (f.type === 'impact') {
          var dt = dtMs / 1000;
          var grav = 420 * AS();
          f.parts.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += grav * dt; p.vx *= 0.92; });
        }
        if (f.t >= f.life) list.splice(i, 1);
      }
      for (var j = groups.length - 1; j >= 0; j--) { groups[j].t += dtMs; if (groups[j].t > 4000) groups.splice(j, 1); }
    },

    // under = true: 바닥 효과만(캐릭터 뒤), false/없음: 나머지(캐릭터 앞)
    // 베기 궤적 중 look.top 인 것(기사 여자 3타 X자)은 불똥보다 위에 보이도록 맨 마지막에 그린다
    draw: function (ctx, camX, under) {
      list.forEach(function (f) { drawOne(ctx, camX, under, f, false); });
      if (!under) list.forEach(function (f) { drawOne(ctx, camX, under, f, true); });
    }
  };

  function drawOne(ctx, camX, under, f, topPass) {
    if (!!f.under !== !!under) return;
    if (!!(f.look && f.look.top) !== topPass) return;
    var k = f.t / f.life, x = snapPx(f.x - camX), y = snapPx(f.y);
    if (f.type === 'sprite') {
      var im = f.frames[Math.min(f.frames.length - 1, Math.floor(f.t / f.step))];
      if (!im) return;
      ctx.save(); ctx.translate(x, y); ctx.scale(f.flip ? -f.scale : f.scale, f.scale);
      if (f.alpha != null) ctx.globalAlpha = f.alpha;
      if (f.add) ctx.globalCompositeOperation = 'lighter';
      Assets.blit(ctx, im, f.pivot.x, f.pivot.y); ctx.restore();
    }
    else if (f.type === 'slash') drawSlash(ctx, f, x, y, k);
    else if (f.type === 'thrust') drawThrust(ctx, f, x, y, k);
    else if (f.type === 'impact') drawImpact(ctx, f, x, y, k);
    else if (f.type === 'dmg') {
      // 처음엔 pop 모양(한 단계 크게/밝게)으로 튀어나왔다가 제 모양으로 돌아오며 떠오름 → 끝에서 서서히 사라짐
      var D = (window.CFG && window.CFG.damageText) || {};
      var st = dmgStyle(f);
      if ((k < (D.popK || 0.12) && st.pop) || f.color) {
        var st2 = {}, kk;
        for (kk in st) if (kk !== 'pop') st2[kk] = st[kk];
        if (k < (D.popK || 0.12) && st.pop) for (kk in st.pop) st2[kk] = st.pop[kk];
        if (f.color) { st2.top = f.color; st2.bottom = D.hurtBottom || f.color; }   // 플레이어가 맞은 숫자 = 빨강
        st = st2;
      }
      // 위치 = 묶음(같은 대상) 자리 + 그 안의 줄 높이(off). 묶음째 같이 떠오름
      var lp = linePos(f, 0), fh = (FONT_H[st.font] || 8) * Math.max(1, st.scale || 1);
      ctx.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
      // 마무리·치명타 숫자(crit): 처음에 numPop 배 크게 튀어나왔다가 줄어듦(2026-11-06 밤, config juice.impact.numPop)
      var IMP = window.CFG && CFG.juice.impact, NP = (IMP && IMP.numPop) || 1, pk = (D.popK || 0.12) * 1.8, Z = (st.zoom || 1) * (f.zoom || 1);
      // 사냥 손맛: 모든 숫자가 튀어나옴(pop), 치명타·마무리는 더 크게(critPop) + 뒤에 주황 번쩍
      if (HN && !f.color) {
        NP = f.crit ? HN.critPop || NP : HN.pop || 1;
        if (NP > 1 && k < pk && !f.crit) Z *= 1 + (NP - 1) * (1 - k / pk);
        if (f.crit && HN.critGlow && f.t < (HN.critGlowMs || 150)) {
          var gu = f.t / (HN.critGlowMs || 150), gx = snapPx(lp.x - camX), gy = snapPx(lp.y - fh / 2), gr = (HN.critGlowR || 20) * AS() / 0.55 * (0.7 + gu * 0.6);
          var gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
          gg.addColorStop(0, 'rgba(255,240,200,' + (HN.critGlow * (1 - gu)).toFixed(3) + ')'); gg.addColorStop(0.45, 'rgba(255,140,30,' + (HN.critGlow * 0.7 * (1 - gu)).toFixed(3) + ')'); gg.addColorStop(1, 'rgba(255,90,10,0)');
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gg; ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2); ctx.restore();
        }
      }
      // 각성 숫자(Z = zoom, 2026-11-06 밤): 글자 가운데를 기준으로 zoom 배
      if ((f.crit && NP > 1 && k < pk) || Z !== 1) {
        var zs = Z * (f.crit && NP > 1 && k < pk ? 1 + (NP - 1) * (1 - k / pk) : 1), zx = snapPx(lp.x - camX) + (Z !== 1 ? 0 : (f.w || 0) / 2), zy = snapPx(lp.y - fh / 2);
        ctx.save(); ctx.translate(zx, zy); ctx.scale(zs, zs); ctx.translate(-zx, -zy);
        drawPixelText(ctx, f.n, snapPx(lp.x - camX), snapPx(lp.y - fh), st);
        ctx.restore();
      } else drawPixelText(ctx, f.n, snapPx(lp.x - camX), snapPx(lp.y - fh), st);
      ctx.globalAlpha = 1;
    }
  }

  function drawSprites(ctx, f, x, y, k) {
    var L = f.look || {};
    var fi = Math.min(f.sprites.length - 1, Math.floor(k * f.sprites.length));
    // linger(오래 남는 궤적): 꽉 찬 초승달(2번째 장)을 붙잡고 있다가 끝에서만 흩어지는 장으로, 60%부터 서서히 흐려짐
    if (L.linger && f.sprites.length >= 4) fi = k < 0.78 ? 1 : k < 0.9 ? 2 : 3;
    var fr = f.sprites[fi];
    if (!fr) return false;
    ctx.save();
    ctx.translate(x, y);
    if (L.alpha != null) ctx.globalAlpha = L.alpha * (k > 0.6 ? Math.max(0, 1 - (k - 0.6) / 0.4) : 1);   // 흐리게(발차기 바람)
    else if (L.linger) ctx.globalAlpha = k > 0.6 ? Math.max(0.15, 1 - (k - 0.6) / 0.4 * 0.85) : 1;
    ctx.scale(f.dir < 0 ? -1 : 1, 1);                       // 왼쪽 보면 좌우 뒤집기
    if (L.rot) ctx.rotate(L.rot * Math.PI / 180);           // 휘두르는 방향에 맞게 돌리기
    ctx.scale(L.sx || 1, ((L.flipY || (f.arc && f.arc.flipY)) ? -1 : 1) * (L.sy || 1));
    var c = Assets.centerOf(fr);
    Assets.blit(ctx, fr, c.x, c.y);
    ctx.restore();
    return true;
  }

  // 초승달 모양 궤적을 도트로 찍는다
  function drawSlash(ctx, f, x, y, k) {
    if (f.sprites && f.sprites.length && drawSprites(ctx, f, x, y, k)) return;
    var a0 = f.arc.from * Math.PI / 180, a1 = f.arc.to * Math.PI / 180;
    var grow = Math.min(1, k * 3.2);          // 빠르게 그어지고
    var fade = k < 0.35 ? 1 : 1 - (k - 0.35) / 0.65; // 천천히 사라짐
    var tail = Math.max(0, (k - 0.3) / 0.7);  // 꼬리부터 지워짐
    var N = Math.ceil(Math.abs(a1 - a0) * f.arc.r);   // 1도트 간격으로 찍어야 끊김 없음
    for (var i = 0; i <= N; i++) {
      var s = i / N;
      if (s > grow || s < tail) continue;
      var a = a0 + (a1 - a0) * s;
      var thick = f.arc.w * Math.sin(Math.PI * Math.min(1, s * 1.15)) * fade;
      if (thick < 0.6) continue;
      var r = f.arc.r;
      var px = Math.cos(a) * r * f.dir, py = Math.sin(a) * r;
      // 바깥쪽 색, 안쪽 흰 심
      var nx = Math.cos(a) * f.dir, ny = Math.sin(a);
      for (var t = 0; t < thick; t += 1) {
        var inner = t < thick * 0.45;
        ctx.fillStyle = inner ? '#ffffff' : f.color;
        ctx.globalAlpha = inner ? 1 : 0.85 * fade + 0.15;
        ctx.fillRect(Math.round(x + px - nx * t), Math.round(y + py - ny * t), 2, 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  // 찌르기 궤적: 빠르게 앞으로 뻗고 뒤쪽부터 사라지는 가는 직선(흰 심 + 무기 색 테두리)
  function drawThrust(ctx, f, x, y, k) {
    var grow = Math.min(1, k * 4), tail = Math.max(0, (k - 0.35) / 0.65);
    var a = Math.round(f.len * tail), b = Math.round(f.len * grow);
    for (var i = a; i <= b; i++) {
      var s = i / f.len, th = Math.max(1, Math.round(3 * Math.sin(Math.PI * Math.min(1, s * 1.1 + 0.05))));
      var px = Math.round(x + i * f.dir);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = f.color; ctx.fillRect(px, y - th, 1, th * 2 + 1);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(px, y - (th > 1 ? 1 : 0), 1, th > 1 ? 3 : 1);
    }
    // 끝에 작은 반짝임
    if (k < 0.5) { var tx = Math.round(x + b * f.dir); ctx.fillStyle = '#ffffff'; ctx.fillRect(tx - 1, y - 3, 3, 7); ctx.fillRect(tx - 3, y - 1, 7, 3); }
  }

  function drawImpact(ctx, f, x, y, k) {
    if (f.sprites && f.sprites.length && drawSprites(ctx, f, x, y, k)) return;
    // 가운데 번쩍(처음 몇 장)
    if (k < 0.3) {
      // 별 모양: 어두운 테두리 → 색 → 흰 심 (하얗게 번쩍인 대상 위에서도 보이게)
      var r = Math.round((f.big ? 16 : 12) * AS() * (1 - k / 0.3 * 0.4));
      var d = Math.round(r * 0.55);
      function star(col, grow, w) {
        ctx.fillStyle = col;
        ctx.fillRect(x - r - grow, y - w - grow, (r + grow) * 2 + 1, (w + grow) * 2 + 1);
        ctx.fillRect(x - w - grow, y - r - grow, (w + grow) * 2 + 1, (r + grow) * 2 + 1);
        for (var i = -d; i <= d; i++) {
          ctx.fillRect(x + i - grow, y + i - grow, 2 + grow * 2, 2 + grow * 2);
          ctx.fillRect(x + i - grow, y - i - grow, 2 + grow * 2, 2 + grow * 2);
        }
      }
      star('#2a1020', 1, 1);
      star(f.color, 0, 1);
      ctx.fillStyle = '#2a1020'; ctx.fillRect(x - 5, y - 5, 11, 11);
      ctx.fillStyle = f.color; ctx.fillRect(x - 4, y - 4, 9, 9);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 2, 5, 5);
      star('#ffffff', -0, 0);
    } else if (k < 0.5) {
      // 퍼지는 고리
      var rr = Math.round((6 + (k - 0.3) * 60) * AS());
      ctx.fillStyle = f.color;
      for (var a = 0; a < 16; a++) {
        var an = a / 16 * Math.PI * 2;
        ctx.fillRect(Math.round(x + Math.cos(an) * rr), Math.round(y + Math.sin(an) * rr * 0.8), 2, 2);
      }
    }
    // 불똥 (매끈한 화면: 빛나는 작은 줄 = 날아가는 방향으로 늘어진 불티)
    var smooth = ((window.CFG && CFG.view.renderScale) || 1) > 1;
    ctx.fillStyle = f.color;
    f.parts.forEach(function (p) {
      if (k > 0.85 && Math.random() < 0.5) return;
      var col = k < 0.4 ? '#ffffff' : f.color;
      if (smooth) {
        var sp = Math.hypot(p.vx, p.vy) || 1, L = Math.min(6, 1 + sp * 0.02) * (1 - k * 0.6), w = p.s * 0.75;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x + p.x, y + p.y); ctx.lineTo(x + p.x - p.vx / sp * L, y + p.y - p.vy / sp * L); ctx.stroke();
        ctx.restore();
        return;
      }
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(x + p.x), Math.round(y + p.y), p.s, p.s);
    });
  }


  window.FX = FX;
})();
