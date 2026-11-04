// 직업 기술 (기사 돌진베기·회전베기 / 법사 화염구·번개, 2026-11-03)
// 시작 조건·쿨타임·진행(이동·판정·효과)·화면 효과(어둡게·번쩍·잔상·번개)·버튼 표시를 여기서 한다.
// 수치는 전부 config.js 의 SKILLS (CFG.skills). 맞았을 때 데미지·불똥·숫자는 main.js 의 onHit 를 그대로 쓴다.
// 기술 = 동작(motion, 몸 그림 묶음) + 효과(fx 그림). 판정·효과 시각은 config 에 「장 번호」로 적고 여기서 동작의 ms 로 바꾼다.
// 동작·효과 그림이 없으면 기존 그림(공격 그림·베기·마법 효과)을 시간만 바꾸거나 색을 물들여서 쓴다(placeholder).
(function () {
  var CFG = null, H = null;      // H = main.js 가 넘겨주는 도구 { onHit, targets, dust, fx, hitstop, slow }
  var cache = {};
  var bolts = [], rings = [], ghosts = [], arts = [];   // arts = 효과 그림(따라다니기·돌리기·날아가기·캐릭터 뒤)
  // 2026-11-03 HD 화려하게: waves = 퍼지는 충격파 고리(땅 = 납작한 타원 / 공중 = 원), parts = 튀는 파편·불티(중력), glows = 번쩍 빛(더하기)
  var waves = [], parts = [], glows = [];
  function SM() { return ((CFG && CFG.view.renderScale) || 1) > 1; }   // 매끈한 화면이면 코드로 그린 효과도 부드럽게
  // 충격파: x,y = 가운데, r = 끝 반지름(도트), flat = 세로 비율(땅 고리 0.3, 공중 1), w = 굵기, ms, color, ground = 캐릭터 밑에 그림
  function wave(x, y, r, o) {
    o = o || {};
    waves.push({ x: x, y: y, r: r, flat: o.flat == null ? 0.3 : o.flat, w: o.w || 3, t: 0, life: o.ms || 320, color: o.color || '#ffffff',
                 glow: o.glow || o.color || '#ffffff', ground: !!o.ground, r0: o.r0 || r * 0.15 });
  }
  // 파편 n 개: x,y 에서 위·옆으로 튐, floor = 떨어지는 땅 높이(그 밑으로 안 감), cols = 색 목록, size = 크기(도트), sp = 속도
  function debris(x, y, floor, n, o) {
    o = o || {};
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (Math.random() * 2 - 1) * (o.spread || 1.25), sp = (o.sp || 150) * (0.45 + Math.random() * 0.75) * AS() / 0.55;
      parts.push({ x: x + (Math.random() * 2 - 1) * 4, y: y + (Math.random() * 2 - 1) * 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, floor: floor,
                   g: (o.g || 520) * AS() / 0.55, t: 0, life: (o.ms || 650) * (0.6 + Math.random() * 0.5),
                   size: (o.size || 2.2) * (0.6 + Math.random() * 0.8), col: o.cols[i % o.cols.length], glow: !!o.glow, rot: Math.random() * 6, vr: (Math.random() * 2 - 1) * 14 });
    }
  }
  // 둥근 빛(더하기 합성): r = 반지름(도트), ms 동안 커지며 사라짐
  function glow(x, y, r, color, ms, a) { glows.push({ x: x, y: y, r: r, color: color, t: 0, life: ms || 220, a: a == null ? 0.8 : a }); }
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
  function resolve(cls, slot, gender) {
    var key = cls + '.' + slot + '.' + gender;
    if (key in cache) return cache[key];
    var S = CFG.skills && CFG.skills[cls], base = S && S[slot], o = null;
    if (base && typeof base === 'object') {
      o = {}; var k;
      for (k in base) if (k !== 'male' && k !== 'female') o[k] = base[k];
      var ov = base[gender];
      if (ov) for (k in ov) o[k] = ov[k];
      o.key = cls + '.' + slot; o.slot = slot; o.cls = cls;
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
    if (o.strikes && !Array.isArray(o.strikes.at)) {
      var t0 = st(o.strikes.frame), gap = o.strikes.gapMs || 120;
      o.strikes = cp(o.strikes, { at: o.strikes.x.map(function (x, k) { return t0 + k * gap; }) });
    }
  }
  function defFor(p, slot) { return p.classKey ? resolve(p.classKey, slot, p.gender || 'male') : null; }

  // 효과 그림(CFG.skillFx 이름): 불러와져 있으면 { fr = 그림들, fps, pivot(줄인 크기 기준), loop }, 없으면 null
  function fxArt(name, fps) {
    var F = H.fx(), fr = name && F && F['skill_' + name];
    if (!fr || !fr.length) return null;
    var M = CFG.magic['skill_' + name], S = CFG.skillFx[name] || {};
    return { fr: fr, fps: fps || S.fps || 16, pivot: M ? M.pivot : centerPivot(fr), loop: !!S.loop };
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

  // ---------- 시작 ----------
  // 눌린 기술 중 쓸 수 있는 것(쿨타임 끝남) 하나. 이 직업에 없는 기술은 입력을 버림. 쿨타임 중이면 입력을 잠깐 기억(버퍼)
  function pick(p) {
    var B = CFG.skills.bufferMs || 300, got = null;
    ['A', 'B'].forEach(function (slot) {
      if (got || !Input.peekSkill(slot, B)) return;
      var d = defFor(p, slot);
      if (!d) { Input.clearSkill(slot); return; }
      if ((p.skillCd[d.key] || 0) > 0) return;
      Input.takeSkill(slot, B); got = d;
    });
    return got;
  }

  function start(p, d) {
    var ax = Input.axis(CFG).x;              // 누르는 방향으로 돌아서 쓴다
    if (ax > 0.3) p.dir = 1; else if (ax < -0.3) p.dir = -1;
    p.state = 'skill'; p.atk = null; p.animT = 0; p.comboStep = 0;
    var s = p.sk = { d: d, t: 0, x0: p.x, z: p.y, dir: p.dir, done: {}, hitWin: {}, fxDone: {}, hitAny: false,
                     finaleDone: false, cast: false, strikeDone: {}, ghostT: 0, boxes: [], exitT: 0 };
    if (d.strikes) {
      s.sx = d.strikes.x.map(function (x) { return p.x + p.dir * x; });   // 적이 없을 때 고정 자리
      s.sz = d.strikes.x.map(function () { return p.y; });
      s.aimT = aimTargets(p, d.strikes);
    }
    p.skillCd[d.key] = d.cooldownMs;
  }

  // ---------- 진행 (매 장면). 끝나면 true ----------
  function advance(p, dt) {
    var s = p.sk, d = s.d, t0 = s.t, t1 = s.t + dt;
    s.t = t1; s.boxes = [];
    // 돌진: from~to 동안 dist 만큼(처음 빠르게)
    if (d.move) {
      var m = d.move, len = Math.max(1, m.to - m.from);
      var u0 = ease(clamp((t0 - m.from) / len, 0, 1)), u1 = ease(clamp((t1 - m.from) / len, 0, 1));
      p.x += s.dir * m.dist * (u1 - u0);
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
    if (d.cast && !s.cast && t1 >= d.cast.at) { s.cast = true; castFireball(p, d); }
    if (d.strikes) {
      var K = d.strikes;
      lockStrikes(s, K);
      K.at.forEach(function (at, k) {
        if (!s.strikeDone[k] && t1 >= at) { s.strikeDone[k] = true; strike(p, d, k); }
      });
    }
    return t1 >= d.ms;
  }

  // 번개가 겨눌 적: 앞쪽(바라보는 쪽) range 안, 위아래 aim.depth 안, 가까운 순. 1번 = 가장 가까운 적, 2·3번 = 그다음(적이 모자라면 마지막 적 다시)
  //   소품(상자·통, isProp)은 안 겨눔 (떨어진 번개에 같이 맞는 것은 됨)
  function aimTargets(p, K) {
    var A = K.aim; if (!A) return null;
    var list = [];
    H.targets().forEach(function (t) {
      if (!t || t.isProp || (t.canBeHit && !t.canBeHit()) || (t.alive && !t.alive())) return;
      var dx = (t.x - p.x) * p.dir;
      if (dx < -6 * AS() || dx > A.range || Math.abs(t.y - p.y) > A.depth) return;
      list.push({ t: t, d: Math.abs(dx) + Math.abs(t.y - p.y) * 0.5 });
    });
    if (!list.length) return null;
    list.sort(function (a, b) { return a.d - b.d; });
    return K.x.map(function (x, k) { return list[Math.min(k, list.length - 1)].t; });
  }
  // 번개 자리: 바닥 표시가 뜨면(markMs 전) 겨눈 적의 발밑을 따라가다가, 떨어지기 lockMs 전에 고정(그 뒤로는 안 움직임 → 피할 틈)
  function lockStrikes(s, K) {
    if (!s.aimT) return;
    var lockMs = K.lockMs != null ? K.lockMs : 90;
    K.at.forEach(function (at, k) {
      if (s.locked && s.locked[k]) return;
      if (s.t < at - (K.markMs || 200)) return;
      var t = s.aimT[k];
      if (t && (!t.alive || t.alive())) { s.sx[k] = t.x; s.sz[k] = t.y; }
      if (s.t >= at - lockMs) { s.locked = s.locked || {}; s.locked[k] = true; }
    });
  }

  // 지금 시각이 무적 구간인지
  function invulnerable(p) {
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
    if (usingArt(p)) return { anim: d.motion, idx: Math.min(A[d.motion].length - 1, seqIdx(d.frameMs, s.t)) };
    var ph = d.placeholder;
    if (!ph || !A[ph.anim]) return { anim: 'idle', idx: 0 };
    var i = seqIdx(ph.d, s.t);
    return { anim: ph.anim, idx: Math.min(A[ph.anim].length - 1, ph.f[Math.min(ph.f.length - 1, i)]) };
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
  function boxOf(p, r) {
    var xa = p.x + r.x0 * p.dir, xb = p.x + r.x1 * p.dir;
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
    var s = p.sk, box = boxOf(p, h.reach), done = s.done[i] || (s.done[i] = {});
    s.boxes.push(box);
    H.targets().forEach(function (t) {
      if (!t) return;
      var id = t.id || 'dummy';
      if (done[id] || (t.canBeHit && !t.canBeHit())) return;
      if (!overlap(box, t.hurtbox())) return;
      done[id] = true;
      var dir = p.dir;
      if (h.away && Math.abs(t.x - p.x) > 2) dir = t.x > p.x ? 1 : -1;   // 몸에서 바깥쪽으로(뒤에 있는 적은 뒤로)
      var first = !s.hitWin[i];
      s.hitWin[i] = true; s.hitAny = true;
      H.onHit(stOf(h, d), t, { dir: dir, wk: p.weaponKey, x: p.x + dir * 24 * AS(), y: p.y + (h.hitY != null ? h.hitY : -56 * AS()) });
      if (first) impact(h);
    });
  }
  // 처음 맞은 순간 한 번: 화면 번쩍 + 슬로모션
  function impact(h) {
    if (h.flash) doFlash(h.flash);
    if (h.slowMs) H.slow(h.slowMs);
  }
  function doFlash(f) {
    if (flash && flash.alpha * (1 - flash.t / flash.life) > f.alpha) return;
    flash = { color: f.color, alpha: f.alpha, t: 0, life: f.ms || 120 };
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
  function playFx(p, f) {
    var dir = f.back ? -p.dir : p.dir, x = p.x + dir * (f.x || 0), y = p.y + (f.y || 0);
    if (f.type === 'dust') { H.dust(p.x - p.dir * 10 * AS(), p.y, p.dir); return; }
    if (f.type === 'thrust') { FX.thrust(x, y, dir, f.len || 60, f.color || '#ffffff', f.ms || 200); return; }
    if (f.type === 'ring') {
      rings.push({ x: p.x, y: y, r: f.r || 60, t: 0, life: f.ms || 160, color: f.color || '#ffffff' });
      if (SM()) { wave(p.x, p.y, (f.r || 60) * 1.25, { flat: 0.3, w: 4, ms: (f.ms || 160) * 1.6, color: '#ffffff', glow: '#8fc4ff', ground: true }); glow(p.x, y, (f.r || 60) * 0.8, '#cfe6ff', 200, 0.6); }
      return;
    }
    if (f.type === 'art') {   // 효과 그림: 없으면 ph(대신 쓸 효과)
      var A = fxArt(f.fx, f.fps);
      if (!A) { if (f.ph) playFx(p, f.ph); return; }
      arts.push({ A: A, p: p, follow: !!f.follow, ox: f.x || 0, oy: f.y || 0, x: x, y: y, dir: dir, rot: f.rot || 0, vx: f.vx || 0,
                  back: f.layer === 'back', split: !!f.split, alpha: f.alpha == null ? 1 : f.alpha,
                  scale: f.scale || 1, t: 0, life: A.loop ? (f.ms || 600) : A.fr.length * 1000 / A.fps });
      return;
    }
    if (f.type === 'spark') {
      var M = CFG.magic.spark, fr = tintFx(M.frames, f.tint, 0.6);
      if (fr) FX.sprite(x, y, fr, M.fps, M.pivot, dir < 0, false, f.scale || 1);
      return;
    }
    if (f.type === 'slash') {
      var spr = tintFx('slash', f.tint, 0.55), arc = { from: -100, to: 40, r: 50 * AS(), w: 10 * AS() };
      FX.slash(x, y, dir, arc, f.tint || '#ffffff', f.ms || 200, spr, { rot: f.rot, sx: f.sx, sy: f.sy, flipY: f.flipY, top: true });
    }
  }

  // 화염구: 느리고 큰 불덩이 → 처음 맞은 적(또는 끝)에서 터짐
  function castFireball(p, d) {
    var c = d.cast, real = fxArt(c.art), B = CFG.magic.bolt;
    var fr = real ? real.fr : tintFx(B.frames, c.tint, c.tintK);
    Projectiles.spawn({ x: p.x + p.dir * c.x, y: p.y + c.y, z: p.y, dir: p.dir, speed: c.speed, range: c.range, box: c.box, depth: c.depth,
      burstAtEnd: true, backReach: c.backReach || 0, frames: fr, fps: real ? real.fps : B.fps,
      pivot: real ? real.pivot : B.pivot, scale: real ? 1 : (c.scale || 1),
      skill: { d: d, c: c, wk: p.weaponKey, emberT: 0 },
      glow: SM() ? fireGlow : null,

      onImpact: function (pr, t) { fireBurst(pr, t); } });
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

    var S = pr.skill, c = S.c, b = c.burst, real = fxArt(b.art), M = CFG.magic.burst;
    if (real) spriteFrom(pr.x, pr.y, real.fr, real.fps, real.pivot, pr.dir < 0, 1, b.fromFrame);
    else { var fr = tintFx(M.frames, b.tint, b.tintK); if (fr) spriteFrom(pr.x, pr.y, fr, M.fps, M.pivot, pr.dir < 0, b.scale || 1, b.fromFrame); }
    FX.shake(CFG.juice.shakePx * 2.2, CFG.juice.shakeMs * 1.6);
    doFlash(c.hit.flash || { color: '#ffb060', alpha: 0.3, ms: 120 });
    // 크고 화려하게(2026-11-03 HD): 불빛 → 공중 충격파 고리 + 땅 충격파 + 불티·돌 파편
    glow(pr.x, pr.y, b.r * 1.5, '#ffb050', 320, 0.9);
    wave(pr.x, pr.y, b.r * 1.35, { flat: 0.75, w: 5, ms: 340, color: '#fff2c0', glow: '#ff7a1a' });
    wave(pr.x, pr.z, b.r * 1.7, { flat: 0.3, w: 4, ms: 420, color: '#ffd28a', glow: '#ff5a10', ground: true });
    debris(pr.x, pr.y, pr.z, 16, { cols: ['#ffd27a', '#ff8a2a', '#ff5a1e', '#fff4d0'], glow: true, sp: 210, size: 2, ms: 600 });
    debris(pr.x, pr.y + 6 * AS(), pr.z, 9, { cols: ['#5a3a26', '#7a5236', '#3e2a1e'], sp: 170, size: 2.6, ms: 800 });
    var st = stOf(c.hit, S.d), any = false;
    H.targets().forEach(function (t) {
      if (!t || (t.canBeHit && !t.canBeHit())) return;
      var hb = t.hurtbox();
      if (t !== direct) {
        if (Math.abs(hb.z - pr.z) > b.depth) return;
        var nx = clamp(pr.x, hb.x0, hb.x1), ny = clamp(pr.y, hb.y0, hb.y1);
        if (Math.hypot(nx - pr.x, ny - pr.y) > b.r) return;
      }
      var dir = Math.abs(t.x - pr.x) < 4 ? pr.dir : (t.x > pr.x ? 1 : -1);
      H.onHit(st, t, { dir: dir, wk: S.wk, x: pr.x, y: pr.y });
      any = true;
    });
    if (any && c.hit.slowMs) H.slow(c.hit.slowMs);
  }

  // 번개 한 줄기: 정해 둔 바닥 자리(sx[k], sz[k] = 겨눈 적 발밑 또는 법사 앞 고정 자리)에 화면 맨 위에서 내리꽂힘
  function strike(p, d, k) {
    var s = p.sk, K = d.strikes, x = s.sx[k], z = s.sz[k], h = K.hits[Math.min(k, K.hits.length - 1)];
    bolts.push({ x: x, z: z, t: 0, life: K.ms || 200, K: K, seed: Math.random() * 1000 });
    var hitA = fxArt(K.hitArt), M = CFG.magic.spark;
    if (hitA) spriteFrom(x, z, hitA.fr, hitA.fps, hitA.pivot, s.dir < 0, 1, K.hitFromFrame);   // 땅 번쩍(기준 = 아래 가운데)
    else { var fr = tintFx(M.frames, K.glow || '#fff27a', 0.55); if (fr) spriteFrom(x, z - 6 * AS(), fr, M.fps, M.pivot, false, 1.8, K.hitFromFrame); }
    H.dust(x, z, 1);
    // 땅 충격파 + 기둥 빛 + 전기 불티 (2026-11-03 HD)
    wave(x, z, K.r * 2.6, { flat: 0.3, w: 4, ms: 360, color: '#f4ffff', glow: K.color || '#59e6ff', ground: true });
    glow(x, z - 20 * AS(), K.r * 1.9, '#9ff4ff', 240, 0.85);
    debris(x, z - 4 * AS(), z, 10, { cols: ['#ffffff', '#bff8ff', '#fff6a0'], glow: true, sp: 190, size: 1.6, ms: 420, spread: 1.4 });
    FX.shake(CFG.juice.shakePx * (h.shake || 1.5), CFG.juice.shakeMs);
    if (h.flash) doFlash(h.flash);
    var st = stOf(h, d), any = false;
    H.targets().forEach(function (t) {
      if (!t || (t.canBeHit && !t.canBeHit())) return;
      var hb = t.hurtbox();
      if (Math.abs(hb.z - z) > K.depth) return;
      if (x < hb.x0 - K.r || x > hb.x1 + K.r) return;
      var dir = Math.abs(t.x - x) < 3 ? s.dir : (t.x > x ? 1 : -1);
      H.onHit(st, t, { dir: dir, wk: p.weaponKey, x: x, y: t.y - 40 * AS() });
      any = true;
    });
    if (any && h.slowMs) H.slow(h.slowMs);
  }

  // ---------- 매 장면 (효과들 시간 흐름) ----------
  function update(dt) {
    [bolts, rings, ghosts, arts, waves, parts, glows].forEach(function (L) {
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
    var s = p && p.state === 'skill' && p.sk, K = s && s.d.strikes;
    if (!K) return;
    K.at.forEach(function (at, k) {
      if (s.strikeDone[k] || s.t < at - (K.markMs || 200)) return;
      if (SM()) {   // 매끈한 화면: 깜빡이는 빛 타원 + 가운데 점
        var mx = s.sx[k] - camX, my = s.sz[k], mrx = K.r * 1.1, mry = Math.max(2, K.depth * 0.4), bl = Math.floor(s.t / 60) % 2;
        ctx.save();
        ctx.globalAlpha = bl ? 0.75 : 0.5;
        ctx.strokeStyle = bl ? '#fff27a' : '#5ae6ff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(mx, my, mrx, mry, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 0.25; ctx.fillStyle = bl ? '#fff27a' : '#5ae6ff'; ctx.fill();
        ctx.restore();
        return;
      }
      var x = Math.round(s.sx[k] - camX), y = Math.round(s.sz[k]), rx = Math.round(K.r), ry = Math.max(2, Math.round(K.depth * 0.35));
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
    if (SH) H.targets().forEach(function (e) {
      if (!e || !e.T || !(e.stunT > 0) || e.state !== 'hit') return;
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
      var K = s.d.strikes;
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

  // ---------- 버튼 표시 (폰: 공격 버튼 위 동그라미 / PC: 아래 글자 옆 작은 칸) ----------
  // 쿨타임 중이면 어둡게 + 시계 방향으로 밝아지는 부채꼴(--cd = 남은 비율) + 남은 초. 이 직업에 기술이 없으면 숨김
  var uiLast = {};
  function ui(G) {
    var changed = false;
    ['A', 'B'].forEach(function (slot) {
      var d = resolve(G.classKey, slot, G.charKey), p = G.player;
      var rem = d && p && p.skillCd ? Math.max(0, p.skillCd[d.key] || 0) : 0;
      var frac = d ? Math.round(rem / d.cooldownMs * 100) / 100 : 0;
      var key = d ? d.key + '|' + d.icon + '|' + frac + '|' + Math.ceil(rem / 100) : 'none';
      if (uiLast[slot] === key) return;
      var wasHidden = !uiLast[slot] || uiLast[slot] === 'none';
      if (wasHidden !== !d) changed = true;
      uiLast[slot] = key;
      document.querySelectorAll('[data-skill="' + slot + '"]').forEach(function (el) {
        el.hidden = !d;
        if (!d) return;
        el.classList.toggle('cool', rem > 0);
        el.style.setProperty('--cd', frac);
        el.title = d.name;
        el.setAttribute('aria-label', d.name);
        var ic = el.querySelector('.ic'), sec = el.querySelector('.sec');
        if (ic && ic.textContent !== d.icon) ic.textContent = d.icon;
        if (sec) sec.textContent = rem > 0 ? (rem >= 1000 ? Math.ceil(rem / 1000) : (rem / 1000).toFixed(1)) : '';
      });
    });
    return changed;
  }

  window.Skills = {
    init: function (cfg, hooks) { CFG = cfg; H = hooks; },
    resolve: resolve, pick: pick, start: start, advance: advance, frame: frame, facing: facing,
    invulnerable: invulnerable, passThrough: passThrough, usingArt: usingArt,
    update: update, tickReal: tickReal,
    drawBackdrop: drawBackdrop, drawUnder: drawUnder, drawGhosts: drawGhosts, drawOver: drawOver, drawFlash: drawFlash, drawDebug: drawDebug,
    ui: ui,
    clear: function () { bolts.length = 0; rings.length = 0; ghosts.length = 0; arts.length = 0; waves.length = 0; parts.length = 0; glows.length = 0; flash = null; },
    // 화면 번쩍(콤보 마무리 타도 씀): { color, alpha, ms }
    flash: function (f) { doFlash(f); },
    // 파편·둥근 빛(소품 나뭇조각·음식 반짝임도 씀, props.js)
    debris: debris, glow: glow,

    state: function () { return { bolts: bolts.length, rings: rings.length, ghosts: ghosts.length, arts: arts.length, flash: !!flash }; }
  };
})();
