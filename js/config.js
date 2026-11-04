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

  // ---------- 직업 기술 (2026-11-03): 기사 2개 · 법사 2개, 견습은 없음 ----------
  // 키보드 U(또는 C) = 기술 A, I(또는 V) = 기술 B / 폰 = 공격 버튼 위 작은 동그라미 2개. MP 없음, 쿨타임만.
  // 보통 콤보의 「판정 끝난 뒤(회복 장)」에서 바로 끊고 나갈 수 있다(판정 장 도중은 안 됨 → 그 다음 장에서 나감).
  //
  // 기술 = 「동작(motion)」 하나 + 「효과(fx)」 몇 개 (art\stage1\README 「스킬 = 동작 모음집 + 효과」, skills\motions.json).
  //   동작은 몸만 그린 그림 묶음이라 앞으로 나올 다른 기술도 같은 동작을 다시 쓸 수 있다(예: 얼음창 = motion_cast_forward + 얼음 효과).
  //
  // MOTIONS = 동작 모음집: 옷_성별 → 동작 이름 → { count = 장 수, ms = 장마다 시간, active = 판정·발사 장(0부터, 참고용) }
  //   그림 = assets/chars/stage1/<옷_성별>/<동작>_01.png …, 손 위치 = assets/chars/stage1/anchors_motions_<옷_성별>.json
  //   (art\stage1\skills 에서 복사. 다시 그리면 그 폴더에서 다시 복사하고 ms 를 motions.json 과 맞춘다)
  var MOTIONS = {
    knight_male: {
      motion_dash: { count: 6, ms: [140, 70, 70, 90, 120, 160], active: [3], dashFrames: [1, 2] },        // 0 웅크림 · 1-2 돌진 · 3 가로베기 · 4-5 복귀
      motion_spin: { count: 7, ms: [120, 60, 60, 60, 60, 110, 160], active: [1, 3, 5] }                    // 0 장전 · 1-4 한 바퀴 · 5 마무리 베기 · 6 가드
    },
    knight_female: {
      motion_dash: { count: 6, ms: [90, 60, 80, 70, 140, 120], active: [2], dashFrames: [1] },            // 1 수평 돌진 · 2 올려베기
      motion_spin: { count: 7, ms: [80, 45, 45, 45, 45, 90, 150], active: [1, 3, 5] }                     // 발레식 회전 · 5 런지 착지 베기
    },
    mage_male: {
      motion_cast_forward: { count: 6, ms: [110, 120, 140, 80, 120, 150], active: [3] },                 // 3 앞으로 찌르며 발사
      motion_cast_sky:     { count: 6, ms: [120, 140, 200, 80, 200, 150], active: [3] }                  // 1-2 하늘로 · 3 내리꽂기
    },
    mage_female: {
      motion_cast_forward: { count: 5, ms: [70, 90, 70, 90, 120], active: [2] },                         // 2 투수처럼 던짐
      motion_cast_sky:     { count: 6, ms: [70, 110, 140, 60, 160, 120], active: [3] }                   // 3 앞 아래로 탁 가리킴
    }
  };

  // SKILLS = 기술: 어떤 동작 + 어떤 효과를 언제·어디에. 시각은 「장 번호」로 적는다 → 동작의 ms 가 바뀌면 판정·효과가 같이 따라간다.
  //   (skills.js 가 동작의 ms 로 「기술 시작부터 몇 ms」로 바꿔서 쓴다. 장 번호 대신 ms 로 직접 적어도 됨: at: [시작, 끝])
  //   name = 이름, icon = 버튼 글자, cooldownMs = 쿨타임, motion = 동작 이름(MOTIONS), motionMs = 이 기술만 동작 시간 바꾸기(없으면 MOTIONS 의 ms)
  //   damageStyle = 데미지 숫자 모양(CFG.damageText), darken = 시작 때 배경 어둡게 { ms, alpha }
  //   (효과 그림 fx 의 scale = 그 효과만 크기 배율. 모든 기술 효과는 이미 skillFxScale(2)배 → 회전 고리는 0.75 를 곱해 1.5배: 몸을 감싸는 크기)
  //   iframes = 무적 { frames: [첫 장, 끝 장] }
  //   move = 돌진 { frames: [첫 장, 끝 장], dist = 도트 }: 처음 빠르게 → 끝에서 느리게. 끝에 적 몸 안이면 뚫고 나감
  //   trail = 잔상(몸 실루엣) { frames, everyMs, lifeMs, alpha, color }
  //   hits = 판정 { frame: 장 번호 또는 frames: [첫 장, 끝 장], reach = 판정 상자(발 기준, 앞 +, 뒤 -, depth = 위아래 폭) }
  //         같은 대상은 한 판정에 한 번. dmg/hitstop/knock/shake = 배율(무기 값과 곱함), knockdown = 잡몹 넘어짐,
  //         away = 몸에서 바깥쪽으로 밀기, stunMs = 맞고 멈춰 있는 시간 더함(감전 효과 shock 이 겹쳐 보임),
  //         spark = 불똥 크기, hitY = 불똥 높이, big = 큰 불똥, flash = 처음 맞은 순간 화면 번쩍 { color, alpha, ms }, slowMs = 슬로모션
  //   finale = 끝맺음 { frame, ifHit = 하나라도 맞았을 때만, hitstopMs, shake, slowMs, flash }
  //   fx = 효과 { frame, type, x, y (발 기준, 원래 크기 도트) }:
  //         type 'art' = 효과 그림(fx = CFG.skillFx 이름). layer 'back' = 캐릭터 뒤, follow = 캐릭터를 따라감,
  //                      split = 고리처럼 몸을 감싸는 그림: 기준점 위쪽(먼 쪽 반)은 캐릭터 뒤, 아래쪽(가까운 쪽 반)은 앞에 그림,
  //                      alpha = 투명도(1 = 불투명, 회전 고리 0.7 → 기사가 비쳐 보임),
  //                      rot = 돌리기(도, 시계 +), vx = 앞으로 날아가는 속도(도트/초), fps = 재생 속도 바꾸기, ph = 그림이 없을 때 대신 쓸 효과
  //         'slash'(기존 베기 그림을 tint 색으로) / 'thrust'(직선 바람) / 'dust'(먼지) / 'spark'(반짝임) / 'ring'(코드로 그린 원)
  //   cast = 화염구 { frame = 발사 장, x,y = 나오는 곳, speed = 1초에 도트, range = 최대 거리, box = 탄 크기, depth = 위아래 폭,
  //          backReach = 나오는 곳보다 몸 쪽으로 더 확인할 폭, art = 날아가는 그림, emberMs = 불씨 간격,
  //          burst = 터짐 { r, depth, art, fromFrame = 몇 번째 장부터(멈춤 동안 큰 장이 보이게) }, hit = 터짐 데미지 }
  //          (그림이 없을 때: scale·tint·tintK 로 마법탄 그림을 크게·주황색으로)
  //   strikes = 번개 { frame = 첫 번개 장, gapMs = 번개 사이 시간, x = [법사 앞 거리들], markMs = 미리 바닥 표시 시간,
  //          r = 가로 반지름, depth = 위아래 폭, ms = 번개가 보이는 시간, art = 번개 기둥(아래 끝 = 땅, 위는 화면 맨 위까지 늘림),
  //          hitArt = 땅 번쩍, hitFromFrame, color/core/glow = 그림이 없을 때 코드로 그리는 번개 색, hits = 번개마다 데미지 }
  //   placeholder = 동작 그림이 없을 때 쓰는 기존 그림 { anim, f = 장 순서, d = 장 시간, spin = 좌우 뒤집어 도는 척 [시작ms, 끝ms] }
  //   male / female = 그 성별만 바꿀 값(그 키를 통째로 덮어씀)
  // 얕은 복사 + 덮어쓰기 (같은 판정 값을 여러 기술·성별이 나눠 쓸 때)
  function merge(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }
  // 2026-11-03 HD: 기술 효과 그림이 2배로 커져서 판정도 보이는 크기만큼 조금 넓힘(돌진 x1 100 → 116, 회전 ±84/±92 → ±100/±110,
  //   화염구 탄 40x34 → 56x46, 터짐 r 64 → 92·depth 40 → 50, 번개 r 26 → 34·depth 28 → 32). 데미지·쿨타임은 그대로
  var KNIGHT_DASH_HIT = { reach: { x0: -20, x1: 116, yTop: -112, yBot: -4, depth: 20 },
                          dmg: 1.9, hitstop: 0.55, knock: 1.4, shake: 1.3, knockdown: true, spark: 1.3, big: true, hitY: -62 };
  var KNIGHT_DASH_FINALE = { ifHit: true, hitstopMs: 120, shake: 2.8, slowMs: 260, flash: { color: '#d8ecff', alpha: 0.4, ms: 140 } };
  var SPIN_REACH = { x0: -100, x1: 100, yTop: -108, yBot: -6, depth: 20 };
  var SPIN_HIT = { reach: SPIN_REACH, away: true, dmg: 0.8, hitstop: 0.7, knock: 0.7, shake: 1.2, spark: 1.1, hitY: -60 };
  var SPIN_LAST = { reach: { x0: -110, x1: 110, yTop: -112, yBot: -4, depth: 22 }, away: true,
                    dmg: 1.6, hitstop: 2.2, knock: 2.6, shake: 3.0, knockdown: true, spark: 1.5, big: true, hitY: -60,
                    flash: { color: '#e6f2ff', alpha: 0.45, ms: 150 }, slowMs: 280 };
  // 불·번개 기술은 법사 보라 반짝임(impactFx) 대신 기본 불똥(노랑·흰색)이 효과 색과 어울림
  var FIRE_HIT = { dmg: 2.8, hitstop: 2.0, knock: 2.4, shake: 3.0, knockdown: true, spark: 1.4, big: true,
                   flash: { color: '#ffb060', alpha: 0.4, ms: 160 }, slowMs: 240 };
  // 터짐 판정 = 보이는 폭발 크기(fire_explosion 가장 큰 장 반지름 약 57~64 → r 64), 위아래(안쪽) 폭 40
  //   (위아래로 살짝 어긋나 서 있는 바로 뒤 적도 맞게, 2026-11-03 예전 r 56 / depth 24 는 뒤 적이 자주 빠짐)
  var FIRE_BURST = { r: 92, depth: 50, art: 'fire_explosion', fromFrame: 1, scale: 1.7, tint: '#ff6a10', tintK: 0.6 };
  var BOLT_HIT = { dmg: 1.05, hitstop: 1.2, knock: 0.4, shake: 1.8, stunMs: 450, spark: 1.2, big: true,
                   flash: { color: '#e8ffff', alpha: 0.3, ms: 90 } };
  var BOLT_HITS = [ BOLT_HIT, merge(BOLT_HIT, {}),
    { dmg: 1.7, hitstop: 2.2, knock: 2.2, shake: 3.2, knockdown: true, spark: 1.5, big: true,
      flash: { color: '#ffffff', alpha: 0.5, ms: 150 }, slowMs: 260 } ];
  // 번개 3줄기: 첫 번개 = 3장(내리꽂기) 시작, 그 뒤 gapMs 마다.
  //   aim = 앞쪽 가까운 적을 겨눔: range = 법사 앞 최대 거리, depth = 위아래(안쪽) 몇 도트까지 찾나.
  //     1번 번개 = 가장 가까운 적, 2·3번 = 그다음 가까운 적(적이 하나뿐이면 같은 적). 바닥 표시(markMs 전부터)가 그 적 발밑을 따라가다가
  //     떨어지기 lockMs(기본 90ms) 전에 자리를 고정
  //   찾는 적이 없으면 xs = 법사 앞 고정 거리(가까운 곳 → 먼 곳)
  function strikesOf(gapMs, xs) {
    return { frame: 3, gapMs: gapMs, x: xs, aim: { range: 200, depth: 60 }, markMs: 240, r: 34, depth: 32, ms: 220,
             art: 'lightning_bolt', hitArt: 'lightning_impact', hitFromFrame: 1, color: '#59e6ff', core: '#ffffff', glow: '#fff27a', hits: BOLT_HITS };
  }
  var SKILLS = {
    knight: {
      // 돌진베기: 1~2장 동안 앞으로 약 120도트 미끄러지며 길 위의 적을 한 번씩 벤다(무적), 베는 장 다음 장에 「쾅」 멈춤
      A: {
        name: '돌진베기', icon: '돌', cooldownMs: 4000, damageStyle: 'skill_knight', motion: 'motion_dash',
        darken: { ms: 460, alpha: 0.45 },
        iframes: { frames: [0, 4] },
        move: { frames: [1, 2], dist: 120 },
        trail: { frames: [1, 3], everyMs: 30, lifeMs: 180, alpha: 0.35, color: '#9cc8ff' },
        hits: [ merge(KNIGHT_DASH_HIT, { frames: [1, 3] }) ],
        finale: merge(KNIGHT_DASH_FINALE, { frame: 4 }),
        fx: [
          { frame: 1, type: 'dust' },
          { frame: 1, type: 'art', fx: 'dash_trail', x: -12, y: -52, layer: 'back', follow: true },
          { frame: 3, type: 'art', fx: 'slash_wave', x: 80, y: -62, vx: 160,
            ph: { type: 'slash', x: 28, y: -62, rot: -8, sx: 1.7, sy: 1.35, tint: '#a8d4ff', ms: 260 } }
        ],
        placeholder: { anim: 'attack1', f: [0, 1, 3, 3, 4], d: [70, 40, 180, 160, 110] },
        // 여: 1장 수평 돌진 → 2장 올려베기(판정) → 3장 머리 위로 돌며 후속. 돌진은 1~2장에 걸쳐(그림 자료는 1장만이지만
        //   2장도 앞으로 쏠린 자세라 이어서 미끄러짐), 판정은 3장(후속)까지 → 올려베기 파동이 지나가는 적도 맞음
        female: {
          iframes: { frames: [0, 4] },
          trail: { frames: [1, 2], everyMs: 30, lifeMs: 180, alpha: 0.35, color: '#9cc8ff' },
          hits: [ merge(KNIGHT_DASH_HIT, { frames: [1, 3], reach: { x0: -20, x1: 116, yTop: -124, yBot: -4, depth: 20 } }) ],
          finale: merge(KNIGHT_DASH_FINALE, { frame: 4 }),
          fx: [
            { frame: 1, type: 'dust' },
            { frame: 1, type: 'art', fx: 'dash_trail', x: -8, y: -60, layer: 'back', follow: true },
            { frame: 2, type: 'art', fx: 'slash_wave', x: 84, y: -76, rot: -35, vx: 160,
              ph: { type: 'slash', x: 30, y: -70, rot: -35, sx: 1.6, sy: 1.3, tint: '#a8d4ff', ms: 260 } }
          ],
          placeholder: { anim: 'attack1', f: [0, 1, 2, 2, 3], d: [70, 40, 180, 160, 110] }
        }
      },
      // 회전베기: 제자리에서 한 바퀴 돌며 1·3·5장에 앞뒤 둘레를 벤다, 5장(마무리)에 넘어뜨림 + 둘레 적을 밀어냄
      B: {
        name: '회전베기', icon: '회', cooldownMs: 7000, damageStyle: 'skill_knight', motion: 'motion_spin',
        darken: { ms: 600, alpha: 0.45 },
        iframes: { frames: [0, 5] },
        hits: [ merge(SPIN_HIT, { frame: 1 }), merge(SPIN_HIT, { frame: 3 }), merge(SPIN_LAST, { frame: 5 }) ],
        fx: [
          { frame: 1, type: 'art', fx: 'spin_ring', x: 0, y: -50, follow: true, split: true, alpha: 0.7, scale: 0.75,
            ph: { type: 'ring', y: -58, r: 70, ms: 300, color: '#cfe8ff' } },
          { frame: 5, type: 'ring', y: -56, r: 86, ms: 220, color: '#ffffff' },
          { frame: 5, type: 'dust' }
        ],
        placeholder: { anim: 'attack2', f: [0, 2, 3, 2, 3, 2, 3, 4], d: [90, 75, 75, 75, 75, 75, 125, 130], spin: [90, 560], everyMs: 75 },
        female: {
          fx: [
            { frame: 1, type: 'art', fx: 'spin_ring', x: 0, y: -56, follow: true, split: true, alpha: 0.7, scale: 0.75, fps: 22,
              ph: { type: 'ring', y: -58, r: 70, ms: 260, color: '#cfe8ff' } },
            { frame: 5, type: 'ring', y: -56, r: 86, ms: 220, color: '#ffffff' },
            { frame: 5, type: 'dust' }
          ],
          placeholder: { anim: 'attack2', f: [0, 1, 2, 3, 1, 2, 3, 4], d: [90, 75, 75, 75, 75, 75, 125, 130], spin: [90, 560], everyMs: 75 }
        }
      }
    },
    mage: {
      // 화염구: 마법탄보다 크고 묵직한 불덩이. 처음 맞은 적(또는 끝까지 날아간 곳)에서 크게 터져 주변을 넘어뜨림
      //   발사 = 남 3장(+127,-65, 260/초, 240) / 여 2장(+85,-75, 340/초, 220) (그림 자료 motions.json)
      A: {
        name: '화염구', icon: '화', cooldownMs: 4500, damageStyle: 'skill_fire', motion: 'motion_cast_forward',
        darken: { ms: 480, alpha: 0.4 },
        iframes: { frames: [0, 3] },
        cast: { frame: 3, x: 127, y: -65, speed: 260, range: 240, box: { w: 56, h: 46 }, depth: 18, backReach: 110,
                art: 'fireball', scale: 1.7, tint: '#ff7a1a', tintK: 0.78, emberMs: 45, burst: FIRE_BURST, hit: FIRE_HIT },
        fx: [ { frame: 3, type: 'spark', x: 127, y: -65, scale: 1.5, tint: '#ffa040' } ],
        placeholder: { anim: 'attack3', f: [0, 1, 2, 3, 4, 5], d: [80, 90, 60, 150, 110, 110] },
        female: {
          cast: { frame: 2, x: 85, y: -75, speed: 340, range: 220, box: { w: 56, h: 46 }, depth: 18, backReach: 75,
                  art: 'fireball', scale: 1.7, tint: '#ff7a1a', tintK: 0.78, emberMs: 40, burst: FIRE_BURST, hit: FIRE_HIT },
          fx: [ { frame: 2, type: 'spark', x: 85, y: -75, scale: 1.5, tint: '#ffa040' } ],
          placeholder: { anim: 'attack3', f: [0, 1, 2, 3, 4], d: [70, 90, 150, 140, 150] }
        }
      },
      // 번개: 3장(내리꽂기)부터 법사 앞 바닥 3곳에 차례로 화면 맨 위에서 번개가 꽂힌다(가까운 곳 → 먼 곳).
      //   맞으면 잠깐 감전(stun), 마지막은 넘어뜨림. 가운데 번개 자리 = 그림 자료의 낙하점(남 +120, 여 +110)
      B: {
        name: '번개', icon: '번', cooldownMs: 8000, damageStyle: 'skill_bolt', motion: 'motion_cast_sky',
        darken: { ms: 950, alpha: 0.5 },
        iframes: { frames: [0, 2] },
        strikes: strikesOf(120, [75, 120, 165]),
        placeholder: { anim: 'attack2', f: [0, 1, 2, 3, 3, 3, 4], d: [80, 90, 60, 160, 160, 110, 100] },
        female: {
          strikes: strikesOf(100, [70, 110, 150]),
          placeholder: { anim: 'attack3', f: [0, 1, 2, 2, 2, 3, 4], d: [80, 90, 160, 160, 120, 80, 70] }
        }
      }
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
    // 달리기·점프 (2026-11-03, art\stage1\motions_move → 같은 옷 폴더). run 8 · jump 5 · run_attack 5 · jump_attack 4 장.
    //   장마다 시간·보폭·판정은 motions_move.json(CFG.move.data)의 moveWho 항목, 손 위치 = anchors_move_<옷_성별>.json
    def.anims.run = { frames: seq(p + 'run_', 8), fps: 12, loop: true };
    def.anims.jump = { frames: seq(p + 'jump_', 5), fps: 12, loop: false };
    def.anims.run_attack = { frames: seq(p + 'run_attack_', 5), fps: 12, loop: false };
    def.anims.jump_attack = { frames: seq(p + 'jump_attack_', 4), fps: 12, loop: false };
    def.moveAnchors = 'assets/chars/stage1/anchors_move_' + (outfit ? outfit + '_' : '') + who + '.json';
    def.moveWho = (outfit || 'novice') + '_' + who;
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

  // ---------- 1단계 배경 = 숲 (art\stage1-bg 에서 복사) ----------
  // 뒤 → 앞 순서. parallax = 카메라가 1 움직일 때 그 층이 움직이는 비율. mid 는 판 끝에서 그림이 딱 끝나게 자동으로 맞춤(최대 0.5)
  // floorY = 그림 속 바닥(풀 경계)이 시작하는 높이, laneTop/laneBottom = 그림 속 걸을 수 있는 길(흙길)
  // 판마다 bg 를 따로 둔다(아래 stages). 새 배경 = 이것과 같은 모양으로 하나 더 만들어 그 판 bg 에 넣기
  var BG_FOREST = {
    far:    { img: 'assets/bg/stage1/far.png',    w: 512,  tile: true,  parallax: 0.15 },
    mid:    { img: 'assets/bg/stage1/mid.png',    w: 1658, tile: false, parallax: 0.5 },
    ground: { img: 'assets/bg/stage1/ground.png', w: 723,  tile: true,  parallax: 1.0 },
    height: 240, floorY: 144, laneTop: 158, laneBottom: 230
  };
  // ---------- 2단계 배경 = 폐광 동굴 (art\stage2-bg 에서 복사, 2026-11-04) ----------
  // 갱도 입구 → 채굴 캠프 → 무너진 깊은 갱도. 크기·바닥·걷는 길은 숲과 같음(mid 가 3장이라 더 짧음 → 판 끝에 맞춰 자동으로 느리게 흐름)
  var BG_MINE = {
    far:    { img: 'assets/bg/stage2/far.png',    w: 512,  tile: true,  parallax: 0.15 },
    mid:    { img: 'assets/bg/stage2/mid.png',    w: 1247, tile: false, parallax: 0.5 },
    ground: { img: 'assets/bg/stage2/ground.png', w: 719,  tile: true,  parallax: 1.0 },
    height: 240, floorY: 144, laneTop: 158, laneBottom: 230
  };
  // ---------- 4단계 배경 = 사막 유적 (art\stage4-bg 에서 복사, 2026-11-04) ----------
  // 신전 정문 → 석상 광장 → 안쪽 성소. 크기·바닥·걷는 길은 1·2단계와 같음(mid 3장 = 2단계와 같은 길이)
  var BG_DESERT = {
    far:    { img: 'assets/bg/stage4/far.png',    w: 512,  tile: true,  parallax: 0.15 },
    mid:    { img: 'assets/bg/stage4/mid.png',    w: 1247, tile: false, parallax: 0.5 },
    ground: { img: 'assets/bg/stage4/ground.png', w: 715,  tile: true,  parallax: 1.0 },
    height: 240, floorY: 144, laneTop: 158, laneBottom: 230
  };

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
      // 매끈한 2배(HD, 2026-11-03): 게임 계산은 전부 240줄 도트 그대로 두고, 캔버스는 이 배수로 크게 만들어 부드럽게 그린다.
      //   2 = 480줄(HD 그림 assets/hd, 그림 1점 = 0.5 도트, 테두리 매끈·원래 색). 1 = 예전 도트 화면(작은 도트 그림 assets/s055).
      //   주소 뒤 ?rs=1 로 예전 화면을 잠깐 볼 수 있다. HD 그림은 pipeline/ai-sprite/hd_bake.py 로 굽는다(art/stage1/README 「매끈한 2배 버전」)
      renderScale: 2,
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
      speedX: 115,          // 1초에 도트 몇 칸 (좌우)  (2026-11-03: 90 → 104 → 115, 걷기 조금 더 빠르게)
      speedY: 69,           // 위아래 (안쪽/바깥쪽)  (55 → 63 → 69)
      startX: 200,
      hitbox: { x0: 8, x1: 92, yTop: -100, yBot: -18, depth: 14 } // 발 기준, 오른쪽 볼 때
    },

    // ---------- 달리기 · 점프 · 달리며 공격 · 공중 공격 (2026-11-03, art\stage1 README 「달리기·점프」) ----------
    // 그림별 시간·보폭·점프 높이·판정 상자(reach)는 data(motions_move.json, 원래 그림 크기 기준 → 쓸 때 actorScale 곱함).
    // 여기 값은 손맛 조절용. 속도는 「걷기 속도(player.speedX, 이미 줄인 값) x 배율」이라 actorScale 이 바뀌어도 비율이 그대로.
    move: {
      data: 'assets/chars/stage1/motions_move.json',
      doubleTapMs: 250,     // 키보드: 같은 쪽(←/→)을 이 시간 안에 두 번 누르면 달리기(누르고 있는 동안)
      runMul: 2.08,         // 달리기 속도 = 걷기 x 2.08 (걷기를 115로 올리면서 달리기 속도는 그대로: 104x2.3 ≈ 115x2.08) (견습 남 약 177 도트/초). 그림은 「달린 거리」로 넘김 → 발이 안 미끄러짐
      runDepthMul: 0.55,    // 달리면서 위아래(안쪽) = 걷기 위아래 x 0.55 (느리게)
      joyHoldAt: 0.5,       // 폰: 조이스틱을 가로로 이만큼(0~1) 이상 밀고
      joyHoldMs: 450,       //     같은 쪽으로 이 시간(ms) 계속 밀고 있으면 달리기 (2026-11-03: 끝까지 밀기 → 계속 밀기로 변경)
      joyFlickMs: 280,      // 폰: 손을 뗐다가 이 시간 안에 같은 쪽으로 다시 밀면 달리기(살짝만 밀어도)
      jump: {
        bufferMs: 150,      // 미리 눌러 둔 점프 기억 시간
        heightMul: 1.0,     // 점프 높이 = data 추천 높이(남 70 / 여 78) x actorScale x 이 값
        airMul: 1.0,        // 공중 시간 = data 추천(남 560 / 여 520 ms) x 이 값
        steer: 5,           // 공중에서 좌우로 방향 바꾸는 힘(클수록 빨리 바뀜). 안 누르면 뛴 속도 그대로 날아감(달려서 뛰면 멀리)
        depthMul: 0.5,      // 공중에서 위아래(안쪽) 이동 = 걷기 위아래 x
        overBodyZ: 10       // 이 높이(도트) 넘게 뜨면 적 몸에 안 막힘(위로 넘어감)
      },
      // 달리며 공격: 남 = 어깨 돌진, 여 = 슬라이딩. entry → 밀고 가는 반복(1·2장, minLoopMs~maxLoopMs) → finish → recover
      //   밀고 가는 동안 tickMs 마다 앞에 닿은 적을 작게 때리고(tick) 주인공과 함께 앞으로 민다. 닿았던 적이 떨어지면 일찍 마무리.
      //   마무리(finish): 어깨 돌진 = 멀리 날려 보냄(넘어뜨리지 않음), 슬라이딩 = 띄워 넘어뜨림. 보스는 안 넘어지고 조금만 밀림
      runAttack: {
        minLoopMs: 300, maxLoopMs: 450, tickMs: 90,
        speedMul: 1.0,      // 밀고 가는 속도 = data pushLoopSpeed(남 300 / 여 330) x actorScale x 이 값
        depth: 10,          // 위아래 판정 폭(도트, 원래 크기 기준 아님 = 이미 작은 값)
        bossPush: 0.25,     // 보스는 이만큼만 같이 밀림
        tick:   { dmg: 0.3, hitstop: 0.25, knock: 0.15, shake: 0.35, spark: 0.55, hitY: -50, noJuggle: true, numStyle: 'push', mergeNum: true, flashK: 0.35 },
        charge: { dmg: 1.3, hitstop: 1.6, knock: 6.0, shake: 1.9, spark: 1.1, hitY: -56, noKnockdown: true, crit: true, big: true },
        slide:  { dmg: 1.2, hitstop: 1.5, knock: 1.6, shake: 1.7, spark: 1.0, hitY: -30, knockdown: true, crit: true, big: true }
      },
      // 공중 공격: 1·2장이 판정. reachDown = 판정 상자를 아래로 더 늘림(원래 크기 도트, 내려치기가 땅 위 적에게 닿게)
      jumpAttack: { dmg: 1.2, hitstop: 1.1, knock: 1.3, shake: 1.2, spark: 0.9, knockdown: true, reachDown: 34, depth: 10 }
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
      // 기술 숫자 (2026-11-03): 마무리 숫자(huge 12도트)보다 큰 giant(8x14, 굵게 → 획 3도트). 기술마다 색이 다름
      //   기술 쪽에서 damageStyle 로 고른다(CFG.skills). 새 모양을 만들면 여기에 이름을 하나 더 적고 기술의 damageStyle 을 그 이름으로
      skill_knight: { font: 'giant', scale: 1, bold: true, top: '#ffffff', bottom: '#9cc8ff', outline: '#1a2a4a', shadow: 'rgba(8,14,30,0.45)',
                      pop: { top: '#ffffff', bottom: '#ffffff' } },
      skill_fire:   { font: 'giant', scale: 1, bold: true, top: '#ffd27a', bottom: '#ff5a1e', outline: '#4a1408', shadow: 'rgba(30,8,4,0.45)',
                      pop: { top: '#fff4d0', bottom: '#ffb040' } },
      skill_bolt:   { font: 'giant', scale: 1, bold: true, top: '#fff6a0', bottom: '#5ae6ff', outline: '#14244a', shadow: 'rgba(6,12,30,0.45)',
                      pop: { top: '#ffffff', bottom: '#fff6a0' } },
      // 달리며 공격의 밀고 가는 작은 타(2026-11-03): 보통 숫자보다 작고(large 8도트) 하늘색 → 마무리 숫자와 구분
      push: { font: 'large', scale: 1, top: '#e8fbff', bottom: '#8fd6ff', outline: '#163048', shadow: 'rgba(8,14,30,0.35)',
              pop: { top: '#ffffff', bottom: '#d8f4ff' } },
      // 음식 먹고 회복한 양(2026-11-04): 초록 숫자, 보통 숫자와 같은 크기
      heal: { font: 'mid', scale: 1, top: '#d6ffc4', bottom: '#4cd64a', outline: '#123a16', shadow: 'rgba(6,30,10,0.35)',
              pop: { top: '#ffffff', bottom: '#a8ff8a' } },
      hurtBottom: '#b82c26',
      popK: 0.12,
      // 여러 번 한꺼번에 맞을 때 숫자 쌓기 (2026-11-03, 메이플처럼 위로 줄 세움, fx.js 의 FX.damage)
      //   같은 대상에 windowMs 안에 또 맞으면 그 위 줄에 쌓는다(최대 cap 줄 — 넘치면 가장 오래된 줄이 빨리 사라짐).
      //   줄 사이 gap 도트, 줄마다 jitter 만큼 좌우로 살짝 어긋남. 다른 대상의 숫자와 겹치면 위(또는 옆)로 비켜 섬
      stack: { windowMs: 480, cap: 5, gap: 0.5, jitter: [0, 3, -3, 2, -2, 1] },
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
      },
      // 미리 서 있는 적(판 waves 의 placed)이 깨는 조건: 플레이어가 dist 도트 안으로 오면(크기 배율 안 곱함, 화면 도트 그대로)
      //   깨면 머리 위 「!」를 alertMs 동안 보이며 멈춰 있다가 싸움. 같은 무리(group)는 groupDelayMs 안에서 조금씩 늦게 깸
      wake: { dist: 90, alertMs: 300, groupDelayMs: 150 }
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
      },

      // ===== 2단계 적 (art\stage2-enemies 에서 복사, 2026-11-04). 그림은 판을 시작할 때 그 판에 나오는 적만 불러온다(main.js goStage) =====
      // 거대 박쥐: 늑대처럼 치고 빠지기. 그림 속 몸이 기준점(땅) 위 46도트에 떠 있음 → 기준점은 땅(그림자·위아래 줄은 보통 적과 같음)
      //   flying = 나는 적: { bob = 떠 있을 때 위아래로 흔들리는 도트, bobMs = 한 번 흔들리는 시간, jumpDmgMul = 점프 공격 데미지 배율(점프 공격에 맞으면 늘 떨어짐) }
      //   나는 적은 소품(수레·상자)에 안 막히고 위로 지나간다. 넘어짐 = 땅에 떨어짐, 일어남 = 날개 치며 다시 떠오름
      bat: {
        label: '거대 박쥐', frameW: 208, frameH: 160, pivot: { x: 104, y: 154 },
        anims: enemyAnims('bat', {
          idle: [4, 10, true], fly: [6, 10, true],
          attack: [5, 12, false, [1, 1, 1, 2, 3, 3, 4, 5]],   // 1 날개 치켜듦·비명(예고) · 2 내리꽂기 · 3 물기 · 4 솟구침 · 5 떠 있음
          hit: [3, 10, false, [1, 2, 2, 3]],
          hit2: [3, 10, false, [1, 1, 2, 2, 3]],
          knockdown: [4, 10, false, [1, 2, 2, 3, 4, 4, 4]],       // 뒤집힘 → 거꾸로 떨어짐 → 땅에 쾅 → 누움(4)
          getup: [3, 8, false, [1, 1, 2, 2, 3]],                  // 엎드려 으르렁 → 날개 치며 뜸 → 떠 있음
          death: [5, 8, false, [1, 2, 3, 4, 5]]
        }),
        walkAnim: 'fly',
        flying: { bob: 2, bobMs: 900, jumpDmgMul: 1.5 },
        down: { slide: 60, lyingFrames: [3, 4] },
        hp: 40, speedX: 100, speedY: 66, radius: 22, height: 96,
        hurtbox: { x0: -15, x1: 28, yTop: -92, yBot: -44 },     // 떠 있는 몸(땅에서 44~92 위)
        engage: 70, hover: [140, 190], range: [40, 100], alignY: 9, cooldown: [1400, 2400], firstCooldown: [400, 1300],
        retreatMs: 1000,          // 물고 나서 뒤로 빠지는 시간 (치고 빠지기)
        knockResist: 1.3, deathKnock: 200,
        attacks: {
          swoop: { anim: 'attack', active: [2, 3], reach: { x0: 22, x1: 58, yTop: -68, yBot: -30 }, depth: 12,
                   dmg: [5, 7], knock: 12, move: { frames: [2, 3], dist: 44 }, telegraph: [1] }
        }
      },
      // 해골 병사: 고블린처럼 칼로 내려치기 + 방패 막기(guard)
      //   guard = 앞에서 오는 보통 타를 가끔 방패로 막음: chance = 막을 확률, cdMs = 한 번 막은 뒤 다시 막기까지 시간,
      //     holdMs = 방패를 들고 있는 시간(그동안 앞에서 오는 보통 타는 다 막음), maxBlocks = 그 사이 최대 몇 번 막나(넘으면 방패 내림),
      //     push = 막을 때 해골이 뒤로 밀리는 거리, flashMs = 막는 순간 그림(block 2번) 보이는 시간, counterMs = 방패 내린 뒤 바로 반격까지 시간
      //   뒤에서 / 기술 / 달리며 공격 / 점프 공격 / 콤보 마무리 타 = 방패 깨짐(그대로 맞음). 공격 중·맞는 중에는 안 막음
      skeleton: {
        label: '해골 병사', frameW: 176, frameH: 136, pivot: { x: 92, y: 130 },
        anims: enemyAnims('skeleton', {
          idle: [4, 6, true], walk: [8, 10, true],
          attack: [5, 10, false, [1, 2, 2, 2, 3, 4, 4, 5]],   // 1 칼 뒤로 · 2 머리 위로 치켜듦(예고) · 3 찌르기 · 4 내려침 · 5 복귀
          block: [2, 8, false, [1, 2, 2, 1]],                 // 1 방패 들기 · 2 막으며 젖혀짐
          hit: [3, 10, false, [1, 2, 2, 3]],
          hit2: [3, 10, false, [1, 1, 2, 2, 3]],
          knockdown: [5, 10, false, [1, 2, 2, 3, 4, 5, 4, 5]],
          getup: [3, 8, false, [1, 1, 2, 2, 3]],
          death: [5, 8, false, [1, 2, 3, 4, 5]]                // 눈빛 꺼짐 → 무너짐 → 뼈 무더기(5)
        }),
        walkAnim: 'walk',
        down: { slide: 80, lyingFrames: [3, 4, 5] },
        hp: 80, speedX: 40, speedY: 28, radius: 15, height: 92,
        hurtbox: { x0: -10, x1: 27, yTop: -90, yBot: 0 },
        engage: 50, hover: [100, 150], range: [24, 74], alignY: 7, cooldown: [1200, 2200], firstCooldown: [600, 1600],
        knockResist: 0.9, deathKnock: 200,
        guard: { anim: 'block', chance: 0.4, cdMs: 2600, holdMs: 900, maxBlocks: 3, push: 18, flashMs: 120, counterMs: 250 },
        attacks: {
          chop: { anim: 'attack', active: [3, 4], reach: { x0: 18, x1: 86, yTop: -78, yBot: -36 }, depth: 12,
                  dmg: [7, 10], knock: 14, telegraph: [2] }
        }
      },
      // 돌 골렘(2단계 보스): 오크 족장과 같은 보스 규칙(공격 중 안 끊김, 체력 66%·33% 휘청, 절반에서 화남 + 졸개 부름)
      //   공격: slam = 두 주먹 내려찍기(무거움, 땅에 바위 터짐) / sweep = 팔 휘두르기 / throw = 바위 던지기
      //   throw: 땅에서 바위를 뽑아 들고(예고) spawnFrame 그림에서 던짐(spawn = 손 위치, 앞 = +) → 던질 때 플레이어 자리(maxRange 까지)로
      //     flightMs 동안 포물선(arcPeak 높이)으로 날아감. 떨어질 자리에 빨간 원(예고) → 떨어지면 바위 터짐 효과 + 흔들림,
      //     radius(가로)·depth(위아래) 안에 있으면 맞음(높이 뛰어 있으면 피함). burst = 내려찍기 땅 터짐 { x = 앞 거리, scale = 그림 크기 }
      //   stagger.core = 휘청 1·2·4 장에서 가슴 핵 자리(x 앞 +, y)에 그리는 주황 빛(3장 = 핵이 꺼짐 = 때릴 기회)
      //   fxArt = 이 적이 쓰는 효과 그림(바위·바위 터짐). 적 그림과 같이 불러온다
      golem: {
        label: '돌 골렘', boss: true, frameW: 320, frameH: 232, pivot: { x: 168, y: 226 },
        anims: enemyAnims('golem', {
          idle: [4, 5, true], walk: [6, 8, true],
          attack1: [5, 8, false, [1, 2, 2, 2, 2, 3, 4, 4, 4, 5]],   // 내려찍기: 2 두 주먹 치켜듦(예고) → 4 땅에 박힘
          attack2: [5, 9, false, [1, 1, 1, 2, 3, 4, 4, 5]],         // 팔 휘두르기: 1 뒤로 젖힘(예고) → 3 쭉 뻗음
          special: [5, 8, false, [1, 1, 2, 3, 3, 3, 3, 4, 4, 5]],   // 바위 던지기: 1 뽑기 · 3 머리 위로(예고) · 4 던짐
          hit: [3, 8, false, [1, 2, 2, 3]],
          hit2: [3, 8, false, [1, 1, 2, 2, 3]],
          stagger: [4, 7, false, null],                              // 휘청: 장마다 시간은 아래 stagger.d
          death: [5, 6, false, [1, 1, 2, 2, 3, 4, 5]]                // 핵 갈라짐 → 무릎 → 무너짐 → 돌무더기
        }),
        fxArt: {
          boulder:   { frames: seq(EN + 'boulder/boulder_', 4),     pivot: { x: 32, y: 32 }, fps: 12 },   // 날아가는 바위(가운데 기준, 돌며 날아감)
          rockburst: { frames: seq(EN + 'rockburst/rockburst_', 5), pivot: { x: 64, y: 84 }, fps: 12 }    // 바위 터짐(바닥 가운데 기준)
        },
        walkAnim: 'walk',
        // 체력·데미지: 자동 조종(?bot=1, 피하지 않음) 시험에서 오크(1단계)보다 한 단계 버겁게 맞춤(2026-11-04)
        hp: 1050, speedX: 30, speedY: 24, radius: 42, height: 150,
        hurtbox: { x0: -34, x1: 55, yTop: -150, yBot: 0 },
        engage: 70, hover: [70, 90], range: [40, 160], alignY: 10, cooldown: [1100, 1900], firstCooldown: [1200, 1500],
        knockResist: 0.2, deathKnock: 50,
        staggerCdMs: 2200,
        superArmor: true,
        stagger: { at: [0.66, 0.33], onWall: false, d: [280, 140, 900, 300], core: { x: 8, y: -70, r: 12, color: '#ff8a2a' } },
        enrageAt: 0.5,
        enrage: { speedMul: 1.25, cooldownMul: 0.7, summon: ['skeleton', 'bat', 'bat'] },
        attacks: {
          slam:  { anim: 'attack1', active: [3, 4], reach: { x0: 30, x1: 100, yTop: -80, yBot: 0 }, depth: 16,
                   dmg: [18, 21], knock: 34, flinchMs: 450, telegraph: [2], shake: 2.6, when: [30, 100], weight: 3, heavy: true,
                   burst: { x: 85, scale: 0.6 } },
          sweep: { anim: 'attack2', active: [3, 4], reach: { x0: 30, x1: 136, yTop: -125, yBot: -60 }, depth: 14,
                   dmg: [13, 16], knock: 30, flinchMs: 400, telegraph: [1], shake: 1.6, when: [60, 150], weight: 3 },
          throw: { type: 'throw', anim: 'special', telegraph: [1, 3], spawnFrame: 4, spawn: { x: 110, y: -112 },
                   flightMs: 650, arcPeak: 60, maxRange: 300, radius: 42, depth: 18, dodgeZ: 24,
                   dmg: [18, 22], knock: 30, flinchMs: 450, shake: 2.8, when: [110, 400], weight: 2, heavy: true }
        }
      },

      // ===== 4단계 적 (art\stage4-enemies 에서 복사, 2026-11-04). 수치 = 그 폴더 anchors_*.json 의 suggest =====
      // 미라: 느리고 단단한 고블린. 두 팔 잡기(grab): 팔 치켜듦(긴 예고, 바닥 빨간 띠) → 3장 두 손 뻗기에 닿으면 붙잡음
      //   grab = 잡기 { ms = 붙잡고 있는 시간(플레이어 조작 불가), mashMs = 버튼(공격·점프·기술) 한 번 누를 때마다 줄어드는 시간,
      //     minMs = 아무리 눌러도 이만큼은 잡혀 있음, holdFrame = 붙잡는 동안 보이는 그림(4 = 손 움켜쥠), dist = 붙잡힌 플레이어가 서는 거리(앞 +) }
      //   다 되면 놓으면서 dmg 데미지 + 내던짐(heavy = 넘어짐, knock 만큼 밀림). 붙잡는 동안 다른 적의 공격은 안 맞음(한꺼번에 몰매 없게)
      //   showTelegraph = 잡몹이어도 바닥 예고 띠를 그림(보통 잡몹은 보스만 그림)
      //   걷기: 그림 속 보폭이 작은 「질질 끄는 걸음」이라 느리게. 그림 자료는 30도트/초에 7fps(한 장에 약 4.3도트) →
      //   판이 너무 늘어지지 않게 36도트/초로 올리고 그림도 같은 비율로 8.4fps(발이 안 미끄러짐). 속도를 바꾸면 walk fps 도 같은 비율로
      mummy: {
        label: '미라', frameW: 176, frameH: 136, pivot: { x: 92, y: 130 },
        anims: enemyAnims('mummy', {
          idle: [4, 5, true], walk: [8, 8.4, true],
          attack: [5, 9, false, [1, 1, 1, 2, 2, 3, 4, 4, 4, 5]],   // 1 두 팔 치켜듦(예고) · 2 앞으로 쏠림 · 3 두 손 뻗기(맞음) · 4 움켜쥠 · 5 복귀
          hit: [3, 10, false, [1, 2, 2, 3]],
          hit2: [3, 10, false, [1, 1, 2, 2, 3]],
          knockdown: [5, 10, false, [1, 2, 2, 3, 4, 5, 4, 5]],
          getup: [3, 6, false, [1, 1, 1, 2, 2, 2, 3]],             // 관에서 일어나듯 뻣뻣하게 천천히
          death: [5, 8, false, [1, 2, 3, 4, 5]]                    // 눈빛 꺼짐 → 붕대 풀림 → 붕대 더미 + 모래 먼지
        }),
        walkAnim: 'walk',
        down: { slide: 70, lyingFrames: [3, 4, 5] },
        hp: 100, speedX: 36, speedY: 25, radius: 16, height: 88,
        hurtbox: { x0: -16, x1: 26, yTop: -88, yBot: 0 },
        engage: 50, hover: [90, 140], range: [30, 72], alignY: 7, cooldown: [1600, 2600], firstCooldown: [700, 1800],
        knockResist: 0.8, deathKnock: 160,
        attacks: {
          grab: { anim: 'attack', active: [3], reach: { x0: 30, x1: 76, yTop: -80, yBot: -30 }, depth: 12, telegraph: [1, 2], showTelegraph: true,
                  dmg: [10, 13], knock: 30, flinchMs: 400, heavy: true, shake: 1.6,
                  grab: { ms: 650, mashMs: 110, minMs: 220, holdFrame: 4, dist: 40 } }
        }
      },
      // 전갈 왕(4단계 보스): 오크·골렘과 같은 보스 규칙(공격 중 안 끊김, 체력 66%·33% 휘청, 절반에서 화남 + 졸개 부름)
      //   몸이 「옆으로 넓고 낮음」: 몸 판정 앞 108 · 뒤 72, 높이 120(꼬리 끝 침은 뺌). 휘청 3장(뒤집혀 다리 버둥 = 때릴 기회)은 stagger.hurtbox
      //   공격: crush = 두 집게 조이기(3장 앞 160까지, 4장은 reachF 로 가까이) / sting = 꼬리 독침(무거움, 2~3장에 move 로 30 앞으로, 맞으면 잠깐 독)
      //     burrow = 땅속 숨기(특수): 몸을 일으킴(예고) → 파고듦(3장부터 무적) → 모래 둔덕(mound 그림)이 speed 로 플레이어를 쫓아감(최대 maxMs, 안 맞음)
      //       → 다 따라오면 warnMs 동안 둔덕이 떨리며 그 자리에 빨간 원(예고) → erupt 그림으로 솟구침(1~2장 판정, 앞뒤 다 맞음, 넘어짐) → 다시 맞을 수 있음
      //       catchR = 둔덕이 플레이어에 이만큼 가까워지면 멈춤, radius = 빨간 원·판정 가로 반지름,
      //       gapMs = 보스가 나타난 때 / 한 번 숨은 때부터 (다시) 숨기까지 최소 시간
      //   poison = 독 { ms = 독 시간, everyMs = 몇 ms 마다, dmg = 한 번에 깎는 체력(독으로는 체력 1 아래로 안 내려감) }
      scorpion: {
        label: '전갈 왕', boss: true, frameW: 320, frameH: 232, pivot: { x: 168, y: 226 },
        anims: enemyAnims('scorpion', {
          idle: [4, 5, true], walk: [6, 12, true],                 // 빠르게 종종걸음
          attack1: [5, 9, false, [1, 1, 1, 1, 2, 3, 4, 4, 5]],      // 집게 조이기: 1 두 집게 벌림(예고) → 3 앞으로 쭉 뻗어 조임 → 4 바짝 조임
          attack2: [5, 8, false, [1, 1, 2, 2, 2, 3, 4, 4, 5]],      // 꼬리 독침: 1~2 꼬리 높이 치켜듦(예고) → 3 머리 위로 내리꽂기
          burrow: [4, 8, false, [1, 1, 1, 2, 3, 4]],                // 땅속 숨기: 1 몸 일으킴(예고) · 2 파고듦 · 3 꼬리만 · 4 둔덕만
          erupt: [4, 9, false, [1, 1, 2, 2, 3, 4]],                 // 솟구침: 1 모래 분수 · 2 거의 서서 솟아오름(맞음) · 3 내리꽂힘 · 4 자세
          hit: [3, 8, false, [1, 2, 2, 3]],
          hit2: [3, 8, false, [1, 1, 2, 2, 3]],
          stagger: [4, 7, false, null],                              // 휘청: 장마다 시간은 아래 stagger.d (3장 = 뒤집힘)
          death: [5, 6, false, [1, 1, 2, 2, 3, 4, 5]]
        }),
        fxArt: {
          mound: { frames: seq(EN + 'mound/mound_', 4), pivot: { x: 80, y: 68 }, fps: 10 }   // 땅속으로 다가오는 모래 둔덕(바닥 가운데 기준)
        },
        walkAnim: 'walk',
        hp: 1100, speedX: 44, speedY: 30, radius: 56, height: 120,
        hurtbox: { x0: -72, x1: 108, yTop: -120, yBot: 0 },
        engage: 80, hover: [80, 100], range: [40, 170], alignY: 10, cooldown: [1000, 1800], firstCooldown: [1200, 1500],
        knockResist: 0.2, deathKnock: 50,
        staggerCdMs: 2200,
        superArmor: true,
        stagger: { at: [0.66, 0.33], onWall: false, d: [260, 160, 1000, 320], hurtbox: { x0: -112, x1: 113, yTop: -114, yBot: 0 } },
        enrageAt: 0.5,
        enrage: { speedMul: 1.25, cooldownMul: 0.7, summon: ['mummy', 'skeleton', 'mummy'] },
        attacks: {
          crush: { anim: 'attack1', active: [3, 4], reach: { x0: 60, x1: 160, yTop: -85, yBot: -25 }, reachF: { 4: { x0: 55, x1: 82, yTop: -78, yBot: -25 } }, depth: 16,
                   dmg: [14, 17], knock: 30, flinchMs: 400, telegraph: [1], shake: 1.6, when: [40, 170], weight: 3 },
          sting: { anim: 'attack2', active: [3], reach: { x0: 60, x1: 124, yTop: -110, yBot: 0 }, depth: 14, move: { frames: [2, 3], dist: 30 },
                   dmg: [16, 19], knock: 36, flinchMs: 450, telegraph: [1, 2], shake: 2.4, when: [70, 190], weight: 2, heavy: true,
                   poison: { ms: 2000, everyMs: 500, dmg: 2 } },
          burrow: { type: 'burrow', anim: 'burrow', eruptAnim: 'erupt', telegraph: [1], invuln: [3, 4], eruptInvuln: [1], active: [1, 2],
                    speed: 120, maxMs: 2200, warnMs: 450, catchR: 10, radius: 95, gapMs: 10000,
                    reach: { x0: -90, x1: 100, yTop: -200, yBot: 0 }, depth: 26,   // depth = 빨간 원 위아래 반지름과 같게
                    dmg: [17, 21], knock: 38, flinchMs: 500, shake: 3, when: [0, 500], weight: 2, heavy: true }
        }
      }
    },

    // ---------- 스테이지 (2026-11-04: 여러 판) ----------
    // 순서대로 1, 2, 3 … 판. 판 하나 = { id, name, width, healOnClear, bgTop, bg, waves, hpMul, dmgMul }
    //   width = 판 전체 길이(도트). waves = 화면이 멈추는 곳(at = 카메라 왼쪽 끝 위치, 'end' = 맨 끝 보스방)
    //   spawn = [종류, 나오는 쪽('L'/'R'), 몇 ms 뒤에, { variant: 'ice' }(없어도 됨)] 순서대로. 다 잡으면 「GO →」
    //   placed = 미리 서 있는 적(2026-11-04): [종류, x, y, { group, pose, variant, dir }]
    //     x = 그 웨이브 화면 왼쪽 끝(at)에서 몇 도트 오른쪽, y = 걷는 길 안 위치(0 = 맨 위, 1 = 맨 아래)
    //     카메라가 다가가면 그 자리에 가만히 서 있다가 → 플레이어가 ai.wake.dist 안으로 오거나 / 화면이 고정되거나 / 맞으면 깸
    //     → 머리 위 「!」 잠깐(ai.wake.alertMs) → 보통 적처럼 싸움. group 이 같으면 하나만 깨도 다 깸. 웨이브 클리어에 같이 셈
    //     pose = 쉬는 그림 이름(적 anims 에 그 그림이 있을 때만, 없으면 idle). dir = 바라보는 쪽(-1 왼쪽 기본, 1 오른쪽)
    //   props = 소품(2026-11-04): [{ type, x, y, drop }] x = 판 위 도트(소품 가운데), y = 걷는 길 안 위치(0~1). 그림·수치는 CFG.propTypes[type]
    //     drop = 부서질 때 나오는 음식: 'meat' / 'bread' / 'none' / 'random'(없으면 random = CFG.props.drop 확률)
    //     막는 소품(상자·통)은 걷는 길을 다 막지 않게 위아래로 비켜 두기(길 폭 약 72도트, 상자 하나가 약 10도트를 막음)
    //   healOnClear = 웨이브를 깰 때마다 체력 회복
    //   hpMul / dmgMul = 이 판 적 전부의 체력·공격력 배율(없으면 1) → 예전 몬스터를 「강한 버전」으로 다시 씀
    //   bg = 배경 3장(위 BG_FOREST 설명). 판을 시작할 때 그 판 배경만 불러온다(main.js useStage → Assets.ensureBg)
    // 새 판 넣기: 아래 목록 끝에 { id: 5, … } 하나 추가하면 끝(스테이지 고르기 화면·다음 스테이지는 자동)
    // 지금 하고 있는 판은 main.js 가 CFG.stage(+ CFG.bg = 그 판 bg)에 넣어 둔다 → 다른 코드는 예전처럼 CFG.stage 를 읽음
    // 시험 기간(2026-11-04 형님): 스테이지 고르기에서 모든 판을 처음부터 열어 둠. 정식으로 낼 때 false
    stagesAllOpen: true,
    stages: [
      {
        id: 1,
        name: 'STAGE 1  숲길',
        width: 2880,
        healOnClear: 15,
        bgTop: '#7fb2e5',           // 화면이 배경보다 높을 때 위쪽 하늘 색 (실제로는 배경 맨 윗줄을 늘려 씀)
        bg: BG_FOREST,
        waves: [
          { at: 120,  spawn: [['goblin', 'R', 0], ['goblin', 'R', 600], ['goblin', 'L', 2200]] },
          // 2: 길을 지키는 늑대 한 마리가 미리 서 있음 + 옆에서 지원
          { at: 500,  placed: [['wolf', 330, 0.5]],
                      spawn: [['goblin', 'L', 400], ['wolf', 'R', 1800], ['goblin', 'R', 2600]] },
          // 3: 모닥불(880 + 326) 양옆에 앉은 고블린 둘(camp1, 하나 깨면 둘 다 깸, 서로 불을 보고 있음) + 옆에서 지원
          { at: 880,  placed: [['goblin', 288, 0.38, { group: 'camp1', dir: 1 }], ['goblin', 364, 0.56, { group: 'camp1' }]],
                      spawn: [['goblin', 'L', 900], ['goblin', 'R', 3800], ['goblin', 'L', 4300]] },
          { at: 1260, spawn: [['wolf', 'R', 0], ['wolf', 'L', 500], ['goblin', 'R', 1200], ['wolf', 'R', 3400], ['goblin', 'L', 3800]] },
          // 5: 고블린 + 늑대가 같이 쉬고 있음(camp2) + 옆에서 지원
          { at: 1650, placed: [['goblin', 310, 0.4, { group: 'camp2' }], ['wolf', 370, 0.7, { group: 'camp2' }]],
                      spawn: [['wolf', 'R', 1000], ['goblin', 'R', 3600], ['wolf', 'L', 4000], ['goblin', 'R', 4800], ['wolf', 'R', 5400]] },
          { at: 2040, spawn: [['wolf', 'R', 0], ['wolf', 'R', 300], ['goblin', 'L', 700], ['goblin', 'R', 2800], ['goblin', 'L', 3200], ['wolf', 'R', 4200]] },
          { at: 'end', boss: true, spawn: [['orc', 'R', 0]] }
        ],
        // 소품: 3번 웨이브 고블린 모닥불 + 길가 상자·통(웨이브 화면 안에 보이게). 보스 앞 통 하나는 고기가 꼭 나옴
        props: [
          { type: 'crate',    x: 420,  y: 0.25 },
          { type: 'barrel',   x: 780,  y: 0.72 },
          { type: 'campfire', x: 880 + 326, y: 0.46 },
          { type: 'crate',    x: 1480, y: 0.66 },
          { type: 'barrel',   x: 1516, y: 0.3 },
          { type: 'crate',    x: 1870, y: 0.42, drop: 'bread' },
          { type: 'barrel',   x: 2330, y: 0.56, drop: 'meat' }    // 6번 웨이브 화면 끝 = 보스방 바로 앞
        ]
      },
      // ===== 2단계: 폐광 동굴 (2026-11-04 새 그림: 배경·소품·박쥐·해골 병사·돌 골렘) =====
      // 1단계보다 한 단계 어렵게: 새 적(치고 빠지는 박쥐·방패 드는 해골) + 고블린·늑대 섞음, 미리 서 있는 무리 2곳 + 박쥐 둥지, 보스 = 돌 골렘
      {
        id: 2,
        name: 'STAGE 2  폐광 동굴',
        width: 2880,
        healOnClear: 12,
        bgTop: '#2a2c4a',           // 화면이 배경보다 높을 때 위쪽 색 (실제로는 동굴 천장 맨 윗줄 색)
        bg: BG_MINE,
        hpMul: 1.1, dmgMul: 1.1,
        waves: [
          // 1: 갱도 입구 — 해골 병사·박쥐 첫 등장
          { at: 120,  spawn: [['skeleton', 'R', 0], ['bat', 'R', 700], ['goblin', 'L', 1800]] },
          // 2: 박쥐 둥지(roost) — 천장 쪽(길 위쪽)에 박쥐 셋이 떠 있음, 하나 깨면 다 깸 + 옆에서 지원
          { at: 500,  placed: [['bat', 300, 0.12, { group: 'roost' }], ['bat', 344, 0.3, { group: 'roost' }], ['bat', 380, 0.08, { group: 'roost' }]],
                      spawn: [['goblin', 'L', 500], ['skeleton', 'R', 2400]] },
          // 3: 화로(880 + 326) 양옆에 해골 병사 + 고블린(camp1) + 옆에서 지원
          { at: 880,  placed: [['skeleton', 288, 0.36, { group: 'camp1', dir: 1 }], ['goblin', 364, 0.58, { group: 'camp1' }]],
                      spawn: [['bat', 'R', 900], ['skeleton', 'L', 3400], ['wolf', 'R', 4200]] },
          { at: 1260, spawn: [['wolf', 'R', 0], ['bat', 'L', 400], ['skeleton', 'R', 1200], ['bat', 'R', 3200], ['goblin', 'L', 3600]] },
          // 5: 채굴 캠프 화로(1650 + 330) 둘레에 해골 둘 + 늑대(camp2) + 옆에서 지원
          { at: 1650, placed: [['skeleton', 292, 0.34, { group: 'camp2', dir: 1 }], ['skeleton', 372, 0.4, { group: 'camp2' }], ['wolf', 340, 0.78, { group: 'camp2' }]],
                      spawn: [['bat', 'R', 1200], ['goblin', 'L', 3400], ['skeleton', 'R', 4200], ['bat', 'L', 4800]] },
          { at: 2040, spawn: [['skeleton', 'R', 0], ['bat', 'R', 300], ['wolf', 'L', 700], ['goblin', 'R', 2600], ['bat', 'L', 3000], ['skeleton', 'R', 3800]] },
          { at: 'end', boss: true, spawn: [['golem', 'R', 0]] }
        ],
        // 소품: 광석 수레·통 얹은 상자(부서짐) + 화로 2개(장식, 해골 무리 자리). 보스 앞 수레는 고기가 꼭 나옴
        props: [
          { type: 'orecart', x: 430,  y: 0.74 },
          { type: 'stack',   x: 790,  y: 0.26 },
          { type: 'brazier', x: 880 + 326, y: 0.47 },
          { type: 'orecart', x: 1470, y: 0.28 },
          { type: 'stack',   x: 1530, y: 0.72 },
          { type: 'brazier', x: 1650 + 330, y: 0.56 },
          { type: 'stack',   x: 1860, y: 0.3, drop: 'bread' },
          { type: 'orecart', x: 2330, y: 0.62, drop: 'meat' }    // 6번 웨이브 화면 끝 = 보스방 바로 앞
        ]
      },
      // ===== 임시 3단계: 1단계 그림 그대로 + 적 많이 + 더 강하게 + 보스 = 붉은 오크(색만 바꿈) =====
      {
        id: 3,
        name: 'STAGE 3  폐허 (임시)',
        width: 3200,
        healOnClear: 10,
        bgTop: '#7fb2e5',
        bg: BG_FOREST,               // 임시: 1단계 배경
        hpMul: 1.3, dmgMul: 1.2,
        waves: [
          { at: 120,  spawn: [['goblin', 'R', 0], ['goblin', 'L', 300], ['wolf', 'R', 900], ['goblin', 'R', 1800]] },
          { at: 520,  spawn: [['wolf', 'R', 0, { variant: 'ice' }], ['wolf', 'L', 300, { variant: 'ice' }], ['goblin', 'R', 1200], ['goblin', 'L', 1600], ['wolf', 'R', 3000]] },
          { at: 920,  spawn: [['goblin', 'R', 0], ['goblin', 'R', 250], ['goblin', 'L', 500], ['wolf', 'R', 2400], ['goblin', 'L', 3000], ['goblin', 'R', 3400], ['wolf', 'L', 4000]] },
          { at: 1320, spawn: [['wolf', 'R', 0], ['wolf', 'L', 300], ['wolf', 'R', 700, { variant: 'ice' }], ['goblin', 'R', 2200], ['goblin', 'L', 2600], ['wolf', 'R', 3600]] },
          { at: 1740, spawn: [['goblin', 'R', 0], ['goblin', 'L', 200], ['wolf', 'R', 700], ['wolf', 'L', 1100], ['goblin', 'R', 3200], ['goblin', 'L', 3500], ['wolf', 'R', 4300, { variant: 'ice' }], ['goblin', 'R', 5000]] },
          { at: 2160, spawn: [['wolf', 'R', 0], ['wolf', 'R', 250], ['goblin', 'L', 500], ['goblin', 'L', 800], ['wolf', 'R', 2600, { variant: 'ice' }], ['goblin', 'R', 3000], ['goblin', 'L', 3400], ['wolf', 'R', 4200]] },
          { at: 2560, spawn: [['goblin', 'R', 0], ['goblin', 'L', 0], ['wolf', 'R', 600], ['wolf', 'L', 900], ['goblin', 'R', 3000], ['wolf', 'L', 3400, { variant: 'ice' }]] },
          { at: 'end', boss: true, spawn: [['orc', 'R', 0, { variant: 'ember' }]] }
        ],
        props: [
          { type: 'barrel', x: 900,  y: 0.5 },
          { type: 'crate',  x: 1700, y: 0.3 },
          { type: 'barrel', x: 2640, y: 0.7, drop: 'meat' }
        ]
      },
      // ===== 4단계: 사막 유적 (2026-11-04 새 그림: 배경·소품·미라·전갈 왕) =====
      // 2단계보다 한 단계 어렵게(체력·공격 x1.2): 새 적 미라(느리고 단단, 잡기) + 고블린·해골·모래 늑대(색만 바꿈) 섞음,
      //   화로 둘레에 미리 서 있는 무리 3곳 + 옆에서 지원, 보스 = 전갈 왕(땅속 숨기)
      {
        id: 4,
        name: 'STAGE 4  사막 유적',
        width: 2880,
        healOnClear: 12,
        bgTop: '#99cad5',           // 화면이 배경보다 높을 때 위쪽 하늘 색 (실제로는 배경 맨 윗줄을 늘려 씀)
        bg: BG_DESERT,
        hpMul: 1.2, dmgMul: 1.2,
        waves: [
          // 1: 신전 정문 — 미라 첫 등장
          { at: 120,  spawn: [['mummy', 'R', 0], ['goblin', 'R', 900], ['mummy', 'L', 2400]] },
          // 2: 화로(500 + 326) 옆에 미라 + 고블린(camp1, 하나 깨면 둘 다 깸) + 옆에서 지원
          { at: 500,  placed: [['mummy', 288, 0.36, { group: 'camp1', dir: 1 }], ['goblin', 364, 0.58, { group: 'camp1' }]],
                      spawn: [['goblin', 'L', 700], ['wolf', 'R', 2200, { variant: 'sand' }]] },
          { at: 880,  spawn: [['wolf', 'R', 0, { variant: 'sand' }], ['mummy', 'L', 500], ['skeleton', 'R', 1400], ['goblin', 'L', 3200], ['mummy', 'R', 3800]] },
          // 4: 석상 광장 화로(1260 + 330) 둘레에 미라 + 모래 해골 + 모래 늑대(camp2) + 옆에서 지원
          { at: 1260, placed: [['mummy', 292, 0.34, { group: 'camp2', dir: 1 }], ['skeleton', 372, 0.42, { group: 'camp2', variant: 'sand' }], ['wolf', 340, 0.8, { group: 'camp2', variant: 'sand' }]],
                      spawn: [['goblin', 'R', 1200], ['mummy', 'L', 3400], ['wolf', 'R', 4200, { variant: 'sand' }]] },
          { at: 1650, spawn: [['mummy', 'R', 0], ['skeleton', 'L', 400, { variant: 'sand' }], ['goblin', 'R', 1000], ['wolf', 'R', 2800, { variant: 'sand' }], ['mummy', 'L', 3400]] },
          // 6: 성소 입구 화로(2040 + 330) 앞을 지키는 미라 둘(tomb) + 옆에서 지원
          { at: 2040, placed: [['mummy', 296, 0.3, { group: 'tomb', dir: 1 }], ['mummy', 368, 0.66, { group: 'tomb' }]],
                      spawn: [['goblin', 'R', 600], ['wolf', 'L', 1000, { variant: 'sand' }], ['skeleton', 'R', 2800], ['mummy', 'L', 3400], ['goblin', 'R', 4000]] },
          { at: 'end', boss: true, spawn: [['scorpion', 'R', 0]] }
        ],
        // 소품: 토기 항아리·밧줄 보급 상자(부서짐) + 받침돌 화로 3개(장식, 무리 자리). 보스 앞 항아리는 고기가 꼭 나옴
        props: [
          { type: 'amphora',   x: 430,  y: 0.72 },
          { type: 'ropecrate', x: 700,  y: 0.22 },
          { type: 'firebowl',  x: 500 + 326, y: 0.47 },
          { type: 'amphora',   x: 1150, y: 0.7 },
          { type: 'ropecrate', x: 1480, y: 0.26 },
          { type: 'firebowl',  x: 1260 + 330, y: 0.56 },
          { type: 'amphora',   x: 1860, y: 0.32, drop: 'bread' },
          { type: 'firebowl',  x: 2040 + 332, y: 0.48 },
          { type: 'amphora',   x: 2250, y: 0.78, drop: 'meat' }    // 6번 웨이브 화면 = 보스방 바로 앞
        ]
      }
    ],

    // ---------- 색만 바꾼 적 (variant) ----------
    // 웨이브에서 ['wolf', 'R', 0, { variant: 'ice' }] 처럼 쓰면 그 적 그림을 이 색으로 바꿔 그린다(그림 파일 없이 코드로).
    //   hue = 색상환 돌리기(도), sat = 채도 배율, bright = 밝기 배율 (CSS filter 의 hue-rotate / saturate / brightness 와 같음)
    //   color + colorK = 그 위에 이 색을 colorK 만큼 덧칠(회색·흰색처럼 색상환을 돌려도 안 바뀌는 그림용, 없으면 안 함)
    //   hpMul / dmgMul = 이 변종만 추가로 강하게(판 배율에 곱함, 없으면 1). label = 보스 막대 이름 앞에 붙는 말
    //   판을 시작할 때 그 판에 나오는 변종 그림만 한 번 구워 두고 계속 다시 씀(main.js tintArt) → 게임 중 느려지지 않음
    variants: {
      ice:   { label: '얼음', hue: 180, sat: 0.8, bright: 1.15, color: '#8fd8ff', colorK: 0.35, hpMul: 1.1 },   // 회색 늑대 → 푸른 늑대(회색은 색상환을 돌려도 그대로라 color 로 물들임)
      ember: { label: '붉은', hue: 270, sat: 1.2, bright: 0.95, dmgMul: 1.1 },  // 연두 오크 → 붉은 오크
      // 4단계(2026-11-04): 회색 늑대·흰 해골 → 모래 빛(누런 갈색). 회색·흰색이라 색상환 대신 color 로 물들임
      sand:  { label: '모래', hue: 0, sat: 0.9, bright: 1.0, color: '#d8a860', colorK: 0.38, hpMul: 1.1 }
    },

    // ---------- 소품 그림 (2026-11-04, art\stage1-props 에서 복사 → assets/props/stage1/…, 크기·기준점은 props.json) ----------
    // 판의 props 가 쓰는 그림. 그림이 아직 없는 종류는 안 그림(?debug=1 이면 자리 표시만).
    //   frames = 그림 경로 목록(seq 로, 부서지는 소품은 멀쩡 → 금 감 → 많이 부서짐 3장), fps = 1초에 장 수(0 = 멈춘 그림, 맞은 횟수로 장을 고름)
    //   pivot = 그림 속 바닥 가운데(원래 크기), scale = 그리는 배율(없으면 actorScale)
    //   아래 거리 값은 전부 원래 그림 크기(1배) 기준 → 맨 아래 scaleActors 가 actorScale 로 줄인다
    //   solid = 못 지나감: footprint = 바닥에서 막는 상자 { w = 가로(기준점 가운데), depth = 위아래(걷는 길) 두께 }
    //   hits = 몇 번 맞으면 부서지나(CFG.props), hurtbox = 맞는 상자(기준점에서 x, y = 왼쪽 위, w, h), breakFrames = 부서지는 그림(14fps 한 번)
    //   shadow = 발밑 그림자 반폭(없으면 안 그림), glow = 바닥 빛 { r, y(기준점 위로), color, alpha } (모닥불)
    propTypes: {
      crate: {
        frames: ['intact', 'cracked', 'damaged'].map(function (s) { return 'assets/props/stage1/crate/' + s + '_01.png'; }), fps: 0,
        breakFrames: seq('assets/props/stage1/crate/break_', 4),
        pivot: { x: 51, y: 89 }, solid: true, footprint: { w: 52, depth: 18 },
        hits: 3, hurtbox: { x: -27, y: -49, w: 54, h: 48 }, shadow: 26
      },
      barrel: {
        frames: ['intact', 'cracked', 'damaged'].map(function (s) { return 'assets/props/stage1/barrel/' + s + '_01.png'; }), fps: 0,
        breakFrames: seq('assets/props/stage1/barrel/break_', 4),
        pivot: { x: 47, y: 96 }, solid: true, footprint: { w: 42, depth: 18 },
        hits: 3, hurtbox: { x: -23, y: -60, w: 46, h: 59 }, shadow: 22
      },
      // 모닥불: 장식(지나갈 수 있음, 안 부서짐). 돌·장작은 그대로, 불꽃만 움직이는 6장 반복
      campfire: {
        frames: seq('assets/props/stage1/campfire/burn_', 6), fps: 10,
        pivot: { x: 29, y: 73 }, solid: false, shadow: 20,
        glow: { r: 70, y: 22, color: '#ff9a3a', alpha: 0.32 }
      },
      // ----- 2단계 소품 (art\stage2-props 에서 복사 → assets/props/stage2/…, 크기·기준점은 그 폴더 props.json) -----
      // chips = 부서질 때 튀는 조각 색(없으면 CFG.props.woodColors 나뭇조각)
      // 광석 수레: 1단계 상자보다 조금 넓음(허리 높이). 나무·쇠·광석·파란 수정 조각
      orecart: {
        frames: ['intact', 'cracked', 'damaged'].map(function (s) { return 'assets/props/stage2/orecart/' + s + '_01.png'; }), fps: 0,
        breakFrames: seq('assets/props/stage2/orecart/break_', 4),
        pivot: { x: 51, y: 88 }, solid: true, footprint: { w: 67, depth: 18 },
        hits: 3, hurtbox: { x: -36, y: -54, w: 71, h: 53 }, shadow: 34,
        chips: ['#9a6a3a', '#6e4a2a', '#8a8a96', '#4a4a56', '#7fd8ff']
      },
      // 통 얹은 상자: 고블린 키쯤
      stack: {
        frames: ['intact', 'cracked', 'damaged'].map(function (s) { return 'assets/props/stage2/stack/' + s + '_01.png'; }), fps: 0,
        breakFrames: seq('assets/props/stage2/stack/break_', 4),
        pivot: { x: 42, y: 77 }, solid: true, footprint: { w: 38, depth: 18 },
        hits: 3, hurtbox: { x: -20, y: -73, w: 40, h: 72 }, shadow: 20
      },
      // 화로: 장식(모닥불처럼 지나갈 수 있음, 안 부서짐). 받침·바구니는 그대로, 불꽃만 움직이는 6장 반복. 빛은 바구니 높이
      brazier: {
        frames: seq('assets/props/stage2/brazier/burn_', 6), fps: 10,
        pivot: { x: 20, y: 80 }, solid: false, shadow: 12,
        glow: { r: 66, y: 60, color: '#ff9a3a', alpha: 0.3 }
      },
      // ----- 4단계 소품 (art\stage4-props 에서 복사 → assets/props/stage4/…, 크기·기준점은 그 폴더 props.json) -----
      // 이름이 1·2단계 상자(crate)·화로(brazier)와 겹쳐서 종류 이름만 따로(그림 폴더 이름은 그대로)
      // 토기 항아리: 고블린 가슴 높이. 붉은 흙 조각 + 모래
      amphora: {
        frames: ['intact', 'cracked', 'damaged'].map(function (s) { return 'assets/props/stage4/amphora/' + s + '_01.png'; }), fps: 0,
        breakFrames: seq('assets/props/stage4/amphora/break_', 4),
        pivot: { x: 42, y: 75 }, solid: true, footprint: { w: 41, depth: 16 },
        hits: 3, hurtbox: { x: -23, y: -65, w: 47, h: 64 }, shadow: 22,
        chips: ['#c0683a', '#9a4a2a', '#e09a64', '#d8c08a']
      },
      // 밧줄 보급 상자(줄무늬 천 두루마리 얹음): 주인공 허리 높이, 2단계 광석 수레쯤
      ropecrate: {
        frames: ['intact', 'cracked', 'damaged'].map(function (s) { return 'assets/props/stage4/crate/' + s + '_01.png'; }), fps: 0,
        breakFrames: seq('assets/props/stage4/crate/break_', 4),
        pivot: { x: 47, y: 81 }, solid: true, footprint: { w: 67, depth: 18 },
        hits: 3, hurtbox: { x: -35, y: -58, w: 71, h: 57 }, shadow: 34,
        chips: ['#c8894a', '#9a5f30', '#6e4022', '#c84a3a', '#e8d8a8']
      },
      // 받침돌 화로: 장식(지나갈 수 있음, 안 부서짐). 받침돌·청동 그릇은 그대로, 불꽃만 움직이는 6장 반복. 빛은 그릇 높이
      firebowl: {
        frames: seq('assets/props/stage4/brazier/burn_', 6), fps: 10,
        pivot: { x: 26, y: 88 }, solid: false, shadow: 16,
        glow: { r: 66, y: 58, color: '#ff9a3a', alpha: 0.28 }
      }
    },
    // ---------- 부서지는 소품 공통 (상자·통) ----------
    //   보통 타 1번 = 한 단계(멀쩡 → 금 감 → 많이 부서짐 → 부서짐). 콤보 마무리 타 = 2단계. 기술 / 데미지 oneShotDmg 이상 = 한 번에 부서짐
    //   hitGapMs = 이 시간 안에 또 맞으면 안 셈(여러 판정이 한꺼번에 닿아도 한 단계만), flashMs = 하얀 번쩍, wobbleMs·wobble = 흔들림(도트)
    //   breakFps = 부서지는 그림 속도, holdMs = 마지막 장(잔해 더미)을 보여 주는 시간, fadeMs = 그다음 흐려지며 사라지는 시간
    //   hitAbove = 맞는 상자를 물체 위로 늘리는 높이(원래 크기): 허리 높이 상자를 얼굴 높이 주먹·베기로도 맞힘
    //   actorDepth = 몸끼리 막을 때 캐릭터 발 두께(위아래 반폭, 도트 그대로), lookAhead = 적·자동 조종이 앞 몇 도트 안의 소품을 돌아가나
    //   drop = 판 props 에 drop 이 없거나 'random' 일 때: 고기·빵이 나올 확률(나머지 = 안 나옴)
    props: {
      oneShotDmg: 30, hitGapMs: 90, flashMs: 80, wobbleMs: 160, wobble: 1.5,
      breakFps: 14, holdMs: 600, fadeMs: 400, hitAbove: 40,
      actorDepth: 3, lookAhead: 48,
      drop: { meat: 0.2, bread: 0.35 },
      woodColors: ['#c8894a', '#9a5f30', '#6e4022', '#e0b070']   // 나뭇조각 색
    },
    // ---------- 음식 (부서진 소품에서 나옴, 밟으면 체력 회복) ----------
    //   heal = 회복량(최대 체력은 안 넘음), frames = 그림(같은 기준점), pickup = 줍는 거리 { r = 가로, depth = 위아래 }(원래 크기)
    //   lifeMs = 바닥에 남아 있는 시간, blinkMs = 사라지기 전 깜빡이는 시간, hop = 나올 때 튀어 오르는 높이(원래 크기), pickupDelayMs = 나오자마자 줍지 않게
    food: {
      pivot: { x: 30, y: 26 },
      items: {
        meat:  { frame: 'assets/props/stage1/food/meat_01.png',  heal: 40 },
        bread: { frame: 'assets/props/stage1/food/bread_01.png', heal: 20 }
      },
      pickup: { r: 16, depth: 12 }, lifeMs: 15000, blinkMs: 3000, hop: 22, pickupDelayMs: 250, shadow: 12
    },

    // 먼지 효과(오크 돌진): 112x64, 바닥 가운데 기준
    dust: { frames: seq('assets/fx/dust_', 5), pivot: { x: 56, y: 60 }, fps: 12 },

    // ---------- 조작 ----------
    keys: {
      left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
      up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
      attack: ['KeyJ', 'KeyZ'],
      jump: ['KeyK', 'KeyX', 'Space'], // 점프 (2026-11-03). 달리기 = 좌/우를 빠르게 두 번(CFG.move.doubleTapMs)
      // 기술 (2026-11-03): WASD 이동·J 공격·K 점프와 안 겹치게 J/K 바로 위 U/I, 왼손은 Z(공격)·X(점프) 옆 C/V
      skillA: ['KeyU', 'KeyC'],
      skillB: ['KeyI', 'KeyV']
    },

    // ---------- 직업 기술 (위 SKILLS 설명 참고) ----------
    // bufferMs = 미리 눌러 둔 기술 입력 기억 시간, cancelAfterHit = 보통 콤보 타의 판정이 끝난 장부터 기술로 끊을 수 있음
    skills: { bufferMs: 300, cancelAfterHit: true, knight: SKILLS.knight, mage: SKILLS.mage },

    // ---------- 기술 효과 그림 (art\stage1\skills\fx 에서 복사 → assets/fx/skill/<이름>_01.png …, 크기·기준점은 fx.json) ----------
    // count = 장 수(0 = 그림 없음 → 기존 그림을 물들여 쓰거나 코드로 그림), fps = 1초에 장 수, pivot = 그림 속 기준점(원래 크기), loop = 반복
    // 불러올 때 CFG.magic 에 'skill_<이름>' 으로 등록된다 → 굽기(shrink.js)·불러오기(assets.js)가 기준점을 정확히 줄여 줌
    // 기술 효과 그림 크기 배율 (2026-11-03 HD: 메이플처럼 크고 화려하게 2배). HD 그림은 이 크기로 구워 둠(hd_bake.py FXBOOST 와 같게)
    skillFxScale: 2,
    skillFx: {

      dash_trail:       { count: 4, fps: 16, pivot: { x: 134, y: 24 } },   // 돌진 잔상(기준 = 오른쪽 앞끝 → 몸 뒤에 붙임)
      slash_wave:       { count: 4, fps: 16, pivot: { x: 56, y: 56 } },    // 가로 베기 파동(오른쪽으로 볼록)
      spin_ring:        { count: 6, fps: 18, pivot: { x: 88, y: 68 } },    // 360 회전 고리(기준 = 고리 가운데 → 허리)
      fireball:         { count: 4, fps: 14, pivot: { x: 52, y: 28 }, loop: true },   // 화염구(기준 = 흰 불꽃 머리)
      fire_explosion:   { count: 6, fps: 16, pivot: { x: 64, y: 64 } },
      lightning_bolt:   { count: 4, fps: 20, pivot: { x: 48, y: 197 } },   // 번개 기둥(기준 = 아래 끝 = 땅)
      lightning_impact: { count: 4, fps: 16, pivot: { x: 64, y: 63 } },    // 땅 번쩍(기준 = 아래 가운데)
      shock:            { count: 3, fps: 15, pivot: { x: 44, y: 60 }, loop: true }    // 감전(멈춘 적 몸 가운데에 겹침)
    },
    motions: MOTIONS
  };

  // 지금 판(호환용): 다른 코드는 예전처럼 CFG.stage / CFG.bg 를 읽는다. 판을 바꿀 때 main.js useStage 가 다시 넣음
  window.CFG.stage = window.CFG.stages[0];
  window.CFG.bg = window.CFG.stage.bg;

  // ---------- 기술 그림 끼워 넣기: 동작 그림 묶음 → 각 옷 캐릭터 anims, 효과 그림 → art.fx + magic(기준점) ----------
  (function addSkillArt(C) {
    if (C.art.fx) Object.keys(C.skillFx).forEach(function (k) {
      var F = C.skillFx[k];
      if (!(F.count > 0)) return;
      C.art.fx['skill_' + k] = seq('assets/fx/skill/' + k + '_', F.count);
      C.magic['skill_' + k] = { frames: 'skill_' + k, fps: F.fps, pivot: { x: F.pivot.x, y: F.pivot.y } };
    });
    Object.keys(C.motions).forEach(function (ch) {
      var def = C.art.characters[ch];
      if (!def) return;   // 예전 견습 그림(?art=novice)에는 옷 캐릭터가 없음
      var dir = def.anims.idle.frames[0].replace(/[^\/]+$/, '');   // 그 옷 그림 폴더
      Object.keys(C.motions[ch]).forEach(function (m) {
        var M = C.motions[ch][m];
        if (M.count > 0) def.anims[m] = { frames: seq(dir + m + '_', M.count), fps: 14, loop: false };
      });
      def.motionAnchors = 'assets/chars/stage1/anchors_motions_' + ch + '.json';
    });
  })(window.CFG);

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
    // 기술: 돌진 거리·판정 상자·효과 위치·화염구·번개 거리 (성별 덮어쓰기 값도)
    function skill(d) {
      if (!once(d)) return;
      if (once(d.move)) mul(d.move, ['dist'], S);
      (d.hits || []).forEach(function (h) { if (once(h)) { box(h.reach); mul(h, ['hitY'], S); } });
      (d.fx || []).forEach(function (f) { if (once(f)) { mul(f, ['x', 'y', 'len', 'r', 'vx'], S); if (once(f.ph)) mul(f.ph, ['x', 'y', 'len', 'r'], S); } });
      var c = d.cast;
      if (once(c)) {
        mul(c, ['x', 'y', 'speed', 'range', 'depth', 'backReach'], S);
        if (c.box) mul(c.box, ['w', 'h'], S);
        if (once(c.burst)) mul(c.burst, ['r', 'depth'], S);
      }
      var k = d.strikes;
      if (once(k)) { arr(k.x); mul(k, ['r', 'depth'], S); if (k.aim) mul(k.aim, ['range', 'depth'], S); }
      if (d.male) skill(d.male);
      if (d.female) skill(d.female);
    }
    ['knight', 'mage'].forEach(function (c) { if (C.skills[c]) { skill(C.skills[c].A); skill(C.skills[c].B); } });
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
        // 바위 던지기(골렘): 손 위치·포물선 높이·최대 거리·맞는 반경·피하는 점프 높이, 내려찍기 땅 터짐 위치
        mul(a.spawn, ['x', 'y'], S); mul(a, ['arcPeak', 'maxRange', 'radius', 'dodgeZ'], S); mul(a.burst, ['x'], S);
        // 4단계: 장마다 다른 판정 상자(전갈 집게 4장), 잡힌 플레이어 서는 거리(미라), 둔덕 멈추는 거리(전갈 땅속 숨기)
        if (a.reachF) Object.keys(a.reachF).forEach(function (f) { box(a.reachF[f]); });
        mul(a.grab, ['dist'], S); mul(a, ['catchR'], S);
      });
      // 나는 적 흔들림, 방패 막기 밀림, 보스 핵 빛 위치
      mul(T.flying, ['bob'], S); mul(T.guard, ['push'], S);
      if (T.stagger) { mul(T.stagger.core, ['x', 'y', 'r'], S); box(T.stagger.hurtbox); }   // 휘청 중 몸 판정(전갈 뒤집힘)
    });
    // 소품·음식: 맞는 상자·막는 상자·그림자·빛·줍는 거리·튀어 오름 (그림은 assets.js 가 actorScale 로 그림)
    Object.keys(C.propTypes || {}).forEach(function (k) {
      var D = C.propTypes[k];
      mul(D.hurtbox, ['x', 'y', 'w', 'h'], S); mul(D.footprint, ['w', 'depth'], S); mul(D, ['shadow'], S); mul(D.glow, ['r', 'y'], S);
    });
    mul(C.props, ['hitAbove'], S);
    if (C.food) { mul(C.food.pickup, ['r', 'depth'], S); mul(C.food, ['hop', 'shadow'], S); }
  })(window.CFG);
})();
