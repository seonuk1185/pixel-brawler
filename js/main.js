// 게임 본체: 화면 크기, 배경, 매 장면 갱신, 타격 처리
// 기본 = 스테이지 판(웨이브 + 보스, 여러 판). 주소 뒤 ?mode=practice = 예전 허수아비 연습장
// 주소 뒤 ?stage=N = 판 번호(config stages 의 id) N 인 판으로 바로 시작(시험용, 잠금 무시). ?bot=1 이면 고르기 화면 없이 바로 시작
//   (2026-11-04: 목록 = 1 2 3 4 5 6 7 8 9 10. ?stage=5 = 눈 덮인 산, ?stage=6 = 해적 항구, ?stage=7 = 화산, ?stage=8 = 유령 고성, ?stage=9 = 마왕군 요새,
//    ?stage=10 = 마왕성(마지막 판, 마왕을 쓰러뜨리면 엔딩). 없는 번호면 무시)
(function () {
  var CFG = window.CFG, J = CFG.juice;
  var AS = CFG.actorScale || 1;   // 캐릭터 크기: 코드에 바로 적힌 거리·높이와 손맛의 밀림 거리(juice.knockback)에 곱한다
  var params = new URLSearchParams(location.search);
  // 기술 미리보기 액자(2026-11-08, index.html window.PV): 기술 창이 이 게임을 작은 액자 안에 한 번 더 띄운 것 → 판 고르기 · 버튼 · 저장 없이 그 기술만 되풀이(아래 pvBoot)
  var PV = window.PV || null;
  var DEBUG = !PV && params.get('debug') === '1' && !CFG.demo;   // 친구 시험 모드(?demo=1)엔 시험 화면 없음
  var MODE = !PV && params.get('mode') === 'practice' ? 'practice' : 'stage';
  if (params.get('slow')) J.timeScale = +params.get('slow') || 1;

  // ---------- 스테이지 고르기 (2026-11-04) ----------
  // 판이 열리는 조건 = 목록에서 바로 앞 판을 깸(첫 판은 늘 열림). 깬 판은 이 브라우저에 저장(localStorage). 저장이 막혀 있어도 게임은 됨(이번에 연 동안만 기억)
  //   코드 안의 판 번호(G.stageNo, urlStage) = 목록 순서(1부터). 화면에 보이는 번호·주소 ?stage= = 판 id(config stages)
  //   저장 = 깬 판 「id」 목록(2026-11-04 7단계 때 바꿈): 예전처럼 목록 순서로 저장하면 5단계를 6 앞에 끼울 때 예전 저장이 한 칸씩 어긋남
  var STAGES = CFG.stages;
  function stageIndexOfId(id) { for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return i + 1; return 0; }
  var urlStage = PV ? 0 : stageIndexOfId(parseInt(params.get('stage'), 10));
  // 친구 시험 모드(?demo=1): ?stage=N 은 열린 판(1판 · 앞 판을 깬 판)만. 잠금 건너뛰기 없음
  if (CFG.demo && urlStage > 1 && !Growth.isCleared(STAGES[urlStage - 2].id) && !Growth.isCleared(STAGES[urlStage - 1].id)) urlStage = 0;
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
  // 미리보기 액자: 1판 숲길 배경만 빌린 빈 판(웨이브 · 소품 없음, 고블린은 pvReset 이 세움)
  if (PV) { CFG.stage = Object.assign({}, STAGES[0], { waves: [], props: [], width: 1600, pv: true }); CFG.bg = CFG.stage.bg; }

  var canvas = document.getElementById('screen');
  var ctx = canvas.getContext('2d');
  var hudEl = document.getElementById('hud');
  // 가로로 돌려 주세요(2026-11-07, 형님 결정 = 가로 화면 전용): 폰 화면(touchui)을 세로로 들면 안내(#rotOv) + 게임 멈춤(step). 세로 CSS 는 그대로 두되 안 씀
  var rotEl = document.getElementById('rotOv'), rotHold = false;
  var LW = 480, LH = 240, SCALE = 1, lbOn = false;   // lbOn = 위아래 여백 화면(폴드 펼침, resize)
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
  //   PC 아래 막대(2026-11-07): 가로 화면이면 막대 + 경험치 줄 높이(padB)만큼 게임 화면 아래를 비움. 배율(캐릭터 크기)은 창 전체 높이로 정하고
  //   남은 높이만 보여 줌 → 배경 위쪽 하늘이 조금 잘림(applyStageWorld 의 bgOff 가 0 밑으로). 남은 높이가 minPcH 도트보다 낮으면 배율 한 단계 낮춤
  function resize() {
    var dpr = window.devicePixelRatio || 1;
    var cw = window.innerWidth, ch = window.innerHeight;
    var pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
    var portrait = ch > cw * 1.05;
    document.body.classList.toggle('portrait', portrait);
    rotHold = portrait && document.body.classList.contains('touchui');
    if (rotEl) rotEl.hidden = !rotHold;
    if (rotHold) Input.setOverride(null);
    var topCss = 0, padB = portrait ? 0 : pcBarPx();
    document.documentElement.style.setProperty('--pcbarH', padB + 'px');
    // 위아래 여백(2026-11-07 형님, 폴드 펼친 화면): 손가락 화면 + 가로/세로 < letterbox.aspect 이면 게임 화면을 그 비율로 자르고 위아래를 비움.
    //   보이는 높이 = targetH 도트 근처(접은 폰 254~270 보다 조금 크게) → 캐릭터가 예전(626x564 도트)보다 큼. 위 여백 = 체력판 등 HUD, 아래 여백 = 조작 버튼
    //   보통 폰(904x388 · 1280x549)·PC 는 비율이 넓거나 손가락 화면이 아니라서 그대로
    var LB = CFG.view.letterbox;
    lbOn = !portrait && !!LB && document.body.classList.contains('touchui') && cw / ch < LB.aspect;
    document.body.classList.toggle('lbox', lbOn);
    if (lbOn) {
      var phC = Math.round(pw / LB.aspect);
      SCALE = Math.max(1, Math.min(Math.round(phC / LB.targetH), Math.floor(phC / CFG.view.targetH)));
      LW = Math.ceil(pw / SCALE); LH = Math.floor(phC / SCALE);
      var lbM = ch - LH * SCALE / dpr;
      topCss = Math.round(Math.min(lbM, Math.max(lbM * LB.topShare, LB.hudH)));
    } else if (portrait) {
      SCALE = Math.max(1, Math.floor(pw / CFG.view.portraitTargetW));
      LW = Math.ceil(pw / SCALE); LH = CFG.view.targetH;
      topCss = 52;
    } else {
      SCALE = Math.max(1, Math.min(Math.floor(ph / CFG.view.targetH), Math.floor(pw / (CFG.view.minLandW || 1))));
      // 정사각형에 가까운 가로 화면(폴드 펼친 화면 834x752 등, 가로/세로 < squareAspect, 2026-11-07): 보이는 폭을 minSquareW 도트 이상으로
      //   → 캐릭터가 너무 커지지 않고 옆이 넓게. 남는 위쪽은 하늘·천장(걷는 길은 늘 아래). 보통 폰(904x388)·PC(1280x720)는 비율이 넓어서 그대로
      if (cw / ch < (CFG.view.squareAspect || 1.5)) SCALE = Math.max(1, Math.min(SCALE, Math.floor(pw / (CFG.view.minSquareW || 560))));
      var phUse = ph - Math.round(padB * dpr);
      if (padB) while (SCALE > 1 && phUse / SCALE < (CFG.view.minPcH || 196)) SCALE--;
      LW = Math.ceil(pw / SCALE); LH = Math.ceil(phUse / SCALE);
    }
    canvas.width = Math.round(LW * RS); canvas.height = Math.round(LH * RS);
    document.body.classList.toggle('smooth', RS > 1);
    var cssW = LW * SCALE / dpr, cssH = LH * SCALE / dpr;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.style.top = topCss + 'px';
    if (hudEl) {
      // 위아래 여백: HUD 판은 화면 맨 위부터 게임 화면 아래 끝까지(위쪽 HUD = 위 여백, 보스 막대 등 아래 붙은 것 = 게임 화면 아래 끝 그대로)
      hudEl.style.top = (lbOn ? 0 : topCss) + 'px';
      hudEl.style.width = Math.min(cw, cssW) + 'px';
      hudEl.style.height = (lbOn ? topCss + cssH : Math.min(ch - topCss, cssH)) + 'px';
    }
    document.documentElement.style.setProperty('--lbT', (lbOn ? topCss : 0) + 'px');
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
    world.width = CFG.stage.dg ? Math.max(LW, CFG.stage.dg.arenaMin || 0) : CFG.stage.width;   // 던전(2026-11-07) = 한 화면 싸움터: 화면 폭과 arenaMin 중 큰 쪽
    world.bgOff = LH - B.height;   // 화면이 240보다 높으면 배경을 바닥에 붙이고 위는 하늘로 채움. 낮으면(PC 아래 막대, 2026-11-07) 0 밑 = 하늘 위쪽이 잘림
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
      if (b.left + b.width / 2 < c.left + c.width / 2) return;   // 버튼 위치 바꾸기(2026-11-07)로 화면 왼쪽 반에 둔 공격 버튼 = 오른쪽을 안 비움
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
  //   던전 싸움터(2026-11-07, bg.arena): mid 는 싸움터 가운데에 한 장(카메라와 같이 움직임), far · ground 는 이어 붙임
  //   천장(bg.ceil, 있는 배경 전부): 화면이 배경보다 높으면 배경 바로 위에 천장 타일(far 와 같은 흐름), 그보다 위는 ceil.voidColor
  //   키 큰 화면(2026-11-07, 정사각형에 가까운 가로 화면 = 폴드 펼침 626x564 도트, config view.tallBg): 위 55% 가 하늘 한 색으로 비어 보임 →
  //     먼 배경(far · mid · 천장)만 바닥 선(floorY)을 기준으로 z 배 키워서 화면 높이를 채움(z = 최대 maxZoom). 바닥 · 걷는 길 · 캐릭터는 그대로.
  //     키워도 모자라면 그 위는 하늘색(천장 배경은 천장 타일 + 깜깜한 색), 그림 맨 위 blendPx 는 하늘색으로 부드럽게 이어짐. 보통 폰 · PC(가로/세로 >= squareAspect)는 안 바뀜
  function bgZoom(off, B) {
    var TB = CFG.view.tallBg;
    if (!TB || !(off > 0) || (LW / LH >= (CFG.view.squareAspect || 1.5) && !lbOn)) return 1;   // 위아래 여백 화면(lbOn)도 먼 배경을 키워 위를 채움
    return Math.max(1, Math.min(TB.maxZoom || 2, (off + B.floorY) / B.floorY));
  }
  function drawStageBg(camX) {
    var B = CFG.bg, I = G.assets.bg, off = world.bgOff, H = B.height;
    var z = bgZoom(off, B), fy = off + B.floorY, top = fy - B.floorY * z;   // top = 키운 먼 배경의 맨 위 줄(z = 1 이면 off)
    // 화면이 배경보다 높으면: 위는 하늘 맨 윗줄(천장이 있으면 천장 타일 + 깜깜한 색), 아래는 흙길 맨 아랫줄을 늘려 채움
    if (top > 0) {
      if (I.ceil && B.ceil) {
        var cH = I.ceil.height * (I.ceil._k || 1) * z, cY = top - cH;
        if (cY > 0) { ctx.fillStyle = B.ceil.voidColor || '#000'; ctx.fillRect(0, 0, LW, cY + 1); }
        tileLayer(I.ceil, camX * (B.far ? B.far.parallax : 1), cY, z);
      } else { ctx.fillStyle = skyColor(); ctx.fillRect(0, 0, LW, top + 1); }
    }
    if (I.far) tileLayer(I.far, camX * B.far.parallax, top, z);
    if (z > 1 && top > 0 && !(I.ceil && B.ceil)) {   // 키운 그림 맨 위 → 하늘색으로 부드럽게
      var bp = (CFG.view.tallBg.blendPx || 24), sc = skyColor(), nb = 8;   // 하늘색을 띠 nb 개로 점점 옅게(같은 색이라 검게 안 비침)
      ctx.save(); ctx.fillStyle = sc; ctx.fillRect(0, top - 1, LW, 2);
      for (var bi = 0; bi < nb; bi++) { ctx.globalAlpha = 1 - (bi + 0.5) / nb; ctx.fillRect(0, top + bi * bp / nb, LW, bp / nb + 0.5); }
      ctx.restore();
    }
    if (I.mid && B.arena) {
      var amw = I.mid.width * (I.mid._k || 1) * z;
      ctx.drawImage(I.mid, snap((world.width - amw) / 2 - camX), top, amw, I.mid.height * (I.mid._k || 1) * z);
    } else if (I.mid) {
      var camMax = Math.max(1, world.width - LW), mk = (I.mid._k || 1) * z;
      var par = Math.min(B.mid.parallax, (I.mid.width * mk - LW) / camMax);   // 판 끝에서 마을 그림이 딱 끝나게
      ctx.drawImage(I.mid, -snap(camX * par), top, I.mid.width * mk, I.mid.height * mk);
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
  function tileLayer(img, sx, y, z) {
    var k = (img._k || 1) * (z || 1), w = img.width * k, h = img.height * k, x = -(snap(sx) % w);   // z = 키 큰 화면에서 먼 배경을 키운 배율(bgZoom)
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
    stage: null, bot: !PV && params.get('bot') === '1' && !CFG.demo,   // 친구 시험 모드엔 자동 조종 없음
    stageNo: startNo, paused: false, props: Props.list
  };

  // 폰 진동: 사용자가 한 번이라도 화면을 누른 뒤에만(그 전엔 브라우저가 막고 경고를 띄움)
  function vibrate(ms) {
    if (!(J.vibrateMs > 0) || !navigator.vibrate || (opt && opt.vib === false)) return;   // 설정 창 「진동」(2026-11-07)
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
    //   2026-11-06 무기 강화: 기사 물리 · 법사 마법 x (1 + perLv x 강화) / 원소 공명(법사): 기술 속성 = 끼운 속성이면 x (1 + resonance)
    var WP = !target.isProp ? wpn() : null, wMul = WP && !!W.magic === (G.classKey === 'mage') ? WP.atkMul() : 1;
    var resEl = WP && G.classKey === 'mage' && st.damageStyle && ENC.skillEl[st.damageStyle], reso = resEl && WP.has(resEl);
    if (reso) { wMul *= 1 + ENC.resonance; Enchant.logAdd('resonance'); }
    //   2026-11-08 마검사 늘 켜진 기술 「마력 부여」: 평타(기술 아님 · 몸으로 때린 타) x (1 + val) (Skills.infuseMul)
    var dmg = Math.round(rand(W.damage[0], W.damage[1]) * st.dmg * (target.isProp ? 1 : Growth.atkMul(!!W.magic) * (1 + pas) * ((src && src.mul) || 1) * clubMul(src ? src.wk : p.weaponKey) * wMul * Skills.infuseMul(p, st, src)));
    // 치명타(민첩, 2026-11-06): 적·허수아비를 때릴 때 확률 Growth.critChance() → 데미지 x critMul + 큰 주황 숫자(agicrit). GAME.test.crit 로 시험 고정
    //   무기(2026-11-06): 기사 +3 치명타 확률 + · 어둠 속성 = 확률 + · 배율 +
    var dark = WP && WP.has('darkness'), DK = ENC && ENC.fx.darkness;
    var AR = window.Archer && G.classKey === 'archer' ? Archer : window.Assassin && G.classKey === 'assassin' ? Assassin : null;   // 암살자(2026-11-09): 같은 갈고리(급소 노리기 · 처형 · 독 · 잔상)   // 궁수 늘 켜진 기술 · 갈래 덤(2026-11-09): 치명타 확률 · 배율 · 표식 데미지
    var crit = !target.isProp && (G.forceCrit != null ? G.forceCrit : Math.random() < Growth.critChance() + (WP ? WP.bonus('crit') : 0) + (dark ? DK.crit : 0) + (AR ? AR.critAdd(p, st) : 0));
    if (crit) { dmg = Math.round(dmg * (CFG.growth.stats.critMul + (dark ? DK.critDmg : 0) + (AR ? AR.critDmg(p, st) : 0))); if (dark) Enchant.logAdd('darkCrit'); }
    if (AR && !target.isProp) dmg = Math.round(dmg * AR.dmgMul(p, target, st));
    if (G.awk && !target.isProp) dmg = Math.round(dmg * CFG.awaken.atkMul);   // 각성: 공격 +30%(2026-11-06 밤)
    if (!target.isProp) dmg = Math.round(dmg * Skills.brandMul(p, target) * Skills.curseMul(target));   // 늘 켜진 기술 「원소 낙인」(2차): 낙인 찍힌 적은 더 아프게 · 흑마법사 저주의 늪 저주(2026-11-08)
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
    // 레이드 보스(2026-11-07, js/raid.js): 맞은 곳(x, 땅에서 높이) → 부위(머리 · 발톱 · 몸 · 약점) 배율. 숫자 · 그로기 막대도 이 값으로
    var rpt = null;
    if (target.raid) {
      var rhb = target.hurtbox(), rx = src ? src.x : p.x + p.dir * 30 * AS, rh = src ? p.y - src.y : (p.z || 0) - (st.hitY != null ? st.hitY : -52 * AS);
      rpt = Raid.part(target, clamp(rx, rhb.x0, rhb.x1), Math.max(0, rh));
      dmg = Math.max(1, Math.round(dmg * rpt.mul));
      if (rpt.part === 'weak') crit = true;
    }
    var airHit = jumpHit && target.T && target.T.flying;
    if (airHit) dmg = Math.round(dmg * (target.T.flying.jumpDmgMul || 1));
    if (target.elm) dmg = ElMob.dmgIn(target, dmg);   // 빛 속성 몹 보호막(2026-11-07)
    // 손맛(2026-11-06 밤, config juice.impact): 무거운 타(마무리·기술·넘어뜨림·띄우기)는 더 오래 멈추고 더 흔들림
    var IM = J.impact || {}, heavyHit = !!(st.finisher || st.damageStyle || st.knockdown || st.launch);
    G.hitstop = Math.max(G.hitstop, J.hitstopMs * W.hitstopMul * st.hitstop * (heavyHit ? IM.heavyStop || 1 : 1));
    var shk = J.shakePx * W.shakeMul * st.shake * (heavyHit ? IM.heavyShake || 1 : IM.lightShake || 1);
    FX.shake(shk, J.shakeMs * (st.finisher ? 1.5 : 1));
    if (target !== G.dummy) { var MH = G.mh; MH.n++; MH.shake = Math.max(MH.shake, shk); if (st.damageStyle) MH.skill = st.damageStyle; MH.x += target.x; MH.y += target.y - target.T.height * 0.45; }   // 여러 마리 한꺼번에(사냥 손맛, 장면 끝에 multiHitFx)
    // 콤보 마무리 타: 짧은 화면 번쩍(2026-11-03 HD). 기술은 자기 flash 를 따로 씀
    if (st.finisher && !st.damageStyle && CFG.view.renderScale > 1) Skills.flash({ color: '#fff8e8', alpha: 0.2, ms: 90 });
    var knock = J.knockback * AS * W.knockMul * st.knock * (WP && WP.has('wind') ? ENC.fx.wind.knock : 1);   // 바람 속성 = 더 멀리 밀림
    var hx, topY;
    if (target === G.dummy) {
      target.hit(dir, knock, J.wobble * (st.finisher ? 1.4 : 1), J.flashMs);
      hx = target.x - dir * 6 * AS; topY = target.y - 96 * AS;
    } else {
      // 무거운 타(타 knock × 무기 knockMul 이 크면) = 잡몹 넘어짐 (config ai.react.heavyKnock)
      //   noKnockdown = 세게 밀어도 안 넘어짐(달리며 공격 어깨 돌진 마무리 = 멀리 날려 보내기), noJuggle = 연속 맞음으로 안 넘어짐(밀고 가는 작은 타)
      var heavy = airHit || (!st.noKnockdown && (!!st.knockdown || st.knock * W.knockMul >= CFG.ai.react.heavyKnock));
      // 평타 콤보 마지막 타(2026-11-07 형님): 잡몹을 넘어뜨리지 않고 크게 휘청(config ai.react.finisherStagger) → 바로 올려베기 등 띄우기로 이어 가게.
      //   기술(damageStyle) · knockdown 붙은 타(각성 끝 등) · 공중 타는 그대로. 보스는 원래 규칙(넘어짐 없음)
      var FS = CFG.ai.react.finisherStagger, comboFin = FS && st.finisher && !st.damageStyle && !st.knockdown && !airHit;
      if (comboFin) { heavy = false; knock *= FS.knockMul; }
      // 누운 적 때리기(OTG, config ai.otg): 땅까지 닿는 공격(hitsDown)만 여기까지 옴 → 데미지 배율, 다시 날아가지 않음
      var otg = target.state === 'down' && !!st.hitsDown;
      var wasAir = target.state === 'air';   // 띄워진 잡몹을 침(콤보 글자 「AIR」)
      if (otg) dmg = Math.max(1, Math.round(dmg * (CFG.ai.otg.dmgMul != null ? CFG.ai.otg.dmgMul : 1)));
      if (G.oneHit && !target.tpHome && target.hp > dmg) dmg = target.hp;   // 테스트 모드 「한 방에 쓰러뜨리기」(js/testpanel.js)
      var res = target.takeHit(dmg, dir, knock, !!st.finisher && !st.noKnockdown && !comboFin, { heavy: heavy, stunMs: comboFin ? Math.max(st.stunMs || 0, FS.stunMs) : Math.max(st.stunMs || 0, Skills.brStun ? Skills.brStun(st, target) : 0), noJuggle: !!st.noJuggle || comboFin, flashK: st.flashK != null ? st.flashK : (heavyHit ? IM.flashHeavy || 1 : 1), otg: otg, launch: st.launch || 0, part: rpt && rpt.part });   // part = 레이드 보스 맞은 부위,  stunMs = 번개 기술, launch = 띄우기(ai.air)
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
      if (rpt) topY = p.y - Math.max(30 * AS, Math.min(110 * AS, (p.z || 0) + 40 * AS));   // 레이드 보스: 숫자 = 맞은 곳 위(거대한 몸 꼭대기 말고)
      if (target.guardBroken) {   // 방패 깨짐: 쨍 하고 방패가 튕겨 나가는 불똥(크게)
        target.guardBroken = false;
        FX.impact(target.x + target.dir * 14 * AS, target.y - 54 * AS, -dir, '#fff4c8', J.sparkCount, true, G.assets.fx && G.assets.fx.impact, 1.1);
      }
      if (res && res !== 'dead') Skills.brandMark(p, target, st);   // 원소 낙인(2차): 기술 마법에 맞은 적에게 낙인
      if (res === 'dead' && target.T.boss) onBossDown(target);
      else if (res === 'dead') {
        G.hitstop = Math.max(G.hitstop, J.hitstopMs * 1.6); onKill(target);
        if (Skills.shardKill) Skills.shardKill(p, target, st.shardDepth || 0);   // 칼날 파편(기사 늘 켜진 기술, 2026-11-08): 쓰러진 자리에서 파편이 튐(st.shardDepth = 파편으로 이어진 횟수)
        if (Skills.chainKill && W.magic) Skills.chainKill(p, target, st.chainDepth || 0);   // 원소 연쇄(대마법사 늘 켜진 기술, 2026-11-08): 마법으로 쓰러진 적이 터짐(st.chainDepth = 이어진 횟수)
      }
    }
    // 원소 파편(법사 늘 켜진 기술, 2026-11-08): 마법(지팡이 · 완드 타 · 마법탄 · 터짐 · 기술)이 맞으면 둘레 적에게 불 · 얼음 조각(조각 자신은 안 튐 = st.eshard, 0.28초에 한 번)
    if (W.magic && Skills.eshardHit && (target === G.dummy || res)) Skills.eshardHit(p, target, st);
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
    FX.damage(rpt ? hx : target.x, topY, dmg, crit || !!(st.finisher || st.crit || (st.damageStyle && st.knockdown)), J, null, G.awk ? 'awk_' + G.awk.cls : crit ? 'agicrit' : st.numStyle || st.damageStyle, target.id || 'dummy', !!st.mergeNum && !crit);
    if (crit) G.crits = (G.crits || 0) + 1;
    // 2차 갈래 B 늘 켜진 기술(2026-11-08): 마검사 「마력 부여」 = 평타 맞은 곳 보라 불티 + 가끔 칼끝 마력 터짐 / 흑마법사 「생명 흡수」 = 마법 피해 일부만큼 체력
    if (target === G.dummy || res) {
      if (!W.magic) Skills.infuseHit(p, target, st, hx, hy);
      else Skills.leechHit(p, target, dmg);
      if (Skills.brHit) Skills.brHit(p, target, st, dmg);   // 갈래 맛 덤(2026-11-08): 성기사 기절 별 · 마검사 늦은 마력 터짐 + 마나 · 흑마법사 저주 + 흡수
      if (AR) AR.onHit(p, target, st, dmg, res);   // 궁수(2026-11-09): 갈래 화살 · 사냥꾼의 표식 · 갈래 덤
    }
    // 무기 속성 효과(2026-11-06, js/enchant.js): 화상 · 독 · 느려짐 · 튀는 번개 · 흡혈 + 속성 색 불티. 법사 평타는 약하게(mageBasic)
    if (WP && target !== G.dummy && res) {
      var els = WP.els();
      if (els.length) Enchant.onHit(p, target, dmg, { els: els, k: G.classKey === 'mage' && !st.damageStyle ? ENC.mageBasic : 1, x: hx, y: hy, skill: !!st.damageStyle, mage: G.classKey === 'mage' });
    }
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
    if (!st.noMp) p.mp = Math.min(p.maxMp, p.mp + CFG.growth.mp.onHit);   // 마나: 맞힐 때마다 조금 참(noMp = 원소 파편 조각처럼 자주 나가는 작은 타는 안 채움, 2026-11-08)
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
    if (c.kind === 'arrow') { if (window.Archer) Archer.basicShot(p, st); return; }   // 궁수 평타 화살(2026-11-09, js/archer.js)
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
        if (Math.hypot(nx - cx, ny - cy) > B.r * (1 + wb('area'))) return;   // 법사 강화 +10 = 마법 범위 +
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
    if (Skills.brDefend) dmg = Skills.brDefend(p, e, dmg);   // 갈래 맛(2026-11-08): 저주 걸린 적 공격 -10% · 성기사 금빛 보호막
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
    if (e.elm) ElMob.onPlayerHit(e, spec, dmg);   // 속성 몹(2026-11-07): 불탐 · 얼어붙음 · 독 · 감전 · 밀림 · 체력 빨기
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
    if (p.state === 'skill' && (Skills.invulnerable(p) || (Skills.armored && Skills.armored(p)))) return false;   // 기술 슈퍼아머(2026-11-07) = 안 잡힘
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
    Skills.slots.forEach(function (k) { if (Input.takeSkill(k, ms)) n++; });   // 기술 칸 A~J
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
              title: (CFG.stage && CFG.stage.bossTitle) || (BI.titles && BI.titles[e.type]) || '', color: king ? BI.kingColor : (e.T.rageColor || BI.color) };
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
  function HUNT() { var h = CFG.hunt; return h && h.on && MODE === 'stage' && CFG.stage && (CFG.stage.dg || (h.stages || []).indexOf(CFG.stage.id) >= 0) ? h : null; }   // 던전 = 늘 켬
  function huntPart(k) { var h = HUNT(), q = h && h[k]; return q && q.on !== false ? q : null; }
  // 몹 떼로 늘릴 적 = 성장 경험치 종류 'mob'(고블린·늑대·박쥐 …). 보스·단단한 잡몹·정예는 그대로
  function hordeMob(type) { var T = CFG.enemies[type]; return !!T && !T.boss && Growth.kindOf(type, T) === 'mob'; }
  function hordeOf(w) { var HD = huntPart('horde'); return HD && !(w && w.horde === false) ? HD : null; }
  // 지금 판의 몹 떼 배수(웨이브 hordeMul > 판별 stageMul > mul). 1 = 늘리지 않음
  function hordeMulOf(w, HD) { return (w && w.hordeMul) || (CFG.stage && CFG.stage.hordeMul) || (HD.stageMul && CFG.stage && HD.stageMul[CFG.stage.id]) || HD.mul || 1; }
  // 소수 배수: 잡몹마다 (배수 - 1) 을 쌓아서 정수가 넘을 때만 한 마리 더(1.5배 = 두 마리 중 하나만 더)
  function hordeExtra(acc, mul) { var a0 = acc.v; acc.v += mul - 1; return Math.floor(acc.v + 1e-6) - Math.floor(a0 + 1e-6); }
  // 마리 수 배수(2026-11-06 난이도): 잡몹 = 몹 떼 배수 x 난이도 count, 단단한 잡몹 = 난이도 countTough, 나머지(보스·정예) = 1
  //   몹 떼로 늘어난 만큼은 한 마리가 약해지지만(makeEnemy), 난이도로 늘어난 몹은 약해지지 않음
  function countMul(type, w, HD) {
    var T = CFG.enemies[type], M = Growth.M();
    if (hordeMob(type)) return (HD ? hordeMulOf(w, HD) : 1) * modeVal(M.count);   // 2026-11-09 판 20개 한 줄: 마리 수도 판 순서대로(modeVal)
    if (T && !T.boss && Growth.kindOf(type, T) === 'tough') return modeVal(M.countTough);
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
    // 오른쪽 잡몹은 미리 서 있게(2026-11-07, config ai.rightPlace): 늦게 나오던 것도 maxAt 안에, 서는 자리는 차례대로 퍼지게(place 번호)
    var RP = CFG.ai.rightPlace, pn = 0;
    if (RP && RP.on) S.queue.forEach(function (q) { var T = CFG.enemies[q.type]; if (q.side === 'R' && T && !T.boss && !(q.opt && q.opt.mid)) { q.place = pn++; q.at = Math.min(q.at, (RP.maxAt || 0) * Math.random()); } });
    if (pn) S.queue.forEach(function (q) { if (q.place != null) q.placeN = pn; });
    var MQ = midOf(CFG.stage);   // 중간보스(2026-11-06): 보스 바로 앞 웨이브에 하나
    if (MQ && i === MQ.wave) S.queue.push({ type: MQ.type, side: CFG.midBoss.side || 'R', at: CFG.midBoss.delayMs || 0, opt: { mid: true }, off: 0 });
    // 미리 서 있는 적: 아직 안 나온 것도 지금 다 내놓고, 화면이 고정되면 전부 알아챔
    S.placedQ.forEach(spawnPlaced); S.placedQ = [];
    G.enemies.forEach(function (e) { if (e.asleep) wakeEnemy(e, Math.random() * (CFG.ai.wake.groupDelayMs || 0)); });
    banner(w.boss ? 'BOSS!' : 'WAVE ' + (i + 1), w.boss ? 'boss' : '');
    snd('wave', w.boss ? { k: 0.75 } : null);
  }

  // 판 순서(1부터, 난이도 배율 · 경험치 판 배율용): 던전 = config 의 tier(몇 번째 판만큼 센가)
  function stIdx() { return CFG.stage && CFG.stage.dg ? CFG.stage.tier || 1 : G.stageNo || 1; }
  // 난이도 배율(2026-11-06, config modes): 숫자 하나 = 모든 판 같음, [1판, 10판] = 판 순서대로 고르게
  //   2026-11-09 판 20개: 값 i 는 config modeKnots[i] 번째 판(1 · 10 · 20). 두 값 [1판, 10판] 이면 10판 뒤는 10판 값 그대로 → 1~10판은 예전과 같음
  function modeVal(v) {
    if (!Array.isArray(v)) return v != null ? v : 1;
    var K = CFG.modeKnots || [1, STAGES.length], i = stIdx();
    if (v.length === 1 || i <= K[0]) return v[0];
    for (var j = 1; j < v.length && j < K.length; j++) {
      if (i <= K[j]) return v[j - 1] + (v[j] - v[j - 1]) * (i - K[j - 1]) / (K[j] - K[j - 1]);
    }
    return v[Math.min(v.length, K.length) - 1];
  }
  // 적 하나 만들기: 판 배율(hpMul·dmgMul) + 변종(색·배율) + 난이도 배율 적용. opt = { variant, mid(중간보스) }
  function makeEnemy(type, x, y, opt) {
    var S = G.stage, T = CFG.enemies[type], st = CFG.stage, M = Growth.M();
    var MQ = opt && opt.mid ? opt.mq || midOf(st) : null;   // 중간보스: 잡몹 T 를 키운 MQ.T + 물들인 그림(MQ.vk). opt.mq = 던전이 미리 만든 것
    var vk = MQ ? MQ.baseVk : (opt && opt.variant) || T.variant, V = vk && CFG.variants ? CFG.variants[vk] : null;   // T.variant = 늘 그 색으로 나오는 적(7단계 용암 골렘)
    // 속성 몹(2026-11-07, opt.el, js/elmobs.js): 색 = el_<속성> 변종(늘 그 색인 적 · 중간보스는 원래 색 그대로) + 오라 · 능력은 아래 ElMob.apply
    var elk = opt && opt.el && window.ElMob ? ElMob.key(opt.el) : null;
    if (elk && !MQ && !T.variant && CFG.variants['el_' + elk]) { vk = 'el_' + elk; V = CFG.variants[vk]; }
    var e = new Enemy(type, CFG, MQ ? tintArt(type, MQ.vk) : V ? tintArt(type, vk) : G.assets.enemies[type], x, y);
    if (MQ) { T = e.T = MQ.T; e.hp = e.maxHp = T.hp; e.label = T.label; e.hoverD = T.hover[0] + Math.random() * (T.hover[1] - T.hover[0]); e.mid = true; S.mid = e; }
    var hm = (st.hpMul || 1) * (V && V.hpMul || 1) * modeVal(M.hpMul), dm = (st.dmgMul || 1) * (V && V.dmgMul || 1) * modeVal(M.dmgMul);
    if (MQ) dm *= CFG.midBoss.dmgMul || 1;
    // 2026-11-07 형님(노말이 지루함): 판 보스 · 중간보스 = 난이도 bossHp · bossDmg 더(노말 체력 x1.3 · 공격 x1.2). 던전은 안 함
    if ((T.boss || MQ) && !st.dg) { hm *= M.bossHp || 1; dm *= M.bossDmg || 1; }
    if (hm !== 1) e.hp = e.maxHp = Math.round(e.maxHp * hm);
    e.dmgMul = dm;
    if (V && !MQ) { e.variant = vk; if (V.label) e.label = V.label + ' ' + e.label; }
    if (T.boss && st.bossName && !st.dg) e.label = st.bossName;   // 2026-11-09: 11~20판 물들인 보스 이름(「폭풍 붉은 와이번」 대신 「폭풍 와이번」)
    // 몹 떼(사냥 손맛): 늘어난 만큼 한 마리는 약하게 + 경험치 xpMul 배. 쓰러지면 붕 날아가 펑(hunt.death, enemies.js)
    var HD = hordeOf(null);
    var hmul = HD ? hordeMulOf(null, HD) : 1;
    if (HD && hmul > 1 && hordeMob(type) && !MQ) {   // 2026-11-09: 중간보스는 몹 떼로 나누지 않음(대장 체력이 몹 떼 배수로 나뉘어 너무 약했음)
      e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp * (HD.hpExp ? Math.pow(hmul, -HD.hpExp) : (HD.hpMul || 1))));
      e.dmgMul *= HD.dmgMul || 1; e.xpMul = HD.hpExp ? 1 / hmul : (HD.xpMul || 1); e.horde = true;
    }
    if (!st.dg && !T.boss && !MQ && CFG.ai.rightPlace && CFG.ai.rightPlace.on) e.walkMul = CFG.ai.rightPlace.walkMul || 1;   // 판 잡몹 걷기 +20%(2026-11-07)
    var HDe = huntPart('death');
    if (HDe && !T.boss && !MQ) e.huntDeath = HDe;   // 중간보스는 보스처럼 그 자리에 쓰러짐(펑 없이)
    e.wave = S.waveIdx;
    if (elk) ElMob.apply(e, elk, opt.elAmp);   // elAmp = 속성 시련 수호자(능력 강화)
    G.enemies.push(e);
    if (T.boss) S.boss = e;
    return e;
  }
  // off = 몹 떼로 늘어난 몹: 화면 밖으로 off x hunt.horde.xOff 도트 더 떨어져서 나옴(한 덩어리로 겹치지 않게)
  // 화면 오른쪽에 미리 서는 잡몹(2026-11-07, config ai.rightPlace): 보이는 화면 오른쪽 x 범위에 차례대로 퍼짐(위아래도 엇갈림) + 먼지 퐁 + 「!」 뒤 바로 옴
  function spawnRightPlaced(q) {
    var S = G.stage, RP = CFG.ai.rightPlace, vw = LW - controlPad, n = Math.max(1, q.placeN || 1), k = q.place || 0;
    var u = n > 1 ? k / (n - 1) : 0.5, x = S.lockCam + vw * lerp(RP.x[0], RP.x[1], clamp(u + (Math.random() - 0.5) * 0.12, 0, 1));
    var lt = world.laneTop, lh = world.laneBottom - lt, y = lt + lh * (((k * 0.618) % 1) * 0.8 + 0.1);
    var e = makeEnemy(q.type, x, y, q.opt);
    e.dir = -1; e.entered = true;
    e.wake((CFG.ai.wake.alertMs || 0) + Math.random() * (CFG.ai.wake.groupDelayMs || 0), true);
    if (G.assets.dust && G.assets.dust.length) FX.sprite(x, y, G.assets.dust, CFG.dust.fps, CFG.dust.pivot, false, true);
    return e;
  }
  function spawnEnemy(type, side, opt, off) {
    var S = G.stage, T = CFG.enemies[type], HD = off ? hordeOf(null) || CFG.hunt.horde : null, ox = HD ? off * (HD.xOff || 0) * AS : 0;
    var xl = S.dg ? 0 : S.lockCam, xr = S.dg ? world.width : S.lockCam + LW;   // 던전 = 싸움터 양끝 밖에서
    var x = side === 'L' ? xl - T.radius - 30 - ox : xr + T.radius + 30 + ox;
    var y = world.laneTop + Math.random() * (world.laneBottom - world.laneTop);
    var e = makeEnemy(type, x, y, opt);
    e.dir = side === 'L' ? 1 : -1;
    return e;
  }

  // ---------- 중간보스 (2026-11-06, config midBoss) ----------
  // 그 판 잡몹 T 를 복사해서 키움: 그림 배율(drawScale) + 몸·공격 판정·그림자(radius)·키·거리를 같은 배율로, 체력 = 그 판 보스 기본 체력 x hpBoss,
  //   근접 공격은 무겁게(heavy) + 치켜든 그림(예고)을 windMs 더 길게 + 바닥 빨간 예고, 버티기(armor·staggerCdMs·poise), 띄우기는 됨(원래 보스였던 적만 noLaunch)
  //   그림 = 그 판 변종 색 위에 더 어둡게(midBoss.tint) 구운 것 + 빛나는 테두리(rim). 판마다 한 번 만들어 둠
  //   2026-11-07 던전: 만드는 부분(midMake)을 따로 → 던전 · 레이드도 같은 모양으로 씀(dgMid)
  var midCache = {};
  function midOf(st) {
    var MB = CFG.midBoss, L = MB && MB.on && MB.list && MB.list[st.id];
    if (!L || !CFG.enemies[L[0]] || !st.waves) return null;
    if (midCache[st.id]) return midCache[st.id];
    var wave = st.waves.length - (MB.wave || 2), boss = null;
    if (wave < 0 || st.waves[wave].boss) return null;
    st.waves.forEach(function (w) { (w.spawn || []).forEach(function (q) { var E = CFG.enemies[q[0]]; if (E && E.boss) boss = E; }); });
    var MQ = midMake(L, Math.round((boss ? boss.hp : CFG.enemies[L[0]].hp * 7) * (L[3] && L[3].hpBoss || MB.hpBoss || 0.45)), 'mid' + st.id, L[3] || null);   // L[3] = 따로 그린 중간보스 덮어쓰기(2026-11-09: scale 1 · 색 그대로)
    MQ.wave = wave;
    return (midCache[st.id] = MQ);
  }
  // 중간보스 하나 만들기(판 · 던전 같이): L = [잡몹 종류, 이름, 색 변종 또는 null], hp = 체력(판 배율 · 난이도 곱하기 전),
  //   vk = 물들인 그림 변종 이름(variants 에 넣어 둠, tintArt 가 한 번만 구움). 돌려주는 값 = { type, T, vk, baseVk }
  //   o = 덮어쓰기(2026-11-07 속성 시련 수호자): { scale(그림 · 판정 배율, 없으면 midBoss.scale), knockResist(밀림 배율에 더 곱함), rim(테두리), tint(색 값 덮어쓰기), noLaunch(띄우기 안 됨) }
  function midMake(L, hp, vk, o) {
    var MB = CFG.midBoss, B = CFG.enemies[L[0]], k = (o && o.scale) || MB.scale || 1;
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
    T.midBoss = true; T.label = L[1]; T.noLaunch = !!(B.boss || B.noLaunch || (o && o.noLaunch));   // 띄우기(2026-11-06 형님): 잡몹 대장은 뜸, 원래 보스였던 적이 중간보스면 안 뜸. 시련 수호자(o.noLaunch)도 안 뜸
    T.superArmor = !!MB.armor; T.staggerCdMs = MB.staggerCdMs || 0;
    T.poise = { downCdMs: MB.downCdMs || 0 };
    T.knockResist = (B.knockResist != null ? B.knockResist : 1) * (MB.knockResist != null ? MB.knockResist : 1) * (o && o.knockResist != null ? o.knockResist : 1);
    T.rim = (o && o.rim) || MB.rim || null;   // 수호자 = 속성 색 테두리(o.rim)
    T.hp = hp;
    // 그림 색: 그 판 변종(L[2]) 위에 tint 를 얹은 새 변종을 variants 에 넣어 둠(tintArt 가 한 번만 구움)
    var V0 = L[2] && CFG.variants[L[2]], TN = MB.tint || {};
    CFG.variants[vk] = V0 ? Object.assign({}, V0, { sat: (V0.sat != null ? V0.sat : 1) * (TN.sat != null ? TN.sat : 1), bright: (V0.bright != null ? V0.bright : 1) * (TN.bright != null ? TN.bright : 1) }) : TN;
    if (o && o.tint) CFG.variants[vk] = Object.assign({}, CFG.variants[vk], o.tint);   // 수호자: 색 덮어쓰기(속성 색을 더 진하게 등)
    return { type: L[0], T: T, vk: vk, baseVk: L[2] || null };
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

  // ================= 던전 (2026-11-07, 형님 승인, 수치 = config dungeons) =================
  // 던전 = 판(CFG.stage) 자리에 들어가는 「한 화면 싸움터」. dgStage(이름)이 config 던전 값으로 판 모양 묶음을 만들어 줌:
  //   { id: 'dg:mine', dgId, dg(config 값), name, bg, waves: [](웨이브 없음), props, hpMul, dmgMul, tier, magnet, hordeMul: 1 }
  //   → 적 만들기 · 경험치 · 사냥 손맛 · 물약 · 강화석 · HUD · 결과 화면은 판과 같은 길, 「규칙」만 dgStep 이 맡음
  //   G.stage.dg = 이번 도전 상태(dgStart). 폭 = 화면 폭과 arenaMin 중 큰 쪽(applyStageWorld), 카메라 = 싸움터 안에서 플레이어를 따라감(넓은 화면 = 고정)
  //   새 던전(레이드 등): config dungeons 에 하나 더. 다른 규칙이면 rule 이름을 정하고 dgStep 의 「규칙」 부분에 갈래를 더함
  //     쓸 수 있는 도구: dgSpawnMob(종류, 쪽) · dgSpawnMid(번호, 쪽) · dgQueue({ type | mid, side, at }) · dgFinish('clear' / 'over') · banner
  function DG() { return CFG.stage && CFG.stage.dg ? CFG.stage.dg : null; }
  var dgCache = {};
  function dgStage(id) {
    var D = CFG.dungeons && CFG.dungeons[id]; if (!D) return null;
    return dgCache[id] || (dgCache[id] = { id: 'dg:' + id, dgId: id, dg: D, name: D.name, bg: D.bg, bgTop: D.bgTop, width: D.arenaMin || 560, waves: [], props: D.props || [],
      hpMul: D.hpMul || 1, dmgMul: D.dmgMul || 1, tier: D.tier || 1, magnet: D.magnet || null, hordeMul: 1 });
  }
  // 열렸나: unlock 'class' = 전직한 저장칸(시험 기간 stagesAllOpen 이면 다 열림, 친구 시험 모드는 늘 조건대로)
  function dgOpen(id) { var D = CFG.dungeons && CFG.dungeons[id]; if (!D) return false; if (CFG.stagesAllOpen) return true; return D.unlock === 'class' ? !!Growth.cls : true; }
  // 지금 난이도의 던전 배율(config dungeons.○○.modes): 'stones' · 'spawn' · 'alive'
  function dgModeK(k) { var D = DG(), M = D && D.modes && D.modes[Growth.mode()]; return M && M[k] != null ? M[k] : 1; }
  function lerp(a, b, u) { return a + (b - a) * u; }
  // 던전 중간보스 i 번(config mids.list): 판 중간보스와 같은 방식(midMake)으로 한 번만 만들어 둠
  function dgMid(i) {
    var D = DG(), L = D.mids.list[i % D.mids.list.length], key = 'dg:' + CFG.stage.dgId + ':' + (i % D.mids.list.length);
    return midCache[key] || (midCache[key] = midMake(L, D.mids.hp || 450, 'middg_' + CFG.stage.dgId + '_' + (i % D.mids.list.length)));
  }
  // 속성 시련 수호자(2026-11-07, config dungeons.○○.champ): 대장과 같은 방식(midMake)으로 더 크게 · 더 단단하게, 한 번만 만들어 둠
  function dgChamp() {
    var D = DG(), C = D && D.champ, key = 'dg:' + CFG.stage.dgId + ':champ'; if (!C || !C.L || D.boss) return null;
    return midCache[key] || (midCache[key] = midMake(C.L, C.hp || 2600, 'champdg_' + CFG.stage.dgId, { scale: C.scale, knockResist: C.knockResist, rim: C.rim, tint: C.tint, noLaunch: C.noLaunch !== false }));
  }
  // 수호자 나옴: 오른쪽 끝에서 걸어 들어옴 + 이름 띠 · 흔들림. 체력 x modes.boss, 공격력 x champ.dmgMul, 능력 = 속성 위에 amp. 보스 막대(S.boss)에 이름
  function dgSpawnChamp(R, D) {
    var MQ = dgChamp(), C = D.champ; if (!MQ) return null;
    var e = spawnEnemy(MQ.type, 'R', { mid: true, mq: MQ, el: D.el, elAmp: C.amp }, 0);
    e.hp = e.maxHp = Math.round(e.maxHp * dgModeK('boss'));
    e.dmgMul *= C.dmgMul || 1;
    e.champ = true; G.stage.boss = e; G.stage.bossDownT = -1;
    R.boss = e; R.bossAt = R.t; R.addT = C.adds ? C.adds.everyMs : 0;   // 첫 몹 무리 = 나오고 adds.firstMs 뒤
    banner(josa(e.label, '이', '가') + ' 나타났다!', 'boss');
    snd('bossRoar', { k: 0.95, v: 0.95 });
    FX.shake(J.shakePx * 2.4, 600);
    return e;
  }
  function dgStart() {
    var D = DG(), S = G.stage;
    S.locked = true;   // 웨이브 판의 「화면 고정」과 같은 뜻(자동 조종이 오른쪽으로 걸어가지 않게)
    S.dg = { rule: D.rule, t: 0, wait: D.startMs || 0, acc: 0, queue: [], ev: 0, side: Math.random() < 0.5 ? 0 : 1, midN: 0,
             kills: 0, midKills: 0, end: null, endT: 0, bonus: 0, rec: null, best: null, maxAlive: 0 };
    if (D.elRand) { var EP = D.elRand.els.slice(); S.dg.elPool = []; while (S.dg.elPool.length < (D.elRand.pick || 1) && EP.length) S.dg.elPool.push(EP.splice(Math.floor(Math.random() * EP.length), 1)[0]); }   // 이번 도전 속성(광산)
    if (D.rule === 'raid') { Object.assign(S.dg, { phase: 'rest', restT: 0, wi: -1, wsp: 0, wmid: [], mobs: null, camLock: null, boss: null, bossT: 0, lootT: -1 }); Raid.reset(); return; }   // 레이드(2026-11-07): 웨이브 → 보스
    if (D.spawn) S.dg.acc = (D.pack ? D.pack.every[0] : D.spawn.every[0]) - (D.spawn.firstMs || 0);   // 첫 몹(무리) = 시작하고 firstMs 뒤
  }
  // 몹 하나 뽑기: config mobs [종류, 무게, 이 초부터]
  function dgPick(D, sec) {
    var RM = G.stage && G.stage.dg && G.stage.dg.mobs;   // 레이드 웨이브: 그 웨이브 mobs [종류, 무게]
    if (RM) { var t0 = 0, r0; RM.forEach(function (m) { t0 += m[1]; }); r0 = Math.random() * t0; for (var q = 0; q < RM.length; q++) { r0 -= RM[q][1]; if (r0 < 0) return RM[q][0]; } return RM[0][0]; }
    var L = D.mobs.filter(function (m) { return sec >= (m[2] || 0); }), tot = 0, r;
    L.forEach(function (m) { tot += m[1]; });
    r = Math.random() * tot;
    for (var i = 0; i < L.length; i++) { r -= L[i][1]; if (r < 0) return L[i][0]; }
    return L[L.length - 1][0];
  }
  function dgSide(R) { R.side = 1 - R.side; return R.side ? 'R' : 'L'; }
  // 속성 몹(2026-11-07, config elMobs): 던전 el = 모든 몹 그 속성(불의 화산굴), elRand = 도전마다 뽑아 둔 속성(elPool) 중 하나를 from 초부터 chance 확률로(광산)
  function dgEl(type) {
    var D = DG(), R = G.stage && G.stage.dg; if (!D || !window.ElMob) return null;
    if (D.el) return D.el;
    var ER = D.elRand; if (!ER || !R || !R.elPool || !R.elPool.length || R.t < (ER.from || 0) * 1000 || ER.types.indexOf(type) < 0) return null;
    return Math.random() < ER.chance ? R.elPool[Math.floor(Math.random() * R.elPool.length)] : null;
  }
  function dgOpt(type) { var el = dgEl(type); return el ? { el: el } : null; }
  // 광산 단계(2026-11-07, config dungeons.mine.phases): 지금 단계 { at, hp, atk, spawn } (없으면 null). 새로 나오는 적에 체력 · 공격 배율
  function dgPhase() { var D = DG(), R = G.stage && G.stage.dg, P = D && D.phases, ph = null; if (!P || !R) return null; P.forEach(function (q) { if (R.t >= q.at * 1000) ph = q; }); return ph; }
  function dgPhaseApply(e) { var ph = dgPhase(); if (!ph || !e) return e; if (ph.hp && ph.hp !== 1) e.hp = e.maxHp = Math.round(e.maxHp * ph.hp); if (ph.atk) e.dmgMul = (e.dmgMul || 1) * ph.atk; return e; }
  function dgSpawnMob(type, side, off) { var e = spawnEnemy(type, side, dgOpt(type), off || 0); e.dgMob = true; return dgPhaseApply(e); }
  function dgSpawnMid(i, side) { var MQ = dgMid(i), D = DG(), e = spawnEnemy(MQ.type, side, { mid: true, mq: MQ, el: D && D.el }, 0); G.stage.mid = e; return dgPhaseApply(e); }
  function dgQueue(q) { G.stage.dg.queue.push(q); }
  // ---------- 몹 떼(2026-11-07 형님: 한 줄로 오는 느낌 → 무리로, config pack) ----------
  //   한 번에 3~6마리 무리: 옆 간격 pack.dx 도트씩 엇갈리고, 깊이(위아래)는 걷는 길 전체에 고르게 퍼짐(순서는 섞음)
  //   종류(pack.mix 무게 · 이 초부터): side = 한쪽 끝 · pincer = 양쪽 끝 동시 · drop = 뒤 벽 쪽에서 뛰어내림(먼지) · front = 앞(화면 아래)에서 뛰어듦
  function dgPackKind(mix, sec) {
    var L = Object.keys(mix).filter(function (k) { return sec >= (mix[k][1] || 0); }), tot = 0, r;
    L.forEach(function (k) { tot += mix[k][0]; });
    r = Math.random() * tot;
    for (var i = 0; i < L.length; i++) { r -= mix[L[i]][0]; if (r < 0) return L[i]; }
    return 'side';
  }
  function dgPack(D, sec, n, at0, kind) {
    var PK = D.pack, R = G.stage.dg, p = G.player;
    kind = kind || dgPackKind(PK.mix, sec);
    var lt = world.laneTop, lb = world.laneBottom, lh = lb - lt, ys = [], i;
    for (i = 0; i < n; i++) ys.push(lt + (i + 0.2 + Math.random() * 0.6) / n * lh);
    for (i = ys.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = ys[i]; ys[i] = ys[j]; ys[j] = t; }
    var side = kind === 'side' ? dgSide(R) : null, ox = { L: 0, R: 0 };
    var vx0 = G.camX + 30 * AS, vx1 = G.camX + LW - controlPad - 30 * AS;   // 보이는 싸움터(뛰어내림 · 앞)
    for (var k = 0; k < n; k++) {
      var type = dgPick(D, sec), T = CFG.enemies[type], q = { type: type, at: at0 + k * (PK.gapMs || 90) + Math.random() * 60, kind: kind };
      if (kind === 'side' || kind === 'pincer') {
        var s = side || (k % 2 ? 'L' : 'R');
        ox[s] += k < 2 && kind === 'pincer' ? 0 : rand(PK.dx[0], PK.dx[1]);
        q.side = s; q.x = s === 'L' ? -T.radius - 30 - ox[s] : world.width + T.radius + 30 + ox[s]; q.y = ys[k];
      } else {
        var x = vx0 + (k + 0.5) / n * (vx1 - vx0) + (Math.random() * 2 - 1) * PK.dx[1];
        if (Math.abs(x - p.x) < (PK.avoid || 46)) x = p.x + (x < p.x ? -1 : 1) * (PK.avoid || 46);   // 플레이어 바로 위에는 안 떨어짐
        q.x = clamp(x, vx0, vx1);
        if (kind === 'drop') { q.y = lt + Math.random() * lh * (PK.dropBack || 0.3); q.drop = (PK.dropH || 90) * (0.8 + Math.random() * 0.4); }
        else { q.y = lb - Math.random() * lh * 0.15; q.drop = PK.frontH || 34; }
      }
      dgQueue(q);
    }
    R.packs = (R.packs || 0) + 1; (R.packLog || (R.packLog = [])).push(kind + ':' + n);   // 시험용 기록
    return kind;
  }
  // 줄 선 무리 하나 내보내기: 정한 자리(x, y) · 뛰어내림(drop = 높이)이면 들어온 것으로(entered)
  function dgPlace(q) {
    var e = makeEnemy(q.type, q.x, clamp(q.y, world.laneTop, world.laneBottom), dgOpt(q.type));
    e.dgMob = true; e.dir = q.x < G.player.x ? 1 : -1;
    if (q.drop) { e.dropZ = q.drop; e.entered = true; }
    return dgPhaseApply(e);
  }
  // 시간 사건(config events): 큰 글자 + 중간보스 + 몹 몰려옴
  function dgEvent(ev, R, D) {
    if (ev.banner) banner(ev.banner, 'boss');
    snd('bossRoar', { k: 1.25, v: 0.85 });
    FX.shake(J.shakePx * 1.8, 460);
    for (var i = 0; i < (ev.mids || 0); i++) dgQueue({ mid: true, idx: R.midN++, side: i % 2 ? 'L' : 'R', at: R.t + 500 + i * (ev.gapMs || 500) });
    if (ev.rush && D.pack) {   // 몰려옴 = 무리 여러 개(첫 무리 = 양쪽 동시, 나머지 = 섞어서)
      var np = Math.ceil(ev.rush.n / (D.pack.size[1] || 6)), left = ev.rush.n;
      for (var j = 0; left > 0; j++) { var m = Math.min(left, Math.ceil(ev.rush.n / np)); dgPack(D, ev.at, m, R.t + 300 + j * ev.rush.ms / np, j === 0 ? 'pincer' : null); left -= m; }
    } else if (ev.rush) for (var k = 0; k < ev.rush.n; k++) dgQueue({ type: dgPick(D, ev.at), side: k % 2 ? 'L' : 'R', at: R.t + 300 + k * ev.rush.ms / ev.rush.n, off: Math.floor(k / 2) % 3 });
  }
  function dgStep(dt) {
    var S = G.stage, R = S.dg, D = DG(), p = G.player;
    // 카메라: 싸움터 안에서 플레이어를 가운데에(싸움터 = 화면 폭이면 고정)
    var camMax = Math.max(0, world.width - LW), target = clamp(p.x - (LW - controlPad) / 2, 0, camMax);
    if (R.camLock != null) target = R.camLock;   // 레이드 보스: 싸움터 오른쪽 끝에 고정
    G.camX += (target - G.camX) * Math.min(1, dt / 120);
    if (Math.abs(target - G.camX) < 0.5) G.camX = target;
    G.camX = clamp(G.camX, 0, camMax);
    // 중간보스 막대: 쓰러진 대장 막대가 사라지면 살아 있는 다른 대장으로
    if (S.mid && !S.mid.alive() && (S.mid.deadT || 0) > 800) { var nm = G.enemies.filter(function (e) { return e.mid && e.alive(); })[0]; if (nm) S.mid = nm; }
    if (R.end) { R.endT += dt; if (!S.result && R.endT > (R.end === 'clear' ? 2600 : 400)) dgResult(); return; }
    if (p.state === 'dead') { S.overT += dt; if (S.overT > (CFG.hero.deathOverMs || 1800)) dgFinish('over'); return; }   // 쓰러짐 = 끝(시계 · 몹 멈춤)
    if (R.wait > 0) { R.wait -= dt; if (R.wait <= 0) { banner('시작!', 'small'); snd('wave'); } return; }
    S.time += dt; R.t += dt;
    rescueStuck(dt);
    if (D.rule === 'raid') { dgRaid(dt, R, D); return; }
    // ---- 규칙: timeAttack(시간 버티기) ----
    var sec = R.t / 1000, SP = D.spawn, EV = D.events || [], u = clamp(sec / (SP.rampSec || D.timeSec || 60), 0, 1);
    while (R.ev < EV.length && sec >= EV[R.ev].at) { dgEvent(EV[R.ev], R, D); R.ev++; }
    var cnt = dgFlush(R, SP), alive = cnt.alive, mobs = cnt.mobs;
    // 늘 나오는 몹: every ms 마다 batch 마리(양옆 번갈아), 살아 있는 몹이 maxAlive 보다 적을 때만
    //   몹 떼(config pack, 2026-11-07): pack.every ms 마다 size 마리 무리 하나(dgPack). 자리가 minRoom 마리보다 적으면 자리가 날 때까지 기다림
    var PH = dgPhase();
    R.acc += dt * dgModeK('spawn') * ((PH && PH.spawn) || 1);   // 광산 단계(2026-11-07): 단계마다 더 빨리
    var every = lerp(SP.every[0], SP.every[1], u), maxA = Math.round(lerp(SP.maxAlive[0], SP.maxAlive[1], u) * dgModeK('alive'));
    if (D.pack) {
      var PK = D.pack, pe = lerp(PK.every[0], PK.every[1], u), qm = R.queue.filter(function (q) { return !q.mid; }).length;
      var room = Math.min(maxA - mobs - qm, SP.cap - alive - qm);
      if (R.acc >= pe) {
        var want = clamp(Math.round(lerp(PK.size[0], PK.size[1], u) + (Math.random() * 2 - 1) * (PK.sizeJit || 0)), PK.size[0], PK.size[1]);
        if (room >= Math.min(want, PK.minRoom || 3)) { R.acc = 0; dgPack(D, sec, Math.min(want, room), R.t, null); }
        else R.acc = pe;
      }
    } else if (R.acc >= every) {
      R.acc = Math.min(R.acc - every, every);
      var b = lerp(SP.batch[0], SP.batch[1], u), n = Math.floor(b) + (Math.random() < b % 1 ? 1 : 0);
      for (var k = 0; k < n && mobs < maxA && alive < SP.cap; k++) { dgSpawnMob(dgPick(D, sec), dgSide(R), Math.floor(k / 2)); mobs++; alive++; }
    }
    R.maxAlive = Math.max(R.maxAlive, alive);
    if (D.timeSec && R.t >= D.timeSec * 1000) dgFinish('clear');
  }
  // 줄 선 것(대장 · 몰려옴) 내보내기: 대장은 늘, 몹은 cap 안에서. 돌려주는 값 = 살아 있는 { alive(전부), mobs(대장 빼고) }
  function dgFlush(R, SP) {
    var alive = 0, mobs = 0;
    G.enemies.forEach(function (e) { if (e.alive() && !e.raid) { alive++; if (!e.mid) mobs++; } });
    for (var i = 0; i < R.queue.length; i++) {
      var q = R.queue[i];
      if (q.at > R.t || (!q.mid && alive >= SP.cap)) continue;
      if (q.mid) { var me = dgSpawnMid(q.idx, q.side); if (q.intro) midIntro(me); } else { if (q.x != null) dgPlace(q); else dgSpawnMob(q.type, q.side, q.off); mobs++; }
      alive++; R.queue.splice(i--, 1);
    }
    return { alive: alive, mobs: mobs };
  }
  // ---- 규칙: raid(레이드, 2026-11-07 config dungeons.fire) ----
  //   rest(쉼) → 웨이브 i(config waves[i]: n 마리를 몹 떼로, mids = 그만큼 나온 뒤 중간보스) → 다 쓰러지면 「WAVE CLEAR」 → … → 웨이브 5 뒤 보스(js/raid.js)
  //   보스: 카메라를 싸움터 오른쪽 끝에 고정 · 플레이어는 보스 앞(벽)까지. 쓰러지면 쓰러지는 그림 뒤 보상이 와르르(dgRaidLoot) → 다 빨려 들면 끝(clear)
  function dgRaid(dt, R, D) {
    var SP = D.spawn, NW = D.waves.length, cnt = dgFlush(R, SP);
    if (R.phase === 'rest') {
      R.restT -= dt;
      if (R.restT > 0) return;
      if (R.wi + 1 >= NW) {   // 웨이브 다 깸 → 보스(그림이 아직이면 다 받을 때까지 기다림)
        if (!D.boss) {   // 속성 시련(2026-11-07): 레이드 보스 대신 수호자. 「WARNING」 → champAt 뒤 걸어 들어옴(마지막 웨이브 몹 무리가 가끔 같이)
          R.phase = 'champ'; R.champAt = R.t + 1300; R.addT = 0;
          banner('WARNING', 'boss'); snd('bossIntro', { k: 0.85 }); FX.shake(J.shakePx * 1.4, 500);
          return;
        }
        if (!Raid.ready()) return;
        R.phase = 'boss'; R.mobs = null; R.camLock = Math.max(0, world.width - LW);
        var e = Raid.spawn(R.camLock); e.maxHp = e.hp = Math.round(D.boss.hp * (CFG.stage.hpMul || 1) * modeVal(Growth.M().hpMul) * dgModeK('boss'));
        e.dmgMul = (CFG.stage.dmgMul || 1) * modeVal(Growth.M().dmgMul) * (D.boss.dmgMul || 1);
        G.enemies.push(e); R.boss = e; R.bossAt = R.t;
        banner('WARNING', 'boss'); snd('bossIntro', { k: 0.7 });
        return;
      }
      R.wi++; R.wsp = 0; R.wmid = []; R.acc = 0; R.mobs = D.waves[R.wi].mobs; R.phase = 'wave';
      banner(R.wi === NW - 1 ? 'FINAL WAVE' : 'WAVE ' + (R.wi + 1) + ' / ' + NW, R.wi === NW - 1 ? 'boss' : ''); snd('wave', R.wi === NW - 1 ? { k: 0.8 } : null);
      return;
    }
    if (R.phase === 'wave') {
      var W = D.waves[R.wi], u = NW > 1 ? R.wi / (NW - 1) : 0, PK = D.pack;
      var maxA = Math.round(lerp(SP.maxAlive[0], SP.maxAlive[1], u) * dgModeK('alive')), qm = R.queue.filter(function (q) { return !q.mid; }).length;
      var room = Math.min(maxA - cnt.mobs - qm, SP.cap - cnt.alive - qm, W.n - R.wsp);
      R.acc += dt * dgModeK('spawn');
      var pe = lerp(PK.every[0], PK.every[1], u);
      if (R.wsp < W.n && R.acc >= pe) {
        var want = clamp(Math.round(lerp(PK.size[0], PK.size[1], u) + (Math.random() * 2 - 1) * (PK.sizeJit || 0)), PK.size[0], PK.size[1]);
        if (room >= Math.min(want, PK.minRoom || 3, W.n - R.wsp)) { R.acc = 0; var nn = Math.min(want, room); dgPack(D, 0, nn, R.t, R.wsp === 0 ? 'pincer' : null); R.wsp += nn; }
        else R.acc = pe;
      }
      (W.mids || []).forEach(function (m, j) {
        if (R.wmid[j] || R.wsp < m[0]) return;
        R.wmid[j] = true; banner('대장 출현!', 'boss');
        dgQueue({ mid: true, idx: m[1], side: R.midN++ % 2 ? 'L' : 'R', at: R.t + 500, intro: true });
      });
      R.maxAlive = Math.max(R.maxAlive, cnt.alive);
      var midsDone = (W.mids || []).every(function (m, j) { return R.wmid[j]; });
      if (R.wsp >= W.n && midsDone && !R.queue.length && cnt.alive === 0) {
        R.phase = 'rest'; R.restT = D.restMs || 1500;
        banner(R.wi === NW - 1 ? '보스가 깨어난다…' : 'WAVE ' + (R.wi + 1) + ' CLEAR', R.wi === NW - 1 ? 'boss' : 'small'); snd('waveClear');
      }
      return;
    }
    if (R.phase === 'champ') { dgChampStep(dt, R, D, cnt); return; }
    // 보스
    var B = R.boss; if (!B) return;
    R.bossT += dt;
    if (!B.alive() && R.deadAt == null) R.deadAt = R.t;   // 클리어 시간 = 보스가 쓰러진 때
    if (!B.alive() && R.lootT >= 0) { R.lootT += dt; dgRaidDrops(R, D); if (R.lootT > (D.boss.drop.burstMs || 900) + 600 && (!Enchant.items.length || R.lootT > 6000)) dgFinish('clear'); }
  }
  // 레이드 보스 보상(js/raid.js 가 쓰러지는 그림 끝에 부름): 불 결정 · 강화석이 머리 쪽에서 와르르(burstMs 동안) + 아주 큰 끌어당김 → 전부 빨려 듦
  // 속성 시련 수호자(2026-11-07): 걸어 들어옴 → 싸움(adds = 가끔 그 속성 몹 무리) → 쓰러짐 = 남은 몹 같이 쓰러짐 → deathMs 뒤 보상 와르르(dgRaidLoot) → 다 빨려 들면 끝
  function dgChampStep(dt, R, D, cnt) {
    var C = D.champ, S = G.stage;
    if (!R.boss) { if (R.t >= R.champAt) dgSpawnChamp(R, D); return; }
    var B = R.boss;
    R.bossT += dt;
    R.maxAlive = Math.max(R.maxAlive, cnt.alive);
    if (B.alive()) {
      var A = C.adds;
      if (A && R.bossT >= (A.firstMs || 0)) {
        R.addT += dt;
        var qm = R.queue.filter(function (q) { return !q.mid; }).length, room = Math.min(A.n, (A.max || 8) - cnt.mobs - qm, D.spawn.cap - cnt.alive - qm);
        if (R.addT >= A.everyMs && room >= Math.min(A.n, 2)) { R.addT = 0; dgPack(D, 0, room, R.t, null); }
      }
      return;
    }
    if (R.deadAt == null) {   // 클리어 시간 = 수호자가 쓰러진 때. 남은 몹은 같이 쓰러짐
      R.deadAt = R.t; R.lootT = -1; R.champDeadT = 0; S.bossDownT = 0; R.queue = [];
      G.hitstop = Math.max(G.hitstop, 200); G.slowT = Math.max(G.slowT, 1100);
      G.enemies.forEach(function (e) { if (e !== B && e.alive()) { e.noDrop = true; e.takeHit(9999, e.x > B.x ? 1 : -1, 10, true, { force: true }); } });
    }
    S.bossDownT += dt;
    if (R.lootT < 0) { R.champDeadT += dt; if (R.champDeadT >= (C.deathMs || 1400)) dgRaidLoot(B, B.x, B.y); return; }
    R.lootT += dt; dgRaidDrops(R, D);
    if (R.lootT > (C.drop.burstMs || 900) + 600 && (!Enchant.items.length || R.lootT > 6000)) dgFinish('clear');
  }
  // 레이드 · 시련의 마지막 보상 묶음: 레이드 보스(boss) 또는 수호자(champ). 결정 속성 = drop.el(없으면 던전 el)
  function dgFinal(D) { return D.boss || D.champ; }
  function dgRaidLoot(e, x, y) {
    var D = DG(), R = G.stage.dg, FB = dgFinal(D), DR = FB.drop;
    function rr(a) { return a[0] + Math.random() * (a[1] - a[0]); }
    var nc = sround(rr(DR.crys) * dgModeK('crys')), ns = sround(rr(DR.stones) * dgModeK('stones')), tot = nc + ns, ms = DR.burstMs || 900;
    Enchant.setMagnet(FB.magnet);
    R.drops = [];
    for (var i = 0; i < tot; i++) R.drops.push({ at: Math.round(i / tot * ms), kind: i % 3 === 2 && ns > 0 ? 'stone' : 'crys' });
    var kc = 0, ks = 0;   // 결정 · 강화석을 섞어서(3개 중 하나 강화석), 개수는 정확히
    R.drops.forEach(function (q) { if (q.kind === 'crys' && kc >= nc) q.kind = 'stone'; else if (q.kind === 'stone' && ks >= ns) q.kind = 'crys'; if (q.kind === 'crys') kc++; else ks++; });
    R.dropAt = { x: x, y: y };
    G.lootDrops = (G.lootDrops || 0) + ns;
    R.lootT = 0; R.lootN = { crys: nc, stones: ns };
    Skills.flash({ color: '#ffe8a0', alpha: 0.4, ms: 360 });
    if (Skills.glow) Skills.glow(x, y - 40 * AS, 120 * AS, '#ffb43a', 600, 0.7);
    snd('levelUp', { k: 0.8 });
  }
  // 와르르 떨어뜨리기(장면 시간으로, 멈춤 · 슬로모션과 같이): dgRaid 가 R.lootT 로
  function dgRaidDrops(R, D) {
    if (!R.drops || !R.drops.length) return;
    while (R.drops.length && R.drops[0].at <= R.lootT) {
      var q = R.drops.shift(), dir = Math.random() < 0.75 ? -1 : 1, yy = clamp(R.dropAt.y + (Math.random() * 2 - 1) * 34, world.laneTop, world.laneBottom);
      Enchant.drop(q.kind, q.kind === 'crys' ? dgFinal(D).drop.el || D.el : null, R.dropAt.x + (Math.random() * 2 - 1) * 34, yy, dir);
    }
  }
  // 끝남: 'clear' = 0초까지 버팀(남은 적은 같이 쓰러짐 · 덤 강화석), 'over' = 쓰러짐. 잠깐 뒤 dgResult
  function dgFinish(kind) {
    var S = G.stage, R = S.dg, D = DG();
    if (!R || R.end) return;
    R.end = kind; R.endT = 0; R.queue = [];
    if (kind === 'clear') {
      R.bonus = Math.max(0, Math.round((D.bonus || 0) * dgModeK('stones')));
      banner(D.rule === 'raid' ? (D.boss ? '토벌 성공!' : '시련 돌파!') : '버텼다!', 'boss');
      snd('waveClear');
      G.hitstop = Math.max(G.hitstop, 220); G.slowT = Math.max(G.slowT, 1400);
      Skills.flash({ color: '#fff2c0', alpha: 0.45, ms: 420 });
      FX.shake(J.shakePx * 2.2, 500);
      G.enemies.forEach(function (e) { if (e.alive()) { e.noDrop = true; e.dgSkip = true; e.takeHit(9999, e.x > G.player.x ? 1 : -1, 10, true, { force: true }); } });
      shots.length = 0; rocks.length = 0;
    }
  }
  // 결과 화면: 바닥에 남은 강화석 저절로 주움 + 덤 → 최고 기록(저장칸 · 난이도별) → 처치 · 대장 · 강화석 · 경험치
  function dgResult() {
    var S = G.stage, R = S.dg, D = DG(), clear = R.end === 'clear';
    S.result = R.end;
    Input.setOverride(null);
    if (window.Enchant) Enchant.collectAll(G.player);
    if (R.bonus) Growth.gainStone(R.bonus);
    var got = G.loot ? G.loot.stones : 0, stones = got + R.bonus, md = Growth.mode();
    R.rec = Growth.dgRecord(CFG.stage.dgId, md, { kills: R.kills, stones: stones, clear: clear, time: D.rule === 'raid' && clear ? Math.round(R.deadAt || R.t) : 0 });
    R.best = Growth.dgBest(CFG.stage.dgId, md);
    var NEW = '<i class="newrec">NEW</i>';
    if (D.rule === 'raid') { dgRaidResult(R, D, clear, got, stones, NEW); return; }
    document.getElementById('resTitle').textContent = clear ? '버텼다!' : '쓰러졌다';
    resultEl.className = 'result ' + (clear ? 'clear' : 'over') + ' dgres';
    document.getElementById('resStats').innerHTML =
      '<span class="dgname">' + D.name + (modeTag() ? ' · ' + Growth.M().name : '') + '</span>' +
      '버틴 시간 <b>' + Math.min(D.timeSec, Math.floor(R.t / 1000)) + '초</b> / ' + D.timeSec + '초<br>' +
      '처치 <b>' + R.kills + '</b>' + (R.rec.kills ? NEW : '') + ' · 대장 처치 <b>' + R.midKills + '</b><br>' +
      '얻은 강화석 <b>' + got + '</b>' + (R.bonus ? ' + 버틴 덤 <b>' + R.bonus + '</b> = <b>' + stones + '</b>' : '') + (R.rec.stones ? NEW : '') +
      '<br>얻은 경험치 <b>' + (G.xpGot || 0) + '</b> · <b>Lv ' + Growth.lv + '</b>' +
      '<span class="dgbest">최고 기록' + (modeTag() ? '(' + Growth.M().name + ')' : '') + ' · 처치 <b>' + R.best.kills + '</b> · 강화석 <b>' + R.best.stones + '</b></span>';
    encBadges();
    document.getElementById('btnNext').hidden = true;
    document.getElementById('btnSel').textContent = '던전 선택';
    snd(clear ? 'stageClear' : 'fail');
    openMenu(resultEl, document.getElementById('btnRetry'));
  }
  // 레이드 결과: 클리어 시간(최고 기록) · 어디까지 갔나(웨이브 / 보스 체력) · 처치 · 얻은 것(강화석 · 불 결정) · 경험치
  function dgRaidResult(R, D, clear, got, stones, NEW) {
    var B = R.boss, FB = dgFinal(D), where = clear ? '클리어 시간 <b>' + fmtTime(R.deadAt || R.t) + '</b>' + (R.rec.time ? NEW : '')
      : B && D.boss ? '보스 체력 <b>' + Math.ceil(B.hp / B.maxHp * 100) + '%</b> 남음 · ' + Math.max(0, Math.ceil(B.hp / D.boss.lineHp)) + '줄'
      : B ? '수호자 체력 <b>' + Math.ceil(B.hp / B.maxHp * 100) + '%</b> 남음' : '웨이브 <b>' + Math.max(1, R.wi + 1) + '</b> / ' + D.waves.length;
    document.getElementById('resTitle').textContent = clear ? (D.boss ? '토벌 성공!' : '시련 돌파!') : '쓰러졌다';
    resultEl.className = 'result ' + (clear ? 'clear' : 'over') + ' dgres';
    document.getElementById('resStats').innerHTML =
      '<span class="dgname">' + D.name + (modeTag() ? ' · ' + Growth.M().name : '') + '</span>' + where + '<br>' +
      '처치 <b>' + R.kills + '</b> · 대장 처치 <b>' + R.midKills + '</b>' + (clear ? ' · <b>' + (D.boss ? D.boss.name : FB.L[1]) + '</b> 토벌' : '') + lootLine() +
      '<br>얻은 경험치 <b>' + (G.xpGot || 0) + '</b> · <b>Lv ' + Growth.lv + '</b>' +
      '<span class="dgbest">최고 기록' + (modeTag() ? '(' + Growth.M().name + ')' : '') + ' · ' + (R.best && R.best.time ? '클리어 <b>' + fmtTime(R.best.time) + '</b> · ' + (D.boss ? '토벌' : '돌파') + ' <b>' + R.best.clears + '</b>번' : D.boss ? '아직 토벌 못 함' : '아직 돌파 못 함') + '</span>';
    encBadges();
    document.getElementById('btnNext').hidden = true;
    document.getElementById('btnSel').textContent = '던전 선택';
    snd(clear ? 'stageClear' : 'fail');
    openMenu(resultEl, document.getElementById('btnRetry'));
  }
  // 강화석(lootDrop 대신, 쓰러진 적마다): 잡몹 = 확률, 중간보스 = [최소, 최대] 개. x 난이도 stones
  function dgLoot(e) {
    var DD = DG().drop, m = dgModeK('stones'), dir = G.player.x > e.x ? -1 : 1, n = 0, kd = Growth.kindOf(e.type, e.T);
    if (e.mid) n = sround((DD.mid[0] + Math.random() * (DD.mid[1] - DD.mid[0])) * m);
    else if (Math.random() < (kd === 'tough' || kd === 'elite' ? DD.tough : DD.mob) * m) n = 1;
    for (var i = 0; i < n; i++) Enchant.drop('stone', null, e.x + (i - n / 2) * 8 * AS, e.y + (i % 2 ? 3 : -3), i % 2 ? -dir : dir);
    G.lootDrops = (G.lootDrops || 0) + n;
  }
  // 던전 남은 시간: 위 가운데 큰 도트 숫자(초). 마지막 warnSec 초 = 빨강 + 깜빡 + 초가 바뀔 때 툭 커짐. 시작 전 = 가득, 끝 = 0
  function drawDgTimer() {
    var R = G.stage.dg, D = DG(); if (!D || !D.timeSec) return;
    var ms = Math.max(0, D.timeSec * 1000 - R.t), s = Math.ceil(ms / 1000), warn = s <= (D.warnSec || 0) && !R.end;
    var st = CFG.damageText[warn ? 'dgTimerWarn' : 'dgTimer'] || CFG.damageText.multikill;
    var f = ms / 1000 - Math.floor(ms / 1000), pop = warn && s > 0 ? 1 + 0.35 * Math.max(0, f - 0.75) / 0.25 : 1;
    var z = (st.zoom || 1) * pop, x = dgTimerX((st.zoom || 1) * 13), y = Math.max(4, Math.round(LH * 0.02)) + (st.top0 || 0);
    ctx.save();
    ctx.globalAlpha = warn && Math.floor(performance.now() / 250) % 2 ? 0.45 : 1;
    ctx.translate(x, y); ctx.scale(z, z); ctx.translate(-x, -y);
    var pw = String(s).length * 6.5 + 8;   // 뒤 판: 반투명 검은 띠(큰 데미지 숫자 위에서도 읽히게)
    ctx.fillStyle = 'rgba(10,6,12,0.42)'; ctx.fillRect(x - pw / 2, y - 3, pw, 20); ctx.fillRect(x - pw / 2 - 1, y - 2, pw + 2, 18);
    FX.drawPixelText(ctx, String(s), x, y, st);
    ctx.restore();
  }
  // 시계 가로 자리: 가운데. 폰 화면에서 위 HUD 버튼(능력치 · 기술 · 강화)과 겹치면 그 오른쪽으로 비킴(버튼이 캔버스 위 DOM 이라 가려짐). hw = 시계 반폭(도트)
  var dgHb = { t: 0, r: 0, b: 0 };
  function dgTimerX(hw) {
    var now = performance.now();
    if (now - dgHb.t > 500) {   // 버튼 자리는 0.5초마다만 잼(레이아웃 읽기 줄임)
      dgHb.t = now; dgHb.r = 0;
      var hb = document.querySelector('.hbtns'), c = canvas.getBoundingClientRect();
      if (hb && hb.offsetParent && c.width) { var r = hb.getBoundingClientRect(); if (r.width) dgHb.r = (r.right - c.left) * LW / c.width; }
    }
    var x = LW / 2;
    if (dgHb.r && x - hw < dgHb.r + 12) x = dgHb.r + 12 + hw;
    return Math.min(x, LW - hw - 4);
  }
  // 던전 들어가기: 배경 · 소품 · 적 그림을 불러온 뒤 처음부터(G.stageNo = 마지막으로 고른 판 그대로)
  function goDungeon(id) {
    var st = dgStage(id); if (!st) return Promise.resolve(null);
    if (!st.dg.boss) Raid.free(); else Raid.load(st.dg.boss);   // 레이드 보스 그림: 레이드에 들어갈 때만(다른 곳이면 놓아줌)
    loading(true);
    return Promise.all([Assets.ensureBg(st.bg), Props.load(st), Assets.ensureEnemies(stageEnemies(st))]).then(function (r) {
      loading(false);
      G.assets.bg = r[0];
      CFG.stage = st; CFG.bg = st.bg; sky = null;
      applyStageWorld(); bgCache = null; controlPad = measureControlPad();
      resetStage();
      return st;
    });
  }
  // 도전 중 나가기(설정 창 「나가기」 → 확인): 바닥 강화석은 저절로 주움(이미 주운 것과 함께 남음), 기록은 안 남김 → 던전 고르기
  function dgQuit() {
    var S = G.stage, R = S && S.dg; if (!R) return;
    if (window.Enchant) Enchant.collectAll(G.player);
    R.end = 'quit'; S.result = 'quit';
    openStageSelect('dungeon');
  }
  function dgRunning() { var S = G.stage; return MODE === 'stage' && !!(S && S.dg && !S.dg.end && !S.result); }

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
    if (CFG.stage.dg) {
      (CFG.stage.dg.mids ? CFG.stage.dg.mids.list : []).forEach(function (L, i) { var M = dgMid(i); tintArt(M.type, M.vk); });   // 던전: 중간보스 그림(30초에 멈칫하지 않게)
      var CQ = dgChamp(); if (CQ) tintArt(CQ.type, CQ.vk);   // 속성 시련 수호자
      // 속성 몹 색(2026-11-07): 던전 el = 그 던전 몹 전부, elRand = 이번 도전 속성(elPool) x types
      var D0 = CFG.stage.dg, R0 = G.stage && G.stage.dg, els = D0.el ? [D0.el] : (R0 && R0.elPool) || [];
      var tps = D0.el ? stageEnemies(CFG.stage) : D0.elRand ? D0.elRand.types : [];
      if (window.ElMob) tps.forEach(function (t) { var E0 = CFG.enemies[t]; if (E0 && !E0.variant && !E0.boss) els.forEach(function (k) { tintArt(t, 'el_' + ElMob.key(k)); }); });
      return;
    }
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
    var MLq = !st.dg && CFG.midBoss && CFG.midBoss.list && CFG.midBoss.list[st.id];   // 2026-11-09: 중간보스가 판 잡몹이 아닌 따로 그린 적(11~20판)
    if (MLq) add(MLq[0]);
    if (st.dg) { (st.dg.mobs || []).forEach(function (m) { add(m[0]); }); ((st.dg.mids && st.dg.mids.list) || []).forEach(function (L) { add(L[0]); }); (st.dg.waves || []).forEach(function (w) { (w.mobs || []).forEach(function (m) { add(m[0]); }); }); if (st.dg.boss) add(st.dg.boss.summon.type); if (st.dg.champ && st.dg.champ.L) add(st.dg.champ.L[0]); }   // 던전(2026-11-07) · 레이드 웨이브 · 부르는 졸개
    return out;
  }

  // ---------- 바위 던지기 (골렘 throw): 날아가는 바위 = 포물선 → 떨어진 자리 반경 안이면 맞음 ----------
  // 플레이어 공격 탄(Projectiles)과 따로: 적이 던진 것. { e: 던진 적, s: 공격 수치, x0,y0: 출발(땅 줄), h0: 출발 높이, tx,ty: 떨어질 자리, t }
  //   3단계 두꺼비 독 뱉기도 같은 길: s.proj / s.burstArt = 날아가는 그림 / 터지는 그림 이름(fxArt, 없으면 골렘 바위), s.puddle = 떨어진 자리에 독 웅덩이
  var rocks = [];
  // faceR(2026-11-09, config FX2R): 오른쪽으로 날아가는 그림(11~20판 AI 효과) → 뒤집기를 반대로. 그림 이름 = 적 config fxArt 의 이름
  function fxFaceR(e, name) { var A = e.T && e.T.fxArt && e.T.fxArt[name]; return !!(A && A.faceR); }
  function throwRock(e, s, tx, ty) {
    var F = G.assets.enemyFx && G.assets.enemyFx[e.type];
    rocks.push({ e: e, s: s, x0: e.x + e.dir * s.spawn.x, y0: e.y, h0: -s.spawn.y, tx: tx, ty: ty, t: 0, dir: e.dir, fr: fxFaceR(e, s.proj || 'boulder'),
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
      ctx.save(); ctx.translate(x, y); if ((r.dir > 0) !== r.fr) ctx.scale(-1, 1);   // 그림은 왼쪽으로 돌며 날아감 → 오른쪽으로 던지면 뒤집기(fr = 오른쪽으로 나는 그림이면 반대)
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
    shots.push({ e: e, s: s, x: mx, z: z, h0: -s.spawn.y, h: -s.spawn.y, dir: e.dir, trav: 0, t: 0, wait: (o && o.wait) || 0, sc: (o && o.scale) || 1, fr: fxFaceR(e, s.proj || 'bullet'),
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
      // 2026-11-09 따라오는 구체(s.homing = 초당 줄을 옮기는 도트, 11~20판 공허 사도 · 마녀 해골 · 심연의 눈): 플레이어 줄 쪽으로 천천히 꺾임
      if (s.homing && p.state !== 'dead' && b.t > (s.homeAfterMs || 0)) { var hz = s.homing * dt / 1000; b.z = clamp(b.z + clamp(p.y - b.z, -hz, hz), world.laneTop, world.laneBottom); }
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
          if (s.projEnd && b.art && b.art.frames[s.projEnd - 1]) FX.sprite(b.x, b.z - b.h, [b.art.frames[s.projEnd - 1]], 7, b.art.pivot, (b.dir > 0) !== b.fr, false);
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
      ctx.save(); ctx.translate(x, y); ctx.scale((b.dir > 0) !== b.fr ? -b.sc : b.sc, b.sc);   // 그림은 왼쪽으로 날아감(꼬리가 오른쪽) → 오른쪽으로 쏘면 뒤집기(fr = 오른쪽으로 나는 그림이면 반대). sc = 작은 박쥐 무리
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
      } else if (!c.s.noProj) window.drawShadow(ctx, x, y, 14 * AS * (0.4 + 0.6 * u));
    });
  }
  function drawCannons(camX) {
    cannons.forEach(function (c) {
      var u = Math.min(1, c.t / c.s.fallMs), A = c.F[c.s.proj || 'cannonball'], x = snap(c.tx - camX), y = snap(c.ty - c.s.dropHeight * (1 - u * u));   // 점점 빨리 떨어짐
      if (c.s.noProj) return;   // 2026-11-09 낙뢰 · 물기둥 · 저주 문양: 떨어지는 것 없이 그 자리에서 터지는 그림만(blast)
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
      if (window.FXDraw && !q.s.ringArt) {   // ringArt(2026-11-09 11~20판) = AI 그림 고리(아래 그림 길)
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
  // 무기 속성 효과 · 바닥 강화석/결정(2026-11-06, js/enchant.js)
  Enchant.init(CFG, {
    enemies: function () { return G.enemies; },
    player: function () { return G.player; },
    kill: elKill,
    got: gotLoot,
    view: function () { var a = CFG.stage && CFG.stage.dg; return { laneTop: world.laneTop, laneBottom: world.laneBottom, x0: (a ? 0 : G.camX) + 14, x1: (a ? world.width : G.camX + LW) - 14 - controlPad }; }   // 던전 = 싸움터 전체
  });
  // 레이드 보스(2026-11-07, js/raid.js): 쓰는 도구
  Raid.init({
    G: function () { return G; }, world: world, LW: function () { return LW; },
    hit: onPlayerHit, banner: banner, snd: snd, josa: josa, Skills: Skills,
    shake: function (m, ms) { FX.shake(J.shakePx * m, ms); }, flash: function (o) { Skills.flash(o); },
    intro: function (e) { startIntro(e); },
    loot: function (e, x, y) { dgRaidLoot(e, x, y); },
    // 졸개 부르기(포효): 보이는 싸움터(보스 앞) 뒤쪽에서 뛰어내림
    summon: function (type, n, e) {
      var R = G.stage.dg; if (!R) return;
      var x0 = G.camX + 30 * AS, x1 = Math.max(x0 + 20, (Raid.wallX() || x0 + 200) - 20);
      for (var i = 0; i < n; i++) dgQueue({ type: type, x: x0 + (i + 0.5) / n * (x1 - x0), y: world.laneTop + Math.random() * (world.laneBottom - world.laneTop) * 0.4, drop: 90, at: R.t + 300 + i * 160 });
    }
  });
  Props.init(CFG, {
    laneY: laneY,
    fx: function () { return G.assets && G.assets.fx; },
    hitstop: function (ms) { G.hitstop = Math.max(G.hitstop, ms); },
    feed: feed,     // 빵·고기 = 포만감 +%(2026-11-06 밤)
    drink: drink,   // 물약 = 체력·마나 바로(2026-11-06 밤)
    club: gotClub,  // 몽둥이 주움(2026-11-06)
    // 물약이 머무는 곳: 걷는 길 + 지금 화면(폰 버튼 밑 빼고)
    view: function () { var a = CFG.stage && CFG.stage.dg; return { laneTop: world.laneTop, laneBottom: world.laneBottom, x0: (a ? 0 : G.camX) + 14, x1: (a ? world.width : G.camX + LW) - 14 - controlPad }; }   // 던전 = 싸움터 전체
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
    if (Math.random() < (e.T.hp >= PO.toughHp ? PO.tough : PO.mob) * modeVal(Growth.M().drop)) Props.dropPotion(e.x, e.y, G.player.x > e.x ? -1 : 1, null);
  }
  // ---------- 첫 무기 몽둥이 (2026-11-06, 형님 승인, 수치 = config club) ----------
  // 나오는 때: 첫 판 · 견습(전직 전, 견습 옷) · 아직 없음 · 바닥에 없음 → 잡몹이 쓰러질 때 chance, 그 판 sureAt 번째 잡몹이면 꼭(G.clubN = 센 수)
  function clubWanted() { return !!CFG.club && MODE === 'stage' && G.stageNo === 1 && !CFG.stage.dg && !Growth.cls && !Growth.club && G.classKey === 'novice' && !Props.clubs.length; }
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

  // ================= 무기 강화 · 속성 (2026-11-06, 형님 승인, 수치 = config enchant, 계산·저장 = growth.js Growth.weapon, 효과·오라·줍기 = js/enchant.js) =================
  //   wpn() = 지금 입은 직업의 무기(견습 = null). 시험 버튼으로 입은 다른 직업 = 시험 무기(저장 안 함)
  //   G.loot = 이 판에서 얻은 것 { stones, crys: { 속성: 수 } } (결과 화면)
  var ENC = CFG.enchant || null;
  function wpn() { return ENC ? Growth.weapon(G.classKey) : null; }
  function wb(k) { var w = wpn(); return w ? w.bonus(k) : 0; }
  function artLoaded(k) { return !!(G.assets && G.assets.weapons && G.assets.weapons[k] && CFG.art.weapons[k]); }
  // 확률 반올림: 2.5 → 2 또는 3(반반)
  function sround(v) { var f = Math.floor(v); return f + (Math.random() < v - f ? 1 : 0); }
  // 매 장면: 플레이어에 무기 값 넣기(그림 · 오라 · 빠르기 · 범위 · 쿨타임 · 마나)
  function wpnApply(p) {
    var w = wpn();
    p.wArt = w ? w.art(artLoaded) : null; p.els = w ? w.els() : null;
    if (!w) { p.reachMul = 1; p.castSpd = 1; p.cdMul = 1; p.mpMul = 1; return; }
    p.atkSpd *= 1 + w.bonus('atkSpd') + (w.has('wind') ? ENC.fx.wind.atkSpd : 0);
    p.reachMul = 1 + w.bonus('reach'); p.castSpd = 1 + w.bonus('castSpd');
    p.cdMul = 1 - w.bonus('cd'); p.mpMul = 1 - w.bonus('mp');
  }
  // 날렵한 몸놀림(2026-11-08, 기사 · 법사 늘 켜진 기술): 배웠으면 { charges, cd, refill, dist } (config SKILL_TREE nimble.passive), 아니면 null
  function nimbleOf() {
    var bk = Growth.book(G.classKey), e = bk && !bk.novice && bk.entry('nimble'), P = e && e.passive;
    if (!P || !bk.learned('nimble')) return null;
    var i = Math.max(1, bk.lv('nimble')) - 1;
    return { charges: P.charges ? P.charges[i] : 2, cd: P.val[i], refill: P.refillMs ? P.refillMs[i] : P.val[i], dist: P.dist ? P.dist[i] : 0 };
  }
  // 기술 크기 배율(사냥 손맛 aoe 에 곱함): 기사 +10 공격 범위 · 법사 +10 마법 범위
  function wArea() { return 1 + wb('area') + wb('reach'); }
  // 강화석 · 결정 떨어뜨림(xpStep, 쓰러진 적마다 한 번): 잡몹 = 확률, 중간보스 · 보스 = 꼭. 보스는 판 둘째 속성 결정도
  function lootDrop(e) {
    if (!ENC || MODE !== 'stage' || e.noDrop) return;
    if (DG() && DG().drop) { dgLoot(e); return; }   // 던전(2026-11-07): 던전 값(config dungeons.○○.drop)
    var D = ENC.drop, m = modeVal(Growth.M().drop), dir = G.player.x > e.x ? -1 : 1, n = 0, kd = Growth.kindOf(e.type, e.T);
    if (e.T.boss) n = sround(D.boss * m);
    else if (e.mid) n = sround(D.mid * m);
    else if (Math.random() < (kd === 'tough' || kd === 'elite' ? D.tough : D.mob) * m) n = 1;
    for (var i = 0; i < n; i++) Enchant.drop('stone', null, e.x + (i - n / 2) * 8 * AS, e.y + (i % 2 ? 3 : -3), i % 2 ? -dir : dir);
    var SE = ENC.stageEl[CFG.stage.id];
    if (e.T.boss && SE && SE[1]) {
      var c = sround(D.bossCrys * (D.crys[Growth.mode()] || 1));
      for (var j = 0; j < c; j++) Enchant.drop('crys', SE[1], e.x + (j + 1) * 10 * AS * dir, e.y, dir);
    }
    G.lootDrops = (G.lootDrops || 0) + n;
  }
  // 주움(enchant.js 가 부름): 저장 + 이 판 기록 + 소리
  function gotLoot(kind, el) {
    if (kind === 'stone') { Growth.gainStone(1); G.loot.stones++; }
    else { Growth.gainCrys(el, 1); G.loot.crys[el] = (G.loot.crys[el] || 0) + 1; }
    snd('orb', { v: 1.4 });
  }
  // 지속 피해 · 튀는 번개로 쓰러뜨림(enchant.js hurt): 보통 쓰러짐 길(takeHit) → 보스면 onBossDown, 잡몹이면 몇 마리 잡기
  function elKill(e, n) {
    var res = e.takeHit(n, G.player.x < e.x ? 1 : -1, 2, false, { force: true });
    if (res === 'dead') { if (e.T.boss) onBossDown(e); else onKill(e); }
  }
  // 판을 깸: 바닥에 남은 것 저절로 주움 + 판 속성 결정 → 결과 화면 한 줄(얻은 것)
  function clearLoot() {
    if (!ENC) return '';
    Enchant.collectAll(G.player);
    var SE = ENC.stageEl[CFG.stage.id], D = ENC.drop;
    if (SE) { var n = sround(D.clear * (D.crys[Growth.mode()] || 1)); if (n > 0) { Growth.gainCrys(SE[0], n); G.loot.crys[SE[0]] = (G.loot.crys[SE[0]] || 0) + n; } }
    return lootLine();
  }
  function lootLine() {
    var L = G.loot, parts = [];
    if (!L) return '';
    if (L.stones) parts.push('강화석 <b>' + L.stones + '</b>');
    ENC.order.forEach(function (k) { if (L.crys[k]) parts.push('<i class="elc" style="color:' + ENC.el[k].col2 + '">' + ENC.el[k].name + ' 결정</i> <b>' + L.crys[k] + '</b>'); });
    return parts.length ? '<br><span class="lootline">얻은 것: ' + parts.join(' · ') + '</span>' : '';
  }
  // 보스는 꼭 하나(config potions.bossAt: 'rage' = 화날 때 · 'death' = 쓰러질 때). 플레이어 쪽으로 튐
  function bossPotion(B, when) {
    var PO = CFG.potions;
    if (!PO || B.potionDone || B.raid || (PO.bossAt || 'rage') !== when) return;   // 레이드 보스(몸 뒤 = 못 주움)는 없음
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
    p.awkEcho = cls === 'assassin';   // 암살자 각성 「암영 폭주」(2026-11-09): 평타마다 붉은 잔상 베기 한 번 더(js/assassin.js)
    p.awkArrow = cls === 'archer';   // 궁수 각성 「매의 눈」(2026-11-09): 화살 하나 더 + 더 꿰뚫음(js/archer.js)
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
      } else if (a.cls === 'assassin') {   // 암살자 암영 폭주(2026-11-09): 몸 둘레 진홍 · 검은 연기 알갱이
        Skills.debris(p.x + (Math.random() * 2 - 1) * 16 * AS, hy - (20 + Math.random() * 60) * AS, p.y, 1, { cols: ['#ffffff', '#ff8a9a', '#ff2a4a', '#3a0a14'], glow: true, sp: 50, size: 1.6, ms: 460, g: -180, spread: 0.7 });
      } else if (a.cls === 'archer') {   // 궁수 매의 눈(2026-11-09): 눈 높이에서 흩날리는 금빛 · 연두 깃털빛
        Skills.debris(p.x + (Math.random() * 2 - 1) * 18 * AS, hy - (40 + Math.random() * 50) * AS, p.y, 1, { cols: ['#ffffff', '#fff2a0', '#9dff8a'], glow: true, sp: 60, size: 1.5, ms: 520, g: -120, spread: 0.9 });
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
    p.superArmor = false; p.cdRate = 1; p.freeMp = p.echoCast = false; p.awkArrow = false; p.look = null;
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
      } else if (cls === 'archer') {
        if (h >= 75 && h <= 165 && s > 0.15) { nh = 48; ns = Math.min(1, s * 1.2 + 0.15); nl = Math.min(0.85, l * 1.05); }   // 초록 두건 · 망토 → 금빛(매의 눈, 2026-11-09)
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
      if (!e.alive() || e.raid || e.asleep || e.alertT > 0 || busy || p.state === 'dead' || p.state === 'held') { e.lostT = 0; e.lostX = null; return; }
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
    if (p.state !== 'dead' && p.mp < p.maxMp) p.mp = Math.min(p.maxMp, p.mp + Growth.mpRegen(G.classKey) * (1 + wb('mpRegen')) * dt / 1000);   // 법사 강화 +3 = 마나 회복 +   // 마나 순환(늘 켜진 기술)도
    // 신성 가호(성기사 늘 켜진 기술, 2026-11-08): 1초마다 최대 체력 x regen 만큼 체력이 참(쓰러지면 안 참). 소수점은 모아 두었다가 1 이 되면 더함
    var bk = Growth.book(G.classKey), rg = bk && !bk.novice ? bk.bonus('regen') : 0;
    if (rg > 0 && p.state !== 'dead' && p.hp > 0 && p.hp < p.maxHp) {
      p.regenAcc = (p.regenAcc || 0) + p.maxHp * rg * dt / 1000;
      if (p.regenAcc >= 1) { var n = Math.floor(p.regenAcc); p.regenAcc -= n; p.hp = Math.min(p.maxHp, p.hp + n); }
    } else p.regenAcc = 0;
  }
  // 쓰러진 적(어떻게 쓰러졌든: 플레이어 타·기술·보스와 같이 쓰러짐)마다 한 번 경험치. 적 머리 위에 「+13 XP」
  function xpStep() {
    var idx = stIdx() - 1, R = G.stage && G.stage.dg;
    G.enemies.forEach(function (e) {
      if (e.alive() || e.xpDone) return;
      e.xpDone = true;
      if (e.dgSkip) return;   // 던전 끝(버텼다)에 같이 쓰러진 적: 경험치 · 보상 · 처치 수 없음
      if (R && !R.end) { R.kills++; if (e.mid) R.midKills++; }   // 던전 처치 수(결과 · 최고 기록)
      if (e.mid) midDown(e);   // 중간보스(2026-11-06): 쓰러짐 연출 + 물약 꼭 하나
      else if (!e.T.boss) snd('pop');   // 쓰러진 잡몹 「펑」(보스는 onBossDown 의 bossDown)
      mobPotion(e);   // 물약(2026-11-06 밤)
      clubDrop(e);    // 첫 무기 몽둥이(2026-11-06, 1판 견습만)
      lootDrop(e);    // 강화석 · 속성 결정(2026-11-06)
      var n = Growth.enemyXp(e.type, e.T, idx);
      if (e.xpMul && n > 0) n = Math.max(1, Math.round(n * e.xpMul));   // 몹 떼(사냥 손맛): 한 마리 경험치 xpMul 배
      var MX = modeVal(Growth.M().xp);   // 2026-11-09: 판 순서대로 오름(config modes.normal.xp = [1판, 10판, 20판])
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

    wearOutfit();      // 2차 옷 레벨(기사 Lv25 = 성기사, 2026-11-08 30 → 25)이 되면 옷 그림이 바뀜(아니면 그대로)
    checkUnlock(up);   // 기술 칸이 늘었으면(Lv10 · Lv13 · Lv15, PC 는 Lv15 에 10칸) 「축하합니다!」 알림(아래 openUnlock)
    // 2차 Lv(25)이 됨 → 그 자리에서 갈래 고르기(게임 멈춤). 칸 알림이 떠 있으면 그걸 닫은 뒤(2026-11-08)
    if (needBranchChoice()) { if (upEl && !upEl.hidden) branchAfterUp = true; else openBranchChoice(null); }
    else if (needTier3Choice()) { if (upEl && !upEl.hidden) branchAfterUp = true; else openTier3(null); }   // 3차 Lv(50, 2026-11-10)
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
    if (G.stage.dg) { dgStep(dt); return; }   // 던전(2026-11-07): 규칙은 dgStep
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
          var ne = S.queue[i].place != null ? spawnRightPlaced(S.queue[i]) : spawnEnemy(S.queue[i].type, S.queue[i].side, S.queue[i].opt, S.queue[i].off); S.queue.splice(i, 1);
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
  // 레이드 보스 자동 조종(2026-11-07, 균형 시험): Raid.bot 이 정한 자리로(예고를 보고 피함 · 점프 · 회피), 가까운 졸개가 있으면 먼저. 머리가 낮을 때는 점프 공격도
  function botRaid(dt, p) {
    var RB = Raid.bot(p), ax = { x: 0, y: 0 };
    if (!RB) { Input.setOverride(ax); return; }
    var add = null, ad = 1e9;
    G.enemies.forEach(function (e) { if (!e.alive() || e.raid || !e.entered) return; var d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y) * 2; if (d < ad) { ad = d; add = e; } });
    var tx = RB.x, ty = RB.y, fight = null;
    if (add && !RB.threat && ad < 150 * AS) { var sd = add.x > p.x ? 1 : -1; tx = add.x - sd * 46 * AS; ty = add.y; fight = add; }
    var ex = tx - p.x, ey = ty - p.y;
    if (Math.abs(ex) > 4) ax.x = Math.sign(ex);
    if (Math.abs(ey) > 3) ax.y = Math.sign(ey);
    if (RB.dodge && p.dodgeReady()) { Input.setOverride({ x: RB.dodge.x, y: RB.dodge.y }); Input.pressDodge(); return; }
    Input.setOverride(ax);
    if (RB.jump && p.state !== 'jump') Input.pressJump();
    if ((G.rage || 0) >= 100 && !G.awk && !RB.threat) Input.pressAwaken();
    botAtkT -= dt;
    if (botAtkT > 0 || (RB.threat && !fight)) return;
    var inPlace = fight ? Math.abs(ey) <= 6 && Math.abs(ex) <= 22 * AS : Math.abs(ex) <= 14;
    if (!inPlace) return;
    if (p.state !== 'attack') p.dir = fight ? (fight.x > p.x ? 1 : -1) : 1;
    if (!fight && RB.jumpAtk && p.state !== 'jump' && Math.random() < 0.3) Input.pressJump();
    Input.pressAttack(); botAtkT = 140;
    if (G.botEager) botSkill(p, fight || Raid.boss());
    else if (Math.random() < 0.12) Input.pressSkill(botSlot());
  }
  function botThink(dt) {
    var p = G.player, best = null, bd = 1e9;
    var RBs = window.Raid && Raid.boss();
    if (RBs && RBs.alive() && G.stage.dg && G.stage.dg.phase === 'boss') { botRaid(dt, p); return; }
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
    if ((G.classKey === 'mage' || G.classKey === 'archer') && !G.botPlain) { botMage(dt, p, best, side, ax); return; }   // 궁수도 멀리서(2026-11-09)   // botPlain = 예전처럼 붙어서(비교 시험용)
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
    } else if (sfx && sfx.type === 'aifx') {     // 암살자 평타(2026-11-09): AI 효과 그림(js/assassin.js, 2차 갈래면 갈래 색)
      if (window.Assassin) Assassin.swingFx(p, st0, sfx);
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
    if (!dodgeEls) dodgeEls = [document.getElementById('btnDodge')].filter(Boolean);   // PC 회피 글자(dodgeChip)는 2026-11-07 아래 막대로 바뀌며 없어짐
    // 2026-11-08 연속 2번: 점(pips) = 남은 회피 수, 쿨타임(시계 방향) = 두 번 다 쓴 뒤만
    var DI = p.dodgeInfo(), f = Math.round(DI.frac * 50) / 50, key = f + '|' + DI.n + '|' + DI.max;
    if (key === dodgeLast) return;
    dodgeLast = key;
    dodgeEls.forEach(function (el) {
      el.style.setProperty('--cd', f); el.classList.toggle('cool', f > 0);
      var pp = el.querySelector('.pips'); if (pp) pp.hidden = DI.max <= 1;   // 점 = 2번 이상일 때만(날렵한 몸놀림)
      el.classList.toggle('multi', DI.max > 1);
      el.querySelectorAll('.pips b').forEach(function (b, i) { b.classList.toggle('on', i < DI.n); b.hidden = i >= DI.max; });
    });
  }

  // ---------- 갱신 ----------
  function step(realMs) {
    if (G.paused || rotHold) return;   // 스테이지 고르기 화면 · 창 · 세로 화면(가로로 돌려 주세요): 멈춤
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
    p.nimble = nimbleOf();   // 늘 켜진 기술 날렵한 몸놀림(2026-11-08): 회피 쿨타임 · 거리
    wpnApply(p);   // 무기 강화 · 속성(2026-11-06): 그림 · 오라 · 빠르기(+6 · 바람) · 범위 · 쿨타임 · 마나
    if (window.ElMob) ElMob.playerMods(p);   // 속성 몹에게 얼어붙음 = 느려짐 + 상태 몸 색(2026-11-07)
    // 플레이어는 화면 끝까지(2026-11-06 형님 폰 접은 화면: 버튼 앞이 벽처럼 막힘). 버튼 밑 비우기는 적·물약만
    if (MODE === 'stage') { if (CFG.stage.dg) { world.minX = 14; world.maxX = world.width - 14; var rw = Raid.wallX(), rl = Raid.wallL && Raid.wallL(); if (rw != null || rl != null) { world.minX = rl != null ? rl : G.camX + 14; world.maxX = rw != null ? Math.min(world.maxX, rw) : Math.min(world.maxX, G.camX + LW - 14); } } else { world.minX = G.camX + 14; world.maxX = G.camX + LW - 14; } }   // 던전 = 싸움터 끝까지
    if (G.bot && MODE === 'stage' && !G.stage.result) botThink(dt);
    awkStep(dt, realMs);   // 각성 시간·불꽃·잔상·끝 폭발
    var pst0 = p.state;
    var ev = p.update(dt, world);
    // 끌어당기는 검압(기사 늘 켜진 기술, 2026-11-08): 평타 콤보 마무리 타(finisher)를 시작하면 한 번 → 맞기 전에 둘레 잡몹이 앞으로 끌려옴
    if (p.state === 'attack' && p.atk && !p.atk.pulled && Skills.comboPull) {
      p.atk.pulled = true;
      var cs = p.comboSteps && p.comboSteps()[p.atk.step];
      if (cs && !cs.cast && (cs.finisher || (cs.hits && cs.hits.some(function (h) { return h.finisher; })))) Skills.comboPull(p);
    }
    if (p.state === 'jump' && pst0 !== 'jump') snd('jump');
    if (ev.slash) {
      // fx 는 하나 또는 여러 개(법사 2타 = 바람 + 지팡이 끝 반짝임)
      var st0 = ev.slash.step;
      if (st0.cast) snd(st0.cast.kind === 'arrow' ? 'bowShot' : 'magicShot'); else if (window.SFX) SFX.swing(p.weaponKey, !!st0.finisher);   // 휘두르는 소리(무기마다)
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
    if (ev.moveSwing && G.classKey === 'archer' && window.Archer) { Archer.moveShot(p, ev.moveSwing.kind); snd('bowShot'); }   // 궁수(2026-11-09): 달리며 · 점프 공격 = 화살
    else if (ev.moveSwing) { moveSwingFx(p, ev.moveSwing.kind); if (window.SFX) SFX.swing(p.weaponKey, ev.moveSwing.kind !== 'jump'); }
    if (ev.land) { landFx(p); snd('land'); }
    if (ev.dodge && ev.dodge.start) snd('dodge');
    if (ev.dodge || ev.dodgeGhost) dodgeFx(p, ev);
    // 날아가는 마법탄: 처음 맞은 대상(또는 끝까지 날아간 곳)에서 터짐
    Projectiles.update(dt, hitTargets(), function (pr, t) { explode(pr.x, pr.y, pr.z, pr.st, pr.dir, pr.wk, t); });
    if (MODE === 'stage') {
      var E = G.ectx;
      E.now += dt; E.view.x0 = G.camX; E.view.x1 = G.camX + LW - (controlPad ? controlPad + 14 : 0);   // 적은 몸이 넓어서 버튼 쪽으로 조금 더 띄움
      if (CFG.stage.dg) { E.view.x0 = 0; E.view.x1 = world.width - (controlPad ? controlPad + 14 : 0); var rw2 = Raid.wallX(), rl2 = Raid.wallL && Raid.wallL(); if (rw2 != null || rl2 != null) { E.view.x0 = rl2 != null ? rl2 - 10 : G.camX; E.view.x1 = rw2 != null ? Math.min(E.view.x1, rw2 + 10) : Math.min(E.view.x1, G.camX + LW); } }   // 빙결의 여왕이 왼쪽에 서면(2026-11-08) = 여왕 앞(오른쪽)부터   // 던전 = 싸움터 전체(카메라가 움직여도 적은 싸움터 안) · 레이드 보스 = 보스 앞까지
      G.enemies.forEach(function (e) {
        e.update(dt, E);
        if (e.state === 'air') { G.cstats.maxAirMs = Math.max(G.cstats.maxAirMs, e.airT); G.cstats.maxAirHits = Math.max(G.cstats.maxAirHits, e.airHits); }   // 콤보 기록
      });
      if (PV) pvKills(); else xpStep();   // 쓰러진 적 → 경험치(성장). 미리보기 액자 = 경험치 없음, 다시 세움
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
      if (window.ElMob) ElMob.step(dt);   // 속성 몹(2026-11-07): 오라 고르기 · 돌풍 · 빛 퍼짐 · 독 웅덩이 · 쓰러짐 효과 · 바닥 위험 · 불탐
      mpStep(dt);            // 마나 차기
      fullStep(dt);          // 포만감: 체력 천천히 + 줄어듦(2026-11-06 밤)
      rageStep(dt);          // 분노: 싸움이 없으면 천천히 줆(2026-11-06 밤)
      awkPushStep(dt);       // 각성 변신 순간 밀려나는 적
      if (PV) pvStep(dt); else { stageStep(dt); if (G.train) trainStep(dt); }   // 테스트 맵(2026-11-10) = 판 규칙 위에 허수아비 몹 붙잡기 · = 웨이브 · 결과 없이 그 기술만 되풀이
      Props.update(dt, p);   // 부서지는 그림·음식 줍기
      Enchant.updateItems(dt, p);   // 강화석 · 결정 줍기(2026-11-06)
    } else {
      G.dummy.update(dt);
      var target = p.x - LW * 0.42;
      G.camX += (target - G.camX) * Math.min(1, dt / 120);
      G.camX = Math.max(0, Math.min(world.width - LW, G.camX));
    }
    FX.update(dt);
    Enchant.update(dt);    // 속성 지속 피해 · 얼음 · 독 퍼짐(2026-11-06)
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
    if (window.ElMob) ElMob.drawUnder(ctx, camX); // 속성 몹 바닥 자국(불타는 바닥 · 빙결 장판 · 독 웅덩이) · 빛 고리(2026-11-07)
    if (rocks.length) drawRocksUnder(camX);       // 바위 떨어질 자리 빨간 원 + 그림자
    if (cannons.length) drawCannonsUnder(camX);   // 대포알 떨어질 자리 그림자 + 빨간 원
    if (shots.length) drawShots(camX, true);      // 총알 그림자(지나가는 줄)
    FX.draw(ctx, camX, true);
    if (MODE === 'stage') Props.drawUnder(ctx, camX, LW);   // 소품 그림자·모닥불 빛
    if (MODE === 'stage') Enchant.drawUnder(ctx, camX);     // 강화석 · 결정 그림자(2026-11-06)
    Skills.drawUnder(ctx, camX, G.player);        // 번개 떨어질 자리 표시
    drawAwkUnder(camX);                           // 각성: 발밑 마법진·불빛
    // 깊이 순서(아래쪽 = 앞쪽). 각성 법사 룬은 몸 뒤 반 · 앞 반 · 신성 가호 금빛 고리 앞 반 · 반짝이 = 캐릭터 바로 앞(2026-11-08)
    var ents = [{ y: G.player.y, d: function () { Skills.drawGhosts(ctx, camX); drawRunes(camX, true); G.player.draw(ctx, camX, G.assets.weapons, DEBUG); Skills.drawAegisFront(ctx, camX, G.player); drawRunes(camX, false); } }];
    if (G.dummy) ents.push({ y: G.dummy.y, d: function () { G.dummy.draw(ctx, camX, DEBUG); } });
    G.enemies.forEach(function (e) { ents.push({ y: e.y + (e.alive() ? 0 : -0.5), d: function () { e.draw(ctx, camX, DEBUG); } }); });
    if (MODE === 'stage') Props.addDraw(ents, ctx, camX, LW, DEBUG);
    if (MODE === 'stage') Enchant.addDraw(ents, ctx, camX);   // 바닥 강화석 · 결정(2026-11-06)
    if (spikes.length) addSpikeDraw(ents, camX);   // 얼음 가시(땅에서 솟음 = 캐릭터와 깊이 순서)
    if (rings.length) addRingDraw(ents, camX);     // 화염 충격파 고리(바닥을 따라 퍼짐 = 캐릭터와 깊이 순서)
    if (window.Raid) Raid.addDraw(ents, ctx, camX);   // 레이드 보스 불길(띠 앞 끝 깊이, 2026-11-07)
    Skills.addEnts(ents, ctx, camX);               // 땅 융기 돌기둥(땅에서 솟음 = 캐릭터와 깊이 순서, 2026-11-06 밤)
    ents.sort(function (a, b) { return a.y - b.y; });
    ents.forEach(function (e) { e.d(); });
    Enchant.drawOver(ctx, camX);                  // 속성: 불타는·독·얼은 적 표시 · 튀는 번개 · 마법 자리 안개(2026-11-06)
    if (window.ElMob) ElMob.drawOver(ctx, camX);  // 속성 몹: 독가스 · 돌풍 · 플레이어 머리 위 상태 표시(2026-11-07)
    Projectiles.draw(ctx, camX);
    if (rocks.length) drawRocks(camX);            // 날아가는 바위(공중이라 캐릭터 위)
    if (shots.length) drawShots(camX, false);     // 날아가는 총알
    if (cannons.length) drawCannons(camX);        // 떨어지는 대포알
    Skills.drawOver(ctx, camX);                   // 번개 기둥·회전 원
    if (window.Raid) Raid.drawOver(ctx, camX);    // 레이드 보스: 떨어지는 운석 · 터짐 · 먼지(2026-11-07)
    FX.draw(ctx, camX, false);
    drawOrbs(camX);                               // 경험치 구슬(사냥 손맛)
    if (Enchant.drawTwinkles) Enchant.drawTwinkles(ctx, camX);   // 끌어당긴 강화석이 들어간 반짝(던전)
    Skills.drawFlash(ctx, LW, LH);
    drawCallout();                                // 「5 KILL!」(사냥 손맛)
    if (MODE === 'stage' && G.stage && G.stage.dg) drawDgTimer();   // 던전 남은 시간(위 가운데 큰 숫자)                // 기술 맞는 순간 화면 번쩍
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
    pcBarUi();                                    // PC 아래 막대 기술 칸(2026-11-07)
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
  ['pHp', 'pHpLag', 'pHpNum', 'pMp', 'pMpNum', 'pFull', 'pRage', 'pRageNum', 'btnAwk', 'awkPct', 'pcAwk', 'pcAwkPct', 'xpLine', 'xpFill', 'xpTxt', 'pLv', 'pXp', 'bossBar', 'bHp', 'bHpLag', 'bossName', 'midBar', 'mHp', 'mHpLag', 'midName', 'goPrompt', 'banner', 'stageInfo'].forEach(function (k) { hud[k] = document.getElementById(k); });
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
    var EW = wpn();   // 강화 버튼(2026-11-06): 직업 무기가 있을 때만, 강화할 수 있으면 가진 강화석 수
    setIf('enc', EW ? G.classKey + EW.lv() + ':' + Growth.stones + ':' + EW.canEnhance() : '', encBadges);
    setIf('pfull', Math.ceil(G.full || 0), function (v) { hud.pFull.textContent = '포만감 ' + v + '%'; hud.pFull.classList.toggle('empty', v <= 0); });
    // 분노 막대(2026-11-06 밤): 평소 = 분노 %(가득 = 빛남), 각성 중 = 남은 시간(직업 색) + 각성 이름. 각성 버튼(폰)·PC 아래 막대 각성 칸도 같이
    var A = G.awk, rg = A ? Math.max(0, 1 - A.t / A.ms) : (G.rage || 0) / 100, rs = A ? 'awk awk-' + A.cls : rg >= 1 ? 'full' : '';
    setIf('prg', Math.round(rg * 200) / 200, function (v) { hud.pRage.style.width = (v * 100) + '%'; });
    setIf('prgn', A ? '각성 ' + Math.max(0, Math.ceil((A.ms - A.t) / 1000)) + '초' : Math.floor(G.rage || 0) + '%', function (v) { hud.pRageNum.textContent = v; });
    setIf('prgc', rs, function (v) {
      hud.pRage.parentNode.parentNode.className = 'prg ' + v;
      var ready = v === 'full';
      [hud.btnAwk, hud.pcAwk].forEach(function (el) { if (el) { el.classList.toggle('ready', ready); el.classList.toggle('on', !!A); } });
      if (hud.pcAwk) ['knight', 'mage', 'archer', 'assassin', 'novice'].forEach(function (c) { hud.pcAwk.classList.toggle('awk-' + c, !!A && A.cls === c); });
    });
    // PC 각성 칸(2026-11-07): 물 높이 = 분노(각성 중 = 남은 시간), 글자 = 분노 % / 각성 중 남은 초 / 가득 = 「준비!」
    setIf('pcawk', Math.round(rg * 100) / 100, function (v) { if (hud.pcAwk) { hud.pcAwk.style.setProperty('--rg', v); hud.pcAwk.classList.toggle('has', v > 0 && v < 1); } });
    setIf('pcawkp', A ? Math.max(0, Math.ceil((A.ms - A.t) / 1000)) + '초' : rg >= 1 ? '준비!' : Math.floor(G.rage || 0) + '%', function (v) { if (hud.pcAwkPct) hud.pcAwkPct.textContent = v; });
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
    // 경험치 줄(2026-11-07, 화면 맨 아래): 0.1% 단위. 90% 넘으면 빛남(레벨업 직전), 최고 Lv = 가득 + MAX
    setIf('xpl', Growth.isMax() ? 'max' : Math.floor(Growth.xp / Growth.need() * 1000) / 10, function (v) {
      if (!hud.xpLine) return;
      var mx = v === 'max', f = mx ? 100 : v;
      hud.xpFill.style.width = f + '%';
      hud.xpTxt.textContent = 'Lv ' + Growth.lv + (mx ? '  MAX' : '  ·  EXP ' + f.toFixed(1) + '%');
      hud.xpLine.classList.toggle('near', !mx && f >= 90);
      hud.xpLine.classList.toggle('max', mx);
    });
    setIf('xplv', Growth.lv, function (v) { if (hud.xpTxt && !Growth.isMax()) hud.xpTxt.textContent = 'Lv ' + v + '  ·  EXP ' + (Math.floor(Growth.xp / Growth.need() * 1000) / 10).toFixed(1) + '%'; });
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
    setIf('dgp', !!(S.dg && !S.result && !S.dg.end), function (v) { if (phSetEl) { phSetEl.classList.toggle('dg', v); phSetEl.title = v ? '멈춤 · 설정' : '설정 (멈춤)'; phSetEl.setAttribute('aria-label', phSetEl.title); } });   // 폰 톱니 버튼: 던전 도전 중 = 멈춤 · 나가기
    if (S.dg) {   // 던전(2026-11-07): 「노말 · 강화석 광산  ·  처치 12 · 강화석 3」
      setIf('go', false, function (v) { hud.goPrompt.hidden = !v; });
      raidHud(S);
      if (S.dg.rule === 'raid') {   // 레이드: 「이지 · 불의 화산굴  ·  WAVE 2/5 · 처치 12 · 강화석 3」 / 보스 = 「레이드 보스」
        var RS0 = S.dg, wtxt = RS0.phase === 'boss' ? '레이드 보스' : RS0.phase === 'champ' ? '수호자' : 'WAVE ' + Math.max(1, RS0.wi + 1) + '/' + CFG.stage.dg.waves.length;
        setIf('info', 'rd' + Growth.mode() + wtxt + RS0.kills + ':' + (G.loot ? G.loot.stones : 0), function () { hud.stageInfo.textContent = modeTag() + CFG.stage.name + '  ·  ' + wtxt + ' · 처치 ' + RS0.kills + ' · 강화석 ' + (G.loot ? G.loot.stones : 0); });
        return;
      }
      setIf('info', 'dg' + Growth.mode() + S.dg.kills + ':' + (G.loot ? G.loot.stones : 0), function () { hud.stageInfo.textContent = modeTag() + CFG.stage.name + '  ·  처치 ' + S.dg.kills + ' · 강화석 ' + (G.loot ? G.loot.stones : 0); });
      return;
    }
    var waves = CFG.stage.waves;
    var go = !S.locked && S.next > 0 && S.next < waves.length && G.camX < S.lastLock + 70 && p.state !== 'dead';
    setIf('go', go, function (v) { hud.goPrompt.hidden = !v; });
    var wi = Math.min(waves.length, S.locked ? S.waveIdx + 1 : S.next + (S.next < waves.length ? 0 : 0));
    // 판 이름 앞에 난이도(2026-11-06): 「노말 · STAGE 3  늪지대  ·  2 / 7」
    if (CFG.stage.train) { setIf('info', 'train', function () { hud.stageInfo.textContent = CFG.stage.name; }); return; }   // 테스트 맵: 웨이브 수 없음
    setIf('info', Growth.mode() + wi + '/' + waves.length, function () { hud.stageInfo.textContent = modeTag() + CFG.stage.name + '  ·  ' + Math.max(1, wi) + ' / ' + waves.length; });
  }
  // 레이드 체력 막대(2026-11-07, index.html #raidBar): 이름 · RAID · 줄 수 「x34」 · 지금 줄(색) 위에 다음 줄 색 바탕 · 늦게 따라오는 막대 · 파란 그로기 막대 · 격노
  //   자리: 위 가운데. 왼쪽 위 플레이어 판 · 오른쪽 위 버튼과 겹치면 그 사이(좁으면 플레이어 판 밑으로), 0.5초마다만 잼
  var rbEl = null, rbPosT = 0;
  function raidHud(S) {
    if (!rbEl) rbEl = { box: document.getElementById('raidBar'), hp: document.getElementById('rbHp'), lag: document.getElementById('rbLag'), bg: document.getElementById('rbNext'),
                        lines: document.getElementById('rbLines'), gr: document.getElementById('rbGr'), name: document.getElementById('raidName') };
    if (!rbEl.box) return;
    var RB = window.Raid && Raid.bar(), show = !!RB && !S.result;
    setIf('rbshow', show, function (v) { rbEl.box.hidden = !v; rbPosT = 0; });
    if (!show) return;
    setIf('rbname', RB.name, function (v) { rbEl.name.textContent = v; });
    setIf('rbl', RB.lines, function (v) { rbEl.lines.textContent = 'x' + v; });
    setIf('rbf', Math.round(RB.frac * 1000), function (v) { rbEl.hp.style.width = v / 10 + '%'; });
    setIf('rblag', Math.round(RB.lag * 1000), function (v) { rbEl.lag.style.width = v / 10 + '%'; });
    setIf('rbc', RB.col + RB.next, function () { rbEl.hp.style.background = 'linear-gradient(rgba(255,255,255,0.45) 0 2px, ' + RB.col + ' 2px 70%, rgba(0,0,0,0.25) 70%), ' + RB.col; rbEl.bg.style.background = RB.next; });
    setIf('rbg', Math.round(RB.gauge * 200), function (v) { rbEl.gr.style.width = v / 2 + '%'; });
    setIf('rbst', (RB.groggy ? 'g' : '') + (RB.rage ? 'r' : ''), function () { rbEl.box.classList.toggle('groggy', RB.groggy); rbEl.box.classList.toggle('rage', RB.rage); });
    var now = performance.now();
    if (now - rbPosT > 500) { rbPosT = now; raidBarPos(); }
  }
  function raidBarPos() {
    var box = rbEl.box, hr = hudEl.getBoundingClientRect(), ps = document.querySelector('.hud .pstat'), L = hr.left + 8, R = hr.right - 8, T = 8;
    var pr = null;   // 플레이어 판(.pstat 자체는 폭 0 = 안의 막대 · 버튼으로 잼)
    if (ps) Array.prototype.forEach.call(ps.querySelectorAll('*'), function (c) { if (!c.offsetParent) return; var cr = c.getBoundingClientRect(); if (!cr.width || cr.top > 80) return; L = Math.max(L, cr.right + 12); pr = { bottom: Math.max(pr ? pr.bottom : 0, cr.bottom) }; });
    ['#btnSnd', '#btnPhSet', 'details > summary', '#combo'].forEach(function (sel) {
      var el = document.querySelector(sel); if (!el || !el.offsetParent) return;
      var r = el.getBoundingClientRect(); if (r.width && r.top < 60 && r.left > hr.left + hr.width / 2) R = Math.min(R, r.left - 10);
    });
    var w = R - L;
    if (w >= 300) { w = Math.min(w, 640); box.style.left = Math.round(L + (R - L - w) / 2 - hr.left) + 'px'; box.style.top = T + 'px'; box.style.width = Math.round(w) + 'px'; }
    else { var bt = pr ? pr.bottom - hr.top + 22 : 70, w2 = Math.min(hr.width - 40, Math.max(300, hr.width * 0.56)); if (lbOn) bt = Math.max(bt, canvas.getBoundingClientRect().top - hr.top + 8);   // 위아래 여백 화면: 위 여백에 자리가 없으면 게임 화면 안 맨 위(테두리에 걸치지 않게)
      box.style.left = Math.round((hr.width - w2) / 2) + 'px'; box.style.top = Math.round(bt) + 'px'; box.style.width = Math.round(w2) + 'px'; }
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
    var loot = clear ? clearLoot() : (ENC ? lootLine() : '');   // 강화석 · 속성 결정(2026-11-06): 깨면 판 속성 결정 + 바닥에 남은 것 주움
    if (clear && G.run) G.run.ms[CFG.stage.id] = S.time;
    var tot = 0, full = !!G.run && G.run.from === STAGES[0].id;
    //   2026-11-09 판 20개: 10판 마왕은 이제 1부 끝(「다음 스테이지」로 2부), ALL CLEAR 는 마지막 판만. 총 시간도 마지막 판에서만
    if (end && full && last) STAGES.forEach(function (st) { if (G.run.ms[st.id] != null) tot += G.run.ms[st.id]; else full = false; });
    document.getElementById('resTitle').textContent = !clear ? 'GAME OVER' : last ? 'ALL CLEAR!' : 'STAGE CLEAR!';
    resultEl.className = 'result ' + kind + (clear && last ? ' all' : '') + (end ? ' ending' : '');
    document.getElementById('resStats').innerHTML =
      (end ? '<span class="endline">' + (CFG.stage.endLine || '마왕을 쓰러뜨렸다!') + '</span>' + (last ? (full ? '1단계부터 총 시간 <b>' + fmtTime(tot) + '</b><br>' : '') : '마왕성 아래로 새로운 땅이 열렸다…<br>') : clear && last ? '모든 스테이지를 깼다!<br>' : '') +
      '시간 <b>' + fmtTime(S.time) + '</b> · 맞힌 수 <b>' + G.hits + '</b> · 최대 콤보 <b>' + G.maxCombo + '</b>' +
      (clear ? ' · 남은 체력 <b>' + p.hp + '</b>' : '') +
      '<br>얻은 경험치 <b>' + (G.xpGot || 0) + '</b> · <b>Lv ' + Growth.lv + '</b>' +
      loot +
      (opened ? '<br><span class="endline">' + CFG.modes[opened].name + ' 난이도가 열렸다!</span>' : '');
    encBadges();
    var nx = document.getElementById('btnNext');
    nx.hidden = !(clear && !last);
    document.getElementById('btnSel').textContent = '스테이지 선택';   // 던전 결과에서 바꿔 둔 이름
    var focus = clear && !last ? nx : clear ? document.getElementById('btnSel') : document.getElementById('btnRetry');
    snd(clear ? 'stageClear' : 'fail');
    // 전직(2026-11-06): 전직 판(2026-11-07 = 1판) 보스를 처음 깸 + 아직 직업 없음 → 전직 화면 먼저, 고르고 나면 결과 화면
    //   2차 갈래(2026-11-08): Lv25 가 됐는데 아직 안 고름 → 갈래 고르기 먼저
    if (needClassChange() || needBranchChoice() || needTier3Choice()) { resultEl.hidden = true; jobGate(function () { openMenu(resultEl, focus); }); }
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
    if (!CFG.stage.train) G.train = null; else if (G.train) G.train.spawned = false;   // 테스트 맵(2026-11-10): 다른 판으로 가면 끝, 다시 하기 = 몹 다시 세움
    if (!(CFG.stage.dg && CFG.stage.dg.boss)) Raid.free();   // 레이드 보스 그림(2026-11-07): 레이드가 아니면 놓아줌(메모리)
    else Raid.reset();
    if (window.ElMob) ElMob.reset();   // 속성 몹 바닥 위험 · 상태(2026-11-07)
    if (CFG.stage.dg) dgStart();   // 던전(2026-11-07)
    if (Enchant.setMagnet) Enchant.setMagnet(CFG.stage.dg ? CFG.stage.magnet : null);   // 끌어당김 = 던전에서만(판은 밟아서 주움)
    G.ectx = makeEnemyCtx();
    G.xpGot = 0;   // 이 판에서 얻은 경험치(결과 화면)
    G.full = CFG.fullness ? CFG.fullness.start : 0; G.fullAcc = 0; G.potGot = 0;   // 포만감·물약(2026-11-06 밤): 판마다 처음부터
    G.rage = 0; G.combatT = 0; G.awk = null; G.awkCount = 0; awkPush.length = 0;   // 분노·각성(2026-11-06 밤): 판 시작 = 0
    G.mh = newMh(); G.mk = { n: 0, t: 0 }; G.callout = null; G.kills = 0; G.bestKill = 0; orbs.length = 0;   // 사냥 손맛
    G.clubN = 0;   // 몽둥이(2026-11-06): 이 판에서 센 잡몹 수
    G.loot = { stones: 0, crys: {} }; G.lootDrops = 0; if (window.Enchant) Enchant.reset();   // 강화석 · 결정 · 속성 효과(2026-11-06)
    FX.setHunt && FX.setHunt(huntPart('dmgNum'));
    G.hits = 0; G.totalDmg = 0; G.maxCombo = 0; G.comboT = 0; G.cstats = { launch: 0, air: 0, otg: 0, cancel: 0, maxAirMs: 0, maxAirHits: 0 }; G.comboTagT = 0; G.hitstop = 0; G.slowT = 0; comboEl.hidden = true;
    var god = G.player && G.player.god;
    G.player = new Player(CFG);
    applyGrowth(G.player);
    G.player.god = !!god;
    G.player.x = CFG.stage.dg ? Math.round(world.width / 2) : 90;   // 던전 = 싸움터 가운데
    G.player.y = Math.round((world.laneTop + world.laneBottom) / 2);
    G.player.setCharacter(outfitAssets());
    G.player.weaponKey = G.weaponKey; G.player.setMoveSet(G.moveSet);
    G.camX = CFG.stage.dg ? clamp(G.player.x - LW / 2, 0, Math.max(0, world.width - LW)) : 0;
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
    if (!menuEl || menuEl.hidden || keyWait) return;   // 키 설정에서 「키를 누르세요」 중 = 그쪽이 받음
    // 고르기: 바꾼 키(config keys · js/keys.js) + 화살표는 늘 됨(2026-11-07 키 설정)
    var K = CFG.keys, c = e.code, btns = menuButtons();
    var up = K.up.indexOf(c) >= 0 || c === 'ArrowUp', down = K.down.indexOf(c) >= 0 || c === 'ArrowDown';
    var prev = up || K.left.indexOf(c) >= 0 || c === 'ArrowLeft', next = down || K.right.indexOf(c) >= 0 || c === 'ArrowRight';
    var push = c === 'Enter' || c === 'NumpadEnter' || c === 'Space' || K.attack.indexOf(c) >= 0;
    if (!prev && !next && !push) return;
    e.preventDefault(); e.stopPropagation();   // 게임 조작(input.js)으로 안 넘김
    if (!btns.length || e.repeat) return;
    var i = btns.indexOf(document.activeElement);
    // 키 표 칸(.kc): 위·아래 = 같은 줄의 위·아랫칸(data-c 같은 것), 없으면 그냥 앞·뒤
    var ae = document.activeElement;
    if ((up || down) && ae && ae.dataset && ae.dataset.c != null) {
      var to = menuEl.querySelector('.kc[data-c="' + ae.dataset.c + '"][data-r="' + (+ae.dataset.r + (down ? 1 : -1)) + '"]:not([disabled])');
      if (to) { to.focus(); return; }
    }
    if (prev || next) { i = i < 0 ? 0 : (i + (next ? 1 : -1) + btns.length) % btns.length; btns[i].focus(); return; }
    if (performance.now() - menuOpenAt < 400) return;
    (i >= 0 ? btns[i] : btns[0]).click();
  }, true);

  // 스테이지 고르기 화면: 열린 판만 누를 수 있음(잠긴 판 = 회색). 고르는 동안 게임은 멈춤
  //   던전 탭(2026-11-07): 위 「스테이지 · 던전」 탭으로 목록을 바꿈. 던전 카드 = 이름 · 한 줄 설명 · 지금 난이도 최고 기록(잠김 = 자물쇠 + 여는 법)
  //     카드 8개(레이드 · 속성 시련 6 · 광산)는 4칸 격자(좁으면 2칸). 속성 색(config color) = 카드 위 띠 · 이름 옆 보석, 시련 = 위에 「레이드 보스 준비 중」 띠(tag)
  //   view = 'stage' / 'dungeon'(없으면 지난번 탭). 난이도 탭은 던전에도 그대로(적 세기 · 강화석 배율)
  var selEl = document.getElementById('stageSel'), selView = 'stage', viewTabFocus = false;
  function openStageSelect(view) {
    if (view === 'stage' || view === 'dungeon') selView = view;
    if (needClassChange()) { G.paused = true; closeMenu(resultEl); openClassChange(openStageSelect); return; }   // 2단계를 깼는데 직업이 없음 → 전직 먼저
    if (needBranchChoice()) { G.paused = true; closeMenu(resultEl); openBranchChoice(openStageSelect); return; }   // 2차 Lv 인데 갈래를 안 고름(예전 저장 포함) → 갈래 고르기 먼저(2026-11-08)
    if (needTier3Choice()) { G.paused = true; closeMenu(resultEl); openTier3(openStageSelect); return; }            // 3차 Lv 인데 전직 화면을 안 봄(예전 저장 포함, 2026-11-10)
    var list = document.getElementById('stageList'), cleared = loadCleared(), focus = null;
    focus = viewTabs();   // 방금 누른 스테이지 · 던전 탭에 초점
    var mf = modeTabs();   // 난이도 탭(2026-11-06): 방금 탭을 눌렀으면 그 탭에 초점
    focus = focus || mf;
    var tabbed = !!focus;
    list.innerHTML = '';
    list.classList.toggle('dglist', selView === 'dungeon');
    list.classList.toggle('many', selView !== 'dungeon' && STAGES.length > 10);   // 2026-11-09 판 20개: 10칸 x 2줄 작은 카드(css .slist.many)
    var ttl = document.getElementById('selTitle'); if (ttl) ttl.textContent = selView === 'dungeon' ? '던전 선택' : '스테이지 선택';
    if (selView === 'dungeon') ((CFG.dungeons && CFG.dungeons.order) || []).forEach(function (id) {
      var D = CFG.dungeons[id], open = dgOpen(id), best = Growth.dgBest(id), b = document.createElement('button');
      b.type = 'button'; b.className = 'sbtn dbtn dg-' + id + (open ? '' : ' locked') + (D.trial && !D.boss ? ' trial' : '');
      b.disabled = !open;
      if (D.color) b.style.setProperty('--dc', D.color);
      var won = D.trial && !D.boss ? '돌파' : '토벌';   // 얼음 동굴(2026-11-08) = 시련 웨이브 + 레이드 보스 = 토벌
      b.innerHTML = (D.tag ? '<em class="dtag">' + D.tag + '</em>' : '') + '<b>' + D.name + '</b><span>' + (open ? D.desc : D.lockHint || '잠김') + '</span>' +
        (open ? '<small>' + (D.rule === 'raid' ? (best && best.time ? '최고 · 클리어 ' + fmtTime(best.time) + ' · ' + won + ' ' + best.clears + '번' : best ? won + ' 기록 없음 · 처치 ' + best.kills : '기록 없음')
                                   : best ? '최고 · 처치 ' + best.kills + ' · 강화석 ' + best.stones : '기록 없음') + '</small>' : '');
      b.addEventListener('click', function () { closeMenu(selEl); G.paused = false; goDungeon(id); });
      list.appendChild(b);
      if (open && !tabbed && !focus) focus = b;
    });
    else STAGES.forEach(function (st, i) {
      var n = i + 1, b = document.createElement('button'), open = isOpen(n), done = !!cleared[st.id];
      b.type = 'button'; b.className = 'sbtn' + (open ? '' : ' locked') + (done ? ' cleared' : '');
      b.disabled = !open;
      b.innerHTML = '<b>' + st.id + '</b><span>' + (open ? st.name.replace(/^STAGE\s*\d+\s*/, '') : '잠김') + '</span>' + (done ? '<i>클리어</i>' : '');
      b.addEventListener('click', function () { closeMenu(selEl); G.paused = false; goStage(n); });
      list.appendChild(b);
      if (open && !tabbed && (n === G.stageNo || !focus)) focus = b;
    });
    modeTabFocus = false; viewTabFocus = false;
    encBadges();
    closeMenu(resultEl);
    G.paused = true;
    Input.setOverride(null);
    openMenu(selEl, focus);
  }
  // 난이도 탭(2026-11-06, config modes): 이지 / 노말 / 하드. 잠긴 난이도 = 자물쇠 + 「이지 10판 클리어 시 열림」(못 누름)
  //   누르면 그 난이도로 바꾸고(저장) 판 목록을 그 난이도의 깬 판으로 다시 그림. 돌려주는 값 = 방금 누른 탭(초점 줄 곳)
  // 스테이지 · 던전 탭(2026-11-07): 던전이 config 에 없으면 숨김. 돌려주는 값 = 방금 누른 탭(초점 줄 곳)
  function viewTabs() {
    var box = document.getElementById('viewTabs'), out = null, has = !!(CFG.dungeons && CFG.dungeons.order && CFG.dungeons.order.length);
    if (!box) return null;
    box.hidden = !has; box.innerHTML = '';
    if (!has) { selView = 'stage'; return null; }
    [['stage', '스테이지'], ['dungeon', '던전']].forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'vtab vt-' + v[0] + (v[0] === selView ? ' on' : '');
      b.setAttribute('aria-pressed', v[0] === selView ? 'true' : 'false');
      b.innerHTML = '<b>' + v[1] + '</b>';
      b.addEventListener('click', function () { if (selView === v[0]) return; selView = v[0]; viewTabFocus = true; openStageSelect(); });
      box.appendChild(b);
      if (viewTabFocus && v[0] === selView) out = b;
    });
    return out;
  }
  var modeTabFocus = false;
  // 2026-11-09 형님 「노말 하드 나누기보단 1~20 한 줄」: 고를 난이도가 하나면 탭 · 글자를 안 보임(modeTag = '' )
  function modeTag() { var VL = Growth.modeList ? Growth.modeList() : CFG.modes.order; return VL.length > 1 ? Growth.M().name + ' · ' : ''; }
  function modeTabs() {
    var box = document.getElementById('modeTabs'), O = CFG.modes, cur = Growth.mode(), out = null, last = CFG.modeUnlockId || STAGES[STAGES.length - 1].id;
    if (!box || !O) return null;
    box.innerHTML = '';
    var VL = Growth.modeList ? Growth.modeList() : O.order;   // 2026-11-07: 숨긴 난이도(이지) 빼고
    box.style.display = VL.length > 1 ? '' : 'none';   // 2026-11-09: 판 20개 한 줄(난이도 하나) = 탭 숨김
    VL.forEach(function (k, i) {
      var b = document.createElement('button'), open = Growth.modeOpen(k), M = O[k];
      b.type = 'button'; b.className = 'mtab mt-' + k + (k === cur ? ' on' : '') + (open ? '' : ' locked');
      b.disabled = !open;
      b.setAttribute('aria-pressed', k === cur ? 'true' : 'false');
      b.innerHTML = '<b>' + M.name + '</b>' + (open ? '' : '<small>' + O[VL[i - 1]].name + ' ' + last + '판 클리어 시 열림</small>');
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
    if (tools) tools.hidden = CFG.demo || (!CFG.stagesAllOpen && MODE !== 'practice');   // 친구 시험 모드 = 늘 숨김
    document.querySelectorAll('[data-char]').forEach(function (b) {
      b.addEventListener('click', function () { setChar(b.dataset.char); b.blur(); });
    });
    document.querySelectorAll('[data-class]').forEach(function (b) {
      b.addEventListener('click', function () { setClass(b.dataset.class); b.blur(); });
    });
  }
  // 지금 성별 + 직업 옷에 맞는 그림 묶음 이름 (기사 = knight_male / knight_female, 없으면 견습 옷)
  //   2차 옷(2026-11-07, config classes.<직업>.tier2): 레벨이 tier2.lv 이상이고 그 성별 그림이 있으면 그 옷(기사 Lv25 = 성기사 knight_t2_male, 2026-11-08 30 → 25)
  function outfitKey() {
    var c = CFG.classes && CFG.classes[G.classKey], A = CFG.art.characters;
    var k = c && c.outfit ? c.outfit + '_' + G.charKey : G.charKey;
    //   2차 전직 갈래(2026-11-08): 고른 갈래의 옷(Growth.tier2Info — 마검사 · 흑마법사 = 그림이 올 때까지 1차 옷 물들임, config addSkillArt)
    var t2 = c && c.tier2 ? (Growth.tier2Info ? Growth.tier2Info(G.classKey) : c.tier2) : null, k2 = t2 ? t2.outfit + '_' + G.charKey : null;
    //   3차 전직(2026-11-10, Growth.tier3Info): Lv50 뒤 그 갈래 3차 옷(검성 knight_t3_<성별> · 현자 mage_t3_<성별>), 그림이 없으면 2차 옷 그대로
    var t3 = c && c.tier2 && Growth.tier3Info ? Growth.tier3Info(G.classKey) : null, k3 = t3 && t3.on ? t3.outfit + '_' + G.charKey : null;
    if (k3 && A[k3]) return k3;
    if (k2 && A[k2] && window.Growth && Growth.lv >= t2.lv) return k2;
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
    if (typeof encBadges === 'function' && document.getElementById('encPanel')) encBadges();
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
    document.querySelectorAll('.statbtn:not(.skbtn):not(.encbtn) .badge, .statopen:not(.skopen):not(.encopen) .badge').forEach(function (b) { b.hidden = !n; b.textContent = n > 99 ? '99+' : n; });
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
  // 2026-11-07 고침: 강화 버튼(.statopen.encopen)도 여기 걸려 능력치 창이 같이 열렸음 → 기술 · 강화 버튼은 뺌
  document.querySelectorAll('.statopen:not(.skopen):not(.encopen)').forEach(function (b) { b.addEventListener('click', function () { openStats(); }); });
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
  // 칸 i 의 이름: PC 화면 = config keys.skillA~J 의 첫 키(Digit1 → 1), 폰 화면(touchui) = 1~5 (2026-11-07)
  function slotKey(i) {
    if (!isPc()) return String(i + 1);
    return keyLabel(CFG.keys['skill' + Skills.slots[i]]);
  }
  // 칸에 끼운 것의 이름(회피 = 「회피」, 2026-11-07)
  function slotName(S, id) { return id === 'dodge' ? '회피' : brNm(id) || (S[id] && S[id].name) || ''; }
  // 갈래 맛(2026-11-08, config skills.branchFx): 2차 갈래 뒤 바뀐 1차 기술 이름(없으면 null) · 늘 켜진 기술 추천 갈래 글
  function brNm(id) { var b = Growth.brSkill ? Growth.brSkill(G.classKey, id) : null; return b ? b.name : null; }
  function recE(e) {
    var bk = Growth.book(G.classKey), r = e && e.rec && bk && bk.rec ? bk.rec(e.id) : null;
    if (!r || !r.on || !e.passive || !e.passive.val) return e;
    var P = {}, k; for (k in e.passive) P[k] = e.passive[k];
    P.val = e.passive.val.map(function (v) { return e.recInv ? Math.round(v / r.k) : Math.round(v * r.k * 1000) / 1000; });
    var o = {}; for (k in e) o[k] = e[k]; o.passive = P; return o;
  }
  function recTxt(bk, e) { var r = bk && bk.rec ? bk.rec(e.id) : null; return r ? r.name + ' 추천' + (r.on ? ' · 효과 +' + Math.round((r.k - 1) * 100) + '% 적용 중' : '') : ''; }
  function skillBadges() {
    var bk = Growth.book(G.classKey), n = bk ? bk.pts() : 0;
    if (bk && bk.novice) bk = null;   // 견습 기본기 책(2026-11-07)은 기술 창 없음
    document.querySelectorAll('.skbtn, .skopen').forEach(function (b) { b.hidden = !bk; });
    document.querySelectorAll('.skbtn .badge, .skopen .badge').forEach(function (b) { b.hidden = !n; b.textContent = n > 99 ? '99+' : n; });
  }
  function secTxt(ms) { var s = Math.round(ms / 100) / 10; return (s % 1 ? s.toFixed(1) : s) + '초'; }
  function pctTxt(v) { return Math.round(v * 100) + '%'; }
  // 기술 숫자(칸에 손을 올리면 보이는 글): 쓰는 기술 = 마나·쿨타임·위력(+ 다음 Lv), 늘 켜진 기술 = 지금 값(+ 다음 Lv)
  function skillNums(bk, e, d, lv) {
    var max = bk.maxLv ? bk.maxLv(e.id) : CFG.skills.maxLv || 5, show = Math.max(1, lv);
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
    e = recE(e);   // 추천 갈래면 값 +25%(2026-11-08, 실제로 쓰는 값과 같게)
    var P = e.passive, v = pctTxt(P.val[Math.max(1, lv) - 1]);
    if (P.stat === 'shield') return '피해의 ' + v + ' 마나로';
    if (P.stat === 'shards') return '파편 피해 ' + v + ' · 반경 ' + (P.r ? P.r[Math.max(1, lv) - 1] : 0);   // 칼날 파편(2026-11-08)
    if (P.stat === 'pull') return '3타 검압 반경 ' + P.val[Math.max(1, lv) - 1];                               // 끌어당기는 검압(2026-11-08)
    if (P.stat === 'eshard') return '조각 피해 ' + v + ' · ' + P.n[Math.max(1, lv) - 1] + '마리 · 반경 ' + P.r[Math.max(1, lv) - 1];   // 원소 파편(법사, 2026-11-08)
    if (P.stat === 'vortex') return (P.val[Math.max(1, lv) - 1] / 1000) + '초마다 · 피해 ' + pctTxt(P.mul[Math.max(1, lv) - 1]) + ' · 반경 ' + P.r[Math.max(1, lv) - 1];   // 마력 소용돌이(2026-11-08)
    if (P.stat === 'echain') return '터짐 피해 ' + v + ' · 반경 ' + P.r[Math.max(1, lv) - 1];   // 원소 연쇄(대마법사, 2026-11-08)
    if (P.stat === 'nimble') return '회피 ' + (P.charges ? P.charges[Math.max(1, lv) - 1] : 2) + '번 연달아 · 쿨타임 ' + secTxt(CFG.move.dodge.cdMs) + ' → ' + secTxt(P.val[Math.max(1, lv) - 1]) + ' · 거리 +' + pctTxt(P.dist[Math.max(1, lv) - 1]);   // 날렵한 몸놀림(2026-11-08)
    if (P.stat === 'arcane') return '평타 마법 피해 +' + v + ' · 터짐 확률 ' + pctTxt(P.chance[Math.max(1, lv) - 1]);   // 마력 부여(마검사, 2026-11-08)
    if (P.stat === 'leech') return '마법 피해의 ' + (Math.round(P.val[Math.max(1, lv) - 1] * 1000) / 10) + '% 흡수 · 1초에 최대 체력 ' + (Math.round(P.capS[Math.max(1, lv) - 1] * 1000) / 10) + '%까지';   // 생명 흡수(흑마법사, 2026-11-08)
    // 궁수(2026-11-09): 집중 · 갈래 화살 · 자동 연사 · 사냥꾼의 표식 · 필중 · 매 동료
    var li = Math.max(1, lv) - 1;
    if (P.stat === 'acrit') return '치명타 확률 +' + v + ' · 치명타 배율 +' + pctTxt(P.critDmg[li]);
    if (P.stat === 'split') return '작은 화살 ' + P.n[li] + '발 · 피해 ' + v + ' · 반경 ' + P.r[li];
    if (P.stat === 'volley') return (Math.round(P.val[li] / 100) / 10) + '초마다 빛 화살 ' + P.n[li] + '발 · 피해 ' + pctTxt(P.mul[li]);
    if (P.stat === 'amark') return '표식 찍힌 적 피해 +' + v + ' · ' + secTxt(P.ms || 5000);
    if (P.stat === 'deadeye') return '치명타 배율 +' + v + ' · 치명타 확률 +' + pctTxt(P.chance[li]);
    if (P.stat === 'hawk') return (Math.round(P.val[li] / 100) / 10) + '초마다 매가 내리꽂힘 · 피해 ' + pctTxt(P.mul[li]);
    // 암살자(2026-11-09): 급소 노리기 · 잔영 베기 · 떠도는 단검 · 독 바르기 · 처형 · 그림자 동행 · 역병 전염
    if (P.stat === 'akeen') return '치명타 확률 +' + v + ' · 치명타 배율 +' + pctTxt(P.critDmg[li]);
    if (P.stat === 'aecho') return '확률 ' + pctTxt(P.chance[li]) + ' · 잔상 피해 ' + v;
    if (P.stat === 'aorbit') return (Math.round(P.val[li] / 100) / 10) + '초마다 유령 단검 ' + P.n[li] + '자루 · 피해 ' + pctTxt(P.mul[li]);
    if (P.stat === 'avenom') return '맞히면 ' + v + ' 확률로 독 1겹';
    if (P.stat === 'aexec') return '체력 ' + pctTxt(P.below || 0.3) + ' 밑 적 피해 +' + v;
    if (P.stat === 'sshade') return (Math.round(P.val[li] / 100) / 10) + '초마다 그림자가 벰 · 피해 ' + pctTxt(P.mul[li]);
    if (P.stat === 'pplague') return '터짐 피해 ' + v + ' · 독 ' + pctTxt(P.spread[li]) + ' 옮김 · 반경 ' + P.r[li];
    if (P.stat === 'regen') return '초당 체력 +' + (Math.round(P.val[Math.max(1, lv) - 1] * 1000) / 10) + '%';   // 신성 가호(2026-11-08): 최대 체력의 0.4~0.8%
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
    if (!bk || bk.novice) { if (!skEl.hidden) closeSkills(); return; }
    var focusK = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.sk : null;
    var pc = isPc(), max = CFG.skills.maxLv || 5, S = CFG.skills[bk.cls], pts = bk.pts(), slots = bk.slots(pc), bar = bk.bar(pc);
    if (skSel && !bk.canPut(skSel)) skSel = null;
    if (skSel === 'dodge' && !pc) skSel = null;
    document.getElementById('skPts').textContent = pts;
    document.getElementById('skSum').textContent = 'Lv ' + Growth.lv + ' · ' + ((CFG.classes[G.classKey] || {}).label || '') +
      (bk.test ? ' · 시험 기술(저장 안 함)' : '');
    // 책 두 쪽: 쓰는 기술(왼쪽) · 늘 켜진 기술(오른쪽)
    var actEl = document.getElementById('skAct'), pasEl = document.getElementById('skPas');
    actEl.innerHTML = ''; pasEl.innerHTML = '';
    bk.list().forEach(function (e) {
      // 2026-11-07 배우기: open = 그 Lv 가 됨, learned = 배움. 열렸는데 안 배움 = 'learn'(회색 그림 + 「배울 수 있음」, + 로 1점 써서 배움)
      var d = S[e.id] && S[e.id].name ? S[e.id] : null, open = bk.unlocked(e.id), lv = bk.lv(e.id), learned = lv > 0, canPick = bk.isActive(e.id) && learned;
      var name = brNm(e.id) || (d ? d.name : e.name), st = e.soon ? 'soon' : !open ? 'lock' : !learned ? 'learn' : '', at = bar.indexOf(e.id), max = bk.maxLv(e.id);   // 기술마다 최고 Lv(2026-11-08)
      var c = document.createElement('div');
      c.className = 'cell' + (st ? ' ' + st : '') + (skSel === e.id ? ' sel' : '');
      var info = !st || st === 'learn';
      c.title = name + ' — ' + ((d ? d.desc : e.desc) || '') + (info ? '\n' + skillNums(bk, e, d, lv) : '') +
        (d && d.lv5 && d.lv5.say && info ? '\nLv5: ' + d.lv5.say : '') + (st === 'learn' ? '\n기술 점수 1점으로 배워요' : '') +
        (st === 'lock' && e.tier === 2 ? '\n2차 전직(' + t2Name(bk.cls, e) + ') 후 Lv' + bk.openLv(e.id) + '에 배울 수 있어요' : '') +
        (st === 'lock' && e.tier === 3 ? '\n3차 전직(' + t3Name(bk) + ') 후 Lv' + bk.openLv(e.id) + '에 배울 수 있어요' : '') +
        (bk.brSkill && bk.brSkill(e.id) ? '\n갈래 덤: ' + bk.brSkill(e.id).twist : '') + (recTxt(bk, e) ? '\n' + recTxt(bk, e) : '');
      // 그림 + 이름 · Lv · 짧은 설명 = 버튼(2026-11-08): 누르면 설명 · 미리보기 창(openDetail). 칸에 끼우기는 그 창의 「칸에 끼우기」
      var pick = document.createElement('button');
      pick.className = 'cpick'; pick.type = 'button'; pick.dataset.sk = e.id + ':info'; pick.setAttribute('aria-label', name + ' 설명 · 미리보기');
      pick.appendChild(skIcon(e.id, 40, !!st));
      // 2차 기술(2026-11-08, tier 2): 2차 전직 전 = 자물쇠 「2차 LvN」 + 짧은 설명 자리에 「2차 전직 후 LvN에 열려요」(이름이 안 잘리게 나눔),
      //   전직 뒤 = 그냥 「LvN」(N = bk.openLv)
      var t2Lock = st === 'lock' && e.tier === 2 && !bk.tier2(), t3Lock = st === 'lock' && e.tier === 3 && !(bk.tier3 && bk.tier3());   // 3차(2026-11-10)
      var tag = st === 'soon' ? '<span class="tag">준비 중</span>' : st === 'lock' ? '<span class="tag lk' + (t2Lock || t3Lock ? ' t2' : '') + '">' + (t2Lock ? '2차 ' : t3Lock ? '3차 ' : '') + 'Lv' + bk.openLv(e.id) + '</span>' :
        st === 'learn' ? '<span class="tag ln">배울 수 있음</span>' : '<span class="lvl">Lv ' + lv + '/' + max + '</span>';
      var line = !st && e.passive && e.passive.val ? passiveNow(e, lv) : t2Lock ? (e.branch ? t2Name(bk.cls, e) + ' 전직 후 Lv' : '2차 전직 후 Lv') + bk.openLv(e.id) + '에 열려요' :
        t3Lock ? t3Name(bk) + ' 전직 후 Lv' + bk.openLv(e.id) + '에 열려요' : (e.short || '');
      pick.insertAdjacentHTML('beforeend', '<span class="nm"><span class="l1"><b>' + name + '</b>' + tag + '</span><span class="sd">' + line + '</span></span>');
      c.appendChild(pick);
      var plus = document.createElement('button');
      plus.type = 'button'; plus.className = 'plus' + (lv >= max ? ' max' : ''); plus.dataset.sk = e.id + ':+';
      plus.setAttribute('aria-label', name + (st === 'learn' ? ' 배우기' : ' 올리기')); plus.textContent = lv >= max ? 'MAX' : '+';
      plus.disabled = !(pts > 0 && open && lv < max);
      c.appendChild(plus);
      if (at >= 0) c.insertAdjacentHTML('beforeend', '<span class="eq">' + slotKey(at) + '</span>');   // 끼운 칸 번호
      (e.passive ? pasEl : actEl).appendChild(c);
    });
    // PC(2026-11-07): 쓰는 기술 맨 끝에 「회피」 — 칸에 끼우면 그 칸 키로도 회피(Shift 는 늘 회피). 점수로 안 올림
    if (pc) {
      var dc = document.createElement('div'), dp = document.createElement('button'), dat = bar.indexOf('dodge');
      dc.className = 'cell dodgecell' + (skSel === 'dodge' ? ' sel' : '');
      dc.title = '회피 — 구르며 잠깐 무적. ' + Keys.lab('dodge') + ' 로 늘 쓸 수 있고, 칸에 끼우면 그 칸 키로도 써요';
      dp.type = 'button'; dp.className = 'cpick'; dp.dataset.sk = 'dodge:pick'; dp.setAttribute('aria-label', '회피 고르기');
      dp.appendChild(skIcon('dodge', 40));
      dp.insertAdjacentHTML('beforeend', '<span class="nm"><span class="l1"><b>회피</b><span class="lvl">' + Keys.lab('dodge') + '</span></span><span class="sd">칸에 끼우면 그 키로도 회피</span></span>');
      dc.appendChild(dp);
      dc.insertAdjacentHTML('beforeend', '<span class="plusph"></span>' + (dat >= 0 ? '<span class="eq">' + slotKey(dat) + '</span>' : ''));
      actEl.appendChild(dc);
    }
    // 아래 띠: 기술 칸(열린 칸 = 누를 수 있음, 잠긴 칸 = 자물쇠 + 열리는 Lv) + 도움말
    // PC(2026-11-07) = 10칸 두 줄(위 6~0 · 아래 1~5, 아래 막대와 같은 순서), 폰 = 7칸 한 줄(2026-11-08)
    var bEl = document.getElementById('skBar'), nAll = bk.maxSlots(pc), gEl = document.createElement('div');
    bEl.innerHTML = '<b class="bl">기술 칸</b>';
    gEl.className = 'bgrid'; bEl.appendChild(gEl);
    slotOrder(nAll, pc).forEach(function (i) {
      var id = bk.at(i), locked = i >= slots, b = document.createElement('button');
      b.type = 'button'; b.dataset.sk = ':s' + i; b.disabled = locked;
      b.className = 'bslot' + (locked ? ' locked' : !id ? ' empty' : '') + (skSel && !locked ? ' tgt' : '') + (id && id === skSel ? ' cur' : '');
      b.setAttribute('aria-label', (i + 1) + '번 칸' + (id ? ' ' + slotName(S, id) : ''));
      b.innerHTML = '<kbd>' + slotKey(i) + '</kbd>';
      if (id) b.appendChild(skIcon(id, 32));
      else b.insertAdjacentHTML('beforeend', '<i class="bph"></i>');
      b.insertAdjacentHTML('beforeend', '<small>' + (id ? slotName(S, id) : locked ? 'Lv' + bk.slotLv(i) : '빈 칸') + '</small>');
      gEl.appendChild(b);
    });
    var sd = skSel && S[skSel], sL = sd && Skills.lvStat(sd, bk.lv(skSel));
    bEl.insertAdjacentHTML('beforeend', '<span class="hint">' + (sd ? '<b>' + (brNm(skSel) || sd.name) + '</b> MP ' + sL.mp + ' · 쿨타임 ' + secTxt(sL.cd) :
      skSel === 'dodge' ? '<b>회피</b> 연속 ' + G.player.dodgeStats().n + '번 · 쿨타임 ' + secTxt(G.player.dodgeStats().cd) : '기술을 누르면 설명 · 미리보기') + '<br><em>' + (skSel ? '칸을 누르면 끼워져요' : '「칸에 끼우기」 → 칸을 누름') + '</em></span>');
    skEl.querySelectorAll('.spread button[data-sk], .skbar button[data-sk]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.dataset.sk.split(':'), bk2 = Growth.book(G.classKey);
        if (!bk2) return;
        if (a[1] === 'info') { openDetail(a[0]); return; }   // 설명 · 미리보기 창(2026-11-08)
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
    var bk0 = Growth.book(G.classKey);
    if (!skEl.hidden || !bk0 || bk0.novice) return;
    skBack = { menu: menuEl && !menuEl.hidden ? menuEl : null, paused: G.paused };
    G.paused = true; Input.setOverride(null);
    skSel = null;
    renderSkills();
    openMenu(skEl, skEl.querySelector('.plus:not([disabled])') || document.getElementById('btnSkClose'));
  }
  function closeSkills() {
    closeDetail(false);   // 설명 · 미리보기 창이 떠 있으면 같이 닫음(2026-11-08)
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
  window.addEventListener('keydown', function (e) {
    if (e.code !== 'Escape' || skEl.hidden) return;
    e.preventDefault();
    if (detEl && !detEl.hidden) closeDetail(true); else closeSkills();   // 설명 · 미리보기 창 → 기술 창으로
  });
  G.openSkills = openSkills; G.closeSkills = closeSkills;

  // ---------- 기술 설명 · 미리보기 창 (2026-11-08, 형님 요청) ----------
  // 기술 창에서 기술(쓰는 기술 · 늘 켜진 기술, 1차 · 2차, 잠긴 것도)을 누르면 기술 창 위에 뜸. 진짜 게임은 뒤에서 그대로 멈춤
  //   왼쪽 = 그림 · 이름 · 갈래(쓰는 기술 / 늘 켜진 기술 · 1차 / 2차) · 쉬운 설명 · 지금 Lv 숫자(마나 · 쿨타임 · 위력) · 다음 Lv 에 좋아지는 것 · Lv5 덤 · 잠김(열리는 Lv)
  //   오른쪽 = 미리보기 액자. 「▶ 미리보기」 = 이 게임을 작은 액자(iframe) 안에 ?pv=기술 로 한 번 더 띄움(main.js pvBoot):
  //     지금 옷(2차 기술이면 2차 옷) · 진짜 기술 코드 · 효과 · 숫자 그대로 고블린 허수아비 앞에서 되풀이. 다른 창이라 진짜 게임 · 저장과 안 섞임
  //   칸에 끼우기(배운 쓰는 기술만) = 예전 「기술을 고르고 → 칸을 누름」의 고르기. 닫기 · X · Esc · 패드 B = 기술 창으로
  var detEl = document.getElementById('skDetail'), detId = null, pvFrame = null, pvWait = 0;
  var pvBoxEl = document.getElementById('pvBox'), pvPhEl = document.getElementById('pvPh'), pvBtn = document.getElementById('btnPv');
  // 늘 켜진 기술 미리보기에서 무엇을 보여 주나(액자 밑 한 줄)
  var PV_CAP = {
    phys: '평타로 고블린을 때려요 — 눈에 띄는 효과 없이 숫자가 커져요', magic: '평타로 고블린을 때려요 — 눈에 띄는 효과 없이 숫자가 커져요',
    guard: '고블린이 때려요 — 받는 피해 숫자가 작아져요', mpRegen: '마나가 더 빨리 차요 — 눈에 띄는 효과는 없어요',
    shards: '평타로 쓰러뜨리면 그 자리에서 칼날 파편이 튀어요', pull: '평타 3타째에 둘레 고블린이 앞으로 끌려와요',
    grit: '체력을 일부러 25%로 낮춰서 보여 줘요(발밑 붉은 기운)', counter: '고블린이 때리면 확률로 되받아 베요',
    regen: '몸 둘레 금빛 기운 · 체력이 천천히 차요', eshard: '마법이 맞으면 불 · 얼음 조각이 둘레 고블린에게 튀어요',
    vortex: '둘레 고블린 가운데에 마력 소용돌이가 저절로 생겨요', shield: '고블린이 때리면 마나가 피해 일부를 대신 받아요(파란 방패)',
    brand: '화염구로 낙인을 찍은 뒤 평타 — 낙인 찍힌 적은 더 아파요', nimble: '회피를 두 번씩 좌우로 되풀이해요 — 더 멀리 · 더 자주 빠져요', echain: '마법으로 쓰러뜨리면 그 자리에서 터져 둘레를 때려요',
    arcane: '평타에 보라 마력이 실려요 — 가끔 칼끝에서 작은 마력이 터져요',
    acrit: '평타 화살로 고블린을 맞혀요 — 치명타(큰 주황 숫자)가 더 자주 나요', split: '평타 화살이 맞으면 작은 화살이 둘레 고블린에게 튀어요',
    volley: '몇 초마다 빛 화살이 저절로 날아가 꽂혀요', amark: '기술을 맞힌 고블린 머리 위에 과녁이 찍혀요 — 더 아파요',
    deadeye: '치명타가 터지면 숫자가 훨씬 커져요', hawk: '매가 따라다니다가 고블린에게 내리꽂혀요',
    akeen: '평타로 고블린을 베요 — 치명타(큰 주황 숫자)가 더 자주 나요', aecho: '평타가 맞으면 붉은 잔상이 한 번 더 베어요', aorbit: '몇 초마다 유령 단검이 저절로 날아가 꽂혀요',
    avenom: '평타가 맞으면 가끔 독(초록 거품)이 묻어요', aexec: '체력이 적은 고블린 머리 위에 붉은 해골 — 더 아프게 맞아요', sshade: '그림자가 따라다니다가 고블린에게 뛰어들어 베어요',
    pplague: '독 걸린 고블린이 쓰러지면 독구름으로 터져 둘레에 독이 퍼져요', leech: '체력을 일부러 50%로 낮춰서 보여 줘요 — 마법을 맞히면 붉은 기운이 빨려 들며 체력이 차요'
  };
  // 2차 이름: 갈래 기술(e.branch)이면 그 갈래 이름(성기사 · 마검사 …), 아니면 지금 갈래 이름(2차 전 = 「성기사 / 마검사」) — 2026-11-08 갈래
  function t2Name(cls, e) {
    var bk = Growth.book(cls), bn = e && e.branch && bk && bk.branchName ? bk.branchName(e.id) : null;
    if (bn) return bn;
    var I = Growth.tier2Info ? Growth.tier2Info(cls) : ((CFG.classes[cls] || {}).tier2 || null);
    return (I && I.name) || '2차';
  }
  // 3차 이름(2026-11-10): 지금 갈래의 3차(검성 · 현자 …), 없으면 「3차」
  function t3Name(bk) { var I = bk && bk.tier3Info ? bk.tier3Info() : null; return (I && I.name) || '3차'; }
  function detRow(k, v, cls) { return '<div class="sdrow' + (cls ? ' ' + cls : '') + '"><b>' + k + '</b><span>' + v + '</span></div>'; }
  function arrow(a, b) { return a === b ? a : a + ' → <em>' + b + '</em>'; }
  function renderDetail() {
    var bk = Growth.book(G.classKey), e = bk && bk.entry(detId);
    if (!e) return;
    var S = CFG.skills[bk.cls], d = S[e.id] && S[e.id].name ? S[e.id] : null, max = bk.maxLv(e.id);   // 기술마다 최고 Lv(2026-11-08)
    var BS = bk.brSkill ? bk.brSkill(e.id) : null, RC = bk.rec ? bk.rec(e.id) : null;   // 갈래 맛 · 추천 갈래(2026-11-08)
    var name = BS ? BS.name : d ? d.name : e.name, lv = bk.lv(e.id), open = bk.unlocked(e.id), show = Math.max(1, lv);
    var st = e.soon ? 'soon' : !open ? 'lock' : lv > 0 ? '' : 'learn', basic = CFG.skills.basic && CFG.skills.basic[bk.cls] === e.id;
    document.getElementById('sdRib').textContent = e.passive ? '늘 켜진 기술' : '쓰는 기술';
    var ic = document.getElementById('sdIcon'); ic.innerHTML = ''; ic.appendChild(skIcon(e.id, 56, !!st && st !== 'learn'));
    document.getElementById('sdName').textContent = name;
    var tags = '<i class="tg ' + (e.passive ? 'pas' : 'act') + '">' + (e.passive ? '늘 켜진 기술' : '쓰는 기술') + '</i>' +
      '<i class="tg' + (e.tier >= 2 ? ' t2' : '') + '">' + (e.tier === 3 ? '3차 · ' + t3Name(bk) : e.tier === 2 ? '2차 · ' + t2Name(bk.cls, e) : '1차 · ' + ((CFG.classes[bk.cls] || {}).label || '')) + '</i>' +
      (basic ? '<i class="tg">기본기</i>' : '') +
      (BS ? '<i class="tg t2">' + t2Name(bk.cls, null) + ' · ' + BS.tag + '</i>' : '') + (RC ? '<i class="tg' + (RC.on ? ' t2' : '') + '">' + RC.name + ' 추천</i>' : '') +
      (st === 'lock' ? '<i class="tg lk">잠김</i>' : st === 'learn' ? '<i class="tg ln">배울 수 있음</i>' : st === 'soon' ? '<i class="tg lk">준비 중</i>' : '<i class="tg lv">Lv ' + lv + '/' + max + '</i>');
    document.getElementById('sdTags').innerHTML = tags;
    document.getElementById('sdDesc').textContent = (d ? d.desc : e.desc) || e.short || '';
    // 숫자: 지금 Lv(안 배웠으면 Lv1 기준) · 다음 Lv · Lv5 덤 · 여는 법
    var h = '', now = lv > 0 ? '지금 Lv' + lv : 'Lv1 기준';
    if (BS) h += detRow('갈래 덤', BS.twist + (d ? ' <small>(원래 이름 ' + d.name + ')</small>' : ''), 'l5');
    if (RC) h += detRow(RC.name + ' 추천', RC.on ? '지금 ' + RC.name + ' → 효과 +' + Math.round((RC.k - 1) * 100) + '% 적용 중' : RC.name + '를 고르면 효과 +' + Math.round((RC.k - 1) * 100) + '%', RC.on ? 'l5' : '');
    if (d) {
      var L = Skills.lvStat(d, show), N = show < max ? Skills.lvStat(d, show + 1) : null;
      h += detRow(now, '마나 ' + L.mp + ' · 쿨타임 ' + secTxt(L.cd) + ' · 위력 ' + pctTxt(L.dmg));
      if (N) h += detRow('Lv' + (show + 1) + ' 되면', '마나 ' + arrow(L.mp, N.mp) + ' · 쿨타임 ' + arrow(secTxt(L.cd), secTxt(N.cd)) + ' · 위력 ' + arrow(pctTxt(L.dmg), pctTxt(N.dmg)) +
        (show + 1 === max && d.lv5 && d.lv5.say ? ' · <em>' + d.lv5.say + '</em>' : ''), 'nx');
      else h += detRow('최고 Lv', '더 올릴 수 없어요', 'nx');
      if (d.lv5 && d.lv5.say) h += detRow('Lv5 덤', d.lv5.say, 'l5');
    } else if (e.passive && e.passive.val) {
      h += detRow(now, passiveNow(e, show));
      if (show < max) h += detRow('Lv' + (show + 1) + ' 되면', '<em>' + passiveNow(e, show + 1) + '</em>', 'nx');
      else h += detRow('최고 Lv', '더 올릴 수 없어요', 'nx');
    }
    if (st === 'lock') h += detRow('여는 법', e.tier === 2 && !bk.tier2() ? '2차 전직(' + t2Name(bk.cls, e) + ', Lv' + bk.tier2Lv() + ') 뒤 Lv' + bk.openLv(e.id) + '에 배울 수 있어요' :
      e.tier === 3 && !(bk.tier3 && bk.tier3()) ? '3차 전직(' + t3Name(bk) + ', Lv' + bk.tier3Lv() + ') 뒤 Lv' + bk.openLv(e.id) + '에 배울 수 있어요' : 'Lv' + bk.openLv(e.id) + '에 배울 수 있어요', 'lk');
    else if (st === 'learn') h += detRow('배우기', '기술 점수 1점으로 배워요(기술 창의 초록 +)', 'ln');
    document.getElementById('sdNums').innerHTML = h;
    var put = document.getElementById('btnSdPut');
    put.hidden = !(bk.isActive(e.id) && lv > 0);
    document.getElementById('pvCap').textContent = (e.passive ? PV_CAP[e.passive.stat] || '평타로 고블린을 때리며 보여 줘요' : '고블린 허수아비에게 저절로 되풀이해요') +
      (lv > 0 ? ' (Lv' + lv + ')' : ' (Lv1)') + ' · 진짜 게임엔 영향 없어요';
    var pi = document.getElementById('pvPhIc'); pi.innerHTML = ''; pi.appendChild(skIcon(e.id, 40));
  }
  function openDetail(id) {
    var bk = Growth.book(G.classKey);
    if (!bk || !bk.entry(id) || bk.entry(id).soon) return;
    pvStop();
    detId = id;
    renderDetail();
    openMenu(detEl, pvBtn);
  }
  // back = 기술 창으로 돌아감(그 기술 칸에 초점). 기술 창째 닫을 때는 false
  function closeDetail(back) {
    if (!detEl || detEl.hidden) return;
    pvStop();
    closeMenu(detEl);
    var id = detId; detId = null;
    if (back && !skEl.hidden) openMenu(skEl, skEl.querySelector('button[data-sk="' + id + ':info"]') || document.getElementById('btnSkClose'));
  }
  // 미리보기 켜기: 액자를 새로 만듦(기술 · 직업 · 성별 · 기술 Lv · 레벨을 주소로 넘김). 액자가 준비되면(pv ready 알림) 덮개를 걷음
  function pvStart() {
    var bk = Growth.book(G.classKey), e = bk && bk.entry(detId);
    if (!e) return;
    pvStop();
    var q = new URLSearchParams();
    q.set('pv', e.id); q.set('pvc', bk.cls); q.set('pvg', G.charKey); q.set('pvl', Math.max(1, bk.lv(e.id)));
    if (e.passive && e.passive.stat === 'brand') q.set('pvh', 'fireball');   // 원소 낙인 = 기술 마법에 맞아야 → 도우미 화염구
    var pvBr = e.branch || (bk.branch ? bk.branch() : null);   // 2차 갈래(2026-11-08): 그 갈래 옷(마검사 · 흑마법사 = 물들인 1차 옷)으로 보여 줌
    if (pvBr) q.set('branch', pvBr);
    // 레벨: 2차 기술인데 아직 2차 Lv 전이면 2차 Lv 로(2차 옷), 아니면 지금 창의 시험 레벨(?lv=) 그대로 · 없으면 저장된 레벨(액자가 저장을 읽기만 함)
    var need = e.tier === 2 ? bk.tier2Lv() : e.tier === 3 ? Math.max(bk.tier3Lv(), bk.openLv(e.id)) : 0, lvq = params.get('lv');
    if (e.tier === 3 || (bk.tier3 && bk.tier3())) q.set('t3', '1');   // 3차(2026-11-10): 액자도 3차 옷 · 3차 맛
    if (need && Growth.lv < need) q.set('lv', need); else if (lvq) q.set('lv', Math.max(+lvq || 1, Growth.lv));   // 2026-11-08: 시험 중 레벨업한 만큼(Lv24 → 25 갈래 옷)
    ['rs', 'art'].forEach(function (k) { if (params.get(k)) q.set(k, params.get(k)); });
    var f = pvFrame = document.createElement('iframe');
    f.className = 'pvframe'; f.title = '기술 미리보기'; f.setAttribute('tabindex', '-1'); f.setAttribute('aria-hidden', 'true');
    f.src = location.pathname + '?' + q.toString();
    pvBoxEl.appendChild(f);
    pvBoxEl.classList.add('on', 'wait');
    document.getElementById('pvPhTxt').textContent = '불러오는 중…';
    clearTimeout(pvWait); pvWait = setTimeout(function () { pvBoxEl.classList.remove('wait'); }, 10000);
    pvBtn.textContent = '■ 멈추기';
  }
  function pvStop() {
    clearTimeout(pvWait);
    if (pvFrame) { try { pvFrame.src = 'about:blank'; } catch (e) {} pvFrame.remove(); pvFrame = null; }
    pvBoxEl.classList.remove('on', 'wait');
    document.getElementById('pvPhTxt').textContent = '▶ 미리보기를 누르면 움직여요';
    pvBtn.textContent = '▶ 미리보기';
  }
  window.addEventListener('message', function (ev) {
    if (!pvFrame || ev.source !== pvFrame.contentWindow || !ev.data || ev.data.pv !== 'ready') return;
    clearTimeout(pvWait); pvBoxEl.classList.remove('wait');
  });
  pvBtn.addEventListener('click', function () { if (pvFrame) pvStop(); else pvStart(); });
  document.getElementById('btnSdPut').addEventListener('click', function () {
    var id = detId;
    closeDetail(false);
    skSel = id; renderSkills();
    openMenu(skEl, skEl.querySelector('.bslot:not([disabled])') || document.getElementById('btnSkClose'));   // 칸 고르기로 바로(패드 · 키보드)
  });
  document.getElementById('btnSdClose').addEventListener('click', function () { closeDetail(true); });
  document.getElementById('btnSdX').addEventListener('click', function () { closeDetail(true); });
  G.openDetail = openDetail; G.closeDetail = closeDetail; G.pvStart = pvStart;   // 시험용


  // ---------- 강화 창 (2026-11-06, 형님 승인. 수치 = config enchant, 계산·저장 = growth.js Growth.weapon) ----------
  // 여는 곳: 「기술」 옆 「강화」 · 스테이지 고르기 · 결과 화면(견습은 버튼이 안 보임). 여는 동안 게임 멈춤, 닫으면 원래대로
  //   왼쪽 = 무기 그림(강화 단계 그림 + 속성 오라, 움직임) · +강화 · 등급 이름 · 성공 확률 · 드는 강화석 · 「강화」(성공 = 금빛 번쩍 / 실패 = 흔들림)
  //   오른쪽 = 강화 덤(가진 것 밝게) · 속성 칸 3개(+3 · +6 · +9 에 열림) · 가진 결정. 칸을 누르면 → 속성 7가지(결정 수 · 한 줄 설명) → 「부여」(결정 = 칸마다 config enchant.setCost, 2026-11-07 5 · 10 · 20개)
  var encEl = document.getElementById('encPanel'), encBack = null, encSlot = -1, encPickEl = null, encRaf = 0, encFxT = 0;
  var BON_TXT = { crit: '치명타 확률', atkSpd: '공격 속도', cd: '기술 쿨타임', mp: '기술 마나', reach: '공격 범위', mpRegen: '마나 회복', castSpd: '시전 속도', area: '마법 범위' };
  function bonTxt(v) {
    return Object.keys(v).map(function (k) { return BON_TXT[k] + ' ' + (k === 'cd' || k === 'mp' ? '-' : '+') + Math.round(v[k] * 100) + '%'; }).join(' · ');
  }
  function encBadges() {
    var w = wpn(), n = w && !w.test && w.canEnhance() ? Growth.stones : 0;
    document.querySelectorAll('.encbtn, .encopen').forEach(function (b) { b.hidden = !w; });
    document.querySelectorAll('.encbtn .badge, .encopen .badge').forEach(function (b) { b.hidden = !n; b.textContent = n > 99 ? '99+' : n; });
  }
  // 무기 그림 + 오라를 창 그림판에(여는 동안 계속)
  function encDraw() {
    var cv = document.getElementById('encCv'), g = cv.getContext('2d'), w = wpn(), ak = w && w.art(artLoaded);
    var img = ak && G.assets.weapons[ak], D = ak && CFG.art.weapons[ak];
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    var grow = celeDraw(g, cv);
    if (img && D) {
      var k = img._k || 1, dw = img.width * k, Z = cv.width * 0.74 / dw * grow, ang = -0.22;
      g.imageSmoothingEnabled = !!img._hd;
      var gx = D.grip.x * k, cx = cv.width / 2, cy = cv.height / 2 + 6;
      // 무기 가운데가 그림판 가운데 오게: 손잡이 점 기준으로 돌림
      g.setTransform(Z, 0, 0, Z, 0, 0);
      g.translate(cx / Z - (dw / 2 - gx) * Math.cos(ang), cy / Z - (dw / 2 - gx) * Math.sin(ang));
      g.rotate(ang);
      var els = w.els(), pw = els.length ? 0.7 : 1;
      if (D.mythic) Enchant.mythic(g, D, img, ang, 'back', pw);
      if (els.length) Enchant.aura(g, D, img, els, ang, 'back');
      Assets.blit(g, img, D.grip.x, D.grip.y);
      if (D.mythic) Enchant.mythic(g, D, img, ang, 'front', pw);
      if (els.length) Enchant.aura(g, D, img, els, ang, 'front');
    }
    if (!encEl.hidden) encRaf = requestAnimationFrame(encDraw);
  }
  function renderEnc() {
    var w = wpn(); if (!w) return;
    var lv = w.lv(), cls = G.classKey, D = CFG.art.weapons[w.art(artLoaded)] || {};
    document.getElementById('encStones').textContent = w.test ? '∞' : Growth.stones;
    document.getElementById('encWho').textContent = (CFG.classes[cls] || {}).label + (w.test ? ' · 시험 무기(강화석·결정 안 듦, 저장 안 됨)' : '');
    document.getElementById('encLv').textContent = '+' + lv;
    var ti = ENC.tierName.reduce(function (n, q, i) { return lv >= q[0] ? i : n; }, 0);
    document.getElementById('encName').innerHTML = '<em class="t' + ti + '">' + w.tier() + '</em> ' + (D.label || '') + ' <b>+' + lv + '</b>';
    document.getElementById('encInfo').innerHTML = w.isMax() ? '최고 강화! (+' + ENC.maxLv + ')' :
      '성공 확률 <b>' + Math.round(w.rate() * 100) + '%</b> · 강화석 <b>' + w.cost() + '</b>개' + (w.test ? '' : ' (가진 ' + Growth.stones + '개)') + '<br>실패해도 강화석만 사라져요';
    var go = document.getElementById('btnEncGo');
    go.disabled = !w.canEnhance(); go.textContent = w.isMax() ? '최고 강화' : '강화 (+' + (lv + 1) + ')';
    var bon = document.getElementById('encBon');
    bon.innerHTML = w.milestones().map(function (m) { return '<div class="' + (m.on ? 'on' : '') + '"><i>+' + m.lv + '</i>' + bonTxt(m.val) + '</div>'; }).join('');
    var sl = document.getElementById('encSlots');
    sl.innerHTML = '';
    for (var i = 0; i < 3; i++) (function (i) {
      var b = document.createElement('button'), e = w.at(i), open = w.slotOpen(i);
      b.type = 'button'; b.className = 'eslot' + (e ? '' : ' empty') + (encSlot === i ? ' sel' : ''); b.disabled = !open; b.dataset.slot = i;
      b.innerHTML = !open ? '<span><b>잠김</b><small>+' + w.slotLv(i) + ' 에 열림</small></span>' :
        e ? '<img alt="" src="' + Enchant.iconUrl('crys', e) + '"><span><b style="color:' + ENC.el[e].col2 + '">' + ENC.el[e].name + '</b><small>' + (i + 1) + '번 칸 · 바꾸기 ' + w.setCost(i) + '개</small></span>' :
            '<span><b>비어 있음</b><small>' + (i + 1) + '번 칸 · 결정 ' + w.setCost(i) + '개</small></span>';
      b.addEventListener('click', function () { openPick(i); });
      sl.appendChild(b);
    })(i);
    document.getElementById('encCrys').innerHTML = '가진 결정: ' + ENC.order.map(function (k) {
      return '<span><img alt="" src="' + Enchant.iconUrl('crys', k) + '">' + ENC.el[k].name + ' ' + (w.test ? '∞' : Growth.crys[k] || 0) + '</span>'; }).join('');
    encBadges();
  }
  // 속성 고르기(칸 i)
  function openPick(i) {
    var w = wpn(); if (!w || !w.slotOpen(i)) return;
    encSlot = i; encPickEl = null;
    document.getElementById('encMain').hidden = true;
    var P = document.getElementById('encPick'); P.hidden = false;
    document.getElementById('encPickT').textContent = (i + 1) + '번 칸 속성' + (w.at(i) ? ' (지금 ' + ENC.el[w.at(i)].name + ')' : '');
    var pc0 = document.getElementById('encPickCost'); if (pc0) pc0.textContent = '그 속성 결정 ' + w.setCost(i) + '개를 써서 부여해요';   // 2026-11-07 칸마다 5 · 10 · 20개
    var L = document.getElementById('encEls'); L.innerHTML = '';
    ENC.order.forEach(function (e) {
      var b = document.createElement('button'), E = ENC.el[e], ok = w.canSet(i, e), used = w.els().indexOf(e) >= 0;
      b.type = 'button'; b.className = 'eel'; b.disabled = !ok; b.dataset.el = e;
      b.innerHTML = '<img alt="" src="' + Enchant.iconUrl('crys', e) + '"><b style="color:' + E.col + '">' + E.name + '</b><em>' + (w.test ? '∞' : (Growth.crys[e] || 0) + '/' + w.setCost(i)) + '</em>' +
        '<small>' + (used ? (w.at(i) === e ? '지금 이 칸 속성' : '다른 칸에 있음') : E.short) + '</small>';
      b.addEventListener('click', function () {
        encPickEl = e;
        L.querySelectorAll('.eel').forEach(function (x) { x.classList.toggle('sel', x.dataset.el === e); });
        var s = document.getElementById('btnEncSet'); s.disabled = false; s.textContent = E.name + ' 부여 (결정 ' + w.setCost(i) + '개)';
      });
      L.appendChild(b);
    });
    var s = document.getElementById('btnEncSet'); s.disabled = true; s.textContent = '부여';
    var f = L.querySelector('.eel:not([disabled])') || document.getElementById('btnEncBack');
    try { f.focus({ preventScroll: true }); } catch (er) { f.focus(); }
  }
  function closePick() {
    encSlot = -1; encPickEl = null;
    document.getElementById('encPick').hidden = true; document.getElementById('encMain').hidden = false;
    renderEnc();
  }
  function encMsg(txt, cls) {
    var m = document.getElementById('encMsg'); m.textContent = txt; m.className = 'encmsg ' + (cls || '');
    var pic = document.getElementById('encPic'); pic.classList.remove('ok', 'fail'); if (cls) { void pic.offsetWidth; pic.classList.add(cls); }
  }
  function doEnhance(roll) {
    var w = wpn(); if (!w) return null;
    var r = w.enhance(roll);
    if (!r) return null;
    if (r.ok) { encMsg('성공! +' + r.lv + (ENC.slotLv.indexOf(r.lv) >= 0 ? ' · 속성 칸이 열렸어요!' : ''), 'ok'); snd('levelUp'); encCelebrate(r.lv, w); }
    else { encMsg('실패… 강화석 ' + r.cost + '개만 사라졌어요', 'fail'); snd('block'); }
    renderEnc();
    return r;
  }
  // 축하(2026-11-06 형님): 등급이 바뀌는 강화(+3 희귀 · +6 영웅 · +9 전설) = 작은 축하(글자 + 그림판 빛줄기),
  //   +10 신화 = 큰 축하: 창 전체 흰 번쩍 → 무기 그림이 커지며 빛줄기 · 별 터짐, 큰 무지개 글자 「+10 달성!」, 잠깐(1.4초) 버튼이 안 눌림, 팡파르(stageClear)
  var celeT = 0, celeBig = false, celeLock = 0;
  function encCelebrate(lv, w) {
    var tier = ENC.tierName.some(function (q) { return q[0] === lv; });
    if (!tier) return;
    celeBig = lv >= ENC.maxLv; celeT = performance.now();
    var C = document.getElementById('encCele');
    document.getElementById('encCeleT').textContent = '+' + lv + ' 달성!';
    document.getElementById('encCeleS').textContent = w.tier() + ' ' + ((CFG.art.weapons[w.art(artLoaded)] || {}).label || '') + (celeBig ? ' · 고유 효과' : '');
    C.className = 'enccele ' + (celeBig ? 'big' : 'small'); C.hidden = false; void C.offsetWidth; C.classList.add('go');
    encEl.classList.remove('cele10'); if (celeBig) { void encEl.offsetWidth; encEl.classList.add('cele10'); }
    clearTimeout(celeLock);
    if (celeBig) {
      snd('stageClear'); setTimeout(function () { snd('unlock'); }, 450);
      document.getElementById('btnEncGo').disabled = true; document.getElementById('btnEncClose').disabled = true;   // 잠깐 멈춤(축하를 보게)
      celeLock = setTimeout(function () { document.getElementById('btnEncClose').disabled = false; renderEnc(); }, 1400);
    } else snd('unlock');
    setTimeout(function () { C.hidden = true; }, celeBig ? 2600 : 1500);
  }
  // 그림판 뒤 축하 빛줄기 · 별(celeT 부터 big = 2.6초, 작은 = 1.4초)
  function celeDraw(g, cv) {
    var u = (performance.now() - celeT) / (celeBig ? 2600 : 1400);
    if (!celeT || u >= 1) return 1;
    var cx = cv.width / 2, cy = cv.height / 2, a = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85, n = celeBig ? 16 : 10, R = cv.width * (celeBig ? 0.7 : 0.45);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter';
    for (var i = 0; i < n; i++) {   // 빛줄기(돌아감)
      var an = i / n * Math.PI * 2 + u * 1.5;
      g.globalAlpha = 0.35 * a; g.fillStyle = celeBig ? ['#ff9ee6', '#9fe8ff', '#fff1c4', '#c9b0ff'][i % 4] : '#fff1c4';
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, an - 0.07, an + 0.07); g.closePath(); g.fill();
    }
    for (var j = 0; j < (celeBig ? 28 : 12); j++) {   // 별 터짐
      var b = j * 2.399, d = R * (0.15 + u * (0.6 + 0.4 * ((j * 7) % 5) / 5)), s = (celeBig ? 4 : 3) * (1 - u);
      g.globalAlpha = a; g.fillStyle = ['#ffffff', '#fff0a8', '#9fe8ff', '#ffb8f0'][j % 4];
      g.fillRect(cx + Math.cos(b) * d - s / 2, cy + Math.sin(b) * d * 0.6 - s * 1.5, s, s * 3); g.fillRect(cx + Math.cos(b) * d - s * 1.5, cy + Math.sin(b) * d * 0.6 - s / 2, s * 3, s);
    }
    g.restore();
    return 1 + (celeBig ? 0.25 * Math.sin(Math.min(1, u * 2.5) * Math.PI) : 0);   // 큰 축하 = 무기가 잠깐 커짐
  }
  function openEnc() {
    if (!encEl.hidden || !wpn()) return;
    encBack = { menu: menuEl && !menuEl.hidden ? menuEl : null, paused: G.paused };
    G.paused = true; Input.setOverride(null);
    encSlot = -1; document.getElementById('encPick').hidden = true; document.getElementById('encMain').hidden = false;
    encMsg('', ''); celeT = 0; document.getElementById('encCele').hidden = true; document.getElementById('btnEncClose').disabled = false;
    renderEnc();
    openMenu(encEl, document.getElementById('btnEncGo').disabled ? document.getElementById('btnEncClose') : document.getElementById('btnEncGo'));
    cancelAnimationFrame(encRaf); encRaf = requestAnimationFrame(encDraw);
  }
  function closeEnc() {
    closeMenu(encEl); cancelAnimationFrame(encRaf);
    var B = encBack || {}; encBack = null;
    G.paused = !!B.paused;
    if (B.menu && !B.menu.hidden) openMenu(B.menu, B.menu.querySelector('.encopen'));
  }
  document.getElementById('btnEnc').addEventListener('click', function () { openEnc(); this.blur(); });
  document.querySelectorAll('.encopen').forEach(function (b) { b.addEventListener('click', function () { openEnc(); }); });
  document.getElementById('btnEncClose').addEventListener('click', closeEnc);
  document.getElementById('btnEncGo').addEventListener('click', function () { doEnhance(); });
  document.getElementById('btnEncBack').addEventListener('click', closePick);
  document.getElementById('btnEncSet').addEventListener('click', function () {
    var w = wpn(), e = encPickEl, i = encSlot;
    if (w && e && w.set(i, e)) { snd('unlock'); closePick(); encMsg((i + 1) + '번 칸에 ' + ENC.el[e].name + ' 속성 부여!', 'ok'); }
  });
  window.addEventListener('keydown', function (e) { if (e.code === 'Escape' && !encEl.hidden) { e.preventDefault(); if (encSlot >= 0) closePick(); else closeEnc(); } });
  G.openEnc = openEnc; G.closeEnc = closeEnc; G.encEnhance = doEnhance; G.encPick = openPick;

  // ---------- 기술 칸 열림 알림 (2026-11-06 폰 UI): 레벨업으로 기술 칸이 늘면(config skills.moreLv = Lv10 · Lv13 · Lv15) 한 번 ----------
  //   「축하합니다!」 + 칸 줄(새로 열린 칸 = 빛남, 아직 잠긴 칸 = 자물쇠) + 확인. 여는 동안 게임 멈춤(다른 창처럼), 닫으면 원래대로.
  //   저장된 직업의 기술 책만(시험 버튼으로 입은 다른 직업 = 늘 4칸이라 안 뜸). 시험 자동 조종(G.bot)은 안 띄움(멈추지 않게)
  var upEl = document.getElementById('unlockPop'), upBack = null;
  //   2026-11-07: PC 화면이면 PC 칸 수(Lv15 에 위 줄 6~10번 칸까지 한꺼번에)
  function slotsAtLv(lv, pc) {
    var S = CFG.skills.slots || [2, 4], M = [].concat(CFG.skills.moreLv || 13), n = S[0];
    if (CFG.skills.slotsAllOpen) return pc && CFG.skills.pcSlots ? CFG.skills.pcSlots : S[S.length - 1];   // 2026-11-07: 전직하면 다 열림 → 알림 안 뜸
    if (pc && CFG.skills.pcSlots && lv >= (CFG.skills.pcLv || 0)) return CFG.skills.pcSlots;
    M.forEach(function (l, k) { if (lv >= l && S[k + 1] != null) n = S[k + 1]; });
    return n;
  }
  function checkUnlock(up) {
    var bk = Growth.book(G.classKey), pc = isPc();
    if (!bk || bk.test || bk.novice || MODE !== 'stage' || G.bot) return;
    var before = slotsAtLv(Growth.lv - up, pc), now = bk.slots(pc);
    if (now > before) openUnlock(before, now);
  }
  function openUnlock(from, to) {
    var bk = Growth.book(G.classKey), S = CFG.skills[bk.cls], pc = isPc(), nAll = bk.maxSlots(pc), row = document.getElementById('upSlots');
    document.getElementById('upLv').textContent = 'Lv ' + Growth.lv;
    row.innerHTML = '';
    row.classList.toggle('ten', nAll > 5);
    slotOrder(nAll, pc).forEach(function (i) {
      var id = bk.at(i), c = document.createElement('div');
      c.className = 'upslot' + (i >= to ? ' locked' : i >= from ? ' new' : '') + (id ? '' : ' empty');
      c.innerHTML = '<kbd>' + slotKey(i) + '</kbd>';
      if (id) c.appendChild(skIcon(id, 48)); else c.insertAdjacentHTML('beforeend', '<i class="bph"></i>');
      c.insertAdjacentHTML('beforeend', '<small>' + (i >= to ? 'Lv' + bk.slotLv(i) : id ? slotName(S, id) : '빈 칸') + '</small>');
      row.appendChild(c);
    });
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
    if (branchAfterUp) { branchAfterUp = false; if (needBranchChoice()) openBranchChoice(null); else if (needTier3Choice()) openTier3(null); }   // 2차 갈래 고르기(2026-11-08) · 3차 전직(2026-11-10)
  }
  document.getElementById('btnUpOk').addEventListener('click', function () { closeUnlock(); this.blur(); });
  window.addEventListener('keydown', function (e) { if (e.code === 'Escape' && !upEl.hidden) { e.preventDefault(); closeUnlock(); } });
  G.openUnlock = openUnlock;
  // ---------- PC 아래 막대 (2026-11-07, 형님 승인) ----------
  //   body.pcui(input.js 가 붙임) 일 때 화면 맨 아래 띠: 행동 칸(각성 L · 평타 J · 점프 Space) | 기술 칸 10개(위 줄 6~0 · 아래 줄 1~5) |
  //   창 버튼(능력치 C · 기술 V · 강화 B · 설정 Esc · 소리 M). 게임 화면은 이 띠 위까지(resize 의 pcBarPx)
  //   칸 = 기술 책(growth.js)의 칸 순서 그대로(폰은 앞 7칸만). 칸을 마우스로 눌러도 씀(Input.pressSlot: 회피를 끼운 칸이면 회피)
  //   칸 열림: 1~5번 = 폰과 같은 Lv(2칸 → Lv10 · 13 · 15), 6~10번 = Lv15 에 한꺼번에(config skills.pcSlots · pcLv). 견습 = 다 잠김
  function isPc() { return Input.mode() === 'pc'; }
  // 키 이름(첫 키): Digit1 → 1, KeyU → U, Escape → Esc, ShiftLeft → Shift … (이름표 = js/keys.js Keys.label, 키 설정에서 바꾼 키)
  function keyLabel(list) { return Keys.label(list && list[0]); }
  // 칸을 그리는 순서: PC 10칸 = 위 줄(6~10번) 먼저 → 아래 줄(1~5번). 그 밖 = 1번부터
  function slotOrder(n, pc) {
    var a = [], i;
    if (pc && n > 5) { for (i = 5; i < n; i++) a.push(i); for (i = 0; i < 5; i++) a.push(i); }
    else for (i = 0; i < n; i++) a.push(i);
    return a;
  }
  // 게임 화면 밑에서 비울 높이(css px): PC 화면이면 아래 막대 + 경험치 줄. 폰은 0(경험치 줄은 얇게 겹침)
  function pcBarPx() {
    var x = document.getElementById('xpLine'), xh = x ? x.offsetHeight : 0, b = document.getElementById('pcBar');
    document.documentElement.style.setProperty('--xph', (isPc() ? xh : 0) + 'px');
    return isPc() && b ? b.offsetHeight + xh : 0;
  }
  var pcSlotsEl = [], pcLast = {}, pcCool = {};
  var pcAtkEl = document.getElementById('pcAtk'), pcJumpEl = document.getElementById('pcJump'), pcAwkEl = document.getElementById('pcAwk');
  // 마우스로 누름(손가락이어도 됨): 누르는 순간 한 번 + 눌린 모습
  function pcPress(el, fn) {
    if (!el) return;
    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault(); fn(); el.classList.add('down');
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { el.addEventListener(t, function () { el.classList.remove('down'); }); });
  }
  (function buildPcBar() {
    var wrap = document.getElementById('pcSkills');
    if (!wrap) return;
    slotOrder(Skills.slots.length, true).forEach(function (i) {
      var k = Skills.slots[i], s = document.createElement('div');
      s.className = 'pslot psl'; s.dataset.pslot = k; s.setAttribute('role', 'button'); s.setAttribute('aria-label', (i + 1) + '번 칸');
      s.innerHTML = '<span class="ic"></span><i class="sweep"></i><b class="sec"></b><kbd>' + keyLabel(CFG.keys['skill' + k]) + '</kbd><small class="mp"></small>';
      wrap.appendChild(s); pcSlotsEl[i] = s;
      pcPress(s, function () { if (!s.classList.contains('locked') && !s.classList.contains('empty')) Input.pressSlot(k); });
    });
    pcPress(pcAtkEl, function () { Input.pressAttack(); });
    pcPress(pcJumpEl, function () { Input.pressJump(); });
    pcPress(pcAwkEl, function () { Input.pressAwaken(); });
    [[pcAtkEl, 'attack'], [pcJumpEl, 'jump'], [pcAwkEl, 'awaken']].forEach(function (a) { var kb = a[0] && a[0].querySelector('kbd'); if (kb) kb.textContent = keyLabel(CFG.keys[a[1]]); });
  })();
  // 칸 그림(js/icons.js 금테 액자): 칸 크기(기기 점)에 가장 가까운 정수 배. 같은 그림 · 같은 크기면 다시 안 그림
  function pcIcon(el, id) {
    var ic = el && el.querySelector('.ic');
    if (!ic) return;
    if (!id || !window.PixelIcons) { if (ic.dataset.icon) { ic.dataset.icon = ''; ic.textContent = ''; } return; }
    var sc = Math.max(1, Math.round((el.offsetWidth || 40) * (window.devicePixelRatio || 1) / 32)), key = id + '@' + sc;
    if (ic.dataset.icon === key) return;
    ic.dataset.icon = key; ic.textContent = '';
    ic.appendChild(PixelIcons.canvas(id, sc, { frame: true }));
  }
  // 매 장(render): 바뀐 칸만 다시 그림. 쿨타임 = --cd + 남은 초, 마나 모자람 = nomp, 쿨타임이 끝나는 순간 = 번쩍(ready)
  function pcBarUi() {
    if (!isPc() || !G.player) return;
    pcIcon(pcAtkEl, 'atk'); pcIcon(pcJumpEl, 'jump');
    var bk = Growth.book(G.classKey), n = bk ? bk.slots(true) : 0;
    for (var i = 0; i < pcSlotsEl.length; i++) {
      var el = pcSlotsEl[i];
      if (!el) continue;
      var locked = i >= n, st = locked ? null : Skills.slotState(G, i);
      var key = locked ? 'L' + (bk ? bk.slotLv(i) : 0) : !st ? 'E' : st.id + '|' + st.frac + '|' + Math.ceil(st.rem / 100) + '|' + st.nomp + '|' + st.cost + '|' + (st.n == null ? '' : st.n + '/' + st.max);
      if (pcLast[i] === key) continue;
      pcLast[i] = key;
      var cool = !!st && st.rem > 0, was = pcCool[i];
      pcCool[i] = cool ? st.id : null;
      el.classList.toggle('locked', locked); el.classList.toggle('empty', !locked && !st);
      el.classList.toggle('cool', cool); el.classList.toggle('nomp', !!st && st.nomp);
      el.style.setProperty('--cd', st ? st.frac : 0);
      pcIcon(el, st ? st.id : null);
      el.querySelector('.sec').textContent = cool ? (st.rem >= 1000 ? Math.ceil(st.rem / 1000) : (st.rem / 1000).toFixed(1)) : '';
      var mp = el.querySelector('small');
      mp.className = locked ? 'lk' : 'mp';
      var nov = !bk || bk.novice;   // 견습(2026-11-07): 1번 칸 = 올려치기, 나머지 = 전직하면 열림
      mp.textContent = locked ? (!nov ? 'Lv' + bk.slotLv(i) : '') : st && !st.dodge ? st.cost : st && st.dodge && st.max > 1 ? 'x' + st.n : '';   // 회피 = 남은 수(2026-11-08)
      el.title = locked ? (!nov ? (i + 1) + '번 칸 · Lv' + bk.slotLv(i) + ' 에 열려요' : '전직하면 기술 칸이 열려요') :
        st ? st.name + (st.dodge ? ' (' + Keys.lab('dodge') + ' 로도)' : ' · MP ' + st.cost) : (i + 1) + '번 칸 · 비었어요 (기술 창 ' + Keys.lab('skill') + ' 에서 끼워요)';
      if (was && !cool && st && was === st.id) { el.classList.remove('ready'); void el.offsetWidth; el.classList.add('ready'); }
    }
  }

  // ---------- PC 조작 도움말 한 줄 (2026-11-07): 처음 config help.plays 번 켤 때만(PC 화면으로 켠 횟수), X 로 닫음, 설정 창에서 다시 켬 ----------
  //   저장 = localStorage 'pixelBrawler.help' = { n: PC 로 켠 횟수, off: 닫음, on: 설정에서 켬(횟수 상관없이 보임) }
  var HELP_KEY = CFG.demo ? 'pixelBrawler.demo.help' : 'pixelBrawler.help', helpSt = { n: 0, off: false, on: false };
  try { var hs0 = JSON.parse(localStorage.getItem(HELP_KEY) || 'null'); if (hs0 && typeof hs0 === 'object') helpSt = { n: hs0.n | 0, off: !!hs0.off, on: !!hs0.on }; } catch (e) {}
  function helpSave() { try { localStorage.setItem(HELP_KEY, JSON.stringify(helpSt)); } catch (e) {} }
  if (isPc()) { helpSt.n++; helpSave(); }
  function helpShown() { return !helpSt.off && (helpSt.on || helpSt.n <= ((CFG.help && CFG.help.plays) || 3)); }
  function helpUi() { var h = document.getElementById('keyHint'); if (h) h.hidden = !(isPc() && helpShown()); }
  document.getElementById('btnHelpX').addEventListener('click', function () { helpSt.off = true; helpSt.on = false; helpSave(); helpUi(); this.blur(); });

  // ---------- 설정 창 (2026-11-07, PC Esc · 아래 막대 「설정」): 소리 · 조작 도움말 켜고 끄기 + 키 안내. 여는 동안 게임 멈춤 ----------
  //   2026-11-07 키 설정 · 화면 설정(형님 승인): 효과음 크기 · 화면 흔들림 · 전체화면 + 키 설정 표(js/keys.js). 친구 시험 모드(?demo=1)도 같은 창
  //   저장 = localStorage 'pixelBrawler.opts' = { vol: 0~10, shake: 켬/끔 } (친구 시험 모드 = 'pixelBrawler.demo.opts'). 전체화면은 저장 안 함(브라우저 규칙: 누를 때만)
  var setEl = document.getElementById('setPanel'), setBack = null;
  //   2026-11-07 폰 설정: vib = 진동 켬/끔, joy = 조이스틱 범위('wide' 넓게 · 'mid' 보통 · 'narrow' 좁게 → body 의 joy-wide / joy-narrow, style.css .joyzone)
  var phSetEl = document.getElementById('btnPhSet');
  var OPT_KEY = CFG.demo ? 'pixelBrawler.demo.opts' : 'pixelBrawler.opts', opt = { vol: 10, shake: true, vib: true, joy: 'mid' };
  try { var op0 = JSON.parse(localStorage.getItem(OPT_KEY) || 'null'); if (op0 && typeof op0 === 'object') opt = { vol: op0.vol >= 0 && op0.vol <= 10 ? Math.round(op0.vol) : 10, shake: op0.shake !== false,
    vib: op0.vib !== false, joy: ['wide', 'mid', 'narrow'].indexOf(op0.joy) >= 0 ? op0.joy : 'mid' }; } catch (e) {}
  function optSave() { try { localStorage.setItem(OPT_KEY, JSON.stringify(opt)); } catch (e) {} }
  // 효과음 크기: js/sfx.js 는 고치지 않음 → 그 파일이 보는 config audio.master(전체 크기)를 바꾸고, 켜져 있으면 SFX.setMuted(false) 로 다시 맞춤
  var AU = CFG.audio || (CFG.audio = {}), VOL0 = AU.master != null ? AU.master : 0.8;
  function volApply(live) {
    AU.master = VOL0 * opt.vol / 10;
    if (live && window.SFX && SFX.isMuted && !SFX.isMuted() && SFX.setMuted) SFX.setMuted(false);
  }
  function shakeApply() { FX.setShakeMul(opt.shake ? 1 : 0); }
  function joyApply() { document.body.classList.toggle('joy-wide', opt.joy === 'wide'); document.body.classList.toggle('joy-narrow', opt.joy === 'narrow'); }
  var vibCan = typeof navigator.vibrate === 'function';
  volApply(false); shakeApply(); joyApply();
  // 전체화면(Fullscreen API): 안 되는 브라우저(아이폰 등) = 버튼 잠금, 거절되면 글자로 알림
  var DE = document.documentElement;
  function fsOn() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function fsCan() { return !!(DE.requestFullscreen || DE.webkitRequestFullscreen) && document.fullscreenEnabled !== false && document.webkitFullscreenEnabled !== false; }
  var fsFail = '';
  function fsToggle() {
    fsFail = '';
    function bad() { fsFail = '전체화면을 쓸 수 없어요 (브라우저가 막음, F11 을 써 보세요)'; setUi(); }
    // 폰 화면(2026-11-07): 전체화면이 켜지면 가로로 고정(screen.orientation.lock, 안 되는 브라우저 = 그냥 지나감)
    function lockLand() {
      if (Input.mode() !== 'touch') return;
      try { var o = screen.orientation, q = o && o.lock && o.lock('landscape'); if (q && q.catch) q.catch(function () {}); } catch (e) {}
    }
    try {
      var r, on = fsOn();
      if (on) r = (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else r = (DE.requestFullscreen || DE.webkitRequestFullscreen).call(DE);
      if (r && r.then) r.then(on ? null : lockLand, bad);
      else if (!on) setTimeout(lockLand, 300);
    } catch (e) { bad(); }
  }
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (t) { document.addEventListener(t, function () { if (!setEl.hidden) setUi(); }); });
  function setUi() {
    var m = !!(window.SFX && SFX.isMuted && SFX.isMuted()), h = helpShown(), sb = document.getElementById('btnSetSnd'), hb = document.getElementById('btnSetHelp');
    sb.textContent = m ? '꺼짐' : '켜짐'; sb.classList.toggle('on', !m);
    hb.textContent = h ? '켜짐' : '꺼짐'; hb.classList.toggle('on', h);
    var kb = document.getElementById('btnSetShake'); kb.textContent = opt.shake ? '켜짐' : '꺼짐'; kb.classList.toggle('on', opt.shake);
    var fb = document.getElementById('btnSetFull'), f = fsOn(), can = fsCan();
    fb.textContent = f ? '켜짐' : '꺼짐'; fb.classList.toggle('on', f); fb.disabled = !can;
    document.getElementById('fullTip').textContent = !can ? '이 브라우저에서는 쓸 수 없어요' : fsFail || (f ? 'Esc 로도 나가요' : '화면을 꽉 채워요');
    var vb = document.getElementById('volBar');
    vb.style.setProperty('--v', opt.vol / 10); vb.setAttribute('aria-valuenow', opt.vol);
    document.getElementById('volTxt').textContent = (opt.vol * 10) + '%';
    document.getElementById('btnVolDn').disabled = opt.vol <= 0; document.getElementById('btnVolUp').disabled = opt.vol >= 10;
    document.getElementById('setSndTip').textContent = Keys.lab('sound') ? Keys.lab('sound') + ' 키로도 켜고 꺼요' : '';
    // 폰 설정(2026-11-07): 진동(안 되는 기기 = 줄 숨김) · 조이스틱 범위
    document.getElementById('vibRow').hidden = !vibCan;
    var vb2 = document.getElementById('btnSetVib'); vb2.textContent = opt.vib ? '켜짐' : '꺼짐'; vb2.classList.toggle('on', opt.vib);
    document.querySelectorAll('#joySeg [data-joy]').forEach(function (b) { b.classList.toggle('on', b.dataset.joy === opt.joy); });
  }
  function setVol(v) { v = Math.max(0, Math.min(10, Math.round(v))); if (v === opt.vol) return; opt.vol = v; optSave(); volApply(true); setUi(); }
  document.getElementById('btnVolDn').addEventListener('click', function () { setVol(opt.vol - 1); if (this.disabled) document.getElementById('btnVolUp').focus(); });
  document.getElementById('btnVolUp').addEventListener('click', function () { setVol(opt.vol + 1); if (this.disabled) document.getElementById('btnVolDn').focus(); });
  // 막대를 누르거나 끌면 그 자리 크기(10칸)
  (function () {
    var vb = document.getElementById('volBar'), drag = false;
    function at(e) { var r = vb.getBoundingClientRect(); setVol(Math.ceil(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 10 - 0.25)); }
    vb.addEventListener('pointerdown', function (e) { drag = true; try { vb.setPointerCapture(e.pointerId); } catch (x) {} at(e); e.preventDefault(); });
    vb.addEventListener('pointermove', function (e) { if (drag) at(e); });
    ['pointerup', 'pointercancel'].forEach(function (t) { vb.addEventListener(t, function () { drag = false; }); });
  })();
  document.getElementById('btnSetShake').addEventListener('click', function () { opt.shake = !opt.shake; optSave(); shakeApply(); setUi(); });
  document.getElementById('btnSetFull').addEventListener('click', function () { fsToggle(); setTimeout(setUi, 0); });
  // 폰 설정(2026-11-07): 진동 켜기 = 짧게 한 번 떨어 봄 · 조이스틱 범위 · 조작 도움말 창 · 버튼 위치 바꾸기(js/padlayout.js)
  document.getElementById('btnSetVib').addEventListener('click', function () {
    opt.vib = !opt.vib; optSave(); setUi();
    if (opt.vib && vibCan) try { navigator.vibrate(40); } catch (e) {}
  });
  document.querySelectorAll('#joySeg [data-joy]').forEach(function (b) { b.addEventListener('click', function () { opt.joy = b.dataset.joy; optSave(); joyApply(); setUi(); }); });
  var phHelpEl = document.getElementById('phHelp');
  document.getElementById('btnSetHelpT').addEventListener('click', function () { openMenu(phHelpEl, document.getElementById('btnPhHelpOk')); });
  document.getElementById('btnPhHelpOk').addEventListener('click', function () { closeMenu(phHelpEl); openMenu(setEl, document.getElementById('btnSetHelpT')); });
  document.getElementById('btnSetLay').addEventListener('click', function () {
    // 설정 창은 잠깐 숨기고(게임은 계속 멈춤) 바꾸기 화면 → 저장 · 취소 = 설정 창으로 돌아옴
    closeMenu(setEl);
    var ok = PadLayout.open(function (saved) {
      openMenu(setEl, document.getElementById('btnSetLay'));
      document.getElementById('layTip').textContent = saved ? '저장했어요 (이 화면 모양에만)' : '버튼을 끌어서 옮겨요';
      setUi();
    });
    if (!ok) openMenu(setEl, document.getElementById('btnSetLay'));
  });

  // ---------- 키 설정 표 (2026-11-07, js/keys.js) ----------
  //   왼쪽 = 움직이기 · 싸우기 · 창 · 소리, 오른쪽 = 기술 1~10번 칸. 칸(기본 키 · 보조 키)을 누르면 「키를 누르세요」 → 다음 키로 바뀜
  //   Esc = 취소, Backspace · Delete = 그 칸 비우기. 다른 곳에 쓰던 키면 「이미 ○○에 쓰는 키입니다」 + 서로 바꿈. 설정 창 기본 키 Esc 는 못 바꿈
  var keyWait = null;   // { act, i, t } = 키를 기다리는 칸
  var keyTblEl = document.getElementById('keyTbl'), keyMsgEl = document.getElementById('keyMsg');
  function keyMsg(s) { keyMsgEl.textContent = s || ''; }
  function keyCell(a, i, r, c) {
    var l = Keys.get(a.id), code = l[i], lab = Keys.label(code), ex = i === 1 ? l.slice(2).filter(Boolean).map(Keys.label) : [];
    var w = keyWait && keyWait.act === a.id && keyWait.i === i;
    return '<button type="button" class="kc' + (code ? '' : ' none') + (w ? ' wait' : '') + '" data-act="' + a.id + '" data-i="' + i + '" data-r="' + r + '" data-c="' + c + '"' +
      (a.fixed0 && i === 0 ? ' disabled title="설정 창 Esc 는 바꿀 수 없어요"' : '') +
      ' aria-label="' + a.name + ' ' + (i ? '보조 키' : '기본 키') + ' ' + (lab || '없음') + '">' +
      (w ? '키를 누르세요' : (lab || '없음') + (ex.length ? ' <small>+' + ex.join(' ') + '</small>' : '')) + '</button>';
  }
  function keyTable() {
    var cols = [Keys.ACT.filter(function (a) { return !a.slot; }), Keys.ACT.filter(function (a) { return a.slot; })];
    keyTblEl.innerHTML = cols.map(function (list, ci) {
      return '<div class="kcol"><span class="kh">' + (ci ? '기술 칸' : '행동') + '</span><span class="kh">기본 키</span><span class="kh">보조 키</span>' +
        list.map(function (a, r) { return '<span class="kn" title="' + a.name + '">' + a.name + '</span>' + keyCell(a, 0, r, ci * 2) + keyCell(a, 1, r, ci * 2 + 1); }).join('') + '</div>';
    }).join('');
  }
  // 아래 막대 글자 · 창 버튼 이름표 · 도움말 한 줄 · 소리 버튼 이름표: 바꾼 키로 (한 곳 = Keys)
  function kbd(s) { return s ? '<kbd>' + s + '</kbd>' : ''; }
  function hintHtml() {
    var mv = ['up', 'left', 'down', 'right'], A = Keys.ACT.filter(function (a) { return a.slot; });
    var p = mv.map(function (id) { return Keys.label(Keys.get(id)[0]); }).join(''), q = mv.map(function (id) { return Keys.label(Keys.get(id)[1]); }).join('');
    var sk = Keys.isDefaultSlots() ? kbd(Keys.lab(A[0].id)) + '~' + kbd(Keys.lab(A[A.length - 1].id)) : A.map(function (a) { return kbd(Keys.lab(a.id)); }).join(' ');
    var alt = A.map(function (a) { return Keys.label(Keys.get(a.id)[1]); }).filter(Boolean);
    return '이동 ' + kbd(p) + (q ? '/' + kbd(q) : '') + ' · 달리기 두 번 · 점프 ' + kbd(Keys.lab('jump')) + ' · 평타 ' + kbd(Keys.lab('attack')) +
      ' · 회피 ' + kbd(Keys.lab('dodge')) + ' · 기술 ' + sk + (alt.length ? ' (' + alt.map(kbd).join(' ') + ')' : '') + ' · 각성 ' + kbd(Keys.lab('awaken'));
  }
  function sndTitle() {
    var m = !!(window.SFX && SFX.isMuted && SFX.isMuted()), k = Keys.lab('sound');
    document.querySelectorAll('.sndbtn').forEach(function (b) { b.title = (m ? '소리 켜기' : '소리 끄기') + (k ? ' (' + k + ')' : ''); });
    var kb = document.querySelector('#pcSnd kbd'); if (kb) kb.textContent = k;
  }
  function keysUi() {
    pcSlotsEl.forEach(function (s, i) { var kb = s && s.querySelector('kbd'); if (kb) kb.textContent = keyLabel(CFG.keys['skill' + Skills.slots[i]]); });
    [[pcAtkEl, 'attack'], [pcJumpEl, 'jump'], [pcAwkEl, 'awaken']].forEach(function (a) { var kb = a[0] && a[0].querySelector('kbd'); if (kb) kb.textContent = Keys.lab(a[1]); });
    [['pcStat', 'stat', '능력치'], ['pcSkill', 'skill', '기술'], ['pcEnc', 'enc', '강화'], ['pcSet', 'menu', '설정']].forEach(function (a) {
      var b = document.getElementById(a[0]), k = Keys.lab(a[1]);
      if (!b) return;
      b.querySelector('kbd').textContent = k;
      b.title = a[2] + (k ? ' (' + k + ')' : ''); b.setAttribute('aria-label', b.title);
    });
    sndTitle();
    var ht = document.getElementById('keyHintTxt'); if (ht) ht.innerHTML = hintHtml();
    pcLast = {};   // 칸 풍선 글자(회피 키 · 기술 창 키) 다시
    if (!setEl.hidden) { keyTable(); setUi(); }
    if (!skEl.hidden) renderSkills();
  }
  Keys.onChange(keysUi);
  function keyFocus(act, i) { var b = keyTblEl.querySelector('.kc[data-act="' + act + '"][data-i="' + i + '"]'); if (b) try { b.focus({ preventScroll: false }); } catch (e) { b.focus(); } return b; }
  function keyEnd(msg, ok) {
    var w = keyWait; keyWait = null;
    keyTable(); keyMsg(msg);
    if (!w) return;
    var b = keyFocus(w.act, w.i);
    if (b && ok) b.classList.add('flash');
  }
  function keyStart(b) {
    if (!b || b.disabled) return;
    keyWait = { act: b.dataset.act, i: +b.dataset.i, t: performance.now() };
    keyTable(); keyFocus(keyWait.act, keyWait.i);
    keyMsg(Keys.name(keyWait.act) + ' ' + (keyWait.i ? '보조 키' : '기본 키') + ' — 키를 누르세요 (Esc 취소 · Backspace 지우기)');
  }
  keyTblEl.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.kc');
    if (!b) return;
    if (keyWait && keyWait.act === b.dataset.act && keyWait.i === +b.dataset.i) { keyEnd(''); return; }   // 같은 칸 다시 누름 = 취소
    keyStart(b);
  });
  // 기다리는 동안 창의 다른 곳을 누르면 취소
  setEl.addEventListener('pointerdown', function (e) { if (keyWait && !(e.target.closest && e.target.closest('.kc'))) keyEnd(''); }, true);
  // 키를 기다리는 동안: 맨 먼저 받아서 다른 곳(게임 조작 · 창 키 · 고르기)으로 안 넘김. 칸을 누른 그 키(Enter 등)는 무시
  window.addEventListener('keydown', function (e) {
    if (!keyWait || e.timeStamp < keyWait.t) return;
    e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
    if (e.repeat) return;
    var c = e.code, w = keyWait;
    if (!c) return;
    if (c === 'Escape') { keyEnd(''); return; }
    if (c === 'Backspace' || c === 'Delete') { var cr = Keys.clear(w.act, w.i); keyEnd(cr.ok ? '' : cr.msg || '', cr.ok); return; }
    var r = Keys.set(w.act, w.i, c);
    if (!r.ok) { keyMsg(r.msg || ''); return; }   // 못 쓰는 키 = 계속 기다림
    keyEnd(r.msg || '', true);
  }, true);
  document.getElementById('btnKeyReset').addEventListener('click', function () { keyWait = null; Keys.reset(); keyTable(); keyMsg('기본 키로 돌렸어요'); });
  setTimeout(keysUi, 0);   // js/sfx.js 가 소리 버튼 이름표를 그린 뒤(DOMContentLoaded)에도 맞춤
  document.querySelectorAll('.sndbtn').forEach(function (b) { b.addEventListener('click', function () { setTimeout(sndTitle, 0); }); });
  function openSet() {
    if (!setEl.hidden) return;
    var xr = document.getElementById('dgExitRow'); if (xr) xr.hidden = !dgRunning();   // 던전 도전 중에만 「나가기」
    setBack = { menu: menuEl && !menuEl.hidden ? menuEl : null, paused: G.paused };
    G.paused = true; Input.setOverride(null);
    keyWait = null; keyMsg(''); keyTable();
    setUi();
    openMenu(setEl, document.getElementById('btnSetClose'));
  }
  function closeSet() {
    if (setEl.hidden) return;
    keyWait = null;
    closeMenu(setEl);
    var B = setBack || {}; setBack = null;
    G.paused = !!B.paused;
    if (B.menu && !B.menu.hidden) openMenu(B.menu, B.menu.querySelector('button:not([hidden])'));
  }
  document.getElementById('btnSetClose').addEventListener('click', closeSet);
  document.getElementById('btnSetSnd').addEventListener('click', function () { if (window.SFX && SFX.toggle) SFX.toggle(); setUi(); });
  document.getElementById('btnSetHelp').addEventListener('click', function () {
    if (helpShown()) { helpSt.off = true; helpSt.on = false; } else { helpSt.off = false; helpSt.on = true; }
    helpSave(); helpUi(); setUi();
  });
  document.getElementById('pcSet').addEventListener('click', function () { openSet(); this.blur(); });
  G.openSet = openSet; G.closeSet = closeSet;

  // ---------- 던전 나가기 확인(2026-11-07): 설정 창 「나가기」 → 게임 안 확인 창(브라우저 창 아님) ----------
  //   나가기 = 이번 도전 끝(모은 강화석은 남음) → 던전 고르기. 계속하기 · Esc = 설정 창으로 돌아감
  var dgCfEl = document.getElementById('dgConfirm');
  function dgConfirmOpen() { if (!dgRunning() || !dgCfEl) return; openMenu(dgCfEl, document.getElementById('btnDgStay')); }
  function dgConfirmClose() { if (!dgCfEl || dgCfEl.hidden) return; closeMenu(dgCfEl); if (!setEl.hidden) openMenu(setEl, document.getElementById('btnDgExit')); }
  if (dgCfEl) {
    document.getElementById('btnDgExit').addEventListener('click', function () { dgConfirmOpen(); this.blur(); });
    document.getElementById('btnDgStay').addEventListener('click', function () { dgConfirmClose(); });
    document.getElementById('btnDgQuit').addEventListener('click', function () { closeMenu(dgCfEl); closeSet(); dgQuit(); this.blur(); });
    window.addEventListener('keydown', function (e) {   // 확인 창이 떠 있으면 Esc = 계속하기(설정 창이 같이 닫히지 않게 먼저 받음)
      if (dgCfEl.hidden || e.code !== 'Escape') return;
      e.preventDefault(); e.stopPropagation(); dgConfirmClose();
    }, true);
  }
  // 폰 톱니 설정 버튼(2026-11-07, 오른쪽 위 소리 버튼 옆, 예전 던전 멈춤 버튼을 합침): 설정 창 = 멈춤(던전 도전 중이면 나가기 줄도)
  if (phSetEl) phSetEl.addEventListener('click', function () { if (setEl.hidden && !PadLayout.isOpen()) openSet(); this.blur(); });

  // ---------- 창 키 (2026-11-07, config keys.stat · skill · enc · menu = C · V · B · Esc) ----------
  //   창이 없을 때 누르면 그 창을 엶, 같은 키를 다시 누르면 닫음. 다른 창 · 전직 화면이 열려 있으면 안 열림(Esc 는 각 창이 먼저 받아 닫음)
  window.addEventListener('keydown', function (e) {
    // 소리 끄기/켜기(2026-11-07 키 설정 「소리」, 기본 M): js/sfx.js 대신 여기서(M 은 js/keys.js 가 sfx.js 로 안 가게 돌려 보냄)
    if (Keys.is('sound', e.code) && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
      var tg = e.target && e.target.tagName;
      if (!((tg === 'INPUT' || tg === 'TEXTAREA') && e.target.id !== 'keysRelay') && window.SFX && SFX.toggle) {
        SFX.toggle(); sndTitle();
        if (!setEl.hidden) setUi();
      }
      return;
    }
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    var K = CFG.keys, c = e.code;
    function is(l) { return !!l && l.indexOf(c) >= 0; }
    var w = is(K.stat) ? 'stat' : is(K.skill) ? 'skill' : is(K.enc) ? 'enc' : is(K.menu) ? 'menu' : null;
    if (!w || (classEl && !classEl.hidden)) return;
    var own = { stat: statEl, skill: skEl, enc: encEl, menu: setEl }[w];
    var open = [statEl, skEl, encEl, upEl, setEl, phHelpEl, document.getElementById('layEd')].filter(function (p) { return p && !p.hidden; })[0];
    if (open) {
      if (open === own) { e.preventDefault(); ({ stat: closeStats, skill: closeSkills, enc: closeEnc, menu: closeSet })[w](); }
      return;
    }
    e.preventDefault();
    ({ stat: openStats, skill: openSkills, enc: openEnc, menu: openSet })[w]();
  });
  // 칸에 회피를 끼웠나(input.js 가 칸 누름을 회피로 바꿈)
  Input.setSlotDodge(function (k) { var bk = Growth.book(G.classKey); return !!bk && bk.at(Skills.slots.indexOf(k)) === 'dodge'; });
  // 화면 갈래가 바뀜(손가락 ↔ 키보드·마우스): 게임 화면 크기 다시(아래 막대만큼) · 폰 버튼 그림 다시 · 도움말 · 기술 창 칸 수
  Input.onMode(function () {
    pcLast = {};
    helpUi();
    window.dispatchEvent(new Event('resize'));
    if (!skEl.hidden) renderSkills();
  });
  helpUi();

  // 마나가 모자라 기술이 안 나감: 머리 위 「MP 부족」(파란 작은 글자) + 그 칸 버튼이 잠깐 흔들림 (skills.js pick 이 부름, 너무 자주는 안 띄움)
  function noMp(slot) {
    var p = G.player;
    FX.damage(p.x, p.y - (p.z || 0) - 118 * AS, 'MP 부족', false, J, null, 'nomp', 'player:nomp');
    Skills.shakeSlot(slot);
  }

  // ---------- 전직 (2026-11-06, 설계안 3번 · config growth.classChangeStage / classChange) ----------
  // 뜨는 때: 판 모드 + 아직 직업 없음(Growth.cls) + 전직 판(2026-11-07 형님: 1판, 예전 2판)을 어느 난이도에서든 깬 저장(이지에서 깬 예전 저장도). 시험 자동 조종(?bot=1)은 안 띄움(멈추지 않게)
  //   → 2단계 보스를 처음 깬 결과 화면 직전 · 이미 깬 저장이면 다음 스테이지 고르기·바로 시작(?stage=N) 때. 고르면 Growth.cls 가 생겨 다시는 안 뜸
  function needClassChange() { return MODE === 'stage' && !G.bot && !Growth.cls && (Growth.clearedAny ? Growth.clearedAny(CFG.growth.classChangeStage) : isCleared(CFG.growth.classChangeStage)); }
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
    list.innerHTML = ''; list.classList.remove('br');
    classTitle('전직', '견습 시절은 끝! 앞으로 함께할 직업을 고르세요. <b>한 번 고르면 바꿀 수 없어요.</b>');   // 같은 화면을 2차 갈래 고르기도 씀(2026-11-08)
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
  // 전직 화면 제목 · 안내(1차 전직 · 2차 갈래 고르기가 같은 화면을 씀)
  function classTitle(t, hint) {
    var h = document.getElementById('classTitle'), c = document.getElementById('classHint');
    if (h) h.textContent = t;
    if (c) c.innerHTML = hint;
  }

  // ---------- 2차 전직 갈래 고르기 (2026-11-08 형님, config classes.<직업>.tier2.branches · growth.js chooseBranch) ----------
  // 뜨는 때: 판 모드 + 갈래가 있는 직업(기사 · 법사) + 2차 Lv(25)이 됨 + 아직 안 고름(Growth.needBranch).
  //   = 판 도중 Lv25 가 된 순간(게임 멈춤) · 결과 화면 직전 · 스테이지 고르기 · 처음 켰을 때(예전 저장이 이미 Lv25 넘음 = 한 번 고르게 함, 고르기 전엔 갈래 a 로 봄)
  //   1차 전직 화면(#classSel)을 그대로 씀: 카드 = 그 갈래 옷(마검사 · 흑마법사 = 그림이 올 때까지 1차 옷 물들임)을 입고 움직이는 모습 + 설명 + 그 갈래 기술 이름
  //   터치 · 마우스(카드 누름) · 키보드(←→ · Enter) · 패드(gamepad.js 의 classSel 창) 모두 1차 전직과 같음. 한 번 고르면 못 바꿈
  //   시험 자동 조종(?bot=1) · 미리보기 액자 · 시험 버튼으로 입은 다른 직업은 안 띄움. ?lv=N 시험은 ?branch=a|b 를 붙이면 고른 것으로 봄
  var branchAfterUp = false;
  function needBranchChoice() { return MODE === 'stage' && !G.bot && !PV && !!Growth.needBranch && Growth.needBranch() && G.classKey === Growth.cls; }
  // 1차 전직 → 2차 갈래 → after 순서로(필요한 것만). 화면을 띄웠으면 true
  function jobGate(after) {
    if (needClassChange()) { openClassChange(function () { jobGate(after); }); return true; }
    if (needBranchChoice()) { openBranchChoice(after); return true; }
    if (needTier3Choice()) { openTier3(after); return true; }   // 3차 전직(2026-11-10)
    if (after) after();
    return false;
  }
  function branchPreview(cv, key) {
    var g = cv.getContext('2d'), c = CFG.classes[G.classKey];
    cv.width = 240; cv.height = 240;
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
  function openBranchChoice(after) {
    var cls = Growth.cls, BR = Growth.branches(cls), T2 = (CFG.classes[cls] || {}).tier2;
    if (!BR || !T2) { if (after) after(); return; }
    if (classEl && !classEl.hidden) return;   // 이미 떠 있음
    var list = document.getElementById('classList'), ok = document.getElementById('btnClassOk'), pick = null, draws = [];
    var wasPaused = G.paused, bk = Growth.book(cls), S = CFG.skills[cls] || {};
    G.paused = true; Input.setOverride(null);
    list.innerHTML = ''; list.classList.add('br');
    classTitle('2차 전직', 'Lv' + T2.lv + ' 달성! 두 길 중 하나를 고르세요. 고른 길의 2차 기술만 배울 수 있어요. <b>한 번 고르면 바꿀 수 없어요.</b>');
    ok.disabled = true; ok.textContent = '길을 골라 주세요';
    BR.forEach(function (q) {
      var names = (CFG.skills.tree[cls] || []).filter(function (e) { return e.branch === q.key; })
        .map(function (e) { return (S[e.id] && S[e.id].name) || e.name || e.id; });
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'ccard'; b.dataset.k = q.key;
      b.innerHTML = '<canvas></canvas><b>' + q.name + '</b><span class="wp">(2차 · ' + ((CFG.classes[cls] || {}).label || '') + ')</span><span class="d">' + (q.desc || '') + '</span>' +
        '<span class="sk">' + names.join(' · ') + '</span>';
      branchPreview(b.querySelector('canvas'), q.outfit + '_' + G.charKey).then(function (d) { if (d) draws.push(d); });
      b.addEventListener('click', function () {
        pick = q;
        list.querySelectorAll('.ccard').forEach(function (x) { x.classList.toggle('on', x === b); });
        ok.disabled = false; ok.textContent = josaRo(q.name) + ' 전직하기 · 바꿀 수 없어요';
      });
      list.appendChild(b);
    });
    ok.onclick = function () {
      if (!pick) return;
      Growth.chooseBranch(pick.key);   // 저장칸에 갈래 저장(한 번만) + 다른 갈래 기술 점수 돌려받음
      wearOutfit();                    // 그 갈래 옷으로
      cancelAnimationFrame(classAnim); classAnim = 0;
      closeMenu(classEl);
      list.classList.remove('br');
      G.paused = wasPaused;
      banner(josaRo(pick.name) + ' 전직했다!', 'small');
      Skills.flash({ color: '#e8d0ff', alpha: 0.45, ms: 420 });
      if (typeof skEl !== 'undefined' && skEl && !skEl.hidden) renderSkills();
      ok.blur();
      if (after) after();
    };
    var lastT = 0;
    (function anim(now) {
      var dt = lastT ? Math.min(100, now - lastT) : 0; lastT = now;
      draws.forEach(function (d) { d(dt); });
      classAnim = requestAnimationFrame(anim);
    })(performance.now());
    openMenu(classEl, list.querySelector('.ccard'));
  }
  G.openBranchChoice = function () { openBranchChoice(null); };

  // ---------- 3차 전직 (2026-11-10, config classes.<직업>.tier2.branches[갈래].tier3 · growth.js needTier3 / doTier3) ----------
  // 뜨는 때: 2차 갈래 고르기와 같음(판 도중 Lv50 이 된 순간 · 결과 화면 직전 · 스테이지 고르기 · 처음 켰을 때). 갈래마다 3차가 하나라 고르는 건 없고
  //   카드 한 장(3차 옷을 입고 움직이는 모습 + 설명 + 3차 기술 이름) + 「전직하기」. 1차 전직 화면(#classSel)을 그대로 씀(터치 · 키보드 · 패드 같음)
  //   시험 자동 조종 · 미리보기 액자는 안 띄움. ?lv=N 시험은 ?t3=1 을 붙이면 한 것으로 봄
  function needTier3Choice() { return MODE === 'stage' && !G.bot && !PV && !!Growth.needTier3 && Growth.needTier3() && G.classKey === Growth.cls; }
  function openTier3(after) {
    var cls = Growth.cls, I = Growth.tier3Info ? Growth.tier3Info(cls) : null;
    if (!I) { if (after) after(); return; }
    if (classEl && !classEl.hidden) return;
    var list = document.getElementById('classList'), ok = document.getElementById('btnClassOk'), draws = [];
    var wasPaused = G.paused, S = CFG.skills[cls] || {};
    G.paused = true; Input.setOverride(null);
    list.innerHTML = ''; list.classList.add('br', 't3');
    classTitle('3차 전직', 'Lv' + I.lv + ' 달성! ' + I.from + '의 길 끝에서 <b>' + I.name + '</b>(으)로 거듭나요. 3차 기술이 열리고, 1 · 2차 기술 이름과 크기도 한 단계 올라가요.');
    var names = (CFG.skills.tree[cls] || []).filter(function (e) { return e.tier === 3 && e.branch === I.key; })
      .map(function (e) { return (S[e.id] && S[e.id].name) || e.name || e.id; });
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'ccard on'; b.dataset.k = 't3';
    b.innerHTML = '<canvas></canvas><b>' + I.name + '</b><span class="wp">(3차 · ' + I.from + ')</span><span class="d">' + (I.desc || '') + '</span>' +
      '<span class="sk">' + names.join(' · ') + '</span>';
    branchPreview(b.querySelector('canvas'), I.outfit + '_' + G.charKey).then(function (d) { if (d) draws.push(d); });
    list.appendChild(b);
    ok.disabled = false; ok.textContent = josaRo(I.name) + ' 전직하기';
    function go() {
      Growth.doTier3();
      wearOutfit();
      cancelAnimationFrame(classAnim); classAnim = 0;
      closeMenu(classEl);
      list.classList.remove('br', 't3');
      G.paused = wasPaused;
      banner(josaRo(I.name) + ' 전직했다!', 'small');
      Skills.flash({ color: '#fff4c0', alpha: 0.6, ms: 520 });
      if (window.SFX) SFX.play('levelUp');
      if (typeof skEl !== 'undefined' && skEl && !skEl.hidden) renderSkills();
      ok.blur();
      if (after) after();
    }
    b.addEventListener('click', go);
    ok.onclick = go;
    var lastT = 0;
    (function anim(now) {
      var dt = lastT ? Math.min(100, now - lastT) : 0; lastT = now;
      draws.forEach(function (d) { d(dt); });
      classAnim = requestAnimationFrame(anim);
    })(performance.now());
    openMenu(classEl, b);
  }
  G.openTier3 = function () { openTier3(null); };
  G.needTier3Choice = function () { return needTier3Choice(); };
  G.needBranchChoice = needBranchChoice;

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
    killAll: function () { G.enemies.forEach(function (e) { if (e.alive()) { if (e.T.boss) { if (e.takeHit(99999, 1, 10, true, e.raid ? { force: true } : null) === 'dead' || !e.raid) onBossDown(e); } else e.takeHit(9999, 1, 10, true, { force: true }); } }); },
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
    // PC 아래 막대 시험(2026-11-07): 화면 갈래 바꾸기('pc' / 'touch') · 칸에 끼우기(i = 0~9, id = 기술 id 또는 'dodge') · 칸 상태
    uiMode: function (m) { if (m) Input.setMode(m); return Input.mode(); },
    put: function (i, id) { var bk = Growth.book(G.classKey), ok = !!(bk && bk.put(i, id)); pcLast = {}; return ok; },
    slots: function () { var bk = Growth.book(G.classKey); return bk ? { pc: bk.slots(true), phone: bk.slots(), bar: bk.bar(true) } : null; },
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
    // 무기 강화 · 속성 시험(2026-11-06): 이번 창에서만(저장된 무기 · 강화석은 그대로). GAME.test.enhance(9, ['fire', 'ice', 'poison']) / enhance(null) = 원래대로
    enhance: function (lv, els) { Growth.testWeapon(G.classKey, lv, els || null); encBadges(); var w = wpn(); return w ? { lv: w.lv(), els: w.els(), test: w.test } : null; },
    enchant: function (els) { Growth.testWeapon(G.classKey, undefined, els || []); var w = wpn(); return w ? { lv: w.lv(), els: w.els() } : null; },
    // 속성 효과 기록 켜기/읽기: GAME.test.elLog(true) → 싸움 → GAME.test.elLog()
    elLog: function (on) { return Enchant.log(on); },
    loot: function () { return { stones: Growth.stones, crys: Growth.crys, got: G.loot, drops: G.lootDrops || 0, ground: Enchant.items.length }; },
    weapon: function () { var w = wpn(), p = G.player; return w ? { cls: w.cls, lv: w.lv(), els: w.els(), art: w.art(), test: w.test, atkMul: w.atkMul(), rate: w.rate(), cost: w.cost(),
      atkSpd: p.atkSpd, reachMul: p.reachMul, castSpd: p.castSpd, cdMul: p.cdMul, mpMul: p.mpMul } : null; },
    // 콤보 자동 조종(균형 시험, 2026-11-06 밤): 공격 때마다 기술 하나를 골라 누름(띄우기 → 공중 타 → 캔슬)
    botEager: function (on) { G.botEager = on !== false; },
    retry: function () { resetStage(); },
    // 던전 시험(2026-11-07): dungeon('mine') = 바로 들어감 / dgTime(초, 사건 건너뛰기) = 시계를 그 초로 / dg() = 지금 상태
    dungeon: function (id) { return goDungeon(id || 'mine').then(function (st) { return !!st; }); },
    dgTime: function (s, skipEv) {
      var R = G.stage.dg, D = DG(); if (!R) return null;
      R.wait = 0; R.t = s * 1000; G.stage.time = R.t;
      if (skipEv) { R.ev = 0; while (R.ev < (D.events || []).length && D.events[R.ev].at <= s) R.ev++; }
      return R.t;
    },
    dg: function () {
      var S = G.stage, R = S && S.dg; if (!R) return null;
      var alive = G.enemies.filter(function (e) { return e.alive(); });
      return { id: CFG.stage.dgId, t: Math.round(R.t), wait: Math.round(R.wait), kills: R.kills, midKills: R.midKills, alive: alive.length, mids: alive.filter(function (e) { return e.mid; }).length,
        maxAlive: R.maxAlive, queue: R.queue.length, end: R.end, result: S.result, bonus: R.bonus, rec: R.rec, best: R.best, stones: G.loot ? G.loot.stones : 0, saved: Growth.stones,
        ground: Enchant.items.length, magnet: Enchant.items.filter(function (f) { return !!f.mag; }).length, width: world.width, LW: LW, camX: Math.round(G.camX), mode: Growth.mode(), open: dgOpen(CFG.stage.dgId),
        types: alive.map(function (e) { return e.type + (e.mid ? '*' : ''); }).join(',') };
    },
    dgQuit: function () { dgQuit(); },
    // 속성 몹 시험(2026-11-07): elSpawn('goblin', 'fire', dx, dy) = 플레이어 앞 dx · 위아래 dy 에 그 속성 몹 / elLog(true) → 싸움 → elLog(false) = 능력 기록 / el() = 상태
    elSpawn: function (type, el, dx, dy) { var p = G.player, e = makeEnemy(type, p.x + (dx || 60), clamp(p.y + (dy || 0), world.laneTop, world.laneBottom), { el: el }); e.entered = true; e.dir = e.x < p.x ? 1 : -1; return G.enemies.length - 1; },
    elLog: function (on) { return ElMob.log(on); },
    el: function () { return ElMob.state(); },
    // 레이드 시험(2026-11-07): raidBoss() = 남은 웨이브 건너뛰고 바로 보스, raid() = 보스 상태(js/raid.js Raid.test.state), raidPat('slam') = 그 공격 바로
    raidBoss: function () { var R = G.stage.dg, D = DG(); if (!R || D.rule !== 'raid') return false; G.enemies.forEach(function (e) { if (e.alive()) { e.noDrop = true; e.dgSkip = true; e.takeHit(9999, 1, 10, true, { force: true }); } }); R.queue = []; R.wait = 0; R.wi = D.waves.length - 1; R.phase = 'rest'; R.restT = 0; return true; },
    raidWave: function (i) { var R = G.stage.dg, D = DG(); if (!R || D.rule !== 'raid') return false; G.enemies.forEach(function (e) { if (e.alive()) { e.noDrop = true; e.dgSkip = true; e.takeHit(9999, 1, 10, true, { force: true }); } }); R.queue = []; R.wait = 0; R.wi = i - 1; R.phase = 'rest'; R.restT = 0; return true; },
    raid: function () { var R = G.stage.dg; var s = Raid.test.state(); if (s && R) { s.phase = R.phase; s.wi = R.wi; s.bossT = Math.round(R.bossT); s.t = Math.round(R.t); s.deadAt = R.deadAt; s.lootN = R.lootN; s.end = R.end; } else if (R) { s = { phase: R.phase, wi: R.wi, wsp: R.wsp, t: Math.round(R.t), kills: R.kills, deadAt: R.deadAt, lootN: R.lootN, end: R.end };
      if (R.boss) { s.hp = R.boss.hp; s.max = R.boss.maxHp; s.champ = R.boss.label; s.bossT = Math.round(R.bossT); s.alive = R.boss.alive(); s.sh = R.boss.elm ? Math.round(R.boss.elm.shT) : 0; } } return s; },
    raidPat: function (n) { Raid.test.pat(n); return true; },
    raidHp: function (k) { Raid.test.hp(k); return true; },
    raidGroggy: function () { Raid.test.groggy(); return true; },
    raidDebug: function (on) { Raid.debug = on !== false; return true; },
    dgOpen: function (id) { return dgOpen(id || 'mine'); },
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

  // ---------- 기술 미리보기 액자 (2026-11-08, 기술 창 「▶ 미리보기」 · index.html window.PV) ----------
  // 기술 창이 이 게임을 작은 액자(iframe) 안에 ?pv=기술 로 한 번 더 띄움 → 진짜 기술 코드 · 효과 · 숫자 그대로, 진짜 게임과는 완전히 따로
  //   (다른 창이라 적 목록 · 효과 · 저장이 안 섞임. 저장은 index.html 이 막음, 경험치 · 떨어지는 것 · 웨이브 · 결과 없음)
  //   쓰는 기술: 플레이어 앞 고블린 허수아비 3~4마리(가만히 서 있음, 안 쓰러짐) → 잠깐 뒤 그 기술 → 끝나고 조금 쉬었다 처음부터(되풀이)
  //   늘 켜진 기술: 저절로 평타로 고블린을 때림. 칼날 파편 · 원소 연쇄 = 약한 고블린(쓰러지며 터짐, 다시 나옴) · 투지 = 체력 25% ·
  //     반격 · 마나 방패 · 강철 피부 = 고블린이 때림(플레이어는 가만히) · 원소 낙인 = 도우미 화염구(PV.help)로 낙인 → 평타
  var pv = null, pvWear = null;
  var PV_FIGHT = { counter: 1, shield: 1, guard: 1 };   // 맞아야 보이는 늘 켜진 기술(passive.stat)
  var PV_KILL = { shards: 1, echain: 1 };               // 쓰러져야 보이는 것
  var PV_BEHIND = { spin: 1, slam: 1, blink: 1 };       // 둘레를 치는 쓰는 기술 = 뒤에도 한 마리
  function pvInfo() {
    var bk = Growth.book(G.classKey), e = bk && bk.entry(PV.id), P = e && e.passive;
    return { e: e, pas: !!P, stat: P ? P.stat : null };
  }
  function pvSpawn(slot, I) {
    var p = G.player, mid = (world.laneTop + world.laneBottom) / 2, lh = world.laneBottom - world.laneTop;
    var e = makeEnemy('goblin', p.x + slot.dx * AS, clamp(mid + slot.k * lh * 0.16, world.laneTop, world.laneBottom), null);
    e.dir = slot.dx < 0 ? 1 : -1; e.entered = true; e.noDrop = true; e.pvSlot = slot;
    if (PV_KILL[I.stat]) {   // 평타 두세 번에 쓰러지는 체력
      var W = CFG.weapons[G.weaponKey], hit = (W.damage[0] + W.damage[1]) / 2 * Growth.atkMul(!!W.magic);
      e.hp = e.maxHp = Math.max(1, Math.round(hit * 2.2));
    } else e.hp = e.maxHp = 999999;   // 허수아비: 안 쓰러짐(띄우기 · 넘어짐 · 숫자는 그대로)
    if (PV_FIGHT[I.stat]) e.dmgMul = 0.35;
    else e.sleep('idle');   // 가만히 서 있음(맞으면 깨지만 pvStep 이 다시 세워 둠)
    return e;
  }
  function pvReset() {
    var I = pvInfo();
    pv = { t: 0, cast: 0, done: 0, press: -1e9, atkT: 0, re: [], I: I };
    FX.list.length = 0; Projectiles.clear(); Skills.clear(); if (window.Enchant) Enchant.reset();
    orbs.length = 0;
    G.enemies = []; G.stage = newStage(); G.ectx = makeEnemyCtx();
    G.mh = newMh(); G.mk = { n: 0, t: 0 }; G.callout = null; G.hitstop = 0; G.slowT = 0; G.zoom = null; G.comboT = 0; G.rage = 0; G.awk = null; G.vig = 0;
    var p = G.player = new Player(CFG);
    applyGrowth(p);
    p.setCharacter(outfitAssets()); p.weaponKey = G.weaponKey; p.setMoveSet(G.moveSet);
    p.x = Math.round(LW * (I.pas ? 0.3 : 0.24)); p.y = Math.round((world.laneTop + world.laneBottom) / 2); p.dir = 1;
    if (PV.id === 'darkorb') p.x = Math.round(LW * 0.06);   // 2026-11-09: 어둠의 구체는 멀리(220) 가서 터짐 → 왼쪽 끝에서 쏴야 터짐이 액자 안에 보임
    p.god = !PV_FIGHT[I.stat];
    if (I.stat === 'regen' || I.stat === 'leech') p.hp = Math.round(p.maxHp * 0.5);   // 신성 가호 · 생명 흡수(2026-11-08): 체력이 차는 중
    G.camX = 0;
    Input.setOverride({ x: 0, y: 0 });
    var slots = I.pas ? [{ dx: 46, k: 0.05 }, { dx: 92, k: -0.65 }, { dx: 132, k: 0.6 }, { dx: 172, k: -0.15 }]
                      : [{ dx: 62, k: 0.1 }, { dx: 116, k: -0.6 }, { dx: 172, k: 0.55 }];
    if (!I.pas && PV_BEHIND[PV.id]) slots.push({ dx: -66, k: -0.2 });
    slots.forEach(function (sl) { pvSpawn(sl, I); });
  }
  // 쓰러진 고블린: 「펑」만(경험치 · 물약 · 강화석 없음) → 1.1초 뒤 그 자리에 다시
  function pvKills() {
    G.enemies.forEach(function (e) {
      if (e.alive() || e.xpDone) return;
      e.xpDone = true; snd('pop');
      if (pv && e.pvSlot) pv.re.push({ at: pv.t + 1100, slot: e.pvSlot });
    });
  }
  // 늘 켜진 기술 자동 조종: 가장 가까운 고블린에게 다가가 평타(맞아야 보이는 기술 = 가만히)
  function pvBot(p) {
    var best = null, bd = 1e9;
    G.enemies.forEach(function (e) { if (!e.alive()) return; var d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y) * 2; if (d < bd) { bd = d; best = e; } });
    if (!best) { Input.setOverride({ x: 0, y: 0 }); return; }
    var W = CFG.weapons[G.weaponKey], reach = (W.magic ? 120 : 44) * AS, dx = best.x - p.x, dy = best.y - p.y;
    var mx = Math.abs(dx) > reach ? Math.sign(dx) : 0, my = Math.abs(dy) > 5 * AS ? Math.sign(dy) * 0.9 : 0;
    Input.setOverride({ x: mx, y: my });
    if ((p.state === 'idle' || p.state === 'walk') && !mx && Math.abs(dx) > 2) p.dir = dx > 0 ? 1 : -1;
    if (!mx && Math.abs(dy) < 9 * AS && pv.t - pv.atkT > 130) { pv.atkT = pv.t; Input.pressAttack(); }
  }
  // 날렵한 몸놀림 미리보기: 한쪽으로 회피 연달아(남은 수만큼) → 다 차면 반대쪽으로. 오른쪽 끝 · 왼쪽 끝에 가까우면 방향을 바꿈
  function pvDodge(p) {
    if (pv.dir == null) pv.dir = 1;
    var DI = p.dodgeInfo();
    if (p.state === 'dodge') { Input.setOverride({ x: pv.dir, y: 0 }); return; }
    if (DI.n <= 0) { pv.wait = true; Input.setOverride({ x: 0, y: 0 }); return; }
    if (pv.wait && DI.n >= DI.max) { pv.wait = false; pv.dir = -pv.dir; }
    if (pv.wait || pv.t < 500 || pv.t - pv.press < 120) { Input.setOverride({ x: 0, y: 0 }); return; }
    pv.press = pv.t; Input.setOverride({ x: pv.dir, y: 0 }); Input.pressDodge();
  }
  function pvStep(dt) {
    if (!pv) return;
    var p = G.player, I = pv.I;
    pv.t += dt;
    p.maxMp = Math.max(p.maxMp, 200); p.mp = p.maxMp;   // 마나 걱정 없이
    G.rage = 0; if (CFG.fullness) G.full = CFG.fullness.max;
    if (p.state === 'dead') { pvReset(); return; }
    if (PV_FIGHT[I.stat] && p.hp < p.maxHp * 0.4) p.hp = p.maxHp;
    if (I.stat === 'grit') p.hp = Math.round(p.maxHp * 0.25);   // 투지: 체력이 적어야 보임
    // 맞아야 보이는 기술이 아니면 고블린은 늘 가만히(맞고 일어나면 다시 세움)
    if (!PV_FIGHT[I.stat]) G.enemies.forEach(function (e) { if (e.alive() && !e.atk && (e.state === 'idle' || e.state === 'walk')) e.asleep = true; });
    pv.re = pv.re.filter(function (q) {
      if (pv.t < q.at) return true;
      var e = pvSpawn(q.slot, I);
      if (G.assets.dust && G.assets.dust.length) FX.sprite(e.x, e.y, G.assets.dust, CFG.dust.fps, CFG.dust.pivot, false, true);
      return false;
    });
    if (!I.pas) {
      // 쓰는 기술: 0.42초 뒤 1번 칸(= 그 기술) → 끝나고 1.7초 뒤 처음부터
      if (!pv.cast) {
        if (p.state === 'skill') pv.cast = pv.t;
        else if (pv.t >= 420 && pv.t - pv.press > 500) { pv.press = pv.t; Input.pressSkill('A'); }
      } else if (!pv.done && p.state !== 'skill' && pv.t - pv.cast > 500) pv.done = pv.t;
      if ((pv.done && pv.t - pv.done > 1700 && !(Skills.busy && Skills.busy())) || pv.t > 9000) pvReset();   // 2026-11-09: 어둠의 구체처럼 늦게 터지는 효과는 터질 때까지 기다림
      return;
    }
    // 늘 켜진 기술: 원소 낙인 = 처음에 도우미 화염구 → 평타. 6.5초마다 처음부터
    if (PV.help && !pv.cast) {
      if (p.state === 'skill') pv.cast = pv.t;
      else if (pv.t >= 380 && pv.t - pv.press > 500) { pv.press = pv.t; Input.pressSkill('A'); }
      if (!pv.cast) return;
    }
    if (I.stat === 'nimble') { pvDodge(p); if (pv.t > 6500) pvReset(); return; }   // 날렵한 몸놀림(2026-11-08): 회피 두 번씩 좌우로
    if (PV_FIGHT[I.stat]) Input.setOverride({ x: 0, y: 0 });
    else if (p.state !== 'skill') pvBot(p);
    if (pv.t > 6500) pvReset();
  }
  function pvBoot() {
    Input.setMode('pc');   // 액자 안은 PC 화면 갈래(폰 버튼 · 위아래 여백 없음). 버튼은 css(html.pvmode)가 다 숨김
    hudEl.hidden = true;
    resize();
    pvReset();
    function ready() {
      pvReset();
      try { window.parent.postMessage({ pv: 'ready', id: PV.id }, location.origin); } catch (e) {}
    }
    (pvWear || Promise.resolve()).then(ready, ready);
  }

  // ---------- 테스트 맵(2026-11-10, 형님: 기술 · 움직임 시험장) ----------
  //   1판 숲길 첫 구간 배경 + 몹 5마리가 흩어져 제자리에 서 있음: 안 걷고 · 안 때리고(asleep + 공격 쿨 + 피해 0) · 절대 안 쓰러짐(체력 999999, 절반 밑이면 다시 참).
  //   맞는 동작 · 밀림 · 띄우기 · 넘어짐 · 상태 이상 · 데미지 숫자는 그대로. 밀려나면 0.7초 뒤 제자리로 미끄러져 돌아옴. 판 클리어 · 시간 제한 없음(나가기 = 판 가기 · 스테이지 고르기)
  var TRAIN_SPOTS = [{ dx: 110, k: 0.5 }, { dx: 180, k: 0.12 }, { dx: 195, k: 0.88 }, { dx: 265, k: 0.35 }, { dx: 310, k: 0.75 }];
  function trainSpawnOne(i) {
    var T = G.train, sp = TRAIN_SPOTS[i], x = Math.round(90 + sp.dx), y = Math.round(world.laneTop + sp.k * (world.laneBottom - world.laneTop));
    var e = makeEnemy(T.type, x, y, null);
    e.hp = e.maxHp = 999999; e.dmgMul = 0; e.noDrop = true; e.entered = true; e.dir = -1;
    e.tpHome = { x: x, y: y }; e.tpSlot = i; e.label = '테스트 ' + (e.label || '');
    e.sleep('idle');
    return e;
  }
  function trainReset() {
    G.enemies.forEach(function (e) { e.remove = true; });
    G.enemies = G.enemies.filter(function (e) { return !e.remove; });
    for (var i = 0; i < TRAIN_SPOTS.length; i++) trainSpawnOne(i);
    G.train.spawned = true;
  }
  function trainStep(dt) {
    var T = G.train, p = G.player; T.t += dt;
    G.stage.camMin = 0; G.stage.boss = null; G.stage.mid = null;
    if (!T.spawned) trainReset();
    G.enemies.forEach(function (e) {
      if (!e.tpHome) return;
      if (!e.alive()) { if (!e.tpRe) e.tpRe = T.t + 900; else if (T.t > e.tpRe && !e.tpDone) { e.tpDone = true; e.remove = true; trainSpawnOne(e.tpSlot); } return; }
      e.cool = Math.max(e.cool || 0, 3000); e.dmgMul = 0;
      if (e.hp < e.maxHp * 0.5) e.hp = e.maxHp;
      var free = (e.state === 'idle' || e.state === 'walk') && !(e.az > 0);
      if (!free) { e.tpIdle = 0; return; }
      if (!e.asleep) { e.sleep('idle'); e.alertT = 0; }
      e.tpIdle = (e.tpIdle || 0) + dt;
      var dx = e.tpHome.x - e.x, dy = e.tpHome.y - e.y;
      if (e.tpIdle > 700 && (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)) { var k = Math.min(1, dt / 220); e.x += dx * k; e.y += dy * k; }
      if (p && Math.abs(p.x - e.x) > 4) e.dir = p.x > e.x ? 1 : -1;
    });
  }
  function goTrain(type) {
    if (MODE !== 'stage') return Promise.resolve();
    type = type && CFG.enemies[type] && !CFG.enemies[type].boss ? type : 'goblin';
    tpCloseAll(); G.paused = false;
    var st0 = STAGES[0];
    loading(true);
    return Promise.all([Assets.ensureBg(st0.bg), Assets.ensureEnemies([type])]).then(function (r) {
      loading(false);
      G.assets.bg = r[0];
      useStage(1);
      CFG.stage = Object.assign({}, st0, { waves: [], props: [], train: true, name: '테스트 맵' }); CFG.bg = CFG.stage.bg;
      applyStageWorld();
      G.train = { type: type, t: 0, spawned: false };
      resetStage(true);
      G.train = { type: type, t: 0, spawned: false };
      banner('테스트 맵', 'title');
    });
  }

  // ---------- 테스트 모드 도구(2026-11-10, config testPanel · js/testpanel.js 가 씀) ----------
  //   go(n) = 목록 n 번째 판으로 바로 · spawn(n, 무엇) = 그 판에서 다른 적을 치우고 그 적 하나(무엇 = 적 종류 · 'mid' 중간보스 · 'boss' 보스)
  function tpCloseAll() {
    [selEl, resultEl].forEach(function (el) { if (el && !el.hidden) closeMenu(el); });
    if (setEl && !setEl.hidden) { keyWait = null; closeMenu(setEl); setBack = null; }
  }
  function tpBoss(st) { var b = null; (st.waves || []).forEach(function (w) { (w.spawn || []).concat(w.placed || []).forEach(function (q) { var E = CFG.enemies[q[0]]; if (E && E.boss) b = q[0]; }); }); return b; }
  if (CFG.testPanel && !CFG.demo && !PV) G.testApi = {
    stages: STAGES, mode: function () { return MODE; },
    stageNo: function () { return G.stageNo; },
    go: function (n) { if (MODE !== 'stage') return Promise.resolve(); tpCloseAll(); G.paused = false; return goStage(n); },
    enemiesOf: function (n) { return stageEnemies(STAGES[n - 1]).filter(function (t) { var E = CFG.enemies[t]; return E && !E.boss; }); },
    hasMid: function (n) { return !!midOf(STAGES[n - 1]); },
    midName: function (n) { var M = midOf(STAGES[n - 1]); return M ? M.T.label : ''; },
    bossOf: function (n) { return tpBoss(STAGES[n - 1]); },
    spawn: function (n, what) {
      if (MODE !== 'stage') return Promise.resolve(null);
      tpCloseAll(); G.paused = false;
      var pr = G.stageNo === n && !CFG.stage.dg && G.stage ? Promise.resolve() : goStage(n);
      return pr.then(function () {
        var st = CFG.stage, type = what, opt = null;
        if (what === 'mid') { var MQ = midOf(st); if (!MQ) return null; type = MQ.type; opt = { mid: true }; }
        else if (what === 'boss') type = tpBoss(st);
        if (!type || !CFG.enemies[type]) return null;
        return Assets.ensureEnemies([type]).then(function () {
          G.enemies.forEach(function (e) { e.noDrop = true; e.remove = true; });
          G.stage.boss = null; G.stage.mid = null;
          if (what === 'boss' || what === 'mid') bakeStageVariants();
          var e = spawnEnemy(type, 'R', opt, 0);
          e.tpView = true;
          return e;
        });
      });
    },
    train: function (type) { return goTrain(type); }, inTrain: function () { return !!G.train; }, trainType: function () { return G.train ? G.train.type : null; },
    trainReset: function () { if (G.train) { tpCloseAll(); G.paused = false; trainReset(); } },
    select: function () { if (MODE !== 'stage') return; tpCloseAll(); openStageSelect(); },
    setChar: function (k) { return setChar(k); }, charKey: function () { return G.charKey; },
    setGod: function (on) { if (G.player) G.player.god = !!on; }, setOneHit: function (on) { G.oneHit = !!on; }
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
  // 시험(2026-11-09): ?cls=archer&lv=10 = 이번 창에서만 그 직업으로 전직한 저장처럼(기술 점수는 botPlan 순서로, ?branch=a|b 갈래). ?lv 가 있어야 됨(저장 안 함)
  var urlCls = !PV && !CFG.demo ? params.get('cls') : null;
  if (urlCls && CFG.classes[urlCls] && urlCls !== 'novice' && params.get('lv')) Growth.testSetup(urlCls, 7);
  G.classKey = Growth.cls || CFG.defaultClass || 'novice';
  if (PV) { G.classKey = PV.cls; G.charKey = PV.chr; }   // 미리보기 액자: 기술 창이 넘긴 직업 · 성별(그 옷부터 불러옴)
  var firstChars = CFG.artSet === 'novice' ? Object.keys(CFG.art.characters) : [outfitKey()];
  if (loadEl) {
    var lbar = loadEl.querySelector('i');
    Assets.progress.onChange = function (got, want) { if (lbar) lbar.style.width = Math.round(100 * got / Math.max(1, want)) + '%'; };
  }
  // 적 그림은 지금 판에 나오는 것만(다른 판 적은 그 판을 고를 때 goStage 가). 연습장은 적 없음
  Assets.loadAll(CFG, firstChars, MODE === 'stage' ? (PV ? ['goblin'] : stageEnemies(CFG.stage)) : []).then(function (assets) {
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
      areaMul: function (d) { var A = huntPart('aoe'); return ((A && A[d.id]) || 1) * wArea(); },   // x 무기 강화 +10 범위(2026-11-06)   // 사냥 손맛: 넓은 범위(회전베기·대지 내려찍기·메테오·불기둥)
      onCast: onCast         // 기술을 씀 → 포만감이 조금 더 줆(2026-11-06 밤)
    });
    // 속성 몹(2026-11-07, js/elmobs.js): 효과 그림 불러오기 + 쓰는 도구
    if (window.ElMob) ElMob.init({
      G: function () { return G; }, snd: snd, push: pushPlayer, hit: onPlayerHit,
      dmgText: function (p, n, col) { FX.damage(p.x, p.y - (p.z || 0) - 112 * AS, n, false, J, col, null, 'player'); },
      debris: function (x, y, z, n, o) { if (Skills.debris) Skills.debris(x, y, z, n, o); }
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
    if (PV) { setChar(PV.chr); pvWear = setClass(PV.cls); }
    else { setChar((Growth.tp && Growth.tp.chr) || 'male'); setClass(Growth.cls || CFG.defaultClass || 'novice'); }   // 테스트 모드 성별(Growth.tp.chr)
    if (PV) pvBoot();
    else if (MODE === 'stage') {
      hudEl.hidden = false;
      // 처음: 고르기 화면(뒤에 그 판이 멈춰 보임). ?stage=N 이나 ?bot=1 이면 바로 시작
      var pick = !urlStage && !G.bot;
      resetStage(pick);
      document.getElementById('btnRetry').addEventListener('click', function () { closeMenu(resultEl); G.keepRun = true; resetStage(); this.blur(); });
      document.getElementById('btnNext').addEventListener('click', function () { closeMenu(resultEl); G.keepRun = true; goStage(G.stageNo + 1); this.blur(); });
      document.getElementById('btnSel').addEventListener('click', function () { openStageSelect(CFG.stage.dg ? 'dungeon' : 'stage'); this.blur(); });
      if (params.get('god') === '1' && !CFG.demo) G.player.god = true;
      if (Growth.tp && Growth.tp.god) G.player.god = true;   // 테스트 모드 무적 · 한 방(js/testpanel.js)
      G.oneHit = !!(Growth.tp && Growth.tp.oneHit);
      var urlDg = params.get('dg');
      if (urlDg && CFG.dungeons && CFG.dungeons[urlDg] && (!CFG.demo || dgOpen(urlDg))) goDungeon(urlDg);   // 던전 바로 시작(2026-11-07, ?dg=mine)
      else if (pick) openStageSelect();
      else jobGate(null);   // ?stage=N 으로 바로 시작했는데 전직 안 한 저장(2단계 깸) · 2차 갈래를 안 고른 저장(2026-11-08)
    }
    modeLink();
    bindToggles();
    Input.init(CFG);
    if (DEBUG && window.Debug) Debug.init(G);
    document.body.classList.add('ready');
    if (loadEl) { loadEl.hidden = true; Assets.progress.onChange = null; }
    if (!PV) setTimeout(function () { Assets.loadRest(); }, 800);   // 나머지 옷 그림은 뒤에서 하나씩
    requestAnimationFrame(frame);
  });
  window.addEventListener('resize', function () { if (G.player) resize(); });
})();
