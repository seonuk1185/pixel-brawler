// 직업 기술 (기사 돌진베기·회전베기 / 법사 화염구·번개, 2026-11-03)
// 2026-11-06 밤 콤보: + 띄우기 기술 올려베기(기사)·땅 융기(법사, 보라 마법진 → 돌기둥) · 기술 끝무렵 다른 기술로 이어짐(캔슬, chain)
// 2026-11-06 성장 4단계: + 기사 검기 날리기·대지 내려찍기 / 법사 얼음창·메테오. 기술 = 마나 + 쿨타임, 기술 Lv1~5(config skills.curve),
//   칸 4개(A~D, 무엇을 끼웠는지는 growth.js 의 기술 책). 늘 켜진 기술(검 숙련 등)은 main.js 가 데미지·받는 피해·마나 회복에 곱함
// 시작 조건·쿨타임·진행(이동·판정·효과)·화면 효과(어둡게·번쩍·잔상·번개)·버튼 표시를 여기서 한다.
// 수치는 전부 config.js 의 SKILLS (CFG.skills). 맞았을 때 데미지·불똥·숫자는 main.js 의 onHit 를 그대로 쓴다.
// 기술 = 동작(motion, 몸 그림 묶음) + 효과(fx 그림). 판정·효과 시각은 config 에 「장 번호」로 적고 여기서 동작의 ms 로 바꾼다.
// 동작·효과 그림이 없으면 기존 그림(공격 그림·베기·마법 효과)을 시간만 바꾸거나 색을 물들여서 쓴다(placeholder).
(function () {
  var CFG = null, H = null;      // H = main.js 가 넘겨주는 도구 { onHit, targets, canHit(누운 적은 hitsDown 만), dust, fx, hitstop, slow }
  var cache = {};
  var bolts = [], rings = [], ghosts = [], arts = [];   // arts = 효과 그림(따라다니기·돌리기·날아가기·캐릭터 뒤)
  // 2026-11-03 HD 화려하게: waves = 퍼지는 충격파 고리(땅 = 납작한 타원 / 공중 = 원), parts = 튀는 파편·불티(중력), glows = 번쩍 빛(더하기)
  var waves = [], parts = [], glows = [];
  // 2026-11-06: meteors = 떨어지는 운석(법사가 다른 걸 해도 그대로 떨어짐), casts = 기술마다 쓴 횟수(시험용), noMpT = 「MP 부족」 다시 띄울 때까지
  var meteors = [], casts = {}, noMpT = 0;
  // 2026-11-06 밤: pillars = 땅 융기 돌기둥(캐릭터와 깊이 순서로 그림, addEnts)
  var pillars = [];
  // 2026-11-06 밤 각성 「마력 폭주」: echoes = 한 번 더 터질 기술(법사가 다른 걸 해도 그대로 나감) { t = 남은 ms, fn },
  //   bright = 효과 빛 세기·크기 배율(각성 중 더 크고 밝게, 그림만 — 판정은 그대로)
  var echoes = [], bright = 1;
  // 2차 기술(2026-11-06): blades = 성검 낙뢰 번개 칼(떨어짐 → 꽂힘), flames = 불기둥(타는 동안 여러 번), beams = 칼끝에서 하늘로 빛 줄기,
  //   arcs = 코드로 그린 초승달 베기(반격), shieldFx = 마나 방패 번쩍, gritOn = 「투지!」 글자를 띄웠나(다시 띄우려면 기운이 줄었다 다시 커져야)
  var blades = [], flames = [], beams = [], arcs = [], shieldFx = null, gritOn = false, gritT = 0;
  var tornados = [];   // 칼날 폭풍 회오리(2026-11-07): 앞으로 천천히 가며 끌어당겨 벰 → 끝에 터짐
  // 기술 Lv 에 따라 효과가 세 보이게(2026-11-06 형님): curLv = 지금 만드는 효과의 기술 Lv(1~5).
  //   wave·glow·debris 가 이 값을 보고 — 파편·불티 수 Lv 마다 +15%, 빛 조금 더 밝게, Lv5 = 「최대」 표시(금빛 바깥 고리 + 흰 심 빛).
  //   크기는 기술 진행의 area(LV_GROW, start 참고)로 커짐 → 판정도 같이(보이는 크기 = 맞는 크기)
  var curLv = 1, LV_GROW = 0.06;
  function atLv(lv, fn) { var o = curLv; curLv = lv || 1; try { fn(); } finally { curLv = o; } }
  var SLOTS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];   // 기술 칸 1~10 (2026-11-07: 폰 = 앞 5칸, PC 아래 막대 = 10칸)
  function SM() { return ((CFG && CFG.view.renderScale) || 1) > 1; }   // 매끈한 화면이면 코드로 그린 효과도 부드럽게
  // 충격파: x,y = 가운데, r = 끝 반지름(도트), flat = 세로 비율(땅 고리 0.3, 공중 1), w = 굵기, ms, color, ground = 캐릭터 밑에 그림
  function wave(x, y, r, o) {
    o = o || {};
    r *= bright;
    waves.push({ x: x, y: y, r: r, flat: o.flat == null ? 0.3 : o.flat, w: o.w || 3, t: 0, life: o.ms || 320, color: o.color || '#ffffff',
                 glow: o.glow || o.color || '#ffffff', ground: !!o.ground, r0: o.r0 || r * 0.15 });
    if (curLv >= 5 && !o.noMax)   // 기술 Lv5: 바깥에 금빛 고리 하나 더
      waves.push({ x: x, y: y, r: r * 1.22, flat: o.flat == null ? 0.3 : o.flat, w: (o.w || 3) * 0.8, t: 0, life: (o.ms || 320) * 1.25,
                   color: '#fff6c8', glow: '#ffc840', ground: !!o.ground, r0: r * 0.3 });
  }
  // 파편 n 개: x,y 에서 위·옆으로 튐, floor = 떨어지는 땅 높이(그 밑으로 안 감), cols = 색 목록, size = 크기(도트), sp = 속도
  // 효과 최대 수(2026-11-07 사냥 손맛, config hunt.caps): 몹 떼를 한꺼번에 쓸 때 파편·빛이 너무 많아져 폰이 느려지지 않게(넘치면 새것을 덜 만듦)
  function cap(k, d) { var C = CFG && CFG.hunt && CFG.hunt.caps; return (C && C[k]) || d; }
  function debris(x, y, floor, n, o) {
    o = o || {};
    if (curLv > 1) n = Math.round(n * (1 + 0.15 * (curLv - 1)));   // 기술 Lv 마다 파편·불티 +15%
    n = Math.min(n, cap('parts', 1e9) - parts.length);
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (Math.random() * 2 - 1) * (o.spread || 1.25), sp = (o.sp || 150) * (0.45 + Math.random() * 0.75) * AS() / 0.55;
      parts.push({ x: x + (Math.random() * 2 - 1) * 4, y: y + (Math.random() * 2 - 1) * 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, floor: floor,
                   g: (o.g || 520) * AS() / 0.55, t: 0, life: (o.ms || 650) * (0.6 + Math.random() * 0.5),
                   size: (o.size || 2.2) * (0.6 + Math.random() * 0.8), col: o.cols[i % o.cols.length], glow: !!o.glow, rot: Math.random() * 6, vr: (Math.random() * 2 - 1) * 14 });
    }
  }
  // 둥근 빛(더하기 합성): r = 반지름(도트), ms 동안 커지며 사라짐
  function glow(x, y, r, color, ms, a) {
    if (glows.length >= cap('glows', 1e9)) return;
    var lk = 1 + 0.05 * (curLv - 1);   // 기술 Lv 마다 조금 더 밝게
    glows.push({ x: x, y: y, r: r * bright, color: color, t: 0, life: ms || 220, a: Math.min(1, (a == null ? 0.8 : a) * bright * lk) });
    if (curLv >= 5) glows.push({ x: x, y: y, r: r * bright * 0.45, color: '#ffffff', t: 0, life: (ms || 220) * 0.8, a: 0.55 });   // Lv5: 흰 심 빛
  }
  var flash = null;              // 화면 번쩍 { color, alpha, t, life } (진짜 시간으로 줄어듦 → 멈춤 중에도 보임)
  var tintImgCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function AS() { return (CFG && CFG.actorScale) || 1; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(u) { return 1 - (1 - u) * (1 - u); }   // 처음 빠르게 → 끝에서 느리게
  // 장마다 시간(d) 목록에서 t 일 때 몇 번째 장인지(넘으면 마지막 장)
  function seqIdx(d, t) {
    for (var i = 0; i < d.length; i++) { if (t < d[i]) return i; t -= d[i]; }
    return d.length - 1;
  }

  // ---------- 기술 정의: 기본 값 + 성별 덮어쓰기(male/female) ----------
  // id = 기술 이름(config SKILLS 의 dash·spin·wave·slam / fireball·bolt·ice·meteor)
  function resolve(cls, id, gender) {
    var key = cls + '.' + id + '.' + gender;
    if (key in cache) return cache[key];
    var S = CFG.skills && CFG.skills[cls], base = S && S[id], o = null;
    if (base && typeof base === 'object' && base.name) {
      o = {}; var k;
      for (k in base) if (k !== 'male' && k !== 'female') o[k] = base[k];
      var ov = base[gender];
      if (ov) for (k in ov) o[k] = ov[k];
      o.key = cls + '.' + id; o.id = id; o.cls = cls;
      // 동작 시간: 이 기술의 motionMs > 동작 모음집(CFG.motions[옷_성별][동작].ms) > placeholder 의 장 시간
      var C = CFG.classes[cls], ch = C && C.outfit ? C.outfit + '_' + gender : null;
      var M = ch && CFG.motions && CFG.motions[ch] && CFG.motions[ch][o.motion];
      timeline(o, o.motionMs || (M && M.ms) || null);
    }
    cache[key] = o;
    return o;
  }
  // 「장 번호」로 적힌 시각(frame / frames)을 「기술 시작부터 ms」(at / from·to)로 바꾼다. 원래 config 객체는 안 건드림(복사)
  function timeline(o, ms) {
    ms = ms || (o.placeholder && o.placeholder.d) || [500];
    o.frameMs = ms;
    var fs = [], acc = 0, last = ms.length - 1;
    ms.forEach(function (m) { fs.push(acc); acc += m; });
    function st(f) { return fs[clamp(f || 0, 0, last)]; }
    function en(f) { f = clamp(f, 0, last); return fs[f] + ms[f]; }
    function span(x) { var fr = x.frames || [x.frame, x.frame]; return [st(fr[0]), en(fr[fr.length - 1])]; }
    function cp(a, b) { var r = {}, k; for (k in a) r[k] = a[k]; for (k in b) r[k] = b[k]; return r; }
    if (o.ms == null) o.ms = acc;
    if (o.iframes && !Array.isArray(o.iframes)) o.iframes = span(o.iframes);
    if (o.move && o.move.frames) { var a = span(o.move); o.move = cp(o.move, { from: a[0], to: a[1] }); }
    if (o.trail && o.trail.frames) { var b = span(o.trail); o.trail = cp(o.trail, { from: b[0], to: b[1] }); }
    if (o.hits) o.hits = o.hits.map(function (h) { return h.at ? h : cp(h, { at: span(h) }); });
    if (o.fx) o.fx = o.fx.map(function (f) { return f.at != null ? f : cp(f, { at: st(f.frame) + (f.delay || 0) }); });
    if (o.finale && o.finale.at == null) o.finale = cp(o.finale, { at: st(o.finale.frame) });
    if (o.cast && o.cast.at == null) o.cast = cp(o.cast, { at: st(o.cast.frame) });
    if (o.shot && o.shot.at == null) o.shot = cp(o.shot, { at: st(o.shot.frame) });
    if (o.meteor && o.meteor.at == null) o.meteor = cp(o.meteor, { at: st(o.meteor.frame) });
    if (o.pillar && o.pillar.at == null) o.pillar = cp(o.pillar, { at: st(o.pillar.frame), burstAt: st(o.pillar.burst) });
    if (o.flame && o.flame.at == null) o.flame = cp(o.flame, { at: st(o.flame.frame), burstAt: st(o.flame.burst) });   // 불기둥(2차)
    if (o.blades && o.blades.at == null) o.blades = cp(o.blades, { at: st(o.blades.frame) });
    if (o.tornado && o.tornado.at == null) o.tornado = cp(o.tornado, { at: st(o.tornado.frame) });                     // 칼날 폭풍 회오리(2026-11-07)                         // 성검 낙뢰(2차)
    if (o.strikes && !Array.isArray(o.strikes.at)) {
      var t0 = st(o.strikes.frame), gap = o.strikes.gapMs || 120;
      o.strikes = cp(o.strikes, { at: o.strikes.x.map(function (x, k) { return t0 + k * gap; }) });
    }
    // 다른 기술로 이어지는 때(캔슬, 2026-11-06 밤): chainFrom(장 번호)이 있으면 그 장부터, 없으면 이 기술이 할 일(판정·발사·터짐·뛰기·끝맺음)을
    //   다 한 뒤 + padMs. 기술 끝보다 늦지 않게
    if (o.chainAt == null) {
      var last = 0, pad = (CFG.skills.cancel && CFG.skills.cancel.padMs) || 60;
      var mx = function (v) { if (v != null && v > last) last = v; };
      (o.hits || []).forEach(function (h) { mx(h.at[1]); });
      if (o.cast) mx(o.cast.at); if (o.shot) mx(o.shot.at); if (o.meteor) mx(o.meteor.at); if (o.pillar) mx(o.pillar.burstAt);
      if (o.flame) mx(o.flame.burstAt); if (o.blink) mx(o.blink.at + o.blink.hideMs);
      if (o.blades) mx(o.blades.at + (o.blades.n - 1) * o.blades.gapMs + o.blades.fallMs);
      if (o.tornado) mx(o.tornado.at);
      if (o.quake) mx(o.quake.at); if (o.leap) mx(o.leap.at[1]); if (o.finale) mx(o.finale.at); if (o.strikes) mx(o.strikes.at[o.strikes.at.length - 1]);
      o.chainAt = o.chainFrom != null ? st(o.chainFrom) : Math.min(o.ms - 1, last + pad);
    }
  }
  function defFor(p, id) { return p.classKey && id ? resolve(p.classKey, id, p.gender || 'male') : null; }
  // 기술 책(growth.js): 지금 입은 직업의 것(견습 = null)
  function bookOf(cls) { return window.Growth && Growth.book ? Growth.book(cls) : null; }
  // 기술 Lv 에 따른 마나·쿨타임·데미지 배율 (config skills.curve). lv5 = Lv5 덤(없으면 null)
  function lvStat(d, lv) {
    var C = CFG.skills.curve || {}, i = clamp((lv || 1) - 1, 0, 4);
    function at(a) { return a && a[i] != null ? a[i] : 1; }
    return { lv: lv || 1, mp: Math.round((d.mp || 0) * at(C.mp)), cd: Math.round(d.cooldownMs * at(C.cd) / 100) * 100,
             dmg: at(C.dmg), lv5: lv >= (CFG.skills.maxLv || 5) ? (d.lv5 || {}) : null };
  }
  // 그 칸(0~9)에 끼운 기술: { d = 정의, L = Lv 값 } 또는 null (회피를 끼운 칸 = null → 회피는 input.js 가 칸 누름을 회피로 바꿈)
  function slotSkill(p, i) {
    var bk = bookOf(p.classKey), id = bk && bk.at(i), d = defFor(p, id);
    return d ? { d: d, L: lvStat(d, bk.lv(id)) } : null;
  }
  // 드는 마나: 각성 「마력 폭주」(p.freeMp) = 0
  //   무기 강화 +9(2026-11-06): p.mpMul(0.9) 만큼 덜 듦
  function mpCost(p, L) { return p && p.freeMp ? 0 : Math.round(L.mp * ((p && p.mpMul) || 1)); }
  // 쿨타임: 무기 강화 +9(2026-11-06) = p.cdMul(0.9) 배
  function cdOf(p, L) { return Math.round(L.cd * ((p && p.cdMul) || 1)); }
  // 각성 「마력 폭주」 한 번 더: config awaken.mage.echoMs[기술 id] 뒤에 fn (게임 시간, 멈춤·슬로 따름)
  function echo(d, fn) {
    var E = CFG.awaken && CFG.awaken.mage && CFG.awaken.mage.echoMs;
    echoes.push({ t: (E && E[d.id]) || 180, fn: fn, lv: curLv });
  }

  // 효과 그림(CFG.skillFx 이름): 불러와져 있으면 { fr = 그림들, fps, pivot(줄인 크기 기준), loop }, 없으면 null
  function fxArt(name, fps) {
    var F = H.fx(), fr = name && F && F['skill_' + name];
    if (!fr || !fr.length) return null;
    var M = CFG.magic['skill_' + name], S = CFG.skillFx[name] || {};
    // range = 날아가는 동안 반복할 장 [첫, 끝](우리 그림), ours = 우리가 그린 도트 그림(1배 그대로), hit = 「쾅」 장
    return { fr: fr, fps: fps || S.fps || 16, pivot: M ? M.pivot : centerPivot(fr), loop: !!S.loop,
             range: Array.isArray(S.loop) ? S.loop : null, ours: !!S.ours, hit: S.hit };
  }
  // 기존 효과 그림을 색으로 물들여서(없으면 null)
  function tintFx(name, color, k) {
    var F = H.fx(), fr = F && F[name];
    return fr && fr.length ? (color ? FX.tinted(fr, color, k) : fr) : null;
  }
  // 그림 효과 한 번 재생, from = 몇 번째 장부터(터짐은 맞는 순간 멈춤(히트스톱) 동안 작은 첫 장에 멈춰 있지 않게 큰 장부터)
  function spriteFrom(x, y, fr, fps, pivot, flip, scale, from) {
    FX.sprite(x, y, fr, fps, pivot, flip, false, scale);
    if (from) FX.list[FX.list.length - 1].t = Math.min(fr.length - 1, from) * 1000 / fps;
  }
  function centerPivot(fr) { return Assets.centerOf(fr[0]); }
  // 효과음(2026-11-07, js/sfx.js): 쓰기 시작 = SFX.cast(기술 id), 날아감·터짐·꽂힘 = 그 순간 snd
  function snd(name, opts) { if (window.SFX) SFX.play(name, opts); }

  // ---------- 시작 ----------
  // 눌린 칸(A~J) 중 쓸 수 있는 기술(쿨타임 끝남 + 마나 넉넉) 하나 → { d, L }. 빈 칸·안 보이는 칸은 입력을 버림.
  //   쿨타임 중이면 입력을 잠깐 기억(버퍼). 마나가 모자라면 입력을 버리고 머리 위 「MP 부족」(H.noMp)
  //   skip = 이번에 이어지는 동안(chain) 이미 쓴 기술 id 목록(그 칸의 입력은 그대로 둠 → 다른 칸이 나갈 수 있음)
  function pick(p, skip) {
    var B = CFG.skills.bufferMs || 300, got = null;
    SLOTS.forEach(function (slot, i) {
      if (got || !Input.peekSkill(slot, B)) return;
      var q = slotSkill(p, i);
      if (!q) { Input.clearSkill(slot); return; }
      if (skip && skip.indexOf(q.d.id) >= 0) return;
      if ((p.skillCd[q.d.key] || 0) > 0) return;
      if ((p.mp || 0) < mpCost(p, q.L)) {
        Input.clearSkill(slot);
        if (noMpT <= 0 && H.noMp) { H.noMp(slot); noMpT = CFG.skills.noMpMs || 500; }
        return;
      }
      Input.takeSkill(slot, B); got = q;
    });
    return got;
  }

  // q = pick 이 고른 { d, L } (예전처럼 정의 d 만 넘기면 Lv1, 마나 안 씀 — 시험용)
  function start(p, q) {
    var d = q.d || q, L = q.L || lvStat(d, 1);
    var ax = Input.axis(CFG).x, dir0 = p.dir;   // 누르는 방향으로 돌아서 쓴다(keepDir = 반격: 때린 적 쪽 그대로)
    if (!d.keepDir) { if (ax > 0.3) p.dir = 1; else if (ax < -0.3) p.dir = -1; }
    var mv = 0;   // 순간이동(2차): 누르는 쪽(안 누르면 바라보던 쪽)으로 가고, 바라보는 방향은 그대로
    if (d.blink) { mv = ax > 0.3 ? 1 : ax < -0.3 ? -1 : dir0; p.dir = dir0; }
    // 캔슬(2026-11-06 밤): 평타 도중(attack) · 다른 기술 끝무렵(skill)에서 나가면 콤보 글자 「CANCEL」. chain = 이번에 이어서 쓴 기술 id
    var from = p.state, chain = from === 'skill' && p.sk ? (p.sk.chain || []).concat([p.sk.d.id]) : [];
    if ((from === 'attack' || from === 'skill') && H.comboTag) H.comboTag('CANCEL');
    p.z = 0;   // 앞 기술의 뛰기(대지 내려찍기·올려베기)가 끊겨도 땅에서 시작
    p.state = 'skill'; p.atk = null; p.animT = 0; p.comboStep = 0;
    var s = p.sk = { d: d, t: 0, x0: p.x, z: p.y, dir: p.dir, done: {}, hitWin: {}, fxDone: {}, hitAny: false,
                     finaleDone: false, cast: false, strikeDone: {}, ghostT: 0, boxes: [], exitT: 0,
                     L: L, mul: L.dmg, area: Math.max((L.lv5 && L.lv5.area) || 1, 1 + LV_GROW * ((L.lv || 1) - 1)) * (H.areaMul ? H.areaMul(d) : 1),
                     shotDone: 0, quaked: false, met: false, chain: chain, pl: null, plDone: false,
                     mv: mv, bk: 0, fl: null, flDone: false, bladesDone: false };
    // area = 효과·판정 크기 배율: 기술 Lv 마다 +6%(Lv5 +24%, 2026-11-06 형님 「Lv 오르면 세 보이게」), Lv5 덤(lv5.area)이 더 크면 그것
    //   x 사냥 손맛 넓은 범위(2026-11-07, config hunt.aoe, 켠 판에서만: 회전베기·대지 내려찍기·메테오·불기둥 +25%)
    if (q.L) p.mp = Math.max(0, (p.mp || 0) - mpCost(p, L));   // 마나 씀(각성 마력 폭주 = 0)
    s.echo = !!p.echoCast;   // 각성 마력 폭주: 이 기술이 한 번 더 터짐(쏘는 순간 echoes 에 넣음)
    if (s.echo) {            // 쓰는 순간 법사 둘레 보라·하늘 빛(더 크고 밝게)
      glow(p.x, p.y - 50 * AS(), 46 * AS() / 0.55, '#b46aff', 320, 0.6);
      debris(p.x, p.y - 40 * AS(), p.y, 10, { cols: ['#ffffff', '#d8b0ff', '#5ae6ff'], glow: true, sp: 160, size: 1.5, ms: 420, g: -60, spread: 1.6 });
    }
    casts[d.id] = (casts[d.id] || 0) + 1;
    if (window.SFX) { if (d.sfx) snd(d.sfx); else SFX.cast(d.id); }   // sfx = sfx.js 기술 소리 표에 없는 기술의 시작 소리(칼날 폭풍, 2026-11-06)
    if (H.onCast && !d.auto) H.onCast(d);   // 포만감이 조금 더 줆(main.js, 2026-11-06 밤). 반격(저절로)은 안 줆
    if (d.strikes) {
      var K = s.K = boltsFor(d.strikes, L);
      s.sx = K.x.map(function (x) { return p.x + p.dir * x; });   // 적이 없을 때 고정 자리
      s.sz = K.x.map(function () { return p.y; });
      s.aimT = aimTargets(p, K);
    }
    p.skillCd[d.key] = cdOf(p, L);
    if (d.zoom && (!d.zoom.lv5 || L.lv5) && H.zoom) H.zoom(d.zoom.k, d.zoom.ms);   // 큰 기술 화면 당기기(2026-11-06 밤)
  }

  // ---------- 진행 (매 장면). 끝나면 true ----------
  // 이 기술이 만드는 효과는 모두 그 기술 Lv 로(curLv: 파편 수·Lv5 금빛 고리)
  function advance(p, dt) {
    var r = false;
    atLv(p.sk.L && p.sk.L.lv, function () { r = advance0(p, dt); });
    return r;
  }
  function advance0(p, dt) {
    var s = p.sk, d = s.d, t0 = s.t, t1 = s.t + dt;
    s.t = t1; s.boxes = [];
    // 회전베기 걷기(2026-11-06 형님): 도는 동안 누르는 쪽으로 걷기 빠르기(달리기 아님). 판 밖으로는 main.js 의 p.clamp 가 막음
    if (d.walk && Input.axis) {
      var wa = Input.axis(CFG), ws = dt / 1000, wm = p.moveMul || 1;
      p.x += wa.x * CFG.player.speedX * wm * ws;
      p.y += wa.y * CFG.player.speedY * wm * ws;
    }
    if (d.blink) blinkStep(p, d, s, t0, t1);       // 순간이동(2차)
    if (d.flame) flameMark(p, d, s, t1);           // 불기둥 마법진 → 솟음(2차)
    if (d.blades && !s.bladesDone && t1 >= d.blades.at) { s.bladesDone = true; castBlades(p, d, s); }   // 성검 낙뢰(2차)
    // 돌진: from~to 동안 dist 만큼(처음 빠르게)
    if (d.move) {
      var m = d.move, len = Math.max(1, m.to - m.from), dist = m.dist * ((s.L.lv5 && s.L.lv5.dist) || 1);   // Lv5 = 더 멀리
      var u0 = ease(clamp((t0 - m.from) / len, 0, 1)), u1 = ease(clamp((t1 - m.from) / len, 0, 1));
      p.x += s.dir * dist * (u1 - u0);
      // 돌진이 끝났는데 적 몸 안에 멈춰 있으면(보스처럼 큰 몸) 같은 방향으로 계속 미끄러져 뚫고 나간다
      //   (안 그러면 몸끼리 밀어내기가 뒤로 확 튕겨 냄). 화면 끝에 막히면 200ms 뒤 포기
      if (t1 > m.to && !s.exitDone) {
        var need = bodyInside(p, s.dir), xb = p.x;
        if (need > 0.5 && s.exitT < 200) {
          s.exiting = true; s.exitT += dt;
          p.x += s.dir * Math.min(need, m.dist / len * 0.6 * dt);
        } else { s.exitDone = true; s.exiting = false; }
      }
    }
    // 잔상
    var tr = d.trail;
    if (tr && t1 >= tr.from && t1 <= tr.to) {
      s.ghostT -= dt;
      if (s.ghostT <= 0) { s.ghostT = tr.everyMs; addGhost(p, tr); }
    }
    // 효과
    (d.fx || []).forEach(function (f, i) {
      if (!s.fxDone[i] && t1 >= f.at) { s.fxDone[i] = true; playFx(p, f); }
    });
    // 판정 구간
    (d.hits || []).forEach(function (h, i) {
      if (t1 >= h.at[0] && t0 <= h.at[1]) checkHit(p, d, h, i);
    });
    // 끝맺음(돌진베기): 하나라도 맞았으면 크게 멈춤·흔들림·번쩍·슬로모션
    var F = d.finale;
    if (F && !s.finaleDone && t1 >= F.at) {
      s.finaleDone = true;
      if (!F.ifHit || s.hitAny) {
        if (F.hitstopMs) H.hitstop(F.hitstopMs);
        if (F.shake) FX.shake(CFG.juice.shakePx * F.shake, CFG.juice.shakeMs * 1.6);
        impact(F);
        // 끝맺음: 앞쪽에 크게 번쩍 + 땅 충격파
        var fx0 = p.x + p.dir * 40 * AS();
        glow(fx0, p.y - 50 * AS(), 70 * AS(), '#bfe0ff', 260, 0.75);
        wave(fx0, p.y, 120 * AS(), { flat: 0.28, w: 4, ms: 360, color: '#e8f4ff', glow: '#7fb8ff', ground: true });
      }
    }
    if (d.cast && !s.cast && t1 >= d.cast.at) {
      s.cast = true;
      var co = { x: p.x, y: p.y, dir: p.dir, dy: 0 }, cf = d.cast.burst ? castFireball : castIce;
      cf(p, d, s, co);
      // 각성 마력 폭주: 같은 자리·방향에서 한 발 더(조금 위/아래로 비켜서)
      if (s.echo) echo(d, function () { cf(p, d, s, { x: co.x, y: co.y, dir: co.dir, dy: (d.cast.burst ? -12 : 9) * AS() }); });
    }
    // 2026-11-06 새 기술: 뛰어올라 내려찍기(leap·quake) · 검기(shot) · 메테오(meteor)
    if (d.leap) {
      var Lp = d.leap, ln = Math.max(1, Lp.at[1] - Lp.at[0]), v0 = clamp((t0 - Lp.at[0]) / ln, 0, 1), v1 = clamp((t1 - Lp.at[0]) / ln, 0, 1);
      p.z = v1 > 0 && v1 < 1 ? Lp.h * Math.sin(Math.PI * v1) : 0;   // 둥글게 떴다 내려옴
      p.x += s.dir * (Lp.fwd || 0) * (v1 - v0);
    }
    if (d.quake && !s.quaked && t1 >= d.quake.at) { s.quaked = true; p.z = 0; quake(p, d); }
    if (d.tornado && !s.tornDone && t1 >= d.tornado.at) { s.tornDone = true; castTornado(p, d, s); }   // 칼날 폭풍 회오리(2026-11-07)
    if (d.shot) {
      var nShot = 1 + ((s.L.lv5 && s.L.lv5.extra) || 0);
      while (s.shotDone < nShot && t1 >= d.shot.at + s.shotDone * (d.shot.gapMs || 150)) { castWave(p, d, s.shotDone); s.shotDone++; }
    }
    if (d.meteor && !s.met && t1 >= d.meteor.at) {
      s.met = true;
      var m1 = castMeteor(p, d, s, null, null);
      if (s.echo) { var mo = { x: p.x, y: p.y, dir: p.dir }; echo(d, function () { castMeteor(p, d, s, mo, m1); }); }   // 각성: 다른 적에게 하나 더
    }
    if (d.pillar) pillarStep(p, d, s, t1);   // 땅 융기(2026-11-06 밤)
    if (d.strikes) {
      var K = s.K || d.strikes;
      lockStrikes(s, K, p.dir);
      K.at.forEach(function (at, k) {
        if (!s.strikeDone[k] && t1 >= at) {
          s.strikeDone[k] = true; strike(p, d, s, k, s.sx[k], s.sz[k]);
          if (s.echo) { var ex = s.sx[k], ez = s.sz[k]; echo(d, function () { strike(p, d, s, k, ex, ez); }); }   // 각성: 같은 자리에 한 번 더
        }
      });
    }
    var end = t1 >= d.ms;
    if (end && d.leap) p.z = 0;
    return end;
  }

  // 번개가 겨눌 적: 앞쪽(바라보는 쪽) range 안, 위아래 aim.depth 안, 가까운 순. 1번 = 가장 가까운 적, 2·3번 = 그다음(적이 모자라면 마지막 적 다시)
  //   소품(상자·통, isProp)은 안 겨눔 (떨어진 번개에 같이 맞는 것은 됨)
  function aimTargets(p, K) {
    var A = K.aim; if (!A) return null;
    var list = [];
    H.targets().forEach(function (t) {
      if (!t || t.isProp || !H.canHit(t, K.hits[0]) || (t.alive && !t.alive())) return;
      var dx = (t.x - p.x) * p.dir;
      if (dx < -6 * AS() || dx > A.range || Math.abs(t.y - p.y) > A.depth) return;
      list.push({ t: t, d: Math.abs(dx) + Math.abs(t.y - p.y) * 0.5 });
    });
    if (!list.length) return null;
    list.sort(function (a, b) { return a.d - b.d; });
    return K.x.map(function (x, k) { return K.base && k >= K.base ? null : list[Math.min(k, list.length - 1)].t; });
  }
  // 번개 Lv5(2026-11-06): 줄기를 lv5.bolts 개로(지금 번개 그림 그대로). 원래 줄기(겨눔·시각·마지막 넘어뜨림)는 그대로 두고,
  //   늘어난 줄기(base 번째부터)는 적을 안 겨누고 겨눈 자리 바깥(앞 → 뒤 번갈아)으로 wide 만큼 떨어진 곳에 2·3번 줄기와 같이 떨어짐
  //   → 한 적에게 더 세지지는 않고(wide = 몸 + 번개 폭보다 멀리) 둘레의 다른 적까지 넓게 맞힘
  function boltsFor(K, L) {
    var n = L && L.lv5 && L.lv5.bolts, b = K.x.length;
    if (!n || n <= b) return K;
    var o = {}, k;
    for (k in K) o[k] = K[k];
    var gx = (K.x[b - 1] - K.x[0]) / Math.max(1, b - 1);
    o.base = b; o.wide = (L.lv5.wide || 90) * AS(); o.x = K.x.slice(); o.at = K.at.slice(); o.hits = [];
    for (k = 0; k < b; k++) o.hits.push(K.hits[Math.min(k, K.hits.length - 1)]);
    for (k = b; k < n; k++) {
      var j = k - b;
      o.x.push(j % 2 ? K.x[0] - gx * (1 + (j >> 1)) : K.x[b - 1] + gx * (1 + (j >> 1)));   // 적이 없을 때 고정 자리(양 끝 바깥)
      o.at.push(K.at[Math.min(b - 1, 1 + j)]);
      o.hits.push(K.hits[0]);
    }
    return o;
  }
  // 번개 자리: 바닥 표시가 뜨면(markMs 전) 겨눈 적의 발밑을 따라가다가, 떨어지기 lockMs 전에 고정(그 뒤로는 안 움직임 → 피할 틈)
  function lockStrikes(s, K, dir) {
    if (!s.aimT) return;
    var lockMs = K.lockMs != null ? K.lockMs : 90;
    K.at.forEach(function (at, k) {
      if (s.locked && s.locked[k]) return;
      if (s.t < at - (K.markMs || 200)) return;
      var t = s.aimT[k];
      if (t && (!t.alive || t.alive())) { s.sx[k] = t.x; s.sz[k] = t.y; }
      else if (K.base && k >= K.base) {   // Lv5 늘어난 줄기: 겨눈 줄기 바깥(앞 → 뒤 번갈아)으로 wide 씩
        var j = k - K.base, ref = j % 2 ? 0 : K.base - 1, side = j % 2 ? -1 : 1;
        s.sx[k] = s.sx[ref] + side * (dir || 1) * K.wide * (1 + Math.floor(j / 2)); s.sz[k] = s.sz[ref];
      }
      if (s.t >= at - lockMs) { s.locked = s.locked || {}; s.locked[k] = true; }
    });
  }

  // 지금 시각이 무적 구간인지
  //   2026-11-07: config skills.superArmor 면 기술 무적 없음(→ armored = 슈퍼아머, entities.js takeHit)
  function armored(p) { return !!(CFG.skills.superArmor && p && p.state === 'skill' && p.sk); }
  function invulnerable(p) {
    if (CFG.skills.superArmor) return false;
    var s = p.sk, I = s && s.d.iframes;
    return !!(I && s.t >= I[0] && s.t <= I[1]);
  }
  // 돌진 중에는 적 몸을 뚫고 지나감(몸끼리 밀어내기 안 함)
  function passThrough(p) {
    var s = p.sk, m = s && s.d.move;
    return !!(m && ((s.t >= m.from - 20 && s.t <= m.to + 40) || s.exiting));
  }
  // 적 몸(겹침 방지 반지름) 안에 있으면 dir 쪽으로 빠져나가는 데 필요한 거리(없으면 0)
  function bodyInside(p, dir) {
    var need = 0, R = CFG.hero.radius, sd = CFG.ai.sepDepth;
    H.targets().forEach(function (e) {
      if (!e || !e.T || !e.alive() || e.state === 'down' || Math.abs(e.y - p.y) >= sd) return;
      var sum = e.T.radius + R, dx = e.x - p.x;
      if (Math.abs(dx) < sum) need = Math.max(need, dx * dir + sum);
    });
    return need;
  }

  // ---------- 그림 ----------
  // 동작 그림(motion)이 불러와져 있으면 그것, 없으면 placeholder(기존 공격 그림)
  function usingArt(p) {
    var m = p.sk.d.motion, A = p.char && p.char.anims;
    return !!(m && A && A[m] && A[m][0]);
  }
  function frame(p) {
    var s = p.sk, d = s.d, A = p.char.anims;
    // motionSeq(칼날 폭풍, 2026-11-06) = 기술 장 번호 → 동작 그림 장 번호(같은 그림을 되풀이)
    if (usingArt(p)) { var mi = seqIdx(d.frameMs, s.t); if (d.motionSeq) mi = d.motionSeq[Math.min(d.motionSeq.length - 1, mi)]; return { anim: d.motion, idx: Math.min(A[d.motion].length - 1, mi) }; }
    var ph = d.placeholder;
    if (!ph) return { anim: 'idle', idx: 0 };
    var i = seqIdx(ph.d, s.t);
    // anims = 장마다 다른 그림(대지 내려찍기: 점프 → 3타). 그 그림이 없는 옷이면 첫 그림 / 서 있기
    var an = ph.anims ? ph.anims[Math.min(ph.anims.length - 1, i)] : ph.anim;
    if (!A[an]) an = ph.anims && A[ph.anims[ph.anims.length - 1]] ? ph.anims[ph.anims.length - 1] : null;
    if (!an || !A[an]) return { anim: 'idle', idx: 0 };
    return { anim: an, idx: Math.min(A[an].length - 1, ph.f[Math.min(ph.f.length - 1, i)]) };
  }
  // 그릴 때 바라보는 방향: 회전베기 placeholder 는 spin 구간 동안 좌우를 번갈아 뒤집어 「도는 것처럼」
  function facing(p) {
    var s = p.sk;
    if (!s) return p.dir;
    var ph = s.d.placeholder;
    if (ph && ph.spin && !usingArt(p) && s.t >= ph.spin[0] && s.t < ph.spin[1]) {
      return Math.floor((s.t - ph.spin[0]) / (ph.everyMs || 75)) % 2 ? -s.dir : s.dir;
    }
    return p.dir;
  }

  // ---------- 판정 ----------
  // k = 가로 범위 배율(기술 Lv5 area, 회전베기 둘레 +25%)
  function boxOf(p, r, k) {
    k = k || 1;
    var xa = p.x + r.x0 * k * p.dir, xb = p.x + r.x1 * k * p.dir;
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: p.y + r.yTop, y1: p.y + r.yBot, z: p.y, depth: r.depth || 16 };
  }
  function overlap(h, b) {
    return h.x0 < b.x1 && h.x1 > b.x0 && h.y0 < b.y1 && h.y1 > b.y0 && Math.abs(h.z - b.z) <= h.depth;
  }
  // 판정 값 + 기술 숫자 모양(damageStyle) 합친 것 (한 번만 만들어 둠)
  function stOf(h, d) {
    if (h._st && h._st.damageStyle === d.damageStyle) return h._st;
    var st = {}, k;
    for (k in h) if (k !== '_st') st[k] = h[k];
    st.damageStyle = d.damageStyle;
    if (st.hitstop == null) st.hitstop = 1;
    if (st.shake == null) st.shake = 1;
    if (st.knock == null) st.knock = 1;
    if (st.dmg == null) st.dmg = 1;
    h._st = st;
    return st;
  }
  function checkHit(p, d, h, i) {
    var s = p.sk, box = boxOf(p, h.reach, s.area), done = s.done[i] || (s.done[i] = {});
    s.boxes.push(box);
    H.targets().forEach(function (t) {
      if (!t) return;
      var id = t.id || 'dummy';
      if (done[id] || !H.canHit(t, h)) return;
      if (!overlap(box, t.hurtbox())) return;
      done[id] = true;
      var dir = p.dir;
      if (h.away && Math.abs(t.x - p.x) > 2) dir = t.x > p.x ? 1 : -1;   // 몸에서 바깥쪽으로(뒤에 있는 적은 뒤로)
      if (h.pull && Math.abs(t.x - p.x) > 2) dir = t.x > p.x ? -1 : 1;   // 칼날 폭풍(2026-11-06): 기사 쪽으로 끌어당김
      var first = !s.hitWin[i];
      s.hitWin[i] = true; s.hitAny = true;
      H.onHit(stOf(h, d), t, { dir: dir, wk: p.weaponKey, x: p.x + dir * 24 * AS(), y: p.y + (h.hitY != null ? h.hitY : -56 * AS()), mul: s.mul });
      if (first) impact(h);
    });
  }
  // 처음 맞은 순간 한 번: 화면 번쩍 + 슬로모션
  function impact(h) {
    if (h.flash) doFlash(h.flash);
    if (h.slowMs) H.slow(h.slowMs);
  }
  function doFlash(f) {
    var a = Math.min(0.8, f.alpha * FLY('flashMul', 1));   // 기술 번쩍 조금 더 밝게(2026-11-06 밤, juice.flashy.flashMul)
    if (flash && flash.alpha * (1 - flash.t / flash.life) > a) return;
    flash = { color: f.color, alpha: a, t: 0, life: f.ms || 120 };
  }

  // ---------- 효과 ----------
  function addGhost(p, tr) {
    var fr = p.currentFrame(), img = p.char.anims[fr.anim] && p.char.anims[fr.anim][fr.idx];
    if (!img) return;
    ghosts.push({ img: tintImg(img, tr.color), x: p.x, y: p.y, dir: facing(p), pivot: p.char.def.pivot, t: 0, life: tr.lifeMs, alpha: tr.alpha });
  }
  // 그림 한 장을 한 색으로 칠한 실루엣(잔상용, 그림마다 한 번만 만듦)
  function tintImg(img, color) {
    var m = tintImgCache && tintImgCache.get(img);
    if (m && m[color]) return m[color];
    var c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    var g = c.getContext('2d'); g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.85; g.fillStyle = color || '#ffffff'; g.fillRect(0, 0, c.width, c.height);
    Assets.copyMeta(img, c);
    if (tintImgCache) { m = m || {}; m[color] = c; tintImgCache.set(img, m); }
    return c;
  }
  // 기술 화려하게(2026-11-06 밤): config juice.flashy 값
  function FLY(k, def) { var F = CFG.juice && CFG.juice.flashy; return F && F[k] != null ? F[k] : def; }
  function playFx(p, f) {
    var dir = f.back ? -p.dir : p.dir, x = p.x + dir * (f.x || 0), y = p.y + (f.y || 0);
    // 베기·효과 그림이 나올 때 둘레에 둥근 빛(더하기) + 반짝 불티 → 그림 자체는 또렷하게 두고 빛만 부드럽게
    if ((f.type === 'slash' || f.type === 'art') && FLY('glow', 0) > 0) {
      var gc = f.tint || (f.ph && f.ph.tint) || '#cfe8ff';
      glow(x, y, 34 * AS(), gc, 220, FLY('glow', 0));
      debris(x, y, p.y, 6, { cols: ['#ffffff', gc], glow: true, sp: 150, size: 1.3, ms: 300 });
    }
    if (f.type === 'dust') { H.dust(p.x - p.dir * 10 * AS(), p.y, p.dir); return; }
    if (f.type === 'thrust') { FX.thrust(x, y, dir, f.len || 60, f.color || '#ffffff', f.ms || 200); return; }
    if (f.type === 'ring') {
      var rr = (f.r || 60) * ((p.sk && p.sk.area) || 1);   // 기술 Lv 크기
      rings.push({ x: p.x, y: y, r: rr, t: 0, life: f.ms || 160, color: f.color || '#ffffff' });
      if (SM()) { wave(p.x, p.y, rr * 1.25, { flat: 0.3, w: 4, ms: (f.ms || 160) * 1.6, color: '#ffffff', glow: '#8fc4ff', ground: true }); glow(p.x, y, (f.r || 60) * 0.8, '#cfe6ff', 200, 0.6); }
      return;
    }
    if (f.type === 'art') {   // 효과 그림: 없으면 ph(대신 쓸 효과)
      var A = fxArt(f.fx, f.fps);
      if (!A) { if (f.ph) playFx(p, f.ph); return; }
      arts.push({ A: A, p: p, follow: !!f.follow, ox: f.x || 0, oy: f.y || 0, x: x, y: y, dir: dir, rot: f.rot || 0, vx: f.vx || 0,
                  back: f.layer === 'back', split: !!f.split, alpha: f.alpha == null ? 1 : f.alpha,
                  scale: (f.scale || 1) * ((p.sk && p.sk.area) || 1), t: 0, life: A.loop ? (f.ms || 600) : A.fr.length * 1000 / A.fps });   // area = 기술 Lv 크기
      return;
    }
    // ---- 2차 기술 효과(2026-11-06, 우리 코드) ----
    if (f.type === 'beam') {   // 성검 낙뢰: 치켜든 칼끝에서 하늘 끝까지 금빛 줄기(칼끝을 따라감)
      beams.push({ p: p, ox: f.x || 0, oy: f.y || 0, t: 0, life: f.ms || 900, color: f.color || '#ffe9a0', k: (p.sk && p.sk.area) || 1 });
      glow(x, y, 40 * AS(), '#fff6c8', 360, 0.85);
      debris(x, y, p.y, 12, { cols: ['#ffffff', '#fff6c8', '#ffd23f'], glow: true, sp: 160, size: 1.5, ms: 420, spread: 1.6, g: -80 });
      return;
    }
    if (f.type === 'counterflash') {   // 반격: 금빛 번쩍 + 「반격!」
      glow(p.x, p.y - 60, 46, '#fff2c0', 220, 0.9);
      wave(p.x, p.y - 60, 50, { flat: 0.9, w: 3, ms: 220, color: '#ffffff', glow: '#ffc030' });
      FX.damage(p.x, p.y - (p.z || 0) - 118 * AS(), '반격!', false, CFG.juice, null, 'counter', 'player:counter');
      return;
    }
    if (f.type === 'arc') {   // 코드로 그린 초승달 베기(그림 없이): 빛나는 활 모양이 앞으로 휘둘러지며 사라짐
      arcs.push({ x: x, y: y, dir: dir, r: (f.r || 44) * ((p.sk && p.sk.area) || 1), t: 0, life: f.ms || 220, color: f.color || '#ffe08a' });
      return;
    }
    if (f.type === 'sound') { snd(f.name); return; }   // 그 장에 소리(sfx.js 에 있는 소리 이름, 2026-11-06)
    if (f.type === 'whirl') {   // 칼날 폭풍(2026-11-06, 우리 코드): 발밑 바람 고리 + 둘레로 튀는 강철 파편 + 빛. big = 마지막 터짐
      var wk = (p.sk && p.sk.area) || 1, wr = (f.r || 70) * wk, cy = p.y - 50 * AS();   // r = 판정과 같은 크기(도트)
      wave(p.x, p.y, wr, { flat: 0.3, w: f.big ? 5 : 3, ms: f.big ? 420 : 300, color: '#e8f4ff', glow: '#7fb8ff', ground: true, r0: wr * 0.3 });
      glow(p.x, cy, wr * (f.big ? 0.6 : 0.4), f.big ? '#e6f2ff' : '#cfe8ff', f.big ? 300 : 200, f.big ? 0.6 : 0.35);
      for (var wi = 0; wi < 2; wi++)   // 양옆으로 튀는 강철 파편·바람 불티
        debris(p.x + (wi ? 1 : -1) * wr * 0.5, cy + 10 * AS(), p.y, f.big ? 12 : 6,
               { cols: ['#ffffff', '#cfe8ff', '#8e9cb4'], glow: true, sp: f.big ? 240 : 170, size: 1.5, ms: f.big ? 520 : 360, spread: 1.5 });
      if (f.big) wave(p.x, cy, wr * 0.8, { flat: 0.9, w: 3, ms: 260, color: '#ffffff', glow: '#9cc8ff' });
      return;
    }
    if (f.type === 'sparkup') {   // 올려베기(2026-11-06 밤): 위로 솟는 빛 줄기 + 불티
      glow(x, y - 16 * AS(), 26 * AS(), f.color || '#cfe8ff', 220, 0.7);
      debris(x, y, p.y, 10, { cols: ['#ffffff', f.color || '#cfe8ff', '#8fc4ff'], glow: true, sp: 260, size: 1.5, ms: 360, spread: 0.35, g: 300 });
      return;
    }
    if (f.type === 'spark') {
      var M = CFG.magic.spark, fr = tintFx(M.frames, f.tint, 0.6);
      if (fr) FX.sprite(x, y, fr, M.fps, M.pivot, dir < 0, false, f.scale || 1);
      return;
    }
    if (f.type === 'slash') {
      var spr = tintFx('slash', f.tint, 0.55), arc = { from: -100, to: 40, r: 50 * AS(), w: 10 * AS() }, ka = (p.sk && p.sk.area) || 1;   // ka = 기술 Lv 크기
      FX.slash(x, y, dir, arc, f.tint || '#ffffff', f.ms || 200, spr, { rot: f.rot, sx: (f.sx || 1) * ka, sy: (f.sy || 1) * ka, flipY: f.flipY, top: true });
    }
  }

  // 화염구: 느리고 큰 불덩이 → 처음 맞은 적(또는 끝)에서 터짐
  // s = 그 기술 진행(데미지 배율·Lv5 크기), o = 쏘는 자리 { x, y, dir, dy(위아래로 비킴) } (각성 「한 발 더」는 처음 쏜 자리 그대로)
  function castFireball(p, d, s, o) {
    snd('fireball');
    var c = d.cast, real = fxArt(c.art), B = CFG.magic.bolt;
    var fr = real ? real.fr : tintFx(B.frames, c.tint, c.tintK);
    var ka = s.area || 1;   // 기술 Lv 크기(탄 그림·판정 같이)
    Projectiles.spawn({ x: o.x + o.dir * c.x, y: o.y + c.y + (o.dy || 0), z: o.y, dir: o.dir, speed: c.speed, range: c.range, box: { w: c.box.w * ka, h: c.box.h * ka }, depth: c.depth,
      burstAtEnd: true, backReach: c.backReach || 0, frames: fr, fps: real ? real.fps : B.fps,
      pivot: real ? real.pivot : B.pivot, scale: (real ? 1 : (c.scale || 1)) * ka,
      skill: { d: d, c: c, wk: p.weaponKey, emberT: 0, mul: s.mul, area: s.area, lv: s.L.lv },
      glow: SM() ? fireGlow : null,

      onImpact: function (pr, t) { atLv(pr.skill.lv, function () { fireBurst(pr, t); }); } });
    FX.shake(CFG.juice.shakePx * 0.8, CFG.juice.shakeMs);
  }
  // 날아가는 화염구 뒤 주황 빛(더하기, 깜빡이며 숨쉬듯)
  function fireGlow(ctx) {
    var r = 30 * AS() * (1 + 0.12 * Math.sin(performance.now() / 45));
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, 'rgba(255,200,90,0.85)'); g.addColorStop(0.45, 'rgba(255,120,30,0.45)'); g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
  }
  function fireBurst(pr, direct) {
    snd('fireBoom');

    var S = pr.skill, c = S.c, b = c.burst, real = fxArt(b.art), M = CFG.magic.burst, A = S.area || 1, R = b.r * A;   // A = Lv5 폭발 크기
    if (real) spriteFrom(pr.x, pr.y, real.fr, real.fps, real.pivot, pr.dir < 0, A, b.fromFrame);
    else { var fr = tintFx(M.frames, b.tint, b.tintK); if (fr) spriteFrom(pr.x, pr.y, fr, M.fps, M.pivot, pr.dir < 0, (b.scale || 1) * A, b.fromFrame); }
    FX.shake(CFG.juice.shakePx * 2.2, CFG.juice.shakeMs * 1.6);
    doFlash(c.hit.flash || { color: '#ffb060', alpha: 0.3, ms: 120 });
    // 크고 화려하게(2026-11-03 HD): 불빛 → 공중 충격파 고리 + 땅 충격파 + 불티·돌 파편
    glow(pr.x, pr.y, R * 1.5, '#ffb050', 320, 0.9);
    wave(pr.x, pr.y, R * 1.35, { flat: 0.75, w: 5, ms: 340, color: '#fff2c0', glow: '#ff7a1a' });
    wave(pr.x, pr.z, R * 1.7, { flat: 0.3, w: 4, ms: 420, color: '#ffd28a', glow: '#ff5a10', ground: true });
    debris(pr.x, pr.y, pr.z, 16, { cols: ['#ffd27a', '#ff8a2a', '#ff5a1e', '#fff4d0'], glow: true, sp: 210, size: 2, ms: 600 });
    debris(pr.x, pr.y + 6 * AS(), pr.z, 9, { cols: ['#5a3a26', '#7a5236', '#3e2a1e'], sp: 170, size: 2.6, ms: 800 });
    debris(pr.x, pr.y - 4 * AS(), pr.z, 10, { cols: ['#3a3038', '#5a4e58'], sp: 60, size: 3, ms: 900, g: -60, spread: 0.6 });   // 연기(위로 천천히, 2026-11-06 밤)
    glow(pr.x, pr.y, R * 0.9, '#fff2c0', 160, 0.8);
    var st = stOf(c.hit, S.d), any = false;
    H.targets().forEach(function (t) {
      if (!t || !H.canHit(t, c.hit)) return;
      var hb = t.hurtbox();
      if (t !== direct) {
        if (Math.abs(hb.z - pr.z) > b.depth * A) return;
        var nx = clamp(pr.x, hb.x0, hb.x1), ny = clamp(pr.y, hb.y0, hb.y1);
        if (Math.hypot(nx - pr.x, ny - pr.y) > R) return;
      }
      var dir = Math.abs(t.x - pr.x) < 4 ? pr.dir : (t.x > pr.x ? 1 : -1);
      H.onHit(st, t, { dir: dir, wk: S.wk, x: pr.x, y: pr.y, mul: S.mul });
      any = true;
    });
    if (any && c.hit.slowMs) H.slow(c.hit.slowMs);
  }

  // 번개 한 줄기: 정해 둔 바닥 자리(sx[k], sz[k] = 겨눈 적 발밑 또는 법사 앞 고정 자리)에 화면 맨 위에서 내리꽂힘
  //   (2026-11-06 밤: s = 그 기술 진행, x·z = 꽂힐 자리 → 각성 「한 번 더」가 같은 자리에 다시 꽂을 수 있게)
  function strike(p, d, s, k, x, z) {
    snd('lightning');
    var K = s.K || d.strikes, h = K.hits[Math.min(k, K.hits.length - 1)], KR = K.r * s.area;   // KR = Lv5 번개 굵기
    bolts.push({ x: x, z: z, t: 0, life: K.ms || 200, K: K, seed: Math.random() * 1000 });
    var hitA = fxArt(K.hitArt), M = CFG.magic.spark;
    if (hitA) spriteFrom(x, z, hitA.fr, hitA.fps, hitA.pivot, s.dir < 0, 1, K.hitFromFrame);   // 땅 번쩍(기준 = 아래 가운데)
    else { var fr = tintFx(M.frames, K.glow || '#fff27a', 0.55); if (fr) spriteFrom(x, z - 6 * AS(), fr, M.fps, M.pivot, false, 1.8, K.hitFromFrame); }
    H.dust(x, z, 1);
    // 땅 충격파 + 기둥 빛 + 전기 불티 (2026-11-03 HD)
    wave(x, z, KR * 2.6, { flat: 0.3, w: 4, ms: 360, color: '#f4ffff', glow: K.color || '#59e6ff', ground: true });
    glow(x, z - 20 * AS(), KR * 1.9, '#9ff4ff', 240, 0.85);
    glow(x, z - 60 * AS(), KR * 1.4, '#e8ffff', 160, 0.5);   // 기둥 위쪽 빛(2026-11-06 밤)
    debris(x, z - 4 * AS(), z, 10, { cols: ['#ffffff', '#bff8ff', '#fff6a0'], glow: true, sp: 190, size: 1.6, ms: 420, spread: 1.4 });
    FX.shake(CFG.juice.shakePx * (h.shake || 1.5), CFG.juice.shakeMs);
    if (h.flash) doFlash(h.flash);
    var st = stOf(h, d), any = false;
    H.targets().forEach(function (t) {
      if (!t || !H.canHit(t, h)) return;
      var hb = t.hurtbox();
      if (Math.abs(hb.z - z) > K.depth) return;
      if (x < hb.x0 - KR || x > hb.x1 + KR) return;
      var dir = Math.abs(t.x - x) < 3 ? s.dir : (t.x > x ? 1 : -1);
      H.onHit(st, t, { dir: dir, wk: p.weaponKey, x: x, y: t.y - 40 * AS(), mul: s.mul });
      t.stunKind = 'shock';
      any = true;
    });
    if (any && h.slowMs) H.slow(h.slowMs);
  }

  // ---------- 성장 4단계 새 기술 (2026-11-06) ----------
  // 그림 고르기: look 에 적힌 효과 그림(config skillFx)이 불러와져 있으면 그것, 없으면 임시 그림(기존 그림 물들이기 · 코드로 그린 모양).
  //   새 그림이 오면 config 의 look 값만 바꾸면 됨(여기 판정·데미지는 그대로)
  function lookOf(d) { return d.look || {}; }

  // 검기 날리기: 앞으로 날아가며 길 위의 적을 모두 꿰뚫음(적마다 한 번). k = 몇 번째 검기(Lv5 = 2개, 두 번째는 살짝 위)
  //   2026-11-07 형님(검기가 약해 안 씀): 기술 Lv 마다 크게(config wave.grow: 크기 Lv5 1.8배 · 뒤 빛 · 꼬리 · 불똥 · 멈춤 · 흔들림)
  function castWave(p, d, k) {
    snd('skWave');
    var w = d.shot, s = p.sk, lk = lookOf(d), A5 = s.L.lv5 && fxArt(lk.projLv5, lk.fps), A = A5 || fxArt(lk.proj, lk.fps), hitIds = {};
    var GW = d.grow, gi = clamp((s.L.lv || 1) - 1, 0, 4), gk = function (n) { return GW && GW[n] && GW[n][gi] != null ? GW[n][gi] : 1; };
    var sz = GW ? gk('size') * (H.areaMul ? H.areaMul(d) : 1) : s.area;   // 검기 크기(그림 + 맞는 상자 같이)
    var artK = A5 && GW && GW.lv5Art ? sz / GW.lv5Art : sz;              // Lv5 금테 그림은 원래 커서 그만큼 덜 키움
    var hitL = waveHit(d, w.hit, gi, gk), gl = gk('glow');
    // 우리 그림(ours): 나가는 장 → 반복 구간(range)만 날아가는 동안 → 끝에서 흩어지는 장(range 뒤)을 그 자리에 한 번
    var ours = !!(A && A.ours && A.range), fr = A ? (ours ? A.fr.slice(0, A.range[1] + 1) : (A.fr.length > 2 ? A.fr.slice(1) : A.fr)) : null;
    Projectiles.spawn({ x: p.x + p.dir * w.x, y: p.y + w.y - (k ? 12 * AS() : 0), z: p.y, dir: p.dir, speed: w.speed, range: w.range,
      box: { w: w.box.w * sz, h: w.box.h * sz }, depth: w.depth * Math.sqrt(sz), backReach: w.x, frames: fr, fps: A ? A.fps : 12, pivot: A ? A.pivot : null,
      scale: (A && !A.ours ? (lk.scale || 1) * sz : artK),   // 기술 Lv 크기(그림·판정 같이)
      loop: ours ? A.range : null, burstAtEnd: ours,
      fade: ours ? 0 : 40 * AS(), drawFn: fr ? null : waveShape, glow: SM() ? function (ctx) { waveGlow(ctx, gl); } : null,
      skill: { d: d, c: w, wk: p.weaponKey, mul: s.mul, lv: s.L.lv },
      skip: function (t) { return hitIds[t.id || 'dummy'] || !H.canHit(t, hitL); },
      onImpact: function (pr, t) {
        if (!t) {   // 끝까지 날아감: 흩어지는 장
          if (ours && A.fr.length > A.range[1] + 1) FX.sprite(pr.x, pr.y, A.fr.slice(A.range[1] + 1), A.fps, A.pivot, pr.dir < 0, false, 1);
          return;
        }
        hitIds[t.id || 'dummy'] = true;
        atLv(pr.skill.lv, function () {
          // 누운 적(2026-11-06 형님, hitsDown): 검기는 몸 높이로 날아가므로 누운 몸 높이에서 불똥
          var down = t.state === 'down';
          H.onHit(stOf(hitL, d), t, { dir: pr.dir, wk: pr.skill.wk, x: pr.x, y: down ? t.y - 12 * AS() : pr.y, mul: pr.skill.mul });
          var sp = gk('spark');   // Lv 오를수록 불똥 많이 · 크게, Lv3 부터 맞은 자리 번쩍
          debris(pr.x, down ? t.y - 8 * AS() : pr.y, pr.z, Math.round(5 * sp), { cols: ['#ffffff', '#cfe8ff', '#8fc4ff'], glow: true, sp: 140 * Math.sqrt(sp), size: 1.4 * Math.sqrt(sp), ms: 260 });
          if (gi >= 2) glow(pr.x, down ? t.y - 8 * AS() : pr.y, 22 * AS() * sz, '#d8ecff', 170, 0.35 + 0.1 * gi);
        });
        pr.dead = false;   // 꿰뚫고 계속 날아감
      } });
    FX.shake(CFG.juice.shakePx * 0.6 * gk('shake'), CFG.juice.shakeMs);
  }
  // 검기 Lv 별 판정 값(불똥 · 멈춤 · 흔들림 배율 = config wave.grow), Lv 마다 한 번만 만들어 둠
  function waveHit(d, h, gi, gk) {
    if (!d.grow) return h;
    var C = d._wHit || (d._wHit = []);
    if (!C[gi]) { var o = {}, n; for (n in h) if (n !== '_st') o[n] = h[n]; o.spark = (h.spark || 1) * gk('spark'); o.hitstop = (h.hitstop != null ? h.hitstop : 1) * gk('hitstop'); o.shake = (h.shake != null ? h.shake : 1) * gk('shake'); C[gi] = o; }
    return C[gi];
  }
  // 검기 임시 그림(그림이 없을 때): 오른쪽으로 볼록한 하늘색 초승달 (탄 기준 = 가운데, Projectiles 가 좌우를 뒤집어 줌)
  function waveShape(ctx) {
    var r = 30 * AS(), t = performance.now() / 60;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    [['#4a8cff', 9, 0.45], ['#a8d4ff', 5, 0.85], ['#ffffff', 2, 1]].forEach(function (L) {
      ctx.globalAlpha = L[2] * (0.85 + 0.15 * Math.sin(t)); ctx.strokeStyle = L[0]; ctx.lineWidth = L[1] * AS() * 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(-r * 0.6, 0, r, -1.1, 1.1); ctx.stroke();
    });
    ctx.restore();
  }
  //   k = 빛 세기(2026-11-07 Lv 마다, config wave.grow.glow): 뒤 동그란 빛 + 뒤로 길게 끌리는 꼬리(검기는 오른쪽으로 날아감 → 꼬리는 왼쪽)
  function waveGlow(ctx, k) {
    k = k || 1;
    var r = 34 * AS(), g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, 'rgba(190,225,255,' + Math.min(0.85, 0.5 * k) + ')'); g.addColorStop(1, 'rgba(80,140,255,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2);
    if (k > 1) {
      var L = r * (1 + 1.6 * (k - 1)), tg = ctx.createLinearGradient(-L, 0, 0, 0);
      tg.addColorStop(0, 'rgba(80,140,255,0)'); tg.addColorStop(1, 'rgba(200,230,255,' + Math.min(0.6, 0.25 * k) + ')');
      ctx.fillStyle = tg; ctx.fillRect(-L, -r * 0.45, L, r * 0.9);
    }
    ctx.restore();
  }

  // 대지 내려찍기 착지: 양옆 땅 충격파 → 반지름 안 적 모두(누운 적도) + 짧은 기절
  function quake(p, d) {
    var Q = d.quake, s = p.sk, R = Q.r * s.area, x = p.x, z = p.y, lk = lookOf(d), A = fxArt(lk.ring);
    snd('skSlam');
    H.hitstop(70);
    FX.shake(CFG.juice.shakePx * 2.6, CFG.juice.shakeMs * 1.8);
    H.dust(x - 16 * AS(), z, -1); H.dust(x + 16 * AS(), z, 1);
    if (A) spriteFrom(x, z, A.fr, A.fps, A.pivot, p.dir < 0, s.area, 0);
    if (!A || !A.ours) {   // 우리 그림에는 양옆 충격파·돌이 들어 있음 → 코드 고리·돌은 그림이 없을 때만
      wave(x, z, R * 1.15, { flat: 0.28, w: 5, ms: 420, color: '#fff2d6', glow: '#ffb050', ground: true });
      wave(x, z, R * 0.75, { flat: 0.28, w: 4, ms: 300, color: '#ffffff', glow: '#ffd890', ground: true });
      debris(x - R * 0.4, z - 4 * AS(), z, 9, { cols: ['#6a5a4a', '#8a7258', '#4a3e32', '#c8b08a'], sp: 220, size: 2.6, ms: 760, spread: 1.0 });
      debris(x + R * 0.4, z - 4 * AS(), z, 9, { cols: ['#6a5a4a', '#8a7258', '#4a3e32', '#c8b08a'], sp: 220, size: 2.6, ms: 760, spread: 1.0 });
    }
    glow(x, z - 8 * AS(), R * 0.55, '#ffe0a0', 260, 0.7);
    debris(x, z - 6 * AS(), z, 10, { cols: ['#fff2a0', '#ffb040', '#ffffff'], glow: true, sp: 180, size: 1.5, ms: 380, spread: 1.4 });
    var st = stOf(Q.hit, d), any = false;
    H.targets().forEach(function (t) {
      if (!t || !H.canHit(t, Q.hit)) return;
      var hb = t.hurtbox();
      if (Math.abs(hb.z - z) > Q.depth * s.area) return;
      if (hb.x1 < x - R || hb.x0 > x + R) return;
      var dir = Math.abs(t.x - x) < 3 ? p.dir : (t.x > x ? 1 : -1);
      H.onHit(st, t, { dir: dir, wk: p.weaponKey, x: t.x - dir * 6 * AS(), y: z - 30 * AS(), mul: s.mul });
      t.stunKind = 'stars';   // 기절 표시 = 머리 위 별(감전 그림은 번개만)
      any = true;
    });
    if (any) impact(Q.hit);
  }

  // 얼음창: 처음 맞은 적 하나(Lv5 = 꿰뚫음) + 느려짐. 날아가는 그림 = look.proj(없으면 마법탄을 얼음색으로)
  function castIce(p, d, s, o) {
    snd('iceSpear');
    var c = d.cast, lk = lookOf(d), real = fxArt(lk.proj), B = CFG.magic.bolt, hitIds = {};
    var fr = real ? real.fr : tintFx(B.frames, c.tint, c.tintK), pierce = !!(s.L.lv5 && s.L.lv5.pierce);
    var ki = s.area || 1;   // 기술 Lv 크기(창 그림·판정 같이)
    Projectiles.spawn({ x: o.x + o.dir * c.x, y: o.y + c.y + (o.dy || 0), z: o.y, dir: o.dir, speed: c.speed, range: c.range, box: { w: c.box.w * ki, h: c.box.h * ki }, depth: c.depth,
      backReach: c.backReach || 0, frames: fr, fps: real ? real.fps : B.fps, pivot: real ? real.pivot : B.pivot, scale: (real ? 1 : (c.scale || 1)) * ki,
      loop: real ? real.range : null, fade: 30 * AS(), glow: SM() ? iceGlow : null,
      skill: { d: d, c: c, wk: p.weaponKey, mul: s.mul, lv: s.L.lv },
      skip: function (t) { return hitIds[t.id || 'dummy'] || !H.canHit(t, c.hit); },
      onImpact: function (pr, t) {
        if (!t) return;
        hitIds[t.id || 'dummy'] = true;
        atLv(pr.skill.lv, function () { iceHit(pr, t); });
        if (pierce) pr.dead = false;
      } });
    FX.shake(CFG.juice.shakePx * 0.6, CFG.juice.shakeMs);
  }
  function iceGlow(ctx) {
    var r = 24 * AS(), g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, 'rgba(220,250,255,0.8)'); g.addColorStop(0.5, 'rgba(120,210,255,0.35)'); g.addColorStop(1, 'rgba(60,140,255,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
  }
  function iceHit(pr, t) {
    snd('iceHit');
    var S = pr.skill, c = S.c, lk = lookOf(S.d), A = fxArt(lk.hit), M = CFG.magic.spark;
    H.onHit(stOf(c.hit, S.d), t, { dir: pr.dir, wk: S.wk, x: pr.x, y: pr.y, mul: S.mul });
    // 느려짐: 그 적의 시간이 mul 배로 흐름(enemies.js update). 보스는 덜 느려짐
    if (c.slow && t.T && t.alive && t.alive()) { t.slowT = c.slow.ms; t.slowK = t.T.boss ? c.slow.bossMul : c.slow.mul; }
    if (A) spriteFrom(pr.x, pr.y, A.fr, A.fps, A.pivot, pr.dir < 0, 1, 0);
    else { var fr = tintFx(M.frames, '#bff4ff', 0.75); if (fr) FX.sprite(pr.x, pr.y, fr, M.fps, M.pivot, pr.dir < 0, false, 1.8); }
    glow(pr.x, pr.y, 34 * AS(), '#bfefff', 240, 0.8);
    debris(pr.x, pr.y, pr.z, 8, { cols: ['#ffffff', '#d8f8ff', '#9fe8ff'], glow: true, sp: 190, size: 1.4, ms: 380 });   // 얼음 반짝(2026-11-06 밤)
    if (A && A.ours) return;   // 우리 그림에 고리·조각이 들어 있음
    wave(pr.x, pr.y, 40 * AS(), { flat: 0.8, w: 3, ms: 260, color: '#ffffff', glow: '#7fd8ff' });
    debris(pr.x, pr.y, pr.z, 10, { cols: ['#ffffff', '#d8f8ff', '#9fe8ff', '#6ac8ff'], sp: 160, size: 1.8, ms: 520, spread: 1.5 });
  }

  // ---------- 땅 융기 (2026-11-06 밤 콤보) ----------
  // 마법진 장(pillar.at)에 자리 정함: 앞쪽 가까운 적(소품 빼고, 넘어진 적 빼고) 발밑, 없으면 법사 앞 x. 솟기 lockMs 전까지 그 적을 따라감
  function pillarStep(p, d, s, t) {
    var P = d.pillar;
    if (!s.pl && t >= P.at) {
      var tgt = null, best = 1e9;
      H.targets().forEach(function (e) {
        if (!e || e.isProp || !e.T || (e.alive && !e.alive()) || e.state === 'down' || !H.canHit(e, P.hit)) return;
        var dx = (e.x - p.x) * p.dir;
        if (dx < -6 * AS() || dx > P.aim.range || Math.abs(e.y - p.y) > P.aim.depth) return;
        var dd = Math.abs(dx) + Math.abs(e.y - p.y) * 0.5;
        if (dd < best) { best = dd; tgt = e; }
      });
      s.pl = { x: tgt ? tgt.x : p.x + p.dir * P.x, z: tgt ? tgt.y : p.y, tgt: tgt, t0: t };
    }
    if (s.pl && !s.plDone) {
      var g = s.pl.tgt;
      if (g && t < P.burstAt - (P.lockMs || 90) && (!g.alive || g.alive()) && g.state !== 'down') { s.pl.x = g.x; s.pl.z = g.y; }
      if (t >= P.burstAt) {
        s.plDone = true; pillarBurst(p, d, s, s.pl.x, s.pl.z);
        if (s.echo) {   // 각성 마력 폭주: 다른 적(없으면 조금 더 앞) 발밑에 기둥 하나 더
          var x0 = s.pl.x, z0 = s.pl.z, first = s.pl.tgt, dir = p.dir, px = p.x, pz = p.y;
          echo(d, function () {
            var tgt = null, best = 1e9;
            H.targets().forEach(function (e) {
              if (!e || e.isProp || !e.T || e === first || (e.alive && !e.alive()) || e.state === 'down' || !H.canHit(e, P.hit)) return;
              var dx = (e.x - px) * dir;
              if (dx < -6 * AS() || dx > P.aim.range || Math.abs(e.y - pz) > P.aim.depth) return;
              var dd = Math.abs(dx) + Math.abs(e.y - pz) * 0.5;
              if (dd < best) { best = dd; tgt = e; }
            });
            pillarBurst(p, d, s, tgt ? tgt.x : x0 + dir * 56 * AS(), tgt ? tgt.y : z0);
          });
        }
      }
    }
  }
  // 돌기둥 솟음: 우리 그림(look.pillar, 기둥 솟음~무너짐) + 흔들림·보라 빛·돌 파편 + 기둥 위 적 띄우기(판정 = 기둥 폭 r x area, 위아래 depth)
  function pillarBurst(p, d, s, x, z) {
    snd('earthRise');
    var P = d.pillar, R = P.r * s.area, lk = lookOf(d), A = fxArt(lk.pillar);
    pillars.push({ x: x, z: z, A: A, t: 0, life: A ? A.fr.length * 1000 / A.fps : 520, dir: s.dir, k: s.area });
    H.hitstop(50);
    FX.shake(CFG.juice.shakePx * 1.8, CFG.juice.shakeMs * 1.4);
    H.dust(x - 12 * AS(), z, -1); H.dust(x + 12 * AS(), z, 1);
    glow(x, z - 30 * AS(), R * 1.6, '#b892ff', 260, 0.7);
    wave(x, z, R * 1.9, { flat: 0.3, w: 3, ms: 320, color: '#ead8ff', glow: '#7e4cd8', ground: true });
    debris(x, z - 6 * AS(), z, 12, { cols: ['#664a36', '#94704e', '#c09a70', '#3c2a20'], sp: 230, size: 2.6, ms: 760, spread: 0.7 });
    debris(x, z - 10 * AS(), z, 8, { cols: ['#ead8ff', '#b892ff', '#ffffff'], glow: true, sp: 200, size: 1.4, ms: 380, spread: 0.6 });
    var st = stOf(P.hit, d), any = false;
    H.targets().forEach(function (t) {
      if (!t || !H.canHit(t, P.hit)) return;
      var hb = t.hurtbox();
      if (Math.abs(hb.z - z) > P.depth * s.area) return;
      if (hb.x1 < x - R || hb.x0 > x + R) return;
      H.onHit(st, t, { dir: p.dir, wk: p.weaponKey, x: x, y: z - 34 * AS(), mul: s.mul });
      any = true;
    });
    if (any) impact(P.hit);
  }
  // 마법진(바닥, 캐릭터 밑): 정한 뒤 ~ 솟을 때까지 look.circle 그림(처음 몇 장 = 나타남, 그 뒤 반복). 그림이 없으면 코드로 보라 타원
  function drawCircle(ctx, camX, p) {
    var s = p && p.state === 'skill' && p.sk, d = s && s.d;
    if (!d || !d.pillar || !s.pl || s.plDone) return;
    var A = fxArt(lookOf(d).circle), t = s.t - s.pl.t0, x = s.pl.x - camX;
    if (A) {
      var n = A.fr.length, i = Math.floor(t * A.fps / 1000), lp = A.range || [0, n - 1];
      if (i > lp[1]) i = lp[0] + (i - lp[0]) % (lp[1] - lp[0] + 1);
      ctx.save(); ctx.translate(snapPx(x), snapPx(s.pl.z)); if (s.area !== 1) ctx.scale(s.area, s.area);
      Assets.blit(ctx, A.fr[Math.min(n - 1, i)], A.pivot.x, A.pivot.y); ctx.restore();
      return;
    }
    var R = d.pillar.r * 1.2 * s.area, k = clamp(t / 120, 0, 1);
    ctx.save(); ctx.globalAlpha = 0.8; ctx.strokeStyle = '#b892ff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x, s.pl.z, R * k, R * 0.3 * k, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  // 돌기둥: 캐릭터와 깊이 순서로(기둥 자리보다 조금 뒤 → 같은 줄 적은 기둥 앞에 보임). main.js render 가 부름
  function addEnts(ents, ctx, camX) {
    // 2차(2026-11-06): 불기둥(기둥 자리보다 조금 뒤) · 번개 칼(꽂힌 자리 적보다 조금 앞 → 몸에 꽂힌 듯 보임)
    flames.forEach(function (f) { ents.push({ y: f.z + 0.6, d: function () { drawFlame(ctx, camX, f); } }); });   // 앞에(더하기 빛이라 안의 적이 비쳐 보임 = 불에 휩싸인 듯)
    blades.forEach(function (b) { ents.push({ y: b.z + 0.6, d: function () { drawBlade(ctx, camX, b); } }); });
    tornados.forEach(function (o) { ents.push({ y: o.z + 0.7, d: function () { drawTornado(ctx, camX, o); } }); });   // 회오리 = 안의 적 앞에(빛이라 비쳐 보임)
    pillars.forEach(function (q) {
      ents.push({ y: q.z - 0.5, d: function () {
        var A = q.A, x = q.x - camX;
        ctx.save(); ctx.translate(snapPx(x), snapPx(q.z)); ctx.scale(q.dir * q.k, q.k);
        if (A) Assets.blit(ctx, A.fr[Math.min(A.fr.length - 1, Math.floor(q.t * A.fps / 1000))], A.pivot.x, A.pivot.y);
        else {   // 그림이 없을 때: 코드로 그린 돌기둥(솟았다 줄어듦)
          var u = q.t / q.life, h = 70 * AS() * (u < 0.25 ? u / 0.25 : u > 0.7 ? (1 - u) / 0.3 : 1), w = 12 * AS();
          ctx.fillStyle = '#3c2a20'; ctx.fillRect(-w - 1, -h - 1, w * 2 + 2, h + 1);
          ctx.fillStyle = '#94704e'; ctx.fillRect(-w, -h, w * 2, h);
          ctx.fillStyle = '#b892ff'; ctx.fillRect(-w, -h, w * 2, 2);
        }
        ctx.restore();
      } });
    });
  }

  // 메테오: 앞쪽 가까운 적 발밑(없으면 법사 앞 x)에 표시 → markMs 동안 그 적을 따라가다 고정 → fallMs 동안 비스듬히 떨어져 터짐
  //   (2026-11-06 밤 각성: o = 처음 쓴 자리, first = 처음 운석 → 그 적은 빼고 다음 가까운 적, 없으면 처음 자리보다 조금 더 앞. 돌려주는 값 = 운석)
  function castMeteor(p, d, s, o, first) {
    var M = d.meteor, tgt = null, best = 1e9;
    o = o || { x: p.x, y: p.y, dir: p.dir };
    H.targets().forEach(function (t) {
      if (!t || t.isProp || !t.T || (t.alive && !t.alive()) || (first && t === first.tgt)) return;
      var dx = (t.x - o.x) * o.dir;
      if (dx < -6 * AS() || dx > M.aim.range || Math.abs(t.y - o.y) > M.aim.depth) return;
      var dd = Math.abs(dx) + Math.abs(t.y - o.y) * 0.5;
      if (dd < best) { best = dd; tgt = t; }
    });
    var x = tgt ? tgt.x : first ? first.x + o.dir * 70 * AS() : o.x + o.dir * M.x, z = tgt ? tgt.y : first ? first.z : o.y;
    var m = { x: x, z: z, dir: o.dir, t: 0, M: M, d: d, tgt: tgt, wk: p.weaponKey, mul: s.mul, area: s.area, boom: false, emberT: 0, lv: curLv };
    meteors.push(m);
    FX.shake(CFG.juice.shakePx * 0.8, CFG.juice.shakeMs);
    return m;
  }
  // 운석 자리(u = 떨어지는 진행 0→1): 뒤쪽 위에서 비스듬히 내려옴
  function meteorPos(m, u) {
    var back = 120 * AS() * (1 - u);
    return { x: m.x - m.dir * back, y: (m.z - m.M.size * 0.6) - (1 - u) * (m.z + 40 * AS()) };
  }
  function meteorStep(dt) {
    for (var i = meteors.length - 1; i >= 0; i--) {
      var m = meteors[i], M = m.M;
      m.t += dt;
      if (m.t < M.markMs - 160 && m.tgt && (!m.tgt.alive || m.tgt.alive())) { m.x = m.tgt.x; m.z = m.tgt.y; }
      if (!m.boom && m.t >= M.markMs) {   // 떨어지는 중: 불티
        if (!m.fallSnd) { m.fallSnd = true; snd('meteorFall'); }   // 「휘이잉」
        m.emberT -= dt;
        if (m.emberT <= 0) {
          m.emberT = 30;
          var q = meteorPos(m, clamp((m.t - M.markMs) / M.fallMs, 0, 1));
          debris(q.x, q.y, m.z, 2, { cols: ['#ffd27a', '#ff8a2a', '#ff5a1e'], glow: true, sp: 60, size: 1.6, ms: 300, g: -40 });
        }
      }
      // 우리 메테오 그림(look.art): 「쾅」 장(hit)이 터지는 순간에 오도록 그만큼 먼저 떨어지는 장부터 재생(자리는 이미 고정됨)
      var MA = !m.artOn && fxArt(lookOf(m.d).art);
      if (MA && m.t >= M.markMs + M.fallMs - (MA.hit || 0) * 1000 / MA.fps) { m.artOn = true; FX.sprite(m.x, m.z, MA.fr, MA.fps, MA.pivot, m.dir < 0, false, m.area); }   // area = 기술 Lv 크기
      if (!m.boom && m.t >= M.markMs + M.fallMs) { m.boom = true; atLv(m.lv, function () { meteorBoom(m); }); }
      if (m.boom && m.t >= M.markMs + M.fallMs + 100) meteors.splice(i, 1);
    }
  }
  function meteorBoom(m) {
    snd('meteorBoom');
    var M = m.M, R = M.r * m.area, x = m.x, z = m.z, lk = lookOf(m.d), A = fxArt(lk.boom), B = CFG.magic.burst, y = z - 24 * AS();
    if (m.artOn) {   // 우리 그림(폭발·불고리·연기 들어 있음): 빛·흔들림·데미지만
      H.hitstop(110); FX.shake(CFG.juice.shakePx * 3.6, CFG.juice.shakeMs * 2.2);
      doFlash(M.hit.flash || { color: '#ffc070', alpha: 0.5, ms: 200 });
      glow(x, y, R * 1.1, '#ffb050', 380, 0.7);
      debris(x, y, z, 18, { cols: ['#ffd27a', '#ff8a2a', '#fff4d0'], glow: true, sp: 300, size: 2, ms: 650 });   // 불티 더(2026-11-06 밤)
      debris(x, y - 10 * AS(), z, 12, { cols: ['#2e2a36', '#4a4452'], sp: 70, size: 3.4, ms: 1100, g: -50, spread: 0.8 });   // 연기
      H.dust(x - 20 * AS(), z, -1); H.dust(x + 20 * AS(), z, 1);
      meteorHit(m, x, z, y, R);
      return;
    }
    if (A) spriteFrom(x, y, A.fr, A.fps, A.pivot, m.dir < 0, 1.9 * m.area, 1);
    else { var fr = tintFx(B.frames, '#ff6a10', 0.6); if (fr) spriteFrom(x, y, fr, B.fps, B.pivot, m.dir < 0, 3 * m.area, 1); }
    H.hitstop(110);
    FX.shake(CFG.juice.shakePx * 3.6, CFG.juice.shakeMs * 2.2);
    doFlash(M.hit.flash || { color: '#ffc070', alpha: 0.5, ms: 200 });
    glow(x, y, R * 1.3, '#ffb050', 420, 0.95);
    wave(x, y, R * 1.1, { flat: 0.7, w: 6, ms: 420, color: '#fff2c0', glow: '#ff7a1a' });
    wave(x, z, R * 1.5, { flat: 0.3, w: 5, ms: 520, color: '#ffd28a', glow: '#ff5a10', ground: true });
    wave(x, z, R * 0.9, { flat: 0.3, w: 4, ms: 360, color: '#ffffff', glow: '#ffb050', ground: true });
    debris(x, y, z, 26, { cols: ['#ffd27a', '#ff8a2a', '#ff5a1e', '#fff4d0'], glow: true, sp: 280, size: 2.2, ms: 700 });
    debris(x, z - 4 * AS(), z, 16, { cols: ['#5a3a26', '#7a5236', '#3e2a1e', '#2a2020'], sp: 240, size: 3, ms: 900 });
    H.dust(x - 20 * AS(), z, -1); H.dust(x + 20 * AS(), z, 1);
    meteorHit(m, x, z, y, R);
  }
  // 메테오 데미지(터지는 자리 둘레 R, 위아래 depth)
  function meteorHit(m, x, z, y, R) {
    var M = m.M, st = stOf(M.hit, m.d), any = false;
    H.targets().forEach(function (t) {
      if (!t || !H.canHit(t, M.hit)) return;
      var hb = t.hurtbox();
      if (Math.abs(hb.z - z) > M.depth * m.area) return;
      if (hb.x1 < x - R || hb.x0 > x + R) return;
      var dir = Math.abs(t.x - x) < 3 ? m.dir : (t.x > x ? 1 : -1);
      H.onHit(st, t, { dir: dir, wk: m.wk, x: t.x - dir * 6 * AS(), y: y, mul: m.mul });
      any = true;
    });
    if (any && M.hit.slowMs) H.slow(M.hit.slowMs);
  }
  // 바닥 표시(빨간 고리, 깜빡임) — 운석이 터질 범위
  function drawMeteorMarks(ctx, camX) {
    meteors.forEach(function (m) {
      if (m.boom) return;
      var R = m.M.r * m.area, bl = Math.floor(m.t / 80) % 2, x = m.x - camX, k = clamp(m.t / (m.M.markMs + m.M.fallMs), 0, 1);
      ctx.save();
      ctx.globalAlpha = (bl ? 0.8 : 0.55) * (0.6 + 0.4 * k);
      ctx.strokeStyle = bl ? '#ffd27a' : '#ff4a2a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, m.z, R, R * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.18 + 0.2 * k; ctx.fillStyle = '#ff5a1e';
      ctx.beginPath(); ctx.ellipse(x, m.z, R * k, R * 0.3 * k, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }
  // 떨어지는 운석: look.rock(화염구 그림, 크게·비스듬히) 또는 코드로 그린 불덩이 + 빛
  function drawMeteors(ctx, camX) {
    meteors.forEach(function (m) {
      if (m.boom || m.t < m.M.markMs || m.artOn) return;   // 우리 그림이 떨어지는 중이면 코드 운석은 안 그림
      var u = clamp((m.t - m.M.markMs) / m.M.fallMs, 0, 1), q = meteorPos(m, u), x = q.x - camX, S = m.M.size;
      var ang = Math.atan2(m.z + 40 * AS(), 120 * AS());   // 떨어지는 기울기
      var r = S * 1.6, g = ctx.createRadialGradient(x, q.y, 0, x, q.y, r);
      g.addColorStop(0, 'rgba(255,230,160,0.9)'); g.addColorStop(0.4, 'rgba(255,120,30,0.5)'); g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r, q.y - r, r * 2, r * 2); ctx.restore();
      var A = fxArt(lookOf(m.d).rock);
      ctx.save(); ctx.translate(snapPx(x), snapPx(q.y)); ctx.scale(m.dir, 1); ctx.rotate(ang);
      if (A) {   // 화염구 그림은 왼쪽이 머리(오른쪽으로 날아감) → 크게
        var im = A.fr[Math.floor(m.t * A.fps / 1000) % A.fr.length];
        ctx.scale(2.1, 2.1); Assets.blit(ctx, im, A.pivot.x, A.pivot.y);
      } else {
        ctx.fillStyle = '#4a2a1e'; ctx.beginPath(); ctx.arc(0, 0, S * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.arc(S * 0.12, -S * 0.1, S * 0.35, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });
  }
  // 느려진 적(얼음창): 발밑 얼음 빛 고리 + 몸 둘레 작은 얼음 조각이 반짝
  function drawSlowed(ctx, camX) {
    H.targets().forEach(function (e) {
      if (!e || !e.T || !(e.slowT > 0) || (e.alive && !e.alive())) return;
      var x = e.x - camX, r = e.T.radius * 1.4, a = Math.min(1, e.slowT / 400), t = performance.now() / 1000;
      ctx.save(); ctx.globalAlpha = 0.55 * a; ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#8fe0ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, e.y, r, r * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#dff8ff';
      for (var i = 0; i < 4; i++) {
        var an = t * 1.6 + i * Math.PI / 2, px = x + Math.cos(an) * r * 0.9, py = e.y - e.T.height * (0.35 + 0.3 * ((i % 2) ? 1 : 0)) + Math.sin(an * 2) * 3;
        ctx.globalAlpha = a * (0.5 + 0.5 * Math.sin(t * 6 + i));
        ctx.fillRect(px - 1, py - 1, 2.5, 2.5);
      }
      ctx.restore();
    });
  }

  // ========== 2차 기술 (2026-11-06, 형님 승인): 성검 낙뢰 · 순간이동 · 불기둥 + 늘 켜진 기술 투지 · 반격 · 마나 방패 · 원소 낙인 ==========
  // 효과는 전부 이 파일의 코드로 그림(남의 그림·코드 안 씀). 수치는 config SKILLS(holy·counterSlash / blink·pillar) · SKILL_TREE(passive)
  var TEST = { counter: null };   // 시험용: counter = true 면 반격 늘 나감(GAME.test 에서)

  // 그 직업 기술 책의 늘 켜진 기술 값: { v = 지금 Lv 값, P = config passive, lv } (안 열렸으면 null)
  function pasOf(p, id) {
    if (!p || !p.classKey) return null;
    var bk = bookOf(p.classKey), e = bk && bk.entry(id);
    if (!e || !e.passive || !e.passive.val || !(bk.learned ? bk.learned(id) : bk.unlocked(id))) return null;   // 2026-11-07: 배운 것만
    var lv = bk.lv(id);
    return { v: e.passive.val[lv - 1] || 0, P: e.passive, lv: lv };
  }

  // ---- 순간이동 ----
  // at 에 사라짐(그 자리 작은 보라 폭발) → hideMs 동안 안 보임 → s.mv 쪽으로 dist(Lv5 더 멀리) 떨어진 곳에 나타남
  function blinkStep(p, d, s, t0, t1) {
    var B = d.blink, k = (s.L.lv5 && s.L.lv5.dist) || 1;
    if (t0 <= 0) {   // 모이는 빛
      glow(p.x, p.y - 55, 30 * AS() / 0.55, '#c890ff', 180, 0.6);
      debris(p.x, p.y - 40 * AS(), p.y, 8, { cols: ['#ffffff', '#e8d0ff', '#8ff0ff'], glow: true, sp: 90, size: 1.3, ms: 260, g: -120, spread: 1.6 });
    }
    if (s.bk === 0 && t1 >= B.at) {
      s.bk = 1;
      snd('blink');
      addGhost(p, { color: '#c890ff', lifeMs: 300, alpha: 0.55 });   // 사라지는 자리에 보라 잔상
      blinkBurst(p, d, s, p.x, p.y);
      p.x += s.mv * B.dist * k;   // 판 끝·벽은 main.js 의 p.clamp 가 막음
    }
    if (s.bk === 1 && t1 >= B.at + B.hideMs) {
      s.bk = 2;
      glow(p.x, p.y - 55, 40 * AS() / 0.55, '#e8d0ff', 240, 0.75);
      wave(p.x, p.y, 44 * AS() / 0.55 * s.area, { flat: 0.3, w: 3, ms: 300, color: '#f4e8ff', glow: '#9a5aff', ground: true });
      debris(p.x, p.y - 70 * AS(), p.y, 10, { cols: ['#ffffff', '#d8b0ff', '#8ff0ff'], glow: true, sp: 70, size: 1.4, ms: 360, g: 160, spread: 1.4 });
      if (s.L.lv5 && s.L.lv5.both) blinkBurst(p, d, s, p.x, p.y);   // Lv5: 나타나는 자리도 폭발
    }
  }
  // 작은 보라 폭발: 둘레 R 안의 적을 바깥으로 밀어냄
  function blinkBurst(p, d, s, x, z) {
    var B = d.blink, R = B.r * s.area, y = z - 55;
    FX.shake(CFG.juice.shakePx * 1.1, CFG.juice.shakeMs);
    glow(x, y, R * 1.2, '#b46aff', 260, 0.8);
    glow(x, y, R * 0.5, '#ffffff', 140, 0.4);
    wave(x, y, R * 1.1, { flat: 0.8, w: 3, ms: 260, color: '#f0e0ff', glow: '#8a4aff' });
    wave(x, z, R * 1.5, { flat: 0.3, w: 3, ms: 320, color: '#e0c8ff', glow: '#6a3ad8', ground: true });
    debris(x, y, z, 14, { cols: ['#ffffff', '#d8b0ff', '#b46aff', '#8ff0ff'], glow: true, sp: 200, size: 1.6, ms: 380, spread: 2.4 });
    var st = stOf(B.hit, d), any = false;
    H.targets().forEach(function (t) {
      if (!t || !H.canHit(t, B.hit)) return;
      var hb = t.hurtbox();
      if (Math.abs(hb.z - z) > B.depth * s.area) return;
      if (hb.x1 < x - R || hb.x0 > x + R) return;
      var dir = Math.abs(t.x - x) < 3 ? s.dir : (t.x > x ? 1 : -1);
      H.onHit(st, t, { dir: dir, wk: p.weaponKey, x: t.x - dir * 6 * AS(), y: y, mul: s.mul });
      any = true;
    });
    if (any) impact(B.hit);
  }
  // 순간이동 중 안 보이는 때(entities.js Player.draw 가 물어봄)
  function hidden(p) { var s = p && p.state === 'skill' && p.sk; return !!(s && s.d.blink && s.bk === 1); }

  // ---- 불기둥 ----
  // 마법진 장에 자리 정함(앞쪽 가까운 적 발밑, 없으면 앞 x) → 솟기 lockMs 전까지 따라감 → burstAt 에 솟음(각성 마력 폭주 = 다른 적에게 하나 더)
  function flameMark(p, d, s, t) {
    var F = d.flame;
    function find(px, pz, dir, skip) {
      var tgt = null, best = 1e9;
      H.targets().forEach(function (e) {
        if (!e || e.isProp || !e.T || e === skip || (e.alive && !e.alive()) || !H.canHit(e, F.hit)) return;
        var dx = (e.x - px) * dir;
        if (dx < -6 * AS() || dx > F.aim.range || Math.abs(e.y - pz) > F.aim.depth) return;
        var dd = Math.abs(dx) + Math.abs(e.y - pz) * 0.5;
        if (dd < best) { best = dd; tgt = e; }
      });
      return tgt;
    }
    if (!s.fl && t >= F.at) { var g0 = find(p.x, p.y, p.dir, null); s.fl = { x: g0 ? g0.x : p.x + p.dir * F.x, z: g0 ? g0.y : p.y, tgt: g0, t0: t }; }
    if (!s.fl || s.flDone) return;
    var g = s.fl.tgt;
    if (g && t < F.burstAt - (F.lockMs || 90) && (!g.alive || g.alive())) { s.fl.x = g.x; s.fl.z = g.y; }
    if (t < F.burstAt) return;
    s.flDone = true;
    flameBurst(p, d, s, s.fl.x, s.fl.z);
    if (s.echo) {
      var x0 = s.fl.x, z0 = s.fl.z, first = s.fl.tgt, dir = p.dir, px = p.x, pz = p.y;
      echo(d, function () { var e2 = find(px, pz, dir, first); flameBurst(p, d, s, e2 ? e2.x : x0 + dir * 60 * AS(), e2 ? e2.y : z0); });
    }
  }
  function flameBurst(p, d, s, x, z) {
    snd('firePillar');
    var F = d.flame, f = { x: x, z: z, F: F, d: d, t: 0, life: F.ms, k: s.area, R: F.r * s.area, wk: p.weaponKey, mul: s.mul, dir: s.dir,
                           ticks: 0, emberT: 0, lv: curLv };
    flames.push(f);
    H.hitstop(60);
    FX.shake(CFG.juice.shakePx * 2.2, CFG.juice.shakeMs * 1.5);
    H.dust(x - 14 * AS(), z, -1); H.dust(x + 14 * AS(), z, 1);
    glow(x, z - 40 * AS(), f.R * 2.2, '#ffb050', 360, 0.9);
    glow(x, z - 10 * AS(), f.R * 1.2, '#fff2c0', 200, 0.8);
    wave(x, z, f.R * 2.4, { flat: 0.3, w: 4, ms: 380, color: '#ffe0a0', glow: '#ff5a10', ground: true });
    debris(x, z - 10 * AS(), z, 18, { cols: ['#fff4d0', '#ffd27a', '#ff8a2a', '#ff5a1e'], glow: true, sp: 280, size: 1.8, ms: 520, spread: 0.55 });
    debris(x, z - 4 * AS(), z, 8, { cols: ['#3a2a20', '#5a3e2a', '#2a2020'], sp: 180, size: 2.4, ms: 700, spread: 0.9 });
    flameHit(f, F.hit, true);
  }
  // 기둥 둘레(R) · 위아래(depth) 안의 적 모두
  function flameHit(f, h, big) {
    var st = stOf(h, f.d), any = false;
    H.targets().forEach(function (t) {
      if (!t || !H.canHit(t, h)) return;
      var hb = t.hurtbox();
      if (Math.abs(hb.z - f.z) > f.F.depth * f.k) return;
      if (hb.x1 < f.x - f.R || hb.x0 > f.x + f.R) return;
      var dir = Math.abs(t.x - f.x) < 3 ? f.dir : (t.x > f.x ? 1 : -1);
      H.onHit(st, t, { dir: dir, wk: f.wk, x: f.x, y: Math.max(t.hurtbox().y0 + 6, f.z - 46 * AS()), mul: f.mul });
      any = true;
    });
    if (any && big) impact(h);
  }
  function flameStep(dt) {
    for (var i = flames.length - 1; i >= 0; i--) {
      var f = flames[i], F = f.F;
      f.t += dt;
      atLv(f.lv, function () {
        while (f.ticks < F.ticks && f.t >= F.tickMs * (f.ticks + 1) && f.t < f.life) {
          f.ticks++;
          flameHit(f, F.tick, false);
          glow(f.x, f.z - 50 * AS(), f.R * 1.3, '#ff9a3a', 180, 0.45);
        }
        f.emberT -= dt;
        if (f.emberT <= 0 && f.t < f.life * 0.85) {   // 위로 날리는 불티
          f.emberT = 45;
          debris(f.x + (Math.random() * 2 - 1) * f.R * 0.6, f.z - Math.random() * F.h * f.k * 0.7 * AS(), f.z, 2,
                 { cols: ['#fff4d0', '#ffd27a', '#ff8a2a'], glow: true, sp: 70, size: 1.4, ms: 420, g: -260, spread: 0.5 });
        }
      });
      if (f.t >= f.life) flames.splice(i, 1);
    }
  }
  // 불기둥 그림(코드): 바닥 불빛 + 위로 갈수록 가늘어지며 흔들리는 불덩이 겹 + 흰 심. 솟음(120ms) → 타오름 → 사그라듦(마지막 25%)
  function drawFlame(ctx, camX, f) {
    var F = f.F, u = f.t / f.life, rise = ease(clamp(f.t / 120, 0, 1)), fade = u > 0.75 ? (1 - u) / 0.25 : 1;
    var Hh = F.h * f.k * AS() * rise * (0.75 + 0.25 * fade), W = f.R * 1.2, x = f.x - camX, z = f.z, now = performance.now() / 1000;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    // 바닥 불빛(납작)
    ctx.save(); ctx.translate(x, z); ctx.scale(1, 0.3);
    var g0 = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 2);
    g0.addColorStop(0, 'rgba(255,220,140,' + (0.8 * fade).toFixed(3) + ')'); g0.addColorStop(0.5, 'rgba(255,110,30,' + (0.4 * fade).toFixed(3) + ')'); g0.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = g0; ctx.fillRect(-W * 2, -W * 2, W * 4, W * 4); ctx.restore();
    var N = 14;
    for (var pass = 0; pass < 2; pass++) {   // 0 = 바깥 주황 불, 1 = 안쪽 노랑·흰 심
      for (var i = 0; i <= N; i++) {
        var v = i / N, y = z - Hh * v, wob = Math.sin(now * 11 + i * 1.7 + f.x) * 0.5 + 0.5;
        var w = W * (pass ? 0.42 : 0.95) * (1 - 0.6 * v) * (0.8 + 0.3 * wob), xo = Math.sin(now * 8 + i * 0.9 + f.z) * W * 0.22 * v;
        var a = fade * (pass ? 0.6 : 0.55) * (1 - 0.45 * v);
        ctx.save(); ctx.translate(x + xo, y); ctx.scale(1, 1.5);
        var g = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
        if (pass) { g.addColorStop(0, 'rgba(255,255,235,' + a.toFixed(3) + ')'); g.addColorStop(0.5, 'rgba(255,220,120,' + (a * 0.6).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,160,40,0)'); }
        else { g.addColorStop(0, 'rgba(255,170,60,' + a.toFixed(3) + ')'); g.addColorStop(0.55, 'rgba(255,90,20,' + (a * 0.55).toFixed(3) + ')'); g.addColorStop(1, 'rgba(200,30,0,0)'); }
        ctx.fillStyle = g; ctx.fillRect(-w, -w, w * 2, w * 2); ctx.restore();
      }
    }
    // 가운데 밝은 심(아래 굵고 위로 가늘게, 흔들림)
    var cw = W * 0.32 * (0.85 + 0.15 * Math.sin(now * 17)), cg = ctx.createLinearGradient(0, z - Hh, 0, z);
    cg.addColorStop(0, 'rgba(255,200,90,0)'); cg.addColorStop(0.35, 'rgba(255,236,170,' + (0.55 * fade).toFixed(3) + ')'); cg.addColorStop(1, 'rgba(255,255,230,' + (0.85 * fade).toFixed(3) + ')');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(x - cw, z); ctx.quadraticCurveTo(x - cw * 0.6, z - Hh * 0.5, x + Math.sin(now * 9) * W * 0.15, z - Hh * 0.95);
    ctx.quadraticCurveTo(x + cw * 0.6, z - Hh * 0.5, x + cw, z); ctx.closePath(); ctx.fill();
    // 꼭대기 불꽃 혀(깜빡이며 위로 갈라짐)
    ctx.strokeStyle = '#ff9a3a'; ctx.lineCap = 'round';
    for (var j = 0; j < 4; j++) {
      var ph = now * 7 + j * 2.1, tx = x + Math.sin(ph) * W * 0.5, ty = z - Hh * (0.92 + 0.12 * Math.sin(ph * 1.3));
      ctx.globalAlpha = fade * (0.25 + 0.2 * Math.sin(ph * 2)); ctx.lineWidth = Math.max(1, W * 0.12);
      ctx.beginPath(); ctx.moveTo(tx, ty + Hh * 0.18); ctx.quadraticCurveTo(tx + Math.sin(ph * 1.7) * W * 0.4, ty + Hh * 0.05, tx + Math.sin(ph) * W * 0.25, ty - Hh * 0.06); ctx.stroke();
    }
    ctx.restore();
  }
  // 불기둥 마법진(바닥): 자리 정한 뒤 ~ 솟을 때까지 주황 고리 + 도는 룬 눈금
  function drawFlameMark(ctx, camX, p) {
    var s = p && p.state === 'skill' && p.sk, d = s && s.d;
    if (!d || !d.flame || !s.fl || s.flDone) return;
    var t = s.t - s.fl.t0, k = ease(clamp(t / 140, 0, 1)), R = d.flame.r * 1.3 * s.area * k, x = s.fl.x - camX, z = s.fl.z, bl = Math.floor(t / 70) % 2;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.85; ctx.strokeStyle = bl ? '#ffd27a' : '#ff6a20'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x, z, R, R * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, z, R * 0.7, R * 0.21, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffb040';
    for (var i = 0; i < 8; i++) {   // 도는 룬 눈금
      var an = t / 300 + i * Math.PI / 4;
      ctx.fillRect(x + Math.cos(an) * R * 0.85 - 1, z + Math.sin(an) * R * 0.85 * 0.3 - 1, 2.5, 2);
    }
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#ff5a1e';
    ctx.beginPath(); ctx.ellipse(x, z, R, R * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ---- 칼날 폭풍 회오리 (2026-11-07) ----
  // 색 = 무기 첫 속성(config enchant.el col · col2), 없으면 tornado.color + 흰색
  function tornadoCols(p, T) {
    var w = window.Growth && Growth.weapon ? Growth.weapon(p.classKey) : null, e = w && w.els()[0], EL = e && CFG.enchant && CFG.enchant.el[e];
    return EL ? [EL.col, EL.col2] : [T.color || '#cfe8ff', '#ffffff'];
  }
  function castTornado(p, d, s) {
    var T = d.tornado, lv = s.L.lv || 1, c = tornadoCols(p, T);
    tornados.push({ x: p.x + p.dir * T.x, z: p.y, dir: p.dir, t: 0, life: T.ms * (1 + (T.msPerLv || 0) * (lv - 1)), next: T.firstMs || 120,
                    k: s.area, mul: s.mul, wk: p.weaponKey, d: d, T: T, lv: curLv, col: c[0], col2: c[1], burst: false, seed: Math.random() * 6.28 });
    glow(p.x + p.dir * T.x, p.y - 50 * AS(), T.r * s.area, c[1], 220, 0.6);
  }
  function tornadoStep(dt) {
    for (var i = tornados.length - 1; i >= 0; i--) {
      var o = tornados[i], T = o.T;
      o.t += dt;
      if (!o.burst) {
        o.x += o.dir * T.speed * dt / 1000;
        tornadoPull(o, dt);
        while (o.t >= o.next && o.next < o.life) { (function (o) { atLv(o.lv, function () { tornadoHit(o, false); }); })(o); o.next += T.tickMs; }
        if (o.t >= o.life) { o.burst = true; o.bt = 0; atLv(o.lv, function () { tornadoHit(o, true); }); }
      } else { o.bt += dt; if (o.bt > 260) tornados.splice(i, 1); }
    }
  }
  // 끌어당김: 둘레 pullR 안의 잡몹(보스 · 중간보스 · 소품 빼고)을 회오리 가운데로 조금씩
  function tornadoPull(o, dt) {
    var T = o.T, R = T.pullR * o.k, v = T.pull * dt / 1000;
    H.targets().forEach(function (t) {
      if (!t || t.isProp || !t.T || t.T.boss || t.mid || (t.alive && !t.alive())) return;
      var dx = o.x - t.x, dz = o.z - t.y;
      if (Math.abs(dx) > R || Math.abs(dz) > T.depth * 2 * o.k) return;
      if (Math.abs(dx) > 4) t.x += Math.sign(dx) * Math.min(Math.abs(dx) - 4, v);
      if (Math.abs(dz) > 3) t.y += Math.sign(dz) * Math.min(Math.abs(dz) - 3, v * 0.4);
    });
  }
  // 벰(last = 끝 터짐: 더 넓게 · 크게 띄움 + 빛 · 고리 · 흔들림)
  function tornadoHit(o, last) {
    var T = o.T, h = last ? T.last : T.hit, R = T.r * o.k * (last ? 1.5 : 1), st = stOf(h, o.d), any = false;
    H.targets().forEach(function (t) {
      if (!t || !H.canHit(t, h)) return;
      var hb = t.hurtbox();
      if (Math.abs(hb.z - o.z) > T.depth * o.k * (last ? 1.3 : 1)) return;
      if (o.x < hb.x0 - R || o.x > hb.x1 + R) return;
      var dir = last ? (t.x >= o.x ? 1 : -1) : (t.x > o.x ? -1 : 1);   // 벨 때 = 가운데로, 터질 때 = 바깥으로
      H.onHit(st, t, { dir: dir, wk: o.wk, x: t.x, y: t.y - 50 * AS(), mul: o.mul });
      if (!last) debris(t.x, t.y - 40 * AS(), t.y, 3, { cols: ['#ffffff', o.col2, o.col], glow: true, sp: 150, size: 1.2, ms: 220 });
      any = true;
    });
    if (!last) return;
    snd('skSlam');
    H.hitstop(70);
    FX.shake(CFG.juice.shakePx * 2.4, CFG.juice.shakeMs * 1.6);
    glow(o.x, o.z - 60 * AS(), R * 1.3, o.col2, 360, 0.85);
    wave(o.x, o.z, R * 1.6, { flat: 0.3, w: 5, ms: 420, color: '#ffffff', glow: o.col, ground: true });
    wave(o.x, o.z - 60 * AS(), R * 1.1, { flat: 0.8, w: 4, ms: 320, color: o.col2, glow: o.col });
    debris(o.x, o.z - 50 * AS(), o.z, 22, { cols: ['#ffffff', o.col2, o.col], glow: true, sp: 280, size: 1.8, ms: 520, spread: 1.6 });
    H.dust(o.x - 14 * AS(), o.z, -1); H.dust(o.x + 14 * AS(), o.z, 1);
    if (h.flash) doFlash(h.flash);
    if (any && h.slowMs) H.slow(h.slowMs);
  }
  // 회오리 그림(코드): 아래 좁고 위 넓은 깔때기 = 높이마다 돌아가는 칼날 줄(초승달 호) 여러 겹 + 바닥 고리 + 가운데 빛. 처음 · 끝은 커졌다 작아짐
  function drawTornado(ctx, camX, o) {
    var T = o.T, x = o.x - camX, z = o.z, k = o.k;
    var grow = o.burst ? 1 + o.bt / 160 : Math.min(1, o.t / 180), fade = o.burst ? Math.max(0, 1 - o.bt / 260) : Math.min(1, (o.life - o.t) / 200 + 0.6);
    var H0 = T.h * k * grow, r0 = T.r * k * 0.35 * grow, r1 = T.r * k * 1.05 * grow, spin = o.t / 1000 * 13 + o.seed, n = 9;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9 * fade; ctx.lineCap = 'round';
    var g = ctx.createRadialGradient(x, z - H0 * 0.45, 0, x, z - H0 * 0.45, r1);
    g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r1, z - H0 - 6, r1 * 2, H0 + 12);
    ctx.strokeStyle = o.col; ctx.lineWidth = 2 * AS(); ctx.beginPath(); ctx.ellipse(x, z, r1 * 0.75, r1 * 0.2, 0, 0, Math.PI * 2); ctx.stroke();
    for (var i = 0; i < n; i++) {
      var u = (i + 0.5) / n, hy = z - H0 * u, r = r0 + (r1 - r0) * u, a0 = spin * (1 + u * 0.4) + i * 2.1;
      [[o.col, 9, 0.85], [o.col2, 3, 0.6], ['#ffffff', 1.2, 0.8]].forEach(function (L, j) {
        ctx.globalCompositeOperation = j ? 'lighter' : 'source-over';   // 굵은 바깥 줄은 그냥 칠함(밝은 하늘에서도 보이게), 안쪽 빛 줄은 더하기
        ctx.globalAlpha = L[2] * fade; ctx.strokeStyle = L[0]; ctx.lineWidth = L[1] * AS();
        ctx.beginPath(); ctx.ellipse(x, hy, r, r * 0.26, 0, a0, a0 + 1.5); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(x, hy, r, r * 0.26, 0, a0 + Math.PI, a0 + Math.PI + 1.1); ctx.stroke();
      });
    }
    ctx.restore();
  }

  // ---- 성검 낙뢰 ----
  // 앞쪽 적(가까운 순, 모자라면 다시 처음부터 = 같은 적에게 또, 조금 비켜서)에게 칼 하나씩. 적이 없으면 앞 고정 자리
  function castBlades(p, d, s) {
    var K = d.blades, n = (s.L.lv5 && s.L.lv5.blades) || K.n, list = [];
    H.targets().forEach(function (t) {
      if (!t || t.isProp || !t.T || (t.alive && !t.alive()) || !H.canHit(t, K.hits[0])) return;
      var dx = (t.x - p.x) * p.dir;
      if (dx < -10 * AS() || dx > K.aim.range || Math.abs(t.y - p.y) > K.aim.depth) return;
      list.push({ t: t, d: Math.abs(dx) + Math.abs(t.y - p.y) * 0.5 });
    });
    list.sort(function (a, b) { return a.d - b.d; });
    var lastX = K.x[K.x.length - 1];
    for (var k = 0; k < n; k++) {
      var e = list.length ? list[k % list.length].t : null, rep = list.length ? Math.floor(k / list.length) : 0;
      var jit = rep ? (rep % 2 ? -1 : 1) * 16 * AS() * Math.ceil(rep / 2) : 0;
      var fx0 = k < K.x.length ? K.x[k] : lastX + (k - K.x.length + 1) * 50;
      blades.push({ x: e ? e.x + jit : p.x + p.dir * fx0, z: e ? e.y : p.y, tgt: e, jit: jit, t: -k * K.gapMs, K: K, d: d,
                    h: k === n - 1 ? K.hits[K.hits.length - 1] : K.hits[Math.min(k, K.hits.length - 2)], last: k === n - 1,
                    wk: p.weaponKey, mul: s.mul, dir: p.dir, k: s.area, lv: curLv, landed: false, seed: Math.random() * 1000 });
    }
  }
  function bladeStep(dt) {
    for (var i = blades.length - 1; i >= 0; i--) {
      var b = blades[i], K = b.K;
      b.t += dt;
      if (b.t < 0) continue;
      var g = b.tgt;
      if (!b.landed && b.t < K.fallMs - (K.lockMs || 60) && g && (!g.alive || g.alive())) { b.x = g.x + b.jit; b.z = g.y; }
      if (!b.landed && b.t >= K.fallMs) { b.landed = true; atLv(b.lv, function () { bladeLand(b); }); }
      if (b.t >= K.fallMs + K.stayMs) blades.splice(i, 1);
    }
  }
  // 칼이 땅에 꽂힘: 금빛 땅 충격파 + 빛 + 금 불티·돌 + 둘레 적 데미지(마지막 칼 = 크게)
  function bladeLand(b) {
    snd('holyBolt');
    var K = b.K, R = K.r * b.k, x = b.x, z = b.z, big = b.last;
    H.dust(x - 10 * AS(), z, -1); H.dust(x + 10 * AS(), z, 1);
    FX.shake(CFG.juice.shakePx * (b.h.shake || 1.5), CFG.juice.shakeMs * (big ? 1.8 : 1));
    if (big) H.hitstop(80);
    glow(x, z - 30 * AS(), R * (big ? 3.2 : 2), '#ffe9a0', big ? 420 : 260, 0.9);
    glow(x, z - 60 * AS(), R * 1.2, '#ffffff', 160, 0.6);
    wave(x, z, R * (big ? 4.2 : 2.6), { flat: 0.3, w: big ? 5 : 3, ms: big ? 460 : 320, color: '#fff6c8', glow: '#ffc030', ground: true });
    if (big) wave(x, z - 40 * AS(), R * 2.4, { flat: 0.8, w: 4, ms: 360, color: '#ffffff', glow: '#ffd23f' });
    debris(x, z - 6 * AS(), z, big ? 22 : 10, { cols: ['#ffffff', '#fff6c8', '#ffd23f', '#8ff0ff'], glow: true, sp: big ? 260 : 190, size: 1.6, ms: 460, spread: 1.4 });
    debris(x, z - 2 * AS(), z, big ? 10 : 5, { cols: ['#6a5a4a', '#8a7258', '#4a3e32'], sp: 170, size: 2.4, ms: 700 });
    if (b.h.flash) doFlash(b.h.flash);
    var st = stOf(b.h, b.d), any = false;
    H.targets().forEach(function (t) {
      if (!t || !H.canHit(t, b.h)) return;
      var hb = t.hurtbox();
      if (Math.abs(hb.z - z) > K.depth * b.k * (big ? 1.4 : 1)) return;
      var RR = big ? R * 2.2 : R;
      if (x < hb.x0 - RR || x > hb.x1 + RR) return;
      var dir = Math.abs(t.x - x) < 3 ? b.dir : (t.x > x ? 1 : -1);
      H.onHit(st, t, { dir: dir, wk: b.wk, x: x, y: t.y - 44 * AS(), mul: b.mul });
      any = true;
    });
    if (any && b.h.slowMs) H.slow(b.h.slowMs);
  }
  // 번개 칼 그림(코드): 떨어지는 동안 = 하늘에서 내려오는 금빛 꼬리 + 둘레 번개 / 꽂힘 = 칼날 반쯤 땅에 + 번개 튐 → 사라짐
  function drawBlade(ctx, camX, b) {
    var K = b.K;
    if (b.t < 0) return;
    var S = b.k * AS() / 0.55, L = 70 * S, w = 8 * S, x = b.x - camX, fu = clamp(b.t / K.fallMs, 0, 1);
    var tipY = b.z + 5 * S - (b.landed ? 0 : (1 - fu) * (b.z + L));
    var after = b.t - K.fallMs, a = b.landed && after > K.stayMs - 200 ? Math.max(0, (K.stayMs - after) / 200) : 1;
    ctx.save();
    // 떨어지는 꼬리(하늘 → 칼)
    if (!b.landed || after < 120) {
      var ta = b.landed ? 1 - after / 120 : 1;
      ctx.globalCompositeOperation = 'lighter';
      var lg = ctx.createLinearGradient(x - w * 1.4, 0, x + w * 1.4, 0);
      lg.addColorStop(0, 'rgba(255,220,120,0)'); lg.addColorStop(0.5, 'rgba(255,248,210,' + (0.75 * ta).toFixed(3) + ')'); lg.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = lg; ctx.fillRect(x - w * 1.4, -10, w * 2.8, tipY - L + 10);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = a;
    // 칼 둘레 빛
    ctx.globalCompositeOperation = 'lighter';
    var gg = ctx.createRadialGradient(x, tipY - L * 0.55, 0, x, tipY - L * 0.55, L * 0.75);
    gg.addColorStop(0, 'rgba(255,246,200,0.55)'); gg.addColorStop(1, 'rgba(255,200,60,0)');
    ctx.fillStyle = gg; ctx.fillRect(x - L, tipY - L * 1.3, L * 2, L * 1.5);
    ctx.globalCompositeOperation = 'source-over';
    if (b.landed) {   // 꽂힌 자리 그늘
      ctx.fillStyle = 'rgba(30,20,10,0.45)'; ctx.beginPath(); ctx.ellipse(x, b.z, w * 1.4, w * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.translate(x, tipY);
    // 칼날(끝이 아래)
    var bg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    bg.addColorStop(0, '#e8d080'); bg.addColorStop(0.45, '#ffffff'); bg.addColorStop(1, '#fff2b0');
    ctx.fillStyle = bg; ctx.strokeStyle = '#7a5410'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-w / 2, -L * 0.2); ctx.lineTo(-w / 2, -L); ctx.lineTo(w / 2, -L); ctx.lineTo(w / 2, -L * 0.2); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-0.6 * S, -L * 0.95, 1.2 * S, L * 0.75);
    // 날밑·보석·손잡이·머리
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(-w * 1.8, -L - 4 * S, w * 3.6, 4 * S); ctx.strokeRect(-w * 1.8, -L - 4 * S, w * 3.6, 4 * S);
    ctx.fillStyle = '#8ff0ff'; ctx.fillRect(-1.5 * S, -L - 3.5 * S, 3 * S, 3 * S);
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-1.6 * S, -L - 16 * S, 3.2 * S, 12 * S);
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(0, -L - 17.5 * S, 2.6 * S, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // 번개(떨어지는 동안 + 꽂힌 직후 220ms): 칼 둘레 지그재그
    if (!b.landed || after < 220) {
      var seed = b.seed + Math.floor(b.t / 50) * 7.3;
      var rnd = function (i) { var v = Math.sin(seed + i * 91.3) * 43758.5453; return v - Math.floor(v); };
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (var j = 0; j < 3; j++) {
        ctx.strokeStyle = j ? '#bff8ff' : '#ffffff'; ctx.lineWidth = j ? 1.2 : 1.8; ctx.globalAlpha = a * (j ? 0.7 : 0.9);
        ctx.beginPath(); var sx0 = (rnd(j) * 2 - 1) * w, sy0 = -L * (0.3 + rnd(j + 9) * 0.6); ctx.moveTo(sx0, sy0);
        for (var q = 1; q <= 4; q++) ctx.lineTo(sx0 + (rnd(j * 10 + q) * 2 - 1) * w * 2.2, sy0 + (b.landed ? q * 4 * S : -q * 7 * S));
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  // 칼끝 → 하늘 금빛 줄기(칼을 든 동안)
  function drawBeams(ctx, camX) {
    beams.forEach(function (bm) {
      var p = bm.p, u = bm.t / bm.life, a = (u < 0.1 ? u / 0.1 : u > 0.7 ? (1 - u) / 0.3 : 1);
      if (p.state !== 'skill' || !p.sk || !p.sk.d.blades) a *= Math.max(0, 1 - (bm.t % 1000) / 150);   // 기술이 끊기면 빨리 사라짐
      var x = p.x + p.dir * bm.ox - camX, y = p.y + bm.oy - (p.z || 0), w = 5 * bm.k * (1 + 0.15 * Math.sin(bm.t / 40));
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var g = ctx.createLinearGradient(x - w * 2, 0, x + w * 2, 0);
      g.addColorStop(0, 'rgba(255,220,120,0)'); g.addColorStop(0.5, 'rgba(255,250,220,' + (0.85 * a).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = g; ctx.fillRect(x - w * 2, -10, w * 4, y + 10);
      var r = 16 * bm.k, rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(255,255,255,' + (0.9 * a).toFixed(3) + ')'); rg.addColorStop(1, 'rgba(255,210,80,0)');
      ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.restore();
    });
  }
  // 코드 초승달 베기(반격): 활 모양이 아래→위로 휘두르며 사라짐
  function drawArcs(ctx, camX) {
    arcs.forEach(function (c) {
      var u = c.t / c.life, sw = -1.3 + 2.0 * ease(Math.min(1, u * 1.6));
      ctx.save(); ctx.translate(c.x - camX, c.y); ctx.scale(c.dir, 1); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      [[c.color, 7, 0.45], ['#fff6d0', 3.5, 0.85], ['#ffffff', 1.5, 1]].forEach(function (L) {
        ctx.globalAlpha = L[2] * (1 - u); ctx.strokeStyle = L[0]; ctx.lineWidth = L[1];
        ctx.beginPath(); ctx.arc(-c.r * 0.45, 0, c.r, Math.max(-1.3, sw - 1.1), sw); ctx.stroke();
      });
      ctx.restore();
    });
  }

  // ---- 늘 켜진 기술 ----
  // 투지: 체력이 from 밑으로 줄수록 물리 공격 +, full 이하에서 val(최대). main.js onHit 가 물리 공격에 더함
  function gritBonus(p) {
    var q = pasOf(p, 'grit');
    if (!q || !(p.maxHp > 0) || p.state === 'dead') return 0;
    return q.v * clamp((q.P.from - p.hp / p.maxHp) / (q.P.from - q.P.full), 0, 1);
  }
  function gritK(p) { var q = pasOf(p, 'grit'); return q && q.v ? gritBonus(p) / q.v : 0; }
  // 반격: 맞은 뒤(main.js onPlayerHit, 움찔 상태일 때만 = 넘어지는 큰 타·각성 슈퍼아머 빼고) 가까운 적이면 확률로 되받아 베기
  function tryCounter(p, e) {
    var q = pasOf(p, 'counter');
    if (!q || p.state !== 'hurt' || !e || !e.T || !e.alive || !e.alive()) return false;
    if (Math.abs(e.x - p.x) > q.P.reach * AS() || Math.abs(e.y - p.y) > 40 * AS()) return false;   // 원래 크기 도트 x actorScale
    var d = defFor(p, 'counterSlash');
    if (!d || (p.skillCd[d.key] || 0) > 0) return false;
    if (!(TEST.counter != null ? TEST.counter : Math.random() < q.v)) return false;
    p.dir = e.x >= p.x ? 1 : -1; p.invulnT = 0;   // 맞은 뒤 깜빡임 끔(기술 무적이 대신 지킴 → 베는 모습이 보이게)
    start(p, { d: d, L: lvStat(d, q.lv) });
    return true;
  }
  // 마나 방패: 받는 피해 n 중 마나가 대신 받을 몫(마나가 모자라면 있는 만큼, 체력은 1 이상 깎임). 없으면 0
  function shieldSplit(p, n) {
    var q = pasOf(p, 'shield');
    if (!q || n <= 1) return 0;
    return Math.max(0, Math.min(Math.floor(p.mp || 0), Math.round(n * q.v), n - 1));
  }
  // 실제로 맞았을 때(main.js): 마나를 깎고 파란 방패 번쩍 + 「MP -n」
  function shieldHit(p, a) {
    if (!(a > 0)) return;
    p.mp = Math.max(0, (p.mp || 0) - a);
    shieldFx = { p: p, t: 0, life: 360 };
    glow(p.x, p.y - 44 * AS(), 40 * AS() / 0.55, '#7fc8ff', 260, 0.6);
    debris(p.x, p.y - 50 * AS(), p.y, 8, { cols: ['#ffffff', '#bfe4ff', '#5ab0ff'], glow: true, sp: 130, size: 1.3, ms: 320, spread: 2.6 });
    FX.damage(p.x, p.y - (p.z || 0) - 128 * AS(), 'MP -' + a, false, CFG.juice, null, 'shield', 'player:shield', true);
  }
  // 원소 낙인: 낙인 찍힌 적이 받는 데미지 배율(main.js onHit) / 기술 마법에 맞으면 낙인(ms)
  function brandMul(p, t) {
    if (!t || !(t.brandT > 0)) return 1;
    var q = pasOf(p, 'brand');
    return q ? 1 + q.v : 1;
  }
  function brandMark(p, t, st) {
    if (!st || !st.damageStyle || !t || t.isProp || !t.T || (t.alive && !t.alive())) return;
    var q = pasOf(p, 'brand');
    if (!q) return;
    if (!(t.brandT > 0)) glow(t.x, t.y - t.T.height - 6 * AS(), 18 * AS() / 0.55, '#d8b0ff', 220, 0.8);   // 새로 찍힘: 머리 위 번쩍
    t.brandT = q.P.ms || 4000;
  }
  // 매 장면: 투지 불티·「투지!」, 마나 방패 번쩍 시간, 낙인 시간
  function passiveStep(dt) {
    var p = H.player && H.player();
    if (p) {
      var k = gritK(p);
      if (k >= 0.5 && !gritOn) {
        gritOn = true;
        FX.damage(p.x, p.y - (p.z || 0) - 124 * AS(), '투지!', false, CFG.juice, null, 'grit', 'player:grit');
        glow(p.x, p.y - 40 * AS(), 50 * AS() / 0.55, '#ff6a2a', 300, 0.7);
        wave(p.x, p.y, 50 * AS() / 0.55, { flat: 0.3, w: 3, ms: 340, color: '#ffb080', glow: '#ff3a1a', ground: true, noMax: true });
      } else if (k < 0.25) gritOn = false;
      gritT -= dt;
      if (k > 0.05 && gritT <= 0 && p.state !== 'dead') {   // 발밑에서 붉은 불티가 오름(기운이 셀수록 자주)
        gritT = 140 - 90 * k;
        debris(p.x + (Math.random() * 2 - 1) * 14 * AS() / 0.55, p.y - 2, p.y, k > 0.6 ? 2 : 1,
               { cols: ['#ff3a1a', '#ff8a3a', '#ffd27a'], glow: true, sp: 40, size: 1.4, ms: 520, g: -140, spread: 0.4 });
      }
    }
    if (shieldFx) { shieldFx.t += dt; if (shieldFx.t >= shieldFx.life) shieldFx = null; }
    H.targets().forEach(function (t) { if (t && t.brandT > 0) t.brandT -= dt; });
    [beams, arcs].forEach(function (L) { for (var i = L.length - 1; i >= 0; i--) { L[i].t += dt; if (L[i].t >= L[i].life) L.splice(i, 1); } });
  }
  // 투지 기운: 발밑 붉은 빛(숨쉬듯, 셀수록 크고 진하게)
  function drawGrit(ctx, camX, p) {
    var k = p && gritK(p);
    if (!k || k < 0.05 || p.state === 'dead') return;
    var x = p.x - camX, r = (22 + 10 * k) * AS() / 0.55 * (1 + 0.08 * Math.sin(performance.now() / 120));
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, p.y); ctx.scale(1, 0.32);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, 'rgba(255,120,60,' + (0.25 + 0.4 * k).toFixed(3) + ')'); g.addColorStop(0.6, 'rgba(255,40,10,' + (0.15 + 0.25 * k).toFixed(3) + ')'); g.addColorStop(1, 'rgba(160,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
  }
  // 마나 방패 번쩍: 몸 둘레 파란 육각 방패(벌집 줄)가 퍼지며 사라짐
  function drawShield(ctx, camX) {
    if (!shieldFx) return;
    var p = shieldFx.p, u = shieldFx.t / shieldFx.life, a = 1 - u, k = 1 + 0.15 * ease(u);
    var x = p.x - camX, y = p.y - (p.z || 0) - 52, rx = 30 * k, ry = 46 * k;   // 몸 가운데 둘레(원래 크기 도트)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(x, y, rx * 0.3, x, y, ry);
    g.addColorStop(0, 'rgba(90,170,255,0)'); g.addColorStop(0.8, 'rgba(110,190,255,' + (0.35 * a).toFixed(3) + ')'); g.addColorStop(1, 'rgba(60,120,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#bfe4ff'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.9 * a;
    ctx.beginPath();
    for (var i = 0; i <= 6; i++) { var an = i / 6 * Math.PI * 2 + Math.PI / 6, px = x + Math.cos(an) * rx, py = y + Math.sin(an) * ry; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.stroke();
    ctx.globalAlpha = 0.45 * a; ctx.lineWidth = 1;   // 안쪽 벌집 줄
    for (var j = 0; j < 3; j++) { var an2 = j / 3 * Math.PI + Math.PI / 6; ctx.beginPath(); ctx.moveTo(x - Math.cos(an2) * rx, y - Math.sin(an2) * ry); ctx.lineTo(x + Math.cos(an2) * rx, y + Math.sin(an2) * ry); ctx.stroke(); }
    ctx.restore();
  }
  // 낙인: 머리 위 돌아가는 마름모 문양 + 불·얼음·번개 세 점(끝나기 전 깜빡임)
  function drawBrands(ctx, camX) {
    var now = performance.now() / 1000;
    H.targets().forEach(function (e) {
      if (!e || !e.T || !(e.brandT > 0) || (e.alive && !e.alive())) return;
      if (e.brandT < 600 && Math.floor(e.brandT / 90) % 2) return;
      var x = Math.round(e.x - camX), y = Math.round(e.y - (e.flyZ ? e.flyZ() : 0) - e.T.height - 10 * AS() / 0.55), r = 6 * AS() / 0.55, sq = Math.abs(Math.cos(now * 2.4));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var g = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
      g.addColorStop(0, 'rgba(216,176,255,0.6)'); g.addColorStop(1, 'rgba(120,60,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#2a1048'; ctx.fillStyle = '#e8d0ff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.7 * sq + 1, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.7 * sq - 1, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      ['#ff8a2a', '#7fe0ff', '#fff27a'].forEach(function (c, i) {
        var an = now * 3 + i * Math.PI * 2 / 3;
        ctx.fillStyle = c; ctx.fillRect(Math.round(x + Math.cos(an) * r * 1.5) - 1, Math.round(y + Math.sin(an) * r * 0.5) - 1, 2.5, 2.5);
      });
      ctx.restore();
    });
  }

  // ---------- 매 장면 (효과들 시간 흐름) ----------
  function update(dt) {
    for (var ei = echoes.length - 1; ei >= 0; ei--) { var E = echoes[ei]; E.t -= dt; if (E.t <= 0) { echoes.splice(ei, 1); atLv(E.lv, E.fn); } }   // 각성: 한 번 더
    bladeStep(dt); flameStep(dt); passiveStep(dt); tornadoStep(dt);   // 2차 기술(2026-11-06)
    meteorStep(dt);
    [bolts, rings, ghosts, arts, waves, parts, glows, pillars].forEach(function (L) {
      for (var i = L.length - 1; i >= 0; i--) { L[i].t += dt; if (L[i].t >= L[i].life) L.splice(i, 1); }
    });
    var ds = dt / 1000;
    parts.forEach(function (q) {
      q.vy += q.g * ds; q.x += q.vx * ds; q.y += q.vy * ds; q.rot += q.vr * ds;
      if (q.y > q.floor) { q.y = q.floor; q.vy *= -0.3; q.vx *= 0.6; q.vr *= 0.5; }   // 땅에 떨어지면 살짝 튕김
    });
    arts.forEach(function (a) { if (!a.follow && a.vx) a.x += a.dir * a.vx * dt / 1000; });   // 앞으로 날아가는 베기 파동
    // 날아가는 화염구: 불씨를 흘림
    Projectiles.list.forEach(function (pr) {
      var S = pr.skill; if (!S || pr.dead || !S.c.emberMs) return;
      S.emberT -= dt;
      if (S.emberT <= 0) {
        S.emberT = S.c.emberMs;
        var M = CFG.magic.spark, fr = tintFx(M.frames, '#ff8a2a', 0.7);
        if (fr) FX.sprite(pr.x - pr.dir * 10 * AS(), pr.y + (Math.random() * 8 - 4) * AS(), fr, M.fps * 1.3, M.pivot, false, false, 0.6);
      }
    });
  }
  // 화면 번쩍은 진짜 시간으로 줄어든다(멈춤 중에도 보이고 사라지게)
  function tickReal(ms) {
    if (noMpT > 0) noMpT -= ms;
    if (flash) { flash.t += ms; if (flash.t >= flash.life) flash = null; }
  }

  // ---------- 그리기 ----------
  // 배경 위·캐릭터 아래: 기술 쓰는 동안 배경을 어둡게(캐릭터·적은 그대로 밝음)
  function drawBackdrop(ctx, W, Hh, p) {
    var s = p && p.state === 'skill' && p.sk, D = s && s.d.darken;
    if (!D) return;
    var k = s.t / D.ms;
    if (k >= 1) return;
    var a = D.alpha * (k < 0.12 ? k / 0.12 : k > 0.6 ? (1 - k) / 0.4 : 1);
    ctx.fillStyle = 'rgba(6,4,16,' + a.toFixed(3) + ')';
    ctx.fillRect(-8, -8, W + 16, Hh + 16);
  }
  // 바닥: 번개 떨어질 자리 표시(깜빡이는 타원)
  function drawUnder(ctx, camX, p) {
    waves.forEach(function (w) { if (w.ground) drawWave(ctx, camX, w); });
    drawMeteorMarks(ctx, camX);   // 메테오 떨어질 자리(2026-11-06)
    drawCircle(ctx, camX, p);     // 땅 융기 마법진(2026-11-06 밤)
    drawFlameMark(ctx, camX, p);  // 불기둥 마법진(2차)
    drawGrit(ctx, camX, p);       // 투지 발밑 붉은 기운(2차)
    var s = p && p.state === 'skill' && p.sk, K = s && (s.K || s.d.strikes);
    if (!K) return;
    K.at.forEach(function (at, k) {
      if (s.strikeDone[k] || s.t < at - (K.markMs || 200)) return;
      if (SM()) {   // 매끈한 화면: 깜빡이는 빛 타원 + 가운데 점
        var mx = s.sx[k] - camX, my = s.sz[k], mrx = K.r * 1.1 * (s.area || 1), mry = Math.max(2, K.depth * 0.4), bl = Math.floor(s.t / 60) % 2;
        ctx.save();
        ctx.globalAlpha = bl ? 0.75 : 0.5;
        ctx.strokeStyle = bl ? '#fff27a' : '#5ae6ff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(mx, my, mrx, mry, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.25; ctx.fillStyle = bl ? '#fff27a' : '#5ae6ff'; ctx.fill();
        ctx.restore();
        return;
      }
      var x = Math.round(s.sx[k] - camX), y = Math.round(s.sz[k]), rx = Math.round(K.r * (s.area || 1)), ry = Math.max(2, Math.round(K.depth * 0.35));
      var blink = Math.floor(s.t / 60) % 2;
      ctx.fillStyle = blink ? 'rgba(255,240,120,0.55)' : 'rgba(90,230,255,0.45)';
      for (var a = 0; a < 24; a++) {
        var an = a / 24 * Math.PI * 2;
        ctx.fillRect(Math.round(x + Math.cos(an) * rx), Math.round(y + Math.sin(an) * ry), 2, 1);
      }
      ctx.fillStyle = 'rgba(255,255,200,0.25)';
      ctx.fillRect(x - Math.round(rx * 0.5), y - 1, Math.round(rx), 2);
    });
  }
  // 효과 그림 한 장: 따라다니면 지금 캐릭터 위치(+ox,oy), 아니면 처음 놓인 곳(+날아간 거리)
  //   half = 'top' / 'bottom': 기준점(pivot) 위쪽 / 아래쪽 반만 그림 (split 그림을 캐릭터 뒤·앞으로 나눠 그릴 때)
  function drawArt(ctx, camX, a, half) {
    var A = a.A, n = A.fr.length, i = Math.floor(a.t * A.fps / 1000);
    i = A.loop ? i % n : Math.min(n - 1, i);
    var im = A.fr[i]; if (!im) return;
    var dir = a.follow ? a.p.dir : a.dir, x = a.follow ? a.p.x + dir * a.ox : a.x, y = a.follow ? a.p.y + a.oy : a.y;
    ctx.save();
    ctx.translate(snapPx(x - camX), snapPx(y));
    ctx.scale(dir, 1);
    if (a.rot) ctx.rotate(a.rot * Math.PI / 180);
    if (a.scale !== 1) ctx.scale(a.scale, a.scale);
    if (a.alpha !== 1) ctx.globalAlpha = a.alpha;
    if (a.add) ctx.globalCompositeOperation = 'lighter';
    if (half) {
      // 기준점 위쪽(먼 쪽) / 아래쪽(가까운 쪽) 반만. HD 그림은 잘라낸 여백(_oy)만큼 그림 속 줄이 밀려 있음
      var k = im._k || 1, ox = im._ox || 0, oy = im._oy || 0, px = A.pivot.x, py = A.pivot.y;
      var cut = clamp(Math.round(py - oy), 0, im.height), top = half === 'top';
      ctx.scale(k, k);
      if (top && cut > 0) ctx.drawImage(im, 0, 0, im.width, cut, ox - px, oy - py, im.width, cut);
      if (!top && cut < im.height) ctx.drawImage(im, 0, cut, im.width, im.height - cut, ox - px, oy - py + cut, im.width, im.height - cut);
    } else Assets.blit(ctx, im, A.pivot.x, A.pivot.y);
    ctx.restore();
  }
  // 잔상 + 캐릭터 뒤 효과(돌진 잔상 그림) (캐릭터 그리기 전에)
  function drawGhosts(ctx, camX) {
    arts.forEach(function (a) { if (a.split) drawArt(ctx, camX, a, 'top'); else if (a.back) drawArt(ctx, camX, a); });
    ghosts.forEach(function (g) {
      var k = g.t / g.life;
      ctx.save();
      ctx.globalAlpha = g.alpha * (1 - k);
      ctx.translate(snapPx(g.x - camX), snapPx(g.y));
      ctx.scale(g.dir, 1);
      Assets.blit(ctx, g.img, g.pivot.x, g.pivot.y);
      ctx.restore();
    });
  }
  // 캐릭터 위: 효과 그림(앞), 번개 기둥, 회전 원, 감전(멈춘 적)
  function drawOver(ctx, camX) {
    arts.forEach(function (a) { if (a.split) drawArt(ctx, camX, a, 'bottom'); else if (!a.back) drawArt(ctx, camX, a); });
    var SH = fxArt('shock');
    H.targets().forEach(function (e) {   // 내려찍기 기절 = 머리 위 도는 별(2026-11-06, 감전 번개 표시 대신)
      if (e && e.T && e.stunT > 0 && e.state === 'hit' && e.stunKind === 'stars') drawStars(ctx, camX, e);
    });
    if (SH) H.targets().forEach(function (e) {
      if (!e || !e.T || !(e.stunT > 0) || e.state !== 'hit' || e.stunKind === 'stars') return;
      var im = SH.fr[Math.floor(e.clock * SH.fps / 1000) % SH.fr.length], k = clamp(e.T.height / (100 * AS()), 0.6, 1.4);
      // 감전 그림은 기술 효과 배율(skillFxScale)로 커졌으므로 그만큼 되돌려 적 몸 크기에 맞춤
      k /= (CFG.skillFxScale || 1);
      ctx.save(); ctx.translate(snapPx(e.x - camX), snapPx(e.y - e.T.height * 0.55)); ctx.scale(k, k);
      ctx.globalAlpha = 0.9; Assets.blit(ctx, im, SH.pivot.x, SH.pivot.y); ctx.restore();
    });
    rings.forEach(function (r) {
      var k = r.t / r.life, rr = r.r * (0.55 + 0.45 * ease(Math.min(1, k * 1.6))), x = Math.round(r.x - camX), y = Math.round(r.y);
      if (SM()) {   // 매끈한 화면: 빛나는 타원 띠
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k) * 0.9; ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = r.color; ctx.lineWidth = 3 * (1 - k * 0.6); ctx.shadowColor = '#8fc4ff'; ctx.shadowBlur = 6 * ((CFG.view.renderScale) || 1);
        ctx.beginPath(); ctx.ellipse(r.x - camX, r.y, rr, rr * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        return;
      }
      ctx.globalAlpha = Math.max(0, 1 - k) * 0.9;
      ctx.fillStyle = r.color;
      var n = Math.max(24, Math.round(rr * 1.2));
      for (var a = 0; a < n; a++) {
        var an = a / n * Math.PI * 2;
        ctx.fillRect(Math.round(x + Math.cos(an) * rr), Math.round(y + Math.sin(an) * rr * 0.32), 2, 2);
      }
      ctx.globalAlpha = 1;
    });
    bolts.forEach(function (b) { drawBolt(ctx, camX, b); });
    drawSlowed(ctx, camX);        // 얼음창에 느려진 적(2026-11-06)
    drawBeams(ctx, camX); drawArcs(ctx, camX); drawShield(ctx, camX); drawBrands(ctx, camX);   // 2차 기술(2026-11-06)
    drawMeteors(ctx, camX);       // 떨어지는 운석
    waves.forEach(function (w) { if (!w.ground) drawWave(ctx, camX, w); });
    // 번쩍 빛(더하기)
    glows.forEach(function (gl) {
      var k = gl.t / gl.life, r = gl.r * (0.6 + 0.6 * ease(Math.min(1, k * 2))), x = gl.x - camX;
      var g = ctx.createRadialGradient(x, gl.y, 0, x, gl.y, r);
      g.addColorStop(0, gl.color); g.addColorStop(0.35, gl.color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = gl.a * (1 - k) * (1 - k);
      ctx.fillStyle = g; ctx.fillRect(x - r, gl.y - r, r * 2, r * 2); ctx.restore();
    });
    // 파편·불티
    parts.forEach(function (q) {
      var k = q.t / q.life, x = q.x - camX;
      ctx.save(); ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      if (q.glow) {
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = q.col; ctx.lineWidth = q.size; ctx.lineCap = 'round';
        var sp = Math.hypot(q.vx, q.vy) || 1, L = Math.min(7, 1 + sp * 0.025);
        ctx.beginPath(); ctx.moveTo(x, q.y); ctx.lineTo(x - q.vx / sp * L, q.y - q.vy / sp * L); ctx.stroke();
      } else {
        ctx.translate(x, q.y); ctx.rotate(q.rot); ctx.fillStyle = q.col;
        ctx.fillRect(-q.size / 2, -q.size / 2, q.size, q.size * 0.8);
      }
      ctx.restore();
    });
  }
  // 기절 별: 머리 위 납작한 타원을 따라 작은 노란 별 3개가 돎(뒤쪽 = 어둡게). 도트 단위로 반올림해서 또렷하게
  function drawStars(ctx, camX, e) {
    var t = e.clock / 1000, cx = e.x - camX, cy = e.y - e.T.height - 4 * AS(), rx = Math.max(8, e.T.radius * 0.7), ry = rx * 0.3;
    ctx.save();
    for (var i = 0; i < 3; i++) {
      var an = t * 5 + i * Math.PI * 2 / 3, x = Math.round(cx + Math.cos(an) * rx), y = Math.round(cy + Math.sin(an) * ry), back = Math.sin(an) < 0;
      ctx.globalAlpha = back ? 0.65 : 1;
      ctx.fillStyle = '#3a2a10'; ctx.fillRect(x - 2, y - 1, 5, 3); ctx.fillRect(x - 1, y - 2, 3, 5);
      ctx.fillStyle = back ? '#c8a030' : '#ffe14a'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1);
    }
    ctx.restore();
  }
  // 충격파 고리 한 개: 빠르게 퍼지고(처음 빠르게) 굵기·투명도가 줄어듦. 바깥 빛(glow 색) + 흰 심
  function drawWave(ctx, camX, w) {
    var k = w.t / w.life, e = ease(Math.min(1, k * 1.3)), r = w.r0 + (w.r - w.r0) * e, x = w.x - camX;
    var a = Math.max(0, 1 - k), lw = w.w * (1 - k * 0.7);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a * 0.55; ctx.strokeStyle = w.glow; ctx.lineWidth = lw * 2.6;
    ctx.beginPath(); ctx.ellipse(x, w.y, r, r * w.flat, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = a * 0.9; ctx.strokeStyle = w.color; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.ellipse(x, w.y, r, r * w.flat, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  function drawBolt(ctx, camX, b) {
    var K = b.K, k = b.t / b.life, x = Math.round(b.x - camX), gy = Math.round(b.z - 2);
    var A = fxArt(K.art);
    if (A) {
      // 번개 그림: 기준점(아래 끝)을 땅에 딱 붙이고 원래 크기로 그림. 그림 위로 화면이 더 남으면
      //   그림 윗부분(30%)만 세로로 늘려 화면 맨 위까지 이어 붙인다(땅 쪽 모양은 그대로)
      //   (그림 점 → 도트 배율 ik, 잘라낸 여백 ox/oy 를 넣어서 도트 단위로 계산)
      var im = A.fr[Math.min(A.fr.length - 1, Math.floor(b.t * A.fps / 1000))], gy2 = b.z;
      var ik = im._k || 1, ox = im._ox || 0, oy = im._oy || 0, W = im.width * ik, Hh = im.height * ik;
      var left = x - (A.pivot.x - ox) * ik, top = gy2 - (A.pivot.y - oy) * ik, sh = Math.max(1, Math.round(im.height * 0.3));
      ctx.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
      if (top > 0) {
        ctx.drawImage(im, 0, sh, im.width, im.height - sh, left, top + sh * ik, W, Hh - sh * ik);
        ctx.drawImage(im, 0, 0, im.width, sh, left, 0, W, top + sh * ik);
      } else ctx.drawImage(im, left, top, W, Hh);
      ctx.globalAlpha = 1;
      return;

    }
    // 코드로 그린 번개: 지그재그 기둥(바깥 색 + 흰 심), 처음에는 넓은 빛 → 깜빡이며 가늘어짐
    if (k > 0.55 && Math.floor(b.t / 40) % 2) return;   // 끝 무렵 깜빡임
    var s = AS(), segH = Math.max(6, Math.round(16 * s)), amp = 7 * s;
    var seed = b.seed + Math.floor(b.t / 50) * 13.7;
    function rnd(i) { var v = Math.sin(seed + i * 91.3) * 43758.5453; return v - Math.floor(v); }
    var pts = [], n = Math.ceil(gy / segH);
    for (var i = 0; i <= n; i++) pts.push({ x: x + (i === 0 || i === n ? 0 : (rnd(i) * 2 - 1) * amp), y: Math.min(gy, i * segH) });
    var wOuter = Math.max(3, Math.round((k < 0.25 ? 7 : 4) * s * 1.4)), wCore = Math.max(1, Math.round(wOuter / 2.5));
    if (k < 0.3) {   // 처음: 넓은 빛
      ctx.globalAlpha = 0.28; ctx.fillStyle = K.glow || '#fff27a';
      ctx.fillRect(x - Math.round(18 * s), 0, Math.round(36 * s), gy);
      ctx.globalAlpha = 1;
    }
    function line(w, col) {
      ctx.fillStyle = col;
      for (var j = 0; j < pts.length - 1; j++) {
        var a = pts[j], c = pts[j + 1];
        for (var y = a.y; y < c.y; y++) {
          var u = (y - a.y) / (c.y - a.y), px = Math.round(a.x + (c.x - a.x) * u);
          ctx.fillRect(px - Math.floor(w / 2), y, w, 1);
        }
      }
    }
    line(wOuter + 2, '#14244a');
    line(wOuter, K.color || '#59e6ff');
    line(wCore, K.core || '#ffffff');
    // 땅에 닿은 곳: 납작한 빛
    ctx.fillStyle = K.glow || '#fff27a';
    ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.fillRect(x - Math.round(16 * s), gy - 1, Math.round(32 * s), 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - Math.round(8 * s), gy - 2, Math.round(16 * s), 3);
    ctx.globalAlpha = 1;
  }
  // 맨 위: 화면 번쩍
  function drawFlash(ctx, W, Hh) {
    if (!flash) return;
    var k = flash.t / flash.life;
    ctx.globalAlpha = flash.alpha * (1 - k) * (1 - k);
    ctx.fillStyle = flash.color;
    ctx.fillRect(-8, -8, W + 16, Hh + 16);
    ctx.globalAlpha = 1;
  }
  // ?debug=1: 기술 판정 상자(빨강), 번개 자리(노랑), 화염구 탄(주황)
  function drawDebug(ctx, camX, p) {
    function rect(b, col) {
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(b.x0 - camX) + 0.5, Math.round(b.y0) + 0.5, Math.round(b.x1 - b.x0), Math.round(b.y1 - b.y0));
    }
    var s = p.state === 'skill' && p.sk;
    if (s) {
      s.boxes.forEach(function (b) { rect(b, '#ff2a2a'); });
      // 아직 안 온 판정 구간도 흐리게
      (s.d.hits || []).forEach(function (h) { if (s.t < h.at[0]) rect(boxOf(p, h.reach), 'rgba(255,80,80,0.35)'); });
      var K = s.K || s.d.strikes;
      if (K) K.at.forEach(function (at, k) {
        rect({ x0: s.sx[k] - K.r, x1: s.sx[k] + K.r, y0: s.sz[k] - 100 * AS(), y1: s.sz[k] }, s.strikeDone[k] ? 'rgba(255,240,80,0.4)' : '#ffe94a');
      });
    }
    Projectiles.list.forEach(function (pr) {
      if (!pr.skill) return;
      var w = pr.box.w, h = pr.box.h;
      rect({ x0: pr.x - w / 2, x1: pr.x + w / 2, y0: pr.y - h / 2, y1: pr.y + h / 2 }, '#ff9a2a');
    });
  }

  // ---------- 버튼 표시 (폰: 공격 버튼 둘레 반달의 네모 도트 칸 + 기술 그림. PC 아래 막대는 main.js pcBarUi 가 slotState 로 그림) ----------
  // 쿨타임 중이면 어둡게 + 시계 방향으로 밝아지는 부채꼴(--cd = 남은 비율) + 남은 초. 빈 칸·안 보이는 칸(Lv15 전 5번 등)은 숨김.
  //   마나가 모자라면 회색(nomp) + 버튼 밑에 「MP 드는 마나」. G.player 가 없으면(처음) 다 숨김
  var uiLast = {};
  // 칸 하나의 지금 모습(2026-11-07, 폰 버튼 · PC 아래 막대가 같이 씀) → null(빈 칸) 또는
  //   { id, key, name, icon, rem = 남은 쿨타임(ms), cd = 쿨타임 전체, frac = 남은 비율(0~1), cost = 드는 마나, nomp = 마나 모자람, dodge = 회피 칸 }
  //   회피 칸: 쿨타임 = 플레이어 회피 쿨타임(config move.dodge.cdMs), 마나 안 듦
  function slotState(G, i) {
    var p = G.player, bk = p ? bookOf(G.classKey) : null, id = bk && bk.at(i);
    if (!p || !id) return null;
    if (id === 'dodge') {
      var D = CFG.move && CFG.move.dodge, r = Math.max(0, p.dodgeCd || 0), all = (D && D.cdMs) || 1;
      return { id: 'dodge', key: 'dodge', name: '회피', icon: '회', rem: r, cd: all, frac: Math.round(Math.min(1, r / all) * 100) / 100, cost: 0, nomp: false, dodge: true };
    }
    var q = slotSkill({ classKey: G.classKey, gender: G.charKey }, i), d = q && q.d;
    if (!d) return null;
    var rem = p.skillCd ? Math.max(0, p.skillCd[d.key] || 0) : 0, cost = mpCost(p, q.L), cd = cdOf(p, q.L);
    return { id: d.id, key: d.key, name: d.name, icon: d.icon, rem: rem, cd: cd, frac: Math.round(Math.min(1, rem / cd) * 100) / 100, cost: cost, nomp: (p.mp || 0) < cost };
  }
  // 폰 기술 버튼 그림(2026-11-06 폰 UI): js/icons.js 의 32칸 액자 그림을 버튼 크기(기기 점)에 가장 가까운 정수 배로 → CSS 가 버튼 크기에 맞춤.
  //   같은 기술·같은 크기면 다시 안 그림. 화면 크기가 바뀌면(폴드 펴기 등) 다시 그림
  function setIcon(el, ic, id) {
    var px = Math.round((el.offsetWidth || 46) * (window.devicePixelRatio || 1)), sc = Math.max(1, Math.round(px / 32)), key = id + '@' + sc;
    if (ic.dataset.icon === key) return;
    ic.dataset.icon = key; ic.textContent = '';
    ic.appendChild(PixelIcons.canvas(id, sc, { frame: true }));
  }
  window.addEventListener('resize', function () { uiLast = {}; });
  function ui(G) {
    var changed = false, p = G.player;
    SLOTS.forEach(function (slot, i) {
      var d = slotState(G, i), rem = d ? d.rem : 0, cost = d ? d.cost : 0, frac = d ? d.frac : 0, nomp = !!d && d.nomp;
      var key = d ? d.key + '|' + d.icon + '|' + frac + '|' + Math.ceil(rem / 100) + '|' + nomp + '|' + cost : 'none';
      if (uiLast[slot] === key) return;
      var wasHidden = !uiLast[slot] || uiLast[slot] === 'none';
      if (wasHidden !== !d) changed = true;
      uiLast[slot] = key;
      document.querySelectorAll('[data-skill="' + slot + '"]').forEach(function (el) {
        el.hidden = !d;
        if (!d) return;
        el.classList.toggle('cool', rem > 0);
        el.classList.toggle('nomp', nomp);
        el.style.setProperty('--cd', frac);
        el.title = d.name + (d.dodge ? '' : ' (MP ' + cost + ')');
        el.setAttribute('aria-label', d.name);
        var ic = el.querySelector('.ic'), sec = el.querySelector('.sec'), mp = el.querySelector('.mp');
        if (ic) {
          if (el.classList.contains('sk') && window.PixelIcons && PixelIcons.meta[d.id]) setIcon(el, ic, d.id);   // 폰 버튼 = 도트 그림(액자 포함)
          else if (ic.textContent !== d.icon) ic.textContent = d.icon;                                            // PC 아래 글자 = 글자 하나
        }
        if (sec) sec.textContent = rem > 0 ? (rem >= 1000 ? Math.ceil(rem / 1000) : (rem / 1000).toFixed(1)) : '';
        if (mp) mp.textContent = d.dodge ? '' : 'MP ' + cost;
      });
    });
    return changed;
  }
  // 마나가 모자라 안 나간 칸 버튼을 잠깐 흔듦(main.js 의 noMp 가 부름)
  function shakeSlot(slot) {
    document.querySelectorAll('[data-skill="' + slot + '"], [data-pslot="' + slot + '"]').forEach(function (el) {   // 폰 버튼 + PC 아래 막대 칸
      el.classList.remove('nompHit'); void el.offsetWidth; el.classList.add('nompHit');
    });
  }

  window.Skills = {
    init: function (cfg, hooks) { CFG = cfg; H = hooks; },
    resolve: resolve, pick: pick, start: start, advance: advance, frame: frame, facing: facing,
    invulnerable: invulnerable, passThrough: passThrough, usingArt: usingArt,
    // 캔슬(2026-11-06 밤): 지금 기술이 끝무렵이라 다른 기술로 이어질 수 있나 / 이번에 이어서 쓴 기술 id(같은 기술은 다시 안 나감)
    canChain: function (p) { var s = p.sk; return !!(s && s.t >= s.d.chainAt); },
    chainIds: function (p) { var s = p.sk; return s ? (s.chain || []).concat([s.d.id]) : []; },
    // 그 칸 기술이 지금 나갈 수 있나(쿨타임 끝 + 마나 넉넉) → { d, L, slot } 또는 null (자동 조종용)
    ready: function (p, i) { var q = slotSkill(p, i); return q && !((p.skillCd[q.d.key] || 0) > 0) && (p.mp || 0) >= mpCost(p, q.L) ? { d: q.d, L: q.L, slot: SLOTS[i] } : null; },
    // 각성(2026-11-06 밤): 잔상 하나(직업 색) · 효과 빛 세기 배율(마력 폭주 = 더 크고 밝게, 그림만)
    ghost: function (p, color, ms, alpha) { addGhost(p, { color: color, lifeMs: ms || 260, alpha: alpha == null ? 0.5 : alpha }); },
    setBright: function (k) { bright = k || 1; },
    wave: wave,
    addEnts: addEnts,
    update: update, tickReal: tickReal,
    drawBackdrop: drawBackdrop, drawUnder: drawUnder, drawGhosts: drawGhosts, drawOver: drawOver, drawFlash: drawFlash, drawDebug: drawDebug,
    armored: armored, ui: ui, shakeSlot: shakeSlot, slots: SLOTS, lvStat: lvStat, slotSkill: slotSkill, slotState: slotState,
    _meteors: function () { return meteors; },   // 시험용
    // 떨어지는 중인 운석 자리(2026-11-06 무기 속성: 운석에도 속성 꼬리, js/enchant.js)
    meteorsNow: function () { return meteors.filter(function (m) { return !m.boom && m.t >= m.M.markMs; }).map(function (m) { return meteorPos(m, clamp((m.t - m.M.markMs) / m.M.fallMs, 0, 1)); }); },
    // 2차 기술(2026-11-06): 늘 켜진 기술(main.js 가 부름) · 순간이동 숨기 · 시험용
    gritBonus: gritBonus, tryCounter: tryCounter, shieldSplit: shieldSplit, shieldHit: shieldHit, brandMul: brandMul, brandMark: brandMark,
    hidden: hidden, test: TEST, _fx: function () { return { blades: blades.length, flames: flames.length, beams: beams.length, arcs: arcs.length, shield: !!shieldFx }; },
    clear: function () { tornados.length = 0; blades.length = 0; flames.length = 0; beams.length = 0; arcs.length = 0; shieldFx = null; gritOn = false; curLv = 1; meteors.length = 0; pillars.length = 0; echoes.length = 0; bright = 1; noMpT = 0; bolts.length = 0; rings.length = 0; ghosts.length = 0; arts.length = 0; waves.length = 0; parts.length = 0; glows.length = 0; flash = null; },
    // 화면 번쩍(콤보 마무리 타도 씀): { color, alpha, ms }
    flash: function (f) { doFlash(f); },
    // 파편·둥근 빛(소품 나뭇조각·음식 반짝임도 씀, props.js)
    debris: debris, glow: glow,

    state: function () { return { bolts: bolts.length, rings: rings.length, ghosts: ghosts.length, arts: arts.length, flash: !!flash, meteors: meteors.length, casts: casts }; }
  };
})();
