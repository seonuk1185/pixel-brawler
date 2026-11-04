// 소품(2026-11-04): 판의 props — 부서지는 상자·통(못 지나감), 모닥불(장식), 부서질 때 나오는 음식(밟으면 체력 회복)
// 수치는 전부 config.js 의 propTypes · props · food. 맞았을 때 판정은 main.js 의 onHit 가 「소품이면」 여기 hit 로 넘긴다.
//   소품은 맞는 대상 목록(targets)에 적과 같이 들어가지만 데미지 숫자·콤보 수에는 안 들어가고, 번개 겨누기(skills.js aimTargets)에서도 빠진다.
//   적의 공격은 플레이어만 확인하므로 소품을 부수지 못한다.
(function () {
  var CFG = null, H = null;     // H = main.js 가 넘겨주는 도구 { player, hitstop, laneY }
  var list = [], food = [], uid = 0;
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
    list.length = 0; food.length = 0;
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
  function eat(f, p) {
    var it = CFG.food.items[f.kind], before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + (it.heal || 0));
    var got = p.hp - before;
    if (got > 0) FX.damage(p.x, p.y - (p.z || 0) - 112 * AS(), got, false, CFG.juice, null, 'heal', 'heal');
    // 반짝임: 초록 빛 + 위로 올라가는 작은 빛 알갱이
    if (Skills.glow) Skills.glow(p.x, p.y - 30 * AS(), 26 * AS() / 0.55, '#9dff8a', 380, 0.6);
    if (Skills.debris) Skills.debris(p.x, p.y - 20 * AS(), p.y, 8, { cols: ['#eaffd8', '#9dff8a', '#fff6a0'], glow: true, sp: 110, size: 1.4, ms: 480, g: 40, spread: 0.9 });
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
      if (D.glow) {
        var G = D.glow, fl = 0.85 + 0.15 * Math.sin(pr.t / 90) * Math.sin(pr.t / 37 + 1), r = G.r * fl, gy = pr.y - G.y;
        var gr = ctx.createRadialGradient(x, gy, 0, x, gy, r);
        gr.addColorStop(0, G.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = G.alpha * fl;
        ctx.fillStyle = gr; ctx.fillRect(x - r, gy - r, r * 2, r * 2); ctx.restore();
      }
    });
    var F = CFG.food;
    if (F) food.forEach(function (f) { if (!blinkOff(f)) window.drawShadow(ctx, snapPx(f.x - camX), snapPx(f.y), F.shadow * (1 - Math.min(0.5, f.z / 30))); });
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
  }

  window.Props = {
    init: function (cfg, hooks) { CFG = cfg; H = hooks; },
    load: load, reset: reset, targets: targets, hit: hit, update: update,
    collide: collide, steer: steer, drawUnder: drawUnder, addDraw: addDraw,
    list: list, food: food, art: art,
    clear: function () { list.length = 0; food.length = 0; }
  };
})();
