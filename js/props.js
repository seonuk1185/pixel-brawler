// 소품(2026-11-04): 판의 props — 부서지는 상자·통(못 지나감), 모닥불(장식), 부서질 때 나오는 음식(밟으면 바로 먹음)
// 2026-11-06 밤 물약·포만감: 음식 = 포만감 %(main.js 가 체력을 천천히 채움, H.feed) · 물약 3종(빨강 HP / 파랑 MP / 보라 둘 다, H.drink)
//   물약은 소품·잡몹·보스에서 나옴(잡몹·보스는 main.js 가 dropPotion 을 부름). 물약 그림 = 여기서 코드로 그리는 작은 도트 병(우리 그림)
// 수치는 전부 config.js 의 propTypes · props · food. 맞았을 때 판정은 main.js 의 onHit 가 「소품이면」 여기 hit 로 넘긴다.
//   소품은 맞는 대상 목록(targets)에 적과 같이 들어가지만 데미지 숫자·콤보 수에는 안 들어가고, 번개 겨누기(skills.js aimTargets)에서도 빠진다.
//   적의 공격은 플레이어만 확인하므로 소품을 부수지 못한다.
(function () {
  var CFG = null, H = null;     // H = main.js 가 넘겨주는 도구 { laneY, fx, hitstop, feed(포만감 +%), drink(물약 종류), view, club(몽둥이 주움) }
  var list = [], food = [], potions = [], clubs = [], uid = 0;   // clubs = 바닥의 몽둥이(2026-11-06, 많아야 하나)
  var art = {};                 // 종류별 그림 { frames, breakFrames, pivot } (+ 'food' = { frames: { meat, bread }, pivot })
  function AS() { return (CFG && CFG.actorScale) || 1; }
  function P() { return CFG.props || {}; }

  // ---------- 그림 불러오기: 그 판에 나오는 종류만(같은 그림 묶음은 Assets.loadSet 이 한 번만) ----------
  function loadSet(frames, base, p0) {
    var pv = { x: p0.x, y: p0.y };
    return Assets.loadSet(frames, base, pv).then(function (l) { return { l: l, pv: pv }; });
  }
  function load(st) {
    var T = CFG.propTypes || {}, jobs = [], needFood = false;
    (st.props || []).forEach(function (pr) {
      var d = T[pr.type];
      if (d && d.hits) needFood = true;
      if (!d || !d.frames || art[pr.type]) return;
      var base = d.scale || AS(), A = art[pr.type] = { frames: [], breakFrames: [], pivot: null };
      jobs.push(loadSet(d.frames, base, d.pivot).then(function (r) { A.frames = r.l; A.pivot = r.pv; }));
      if (d.breakFrames) jobs.push(loadSet(d.breakFrames, base, d.pivot).then(function (r) { A.breakFrames = r.l; }));
    });
    var F = CFG.food;
    if (needFood && F && !art.food) {
      var keys = Object.keys(F.items);
      art.food = { frames: {}, pivot: null };
      jobs.push(loadSet(keys.map(function (k) { return F.items[k].frame; }), AS(), F.pivot).then(function (r) {
        keys.forEach(function (k, i) { art.food.frames[k] = r.l[i]; });
        art.food.pivot = r.pv;
      }));
    }
    return Promise.all(jobs);
  }

  // ---------- 소품 하나 ----------
  // hitsLeft = 남은 맞을 횟수, state = 'idle'(서 있음) / 'break'(부서지는 중) / 'gone'(사라짐), t = 그 소품의 시계
  function Prop(def, D, x, y) {
    this.id = 'p' + (++uid); this.isProp = true;
    this.type = def.type; this.def = def; this.D = D;
    this.x = x; this.y = y;
    this.hitsLeft = D.hits || 0; this.state = 'idle';
    this.t = Math.random() * 1000; this.breakT = 0; this.lastHitAt = -1e9;
    this.flashT = 0; this.wobT = 0; this.wobDir = 1;
  }
  Prop.prototype.breakable = function () { return !!this.D.hits; };
  Prop.prototype.alive = function () { return this.state === 'idle'; };
  Prop.prototype.canBeHit = function () { return this.breakable() && this.state === 'idle'; };
  // 막는 상자: 부서지기 시작하면 바로 지나갈 수 있음
  Prop.prototype.solid = function () { return !!(this.D.solid && this.D.footprint) && this.state === 'idle'; };
  // 그림 속 물체 상자(불똥 위치용)
  Prop.prototype.box = function () {
    var h = this.D.hurtbox || { x: -8, y: -16, w: 16, h: 16 };
    return { x0: this.x + h.x, x1: this.x + h.x + h.w, y0: this.y + h.y, y1: this.y + h.y + h.h, z: this.y };
  };
  // 맞는 상자: 물체 위로 hitAbove 만큼 늘림 → 허리 높이 상자를 얼굴 높이 주먹·베기로도 맞힐 수 있게(위에서 내려치는 셈)
  Prop.prototype.hurtbox = function () {
    var b = this.box(); b.y0 -= P().hitAbove || 0;
    return b;
  };

  function reset(st) {
    var T = CFG.propTypes || {};
    list.length = 0; food.length = 0; potions.length = 0; clubs.length = 0;
    (st.props || []).forEach(function (pr) {
      var D = T[pr.type] || {};
      list.push(new Prop(pr, D, pr.x, H.laneY(pr.y != null ? pr.y : 0.5)));
    });
  }
  // 맞을 수 있는 소품(main.js·skills.js 의 맞는 대상 목록에 적과 같이 넣음)
  function targets() { return list.filter(function (pr) { return pr.canBeHit(); }); }

  // ---------- 맞음 ----------
  // o = { dmg, strong(기술·무거운 타 = 한 번에 부서짐), finisher(콤보 마무리 = 2단계), dir(밀리는 쪽), x, y(맞은 곳) }
  function hit(pr, o) {
    if (!pr.canBeHit()) return false;
    var C = P(), J = CFG.juice;
    if (pr.t - pr.lastHitAt < (C.hitGapMs || 0) && !o.strong) return false;   // 여러 판정이 한꺼번에 닿으면 한 단계만
    pr.lastHitAt = pr.t;
    var strong = o.strong || o.dmg >= (C.oneShotDmg || 1e9);
    pr.hitsLeft -= strong ? pr.hitsLeft : (o.finisher ? 2 : 1);
    pr.flashT = C.flashMs || 80; pr.wobT = C.wobbleMs || 160; pr.wobDir = o.dir || 1;
    // 효과: 맞은 곳(소품 맞는 상자 안)에 작은 불똥 + 나뭇조각. 멈춤·흔들림은 적보다 약하게
    var hb = pr.box(), hx = Math.max(hb.x0 + 3, Math.min(hb.x1 - 3, o.x != null ? o.x : pr.x));
    var hy = Math.max(hb.y0 + 4, Math.min(hb.y1 - 4, o.y != null ? o.y : (hb.y0 + hb.y1) / 2));
    var imp = H.fx() && H.fx().impact;
    FX.impact(hx, hy, o.dir || 1, '#ffe0a8', Math.round(J.sparkCount * 0.6), false, imp, 0.8);
    if (Skills.debris) Skills.debris(hx, hy, pr.y, 5, { cols: pr.D.chips || C.woodColors || ['#9a5f30'], sp: 120, size: 2, ms: 500 });   // chips = 그 소품 조각 색(광석 수레)
    H.hitstop(J.hitstopMs * 0.6);
    FX.shake(J.shakePx * 0.6, J.shakeMs * 0.8);
    if (pr.hitsLeft <= 0) breakProp(pr, o.dir || 1);
    return true;
  }
  function breakProp(pr, dir) {
    var C = P(), J = CFG.juice, hb = pr.box();
    pr.state = 'break'; pr.breakT = 0; pr.hitsLeft = 0;
    FX.shake(J.shakePx * 1.1, J.shakeMs);
    if (Skills.debris) {
      Skills.debris(pr.x, (hb.y0 + hb.y1) / 2, pr.y, 12, { cols: pr.D.chips || C.woodColors || ['#9a5f30'], sp: 170, size: 2.6, ms: 750, spread: 1.4 });
      Skills.debris(pr.x, hb.y0 + 4, pr.y, 6, { cols: ['#fff0c0', '#ffd27a'], glow: true, sp: 150, size: 1.4, ms: 320 });
    }
    dropFood(pr, dir);
    if (Math.random() < (C.potion || 0)) dropPotion(pr.x - dir * 4 * AS(), pr.y + 3, -dir, null);   // 물약(음식과 따로, 반대쪽으로 조금)
  }

  // ---------- 음식 ----------
  function dropFood(pr, dir) {
    var F = CFG.food; if (!F) return;
    var kind = pr.def.drop || 'random';
    if (kind === 'random') {
      var r = Math.random(), D = P().drop || {}; kind = 'none';
      Object.keys(D).some(function (k) { r -= D[k]; if (r < 0) { kind = k; return true; } return false; });
    }
    if (!F.items[kind]) return;
    // 소품 자리에서 튀어 올라 조금 앞(때린 쪽 반대)에 떨어짐
    food.push({ kind: kind, x: pr.x + dir * 6 * AS(), y: pr.y + 2, vx: dir * 30 * AS(), z: 0, vz: Math.sqrt(2 * 900 * F.hop), t: 0, bounced: false });
  }
  function updateFood(dt, p) {
    var F = CFG.food; if (!F) return;
    var s = dt / 1000, g = 900;
    for (var i = food.length - 1; i >= 0; i--) {
      var f = food[i];
      f.t += dt;
      if (f.z > 0 || f.vz > 0) {   // 튀어 오름 → 한 번 작게 튕기고 멈춤
        f.x += f.vx * s; f.z += f.vz * s; f.vz -= g * s;
        if (f.z <= 0) {
          f.z = 0;
          if (!f.bounced) { f.bounced = true; f.vz = -f.vz * 0.3; f.vx *= 0.4; } else { f.vz = 0; f.vx = 0; }
        }
      }
      if (f.t >= F.lifeMs) { food.splice(i, 1); continue; }
      // 줍기: 플레이어 발이 가까우면(살아 있을 때)
      if (p && p.state !== 'dead' && f.t >= (F.pickupDelayMs || 0) && Math.abs(p.x - f.x) <= F.pickup.r && Math.abs(p.y - f.y) <= F.pickup.depth) {
        eat(f, p); food.splice(i, 1);
      }
    }
  }
  // 먹기(2026-11-06 밤): 체력 대신 포만감 + 머리 위 「포만감 +30%」 + 주황 빛·알갱이
  function eat(f, p) {
    var it = CFG.food.items[f.kind], n = it.full || 0;
    if (H.feed) H.feed(n);
    FX.damage(p.x, p.y - (p.z || 0) - 112 * AS(), '포만감 +' + n + '%', false, CFG.juice, null, 'full', 'player:pot');
    if (Skills.glow) Skills.glow(p.x, p.y - 30 * AS(), 26 * AS() / 0.55, '#ffc070', 380, 0.55);
    if (Skills.debris) Skills.debris(p.x, p.y - 20 * AS(), p.y, 8, { cols: ['#fff0d0', '#ffc070', '#fff6a0'], glow: true, sp: 110, size: 1.4, ms: 480, g: 40, spread: 0.9 });
  }

  // ---------- 물약 (2026-11-06 밤) ----------
  // 종류 고르기: kind 가 없으면 config potions.weights 비율로
  function pickPotion() {
    var W = (CFG.potions && CFG.potions.weights) || { red: 1 }, r = Math.random(), tot = 0, k;
    for (k in W) tot += W[k];
    r *= tot;
    for (k in W) { r -= W[k]; if (r < 0) return k; }
    return 'red';
  }
  // 물약 하나 떨어뜨림: x,y = 나오는 바닥 자리, dir = 튀는 쪽(때린 쪽 반대), kind = 'red'/'blue'/'purple'(없으면 비율로). 돌려주는 값 = 종류
  function dropPotion(x, y, dir, kind) {
    var PO = CFG.potions; if (!PO) return null;
    kind = kind && PO.items[kind] ? kind : pickPotion();
    potions.push({ kind: kind, x: x + (dir || 1) * 6 * AS(), y: y, vx: (dir || 1) * 34 * AS(), z: 0, vz: Math.sqrt(2 * 900 * PO.hop), t: 0, bounced: false, ph: Math.random() * 6 });
    return kind;
  }
  function updatePotions(dt, p) {
    var PO = CFG.potions; if (!PO) return;
    var s = dt / 1000, g = 900;
    for (var i = potions.length - 1; i >= 0; i--) {
      var f = potions[i];
      f.t += dt;
      if (f.z > 0 || f.vz > 0) {   // 튀어 오름 → 한 번 작게 튕기고 멈춤(음식과 같음)
        f.x += f.vx * s; f.z += f.vz * s; f.vz -= g * s;
        if (f.z <= 0) {
          f.z = 0;
          if (!f.bounced) { f.bounced = true; f.vz = -f.vz * 0.3; f.vx *= 0.4; } else { f.vz = 0; f.vx = 0; }
        }
      }
      if (H.view) {   // 걷는 길·화면(버튼 밑 빼고) 안에 머묾 → 못 줍는 자리에 떨어지지 않게
        var V = H.view(); f.y = Math.max(V.laneTop, Math.min(V.laneBottom, f.y)); f.x = Math.max(V.x0 + 8, Math.min(V.x1 - 8, f.x));
      }
      if (f.t >= PO.lifeMs) { potions.splice(i, 1); continue; }
      // 마시기: 밟으면 바로(게이지가 꽉 차 있어도)
      if (p && p.state !== 'dead' && f.t >= (PO.pickupDelayMs || 0) && Math.abs(p.x - f.x) <= PO.pickup.r && Math.abs(p.y - f.y) <= PO.pickup.depth) {
        drink(f, p); potions.splice(i, 1);
      }
    }
  }
  function drink(f, p) {
    var it = CFG.potions.items[f.kind], c = it.col, J = CFG.juice, y = p.y - (p.z || 0) - 112 * AS();
    var got = H.drink ? H.drink(f.kind) : { hp: 0, mp: 0 };
    if (it.hp) FX.damage(p.x, y, '+HP' + (got.hp > 0 ? ' ' + got.hp : ''), false, J, null, 'pothp', 'player:pot');
    if (it.mp) FX.damage(p.x, y, '+MP' + (got.mp > 0 ? ' ' + got.mp : ''), false, J, null, 'potmp', 'player:pot');
    // 물약 색 둥근 빛 + 위로 올라가는 거품 알갱이
    if (Skills.glow) { Skills.glow(p.x, p.y - 40 * AS(), 34 * AS() / 0.55, c[1], 420, 0.7); Skills.glow(p.x, p.y - 10 * AS(), 20 * AS() / 0.55, c[0], 300, 0.6); }
    if (Skills.debris) Skills.debris(p.x, p.y - 16 * AS(), p.y, 12, { cols: ['#ffffff', c[0], c[1]], glow: true, sp: 120, size: 1.5, ms: 560, g: -80, spread: 0.7 });
  }
  // 물약병 그림(코드로 그린 도트, 2026-11-06 밤 우리 그림): 24x32 점(= 12x16 도트, 캐릭터 HD 그림과 같은 0.5 도트 점).
  //   코르크 마개 → 입구 테 → 목(빈 유리) → 둥근 병. 병 안 물약(밝음·가운데·어두움 3단) + 수면 줄 + 왼쪽 위 흰 반짝. 바깥 1점 진한 테두리
  var potArt = {};
  function potionImg(kind) {
    if (potArt[kind]) return potArt[kind];
    var col = CFG.potions.items[kind].col, W = 24, Hh = 32, cx = 11.5, cy = 21.5, R = 9.6, lvl = 15;   // lvl = 물약 수면 줄
    var m = [], x, y;   // 점마다 색 이름(빈 = null)
    for (y = 0; y < Hh; y++) for (x = 0; x < W; x++) {
      var v = null, dx = x - cx, dy = y - cy;
      if (y >= 1 && y <= 4 && x >= 9 && x <= 14) v = y === 1 ? 'corkL' : (x === 14 ? 'corkD' : 'cork');          // 코르크
      else if (y === 5 && x >= 8 && x <= 15) v = 'lip';                                                     // 병 입구 테
      else if (y >= 6 && y <= 11 && x >= 9 && x <= 14) v = x === 9 ? 'glassL' : 'glass';                   // 목(빈 유리)
      if (y >= 10 && dx * dx + dy * dy <= R * R) {
        if (y < lvl) v = 'glass';
        else if (y === lvl) v = 'top';
        else v = dx + dy > 6 ? 'dark' : (dx + dy < -5 ? 'light' : 'mid');
      }
      m.push(v);
    }
    [[6, 16], [6, 17], [7, 16], [6, 18], [8, 15], [16, 26]].forEach(function (q) { var i = q[1] * W + q[0]; if (m[i]) m[i] = 'shine'; });   // 반짝
    var PAL = { cork: '#9a6434', corkL: '#c8945a', corkD: '#6a3e1e', lip: '#d8eef6', glass: 'rgba(200,232,248,0.55)', glassL: 'rgba(255,255,255,0.85)',
                top: col[0], light: col[0], mid: col[1], dark: col[2], shine: '#ffffff' };
    var c = document.createElement('canvas'); c.width = W; c.height = Hh;
    var g = c.getContext('2d');
    g.fillStyle = '#1a0e1c';   // 테두리: 칠한 점 둘레(위아래좌우) 빈 점
    for (y = 0; y < Hh; y++) for (x = 0; x < W; x++) {
      if (m[y * W + x]) continue;
      if ((x > 0 && m[y * W + x - 1]) || (x < W - 1 && m[y * W + x + 1]) || (y > 0 && m[(y - 1) * W + x]) || (y < Hh - 1 && m[(y + 1) * W + x])) g.fillRect(x, y, 1, 1);
    }
    for (y = 0; y < Hh; y++) for (x = 0; x < W; x++) { var k = m[y * W + x]; if (k) { g.fillStyle = PAL[k]; g.fillRect(x, y, 1, 1); } }
    c._k = 0.5; c._dots = true;   // 1 점 = 0.5 도트, 그릴 때 부드럽게 하기 끔(또렷하게)
    potArt[kind] = c;
    return c;
  }
  function potBlink(f) { var PO = CFG.potions, left = PO.lifeMs - f.t; return left < PO.blinkMs && Math.floor(left / 100) % 2 === 0; }
  // 물약 한 개: 바닥에서 둥실(1.5 도트) + 병 둘레 물약 색 빛(더하기, 숨쉬듯) + 1.4초마다 반짝 별
  function drawPotion(ctx, camX, f) {
    if (potBlink(f)) return;
    var img = potionImg(f.kind), col = CFG.potions.items[f.kind].col;
    var bob = f.z > 0 ? 0 : Math.sin(f.t / 260 + f.ph) * 1.5 - 1.5, x = snapPx(f.x - camX), y = snapPx(f.y - f.z + bob);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    var r = 12, gr = ctx.createRadialGradient(x, y - 7, 0, x, y - 7, r);
    gr.addColorStop(0, col[1]); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.38 + 0.14 * Math.sin(f.t / 180 + f.ph); ctx.fillStyle = gr; ctx.fillRect(x - r, y - 7 - r, r * 2, r * 2);
    ctx.restore();
    ctx.save(); ctx.translate(x, y);
    Assets.blit(ctx, img, 12, 32);
    var ph = ((f.t + f.ph * 300) % 1400) / 1400;
    if (ph < 0.2) {   // 반짝 별(병 왼쪽 위)
      var a = Math.sin(ph / 0.2 * Math.PI), L = 1 + 2.5 * a;
      ctx.globalAlpha = a; ctx.fillStyle = '#ffffff';
      ctx.fillRect(-3.5, -11 - L, 1, L * 2); ctx.fillRect(-3 - L, -11.5, L * 2, 1);
    }
    ctx.restore();
  }

  // ---------- 첫 무기 몽둥이 (2026-11-06, 수치 = config club) ----------
  //   main.js 가 1판 견습 잡몹 쓰러짐 때 dropClub 을 부름. 밟으면 H.club() (저장 · 알림은 main.js), 여기선 빛 · 불똥. 사라지지 않음
  function dropClub(x, y, dir) {
    var C = CFG.club; if (!C) return false;
    clubs.push({ x: x + (dir || 1) * 6 * AS(), y: y, vx: (dir || 1) * 30 * AS(), z: 0, vz: Math.sqrt(2 * 900 * C.hop), t: 0, bounced: false, ph: Math.random() * 6 });
    return true;
  }
  function updateClubs(dt, p) {
    var C = CFG.club; if (!C) return;
    var s = dt / 1000, g = 900;
    for (var i = clubs.length - 1; i >= 0; i--) {
      var f = clubs[i];
      f.t += dt;
      if (f.z > 0 || f.vz > 0) {   // 튀어 오름 → 한 번 작게 튕기고 멈춤(물약과 같음)
        f.x += f.vx * s; f.z += f.vz * s; f.vz -= g * s;
        if (f.z <= 0) {
          f.z = 0;
          if (!f.bounced) { f.bounced = true; f.vz = -f.vz * 0.3; f.vx *= 0.4; } else { f.vz = 0; f.vx = 0; }
        }
      }
      if (H.view) { var V = H.view(); f.y = Math.max(V.laneTop, Math.min(V.laneBottom, f.y)); f.x = Math.max(V.x0 + 8, Math.min(V.x1 - 8, f.x)); }
      if (p && p.state !== 'dead' && f.t >= (C.pickupDelayMs || 0) && Math.abs(p.x - f.x) <= C.pickup.r && Math.abs(p.y - f.y) <= C.pickup.depth) {
        clubs.splice(i, 1);
        if (H.club) H.club();
        var c = C.glow;   // 금빛 둥근 빛 두 겹 + 나무 조각 · 금 불똥이 위로
        if (Skills.glow) { Skills.glow(p.x, p.y - 40 * AS(), 40 * AS() / 0.55, c[1], 520, 0.75); Skills.glow(p.x, p.y - 10 * AS(), 22 * AS() / 0.55, c[0], 360, 0.6); }
        if (Skills.debris) Skills.debris(p.x, p.y - 16 * AS(), p.y, 16, { cols: ['#ffffff', c[0], c[1], '#c88a4a'], glow: true, sp: 150, size: 1.6, ms: 640, g: -90, spread: 0.8 });
      }
    }
  }
  // 몽둥이 그림(코드로 그린 도트, 우리 그림): 36x46 점(= 18x23 도트, 0.5 도트 점). 왼쪽 아래 손잡이(가죽 감개 + 둥근 끝) → 오른쪽 위로 굵어지는 나무 머리.
  //   나무 3단(밝음 · 가운데 · 어두움, 왼쪽 위가 밝음) + 옹이 2개 + 흰 반짝. 바깥 1점 진한 테두리. HUD 작은 그림도 이것(main.js)
  var clubArt = null;
  function clubImg() {
    if (clubArt) return clubArt;
    var W = 36, Hh = 46, ax = 9, ay = 41.5, bx = 27, by = 5.5, ux = bx - ax, uy = by - ay, LL = ux * ux + uy * uy, len = Math.sqrt(LL);
    var m = [], x, y;
    function rad(t) {   // 길이 방향 t(0 = 손잡이 끝, 1 = 머리 끝) 의 반지름
      if (t < 0.3) return 2.2;
      if (t < 0.86) { var u = (t - 0.3) / 0.56; return 2.2 + 3.8 * u * u * (3 - 2 * u); }
      var w = (t - 0.86) / 0.15; return 6 * Math.sqrt(Math.max(0, 1 - w * w * 0.75));
    }
    for (y = 0; y < Hh; y++) for (x = 0; x < W; x++) {
      var px = x + 0.5 - ax, py = y + 0.5 - ay, t = Math.max(0, Math.min(1, (px * ux + py * uy) / LL));
      var dx = px - t * ux, dy = py - t * uy, d = Math.sqrt(dx * dx + dy * dy), r = rad(t), v = null;
      if (d <= r) {
        var side = (ux * py - uy * px) / len / r;   // -1 = 왼쪽 위(빛 받는 쪽) ~ 1 = 오른쪽 아래
        if (t < 0.07) v = side < -0.2 ? 'knobL' : 'knob';                                        // 손잡이 끝 둥근 마개
        else if (t < 0.3) v = Math.floor(t * len / 2.9) % 2 ? (side < -0.2 ? 'wrapL' : 'wrap') : 'wrapD';   // 가죽 감개
        else v = side < -0.4 ? 'light' : side > 0.4 ? 'dark' : 'mid';
      }
      m.push(v);
    }
    // 옹이(어두운 점) · 반짝(머리 왼쪽 위)
    [[22, 17], [23, 17], [23, 18], [18, 24]].forEach(function (q) { var i = q[1] * W + q[0]; if (m[i] === 'mid') m[i] = 'knot'; });
    [[21, 8], [22, 7], [20, 9], [19, 11], [18, 12]].forEach(function (q) { var i = q[1] * W + q[0]; if (m[i]) m[i] = 'shine'; });
    var PAL = { knob: '#7a4a24', knobL: '#a8703c', wrap: '#9a4a32', wrapL: '#c4704a', wrapD: '#5e2a1c',
                light: '#e8bc7c', mid: '#b47c40', dark: '#6e4420', knot: '#4e2c14', shine: '#fff4d8' };
    var c = document.createElement('canvas'); c.width = W; c.height = Hh;
    var g = c.getContext('2d');
    g.fillStyle = '#1a0e1c';   // 테두리
    for (y = 0; y < Hh; y++) for (x = 0; x < W; x++) {
      if (m[y * W + x]) continue;
      if ((x > 0 && m[y * W + x - 1]) || (x < W - 1 && m[y * W + x + 1]) || (y > 0 && m[(y - 1) * W + x]) || (y < Hh - 1 && m[(y + 1) * W + x])) g.fillRect(x, y, 1, 1);
    }
    for (y = 0; y < Hh; y++) for (x = 0; x < W; x++) { var k = m[y * W + x]; if (k) { g.fillStyle = PAL[k]; g.fillRect(x, y, 1, 1); } }
    c._k = 0.5; c._dots = true;
    clubArt = c;
    return c;
  }
  // 몽둥이 한 개: 바닥에서 둥실(1.5 도트) + 둘레 금빛(더하기, 숨쉬듯) + 1.2초마다 머리 위 반짝 별
  function drawClub(ctx, camX, f) {
    var img = clubImg(), col = CFG.club.glow;
    var bob = f.z > 0 ? 0 : Math.sin(f.t / 260 + f.ph) * 1.5 - 1.5, x = snapPx(f.x - camX), y = snapPx(f.y - f.z + bob);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    var r = 18, gr = ctx.createRadialGradient(x, y - 12, 0, x, y - 12, r);
    gr.addColorStop(0, col[0]); gr.addColorStop(0.5, col[1]); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.42 + 0.18 * Math.sin(f.t / 170 + f.ph); ctx.fillStyle = gr; ctx.fillRect(x - r, y - 12 - r, r * 2, r * 2);
    ctx.restore();
    ctx.save(); ctx.translate(x, y);
    Assets.blit(ctx, img, 18, 45);
    var ph = ((f.t + f.ph * 300) % 1200) / 1200;
    if (ph < 0.22) {   // 반짝 별(머리 왼쪽 위)
      var a = Math.sin(ph / 0.22 * Math.PI), L = 1 + 3 * a;
      ctx.globalAlpha = a; ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, -19 - L, 1, L * 2); ctx.fillRect(0.5 - L, -18.5, L * 2, 1);
    }
    ctx.restore();
  }

  // ---------- 매 장면 ----------
  function update(dt, p) {
    var C = P();
    for (var i = list.length - 1; i >= 0; i--) {
      var pr = list[i];
      pr.t += dt;
      if (pr.flashT > 0) pr.flashT -= dt;
      if (pr.wobT > 0) pr.wobT -= dt;
      if (pr.state === 'break') {
        pr.breakT += dt;
        var n = (art[pr.type] && art[pr.type].breakFrames.length) || 4;
        if (pr.breakT > n * 1000 / (C.breakFps || 14) + (C.holdMs || 0) + (C.fadeMs || 0)) { pr.state = 'gone'; list.splice(i, 1); }
      }
    }
    updateFood(dt, p);
    updatePotions(dt, p);
    updateClubs(dt, p);
  }

  // ---------- 못 지나감 ----------
  // 몸(가운데 o.x, o.y, 가로 반폭 r)을 막는 상자 밖으로 밀어냄: 덜 겹친 쪽(가로 / 위아래)으로 → 모서리에서 미끄러지며 돌아감.
  //   위아래로 밀면 걷는 길 밖으로 나갈 때는 가로로 민다(길 끝에서 갇히지 않게)
  function pushOut(o, r, world) {
    var C = P(), d = C.actorDepth || 3, moved = false;
    list.forEach(function (pr) {
      if (!pr.solid()) return;
      var F = pr.D.footprint, hw = F.w / 2 + r, hd = F.depth / 2 + d;
      var dx = o.x - pr.x, dy = o.y - pr.y;
      if (Math.abs(dx) >= hw || Math.abs(dy) >= hd) return;
      var px = hw - Math.abs(dx), py = hd - Math.abs(dy);
      var sy = dy > 0 || (dy === 0 && pr.y < (world.laneTop + world.laneBottom) / 2) ? 1 : -1;
      var ny = pr.y + sy * hd;
      var yOk = ny >= world.laneTop && ny <= world.laneBottom;
      if (py < px && yOk) o.y = ny;
      else o.x = pr.x + (dx >= 0 ? 1 : -1) * hw;
      moved = true;
    });
    return moved;
  }
  // actors = [{ o, r }] (플레이어·적)
  function collide(actors, world) { actors.forEach(function (a) { pushOut(a.o, a.r, world); }); }

  // 돌아가기: (o.x, o.y) 에서 목표(tx, ty) 쪽으로 갈 때
  //   1) 목표 자리가 소품 안이면 목표를 소품 옆(fx = 노리는 대상 x 쪽)으로 옮기고
  //   2) 앞 lookAhead 안에 막는 소품이 같은 줄에 있으면 위나 아래 가장자리로 목표 y 를 바꿈.
  //   한 번 고른 쪽(위/아래)은 그 소품을 지날 때까지 유지(왔다 갔다 안 하게). 돌려주는 값 = 쓸 목표 { x, y }
  function steer(o, r, tx, ty, world, fx) {
    var C = P(), d = C.actorDepth || 3;
    list.forEach(function (pr) {
      if (!pr.solid()) return;
      var F = pr.D.footprint, hw = F.w / 2 + r, hd = F.depth / 2 + d;
      if (Math.abs(tx - pr.x) < hw && Math.abs(ty - pr.y) < hd) tx = pr.x + ((fx != null ? fx : tx) >= pr.x ? 1 : -1) * (hw + 7);   // 7 = 적(4)·자동 조종(6)이 「다 왔다」고 멈추는 폭보다 조금 더
    });
    var dx = tx - o.x;
    if (Math.abs(dx) < 2) { o._det = null; return { x: tx, y: ty }; }
    var s = dx > 0 ? 1 : -1, best = null, bd = 1e9;
    list.forEach(function (pr) {
      if (!pr.solid()) return;
      var F = pr.D.footprint, hw = F.w / 2 + r, hd = F.depth / 2 + d;
      var ahead = (pr.x - o.x) * s;
      if (ahead + hw <= 0 || ahead - hw > Math.min(Math.abs(dx), C.lookAhead || 48)) return;   // 이미 지났거나 멀리 / 목표보다 뒤
      if (Math.abs(o.y - pr.y) >= hd + 1) return;                                                // 다른 줄
      if (ahead < bd) { bd = ahead; best = { pr: pr, hd: hd }; }
    });
    if (!best) { o._det = null; return { x: tx, y: ty }; }
    var pr = best.pr, up = pr.y - best.hd - 4, dn = pr.y + best.hd + 4;   // 4 = 움직임 멈춤 폭(3도트)보다 조금 더 → 가장자리를 확실히 넘어감
    var upOk = up >= world.laneTop, dnOk = dn <= world.laneBottom;
    var side = o._det && o._det.id === pr.id ? o._det.side : 0;
    if (!side || (side < 0 && !upOk) || (side > 0 && !dnOk)) {
      var ref = Math.abs(ty - pr.y) < best.hd ? o.y : ty;   // 목표가 소품 줄 안이면 지금 내 쪽으로
      side = (ref < pr.y && upOk) || !dnOk ? -1 : 1;
      o._det = { id: pr.id, side: side };
    }
    return { x: tx, y: side < 0 ? up : dn };
  }

  // ---------- 그리기 ----------
  // 바닥(캐릭터 뒤): 그림자 + 모닥불 빛
  function drawUnder(ctx, camX, LW) {
    list.forEach(function (pr) {
      if (pr.x < camX - 120 || pr.x > camX + LW + 120) return;
      var D = pr.D, x = snapPx(pr.x - camX), y = snapPx(pr.y);
      if (D.shadow && pr.state === 'idle') window.drawShadow(ctx, x, y, D.shadow);
      // 빛: 하나 또는 여러 개(3단계 가마솥 = 장작불 + 초록 국물)
      if (D.glow) [].concat(D.glow).forEach(function (G, gi) {
        var fl = 0.85 + 0.15 * Math.sin(pr.t / 90 + gi * 2) * Math.sin(pr.t / 37 + 1 + gi), r = G.r * fl, gy = pr.y - G.y;
        var gr = ctx.createRadialGradient(x, gy, 0, x, gy, r);
        gr.addColorStop(0, G.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = G.alpha * fl;
        ctx.fillStyle = gr; ctx.fillRect(x - r, gy - r, r * 2, r * 2); ctx.restore();
      });
    });
    var F = CFG.food;
    if (F) food.forEach(function (f) { if (!blinkOff(f)) window.drawShadow(ctx, snapPx(f.x - camX), snapPx(f.y), F.shadow * (1 - Math.min(0.5, f.z / 30))); });
    var PO = CFG.potions;
    if (PO) potions.forEach(function (f) { if (!potBlink(f)) window.drawShadow(ctx, snapPx(f.x - camX), snapPx(f.y), PO.shadow * (1 - Math.min(0.5, f.z / 30))); });
    var CL = CFG.club;
    if (CL) clubs.forEach(function (f) { window.drawShadow(ctx, snapPx(f.x - camX), snapPx(f.y), CL.shadow * (1 - Math.min(0.5, f.z / 30))); });
  }
  function blinkOff(f) { var F = CFG.food, left = F.lifeMs - f.t; return left < F.blinkMs && Math.floor(left / 100) % 2 === 0; }

  function drawProp(ctx, camX, pr, debug) {
    var A = art[pr.type], D = pr.D, C = P(), x = pr.x - camX, y = pr.y, img = null, alpha = 1;
    if (pr.wobT > 0) x += pr.wobDir * (C.wobble || 1.5) * Math.sin(pr.wobT / 22) * (pr.wobT / (C.wobbleMs || 160));
    x = snapPx(x); y = snapPx(y);
    if (A && A.frames.length) {
      if (pr.state === 'break' && A.breakFrames.length) {
        var bf = A.breakFrames, step = 1000 / (C.breakFps || 14), bi = Math.min(bf.length - 1, Math.floor(pr.breakT / step));
        img = bf[bi];
        var fadeAt = bf.length * step + (C.holdMs || 0);
        if (pr.breakT > fadeAt) alpha = Math.max(0, 1 - (pr.breakT - fadeAt) / (C.fadeMs || 400));
      } else if (D.fps > 0) img = A.frames[Math.floor(pr.t / (1000 / D.fps)) % A.frames.length];
      else img = A.frames[Math.min(A.frames.length - 1, (D.hits || 0) - pr.hitsLeft)];   // 맞은 횟수 = 금 감 · 많이 부서짐
    }
    if (img) {
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y);
      Assets.blit(ctx, img, A.pivot.x, A.pivot.y);
      if (pr.flashT > 0) {   // 맞은 순간 하얗게
        var s = FX.whiteSilhouette(img, 0, 0, img.width, img.height, 1);
        ctx.globalAlpha = alpha * Math.min(1, pr.flashT / ((C.flashMs || 80) * 0.5)) * 0.8;
        Assets.blit(ctx, img, A.pivot.x, A.pivot.y, s);
      }
      ctx.restore();
    } else if (debug) {   // 그림 없음: 자리만(분홍 X)
      ctx.strokeStyle = '#f0f'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - 6, y - 12); ctx.lineTo(x + 6, y); ctx.moveTo(x + 6, y - 12); ctx.lineTo(x - 6, y); ctx.stroke();
      ctx.fillStyle = '#f0f'; ctx.font = '6px monospace'; ctx.fillText(pr.type, x - 12, y - 14);
    }
    if (debug && pr.state === 'idle') {   // 맞는 상자(하늘색) · 막는 상자(주황)
      if (pr.canBeHit()) { var hb = pr.hurtbox(); ctx.strokeStyle = '#3cf'; ctx.strokeRect(Math.round(hb.x0 - camX) + 0.5, Math.round(hb.y0) + 0.5, Math.round(hb.x1 - hb.x0), Math.round(hb.y1 - hb.y0)); }
      if (pr.solid()) { var F = D.footprint; ctx.strokeStyle = '#fa0'; ctx.strokeRect(Math.round(pr.x - F.w / 2 - camX) + 0.5, Math.round(pr.y - F.depth / 2) + 0.5, Math.round(F.w), Math.round(F.depth)); }
    }
  }
  function drawFood(ctx, camX, f) {
    var A = art.food, img = A && A.frames[f.kind];
    if (!img || blinkOff(f)) return;
    ctx.save(); ctx.translate(snapPx(f.x - camX), snapPx(f.y - f.z));
    Assets.blit(ctx, img, A.pivot.x, A.pivot.y);
    ctx.restore();
  }
  // 깊이 순서 목록(main.js render 의 ents)에 소품·음식 넣기. 부서지는 잔해·음식은 같은 줄의 캐릭터보다 뒤
  function addDraw(ents, ctx, camX, LW, debug) {
    list.forEach(function (pr) {
      if (pr.x < camX - 200 || pr.x > camX + LW + 200) return;
      ents.push({ y: pr.y - (pr.state === 'idle' ? 0.25 : 2), d: function () { drawProp(ctx, camX, pr, debug); } });
    });
    food.forEach(function (f) { ents.push({ y: f.y - 1, d: function () { drawFood(ctx, camX, f); } }); });
    potions.forEach(function (f) { ents.push({ y: f.y - 1, d: function () { drawPotion(ctx, camX, f); } }); });
    clubs.forEach(function (f) { ents.push({ y: f.y - 1, d: function () { drawClub(ctx, camX, f); } }); });
  }

  window.Props = {
    init: function (cfg, hooks) { CFG = cfg; H = hooks; },
    load: load, reset: reset, targets: targets, hit: hit, update: update,
    collide: collide, steer: steer, drawUnder: drawUnder, addDraw: addDraw,
    list: list, food: food, potions: potions, art: art, dropPotion: dropPotion, potionImg: potionImg,
    clubs: clubs, dropClub: dropClub, clubImg: clubImg,
    clear: function () { list.length = 0; food.length = 0; potions.length = 0; clubs.length = 0; }
  };
})();
