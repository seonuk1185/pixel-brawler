// 암살자(2026-11-09): 쌍단검 평타 효과 · 암살자 기술 · 늘 켜진 기술 · 독 · 2차 갈래 덤 · 단검 강화 빛
//   수치 = config.js 의 ASSASSIN(평타) · ASSASSIN_SKILLS(기술 asn) · SKILL_TREE.assassin(늘 켜진 기술) · BRANCH_FX.assassin(갈래 덤)
//   효과 그림 = 전부 AI 도트 그림(art/skill-fx/as_* · sw_* · ps_*, 게임 = assets/fx/aifx). 코드로 그리는 건 작은 빛 알갱이 · 둥근 빛 · 분신(내 그림을 물들인 것)뿐
//   skills.js 가 부르는 곳: Assassin.step(기술 진행, d.asn) · update · drawUnder · drawOver · clear · hidden
//   main.js 가 부르는 곳: swingFx(평타 효과 type 'aifx') · critAdd · critDmg · dmgMul · onHit
//   궁수(js/archer.js)와 같은 짜임 — 날아가는 것(단검 · 독침 · 그림자 물결)은 shoot(), 시간이 흐르는 효과는 fxs
(function () {
  var A = null;
  function api() { return A || (A = window.Skills && Skills._api); }
  function H() { return api().H(); }
  function CFG() { return window.CFG; }
  function AS() { return (CFG() && CFG().actorScale) || 1; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(u) { return 1 - (1 - u) * (1 - u); }
  function snd(n, o) { if (window.SFX) SFX.play(n, o); }

  // ---- AI 그림 묶음(togame.py 가 찍은 표: n = 장 수, pv = 기준점(1배 도트), fps) ----
  var AFX = {
    as_slash_slash: { n: 4, pv: [30.5, 28.0], fps: 20 },  as_slash_cross: { n: 4, pv: [31.5, 30.0], fps: 18 },  as_slash_spin: { n: 4, pv: [65.0, 33.0], fps: 18 },
    as_dash_trail:  { n: 4, pv: [150, 26.5], fps: 16 },   as_dash_puff:   { n: 4, pv: [33.0, 28.0], fps: 16 },  as_dash_cut:   { n: 4, pv: [65.0, 48.5], fps: 18 },
    as_knife_fly:   { n: 2, pv: [28, 3.0], fps: 12 },     as_knife_ghost: { n: 2, pv: [30, 9.0], fps: 10 },     as_knife_hit:  { n: 4, pv: [19.5, 18.0], fps: 20 },
    as_knife_bomb:  { n: 2, pv: [4.0, 6.0], fps: 10 },    as_knife_mark:  { n: 2, pv: [12.5, 13.0], fps: 6 },   as_knife_boom: { n: 4, pv: [55.0, 64], fps: 12 },
    as_whirl_tornado: { n: 4, pv: [43.5, 110], fps: 14 }, as_whirl_burst: { n: 4, pv: [75.0, 57.5], fps: 14 }, as_whirl_echo: { n: 4, pv: [35.5, 30.0], fps: 18 },
    sw_slash_slash: { n: 4, pv: [31.5, 30.0], fps: 20 },  sw_slash_cross: { n: 4, pv: [54.5, 38.0], fps: 18 },  sw_slash_wave: { n: 4, pv: [142, 40.0], fps: 14 },
    sw_slash_rise:  { n: 4, pv: [66.5, 92], fps: 14 },
    sw_ult_moon:    { n: 4, pv: [105.0, 65.0], fps: 14 }, sw_ult_burst:   { n: 4, pv: [60.0, 40.0], fps: 14 },  sw_ult_blade:  { n: 4, pv: [8.0, 64], fps: 14 },
    sw_ult_impact:  { n: 4, pv: [50.0, 45], fps: 16 },
    ps_dart_dart:   { n: 2, pv: [24, 4.0], fps: 12 },     ps_dart_vial:   { n: 2, pv: [8.0, 8.0], fps: 10 },    ps_dart_splash: { n: 4, pv: [34.0, 20.0], fps: 18 },
    ps_dart_bubble: { n: 4, pv: [11.0, 12.0], fps: 8 },   ps_dart_shatter:{ n: 4, pv: [36.0, 37], fps: 14 },
    ps_cloud_cloud: { n: 4, pv: [75.0, 78], fps: 8 },     ps_cloud_puff:  { n: 4, pv: [75.0, 81], fps: 10 },    ps_cloud_pool: { n: 4, pv: [60.0, 49], fps: 8 },
    ps_cloud_erupt: { n: 4, pv: [89.0, 170], fps: 12 }
  };
  // 갈래 그림(assassin_brfx.py): 1차 그림을 a = 짙은 남색 · b = 독초록으로 다시 칠함. 같은 장 수 · 기준점, 처음 쓰일 때 불러옴(br)
  var BRG = ['as_slash_slash', 'as_slash_cross', 'as_slash_spin', 'as_dash_trail', 'as_dash_puff', 'as_dash_cut', 'as_knife_fly', 'as_knife_hit', 'as_knife_boom',
             'as_whirl_tornado', 'as_whirl_burst'];
  (function reg() {
    var S = window.Skills && Skills._api;
    if (!S) return;
    var m = {}; Object.keys(AFX).forEach(function (g) { m[g] = AFX[g]; });
    BRG.forEach(function (g) { ['a', 'b'].forEach(function (b) { var o = {}, k; for (k in AFX[g]) o[k] = AFX[g][k]; o.br = 1; m[g + '_' + b] = o; }); });
    S.addAifx(m);
  })();

  var brNow = null;   // 지금 갈래(2차 Lv 전 = null)
  // 1차 그림 → 갈래 그림(읽혔으면). force = 평타처럼 기술이 아니어도 갈래 색
  function g(name, on) { if (!on || !brNow || BRG.indexOf(name) < 0) return name; var v = name + '_' + brNow; return api().aiOk(v) ? v : name; }
  function spawn(name, x, y, o) { return api().aiSpawn(name, x, y, o); }
  function aiDraw(ctx, name, i, x, y, sx, sy, rot, a) { var P = api(); if (!P.aiOk(name)) return false; return P.aiDraw(ctx, name, i, x, y, sx, sy, rot, a); }
  function glow(x, y, r, c, ms, a) { api().glow(x, y, r, c, ms, a); }
  function debris(x, y, f, n, o) { api().debris(x, y, f, n, o); }
  function wave(x, y, r, o) { api().wave(x, y, r, o); }
  function stOf(h, d) { return api().stOf(h, d); }

  // ---- 대상 ----
  function alive(t) { return !!t && (!t.alive || t.alive()); }
  function foes(st) { var h = H(); return h.targets().filter(function (t) { return t && !t.isProp && alive(t) && (!st || h.canHit(t, st)); }); }
  function boss(t) { return !!(t && t.T && (t.T.boss || t.mid || t.raid)); }
  function pullable(t) { return !!(t && !t.isProp && t.T && !boss(t) && alive(t)); }
  function near(p, R, D, ahead) {
    var L = foes().filter(function (t) { var dx = (t.x - p.x) * p.dir; return (ahead ? dx > -10 : true) && Math.abs(t.x - p.x) <= R && Math.abs(t.y - p.y) <= D; });
    L.sort(function (a, b) { return Math.abs(a.x - p.x) + Math.abs(a.y - p.y) * 0.5 - (Math.abs(b.x - p.x) + Math.abs(b.y - p.y) * 0.5); });
    return L;
  }
  function onScreen(p, t) { return Math.abs(t.x - p.x) < 300; }
  function mid(t) { var hb = t.hurtbox(); return (hb.y0 + hb.y1) / 2; }
  function hitT(st, t, x, y, dir, mul) {
    var h = H(); if (!h.canHit(t, st)) return false;
    h.onHit(st, t, { dir: dir, wk: 'dagger', x: x, y: y, mul: mul || 1 });
    return true;
  }
  function inBox(t, x, z, R, D) { var hb = t.hurtbox(); return Math.abs(hb.z - z) <= D && hb.x1 >= x - R && hb.x0 <= x + R; }
  function hitArea(st, x, z, R, D, mul, done, cb) {
    var n = 0;
    foes(st).forEach(function (t) {
      var id = t.id || 'dummy'; if (done && done[id]) return;
      if (!inBox(t, x, z, R, D)) return;
      if (done) done[id] = true;
      var hb = t.hurtbox();
      if (hitT(st, t, clamp(x, hb.x0, hb.x1), (hb.y0 + hb.y1) / 2, Math.abs(t.x - x) < 3 ? 1 : (t.x > x ? 1 : -1), mul)) n++;
      if (cb) cb(t);
    });
    H().targets().forEach(function (t) {   // 소품(상자 · 통)도
      if (!t || !t.isProp || (done && done[t.id])) return;
      if (!inBox(t, x, z, R, D)) return;
      if (done) done[t.id] = true;
      hitT(st, t, x, z - 20, t.x > x ? 1 : -1, mul);
    });
    return n;
  }
  function pas(p, id) { var P = api(); return P && P.pasOf ? P.pasOf(p, id) : null; }
  function ft(d, k) { var m = d.frameMs || [], s = 0; for (var i = 0; i < k && i < m.length; i++) s += m[i]; return s; }   // 기술 시작부터 k 번째 장까지 ms

  // ---------- 날아가는 것(던진 단검 · 독침 · 그림자 물결 · 유령 단검) ----------
  //   a = { x, y(화면 높이), z(걷는 줄), dir, vx, vy, vz, range, w, h, depth, pierce, st, mul, art, sx, sy, home, turn, onHit(a, t), onEnd(a, t), spin, hitArt, fade }
  var shots = [];
  function shoot(o) {
    o.trav = 0; o.t = 0; o.done = {}; o.dead = false; o.w = o.w || 20; o.h = o.h || 12; o.depth = o.depth || 18; o.sx = o.sx || 1;
    if (o.vx == null) o.vx = o.speed * o.dir; if (o.vy == null) o.vy = 0;
    shots.push(o); return o;
  }
  function shotStep(a, dt) {
    var sp = Math.hypot(a.vx, a.vy), move = sp * dt / 1000, steps = Math.max(1, Math.ceil(move / 7));
    for (var s = 0; s < steps && !a.dead; s++) {
      if (a.home && alive(a.home)) {
        var tx = a.home.x, ty = mid(a.home), ang = Math.atan2(ty - a.y, tx - a.x), cur = Math.atan2(a.vy, a.vx);
        var da = ((ang - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI, turn = (a.turn || 9) * dt / 1000 / steps;
        cur += clamp(da, -turn, turn); a.vx = Math.cos(cur) * sp; a.vy = Math.sin(cur) * sp; a.z += (a.home.y - a.z) * Math.min(1, 6 * dt / 1000 / steps);
      }
      var m = move / steps;
      a.x += a.vx / sp * m; a.y += a.vy / sp * m; a.trav += m;
      if (a.vz) { a.z += a.vz * dt / 1000 / steps; a.y += a.vz * dt / 1000 / steps; }
      var hw = a.w / 2, cx = a.x - Math.sign(a.vx || a.dir) * hw * 0.5, hit = null, best = 1e9;
      H().targets().forEach(function (t) {
        if (!t || a.done[t.id || 'dummy'] || !H().canHit(t, a.st)) return;
        var hb = t.hurtbox();
        if (Math.abs(hb.z - a.z) > a.depth || hb.x0 > cx + hw || hb.x1 < cx - hw || hb.y0 > a.y + a.h / 2 || hb.y1 < a.y - a.h / 2) return;
        var d = (t.x - a.x) * Math.sign(a.vx || a.dir);
        if (d < best) { best = d; hit = t; }
      });
      if (hit) {
        a.done[hit.id || 'dummy'] = true;
        if (a.onHit) a.onHit(a, hit); else shotHit(a, hit);
        if (a.pierce-- <= 0) { a.dead = true; if (a.onEnd) a.onEnd(a, hit); }
      }
      if (!a.dead && a.trav >= a.range) { a.dead = true; if (a.onEnd) a.onEnd(a, null); }
    }
    a.t += dt;
  }
  function shotHit(a, t) {
    var hb = t.hurtbox(), x = clamp(a.x, hb.x0, hb.x1), y = clamp(a.y, hb.y0 + 2, hb.y1 - 2), dir = Math.sign(a.vx || a.dir);
    hitT(a.st, t, x, y, dir, a.mul);
    if (a.hitArt) spawn(a.hitArt, x, y, { sx: (a.hitSx || 0.7) * (0.9 + Math.random() * 0.2), dir: dir });
  }
  function drawShot(ctx, camX, a) {
    var F = AFX[a.art.replace(/_[ab]$/, '')] || AFX.as_knife_fly, i = Math.floor(a.t * F.fps / 1000) % F.n, d = a.vx < 0 ? -1 : 1;
    var rot = a.spin ? a.t / 1000 * a.spin : Math.atan2(a.vy, Math.abs(a.vx)) * d;
    var fade = a.fade && a.range - a.trav < a.fade ? Math.max(0, (a.range - a.trav) / a.fade) : 1;
    aiDraw(ctx, a.art, i, a.x - camX, a.y, a.sx * d, a.sy || a.sx, rot, fade * (a.alpha || 1));
  }

  // ---------- 평타 효과(main.js swingFx 의 type 'aifx') ----------
  function swingFx(p, st0, sfx) {
    var k = (sfx.sx || 1), x = p.x + p.dir * (sfx.x || 0), y = p.y - (p.z || 0) + (sfx.y || 0);
    var name = g(sfx.g, true);
    if (p.awk) name = sfx.g;   // 각성 중 = 진홍 그대로
    spawn(name, x, y, { sx: k, sy: sfx.sy || k, dir: p.dir, rot: (sfx.rot || 0) * Math.PI / 180 });
  }

  // ---------- 기술 (skills.js advance → step) ----------
  var fxs = [];
  var hideUntil = 0, hideOn = false;   // 순간이동 · 그림자 난무 중 몸 숨김(skills.js hidden)
  function step(p, d, s, t0, t1) {
    var C = d.asn;
    if (!s.asn) s.asn = { fired: 0 };
    var S = s.asn;
    var K = KIND[C.kind];
    if (K) K(p, d, s, C, S, t0, t1);
  }
  function lv5(s, k, def) { return s.L && s.L.lv5 && s.L.lv5[k] != null ? s.L.lv5[k] : def; }
  function brOn(s) { return !!s.br; }
  var KIND = {
    // 그림자 습격: 돌진 동안 몸 뒤 그림자 줄 · 끝 베기 장에 큰 베기 그림 (판정 = config hits)
    dash: function (p, d, s, C, S, t0, t1) {
      if (!S.fired && t1 >= C.at) {
        S.fired = 1;
        spawn(g('as_dash_trail', brOn(s)), 0, 0, { follow: p, ox: -6 * AS() / 0.55, oy: -34 * AS() / 0.55, sx: 0.95, layer: 'back', life: 300, fade: 120 });
      }
      if (!S.cut && t1 >= ft(d, 4)) {
        S.cut = true;
        spawn(g('as_dash_cut', brOn(s)), p.x + p.dir * 36 * AS() / 0.55, p.y - 36 * AS() / 0.55, { sx: 0.8, dir: p.dir });
      }
    },
    // 칼날 올려치기: 위로 베어 올리는 큰 초승달(판정 = config hits)
    rise: function (p, d, s, C, S, t0, t1) {
      if (S.fired || t1 < C.at) return; S.fired = 1;
      var k = s.area || 1;
      spawn(g('as_slash_slash', brOn(s)), p.x + p.dir * 34 * AS() / 0.55, p.y - 44 * AS() / 0.55, { sx: 1.25 * k, dir: p.dir, rot: -1.1 });
      spawn(g('as_slash_slash', brOn(s)), p.x + p.dir * 44 * AS() / 0.55, p.y - 54 * AS() / 0.55, { sx: 1.0 * k, dir: p.dir, rot: -1.4, delay: 50 });
    },
    // 단검 부채 · 독침 부채: n 자루가 위아래(줄)로 퍼짐
    fan: function (p, d, s, C, S, t0, t1) { if (S.fired || t1 < C.at) return; S.fired = 1; fanThrow(p, d, s, C, lv5(s, 'n', C.n), 'as_knife_fly', 'as_knife_hit'); snd('daggerThrow'); },
    darts: function (p, d, s, C, S, t0, t1) { if (S.fired || t1 < C.at) return; S.fired = 1; fanThrow(p, d, s, C, lv5(s, 'n', C.n), 'ps_dart_dart', 'ps_dart_splash'); snd('daggerThrow'); snd('poison', { v: 0.6 }); },
    // 칼날 회오리: 몸을 따라다니는 회오리(끌어당김 + 여러 번) → 터짐
    whirl: function (p, d, s, C, S, t0, t1) {
      if (S.fired || t1 < C.at) return; S.fired = 1;
      var k = s.area || 1;
      fxs.push({ kind: 'whirl', p: p, d: d, C: C, k: k, t: 0, tick: 0, mul: s.mul, br: brOn(s), st: stOf(C.hit, d), last: stOf(C.last, d), lv: s.L.lv,
                 fx: spawn(g('as_whirl_tornado', brOn(s)), 0, 0, { follow: p, ox: 0, oy: 4, sx: 0.85 * k, loop: true, life: C.ms, fade: 120 }) });
      snd('skSpin');
    },
    // 그림자 걸음: 연기로 사라짐 → 가장 가까운 적 등 뒤 → 등 찌르기(늘 치명타) + 둘레
    blink: function (p, d, s, C, S, t0, t1) {
      if (!S.fired && t1 >= C.at) {
        S.fired = 1;
        var L = near(p, C.aim.range, C.aim.depth, false), t = L[0] || null;
        S.t = t;
        spawn(g('as_dash_puff', brOn(s)), p.x, p.y - 30 * AS() / 0.55, { sx: 1.0, dir: p.dir });
        api().addGhost(p, { color: brOn(s) ? s.br.color : '#ff5a6a', lifeMs: 260, alpha: 0.5 });
        hideOn = true; S.hideEnd = C.at + C.hideMs;
        if (t) { var side = t.x >= p.x ? 1 : -1; p.x = t.x + side * C.behind * AS() / 0.55; p.y = t.y; p.dir = -side; }
        else p.x += p.dir * 110 * AS() / 0.55;
        snd('blink');
      }
      if (S.fired === 1 && t1 >= S.hideEnd) {
        S.fired = 2; hideOn = false;
        spawn(g('as_dash_puff', brOn(s)), p.x, p.y - 30 * AS() / 0.55, { sx: 0.8, dir: p.dir });
      }
      if (S.fired === 2 && t1 >= S.hideEnd + 70) {
        S.fired = 3;
        var k = s.area || 1, st = stOf(C.hit, d), t2 = S.t && alive(S.t) ? S.t : null, done = {};
        spawn(g('as_dash_cut', brOn(s)), p.x + p.dir * 30 * AS() / 0.55, p.y - 34 * AS() / 0.55, { sx: 0.95, dir: p.dir });
        if (t2) { done[t2.id || 'dummy'] = true; hitT(st, t2, t2.x, mid(t2), p.dir, s.mul); spawn(g('as_knife_hit', brOn(s)), t2.x, mid(t2), { sx: 1.3 }); }
        hitArea(stOf(C.area, d), p.x + p.dir * 30 * AS() / 0.55, p.y, C.r * k, C.depth, s.mul, done);
        api().doFlash({ color: '#ffe0e4', alpha: 0.25, ms: 100 });
        snd('skDash');
      }
    },
    // 연막탄 · 독구름: 앞쪽(가까운 적)으로 던져 터짐 → 남는 연기/구름
    smoke: function (p, d, s, C, S, t0, t1) { if (S.fired || t1 < C.at) return; S.fired = 1; lob(p, d, s, C, 'smoke'); },
    cloud: function (p, d, s, C, S, t0, t1) { if (S.fired || t1 < C.at) return; S.fired = 1; lob(p, d, s, C, 'cloud'); },
    pools: function (p, d, s, C, S, t0, t1) {
      if (S.fired || t1 < C.at) return; S.fired = 1;
      var n = lv5(s, 'n', C.n);
      for (var i = 0; i < n; i++) {
        var x = p.x + p.dir * C.xs[i] * AS() / 0.55, z = p.y + ((i % 2) ? 12 : -10) * AS() / 0.55;
        fxs.push({ kind: 'vial', p: p, x0: p.x + p.dir * 20, y0: p.y - 60 * AS() / 0.55, x: x, z: z, t: -i * 70, fly: C.flyMs, then: 'pool', d: d, C: C, k: s.area || 1, mul: s.mul, lv: s.L.lv });
      }
      snd('daggerThrow');
    },
    // 그림자 분신: 분신 n 이 둘레 적에게 뛰어들어 벰 → 끝에 터짐
    clone: function (p, d, s, C, S, t0, t1) {
      if (S.fired || t1 < C.at) return; S.fired = 1;
      var n = lv5(s, 'n', C.n);
      for (var i = 0; i < n; i++) {
        var ox = (i % 2 ? -1 : 1) * (26 + i * 8) * AS() / 0.55;
        var c = { kind: 'clone', p: p, d: d, C: C, x: p.x + ox, z: p.y + (i - 1) * 8, dir: p.dir, t: 0, next: 140 + i * 110, pose: 0, poseT: 0, mul: s.mul, st: stOf(C.hit, d), last: stOf(C.last, d) };
        fxs.push(c);
        spawn('sw_slash_rise', c.x, c.z + 2, { sx: 0.55 });
      }
      api().doFlash({ color: '#8aa8ff', alpha: 0.2, ms: 120 });
      snd('shadow');
    },
    // 그림자 난무: 몸을 숨기고 적 사이를 순간이동하며 n 번 X자 베기 → 처음 자리로
    flash: function (p, d, s, C, S, t0, t1) {
      if (!S.fired && t1 >= C.at) {
        S.fired = 1; hideOn = true;
        fxs.push({ kind: 'flash', p: p, d: d, C: C, n: lv5(s, 'n', C.n), i: 0, t: 0, x0: p.x, z0: p.y, mul: s.mul, st: stOf(C.hit, d), last: null });
        spawn('sw_slash_rise', p.x, p.y + 2, { sx: 0.6 });
        snd('shadow');
      }
    },
    // 암영 십자참: 그림자 물결 둘이 위아래에서 엇갈려 나아감 → 엇갈린 자리 큰 X
    xwave: function (p, d, s, C, S, t0, t1) {
      if (S.fired || t1 < C.at) return; S.fired = 1;
      var k = s.area || 1, st = stOf(C.hit, d), sp = C.speed, cross = C.cross, lane = C.lane;
      [-1, 1].forEach(function (sg) {
        shoot({ x: p.x + p.dir * C.x, y: p.y - 46 * AS() / 0.55 + sg * lane, z: p.y + sg * lane, dir: p.dir, speed: sp, vz: -sg * lane * sp / cross, range: C.range, w: 60, h: 70, depth: 26,
                pierce: 99, st: st, mul: s.mul, art: 'sw_slash_wave', sx: 0.65, sy: 0.75, fade: 60, hitArt: 'sw_slash_slash', hitSx: 0.6,
                onEnd: function () {} });
      });
      fxs.push({ kind: 'xcross', x: p.x + p.dir * (C.x + cross), z: p.y, t: -cross / sp * 1000, k: k, C: C, mul: s.mul, last: stOf(C.last, d), dir: p.dir });
      snd('shadow'); snd('skWave');
    },
    // 월영참: 화면 안 적마다 그림자 칼날 n 번 → 거대한 초승달
    moon: function (p, d, s, C, S, t0, t1) {
      if (S.fired || t1 < C.at) return; S.fired = 1;
      fxs.push({ kind: 'moon', p: p, d: d, C: C, n: lv5(s, 'n', C.n), t: 0, wave: 0, mul: s.mul, st: stOf(C.hit, d), last: stOf(C.last, d) });
      snd('shadow');
    },
    // 역병 폭발: 화면 안 적 발밑 맹독 분출(독 겹이 많을수록 셈) → 독 겹을 다 터뜨림
    erupt: function (p, d, s, C, S, t0, t1) {
      if (S.fired || t1 < C.at) return; S.fired = 1;
      var k = s.area || 1, L = foes().filter(function (t) { return onScreen(p, t); }).sort(function (a, b) { return Math.abs(a.x - p.x) - Math.abs(b.x - p.x); });
      if (!L.length) fxs.push({ kind: 'erupt', x: p.x + p.dir * 90 * AS() / 0.55, z: p.y, t: -C.delayMs, k: k, C: C, d: d, mul: s.mul, tgt: null });
      L.forEach(function (t, i) { fxs.push({ kind: 'erupt', x: t.x, z: t.y, t: -C.delayMs - i * C.gapMs, k: k, C: C, d: d, mul: s.mul, tgt: t }); });
      api().doFlash({ color: '#b8ff90', alpha: 0.2, ms: 160 });
      snd('poison');
    }
  };
  function fanThrow(p, d, s, C, n, art, hitArt) {
    var st = stOf(C.hit, d), L = C.lanes;
    for (var i = 0; i < n; i++) {
      var lane = (L[i] != null ? L[i] : (i - n / 2) * 15) * AS() / 0.55;
      shoot({ x: p.x + p.dir * C.x, y: p.y + C.y, z: p.y, dir: p.dir, speed: C.speed, vz: lane * 2.4, range: C.range, w: 24, h: 14, depth: 18, pierce: C.pierce,
              st: st, mul: s.mul, art: g(art, brOn(s)), sx: art === 'ps_dart_dart' ? 1.0 : 0.95, fade: 40, hitArt: g(hitArt, brOn(s)), hitSx: 0.6 });
    }
    spawn(g('as_knife_hit', brOn(s)), p.x + p.dir * C.x, p.y + C.y, { sx: 0.6, dir: p.dir });
  }
  // 던지기(포물선): 가까운 적 쪽(aim) 또는 앞 C.x → then 에서 터짐
  function lob(p, d, s, C, then) {
    var L = C.aim ? near(p, C.aim.range, C.aim.depth, true) : [], t = L[0], x = t ? t.x : p.x + p.dir * C.x, z = t ? t.y : p.y;
    fxs.push({ kind: 'vial', p: p, x0: p.x + p.dir * 20, y0: p.y - 60 * AS() / 0.55, x: x, z: z, t: 0, fly: C.flyMs, then: then, d: d, C: C, k: s.area || 1, mul: s.mul, br: brOn(s), lv: s.L.lv });
    snd('daggerThrow');
  }

  // ---------- 시간이 흐르는 효과 ----------
  function fxStep(o, dt) {
    o.t += dt;
    var P = api(), C = o.C, p = o.p;
    if (o.kind === 'whirl') {
      var r = C.r * o.k * AS() / 0.55;
      if (o.t < C.ms) {
        foes().forEach(function (t) {   // 끌어당김(보스 · 큰 적 빼고)
          if (!pullable(t)) return;
          var dx = p.x - t.x, dz = p.y - t.y, dd = Math.hypot(dx, dz * 2);
          if (dd > C.pullR * o.k || dd < 10) return;
          var m = Math.min(dd - 8, C.pull * dt / 1000); t.x += dx / dd * m; t.y += dz / dd * m * 0.5;
        });
        o.tick -= dt;
        if (o.tick <= 0) { o.tick += C.tickMs; P.atLv(o.lv, function () { hitArea(o.st, p.x, p.y, r, C.depth * o.k, o.mul, null); }); snd('swingDagger', { v: 0.5 }); }
        return true;
      }
      spawn(g('as_whirl_burst', o.br), p.x, p.y - 40 * AS() / 0.55, { sx: 0.95 * o.k });
      P.atLv(o.lv, function () { hitArea(o.last, p.x, p.y, r * 1.4, C.depth * o.k * 1.2, o.mul, {}); });
      wave(p.x, p.y, r * 1.8, { flat: 0.3, w: 4, ms: 380, color: '#ffe0e4', glow: o.br ? (brNow === 'a' ? '#6a8aff' : '#8ae05a') : '#ff4a5a', ground: true });
      snd('skSlam');
      return false;
    }
    if (o.kind === 'vial') {   // 던진 병 · 연막탄(포물선) → 터짐
      if (o.t < 0) return true;
      if (o.t < o.fly) return true;
      var k = o.k, D = o.d;
      if (o.then === 'smoke') {
        spawn(g('as_knife_boom', o.br), o.x, o.z + 2, { sx: C.r * 2 * k / 110 * 1.1 * AS() / 0.55 });
        P.atLv(o.lv, function () { hitArea(stOf(C.hit, D), o.x, o.z, C.r * k * AS() / 0.55, C.depth * k, o.mul, {}); });
        fxs.push({ kind: 'linger', art: 'as_knife_boom', fr: 2, x: o.x, z: o.z, t: 0, ms: C.ms, tick: C.tickMs, C: C, k: k, st: stOf(C.tick, D), mul: o.mul, lv: o.lv, sx: C.r * 2 * k / 110 * 1.1 * AS() / 0.55 });
        snd('smoke');
      } else if (o.then === 'cloud') {
        spawn('ps_dart_shatter', o.x, o.z + 2, { sx: 1.2 * k });
        P.atLv(o.lv, function () { hitArea(stOf(C.hit, D), o.x, o.z, C.r * k * 0.7 * AS() / 0.55, C.depth * k, o.mul, {}); });
        fxs.push({ kind: 'linger', art: 'ps_cloud_cloud', loop: true, x: o.x, z: o.z, t: 0, ms: C.ms, tick: C.tickMs, C: C, k: k, st: stOf(C.tick, D), mul: o.mul, lv: o.lv,
                   sx: C.r * 2 * k / 150 * 1.15 * AS() / 0.55, slow: true, end: 'ps_cloud_puff' });
        snd('poison');
      } else if (o.then === 'pool') {
        spawn('ps_dart_shatter', o.x, o.z + 2, { sx: 0.9 * k });
        fxs.push({ kind: 'linger', art: 'ps_cloud_pool', loop: true, under: true, x: o.x, z: o.z, t: 0, ms: C.ms, tick: C.tickMs, C: C, k: k, st: stOf(C.tick, D), mul: o.mul, lv: o.lv,
                   sx: C.r * 2 * k / 120 * 1.1 * AS() / 0.55 });
        snd('poison', { v: 0.6 });
      }
      return false;
    }
    if (o.kind === 'linger') {
      o.tick2 = (o.tick2 == null ? 0 : o.tick2) - dt;
      if (o.t < o.ms && o.tick2 <= 0) {
        o.tick2 += o.tick;
        var R = o.C.r * o.k * AS() / 0.55;
        P.atLv(o.lv, function () { hitArea(o.st, o.x, o.z, R, o.C.depth * o.k, o.mul, null, function (t) { if (o.slow && t.T && !t.T.boss) { t.slowT = Math.max(t.slowT || 0, 600); t.slowK = 0.6; t.slowDaze = false; } }); });
      }
      if (o.t >= o.ms) { if (o.end) spawn(o.end, o.x, o.z + 2, { sx: o.sx }); return false; }
      return true;
    }
    if (o.kind === 'clone') {
      var tg = o.tgt;
      o.poseT -= dt;
      if (o.t < C.ms) {
        o.next -= dt;
        if (o.next <= 0) {
          o.next = C.gapMs * (0.8 + Math.random() * 0.4);
          var L = foes(o.st).filter(function (t) { return Math.abs(t.x - p.x) <= C.find * AS() / 0.55 && Math.abs(t.y - p.y) <= C.findDepth; });
          if (L.length) {
            tg = L[Math.floor(Math.random() * L.length)]; o.tgt = tg;
            var side = Math.random() < 0.5 ? -1 : 1;
            spawn('sw_slash_rise', o.x, o.z + 2, { sx: 0.35, a: 0.8 });
            o.x = tg.x + side * 26 * AS() / 0.55; o.z = tg.y; o.dir = -side; o.pose = 4; o.poseT = 160;
            spawn('sw_slash_slash', tg.x, mid(tg), { sx: 0.85, dir: o.dir, rot: (Math.random() - 0.5) * 0.8 });
            hitArea(o.st, tg.x, tg.y, C.r * AS() / 0.55, 30, o.mul, {});
            snd('swingDagger', { v: 0.5 });
          } else { o.x += ((p.x - o.dir * 30) - o.x) * 0.2; o.z += (p.y - o.z) * 0.2; o.dir = p.dir; }
        }
        return true;
      }
      spawn('sw_slash_rise', o.x, o.z + 2, { sx: 0.8 });
      spawn('sw_ult_burst', o.x, o.z - 30 * AS() / 0.55, { sx: 0.7 });
      hitArea(o.last, o.x, o.z, C.r * 1.4 * AS() / 0.55, 40, o.mul, {});
      snd('skSlam', { v: 0.6 });
      return false;
    }
    if (o.kind === 'flash') {
      var due = Math.floor(o.t / C.gapMs);
      while (o.i <= Math.min(due, o.n - 1)) {
        var L2 = foes(o.st).filter(function (t) { return Math.abs(t.x - o.x0) <= C.find * AS() / 0.55 && Math.abs(t.y - o.z0) <= C.findDepth; })
                           .sort(function (a, b) { return Math.abs(a.x - o.x0) - Math.abs(b.x - o.x0); });
        var t3 = L2.length ? L2[o.i % L2.length] : null;
        var x = t3 ? t3.x : o.x0 + p.dir * (40 + o.i * 30) * AS() / 0.55, z = t3 ? t3.y : o.z0;
        spawn('sw_slash_cross', x, t3 ? mid(t3) : z - 40 * AS() / 0.55, { sx: 0.8 + (o.i === o.n - 1 ? 0.3 : 0), rot: (o.i % 2 ? 0.3 : -0.3) });
        spawn('sw_slash_rise', x + (o.i % 2 ? 18 : -18), z + 2, { sx: 0.3, a: 0.8 });
        o.ghost = { x: x - (o.i % 2 ? 1 : -1) * 24 * AS() / 0.55, z: z, dir: o.i % 2 ? 1 : -1, t: 0 };
        hitArea(o.st, x, z, C.r * AS() / 0.55, 30, o.mul, {});
        snd('swingDagger'); if (o.i === o.n - 1) snd('skSlam', { v: 0.6 });
        o.i++;
      }
      if (o.ghost) o.ghost.t += dt;
      if (o.t >= o.n * C.gapMs + 80) {
        hideOn = false; p.x = o.x0; p.y = o.z0;
        spawn('sw_slash_rise', p.x, p.y + 2, { sx: 0.55 });
        return false;
      }
      return true;
    }
    if (o.kind === 'xcross') {
      if (o.t < 0) return true;
      if (!o.boom) {
        o.boom = true;
        var R2 = C.r * o.k * AS() / 0.55;
        spawn('sw_slash_cross', o.x, o.z - 44 * AS() / 0.55, { sx: 1.5 * o.k });
        spawn('sw_ult_burst', o.x, o.z - 20 * AS() / 0.55, { sx: 1.0 * o.k });
        hitArea(o.last, o.x, o.z, R2, C.depth * o.k, o.mul, {});
        wave(o.x, o.z, R2 * 1.5, { flat: 0.3, w: 5, ms: 420, color: '#e0ecff', glow: '#4a6aff', ground: true });
        api().doFlash({ color: '#c0d8ff', alpha: 0.35, ms: 150 }); H().hitstop(60);
        snd('skSlam');
      }
      return false;
    }
    if (o.kind === 'moon') {
      var due2 = Math.floor(o.t / C.gapMs);
      while (o.wave <= Math.min(due2, o.n - 1)) {
        foes(o.st).forEach(function (t) {
          if (!onScreen(p, t)) return;
          fxs.push({ kind: 'blade', x: t.x + (Math.random() * 2 - 1) * 10, z: t.y + 1, t: 0, fall: 150, tgt: t, st: o.st, mul: o.mul });
        });
        snd('swingDagger', { v: 0.6 });
        o.wave++;
      }
      if (!o.done && o.t >= o.n * C.gapMs + 260) {
        o.done = true;
        var mx = p.x + p.dir * 120 * AS() / 0.55;
        fxs.push({ kind: 'moonfx', x: mx, z: p.y, t: 0, dir: p.dir });
        foes(o.last).forEach(function (t) { if (onScreen(p, t)) { hitT(o.last, t, t.x, mid(t), p.dir, o.mul); spawn('sw_ult_burst', t.x, mid(t), { sx: 0.7 }); } });
        api().doFlash({ color: '#e0ecff', alpha: 0.6, ms: 240 }); H().hitstop(90);
        if (window.FX && window.FX.shake) window.FX.shake(CFG().juice.shakePx * 3.5, 500);
        snd('skSlam'); snd('shadow');
      }
      return o.t < o.n * C.gapMs + 700;
    }
    if (o.kind === 'moonfx') return o.t < 600;
    if (o.kind === 'blade') {
      if (o.t >= o.fall && !o.landed) {
        o.landed = true;
        spawn('sw_ult_impact', o.x, o.z + 1, { sx: 0.6 });
        if (alive(o.tgt)) hitT(o.st, o.tgt, o.tgt.x, mid(o.tgt), Math.random() < 0.5 ? -1 : 1, o.mul);
      }
      return o.t < o.fall + 40;
    }
    if (o.kind === 'erupt') {
      if (o.t < 0) return true;
      if (!o.boom) {
        o.boom = true;
        var D2 = o.d, n = o.tgt && alive(o.tgt) ? (o.tgt.asPsnN || 0) : 0;
        spawn('ps_cloud_erupt', o.x, o.z + 2, { sx: (0.55 + n * 0.03) * o.k });
        var st2 = psnBurstSt(o.C, D2, n);
        if (o.tgt && alive(o.tgt)) { hitT(st2, o.tgt, o.tgt.x, mid(o.tgt), 1, o.mul); clearPsn(o.tgt); }
        hitArea(stOf(o.C.hit, D2), o.x, o.z, o.C.r * o.k * AS() / 0.55, o.C.depth, o.mul, o.tgt ? (function () { var q = {}; q[o.tgt.id || 'dummy'] = true; return q; })() : {});
        snd('poison', { v: 0.7 });
      }
      return o.t < 500;
    }
    return false;
  }
  var burstSt = {};
  function psnBurstSt(C, d, n) {
    var key = d.id + ':' + n;
    if (burstSt[key]) return burstSt[key];
    var h = {}, k; for (k in C.hit) h[k] = C.hit[k];
    h.dmg = C.hit.dmg + C.perStack * Math.min(10, n);
    return (burstSt[key] = stOf(h, d));
  }
  function drawFx(ctx, camX, o, under) {
    var C = o.C;
    if (o.kind === 'vial' && !under && o.t >= 0 && o.t < o.fly) {
      var u = o.t / o.fly, x = o.x0 + (o.x - o.x0) * u, y = (o.y0 + (o.z - 10 - o.y0) * u) - Math.sin(Math.PI * u) * 60 * AS() / 0.55;
      var art = o.then === 'smoke' ? 'as_knife_bomb' : 'ps_dart_vial';
      aiDraw(ctx, art, Math.floor(o.t / 90) % 2, x - camX, y, 1.4, 1.4, o.t / 120, 1);
      return;
    }
    if (o.kind === 'linger' && !!o.under === under) {
      var a = Math.min(1, o.t / 150) * Math.min(1, (o.ms - o.t) / 300), F = AFX[o.art];
      var i = o.loop ? Math.floor(o.t * F.fps / 1000) % F.n : (o.fr != null ? o.fr : 0);
      aiDraw(ctx, o.art, i, o.x - camX, o.z + 2, o.sx, o.sx * (o.under ? 1 : 0.8), 0, a * (o.under ? 0.95 : o.fr != null ? 0.55 : 0.8));
      return;
    }
    if (o.kind === 'clone' && !under) { drawShadowMe(ctx, camX, o.p, o.x, o.z, o.dir, o.poseT > 0 ? 'motion_dash' : 'idle', o.poseT > 0 ? 4 : Math.floor(o.t / 160) % 4, 0.78); return; }
    if (o.kind === 'flash' && !under && o.ghost && o.ghost.t < 200) { drawShadowMe(ctx, camX, o.p, o.ghost.x, o.ghost.z, o.ghost.dir, 'motion_dash', 4, 0.85 * (1 - o.ghost.t / 200)); return; }
    if (o.kind === 'blade' && !under && !o.landed) {
      var u2 = o.t / o.fall, y2 = o.z - (1 - u2) * 150 * AS() / 0.55;
      aiDraw(ctx, 'sw_ult_blade', Math.floor(o.t / 70) % 4, o.x - camX, y2, 0.9, 0.9, 0, Math.min(1, u2 * 3));
      return;
    }
    if (o.kind === 'moonfx' && !under) {
      var k2 = o.t / 600, i2 = Math.min(3, Math.floor(o.t / 110));
      aiDraw(ctx, 'sw_ult_moon', i2, o.x - camX + o.dir * k2 * 120, o.z - 70 * AS() / 0.55, 2.0 * o.dir, 2.0, 0, Math.min(1, (1 - k2) * 2));
    }
  }
  // 분신 · 그림자: 내 그림 한 장을 짙은 남색으로 물들여 그림(그림마다 한 번만 만듦)
  var shCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function shadowImg(img) {
    var c = shCache && shCache.get(img);
    if (c) return c;
    c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    var x = c.getContext('2d'); x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.72; x.fillStyle = '#0a1240'; x.fillRect(0, 0, c.width, c.height);
    x.globalAlpha = 0.25; x.fillStyle = '#6a8aff'; x.fillRect(0, 0, c.width, c.height);
    if (window.Assets && Assets.copyMeta) Assets.copyMeta(img, c);
    if (shCache) shCache.set(img, c);
    return c;
  }
  function drawShadowMe(ctx, camX, p, x, z, dir, anim, idx, a) {
    var L = p.char && p.char.anims && (p.char.anims[anim] || p.char.anims.idle), img = L && L[Math.min(idx, L.length - 1)];
    if (!img) return;
    var def = p.char.def;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(Math.round(x - camX), Math.round(z)); ctx.scale(dir, 1);
    Assets.blit(ctx, shadowImg(img), def.pivot.x, def.pivot.y); ctx.restore();
  }

  // ---------- 독 ----------
  //   적마다 t.asPsnN = 겹(최대 10), t.asPsnT = 남은 시간, t.asPsnDmg = 한 겹 피해. 0.5초마다 겹 x 한 겹 피해, 독으로는 안 쓰러짐(체력 1 남김)
  var PSN = { ms: 3000, tick: 500, max: 10, per: 0.04 };
  var poisoned = [];
  function addPsn(t, n, baseDmg) {
    if (!t || t.isProp || !alive(t) || !(n > 0)) return;
    if (!(t.asPsnN > 0)) { poisoned.push(t); t.asPsnNext = PSN.tick; t.asPsnN = 0; }
    t.asPsnN = Math.min(PSN.max, t.asPsnN + n); t.asPsnT = PSN.ms;
    t.asPsnDmg = Math.max(t.asPsnDmg || 0, Math.max(1, (baseDmg || 8) * PSN.per));
  }
  function clearPsn(t) { t.asPsnN = 0; t.asPsnT = 0; }
  function psnStep(dt) {
    for (var i = poisoned.length - 1; i >= 0; i--) {
      var t = poisoned[i];
      if (!(t.asPsnT > 0) || !(t.asPsnN > 0) || !alive(t)) { t.asPsnN = 0; t.asPsnT = 0; poisoned.splice(i, 1); continue; }
      t.asPsnT -= dt; t.asPsnNext -= dt;
      if (t.asPsnNext <= 0) {
        t.asPsnNext += PSN.tick;
        var nn = Math.max(1, Math.round(t.asPsnDmg * t.asPsnN));
        if (t.hp != null && t.maxHp) { nn = Math.min(nn, t.hp - 1); if (nn > 0) t.hp -= nn; }
        if (nn > 0) window.FX.damage(t.x, t.y - (t.T ? t.T.height : 60) - 6, nn, false, CFG().juice, '#9aff6a', 'push', (t.id || 'dummy') + ':psn', true);
        debris(t.x, t.y - (t.T ? t.T.height * 0.5 : 30), t.y, 2, { cols: ['#2a5a10', '#7ad84a', '#d8ffb0'], glow: true, sp: 40, size: 1.3, ms: 360, g: -80, spread: 1.2 });
      }
    }
  }

  // ---------- 늘 켜진 기술 ----------
  var pasT = { orbit: 1500, echoIcd: 0 }, shade = null, echoes = [];
  function passiveStep(p, dt) {
    if (!p || p.classKey !== 'assassin' || p.state === 'dead') { shade = null; return; }
    if (pasT.echoIcd > 0) pasT.echoIcd -= dt;
    // 떠도는 단검: val ms 마다 가까운 적 n 마리에게 유령 단검
    var q = pas(p, 'aorbit');
    pasT.orbitOn = !!q;
    if (q) {
      pasT.orbit -= dt;
      if (pasT.orbit <= 0) {
        var P = q.P, lv = q.lv - 1, L = near(p, P.find * AS() / 0.55, P.findDepth, false);
        pasT.orbit = L.length ? q.v : 400;
        if (L.length) {
          var n = P.n[lv] || 3;
          for (var i = 0; i < n; i++) {
            var t = L[i % L.length], ang = -Math.PI / 2 + (i - (n - 1) / 2) * 0.5, sp = 360;
            shoot({ x: p.x + Math.cos(i * 2.1) * 18, y: p.y - (p.z || 0) - 60 * AS() / 0.55, z: p.y, dir: p.dir, vx: Math.cos(ang) * sp + 0.01, vy: Math.sin(ang) * sp, speed: sp, range: 600,
                    w: 14, h: 10, depth: 30, pierce: 0, st: P.hit, mul: (P.mul[lv] || 1), home: t, turn: 12, art: 'as_knife_ghost', sx: 0.85, hitArt: 'as_knife_hit', hitSx: 0.6 });
          }
          snd('daggerThrow', { v: 0.5 });
        }
      }
    }
    // 그림자 동행(그림자 무사): 몸 뒤를 따라다니다가 val ms 마다 가까운 적에게 뛰어들어 X자 베기
    var sq = pas(p, 'sshade');
    if (!sq) shade = null;
    else {
      if (!shade) shade = { x: p.x - p.dir * 30, z: p.y, dir: p.dir, t: 0, cd: 1200, hitT: 0 };
      var sh = shade; sh.t += dt; sh.hitT -= dt;
      if (sh.hitT <= 0) {
        var tx = p.x - p.dir * 34 * AS() / 0.55, tz = p.y - 6;
        sh.x += (tx - sh.x) * Math.min(1, dt / 140); sh.z += (tz - sh.z) * Math.min(1, dt / 140); sh.dir = p.dir;
      }
      sh.cd -= dt;
      if (sh.cd <= 0) {
        var SP = sq.P, T2 = near(p, SP.find * AS() / 0.55, SP.findDepth, false)[0];
        if (T2) {
          var side = T2.x >= p.x ? -1 : 1;
          spawn('sw_slash_rise', sh.x, sh.z + 2, { sx: 0.3, a: 0.7 });
          sh.x = T2.x + side * 24 * AS() / 0.55; sh.z = T2.y; sh.dir = -side; sh.hitT = 260; sh.cd = sq.v;
          spawn('sw_slash_cross', T2.x, mid(T2), { sx: 0.75 });
          hitT(SP.hit, T2, T2.x, mid(T2), sh.dir, SP.mul[sq.lv - 1] || 1);
          snd('swingDagger', { v: 0.6 });
        } else sh.cd = 300;
      }
    }
    // 잔상 베기(잔영 베기 · 그림자 무사 갈래 덤): 늦게 한 번 더
    for (var e = echoes.length - 1; e >= 0; e--) {
      var E = echoes[e]; E.t -= dt;
      if (E.t > 0) continue;
      echoes.splice(e, 1);
      if (!alive(E.tgt)) continue;
      spawn(E.art, E.tgt.x, mid(E.tgt), { sx: E.sx || 0.7, dir: E.dir, rot: (Math.random() - 0.5) * 0.6 });
      if (E.r) hitArea(E.st, E.tgt.x, E.tgt.y, E.r, E.depth || 30, E.mul, {});
      else hitT(E.st, E.tgt, E.tgt.x, mid(E.tgt), E.dir, E.mul);
    }
  }

  // ---------- main.js onHit 갈고리 ----------
  function brTw(p, st) { var b = st && st.skId ? api().brOf(p, { id: st.skId }) : null; return b && b.tw ? b.tw : null; }
  function critAdd(p, st) {
    var n = 0, q = pas(p, 'akeen');
    if (q) n += q.v;
    if (st && st.crit) n += 1;   // 그림자 걸음: 늘 치명타
    return n;
  }
  function critDmg(p) { var q = pas(p, 'akeen'); return q ? (q.P.critDmg[q.lv - 1] || 0) * q.rk : 0; }
  function dmgMul(p, t) {
    var q = pas(p, 'aexec');
    if (!q || !t || t.isProp || !t.maxHp || t.hp == null) return 1;
    return t.hp <= t.maxHp * (q.P.below || 0.3) ? 1 + q.v : 1;
  }
  var echoSt = {};
  function echoOf(st, k) {
    var key = (st.skId || 'basic') + ':' + k;
    if (echoSt[key]) return echoSt[key];
    return (echoSt[key] = { dmg: (st.dmg || 1) * k, hitstop: 0.25, knock: 0.3, shake: 0.4, spark: 0.8, noRage: true, noMp: true, noJuggle: true, numStyle: 'push', asEcho: true,
                            damageStyle: st.damageStyle, hitsDown: !!st.hitsDown });
  }
  function onHit(p, t, st, dmg, res) {
    if (!t || t.isProp || !st || !p) return;
    var basic = !st.damageStyle && !st.asEcho && !st.asOrbit && !st.swShade && !st.asPlague && !st.asPsnTick;
    // 잔영 베기(늘 켜짐): 평타가 맞으면 chance 확률로 잔상 베기(둘레)
    if (basic && !(pasT.echoIcd > 0)) {
      var q = pas(p, 'aecho');
      if (q && Math.random() < (q.P.chance[q.lv - 1] || 0.3)) {
        pasT.echoIcd = q.P.icdMs || 180;
        echoes.push({ t: 120, tgt: t, st: q.P.hit, mul: q.v, art: 'as_whirl_echo', sx: 0.7, dir: p.dir, r: q.P.r * AS() / 0.55, depth: q.P.depth });
      }
    }
    // 각성 「암영 폭주」: 평타마다 붉은 잔상 한 번 더
    if (basic && p.awkEcho && alive(t)) echoes.push({ t: 90, tgt: t, st: echoOf(st, 0.5), mul: 1, art: 'as_slash_slash', sx: 0.6, dir: p.dir });
    // 독 바르기(늘 켜짐) · 기술의 독(asPsn) · 독술사 갈래 덤(psn)
    var tw = brTw(p, st), live = res && res !== 'dead' && alive(t), n = 0;
    if (live && !st.asPsnTick) {
      var vq = pas(p, 'avenom');
      if (vq && !st.asEcho && Math.random() < vq.v) n += 1;
      if (st.asPsn) n += st.asPsn;
      if (tw && tw.psn) n += tw.psn;
      if (window.PV && PV.id === 'pplague' && !st.asPlague) n += 2;   // 기술 창 미리보기: 역병 전염이 보이게 평타에 독
      if (n > 0) { addPsn(t, n, dmg); spawn('ps_dart_bubble', t.x, t.y - (t.T ? t.T.height : 60) * 0.7, { sx: 0.8 }); }
    }
    // 그림자 무사 갈래 덤: echoMs 뒤 그림자 잔상이 한 번 더(그 타 피해 x echo)
    if (tw && tw.echo && live && !st.asEcho) echoes.push({ t: tw.echoMs || 220, tgt: t, st: echoOf(st, tw.echo), mul: 1, art: 'sw_slash_slash', sx: 0.6, dir: p.dir });
    // 역병 전염(독술사 늘 켜짐): 독 걸린 적이 쓰러지면 터져 둘레에 독
    if (res === 'dead' && t.asPsnN > 0) {
      var pq = pas(p, 'pplague');
      if (pq) {
        var P = pq.P, lv = pq.lv - 1, R = (P.r[lv] || 70) * AS() / 0.55, give = Math.max(1, Math.round(t.asPsnN * (P.spread[lv] || 0.5))), x = t.x, z = t.y, base = t.asPsnDmg / PSN.per;
        spawn('ps_cloud_puff', x, z + 2, { sx: R * 2 / 150 * 1.1 });
        spawn('ps_dart_splash', x, z - 20 * AS() / 0.55, { sx: 1.0 });
        hitArea(P.hit, x, z, R, P.depth, pq.v, null, function (e) { if (e !== t && alive(e)) addPsn(e, give, base); });
        snd('poison', { v: 0.5 });
      }
      clearPsn(t);
    }
  }

  // ---------- 단검 강화 빛(손 위치 json = 단검 날 가운데): 강화 단계 · 갈래 색 ----------
  var TIERCOL = { rare: '#bfe0ff', epic: '#ff5a6a', legendary: '#ffd040', mythic: '#ff2a3a' };
  var TIERCOL_A = { rare: '#8aa8ff', epic: '#4a6aff', legendary: '#9fd0ff', mythic: '#3ad0ff' };
  var TIERCOL_B = { rare: '#a8e080', epic: '#6ad040', legendary: '#c8ff60', mythic: '#5aff3a' };
  function gradeGlow(ctx, camX, p) {
    if (!p.wArt || !p.char || !p.char.anchors || hideOn) return;
    var tier = (p.wArt.match(/_(common|rare|epic|legendary|mythic)$/) || [])[1];
    if (!tier || tier === 'common') return;
    var fr = p.currentFrame(), L = p.char.anims[fr.anim], img = L && L[fr.idx], an = p.char.anchors[fr.anim], anc = an && an[fr.idx];
    if (!img || !anc || anc.hide) return;
    var k = img._k || 1, def = p.char.def, dir = p.dir, x = p.x + dir * (anc.x - def.pivot.x) * k, y = p.y - (p.z || 0) + (anc.y - def.pivot.y) * k;
    var col = (brNow === 'a' ? TIERCOL_A : brNow === 'b' ? TIERCOL_B : TIERCOL)[tier], r = { rare: 7, epic: 9, legendary: 11, mythic: 13 }[tier] * AS() / 0.55;
    var fl = 0.75 + 0.25 * Math.sin(performance.now() / 120);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * fl;
    var gr = ctx.createRadialGradient(x - camX, y, 0, x - camX, y, r * 2.2); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(x - camX - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8); ctx.restore();
    if ((tier === 'legendary' || tier === 'mythic') && Math.random() < 0.18) debris(x + (Math.random() - 0.5) * 10, y, p.y, 1, { cols: ['#ffffff', col], glow: true, sp: 30, size: 1.2, ms: 360, g: -120, spread: 1.2 });
  }

  // ---------- 매 장면 ----------
  function update(dt) {
    var p = H() && H().player && H().player();
    brNow = p && p.classKey === 'assassin' && window.Growth && Growth.brOn ? Growth.brOn('assassin') || null : null;
    for (var i = shots.length - 1; i >= 0; i--) { shotStep(shots[i], dt); if (shots[i].dead) shots.splice(i, 1); }
    for (var j = fxs.length - 1; j >= 0; j--) if (!fxStep(fxs[j], dt)) fxs.splice(j, 1);
    psnStep(dt);
    passiveStep(p, dt);
    if (hideOn && p && p.state !== 'skill') hideOn = false;   // 기술이 끊기면(맞음 등) 숨김 풀기
  }
  function drawUnder(ctx, camX) { fxs.forEach(function (o) { drawFx(ctx, camX, o, true); }); }
  function drawOver(ctx, camX) {
    var p = H() && H().player && H().player();
    fxs.forEach(function (o) { drawFx(ctx, camX, o, false); });
    shots.forEach(function (a) { drawShot(ctx, camX, a); });
    // 독 거품 · 처형 해골
    var now = performance.now(), xq = p ? pas(p, 'aexec') : null;
    poisoned.forEach(function (t) { if (t.asPsnN > 0 && alive(t)) aiDraw(ctx, 'ps_dart_bubble', Math.floor(now / 125) % 4, t.x - camX, t.y - (t.az || 0) - (t.T ? t.T.height : 60) - 6, 0.6 + t.asPsnN * 0.04, 0.6 + t.asPsnN * 0.04, 0, 0.9); });
    if (xq) foes().forEach(function (t) { if (t.maxHp && t.hp <= t.maxHp * (xq.P.below || 0.3)) aiDraw(ctx, 'as_knife_mark', Math.floor(now / 160) % 2, t.x - camX, t.y - (t.az || 0) - (t.T ? t.T.height : 60) - 16, 0.6, 0.6, 0, 0.85); });
    if (p && p.classKey === 'assassin') {
      if (shade) drawShadowMe(ctx, camX, p, shade.x, shade.z, shade.dir, shade.hitT > 0 ? 'motion_dash' : (p.state === 'run' || p.state === 'walk' ? 'run' : 'idle'), shade.hitT > 0 ? 4 : Math.floor(shade.t / 120) % 4, 0.6);
      if (pasT.orbitOn && !hideOn) for (var i = 0; i < 3; i++) {   // 떠도는 단검: 몸 둘레를 맴도는 유령 단검 셋
        var a = now / 520 + i * 2.094, ox = Math.cos(a) * 22 * AS() / 0.55, oy = Math.sin(a) * 6;
        aiDraw(ctx, 'as_knife_ghost', Math.floor(now / 100) % 2, p.x + ox - camX, p.y - (p.z || 0) - 64 * AS() / 0.55 + oy, 0.55, 0.55, -Math.PI / 2, 0.75);
      }
      gradeGlow(ctx, camX, p);
    }
  }
  function clear() { shots.length = 0; fxs.length = 0; echoes.length = 0; poisoned.forEach(function (t) { t.asPsnN = 0; t.asPsnT = 0; }); poisoned.length = 0; shade = null; hideOn = false; pasT.orbit = 1500; pasT.echoIcd = 0; }
  function busy() { return shots.length + fxs.length > 0; }
  function hidden(p) { return hideOn && p && p.classKey === 'assassin'; }

  window.Assassin = {
    swingFx: swingFx, step: step, update: update, drawUnder: drawUnder, drawOver: drawOver, clear: clear, busy: busy, hidden: hidden,
    critAdd: critAdd, critDmg: critDmg, dmgMul: dmgMul, onHit: onHit, addPsn: addPsn,
    _state: function () { return { shots: shots.length, fxs: fxs.length, poisoned: poisoned.length, shade: !!shade, echoes: echoes.length, br: brNow, hide: hideOn }; }
  };
})();
