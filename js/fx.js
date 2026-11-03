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
  // 글자 가운데 = x, 글자 윗줄 = y
  function drawPixelText(ctx, str, x, y, st) {
    var t = textSprite(str, st);
    ctx.drawImage(t.img, Math.round(x - t.w / 2), Math.round(y) - t.pad);
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
    damage: function (x, y, n, crit, J, color) {
      list.push({ type: 'dmg', x: x + (Math.random() * 8 - 4), y: y, n: String(n) + (crit ? '!' : ''), crit: crit, t: 0, life: J.dmgMs, rise: J.dmgRise * AS(), color: color || null });
    },
    // 그림 여러 장을 한 번 재생하는 효과(오크 돌진 먼지). pivot = 그림 속 기준점(바닥 가운데), flip = 좌우 뒤집기
    // under = true 면 캐릭터보다 뒤(바닥)에 그림, scale = 크기 배율(없으면 1, 법사 마법 터짐·반짝임)
    sprite: function (x, y, frames, fps, pivot, flip, under, scale) {
      list.push({ type: 'sprite', x: x, y: y, frames: frames, step: 1000 / fps, pivot: pivot, flip: !!flip, under: !!under, t: 0, life: frames.length * 1000 / fps, scale: scale || 1 });
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
    var k = f.t / f.life, x = Math.round(f.x - camX), y = Math.round(f.y);
    if (f.type === 'sprite') {
      var im = f.frames[Math.min(f.frames.length - 1, Math.floor(f.t / f.step))];
      if (!im) return;
      ctx.save(); ctx.translate(x, y); ctx.scale(f.flip ? -f.scale : f.scale, f.scale);
      ctx.drawImage(im, -f.pivot.x, -f.pivot.y); ctx.restore();
    }
    else if (f.type === 'slash') drawSlash(ctx, f, x, y, k);
    else if (f.type === 'thrust') drawThrust(ctx, f, x, y, k);
    else if (f.type === 'impact') drawImpact(ctx, f, x, y, k);
    else if (f.type === 'dmg') {
      // 처음엔 pop 모양(한 단계 크게/밝게)으로 튀어나왔다가 제 모양으로 돌아오며 떠오름 → 끝에서 서서히 사라짐
      var D = (window.CFG && window.CFG.damageText) || {};
      var st = (f.crit ? D.crit : D.normal) || { font: 'small', top: '#ffffff', outline: '#2a1020' };
      if ((k < (D.popK || 0.12) && st.pop) || f.color) {
        var st2 = {}, kk;
        for (kk in st) if (kk !== 'pop') st2[kk] = st[kk];
        if (k < (D.popK || 0.12) && st.pop) for (kk in st.pop) st2[kk] = st.pop[kk];
        if (f.color) { st2.top = f.color; st2.bottom = D.hurtBottom || f.color; }   // 플레이어가 맞은 숫자 = 빨강
        st = st2;
      }
      var ease = 1 - Math.pow(1 - Math.min(1, k * 1.6), 3);
      ctx.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
      drawPixelText(ctx, f.n, x, y - (D.lift != null ? D.lift : 20) * AS() - ease * f.rise, st);
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
    ctx.drawImage(fr, -Math.round(fr.width / 2), -Math.round(fr.height / 2));
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
    // 불똥
    ctx.fillStyle = f.color;
    f.parts.forEach(function (p) {
      if (k > 0.85 && Math.random() < 0.5) return;
      ctx.fillStyle = k < 0.4 ? '#ffffff' : f.color;
      ctx.fillRect(Math.round(x + p.x), Math.round(y + p.y), p.s, p.s);
    });
  }

  window.FX = FX;
})();
