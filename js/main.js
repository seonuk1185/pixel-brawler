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
  // 깬 판 저장(2026-11-06 난이도): 저장칸에 난이도마다 따로(growth.js Growth.cleared · markCleared). 예전 깬 판 목록(pixelBrawler.clearedIds)은 growth.js 가 이지로 옮김
  //   아래 세 이름은 예전 그대로 = 「지금 난이도」의 깬 판
  function loadCleared() { return Growth.cleared(); }
  function isCleared(id) { return Growth.isCleared(id); }
  function saveCleared(id) { return Growth.markCleared(id); }   // 다음 난이도가 새로 열렸으면 그 key
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
      SCALE = Math.max(1, Math.min(Math.floor(ph / CFG.view.targetH), Math.floor(pw / (CFG.view.minLandW || 1))));
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
  //   2026-11-06 폰 UI(반달 배치): 점프가 공격 왼쪽 아래(걷는 길 안)로 옮겨 가서, 재면 비우는 폭이 두 배가 됨 → 공격 버튼만 잼
  //   (예전 폭 ≈ 공격 버튼 폭 그대로. 점프·기술·각성 버튼은 반투명이라 밑의 캐릭터가 보임)
  function measureControlPad() {
    var c = canvas.getBoundingClientRect();
    if (!c.width || !c.height) return 0;
    var ky = c.height / LH;
    var laneT = c.top + world.laneTop * ky - 30 * AS * ky, laneB = c.top + world.laneBottom * ky;    // 발 띠 + 몸 조금
    var pad = 0;
    ['btnAtk'].forEach(function (id) {
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
    hitstop: 0, hits: 0, mh: { n: 0, shake: 0, skill: null, x: 0, y: 0 }, mk: { n: 0, t: 0 }, callout: null, comboHits: 0, comboT: 0, maxCombo: 0, totalDmg: 0, camX: 0, slowT: 0,
    // 콤보 기록(2026-11-06 밤, 시험·결과용): launch = 띄움, air = 공중 타, otg = 누운 적 타, cancel = 캔슬(평타→기술 / 기술→기술), maxAirMs = 가장 오래 뜬 시간
    cstats: { launch: 0, air: 0, otg: 0, cancel: 0, maxAirMs: 0, maxAirHits: 0 }, comboTagTxt: '', comboTagT: 0,
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
  // 효과음(2026-11-07, js/sfx.js): 이름 하나로 소리. 소리 장치가 없거나 꺼져 있으면 그냥 지나감
  function snd(name, opts) { if (window.SFX) SFX.play(name, opts); }

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
    if (!W.magic && !target.isProp) pas += Skills.gritBonus(p);   // 늘 켜진 기술 「투지」(2차, 2026-11-06): 체력이 적을수록 물리 공격 +
    //   2026-11-06 첫 무기 몽둥이: 견습 맨손 타 × (1 + config club.atk) (주웠을 때만, clubMul)
    var dmg = Math.round(rand(W.damage[0], W.damage[1]) * st.dmg * (target.isProp ? 1 : Growth.atkMul(!!W.magic) * (1 + pas) * ((src && src.mul) || 1) * clubMul(src ? src.wk : p.weaponKey)));
    // 치명타(민첩, 2026-11-06): 적·허수아비를 때릴 때 확률 Growth.critChance() → 데미지 x critMul + 큰 주황 숫자(agicrit). GAME.test.crit 로 시험 고정
    var crit = !target.isProp && (G.forceCrit != null ? G.forceCrit : Math.random() < Growth.critChance());
    if (crit) dmg = Math.round(dmg * CFG.growth.stats.critMul);
    if (G.awk && !target.isProp) dmg = Math.round(dmg * CFG.awaken.atkMul);   // 각성: 공격 +30%(2026-11-06 밤)
    if (!target.isProp) dmg = Math.round(dmg * Skills.brandMul(p, target));   // 늘 켜진 기술 「원소 낙인」(2차): 낙인 찍힌 적은 더 아프게
    // 소품(상자·통): 단계만 넘김(데미지 숫자·콤보 수 없음). 기술(damageStyle) = 한 번에 부서짐, 맞은 곳 = 마법이면 그 자리, 아니면 몸 앞
    if (target.isProp) {
      Props.hit(target, { dmg: dmg, strong: !!st.damageStyle, finisher: !!st.finisher, dir: dir,
        x: src ? src.x : p.x + p.dir * 30 * AS, y: src ? src.y : p.y - (p.z || 0) + (st.hitY != null ? st.hitY : -40 * AS) });
      snd('hit', { v: 0.55, k: 1.35 });   // 상자·통: 가볍게
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
    var shk = J.shakePx * W.shakeMul * st.shake * (heavyHit ? IM.heavyShake || 1 : IM.lightShake || 1);
    FX.shake(shk, J.shakeMs * (st.finisher ? 1.5 : 1));
    if (target !== G.dummy) { var MH = G.mh; MH.n++; MH.shake = Math.max(MH.shake, shk); if (st.damageStyle) MH.skill = st.damageStyle; MH.x += target.x; MH.y += target.y - target.T.height * 0.45; }   // 여러 마리 한꺼번에(사냥 손맛, 장면 끝에 multiHitFx)
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
      var wasAir = target.state === 'air';   // 띄워진 잡몹을 침(콤보 글자 「AIR」)
      if (otg) dmg = Math.max(1, Math.round(dmg * (CFG.ai.otg.dmgMul != null ? CFG.ai.otg.dmgMul : 1)));
      var res = target.takeHit(dmg, dir, knock, !!st.finisher && !st.noKnockdown, { heavy: heavy, stunMs: st.stunMs, noJuggle: !!st.noJuggle, flashK: st.flashK != null ? st.flashK : (heavyHit ? IM.flashHeavy || 1 : 1), otg: otg, launch: st.launch || 0 });   // stunMs = 번개 기술, launch = 띄우기(ai.air)
      // 콤보 기록·글자(2026-11-06 밤): 띄움 / 공중 타 / 누운 적 타
      var CS = G.cstats;
      if (res === 'launch') { CS.launch++; comboTag('LAUNCH'); }
      else if (wasAir && res) { CS.air++; comboTag('AIR'); }
      else if (otg && res) { CS.otg++; comboTag('OTG'); }
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
      if (res && res !== 'dead') Skills.brandMark(p, target, st);   // 원소 낙인(2차): 기술 마법에 맞은 적에게 낙인
      if (res === 'dead' && target.T.boss) onBossDown(target);
      else if (res === 'dead') { G.hitstop = Math.max(G.hitstop, J.hitstopMs * 1.6); onKill(target); }
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
    var FLC = st.damageStyle && J.flashy && J.flashy.hitBits && J.flashy.cols[st.damageStyle];   // 기술에 맞음: 기술 색 불티 더(2026-11-06 밤)
    if (FLC && Skills.debris) Skills.debris(hx, hy, target.y, J.flashy.hitBits, { cols: FLC, glow: true, sp: 210, size: 1.6, ms: 420 });
    if (heavyHit && !otg && IM.glow && Skills.glow) Skills.glow(hx, hy, (IM.glowR || 30) * AS * Math.max(0.8, sc), W.sparkColor || '#fff2c8', 170, IM.glow);   // 무거운 타: 맞은 곳 둥근 빛
    // 숫자: crit = 마무리 모양(「22!」), numStyle = 숫자 모양만 따로(달리며 공격 작은 타 = push). 마지막 = 대상(같은 대상 숫자는 위로 쌓임)
    //   각성 중(2026-11-06 밤) = 숫자 크게 직업 색(damageText.awk_직업)
    FX.damage(target.x, topY, dmg, crit || !!(st.finisher || st.crit || (st.damageStyle && st.knockdown)), J, null, G.awk ? 'awk_' + G.awk.cls : crit ? 'agicrit' : st.numStyle || st.damageStyle, target.id || 'dummy', !!st.mergeNum && !crit);
    if (crit) G.crits = (G.crits || 0) + 1;
    // 효과음: 치명타 = 「퍽+팅」, 무거운 타 = 묵직하게, 기술에 맞음 = 조금 작게(기술 소리가 따로 남). 한꺼번에 여러 마리여도 sfx.js 가 몇 개만 냄
    if (crit) snd('crit'); else snd(heavyHit ? 'hitHeavy' : 'hit', st.damageStyle ? { v: 0.75 } : null);
    vibrate(Math.round(J.vibrateMs * (st.finisher ? 2 : 1)));
    G.hits++; G.totalDmg += dmg;
    // 분노(2026-11-06 밤): 평타 +2 · 기술 +4(공중·누운 적 타도). 각성 광전사 = 준 데미지 x lifesteal 만큼 체력(머리 위 초록 숫자는 합쳐서)
    G.combatT = 0;
    if (!st.noRage) rageAdd(st.damageStyle ? CFG.rage.skillHit : CFG.rage.hit);
    if (G.awk && G.awk.A.lifesteal && p.state !== 'dead') {
      var ls = Math.min(p.maxHp - p.hp, Math.max(1, Math.round(dmg * G.awk.A.lifesteal)));
      if (ls > 0) { p.hp += ls; FX.damage(p.x, p.y - (p.z || 0) - 112 * AS, ls, false, J, null, 'heal', 'player:ls', true); }
    }
    p.mp = Math.min(p.maxMp, p.mp + CFG.growth.mp.onHit);   // 마나: 맞힐 때마다 조금 참
    G.comboHits = G.comboT > 0 ? G.comboHits + 1 : 1;
    G.maxCombo = Math.max(G.maxCombo, G.comboHits);
    G.comboT = 1200;
    showCombo();
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // ---------- 사냥 손맛 연출 (2026-11-07, config hunt) ----------
  // 여러 마리 한꺼번에(multiHit): onHit 이 한 장면 동안 맞은 적 수(G.mh)를 모음 → 장면 끝에 마리 수만큼 더 흔들림·멈춤, 기술이면 무리 가운데 큰 빛
  function newMh() { return { n: 0, shake: 0, skill: null, x: 0, y: 0 }; }
  function multiHitFx() {
    var MH = G.mh, M = huntPart('multiHit');
    G.mh = newMh();
    if (!M || MH.n < (M.from || 2)) return;
    var k = Math.min(M.shakeCap || 2, 1 + (M.shake || 0) * (MH.n - 1));
    FX.shake(MH.shake * k, J.shakeMs * 1.4);
    G.hitstop += Math.min(M.stopCap || 0, (M.stopMs || 0) * (MH.n - 1));
    if (MH.skill && MH.n >= (M.bloomAt || 3)) {
      var cx = MH.x / MH.n, cy = MH.y / MH.n, FC = (J.flashy && J.flashy.cols[MH.skill]) || ['#ffffff', '#fff2c0'];
      if (Skills.glow) Skills.glow(cx, cy, (M.bloomR || 80) * AS * Math.min(1.6, 0.8 + MH.n * 0.1), FC[1] || FC[0], M.bloomMs || 240, M.bloomA || 0.5);
      if (M.flash) Skills.flash(M.flash);
    }
  }
  // 몇 마리 잡기(multiKill): 마지막으로 잡은 뒤 windowMs 안에 또 잡으면 이어서 셈 → 「5 KILL!」 + 마리 문턱마다 짧은 슬로모션
  function onKill(e) {
    var MK = huntPart('multiKill'); if (!MK) return;
    var K = G.mk;
    K.n = K.t > 0 ? K.n + 1 : 1; K.t = MK.windowMs || 600;
    G.kills = (G.kills || 0) + 1;
    if (K.n < (MK.min || 3)) return;
    G.callout = { txt: K.n + ' KILL!', t: 0, life: MK.showMs || 900, n: K.n };
    G.bestKill = Math.max(G.bestKill || 0, K.n);
    if (K.n === (MK.min || 3) || (MK.slow || []).some(function (q) { return q[0] === K.n; })) snd('multiKill', { n: K.n });   // 「띠링」: 처음 3마리 + 5 · 8 · 12 마리
    (MK.slow || []).forEach(function (q) { if (K.n === q[0]) { G.slowT = Math.max(G.slowT, q[1]); FX.shake(J.shakePx * (MK.shake || 1), 220); } });
  }
  // 「5 KILL!」 글자: 화면 위 가운데(진짜 시간). 처음에 크게 튀어나왔다가 줄어들고, 끝에서 흐려짐
  function drawCallout() {
    var C = G.callout; if (!C) return;
    var st = CFG.damageText.multikill, k = C.t / C.life, pk = 0.14;
    if (k >= 1) { G.callout = null; return; }
    if (k < pk && st.pop) { var s2 = {}, kk; for (kk in st) if (kk !== 'pop') s2[kk] = st[kk]; for (kk in st.pop) s2[kk] = st.pop[kk]; st = s2; }
    var z = (st.zoom || 1) * (1 + Math.min(0.4, (C.n - 3) * 0.04)) * (k < pk ? 1 + 0.5 * (1 - k / pk) : 1);
    var x = LW / 2, y = Math.round(LH * 0.32);
    ctx.save(); ctx.globalAlpha = k > 0.72 ? Math.max(0, 1 - (k - 0.72) / 0.28) : 1;
    ctx.translate(x, y); ctx.scale(z, z); ctx.translate(-x, -y);
    FX.drawPixelText(ctx, C.txt, x, y - 8, st);
    ctx.restore();
  }
  // 경험치 구슬(orbs): 튀어나옴 → delayMs 뒤 플레이어 쪽으로 점점 빨라지며 빨려 듦. 닿으면 작은 반짝임. 최대 max 개
  var orbs = [];
  function spawnOrbs(x, y, OB) {
    var n = OB.n[0] + Math.floor(Math.random() * (OB.n[1] - OB.n[0] + 1));
    n = Math.min(n, (OB.max || 60) - orbs.length);
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (Math.random() * 2 - 1) * 1.3, sp = OB.spd * AS / 0.55 * (0.6 + Math.random() * 0.7);
      orbs.push({ x: x, y: y, px: x, py: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, d: OB.delayMs * (0.8 + Math.random() * 0.5), col: OB.cols[i % OB.cols.length] });
    }
  }
  function orbsStep(dt) {
    if (G.orbGlowT > 0) G.orbGlowT -= dt;
    if (!orbs.length) return;
    var OB = CFG.hunt.orbs, p = G.player, s = dt / 1000, tx = p.x, ty = p.y - (p.z || 0) - 46 * AS, got = 0;
    for (var i = orbs.length - 1; i >= 0; i--) {
      var o = orbs[i]; o.t += dt; o.px = o.x; o.py = o.y;
      if (o.t < o.d) { o.vy += 260 * AS * s; o.vx *= Math.exp(-s * 3); o.vy *= Math.exp(-s * 3); }
      else {
        var dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy) || 1, mx = (120 + (o.t - o.d) / 1000 * OB.pull) * AS;
        o.vx += (dx / d * mx - o.vx) * Math.min(1, s * 9); o.vy += (dy / d * mx - o.vy) * Math.min(1, s * 9);
        if (d < 8 * AS + mx * s || o.t > 2600) { orbs.splice(i, 1); got++; continue; }
      }
      o.x += o.vx * s; o.y += o.vy * s;
    }
    if (got) snd('orb');   // 아주 작은 「틱」(sfx.js 가 간격을 둠)
    if (got && Skills.glow && !(G.orbGlowT > 0)) { Skills.glow(tx, ty, 16 * AS / 0.55, '#fff2a0', 160, 0.45); G.orbGlowT = 70; }
  }
  function drawOrbs(camX) {
    if (!orbs.length) return;
    var OB = CFG.hunt.orbs, r = (OB.size || 2) * AS / 0.55;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    orbs.forEach(function (o) {
      var x = o.x - camX, y = o.y;
      ctx.globalAlpha = 0.35; ctx.strokeStyle = o.col; ctx.lineWidth = r * 1.1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(o.px - camX, o.py); ctx.lineTo(x, y); ctx.stroke();
      ctx.globalAlpha = 0.45; ctx.fillStyle = o.col; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff'; ctx.fillRect(x - r * 0.5, y - r * 0.5, r, r);
    });
    ctx.restore();
  }
  // 쓰러진 잡몹이 펑(hunt.death, enemies.js 가 부름): 코드로 그린 작은 터짐 = 파편 + 납작한 고리 + 빛 → 그 자리에서 경험치 구슬
  function deathPop(e) {
    var D = e.huntDeath, y = e.y - (e.az || 0) - e.T.height * 0.3;
    if (Skills.debris) Skills.debris(e.x, y, e.y, D.bits || 8, { cols: D.cols, glow: true, sp: 170, size: 1.8, ms: 380, spread: 1.6 });
    if (Skills.wave) Skills.wave(e.x, e.y - 2 * AS, (D.ringR || 24) * AS / 0.55, { flat: 0.32, w: 2, ms: 240, color: '#ffffff', glow: '#ffe8a0', ground: true, noMax: true });
    if (Skills.glow) Skills.glow(e.x, y, 20 * AS / 0.55, '#fff2c0', 200, 0.55);
    var OB = huntPart('orbs');
    if (OB && e.orbN) spawnOrbs(e.x, y, OB);
  }

  // 방패로 막음: 방패 자리에 하얀·노란 쨍 불똥 + 쇳조각 반짝임, 짧은 멈춤·작은 흔들림(데미지 숫자·콤보 수 없음)
  function blockFx(e, dir) {
    var x = e.x + e.dir * 30 * AS, y = e.y - 56 * AS;
    snd('block');
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
    var shA = Skills.shieldSplit(p, dmg);   // 늘 켜진 기술 「마나 방패」(2차, 2026-11-06): 피해 일부를 마나가 대신 받음
    dmg -= shA;
    var dir = p.x >= e.x ? 1 : -1;
    if (!p.takeHit(dmg, dir, spec.knock, spec.flinchMs, !!spec.heavy)) return false;
    snd(p.state === 'dead' ? 'playerDown' : 'playerHurt');
    if (shA) Skills.shieldHit(p, shA);   // 실제로 맞았을 때만 마나를 깎음   // heavy = 넘어짐. 안 맞았으면 false(총알은 그대로 지나감)
    G.combatT = 0; rageAdd(CFG.rage.hurt);   // 분노: 맞으면 +6(2026-11-06 밤)
    // 맞는 느낌 세게(2026-11-06 밤, config juice.hurt): 짧은 멈춤 + 흔들림 + 빨간 번쩍(몸) + 화면 가장자리 빨갛게(데미지만큼) + 불똥·피 조각
    var HU = J.hurt || {}, hk = Math.min(1, dmg / Math.max(1, p.maxHp * (HU.fullAt || 0.12)));   // hk = 이번 데미지 세기 0~1
    G.hitstop = Math.max(G.hitstop, J.hitstopMs * (e.T.boss ? 1.3 : 0.8) * (HU.stop || 1));
    FX.shake(J.shakePx * (spec.shake || 1.2) * (HU.shake || 1), J.shakeMs * 1.3);
    FX.impact(p.x - dir * 4, p.y - 60 * AS, -dir, '#ff6a5a', Math.round(J.sparkCount * 0.8 * (HU.spark || 1)), e.T.boss, null, 0.8);
    p.redT = HU.redMs || 0;   // 몸 빨갛게(entities.js draw)
    G.vig = Math.min(1, Math.max(G.vig || 0, (HU.vig || 0) * (0.45 + 0.55 * hk)));   // 화면 가장자리 빨갛게(점점 사라짐)
    if (Skills.debris && HU.bits) Skills.debris(p.x - dir * 4, p.y - 56 * AS, p.y, HU.bits, { cols: ['#ff4a3a', '#ffffff', '#c41a2a', '#ffb0a0'], glow: true, sp: 170, size: 1.6, ms: 420 });
    FX.damage(p.x, p.y - (p.z || 0) - 112 * AS, dmg, false, J, '#ff5a4a', null, 'player');
    vibrate(Math.round(J.vibrateMs * 2.5));
    G.comboT = 0; comboEl.hidden = true;
    // 독(전갈 왕 독침): 맞으면 잠깐 독 → poisonStep 이 everyMs 마다 체력을 조금씩 깎음(독으로는 안 쓰러짐)
    if (spec.poison) p.poison = { t: spec.poison.ms, tick: spec.poison.everyMs, every: spec.poison.everyMs, dmg: spec.poison.dmg };
    Skills.tryCounter(p, e);   // 늘 켜진 기술 「반격」(2차, 2026-11-06): 움찔했으면 확률로 바로 되받아 베기
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
    if (!spec.burn || p.state === 'dead' || p.state === 'down' || p.state === 'held' || p.dodgeInvT > 0) return;   // 회피 무적 중엔 안 탐
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
    if (p.state === 'dead' || p.state === 'down' || p.state === 'held' || p.invulnT > 0 || p.dodgeInvT > 0 || (p.z || 0) > 4) return false;   // dodgeInvT = 회피 무적
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
    comboEl.innerHTML = '<b>' + G.comboHits + '</b> HIT' + (G.comboTagT > 0 ? '<i class="ctag ctag-' + G.comboTagTxt.toLowerCase() + '">' + G.comboTagTxt + '</i>' : '');
    // 사냥 손맛(hunt.combo): 콤보 수 크게 + 50 · 100 … 마다 번쩍(글자 커졌다 돌아옴 + 짧은 화면 번쩍)
    var HC = huntPart('combo'), mile = !!(HC && HC.every && G.comboHits % HC.every === 0);
    comboEl.classList.toggle('big', !!(HC && HC.big));
    comboEl.classList.remove('pop'); comboEl.classList.remove('mile'); void comboEl.offsetWidth; comboEl.classList.add(mile ? 'mile' : 'pop');
    if (mile) { Skills.flash({ color: '#fff2c0', alpha: 0.3, ms: 180 }); snd('combo'); }
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
    snd('bossIntro', king ? { k: 0.85 } : null);   // 낮은 북 + 뿔피리(마왕 = 더 낮게)
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
      // 위아래 금테(UI A: 금 2줄 + 검은 테)
      ctx.globalAlpha = 1; ctx.fillStyle = '#140a04'; ctx.fillRect(-4, y - 1, LW + 8, 1); ctx.fillRect(-4, y + h, LW + 8, 1);
      ctx.fillStyle = I.king ? '#d8b0ff' : '#f2c14e'; ctx.fillRect(-4, y, LW + 8, 1); ctx.fillRect(-4, y + h - 1, LW + 8, 1);
      if (Math.floor(I.t / 160) % 2 === 0 || u > 0.3) {
        ctx.font = '700 ' + Math.round(h * 0.72) + 'px Galmuri, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3; ctx.strokeStyle = '#1a0006'; ctx.fillStyle = I.king ? '#f0e0ff' : '#ffe9a8';
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
      ctx.font = '700 ' + small + 'px Galmuri, system-ui, sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = '#140208'; ctx.fillStyle = I.king ? '#d8b0ff' : '#f2c14e';
      ctx.strokeText(I.title, nx, ny - big * 0.95); ctx.fillText(I.title, nx, ny - big * 0.95);
    }
    ctx.font = '700 ' + big + 'px Galmuri, system-ui, sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = '#140208';
    ctx.strokeText(e.label, nx, ny); ctx.fillStyle = '#ffffff'; ctx.fillText(e.label, nx, ny);
    ctx.fillStyle = I.color; ctx.fillRect(nx, ny + 6, Math.min(LW * 0.4, big * e.label.length * 0.95) * introEase((I.t - 380) / 300), 3);
    ctx.restore();
  }

  // ================= 판 진행 =================
  // 콤보 수 옆 작은 글자(2026-11-06 밤): LAUNCH(띄움) · AIR(공중 타) · OTG(누운 적 타) · CANCEL(캔슬). tagMs 동안 보임, 새 글자가 덮어씀.
  //   CANCEL 처럼 맞힘 없이 생기는 글자는 콤보 수가 보이는 동안만 다시 그림
  function comboTag(txt) {
    G.comboTagTxt = txt; G.comboTagT = 650;
    if (txt === 'CANCEL') { G.cstats.cancel++; if (G.comboT > 0 && !comboEl.hidden) showCombo(); }
  }
  // placedQ = 다음 웨이브의 미리 서 있는 적 중 아직 안 내놓은 것(카메라가 다가가면 화면 밖 오른쪽에서부터 내놓음)
  function newStage() {
    return { next: 0, locked: false, lockCam: 0, lastLock: -1, queue: [], waveT: 0, waveIdx: -1, placedQ: [],
             camMin: 0, time: 0, boss: null, bossDownT: -1, result: null, overT: 0, lastAttackAt: -1e9 };
  }
  function waveAt(w) { return w.at === 'end' ? world.width - LW : Math.min(w.at, world.width - LW); }

  // ---------- 사냥 손맛 (2026-11-07, config hunt): 켠 판(hunt.stages)에서만 ----------
  // HUNT() = 지금 판에서 켜져 있으면 config hunt, 아니면 null. huntPart('horde') = 그 묶음(꺼져 있으면 null)
  function HUNT() { var h = CFG.hunt; return h && h.on && MODE === 'stage' && CFG.stage && (h.stages || []).indexOf(CFG.stage.id) >= 0 ? h : null; }
  function huntPart(k) { var h = HUNT(), q = h && h[k]; return q && q.on !== false ? q : null; }
  // 몹 떼로 늘릴 적 = 성장 경험치 종류 'mob'(고블린·늑대·박쥐 …). 보스·단단한 잡몹·정예는 그대로
  function hordeMob(type) { var T = CFG.enemies[type]; return !!T && !T.boss && Growth.kindOf(type, T) === 'mob'; }
  function hordeOf(w) { var HD = huntPart('horde'); return HD && !(w && w.horde === false) ? HD : null; }
  // 지금 판의 몹 떼 배수(웨이브 hordeMul > 판별 stageMul > mul). 1 = 늘리지 않음
  function hordeMulOf(w, HD) { return (w && w.hordeMul) || (HD.stageMul && CFG.stage && HD.stageMul[CFG.stage.id]) || HD.mul || 1; }
  // 소수 배수: 잡몹마다 (배수 - 1) 을 쌓아서 정수가 넘을 때만 한 마리 더(1.5배 = 두 마리 중 하나만 더)
  function hordeExtra(acc, mul) { var a0 = acc.v; acc.v += mul - 1; return Math.floor(acc.v + 1e-6) - Math.floor(a0 + 1e-6); }
  // 마리 수 배수(2026-11-06 난이도): 잡몹 = 몹 떼 배수 x 난이도 count, 단단한 잡몹 = 난이도 countTough, 나머지(보스·정예) = 1
  //   몹 떼로 늘어난 만큼은 한 마리가 약해지지만(makeEnemy), 난이도로 늘어난 몹은 약해지지 않음
  function countMul(type, w, HD) {
    var T = CFG.enemies[type], M = Growth.M();
    if (hordeMob(type)) return (HD ? hordeMulOf(w, HD) : 1) * (M.count || 1);
    if (T && !T.boss && Growth.kindOf(type, T) === 'tough') return M.countTough || 1;
    return 1;
  }
  // 웨이브 spawn 목록 → 몹 떼(잡몹마다 mul 배). 늘어난 몹은 반대쪽 끝에서(bothSides) gapMs 씩 늦게, 화면 밖으로 조금씩 더 떨어져서(off)
  function hordeSpawn(w) {
    var list = (w.spawn || []).map(function (s) { return { type: s[0], side: s[1], at: s[2], opt: s[3], off: 0 }; }), HD = hordeOf(w);
    var HS = HD || (CFG.hunt && CFG.hunt.horde) || {}, out = [], acc = { v: 0 };   // HS = 늘어난 몹 서는 법(몹 떼를 끈 판도 난이도로 늘면 같은 모양)
    list.forEach(function (q) {
      out.push(q);
      for (var k = 1, nx = hordeExtra(acc, countMul(q.type, w, HD)); k <= nx; k++) {
        var flip = HS.bothSides && k % 2 === 1;
        out.push({ type: q.type, side: flip ? (q.side === 'L' ? 'R' : 'L') : q.side, at: q.at + k * (HS.gapMs || 0), opt: q.opt, off: flip ? Math.floor(k / 2) : k });
      }
    });
    return out;
  }

  function startWave(i) {
    var S = G.stage, w = CFG.stage.waves[i];
    S.locked = true; S.lockCam = waveAt(w); S.waveIdx = i; S.lastLock = S.lockCam; S.waveT = 0;
    S.queue = hordeSpawn(w);   // 사냥 손맛: 켠 판이면 잡몹이 떼로(config hunt.horde)
    var MQ = midOf(CFG.stage);   // 중간보스(2026-11-06): 보스 바로 앞 웨이브에 하나
    if (MQ && i === MQ.wave) S.queue.push({ type: MQ.type, side: CFG.midBoss.side || 'R', at: CFG.midBoss.delayMs || 0, opt: { mid: true }, off: 0 });
    // 미리 서 있는 적: 아직 안 나온 것도 지금 다 내놓고, 화면이 고정되면 전부 알아챔
    S.placedQ.forEach(spawnPlaced); S.placedQ = [];
    G.enemies.forEach(function (e) { if (e.asleep) wakeEnemy(e, Math.random() * (CFG.ai.wake.groupDelayMs || 0)); });
    banner(w.boss ? 'BOSS!' : 'WAVE ' + (i + 1), w.boss ? 'boss' : '');
    snd('wave', w.boss ? { k: 0.75 } : null);
  }

  // 난이도 배율(2026-11-06, config modes): 숫자 하나 = 모든 판 같음, [1판, 10판] = 판 순서대로 고르게
  function modeVal(v) {
    if (!Array.isArray(v)) return v != null ? v : 1;
    var n = STAGES.length, u = n > 1 ? clamp((G.stageNo || 1) - 1, 0, n - 1) / (n - 1) : 0;
    return v[0] + (v[v.length - 1] - v[0]) * u;
  }
  // 적 하나 만들기: 판 배율(hpMul·dmgMul) + 변종(색·배율) + 난이도 배율 적용. opt = { variant, mid(중간보스) }
  function makeEnemy(type, x, y, opt) {
    var S = G.stage, T = CFG.enemies[type], st = CFG.stage, M = Growth.M();
    var MQ = opt && opt.mid ? midOf(st) : null;   // 중간보스: 잡몹 T 를 키운 MQ.T + 물들인 그림(MQ.vk)
    var vk = MQ ? MQ.baseVk : (opt && opt.variant) || T.variant, V = vk && CFG.variants ? CFG.variants[vk] : null;   // T.variant = 늘 그 색으로 나오는 적(7단계 용암 골렘)
    var e = new Enemy(type, CFG, MQ ? tintArt(type, MQ.vk) : V ? tintArt(type, vk) : G.assets.enemies[type], x, y);
    if (MQ) { T = e.T = MQ.T; e.hp = e.maxHp = T.hp; e.label = T.label; e.hoverD = T.hover[0] + Math.random() * (T.hover[1] - T.hover[0]); e.mid = true; S.mid = e; }
    var hm = (st.hpMul || 1) * (V && V.hpMul || 1) * modeVal(M.hpMul), dm = (st.dmgMul || 1) * (V && V.dmgMul || 1) * modeVal(M.dmgMul);
    if (MQ) dm *= CFG.midBoss.dmgMul || 1;
    if (hm !== 1) e.hp = e.maxHp = Math.round(e.maxHp * hm);
    e.dmgMul = dm;
    if (V && !MQ) { e.variant = vk; if (V.label) e.label = V.label + ' ' + e.label; }
    // 몹 떼(사냥 손맛): 늘어난 만큼 한 마리는 약하게 + 경험치 xpMul 배. 쓰러지면 붕 날아가 펑(hunt.death, enemies.js)
    var HD = hordeOf(null);
    var hmul = HD ? hordeMulOf(null, HD) : 1;
    if (HD && hmul > 1 && hordeMob(type)) {
      e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp * (HD.hpExp ? Math.pow(hmul, -HD.hpExp) : (HD.hpMul || 1))));
      e.dmgMul *= HD.dmgMul || 1; e.xpMul = HD.hpExp ? 1 / hmul : (HD.xpMul || 1); e.horde = true;
    }
    var HDe = huntPart('death');
    if (HDe && !T.boss && !MQ) e.huntDeath = HDe;   // 중간보스는 보스처럼 그 자리에 쓰러짐(펑 없이)
    e.wave = S.waveIdx;
    G.enemies.push(e);
    if (T.boss) S.boss = e;
    return e;
  }
  // off = 몹 떼로 늘어난 몹: 화면 밖으로 off x hunt.horde.xOff 도트 더 떨어져서 나옴(한 덩어리로 겹치지 않게)
  function spawnEnemy(type, side, opt, off) {
    var S = G.stage, T = CFG.enemies[type], HD = off ? hordeOf(null) || CFG.hunt.horde : null, ox = HD ? off * (HD.xOff || 0) * AS : 0;
    var x = side === 'L' ? S.lockCam - T.radius - 30 - ox : S.lockCam + LW + T.radius + 30 + ox;
    var y = world.laneTop + Math.random() * (world.laneBottom - world.laneTop);
    var e = makeEnemy(type, x, y, opt);
    e.dir = side === 'L' ? 1 : -1;
    return e;
  }

  // ---------- 중간보스 (2026-11-06, config midBoss) ----------
  // 그 판 잡몹 T 를 복사해서 키움: 그림 배율(drawScale) + 몸·공격 판정·그림자(radius)·키·거리를 같은 배율로, 체력 = 그 판 보스 기본 체력 x hpBoss,
  //   근접 공격은 무겁게(heavy) + 치켜든 그림(예고)을 windMs 더 길게 + 바닥 빨간 예고, 버티기(armor·staggerCdMs·poise), 띄우기는 됨(원래 보스였던 적만 noLaunch)
  //   그림 = 그 판 변종 색 위에 더 어둡게(midBoss.tint) 구운 것 + 빛나는 테두리(rim). 판마다 한 번 만들어 둠
  var midCache = {};
  function midOf(st) {
    var MB = CFG.midBoss, L = MB && MB.on && MB.list && MB.list[st.id];
    if (!L || !CFG.enemies[L[0]]) return null;
    if (midCache[st.id]) return midCache[st.id];
    var B = CFG.enemies[L[0]], k = MB.scale || 1, wave = st.waves.length - (MB.wave || 2), boss = null;
    if (wave < 0 || st.waves[wave].boss) return null;
    st.waves.forEach(function (w) { (w.spawn || []).forEach(function (q) { var E = CFG.enemies[q[0]]; if (E && E.boss) boss = E; }); });
    var tmp = Object.assign({}, B); delete tmp.anims;
    var T = JSON.parse(JSON.stringify(tmp));
    T.anims = Object.assign({}, B.anims);
    function mul(o, keys, f) { if (o) keys.forEach(function (n) { if (typeof o[n] === 'number') o[n] *= f; }); }
    function bx(r) { mul(r, ['x0', 'x1', 'yTop', 'yBot'], k); }
    function arr(a) { return a ? a.map(function (v) { return v * k; }) : a; }
    // 몸·그림자·키·거리
    T.drawScale = (B.drawScale || 1) * k;
    mul(T, ['radius', 'height', 'engage', 'deathKnock'], k); bx(T.hurtbox);
    T.range = arr(T.range); T.hover = arr(T.hover);
    mul(T, ['speedX', 'speedY'], MB.speed || 1);
    var wa = T.walkAnim && B.anims[T.walkAnim];   // 걷기 그림: 커진 몸 + 느린 걸음에 맞춰 천천히(발이 미끄러지지 않게)
    if (wa) T.anims[T.walkAnim] = Object.assign({}, wa, { fps: wa.fps * (MB.speed || 1) / k });
    // 공격: 판정 크게 · 무겁게 · 예고 길게
    var longer = {};
    Object.keys(T.attacks).forEach(function (n) {
      var a = T.attacks[n];
      bx(a.reach); bx(a.bodyReach); mul(a.spawn, ['x', 'y'], k); mul(a, ['aimH'], k);
      if (a.reachF) Object.keys(a.reachF).forEach(function (q) { bx(a.reachF[q]); });
      mul(a, ['depth'], Math.sqrt(k)); mul(a.move, ['dist'], k); a.when = arr(a.when);
      mul(a, ['knock'], MB.knock || 1);
      var melee = !a.type && !a.grab;
      if (melee && MB.heavy) a.heavy = true;
      var first = a.active ? a.active[0] : a.spawnFrame, A = B.anims[a.anim];
      if (!first || !A) return;
      var wf = a.telegraph ? a.telegraph[a.telegraph.length - 1] : Math.max(1, first - 1);
      if (melee) { a.telegraph = a.telegraph || [wf]; a.showTelegraph = true; }
      if (!MB.windMs || longer[a.anim]) return;
      longer[a.anim] = true;
      var pb = (A.playback || A.frames.map(function (q, i) { return i + 1; })).slice(), fa = pb.indexOf(first), at = pb.lastIndexOf(wf, fa < 0 ? pb.length - 1 : fa);
      if (at < 0) return;
      var add = Math.round(MB.windMs * A.fps / 1000), ins = [];
      for (var i = 0; i < add; i++) ins.push(wf);
      pb.splice.apply(pb, [at + 1, 0].concat(ins));
      T.anims[a.anim] = Object.assign({}, A, { playback: pb });
    });
    // 버티기 · 이름 · 보상
    T.midBoss = true; T.label = L[1]; T.noLaunch = !!(B.boss || B.noLaunch);   // 띄우기(2026-11-06 형님): 잡몹 대장은 뜸, 원래 보스였던 적이 중간보스면 안 뜸
    T.superArmor = !!MB.armor; T.staggerCdMs = MB.staggerCdMs || 0;
    T.poise = { downCdMs: MB.downCdMs || 0 };
    T.knockResist = (B.knockResist != null ? B.knockResist : 1) * (MB.knockResist != null ? MB.knockResist : 1);
    T.rim = MB.rim || null;
    T.hp = Math.round((boss ? boss.hp : B.hp * 7) * (MB.hpBoss || 0.45));
    // 그림 색: 그 판 변종(L[2]) 위에 tint 를 얹은 새 변종을 variants 에 넣어 둠(tintArt 가 한 번만 구움)
    var V0 = L[2] && CFG.variants[L[2]], TN = MB.tint || {}, vk = 'mid' + st.id;
    CFG.variants[vk] = V0 ? Object.assign({}, V0, { sat: (V0.sat != null ? V0.sat : 1) * (TN.sat != null ? TN.sat : 1), bright: (V0.bright != null ? V0.bright : 1) * (TN.bright != null ? TN.bright : 1) }) : TN;
    return (midCache[st.id] = { type: L[0], T: T, vk: vk, baseVk: L[2] || null, wave: wave });
  }
  // 중간보스 등장: 이름 띠 + 으르렁(보스 소리를 높게) + 흔들림
  function midIntro(e) {
    banner(josa(e.label, '이', '가') + ' 나타났다!', 'boss');
    snd('bossRoar', { k: 1.3, v: 0.8 });
    FX.shake(J.shakePx * 1.6, 420);
  }
  // 중간보스 쓰러짐: 짧은 멈춤·슬로모션 + 보스 쓰러짐 소리(높게) + 물약 꼭 하나(config midBoss.potion). 경험치는 xpStep(growth xp.mid)
  function midDown(e) {
    G.hitstop = Math.max(G.hitstop, 140);
    G.slowT = Math.max(G.slowT, 600);
    FX.shake(J.shakePx * 2, 380);
    snd('bossDown', { k: 1.35, v: 0.75 });
    var dir = G.player.x >= e.x ? 1 : -1;
    if (CFG.potions && CFG.midBoss.potion) Props.dropPotion(e.x + dir * (e.T.radius + 10 * AS), e.y, dir, CFG.midBoss.potion);
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
    // 몹 떼(사냥 손맛): 미리 서 있는 잡몹도 mul 배 — 옆(placedDx)·위아래(placedDy)로 비켜 서서 같은 무리. 무리가 없던 몹은 늘어난 몹과 한 무리
    //   (2026-11-06 난이도) 마리 수 = countMul: 노말·하드는 단단한 잡몹도 늘어남
    var HD = hordeOf(w);
    var HS = HD || (CFG.hunt && CFG.hunt.horde) || {}, add = [], acc = { v: 0 };
    S.placedQ.forEach(function (q, n) {
      var nx = hordeExtra(acc, countMul(q.type, w, HD)); if (!nx) return;
      if (!q.opt.group) q.opt = Object.assign({}, q.opt, { group: 'horde' + i + '_' + n });
      for (var k = 1; k <= nx; k++) {
        var sx = k % 2 ? 1 : -1, yk = q.yk + (q.yk > 0.5 ? -1 : 1) * (HS.placedDy || 0) * Math.ceil(k / 2);
        add.push({ type: q.type, x: q.x + sx * (HS.placedDx || 0) * Math.ceil(k / 2), yk: clamp(yk, 0.04, 0.96), opt: q.opt, wave: i });
      }
    });
    S.placedQ = S.placedQ.concat(add);
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
    var MQ = midOf(CFG.stage);   // 중간보스(2026-11-06): 어둡게 물들인 그림
    if (MQ) tintArt(MQ.type, MQ.vk);
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
    snd('enemyShot');
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
    hitstop: function (ms) { G.hitstop = Math.max(G.hitstop, ms); },
    feed: feed,     // 빵·고기 = 포만감 +%(2026-11-06 밤)
    drink: drink,   // 물약 = 체력·마나 바로(2026-11-06 밤)
    club: gotClub,  // 몽둥이 주움(2026-11-06)
    // 물약이 머무는 곳: 걷는 길 + 지금 화면(폰 버튼 밑 빼고)
    view: function () { return { laneTop: world.laneTop, laneBottom: world.laneBottom, x0: G.camX + 14, x1: G.camX + LW - 14 - controlPad }; }
  });

  // ---------- 포만감 · 물약 (2026-11-06 밤, 형님 결정, 수치 = config fullness · potions) ----------
  // 포만감(G.full, 0~100 %): 판 시작마다 start. 0 보다 크면 체력이 초당 최대 체력 x regenPct 씩 참(조금씩 모아서 1씩), 초당 decayPerSec 씩 줆,
  //   기술을 쓸 때마다 skillCost 더 줆(skills.js start → H.onCast). 0 = 회복만 멈춤
  function feed(n) { var F = CFG.fullness; G.full = Math.min(F.max, (G.full || 0) + n); snd('food'); }
  function fullStep(dt) {
    var F = CFG.fullness, p = G.player;
    if (!F || p.state === 'dead') return;
    if (G.full > 0) {
      G.fullAcc = (G.fullAcc || 0) + p.maxHp * F.regenPct * dt / 1000;
      if (G.fullAcc >= 1) { var n = Math.floor(G.fullAcc); G.fullAcc -= n; p.hp = Math.min(p.maxHp, p.hp + n); }
      G.full = Math.max(0, G.full - F.decayPerSec * dt / 1000);
    }
  }
  function onCast() { if (CFG.fullness && MODE === 'stage') G.full = Math.max(0, (G.full || 0) - CFG.fullness.skillCost); }
  // 물약 마심: 최대의 비율만큼 바로(꽉 차 있어도 마심). 돌려주는 값 = 실제로 찬 양 { hp, mp }
  function drink(kind) {
    var it = CFG.potions.items[kind], p = G.player, h0 = p.hp, m0 = p.mp;
    if (it.hp) p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * it.hp));
    if (it.mp) p.mp = Math.min(p.maxMp, p.mp + Math.round(p.maxMp * it.mp));
    G.potGot = (G.potGot || 0) + 1;
    snd('potion');
    return { hp: p.hp - h0, mp: Math.round(p.mp - m0) };
  }
  // 잡몹이 쓰러질 때 가끔 물약(단단한 잡몹은 조금 더 자주). 보스·보스와 같이 쓰러진 졸개(noDrop)는 안 줌(보스는 bossPotion)
  function mobPotion(e) {
    var PO = CFG.potions;
    if (!PO || e.T.boss || e.noDrop || e.mid) return;   // 중간보스는 midDown 이 꼭 하나. 난이도(2026-11-06): 확률 x modes.drop
    if (Math.random() < (e.T.hp >= PO.toughHp ? PO.tough : PO.mob) * (Growth.M().drop || 1)) Props.dropPotion(e.x, e.y, G.player.x > e.x ? -1 : 1, null);
  }
  // ---------- 첫 무기 몽둥이 (2026-11-06, 형님 승인, 수치 = config club) ----------
  // 나오는 때: 첫 판 · 견습(전직 전, 견습 옷) · 아직 없음 · 바닥에 없음 → 잡몹이 쓰러질 때 chance, 그 판 sureAt 번째 잡몹이면 꼭(G.clubN = 센 수)
  function clubWanted() { return !!CFG.club && MODE === 'stage' && G.stageNo === 1 && !Growth.cls && !Growth.club && G.classKey === 'novice' && !Props.clubs.length; }
  function clubDrop(e) {
    if (e.T.boss || e.noDrop || e.mid || !clubWanted()) return;
    G.clubN = (G.clubN || 0) + 1;
    if (G.clubN >= CFG.club.sureAt || Math.random() < CFG.club.chance) Props.dropClub(e.x, e.y, G.player.x > e.x ? -1 : 1);
  }
  // 주움(props.js 가 밟으면 부름): 저장 + 「몽둥이 획득!」 + 소리(빛·불똥은 props.js)
  function gotClub() {
    if (!Growth.getClub()) return;
    banner('몽둥이 획득!', 'small');
    snd('unlock');
  }
  // 맨손(fist) 타 배율: 몽둥이가 있으면 1 + atk
  function clubMul(wk) { return wk === 'fist' && Growth.club && CFG.club ? 1 + CFG.club.atk : 1; }
  // 보스는 꼭 하나(config potions.bossAt: 'rage' = 화날 때 · 'death' = 쓰러질 때). 플레이어 쪽으로 튐
  function bossPotion(B, when) {
    var PO = CFG.potions;
    if (!PO || B.potionDone || (PO.bossAt || 'rage') !== when) return;
    B.potionDone = true;
    var dir = G.player.x >= B.x ? 1 : -1;
    Props.dropPotion(B.x + dir * (B.T.radius + 10 * AS), B.y, dir, PO.boss);
  }

  // ================= 분노·각성 (2026-11-06 밤, 형님 「좋아」, 수치 = config rage · awaken) =================
  // G.rage = 분노 0~100(마나 밑 주황 막대), G.combatT = 마지막으로 때리거나 맞은 뒤 지난 게임 시간(ms) → idleMs 넘으면 천천히 줆
  // G.awk = 각성 중 { cls(knight·mage·novice), A(그 직업 값), t(지난 게임 시간), ms, intro(변신 순간 지난 진짜 시간), fxT·ghostT(불꽃·잔상 시계) }
  //   보스 분노(enemies.js rage)와는 따로. 콤보: 공중·누운 적 타도 onHit 를 지나므로 그대로 분노가 참
  var awkPush = [];   // 변신 순간 밀려나는 적 { e, dir, dist, t, ms }
  function rageAdd(n) {
    if (MODE !== 'stage' || G.awk || !CFG.rage) return;
    G.rage = Math.min(100, (G.rage || 0) + n);
  }
  function rageStep(dt) {
    var R = CFG.rage;
    if (!R || MODE !== 'stage') return;
    G.combatT = (G.combatT || 0) + dt;
    if (!G.awk && G.rage > 0 && G.combatT > R.idleMs) G.rage = Math.max(0, G.rage - R.drainPerSec * dt / 1000);
  }
  function awkClass() { return CFG.awaken[G.classKey] ? G.classKey : 'novice'; }
  function canAwaken(p) {
    return MODE === 'stage' && !G.awk && (G.rage || 0) >= 100 && !G.stage.result && p.state !== 'dead' && p.state !== 'down' && p.state !== 'held' && p.state !== 'hurt';
  }
  function startAwaken() {
    var p = G.player, AW = CFG.awaken, cls = awkClass(), A = AW[cls];
    G.rage = 0; G.awkCount = (G.awkCount || 0) + 1;
    G.awk = { cls: cls, A: A, t: 0, ms: AW.ms, intro: 0, fxT: 0, ghostT: 0 };
    snd('awaken');
    // 공통: 슈퍼아머 · 쿨타임 2배 빨리 / 법사: 마나 0 · 한 번 더 · 효과 더 크고 밝게 / 갑옷·로브 다시 칠하기 + 빛 테두리(entities.js look)
    p.superArmor = true; p.cdRate = AW.cdRate;
    p.freeMp = p.echoCast = cls === 'mage';
    Skills.setBright(cls === 'mage' ? 1.35 : 1);
    p.look = { paint: awkPaint(cls), outline: { color: A.color, alpha: 0.9, glow: true }, white: 1 };
    // 변신 순간: 안 맞음 + 슬로 + 흔들림 + 직업 색 번쩍 + 발밑 충격파·빛 + 주변 적 밀침(그리기 = drawAwk…)
    p.noHitT = Math.max(p.noHitT, AW.introMs + 200);
    G.slowT = Math.max(G.slowT, AW.slowMs);
    FX.shake(J.shakePx * 3.2, 650);
    Skills.flash({ color: A.color, alpha: 0.3, ms: 420 });
    var R = AW.pushR * AS;
    Skills.wave(p.x, p.y, R, { flat: 0.3, w: 5, ms: 520, color: '#ffffff', glow: A.color, ground: true });
    Skills.glow(p.x, p.y - 50 * AS, 60 * AS / 0.55, A.glow, 520, 0.85);
    Skills.debris(p.x, p.y - 30 * AS, p.y, 22, { cols: ['#ffffff', A.color, A.glow], glow: true, sp: 260, size: 1.8, ms: 620, g: -40, spread: 1.7 });
    G.enemies.forEach(function (e) {
      if (!e.alive() || e.hidden) return;
      var dx = e.x - p.x;
      if (Math.abs(dx) > R || Math.abs(e.y - p.y) > R * 0.45) return;
      awkPush.push({ e: e, dir: dx >= 0 ? 1 : -1, dist: AW.push * AS * (e.T.boss ? 0.3 : 1) * (1 - Math.abs(dx) / R * 0.5), t: 0, ms: 340 });
    });
  }
  function awkPushStep(dt) {
    for (var i = awkPush.length - 1; i >= 0; i--) {
      var q = awkPush[i], u0 = Math.min(1, q.t / q.ms); q.t += dt;
      var u1 = Math.min(1, q.t / q.ms), ea = function (u) { return 1 - (1 - u) * (1 - u); };
      if (q.e.alive()) q.e.x += q.dir * q.dist * (ea(u1) - ea(u0));
      if (u1 >= 1) awkPush.splice(i, 1);
    }
  }
  // 매 장면: 시간 · 흰 번쩍 · 빛 테두리 일렁임 · 불꽃(기사 머리 위)·빛 알갱이 · 붉은 잔상(기사) · 끝나면 폭발
  function awkStep(dt, realMs) {
    var a = G.awk, p = G.player;
    if (!a) return;
    if (p.state === 'dead') { endAwaken(false); return; }
    a.intro += realMs; a.t += dt;
    var L = p.look, AW = CFG.awaken;
    if (L) { L.white = a.intro < 300 ? 1 - a.intro / 300 : 0; L.outline.alpha = 0.7 + 0.3 * Math.sin(a.t / 70) * Math.sin(a.t / 23 + 1); }
    a.fxT -= dt;
    if (a.fxT <= 0) {
      a.fxT = 45;
      var hy = p.y - (p.z || 0);
      if (a.cls === 'knight') {   // 머리 위로 솟는 불꽃 + 몸 둘레 불티
        Skills.debris(p.x + (Math.random() * 2 - 1) * 7 * AS, hy - 92 * AS, p.y, 2, { cols: ['#fff2a0', '#ffb040', '#ff5a1a', '#ff2a10'], glow: true, sp: 70, size: 2.2, ms: 520, g: -260, spread: 0.45 });
        Skills.debris(p.x + (Math.random() * 2 - 1) * 16 * AS, hy - (20 + Math.random() * 60) * AS, p.y, 1, { cols: ['#ffd27a', '#ff5a1a', '#ff2a10'], glow: true, sp: 50, size: 1.6, ms: 420, g: -220, spread: 0.6 });
      } else if (a.cls === 'mage') {   // 발밑 마법진에서 오르는 보라·하늘 빛 알갱이
        Skills.debris(p.x + (Math.random() * 2 - 1) * 26 * AS, p.y - 2, p.y, 1, { cols: ['#ffffff', '#d8b0ff', '#5ae6ff', '#b46aff'], glow: true, sp: 40, size: 1.5, ms: 700, g: -140, spread: 0.4 });
      } else {
        Skills.debris(p.x + (Math.random() * 2 - 1) * 14 * AS, hy - (30 + Math.random() * 50) * AS, p.y, 1, { cols: ['#ffffff', '#fff2a0', '#ffd23f'], glow: true, sp: 40, size: 1.4, ms: 480, g: -160, spread: 0.6 });
      }
    }
    // 붉은 잔상(기사): 움직이거나 휘두르는 동안
    if (a.cls === 'knight') {
      a.ghostT -= dt;
      var moving = p.state !== 'idle' && p.state !== 'hurt';
      if (a.ghostT <= 0 && moving) { a.ghostT = 70; Skills.ghost(p, '#ff2a1a', 300, 0.42); }
    }
    if (a.t >= a.ms) endAwaken(true);
  }
  // 끝: boom = 주변 큰 폭발(데미지 = 무기 데미지 x end.dmg x 레벨·능력치 공격력, 넘어뜨림 · 누운 적도) → 원래 색
  function endAwaken(boom) {
    var a = G.awk, p = G.player, AW = CFG.awaken;
    if (!a) return;
    if (boom) {
      snd('awakenEnd');
      var A = a.A, R = AW.end.r * AS, x = p.x, z = p.y;
      G.hitstop = Math.max(G.hitstop, 130);
      FX.shake(J.shakePx * 4, 750);
      Skills.flash({ color: A.color, alpha: 0.45, ms: 480 });
      Skills.glow(x, z - 40 * AS, R * 1.25, A.glow, 560, 0.9);
      Skills.glow(x, z - 40 * AS, R * 0.6, '#ffffff', 280, 0.95);
      Skills.wave(x, z, R * 1.1, { flat: 0.3, w: 7, ms: 620, color: '#ffffff', glow: A.color, ground: true });
      Skills.wave(x, z, R * 0.7, { flat: 0.3, w: 5, ms: 420, color: '#fff2e0', glow: A.glow, ground: true });
      Skills.wave(x, z - 45 * AS, R * 0.85, { flat: 0.85, w: 5, ms: 460, color: '#ffffff', glow: A.color });
      Skills.debris(x, z - 30 * AS, z, 34, { cols: ['#ffffff', A.color, A.glow, '#fff2c0'], glow: true, sp: 340, size: 2.2, ms: 780, spread: 1.7 });
      Skills.debris(x, z - 6 * AS, z, 14, { cols: ['#5a4636', '#7a6248', '#3a2e24'], sp: 240, size: 2.6, ms: 820, spread: 1.2 });
      var st = { dmg: AW.end.dmg, knock: 2.6, knockdown: true, hitsDown: true, big: true, finisher: true, hitstop: 1.3, shake: 1, damageStyle: 'awk_' + a.cls, noRage: true };
      hitTargets().forEach(function (t) {
        if (!t || !canHit(t, st)) return;
        var hb = t.hurtbox();
        if (Math.abs(hb.z - z) > AW.end.depth * AS || hb.x1 < x - R || hb.x0 > x + R) return;
        onHit(st, t, { dir: t.x >= x ? 1 : -1, wk: p.weaponKey, x: clamp(x, hb.x0, hb.x1), y: z - 40 * AS });
      });
    }
    G.awk = null;
    p.superArmor = false; p.cdRate = 1; p.freeMp = p.echoCast = false; p.look = null;
    Skills.setBright(1);
  }
  // 갑옷·로브 다시 칠하기(그림마다 한 번, 처음 그릴 때): 기사 = 회색 쇠·파란 겉옷 → 검붉게, 법사 = 보라 로브 → 진보라(더 짙고 진하게).
  //   피부·머리·금테는 그대로. 파일로 열어서 점을 못 읽으면 그림 전체를 config look 값으로 물들임(tintImg, 적 변종과 같은 방식)
  var awkPaintCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function awkPaint(cls) {
    var V = CFG.awaken[cls] && CFG.awaken[cls].look;
    if (!V) return null;
    return function (img) {
      var m = awkPaintCache && awkPaintCache.get(img);
      if (m && m[cls]) return m[cls];
      var out;
      try { out = recolorGear(img, cls); } catch (e) { out = tintImg(img, V); }
      if (awkPaintCache) { m = m || {}; m[cls] = out; awkPaintCache.set(img, m); }
      return out;
    };
  }
  function recolorGear(img, cls) {
    var c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    var g = c.getContext('2d'); g.drawImage(img, 0, 0);
    var d = g.getImageData(0, 0, c.width, c.height), p = d.data;
    for (var i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 10) continue;
      var r = p[i] / 255, gg = p[i + 1] / 255, b = p[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2, s = 0, h = 0, dd = mx - mn;
      if (dd > 0) {
        s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
        h = (mx === r ? ((gg - b) / dd + (gg < b ? 6 : 0)) : mx === gg ? ((b - r) / dd + 2) : ((r - gg) / dd + 4)) * 60;
      }
      var nh = null, ns = 0, nl = l;
      if (cls === 'knight') {
        if (s < 0.2 && l > 0.12 && l < 0.97) { nh = 2; ns = 0.62; nl = l * 0.68; }                  // 회색 쇠 갑옷 → 검붉은 쇠(밝은 곳은 조금 밝게 남김)
        else if (h >= 190 && h <= 265 && s > 0.2) { nh = 352; ns = Math.min(1, s * 1.1); nl = l * 0.7; }   // 파란 겉옷 → 진홍
      } else if (cls === 'mage') {
        if (h >= 245 && h <= 325 && s > 0.15) { nh = 276; ns = Math.min(1, s * 1.25 + 0.1); nl = l * 0.66; }   // 보라 로브 → 진보라
      }
      if (nh === null) continue;
      var q = nl < 0.5 ? nl * (1 + ns) : nl + ns - nl * ns, pp = 2 * nl - q, hk = nh / 360;
      for (var j = 0; j < 3; j++) {
        var t = hk + (1 - j) / 3; if (t < 0) t += 1; if (t > 1) t -= 1;
        var v = t < 1 / 6 ? pp + (q - pp) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp;
        p[i + j] = Math.round(v * 255);
      }
    }
    g.putImageData(d, 0, 0);
    return Assets.copyMeta(img, c);
  }

  // ---------- 각성 그리기 (전부 코드, 0원) ----------
  // 변신 순간 env(0~1): 빨리 차고 introMs 끝에서 사라짐
  function awkIntroK() {
    var a = G.awk, AW = CFG.awaken;
    if (!a || a.intro >= AW.introMs + 250) return 0;
    return Math.min(1, a.intro / 90) * (a.intro > AW.introMs - 120 ? Math.max(0, 1 - (a.intro - (AW.introMs - 120)) / 370) : 1);
  }
  // 배경 위·캐릭터 아래: 변신 순간 화면 어둡게(캐릭터·적은 밝게 남음)
  function drawAwkBackdrop() {
    var k = awkIntroK();
    if (k <= 0) return;
    ctx.fillStyle = 'rgba(6,2,12,' + (0.6 * k).toFixed(3) + ')'; ctx.fillRect(-8, -8, LW + 16, LH + 16);
  }
  // 바닥(캐릭터 밑): 법사 = 발밑 마법진(따라다님, 두 고리 + 도는 눈금 + 두 삼각형), 기사 = 붉은 불빛, 견습 = 금빛
  function drawAwkUnder(camX) {
    var a = G.awk, p = G.player;
    if (!a) return;
    var x = p.x - camX, y = p.y, t = a.t / 1000, A = a.A;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); ctx.scale(1, 0.32);   // 발밑 빛(납작한 둥근 빛)
    var gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 34);
    gr.addColorStop(0, A.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.35 + 0.1 * Math.sin(t * 9); ctx.fillStyle = gr; ctx.fillRect(-34, -34, 68, 68);
    ctx.restore();
    if (a.cls !== 'mage') return;
    var rx = 30, ry = 9.5, k = Math.min(1, a.t / 250);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1;
    ctx.globalAlpha = 0.85; ctx.strokeStyle = '#b46aff';
    ctx.beginPath(); ctx.ellipse(x, y, rx * k, ry * k, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.7; ctx.strokeStyle = '#5ae6ff';
    ctx.beginPath(); ctx.ellipse(x, y, rx * 0.72 * k, ry * 0.72 * k, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#e8d0ff';
    for (var i = 0; i < 12; i++) {   // 두 고리 사이 도는 눈금
      var an = t * 1.6 + i * Math.PI / 6, ex = x + Math.cos(an) * rx * 0.86 * k, ey = y + Math.sin(an) * ry * 0.86 * k;
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 5 + i); ctx.fillRect(ex - 0.75, ey - 0.75, 1.5, 1.5);
    }
    ctx.globalAlpha = 0.55; ctx.strokeStyle = '#d8b0ff';
    [0, Math.PI].forEach(function (o) {   // 반대로 도는 두 삼각형(육망성)
      ctx.beginPath();
      for (var j = 0; j <= 3; j++) { var an2 = -t * 1.1 + o + j * Math.PI * 2 / 3, px = x + Math.cos(an2) * rx * 0.7 * k, py = y + Math.sin(an2) * ry * 0.7 * k; if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.stroke();
    });
    ctx.restore();
  }
  // 법사 룬 4개: 허리 높이 납작한 원을 따라 돎. back = 뒤쪽 반(캐릭터 뒤) / 앞쪽 반(캐릭터 앞). 룬 = 5x5 도트 글자(우리 그림)
  var RUNES = ['..#..|.###.|#.#.#|..#..|.#.#.', '#...#|.#.#.|..#..|.#.#.|#...#', '.###.|#...#|#.#.#|#...#|.###.', '#.#.#|.###.|..#..|..#..|.###.'];
  function drawRunes(camX, back) {
    var a = G.awk, p = G.player;
    if (!a || a.cls !== 'mage') return;
    var t = a.t / 1000, cx = p.x - camX, cy = p.y - (p.z || 0) - 44 * AS, rx = 30, ry = 8, k = Math.min(1, a.t / 300);
    ctx.save();
    RUNES.forEach(function (R, i) {
      var an = t * 2.2 + i * Math.PI / 2, sn = Math.sin(an);
      if ((sn < 0) !== back) return;
      var x = Math.round(cx + Math.cos(an) * rx * k), y = Math.round(cy + sn * ry * k + Math.sin(t * 3 + i) * 2), rows = R.split('|');
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = back ? 0.45 : 0.9;
      var gr = ctx.createRadialGradient(x, y, 0, x, y, 9); gr.addColorStop(0, i % 2 ? '#5ae6ff' : '#b46aff'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.fillRect(x - 9, y - 9, 18, 18);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = back ? 0.55 : 1;
      rows.forEach(function (row, ry2) { for (var cx2 = 0; cx2 < 5; cx2++) if (row[cx2] === '#') {   // 1.5 도트 점(폰에서도 보이게) + 진한 그림자
        var px = x - 3.75 + cx2 * 1.5, py = y - 3.75 + ry2 * 1.5;
        ctx.fillStyle = '#2a0a4a'; ctx.fillRect(px + 0.5, py + 0.5, 1.5, 1.5);
        ctx.fillStyle = i % 2 ? '#bff8ff' : '#f0dcff'; ctx.fillRect(px, py, 1.5, 1.5);
      } });
    });
    ctx.restore();
  }
  // 맨 위: 발밑에서 솟는 빛기둥(변신 순간 → 천천히 사라짐) + 화면 가장자리 직업 색 + 얼굴 컷인 띠
  function drawAwkOver(camX) {
    var a = G.awk, p = G.player, AW = CFG.awaken;
    if (!a) return;
    var A = a.A;
    if (a.intro < AW.introMs + 500) {   // 빛기둥
      var u = a.intro / (AW.introMs + 500), al = (u < 0.1 ? u / 0.1 : 1 - (u - 0.1) / 0.9), w = 18 * (1 + 0.6 * Math.min(1, u * 4)), x = p.x - camX;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.max(0, al) * 0.85;
      var g = ctx.createLinearGradient(x - w, 0, x + w, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, A.color); g.addColorStop(0.5, '#ffffff'); g.addColorStop(0.7, A.color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - w, -8, w * 2, p.y + 8);
      var g2 = ctx.createRadialGradient(x, p.y, 0, x, p.y, w * 2.2); g2.addColorStop(0, '#ffffff'); g2.addColorStop(0.4, A.color); g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2; ctx.fillRect(x - w * 2.2, p.y - w * 2.2, w * 4.4, w * 4.4);
      ctx.restore();
    }
    // 가장자리 직업 색(숨쉬듯, 끝나기 1.5초 전부터 깜빡여 알림)
    var left = a.ms - a.t, blink = left < 1500 ? 0.55 + 0.45 * Math.abs(Math.sin(a.t / 90)) : 1;
    var va = (0.42 + 0.1 * Math.sin(a.t / 160)) * blink + 0.3 * awkIntroK();
    ctx.save(); ctx.translate(LW / 2, LH / 2); ctx.scale(LW / 2, LH / 2);   // 화면 비율대로 납작한 둥근 물듦(위아래 가장자리도 물듦)
    var vg = ctx.createRadialGradient(0, 0, 0.62, 0, 0, 1.18);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, A.color);
    ctx.globalAlpha = Math.min(0.8, va); ctx.fillStyle = vg; ctx.fillRect(-1.1, -1.1, 2.2, 2.2); ctx.restore();
  }
  // 얼굴 컷인(보스 등장 컷인과 같은 방식, 플레이어 서 있는 그림의 머리·어깨를 크게 + 「각성!」 + 각성 이름)
  var faceBox = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function figTop(img, pv) {   // 그림 속 몸 맨 윗줄(그림 점). 못 읽으면 기준점 위 몸 높이쯤
    var v = faceBox && faceBox.get(img);
    if (v != null) return v;
    v = pv.y - 96 * AS / ((img._k) || 1);
    try {
      var c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      var g = c.getContext('2d'); g.drawImage(img, 0, 0);
      var d = g.getImageData(0, 0, c.width, c.height).data;
      outer: for (var y = 0; y < c.height; y++) for (var x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { v = y + ((img._oy) || 0); break outer; }
    } catch (e) {}
    if (faceBox) faceBox.set(img, v);
    return v;
  }
  function drawAwkCut() {
    var a = G.awk, p = G.player, AW = CFG.awaken;
    if (!a || a.intro >= AW.introMs + 40 || !p.char) return;
    var A = a.A, T = a.intro, ms = AW.introMs, inK = introEase(T / 150), outK = introEase((T - (ms - 160)) / 160);
    var by = Math.round(LH * 0.3), bh = Math.round(LH * 0.28), off = (1 - inK) * -LW * 0.9 + outK * LW * 0.9;
    ctx.save(); ctx.translate(off, 0);
    ctx.fillStyle = 'rgba(8,4,14,0.92)'; ctx.fillRect(-8, by, LW + 16, bh);
    var gr = ctx.createLinearGradient(0, 0, LW, 0);
    gr.addColorStop(0, A.color); gr.addColorStop(0.55, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.75; ctx.fillStyle = gr; ctx.fillRect(-8, by, LW + 16, bh); ctx.globalAlpha = 1;
    ctx.save(); ctx.beginPath(); ctx.rect(-8, by, LW + 16, bh); ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    for (var f = 0; f < 22; f++) {   // 빠르게 지나가는 빛 줄(속도선)
      var lx = ((f * 97 + T * (0.9 + (f % 5) * 0.25)) % (LW + 80)) - 40, ly = by + 2 + ((f * 37) % (bh - 4));
      ctx.globalAlpha = 0.35; ctx.fillStyle = f % 3 ? A.color : '#ffffff'; ctx.fillRect(Math.round(lx), ly, 18 + (f % 4) * 8, 1);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    // 얼굴: 서 있는 그림 1장(각성 색으로 칠한 것)을 머리·어깨가 띠에 꽉 차게 크게(도트 그대로)
    var im = p.char.anims.idle && p.char.anims.idle[0];
    if (im) {
      var L = p.look, body = L && L.paint ? L.paint(im) : im, pv = p.char.def.pivot, k = im._k || 1;
      var top = figTop(im, pv), hf = (pv.y - top) * k;     // 몸 높이(도트)
      var sc = bh / (hf * 0.42), fx = Math.round(LW * 0.28), headY = by + bh * 0.52;
      var sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
      ctx.translate(fx, headY + (pv.y - top) * k * sc * 0.83); ctx.scale(sc, sc);
      if (L && L.outline) { ctx.globalAlpha = 0.9; }
      Assets.blit(ctx, body, pv.x, pv.y);
      ctx.imageSmoothingEnabled = sm;
    }
    ctx.restore();
    ctx.fillStyle = A.color; ctx.fillRect(-8, by, LW + 16, 2); ctx.fillRect(-8, by + bh - 2, LW + 16, 2);
    // 글자: 각성 이름(작게, 직업 색) + 「각성!」(크게, 흰 글자 + 진한 테두리) — 꽝 하고 커졌다 돌아옴
    var nx = LW * 0.5, big = Math.round(bh * 0.46), pop = 1 + 0.45 * Math.max(0, 1 - (T - 80) / 160);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.font = '700 ' + Math.round(bh * 0.17) + 'px Galmuri, system-ui, sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = '#100410'; ctx.fillStyle = A.glow;
    ctx.strokeText(A.name, nx + 2, by + bh * 0.2); ctx.fillText(A.name, nx + 2, by + bh * 0.2);
    ctx.save(); ctx.translate(nx, by + bh * 0.62); ctx.scale(pop, pop);   // 글자 왼쪽 가운데 기준으로 커졌다 돌아옴
    ctx.font = '700 ' + big + 'px Galmuri, system-ui, sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = '#100410';
    ctx.strokeText('각성!', 0, 0); ctx.fillStyle = '#ffffff'; ctx.fillText('각성!', 0, 0);
    ctx.restore();
    ctx.restore();
  }

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
      var busy = e.state === 'attack' || e.state === 'hit' || e.state === 'down' || e.state === 'air' || e.state === 'stagger' || e.state === 'guard' || e.state === 'awaken' || e.hidden;
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
      if (e.mid) midDown(e);   // 중간보스(2026-11-06): 쓰러짐 연출 + 물약 꼭 하나
      else if (!e.T.boss) snd('pop');   // 쓰러진 잡몹 「펑」(보스는 onBossDown 의 bossDown)
      mobPotion(e);   // 물약(2026-11-06 밤)
      clubDrop(e);    // 첫 무기 몽둥이(2026-11-06, 1판 견습만)
      var n = Growth.enemyXp(e.type, e.T, idx);
      if (e.xpMul && n > 0) n = Math.max(1, Math.round(n * e.xpMul));   // 몹 떼(사냥 손맛): 한 마리 경험치 xpMul 배
      var MX = Growth.M().xp;
      if (MX && MX !== 1 && n > 0) n = Math.max(1, Math.round(n * MX));   // 난이도(2026-11-06): 노말·하드는 경험치 더
      if (!(n > 0) || Growth.isMax()) return;
      G.xpGot = (G.xpGot || 0) + n;
      // 경험치 구슬(사냥 손맛): 쓰러져 펑 할 때(hunt.death) 또는 지금 튀어나와 플레이어에게 빨려 듦. 그때는 「+5 XP」 글자 대신(hideXpText)
      var OB = huntPart('orbs');
      if (OB) { if (e.huntDeath && !e.T.boss) e.orbN = true; else spawnOrbs(e.x, e.y - e.T.height * 0.45 - (e.az || 0), OB); }
      if (!OB || !OB.hideXpText || e.T.boss || e.mid) FX.damage(e.x, e.y - e.T.height - 8, '+' + n + ' XP', false, J, null, 'xp', e.id + ':xp');
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
    snd('levelUp');
    if (LU.flash) Skills.flash(LU.flash);
    FX.impact(p.x, p.y - (p.z || 0) - 60 * AS, p.dir, LU.sparkCol || '#ffe066', Math.round(J.sparkCount * 1.4), true, G.assets.fx && G.assets.fx.impact, 1);

    checkUnlock(up);   // 기술 칸이 늘었으면(Lv10 · Lv13) 「축하합니다!」 알림(아래 openUnlock)
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
    snd('bossDown', boss.T.finalBoss ? { k: 0.8 } : null);
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
    G.enemies.forEach(function (e) { if (e !== boss && e.alive()) { e.noDrop = true; e.takeHit(9999, e.x > boss.x ? 1 : -1, 10, true, { force: true }); } });
    bossPotion(boss, 'death');
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
          var ne = spawnEnemy(S.queue[i].type, S.queue[i].side, S.queue[i].opt, S.queue[i].off); S.queue.splice(i, 1);
          if (ne.T.boss && !S.introDone) { S.introDone = true; startIntro(ne); }   // 보스 등장 컷인(판마다 한 번)
          if (ne.mid) midIntro(ne);   // 중간보스 등장(2026-11-06)
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
        snd('bossRoar', { k: 0.8 });
        Skills.flash({ color: AW.flash || '#ff3a8c', alpha: 0.55, ms: 520 });
        FX.shake(J.shakePx * AW.shake, 900);
        G.hitstop = Math.max(G.hitstop, 160);
        bossPotion(B, 'rage');   // 보스 물약(2026-11-06 밤): 마왕은 각성할 때
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
        snd('bossRoar');
        G.hitstop = Math.max(G.hitstop, RG.hitstopMs); G.slowT = Math.max(G.slowT, RG.slowMs);
        Skills.flash({ color: B.rageColor(), alpha: RG.flash, ms: 420 });
        FX.shake(J.shakePx * RG.shake, 700);
        pushPlayer(B, RG.push * AS);
        bossPotion(B, 'rage');   // 보스 물약(2026-11-06 밤): 화날 때 꼭 하나(보라)
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
          snd('waveClear');
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
    //   회피(2026-11-07) 중에도 적 몸을 뚫고 빠져나감(몹에 둘러싸였을 때 빠지는 기술)
    if (p.state !== 'dead' && p.state !== 'dodge' && !(p.state === 'skill' && Skills.passThrough(p)) && !((p.z || 0) > overZ)) list.push({ o: p, r: CFG.hero.radius, m: 1, hero: true });
    G.enemies.forEach(function (e) {
      if (!e.alive() || e.state === 'down' || e.hidden || e.airborne() || e.faded()) return;   // 넘어진 적은 밟고 지나갈 수 있음, 땅속(전갈 왕)·공중(두꺼비 배치기)·옅어진 유령 기사도 지나감
      var charging = e.state === 'attack' && e.atk && e.atk.spec.type === 'charge';
      list.push({ o: e, r: e.T.radius, m: charging ? 0 : (e.T.boss ? 0.08 : e.mid ? 0.3 : 1), boss: !!e.T.boss, out: !e.entered });
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
  // 콤보 자동 조종(2026-11-06 밤, G.botEager = 균형 시험 · GAME.test.botEager): 공격할 때마다 나갈 수 있는 기술 하나를 골라 누름(쿨타임·마나 되면 바로).
  //   서 있는(뜰 수 있는) 잡몹 = 띄우기 기술 먼저 → 떠 있으면 평타로 2번 이상 친 뒤 다른 기술로 이어 침(공중 타·캔슬) → 넘어지면 땅까지 닿는 기술(누운 적 때리기)
  function botSkill(p, best) {
    var bk = Growth.book(G.classKey), n = bk ? bk.slots() : 0, R = [];
    for (var i = 0; i < n; i++) { var q = Skills.ready(p, i); if (q) R.push(q); }
    if (!R.length) return;
    var air = best.state === 'air', up = R.filter(function (q) { return q.d.launcher; }), other = R.filter(function (q) { return !q.d.launcher; });
    var pick = null;
    if (air) { if ((best.airHits || 0) >= 2 && other.length) pick = other[Math.floor(Math.random() * other.length)]; }
    else if (up.length && best.canLaunch && best.canLaunch() && best.state !== 'down') pick = up[0];
    else if (other.length) pick = other[Math.floor(Math.random() * other.length)];
    else pick = up[0];
    if (pick) Input.pressSkill(pick.slot);
  }
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
    // 각성(2026-11-06 밤): 분노가 차면 적이 가까이 있을 때 바로 씀
    if ((G.rage || 0) >= 100 && !G.awk && Math.abs(best.x - p.x) < 170 * AS && Math.abs(best.y - p.y) < 50 * AS) Input.pressAwaken();
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
      if (G.botEager) botSkill(p, best);                        // 콤보 시험: 띄우기 → 공중 타 → 캔슬
      else if (Math.random() < 0.12) Input.pressSkill(botSlot());   // 가끔 기술(쿨타임·마나 모자람이면 안 나감)
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
      if (G.botEager) botSkill(p, best);   // 콤보 시험(2026-11-06 밤)
      else {
        var bk = Growth.book(G.classKey), n = bk ? bk.slots() : 2;
        for (var i = 0; i < n; i++) Input.pressSkill(Skills.slots[(i + Math.floor(Math.random() * n)) % n]);
      }
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
  // 회피(2026-11-07): 시작·끝 발밑 먼지(가는 반대쪽으로 날림) + 길 따라 잔상(직업 색, 새 그림 없이 지금 그림을 한 색으로 칠해 남김)
  function dodgeFx(p, ev) {
    var D = CFG.move.dodge, col = D.colors[G.classKey] || D.colors.novice;
    if (ev.dodge && ev.dodge.start) { var sx = ev.dodge.nx || -p.dir; dustAt(p.x, p.y, sx > 0 ? -1 : 1, D.dust); G.dodgeDir = sx; }
    if (ev.dodgeGhost) Skills.ghost(p, col, D.ghostMs, D.ghostAlpha);
    if (ev.dodge && ev.dodge.end) dustAt(p.x, p.y, (G.dodgeDir || p.dir) > 0 ? 1 : -1, D.dust * 0.8);
  }
  // 회피 버튼(폰): 쿨타임 중엔 시계 방향으로 어두움(--cd 1 → 0) / PC 아래 글자 칩도 같이
  var dodgeEls = null, dodgeLast = -1;
  function dodgeUi() {
    var p = G.player, D = CFG.move.dodge;
    if (!p || !D) return;
    if (!dodgeEls) dodgeEls = [document.getElementById('btnDodge'), document.getElementById('dodgeChip')].filter(Boolean);
    var f = Math.round(Math.max(0, Math.min(1, (p.dodgeCd || 0) / D.cdMs)) * 50) / 50;
    if (f === dodgeLast) return;
    dodgeLast = f;
    dodgeEls.forEach(function (el) { el.style.setProperty('--cd', f); el.classList.toggle('cool', f > 0); });
  }

  // ---------- 갱신 ----------
  function step(realMs) {
    if (G.paused) return;   // 스테이지 고르기 화면: 멈춤
    FX.updateShake(realMs);
    Skills.tickReal(realMs);
    if (G.callout) G.callout.t += realMs;     // 「5 KILL!」 글자(진짜 시간)
    if (intro) { introStep(realMs); return; }               // 보스 등장 컷인 동안: 게임 멈춤(2026-11-06 밤)
    if (G.vig > 0) G.vig = Math.max(0, G.vig - realMs / ((J.hurt && J.hurt.vigMs) || 600));   // 가장자리 빨강 줄어듦(진짜 시간)
    // 각성(2026-11-06 밤): 분노 100% 에 버튼·L·F → 변신. 맞는 순간 멈춤 중에 눌러도 바로(움찔·넘어짐·잡힘 중에는 눌러 둔 것을 잠깐 기억했다가)
    if (G.player && canAwaken(G.player) && Input.takeAwaken(300)) startAwaken();
    if (G.hitstop > 0) { G.hitstop -= realMs; return; }   // 멈춤: 아무것도 안 움직임
    var dt = realMs * J.timeScale;
    if (G.slowT > 0) { G.slowT -= realMs; dt *= 0.3; }
    if (G.mk.t > 0) G.mk.t -= dt;              // 몇 마리 잡기 이어서 세는 시간(사냥 손맛)
    if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) comboEl.hidden = true; }
    if (G.zoom) { G.zoom.t += realMs; if (G.zoom.t >= G.zoom.ms) G.zoom = null; }
    if (G.comboTagT > 0) G.comboTagT -= dt;
    var p = G.player;
    p.weaponKey = G.weaponKey;
    p.setMoveSet(G.moveSet);
    p.classKey = G.classKey; p.gender = G.charKey;   // 기술 고르기용
    p.atkSpd = Growth.atkSpd(); p.moveMul = Growth.moveMul();   // 민첩(성장 능력치): 휘두르기·이동 빠르기
    if (G.awk && G.awk.A.atkSpd) p.atkSpd = Math.min(G.awk.A.spdCap, p.atkSpd + G.awk.A.atkSpd);   // 각성 광전사: 더 빠르게(상한 있음)
    // 플레이어는 화면 끝까지(2026-11-06 형님 폰 접은 화면: 버튼 앞이 벽처럼 막힘). 버튼 밑 비우기는 적·물약만
    if (MODE === 'stage') { world.minX = G.camX + 14; world.maxX = G.camX + LW - 14; }
    if (G.bot && MODE === 'stage' && !G.stage.result) botThink(dt);
    awkStep(dt, realMs);   // 각성 시간·불꽃·잔상·끝 폭발
    var pst0 = p.state;
    var ev = p.update(dt, world);
    if (p.state === 'jump' && pst0 !== 'jump') snd('jump');
    if (ev.slash) {
      // fx 는 하나 또는 여러 개(법사 2타 = 바람 + 지팡이 끝 반짝임)
      var st0 = ev.slash.step;
      if (st0.cast) snd('magicShot'); else if (window.SFX) SFX.swing(p.weaponKey, !!st0.finisher);   // 휘두르는 소리(무기마다)
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
    if (ev.moveSwing) { moveSwingFx(p, ev.moveSwing.kind); if (window.SFX) SFX.swing(p.weaponKey, ev.moveSwing.kind !== 'jump'); }
    if (ev.land) { landFx(p); snd('land'); }
    if (ev.dodge && ev.dodge.start) snd('dodge');
    if (ev.dodge || ev.dodgeGhost) dodgeFx(p, ev);
    // 날아가는 마법탄: 처음 맞은 대상(또는 끝까지 날아간 곳)에서 터짐
    Projectiles.update(dt, hitTargets(), function (pr, t) { explode(pr.x, pr.y, pr.z, pr.st, pr.dir, pr.wk, t); });
    if (MODE === 'stage') {
      var E = G.ectx;
      E.now += dt; E.view.x0 = G.camX; E.view.x1 = G.camX + LW - (controlPad ? controlPad + 14 : 0);   // 적은 몸이 넓어서 버튼 쪽으로 조금 더 띄움
      G.enemies.forEach(function (e) {
        e.update(dt, E);
        if (e.state === 'air') { G.cstats.maxAirMs = Math.max(G.cstats.maxAirMs, e.airT); G.cstats.maxAirHits = Math.max(G.cstats.maxAirHits, e.airHits); }   // 콤보 기록
      });
      xpStep();             // 쓰러진 적 → 경험치(성장)
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
      fullStep(dt);          // 포만감: 체력 천천히 + 줄어듦(2026-11-06 밤)
      rageStep(dt);          // 분노: 싸움이 없으면 천천히 줆(2026-11-06 밤)
      awkPushStep(dt);       // 각성 변신 순간 밀려나는 적
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
    orbsStep(dt);          // 경험치 구슬(사냥 손맛)
    multiHitFx();          // 이 장면에 여러 마리 맞았으면 더 흔들림·멈춤·빛(사냥 손맛)
  }

  // ---------- 그리기 ----------
  function render() {
    var sh = FX.updateShake(0);
    ctx.setTransform(RS, 0, 0, RS, 0, 0);
    setSmooth();
    ctx.fillStyle = CFG.view.bg; ctx.fillRect(0, 0, LW, LH);
    ctx.translate(sh.x, sh.y);
    var camX = snap(G.camX);
    // 큰 기술 순간 화면 당기기(2026-11-06 밤, skills.js zoom): 플레이어 쪽으로 살짝 확대했다 돌아옴
    if (G.zoom && G.zoom.t < G.zoom.ms) {
      var zu = G.zoom.t / G.zoom.ms, zk = 1 + (G.zoom.k - 1) * Math.sin(Math.PI * Math.min(1, zu * 1.4)) * (zu < 0.7 ? 1 : (1 - zu) / 0.3);
      var zx = clamp(G.player.x - camX, LW * 0.3, LW * 0.7), zy = clamp(G.player.y - 40 * AS, LH * 0.35, LH * 0.75);
      ctx.translate(zx, zy); ctx.scale(zk, zk); ctx.translate(-zx, -zy);
    }

    if (MODE === 'stage') drawStageBg(camX);
    else {
      if (!bgCache) bgCache = buildBackground();
      ctx.drawImage(bgCache, -camX, 0, bgCache.width / RS, bgCache.height / RS);

    }
    Skills.drawBackdrop(ctx, LW, LH, G.player);   // 기술 쓰는 동안 배경만 어둡게
    drawAwkBackdrop();                            // 각성 변신 순간 배경 어둡게(2026-11-06 밤)

    // 바닥 위: 보스 공격 예고 띠, 먼지
    G.enemies.forEach(function (e) { e.drawTelegraph(ctx, camX); });
    if (puddles.length) drawPuddles(camX);        // 두꺼비 독 웅덩이(바닥)
    if (rocks.length) drawRocksUnder(camX);       // 바위 떨어질 자리 빨간 원 + 그림자
    if (cannons.length) drawCannonsUnder(camX);   // 대포알 떨어질 자리 그림자 + 빨간 원
    if (shots.length) drawShots(camX, true);      // 총알 그림자(지나가는 줄)
    FX.draw(ctx, camX, true);
    if (MODE === 'stage') Props.drawUnder(ctx, camX, LW);   // 소품 그림자·모닥불 빛
    Skills.drawUnder(ctx, camX, G.player);        // 번개 떨어질 자리 표시
    drawAwkUnder(camX);                           // 각성: 발밑 마법진·불빛
    // 깊이 순서(아래쪽 = 앞쪽). 각성 법사 룬은 몸 뒤 반 · 앞 반
    var ents = [{ y: G.player.y, d: function () { Skills.drawGhosts(ctx, camX); drawRunes(camX, true); G.player.draw(ctx, camX, G.assets.weapons, DEBUG); drawRunes(camX, false); } }];
    if (G.dummy) ents.push({ y: G.dummy.y, d: function () { G.dummy.draw(ctx, camX, DEBUG); } });
    G.enemies.forEach(function (e) { ents.push({ y: e.y + (e.alive() ? 0 : -0.5), d: function () { e.draw(ctx, camX, DEBUG); } }); });
    if (MODE === 'stage') Props.addDraw(ents, ctx, camX, LW, DEBUG);
    if (spikes.length) addSpikeDraw(ents, camX);   // 얼음 가시(땅에서 솟음 = 캐릭터와 깊이 순서)
    if (rings.length) addRingDraw(ents, camX);     // 화염 충격파 고리(바닥을 따라 퍼짐 = 캐릭터와 깊이 순서)
    Skills.addEnts(ents, ctx, camX);               // 땅 융기 돌기둥(땅에서 솟음 = 캐릭터와 깊이 순서, 2026-11-06 밤)
    ents.sort(function (a, b) { return a.y - b.y; });
    ents.forEach(function (e) { e.d(); });
    Projectiles.draw(ctx, camX);
    if (rocks.length) drawRocks(camX);            // 날아가는 바위(공중이라 캐릭터 위)
    if (shots.length) drawShots(camX, false);     // 날아가는 총알
    if (cannons.length) drawCannons(camX);        // 떨어지는 대포알
    Skills.drawOver(ctx, camX);                   // 번개 기둥·회전 원
    FX.draw(ctx, camX, false);
    drawOrbs(camX);                               // 경험치 구슬(사냥 손맛)
    Skills.drawFlash(ctx, LW, LH);
    drawCallout();                                // 「5 KILL!」(사냥 손맛)                // 기술 맞는 순간 화면 번쩍
    if (G.vig > 0.01) {                           // 플레이어가 맞음: 화면 가장자리 빨갛게(2026-11-06 밤)
      var vg = ctx.createRadialGradient(LW / 2, LH / 2, Math.min(LW, LH) * 0.35, LW / 2, LH / 2, Math.max(LW, LH) * 0.62);
      vg.addColorStop(0, 'rgba(200,0,20,0)'); vg.addColorStop(1, 'rgba(200,0,20,' + (0.55 * G.vig).toFixed(3) + ')');
      ctx.fillStyle = vg; ctx.fillRect(-8, -8, LW + 16, LH + 16);
    }
    drawAwkOver(camX);                            // 각성: 빛기둥 · 화면 가장자리 직업 색
    drawAwkCut();                                 // 각성 얼굴 컷인 「각성!」
    drawIntro();                                  // 보스 등장 컷인(맨 위)

    if (DEBUG) drawDebug(camX);
    if (MODE === 'stage') updateHud();
    if (Skills.ui(G)) controlPad = measureControlPad();   // 기술 버튼이 생기거나 사라지면 버튼 자리 다시 재기
    dodgeUi();                                    // 회피 버튼 쿨타임
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
  ['pHp', 'pHpLag', 'pHpNum', 'pMp', 'pMpNum', 'pFull', 'pRage', 'pRageNum', 'btnAwk', 'awkPct', 'awkChip', 'pLv', 'pXp', 'bossBar', 'bHp', 'bHpLag', 'bossName', 'midBar', 'mHp', 'mHpLag', 'midName', 'goPrompt', 'banner', 'stageInfo'].forEach(function (k) { hud[k] = document.getElementById(k); });
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
    // 포만감(2026-11-06 밤): 막대 없이 글자만. 0% = 회색(회복 멈춤)
    setIf('pfull', Math.ceil(G.full || 0), function (v) { hud.pFull.textContent = '포만감 ' + v + '%'; hud.pFull.classList.toggle('empty', v <= 0); });
    // 분노 막대(2026-11-06 밤): 평소 = 분노 %(가득 = 빛남), 각성 중 = 남은 시간(직업 색) + 각성 이름. 각성 버튼(폰)·글자(PC)도 같이
    var A = G.awk, rg = A ? Math.max(0, 1 - A.t / A.ms) : (G.rage || 0) / 100, rs = A ? 'awk awk-' + A.cls : rg >= 1 ? 'full' : '';
    setIf('prg', Math.round(rg * 200) / 200, function (v) { hud.pRage.style.width = (v * 100) + '%'; });
    setIf('prgn', A ? '각성 ' + Math.max(0, Math.ceil((A.ms - A.t) / 1000)) + '초' : Math.floor(G.rage || 0) + '%', function (v) { hud.pRageNum.textContent = v; });
    setIf('prgc', rs, function (v) {
      hud.pRage.parentNode.parentNode.className = 'prg ' + v;
      var ready = v === 'full';
      [hud.btnAwk, hud.awkChip].forEach(function (el) { if (el) { el.classList.toggle('ready', ready); el.classList.toggle('on', !!A); } });
    });
    setIf('pawkf', A ? 1 : Math.floor((G.rage || 0) / 5) / 20, function (v) { if (hud.btnAwk) hud.btnAwk.style.setProperty('--rg', v); });
    setIf('pawkp', A ? '' : Math.floor(G.rage || 0) + '%', function (v) { if (hud.awkPct) hud.awkPct.textContent = v; });   // 폰 각성 마름모 왼쪽 분노 %(가득·각성 중엔 CSS 가 숨김)
    // 레벨 + 경험치 막대(성장). 최고 레벨이면 「Lv 60 MAX」(최고 레벨 = config growth.maxLv) + 막대 가득
    setIf('plv', Growth.lv, function (v) {
      hud.pLv.textContent = 'Lv ' + v + (Growth.isMax() ? ' MAX' : '');
      var box = hud.pLv.parentNode; box.classList.toggle('max', Growth.isMax());
      if (lastHud.plvSeen && v > lastHud.plvSeen) { box.classList.remove('up'); void box.offsetWidth; box.classList.add('up'); }
      lastHud.plvSeen = v;
    });
    setIf('pxp', Growth.isMax() ? 1 : Growth.xp / Growth.need(), function (v) { hud.pXp.style.width = (v * 100) + '%'; });
    setIf('face', p.char && p.char.anims.idle && p.char.anims.idle[0], drawFace);   // 얼굴 액자: 옷·성별이 바뀔 때만 다시 그림
    setIf('club', !!(Growth.club && G.classKey === 'novice'), drawClubIcon);   // 몽둥이(2026-11-06): 얼굴 액자 오른쪽 아래 작은 그림
    setIf('pts', Growth.pts, statBadges);   // 안 쓴 능력치 점수 표시
    var bk = Growth.book(G.classKey);
    setIf('skpts', G.classKey + ':' + (bk ? bk.pts() : -1), skillBadges);   // 안 쓴 기술 점수 표시(견습 = 기술 버튼 숨김)
    var B = S.boss, showBoss = !!(B && (B.alive() || S.bossDownT < 800));
    setIf('bshow', showBoss, function (v) { hud.bossBar.hidden = !v; });
    if (B) setIf('bname', B.label, function (v) { hud.bossName.textContent = v; });
    if (B) setIf('bhp', B.hp / B.maxHp, function (v) { hud.bHp.style.width = (v * 100) + '%'; hud.bHpLag.style.width = (v * 100) + '%'; });
    // 중간보스 막대(2026-11-06): 보스 막대 자리에 작게(보스와 같이 나오지 않음)
    var MB = S.mid, showMid = !!(MB && (MB.alive() || MB.deadT < 800)) && !showBoss;
    setIf('mshow', showMid, function (v) { if (hud.midBar) hud.midBar.hidden = !v; });
    if (MB && hud.midBar) {
      setIf('mname', MB.label, function (v) { hud.midName.textContent = v; });
      setIf('mhp', MB.hp / MB.maxHp, function (v) { hud.mHp.style.width = (v * 100) + '%'; hud.mHpLag.style.width = (v * 100) + '%'; });
    }
    var waves = CFG.stage.waves;
    var go = !S.locked && S.next > 0 && S.next < waves.length && G.camX < S.lastLock + 70 && p.state !== 'dead';
    setIf('go', go, function (v) { hud.goPrompt.hidden = !v; });
    var wi = Math.min(waves.length, S.locked ? S.waveIdx + 1 : S.next + (S.next < waves.length ? 0 : 0));
    // 판 이름 앞에 난이도(2026-11-06): 「노말 · STAGE 3  늪지대  ·  2 / 7」
    setIf('info', Growth.mode() + wi + '/' + waves.length, function () { hud.stageInfo.textContent = Growth.M().name + ' · ' + CFG.stage.name + '  ·  ' + Math.max(1, wi) + ' / ' + waves.length; });
  }
  // 얼굴 액자(2026-11-06 UI A): 지금 옷 서 있는 그림 1장의 머리~가슴을 HUD 왼쪽 위 작은 캔버스(pFace)에 도트 그대로 크게
  var faceEl = document.getElementById('pFace');
  function drawFace(im) {
    if (!faceEl || !im || !G.player.char) return;
    var g = faceEl.getContext('2d'), W = faceEl.width, H = faceEl.height, pv = G.player.char.def.pivot, k = im._k || 1;
    var top = figTop(im, pv), hf = (pv.y - top) * k;        // 몸 높이(도트)
    var sc = H / Math.max(8, hf * 0.42);                      // 몸 위쪽 42%(머리·어깨)가 액자에 꽉
    g.clearRect(0, 0, W, H);
    g.save(); g.imageSmoothingEnabled = false;
    g.translate(Math.round(W * 0.47), Math.round(H * 0.08 + hf * sc)); g.scale(sc, sc);
    Assets.blit(g, im, pv.x, pv.y);
    g.restore();
  }
  // 몽둥이 작은 그림(2026-11-06): props.js 의 바닥 그림을 그대로 작은 캔버스에
  function drawClubIcon(on) {
    var c = document.getElementById('pClub'); if (!c) return;
    c.style.display = on ? '' : 'none';
    if (!on || c._done) return;
    var im = Props.clubImg(), g = c.getContext('2d');
    g.imageSmoothingEnabled = false; g.clearRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0);
    c._done = true;
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
    var opened = clear ? saveCleared(CFG.stage.id) : null;   // 깬 판 id 저장(지금 난이도). 마지막 판이면 다음 난이도가 열림(2026-11-06)
    if (clear && G.run) G.run.ms[CFG.stage.id] = S.time;
    var tot = 0, full = !!G.run && G.run.from === STAGES[0].id;
    if (end && full) STAGES.forEach(function (st) { if (G.run.ms[st.id] != null) tot += G.run.ms[st.id]; else full = false; });
    document.getElementById('resTitle').textContent = !clear ? 'GAME OVER' : last || end ? 'ALL CLEAR!' : 'STAGE CLEAR!';
    resultEl.className = 'result ' + kind + (clear && (last || end) ? ' all' : '') + (end ? ' ending' : '');
    document.getElementById('resStats').innerHTML =
      (end ? '<span class="endline">마왕을 쓰러뜨렸다!</span>' + (full ? '1단계부터 총 시간 <b>' + fmtTime(tot) + '</b><br>' : '') : clear && last ? '모든 스테이지를 깼다!<br>' : '') +
      '시간 <b>' + fmtTime(S.time) + '</b> · 맞힌 수 <b>' + G.hits + '</b> · 최대 콤보 <b>' + G.maxCombo + '</b>' +
      (clear ? ' · 남은 체력 <b>' + p.hp + '</b>' : '') +
      '<br>얻은 경험치 <b>' + (G.xpGot || 0) + '</b> · <b>Lv ' + Growth.lv + '</b>' +
      (opened ? '<br><span class="endline">' + CFG.modes[opened].name + ' 난이도가 열렸다!</span>' : '');
    var nx = document.getElementById('btnNext');
    nx.hidden = !(clear && !last && !end);
    var focus = clear && !last && !end ? nx : clear ? document.getElementById('btnSel') : document.getElementById('btnRetry');
    snd(clear ? 'stageClear' : 'fail');
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
    G.full = CFG.fullness ? CFG.fullness.start : 0; G.fullAcc = 0; G.potGot = 0;   // 포만감·물약(2026-11-06 밤): 판마다 처음부터
    G.rage = 0; G.combatT = 0; G.awk = null; G.awkCount = 0; awkPush.length = 0;   // 분노·각성(2026-11-06 밤): 판 시작 = 0
    G.mh = newMh(); G.mk = { n: 0, t: 0 }; G.callout = null; G.kills = 0; G.bestKill = 0; orbs.length = 0;   // 사냥 손맛
    G.clubN = 0;   // 몽둥이(2026-11-06): 이 판에서 센 잡몹 수
    FX.setHunt && FX.setHunt(huntPart('dmgNum'));
    G.hits = 0; G.totalDmg = 0; G.maxCombo = 0; G.comboT = 0; G.cstats = { launch: 0, air: 0, otg: 0, cancel: 0, maxAirMs: 0, maxAirHits: 0 }; G.comboTagT = 0; G.hitstop = 0; G.slowT = 0; comboEl.hidden = true;
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
    focus = modeTabs();   // 난이도 탭(2026-11-06): 방금 탭을 눌렀으면 그 탭에 초점
    list.innerHTML = '';
    STAGES.forEach(function (st, i) {
      var n = i + 1, b = document.createElement('button'), open = isOpen(n), done = !!cleared[st.id];
      b.type = 'button'; b.className = 'sbtn' + (open ? '' : ' locked') + (done ? ' cleared' : '');
      b.disabled = !open;
      b.innerHTML = '<b>' + st.id + '</b><span>' + (open ? st.name.replace(/^STAGE\s*\d+\s*/, '') : '잠김') + '</span>' + (done ? '<i>클리어</i>' : '');
      b.addEventListener('click', function () { closeMenu(selEl); G.paused = false; goStage(n); });
      list.appendChild(b);
      if (open && !modeTabFocus && (n === G.stageNo || !focus)) focus = b;
    });
    modeTabFocus = false;
    closeMenu(resultEl);
    G.paused = true;
    Input.setOverride(null);
    openMenu(selEl, focus);
  }
  // 난이도 탭(2026-11-06, config modes): 이지 / 노말 / 하드. 잠긴 난이도 = 자물쇠 + 「이지 10판 클리어 시 열림」(못 누름)
  //   누르면 그 난이도로 바꾸고(저장) 판 목록을 그 난이도의 깬 판으로 다시 그림. 돌려주는 값 = 방금 누른 탭(초점 줄 곳)
  var modeTabFocus = false;
  function modeTabs() {
    var box = document.getElementById('modeTabs'), O = CFG.modes, cur = Growth.mode(), out = null, last = STAGES[STAGES.length - 1].id;
    if (!box || !O) return null;
    box.innerHTML = '';
    O.order.forEach(function (k, i) {
      var b = document.createElement('button'), open = Growth.modeOpen(k), M = O[k];
      b.type = 'button'; b.className = 'mtab mt-' + k + (k === cur ? ' on' : '') + (open ? '' : ' locked');
      b.disabled = !open;
      b.setAttribute('aria-pressed', k === cur ? 'true' : 'false');
      b.innerHTML = '<b>' + M.name + '</b>' + (open ? '' : '<small>' + O[O.order[i - 1]].name + ' ' + last + '판 클리어 시 열림</small>');
      b.addEventListener('click', function () {
        if (k === Growth.mode() || !Growth.setMode(k)) return;
        modeTabFocus = true; openStageSelect();
      });
      box.appendChild(b);
      if (modeTabFocus && k === cur) out = b;
    });
    return out;
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
      pushPlayer: pushPlayer,                                                  // 10단계 마왕 각성 포효(밀어냄)
      deathPop: deathPop                                                       // 사냥 손맛: 쓰러진 잡몹 펑 + 경험치 구슬
    };
    var HD = hordeOf(null);   // 몹 떼(사냥 손맛): 동시에 때리러 오는 잡몹 수·공격 시작 간격을 따로
    if (HD && hordeMulOf(null, HD) > 1) { E.maxAttackers = HD.maxAttackers; E.attackGapMs = HD.attackGapMs; }   // 떼가 늘어난 판만
    Object.defineProperty(E, 'player', { get: function () { return G.player; } });
    return E;
  }

  // ---------- 고르기 버튼 ----------
  // 직업 버튼(견습/기사/법사)은 시험 도구(2026-11-06): 모든 판을 열어 둔 시험 기간(stagesAllOpen)에만 보임.
  //   눌러도 이번 창의 옷·무기만 바뀌고 저장된 직업(Growth.cls)은 그대로
  //   2026-11-06 UI A: 남/여 · 직업 · 연습장 = 시험 도구 묶음(#testTools, 오른쪽 위 「시험」 탭) 통째로 시험 기간에만. 연습장 안에서는 돌아갈 길이라 늘 보임
  function bindToggles() {
    var tools = document.getElementById('testTools');
    if (tools) tools.hidden = !CFG.stagesAllOpen && MODE !== 'practice';
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
    document.querySelectorAll('.statbtn .badge, .statopen:not(.skopen) .badge').forEach(function (b) { b.hidden = !n; b.textContent = n > 99 ? '99+' : n; });
  }
  function renderStats() {
    var rows = document.getElementById('statRows'), focusK = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.k;
    document.getElementById('statPts').textContent = Growth.pts;
    document.getElementById('statSum').textContent = 'Lv ' + Growth.lv + ' · ' + ((CFG.classes[G.classKey] || {}).label || '');
    var wpn = document.getElementById('statWpn');   // 첫 무기 몽둥이(2026-11-06): 견습 옷 + 주웠을 때만
    if (wpn) { var cOn = !!(Growth.club && G.classKey === 'novice' && CFG.club); wpn.hidden = !cOn; if (cOn) wpn.textContent = '무기: 몽둥이 (공격 +' + Math.round(CFG.club.atk * 100) + '%)'; }
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
  document.querySelectorAll('.statopen:not(.skopen)').forEach(function (b) { b.addEventListener('click', function () { openStats(); }); });
  document.getElementById('btnStatAuto').addEventListener('click', function () { if (Growth.auto(G.classKey)) { refreshGrowth(); renderStats(); } });
  document.getElementById('btnStatReset').addEventListener('click', function () { Growth.reset(); refreshGrowth(); renderStats(); });
  document.getElementById('btnStatClose').addEventListener('click', closeStats);
  window.addEventListener('keydown', function (e) { if (e.code === 'Escape' && !statEl.hidden) { e.preventDefault(); closeStats(); } });
  G.openStats = openStats; G.closeStats = closeStats;

  // ---------- 기술 창 (2026-11-06 성장 4단계 → 2026-11-06 책 모양, 형님 승인 시안. 수치 = config skills · SKILL_TREE, 계산·저장 = growth.js 의 기술 책 Growth.book) ----------
  // 여는 곳: 「능력치」 옆 「기술」 · 스테이지 고르기 · 결과 화면(견습은 버튼이 안 보임). 여는 동안 게임 멈춤, 닫으면 원래대로
  //   펼친 책: 왼쪽 쪽 = 쓰는 기술(2줄씩), 오른쪽 쪽 = 늘 켜진 기술. 칸 하나 = 그림(js/icons.js) · 이름 · Lv n/5 · 짧은 설명(config short) · 초록 +
  //     잠김 = 회색 그림 + 자물쇠 Lv N, 아직 안 만든 기술 = 준비 중. 늘 켜진 기술은 짧은 설명 대신 지금 값(초록 글자)
  //   아래 띠 = 기술 칸(열린 칸 + 잠긴 칸은 자물쇠 · 열리는 Lv). 끼우기 = 쓰는 기술을 누르고(고름) → 칸을 누름(다른 칸에 있으면 자리 바꿈)
  //     고른 게 없을 때 찬 칸을 누르면 그 칸 기술을 고름(→ 다른 칸을 누르면 옮김). + = 기술 점수 1점으로 Lv +1(최고 5), 초기화 = 기술 점수 전부 돌려받음(공짜)
  var skEl = document.getElementById('skillPanel'), skBack = null, skSel = null;   // skSel = 칸에 끼우려고 고른 쓰는 기술 id
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
  // 기술 숫자(칸에 손을 올리면 보이는 글): 쓰는 기술 = 마나·쿨타임·위력(+ 다음 Lv), 늘 켜진 기술 = 지금 값(+ 다음 Lv)
  function skillNums(bk, e, d, lv) {
    var max = CFG.skills.maxLv || 5, show = Math.max(1, lv);
    if (d) {
      var L = Skills.lvStat(d, show), N = show < max ? Skills.lvStat(d, show + 1) : null;
      var t = 'MP ' + L.mp + ' · 쿨타임 ' + secTxt(L.cd) + ' · 위력 ' + pctTxt(L.dmg);
      if (N && lv) t += '  →  Lv' + (show + 1) + ': MP ' + N.mp + ' · ' + secTxt(N.cd) + ' · ' + pctTxt(N.dmg);
      return t;
    }
    return passiveNow(e, show) + (show < max && lv ? '  →  Lv' + (show + 1) + ': ' + passiveNow(e, show + 1) : '');
  }
  // 늘 켜진 기술의 그 Lv 값: 「물리 공격 +12%」
  //   2차(2026-11-06): 투지 「체력 적으면 공격 최대 +20%」 · 반격 「반격 확률 30%」 · 마나 방패 「피해의 20% 마나로」 · 원소 낙인 「낙인 찍힌 적 피해 +10%」
  function passiveNow(e, lv) {
    var P = e.passive, v = pctTxt(P.val[Math.max(1, lv) - 1]);
    if (P.stat === 'shield') return '피해의 ' + v + ' 마나로';
    var k = { phys: '물리 공격 +', magic: '마법 공격 +', guard: '받는 피해 -', mpRegen: '마나 회복 +',
              grit: '체력 적으면 공격 최대 +', counter: '반격 확률 ', brand: '낙인 찍힌 적 피해 +' }[P.stat] || '';
    return k + v;
  }
  // 기술 그림(js/icons.js, 금테 액자 포함): css = 화면 크기(px), gray = 회색(잠김 · 준비 중). 기기 점에 가장 가까운 정수 배로 그림
  function skIcon(id, css, gray) {
    var c, dpr = window.devicePixelRatio || 1;
    if (window.PixelIcons && PixelIcons.meta[id]) c = PixelIcons.canvas(id, Math.max(1, Math.round(css * dpr / 32)), { frame: true, gray: !!gray });
    else { c = document.createElement('canvas'); c.width = c.height = 1; }
    c.style.width = c.style.height = css + 'px';
    return c;
  }
  function renderSkills() {
    var bk = Growth.book(G.classKey);
    if (!bk) { if (!skEl.hidden) closeSkills(); return; }
    var focusK = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.sk : null;
    var max = CFG.skills.maxLv || 5, S = CFG.skills[bk.cls], pts = bk.pts(), slots = bk.slots(), bar = bk.bar();
    if (skSel && !(bk.isActive(skSel) && bk.unlocked(skSel))) skSel = null;
    document.getElementById('skPts').textContent = pts;
    document.getElementById('skSum').textContent = 'Lv ' + Growth.lv + ' · ' + ((CFG.classes[G.classKey] || {}).label || '') +
      (bk.test ? ' · 시험 기술(저장 안 함)' : '');
    // 책 두 쪽: 쓰는 기술(왼쪽) · 늘 켜진 기술(오른쪽)
    var actEl = document.getElementById('skAct'), pasEl = document.getElementById('skPas');
    actEl.innerHTML = ''; pasEl.innerHTML = '';
    bk.list().forEach(function (e) {
      var d = S[e.id] && S[e.id].name ? S[e.id] : null, open = bk.unlocked(e.id), lv = bk.lv(e.id), canPick = bk.isActive(e.id) && open;
      var name = d ? d.name : e.name, st = e.soon ? 'soon' : !open ? 'lock' : '', at = bar.indexOf(e.id);
      var c = document.createElement('div');
      c.className = 'cell' + (st ? ' ' + st : '') + (skSel === e.id ? ' sel' : '');
      c.title = name + ' — ' + ((d ? d.desc : e.desc) || '') + (st ? '' : '\n' + skillNums(bk, e, d, lv)) +
        (d && d.lv5 && d.lv5.say && !st ? '\nLv5: ' + d.lv5.say : '');
      // 고르기(쓰는 기술 · 열림만 버튼): 그림 + 이름 · Lv · 짧은 설명
      var pick = document.createElement(canPick ? 'button' : 'div');
      pick.className = 'cpick';
      if (canPick) { pick.type = 'button'; pick.dataset.sk = e.id + ':pick'; pick.setAttribute('aria-label', name + ' 고르기'); }
      pick.appendChild(skIcon(e.id, 40, !!st));
      var tag = st === 'soon' ? '<span class="tag">준비 중</span>' : st === 'lock' ? '<span class="tag lk">Lv' + e.unlock + '</span>' : '<span class="lvl">Lv ' + lv + '/' + max + '</span>';
      var line = !st && e.passive && e.passive.val ? passiveNow(e, lv) : (e.short || '');
      pick.insertAdjacentHTML('beforeend', '<span class="nm"><span class="l1"><b>' + name + '</b>' + tag + '</span><span class="sd">' + line + '</span></span>');
      c.appendChild(pick);
      var plus = document.createElement('button');
      plus.type = 'button'; plus.className = 'plus' + (lv >= max ? ' max' : ''); plus.dataset.sk = e.id + ':+';
      plus.setAttribute('aria-label', name + ' 올리기'); plus.textContent = lv >= max ? 'MAX' : '+';
      plus.disabled = !(pts > 0 && open && lv < max);
      c.appendChild(plus);
      if (at >= 0) c.insertAdjacentHTML('beforeend', '<span class="eq">' + slotKey(at) + '</span>');   // 끼운 칸 번호
      (e.passive ? pasEl : actEl).appendChild(c);
    });
    // 아래 띠: 기술 칸(열린 칸 = 누를 수 있음, 잠긴 칸 = 자물쇠 + 열리는 Lv) + 도움말
    var bEl = document.getElementById('skBar'), all = CFG.skills.slots || [2, 4];
    bEl.innerHTML = '<b class="bl">기술 칸</b>';
    for (var i = 0; i < all[all.length - 1]; i++) {
      var id = bk.at(i), locked = i >= slots, b = document.createElement('button');
      b.type = 'button'; b.dataset.sk = ':s' + i; b.disabled = locked;
      b.className = 'bslot' + (locked ? ' locked' : !id ? ' empty' : '') + (skSel && !locked ? ' tgt' : '') + (id && id === skSel ? ' cur' : '');
      b.setAttribute('aria-label', (i + 1) + '번 칸' + (id ? ' ' + S[id].name : ''));
      b.innerHTML = '<kbd>' + slotKey(i) + '</kbd>';
      if (id) b.appendChild(skIcon(id, 32));
      else b.insertAdjacentHTML('beforeend', '<i class="bph"></i>');
      b.insertAdjacentHTML('beforeend', '<small>' + (id ? S[id].name : locked ? 'Lv' + bk.slotLv(i) : '빈 칸') + '</small>');
      bEl.appendChild(b);
    }
    var sd = skSel && S[skSel], sL = sd && Skills.lvStat(sd, bk.lv(skSel));
    bEl.insertAdjacentHTML('beforeend', '<span class="hint">' + (sd ? '<b>' + sd.name + '</b> MP ' + sL.mp + ' · 쿨타임 ' + secTxt(sL.cd) : '기술을 고르고') +
      '<br><em>칸을 누르면 끼워져요</em></span>');
    skEl.querySelectorAll('.spread button[data-sk], .skbar button[data-sk]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.dataset.sk.split(':'), bk2 = Growth.book(G.classKey);
        if (!bk2) return;
        if (a[1] === '+') bk2.add(a[0]);
        else if (a[1] === 'pick') skSel = skSel === a[0] ? null : a[0];
        else {   // 칸: 고른 기술을 끼움 / 고른 게 없으면 그 칸 기술을 고름
          var k = +a[1].slice(1);
          if (skSel) { bk2.put(k, skSel); skSel = null; }
          else skSel = bk2.at(k) || null;
        }
        refreshGrowth(); renderSkills();
      });
    });
    document.getElementById('btnSkReset').disabled = !bk.used();
    skillBadges();
    // 다시 그린 뒤 키보드 자리 되돌리기(+ 가 꺼졌으면 닫기로)
    var fb = focusK && skEl.querySelector('button[data-sk="' + focusK + '"]:not([disabled])');
    if (fb) fb.focus({ preventScroll: true });
    else if (focusK && skEl.contains(document.activeElement) === false) document.getElementById('btnSkClose').focus({ preventScroll: true });
  }
  function openSkills() {
    if (!skEl.hidden || !Growth.book(G.classKey)) return;
    skBack = { menu: menuEl && !menuEl.hidden ? menuEl : null, paused: G.paused };
    G.paused = true; Input.setOverride(null);
    skSel = null;
    renderSkills();
    openMenu(skEl, skEl.querySelector('.plus:not([disabled])') || document.getElementById('btnSkClose'));
  }
  function closeSkills() {
    closeMenu(skEl);
    skSel = null;
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

  // ---------- 기술 칸 열림 알림 (2026-11-06 폰 UI): 레벨업으로 기술 칸이 늘면(config skills.moreLv = Lv10 · Lv13) 한 번 ----------
  //   「축하합니다!」 + 칸 줄(새로 열린 칸 = 빛남, 아직 잠긴 칸 = 자물쇠) + 확인. 여는 동안 게임 멈춤(다른 창처럼), 닫으면 원래대로.
  //   저장된 직업의 기술 책만(시험 버튼으로 입은 다른 직업 = 늘 4칸이라 안 뜸). 시험 자동 조종(G.bot)은 안 띄움(멈추지 않게)
  var upEl = document.getElementById('unlockPop'), upBack = null;
  function slotsAtLv(lv) {
    var S = CFG.skills.slots || [2, 4], M = [].concat(CFG.skills.moreLv || 13), n = S[0];
    M.forEach(function (l, k) { if (lv >= l && S[k + 1] != null) n = S[k + 1]; });
    return n;
  }
  function checkUnlock(up) {
    var bk = Growth.book(G.classKey);
    if (!bk || bk.test || MODE !== 'stage' || G.bot) return;
    var before = slotsAtLv(Growth.lv - up), now = bk.slots();
    if (now > before) openUnlock(before, now);
  }
  function openUnlock(from, to) {
    var bk = Growth.book(G.classKey), S = CFG.skills[bk.cls], all = CFG.skills.slots || [2, 4], row = document.getElementById('upSlots');
    document.getElementById('upLv').textContent = 'Lv ' + Growth.lv;
    row.innerHTML = '';
    for (var i = 0; i < all[all.length - 1]; i++) {
      var id = bk.at(i), c = document.createElement('div');
      c.className = 'upslot' + (i >= to ? ' locked' : i >= from ? ' new' : '') + (id ? '' : ' empty');
      c.innerHTML = '<kbd>' + slotKey(i) + '</kbd>';
      if (id) c.appendChild(skIcon(id, 48)); else c.insertAdjacentHTML('beforeend', '<i class="bph"></i>');
      c.insertAdjacentHTML('beforeend', '<small>' + (i >= to ? 'Lv' + bk.slotLv(i) : id ? S[id].name : '빈 칸') + '</small>');
      row.appendChild(c);
    }
    if (!upEl.hidden) return;
    snd('unlock');
    upBack = { menu: menuEl && !menuEl.hidden ? menuEl : null, paused: G.paused };
    G.paused = true; Input.setOverride(null);
    openMenu(upEl, document.getElementById('btnUpOk'));
  }
  function closeUnlock() {
    if (upEl.hidden) return;
    closeMenu(upEl);
    var B = upBack || {}; upBack = null;
    G.paused = !!B.paused;
    if (B.menu && !B.menu.hidden) openMenu(B.menu, B.menu.querySelector('button:not([hidden])'));
  }
  document.getElementById('btnUpOk').addEventListener('click', function () { closeUnlock(); this.blur(); });
  window.addEventListener('keydown', function (e) { if (e.code === 'Escape' && !upEl.hidden) { e.preventDefault(); closeUnlock(); } });
  G.openUnlock = openUnlock;
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
    // 물약·포만감 시험(2026-11-06 밤): 플레이어 앞 dx 도트에 물약(kind 없으면 비율로) / 포만감 바로 정하기
    potion: function (kind, dx) { var p = G.player; return Props.dropPotion(p.x + (dx || 50), p.y, 1, kind); },
    full: function (n) { G.full = n; return G.full; },
    // 분노·각성 시험(2026-11-06 밤): 분노 바로 정하기 / 바로 각성(분노 100 으로 채우고 누름)
    rage: function (n) { G.rage = n == null ? 100 : n; return G.rage; },
    awaken: function () { G.rage = 100; Input.pressAwaken(); },
    hurt: function (n, heavy) { var p = G.player; p.invulnT = 0; p.takeHit(n || 10, -p.dir, 10, 0, !!heavy); },
    god: function (on) { G.player.god = on !== false; },
    // 경험치 바로 주기(성장 시험): GAME.test.xp(500)
    xp: function (n) { var up = Growth.gain(n); if (up > 0) onLevelUp(up); return { lv: Growth.lv, xp: Growth.xp, need: Growth.need() }; },
    // 치명타 고정(true = 늘 / false = 안 남 / null = 확률대로): GAME.test.crit(true)
    crit: function (v) { G.forceCrit = v == null ? null : !!v; },
    // 몽둥이 시험(2026-11-06): club() = 지금 상태, club(true/false) = 이번 창에서만 있음/없음(저장 안 함), clubDrop(dx) = 플레이어 앞에 떨어뜨림
    club: function (on) { if (on != null) Growth.club = !!on; return { club: Growth.club, n: G.clubN || 0, ground: Props.clubs.length, wanted: clubWanted() }; },
    clubDrop: function (dx) { var p = G.player; return Props.dropClub(p.x + (dx || 50), p.y, 1); },
    // 능력치 바로 바꾸기(시험): GAME.test.stats({ str: 10 }) → 남은 점수에서 뺌(모자라면 있는 만큼)
    stats: function (o) { Object.keys(o || {}).forEach(function (k) { Growth.add(k, o[k]); }); refreshGrowth(); return { stats: Growth.stats, pts: Growth.pts }; },
    bot: function (on) { G.bot = on !== false; if (!G.bot) Input.setOverride(null); },
    // 콤보 자동 조종(균형 시험, 2026-11-06 밤): 공격 때마다 기술 하나를 골라 누름(띄우기 → 공중 타 → 캔슬)
    botEager: function (on) { G.botEager = on !== false; },
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
        food: Props.food.map(function (f) { return f.kind + '@' + Math.round(f.x) + ',' + Math.round(f.y); }),
        potions: Props.potions.map(function (f) { return f.kind + '@' + Math.round(f.x) + ',' + Math.round(f.y); }), full: Math.round((G.full || 0) * 10) / 10, potGot: G.potGot || 0,
        kills: G.kills || 0, bestKill: G.bestKill || 0, orbs: orbs.length, hunt: !!HUNT(),
        rage: Math.round(G.rage || 0), awk: G.awk ? { cls: G.awk.cls, t: Math.round(G.awk.t) } : null, awkCount: G.awkCount || 0 };
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
  G.comboStats = function () { var c = {}, k; for (k in G.cstats) c[k] = Math.round(G.cstats[k]); c.maxCombo = G.maxCombo; return c; };   // 시험용: 콤보 기록
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
      zoom: function (k, ms) { G.zoom = { k: k, ms: ms, t: 0 }; },   // 큰 기술 화면 당기기(2026-11-06 밤)
      noMp: noMp,            // 마나가 모자라 기술이 안 나감(2026-11-06)
      player: function () { return G.player; },   // 늘 켜진 기술 「투지」 표시(2차, 2026-11-06)
      comboTag: comboTag,    // 캔슬로 기술이 나감 → 콤보 글자 「CANCEL」(2026-11-06 밤)
      areaMul: function (d) { var A = huntPart('aoe'); return (A && A[d.id]) || 1; },   // 사냥 손맛: 넓은 범위(회전베기·대지 내려찍기·메테오·불기둥)
      onCast: onCast         // 기술을 씀 → 포만감이 조금 더 줆(2026-11-06 밤)
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
