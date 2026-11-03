// 직업 기술 (기사 돌진베기·회전베기 / 법사 화염구·번개, 2026-11-03)
// 시작 조건·쿨타임·진행(이동·판정·효과)·화면 효과(어둡게·번쩍·잔상·번개)·버튼 표시를 여기서 한다.
// 수치는 전부 config.js 의 SKILLS (CFG.skills). 맞았을 때 데미지·불똥·숫자는 main.js 의 onHit 를 그대로 쓴다.
// 기술 = 동작(motion, 몸 그림 묶음) + 효과(fx 그림). 판정·효과 시각은 config 에 「장 번호」로 적고 여기서 동작의 ms 로 바꾼다.
// 동작·효과 그림이 없으면 기존 그림(공격 그림·베기·마법 효과)을 시간만 바꾸거나 색을 물들여서 쓴다(placeholder).
(function () {
  var CFG = null, H = null;      // H = main.js 가 넘겨주는 도구 { onHit, targets, dust, fx, hitstop, slow }
  var cache = {};
  var bolts = [], rings = [], ghosts = [], arts = [];   // arts = 효과 그림(따라다니기·돌리기·날아가기·캐릭터 뒤)
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
  function centerPivot(fr) { return { x: Math.round(fr[0].width / 2), y: Math.round(fr[0].height / 2) }; }

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
    if (d.strikes) s.sx = d.strikes.x.map(function (x) { return p.x + p.dir * x; });
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
      }
    }
    if (d.cast && !s.cast && t1 >= d.cast.at) { s.cast = true; castFireball(p, d); }
    if (d.strikes) {
      var K = d.strikes;
      K.at.forEach(function (at, k) {
        if (!s.strikeDone[k] && t1 >= at) { s.strikeDone[k] = true; strike(p, d, k); }
      });
    }
    return t1 >= d.ms;
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
    if (tintImgCache) { m = m || {}; m[color] = c; tintImgCache.set(img, m); }
    return c;
  }
  function playFx(p, f) {
    var dir = f.back ? -p.dir : p.dir, x = p.x + dir * (f.x || 0), y = p.y + (f.y || 0);
    if (f.type === 'dust') { H.dust(p.x - p.dir * 10 * AS(), p.y, p.dir); return; }
    if (f.type === 'thrust') { FX.thrust(x, y, dir, f.len || 60, f.color || '#ffffff', f.ms || 200); return; }
    if (f.type === 'ring') { rings.push({ x: p.x, y: y, r: f.r || 60, t: 0, life: f.ms || 160, color: f.color || '#ffffff' }); return; }
    if (f.type === 'art') {   // 효과 그림: 없으면 ph(대신 쓸 효과)
      var A = fxArt(f.fx, f.fps);
      if (!A) { if (f.ph) playFx(p, f.ph); return; }
      arts.push({ A: A, p: p, follow: !!f.follow, ox: f.x || 0, oy: f.y || 0, x: x, y: y, dir: dir, rot: f.rot || 0, vx: f.vx || 0,
                  back: f.layer === 'back', scale: f.scale || 1, t: 0, life: A.loop ? (f.ms || 600) : A.fr.length * 1000 / A.fps });
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
      onImpact: function (pr, t) { fireBurst(pr, t); } });
    FX.shake(CFG.juice.shakePx * 0.8, CFG.juice.shakeMs);
  }
  function fireBurst(pr, direct) {
    var S = pr.skill, c = S.c, b = c.burst, real = fxArt(b.art), M = CFG.magic.burst;
    if (real) spriteFrom(pr.x, pr.y, real.fr, real.fps, real.pivot, pr.dir < 0, 1, b.fromFrame);
    else { var fr = tintFx(M.frames, b.tint, b.tintK); if (fr) spriteFrom(pr.x, pr.y, fr, M.fps, M.pivot, pr.dir < 0, b.scale || 1, b.fromFrame); }
    FX.shake(CFG.juice.shakePx * 2.2, CFG.juice.shakeMs * 1.6);
    doFlash(c.hit.flash || { color: '#ffb060', alpha: 0.3, ms: 120 });
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

  // 번개 한 줄기: 정해 둔 바닥 자리(sx[k], 법사 발 줄)에 화면 맨 위에서 내리꽂힘
  function strike(p, d, k) {
    var s = p.sk, K = d.strikes, x = s.sx[k], z = s.z, h = K.hits[Math.min(k, K.hits.length - 1)];
    bolts.push({ x: x, z: z, t: 0, life: K.ms || 200, K: K, seed: Math.random() * 1000 });
    var hitA = fxArt(K.hitArt), M = CFG.magic.spark;
    if (hitA) spriteFrom(x, z, hitA.fr, hitA.fps, hitA.pivot, s.dir < 0, 1, K.hitFromFrame);   // 땅 번쩍(기준 = 아래 가운데)
    else { var fr = tintFx(M.frames, K.glow || '#fff27a', 0.55); if (fr) spriteFrom(x, z - 6 * AS(), fr, M.fps, M.pivot, false, 1.8, K.hitFromFrame); }
    H.dust(x, z, 1);
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
    [bolts, rings, ghosts, arts].forEach(function (L) {
      for (var i = L.length - 1; i >= 0; i--) { L[i].t += dt; if (L[i].t >= L[i].life) L.splice(i, 1); }
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
    var s = p && p.state === 'skill' && p.sk, K = s && s.d.strikes;
    if (!K) return;
    K.at.forEach(function (at, k) {
      if (s.strikeDone[k] || s.t < at - (K.markMs || 200)) return;
      var x = Math.round(s.sx[k] - camX), y = Math.round(s.z), rx = Math.round(K.r), ry = Math.max(2, Math.round(K.depth * 0.35));
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
  function drawArt(ctx, camX, a) {
    var A = a.A, n = A.fr.length, i = Math.floor(a.t * A.fps / 1000);
    i = A.loop ? i % n : Math.min(n - 1, i);
    var im = A.fr[i]; if (!im) return;
    var dir = a.follow ? a.p.dir : a.dir, x = a.follow ? a.p.x + dir * a.ox : a.x, y = a.follow ? a.p.y + a.oy : a.y;
    ctx.save();
    ctx.translate(Math.round(x - camX), Math.round(y));
    ctx.scale(dir, 1);
    if (a.rot) ctx.rotate(a.rot * Math.PI / 180);
    if (a.scale !== 1) ctx.scale(a.scale, a.scale);
    ctx.drawImage(im, -A.pivot.x, -A.pivot.y);
    ctx.restore();
  }
  // 잔상 + 캐릭터 뒤 효과(돌진 잔상 그림) (캐릭터 그리기 전에)
  function drawGhosts(ctx, camX) {
    arts.forEach(function (a) { if (a.back) drawArt(ctx, camX, a); });
    ghosts.forEach(function (g) {
      var k = g.t / g.life;
      ctx.save();
      ctx.globalAlpha = g.alpha * (1 - k);
      ctx.translate(Math.round(g.x - camX), Math.round(g.y));
      ctx.scale(g.dir, 1);
      ctx.drawImage(g.img, -g.pivot.x, -g.pivot.y);
      ctx.restore();
    });
  }
  // 캐릭터 위: 효과 그림(앞), 번개 기둥, 회전 원, 감전(멈춘 적)
  function drawOver(ctx, camX) {
    arts.forEach(function (a) { if (!a.back) drawArt(ctx, camX, a); });
    var SH = fxArt('shock');
    if (SH) H.targets().forEach(function (e) {
      if (!e || !e.T || !(e.stunT > 0) || e.state !== 'hit') return;
      var im = SH.fr[Math.floor(e.clock * SH.fps / 1000) % SH.fr.length], k = clamp(e.T.height / (100 * AS()), 0.6, 1.4);
      ctx.save(); ctx.translate(Math.round(e.x - camX), Math.round(e.y - e.T.height * 0.55)); ctx.scale(k, k);
      ctx.globalAlpha = 0.9; ctx.drawImage(im, -SH.pivot.x, -SH.pivot.y); ctx.restore();
    });
    rings.forEach(function (r) {
      var k = r.t / r.life, rr = r.r * (0.55 + 0.45 * ease(Math.min(1, k * 1.6))), x = Math.round(r.x - camX), y = Math.round(r.y);
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
  }
  function drawBolt(ctx, camX, b) {
    var K = b.K, k = b.t / b.life, x = Math.round(b.x - camX), gy = Math.round(b.z - 2);
    var A = fxArt(K.art);
    if (A) {
      // 번개 그림: 기준점(아래 끝)을 땅에 딱 붙이고 원래 크기로 그림. 그림 위로 화면이 더 남으면
      //   그림 윗부분(30%)만 세로로 늘려 화면 맨 위까지 이어 붙인다(땅 쪽 모양은 그대로)
      var im = A.fr[Math.min(A.fr.length - 1, Math.floor(b.t * A.fps / 1000))], gy2 = Math.round(b.z);
      var left = x - A.pivot.x, top = gy2 - A.pivot.y, sh = Math.max(1, Math.round(im.height * 0.3));
      ctx.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
      if (top > 0) {
        ctx.drawImage(im, 0, sh, im.width, im.height - sh, left, top + sh, im.width, im.height - sh);
        ctx.drawImage(im, 0, 0, im.width, sh, left, 0, im.width, top + sh);
      } else ctx.drawImage(im, left, top);
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
        rect({ x0: s.sx[k] - K.r, x1: s.sx[k] + K.r, y0: s.z - 100 * AS(), y1: s.z }, s.strikeDone[k] ? 'rgba(255,240,80,0.4)' : '#ffe94a');
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
    clear: function () { bolts.length = 0; rings.length = 0; ghosts.length = 0; arts.length = 0; flash = null; },
    state: function () { return { bolts: bolts.length, rings: rings.length, ghosts: ghosts.length, arts: arts.length, flash: !!flash }; }
  };
})();
