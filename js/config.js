// =====================================================================
//  설정 한 곳 (config.js)
//  - 그림 경로(art), 손맛 수치(juice), 무기·콤보 수치, 조작 키 전부 여기.
//  - 새 그림이 오면 art 부분 경로만 바꾸면 된다.
// =====================================================================
(function () {
  // 'assets/chars/novice/attack_' + 5 → [..._01.png ... _05.png]
  function seq(prefix, n, ext) {
    var a = [];
    for (var i = 1; i <= n; i++) a.push(prefix + (i < 10 ? '0' : '') + i + (ext || '.png'));
    return a;
  }

  // 지금 쓰는 임시 그림: 견습 모험가(칼이 그림에 박혀 있음)
  var NOVICE = {
    frameW: 176, frameH: 136,
    pivot: { x: 58, y: 131 },          // 발바닥 가운데 (그림 안 좌표)
    bakedWeapon: true,                  // true = 칼이 그림에 박혀 있음 → 무기 따로 안 그림
    anchors: null,                      // 손 위치 json 경로 (빈손 캐릭터가 오면 채움)
    anims: {
      idle:   { frames: seq('assets/chars/novice/idle_', 4),   fps: 6,  loop: true },
      walk:   { frames: seq('assets/chars/novice/walk_', 8),   fps: 12, loop: true },
      attack: { frames: seq('assets/chars/novice/attack_', 5), fps: 14, loop: false },
      hurt:   { frames: seq('assets/chars/novice/hurt_', 3),   fps: 10, loop: false }
    }
  };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ---------- 캐릭터별 3타 콤보 ----------
  // anim = 쓸 그림 묶음, f = 그 묶음의 몇 번째 장(0부터) 순서, d = 각 장의 시간(ms)
  // active = 판정 나는 장(f 순서 기준), cancel = 다음 타로 넘어갈 수 있는 장, lunge = 판정 시작 때 앞으로 내딛는 도트
  // endAdvance = 동작이 끝날 때 몸 위치를 앞으로 옮기는 도트(그림 속에서 앞으로 나간 만큼 → 서기 그림으로 돌아갈 때 뒤로 튀지 않게)
  // reach = 판정 상자(발 기준, 오른쪽 볼 때). 없으면 player.hitbox
  // dmg/hitstop/knock/shake = 배율(무기 배율과 곱함), finisher = 마무리 타(크게)
  // fx = 베기 효과: type 'slash'(초승달 그림) / 'thrust'(짧은 직선), x,y = 발 기준 위치, rot = 돌리기(도, 시계방향 +),
  //      sx,sy = 크기 배율, flipY = 위아래 뒤집기(아래→위로 올려 베기), len = 찌르기 길이
  var MOVES = {
    // 남자: 힘 있는 검술. 1타 대각선 내려베기 → 2타 아래에서 위로 되받아 베기 → 3타 크게 들어 내리찍기
    male: {
      stride: 112, attack1Prefix: 'attack_', attack1Count: 5, attack2Count: 5, attack3Count: 6,
      combo: [
        { anim: 'attack1', f: [0, 1, 2, 3, 4], d: [40, 70, 35, 90, 90], active: [2, 3], cancel: 3, lunge: 4,
          reach: { x0: 8, x1: 92, yTop: -100, yBot: -18 },
          dmg: 1.0, hitstop: 1.0, knock: 1.0, shake: 1.0,
          fx: { type: 'slash', x: 40, y: -60 }, arc: { from: -100, to: 40, r: 46, w: 9 } },
        { anim: 'attack2', f: [0, 1, 2, 3, 4], d: [40, 60, 40, 100, 90], active: [2, 3], cancel: 4, lunge: 6,
          reach: { x0: 8, x1: 94, yTop: -112, yBot: -30 },
          dmg: 1.15, hitstop: 1.1, knock: 1.3, shake: 1.1,
          fx: { type: 'slash', x: 42, y: -66, flipY: true, rot: -15 }, arc: { from: 60, to: -80, r: 50, w: 8 } },
        { anim: 'attack3', f: [0, 1, 2, 3, 4, 5], d: [50, 90, 70, 40, 150, 120], active: [4, 4], cancel: 99, lunge: 4, endAdvance: 22,
          reach: { x0: 10, x1: 104, yTop: -110, yBot: -4 },
          dmg: 1.8, hitstop: 1.9, knock: 2.6, shake: 2.4, finisher: true,
          fx: { type: 'slash', x: 52, y: -52, sx: 1.35, sy: 1.35 }, arc: { from: -130, to: 70, r: 58, w: 12 } }
      ]
    },
    // 여자: 빠르고 가볍고 우아한 검술. 1타 앞으로 찌르기 → 2타 한 바퀴 돌며 가로 베기 → 3타 낮게 파고들며 X자 베기(두 번 판정)
    female: {
      stride: 96, attack1Prefix: 'attack1_', attack1Count: 4, attack2Count: 5, attack3Count: 6,
      combo: [
        { anim: 'attack1', f: [0, 1, 2, 3], d: [45, 40, 80, 70], active: [1, 2], cancel: 3, lunge: 6,
          reach: { x0: 20, x1: 108, yTop: -82, yBot: -44 },
          dmg: 0.9, hitstop: 0.8, knock: 0.8, shake: 0.7,
          fx: { type: 'thrust', x: 66, y: -65, len: 46 }, arc: { from: -10, to: 10, r: 50, w: 6 } },
        { anim: 'attack2', f: [0, 1, 2, 3, 4], d: [40, 45, 35, 70, 80], active: [2, 3], cancel: 4, lunge: 5,
          reach: { x0: -20, x1: 100, yTop: -96, yBot: -40 },
          dmg: 1.05, hitstop: 1.0, knock: 1.1, shake: 1.0,
          fx: { type: 'slash', x: 40, y: -72, rot: 90, sx: 0.6, sy: 1.15 }, arc: { from: -20, to: 20, r: 50, w: 8 } },
        // 3타 = 낮게 파고들며 X자 베기: 장 0 파고들기 → 장 1 대각선 내려베기(1번째 판정, 가볍게)
        //   → 장 2 아래로 감기 → 장 3 반대 대각선 올려베기(2번째 판정 = 마무리, 가장 셈) → 장 4·5 칼 앞으로 뻗은 마무리 자세
        //   hits = 한 타 안에서 두 번 판정(각각 위 값들을 덮어씀). 그림 속에서 이미 앞으로 파고드므로 lunge 는 작게(합 7도트)
        { anim: 'attack3', f: [0, 1, 2, 3, 4, 5], d: [55, 50, 45, 50, 150, 120], cancel: 99,
          reach: { x0: 10, x1: 98, yTop: -100, yBot: -10 },
          hits: [
            { active: [1, 1], lunge: 4, dmg: 0.7, hitstop: 0.9, knock: 0.5, shake: 0.9,
              fx: { type: 'slash', x: 42, y: -62, rot: -70, sx: 0.95, sy: 1.05 }, arc: { from: -120, to: 30, r: 50, w: 9 } },
            { active: [3, 3], lunge: 3, dmg: 1.6, hitstop: 1.9, knock: 2.4, shake: 2.3, finisher: true,
              reach: { x0: 10, x1: 100, yTop: -112, yBot: -10 },
              fx: { type: 'slash', x: 46, y: -66, rot: 20, sx: 1.25, sy: 1.25 }, arc: { from: 60, to: -100, r: 56, w: 11 } }
          ] }
      ]
    }
  };

  // ---------- 견습(맨손) 3타 콤보 (전직 전) ----------
  // 그림 묶음 fist1/fist2/fist3. 칼보다 판정이 짧고(reach) 데미지가 약간 낮다(무기 'fist' 배율).
  // fx: type 'none' = 궤적 없음(주먹), 'whoosh' = 베기 그림을 흐리게(alpha) 납작하게 써서 발차기 바람 소리 느낌
  // hitY = 불똥이 터지는 높이(발 기준, 주먹·발이 닿는 곳), spark = 불똥 그림 크기 배율
  // 그림 속에서 이미 앞으로 디딘 동작(발차기·무릎)은 endAdvance 로 끝날 때 몸 위치를 옮긴다
  var FIST = {
    // 남자: 힘 있는 막싸움. 1타 잽 → 2타 몸통 훅 → 3타 돌려차기(가까우면 무릎+발차기 2번, 마무리)
    male: [
      { anim: 'fist1', f: [0, 1, 2, 3], d: [35, 40, 80, 70], active: [1, 2], cancel: 3, lunge: 3,
        reach: { x0: 10, x1: 62, yTop: -92, yBot: -56 },
        dmg: 1.0, hitstop: 0.8, knock: 0.7, shake: 0.7, hitY: -75, spark: 0.6,
        fx: { type: 'none' }, arc: { from: -10, to: 10, r: 30, w: 4 } },
      { anim: 'fist2', f: [0, 1, 2, 3, 4], d: [40, 55, 40, 90, 80], active: [2, 3], cancel: 4, lunge: 5,
        reach: { x0: 10, x1: 58, yTop: -80, yBot: -36 },
        dmg: 1.2, hitstop: 1.1, knock: 1.2, shake: 1.1, hitY: -58, spark: 0.75,
        fx: { type: 'none' }, arc: { from: -10, to: 10, r: 30, w: 4 } },
      // 3타 = 돌려차기. 허수아비가 가까우면 무릎을 끌어올리는 장(1·2)에서 무릎이 먼저 한 번 맞고(짧은 판정, 약하게)
      //   → 장 3·4 발차기(마무리, 가장 셈). 멀면 무릎은 안 닿고 발차기만 맞는다.
      { anim: 'fist3', f: [0, 1, 2, 3, 4, 5], d: [50, 50, 50, 130, 80, 110], cancel: 99, endAdvance: 15,
        reach: { x0: 16, x1: 78, yTop: -100, yBot: -50 },
        fx: { type: 'whoosh', x: 50, y: -80, rot: 0, sx: 0.85, sy: 0.55, alpha: 0.45 }, arc: { from: -60, to: 30, r: 46, w: 6 },
        hits: [
          { active: [1, 2], lunge: 0, reach: { x0: 4, x1: 42, yTop: -84, yBot: -40 },
            dmg: 0.6, hitstop: 0.8, knock: 0.3, shake: 0.7, hitY: -62, spark: 0.6, fx: { type: 'none' } },
          { active: [3, 4], lunge: 2,
            dmg: 1.8, hitstop: 1.9, knock: 2.6, shake: 2.3, finisher: true, hitY: -80, spark: 1.0 }
        ] }
    ],
    // 여자: 빠르고 우아한 무술. 1타 손바닥 치기 → 2타 돌려차기 → 3타 내려찍기(axe kick, 마무리), 땅에서만
    female: [
      { anim: 'fist1', f: [0, 1, 2, 3], d: [30, 35, 75, 60], active: [1, 2], cancel: 3, lunge: 5,
        reach: { x0: 10, x1: 56, yTop: -90, yBot: -58 },
        dmg: 0.9, hitstop: 0.75, knock: 0.8, shake: 0.6, hitY: -74, spark: 0.6,
        fx: { type: 'none' }, arc: { from: -10, to: 10, r: 30, w: 4 } },
      { anim: 'fist2', f: [0, 1, 2, 3, 4], d: [35, 40, 110, 50, 70], active: [2, 2], cancel: 3, lunge: 4,
        reach: { x0: 10, x1: 72, yTop: -86, yBot: -48 },
        dmg: 1.1, hitstop: 1.1, knock: 1.4, shake: 1.1, hitY: -67, spark: 0.8,
        fx: { type: 'whoosh', x: 46, y: -68, rot: 0, sx: 0.75, sy: 0.45, alpha: 0.4 }, arc: { from: -40, to: 20, r: 40, w: 5 } },
      // 3타 = 내려찍기(발뒤꿈치 떨어뜨리기, axe kick): 장 0 내딛기 → 장 1 다리 곧게 차올림 → 장 2 머리 위 꼭대기
      //   → 장 3 뒤꿈치 내려찍기(판정, 마무리) → 장 4 찬 발을 앞에 내려 디딤. 그림 속에서 한 걸음(37도트) 나가므로 endAdvance 37
      { anim: 'fist3', f: [0, 1, 2, 3, 4], d: [40, 40, 70, 130, 100], active: [3, 3], cancel: 99, lunge: 0, endAdvance: 37,
        reach: { x0: 10, x1: 66, yTop: -100, yBot: -12 },
        dmg: 1.7, hitstop: 2.0, knock: 2.5, shake: 2.3, finisher: true, hitY: -50, spark: 1.0,
        fx: { type: 'whoosh', x: 52, y: -62, rot: 90, sx: 0.7, sy: 0.5, alpha: 0.4 }, arc: { from: -90, to: 30, r: 40, w: 5 } }
    ]
  };

  // 새 그림(art\stage1): 빈손 남/여 + 손 위치 json → 무기를 코드로 손에 붙인다
  // 콤보 3타는 캐릭터마다 자기 그림(attack1/attack2/attack3)과 자기 수치를 쓴다 (위 MOVES)
  // 직업(견습/기사)에 따라 콤보 묶음이 바뀐다: combos.fist = 맨손(FIST), combos.sword = 검(MOVES)
  function stage1(who, anchors) {
    var p = 'assets/chars/stage1/' + who + '/';
    var M = MOVES[who];
    return {
      label: who === 'male' ? '남' : '여',
      frameW: 176, frameH: 136,
      pivot: { x: 68, y: 130 },
      bakedWeapon: false,
      anchors: anchors,
      anims: {
        idle:    { frames: seq(p + 'idle_', 4),   fps: 6,  loop: true },
        // 걷기: 시간 대신 「걸은 거리」로 그림을 넘긴다. stride = 8장 한 바퀴(두 걸음) 동안 가는 도트 수.
        //   그림 속 보폭에 맞춘 값이라 발이 바닥에서 미끄러지지 않는다. 캐릭터마다 보폭이 달라 MOVES 에 따로 둔다
        //   (남 112, 여 96 → 좌우 90도트/초에서 약 6.4 / 7.5장/초).
        //   depthStrideMul = 위아래(안쪽) 이동일 때 거리를 이만큼 크게 쳐서, 느린 위아래 이동에도 다리가 자연스럽게 움직이게.
        walk:    { frames: seq(p + 'walk_', 8),   fps: 12, loop: true, stride: M.stride, depthStrideMul: 1.6 },
        attack1: { frames: seq(p + M.attack1Prefix, M.attack1Count), fps: 14, loop: false },
        attack2: { frames: seq(p + 'attack2_', M.attack2Count), fps: 14, loop: false },
        attack3: { frames: seq(p + 'attack3_', M.attack3Count), fps: 14, loop: false },
        hurt:    { frames: seq(p + 'hurt_', 3),   fps: 10, loop: false },
        fist1:   { frames: seq(p + 'fist1_', 4),  fps: 14, loop: false },
        fist2:   { frames: seq(p + 'fist2_', 5),  fps: 14, loop: false },
        fist3:   { frames: seq(p + 'fist3_', who === 'male' ? 6 : 5), fps: 14, loop: false }
      },
      combo: M.combo,
      combos: { sword: M.combo, fist: FIST[who] }
    };
  }

  // 어떤 그림 묶음을 쓸지: 기본 stage1, 주소 뒤에 ?art=novice 를 붙이면 예전 견습(칼 박힌 그림)
  var artSet = /[?&]art=novice/.test(location.search) ? 'novice' : 'stage1';
  var male, female;
  if (artSet === 'novice') {
    male = clone(NOVICE);   male.label = '남';
    female = clone(NOVICE); female.label = '여';
    female.placeholderFilter = 'hue-rotate(290deg) saturate(1.3)'; // 여자 그림 없을 때 임시 색 바꾸기
  } else {
    male = stage1('male', 'assets/chars/stage1/anchors_male.json');
    female = stage1('female', 'assets/chars/stage1/anchors_female.json');
  }

  window.CFG = {
    version: 'stage1-proto-1',
    artSet: artSet,

    // ---------- 화면 ----------
    view: {
      targetH: 240,        // 논리 화면 높이 목표(도트 기준). 실제 배율은 정수로만
      bg: '#14121c'
    },

    // ---------- 무대 ----------
    world: {
      width: 960,
      floorTopRatio: 0.60,  // 화면 높이의 이 비율부터 바닥(걸을 수 있는 띠)
      floorBottomPad: 8
    },

    // ---------- 그림 경로 (교체는 여기서만) ----------
    art: {
      characters: { male: male, female: female },
      // 무기 그림: img = 경로, grip = 손잡이 점(그림 안 좌표), baseAngle = 그림이 원래 향한 방향(도)
      weapons: {
        sword: { label: '검',   img: 'assets/weapons/sword.png', grip: { x: 8, y: 4 },  baseAngle: 0, layer: 'back' },
        axe:   { label: '도끼', img: 'assets/weapons/axe.png',   grip: { x: 9, y: 4 },  baseAngle: 0, layer: 'back' }
      },
      // 허수아비: 없으면(null) 코드로 그린 나무 기둥. hit 그림은 「왼쪽에서 맞음」 기준, 오른쪽에서 맞으면 뒤집어 씀
      dummy: artSet === 'novice' ? null : {
        idle: ['assets/dummy/dummy_idle_01.png'],
        hit: ['assets/dummy/dummy_hit_01.png', 'assets/dummy/dummy_hit_02.png'],
        pivot: { x: 40, y: 110 }, fps: 9
      },
      // 효과 그림: 없으면(null) 코드로 그린 궤적·불똥
      fx: artSet === 'novice' ? null : {
        slash: seq('assets/fx/slash_', 4),
        impact: seq('assets/fx/spark_', 4),
        slashOffset: { x: 40, y: -60 }   // 캐릭터 발 기준, 베기 그림 가운데 위치(오른쪽 볼 때)
      }
    },

    // ---------- 움직임 ----------
    player: {
      speedX: 90,           // 1초에 도트 몇 칸 (좌우)
      speedY: 55,           // 위아래 (안쪽/바깥쪽)
      startX: 200,
      hitbox: { x0: 8, x1: 92, yTop: -100, yBot: -18, depth: 14 } // 발 기준, 오른쪽 볼 때
    },

    // ---------- 직업 (위쪽 버튼) ----------
    // weapon = 쓰는 무기(무기별 손맛 + 손에 붙일 그림, 'fist' 는 그림 없음), moves = 콤보 묶음(combos 의 이름)
    // 견습 = 전직 전 맨손, 기사 = 검. 처음 켤 때는 defaultClass.
    // 도끼를 다시 켜려면: 아래 axe 줄의 주석(//)을 풀고, index.html 의 도끼 버튼 주석(<!-- -->)도 푼다.
    classes: {
      novice: { label: '견습(맨손)', weapon: 'fist',  moves: 'fist' },
      knight: { label: '기사(검)',   weapon: 'sword', moves: 'sword' }
      // , axe: { label: '도끼', weapon: 'axe', moves: 'sword' }
    },
    defaultClass: 'novice',

    // ---------- 무기별 손맛 (맨손 = 가볍게 툭, 검 = 스윽 빠르게, 도끼 = 쾅 무겁게) ----------
    weapons: {
      fist:  { damage: [8, 11],  hitstopMul: 0.9, shakeMul: 0.85, knockMul: 0.85, speed: 1.0, arcColor: '#ffffff', sparkColor: '#ffe6a0' },
      sword: { damage: [11, 15], hitstopMul: 1.0, shakeMul: 1.0, knockMul: 1.0, speed: 1.0,  arcColor: '#cfe8ff', sparkColor: '#fff3b0' },
      axe:   { damage: [19, 26], hitstopMul: 1.6, shakeMul: 1.8, knockMul: 1.6, speed: 0.78, arcColor: '#ffc27a', sparkColor: '#ffb347' }
    },

    // ---------- 3타 콤보: 입력 기억 시간(공통) + 예전 견습 그림(?art=novice)용 콤보 ----------
    // stage1 캐릭터(남/여)는 위 MOVES 의 자기 콤보를 쓴다. 아래 steps 는 칼 박힌 예전 그림(공격 그림 1묶음)에서만 쓴다.
    combo: {
      bufferMs: 260,        // 공격 중 미리 눌러 둔 입력을 기억하는 시간
      resetMs: 450,         // 이 시간 넘게 안 누르면 1타부터
      steps: [
        // f = 사용할 공격 그림 번호(0부터), d = 각 장의 시간(ms), active = 판정 나는 장, cancel = 다음 타로 넘어갈 수 있는 장
        { f: [0, 1, 2, 3, 4], d: [40, 70, 35, 90, 90],        active: [2, 3], cancel: 3, lunge: 4,  dmg: 1.0, hitstop: 1.0, knock: 1.0, shake: 1.0, arc: { from: -100, to: 40,  r: 46, w: 9 } },
        { f: [1, 2, 3, 4],    d: [45, 30, 90, 90],            active: [1, 2], cancel: 2, lunge: 7,  dmg: 1.1, hitstop: 1.0, knock: 1.2, shake: 1.1, arc: { from: -40, to: 60,   r: 50, w: 8, flipY: true } },
        { f: [0, 1, 1, 2, 3, 3, 4], d: [40, 60, 70, 30, 70, 90, 110], active: [3, 4], cancel: 99, lunge: 16, dmg: 1.7, hitstop: 1.7, knock: 2.4, shake: 2.0, arc: { from: -130, to: 70, r: 58, w: 12 }, finisher: true }
      ]
    },

    // ---------- 타격감 (전부 여기서 조절, ?debug=1 화면에서 실시간 조절 가능) ----------
    juice: {
      hitstopMs: 75,        // 맞는 순간 화면 멈춤
      shakePx: 3,           // 화면 흔들림 세기(도트)
      shakeMs: 140,         // 흔들림 시간
      flashMs: 70,          // 맞은 대상 하얗게 번쩍
      knockback: 10,        // 허수아비 밀림(도트)
      knockReturn: 10,      // 제자리 돌아오는 힘
      wobble: 0.2,          // 허수아비 흔들림(라디안)
      dmgRise: 26,          // 데미지 숫자 떠오르는 높이
      dmgMs: 650,           // 데미지 숫자 보이는 시간
      sparkCount: 9,        // 튀는 불똥 수
      slashMs: 120,         // 베기 궤적 보이는 시간
      vibrateMs: 18,        // 폰 진동(ms). 0이면 끔
      timeScale: 1.0        // 전체 속도(디버그용 슬로모션)
    },

    // ---------- 조작 ----------
    keys: {
      left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
      up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
      attack: ['KeyJ', 'KeyZ'],
      jump: ['KeyK', 'KeyX', 'Space'] // 아직 안 씀(자리만)
    }
  };
})();
