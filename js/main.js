// 게임 본체: 화면 크기, 배경, 매 장면 갱신, 타격 처리
// 기본 = 스테이지 판(웨이브 + 보스, 여러 판). 주소 뒤 ?mode=practice = 예전 허수아비 연습장
// 주소 뒤 ?stage=N = 판 번호(config stages 의 id) N 인 판으로 바로 시작(시험용, 잠금 무시). ?bot=1 이면 고르기 화면 없이 바로 시작
//   (2026-11-04: 목록 = 1 2 3 4 5 6 7 8 9 10. ?stage=5 = 눈 덮인 산, ?stage=6 = 해적 항구, ?stage=7 = 화산, ?stage=8 = 유령 고성, ?stage=9 = 마왕군 요새,
//    ?stage=10 = 마왕성(마지막 판, 마왕을 쓰러뜨리면 엔딩). 없는 번호면 무시)
(function () {
  var CFG = window.CFG, J = CFG.juice;
  var AS = CFG.actorScale || 1;   // 캐릭터 크기: 코드에 바로 적힌 거리·높이와 손맛의 밀림 거리(juice.knockback)에 곱한다
  var params = new URLSearchParams(location.search);
  var DEBUG = params.get('debug') === '1';
  var MODE = params.get('mode') === 'practice' ? 'practice' : 'stage';
  if (params.get('slow')) J.timeScale = +params.get('slow') || 1;

  // ---------- 스테이지 고르기 (2026-11-04) ----------
  // 판이 열리는 조건 = 목록에서 바로 앞 판을 깸(첫 판은 늘 열림). 깬 판은 이 브라우저에 저장(localStorage). 저장이 막혀 있어도 게임은 됨(이번에 연 동안만 기억)
  //   코드 안의 판 번호(G.stageNo, urlStage) = 목록 순서(1부터). 화면에 보이는 번호·주소 ?stage= = 판 id(config stages)
  //   저장 = 깬 판 「id」 목록(2026-11-04 7단계 때 바꿈): 예전처럼 목록 순서로 저장하면 5단계를 6 앞에 끼울 때 예전 저장이 한 칸씩 어긋남
  var STAGES = CFG.stages;
  function stageIndexOfId(id) { for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return i + 1; return 0; }
  var urlStage = stageIndexOfId(parseInt(params.get('stage'), 10));
  var SAVE_IDS = 'pixelBrawler.clearedIds';   // 지금 저장: 깬 판 id 목록 JSON, 예: [1,2,3,4,6]
  var SAVE_OLD = 'pixelBrawler.cleared';      // 예전 저장: 깬 판 「수」 N(목록 순서 앞에서 N개를 깸) → 처음 한 번 id 목록으로 옮김
  var OLD_ORDER = [1, 2, 3, 4, 6];            // 예전 저장을 쓰던 때(7단계 전)의 판 목록 순서(id). 예전 값 N = 이 목록 앞 N개
  var clearedMem = {};                        // 저장이 막혀 있을 때도 이번에 깬 판은 기억
  function loadCleared() {
    var out = {}, k;
    try {
      var raw = localStorage.getItem(SAVE_IDS);
      if (raw) JSON.parse(raw).forEach(function (id) { if (typeof id === 'number') out[id] = true; });
      else {
        var n = parseInt(localStorage.getItem(SAVE_OLD), 10) || 0;
        if (n > 0) {
          OLD_ORDER.slice(0, n).forEach(function (id) { out[id] = true; });
          localStorage.setItem(SAVE_IDS, JSON.stringify(Object.keys(out).map(Number)));   // 옮긴 결과를 새 이름으로 저장(예전 값은 그대로 둠)
        }
      }
    } catch (e) {}
    for (k in clearedMem) out[k] = true;
    return out;
  }
  function isCleared(id) { return !!loadCleared()[id]; }
  function saveCleared(id) {
    clearedMem[id] = true;
    try {
      var c = loadCleared(); c[id] = true;
      localStorage.setItem(SAVE_IDS, JSON.stringify(Object.keys(c).map(Number).sort(function (a, b) { return a - b; })));
    } catch (e) {}
  }
  // 목록 n 번째(1부터) 판이 열렸나: 시험(?stage=N)·다 열어 둔 기간이면 다, 아니면 첫 판 + 바로 앞 판을 깬 판 + 이미 깬 판
  //   (이미 깬 판: 5단계를 6 앞에 끼우기 전에 6을 깬 저장 → 5를 아직 안 깼어도 6은 그대로 열려 있음)
  function isOpen(n) { return !!urlStage || !!CFG.stagesAllOpen || n <= 1 || isCleared(STAGES[n - 2].id) || isCleared(STAGES[n - 1].id); }
  // 아직 안 깬 첫 판(목록 순서). 다 깼으면 마지막 판
  function firstUncleared() { var c = loadCleared(); for (var i = 0; i < STAGES.length; i++) if (!c[STAGES[i].id]) return i + 1; return STAGES.length; }
  // 처음 판: ?stage=N, 아니면 아직 안 깬 첫 판(앞 판을 다 깼으니 열려 있음, 고르기 화면 뒤에 미리 보임)
  var startNo = urlStage || firstUncleared();
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

  // 공격·점프 버튼이 덮는 게임 화면 오른쪽 폭(도트). 버튼이 안 보이거나 걷는 길과 안 겹치면 0
  //   2026-11-06 밤 버그 고침(웨이브 2부터 오른쪽 안 보이는 벽): 기술 버튼(공격 버튼 위 부채꼴)은 걷는 길보다 높아서 빼고,
  //   걷는 길 띠도 발 높이 + 몸 조금(30)만 봄(예전 100 = 키 큰 몸 → 위쪽 버튼까지 벽이 넓어졌음). 플레이어·적 모두 이 선 안에서만 움직임
  function measureControlPad() {
    var c = canvas.getBoundingClientRect();
    if (!c.width || !c.height) return 0;
    var ky = c.height / LH;
    var laneT = c.top + world.laneTop * ky - 30 * AS * ky, laneB = c.top + world.laneBottom * ky;    // 발 띠 + 몸 조금
    var pad = 0;
    ['btnAtk', 'btnJump'].forEach(function (id) {
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
    // 레벨·능력치 공격력(성장, Growth.atkMul): 적·허수아비를 때리는 모든 타·기술에 곱함(소품은 그대로)
    //   2026-11-06: 레벨 몫 + 힘(물리: 맨손·검) 또는 지능(마법: 지팡이·완드로 나간 타·마법탄·터짐·화염구·번개 = 무기 magic)
    //   2026-11-06 성장 4단계: × 기술 Lv 배율(src.mul, 기술만) × 늘 켜진 기술(검 숙련 = 물리 / 원소 증폭 = 마법, 지금 입은 직업의 기술 책)
    var bk = Growth.book(G.classKey), pas = bk ? bk.bonus(W.magic ? 'magic' : 'phys') : 0;
    var dmg = Math.round(rand(W.damage[0], W.damage[1]) * st.dmg * (target.isProp ? 1 : Growth.atkMul(!!W.magic) * (1 + pas) * ((src && src.mul) || 1)));
    // 치명타(민첩, 2026-11-06): 적·허수아비를 때릴 때 확률 Growth.critChance() → 데미지 x critMul + 큰 주황 숫자(agicrit). GAME.test.crit 로 시험 고정
    var crit = !target.isProp && (G.forceCrit != null ? G.forceCrit : Math.random() < Growth.critChance());
    if (crit) dmg = Math.round(dmg * CFG.growth.stats.critMul);
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
    // 손맛(2026-11-06 밤, config juice.impact): 무거운 타(마무리·기술·넘어뜨림·띄우기)는 더 오래 멈추고 더 흔들림
    var IM = J.impact || {}, heavyHit = !!(st.finisher || st.damageStyle || st.knockdown || st.launch);
    G.hitstop = Math.max(G.hitstop, J.hitstopMs * W.hitstopMul * st.hitstop * (heavyHit ? IM.heavyStop || 1 : 1));
    FX.shake(J.shakePx * W.shakeMul * st.shake * (heavyHit ? IM.heavyShake || 1 : IM.lightShake || 1), J.shakeMs * (st.finisher ? 1.5 : 1));
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
      // 누운 적 때리기(OTG, config ai.otg): 땅까지 닿는 공격(hitsDown)만 여기까지 옴 → 데미지 배율, 다시 날아가지 않음
      var otg = target.state === 'down' && !!st.hitsDown;
      if (otg) dmg = Math.max(1, Math.round(dmg * (CFG.ai.otg.dmgMul != null ? CFG.ai.otg.dmgMul : 1)));
      var res = target.takeHit(dmg, dir, knock, !!st.finisher && !st.noKnockdown, { heavy: heavy, stunMs: st.stunMs, noJuggle: !!st.noJuggle, flashK: st.flashK != null ? st.flashK : (heavyHit ? IM.flashHeavy || 1 : 1), otg: otg });   // stunMs = 번개 기술
      if (otg && !res) return;   // 누운 채 맞을 수 있는 때가 아님(일어나는 중 등)
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
    // 누운 적: 불똥은 바닥에 누운 몸 높이에 작게, 숫자는 누운 몸 바로 위
    if (otg) { hy = target.y - 14 * AS; sc = Math.min(sc, 0.8); topY = target.y - target.T.height * 0.45 - 8; }
    // impactFx = 불똥 대신 쓸 그림(법사 = magic_spark)
    var impSpr = G.assets.fx && ((st.impactFx && G.assets.fx[st.impactFx]) || G.assets.fx.impact);
    // big = 기술의 큰 불똥(마무리 타처럼 많이·멀리). damageStyle = 기술 숫자 모양(config damageText)
    var big = !otg && !!(st.finisher || st.big);
    FX.impact(hx, hy, dir, W.sparkColor, Math.round(J.sparkCount * (IM.spark || 1) * (big ? 1.6 : 1) * (sc < 1 ? 0.7 : 1) * (st.damageStyle ? 1.3 : 1)), big, impSpr, sc);
    if (heavyHit && !otg && IM.glow && Skills.glow) Skills.glow(hx, hy, (IM.glowR || 30) * AS * Math.max(0.8, sc), W.sparkColor || '#fff2c8', 170, IM.glow);   // 무거운 타: 맞은 곳 둥근 빛
    // 숫자: crit = 마무리 모양(「22!」), numStyle = 숫자 모양만 따로(달리며 공격 작은 타 = push). 마지막 = 대상(같은 대상 숫자는 위로 쌓임)
    FX.damage(target.x, topY, dmg, crit || !!(st.finisher || st.crit || (st.damageStyle && st.knockdown)), J, null, crit ? 'agicrit' : st.numStyle || st.damageStyle, target.id || 'dummy', !!st.mergeNum && !crit);
    if (crit) G.crits = (G.crits || 0) + 1;
    vibrate(Math.round(J.vibrateMs * (st.finisher ? 2 : 1)));
    G.hits++; G.totalDmg += dmg;
    p.mp = Math.min(p.maxMp, p.mp + CFG.growth.mp.onHit);   // 마나: 맞힐 때마다 조금 참
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
  // 이 공격(st)에 맞을 수 있나: 적은 canBeHitBy(누운 적 = 크게 휘두르는 타(hitsDown)만, config ai.otg), 소품·허수아비는 canBeHit
  function canHit(t, st) { return !t.canBeHit || (t.canBeHitBy ? t.canBeHitBy(st) : t.canBeHit()); }

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
      if (!t || !canHit(t, st)) return;
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
    dmg = guardDmg(dmg);   // 늘 켜진 기술 「강철 피부」(받는 피해 -%)
    var dir = p.x >= e.x ? 1 : -1;
    if (!p.takeHit(dmg, dir, spec.knock, spec.flinchMs, !!spec.heavy)) return false;   // heavy = 넘어짐. 안 맞았으면 false(총알은 그대로 지나감)
    G.hitstop = Math.max(G.hitstop, J.hitstopMs * (e.T.boss ? 1.3 : 0.8));
    FX.shake(J.shakePx * (spec.shake || 1.2), J.shakeMs * 1.3);
    FX.impact(p.x - dir * 4, p.y - 60 * AS, -dir, '#ff6a5a', Math.round(J.sparkCount * 0.8), e.T.boss, null, 0.8);
    FX.damage(p.x, p.y - (p.z || 0) - 112 * AS, dmg, false, J, '#ff5a4a', null, 'player');
    vibrate(Math.round(J.vibrateMs * 2.5));
    G.comboT = 0; comboEl.hidden = true;
    // 독(전갈 왕 독침): 맞으면 잠깐 독 → poisonStep 이 everyMs 마다 체력을 조금씩 깎음(독으로는 안 쓰러짐)
    if (spec.poison) p.poison = { t: spec.poison.ms, tick: spec.poison.everyMs, every: spec.poison.everyMs, dmg: spec.poison.dmg };
    return true;
  }
  // 받는 피해 줄이기(2026-11-06, 늘 켜진 기술 stat 'guard' = 기사 강철 피부): 적 타·불 뿜기에. 1 아래로는 안 줄임
  function guardDmg(n) {
    var bk = Growth.book(G.classKey), g = bk ? bk.bonus('guard') : 0;
    return g > 0 ? Math.max(1, Math.round(n * (1 - g))) : n;
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

  // 불 뿜기에 계속 서 있음(7단계 와이번 breath): 처음 맞은 뒤 깜빡임(무적) 중에도 tickMs 마다 spec.burn 만큼 탐(움찔·밀림 없음).
  //   독처럼 체력 1 아래로는 안 내려감(불길에서 비키면 그만). 넘어짐·잡힘·기술 무적·쓰러짐 중에는 안 탐
  function burnPlayer(e, spec) {
    var p = G.player;
    if (!spec.burn || p.state === 'dead' || p.state === 'down' || p.state === 'held') return;
    if (p.state === 'skill' && Skills.invulnerable(p)) return;
    var n = guardDmg(Math.max(1, Math.round(rand(spec.burn[0], spec.burn[1]) * (e.dmgMul || 1))));
    if (!p.god) { n = Math.min(n, p.hp - 1); if (n <= 0) return; p.hp -= n; }
    FX.damage(p.x, p.y - (p.z || 0) - 112 * AS, n, false, J, '#ffa040', null, 'player');
    if (Skills.debris) Skills.debris(p.x, p.y - 50 * AS, p.y, 4, { cols: ['#fff2a0', '#ffb040', '#ff5a1a'], glow: true, sp: 70, size: 1.3, ms: 360, g: -40, spread: 0.8 });
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
  // 피 빨기(8단계 흡혈 백작 mistBite drain): 붙잡힌 동안 everyMs 마다 플레이어 체력 drain.dmg(판·변종 공격력 배율) → 백작 체력 drain.heal 회복.
  //   독처럼 체력 1 아래로는 안 내려감(놓을 때 내던지는 타는 보통 데미지). 목에서 백작 입으로 붉은 방울
  function drainPlayer(e, spec) {
    var p = G.player, D = spec.drain;
    if (p.state !== 'held' || p.heldBy !== e || !e.alive()) return;
    var n = Math.max(1, Math.round(D.dmg * (e.dmgMul || 1)));
    if (!p.god) n = Math.min(n, p.hp - 1);
    if (n > 0) {
      if (!p.god) p.hp -= n;
      FX.damage(p.x, p.y - (p.z || 0) - 112 * AS, n, false, J, '#ff3a5a', null, 'player');
    }
    var h = Math.min(D.heal || 0, e.maxHp - e.hp);
    if (h > 0) { e.hp += h; FX.damage(e.x, e.y - e.T.height - 8, h, false, J, null, 'heal', e.id + ':heal'); }
    if (Skills.debris) Skills.debris(p.x + (e.x - p.x) * 0.3, p.y - 64 * AS, p.y, 4, { cols: ['#ff3a4a', '#a0101c', '#ff8a8a'], glow: true, sp: 60, size: 1.4, ms: 380, g: -30, spread: 0.7 });
    FX.shake(J.shakePx * 0.3, 80);
  }
  // 안개 + 박쥐 구름(8단계 흡혈 백작 fxArt.mist): 사라지는 자리 · 나타나는 자리에 한 번(바닥 기준, 캐릭터 앞)
  //   10단계 마왕 어둠 순간이동: 안개 그림이 없음 → 검붉은 연기 조각(spec.smokeCols)을 더 많이·크게
  function mistPuff(e, x, y) {
    var F = G.assets.enemyFx && G.assets.enemyFx[e.type], M = F && F.mist, SC = e.atk && e.atk.spec.smokeCols;
    if (M && M.frames.length) FX.sprite(x, y, M.frames, M.fps, M.pivot, e.dir > 0, false);
    if (Skills.debris) Skills.debris(x, y - 40 * AS, y, SC ? 14 : 6, { cols: SC || ['#c8c8d8', '#8a8aa0', '#e8e8f0'], sp: SC ? 80 : 60, size: SC ? 2.4 : 1.6, ms: SC ? 640 : 520, g: -40, spread: 1.2 });
  }
  // 플레이어 밀어내기(10단계 마왕 각성 포효): 맞음·데미지 없이 shoveMs 동안 dist 만큼 바깥으로 밀려남(step 이 매 장면 옮김). 쓰러짐·잡힘·넘어짐이면 안 밂
  var shove = null;
  function pushPlayer(e, dist) {
    var p = G.player;
    if (p.state === 'dead' || p.state === 'held' || p.state === 'down') return;
    shove = { dir: p.x >= e.x ? 1 : -1, dist: dist, t: 0, ms: 320 };
  }
  function shoveStep(dt) {
    if (!shove) return;
    var p = G.player, u0 = Math.min(1, shove.t / shove.ms); shove.t += dt;
    var u1 = Math.min(1, shove.t / shove.ms), ease = function (u) { return 1 - (1 - u) * (1 - u); };
    if (p.state !== 'dead' && p.state !== 'held') { p.x += shove.dir * shove.dist * (ease(u1) - ease(u0)); p.clamp(world); }
    if (u1 >= 1) shove = null;
  }
  // 붙잡힌 동안 누른 버튼 수(공격·점프·기술 칸, 한 번 누름 = 한 번)
  function grabMash() {
    var n = 0, ms = 400;
    if (Input.takeAttack(ms)) n++;
    if (Input.takeJump(ms)) n++;
    Skills.slots.forEach(function (k) { if (Input.takeSkill(k, ms)) n++; });   // 기술 칸 A~D
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


  // ---------- 보스 등장 컷인 (2026-11-06 밤, 형님 「보스 나올 때 연출」, 수치 = config bossIntro) ----------
  //   그 판 보스가 처음 나올 때: 게임이 잠깐 멈추고(intro 동안 step 안 함) 화면이 어두워짐 → 위·아래 「WARNING」 띠가 미끄러져 들어옴 →
  //   오른쪽에 보스 얼굴·상체(보스 서 있는 그림을 크게, 도트 그대로) + 보스 색 불꽃 배경, 왼쪽에 칭호 + 이름 → 사라지며 싸움 시작.
  //   공격·점프를 누르면 바로 넘어감(처음 300ms 뒤부터). 10단계 마왕 = 더 길고 보라색 + 이름이 꽝 박힐 때 흔들림
  var intro = null;
  function startIntro(e) {
    var BI = CFG.bossIntro;
    if (!BI || !BI.on || !e) return;
    var king = !!e.T.finalBoss;
    intro = { e: e, t: 0, ms: king ? BI.kingMs : BI.ms, king: king, shook: false,
              title: (BI.titles && BI.titles[e.type]) || '', color: king ? BI.kingColor : (e.T.rageColor || BI.color) };
    Input.takeAttack(5000); Input.takeJump(5000);   // 미리 눌러 둔 공격으로 바로 넘어가지 않게
  }
  function introStep(ms) {
    intro.t += ms;
    if (intro.t > 300 && (Input.takeAttack(250) || Input.takeJump(250))) intro.t = Math.max(intro.t, intro.ms - 220);   // 넘기기: 사라지는 장면만
    if (intro.king && !intro.shook && intro.t > intro.ms * 0.32) { intro.shook = true; FX.shake(J.shakePx * 3, 500); }
    if (intro.t >= intro.ms) intro = null;
  }
  function introEase(u) { u = clamp(u, 0, 1); return 1 - Math.pow(1 - u, 3); }
  function drawIntro() {
    if (!intro) return;
    var I = intro, e = I.e, T = e.T, u = I.t / I.ms, inK = introEase(I.t / 320), outK = introEase((I.t - (I.ms - 260)) / 260), env = inK * (1 - outK);
    ctx.save();
    ctx.globalAlpha = 0.62 * env; ctx.fillStyle = I.king ? '#0c0414' : '#08040a'; ctx.fillRect(-8, -8, LW + 16, LH + 16);
    ctx.globalAlpha = 1;
    // 위·아래 경고 띠(검붉은 바탕 + 움직이는 빗금 + WARNING 글자)
    function band(y, h, dir, k) {
      var off = (1 - k) * LW * dir + outK * LW * -dir;
      ctx.save(); ctx.translate(off, 0);
      ctx.fillStyle = I.king ? 'rgba(30,6,40,0.92)' : 'rgba(40,4,8,0.92)'; ctx.fillRect(-4, y, LW + 8, h);
      ctx.fillStyle = I.king ? '#8a2aff' : '#d81828';
      var sh = (I.t / 18) % 16;
      for (var x = -32 + sh * dir; x < LW + 32; x += 16) { ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + 6, y + h); ctx.lineTo(x + 6 + h * 0.6, y); ctx.lineTo(x + h * 0.6, y); ctx.closePath(); ctx.globalAlpha = 0.55; ctx.fill(); }
      ctx.globalAlpha = 1; ctx.fillRect(-4, y, LW + 8, 1); ctx.fillRect(-4, y + h - 1, LW + 8, 1);
      if (Math.floor(I.t / 160) % 2 === 0 || u > 0.3) {
        ctx.font = 'bold ' + Math.round(h * 0.72) + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3; ctx.strokeStyle = '#1a0006'; ctx.fillStyle = '#ffffff';
        var txt = I.king ? '⚠ WARNING · FINAL BOSS ⚠' : '⚠ WARNING ⚠';
        ctx.strokeText(txt, LW / 2, y + h / 2 + 1); ctx.fillText(txt, LW / 2, y + h / 2 + 1);
      }
      ctx.restore();
    }
    var bh = Math.round(LH * 0.075);
    band(Math.round(LH * 0.12), bh, -1, inK);
    band(Math.round(LH * 0.86) - bh, bh, 1, introEase((I.t - 80) / 320));
    // 보스 얼굴판(오른쪽): 보스 색 → 어둠 기울기 + 아래에서 솟는 불꽃 줄
    var px0 = LW * 0.42, pT = LH * 0.24, pB = LH * 0.86 - bh - 4, slide = (1 - introEase((I.t - 120) / 360)) * LW * 0.6 + outK * LW * 0.6;
    ctx.save(); ctx.translate(slide, 0);
    ctx.beginPath(); ctx.moveTo(px0 + 30, pT); ctx.lineTo(LW + 4, pT); ctx.lineTo(LW + 4, pB); ctx.lineTo(px0, pB); ctx.closePath();
    var gr = ctx.createLinearGradient(px0, 0, LW, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.35, I.color); gr.addColorStop(1, '#1a0408');
    ctx.globalAlpha = 0.85; ctx.fillStyle = gr; ctx.fill(); ctx.globalAlpha = 1;
    ctx.save(); ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    for (var f = 0; f < 18; f++) {   // 불꽃 줄(아래에서 위로 흘러감)
      var fx = px0 + 20 + ((f * 53) % 100) / 100 * (LW - px0), fy = pB - ((I.t * (0.08 + (f % 5) * 0.02) + f * 37) % (pB - pT + 30)), fl = 6 + (f % 4) * 4;
      ctx.globalAlpha = 0.35; ctx.fillStyle = f % 3 ? I.color : '#fff2c0'; ctx.fillRect(Math.round(fx), Math.round(fy), 2, fl);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    // 보스 그림(서 있기 1장)을 크게, 도트 그대로. 발은 판 아래로 잘려서 상체·얼굴만
    var A = e.art && (e.art.idle || e.art[T.walkAnim]), im = A && A[0];
    if (im) {
      var sc = (I.king ? 3 : 2.4) * (pB - pT) / Math.max(60, T.height * 1.6), sm = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.translate(Math.round(LW * 0.76), Math.round(pB + T.height * sc * 0.42)); ctx.scale(sc * (T.drawScale || 1), sc * (T.drawScale || 1));
      Assets.blit(ctx, im, T.pivot.x, T.pivot.y);
      ctx.imageSmoothingEnabled = sm;
    }
    ctx.restore();
    ctx.fillStyle = I.color; ctx.fillRect(px0 + 2, pB - 2, LW, 2);
    ctx.restore();
    // 이름(왼쪽): 칭호(작게, 보스 색) + 이름(크게, 흰색 + 진한 테두리)
    var nx = LW * 0.07 - (1 - introEase((I.t - 220) / 320)) * LW * 0.5 - outK * LW * 0.5, ny = LH * 0.5;
    var big = Math.round(LH * (I.king ? 0.13 : 0.11)), small = Math.round(LH * 0.055);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    if (I.title) {
      ctx.font = 'bold ' + small + 'px system-ui, sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = '#140208'; ctx.fillStyle = I.king ? '#d8b0ff' : '#ffd27a';
      ctx.strokeText(I.title, nx, ny - big * 0.95); ctx.fillText(I.title, nx, ny - big * 0.95);
    }
    ctx.font = '900 ' + big + 'px system-ui, sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = '#140208';
    ctx.strokeText(e.label, nx, ny); ctx.fillStyle = '#ffffff'; ctx.fillText(e.label, nx, ny);
    ctx.fillStyle = I.color; ctx.fillRect(nx, ny + 6, Math.min(LW * 0.4, big * e.label.length * 0.95) * introEase((I.t - 380) / 300), 3);
    ctx.restore();
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
    var vk = (opt && opt.variant) || T.variant, V = vk && CFG.variants ? CFG.variants[vk] : null;   // T.variant = 늘 그 색으로 나오는 적(7단계 용암 골렘)
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
    if (V.glow || V.keep) { try { glowPixels(g, img, c.width, c.height, V); } catch (e) {} }   // 파일로 열면 점을 못 읽음 → 빛 없이
    g.filter = 'none';
    return Assets.copyMeta(img, c);
  }
  // 빛나는 자리(7단계 용암 골렘): 원래 그림에서 색상이 V.glow.hue 범위인 점(이끼) → V.glow.color(원래 밝기만큼, 어두운 몸 위에서 빛남),
  //   V.keep.hue 범위의 진한 점(가슴 핵) → 원래 색 그대로. 나머지는 위에서 어둡게 바꾼 색
  function glowPixels(g, img, w, h, V) {
    var o = document.createElement('canvas'); o.width = w; o.height = h;
    var og = o.getContext('2d'); og.drawImage(img, 0, 0);
    var src = og.getImageData(0, 0, w, h).data, d = g.getImageData(0, 0, w, h), p = d.data;
    var GL = V.glow, KP = V.keep, gc = GL ? hexRgb(GL.color) : null;
    for (var i = 0; i < p.length; i += 4) {
      if (!src[i + 3]) continue;
      var r = src[i], gg = src[i + 1], b = src[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx ? (mx - mn) / mx : 0, hue = 0;
      if (mx > mn) {
        hue = mx === r ? 60 * (((gg - b) / (mx - mn)) % 6) : mx === gg ? 60 * ((b - r) / (mx - mn) + 2) : 60 * ((r - gg) / (mx - mn) + 4);
        if (hue < 0) hue += 360;
      }
      if (KP && sat >= KP.sat && hue >= KP.hue[0] && hue <= KP.hue[1] && mx >= (KP.light || 0)) { p[i] = r; p[i + 1] = gg; p[i + 2] = b; continue; }
      if (GL && sat >= GL.sat && hue >= GL.hue[0] && hue <= GL.hue[1]) {
        var k = 0.45 + 0.75 * mx / 255;   // 밝은 이끼일수록 더 밝은 용암
        p[i] = Math.min(255, gc[0] * k); p[i + 1] = Math.min(255, gc[1] * k); p[i + 2] = Math.min(255, gc[2] * k);
      }
    }
    g.putImageData(d, 0, 0);
  }
  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
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
  // 판에 나오는 변종 그림을 판 시작할 때 미리 구움(게임 중 멈칫 없게). 보스가 화날 때 부르는 색 바꾼 졸개(5단계 얼음 늑대)도
  function bakeStageVariants() {
    CFG.stage.waves.forEach(function (w) {
      (w.spawn || []).concat(w.placed || []).forEach(function (s) {
        if (s[3] && s[3].variant) tintArt(s[0], s[3].variant);
        else if (CFG.enemies[s[0]] && CFG.enemies[s[0]].variant) tintArt(s[0], CFG.enemies[s[0]].variant);
        var E = CFG.enemies[s[0]] && CFG.enemies[s[0]].enrage;
        if (E && E.summon) E.summon.forEach(function (t) { var o = summonOf(t); if (o.opt && o.opt.variant) tintArt(o.type, o.opt.variant); });
      });
    });
  }
  // 보스 졸개 목록의 한 칸: 'goblin' 또는 ['wolf', { variant: 'ice' }] (색 바꾼 졸개)
  function summonOf(t) { return Array.isArray(t) ? { type: t[0], opt: t[1] || null } : { type: t, opt: null }; }

  // ---------- 판에 나오는 적 종류 (그 판 적 그림만 불러오기, 2026-11-04) ----------
  // 웨이브 spawn·placed + 보스가 화날 때 부르는 졸개까지
  function stageEnemies(st) {
    var out = [];
    function add(t) {
      if (!t || out.indexOf(t) >= 0 || !CFG.enemies[t]) return;
      out.push(t);
      var E = CFG.enemies[t].enrage;
      if (E && E.summon) E.summon.forEach(function (q) { add(summonOf(q).type); });
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
  //   bs = 공격의 burst 수치(있으면): bs.fx = 다른 효과 그림 이름(5단계 서리 거인 = 얼음 가시), bs.cols = 튀는 조각 색
  function rockBurst(e, x, y, scale, bs) {
    var F = G.assets.enemyFx && G.assets.enemyFx[e.type], B = F && F[(bs && bs.fx) || 'rockburst'];
    if (B && B.frames.length) FX.sprite(x, y, B.frames, B.fps, B.pivot, false, false, scale || 1);
    if (Skills.debris) Skills.debris(x, y - 6 * AS, y, Math.round(8 * (scale || 1)), { cols: (bs && bs.cols) || ['#6a6458', '#8a826e', '#4a463e', '#6f8a4a'], sp: 150, size: 2.2, ms: 600 });
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

  // ---------- 총알 (6단계 총잡이 shot · 선장 pistol): 쏜 사람 줄(발 y = z)을 따라 똑바로 날아감 ----------
  // { e: 쏜 적, s: 공격 수치, x: 지금 가로 위치, z: 줄(발 y), h: 땅에서 높이(그림만), dir, trav: 날아간 거리, t, art }
  //   맞음 = 가로로 플레이어 몸(hurtbox x)에 닿음 + 줄이 s.depth 안 + 점프 높이 s.dodgeZ 아래(높이는 안 봄: 총구가 머리보다 높은 선장 권총도 같게)
  //   맞으면 사라짐. 플레이어가 깜빡임(무적)·기술 무적이면 그냥 지나감. range 까지 가거나 보스가 쓰러지면 사라짐
  //   7단계 불 도깨비 불덩이도 같은 길: s.proj = 날아가는 그림(없으면 bullet), s.muzzle = 총구 연기(없으면 smoke, null = 안 씀),
  //     s.impact = 맞거나 끝까지 가면 그 자리(바닥)에서 터지는 그림(fxArt 이름, 없으면 안 터짐)
  //   8단계 흡혈 백작 박쥐 떼도 같은 길(proj = 'bats'). o = { dz: 줄을 위아래로 옮김, wait: 이만큼 늦게 출발(그동안 안 보임), scale: 그림 크기 } (화난 뒤 세 무리)
  //     s.hitCols = 맞을 때 튀는 조각 색(없으면 불꽃색)
  //   9단계 흑마법사 암흑 구체도 같은 길(proj 'orb', impact 'orbhit'): s.impactAir = 터지는 그림을 바닥 말고 구체 높이에, s.impactCols = 터질 때 튀는 조각 색
  //   10단계 마왕 초승달 파동도 같은 길(proj 'wave', 높이 0 = 바닥을 따라): s.pierce = 맞혀도 안 사라지고 range 끝까지(플레이어는 한 번만 맞음, b.hit),
  //     s.projLoop = 날아가는 동안 반복할 그림 번호(처음엔 1장), s.projEnd = 끝까지 가면 그 자리에 한 번 보여 줄 그림 번호(흩어짐)
  var shots = [];
  function fireShot(e, s, o) {
    var F = G.assets.enemyFx && G.assets.enemyFx[e.type];
    var mx = e.x + e.dir * s.spawn.x, my = e.y + s.spawn.y, z = clamp(e.y + ((o && o.dz) || 0), world.laneTop, world.laneBottom);
    shots.push({ e: e, s: s, x: mx, z: z, h0: -s.spawn.y, h: -s.spawn.y, dir: e.dir, trav: 0, t: 0, wait: (o && o.wait) || 0, sc: (o && o.scale) || 1,
                 art: F && F[s.proj || 'bullet'], imp: F && s.impact ? F[s.impact] : null });
    if (o && o.wait) return;   // 늦게 나가는 무리: 연기·불꽃은 첫 무리 때만
    var SM = F && s.muzzle !== null ? F[s.muzzle || 'smoke'] : null;
    if (SM && SM.frames.length) FX.sprite(mx, my, SM.frames, SM.fps, SM.pivot, e.dir > 0, false);   // 총구 연기(그림은 왼쪽을 봄)
    if (Skills.debris) Skills.debris(mx, my, e.y, 4, { cols: ['#fff2a0', '#ffb040', '#ffffff'], glow: true, sp: 110, size: 1.2, ms: 160 });   // 불꽃 튐
    FX.shake(J.shakePx * (s.proj ? 0.15 : 0.35), 70);   // 던지는 불덩이는 총보다 약하게
  }
  // 불덩이 터짐(s.impact 그림, 바닥 기준) + 불씨
  function shotImpact(b) {
    var I = b.imp, s = b.s;
    if (I && I.frames.length) FX.sprite(b.x, s.impactAir ? b.z - b.h : b.z, I.frames, I.fps, I.pivot, b.dir > 0, false);
    if (Skills.debris) Skills.debris(b.x, b.z - b.h, b.z, 6, { cols: s.impactCols || ['#fff2a0', '#ffb040', '#ff6a1a', '#5a4a44'], glow: true, sp: 120, size: 1.4, ms: 320 });
  }
  function shotsStep(dt) {
    var p = G.player, S = G.stage, hb = null;
    for (var i = shots.length - 1; i >= 0; i--) {
      var b = shots[i], s = b.s, move = s.speed * dt / 1000, n = Math.max(1, Math.ceil(move / 6)), gone = false;
      if (S.bossDownT >= 0 || S.result) { shots.splice(i, 1); continue; }
      if (b.wait > 0) { b.wait -= dt; continue; }   // 늦게 나가는 무리(화난 흡혈 백작 박쥐 떼)
      b.t += dt;
      for (var k = 0; k < n && !gone; k++) {
        var m = Math.min(move / n, s.range - b.trav);
        b.x += b.dir * m; b.trav += m;
        b.h = s.dropPx > 0 ? b.h0 + (s.aimH - b.h0) * Math.min(1, b.trav / s.dropPx) : b.h0;   // 권총: 처음 dropPx 동안 총알 높이로 내려옴
        if (!b.hit && p.state !== 'dead' && Math.abs(p.y - b.z) <= s.depth && (p.z || 0) <= s.dodgeZ) {
          hb = p.hurtbox();
          var w = s.box.w / 2;
          if (b.x + w > hb.x0 && b.x - w < hb.x1 && onPlayerHit({ x: b.x - b.dir * 30, dmgMul: b.e.dmgMul, T: b.e.T }, s)) {
            if (s.pierce) b.hit = true; else gone = true;   // 파동(pierce): 그대로 지나감
            if (b.imp) shotImpact(b);
            else if (Skills.debris) Skills.debris(b.x, b.z - b.h - (s.pierce ? 40 * AS : 0), b.z, s.pierce ? 9 : 5, { cols: s.hitCols || ['#fff2a0', '#ffd060', '#c8c8c8'], glow: !s.hitCols, sp: 120, size: 1.2, ms: 220 });
          }
        }
        if (b.trav >= s.range - 0.01) {   // 끝까지 날아간 불덩이도 그 자리에서 터짐 / 파동은 흩어지는 그림 한 장
          if (!gone && b.imp) shotImpact(b);
          if (s.projEnd && b.art && b.art.frames[s.projEnd - 1]) FX.sprite(b.x, b.z - b.h, [b.art.frames[s.projEnd - 1]], 7, b.art.pivot, b.dir > 0, false);
          gone = true;
        }
      }
      if (gone) shots.splice(i, 1);
    }
  }
  function drawShots(camX, under) {
    shots.forEach(function (b) {
      if (b.wait > 0) return;   // 아직 안 나간 무리
      var x = snap(b.x - camX);
      if (under) { window.drawShadow(ctx, x, snap(b.z), (b.s.box.w > 30 * AS ? 12 : 3) * AS * b.sc); return; }   // 바닥에 그림자 = 지나가는 줄(박쥐 떼는 크게)
      var y = snap(b.z - b.h), A = b.art;
      if (!A || !A.frames.length) { ctx.fillStyle = '#fff2a0'; ctx.fillRect(x - 2, y - 1, 4, 3); return; }
      var fi = Math.floor(b.t * A.fps / 1000), L = b.s.projLoop;
      var im = L ? A.frames[(fi < 1 ? 1 : L[(fi - 1) % L.length]) - 1] : A.frames[fi % A.frames.length];   // projLoop: 1장 → 2·3장 반복(10단계 파동)
      ctx.save(); ctx.translate(x, y); ctx.scale(b.dir > 0 ? -b.sc : b.sc, b.sc);   // 그림은 왼쪽으로 날아감(꼬리가 오른쪽) → 오른쪽으로 쏘면 뒤집기. sc = 작은 박쥐 무리
      Assets.blit(ctx, im, A.pivot.x, A.pivot.y); ctx.restore();
    });
  }

  // ---------- 대포알 (6단계 선장 barrage): 떨어질 자리에 그림자(점점 커짐) + 빨간 원 → fallMs 뒤 쾅 ----------
  // { e, s, tx, ty: 떨어질 자리(줄), t }. 맞음 = 가로 radius · 위아래 depth 안 + 높이 dodgeZ 아래(바위 던지기와 같음). 보스가 쓰러진 뒤엔 안 아픔
  //   10단계 마왕 암흑 구슬 비도 같은 길: s.proj = 떨어지는 그림(없으면 cannonball), s.blast = 터지는 그림(없으면 blast), s.blastCols = 터질 때 조각 색
  var cannons = [];
  function dropCannon(e, s, tx, ty) {
    var F = G.assets.enemyFx && G.assets.enemyFx[e.type];
    cannons.push({ e: e, s: s, tx: tx, ty: ty, t: 0, F: F || {} });
  }
  function cannonsStep(dt) {
    var p = G.player, S = G.stage;
    for (var i = cannons.length - 1; i >= 0; i--) {
      var c = cannons[i], s = c.s;
      c.t += dt;
      if (c.t < s.fallMs) continue;
      cannons.splice(i, 1);
      var B = c.F[s.blast || 'blast'];
      if (B && B.frames.length) FX.sprite(c.tx, c.ty, B.frames, B.fps, B.pivot, Math.random() < 0.5, false);
      if (Skills.debris) Skills.debris(c.tx, c.ty - 6 * AS, c.ty, 10, { cols: s.blastCols || ['#ffd060', '#ff8a2a', '#6a5a4a', '#a0805a'], glow: !!s.blastCols, sp: 170, size: 2, ms: 600 });
      FX.shake(J.shakePx * s.shake, J.shakeMs * 1.6);
      if (S.bossDownT < 0 && p.state !== 'dead' && Math.abs(p.x - c.tx) <= s.radius && Math.abs(p.y - c.ty) <= s.depth && (p.z || 0) <= s.dodgeZ)
        onPlayerHit({ x: c.tx, dmgMul: c.e.dmgMul, T: c.e.T }, s);
    }
  }
  // 바닥: 그림자(떨어지는 정도로 1→4장, 없으면 검은 타원) + 빨간 원 / 공중: 떨어지는 대포알(연기 꼬리)
  function drawCannonsUnder(camX) {
    cannons.forEach(function (c) {
      var u = Math.min(1, c.t / c.s.fallMs), SH = c.F.shadow, x = snap(c.tx - camX), y = snap(c.ty);
      Enemy.drawRing(ctx, camX, c.tx, c.ty, c.s.radius, c.s.depth, u, false);
      if (SH && SH.frames.length) {
        ctx.save(); ctx.translate(x, y); Assets.blit(ctx, SH.frames[Math.min(SH.frames.length - 1, Math.floor(u * 3.999))], SH.pivot.x, SH.pivot.y); ctx.restore();
      } else window.drawShadow(ctx, x, y, 14 * AS * (0.4 + 0.6 * u));
    });
  }
  function drawCannons(camX) {
    cannons.forEach(function (c) {
      var u = Math.min(1, c.t / c.s.fallMs), A = c.F[c.s.proj || 'cannonball'], x = snap(c.tx - camX), y = snap(c.ty - c.s.dropHeight * (1 - u * u));   // 점점 빨리 떨어짐
      if (!A || !A.frames.length) { ctx.fillStyle = '#2a2a30'; ctx.fillRect(x - 5, y - 5, 10, 10); return; }
      ctx.save(); ctx.translate(x, y); Assets.blit(ctx, A.frames[Math.floor(c.t * A.fps / 1000) % A.frames.length], A.pivot.x, A.pivot.y); ctx.restore();
    });
  }

  // ---------- 얼음 가시 (5단계 서리 거인 spikes): 가시 자리마다 하나씩, delayMs 씩 늦게 솟음 ----------
  // { e, s: 공격 수치, x, y: 자리(바닥), t: 지난 시간(처음엔 음수 = 기다림), hit, burst }. 그림 = 거인 fxArt[s.fx] 1~5장 한 번(1장 = 땅 갈라짐 예고)
  //   맞음 = s.spikeActive 장 동안 가시 상자(s.reach, 위아래 s.depth)에 플레이어 몸이 닿음 + 높이 s.dodgeZ 아래 → 가시마다 한 번. 보스가 쓰러지면 다 사라짐
  var spikes = [];
  function spikeLine(e, s, pts) {
    (pts || []).forEach(function (q, i) { spikes.push({ e: e, s: s, x: q.x, y: q.y, t: -i * s.delayMs, hit: false, burst: false }); });
  }
  function spikeArt(k) { var F = G.assets.enemyFx && G.assets.enemyFx[k.e.type]; return F && F[k.s.fx]; }
  function spikeFrame(k, A) { return Math.floor(k.t * ((A && A.fps) || 14) / 1000) + 1; }   // 1부터
  function spikesStep(dt) {
    var p = G.player, S = G.stage;
    for (var i = spikes.length - 1; i >= 0; i--) {
      var k = spikes[i], s = k.s, A = spikeArt(k), n = (A && A.frames.length) || 5;
      k.t += dt;
      if (S.bossDownT >= 0 || S.result) { spikes.splice(i, 1); continue; }
      if (k.t < 0) continue;
      var f = spikeFrame(k, A);
      if (f > n) { spikes.splice(i, 1); continue; }
      if (!k.burst && f >= s.spikeActive[0]) {   // 솟는 순간: 얼음 조각 + 작은 흔들림
        k.burst = true;
        if (Skills.debris) Skills.debris(k.x, k.y - 10 * AS, k.y, 6, { cols: ['#ffffff', '#e8f6ff', '#a8d8f8', '#6aa8d8'], sp: 130, size: 1.8, ms: 420 });
        FX.shake(J.shakePx * 0.35, 80);
      }
      if (k.hit || s.spikeActive.indexOf(f) < 0 || p.state === 'dead' || (p.z || 0) > s.dodgeZ) continue;
      var h = p.hurtbox(), r = s.reach;
      if (k.x + r.x0 < h.x1 && k.x + r.x1 > h.x0 && k.y + r.yTop < h.y1 && k.y + r.yBot > h.y0 && Math.abs(k.y - h.z) <= s.depth) {
        k.hit = true;
        onPlayerHit({ x: k.x + (p.x >= k.x ? -6 : 6) * AS, dmgMul: k.e.dmgMul, T: k.e.T }, s);   // 가시 자리에서 바깥으로 밀림
      }
    }
  }
  // 가시 그림(깊이 순서에 같이 넣음: 앞뒤 캐릭터와 겹쳐 보이게)
  function addSpikeDraw(ents, camX) {
    spikes.forEach(function (k) {
      if (k.t < 0) return;
      var A = spikeArt(k);
      ents.push({ y: k.y, d: function () {
        var x = snap(k.x - camX), y = snap(k.y);
        if (!A || !A.frames.length) { ctx.fillStyle = '#cfefff'; ctx.fillRect(x - 6, y - 24, 12, 24); return; }
        var im = A.frames[Math.min(A.frames.length - 1, spikeFrame(k, A) - 1)];
        ctx.save(); ctx.translate(x, y); Assets.blit(ctx, im, A.pivot.x, A.pivot.y); ctx.restore();
      } });
    });
  }

  // ---------- 화염 충격파 고리 (9단계 마왕군 장군 shockwave): 칼을 꽂은 자리를 가운데로 납작한 불꽃 고리가 퍼짐 ----------
  // { e, s: 공격 수치, x, y: 가운데(바닥), t: 지난 시간(처음엔 음수 = 다음 고리 기다림), hit }. 반지름 r = r0 + speed x 시간(rMax 까지)
  //   맞음 = 플레이어 발이 타원(가로 r, 위아래 ry = min(r, ringRx) / ringRx x ryMax) 「테두리」 band 안: | sqrt((dx / r)² + (dy / ry)²) - 1 | x r <= band
  //     + 높이 dodgeZ 아래(뛰어넘으면 피함) → 고리마다 한 번(깜빡임 무적으로 안 맞았으면 계속 확인). 다 퍼져 가는 마지막(90% 뒤, 꺼지는 불씨)은 안 아픔
  //   그림 = 장군 fxArt[s.fx] 를 가로 r / ringRx, 세로 min(1, r / ringRx) x flameScale 배로(1장 = 처음 80ms, 2·3장 반복, 4장 = 70%, 5장 = 90% 뒤). 보스가 쓰러지면 사라짐
  var rings = [];
  function shockwave(e, s, cx, cy, n) {
    for (var i = 0; i < n; i++) rings.push({ e: e, s: s, x: cx, y: clamp(cy, world.laneTop, world.laneBottom), t: -i * s.rings.gapMs, hit: false, seed: 33 + i * 17 + Math.floor(Math.random() * 1000) });
  }
  function ringR(q) { var R = q.s.rings; return Math.min(R.rMax, R.r0 + R.speed * Math.max(0, q.t) / 1000); }
  function ringLife(q) { var R = q.s.rings; return (R.rMax - R.r0) / R.speed * 1000; }
  function ringsStep(dt) {
    var p = G.player, S = G.stage;
    for (var i = rings.length - 1; i >= 0; i--) {
      var q = rings[i], R = q.s.rings, life = ringLife(q);
      if (S.bossDownT >= 0 || S.result) { rings.splice(i, 1); continue; }
      var t0 = q.t; q.t += dt;
      if (q.t < 0) continue;
      if (t0 < 0 || !q.born) {   // 퍼지기 시작: 불씨 + 작은 흔들림
        q.born = true;
        if (Skills.debris) Skills.debris(q.x, q.y - 6 * AS, q.y, 6, { cols: ['#fff2a0', '#ffb040', '#ff6a1a', '#3a2a2a'], glow: true, sp: 120, size: 1.5, ms: 360 });
        FX.shake(J.shakePx * 0.5, 100);
      }
      if (q.t >= life) { rings.splice(i, 1); continue; }
      if (q.hit || q.t >= life * 0.9 || p.state === 'dead' || (p.z || 0) > R.dodgeZ) continue;
      var r = ringR(q), ry = Math.max(1, Math.min(r, R.ringRx) / R.ringRx * R.ryMax), dx = p.x - q.x, dy = p.y - q.y;
      if (Math.abs(Math.sqrt((dx / r) * (dx / r) + (dy / ry) * (dy / ry)) - 1) * r <= R.band)
        q.hit = onPlayerHit({ x: q.x, dmgMul: q.e.dmgMul, T: q.e.T }, q.s);   // 가운데에서 바깥으로 밀림
    }
  }
  // 고리 그림: 가운데 줄(y) 깊이로 캐릭터와 같이 줄 세움(그 줄보다 앞에 선 캐릭터가 고리 위에 보임)
  function addRingDraw(ents, camX) {
    rings.forEach(function (q) {
      if (q.t < 0) return;
      // 2026-11-06: 우리가 코드로 그린 지옥불 고리(js/fxdraw.js) — 매 장면 지금 반지름으로 새로 그림(늘이지 않음). 밝은 테두리 = 맞는 띠.
      //   먼 쪽 반(가운데 줄 위) = 고리 뒤쪽 끝 깊이, 가까운 쪽 반 = 앞쪽 끝 깊이로 따로 줄 세움 → 고리 안에 선 캐릭터는 뒤쪽 불꽃 앞·앞쪽 불꽃 뒤
      if (window.FXDraw) {
        var R0 = q.s.rings, ry0 = Math.max(1, Math.min(ringR(q), R0.ringRx) / R0.ringRx * R0.ryMax);
        ents.push({ y: q.y - ry0, d: function () { FXDraw.nova(ctx, q, R0, q.x - camX, q.y, q.t, q.seed, 'back'); } });
        ents.push({ y: q.y + ry0, d: function () { FXDraw.nova(ctx, q, R0, q.x - camX, q.y, q.t, q.seed, 'front'); } });
        return;
      }
      ents.push({ y: q.y, d: function () {
        var R = q.s.rings, r = ringR(q), u = q.t / ringLife(q), x = snap(q.x - camX), y = snap(q.y);
        var F = G.assets.enemyFx && G.assets.enemyFx[q.e.type], A = F && F[q.s.fx];
        if (!A || !A.frames.length) {   // 그림이 없으면 주황 타원
          ctx.save(); ctx.strokeStyle = '#ff8a2a'; ctx.lineWidth = 3; ctx.beginPath();
          ctx.ellipse(x, y, r, Math.max(1, Math.min(r, R.ringRx) / R.ringRx * R.ryMax), 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); return;
        }
        var n = A.frames.length, k = q.t < 80 ? 0 : u >= 0.9 ? 4 : u >= 0.7 ? 3 : 1 + Math.floor(q.t * A.fps / 1000) % 2;
        ctx.save(); ctx.translate(x, y); ctx.scale(r / R.ringRx, Math.min(1, r / R.ringRx) * R.flameScale);
        Assets.blit(ctx, A.frames[Math.min(n - 1, k)], A.pivot.x, A.pivot.y); ctx.restore();
      } });
    });
  }

  // ---------- 소품 (판의 props: 상자·통·모닥불 + 음식) = props.js. 그림이 없는 종류는 ?debug=1 에서만 자리 표시 ----------
  Props.init(CFG, {
    laneY: laneY,
    fx: function () { return G.assets && G.assets.fx; },
    hitstop: function (ms) { G.hitstop = Math.max(G.hitstop, ms); }
  });

  // ---------- 막힘 지킴이 (2026-11-04): 웨이브가 고정된 동안 적 하나가 안 와서 웨이브가 안 끝나는 일 막기 ----------
  //   살아 있는 적이 STUCK.ms 넘게 ① 「화면 밖」이거나 ② 「플레이어에게서 가로 STUCK.far 넘게 떨어져서 제자리(STUCK.move 안)」이면
  //   (공격·맞음·넘어짐·휘청·방패·자는 중은 안 셈. 느린 설인이 화면을 가로질러 걸어오는 중처럼 움직이고 있으면 ②는 안 셈)
  //   플레이어 줄로, 그 적이 있던 쪽 화면 끝 바로 밖으로 옮김 → entered 를 풀어서 다시 화면 안으로 걸어 들어오게(enemies.js: 들어오기 전엔 목표가 화면 안)
  //   (화면 밖에서 영영 멈춰 있거나, 소품 뒤·판 밖에 끼었을 때). G.stage.rescued = 옮긴 수, rescueLog = 그때 상태(시험용)
  var STUCK = { ms: 8000, far: 300, move: 16 };
  function rescueStuck(dt) {
    var p = G.player, V = G.ectx.view, far = STUCK.far * AS, mv = STUCK.move * AS, S = G.stage;
    G.enemies.forEach(function (e) {
      // 8단계: 흡혈 백작이 안개로 숨어 순간이동하는 동안(hidden, state 'attack')·유령 기사가 옅어져 돌진하는 동안도 공격 중 = 안 셈
      //   10단계: 마왕이 어둠 순간이동으로 숨은 동안(hidden, state 'attack')·각성 중(awaken)도 안 셈
      var busy = e.state === 'attack' || e.state === 'hit' || e.state === 'down' || e.state === 'stagger' || e.state === 'guard' || e.state === 'awaken' || e.hidden;
      if (!e.alive() || e.asleep || e.alertT > 0 || busy || p.state === 'dead' || p.state === 'held') { e.lostT = 0; e.lostX = null; return; }
      var on = e.x >= V.x0 && e.x <= V.x1;
      if (on && Math.abs(e.x - p.x) <= far) { e.lostT = 0; e.lostX = null; return; }
      if (on && (e.lostX == null || Math.abs(e.x - e.lostX) > mv || Math.abs(e.y - e.lostY) > mv)) { e.lostX = e.x; e.lostY = e.y; e.lostT = 0; return; }   // 움직이는 중 = 다가오는 중
      e.lostT = (e.lostT || 0) + dt;
      if (e.lostT < STUCK.ms) return;
      var side = e.x >= p.x ? 1 : -1;
      (S.rescueLog || (S.rescueLog = [])).push(e.type + ':' + (on ? 'far' : 'off') + ':' + e.state + (e.entered ? ':in' : '') + '@' + Math.round(e.x - V.x0) + '/p' + Math.round(p.x - V.x0));   // 시험용 기록
      e.lostT = 0; e.lostX = null; e.entered = false; e.vx = 0;
      e.x = side > 0 ? V.x1 + e.T.radius + 4 : V.x0 - e.T.radius - 4;
      e.y = clamp(p.y, world.laneTop, world.laneBottom);
      S.rescued = (S.rescued || 0) + 1;
    });
  }

  // ---------- 성장: 경험치·레벨 (2026-11-05, 수치 = config growth, 계산·저장 = growth.js) ----------
  // 레벨에 맞는 최대 체력으로(새 판 시작·다시 하기 = 가득 참)
  function applyGrowth(p) { p.maxHp = Growth.maxHp(G.classKey); p.hp = p.maxHp; p.maxMp = Growth.maxMp(G.classKey); p.mp = p.maxMp; }
  // 능력치·직업이 바뀜(판 도중): 최대 체력만 새로(지금 체력은 그대로, 넘치면 잘라 냄 → 초기화·다시 올리기로 회복되지 않게)
  function refreshGrowth() {
    var p = G.player; if (!p) return;
    p.maxHp = Growth.maxHp(G.classKey); p.hp = Math.min(p.hp, p.maxHp);
    p.maxMp = Growth.maxMp(G.classKey); p.mp = Math.min(p.mp, p.maxMp);
  }
  // 마나(2026-11-06): 초당 Growth.mpRegen() 씩 참(쓰러지면 안 참). 맞힐 때 회복은 onHit. 기술이 씀(skills.js start, 2026-11-06 성장 4단계)
  function mpStep(dt) {
    var p = G.player;
    if (p.state !== 'dead' && p.mp < p.maxMp) p.mp = Math.min(p.maxMp, p.mp + Growth.mpRegen(G.classKey) * dt / 1000);   // 마나 순환(늘 켜진 기술)도
  }
  // 쓰러진 적(어떻게 쓰러졌든: 플레이어 타·기술·보스와 같이 쓰러짐)마다 한 번 경험치. 적 머리 위에 「+13 XP」
  function xpStep() {
    var idx = G.stageNo - 1;
    G.enemies.forEach(function (e) {
      if (e.alive() || e.xpDone) return;
      e.xpDone = true;
      var n = Growth.enemyXp(e.type, e.T, idx);
      if (!(n > 0) || Growth.isMax()) return;
      G.xpGot = (G.xpGot || 0) + n;
      FX.damage(e.x, e.y - e.T.height - 8, '+' + n + ' XP', false, J, null, 'xp', e.id + ':xp');
      var up = Growth.gain(n);
      if (up > 0) onLevelUp(up);
    });
  }
  // 레벨업: 늘어난 최대 체력만큼 바로 회복 + 머리 위 「LEVEL UP!」 + 짧은 번쩍·반짝 불똥(멈추지 않음)
  function onLevelUp(up) {
    var p = G.player, LU = CFG.growth.levelUp || {}, add = Growth.maxHp(G.classKey) - p.maxHp;
    p.maxHp = Growth.maxHp(G.classKey);
    if (p.state !== 'dead' && add > 0) p.hp = Math.min(p.maxHp, p.hp + add);
    var addMp = Growth.maxMp(G.classKey) - p.maxMp;   // 마나도 늘어난 만큼 참
    p.maxMp = Growth.maxMp(G.classKey);
    if (addMp > 0) p.mp = Math.min(p.maxMp, p.mp + addMp);
    FX.damage(p.x, p.y - (p.z || 0) - 118 * AS, 'LEVEL UP!', false, J, null, 'levelup', 'player:lv');
    if (LU.flash) Skills.flash(LU.flash);
    FX.impact(p.x, p.y - (p.z || 0) - 60 * AS, p.dir, LU.sparkCol || '#ffe066', Math.round(J.sparkCount * 1.4), true, G.assets.fx && G.assets.fx.impact, 1);
  }

  function onBossDown(boss) {
    var S = G.stage;
    S.bossDownT = 0;
    S.queue = [];                      // 아직 안 나온 졸개는 취소
    puddles.forEach(function (q) { q.t = Math.max(q.t, q.P.ms - 600); });   // 독 웅덩이는 곧 사라짐
    shots.length = 0;                  // 날아가던 총알도 사라짐(대포알은 떨어지지만 안 아픔)
    spikes.length = 0;                 // 얼음 가시도 사라짐
    rings.length = 0;                  // 화염 충격파 고리도 사라짐
    G.hitstop = Math.max(G.hitstop, 260);
    G.slowT = 1400;                    // 보스 쓰러질 때 슬로모션
    FX.shake(J.shakePx * 3, 500);
    shove = null;
    // 마지막 보스(10단계 마왕): 마지막 타에 더 긴 멈춤·슬로모션 + 하얀 번쩍 → 쓰러지는 그림(왕관이 떨어짐)을 다 보여 준 뒤 엔딩(stageStep · showResult)
    if (boss.T.finalBoss) {
      S.ending = true;
      cannons.length = 0;              // 떨어지던 구슬도 사라짐
      G.hitstop = Math.max(G.hitstop, 420);
      G.slowT = 2600;
      Skills.flash({ color: '#ffffff', alpha: 0.85, ms: 700 });
      FX.shake(J.shakePx * 4, 900);
    }
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
        if (S.queue[i].at <= S.waveT) {
          var ne = spawnEnemy(S.queue[i].type, S.queue[i].side, S.queue[i].opt); S.queue.splice(i, 1);
          if (ne.T.boss && !S.introDone) { S.introDone = true; startIntro(ne); }   // 보스 등장 컷인(판마다 한 번)
        }
      }
      rescueStuck(dt);
      // 보스 화남: 체력 절반 아래 → 빨라지고 졸개를 부름
      var B = S.boss;
      // 10단계 마왕 각성(enemies.js 가 state 'awaken' 으로 바꿈): 글자 + 화면 번쩍·크게 흔들림 + 짧은 멈춤, 졸개는 각성이 끝날 즈음 나옴. 화남은 그림이 끝나면 enemies.js 가 켬
      if (B && B.T.awaken && B.state === 'awaken' && !B.awakenShown) {
        B.awakenShown = true;
        var AW = B.T.awaken;
        banner(josa(B.label, '이', '가') + ' 각성했다!', 'boss');
        Skills.flash({ color: AW.flash || '#ff3a8c', alpha: 0.55, ms: 520 });
        FX.shake(J.shakePx * AW.shake, 900);
        G.hitstop = Math.max(G.hitstop, 160);
        (B.T.enrage.summon || []).forEach(function (t, k) {
          var q = summonOf(t);
          S.queue.push({ type: q.type, side: k % 2 ? 'L' : 'R', at: S.waveT + 1100 + k * 900, opt: q.opt });
        });
      }
      if (B && B.alive() && !B.T.awaken && !B.enraged && B.hp / B.maxHp < B.T.enrageAt) {
        B.enraged = true;
        // 보스 분노 연출(2026-11-06 밤, config ai.rage): 짧은 멈춤·느려짐 + 불꽃색 번쩍 + 크게 흔들림 + 플레이어를 살짝 밀어냄 + 불티.
        //   몸 둘레 불꽃 테두리·발밑 고리는 enemies.js(rageT). 수치(빨라짐·졸개)는 그대로
        var RG = CFG.ai.rage; B.rageT = 0;
        banner(josa(B.label || '오크 족장', '이', '가') + ' 분노했다!', 'boss');
        G.hitstop = Math.max(G.hitstop, RG.hitstopMs); G.slowT = Math.max(G.slowT, RG.slowMs);
        Skills.flash({ color: B.rageColor(), alpha: RG.flash, ms: 420 });
        FX.shake(J.shakePx * RG.shake, 700);
        pushPlayer(B, RG.push * AS);
        if (Skills.debris) Skills.debris(B.x, B.y - B.T.height * 0.5, B.y, 22, { cols: ['#fff2c0', B.rageColor(), '#ff3a10', '#ffd27a'], glow: true, sp: 240, size: 2, ms: 700 });
        (B.T.enrage.summon || []).forEach(function (t, k) {
          var q = summonOf(t);
          S.queue.push({ type: q.type, side: k % 2 ? 'L' : 'R', at: S.waveT + 400 + k * 700, opt: q.opt });
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
    //   마지막 보스(엔딩): 쓰러지는 그림(1.5초)과 재 더미를 조금 더 보여 준 뒤
    if (S.bossDownT >= 0 && !S.result) { S.bossDownT += dt; if (S.bossDownT > (S.ending ? 3600 : 2600)) showResult('clear'); }
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
      if (!e.alive() || e.state === 'down' || e.hidden || e.airborne() || e.faded()) return;   // 넘어진 적은 밟고 지나갈 수 있음, 땅속(전갈 왕)·공중(두꺼비 배치기)·옅어진 유령 기사도 지나감
      var charging = e.state === 'attack' && e.atk && e.atk.spec.type === 'charge';
      list.push({ o: e, r: e.T.radius, m: charging ? 0 : (e.T.boss ? 0.08 : 1), boss: !!e.T.boss, out: !e.entered });
    });
    for (var i = 0; i < list.length; i++) for (var j = i + 1; j < list.length; j++) {
      var a = list[i], b = list[j];
      if (Math.abs(a.o.y - b.o.y) >= AI.sepDepth) continue;
      // 아직 화면에 안 들어온 적은 아무도 밀지도, 밀리지도 않음(2026-11-04): 주인공이나 다른 적(특히 잘 안 밀리는 보스)이 화면 끝(휴대폰은 버튼 옆)에
      //   서 있으면 그 적이 계속 화면 밖으로 밀려나 영영 못 들어왔음 → 웨이브가 안 끝남. 들어온 뒤로는 보통처럼 밀어냄
      if (a.out || b.out) continue;
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
  // 기술 칸 하나 무작위(지금 보이는 칸 중. 2026-11-06 전엔 A/B 둘 중 하나)
  function botSlot() { var bk = Growth.book(G.classKey), n = bk ? bk.slots() : 2; return Skills.slots[Math.floor(Math.random() * n)]; }
  function botThink(dt) {
    var p = G.player, best = null, bd = 1e9;
    G.enemies.forEach(function (e) {
      if (!e.alive() || !e.entered) return;
      var d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y) * 2 + (e.canBeHit() ? 0 : 400);   // 넘어진 적은 나중에
      if (e.T.ranged) d *= 0.6;   // 총잡이(멀리서 쏨)는 먼저 쫓아가서 잡음(물러나도 따라감)
      if (d < bd) { bd = d; best = e; }
    });
    var ax = { x: 0, y: 0 }, R = CFG.hero.radius;
    if (!best) {   // 적이 없으면 오른쪽으로(막는 소품은 돌아감)
      if (!G.stage.locked) { ax.x = 1; var gy = Props.steer(p, R, p.x + 80, p.y, world).y - p.y; if (Math.abs(gy) > 2) ax.y = Math.sign(gy); }
      Input.setOverride(ax); return;
    }
    var side = best.x > p.x ? 1 : -1;
    if (G.classKey === 'mage' && !G.botPlain) { botMage(dt, p, best, side, ax); return; }   // botPlain = 예전처럼 붙어서(비교 시험용)
    var want = ({ goblin: 42, wolf: 58, orc: 72, bat: 46, skeleton: 44, golem: 76, mummy: 46, scorpion: 80, lizard: 46, toad: 74, gunner: 40, captain: 70, imp: 44, lavagolem: 76, wyvern: 80, yeti: 50, giant: 82, ghost: 46, vampire: 66, soldier: 52, mage: 40, general: 84, demonking: 86 }[best.type] || 50) * AS;
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
      if (Math.random() < 0.12) Input.pressSkill(botSlot());   // 가끔 기술(쿨타임·마나 모자람이면 안 나감)
    }
  }

  // 법사 자동 조종(2026-11-06, 균형 시험용): 붙어서 패지 않고 지팡이 끝 거리(약 70 도트 x AS)를 지키며 같은 줄에 맞춤.
  //   같은 줄 + 앞쪽 기술 거리(약 200 x AS) 안이면 멀리서 기술(칸 중 무작위, 쿨타임·마나 모자람이면 안 나감),
  //   적이 너무 가깝거나(몸 반지름 + 30) 공격 중이면(보스 예고 포함) 뒤로 물러남(벽에 막히면 위아래로 빠짐)
  var botKiteT = 0;
  function botMage(dt, p, best, side, ax) {
    var R = CFG.hero.radius, keep = 72 * AS, dx = Math.abs(best.x - p.x), ey = best.y - p.y;
    var near = Math.max(best.T.radius + R, 38 * AS), threat = best.state === 'attack' && dx < (best.T.boss ? 150 * AS : best.T.engage * 1.3);
    botKiteT -= dt;
    if (threat || dx < near) botKiteT = best.T.boss ? 450 : 250;
    var kite = botKiteT > 0;
    var tx = kite ? best.x - side * Math.max(keep * 1.6, dx + 40 * AS) : best.x - side * keep;
    var sv = Props.steer(p, R, tx, best.y, world, best.x), ex = sv.x - p.x, my = sv.y - p.y;
    if (Math.abs(ex) > 6) ax.x = Math.sign(ex);
    // 물러나다 화면 끝에 막혔으면 줄을 바꿔 옆으로 빠져나감
    if (kite && ((ax.x < 0 && p.x <= G.camX + 20 * AS) || (ax.x > 0 && p.x >= G.camX + LW - controlPad - 20 * AS))) { ax.x = 0; ax.y = p.y > (world.laneTop + world.laneBottom) / 2 ? -1 : 1; }
    else if (Math.abs(kite ? (best.y - p.y) : my) > 3) ax.y = kite ? 0 : Math.sign(my);
    // 보스가 공격 중이면 줄을 크게 바꿈(보스 공격은 위아래 폭이 좁음: 배치기·혀·돌진). 넓은 쪽으로
    if (threat && best.T.boss && Math.abs(best.y - p.y) < 34 * AS) {
      var mid = (world.laneTop + world.laneBottom) / 2;
      ax.y = best.y > mid ? -1 : 1; if (Math.abs(best.y - mid) < 4) ax.y = p.y >= best.y ? 1 : -1;
    }
    Input.setOverride(ax);
    botAtkT -= dt;
    if (botAtkT > 0 || Math.abs(ey) > 7) return;
    if (p.state !== 'attack' && p.state !== 'skill') p.dir = side;
    if (dx < 205 * AS && !kite) {   // 멀리서 기술
      var bk = Growth.book(G.classKey), n = bk ? bk.slots() : 2;
      for (var i = 0; i < n; i++) Input.pressSkill(Skills.slots[(i + Math.floor(Math.random() * n)) % n]);
    }
    if (dx < 100 * AS && !threat) { Input.pressAttack(); botAtkT = 140; }   // 지팡이 끝 거리면 콤보(적이 공격 중이면 안 함)
    else botAtkT = 100;
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
    if (intro) { introStep(realMs); return; }               // 보스 등장 컷인 동안: 게임 멈춤(2026-11-06 밤)
    if (G.hitstop > 0) { G.hitstop -= realMs; return; }   // 멈춤: 아무것도 안 움직임
    var dt = realMs * J.timeScale;
    if (G.slowT > 0) { G.slowT -= realMs; dt *= 0.3; }
    if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) comboEl.hidden = true; }
    var p = G.player;
    p.weaponKey = G.weaponKey;
    p.setMoveSet(G.moveSet);
    p.classKey = G.classKey; p.gender = G.charKey;   // 기술 고르기용
    p.atkSpd = Growth.atkSpd(); p.moveMul = Growth.moveMul();   // 민첩(성장 능력치): 휘두르기·이동 빠르기
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
        if (done[id] || !canHit(t, hc.step)) return;   // 죽었거나 넘어져 있으면(무적) 안 맞음. 크게 휘두르는 타(hitsDown)는 누운 적도
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
      xpStep();              // 쓰러진 적 → 경험치(성장)
      separate();
      propCollide();
      heldStep();            // 미라에게 붙잡힘: 잡은 적 앞에 붙여 둠
      shoveStep(dt);         // 마왕 각성 포효에 밀려남
      p.clamp(world);
      G.enemies.forEach(function (e) { if (e.alive()) e.keepInView(E); });
      G.enemies = G.enemies.filter(function (e) { return !e.remove; });
      E.enemies = G.enemies;
      rocksStep(dt);         // 골렘이 던진 바위 · 두꺼비가 뱉은 독 덩어리
      puddlesStep(dt);       // 두꺼비 독 웅덩이
      shotsStep(dt);         // 총잡이·선장 총알
      cannonsStep(dt);       // 선장 대포알
      spikesStep(dt);        // 서리 거인 얼음 가시
      ringsStep(dt);         // 마왕군 장군 화염 충격파 고리
      poisonStep(dt);        // 전갈 왕 독 · 독 웅덩이
      mpStep(dt);            // 마나 차기
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
    if (cannons.length) drawCannonsUnder(camX);   // 대포알 떨어질 자리 그림자 + 빨간 원
    if (shots.length) drawShots(camX, true);      // 총알 그림자(지나가는 줄)
    FX.draw(ctx, camX, true);
    if (MODE === 'stage') Props.drawUnder(ctx, camX, LW);   // 소품 그림자·모닥불 빛
    Skills.drawUnder(ctx, camX, G.player);        // 번개 떨어질 자리 표시
    // 깊이 순서(아래쪽 = 앞쪽)
    var ents = [{ y: G.player.y, d: function () { Skills.drawGhosts(ctx, camX); G.player.draw(ctx, camX, G.assets.weapons, DEBUG); } }];
    if (G.dummy) ents.push({ y: G.dummy.y, d: function () { G.dummy.draw(ctx, camX, DEBUG); } });
    G.enemies.forEach(function (e) { ents.push({ y: e.y + (e.alive() ? 0 : -0.5), d: function () { e.draw(ctx, camX, DEBUG); } }); });
    if (MODE === 'stage') Props.addDraw(ents, ctx, camX, LW, DEBUG);
    if (spikes.length) addSpikeDraw(ents, camX);   // 얼음 가시(땅에서 솟음 = 캐릭터와 깊이 순서)
    if (rings.length) addRingDraw(ents, camX);     // 화염 충격파 고리(바닥을 따라 퍼짐 = 캐릭터와 깊이 순서)
    ents.sort(function (a, b) { return a.y - b.y; });
    ents.forEach(function (e) { e.d(); });
    Projectiles.draw(ctx, camX);
    if (rocks.length) drawRocks(camX);            // 날아가는 바위(공중이라 캐릭터 위)
    if (shots.length) drawShots(camX, false);     // 날아가는 총알
    if (cannons.length) drawCannons(camX);        // 떨어지는 대포알
    Skills.drawOver(ctx, camX);                   // 번개 기둥·회전 원
    FX.draw(ctx, camX, false);
    Skills.drawFlash(ctx, LW, LH);                // 기술 맞는 순간 화면 번쩍
    drawIntro();                                  // 보스 등장 컷인(맨 위)

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
  ['pHp', 'pHpLag', 'pHpNum', 'pMp', 'pMpNum', 'pLv', 'pXp', 'bossBar', 'bHp', 'bHpLag', 'bossName', 'goPrompt', 'banner', 'stageInfo'].forEach(function (k) { hud[k] = document.getElementById(k); });
  var lastHud = {};
  function setIf(key, val, fn) { if (lastHud[key] !== val) { lastHud[key] = val; fn(val); } }
  function updateHud() {
    var p = G.player, S = G.stage;
    var pr = p.hp / p.maxHp;
    setIf('php', pr, function (v) { hud.pHp.style.width = (v * 100) + '%'; hud.pHpLag.style.width = (v * 100) + '%'; hud.pHp.classList.toggle('low', v < 0.3); });
    setIf('phpn', p.hp, function (v) { hud.pHpNum.textContent = v; });
    // 마나 막대(2026-11-06): 숫자는 정수로
    setIf('pmp', p.maxMp ? Math.floor(p.mp) / p.maxMp : 0, function (v) { hud.pMp.style.width = (v * 100) + '%'; });
    setIf('pmpn', Math.floor(p.mp), function (v) { hud.pMpNum.textContent = v; });
    // 레벨 + 경험치 막대(성장). 최고 레벨이면 「Lv 30 MAX」 + 막대 가득
    setIf('plv', Growth.lv, function (v) {
      hud.pLv.textContent = 'Lv ' + v + (Growth.isMax() ? ' MAX' : '');
      var box = hud.pLv.parentNode; box.classList.toggle('max', Growth.isMax());
      if (lastHud.plvSeen && v > lastHud.plvSeen) { box.classList.remove('up'); void box.offsetWidth; box.classList.add('up'); }
      lastHud.plvSeen = v;
    });
    setIf('pxp', Growth.isMax() ? 1 : Growth.xp / Growth.need(), function (v) { hud.pXp.style.width = (v * 100) + '%'; });
    setIf('pts', Growth.pts, statBadges);   // 안 쓴 능력치 점수 표시
    var bk = Growth.book(G.classKey);
    setIf('skpts', G.classKey + ':' + (bk ? bk.pts() : -1), skillBadges);   // 안 쓴 기술 점수 표시(견습 = 기술 버튼 숨김)
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
  //   10단계 마왕을 쓰러뜨림(S.ending) = 엔딩: 「ALL CLEAR!」 + 「마왕을 쓰러뜨렸다」 + 이 판 시간, 첫 판부터 「다음 스테이지」로 이어 왔으면 총 시간도
  //   run = 이어 하기 기록 { from: 시작한 판 id, ms: { 판 id: 깬 시간 } } — 고르기 화면·주소로 판을 고르면 새로 시작, 「다음 스테이지」·「다시 하기」는 이어 감
  function showResult(kind) {
    var S = G.stage, p = G.player;
    S.result = kind;
    Input.setOverride(null);
    var last = G.stageNo >= STAGES.length, clear = kind === 'clear', end = clear && !!S.ending;
    if (clear) saveCleared(CFG.stage.id);   // 깬 판 id 저장
    if (clear && G.run) G.run.ms[CFG.stage.id] = S.time;
    var tot = 0, full = !!G.run && G.run.from === STAGES[0].id;
    if (end && full) STAGES.forEach(function (st) { if (G.run.ms[st.id] != null) tot += G.run.ms[st.id]; else full = false; });
    document.getElementById('resTitle').textContent = !clear ? 'GAME OVER' : last || end ? 'ALL CLEAR!' : 'STAGE CLEAR!';
    resultEl.className = 'result ' + kind + (clear && (last || end) ? ' all' : '') + (end ? ' ending' : '');
    document.getElementById('resStats').innerHTML =
      (end ? '<span class="endline">마왕을 쓰러뜨렸다!</span>' + (full ? '1단계부터 총 시간 <b>' + fmtTime(tot) + '</b><br>' : '') : clear && last ? '모든 스테이지를 깼다!<br>' : '') +
      '시간 <b>' + fmtTime(S.time) + '</b> · 맞힌 수 <b>' + G.hits + '</b> · 최대 콤보 <b>' + G.maxCombo + '</b>' +
      (clear ? ' · 남은 체력 <b>' + p.hp + '</b>' : '') +
      '<br>얻은 경험치 <b>' + (G.xpGot || 0) + '</b> · <b>Lv ' + Growth.lv + '</b>';
    var nx = document.getElementById('btnNext');
    nx.hidden = !(clear && !last && !end);
    var focus = clear && !last && !end ? nx : clear ? document.getElementById('btnSel') : document.getElementById('btnRetry');
    // 전직(2026-11-06): 2단계 보스를 처음 깸 + 아직 직업 없음 → 전직 화면 먼저, 고르고 나면 결과 화면
    if (needClassChange()) { resultEl.hidden = true; openClassChange(function () { openMenu(resultEl, focus); }); }
    else openMenu(resultEl, focus);
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
    rocks.length = 0; puddles.length = 0; shots.length = 0; cannons.length = 0; spikes.length = 0; rings.length = 0; shove = null; intro = null;
    // 이어 하기 기록(엔딩 총 시간): 「다음 스테이지」·「다시 하기」로 온 것(G.keepRun)이 아니면 이 판부터 새로
    if (!G.keepRun || !G.run) G.run = { from: CFG.stage.id, ms: {} };
    G.keepRun = false;
    G.enemies = [];
    G.stage = newStage();
    G.ectx = makeEnemyCtx();
    G.xpGot = 0;   // 이 판에서 얻은 경험치(결과 화면)
    G.hits = 0; G.totalDmg = 0; G.maxCombo = 0; G.comboT = 0; G.hitstop = 0; G.slowT = 0; comboEl.hidden = true;
    var god = G.player && G.player.god;
    G.player = new Player(CFG);
    applyGrowth(G.player);
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
    if (needClassChange()) { G.paused = true; closeMenu(resultEl); openClassChange(openStageSelect); return; }   // 2단계를 깼는데 직업이 없음 → 전직 먼저
    var list = document.getElementById('stageList'), cleared = loadCleared(), focus = null;
    list.innerHTML = '';
    STAGES.forEach(function (st, i) {
      var n = i + 1, b = document.createElement('button'), open = isOpen(n), done = !!cleared[st.id];
      b.type = 'button'; b.className = 'sbtn' + (open ? '' : ' locked') + (done ? ' cleared' : '');
      b.disabled = !open;
      b.innerHTML = '<b>' + st.id + '</b><span>' + (open ? st.name.replace(/^STAGE\s*\d+\s*/, '') : '잠김') + '</span>' + (done ? '<i>클리어</i>' : '');
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
      grabPlayer: grabPlayer, grabMash: grabMash, releaseGrab: releaseGrab,   // 미라 잡기
      fireShot: fireShot, dropCannon: dropCannon,                              // 6단계 총알 · 대포알 (7단계 불덩이도 fireShot)
      spikeLine: spikeLine,                                                    // 5단계 서리 거인 얼음 가시 줄
      burnPlayer: burnPlayer,                                                  // 7단계 와이번 불 뿜기에 계속 서 있음
      drainPlayer: drainPlayer, mist: mistPuff,                                // 8단계 흡혈 백작 피 빨기 · 안개
      shockwave: shockwave,                                                    // 9단계 마왕군 장군 화염 충격파 고리
      pushPlayer: pushPlayer                                                   // 10단계 마왕 각성 포효(밀어냄)
    };
    Object.defineProperty(E, 'player', { get: function () { return G.player; } });
    return E;
  }

  // ---------- 고르기 버튼 ----------
  // 직업 버튼(견습/기사/법사)은 시험 도구(2026-11-06): 모든 판을 열어 둔 시험 기간(stagesAllOpen)에만 보임.
  //   눌러도 이번 창의 옷·무기만 바뀌고 저장된 직업(Growth.cls)은 그대로
  function bindToggles() {
    var seg = document.getElementById('classSeg');
    if (seg) seg.hidden = !CFG.stagesAllOpen;
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
    refreshGrowth();   // 직업마다 기본 체력이 다름(기사 +)
    return pr;
  }
  // ---------- 능력치 창 (2026-11-06, 수치 = config growth.stats, 계산·저장 = growth.js) ----------
  // 여는 곳: 경험치 막대 옆 「능력치」 · 스테이지 고르기 · 결과 화면. 여는 동안 게임 멈춤, 닫으면 원래대로(열려 있던 고르기·결과 화면으로 돌아감)
  //   + = 한 점 올리기, 자동 배분 = 남은 점수를 직업 비율대로(지금 입은 직업, 시험 버튼 포함), 초기화 = 올린 점수 전부 돌려받음(공짜)
  var statEl = document.getElementById('statPanel'), statBack = null;
  function pct(v) { return Math.round(v * 1000) / 10; }   // 0.096 → 9.6
  var STAT_INFO = {
    str: { name: '힘', en: 'STR', desc: '맨손·검 공격과 기사 기술이 세져요', now: function () { return '물리 공격 x' + Growth.atkMul(false).toFixed(2); } },
    agi: { name: '민첩', en: 'AGI', desc: '휘두르기·걷기가 빨라지고 가끔 치명타(' + CFG.growth.stats.critMul + '배)', now: function () {
      return '빠르기 +' + pct(Growth.atkSpd() - 1) + '% · 이동 +' + pct(Growth.moveMul() - 1) + '% · 치명타 ' + pct(Growth.critChance()) + '%'; } },
    vit: { name: '체력', en: 'VIT', desc: '최대 체력이 늘어요', now: function () { return '최대 체력 ' + Growth.maxHp(G.classKey); } },
    int: { name: '지능', en: 'INT', desc: '법사 마법(지팡이 타·마법탄·폭발·기술)이 세져요', now: function () { return '마법 공격 x' + Growth.atkMul(true).toFixed(2); } },
    wis: { name: '지혜', en: 'WIS', desc: '마나가 늘고 빨리 차요 (기술을 쓸 때 마나가 들어요)', now: function () {
      return '최대 마나 ' + Growth.maxMp(G.classKey) + ' · 초당 +' + (Math.round(Growth.mpRegen(G.classKey) * 10) / 10); } }
  };
  function statBadges() {
    var n = Growth.pts;
    document.querySelectorAll('.statbtn .badge, .statopen .badge').forEach(function (b) { b.hidden = !n; b.textContent = n > 99 ? '99+' : n; });
  }
  function renderStats() {
    var rows = document.getElementById('statRows'), focusK = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.k;
    document.getElementById('statPts').textContent = Growth.pts;
    document.getElementById('statSum').textContent = 'Lv ' + Growth.lv + ' · ' + ((CFG.classes[G.classKey] || {}).label || '');
    if (!rows.children.length) Growth.keys.forEach(function (k) {
      var I = STAT_INFO[k], r = document.createElement('div');
      r.className = 'srow';
      r.innerHTML = '<div class="sn"><b>' + I.name + '</b><small>' + I.en + '</small></div><div class="sv"></div><div class="sd">' + I.desc + '<em></em></div>' +
        '<button type="button" class="splus" data-k="' + k + '" aria-label="' + I.name + ' 올리기">+</button>';
      r.querySelector('.splus').addEventListener('click', function () { if (Growth.add(k)) { refreshGrowth(); renderStats(); } });
      rows.appendChild(r);
    });
    Growth.keys.forEach(function (k, i) {
      var r = rows.children[i];
      r.querySelector('.sv').textContent = Growth.stats[k];
      r.querySelector('em').textContent = STAT_INFO[k].now();
      r.querySelector('.splus').disabled = !Growth.pts;
    });
    var used = 0; Growth.keys.forEach(function (k) { used += Growth.stats[k]; });
    document.getElementById('btnStatAuto').disabled = !Growth.pts;
    document.getElementById('btnStatReset').disabled = !used;
    statBadges();
    // 점수를 다 써서 + 가 꺼지면 키보드 자리는 닫기로
    if (focusK && !Growth.pts && statEl.contains(document.activeElement)) document.getElementById('btnStatClose').focus();
  }
  function openStats() {
    if (!statEl.hidden) return;
    statBack = { menu: menuEl && !menuEl.hidden ? menuEl : null, paused: G.paused };
    G.paused = true; Input.setOverride(null);
    renderStats();
    openMenu(statEl, statEl.querySelector('.splus:not([disabled])') || document.getElementById('btnStatClose'));
  }
  function closeStats() {
    closeMenu(statEl);
    var B = statBack || {}; statBack = null;
    G.paused = !!B.paused;
    if (B.menu && !B.menu.hidden) openMenu(B.menu, B.menu.querySelector('.statopen'));
  }
  document.getElementById('btnStat').addEventListener('click', function () { openStats(); this.blur(); });
  document.querySelectorAll('.statopen').forEach(function (b) { b.addEventListener('click', function () { openStats(); }); });
  document.getElementById('btnStatAuto').addEventListener('click', function () { if (Growth.auto(G.classKey)) { refreshGrowth(); renderStats(); } });
  document.getElementById('btnStatReset').addEventListener('click', function () { Growth.reset(); refreshGrowth(); renderStats(); });
  document.getElementById('btnStatClose').addEventListener('click', closeStats);
  window.addEventListener('keydown', function (e) { if (e.code === 'Escape' && !statEl.hidden) { e.preventDefault(); closeStats(); } });
  G.openStats = openStats; G.closeStats = closeStats;

  // ---------- 기술 창 (2026-11-06 성장 4단계, 수치 = config skills · SKILL_TREE, 계산·저장 = growth.js 의 기술 책 Growth.book) ----------
  // 여는 곳: 「능력치」 옆 「기술」 · 스테이지 고르기 · 결과 화면(견습은 버튼이 안 보임). 여는 동안 게임 멈춤, 닫으면 원래대로
  //   위 = 기술 칸 4개(Lv13 전엔 2개, 키 이름 표시), 아래 = 기술 10개: 쓰는 기술(마나·쿨타임·위력) / 늘 켜진 기술 / 잠김(Lv N) / 준비 중
  //   + = 기술 점수 1점으로 Lv +1(최고 5), 칸 번호(1~4) = 그 칸에 끼우기(다른 칸에 있으면 자리 바꿈), 초기화 = 기술 점수 전부 돌려받음(공짜)
  var skEl = document.getElementById('skillPanel'), skBack = null;
  // 칸 i 의 이름: 키보드 = config keys.skillA~D 의 첫 키(KeyU → U), 손가락 화면(폰) = 1~4
  function slotKey(i) {
    if (window.matchMedia && matchMedia('(pointer: coarse)').matches) return String(i + 1);
    var k = CFG.keys['skill' + Skills.slots[i]]; return k && k[0] ? k[0].replace(/^Key/, '') : '';
  }
  function skillBadges() {
    var bk = Growth.book(G.classKey), n = bk ? bk.pts() : 0;
    document.querySelectorAll('.skbtn, .skopen').forEach(function (b) { b.hidden = !bk; });
    document.querySelectorAll('.skbtn .badge, .skopen .badge').forEach(function (b) { b.hidden = !n; b.textContent = n > 99 ? '99+' : n; });
  }
  function secTxt(ms) { var s = Math.round(ms / 100) / 10; return (s % 1 ? s.toFixed(1) : s) + '초'; }
  function pctTxt(v) { return Math.round(v * 100) + '%'; }
  // 기술 한 줄 설명 숫자: 쓰는 기술 = 마나·쿨타임·위력(+ 다음 Lv), 늘 켜진 기술 = 지금 값(+ 다음 Lv)
  function skillNums(bk, e, d, lv) {
    var max = CFG.skills.maxLv || 5, show = Math.max(1, lv);
    if (d) {
      var L = Skills.lvStat(d, show), N = show < max ? Skills.lvStat(d, show + 1) : null;
      var t = 'MP ' + L.mp + ' · 쿨타임 ' + secTxt(L.cd) + ' · 위력 ' + pctTxt(L.dmg);
      if (N && lv) t += '  →  Lv' + (show + 1) + ': MP ' + N.mp + ' · ' + secTxt(N.cd) + ' · ' + pctTxt(N.dmg);
      return t;
    }
    var P = e.passive, k = { phys: '물리 공격 +', magic: '마법 공격 +', guard: '받는 피해 -', mpRegen: '마나 회복 +' }[P.stat] || '';
    return k + pctTxt(P.val[show - 1]) + (show < max && lv ? '  →  Lv' + (show + 1) + ': ' + k + pctTxt(P.val[show]) : '');
  }
  function renderSkills() {
    var bk = Growth.book(G.classKey);
    if (!bk) { if (!skEl.hidden) closeSkills(); return; }
    var focusK = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.sk : null;
    var max = CFG.skills.maxLv || 5, S = CFG.skills[bk.cls], pts = bk.pts(), slots = bk.slots();
    document.getElementById('skPts').textContent = pts;
    document.getElementById('skSum').textContent = 'Lv ' + Growth.lv + ' · ' + ((CFG.classes[G.classKey] || {}).label || '') +
      (bk.test ? ' · 시험 기술(저장 안 함)' : '');
    // 기술 칸
    var bar = document.getElementById('skBar'), allSlots = (CFG.skills.slots || [2, 4]);
    bar.innerHTML = '';
    for (var i = 0; i < allSlots[allSlots.length - 1]; i++) {
      var id = bk.at(i), d = id && S[id], c = document.createElement('div');
      c.className = 'skslot' + (i >= slots ? ' locked' : '') + (d ? ' on' : '');
      c.innerHTML = '<kbd>' + slotKey(i) + '</kbd><span class="ic">' + (d ? d.icon : '') + '</span><small>' +
        (d ? d.name : i >= slots ? 'Lv' + (CFG.skills.moreLv || 13) + '에 열림' : '빈 칸') + '</small>';
      bar.appendChild(c);
    }
    // 기술 목록
    var rows = document.getElementById('skRows');
    rows.innerHTML = '';
    bk.list().forEach(function (e) {
      var d = S[e.id] && S[e.id].name ? S[e.id] : null, act = bk.isActive(e.id), lv = bk.lv(e.id), open = bk.unlocked(e.id);
      var name = d ? d.name : e.name, icon = d ? d.icon : e.icon, desc = d ? d.desc : e.desc;
      var r = document.createElement('div');
      r.className = 'skrow' + (e.soon ? ' soon' : !open ? ' lockedrow' : '') + (act ? ' act' : ' pas');
      var tag = e.soon ? '준비 중' : !open ? 'Lv ' + e.unlock + '에 열려요' : 'Lv ' + lv + ' / ' + max;
      var kind = e.passive ? '늘 켜짐' : '쓰는 기술';
      var html = '<div class="ki">' + (icon || '?') + '</div><div class="km"><b>' + name + '</b><span class="kk">' + kind + '</span><span class="kl">' + tag + '</span>' +
        '<p>' + (desc || '') + '</p>';
      if (!e.soon) html += '<em>' + skillNums(bk, e, d, lv) + '</em>';
      if (d && d.lv5 && d.lv5.say && !e.soon) html += '<i class="k5' + (lv >= max ? ' got' : '') + '">Lv5: ' + d.lv5.say + '</i>';
      html += '</div><div class="kc">';
      if (act && open) for (var j = 0; j < slots; j++) {
        html += '<button type="button" class="kslot' + (bk.at(j) === e.id ? ' on' : '') + '" data-sk="' + e.id + ':s' + j + '" aria-label="' + name + ' ' + (j + 1) + '번 칸에 끼우기">' + slotKey(j) + '</button>';
      }
      html += '</div><button type="button" class="splus" data-sk="' + e.id + ':+" aria-label="' + name + ' 올리기"' +
        (pts > 0 && open && lv < max ? '' : ' disabled') + '>+</button>';
      r.innerHTML = html;
      rows.appendChild(r);
    });
    rows.querySelectorAll('button[data-sk]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.dataset.sk.split(':'), bk2 = Growth.book(G.classKey);
        if (!bk2) return;
        if (a[1] === '+') bk2.add(a[0]); else bk2.put(+a[1].slice(1), a[0]);
        refreshGrowth(); renderSkills();
      });
    });
    document.getElementById('btnSkReset').disabled = !bk.used();
    skillBadges();
    // 다시 그린 뒤 키보드 자리 되돌리기(+ 가 꺼졌으면 닫기로)
    var fb = focusK && rows.querySelector('button[data-sk="' + focusK + '"]:not([disabled])');
    if (fb) fb.focus({ preventScroll: true });
    else if (focusK && skEl.contains(document.activeElement) === false) document.getElementById('btnSkClose').focus({ preventScroll: true });
  }
  function openSkills() {
    if (!skEl.hidden || !Growth.book(G.classKey)) return;
    skBack = { menu: menuEl && !menuEl.hidden ? menuEl : null, paused: G.paused };
    G.paused = true; Input.setOverride(null);
    renderSkills();
    openMenu(skEl, skEl.querySelector('.splus:not([disabled])') || document.getElementById('btnSkClose'));
  }
  function closeSkills() {
    closeMenu(skEl);
    var B = skBack || {}; skBack = null;
    G.paused = !!B.paused;
    if (B.menu && !B.menu.hidden) openMenu(B.menu, B.menu.querySelector('.skopen'));
  }
  document.getElementById('btnSkill').addEventListener('click', function () { openSkills(); this.blur(); });
  document.querySelectorAll('.skopen').forEach(function (b) { b.addEventListener('click', function () { openSkills(); }); });
  document.getElementById('btnSkReset').addEventListener('click', function () { var bk = Growth.book(G.classKey); if (bk) { bk.reset(); refreshGrowth(); renderSkills(); } });
  document.getElementById('btnSkClose').addEventListener('click', closeSkills);
  window.addEventListener('keydown', function (e) { if (e.code === 'Escape' && !skEl.hidden) { e.preventDefault(); closeSkills(); } });
  G.openSkills = openSkills; G.closeSkills = closeSkills;
  // 마나가 모자라 기술이 안 나감: 머리 위 「MP 부족」(파란 작은 글자) + 그 칸 버튼이 잠깐 흔들림 (skills.js pick 이 부름, 너무 자주는 안 띄움)
  function noMp(slot) {
    var p = G.player;
    FX.damage(p.x, p.y - (p.z || 0) - 118 * AS, 'MP 부족', false, J, null, 'nomp', 'player:nomp');
    Skills.shakeSlot(slot);
  }

  // ---------- 전직 (2026-11-06, 설계안 3번 · config growth.classChangeStage / classChange) ----------
  // 뜨는 때: 판 모드 + 아직 직업 없음(Growth.cls) + 전직 판(2단계)을 깬 저장. 시험 자동 조종(?bot=1)은 안 띄움(멈추지 않게)
  //   → 2단계 보스를 처음 깬 결과 화면 직전 · 이미 깬 저장이면 다음 스테이지 고르기·바로 시작(?stage=N) 때. 고르면 Growth.cls 가 생겨 다시는 안 뜸
  function needClassChange() { return MODE === 'stage' && !G.bot && !Growth.cls && isCleared(CFG.growth.classChangeStage); }
  var classEl = document.getElementById('classSel'), classAnim = 0;
  // 카드 속 움직이는 모습: 그 직업 옷(지금 성별) + 직업 무기를 든 작은 플레이어를 숨 쉬는(idle) 그림으로 계속 그림
  function classPreview(cv, k) {
    var c = CFG.classes[k], key = c.outfit + '_' + G.charKey, g = cv.getContext('2d');
    cv.width = 240; cv.height = 240;   // 75 x 75 도트를 3.2배 점으로(작은 카드에서도 크게, HD 그림이라 또렷함)
    return Assets.ensureChar(CFG.art.characters[key] ? key : G.charKey).then(function (a) {
      if (!a) return null;
      bakeFilter(a);
      var p = new Player(CFG);
      p.setCharacter(a); p.weaponKey = classWeapon(c); p.moveSet = c.moves;
      p.x = 33; p.y = 71; p.dir = 1;
      return function (dt) {
        p.animT += dt / 1000;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
        g.setTransform(3.2, 0, 0, 3.2, 0, 0); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        p.draw(g, 0, G.assets.weapons, false);
      };
    });
  }
  // 이름 뒤 「로/으로」: 받침이 있으면(ㄹ 받침 빼고) 으로 (기사로 / 법사로 / 소환사로)
  function josaRo(name) {
    var c = name.charCodeAt(name.length - 1), j = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 : 0;
    return name + (j && j !== 8 ? '으로' : '로');
  }
  // 전직 화면 열기. after = 고른 뒤 할 일(결과 화면 / 스테이지 고르기 / 게임 계속). 고르는 동안 게임은 멈춤
  function openClassChange(after) {
    var list = document.getElementById('classList'), ok = document.getElementById('btnClassOk'), pick = null, draws = [];
    var wasPaused = G.paused;
    G.paused = true; Input.setOverride(null);
    list.innerHTML = '';
    ok.disabled = true; ok.textContent = '직업을 골라 주세요';
    (CFG.classChange || []).forEach(function (q) {
      var b = document.createElement('button');
      b.type = 'button';
      if (q.soon) {   // 준비 중: 회색, 누를 수 없음
        b.className = 'ccard soon'; b.disabled = true;
        b.innerHTML = '<div class="ph">?</div><b>' + q.name + '</b><span class="tag">준비 중</span><span class="d">' + q.desc + '</span>';
      } else {
        b.className = 'ccard'; b.dataset.k = q.key;
        b.innerHTML = '<canvas></canvas><b>' + q.name + '</b><span class="wp">(' + q.weapon + ')</span><span class="d">' + q.desc + '</span>';
        classPreview(b.querySelector('canvas'), q.key).then(function (d) { if (d) draws.push(d); });
        b.addEventListener('click', function () {
          pick = q;
          list.querySelectorAll('.ccard').forEach(function (x) { x.classList.toggle('on', x === b); });
          ok.disabled = false; ok.textContent = josaRo(q.name) + ' 전직하기 · 바꿀 수 없어요';
        });
      }
      list.appendChild(b);
    });
    ok.onclick = function () {
      if (!pick) return;
      Growth.setClass(pick.key);   // 저장칸에 직업 저장(한 번만)
      setClass(pick.key);          // 옷·무기·콤보 바꿈
      cancelAnimationFrame(classAnim); classAnim = 0;
      closeMenu(classEl);
      G.paused = wasPaused;
      banner(josaRo(pick.name) + ' 전직했다!', 'small');
      Skills.flash({ color: '#fff3b0', alpha: 0.45, ms: 420 });
      ok.blur();
      if (after) after();
    };
    var lastT = 0;
    (function anim(now) {
      var dt = lastT ? Math.min(100, now - lastT) : 0; lastT = now;
      draws.forEach(function (d) { d(dt); });
      classAnim = requestAnimationFrame(anim);
    })(performance.now());
    openMenu(classEl, list.querySelector('.ccard:not([disabled])'));
  }
  G.openClassChange = function () { openClassChange(null); };

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
    // 적 하나 바로 세우기(기술 시험, 2026-11-06): 플레이어 앞 dx, 위아래 dy 도트. 돌려주는 값 = 그 적
    spawn: function (type, dx, dy) {
      var p = G.player, e = makeEnemy(type, p.x + (dx || 60), clamp(p.y + (dy || 0), world.laneTop, world.laneBottom));
      e.entered = true; e.dir = e.x > p.x ? -1 : 1;
      return e;
    },
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
    //   slot = 'A'~'D' 또는 0~3, noCd = 쿨타임 무시, 마나는 그대로 듦(GAME.test.mp(999) 로 채움)
    skill: function (slot, noCd) { if (noCd) G.player.skillCd = {}; Input.pressSkill(typeof slot === 'number' ? Skills.slots[slot] : slot || 'A'); },
    mp: function (n) { var p = G.player; p.mp = Math.max(0, Math.min(p.maxMp, n == null ? p.maxMp : n)); return p.mp; },
    // 기술 책 시험(2026-11-06, ?lv=N 일 때만): 이번 창에서만 그 직업으로 전직한 저장처럼 + 기술 점수를 계획(config skills.botPlan)대로
    skillSetup: function (cls, clsLv, plan) { var r = Growth.testSetup(cls, clsLv, plan); refreshGrowth(); return r; },
    resetCd: function () { G.player.skillCd = {}; },
    hurt: function (n, heavy) { var p = G.player; p.invulnT = 0; p.takeHit(n || 10, -p.dir, 10, 0, !!heavy); },
    god: function (on) { G.player.god = on !== false; },
    // 경험치 바로 주기(성장 시험): GAME.test.xp(500)
    xp: function (n) { var up = Growth.gain(n); if (up > 0) onLevelUp(up); return { lv: Growth.lv, xp: Growth.xp, need: Growth.need() }; },
    // 치명타 고정(true = 늘 / false = 안 남 / null = 확률대로): GAME.test.crit(true)
    crit: function (v) { G.forceCrit = v == null ? null : !!v; },
    // 능력치 바로 바꾸기(시험): GAME.test.stats({ str: 10 }) → 남은 점수에서 뺌(모자라면 있는 만큼)
    stats: function (o) { Object.keys(o || {}).forEach(function (k) { Growth.add(k, o[k]); }); refreshGrowth(); return { stats: Growth.stats, pts: Growth.pts }; },
    bot: function (on) { G.bot = on !== false; if (!G.bot) Input.setOverride(null); },
    retry: function () { resetStage(); },
    // 판 바로 가기: GAME.test.stage(2) (판 번호 = id, ?stage= 와 같음) / 고르기 화면 열기: GAME.test.select()
    stage: function (n) { return goStage(stageIndexOfId(n) || n); },   // n = 판 번호(id)
    select: function () { openStageSelect(); },
    info: function () {
      var S = G.stage, p = G.player;
      return { mode: MODE, stageNo: G.stageNo, paused: G.paused, LW: LW, LH: LH, scale: SCALE, rs: RS, hd: Assets.isHD(),
 controlPad: controlPad, char: G.player.char && G.player.char.def.anims.idle.frames[0], camX: Math.round(G.camX), wave: S ? S.next : null, locked: S ? S.locked : null,
        waveIdx: S ? S.waveIdx : null, rescued: S ? S.rescued || 0 : 0, time: S ? Math.round(S.time) : null, result: S ? S.result : null,
        player: { hp: p.hp, state: p.state, x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z * 10) / 10,
          frame: p.char ? p.currentFrame() : null, ratk: p.ratk ? p.ratk.phase : null, skill: p.sk ? p.sk.d.key + '@' + Math.round(p.sk.t) : null, cd: p.skillCd },
        enemies: G.enemies.map(function (e) { return e.type + (e.variant ? '(' + e.variant + ')' : '') + ':' + (e.asleep ? 'asleep' : e.alertT > 0 ? 'alert' : e.state) +
          (e.atk && (e.atk.spec.type === 'burrow' || e.atk.spec.type === 'dive' || e.atk.spec.type === 'teleport') ? '/' + e.atk.phase : '') + (e.faded() ? '/faded' : '') + (e.hidden ? '/hidden' : '') + (e.atk && e.atk.held ? '/hold' : '') + (e.atk ? '/' + e.atk.name : '') + (e.airborne() ? '/air' : '') + ':' + e.hp + '@' + Math.round(e.x) + ',' + Math.round(e.y); }),
        poison: p.poison ? Math.round(p.poison.t) : 0, ending: S ? !!S.ending : false,
        run: G.run ? { from: G.run.from, ms: G.run.ms } : null,
        lv: Growth.lv, xp: Growth.xp, need: Growth.need(), xpGot: G.xpGot || 0, maxHp: p.maxHp, atkMul: Growth.atkMul(), magMul: Growth.atkMul(true),
        stats: Growth.stats, pts: Growth.pts, cls: Growth.cls, mp: Math.round(p.mp * 10) / 10, maxMp: p.maxMp, atkSpd: p.atkSpd, moveMul: p.moveMul, crit: Growth.critChance(), crits: G.crits || 0,
        hits: G.hits, maxCombo: G.maxCombo, rocks: rocks.length, puddles: puddles.length, shots: shots.length, cannons: cannons.length, spikes: spikes.length, rings: rings.length, stageId: CFG.stage.id,
        shotsX: shots.filter(function (b) { return !(b.wait > 0); }).map(function (b) { return Math.round(b.x); }),
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
  // 처음 직업 = 저장칸에 전직한 직업(없으면 견습)
  G.classKey = Growth.cls || CFG.defaultClass || 'novice';
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
      canHit: canHit,        // 이 판정에 맞을 수 있나(누운 적 = hitsDown 만)
      dust: function (x, y, dir) { if (G.assets.dust && G.assets.dust.length) FX.sprite(x, y, G.assets.dust, CFG.dust.fps, CFG.dust.pivot, dir > 0, true); },
      fx: function () { return G.assets.fx; },
      hitstop: function (ms) { G.hitstop = Math.max(G.hitstop, ms); },
      slow: function (ms) { G.slowT = Math.max(G.slowT, ms); },
      noMp: noMp             // 마나가 모자라 기술이 안 나감(2026-11-06)
    });
    Object.keys(assets.characters).forEach(function (k) { bakeFilter(assets.characters[k]); });
    document.body.classList.add('mode-' + MODE);
    G.player = new Player(CFG);
    applyGrowth(G.player);
    if (MODE === 'practice') G.dummy = new Dummy(CFG, assets.dummy);
    resize();
    G.player.y = Math.round((world.laneTop + world.laneBottom) / 2);
    if (G.dummy) G.dummy.y = G.player.y;
    G.camX = Math.max(0, G.player.x - LW * 0.42);
    setChar('male'); setClass(Growth.cls || CFG.defaultClass || 'novice');
    if (MODE === 'stage') {
      hudEl.hidden = false;
      // 처음: 고르기 화면(뒤에 그 판이 멈춰 보임). ?stage=N 이나 ?bot=1 이면 바로 시작
      var pick = !urlStage && !G.bot;
      resetStage(pick);
      document.getElementById('btnRetry').addEventListener('click', function () { closeMenu(resultEl); G.keepRun = true; resetStage(); this.blur(); });
      document.getElementById('btnNext').addEventListener('click', function () { closeMenu(resultEl); G.keepRun = true; goStage(G.stageNo + 1); this.blur(); });
      document.getElementById('btnSel').addEventListener('click', function () { openStageSelect(); this.blur(); });
      if (params.get('god') === '1') G.player.god = true;
      if (pick) openStageSelect();
      else if (needClassChange()) openClassChange(null);   // ?stage=N 으로 바로 시작했는데 전직 안 한 저장(2단계 깸)
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
