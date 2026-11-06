// 속성 몹(2026-11-07, 형님 승인): 있는 잡몹(어느 종류든)에 속성 하나를 얹음 = 색(tint) + 몸 둘레 오라 + 속성 능력 (수치 = config elMobs)
//   불 = 금빛 불기둥 오라 · 때리면 불탐 · 쓰러지면 화염 폭발 + 불타는 바닥 / 얼음 = 서리 오라 · 때리면 얼어붙음(느려짐) · 쓰러지면 빙결 장판
//   번개 = 코드로 그린 세로 번개 줄이 몸 둘레를 돌며 지지직 · 가끔 빠른 돌진(전기 잔상, 부딪히면 감전) / 독 = 발밑 독 기운 · 걷다가 독 웅덩이 · 쓰러지면 독가스
//   바람 = 코드로 그린 꽈배기 바람 줄기(밑 → 위, 반투명) · 빨라짐 · 가까이 있으면 돌풍(밀어냄) / 어둠 = 그림자 연기 · 스르르 나타남 · 가끔 흐려짐 · 체력 빨기
//   빛 = 은빛 빛기둥 · 가끔 빛 퍼짐(둘레 몹 체력 조금 + 자기 보호막)
//   main.js 가 쓰는 것: init(도구) · apply(적, 속성) · key(속성) · step(dt) · onPlayerHit(적, 공격, 데미지) · dmgIn(적, 데미지) · playerMods(플레이어) · reset()
//                       drawUnder(ctx, camX) · drawOver(ctx, camX) · log(on) · state()
//   enemies.js 가 쓰는 것: draw(적, ctx, x, 몸 y, 땅 y, 'back' / 'front', 투명도) — Enemy.draw 안에서 몸 앞뒤로
(function () {
  var H = null;            // main.js 도구(init)
  var ART = {};            // 효과 그림 { 이름: { frames, pv, fps, loop } }
  var haz = [];            // 바닥 · 공중 위험: { kind: 'ground' / 'gas', art, x, y, t, ms, r, depth, st(불탐 · 얼음 · 독), mul, k }
  var rings = [];          // 빛 퍼짐 고리 { x, y, t, r }
  var gusts = [];          // 돌풍 줄기 { x, y, dir, t }
  var LOG = null;          // 시험용 기록
  var sndAt = {};          // 소리 너무 자주 안 나게(이름마다 마지막 시각)
  var clock = 0;

  function C() { return window.CFG.elMobs; }
  function AS() { return window.CFG.actorScale || 1; }
  function key(k) { return k === 'dark' ? 'darkness' : k; }
  function rr(a) { return a[0] + Math.random() * (a[1] - a[0]); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function hash(a, b) { var v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); }
  function log(k, n) { if (LOG) LOG[k] = (LOG[k] || 0) + (n == null ? 1 : n); }
  function snd(name, o, gap) { var t = clock; if (sndAt[name] != null && t - sndAt[name] < (gap || 140)) return; sndAt[name] = t; if (H && H.snd) H.snd(name, o); }

  // 색 변종(variants 의 el_<속성>): config 를 읽자마자 넣어 둠 → main.js tintArt 가 한 번만 구움
  (function reg() {
    var CF = window.CFG, E = CF && CF.elMobs; if (!E || !CF.variants) return;
    Object.keys(E.els).forEach(function (k) { CF.variants['el_' + k] = E.els[k].tint; });
  })();

  // ---------- 불러오기 ----------
  function init(h) {
    H = h;
    var E = C(); if (!E || !E.on) return;
    Object.keys(E.fx).forEach(function (n) {
      var F = E.fx[n], paths = [], pv = { x: F[1], y: F[2] };
      for (var i = 1; i <= F[0]; i++) paths.push('assets/fx/elmob/' + n + '_' + (i < 10 ? '0' : '') + i + '.png');
      Assets.loadSet(paths, 1, pv).then(function (l) { if (l.length) ART[n] = { frames: l, pv: pv, fps: F[3], loop: F[4] }; });
    });
  }

  // ---------- 몹에 속성 얹기 ----------
  // 오라 크기: 몹 키 / auraRef (중간보스는 키가 커서 오라도 큼)
  function sizeOf(e) { var E = C(); return clamp((e.T.height || 30) / (E.auraRef || 34), E.sizeK[0], E.sizeK[1]); }
  function apply(e, el) {
    var E = C(), k = key(el), D = E && E.on && E.els[k];
    if (!D || !e || e.raid) return null;
    var m = e.elm = { k: k, D: D, t: 0, ph: Math.random() * 4000, sz: sizeOf(e), vis: true, dead: false, deadT: 0,
                      cd: D.dash ? rr(D.dash.firstCd) : 0, dash: null, gc: D.gust ? rr(D.gust.firstCd) : 0, pc: D.pulse ? rr(D.pulse.firstCd) : 0, shT: 0,
                      sc: D.stealth ? rr(D.stealth.cd) : 0, st: 0, walkD: 0, wc: 0, lx: e.x, ly: e.y };
    if (D.speed) e.elSpd = D.speed;
    if (D.fadeInMs) e.elA = 0;
    if (D.dash) {   // 번개 돌진: 이 몹의 update 를 감쌈(돌진 중엔 걷기 · 공격 생각을 안 함)
      var orig = e.update;
      e.update = function (dtMs, ctx) {
        var mm = this.elm;
        if (mm.dash && !(this.alive() && !this.asleep && (this.state === 'walk' || this.state === 'idle'))) mm.dash = null;
        if (mm.dash) { dashStep(this, dtMs, ctx); return; }
        orig.call(this, dtMs, ctx);
        if (this.alive()) dashThink(this, dtMs, ctx);
      };
    }
    log('apply_' + k);
    return m;
  }

  // ---------- 번개 돌진 ----------
  function dashThink(e, dt, ctx) {
    var m = e.elm, D = m.D.dash, p = ctx.player;
    if (m.cd > 0) { m.cd -= dt; return; }
    if (e.state !== 'walk' || !e.entered || e.dropZ > 0 || e.alertT > 0 || e.asleep || !p || p.state === 'dead') { m.cd = 200; return; }
    var adx = Math.abs(p.x - e.x), ady = Math.abs(p.y - e.y);
    if (adx < D.range[0] || adx > D.range[1] || ady > D.depth) { m.cd = 220; return; }
    m.dash = { ph: 'wind', t: 0, dir: p.x > e.x ? 1 : -1, tr: 0, hit: false };
    e.dir = m.dash.dir;
    log('dash');
  }
  function dashStep(e, dtMs, ctx) {
    if (e.slowT > 0) { e.slowT -= dtMs; dtMs *= e.slowK || 1; }   // 법사 얼음창에 느려짐
    var m = e.elm, D = m.D.dash, d = m.dash, p = ctx.player, dt = dtMs / 1000;
    e.clock += dtMs; if (e.flashT > 0) e.flashT -= dtMs;
    d.t += dtMs;
    if (d.ph === 'wind') {   // 지지직 모음(제자리, 몸이 번쩍)
      e.setMove(0, 0); e.animT += dtMs * 0.3;
      if (d.t >= D.windMs) { d.ph = 'go'; d.t = 0; d.dir = p.x > e.x ? 1 : -1; e.dir = d.dir; snd('dodge', { k: 1.5, v: 0.45 }); }
      e.keepInView(ctx); return;
    }
    var v = d.dir * D.speedK * e.T.speedX;
    e.x += v * dt; e.y += clamp(p.y - e.y, -1, 1) * e.T.speedY * dt;
    e.setMove(v, 0); e.animT += dtMs * 1.8;
    d.tr -= dtMs;
    if (d.tr <= 0 && ART.spark_trail) {   // 전기 잔상: 몸 앞(머리 쪽 빛이 몸에 붙게)
      d.tr = D.trailMs || 60;
      var A = ART.spark_trail, s = m.sz * 0.8;
      FX.sprite(e.x + d.dir * e.T.radius * 0.6, e.y - e.T.height * 0.42, A.frames, A.fps, A.pv, d.dir < 0, false, s, { add: true, alpha: 0.95 });
    }
    // 부딪힘: 가로 몸 + 조금, 위아래 depth 안, 높이 뛰어 있지 않음 → 감전 데미지(한 번)
    if (!d.hit && p.state !== 'dead' && Math.abs(p.x - e.x) < e.T.radius + 10 && Math.abs(p.y - e.y) < D.depth * 0.8 && (p.z || 0) < 14) {
      d.hit = true;
      if (ctx.onPlayerHit(e, { dmg: D.dmg, knock: D.knock, flinchMs: D.flinchMs })) { shockOn(p); log('dashHit'); }
      d.t = D.ms;
    }
    var out = e.x < ctx.view.x0 + 10 || e.x > ctx.view.x1 - 10;
    if (d.t >= D.ms || out) { m.dash = null; m.cd = rr(D.cd); e.cool = Math.max(e.cool, 450); e.setMove(0, 0); }
    e.keepInView(ctx);
  }

  // ---------- 플레이어 상태 ----------
  function S() { return C().status; }
  function burnOn(p, mul, stay) {
    var B = S().burn, dmg = Math.max(1, Math.round(B.dmg * (mul || 1))), ms = stay || B.ms;
    if (!p.elBurn) { p.elBurn = { t: ms, tick: 260, every: B.everyMs, dmg: dmg }; log('burnOn'); }
    else { p.elBurn.t = Math.max(p.elBurn.t, ms); p.elBurn.dmg = Math.max(p.elBurn.dmg, dmg); }
  }
  function chillOn(p, stay) {
    var B = S().chill, ms = stay || B.ms;
    if (!p.elChill) { p.elChill = { t: ms }; log('chillOn'); } else p.elChill.t = Math.max(p.elChill.t, ms);
  }
  function poisonOn(p, mul, stay) {   // 원래 있는 독(p.poison, main.js poisonStep 이 깎음)
    var B = S().poison, dmg = Math.max(1, Math.round(B.dmg * (mul || 1))), ms = stay || B.ms;
    if (!p.poison) { p.poison = { t: ms, tick: 300, every: B.everyMs, dmg: dmg }; log('poisonOn'); }
    else p.poison.t = Math.max(p.poison.t, ms);
  }
  function shockOn(p) { p.elShock = { t: S().shock.ms }; log('shock'); }
  function immune(p) { return p.state === 'dead' || p.dodgeInvT > 0 || (p.state === 'skill' && window.Skills && Skills.invulnerable(p)); }
  function statusStep(dt) {
    var p = H.G().player; if (!p) return;
    if (p.state === 'dead') { p.elBurn = p.elChill = p.elShock = null; return; }
    var B = p.elBurn;
    if (B) {
      B.t -= dt; B.tick -= dt;
      if (B.tick <= 0) {   // 불탐: 독처럼 체력 1 아래로는 안 내려감
        B.tick += B.every;
        var n = p.god ? 0 : Math.min(B.dmg, p.hp - 1);
        if (n > 0) { p.hp -= n; H.dmgText(p, n, S().burn.color); log('burnTick'); log('burnDmg', n); }
        H.debris(p.x, p.y - 46 * AS(), p.y, 4, { cols: ['#fff2a0', '#ffb040', '#ff5a1a'], glow: true, sp: 60, size: 1.3, ms: 380, g: -50, spread: 0.8 });
      }
      if (B.t <= 0) p.elBurn = null;
    }
    if (p.elChill) { p.elChill.t -= dt; if (p.elChill.t <= 0) p.elChill = null; }
    if (p.elShock) { p.elShock.t -= dt; if (p.elShock.t <= 0) p.elShock = null; }
  }
  // 걷기 · 휘두르기 배율(얼어붙음) + 몸 색(감전 > 불탐 > 얼음 > 독): main.js 가 매 장면 성장 배율을 넣은 뒤 부름
  function playerMods(p) {
    if (!C() || !p) return;
    var ST = S(), col = null, a = 0, w = clock / 1000;
    if (p.elChill) { p.moveMul *= ST.chill.move; p.atkSpd *= ST.chill.atk; }
    if (p.elShock) { col = ST.shock.color; a = 0.35 + 0.35 * (Math.floor(clock / 50) % 2); }
    else if (p.elBurn) { col = ST.burn.color; a = 0.22 + 0.12 * Math.sin(w * 9); }
    else if (p.elChill) { col = ST.chill.color; a = 0.32; }
    else if (p.poison) { col = ST.poison.color; a = 0.18 + 0.08 * Math.sin(w * 5); }
    p.stTint = col ? { color: col, a: a } : null;
  }

  // ---------- 플레이어가 속성 몹에게 맞음(main.js onPlayerHit 끝에서) ----------
  function onPlayerHit(e, spec, dmg) {
    var m = e && e.elm; if (!m || !e.alive || !e.alive()) return;
    var p = H.G().player, D = m.D, HT = D.hit || {}, mul = e.dmgMul || 1;
    if (HT.burn) burnOn(p, mul);
    if (HT.chill) chillOn(p);
    if (HT.poison) poisonOn(p, mul);
    if (HT.shock) {   // 감전: 작은 데미지 더(체력 1 아래로는 안 내려감) + 노란 번쩍
      shockOn(p);
      var n = p.god ? 0 : Math.min(Math.max(1, Math.round(rr(HT.shock.dmg) * mul)), p.hp - 1);
      if (n > 0) { p.hp -= n; H.dmgText(p, n, S().shock.color); log('shockDmg', n); }
      H.debris(p.x, p.y - 50 * AS(), p.y, 6, { cols: ['#ffffff', '#fff6a0', '#ffd23a'], glow: true, sp: 160, size: 1.2, ms: 260 });
    }
    if (HT.push) { H.push(e, HT.push); log('windPush'); }
    if (HT.drain && dmg > 0) {   // 체력 빨기: 준 데미지 x drain 만큼 회복 + 플레이어 → 몹 보라 알갱이
      var hl = Math.max(1, Math.round(dmg * HT.drain));
      e.hp = Math.min(e.maxHp, e.hp + hl); log('drain', hl);
      H.debris(p.x, p.y - 44 * AS(), p.y, 7, { cols: ['#c890ff', '#7a2cff', '#ffffff'], glow: true, sp: 90, size: 1.4, ms: 420, g: -40 });
      H.debris(e.x, e.y - e.T.height * 0.5, e.y, 6, { cols: ['#c890ff', '#a040ff'], glow: true, sp: 50, size: 1.3, ms: 380, g: -60, spread: 0.6 });
    }
  }
  // 받는 데미지(빛 보호막)
  function dmgIn(e, dmg) {
    var m = e.elm;
    if (m && m.shT > 0 && m.D.pulse) { log('shieldHit'); return Math.max(1, Math.round(dmg * m.D.pulse.shield)); }
    return dmg;
  }

  // ---------- 바닥 위험 ----------
  function addHaz(o) {
    var E = C();
    while (haz.length >= (E.hazMax || 16)) haz.shift();   // 오래된 것부터
    haz.push(o);
  }
  function hazOf(spec, kind, e, x, y) {
    if (!spec) return;
    var hs = Math.sqrt(e.elm.sz);   // 바닥 자국 크기: 몹 키를 조금만 따라감(큰 몹 = 조금 크게)
    addHaz({ kind: kind, art: spec.art, x: x, y: y, t: 0, ms: spec.ms, r: spec.r * hs, depth: spec.depth, k: (spec.k || 1) * hs,
             burn: !!spec.burn, chill: !!spec.chill, poison: !!spec.poison, mul: e.dmgMul || 1, el: e.elm.k });
  }
  function hazStep(dt) {
    var p = H.G().player;
    for (var i = haz.length - 1; i >= 0; i--) {
      var q = haz[i]; q.t += dt;
      if (q.t >= q.ms) { haz.splice(i, 1); continue; }
      if (!p || immune(p) || (q.kind === 'ground' && (p.z || 0) > 4)) continue;
      var dx = (p.x - q.x) / q.r, dy = (p.y - q.y) / Math.max(1, q.depth);
      if (dx * dx + dy * dy > 1) continue;
      var stay = 700;   // 밖으로 나와도 조금 더
      if (q.burn) burnOn(p, q.mul, stay);
      if (q.chill) chillOn(p, stay);
      if (q.poison) poisonOn(p, q.mul, stay + 300);
      q.touched = (q.touched || 0) + dt; log('haz_' + q.art, dt);
    }
  }

  // ---------- 쓰러짐 ----------
  function death(e) {
    var m = e.elm, D = m.D.death, x = e.x, y = e.y;
    if (!D) return;
    log('death_' + m.k);
    if (D.burst && ART[D.burst.art]) {
      var A = ART[D.burst.art];
      FX.sprite(x, y - e.T.height * 0.5, A.frames, A.fps, A.pv, Math.random() < 0.5, false, Math.sqrt(m.sz) * (D.burst.k || 1), { add: true });
      snd('fireBoom', { v: 0.35, k: 1.3 }, 160);
    }
    if (D.ground) hazOf(D.ground, 'ground', e, x, y);
    if (D.gas) { hazOf(D.gas, 'gas', e, x, y); log('gas'); }
  }

  // ---------- 매 장면 ----------
  function step(dt) {
    var E = C(); if (!E || !E.on || !H) return;
    clock += dt;
    var G = H.G(), p = G.player, list = G.enemies, els = [];
    for (var i = 0; i < list.length; i++) { var e = list[i]; if (e.elm) els.push(e); }
    // 오라는 가까운 auraMax 마리만(성능)
    var nAlive = 0;
    els.forEach(function (e) { if (e.alive()) nAlive++; e.elm.dd = p ? Math.abs(e.x - p.x) + Math.abs(e.y - p.y) * 2 : 0; });
    if (els.length > E.auraMax) {
      var srt = els.slice().sort(function (a, b) { return a.elm.dd - b.elm.dd; });
      srt.forEach(function (e, j) { e.elm.vis = j < E.auraMax; });
    } else els.forEach(function (e) { e.elm.vis = true; });
    LITE = nAlive > E.lite;
    els.forEach(function (e) {
      var m = e.elm, D = m.D;
      if (!e.alive()) {
        m.deadT += dt;
        if (!m.dead) { m.dead = true; m.dash = null; if (!e.dgSkip) death(e); }
        if (e.elA != null) e.elA = Math.min(1, e.elA + dt / 300);
        return;
      }
      m.t += dt;
      if (m.shT > 0) m.shT -= dt;
      // 어둠: 스르르 나타남 → 가끔 흐려짐
      if (D.fadeInMs || D.stealth) {
        var a = D.fadeInMs ? Math.min(1, m.t / D.fadeInMs) : 1, SL = D.stealth;
        if (SL && m.t > (D.fadeInMs || 0)) {
          if (m.st > 0) { m.st -= dt; var u = SL.ms - m.st, f = SL.fadeMs || 250; a = Math.min(a, 1 - (1 - SL.alpha) * Math.min(1, u / f, Math.max(0, m.st) / f)); }
          else if ((m.sc -= dt) <= 0) { m.st = SL.ms; m.sc = rr(SL.cd); log('stealth'); }
        }
        e.elA = a;
      }
      var busy = e.asleep || e.alertT > 0 || e.dropZ > 0 || !e.entered || e.state === 'down' || e.state === 'air' || e.state === 'hit';
      // 빛: 빛 퍼짐(둘레 몹 체력 + 자기 보호막)
      if (D.pulse && (m.pc -= dt) <= 0 && !busy) { m.pc = rr(D.pulse.cd); pulse(e, list); }
      // 바람: 돌풍(가까이 있으면 밀어냄)
      if (D.gust && p && (m.gc -= dt) <= 0) {
        var GU = D.gust;
        if (!busy && p.state !== 'dead' && Math.abs(p.x - e.x) < GU.range && Math.abs(p.y - e.y) < GU.depth) {
          m.gc = rr(GU.cd); H.push(e, GU.push); gusts.push({ x: e.x, y: e.y - e.T.height * 0.45, dir: p.x > e.x ? 1 : -1, t: 0 });
          snd('dodge', { k: 0.7, v: 0.4 }); log('gust');
        } else m.gc = 250;
      }
      // 독: 걷다가 가끔 독 웅덩이
      if (D.walk) {
        if (m.wc > 0) m.wc -= dt;
        if (e.state === 'walk') m.walkD += Math.abs(e.x - m.lx) + Math.abs(e.y - m.ly);
        m.lx = e.x; m.ly = e.y;
        if (m.walkD >= D.walk.every && m.wc <= 0) {
          m.walkD = 0;
          if (Math.random() < D.walk.chance && e.entered) { m.wc = D.walk.cd; hazOf(D.walk, 'ground', e, e.x, e.y); log('walkPuddle'); }
        }
      }
    });
    hazStep(dt);
    statusStep(dt);
    for (var r = rings.length - 1; r >= 0; r--) { rings[r].t += dt; if (rings[r].t > 520) rings.splice(r, 1); }
    for (var g = gusts.length - 1; g >= 0; g--) { gusts[g].t += dt; if (gusts[g].t > 360) gusts.splice(g, 1); }
  }
  var LITE = false;
  function pulse(e, list) {
    var P = e.elm.D.pulse, n = 0;
    e.elm.shT = P.shieldMs;
    list.forEach(function (o) {
      if (!o.alive() || o.raid || (o.T && o.T.boss) || Math.abs(o.x - e.x) > P.r || Math.abs(o.y - e.y) > P.depth || o.hp >= o.maxHp) return;
      var hl = Math.max(1, Math.round(o.maxHp * P.heal)); o.hp = Math.min(o.maxHp, o.hp + hl); n++; log('heal', hl);
      H.debris(o.x, o.y - o.T.height * 0.5, o.y, 5, { cols: ['#ffffff', '#e8f0ff', '#c8d8f0'], glow: true, sp: 40, size: 1.3, ms: 520, g: -50, spread: 0.6 });
    });
    rings.push({ x: e.x, y: e.y, t: 0, r: P.r });
    snd('orb', { v: 0.35, k: 0.8 }, 220);
    log('pulse'); log('healed', n);
  }

  // ---------- 그리기: 몹 오라(enemies.js Enemy.draw 안에서 몸 뒤 'back' · 몸 앞 'front') ----------
  function frameOf(A, t, ph) { var n = A.frames.length, i = Math.floor((t + ph) * A.fps / 1000); return A.frames[A.loop ? i % n : Math.min(n - 1, i)]; }
  function blitK(g, A, img, x, y, k, a, add, flip) {
    if (!img || a <= 0) return;
    g.save(); g.translate(x, y); g.scale(flip ? -k : k, k);
    g.globalAlpha = a; if (add) g.globalCompositeOperation = 'lighter';
    Assets.blit(g, img, A.pv.x, A.pv.y);
    g.restore();
  }
  function draw(e, g, x, yb, yg, layer, alpha) {
    var m = e.elm; if (!m || !m.vis || !H) return;
    var a = alpha * (e.alive() ? 1 : Math.max(0, 1 - m.deadT / 320));
    if (a <= 0.01) return;
    var A = m.D.aura, T = e.T, h = T.height, s = m.sz;
    if (A.art) {
      var AR = ART[A.art];
      if (layer === 'back' && AR) blitK(g, AR, frameOf(AR, e.clock, m.ph), x, A.ground ? yg : yb, s * (A.k || 1), A.alpha * a, A.add, false);
      if (A.bubbles && layer === 'front') bubbles(g, e, x, yb, a, A.bubbles);
    } else if (A.code === 'bolts') bolts(g, e, x, yb, layer, a, A);
    else if (A.code === 'braid') braid(g, e, x, yb, layer, a, A);
    // 빛 보호막: 몸 앞 은빛 테두리 타원(깜빡임)
    if (layer === 'front' && m.shT > 0) {
      var P = m.D.pulse, u = m.shT / P.shieldMs, rx = Math.max(T.radius * 1.3, h * 0.5), ry = h * 0.62;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * (0.35 + 0.25 * Math.sin(clock / 60)) * Math.min(1, u * 4);
      g.strokeStyle = '#f4f8ff'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, yb - ry * 0.95, rx, ry, 0, 0, Math.PI * 2); g.stroke();
      g.globalAlpha *= 0.16; g.fillStyle = '#dfe8ff'; g.fill(); g.restore();
    }
  }
  // 번개(형님: 그림 말고 코드로): 세로 일자 번개 n 줄이 몸 둘레를 돌며 지지직. 뒤쪽 반(sin < 0)은 몸 뒤에 흐리게, 앞쪽 반은 몸 앞에
  function bolts(g, e, x, yb, layer, a, A) {
    var m = e.elm, T = e.T, h = T.height * (A.hK || 1), rx = Math.max(T.radius * 1.2, T.height * A.rx), n = LITE ? Math.max(2, A.bolts - 1) : A.bolts;
    var wind = m.dash && m.dash.ph === 'wind', go = m.dash && m.dash.ph === 'go', spin = A.spin * (wind ? 0.35 : go ? 0.6 : 1);
    var th0 = (e.clock + m.ph) / spin * Math.PI * 2, bucket = Math.floor((e.clock + m.ph) / 70);
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
    for (var i = 0; i < n; i++) {
      var th = th0 + i * Math.PI * 2 / n, sn = Math.sin(th), front = sn > 0;
      if ((layer === 'front') !== front) continue;
      if (hash(bucket, i * 7.1 + m.ph) < 0.14 && !wind) continue;   // 가끔 꺼짐(지지직)
      var bx = x + Math.cos(th) * rx, y0 = yb - 2, y1 = yb - h, segs = 6, fl = 0.65 + 0.35 * hash(bucket + 3, i);
      var aa = a * fl * (front ? 1 : 0.5) * (wind ? 1.3 : 1);
      g.beginPath();
      for (var j = 0; j <= segs; j++) {
        var yy = y0 + (y1 - y0) * j / segs, jx = j === 0 || j === segs ? 0 : (hash(bucket * 3 + j, i + 0.37) * 2 - 1) * 2.6;
        if (j === 0) g.moveTo(bx + jx, yy); else g.lineTo(bx + jx, yy);
      }
      g.globalAlpha = Math.min(1, aa * 0.55); g.strokeStyle = A.glow; g.lineWidth = 3; g.stroke();
      g.globalAlpha = Math.min(1, aa); g.strokeStyle = A.color; g.lineWidth = 1; g.stroke();
      if (hash(bucket + 9, i) < 0.5) {   // 끝 불똥
        g.fillStyle = '#ffffff'; g.globalAlpha = Math.min(1, aa);
        g.fillRect(Math.round(bx + (hash(bucket, i + 5) * 2 - 1) * 4), Math.round(y1 - 1 + hash(bucket, i + 2) * 3), 1, 1);
        g.fillRect(Math.round(bx + (hash(bucket, i + 6) * 2 - 1) * 4), Math.round(y0 - hash(bucket, i + 4) * 3), 1, 1);
      }
    }
    g.restore();
  }
  // 바람(형님: 회오리 말고, 밑에서 위로 몸 둘레를 꽈배기처럼 감아 올라가는 반투명 줄기, 진하지 않게): 나선(helix)을 돌리면 위로 흐르는 것처럼 보임
  function braid(g, e, x, yb, layer, a, A) {
    var m = e.elm, T = e.T, h = T.height * (A.hK || 1), rx0 = Math.max(T.radius * 1.15, T.height * A.rx);
    var ns = LITE ? Math.max(2, A.strands - 1) : A.strands, seg = LITE ? 10 : 16, tt = (e.clock + m.ph) / A.rise;
    g.save(); g.lineCap = 'round';
    for (var i = 0; i < ns; i++) {
      var ph = i * Math.PI * 2 / ns;
      for (var j = 0; j < seg; j++) {
        var s0 = j / seg, s1 = (j + 1) / seg, sm = (s0 + s1) / 2;
        var vis = ((sm * 1.6 - tt * 1.3 + i * 0.33) % 1 + 1) % 1;   // 줄기 조각이 위로 흘러감
        if (vis > (A.show || 0.62)) continue;
        var t0 = s0 * A.turns * Math.PI * 2 + ph + tt * Math.PI * 2, t1 = s1 * A.turns * Math.PI * 2 + ph + tt * Math.PI * 2;
        var front = Math.sin((t0 + t1) / 2) > 0;
        if ((layer === 'front') !== front) continue;
        var r0 = rx0 * (0.92 + 0.16 * Math.sin(Math.PI * s0)), r1 = rx0 * (0.92 + 0.16 * Math.sin(Math.PI * s1));
        var fade = Math.sin(Math.PI * sm) * (1 - vis / (A.show || 0.62) * 0.5);
        g.globalAlpha = Math.min(1, a * A.alpha * fade * (front ? 1 : 0.55));
        g.strokeStyle = 'rgb(' + A.color + ')'; g.lineWidth = front ? 1.5 : 1;
        g.beginPath(); g.moveTo(x + Math.cos(t0) * r0, yb - s0 * h); g.lineTo(x + Math.cos(t1) * r1, yb - s1 * h); g.stroke();
      }
    }
    g.restore();
  }
  // 독: 몸에서 올라가는 작은 거품(앞)
  function bubbles(g, e, x, yb, a, n) {
    var m = e.elm, h = e.T.height;
    g.save();
    for (var i = 0; i < n; i++) {
      var P = 1100, v = ((e.clock + m.ph + i * P / n) % P) / P, sx = (hash(i, Math.floor((e.clock + m.ph + i * P / n) / P)) * 2 - 1) * e.T.radius;
      g.globalAlpha = a * 0.7 * Math.sin(Math.PI * v);
      g.fillStyle = v > 0.8 ? '#e8ffb0' : '#8cff3a';
      var r = v > 0.8 ? 2 : 1;
      g.fillRect(Math.round(x + sx), Math.round(yb - h * (0.15 + 0.8 * v)), r, r);
    }
    g.restore();
  }

  // ---------- 바닥 자국 · 빛 고리(캐릭터 밑) ----------
  function drawUnder(g, camX) {
    if (!H) return;
    haz.forEach(function (q) {
      if (q.kind !== 'ground') return;
      var A = ART[q.art], x = Math.round(q.x - camX), y = Math.round(q.y), a = Math.min(1, q.t / 150, (q.ms - q.t) / 500);
      if (!A) { g.save(); g.globalAlpha = 0.5 * a; g.fillStyle = q.burn ? '#ff7a2a' : q.chill ? '#9fe0ff' : '#8cff3a'; g.beginPath(); g.ellipse(x, y, q.r, q.depth, 0, 0, Math.PI * 2); g.fill(); g.restore(); return; }
      var n = A.frames.length, i = Math.floor(q.t * A.fps / 1000), img;
      if (A.loop) img = A.frames[i % n];
      else img = A.frames[i < n - 1 ? i : n - 2 + (i - (n - 1)) % 2];   // 빙결 장판: 1~3 자라남 → 3 · 4 번갈아
      blitK(g, A, img, x, y, q.k, a * (q.burn ? 0.95 : 0.9), q.burn, false);
    });
    rings.forEach(function (r) {   // 빛 퍼짐: 발밑에서 퍼지는 은빛 고리
      var u = r.t / 520, rx = 8 + (r.r - 8) * (1 - (1 - u) * (1 - u));
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.6 * (1 - u);
      g.strokeStyle = '#f0f6ff'; g.lineWidth = 2; g.beginPath(); g.ellipse(Math.round(r.x - camX), Math.round(r.y), rx, rx * 0.32, 0, 0, Math.PI * 2); g.stroke(); g.restore();
    });
  }
  // ---------- 공중(캐릭터 위): 독가스 · 돌풍 줄기 · 플레이어 상태 표시 ----------
  function drawOver(g, camX) {
    if (!H) return;
    haz.forEach(function (q) {
      if (q.kind !== 'gas') return;
      var A = ART[q.art]; if (!A) return;
      var x = Math.round(q.x - camX), y = Math.round(q.y - 20 * q.k), n = A.frames.length, i = Math.floor(q.t * A.fps / 1000);
      var img = A.frames[i < n ? i : n - 2 + Math.floor((q.t - n * 1000 / A.fps) / 220) % 2];
      var a = Math.min(1, (q.ms - q.t) / 700), k = q.k * (1 + 0.25 * Math.min(1, q.t / q.ms));
      blitK(g, A, img, x, y, k, a * 0.85, false, false);
    });
    gusts.forEach(function (q) {   // 돌풍: 몹에서 플레이어 쪽으로 흩어지는 흐린 바람 줄
      var u = q.t / 360;
      g.save(); g.strokeStyle = 'rgba(235,255,248,1)'; g.lineWidth = 1.2; g.lineCap = 'round';
      for (var i = 0; i < 4; i++) {
        var oy = (i - 1.5) * 7, x0 = q.x - camX + q.dir * (6 + u * 46 + i * 3), len = 14 + 8 * (1 - u);
        g.globalAlpha = 0.45 * (1 - u);
        g.beginPath(); g.moveTo(x0, q.y + oy); g.quadraticCurveTo(x0 + q.dir * len * 0.5, q.y + oy - 3, x0 + q.dir * len, q.y + oy + 1); g.stroke();
      }
      g.restore();
    });
    drawIcons(g, camX);
  }
  // 플레이어 머리 위 상태 표시(7x7 도트 그림 + 남은 시간 막대)
  var ICON = {
    burn:   { col: '#ff7a2a', hi: '#fff0a0', px: ['...#...', '..##...', '..###..', '.#####.', '.##o##.', '##ooo##', '.#ooo#.'] },
    chill:  { col: '#9fe4ff', hi: '#ffffff', px: ['...#...', '.#.#.#.', '..#o#..', '##ooo##', '..#o#..', '.#.#.#.', '...#...'] },
    poison: { col: '#7ae03a', hi: '#e0ffb0', px: ['...#...', '..###..', '.##o##.', '.#ooo#.', '#######', '#######', '.#####.'] },
    shock:  { col: '#ffe14a', hi: '#ffffff', px: ['....##.', '...##..', '..##...', '.#####.', '...##..', '..##...', '.##....'] }
  };
  function drawIcons(g, camX) {
    var p = H.G().player; if (!p || p.state === 'dead') return;
    var ST = S(), list = [];
    if (p.elBurn) list.push(['burn', p.elBurn.t / ST.burn.ms]);
    if (p.elChill) list.push(['chill', p.elChill.t / ST.chill.ms]);
    if (p.poison) list.push(['poison', p.poison.t / Math.max(1, ST.poison.ms)]);
    if (p.elShock) list.push(['shock', p.elShock.t / ST.shock.ms]);
    if (!list.length) return;
    var w = 10, x0 = Math.round(p.x - camX - list.length * w / 2), y0 = Math.round(p.y - (p.z || 0) - 104 * AS());
    g.save();
    list.forEach(function (it, n) {
      var I = ICON[it[0]], x = x0 + n * w, u = clamp(it[1], 0, 1);
      g.globalAlpha = 0.8; g.fillStyle = '#140a14'; g.fillRect(x, y0, 9, 11);
      g.globalAlpha = 1;
      for (var r = 0; r < 7; r++) for (var c = 0; c < 7; c++) {
        var ch = I.px[r][c]; if (ch === '.') continue;
        g.fillStyle = ch === 'o' ? I.hi : I.col; g.fillRect(x + 1 + c, y0 + 1 + r, 1, 1);
      }
      g.fillStyle = '#3a2a3a'; g.fillRect(x + 1, y0 + 9, 7, 1);
      g.fillStyle = I.col; g.fillRect(x + 1, y0 + 9, Math.max(1, Math.round(7 * u)), 1);
    });
    g.restore();
  }

  function reset() {
    haz = []; rings = []; gusts = [];
    var p = H && H.G().player; if (p) { p.elBurn = p.elChill = p.elShock = null; p.stTint = null; }
  }

  window.ElMob = {
    init: init, apply: apply, key: key, step: step, draw: draw, drawUnder: drawUnder, drawOver: drawOver,
    onPlayerHit: onPlayerHit, dmgIn: dmgIn, playerMods: playerMods, reset: reset,
    els: function () { return Object.keys(C().els); },
    log: function (on) { if (on === true) { LOG = {}; return true; } if (on === false) { var l = LOG; LOG = null; return l; } return LOG; },
    state: function () {
      var G = H.G(), list = G.enemies.filter(function (e) { return e.elm; });
      return { mobs: list.length, alive: list.filter(function (e) { return e.alive(); }).length, vis: list.filter(function (e) { return e.elm.vis; }).length, lite: LITE,
        haz: haz.map(function (q) { return q.art + '@' + Math.round(q.x) + ',' + Math.round(q.y) + ':' + Math.round(q.t); }), art: Object.keys(ART).length,
        p: (function (p) { return { burn: p.elBurn ? Math.round(p.elBurn.t) : 0, chill: p.elChill ? Math.round(p.elChill.t) : 0, poison: p.poison ? Math.round(p.poison.t) : 0, shock: p.elShock ? Math.round(p.elShock.t) : 0, moveMul: p.moveMul, hp: p.hp }; })(G.player) };
    }
  };
})();
