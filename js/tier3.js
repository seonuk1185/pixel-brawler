// 3차 전직 기술(2026-11-10): 검성(기사 3차) · 현자(법사 3차) 기술 · 늘 켜진 기술(저절로 공격) · 몸 둘레 기운
//   수치 = config.js 의 T3_SKILLS(기술 t3) · SKILL_TREE 의 tier: 3(늘 켜진 기술 passive.stat 't3auto') · BRANCH_FX.<직업>.<갈래>.t3(1 · 2차 기술 3차 맛)
//   효과 그림 = 전부 AI 도트 그림(art/skill-fx/t3_* · art/ultimate → assets/fx/aifx/t3_*). 코드로 그리는 건 작은 빛 알갱이 · 둥근 빛뿐
//   skills.js 가 부르는 곳: Tier3.step(기술 진행, d.t3) · update · drawUnder · drawOver · clear · busy
//   나머지 3차(마검왕 · 심연술사 · 신궁 · 숲의 수호자 · 그림자 군주 · 역병술사)는 KIND 에 기술 종류를 더하고 config 에 t3: { kind } 를 적으면 됨
//   (pipeline/ai-sprite/t3/README.txt). 늘 켜진 기술 't3auto' 는 passive.art 로 모양을 고름(AUTO)
(function () {
  var A = null;
  function api() { return A || (A = window.Skills && Skills._api); }
  function H() { return api().H(); }
  function CFG() { return window.CFG; }
  function AS() { return (CFG() && CFG().actorScale) || 1; }
  function K() { return AS() / 0.55; }   // 거리 값(화면 도트, 0.55 기준) → 지금 크기
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function snd(n, o) { if (window.SFX) SFX.play(n, o); }

  // ---- AI 그림 묶음(togame.py 가 찍은 표: n = 장 수, pv = 기준점(1배 도트), fps) ----
  var AFX = {
    t3_sswave_fly:      { n: 4, pv: [45.5, 55.0], fps: 14 },   // 91x110 거대한 금빛 검기(반복)
    t3_sswave_hit:      { n: 4, pv: [55.0, 52.5], fps: 16 },   // 110x105 금빛 별 터짐
    t3_ssslash_line:    { n: 4, pv: [150.0, 101.5], fps: 14 }, // 300x203 일섬 가로 섬광
    t3_ssslash_sword:   { n: 4, pv: [35.0, 24.5], fps: 12 },   // 70x49 금빛 영검
    t3_sgorb_orb:       { n: 4, pv: [26.0, 23.0], fps: 14 },   // 52x46 원소 융합 구슬(반복)
    t3_sgorb_boom:      { n: 5, pv: [75.0, 71.5], fps: 14 },   // 150x143 원소 대폭발
    t3_sgcircle_circle: { n: 4, pv: [50.0, 36.0], fps: 12 },   // 100x72 땅의 원소 마법진
    t3_sgcircle_pillar: { n: 6, pv: [44.0, 150], fps: 14 },    // 88x150 원소 기둥(바닥)
    t3_judge_sword:     { n: 6, pv: [31.3, 118.0], fps: 14 },  // 63x120 천상의 심판 거대 성검(칼끝 = 땅)
    t3_judge_wave:      { n: 6, pv: [114.0, 70.7], fps: 14 },  // 228x74 금빛 충격파(바닥)
    t3_doom_circle:     { n: 3, pv: [68.4, 36.5], fps: 10 },   // 137x85 하늘 마법진
    t3_doom_rift:       { n: 4, pv: [85.5, 31.3], fps: 10 },   // 171x63 하늘 균열
    t3_doom_star:       { n: 2, pv: [51.3, 51.3], fps: 12 },   // 63x63 떨어지는 별(머리)
    t3_doom_impact:     { n: 1, pv: [36.5, 52.4], fps: 16 },   // 73x57 별이 닿는 번쩍
    t3_doom_hole:       { n: 6, pv: [62.7, 62.7], fps: 12 },   // 125x125 블랙홀
    // 마검왕(기사 3차 갈래 b, 2026-11-10): 거대 마검(칼끝 = 아래) · X자 마력 베기 · 마력 대폭발
    t3_mk_sword:        { n: 4, pv: [28.0, 120], fps: 12 },     // 56x120 거대 마검(칼끝 = 아래, 반복)
    t3_mk_x:            { n: 4, pv: [46.0, 36.5], fps: 14 },    // 92x73 X자 마력 베기(날아갈 땐 1 · 2장 반복)
    t3_mk_boom:         { n: 6, pv: [75.0, 32.5], fps: 14 }     // 150x65 마력 대폭발
  };
  (function reg() { var S = window.Skills && Skills._api; if (S) S.addAifx(AFX); })();

  function spawn(name, x, y, o) { return api().aiSpawn(name, x, y, o); }
  function aiOk(name) { return api().aiOk(name); }
  function aiDraw(ctx, name, i, x, y, sx, sy, rot, a) { var P = api(); if (!P.aiOk(name)) return false; return P.aiDraw(ctx, name, i, x, y, sx, sy, rot, a); }
  function glow(x, y, r, c, ms, a) { api().glow(x, y, r, c, ms, a); }
  function debris(x, y, f, n, o) { api().debris(x, y, f, n, o); }
  function wave(x, y, r, o) { api().wave(x, y, r, o); }
  function stOf(h, d) { return api().stOf(h, d); }
  function shake(k, ms) { if (window.FX && FX.shake) FX.shake(CFG().juice.shakePx * k, ms); }

  // ---- 대상 ----
  function alive(t) { return !!t && (!t.alive || t.alive()); }
  function foes(st) { var h = H(); return h.targets().filter(function (t) { return t && !t.isProp && alive(t) && (!st || h.canHit(t, st)); }); }
  function boss(t) { return !!(t && t.T && (t.T.boss || t.mid || t.raid)); }
  function pullable(t) { return !!(t && !t.isProp && t.T && !boss(t) && alive(t)); }
  var SCREEN = 330;   // 「화면 안」 = 플레이어에서 가로 이만큼(0.55 기준 도트)
  function onScreen(p, t) { return Math.abs(t.x - p.x) < SCREEN * K(); }
  function mid(t) { var hb = t.hurtbox(); return (hb.y0 + hb.y1) / 2; }
  function near(p, R, D) {
    var L = foes().filter(function (t) { return Math.abs(t.x - p.x) <= R && Math.abs(t.y - p.y) <= D; });
    L.sort(function (a, b) { return Math.abs(a.x - p.x) + Math.abs(a.y - p.y) * 0.5 - (Math.abs(b.x - p.x) + Math.abs(b.y - p.y) * 0.5); });
    return L;
  }
  function screenFoes(p, st, max) {
    var L = foes(st).filter(function (t) { return onScreen(p, t); });
    L.sort(function (a, b) { return Math.abs(a.x - p.x) - Math.abs(b.x - p.x); });
    return max ? L.slice(0, max) : L;
  }
  function hitT(st, t, x, y, dir, mul, p) {
    var h = H(); if (!h.canHit(t, st)) return false;
    h.onHit(st, t, { dir: dir, wk: p ? p.weaponKey : 'sword', x: x, y: y, mul: mul || 1 });
    return true;
  }
  function inBox(t, x, z, R, D) { var hb = t.hurtbox(); return Math.abs(hb.z - z) <= D && hb.x1 >= x - R && hb.x0 <= x + R; }
  function hitArea(st, p, x, z, R, D, mul, done, cb) {
    var n = 0;
    H().targets().forEach(function (t) {
      if (!t || !alive(t)) return;
      var id = t.id || 'dummy'; if (done && done[id]) return;
      if (!inBox(t, x, z, R, D)) return;
      if (done) done[id] = true;
      var hb = t.hurtbox();
      if (hitT(st, t, clamp(x, hb.x0, hb.x1), t.isProp ? z - 20 : (hb.y0 + hb.y1) / 2, Math.abs(t.x - x) < 3 ? p.dir : (t.x > x ? 1 : -1), mul, p)) n++;
      if (cb && !t.isProp) cb(t);
    });
    return n;
  }
  function pas(p, id) { var P = api(); return P && P.pasOf ? P.pasOf(p, id) : null; }
  function lv5(s, k, def) { return s.L && s.L.lv5 && s.L.lv5[k] != null ? s.L.lv5[k] : def; }

  // ---------- 날아가는 것(검기 · 융합 구슬): 곧게 나아가며 닿은 적을 한 번씩(꿰뚫음) ----------
  //   a = { p, x, y(화면 높이), z(걷는 줄), dir, speed, range, w, depth, st, mul, art, sx, fps, hitArt, hitSx, onEnd(a) }
  var shots = [];
  function shoot(o) { o.trav = 0; o.t = 0; o.done = {}; o.dead = false; shots.push(o); return o; }
  function shotStep(a, dt) {
    var m = a.speed * dt / 1000;
    a.x += a.dir * m; a.trav += m; a.t += dt;
    H().targets().forEach(function (t) {
      if (!t || !alive(t) || a.done[t.id || 'dummy']) return;
      if (!inBox(t, a.x, a.z, a.w / 2, a.depth)) return;
      a.done[t.id || 'dummy'] = true;
      if (hitT(a.st, t, t.x, t.isProp ? a.z - 20 : mid(t), a.dir, a.mul, a.p) && a.hitArt && !t.isProp) spawn(a.hitArt, t.x, mid(t), { sx: a.hitSx || 0.5 });
    });
    if (a.trav >= a.range) { a.dead = true; if (a.onEnd) a.onEnd(a); }
  }
  function drawShot(ctx, camX, a) {
    var A = AFX[a.art] || { n: 4, fps: 14 }, q = Math.floor(a.t * (a.fps || A.fps) / 1000), i = a.frames ? a.frames[q % a.frames.length] : q % A.n, fade = clamp((a.range - a.trav) / 60, 0, 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    aiDraw(ctx, a.art, i, a.x - camX, a.y, a.dir * a.sx, a.sx, 0, 0.95 * fade);
    ctx.restore();
  }

  // ---------- 기술 (skills.js advance → step) ----------
  var fxs = [];
  function step(p, d, s, t0, t1) {
    var C = d.t3;
    if (!s.t3) s.t3 = { fired: 0, done: {} };
    var S = s.t3, F = KIND[C.kind];
    if (F) F(p, d, s, C, S, t0, t1);
  }
  var KIND = {
    // 성검 파도: 한 바퀴 돈 끝에 거대한 금빛 검기 n 줄기(가운데 → 위 → 아래 …)를 gapMs 마다 날림
    sswave: function (p, d, s, C, S, t0, t1) {
      if (S.fired || t1 < C.at) return; S.fired = 1;
      var n = lv5(s, 'n', C.n), k = K(), st = stOf(C.hit, d), ar = s.area || 1;
      for (var i = 0; i < n; i++) fxs.push({ kind: 'later', t: -i * C.gapMs, fn: (function (i) { return function () {
        var lane = (C.lanes[i] || 0) * k;
        shoot({ p: p, x: p.x + p.dir * C.x * k, y: p.y + lane - 46 * k, z: p.y + lane, dir: p.dir, speed: C.speed * k, range: C.range * k, w: C.w * k * ar, depth: C.depth * ar,
                st: st, mul: s.mul, art: C.art || 't3_sswave_fly', frames: C.frames || null, sx: (C.sx || 1.15) * ar, hitArt: C.hitArt || 't3_sswave_hit', hitSx: 0.45,
                onEnd: C.boom ? function (a) { spawn(C.boom, a.x, a.y, { sx: (C.boomSx || 0.8) * ar }); } : null });
        glow(p.x + p.dir * C.x * k, p.y + lane - 46 * k, 40 * k, C.color || '#fff0a0', 200, 0.6);
        snd('skWave', { v: 0.8 });
      }; })(i) });
      api().doFlash({ color: '#fff4c0', alpha: 0.25, ms: 120 });
    },
    // 천검 강림: 화면 안 적마다 하늘에서 금빛 검 n 번 → 마지막 큰 성검 터짐
    ssrain: function (p, d, s, C, S, t0, t1) {
      if (S.fired || t1 < C.at) return; S.fired = 1;
      fxs.push({ kind: 'rain', p: p, C: C, n: lv5(s, 'n', C.n), t: 0, wave: 0, mul: s.mul, st: stOf(C.hit, d), last: stOf(C.last, d) });
      glow(p.x, p.y - 90 * K(), 60 * K(), C.color || '#fff0a0', 600, 0.7);
      snd('skHoly');
    },
    // 일섬: 돌진(config move) 동안 지나간 줄의 적을 가볍게 → cutAt 에 지나간 길 전체가 거대한 섬광으로 갈라짐
    ssflash: function (p, d, s, C, S, t0, t1) {
      var k = K(), x0 = Math.min(s.x0, p.x) - 20 * k, x1 = Math.max(s.x0, p.x) + 30 * k;
      if (!S.passSt) { S.passSt = stOf(C.hit, d); S.cutSt = stOf(C.cut, d); S.fx = s.x0; }
      if (t1 >= C.at && t1 < C.cutAt) {
        foes().forEach(function (t) {
          var id = t.id || 'dummy'; if (S.done[id]) return;
          var hb = t.hurtbox();
          if (Math.abs(hb.z - p.y) > C.depth || hb.x1 < x0 || hb.x0 > x1) return;
          S.done[id] = 1; hitT(S.passSt, t, t.x, mid(t), p.dir, s.mul, p);
          spawn('t3_ssslash_sword', t.x, mid(t), { sx: 0.6, dir: p.dir, add: true });
        });
      }
      if (!S.cut && C.cutAt != null && t1 >= C.cutAt) {
        S.cut = 1;
        var cx = (x0 + x1) / 2, len = Math.max(120 * k, x1 - x0 + 60 * k);
        fxs.push({ kind: 'line', x: cx, y: p.y - 40 * k, sx: len / 300 * 1.05, dir: p.dir, t: 0 });
        var hitN = 0;
        foes(S.cutSt).forEach(function (t) {
          var hb = t.hurtbox();
          if (Math.abs(hb.z - p.y) > C.depth * 1.4 || hb.x1 < x0 - 30 * k || hb.x0 > x1 + 30 * k) return;
          if (hitT(S.cutSt, t, t.x, mid(t), p.dir, s.mul, p)) { hitN++; spawn('t3_sswave_hit', t.x, mid(t), { sx: 0.7 }); }
        });
        api().doFlash({ color: '#ffffff', alpha: 0.5, ms: 200 }); H().hitstop(90); shake(3.2, 420);
        debris(cx, p.y - 40 * k, p.y, 18, { cols: ['#ffffff', '#fff0a0', '#ffd040'], glow: true, sp: 260, size: 1.6, ms: 520, g: 40, spread: 3 });
        snd('skSlam'); snd('holyBolt', { v: 0.8 });
      }
    },
    // 천상의 심판: 하늘의 작은 빛 n 번 → 거대한 성검이 내려와 꽂힘 → 금빛 충격파가 화면 안 모든 적을 날림
    ssjudge: function (p, d, s, C, S, t0, t1) {
      if (S.fired || t1 < C.at) return; S.fired = 1;
      var k = K();
      fxs.push({ kind: 'judge', p: p, C: C, t: 0, x: p.x + p.dir * C.x * k, z: p.y, dir: p.dir, mul: s.mul, ar: s.area || 1,
                 pre: stOf(C.pre, d), hit: stOf(C.hit, d), wv: stOf(C.wave, d), stage: 0, wave: 0 });
      glow(p.x, p.y - 100 * k, 70 * k, '#fff4c0', 900, 0.8);
      snd('charge'); snd('skHoly', { v: 0.7 });
    },
    // 차원 붕괴(마검왕): 앞으로 차원 균열이 n 번 줄지어 터짐(가까운 곳부터) → 마지막에 큰 마력 폭발
    mkrift: function (p, d, s, C, S, t0, t1) {
      if (S.fired || t1 < C.at) return; S.fired = 1;
      var k = K(), ar = s.area || 1, n = lv5(s, 'n', C.n), st = stOf(C.hit, d), last = stOf(C.last, d), x0 = p.x, z = p.y, dir = p.dir, mul = s.mul;
      for (var i = 0; i < n; i++) fxs.push({ kind: 'later', t: -i * C.gapMs, fn: (function (i) { return function () {
        var x = x0 + dir * (C.x + i * C.step) * k, fin = i === n - 1;
        spawn('rift_rift', x, z - 30 * k, { sx: (fin ? 1.6 : 1.1) * ar, dir: dir });
        if (fin) spawn('t3_mk_boom', x, z - 36 * k, { sx: 2.0 * ar });
        hitArea(fin ? last : st, p, x, z, (fin ? C.r * 1.5 : C.r) * k * ar, C.depth * ar, mul, {});
        shake(fin ? 3 : 1.4, fin ? 380 : 180); snd(fin ? 'skSlam' : 'blink', { v: fin ? 1 : 0.6 });
        if (fin) api().doFlash({ color: '#d8b0ff', alpha: 0.4, ms: 150 });
      }; })(i) });
      api().doFlash({ color: '#c890ff', alpha: 0.2, ms: 100 });
    },
    // 원소 융합탄: 구슬이 나아가며 닿은 적 → 끝에서 큰 원소 폭발
    sgorb: function (p, d, s, C, S, t0, t1) {
      if (S.fired || t1 < C.at) return; S.fired = 1;
      var k = K(), ar = s.area || 1, boom = stOf(C.boom, d), mul = s.mul;
      shoot({ p: p, x: p.x + p.dir * C.x * k, y: p.y + C.y * k, z: p.y, dir: p.dir, speed: C.speed * k, range: C.range * k, w: C.w * k, depth: C.depth,
              st: stOf(C.hit, d), mul: mul, art: 't3_sgorb_orb', sx: 1.05, hitArt: 'echain_boom', hitSx: 0.35,
              onEnd: function (a) {
                var R = C.r * k * ar;
                spawn('t3_sgorb_boom', a.x, a.y + 6 * k, { sx: 1.25 * ar });
                hitArea(boom, p, a.x, a.z, R, C.bdepth * ar, mul, {});
                wave(a.x, a.z, R * 1.3, { flat: 0.3, w: 5, ms: 420, color: '#fff0d0', glow: '#ff9a3a', ground: true });
                api().doFlash({ color: '#fff0d0', alpha: 0.3, ms: 130 }); H().hitstop(50); shake(2.2, 320);
                snd('fireBoom'); snd('iceHit', { v: 0.6 });
              } });
      glow(p.x + p.dir * C.x * k, p.y + C.y * k, 30 * k, '#ffe0a0', 200, 0.7);
      snd('magicShot');
    },
    // 삼원소 폭풍: 화면 안 적 발밑마다 마법진 → 원소 기둥(띄움) + 남은 기둥이 조금 더
    sgstorm: function (p, d, s, C, S, t0, t1) {
      if (S.fired || t1 < C.at) return; S.fired = 1;
      var k = K(), n = lv5(s, 'n', C.n), ar = s.area || 1, L = screenFoes(p, null, n), spots = L.map(function (t) { return { x: t.x, z: t.y }; });
      for (var j = spots.length; j < Math.min(n, 3); j++) spots.push({ x: p.x + p.dir * (70 + j * 60) * k, z: p.y });   // 적이 적으면 앞쪽에도
      var st = stOf(C.hit, d), tk = stOf(C.tick, d);
      spots.forEach(function (q, i) { fxs.push({ kind: 'pillar', p: p, x: q.x, z: q.z, t: -i * C.gapMs, C: C, ar: ar, st: st, tk: tk, mul: s.mul, ticks: 0 }); });
      api().doFlash({ color: '#fff4e0', alpha: 0.18, ms: 120 });
      snd('earthRise', { v: 0.7 });
    },
    // 원소 대폭발: 발밑 큰 마법진 → 가운데 터짐 → 양옆으로 원소 폭발이 n 번씩 퍼져 나감
    sgnova: function (p, d, s, C, S, t0, t1) {
      if (S.fired || t1 < C.at) return; S.fired = 1;
      fxs.push({ kind: 'nova', p: p, C: C, x: p.x, z: p.y, t: 0, n: lv5(s, 'n', C.n), ar: s.area || 1, mul: s.mul, c: stOf(C.center, d), st: stOf(C.hit, d), done: 0 });
      snd('charge');
    },
    // 종말의 별: 하늘 마법진 → 균열 → 별이 떨어짐 → 블랙홀(빨아들이며 깎음) → 화면 전체 대폭발
    sgdoom: function (p, d, s, C, S, t0, t1) {
      if (S.fired || t1 < C.at) return; S.fired = 1;
      var k = K();
      fxs.push({ kind: 'doom', p: p, C: C, t: 0, x: p.x + p.dir * C.x * k, z: p.y, dir: p.dir, ar: s.area || 1, mul: s.mul, tk: stOf(C.tick, d), boom: stOf(C.boom, d), ticks: 0, stage: 0 });
      snd('charge'); snd('orb', { v: 0.7 });
    }
  };

  // ---------- 시간이 흐르는 효과 ----------
  function fxStep(o, dt) {
    o.t += dt;
    var p = o.p, k = K();
    if (o.kind === 'later') { if (o.t >= 0) { o.fn(); return false; } return true; }
    if (o.kind === 'line') return o.t < 420;
    if (o.kind === 'fall') {   // 떨어지는 금빛 검 하나(천검 강림)
      if (o.t >= o.fall && !o.landed) {
        o.landed = true;
        var RC = o.C || {};
        spawn(RC.impact || 'holy_impact', o.x, o.z + 2, { sx: (RC.impactSx || 0.5) * (o.big ? 1.6 : 1) });
        if (alive(o.tgt)) hitT(o.st, o.tgt, o.tgt.x, mid(o.tgt), Math.random() < 0.5 ? -1 : 1, o.mul, o.p);
        if (o.big) spawn(RC.bigHit || 't3_sswave_hit', o.x, o.z - 30 * k, { sx: RC.bigSx || 0.9 });
      }
      return o.t < o.fall + 160;
    }
    if (o.kind === 'rain') {
      var C = o.C, due = Math.floor(o.t / C.gapMs);
      while (o.wave <= Math.min(due, o.n - 1)) {
        screenFoes(p, o.st, 14).forEach(function (t) {
          fxs.push({ kind: 'fall', p: p, C: C, x: t.x + (Math.random() * 2 - 1) * 8, z: t.y + 1, t: 0, fall: C.fallMs, tgt: t, st: o.st, mul: o.mul });
        });
        snd('holyBolt', { v: 0.45 });
        o.wave++;
      }
      if (!o.done && o.t >= o.n * C.gapMs + 120) {
        o.done = true;
        screenFoes(p, o.last, 14).forEach(function (t) { fxs.push({ kind: 'fall', p: p, C: C, x: t.x, z: t.y + 1, t: 0, fall: 200, tgt: t, st: o.last, mul: o.mul, big: true }); });
        fxs.push({ kind: 'later', t: -200, fn: function () { api().doFlash({ color: '#fff0b0', alpha: 0.4, ms: 160 }); shake(2.6, 380); snd('skSlam'); } });
      }
      return o.t < o.n * C.gapMs + 500;
    }
    if (o.kind === 'judge') {
      var J = o.C, T1 = 620, ar = o.ar;
      // 0 ~ T1: 하늘에서 작은 빛(pre)이 화면 안 적에게 n 번
      var due2 = Math.floor(o.t / J.gapMs);
      while (o.wave <= Math.min(due2, J.n - 1) && o.t < T1) {
        screenFoes(p, o.pre, 14).forEach(function (t) {
          hitT(o.pre, t, t.x, mid(t), Math.random() < 0.5 ? -1 : 1, o.mul, p);
          glow(t.x, mid(t), 18 * k, '#fff4c0', 160, 0.6);
          debris(t.x, t.y - 60 * k, t.y, 3, { cols: ['#ffffff', '#fff0a0'], glow: true, sp: 60, size: 1.3, ms: 360, g: 200, spread: 0.6 });
        });
        o.wave++;
      }
      if (o.stage === 0 && o.t >= T1) {   // 거대한 성검이 하늘을 가르며 내려옴(6장 14fps: 3장 = 꽂힘)
        o.stage = 1;
        var JS = J.sword || 't3_judge_sword', jk = J.swordSx || 3.2;
        spawn(JS, o.x, o.z + 4, { sx: jk * ar, life: 1300, fade: 300, loop: !!J.swordLoop }); spawn(JS, o.x, o.z + 4, { sx: jk * 1.12 * ar, life: 1300, fade: 300, add: true, a: 0.5, loop: !!J.swordLoop });
        snd('holyBolt');
      }
      if (o.stage === 1 && o.t >= T1 + 3 * 1000 / 14) {   // 꽂힘
        o.stage = 2;
        screenFoes(p, o.hit).forEach(function (t) { hitT(o.hit, t, t.x, mid(t), t.x >= o.x ? 1 : -1, o.mul, p); });
        spawn(J.impact || 'holy_impact', o.x, o.z + 2, { sx: (J.impactSx || 1.6) * ar });
        api().doFlash({ color: '#ffffff', alpha: 0.6, ms: 160 }); H().hitstop(70); shake(3, 300);
        snd('skSlam');
      }
      if (o.stage === 2 && o.t >= T1 + 4 * 1000 / 14 + 60) {   // 금빛 충격파
        o.stage = 3;
        if (J.boom) spawn(J.boom, o.x, o.z - 40 * k, { sx: (J.boomSx || 2) * ar, life: 400, fade: 120 });
        else { spawn('t3_judge_wave', o.x, o.z + 6, { sx: 2.4 * ar, sy: 1.6 * ar, layer: 'over' }); spawn('t3_judge_wave', o.x, o.z + 6, { sx: 3.4 * ar, sy: 1.2 * ar, layer: 'under', a: 0.6, delay: 80 }); }
        if (J.groundWave) [-1, 1].forEach(function (sd) { spawn(J.groundWave, o.x + sd * 10 * k, o.z + 2, { sx: sd * (J.groundSx || 0.9) * ar, sy: (J.groundSx || 0.9) * ar }); });
        screenFoes(p, o.wv).forEach(function (t) { if (hitT(o.wv, t, t.x, mid(t), t.x >= o.x ? 1 : -1, o.mul, p)) spawn(J.hitArt || 't3_sswave_hit', t.x, mid(t), { sx: J.hitSx || 0.6 }); });
        var JC = J.cols || ['#ffffff', '#fff0a0', '#ffd040'];
        wave(o.x, o.z, SCREEN * k, { flat: 0.25, w: 8, ms: 600, color: JC[1], glow: JC[2], ground: true });
        debris(o.x, o.z - 40 * k, o.z, 30, { cols: JC, glow: true, sp: 340, size: 1.8, ms: 700, g: 120, spread: 3 });
        api().doFlash({ color: J.flash || '#fffbe0', alpha: 0.85, ms: 340 }); H().hitstop(110); shake(5, 700);
        snd('meteorBoom'); snd('holyBolt', { v: 0.7 });
      }
      return o.t < T1 + 1500;
    }
    if (o.kind === 'pillar') {   // 원소 마법진 → 기둥
      var Q = o.C, R = Q.r * k * o.ar;
      if (o.t >= 0 && !o.mark) { o.mark = true; spawn('t3_sgcircle_circle', o.x, o.z + 1, { sx: 0.75 * o.ar, sy: 0.6 * o.ar, layer: 'under', life: Q.markMs + 300, fade: 200 }); }
      if (o.t >= Q.markMs && !o.up) {
        o.up = true;
        spawn('t3_sgcircle_pillar', o.x, o.z + 3, { sx: 1.25 * o.ar });
        hitArea(o.st, p, o.x, o.z, R, Q.depth * o.ar, o.mul, {});
        glow(o.x, o.z - 50 * k, 30 * k, '#ffd8a0', 260, 0.6);
        shake(1.0, 160); snd('firePillar', { v: 0.6 });
      }
      while (o.up && o.ticks < Q.ticks && o.t >= Q.markMs + (o.ticks + 1) * Q.tickMs) { o.ticks++; hitArea(o.tk, p, o.x, o.z, R, Q.depth * o.ar, o.mul, {}); }
      return o.t < Q.markMs + (Q.ticks + 1) * Q.tickMs + 100;
    }
    if (o.kind === 'nova') {
      var N = o.C, ar2 = o.ar;
      if (!o.circ) { o.circ = true; spawn('t3_sgcircle_circle', o.x, o.z + 2, { sx: 2.4 * ar2, sy: 1.4 * ar2, layer: 'under', life: 300 + (o.n + 1) * N.gapMs + 300, fade: 260 }); }
      if (o.done === 0 && o.t >= 300) {
        o.done = 1;
        spawn('t3_sgorb_boom', o.x, o.z - 30 * k, { sx: 1.0 * ar2 });
        hitArea(o.c, p, o.x, o.z, N.cr * k * ar2, N.depth * ar2, o.mul, {});
        api().doFlash({ color: '#fff0d0', alpha: 0.3, ms: 120 }); shake(1.8, 260); snd('fireBoom');
      }
      while (o.done >= 1 && o.done <= o.n && o.t >= 300 + o.done * N.gapMs) {
        var j = o.done; o.done++;
        [-1, 1].forEach(function (sd) {
          var x = o.x + sd * j * N.step * k;
          spawn('t3_sgorb_boom', x, o.z - 26 * k, { sx: 0.85 * ar2, dir: sd });
          hitArea(o.st, p, x, o.z, N.r * k * ar2, N.depth * ar2, o.mul, {});
        });
        shake(1.6, 200); snd(j % 2 ? 'iceHit' : 'lightning', { v: 0.7 });
      }
      return o.t < 300 + (o.n + 1) * N.gapMs + 400;
    }
    if (o.kind === 'doom') {
      var D = o.C, cx = o.x, gy = o.z, ar3 = o.ar, skyY = gy - 112 * k, TS = 700, TI = 1150, holeEnd = TI + 300 + D.ticks * D.tickMs;
      if (o.stage === 0) { o.stage = 1; o.circle = spawn('t3_doom_circle', cx, skyY, { sx: 1.3, life: holeEnd + 200, fade: 300, fps: 8 }); snd('blink', { v: 0.6 }); }
      if (o.stage === 1 && o.t >= 380) { o.stage = 2; spawn('t3_doom_rift', cx, skyY + 4 * k, { sx: 1.15, life: holeEnd - 200, fade: 300, layer: 'over' }); snd('lightning', { v: 0.6 }); }
      if (o.stage === 2 && o.t >= TI) {   // 별이 닿음
        o.stage = 3;
        spawn('t3_doom_impact', cx, gy + 4, { sx: 2.6 * ar3, life: 260, fade: 120 });
        api().doFlash({ color: '#ffffff', alpha: 0.55, ms: 160 }); H().hitstop(60); shake(3.2, 420);
        snd('meteorBoom');
      }
      if (o.stage >= 3 && o.ticks < D.ticks && o.t >= TI + 300 + o.ticks * D.tickMs) {   // 블랙홀: 빨아들이며 깎음
        o.ticks++;
        screenFoes(p, o.tk).forEach(function (t) {
          if (pullable(t)) { var dx = cx - t.x, dz = gy - t.y; t.x += clamp(dx, -D.pull * k * 0.22, D.pull * k * 0.22); t.y += clamp(dz, -10, 10); }
          hitT(o.tk, t, t.x, mid(t), t.x < cx ? 1 : -1, o.mul, p);
        });
        if (o.ticks % 2) snd('orb', { v: 0.5 });
      }
      if (o.stage === 3 && o.t >= holeEnd) {   // 대폭발
        o.stage = 4;
        spawn('t3_sgorb_boom', cx, gy - 40 * k, { sx: 1.7 * ar3, life: 300, fade: 110 }); spawn('t3_doom_hole', cx, gy - 44 * k, { sx: 1.6 * ar3, from: 3, fps: 10, add: true });
        screenFoes(p, o.boom).forEach(function (t, i) {
          if (hitT(o.boom, t, t.x, mid(t), t.x >= cx ? 1 : -1, o.mul, p) && i < 10) spawn('t3_sgorb_boom', t.x, mid(t), { sx: 0.6, delay: 40 + i * 30 });
        });
        wave(cx, gy, SCREEN * k, { flat: 0.25, w: 8, ms: 650, color: '#fff8e8', glow: '#ff8a3a', ground: true });
        debris(cx, gy - 50 * k, gy, 34, { cols: ['#ffffff', '#ffd040', '#7ae0ff', '#ff6a2a'], glow: true, sp: 360, size: 1.8, ms: 760, g: 120, spread: 3 });
        api().doFlash({ color: '#fff8e8', alpha: 0.85, ms: 340 }); H().hitstop(110); shake(5, 720);
        snd('meteorBoom'); snd('fireBoom', { v: 0.8 });
      }
      return o.t < holeEnd + 700;
    }
    if (o.kind === 'auto') {   // 검성의 경지: 금빛 영검이 날아가 꽂힘
      var u = clamp(o.t / o.ms, 0, 1);
      if (u >= 1 && !o.hit) {
        o.hit = true;
        if (alive(o.tgt)) { hitT(o.st, o.tgt, o.tgt.x, mid(o.tgt), o.dir, o.mul, p); spawn(o.hitArt || 't3_sswave_hit', o.tgt.x, mid(o.tgt), { sx: 0.42 }); }
        snd('swingSword', { v: 0.4 });
      }
      return o.t < o.ms + 60;
    }
    return false;
  }
  function drawFx(ctx, camX, o) {
    var k = K(), now = performance.now();
    if (o.kind === 'line') {
      var i = Math.min(3, Math.floor(o.t * 14 / 1000)), a = o.t > 300 ? clamp((420 - o.t) / 120, 0, 1) : 1;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      aiDraw(ctx, 't3_ssslash_line', i, o.x - camX, o.y, o.dir * o.sx, 0.75, 0, a);
      ctx.restore();
      return;
    }
    if (o.kind === 'fall') {
      if (o.t >= o.fall) return;
      var u = clamp(o.t / o.fall, 0, 1), y = o.z - (1 - u) * 170 * k, S = o.big ? 0.95 : 0.6;
      var FC = o.C || {}, fa = FC.fall || 'holy_sword';
      aiDraw(ctx, fa, Math.floor(o.t / 60) % 4, o.x - camX, y, S * (FC.fallSx || 1), S * (FC.fallSx || 1), 0, 0.95);
      return;
    }
    if (o.kind === 'doom' && o.t >= 700 && o.t < 1150) {   // 떨어지는 별(하늘 균열에서 비스듬히)
      var v = (o.t - 700) / 450, sx0 = o.x - o.dir * 90 * k, sy0 = o.z - 120 * k, x = sx0 + (o.x - sx0) * v, y2 = sy0 + (o.z - 20 * k - sy0) * v;
      var ang = Math.atan2((o.z - sy0), (o.x - sx0));
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      aiDraw(ctx, 't3_doom_star', Math.floor(now / 80) % 2, x - camX, y2, 1.6 * o.ar, 1.6 * o.ar, ang - Math.PI / 4, 1);
      ctx.restore();
    }
    if (o.kind === 'doom' && o.stage >= 3 && o.stage < 4) {   // 블랙홀(0 · 1 = 생김 → 2 반복 → 끝무렵 3 · 4)
      var e = o.t - 1150, end = 300 + o.C.ticks * o.C.tickMs, fi = e < 120 ? 0 : e < 240 ? 1 : e > end - 100 ? 3 : 2;
      aiDraw(ctx, 't3_doom_hole', fi, o.x - camX, o.z - 44 * k, 1.5 * o.ar * (1 + 0.04 * Math.sin(now / 90)), 1.5 * o.ar, now / 400, 0.95);
    }
    if (o.kind === 'auto') {
      var w = clamp(o.t / o.ms, 0, 1), tx = alive(o.tgt) ? o.tgt.x : o.x1, ty = alive(o.tgt) ? mid(o.tgt) : o.y1;
      var x3 = o.x0 + (tx - o.x0) * w, y3 = o.y0 + (ty - o.y0) * w - Math.sin(w * Math.PI) * 30 * k, ang2 = Math.atan2(ty - o.y0, tx - o.x0);
      if (w >= 1) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var FA = o.fly || 't3_ssslash_sword';
      aiDraw(ctx, FA, (FA === 't3_ssslash_sword' ? 1 : 0) + Math.floor(o.t / 70) % 2, x3 - camX, y3, o.flySx || 0.6, o.flySx || 0.6, ang2, 0.95);
      ctx.restore();
    }
  }

  // ---------- 늘 켜진 기술 't3auto'(저절로 공격) · 몸 둘레 기운 ----------
  //   passive = { val = 몇 ms 마다, n = 한 번에 몇 개, mul = 데미지 배율, find · findDepth = 찾는 둘레, art = 'ss_sword'(금빛 영검이 날아감) | 'sg_cycle'(원소 폭발), r = 폭발 반지름 }
  var AUTO_IDS = ['ssaura', 'sgcycle', 'mkblades'], autoT = {}, auraOn = null;   // 마검왕 떠도는 마검(2026-11-10)
  function passiveStep(p, dt) {
    auraOn = null;
    if (!p || p.state === 'dead' || (p.classKey !== 'knight' && p.classKey !== 'mage')) return;
    AUTO_IDS.forEach(function (id) {
      var q = pas(p, id);
      if (!q) { autoT[id] = 1200; return; }
      auraOn = q.P.art;
      if (autoT[id] == null) autoT[id] = 1200;
      autoT[id] -= dt;
      if (autoT[id] > 0) return;
      var P = q.P, lv = q.lv - 1, k = K(), L = near(p, P.find * k, P.findDepth);
      autoT[id] = L.length ? q.v : 400;
      if (!L.length) return;
      var n = P.n[lv] || 1, mul = P.mul[lv] || 1, st = P.hit;
      for (var i = 0; i < n; i++) {
        var t = L[i % L.length];
        if (P.art === 'ss_sword' || P.art === 'mk_sword') {
          var x0 = p.x - p.dir * 10 * k + Math.cos(i * 2.1) * 16 * k, y0 = p.y - (p.z || 0) - 78 * k;
          fxs.push({ kind: 'auto', pas: 1, p: p, tgt: t, x0: x0, y0: y0, x1: t.x, y1: mid(t), t: -i * 90, ms: 230, st: st, mul: mul, dir: t.x >= p.x ? 1 : -1, fly: P.fly || 't3_ssslash_sword', hitArt: P.hitArt || 't3_sswave_hit', flySx: P.flySx || 0.6 });
          glow(x0, y0, 14 * k, '#fff0a0', 160, 0.6);
        } else {
          (function (t, i) {
            fxs.push({ kind: 'later', pas: 1, t: -i * 120, fn: function () {
              if (!alive(t)) return;
              var x = t.x, z = t.y, R = (P.r || 46) * k;
              if (!spawn('t3_sgorb_boom', x, mid(t), { sx: 0.55, dir: Math.random() < 0.5 ? -1 : 1 })) spawn('echain_boom', x, mid(t), { sx: 0.6 });
              hitArea(st, p, x, z, R, 34, mul, {});
              snd(['fireBoom', 'iceHit', 'lightning'][Math.floor(Math.random() * 3)], { v: 0.45 });
            } });
          })(t, i);
        }
      }
    });
  }
  // 몸 둘레 기운: 검성 = 금빛 영검 둘이 맴돔 / 현자 = 불 · 얼음 · 번개 구슬 셋이 맴돔 (늘 켜진 기술을 배웠을 때)
  function drawAura(ctx, camX, p) {
    if (!auraOn || !p || p.state === 'dead') return;
    var now = performance.now(), k = K(), cy = p.y - (p.z || 0) - 56 * k, sw = auraOn === 'ss_sword' || auraOn === 'mk_sword';
    var n = sw ? 2 : 3;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < n; i++) {
      var a = now / (sw ? 700 : 560) + i * Math.PI * 2 / n, ox = Math.cos(a) * 26 * k, oy = Math.sin(a) * 9 * k - (sw ? 14 * k : 0);
      if (auraOn === 'mk_sword') aiDraw(ctx, 'msword_sword', Math.floor(now / 90 + i) % 4, p.x + ox - camX, cy + oy, 0.55, 0.55, -Math.PI / 2, 0.7);
      else if (sw) aiDraw(ctx, 't3_ssslash_sword', 1, p.x + ox - camX, cy + oy, 0.32, 0.32, -Math.PI / 2, 0.55);
      else aiDraw(ctx, 't3_sgorb_orb', Math.floor(now / 70 + i) % 4, p.x + ox - camX, cy + oy, 0.32, 0.32, 0, 0.7);
    }
    ctx.restore();
  }

  // ---------- 매 장면 ----------
  function update(dt) {
    var p = H() && H().player && H().player();
    for (var i = shots.length - 1; i >= 0; i--) { shotStep(shots[i], dt); if (shots[i].dead) shots.splice(i, 1); }
    for (var j = fxs.length - 1; j >= 0; j--) if (!fxStep(fxs[j], dt)) fxs.splice(j, 1);
    passiveStep(p, dt);
  }
  function drawUnder(ctx, camX) { }
  function drawOver(ctx, camX) {
    var p = H() && H().player && H().player();
    fxs.forEach(function (o) { drawFx(ctx, camX, o); });
    shots.forEach(function (a) { drawShot(ctx, camX, a); });
    drawAura(ctx, camX, p);
  }
  function clear() { shots.length = 0; fxs.length = 0; autoT = {}; auraOn = null; }
  function busy() { return shots.length + fxs.filter(function (o) { return !o.pas; }).length > 0; }

  window.Tier3 = {
    step: step, update: update, drawUnder: drawUnder, drawOver: drawOver, clear: clear, busy: busy,
    _state: function () { return { shots: shots.length, fxs: fxs.length, aura: auraOn }; }
  };
})();
