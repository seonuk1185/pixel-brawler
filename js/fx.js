// 타격 효과: 화면 흔들림, 베기 궤적, 불똥, 데미지 숫자, 하얀 번쩍
(function () {
  var list = [];          // 떠 있는 효과들
  var shake = { t: 0, dur: 1, mag: 0, x: 0, y: 0 };

  // ----- 3x5 도트 숫자 글꼴 -----
  var DIGITS = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111',
    '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010',
    '8': '111101111101111', '9': '111101111001111', '!': '010010010000010'
  };
  function drawPixelText(ctx, str, x, y, s, color, outline) {
    var w = str.length * 4 * s - s;
    x = Math.round(x - w / 2); y = Math.round(y);
    function pass(ox, oy, col) {
      ctx.fillStyle = col;
      for (var i = 0; i < str.length; i++) {
        var g = DIGITS[str[i]]; if (!g) continue;
        for (var p = 0; p < 15; p++) if (g[p] === '1')
          ctx.fillRect(x + i * 4 * s + (p % 3) * s + ox, y + ((p / 3) | 0) * s + oy, s, s);
      }
    }
    if (outline) {
      pass(-s, 0, outline); pass(s, 0, outline); pass(0, -s, outline); pass(0, s, outline);
      pass(s, s, outline);
    }
    pass(0, 0, color);
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
    slash: function (cx, cy, dir, arc, color, ms, sprites) {
      // 맞는 순간 화면이 멈추므로, 궤적은 이미 거의 그어진 상태로 시작한다
      list.push({ type: 'slash', x: cx, y: cy, dir: dir, arc: arc, color: color, t: ms * 0.28, life: ms, sprites: sprites });
    },
    impact: function (x, y, dir, color, count, big, sprites) {
      var parts = [];
      for (var i = 0; i < count; i++) {
        var a = (Math.random() * 1.6 - 0.8) + (dir > 0 ? 0 : Math.PI) + (Math.random() < 0.3 ? Math.PI : 0) * 0.6;
        var sp = 60 + Math.random() * (big ? 160 : 110);
        parts.push({ x: 0, y: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, s: Math.random() < 0.35 ? 2 : 1 });
      }
      var life = big ? 260 : 200, spr = sprites && sprites.length ? sprites : null;
      // 그림 효과는 2번째 장(가장 크게 터진 장)부터 → 멈춘 순간에 크게 보임
      list.push({ type: 'impact', x: x, y: y, dir: dir, color: color, t: spr ? life / spr.length : 0, life: life, parts: parts, big: big, sprites: spr });
    },
    damage: function (x, y, n, crit, J) {
      list.push({ type: 'dmg', x: x + (Math.random() * 8 - 4), y: y, n: String(n) + (crit ? '!' : ''), crit: crit, t: 0, life: J.dmgMs, rise: J.dmgRise });
    },

    update: function (dtMs) {
      for (var i = list.length - 1; i >= 0; i--) {
        var f = list[i]; f.t += dtMs;
        if (f.type === 'impact') {
          var dt = dtMs / 1000;
          f.parts.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; p.vx *= 0.92; });
        }
        if (f.t >= f.life) list.splice(i, 1);
      }
    },

    draw: function (ctx, camX) {
      list.forEach(function (f) {
        var k = f.t / f.life, x = Math.round(f.x - camX), y = Math.round(f.y);
        if (f.type === 'slash') drawSlash(ctx, f, x, y, k);
        else if (f.type === 'impact') drawImpact(ctx, f, x, y, k);
        else if (f.type === 'dmg') {
          // 처음엔 크게 튀어나왔다가 작아지며 떠오름
          var s = f.crit ? (k < 0.12 ? 4 : 3) : (k < 0.12 ? 3 : 2);
          var ease = 1 - Math.pow(1 - Math.min(1, k * 1.6), 3);
          ctx.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
          drawPixelText(ctx, f.n, x, y - 20 - ease * f.rise, s, f.crit ? '#ffd23f' : '#ffffff', '#2a1020');
          ctx.globalAlpha = 1;
        }
      });
    }
  };

  function drawSprites(ctx, f, x, y, k) {
    var fr = f.sprites[Math.min(f.sprites.length - 1, Math.floor(k * f.sprites.length))];
    if (!fr) return false;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(f.dir < 0 ? -1 : 1, f.arc && f.arc.flipY ? -1 : 1);
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

  function drawImpact(ctx, f, x, y, k) {
    if (f.sprites && f.sprites.length && drawSprites(ctx, f, x, y, k)) return;
    // 가운데 번쩍(처음 몇 장)
    if (k < 0.3) {
      // 별 모양: 어두운 테두리 → 색 → 흰 심 (하얗게 번쩍인 대상 위에서도 보이게)
      var r = Math.round((f.big ? 16 : 12) * (1 - k / 0.3 * 0.4));
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
      var rr = Math.round(6 + (k - 0.3) * 60);
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
