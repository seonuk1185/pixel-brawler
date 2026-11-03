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
  //      linger = 궤적이 남아 있는 시간(ms, 없으면 juice.slashMs): 꽉 찬 초승달을 그만큼 붙잡고 서서히 흐려짐(X자 두 획이 함께 보이게)
  //      top = 불똥(맞은 효과)보다 위에 그림
  var MOVES = {
    // 남자: 힘 있는 검술. 1타 대각선 내려베기 → 2타 아래에서 위로 되받아 베기 → 3타 크게 들어 내리찍기
    male: {
      stride: 112, knightStride: 80, attack1Prefix: 'attack_', attack1Count: 5, attack2Count: 5, attack3Count: 6,
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
      stride: 96, knightStride: 95, attack1Prefix: 'attack1_', attack1Count: 4, attack2Count: 5, attack3Count: 6,
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
      ],
      // 기사 옷만 따로 쓰는 타(knightCombo): 번호(0부터) = 바꿀 타. 없는 타는 위 combo 를 그대로 쓴다.
      // 기사 여자 3타는 그림을 새로 그려서(2026-11-03, 솟구치는 X자 마무리) 견습 여자 3타와 동작이 다르다
      knightCombo: {
        // 3타 = 솟구치는 X자 마무리: 장 0 앞발 딛고 칼을 어깨 위로 크게 젖힘 → 장 1 대각선 내려베기(1번째 판정)
        //   → 장 2 칼을 무릎 옆 뒤쪽으로 뒤집기 → 장 3 반대 대각선 올려베기(2번째 판정 = 마무리, X자 완성)
        //   → 장 4·5 칼을 머리 위 뒤로 치켜든 마무리 자세. 그림 속에서 앞으로 약 20도트 디디므로 lunge 는 작게
        2: { anim: 'attack3', f: [0, 1, 2, 3, 4, 5], d: [70, 55, 45, 60, 160, 120], cancel: 99, endAdvance: 4,
             reach: { x0: 8, x1: 80, yTop: -110, yBot: -12 },
             hits: [
               { active: [1, 1], lunge: 2, dmg: 0.7, hitstop: 0.9, knock: 0.5, shake: 0.9,
                 reach: { x0: 8, x1: 76, yTop: -106, yBot: -14 },
                 fx: { type: 'slash', x: 44, y: -62, rot: -45, sx: 1.0, sy: 1.1, linger: 300, top: true }, arc: { from: -135, to: 50, r: 52, w: 10 } },
               { active: [3, 3], lunge: 2, dmg: 1.6, hitstop: 1.9, knock: 2.4, shake: 2.3, finisher: true,
                 reach: { x0: 6, x1: 80, yTop: -112, yBot: -12 },
                 fx: { type: 'slash', x: 46, y: -64, rot: 120, sx: 1.2, sy: 1.15, flipY: true, linger: 300, top: true }, arc: { from: 150, to: -60, r: 56, w: 12 } }
             ] }
      }
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

  // ---------- 법사(지팡이) 3타 콤보 (2026-11-03, art\stage1 README 「Mage」 표) ----------
  // 남 = 지팡이(staff), 여 = 짧은 지팡이(wand). 근접 타는 기사보다 약간 약하고, 마무리 3타가 마법(멀리 날아가거나 범위)이라 그걸로 메운다.
  // impactFx = 맞았을 때 불똥 대신 쓸 효과 그림(config art.fx 의 이름). hitY = 불똥 높이(발 기준)
  // fx 는 하나 또는 [여러 개]: type 'spark' = 지팡이 끝 반짝임(magic_spark 그림, x,y = 발 기준, scale = 크기)
  // cast = 마법: 판정 상자 대신 이 장에서 마법이 나간다.
  //   kind 'bolt' = 날아가는 마법탄: x,y = 나오는 곳(발 기준), speed = 1초에 도트, range = 최대 거리, box = 탄 크기(w,h),
  //     depth = 위아래(안쪽) 판정 폭. 처음 맞은 적에서 터짐(burst). burstAtEnd = 끝까지 날아가면 거기서도 터짐
  //     backReach = 나오는 곳보다 이만큼 뒤(몸 쪽)도 처음에 확인 → 바로 앞에 붙은 적도 맞음(탄이 머리 위로 지나가지 않게)
  //   kind 'burst' = 그 자리에서 바로 터짐(범위 공격)
  //   burst = 터짐: r = 반지름(도트), depth = 위아래 폭, scale = 터짐 그림 크기(96x96 = 반지름 약 48)
  var MAGE = {
    // 남자: 1타 지팡이 찌르기 → 2타 머리 위에서 내려치기 → 3타 마법탄 발사(마무리)
    male: {
      stride: 84, attack1Count: 4, attack2Count: 5, attack3Count: 6,
      combo: [
        { anim: 'attack1', f: [0, 1, 2, 3], d: [60, 60, 110, 90], active: [2, 2], cancel: 3, lunge: 3,
          reach: { x0: 40, x1: 110, yTop: -82, yBot: -56 },   // x1: 지팡이가 0.7배로 커져서 끝(약 109)까지
          dmg: 0.95, hitstop: 0.8, knock: 0.8, shake: 0.7, hitY: -69, spark: 0.8, impactFx: 'magic_spark',
          fx: { type: 'spark', x: 108, y: -69, scale: 1.0 } },
        { anim: 'attack2', f: [0, 1, 2, 3, 4], d: [70, 90, 60, 130, 110], active: [3, 3], cancel: 4, lunge: 4,
          reach: { x0: 30, x1: 78, yTop: -120, yBot: -5 },
          dmg: 1.1, hitstop: 1.1, knock: 1.3, shake: 1.1, hitY: -34, spark: 0.9, impactFx: 'magic_spark',
          fx: [{ type: 'whoosh', x: 46, y: -62, rot: 0, sx: 0.8, sy: 0.95, alpha: 0.45 }, { type: 'spark', x: 69, y: -11, scale: 1.1 }],
          arc: { from: -100, to: 60, r: 46, w: 6 } },
        { anim: 'attack3', f: [0, 1, 2, 3, 4, 5], d: [80, 100, 60, 150, 120, 140], active: [3, 3], cancel: 99, lunge: 0,
          dmg: 1.9, hitstop: 1.6, knock: 2.4, shake: 2.0, finisher: true, spark: 1.0, impactFx: 'magic_spark',
          fx: { type: 'spark', x: 105, y: -68, scale: 1.3 },
          cast: { kind: 'bolt', x: 105, y: -68, speed: 300, range: 220, box: { w: 18, h: 16 }, depth: 14, burstAtEnd: true, backReach: 85,
                  burst: { r: 30, depth: 16, scale: 0.75 } } }
      ]
    },
    // 여자: 1타 지팡이 튕기기(끝에서 작은 반짝임, 짧은 원거리) → 2타 한 바퀴 돌기(앞뒤 다 맞음 + 앞으로 한 번 더) → 3타 두 손 마법 폭발(범위, 마무리)
    female: {
      stride: 84, attack1Count: 4, attack2Count: 5, attack3Count: 5,
      combo: [
        { anim: 'attack1', f: [0, 1, 2, 3], d: [40, 45, 100, 70], active: [2, 2], cancel: 3, lunge: 3,
          reach: { x0: 40, x1: 92, yTop: -88, yBot: -60 },
          dmg: 0.85, hitstop: 0.75, knock: 0.7, shake: 0.6, hitY: -74, spark: 0.7, impactFx: 'magic_spark',
          fx: { type: 'spark', x: 63, y: -74, scale: 0.9 } },
        // 2타 = 돌기: 장 1~2(등 보임)에서 앞뒤 둘 다 맞음(가볍게) → 장 3 앞으로 한 번 더
        { anim: 'attack2', f: [0, 1, 2, 3, 4], d: [45, 50, 60, 110, 80], cancel: 4,
          reach: { x0: -44, x1: 60, yTop: -96, yBot: -30 }, impactFx: 'magic_spark', hitY: -72,
          hits: [
            { active: [1, 2], lunge: 0, dmg: 0.55, hitstop: 0.7, knock: 0.6, shake: 0.6, spark: 0.6,
              fx: { type: 'whoosh', x: 10, y: -66, rot: 90, sx: 0.6, sy: 1.25, alpha: 0.35 } },
            { active: [3, 3], lunge: 3, dmg: 0.75, hitstop: 0.9, knock: 1.1, shake: 0.9, spark: 0.75,
              reach: { x0: 20, x1: 64, yTop: -96, yBot: -40 },
              fx: { type: 'spark', x: 47, y: -75, scale: 0.9 } }
          ] },
        { anim: 'attack3', f: [0, 1, 2, 3, 4], d: [60, 70, 140, 110, 110], active: [2, 2], cancel: 99, lunge: 0,
          dmg: 1.8, hitstop: 1.7, knock: 2.4, shake: 2.2, finisher: true, spark: 0.9, impactFx: 'magic_spark',
          fx: { type: 'none' },
          cast: { kind: 'burst', x: 76, y: -71, burst: { r: 40, depth: 18, scale: 1.0 } } }
      ]
    }
  };

  // 새 그림(art\stage1): 빈손 남/여 + 손 위치 json → 무기를 코드로 손에 붙인다
  // 콤보 3타는 캐릭터마다 자기 그림(attack1/attack2/attack3)과 자기 수치를 쓴다 (위 MOVES)
  // 직업(견습/기사)에 따라 콤보 묶음이 바뀐다: combos.fist = 맨손(FIST), combos.sword = 검(MOVES)
  // outfit = 옷 그림 묶음('knight' = 기사 갑옷). 없으면 견습 옷. 기사 옷 그림은 검 콤보 그림만 있고 맨손(fist) 그림은 없다
  //   (파일 이름·장 수·발 위치가 견습 그림과 똑같아서 MOVES 수치를 그대로 쓴다. 단 MOVES.<성별>.knightCombo 에 있는 타는 기사만 따로)
  function stage1(who, anchors, outfit) {
    var p = 'assets/chars/stage1/' + (outfit ? outfit + '_' : '') + who + '/';
    var M = MOVES[who];
    if (outfit === 'mage') M = { stride: MAGE[who].stride, attack1Prefix: 'attack1_', attack1Count: MAGE[who].attack1Count,
                                 attack2Count: MAGE[who].attack2Count, attack3Count: MAGE[who].attack3Count, combo: MAGE[who].combo };
    // 검 콤보: 기사 옷이면 knightCombo 에 있는 타만 바꿔 끼운다(나머지 타는 견습과 같은 수치)
    var swordCombo = M.combo;
    if (outfit === 'knight' && M.knightCombo) {
      swordCombo = M.combo.map(function (st, i) { return M.knightCombo[i] || st; });
    }
    var def = {
      label: who === 'male' ? '남' : '여',
      frameW: 176, frameH: 136,
      pivot: { x: 68, y: 130 },
      bakedWeapon: false,
      anchors: anchors,
      anims: {
        idle:    { frames: seq(p + 'idle_', 4),   fps: 6,  loop: true },
        // 걷기: 시간 대신 「걸은 거리」로 그림을 넘긴다. stride = 8장 한 바퀴(두 걸음) 동안 가는 도트 수.
        //   그림 속 보폭에 맞춘 값이라 발이 바닥에서 미끄러지지 않는다. 캐릭터마다 보폭이 달라 MOVES 에 따로 둔다
        //   견습 남 112, 여 96 / 기사 옷은 걷기 그림을 따로 그려서(2026-11-03, 보폭 짧은 갑옷 걸음) knightStride 남 80, 여 95 (2026-11-03 v3 다리 수정 후 재측정)
        //   (그림 속 디딘 발이 한 장마다 뒤로 가는 거리 × 8 을 잰 값. 좌우 104도트/초에서 견습 약 7.4 / 8.7장/초, 기사 약 9.9 / 8.3장/초).
        //   depthStrideMul = 위아래(안쪽) 이동일 때 거리를 이만큼 크게 쳐서, 느린 위아래 이동에도 다리가 자연스럽게 움직이게.
        walk:    { frames: seq(p + 'walk_', 8),   fps: 12, loop: true, stride: outfit === 'knight' ? M.knightStride : M.stride, depthStrideMul: 1.6 },
        attack1: { frames: seq(p + M.attack1Prefix, M.attack1Count), fps: 14, loop: false },
        attack2: { frames: seq(p + 'attack2_', M.attack2Count), fps: 14, loop: false },
        attack3: { frames: seq(p + 'attack3_', M.attack3Count), fps: 14, loop: false },
        hurt:    { frames: seq(p + 'hurt_', 3),   fps: 10, loop: false },
        // 맞음 반응 (2026-11-03): d = 각 장의 시간(ms). hurt2 = 두 번째 움찔(hurt 와 번갈아),
        //   knockdown = 크게 맞고 날아가 눕기(마지막 장은 누워 있는 동안 계속), getup = 일어나기
        //   knockdown 1~5, getup 1~2 장은 손 위치 json 에 "hide" → 무기를 안 그린다(손에서 놓침)
        hurt2:     { frames: seq(p + 'hurt2_', 3),     d: [130, 170, 150], loop: false },
        knockdown: { frames: seq(p + 'knockdown_', 5), d: [110, 160, 110, 110], loop: false },   // 장 1~4 시간, 5(누움)는 계속
        getup:     { frames: seq(p + 'getup_', 4),     d: [220, 180, 160, 140], loop: false }
      },
      combo: swordCombo,
      combos: outfit === 'mage' ? { magic: M.combo } : { sword: swordCombo }
    };
    if (!outfit) {   // 견습 옷만 맨손 콤보 그림이 있다
      def.anims.fist1 = { frames: seq(p + 'fist1_', 4),  fps: 14, loop: false };
      def.anims.fist2 = { frames: seq(p + 'fist2_', 5),  fps: 14, loop: false };
      def.anims.fist3 = { frames: seq(p + 'fist3_', who === 'male' ? 6 : 5), fps: 14, loop: false };
      def.combos.fist = FIST[who];
    }
    return def;
  }

  // 어떤 그림 묶음을 쓸지: 기본 stage1, 주소 뒤에 ?art=novice 를 붙이면 예전 견습(칼 박힌 그림)
  var artSet = /[?&]art=novice/.test(location.search) ? 'novice' : 'stage1';
  var male, female, knightMale = null, knightFemale = null;
  if (artSet === 'novice') {
    male = clone(NOVICE);   male.label = '남';
    female = clone(NOVICE); female.label = '여';
    female.placeholderFilter = 'hue-rotate(290deg) saturate(1.3)'; // 여자 그림 없을 때 임시 색 바꾸기
  } else {
    male = stage1('male', 'assets/chars/stage1/anchors_male.json');
    female = stage1('female', 'assets/chars/stage1/anchors_female.json');
    // 기사 옷 (직업 「기사(검)」을 고르면 이 그림 + 기사 손 위치로 바뀐다)
    knightMale = stage1('male', 'assets/chars/stage1/anchors_knight_male.json', 'knight');
    knightFemale = stage1('female', 'assets/chars/stage1/anchors_knight_female.json', 'knight');
    // 법사 옷 (직업 「법사(지팡이)」): 걷기 보폭 남녀 모두 84 (MAGE.<성별>.stride)
    var mageMale = stage1('male', 'assets/chars/stage1/anchors_mage_male.json', 'mage');
    var mageFemale = stage1('female', 'assets/chars/stage1/anchors_mage_female.json', 'mage');
  }
  var characters = { male: male, female: female };
  if (knightMale) { characters.knight_male = knightMale; characters.knight_female = knightFemale; }
  if (mageMale) { characters.mage_male = mageMale; characters.mage_female = mageFemale; }

  // ---------- 적 그림 (art\stage1-enemies 에서 복사, 그림은 전부 「왼쪽을 봄」) ----------
  // playback = 그림 번호(1부터) 재생 순서, fps = 1초에 몇 칸. 순서를 늘리면 그 장면이 길어진다(예: 몽둥이 치켜든 장면 = 예고)
  var EN = 'assets/enemies/';
  function enemyAnims(name, list) {
    var out = {};
    Object.keys(list).forEach(function (k) {
      var a = list[k];
      out[k] = { frames: seq(EN + name + '/' + k + '_', a[0]), fps: a[1], loop: !!a[2], playback: a[3] || null };
    });
    return out;
  }

  window.CFG = {
    version: 'stage1-proto-2',
    artSet: artSet,

    // ---------- 캐릭터 크기 ----------
    // 플레이어(모든 옷)·적·보스·무기·마법·베기 효과·그림자를 이 배율로 작게 그린다(배경은 그대로). 1 = 원래 크기
    // (2026-11-03: 1 → 0.7 → 0.55, 메이플처럼 작은 캐릭터). 0.6 / 0.7 처럼 숫자 하나만 바꾸면 된다.
    // 아래 수치(판정 상자·거리·보폭 등)는 전부 「원래 그림 크기(1배)」 기준 그대로 적어 두고, 맨 아래 scaleActors 가 한 번에 줄인다.
    // 이동 속도는 배율의 제곱근만큼만 줄인다(0.7 → 약 0.84배): 화면을 가로지르는 시간이 너무 늘지 않게
    actorScale: 0.55,
    // 무기만 몸보다 조금 크게(원래 그림의 이 배율). 0.55 로 줄이면 가는 칼이 3도트 두께로 뭉개져서 살짝 과장한다(2026-11-03).
    //   손잡이는 그대로 손 위치에 붙는다. 공격 판정 상자(reach)는 무기 크기와 상관없이 그대로(actorScale 만 따름)
    weaponScale: 0.7,

    // ---------- 화면 ----------
    view: {
      targetH: 240,        // 논리 화면 높이 목표(도트 기준). 실제 배율은 정수로만
      portraitTargetW: 280,// 세로 화면(폰 세로)일 때: 가로 폭을 이 도트 수 근처로 맞추고 게임 화면은 위쪽, 조작은 아래쪽
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
      // 키 = 성별(male/female) 또는 「옷_성별」(knight_male). 직업에 outfit 이 있으면 그 옷, 없으면 견습 옷
      characters: characters,
      // 무기 그림: img = 경로, grip = 손잡이 점(그림 안 좌표), baseAngle = 그림이 원래 향한 방향(도)
      weapons: {
        sword: { label: '검',   img: 'assets/weapons/sword.png', grip: { x: 8, y: 4 },  baseAngle: 0, layer: 'back' },
        axe:   { label: '도끼', img: 'assets/weapons/axe.png',   grip: { x: 9, y: 4 },  baseAngle: 0, layer: 'back' },
        // 법사: staff = 남(74x18, 수정 끝이 손잡이 앞 49도트), wand = 여(32x11, 끝이 손잡이 앞 23도트)
        staff: { label: '지팡이', img: 'assets/weapons/staff.png', grip: { x: 24, y: 9 }, baseAngle: 0, layer: 'back' },
        wand:  { label: '완드',   img: 'assets/weapons/wand.png',  grip: { x: 8, y: 4 },  baseAngle: 0, layer: 'back' }
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
        slashOffset: { x: 40, y: -60 },  // 캐릭터 발 기준, 베기 그림 가운데 위치(오른쪽 볼 때)
        // 법사 마법 효과 (artstage1effects): 마법탄 48x32 / 터짐 96x96 / 반짝임 40x40
        magic_bolt: seq('assets/fx/magic_bolt_', 6),
        magic_burst: seq('assets/fx/magic_burst_', 6),
        magic_spark: seq('assets/fx/magic_spark_', 4)
      }
    },

    // ---------- 움직임 ----------
    player: {
      speedX: 104,          // 1초에 도트 몇 칸 (좌우)  (2026-11-03: 90 → 104, 약 15% 빠르게)
      speedY: 63,           // 위아래 (안쪽/바깥쪽)  (55 → 63)
      startX: 200,
      hitbox: { x0: 8, x1: 92, yTop: -100, yBot: -18, depth: 14 } // 발 기준, 오른쪽 볼 때
    },

    // ---------- 직업 (위쪽 버튼) ----------
    // weapon = 쓰는 무기(무기별 손맛 + 손에 붙일 그림, 'fist' 는 그림 없음), moves = 콤보 묶음(combos 의 이름),
    // outfit = 입는 옷 그림(characters 의 「옷_성별」 묶음, 없으면 견습 옷)
    // 견습 = 전직 전 맨손, 기사 = 검. 처음 켤 때는 defaultClass.
    // 도끼를 다시 켜려면: 아래 axe 줄의 주석(//)을 풀고, index.html 의 도끼 버튼 주석(<!-- -->)도 푼다.
    classes: {
      novice: { label: '견습(맨손)', weapon: 'fist',  moves: 'fist' },
      knight: { label: '기사(검)',   weapon: 'sword', moves: 'sword', outfit: 'knight' },
      // 법사: 무기가 성별마다 다름(남 지팡이 staff / 여 짧은 지팡이 wand)
      mage:   { label: '법사(지팡이)', weapon: { male: 'staff', female: 'wand' }, moves: 'magic', outfit: 'mage' }
      // , axe: { label: '도끼', weapon: 'axe', moves: 'sword' }
    },
    defaultClass: 'novice',

    // ---------- 무기별 손맛 (맨손 = 가볍게 툭, 검 = 스윽 빠르게, 도끼 = 쾅 무겁게) ----------
    weapons: {
      fist:  { damage: [8, 11],  hitstopMul: 0.9, shakeMul: 0.85, knockMul: 0.85, speed: 1.0, arcColor: '#ffffff', sparkColor: '#ffe6a0' },
      sword: { damage: [11, 15], hitstopMul: 1.0, shakeMul: 1.0, knockMul: 1.0, speed: 1.0,  arcColor: '#cfe8ff', sparkColor: '#fff3b0' },
      axe:   { damage: [19, 26], hitstopMul: 1.6, shakeMul: 1.8, knockMul: 1.6, speed: 0.78, arcColor: '#ffc27a', sparkColor: '#ffb347' },
      // 법사: 근접은 검보다 약간 약하게(검 11~15). 마무리 마법(배율 1.8~1.9, 여러 마리 동시)으로 메운다
      staff: { damage: [9, 13],  hitstopMul: 1.0, shakeMul: 0.95, knockMul: 0.95, speed: 1.0, arcColor: '#d9c2ff', sparkColor: '#c99bff' },
      wand:  { damage: [8, 12],  hitstopMul: 0.95, shakeMul: 0.9, knockMul: 0.9, speed: 1.0, arcColor: '#e6d2ff', sparkColor: '#e0a8ff' }
    },

    // ---------- 법사 마법 그림 재생 ----------
    // bolt = 날아가는 마법탄(돌면서 반복), burst = 터짐(한 번), spark = 지팡이 끝 반짝임(한 번). pivot = 그림 속 가운데
    magic: {
      bolt:  { frames: 'magic_bolt',  fps: 15, pivot: { x: 24, y: 16 } },
      burst: { frames: 'magic_burst', fps: 16.7, pivot: { x: 48, y: 48 }, shake: 0.8 },   // 6장 x 60ms
      spark: { frames: 'magic_spark', fps: 18, pivot: { x: 20, y: 20 } }
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

    // ---------- 데미지 숫자 모양 (그리는 곳·글꼴 모양: fx.js 의 FONTS) ----------
    // font = 'small'(4x6) / 'big'(5x7) / 'large'(6x8) / 'mid'(6x10) / 'huge'(6x12) 둥근 숫자(large·mid·huge 는 획이 2도트로 두꺼움),
    // scale = 정수 배율(1 = 1도트), bold = 굵게(옆으로 1도트 더)
    // top = 글자 색(위 2/3), bottom = 아래 1/3 색(살짝 입체), outline = 1도트 테두리(대각선은 안 칠해 둥글게),
    // shadow = 1도트 아래 그림자, pop = 처음 popK(전체 시간 중 비율) 동안만 바꿔 쓰는 값(튀어나오는 느낌)
    // normal = 보통 타, crit = 마무리 타(「22!」). 플레이어가 맞은 숫자는 top 을 빨강, bottom 을 hurtBottom 으로
    // (2026-11-03: 예전 3x5 각진 숫자 2~4배(높이 10~15도트) + 검은 테두리 → 둥근 숫자 1배 + 갈색 테두리.
    //  폰에서 작다는 의견으로 보통 숫자 7 → 10도트(mid), 마무리 12도트(huge, 굵게))
    damageText: {
      normal: { font: 'mid', scale: 1, top: '#ffffff', bottom: '#ffe1c2', outline: '#4a2a1e', shadow: 'rgba(30,12,8,0.35)',
                pop: { bold: true } },
      crit:   { font: 'huge', scale: 1, bold: true, top: '#ffe066', bottom: '#ffa83a', outline: '#5a2a14', shadow: 'rgba(30,12,8,0.4)',
                pop: { top: '#fffbe0', bottom: '#ffe066' } },
      hurtBottom: '#b82c26',
      popK: 0.12,
      lift: 14              // 숫자가 처음 뜨는 높이(머리 위에서 몇 도트 더, actorScale 곱함)
    },

    // ================================================================
    //  1단계 판 (기본 화면). 연습장(허수아비)은 주소 뒤 ?mode=practice
    // ================================================================

    // ---------- 플레이어 체력·맞았을 때 ----------
    // hurtbox = 몸 판정(발 기준, 오른쪽 볼 때), flinchMs = 맞고 움찔하는 시간(조작 불가),
    // invulnMs = 맞은 뒤 무적 시간(깜빡임), knockMul = 밀려나는 거리 배율, radius = 몸끼리 겹치지 않는 반지름
    hero: {
      hp: 150,
      hurtbox: { x0: -14, x1: 14, yTop: -96, yBot: -4 },
      flinchMs: 300,
      invulnMs: 1000,
      knockMul: 1.0,
      radius: 14,
      // 가벼운 공격 = hurt / hurt2 번갈아 움찔. 무거운 공격(heavy: 보스 내려찍기·어깨 돌진) = 넘어짐:
      //   knockdown 그림(slide = 장 1~4 시작 때 뒤로 밀린 거리 × slideMul) → lyingMs 누워 있음 → getup → getupBlinkMs 깜빡임.
      //   넘어짐~깜빡임 동안 무적. 쓰러짐(체력 0) = knockdown 뒤 마지막 장(누움)에 그대로 → deathOverMs 뒤 GAME OVER
      down: { slide: [0, 10, 20, 24], slideMul: 1.5, lyingMs: 600, getupBlinkMs: 700 },
      deathOverMs: 1800
    },

    // ---------- 적끼리 공통 ----------
    ai: {
      maxAttackers: 2,      // 동시에 공격 동작 중인 잡몹 최대 수 (보스는 제외)
      attackGapMs: 450,     // 잡몹 공격 시작 사이 최소 간격
      enemyKnockMul: 1.6,   // 플레이어 공격으로 적이 밀려나는 거리 배율 (허수아비보다 크게)
      sepDepth: 12,         // 위아래 거리가 이보다 가까우면 몸끼리 밀어냄
      deathHoldMs: 700,     // 쓰러진 뒤 누워 있는 시간
      deathFadeMs: 600,     // 그다음 깜빡이며 사라지는 시간
      // 잡몹 맞음 반응: 보통 맞으면 hit/hit2 번갈아. 아래 중 하나면 넘어짐(knockdown):
      //   콤보 마지막 타(finisher) / 무거운 타(그 타 knock × 무기 knockMul ≥ heavyKnock) / juggleWindowMs 안에 juggleHits 번째 맞음
      //   넘어지면 down.slide 만큼 밀려나며 날아감 → lyingMs 더 누워 있음 → 일어남. 넘어짐~일어남 동안 무적(누운 적 때리기 없음)
      react: {
        heavyKnock: 2.0,
        juggleHits: 4, juggleWindowMs: 1500,
        lyingMs: 500,         // 넘어짐 그림이 끝난 뒤 더 누워 있는 시간
        getupCoolMs: 600      // 일어난 뒤 바로 공격하지 않는 시간
      }
    },

    // ---------- 적 종류 ----------
    // hp, speedX/speedY = 1초에 도트, radius = 몸 반지름(겹침 방지), height = 키(데미지 숫자 위치),
    // hurtbox = 몸 판정(발 기준, 앞 = +), engage = 공격하러 붙는 거리, hover = 차례 기다릴 때 거리,
    // range = 이 거리 안에서 공격 시작 [최소, 최대], alignY = 위아래가 이만큼 맞아야 공격, cooldown = 공격 사이 쉬는 시간 [최소, 최대]
    // 공격: anim = 그림, active = 판정 나는 그림 번호, reach = 판정 상자(앞 = +), depth = 위아래 판정 폭,
    //   dmg = 데미지 [최소, 최대], knock = 플레이어 밀림(도트), flinchMs = 플레이어 움찔 시간(없으면 hero.flinchMs),
    //   move = 공격 중 앞으로 이동 { frames: 그림 번호들, dist: 도트 }, telegraph = 바닥에 빨간 예고 표시할 그림 번호,
    //   heavy = 무거운 공격(맞으면 플레이어가 넘어짐)
    enemies: {
      goblin: {
        label: '고블린', frameW: 176, frameH: 136, pivot: { x: 92, y: 130 },
        anims: enemyAnims('goblin', {
          idle: [4, 6, true], walk: [8, 10, true],
          attack: [5, 10, false, [1, 2, 2, 2, 3, 4, 4, 5]],   // 1 들기 · 2 치켜듦(예고 300ms) · 3 맞음 · 4 내려침 · 5 복귀
          hit: [3, 10, false, [1, 2, 2, 3]],
          hit2: [3, 10, false, [1, 1, 2, 2, 3]],                  // 배 맞음 (hit 와 번갈아)
          knockdown: [5, 10, false, [1, 2, 2, 3, 4, 5, 4, 5]],    // 날아감 → 등으로 떨어짐 → 튕김 → 누움(5)
          getup: [3, 8, false, [1, 1, 2, 2, 3]],                  // 팔꿈치 → 한 무릎 → 섬
          death: [5, 8, false, [1, 2, 3, 4, 5]]
        }),
        walkAnim: 'walk',
        // 넘어짐: slide = 날아가며 밀려나는 거리(도트), lyingFrames = 누운 그림 번호(밀림은 첫 누운 그림에서 끝남)
        down: { slide: 80, lyingFrames: [3, 4, 5] },
        hp: 65, speedX: 44, speedY: 30, radius: 15, height: 84,
        hurtbox: { x0: -15, x1: 26, yTop: -80, yBot: 0 },
        engage: 50, hover: [100, 150], range: [24, 68], alignY: 7, cooldown: [1100, 2100], firstCooldown: [500, 1600],
        knockResist: 1.0, deathKnock: 220,
        attacks: {
          club: { anim: 'attack', active: [3, 4], reach: { x0: 16, x1: 80, yTop: -80, yBot: -30 }, depth: 12,
                  dmg: [6, 9], knock: 14, telegraph: [2] }
        }
      },
      wolf: {
        label: '늑대', frameW: 208, frameH: 112, pivot: { x: 104, y: 106 },
        anims: enemyAnims('wolf', {
          idle: [4, 6, true], run: [6, 14, true],   // run fps 12 → 14: 달리기 속도를 올린 만큼 다리도 빠르게
          attack: [5, 12, false, [1, 1, 1, 2, 3, 3, 4, 5]],   // 1 웅크림(예고) · 2 도약 · 3 물기 · 4 착지 · 5 복귀
          hit: [3, 10, false, [1, 2, 2, 3]],
          hit2: [3, 10, false, [1, 1, 2, 2, 3]],
          knockdown: [4, 10, false, [1, 2, 2, 3, 4, 4, 4]],       // 비명 → 공중에서 뒤집힘 → 떨어짐 → 누움(4)
          getup: [3, 8, false, [1, 1, 2, 2, 3]],
          death: [5, 8, false, [1, 2, 3, 4, 5]]
        }),
        walkAnim: 'run',
        down: { slide: 70, lyingFrames: [3, 4] },
        // 늑대는 플레이어보다 빨라야 함(빠른 적): 플레이어 90→104 에 맞춰 100→115, 55→63 (2026-11-03)
        hp: 48, speedX: 115, speedY: 63, radius: 26, height: 66,
        hurtbox: { x0: -50, x1: 51, yTop: -66, yBot: 0 },
        engage: 84, hover: [150, 200], range: [55, 112], alignY: 8, cooldown: [1300, 2300], firstCooldown: [300, 1200],
        retreatMs: 900,           // 물고 난 뒤 뒤로 빠지는 시간 (치고 빠지기)
        knockResist: 1.2, deathKnock: 240,
        attacks: {
          bite: { anim: 'attack', active: [2, 3], reach: { x0: 36, x1: 84, yTop: -64, yBot: -10 }, depth: 12,
                  dmg: [5, 7], knock: 12, move: { frames: [2, 3], dist: 36 } }
        }
      },
      orc: {
        label: '오크 족장', boss: true, frameW: 320, frameH: 232, pivot: { x: 168, y: 226 },
        anims: enemyAnims('orc', {
          idle: [4, 5, true], walk: [6, 8, true],
          attack1: [5, 8, false, [1, 2, 2, 2, 2, 3, 4, 4, 4, 5]],   // 내려찍기: 2 치켜듦(예고 500ms) → 4 땅에 박힘
          attack2: [5, 9, false, [1, 1, 1, 2, 3, 4, 4, 5]],         // 가로 휘두르기: 1 뒤로 젖힘(예고) → 3 쭉 뻗음
          special: [5, 10, false, null],                             // 어깨 돌진: 코드에서 단계별로 재생(아래 charge)
          hit: [3, 8, false, [1, 2, 2, 3]],
          hit2: [3, 8, false, [1, 1, 2, 2, 3]],
          stagger: [4, 7, false, null],                              // 휘청: 장마다 시간은 아래 stagger.d
          death: [5, 6, false, [1, 1, 2, 2, 3, 4, 5]]
        }),
        walkAnim: 'walk',
        hp: 1000, speedX: 34, speedY: 26, radius: 40, height: 152,
        hurtbox: { x0: -27, x1: 50, yTop: -152, yBot: 0 },
        engage: 70, hover: [70, 90], range: [40, 160], alignY: 10, cooldown: [900, 1700], firstCooldown: [1200, 1500],
        knockResist: 0.25, deathKnock: 60,
        staggerCdMs: 2200,       // 한 번 움찔하면 이 시간 동안은 안 움찔함(계속 맞아도 번쩍이기만) → 무한 콤보 방지
        superArmor: true,        // 공격 동작 중에는 맞아도 안 끊김. 보스는 절대 안 넘어짐(knockdown 없음)
        // 휘청(stagger): 체력이 at 비율 아래로 내려갈 때(공격 중이어도 끊김) + 어깨 돌진이 헛치고 화면 끝(벽)에 박혔을 때(onWall).
        //   d = 그림 1~4 각각 시간(ms). 3번(도끼 짚고 무릎 꿇고 헐떡임) 800ms = 때릴 기회. 휘청 중 맞으면 번쩍이기만
        stagger: { at: [0.66, 0.33], onWall: true, d: [280, 140, 800, 280] },
        enrageAt: 0.5,           // 체력이 이 비율 아래로 떨어지면 화남: 빨라지고 고블린 부름
        enrage: { speedMul: 1.3, cooldownMul: 0.65, summon: ['goblin', 'goblin'] },
        attacks: {
          slam:  { anim: 'attack1', active: [3, 4], reach: { x0: 40, x1: 104, yTop: -120, yBot: 0 }, depth: 16,
                   dmg: [18, 22], knock: 34, flinchMs: 450, telegraph: [2], shake: 2.5, when: [40, 100], weight: 3, heavy: true },
          sweep: { anim: 'attack2', active: [3, 4], reach: { x0: 30, x1: 160, yTop: -120, yBot: -30 }, depth: 14,
                   dmg: [14, 18], knock: 30, flinchMs: 400, telegraph: [1], shake: 1.6, when: [60, 160], weight: 3 },
          // 어깨 돌진: windMs 동안 웅크리고 소리침(예고, 플레이어 줄로 천천히 맞춤) → speed 로 dist 만큼 미끄러지며 돌진
          //   → 부딪힘(그림 5). 몸통 판정 bodyReach, 마지막 어깨 판정 reach. dustMs 마다 먼지 효과
          charge: { type: 'charge', anim: 'special', windMs: 750, stepMs: 100, speed: 260, dist: 260, impactMs: 260, recoverMs: 300,
                    bodyReach: { x0: 10, x1: 84, yTop: -150, yBot: 0 }, reach: { x0: 40, x1: 128, yTop: -145, yBot: 0 }, depth: 16,
                    dmg: [20, 24], knock: 46, flinchMs: 550, shake: 3, dustMs: 110, when: [130, 400], weight: 2, heavy: true }
        }
      }
    },

    // ---------- 1단계 판 ----------
    // width = 판 전체 길이(도트). waves = 화면이 멈추는 곳(at = 카메라 왼쪽 끝 위치, 'end' = 맨 끝 보스방)
    //   spawn = [종류, 나오는 쪽('L'/'R'), 몇 ms 뒤에] 순서대로. 다 잡으면 「GO →」
    // healOnClear = 웨이브를 깰 때마다 체력 회복
    stage: {
      name: 'STAGE 1  숲길',
      width: 2880,
      healOnClear: 15,
      bgTop: '#7fb2e5',           // 화면이 배경보다 높을 때 위쪽 하늘 색 (실제로는 배경 맨 윗줄을 늘려 씀)
      waves: [
        { at: 120,  spawn: [['goblin', 'R', 0], ['goblin', 'R', 600], ['goblin', 'L', 2200]] },
        { at: 500,  spawn: [['wolf', 'R', 0], ['goblin', 'L', 400], ['wolf', 'R', 1800], ['goblin', 'R', 2600]] },
        { at: 880,  spawn: [['goblin', 'R', 0], ['goblin', 'R', 300], ['goblin', 'L', 900], ['goblin', 'R', 3800], ['goblin', 'L', 4300]] },
        { at: 1260, spawn: [['wolf', 'R', 0], ['wolf', 'L', 500], ['goblin', 'R', 1200], ['wolf', 'R', 3400], ['goblin', 'L', 3800]] },
        { at: 1650, spawn: [['goblin', 'R', 0], ['goblin', 'L', 200], ['wolf', 'R', 1000], ['goblin', 'R', 3600], ['wolf', 'L', 4000], ['goblin', 'R', 4800], ['wolf', 'R', 5400]] },
        { at: 2040, spawn: [['wolf', 'R', 0], ['wolf', 'R', 300], ['goblin', 'L', 700], ['goblin', 'R', 2800], ['goblin', 'L', 3200], ['wolf', 'R', 4200]] },
        { at: 'end', boss: true, spawn: [['orc', 'R', 0]] }
      ]
    },

    // ---------- 1단계 배경 (art\stage1-bg 에서 복사) ----------
    // 뒤 → 앞 순서. parallax = 카메라가 1 움직일 때 그 층이 움직이는 비율. mid 는 판 끝에서 그림이 딱 끝나게 자동으로 맞춤(최대 0.5)
    // floorY = 그림 속 바닥(풀 경계)이 시작하는 높이, laneTop/laneBottom = 그림 속 걸을 수 있는 길(흙길)
    bg: {
      far:    { img: 'assets/bg/stage1/far.png',    w: 512,  tile: true,  parallax: 0.15 },
      mid:    { img: 'assets/bg/stage1/mid.png',    w: 1658, tile: false, parallax: 0.5 },
      ground: { img: 'assets/bg/stage1/ground.png', w: 723,  tile: true,  parallax: 1.0 },
      height: 240, floorY: 144, laneTop: 158, laneBottom: 230
    },

    // 먼지 효과(오크 돌진): 112x64, 바닥 가운데 기준
    dust: { frames: seq('assets/fx/dust_', 5), pivot: { x: 56, y: 60 }, fps: 12 },

    // ---------- 조작 ----------
    keys: {
      left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
      up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
      attack: ['KeyJ', 'KeyZ'],
      jump: ['KeyK', 'KeyX', 'Space'] // 아직 안 씀(자리만)
    }
  };

  // ---------- 캐릭터 크기(actorScale) 적용: 몸 크기에 묶인 거리 수치를 한 번에 줄인다 ----------
  // 그림·기준점(pivot)·손 위치·무기 손잡이는 assets.js 가 불러올 때 줄인다. 손맛 수치(juice)는 디버그 조절판 값이 바뀌지 않게
  // 여기서 안 건드리고 쓰는 곳(main.js·fx.js)에서 곱한다.
  (function scaleActors(C) {
    var S = C.actorScale || 1, MV = Math.sqrt(S);   // MV = 이동 속도 배율
    if (S === 1) return;
    var done = [];   // 같은 콤보를 여러 캐릭터가 같이 쓰므로 한 번만 줄인다
    function once(o) { if (!o || done.indexOf(o) >= 0) return false; done.push(o); return true; }
    function mul(o, keys, k) { if (o) keys.forEach(function (n) { if (typeof o[n] === 'number') o[n] *= k; }); }
    function box(r) { if (once(r)) mul(r, ['x0', 'x1', 'yTop', 'yBot', 'depth'], S); }
    function arr(a) { if (once(a)) for (var i = 0; i < a.length; i++) a[i] *= S; }
    // 콤보 한 타: 내딛기·판정 상자·불똥 높이·효과 위치·마법(위치·속도·거리·크기)
    function step(st) {
      if (!once(st)) return;
      mul(st, ['lunge', 'endAdvance', 'hitY'], S);
      box(st.reach);
      (Array.isArray(st.fx) ? st.fx : [st.fx]).forEach(function (f) { if (once(f)) mul(f, ['x', 'y', 'len'], S); });
      if (once(st.arc)) mul(st.arc, ['r', 'w'], S);
      var c = st.cast;
      if (once(c)) {
        mul(c, ['x', 'y', 'speed', 'range', 'depth', 'backReach'], S);
        if (c.box) mul(c.box, ['w', 'h'], S);
        if (c.burst) mul(c.burst, ['r', 'depth'], S);
      }
      (st.hits || []).forEach(step);
    }
    Object.keys(C.art.characters).forEach(function (k) {
      var d = C.art.characters[k];
      if (d.anims.walk && d.anims.walk.stride) d.anims.walk.stride *= S;   // 보폭 = 그림 속 거리 → 그림과 같이 줄여야 발이 안 미끄러짐
      (d.combo || []).forEach(step);
      Object.keys(d.combos || {}).forEach(function (m) { d.combos[m].forEach(step); });
    });
    C.combo.steps.forEach(step);
    if (C.art.fx) mul(C.art.fx.slashOffset, ['x', 'y'], S);
    mul(C.player, ['speedX', 'speedY'], MV);
    box(C.player.hitbox);
    box(C.hero.hurtbox);
    mul(C.hero, ['radius'], S);
    arr(C.hero.down.slide);
    mul(C.ai, ['sepDepth'], S);
    Object.keys(C.enemies).forEach(function (k) {
      var T = C.enemies[k];
      mul(T, ['radius', 'height', 'engage', 'alignY', 'deathKnock'], S);
      mul(T, ['speedX', 'speedY'], MV);
      // 적 걷기 그림은 시간으로 넘긴다 → 속도를 덜 줄인 만큼 그림도 빠르게(발과 바닥의 관계가 원래와 같게)
      var wa = T.anims[T.walkAnim];
      if (wa) wa.fps *= MV / S;
      box(T.hurtbox); arr(T.hover); arr(T.range);
      if (T.down) mul(T.down, ['slide'], S);
      Object.keys(T.attacks).forEach(function (n) {
        var a = T.attacks[n];
        box(a.reach); box(a.bodyReach);
        mul(a, ['depth', 'knock', 'speed', 'dist'], S);   // 돌진 speed·dist 둘 다 줄임 → 돌진 시간은 원래와 같음
        if (a.move) mul(a.move, ['dist'], S);
        arr(a.when);
      });
    });
  })(window.CFG);
})();
