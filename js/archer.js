// 궁수(2026-11-09): 화살 · 궁수 기술 · 늘 켜진 기술 · 2차 갈래 덤
//   수치 = config.js 의 ARCHER(평타) · ARCHER_SKILLS(기술 arc) · SKILL_TREE.archer(늘 켜진 기술) · BRANCH_FX.archer(갈래 덤)
//   효과 그림 = 전부 AI 도트 그림(art/skill-fx/ar_* · sn_* · rg_*, 게임 = assets/fx/aifx). 코드로 그리는 건 작은 빛 알갱이 · 둥근 빛뿐
//   skills.js 가 부르는 곳: Archer.step(기술 진행, d.arc) · update · drawUnder · drawOver · clear
//   main.js 가 부르는 곳: basicShot(평타 화살) · moveShot(달리며 · 점프 공격) · critAdd · critDmg · dmgMul · onHit
(function () {
  var A = null;           // Skills._api (skills.js 도구)
  function api() { return A || (A = window.Skills && Skills._api); }
  function H() { return api().H(); }
  function CFG() { return window.CFG; }
  function AS() { return (CFG() && CFG().actorScale) || 1; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(u) { return 1 - (1 - u) * (1 - u); }
  function snd(n, o) { if (window.SFX) SFX.play(n, o); }

  // ---- AI 그림 묶음(togame.py 가 찍은 표 그대로: n = 장 수, pv = 기준점(1배 도트), fps) ----
  var AFX = {
    ar_arrow_fly:     { n: 2, pv: [40, 4.5], fps: 12 },     ar_arrow_pfly:  { n: 2, pv: [50, 12.5], fps: 14 },   ar_arrow_hit:   { n: 4, pv: [19, 18], fps: 20 },
    ar_pierce_bolt:   { n: 4, pv: [120, 35], fps: 16 },     ar_pierce_trail:{ n: 4, pv: [70, 20], fps: 12 },
    ar_rain_fall:     { n: 4, pv: [19.5, 70], fps: 14 },    ar_rain_land:   { n: 4, pv: [23.5, 46], fps: 14 },
    ar_burst_arrow:   { n: 4, pv: [52, 15], fps: 14 },      ar_burst_boom:  { n: 4, pv: [42.5, 42], fps: 14 },
    ar_up_rise:       { n: 8, pv: [52, 118], fps: 16 },
    ar_leap_arc:      { n: 4, pv: [37.5, 40], fps: 16 },    ar_leap_wind:   { n: 4, pv: [37, 57], fps: 16 },
    ar_mark_mark:     { n: 4, pv: [11, 11], fps: 8 },       ar_mark_homing: { n: 2, pv: [28, 6], fps: 12 },     ar_mark_split:  { n: 2, pv: [18, 2.5], fps: 12 },
    ar_charge_charge: { n: 4, pv: [17, 17], fps: 14 },      ar_charge_flash:{ n: 4, pv: [0, 27.5], fps: 18 },
    sn_snipe_beam:    { n: 4, pv: [240, 18], fps: 16 },     sn_snipe_hit:   { n: 4, pv: [36.5, 36], fps: 16 },
    sn_ballista_bolt: { n: 4, pv: [110, 17], fps: 14 },     sn_ballista_ring:{ n: 4, pv: [30, 31], fps: 14 },
    sn_sky_fall:      { n: 4, pv: [27.5, 120], fps: 14 },   sn_sky_hit:     { n: 4, pv: [70, 127], fps: 12 },
    rg_hawk_fly:      { n: 4, pv: [17, 16.5], fps: 10 },    rg_hawk_dive:   { n: 2, pv: [18, 19.5], fps: 12 },  rg_hawk_hit:    { n: 2, pv: [24, 24.5], fps: 14 },
    rg_trap_trap:     { n: 4, pv: [16, 27], fps: 10 },      rg_trap_vine:   { n: 4, pv: [22.5, 60], fps: 12 },
    rg_twist_loop:    { n: 4, pv: [47, 110], fps: 14 },     rg_twist_burst: { n: 4, pv: [55, 55], fps: 14 }
  };
  // 갈래 그림(archer_brfx.py): 같은 장 수 · 기준점, 처음 쓰일 때 불러옴(br)
  var BRG = ['ar_pierce_bolt', 'ar_pierce_trail', 'ar_up_rise', 'ar_leap_arc', 'ar_leap_wind', 'ar_arrow_pfly', 'ar_arrow_hit', 'ar_mark_split',
             'ar_rain_fall', 'ar_rain_land', 'ar_burst_arrow', 'ar_burst_boom'];
  (function reg() {
    var S = window.Skills && Skills._api;
    if (!S) return;
    var m = {}; Object.keys(AFX).forEach(function (g) { m[g] = AFX[g]; });
    BRG.forEach(function (g) { ['a', 'b'].forEach(function (b) { var o = {}, k; for (k in AFX[g]) o[k] = AFX[g][k]; o.br = 1; m[g + '_' + b] = o; }); });
    S.addAifx(m);
  })();

  // 지금 갈래(2차 Lv 전 = null) → 1차 기술 그림을 갈래 그림으로(읽혔으면)
  var brNow = null;
  function g(name, skill) { if (!skill || !brNow || BRG.indexOf(name) < 0) return name; var v = name + '_' + brNow; return api().aiOk(v) ? v : name; }
  function spawn(name, x, y, o) { return api().aiSpawn(name, x, y, o); }
  // 그리기: 갈래 그림(br)은 처음 쓰일 때 불러오므로 aiOk 로 불러오기를 부탁한 뒤 그림(아직이면 이번 장면은 건너뜀)
  function aiDraw(ctx, name, i, x, y, sx, sy, rot, a) { var P = api(); if (!P.aiOk(name)) return false; return P.aiDraw(ctx, name, i, x, y, sx, sy, rot, a); }
  function glow(x, y, r, c, ms, a) { api().glow(x, y, r, c, ms, a); }
  function debris(x, y, f, n, o) { api().debris(x, y, f, n, o); }
  function wave(x, y, r, o) { api().wave(x, y, r, o); }

  // ---- 대상 ----
  function alive(t) { return !!t && (!t.alive || t.alive()); }
  function foes(st) { var h = H(); return h.targets().filter(function (t) { return t && !t.isProp && alive(t) && (!st || h.canHit(t, st)); }); }
  function boss(t) { return !!(t && t.T && (t.T.boss || t.mid || t.raid)); }
  function pullable(t) { return !!(t && !t.isProp && t.T && !boss(t) && alive(t)); }
  // 앞쪽 range 안 적: 가까운 순(near) / 가장 센 적(strong = 보스 먼저, 그다음 체력 많은 적)
  function aim(p, R, mode) {
    var L = foes().filter(function (t) { var dx = (t.x - p.x) * p.dir; return dx > -8 && dx <= R.range && Math.abs(t.y - p.y) <= R.depth; });
    if (!L.length) return null;
    if (mode === 'strong') L.sort(function (a, b) { return (boss(b) - boss(a)) || ((b.hp || 0) - (a.hp || 0)); });
    else L.sort(function (a, b) { return Math.abs(a.x - p.x) + Math.abs(a.y - p.y) * 0.5 - (Math.abs(b.x - p.x) + Math.abs(b.y - p.y) * 0.5); });
    return L[0];
  }
  function hitT(st, t, x, y, dir, mul, wk) {
    var h = H(); if (!h.canHit(t, st)) return false;
    h.onHit(st, t, { dir: dir, wk: wk || 'bow', x: x, y: y, mul: mul || 1 });
    return true;
  }
  function inBox(t, x, z, R, D) { var hb = t.hurtbox(); return Math.abs(hb.z - z) <= D && hb.x1 >= x - R && hb.x0 <= x + R; }
  function hitArea(st, x, z, R, D, mul, wk, done, cb) {
    foes(st).forEach(function (t) {
      var id = t.id || 'dummy'; if (done && done[id]) return;
      if (!inBox(t, x, z, R, D)) return;
      if (done) done[id] = true;
      var hb = t.hurtbox();
      hitT(st, t, clamp(x, hb.x0, hb.x1), (hb.y0 + hb.y1) / 2, Math.abs(t.x - x) < 3 ? 1 : (t.x > x ? 1 : -1), mul, wk);
      if (cb) cb(t);
    });
    // 소품(상자 · 통)도 맞음
    H().targets().forEach(function (t) {
      if (!t || !t.isProp || (done && done[t.id])) return;
      if (!inBox(t, x, z, R, D)) return;
      if (done) done[t.id] = true;
      hitT(st, t, x, z - 20, t.x > x ? 1 : -1, mul, wk);
    });
  }
  function stOf(h, d) { return api().stOf(h, d); }

  // ---------- 화살 ----------
  //   a = { x, y(화면 높이), z(걷는 줄), dir, vx, vy, vz(줄 바꿈 /초), range, trav, w, h, depth, pierce(남은 꿰뚫기), done{}, st, mul, wk,
  //         art, sx, rot, home(따라갈 적), ground(땅에 닿으면 끝), big, onHit(a, t), onEnd(a), push(밀고 감), col(속성 빛) }
  var arrows = [];
  function shoot(o) {
    o.trav = 0; o.t = 0; o.done = {}; o.dead = false;
    o.w = o.w || 24; o.h = o.h || 10; o.depth = o.depth || 16; o.sx = o.sx || 1;
    if (o.vx == null) o.vx = o.speed * o.dir;
    if (o.vy == null) o.vy = 0;
    arrows.push(o);
    return o;
  }
  function arrowBox(a) {
    var hw = a.w / 2, cx = a.x - Math.sign(a.vx || a.dir) * hw * 0.6;
    return { x0: cx - hw, x1: cx + hw, y0: a.y - a.h / 2, y1: a.y + a.h / 2 };
  }
  function arrowStep(a, dt) {
    var sp = Math.hypot(a.vx, a.vy), move = sp * dt / 1000, steps = Math.max(1, Math.ceil(move / 7));
    for (var s = 0; s < steps && !a.dead; s++) {
      if (a.home && alive(a.home)) {   // 따라가는 화살: 적 몸 가운데 쪽으로 꺾음
        var hb0 = a.home.hurtbox(), tx = (hb0.x0 + hb0.x1) / 2, ty = (hb0.y0 + hb0.y1) / 2, ang = Math.atan2(ty - a.y, tx - a.x), cur = Math.atan2(a.vy, a.vx);
        var da = ((ang - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI, turn = (a.turn || 9) * dt / 1000 / steps;
        cur += clamp(da, -turn, turn); a.vx = Math.cos(cur) * sp; a.vy = Math.sin(cur) * sp; a.z += (a.home.y - a.z) * Math.min(1, 6 * dt / 1000 / steps);
      }
      var m = move / steps;
      a.x += a.vx / sp * m; a.y += a.vy / sp * m; a.z += (a.vz || 0) * dt / 1000 / steps; a.trav += m;
      if (a.vz) a.y += (a.vz || 0) * dt / 1000 / steps;   // 줄을 바꾸면 화면 높이도 같이
      var b = arrowBox(a), hit = null, best = 1e9;
      H().targets().forEach(function (t) {
        if (!t || a.done[t.id || 'dummy'] || !H().canHit(t, a.st)) return;
        var hb = t.hurtbox();
        if (Math.abs(hb.z - a.z) > a.depth || hb.x0 > b.x1 || hb.x1 < b.x0 || hb.y0 > b.y1 || hb.y1 < b.y0) return;
        var d = (t.x - a.x) * Math.sign(a.vx || a.dir);
        if (d < best) { best = d; hit = t; }
      });
      if (hit) {
        a.done[hit.id || 'dummy'] = true;
        if (a.onHit) a.onHit(a, hit); else arrowHit(a, hit);
        if (a.pierce-- <= 0) { a.dead = true; if (a.onEnd) a.onEnd(a, hit); }
      }
      if (!a.dead && a.push) arrowPush(a, b);
      if (!a.dead && (a.trav >= a.range || (a.ground && a.y >= a.z - 2))) { a.dead = true; if (a.onEnd) a.onEnd(a, null); else if (a.ground) spawn('ar_arrow_hit', a.x, a.z - 4, { sx: 0.6 }); }
    }
    a.t += dt;
  }
  function arrowHit(a, t) {
    var hb = t.hurtbox(), x = clamp(a.x, hb.x0, hb.x1), y = clamp(a.y, hb.y0 + 2, hb.y1 - 2);
    hitT(a.st, t, x, y, Math.sign(a.vx || a.dir), a.mul, a.wk);
    spawn(g('ar_arrow_hit', a.skill), x, y, { sx: (a.big ? 1.1 : 0.7) * (0.9 + Math.random() * 0.2), dir: Math.sign(a.vx || a.dir) });
    if (a.big) debris(x, y, t.y, 6, { cols: ['#ffffff', '#d8fff0', a.col || '#7affc0'], glow: true, sp: 180, size: 1.4, ms: 300, spread: 1.4 });
  }
  // 대포 화살: 닿은 잡몹을 화살 앞으로 밀고 감
  function arrowPush(a, b) {
    H().targets().forEach(function (t) {
      if (!pullable(t) || t.state === 'down') return;
      var hb = t.hurtbox();
      if (Math.abs(hb.z - a.z) > a.depth || hb.x0 > b.x1 + 4 || hb.x1 < b.x0) return;
      var front = a.x + Math.sign(a.vx) * 6;
      if ((t.x - front) * Math.sign(a.vx) < 0) t.x = front;
    });
  }
  function drawArrow(ctx, camX, a) {
    var F = AFX[a.art.replace(/_[ab]$/, '')] || AFX.ar_arrow_fly, i = Math.floor(a.t * F.fps / 1000) % F.n, d = a.vx < 0 ? -1 : 1;
    var rot = Math.atan2(a.vy, Math.abs(a.vx)) * d, fade = a.fade && a.range - a.trav < a.fade ? Math.max(0, (a.range - a.trav) / a.fade) : 1;
    if (a.col) {   // 무기 속성 빛(작은 빛 하나, 2026-11-09)
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 * fade;
      var gx = a.x - camX - d * a.w * 0.3, gr = ctx.createRadialGradient(gx, a.y, 0, gx, a.y, a.h * 1.2 + 4);
      gr.addColorStop(0, a.col); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(gx - 40, a.y - 30, 80, 60); ctx.restore();
    }
    aiDraw(ctx, a.art, i, a.x - camX, a.y, a.sx * d, a.sy || a.sx, rot, fade);
  }

  // 무기(활) 속성 색: 화살에 빛으로(강화 · 속성, enchant.js 와 같은 색)
  function elCol() {
    var W = window.Growth && Growth.weapon && Growth.weapon('archer'), E = CFG().enchant;
    var els = W && W.els ? W.els() : [];
    return els.length && E && E.el[els[0]] ? E.el[els[0]].col : null;
  }
  function reachMul(p) { return (p && p.reachMul) || 1; }

  // ---------- 평타 화살 (main.js castMagic → kind 'arrow') ----------
  function basicShot(p, st) {
    var c = st.cast, awk = !!p.awkArrow, n = (c.n || 1) + (awk ? 1 : 0), col = elCol();
    for (var i = 0; i < n; i++) {
      var lane = c.lanes && c.lanes[i] != null ? c.lanes[i] * AS() : (i - (n - 1) / 2) * 12 * AS();
      shoot({ x: p.x + p.dir * c.x, y: p.y + c.y + lane * 0.5, z: p.y + lane, dir: p.dir, speed: c.speed, range: c.range * reachMul(p),
              w: c.box.w, h: c.box.h, depth: c.depth, pierce: (c.pierce || 0) + (awk ? 2 : 0), st: st, wk: p.weaponKey, mul: 1,
              art: c.art === 'pfly' ? 'ar_arrow_pfly' : 'ar_arrow_fly', sx: c.art === 'pfly' ? 0.9 : 0.75, big: !!c.big, fade: 30, col: col });
    }
    if (c.big) { spawn('ar_charge_flash', p.x + p.dir * c.x, p.y + c.y, { sx: 0.7, dir: p.dir }); snd('bowHeavy'); }
  }
  // 달리며 공격(미끄러지며 바람 화살) · 점프 공격(아래 앞으로 화살 2발)
  var RUN_ST = { dmg: 1.3, hitstop: 1.0, knock: 1.8, shake: 1.0, spark: 1.0, big: true, hitsDown: true, cast: { kind: 'arrow' } };
  var JUMP_ST = { dmg: 0.9, hitstop: 0.7, knock: 1.0, shake: 0.7, spark: 0.9, hitsDown: true, atTarget: true, cast: { kind: 'arrow' } };
  function moveShot(p, kind) {
    var col = elCol(), awk = !!p.awkArrow;
    if (kind === 'jump') {
      [22, 34].concat(awk ? [46] : []).forEach(function (deg, i) {
        var a = deg * Math.PI / 180, sp = 600 * AS() / 0.55;
        shoot({ x: p.x + p.dir * 28 * AS(), y: p.y - (p.z || 0) - 50 * AS(), z: p.y, dir: p.dir, vx: Math.cos(a) * sp * p.dir, vy: Math.sin(a) * sp, speed: sp,
                range: 260 * AS() / 0.55, w: 22 * AS(), h: 14 * AS(), depth: 22 * AS(), pierce: awk ? 2 : 0, ground: true, st: JUMP_ST, wk: p.weaponKey,
                art: 'ar_arrow_fly', sx: 0.75, col: col });
      });
    } else {
      shoot({ x: p.x + p.dir * 30 * AS(), y: p.y - 40 * AS(), z: p.y, dir: p.dir, speed: 700 * AS() / 0.55, range: 230 * AS() / 0.55, w: 34 * AS(), h: 18 * AS(),
              depth: 18 * AS(), pierce: 2 + (awk ? 2 : 0), st: RUN_ST, wk: p.weaponKey, art: 'ar_arrow_pfly', sx: 0.85, big: true, col: col, fade: 30 });
    }
  }

  // ---------- 기술 (skills.js advance → step) ----------
  // s = 기술 진행(s.area = Lv 크기, s.mul = Lv 데미지, s.L.lv5 = Lv5 덤, s.br = 갈래 맛)
  var fxs = [];   // 기술 효과(시간이 흐르는 것): 바람 기둥 · 화살비 · 저격 · 천공 · 덫 · 회오리 · 천 개의 화살
  function step(p, d, s, t0, t1) {
    var C = d.arc;
    if (!s.arc) s.arc = { fired: 0, t: 0 };
    var S = s.arc;
    // 기술마다 처음 한 번(시작) 연출: 무릎 꿇는 기술은 활 앞 기 모으기
    if (!S.pre) {
      S.pre = true;
      if (d.motion === 'motion_shoot') spawn('ar_charge_charge', 0, 0, { follow: p, ox: 30 * AS(), oy: -34 * AS(), loop: true, life: Math.max(200, C.at), fade: 80, sx: 0.8, add: true });
      if (C.kind === 'volley') { spawn(g('ar_leap_wind', true), p.x, p.y + 1, { sx: 1.0, dir: p.dir }); }
    }
    if (C.kind === 'volley' && !S.arcFx && t1 >= (d.move ? d.move.from : 0)) { S.arcFx = true; spawn(g('ar_leap_arc', true), 0, 0, { follow: p, ox: -10 * AS(), oy: -44 * AS(), sx: 0.9, a: 0.9 }); }
    if (t1 < C.at) return;
    var K = KIND[C.kind];
    if (K) K(p, d, s, C, S, t0, t1);
  }
  function lv5(s, k, def) { return s.L && s.L.lv5 && s.L.lv5[k] != null ? s.L.lv5[k] : def; }
  function skillArrow(p, d, s, C, o) {
    var st = stOf(C.hit, d), col = elCol(), k = s.area || 1;
    return shoot(Object.assign({ x: p.x + p.dir * C.x, y: p.y + C.y, z: p.y, dir: p.dir, speed: C.speed, range: C.range * reachMul(p), w: (C.w || 26) * k, h: (C.h || 12) * k,
                                 depth: (C.depth || 18) * k, pierce: C.pierce != null ? C.pierce : 99, st: st, mul: s.mul, wk: p.weaponKey, skill: true, col: col, fade: 40 }, o || {}));
  }
  var KIND = {
    // 관통 화살: 바람 화살(꿰뚫음) + 지나간 줄 빛
    pierce: function (p, d, s, C, S, t0, t1) {
      var n = 1 + lv5(s, 'extra', 0);
      while (S.fired < n && t1 >= C.at + S.fired * (C.gapMs || 140)) {
        var k = s.area || 1, dy = S.fired ? -8 * AS() : 0;
        var a = skillArrow(p, d, s, C, { art: g('ar_pierce_bolt', true), sx: 0.55 * k, sy: 0.5 * k, y: p.y + C.y + dy, big: true });
        a.trailT = 0; a.trail = g('ar_pierce_trail', true);
        spawn('ar_charge_flash', p.x + p.dir * C.x, p.y + C.y + dy, { sx: 0.9 * k, dir: p.dir });
        api().doFlash({ color: '#e8fff4', alpha: 0.18, ms: 90 });
        snd('bowHeavy'); S.fired++;
      }
    },
    // 솟구치는 화살: 앞 땅에 바람 기둥(그림 8장) → delayMs 뒤 띄움
    geyser: function (p, d, s, C, S, t0, t1) {
      if (!S.fired) {
        S.fired = 1; var k = s.area || 1, x = p.x + p.dir * C.x * k;
        S.x = x; S.z = p.y;
        spawn(g('ar_up_rise', true), x, p.y + 2, { sx: 0.62 * k, dir: p.dir });
        snd('bowShot');
      }
      if (!S.hit && t1 >= C.at + (C.delayMs || 100)) {
        S.hit = true; var k2 = s.area || 1, st = stOf(C.hit, d);
        hitArea(st, S.x, S.z, C.r * k2, C.depth * k2, s.mul, p.weaponKey, {});
        wave(S.x, S.z, C.r * 1.4 * k2, { flat: 0.3, w: 3, ms: 300, color: '#e8fff4', glow: '#7affc0', ground: true });
        debris(S.x, S.z - 20 * AS(), S.z, 10, { cols: ['#ffffff', '#c8ffe0', '#7affc0'], glow: true, sp: 260, size: 1.4, ms: 420, spread: 0.5, g: 200 });
        snd('skUpper');
      }
    },
    // 부채꼴: n 발이 위아래(줄)로 퍼짐
    fan: function (p, d, s, C, S) {
      if (S.fired) return; S.fired = 1;
      var n = lv5(s, 'n', C.n) + (p.awkArrow ? 2 : 0), L = C.lanes;
      for (var i = 0; i < n; i++) {
        var lane = (L[i] != null ? L[i] : (i - n / 2) * 15) * AS() / 0.55;
        skillArrow(p, d, s, C, { vz: lane * 2.4, art: g('ar_arrow_pfly', true), sx: 0.8, pierce: C.pierce + (p.awkArrow ? 2 : 0) });
      }
      spawn('ar_charge_flash', p.x + p.dir * C.x, p.y + C.y, { sx: 0.9, dir: p.dir });
      snd('bowHeavy');
    },
    // 화살비 · 화살 폭풍: 앞쪽(가까운 적 쪽) 땅에 화살비
    rain: function (p, d, s, C, S) {
      if (S.fired) return; S.fired = 1;
      var k = s.area || 1, t = C.aim ? aim(p, C.aim, 'near') : null, x = t ? t.x : p.x + p.dir * C.x;
      fxs.push({ kind: 'rain', p: p, d: d, C: C, x: x, z: t ? t.y : p.y, dir: p.dir, k: k, mul: s.mul, wk: p.weaponKey, t: -(C.delayMs || 0), tick: 0, dropT: 0,
                 st: stOf(C.hit, d), last: stOf(C.last, d), br: !!s.br && d.id === 'rain', lv: s.L.lv });
      snd('bowHeavy');
      for (var i = 0; i < 4; i++) shoot({ x: p.x + p.dir * 10 * AS(), y: p.y - 70 * AS(), z: p.y, dir: p.dir, vx: p.dir * (60 + i * 30), vy: -700, speed: 720, range: 160, w: 6, h: 6,
                                          depth: 1, pierce: -1, st: { dmg: 0 }, art: 'ar_arrow_fly', sx: 0.6, onHit: function () {}, fade: 60 });
    },
    // 공중제비 사격: 공중에서 아래 앞으로 n 발
    volley: function (p, d, s, C, S) {
      if (S.fired) return; S.fired = 1;
      var n = C.n + (p.awkArrow ? 1 : 0);
      for (var i = 0; i < n; i++) {
        var deg = C.angs[i] != null ? C.angs[i] : 30 + i * 8, a = deg * Math.PI / 180, sp = C.speed;
        skillArrow(p, d, s, C, { x: p.x + p.dir * C.x, y: p.y - (p.z || 0) + C.y, vx: Math.cos(a) * sp * p.dir, vy: Math.sin(a) * sp, ground: true,
                                 art: g('ar_arrow_pfly', true), sx: 0.75, w: 26, h: 18, depth: 22, pierce: 1,
                                 onEnd: function (q) { if (q.y >= q.z - 4) spawn(g('ar_leap_wind', true), q.x, q.z + 1, { sx: 0.5 }); } });
      }
      snd('bowShot');
    },
    // 폭발 화살: 처음 맞은 적(또는 끝)에서 크게 터짐
    bomb: function (p, d, s, C, S) {
      if (S.fired) return; S.fired = 1;
      var k = s.area || 1, br = !!s.br, st = stOf(C.hit, d);
      skillArrow(p, d, s, C, { art: g('ar_burst_arrow', true), sx: 0.8, pierce: 0, w: 30, h: 16, onHit: function () {},
        onEnd: function (a, t) {
          var x = t ? clamp(a.x, t.hurtbox().x0, t.hurtbox().x1) : a.x, z = t ? t.y : a.z;
          spawn(g('ar_burst_boom', br), x, z - 30 * AS(), { sx: C.r * 2 * k / 85 * 0.9, dir: a.dir });
          hitArea(st, x, z, C.r * k, C.depth * k, s.mul, p.weaponKey, {});
          wave(x, z, C.r * 1.2 * k, { flat: 0.3, w: 4, ms: 380, color: '#fff0d0', glow: br ? (brNow === 'a' ? '#7fc8ff' : '#9dff5a') : '#ff8a3a', ground: true });
          api().doFlash({ color: '#ffd0a0', alpha: 0.25, ms: 120 });
          snd('fireball');
        } });
      snd('bowHeavy');
    },
    // 저격: 가장 센 적 조준 → lockMs 뒤 빛줄기(한 줄 전부)
    snipe: function (p, d, s, C, S, t0, t1) {
      if (!S.fired) {
        S.fired = 1; S.t = aim(p, C.aim, 'strong');
        fxs.push(S.fx = { kind: 'aim', p: p, t: 0, life: C.lockMs, tgt: S.t, C: C, dir: p.dir });
        snd('charge');
      }
      if (!S.shot && t1 >= C.at + C.lockMs) {
        S.shot = true;
        var k = s.area || 1, y = p.y + C.y, x0 = p.x + p.dir * C.x, len = C.len * reachMul(p), first = S.t && alive(S.t) ? S.t : null;
        var st = stOf(C.hit, d), ls = stOf(C.line, d), done = {};
        if (first) { done[first.id || 'dummy'] = true; var hb = first.hurtbox(); hitT(st, first, clamp(x0 + p.dir * 20, hb.x0, hb.x1), (hb.y0 + hb.y1) / 2, p.dir, s.mul, p.weaponKey);
                     spawn('sn_snipe_hit', first.x, (hb.y0 + hb.y1) / 2, { sx: 1.3 * k }); }
        foes(ls).forEach(function (t) {
          if (done[t.id || 'dummy']) return;
          var hb2 = t.hurtbox(), lo = Math.min(x0, x0 + p.dir * len), hi = Math.max(x0, x0 + p.dir * len);
          if (Math.abs(hb2.z - p.y) > C.depth * k || hb2.x1 < lo || hb2.x0 > hi || hb2.y0 > y + 10 || hb2.y1 < y - 10) return;
          hitT(ls, t, t.x, y, p.dir, s.mul, p.weaponKey); spawn('sn_snipe_hit', t.x, y, { sx: 0.7 * k });
        });
        fxs.push({ kind: 'beam', x: x0, y: y, dir: p.dir, len: len, k: k, t: 0, life: 360 });
        api().doFlash({ color: '#e8f6ff', alpha: 0.35, ms: 140 });
        snd('bowHeavy'); snd('holyBolt');
      }
    },
    // 대포 화살: 느리고 거대한 화살(꿰뚫음 + 밀고 감) + 뒤로 충격 고리
    ballista: function (p, d, s, C, S) {
      if (S.fired) return; S.fired = 1;
      var k = s.area || 1;
      var a = skillArrow(p, d, s, C, { art: 'sn_ballista_bolt', sx: 1.0 * k, push: C.push, big: true, col: '#bfe6ff' });
      a.ringT = 0; a.ring = true;
      spawn('sn_ballista_ring', p.x + p.dir * C.x, p.y + C.y, { sx: 1.0 * k, dir: p.dir });
      api().doFlash({ color: '#d8f0ff', alpha: 0.3, ms: 120 });
      snd('bowHeavy'); snd('skDash');
    },
    // 속사: gapMs 마다 바람 화살
    rapid: function (p, d, s, C, S, t0, t1) {
      var n = lv5(s, 'n', C.n) + (p.awkArrow ? 3 : 0);
      while (S.fired < n && t1 >= C.at + S.fired * C.gapMs) {
        var dy = ((S.fired % 3) - 1) * 6 * AS();
        skillArrow(p, d, s, C, { art: 'ar_arrow_pfly_a', sx: 0.85, y: p.y + C.y + dy, z: p.y + dy * 0.6, big: true });
        spawn('ar_charge_flash', p.x + p.dir * C.x, p.y + C.y + dy, { sx: 0.5, dir: p.dir });
        snd('bowShot'); S.fired++;
      }
    },
    // 천공의 일격: 가장 센 적 발밑에 과녁 → 거대한 빛 화살 내리꽂힘
    skyfall: function (p, d, s, C, S) {
      if (S.fired) return; S.fired = 1;
      var t = aim(p, C.aim, 'strong'), k = s.area || 1;
      fxs.push({ kind: 'sky', p: p, d: d, C: C, tgt: t, x: t ? t.x : p.x + p.dir * C.x, z: t ? t.y : p.y, k: k, mul: s.mul, wk: p.weaponKey, t: 0,
                 st: stOf(C.hit, d), ring: stOf(C.ring, d) });
      for (var i = 0; i < 3; i++) shoot({ x: p.x + p.dir * 6 * AS(), y: p.y - 80 * AS(), z: p.y, dir: p.dir, vx: 0.01 * p.dir, vy: -900, speed: 900, range: 200, w: 4, h: 4,
                                          depth: 1, pierce: -1, st: { dmg: 0 }, art: 'ar_arrow_pfly_a', sx: 0.8, onHit: function () {}, fade: 80 });
      snd('bowHeavy');
    },
    // 덫: 앞쪽 땅에 n 개 → 밟으면 묶고 가시 덩굴 터짐
    trap: function (p, d, s, C, S) {
      if (S.fired) return; S.fired = 1;
      var n = lv5(s, 'n', C.n);
      for (var i = 0; i < n; i++) {
        var x = p.x + p.dir * C.xs[i] * AS() / 0.55;
        fxs.push({ kind: 'trap', p: p, d: d, C: C, x: x, z: p.y + ((i % 2) ? 10 : -6) * AS(), t: -i * 90, k: s.area || 1, mul: s.mul, wk: p.weaponKey, st: stOf(C.hit, d), armed: false, snap: -1 });
      }
      snd('bowShot');
    },
    // 회오리 화살: 천천히 나아가며 끌어당기고 여러 번 → 끝에 터짐
    twister: function (p, d, s, C, S) {
      if (S.fired) return; S.fired = 1;
      fxs.push({ kind: 'twist', p: p, d: d, C: C, x: p.x + p.dir * C.x, z: p.y, dir: p.dir, k: s.area || 1, mul: s.mul, wk: p.weaponKey, t: 0, tick: 0,
                 st: stOf(C.hit, d), last: stOf(C.last, d), ms: C.ms * (1 + 0.08 * ((s.L.lv || 1) - 1)) });
      snd('skSpin');
    },
    // 천 개의 화살: 화면 안 적마다 화살 묶음이 n 번
    barrage: function (p, d, s, C, S) {
      if (S.fired) return; S.fired = 1;
      fxs.push({ kind: 'barrage', p: p, d: d, C: C, n: lv5(s, 'n', C.n), t: 0, wave: 0, k: s.area || 1, mul: s.mul, wk: p.weaponKey, st: stOf(C.hit, d), last: stOf(C.last, d) });
      for (var i = 0; i < 6; i++) shoot({ x: p.x + (i - 3) * 6, y: p.y - 80 * AS(), z: p.y, dir: p.dir, vx: (i - 3) * 30 + 0.01, vy: -900, speed: 900, range: 220, w: 4, h: 4,
                                          depth: 1, pierce: -1, st: { dmg: 0 }, art: 'ar_arrow_pfly_b', sx: 0.7, onHit: function () {}, fade: 80 });
      snd('bowHeavy');
    }
  };
  // 화면 보이는 범위(천 개의 화살): main.js 의 카메라를 모르니 플레이어 둘레 화면 반쯤
  function onScreen(p, t) { return Math.abs(t.x - p.x) < 280; }
  function fxStep(o, dt) {
    o.t += dt;
    var P = api(), C = o.C;
    if (o.kind === 'rain') {
      var w = C.w * o.k, ms = C.ms * (1 + 0.06 * ((o.lv || 1) - 1));
      if (C.move) o.x += o.dir * C.move * dt / 1000;
      if (o.t < 0) return true;
      o.dropT -= dt;
      while (o.dropT <= 0 && o.t < ms) {   // 떨어지는 화살 묶음(그림) — 화면에 고르게
        o.dropT += 70 / (C.density || 1);
        var rx = o.x + (Math.random() * 2 - 1) * w, rz = o.z + (Math.random() * 2 - 1) * C.depth * o.k * 0.7;
        fxs.push({ kind: 'drop', x: rx, z: rz, t: 0, fall: 160, art: g('ar_rain_fall', o.br), land: g('ar_rain_land', o.br), s: 0.55 + Math.random() * 0.2 });
      }
      o.tick -= dt;
      if (o.tick <= 0 && o.t < ms) { o.tick += C.tickMs; P.atLv(o.lv, function () { hitArea(o.st, o.x, o.z, w, C.depth * o.k, o.mul, o.wk, null); }); }
      if (o.t >= ms && !o.end) {
        o.end = true;
        P.atLv(o.lv, function () { hitArea(o.last, o.x, o.z, w, C.depth * o.k, o.mul, o.wk, {}); });
        for (var i = -2; i <= 2; i++) spawn(g('ar_rain_land', o.br), o.x + i * w / 2.5, o.z + (i % 2) * 6, { sx: 0.9, delay: Math.abs(i) * 30 });
        wave(o.x, o.z, w * 1.2, { flat: 0.28, w: 4, ms: 380, color: '#fff6c8', glow: '#ffd23f', ground: true });
        snd('skSlam');
        return false;
      }
      return true;
    }
    if (o.kind === 'drop') {
      if (o.t >= o.fall && !o.landed) {
        o.landed = true; spawn(o.land, o.x, o.z + 1, { sx: o.s * 0.8 });
        var Q = o.hit; if (Q && alive(Q.t)) hitT(Q.st, Q.t, Q.t.x, Q.t.y - 20 * AS(), Math.random() < 0.5 ? -1 : 1, Q.mul, Q.wk);   // 천 개의 화살: 떨어지는 순간 맞음
      }
      return o.t < o.fall + 40;
    }
    if (o.kind === 'aim' || o.kind === 'beam') return o.t < o.life;
    if (o.kind === 'sky') {
      var M = C.markMs, F = C.fallMs;
      if (o.tgt && alive(o.tgt) && o.t < M - 90) { o.x = o.tgt.x; o.z = o.tgt.y; }
      if (o.t >= M + F && !o.boom) {
        o.boom = true;
        var R = C.r * o.k, done = {};
        spawn('sn_sky_hit', o.x, o.z + 2, { sx: R * 2 / 140 * 1.1 });
        hitArea(o.st, o.x, o.z, R * 0.6, C.depth * o.k, o.mul, o.wk, done);
        hitArea(o.ring, o.x, o.z, R * 1.15, C.depth * o.k * 1.2, o.mul, o.wk, done);
        wave(o.x, o.z, R * 1.5, { flat: 0.28, w: 6, ms: 520, color: '#ffffff', glow: '#9fd8ff', ground: true });
        P.doFlash({ color: '#ffffff', alpha: 0.55, ms: 220 }); H().hitstop(90); if (window.FX && window.FX.shake) window.FX.shake(CFG().juice.shakePx * 3.5, 500);
        snd('skSlam'); snd('holyBolt');
      }
      return o.t < M + F + 400;
    }
    if (o.kind === 'trap') {
      if (o.t < 0) return true;
      if (!o.armed && o.t > 260) o.armed = true;
      var T = C, life = T.lifeMs;
      if (o.snap < 0 && o.armed) {
        var trig = foes(o.st).some(function (t) { return inBox(t, o.x, o.z, T.trig * AS() / 0.55, 22 * AS() / 0.55); });
        if (trig || o.t >= life) { o.snap = 0; snd('block'); }
      }
      if (o.snap >= 0) {
        o.snap += dt;
        if (!o.boomed && o.snap >= 140) {
          o.boomed = true;
          spawn('rg_trap_vine', o.x, o.z + 2, { sx: 1.2 * o.k });
          hitArea(o.st, o.x, o.z, T.r * o.k, T.depth * o.k, o.mul, o.wk, {});
          wave(o.x, o.z, T.r * 1.2 * o.k, { flat: 0.3, w: 3, ms: 320, color: '#ffe8a0', glow: '#9dff5a', ground: true });
          snd('skSlam', { v: 0.6 });
        }
        return o.snap < 420;
      }
      return true;
    }
    if (o.kind === 'twist') {
      var r = C.r * o.k;
      if (o.t < o.ms) {
        o.x += o.dir * C.speed * dt / 1000;
        foes().forEach(function (t) {   // 끌어당김(보스 · 큰 적 빼고)
          if (!pullable(t)) return;
          var dx = o.x - t.x, dz = o.z - t.y, dd = Math.hypot(dx, dz * 2);
          if (dd > C.pullR * o.k || dd < 4) return;
          var m = Math.min(dd - 2, C.pull * dt / 1000);
          t.x += dx / dd * m; t.y += dz / dd * m * 0.5;
        });
        o.tick -= dt;
        if (o.tick <= 0) { o.tick += C.tickMs; hitArea(o.st, o.x, o.z, r, C.depth * o.k, o.mul, o.wk, null); }
        return true;
      }
      if (!o.end) {
        o.end = true;
        spawn('rg_twist_burst', o.x, o.z - 50 * AS() * o.k, { sx: 1.1 * o.k });
        hitArea(o.last, o.x, o.z, r * 1.5, C.depth * o.k * 1.2, o.mul, o.wk, {});
        wave(o.x, o.z, r * 2, { flat: 0.3, w: 4, ms: 400, color: '#e8fff0', glow: '#5aff9a', ground: true });
        snd('skSlam');
      }
      return false;
    }
    if (o.kind === 'barrage') {
      var due = Math.floor(o.t / C.gapMs);
      while (o.wave <= Math.min(due, o.n - 1)) {
        var lastW = o.wave === o.n - 1, st = lastW ? o.last : o.st;
        foes(st).forEach(function (t) {
          if (!onScreen(o.p, t)) return;
          fxs.push({ kind: 'drop', x: t.x + (Math.random() * 2 - 1) * 8, z: t.y + 1, t: 0, fall: 150, art: 'ar_rain_fall_b', land: 'ar_rain_land_b', s: lastW ? 0.95 : 0.6,
                     hit: { st: st, t: t, mul: o.mul, wk: o.wk } });
        });
        if (lastW) { api().doFlash({ color: '#fff6c8', alpha: 0.45, ms: 200 }); snd('skSlam'); }
        else snd('bowShot', { v: 0.5 });
        o.wave++;
      }
      return o.wave < o.n || o.t < o.n * C.gapMs + 200;
    }
    return false;
  }
  function drawFx(ctx, camX, o, under) {
    var P = api(), C = o.C;
    if (o.kind === 'drop' && !under) {
      if (o.landed) return;
      var u = o.t / o.fall, y = o.z - (1 - u) * 140 * AS() / 0.55;
      aiDraw(ctx, o.art, Math.floor(o.t / 70) % 4, o.x - camX, y, o.s, o.s, 0, Math.min(1, u * 3));
      return;
    }
    if (o.kind === 'rain' && under && o.t > -200) {   // 화살비 자리: 바닥 과녁 그림(사냥꾼 표식)을 납작하게
      var a = o.t < 0 ? 0.5 : 0.35;
      aiDraw(ctx, 'ar_mark_mark', Math.floor(performance.now() / 120) % 4, o.x - camX, o.z, C.w * o.k * 2 / 22 * 0.55, C.depth * o.k * 2 / 22 * 0.5, 0, a);
      return;
    }
    if (o.kind === 'aim' && !under) {   // 저격 조준: 은빛 빛줄기 그림을 가늘고 흐리게 + 대상 머리 위 과녁
      var t = o.tgt && alive(o.tgt) ? o.tgt : null, p = o.p, x0 = p.x + p.dir * C.x, y0 = p.y + C.y, k = o.t / o.life;
      var x1 = t ? t.x : x0 + p.dir * C.len, len = Math.abs(x1 - x0);
      aiDraw(ctx, 'sn_snipe_beam', Math.floor(o.t / 60) % 4, x1 - camX, y0, len / 240 * p.dir, 0.18 + 0.12 * k, 0, 0.25 + 0.35 * k);
      if (t) { var hb = t.hurtbox(); aiDraw(ctx, 'ar_mark_mark', Math.floor(o.t / 90) % 4, t.x - camX, (hb.y0 + hb.y1) / 2, 1.6 - 0.5 * k, 1.6 - 0.5 * k, o.t / 300, 0.9); }
      return;
    }
    if (o.kind === 'beam' && !under) {
      var kk = 1 - o.t / o.life;
      aiDraw(ctx, 'sn_snipe_beam', Math.floor(o.t / 50) % 4, o.x + o.dir * o.len - camX, o.y, o.len / 240 * o.dir, (0.9 + 0.5 * kk) * o.k, 0, Math.min(1, kk * 1.6));
      return;
    }
    if (o.kind === 'sky') {
      var M = C.markMs, F = C.fallMs;
      if (under && o.t < M + F) { var pk = 1 + 0.15 * Math.sin(o.t / 50); aiDraw(ctx, 'ar_mark_mark', Math.floor(o.t / 90) % 4, o.x - camX, o.z, C.r * o.k / 11 * 0.5 * pk, C.r * o.k / 11 * 0.18 * pk, 0, 0.85); }
      if (!under && o.t >= M - 60 && o.t < M + F) {
        var uu = clamp((o.t - M + 60) / (F + 60), 0, 1), yy = o.z - (1 - uu * uu) * 260 * AS() / 0.55;
        aiDraw(ctx, 'sn_sky_fall', Math.floor(o.t / 60) % 4, o.x - camX, yy, 1.3 * o.k, 1.3 * o.k, 0, 1);
      }
      return;
    }
    if (o.kind === 'trap' && under) {
      if (o.t < 0 || o.boomed && o.snap > 200) return;
      var fi = o.snap >= 0 ? (o.snap < 90 ? 2 : 3) : (o.armed ? 1 : 0);
      aiDraw(ctx, 'rg_trap_trap', fi, o.x - camX, o.z + 1, 0.9 * o.k, 0.9 * o.k, 0, 1);
      return;
    }
    if (o.kind === 'twist' && !under && o.t < o.ms) {
      var tk = o.k * (0.7 + 0.3 * ease(Math.min(1, o.t / 200)));
      aiDraw(ctx, 'rg_twist_loop', Math.floor(o.t / 70) % 4, o.x - camX, o.z + 2, tk * 0.9, tk * 0.9, 0, 0.92);
    }
  }

  // ---------- 늘 켜진 기술 ----------
  var pasT = { volley: 1500, splitIcd: 0 }, hawk = null, marked = [], vines = [];
  function pas(p, id) { var P = api(); return P && P.pasOf ? P.pasOf(p, id) : null; }
  function passiveStep(p, dt) {
    if (!p || p.classKey !== 'archer' || p.state === 'dead') { hawk = null; return; }
    // 자동 연사: val ms 마다 가까운 적 n 마리에게 빛 화살
    var q = pas(p, 'volley');
    if (q) {
      pasT.volley -= dt;
      if (pasT.volley <= 0) {
        var P = q.P, lv = q.lv - 1, R = P.find * AS() / 0.55, D = P.findDepth * AS() / 0.55;
        var L = foes().filter(function (t) { return Math.abs(t.x - p.x) <= R && Math.abs(t.y - p.y) <= D; });
        pasT.volley = L.length ? q.v : 400;
        if (L.length) {
          L.sort(function (a, b) { return Math.abs(a.x - p.x) - Math.abs(b.x - p.x); });
          var n = P.n[lv] || 3, st = P.hit, col = elCol();
          for (var i = 0; i < n; i++) {
            var t = L[i % L.length], ang = -Math.PI / 2 + (i - (n - 1) / 2) * 0.35, sp = 380;
            shoot({ x: p.x - p.dir * 6 * AS(), y: p.y - (p.z || 0) - 70 * AS(), z: p.y, dir: p.dir, vx: Math.cos(ang) * sp + 0.01, vy: Math.sin(ang) * sp, speed: sp, range: 600,
                    w: 14, h: 10, depth: 30, pierce: 0, st: st, mul: (P.mul[lv] || 1), wk: p.weaponKey, home: t, turn: 11, art: 'ar_mark_homing', sx: 0.8, col: col });
          }
          spawn('ar_charge_flash', p.x - p.dir * 6 * AS(), p.y - (p.z || 0) - 66 * AS(), { sx: 0.4, rot: -Math.PI / 2 * p.dir, dir: p.dir });
          snd('bowShot', { v: 0.5 });
        }
      }
    }
    // 매 동료
    var hq = pas(p, 'hawk');
    if (!hq) hawk = null;
    else {
      if (!hawk) hawk = { x: p.x, y: p.y - 90 * AS(), t: 0, cd: 1200, dive: null };
      var hk = hawk; hk.t += dt;
      if (!hk.dive) {
        var tx = p.x - p.dir * 16 * AS(), ty = p.y - (p.z || 0) - 92 * AS() + Math.sin(hk.t / 260) * 5;
        hk.x += (tx - hk.x) * Math.min(1, dt / 160); hk.y += (ty - hk.y) * Math.min(1, dt / 160); hk.dir = p.dir;
        hk.cd -= dt;
        if (hk.cd <= 0) {
          var HP = hq.P, R2 = HP.find * AS() / 0.55;
          var T2 = foes(HP.hit).filter(function (t) { return Math.abs(t.x - p.x) <= R2 && Math.abs(t.y - p.y) <= HP.findDepth * AS() / 0.55; })
                    .sort(function (a, b) { return Math.abs(a.x - p.x) - Math.abs(b.x - p.x); })[0];
          if (T2) { hk.dive = { t: 0, tgt: T2, x0: hk.x, y0: hk.y, hit: false }; hk.cd = hq.v; } else hk.cd = 300;
        }
      } else {
        var dv = hk.dive, tg = dv.tgt, dur = 240;
        dv.t += dt;
        if (!dv.hit) {
          var u = Math.min(1, dv.t / dur), hb = alive(tg) ? tg.hurtbox() : null, ex = hb ? tg.x : dv.x0 + hk.dir * 60, ey = hb ? (hb.y0 + hb.y1) / 2 : dv.y0 + 60;
          hk.dir = ex >= dv.x0 ? 1 : -1;
          hk.x = dv.x0 + (ex - dv.x0) * u; hk.y = dv.y0 + (ey - dv.y0) * u * u;
          if (u >= 1) {
            dv.hit = true; dv.t = 0;
            if (hb) { hitT(hq.P.hit, tg, ex, ey, hk.dir, hq.P.mul[hq.lv - 1] || 1, p.weaponKey); spawn('rg_hawk_hit', ex, ey, { sx: 1, dir: hk.dir }); snd('hit', { v: 0.5, k: 1.4 }); }
          }
        } else if (dv.t > 260) hk.dive = null;
      }
    }
    // 표식 시간
    for (var m = marked.length - 1; m >= 0; m--) { var e = marked[m]; e.arMarkT -= dt; if (!(e.arMarkT > 0) || !alive(e)) { e.arMarkT = 0; marked.splice(m, 1); } }
    // 갈래(레인저) 가시: dot
    for (var v = vines.length - 1; v >= 0; v--) {
      var t3 = vines[v];
      if (!(t3.arVineT > 0) || !alive(t3)) { t3.arVineT = 0; vines.splice(v, 1); continue; }
      t3.arVineT -= dt; t3.arVineN -= dt;
      if (t3.arVineN <= 0) {
        t3.arVineN += t3.arVineTw.vineTick || 500;
        var nn = Math.max(1, Math.round(t3.arVineDmg || 1));
        if (t3.hp != null && t3.maxHp) { nn = Math.min(nn, t3.hp - 1); if (nn > 0) t3.hp -= nn; }
        if (nn > 0) window.FX.damage(t3.x, t3.y - (t3.T ? t3.T.height : 60) - 6, nn, false, CFG().juice, '#b8ff7a', 'push', (t3.id || 'dummy') + ':vine', true);
        debris(t3.x, t3.y - (t3.T ? t3.T.height * 0.5 : 30), t3.y, 3, { cols: ['#3a6a10', '#9dff5a', '#e0ffa0'], glow: true, sp: 50, size: 1.3, ms: 360, g: -60, spread: 1.2 });
      }
    }
    if (pasT.splitIcd > 0) pasT.splitIcd -= dt;
  }
  // 작은 화살(갈래 화살 · 레인저 가시): from 적에서 둘레 다른 적 n 마리에게
  function splitFrom(p, t, n, R, D, st, mul, art) {
    var L = foes(st).filter(function (e) { return e !== t && Math.abs(e.x - t.x) <= R && Math.abs(e.y - t.y) <= D; })
                    .sort(function (a, b) { return Math.abs(a.x - t.x) - Math.abs(b.x - t.x); }).slice(0, n);
    var hb = t.hurtbox(), y = (hb.y0 + hb.y1) / 2;
    L.forEach(function (e, i) {
      var dir = e.x >= t.x ? 1 : -1, sp = 520;
      var a = shoot({ x: t.x, y: y, z: t.y, dir: dir, vx: dir * sp, vy: -80 - i * 40, speed: sp, range: R * 2, w: 12, h: 8, depth: 30, pierce: 0, st: st, mul: mul, wk: p.weaponKey,
                      home: e, turn: 14, art: art, sx: 0.9 });
      a.done[t.id || 'dummy'] = true;
    });
    return L.length;
  }

  // ---------- main.js onHit 갈고리 ----------
  function brTw(p, st) { var b = st && st.skId ? api().brOf(p, { id: st.skId }) : null; return b && b.tw ? b.tw : null; }
  function critAdd(p, st) {
    var n = 0, q = pas(p, 'focus'), q2 = pas(p, 'deadeye'), tw = brTw(p, st);
    if (q) n += q.v;
    if (q2) n += (q2.P.chance[q2.lv - 1] || 0) * q2.rk;
    if (tw && tw.acrit) n += tw.acrit;
    if (st && st.crit) n += 1;   // 저격: 늘 치명타
    return n;
  }
  function critDmg(p) {
    var n = 0, q = pas(p, 'focus'), q2 = pas(p, 'deadeye');
    if (q) n += (q.P.critDmg[q.lv - 1] || 0) * q.rk;
    if (q2) n += q2.v;
    return n;
  }
  function dmgMul(p, t) { if (!(t && t.arMarkT > 0)) return 1; var q = pas(p, 'mark'); return q ? 1 + q.v : 1; }
  function onHit(p, t, st, dmg, res) {
    if (!t || t.isProp || !st) return;
    // 갈래 화살: 평타 화살이 맞으면 작은 화살(icdMs 에 한 번)
    if (st.cast && st.cast.kind === 'arrow' && !(pasT.splitIcd > 0)) {
      var q = pas(p, 'split');
      if (q) {
        var P = q.P, lv = q.lv - 1;
        if (splitFrom(p, t, P.n[lv] || 1, P.r[lv] * AS() / 0.55, P.depth * AS() / 0.55, P.hit, q.v, 'ar_mark_split')) pasT.splitIcd = P.icdMs || 160;
      }
    }
    // 사냥꾼의 표식: 기술에 맞은 적
    if (st.damageStyle && res && res !== 'dead') {
      var mq = pas(p, 'mark');
      if (mq) { if (!(t.arMarkT > 0)) { marked.push(t); glow(t.x, t.y - (t.T ? t.T.height : 60) - 6, 18, '#ff8a4a', 220, 0.8); } t.arMarkT = mq.P.ms || 5000; }
    }
    // 2차 갈래 덤(1차 기술): 저격수 = 느려짐 / 레인저 = 가시 화살 + 가시 지속 피해
    var tw = brTw(p, st);
    if (tw && res && res !== 'dead' && alive(t)) {
      if (tw.slowMs && t.T && !t.T.boss) { if (!(t.slowT > tw.slowMs)) { t.slowT = tw.slowMs; t.slowK = tw.slowK || 0.65; t.slowDaze = false; } }
      if (tw.vineMs) {
        if (!(t.arVineT > 0)) { vines.push(t); t.arVineN = tw.vineTick || 500; }
        t.arVineT = tw.vineMs; t.arVineTw = tw; t.arVineDmg = Math.max(1, (dmg || 1) * (tw.vineDmg || 0.06));
      }
      if (tw.thorns && !st.arThorn) splitFrom(p, t, tw.thorns, 110, 40, THORN_ST(tw), 1, 'ar_mark_split_b');
    }
  }
  var thornSt = null;
  function THORN_ST(tw) { return thornSt || (thornSt = { dmg: tw.thornDmg || 0.3, hitstop: 0.2, knock: 0.3, shake: 0.3, spark: 0.7, noRage: true, noMp: true, noJuggle: true, numStyle: 'push', arThorn: true, damageStyle: undefined }); }

  // ---------- 매 장면 ----------
  function update(dt) {
    var p = H() && H().player && H().player();
    brNow = p && p.classKey === 'archer' && window.Growth && Growth.brOn ? Growth.brOn('archer') || null : null;
    for (var i = arrows.length - 1; i >= 0; i--) {
      var a = arrows[i];
      arrowStep(a, dt);
      if (a.trail && !a.dead) { a.trailT -= dt; if (a.trailT <= 0) { a.trailT = 55; spawn(a.trail, a.x - Math.sign(a.vx) * 50, a.y, { sx: 0.45, sy: 0.6, dir: Math.sign(a.vx), a: 0.8 }); } }
      if (a.ring && !a.dead) { a.ringT -= dt; if (a.ringT <= 0) { a.ringT = 110; spawn('sn_ballista_ring', a.x - Math.sign(a.vx) * 70, a.y, { sx: 0.8, a: 0.8 }); } }
      if (a.dead) arrows.splice(i, 1);
    }
    for (var j = fxs.length - 1; j >= 0; j--) if (!fxStep(fxs[j], dt)) fxs.splice(j, 1);
    passiveStep(p, dt);
  }
  function drawUnder(ctx, camX) { fxs.forEach(function (o) { drawFx(ctx, camX, o, true); }); }
  function drawOver(ctx, camX) {
    var P = api();
    fxs.forEach(function (o) { drawFx(ctx, camX, o, false); });
    arrows.forEach(function (a) { drawArrow(ctx, camX, a); });
    marked.forEach(function (e) { if (e.arMarkT > 0 && alive(e)) aiDraw(ctx, 'ar_mark_mark', Math.floor(performance.now() / 120) % 4, e.x - camX, e.y - (e.az || 0) - (e.T ? e.T.height : 60) - 10, 0.8, 0.8, 0, Math.min(1, e.arMarkT / 200)); });
    if (hawk) {
      var hk = hawk, dv = hk.dive && !hk.dive.hit;
      aiDraw(ctx, dv ? 'rg_hawk_dive' : 'rg_hawk_fly', Math.floor(hk.t / (dv ? 80 : 100)) % (dv ? 2 : 4), hk.x - camX, hk.y, 0.75 * (hk.dir || 1), 0.75, 0, 1);
    }
  }
  function clear() { arrows.length = 0; fxs.length = 0; marked.length = 0; vines.length = 0; hawk = null; pasT.volley = 1500; pasT.splitIcd = 0; }
  function busy() { return arrows.length + fxs.length > 0; }

  window.Archer = {
    basicShot: basicShot, moveShot: moveShot, step: step, update: update, drawUnder: drawUnder, drawOver: drawOver, clear: clear, busy: busy,
    critAdd: critAdd, critDmg: critDmg, dmgMul: dmgMul, onHit: onHit,
    _state: function () { return { arrows: arrows.length, fxs: fxs.length, hawk: !!hawk, marked: marked.length, br: brNow }; }
  };
})();
