// 게임 본체: 화면 크기, 배경, 매 장면 갱신, 타격 처리
// 기본 = 1단계 판(웨이브 + 보스). 주소 뒤 ?mode=practice = 예전 허수아비 연습장
(function () {
  var CFG = window.CFG, J = CFG.juice;
  var AS = CFG.actorScale || 1;   // 캐릭터 크기: 코드에 바로 적힌 거리·높이와 손맛의 밀림 거리(juice.knockback)에 곱한다
  var params = new URLSearchParams(location.search);
  var DEBUG = params.get('debug') === '1';
  var MODE = params.get('mode') === 'practice' ? 'practice' : 'stage';
  if (params.get('slow')) J.timeScale = +params.get('slow') || 1;

  var canvas = document.getElementById('screen');
  var ctx = canvas.getContext('2d');
  var hudEl = document.getElementById('hud');
  var LW = 480, LH = 240, SCALE = 1;
  var world = { width: CFG.world.width, laneTop: 0, laneBottom: 0, floorY: 0, bgOff: 0, minX: null, maxX: null };
  // 폰 가로 화면: 공격 버튼이 게임 화면 오른쪽 아래(걷는 길)를 덮는다 → 그 폭(도트)만큼 오른쪽을 싸움 자리에서 뺀다.
  //   플레이어·적이 그 밑으로 못 들어가고, 카메라도 남은 폭 기준으로 따라간다. 버튼이 게임 화면 밖이면(세로 화면·PC) 0
  var controlPad = 0;
  var bgCache = null;
  // 매끈한 2배(HD, 2026-11-03): 캔버스 실제 점 = 논리 화면(도트) x RS. 게임 계산은 전부 도트 그대로(240줄),
  //   그릴 때만 RS 배로 키워서 그림(HD 그림 1점 = 0.5 도트, 부드럽게). 주소 뒤 ?rs=1 이면 예전처럼 도트 1:1(그림도 예전 작은 도트 그림)
  var RS = Math.max(1, +(params.get('rs') || CFG.view.renderScale || 1));
  CFG.view.renderScale = RS;

  // ---------- 화면 크기: 논리 화면(도트)은 예전처럼 정수 배율 기준(보이는 범위·캐릭터 크기 그대로), 캔버스 점은 그 RS 배 ----------
  // 가로 화면: 높이를 240도트 근처로 맞춤. 세로 화면(폰 세로): 폭을 portraitTargetW 근처로 맞추고
  // 게임 화면은 위쪽(고르기 버튼 아래), 조이스틱·공격 버튼은 아래 빈 곳에 둔다.
  function resize() {
    var dpr = window.devicePixelRatio || 1;
    var cw = window.innerWidth, ch = window.innerHeight;
    var pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
    var portrait = ch > cw * 1.05;
    document.body.classList.toggle('portrait', portrait);
    var topCss = 0;
    if (portrait) {
      SCALE = Math.max(1, Math.floor(pw / CFG.view.portraitTargetW));
      LW = Math.ceil(pw / SCALE); LH = CFG.view.targetH;
      topCss = 52;
    } else {
      SCALE = Math.max(1, Math.floor(ph / CFG.view.targetH));
      LW = Math.ceil(pw / SCALE); LH = Math.ceil(ph / SCALE);
    }
    canvas.width = Math.round(LW * RS); canvas.height = Math.round(LH * RS);
    document.body.classList.toggle('smooth', RS > 1);
    var cssW = LW * SCALE / dpr, cssH = LH * SCALE / dpr;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.style.top = topCss + 'px';
    if (hudEl) {
      hudEl.style.top = topCss + 'px';
      hudEl.style.width = Math.min(cw, cssW) + 'px';
      hudEl.style.height = Math.min(ch - topCss, cssH) + 'px';
    }
    setSmooth();
    world.floorY = Math.round(LH * CFG.world.floorTopRatio);
    if (MODE === 'stage') {
      var B = CFG.bg;
      world.width = CFG.stage.width;
      world.bgOff = Math.max(0, LH - B.height);          // 화면이 240보다 높으면 배경을 바닥에 붙이고 위는 하늘로 채움
      world.laneTop = world.bgOff + B.laneTop;
      world.laneBottom = Math.min(LH - 8, world.bgOff + B.laneBottom);
    } else {
      world.width = Math.max(CFG.world.width, LW);
      world.laneTop = world.floorY + 14;
      world.laneBottom = LH - CFG.world.floorBottomPad;
    }
    bgCache = null;
    controlPad = measureControlPad();
    if (G.player) {
      G.player.y = Math.max(world.laneTop, Math.min(world.laneBottom, G.player.y));
      if (G.dummy) G.dummy.y = Math.round((world.laneTop + world.laneBottom) / 2);
      G.enemies.forEach(function (e) { e.y = Math.max(world.laneTop, Math.min(world.laneBottom, e.y)); });
    }
  }

  // 공격 버튼(+ 기술 버튼 2개)이 덮는 게임 화면 오른쪽 폭(도트). 버튼이 안 보이거나 걷는 길과 안 겹치면 0
  function measureControlPad() {
    var c = canvas.getBoundingClientRect();
    if (!c.width || !c.height) return 0;
    var ky = c.height / LH;
    var laneT = c.top + world.laneTop * ky - 100 * AS * ky, laneB = c.top + world.laneBottom * ky;   // 키 큰 몸(100도트)까지
    var pad = 0;
    ['btnAtk', 'btnSkA', 'btnSkB'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn || !btn.offsetParent || btn.hidden) return;
      var b = btn.getBoundingClientRect();
      if (b.top >= laneB || b.bottom <= laneT || b.left >= c.right) return;
      pad = Math.max(pad, Math.ceil((c.right - b.left + 4) * LW / c.width));
    });
    return Math.max(0, Math.min(Math.round(LW * 0.3), pad));
  }

  function setSmooth() {
    ctx.imageSmoothingEnabled = RS > 1;
    if (RS > 1) ctx.imageSmoothingQuality = 'high';
  }
  // 캔버스 점 단위로 반올림(2배면 0.5 도트까지 → 카메라·움직임이 더 부드럽다)
  function snap(v) { return Math.round(v * RS) / RS; }

  // ---------- 연습장 배경 (코드로 그린 돌벽 + 바닥 타일) ----------
  function buildBackground() {
    var c = document.createElement('canvas');
    c.width = world.width * RS; c.height = LH * RS;   // 캔버스 점 크기로(2배면 또렷하게)
    var g = c.getContext('2d');
    g.scale(RS, RS);
    function r(col, x, y, w, h) { g.fillStyle = col; g.fillRect(x, y, w, h); }
    var fy = world.floorY;
    r('#1b1830', 0, 0, c.width, fy);
    r('#221d3a', 0, 0, c.width, Math.round(fy * 0.35));
    var wallTop = Math.round(fy * 0.28);
    r('#3a3350', 0, wallTop, c.width, fy - wallTop);
    for (var row = 0; wallTop + row * 12 < fy; row++) {
      var y = wallTop + row * 12, off = (row % 2) * 12;
      for (var x = -off; x < c.width; x += 24) {
        r('#463e60', x + 1, y + 1, 22, 10);
        r('#524a6e', x + 1, y + 1, 22, 2);
        r('#2c2640', x + 1, y + 10, 22, 1);
      }
    }
    r('#2a2440', 0, wallTop - 4, c.width, 4); r('#5e5680', 0, wallTop - 4, c.width, 1);
    for (var px = 60; px < c.width; px += 180) {
      r('#2c2640', px - 9, wallTop - 8, 18, fy - wallTop + 8);
      r('#5a5278', px - 7, wallTop - 8, 14, fy - wallTop + 8);
      r('#6c6490', px - 7, wallTop - 8, 3, fy - wallTop + 8);
      r('#2a2440', px - 10, wallTop - 10, 20, 4);
      var ty = wallTop + Math.round((fy - wallTop) * 0.35);
      r('#3b2b20', px - 2, ty, 4, 8); r('#ff9b3d', px - 3, ty - 6, 6, 6); r('#ffe08a', px - 1, ty - 5, 2, 4);
      g.fillStyle = 'rgba(255,160,70,0.08)'; g.fillRect(px - 26, ty - 22, 52, 40);
    }
    r('#151225', 0, fy - 2, c.width, 4);
    r('#4b4058', 0, fy + 2, c.width, LH - fy);
    for (var ry = 0; fy + 2 + ry * 10 < LH; ry++) {
      var yy = fy + 2 + ry * 10, o2 = (ry % 2) * 16, shade = ry % 2 ? '#544864' : '#5a4e6a';
      for (var tx = -o2; tx < c.width; tx += 32) {
        r(shade, tx + 1, yy + 1, 30, 8);
        r('#6a5e7c', tx + 1, yy + 1, 30, 1);
      }
    }
    g.fillStyle = 'rgba(10,8,20,0.25)'; g.fillRect(0, LH - 8, c.width, 8);
    return c;
  }

  // ---------- 1단계 배경: 3장 겹쳐 흐르기(먼 산 · 숲/폐허/마을 · 흙길) ----------
  function drawStageBg(camX) {
    var B = CFG.bg, I = G.assets.bg, off = world.bgOff, H = B.height;
    // 화면이 배경보다 높으면: 위는 하늘 맨 윗줄, 아래는 흙길 맨 아랫줄을 늘려 채움
    if (off > 0) { ctx.fillStyle = skyColor(); ctx.fillRect(0, 0, LW, off); }
    if (I.far) tileLayer(I.far, camX * B.far.parallax, off);
    if (I.mid) {
      var camMax = Math.max(1, world.width - LW), mk = I.mid._k || 1;
      var par = Math.min(B.mid.parallax, (I.mid.width * mk - LW) / camMax);   // 판 끝에서 마을 그림이 딱 끝나게
      ctx.drawImage(I.mid, -snap(camX * par), off, I.mid.width * mk, I.mid.height * mk);
    }
    if (I.ground) {
      tileLayer(I.ground, camX * B.ground.parallax, off);
      var below = LH - (off + H);
      if (below > 0) ctx.drawImage(I.ground, 0, I.ground.height - 1, I.ground.width, 1, 0, off + H - 0.5, LW, below + 0.5);
    }
  }
  // 하늘 맨 윗줄에서 가장 많이 쓰인 색 (구름 줄무늬가 안 생기게 한 가지 색으로 채움). 못 읽으면 config 의 stage.bgTop
  var sky = null;
  function skyColor() {
    if (sky) return sky;
    sky = CFG.stage.bgTop;
    try {
      var im = G.assets.bg.far, c = document.createElement('canvas'); c.width = im.width; c.height = 1;
      var g = c.getContext('2d'); g.drawImage(im, 0, 0);
      var d = g.getImageData(0, 0, im.width, 1).data, cnt = {}, best = 0;
      for (var i = 0; i < d.length; i += 4) { var k = d[i] + ',' + d[i + 1] + ',' + d[i + 2]; cnt[k] = (cnt[k] || 0) + 1; if (cnt[k] > best) { best = cnt[k]; sky = 'rgb(' + k + ')'; } }
    } catch (e) {}
    return sky;
  }
  function tileLayer(img, sx, y) {
    var k = img._k || 1, w = img.width * k, h = img.height * k, x = -(snap(sx) % w);
    if (x > 0) x -= w;
    // 이음매에 머리카락 같은 틈이 안 생기게 한 칸씩 1/RS 겹쳐 그림
    for (; x < LW; x += w) ctx.drawImage(img, x, y, w + (RS > 1 ? 1 / RS : 0), h);
  }

  // ---------- 상태 ----------
  var G = window.GAME = {
    cfg: CFG, assets: null, player: null, dummy: null, enemies: [], mode: MODE,
    hitstop: 0, hits: 0, comboHits: 0, comboT: 0, maxCombo: 0, totalDmg: 0, camX: 0, slowT: 0,
    charKey: 'male', classKey: CFG.defaultClass || 'knight', weaponKey: 'sword', moveSet: 'sword', debug: DEBUG,
    stage: null, bot: params.get('bot') === '1'
  };

  // 폰 진동: 사용자가 한 번이라도 화면을 누른 뒤에만(그 전엔 브라우저가 막고 경고를 띄움)
  function vibrate(ms) {
    if (!(J.vibrateMs > 0) || !navigator.vibrate) return;
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    try { navigator.vibrate(ms); } catch (e) {}
  }

  function rand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  function overlap(h, b) {
    return h.x0 < b.x1 && h.x1 > b.x0 && h.y0 < b.y1 && h.y1 > b.y0 && Math.abs(h.z - b.z) <= h.depth;
  }

  // 플레이어가 대상(허수아비/적)을 때림
  // src = 마법탄·터짐처럼 몸과 떨어진 곳에서 맞힐 때 { dir: 밀려나는 방향, wk: 쏠 때 무기, x, y: 맞은 곳 } (없으면 플레이어 몸으로 때림)
  function onHit(st, target, src) {
    var p = G.player;
    var dir = src ? src.dir : p.dir;
    var W = CFG.weapons[src ? src.wk : p.weaponKey];
    var dmg = Math.round(rand(W.damage[0], W.damage[1]) * st.dmg);
    G.hitstop = Math.max(G.hitstop, J.hitstopMs * W.hitstopMul * st.hitstop);
    FX.shake(J.shakePx * W.shakeMul * st.shake, J.shakeMs * (st.finisher ? 1.5 : 1));
    // 콤보 마무리 타: 짧은 화면 번쩍(2026-11-03 HD). 기술은 자기 flash 를 따로 씀
    if (st.finisher && !st.damageStyle && CFG.view.renderScale > 1) Skills.flash({ color: '#fff8e8', alpha: 0.2, ms: 90 });
    var knock = J.knockback * AS * W.knockMul * st.knock;
    var hx, topY;
    if (target === G.dummy) {
      target.hit(dir, knock, J.wobble * (st.finisher ? 1.4 : 1), J.flashMs);
      hx = target.x - dir * 6 * AS; topY = target.y - 96 * AS;
    } else {
      // 무거운 타(타 knock × 무기 knockMul 이 크면) = 잡몹 넘어짐 (config ai.react.heavyKnock)
      var heavy = !!st.knockdown || st.knock * W.knockMul >= CFG.ai.react.heavyKnock;
      var res = target.takeHit(dmg, dir, knock, !!st.finisher, { heavy: heavy, stunMs: st.stunMs });   // stunMs = 번개 기술
      var hb = target.hurtbox();
      // 불똥은 맞은 몸의 가장자리(플레이어 쪽)에서. 마법은 맞은 곳에서 가장 가까운 몸 위치
      if (src) hx = clamp(src.x, hb.x0 + 4, hb.x1 - 4);
      else hx = p.dir > 0 ? Math.max(hb.x0 + 4, Math.min(hb.x1 - 4, p.x + 30 * AS)) : Math.min(hb.x1 - 4, Math.max(hb.x0 + 4, p.x - 30 * AS));
      topY = target.y - target.T.height - 8;
      if (res === 'dead' && target.T.boss) onBossDown(target);
      else if (res === 'dead') G.hitstop = Math.max(G.hitstop, J.hitstopMs * 1.6);
    }
    // hitY = 주먹·발이 닿는 높이(맨손 콤보), spark = 불똥 그림 크기(맨손은 작게)
    var hy = p.y + (st.hitY != null ? st.hitY : -52 * AS), sc = st.spark || 1;
    if (src) { var tb = target.hurtbox(); hy = clamp(src.y, tb.y0 + 6, tb.y1 - 6); }
    // impactFx = 불똥 대신 쓸 그림(법사 = magic_spark)
    var impSpr = G.assets.fx && ((st.impactFx && G.assets.fx[st.impactFx]) || G.assets.fx.impact);
    // big = 기술의 큰 불똥(마무리 타처럼 많이·멀리). damageStyle = 기술 숫자 모양(config damageText)
    var big = !!(st.finisher || st.big);
    FX.impact(hx, hy, dir, W.sparkColor, Math.round(J.sparkCount * (big ? 1.6 : 1) * (sc < 1 ? 0.7 : 1) * (st.damageStyle ? 1.3 : 1)), big, impSpr, sc);
    FX.damage(target.x, topY, dmg, !!(st.finisher || (st.damageStyle && st.knockdown)), J, null, st.damageStyle);
    vibrate(Math.round(J.vibrateMs * (st.finisher ? 2 : 1)));
    G.hits++; G.totalDmg += dmg;
    G.comboHits = G.comboT > 0 ? G.comboHits + 1 : 1;
    G.maxCombo = Math.max(G.maxCombo, G.comboHits);
    G.comboT = 1200;
    showCombo();
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // ---------- 법사 마법 (config MAGE 의 cast, CFG.magic 그림) ----------
  // 그림 효과 한 번 재생: kind = 'spark'(지팡이 끝 반짝임) / 'burst'(터짐)
  function magicSprite(kind, x, y, dir, scale) {
    var M = CFG.magic && CFG.magic[kind], fr = M && G.assets.fx && G.assets.fx[M.frames];
    if (fr && fr.length) FX.sprite(x, y, fr, M.fps, M.pivot, dir < 0, false, scale || 1);
  }
  // 마법 내보내기: bolt = 날아가는 탄(Projectiles), burst = 그 자리에서 바로 터짐
  function castMagic(st) {
    var p = G.player, c = st.cast, x = p.x + p.dir * c.x, y = p.y + c.y;
    if (c.kind === 'bolt') {
      var B = CFG.magic.bolt;
      Projectiles.spawn({ x: x, y: y, z: p.y, dir: p.dir, speed: c.speed, range: c.range, box: c.box, depth: c.depth,
        burstAtEnd: !!c.burstAtEnd, backReach: c.backReach || 0, frames: G.assets.fx && G.assets.fx[B.frames], fps: B.fps, pivot: B.pivot,
        st: st, wk: p.weaponKey });
    } else explode(x, y, p.y, st, p.dir, p.weaponKey, null);
  }
  // 터짐: 반지름 r 안(위아래 줄은 depth 안)의 대상 전부 맞음. direct = 마법탄이 직접 맞힌 대상(항상 맞음)
  function explode(cx, cy, z, st, dir, wk, direct) {
    var B = st.cast.burst;
    magicSprite('burst', cx, cy, dir, B.scale);
    FX.shake(J.shakePx * ((CFG.magic.burst && CFG.magic.burst.shake) || 0.8), J.shakeMs);
    var targets = MODE === 'stage' ? G.enemies.slice() : [G.dummy];
    targets.forEach(function (t) {
      if (!t || (t.canBeHit && !t.canBeHit())) return;
      var hb = t.hurtbox();
      if (t !== direct) {
        if (Math.abs(hb.z - z) > B.depth) return;
        var nx = clamp(cx, hb.x0, hb.x1), ny = clamp(cy, hb.y0, hb.y1);
        if (Math.hypot(nx - cx, ny - cy) > B.r) return;
      }
      var d = Math.abs(t.x - cx) < 4 ? dir : (t.x > cx ? 1 : -1);   // 터진 곳에서 바깥으로 밀림
      onHit(st, t, { dir: d, wk: wk, x: cx, y: cy });
    });
  }

  // 적이 플레이어를 때림
  function onPlayerHit(e, spec) {
    var p = G.player;
    var dmg = rand(spec.dmg[0], spec.dmg[1]);
    var dir = p.x >= e.x ? 1 : -1;
    if (!p.takeHit(dmg, dir, spec.knock, spec.flinchMs, !!spec.heavy)) return;   // heavy = 넘어짐
    G.hitstop = Math.max(G.hitstop, J.hitstopMs * (e.T.boss ? 1.3 : 0.8));
    FX.shake(J.shakePx * (spec.shake || 1.2), J.shakeMs * 1.3);
    FX.impact(p.x - dir * 4, p.y - 60 * AS, -dir, '#ff6a5a', Math.round(J.sparkCount * 0.8), e.T.boss, null, 0.8);
    FX.damage(p.x, p.y - 112 * AS, dmg, false, J, '#ff5a4a');
    vibrate(Math.round(J.vibrateMs * 2.5));
    G.comboT = 0; comboEl.hidden = true;
  }

  // ---------- 화면 위 글자 ----------
  var comboEl = document.getElementById('combo');
  function showCombo() {
    comboEl.innerHTML = '<b>' + G.comboHits + '</b> HIT';
    comboEl.classList.remove('pop'); void comboEl.offsetWidth; comboEl.classList.add('pop');
    comboEl.hidden = false;
  }

  // ================= 1단계 판 진행 =================
  function newStage() {
    return { next: 0, locked: false, lockCam: 0, lastLock: -1, queue: [], waveT: 0, waveIdx: -1,
             camMin: 0, time: 0, boss: null, bossDownT: -1, result: null, overT: 0, lastAttackAt: -1e9 };
  }
  function waveAt(w) { return w.at === 'end' ? world.width - LW : Math.min(w.at, world.width - LW); }

  function startWave(i) {
    var S = G.stage, w = CFG.stage.waves[i];
    S.locked = true; S.lockCam = waveAt(w); S.waveIdx = i; S.lastLock = S.lockCam; S.waveT = 0;
    S.queue = w.spawn.map(function (s) { return { type: s[0], side: s[1], at: s[2] }; });
    banner(w.boss ? 'BOSS!' : 'WAVE ' + (i + 1), w.boss ? 'boss' : '');
  }

  function spawnEnemy(type, side) {
    var S = G.stage, T = CFG.enemies[type];
    var x = side === 'L' ? S.lockCam - T.radius - 30 : S.lockCam + LW + T.radius + 30;
    var y = world.laneTop + Math.random() * (world.laneBottom - world.laneTop);
    var e = new Enemy(type, CFG, G.assets.enemies[type], x, y);
    e.dir = side === 'L' ? 1 : -1;
    e.wave = S.waveIdx;
    G.enemies.push(e);
    if (T.boss) S.boss = e;
    return e;
  }

  function onBossDown(boss) {
    var S = G.stage;
    S.bossDownT = 0;
    S.queue = [];                      // 아직 안 나온 졸개는 취소
    G.hitstop = Math.max(G.hitstop, 260);
    G.slowT = 1400;                    // 보스 쓰러질 때 슬로모션
    FX.shake(J.shakePx * 3, 500);
    // 남은 졸개들도 같이 쓰러짐
    G.enemies.forEach(function (e) { if (e !== boss && e.alive()) e.takeHit(9999, e.x > boss.x ? 1 : -1, 10, true, { force: true }); });
  }

  function stageStep(dt) {
    var S = G.stage, p = G.player, waves = CFG.stage.waves;
    if (!S.result) S.time += dt;
    // 웨이브 시작: 카메라가 그 자리에 오면 화면 고정
    var camMax = Math.max(0, world.width - LW);
    var target = Math.max(S.camMin, Math.min(camMax, p.x - (LW - controlPad) * 0.42));
    if (!S.locked && S.next < waves.length) {
      var at = waveAt(waves[S.next]);
      if (target >= at) { target = at; startWave(S.next); }
    }
    if (S.locked) target = S.lockCam;
    G.camX += (target - G.camX) * Math.min(1, dt / 120);
    if (Math.abs(target - G.camX) < 0.5) G.camX = target;
    G.camX = Math.max(0, Math.min(camMax, G.camX));
    S.camMin = Math.max(S.camMin, Math.min(G.camX, S.locked ? S.lockCam : G.camX));   // 뒤로는 안 돌아감

    // 적 내보내기
    if (S.locked) {
      S.waveT += dt;
      for (var i = S.queue.length - 1; i >= 0; i--) {
        if (S.queue[i].at <= S.waveT) { spawnEnemy(S.queue[i].type, S.queue[i].side); S.queue.splice(i, 1); }
      }
      // 보스 화남: 체력 절반 아래 → 빨라지고 졸개를 부름
      var B = S.boss;
      if (B && B.alive() && !B.enraged && B.hp / B.maxHp < B.T.enrageAt) {
        B.enraged = true;
        banner('오크 족장이 화났다!', 'boss');
        (B.T.enrage.summon || []).forEach(function (t, k) {
          S.queue.push({ type: t, side: k % 2 ? 'L' : 'R', at: S.waveT + 400 + k * 700 });
        });
      }
      // 다 잡으면 다음으로
      var left = G.enemies.some(function (e) { return e.alive(); });
      if (!S.queue.length && !left) {
        var w = waves[S.waveIdx];
        S.locked = false; S.next++;
        if (w.boss) { if (S.bossDownT < 0) S.bossDownT = 0; }
        else {
          if (p.state !== 'dead') p.hp = Math.min(p.maxHp, p.hp + (CFG.stage.healOnClear || 0));
          banner('CLEAR!', 'small');
        }
      }
    }
    // 보스 쓰러짐 → 잠시 뒤 클리어 화면
    if (S.bossDownT >= 0 && !S.result) { S.bossDownT += dt; if (S.bossDownT > 2600) showResult('clear'); }
    // 플레이어 쓰러짐 → 게임 오버
    if (p.state === 'dead' && !S.result) { S.overT += dt; if (S.overT > (CFG.hero.deathOverMs || 1800)) showResult('over'); }
  }

  // 적 수만큼 몸끼리 밀어내기 (서로 겹쳐 서지 않게). 오크는 무거워서 거의 안 밀림, 돌진 중엔 안 밀림
  function separate() {
    var p = G.player, AI = CFG.ai, list = [];
    // 돌진베기 중에는 적 몸을 뚫고 지나감(플레이어를 밀어내기에서 뺌)
    if (p.state !== 'dead' && !(p.state === 'skill' && Skills.passThrough(p))) list.push({ o: p, r: CFG.hero.radius, m: 1 });
    G.enemies.forEach(function (e) {
      if (!e.alive() || e.state === 'down') return;   // 넘어진 적은 밟고 지나갈 수 있음
      var charging = e.state === 'attack' && e.atk && e.atk.spec.type === 'charge';
      list.push({ o: e, r: e.T.radius, m: charging ? 0 : (e.T.boss ? 0.08 : 1) });
    });
    for (var i = 0; i < list.length; i++) for (var j = i + 1; j < list.length; j++) {
      var a = list[i], b = list[j];
      if (Math.abs(a.o.y - b.o.y) >= AI.sepDepth) continue;
      var dx = b.o.x - a.o.x, min = a.r + b.r;
      if (Math.abs(dx) >= min) continue;
      var s = dx > 0 ? 1 : dx < 0 ? -1 : (a.o.dir || 1);
      var ov = min - Math.abs(dx), tm = a.m + b.m;
      if (tm <= 0) continue;
      a.o.x -= s * ov * a.m / tm;
      b.o.x += s * ov * b.m / tm;
    }
  }

  // ---------- 시험용 자동 조종 (?bot=1): 가까운 적에게 붙어서 계속 때림 ----------
  var botAtkT = 0;
  function botThink(dt) {
    var p = G.player, best = null, bd = 1e9;
    G.enemies.forEach(function (e) {
      if (!e.alive() || !e.entered) return;
      var d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y) * 2 + (e.canBeHit() ? 0 : 400);   // 넘어진 적은 나중에
      if (d < bd) { bd = d; best = e; }
    });
    var ax = { x: 0, y: 0 };
    if (!best) { if (!G.stage.locked) ax.x = 1; Input.setOverride(ax); return; }
    var side = best.x > p.x ? 1 : -1;
    var want = ({ goblin: 42, wolf: 58, orc: 72 }[best.type] || 50) * AS;
    var tx = best.x - side * want, ty = best.y;
    var ex = tx - p.x, ey = ty - p.y;
    if (Math.abs(ex) > 6) ax.x = Math.sign(ex);
    if (Math.abs(ey) > 3) ax.y = Math.sign(ey);
    Input.setOverride(ax);
    botAtkT -= dt;
    if (Math.abs(ey) <= 6 && Math.abs(ex) <= 22 * AS && botAtkT <= 0) {
      if (p.state !== 'attack') p.dir = side;
      Input.pressAttack(); botAtkT = 140;
      if (Math.random() < 0.12) Input.pressSkill(Math.random() < 0.5 ? 'A' : 'B');   // 가끔 기술(쿨타임이면 안 나감)
    }
  }

  // ---------- 휘두를 때 효과 (궤적·바람·반짝임) ----------
  // sfx = 그 타의 fx 하나. linger = 궤적이 남는 시간(ms, 기사 여자 3타 X자), 없으면 juice.slashMs
  function swingFx(p, st0, sfx) {
    var W = CFG.weapons[p.weaponKey], a = st0.arc;
    var fxs = G.assets.fx && G.assets.fx.slash && G.assets.fx.slash.length ? G.assets.fx.slash : null;
    var ms = sfx && sfx.linger ? sfx.linger : J.slashMs * (st0.finisher ? 1.5 : 1);
    if (sfx && sfx.type === 'none') {
      // 맨손 주먹: 궤적 없음 (맞으면 불똥만)
    } else if (sfx && sfx.type === 'spark') {    // 법사: 지팡이 끝 반짝임(magic_spark 그림)
      magicSprite('spark', p.x + p.dir * sfx.x, p.y + sfx.y, p.dir, sfx.scale);
    } else if (sfx && sfx.type === 'whoosh') {   // 발차기: 베기 그림을 흐리고 납작하게 → 바람 가르는 느낌
      if (fxs) FX.slash(p.x + p.dir * sfx.x, p.y + sfx.y, p.dir, a, '#ffffff', ms, fxs, sfx);
    } else if (sfx && sfx.type === 'thrust') {   // 찌르기: 짧은 직선 궤적(코드로 그림)
      FX.thrust(p.x + p.dir * sfx.x, p.y + sfx.y, p.dir, sfx.len || 40, W.arcColor, ms);
    } else if (fxs) {   // 그림 효과: 캐릭터 앞에 놓기 (타마다 위치·회전·뒤집기 다름)
      var off = sfx || CFG.art.fx.slashOffset;
      FX.slash(p.x + p.dir * off.x, p.y + off.y, p.dir, a, W.arcColor, ms, fxs, sfx);
    } else {     // 코드로 그린 궤적
      FX.slash(p.x + p.dir * 18 * AS, p.y - 56 * AS, p.dir, a, W.arcColor, J.slashMs, null);
    }
  }

  // ---------- 갱신 ----------
  function step(realMs) {
    FX.updateShake(realMs);
    Skills.tickReal(realMs);
    if (G.hitstop > 0) { G.hitstop -= realMs; return; }   // 멈춤: 아무것도 안 움직임
    var dt = realMs * J.timeScale;
    if (G.slowT > 0) { G.slowT -= realMs; dt *= 0.3; }
    if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) comboEl.hidden = true; }
    var p = G.player;
    p.weaponKey = G.weaponKey;
    p.setMoveSet(G.moveSet);
    p.classKey = G.classKey; p.gender = G.charKey;   // 기술 고르기용
    if (MODE === 'stage') { world.minX = G.camX + 14; world.maxX = G.camX + LW - 14 - controlPad; }
    if (G.bot && MODE === 'stage' && !G.stage.result) botThink(dt);
    var ev = p.update(dt, world);
    if (ev.slash) {
      // fx 는 하나 또는 여러 개(법사 2타 = 바람 + 지팡이 끝 반짝임)
      var st0 = ev.slash.step;
      (Array.isArray(st0.fx) ? st0.fx : [st0.fx]).forEach(function (sfx) { swingFx(p, st0, sfx); });
    }
    if (ev.cast) castMagic(ev.cast.step);
    if (ev.hitCheck) {
      var hb = p.hitbox(), done = ev.hitCheck.done;
      var targets = MODE === 'stage' ? G.enemies : [G.dummy];
      targets.forEach(function (t) {
        var id = t.id || 'dummy';
        if (done[id] || (t.canBeHit && !t.canBeHit())) return;   // 죽었거나 넘어져 있으면(무적) 안 맞음
        if (overlap(hb, t.hurtbox())) { done[id] = true; onHit(ev.hitCheck.step, t); }   // 판정 구간마다 대상별 한 번
      });
    }
    // 날아가는 마법탄: 처음 맞은 대상(또는 끝까지 날아간 곳)에서 터짐
    Projectiles.update(dt, MODE === 'stage' ? G.enemies : [G.dummy], function (pr, t) { explode(pr.x, pr.y, pr.z, pr.st, pr.dir, pr.wk, t); });
    if (MODE === 'stage') {
      var E = G.ectx;
      E.now += dt; E.view.x0 = G.camX; E.view.x1 = G.camX + LW - (controlPad ? controlPad + 14 : 0);   // 적은 몸이 넓어서 버튼 쪽으로 조금 더 띄움
      G.enemies.forEach(function (e) { e.update(dt, E); });
      separate();
      p.clamp(world);
      G.enemies.forEach(function (e) { if (e.alive()) e.keepInView(E); });
      G.enemies = G.enemies.filter(function (e) { return !e.remove; });
      E.enemies = G.enemies;
      stageStep(dt);
    } else {
      G.dummy.update(dt);
      var target = p.x - LW * 0.42;
      G.camX += (target - G.camX) * Math.min(1, dt / 120);
      G.camX = Math.max(0, Math.min(world.width - LW, G.camX));
    }
    FX.update(dt);
    Skills.update(dt);
  }

  // ---------- 그리기 ----------
  function render() {
    var sh = FX.updateShake(0);
    ctx.setTransform(RS, 0, 0, RS, 0, 0);
    setSmooth();
    ctx.fillStyle = CFG.view.bg; ctx.fillRect(0, 0, LW, LH);
    ctx.translate(sh.x, sh.y);
    var camX = snap(G.camX);
    if (MODE === 'stage') drawStageBg(camX);
    else {
      if (!bgCache) bgCache = buildBackground();
      ctx.drawImage(bgCache, -camX, 0, bgCache.width / RS, bgCache.height / RS);

    }
    Skills.drawBackdrop(ctx, LW, LH, G.player);   // 기술 쓰는 동안 배경만 어둡게

    // 바닥 위: 보스 공격 예고 띠, 먼지
    G.enemies.forEach(function (e) { e.drawTelegraph(ctx, camX); });
    FX.draw(ctx, camX, true);
    Skills.drawUnder(ctx, camX, G.player);        // 번개 떨어질 자리 표시
    // 깊이 순서(아래쪽 = 앞쪽)
    var ents = [{ y: G.player.y, d: function () { Skills.drawGhosts(ctx, camX); G.player.draw(ctx, camX, G.assets.weapons, DEBUG); } }];
    if (G.dummy) ents.push({ y: G.dummy.y, d: function () { G.dummy.draw(ctx, camX, DEBUG); } });
    G.enemies.forEach(function (e) { ents.push({ y: e.y + (e.alive() ? 0 : -0.5), d: function () { e.draw(ctx, camX, DEBUG); } }); });
    ents.sort(function (a, b) { return a.y - b.y; });
    ents.forEach(function (e) { e.d(); });
    Projectiles.draw(ctx, camX);
    Skills.drawOver(ctx, camX);                   // 번개 기둥·회전 원
    FX.draw(ctx, camX, false);
    Skills.drawFlash(ctx, LW, LH);                // 기술 맞는 순간 화면 번쩍

    if (DEBUG) drawDebug(camX);
    if (MODE === 'stage') updateHud();
    if (Skills.ui(G)) controlPad = measureControlPad();   // 기술 버튼이 생기거나 사라지면 버튼 자리 다시 재기
  }

  function rectStroke(b, camX, col) {
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(b.x0 - camX) + 0.5, Math.round(b.y0) + 0.5, Math.round(b.x1 - b.x0), Math.round(b.y1 - b.y0));
  }
  function drawDebug(camX) {
    var p = G.player;
    if (G.dummy) rectStroke(G.dummy.hurtbox(), camX, '#3cf');
    if (MODE === 'stage') rectStroke(p.hurtbox(), camX, '#3f9');
    var active = p.activeWindow() >= 0;
    if (p.state !== 'skill') rectStroke(p.hitbox(), camX, active ? '#f33' : 'rgba(255,80,80,0.35)');
    Skills.drawDebug(ctx, camX, p);               // 기술 판정 상자·번개 자리·화염구
    ctx.fillStyle = 'rgba(255,255,0,0.25)';
    ctx.fillRect(0, world.laneTop, LW, 1); ctx.fillRect(0, world.laneBottom, LW, 1);
  }

  // ---------- HUD (체력 막대, 보스 막대, GO, 알림) ----------
  var hud = {};
  ['pHp', 'pHpLag', 'pHpNum', 'bossBar', 'bHp', 'bHpLag', 'bossName', 'goPrompt', 'banner', 'stageInfo'].forEach(function (k) { hud[k] = document.getElementById(k); });
  var lastHud = {};
  function setIf(key, val, fn) { if (lastHud[key] !== val) { lastHud[key] = val; fn(val); } }
  function updateHud() {
    var p = G.player, S = G.stage;
    var pr = p.hp / p.maxHp;
    setIf('php', pr, function (v) { hud.pHp.style.width = (v * 100) + '%'; hud.pHpLag.style.width = (v * 100) + '%'; hud.pHp.classList.toggle('low', v < 0.3); });
    setIf('phpn', p.hp, function (v) { hud.pHpNum.textContent = v; });
    var B = S.boss, showBoss = !!(B && (B.alive() || S.bossDownT < 800));
    setIf('bshow', showBoss, function (v) { hud.bossBar.hidden = !v; });
    if (B) setIf('bhp', B.hp / B.maxHp, function (v) { hud.bHp.style.width = (v * 100) + '%'; hud.bHpLag.style.width = (v * 100) + '%'; });
    var waves = CFG.stage.waves;
    var go = !S.locked && S.next > 0 && S.next < waves.length && G.camX < S.lastLock + 70 && p.state !== 'dead';
    setIf('go', go, function (v) { hud.goPrompt.hidden = !v; });
    var wi = Math.min(waves.length, S.locked ? S.waveIdx + 1 : S.next + (S.next < waves.length ? 0 : 0));
    setIf('info', wi + '/' + waves.length, function () { hud.stageInfo.textContent = CFG.stage.name + '  ·  ' + Math.max(1, wi) + ' / ' + waves.length; });
  }
  var bannerTimer = 0;
  function banner(text, cls) {
    var b = hud.banner; if (!b) return;
    b.textContent = text; b.className = 'banner ' + (cls || '');
    b.hidden = false; void b.offsetWidth; b.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { b.hidden = true; }, 1600);
  }

  // ---------- 결과 화면 (클리어 / 게임 오버) ----------
  var resultEl = document.getElementById('result');
  function fmtTime(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function showResult(kind) {
    var S = G.stage, p = G.player;
    S.result = kind;
    Input.setOverride(null);
    document.getElementById('resTitle').textContent = kind === 'clear' ? 'STAGE CLEAR!' : 'GAME OVER';
    resultEl.className = 'result ' + kind;
    document.getElementById('resStats').innerHTML =
      '시간 <b>' + fmtTime(S.time) + '</b> · 맞힌 수 <b>' + G.hits + '</b> · 최대 콤보 <b>' + G.maxCombo + '</b>' +
      (kind === 'clear' ? ' · 남은 체력 <b>' + p.hp + '</b>' : '');
    resultEl.hidden = false;
  }
  function resetStage() {
    resultEl.hidden = true;
    FX.list.length = 0;
    Projectiles.clear();
    Skills.clear();
    G.enemies = [];
    G.stage = newStage();
    G.ectx = makeEnemyCtx();
    G.hits = 0; G.totalDmg = 0; G.maxCombo = 0; G.comboT = 0; G.hitstop = 0; G.slowT = 0; comboEl.hidden = true;
    var god = G.player && G.player.god;
    G.player = new Player(CFG);
    G.player.god = !!god;
    G.player.x = 90;
    G.player.y = Math.round((world.laneTop + world.laneBottom) / 2);
    G.player.setCharacter(outfitAssets());
    G.player.weaponKey = G.weaponKey; G.player.setMoveSet(G.moveSet);
    G.camX = 0;
    lastHud = {};
    banner(CFG.stage.name, 'title');
  }
  function makeEnemyCtx() {
    var E = {
      player: null, now: 0, enemies: G.enemies, view: { x0: 0, x1: LW }, world: world,
      onPlayerHit: onPlayerHit,
      dust: function (x, y, dir) { if (G.assets.dust && G.assets.dust.length) FX.sprite(x, y, G.assets.dust, CFG.dust.fps, CFG.dust.pivot, dir > 0, true); },
      shake: function (m) { FX.shake(J.shakePx * m, J.shakeMs * 1.6); }
    };
    Object.defineProperty(E, 'player', { get: function () { return G.player; } });
    return E;
  }

  // ---------- 고르기 버튼 ----------
  function bindToggles() {
    document.querySelectorAll('[data-char]').forEach(function (b) {
      b.addEventListener('click', function () { setChar(b.dataset.char); b.blur(); });
    });
    document.querySelectorAll('[data-class]').forEach(function (b) {
      b.addEventListener('click', function () { setClass(b.dataset.class); b.blur(); });
    });
  }
  // 지금 성별 + 직업 옷에 맞는 그림 묶음 이름 (기사 = knight_male / knight_female, 없으면 견습 옷)
  function outfitKey() {
    var c = CFG.classes && CFG.classes[G.classKey], A = CFG.art.characters;
    var k = c && c.outfit ? c.outfit + '_' + G.charKey : G.charKey;
    return A[k] ? k : G.charKey;
  }
  // 그 그림 묶음 (아직 안 불러왔으면 지금 플레이어 그림 그대로)
  function outfitAssets() {
    var C = G.assets.characters;
    return C[outfitKey()] || (G.player && G.player.char) || C[G.charKey] || C[Object.keys(C)[0]];
  }
  // 옷 그림 묶음을 (필요하면 불러와서) 플레이어에 입힘. 불러오는 동안은 예전 옷 그대로 + 작은 로딩 표시
  function wearOutfit() {
    var k = outfitKey(), a = G.assets.characters[k];
    function put(a) { if (a && G.player && G.player.char !== a) G.player.setCharacter(a); }
    if (a) { put(a); return Promise.resolve(a); }
    loading(true);
    return Assets.ensureChar(k).then(function (a) {
      bakeFilter(a);
      loading(false);
      if (outfitKey() === k) put(a);
      return a;
    });
  }
  // 로딩 막대: 처음엔 화면 가운데 큰 막대, 옷 바꿀 때는 작은 표시(mini)
  var loadEl = document.getElementById('loading');
  function loading(on) {
    if (!loadEl || !document.body.classList.contains('ready')) return;
    loadEl.classList.add('mini'); loadEl.hidden = !on;
  }
  G.wearOutfit = wearOutfit;
  // 직업의 무기: 성별마다 다를 수 있음(법사 = 남 staff / 여 wand)
  function classWeapon(c) { var w = c.weapon; return w && typeof w === 'object' ? (w[G.charKey] || w.male) : w; }
  function setChar(k) {
    if (!CFG.art.characters[k]) return Promise.resolve(null);
    G.charKey = k;
    var c = CFG.classes && CFG.classes[G.classKey];
    if (c) { G.weaponKey = classWeapon(c); G.player.weaponKey = G.weaponKey; }
    document.querySelectorAll('[data-char]').forEach(function (b) { b.classList.toggle('on', b.dataset.char === k); });
    return wearOutfit();
  }
  // 직업 고르기: 견습(맨손) / 기사(검). 직업이 무기와 콤보 묶음을 정한다 (config classes)
  function setClass(k) {
    var c = CFG.classes && CFG.classes[k];
    if (!c) return;
    G.classKey = k; G.weaponKey = classWeapon(c); G.moveSet = c.moves;
    var pr = Promise.resolve(null);
    if (G.player) {
      pr = wearOutfit();   // 옷이 바뀔 때만 그림 묶음 교체
      G.player.weaponKey = G.weaponKey; G.player.setMoveSet(c.moves);
    }
    document.querySelectorAll('[data-class]').forEach(function (b) { b.classList.toggle('on', b.dataset.class === k); });
    return pr;
  }
  // 무기만 바꾸기(디버그·나중용): 콤보 묶음은 그대로
  function setWeapon(k) { if (CFG.weapons[k]) G.weaponKey = k; }
  G.setChar = function (k) { return setChar(k); };
  G.setClass = function (k) { return setClass(k); };
  G.setWeapon = function (k) { setWeapon(k); };


  // 여자 그림이 오기 전: 남자 그림 색만 바꿔 임시로 씀 (한 번만 미리 구워 둠)
  // 머리카락(위쪽 진한 갈색) → 자주색, 옷(연한 베이지) → 하늘색. 서버로 열었을 때만 가능,
  // 파일로 직접 열면(보안상 픽셀을 못 읽음) 전체 색돌리기로 대신한다.
  function recolorPixels(g, w, h, pivotY) {
    var d = g.getImageData(0, 0, w, h), p = d.data;
    for (var i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 10) continue;
      var r = p[i] / 255, gg = p[i + 1] / 255, b = p[i + 2] / 255;
      var mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2, s = 0, hue = 0, dd = mx - mn;
      if (dd > 0) {
        s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
        hue = mx === r ? ((gg - b) / dd + (gg < b ? 6 : 0)) : mx === gg ? ((b - r) / dd + 2) : ((r - gg) / dd + 4);
        hue *= 60;
      }
      var y = (i / 4 / w) | 0;
      var nh = null;
      if (y < pivotY - 72 * AS && hue >= 5 && hue <= 38 && l < 0.5 && s > 0.3) nh = 325;           // 머리카락
      else if (hue >= 28 && hue <= 60 && l > 0.5 && s < 0.6 && y < pivotY - 25 * AS) nh = 195;     // 옷
      if (nh === null) continue;
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s, pp = 2 * l - q, hk = nh / 360;
      [hk + 1 / 3, hk, hk - 1 / 3].forEach(function (t, j) {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        var v = t < 1 / 6 ? pp + (q - pp) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp;
        p[i + j] = Math.round(v * 255);
      });
    }
    g.putImageData(d, 0, 0);
  }
  function bakeFilter(charAssets) {
    var def = charAssets && charAssets.def;
    if (!def || !def.placeholderFilter || charAssets._filtered) return;
    charAssets._filtered = true;
    Object.keys(charAssets.anims).forEach(function (n) {
      charAssets.anims[n] = charAssets.anims[n].map(function (img) {
        if (!img) return img;
        var c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        var g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        g.drawImage(img, 0, 0);
        try { recolorPixels(g, c.width, c.height, def.pivot.y); }
        catch (e) {
          if (!('filter' in g)) return img;
          g.clearRect(0, 0, c.width, c.height); g.filter = def.placeholderFilter; g.drawImage(img, 0, 0);
        }
        return c;
      });
    });
  }


  // ---------- 시험용 (콘솔에서 GAME.test.xxx) ----------
  G.test = {
    killAll: function () { G.enemies.forEach(function (e) { if (e.alive()) { if (e.T.boss) { e.takeHit(99999, 1, 10, true); onBossDown(e); } else e.takeHit(9999, 1, 10, true, { force: true }); } }); },
    // 보스 방 바로 앞으로: 남은 웨이브는 건너뜀
    toBoss: function () {
      var S = G.stage, waves = CFG.stage.waves;
      G.enemies = []; G.ectx.enemies = G.enemies;
      S.locked = false; S.queue = []; S.next = waves.length - 1;
      var at = waveAt(waves[S.next]);
      S.camMin = at - 40; G.camX = at - 40;
      G.player.x = at - 40 + LW * 0.42 - 4;
    },
    // 기술 바로 쓰기(쿨타임 무시): GAME.test.skill('A')
    skill: function (slot, noCd) { if (noCd) G.player.skillCd = {}; Input.pressSkill(slot || 'A'); },
    resetCd: function () { G.player.skillCd = {}; },
    hurt: function (n, heavy) { var p = G.player; p.invulnT = 0; p.takeHit(n || 10, -p.dir, 10, 0, !!heavy); },
    god: function (on) { G.player.god = on !== false; },
    bot: function (on) { G.bot = on !== false; if (!G.bot) Input.setOverride(null); },
    retry: function () { resetStage(); },
    info: function () {
      var S = G.stage, p = G.player;
      return { mode: MODE, LW: LW, LH: LH, scale: SCALE, rs: RS, hd: Assets.isHD(),
 controlPad: controlPad, char: G.player.char && G.player.char.def.anims.idle.frames[0], camX: Math.round(G.camX), wave: S ? S.next : null, locked: S ? S.locked : null,
        waveIdx: S ? S.waveIdx : null, time: S ? Math.round(S.time) : null, result: S ? S.result : null,
        player: { hp: p.hp, state: p.state, x: Math.round(p.x), y: Math.round(p.y), skill: p.sk ? p.sk.d.key + '@' + Math.round(p.sk.t) : null, cd: p.skillCd },
        enemies: G.enemies.map(function (e) { return e.type + ':' + e.state + ':' + e.hp + '@' + Math.round(e.x) + ',' + Math.round(e.y); }),
        hits: G.hits, maxCombo: G.maxCombo };
    }
  };

  // ---------- 시작 ----------
  var last = 0, acc = 0, STEP = 1000 / 60;
  function frame(now) {
    var real = Math.min(100, now - (last || now)); last = now;
    acc += real;
    var n = 0;
    while (acc >= STEP && n < 5) { step(STEP); acc -= STEP; n++; }
    if (n === 5) acc = 0;
    render();
    if (DEBUG && window.Debug) Debug.tick(real, G);
    requestAnimationFrame(frame);
  }
  G.stepFor = function (ms) { var n = Math.round(ms / STEP); for (var i = 0; i < n; i++) step(STEP); render(); };   // 시험용: 빨리 감기

  // 연습장 ↔ 1단계 판 이동 버튼 (?debug=1 같은 다른 옵션은 그대로 둠)
  function modeLink() {
    var a = document.getElementById('modeBtn'); if (!a) return;
    var q = new URLSearchParams(location.search);
    if (MODE === 'stage') { q.set('mode', 'practice'); a.textContent = '연습장'; }
    else { q.delete('mode'); a.textContent = '1단계 판'; }
    var s = q.toString(); a.href = location.pathname + (s ? '?' + s : '');
    var r = document.getElementById('resPractice');
    if (r) { var q2 = new URLSearchParams(location.search); q2.set('mode', 'practice'); r.href = location.pathname + '?' + q2.toString(); }
  }

  // 처음 불러올 것: 지금 고른 옷 하나(나머지 옷은 시작한 뒤 뒤에서 하나씩). 예전 견습 그림(?art=novice)은 둘 다
  G.classKey = CFG.defaultClass || 'novice';
  var firstChars = CFG.artSet === 'novice' ? Object.keys(CFG.art.characters) : [outfitKey()];
  if (loadEl) {
    var lbar = loadEl.querySelector('i');
    Assets.progress.onChange = function (got, want) { if (lbar) lbar.style.width = Math.round(100 * got / Math.max(1, want)) + '%'; };
  }
  Assets.loadAll(CFG, firstChars).then(function (assets) {
    G.assets = assets;
    // 기술(skills.js)이 쓰는 도구: 맞히기·대상 목록·먼지·효과 그림·멈춤·슬로모션
    Skills.init(CFG, {
      onHit: onHit,
      targets: function () { return MODE === 'stage' ? G.enemies : [G.dummy]; },
      dust: function (x, y, dir) { if (G.assets.dust && G.assets.dust.length) FX.sprite(x, y, G.assets.dust, CFG.dust.fps, CFG.dust.pivot, dir > 0, true); },
      fx: function () { return G.assets.fx; },
      hitstop: function (ms) { G.hitstop = Math.max(G.hitstop, ms); },
      slow: function (ms) { G.slowT = Math.max(G.slowT, ms); }
    });
    Object.keys(assets.characters).forEach(function (k) { bakeFilter(assets.characters[k]); });
    document.body.classList.add('mode-' + MODE);
    G.player = new Player(CFG);
    if (MODE === 'practice') G.dummy = new Dummy(CFG, assets.dummy);
    resize();
    G.player.y = Math.round((world.laneTop + world.laneBottom) / 2);
    if (G.dummy) G.dummy.y = G.player.y;
    G.camX = Math.max(0, G.player.x - LW * 0.42);
    setChar('male'); setClass(CFG.defaultClass || 'novice');
    if (MODE === 'stage') {
      hudEl.hidden = false;
      resetStage();
      document.getElementById('btnRetry').addEventListener('click', function () { resetStage(); this.blur(); });
      if (params.get('god') === '1') G.player.god = true;
    }
    modeLink();
    bindToggles();
    Input.init(CFG);
    if (DEBUG && window.Debug) Debug.init(G);
    document.body.classList.add('ready');
    if (loadEl) { loadEl.hidden = true; Assets.progress.onChange = null; }
    setTimeout(function () { Assets.loadRest(); }, 800);   // 나머지 옷 그림은 뒤에서 하나씩
    requestAnimationFrame(frame);
  });
  window.addEventListener('resize', function () { if (G.player) resize(); });
})();
