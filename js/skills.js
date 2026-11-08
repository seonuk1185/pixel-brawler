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
  // 성기사(2차) 기술(2026-11-08): crosses = 심판의 십자(땅에 새김 → 빛기둥 솟음, 기사가 다른 걸 해도 그대로 터짐), aegisT = 신성 가호 금빛 불티 간격
  var crosses = [], aegisT = 0;
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
    if (o.cross && o.cross.at == null) o.cross = cp(o.cross, { at: st(o.cross.frame) });                                // 심판의 십자(2026-11-08)
    if (o.barrier && o.barrier.frames) { var br = span(o.barrier); o.barrier = cp(o.barrier, { from: br[0], to: br[1] }); }   // 성스러운 돌격 방패(2026-11-08)
    if (o.charge && o.charge.burst && o.charge.burst.at == null) o.charge = cp(o.charge, { burst: cp(o.charge.burst, { at: st(o.charge.burst.frame) }) });
    if (o.grav && o.grav.at == null) o.grav = cp(o.grav, { at: st(o.grav.frame) });                                    // 중력 구체(법사, 2026-11-08)
    if (o.frost && o.frost.at == null) o.frost = cp(o.frost, { at: st(o.frost.frame) });
    if (o.crag && o.crag.at == null) o.crag = cp(o.crag, { at: st(o.crag.frame) });                                    // 빙산 솟구치기(2026-11-08)                               // 빙결 폭풍(대마법사, 2026-11-08)
    if (o.judge && o.judge.at == null) o.judge = cp(o.judge, { at: st(o.judge.frame), strikeAt: st(o.judge.strike) });  // 천둥 심판(대마법사, 2026-11-08)
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
      if (o.cross) mx(o.cross.at + o.cross.telegraphMs); if (o.charge) mx(o.charge.burst.at);   // 성기사(2026-11-08)
      if (o.grav) mx(o.grav.at); if (o.frost) mx(o.frost.at); if (o.crag) mx(o.crag.at); if (o.judge) mx(o.judge.strikeAt);   // 대마법사 · 법사 새 기술(2026-11-08)
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
    if (d.cross && !s.crossDone && t1 >= d.cross.at) { s.crossDone = true; castCross(p, d, s); }       // 심판의 십자(2026-11-08)
    if (d.charge) chargeStep(p, d, s, t0, t1);                                                          // 성스러운 돌격(2026-11-08)
    if (d.grav && !s.gravDone && t1 >= d.grav.at) { s.gravDone = true; castGrav(p, d, s); }           // 중력 구체(법사, 2026-11-08)
    if (d.frost && !s.frostDone && t1 >= d.frost.at) { s.frostDone = true; castFrost(p, d, s); }      // 빙결 폭풍(대마법사, 2026-11-08)
    if (d.crag && !s.cragDone && t1 >= d.crag.at) { s.cragDone = true; castCrags(p, d, s); }          // 빙산 솟구치기(2026-11-08)
    if (d.judge) judgeStep(p, d, s, t0, t1);                                                                // 천둥 심판(대마법사, 2026-11-08)
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
  //   성스러운 돌격 방패(barrier, 2026-11-08): 슈퍼아머여도 방패가 있는 동안은 안 맞음(완전 무적)
  function barrierOn(p) { var s = p && p.state === 'skill' && p.sk, B = s && s.d.barrier; return !!(B && s.t >= B.from && s.t <= B.to); }
  function invulnerable(p) {
    if (barrierOn(p)) return true;
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
    if (c.slow && t.T && t.alive && t.alive()) { t.slowT = c.slow.ms; t.slowK = t.T.boss ? c.slow.bossMul : c.slow.mul; t.slowDaze = false; }
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
    tornados.forEach(function (o) { ents.push({ y: o.z + 0.7, d: function () { drawTornado(ctx, camX, o); } }); });
    crags.forEach(function (q, i) { ents.push({ y: q.z - 0.4 - i * 0.001, d: function () { drawCrag(ctx, camX, q); } }); });   // 나중 얼음일수록 조금 뒤 → 뒤로 뻗은 등줄기가 앞 얼음 밑으로 들어감   // 빙산(자리보다 조금 뒤 → 같은 줄 적은 얼음 앞에)   // 회오리 = 안의 적 앞에(빛이라 비쳐 보임)
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
      if (!e || !e.T || !(e.slowT > 0) || e.slowDaze || (e.alive && !e.alive())) return;   // slowDaze = 중력 구체 · 소용돌이에 끌리며 어질(얼음 아님, 2026-11-08)
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
    tornadoLook(tornados[tornados.length - 1], p, s.L.lv || 1);
    glow(p.x + p.dir * T.x, p.y - 50 * AS(), T.r * s.area, c[1], 220, 0.6);
  }
  // 회오리 모습 재료(2026-11-07 v2 형님: 「동그란 줄 몇 개」 → 진짜 바람 회오리 + 진짜 칼): 그림만, 판정 · 데미지는 그대로
  //   streaks = 깔때기를 따라 감겨 오르는 얇은 바람 줄(높이 · 빠르기 제각각), swords = 기사가 지금 든 칼 그림(강화 단계 그림) 6~10자루(Lv 마다 +1),
  //   bits = 휩쓸려 도는 잎 · 불티, dust = 바닥에서 튀는 흙먼지(개수 상한). 폰(매끈 화면 아님)은 줄 · 조각을 줄임
  function tornadoLook(o, p, lv) {
    var A = window.GAME && GAME.assets && GAME.assets.weapons, ak = A && (p.wArt && A[p.wArt] ? p.wArt : p.weaponKey), sm = SM(), i, R = Math.random;
    o.img = A && A[ak] || null;
    o.streaks = []; o.swords = []; o.bits = []; o.dust = []; o.dustT = 0;
    var nS = sm ? 30 : 18, nW = clamp(5 + lv, 6, 10), nB = sm ? 7 : 4;
    for (i = 0; i < nS; i++) o.streaks.push({ u: (i + R() * 0.6) / nS, ph: R() * 6.28, sp: 0.75 + R() * 0.6, len: 2.2 + R() * 2.2, rise: 0.03 + R() * 0.05,
      w: 0.9 + R() * 1.4, up: 0.05 + R() * 0.12, c: i % 3 });
    for (i = 0; i < nW; i++) o.swords.push({ u: 0.16 + 0.72 * (i + 0.5) / nW, ph: i * 2.399 + R() * 0.4, sp: 0.8 + R() * 0.45, rot: R() * 6.28, rs: (R() < 0.5 ? -1 : 1) * (7 + R() * 6), bob: R() * 6.28 });
    for (i = 0; i < nB; i++) o.bits.push({ u: R(), ph: R() * 6.28, sp: 0.9 + R() * 0.7, spark: i % 3 === 2, rot: R() * 6.28, c: ['#7fae3e', '#b58a3a', '#5e8a2c'][i % 3] });
  }
  function tornadoStep(dt) {
    for (var i = tornados.length - 1; i >= 0; i--) {
      var o = tornados[i], T = o.T;
      o.t += dt;
      if (o.dust) tornadoDust(o, dt);   // 바닥 흙먼지(그림만)
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
  // 회오리 그림(코드, 2026-11-07 v2): 아래 좁고 위 넓은 깔때기(위로 갈수록 확 퍼짐 · 몸통이 살짝 휘청)
  //   뒤쪽 바람 줄 → 뒤쪽 칼 → 반투명 몸통 → 잎 · 불티 → 앞쪽 칼 → 앞쪽 바람 줄 순서(돌며 앞뒤가 바뀜 = 입체). 처음 · 끝은 커졌다 작아짐, 끝 터짐 때 칼이 바깥으로 흩어짐
  var TEY = 0.28;   // 깔때기 고리 납작한 정도(위아래 / 좌우)
  function tfun(o, u, x, z, H0, rb, rt) {
    var r = rb + (rt - rb) * Math.pow(u, 1.35), now = o.t / 1000;
    return { x: x + Math.sin(now * 2.3 + u * 3.2 + o.seed) * rt * 0.12 * u, y: z - H0 * u, r: r };
  }
  function tornadoDust(o, dt) {
    var D = o.dust, T = o.T, i, cap = SM() ? 26 : 14;
    for (i = D.length - 1; i >= 0; i--) { var q = D[i]; q.t += dt; if (q.t >= q.life) { D.splice(i, 1); continue; } var f = dt / 1000; q.x += q.vx * f; q.h += q.vh * f; q.vh -= 60 * f; q.vx *= 0.97; }
    if (o.burst) return;
    o.dustT += dt;
    while (o.dustT >= 45) {
      o.dustT -= 45;
      if (D.length >= cap) continue;
      var sd = Math.random() < 0.5 ? -1 : 1, rr = T.r * o.k * 0.3;
      D.push({ x: o.x + sd * rr * (0.4 + Math.random() * 0.6), zo: (Math.random() - 0.5) * T.depth * 0.6 * o.k, h: 2, vx: sd * (40 + Math.random() * 70) + o.dir * T.speed * 0.5,
               vh: 30 + Math.random() * 60, t: 0, life: 420 + Math.random() * 360, s: (4 + Math.random() * 6) * AS(), c: Math.random() < 0.5 ? '#b8a688' : '#d6c9ad' });
    }
  }
  function drawTornado(ctx, camX, o) {
    if (!o.streaks) return;
    var T = o.T, x = o.x - camX, z = o.z, k = o.k, P2 = Math.PI * 2;
    var grow = o.burst ? 1 + o.bt / 160 : Math.min(1, o.t / 180), fade = o.burst ? Math.max(0, 1 - o.bt / 260) : Math.min(1, (o.life - o.t) / 200 + 0.6);
    var H0 = T.h * k * grow, rb = T.r * k * 0.16 * grow, rt = T.r * k * 1.1 * grow, now = o.t / 1000, spin = now * 9 + o.seed;
    var segs = SM() ? 7 : 5, sw = AS();
    ctx.save(); ctx.lineCap = 'round';
    // 바닥 흙먼지(세계 자리에 남음 → 회오리가 지나간 자리에 먼지가 퍼짐)
    o.dust.forEach(function (q) {
      var a = 1 - q.t / q.life; ctx.globalAlpha = 0.6 * a * Math.min(1, q.t / 80); ctx.fillStyle = q.c;
      ctx.beginPath(); ctx.arc(q.x - camX, z + q.zo - q.h, q.s * (1 + q.t / q.life), 0, P2); ctx.fill();
    });
    // 뒤 빛 + 바닥 소용돌이 고리(가운데만 살짝)
    ctx.globalCompositeOperation = 'lighter';
    var gm = tfun(o, 0.5, x, z, H0, rb, rt), g = ctx.createRadialGradient(gm.x, gm.y, 0, gm.x, gm.y, rt);
    g.addColorStop(0, 'rgba(255,255,255,' + (0.16 * fade) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(gm.x - rt, z - H0 - 6, rt * 2, H0 + 12);
    ctx.globalAlpha = 0.5 * fade; ctx.strokeStyle = o.col2; ctx.lineWidth = 1.5 * sw;
    ctx.beginPath(); ctx.ellipse(x, z, rb * 2.6, rb * 2.6 * TEY, 0, spin, spin + 2.4); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, z, rb * 2.6, rb * 2.6 * TEY, 0, spin + Math.PI, spin + Math.PI + 2.0); ctx.stroke();
    // 바람 줄: front = false 면 뒤쪽 반(sin < 0)만, true 면 앞쪽 반만
    var cols = ['#ffffff', '#dcefff', o.col2];
    function streaks(front) {
      o.streaks.forEach(function (S) {
        var u0 = (S.u + now * S.up) % 1, a0 = S.ph + spin * S.sp * (1.35 - 0.5 * u0), last = null;
        for (var j = 0; j <= segs; j++) {
          var f = j / segs, u = Math.min(1, u0 + S.rise * f * S.len), a = a0 + S.len * f, F = tfun(o, u, x, z, H0, rb, rt);
          var pt = { x: F.x + Math.cos(a) * F.r, y: F.y + Math.sin(a) * F.r * TEY, s: Math.sin(a) };
          if (last && (pt.s >= 0) === front) {
            var tap = Math.sin(Math.PI * (j - 0.5) / segs), top = u0 > 0.92 ? (1 - u0) / 0.08 : 1, al = (front ? 0.85 : 0.4) * tap * top * fade;
            ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = al * 0.5; ctx.strokeStyle = o.col; ctx.lineWidth = (S.w * 2.4 + 1) * sw * tap;   // 바깥 = 속성 색(밝은 하늘에서도 보이게 그냥 칠함)
            ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(pt.x, pt.y); ctx.stroke();
            ctx.globalAlpha = al * 0.9; ctx.strokeStyle = cols[S.c]; ctx.lineWidth = S.w * sw * tap;   // 안 = 흰 · 옅은 하늘색 바람
            ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(pt.x, pt.y); ctx.stroke();
          }
          last = pt;
        }
      });
    }
    // 칼(기사가 든 칼 그림): 높이 u 의 고리를 따라 돌며 제자리에서도 빙글빙글. 앞 = 크게 · 밝게, 뒤 = 작게 · 흐리게 + 짧은 꼬리
    var img = o.img, cxp = img ? (img._ox || 0) + img.width / 2 : 0, cyp = img ? (img._oy || 0) + img.height / 2 : 0;
    var spread = o.burst ? 1 + o.bt / 70 : 1;
    function swords(front) {
      if (!img) return;
      o.swords.forEach(function (W) {
        var u = W.u + Math.sin(now * 2 + W.bob) * 0.04, a = W.ph + now * 7.5 * W.sp, F = tfun(o, u, x, z, H0, rb, rt), s = Math.sin(a);
        if ((s >= 0) !== front) return;
        var rr = F.r * 0.82 * spread, px = F.x + Math.cos(a) * rr, py = F.y + Math.sin(a) * rr * TEY - (o.burst ? o.bt * 0.15 : 0);
        var sc = 0.95 * Math.sqrt(k) * (0.78 + 0.24 * s), al = (front ? 1 : 0.55) * fade, rot = W.rot + now * W.rs;
        // 꼬리: 지나온 고리 길(얇게 사라지는 줄 3토막)
        ctx.globalCompositeOperation = 'lighter';
        for (var j = 0; j < 3; j++) {
          var b0 = a - 0.22 * j, b1 = a - 0.22 * (j + 1);
          ctx.globalAlpha = al * 0.5 * (1 - j / 3); ctx.strokeStyle = j ? o.col2 : '#ffffff'; ctx.lineWidth = (3.2 - j) * sw * sc;
          ctx.beginPath(); ctx.moveTo(F.x + Math.cos(b0) * rr, F.y + Math.sin(b0) * rr * TEY); ctx.lineTo(F.x + Math.cos(b1) * rr, F.y + Math.sin(b1) * rr * TEY); ctx.stroke();
        }
        if (front && SM()) {   // 칼 둘레 옅은 빛(속성 있으면 그 색)
          ctx.globalAlpha = 0.28 * fade; ctx.fillStyle = o.col; ctx.beginPath(); ctx.arc(px, py, 9 * sw * sc, 0, P2); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        // 잔상 하나(조금 전 각도 · 회전) + 칼
        ctx.save(); ctx.translate(F.x + Math.cos(a - 0.3) * rr, F.y + Math.sin(a - 0.3) * rr * TEY); ctx.rotate(rot - W.rs * 0.03); ctx.scale(sc, sc);
        ctx.globalAlpha = al * 0.28; Assets.blit(ctx, img, cxp, cyp); ctx.restore();
        ctx.save(); ctx.translate(px, py); ctx.rotate(rot); ctx.scale(sc, sc);
        ctx.globalAlpha = al; Assets.blit(ctx, img, cxp, cyp); ctx.restore();
      });
    }
    streaks(false);
    swords(false);
    // 반투명 몸통(깔때기 모양으로 칠함 → 뒤 칼이 조금 가려져 안쪽에 있는 듯)
    var L = [], Rt = [], j;
    for (j = 0; j <= 8; j++) { var F = tfun(o, j / 8, x, z, H0, rb, rt); L.push([F.x - F.r, F.y]); Rt.push([F.x + F.r, F.y]); }
    var bg = ctx.createLinearGradient(x - rt, 0, x + rt, 0);
    bg.addColorStop(0, 'rgba(200,220,240,0)'); bg.addColorStop(0.18, 'rgba(205,225,245,0.30)'); bg.addColorStop(0.5, 'rgba(240,248,255,0.16)'); bg.addColorStop(0.82, 'rgba(205,225,245,0.30)'); bg.addColorStop(1, 'rgba(200,220,240,0)');
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = fade; ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
    for (j = 1; j < L.length; j++) ctx.lineTo(L[j][0], L[j][1]);
    for (j = Rt.length - 1; j >= 0; j--) ctx.lineTo(Rt[j][0], Rt[j][1]);
    ctx.closePath(); ctx.fill();
    // 잎 · 불티(깔때기를 따라 감겨 오름)
    o.bits.forEach(function (B) {
      var u = (B.u + now * 0.35 * B.sp) % 1, a = B.ph + now * 8 * B.sp, F = tfun(o, u, x, z, H0, rb, rt), px = F.x + Math.cos(a) * F.r * 1.05, py = F.y + Math.sin(a) * F.r * TEY;
      var al = (Math.sin(a) >= 0 ? 0.9 : 0.4) * fade * Math.min(1, u * 6, (1 - u) * 6);
      ctx.save(); ctx.translate(px, py);
      if (B.spark) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al; ctx.fillStyle = o.col2; ctx.fillRect(-1.5 * sw, -1.5 * sw, 3 * sw, 3 * sw); }
      else { ctx.rotate(B.rot + now * 11 * B.sp); ctx.globalAlpha = al; ctx.fillStyle = B.c; ctx.beginPath(); ctx.ellipse(0, 0, 3.4 * sw, 1.5 * sw, 0, 0, P2); ctx.fill(); }
      ctx.restore();
    });
    swords(true);
    streaks(true);
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

  // ---- 1차 기사 늘 켜진 기술 (2026-11-08 형님 승인, 효과 = 우리 코드): 칼날 파편 · 끌어당기는 검압 ----
  // 칼날 파편: 기사가 적을 쓰러뜨리면(main.js onHit → shardKill) 그 자리에서 칼날 조각이 사방으로 튀고 SHARD_DELAY 뒤 둘레 적을 때림.
  //   파편으로 쓰러진 적도 또 튀김 = depth(몇 번째 이어짐) 가 passive.chain 을 넘으면 안 튀김(무한 반복 없음) +
  //   SHARD_CAP = 짧은 시간(SHARD_WIN ms)에 튀는 최대 수(몹 떼를 한꺼번에 쓸 때 폰이 느려지지 않게)
  var shardFx = [], shardQ = [], shardN = 0, shardWinT = 0, pulls = [];
  var SHARD_DELAY = 70, SHARD_CAP = 8, SHARD_WIN = 250;
  function shardKill(p, t, depth) {
    var q = pasOf(p, 'shards');
    if (!q || !t || t.isProp || !t.T) return;
    depth = depth || 0;
    if (depth > (q.P.chain || 0) || shardN >= SHARD_CAP) return;
    shardN++;
    var R = (q.P.r && q.P.r[q.lv - 1]) || 80, x = t.x, z = t.y, cy = z - 40 * AS();
    shardQ.push({ t: SHARD_DELAY, x: x, z: z, R: R, depth: depth, mul: q.v, wk: p.weaponKey, P: q.P, lv: q.lv });
    var n = 7 + q.lv;   // 칼날 조각 수(Lv 마다 +1)
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2 + Math.random() * 0.5;
      shardFx.push({ x: x, cy: cy, a: a, R: R * (0.75 + Math.random() * 0.35), h: 10 + Math.random() * 22, t: 0, life: 200 + Math.random() * 60, rot: Math.random() * 6.28, vr: (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 10) });
    }
    glow(x, cy, 26 * AS() / 0.55, '#dcefff', 180, 0.55);
    debris(x, cy, z, 6, { cols: ['#ffffff', '#cfe8ff', '#8e9cb4'], glow: true, sp: 200, size: 1.3, ms: 260, spread: 2.6 });
    snd('skWave', { v: 0.5 });
  }
  // 파편이 닿음: 둘레(R, 위아래 depth) 적 모두(쓰러진 그 적은 이미 죽어서 안 맞음). 맞은 적이 쓰러지면 main.js 가 depth + 1 로 또 부름
  function shardHit(o) {
    var P = o.P, C = P._hits || (P._hits = []), h = C[o.depth];
    if (!h) { h = {}; for (var k in P.hit) if (k !== '_st') h[k] = P.hit[k]; h.shardDepth = o.depth + 1; C[o.depth] = h; }
    var st = stOf(h, { damageStyle: 'skill_knight' });
    H.targets().forEach(function (e) {
      if (!e || !H.canHit(e, h)) return;
      var hb = e.hurtbox();
      if (Math.abs(hb.z - o.z) > (P.depth || 36)) return;
      if (hb.x1 < o.x - o.R || hb.x0 > o.x + o.R) return;
      var dir = Math.abs(e.x - o.x) < 3 ? 1 : (e.x > o.x ? 1 : -1);
      H.onHit(st, e, { dir: dir, wk: o.wk, x: e.x - dir * 4 * AS(), y: e.y - 46 * AS(), mul: o.mul });
      debris(e.x, e.y - 46 * AS(), e.y, 3, { cols: ['#ffffff', '#cfe8ff'], glow: true, sp: 140, size: 1.2, ms: 200 });
    });
  }
  function shardStep(dt) {
    shardWinT += dt;
    if (shardWinT >= SHARD_WIN) { shardWinT = 0; shardN = 0; }
    for (var i = shardQ.length - 1; i >= 0; i--) {
      var o = shardQ[i]; o.t -= dt;
      if (o.t <= 0) { shardQ.splice(i, 1); (function (o) { atLv(o.lv, function () { shardHit(o); }); })(o); }
    }
    for (var j = shardFx.length - 1; j >= 0; j--) { var f = shardFx[j]; f.t += dt; f.rot += f.vr * dt / 1000; if (f.t >= f.life) shardFx.splice(j, 1); }
  }
  // 칼날 조각 그림(코드): 강철색 가는 세모 + 흰 날 + 지나온 길 꼬리. 땅 타원(위아래 납작)으로 퍼지며 살짝 포물선
  function drawShards(ctx, camX) {
    if (!shardFx.length) return;
    ctx.save(); ctx.lineCap = 'round';
    shardFx.forEach(function (f) {
      var u = ease(Math.min(1, f.t / f.life)), x = f.x + Math.cos(f.a) * f.R * u - camX, y = f.cy + Math.sin(f.a) * f.R * 0.35 * u - f.h * Math.sin(Math.PI * u);
      var u0 = ease(Math.max(0, f.t - 50) / f.life), x0 = f.x + Math.cos(f.a) * f.R * u0 - camX, y0 = f.cy + Math.sin(f.a) * f.R * 0.35 * u0 - f.h * Math.sin(Math.PI * u0);
      var al = f.t > f.life * 0.75 ? (f.life - f.t) / (f.life * 0.25) : 1;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * al; ctx.strokeStyle = '#a8d4ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = al;
      ctx.save(); ctx.translate(x, y); ctx.rotate(f.rot);
      ctx.fillStyle = '#55607a'; ctx.beginPath(); ctx.moveTo(-5, 1.6); ctx.lineTo(6, 0); ctx.lineTo(-5, -1.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8f0ff'; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(6, 0); ctx.lineTo(-4, -1.4); ctx.closePath(); ctx.fill();
      ctx.restore();
    });
    ctx.restore();
  }
  // 끌어당기는 검압: 평타 콤보 마무리 타를 시작할 때(main.js → comboPull) 둘레 잡몹을 기사 앞(front)으로 ms 동안 끌어옴.
  //   마무리 타가 맞기 전에 도착 → 마무리 타의 휘청(ai.react.finisherStagger)은 그대로 맞고, 그 뒤 앞에 모여 있어 띄우기 · 기술로 이어 감.
  //   끌려오는 도중 맞아서 움찔(hit)하면 그 자리에서 끌기를 멈춤(밀려나는 힘을 덮어쓰지 않게). 보스 · 중간보스 · 소품 · 누운 · 뜬 적은 안 끌림
  function comboPull(p) {
    var q = pasOf(p, 'pressure');
    if (!q || !p) return false;
    var R = q.v, P = q.P, n = 0;
    H.targets().forEach(function (t) {
      if (!t || t.isProp || !t.T || t.T.boss || t.mid || (t.alive && !t.alive())) return;
      if (t.state === 'down' || t.state === 'air' || t.state === 'dead' || (t.flyZ && t.flyZ() > 2)) return;
      var dx = t.x - p.x, dz = t.y - p.y, ahead = dx * p.dir;
      if (Math.abs(dx) > R || Math.abs(dz) > R * 0.45) return;
      if (ahead > 10 && ahead <= P.front + 18 && Math.abs(dz) < 12) return;   // 이미 앞에 있음
      var tx = p.x + p.dir * (P.front + (n % 3) * 9), ty = p.y + clamp(dz, -14, 14) * 0.5;
      pulls.push({ e: t, x0: t.x, y0: t.y, tx: tx, ty: ty, t: 0, life: P.ms || 110, s0: t.state, done: false });
      n++;
    });
    // 안으로 모이는 바람 고리(땅 + 몸 높이) + 끌려오는 쪽에서 들어오는 바람 불티
    var cx = p.x + p.dir * P.front * 0.5;
    wave(cx, p.y, 10, { r0: R, flat: 0.3, w: 3, ms: 220, color: '#e8f4ff', glow: '#7fb8ff', ground: true, noMax: true });
    wave(cx, p.y - 52 * AS(), 8, { r0: R * 0.7, flat: 0.8, w: 2, ms: 200, color: '#ffffff', glow: '#9cc8ff', noMax: true });
    [-1, 1].forEach(function (sd) { debris(p.x + sd * R * 0.8, p.y - 40 * AS(), p.y, 3, { cols: ['#ffffff', '#cfe8ff'], glow: true, sp: 120, size: 1.2, ms: 220, spread: 0.6 }); });
    return n;
  }
  function pullStep(dt) {
    for (var i = pulls.length - 1; i >= 0; i--) {
      var o = pulls[i], e = o.e;
      o.t += dt;
      if (!o.done) {
        if (!e || (e.alive && !e.alive()) || (e.state === 'hit' && o.s0 !== 'hit' && o.t > 0) || e.state === 'down' || e.state === 'air') o.done = true;
        else {
          var u = ease(Math.min(1, o.t / o.life));
          e.x = o.x0 + (o.tx - o.x0) * u; e.y = o.y0 + (o.ty - o.y0) * u;
          if (o.t >= o.life) o.done = true;
        }
      }
      if (o.t >= o.life + 120) pulls.splice(i, 1);
    }
  }
  // 끌려오는 적 뒤로 남는 바람 줄(처음 자리 → 지금 자리)
  function drawPulls(ctx, camX) {
    pulls.forEach(function (o) {
      var e = o.e; if (!e) return;
      var a = o.t < o.life ? 0.7 : Math.max(0, 0.7 * (1 - (o.t - o.life) / 120)), y = o.y0 - 44 * AS(), y1 = e.y - 44 * AS();
      if (a <= 0) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      [[6, '#7fb8ff', 0.35], [2, '#ffffff', 0.8]].forEach(function (L) {
        ctx.globalAlpha = a * L[2]; ctx.strokeStyle = L[1]; ctx.lineWidth = L[0];
        ctx.beginPath(); ctx.moveTo(o.x0 - camX, y); ctx.lineTo(e.x - camX, y1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(o.x0 - camX, y - 14); ctx.lineTo(e.x - camX, y1 - 14); ctx.stroke();
      });
      ctx.restore();
    });
  }

  // ---- 성기사(2차 전직) 기술 (2026-11-08 형님 승인, 효과 = 전부 우리 코드) ----
  var GOLD = ['#ffffff', '#fff6c8', '#ffd23f', '#ffb030'];
  // 기술 Lv 별 배율(config grow: size · glow · hitstop · shake, 검기 날리기와 같은 방식). 없는 값 = 1
  function growK(d, lv) { var GW = d.grow, gi = clamp((lv || 1) - 1, 0, 4); return function (n) { return GW && GW[n] && GW[n][gi] != null ? GW[n][gi] : 1; }; }
  // 판정 값에 Lv 별 멈춤 · 흔들림 배율을 곱한 것(Lv 마다 한 번만 만들어 둠, key = 판정마다 따로 기억)
  function growHit(d, h, lv, key) {
    if (!d.grow) return h;
    var gi = clamp((lv || 1) - 1, 0, 4), gk = growK(d, lv), C = d['_g' + key] || (d['_g' + key] = []);
    if (!C[gi]) { var o = {}, n; for (n in h) if (n !== '_st') o[n] = h[n]; o.hitstop = (h.hitstop != null ? h.hitstop : 1) * gk('hitstop'); o.shake = (h.shake != null ? h.shake : 1) * gk('shake'); C[gi] = o; }
    return C[gi];
  }
  // 심판의 십자: 칼이 땅에 꽂히는 순간 앞 땅에 십자를 새김(그 자리 고정) → telegraphMs 뒤 터짐(crossStep). 기사가 다른 걸 해도 그대로 터짐
  //   k = 크기(기술 Lv 크기 area x grow.size) → 십자 길이 · 판정 같이 커짐
  function castCross(p, d, s) {
    var C = d.cross, lv = s.L.lv || 1, gk = growK(d, lv), k = s.area * gk('size');
    crosses.push({ x: p.x + p.dir * C.x * Math.sqrt(k), z: p.y, dir: p.dir, t: 0, C: C, d: d, k: k, L: C.len * k, A: C.arm * k, D: C.depth * k,
                   gl: gk('glow'), sh: gk('shake'), hit: growHit(d, C.hit, lv, 'cross'), again: (s.L.lv5 && s.L.lv5.again) || 0, againDone: false,
                   boom: false, bt: 0, ticks: 0, moteT: 0, wk: p.weaponKey, mul: s.mul, lv: curLv, seed: Math.random() * 100 });
    snd('holyBolt');
    FX.shake(CFG.juice.shakePx * 0.9, CFG.juice.shakeMs);
    var hx = p.x + p.dir * 30 * AS();
    glow(hx, p.y - 8 * AS(), 40 * AS() / 0.55, '#ffe9a0', 260, 0.7);
    debris(hx, p.y - 4 * AS(), p.y, 8, { cols: GOLD, glow: true, sp: 160, size: 1.4, ms: 360, spread: 1.2 });
  }
  var CROSS_AGAIN_MS = 360;   // Lv5: 첫 터짐 뒤 이만큼 있다가 한 번 더 솟음
  function crossStep(dt) {
    for (var i = crosses.length - 1; i >= 0; i--) {
      var o = crosses[i];
      o.t += dt;
      crossTick(o, dt);
      if (o.t >= o.C.telegraphMs + 900 + (o.again ? CROSS_AGAIN_MS : 0)) crosses.splice(i, 1);
    }
  }
  function crossTick(o, dt) {
    atLv(o.lv, function () {
      var C = o.C, T = C.telegraphMs;
      if (!o.boom) {   // 새겨진 동안: 십자 줄에서 금빛 불티가 조금씩 오름(곧 터진다는 표시)
        o.moteT -= dt;
        if (o.moteT <= 0) {
          o.moteT = 45;
          var u = Math.random() * 2 - 1;
          debris(o.x + u * o.L, o.z - 2, o.z, 1, { cols: GOLD, glow: true, sp: 60, size: 1.3, ms: 380, g: -200, spread: 0.3 });
        }
      }
      if (!o.boom && o.t >= T) { o.boom = true; o.bt = o.t; crossBoom(o, 1, true); }
      if (o.boom) {
        while (o.ticks < C.ticks && o.t >= T + C.tickMs * (o.ticks + 1)) {   // 남은 빛이 작게 더 때림
          o.ticks++;
          crossHitAll(o, C.tick, 1);
          glow(o.x, o.z - 50 * AS(), o.L * 0.5, '#ffe9a0', 200, 0.3 * o.gl);
        }
        if (o.again && !o.againDone && o.t >= T + CROSS_AGAIN_MS) { o.againDone = true; o.bt2 = o.t; crossBoom(o, o.again, false); }
      }
    });
  }
  // 십자 둘레 사각(가로 ±L, 위아래 ±D) 안의 적 모두. mulK = 데미지 배율(Lv5 두 번째 솟음 = 0.6)
  function crossHitAll(o, h, mulK) {
    var st = stOf(h, o.d), any = false;
    H.targets().forEach(function (t) {
      if (!t || !H.canHit(t, h)) return;
      var hb = t.hurtbox();
      if (Math.abs(hb.z - o.z) > o.D) return;
      if (hb.x1 < o.x - o.L || hb.x0 > o.x + o.L) return;
      var dir = Math.abs(t.x - o.x) < 3 ? o.dir : (t.x > o.x ? 1 : -1);
      H.onHit(st, t, { dir: dir, wk: o.wk, x: t.x, y: t.y - 50 * AS(), mul: o.mul * mulK });
      any = true;
    });
    return any;
  }
  // 터짐: 땅 충격파(십자 길이만큼) + 큰 금빛 + 십자 줄 따라 위로 솟는 불티 + 멈춤 · 흔들림 · 번쩍
  function crossBoom(o, mulK, first) {
    var h = o.hit, gl = o.gl * (first ? 1 : 0.75);
    snd('skSlam'); snd('holyBolt');
    H.hitstop(first ? 90 : 60);
    FX.shake(CFG.juice.shakePx * 3 * o.sh * (first ? 1 : 0.7), CFG.juice.shakeMs * 1.8);
    H.dust(o.x - o.L * 0.8, o.z, -1); H.dust(o.x + o.L * 0.8, o.z, 1);
    glow(o.x, o.z - 50 * AS(), o.L * 0.75, '#ffe9a0', 420, Math.min(0.7, 0.42 * gl));
    glow(o.x + o.dir * o.L * 0.35, o.z - 30 * AS(), o.A * 1.6, '#ffffff', 240, 0.7);
    wave(o.x, o.z, o.L * 1.1, { flat: 0.3, w: 5, ms: 480, color: '#fff6c8', glow: '#ffc030', ground: true });
    wave(o.x + o.dir * o.L * 0.35, o.z, o.A * 2.2, { flat: 0.3, w: 4, ms: 340, color: '#ffffff', glow: '#ffd23f', ground: true });
    if (first) wave(o.x, o.z - 60 * AS(), o.L * 0.7, { flat: 0.8, w: 4, ms: 360, color: '#ffffff', glow: '#ffd23f' });
    for (var j = -3; j <= 3; j++)   // 긴 줄 따라 위로 솟는 불티
      debris(o.x + j * o.L / 3.2, o.z - 4, o.z, first ? 4 : 2, { cols: GOLD, glow: true, sp: 320, size: 1.6, ms: 520, spread: 0.3, g: 160 });
    debris(o.x + o.dir * o.L * 0.35, o.z - 4, o.z, first ? 8 : 4, { cols: GOLD, glow: true, sp: 260, size: 1.6, ms: 480, spread: 0.5, g: 160 });
    debris(o.x, o.z - 2, o.z, first ? 10 : 4, { cols: ['#6a5a4a', '#8a7258', '#4a3e32'], sp: 200, size: 2.4, ms: 700 });
    if (h.flash) doFlash(first ? h.flash : { color: h.flash.color, alpha: h.flash.alpha * 0.6, ms: h.flash.ms });
    if (crossHitAll(o, h, mulK) && h.slowMs && first) H.slow(h.slowMs);
  }
  // 십자 모양 점들(세계 자리): 긴 줄(가로) + 가로대(앞쪽 35% 자리에서 위아래로, 살짝 비스듬 = 땅에 누운 느낌)
  function crossPts(o) {
    var cx = o.x + o.dir * o.L * 0.35, sl = o.A * 0.3;
    return { l0: [o.x - o.L, o.z], l1: [o.x + o.L, o.z], b0: [cx + sl, o.z - o.A], b1: [cx - sl, o.z + o.A], c: [cx, o.z] };
  }
  // 땅에 새겨진 십자(캐릭터 밑): 새길 때 가운데에서 바깥으로 그어짐 → 터지기 직전 깜빡이며 밝아짐 → 터진 뒤 사라짐
  function drawCrossMarks(ctx, camX) {
    crosses.forEach(function (o) {
      var T = o.C.telegraphMs, e = ease(clamp(o.t / 160, 0, 1)), P = crossPts(o);
      var a = o.boom ? Math.max(0, 1 - (o.t - o.bt) / 520) : 0.75 + 0.25 * (Math.floor(o.t / 60) % 2) * clamp((o.t - T * 0.5) / (T * 0.5), 0, 1);
      if (a <= 0) return;
      var hot = o.boom ? 1 : clamp(o.t / T, 0, 1);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      function seg(p0, p1, u) {   // 가운데에서 p0 · p1 쪽으로 u 만큼 그음
        var m = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
        ctx.beginPath();
        ctx.moveTo(m[0] + (p0[0] - m[0]) * u - camX, m[1] + (p0[1] - m[1]) * u);
        ctx.lineTo(m[0] + (p1[0] - m[0]) * u - camX, m[1] + (p1[1] - m[1]) * u);
        ctx.stroke();
      }
      [[10, '#ffb030', 0.32], [5, '#ffe9a0', 0.7], [2, '#ffffff', 0.95]].forEach(function (L) {   // 바깥 빛 → 금 → 흰 심
        ctx.globalAlpha = L[2] * a; ctx.strokeStyle = L[1]; ctx.lineWidth = L[0] * Math.sqrt(o.k) * (0.8 + 0.4 * hot);
        seg(P.l0, P.l1, e); seg(P.b0, P.b1, e);
      });
      // 가로대 둘레 성스러운 고리 + 도는 룬 눈금
      var R = o.A * 1.35 * e, cx = P.c[0] - camX, cz = P.c[1];
      ctx.globalAlpha = 0.6 * a; ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(cx, cz, R * 1.15, R * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.35 * a;
      ctx.beginPath(); ctx.ellipse(cx, cz, R * 0.8, R * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fff6c8'; ctx.globalAlpha = 0.85 * a;
      for (var i = 0; i < 10; i++) { var an = o.t / 260 + i * Math.PI / 5; ctx.fillRect(cx + Math.cos(an) * R * 0.98 - 1, cz + Math.sin(an) * R * 0.36 - 1, 2.5, 2); }
      // 바닥 빛(십자 길이만큼 납작하게)
      ctx.save(); ctx.translate(o.x - camX, o.z); ctx.scale(1, 0.22);
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, o.L);
      g.addColorStop(0, 'rgba(255,233,160,' + (0.35 * a * (0.5 + 0.5 * hot)).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,180,40,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(-o.L, -o.L, o.L * 2, o.L * 2); ctx.restore();
      ctx.restore();
    });
  }
  // 터질 때 십자 줄 따라 위로 솟는 금빛 빛기둥(캐릭터 위, 더하기 빛): 아래 밝고 위로 사라짐, 솟음(110ms) → 버팀 → 가늘어지며 사라짐
  function drawCrossBeams(ctx, camX) {
    crosses.forEach(function (o) {
      if (!o.boom) return;
      [[o.bt, 1], [o.bt2, 0.75]].forEach(function (B) {
        if (B[0] == null) return;
        var bt = o.t - B[0], life = 640;
        if (bt < 0 || bt > life) return;
        var rise = ease(clamp(bt / 110, 0, 1)), fade = bt > life * 0.4 ? 1 - (bt - life * 0.4) / (life * 0.6) : 1, P = crossPts(o);
        var Hh = 175 * Math.sqrt(o.k) * B[1] * rise, w0 = 9 * Math.sqrt(o.k) * (1.2 - 0.5 * (1 - fade));
        function rnd(i) { var v = Math.sin(o.seed + i * 12.9898) * 43758.5453; return v - Math.floor(v); }
        function beam(x, z, w, h, i) {
          var hh = h * (0.7 + 0.3 * rnd(i)), g = ctx.createLinearGradient(0, z - hh, 0, z);
          g.addColorStop(0, 'rgba(255,220,120,0)'); g.addColorStop(0.55, 'rgba(255,233,160,' + (0.45 * fade).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,255,240,' + (0.9 * fade).toFixed(3) + ')');
          ctx.fillStyle = g; ctx.fillRect(x - camX - w / 2, z - hh, w, hh);
        }
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        var n = 9, k;
        for (k = 0; k <= n; k++) { var u = k / n; beam(P.l0[0] + (P.l1[0] - P.l0[0]) * u, o.z, w0 * (0.8 + 0.4 * rnd(k + 30)), Hh * (0.75 + 0.25 * Math.sin(Math.PI * u)), k); }
        for (k = 0; k <= 4; k++) { var v = k / 4; beam(P.b0[0] + (P.b1[0] - P.b0[0]) * v, P.b0[1] + (P.b1[1] - P.b0[1]) * v, w0 * 0.9, Hh * 0.85, k + 50); }
        beam(P.c[0], P.c[1], w0 * 3, Hh * 1.15, 99);   // 가운데(가로대 만나는 곳) 굵은 빛
        ctx.restore();
      });
    });
  }

  // 성스러운 돌격: 돌진(move) 하는 동안 앞 상자(reach) 안 잡몹을 기사 앞(front)에 붙여 밀고 감 + tickMs 마다 작게 때림(보스 · 중간보스 · 소품은 안 밂, 때리기만)
  //   burst.at 에 앞쪽에서 크게 터짐(chargeBurst)
  function chargeStep(p, d, s, t0, t1) {
    var C = d.charge, m = d.move, B = C.burst, k = s.area;
    if (t1 >= m.from && t0 <= m.to + 40) {
      var xa = p.x + p.dir * C.reach.x0 * k, xb = p.x + p.dir * C.reach.x1 * k, lo = Math.min(xa, xb), hi = Math.max(xa, xb), fx = p.x + p.dir * C.front * k;
      s.chT = (s.chT || 0) - (t1 - t0);
      var tick = s.chT <= 0, st = stOf(C.tick, d), f = Math.min(1, 6 * (t1 - t0) / 1000);
      if (tick) s.chT = C.tickMs;
      H.targets().forEach(function (t) {
        if (!t || (t.alive && !t.alive())) return;
        if (Math.abs(t.y - p.y) > C.reach.depth * k) return;
        var hb = t.hurtbox();
        if (hb.x1 < lo || hb.x0 > hi) return;
        if (!t.isProp && t.T && !t.T.boss && !t.mid && t.state !== 'down') {
          if ((t.x - fx) * p.dir < 0) t.x = fx;   // 기사 앞에 붙여 밂(앞에 모임)
          t.y += (p.y - t.y) * f;                 // 위아래도 기사 줄로 조금씩 모음
        }
        if (tick && H.canHit(t, C.tick)) H.onHit(st, t, { dir: p.dir, wk: p.weaponKey, x: t.x - p.dir * 10 * AS(), y: t.y - 50 * AS(), mul: s.mul });
      });
      if (tick) {
        glow(fx, p.y - 50 * AS(), 30 * AS() / 0.55, '#ffe9a0', 160, 0.45);
        debris(fx, p.y - 50 * AS(), p.y, 3, { cols: GOLD, glow: true, sp: 150, size: 1.3, ms: 260, spread: 1.2 });
      }
    }
    if (!s.chBurst && t1 >= B.at) { s.chBurst = true; chargeBurst(p, d, s); }
  }
  function chargeBurst(p, d, s) {
    var B = d.charge.burst, k = s.area, x = p.x + p.dir * B.x * k, z = p.y, R = B.r * k, h = B.hit, st = stOf(h, d), any = false;
    snd('skSlam'); snd('holyBolt');
    H.hitstop(90);
    FX.shake(CFG.juice.shakePx * 3.2, CFG.juice.shakeMs * 1.8);
    H.dust(x - 14 * AS(), z, -1); H.dust(x + 14 * AS(), z, 1);
    glow(x, z - 50 * AS(), R * 0.9, '#fff2c0', 380, 0.85);
    glow(x, z - 50 * AS(), R * 0.4, '#ffffff', 200, 0.7);
    wave(x, z, R * 1.3, { flat: 0.3, w: 5, ms: 440, color: '#fff6c8', glow: '#ffc030', ground: true });
    wave(x, z - 55 * AS(), R * 0.9, { flat: 0.85, w: 4, ms: 320, color: '#ffffff', glow: '#ffd23f' });
    debris(x, z - 50 * AS(), z, 24, { cols: GOLD, glow: true, sp: 300, size: 1.7, ms: 520, spread: 1.6 });
    H.targets().forEach(function (t) {
      if (!t || !H.canHit(t, h)) return;
      var hb = t.hurtbox();
      if (Math.abs(hb.z - z) > B.depth * k) return;
      if (hb.x1 < x - R || hb.x0 > x + R) return;
      var dir = (t.x - p.x) * p.dir < -4 ? -p.dir : p.dir;   // 앞으로 날려 버림(기사 뒤에 있는 적만 뒤로)
      H.onHit(st, t, { dir: dir, wk: p.weaponKey, x: t.x - dir * 6 * AS(), y: z - 50 * AS(), mul: s.mul });
      any = true;
    });
    if (h.flash) doFlash(h.flash);
    if (any && h.slowMs) H.slow(h.slowMs);
  }
  // 금빛 방패(돌진하는 동안, 캐릭터 위 더하기 빛): 몸을 감싼 타원 + 돌아가는 세로 줄(구처럼 보임) + 앞쪽 밝은 활(밀고 가는 쪽)
  function drawBarrier(ctx, camX) {
    var p = H.player && H.player();
    if (!p || !barrierOn(p)) return;
    var s = p.sk, B = s.d.barrier, a = clamp(Math.min((s.t - B.from) / 80, (B.to - s.t) / 100), 0, 1), now = s.t / 1000;
    var x = p.x - camX, y = p.y - (p.z || 0) - 48 * AS(), rx = 40 * AS(), ry = 56 * AS(), P2 = Math.PI * 2;   // 몸 가운데 둘레(몸 크기 = actorScale)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(x, y, rx * 0.4, x, y, ry);
    g.addColorStop(0, 'rgba(255,220,120,0)'); g.addColorStop(0.8, 'rgba(255,225,140,' + (0.3 * a).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,190,60,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, P2); ctx.fill();
    ctx.strokeStyle = '#fff2b0'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.85 * a;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, P2); ctx.stroke();
    ctx.lineWidth = 1; ctx.globalAlpha = 0.4 * a;
    for (var i = 0; i < 3; i++) { var c = Math.cos(now * 9 + i * 2.1); ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx * c) + 0.5, ry, 0, 0, P2); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry * 0.25, 0, 0, P2); ctx.stroke();
    ctx.globalAlpha = 0.9 * a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.lineCap = 'round';   // 앞쪽 활
    var a0 = p.dir > 0 ? -0.9 : Math.PI - 0.9;
    ctx.beginPath(); ctx.ellipse(x, y, rx + 3, ry + 2, 0, a0, a0 + 1.8); ctx.stroke();
    ctx.globalAlpha = 0.45 * a; ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.ellipse(x, y, rx + 3, ry + 2, 0, a0, a0 + 1.8); ctx.stroke();
    ctx.restore();
  }
  // 신성 가호(늘 켜진 기술) — 2026-11-08 다시 그림: 예전 것은 밝은 숲 땅에서 거의 안 보였음
  //   뒤(캐릭터 그리기 전, drawAegis): 몸 모양 금빛 후광(숨쉬듯 = 몸 가장자리가 은은히 빛나는 테두리처럼 보임) + 발밑 바닥 빛 + 금빛 고리 뒤쪽 반
  //   앞(캐릭터 그린 뒤, drawAegisFront): 금빛 고리 앞쪽 반 + 발밑에서 머리 위로 천천히 오르는 금빛 반짝이
  //   전부 'lighter'(더하기 빛, 다른 성스러운 효과와 같음). 몸 한가운데는 안 덮음. Lv 1~5 마다 진하기 · 반짝이 수 · 고리 눈금이 늘어남
  var AP2 = Math.PI * 2;
  function aegisK(q) { return 0.62 + 0.095 * q.lv; }   // Lv1 0.72 … Lv5 1.1
  function aegisRing(ctx, x, y, rx, ry, a0, a1, k, br, s) {   // 고리 한 토막(a0~a1): 넓고 옅은 빛 + 가는 밝은 심
    ctx.strokeStyle = '#ffc93a'; ctx.globalAlpha = Math.min(1, 0.32 * k * br); ctx.lineWidth = 4.5 * s;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, a0, a1); ctx.stroke();
    ctx.strokeStyle = '#fff1a8'; ctx.globalAlpha = Math.min(1, 0.85 * k * br); ctx.lineWidth = 1.3 * s;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, a0, a1); ctx.stroke();
  }
  function drawAegis(ctx, camX, p) {
    var q = pasOf(p, 'aegis');
    if (!q || p.state === 'dead' || hidden(p)) return;
    var now = performance.now() / 1000, s = AS() / 0.55, k = aegisK(q), br = 0.8 + 0.2 * Math.sin(now * 2.6);
    var x = p.x - camX, by = p.y - (p.z || 0) - 46 * AS(), gy = p.y;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    // 몸 후광: 세로로 긴 타원(몸 모양). 가운데는 캐릭터가 가리고 가장자리만 금빛 테두리처럼 남음
    ctx.save(); ctx.translate(x, by); ctx.scale(1, 1.75);
    var R = 33 * s * (0.97 + 0.03 * br), g = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
    g.addColorStop(0, 'rgba(255,240,180,' + (0.5 * k * br).toFixed(3) + ')');
    g.addColorStop(0.55, 'rgba(255,215,90,' + (0.3 * k * br).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,190,50,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, AP2); ctx.fill();
    ctx.restore();
    // 발밑 바닥 빛(납작한 원)
    ctx.save(); ctx.translate(x, gy); ctx.scale(1, 0.3);
    var F = 44 * s, f = ctx.createRadialGradient(0, 0, 0, 0, 0, F);
    f.addColorStop(0, 'rgba(255,232,150,' + (0.55 * k * br).toFixed(3) + ')'); f.addColorStop(0.6, 'rgba(255,200,70,' + (0.22 * k * br).toFixed(3) + ')'); f.addColorStop(1, 'rgba(255,190,60,0)');
    ctx.fillStyle = f; ctx.beginPath(); ctx.arc(0, 0, F, 0, AP2); ctx.fill();
    ctx.restore();
    // 금빛 고리 뒤쪽 반(발 뒤) + Lv 마다 늘어나는 눈금(천천히 돎, 뒤쪽 것만)
    var rx = 34 * s * (0.97 + 0.03 * br), ry = rx * 0.28;
    aegisRing(ctx, x, gy, rx, ry, Math.PI, AP2, k, br, s);
    aegisTicks(ctx, x, gy, rx, ry, q.lv, now, true, k, s);
    ctx.restore();
  }
  function aegisTicks(ctx, x, y, rx, ry, lv, now, back, k, s) {   // 고리 위 작은 빛 눈금(Lv+2 개)
    var n = lv + 2;
    ctx.fillStyle = '#fff6c8';
    for (var i = 0; i < n; i++) {
      var an = now * 0.7 + i * AP2 / n, sn = Math.sin(an);
      if ((sn < 0) !== back) continue;
      ctx.globalAlpha = Math.min(1, (back ? 0.55 : 0.95) * k);
      var px = x + Math.cos(an) * rx, py = y + sn * ry;
      ctx.fillRect(px - 1.2 * s, py - 1.2 * s, 2.4 * s, 2.4 * s);
    }
  }
  function drawAegisFront(ctx, camX, p) {
    var q = pasOf(p, 'aegis');
    if (!q || p.state === 'dead' || hidden(p)) return;
    var now = performance.now() / 1000, s = AS() / 0.55, k = aegisK(q), br = 0.8 + 0.2 * Math.sin(now * 2.6);
    var x = p.x - camX, gy = p.y, z = p.z || 0, rx = 34 * s * (0.97 + 0.03 * br), ry = rx * 0.28;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    aegisRing(ctx, x, gy, rx, ry, 0, Math.PI, k * 0.9, br, s);   // 고리 앞쪽 반(발 앞, 조금 옅게 = 발을 안 가림)
    aegisTicks(ctx, x, gy, rx, ry, q.lv, now, false, k, s);
    // 오르는 반짝이: 3+Lv 개, 저마다 다른 때 · 자리에서 발밑 → 머리 위로(좌우로 살짝 흔들림), 처음 · 끝은 흐리게
    var n = 3 + q.lv;
    for (var i = 0; i < n; i++) {
      var T = 1.9 + (i % 3) * 0.35, t = ((now + i * 0.618 * T) % T) / T;
      var side = i % 2 ? 1 : -1, ox = side * (14 + ((i * 7) % 13)) * s + Math.sin(now * 2 + i) * 3 * s;
      var py = gy - z - (4 + t * 92) * s, fa = Math.sin(t * Math.PI) * k;
      var c = 1.2 * s * (0.7 + 0.3 * Math.sin(now * 9 + i * 2));
      ctx.globalAlpha = Math.min(1, 0.95 * fa); ctx.fillStyle = '#fff8d8';
      ctx.fillRect(x + ox - c, py - c, c * 2, c * 2);
      ctx.globalAlpha = Math.min(1, 0.55 * fa); ctx.fillStyle = '#ffd23f';   // 십자 반짝
      ctx.fillRect(x + ox - c * 2.6, py - 0.5 * s, c * 5.2, 1 * s); ctx.fillRect(x + ox - 0.5 * s, py - c * 2.6, 1 * s, c * 5.2);
    }
    ctx.restore();
  }
  // 신성 가호 불티: 가끔 몸 둘레에서 작은 금빛 점이 천천히 위로 오름
  function aegisStep(p, dt) {
    if (!p || p.state === 'dead' || !pasOf(p, 'aegis')) return;
    aegisT -= dt;
    if (aegisT > 0) return;
    aegisT = 260 + Math.random() * 200;
    debris(p.x + (Math.random() * 2 - 1) * 18 * AS(), p.y - (p.z || 0) - (10 + Math.random() * 70) * AS(), p.y, 1,
           { cols: ['#fff6c8', '#ffd23f'], glow: true, sp: 20, size: 1.2, ms: 700, g: -50, spread: 0.6 });
  }

  // ======== 법사 기술 다시 짜기 (2026-11-08 형님 승인, 효과 = 전부 우리 코드) ========
  //   1차: 원소 파편(늘 켜짐) · 중력 구체 · 마력 소용돌이(늘 켜짐) / 대마법사(2차): 원소 연쇄(늘 켜짐) · 빙결 폭풍 · 천둥 심판
  //   gravs = 중력 구체, eshFx = 날아가는 원소 조각, vortexes = 마력 소용돌이, chainQ = 원소 연쇄 터짐 대기, frosts = 빙결 폭풍,
  //   judges = 천둥 심판 큰 번개 기둥(그림), jbolts = 천둥 심판 둘레 번개 대기
  var gravs = [], eshFx = [], eshT = 0, eshFlip = 0, vortexes = [], vortexT = 0, chainQ = [], chainN = 0, chainWinT = 0, frosts = [], judges = [], jbolts = [], cragRows = [], crags = [];
  var NOSTYLE = { damageStyle: undefined }, ARC = { damageStyle: 'skill_arcane' }, FIRE = { damageStyle: 'skill_fire' };
  var PURPLE = ['#ffffff', '#f0d8ff', '#c890ff', '#8a4ae0'], ICEC = ['#ffffff', '#e8fbff', '#a8ecff', '#5ac8f0'];
  // 끌려오는 적인가: 잡몹만(보스 · 중간보스 · 레이드 보스 · 소품 · 허수아비 빼고), 살아 있음
  function pullable(t) { return !!(t && !t.isProp && t.T && !t.T.boss && !t.mid && !t.raid && (!t.alive || t.alive())); }
  // 가운데(cx, cz)로 끌어당김: K = 세기(1초에 남은 거리의 몇 배씩 줄어듦, 7 이면 0.3초에 약 88%), minD 안쪽은 그대로(몸끼리 밀어내기가 퍼뜨림)
  function pullTo(t, cx, cz, K, dt, minD) {
    var f = 1 - Math.exp(-K * dt / 1000), dx = cx - t.x, dz = cz - t.y;
    if (Math.abs(dx) > minD) t.x += dx * f;
    if (Math.abs(dz) > minD * 0.5) t.y += dz * f;
  }
  // 끌리는 동안 어질(아주 잠깐 느려짐 = 끌려오며 공격을 못 함). 얼음창 · 빙결로 이미 더 오래 느려졌으면 그대로
  function daze(t, ms, k) { if (!(t.slowT > ms)) { t.slowT = ms; t.slowK = k; t.slowDaze = true; } }   // slowDaze = 얼음 고리(drawSlowed) 안 그림
  function inBox(t, x, z, R, D) { var hb = t.hurtbox(); return Math.abs(hb.z - z) <= D && hb.x1 >= x - R && hb.x0 <= x + R; }

  // ---- 원소 파편(1차 Lv15, 늘 켜짐) ----
  // 법사 마법이 맞으면(main.js onHit → eshardHit, 지팡이 · 완드 타 · 마법탄 · 터짐 · 기술 모두) 맞은 자리에서 불(홀수 번째) · 얼음(짝수 번째) 조각이 튀어
  //   둘레(r, 위아래 depth)의 다른 적 n 마리에게 날아가 꽂힘. 둘레에 다른 적이 없으면 맞은 적에게 한 조각(혼자 남은 적도 조금 더 아픔).
  //   icdMs(0.28초)에 한 번까지 = 몹 떼에 기술이 한꺼번에 맞아도 한 번. 조각에 맞은 것은 또 안 튐(st.eshard)
  function eshardHit(p, t, st) {
    var q = pasOf(p, 'eshard');
    if (!q || !t || t.isProp || (st && st.eshard) || eshT > 0) return;
    var P = q.P, i = q.lv - 1, R = P.r[i], n = P.n[i], x0 = t.x, z0 = t.y, y0 = t.y - (t.T ? t.T.height * 0.55 : 40 * AS()), list = [];
    eshT = P.icdMs || 280;
    var fire = (eshFlip = 1 - eshFlip) === 1;
    H.targets().forEach(function (e) {
      if (!e || e === t || e.isProp || (e.alive && !e.alive()) || !H.canHit(e, P.hit)) return;
      var dx = e.x - x0, dz = e.y - z0;
      if (Math.abs(dz) > P.depth || Math.abs(dx) > R) return;
      list.push({ e: e, d: Math.abs(dx) + Math.abs(dz) * 1.5 });
    });
    list.sort(function (a, b) { return a.d - b.d; });
    list = list.slice(0, n).map(function (o) { return o.e; });
    if (!list.length && (!t.alive || t.alive())) list = [t];
    list.forEach(function (e, k) {
      eshFx.push({ x0: x0, y0: y0, e: e, t: -k * 30, life: 150 + Math.random() * 40, fire: fire, mul: q.v, wk: p.weaponKey, P: P, lv: q.lv,
                   arc: 10 + Math.random() * 14, rot: Math.random() * 6.28, done: false });
    });
    glow(x0, y0, 16 * AS() / 0.55, fire ? '#ffb050' : '#bff4ff', 150, 0.55);
    debris(x0, y0, z0, 4, { cols: fire ? ['#fff4d0', '#ffb040', '#ff5a1e'] : ICEC, glow: true, sp: 150, size: 1.2, ms: 240, spread: 2.4 });
  }
  function eshardStep(dt) {
    if (eshT > 0) eshT -= dt;
    for (var i = eshFx.length - 1; i >= 0; i--) {
      var f = eshFx[i]; f.t += dt; f.rot += 18 * dt / 1000;
      if (!f.done && f.t >= f.life) {
        f.done = true;
        var e = f.e;
        if (e && (!e.alive || e.alive()) && H.canHit(e, f.P.hit)) {
          var dir = e.x >= f.x0 ? 1 : -1;
          atLv(f.lv, function () {
            H.onHit(stOf(f.P.hit, NOSTYLE), e, { dir: dir, wk: f.wk, x: e.x - dir * 4 * AS(), y: e.y - 40 * AS(), mul: f.mul });
            glow(e.x, e.y - 40 * AS(), 12 * AS() / 0.55, f.fire ? '#ff9a3a' : '#9fe8ff', 130, 0.6);
            debris(e.x, e.y - 40 * AS(), e.y, 3, { cols: f.fire ? ['#fff4d0', '#ff8a2a'] : ['#ffffff', '#9fe8ff'], glow: true, sp: 130, size: 1.1, ms: 200 });
          });
        }
      }
      if (f.t >= f.life + 60) eshFx.splice(i, 1);
    }
  }
  // 날아가는 조각: 불 = 주황 마름모 + 불꼬리 / 얼음 = 하늘색 가는 조각 + 흰 꼬리. 맞은 자리 → 다른 적 몸 가운데로 살짝 포물선
  function eshPos(f, u) {
    var e = f.e, x1 = e ? e.x : f.x0, y1 = e ? e.y - (e.T ? e.T.height * 0.5 : 40 * AS()) : f.y0;
    return { x: f.x0 + (x1 - f.x0) * u, y: f.y0 + (y1 - f.y0) * u - f.arc * Math.sin(Math.PI * u) };
  }
  function drawEshards(ctx, camX) {
    if (!eshFx.length) return;
    ctx.save(); ctx.lineCap = 'round';
    eshFx.forEach(function (f) {
      if (f.t < 0 || f.done) return;
      var u = ease(clamp(f.t / f.life, 0, 1)), q = eshPos(f, u), q0 = eshPos(f, ease(clamp((f.t - 45) / f.life, 0, 1))), x = q.x - camX, y = q.y;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6;
      ctx.strokeStyle = f.fire ? '#ff7a1a' : '#7fd8ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(q0.x - camX, q0.y); ctx.lineTo(x, y); ctx.stroke();
      ctx.globalAlpha = 0.9; ctx.strokeStyle = f.fire ? '#ffd27a' : '#ffffff'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(q0.x - camX, q0.y); ctx.lineTo(x, y); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(x, y); ctx.rotate(f.rot);
      ctx.fillStyle = f.fire ? '#ff5a1e' : '#5ac8f0';
      ctx.beginPath(); ctx.moveTo(-3.2, 0); ctx.lineTo(0, -1.8); ctx.lineTo(3.2, 0); ctx.lineTo(0, 1.8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = f.fire ? '#fff2c0' : '#e8fbff'; ctx.fillRect(-1, -0.8, 2, 1.6);
      ctx.restore();
    });
    ctx.restore();
  }

  // ---- 중력 구체(1차 Lv17, 몰이사냥) ----
  // 던짐(castGrav) → ph 0 날아감(dist 만큼 또는 적에 닿으면 멈춤) → ph 1 끌어당김(holdMs, 넓은 둘레 잡몹을 가운데로 세게 + tickMs 마다 작게) → ph 2 터짐
  //   법사가 다른 걸 해도 구체는 그대로. k = 기술 Lv 크기(area, Lv5 1.3) → 끄는 둘레 · 터짐 같이 커짐. 각성 마력 폭주 = 같은 자리 한 번 더 터짐(70%)
  function castGrav(p, d, s) {
    var C = d.grav;
    gravs.push({ x: p.x + p.dir * C.x, z: p.y, y: C.y, dir: p.dir, t: 0, ph: 0, flown: 0, ht: 0, bt: 0, C: C, d: d, k: s.area, mul: s.mul, wk: p.weaponKey,
                 lv: curLv, next: C.tickMs, echo: !!s.echo, seed: Math.random() * 6.28, caught: [], trailT: 0 });
    snd('magicShot');
    glow(p.x + p.dir * C.x, p.y + C.y, 26 * AS() / 0.55, '#b46aff', 220, 0.7);
  }
  function gravStep(dt) {
    for (var i = gravs.length - 1; i >= 0; i--) {
      var o = gravs[i], C = o.C;
      o.t += dt;
      if (o.ph === 0) {
        var mv = C.speed * dt / 1000, touch = false;
        o.x += o.dir * mv; o.flown += mv;
        H.targets().forEach(function (t) {
          if (touch || !t || t.isProp || (t.alive && !t.alive()) || t.state === 'down') return;
          var hb = t.hurtbox();
          if (Math.abs(hb.z - o.z) <= 16 && o.x + C.orb >= hb.x0 && o.x - C.orb <= hb.x1) touch = true;
        });
        o.trailT -= dt;
        if (o.trailT <= 0) { o.trailT = 40; debris(o.x - o.dir * 6, o.z + o.y, o.z, 1, { cols: PURPLE, glow: true, sp: 40, size: 1.3, ms: 300, g: -60, spread: 1.2 }); }
        if (touch || o.flown >= C.dist) { o.ph = 1; o.ht = 0; atLv(o.lv, function () { gravOpen(o); }); }
      } else if (o.ph === 1) {
        o.ht += dt;
        atLv(o.lv, function () {
          gravPull(o, dt);
          while (o.ht >= o.next && o.next < C.holdMs) { gravTick(o); o.next += C.tickMs; }
          if (o.ht >= C.holdMs) {
            o.ph = 2; o.bt = 0; gravBoom(o, 1, true);
            if (o.echo) echo(o.d, function () { gravBoom(o, 0.7, false); });   // 각성 마력 폭주: 같은 자리 한 번 더
          }
        });
      } else { o.bt += dt; if (o.bt > 460) gravs.splice(i, 1); }
    }
  }
  // 멈추는 순간: 안으로 빨려드는 고리(큰 → 작은) + 「웅」
  function gravOpen(o) {
    var R = o.C.pullR * o.k;
    snd('blink');
    wave(o.x, o.z, R * 0.25, { r0: R, flat: 0.3, w: 3, ms: 360, color: '#f0d8ff', glow: '#8a4ae0', ground: true, noMax: true });
    wave(o.x, o.z - 30 * AS(), R * 0.15, { r0: R * 0.7, flat: 0.75, w: 2, ms: 300, color: '#ffffff', glow: '#b46aff', noMax: true });
    glow(o.x, o.z - 30 * AS(), 34 * AS() / 0.55, '#c890ff', 260, 0.8);
    FX.shake(CFG.juice.shakePx * 0.8, CFG.juice.shakeMs);
  }
  // 끌어당김: 둘레(pullR x k, 위아래 pullDepth x k) 잡몹을 가운데로 세게(pullK) + 어질. 누운 적도 끌림(바닥을 미끄러져 옴)
  function gravPull(o, dt) {
    var C = o.C, R = C.pullR * o.k, D = C.pullDepth * o.k;
    o.caught = [];
    H.targets().forEach(function (t) {
      if (!pullable(t)) return;
      if (Math.abs(t.x - o.x) > R || Math.abs(t.y - o.z) > D) return;
      pullTo(t, o.x, o.z, C.pullK, dt, 5);
      daze(t, 160, 0.35);
      o.caught.push(t);
    });
  }
  // 끌리는 동안 작게(가운데 가까이 모인 적 = 터짐 둘레의 90% 안)
  function gravTick(o) {
    var C = o.C, R = C.r * o.k * 0.9, D = C.depth * o.k, st = stOf(C.tick, o.d), any = false;
    H.targets().forEach(function (t) {
      if (!t || !H.canHit(t, C.tick) || !inBox(t, o.x, o.z, R, D)) return;
      var dir = t.x > o.x ? -1 : 1;   // 가운데 쪽으로
      H.onHit(st, t, { dir: dir, wk: o.wk, x: t.x, y: t.y - 40 * AS(), mul: o.mul });
      any = true;
    });
    glow(o.x, o.z - 30 * AS(), 28 * AS() / 0.55, '#b46aff', 160, any ? 0.55 : 0.35);
  }
  // 터짐: 보라 빛 → 공중 고리 + 땅 고리 + 불티. 맞은 적은 거의 안 밀리고 잠깐 멈춤(한데 모인 채)
  function gravBoom(o, mulK, first) {
    var C = o.C, R = C.r * o.k, D = C.depth * o.k, h = C.hit, st = stOf(h, o.d), any = false, y = o.z - 30 * AS();
    snd('skSlam'); snd('fireBoom', { v: 0.6, k: 0.7 });
    H.hitstop(first ? 80 : 60);
    FX.shake(CFG.juice.shakePx * (first ? 2.8 : 2), CFG.juice.shakeMs * 1.6);
    glow(o.x, y, R * 1.4, '#b46aff', 380, 0.85);
    glow(o.x, y, R * 0.6, '#ffffff', 200, 0.75);
    wave(o.x, y, R * 1.2, { flat: 0.8, w: 5, ms: 360, color: '#f0d8ff', glow: '#8a4ae0' });
    wave(o.x, o.z, R * 1.6, { flat: 0.3, w: 5, ms: 440, color: '#e8d0ff', glow: '#6a3ad8', ground: true });
    debris(o.x, y, o.z, first ? 22 : 12, { cols: PURPLE, glow: true, sp: 280, size: 1.7, ms: 520, spread: 2.6 });
    debris(o.x, y, o.z, first ? 8 : 4, { cols: ['#2a1048', '#4e2290'], sp: 70, size: 3, ms: 800, g: -60, spread: 0.8 });   // 검보라 연기
    H.dust(o.x - 14 * AS(), o.z, -1); H.dust(o.x + 14 * AS(), o.z, 1);
    H.targets().forEach(function (t) {
      if (!t || !H.canHit(t, h) || !inBox(t, o.x, o.z, R, D)) return;
      var dir = Math.abs(t.x - o.x) < 3 ? o.dir : (t.x > o.x ? 1 : -1);
      H.onHit(st, t, { dir: dir, wk: o.wk, x: t.x, y: t.y - 44 * AS(), mul: o.mul * mulK });
      any = true;
    });
    if (h.flash) doFlash(first ? h.flash : { color: h.flash.color, alpha: h.flash.alpha * 0.6, ms: h.flash.ms });
    if (any && first && h.slowMs) H.slow(h.slowMs);
  }
  // 바닥(캐릭터 밑): 끌어당기는 동안 둘레 큰 어두운 보라 원(경계 = 끄는 둘레) + 안으로 감겨 드는 나선 줄
  function drawGravUnder(ctx, camX) {
    gravs.forEach(function (o) {
      if (o.ph !== 1) return;
      var C = o.C, R = C.pullR * o.k, a = clamp(o.ht / 150, 0, 1) * clamp((C.holdMs - o.ht) / 120 + 0.3, 0, 1), x = o.x - camX, now = o.t / 1000;
      ctx.save(); ctx.translate(x, o.z); ctx.scale(1, 0.3);
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0, 'rgba(40,10,80,' + (0.45 * a).toFixed(3) + ')'); g.addColorStop(0.55, 'rgba(90,40,170,' + (0.22 * a).toFixed(3) + ')'); g.addColorStop(1, 'rgba(90,40,170,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#c890ff'; ctx.globalAlpha = 0.5 * a; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, R * (0.97 + 0.03 * Math.sin(now * 9)), 0, Math.PI * 2); ctx.stroke();
      // 나선 팔 4개(안으로 감기며 돎)
      ctx.lineWidth = 2;
      for (var k = 0; k < 4; k++) {
        ctx.globalAlpha = 0.55 * a; ctx.strokeStyle = k % 2 ? '#e8d0ff' : '#8a4ae0';
        ctx.beginPath();
        for (var j = 0; j <= 18; j++) {
          var u = j / 18, rr = R * (1 - u) * 0.95, an = o.seed + k * Math.PI / 2 + u * 3.2 + now * 4.2;
          if (j) ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); else ctx.moveTo(Math.cos(an) * rr, Math.sin(an) * rr);
        }
        ctx.stroke();
      }
      ctx.restore();
    });
  }
  // 구체(캐릭터 위): 검은 속 + 보라 테 + 도는 고리 2개 + 빨려드는 빛 점들(끄는 동안) + 끌려오는 적에서 가운데로 보라 줄 / 터진 뒤 = 줄어드는 흰 점
  function gravPosY(o) { var lo = o.z - 30 * AS(); return o.ph === 0 ? o.z + o.y : o.z + o.y + (lo - (o.z + o.y)) * clamp(o.ht / 300, 0, 1); }
  function drawGravs(ctx, camX) {
    gravs.forEach(function (o) {
      var C = o.C, x = o.x - camX, y = gravPosY(o), now = o.t / 1000;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      if (o.ph === 2) {   // 터진 뒤: 가운데 흰 점이 줄어듦
        var u = o.bt / 460;
        ctx.globalAlpha = Math.max(0, 1 - u); ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, C.orb * o.k * (1 - u) * 0.8 + 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore(); return;
      }
      if (o.ph === 1) {
        // 끌려오는 적 → 가운데 보라 줄
        o.caught.forEach(function (t) {
          if (Math.abs(t.x - o.x) < 10) return;
          var ty = t.y - 40 * AS();
          ctx.globalAlpha = 0.35; ctx.strokeStyle = '#8a4ae0'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(t.x - camX, ty); ctx.lineTo(x, y); ctx.stroke();
          ctx.globalAlpha = 0.7; ctx.strokeStyle = '#f0d8ff'; ctx.lineWidth = 1.3;
          ctx.beginPath(); ctx.moveTo(t.x - camX, ty); ctx.lineTo(x, y); ctx.stroke();
        });
        // 빨려드는 빛 점(바깥 → 가운데로 나선)
        var R = C.pullR * o.k * 0.8;
        for (var j = 0; j < 22; j++) {
          var ph = (now * 1.6 + j / 22) % 1, rr = R * (1 - ph), an = o.seed + j * 2.4 - ph * 4;
          ctx.globalAlpha = 0.85 * ph; ctx.fillStyle = j % 3 ? '#e8d0ff' : '#ffffff';
          ctx.fillRect(x + Math.cos(an) * rr - 1, y + Math.sin(an) * rr * 0.45 - 1, 2.2, 2.2);
        }
      }
      var r = C.orb * (o.ph === 1 ? 1 + 0.35 * clamp(o.ht / 300, 0, 1) : 1) * Math.sqrt(o.k) * (1 + 0.06 * Math.sin(now * 20));
      var g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.4);
      g.addColorStop(0, 'rgba(200,150,255,0.9)'); g.addColorStop(0.45, 'rgba(140,70,240,0.45)'); g.addColorStop(1, 'rgba(90,30,200,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#12041e'; ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, Math.PI * 2); ctx.fill();   // 검은 속(빛을 삼킴)
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#e8d0ff'; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.95;
      ctx.beginPath(); ctx.arc(x, y, r * 0.82, 0, Math.PI * 2); ctx.stroke();
      for (var k = 0; k < 2; k++) {   // 도는 고리(기울어진 타원)
        ctx.save(); ctx.translate(x, y); ctx.rotate(now * (k ? -3.2 : 2.6) + k * 1.1);
        ctx.globalAlpha = 0.7; ctx.strokeStyle = k ? '#c890ff' : '#ffffff'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.55, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    });
  }

  // ---- 마력 소용돌이(1차 Lv18, 늘 켜짐) ----
  // val(ms) 마다: 법사 둘레(find, 위아래 findDepth) 적(소품 빼고)이 있으면 가까운 4마리 가운데 자리에 소용돌이 → ms 동안 둘레(r) 잡몹을 모음 +
  //   ticks 번 작게 → 끝에 톡 터짐. 둘레에 적이 없으면 0.25초마다 다시 봄(쓸데없이 안 생김)
  function vortexStep(dt) {
    var p = H.player && H.player(), q = p && pasOf(p, 'vortex');
    if (!q || p.state === 'dead' || hidden(p)) return;
    vortexT -= dt;
    if (vortexT > 0) return;
    var P = q.P, i = q.lv - 1, list = [];
    H.targets().forEach(function (t) {
      if (!t || t.isProp || (t.alive && !t.alive())) return;
      var dx = t.x - p.x, dz = t.y - p.y;
      if (Math.abs(dx) > P.find || Math.abs(dz) > P.findDepth) return;
      list.push({ t: t, d: Math.abs(dx) + Math.abs(dz) });
    });
    if (!list.length) { vortexT = 250; return; }
    list.sort(function (a, b) { return a.d - b.d; });
    var n = Math.min(4, list.length), cx = 0, cz = 0;
    for (var k = 0; k < n; k++) { cx += list[k].t.x; cz += list[k].t.y; }
    vortexes.push({ x: cx / n, z: cz / n, t: 0, P: P, lv: q.lv, r: P.r[i], mul: P.mul[i], ticks: 0, wk: p.weaponKey, popped: false, seed: Math.random() * 6.28 });
    vortexT = q.v;
    snd('blink', { v: 0.45, k: 1.2 });
  }
  function vortexTick(dt) {
    for (var i = vortexes.length - 1; i >= 0; i--) {
      var o = vortexes[i], P = o.P;
      o.t += dt;
      if (!o.popped) {
        H.targets().forEach(function (t) { if (pullable(t) && Math.abs(t.x - o.x) <= o.r * 1.3 && Math.abs(t.y - o.z) <= P.depth * 1.3) { pullTo(t, o.x, o.z, P.pullK, dt, 6); daze(t, 120, 0.5); } });
        var gap = P.ms / (P.ticks + 1);
        while (o.ticks < P.ticks && o.t >= gap * (o.ticks + 1)) { o.ticks++; (function (o) { atLv(o.lv, function () { vortexHit(o, P.tick, false); }); })(o); }
        if (o.t >= P.ms) { o.popped = true; atLv(o.lv, function () { vortexHit(o, P.pop, true); }); }
      }
      if (o.t >= P.ms + 300) vortexes.splice(i, 1);
    }
  }
  function vortexHit(o, h, pop) {
    var st = stOf(h, ARC), D = o.P.depth;
    H.targets().forEach(function (t) {
      if (!t || !H.canHit(t, h) || !inBox(t, o.x, o.z, o.r, D)) return;
      var dir = pop ? (t.x >= o.x ? 1 : -1) : (t.x > o.x ? -1 : 1);
      H.onHit(st, t, { dir: dir, wk: o.wk, x: t.x, y: t.y - 40 * AS(), mul: o.mul });
    });
    if (pop) {
      snd('skWave', { v: 0.5 });
      glow(o.x, o.z - 26 * AS(), o.r * 0.9, '#b46aff', 240, 0.6);
      wave(o.x, o.z, o.r * 1.2, { flat: 0.3, w: 3, ms: 300, color: '#f0d8ff', glow: '#8a4ae0', ground: true, noMax: true });
      debris(o.x, o.z - 26 * AS(), o.z, 10, { cols: PURPLE, glow: true, sp: 200, size: 1.4, ms: 380, spread: 2.4 });
    } else debris(o.x, o.z - 10 * AS(), o.z, 3, { cols: PURPLE, glow: true, sp: 90, size: 1.2, ms: 380, g: -160, spread: 0.5 });
  }
  // 소용돌이 그림: 바닥 나선(납작) + 위로 감겨 오르는 얇은 보라 줄 3개(작은 깔때기). 나타남(150ms) → 끝에 줄어듦
  function drawVortexes(ctx, camX) {
    vortexes.forEach(function (o) {
      var P = o.P, a = o.popped ? Math.max(0, 1 - (o.t - P.ms) / 300) : clamp(o.t / 150, 0, 1), x = o.x - camX, now = o.t / 1000, R = o.r;
      if (a <= 0) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      ctx.save(); ctx.translate(x, o.z); ctx.scale(1, 0.3);
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0, 'rgba(180,106,255,' + (0.35 * a).toFixed(3) + ')'); g.addColorStop(1, 'rgba(120,60,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 1.8;
      for (var k = 0; k < 3; k++) {
        ctx.globalAlpha = 0.7 * a; ctx.strokeStyle = k ? '#c890ff' : '#ffffff';
        ctx.beginPath();
        for (var j = 0; j <= 14; j++) { var u = j / 14, rr = R * (1 - u) * 0.9, an = o.seed + k * 2.09 + u * 3 + now * 7; if (j) ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); else ctx.moveTo(Math.cos(an) * rr, Math.sin(an) * rr); }
        ctx.stroke();
      }
      ctx.restore();
      var Hh = 46 * AS() / 0.55 * a;   // 작은 깔때기(위로 넓어짐)
      for (var m = 0; m < 3; m++) {
        ctx.globalAlpha = 0.55 * a; ctx.strokeStyle = m === 1 ? '#ffffff' : '#b46aff'; ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (var s2 = 0; s2 <= 12; s2++) {
          var v = s2 / 12, rr2 = 4 + R * 0.45 * v, an2 = o.seed + m * 2.09 + v * 5 + now * 9, px = x + Math.cos(an2) * rr2, py = o.z - Hh * v + Math.sin(an2) * rr2 * 0.3;
          if (s2) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  // ---- 원소 연쇄(대마법사 Lv28, 늘 켜짐) ----
  // 법사 마법으로 쓰러진 적(main.js onHit → chainKill)이 CHAIN_DELAY 뒤 그 자리에서 터져 둘레 적을 때림. 터짐으로 쓰러진 적도 또 터짐(depth 가 passive.chain 까지).
  //   CHAIN_CAP = 짧은 시간(CHAIN_WIN)에 터지는 최대 수(몹 떼를 한꺼번에 쓸 때 폰이 느려지지 않게) — 기사 칼날 파편과 같은 짜임
  var CHAIN_DELAY = 110, CHAIN_CAP = 10, CHAIN_WIN = 300;
  function chainKill(p, t, depth) {
    var q = pasOf(p, 'echain');
    if (!q || !t || t.isProp || !t.T) return;
    depth = depth || 0;
    if (depth > (q.P.chain || 0) || chainN >= CHAIN_CAP) return;
    chainN++;
    var R = q.P.r[q.lv - 1], cy = t.y - t.T.height * 0.45;
    chainQ.push({ t: CHAIN_DELAY, x: t.x, z: t.y, cy: cy, R: R, depth: depth, mul: q.v, wk: p.weaponKey, P: q.P, lv: q.lv });
    glow(t.x, cy, 18 * AS() / 0.55, '#ffd27a', CHAIN_DELAY + 60, 0.7);   // 터지기 직전 부풀어 오르는 빛
  }
  function chainStep(dt) {
    chainWinT += dt;
    if (chainWinT >= CHAIN_WIN) { chainWinT = 0; chainN = 0; }
    for (var i = chainQ.length - 1; i >= 0; i--) {
      var o = chainQ[i]; o.t -= dt;
      if (o.t <= 0) { chainQ.splice(i, 1); (function (o) { atLv(o.lv, function () { chainBoom(o); }); })(o); }
    }
  }
  // 터짐: 주황 · 보라 작은 폭발(불 + 마법 두 겹 고리) → 둘레 R(위아래 depth) 적 모두. 맞은 적이 쓰러지면 main.js 가 depth + 1 로 또 부름
  function chainBoom(o) {
    var P = o.P, C = P._hits || (P._hits = []), h = C[o.depth];
    if (!h) { h = {}; for (var k in P.hit) if (k !== '_st') h[k] = P.hit[k]; h.chainDepth = o.depth + 1; C[o.depth] = h; }
    var st = stOf(h, FIRE), D = P.depth || 36;
    snd('fireBoom', { v: 0.55, k: 1.15 });
    H.hitstop(30);
    FX.shake(CFG.juice.shakePx * 1.2, CFG.juice.shakeMs);
    glow(o.x, o.cy, o.R * 1.1, '#ff9a3a', 260, 0.75);
    glow(o.x, o.cy, o.R * 0.5, '#ffffff', 150, 0.6);
    wave(o.x, o.cy, o.R * 0.9, { flat: 0.8, w: 3, ms: 260, color: '#fff2c0', glow: '#ff6a10', noMax: true });
    wave(o.x, o.z, o.R * 1.25, { flat: 0.3, w: 3, ms: 320, color: '#e8d0ff', glow: '#8a4ae0', ground: true, noMax: true });
    debris(o.x, o.cy, o.z, 10, { cols: ['#fff4d0', '#ffb040', '#ff5a1e', '#c890ff'], glow: true, sp: 220, size: 1.5, ms: 420, spread: 2.4 });
    H.targets().forEach(function (e) {
      if (!e || !H.canHit(e, h) || !inBox(e, o.x, o.z, o.R, D)) return;
      var dir = Math.abs(e.x - o.x) < 3 ? 1 : (e.x > o.x ? 1 : -1);
      H.onHit(st, e, { dir: dir, wk: o.wk, x: e.x - dir * 4 * AS(), y: e.y - 44 * AS(), mul: o.mul });
    });
  }

  // ---- 빙결 폭풍(대마법사 Lv35, 광역딜) ----
  // 앞쪽 넓은 땅(가운데 x 앞, 가로 ±w, 위아래 ±depth)에 ms 동안 얼음 폭풍: firstMs 부터 tickMs 마다 작게 + 맞은 적 얼어붙음(거의 멈춤, 보스는 덜) →
  //   끝에 산산이 깨짐(shatter = 크게, 넘어뜨림. 깨지기 직전 얼음을 풀어 넘어지는 모습이 제 빠르기로 나옴). 법사가 다른 걸 해도 폭풍은 그대로
  function castFrost(p, d, s) {
    var F = d.frost, k = s.area;
    frosts.push({ x: p.x + p.dir * F.x * k, z: p.y, w: F.w * k, D: F.depth, dir: p.dir, t: 0, F: F, d: d, k: k, mul: s.mul, wk: p.weaponKey, lv: curLv,
                  next: F.firstMs, done: false, echo: !!s.echo, flakes: [], flakeT: 0, seed: Math.random() * 100, frozen: [] });
    snd('iceSpear'); snd('wave', { v: 0.5 });
    FX.shake(CFG.juice.shakePx * 1.2, CFG.juice.shakeMs * 1.4);
    doFlash({ color: '#cfefff', alpha: 0.22, ms: 160 });
  }
  function frostStep(dt) {
    for (var i = frosts.length - 1; i >= 0; i--) {
      var o = frosts[i], F = o.F, sm = SM();
      o.t += dt;
      if (o.t < F.ms) {   // 쏟아지는 얼음 조각(그림만): 위에서 비스듬히 떨어져 땅에서 부서짐
        o.flakeT -= dt;
        while (o.flakeT <= 0) {
          o.flakeT += sm ? 9 : 16;
          var fx = o.x + (Math.random() * 2 - 1) * o.w, fz = o.z + (Math.random() * 2 - 1) * o.D;
          o.flakes.push({ x: fx - o.dir * 70, y: fz - 170 - Math.random() * 40, tx: fx, tz: fz, t: 0, life: 260 + Math.random() * 120, big: Math.random() < 0.3 });
        }
      }
      for (var j = o.flakes.length - 1; j >= 0; j--) {
        var f = o.flakes[j]; f.t += dt;
        if (f.t >= f.life) {
          o.flakes.splice(j, 1);
          if (f.big && parts.length < cap('parts', 1e9) * 0.7) debris(f.tx, f.tz - 2, f.tz, 1, { cols: ICEC, glow: true, sp: 80, size: 1.1, ms: 220, spread: 1.4 });
        }
      }
      atLv(o.lv, function () {
        while (o.next < F.ms && o.t >= o.next) { frostHit(o, F.tick, 1, false); o.next += F.tickMs; }
        if (!o.done && o.t >= F.ms) {
          o.done = true; frostShatter(o, 1, true);
          if (o.echo) echo(o.d, function () { frostShatter(o, 0.6, false); });   // 각성 마력 폭주: 한 번 더 깨짐(60%)
        }
      });
      if (o.done && o.t >= F.ms + 700) frosts.splice(i, 1);
    }
  }
  // 폭풍 안 적 모두(맞으면 얼어붙음: 깨질 때까지 시간이 freeze.mul 배 = 거의 멈춤, 보스 bossMul)
  function frostHit(o, h, mulK, shatter) {
    var F = o.F, st = stOf(h, o.d), any = false, until = Math.min(F.freeze.ms, F.ms - o.t + 120);
    H.targets().forEach(function (t) {
      if (!t || !H.canHit(t, h) || !inBox(t, o.x, o.z, o.w, o.D)) return;
      if (shatter && t.frozenT > 0) { t.frozenT = 0; t.slowT = 0; }   // 깨짐: 얼음을 풀고 때림(넘어지는 모습은 제 빠르기)
      var dir = Math.abs(t.x - o.x) < 3 ? o.dir : (t.x > o.x ? 1 : -1);
      H.onHit(st, t, { dir: shatter ? dir : o.dir, wk: o.wk, x: t.x, y: t.y - 44 * AS(), mul: o.mul * mulK });
      if (!shatter && t.T && (!t.alive || t.alive()) && until > 0) {
        t.slowT = Math.max(t.slowT || 0, until); t.slowK = t.T.boss ? F.freeze.bossMul : F.freeze.mul; t.slowDaze = false; t.frozenT = Math.max(t.frozenT || 0, until);
        if (o.frozen.indexOf(t) < 0) o.frozen.push(t);
        if (t.flashT > 6) t.flashT = 6;   // 얼면 시간이 거의 멈춰 하얀 번쩍이 오래 남음 → 짧게(얼음 덩어리가 보이게)
      }
      if (!shatter) debris(t.x, t.y - 40 * AS(), t.y, 2, { cols: ICEC, glow: true, sp: 120, size: 1.1, ms: 220 });
      any = true;
    });
    if (!shatter && any) snd('iceHit', { v: 0.45 });
    return any;
  }
  function frostShatter(o, mulK, first) {
    var h = o.F.shatter;
    snd('iceHit'); snd('skSlam');
    H.hitstop(first ? 90 : 60);
    FX.shake(CFG.juice.shakePx * (first ? 3.2 : 2.2), CFG.juice.shakeMs * 1.8);
    glow(o.x, o.z - 40 * AS(), o.w * 0.8, '#bfefff', 420, 0.7);
    glow(o.x, o.z - 30 * AS(), o.w * 0.35, '#ffffff', 240, 0.7);
    wave(o.x, o.z, o.w * 1.15, { flat: 0.3, w: 5, ms: 480, color: '#ffffff', glow: '#5ac8f0', ground: true });
    wave(o.x, o.z - 40 * AS(), o.w * 0.6, { flat: 0.6, w: 4, ms: 340, color: '#e8fbff', glow: '#7fd8ff' });
    for (var j = -3; j <= 3; j++) debris(o.x + j * o.w / 3.4, o.z - 20 * AS(), o.z, first ? 6 : 3, { cols: ICEC, glow: true, sp: 260, size: 1.6, ms: 520, spread: 1.5 });
    if (first) for (var m = -2; m <= 2; m++) debris(o.x + m * o.w / 2.4, o.z - 10 * AS(), o.z, 4, { cols: ['#e8fbff', '#a8ecff', '#5ac8f0', '#2a7ad0'], sp: 200, size: 2.4, ms: 700, spread: 1.2 });   // 얼음 덩어리
    if (h.flash) doFlash(first ? h.flash : { color: h.flash.color, alpha: h.flash.alpha * 0.6, ms: h.flash.ms });
    if (frostHit(o, h, mulK, true) && first && h.slowMs) H.slow(h.slowMs);
  }
  // ---- 빙산 솟구치기(법사 1차 Lv11, 2026-11-08 얼음창을 바꿈 · 같은 날 v2 = 작게 · 이어진 얼음 줄 · 1시 방향으로 기움) ----
  // 법사 바로 앞 땅부터 얼음이 하나씩(gapMs 마다, gap 도트씩 앞으로) 솟음: 가까운 건 작게 → 멀수록 크게 → 마지막 = 송곳처럼 뾰족한 큰 빙산.
  //   작은 얼음 = 그 자리 적을 살짝 띄움(적마다 한 번), 마지막 빙산 = 높이 띄움(진짜 띄우기) + 얼음 → 내려오면 느려짐. 솟은 채 lifeMs → 부서짐
  //   그림 = 전부 코드(작은 도트판에 그려 2배로 키움 = 굵은 도트). 법사가 다른 걸 해도 얼음 줄은 그대로
  var CRAG_PX = 2;   // 얼음 그림 한 도트 = 화면 2도트
  function castCrags(p, d, s) {
    var C = d.crag, L5 = s.L.lv5 || null;
    cragRows.push({ C: C, d: d, x: p.x, z: p.y, dir: p.dir, t: 0, i: 0, n: (L5 && L5.n) || C.n, bigK: (L5 && L5.big) || 1,
                    k: s.area || 1, mul: s.mul, wk: p.weaponKey, lv: curLv, echo: !!s.echo, hitS: [], pend: [] });
  }
  function cragStep(dt) {
    for (var i = cragRows.length - 1; i >= 0; i--) {
      var R = cragRows[i], C = R.C;
      R.t += dt;
      atLv(R.lv, function () {
        while (R.i < R.n && R.t >= R.i * C.gapMs + (R.i === R.n - 1 ? C.lastMs : 0)) { cragRise(R, R.i, 1); R.i++; }
      });
      cragPend(R, dt);
      if (R.i >= R.n && !R.pend.length && R.t > R.n * C.gapMs + 800) cragRows.splice(i, 1);
    }
    for (var j = crags.length - 1; j >= 0; j--) {
      var q = crags[j], end = q.riseMs + q.C.lifeMs;
      q.t += dt;
      if (!q.broke && q.t >= end) { q.broke = true; atLv(q.lv, function () { cragBreak(q); }); }
      if (q.t >= end + q.breakMs) crags.splice(j, 1);
    }
  }
  // i 번째 얼음이 솟음(마지막 = 큰 빙산). mulK = 데미지 배율(각성 마력 폭주의 한 번 더 = 0.6)
  function cragRise(R, i, mulK) {
    var C = R.C, B = C.big, last = i === R.n - 1, u = R.n > 2 ? Math.min(1, i / (R.n - 2)) : 1, k = R.k, bk = R.bigK;
    var x = R.x + R.dir * (C.x + C.gap * i), z = R.z;
    var w = last ? B.w * k * bk : (C.w0 + (C.w1 - C.w0) * u) * k, h = last ? B.h * k * bk : (C.h0 + (C.h1 - C.h0) * u) * k;
    var q = { x: x, z: z, w: w, h: h, dir: R.dir, big: last, t: 0, riseMs: last ? 100 : 80, breakMs: last ? 240 : 180, C: C, lv: curLv, seed: Math.random() * 1000,
              link: i > 0 ? C.gap : 10 };   // link = 뒤 얼음까지 거리(얼음 등줄기로 이어 그림)
    q.art = cragArt(q);
    crags.push(q);
    // 솟는 순간: 갈라진 땅 흙 조각 · 서리 가루 · 얼음 조각 · 빛(작게)
    var tx = x + R.dir * h * 0.45;   // 기운 얼음 끝 쪽
    if (last) wave(x, z, w * 1.6, { flat: 0.3, w: 3, ms: 320, color: '#e8fbff', glow: '#5ac8f0', ground: true });
    debris(x, z - 2, z, last ? 6 : 3, { cols: ['#6a4a30', '#8a6440', '#4a3020'], sp: last ? 170 : 120, size: 1.8, ms: 520, spread: 0.9 });   // 흙 조각
    debris(x, z - 2, z, last ? 8 : 4, { cols: ['#ffffff', '#e8fbff', '#bff4ff'], glow: true, sp: last ? 170 : 110, size: 1.2, ms: 360, spread: 1.4 });
    debris(tx, z - h * 0.6, z, last ? 6 : 2, { cols: ['#e8fbff', '#a8ecff', '#5ac8f0', '#2a7ad0'], sp: last ? 200 : 140, size: last ? 2 : 1.6, ms: 520, spread: 0.9 });
    glow(tx, z - h * 0.45, w * (last ? 1.1 : 0.7), '#bfefff', last ? 260 : 180, last ? 0.65 : 0.4);
    if (last) {
      glow(x + R.dir * h * 0.55, z - h * 0.9, w * 0.6, '#ffffff', 200, 0.7);   // 뾰족한 끝 번쩍
      snd('skSlam', { v: 0.55 }); snd('iceHit');
      H.hitstop(45);
      FX.shake(CFG.juice.shakePx * 1.4, CFG.juice.shakeMs * 1.3);
    } else {
      snd('iceHit', { v: 0.35 + 0.15 * u });
      FX.shake(CFG.juice.shakePx * (0.4 + 0.3 * u), CFG.juice.shakeMs * 0.7);
    }
    // 맞히기: 작은 얼음 = 적마다 한 번(앞 얼음에 맞은 적은 다음 얼음이 안 때림) / 큰 빙산 = 그 자리 적 모두
    var hit = last ? B.hit : C.hit, st = stOf(hit, R.d), rr = last ? B.r * k * bk : (C.r0 + (C.r1 - C.r0) * u) * k, D = last ? B.depth : C.depth, any = false;
    H.targets().forEach(function (t) {
      if (!t || !H.canHit(t, hit) || !inBox(t, x + R.dir * h * 0.2, z, rr, D)) return;   // 판정 가운데 = 얼음이 앞으로 기운 만큼 조금 앞
      if (!last) { if (R.hitS.indexOf(t) >= 0) return; R.hitS.push(t); }
      H.onHit(st, t, { dir: R.dir, wk: R.wk, x: t.x, y: t.y - 36 * AS(), mul: R.mul * (mulK || 1) });
      if (last) cragFreeze(R, t);
      debris(t.x, t.y - 30 * AS(), t.y, 3, { cols: ICEC, glow: true, sp: 150, size: 1.2, ms: 260 });
      any = true;
    });
    if (any && last) impact(hit);
    if (last && R.echo && mulK === 1) echo(R.d, function () { cragRise(R, R.n - 1, 0.6); });   // 각성 마력 폭주: 마지막 빙산 한 번 더(60%)
  }
  // 큰 빙산에 맞은 적: 뜬 적 = 얼음 그림만(띄우기가 먼저, 공중에서 안 멈춤) → 떨어져 일어서면 느려짐 / 안 뜬 적(보스 · 큰 적) = 잠깐 진짜 얼음(거의 멈춤) → 느려짐
  function cragFreeze(R, t) {
    if (!t.T || t.isProp || (t.alive && !t.alive())) return;
    var F = R.C.big.freeze, air = t.state === 'air' || t.state === 'down';   // 누운 적도 일어선 뒤 느려짐(2026-11-08)
    t.frozenT = Math.max(t.frozenT || 0, F.ms);
    if (!air) { t.slowT = Math.max(t.slowT || 0, F.ms); t.slowK = t.T.boss ? F.bossMul : F.mul; t.slowDaze = false; if (t.flashT > 6) t.flashT = 6; }
    R.pend.push({ t: t, age: 0, air: air });
  }
  function cragPend(R, dt) {
    var S = R.C.big.slow, F = R.C.big.freeze;
    for (var i = R.pend.length - 1; i >= 0; i--) {
      var q = R.pend[i], t = q.t;
      q.age += dt;
      if (t.alive && !t.alive()) { R.pend.splice(i, 1); continue; }
      if (!(q.air ? (t.state !== 'air' && t.state !== 'down' && q.age > 100) || q.age > 4000 : q.age >= F.ms)) continue;   // 뜬 적 = 떨어져 일어선 뒤 느려짐(누워 있는 동안 버리지 않게)
      R.pend.splice(i, 1);
      t.slowT = Math.max(t.slowT || 0, S.ms); t.slowK = t.T.boss ? S.bossMul : S.mul; t.slowDaze = false;
    }
  }
  // 부서짐: 얼음 조각이 튀고(큰 빙산 = 얼음창 부서짐 그림 ice_shatter 도) 땅으로 꺼짐
  function cragBreak(q) {
    var mx = q.x + q.dir * q.h * 0.25;   // 기운 얼음 몸 가운데
    debris(mx, q.z - q.h * 0.45, q.z, q.big ? 12 : 5, { cols: ['#e8fbff', '#a8ecff', '#5ac8f0', '#2a7ad0'], sp: q.big ? 180 : 120, size: q.big ? 2.2 : 1.7, ms: 600, spread: 1.3 });
    debris(mx, q.z - q.h * 0.3, q.z, q.big ? 8 : 3, { cols: ICEC, glow: true, sp: 140, size: 1.1, ms: 340, spread: 1.6 });
    if (q.big) {
      var A = fxArt('ice_shatter');
      if (A) spriteFrom(mx, q.z - q.h * 0.4, A.fr, A.fps, A.pivot, q.dir < 0, 0.9, 0);
      glow(mx, q.z - q.h * 0.4, q.w * 1.2, '#bfefff', 240, 0.5);
      snd('iceHit', { v: 0.55 });
    }
  }
  // 얼음 그림 한 개(작은 도트판, 기준 = 이 얼음 자리의 땅): 1시 방향(tilt 도)으로 앞쪽으로 기운 얼음 조각 + 뒤 작은 조각 +
  //   뒤로 앞 얼음까지 이어지는 낮은 얼음 등줄기(link = 앞 얼음까지 거리 → 줄이 끊기지 않고 이어짐).
  //   왼쪽 면 밝게 · 오른쪽 면 어둡게 · 흰 빛줄 · 진한 테두리. 앞쪽(+x) 기준으로 그리고 그릴 때 방향(dir)대로 뒤집음
  function cragArt(q) {
    var P = CRAG_PX, W = Math.max(4, Math.round(q.w / P)), Hh = Math.max(5, Math.round(q.h / P)), T = Math.tan((q.C.tilt || 30) * Math.PI / 180);
    var back = Math.round((q.link || 0) / P) + 3, fwd = Math.ceil(W * 0.6 + Hh * T) + 3;
    var cw = back + W + fwd, ch = Hh + 4, by = ch - 1, ax = back + Math.round(W * 0.5);
    var c = document.createElement('canvas'); c.width = cw; c.height = ch;
    var g = c.getContext('2d');
    function rnd(i) { var v = Math.sin(q.seed + i * 12.9898) * 43758.5453; return v - Math.floor(v); }
    function poly(pts, col) { g.fillStyle = col; g.beginPath(); pts.forEach(function (a, n) { if (n) g.lineTo(a[0], a[1]); else g.moveTo(a[0], a[1]); }); g.closePath(); g.fill(); }
    function line(x0, y0, x1, y1, col) { var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0; g.fillStyle = col; for (var s = 0; s <= n; s++) { var u = n ? s / n : 0; g.fillRect(Math.round(x0 + (x1 - x0) * u), Math.round(y0 + (y1 - y0) * u), 1, 1); } }
    // 기운 얼음 조각: 밑 가운데 cx, 밑 반폭 hw, 높이 hh. 끝은 앞쪽으로 hh x tan(tilt) 만큼
    function shard(cx, hw, hh, k) {
      var lean = hh * T * (0.92 + rnd(k) * 0.16), tip = [cx + lean, by + 1 - hh];
      var TL = [cx - hw * 0.55 + lean * 0.72, by - hh * 0.74], TR = [cx + hw * 0.75 + lean * 0.55, by - hh * (0.5 + rnd(k + 1) * 0.12)];
      var mid = [cx + hw * 0.1, by + 1];
      poly([[cx - hw, by + 1], TL, tip, TR, [cx + hw, by + 1]], '#7fd0f0');
      poly([[cx - hw, by + 1], TL, tip, mid], '#bff4ff');
      poly([mid, tip, TR, [cx + hw, by + 1]], '#4aa8e0');
      line(cx - hw + 1, by - 1, TL[0], TL[1] + 1, '#ffffff');
      line(TL[0], TL[1] + 1, tip[0] - 1, tip[1] + 1, '#e8fbff');
    }
    // 뭉툭한 얼음(2026-11-08 형님 v3: 마지막 빙산 말고는 전부): 육각기둥을 대충 깎은 듯한 기운 수정. 면 셋(왼쪽 밝게 · 가운데 · 오른쪽 어둡게) +
    //   윗면(깎인 면, 더 밝게). 조각마다 폭 · 면 나누는 자리 · 윗면 기울기 · 깎인 두께가 달라 들쭉날쭉(평평하게 잘린 것 · 비스듬히 잘린 것)
    function prism(cx, hw, hh, k) {
      hw *= 0.85 + rnd(k + 7) * 0.35;
      var t0 = by + 1, at = function (x, h) { return [x + h * T, t0 - h]; };
      var hL = hh * (0.6 + rnd(k) * 0.2), hR = hh * (0.55 + rnd(k + 1) * 0.3), s1 = -hw * (0.15 + rnd(k + 2) * 0.3), s2 = hw * (0.25 + rnd(k + 3) * 0.3);
      var h1 = hh * (0.85 + rnd(k + 4) * 0.15), h2 = hh * (0.78 + rnd(k + 5) * 0.2), cap = Math.max(2, hh * (0.12 + rnd(k + 6) * 0.12));
      var BL = [cx - hw, t0], BR = [cx + hw, t0], TL = at(cx - hw, hL), TR = at(cx + hw, hR);
      var S1b = [cx + s1, t0], S2b = [cx + s2, t0], S1t = at(cx + s1, h1), S2t = at(cx + s2, h2);
      var C1 = [S1t[0] + cap * 0.3, S1t[1] - cap], C2 = [S2t[0] + cap * 0.3, S2t[1] - cap * (0.6 + rnd(k + 8) * 0.6)];
      poly([BL, TL, S1t, S1b], '#bff4ff');          // 왼쪽 면
      poly([S1b, S1t, S2t, S2b], '#6cc4ec');        // 가운데 면
      poly([S2b, S2t, TR, BR], '#3a8ed0');          // 오른쪽 면(그늘)
      poly([TL, C1, C2, TR, S2t, S1t], '#f4fdff');  // 깎인 윗면(가장 밝게)
      line(BL[0] + 1, t0 - 1, TL[0] + 1, TL[1] + 1, '#ffffff');   // 왼쪽 모서리 빛
      line(TL[0], TL[1], S1t[0], S1t[1], '#5ab0e0'); line(S1t[0], S1t[1], S2t[0], S2t[1], '#5ab0e0'); line(S2t[0], S2t[1], TR[0], TR[1], '#2a7ad0');   // 윗면 테(깎인 자리)
      line(S1b[0], t0 - 1, S1t[0], S1t[1] + 1, '#9fe0f8');        // 면 나눔 줄
      line(S2b[0], t0 - 1, S2t[0], S2t[1] + 1, '#2a7ad0');
    }
    // 뒤로 이어지는 낮은 얼음 등줄기(앞 얼음 밑동까지): 들쭉날쭉한 낮은 띠 + 작게 기운 혹
    var rh = Math.max(3, Math.round(Hh * 0.22)), x0 = 1, x1 = ax;
    var pts = [[x0, by + 1]];
    for (var x = x0, n = 0; x <= x1; x += 2, n++) pts.push([x, by - rh * Math.min(1, (x - x0) / 5) * (0.45 + rnd(60 + n) * 0.7)]);   // 뒤 끝은 낮게 → 앞 얼음 밑으로 스며듦
    pts.push([x1, by - rh]); pts.push([x1, by + 1]);
    poly(pts, '#7fd0f0');
    for (var m = 0; m * 5 < x1 - x0 - 4; m++) {   // 작게 앞으로 기운 얼음 혹(높이 들쭉날쭉)
      var nx = x0 + 3 + m * 5 + rnd(80 + m) * 2, nh = rh * (1.1 + rnd(90 + m) * 1.3);
      var nw = 2 + rnd(95 + m) * 1.5;   // 뭉툭한 혹(윗면이 잘린 사다리꼴)
      poly([[nx - nw, by + 1], [nx - nw + nh * T, by + 1 - nh], [nx + nw * 0.6 + nh * T * 0.9, by + 1 - nh * (0.7 + rnd(97 + m) * 0.25)], [nx + nw, by + 1]], m % 2 ? '#bff4ff' : '#9fe0f8');
      line(nx - nw + 1, by - 1, nx - nw + nh * T, by + 2 - nh, '#e8fbff');
    }
    // 뒤 작은 조각 → 큰 조각
    prism(ax - W * 0.5, W * 0.3, Hh * 0.55, 10);
    if (q.big) prism(ax + W * 0.45, W * 0.28, Hh * 0.4, 20);
    if (q.big) shard(ax, W * 0.38, Hh, 30);   // 마지막 빙산만 뾰족
    else prism(ax, W * 0.44, Hh, 30);
    // 땅에 묻힌 밑동은 진하게
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(42,122,208,0.7)'; g.fillRect(0, by - 1, cw, 2); g.globalCompositeOperation = 'source-over';
    // 도트 다듬기: 반투명 없애기 + 진한 테두리 한 줄(밑줄은 땅이라 안 둘림)
    var im = g.getImageData(0, 0, cw, ch), a = im.data, op = new Uint8Array(cw * ch), i, y;
    for (i = 0; i < cw * ch; i++) { op[i] = a[i * 4 + 3] >= 110 ? 1 : 0; a[i * 4 + 3] = op[i] ? 255 : 0; }
    for (y = 0; y < ch; y++) for (x = 0; x < cw; x++) {
      i = y * cw + x; if (op[i]) continue;
      if ((x > 0 && op[i - 1]) || (x < cw - 1 && op[i + 1]) || (y > 0 && op[i - cw]) || (y < ch - 1 && op[i + cw])) { a[i * 4] = 0x1a; a[i * 4 + 1] = 0x3a; a[i * 4 + 2] = 0x8a; a[i * 4 + 3] = 255; }
    }
    g.putImageData(im, 0, 0);
    return { c: c, ax: ax, T: T };
  }
  // 얼음 한 개(캐릭터와 깊이 순서로, addEnts): 땅 틈에서 기운 방향(뒤 아래 → 앞 위)으로 찌르듯 솟아오름 → 솟은 채 → 흔들리며 땅으로 꺼짐
  function drawCrag(ctx, camX, q) {
    var A = q.art, c = A.c, P = CRAG_PX, t = q.t, end = q.riseMs + q.C.lifeMs, u, flashA = 0, jx = 0;
    if (t < q.riseMs) { var v = t / q.riseMs; u = 1 - Math.pow(1 - v, 3); flashA = 0.7 * (1 - v); }
    else if (t < end) { u = 1; if (t < q.riseMs + 90) flashA = 0.35 * (1 - (t - q.riseMs) / 90); }
    else { u = Math.max(0, 1 - (t - end) / q.breakMs); jx = (Math.floor(t / 30) % 2 ? 1 : -1) * P * 0.5; }
    if (u <= 0.02) return;
    var hh = c.height * P, off = (1 - u) * hh, dx = -A.ax * P - off * A.T * 0.8, dy = -hh + off;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(snapPx(q.x - camX + jx), snapPx(q.z));
    ctx.scale(q.dir, 1);
    ctx.beginPath(); ctx.rect(-c.width * P - 20, -hh - 20, c.width * P * 2 + 40, hh + 21); ctx.clip();   // 땅 밑은 안 보임(틈에서 솟는 것처럼)
    if (t >= end) ctx.globalAlpha = Math.min(1, u * 1.6);
    ctx.drawImage(c, dx, dy, c.width * P, hh);
    if (flashA > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = flashA; ctx.drawImage(c, dx, dy, c.width * P, hh); }
    ctx.restore();
  }
  // 바닥(캐릭터 밑): 살짝 갈라진 땅 틈(얼음 줄을 따라 들쭉날쭉한 검은 틈 + 안쪽 푸른 빛) + 옆으로 뻗는 작은 금 + 옅은 서리
  function drawCragUnder(ctx, camX) {
    crags.forEach(function (q) {
      var end = q.riseMs + q.C.lifeMs, a = q.t < end ? Math.min(1, q.t / 60) : Math.max(0, 1 - (q.t - end) / (q.breakMs + 250));
      if (a <= 0) return;
      var x = q.x - camX, d = q.dir, open = Math.min(1, q.t / 120), L0 = (q.link || 8) * 0.55, L1 = q.w * 0.6 + q.h * 0.5 + 6;   // 틈은 얼음 끝보다 조금 앞까지(갈라진 땅이 보이게)
      function rnd(i) { var v = Math.sin(q.seed + i * 78.233) * 43758.5453; return v - Math.floor(v); }
      ctx.save();
      ctx.globalAlpha = 0.28 * a; ctx.fillStyle = '#cfefff';
      ctx.beginPath(); ctx.ellipse(x + d * (L1 - L0) * 0.5, q.z, (L0 + L1) * 0.6, 4, 0, 0, Math.PI * 2); ctx.fill();
      for (var s = -L0, n = 0; s <= L1; s += 2, n++) {   // 들쭉날쭉 틈(2도트씩)
        var px = Math.round(x + d * s), py = Math.round(q.z + (rnd(n) - 0.5) * 2.4), wd = Math.max(1, Math.round((1.2 + rnd(n + 50) * 1.6) * open));
        ctx.globalAlpha = 0.85 * a; ctx.fillStyle = '#2a1a10'; ctx.fillRect(px, py - Math.floor(wd / 2), 2, wd);
        ctx.globalAlpha = 0.7 * a; ctx.fillStyle = '#5ac8f0'; ctx.fillRect(px, py, 2, 1);
      }
      for (var i = 0; i < (q.big ? 4 : 2); i++) {   // 옆으로 뻗는 작은 금
        var sx = x + d * (rnd(i + 20) * L1), an = (rnd(i + 30) < 0.5 ? -1 : 1) * (0.5 + rnd(i + 40) * 0.6), L = (6 + rnd(i + 60) * 8) * open;
        ctx.globalAlpha = 0.7 * a; ctx.fillStyle = '#3a2616';
        for (var k = 0; k < L; k += 2) ctx.fillRect(Math.round(sx + d * Math.cos(an) * k * 0.6), Math.round(q.z + Math.sin(an) * k * 0.4), 2, 1);
      }
      ctx.restore();
    });
  }
  // 바닥(캐릭터 밑): 폭풍 땅 = 하얗게 서리 낀 넓은 타원 + 얼음 금(깨질 때 밝게)
  function drawFrostUnder(ctx, camX) {
    frosts.forEach(function (o) {
      var F = o.F, a = o.t < F.ms ? clamp(o.t / 200, 0, 1) : Math.max(0, 1 - (o.t - F.ms) / 600);
      if (a <= 0) return;
      var x = o.x - camX;
      ctx.save(); ctx.translate(x, o.z); ctx.scale(1, o.D / o.w);
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, o.w * 1.05);
      g.addColorStop(0, 'rgba(220,248,255,' + (0.42 * a).toFixed(3) + ')'); g.addColorStop(0.7, 'rgba(150,215,255,' + (0.25 * a).toFixed(3) + ')'); g.addColorStop(1, 'rgba(120,200,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, o.w * 1.05, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // 얼음 금(정해 둔 무늬)
      function rnd(i) { var v = Math.sin(o.seed + i * 12.9898) * 43758.5453; return v - Math.floor(v); }
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 1;
      ctx.globalAlpha = (o.done ? 0.9 : 0.4) * a;
      for (var i = 0; i < 9; i++) {
        var cx = x + (rnd(i) * 2 - 1) * o.w * 0.85, cz = o.z + (rnd(i + 20) * 2 - 1) * o.D * 0.8, L = 10 + rnd(i + 40) * 16;
        ctx.beginPath(); ctx.moveTo(cx - L, cz); ctx.lineTo(cx - L * 0.2, cz - 2); ctx.lineTo(cx + L * 0.3, cz + 1.5); ctx.lineTo(cx + L, cz - 1); ctx.stroke();
      }
      ctx.restore();
    });
  }
  // 캐릭터 위: 폭풍 하늘빛 기둥(위에서 내려오는 차가운 빛) + 비스듬히 쏟아지는 얼음 조각 + 휘도는 눈
  function drawFrosts(ctx, camX) {
    frosts.forEach(function (o) {
      var F = o.F, a = o.t < F.ms ? clamp(o.t / 200, 0, 1) : Math.max(0, 1 - (o.t - F.ms) / 300), x = o.x - camX;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      if (a > 0) {
        var g = ctx.createLinearGradient(0, o.z - 220, 0, o.z + o.D);
        g.addColorStop(0, 'rgba(120,200,255,0)'); g.addColorStop(0.6, 'rgba(160,225,255,' + (0.16 * a).toFixed(3) + ')'); g.addColorStop(1, 'rgba(220,248,255,' + (0.22 * a).toFixed(3) + ')');
        ctx.fillStyle = g; ctx.fillRect(x - o.w, o.z - 220, o.w * 2, 220 + o.D);
        var now = o.t / 1000;   // 휘도는 눈(가로로 흐르며 아래위로 흔들림)
        ctx.fillStyle = '#ffffff';
        for (var s2 = 0; s2 < 26; s2++) {
          var u = ((s2 * 0.137 + now * (0.35 + (s2 % 5) * 0.06)) % 1), sx = x - o.w + u * o.w * 2, sy = o.z - 20 - (s2 * 37 % 120) + Math.sin(now * 5 + s2) * 6;
          ctx.globalAlpha = 0.7 * a; ctx.fillRect(sx, sy, 1.6, 1.6);
        }
      }
      ctx.lineCap = 'round';
      o.flakes.forEach(function (f) {
        var u = f.t / f.life, px = f.x + (f.tx - f.x) * u - camX, py = f.y + (f.tz - f.y) * u, L = f.big ? 9 : 6;
        var vx = (f.tx - f.x), vy = (f.tz - f.y), vl = Math.hypot(vx, vy) || 1;
        ctx.globalAlpha = 0.55; ctx.strokeStyle = '#7fd8ff'; ctx.lineWidth = f.big ? 3 : 2;
        ctx.beginPath(); ctx.moveTo(px - vx / vl * L, py - vy / vl * L); ctx.lineTo(px, py); ctx.stroke();
        ctx.globalAlpha = 0.95; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = f.big ? 1.4 : 1;
        ctx.beginPath(); ctx.moveTo(px - vx / vl * L * 0.6, py - vy / vl * L * 0.6); ctx.lineTo(px, py); ctx.stroke();
      });
      ctx.restore();
    });
  }
  // 얼어붙은 적: 몸을 감싼 반투명 얼음 덩어리(하늘색 + 흰 테 + 비스듬한 빛줄) — 끝나기 직전 깜빡임
  function drawFrozen(ctx, camX) {
    H.targets().forEach(function (e) {
      if (!e || !e.T || !(e.frozenT > 0) || (e.alive && !e.alive())) return;
      if (e.frozenT < 250 && Math.floor(e.frozenT / 60) % 2) return;
      var w = Math.max(14, e.T.radius * 2.3), h = e.T.height * 1.02, x = e.x - camX - w / 2, y = e.y - (e.flyZ ? e.flyZ() : 0) - h, now = performance.now() / 1000;
      ctx.save();
      ctx.globalAlpha = 0.32; ctx.fillStyle = '#bfefff'; ctx.fillRect(x, y, w, h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.75; ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 1.2; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.globalAlpha = 0.5; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      var sh = (now * 0.6 + e.x * 0.01) % 1;
      ctx.beginPath(); ctx.moveTo(x + w * (sh * 1.4 - 0.2), y + h); ctx.lineTo(x + w * (sh * 1.4 + 0.15), y); ctx.stroke();
      ctx.restore();
    });
  }

  // ---- 천둥 심판(대마법사 Lv39, 폭딜 필살) ----
  // judge.at(1장) 에 과녁: 앞쪽 range 안(위아래 depth) — 보스 > 중간보스 > 체력이 가장 많은 적(소품 빼고). 없으면 법사 앞 x.
  //   strikeAt - lockMs 까지 과녁을 따라감(모으는 동안 바닥 표시) → strikeAt 에 거대한 번개 기둥(judgeStrike)
  //   앞쪽에 아무도 없으면 뒤쪽까지(range 안) 찾음(빙결 폭풍에 밀려 법사 뒤에 누운 적 등, 2026-11-08 시험에서 빈 땅에 떨어져 고침)
  function judgePick(p, J, skip, both) {
    var best = null, bs = -1;
    H.targets().forEach(function (t) {
      if (!t || t.isProp || t === skip || (t.alive && !t.alive())) return;   // 지금 못 맞는 적(넘어지는 중)도 과녁으로(내리꽂을 때는 대개 맞음)
      var dx = (t.x - p.x) * p.dir;
      if (both) dx = Math.abs(dx);
      if (dx < -6 * AS() || dx > J.aim.range || Math.abs(t.y - p.y) > J.aim.depth) return;
      var sc = (t.T && t.T.boss ? 3e6 : t.mid ? 2e6 : 0) + (t.hp || 0) - Math.abs(dx) * 0.01;
      if (sc > bs) { bs = sc; best = t; }
    });
    return best || (both ? null : judgePick(p, J, skip, true));
  }
  function judgeStep(p, d, s, t0, t1) {
    var J = d.judge;
    if (!s.jg && t1 >= J.at) {
      var tg = judgePick(p, J, null);
      s.jg = { tgt: tg, x: tg ? tg.x : p.x + p.dir * J.x, z: tg ? tg.y : p.y, t0: t1, sparkT: 0 };
      snd('charge');
    }
    if (!s.jg || s.jgDone) return;
    var g = s.jg.tgt;
    if (g && t1 < J.strikeAt - (J.lockMs || 100) && (!g.alive || g.alive())) { s.jg.x = g.x; s.jg.z = g.y; }
    s.jg.sparkT -= t1 - t0;
    if (s.jg.sparkT <= 0) {   // 모으는 동안: 지팡이 둘레 · 과녁 위로 작은 전기 불티
      s.jg.sparkT = 50;
      debris(p.x + p.dir * 14 * AS(), p.y - 70 * AS(), p.y, 2, { cols: ['#ffffff', '#bff8ff', '#fff6a0'], glow: true, sp: 120, size: 1.2, ms: 220, spread: 2.4 });
      debris(s.jg.x, s.jg.z - 4, s.jg.z, 1, { cols: ['#ffffff', '#5ae6ff'], glow: true, sp: 90, size: 1.2, ms: 260, g: -200, spread: 0.4 });
    }
    if (t1 >= J.strikeAt) {
      s.jgDone = true;
      var o = { x: s.jg.x, z: s.jg.z, tgt: s.jg.tgt, dir: p.dir, wk: p.weaponKey, mul: s.mul, d: d, nb: (s.L.lv5 && s.L.lv5.bolts) || J.bolts };
      judgeStrike(o, 1, true);
      if (s.echo) {   // 각성 마력 폭주: 다음으로 센 적(없으면 같은 자리 조금 앞)에게 기둥 하나 더(60%)
        var px = p.x, pz = p.y, pd = p.dir;
        echo(d, function () {
          var t2 = judgePick({ x: px, y: pz, dir: pd }, J, o.tgt);
          judgeStrike({ x: t2 ? t2.x : o.x + pd * 50 * AS(), z: t2 ? t2.y : o.z, tgt: t2, dir: pd, wk: o.wk, mul: o.mul, d: d, nb: Math.ceil(o.nb / 2) }, 0.6, false);
        });
      }
    }
  }
  var JUDGE_LOOK = { art: 'lightning_bolt', color: '#59e6ff', core: '#ffffff', glow: '#fff27a' };   // 둘레 번개 = 번개 기술 그림
  function judgeStrike(o, mulK, first) {
    var J = o.d.judge, h = J.hit, st = stOf(h, o.d), R = J.r, D = J.depth, any = false;
    snd('lightning'); snd('meteorBoom'); if (first) snd('lightning', { k: 0.7 });
    judges.push({ x: o.x, z: o.z, t: 0, life: 620, k: first ? 1 : 0.7, seed: Math.random() * 1000 });
    H.hitstop(first ? 150 : 90);
    FX.shake(CFG.juice.shakePx * (first ? 5 : 3), CFG.juice.shakeMs * 2.4);
    doFlash(first ? h.flash : { color: '#e8ffff', alpha: 0.45, ms: 180 });
    glow(o.x, o.z - 60 * AS(), 120 * AS() / 0.55, '#bff8ff', 460, 0.9);
    glow(o.x, o.z - 20 * AS(), 60 * AS() / 0.55, '#ffffff', 260, 0.9);
    wave(o.x, o.z, 150, { flat: 0.3, w: 6, ms: 520, color: '#ffffff', glow: '#59e6ff', ground: true });
    wave(o.x, o.z, 80, { flat: 0.3, w: 4, ms: 340, color: '#fff6a0', glow: '#ffd23f', ground: true });
    wave(o.x, o.z - 60 * AS(), 90, { flat: 0.85, w: 4, ms: 360, color: '#e8ffff', glow: '#59e6ff' });
    debris(o.x, o.z - 6, o.z, first ? 26 : 14, { cols: ['#ffffff', '#bff8ff', '#fff6a0', '#59e6ff'], glow: true, sp: 320, size: 1.8, ms: 560, spread: 1.6 });
    debris(o.x, o.z - 4, o.z, first ? 12 : 6, { cols: ['#3a3038', '#5a4e58', '#2a2020'], sp: 220, size: 2.6, ms: 800 });
    H.dust(o.x - 16 * AS(), o.z, -1); H.dust(o.x + 16 * AS(), o.z, 1);
    H.targets().forEach(function (t) {
      if (!t || !H.canHit(t, h)) return;
      if (t !== o.tgt && !inBox(t, o.x, o.z, R, D)) return;
      var dir = Math.abs(t.x - o.x) < 3 ? o.dir : (t.x > o.x ? 1 : -1);
      H.onHit(st, t, { dir: dir, wk: o.wk, x: t.x, y: t.y - 50 * AS(), mul: o.mul * mulK });
      t.stunKind = 'shock';
      any = true;
    });
    if (any && first && h.slowMs) H.slow(h.slowMs);
    // 둘레 번개: 과녁 둘레(spread) 다른 적 가까운 순 → 모자라면 둘레 빈 땅. gapMs 마다 하나씩
    var others = [];
    H.targets().forEach(function (t) {
      if (!t || t.isProp || t === o.tgt || (t.alive && !t.alive())) return;
      var dd = Math.abs(t.x - o.x) + Math.abs(t.y - o.z);
      if (Math.abs(t.x - o.x) <= J.spread && Math.abs(t.y - o.z) <= J.aim.depth) others.push({ t: t, d: dd });
    });
    others.sort(function (a, b) { return a.d - b.d; });
    for (var k = 0; k < o.nb; k++) {
      var e = others[k] && others[k].t, an = k * 2.39 + Math.random() * 0.6, rr = J.spread * (0.45 + 0.55 * Math.random());
      jbolts.push({ t: J.gapMs * (k + 1), tgt: e || null, x: e ? e.x : o.x + Math.cos(an) * rr, z: e ? e.y : o.z + Math.sin(an) * J.aim.depth * 0.6,
                    o: o, mulK: mulK, lv: curLv });
    }
  }
  function judgeTick(dt) {
    for (var i = jbolts.length - 1; i >= 0; i--) {
      var b = jbolts[i]; b.t -= dt;
      if (b.tgt && (!b.tgt.alive || b.tgt.alive())) { b.x = b.tgt.x; b.z = b.tgt.y; }
      if (b.t <= 0) { jbolts.splice(i, 1); (function (b) { atLv(b.lv, function () { judgeBolt(b); }); })(b); }
    }
  }
  function judgeBolt(b) {
    var o = b.o, J = o.d.judge, h = J.boltHit, st = stOf(h, o.d), any = false;
    snd('lightning', { v: 0.6 });
    bolts.push({ x: b.x, z: b.z, t: 0, life: 200, K: JUDGE_LOOK, seed: Math.random() * 1000 });
    var hitA = fxArt('lightning_impact');
    if (hitA) spriteFrom(b.x, b.z, hitA.fr, hitA.fps, hitA.pivot, o.dir < 0, 1, 1);
    glow(b.x, b.z - 20 * AS(), 30 * AS() / 0.55, '#9ff4ff', 200, 0.8);
    wave(b.x, b.z, J.boltR * 2.4, { flat: 0.3, w: 3, ms: 300, color: '#f4ffff', glow: '#59e6ff', ground: true, noMax: true });
    debris(b.x, b.z - 4, b.z, 6, { cols: ['#ffffff', '#bff8ff', '#fff6a0'], glow: true, sp: 180, size: 1.4, ms: 360, spread: 1.4 });
    FX.shake(CFG.juice.shakePx * 1.4, CFG.juice.shakeMs);
    H.targets().forEach(function (t) {
      if (!t || !H.canHit(t, h) || !inBox(t, b.x, b.z, J.boltR, J.boltDepth)) return;
      var dir = Math.abs(t.x - b.x) < 3 ? o.dir : (t.x > b.x ? 1 : -1);
      H.onHit(st, t, { dir: dir, wk: o.wk, x: b.x, y: t.y - 40 * AS(), mul: o.mul * b.mulK });
      t.stunKind = 'shock';
      any = true;
    });
    if (any && h.flash) doFlash(h.flash);
  }
  // 모으는 동안 바닥 과녁(캐릭터 밑): 깜빡이며 좁혀지는 두 겹 고리 + 십자 눈금 + 하늘에서 내려오는 가는 빛줄
  function drawJudgeMark(ctx, camX, p) {
    var s = p && p.state === 'skill' && p.sk, J = s && s.d.judge;
    if (!J || !s.jg || s.jgDone) return;
    var u = clamp((s.t - s.jg.t0) / Math.max(1, J.strikeAt - s.jg.t0), 0, 1), x = s.jg.x - camX, z = s.jg.z, R = J.r * (2.4 - 1.4 * u), bl = Math.floor(s.t / 60) % 2;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 + 0.4 * u; ctx.strokeStyle = bl ? '#fff27a' : '#5ae6ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, z, R, R * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.35 + 0.4 * u; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, z, J.r, J.r * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - J.r * 1.3, z); ctx.lineTo(x + J.r * 1.3, z); ctx.moveTo(x, z - J.r * 0.4); ctx.lineTo(x, z + J.r * 0.4); ctx.stroke();
    var g = ctx.createLinearGradient(0, 0, 0, z);
    g.addColorStop(0, 'rgba(190,248,255,0)'); g.addColorStop(1, 'rgba(190,248,255,' + (0.35 * u).toFixed(3) + ')');
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(x - 2 - 3 * u, 0, 4 + 6 * u, z);
    ctx.restore();
  }
  // 거대한 번개 기둥(캐릭터 위): 넓은 하늘빛 기둥(바깥 빛) + 지그재그 굵은 번개 심(흰색, 깜빡이며 모양이 바뀜) + 땅 닿은 곳 큰 빛 → 가늘어지며 사라짐
  function drawJudges(ctx, camX) {
    judges.forEach(function (j) {
      var u = j.t / j.life, x = j.x - camX, gy = j.z - 2, a = u < 0.15 ? 1 : Math.max(0, 1 - (u - 0.15) / 0.85), W = 34 * j.k * (1.25 - 0.75 * u);
      if (a <= 0) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      var g = ctx.createLinearGradient(x - W * 1.8, 0, x + W * 1.8, 0);
      g.addColorStop(0, 'rgba(90,230,255,0)'); g.addColorStop(0.35, 'rgba(120,235,255,' + (0.35 * a).toFixed(3) + ')');
      g.addColorStop(0.5, 'rgba(240,255,255,' + (0.85 * a).toFixed(3) + ')'); g.addColorStop(0.65, 'rgba(120,235,255,' + (0.35 * a).toFixed(3) + ')'); g.addColorStop(1, 'rgba(90,230,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - W * 1.8, 0, W * 3.6, gy);
      if (!(u > 0.5 && Math.floor(j.t / 45) % 2)) {
        var seed = j.seed + Math.floor(j.t / 55) * 7.3, n = 12, pts = [];
        function rnd(i) { var v = Math.sin(seed + i * 91.3) * 43758.5453; return v - Math.floor(v); }
        for (var i = 0; i <= n; i++) pts.push([x + (i === 0 || i === n ? 0 : (rnd(i) * 2 - 1) * W * 0.5), gy * i / n]);
        [[W * 0.9, '#59e6ff', 0.55], [W * 0.45, '#bff8ff', 0.9], [Math.max(2, W * 0.18), '#ffffff', 1]].forEach(function (L) {
          ctx.globalAlpha = L[2] * a; ctx.strokeStyle = L[1]; ctx.lineWidth = L[0];
          ctx.beginPath(); pts.forEach(function (q, k) { if (k) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.stroke();
        });
        // 가지 번개 2줄기
        ctx.globalAlpha = 0.8 * a; ctx.strokeStyle = '#e8ffff'; ctx.lineWidth = 1.5;
        for (var b = 0; b < 2; b++) {
          var k0 = 4 + b * 3, q0 = pts[k0], sd = b ? 1 : -1;
          ctx.beginPath(); ctx.moveTo(q0[0], q0[1]);
          ctx.lineTo(q0[0] + sd * (14 + rnd(50 + b) * 10), q0[1] + 16); ctx.lineTo(q0[0] + sd * (22 + rnd(60 + b) * 14), q0[1] + 36); ctx.stroke();
        }
      }
      ctx.save(); ctx.translate(x, gy); ctx.scale(1, 0.3);   // 땅 닿은 곳
      var r = 70 * j.k * (0.8 + 0.4 * u), gg = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      gg.addColorStop(0, 'rgba(255,255,255,' + (0.9 * a).toFixed(3) + ')'); gg.addColorStop(0.4, 'rgba(160,240,255,' + (0.5 * a).toFixed(3) + ')'); gg.addColorStop(1, 'rgba(90,230,255,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.restore();
    });
  }
  // 매 장면(법사 새 기술): 조각 · 구체 · 소용돌이 · 연쇄 · 폭풍 · 심판 + 얼어붙은 시간 줄이기
  function mageStep(dt) {
    eshardStep(dt); gravStep(dt); vortexStep(dt); vortexTick(dt); chainStep(dt); frostStep(dt); cragStep(dt); judgeTick(dt);
    for (var i = judges.length - 1; i >= 0; i--) { judges[i].t += dt; if (judges[i].t >= judges[i].life) judges.splice(i, 1); }
    H.targets().forEach(function (t) { if (t && t.frozenT > 0) t.frozenT -= dt; });
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
    crossStep(dt); aegisStep(H.player && H.player(), dt);              // 성기사 기술(2026-11-08)
    shardStep(dt); pullStep(dt);                                       // 칼날 파편 · 끌어당기는 검압(2026-11-08)
    mageStep(dt);                                                      // 법사 새 기술 · 대마법사(2026-11-08)
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
    drawCrossMarks(ctx, camX);    // 심판의 십자 땅에 새긴 십자(2026-11-08)
    drawGravUnder(ctx, camX); drawFrostUnder(ctx, camX); drawCragUnder(ctx, camX); drawJudgeMark(ctx, camX, p);   // 중력 구체 바닥 · 빙결 폭풍 땅 · 천둥 심판 과녁(2026-11-08)
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
    var pl = H.player && H.player();
    if (pl) drawAegis(ctx, camX, pl);   // 신성 가호 금빛 기운 = 캐릭터 바로 뒤(2026-11-08)
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
    drawCrossBeams(ctx, camX); drawBarrier(ctx, camX);   // 심판의 십자 빛기둥 · 성스러운 돌격 방패(2026-11-08)
    drawPulls(ctx, camX); drawShards(ctx, camX);         // 끌어당기는 검압 바람 줄 · 칼날 파편(2026-11-08)
    drawFrozen(ctx, camX); drawFrosts(ctx, camX); drawVortexes(ctx, camX); drawGravs(ctx, camX); drawJudges(ctx, camX); drawEshards(ctx, camX);   // 법사 새 기술(2026-11-08)
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
      // 2026-11-08 연속 2번: 쿨타임 = 두 번 다 쓴 뒤만(p.dodgeInfo), n = 남은 회피 수
      var DI = p.dodgeInfo();
      return { id: 'dodge', key: 'dodge', name: '회피', icon: '회', rem: DI.rem, cd: DI.cd, frac: Math.round(DI.frac * 100) / 100, cost: 0, nomp: false, dodge: true, n: DI.n, max: DI.max };
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
    drawBackdrop: drawBackdrop, drawUnder: drawUnder, drawGhosts: drawGhosts, drawAegisFront: drawAegisFront, drawOver: drawOver, drawFlash: drawFlash, drawDebug: drawDebug,
    armored: armored, ui: ui, shakeSlot: shakeSlot, slots: SLOTS, lvStat: lvStat, slotSkill: slotSkill, slotState: slotState,
    _meteors: function () { return meteors; },   // 시험용
    // 떨어지는 중인 운석 자리(2026-11-06 무기 속성: 운석에도 속성 꼬리, js/enchant.js)
    meteorsNow: function () { return meteors.filter(function (m) { return !m.boom && m.t >= m.M.markMs; }).map(function (m) { return meteorPos(m, clamp((m.t - m.M.markMs) / m.M.fallMs, 0, 1)); }); },
    // 2차 기술(2026-11-06): 늘 켜진 기술(main.js 가 부름) · 순간이동 숨기 · 시험용
    eshardHit: eshardHit, chainKill: chainKill,   // 법사 늘 켜진 기술(2026-11-08): 원소 파편(마법이 맞을 때) · 원소 연쇄(마법으로 쓰러질 때)
    shardKill: shardKill, comboPull: comboPull,   // 1차 기사 늘 켜진 기술(2026-11-08): 칼날 파편(적이 쓰러질 때) · 끌어당기는 검압(콤보 마무리 타 시작)
    gritBonus: gritBonus, tryCounter: tryCounter, shieldSplit: shieldSplit, shieldHit: shieldHit, brandMul: brandMul, brandMark: brandMark,
    hidden: hidden, test: TEST, _fx: function () { return { blades: blades.length, flames: flames.length, beams: beams.length, arcs: arcs.length, shield: !!shieldFx, crosses: crosses.length, shards: shardFx.length, pulls: pulls.length, gravs: gravs.length, eshards: eshFx.length, vortexes: vortexes.length, chains: chainQ.length, frosts: frosts.length, crags: crags.length, cragRows: cragRows.length, judges: judges.length }; },
    clear: function () { gravs.length = 0; eshFx.length = 0; eshT = 0; vortexes.length = 0; vortexT = 0; chainQ.length = 0; chainN = 0; frosts.length = 0; cragRows.length = 0; crags.length = 0; judges.length = 0; jbolts.length = 0; crosses.length = 0; aegisT = 0; shardFx.length = 0; shardQ.length = 0; shardN = 0; pulls.length = 0; tornados.length = 0; blades.length = 0; flames.length = 0; beams.length = 0; arcs.length = 0; shieldFx = null; gritOn = false; curLv = 1; meteors.length = 0; pillars.length = 0; echoes.length = 0; bright = 1; noMpT = 0; bolts.length = 0; rings.length = 0; ghosts.length = 0; arts.length = 0; waves.length = 0; parts.length = 0; glows.length = 0; flash = null; },
    // 화면 번쩍(콤보 마무리 타도 씀): { color, alpha, ms }
    flash: function (f) { doFlash(f); },
    // 파편·둥근 빛(소품 나뭇조각·음식 반짝임도 씀, props.js)
    debris: debris, glow: glow,

    state: function () { return { bolts: bolts.length, rings: rings.length, ghosts: ghosts.length, arts: arts.length, flash: !!flash, meteors: meteors.length, casts: casts }; }
  };
})();
