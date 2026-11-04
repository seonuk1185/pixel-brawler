// 게임 본체: 화면 크기, 배경, 매 장면 갱신, 타격 처리
// 기본 = 스테이지 판(웨이브 + 보스, 여러 판). 주소 뒤 ?mode=practice = 예전 허수아비 연습장
// 주소 뒤 ?stage=N = 그 판으로 바로 시작(시험용, 잠금 무시). ?bot=1 이면 고르기 화면 없이 바로 시작
(function () {
  var CFG = window.CFG, J = CFG.juice;
  var AS = CFG.actorScale || 1;   // 캐릭터 크기: 코드에 바로 적힌 거리·높이와 손맛의 밀림 거리(juice.knockback)에 곱한다
  var params = new URLSearchParams(location.search);
  var DEBUG = params.get('debug') === '1';
  var MODE = params.get('mode') === 'practice' ? 'practice' : 'stage';
  if (params.get('slow')) J.timeScale = +params.get('slow') || 1;

  // ---------- 스테이지 고르기 (2026-11-04) ----------
  // 열린 판 = 깬 판 + 1. 깬 판 번호는 이 브라우저에 저장(localStorage). 저장이 막혀 있어도 게임은 됨(이번에 연 동안만 기억)
  var STAGES = CFG.stages;
  var urlStage = parseInt(params.get('stage'), 10);
  urlStage = urlStage >= 1 && urlStage <= STAGES.length ? urlStage : 0;
  var SAVE_KEY = 'pixelBrawler.cleared';
  var clearedMem = 0;
  function loadCleared() {
    var n = 0;
    try { n = parseInt(localStorage.getItem(SAVE_KEY), 10) || 0; } catch (e) {}
    return Math.max(n, clearedMem);
  }
  function saveCleared(n) {
    clearedMem = Math.max(clearedMem, n);
    try { if (n > (parseInt(localStorage.getItem(SAVE_KEY), 10) || 0)) localStorage.setItem(SAVE_KEY, String(n)); } catch (e) {}
  }
  function unlockedMax() { return urlStage || CFG.stagesAllOpen ? STAGES.length : Math.min(STAGES.length, loadCleared() + 1); }
  // 처음 판: ?stage=N, 아니면 열린 판 중 마지막(고르기 화면 뒤에 미리 보임). 다 열어 둔 시험 기간엔 아직 안 깬 첫 판
  var startNo = urlStage || (CFG.stagesAllOpen ? Math.min(STAGES.length, loadCleared() + 1) : unlockedMax());
  CFG.stage = STAGES[startNo - 1]; CFG.bg = CFG.stage.bg;

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
    if (MODE === 'stage') applyStageWorld();
    else {
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

  // 지금 판(CFG.stage)의 길이·배경 높이로 걷는 길을 정함
  function applyStageWorld() {
    var B = CFG.bg;
    world.width = CFG.stage.width;
    world.bgOff = Math.max(0, LH - B.height);          // 화면이 240보다 높으면 배경을 바닥에 붙이고 위는 하늘로 채움
    world.laneTop = world.bgOff + B.laneTop;
    world.laneBottom = Math.min(LH - 8, world.bgOff + B.laneBottom);
  }

  // 공격 버튼(+ 기술 버튼 2개)이 덮는 게임 화면 오른쪽 폭(도트). 버튼이 안 보이거나 걷는 길과 안 겹치면 0
  function measureControlPad() {
    var c = canvas.getBoundingClientRect();
    if (!c.width || !c.height) return 0;
    var ky = c.height / LH;
    var laneT = c.top + world.laneTop * ky - 100 * AS * ky, laneB = c.top + world.laneBottom * ky;   // 키 큰 몸(100도트)까지
    var pad = 0;
    ['btnAtk', 'btnJump', 'btnSkA', 'btnSkB'].forEach(function (id) {
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

  // ---------- 판 배경: 3장 겹쳐 흐르기(먼 산 · 숲/폐허/마을 · 흙길) ----------
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
    stage: null, bot: params.get('bot') === '1',
    stageNo: startNo, paused: false, props: Props.list
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
    // 소품(상자·통): 단계만 넘김(데미지 숫자·콤보 수 없음). 기술(damageStyle) = 한 번에 부서짐, 맞은 곳 = 마법이면 그 자리, 아니면 몸 앞
    if (target.isProp) {
      Props.hit(target, { dmg: dmg, strong: !!st.damageStyle, finisher: !!st.finisher, dir: dir,
        x: src ? src.x : p.x + p.dir * 30 * AS, y: src ? src.y : p.y - (p.z || 0) + (st.hitY != null ? st.hitY : -40 * AS) });
      return;
    }
    // 방패 막기(해골 병사): 앞에서 오는 보통 타면 막음 → 데미지 없이 쨍 불똥 + 조금 밀림.
    //   방패 깨는 타 = 기술(damageStyle) · 콤보 마무리 · 넘어뜨리는 타 · 달리며 공격 · 점프 공격 (뒤에서 맞으면 enemies.js tryGuard 가 안 막음)
    var jumpHit = !src && p.state === 'jump';
    if (target !== G.dummy && target.tryGuard) {
      var breaker = !!(st.damageStyle || st.finisher || st.knockdown || p.state === 'runatk' || jumpHit);
      if (target.tryGuard(dir, breaker)) { blockFx(target, dir); return; }
    }
    // 나는 적(박쥐) + 점프 공격: 데미지 더 세게 + 늘 땅으로 떨어짐(넘어짐)
    var airHit = jumpHit && target.T && target.T.flying;
    if (airHit) dmg = Math.round(dmg * (target.T.flying.jumpDmgMul || 1));
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
      //   noKnockdown = 세게 밀어도 안 넘어짐(달리며 공격 어깨 돌진 마무리 = 멀리 날려 보내기), noJuggle = 연속 맞음으로 안 넘어짐(밀고 가는 작은 타)
      var heavy = airHit || (!st.noKnockdown && (!!st.knockdown || st.knock * W.knockMul >= CFG.ai.react.heavyKnock));
      var res = target.takeHit(dmg, dir, knock, !!st.finisher && !st.noKnockdown, { heavy: heavy, stunMs: st.stunMs, noJuggle: !!st.noJuggle, flashK: st.flashK });   // stunMs = 번개 기술
      var hb = target.hurtbox();
      // 불똥은 맞은 몸의 가장자리(플레이어 쪽)에서. 마법은 맞은 곳에서 가장 가까운 몸 위치
      if (src) hx = clamp(src.x, hb.x0 + 4, hb.x1 - 4);
      else hx = p.dir > 0 ? Math.max(hb.x0 + 4, Math.min(hb.x1 - 4, p.x + 30 * AS)) : Math.min(hb.x1 - 4, Math.max(hb.x0 + 4, p.x - 30 * AS));
      topY = target.y - target.T.height - 8;
      if (target.guardBroken) {   // 방패 깨짐: 쨍 하고 방패가 튕겨 나가는 불똥(크게)
        target.guardBroken = false;
        FX.impact(target.x + target.dir * 14 * AS, target.y - 54 * AS, -dir, '#fff4c8', J.sparkCount, true, G.assets.fx && G.assets.fx.impact, 1.1);
      }
      if (res === 'dead' && target.T.boss) onBossDown(target);
      else if (res === 'dead') G.hitstop = Math.max(G.hitstop, J.hitstopMs * 1.6);
    }
    // hitY = 주먹·발이 닿는 높이(맨손 콤보), spark = 불똥 그림 크기(맨손은 작게)
    var hy = p.y - (p.z || 0) + (st.hitY != null ? st.hitY : -52 * AS), sc = st.spark || 1;   // 공중이면 그만큼 위
    if (src) { var tb = target.hurtbox(); hy = clamp(src.y, tb.y0 + 6, tb.y1 - 6); }
    else if (st.atTarget) { var tb2 = target.hurtbox(); hy = clamp(hy, tb2.y0 + 6, tb2.y1 - 6); }   // 공중 공격: 맞은 몸 안쪽
    // impactFx = 불똥 대신 쓸 그림(법사 = magic_spark)
    var impSpr = G.assets.fx && ((st.impactFx && G.assets.fx[st.impactFx]) || G.assets.fx.impact);
    // big = 기술의 큰 불똥(마무리 타처럼 많이·멀리). damageStyle = 기술 숫자 모양(config damageText)
    var big = !!(st.finisher || st.big);
    FX.impact(hx, hy, dir, W.sparkColor, Math.round(J.sparkCount * (big ? 1.6 : 1) * (sc < 1 ? 0.7 : 1) * (st.damageStyle ? 1.3 : 1)), big, impSpr, sc);
    // 숫자: crit = 마무리 모양(「22!」), numStyle = 숫자 모양만 따로(달리며 공격 작은 타 = push). 마지막 = 대상(같은 대상 숫자는 위로 쌓임)
    FX.damage(target.x, topY, dmg, !!(st.finisher || st.crit || (st.damageStyle && st.knockdown)), J, null, st.numStyle || st.damageStyle, target.id || 'dummy', !!st.mergeNum);
    vibrate(Math.round(J.vibrateMs * (st.finisher ? 2 : 1)));
    G.hits++; G.totalDmg += dmg;
    G.comboHits = G.comboT > 0 ? G.comboHits + 1 : 1;
    G.maxCombo = Math.max(G.maxCombo, G.comboHits);
    G.comboT = 1200;
    showCombo();
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  // 방패로 막음: 방패 자리에 하얀·노란 쨍 불똥 + 쇳조각 반짝임, 짧은 멈춤·작은 흔들림(데미지 숫자·콤보 수 없음)
  function blockFx(e, dir) {
    var x = e.x + e.dir * 30 * AS, y = e.y - 56 * AS;
    G.hitstop = Math.max(G.hitstop, J.hitstopMs * 0.7);
    FX.shake(J.shakePx * 0.5, J.shakeMs * 0.7);
    FX.impact(x, y, -dir, '#e8f0ff', Math.round(J.sparkCount * 0.9), false, G.assets.fx && G.assets.fx.impact, 0.85);
    if (Skills.debris) Skills.debris(x, y, e.y, 7, { cols: ['#ffffff', '#fff2a8', '#cfe0ff'], glow: true, sp: 150, size: 1.3, ms: 260 });
    vibrate(Math.round(J.vibrateMs * 0.6));
  }
  // 플레이어 공격에 맞을 수 있는 것: 판 = 적 + 부서지는 소품(새 배열), 연습장 = 허수아비
  function hitTargets() { return MODE === 'stage' ? G.enemies.concat(Props.targets()) : [G.dummy]; }

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
    var targets = hitTargets();
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
    if (e.dmgMul !== 1) dmg = Math.max(1, Math.round(dmg * e.dmgMul));   // 판·변종 공격력 배율
    var dir = p.x >= e.x ? 1 : -1;
    if (!p.takeHit(dmg, dir, spec.knock, spec.flinchMs, !!spec.heavy)) return;   // heavy = 넘어짐
    G.hitstop = Math.max(G.hitstop, J.hitstopMs * (e.T.boss ? 1.3 : 0.8));
    FX.shake(J.shakePx * (spec.shake || 1.2), J.shakeMs * 1.3);
    FX.impact(p.x - dir * 4, p.y - 60 * AS, -dir, '#ff6a5a', Math.round(J.sparkCount * 0.8), e.T.boss, null, 0.8);
    FX.damage(p.x, p.y - (p.z || 0) - 112 * AS, dmg, false, J, '#ff5a4a', null, 'player');
    vibrate(Math.round(J.vibrateMs * 2.5));
    G.comboT = 0; comboEl.hidden = true;
    // 독(전갈 왕 독침): 맞으면 잠깐 독 → poisonStep 이 everyMs 마다 체력을 조금씩 깎음(독으로는 안 쓰러짐)
    if (spec.poison) p.poison = { t: spec.poison.ms, tick: spec.poison.everyMs, every: spec.poison.everyMs, dmg: spec.poison.dmg };
  }
  function poisonStep(dt) {
    var p = G.player, P = p.poison;
    if (!P) return;
    if (p.state === 'dead') { p.poison = null; return; }
    P.t -= dt; P.tick -= dt;
    if (P.tick <= 0) {
      P.tick += P.every;
      var n = p.god ? 0 : Math.min(P.dmg, p.hp - 1);
      if (n > 0) { p.hp -= n; FX.damage(p.x, p.y - (p.z || 0) - 112 * AS, n, false, J, '#9cff5a', null, 'player'); }
      if (Skills.debris) Skills.debris(p.x, p.y - 50 * AS, p.y, 4, { cols: ['#b6ff6a', '#6ad83a', '#e8ffb0'], glow: true, sp: 50, size: 1.3, ms: 420, g: -30, spread: 0.8 });
    }
    if (P.t <= 0) p.poison = null;
  }

  // ---------- 미라 잡기 (2026-11-04): 닿으면 붙잡힘 → 버튼 연타로 빨리 풀림 → 놓으면서 데미지 + 내던짐 ----------
  // 잡을 수 있나: 쓰러짐·넘어짐·이미 잡힘·무적(깜빡임·기술 무적)·공중이면 못 잡음(헛손질)
  function grabPlayer(e, spec) {
    var p = G.player;
    if (p.state === 'dead' || p.state === 'down' || p.state === 'held' || p.invulnT > 0 || (p.z || 0) > 4) return false;
    if (p.state === 'skill' && Skills.invulnerable(p)) return false;
    p.state = 'held'; p.heldBy = e; p.animT = 0; p.vx = 0;
    p.atk = null; p.sk = null; p.jp = null; p.ratk = null; p.comboStep = 0;
    p.dir = -e.dir;
    G.hitstop = Math.max(G.hitstop, J.hitstopMs * 0.8);
    FX.shake(J.shakePx * (spec.shake || 1) * 0.6, J.shakeMs);
    FX.impact(p.x - p.dir * 2, p.y - 62 * AS, p.dir, '#ffe0a0', Math.round(J.sparkCount * 0.5), false, null, 0.7);
    vibrate(Math.round(J.vibrateMs * 2));
    G.comboT = 0; comboEl.hidden = true;
    grabMash();   // 잡히기 전에 눌러 둔 버튼은 안 셈
    return true;
  }
  // 붙잡힌 동안 누른 버튼 수(공격·점프·기술 A/B, 한 번 누름 = 한 번)
  function grabMash() {
    var n = 0, ms = 400;
    if (Input.takeAttack(ms)) n++;
    if (Input.takeJump(ms)) n++;
    if (Input.takeSkill('A', ms)) n++;
    if (Input.takeSkill('B', ms)) n++;
    if (n && G.player.state === 'held') FX.shake(J.shakePx * 0.25, 60);   // 버둥: 화면이 살짝 떨림
    return n;
  }
  // 놓음: 상태를 풀고 그 공격으로 때림(heavy = 넘어짐 = 내던져짐)
  function releaseGrab(e, spec) {
    var p = G.player;
    if (p.state !== 'held') return;
    p.state = 'idle'; p.heldBy = null;
    onPlayerHit(e, spec);
  }
  // 매 장면: 붙잡힌 플레이어를 잡은 적 앞에 붙여 둠. 잡은 적이 맞거나 쓰러져 잡기가 끊기면 그냥 풀림(데미지 없음, 잠깐 무적)
  function heldStep() {
    var p = G.player, e = p.heldBy;
    if (p.state !== 'held') { p.heldBy = null; return; }
    if (!e || !e.alive() || e.state !== 'attack' || !e.atk || !e.atk.held) {
      p.state = 'idle'; p.heldBy = null; p.animT = 0; p.invulnT = Math.max(p.invulnT, 500);
      return;
    }
    p.x = e.x + e.dir * e.atk.spec.grab.dist; p.y = e.y; p.dir = -e.dir;
  }

  // ---------- 화면 위 글자 ----------
  var comboEl = document.getElementById('combo');
  function showCombo() {
    comboEl.innerHTML = '<b>' + G.comboHits + '</b> HIT';
    comboEl.classList.remove('pop'); void comboEl.offsetWidth; comboEl.classList.add('pop');
    comboEl.hidden = false;
  }

  // ================= 판 진행 =================
  // placedQ = 다음 웨이브의 미리 서 있는 적 중 아직 안 내놓은 것(카메라가 다가가면 화면 밖 오른쪽에서부터 내놓음)
  function newStage() {
    return { next: 0, locked: false, lockCam: 0, lastLock: -1, queue: [], waveT: 0, waveIdx: -1, placedQ: [],
             camMin: 0, time: 0, boss: null, bossDownT: -1, result: null, overT: 0, lastAttackAt: -1e9 };
  }
  function waveAt(w) { return w.at === 'end' ? world.width - LW : Math.min(w.at, world.width - LW); }

  function startWave(i) {
    var S = G.stage, w = CFG.stage.waves[i];
    S.locked = true; S.lockCam = waveAt(w); S.waveIdx = i; S.lastLock = S.lockCam; S.waveT = 0;
    S.queue = (w.spawn || []).map(function (s) { return { type: s[0], side: s[1], at: s[2], opt: s[3] }; });
    // 미리 서 있는 적: 아직 안 나온 것도 지금 다 내놓고, 화면이 고정되면 전부 알아챔
    S.placedQ.forEach(spawnPlaced); S.placedQ = [];
    G.enemies.forEach(function (e) { if (e.asleep) wakeEnemy(e, Math.random() * (CFG.ai.wake.groupDelayMs || 0)); });
    banner(w.boss ? 'BOSS!' : 'WAVE ' + (i + 1), w.boss ? 'boss' : '');
  }

  // 적 하나 만들기: 판 배율(hpMul·dmgMul) + 변종(색·배율) 적용. opt = { variant }
  function makeEnemy(type, x, y, opt) {
    var S = G.stage, T = CFG.enemies[type], st = CFG.stage;
    var vk = opt && opt.variant, V = vk && CFG.variants ? CFG.variants[vk] : null;
    var e = new Enemy(type, CFG, V ? tintArt(type, vk) : G.assets.enemies[type], x, y);
    var hm = (st.hpMul || 1) * (V && V.hpMul || 1), dm = (st.dmgMul || 1) * (V && V.dmgMul || 1);
    if (hm !== 1) e.hp = e.maxHp = Math.round(e.maxHp * hm);
    e.dmgMul = dm;
    if (V) { e.variant = vk; if (V.label) e.label = V.label + ' ' + e.label; }
    e.wave = S.waveIdx;
    G.enemies.push(e);
    if (T.boss) S.boss = e;
    return e;
  }
  function spawnEnemy(type, side, opt) {
    var S = G.stage, T = CFG.enemies[type];
    var x = side === 'L' ? S.lockCam - T.radius - 30 : S.lockCam + LW + T.radius + 30;
    var y = world.laneTop + Math.random() * (world.laneBottom - world.laneTop);
    var e = makeEnemy(type, x, y, opt);
    e.dir = side === 'L' ? 1 : -1;
    return e;
  }

  // ---------- 미리 서 있는 적 (웨이브의 placed) ----------
  function laneY(k) { return world.laneTop + clamp(k, 0, 1) * (world.laneBottom - world.laneTop); }
  // 웨이브 i 의 placed 를 줄 세움(x = 그 웨이브 화면 왼쪽 끝 + 적힌 도트)
  function preparePlaced(i) {
    var S = G.stage, w = CFG.stage.waves[i];
    S.placedQ = [];
    if (!w || !w.placed) return;
    var at = waveAt(w);
    S.placedQ = w.placed.map(function (q) { return { type: q[0], x: at + q[1], yk: q[2], opt: q[3] || {}, wave: i }; });
  }
  function spawnPlaced(q) {
    var e = makeEnemy(q.type, q.x, laneY(q.yk), q.opt);
    e.wave = q.wave;
    e.dir = q.opt.dir || -1;
    e.sleep(q.opt.pose, q.opt.group);
    return e;
  }
  function wakeEnemy(e, delayMs) { e.wake((CFG.ai.wake.alertMs || 0) + (delayMs || 0)); }
  // 매 장면: 카메라가 다가가면 내놓기 · 플레이어가 가까우면 깸 · 무리 중 하나가 깨면 다 깸
  function placedStep() {
    var S = G.stage, p = G.player, W = CFG.ai.wake;
    if (S.placedQ.length) S.placedQ = S.placedQ.filter(function (q) {
      if (q.x - CFG.enemies[q.type].radius > G.camX + LW + 40) return true;
      spawnPlaced(q); return false;
    });
    var awakeGroups = {}, any = false;
    G.enemies.forEach(function (e) {
      if (!e.asleep) { if (e.group) awakeGroups[e.group] = true; return; }
      any = true;
      if (p.state !== 'dead' && Math.abs(e.x - p.x) < W.dist && Math.abs(e.y - p.y) < W.dist * 0.6) { wakeEnemy(e, 0); if (e.group) awakeGroups[e.group] = true; }
    });
    if (any) G.enemies.forEach(function (e) {
      if (e.asleep && e.group && awakeGroups[e.group]) wakeEnemy(e, Math.random() * (W.groupDelayMs || 0));
    });
  }

  // ---------- 색만 바꾼 적 그림 (variant): 처음 한 번만 구워 두고 계속 다시 씀 ----------
  // 캔버스 filter(hue-rotate·saturate·brightness)로 복사본을 만든다. filter 를 모르는 브라우저는 점마다 같은 계산(느리지만 한 번뿐)
  var tintCache = {};
  function tintArt(type, vk) {
    var key = type + ':' + vk, src = G.assets.enemies[type], V = CFG.variants && CFG.variants[vk];
    if (tintCache[key]) return tintCache[key];
    if (!src || !V) return src;
    var out = {};
    Object.keys(src).forEach(function (n) { out[n] = src[n].map(function (im) { return tintImg(im, V); }); });
    tintCache[key] = out;
    return out;
  }
  function tintImg(img, V) {
    if (!img) return img;
    var c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    var g = c.getContext('2d');
    if ('filter' in g) {
      g.filter = 'hue-rotate(' + (V.hue || 0) + 'deg) saturate(' + (V.sat != null ? V.sat : 1) + ') brightness(' + (V.bright != null ? V.bright : 1) + ')';
      g.drawImage(img, 0, 0);
    } else {
      g.drawImage(img, 0, 0);
      try { tintPixels(g, c.width, c.height, V); } catch (e) { return img; }   // 파일로 열면 점을 못 읽음 → 원래 그림
    }
    if (V.color && V.colorK > 0) {   // 덧칠: 그림이 있는 점에만(source-atop) 이 색을 colorK 만큼
      g.filter = 'none'; g.globalCompositeOperation = 'source-atop'; g.globalAlpha = V.colorK;
      g.fillStyle = V.color; g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    }
    return Assets.copyMeta(img, c);
  }
  // CSS hue-rotate / saturate / brightness 와 같은 색 계산(W3C filter 행렬)
  function tintPixels(g, w, h, V) {
    var a = (V.hue || 0) * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), s = V.sat != null ? V.sat : 1, b = V.bright != null ? V.bright : 1;
    var H = [0.213 + cs * 0.787 - sn * 0.213, 0.715 - cs * 0.715 - sn * 0.715, 0.072 - cs * 0.072 + sn * 0.928,
             0.213 - cs * 0.213 + sn * 0.143, 0.715 + cs * 0.285 + sn * 0.140, 0.072 - cs * 0.072 - sn * 0.283,
             0.213 - cs * 0.213 - sn * 0.787, 0.715 - cs * 0.715 + sn * 0.715, 0.072 + cs * 0.928 + sn * 0.072];
    var S = [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
             0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s];
    var M = [];
    for (var r = 0; r < 3; r++) for (var k = 0; k < 3; k++) M[r * 3 + k] = b * (S[r * 3] * H[k] + S[r * 3 + 1] * H[3 + k] + S[r * 3 + 2] * H[6 + k]);
    var d = g.getImageData(0, 0, w, h), p = d.data;
    for (var i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      var R = p[i], G2 = p[i + 1], B = p[i + 2];
      p[i] = R * M[0] + G2 * M[1] + B * M[2]; p[i + 1] = R * M[3] + G2 * M[4] + B * M[5]; p[i + 2] = R * M[6] + G2 * M[7] + B * M[8];
    }
    g.putImageData(d, 0, 0);
  }
  // 판에 나오는 변종 그림을 판 시작할 때 미리 구움(게임 중 멈칫 없게)
  function bakeStageVariants() {
    CFG.stage.waves.forEach(function (w) {
      (w.spawn || []).concat(w.placed || []).forEach(function (s) { if (s[3] && s[3].variant) tintArt(s[0], s[3].variant); });
    });
  }

  // ---------- 판에 나오는 적 종류 (그 판 적 그림만 불러오기, 2026-11-04) ----------
  // 웨이브 spawn·placed + 보스가 화날 때 부르는 졸개까지
  function stageEnemies(st) {
    var out = [];
    function add(t) {
      if (!t || out.indexOf(t) >= 0 || !CFG.enemies[t]) return;
      out.push(t);
      var E = CFG.enemies[t].enrage;
      if (E && E.summon) E.summon.forEach(add);
    }
    (st.waves || []).forEach(function (w) { (w.spawn || []).concat(w.placed || []).forEach(function (s) { add(s[0]); }); });
    return out;
  }

  // ---------- 바위 던지기 (골렘 throw): 날아가는 바위 = 포물선 → 떨어진 자리 반경 안이면 맞음 ----------
  // 플레이어 공격 탄(Projectiles)과 따로: 적이 던진 것. { e: 던진 적, s: 공격 수치, x0,y0: 출발(땅 줄), h0: 출발 높이, tx,ty: 떨어질 자리, t }
  //   3단계 두꺼비 독 뱉기도 같은 길: s.proj / s.burstArt = 날아가는 그림 / 터지는 그림 이름(fxArt, 없으면 골렘 바위), s.puddle = 떨어진 자리에 독 웅덩이
  var rocks = [];
  function throwRock(e, s, tx, ty) {
    var F = G.assets.enemyFx && G.assets.enemyFx[e.type];
    rocks.push({ e: e, s: s, x0: e.x + e.dir * s.spawn.x, y0: e.y, h0: -s.spawn.y, tx: tx, ty: ty, t: 0, dir: e.dir,
                 art: F && F[s.proj || 'boulder'], burst: F && (s.burstArt !== undefined ? F[s.burstArt] : F.rockburst) });
  }
  function rockPos(r) {
    var u = Math.min(1, r.t / r.s.flightMs);
    return { u: u, x: r.x0 + (r.tx - r.x0) * u, gy: r.y0 + (r.ty - r.y0) * u, z: r.h0 * (1 - u) + 4 * r.s.arcPeak * u * (1 - u) };
  }
  // 바위 터짐 그림(골렘 내려찍기 주먹 자리 / 바위 떨어진 자리) + 돌 조각
  function rockBurst(e, x, y, scale) {
    var F = G.assets.enemyFx && G.assets.enemyFx[e.type], B = F && F.rockburst;
    if (B && B.frames.length) FX.sprite(x, y, B.frames, B.fps, B.pivot, false, false, scale || 1);
    if (Skills.debris) Skills.debris(x, y - 6 * AS, y, Math.round(8 * (scale || 1)), { cols: ['#6a6458', '#8a826e', '#4a463e', '#6f8a4a'], sp: 150, size: 2.2, ms: 600 });
  }
  function rocksStep(dt) {
    var p = G.player, S = G.stage;
    for (var i = rocks.length - 1; i >= 0; i--) {
      var r = rocks[i];
      r.t += dt;
      if (r.t < r.s.flightMs) continue;
      rocks.splice(i, 1);
      if (r.s.puddle) splat(r); else rockBurst(r.e, r.tx, r.ty, 1);
      FX.shake(J.shakePx * r.s.shake, J.shakeMs * 1.6);
      // 맞음: 가로 radius · 위아래 depth 안 + 높이 뛰어 있지 않음(dodgeZ). 보스가 쓰러진 뒤 떨어진 바위는 안 아픔
      if (S.bossDownT < 0 && p.state !== 'dead' && Math.abs(p.x - r.tx) <= r.s.radius && Math.abs(p.y - r.ty) <= r.s.depth && (p.z || 0) <= r.s.dodgeZ)
        onPlayerHit({ x: r.tx, dmgMul: r.e.dmgMul, T: r.e.T }, r.s);
    }
  }
  // ---------- 독 웅덩이 (3단계 두꺼비 spit): 독 덩어리가 떨어진 자리에 ms 동안 남음 → 그 안에 서 있으면 독(poisonStep 이 깎음) ----------
  // { e, s: 공격 수치, P: s.puddle, x, y, t, art: puddle 그림 }. 그림 1~2장 = 철퍽(한 번), 3~6장 = 부글부글(반복), 마지막 0.6초는 흐려짐
  var puddles = [];
  function splat(r) {
    var F = G.assets.enemyFx && G.assets.enemyFx[r.e.type];
    puddles.push({ e: r.e, s: r.s, P: r.s.puddle, x: r.tx, y: r.ty, t: 0, art: F && F.puddle });
    if (Skills.debris) Skills.debris(r.tx, r.ty - 6 * AS, r.ty, 9, { cols: r.s.burstCols || ['#c8e83a', '#8ab82a'], glow: true, sp: 130, size: 1.8, ms: 520 });
  }
  function puddlesStep(dt) {
    var p = G.player, S = G.stage;
    for (var i = puddles.length - 1; i >= 0; i--) {
      var q = puddles[i], P = q.P;
      q.t += dt;
      if (q.t >= P.ms) { puddles.splice(i, 1); continue; }
      // 서 있음(높이 뛰면 안 닿음): 독을 걸거나(처음 깎기까지 firstMs) 이미 걸려 있으면 나와도 stayMs 동안 남게 늘림
      if (S.bossDownT >= 0 || p.state === 'dead' || (p.z || 0) > 4) continue;
      if (Math.abs(p.x - q.x) > P.radius || Math.abs(p.y - q.y) > P.depth) continue;
      if (!p.poison) p.poison = { t: P.stayMs, tick: P.firstMs, every: P.everyMs, dmg: P.dmg };
      else p.poison.t = Math.max(p.poison.t, P.stayMs);
    }
  }
  function drawPuddles(camX) {
    puddles.forEach(function (q) {
      var A = q.art, x = snap(q.x - camX), y = snap(q.y), left = q.P.ms - q.t;
      var a = Math.min(1, left / 600);
      if (!A || !A.frames.length) {   // 그림이 없으면 초록 타원
        ctx.save(); ctx.globalAlpha = 0.6 * a; ctx.fillStyle = '#8ab82a';
        ctx.beginPath(); ctx.ellipse(x, y, q.P.radius, q.P.depth, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); return;
      }
      var k = Math.floor(q.t * A.fps / 1000), n = A.frames.length;
      var idx = k < 2 || n < 3 ? Math.min(k, n - 1) : 2 + (k - 2) % (n - 2);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y);
      Assets.blit(ctx, A.frames[idx], A.pivot.x, A.pivot.y); ctx.restore();
    });
  }

  // 바닥: 떨어질 자리 빨간 원 + 바위 그림자 / 공중: 돌며 날아가는 바위
  function drawRocksUnder(camX) {
    rocks.forEach(function (r) {
      var q = rockPos(r);
      Enemy.drawRing(ctx, camX, r.tx, r.ty, r.s.radius, Math.max(r.s.depth, r.s.radius * 0.34), q.u, false);
      window.drawShadow(ctx, snap(q.x - camX), snap(q.gy), 12 * AS * (0.7 + 0.3 * q.u));
    });
  }
  function drawRocks(camX) {
    rocks.forEach(function (r) {
      var q = rockPos(r), A = r.art, x = snap(q.x - camX), y = snap(q.gy - q.z);
      if (!A || !A.frames.length) { ctx.fillStyle = '#6a6458'; ctx.fillRect(x - 8, y - 8, 16, 16); return; }
      var im = A.frames[Math.floor(r.t * A.fps / 1000) % A.frames.length];
      ctx.save(); ctx.translate(x, y); if (r.dir > 0) ctx.scale(-1, 1);   // 그림은 왼쪽으로 돌며 날아감 → 오른쪽으로 던지면 뒤집기
      Assets.blit(ctx, im, A.pivot.x, A.pivot.y); ctx.restore();
    });
  }

  // ---------- 소품 (판의 props: 상자·통·모닥불 + 음식) = props.js. 그림이 없는 종류는 ?debug=1 에서만 자리 표시 ----------
  Props.init(CFG, {
    laneY: laneY,
    fx: function () { return G.assets && G.assets.fx; },
    hitstop: function (ms) { G.hitstop = Math.max(G.hitstop, ms); }
  });

  function onBossDown(boss) {
    var S = G.stage;
    S.bossDownT = 0;
    S.queue = [];                      // 아직 안 나온 졸개는 취소
    puddles.forEach(function (q) { q.t = Math.max(q.t, q.P.ms - 600); });   // 독 웅덩이는 곧 사라짐
    G.hitstop = Math.max(G.hitstop, 260);
    G.slowT = 1400;                    // 보스 쓰러질 때 슬로모션
    FX.shake(J.shakePx * 3, 500);
    // 남은 졸개들도 같이 쓰러짐
    G.enemies.forEach(function (e) { if (e !== boss && e.alive()) e.takeHit(9999, e.x > boss.x ? 1 : -1, 10, true, { force: true }); });
  }

  // 이름 뒤 「이/가」: 마지막 글자에 받침이 있으면 a, 없으면 b (거대 두꺼비가 / 전갈 왕이)
  function josa(name, a, b) {
    var c = name.charCodeAt(name.length - 1);
    return name + (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 === 0 ? b : a);
  }

  function stageStep(dt) {
    var S = G.stage, p = G.player, waves = CFG.stage.waves;
    if (!S.result) S.time += dt;
    placedStep();
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
        if (S.queue[i].at <= S.waveT) { spawnEnemy(S.queue[i].type, S.queue[i].side, S.queue[i].opt); S.queue.splice(i, 1); }
      }
      // 보스 화남: 체력 절반 아래 → 빨라지고 졸개를 부름
      var B = S.boss;
      if (B && B.alive() && !B.enraged && B.hp / B.maxHp < B.T.enrageAt) {
        B.enraged = true;
        banner(josa(B.label || '오크 족장', '이', '가') + ' 화났다!', 'boss');
        (B.T.enrage.summon || []).forEach(function (t, k) {
          S.queue.push({ type: t, side: k % 2 ? 'L' : 'R', at: S.waveT + 400 + k * 700 });
        });
      }
      // 다 잡으면 다음으로
      var left = G.enemies.some(function (e) { return e.alive(); });
      if (!S.queue.length && !left) {
        var w = waves[S.waveIdx];
        S.locked = false; S.next++;
        preparePlaced(S.next);
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
    //   점프로 overBodyZ 넘게 뜨면 적 몸 위로 넘어감(밀어내기에서 뺌). 달리며 공격으로 밀고 가는 중이면 잡몹을 앞으로 밀어냄(주인공은 안 밀림)
    var overZ = (CFG.move && CFG.move.jump.overBodyZ) || 10;
    var pushing = p.state === 'runatk' && p.ratk && p.ratk.phase !== 'recover';
    if (p.state !== 'dead' && !(p.state === 'skill' && Skills.passThrough(p)) && !((p.z || 0) > overZ)) list.push({ o: p, r: CFG.hero.radius, m: 1, hero: true });
    G.enemies.forEach(function (e) {
      if (!e.alive() || e.state === 'down' || e.hidden || e.airborne()) return;   // 넘어진 적은 밟고 지나갈 수 있음, 땅속(전갈 왕)·공중(두꺼비 배치기)도 지나감
      var charging = e.state === 'attack' && e.atk && e.atk.spec.type === 'charge';
      list.push({ o: e, r: e.T.radius, m: charging ? 0 : (e.T.boss ? 0.08 : 1), boss: !!e.T.boss });
    });
    for (var i = 0; i < list.length; i++) for (var j = i + 1; j < list.length; j++) {
      var a = list[i], b = list[j];
      if (Math.abs(a.o.y - b.o.y) >= AI.sepDepth) continue;
      var dx = b.o.x - a.o.x, min = a.r + b.r;
      if (Math.abs(dx) >= min) continue;
      var s = dx > 0 ? 1 : dx < 0 ? -1 : (a.o.dir || 1);
      var am = a.m, bm = b.m;
      if (pushing && a.hero && !b.boss) am = 0;
      var ov = min - Math.abs(dx), tm = am + bm;
      if (tm <= 0) continue;
      a.o.x -= s * ov * am / tm;
      b.o.x += s * ov * bm / tm;
    }
  }

  // 막는 소품(상자·통) 밖으로 밀어내기: 플레이어(쓰러졌으면 빼고) + 살아 있는 적
  function propCollide() {
    var p = G.player, list = [];
    if (p.state !== 'dead') list.push({ o: p, r: CFG.hero.radius });
    G.enemies.forEach(function (e) { if (e.alive() && !e.T.flying && !e.hidden && !e.airborne()) list.push({ o: e, r: e.T.radius }); });   // 나는 적(박쥐)·뛰어오른 두꺼비는 소품 위로, 땅속(전갈 왕)은 밑으로 지나감
    Props.collide(list, world);
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
    var ax = { x: 0, y: 0 }, R = CFG.hero.radius;
    if (!best) {   // 적이 없으면 오른쪽으로(막는 소품은 돌아감)
      if (!G.stage.locked) { ax.x = 1; var gy = Props.steer(p, R, p.x + 80, p.y, world).y - p.y; if (Math.abs(gy) > 2) ax.y = Math.sign(gy); }
      Input.setOverride(ax); return;
    }
    var side = best.x > p.x ? 1 : -1;
    var want = ({ goblin: 42, wolf: 58, orc: 72, bat: 46, skeleton: 44, golem: 76, mummy: 46, scorpion: 80, lizard: 46, toad: 74 }[best.type] || 50) * AS;
    var sv = Props.steer(p, R, best.x - side * want, best.y, world, best.x);   // 막는 소품: 목표가 그 안이면 옆으로, 앞에 있으면 돌아감
    var tx = sv.x, ty = best.y;
    var ex = tx - p.x, ey = ty - p.y, my = sv.y - p.y;   // 공격 조건은 원래 줄(ey), 움직임은 돌아가는 줄(my)
    if (Math.abs(ex) > 6) ax.x = Math.sign(ex);
    if (Math.abs(my) > 3) ax.y = Math.sign(my);
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

  // ---------- 달리기·점프 효과 (2026-11-03) ----------
  function dustAt(x, y, dir, scale) {
    if (G.assets.dust && G.assets.dust.length) FX.sprite(x, y, G.assets.dust, CFG.dust.fps * 1.3, CFG.dust.pivot, dir > 0, true, scale);
  }
  // kind = 'jump'(공중 공격: 아래로 휘두르는 바람) / 'slide' · 'shoulder_charge'(달리며 공격 마무리: 발밑 먼지)
  function moveSwingFx(p, kind) {
    var fxs = G.assets.fx && G.assets.fx.slash && G.assets.fx.slash.length ? G.assets.fx.slash : null;
    if (kind === 'jump') {
      var W = CFG.weapons[p.weaponKey], a = { from: -60, to: 80, r: 40 * AS, w: 7 * AS };
      if (fxs) FX.slash(p.x + p.dir * 30 * AS, p.y - p.z - 46 * AS, p.dir, a, W.arcColor, J.slashMs * 1.2, fxs,
                        { rot: 35, sx: 0.85, sy: 0.85, alpha: p.weaponKey === 'fist' ? 0.45 : null });
      return;
    }
    dustAt(p.x + p.dir * 20 * AS, p.y, -p.dir, 0.55);
  }
  function landFx(p) { dustAt(p.x, p.y, p.dir, 0.4); }

  // ---------- 갱신 ----------
  function step(realMs) {
    if (G.paused) return;   // 스테이지 고르기 화면: 멈춤
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
      var hc = ev.hitCheck, hb = p.hitbox(), done = hc.done, anyHit = false, RA = p.ratk;
      var targets = hitTargets();
      targets.forEach(function (t) {
        var id = t.id || 'dummy';
        if (done[id] || (t.canBeHit && !t.canBeHit())) return;   // 죽었거나 넘어져 있으면(무적) 안 맞음
        // 달리며 공격 마무리: 밀고 온 적은 상자 밖으로 조금 벗어나 있어도 맞음
        var carried = hc.finish && RA && RA.ids[id] && Math.abs(t.x - p.x) < 100 * AS && Math.abs(t.y - p.y) < 16 * AS;
        if (overlap(hb, t.hurtbox()) || carried) {   // 판정 구간마다 대상별 한 번
          done[id] = true;
          if (!t.isProp) { anyHit = true; if (hc.push && RA) RA.ids[id] = true; }   // 소품은 밀고 가지 않음(닿음으로도 안 셈)
          onHit(hc.step, t);
        }
      });
      // 밀고 가는 타: 이번에 닿았는지(닿았던 적이 떨어지면 일찍 마무리)
      if (hc.push && RA) { RA.contact = anyHit; if (anyHit) RA.had = true; }
    }
    // 달리며 공격으로 밀고 가는 중: 맞은 적을 주인공과 같이 앞으로(보스는 조금만)
    if (ev.push && p.ratk && MODE === 'stage') {
      var RC = CFG.move.runAttack;
      G.enemies.forEach(function (e) {
        if (!p.ratk.ids[e.id] || !e.alive() || e.state === 'down' || Math.abs(e.y - p.y) > 16 * AS) return;
        var ahead = (e.x - p.x) * p.dir;
        if (ahead < -4 * AS) return;
        if (e.T.boss) { e.x += ev.push.dx * (RC.bossPush || 0.25); return; }
        e.x += ev.push.dx;
        var gap = (CFG.hero.radius + e.T.radius) * 0.75;
        if ((e.x - p.x) * p.dir < gap) e.x = p.x + p.dir * gap;   // 늘 주인공 앞에 붙어서 밀려감
      });
    }
    if (ev.moveSwing) moveSwingFx(p, ev.moveSwing.kind);
    if (ev.land) landFx(p);
    // 날아가는 마법탄: 처음 맞은 대상(또는 끝까지 날아간 곳)에서 터짐
    Projectiles.update(dt, hitTargets(), function (pr, t) { explode(pr.x, pr.y, pr.z, pr.st, pr.dir, pr.wk, t); });
    if (MODE === 'stage') {
      var E = G.ectx;
      E.now += dt; E.view.x0 = G.camX; E.view.x1 = G.camX + LW - (controlPad ? controlPad + 14 : 0);   // 적은 몸이 넓어서 버튼 쪽으로 조금 더 띄움
      G.enemies.forEach(function (e) { e.update(dt, E); });
      separate();
      propCollide();
      heldStep();            // 미라에게 붙잡힘: 잡은 적 앞에 붙여 둠
      p.clamp(world);
      G.enemies.forEach(function (e) { if (e.alive()) e.keepInView(E); });
      G.enemies = G.enemies.filter(function (e) { return !e.remove; });
      E.enemies = G.enemies;
      rocksStep(dt);         // 골렘이 던진 바위 · 두꺼비가 뱉은 독 덩어리
      puddlesStep(dt);       // 두꺼비 독 웅덩이
      poisonStep(dt);        // 전갈 왕 독 · 독 웅덩이
      stageStep(dt);
      Props.update(dt, p);   // 부서지는 그림·음식 줍기
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
    if (puddles.length) drawPuddles(camX);        // 두꺼비 독 웅덩이(바닥)
    if (rocks.length) drawRocksUnder(camX);       // 바위 떨어질 자리 빨간 원 + 그림자
    FX.draw(ctx, camX, true);
    if (MODE === 'stage') Props.drawUnder(ctx, camX, LW);   // 소품 그림자·모닥불 빛
    Skills.drawUnder(ctx, camX, G.player);        // 번개 떨어질 자리 표시
    // 깊이 순서(아래쪽 = 앞쪽)
    var ents = [{ y: G.player.y, d: function () { Skills.drawGhosts(ctx, camX); G.player.draw(ctx, camX, G.assets.weapons, DEBUG); } }];
    if (G.dummy) ents.push({ y: G.dummy.y, d: function () { G.dummy.draw(ctx, camX, DEBUG); } });
    G.enemies.forEach(function (e) { ents.push({ y: e.y + (e.alive() ? 0 : -0.5), d: function () { e.draw(ctx, camX, DEBUG); } }); });
    if (MODE === 'stage') Props.addDraw(ents, ctx, camX, LW, DEBUG);
    ents.sort(function (a, b) { return a.y - b.y; });
    ents.forEach(function (e) { e.d(); });
    Projectiles.draw(ctx, camX);
    if (rocks.length) drawRocks(camX);            // 날아가는 바위(공중이라 캐릭터 위)
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
    var active = p.activeWindow() >= 0 || p.moveActive();   // 달리며 공격·공중 공격 판정도(빨강)
    if (p.state !== 'skill') rectStroke(p.hitbox(), camX, active ? '#f33' : 'rgba(255,80,80,0.35)');
    if (p.z > 0.5) {   // 점프: 땅(그림자)에서 발까지 노란 줄
      ctx.fillStyle = 'rgba(255,230,60,0.8)';
      ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - p.z), 1, Math.round(p.z));
    }
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
    if (B) setIf('bname', B.label, function (v) { hud.bossName.textContent = v; });
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
  // 클리어: 다음 판 열림(저장) + 「다음 스테이지 →」. 마지막 판이면 ALL CLEAR. 게임 오버: 같은 판 다시 하기
  function showResult(kind) {
    var S = G.stage, p = G.player;
    S.result = kind;
    Input.setOverride(null);
    var last = G.stageNo >= STAGES.length, clear = kind === 'clear';
    if (clear) saveCleared(G.stageNo);
    document.getElementById('resTitle').textContent = !clear ? 'GAME OVER' : last ? 'ALL CLEAR!' : 'STAGE CLEAR!';
    resultEl.className = 'result ' + kind + (clear && last ? ' all' : '');
    document.getElementById('resStats').innerHTML =
      (clear && last ? '모든 스테이지를 깼다!<br>' : '') +
      '시간 <b>' + fmtTime(S.time) + '</b> · 맞힌 수 <b>' + G.hits + '</b> · 최대 콤보 <b>' + G.maxCombo + '</b>' +
      (clear ? ' · 남은 체력 <b>' + p.hp + '</b>' : '');
    var nx = document.getElementById('btnNext');
    nx.hidden = !(clear && !last);
    openMenu(resultEl, clear && !last ? nx : clear ? document.getElementById('btnSel') : document.getElementById('btnRetry'));
  }
  // 판 바꾸기: 그 판 배경·소품·적 그림을 (필요하면) 불러온 뒤 처음부터. 플레이어 직업·성별·옷은 그대로, 체력은 가득
  function useStage(n) {
    G.stageNo = n;
    CFG.stage = STAGES[n - 1]; CFG.bg = CFG.stage.bg;
    sky = null;
    applyStageWorld();
    bgCache = null;
    controlPad = measureControlPad();
  }
  function goStage(n) {
    n = clamp(n, 1, STAGES.length);
    var st = STAGES[n - 1];
    loading(true);
    return Promise.all([Assets.ensureBg(st.bg), Props.load(st), Assets.ensureEnemies(stageEnemies(st))]).then(function (r) {
      loading(false);
      G.assets.bg = r[0];
      useStage(n);
      resetStage();
    });
  }
  function resetStage(quiet) {
    resultEl.hidden = true;
    FX.list.length = 0;
    Projectiles.clear();
    Skills.clear();
    rocks.length = 0; puddles.length = 0;
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
    bakeStageVariants();
    Props.reset(CFG.stage);
    preparePlaced(0);
    if (!quiet) banner(CFG.stage.name, 'title');
  }

  // ---------- 고르기 화면 · 결과 화면 공통: 키보드(←→↑↓ / WASD 고르기, Enter·Space·J·Z 누르기) + 터치/마우스 ----------
  // 열린 판(menu)이 있으면 게임 조작 키는 판에 안 넘김. 열자마자 공격 연타가 버튼을 누르지 않게 잠깐(400ms) 무시
  var menuEl = null, menuOpenAt = 0;
  function openMenu(el, focusBtn) {
    menuEl = el; menuOpenAt = performance.now();
    el.hidden = false;
    if (focusBtn) try { focusBtn.focus({ preventScroll: true }); } catch (e) { focusBtn.focus(); }
  }
  function closeMenu(el) { el.hidden = true; if (menuEl === el) menuEl = null; }
  function menuButtons() { return Array.prototype.slice.call(menuEl.querySelectorAll('button:not([hidden]):not([disabled]), a[href]')); }
  window.addEventListener('keydown', function (e) {
    if (!menuEl || menuEl.hidden) return;
    var K = CFG.keys, c = e.code, btns = menuButtons();
    var prev = K.left.concat(K.up).indexOf(c) >= 0, next = K.right.concat(K.down).indexOf(c) >= 0;
    var push = c === 'Enter' || c === 'NumpadEnter' || c === 'Space' || K.attack.indexOf(c) >= 0;
    if (!prev && !next && !push) return;
    e.preventDefault(); e.stopPropagation();   // 게임 조작(input.js)으로 안 넘김
    if (!btns.length || e.repeat) return;
    var i = btns.indexOf(document.activeElement);
    if (prev || next) { i = i < 0 ? 0 : (i + (next ? 1 : -1) + btns.length) % btns.length; btns[i].focus(); return; }
    if (performance.now() - menuOpenAt < 400) return;
    (i >= 0 ? btns[i] : btns[0]).click();
  }, true);

  // 스테이지 고르기 화면: 열린 판만 누를 수 있음(잠긴 판 = 회색). 고르는 동안 게임은 멈춤
  var selEl = document.getElementById('stageSel');
  function openStageSelect() {
    var list = document.getElementById('stageList'), max = unlockedMax(), cleared = loadCleared(), focus = null;
    list.innerHTML = '';
    STAGES.forEach(function (st, i) {
      var n = i + 1, b = document.createElement('button'), open = n <= max;
      b.type = 'button'; b.className = 'sbtn' + (open ? '' : ' locked') + (n <= cleared ? ' cleared' : '');
      b.disabled = !open;
      b.innerHTML = '<b>' + n + '</b><span>' + (open ? st.name.replace(/^STAGE\s*\d+\s*/, '') : '잠김') + '</span>' + (n <= cleared ? '<i>클리어</i>' : '');
      b.addEventListener('click', function () { closeMenu(selEl); G.paused = false; goStage(n); });
      list.appendChild(b);
      if (open && (n === G.stageNo || !focus)) focus = b;
    });
    closeMenu(resultEl);
    G.paused = true;
    Input.setOverride(null);
    openMenu(selEl, focus);
  }
  function makeEnemyCtx() {
    var E = {
      player: null, now: 0, enemies: G.enemies, view: { x0: 0, x1: LW }, world: world,
      onPlayerHit: onPlayerHit,
      steer: function (e, tx, ty) { return Props.steer(e, e.T.radius, tx, ty, world, G.player.x); },   // 막는 소품 돌아가기
      dust: function (x, y, dir) { if (G.assets.dust && G.assets.dust.length) FX.sprite(x, y, G.assets.dust, CFG.dust.fps, CFG.dust.pivot, dir > 0, true); },
      shake: function (m) { FX.shake(J.shakePx * m, J.shakeMs * 1.6); },
      throwRock: throwRock,   // 골렘 바위 던지기
      burst: rockBurst,       // 골렘 내려찍기 땅 터짐
      debris: function (x, y, n, cols) { if (Skills.debris) Skills.debris(x, y - 6 * AS, y, n, { cols: cols, sp: 150, size: 2.2, ms: 600 }); },   // 두꺼비 배치기 흙탕물
      grabPlayer: grabPlayer, grabMash: grabMash, releaseGrab: releaseGrab   // 미라 잡기
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
      S.locked = false; S.queue = []; S.placedQ = []; S.next = waves.length - 1;
      var at = waveAt(waves[S.next]);
      S.camMin = at - 40; G.camX = at - 40;
      G.player.x = at - 40 + LW * 0.42 - 4;
    },
    // 그 웨이브 바로 앞으로(앞 웨이브는 건너뜀, 미리 서 있는 적은 그 웨이브 것만): GAME.test.toWave(2) = 3번 웨이브
    toWave: function (i) {
      var S = G.stage, waves = CFG.stage.waves;
      G.enemies = []; G.ectx.enemies = G.enemies;
      S.locked = false; S.queue = []; S.next = i; preparePlaced(i);
      var at = waveAt(waves[i]);
      S.camMin = at - 60; G.camX = at - 60;
      G.player.x = at - 60 + LW * 0.42 - 4;
    },
    // 기술 바로 쓰기(쿨타임 무시): GAME.test.skill('A')
    skill: function (slot, noCd) { if (noCd) G.player.skillCd = {}; Input.pressSkill(slot || 'A'); },
    resetCd: function () { G.player.skillCd = {}; },
    hurt: function (n, heavy) { var p = G.player; p.invulnT = 0; p.takeHit(n || 10, -p.dir, 10, 0, !!heavy); },
    god: function (on) { G.player.god = on !== false; },
    bot: function (on) { G.bot = on !== false; if (!G.bot) Input.setOverride(null); },
    retry: function () { resetStage(); },
    // 판 바로 가기: GAME.test.stage(2) / 고르기 화면 열기: GAME.test.select()
    stage: function (n) { return goStage(n); },
    select: function () { openStageSelect(); },
    info: function () {
      var S = G.stage, p = G.player;
      return { mode: MODE, stageNo: G.stageNo, paused: G.paused, LW: LW, LH: LH, scale: SCALE, rs: RS, hd: Assets.isHD(),
 controlPad: controlPad, char: G.player.char && G.player.char.def.anims.idle.frames[0], camX: Math.round(G.camX), wave: S ? S.next : null, locked: S ? S.locked : null,
        waveIdx: S ? S.waveIdx : null, time: S ? Math.round(S.time) : null, result: S ? S.result : null,
        player: { hp: p.hp, state: p.state, x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z * 10) / 10,
          frame: p.char ? p.currentFrame() : null, ratk: p.ratk ? p.ratk.phase : null, skill: p.sk ? p.sk.d.key + '@' + Math.round(p.sk.t) : null, cd: p.skillCd },
        enemies: G.enemies.map(function (e) { return e.type + (e.variant ? '(' + e.variant + ')' : '') + ':' + (e.asleep ? 'asleep' : e.alertT > 0 ? 'alert' : e.state) +
          (e.atk && e.atk.spec.type === 'burrow' ? '/' + e.atk.phase : '') + (e.atk && e.atk.held ? '/hold' : '') + (e.atk ? '/' + e.atk.name : '') + (e.airborne() ? '/air' : '') + ':' + e.hp + '@' + Math.round(e.x) + ',' + Math.round(e.y); }),
        poison: p.poison ? Math.round(p.poison.t) : 0,
        hits: G.hits, maxCombo: G.maxCombo, rocks: rocks.length, puddles: puddles.length,
        props: Props.list.map(function (pr) { return pr.type + ':' + (pr.state === 'idle' ? pr.hitsLeft : pr.state) + '@' + Math.round(pr.x) + ',' + Math.round(pr.y); }),
        food: Props.food.map(function (f) { return f.kind + '@' + Math.round(f.x) + ',' + Math.round(f.y); }) };
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

  // 연습장 ↔ 스테이지 판 이동 버튼 (?debug=1 같은 다른 옵션은 그대로 둠)
  function modeLink() {
    var a = document.getElementById('modeBtn'); if (!a) return;
    var q = new URLSearchParams(location.search);
    if (MODE === 'stage') { q.set('mode', 'practice'); a.textContent = '연습장'; }
    else { q.delete('mode'); a.textContent = '스테이지'; }
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
  // 적 그림은 지금 판에 나오는 것만(다른 판 적은 그 판을 고를 때 goStage 가). 연습장은 적 없음
  Assets.loadAll(CFG, firstChars, MODE === 'stage' ? stageEnemies(CFG.stage) : []).then(function (assets) {
    G.assets = assets;
    return MODE === 'stage' ? Props.load(CFG.stage).then(function () { return assets; }) : assets;
  }).then(function (assets) {
    // 기술(skills.js)이 쓰는 도구: 맞히기·대상 목록·먼지·효과 그림·멈춤·슬로모션
    Skills.init(CFG, {
      onHit: onHit,
      targets: hitTargets,   // 적 + 부서지는 소품(번개 겨누기에서는 소품을 뺌)
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
      // 처음: 고르기 화면(뒤에 그 판이 멈춰 보임). ?stage=N 이나 ?bot=1 이면 바로 시작
      var pick = !urlStage && !G.bot;
      resetStage(pick);
      document.getElementById('btnRetry').addEventListener('click', function () { closeMenu(resultEl); resetStage(); this.blur(); });
      document.getElementById('btnNext').addEventListener('click', function () { closeMenu(resultEl); goStage(G.stageNo + 1); this.blur(); });
      document.getElementById('btnSel').addEventListener('click', function () { openStageSelect(); this.blur(); });
      if (params.get('god') === '1') G.player.god = true;
      if (pick) openStageSelect();
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
