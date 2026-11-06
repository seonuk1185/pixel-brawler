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
          dmg: 1.8, hitstop: 1.9, knock: 2.6, shake: 2.4, finisher: true, hitsDown: true,   // 크게 내리찍는 마무리 = 누운 적도 맞음(ai.otg)
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
            { active: [3, 3], lunge: 3, dmg: 1.6, hitstop: 1.9, knock: 2.4, shake: 2.3, finisher: true, hitsDown: true,   // 큰 마무리 = 누운 적도 맞음
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
               { active: [3, 3], lunge: 2, dmg: 1.6, hitstop: 1.9, knock: 2.4, shake: 2.3, finisher: true, hitsDown: true,   // 큰 마무리 = 누운 적도 맞음
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
            dmg: 1.8, hitstop: 1.9, knock: 2.6, shake: 2.3, finisher: true, hitY: -80, spark: 1.0, hitsDown: true }   // 큰 돌려차기 마무리 = 누운 적도 맞음(무릎은 안 맞음)
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
        dmg: 1.7, hitstop: 2.0, knock: 2.5, shake: 2.3, finisher: true, hitY: -50, spark: 1.0, hitsDown: true,   // 뒤꿈치 내려찍기 = 누운 적도 맞음
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
          dmg: 1.1, hitstop: 1.1, knock: 1.3, shake: 1.1, hitY: -34, spark: 0.9, impactFx: 'magic_spark', hitsDown: true,   // 지팡이로 땅까지 내려침 = 누운 적도 맞음
          fx: [{ type: 'whoosh', x: 46, y: -62, rot: 0, sx: 0.8, sy: 0.95, alpha: 0.45 }, { type: 'spark', x: 69, y: -11, scale: 1.1 }],
          arc: { from: -100, to: 60, r: 46, w: 6 } },
        { anim: 'attack3', f: [0, 1, 2, 3, 4, 5], d: [80, 100, 60, 150, 120, 140], active: [3, 3], cancel: 99, lunge: 0,
          dmg: 1.9, hitstop: 1.6, knock: 2.4, shake: 2.0, finisher: true, spark: 1.0, impactFx: 'magic_spark', hitsDown: true,   // 마무리 마법 터짐 = 누운 적도 맞음(날아가는 탄은 누운 적 위로 지나감)
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
          dmg: 1.8, hitstop: 1.7, knock: 2.4, shake: 2.2, finisher: true, spark: 0.9, impactFx: 'magic_spark', hitsDown: true,   // 두 손 폭발 마무리 = 누운 적도 맞음
          fx: { type: 'none' },
          cast: { kind: 'burst', x: 76, y: -71, burst: { r: 40, depth: 18, scale: 1.0 } } }
      ]
    }
  };

  // ---------- 직업 기술 (2026-11-03): 기사 2개 · 법사 2개, 견습은 없음 ----------
  //   2026-11-06 성장 4단계: 기사·법사 각 4개(+ 늘 켜진 기술 2개, 아래 SKILL_TREE). 기술 = 마나(mp) + 쿨타임, 기술 Lv1~5
  // 키보드 U(또는 C) · I(V) · O(B) · P(N) = 기술 칸 1~4 (Lv13 전엔 2칸) / 폰 = 공격 버튼 둘레 작은 동그라미. 칸에 무엇을 끼울지는 기술 창
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
  //   name = 이름, icon = 버튼 글자, cooldownMs = 쿨타임(기술 Lv1), motion = 동작 이름(MOTIONS), motionMs = 이 기술만 동작 시간 바꾸기(없으면 MOTIONS 의 ms)
  //   mp = 쓸 때 드는 마나(기술 Lv1, 2026-11-06), desc = 기술 창 설명(쉬운 말), lv5 = 기술 Lv5 덤 { dist(돌진 거리) / area(범위 배율) /
  //        extra(검기 하나 더) / pierce(꿰뚫기), say = 기술 창에 쓰는 말 }, look = 효과 그림 갈아 끼우는 곳(아래 「성장 4단계 새 기술」)
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
                          dmg: 1.9, hitstop: 0.55, knock: 1.4, shake: 1.3, knockdown: true, spark: 1.3, big: true, hitY: -62, hitsDown: true };
  var KNIGHT_DASH_FINALE = { ifHit: true, hitstopMs: 120, shake: 2.8, slowMs: 260, flash: { color: '#d8ecff', alpha: 0.4, ms: 140 } };
  var SPIN_REACH = { x0: -100, x1: 100, yTop: -108, yBot: -6, depth: 20 };
  var SPIN_HIT = { reach: SPIN_REACH, away: true, dmg: 0.8, hitstop: 0.7, knock: 0.7, shake: 1.2, spark: 1.1, hitY: -60, hitsDown: true };
  var SPIN_LAST = { reach: { x0: -110, x1: 110, yTop: -112, yBot: -4, depth: 22 }, away: true, hitsDown: true,
                    dmg: 1.6, hitstop: 2.2, knock: 2.6, shake: 3.0, knockdown: true, spark: 1.5, big: true, hitY: -60,
                    flash: { color: '#e6f2ff', alpha: 0.45, ms: 150 }, slowMs: 280 };
  // 불·번개 기술은 법사 보라 반짝임(impactFx) 대신 기본 불똥(노랑·흰색)이 효과 색과 어울림
  // hitsDown = 크게 휘두르는 타·땅까지 닿는 기술(누운 적도 맞음, ai.otg). 돌진베기·회전베기·화염구 터짐·번개 전부
  // 2026-11-06 법사 균형: 화염구 터짐 dmg 2.8 → 3.3 (3판 Lv7 에서 쓸 수 있는 기술이 화염구 하나뿐)
  var FIRE_HIT = { dmg: 3.3, hitstop: 2.0, knock: 2.4, shake: 3.0, knockdown: true, spark: 1.4, big: true, hitsDown: true,
                   flash: { color: '#ffb060', alpha: 0.4, ms: 160 }, slowMs: 240 };
  // 터짐 판정 = 보이는 폭발 크기(fire_explosion 가장 큰 장 반지름 약 57~64 → r 64), 위아래(안쪽) 폭 40
  //   (위아래로 살짝 어긋나 서 있는 바로 뒤 적도 맞게, 2026-11-03 예전 r 56 / depth 24 는 뒤 적이 자주 빠짐)
  var FIRE_BURST = { r: 92, depth: 50, art: 'fire_explosion', fromFrame: 1, scale: 1.7, tint: '#ff6a10', tintK: 0.6 };
  var BOLT_HIT = { dmg: 1.05, hitstop: 1.2, knock: 0.4, shake: 1.8, stunMs: 450, spark: 1.2, big: true, hitsDown: true,
                   flash: { color: '#e8ffff', alpha: 0.3, ms: 90 } };
  var BOLT_HITS = [ BOLT_HIT, merge(BOLT_HIT, {}),
    { dmg: 1.7, hitstop: 2.2, knock: 2.2, shake: 3.2, knockdown: true, spark: 1.5, big: true, hitsDown: true,
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
  // ---------- 성장 4단계 새 기술 (2026-11-06): 검기 날리기·대지 내려찍기 / 얼음창·메테오 ----------
  // 그림은 아직 임시: 있는 효과 그림(slash_wave·fireball·fire_explosion·마법탄)을 물들이거나 코드로 그린 고리·파편.
  //   look = 그림 갈아 끼우는 곳(효과 그림 이름 = 아래 skillFx). 새 그림이 오면 skillFx 에 이름·장 수를 적고 look 값만 바꾸면 됨
  //   (판정·데미지는 안 건드림). 그림이 없거나(count 0) 못 불러오면 저절로 지금 임시 그림
  // 검기: 날아가며 길 위의 적을 모두 꿰뚫음(적마다 한 번)
  //   2026-11-06 형님: 누운 적도 맞음(hitsDown, 누운 적 때리기 규칙 그대로) → 검기가 누운 몸 위를 지나가도 닿음(skills.js castWave)
  var WAVE_HIT = { dmg: 1.6, hitstop: 0.6, knock: 1.1, shake: 1.2, spark: 1.2, big: true, hitY: -58, hitsDown: true };
  // 내려찍기: 착지 자리 양옆 땅 충격파. 맞은 적은 짧게 기절(stunMs, 넘어뜨리지는 않음), 누운 적도 맞음
  var SLAM_HIT = { dmg: 2.5, hitstop: 1.6, knock: 0.6, shake: 2.6, stunMs: 700, spark: 1.4, big: true, hitsDown: true, away: true, noJuggle: true,
                   flash: { color: '#fff0d0', alpha: 0.35, ms: 140 }, slowMs: 200 };
  // 얼음창: 처음 맞은 적 하나(Lv5 = 꿰뚫음) + 느려짐(slow: ms 동안 그 적의 시간이 mul 배로 흐름 → 걷기·공격·맞는 동작 전부 느려짐, 보스는 bossMul)
  // 2026-11-06 법사 균형: 얼음창 dmg 2.2 → 1.9 (화염구 쿨타임을 줄인 만큼 Lv13 뒤 법사가 기사보다 너무 빨리 깨서)
  var ICE_HIT = { dmg: 1.9, hitstop: 1.1, knock: 0.9, shake: 1.3, spark: 1.2, big: true };
  // 메테오: 떨어진 자리에서 크게 터짐, 둘레 적 넘어뜨림, 누운 적도 맞음
  var METEOR_HIT = { dmg: 5.0, hitstop: 2.4, knock: 2.8, shake: 3.6, knockdown: true, spark: 1.6, big: true, hitsDown: true,
                     flash: { color: '#ffc070', alpha: 0.55, ms: 220 }, slowMs: 320 };
  // ---------- 콤보 띄우기 기술 (2026-11-06 밤, 형님 「콤보 시스템」): 올려베기(기사) · 땅 융기(법사) ----------
  // launch = 띄우기 세기(config ai.air: 잡몹은 공중으로 → 평타·기술 다 맞음 → 떨어지면 넘어짐·누운 적 때리기). 보스·큰 적은 안 뜸(휘청)
  //   launcher: true = 띄우기 기술(자동 조종이 서 있는 잡몹에게 먼저 씀)
  // 올려베기: 아래에서 위로 베어 올림. 맞은 잡몹이 높이 뜸. 누운 적은 안 맞음(hitsDown 없음 = 다시 주워 띄우기 없음)
  //   2026-11-06 형님: 판정이 좁다 → 앞 100 → 140(+40%), 위아래 22 → 33(+50%). 그림은 그대로(새 동작 그림은 나중)
  var UPPER_HIT = { reach: { x0: -10, x1: 140, yTop: -150, yBot: -4, depth: 33 }, launch: 1, dmg: 1.5, hitstop: 1.5, knock: 0.3, shake: 1.6,
                   spark: 1.3, big: true, hitY: -74, flash: { color: '#e6f2ff', alpha: 0.28, ms: 110 }, slowMs: 140 };
  // 땅 융기: 보라 마법진 자리에서 돌기둥이 솟아 그 위 잡몹을 띄움(기둥 폭 r, 위아래 depth). 누운 적은 안 맞음
  var RISE_HIT = { launch: 1.1, dmg: 1.8, hitstop: 1.5, knock: 0.25, shake: 2.2, spark: 1.3, big: true,
                  flash: { color: '#c8a0ff', alpha: 0.3, ms: 130 }, slowMs: 160 };
  // ---------- 2차 기술 (2026-11-06, 형님 승인): 기사 성검 낙뢰 · 반격(되받아 베기) / 법사 순간이동 · 불기둥 ----------
  // 효과는 전부 우리 코드로 그림(skills.js: 번개 칼·불기둥·마법진·빛 줄기). 새 동작 그림 없음 → 있는 공격 그림을 이어 붙임
  // 성검 낙뢰: 번개 칼 하나하나(땅까지 꽂힘 = 누운 적도 맞음). 마지막 칼 = 둘레 넘어뜨림
  var HOLY_HIT = { dmg: 1.1, hitstop: 1.3, knock: 0.6, shake: 1.8, spark: 1.4, big: true, hitsDown: true, noJuggle: true,
                   flash: { color: '#fff6c8', alpha: 0.22, ms: 90 } };
  var HOLY_LAST = { dmg: 1.8, hitstop: 2.2, knock: 2.0, shake: 3.2, knockdown: true, spark: 1.6, big: true, hitsDown: true,
                    flash: { color: '#fffbe0', alpha: 0.5, ms: 180 }, slowMs: 260 };
  // 반격(늘 켜진 기술)이 나갈 때 되받아 베는 한 칼(누운 적은 안 맞음)
  var COUNTER_HIT = { reach: { x0: -20, x1: 104, yTop: -112, yBot: -4, depth: 22 }, dmg: 1.8, hitstop: 1.4, knock: 1.6, shake: 1.8,
                      spark: 1.3, big: true, hitY: -60, flash: { color: '#fff4d0', alpha: 0.3, ms: 90 }, slowMs: 120 };
  // 순간이동: 사라지는 자리의 작은 보라 폭발(밀어냄). 작은 폭발이라 누운 적은 안 맞음
  var BLINK_HIT = { dmg: 1.3, hitstop: 1.0, knock: 1.6, shake: 1.4, spark: 1.1, big: true, flash: { color: '#d8b0ff', alpha: 0.18, ms: 80 } };
  // 불기둥: 솟는 순간 크게 한 번(FLAME_HIT) + 타는 동안 작게 여러 번(FLAME_TICK). 땅에서 솟음 = 누운 적도 맞음. 띄우지 않음
  //   tick 은 분노를 안 채움(noRage, 여러 번 맞아 분노가 너무 빨리 차지 않게)
  var FLAME_HIT = { dmg: 2.0, hitstop: 1.6, knock: 0.5, shake: 2.4, spark: 1.4, big: true, hitsDown: true, noJuggle: true,
                    flash: { color: '#ffb060', alpha: 0.35, ms: 150 }, slowMs: 180 };
  var FLAME_TICK = { dmg: 0.45, hitstop: 0.35, knock: 0.05, shake: 0.5, spark: 0.8, hitsDown: true, noJuggle: true, noRage: true };
  // ---------- 칼날 폭풍(기사 Lv19 사냥 기술, 2026-11-06) ----------
  // 세 바퀴 도는 동안 둘레를 여섯 번 벰(STORM_HIT): pull = 바깥쪽이 아니라 기사 쪽으로 살짝 끌어당김(몹 떼가 한데 모임).
  //   여러 번 맞아 분노가 너무 빨리 차지 않게 noRage(불기둥 tick 처럼). 마지막(STORM_LAST) = 크게 터지며 둘레를 밀어 넘어뜨림
  var STORM_REACH = { x0: -125, x1: 125, yTop: -112, yBot: -4, depth: 40 };   // 위아래 폭은 회전베기(20)보다 넓게(몹 떼가 위아래로 퍼져 있어서)
  var STORM_HIT = { reach: STORM_REACH, pull: true, dmg: 0.55, hitstop: 0.45, knock: 0.5, shake: 0.9, spark: 1.0, hitY: -60, hitsDown: true, noRage: true };
  var STORM_LAST = { reach: { x0: -140, x1: 140, yTop: -118, yBot: -4, depth: 46 }, away: true, hitsDown: true,
                     dmg: 1.9, hitstop: 2.0, knock: 2.6, shake: 3.2, knockdown: true, spark: 1.6, big: true, hitY: -60,
                     flash: { color: '#e6f2ff', alpha: 0.5, ms: 170 }, slowMs: 300 };
  var SKILLS = {
    knight: {
      // 돌진베기: 1~2장 동안 앞으로 약 120도트 미끄러지며 길 위의 적을 한 번씩 벤다(무적), 베는 장 다음 장에 「쾅」 멈춤
      dash: {
        name: '돌진베기', icon: '돌', mp: 6, cooldownMs: 4000, damageStyle: 'skill_knight', motion: 'motion_dash',
        desc: '앞으로 미끄러지며 길 위의 적을 모두 베요. 쓰는 동안 안 맞아요',
        lv5: { dist: 1.3, say: '돌진 거리 +30%' },
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
      spin: {
        name: '회전베기', icon: '회', mp: 10, cooldownMs: 7000, damageStyle: 'skill_knight', motion: 'motion_spin',
        walk: true,   // 2026-11-06 형님: 도는 동안 누르는 쪽으로 걷기 빠르기만큼 움직임(달리기 빠르기 아님, 판 밖으로는 안 나감)
        desc: '제자리에서 한 바퀴 돌며 둘레의 적을 세 번 베고 밀어내요',
        lv5: { area: 1.25, say: '베는 둘레 +25%' },
        darken: { ms: 600, alpha: 0.45 },
        iframes: { frames: [0, 5] },
        hits: [ merge(SPIN_HIT, { frame: 1 }), merge(SPIN_HIT, { frame: 3 }), merge(SPIN_LAST, { frame: 5 }) ],
        trail: { frames: [1, 5], everyMs: 45, lifeMs: 200, alpha: 0.3, color: '#cfe8ff' },   // 잔상(2026-11-06 밤 화려하게)
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
      },
      // 검기 날리기(2026-11-06): 기본 1타처럼 휘둘러(동작 그림 없음 → 공격 그림) 2장에 초승달 검기를 앞으로 날림.
      //   shot = 날아가는 검기 { frame = 나가는 장, x,y = 나오는 곳, speed = 1초에 도트, range = 최대 거리, box = 크기, depth = 위아래 폭,
      //          hit = 데미지, gapMs = Lv5 두 번째 검기가 나가는 간격 }
      wave: {
        name: '검기 날리기', icon: '검', mp: 8, cooldownMs: 5000, damageStyle: 'skill_knight',
        desc: '칼을 휘둘러 초승달 검기를 멀리 날려요. 길 위의 적을 모두 꿰뚫어요',
        lv5: { extra: 1, say: '검기 2번 날림' },
        darken: { ms: 320, alpha: 0.3 },
        iframes: [0, 200],
        shot: { frame: 2, x: 40, y: -60, speed: 380, range: 320, box: { w: 54, h: 76 }, depth: 22, gapMs: 150, hit: WAVE_HIT },
        trail: { frames: [1, 2], everyMs: 35, lifeMs: 170, alpha: 0.35, color: '#a8d4ff' },   // 휘두르는 잔상(2026-11-06 밤)
        look: { proj: 'sword_wave', projLv5: 'sword_wave_lv5' },   // 2026-11-06 우리 그림(검기, Lv5 = 큰 금테 검기). 없으면 코드 초승달
        fx: [ { frame: 2, type: 'slash', x: 30, y: -62, rot: -8, sx: 1.4, sy: 1.2, tint: '#a8d4ff', ms: 200 } ],
        placeholder: { anim: 'attack1', f: [0, 1, 3, 3, 4], d: [70, 50, 130, 110, 110] }
      },
      // 대지 내려찍기(2026-11-06): 뛰어올라(점프 그림) 칼을 내려찍으며(3타 그림) 착지 → 양옆 땅 충격파.
      //   leap = 뛰기 { at: [뜨는 ms, 내려앉는 ms], h = 높이(도트), fwd = 앞으로 가는 거리 }, 그동안 무적(iframes)
      //   quake = 충격파 { at = 터지는 ms, r = 양옆 반지름, depth = 위아래 폭, hit }
      //   placeholder.anims = 장마다 다른 그림(점프 3장 → 3타 3장)
      slam: {
        name: '대지 내려찍기', icon: '땅', mp: 14, cooldownMs: 9000, damageStyle: 'skill_knight',
        desc: '뛰어올라 땅을 내려찍어요. 양옆의 적이 모두 맞고 잠깐 기절해요(누운 적도 맞아요)',
        lv5: { area: 1.35, say: '충격파 크기 +35%' },
        darken: { ms: 700, alpha: 0.45 },
        iframes: [0, 560],
        leap: { at: [80, 380], h: 46, fwd: 26 },
        quake: { at: 380, r: 130, depth: 40, hit: SLAM_HIT },
        trail: { frames: [1, 3], everyMs: 40, lifeMs: 200, alpha: 0.32, color: '#ffe0a0' },   // 뛰어오르는 잔상(2026-11-06 밤)
        zoom: { k: 1.07, ms: 520, lv5: true },   // 화면 당기기(기술 Lv5 만, 2026-11-06 밤). k = 확대 배율
        look: { ring: 'ground_slam' },   // 2026-11-06 우리 그림(내려꽂힘·양옆 충격파·먼지·돌)
        fx: [ { frame: 0, type: 'dust' } ],
        placeholder: { anims: ['jump', 'jump', 'jump', 'attack3', 'attack3', 'attack3'], f: [0, 1, 2, 3, 4, 5], d: [80, 120, 100, 80, 200, 160] },
        female: {
          placeholder: { anims: ['jump', 'jump', 'jump', 'attack3', 'attack3', 'attack3'], f: [0, 1, 2, 0, 1, 4], d: [80, 120, 100, 80, 200, 160] }
        }
      },
      // 올려베기(2026-11-06 밤 콤보): 웅크렸다가(0장) 칼을 아래에서 위로 베어 올리며 살짝 뜀(1~2장 판정) → 3장 내려섬.
      //   동작 그림 없음 → 있는 그림을 이어 붙임(남: 3타 웅크림 → 2타 팔 치켜듦 / 여: 점프 웅크림 → 돌진 올려베기 2장 → 3타)
      //   hop = 살짝 뛰기(leap 와 같음, ms). 끝무렵(3장)에 다른 기술로 이어짐(캔슬)
      upper: {
        name: '올려베기', icon: '올', mp: 9, cooldownMs: 6000, damageStyle: 'skill_knight', launcher: true,
        desc: '칼을 아래에서 위로 베어 올려 적을 공중에 띄워요. 뜬 적은 평타·기술이 다 맞아요(보스·큰 적은 휘청만)',
        lv5: { area: 1.25, say: '베는 범위 +25%' },
        darken: { ms: 360, alpha: 0.3 },
        iframes: [0, 300],
        leap: { at: [90, 330], h: 14, fwd: 10 },
        hits: [ merge(UPPER_HIT, { frames: [1, 2] }) ],
        fx: [
          { frame: 0, type: 'dust' },
          { frame: 1, type: 'slash', x: 30, y: -62, rot: -78, sx: 1.25, sy: 1.6, tint: '#a8d4ff', ms: 260 },
          { frame: 1, type: 'sparkup', x: 34, y: -30, color: '#cfe8ff' }
        ],
        placeholder: { anims: ['attack3', 'attack2', 'attack2', 'attack2'], f: [0, 3, 3, 4], d: [90, 70, 150, 170] },
        female: {
          placeholder: { anims: ['jump', 'motion_dash', 'motion_dash', 'attack3'], f: [0, 2, 3, 5], d: [90, 70, 150, 170] }
        }
      },
      // 칼날 폭풍(2026-11-06, Lv19 사냥 기술): 회전베기 동작 그림(motion_spin)의 한 바퀴(1~4장)를 세 번 되풀이 → 13장 마무리 베기 → 14장 가드.
      //   motionSeq = 기술 장 번호 → 동작 그림 장 번호(같은 그림을 되풀이해서 씀), motionMs = 기술 장마다 시간(hits·fx 의 frame 은 기술 장 번호)
      //   도는 동안 걸을 수 있음(walk). 한 바퀴에 두 번씩 여섯 번 베며 둘레 적을 끌어당기고(STORM_HIT pull), 마지막에 크게 터뜨려 넘어뜨림.
      //   효과 = 있는 회전 고리 그림(spin_ring)을 바퀴마다 + 코드로 그린 회오리(whirl: 바람 고리·강철 파편·빛). 새 그림 없음
      //   sfx = 쓰기 시작 소리(sfx.js 의 기술 소리 표에 없는 기술), fx 'sound' = 그 장에 있는 소리(바퀴마다 skSpin, 마지막 skSlam)
      storm: {
        name: '칼날 폭풍', icon: '폭', mp: 20, cooldownMs: 12000, damageStyle: 'skill_knight', motion: 'motion_spin', sfx: 'skSpin',
        walk: true,
        desc: '칼을 휘두르며 세 바퀴 돌아 둘레의 적을 끌어당기며 여섯 번 베고, 마지막에 크게 터뜨려 넘어뜨려요. 도는 동안 걸을 수 있어요(누운 적도 맞아요)',
        lv5: { area: 1.3, say: '폭풍 크기 +30%' },
        darken: { ms: 1000, alpha: 0.45 },
        iframes: { frames: [0, 13] },
        motionSeq: [0, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 5, 6],
        motionMs: [120, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 130, 180],
        hits: [ merge(STORM_HIT, { frame: 1 }), merge(STORM_HIT, { frame: 3 }), merge(STORM_HIT, { frame: 5 }),
                merge(STORM_HIT, { frame: 7 }), merge(STORM_HIT, { frame: 9 }), merge(STORM_HIT, { frame: 11 }),
                merge(STORM_LAST, { frame: 13 }) ],
        trail: { frames: [1, 13], everyMs: 40, lifeMs: 220, alpha: 0.32, color: '#cfe8ff' },
        zoom: { k: 1.05, ms: 900, lv5: true },
        fx: [
          { frame: 1, type: 'art', fx: 'spin_ring', x: 0, y: -50, follow: true, split: true, alpha: 0.75, scale: 0.85,
            ph: { type: 'ring', y: -58, r: 72, ms: 260, color: '#cfe8ff' } },
          { frame: 5, type: 'art', fx: 'spin_ring', x: 0, y: -50, follow: true, split: true, alpha: 0.8, scale: 0.9,
            ph: { type: 'ring', y: -58, r: 78, ms: 260, color: '#cfe8ff' } },
          { frame: 9, type: 'art', fx: 'spin_ring', x: 0, y: -50, follow: true, split: true, alpha: 0.85, scale: 0.95,
            ph: { type: 'ring', y: -58, r: 84, ms: 260, color: '#cfe8ff' } },
          { frame: 1, type: 'whirl', r: 70 }, { frame: 5, type: 'whirl', r: 76 }, { frame: 9, type: 'whirl', r: 82 },
          { frame: 5, type: 'sound', name: 'skSpin' }, { frame: 9, type: 'sound', name: 'skSpin' },
          { frame: 13, type: 'ring', y: -56, r: 86, ms: 260, color: '#ffffff' },
          { frame: 13, type: 'whirl', r: 90, big: true },
          { frame: 13, type: 'sound', name: 'skSlam' },
          { frame: 13, type: 'dust' }
        ],
        placeholder: { anim: 'attack2', f: [0, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 4, 4],
                       d: [120, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 130, 180], spin: [120, 780], everyMs: 55 },
        female: {
          motionMs: [80, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 100, 150],
          placeholder: { anim: 'attack2', f: [0, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 4, 4],
                         d: [80, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 100, 150], spin: [80, 620], everyMs: 45 }
        }
      },
      // 성검 낙뢰(2차 필살, 2026-11-06): 웅크렸다(0장) 칼을 하늘로 들고(1~2장, 칼끝에서 하늘로 금빛 줄기) 버티는 동안
      //   앞쪽 적들(가까운 순, 적이 모자라면 같은 적에게 또) 위로 금빛 번개 칼이 하나씩 떨어져 땅에 꽂힘 → 마지막 칼은 둘레를 넘어뜨림.
      //   blades = { frame = 첫 칼이 떨어지기 시작하는 장, n = 칼 수(Lv5 lv5.blades), gapMs = 칼 사이, fallMs = 떨어지는 시간,
      //              x = 적이 없을 때 앞 거리들, aim = 찾는 범위, lockMs = 떨어지기 전 자리 고정, r·depth = 칼 하나 판정, stayMs = 꽂혀 있는 시간,
      //              hits = 칼마다 데미지(마지막 = HOLY_LAST) }
      //   칼은 기사가 다른 걸 해도 그대로 떨어짐(메테오처럼). 그림 = 우리 코드(skills.js drawBlade)
      holy: {
        name: '성검 낙뢰', icon: '성', mp: 30, cooldownMs: 18000, damageStyle: 'skill_holy',
        desc: '(필살) 칼을 하늘로 들어 앞쪽 적들 위로 금빛 번개 칼을 내리꽂아요. 마지막 칼은 둘레를 넘어뜨려요(누운 적도 맞아요)',
        lv5: { blades: 7, say: '번개 칼 5개 → 7개' },
        darken: { ms: 1500, alpha: 0.55 },
        iframes: [0, 1100],
        zoom: { k: 1.06, ms: 1300 },
        blades: { frame: 2, n: 5, gapMs: 120, fallMs: 170, x: [70, 120, 170, 220, 270], aim: { range: 300, depth: 80 }, lockMs: 60,
                  r: 30, depth: 34, stayMs: 520, hits: [HOLY_HIT, HOLY_HIT, HOLY_HIT, HOLY_HIT, HOLY_LAST] },
        fx: [ { frame: 0, type: 'dust' }, { frame: 1, type: 'beam', x: 34, y: -128, ms: 1100, color: '#ffe9a0' } ],
        placeholder: { anims: ['attack3', 'attack2', 'attack2', 'attack2'], f: [0, 3, 3, 4], d: [140, 160, 760, 240] },
        female: {
          fx: [ { frame: 0, type: 'dust' }, { frame: 1, type: 'beam', x: 20, y: -132, ms: 1100, color: '#ffe9a0' } ],
          placeholder: { anims: ['jump', 'motion_dash', 'motion_dash', 'attack3'], f: [0, 2, 2, 5], d: [140, 160, 760, 240] }
        }
      },
      // 반격(늘 켜진 기술 counter)이 나갈 때 쓰는 되받아 베기 한 칼. 칸에 끼우는 기술이 아님(기술 책엔 「반격」만 보임).
      //   auto = 저절로 나감(마나·포만감 안 씀), keepDir = 방향 그대로(때린 적 쪽). cooldownMs = 다시 나갈 때까지(반격 Lv 마다 curve 로 줄어듦)
      counterSlash: {
        name: '반격', icon: '반', mp: 0, cooldownMs: 1500, damageStyle: 'skill_knight', auto: true, keepDir: true,
        iframes: [0, 330],
        hits: [ merge(COUNTER_HIT, { frames: [1, 1] }) ],
        trail: { frames: [0, 1], everyMs: 30, lifeMs: 160, alpha: 0.4, color: '#ffd27a' },
        fx: [ { frame: 0, type: 'counterflash' }, { frame: 1, type: 'arc', x: 34, y: -62, r: 46, color: '#ffe08a', ms: 220 } ],
        placeholder: { anim: 'attack1', f: [0, 3, 4], d: [60, 130, 140] },
        female: { placeholder: { anim: 'attack1', f: [0, 2, 3], d: [60, 130, 140] } }
      }
    },
    mage: {
      // 화염구: 마법탄보다 크고 묵직한 불덩이. 처음 맞은 적(또는 끝까지 날아간 곳)에서 크게 터져 주변을 넘어뜨림
      //   발사 = 남 3장(+127,-65, 260/초, 240) / 여 2장(+85,-75, 340/초, 220) (그림 자료 motions.json)
      fireball: {
        name: '화염구', icon: '화', mp: 10, cooldownMs: 3800,   // 2026-11-06 법사 균형: 4500 → 3800 (3판 Lv7 = 기술이 화염구뿐)
        damageStyle: 'skill_fire', motion: 'motion_cast_forward',
        desc: '큰 불덩이를 던져요. 맞은 곳에서 크게 터져 둘레의 적을 넘어뜨려요',
        lv5: { area: 1.3, say: '폭발 크기 +30%' },
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
      bolt: {
        name: '번개', icon: '번', mp: 16, cooldownMs: 8000, damageStyle: 'skill_bolt', motion: 'motion_cast_sky',
        desc: '앞쪽 가까운 적에게 번개 세 줄기를 내리꽂아요. 맞은 적은 잠깐 감전돼 멈춰요',
        lv5: { area: 1.3, bolts: 5, wide: 110, say: '번개 5줄기 · 더 넓게 · 굵기 +30%' },
        zoom: { k: 1.06, ms: 900, lv5: true },   // 화면 당기기(Lv5 만, 2026-11-06 밤)   // 2026-11-06: bolts = 줄기 수, wide = 늘어난 줄기가 겨눈 자리 바깥으로 떨어지는 거리(원래 크기 도트)
        darken: { ms: 950, alpha: 0.5 },
        iframes: { frames: [0, 2] },
        strikes: strikesOf(120, [75, 120, 165]),
        placeholder: { anim: 'attack2', f: [0, 1, 2, 3, 3, 3, 4], d: [80, 90, 60, 160, 160, 110, 100] },
        female: {
          strikes: strikesOf(100, [70, 110, 150]),
          placeholder: { anim: 'attack3', f: [0, 1, 2, 2, 2, 3, 4], d: [80, 90, 160, 160, 120, 80, 70] }
        }
      },
      // 얼음창(2026-11-06): 화염구와 같은 「앞으로 던지기」 동작. 빠르고 가는 얼음창 → 처음 맞은 적 하나(Lv5 = 꿰뚫음) + 느려짐.
      //   cast 는 화염구와 같은 값(burst 없음 = 터지지 않음). pierce = 꿰뚫기, slow = 느려짐 { ms, mul, bossMul }
      ice: {
        name: '얼음창', icon: '얼', mp: 8, cooldownMs: 5000, damageStyle: 'skill_ice', motion: 'motion_cast_forward',
        desc: '얼음창을 빠르게 던져요. 맞은 적은 잠깐 느려져요(걷기·공격 모두)',
        lv5: { pierce: true, say: '꿰뚫고 날아감' },
        darken: { ms: 360, alpha: 0.3 },
        iframes: { frames: [0, 3] },
        cast: { frame: 3, x: 127, y: -65, speed: 460, range: 300, box: { w: 50, h: 30 }, depth: 18, backReach: 110,
                tint: '#9fe8ff', tintK: 0.85, scale: 1.5, hit: ICE_HIT, slow: { ms: 2600, mul: 0.5, bossMul: 0.72 } },
        look: { proj: 'ice_lance', hit: 'ice_shatter' },   // 2026-11-06 우리 그림
        fx: [ { frame: 3, type: 'spark', x: 127, y: -65, scale: 1.4, tint: '#bff4ff' } ],
        placeholder: { anim: 'attack3', f: [0, 1, 2, 3, 4, 5], d: [80, 90, 60, 150, 110, 110] },
        female: {
          cast: { frame: 2, x: 85, y: -75, speed: 520, range: 280, box: { w: 50, h: 30 }, depth: 18, backReach: 75,
                  tint: '#9fe8ff', tintK: 0.85, scale: 1.5, hit: ICE_HIT, slow: { ms: 2600, mul: 0.5, bossMul: 0.72 } },
          fx: [ { frame: 2, type: 'spark', x: 85, y: -75, scale: 1.4, tint: '#bff4ff' } ],
          placeholder: { anim: 'attack3', f: [0, 1, 2, 3, 4], d: [70, 90, 150, 140, 150] }
        }
      },
      // 메테오(2026-11-06): 「하늘로 들기」 동작. 3장에 앞쪽 바닥(가까운 적 발밑, 없으면 x 만큼 앞)에 빨간 표시 → markMs 뒤
      //   화면 위에서 큰 운석이 비스듬히 fallMs 동안 떨어져 크게 터짐(r, depth). 법사가 다른 걸 해도 운석은 그대로 떨어짐
      meteor: {
        name: '메테오', icon: '운', mp: 30, cooldownMs: 16000, damageStyle: 'skill_fire', motion: 'motion_cast_sky',
        desc: '앞쪽 바닥에 큰 운석을 떨어뜨려요. 크게 터져 둘레의 적을 모두 넘어뜨려요(누운 적도 맞아요)',
        lv5: { area: 1.3, say: '폭발 크기 +30%' },
        darken: { ms: 1300, alpha: 0.55 },
        iframes: { frames: [0, 2] },
        meteor: { frame: 3, x: 140, aim: { range: 240, depth: 70 }, markMs: 560, fallMs: 380, r: 120, depth: 60, size: 30, hit: METEOR_HIT },
        zoom: { k: 1.06, ms: 1300 },   // 화면 당기기(늘, 2026-11-06 밤)
        look: { art: 'meteor', rock: 'fireball', boom: 'fire_explosion' },   // art = 우리 그림(떨어짐~폭발 한 벌, 6장 = 쾅). 없으면 rock·boom
        placeholder: { anim: 'attack2', f: [0, 1, 2, 3, 3, 3, 4], d: [80, 90, 60, 160, 160, 110, 100] },
        female: {
          placeholder: { anim: 'attack3', f: [0, 1, 2, 2, 2, 3, 4], d: [80, 90, 160, 160, 120, 80, 70] }
        }
      },
      // 땅 융기(2026-11-06 밤 콤보): 「하늘로 들기」 동작을 빠르게. 1장에 앞쪽 가까운 적 발밑(없으면 x 만큼 앞)에 보라 마법진 →
      //   lockMs 전까지 그 적을 따라가다 고정 → 3장에 돌기둥이 솟아 기둥 위 적을 띄움(기사 대지 내려찍기 = 양옆 땅 충격파·기절과 다른 모양).
      //   pillar = { frame = 마법진 장, burst = 솟는 장, x = 적이 없을 때 앞 거리, aim = 찾는 범위, lockMs, r = 기둥 판정 반폭, depth = 위아래 폭, hit }
      //   look = 우리 그림(pipeline/ourfx: earth_circle = 마법진 / earth_pillar = 돌기둥 솟음~무너짐)
      rise: {
        name: '땅 융기', icon: '융', mp: 12, cooldownMs: 6500, damageStyle: 'skill_earth', motion: 'motion_cast_sky', launcher: true,
        motionMs: [90, 110, 120, 70, 160, 130],
        desc: '앞쪽 바닥에 보라 마법진을 그려 돌기둥을 솟게 해요. 기둥 위 적이 공중에 떠요(보스·큰 적은 휘청만)',
        lv5: { area: 1.35, say: '기둥 굵기 +35%' },
        darken: { ms: 420, alpha: 0.35 },
        iframes: { frames: [0, 2] },
        pillar: { frame: 1, burst: 3, x: 110, aim: { range: 210, depth: 60 }, lockMs: 90, r: 34, depth: 26, hit: RISE_HIT },
        look: { circle: 'earth_circle', pillar: 'earth_pillar' },
        placeholder: { anim: 'attack2', f: [0, 1, 2, 3, 3, 4], d: [90, 110, 120, 70, 160, 130] },
        female: {
          motionMs: [70, 100, 110, 60, 160, 120],
          placeholder: { anim: 'attack3', f: [0, 1, 2, 2, 3, 4], d: [70, 100, 110, 60, 160, 120] }
        }
      },
      // 순간이동(2차, 2026-11-06): 0장(at 전) 보라 빛이 모임 → 사라짐(자리에 작은 보라 폭발 = 둘레 적 밀어냄) → hideMs 뒤 dist 만큼 떨어진 곳에 나타남.
      //   방향 = 누르는 쪽(안 누르면 바라보는 쪽). 뒤로 가도 바라보는 방향은 그대로(적을 보며 물러남). 쓰는 동안 안 맞음
      //   blink = { at = 사라지는 ms, hideMs = 안 보이는 시간, dist = 거리, r·depth = 폭발 판정, hit }. Lv5 = 더 멀리 + 나타나는 자리도 폭발
      blink: {
        name: '순간이동', icon: '이', mp: 8, cooldownMs: 6000, damageStyle: 'skill_arcane',
        desc: '누르는 쪽(안 누르면 앞)으로 순간이동해요. 사라지는 자리에 작은 폭발이 터져 둘레 적을 밀어내요. 쓰는 동안 안 맞아요',
        lv5: { dist: 1.3, both: true, say: '거리 +30% · 나타나는 자리도 폭발' },
        iframes: [0, 420],
        blink: { at: 90, hideMs: 150, dist: 160, r: 50, depth: 30, hit: BLINK_HIT },
        placeholder: { anims: ['attack3', 'attack3', 'idle'], f: [0, 0, 0], d: [90, 150, 170] }
      },
      // 불기둥(2차, 2026-11-06): 「하늘로 들기」 동작. 1장에 앞쪽 가까운 적 발밑(없으면 x 앞)에 주황 마법진 → lockMs 전까지 따라감 →
      //   3장에 큰 불기둥이 솟아 크게 한 번(hit) + 타는 동안 tickMs 마다 작게(tick, ticks 번). 띄우지 않음(땅 융기와 다름), 누운 적도 맞음.
      //   flame = { frame, burst, x, aim, lockMs, r = 기둥 판정 반폭, depth, h = 기둥 높이(원래 크기 도트), ms = 타는 시간, tickMs, ticks, hit, tick }
      pillar: {
        name: '불기둥', icon: '기', mp: 18, cooldownMs: 9000, damageStyle: 'skill_fire', motion: 'motion_cast_sky',
        desc: '앞쪽 적 발밑에서 큰 불기둥이 솟아 크게 태워요. 타는 동안 여러 번 더 맞아요(띄우지는 않음, 누운 적도 맞아요)',
        lv5: { area: 1.35, say: '불기둥 굵기 +35%' },
        darken: { ms: 900, alpha: 0.45 },
        iframes: { frames: [0, 2] },
        flame: { frame: 1, burst: 3, x: 120, aim: { range: 230, depth: 60 }, lockMs: 90, r: 50, depth: 34, h: 230, ms: 1100,
                 tickMs: 220, ticks: 4, hit: FLAME_HIT, tick: FLAME_TICK },
        placeholder: { anim: 'attack2', f: [0, 1, 2, 3, 3, 3, 4], d: [80, 90, 60, 160, 160, 110, 100] },
        female: {
          placeholder: { anim: 'attack3', f: [0, 1, 2, 2, 2, 3, 4], d: [80, 90, 160, 160, 120, 80, 70] }
        }
      }
    }
  };

  // ---------- 기술 책 (성장 4단계, 2026-11-06, 기획\성장시스템-설계안.md) : 직업마다 11개 = 쓰는 기술(active) 7 + 늘 켜진 기술(passive) 4 (2026-11-06 기사 칼날 폭풍 넣음) ----------
  // 순서 = 기술 창에 나오는 순서. unlock = 그 레벨이 되면 열림(0 = 전직 즉시). 전직 뒤 대략 2레벨마다 하나 → Lv23 에 다 열림(기사·법사 11개)
  //   두 번째 쓰는 기술은 Lv8(전직 바로 다음 레벨): 3판(도착 Lv7) 도중에 열려 「기술이 생겼다」를 빨리 느끼게(자동 조종 시험으로 정함)
  //   쓰는 기술 = SKILLS[직업][id] (위). passive = 늘 켜진 기술 { stat = 무엇이 오르나, val = 기술 Lv1~5 값 }
  //     stat: 'phys' = 물리 공격 +% (검 콤보·기사 기술) / 'magic' = 마법 공격 +% / 'guard' = 받는 피해 -% / 'mpRegen' = 마나 회복 +%
  //   soon = 아직 안 만든 기술(2차, 기술 창에 「준비 중」 자물쇠로만 보임). 만들면 soon 을 지우고 SKILLS 에 동작을 넣으면 됨
  //   메모(2026-11-06): 메테오(필살)는 지금 만든 기술이라 Lv15 에 둠. 2차로 순간이동·불기둥이 생기면 Lv23 으로 옮기는 것도 생각(숫자 하나)
  // 예비 후보(아직 목록에 없음): 집중 · 마력 폭주 · 서리 갑옷 · 회오리(법사, 적을 빨아들여 띄우는 바람 — 2026-11-06 밤 형님 「나중 후보」)
  // 2026-11-06 밤 콤보: 띄우기 기술 올려베기(기사)·땅 융기(법사)를 앞당김(3번째 칸이 열리는 레벨에 같이 열림 → 바로 끼워짐). 불기둥은 2차 그대로(띄우지 않는 큰 한 방)
  // 2026-11-06 순서 바꿈: 늘 켜진 기술이 쓰는 기술 사이에 끼게 = Lv9 늘 켜진 기술(검 숙련·원소 증폭) → Lv10 띄우기 기술(+3번째 칸) → Lv11 늘 켜진 기술
  //   + 기사 Lv19 칼날 폭풍(사냥 기술, 비어 있던 Lv19 자리) → 기사도 11개(쓰는 기술 7 + 늘 켜진 기술 4)
  //   short = 기술 창(책 모양, 2026-11-06 폰 UI) 칸에 쓰는 짧은 설명 한 줄(긴 설명 desc 는 칸에 손을 올리면 · 고르면 보임)
  var SKILL_TREE = {
    knight: [
      { id: 'dash', unlock: 0, short: '앞으로 미끄러지며 베요' },
      { id: 'spin', unlock: 8, short: '한 바퀴 돌며 세 번 베요' },
      { id: 'mastery', unlock: 9, short: '검 공격이 세져요', name: '검 숙련', icon: '숙', desc: '검으로 하는 모든 공격(콤보·기술)이 세져요',
        passive: { stat: 'phys', val: [0.08, 0.12, 0.16, 0.2, 0.25] } },
      { id: 'upper', unlock: 10, short: '적을 공중에 띄워요' },   // 2026-11-06 밤 콤보: 2차(Lv19)에서 앞당김. Lv10 = 3번째 칸이 열리면서 바로 끼워짐(2026-11-06 Lv9 → 10)
      { id: 'skin', unlock: 11, short: '받는 피해가 줄어요', name: '강철 피부', icon: '피', desc: '적에게 받는 피해가 줄어요',
        passive: { stat: 'guard', val: [0.05, 0.08, 0.11, 0.14, 0.18] } },
      { id: 'wave', unlock: 13, short: '초승달 검기를 날려요' },
      { id: 'slam', unlock: 15, short: '뛰어올라 땅을 내려찍어요' },
      // 2차(2026-11-06 넣음): passive.stat 'grit' = 체력이 from(비율) 밑으로 내려가면 물리 공격이 오르기 시작해 full 이하에서 val(최대)
      //   'counter' = 맞을 때(넘어지지 않는 보통 타, 가까운 적) val 확률로 되받아 베기(SKILLS.knight.counterSlash), reach = 그 적까지 거리
      { id: 'grit', unlock: 17, short: '체력이 적을수록 검이 세져요', name: '투지', icon: '투', desc: '체력이 90% 밑으로 줄수록 검 공격이 세져요(30% 이하에서 가장 셈). 세지면 발밑에 붉은 기운이 일어요',
        passive: { stat: 'grit', val: [0.2, 0.25, 0.3, 0.35, 0.4], from: 0.9, full: 0.3 } },
      { id: 'storm', unlock: 19, short: '세 바퀴 돌며 끌어모아 베요' },   // 2026-11-06 사냥 기술(몹 떼를 끌어모아 쓸어 버림)
      { id: 'counter', unlock: 21, short: '맞는 순간 되받아 베요', name: '반격', icon: '반', desc: '맞는 순간(넘어지지 않는 보통 타) 확률로 바로 되받아 베어요. 1.5초에 한 번까지',
        passive: { stat: 'counter', val: [0.3, 0.35, 0.4, 0.45, 0.5], reach: 140 } },
      { id: 'holy', unlock: 23, short: '금빛 번개 칼을 내리꽂아요' }
    ],
    mage: [
      { id: 'fireball', unlock: 0, short: '큰 불덩이를 던져요' },
      { id: 'bolt', unlock: 8, short: '번개 세 줄기를 내리꽂아요' },
      { id: 'amp', unlock: 9, short: '모든 마법이 세져요', name: '원소 증폭', icon: '증', desc: '모든 마법(지팡이 타·마법탄·기술)이 세져요',
        passive: { stat: 'magic', val: [0.08, 0.12, 0.16, 0.2, 0.25] } },
      { id: 'rise', unlock: 10, short: '돌기둥으로 적을 띄워요' },    // 2026-11-06 밤 콤보: 땅 융기(띄우기). 2차 「불기둥」 자리를 대신해 앞당김(2026-11-06 Lv9 → 10)
      { id: 'flow', unlock: 11, short: '마나가 더 빨리 차요', name: '마나 순환', icon: '순', desc: '마나가 더 빨리 차요',
        passive: { stat: 'mpRegen', val: [0.2, 0.35, 0.5, 0.65, 0.85] } },
      { id: 'ice', unlock: 13, short: '맞은 적은 느려져요' },
      { id: 'meteor', unlock: 15, short: '큰 운석을 떨어뜨려요' },
      // 2차(2026-11-06 넣음): passive.stat 'shield' = 받는 피해의 val 만큼을 마나가 대신 받음(마나 1 = 피해 1, 마나가 모자라면 있는 만큼)
      //   'brand' = 기술 마법에 맞은 적에게 ms 동안 낙인 → 그동안 그 적이 받는 모든 공격 +val
      { id: 'blink', unlock: 17, short: '사라졌다 나타나며 피해요' },
      { id: 'shield', unlock: 19, short: '피해 일부를 마나가 대신 받아요', name: '마나 방패', icon: '방', desc: '받는 피해 일부를 마나가 대신 받아요. 막을 때 몸 둘레에 파란 방패가 번쩍해요',
        passive: { stat: 'shield', val: [0.2, 0.25, 0.3, 0.35, 0.4] } },
      { id: 'pillar', unlock: 21, short: '큰 불기둥이 솟아 태워요' },
      { id: 'brand', unlock: 23, short: '기술에 맞은 적이 더 아파요', name: '원소 낙인', icon: '낙', desc: '기술 마법에 맞은 적에게 4초 동안 낙인(머리 위 문양)이 찍혀, 그동안 모든 공격에 더 아프게 맞아요',
        passive: { stat: 'brand', val: [0.1, 0.13, 0.16, 0.19, 0.22], ms: 4000 } }
    ]
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
  // ---------- 3단계 배경 = 늪지대 (art\stage3-bg 에서 복사, 2026-11-04) ----------
  // 늪 가장자리 → 도마뱀족 수상 마을 → 깊은 늪 제단. 크기·바닥·걷는 길은 1·2단계와 같음(mid 3장 = 2단계와 같은 길이)
  var BG_SWAMP = {
    far:    { img: 'assets/bg/stage3/far.png',    w: 512,  tile: true,  parallax: 0.15 },
    mid:    { img: 'assets/bg/stage3/mid.png',    w: 1247, tile: false, parallax: 0.5 },
    ground: { img: 'assets/bg/stage3/ground.png', w: 692,  tile: true,  parallax: 1.0 },
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
  // ---------- 5단계 배경 = 눈 덮인 산 (art\stage5-bg 에서 복사, 2026-11-04) ----------
  // 소나무 숲 가장자리 → 산길 감시탑·돌다리·얼어붙은 폭포 → 예티 동굴. 크기·바닥·걷는 길은 1~4단계와 같음(mid 3장 = 2단계와 같은 길이)
  var BG_SNOW = {
    far:    { img: 'assets/bg/stage5/far.png',    w: 512,  tile: true,  parallax: 0.15 },
    mid:    { img: 'assets/bg/stage5/mid.png',    w: 1247, tile: false, parallax: 0.5 },
    ground: { img: 'assets/bg/stage5/ground.png', w: 708,  tile: true,  parallax: 1.0 },
    height: 240, floorY: 144, laneTop: 158, laneBottom: 230
  };
  // ---------- 6단계 배경 = 해적 항구 (art\stage6-bg 에서 복사, 2026-11-04) ----------
  // 항구 마을 → 정박한 해적선 → 요새 부두 + 등대(해질녘). 크기·바닥·걷는 길은 1~4단계와 같음(mid 가 조금 짧음 → 판 끝에 맞춰 자동으로 느리게 흐름)
  var BG_HARBOR = {
    far:    { img: 'assets/bg/stage6/far.png',    w: 512,  tile: true,  parallax: 0.15 },
    mid:    { img: 'assets/bg/stage6/mid.png',    w: 1197, tile: false, parallax: 0.5 },
    ground: { img: 'assets/bg/stage6/ground.png', w: 684,  tile: true,  parallax: 1.0 },
    height: 240, floorY: 144, laneTop: 158, laneBottom: 230
  };
  // ---------- 7단계 배경 = 화산 (art\stage7-bg 에서 복사, 2026-11-04) ----------
  // 흑요석 첨탑·용암 폭포 → 불의 교단 폐허 신전/대장간 → 용의 둥지 입구. 크기·바닥·걷는 길은 1~6단계와 같음(mid 3장 = 2단계와 같은 길이)
  var BG_VOLCANO = {
    far:    { img: 'assets/bg/stage7/far.png',    w: 512,  tile: true,  parallax: 0.15 },
    mid:    { img: 'assets/bg/stage7/mid.png',    w: 1247, tile: false, parallax: 0.5 },
    ground: { img: 'assets/bg/stage7/ground.png', w: 704,  tile: true,  parallax: 1.0 },
    height: 240, floorY: 144, laneTop: 158, laneBottom: 230
  };
  // ---------- 8단계 배경 = 유령 고성 (art\stage8-bg 에서 복사, 2026-11-04) ----------
  // 가고일 성문 → 대연회장(스테인드글라스·찢어진 깃발) → 지하묘지·흡혈귀 왕좌, 보름달 밤. 크기·바닥·걷는 길은 1~7단계와 같음
  var BG_CASTLE = {
    far:    { img: 'assets/bg/stage8/far.png',    w: 512,  tile: true,  parallax: 0.15 },
    mid:    { img: 'assets/bg/stage8/mid.png',    w: 1245, tile: false, parallax: 0.5 },
    ground: { img: 'assets/bg/stage8/ground.png', w: 703,  tile: true,  parallax: 1.0 },
    height: 240, floorY: 144, laneTop: 158, laneBottom: 230
  };
  // ---------- 9단계 배경 = 마왕군 요새 (art\stage9-bg 에서 복사, 2026-11-04) ----------
  // 외성벽(가시 현무암 벽·뿔 탑·공성 투석기) → 군영(말뚝 울타리·병영·전쟁 북) → 내성문(검은 쇠창살 문), 초록·보라 번개 폭풍 하늘. 크기·바닥·걷는 길은 1~8단계와 같음
  var BG_FORTRESS = {
    far:    { img: 'assets/bg/stage9/far.png',    w: 512,  tile: true,  parallax: 0.15 },
    mid:    { img: 'assets/bg/stage9/mid.png',    w: 1247, tile: false, parallax: 0.5 },
    ground: { img: 'assets/bg/stage9/ground.png', w: 740,  tile: true,  parallax: 1.0 },
    height: 240, floorY: 144, laneTop: 158, laneBottom: 230
  };
  // ---------- 10단계 배경 = 마왕성 (art\stage10-bg 에서 복사, 2026-11-04, 마지막 판) ----------
  // 흑요석 대전당(금 기둥·뿔 기사 석상) → 심연 위의 다리(보랏빛 영혼불 기둥) → 마왕의 옥좌실(해골 옥좌·핏빛 일식 창), 핏빛 일식 하늘. 크기·바닥·걷는 길은 1~9단계와 같음
  var BG_DEMONCASTLE = {
    far:    { img: 'assets/bg/stage10/far.png',    w: 512,  tile: true,  parallax: 0.15 },
    mid:    { img: 'assets/bg/stage10/mid.png',    w: 1244, tile: false, parallax: 0.5 },
    ground: { img: 'assets/bg/stage10/ground.png', w: 683,  tile: true,  parallax: 1.0 },
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
      minLandW: 360,       // 가로 화면 최소 폭(도트). 폴드 펼친 화면처럼 정사각형에 가까우면 배율을 낮춰 옆을 넓게(캐릭터가 너무 커지지 않게, 남는 위쪽은 하늘)

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
      lungeMul: 2.5,        // 평타 판정 때 앞으로 내딛는 폭 전체 배율 (2026-11-06 형님: 폰에서 더 전진하게)
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
        slide:  { dmg: 1.2, hitstop: 1.5, knock: 1.6, shake: 1.7, spark: 1.0, hitY: -30, knockdown: true, crit: true, big: true, hitsDown: true }   // 슬라이딩 = 바닥을 쓸어서 누운 적도 맞음
      },
      // 공중 공격: 1·2장이 판정. reachDown = 판정 상자를 아래로 더 늘림(원래 크기 도트, 내려치기가 땅 위 적에게 닿게)
      //   hitsDown = 떨어지며 내려치기라 누운 적도 맞음(ai.otg)
      jumpAttack: { dmg: 1.2, hitstop: 1.1, knock: 1.3, shake: 1.2, spark: 0.9, knockdown: true, reachDown: 34, depth: 10, hitsDown: true },
      // 회피(2026-11-07 형님 요청): 몹이 몰릴 때 빠르게 빠져나가는 짧은 대시. 공격 아님(판정 없음) · 마나 없음 · 무적
      //   방향 = 지금 누르는(미는) 쪽 8방향. 아무것도 안 누르면 뒤로(바라보는 반대쪽, 바라보는 방향은 그대로 = 뒤로 빠지기)
      //   서 있기·걷기·달리기 중, 그리고 평타·기술·달리며 공격·착지의 끝무렵(캔슬)에서 나감. 넘어짐·움찔·공중·붙잡힘 중에는 안 됨
      //   그림 = 있는 그림 재사용(앞으로 = 달리며 공격 첫 장, 뒤·위아래 = 점프 웅크림 → 끝에 착지 웅크림) + 코드로 그린 잔상(직업 색) + 시작·끝 먼지
      dodge: {
        dist: 80,           // 가는 거리(화면 도트, actorScale 로 안 줄임). 좌우 기준
        depthMul: 0.55,     // 위아래(안쪽)로 갈 때 = dist x 이 값 (달리기 위아래 배율과 같게)
        ms: 220,            // 걸리는 시간. 처음 빠르고 끝에 느려짐(ease-out)
        ease: 2,            // 느려지는 정도(2 = 보통 ease-out, 클수록 처음에 확 나감)
        graceMs: 60,        // 무적 = 회피 내내 + 끝나고 이만큼 더(깜빡임 없음)
        cdMs: 1800,         // 쿨타임(폰 버튼이 시계 방향으로 어두워졌다 밝아짐)
        bufferMs: 150,      // 미리 눌러 둔 회피 기억 시간(공격 끝무렵에 눌러 두면 끊고 나감)
        endPose: 0.62,      // 이 비율부터 착지 웅크림 그림
        ghosts: 5,          // 잔상 개수(길 따라 고르게)
        ghostMs: 300,       // 잔상 하나가 사라지는 시간
        ghostAlpha: 0.6,    // 잔상 처음 진하기
        colors: { novice: '#fff0c0', knight: '#6ab8ff', mage: '#c890ff' },   // 잔상 색(직업별). 없는 직업 = novice
        dust: 0.45          // 시작·끝 먼지 크기
      }
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
    // 전직 화면 카드(2026-11-06): 고를 수 있는 직업(위 classes 이름) + 「준비 중」 회색 카드. desc = 카드 밑 짧은 설명
    classChange: [
      { key: 'knight', name: '기사', weapon: '검', desc: '튼튼한 갑옷과 검. 앞으로 파고들어 베는 근접 싸움꾼' },
      { key: 'mage',   name: '법사', weapon: '지팡이', desc: '마법탄과 폭발로 여러 적을 한꺼번에. 몸은 약하지만 멀리서 강함' },
      { name: '맨손파이터', soon: true, desc: '주먹과 발차기의 달인' },
      { name: '도적', soon: true, desc: '빠른 단검과 함정' },
      { name: '소환사', soon: true, desc: '동료를 불러 함께 싸움' }
    ],

    // ---------- 무기별 손맛 (맨손 = 가볍게 툭, 검 = 스윽 빠르게, 도끼 = 쾅 무겁게) ----------
    // magic: true = 마법 공격(성장 능력치 지능 INT 로 세짐, 2026-11-06). 없으면 물리 공격(힘 STR).
    //   법사 지팡이·완드로 나가는 건 전부 마법: 근접 타·마법탄·터짐·화염구·번개(기술도 쏠 때 무기로 고름, main.js onHit)
    //   2026-11-06 법사 균형: 지팡이 9~13 → 11~15, 완드 8~12 → 10~14 (자동 조종 시험에서 3판 Lv7 법사가 0/6 → 기사와 비슷하게)
    weapons: {
      fist:  { damage: [8, 11],  hitstopMul: 0.9, shakeMul: 0.85, knockMul: 0.85, speed: 1.0, arcColor: '#ffffff', sparkColor: '#ffe6a0' },
      sword: { damage: [11, 15], hitstopMul: 1.0, shakeMul: 1.0, knockMul: 1.0, speed: 1.0,  arcColor: '#cfe8ff', sparkColor: '#fff3b0' },
      axe:   { damage: [19, 26], hitstopMul: 1.6, shakeMul: 1.8, knockMul: 1.6, speed: 0.78, arcColor: '#ffc27a', sparkColor: '#ffb347' },
      // 법사: 근접 한 타는 검과 비슷(검 11~15, 2026-11-06 올림: 몸이 약하고 일찍은 기술이 화염구 하나뿐). 마무리 마법(배율 1.8~1.9, 여러 마리 동시)으로 메운다
      staff: { damage: [11, 15],  magic: true, hitstopMul: 1.0, shakeMul: 0.95, knockMul: 0.95, speed: 1.0, arcColor: '#d9c2ff', sparkColor: '#c99bff' },
      wand:  { damage: [10, 14],  magic: true, hitstopMul: 0.95, shakeMul: 0.9, knockMul: 0.9, speed: 1.0, arcColor: '#e6d2ff', sparkColor: '#e0a8ff' }
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
        { f: [0, 1, 1, 2, 3, 3, 4], d: [40, 60, 70, 30, 70, 90, 110], active: [3, 4], cancel: 99, lunge: 16, dmg: 1.7, hitstop: 1.7, knock: 2.4, shake: 2.0, arc: { from: -130, to: 70, r: 58, w: 12 }, finisher: true, hitsDown: true }
      ]
    },

    // ---------- 타격감 (전부 여기서 조절, ?debug=1 화면에서 실시간 조절 가능) ----------
    // 보스 등장 컷인(2026-11-06 밤, main.js drawIntro): 그 판 보스가 처음 나올 때 ms 동안 게임 멈춤 + 경고 띠 + 보스 얼굴판 + 칭호·이름.
    //   공격·점프로 넘김. color = 얼굴판 색(보스 rageColor 가 있으면 그것), king = 10단계 마왕(길게·보라). titles = 보스 종류 → 칭호
    bossIntro: { on: true, ms: 1800, kingMs: 2600, color: '#c8361a', kingColor: '#7a2ad8',
                 titles: { orc: '숲의 폭군', golem: '동굴의 돌 수호자', toad: '늪의 탐식가', scorpion: '모래 속 독침의 왕', giant: '얼음 봉우리의 거인',
                           captain: '검은 바다의 약탈자', wyvern: '화산을 나는 날개', vampire: '피에 굶주린 밤의 귀족', general: '마왕군 선봉장', demonking: '어둠의 왕좌' } },

    // ---------- 분노·각성 (2026-11-06 밤, 기획\성장시스템-설계안.md 「분노·각성」, 그림·계산 = main.js) ----------
    // 분노(rage, 0~100 %): 마나 밑 주황 막대. 평타 적중 +hit · 기술 적중 +skillHit(대상마다, 공중·누운 적 타도 셈) · 맞음 +hurt. 소품은 안 셈
    //   idleMs 동안 때리지도 맞지도 않으면 초당 drainPerSec 씩 줆. 판 시작 = 0. 각성하면 0 이 되고 각성 동안은 안 참
    rage: { hit: 2, skillHit: 4, hurt: 6, idleMs: 4000, drainPerSec: 6 },
    // 각성(awaken): 분노 100% → 「각성」 버튼(폰: 기술 버튼 위 / PC: L·F) → ms 동안
    //   공통 = 공격 x atkMul · 슈퍼아머(보통 타에 움찔·밀림 없음, 넘어뜨리는 큰 타는 그대로. 맞은 뒤 armorMs 동안 또 안 맞음) · 기술 쿨타임 cdRate 배로 빨리 끝남(= 절반)
    //     · 데미지 숫자 크게 직업 색(damageText.awk_직업) · 화면 가장자리 직업 색
    //   변신 순간(introMs, 진짜 시간): 화면 어둡게 + 슬로(slowMs) + 몸 흰 번쩍 + 발밑 빛기둥 + 얼굴 컷인 띠 「각성!」 + 흔들림 + 주변 적 밀침(pushR 안, push 도트) · 그동안 무적
    //   끝 = 주변 큰 폭발(end: r 반지름 · depth 위아래 · dmg = 무기 데미지 배율(레벨·능력치 공격력 그대로 곱함) · 넘어뜨림) → 원래 색
    //   knight 「광전사」: 콤보 빠르기 +atkSpd(민첩과 합쳐 spdCap 까지) · 타격마다 준 데미지 x lifesteal 만큼 체력(최소 1). 붉은 불꽃
    //   mage 「마력 폭주」: 기술 마나 0 · 기술이 한 번 더 터짐(화염구·얼음창 = 한 발 더, 번개 = 같은 자리에 한 번 더, 메테오·땅 융기 = 다른 적에게 하나 더, echoMs 뒤)
    //   novice(전직 전 견습): 공통만(금색)
    //   거리 값(pushR·push·end.r·end.depth)은 원래 그림 크기 기준(쓸 때 actorScale 곱함)
    awaken: {
      ms: 10000, introMs: 650, slowMs: 650, atkMul: 1.3, cdRate: 2, armorMs: 400, pushR: 150, push: 70,
      end: { r: 170, depth: 70, dmg: 4 },
      knight: { name: '광전사', color: '#ff3a1a', glow: '#ff8a3a', atkSpd: 0.25, spdCap: 1.5, lifesteal: 0.05,
                look: { hue: -18, sat: 1.25, bright: 0.72, color: '#8a0a0a', colorK: 0.38 } },
      mage:   { name: '마력 폭주', color: '#b46aff', glow: '#5ae6ff', echoMs: { fireball: 160, ice: 130, bolt: 200, meteor: 260, rise: 190 },
                look: { hue: 12, sat: 1.35, bright: 0.72, color: '#3a0a6a', colorK: 0.3 } },
      novice: { name: '각성', color: '#ffd23f', glow: '#fff2a0' }
    },
    // ---------- 효과음 (2026-11-07, js/sfx.js: 소리 파일 없이 코드로 만든 칩튠 소리) ----------
    //   on = false 면 처음부터 꺼짐(오른쪽 위 스피커 버튼 · PC M 키로 켬, 브라우저에 저장). master = 전체 크기, sfx = 효과음 크기(0~1)
    //   maxVoices = 동시에 나는 소리 수 상한(레벨업·보스·클리어 같은 중요한 소리는 상한 없음). 소리마다 동시 수·간격은 sfx.js 목록(cap · gap)
    //   limiter = 누르개(몹이 한꺼번에 맞아도 소리가 안 터지게): threshold dB 넘으면 ratio 배로 누름
    //   vol = 소리 하나만 크기 바꾸기 { hit: 0.8, orb: 0.5 … } (1 = 그대로)
    audio: {
      on: true, master: 0.8, sfx: 0.7, maxVoices: 18,
      limiter: { threshold: -16, knee: 10, ratio: 8, attack: 0.003, release: 0.18 },
      vol: {}
    },
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
      timeScale: 1.0,       // 전체 속도(디버그용 슬로모션)
      // 손맛 화려하게(2026-11-06 밤, 형님 「임팩트 화려하게」): 무거운 타 = 콤보 마무리·기술·넘어뜨리는 타·띄우기
      //   heavyStop = 무거운 타 멈춤 배율, heavyShake / lightShake = 흔들림 배율, spark = 불똥 수 배율, glow = 무거운 타 맞은 곳 둥근 빛(더하기) 세기,
      //   glowR = 그 빛 반지름(원래 크기 도트), flashHeavy = 무거운 타 하얀 번쩍 길이 배율, numPop = 마무리·치명타 숫자가 처음 튀어나오는 크기
      impact: { heavyStop: 1.3, heavyShake: 1.25, lightShake: 1.0, spark: 1.3, glow: 0.65, glowR: 30, flashHeavy: 1.6, numPop: 1.35 },
      // 플레이어가 맞음(2026-11-06 밤, 형님 「맞는 것도 화려하게」): stop / shake / spark = 멈춤·흔들림·불똥 배율, redMs = 몸 빨갛게 번쩍,
      //   vig = 화면 가장자리 빨강 최대 세기(데미지가 최대 체력 x fullAt 이상이면 최대), vigMs = 사라지는 시간, bits = 튀는 조각 수
      hurt: { stop: 1.35, shake: 1.2, spark: 1.4, redMs: 220, vig: 0.85, fullAt: 0.12, vigMs: 650, bits: 10 },
      // 기술 화려하게(2026-11-06 밤): hitBits = 기술에 맞은 곳 기술 색 불티 수, cols = 기술 숫자 모양 → 불티 색,
      //   glow = 기술 효과가 나올 때 둘레 빛(더하기) 세기, flashMul = 기술 화면 번쩍 세기 배율. 화면 당기기 = 기술마다 zoom(config SKILLS)
      flashy: { hitBits: 7, glow: 0.55, flashMul: 1.3,
                cols: { skill_knight: ['#ffffff', '#cfe8ff', '#8fc4ff'], skill_fire: ['#fff4d0', '#ffb040', '#ff5a1e'], skill_bolt: ['#ffffff', '#fff6a0', '#5ae6ff'],
                        skill_ice: ['#ffffff', '#d8f8ff', '#7fe0ff'], skill_earth: ['#ffffff', '#ead8ff', '#b892ff'],
                        skill_holy: ['#ffffff', '#fff6c8', '#ffd23f'], skill_arcane: ['#ffffff', '#e8d0ff', '#8ff0ff'] } }
    },

    // ---------- 사냥 손맛 (2026-11-07, 형님 「우리 게임 = 사냥 중심, 몹 떼를 화려하게 쓸어버리는 맛, 던파처럼 화려한 연출」) ----------
    // 시험으로 1판에만 켬(stages = 켤 판 id 목록). 다른 판도 켜려면 stages 에 id 를 넣으면 끝(웨이브마다 horde: false 로 그 웨이브만 끔)
    // 아래 묶음마다 on: false 로 따로 끌 수 있음. 거리 값(도트)은 원래 그림 크기 기준(쓸 때 actorScale 곱함)
    hunt: {
      on: true,
      stages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],   // 눈맛 연출(숫자·KILL·펑·구슬·흔들림)은 전 판. 몹 수는 아래 horde.stageMul 로 판마다 서서히
      // 몹 떼: 잡몹(성장 경험치 종류 'mob' = 고블린·늑대·박쥐 …, 보스·단단한 잡몹은 그대로)을 mul 배로. 대신 한 마리는 약하게(hpMul),
      //   경험치는 xpMul 배(마리 수 x 배율 = 판 전체 경험치는 그대로 → 레벨 오르는 빠르기 그대로)
      //   늘어난 몹은 반대쪽 끝에서 같이 나옴(양옆에서 떼로) + gapMs 씩 조금 늦게, 화면 밖으로 xOff 도트씩 더 떨어져서(한 덩어리로 겹치지 않게)
      //   미리 서 있는 무리(placed)도 mul 배: 옆으로 placedDx 도트, 위아래 placedDy(길 폭 비율) 비켜 서서 같은 무리로
      //   동시에 때리러 오는 잡몹 수(maxAttackers)·공격 시작 간격(attackGapMs)은 따로 정함(몹이 많아도 한꺼번에 몰매 맞지 않게)
      //   웨이브에 hordeMul: 3 처럼 적으면 그 웨이브만 배수를 바꿈
      //   (2026-11-06 형님: 1판부터 많을 필요 없고 판이 올라갈수록 서서히 많이) stageMul = 판 번호별 배수(소수 OK = 몇 마리 중 일부만 하나 더).
      //   한 마리 체력 = 원래 x 배수^-hpExp (2배 → 0.4), 경험치 = 원래 / 배수 → 판 전체 경험치 그대로. 배수 1 이면 원래 그대로
      horde: { on: true, mul: 2, stageMul: { 1: 1, 2: 1.15, 3: 1.3, 4: 1.4, 5: 1.5, 6: 1.6, 7: 1.7, 8: 1.8, 9: 1.9, 10: 2 }, hpExp: 1.32, hpMul: 0.4, dmgMul: 1.0, xpMul: 0.5, bothSides: true, gapMs: 180, xOff: 34, placedDx: 30, placedDy: 0.2,
               maxAttackers: 99, attackGapMs: 120 },   // 2026-11-06 형님: 동시 공격 제한 없음
      // 넓은 범위: 기술 판정·효과 크기 배율(기술 Lv 크기 area 에 곱함). 회전베기 · 대지 내려찍기 · 메테오 · 불기둥 · 칼날 폭풍
      aoe: { on: true, spin: 1.25, slam: 1.25, meteor: 1.25, pillar: 1.25, storm: 1.25 },   // storm = 칼날 폭풍(2026-11-06)
      // 여러 마리 한꺼번에: 한 장면(한 번의 공격)에 맞은 적이 from 마리 이상이면 화면 흔들림 1 + shake x (마리 - 1) 배(최대 shakeCap 배)
      //   + 멈춤 stopMs x (마리 - 1) 더함(최대 stopCap ms). 기술로 bloomAt 마리 이상 맞히면 맞은 무리 가운데 큰 빛(bloom) + 짧은 화면 번쩍
      multiHit: { on: true, from: 2, shake: 0.22, shakeCap: 2.4, stopMs: 7, stopCap: 45,
                  bloomAt: 3, bloomR: 90, bloomA: 0.55, bloomMs: 260, flash: { color: '#fff6e0', alpha: 0.22, ms: 110 } },
      // 데미지 숫자 「파파박」: spread = 새 숫자 좌우·위아래로 흩어짐(도트), size = 데미지가 ref[0] 이하면 min 배 ~ ref[1] 이상이면 max 배 크기,
      //   pop = 처음 튀어나오는 크기(보통 숫자), critPop = 치명타·마무리 숫자, critGlow = 치명타 숫자 뒤 주황 번쩍(더하기) 세기, max = 화면에 숫자 최대 수(넘으면 오래된 것부터 지움)
      dmgNum: { on: true, spread: 7, size: { min: 0.9, max: 1.3, ref: [8, 60] }, pop: 1.3, critPop: 1.7, critGlow: 0.7, critGlowR: 22, critGlowMs: 160, max: 36 },
      // 몇 마리 잡기(멀티킬): 마지막으로 잡은 뒤 windowMs 안에 또 잡으면 이어서 셈 → min 마리부터 화면 위 「3 KILL!」(모양 = damageText.multikill).
      //   slow = [마리, 느려지는 ms(진짜 시간)] 그 마리 수를 처음 넘을 때 짧은 슬로모션. showMs = 글자 보이는 시간
      multiKill: { on: true, windowMs: 650, min: 3, showMs: 900, slow: [[5, 170], [8, 230], [12, 260]], shake: 1.4 },
      // 쓰러짐: 잡몹이 붕 떠서 날아감(up = 뜨는 빠르기 도트/초, vx = 옆으로 deathKnock 배) → popMs 뒤 코드로 그린 작은 펑(파편 bits 개 + 고리)으로 사라짐
      death: { on: true, up: 420, vx: 1.15, popMs: 620, bits: 9, ringR: 26, cols: ['#ffffff', '#fff2c0', '#ffd27a', '#c8b8a8'] },
      // 경험치 구슬: 잡은 몹에서 n 개 튀어나와(spd) → delayMs 뒤 플레이어에게 빨려 들어감(pull = 끌어당기는 힘). 경험치는 잡는 순간 그대로 줌(보이기만).
      //   max = 화면에 구슬 최대 수. hideXpText = 몹마다 「+5 XP」 글자 숨김(구슬이 대신 보여 줌)
      orbs: { on: true, n: [3, 5], spd: 150, delayMs: 220, pull: 2400, max: 70, size: 2.2, hideXpText: true, cols: ['#fff6a0', '#ffd23f', '#9fffb0'] },
      // 콤보 수: 크게(big) + milestones 마다(50 · 100 · 150 …) 번쩍
      combo: { on: true, big: true, every: 50 },
      // 성능: 효과가 한꺼번에 너무 많아지지 않게(파편·둥근 빛 최대 수, skills.js)
      caps: { parts: 260, glows: 44 }
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
      // 얼음창(2026-11-06): 흰색 → 얼음 파랑
      skill_ice:    { font: 'giant', scale: 1, bold: true, top: '#ffffff', bottom: '#7fe0ff', outline: '#0e2a48', shadow: 'rgba(6,14,30,0.45)',
                      pop: { top: '#ffffff', bottom: '#d8f8ff' } },
      // 땅 융기(2026-11-06 밤): 흰색 → 보라(마법진 색)
      skill_earth:  { font: 'giant', scale: 1, bold: true, top: '#ffffff', bottom: '#c8a0ff', outline: '#2a1048', shadow: 'rgba(14,6,30,0.45)',
                      pop: { top: '#ffffff', bottom: '#ead8ff' } },
      // 2차 기술(2026-11-06): 성검 낙뢰 = 흰색 → 금색 / 순간이동 = 흰색 → 보라
      skill_holy:   { font: 'giant', scale: 1, bold: true, top: '#ffffff', bottom: '#ffd23f', outline: '#4a3004', shadow: 'rgba(30,20,4,0.45)',
                      pop: { top: '#ffffff', bottom: '#fff6c8' } },
      skill_arcane: { font: 'giant', scale: 1, bold: true, top: '#ffffff', bottom: '#c890ff', outline: '#24083e', shadow: 'rgba(16,6,30,0.45)',
                      pop: { top: '#ffffff', bottom: '#e8d0ff' } },
      // 늘 켜진 기술 알림 글자(2026-11-06): 「투지!」(붉은 주황) · 「반격!」(금색) · 마나 방패가 막은 마나 「MP -12」(파랑)
      grit:    { font: 'large', scale: 1, bold: true, top: '#ffe0c8', bottom: '#ff5a2a', outline: '#4a0e04', shadow: 'rgba(30,6,4,0.4)',
                 pop: { top: '#ffffff', bottom: '#ffb080' } },
      counter: { font: 'large', scale: 1, bold: true, top: '#fffbe0', bottom: '#ffc030', outline: '#4a2a04', shadow: 'rgba(30,20,4,0.4)',
                 pop: { top: '#ffffff', bottom: '#fff2a0' } },
      shield:  { font: 'large', scale: 1, top: '#e0f2ff', bottom: '#5ab0ff', outline: '#0a1e4a', shadow: 'rgba(6,10,30,0.4)',
                 pop: { top: '#ffffff', bottom: '#b8e4ff' } },
      // 마나가 모자라 기술이 안 나갈 때 머리 위 「MP 부족」(2026-11-06, 작은 파란 글자)
      nomp: { font: 'large', scale: 1, top: '#d8ecff', bottom: '#6aa8ff', outline: '#10204a', shadow: 'rgba(6,10,30,0.4)',
              pop: { top: '#ffffff', bottom: '#cfe4ff' } },
      // 달리며 공격의 밀고 가는 작은 타(2026-11-03): 보통 숫자보다 작고(large 8도트) 하늘색 → 마무리 숫자와 구분
      push: { font: 'large', scale: 1, top: '#e8fbff', bottom: '#8fd6ff', outline: '#163048', shadow: 'rgba(8,14,30,0.35)',
              pop: { top: '#ffffff', bottom: '#d8f4ff' } },
      // 음식 먹고 회복한 양(2026-11-04): 초록 숫자, 보통 숫자와 같은 크기
      heal: { font: 'mid', scale: 1, top: '#d6ffc4', bottom: '#4cd64a', outline: '#123a16', shadow: 'rgba(6,30,10,0.35)',
              pop: { top: '#ffffff', bottom: '#a8ff8a' } },
      // 각성 중 데미지(2026-11-06 밤): 기술 숫자(giant)보다 zoom 배 크게 + 직업 색(광전사 = 붉은 불꽃 / 마력 폭주 = 보라·하늘 / 견습 = 금색)
      awk_knight: { font: 'giant', scale: 1, bold: true, zoom: 1.3, top: '#fff0d8', bottom: '#ff3a1a', outline: '#3a0404', shadow: 'rgba(40,4,4,0.5)',
                    pop: { top: '#ffffff', bottom: '#ffb040' } },
      awk_mage:   { font: 'giant', scale: 1, bold: true, zoom: 1.3, top: '#f6eaff', bottom: '#b46aff', outline: '#20083a', shadow: 'rgba(20,6,40,0.5)',
                    pop: { top: '#ffffff', bottom: '#8ff0ff' } },
      awk_novice: { font: 'giant', scale: 1, bold: true, zoom: 1.3, top: '#fffbe0', bottom: '#ffc030', outline: '#4a2a04', shadow: 'rgba(30,20,4,0.5)',
                    pop: { top: '#ffffff', bottom: '#fff2a0' } },
      // 물약·포만감(2026-11-06 밤): 「+HP 52」(빨강) · 「+MP 30」(파랑) · 「포만감 +30%」(주황)
      pothp: { font: 'large', scale: 1, bold: true, top: '#ffe0dc', bottom: '#ff4a4a', outline: '#4a0a0e', shadow: 'rgba(30,6,6,0.4)',
               pop: { top: '#ffffff', bottom: '#ffb0a8' } },
      potmp: { font: 'large', scale: 1, bold: true, top: '#e0f2ff', bottom: '#3f9cff', outline: '#0a1e4a', shadow: 'rgba(6,10,30,0.4)',
               pop: { top: '#ffffff', bottom: '#b8e4ff' } },
      full:  { font: 'large', scale: 1, top: '#fff0d0', bottom: '#ffa84a', outline: '#4a2408', shadow: 'rgba(30,14,4,0.4)',
               pop: { top: '#ffffff', bottom: '#ffd8a0' } },
      // 성장(2026-11-05): 적을 잡았을 때 「+13 XP」(작은 노란 글자) · 레벨업 「LEVEL UP!」(큰 금색 글자). 글자는 fx.js 가 기본 굵은 글꼴로
      xp: { font: 'large', scale: 1, top: '#fff6c0', bottom: '#ffd23f', outline: '#4a3410', shadow: 'rgba(30,20,4,0.35)',
            pop: { top: '#ffffff', bottom: '#fff6c0' } },
      levelup: { font: 'huge', scale: 1, bold: true, top: '#fff6a0', bottom: '#ffb52e', outline: '#5a2a08', shadow: 'rgba(30,12,4,0.45)',
                 pop: { top: '#ffffff', bottom: '#ffe066' } },
      // 몇 마리 잡기 「5 KILL!」(2026-11-07 사냥 손맛, 화면 위 가운데, hunt.multiKill): 큰 금색 → 빨강
      multikill: { font: 'giant', scale: 1, bold: true, zoom: 1.3, top: '#fffbe0', bottom: '#ff7a1a', outline: '#4a0e04', shadow: 'rgba(30,6,4,0.5)',
                   pop: { top: '#ffffff', bottom: '#ffe066' } },
      // 치명타(2026-11-06, 민첩 AGI 로 확률이 오름, 데미지 x growth.stats.critMul): 기술 숫자만큼 큰 giant + 주황·빨강 → 마무리 「22!」(노랑)와 구분
      agicrit: { font: 'giant', scale: 1, bold: true, top: '#fff27a', bottom: '#ff5a1a', outline: '#5a0a08', shadow: 'rgba(40,6,4,0.5)',
                 pop: { top: '#ffffff', bottom: '#ffd040' } },
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

    // ---------- 성장: 레벨·경험치 (2026-11-05, 기획\성장시스템-설계안.md 1·2단계. 계산·저장은 growth.js) ----------
    // 다음 레벨까지 필요한 경험치 = needBase + needPerLv × 지금 레벨 (Lv1→2 = 50, Lv29→30 = 1170, Lv59→60 = 2370). 최고 maxLv
    //   2026-11-06 최고 레벨 30 → 60: 레벨마다 몫(체력·공격·능력치 점수 3·기술 점수 1)은 그대로 60까지 이어짐. 판 균형은 안 바꿈
    // 레벨당 최대 체력 +hpPerLv (hero.hp 150 기준), 공격력 +atkPerLv (플레이어의 모든 타·기술 데미지에 곱함: Lv10 = 1.09배, 2026-11-06 전엔 1.18배) + 능력치(아래 stats)
    //   레벨업 하면 늘어난 체력만큼 바로 회복. 죽어도 경험치는 안 잃음. 깬 판을 다시 해도 경험치를 그대로 줌
    // 적 경험치 = 종류 기본값(xp) × 판 배율(1 + stageMul × 목록 순서(0부터)) → 1판 1.0배 … 10판 2.62배. 반올림
    //   stageMul: 설계안은 0.3(10판 3.7배)이었는데, 실제 판의 적 수(판마다 33~47마리, 단단한 잡몹 많음)로 자동 조종 시험을 해 보니
    //   0.3 = 판 도착 Lv 1,5,7,10,12,15,17,19,21,23 · 마왕 뒤 26 (목표보다 2~3 높음) → 0.18 = 1,5,7,10,12,13,15,17,19,21 · 마왕 뒤 23 (목표와 거의 같음)
    //   종류 정하는 법(적 config 기본 체력 hp 기준, 판·변종 배율 곱하기 전):
    //     finalBoss = king(마왕) · boss = boss(판 보스) · 보스 아님 + hp ≥ eliteHp = elite(용암 골렘, 설계안 「중간 대장」)
    //     · hp ≥ toughHp = tough(해골·미라·도마뱀·설인·유령 기사·마족 병사) · 나머지 = mob(고블린·늑대·박쥐·총잡이·불 도깨비)
    //     kind = 위 규칙 대신 직접 정함(흑마법사는 체력 60이지만 설계안대로 「단단한 잡몹」)
    //   보스가 부른 졸개 · 보스가 쓰러질 때 같이 쓰러진 졸개도 똑같이 줌
    // 시험: 주소 뒤 ?lv=N = 이번 창에서만 LvN(경험치 0)으로 시작. 그동안 얻은 경험치는 저장 안 함(저장된 레벨은 그대로)
    growth: {
      maxLv: 60,
      needBase: 10, needPerLv: 40,
      // 레벨마다 저절로 오르는 몫(2026-11-06 반으로 줄임: 예전 +5 / +2%). 나머지는 능력치 점수(아래 stats)로 고름
      hpPerLv: 2.5,
      atkPerLv: 0.01,
      stageMul: 0.18,
      xp: { mob: 10, tough: 15, elite: 40, mid: 40, boss: 150, king: 300 },   // mid = 중간보스(2026-11-06, config midBoss)
      toughHp: 75, eliteHp: 200,
      kind: { mage: 'tough' },
      // ---------- 능력치 점수 (2026-11-06, 기획\성장시스템-설계안.md 「변경 (2026-11-06)」, 계산 = growth.js, 창 = main.js) ----------
      // 레벨업마다 perLv 점. 능력치 창에서 + 로 올림 · 「자동 배분」(남은 점수만) · 「초기화」(공짜, 언제든 → 올린 점수 전부 돌려받음)
      //   str 힘   = 물리 공격(견습 맨손·기사 검 타와 기사 기술) 1점당 +str (0.008 = +0.8%)
      //   int 지능 = 마법 공격(법사 지팡이·완드 타·마법탄·터짐·화염구·번개 = weapons 의 magic) 1점당 +int
      //     → 공격 배율 = 1 + atkPerLv × (Lv-1) + (힘 또는 지능) × 0.008 (모두 더하기)
      //   vit 체력 = 최대 체력 1점당 +vit
      //   agi 민첩 = 1점당 콤보 휘두르는 빠르기 +atkSpd · 걷기·달리기·점프 이동 빠르기 +move · 치명타 확률 +crit
      //     빠르기는 spdCap(+25%)까지만(그림이 너무 빨라 어색하지 않게), 치명타는 critCap 까지.
      //     치명타 = 데미지 x critMul + 큰 주황 숫자(damageText.agicrit). 적·허수아비를 때릴 때만(소품 빼고)
      //   wis 지혜 = 1점당 최대 마나 +wis.mp · 마나 회복 초당 +wis.regen (마나는 아래 mp)
      // auto = 「자동 배분」 비율(직업마다). 한 점씩 「비율보다 가장 모자란 능력치」에 넣음 → 레벨마다 고르게 섞여 오름
      //   기사 = 힘·체력 + 민첩 조금 / 법사 = 지능·지혜 + 체력 조금 / 견습 = 힘·체력·민첩
      // 값 고른 기준: 자동 배분한 Lv10·20·30 이 예전(+5 체력 · +2% 공격)보다 「조금 더」 세게 (표 = 설계안 변경 절)
      stats: {
        perLv: 3,
        str: 0.008, int: 0.008, vit: 4,
        agi: { atkSpd: 0.005, move: 0.004, crit: 0.003, spdCap: 0.25, critCap: 0.3 },
        wis: { mp: 5, regen: 0.1 },
        critMul: 1.5,
        auto: {
          novice: { str: 4, vit: 3, agi: 3 },
          knight: { str: 5, vit: 3, agi: 2 },
          mage:   { int: 5, wis: 3, vit: 2 }
        }
      },
      // 직업마다 기본 몫: hp = 최대 체력에 더함(기사가 더 튼튼), mp = 기본 마나(법사가 더 많음)
      //   2026-11-06 법사 균형: 법사 hp 0 → 35 (멀리 서도 보스 공격 폭이 넓어 자주 맞음. 3판 보스 두꺼비 앞에서 너무 쉽게 쓰러짐. 기사는 체력 능력치를 더 찍어서 Lv 가 오르면 기사가 더 튼튼)
      classBase: { novice: { hp: 0, mp: 40 }, knight: { hp: 15, mp: 40 }, mage: { hp: 35, mp: 80 } },
      // 마나(MP, 2026-11-06): 체력 막대 밑 파란 막대. 지금은 쓰는 곳 없음(기술이 마나 + 쿨타임을 쓰는 건 다음 단계)
      //   최대 = classBase.mp + perLv × (Lv-1) + 지혜 × stats.wis.mp. 초당 regen + 지혜 × stats.wis.regen 씩 참,
      //   적·허수아비를 맞힐 때마다 onHit 만큼 더(소품은 안 셈). 새 판·다시 하기 = 가득, 레벨업 = 늘어난 만큼 참
      mp: { perLv: 2, regen: 1, onHit: 1 },
      // 전직(2026-11-06, 설계안 3번): 이 id 의 판 보스를 처음 깨면 전직 화면(main.js) → 기사/법사 중 하나, 한 번 고르면 이 저장칸에선 못 바꿈.
      //   이미 이 판을 깬 저장인데 직업이 없으면 다음 스테이지 고르기·시작 때 뜸. 고른 직업 = 저장칸(growth.js)의 class
      //   위쪽 견습/기사/법사 버튼은 시험 도구: stagesAllOpen 이 true 일 때만 보이고, 눌러도 저장된 직업은 안 바뀜(이번 창에서만 덮어씀)
      classChangeStage: 2,
      // 레벨업 연출: 머리 위 「LEVEL UP!」 글자(damageText.levelup) + 짧은 화면 번쩍(flash) + 반짝 불똥(sparkCol)
      levelUp: { flash: { color: '#fff3b0', alpha: 0.28, ms: 260 }, sparkCol: '#ffe066' }
    },

    // ---------- 적끼리 공통 ----------
    ai: {
      maxAttackers: 99,     // 동시에 공격 동작 중인 잡몹 최대 수 (보스는 제외). 2026-11-06 형님: 제한 없이 다구리 OK(광역기로 쓸어버림) — 예전 2
      attackGapMs: 120,     // 잡몹 공격 시작 사이 최소 간격(같은 순간 한꺼번에만 막음, 예전 450)
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
      // 누운 적 때리기(OTG, 2026-11-05): 넘어져 누운 적은 짧고 빠른 타(잽·콤보 1·2타)에는 안 맞고(숨 돌릴 틈),
      //   크게 휘두르는 타·땅까지 닿는 기술(판정 값에 hitsDown: true)에만 맞는다 → 데미지·숫자·작은 불똥·콤보 수. 다시 날아가거나 일어나지 않음.
      //   hitsDown 붙은 공격: 콤보 마무리 3타 전부(견습 돌려차기·뒤꿈치 내려찍기 / 기사 내려찍기·X자 2번째 / 법사 마법탄 터짐·두 손 폭발)
      //                      · 법사 남 2타 머리 위 내려치기 · 공중 공격 · 슬라이딩 마무리 · 돌진베기 · 회전베기 · 화염구 터짐 · 번개 3줄기
      //   안 붙임: 콤보 1·2타(위 내려치기 빼고) · X자 1번째·무릎 같은 가벼운 첫 판정 · 달리며 공격 작은 타·어깨 돌진(몸 높이 밀치기)
      //   (날아가는 마법탄·화염구 자체는 누운 적 위로 지나감 → 서 있는 적이나 끝에서 터질 때 그 터짐에 맞음)
      //   맞는 때 = 쓰러지며 밀려나는 그림이 끝나 바닥에 닿은 뒤 ~ 일어나는 그림 전(일어나는 동안은 안 맞음)
      //   extendMs = 한 번 맞을 때마다 누워 있는 시간 더함, maxExtendK = 더한 시간 합 최대(넘어짐 전체 시간 x 0.4 = 최대 +40%)
      //   maxHits = 한 번 넘어질 때 누운 채로 맞는 최대 횟수(넘으면 안 맞음 = 무한 콤보 방지), dmgMul = 누운 적 데미지 배율
      //   보스는 넘어지지 않고 휘청(무릎 꿇음)이라 원래 늘 맞음 → 해당 없음. 순간이동·각성·땅속 무적은 그대로
      otg: { extendMs: 120, maxExtendK: 0.4, maxHits: 8, dmgMul: 1.0 },
      // 보스 분노 연출(2026-11-06 밤, enrageAt 아래로 처음 떨어질 때. 10단계 마왕은 자기 각성 그대로): 화난 순간 hitstopMs 멈춤 + slowMs 느려짐 +
      //   flash(불꽃색 화면 번쩍 세기) + shake(흔들림 배율) + push(플레이어를 밀어내는 도트, 원래 크기) + 발밑 불꽃 고리 burstMs.
      //   화난 동안 = 몸 둘레 일렁이는 불꽃 테두리(fadeInMs 동안 차오름) + 몸이 조금 붉게(tint). 색 = 보스 rageColor(없으면 color)
      rage: { hitstopMs: 140, slowMs: 380, flash: 0.4, shake: 3, push: 60, burstMs: 650, fadeInMs: 400, tint: 0.16, color: '#ff6a1a' },
      // 띄우기·공중 콤보(2026-11-06 밤, 형님 「콤보 시스템」): 띄우기 기술(판정 값 launch: 올려베기·땅 융기)에 맞은 잡몹은 공중으로 뜸.
      //   떠 있는 동안 평타·기술·공중 공격 전부 맞고, 맞을 때마다 refloatH 만큼 살짝 다시 뜸(작은 멈춤은 onHit 그대로) → 땅에 닿으면 넘어짐 → 누운 적 때리기(otg)
      //   던파처럼 오래 뜰수록 빨리 떨어짐: 중력 = g x (1 + gravHit x 공중에서 맞은 수 + gravSec x 뜬 초).
      //   다시 뜨는 높이는 refloatCut 번째 맞을 때 0 이 되고(그 뒤로는 맞아도 안 뜸), maxAirMs 넘게 떠 있으면 0 + 중력 capGravMul 배 → 무한 띄우기 없음
      //   거리 값(launchH·relaunchH·refloatH = 올라가는 높이, g = 1초²에 도트)은 원래 그림 크기 기준(쓸 때 actorScale 곱함)
      //   launchH = 띄우기 높이(launch 1 기준) · relaunchH = 공중에서 다시 띄우기 기술에 맞을 때 · knockMul = 공중에서 맞을 때 옆으로 밀리는 배율
      //   안 뜨는 적: 보스 · noLaunch: true · 원래 체력 heavyHp 이상(설인 140 · 용암 골렘 240 = 큰 적) → 띄우기에 맞으면 launchStunMs 휘청(보스는 보통 맞음)
      //   landShake = 땅에 떨어질 때 화면 흔들림
      air: { launchH: 85, relaunchH: 50, refloatH: 28, g: 950, gravHit: 0.10, gravSec: 0.45, refloatCut: 10, maxAirMs: 2600, capGravMul: 2.5,
             knockMul: 0.3, heavyHp: 130, launchStunMs: 420, landShake: 0.5 },
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
        walkStride: 34,   // 보폭 걷기(enemies.js stepWalk): 걷기 6장 한 바퀴에 가는 그림 점. 걷기 그림 속 발이 거의 제자리(새 그림 필요) → 8fps 쯤으로 차분하게
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
        walkStride: 32,   // 보폭 걷기(enemies.js stepWalk): 걷기 6장 한 바퀴에 가는 그림 점. 7.5fps 쯤
        // 체력·데미지: 자동 조종(?bot=1, 피하지 않음) 시험에서 오크(1단계)보다 한 단계 버겁게 맞춤(2026-11-04)
        hp: 1050, speedX: 30, speedY: 24, radius: 42, height: 150,
        hurtbox: { x0: -34, x1: 55, yTop: -150, yBot: 0 },
        engage: 70, hover: [70, 90], range: [40, 160], alignY: 10, cooldown: [1100, 1900], firstCooldown: [1200, 1500],
        knockResist: 0.2, deathKnock: 50,
        staggerCdMs: 2200,
        superArmor: true,
        stagger: { at: [0.66, 0.33], onWall: false, d: [280, 140, 900, 300], core: { x: 8, y: -70, r: 12, color: '#ff8a2a' } },
        enrageAt: 0.5,
        rageColor: '#ffb040',   // 분노 불꽃 색(2026-11-06 밤, config ai.rage)
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
        walkStride: 38, walkDy: [0, 4, 1, 1, 4, 2],   // 보폭 걷기(enemies.js stepWalk): 걷기 6장 한 바퀴에 가는 그림 점. 종종걸음 9.4fps 쯤(예전 16fps 는 너무 바빴음), walkDy = 다리가 다 뜬 장(2·5장 4점)을 바닥에
        hp: 1100, speedX: 44, speedY: 30, radius: 56, height: 120,
        hurtbox: { x0: -72, x1: 108, yTop: -120, yBot: 0 },
        engage: 80, hover: [80, 100], range: [40, 170], alignY: 10, cooldown: [1000, 1800], firstCooldown: [1200, 1500],
        knockResist: 0.2, deathKnock: 50,
        staggerCdMs: 2200,
        superArmor: true,
        stagger: { at: [0.66, 0.33], onWall: false, d: [260, 160, 1000, 320], hurtbox: { x0: -112, x1: 113, yTop: -114, yBot: 0 } },
        enrageAt: 0.5,
        rageColor: '#ffcc40',   // 분노 불꽃 색(2026-11-06 밤, config ai.rage)
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
      },

      // ===== 3단계 적 (art\stage3-enemies 에서 복사, 2026-11-04). 수치 = 그 폴더 anchors_*.json 의 suggest =====
      // 도마뱀 전사: 고블린처럼 싸우는데 창이라 더 멀리서 찌름. 그림이 고블린보다 크다(208x148, 창끝이 앞 116 까지)
      //   공격이 둘: thrust = 창 찌르기(2장 창을 뒤로 당김 = 예고, 바닥 빨간 띠) / lunge = 달려들며 찌르기(웅크렸다가 2~3장에 40 앞으로 뛰어듦)
      //   잡몹도 공격이 여럿이면 when(이 거리 안일 때) 맞는 것 중 weight(무게)로 고름. 가까우면 찌르기, 조금 멀면 둘 다
      //   gapMs = 한 번 쓰면 이 시간 동안 그 공격은 안 씀(달려들기는 가끔만: 자동 조종 시험에서 다가올 때마다 달려들어 너무 아팠음)
      //   그림이 1·2단계 적보다 밝은 초록(팔레트 그대로, 나중에 그림 쪽에서 낮출 수 있음)
      lizard: {
        label: '도마뱀 전사', frameW: 208, frameH: 148, pivot: { x: 124, y: 142 },
        anims: enemyAnims('lizard', {
          idle: [4, 6, true], walk: [8, 10, true],
          attack: [5, 10, false, [1, 2, 2, 2, 3, 4, 4, 5]],    // 창 찌르기: 1 당김 · 2 창을 멀리 뒤로(예고 300ms) · 3 쭉 찌름(맞음) · 4 끝까지 · 5 복귀
          attack2: [4, 12, false, [1, 1, 2, 3, 3, 4]],          // 달려들기: 1 웅크림(짧은 예고) · 2 뛰어들며 찌름(맞음) · 3 착지 · 4 복귀
          hit: [3, 10, false, [1, 2, 2, 3]],
          hit2: [3, 10, false, [1, 1, 2, 2, 3]],
          knockdown: [5, 10, false, [1, 2, 2, 3, 4, 5, 4, 5]],
          getup: [3, 8, false, [1, 1, 2, 2, 3]],                // 앉음 → 창 짚고 한 무릎 → 섬
          death: [5, 8, false, [1, 2, 3, 4, 5]]
        }),
        walkAnim: 'walk',
        down: { slide: 80, lyingFrames: [3, 4, 5] },
        hp: 75, speedX: 48, speedY: 30, radius: 15, height: 96,
        hurtbox: { x0: -14, x1: 26, yTop: -94, yBot: 0 },
        engage: 80, hover: [110, 160], range: [30, 140], alignY: 7, cooldown: [1300, 2300], firstCooldown: [600, 1600],
        knockResist: 1.0, deathKnock: 210,
        attacks: {
          thrust: { anim: 'attack', active: [3, 4], reach: { x0: 20, x1: 118, yTop: -80, yBot: -46 }, reachF: { 4: { x0: 20, x1: 107, yTop: -68, yBot: -40 } }, depth: 12,
                    dmg: [6, 9], knock: 16, telegraph: [2], showTelegraph: true, when: [30, 112], weight: 3 },
          lunge:  { anim: 'attack2', active: [2, 3], reach: { x0: 20, x1: 102, yTop: -66, yBot: -30 }, depth: 12, move: { frames: [2, 3], dist: 40 },
                    dmg: [4, 6], knock: 14, telegraph: [1], when: [70, 140], weight: 1, gapMs: 6000 }
        }
      },
      // 거대 두꺼비(3단계 보스): 오크·골렘·전갈과 같은 보스 규칙(공격 중 안 끊김, 체력 66%·33% 휘청, 절반에서 화남 + 졸개 부름)
      //   휘청 3장 = 배를 깔고 납작 엎드려 혀를 늘어뜨림 = 때릴 기회(1000ms). 그때 몸이 낮고 길어서 stagger.hurtbox
      //   공격: slam = 배치기(type 'leap'): 1장 납작 웅크리고 울음(예고) 동안 플레이어 자리를 겨눔(바닥 빨간 원)
      //           → 2~3장 공중으로 뛰어 그 자리로 날아감(공중 = 안 맞음, 몸끼리 안 밀림) → 4장 배로 쿵(판정·크게 흔들림·흙탕물, 넘어짐)
      //           leap = { frames = 공중 그림, max = 최대로 뛰는 거리, aimAt = 떨어질 때 플레이어가 서 있게 할 앞 거리(빨간 원 가운데) }
      //         tongue = 혀 채찍: 1장 몸을 젖힘(예고, 바닥 빨간 띠) → 3장 혀가 앞 198 까지 쭉(가늘고 긴 판정)
      //         spit = 독침 뱉기(골렘 바위 던지기와 같은 type 'throw'): 볼이 부풀고(예고) 3장에 입에서 독 덩어리를 플레이어 자리로 포물선
      //           → 떨어진 자리에 독 웅덩이(puddle) { ms = 남는 시간, radius·depth = 웅덩이 크기, everyMs·dmg = 서 있으면 몇 ms 마다 얼마(독으로는 체력 1 아래로 안 내려감),
      //             firstMs = 들어가서 처음 깎기까지, stayMs = 나와도 독이 남는 시간 }. proj / burstArt = 날아가는 그림 / 터지는 그림(fxArt 이름), burstCols = 튀는 방울 색
      toad: {
        label: '거대 두꺼비', boss: true, frameW: 400, frameH: 256, pivot: { x: 248, y: 250 },
        anims: enemyAnims('toad', {
          idle: [4, 5, true], walk: [6, 9, true],                    // 걷기 = 무겁게 깡충
          attack1: [5, 8, false, [1, 1, 1, 1, 2, 3, 3, 4, 4, 4, 5]],  // 배치기: 1 웅크림(예고 500ms) · 2 도약 · 3 공중 · 4 배로 쿵(맞음) · 5 복귀
          attack2: [5, 10, false, [1, 1, 1, 1, 2, 3, 3, 3, 4, 5]],    // 혀 채찍: 1 젖힘(예고) · 2 입 벌림 · 3 혀 쭉(맞음) · 4 감아 들임 · 5 복귀
          special: [5, 8, false, [1, 1, 2, 2, 2, 3, 4, 4, 5]],        // 독 뱉기: 1 볼 부풂 · 2 목 가득 부풂(예고) · 3 뱉음 · 4 입가 방울 · 5 복귀
          hit: [3, 8, false, [1, 2, 2, 3]],
          hit2: [3, 8, false, [1, 1, 2, 2, 3]],
          stagger: [4, 7, false, null],                                // 휘청: 장마다 시간은 아래 stagger.d (3장 = 납작 엎드림)
          death: [5, 6, false, [1, 1, 2, 2, 3, 4, 5]]                  // 마지막 울음 → 뒤로 넘어감 → 배를 뒤집고 뻗음
        }),
        fxArt: {
          poison: { frames: seq(EN + 'poison/poison_', 4), pivot: { x: 44, y: 24 }, fps: 12 },   // 날아가는 독 덩어리(덩어리 가운데 기준, 방울 꼬리가 오른쪽)
          puddle: { frames: seq(EN + 'puddle/puddle_', 6), pivot: { x: 48, y: 52 }, fps: 8 }     // 독 웅덩이(바닥 가운데): 1~2 철퍽 한 번 → 3~6 부글부글 반복
        },
        walkAnim: 'walk',
        // 체력·데미지: 자동 조종(?bot=1, 피하지 않음) 시험에서 골렘(2단계)과 전갈 왕(4단계) 사이로 맞춤(2026-11-04)
        hp: 1300, speedX: 34, speedY: 26, radius: 56, height: 125,
        hurtbox: { x0: -66, x1: 78, yTop: -120, yBot: 0 },
        engage: 80, hover: [80, 100], range: [40, 200], alignY: 10, cooldown: [1000, 1800], firstCooldown: [1200, 1500],
        knockResist: 0.2, deathKnock: 50,
        staggerCdMs: 2200,
        superArmor: true,
        stagger: { at: [0.66, 0.33], onWall: false, d: [280, 160, 1000, 300], hurtbox: { x0: -56, x1: 128, yTop: -84, yBot: 0 } },
        enrageAt: 0.5,
        rageColor: '#a8ff4a',   // 분노 불꽃 색(2026-11-06 밤, config ai.rage)
        enrage: { speedMul: 1.25, cooldownMul: 0.7, summon: ['lizard', 'bat', 'lizard'] },
        attacks: {
          slam:   { type: 'leap', anim: 'attack1', active: [4], reach: { x0: -60, x1: 160, yTop: -80, yBot: 0 }, depth: 18, telegraph: [1],
                    leap: { frames: [2, 3], max: 200, aimAt: 50 },
                    dmg: [17, 21], knock: 36, flinchMs: 450, shake: 3, when: [40, 260], weight: 2, heavy: true },
          tongue: { anim: 'attack2', active: [3], reach: { x0: 60, x1: 198, yTop: -94, yBot: -62 }, depth: 10, telegraph: [1],
                    dmg: [13, 16], knock: 26, flinchMs: 400, shake: 1.2, when: [70, 200], weight: 3 },
          spit:   { type: 'throw', anim: 'special', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 72, y: -112 },
                    flightMs: 700, arcPeak: 70, maxRange: 320, radius: 36, depth: 10, dodgeZ: 24,
                    proj: 'poison', burstArt: null, burstCols: ['#c8e83a', '#8ab82a', '#e8ff8a', '#5a7a2a'],
                    puddle: { ms: 4500, radius: 36, depth: 10, everyMs: 500, firstMs: 250, stayMs: 700, dmg: 2 },
                    dmg: [7, 9], knock: 12, flinchMs: 300, shake: 1.2, when: [110, 420], weight: 2 }
        }
      },

      // ===== 6단계 적 (art\stage6-enemies 에서 복사, 2026-11-04). 수치 = 그 폴더 anchors_*.json 의 suggest =====
      // 총알·연기·대포알·그림자·폭발 그림(fxArt)은 총잡이·선장이 같이 씀(같은 파일이라 한 번만 받음)
      // 해적 총잡이: 처음 나오는 「멀리서 쏘는」 잡몹. 고블린 크기(그림 칸·기준점 같음)
      //   ranged = 거리 두기 { keep = 플레이어와 이 거리(가로) 사이에 서 있으려 함(가까우면 뒤로 물러나며 플레이어를 봄, 멀면 다가옴),
      //     tooClose = 이보다 가까우면 개머리판으로 침(bash), backOffMul = 뒤로 물러날 때 걷기 속도 배율,
      //     maxShooters = 동시에 겨누고 있는 총잡이 최대 수(한꺼번에 여기저기서 쏘지 않게), alignMs = 공격 차례가 이만큼 남으면 플레이어 줄로 맞춤(그전엔 흩어져 서 있음) }
      //   shot = 머스킷 쏘기(type 'shot'): 1장 어깨에 댐 → 2장 겨눔(500ms, 예고 = 총구에서 앞으로 가는 빨간 겨눔 선 + 바닥 줄 표시)
      //     → 3장 탕(spawn = 총구 자리에서 총알이 나감 + 연기). 총알은 쏜 사람 줄(발 y)을 따라 똑바로 speed 로 range 까지 날아감
      //     맞는 조건 = 가로로 몸에 닿음 + 줄(위아래)이 depth 안 + 점프 높이가 dodgeZ 아래. 줄을 바꾸거나 뛰면 피함. 맞거나 끝까지 가면 사라짐
      //     aimH = 총알이 날아가는 높이(땅에서, 원래 크기). 총구가 이보다 높으면(선장 권총) 처음 dropPx 동안 이 높이로 내려옴(그림만, 판정은 높이 무관)
      //   bash = 개머리판 치기: 플레이어가 tooClose 안으로 붙었을 때만
      gunner: {
        label: '해적 총잡이', frameW: 176, frameH: 136, pivot: { x: 92, y: 130 },
        anims: enemyAnims('gunner', {
          idle: [4, 6, true], walk: [8, 10, true],
          attack: [5, 10, false, [1, 2, 2, 2, 2, 2, 3, 4, 4, 5]],   // 1 어깨에 댐 · 2 겨눔(예고 500ms) · 3 탕 · 4 반동 · 5 내림
          melee2: [4, 10, false, [1, 1, 1, 2, 3, 3, 4]],             // 개머리판: 1 뒤로 치켜듦(예고) · 2 앞으로 찍음(맞음) · 3 · 4 복귀
          hit: [3, 10, false, [1, 2, 2, 3]],
          hit2: [3, 10, false, [1, 1, 2, 2, 3]],
          knockdown: [5, 10, false, [1, 2, 2, 3, 4, 5, 4, 5]],
          getup: [3, 8, false, [1, 1, 2, 2, 3]],
          death: [5, 8, false, [1, 2, 3, 4, 5]]
        }),
        fxArt: {
          bullet: { frames: seq(EN + 'bullet/bullet_', 3), pivot: { x: 17, y: 13 }, fps: 16 },   // 총알(납 알 가운데 기준, 꼬리가 오른쪽 = 왼쪽으로 날아감)
          smoke:  { frames: seq(EN + 'smoke/smoke_', 4),   pivot: { x: 36, y: 40 }, fps: 12 }    // 총구 연기(한 번)
        },
        walkAnim: 'walk',
        down: { slide: 70, lyingFrames: [3, 4, 5] },
        hp: 60, speedX: 46, speedY: 30, radius: 15, height: 88,
        hurtbox: { x0: -20, x1: 22, yTop: -88, yBot: 0 },
        engage: 50, hover: [150, 240], range: [0, 340], alignY: 8, cooldown: [2400, 3400], firstCooldown: [1200, 2200],
        knockResist: 1.0, deathKnock: 210,
        ranged: { keep: [150, 240], tooClose: 70, backOffMul: 0.8, maxShooters: 2, alignMs: 700 },
        attacks: {
          shot: { type: 'shot', anim: 'attack', telegraph: [2], spawnFrame: 3, spawn: { x: 66, y: -68 }, aimH: 68, dropPx: 0,
                  speed: 360, range: 340, box: { w: 12, h: 8 }, depth: 10, dodgeZ: 20,
                  dmg: [5, 7], knock: 12, when: [120, 340] },
          bash: { anim: 'melee2', active: [2], telegraph: [1], reach: { x0: 28, x1: 74, yTop: -80, yBot: -58 }, depth: 12,
                  dmg: [6, 9], knock: 20, when: [0, 70] }
        }
      },
      // 해적 선장(6단계 보스): 오크·골렘·전갈·두꺼비와 같은 보스 규칙(공격 중 안 끊김, 체력 66%·33% 휘청, 절반에서 화남 + 졸개 부름)
      //   휘청 3장 = 칼 짚고 무릎 꿇음, 모자 삐뚤, 머리 위 별 = 때릴 기회(1000ms)
      //   drawScale = 그림만 이만큼 크게(오크·골렘 옆에서 너무 호리호리해 보여서, art README). 아래 판정·거리 수치는 그림 기준 그대로 적고 scaleActors 가 같이 곱함
      //   공격: combo = 칼 두 번 베기(1장 높이 치켜듦 = 예고 → 2장 대각선 베기 reachF[2] → 3장 가로 베기 reachF[3], multiHit = 장마다 한 번씩 맞을 수 있음)
      //         pistol = 권총(총잡이와 같은 type 'shot'): 2장 겨눔(예고, 빨간 겨눔 선) → 3장 탕. 총구가 주인공 머리보다 높아서 총알 그림은 dropPx 동안 aimH 로 내려옴
      //         barrage = 대포 일제 사격(type 'barrage'): 1~3장 호령(예고) → 4장 칼로 가리킴 = 대포알 count 개를 intervalMs 마다 떨어뜨림(그동안 5장 자세)
      //           대포알 하나 = 떨어질 자리에 그림자(점점 커짐) + 빨간 원 → fallMs 뒤 쾅(blast 그림, radius·depth 안이면 맞음, 넘어짐, 높이 dodgeZ 넘게 뛰면 피함)
      //           자리 = 첫 알은 플레이어 발밑 그대로, 다음부터 그때 플레이어 자리에서 spread(가로·위아래)만큼 흩어서. dropHeight = 처음 높이,
      //           holdMs = 마지막 알을 떨어뜨린 뒤 가리키는 자세로 더 서 있는 시간, gapMs = 한 번 쓰면 이 시간 동안 안 씀, firstMs = 나타나서 처음 쓰기까지
      captain: {
        label: '해적 선장', boss: true, frameW: 320, frameH: 232, pivot: { x: 168, y: 226 },
        drawScale: 1.1,
        anims: enemyAnims('captain', {
          idle: [4, 5, true], walk: [6, 8, true],
          attack1: [5, 10, false, [1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5]],   // 칼 두 번: 1 치켜듦(예고 400ms) · 2 대각선 베기 · 3 가로 베기 · 4 · 5 복귀
          attack2: [5, 9, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]],          // 권총: 1 뽑음 · 2 겨눔(예고 450ms) · 3 탕 · 4 반동 · 5 내림
          special: [5, 8, false, [1, 1, 1, 2, 3, 3, 3, 4, 5, 5, 5, 5]], // 대포 사격: 1 호령 · 2~3 칼 치켜듦(예고) · 4 가리킴 = 쏴라 · 5 그대로
          hit: [3, 8, false, [1, 2, 2, 3]],
          hit2: [3, 8, false, [1, 1, 2, 2, 3]],
          stagger: [4, 7, false, null],                                  // 휘청: 장마다 시간은 아래 stagger.d (3장 = 무릎 꿇고 별)
          death: [5, 6, false, [1, 1, 2, 2, 3, 4, 5]]                    // 모자 날아감 → 무릎 → 뒤로 넘어짐 → 누움
        }),
        fxArt: {
          bullet:     { frames: seq(EN + 'bullet/bullet_', 3),         pivot: { x: 17, y: 13 },  fps: 16 },
          smoke:      { frames: seq(EN + 'smoke/smoke_', 4),           pivot: { x: 36, y: 40 },  fps: 12 },
          cannonball: { frames: seq(EN + 'cannonball/cannonball_', 4), pivot: { x: 24, y: 64 },  fps: 12 },   // 떨어지는 대포알(알 가운데 기준, 위로 연기 꼬리)
          shadow:     { frames: seq(EN + 'shadow/shadow_', 4),         pivot: { x: 32, y: 10 },  fps: 0 },    // 대포알 그림자(떨어지는 정도로 장을 고름)
          blast:      { frames: seq(EN + 'blast/blast_', 6),           pivot: { x: 80, y: 124 }, fps: 12 }    // 쾅(바닥 가운데 기준)
        },
        walkAnim: 'walk',
        walkStride: 33,   // 보폭 걷기(enemies.js stepWalk): 걷기 6장 한 바퀴에 가는 그림 점. drawScale 1.1 까지 곱해져 8fps 쯤
        hp: 1100, speedX: 36, speedY: 26, radius: 36, height: 150,
        hurtbox: { x0: -42, x1: 40, yTop: -148, yBot: 0 },
        engage: 70, hover: [70, 90], range: [40, 160], alignY: 10, cooldown: [1000, 1800], firstCooldown: [1200, 1500],
        knockResist: 0.2, deathKnock: 50,
        staggerCdMs: 2200,
        superArmor: true,
        stagger: { at: [0.66, 0.33], onWall: false, d: [260, 160, 1000, 320] },
        enrageAt: 0.5,
        rageColor: '#ff7a2a',   // 분노 불꽃 색(2026-11-06 밤, config ai.rage)
        enrage: { speedMul: 1.25, cooldownMul: 0.7, summon: ['gunner', 'skeleton', 'gunner'] },
        attacks: {
          combo:   { anim: 'attack1', active: [2, 3], multiHit: true, telegraph: [1], depth: 16,
                     reach: { x0: 40, x1: 158, yTop: -140, yBot: -15 },
                     reachF: { 2: { x0: 40, x1: 100, yTop: -140, yBot: -15 }, 3: { x0: 50, x1: 158, yTop: -135, yBot: -60 } },
                     dmg: [14, 17], knock: 26, flinchMs: 400, shake: 1.6, when: [40, 160], weight: 3 },
          pistol:  { type: 'shot', anim: 'attack2', telegraph: [2], spawnFrame: 3, spawn: { x: 110, y: -120 }, aimH: 70, dropPx: 60,
                     speed: 420, range: 380, box: { w: 12, h: 8 }, depth: 12, dodgeZ: 20,
                     dmg: [12, 15], knock: 18, flinchMs: 350, shake: 1.2, when: [150, 360], weight: 2 },
          barrage: { type: 'barrage', anim: 'special', telegraph: [1, 2, 3], spawnFrame: 4, count: 5, intervalMs: 260, fallMs: 900, dropHeight: 260,
                     spread: { x: 50, y: 14 }, radius: 40, depth: 16, dodgeZ: 24, holdMs: 300, gapMs: 9000, firstMs: 4000,
                     dmg: [16, 20], knock: 30, flinchMs: 450, heavy: true, shake: 2.4, when: [60, 600], weight: 2 }
        }
      },

      // ===== 5단계 적 (art\stage5-enemies 에서 복사, 2026-11-04). 수치 = 그 폴더 anchors_*.json 의 suggest =====
      // 설인: 느리고 단단한 고블린(같은 생각 방식). 그림 칸이 고블린보다 큼(두 주먹을 머리 위로 166도트까지 치켜들고, 넘어질 때 120도트 날아감)
      //   smash = 두 주먹 내려찍기(무거움 = 맞으면 넘어짐): 1 몸을 젖힘 · 2 두 주먹을 머리 위로 깍지 끼고 포효(예고 약 450ms, 고블린보다 길게) ·
      //     3 내려침(맞음) · 4 땅에 쾅(맞음, reachF[4] = 땅까지 낮게) · 5 복귀. showTelegraph = 잡몹이어도 바닥 예고 띠
      //   걷기: 그림 속 디딘 발이 한 장에 약 7도트 뒤로 감(재어 봄, 성큼성큼 큰 걸음) → 34도트/초에 5fps(발이 안 미끄러짐). 속도를 바꾸면 walk fps 도 같은 비율로
      yeti: {
        label: '설인', frameW: 208, frameH: 176, pivot: { x: 104, y: 170 },
        anims: enemyAnims('yeti', {
          idle: [4, 5, true], walk: [8, 5, true],
          attack: [5, 9, false, [1, 2, 2, 2, 2, 3, 4, 4, 4, 5]],   // 1 젖힘 · 2 두 주먹 치켜듦(예고) · 3 내려침 · 4 땅에 쾅 · 5 복귀
          hit: [3, 10, false, [1, 2, 2, 3]],
          hit2: [3, 10, false, [1, 1, 2, 2, 3]],
          knockdown: [5, 10, false, [1, 2, 2, 3, 4, 5, 4, 5]],     // 맞음 → 날아감 → 쿵 → 등으로 누움(5 = 4 와 같은 그림)
          getup: [3, 8, false, [1, 1, 2, 2, 3]],                   // 주먹 짚고 앉음 → 한 무릎 → 섬
          death: [5, 8, false, [1, 2, 3, 4, 5]]                    // 포효 → 뒤로 넘어짐 → 누움 → 털 위에 서리
        }),
        walkAnim: 'walk',
        down: { slide: 50, lyingFrames: [3, 4, 5] },
        hp: 140, speedX: 34, speedY: 22, radius: 22, height: 104,
        hurtbox: { x0: -32, x1: 40, yTop: -102, yBot: 0 },
        engage: 46, hover: [100, 150], range: [24, 70], alignY: 8, cooldown: [1500, 2600], firstCooldown: [700, 1700],
        knockResist: 0.6, deathKnock: 140,
        attacks: {
          smash: { anim: 'attack', active: [3, 4], telegraph: [2], showTelegraph: true, heavy: true, depth: 14,
                   reach: { x0: 20, x1: 64, yTop: -104, yBot: -20 }, reachF: { 4: { x0: 20, x1: 72, yTop: -92, yBot: 0 } },
                   dmg: [10, 13], knock: 22, flinchMs: 420, shake: 1.4 }
        }
      },
      // 서리 거인(5단계 보스): 오크·골렘과 같은 보스 규칙(공격 중 안 끊김, 체력 66%·33% 휘청, 절반에서 화남 + 설인·얼음 늑대 부름)
      //   그림 칸 352x248(오크·골렘보다 앞으로 32, 위로 16 큼 = 얼음 몽둥이를 멀리 휘두름). 휘청 3장 = 한 무릎 꿇고 고개 숙여 헐떡임 = 때릴 기회(1000ms, 몸이 넓게 → stagger.hurtbox)
      //   공격: smash = 몽둥이 내려찍기(무거움): 2장 머리 위로 치켜듦(예고 500ms) → 4장 땅에 박힘 + 몽둥이 끝에 작은 얼음 가시(burst.fx = 효과 그림 이름, cols = 튀는 조각 색)
      //         sweep = 가로 휘두르기: 1장 뒤로 젖힘(예고) → 3장 쭉 뻗음(지금까지 적 중 가장 멀리 닿음, 188) → 4장 몸 앞(reachF[4])
      //         spikes = 얼음 가시 줄(type 'spikes'): 1·2장 손을 치켜듦(예고, 바닥에 가시 나올 자리 빨간 표시) → 3장 손바닥으로 땅을 침 → 가시 count 개가
      //           거인에서 플레이어 쪽으로 first + i x step 도트마다(maxRange 까지) delayMs 간격으로 차례로 솟음. 가시 하나 = icespike 그림 1~5장(14fps 한 번):
      //           1장 땅 갈라짐(예고) · spikeActive(2~4장) 동안 그 자리 상자(reach, 위아래 depth)에 닿으면 한 번 맞음 · 5장 부서짐
      //           겨누기 = 공격을 시작하고 aimMs 동안은 플레이어를 따라가다가 그다음 줄이 고정됨(빨간 표시가 진해짐) → 줄을 바꾸면(위아래로 비키면) 피함.
      //           높이 dodgeZ 넘게 뛰어도 피함. gapMs = 한 번 쓰면 이 시간 동안 안 씀, firstMs = 나타나서 처음 쓰기까지
      giant: {
        label: '서리 거인', boss: true, frameW: 352, frameH: 248, pivot: { x: 200, y: 242 },
        anims: enemyAnims('giant', {
          idle: [4, 5, true], walk: [6, 8, true],
          attack1: [5, 8, false, [1, 2, 2, 2, 2, 3, 4, 4, 4, 5]],   // 내려찍기: 1 듦 · 2 머리 위로(예고 500ms) · 3 내려침 · 4 땅에 박힘 · 5 어깨에 멤
          attack2: [5, 9, false, [1, 1, 1, 2, 3, 4, 4, 5]],         // 휘두르기: 1 뒤로 젖힘(예고) · 2 휘두름 · 3 쭉 뻗음 · 4 몸 앞 · 5 복귀
          special: [5, 8, false, [1, 2, 2, 2, 2, 3, 4, 4, 4, 5]],   // 얼음 가시: 1 손 듦 · 2 손 높이 + 서리 빛(예고) · 3 땅 침 = 가시 · 4 짚은 채 · 5 복귀
          hit: [3, 8, false, [1, 2, 2, 3]],
          hit2: [3, 8, false, [1, 1, 2, 2, 3]],
          stagger: [4, 7, false, null],                              // 휘청: 장마다 시간은 아래 stagger.d (3장 = 무릎 꿇고 헐떡임)
          death: [5, 6, false, [1, 1, 2, 2, 3, 4, 5]]                // 포효 → 무릎 → 넘어짐 → 얼음 조각상 → 산산조각
        }),
        fxArt: {
          icespike: { frames: seq(EN + 'icespike/icespike_', 5), pivot: { x: 48, y: 84 }, fps: 14 }   // 얼음 가시 덩어리(바닥 가운데 기준, 한 번)
        },
        walkAnim: 'walk',
        walkStride: 32,   // 보폭 걷기(enemies.js stepWalk): 걷기 6장 한 바퀴에 가는 그림 점. 7fps 쯤
        // 체력·데미지: 자동 조종(?bot=1, 피하지 않음) 시험에서 4단계 전갈 왕과 6단계 선장 사이가 되게 맞춤(그림 자료 제안 hp 1100 · 내려찍기 19~23 · 휘두르기 14~17 보다 낮춤)
        hp: 1000, speedX: 28, speedY: 22, radius: 44, height: 158,
        hurtbox: { x0: -40, x1: 48, yTop: -158, yBot: 0 },
        engage: 76, hover: [80, 110], range: [40, 300], alignY: 10, cooldown: [1000, 1800], firstCooldown: [1200, 1500],
        knockResist: 0.2, deathKnock: 40,
        staggerCdMs: 2200,
        superArmor: true,
        stagger: { at: [0.66, 0.33], onWall: false, d: [280, 140, 1000, 300], hurtbox: { x0: -78, x1: 60, yTop: -127, yBot: 0 } },
        enrageAt: 0.5,
        rageColor: '#7fd8ff',   // 분노 불꽃 색(2026-11-06 밤, config ai.rage)
        enrage: { speedMul: 1.25, cooldownMul: 0.7, summon: ['yeti', ['wolf', { variant: 'ice' }], ['wolf', { variant: 'ice' }]] },   // [이름, { variant }] = 색 바꾼 졸개
        attacks: {
          smash:  { anim: 'attack1', active: [3, 4], telegraph: [2], heavy: true, depth: 16,
                    reach: { x0: 40, x1: 104, yTop: -100, yBot: 0 },
                    dmg: [16, 20], knock: 36, flinchMs: 450, shake: 2.8, when: [30, 105], weight: 3,
                    burst: { x: 88, scale: 0.7, fx: 'icespike', cols: ['#e8f6ff', '#a8d8f8', '#6aa8d8', '#ffffff'] } },
          sweep:  { anim: 'attack2', active: [3, 4], telegraph: [1], depth: 14,
                    reach: { x0: 30, x1: 188, yTop: -135, yBot: -88 }, reachF: { 4: { x0: 20, x1: 80, yTop: -120, yBot: -20 } },
                    dmg: [12, 15], knock: 30, flinchMs: 400, shake: 1.6, when: [60, 190], weight: 3 },
          spikes: { type: 'spikes', anim: 'special', telegraph: [1, 2], spawnFrame: 3, fx: 'icespike', aimMs: 300,
                    count: 5, first: 70, step: 50, delayMs: 90, maxRange: 300,
                    spikeActive: [2, 3, 4], reach: { x0: -24, x1: 24, yTop: -72, yBot: 0 }, depth: 14, dodgeZ: 30,
                    dmg: [14, 18], knock: 16, flinchMs: 420, shake: 1.0, when: [110, 330], weight: 2, gapMs: 6000, firstMs: 3000 }
        }
      },

      // ===== 7단계 적 (art\stage7-enemies 에서 복사, 2026-11-04). 수치 = 그 폴더 anchors_*.json 의 suggest =====
      // 불 도깨비: 늑대처럼 치고 빠지기(retreatMs) + 불덩이 던지기. 고블린 크기(그림 칸·기준점 같음), 몸은 웅크린 70도트
      //   claw = 불 발톱 할퀴기: 2장 발톱 치켜듦(예고) → 3장 달려들며 내리긋기(맞음, move 로 26 앞으로) → 4장 끝까지(reachF[4] 가까이)
      //   fireball = 불덩이 던지기(6단계 총알과 같은 type 'shot': 쏜 사람 줄을 따라 똑바로). 2장 팔 뒤로(예고 300ms, 총잡이 500ms 보다 짧게
      //     = 빨간 겨눔 선) → 3장 던짐(spawn = 손 자리). proj = 날아가는 그림, impact = 맞거나 끝까지 가면 터지는 그림(fxArt 이름), muzzle = 총구 연기(없음)
      //     maxShooters = 같은 종류가 동시에 던지는 최대 수(도깨비 여럿이 한꺼번에 던지지 않게), gapMs = 한 번 던지면 이 시간 동안 안 던짐(대신 붙어서 할퀴기),
      //     firstMs = 나타나서 처음 던질 수 있을 때까지(처음엔 달려와서 할퀴기)
      //   잡몹 공격이 여럿: 거리가 when 안인 것 중 weight 로 고름(가까우면 할퀴기, 140~300 떨어져 있으면 던지기)
      imp: {
        label: '불 도깨비', frameW: 176, frameH: 136, pivot: { x: 92, y: 130 },
        anims: enemyAnims('imp', {
          idle: [4, 8, true], run: [8, 14, true],
          attack: [5, 12, false, [1, 2, 2, 2, 3, 4, 4, 5]],          // 할퀴기: 1 웅크림 · 2 발톱 치켜듦(예고 250ms) · 3 내리긋기(맞음) · 4 끝까지 · 5 복귀
          attack2: [5, 10, false, [1, 1, 2, 2, 2, 3, 4, 4, 5]],      // 불덩이: 1 손에 불덩이 · 2 팔 뒤로(예고) · 3 던짐 · 4 · 5 복귀
          hit: [3, 10, false, [1, 2, 2, 3]],
          hit2: [3, 10, false, [1, 1, 2, 2, 3]],
          knockdown: [5, 10, false, [1, 2, 2, 3, 4, 5, 4, 5]],
          getup: [3, 8, false, [1, 1, 2, 2, 3]],
          death: [5, 9, false, [1, 2, 3, 4, 5]]                      // 금이 하얗게 달아오름 → 불길에 터짐 → 재 무더기 + 두 뿔
        }),
        fxArt: {
          fireball: { frames: seq(EN + 'fireball/fireball_', 4), pivot: { x: 13, y: 16 }, fps: 14 },   // 날아가는 불덩이(공 가운데 기준, 불꼬리가 오른쪽 = 왼쪽으로 날아감)
          burst:    { frames: seq(EN + 'burst/burst_', 4),       pivot: { x: 32, y: 44 }, fps: 12 }    // 불꽃 터짐(바닥 가운데 기준, 한 번)
        },
        walkAnim: 'run',
        down: { slide: 80, lyingFrames: [3, 4, 5] },
        hp: 45, speedX: 112, speedY: 62, radius: 14, height: 72,
        hurtbox: { x0: -12, x1: 28, yTop: -70, yBot: 0 },
        engage: 60, hover: [140, 200], range: [24, 300], alignY: 8, cooldown: [1200, 2200], firstCooldown: [300, 1200],
        retreatMs: 900,           // 할퀴고(던지고) 난 뒤 뒤로 빠지는 시간 (치고 빠지기)
        knockResist: 1.2, deathKnock: 220,
        attacks: {
          claw:     { anim: 'attack', active: [3, 4], telegraph: [2], reach: { x0: 14, x1: 76, yTop: -62, yBot: -2 }, reachF: { 4: { x0: 14, x1: 57, yTop: -55, yBot: -8 } },
                      depth: 12, dmg: [5, 7], knock: 12, move: { frames: [3, 4], dist: 26 }, when: [24, 80], weight: 3 },
          fireball: { type: 'shot', anim: 'attack2', telegraph: [2], spawnFrame: 3, spawn: { x: 62, y: -48 }, aimH: 48, dropPx: 0,
                      proj: 'fireball', impact: 'burst', muzzle: null, maxShooters: 1, gapMs: 8000, firstMs: 2500,
                      speed: 210, range: 300, box: { w: 14, h: 14 }, depth: 10, dodgeZ: 20,
                      dmg: [4, 6], knock: 14, flinchMs: 300, when: [110, 300], weight: 1 }
        }
      },
      // 용암 골렘(7단계 정예): 2단계 돌 골렘 그림을 「용암」 색(variant 'lava')으로 바꿔 쓰는 「보스가 아닌」 강한 적(체력 막대 없음, 판 보스는 와이번)
      //   보스 규칙(체력 문턱 휘청·화남·졸개)은 없고, 공격 중 안 끊김(superArmor) + 한 번 움찔하면 staggerCdMs 동안 안 움찔(무한 콤보 없음)
      //   넘어짐 그림이 없어서 안 넘어짐. 그림·효과는 돌 골렘과 같은 파일(한 번만 받음), 공격은 골렘과 같고 데미지만 낮춤
      //   variant = 늘 이 색으로 나옴(웨이브에 { variant } 를 안 적어도). showTelegraph = 잡몹이어도 바닥 예고 띠
      lavagolem: {
        label: '골렘', variant: 'lava', frameW: 320, frameH: 232, pivot: { x: 168, y: 226 },
        anims: enemyAnims('golem', {
          idle: [4, 5, true], walk: [6, 8, true],
          attack1: [5, 8, false, [1, 2, 2, 2, 2, 3, 4, 4, 4, 5]],
          attack2: [5, 9, false, [1, 1, 1, 2, 3, 4, 4, 5]],
          special: [5, 8, false, [1, 1, 2, 3, 3, 3, 3, 4, 4, 5]],
          hit: [3, 8, false, [1, 2, 2, 3]],
          hit2: [3, 8, false, [1, 1, 2, 2, 3]],
          death: [5, 6, false, [1, 1, 2, 2, 3, 4, 5]]
        }),
        fxArt: {
          boulder:   { frames: seq(EN + 'boulder/boulder_', 4),     pivot: { x: 32, y: 32 }, fps: 12 },
          rockburst: { frames: seq(EN + 'rockburst/rockburst_', 5), pivot: { x: 64, y: 84 }, fps: 12 }
        },
        walkAnim: 'walk',
        hp: 240, speedX: 30, speedY: 24, radius: 42, height: 150,
        hurtbox: { x0: -34, x1: 55, yTop: -150, yBot: 0 },
        engage: 70, hover: [90, 130], range: [30, 300], alignY: 10, cooldown: [2000, 3000], firstCooldown: [1200, 1800],
        knockResist: 0.25, deathKnock: 60,
        staggerCdMs: 2200,
        superArmor: true,
        attacks: {
          slam:  { anim: 'attack1', active: [3, 4], reach: { x0: 30, x1: 100, yTop: -80, yBot: 0 }, depth: 16, showTelegraph: true,
                   dmg: [9, 12], knock: 30, flinchMs: 420, telegraph: [2], shake: 2.0, when: [30, 100], weight: 2, heavy: true,
                   burst: { x: 85, scale: 0.6 } },
          sweep: { anim: 'attack2', active: [3, 4], reach: { x0: 30, x1: 136, yTop: -125, yBot: -60 }, depth: 14, showTelegraph: true,
                   dmg: [8, 10], knock: 26, flinchMs: 380, telegraph: [1], shake: 1.3, when: [60, 150], weight: 3 },
          throw: { type: 'throw', anim: 'special', telegraph: [1, 3], spawnFrame: 4, spawn: { x: 110, y: -112 },
                   flightMs: 700, arcPeak: 60, maxRange: 280, radius: 38, depth: 16, dodgeZ: 24, gapMs: 5000,
                   dmg: [9, 12], knock: 26, flinchMs: 420, shake: 2.2, when: [120, 300], weight: 2, heavy: true }
        }
      },
      // 붉은 와이번(7단계 보스): 오크·골렘·전갈·두꺼비·선장과 같은 보스 규칙(공격 중 안 끊김, 체력 66%·33% 휘청, 절반에서 화남 + 도깨비 부름)
      //   그림 칸 400x256(두꺼비와 같음), 휘청 3장 = 배를 깔고 날개를 늘어뜨림 = 때릴 기회(1000ms, 몸이 낮고 넓어서 stagger.hurtbox)
      //   공격: combo = 물기 + 꼬리 휘두르기(1장 고개 젖히고 포효 = 예고 → 2장 물기 → 4장 꼬리(reachF[4]), multiHit = 장마다 한 번씩)
      //         breath = 불 뿜기(type 'breath'): 1장 고개 젖힘·목이 달아오름(예고 550ms, 바닥 빨간 띠 = 불길 길이)
      //           → 2·3·4장 반복(1초) 동안 입 앞 긴 상자(reach)에 tickMs 마다 불 데미지: 처음 닿으면 보통 맞음(dmg, 움찔),
      //             그 뒤 계속 서 있으면(맞은 뒤 깜빡임 중) burn 만큼씩 탐(독처럼 체력 1 아래로는 안 내려감) → 줄을 바꾸면 피함
      //           fx = 불길 그림(breath, 오른쪽 끝 = 잘린 면)을 입 앞 attach 에 붙여 segments 개 앞으로 이어 그림(segW = 한 개 길이), growMs = 처음 뻗어 나가는 시간
      //         dive = 날아올라 내리꽂기(type 'dive'): fly 1장 웅크리고 날개 치켜듦(예고 420ms) → 2·3장 떠오름(z 까지) → fly 4·5장 맴돌며 플레이어 쪽으로
      //           (hover: speed, 최대 maxMs, catchR 안으로 오면 멈춤. 바닥에 그림자 + 빨간 원 = 떨어질 자리) → warnMs 동안 그 자리에서 빨간 원이 진해짐
      //           → dive 1장 fallMs 동안 떨어짐 → 2장 쾅(radius·depth 안이면 맞음, 넘어짐, 크게 흔들림, 높이 dodgeZ 넘게 뛰면 피함) slamMs → 3장 일어남 recoverMs
      //           공중(떠오름~떨어짐)에서는 땅에서 하는 공격은 안 맞음 — 점프 공격(플레이어가 jumpZ 넘게 떠 있을 때)만 맞음. 거리 상관없이 씀(when 0~), 한 번 쓰면 gapMs 동안 안 씀
      //   rim = 붉은 하늘에 붉은 몸이 묻히지 않게 그림 둘레에 어두운 테두리(px = 캔버스 점, alpha = 진하기)
      wyvern: {
        label: '붉은 와이번', boss: true, frameW: 400, frameH: 256, pivot: { x: 248, y: 250 },
        anims: enemyAnims('wyvern', {
          idle: [4, 5, true], walk: [6, 8, true],
          attack1: [5, 9, false, [1, 1, 1, 1, 2, 2, 3, 4, 4, 5]],                 // 물기+꼬리: 1 포효(예고 450ms) · 2 물기 · 3 몸 돌림 · 4 꼬리 · 5 복귀
          attack2: [5, 9, false, [1, 1, 1, 1, 1, 2, 3, 4, 2, 3, 4, 2, 3, 4, 5]],  // 불 뿜기: 1 목이 달아오름(예고 550ms) · 2-3-4 불길 세 번(1초) · 5 입 닫음
          fly: [5, 9, false, null],                                                 // 날아오르기·맴돌기: 장마다 시간은 아래 dive 수치(코드에서)
          dive: [3, 10, false, null],                                               // 내리꽂기: 1 떨어짐 · 2 쾅 · 3 일어남
          hit: [3, 8, false, [1, 2, 2, 3]],
          hit2: [3, 8, false, [1, 1, 2, 2, 3]],
          stagger: [4, 7, false, null],                                             // 휘청: 장마다 시간은 아래 stagger.d (3장 = 배 깔고 뻗음)
          death: [5, 6, false, [1, 1, 2, 2, 3, 4, 5]]                               // 마지막 포효 → 뒤로 넘어감 → 옆으로 쓰러짐
        }),
        fxArt: {
          breath: { frames: seq(EN + 'breath/breath_', 4), pivot: { x: 125, y: 32 }, fps: 14 }   // 불길 한 토막(기준 = 오른쪽 잘린 면 가운데, 불 머리가 왼쪽)
        },
        walkAnim: 'walk',
        walkStride: 38,   // 보폭 걷기(enemies.js stepWalk): 걷기 6장 한 바퀴에 가는 그림 점. 8fps 쯤
        rim: { color: '#1a0608', px: 1, alpha: 0.85 },
        hp: 1000, speedX: 38, speedY: 28, radius: 48, height: 150,
        hurtbox: { x0: -62, x1: 58, yTop: -150, yBot: 0 },
        engage: 80, hover: [80, 110], range: [40, 180], alignY: 10, cooldown: [1000, 1800], firstCooldown: [1200, 1500],
        knockResist: 0.2, deathKnock: 50,
        staggerCdMs: 2200,
        superArmor: true,
        stagger: { at: [0.66, 0.33], onWall: false, d: [260, 160, 1000, 320], hurtbox: { x0: -112, x1: 113, yTop: -85, yBot: 0 } },
        enrageAt: 0.5,
        rageColor: '#ff4a1a',   // 분노 불꽃 색(2026-11-06 밤, config ai.rage)
        enrage: { speedMul: 1.25, cooldownMul: 0.7, summon: ['imp', 'imp', 'imp'] },
        attacks: {
          combo:  { anim: 'attack1', active: [2, 4], multiHit: true, telegraph: [1], depth: 14,
                    reach: { x0: 50, x1: 142, yTop: -120, yBot: -80 }, reachF: { 4: { x0: 20, x1: 142, yTop: -82, yBot: -42 } },
                    dmg: [12, 16], knock: 30, flinchMs: 420, shake: 1.6, when: [40, 150], weight: 3 },
          breath: { type: 'breath', anim: 'attack2', telegraph: [1], active: [2, 3, 4], depth: 14,
                    reach: { x0: 55, x1: 255, yTop: -114, yBot: -58 }, tickMs: 160,
                    dmg: [4, 6], burn: [1, 2], knock: 8, flinchMs: 200, shake: 0.6, when: [70, 300], weight: 2,
                    fx: { art: 'breath', attach: { x: 135, y: -86 }, segW: 119, segments: 1, growMs: 140 } },
          dive:   { type: 'dive', anim: 'fly', diveAnim: 'dive', telegraph: [1],
                    takeoffMs: [420, 120, 140], z: 80, hover: { fps: 9, speed: 170, maxMs: 1400, catchR: 8 }, warnMs: 450,
                    fallMs: 200, slamMs: 320, recoverMs: 320, jumpZ: 8,
                    radius: 110, depth: 24, dodgeZ: 24,
                    dmg: [16, 20], knock: 40, flinchMs: 520, shake: 3.2, heavy: true, when: [0, 600], weight: 2, gapMs: 9000, firstMs: 5000 }
        }
      },

      // ===== 8단계 적 (art\stage8-enemies 에서 복사, 2026-11-04). 수치 = 그 폴더 anchors_*.json 의 suggest =====
      // 유령 기사: 도마뱀 전사 크기 그림 칸(208x148, 찌르기 칼끝이 앞 104 까지라 칸이 넓음). 발 대신 연기 자락 → 땅 위를 미끄러지듯 다님(걷는 그림 = 미끄러짐)
      //   glide = 서 있거나 다닐 때 위아래로 살짝 둥실(박쥐 flying.bob 처럼, 그림자는 땅에 그대로). 박쥐와 달리 「땅의 적」(소품에 막힘, 점프 공격 보너스 없음)
      //   chop = 머리 위 내려베기: 1 칼 들기 · 2 투구 뒤로 칼 치켜듦 + 칼날·눈구멍이 번쩍(예고 약 400ms, 바닥 빨간 띠) · 3 초승달 빛 내려베기(맞음) · 4 칼끝 아래(reachF[4]) · 5 복귀
      //   phase = 유령 돌진 찌르기: 1 웅크리고 칼을 허리에(예고 250ms, 바닥 빨간 띠) · 2 몸이 옅어짐(fade = 반투명, 안 맞음, 몸끼리 안 밀림)
      //     → 2·3장 동안 move 로 70 앞으로 미끄러짐 · 3 다시 나타나며 쭉 찌름(맞음, 칼끝 앞 104) · 4 복귀.
      //     거리가 when(60~150) 일 때만 = 플레이어가 떨어져 있을 때 거리를 좁히는 기술. gapMs = 한 번 쓰면 이 시간 동안 안 씀, firstMs = 나타나서 처음 쓰기까지
      ghost: {
        label: '유령 기사', frameW: 208, frameH: 148, pivot: { x: 124, y: 142 },
        anims: enemyAnims('ghost', {
          idle: [4, 6, true], walk: [8, 10, true],
          attack: [5, 10, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]],      // 내려베기: 1 들기 · 2 치켜듦·번쩍(예고 400ms) · 3 내려벰 · 4 칼끝 아래 · 5 복귀
          attack2: [4, 12, false, [1, 1, 1, 2, 2, 3, 3, 4]],        // 유령 돌진: 1 웅크림(예고 250ms) · 2 옅어짐(안 맞음) · 3 찌름 · 4 복귀
          hit: [3, 10, false, [1, 2, 2, 3]],
          hit2: [3, 10, false, [1, 1, 2, 2, 3]],
          knockdown: [5, 10, false, [1, 2, 2, 3, 4, 5, 4, 5]],
          getup: [3, 8, false, [1, 1, 2, 2, 3]],                    // 방패 짚고 앉음 → 연기 모이며 떠오름 → 다시 둥실
          death: [5, 8, false, [1, 2, 3, 4, 5]]                     // 눈빛 번쩍 → 갑옷이 푸른 연기로 흩어짐 → 빈 투구·망토·칼만 바닥에
        }),
        walkAnim: 'walk',
        glide: { bob: 1.5, bobMs: 1300 },
        down: { slide: 70, lyingFrames: [3, 4, 5] },
        hp: 80, speedX: 48, speedY: 30, radius: 15, height: 94,
        hurtbox: { x0: -20, x1: 24, yTop: -92, yBot: 0 },
        engage: 50, hover: [110, 160], range: [24, 150], alignY: 7, cooldown: [1300, 2300], firstCooldown: [600, 1600],
        knockResist: 0.9, deathKnock: 190,
        attacks: {
          chop:  { anim: 'attack', active: [3, 4], telegraph: [2], showTelegraph: true, depth: 12,
                   reach: { x0: 20, x1: 48, yTop: -95, yBot: -10 }, reachF: { 4: { x0: 20, x1: 48, yTop: -72, yBot: -8 } },
                   dmg: [7, 10], knock: 18, when: [0, 60], weight: 3 },
          phase: { anim: 'attack2', active: [3], telegraph: [1], showTelegraph: true, fade: [2], depth: 12,
                   reach: { x0: 20, x1: 104, yTop: -88, yBot: -50 }, move: { frames: [2, 3], dist: 70 },
                   dmg: [5, 7], knock: 22, flinchMs: 340, when: [60, 150], weight: 2, gapMs: 9000, firstMs: 3000 }
        }
      },
      // 흡혈 백작(8단계 보스): 오크·골렘·선장·와이번과 같은 보스 규칙(공격 중 안 끊김, 체력 66%·33% 휘청, 절반에서 화남 + 유령 기사·박쥐 부름)
      //   그림 칸 320x232(오크·선장과 같음), 휘청 3장 = 한 무릎 꿇고 헐떡임, 망토 찢어짐 = 때릴 기회(1000ms, 몸이 낮고 넓어서 stagger.hurtbox)
      //   rim = 검은 망토가 어두운 성·소품에 묻히지 않게 그림 둘레에 차가운 달빛 테두리(와이번의 어두운 테두리와 같은 코드, 색만 밝게)
      //   공격: claws = 발톱 두 번(1장 두 손 치켜들고 쉿 = 예고 400ms → 2장 대각선 할퀴기 reachF[2] → 3장 길게 휘두르기 reachF[3], multiHit = 장마다 한 번씩)
      //         batSweep = 망토 휘둘러 박쥐 떼(총잡이·불덩이와 같은 type 'shot' = 쏜 사람 줄을 따라 똑바로): 1 망토로 얼굴 가림 · 2 망토를 날개처럼 펼침(예고 550ms, 빨간 겨눔 선)
      //           → 3장 휘두름 = 망토 끝(spawn)에서 박쥐 떼(proj = fxArt bats, 박쥐 3마리 한 무리)가 날아감. 처음 dropPx 동안 aimH 높이로 내려옴(그림만)
      //           enraged = 화난 뒤: 박쥐 떼 count 무리를 lanes(줄 위아래 차이)마다 gapMs 씩 늦게, 양옆 무리는 scale 만큼 작게 → 줄을 크게 바꿔야 피함
      //           hitCols = 맞을 때 튀는 조각 색(검은 날개·붉은 테)
      //         mistBite = 안개 순간이동 + 물어 빨기(type 'teleport'):
      //           vanish(1 망토로 몸을 감쌈 = 예고 · 2~3 연기 기둥으로 흩어짐, 2장부터 안 맞음) → 숨음(hidden: 안 보이고 안 맞음, mist 그림이 옛 자리에서 퍼짐)
      //           → hiddenMs 뒤 자리를 고름 = 플레이어 「등 뒤」 behind 만큼(바라보는 반대쪽, 화면 밖이면 앞쪽) 같은 줄 → 그 자리에 gatherMs 동안 안개가 모이고 바닥에 빨간 원(예고)
      //             → 자리는 그때 고정 = 비키거나(옆으로·위아래) 뛰어 있으면 피함 → appear(1 안개에서 다시 빚어짐 = 안 맞음 · 2 망토 펼치고 덤빔 = 앞으로 lunge 만큼)
      //           → bite 1장 = 잡기 한 번(reach). 못 잡으면 missMs 동안 헛물기 자세(때릴 기회)
      //           → 잡으면 미라 잡기(grab)와 같이 붙잡음: dist 앞에 붙여 두고 bite 2·3장 반복, drain.everyMs 마다 drain.dmg 만큼 피를 빨고(체력 1 아래로는 안 내려감) 백작은 drain.heal 만큼 회복
      //             ms 동안(버튼 연타 한 번마다 mashMs 줄어듦, 그래도 minMs 는 잡혀 있음) → 놓으면서 dmg 데미지 + 내던짐(heavy = 넘어짐)
      //           gapMs = 한 번 쓰면 이 시간 동안 안 씀, firstMs = 나타나서 처음 쓰기까지. 플레이어가 공중이면 안 씀
      vampire: {
        label: '흡혈 백작', boss: true, frameW: 320, frameH: 232, pivot: { x: 168, y: 226 },
        anims: enemyAnims('vampire', {
          idle: [4, 5, true], walk: [6, 7, true],
          attack1: [5, 10, false, [1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5]],   // 발톱 두 번: 1 치켜듦·쉿(예고 400ms) · 2 대각선 할퀴기 · 3 길게 휘두르기 · 4 · 5 복귀
          attack2: [5, 9, false, [1, 1, 2, 2, 2, 3, 4, 4, 5]],          // 박쥐 떼: 1 망토로 가림 · 2 망토 펼침(예고) · 3 휘두름 = 박쥐 · 4 망토 앞으로 · 5 복귀
          vanish: [3, 8, false, [1, 1, 1, 2, 3, 3]],                    // 사라짐: 1 망토로 감쌈(예고) · 2 아래가 연기·박쥐로 · 3 연기 기둥(붉은 눈)
          appear: [2, 8, false, [1, 1, 2, 2]],                          // 나타남: 1 연기에서 빚어짐(안 맞음) · 2 망토 펼치고 덤빔(예고)
          bite: [3, 8, false, [1, 2, 2, 3, 3, 3, 3, 2, 3]],             // 물기: 1 두 손 뻗어 잡기 · 2 물기 · 3 피 빨기(잡고 있는 동안 2·3 반복)
          hit: [3, 8, false, [1, 2, 2, 3]],
          hit2: [3, 8, false, [1, 1, 2, 2, 3]],
          stagger: [4, 7, false, null],                                  // 휘청: 장마다 시간은 아래 stagger.d (3장 = 한 무릎 꿇고 헐떡임)
          death: [5, 6, false, [1, 1, 2, 2, 3, 4, 5]]                    // 비명·붉은 금 → 무릎 꿇고 재로 → 무너지며 박쥐가 날아감 → 빈 망토 밑 재 무더기
        }),
        fxArt: {
          bats: { frames: seq(EN + 'bats/bats_', 4), pivot: { x: 52, y: 30 }, fps: 14 },   // 박쥐 떼(3마리 한 무리 가운데 기준, 왼쪽으로 날아감, 붉은 테두리)
          mist: { frames: seq(EN + 'mist/mist_', 5), pivot: { x: 88, y: 172 }, fps: 10 }    // 안개 + 박쥐 구름(바닥 가운데 기준, 한 번)
        },
        walkAnim: 'walk',
        walkStride: 41,   // 보폭 걷기(enemies.js stepWalk): 걷기 6장 한 바퀴에 가는 그림 점. 7.5fps 쯤
        rim: { color: '#9ab8ff', px: 1, alpha: 0.5 },
        hp: 980, speedX: 38, speedY: 26, radius: 34, height: 156,
        hurtbox: { x0: -30, x1: 24, yTop: -155, yBot: 0 },
        engage: 70, hover: [70, 90], range: [30, 160], alignY: 10, cooldown: [950, 1700], firstCooldown: [1200, 1500],
        knockResist: 0.2, deathKnock: 50,
        staggerCdMs: 2200,
        superArmor: true,
        stagger: { at: [0.66, 0.33], onWall: false, d: [260, 160, 1000, 320], hurtbox: { x0: -70, x1: 49, yTop: -101, yBot: 0 } },
        enrageAt: 0.5,
        rageColor: '#ff2a6a',   // 분노 불꽃 색(2026-11-06 밤, config ai.rage)
        enrage: { speedMul: 1.25, cooldownMul: 0.7, summon: ['ghost', 'bat', 'ghost'] },
        attacks: {
          claws:    { anim: 'attack1', active: [2, 3], multiHit: true, telegraph: [1], depth: 14,
                      reach: { x0: 10, x1: 94, yTop: -115, yBot: -20 },
                      reachF: { 2: { x0: 10, x1: 40, yTop: -115, yBot: -20 }, 3: { x0: 20, x1: 94, yTop: -112, yBot: -60 } },
                      dmg: [12, 15], knock: 24, flinchMs: 400, shake: 1.4, when: [30, 110], weight: 3 },
          batSweep: { type: 'shot', anim: 'attack2', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 96, y: -96 }, aimH: 70, dropPx: 60,
                      proj: 'bats', impact: null, muzzle: null, hitCols: ['#1a1018', '#3a2030', '#c42834', '#ff6a6a'],
                      speed: 240, range: 420, box: { w: 70, h: 30 }, depth: 14, dodgeZ: 20,
                      enraged: { count: 3, lanes: [0, -16, 16], gapMs: 120, scale: [1, 0.8, 0.8] },
                      dmg: [10, 13], knock: 16, flinchMs: 320, shake: 0.8, when: [120, 420], weight: 2 },
          mistBite: { type: 'teleport', anim: 'vanish', appearAnim: 'appear', biteAnim: 'bite', telegraph: [1], invuln: [2, 3],
                      hiddenMs: 650, gatherMs: 450, behind: 70, lunge: 16, missMs: 450, depth: 14,
                      reach: { x0: 20, x1: 64, yTop: -140, yBot: -60 },
                      dmg: [10, 13], knock: 26, flinchMs: 420, heavy: true, shake: 1.4,
                      grab: { ms: 1400, mashMs: 120, minMs: 500, dist: 42 },
                      drain: { everyMs: 200, dmg: 3, heal: 4 },
                      when: [0, 600], weight: 2, gapMs: 9000, firstMs: 6000 }
        }
      },

      // ===== 9단계 적 (art\stage9-enemies 에서 복사, 2026-11-04). 수치 = 그 폴더 anchors_*.json 의 suggest =====
      // 마족 병사: 해골 병사처럼 방패 막기(guard, 같은 수치) + 미늘창 휘두르기. 그림 칸 = 도마뱀 전사 크기(208x148, 미늘창이 앞 94 까지)
      //   sweep = 1 미늘창 뒤로 · 2 머리 위로 치켜듦·포효·날 번쩍(예고 400ms, 바닥 빨간 띠) · 3 앞으로 휘두름(맞음, 허리 높이) · 4 날이 앞 아래(reachF[4]) · 5 복귀
      soldier: {
        label: '마족 병사', frameW: 208, frameH: 148, pivot: { x: 124, y: 142 },
        anims: enemyAnims('soldier', {
          idle: [4, 6, true], walk: [8, 10, true],
          attack: [5, 10, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]],      // 미늘창: 1 뒤로 · 2 치켜듦(예고 400ms) · 3 휘두름 · 4 앞 아래 · 5 복귀
          block: [2, 8, false, [1, 2, 2, 1]],                       // 1 가시 방패 들고 웅크림 · 2 막으며 불꽃·밀림
          hit: [3, 10, false, [1, 2, 2, 3]],
          hit2: [3, 10, false, [1, 1, 2, 2, 3]],
          knockdown: [5, 10, false, [1, 2, 2, 3, 4, 5, 4, 5]],
          getup: [3, 8, false, [1, 1, 2, 2, 3]],                    // 방패 짚고 앉음 → 미늘창 짚고 한 무릎 → 섬
          death: [5, 8, false, [1, 2, 3, 4, 5]]                     // 금이 빛남 → 넘어짐 → 검은 재로 → 투구·방패·미늘창만
        }),
        walkAnim: 'walk',
        down: { slide: 75, lyingFrames: [3, 4, 5] },
        hp: 95, speedX: 42, speedY: 28, radius: 16, height: 92,
        hurtbox: { x0: -18, x1: 30, yTop: -90, yBot: 0 },
        engage: 70, hover: [105, 155], range: [24, 100], alignY: 7, cooldown: [1300, 2300], firstCooldown: [600, 1600],
        knockResist: 0.9, deathKnock: 200,
        guard: { anim: 'block', chance: 0.4, cdMs: 2600, holdMs: 900, maxBlocks: 3, push: 18, flashMs: 120, counterMs: 250 },
        attacks: {
          sweep: { anim: 'attack', active: [3, 4], telegraph: [2], showTelegraph: true, depth: 12,
                   reach: { x0: 20, x1: 94, yTop: -84, yBot: -30 }, reachF: { 4: { x0: 20, x1: 61, yTop: -64, yBot: 0 } },
                   dmg: [7, 10], knock: 18, when: [24, 96] }
        }
      },
      // 흑마법사: 해적 총잡이처럼 거리 두고 쏨(ranged). 그림 칸 208x176(지팡이를 머리 위로 들면 161 높이)
      //   orb = 암흑 구체(총알과 같은 type 'shot' = 쏜 사람 줄을 따라 똑바로): 1 지팡이 듦 · 2 머리 위로, 해골이 초록으로 타오름(예고 600ms, 빨간 겨눔 선)
      //     → 3장 앞으로 휘두름 = 해골 앞(spawn)에서 구체가 날아감 · 4 반동 · 5 내림. 맞거나 끝까지 가면 그 높이에서 초록 터짐(impact 'orbhit', impactAir = 바닥 말고 구체 높이)
      //   ranged.attack = 쏘는 공격 이름, maxShooters 1 = 마법사가 여럿이어도 한 번에 하나만 겨눔. 근접 공격 그림이 없어서 붙으면 뒤로 물러나기만 함
      //   rim = 가장 어두운 몸(검은 두루마기)이 어두운 요새 바닥·소품에 묻히지 않게 옅은 잿빛 보라 테두리(와이번·백작과 같은 코드)
      mage: {
        label: '흑마법사', frameW: 208, frameH: 176, pivot: { x: 120, y: 170 },
        anims: enemyAnims('mage', {
          idle: [4, 6, true], walk: [6, 8, true],
          cast: [5, 10, false, [1, 2, 2, 2, 2, 2, 3, 4, 4, 5]],     // 구체: 1 듦 · 2 머리 위로(예고 600ms) · 3 휘두름 = 구체 · 4 반동 · 5 내림
          hit: [3, 10, false, [1, 2, 2, 3]],
          hit2: [3, 10, false, [1, 1, 2, 2, 3]],
          knockdown: [5, 10, false, [1, 2, 2, 3, 4, 5, 4, 5]],
          getup: [3, 8, false, [1, 1, 2, 2, 3]],
          death: [5, 8, false, [1, 2, 3, 4, 5]]                     // 눈에서 초록 빛 → 쓰러짐 → 검은 연기 기둥 → 빈 두루마기 + 금 간 해골 지팡이
        }),
        fxArt: {
          orb:    { frames: seq(EN + 'orb/orb_', 4),       pivot: { x: 20, y: 21 }, fps: 14 },   // 암흑 구체(공 가운데 기준, 연기 꼬리가 오른쪽 = 왼쪽으로 날아감)
          orbhit: { frames: seq(EN + 'orbhit/orbhit_', 4), pivot: { x: 48, y: 48 }, fps: 14 }    // 초록 터짐(가운데 기준, 한 번)
        },
        walkAnim: 'walk',
        rim: { color: '#c4b4e0', px: 1, alpha: 0.42 },
        down: { slide: 70, lyingFrames: [3, 4, 5] },
        hp: 60, speedX: 40, speedY: 28, radius: 15, height: 108,
        hurtbox: { x0: -14, x1: 26, yTop: -100, yBot: 0 },
        engage: 50, hover: [160, 260], range: [0, 360], alignY: 8, cooldown: [2800, 3800], firstCooldown: [1400, 2400],
        knockResist: 1.0, deathKnock: 210,
        ranged: { attack: 'orb', keep: [160, 260], tooClose: 80, backOffMul: 0.8, maxShooters: 1, alignMs: 700 },
        attacks: {
          orb: { type: 'shot', anim: 'cast', telegraph: [2], spawnFrame: 3, spawn: { x: 80, y: -68 }, aimH: 68, dropPx: 0,
                 proj: 'orb', impact: 'orbhit', impactAir: true, muzzle: null,
                 hitCols: ['#0a140c', '#2a5a2a', '#5aff7a', '#c8ffc8'], impactCols: ['#0a140c', '#2a5a2a', '#5aff7a', '#c8ffc8'],
                 speed: 230, range: 360, box: { w: 22, h: 18 }, depth: 12, dodgeZ: 22,
                 dmg: [4, 6], knock: 14, flinchMs: 320, when: [120, 360] }
        }
      },
      // 마왕군 장군(9단계 보스): 오크·골렘·선장·와이번·백작과 같은 보스 규칙(공격 중 안 끊김, 체력 66%·33% 휘청, 절반에서 화남 + 마족 병사 둘·흑마법사 부름)
      //   그림 칸 352x248(서리 거인과 같음: 가로 베기가 앞 172 까지, 치켜든 칼이 240 높이), 휘청 3장 = 칼 짚고 한 무릎 꿇음, 칼 불꽃이 잦아듦 = 때릴 기회(1000ms, stagger.hurtbox)
      //   공격: combo = 대검 두 번(1장 칼을 머리 뒤로, 불꽃 = 예고 500ms → 2장 대각선 내려베기 reachF[2] → 3 칼 당김 → 4장 가로 베기 reachF[4] 앞 172 까지, multiHit = 장마다 한 번씩)
      //         dash = 돌진 찌르기(오크 어깨 돌진과 같은 type 'charge', 바닥 빨간 띠 = 돌진 길): windMs 웅크리고 칼을 허리에(예고) → speed 로 dist 만큼 화면을 가로지름
      //           frames = 그림 번호 지도(오크는 1 / 3·4 / 5 = 코드 기본값): 1 웅크림 · 2·3 달리며 찌름(반복) · 4 미끄러지며 멈춤(impact) · 5 복귀
      //           onWall = 헛치고 화면 끝(벽)에 박히면 휘청 = 때릴 기회
      //         shockwave = 칼 꽂기 화염 충격파(type 'shockwave'): 1 칼끝을 아래로 듦 · 2 머리 위로 치켜듦, 불꽃(예고 625ms, 바닥 빨간 원 = 고리가 닿는 끝)
      //           → 3장 칼을 발 앞(spawn)에 꽂음 = 불꽃 고리 rings.count 개를 gapMs 씩 늦게(화나면 enraged.count 개) → 4장 무릎 꿇고 칼 짚음(holdFrame: 고리가 퍼지는 동안 멈춤) → 5 칼 뽑음
      //           고리 = 꽂은 자리를 가운데로 r0 → rMax 까지 speed(도트/초)로 퍼지는 납작한 타원(가로 r, 위아래 min(r, ringRx) / ringRx x ryMax)
      //             맞음 = 플레이어 발이 그 타원 「테두리」 band 안(가는 띠, 꽉 찬 원이 아님) + 높이 dodgeZ 아래 → 고리마다 한 번
      //             피하기 = 고리가 지나갈 때 맞춰 뛰어넘기 / 위아래 줄을 크게 바꾸기(타원 위아래 ±ryMax 밖) / rMax 밖에 있기
      //           그림 = fxArt shockwave(고리 한 크기로 그린 5장): 가로 r / ringRx 배, 세로 min(1, r / ringRx) x flameScale 배(불꽃이 화면을 덮지 않게)
      general: {
        label: '마왕군 장군', boss: true, frameW: 352, frameH: 248, pivot: { x: 200, y: 242 },
        anims: enemyAnims('general', {
          idle: [4, 5, true], walk: [6, 7, true],
          attack1: [5, 10, false, [1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]],   // 대검 두 번: 1 치켜듦·불꽃(예고 500ms) · 2 내려베기 · 3 당김 · 4 가로 베기 · 5 복귀
          attack2: [5, 10, false, null],                                      // 돌진 찌르기: 코드에서 단계별로(아래 dash.frames)
          special: [5, 8, false, [1, 2, 2, 2, 2, 3, 4, 4, 4, 5]],             // 칼 꽂기: 1 듦 · 2 치켜듦(예고) · 3 꽂음 = 고리 · 4 무릎 꿇고 짚음 · 5 뽑음
          hit: [3, 8, false, [1, 2, 2, 3]],
          hit2: [3, 8, false, [1, 1, 2, 2, 3]],
          stagger: [4, 7, false, null],                                        // 휘청: 장마다 시간은 아래 stagger.d (3장 = 칼 짚고 한 무릎)
          death: [5, 6, false, [1, 1, 2, 2, 3, 4, 5]]                          // 포효·갑옷에 주황 금 → 무릎 → 뒤로 넘어짐 → 누움 → 검은 재 + 투구·망토·칼
        }),
        fxArt: {
          shockwave: { frames: seq(EN + 'shockwave/shockwave_', 5), pivot: { x: 120, y: 116 }, fps: 12 }   // 불꽃 고리(고리 가운데 기준, 한 크기로 그림 → 코드에서 늘림)
        },
        walkAnim: 'walk',
        walkStride: 32,   // 보폭 걷기(enemies.js stepWalk): 걷기 6장 한 바퀴에 가는 그림 점. 7.5fps 쯤 (3장이 원본에서 1점 뜨지만 줄인 그림에서는 바닥에 닿아 높이 맞춤 안 함)
        // 체력·데미지: 자동 조종(?bot=1, 피하지 않음) 시험에서 8단계 흡혈 백작보다 조금 버겁게 맞춤(그림 자료 제안 hp 1250 보다 낮춤, 판 배율 x1.6)
        hp: 1150, speedX: 30, speedY: 22, radius: 42, height: 165,
        hurtbox: { x0: -44, x1: 40, yTop: -162, yBot: 0 },
        engage: 76, hover: [80, 110], range: [30, 440], alignY: 10, cooldown: [1000, 1800], firstCooldown: [1200, 1500],
        knockResist: 0.2, deathKnock: 40,
        staggerCdMs: 2200,
        superArmor: true,
        stagger: { at: [0.66, 0.33], onWall: true, d: [280, 140, 1000, 300], hurtbox: { x0: -60, x1: 38, yTop: -128, yBot: 0 } },
        enrageAt: 0.5,
        rageColor: '#ff3a10',   // 분노 불꽃 색(2026-11-06 밤, config ai.rage)
        enrage: { speedMul: 1.25, cooldownMul: 0.7, summon: ['soldier', 'mage', 'soldier'] },
        attacks: {
          combo:     { anim: 'attack1', active: [2, 4], multiHit: true, telegraph: [1], depth: 16,
                       reach: { x0: 20, x1: 172, yTop: -160, yBot: 0 },
                       reachF: { 2: { x0: 20, x1: 90, yTop: -160, yBot: 0 }, 4: { x0: 30, x1: 172, yTop: -140, yBot: -95 } },
                       dmg: [14, 17], knock: 26, flinchMs: 420, shake: 1.8, when: [30, 175], weight: 3 },
          dash:      { type: 'charge', anim: 'attack2', frames: { wind: [1], run: [2, 3], impact: [4], recover: [5] },
                       windMs: 650, stepMs: 90, speed: 560, dist: 560, impactMs: 220, recoverMs: 380,
                       bodyReach: { x0: -10, x1: 108, yTop: -140, yBot: 0 }, reach: { x0: 50, x1: 108, yTop: -122, yBot: -80 }, depth: 16,
                       dmg: [16, 19], knock: 44, flinchMs: 520, shake: 2.6, dustMs: 90, when: [140, 440], weight: 2, heavy: true, gapMs: 5000 },
          shockwave: { type: 'shockwave', anim: 'special', telegraph: [1, 2], spawnFrame: 3, holdFrame: 4, fx: 'shockwave', spawn: { x: 10, y: 0 },
                       rings: { count: 2, gapMs: 800, r0: 24, rMax: 280, speed: 260, band: 16, ryMax: 25, ringRx: 105, flameScale: 0.75, dodgeZ: 22 },
                       enraged: { count: 3 },
                       dmg: [13, 16], knock: 30, flinchMs: 450, heavy: true, shake: 2.2, when: [0, 320], weight: 2, gapMs: 6000, firstMs: 4000 }
        }
      },

      // ===== 10단계 적 (art\stage10-enemies 에서 복사, 2026-11-04). 수치 = 그 폴더 anchors_demonking.json 의 suggest (체력만 낮춤) =====
      // 마왕(10단계 = 마지막 보스): 다른 보스와 같은 규칙(공격 중 안 끊김, 체력 75%·25% 휘청) + 절반에서 「각성」(화남 대신, 아래 awaken)
      //   그림 칸 304x280(가로 베기가 앞 164 까지, 칼·빛줄기가 265 높이), 그림은 녹색 바탕에서 뽑아 분홍 룬이 살아 있는 그림만 씀
      //   효과 그림 폴더는 king* (assets/enemies/orb 는 9단계 흑마법사 것이라 이름이 겹침): kingwave 초승달 파동 · kingorb 암흑 구슬 · kingblast 터짐 · kingaura 각성 오라
      //   휘청 3장 = 칼 짚고 한 무릎, 고개 숙임 = 때릴 기회(1100ms, stagger.hurtbox)
      //   공격: combo = 대검 세 번(1장 칼을 머리 뒤로, 룬이 타오름 = 예고 500ms → 2장 대각선 내려베기 reachF[2] → 3장 가로 베기 reachF[3] 앞 164 까지
      //           → 4장 칼끝을 땅에 꽂음 reachF[4], heavyOn = 이 장만 넘어뜨림 + 크게 흔들림). multiHit = 장마다 한 번씩
      //         wave = 초승달 파동(총알과 같은 type 'shot', 높이 0 = 바닥을 따라 미끄러짐): 1~2장 칼에 불이 붙음(예고 ~670ms, 바닥 빨간 띠 = 지나갈 줄)
      //           → 3장 올려 베기 = 발 앞(spawn)에서 파동이 나감. pierce = 맞혀도 안 사라지고 끝까지(한 번만 아픔). 피하기 = 줄 바꾸기 / 뛰어넘기(dodgeZ)
      //           projLoop = 날아가는 동안 2·3장 반복(처음 1장), projEnd = 끝에서 4장(흩어짐). enraged = 각성 뒤 두 개(gapMs 씩 늦게, 같은 줄)
      //         orbs = 암흑 구슬 비(선장 대포 사격과 같은 type 'barrage'): 1~2장 손바닥에 구슬(예고) → 3장 하늘로 빛줄기 = 구슬 count 개를 intervalMs 마다
      //           떨어질 자리 = 그림자 + 빨간 원 → fallMs 뒤 쾅(proj = 떨어지는 그림, blast = 터지는 그림). enraged = 각성 뒤 수·간격
      //         teleport = 어둠 순간이동(흡혈 백작 안개 순간이동과 같은 type 'teleport', 물기 없음): vanish(1 망토로 감쌈 = 예고 · 2 검은 연기 기둥, 안 맞음)
      //           → 숨음(hiddenMs) → 플레이어 등 뒤 behind(화면 밖이면 앞) 같은 줄 → gatherMs 동안 검은 연기가 모이고 바닥 빨간 원(예고, 자리 고정)
      //           → appear(1 연기에서 빚어짐 = 안 맞음 · 2 칼을 치켜든 채 나옴 = 예고) → then = 대검 세 번(combo)을 thenFrame(2장 내려베기)부터
      //           smokeCols = 사라지고 나타날 때 연기 조각 색. enraged.useGapMs = 각성 뒤 더 자주
      //   awaken = 각성(체력 enrageAt 아래로 처음 내려가는 타에서): 하던 일을 멈추고 awaken 그림(1250ms) 동안 안 맞음, 2장에서 플레이어를 push 만큼 밀어냄,
      //     main.js 가 「마왕이 각성했다!」 + 화면 번쩍(flash)·흔들림(shake) + 졸개 부름(enrage.summon). 끝나면 enrage(빨라짐·자주 공격) + 등 뒤 오라(aura) + 테두리(rim)
      //     aura = fxArt.aura 를 기준점(발)에 scale 배, alpha 로, 'lighter'(더하기) 로 그림 → 붉은 옥좌실 배경에서도 보랏빛으로 빛남
      //   finalBoss = 마지막 보스: 쓰러뜨리면 보통 클리어 대신 엔딩(main.js onBossDown·showResult), 쓰러진 그림(재 + 왕관 + 대검)이 사라지지 않음
      demonking: {
        label: '마왕', boss: true, finalBoss: true, frameW: 304, frameH: 280, pivot: { x: 176, y: 272 },
        anims: enemyAnims('demonking', {
          idle: [4, 5, true], walk: [6, 7, true],
          attack1: [5, 10, false, [1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5, 5]],   // 대검 세 번: 1 치켜듦·룬(예고 500ms) · 2 내려베기 · 3 가로 베기 · 4 땅에 꽂음(무거움) · 5 복귀
          attack2: [5, 9, false, [1, 1, 2, 2, 2, 2, 3, 4, 4, 5]],               // 파동: 1 웅크림 · 2 칼에 불(예고) · 3 올려 베기 = 파동 · 4 칼 높이 · 5 복귀
          special: [5, 8, false, [1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 5]],            // 구슬 비: 1 손 듦 · 2 손바닥 위 구슬(예고) · 3 하늘로 빛줄기 = 구슬 · 4 가리킴 · 5
          awaken: [4, 8, false, [1, 1, 2, 2, 3, 3, 3, 3, 4, 4]],                // 각성: 1 웅크림·갑옷에 금 · 2 팔 벌려 포효(밀어냄) · 3 거대한 불꽃 오라 · 4 칼 치켜듦
          vanish: [2, 8, false, [1, 1, 1, 2, 2, 2]],                            // 사라짐: 1 망토로 감쌈(예고) · 2 검은 연기 기둥(붉은 눈, 안 맞음)
          appear: [2, 8, false, [1, 1, 1, 2, 2, 2]],                            // 나타남: 1 연기에서 빚어짐(안 맞음) · 2 칼 치켜들고 나옴(예고)
          hit: [3, 8, false, [1, 2, 2, 3]],
          hit2: [3, 8, false, [1, 1, 2, 2, 3]],
          stagger: [4, 7, false, null],                                          // 휘청: 장마다 시간은 아래 stagger.d (3장 = 칼 짚고 한 무릎)
          death: [6, 6, false, [1, 1, 2, 2, 3, 3, 4, 5, 6]]                      // 하늘에 비명·금빛 금 → 무릎 · 칼 떨굼 → 왕관이 날아감·재로 → 재 석상 → 빈 망토 → 재 + 왕관 + 대검
        }),
        fxArt: {
          wave:   { frames: seq(EN + 'kingwave/wave_', 4),     pivot: { x: 36, y: 112 }, fps: 14 },   // 초승달 파동(바닥 가운데 기준, 볼록한 앞이 왼쪽)
          orb:    { frames: seq(EN + 'kingorb/orb_', 4),       pivot: { x: 24, y: 94 },  fps: 12 },   // 떨어지는 암흑 구슬(구슬 가운데 기준, 위로 불꽃 꼬리)
          impact: { frames: seq(EN + 'kingblast/impact_', 5),  pivot: { x: 68, y: 156 }, fps: 12 },   // 구슬 터짐(바닥 가운데 기준, 한 번)
          aura:   { frames: seq(EN + 'kingaura/aura_', 4),     pivot: { x: 64, y: 212 }, fps: 10 }    // 각성 오라(마왕 발에 맞춤, 반복)
        },
        walkAnim: 'walk',
        walkStride: 37, walkDy: [2, 0, 0, 0, 0, 0],   // 보폭 걷기(enemies.js stepWalk): 걷기 6장 한 바퀴에 가는 그림 점. 7.5fps 쯤, walkDy = 1장이 2점 떠 있음
        // 체력·데미지: 자동 조종(?bot=1) 시험에서 9단계 마왕군 장군보다 조금 버겁게 맞춤(그림 자료 제안 hp 1600 보다 낮춤, 판 배율 x1.7)
        hp: 1100, speedX: 34, speedY: 24, radius: 46, height: 178,
        hurtbox: { x0: -36, x1: 34, yTop: -176, yBot: 0 },
        engage: 80, hover: [80, 110], range: [40, 170], alignY: 10, cooldown: [950, 1700], firstCooldown: [1400, 1700],
        knockResist: 0.15, deathKnock: 0,
        staggerCdMs: 2400,
        superArmor: true,
        stagger: { at: [0.75, 0.25], onWall: false, d: [280, 160, 1100, 320], hurtbox: { x0: -55, x1: 84, yTop: -124, yBot: 0 } },
        enrageAt: 0.5,
        enrage: { speedMul: 1.2, cooldownMul: 0.75, summon: [['soldier', { variant: 'abyss' }], ['mage', { variant: 'abyss' }]] },
        awaken: { anim: 'awaken', pushFrame: 2, push: 60, shake: 3.5, flash: '#ff3a8c',
                  aura: { art: 'aura', scale: 1.3, alpha: 0.85, fadeInMs: 300 }, rim: { color: '#ff2a6a', px: 1, alpha: 0.6 } },
        attacks: {
          combo:    { anim: 'attack1', active: [2, 3, 4], multiHit: true, telegraph: [1], depth: 18,
                      reach: { x0: 20, x1: 164, yTop: -140, yBot: 0 },
                      reachF: { 2: { x0: 20, x1: 114, yTop: -135, yBot: -3 }, 3: { x0: 40, x1: 164, yTop: -138, yBot: -92 }, 4: { x0: 30, x1: 96, yTop: -100, yBot: 5 } },
                      heavyOn: [4], heavyShake: 2.6,
                      dmg: [14, 18], knock: 28, flinchMs: 420, shake: 1.8, when: [40, 165], weight: 3 },
          wave:     { type: 'shot', anim: 'attack2', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 110, y: 0 }, aimH: 0, dropPx: 0,
                      proj: 'wave', projLoop: [2, 3], projEnd: 4, impact: null, muzzle: null, pierce: true,
                      hitCols: ['#1a0a1e', '#6a1a5a', '#ff3a8c', '#ffd0f0'],
                      speed: 300, range: 480, box: { w: 34, h: 100 }, depth: 16, dodgeZ: 24,
                      enraged: { count: 2, lanes: [0, 0], gapMs: 200, scale: [1, 1] },
                      dmg: [14, 18], knock: 26, flinchMs: 420, shake: 1.4, when: [120, 480], weight: 2 },
          orbs:     { type: 'barrage', anim: 'special', telegraph: [1, 2], spawnFrame: 3, count: 6, intervalMs: 220, fallMs: 850, dropHeight: 300,
                      proj: 'orb', blast: 'impact', blastCols: ['#ff3a8c', '#a01a6a', '#2a0a2a', '#ffd0f0'],
                      spread: { x: 70, y: 16 }, radius: 46, depth: 16, dodgeZ: 24, holdMs: 250, gapMs: 9000, firstMs: 4500,
                      enraged: { count: 9, intervalMs: 180 },
                      dmg: [15, 19], knock: 30, flinchMs: 450, heavy: true, shake: 2.2, when: [60, 600], weight: 2 },
          teleport: { type: 'teleport', anim: 'vanish', appearAnim: 'appear', telegraph: [1], invuln: [2],
                      hiddenMs: 400, gatherMs: 350, behind: 90, lunge: 0, depth: 18,
                      reach: { x0: 20, x1: 114, yTop: -135, yBot: -3 },   // 빨간 원 자리 = 이어지는 대검 첫 타(reachF[2])
                      then: 'combo', thenFrame: 2, smokeCols: ['#140814', '#3a1440', '#6a2a6a', '#ff3a6a'],
                      enraged: { useGapMs: 6000 },
                      when: [0, 999], weight: 1, gapMs: 9000, firstMs: 7000 }
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
    // 새 판 넣기: 아래 목록에 { id, … } 하나 추가하면 끝(스테이지 고르기 화면·다음 스테이지는 자동)
    //   id = 판 번호(고르기 화면 숫자 · 주소 ?stage=N 이 이 번호). 목록 순서 = 노는 순서(다음 스테이지 · 잠금 풀림은 목록 순서대로)
    //   → 번호를 건너뛰어도 됨(2026-11-04: 한동안 5단계 설산 그림이 없어서 목록 = 1 2 3 4 6 7 → 같은 날 6 앞에 { id: 5 } 끼움 = 1 2 3 4 5 6 7, 뒤에 8단계 유령 고성 · 9단계 마왕군 요새 · 10단계 마왕성 = 마지막 판)
    //   깬 판은 id 로 저장(main.js) → 5단계를 끼워도 예전 저장이 어긋나지 않음(4·6을 깨고 5는 안 깼으면: 6은 그대로 클리어, 5가 열림)
    // 지금 하고 있는 판은 main.js 가 CFG.stage(+ CFG.bg = 그 판 bg)에 넣어 둔다 → 다른 코드는 예전처럼 CFG.stage 를 읽음
    // 시험 기간(2026-11-04 형님): 스테이지 고르기에서 모든 판을 처음부터 열어 둠. 정식으로 낼 때 false
    //   (2026-11-06 난이도) 이것이 true 면 노말·하드도 처음부터 열림(시험용으로 난이도 바꾸기)
    stagesAllOpen: true,

    // ---------- 난이도 이지 / 노말 / 하드 (2026-11-06, 디아블로처럼. 형님 승인) ----------
    // 이지 = 지금 게임 그대로. 이지에서 마지막 판(10판 마왕)을 깨면 노말이 열리고, 노말에서 깨면 하드가 열림
    //   고르는 곳 = 스테이지 선택 화면 위 탭. 저장(growth.js) = 저장칸마다 지금 난이도 + 난이도마다 깬 판 목록 (예전 저장의 깬 판 = 이지)
    //   판 위 글자(HUD) = 「노말 · STAGE 3 …」. 시험: 주소 뒤 ?diff=normal / ?diff=hard = 이번 창에서만 그 난이도(잠금 무시)
    // 아래 배율은 전부 판 배율(stages 의 hpMul·dmgMul, 1판 1.0 → 10판 1.7)과 몹 떼(hunt.horde)에 「곱하기」로 더 얹음
    //   [1판 값, 10판 값] = 판 순서대로 고르게 바뀜(사이 판은 그 사이). 숫자 하나면 모든 판 같음
    //   hpMul / dmgMul = 적 체력·공격력 (잡몹·보스·중간보스 전부)
    //     → 1판은 크게, 10판은 덜 얹음: 노말 1판에 오는 플레이어(약 Lv23 · 기술 다 있음)가 이지 9~10판쯤 손맛,
    //       하드 1판(약 Lv40)은 노말 10판쯤 손맛. 끝 판은 그 레벨 플레이어(노말 ≈ Lv38, 하드 ≈ Lv55)에게 이지 10판보다 조금 더 어렵게
    //   count = 잡몹(경험치 종류 mob: 고블린·늑대·박쥐 …) 마리 수 배율(몹 떼 판별 배수에 곱함. 늘어난 몹은 약해지지 않음),
    //   countTough = 단단한 잡몹(해골·미라·설인·마족 병사 …) 마리 수 배율. 보스·정예·중간보스는 그대로 한 마리
    //   xp = 적 경험치 배율, drop = 잡몹 물약 떨어질 확률 배율(potions.mob·tough 에 곱함)
    //   경험치 고른 법(성장 growth: 다음 레벨까지 = 10 + 40 x 레벨 → Lv23 까지 합 10,340 · Lv40 31,590 · Lv57 64,400):
    //     이지 한 번 = 10,920 (중간보스 포함) → Lv23. 노말은 마리 수(잡몹 1.5배·단단한 1.3배)만으로 한 번 = 약 12,800 → x1.65 = 21,150 → 합 32,070 = Lv40
    //     하드는 마리 수(2배·1.6배)만으로 약 15,650 → x2.15 = 33,640 → 합 65,720 = Lv57 (각 난이도를 순서대로 한 번씩, 안 죽고 깼을 때.
    //     자동 조종 시험 판 경험치와 셈이 딱 맞음. 죽고 다시 하면 그만큼 더 높아짐)
    //   체력·공격 고른 법(자동 조종 기사, 능력치 자동 배분·기술 계획대로, 판 끝 남은 체력): 이지 9판 Lv19 77% · 이지 10판 Lv21 60%
    //     → 노말 1판 Lv23 64% · 노말 10판 Lv38 48% · 하드 1판 Lv40 61% · 하드 10판 Lv55 65% (2번씩 평균, 안 쓰러짐)
    modes: {
      order: ['easy', 'normal', 'hard'],
      easy:   { name: '이지', hpMul: 1, dmgMul: 1, count: 1, countTough: 1, xp: 1, drop: 1 },
      normal: { name: '노말', hpMul: [2.1, 1.6], dmgMul: [2.0, 1.55], count: 1.5, countTough: 1.3, xp: 1.65, drop: 1.25 },
      hard:   { name: '하드', hpMul: [3.0, 2.8], dmgMul: [2.8, 2.6], count: 2, countTough: 1.6, xp: 2.15, drop: 1.5 }
    },
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
      // ===== 3단계: 늪지대 (2026-11-04 새 그림: 배경·소품·도마뱀 전사·거대 두꺼비) =====
      // 2단계와 4단계 사이(체력·공격 x1.15): 새 적 도마뱀 전사(긴 창·달려들기) + 박쥐·고블린·늪 해골(색만 바꿈) 섞음,
      //   가마솥 둘레에 미리 서 있는 무리 3곳 + 옆에서 지원, 보스 = 거대 두꺼비(배치기·혀 채찍·독 웅덩이)
      {
        id: 3,
        name: 'STAGE 3  늪지대',
        width: 2880,
        healOnClear: 12,
        bgTop: '#5d6c65',           // 화면이 배경보다 높을 때 위쪽 색 (실제로는 배경 맨 윗줄 = 회녹색 안개를 늘려 씀)
        bg: BG_SWAMP,
        hpMul: 1.15, dmgMul: 1.15,
        waves: [
          // 1: 늪 가장자리 — 도마뱀 전사 첫 등장
          { at: 120,  spawn: [['lizard', 'R', 0], ['goblin', 'R', 900], ['bat', 'L', 2200]] },
          // 2: 가마솥(500 + 326) 옆에 도마뱀 + 고블린(camp1, 하나 깨면 둘 다 깸) + 옆에서 지원
          { at: 500,  placed: [['lizard', 288, 0.36, { group: 'camp1', dir: 1 }], ['goblin', 364, 0.58, { group: 'camp1' }]],
                      spawn: [['bat', 'R', 700], ['lizard', 'L', 2400]] },
          { at: 880,  spawn: [['skeleton', 'R', 0, { variant: 'bog' }], ['lizard', 'L', 500], ['bat', 'R', 1300], ['goblin', 'L', 3200], ['lizard', 'R', 3800]] },
          // 4: 수상 마을 가마솥(1260 + 330) 둘레에 도마뱀 둘 + 늪 해골(camp2) + 옆에서 지원
          { at: 1260, placed: [['lizard', 292, 0.34, { group: 'camp2', dir: 1 }], ['skeleton', 372, 0.44, { group: 'camp2', variant: 'bog' }], ['lizard', 340, 0.8, { group: 'camp2' }]],
                      spawn: [['bat', 'R', 1200, { variant: 'bog' }], ['goblin', 'L', 3400], ['lizard', 'R', 4200]] },
          { at: 1650, spawn: [['lizard', 'R', 0], ['bat', 'L', 400], ['goblin', 'R', 1000], ['skeleton', 'L', 2800, { variant: 'bog' }], ['lizard', 'R', 3400]] },
          // 6: 제단 앞 가마솥(2040 + 332)을 지키는 도마뱀 둘(shrine) + 옆에서 지원
          { at: 2040, placed: [['lizard', 296, 0.3, { group: 'shrine', dir: 1 }], ['lizard', 368, 0.66, { group: 'shrine' }]],
                      spawn: [['bat', 'R', 600, { variant: 'bog' }], ['goblin', 'L', 1000], ['skeleton', 'R', 2800], ['lizard', 'L', 3400], ['bat', 'R', 4000]] },
          { at: 'end', boss: true, spawn: [['toad', 'R', 0]] }
        ],
        // 소품: 이끼 그루터기·갈대 뚜껑 항아리(부서짐) + 늪 가마솥 3개(장식, 무리 자리). 보스 앞 그루터기는 고기가 꼭 나옴
        props: [
          { type: 'stump',    x: 430,  y: 0.72 },
          { type: 'pot',      x: 700,  y: 0.22 },
          { type: 'cauldron', x: 500 + 326, y: 0.47 },
          { type: 'stump',    x: 1150, y: 0.7 },
          { type: 'pot',      x: 1480, y: 0.26, drop: 'bread' },
          { type: 'cauldron', x: 1260 + 330, y: 0.56 },
          { type: 'pot',      x: 1860, y: 0.32 },
          { type: 'cauldron', x: 2040 + 332, y: 0.48 },
          { type: 'stump',    x: 2250, y: 0.78, drop: 'meat' }    // 6번 웨이브 화면 = 보스방 바로 앞
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
      },
      // ===== 5단계: 눈 덮인 산 (2026-11-04 새 그림: 배경·소품·설인·서리 거인, 얼음 늑대 = 1단계 늑대 색 바꿈) =====
      // 4단계와 6단계 사이(체력·공격 x1.25): 새 적 설인(느리고 단단, 두 주먹 내려찍기) + 얼음 늑대 + 해골·도마뱀·고블린·총잡이(조금) 섞음,
      //   눈밭 모닥불 둘레에 미리 서 있는 무리 3곳 + 옆에서 지원, 보스 = 서리 거인(몽둥이 내려찍기·휘두르기·얼음 가시 줄)
      {
        id: 5,
        name: 'STAGE 5  눈 덮인 산',
        width: 2880,
        healOnClear: 13,
        bgTop: '#aecaf1',           // 화면이 배경보다 높을 때 위쪽 하늘 색 (실제로는 배경 맨 윗줄 = 옅은 찬 하늘색을 늘려 씀)
        bg: BG_SNOW,
        hpMul: 1.25, dmgMul: 1.25,
        waves: [
          // 1: 소나무 숲 가장자리 — 설인 첫 등장
          { at: 120,  spawn: [['yeti', 'R', 0], ['goblin', 'R', 900], ['wolf', 'L', 2200, { variant: 'ice' }]] },
          // 2: 모닥불(500 + 326) 옆에 설인 + 얼음 늑대(camp1, 하나 깨면 둘 다 깸) + 옆에서 지원
          { at: 500,  placed: [['yeti', 288, 0.36, { group: 'camp1', dir: 1 }], ['wolf', 364, 0.58, { group: 'camp1', variant: 'ice' }]],
                      spawn: [['goblin', 'L', 700], ['wolf', 'R', 2200, { variant: 'ice' }]] },
          { at: 880,  spawn: [['skeleton', 'R', 0], ['yeti', 'L', 500], ['wolf', 'R', 1300, { variant: 'ice' }], ['lizard', 'L', 3200], ['goblin', 'R', 3800]] },
          // 4: 감시탑 아래 모닥불(1260 + 330) 둘레에 설인 + 해골 + 얼음 늑대(camp2) + 옆에서 지원(총잡이 하나)
          { at: 1260, placed: [['yeti', 292, 0.34, { group: 'camp2', dir: 1 }], ['skeleton', 372, 0.42, { group: 'camp2' }], ['wolf', 340, 0.8, { group: 'camp2', variant: 'ice' }]],
                      spawn: [['gunner', 'R', 1200], ['yeti', 'L', 3400], ['wolf', 'R', 4200, { variant: 'ice' }]] },
          { at: 1650, spawn: [['yeti', 'R', 0], ['lizard', 'L', 400], ['wolf', 'R', 1000, { variant: 'ice' }], ['skeleton', 'L', 2800], ['yeti', 'R', 3400]] },
          // 6: 설인 동굴 앞 모닥불(2040 + 332)을 지키는 설인 둘(cave) + 옆에서 지원
          { at: 2040, placed: [['yeti', 296, 0.3, { group: 'cave', dir: 1 }], ['yeti', 368, 0.66, { group: 'cave' }]],
                      spawn: [['wolf', 'R', 600, { variant: 'ice' }], ['goblin', 'L', 1000], ['gunner', 'R', 2800], ['lizard', 'L', 3400], ['wolf', 'R', 4000, { variant: 'ice' }]] },
          { at: 'end', boss: true, spawn: [['giant', 'R', 0]] }
        ],
        // 소품: 얼음 속 술통·눈 덮인 보급 상자(부서짐) + 가죽 천막 모닥불 3개(장식, 무리 자리). 보스 앞 술통은 고기가 꼭 나옴
        props: [
          { type: 'icebarrel', x: 430,  y: 0.72 },
          { type: 'snowcrate', x: 700,  y: 0.22 },
          { type: 'snowcamp',  x: 500 + 326, y: 0.47 },
          { type: 'icebarrel', x: 1150, y: 0.7 },
          { type: 'snowcrate', x: 1480, y: 0.26 },
          { type: 'snowcamp',  x: 1260 + 330, y: 0.56 },
          { type: 'snowcrate', x: 1860, y: 0.32, drop: 'bread' },
          { type: 'snowcamp',  x: 2040 + 332, y: 0.48 },
          { type: 'icebarrel', x: 2250, y: 0.78, drop: 'meat' }    // 6번 웨이브 화면 = 보스방 바로 앞
        ]
      },
      // ===== 6단계: 해적 항구 (2026-11-04 새 그림: 배경·소품·해적 총잡이·해적 선장) =====
      // 4단계보다 한 단계 어렵게(체력·공격 x1.3): 새 적 해적 총잡이(멀리서 쏨, 거리 두기) + 해골·도마뱀·고블린(일부 「해적」 색) 섞음,
      //   화덕 둘레에 미리 서 있는 무리 3곳 + 옆에서 지원, 보스 = 해적 선장(칼 두 번·권총·대포 일제 사격)
      {
        id: 6,
        name: 'STAGE 6  해적 항구',
        width: 2880,
        healOnClear: 14,            // 총알이 멀리서 조금씩 깎으므로 웨이브마다 조금 더 회복(4단계 12)
        bgTop: '#82538c',           // 화면이 배경보다 높을 때 위쪽 하늘 색 (실제로는 배경 맨 윗줄 = 해질녘 보라를 늘려 씀)
        bg: BG_HARBOR,
        hpMul: 1.3, dmgMul: 1.3,
        waves: [
          // 1: 항구 마을 입구 — 해적 총잡이 첫 등장(앞에서 해골이 막고 뒤에서 쏨)
          { at: 120,  spawn: [['skeleton', 'R', 0, { variant: 'pirate' }], ['gunner', 'R', 700], ['goblin', 'L', 2200, { variant: 'pirate' }]] },
          // 2: 화덕(500 + 326) 옆에 총잡이 + 해적 고블린(camp1, 하나 깨면 둘 다 깸) + 옆에서 지원
          { at: 500,  placed: [['goblin', 288, 0.36, { group: 'camp1', dir: 1, variant: 'pirate' }], ['gunner', 364, 0.58, { group: 'camp1' }]],
                      spawn: [['lizard', 'L', 700], ['skeleton', 'R', 2400, { variant: 'pirate' }]] },
          { at: 880,  spawn: [['gunner', 'R', 0], ['lizard', 'L', 500], ['goblin', 'R', 1300, { variant: 'pirate' }], ['skeleton', 'L', 3000], ['goblin', 'R', 3600, { variant: 'pirate' }]] },
          // 4: 해적선 앞 화덕(1260 + 330) 둘레에 해적 해골 + 도마뱀 + 총잡이(camp2) + 옆에서 지원
          { at: 1260, placed: [['skeleton', 292, 0.34, { group: 'camp2', dir: 1, variant: 'pirate' }], ['gunner', 372, 0.44, { group: 'camp2' }], ['lizard', 340, 0.8, { group: 'camp2' }]],
                      spawn: [['goblin', 'R', 1200, { variant: 'pirate' }], ['gunner', 'L', 3400], ['skeleton', 'R', 4200, { variant: 'pirate' }]] },
          { at: 1650, spawn: [['lizard', 'R', 0], ['gunner', 'L', 400], ['skeleton', 'R', 1000, { variant: 'pirate' }], ['goblin', 'L', 2800, { variant: 'pirate' }], ['goblin', 'R', 3400]] },
          // 6: 요새 부두 화덕(2040 + 332)을 지키는 총잡이 둘(dock) + 옆에서 지원
          { at: 2040, placed: [['gunner', 296, 0.3, { group: 'dock', dir: 1 }], ['gunner', 368, 0.66, { group: 'dock' }]],
                      spawn: [['skeleton', 'R', 600, { variant: 'pirate' }], ['goblin', 'L', 1000], ['goblin', 'R', 2800, { variant: 'pirate' }], ['skeleton', 'L', 3400], ['skeleton', 'R', 4000, { variant: 'pirate' }]] },
          { at: 'end', boss: true, spawn: [['captain', 'R', 0]] }
        ],
        // 소품: 럼주 통·그물 화물 상자(부서짐) + 부두 화덕 3개(장식, 무리 자리). 보스 앞 럼주 통은 고기가 꼭 나옴
        props: [
          { type: 'rumbarrel', x: 430,  y: 0.72 },
          { type: 'netcrate',  x: 700,  y: 0.22 },
          { type: 'firepan',   x: 500 + 326, y: 0.47 },
          { type: 'rumbarrel', x: 1150, y: 0.7 },
          { type: 'netcrate',  x: 1480, y: 0.26 },
          { type: 'firepan',   x: 1260 + 330, y: 0.56 },
          { type: 'netcrate',  x: 1860, y: 0.32, drop: 'bread' },
          { type: 'firepan',   x: 2040 + 332, y: 0.48 },
          { type: 'rumbarrel', x: 2250, y: 0.78, drop: 'meat' }    // 6번 웨이브 화면 = 보스방 바로 앞
        ]
      },
      // ===== 7단계: 화산 (2026-11-04 새 그림: 배경·소품·불 도깨비·붉은 와이번, 용암 골렘 = 2단계 골렘 색 바꿈) =====
      // 6단계보다 한 단계 어렵게(체력·공격 x1.4): 새 적 불 도깨비(치고 빠지기 + 불덩이) + 해골·도마뱀·미라·총잡이 섞음,
      //   용암 구멍 둘레에 미리 서 있는 무리 3곳 + 옆에서 지원, 5번 웨이브 = 용암 골렘(정예, 보스 아님), 보스 = 붉은 와이번(물기·불 뿜기·내리꽂기)
      {
        id: 7,
        name: 'STAGE 7  화산',
        width: 2880,
        healOnClear: 18,            // 불덩이가 멀리서 조금씩 깎고 5번 웨이브 용암 골렘이 아프므로 웨이브마다 조금 더 회복(6단계 14)
        bgTop: '#5c181d',           // 화면이 배경보다 높을 때 위쪽 하늘 색 (실제로는 배경 맨 윗줄 = 짙은 재빛 빨강을 늘려 씀)
        bg: BG_VOLCANO,
        hpMul: 1.4, dmgMul: 1.4,
        waves: [
          // 1: 흑요석 첨탑 — 불 도깨비 첫 등장(해골이 앞을 막음)
          { at: 120,  spawn: [['imp', 'R', 0], ['skeleton', 'R', 700], ['imp', 'L', 2200]] },
          // 2: 용암 구멍(500 + 326) 옆에 도깨비 + 도마뱀(camp1, 하나 깨면 둘 다 깸) + 옆에서 지원
          { at: 500,  placed: [['imp', 288, 0.36, { group: 'camp1', dir: 1 }], ['lizard', 364, 0.58, { group: 'camp1' }]],
                      spawn: [['goblin', 'L', 700], ['imp', 'R', 2400]] },
          { at: 880,  spawn: [['imp', 'R', 0], ['mummy', 'L', 500], ['gunner', 'R', 1300], ['skeleton', 'L', 3000], ['goblin', 'R', 3600]] },
          // 4: 폐허 신전 용암 구멍(1260 + 330) 둘레에 도깨비 둘 + 해골(camp2) + 옆에서 지원
          { at: 1260, placed: [['imp', 292, 0.34, { group: 'camp2', dir: 1 }], ['skeleton', 372, 0.44, { group: 'camp2' }], ['imp', 340, 0.8, { group: 'camp2' }]],
                      spawn: [['lizard', 'R', 1200], ['imp', 'L', 3400], ['goblin', 'R', 4200]] },
          // 5: 대장간 앞 — 용암 골렘(정예) + 도깨비 둘
          { at: 1650, spawn: [['lavagolem', 'R', 0], ['imp', 'L', 2500], ['imp', 'R', 6000]] },
          // 6: 용의 둥지 입구 용암 구멍(2040 + 332)을 지키는 도깨비 둘(lair) + 옆에서 지원
          { at: 2040, placed: [['imp', 296, 0.3, { group: 'lair', dir: 1 }], ['imp', 368, 0.66, { group: 'lair' }]],
                      spawn: [['skeleton', 'R', 600], ['lizard', 'L', 1000], ['imp', 'R', 2800], ['goblin', 'L', 3400], ['imp', 'R', 4000]] },
          { at: 'end', boss: true, spawn: [['wyvern', 'R', 0]] }
        ],
        // 소품: 불씨 항아리·쇠테 광석 상자(부서짐) + 끓는 용암 구멍 3개(장식, 무리 자리). 보스 앞 항아리는 고기가 꼭 나옴
        props: [
          { type: 'firepot',   x: 430,  y: 0.72 },
          { type: 'orecrate',  x: 700,  y: 0.22 },
          { type: 'magmavent', x: 500 + 326, y: 0.47 },
          { type: 'firepot',   x: 1150, y: 0.7 },
          { type: 'orecrate',  x: 1480, y: 0.26 },
          { type: 'magmavent', x: 1260 + 330, y: 0.56 },
          { type: 'orecrate',  x: 1860, y: 0.32, drop: 'bread' },
          { type: 'magmavent', x: 2040 + 332, y: 0.48 },
          { type: 'firepot',   x: 2250, y: 0.78, drop: 'meat' }    // 6번 웨이브 화면 = 보스방 바로 앞
        ]
      },
      // ===== 8단계: 유령 고성 (2026-11-04 새 그림: 배경·소품·유령 기사·흡혈 백작) =====
      // 7단계보다 한 단계 어렵게(체력·공격 x1.5): 새 적 유령 기사(내려베기 + 옅어져 돌진 찌르기) + 해골·박쥐·미라(일부 「유령」 색) 섞음,
      //   푸른 유령불 화로 둘레에 미리 서 있는 무리 3곳 + 옆에서 지원, 5번 웨이브 = 유령 기사 셋 + 미라, 보스 = 흡혈 백작(발톱·박쥐 떼·안개 순간이동 물기)
      {
        id: 8,
        name: 'STAGE 8  유령 고성',
        width: 2880,
        healOnClear: 18,            // 7단계와 같음(박쥐 떼·물어 빨기가 아파서 더 어려워짐은 적 쪽에서)
        bgTop: '#23236a',           // 화면이 배경보다 높을 때 위쪽 하늘 색 (실제로는 배경 맨 윗줄 = 짙은 남보라 밤하늘을 늘려 씀)
        bg: BG_CASTLE,
        hpMul: 1.5, dmgMul: 1.5,
        waves: [
          // 1: 가고일 성문 — 유령 기사 첫 등장(유령 해골이 같이, 뒤에서 박쥐)
          { at: 120,  spawn: [['ghost', 'R', 0], ['skeleton', 'R', 700, { variant: 'spectral' }], ['bat', 'L', 2200]] },
          // 2: 유령불 화로(500 + 326) 옆에 유령 기사 + 유령 해골(camp1, 하나 깨면 둘 다 깸) + 옆에서 지원
          { at: 500,  placed: [['ghost', 288, 0.36, { group: 'camp1', dir: 1 }], ['skeleton', 364, 0.58, { group: 'camp1', variant: 'spectral' }]],
                      spawn: [['bat', 'L', 700, { variant: 'spectral' }], ['ghost', 'R', 2400]] },
          { at: 880,  spawn: [['ghost', 'R', 0], ['mummy', 'L', 500], ['bat', 'R', 1300], ['skeleton', 'L', 3000, { variant: 'spectral' }], ['ghost', 'R', 3600]] },
          // 4: 대연회장 유령불 화로(1260 + 330) 둘레에 유령 기사 둘 + 유령 미라(camp2) + 옆에서 지원
          { at: 1260, placed: [['ghost', 292, 0.34, { group: 'camp2', dir: 1 }], ['mummy', 372, 0.44, { group: 'camp2', variant: 'spectral' }], ['ghost', 340, 0.8, { group: 'camp2' }]],
                      spawn: [['bat', 'R', 1200, { variant: 'spectral' }], ['skeleton', 'L', 3400], ['ghost', 'R', 4200]] },
          // 5: 연회장 끝 — 유령 기사 셋이 몰려옴 + 미라
          { at: 1650, spawn: [['ghost', 'R', 0], ['ghost', 'L', 600], ['mummy', 'R', 2200, { variant: 'spectral' }], ['ghost', 'R', 4200], ['bat', 'L', 4800]] },
          // 6: 지하묘지 입구 유령불 화로(2040 + 332)를 지키는 유령 기사 둘(crypt) + 옆에서 지원
          { at: 2040, placed: [['ghost', 296, 0.3, { group: 'crypt', dir: 1 }], ['ghost', 368, 0.66, { group: 'crypt' }]],
                      spawn: [['skeleton', 'R', 600, { variant: 'spectral' }], ['mummy', 'L', 1000], ['bat', 'R', 2800, { variant: 'spectral' }], ['ghost', 'L', 3400], ['skeleton', 'R', 4000]] },
          { at: 'end', boss: true, spawn: [['vampire', 'R', 0]] }
        ],
        // 소품: 나무 관·청동 유골 항아리(부서짐) + 푸른 유령불 화로 3개(장식, 무리 자리). 보스 앞 관은 고기가 꼭 나옴
        props: [
          { type: 'coffin',    x: 430,  y: 0.72 },
          { type: 'bronzeurn', x: 700,  y: 0.22 },
          { type: 'ghostfire', x: 500 + 326, y: 0.47 },
          { type: 'coffin',    x: 1150, y: 0.7 },
          { type: 'bronzeurn', x: 1480, y: 0.26 },
          { type: 'ghostfire', x: 1260 + 330, y: 0.56 },
          { type: 'bronzeurn', x: 1860, y: 0.32, drop: 'bread' },
          { type: 'ghostfire', x: 2040 + 332, y: 0.48 },
          { type: 'coffin',    x: 2250, y: 0.78, drop: 'meat' }    // 6번 웨이브 화면 = 보스방 바로 앞
        ]
      },
      // ===== 9단계: 마왕군 요새 (2026-11-04 새 그림: 배경·소품·마족 병사·흑마법사·마왕군 장군) =====
      // 8단계보다 조금 더 어렵게(체력·공격 x1.6): 새 적 마족 병사(방패 막기 + 미늘창) · 흑마법사(멀리서 암흑 구체) +
      //   예전 적의 「마족」 색 정예(늑대·도마뱀 전사·설인, 체력·공격 조금 더),
      //   초록 불꽃 전쟁 화로 둘레에 미리 서 있는 무리 3곳 + 옆에서 지원, 보스 = 마왕군 장군(대검 두 번·돌진 찌르기·칼 꽂기 화염 충격파)
      {
        id: 9,
        name: 'STAGE 9  마왕군 요새',
        width: 2880,
        healOnClear: 18,            // 8단계와 같음
        bgTop: '#28233c',           // 화면이 배경보다 높을 때 위쪽 하늘 색 (실제로는 배경 맨 윗줄 = 짙은 폭풍 보라 하늘을 늘려 씀)
        bg: BG_FORTRESS,
        hpMul: 1.6, dmgMul: 1.6,
        waves: [
          // 1: 외성벽 — 마족 병사 첫 등장, 뒤에서 마족 늑대
          { at: 120,  spawn: [['soldier', 'R', 0], ['soldier', 'R', 900], ['wolf', 'L', 2400, { variant: 'demonic' }]] },
          // 2: 전쟁 화로(500 + 326) 옆에 마족 병사 + 흑마법사(camp1, 하나 깨면 둘 다 깸) + 옆에서 지원
          { at: 500,  placed: [['soldier', 288, 0.36, { group: 'camp1', dir: 1 }], ['mage', 364, 0.58, { group: 'camp1' }]],
                      spawn: [['soldier', 'L', 900], ['wolf', 'R', 2600, { variant: 'demonic' }]] },
          { at: 880,  spawn: [['mage', 'R', 0], ['soldier', 'L', 400], ['lizard', 'R', 1400, { variant: 'demonic' }], ['soldier', 'R', 3200], ['soldier', 'L', 3800]] },
          // 4: 군영 전쟁 화로(1260 + 330) 둘레에 마족 병사 둘 + 흑마법사(camp2) + 옆에서 지원(마족 설인)
          { at: 1260, placed: [['soldier', 292, 0.34, { group: 'camp2', dir: 1 }], ['mage', 372, 0.44, { group: 'camp2' }], ['soldier', 340, 0.8, { group: 'camp2' }]],
                      spawn: [['wolf', 'R', 1200, { variant: 'demonic' }], ['yeti', 'L', 3400, { variant: 'demonic' }], ['soldier', 'R', 4200]] },
          // 5: 군영 끝 — 병사 둘 + 마족 도마뱀 전사 + 마법사
          { at: 1650, spawn: [['soldier', 'R', 0], ['soldier', 'L', 500], ['lizard', 'R', 2200, { variant: 'demonic' }], ['mage', 'L', 3600]] },
          // 6: 내성문 전쟁 화로(2040 + 332)를 지키는 병사 둘 + 마법사(gate) + 옆에서 지원
          { at: 2040, placed: [['soldier', 296, 0.3, { group: 'gate', dir: 1 }], ['mage', 372, 0.62, { group: 'gate' }], ['soldier', 352, 0.86, { group: 'gate' }]],
                      spawn: [['lizard', 'R', 600, { variant: 'demonic' }], ['soldier', 'R', 2800], ['wolf', 'L', 3400, { variant: 'demonic' }]] },
          { at: 'end', boss: true, spawn: [['general', 'R', 0]] }
        ],
        // 소품: 마왕군 보급 상자·흑철 화약통(부서짐) + 초록 불꽃 전쟁 화로 3개(장식, 무리 자리). 보스 앞 상자는 고기가 꼭 나옴
        props: [
          { type: 'siegecrate', x: 430,  y: 0.72 },
          { type: 'powderkeg',  x: 700,  y: 0.22 },
          { type: 'warbrazier', x: 500 + 326, y: 0.47 },
          { type: 'siegecrate', x: 1150, y: 0.7 },
          { type: 'powderkeg',  x: 1480, y: 0.26 },
          { type: 'warbrazier', x: 1260 + 330, y: 0.56 },
          { type: 'powderkeg',  x: 1860, y: 0.32, drop: 'bread' },
          { type: 'warbrazier', x: 2040 + 332, y: 0.48 },
          { type: 'siegecrate', x: 2250, y: 0.78, drop: 'meat' }    // 6번 웨이브 화면 = 보스방 바로 앞
        ]
      },
      // ===== 10단계: 마왕성 (2026-11-04 새 그림: 배경·소품·마왕) = 마지막 판 =====
      // 9단계보다 조금 더 어렵게(체력·공격 x1.7): 새 잡몹 없이 지금까지 가장 센 적들의 정예 색(마족 병사·흑마법사·유령 기사는 「심연」,
      //   늑대·설인·도마뱀 전사는 「마족」, 미라는 「유령」) + 불 도깨비, 보랏빛 영혼불 둘레에 미리 서 있는 무리 3곳 + 옆에서 지원.
      //   보스 = 마왕(대검 세 번·초승달 파동·암흑 구슬 비·어둠 순간이동, 절반에서 각성). 보스방 앞에 음식을 넉넉히(고기 둘 + 빵)
      //   (예전 보스를 색만 바꾼 중간 보스는 안 넣음: 9단계에서 용암 골렘이 너무 세서 뺐던 것과 같은 이유)
      {
        id: 10,
        name: 'STAGE 10  마왕성',
        width: 2880,
        healOnClear: 18,            // 9단계와 같음
        bgTop: '#220209',           // 화면이 배경보다 높을 때 위쪽 하늘 색 (실제로는 배경 맨 윗줄 = 검붉은 하늘을 늘려 씀)
        bg: BG_DEMONCASTLE,
        hpMul: 1.7, dmgMul: 1.7,
        waves: [
          // 1: 흑요석 대전당 입구 — 심연 병사 둘 + 뒤에서 불 도깨비
          { at: 120,  spawn: [['soldier', 'R', 0, { variant: 'abyss' }], ['soldier', 'L', 900], ['imp', 'R', 2200]] },
          // 2: 영혼불(500 + 326) 옆에 심연 병사 + 심연 마법사(camp1, 하나 깨면 둘 다 깸) + 옆에서 지원
          { at: 500,  placed: [['soldier', 288, 0.36, { group: 'camp1', dir: 1, variant: 'abyss' }], ['mage', 364, 0.58, { group: 'camp1', variant: 'abyss' }]],
                      spawn: [['ghost', 'L', 900, { variant: 'abyss' }], ['wolf', 'R', 2600, { variant: 'demonic' }]] },
          { at: 880,  spawn: [['yeti', 'R', 0, { variant: 'demonic' }], ['soldier', 'L', 400], ['imp', 'R', 1600], ['mummy', 'L', 3000, { variant: 'spectral' }], ['soldier', 'R', 3800]] },
          // 4: 심연 다리 영혼불(1260 + 330) 둘레에 심연 유령 기사 + 마법사 + 병사(camp2) + 옆에서 지원
          { at: 1260, placed: [['ghost', 292, 0.34, { group: 'camp2', dir: 1, variant: 'abyss' }], ['mage', 372, 0.44, { group: 'camp2' }], ['soldier', 340, 0.8, { group: 'camp2', variant: 'abyss' }]],
                      spawn: [['imp', 'R', 1200], ['yeti', 'L', 3400, { variant: 'demonic' }], ['soldier', 'R', 4200]] },
          // 5: 다리 끝 — 심연 병사 + 유령 기사 + 유령 미라 + 불 도깨비 + 마족 도마뱀 전사
          { at: 1650, spawn: [['soldier', 'R', 0, { variant: 'abyss' }], ['ghost', 'L', 500], ['mummy', 'R', 2200, { variant: 'spectral' }], ['imp', 'L', 3600], ['lizard', 'R', 4400, { variant: 'demonic' }]] },
          // 6: 옥좌실 문 영혼불(2040 + 332)을 지키는 근위대(gate: 심연 병사·마법사·유령 기사) + 옆에서 지원
          { at: 2040, placed: [['soldier', 296, 0.3, { group: 'gate', dir: 1, variant: 'abyss' }], ['mage', 372, 0.62, { group: 'gate', variant: 'abyss' }], ['ghost', 352, 0.86, { group: 'gate', variant: 'abyss' }]],
                      spawn: [['wolf', 'R', 800, { variant: 'demonic' }], ['imp', 'L', 2800]] },
          { at: 'end', boss: true, spawn: [['demonking', 'R', 0]] }
        ],
        // 소품: 흑금 항아리·저주받은 보물상자(부서짐) + 떠다니는 보랏빛 영혼불 3개(장식, 무리 자리). 보스방 앞 = 고기 둘 + 빵(넉넉히)
        props: [
          { type: 'goldurn',     x: 430,  y: 0.72 },
          { type: 'cursedchest', x: 700,  y: 0.22 },
          { type: 'soulflame',   x: 500 + 326, y: 0.47 },
          { type: 'goldurn',     x: 1150, y: 0.7, drop: 'bread' },
          { type: 'cursedchest', x: 1480, y: 0.26 },
          { type: 'soulflame',   x: 1260 + 330, y: 0.56 },
          { type: 'goldurn',     x: 1860, y: 0.32, drop: 'meat' },
          { type: 'soulflame',   x: 2040 + 332, y: 0.48 },
          { type: 'cursedchest', x: 2250, y: 0.78, drop: 'meat' },  // 6번 웨이브 화면 = 보스방 바로 앞
          { type: 'goldurn',     x: 2330, y: 0.2, drop: 'bread' }
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
      ember: { label: '붉은', hue: 270, sat: 1.2, bright: 0.95, dmgMul: 1.1 },  // 연두 오크 → 붉은 오크 (예전 임시 3단계 보스, 지금은 안 씀)
      // 3단계(2026-11-04): 흰 해골·보라 박쥐 → 이끼 낀 늪 빛(칙칙한 초록). 흰색·회색이 많아 color 로 물들임
      bog:   { label: '늪', hue: 0, sat: 0.85, bright: 0.95, color: '#7a9a4a', colorK: 0.36, hpMul: 1.1 },
      // 4단계(2026-11-04): 회색 늑대·흰 해골 → 모래 빛(누런 갈색). 회색·흰색이라 색상환 대신 color 로 물들임
      sand:  { label: '모래', hue: 0, sat: 0.9, bright: 1.0, color: '#d8a860', colorK: 0.38, hpMul: 1.1 },
      // 6단계(2026-11-04): 흰 해골·초록 고블린 → 바닷물에 전 「해적」 빛(칙칙한 푸른 회색). 흰색이 많아 color 로 물들임
      pirate: { label: '해적', hue: 0, sat: 0.8, bright: 0.92, color: '#4a6a94', colorK: 0.34, hpMul: 1.1 },
      // 7단계(2026-11-04): 회갈색 돌 골렘 → 「용암」 골렘(검은 현무암 몸 + 이끼 자리가 주황 용암으로 빛남)
      //   glow = 원래 그림에서 색상(hue, 도)이 이 범위이고 채도가 sat 넘는 점(골렘의 초록 이끼)을 color 로 바꿈(원래 밝기만큼, 어두운 몸 위에서 빛나 보이게)
      //     keep = 이 색상 범위의 진하고 밝은(가장 밝은 채널 light 이상) 점(가슴 주황 핵)은 어둡게 하지 않고 원래 색 그대로
      lava:  { label: '용암', hue: 0, sat: 0.15, bright: 0.5, color: '#3a1610', colorK: 0.35,
               glow: { hue: [48, 175], sat: 0.25, color: '#ff7a1e' }, keep: { hue: [8, 40], sat: 0.55, light: 150 } },
      // 8단계(2026-11-04): 흰 해골·보라 박쥐·붕대 미라 → 창백한 「유령」 빛(푸른 청록, 조금 밝게). 흰색이 많아 color 로 물들임
      spectral: { label: '유령', hue: 0, sat: 0.55, bright: 1.08, color: '#8fe8f0', colorK: 0.38, hpMul: 1.1 },
      // 9단계(2026-11-04): 회색 늑대·초록 도마뱀·흰 설인 → 검붉은 「마족」 빛(어둡게 + 진홍 덧칠). 정예라 체력 조금 더
      demonic: { label: '마족', hue: 0, sat: 0.9, bright: 0.82, color: '#a01828', colorK: 0.4, hpMul: 1.15 },
      // 10단계(2026-11-04): 마족 병사·흑마법사·유령 기사 → 마왕 근위대 「심연」 빛(어둡게 + 보랏빛 덧칠). 정예라 체력 조금 더
      abyss: { label: '심연', hue: 0, sat: 0.85, bright: 0.86, color: '#7a2ab0', colorK: 0.38, hpMul: 1.15 }
    },

    // ---------- 중간보스 (2026-11-06, 형님 승인) ----------
    // 판마다 하나, 보스방 바로 앞 웨이브(wave = 끝에서 몇 번째: 2 = 보스 바로 앞)에 그 판 잡몹을 크게 키운 「OO 대장」이 나옴. 새 그림 없음(있는 그림을 키우고 물들임)
    //   list = 판 id: [잡몹 종류, 이름, 색 변종(variants, 없으면 null)]. 잡몹 그림을 scale 배로 그리고 판정(몸·공격 상자·그림자)도 같이 키움
    //   tint = 더 어둡고 진하게(variant 와 같은 값: hue·sat·bright·color·colorK, 변종이 있으면 그 위에 bright 를 곱함), rim = 몸 둘레 빛나는 테두리
    //   hpBoss = 체력 = 그 판 보스 기본 체력 x 이 값(그다음 판 배율·변종·난이도 배율 곱함 → 1판 고블린 대장 450)
    //   dmgMul = 공격력 더(판·난이도 배율 위에), knock = 플레이어 밀림 배율, speed = 걷기 빠르기 배율
    //   heavy = 근접 공격에 맞으면 플레이어가 넘어짐, windMs = 공격 예고(치켜든 그림)를 이만큼 더 길게 + 바닥 빨간 예고 표시
    //   버티기(knockdown 저항): armor = 공격 동작 중엔 맞아도 안 끊김, staggerCdMs = 한 번 움찔하면 이 시간 동안은 번쩍이기만,
    //     downCdMs = 넘어진 뒤 이 시간 동안은 다시 안 넘어짐(콤보 마무리·무거운 타로만 넘어짐, 연타로는 안 넘어짐), 띄우기 기술에 안 뜸(휘청만)
    //   보상: 경험치 = growth.xp.mid(정예와 같은 40) x 판 배율 x 난이도, potion = 쓰러질 때 꼭 떨어지는 물약
    //   delayMs = 웨이브 시작 뒤 나오는 때, side = 나오는 쪽. 막대 = 보스 막대 자리에 작은 막대(main.js · css .midbar)
    midBoss: {
      on: true, wave: 2, delayMs: 1800, side: 'R',
      scale: 1.5, hpBoss: 0.45, dmgMul: 1.35, knock: 1.3, speed: 0.9,
      heavy: true, windMs: 320,
      armor: true, staggerCdMs: 900, downCdMs: 5000, knockResist: 0.45,
      potion: 'red',
      tint: { hue: 0, sat: 1.15, bright: 0.8, color: '#3a0a10', colorK: 0.16 },
      rim: { color: '#ffb43a', px: 1.5, alpha: 0.75 },
      list: {
        1: ['goblin', '고블린 대장', null],
        2: ['skeleton', '해골 대장', null],
        3: ['lizard', '도마뱀 대장', null],
        4: ['mummy', '미라 대장', null],
        5: ['yeti', '설인 대장', null],
        6: ['skeleton', '해적 해골 대장', 'pirate'],
        7: ['imp', '불 도깨비 대장', null],
        8: ['ghost', '유령 기사 대장', null],
        9: ['soldier', '마족 병사 대장', null],
        10: ['soldier', '심연 근위대장', 'abyss']
      }
    },

    // ---------- 소품 그림 (2026-11-04, art\stage1-props 에서 복사 → assets/props/stage1/…, 크기·기준점은 props.json) ----------
    // 판의 props 가 쓰는 그림. 그림이 아직 없는 종류는 안 그림(?debug=1 이면 자리 표시만).
    //   frames = 그림 경로 목록(seq 로, 부서지는 소품은 멀쩡 → 금 감 → 많이 부서짐 3장), fps = 1초에 장 수(0 = 멈춘 그림, 맞은 횟수로 장을 고름)
    //   pivot = 그림 속 바닥 가운데(원래 크기), scale = 그리는 배율(없으면 actorScale)
    //   아래 거리 값은 전부 원래 그림 크기(1배) 기준 → 맨 아래 scaleActors 가 actorScale 로 줄인다
    //   solid = 못 지나감: footprint = 바닥에서 막는 상자 { w = 가로(기준점 가운데), depth = 위아래(걷는 길) 두께 }
    //   hits = 몇 번 맞으면 부서지나(CFG.props), hurtbox = 맞는 상자(기준점에서 x, y = 왼쪽 위, w, h), breakFrames = 부서지는 그림(14fps 한 번)
    //   shadow = 발밑 그림자 반폭(없으면 안 그림), glow = 바닥 빛 { r, y(기준점 위로), color, alpha } (모닥불). 여러 개면 [ {…}, {…} ]
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
      },
      // ----- 3단계 소품 (art\stage3-props 에서 복사 → assets/props/stage3/…, 크기·기준점은 그 폴더 props.json) -----
      // 이끼 낀 썩은 그루터기: 주인공 허리 높이(2단계 광석 수레쯤). 나무·껍질·이끼·버섯 조각
      stump: {
        frames: ['intact', 'cracked', 'damaged'].map(function (s) { return 'assets/props/stage3/stump/' + s + '_01.png'; }), fps: 0,
        breakFrames: seq('assets/props/stage3/stump/break_', 4),
        pivot: { x: 39, y: 73 }, solid: true, footprint: { w: 60, depth: 18 },
        hits: 3, hurtbox: { x: -33, y: -53, w: 66, h: 52 }, shadow: 32,
        chips: ['#7a5a3a', '#5a3e26', '#9a7a4a', '#6a8a3a', '#c8b070']
      },
      // 갈대 뚜껑 항아리: 고블린보다 조금 낮음. 흙 조각 + 갈대 + 늪물
      pot: {
        frames: ['intact', 'cracked', 'damaged'].map(function (s) { return 'assets/props/stage3/pot/' + s + '_01.png'; }), fps: 0,
        breakFrames: seq('assets/props/stage3/pot/break_', 4),
        pivot: { x: 39, y: 76 }, solid: true, footprint: { w: 46, depth: 18 },
        hits: 3, hurtbox: { x: -25, y: -66, w: 50, h: 65 }, shadow: 24,
        chips: ['#b8653a', '#8a4a2a', '#d8b070', '#5a7a4a']
      },
      // 늪 가마솥(나뭇가지 삼발이 위 쇠솥, 초록 국물): 장식(지나갈 수 있음, 안 부서짐). 솥·삼발이는 그대로, 불·국물·김만 움직이는 6장 반복 8fps
      //   glow 를 여러 개 = 아래 장작불(주황) + 솥 위 국물(초록)
      cauldron: {
        frames: seq('assets/props/stage3/cauldron/cook_', 6), fps: 8,
        pivot: { x: 27, y: 81 }, solid: false, shadow: 18,
        glow: [{ r: 60, y: 10, color: '#ff9a3a', alpha: 0.26 }, { r: 44, y: 46, color: '#9aff5a', alpha: 0.2 }]
      },
      // ----- 6단계 소품 (art\stage6-props 에서 복사 → assets/props/stage6/…, 크기·기준점은 그 폴더 props.json) -----
      // 이름이 1단계 상자(crate)·술통(barrel)과 겹쳐서 종류 이름만 따로(그림 폴더 이름은 그대로)
      // 럼주 통(쇠테·꼭지·빨간 X 표시): 고블린 가슴 높이. 통 판자·쇠테·럼주 조각
      rumbarrel: {
        frames: ['intact', 'cracked', 'damaged'].map(function (s) { return 'assets/props/stage6/barrel/' + s + '_01.png'; }), fps: 0,
        breakFrames: seq('assets/props/stage6/barrel/break_', 4),
        pivot: { x: 48, y: 77 }, solid: true, footprint: { w: 40, depth: 16 },
        hits: 3, hurtbox: { x: -23, y: -61, w: 46, h: 60 }, shadow: 22,
        chips: ['#a0663a', '#6e4224', '#3e3a3a', '#9a2a22', '#d89a5a']
      },
      // 그물 묶은 화물 상자(위에 자루): 주인공 허리~가슴 높이. 판자·밧줄·자루 조각
      netcrate: {
        frames: ['intact', 'cracked', 'damaged'].map(function (s) { return 'assets/props/stage6/crate/' + s + '_01.png'; }), fps: 0,
        breakFrames: seq('assets/props/stage6/crate/break_', 4),
        pivot: { x: 43, y: 80 }, solid: true, footprint: { w: 68, depth: 18 },
        hits: 3, hurtbox: { x: -36, y: -70, w: 72, h: 69 }, shadow: 34,
        chips: ['#c8ae84', '#9a7c54', '#6e5434', '#d8c8a0', '#8a7a5a']
      },
      // 부두 화덕(다리 굽은 쇠 화로 팬 + 꼬챙이 생선): 장식(지나갈 수 있음, 안 부서짐). 팬·다리·나무판은 그대로, 불꽃만 움직이는 6장 반복
      firepan: {
        frames: seq('assets/props/stage6/firepan/burn_', 6), fps: 10,
        pivot: { x: 25, y: 79 }, solid: false, shadow: 16,
        glow: { r: 66, y: 46, color: '#ff9a3a', alpha: 0.3 }
      },
      // ----- 7단계 소품 (art\stage7-props 에서 복사 → assets/props/stage7/…, 크기·기준점은 그 폴더 props.json) -----
      // 이름이 3단계 항아리(pot)·1단계 상자(crate)와 겹쳐서 종류 이름만 따로(그림 폴더 이름은 그대로)
      // 불씨 항아리(검은 테두리 토기, 뚜껑에 불씨): 고블린 가슴 높이. 토기·검은 테·불씨 조각
      firepot: {
        frames: ['intact', 'cracked', 'damaged'].map(function (s) { return 'assets/props/stage7/pot/' + s + '_01.png'; }), fps: 0,
        breakFrames: seq('assets/props/stage7/pot/break_', 4),
        pivot: { x: 52, y: 75 }, solid: true, footprint: { w: 44, depth: 16 },
        hits: 3, hurtbox: { x: -25, y: -62, w: 50, h: 61 }, shadow: 22,
        chips: ['#b8603a', '#7a3a22', '#2a2224', '#ff9a3a', '#ffd060']
      },
      // 쇠테 두른 광석 상자(그을린 판자, 위에 빛나는 광석): 주인공 허리~가슴 높이. 판자·쇠테·광석 조각
      orecrate: {
        frames: ['intact', 'cracked', 'damaged'].map(function (s) { return 'assets/props/stage7/crate/' + s + '_01.png'; }), fps: 0,
        breakFrames: seq('assets/props/stage7/crate/break_', 4),
        pivot: { x: 47, y: 77 }, solid: true, footprint: { w: 65, depth: 18 },
        hits: 3, hurtbox: { x: -34, y: -70, w: 69, h: 69 }, shadow: 34,
        chips: ['#4a3628', '#2a2224', '#6a6a72', '#ff8a2a', '#ffd060']
      },
      // 끓는 용암 구멍(현무암 고리 + 부글거리는 용암): 바닥 장식(밟고 지나감, 안 부서짐, 안 아픔). 고리는 그대로, 용암·거품·김만 움직이는 6장 반복 8fps
      //   그림이 작아서(원래 44도트) scale 로 조금 크게 그림(actorScale 0.55 x 약 1.35). 빛 = 바닥에 깔린 주황
      magmavent: {
        frames: seq('assets/props/stage7/vent/bubble_', 6), fps: 8, scale: 0.75,
        pivot: { x: 26, y: 47 }, solid: false,
        glow: [{ r: 56, y: 8, color: '#ff6a1a', alpha: 0.34 }, { r: 26, y: 14, color: '#ffc040', alpha: 0.22 }]
      },
      // ----- 5단계 소품 (art\stage5-props 에서 복사 → assets/props/stage5/…, 크기·기준점은 그 폴더 props.json) -----
      // 이름이 1단계 상자(crate)·모닥불(campfire)과 겹쳐서 종류 이름만 따로(그림 폴더 이름은 그대로)
      // 눈 덮인 보급 상자(밧줄로 묶음, 뚜껑에 고드름): 주인공 허리 높이(4단계 상자쯤). 판자·밧줄·눈덩이 조각
      snowcrate: {
        frames: ['intact', 'cracked', 'damaged'].map(function (s) { return 'assets/props/stage5/crate/' + s + '_01.png'; }), fps: 0,
        breakFrames: seq('assets/props/stage5/crate/break_', 4),
        pivot: { x: 46, y: 73 }, solid: true, footprint: { w: 66, depth: 18 },
        hits: 3, hurtbox: { x: -35, y: -59, w: 70, h: 58 }, shadow: 34,
        chips: ['#c8894a', '#9a5f30', '#6e4022', '#eef6ff', '#b8cce0']
      },
      // 얼음 속 술통(파란 얼음 덩어리에 갇힌 나무 통): 고블린 가슴 높이. 얼음 조각·통 판자·쇠테
      icebarrel: {
        frames: ['intact', 'cracked', 'damaged'].map(function (s) { return 'assets/props/stage5/icebarrel/' + s + '_01.png'; }), fps: 0,
        breakFrames: seq('assets/props/stage5/icebarrel/break_', 4),
        pivot: { x: 44, y: 77 }, solid: true, footprint: { w: 52, depth: 16 },
        hits: 3, hurtbox: { x: -28, y: -67, w: 56, h: 66 }, shadow: 26,
        chips: ['#e8f6ff', '#a8d8f8', '#6aa8d8', '#8a5a32', '#4a4a56']
      },
      // 가죽 천막 모닥불(눈 덮인 돌 고리 + 장작 + 털가죽 덮은 삼발이 + 쇠솥): 장식(지나갈 수 있음, 안 부서짐). 불꽃만 움직이는 6장 반복. 빛은 낮은 불 자리
      snowcamp: {
        frames: seq('assets/props/stage5/campfire/burn_', 6), fps: 10,
        pivot: { x: 28, y: 77 }, solid: false, shadow: 20,
        glow: { r: 70, y: 18, color: '#ff9a3a', alpha: 0.32 }
      },
      // ----- 8단계 소품 (art\stage8-props 에서 복사 → assets/props/stage8/…, 크기·기준점은 그 폴더 props.json) -----
      // 이름이 2단계 화로(brazier)와 겹쳐서 종류 이름만 따로(그림 폴더 이름은 그대로: coffin / urn / brazier)
      // 세워 둔 나무 관(뚜껑에 십자가, 쇠 모서리, 거미줄): 주인공 가슴 높이. 검은 판자·쇠 장식·먼지 조각
      coffin: {
        frames: ['intact', 'cracked', 'damaged'].map(function (s) { return 'assets/props/stage8/coffin/' + s + '_01.png'; }), fps: 0,
        breakFrames: seq('assets/props/stage8/coffin/break_', 4),
        pivot: { x: 38, y: 80 }, solid: true, footprint: { w: 36, depth: 16 },
        hits: 3, hurtbox: { x: -21, y: -73, w: 42, h: 72 }, shadow: 22,
        chips: ['#4a3426', '#2e2018', '#6a6a72', '#b8a890', '#8a7a68']
      },
      // 받침돌 위 청동 유골 항아리(금 띠·해골 메달): 주인공 가슴 높이. 청동·금·돌 조각 + 회색 재
      bronzeurn: {
        frames: ['intact', 'cracked', 'damaged'].map(function (s) { return 'assets/props/stage8/urn/' + s + '_01.png'; }), fps: 0,
        breakFrames: seq('assets/props/stage8/urn/break_', 4),
        pivot: { x: 39, y: 84 }, solid: true, footprint: { w: 40, depth: 16 },
        hits: 3, hurtbox: { x: -23, y: -78, w: 46, h: 77 }, shadow: 24,
        chips: ['#a0703a', '#6e4a26', '#e0b860', '#8a8a90', '#c8c4bc']
      },
      // 푸른 유령불 화로(해골 장식 쇠 그릇 + 세 다리): 장식(지나갈 수 있음, 안 부서짐). 받침·다리·그릇은 그대로, 푸른 불꽃만 움직이는 6장 반복
      //   빛 = 그릇 높이 청록 + 바닥에 깔린 옅은 파랑(유령불 느낌)
      ghostfire: {
        frames: seq('assets/props/stage8/brazier/burn_', 6), fps: 10,
        pivot: { x: 21, y: 78 }, solid: false, shadow: 14,
        glow: [{ r: 66, y: 50, color: '#4ae0ff', alpha: 0.3 }, { r: 48, y: 6, color: '#3a7aff', alpha: 0.2 }]
      },
      // ----- 9단계 소품 (art\stage9-props 에서 복사 → assets/props/stage9/…, 크기·기준점은 그 폴더 props.json) -----
      // 이름이 1단계 상자(crate)·2단계 화로(brazier)와 겹쳐서 종류 이름만 따로(그림 폴더 이름은 그대로: crate / keg / brazier)
      // 마왕군 보급 상자(쇠띠·가시 모서리·뿔 해골 문장, 위에 창 3자루): 창까지 주인공 가슴 높이. 나무·검은 쇠·뼈색 조각
      siegecrate: {
        frames: ['intact', 'cracked', 'damaged'].map(function (s) { return 'assets/props/stage9/crate/' + s + '_01.png'; }), fps: 0,
        breakFrames: seq('assets/props/stage9/crate/break_', 4),
        pivot: { x: 40, y: 82 }, solid: true, footprint: { w: 54, depth: 16 },
        hits: 3, hurtbox: { x: -30, y: -75, w: 60, h: 74 }, shadow: 28,
        chips: ['#8a5a34', '#5a3a22', '#2a2a30', '#e0d8c0', '#a02030']
      },
      // 흑철 테 화약통(심지·문장): 부서지면 검은 화약이 쏟아짐(터지는 데미지는 없음). 나무·쇠테·검은 화약 조각
      powderkeg: {
        frames: ['intact', 'cracked', 'damaged'].map(function (s) { return 'assets/props/stage9/keg/' + s + '_01.png'; }), fps: 0,
        breakFrames: seq('assets/props/stage9/keg/break_', 4),
        pivot: { x: 48, y: 84 }, solid: true, footprint: { w: 40, depth: 16 },
        hits: 3, hurtbox: { x: -23, y: -73, w: 46, h: 72 }, shadow: 24,
        chips: ['#6e4a2a', '#3a2a1e', '#2a2a2e', '#5a5a60', '#141416']
      },
      // 초록 불꽃 전쟁 화로(가시 쇠 그릇 + 뿔 해골 장식 + 세 다리): 장식(지나갈 수 있음, 안 부서짐). 받침·다리·그릇은 그대로, 불꽃만 움직이는 6장 반복
      //   빛 = 그릇 높이 독초록 + 바닥에 깔린 옅은 초록
      warbrazier: {
        frames: seq('assets/props/stage9/brazier/burn_', 6), fps: 10,
        pivot: { x: 21, y: 79 }, solid: false, shadow: 14,
        glow: [{ r: 66, y: 50, color: '#6aff4a', alpha: 0.28 }, { r: 48, y: 6, color: '#3ad86a', alpha: 0.18 }]
      },
      // ----- 10단계 소품 (art\stage10-props 에서 복사 → assets/props/stage10/…, 크기·기준점은 그 폴더 props.json) -----
      // 이름이 8단계 항아리(urn → bronzeurn)·1단계 상자와 겹쳐서 종류 이름만 따로(그림 폴더 이름은 그대로: urn / chest / flame)
      // 흑금 항아리(금 띠·손잡이·뿔 악마 문장 + 붉은 보석, 검은 대리석 받침): 주인공 가슴 높이. 검은 조각·금·붉은 보석
      goldurn: {
        frames: ['intact', 'cracked', 'damaged'].map(function (s) { return 'assets/props/stage10/urn/' + s + '_01.png'; }), fps: 0,
        breakFrames: seq('assets/props/stage10/urn/break_', 4),
        pivot: { x: 38, y: 75 }, solid: true, footprint: { w: 36, depth: 16 },
        hits: 3, hurtbox: { x: -21, y: -70, w: 42, h: 69 }, shadow: 22,
        chips: ['#1a1a20', '#3a3440', '#e0b860', '#a07a2a', '#c02030']
      },
      // 저주받은 보물상자(검은 나무·쇠, 금 모서리·해골 자물쇠·사슬, 틈에서 보랏빛): 낮고 넓음. 나무·쇠·금화·보랏빛 조각
      cursedchest: {
        frames: ['intact', 'cracked', 'damaged'].map(function (s) { return 'assets/props/stage10/chest/' + s + '_01.png'; }), fps: 0,
        breakFrames: seq('assets/props/stage10/chest/break_', 4),
        pivot: { x: 48, y: 58 }, solid: true, footprint: { w: 56, depth: 16 },
        hits: 3, hurtbox: { x: -31, y: -42, w: 62, h: 41 }, shadow: 30,
        chips: ['#3a2a22', '#1e1a1e', '#5a5a64', '#ffd060', '#b05aff']
      },
      // 떠다니는 보랏빛 영혼불(희미한 해골 얼굴, 가시 쇠 받침 + 세 다리): 장식(지나갈 수 있음, 안 부서짐). 받침은 그대로, 떠 있는 불꽃만 움직이는 6장 반복
      //   빛 = 불꽃 높이 보라 + 바닥에 깔린 옅은 보라(영혼불 느낌)
      soulflame: {
        frames: seq('assets/props/stage10/flame/burn_', 6), fps: 10,
        pivot: { x: 17, y: 97 }, solid: false, shadow: 12,
        glow: [{ r: 64, y: 72, color: '#b04aff', alpha: 0.32 }, { r: 50, y: 6, color: '#7a3aff', alpha: 0.2 }]
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
      potion: 0.3,                // 물약(2026-11-06 밤): 부서질 때 음식과 따로 이 확률로 물약 하나(종류 = potions.weights)
      woodColors: ['#c8894a', '#9a5f30', '#6e4022', '#e0b070']   // 나뭇조각 색
    },
    // ---------- 음식 (부서진 소품에서 나옴, 밟으면 바로 먹음) ----------
    //   2026-11-06 밤 형님 결정: 빵·고기는 체력을 바로 채우지 않고 「포만감 %」를 채움(full, 아래 fullness). 예전 heal 은 안 씀
    //   frames = 그림(같은 기준점), pickup = 줍는 거리 { r = 가로, depth = 위아래 }(원래 크기)
    //   lifeMs = 바닥에 남아 있는 시간, blinkMs = 사라지기 전 깜빡이는 시간, hop = 나올 때 튀어 오르는 높이(원래 크기), pickupDelayMs = 나오자마자 줍지 않게
    food: {
      pivot: { x: 30, y: 26 },
      items: {
        meat:  { frame: 'assets/props/stage1/food/meat_01.png',  full: 60 },
        bread: { frame: 'assets/props/stage1/food/bread_01.png', full: 30 }
      },
      pickup: { r: 16, depth: 12 }, lifeMs: 15000, blinkMs: 3000, hop: 22, pickupDelayMs: 250, shadow: 12
    },
    // ---------- 포만감 (2026-11-06 밤, 기획\성장시스템-설계안.md 「물약·포만감」) : 막대 없이 체력·마나 옆 글자 「포만감 65%」 ----------
    //   빵 +30% · 고기 +60% (최대 max). 포만감이 0 보다 크면 체력이 저절로 참: 초당 최대 체력 x regenPct (조금씩 모아서 1씩)
    //   시간이 지나면 초당 decayPerSec 씩 줄고, 기술을 한 번 쓸 때마다 skillCost 더 줆. 0% = 회복만 멈춤(벌칙 없음)
    //   start = 판 시작(다시 하기 포함)마다 이 값으로(저장 안 함). 값 고른 기준: 100% 를 시간으로만 다 쓰면(100초) 최대 체력 150 → 45, 200 → 60
    //   = 예전 고기(40)와 비슷하거나 조금 더. 기술을 많이 쓰면 그만큼 빨리 끝남
    fullness: { start: 50, max: 100, regenPct: 0.003, decayPerSec: 1, skillCost: 2 },
    // ---------- 물약 (2026-11-06 밤): 밟으면 바로 마심(가방·버튼 없음, 게이지가 꽉 차 있어도 마심) ----------
    //   items = 종류마다 채우는 양(최대의 비율): red = 체력, blue = 마나, purple = 둘 다. col = 물약 색 [밝음, 가운데, 어두움], pop = 머리 위 글자 모양(damageText)
    //   어디서: 부서지는 소품 props.potion 확률 · 잡몹 mob(단단한 잡몹 = 원래 체력 toughHp 이상은 tough) 확률 · 보스는 꼭 하나(boss 종류)
    //     bossAt = 보스가 물약을 떨어뜨리는 때: 'rage' = 화날 때(체력 절반 아래, 마왕 = 각성) → 싸우는 중에 마실 수 있음 / 'death' = 쓰러질 때
    //   weights = 소품·잡몹에서 나올 때 종류 비율. 그림 = props.js 가 코드로 그리는 작은 도트 물약병(위아래로 둥실 + 반짝)
    //   pickup·lifeMs·blinkMs·hop·pickupDelayMs = 음식과 같은 뜻
    potions: {
      items: {
        red:    { hp: 0.3, col: ['#ffb0a8', '#e8303a', '#8a1020'], label: '빨간 물약' },
        blue:   { mp: 0.45, col: ['#b8e4ff', '#2f86ec', '#163a8e'], label: '파란 물약' },
        purple: { hp: 0.25, mp: 0.35, col: ['#ecc0ff', '#a040e8', '#4e1882'], label: '보라 물약' }
      },
      weights: { red: 0.5, blue: 0.3, purple: 0.2 },
      mob: 0.06, tough: 0.12, toughHp: 75, boss: 'purple', bossAt: 'rage',
      pickup: { r: 16, depth: 12 }, lifeMs: 20000, blinkMs: 3000, hop: 26, pickupDelayMs: 300, shadow: 7
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
      skillB: ['KeyI', 'KeyV'],
      // 기술 3·4번 칸 (2026-11-06, Lv13 부터): 오른손은 U·I 옆 O·P, 왼손은 C·V 옆 B·N
      skillC: ['KeyO', 'KeyB'],
      skillD: ['KeyP', 'KeyN'],
      // 각성(2026-11-06 밤, 분노 100%): 오른손 = J·K 옆 L, 왼손 = F
      awaken: ['KeyL', 'KeyF'],
      // 회피(2026-11-07): Shift(왼손·오른손 둘 다) + 오른손 J K L 옆 ; (K 는 이미 점프라 안 씀)
      dodge: ['ShiftLeft', 'ShiftRight', 'Semicolon']
    },

    // ---------- 직업 기술 (위 SKILLS 설명 참고) ----------
    // bufferMs = 미리 눌러 둔 기술 입력 기억 시간, cancelAfterHit = 보통 콤보 타의 판정이 끝난 장부터 기술로 끊을 수 있음
    // 성장 4단계(2026-11-06): 기술 = 마나 + 쿨타임. 기술 창(main.js)에서 기술 점수로 Lv1 → 5, 칸에 끼움. 계산·저장 = growth.js 의 기술 책(Growth.book)
    //   tree = 직업마다 기술 10개(위 SKILL_TREE). 전직하면 unlock 0 기술이 Lv1, 레벨이 오르면 저절로 열림(Lv1), 점수로 Lv5 까지
    //   perLv = 전직 뒤 레벨마다 기술 점수(예전 저장 = 지금 Lv - 전직 Lv, 전직 Lv 를 모르면 classLv). maxLv = 기술 최고 Lv
    //   slots = 기술 칸 수 [처음, moreLv[0] 부터, moreLv[1] 부터] (폰 동그라미 · 키보드 U I O P)
    //     2026-11-06 밤 콤보: Lv10 에 3번째 칸(띄우기 기술 올려베기·땅 융기가 열리면서 바로 끼워짐, 2026-11-06 Lv9 → 10), Lv13 에 4번째 칸
    //   cancel = 캔슬(콤보, 2026-11-06 밤): 평타 1·2·3타는 판정 장에 들어선 뒤(이미 맞힌 뒤)부터 기술로 끊고 나감(fromActive).
    //     기술 끝무렵(그 기술의 마지막 판정·발사 + padMs 부터, 기술마다 chainFrom = 장 번호로 바꿀 수 있음)에 다른 기술로 이어짐.
    //     한 번 이어지는 동안 같은 기술은 한 번만 → 같은 기술로 되돌아가는 무한 반복 없음(쿨타임도 있음). 점프 착지 웅크림에서도 기술 나감
    //   curve = 기술 Lv1~5 배율: dmg = 데미지(맞는 모든 판정에 곱함), cd = 쿨타임, mp = 마나 (마나는 반올림, 쿨타임은 0.1초 단위)
    //     Lv5 는 거기에 더해 기술마다 lv5(크기 +·두 번 날림 등, say = 기술 창에 쓰는 말)
    //   noMpMs = 마나가 모자랄 때 「MP 부족」 글자를 다시 띄우기까지 최소 간격
    //   test = 시험 버튼(견습/기사/법사)으로 저장된 직업과 다른 직업을 입었을 때: 이번 창에서만 이번에 만든 기술 전부 Lv1 + 칸 4개 +
    //     기술 점수 pts 점(Lv5 까지 올려 보기). 저장 안 함(저장된 직업의 기술 책은 그대로)
    //   botPlan = 시험용(GAME.test.skillSetup): 기술 점수를 이 순서로 돌아가며 1점씩
    skills: { bufferMs: 300, cancelAfterHit: true, knight: SKILLS.knight, mage: SKILLS.mage,
              cancel: { fromActive: true, padMs: 60 },
              tree: SKILL_TREE, perLv: 1, maxLv: 5, classLv: 7, slots: [2, 3, 4], moreLv: [10, 13], noMpMs: 500,
              curve: { dmg: [1, 1.2, 1.4, 1.6, 1.85], cd: [1, 0.94, 0.88, 0.82, 0.75], mp: [1, 1.05, 1.1, 1.15, 1.2] },
              test: { pts: 24 },
              botPlan: { knight: ['dash', 'spin', 'upper', 'mastery', 'skin', 'wave', 'slam', 'grit', 'storm', 'counter', 'holy'],
                         mage: ['fireball', 'bolt', 'rise', 'amp', 'flow', 'ice', 'meteor', 'blink', 'shield', 'pillar', 'brand'] } },

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
      shock:            { count: 3, fps: 15, pivot: { x: 44, y: 60 }, loop: true },   // 감전(멈춘 적 몸 가운데에 겹침)
      // 2026-11-06 우리가 코드로 직접 그린 효과(pipeline/ourfx/ourfx.js → assets/fx/ourfx/<이름>/<이름>_01.png …). 새 기술 4개 + 9단계 장군만.
      //   ours = 게임 도트 그대로 그린 그림: 줄이거나 키우지 않고(skillFxScale 안 곱함) 1배로, 부드럽게 하기 끄고 그린다(assets.js blit).
      //   pivot = 그림 속 기준점(게임 도트), loop = 날아가는 동안 반복할 장 [첫, 끝](0부터), hit = 「쾅」 장(메테오)
      sword_wave:          { ours: true, count: 10, fps: 18, pivot: { x: 23, y: 31 }, loop: [2, 5] },    // 검기(0~1 나감 · 2~5 반복 · 6~9 흩어짐)
      sword_wave_lv5:      { ours: true, count: 10, fps: 18, pivot: { x: 30, y: 38 }, loop: [2, 5] },    // 검기 Lv5(크게 + 금테 + 이중)
      ground_slam:         { ours: true, count: 14, fps: 18, pivot: { x: 88, y: 56 } },                  // 대지 내려찍기(기준 = 칼이 땅에 닿는 곳)
      ice_lance:           { ours: true, count: 4, fps: 16, pivot: { x: 56, y: 12 }, loop: [0, 3] },     // 얼음창(기준 = 창 머리)
      ice_shatter:         { ours: true, count: 9, fps: 18, pivot: { x: 38, y: 34 } },                   // 얼음창 부서짐
      earth_circle:        { ours: true, count: 10, fps: 16, pivot: { x: 42, y: 15 }, loop: [3, 9] },   // 땅 융기 보라 마법진(2026-11-06 밤, 0~2 나타남 · 3~9 반복)
      earth_pillar:        { ours: true, count: 16, fps: 22, pivot: { x: 32, y: 102 } },                // 땅 융기 돌기둥(기준 = 기둥 밑, 0 터짐 · 1~3 솟음 · 10~15 부서짐)
      meteor:              { ours: true, count: 20, fps: 18, pivot: { x: 150, y: 150 }, hit: 6 },        // 메테오 전체(기준 = 떨어지는 땅 자리, 6장 = 쾅)
      demon_charge_ground: { ours: true, count: 12, fps: 20, pivot: { x: 80, y: 128 } },                 // 9단계 장군 기 모으기: 땅 금 + 몸 뒤 불꽃(기준 = 발)
      demon_charge_body:   { ours: true, count: 12, fps: 20, pivot: { x: 80, y: 128 } },                 //   〃 몸 앞 낮은 불꽃 + 모여드는 불씨
      demon_release:       { ours: true, count: 5, fps: 20, pivot: { x: 90, y: 136 } }                   // 9단계 장군 칼 꽂는 순간 번쩍(빛기둥 = 기준점 오른쪽 6)
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
      C.art.fx['skill_' + k] = seq(F.ours ? 'assets/fx/ourfx/' + k + '/' + k + '_' : 'assets/fx/skill/' + k + '_', F.count);
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
    // 2026-11-06 새 기술 값: 검기(shot) · 내려찍기(leap·quake) · 메테오(meteor). 얼음창은 위 cast 그대로
    function skill2(d) {
      var w = d.shot;
      if (once(w)) { mul(w, ['x', 'y', 'speed', 'range', 'depth'], S); if (w.box) mul(w.box, ['w', 'h'], S); }
      if (once(d.leap)) mul(d.leap, ['h', 'fwd'], S);
      if (once(d.quake)) mul(d.quake, ['r', 'depth'], S);
      var m = d.meteor;
      if (once(m)) { mul(m, ['x', 'r', 'depth', 'size'], S); if (m.aim) mul(m.aim, ['range', 'depth'], S); }
      var pl = d.pillar;   // 2026-11-06 밤 땅 융기
      if (once(pl)) { mul(pl, ['x', 'r', 'depth'], S); if (pl.aim) mul(pl.aim, ['range', 'depth'], S); }
      // 2차 기술(2026-11-06): 성검 낙뢰(blades) · 순간이동(blink) · 불기둥(flame, 높이 h 는 skills.js 가 그릴 때 곱함)
      var bl = d.blades;
      if (once(bl)) { arr(bl.x); mul(bl, ['r', 'depth'], S); if (bl.aim) mul(bl.aim, ['range', 'depth'], S); }
      if (once(d.blink)) mul(d.blink, ['dist', 'r', 'depth'], S);
      var fl = d.flame;
      if (once(fl)) { mul(fl, ['x', 'r', 'depth'], S); if (fl.aim) mul(fl.aim, ['range', 'depth'], S); }
      if (d.male) skill2(d.male);
      if (d.female) skill2(d.female);
    }
    ['knight', 'mage'].forEach(function (c) {
      var L = C.skills[c];
      if (L) Object.keys(L).forEach(function (id) { skill(L[id]); skill2(L[id]); });
    });
    if (C.art.fx) mul(C.art.fx.slashOffset, ['x', 'y'], S);
    mul(C.player, ['speedX', 'speedY'], MV);
    box(C.player.hitbox);
    box(C.hero.hurtbox);
    mul(C.hero, ['radius'], S);
    arr(C.hero.down.slide);
    mul(C.ai, ['sepDepth'], S);
    Object.keys(C.enemies).forEach(function (k) {
      var T = C.enemies[k];
      // 6단계: 그림만 크게 그리는 적(drawScale, 해적 선장) → 그림에 묶인 몸·판정·총구 자리도 같은 배율(먼저 곱하고 아래에서 actorScale)
      var DS = T.drawScale || 1;
      if (DS !== 1) {
        var bx = function (r) { mul(r, ['x0', 'x1', 'yTop', 'yBot'], DS); };
        mul(T, ['radius', 'height'], DS); bx(T.hurtbox);
        if (T.stagger) bx(T.stagger.hurtbox);
        Object.keys(T.attacks).forEach(function (n) {
          var a = T.attacks[n];
          bx(a.reach); bx(a.bodyReach); mul(a.spawn, ['x', 'y'], DS); mul(a, ['aimH'], DS);
          if (a.reachF) Object.keys(a.reachF).forEach(function (f) { bx(a.reachF[f]); });
        });
      }
      mul(T, ['radius', 'height', 'engage', 'alignY', 'deathKnock'], S);
      mul(T, ['speedX', 'speedY'], MV);
      mul(T, ['walkStride'], S * DS);   // 보스 보폭 걷기: 그림 속 거리 → 그림과 같이 줄임(선장은 drawScale 도)
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
        // 3단계: 두꺼비 배치기 뛰는 거리·겨누는 거리, 독 웅덩이 크기
        mul(a.leap, ['max', 'aimAt'], S); mul(a.puddle, ['radius', 'depth'], S);
        // 6단계: 총알 거리·크기·날아가는 높이(speed 는 위에서), 대포알 떨어지는 높이·흩어지는 폭
        mul(a, ['range', 'aimH', 'dropPx', 'dropHeight'], S); mul(a.box, ['w', 'h'], S); mul(a.spread, ['x', 'y'], S);
        // 7단계: 와이번 불길 그림 붙는 자리·한 토막 길이, 내리꽂기 나는 높이·맴돌 때 속도·멈추는 거리·점프 공격 높이
        if (a.fx && a.fx.attach) { mul(a.fx.attach, ['x', 'y'], S); mul(a.fx, ['segW'], S); }
        mul(a, ['z', 'jumpZ'], S); mul(a.hover, ['speed', 'catchR'], S);
        // 5단계: 서리 거인 얼음 가시 줄(첫 가시 거리·가시 사이 거리, maxRange 는 위에서)
        mul(a, ['first', 'step'], S);
        // 8단계: 흡혈 백작 순간이동(등 뒤 거리·덤비는 거리), 화난 뒤 박쥐 떼 줄 차이
        mul(a, ['behind', 'lunge'], S); if (a.enraged && a.enraged.lanes) arr(a.enraged.lanes);
        // 9단계: 마왕군 장군 화염 충격파 고리(처음·끝 반지름, 퍼지는 속도, 맞는 띠 두께, 위아래 반지름, 그림 속 고리 반지름, 피하는 점프 높이)
        mul(a.rings, ['r0', 'rMax', 'speed', 'band', 'ryMax', 'ringRx', 'dodgeZ'], S);
      });
      // 6단계 총잡이 거리 두기
      if (T.ranged) { arr(T.ranged.keep); mul(T.ranged, ['tooClose'], S); }
      // 나는 적 흔들림, 방패 막기 밀림, 보스 핵 빛 위치
      mul(T.flying, ['bob'], S); mul(T.guard, ['push'], S); mul(T.glide, ['bob'], S);   // glide = 8단계 유령 기사 둥실
      if (T.stagger) { mul(T.stagger.core, ['x', 'y', 'r'], S); box(T.stagger.hurtbox); }   // 휘청 중 몸 판정(전갈 뒤집힘)
      mul(T.awaken, ['push'], S);   // 10단계 마왕 각성: 플레이어를 밀어내는 거리
    });
    // 소품·음식: 맞는 상자·막는 상자·그림자·빛·줍는 거리·튀어 오름 (그림은 assets.js 가 actorScale 로 그림)
    Object.keys(C.propTypes || {}).forEach(function (k) {
      var D = C.propTypes[k];
      mul(D.hurtbox, ['x', 'y', 'w', 'h'], S); mul(D.footprint, ['w', 'depth'], S); mul(D, ['shadow'], S);
      [].concat(D.glow || []).forEach(function (g) { mul(g, ['r', 'y'], S); });   // 빛이 여러 개일 수 있음(3단계 가마솥)
    });
    mul(C.props, ['hitAbove'], S);
    if (C.food) { mul(C.food.pickup, ['r', 'depth'], S); mul(C.food, ['hop', 'shadow'], S); }
  })(window.CFG);
})();
