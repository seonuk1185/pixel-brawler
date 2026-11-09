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

  // ---------- 궁수(활) 3타 콤보 (2026-11-09, art\archer-t1 · js/archer.js) ----------
  // 활은 그림에 박혀 있음(bakedWeapon). 세 타 모두 화살을 쏨: cast.kind 'arrow' = js/archer.js 의 Archer.basicShot
  //   x,y = 화살이 나오는 곳(발 기준, 원래 그림 도트), speed · range = 1초에 도트 · 최대 거리, box = 화살 판정 크기, depth = 위아래 폭,
  //   pierce = 꿰뚫는 적 수(0 = 첫 적에서 멈춤, 99 = 끝까지), n = 한 번에 쏘는 화살 수(lanes = 화살마다 위아래로 비킴), art = 'fly'(보통) / 'pfly'(바람 화살)
  //   몹 떼: 1·2타 화살이 1~2마리 꿰뚫고, 3타 바람 화살은 줄 위 적을 모두 꿰뚫으며 크게 밀어냄
  var ARCHER = {
    male: {
      stride: 112, attack1Count: 4, attack2Count: 5, attack3Count: 6,
      combo: [
        { anim: 'attack1', f: [0, 1, 2, 3], d: [50, 70, 80, 90], active: [2, 2], cancel: 3, lunge: 0,
          dmg: 0.8, hitstop: 0.7, knock: 0.7, shake: 0.6, spark: 0.8, impactFx: 'impact',
          fx: { type: 'none' },
          cast: { kind: 'arrow', x: 54, y: -66, speed: 640, range: 270, box: { w: 26, h: 12 }, depth: 16, pierce: 1, art: 'fly' } },
        { anim: 'attack2', f: [0, 1, 2, 3, 4], d: [50, 60, 70, 80, 100], active: [3, 3], cancel: 4, lunge: 0,
          dmg: 0.7, hitstop: 0.7, knock: 0.8, shake: 0.6, spark: 0.8,
          fx: { type: 'none' },
          cast: { kind: 'arrow', x: 54, y: -66, speed: 660, range: 280, box: { w: 26, h: 12 }, depth: 16, pierce: 2, n: 2, lanes: [-6, 6], art: 'fly' } },
        { anim: 'attack3', f: [0, 1, 2, 3, 4, 5], d: [70, 80, 110, 80, 120, 130], active: [3, 3], cancel: 99, lunge: 0,
          dmg: 1.7, hitstop: 1.5, knock: 2.6, shake: 1.8, finisher: true, spark: 1.1, hitsDown: true,
          fx: { type: 'none' },
          cast: { kind: 'arrow', x: 56, y: -64, speed: 760, range: 320, box: { w: 40, h: 22 }, depth: 22, pierce: 99, art: 'pfly', big: true } }
      ]
    },
    female: {
      stride: 96, attack1Count: 4, attack2Count: 5, attack3Count: 6,
      combo: null   // 아래에서 남자 콤보를 그대로 씀(그림 장 수가 같음)
    }
  };
  ARCHER.female.combo = ARCHER.male.combo;

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
      motion_spin: { count: 7, ms: [120, 60, 60, 60, 60, 110, 160], active: [1, 3, 5] },                   // 0 장전 · 1-4 한 바퀴 · 5 마무리 베기 · 6 가드
      motion_upper: { count: 4, ms: [110, 45, 60, 150], active: [1, 2] }                                   // 0 낮게 웅크림 · 1 칼 낮게 앞 · 2 45도 올려베기 · 3 복귀
    },
    knight_female: {
      motion_dash: { count: 6, ms: [90, 60, 80, 70, 140, 120], active: [2], dashFrames: [1] },            // 1 수평 돌진 · 2 올려베기
      motion_spin: { count: 7, ms: [80, 45, 45, 45, 45, 90, 150], active: [1, 3, 5] },                    // 발레식 회전 · 5 런지 착지 베기
      motion_upper: { count: 4, ms: [90, 40, 55, 130], active: [1, 2] }                                    // 남자와 같은 4 자세, 더 빠르게
    },
    mage_male: {
      motion_cast_forward: { count: 6, ms: [110, 120, 140, 80, 120, 150], active: [3] },                 // 3 앞으로 찌르며 발사
      motion_cast_sky:     { count: 6, ms: [120, 140, 200, 80, 200, 150], active: [3] }                  // 1-2 하늘로 · 3 내리꽂기
    },
    mage_female: {
      motion_cast_forward: { count: 5, ms: [70, 90, 70, 90, 120], active: [2] },                         // 2 투수처럼 던짐
      motion_cast_sky:     { count: 6, ms: [70, 110, 140, 60, 160, 120], active: [3] }                   // 3 앞 아래로 탁 가리킴
    },
    // 궁수(2026-11-09, Flow 그림 art\archer-t1): shoot = 무릎 꿇고 힘 모아 쏘기(4장 = 놓는 장은 활이 안 보여서 기술마다 motionSeq 로 건너뜀),
    //   sky = 하늘로 쏘기(2 하늘 조준 · 3 놓음), leap = 뒤로 공중제비 쏘기(1 뜀 · 2 거꾸로 · 3 공중 조준 · 4 착지)
    archer_male: {
      motion_shoot: { count: 6, ms: [80, 110, 120, 160, 90, 130], active: [3] },
      motion_sky:   { count: 6, ms: [80, 110, 150, 120, 110, 120], active: [3] },
      motion_leap:  { count: 6, ms: [70, 90, 90, 140, 120, 120], active: [3] }
    },
    archer_female: {
      motion_shoot: { count: 6, ms: [80, 110, 120, 160, 90, 130], active: [3] },
      motion_sky:   { count: 6, ms: [80, 110, 150, 120, 110, 120], active: [3] },
      motion_leap:  { count: 6, ms: [70, 90, 90, 140, 120, 120], active: [3] }
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
  //   2026-11-07 형님(약해서 안 씀): 데미지 1.6 → 2.0(+25%). 기술 Lv 마다 크기·빛·타격감이 커짐 = SKILLS.knight.wave.grow
  var WAVE_HIT = { dmg: 2.0, hitstop: 0.6, knock: 1.1, shake: 1.2, spark: 1.2, big: true, hitY: -58, hitsDown: true };
  // 내려찍기: 착지 자리 양옆 땅 충격파. 맞은 적은 짧게 기절(stunMs, 넘어뜨리지는 않음), 누운 적도 맞음
  var SLAM_HIT = { dmg: 2.5, hitstop: 1.6, knock: 0.6, shake: 2.6, stunMs: 700, spark: 1.4, big: true, hitsDown: true, away: true, noJuggle: true,
                   flash: { color: '#fff0d0', alpha: 0.35, ms: 140 }, slowMs: 200 };
  // 얼음창: 처음 맞은 적 하나(Lv5 = 꿰뚫음) + 느려짐(slow: ms 동안 그 적의 시간이 mul 배로 흐름 → 걷기·공격·맞는 동작 전부 느려짐, 보스는 bossMul)
  // 2026-11-06 법사 균형: 얼음창 dmg 2.2 → 1.9 (화염구 쿨타임을 줄인 만큼 Lv13 뒤 법사가 기사보다 너무 빨리 깨서)
  var ICE_HIT = { dmg: 1.9, hitstop: 1.1, knock: 0.9, shake: 1.3, spark: 1.2, big: true };   // (예전 얼음창 값, 지금은 안 씀)
  // 빙산 솟구치기(2026-11-08, 얼음창을 바꿈): 땅에서 얼음 바위가 줄지어 솟음. 작은 얼음(CRAG_HIT) = 살짝 띄움, 적마다 한 번만
  //   마지막 뾰족한 빙산(CRAG_BIG) = 높이 띄움(땅 융기처럼 진짜 띄우기, 보스 · 큰 적은 휘청) + 얼음 → 내려오면 느려짐
  //   한 적이 둘 다 맞으면 0.9 + 1.5 = 2.4 (예전 얼음창 1.9 보다 조금 셈, 빙결 폭풍 약 5.7 보다 훨씬 약함)
  var CRAG_HIT = { launch: 0.55, dmg: 0.9, hitstop: 0.45, knock: 0.2, shake: 0.9, spark: 1.0, big: true, hitsDown: true };   // 2026-11-08 형님: 땅에서 솟으니 누운 적도 맞음
  var CRAG_BIG = { launch: 1.5, dmg: 1.5, hitstop: 1.6, knock: 0.25, shake: 2.4, spark: 1.4, big: true, hitsDown: true,
                   flash: { color: '#e8fbff', alpha: 0.32, ms: 140 }, slowMs: 160 };
  // crag 값(화면 도트, actorScale 로 안 줄임 = 빙결 폭풍처럼): frame = 솟기 시작하는 장, x = 첫 얼음 거리(법사 앞), gap = 얼음 사이 거리, gapMs = 솟는 간격,
  //   lastMs = 마지막 빙산 앞 잠깐 더 쉼(쿵 하는 맛), n = 얼음 수(마지막 = 빙산), w0~w1 · h0~h1 = 작은 얼음 폭 · 높이(가까운 것 → 먼 것),
  //   r0~r1 = 작은 얼음 판정 반폭, depth = 위아래 폭, lifeMs = 솟은 채 있는 시간(그 뒤 부서짐),
  //   big = { w, h = 마지막 빙산 폭 · 높이, r, depth = 판정, freeze = 얼음 { ms, mul, bossMul } (뜨는 적은 그림만 얼음 · 안 뜨는 적은 진짜 멈춤), slow = 그 뒤 느려짐(뜬 적은 일어선 뒤부터) }
  //   2026-11-08 형님 2차(v2): 훨씬 작게 · 얼음이 서로 이어진 한 줄(땅이 살짝 갈라지며 그 틈에서 솟음) · 1시 방향(약 30도)으로 앞쪽으로 기운 얼음.
  //   마지막 = 처음 것의 약 2배(높이 60). tilt = 기운 각도(도, 바라보는 쪽으로)
  var ICE_CRAG = { frame: 3, x: 34, gap: 36, gapMs: 70, lastMs: 45, n: 5, w0: 14, w1: 20, h0: 30, h1: 42, r0: 18, r1: 20, depth: 24, lifeMs: 500, tilt: 30,
                   hit: CRAG_HIT,
                   big: { w: 24, h: 60, r: 22, depth: 30, hit: CRAG_BIG,
                          freeze: { ms: 500, mul: 0.06, bossMul: 0.6 }, slow: { ms: 2600, mul: 0.5, bossMul: 0.72 } } };
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
  // ---------- 1차 기사 새 기술 (2026-11-08 형님 승인): 연속 찌르기 · 칼날 파편(늘 켜짐) ----------
  // 연속 찌르기: 빠른 찌르기 다섯 번(THRUST_HIT, 작게 · 분노 안 채움) → 마지막 크게 밀쳐 넘어뜨림(THRUST_LAST). 앞으로 길게 한 줄(누운 적은 안 맞음)
  //   데미지 합 = 0.45 x 5 + 1.6 = 3.85 (회전베기 0.8 x 2 + 1.6 = 3.2 보다 조금 셈 · 대신 앞 한 줄만)
  var THRUST_REACH = { x0: -10, x1: 125, yTop: -100, yBot: -20, depth: 22 };
  var THRUST_HIT = { reach: THRUST_REACH, dmg: 0.45, hitstop: 0.35, knock: 0.15, shake: 0.5, spark: 0.9, hitY: -62, noRage: true, noJuggle: true };   // noJuggle = 4번째 타에 넘어지지 않게(마지막 찌르기에서 넘어짐)
  var THRUST_LAST = { reach: { x0: -10, x1: 140, yTop: -104, yBot: -16, depth: 24 }, dmg: 1.6, hitstop: 1.8, knock: 3.0, shake: 2.4, knockdown: true,
                      spark: 1.4, big: true, hitY: -62, flash: { color: '#e6f2ff', alpha: 0.3, ms: 110 }, slowMs: 160 };
  // 칼날 파편(늘 켜진 기술): 쓰러진 적 둘레를 때리는 파편 한 번(데미지 = 이 값 x 기술 Lv 배율 passive.val). 누운 적도 맞음(땅으로 튐)
  var SHARD_HIT = { dmg: 0.9, hitstop: 0.4, knock: 0.6, shake: 0.6, spark: 0.9, hitsDown: true, noRage: true, noJuggle: true };
  // ---------- 성기사(2차 전직) 새 기술 (2026-11-08 형님 승인): 심판의 십자 · 성스러운 돌격 ----------
  // 심판의 십자: 땅에 새긴 금빛 십자가 터지며 위로 솟는 빛(넓은 범위 전부, 누운 적도 맞음). 잡몹은 띄움(보스 · 큰 적은 휘청)
  //   CROSS_HIT = 솟는 순간 크게 한 번, CROSS_TICK = 빛이 남아 있는 동안 작게 두 번(분노 안 채움)
  //   데미지 합 = 4.6 + 0.5 x 2 = 5.6 (칼날 폭풍 약 5.7 · 성검 낙뢰 6.2 와 비슷하지만 넓은 범위의 모든 적이 다 맞음 = 몹 쓸기 최강)
  var CROSS_HIT = { dmg: 4.6, hitstop: 2.2, knock: 0.5, shake: 3.4, launch: 1.15, spark: 1.7, big: true, hitsDown: true,
                    flash: { color: '#fff6c8', alpha: 0.38, ms: 200 }, slowMs: 300 };
  var CROSS_TICK = { dmg: 0.5, hitstop: 0.4, knock: 0.1, shake: 0.6, spark: 0.9, hitsDown: true, noRage: true, noJuggle: true };
  // 성스러운 돌격: 금빛 방패에 싸여 돌진(그동안 안 맞음). 앞에 걸린 잡몹을 앞으로 밀고 가며 작게 여러 번(CHARGE_TICK) → 끝에 크게 터짐(CHARGE_BURST)
  var CHARGE_TICK = { dmg: 0.35, hitstop: 0.25, knock: 0.2, shake: 0.5, spark: 0.8, noRage: true, noJuggle: true };
  var CHARGE_BURST = { dmg: 4.2, hitstop: 2.4, knock: 3.0, shake: 3.6, knockdown: true, spark: 1.7, big: true, hitsDown: true,
                       flash: { color: '#fff2c0', alpha: 0.5, ms: 180 }, slowMs: 280 };
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
  // 칼날 폭풍 회오리 끝 터짐(2026-11-07): 넘어뜨리기 대신 크게 띄움(보스 · 큰 적은 휘청)
  var STORM_BURST = merge(STORM_LAST, { away: false, knockdown: false, launch: 1.2, knock: 0.6 });
  // ---------- 법사 기술 다시 짜기 (2026-11-08 형님 승인, 기사와 같은 짜임) ----------
  //   거리 값은 기사 새 기술(칼날 폭풍 · 심판의 십자)처럼 전부 화면 도트(actorScale 로 안 줄임, 아래 scaleActors 가 안 건드림)
  // 원소 파편(1차 Lv15, 늘 켜짐): 법사 마법(지팡이 타 · 마법탄 · 터짐 · 기술)이 맞으면 작은 불 · 얼음 조각이 둘레 적에게 튐.
  //   한 조각 = 이 값 x passive.val. 자주 나가서 가볍게: 작은 숫자(push) · 분노 안 채움 · 마나 안 채움(noMp) · 4번째 타 넘어짐 없음.
  //   eshard = 조각 표시(조각이 또 조각을 튀기지 않게, main.js onHit)
  var ESHARD_HIT = { dmg: 1.0, hitstop: 0.25, knock: 0.25, shake: 0.35, spark: 0.7, hitY: -40, hitsDown: true, noRage: true, noMp: true, noJuggle: true,
                     numStyle: 'push', eshard: true };
  // 중력 구체(1차 Lv17): 끌어당기는 동안 작게(GRAV_TICK, 가운데 가까운 적) → 크게 터짐(GRAV_BURST). 터질 때 거의 안 밀고(knock 0.35) 잠깐 멈춤(stunMs)
  //   = 한데 모인 채 그대로 → 화염구 · 번개 · 메테오로 이어 쓸어 버림(몰이사냥). 데미지 합 = 0.3 x 4 + 2.6 = 3.8 (화염구 3.3 보다 조금 셈, 대신 쿨타임 11초)
  var GRAV_TICK = { dmg: 0.3, hitstop: 0.2, knock: 0.05, shake: 0.4, spark: 0.7, hitsDown: true, noRage: true, noJuggle: true };
  var GRAV_BURST = { dmg: 2.6, hitstop: 2.0, knock: 0.35, shake: 3.0, stunMs: 650, spark: 1.5, big: true, hitsDown: true, noJuggle: true,
                     flash: { color: '#d8b0ff', alpha: 0.42, ms: 170 }, slowMs: 240 };
  // 마력 소용돌이(1차 Lv18, 늘 켜짐): 작은 소용돌이가 둘레 적을 모으며 작게 3번(VORTEX_TICK) → 톡 터짐(VORTEX_POP). 합 = 0.35 x 3 + 0.9 = 1.95 (x passive.mul)
  var VORTEX_TICK = { dmg: 0.35, hitstop: 0.2, knock: 0.05, shake: 0.3, spark: 0.7, hitsDown: true, noRage: true, noJuggle: true };
  var VORTEX_POP = { dmg: 0.9, hitstop: 0.8, knock: 0.3, shake: 1.0, spark: 1.0, hitsDown: true, noRage: true, noJuggle: true };
  // 원소 연쇄(대마법사 Lv28, 늘 켜짐): 법사 마법으로 쓰러진 적이 터짐(이 값 x passive.val). 터짐으로 쓰러진 적도 또 터짐(passive.chain 번까지)
  var ECHAIN_HIT = { dmg: 1.2, hitstop: 0.5, knock: 0.8, shake: 0.9, spark: 1.0, big: true, hitsDown: true, noRage: true, noJuggle: true };
  // 빙결 폭풍(대마법사 Lv35): 앞쪽 화면 대부분에 얼음 폭풍 → 작게 여러 번(FROST_TICK, 맞으면 얼어붙음 = 거의 멈춤) → 끝에 산산이 깨지며 크게(FROST_SHATTER, 넘어뜨림)
  //   데미지 합 = 0.55 x 6 + 2.4 = 5.7 (심판의 십자 5.6 과 비슷, 범위는 더 넓음 = 광역딜)
  var FROST_TICK = { dmg: 0.55, hitstop: 0.25, knock: 0.05, shake: 0.5, spark: 0.8, hitsDown: true, noRage: true, noJuggle: true };
  var FROST_SHATTER = { dmg: 2.4, hitstop: 1.8, knock: 1.6, shake: 3.2, knockdown: true, spark: 1.5, big: true, hitsDown: true,
                        flash: { color: '#e8fbff', alpha: 0.5, ms: 200 }, slowMs: 280 };
  // 천둥 심판(대마법사 Lv39, 폭딜 필살): 큰 번개 기둥 한 방(JUDGE_HIT 9.0 = 법사 기술 중 가장 센 한 방, 메테오 5.0) + 둘레 번개(JUDGE_BOLT)
  var JUDGE_HIT = { dmg: 9.0, hitstop: 2.6, knock: 2.6, shake: 4.5, knockdown: true, stunMs: 500, spark: 2.0, big: true, hitsDown: true,
                    flash: { color: '#ffffff', alpha: 0.75, ms: 260 }, slowMs: 420 };
  var JUDGE_BOLT = { dmg: 1.3, hitstop: 1.0, knock: 0.8, shake: 1.6, stunMs: 500, spark: 1.2, big: true, hitsDown: true, noJuggle: true,
                     flash: { color: '#e8ffff', alpha: 0.22, ms: 80 } };
  // ---------- 2차 전직 갈래 B (2026-11-08): 마검사(기사) · 흑마법사(법사). 효과 = 전부 우리 코드(skills.js 「갈래 B」) ----------
  //   거리 값은 대마법사 · 성기사 새 기술처럼 화면 도트(scaleActors 가 안 건드림. 단 차원 베기 move.dist 는 돌진베기처럼 줄어듦)
  //   데미지 = 같은 칸(Lv)의 갈래 A 기술과 비슷하게 맞춤(아래 「합」은 한 적이 다 맞을 때)
  // 마력 검기(마검사 Lv25 ↔ 칼날 폭풍 약 5.7): 보라 검기 3줄기(위아래로 조금씩 비켜 남) x 1.9 = 5.7. 꿰뚫음, 적마다 줄기마다 한 번
  var ARCW_HIT = { dmg: 1.9, hitstop: 0.55, knock: 0.9, shake: 1.0, spark: 1.2, big: true, hitY: -58, hitsDown: true };
  // 마력 부여(마검사 Lv28, 늘 켜짐): 가끔 칼끝에서 터지는 작은 마력(둘레 적, 기술 Lv 마다 조금 셈)
  var INFUSE_BURST = { dmg: 0.9, hitstop: 0.45, knock: 0.6, shake: 0.7, spark: 1.0, big: true, hitsDown: true, noRage: true, noJuggle: true };
  // 차원 베기(마검사 Lv31 ↔ 성검 낙뢰 6.2): 지나가며 벰 0.9 + 그 자리 균열이 터짐 3.4 = 4.3 (터짐은 한 적에게 한 번만). 줄 위 적이 다 맞으므로 한 적 몫은 낙뢰보다 낮게(시험: 고블린 3마리 합 낙뢰 254 ↔ 처음 값 484 → 낮춤)
  var RIFT_CUT = { dmg: 0.9, hitstop: 0.4, knock: 0.2, shake: 0.8, spark: 1.2, big: true, hitY: -56, hitsDown: true, noJuggle: true, noKnockdown: true };
  var RIFT_BOOM = { dmg: 3.4, hitstop: 1.8, knock: 1.4, shake: 2.6, launch: 0.9, spark: 1.5, big: true, hitsDown: true,
                    flash: { color: '#e0c0ff', alpha: 0.32, ms: 140 }, slowMs: 200 };
  // 마검 소환(마검사 Lv35 ↔ 심판의 십자 5.6): 마력 검 6자루 = 0.95 x 5 + 마지막 1.7 = 6.45 (한 적에게 다 꽂힐 때, 적이 많으면 나눠 꽂힘 · 꽂힌 둘레 r 도 맞음)
  var MSW_HIT = { dmg: 0.95, hitstop: 0.7, knock: 0.4, shake: 1.2, spark: 1.2, big: true, hitsDown: true, noJuggle: true, noRage: true };
  var MSW_LAST = { dmg: 1.7, hitstop: 1.6, knock: 1.8, shake: 2.4, knockdown: true, spark: 1.5, big: true, hitsDown: true,
                   flash: { color: '#e8d0ff', alpha: 0.35, ms: 150 }, slowMs: 200 };
  // 마검 해방(마검사 Lv39 필살 ↔ 성스러운 돌격 약 7.7): 거대한 마력 검 내리침 6.6 + 갈라진 땅 마력 1.0 = 7.6
  var UNL_HIT = { dmg: 6.6, hitstop: 2.6, knock: 2.4, shake: 4.4, knockdown: true, stunMs: 400, spark: 0.7, big: true, hitsDown: true,   // spark 2.0 → 0.7(2026-11-08 형님: 칼끝 큰 별 번쩍 뺌)
                  flash: { color: '#f0e0ff', alpha: 0.7, ms: 240 }, slowMs: 400 };
  var UNL_WAVE = { dmg: 1.0, hitstop: 0.6, knock: 0.6, shake: 1.4, spark: 1.1, big: true, hitsDown: true, noRage: true, noJuggle: true };
  // 어둠의 구체(흑마법사 Lv25 ↔ 메테오 5.0): 지나가며 0.22초마다 0.45(닿은 동안 약 5번 = 2.25) + 끝 터짐 4.2 = 약 6.4 (메테오처럼 적을 겨누지 않고 끝 자리에서 터져서 길 위 적 몫을 크게)
  var DORB_TICK = { dmg: 0.45, hitstop: 0.2, knock: 0.05, shake: 0.3, spark: 0.7, hitsDown: true, noRage: true, noJuggle: true, noMp: true };
  var DORB_BOOM = { dmg: 4.2, hitstop: 2.0, knock: 2.2, shake: 3.0, knockdown: true, spark: 1.5, big: true, hitsDown: true,
                    flash: { color: '#c080e0', alpha: 0.42, ms: 170 }, slowMs: 240 };
  // 저주의 늪(흑마법사 Lv31 ↔ 불기둥 3.8): 0.32초마다 0.2 x 10번 = 2.0 + 늪 안 적은 모든 공격에 +15% 아프게 · 느려짐(늪 안 적이 다 맞으므로 한 적 몫은 낮게)
  var SWAMP_TICK = { dmg: 0.2, hitstop: 0.15, knock: 0.02, shake: 0.25, spark: 0.6, hitsDown: true, noRage: true, noJuggle: true, noMp: true };
  // 악령 회오리(흑마법사 Lv35 ↔ 빙결 폭풍 5.7, 2026-11-08 망령 소환을 바꿈): 화면 안 적마다 0.3초마다 0.9 (2.2초 동안 6번, 시험 실측) = 약 5.4 (Lv5 2.6초 = 7번 약 6.3). 판정 = 보이는 화면 전체
  var SPIRIT_HIT = { dmg: 0.9, hitstop: 0.2, knock: 0.1, shake: 0.3, spark: 0.7, hitsDown: true, noRage: true, noJuggle: true };
  // 심연의 문(흑마법사 Lv39 필살 ↔ 천둥 심판 9.0 + 둘레 번개): 빨아들이는 동안 0.3 x 4 + 터짐 5.0 = 6.2, 둘레 적 모두(한 적 몫은 심판보다 낮고 넓게)
  var ABYSS_TICK = { dmg: 0.3, hitstop: 0.2, knock: 0.05, shake: 0.4, spark: 0.7, hitsDown: true, noRage: true, noJuggle: true };
  var ABYSS_BOOM = { dmg: 5.0, hitstop: 2.6, knock: 3.0, shake: 4.4, knockdown: true, stunMs: 300, spark: 2.0, big: true, hitsDown: true,
                     flash: { color: '#e0b0ff', alpha: 0.7, ms: 260 }, slowMs: 420 };
  // ---------- 궁수 기술 (2026-11-09, 효과 = AI 그림 art\skill-fx\ar_* · sn_* · rg_*, 움직임 = js/archer.js) ----------
  //   거리 값(arc 안)은 대마법사 · 성기사 새 기술처럼 화면 도트(scaleActors 가 안 건드림). move.dist · leap.h 는 원래 그림 도트(줄어듦)
  //   데미지 = 같은 칸(Lv)의 기사 · 법사 기술과 비슷하게(한 적이 다 맞을 때 「합」)
  // 관통 화살(1차 첫 기술 ↔ 돌진베기 1.9): 바람 화살 한 발이 줄 위 적을 모두 꿰뚫음 2.2
  var AR_PIERCE = { dmg: 2.2, hitstop: 0.8, knock: 1.6, shake: 1.4, spark: 1.3, big: true, hitsDown: true, flash: { color: '#e8fff4', alpha: 0.25, ms: 100 }, slowMs: 120 };
  // 솟구치는 화살(기본기 띄우기 ↔ 올려베기 1.5): 땅에 꽂힌 화살에서 바람 기둥 → 띄움
  var AR_UP = { launch: 1.1, dmg: 1.6, hitstop: 1.4, knock: 0.3, shake: 1.8, spark: 1.3, big: true, flash: { color: '#e0fff0', alpha: 0.25, ms: 110 }, slowMs: 140 };
  // 부채꼴 화살(Lv8 ↔ 검기 2.0): 화살 5발(위아래로 퍼짐) x 1.0, 한 적은 보통 2발쯤 = 2.0 / 몹 떼는 다 맞음
  var AR_FAN = { dmg: 1.0, hitstop: 0.5, knock: 1.0, shake: 0.8, spark: 1.0, big: true, hitsDown: true };
  // 화살비(Lv11 ↔ 회전베기 3.2): 0.14초마다 0.35 x 9 = 3.15 + 마지막 1.0 (넓은 범위, 누운 적도)
  var AR_RAIN = { dmg: 0.35, hitstop: 0.25, knock: 0.1, shake: 0.5, spark: 0.8, hitsDown: true, noRage: true, noJuggle: true };
  var AR_RAIN_LAST = { dmg: 1.0, hitstop: 1.2, knock: 1.2, shake: 1.8, knockdown: true, spark: 1.2, big: true, hitsDown: true, flash: { color: '#fff6c8', alpha: 0.25, ms: 120 } };
  // 공중제비 사격(Lv14 ↔ 내려찍기 2.5): 뛰기 전 발밑 바람(밀어냄 0.8) + 공중에서 아래로 화살 3발 x 0.9
  var AR_LEAPKICK = { reach: { x0: -50, x1: 70, yTop: -110, yBot: -2, depth: 26 }, away: true, dmg: 0.8, hitstop: 0.8, knock: 2.2, shake: 1.2, spark: 1.1, hitY: -50 };
  var AR_LEAP = { dmg: 0.9, hitstop: 0.6, knock: 1.4, shake: 1.0, spark: 1.1, big: true, hitsDown: true };
  // 폭발 화살(Lv17 ↔ 연속 찌르기 3.85): 처음 맞은 적(또는 끝)에서 크게 터짐 3.4 (둘레 넘어뜨림, 누운 적도)
  var AR_BOOM = { dmg: 3.4, hitstop: 2.0, knock: 2.6, shake: 3.0, knockdown: true, spark: 1.5, big: true, hitsDown: true, flash: { color: '#ffb060', alpha: 0.42, ms: 160 }, slowMs: 220 };
  // 갈래 화살(늘 켜짐): 평타 화살이 맞으면 작은 화살이 둘레 다른 적에게(이 값 x passive.val)
  var AR_SPLIT = { dmg: 1.0, hitstop: 0.2, knock: 0.3, shake: 0.3, spark: 0.7, noRage: true, noMp: true, noJuggle: true, numStyle: 'push', arSplit: true };
  // 자동 연사(늘 켜짐): 몇 초마다 가까운 적에게 저절로 날아가는 빛 화살(이 값 x passive.mul)
  var AR_AUTO = { dmg: 0.8, hitstop: 0.3, knock: 0.5, shake: 0.4, spark: 0.9, noRage: true, noMp: true, noJuggle: true, hitsDown: true, numStyle: 'push', arAuto: true };
  // ---- 저격수(2차 갈래 a) ----
  // 저격(25 ↔ 칼날 폭풍 5.7): 조준선 0.45초 → 한 줄 끝까지 빛줄기. 처음 맞은 적 6.0(늘 치명타) + 같은 줄 다른 적 2.0
  var SN_SNIPE = { dmg: 6.0, hitstop: 2.4, knock: 2.4, shake: 3.4, knockdown: true, spark: 1.8, big: true, hitsDown: true, crit: true, flash: { color: '#e8f6ff', alpha: 0.55, ms: 200 }, slowMs: 320 };
  var SN_SNIPE_LINE = { dmg: 2.0, hitstop: 0.8, knock: 1.4, shake: 1.2, spark: 1.2, big: true, hitsDown: true };
  // 대포 화살(31 ↔ 성검 낙뢰 6.2): 거대한 화살이 화면 끝까지 꿰뚫으며 밀고 감 4.6 + 지나간 자리 충격 0.8
  var SN_BALLISTA = { dmg: 4.6, hitstop: 1.8, knock: 3.4, shake: 3.0, knockdown: true, spark: 1.6, big: true, hitsDown: true, flash: { color: '#d8f0ff', alpha: 0.4, ms: 160 }, slowMs: 220 };
  // 속사(35 ↔ 심판의 십자 5.6): 바람 화살 8발 x 0.75 = 6.0 (한 줄, 1발씩 꿰뚫음 1)
  var SN_RAPID = { dmg: 0.75, hitstop: 0.4, knock: 0.6, shake: 0.6, spark: 1.0, big: true, hitsDown: true, noRage: true };
  // 천공의 일격(39 필살 ↔ 성스러운 돌격 7.7): 가장 센 적 위로 거대한 빛 화살 8.5 + 둘레 충격 2.0
  var SN_SKY = { dmg: 8.5, hitstop: 2.8, knock: 2.6, shake: 4.6, knockdown: true, stunMs: 500, spark: 2.0, big: true, hitsDown: true, flash: { color: '#ffffff', alpha: 0.7, ms: 260 }, slowMs: 420 };
  var SN_SKY_RING = { dmg: 2.0, hitstop: 1.0, knock: 2.0, shake: 1.6, knockdown: true, spark: 1.2, big: true, hitsDown: true };
  // ---- 레인저(2차 갈래 b) ----
  // 화살 폭풍(25 ↔ 칼날 폭풍 5.7): 앞으로 천천히 나아가는 넓은 화살비 0.16초마다 0.42 x 12 = 5.0 + 끝 1.2
  var RG_STORM = { dmg: 0.42, hitstop: 0.2, knock: 0.1, shake: 0.5, spark: 0.8, hitsDown: true, noRage: true, noJuggle: true };
  var RG_STORM_LAST = { dmg: 1.2, hitstop: 1.2, knock: 1.4, shake: 2.0, knockdown: true, spark: 1.3, big: true, hitsDown: true };
  // 매 동료(늘 켜짐): 몇 초마다 매가 적에게 내리꽂힘(이 값 x passive.mul)
  var RG_HAWK = { dmg: 1.6, hitstop: 0.8, knock: 1.2, shake: 1.0, spark: 1.1, big: true, hitsDown: true, noRage: true, noMp: true, numStyle: 'push', rgHawk: true };
  // 덫(31 ↔ 성검 낙뢰 6.2): 덫 3개 — 밟으면 묶임(stunMs) + 가시 덩굴 터짐 3.0 (덫마다 둘레 다 맞음)
  var RG_TRAP = { dmg: 3.0, hitstop: 1.6, knock: 0.4, shake: 2.2, stunMs: 1300, spark: 1.4, big: true, hitsDown: true, noJuggle: true, flash: { color: '#ffe0a0', alpha: 0.3, ms: 120 } };
  // 회오리 화살(35 ↔ 빙결 폭풍 5.7): 끌어당기며 0.25초마다 0.5 x 8 = 4.0 + 터짐 1.8
  var RG_TWIST = { dmg: 0.5, hitstop: 0.2, knock: 0.05, shake: 0.4, spark: 0.8, hitsDown: true, noRage: true, noJuggle: true };
  var RG_TWIST_LAST = { dmg: 1.8, hitstop: 1.6, knock: 2.4, shake: 2.6, knockdown: true, spark: 1.4, big: true, hitsDown: true, flash: { color: '#d8ffe0', alpha: 0.35, ms: 150 } };
  // 천 개의 화살(39 필살 ↔ 심연의 문 6.2): 화면 안 적마다 화살 묶음 0.2초마다 0.55 x 8 = 4.4 + 끝 2.4
  var RG_BARRAGE = { dmg: 0.55, hitstop: 0.25, knock: 0.15, shake: 0.6, spark: 0.9, hitsDown: true, noRage: true, noJuggle: true };
  var RG_BARRAGE_LAST = { dmg: 2.4, hitstop: 2.0, knock: 2.0, shake: 3.6, knockdown: true, spark: 1.6, big: true, hitsDown: true, flash: { color: '#fff6c8', alpha: 0.55, ms: 220 }, slowMs: 300 };
  var ARCHER_SKILLS = {
    // ---- 1차 ----
    // 관통 화살: 무릎 꿇고(motion_shoot) 힘 모아 바람 화살 한 발(줄 위 적 모두). Lv5 = 한 발 더
    pshot: {
      name: '관통 화살', icon: '관', mp: 6, cooldownMs: 4200, damageStyle: 'skill_arrow', motion: 'motion_shoot', sfx: 'bowHeavy',
      desc: '무릎 꿇고 힘을 모아 바람 화살을 쏴요. 줄 위의 적을 모두 꿰뚫고 밀어내요(누운 적도 맞아요)',
      lv5: { extra: 1, say: '화살 2발' },
      darken: { ms: 420, alpha: 0.35 }, iframes: [0, 420],
      motionSeq: [0, 1, 2, 3, 3, 5], motionMs: [60, 80, 80, 150, 90, 120],
      arc: { kind: 'pierce', frame: 4, x: 30, y: -34, speed: 560, range: 320, w: 60, h: 26, depth: 24, gapMs: 140, hit: AR_PIERCE },
      trail: { frames: [3, 4], everyMs: 35, lifeMs: 170, alpha: 0.35, color: '#a8ffd8' },
      fx: [ { frame: 0, type: 'dust' } ]
    },
    // 솟구치는 화살(기본기): 앞 땅에 화살을 꽂으면 바람 기둥이 솟아 적을 띄움
    upshot: {
      name: '솟구치는 화살', icon: '솟', mp: 9, cooldownMs: 6000, damageStyle: 'skill_arrow', launcher: true,
      desc: '앞쪽 땅에 화살을 꽂아 바람 기둥을 일으켜 적을 공중에 띄워요. 뜬 적은 평타·기술이 다 맞아요(보스·큰 적은 휘청만)',
      lv5: { area: 1.25, say: '바람 기둥 크기 +25%' },
      darken: { ms: 340, alpha: 0.3 }, iframes: [0, 300],
      arc: { kind: 'geyser', frame: 2, x: 62, r: 30, depth: 30, delayMs: 110, hit: AR_UP },
      placeholder: { anim: 'attack1', f: [0, 1, 2, 3], d: [60, 70, 170, 120] }
    },
    // 부채꼴 화살: 화살 다섯 발을 위아래로 퍼지게(2발씩 꿰뚫음). Lv5 = 일곱 발
    multi: {
      name: '부채꼴 화살', icon: '부', mp: 10, cooldownMs: 6000, damageStyle: 'skill_arrow', sfx: 'bowHeavy',
      desc: '화살 다섯 발을 부채꼴로 한꺼번에 쏴요. 위아래로 퍼진 몹 떼를 한 번에 쓸어요(화살마다 두 마리 꿰뚫음)',
      lv5: { n: 7, say: '화살 5발 → 7발' },
      darken: { ms: 360, alpha: 0.3 }, iframes: [0, 300],
      arc: { kind: 'fan', frame: 3, n: 5, lanes: [-30, -15, 0, 15, 30, -45, 45], x: 30, y: -36, speed: 600, range: 260, pierce: 2, hit: AR_FAN },
      placeholder: { anim: 'attack2', f: [0, 1, 2, 3, 4], d: [50, 60, 80, 120, 110] }
    },
    // 화살비: 하늘로 쏘아(motion_sky) 앞쪽 적들 위로 화살비가 내림(0.14초마다), 끝에 크게 박힘
    rain: {
      name: '화살비', icon: '비', mp: 14, cooldownMs: 8500, damageStyle: 'skill_arrow', motion: 'motion_sky', sfx: 'bowHeavy',
      desc: '하늘로 화살을 쏘아 앞쪽 넓은 땅에 화살비를 내려요. 여러 번 맞히고 끝에 크게 박혀 넘어뜨려요(누운 적도 맞아요)',
      lv5: { area: 1.3, say: '화살비 넓이 +30%' },
      darken: { ms: 700, alpha: 0.4 }, iframes: [0, 600], zoom: { k: 1.04, ms: 700, lv5: true },
      arc: { kind: 'rain', frame: 3, x: 110, aim: { range: 240, depth: 70 }, w: 70, depth: 44, delayMs: 300, ms: 1300, tickMs: 140, hit: AR_RAIN, last: AR_RAIN_LAST }
    },
    // 공중제비 사격: 발밑 바람으로 둘레를 밀쳐 내고 뒤로 공중제비(move 뒤로 · leap 위로) → 공중에서 아래 앞쪽으로 화살 3발
    leap: {
      name: '공중제비 사격', icon: '제', mp: 10, cooldownMs: 7000, damageStyle: 'skill_arrow', motion: 'motion_leap', sfx: 'bowShot',
      desc: '발밑 바람으로 둘레 적을 밀쳐 내고 뒤로 공중제비를 돌며 아래로 화살 세 발을 쏴요. 몸을 빼면서 쏘는 기술(쓰는 동안 안 밀려요)',
      lv5: { dist: 1.3, say: '뒤로 빠지는 거리 +30%' },
      iframes: [0, 560],
      move: { frames: [1, 3], dist: -150 },
      leap: { at: [70, 390], h: 70, fwd: 0 },
      hits: [ merge(AR_LEAPKICK, { frame: 0 }) ],
      arc: { kind: 'volley', frame: 3, n: 3, x: 26, y: -40, angs: [24, 34, 44], speed: 560, range: 200, hit: AR_LEAP },
      trail: { frames: [1, 3], everyMs: 30, lifeMs: 180, alpha: 0.35, color: '#a8ffd8' },
      fx: [ { frame: 0, type: 'dust' } ]
    },
    // 폭발 화살: 불 화살이 처음 맞은 적(또는 끝)에서 크게 터짐
    burst: {
      name: '폭발 화살', icon: '폭', mp: 14, cooldownMs: 8000, damageStyle: 'skill_fire', motion: 'motion_shoot', sfx: 'bowHeavy',
      desc: '터지는 화살을 쏴요. 처음 맞은 적(또는 날아간 끝)에서 크게 터져 둘레 적을 모두 넘어뜨려요(누운 적도 맞아요)',
      lv5: { area: 1.3, say: '폭발 크기 +30%' },
      darken: { ms: 520, alpha: 0.4 }, iframes: [0, 420],
      motionSeq: [0, 1, 2, 3, 3, 5], motionMs: [60, 80, 90, 180, 90, 120],
      arc: { kind: 'bomb', frame: 4, x: 30, y: -34, speed: 430, range: 280, r: 60, depth: 40, hit: AR_BOOM },
      fx: [ { frame: 0, type: 'dust' } ]
    },
    // ---- 저격수(2차 갈래 a) ----
    snipe: {
      name: '저격', icon: '저', mp: 22, cooldownMs: 11000, damageStyle: 'skill_snipe', motion: 'motion_shoot', sfx: 'charge',
      desc: '(2차) 무릎 꿇고 가장 센 앞쪽 적을 조준해요. 잠깐 뒤 은빛 빛줄기가 화면 끝까지 꿰뚫어요. 조준한 적은 늘 치명타, 같은 줄 적도 맞아요',
      lv5: { area: 1.25, say: '빛줄기 굵기 +25%' },
      darken: { ms: 1000, alpha: 0.55 }, iframes: [0, 900], zoom: { k: 1.05, ms: 900 },
      motionSeq: [0, 1, 2, 3, 3, 3, 5], motionMs: [60, 80, 90, 260, 260, 120, 140],
      arc: { kind: 'snipe', frame: 2, aim: { range: 460, depth: 80 }, lockMs: 470, x: 30, y: -34, len: 480, w: 18, depth: 24, hit: SN_SNIPE, line: SN_SNIPE_LINE, chainPad: 500 }
    },
    ballista: {
      name: '대포 화살', icon: '대', mp: 28, cooldownMs: 15000, damageStyle: 'skill_snipe', motion: 'motion_shoot', sfx: 'charge',
      desc: '(2차) 거대한 강철 화살을 쏴요. 화살은 천천히 날아가며 줄 위 적을 모두 꿰뚫고 앞으로 밀고 가요(누운 적도 맞아요)',
      lv5: { area: 1.3, say: '화살 크기 +30%' },
      darken: { ms: 900, alpha: 0.5 }, iframes: [0, 700], zoom: { k: 1.05, ms: 700 },
      motionSeq: [0, 1, 2, 3, 3, 5], motionMs: [60, 80, 100, 320, 100, 140],
      arc: { kind: 'ballista', frame: 4, x: 30, y: -34, speed: 300, range: 460, w: 90, h: 44, depth: 34, push: 1, hit: SN_BALLISTA }
    },
    rapid: {
      name: '속사', icon: '속', mp: 30, cooldownMs: 15000, damageStyle: 'skill_snipe', sfx: 'bowShot',
      desc: '(2차) 바람 화살 여덟 발을 눈 깜짝할 새 연달아 쏴요. 화살마다 한 마리씩 꿰뚫어요',
      lv5: { n: 11, say: '화살 8발 → 11발' },
      darken: { ms: 900, alpha: 0.42 }, iframes: [0, 900],
      motionMs: [60, 900, 120],
      arc: { kind: 'rapid', frame: 1, n: 8, gapMs: 95, x: 52, y: -36, speed: 720, range: 320, pierce: 1, hit: SN_RAPID },
      placeholder: { anims: ['attack1', 'attack1', 'attack1'], f: [0, 2, 3], d: [60, 900, 120] }
    },
    skyfall: {
      name: '천공의 일격', icon: '천', mp: 36, cooldownMs: 20000, damageStyle: 'skill_snipe', motion: 'motion_sky', sfx: 'charge',
      desc: '(2차 필살) 하늘로 쏜 화살이 가장 센 적 위에서 거대한 빛의 화살이 되어 내리꽂혀요. 둘레 적까지 크게 날려 버려요',
      lv5: { area: 1.25, say: '충격 범위 +25%' },
      darken: { ms: 1500, alpha: 0.6 }, iframes: [0, 1100], zoom: { k: 1.07, ms: 1300 },
      motionMs: [80, 110, 300, 140, 160, 160],
      arc: { kind: 'skyfall', frame: 3, aim: { range: 360, depth: 90 }, x: 140, markMs: 420, fallMs: 220, r: 92, depth: 50, hit: SN_SKY, ring: SN_SKY_RING, chainPad: 600 }
    },
    // ---- 레인저(2차 갈래 b) ----
    tempest: {
      name: '화살 폭풍', icon: '폭', mp: 22, cooldownMs: 12000, damageStyle: 'skill_wild', motion: 'motion_sky', sfx: 'bowHeavy',
      desc: '(2차) 하늘로 화살을 흩뿌려 넓은 화살 폭풍을 내려요. 폭풍은 천천히 앞으로 나아가며 여러 번 때리고 끝에 크게 박혀요(누운 적도 맞아요)',
      lv5: { area: 1.3, say: '폭풍 넓이 +30%' },
      darken: { ms: 800, alpha: 0.45 }, iframes: [0, 600], zoom: { k: 1.04, ms: 800 },
      arc: { kind: 'rain', frame: 3, x: 70, w: 100, depth: 50, delayMs: 260, ms: 1900, tickMs: 160, move: 70, density: 1.6, hit: RG_STORM, last: RG_STORM_LAST }
    },
    trap: {
      name: '덫 설치', icon: '덫', mp: 24, cooldownMs: 14000, damageStyle: 'skill_wild', sfx: 'bowShot',
      desc: '(2차) 앞쪽 땅에 덫 세 개를 던져요. 적이 밟으면 덫이 물어 묶고 가시 덩굴이 터져 둘레 적까지 크게 때려요(8초 뒤 저절로 터짐)',
      lv5: { n: 4, say: '덫 3개 → 4개' },
      darken: { ms: 500, alpha: 0.35 }, iframes: [0, 400],
      arc: { kind: 'trap', frame: 2, n: 3, xs: [70, 120, 170, 220], lifeMs: 8000, trig: 26, r: 52, depth: 36, hit: RG_TRAP },
      placeholder: { anim: 'attack2', f: [0, 1, 3, 4], d: [70, 80, 150, 140] }
    },
    twister: {
      name: '회오리 화살', icon: '회', mp: 34, cooldownMs: 16000, damageStyle: 'skill_wild', motion: 'motion_shoot', sfx: 'charge',
      desc: '(2차) 바람을 감은 화살이 큰 회오리가 되어 천천히 앞으로 나아가요. 둘레 적을 빨아들여 여러 번 때리고 끝에 터뜨려요',
      lv5: { area: 1.3, say: '회오리 크기 +30%' },
      darken: { ms: 900, alpha: 0.45 }, iframes: [0, 700],
      motionSeq: [0, 1, 2, 3, 3, 5], motionMs: [60, 80, 90, 220, 90, 120],
      arc: { kind: 'twister', frame: 4, x: 50, speed: 80, ms: 2000, r: 46, depth: 40, tickMs: 250, pullR: 140, pull: 110, hit: RG_TWIST, last: RG_TWIST_LAST }
    },
    barrage: {
      name: '천 개의 화살', icon: '천', mp: 40, cooldownMs: 22000, damageStyle: 'skill_wild', motion: 'motion_sky', sfx: 'charge',
      desc: '(2차 필살) 하늘 가득 화살을 쏘아 올려요. 화면 안 모든 적 위로 화살 묶음이 쏟아지고 끝에 한꺼번에 크게 박혀요',
      lv5: { n: 10, say: '화살 묶음 8번 → 10번' },
      darken: { ms: 2000, alpha: 0.6 }, iframes: [0, 1200], zoom: { k: 1.06, ms: 1400 },
      motionMs: [80, 110, 300, 160, 160, 160],
      arc: { kind: 'barrage', frame: 3, n: 8, gapMs: 200, depth: 40, r: 30, hit: RG_BARRAGE, last: RG_BARRAGE_LAST, chainPad: 800 }
    }
  };
  var SKILLS = {
    archer: ARCHER_SKILLS,
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
        // 2026-11-07 형님(검기가 약해 안 찍음): 기술 Lv1~5 마다 커짐. size = 검기 크기(그림 + 맞는 상자 같이, Lv5 = 1.8배),
        //   glow = 뒤 빛 · 날아가는 꼬리 세기, spark = 맞을 때 불똥 크기 · 수, hitstop · shake = 맞는 순간 멈춤 · 화면 흔들림 배율
        //   lv5Art = Lv5 금테 그림이 Lv1 그림보다 원래 큰 정도(그만큼 덜 키움 → 보이는 크기가 size 와 맞음). 꿰뚫기는 모든 Lv(길 위 적 전부), Lv5 = 검기 2번(lv5.extra)
        grow: { size: [1, 1.2, 1.4, 1.6, 1.8], glow: [1, 1.25, 1.5, 1.8, 2.1], spark: [1, 1.2, 1.4, 1.65, 1.9],
                hitstop: [1, 1.1, 1.2, 1.35, 1.5], shake: [1, 1.15, 1.3, 1.5, 1.7], lv5Art: 1.27 },
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
      // 올려베기(2026-11-06 밤 콤보): 웅크렸다가(0장) 칼을 아래에서 위로 베어 올려(1~3장 판정 = 적이 뜸) → 4장 내려섬.
      //   2026-11-06 새 동작 그림 motion_upper(4장): 0 낮게 웅크림(칼 뒤 아래) · 1 칼 낮게 앞 · 2 45도로 올려벤 자세 · 3 복귀.
      //   형님: 머리 위로 넘기는 장은 뺌(45도까지만) · 제자리(뛰지 않음, 적만 띄움). motionSeq 로 2장을 한 번 더 보여 줘 잠깐 멈춤
      //   베기 효과는 3장 칼끝을 따라 어깨~머리 높이에서 끝남(머리 위로는 안 넘김). 끝무렵에 다른 기술로 이어짐(캔슬)
      upper: {
        name: '올려베기', icon: '올', mp: 9, cooldownMs: 6000, damageStyle: 'skill_knight', launcher: true, motion: 'motion_upper',
        desc: '칼을 아래에서 위로 베어 올려 적을 공중에 띄워요. 뜬 적은 평타·기술이 다 맞아요(보스·큰 적은 휘청만)',
        lv5: { area: 1.25, say: '베는 범위 +25%' },
        darken: { ms: 360, alpha: 0.3 },
        iframes: [0, 300],
        motionSeq: [0, 1, 2, 2, 3],
        motionMs: [110, 45, 60, 120, 150],
        hits: [ merge(UPPER_HIT, { frames: [1, 3] }) ],
        fx: [
          { frame: 0, type: 'dust' },
          { frame: 1, type: 'slash', x: 58, y: -52, rot: 48, sx: 1.1, sy: 1.15, tint: '#a8d4ff', ms: 260 },
          { frame: 2, type: 'sparkup', x: 44, y: -40, color: '#cfe8ff' }
        ],
        placeholder: { anims: ['attack3', 'attack2', 'attack2', 'attack2', 'attack2'], f: [0, 3, 3, 3, 4], d: [110, 45, 60, 120, 150] },
        // 여: 같은 4 자세를 더 빠르게(가볍고 날렵하게)
        female: {
          motionMs: [90, 40, 55, 110, 130],
          fx: [
            { frame: 0, type: 'dust' },
            { frame: 1, type: 'slash', x: 60, y: -52, rot: 46, sx: 1.05, sy: 1.1, tint: '#a8d4ff', ms: 240 },
            { frame: 2, type: 'sparkup', x: 52, y: -40, color: '#cfe8ff' }
          ],
          placeholder: { anims: ['jump', 'motion_dash', 'motion_dash', 'motion_dash', 'attack3'], f: [0, 2, 3, 3, 5], d: [90, 40, 55, 110, 130] }
        }
      },
      // 칼날 폭풍(2026-11-06, Lv19 사냥 기술): 회전베기 동작 그림(motion_spin)의 한 바퀴(1~4장)를 세 번 되풀이 → 13장 마무리 베기 → 14장 가드.
      //   motionSeq = 기술 장 번호 → 동작 그림 장 번호(같은 그림을 되풀이해서 씀), motionMs = 기술 장마다 시간(hits·fx 의 frame 은 기술 장 번호)
      //   도는 동안 걸을 수 있음(walk). 한 바퀴에 두 번씩 여섯 번 베며 둘레 적을 끌어당기고(STORM_HIT pull), 마지막에 크게 터뜨려 넘어뜨림.
      //   효과 = 있는 회전 고리 그림(spin_ring)을 바퀴마다 + 코드로 그린 회오리(whirl: 바람 고리·강철 파편·빛). 새 그림 없음
      //   sfx = 쓰기 시작 소리(sfx.js 의 기술 소리 표에 없는 기술), fx 'sound' = 그 장에 있는 소리(바퀴마다 skSpin, 마지막 skSlam)
      // 칼날 폭풍(2026-11-07 형님: 회전베기와 똑같아 보임 → 바꿈): 기사는 돌지 않고 칼을 앞으로 내질러(돌진베기 동작 그림의 찌르기 장을 잠깐 멈춤)
      //   큰 칼날 회오리를 내보냄. 회오리(코드 그림, 무기 속성 색) = 땅을 따라 천천히 앞으로 가며 둘레 적을 끌어당기고 여러 번 벰 → 끝에 크게 터져 띄움
      //   tornado = { frame = 내보내는 장, x = 나오는 앞 거리, speed = 1초에 도트, ms = 버티는 시간(+ msPerLv x (Lv-1)), r · h = 회오리 반지름 · 높이,
      //     depth = 위아래 폭, tickMs = 베는 간격, pullR · pull = 끌어당기는 거리 · 1초에 도트(보스 · 중간보스 빼고), hit = 벨 때, last = 끝 터짐, color = 속성 없을 때 색 }
      //   크기 = 기술 Lv 크기(area, Lv5 +30%), 데미지 · 쿨타임 · 마나는 예전과 비슷(베기 0.55 x 6~8번 + 터짐 1.9)
      //   예전(돌며 세 바퀴) 값은 지움 — 회전베기(spin)는 그대로
      storm: {
        name: '칼날 폭풍', icon: '폭', mp: 20, cooldownMs: 12000, damageStyle: 'skill_knight', motion: 'motion_dash', sfx: 'skSpin',
        desc: '칼을 앞으로 내질러 큰 칼날 회오리를 날려요. 회오리는 천천히 앞으로 가며 둘레 적을 끌어당겨 여러 번 베고, 끝에 크게 터지며 적을 띄워요(누운 적도 맞아요)',
        lv5: { area: 1.3, say: '회오리 크기 +30%' },
        darken: { ms: 700, alpha: 0.4 },
        iframes: [0, 560],
        motionSeq: [0, 1, 2, 3, 3, 4, 5],
        motionMs: [110, 60, 60, 120, 260, 140, 120],
        tornado: { frame: 3, x: 70, speed: 70, ms: 1900, msPerLv: 0.08, r: 58, h: 130, depth: 40, tickMs: 300, firstMs: 150, pullR: 150, pull: 90,
                   hit: STORM_HIT, last: STORM_BURST, color: '#4a9cff' },
        fx: [
          { frame: 0, type: 'dust' },
          { frame: 3, type: 'slash', x: 50, y: -52, rot: 0, sx: 1.3, sy: 0.6, tint: '#cfe8ff', ms: 220 },
          { frame: 3, type: 'sound', name: 'skSpin' }
        ],
        placeholder: { anim: 'attack1', f: [0, 1, 2, 3, 3, 4, 4], d: [110, 60, 60, 120, 260, 140, 120] },
        female: {
          motionMs: [90, 50, 50, 110, 240, 130, 110],
          placeholder: { anim: 'attack1', f: [0, 1, 2, 3, 3, 3, 3], d: [90, 50, 50, 110, 240, 130, 110] }
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
      // 연속 찌르기(1차 Lv17, 2026-11-08 형님 승인): 새 그림 없음 = 평타 1타 그림의 「팔 당김 ↔ 찌름」 두 장을 빠르게 되풀이(다섯 번) → 크게 한 번 찌르며 밀쳐 넘어뜨림.
      //   기술 장 번호: 0 준비 · 1~10 (당김, 찌름) x 5 · 11 크게 당김 · 12 크게 찌름 · 13 복귀. 찌르는 장(2 · 4 · 6 · 8 · 10)마다 판정 + 코드로 그린 찌르기 줄(thrust)
      //   찌르는 동안 앞으로 조금씩 나감(move). Lv5 = 찌르기 길이 +25%(area)
      thrust: {
        name: '연속 찌르기', icon: '찌', mp: 10, cooldownMs: 6000, damageStyle: 'skill_knight', sfx: 'skDash',
        desc: '앞으로 빠르게 다섯 번 찌른 뒤 크게 한 번 찔러 적을 밀쳐 넘어뜨려요',
        lv5: { area: 1.25, say: '찌르기 길이 +25%' },
        darken: { ms: 500, alpha: 0.3 },
        iframes: [0, 300],
        move: { frames: [1, 12], dist: 34 },
        hits: [ merge(THRUST_HIT, { frame: 2 }), merge(THRUST_HIT, { frame: 4 }), merge(THRUST_HIT, { frame: 6 }), merge(THRUST_HIT, { frame: 8 }),
                merge(THRUST_HIT, { frame: 10 }), merge(THRUST_LAST, { frame: 12 }) ],
        trail: { frames: [11, 12], everyMs: 30, lifeMs: 170, alpha: 0.35, color: '#a8d4ff' },
        fx: [
          { frame: 2, type: 'thrust', x: 40, y: -64, len: 92, color: '#cfe8ff', ms: 130 }, { frame: 4, type: 'thrust', x: 40, y: -56, len: 96, color: '#cfe8ff', ms: 130 },
          { frame: 6, type: 'thrust', x: 40, y: -68, len: 92, color: '#cfe8ff', ms: 130 }, { frame: 8, type: 'thrust', x: 40, y: -60, len: 100, color: '#cfe8ff', ms: 130 },
          { frame: 10, type: 'thrust', x: 40, y: -64, len: 96, color: '#cfe8ff', ms: 130 },
          { frame: 12, type: 'thrust', x: 44, y: -62, len: 140, color: '#ffffff', ms: 220 }, { frame: 12, type: 'sound', name: 'skWave' }, { frame: 12, type: 'dust' }
        ],
        // 남: 평타 그림 2장(팔 앞) ↔ 3장(내지름) / 여: 3장(당김) ↔ 2장(내지름)
        placeholder: { anim: 'attack1', f: [0, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 4], d: [90, 35, 55, 35, 55, 35, 55, 35, 55, 35, 55, 110, 160, 140] },
        female: { placeholder: { anim: 'attack1', f: [0, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 0], d: [90, 35, 55, 35, 55, 35, 55, 35, 55, 35, 55, 110, 160, 140] } }
      },
      // 심판의 십자(성기사 Lv35, 2026-11-08 형님 승인): 칼을 머리 위로 들었다(1~2장) 땅에 내리꽂으면(3장) 기사 앞 땅에 금빛 십자가 새겨지고
      //   telegraphMs(0.4초) 뒤 십자 줄을 따라 금빛 빛기둥이 위로 솟으며 터짐 → 넓은 범위(가로 len x 2, 위아래 depth) 안 적 전부.
      //   cross = { frame = 십자가 새겨지는 장, x = 십자 가운데까지 앞 거리, len = 긴 줄 반 길이(가로), arm = 가로대 반 길이(위아래 방향),
      //            depth = 위아래 판정 폭, telegraphMs, ticks · tickMs = 남은 빛이 작게 더 때림, hit · tick }
      //   grow = 기술 Lv1~5 마다 커짐(검기 날리기처럼): size = 십자 크기(그림 + 판정 같이, 기술 Lv 크기 area 에 더 곱함 → Lv5 약 1.4배), glow = 빛 세기, hitstop · shake = 타격감 배율
      //   Lv5 = 빛기둥이 한 번 더 솟음(lv5.again, 첫 터짐의 60% 데미지). 그림 = 우리 코드(skills.js drawCross), 소리 = 있는 소리(skHoly · holyBolt · skSlam)
      cross: {
        name: '심판의 십자', icon: '십', mp: 34, cooldownMs: 16000, damageStyle: 'skill_holy', sfx: 'skHoly',
        desc: '(2차) 칼을 땅에 내리꽂아 앞쪽 넓은 땅에 금빛 십자를 새겨요. 잠깐 뒤 십자에서 빛이 솟구쳐 범위 안 적을 모두 크게 때리고 띄워요(누운 적도 맞아요)',
        lv5: { again: 0.6, say: '빛기둥이 한 번 더 솟음' },
        darken: { ms: 1100, alpha: 0.5 },
        iframes: [0, 900],
        zoom: { k: 1.05, ms: 900 },
        cross: { frame: 3, x: 125, len: 115, arm: 46, depth: 56, telegraphMs: 400, ticks: 2, tickMs: 180, hit: CROSS_HIT, tick: CROSS_TICK },
        grow: { size: [1, 1.03, 1.06, 1.09, 1.12], glow: [1, 1.15, 1.3, 1.45, 1.65], hitstop: [1, 1.08, 1.16, 1.25, 1.35], shake: [1, 1.1, 1.2, 1.32, 1.45] },
        fx: [ { frame: 0, type: 'dust' }, { frame: 3, type: 'dust' } ],
        // 남: 3타 그림(0 웅크림 → 2 칼 머리 위 → 3 내리침 → 4 깊이 꽂음, 빛이 솟을 때까지 버팀 → 5 일어섬)
        placeholder: { anims: ['attack3', 'attack3', 'attack3', 'attack3', 'attack3', 'attack3'], f: [0, 2, 3, 4, 4, 5], d: [100, 150, 70, 440, 220, 160] },
        // 여: 돌진베기 3장(칼 머리 위) → 3타 2장(낮게 내리꽂는 자세)에서 버팀 → 서기
        female: {
          placeholder: { anims: ['attack3', 'motion_dash', 'motion_dash', 'attack3', 'attack3', 'attack3'], f: [0, 3, 3, 2, 2, 0], d: [90, 150, 70, 440, 220, 160] }
        }
      },
      // 성스러운 돌격(성기사 Lv39, 2026-11-08 형님 승인): 금빛 방패(barrier)에 싸여 앞으로 돌진 → 앞에 걸린 잡몹을 밀고 감 → 끝에 크게 터짐.
      //   동작 = 돌진베기 동작 그림(motion_dash)의 돌진 자세를 길게(motionSeq) → 마무리 베기 장에서 터짐.
      //   barrier = { frames = 방패가 있는 장(그동안 안 맞음 = 슈퍼아머보다 셈) }, move = 돌진(돌진베기와 같은 방식, Lv5 = 더 멀리)
      //   charge = { reach = 앞에서 밀고 가는 상자(front = 기사 앞 몇 도트에 붙여 밂), tickMs = 밀며 작게 때리는 간격, tick,
      //              burst = { frame = 터지는 장, x = 앞 거리, r = 반지름, depth, hit } }
      charge: {
        name: '성스러운 돌격', icon: '격', mp: 28, cooldownMs: 14000, damageStyle: 'skill_holy', motion: 'motion_dash', sfx: 'skDash',
        desc: '(2차) 금빛 방패에 싸여 앞으로 돌진해요. 앞의 적을 밀고 가다가 끝에서 크게 터뜨려 날려 버려요. 돌진하는 동안 안 맞아요',
        lv5: { dist: 1.3, say: '돌진 거리 +30%' },
        darken: { ms: 900, alpha: 0.42 },
        iframes: { frames: [0, 5] },
        barrier: { frames: [0, 5] },
        motionSeq: [0, 1, 2, 1, 2, 3, 4, 5],
        motionMs: [110, 110, 110, 110, 110, 150, 140, 130],
        move: { frames: [1, 4], dist: 230 },
        charge: { reach: { x0: -10, x1: 76, depth: 36 }, front: 46, tickMs: 110, tick: CHARGE_TICK,
                  burst: { frame: 5, x: 56, r: 120, depth: 52, hit: CHARGE_BURST } },
        trail: { frames: [1, 5], everyMs: 35, lifeMs: 220, alpha: 0.42, color: '#ffd86a' },
        fx: [ { frame: 0, type: 'dust' }, { frame: 1, type: 'dust' } ],
        placeholder: { anim: 'attack1', f: [0, 1, 1, 1, 1, 3, 4, 4], d: [110, 110, 110, 110, 110, 150, 140, 130] },
        // 여: 1장(수평 돌진) 을 길게 → 2장(올려베기)에서 터짐
        female: {
          motionSeq: [0, 1, 1, 1, 1, 2, 4, 5],
          placeholder: { anim: 'attack1', f: [0, 1, 1, 1, 1, 2, 3, 3], d: [110, 110, 110, 110, 110, 150, 140, 130] }
        }
      },
      // ---- 마검사(2차 전직 갈래 B, 2026-11-08) : 효과 = 전부 우리 코드(skills.js 「갈래 B」) ----
      // 마력 검기: 검기 날리기처럼 휘둘러(공격 그림) 2장부터 보라 검기 n 줄기를 gapMs 간격으로 날림(lanes = 줄기마다 위아래 비킴, 화면 도트)
      //   awave = { frame, n, gapMs, x, y = 나오는 앞 거리 · 높이, lanes, speed, range, w · h = 검기 크기(판정 = w), depth, hit }
      arcwave: {
        name: '마력 검기', icon: '마', mp: 20, cooldownMs: 12000, damageStyle: 'skill_arcane', sfx: 'skWave',
        desc: '(2차) 칼을 크게 휘둘러 보라색 마력 검기 세 줄기를 앞으로 날려요. 검기는 길 위의 적을 모두 꿰뚫어요(누운 적도 맞아요)',
        lv5: { n: 4, say: '검기 3줄기 → 4줄기' },
        darken: { ms: 600, alpha: 0.4 },
        iframes: [0, 400],
        awave: { frame: 2, n: 3, gapMs: 90, x: 26, y: -34, lanes: [0, -14, 14, -7], speed: 400, range: 330, w: 26, h: 62, depth: 20, hit: ARCW_HIT },
        trail: { frames: [1, 3], everyMs: 35, lifeMs: 180, alpha: 0.38, color: '#c890ff' },
        fx: [ { frame: 2, type: 'slash', x: 30, y: -62, rot: -8, sx: 1.5, sy: 1.3, tint: '#c890ff', ms: 220 } ],
        placeholder: { anim: 'attack1', f: [0, 1, 3, 3, 3, 4], d: [80, 50, 130, 120, 110, 110] }
      },
      // 차원 베기: 돌진베기 동작으로 순식간에 앞으로(move) → 지나간 줄 위 적을 벰(cut) + 그 자리에 차원 균열 → delayMs 뒤 차례로(gapMs) 터짐(boom, 한 적에게 한 번)
      //   rift = { depth = 베는 위아래 폭, delayMs, gapMs, r · rdepth = 균열 터짐 둘레, cut, boom }
      rift: {
        name: '차원 베기', icon: '차', mp: 30, cooldownMs: 18000, damageStyle: 'skill_arcane', motion: 'motion_dash', sfx: 'blink',
        desc: '(2차) 눈 깜짝할 새 앞으로 순간 돌진하며 길 위의 적을 모두 베어요. 잠깐 뒤 벤 자리마다 보랏빛 차원 균열이 터져 크게 때려요(누운 적도 맞아요)',
        lv5: { dist: 1.3, say: '돌진 거리 +30%' },
        darken: { ms: 1000, alpha: 0.5 },
        iframes: { frames: [0, 5] },
        move: { frames: [1, 2], dist: 300 },
        rift: { depth: 32, delayMs: 380, gapMs: 70, r: 44, rdepth: 34, cut: RIFT_CUT, boom: RIFT_BOOM },
        trail: { frames: [1, 3], everyMs: 18, lifeMs: 260, alpha: 0.5, color: '#b46aff' },
        fx: [ { frame: 0, type: 'dust' }, { frame: 3, type: 'slash', x: 20, y: -62, rot: 0, sx: 1.8, sy: 0.7, tint: '#c890ff', ms: 240 } ],
        placeholder: { anim: 'attack1', f: [0, 1, 3, 3, 4, 4], d: [140, 70, 70, 90, 120, 160] },
        female: { placeholder: { anim: 'attack1', f: [0, 1, 2, 2, 3, 3], d: [90, 60, 80, 70, 140, 120] } }
      },
      // 마검 소환: 성검 낙뢰처럼 칼을 하늘로 들면 머리 위에 마력 검 n 자루가 나타남(appearMs) → gapMs 마다 하나씩 가까운 적에게 날아가 꽂힘(flyMs).
      //   swords = { frame, n, appearMs, gapMs, flyMs, aim, x = 적이 없을 때 앞 거리들, r · depth = 꽂히는 둘레, stayMs, hit, last }
      msword: {
        name: '마검 소환', icon: '소', mp: 34, cooldownMs: 16000, damageStyle: 'skill_arcane', sfx: 'charge',
        desc: '(2차) 머리 위에 마력 검 여섯 자루를 불러내요. 검이 하나씩 차례로 날아가 가까운 적부터 꿰찔러요(적이 적으면 같은 적을 또 찔러요). 마지막 검은 적을 넘어뜨려요',
        lv5: { n: 8, say: '마력 검 6자루 → 8자루' },
        darken: { ms: 1500, alpha: 0.5 },
        iframes: [0, 1000],
        zoom: { k: 1.05, ms: 1200 },
        swords: { frame: 1, n: 6, appearMs: 280, gapMs: 115, flyMs: 140, aim: { range: 300, depth: 80 }, x: [60, 100, 140, 180, 220, 260], r: 40, depth: 32, stayMs: 380,
                  hit: MSW_HIT, last: MSW_LAST },
        fx: [ { frame: 0, type: 'dust' }, { frame: 1, type: 'beam', x: 34, y: -128, ms: 900, color: '#d8b0ff' } ],
        placeholder: { anims: ['attack3', 'attack2', 'attack2', 'attack2'], f: [0, 3, 3, 4], d: [140, 160, 820, 240] },
        female: {
          fx: [ { frame: 0, type: 'dust' }, { frame: 1, type: 'beam', x: 20, y: -132, ms: 900, color: '#d8b0ff' } ],
          placeholder: { anims: ['jump', 'motion_dash', 'motion_dash', 'attack3'], f: [0, 2, 2, 5], d: [140, 160, 820, 240] }
        }
      },
      // 마검 해방(필살, 2026-11-08 그림 바꿈): 칼을 머리 위로 들고 버티면(frame) 칼끝에 검은 기운이 모임 → strike 장에 내리침 → 칼끝 땅에서 검은 기운 덩어리가
      //   travelMs 동안 앞으로 땅을 타고 부풀며 밀려감(앞머리가 지나가는 적에게 hit) → 흩어질 때(waveMs 뒤) 줄 위 적 모두 wave
      //   cleave = { frame, strike, x = 내리치는 땅 시작(앞 거리), len = 길이, depth, h = 덩어리 가장 높은 키(그림, x0.78), w = (안 씀), travelMs, waveMs, hit, wave }
      unleash: {
        name: '마검 해방', icon: '해', mp: 32, cooldownMs: 16000, damageStyle: 'skill_arcane', sfx: 'charge',
        desc: '(2차 필살) 칼에 마력을 한껏 모아 땅을 내리쳐요. 칼끝에서 검은 기운이 솟아 앞쪽 땅을 타고 점점 크게 부풀며 밀려가, 지나가는 적을 크게 때리고 흩어질 때 한 번 더 때려요(누운 적도 맞아요)',
        lv5: { area: 1.25, say: '내리치는 범위 +25%' },
        darken: { ms: 1700, alpha: 0.62 },
        iframes: [0, 1300],
        zoom: { k: 1.07, ms: 1300 },
        cleave: { frame: 1, strike: 3, x: 16, len: 230, depth: 58, h: 200, w: 30, travelMs: 380, waveMs: 260, hit: UNL_HIT, wave: UNL_WAVE },
        fx: [ { frame: 0, type: 'dust' }, { frame: 3, type: 'dust' } ],
        placeholder: { anims: ['attack3', 'attack3', 'attack3', 'attack3', 'attack3', 'attack3'], f: [0, 2, 2, 3, 4, 5], d: [110, 260, 420, 70, 420, 180] },
        female: {
          placeholder: { anims: ['attack3', 'motion_dash', 'motion_dash', 'attack3', 'attack3', 'attack3'], f: [0, 3, 3, 2, 2, 0], d: [90, 260, 420, 70, 420, 180] }
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
    // 견습 기본기(2026-11-07 형님): 전직 전에도 띄우기 하나 = 「올려치기」. 기술 점수 없이 늘 있음, 1번 칸(견습은 1번 칸만 열림, 나머지는 전직하면)
    //   새 그림 없음: 남 = attack2 의 4번째 장(주먹을 위로 올려치는 자세), 여 = attack3 의 4번째 장(위로 치솟는 주먹). 띄우기 = 올려베기와 같은 방식(UPPER_HIT, 더 약하게)
    //   전직하면 직업 띄우기 기술로 바뀜(config skills.basic: 기사 올려베기 · 법사 땅 융기 = 공짜 Lv1, 1번 칸)
    novice: {
      nupper: {
        name: '올려치기', icon: '올', mp: 0, cooldownMs: 3500, damageStyle: 'skill_knight', launcher: true,
        desc: '주먹을 아래에서 위로 올려쳐 적을 공중에 띄워요. 뜬 적은 평타가 다 맞아요(보스·큰 적은 휘청만)',
        iframes: [0, 200],
        hits: [ merge(UPPER_HIT, { frames: [2, 3], reach: { x0: -6, x1: 92, yTop: -140, yBot: -4, depth: 28 }, launch: 0.85, dmg: 1.0, hitstop: 1.2, shake: 1.2, spark: 1.0,
                                   flash: { color: '#fff4d8', alpha: 0.2, ms: 90 }, slowMs: 90 }) ],
        fx: [
          { frame: 0, type: 'dust' },
          { frame: 2, type: 'sparkup', x: 34, y: -64, color: '#fff2c0' }
        ],
        placeholder: { anims: ['attack2', 'attack2', 'attack2', 'attack2', 'attack2'], f: [0, 1, 3, 3, 4], d: [80, 60, 70, 150, 140] },
        female: { placeholder: { anims: ['attack3', 'attack3', 'attack3', 'attack3', 'attack3'], f: [1, 2, 3, 3, 2], d: [80, 60, 70, 150, 140] } }
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
      // 빙산 솟구치기(2026-11-08 형님, 얼음창을 바꿈 · id 는 그대로 'ice' = 저장 · 기술 점수 · 칸 그대로): 「앞으로 던지기」 동작.
      //   3장(여 2장)부터 법사 바로 앞 땅에서 얼음이 하나씩 솟아 앞으로 나아감(가까운 건 작게 → 멀수록 크게) → 마지막에 송곳처럼 뾰족한 큰 빙산.
      //   효과 = 전부 우리 코드(skills.js 빙산). 법사가 다른 걸 해도 얼음 줄은 그대로. 값 = 위 ICE_CRAG
      ice: {
        name: '빙하 균열', icon: '균', mp: 10, cooldownMs: 6000, damageStyle: 'skill_ice', motion: 'motion_cast_forward', launcher: true, sfx: 'iceSpear',
        desc: '땅이 갈라지며 앞쪽으로 기운 얼음이 줄줄이 이어져 솟아 나아가요. 앞으로 갈수록 커지며 적을 살짝 띄우고, 마지막 뾰족한 빙산이 적을 높이 띄워요. 맞은 적은 잠깐 얼었다가 느려져요(보스·큰 적은 휘청만)',
        lv5: { n: 7, big: 1.15, say: '얼음 7개로 더 길게 · 마지막 빙산 +15%' },
        darken: { ms: 700, alpha: 0.32 },
        iframes: { frames: [0, 3] },
        crag: ICE_CRAG,
        fx: [ { frame: 3, type: 'spark', x: 127, y: -65, scale: 1.4, tint: '#bff4ff' } ],
        placeholder: { anim: 'attack3', f: [0, 1, 2, 3, 4, 5], d: [80, 90, 60, 150, 110, 110] },
        female: {
          crag: merge(ICE_CRAG, { frame: 2 }),
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
      },
      // ---- 법사 새 기술 (2026-11-08 형님 승인, 효과 = 전부 우리 코드 skills.js) ----
      // 중력 구체(1차 Lv17, 몰이사냥): 「앞으로 던지기」 동작(화염구와 같음)으로 느린 보라 구체를 던짐 → dist 만큼 날아가거나 적에 닿으면 멈춤 →
      //   holdMs(1.2초) 동안 넓은 둘레(pullR, 위아래 pullDepth)의 잡몹을 가운데로 세게 끌어당김(끌리는 동안 어질 = 느려짐) → 크게 터짐.
      //   grav = { frame = 던지는 장, x · y = 나오는 곳(화면 도트), speed = 1초에 도트, dist = 최대 날아가는 거리, orb = 구체 반지름,
      //            pullR · pullDepth = 끌어당기는 둘레, pullK = 끌어당기는 세기(클수록 빨리 가운데로), holdMs, tickMs · tick = 끌리는 동안 작게,
      //            r · depth = 터짐 둘레, hit = 터짐 }. 보스 · 중간보스 · 소품은 안 끌림(데미지만). Lv5 = 끄는 둘레 · 터짐 +30%
      gravity: {
        name: '중력 구체', icon: '중', mp: 16, cooldownMs: 11000, damageStyle: 'skill_arcane', motion: 'motion_cast_forward', sfx: 'charge',
        desc: '느린 보라 구체를 앞으로 던져요. 멈춘 자리에서 넓은 둘레의 적을 가운데로 세게 끌어당긴 뒤 크게 터져요(모인 적은 잠깐 멈춤 = 이어서 쓸어 버리기 좋아요)',
        lv5: { area: 1.3, say: '끌어당기는 범위 · 폭발 +30%' },
        darken: { ms: 520, alpha: 0.35 },
        iframes: { frames: [0, 3] },
        grav: { frame: 3, x: 66, y: -36, speed: 170, dist: 120, orb: 12, pullR: 175, pullDepth: 70, pullK: 7, holdMs: 1200,
                tickMs: 300, tick: GRAV_TICK, r: 78, depth: 40, hit: GRAV_BURST },
        fx: [ { frame: 3, type: 'spark', x: 127, y: -65, scale: 1.4, tint: '#c890ff' } ],
        placeholder: { anim: 'attack3', f: [0, 1, 2, 3, 4, 5], d: [80, 90, 60, 150, 110, 110] },
        female: {
          grav: { frame: 2, x: 47, y: -41, speed: 170, dist: 120, orb: 12, pullR: 175, pullDepth: 70, pullK: 7, holdMs: 1200,
                  tickMs: 300, tick: GRAV_TICK, r: 78, depth: 40, hit: GRAV_BURST },
          fx: [ { frame: 2, type: 'spark', x: 85, y: -75, scale: 1.4, tint: '#c890ff' } ],
          placeholder: { anim: 'attack3', f: [0, 1, 2, 3, 4], d: [70, 90, 150, 140, 150] }
        }
      },
      // 빙결 폭풍(대마법사 Lv35, 광역딜): 「하늘로 들기」 동작. 3장에 앞쪽 넓은 땅(가운데 x 앞, 가로 반 w, 위아래 depth = 화면 앞쪽 대부분)에 얼음 폭풍.
      //   ms 동안 tickMs 마다 작게(tick) + 맞은 적은 얼어붙음(freeze: ms 동안 시간이 mul 배 = 거의 멈춤, 보스 bossMul) → 끝에 깨지며 크게(shatter, 넘어뜨림).
      //   frost = { frame, x, w, depth, ms, firstMs, tickMs, tick, shatter, freeze }. 법사가 다른 걸 해도 폭풍은 그대로. Lv5 = 폭풍 범위 +25%
      frost: {
        name: '빙결 폭풍', icon: '빙', mp: 38, cooldownMs: 18000, damageStyle: 'skill_ice', motion: 'motion_cast_sky', sfx: 'charge',
        desc: '(2차) 앞쪽 화면 대부분에 얼음 폭풍을 일으켜요. 여러 번 맞히며 적을 얼려 멈추게 하고, 끝에 산산이 깨지며 크게 때려 넘어뜨려요(누운 적도 맞아요)',
        lv5: { area: 1.25, say: '폭풍 범위 +25%' },
        darken: { ms: 1400, alpha: 0.5 },
        iframes: { frames: [0, 2] },
        zoom: { k: 1.04, ms: 900 },
        frost: { frame: 3, x: 165, w: 165, depth: 62, ms: 1500, firstMs: 150, tickMs: 220, tick: FROST_TICK, shatter: FROST_SHATTER,
                 freeze: { ms: 1500, mul: 0.06, bossMul: 0.6 } },
        placeholder: { anim: 'attack2', f: [0, 1, 2, 3, 3, 3, 4], d: [80, 90, 60, 160, 160, 110, 100] },
        female: {
          placeholder: { anim: 'attack3', f: [0, 1, 2, 2, 2, 3, 4], d: [80, 90, 160, 160, 120, 80, 70] }
        }
      },
      // 천둥 심판(대마법사 Lv39, 폭딜 필살): 「하늘로 들기」 동작의 1~2장을 길게(모으기 약 0.6초, 지팡이 끝에서 하늘로 빛 줄기) →
      //   1장에 과녁을 정함(앞쪽 range 안: 보스 > 중간보스 > 체력이 가장 많은 적, 없으면 앞 x) → lockMs 전까지 따라감 →
      //   3장에 하늘에서 거대한 번개 기둥(r · depth = 판정, hit = 9.0 한 방) + 둘레 번개 bolts 줄기(다른 적 가까운 순, 모자라면 둘레 빈 땅, spread 안)
      //   화면 하얗게 번쩍 · 크게 흔들림 · 멈춤. Lv5 = 둘레 번개 5 → 8줄기
      judgment: {
        name: '천둥 심판', icon: '천', mp: 40, cooldownMs: 22000, damageStyle: 'skill_bolt', motion: 'motion_cast_sky', sfx: 'charge',
        motionMs: [110, 220, 380, 90, 260, 170],
        desc: '(2차 필살) 잠깐 힘을 모은 뒤 가장 센 적(보스 먼저)에게 거대한 번개 기둥을 내리꽂아요. 법사 기술 중 가장 센 한 방 + 둘레에 번개가 여러 줄기 더 떨어져요',
        lv5: { bolts: 8, say: '둘레 번개 5 → 8줄기' },
        darken: { ms: 1500, alpha: 0.62 },
        iframes: { frames: [0, 3] },
        zoom: { k: 1.07, ms: 1100 },
        judge: { frame: 1, strike: 3, x: 140, aim: { range: 300, depth: 70 }, lockMs: 110, r: 34, depth: 36, hit: JUDGE_HIT,
                 bolts: 5, spread: 120, boltR: 22, boltDepth: 28, gapMs: 60, boltHit: JUDGE_BOLT },
        fx: [ { frame: 1, type: 'beam', x: 30, y: -130, ms: 700, color: '#bff8ff' } ],
        placeholder: { anim: 'attack2', f: [0, 1, 2, 3, 3, 4], d: [110, 220, 380, 90, 260, 170] },
        female: {
          motionMs: [80, 210, 360, 70, 240, 160],
          fx: [ { frame: 1, type: 'beam', x: 20, y: -128, ms: 700, color: '#bff8ff' } ],
          placeholder: { anim: 'attack3', f: [0, 1, 2, 2, 3, 4], d: [80, 210, 360, 70, 240, 160] }
        }
      },
      // ---- 흑마법사(2차 전직 갈래 B, 2026-11-08) : 효과 = 전부 우리 코드(skills.js 「갈래 B」) ----
      // 어둠의 구체: 「앞으로 던지기」 동작(중력 구체와 같음)으로 느린 검은 구체 → dist 만큼 굴러가며 tickMs 마다 둘레(r, depth) 적을 깎음(살짝 느려짐) → 끝에서 크게 터짐(boom, br · bdepth)
      darkorb: {
        name: '어둠의 구체', icon: '구', mp: 30, cooldownMs: 16000, damageStyle: 'skill_dark', motion: 'motion_cast_forward', sfx: 'charge',
        desc: '(2차) 느리게 나아가는 검은 구체를 앞으로 보내요. 구체가 지나가는 동안 닿은 적을 계속 깎고, 끝에서 크게 터져 둘레 적을 넘어뜨려요(누운 적도 맞아요)',
        lv5: { area: 1.3, say: '구체 · 폭발 크기 +30%' },
        darken: { ms: 700, alpha: 0.42 },
        iframes: { frames: [0, 3] },
        dorb: { frame: 3, x: 60, y: -36, speed: 85, dist: 220, orb: 14, r: 34, depth: 30, tickMs: 220, tick: DORB_TICK, br: 100, bdepth: 46, boom: DORB_BOOM },
        fx: [ { frame: 3, type: 'spark', x: 127, y: -65, scale: 1.4, tint: '#a040c0' } ],
        placeholder: { anim: 'attack3', f: [0, 1, 2, 3, 4, 5], d: [80, 90, 60, 150, 110, 110] },
        female: {
          dorb: { frame: 2, x: 44, y: -41, speed: 85, dist: 220, orb: 14, r: 34, depth: 30, tickMs: 220, tick: DORB_TICK, br: 100, bdepth: 46, boom: DORB_BOOM },
          fx: [ { frame: 2, type: 'spark', x: 85, y: -75, scale: 1.4, tint: '#a040c0' } ],
          placeholder: { anim: 'attack3', f: [0, 1, 2, 3, 4], d: [70, 90, 150, 140, 150] }
        }
      },
      // 저주의 늪: 「하늘로 들기」 동작. 3장에 앞쪽 가까운 적 발밑(없으면 x 앞)에 늪 → ms 동안 tickMs 마다 작게(tick) + 늪 안 적 = 느려짐(slow 배) · 모든 공격 +curse(저주, 늪을 나가도 curseMs 동안)
      //   swamp = { frame, x, aim, w = 가로 반지름, depth, ms, tickMs, tick, slow, curse, curseMs }
      swamp: {
        name: '저주의 늪', icon: '늪', mp: 18, cooldownMs: 9000, damageStyle: 'skill_dark', motion: 'motion_cast_sky', sfx: 'charge',
        desc: '(2차) 앞쪽 땅에 검보라 저주의 늪을 펼쳐요. 늪 안의 적은 느려지고, 계속 피해를 입고, 모든 공격에 더 아프게 맞아요',
        lv5: { area: 1.3, say: '늪 크기 +30%' },
        darken: { ms: 800, alpha: 0.4 },
        iframes: { frames: [0, 2] },
        swamp: { frame: 3, x: 120, aim: { range: 230, depth: 60 }, w: 78, depth: 34, ms: 3200, tickMs: 320, tick: SWAMP_TICK, slow: 0.5, curse: 0.15, curseMs: 700 },
        placeholder: { anim: 'attack2', f: [0, 1, 2, 3, 3, 3, 4], d: [80, 90, 60, 160, 160, 110, 100] },
        female: {
          placeholder: { anim: 'attack3', f: [0, 1, 2, 2, 2, 3, 4], d: [80, 90, 160, 160, 120, 80, 70] }
        }
      },
      // 악령 회오리(2026-11-08 망령 소환을 바꿈, 기술 id 는 그대로 wraith = 배운 점수 그대로): 「하늘로 들기」 동작. 3장에 법사 발밑 검은 마법진(circle) →
      //   검은 악령 n 마리가 화면 끝에서 몰려와 ms 동안 화면 전체를 크게 휘돎(배경 dim 만큼 어둡게). 보이는 화면 가로 전체 x 법사 줄 위아래 depth 안 적은
      //   firstMs 뒤부터 적마다 hitMs 마다 hit 한 번. 각성 마력 폭주 = 끝에 한 번 더 휩쓺(hit x echoK)
      //   spirits = { frame, n, ms, firstMs, hitMs, depth, hit, circle = 마법진 반지름, dim = 어둡기, echoK }
      wraith: {
        name: '악령 회오리', icon: '악', mp: 38, cooldownMs: 18000, damageStyle: 'skill_dark', motion: 'motion_cast_sky', sfx: 'charge',
        desc: '(2차) 검은 악령 떼를 불러내 화면 전체를 휘감는 회오리를 일으켜요. 화면 안의 적은 몇 초 동안 악령에게 여러 번 맞아요(누운 적도 맞아요) — 몹 떼 사냥에 좋아요',
        lv5: { n: 19, ms: 2600, say: '악령 13 → 19마리 · 회오리 +0.4초' },   // 2026-11-08 형님: 악령 5마리 줄임(데미지는 적마다 따로라 그대로)
        darken: { ms: 900, alpha: 0.45 },
        iframes: { frames: [0, 2] },
        spirits: { frame: 3, n: 13, ms: 2200, firstMs: 250, hitMs: 300, depth: 100, hit: SPIRIT_HIT, circle: 46, dim: 0.3, echoK: 1.5 },
        placeholder: { anim: 'attack2', f: [0, 1, 2, 3, 3, 3, 4], d: [80, 90, 60, 160, 160, 110, 100] },
        female: {
          placeholder: { anim: 'attack3', f: [0, 1, 2, 2, 2, 3, 4], d: [80, 90, 160, 160, 120, 80, 70] }
        }
      },
      // 심연의 문(필살): 천둥 심판처럼 모았다가(1~2장 길게) 3장에 앞쪽(가까운 적 쪽, 없으면 x 앞)에 거대한 검은 문 → openMs 동안 열림 →
      //   holdMs 동안 둘레(pullR, pullDepth) 잡몹을 세게 빨아들이며 tickMs 마다 작게 → 크게 터짐(boom, r · depth). 보스 · 중간보스는 안 끌림(데미지만)
      abyss: {
        name: '심연의 문', icon: '문', mp: 40, cooldownMs: 22000, damageStyle: 'skill_dark', motion: 'motion_cast_sky', sfx: 'charge',
        motionMs: [110, 220, 380, 90, 260, 170],
        desc: '(2차 필살) 앞쪽에 거대한 검은 문을 열어요. 문이 둘레의 적을 세게 빨아들인 뒤 크게 터져 모두 날려 버려요(보스 · 큰 적은 안 끌려와도 터짐에는 맞아요)',
        lv5: { area: 1.25, say: '빨아들이는 범위 · 폭발 +25%' },
        darken: { ms: 2300, alpha: 0.65 },
        iframes: { frames: [0, 3] },
        zoom: { k: 1.06, ms: 1500 },
        abyss: { frame: 3, x: 150, aim: { range: 260, depth: 70 }, pullR: 220, pullDepth: 80, pullK: 5, openMs: 260, holdMs: 1300, tickMs: 320, tick: ABYSS_TICK,
                 r: 120, depth: 60, h: 120, boom: ABYSS_BOOM },
        fx: [ { frame: 1, type: 'beam', x: 30, y: -130, ms: 700, color: '#c060ff' } ],
        placeholder: { anim: 'attack2', f: [0, 1, 2, 3, 3, 4], d: [110, 220, 380, 90, 260, 170] },
        female: {
          motionMs: [80, 210, 360, 70, 240, 160],
          fx: [ { frame: 1, type: 'beam', x: 20, y: -128, ms: 700, color: '#c060ff' } ],
          placeholder: { anim: 'attack3', f: [0, 1, 2, 2, 3, 4], d: [80, 210, 360, 70, 240, 160] }
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
// 2026-11-08 형님 승인: 기사 2차(성기사) 기술 = tier: 2 (2차 전직 뒤 Lv25 칼날 폭풍 · 28 신성 가호 · 31 성검 낙뢰 · 35 심판의 십자 · 39 성스러운 돌격)
//   2026-11-08 형님 승인(2): 2차 전직 Lv30 → 25 + 1차 기사 다시 배치(아래 knight 순서 = 기술 창 순서). 새 기술 칼날 파편 · 연속 찌르기 · 끌어당기는 검압
//   → 기사 17개(쓰는 기술 10 + 늘 켜진 기술 7). 1차 기사 = 반격(Lv24)까지. 법사는 그대로
//   예전 저장: 지금 Lv 보다 늦게 열리게 바뀐 기술(예: Lv22 저장의 반격 21 → 24, 2차 전 칼날 폭풍 · 성검 낙뢰)은 저장을 읽을 때 빠짐(growth.js openLv)
//     = 그 기술에 쓴 점수는 안 쓴 점수로 돌아옴(기술 칸에 끼운 것도 저절로 빈 칸)
  //   short = 기술 창(책 모양, 2026-11-06 폰 UI) 칸에 쓰는 짧은 설명 한 줄(긴 설명 desc 는 칸에 손을 올리면 · 고르면 보임)
  // ---------- 갈래 맛(2026-11-08 형님 승인): Lv25 2차 갈래를 고르면 1차 기술 6개가 갈래마다 이름 · 그림 · 작은 덤이 바뀜 ----------
  //   그림 = AI 그림(art\skill-fx-branch\<기술>_<a|b>, 게임 assets/fx/aifx/bx_<그림>_<a|b>) — 장 수 · 기준점이 원래 그림과 같아 skills.js 가 묶음만 바꿔 끼움
  //   names[기술] = [이름, 덤 설명(기술 창에 「갈래 덤」으로 보임)]. 2차 전(Lv24 까지)은 원래 이름 · 그림 · 동작 그대로
  //   tw = 덤 숫자(작게 = 갈래 맛, 세기 올리기 아님):
  //     성기사 a: stunMs = 맞은 적 잠깐 기절(보스 · 중간보스 · 레이드는 없음), healPct = 쓸 때마다 최대 체력 x 만큼 참,
  //               shieldPct · shieldMs = 쓸 때마다 금빛 보호막(최대 체력 x 만큼 피해를 대신 받음, 겹치지 않고 새로 채움)
  //     마검사 b: burstMs 뒤 맞은 자리에서 작은 마력 터짐(burstDmg = 무기 피해 배율, burstR · burstD = 둘레, 한 적에 한 번 burstIcd 마다),
  //               mpPerHit = 맞힐 때 마나 돌려받음(한 번 쓸 때 mpCap 까지)
  //     대마법사 a: area = 효과 · 판정 크기 배율(+20%)
  //     흑마법사 b: 맞은 적에 저주 curseMs: dotMs 마다 dotDmg(저주를 건 그 타 피해의 x, 움찔 없음 · 저주로는 안 쓰러짐 = 체력 1 남김) · 그 적이 주는 피해 -weak, steal = 기술 피해의 x 만큼 체력(1초에 최대 체력 stealCap 까지)
  //   color = 잔상 · 베기 줄 · 빛 색
  var BRANCH_FX = {
    knight: {
      a: { tag: '신성', color: '#ffd86a', tw: { stunMs: 350, healPct: 0.01, shieldPct: 0.03, shieldMs: 3000 },
           names: { dash: ['신성 돌진', '맞은 적 잠깐 기절 · 쓸 때 체력 1% 회복 + 금빛 보호막(최대 체력 3%, 3초)'],
                    upper: ['성광 올려베기', '맞은 적 잠깐 기절 · 쓸 때 체력 1% 회복 + 금빛 보호막(최대 체력 3%, 3초)'],
                    wave: ['성검기', '맞은 적 잠깐 기절 · 쓸 때 체력 1% 회복 + 금빛 보호막(최대 체력 3%, 3초)'],
                    spin: ['심판 회전베기', '맞은 적 잠깐 기절 · 쓸 때 체력 1% 회복 + 금빛 보호막(최대 체력 3%, 3초)'],
                    slam: ['신성 내려찍기', '맞은 적 잠깐 기절 · 쓸 때 체력 1% 회복 + 금빛 보호막(최대 체력 3%, 3초)'],
                    thrust: ['성창 찌르기', '맞은 적 잠깐 기절 · 쓸 때 체력 1% 회복 + 금빛 보호막(최대 체력 3%, 3초)'] } },
      b: { tag: '마력', color: '#b46aff', tw: { burstMs: 450, burstDmg: 0.35, burstR: 36, burstD: 26, burstIcd: 300, mpPerHit: 1, mpCap: 4 },
           names: { dash: ['마력 돌진', '맞은 자리에 0.45초 뒤 작은 마력 터짐 · 맞히면 마나 1 돌려받음(한 번에 4까지)'],
                    upper: ['마력 올려베기', '맞은 자리에 0.45초 뒤 작은 마력 터짐 · 맞히면 마나 1 돌려받음(한 번에 4까지)'],
                    wave: ['마검기', '맞은 자리에 0.45초 뒤 작은 마력 터짐 · 맞히면 마나 1 돌려받음(한 번에 4까지)'],
                    spin: ['마력 회전베기', '맞은 자리에 0.45초 뒤 작은 마력 터짐 · 맞히면 마나 1 돌려받음(한 번에 4까지)'],
                    slam: ['마력 내려찍기', '맞은 자리에 0.45초 뒤 작은 마력 터짐 · 맞히면 마나 1 돌려받음(한 번에 4까지)'],
                    thrust: ['마검 찌르기', '맞은 자리에 0.45초 뒤 작은 마력 터짐 · 맞히면 마나 1 돌려받음(한 번에 4까지)'] } }
    },
    mage: {
      a: { tag: '원소', color: '#ffe08a', tw: { area: 1.2 },
           names: { fireball: ['대화염구', '더 크고 화려하게 · 효과 · 범위 +20%'], rise: ['대지 융기', '더 크고 화려하게 · 효과 · 범위 +20%'],
                    bolt: ['천뢰', '더 크고 화려하게 · 효과 · 범위 +20%'], ice: ['대빙하 균열', '더 크고 화려하게 · 효과 · 범위 +20%'],
                    blink: ['원소 도약', '더 크고 화려하게 · 효과 · 범위 +20%'], gravity: ['대중력 구체', '더 크고 화려하게 · 효과 · 범위 +20%'] } },
      b: { tag: '어둠', color: '#a040d0', tw: { curseMs: 3000, dotMs: 500, dotDmg: 0.05, weak: 0.1, steal: 0.02, stealCap: 0.02 },
           names: { fireball: ['흑염구', '맞은 적에 저주 3초(0.5초마다 작은 피해 · 그 적의 공격 -10%) · 준 피해의 2% 체력 흡수'],
                    rise: ['저주 융기', '맞은 적에 저주 3초(0.5초마다 작은 피해 · 그 적의 공격 -10%) · 준 피해의 2% 체력 흡수'],
                    bolt: ['흑뢰', '맞은 적에 저주 3초(0.5초마다 작은 피해 · 그 적의 공격 -10%) · 준 피해의 2% 체력 흡수'],
                    ice: ['흑빙 균열', '맞은 적에 저주 3초(0.5초마다 작은 피해 · 그 적의 공격 -10%) · 준 피해의 2% 체력 흡수'],
                    blink: ['그림자 이동', '맞은 적에 저주 3초(0.5초마다 작은 피해 · 그 적의 공격 -10%) · 준 피해의 2% 체력 흡수'],
                    gravity: ['심연 중력', '맞은 적에 저주 3초(0.5초마다 작은 피해 · 그 적의 공격 -10%) · 준 피해의 2% 체력 흡수'] } }
    },
    // 궁수(2026-11-09): 저격수 a = 은빛 · 얼음(치명타 확률 +acrit, 맞은 적 slowMs 동안 느려짐) / 레인저 b = 숲 · 바람(맞으면 작은 가시 화살 thorns 마리에게 튐 · 맞은 적 vineMs 동안 가시 지속 피해)
    //   덤 처리 = js/archer.js(onHit). 그림 = AI 그림을 갈래 색으로 다시 칠한 것(art/skill-fx/ar_*_a|b, archer_brfx.py)
    archer: {
      a: { tag: '저격', color: '#bfe6ff', tw: { acrit: 0.15, slowMs: 1200, slowK: 0.65 },
           names: { pshot: ['은빛 관통 화살', '치명타 확률 +15% · 맞은 적 1.2초 느려짐'], upshot: ['은빛 솟구침', '치명타 확률 +15% · 맞은 적 1.2초 느려짐'],
                    multi: ['저격 부채꼴', '치명타 확률 +15% · 맞은 적 1.2초 느려짐'], rain: ['은빛 화살비', '치명타 확률 +15% · 맞은 적 1.2초 느려짐'],
                    leap: ['저격 공중제비', '치명타 확률 +15% · 맞은 적 1.2초 느려짐'], burst: ['빙결 폭발 화살', '치명타 확률 +15% · 맞은 적 1.2초 느려짐'] } },
      b: { tag: '숲', color: '#b8ff7a', tw: { thorns: 1, thornDmg: 0.3, vineMs: 2000, vineTick: 500, vineDmg: 0.06 },
           names: { pshot: ['덩굴 관통 화살', '맞으면 가시 화살이 둘레 적 하나에게 튐 · 맞은 적에 가시 2초(0.5초마다 작은 피해)'],
                    upshot: ['돌개바람 솟구침', '맞으면 가시 화살이 둘레 적 하나에게 튐 · 맞은 적에 가시 2초(0.5초마다 작은 피해)'],
                    multi: ['숲의 부채꼴', '맞으면 가시 화살이 둘레 적 하나에게 튐 · 맞은 적에 가시 2초(0.5초마다 작은 피해)'],
                    rain: ['바람 화살비', '맞으면 가시 화살이 둘레 적 하나에게 튐 · 맞은 적에 가시 2초(0.5초마다 작은 피해)'],
                    leap: ['바람 공중제비', '맞으면 가시 화살이 둘레 적 하나에게 튐 · 맞은 적에 가시 2초(0.5초마다 작은 피해)'],
                    burst: ['가시 폭발 화살', '맞으면 가시 화살이 둘레 적 하나에게 튐 · 맞은 적에 가시 2초(0.5초마다 작은 피해)'] } }
    },
    // 늘 켜진 기술 추천 갈래(SKILL_TREE 의 rec): 그 갈래면 효과 x recK(+25%). 마력 소용돌이는 「몇 초마다」라 시간이 1/recK 로 짧아짐(recInv)
    recK: 1.25
  };
  // 마력 터짐 한 번(마검사 갈래 덤)
  var BR_BURST = { dmg: 1, hitstop: 0.25, knock: 0.2, shake: 0.4, spark: 0.8, hitsDown: true, noRage: true, noJuggle: true, numStyle: 'push', brBurst: true };
  // rec = 추천 2차 갈래(2026-11-08): 그 갈래를 고르면 늘 켜진 기술 효과 +25%(BRANCH_FX.recK). 기사: 버티기(강철 피부 · 투지 · 반격) → 성기사, 공격(검 숙련 · 칼날 파편 · 검압) → 마검사
  //   법사: 원소 힘 · 마나(원소 증폭 · 원소 파편 · 마나 순환) → 대마법사, 깎고 버티기(원소 낙인 = 저주 같은 약화 · 마력 소용돌이 = 끌어당김 · 마나 방패) → 흑마법사
  var SKILL_TREE = {
    knight: [
      // 전직(1차) 때: 돌진베기 = 첫 기술 점수(firstPts 1)로 배움, 올려베기 = 기본기(config skills.basic, 공짜 Lv1 + 1번 칸)
      { id: 'dash', unlock: 0, short: '앞으로 미끄러지며 베요' },
      // 2026-11-08: 올려베기는 기본기라 늘 열려 있음 → unlock 0(예전 Lv10 은 기술 창에 「Lv10」처럼 헷갈리게 보일 수 있어 지움)
      { id: 'upper', unlock: 0, short: '적을 공중에 띄워요' },
      // 2026-11-08 형님: 날렵한 몸놀림(기사 · 법사 같음) = charges = 회피 연달아 2번(기본 1번), val = 두 번 다 쓴 뒤 쿨타임(ms, 기본 1800 → 1200), refillMs = 하나만 썼을 때 돌아오는 시간(470), dist = 회피 거리 +30%. maxLv 1 = 1점만 찍음(기술마다 최고 Lv, 없으면 skills.maxLv)
      { id: 'nimble', unlock: 7, maxLv: 1, short: '회피 2번 연달아 · 쿨타임이 줄고 더 멀리 빠져요', name: '날렵한 몸놀림', icon: '날',
        desc: '회피를 2번 연달아 쓸 수 있고, 쿨타임이 줄고(두 번 다 쓴 뒤 1.8초 → 1.2초) 더 멀리 빠져요 · 1번만 찍을 수 있어요',
        passive: { stat: 'nimble', charges: [2], val: [1200], refillMs: [470], dist: [0.3] } },
      { id: 'wave', unlock: 8, short: '초승달 검기를 날려요' },                  // 2026-11-08 Lv13 → 8
      { id: 'mastery', unlock: 9, rec: 'b', short: '검 공격이 세져요', name: '검 숙련', icon: '숙', desc: '검으로 하는 모든 공격(콤보·기술)이 세져요',
        passive: { stat: 'phys', val: [0.08, 0.12, 0.16, 0.2, 0.25] } },
      { id: 'spin', unlock: 11, short: '한 바퀴 돌며 세 번 베요' },              // 2026-11-08 Lv8 → 11
      { id: 'skin', unlock: 12, rec: 'a', short: '받는 피해가 줄어요', name: '강철 피부', icon: '피', desc: '적에게 받는 피해가 줄어요',
        passive: { stat: 'guard', val: [0.05, 0.08, 0.11, 0.14, 0.18] } },      // 2026-11-08 Lv11 → 12
      { id: 'slam', unlock: 14, short: '뛰어올라 땅을 내려찍어요' },            // 2026-11-08 Lv15 → 14
      // 2026-11-08 새 늘 켜진 기술: passive.stat 'shards' = 기사가 적을 쓰러뜨리면 그 자리에서 칼날 파편이 튀어 둘레 적을 때림.
      //   val = 파편 데미지 배율(SHARD_HIT 에 곱함), r = 반지름(도트), depth = 위아래 폭, chain = 파편으로 쓰러진 적이 또 파편을 튀기는 최대 횟수(무한 반복 없음)
      { id: 'shards', unlock: 15, rec: 'b', short: '쓰러뜨린 적에서 칼날이 튀어요', name: '칼날 파편', icon: '편', desc: '적을 쓰러뜨리면 그 자리에서 칼날 파편이 사방으로 튀어 둘레 적을 때려요(파편으로 쓰러진 적도 두 번까지 또 튀김)',
        passive: { stat: 'shards', val: [0.6, 0.75, 0.9, 1.05, 1.2], r: [70, 78, 86, 94, 104], depth: 36, chain: 2, hit: SHARD_HIT } },
      { id: 'thrust', unlock: 17, short: '빠르게 다섯 번 찌르고 밀쳐요' },
      // 2026-11-08 새 늘 켜진 기술: passive.stat 'pull' = 평타 콤보 3타(마무리)를 휘두를 때 둘레 잡몹을 기사 앞으로 끌어당김.
      //   val = 끌어당기는 반지름(도트), ms = 끌려오는 시간, front = 기사 앞 어디로(도트). 보스 · 중간보스 · 누운 적 · 공중 적 · 소품은 안 끌려옴
      { id: 'pressure', unlock: 18, rec: 'b', short: '3타에 둘레 적을 앞으로 끌어와요', name: '끌어당기는 검압', icon: '압', desc: '평타 콤보 마지막(3타)을 휘두르면 검압이 일어 둘레 적을 기사 앞으로 끌어당겨요(보스 · 큰 적은 안 끌려옴)',
        passive: { stat: 'pull', val: [90, 100, 112, 124, 140], ms: 110, front: 44 } },
      // 2차(2026-11-06 넣음): passive.stat 'grit' = 체력이 from(비율) 밑으로 내려가면 물리 공격이 오르기 시작해 full 이하에서 val(최대)
      //   'counter' = 맞을 때(넘어지지 않는 보통 타, 가까운 적) val 확률로 되받아 베기(SKILLS.knight.counterSlash), reach = 그 적까지 거리
      { id: 'grit', unlock: 21, rec: 'a', short: '체력이 적을수록 검이 세져요', name: '투지', icon: '투', desc: '체력이 90% 밑으로 줄수록 검 공격이 세져요(30% 이하에서 가장 셈). 세지면 발밑에 붉은 기운이 일어요',
        passive: { stat: 'grit', val: [0.2, 0.25, 0.3, 0.35, 0.4], from: 0.9, full: 0.3 } },   // 2026-11-08 Lv17 → 21
      { id: 'counter', unlock: 24, rec: 'a', short: '맞는 순간 되받아 베요', name: '반격', icon: '반', desc: '맞는 순간(넘어지지 않는 보통 타) 확률로 바로 되받아 베어요. 1.5초에 한 번까지',
        passive: { stat: 'counter', val: [0.3, 0.35, 0.4, 0.45, 0.5], reach: 140 } },   // 2026-11-08 Lv21 → 24
      // ---- 성기사(2차 전직, 2026-11-08 형님 승인) ----
      // tier: 2 = 2차 전직(config classes.<직업>.tier2, 기사 Lv25 = 성기사)을 한 뒤에만 열림 + 그 기술 Lv(unlock)가 돼야 함.
      //   전직할 때 공짜로 주는 Lv 없음(기술 점수로 배움). 2차 전 기술 창에는 자물쇠 + 「2차 LvN」
      //   칼날 폭풍(예전 Lv19) · 성검 낙뢰(예전 Lv23)를 1차에서 2차로 옮김
      { id: 'storm', unlock: 25, tier: 2, branch: 'a', short: '칼날 회오리를 앞으로 보내요' },   // 2026-11-06 사냥 기술(몹 떼를 끌어모아 쓸어 버림), 2026-11-08 Lv19 → 2차 Lv25
      // passive.stat 'regen' = 1초마다 최대 체력의 val 만큼 체력이 참(늘). 켜져 있으면 몸 둘레에 옅은 금빛 기운
      { id: 'aegis', unlock: 28, tier: 2, branch: 'a', short: '체력이 천천히 차요', name: '신성 가호', icon: '가', desc: '성스러운 힘이 몸을 감싸 체력이 늘 조금씩 차요. 몸 둘레에 옅은 금빛 기운이 감돌아요',
        passive: { stat: 'regen', val: [0.004, 0.005, 0.006, 0.007, 0.008] } },
      { id: 'holy', unlock: 31, tier: 2, branch: 'a', short: '금빛 번개 칼을 내리꽂아요' },      // 2026-11-08 Lv23 → 2차 Lv31
      { id: 'cross', unlock: 35, tier: 2, branch: 'a', short: '땅의 십자에서 빛이 솟아요' },
      { id: 'charge', unlock: 39, tier: 2, branch: 'a', short: '금빛 방패로 돌진해 터뜨려요' },
      // ---- 마검사(2차 전직 갈래 B, 2026-11-08) ----
      // branch = 2차 전직 갈래(config classes.<직업>.tier2.branches 의 key). 고른 갈래의 기술만 기술 창에 보이고 배울 수 있음(고르기 전 = 둘 다 자물쇠)
      //   passive.stat 'arcane' = 평타(콤보 · 달리며 · 점프 공격)에 마법 피해 +val, chance 확률로 칼끝에서 작은 마력이 터짐(icdMs 에 한 번, r · depth = 둘레, hit = INFUSE_BURST)
      { id: 'arcwave', unlock: 25, tier: 2, branch: 'b', short: '보라 마력 검기 세 줄기를 날려요' },
      { id: 'infuse', unlock: 28, tier: 2, branch: 'b', short: '평타에 마력이 실려요', name: '마력 부여', icon: '부',
        desc: '칼에 마력을 실어 평타(콤보 · 달리며 · 점프 공격)가 마법 피해를 더 줘요. 가끔 칼끝에서 작은 마력이 터져 둘레 적까지 때려요',
        passive: { stat: 'arcane', val: [0.1, 0.12, 0.14, 0.17, 0.2], chance: [0.18, 0.2, 0.22, 0.25, 0.3], icdMs: 450, r: 46, depth: 30, hit: INFUSE_BURST } },
      { id: 'rift', unlock: 31, tier: 2, branch: 'b', short: '순간 돌진해 베고 균열이 터져요' },
      { id: 'msword', unlock: 35, tier: 2, branch: 'b', short: '마력 검 여섯 자루가 차례로 꽂혀요' },
      { id: 'unleash', unlock: 39, tier: 2, branch: 'b', short: '검은 기운이 땅을 타고 밀려가요' }
    ],
    // 2026-11-09 궁수(새 직업, 기사 · 법사와 같은 짜임): 쓰는 기술 1차 6 + 2차 갈래마다 4 / 늘 켜진 기술 1차 7 + 2차 갈래마다 1. 3렙마다 늘 켜진 기술, 그 사이 쓰는 기술
    //   rec: 저격수 a = 한 방 · 치명타(활 숙련 · 집중 · 사냥꾼의 표식), 레인저 b = 몹 떼 · 저절로 공격(갈래 화살 · 자동 연사 · 바람의 가호)
    archer: [
      { id: 'pshot', unlock: 0, short: '바람 화살이 줄 위 적을 꿰뚫어요' },
      { id: 'upshot', unlock: 0, short: '바람 기둥으로 적을 띄워요' },
      { id: 'nimble', unlock: 7, maxLv: 1, short: '회피 2번 연달아 · 쿨타임이 줄고 더 멀리 빠져요', name: '날렵한 몸놀림', icon: '날',
        desc: '회피를 2번 연달아 쓸 수 있고, 쿨타임이 줄고(두 번 다 쓴 뒤 1.8초 → 1.2초) 더 멀리 빠져요 · 1번만 찍을 수 있어요',
        passive: { stat: 'nimble', charges: [2], val: [1200], refillMs: [470], dist: [0.3] } },
      { id: 'multi', unlock: 8, short: '화살 다섯 발을 부채꼴로' },
      { id: 'aim', unlock: 9, rec: 'a', short: '활 공격이 세져요', name: '활 숙련', icon: '숙', desc: '활로 하는 모든 공격(평타 화살 · 기술)이 세져요',
        passive: { stat: 'phys', val: [0.08, 0.12, 0.16, 0.2, 0.25] } },
      { id: 'rain', unlock: 11, short: '앞쪽 땅에 화살비를 내려요' },
      // passive.stat 'acrit' = 치명타 확률 +val, 치명타 배율 +critDmg (js/archer.js critAdd · critDmg)
      { id: 'focus', unlock: 12, rec: 'a', short: '치명타가 더 자주, 더 세게', name: '집중', icon: '집', desc: '숨을 고르고 조준해 치명타가 더 자주 나고 더 세게 터져요',
        passive: { stat: 'acrit', val: [0.04, 0.06, 0.08, 0.1, 0.12], critDmg: [0.1, 0.15, 0.2, 0.25, 0.3] } },
      { id: 'leap', unlock: 14, short: '뒤로 공중제비 돌며 쏴요' },
      // passive.stat 'split'(저절로 공격) = 평타 화살이 맞으면 작은 화살 n 개가 둘레(r) 다른 적에게 튐(icdMs 에 한 번). val = 데미지 배율(AR_SPLIT 에 곱함)
      { id: 'split', unlock: 15, rec: 'b', short: '평타 화살이 맞으면 작은 화살이 튀어요', name: '갈래 화살', icon: '갈',
        desc: '평타 화살이 적에게 맞으면 작은 화살이 갈라져 둘레의 다른 적에게 날아가 꽂혀요(둘레에 적이 없으면 안 갈라짐)',
        passive: { stat: 'split', val: [0.35, 0.4, 0.45, 0.5, 0.56], n: [1, 2, 2, 3, 3], r: [110, 120, 130, 140, 150], depth: 50, icdMs: 160, hit: AR_SPLIT } },
      { id: 'burst', unlock: 17, short: '터지는 화살로 둘레를 넘어뜨려요' },
      // passive.stat 'volley'(저절로 공격) = val(ms) 마다 둘레(find) 가까운 적들에게 빛 화살 n 발이 저절로 날아감. mul = 데미지 배율(AR_AUTO)
      { id: 'volley', unlock: 18, rec: 'b', recInv: true, short: '몇 초마다 빛 화살이 저절로 날아가요', name: '자동 연사', icon: '연',
        desc: '몇 초마다 등 뒤 화살통에서 빛 화살이 저절로 날아올라 가까운 적들에게 꽂혀요',
        passive: { stat: 'volley', val: [4600, 4300, 4000, 3600, 3200], n: [3, 3, 4, 4, 5], mul: [1, 1.1, 1.2, 1.35, 1.5], find: 260, findDepth: 80, hit: AR_AUTO } },
      { id: 'gale', unlock: 21, rec: 'b', short: '받는 피해가 줄어요', name: '바람의 가호', icon: '호', desc: '몸을 감싼 바람이 적의 공격을 흘려 받는 피해가 줄어요',
        passive: { stat: 'guard', val: [0.05, 0.08, 0.11, 0.14, 0.18] } },
      // passive.stat 'amark' = 기술에 맞은 적에게 ms 동안 사냥꾼의 표식(머리 위 과녁) → 그 적이 받는 모든 공격 +val
      { id: 'mark', unlock: 24, rec: 'a', short: '기술에 맞은 적이 더 아파요', name: '사냥꾼의 표식', icon: '표', desc: '기술에 맞은 적에게 5초 동안 사냥꾼의 표식(머리 위 과녁)이 찍혀, 그동안 모든 공격에 더 아프게 맞아요',
        passive: { stat: 'amark', val: [0.08, 0.11, 0.14, 0.17, 0.2], ms: 5000 } },
      // ---- 저격수(2차 갈래 a) ----
      { id: 'snipe', unlock: 25, tier: 2, branch: 'a', short: '가장 센 적을 한 줄로 꿰뚫어요' },
      // passive.stat 'deadeye' = 치명타 확률 +chance, 치명타 배율 +val, 꿰뚫는 화살 데미지 +pierce
      { id: 'deadeye', unlock: 28, tier: 2, branch: 'a', short: '치명타 배율이 크게 올라요', name: '필중', icon: '필', desc: '급소를 꿰뚫는 눈. 치명타 배율이 크게 오르고 치명타 확률도 조금 올라요',
        passive: { stat: 'deadeye', val: [0.25, 0.32, 0.4, 0.48, 0.56], chance: [0.05, 0.05, 0.06, 0.06, 0.07] } },
      { id: 'ballista', unlock: 31, tier: 2, branch: 'a', short: '거대한 화살이 밀고 꿰뚫어요' },
      { id: 'rapid', unlock: 35, tier: 2, branch: 'a', short: '바람 화살 여덟 발 연사' },
      { id: 'skyfall', unlock: 39, tier: 2, branch: 'a', short: '하늘에서 거대한 빛 화살' },
      // ---- 레인저(2차 갈래 b) ----
      { id: 'tempest', unlock: 25, tier: 2, branch: 'b', short: '앞으로 나아가는 화살 폭풍' },
      // passive.stat 'hawk'(저절로 공격) = 매 동료가 따라다니며 val(ms) 마다 가까운 적에게 내리꽂힘. mul = 데미지 배율(RG_HAWK)
      { id: 'hawk', unlock: 28, tier: 2, branch: 'b', recInv: true, short: '매가 따라다니며 적을 공격해요', name: '매 동료', icon: '매',
        desc: '매 한 마리가 어깨 위를 날며 따라다니다가 몇 초마다 가까운 적에게 내리꽂혀요',
        passive: { stat: 'hawk', val: [2600, 2400, 2200, 2000, 1800], mul: [1, 1.12, 1.25, 1.4, 1.55], find: 300, findDepth: 90, hit: RG_HAWK } },
      { id: 'trap', unlock: 31, tier: 2, branch: 'b', short: '덫 세 개 — 밟으면 묶고 터져요' },
      { id: 'twister', unlock: 35, tier: 2, branch: 'b', short: '적을 빨아들이는 회오리 화살' },
      { id: 'barrage', unlock: 39, tier: 2, branch: 'b', short: '화면 가득 천 개의 화살' }
    ],
    // 2026-11-08 형님 승인: 법사도 기사처럼 다시 배치(아래 mage 순서 = 기술 창 순서) + 2차 전직 Lv25 대마법사(tier: 2)
    //   새 기술 원소 파편 · 중력 구체 · 마력 소용돌이(1차) / 원소 연쇄 · 빙결 폭풍 · 천둥 심판(2차) → 법사 17개(쓰는 기술 10 + 늘 켜진 기술 7). 1차 법사 = 원소 낙인(Lv24)까지
    //   예전 저장: 지금 Lv 보다 늦게 열리게 바뀐 기술(마나 순환 11 → 12 · 마나 방패 19 → 21 · 원소 낙인 23 → 24, 2차 전 메테오 · 불기둥)은 저장을 읽을 때 빠짐
    //     = 그 기술에 쓴 점수는 안 쓴 점수로 돌아옴(growth.js openLv, 기사와 같은 길)
    mage: [
      // 전직(1차) 때: 화염구 = 첫 기술 점수(firstPts 1)로 배움, 땅 융기 = 기본기(config skills.basic, 공짜 Lv1 + 1번 칸) → 기사 올려베기처럼 unlock 0
      { id: 'fireball', unlock: 0, short: '큰 불덩이를 던져요' },
      { id: 'rise', unlock: 0, short: '돌기둥으로 적을 띄워요' },     // 2026-11-08 Lv10 → 0(기본기라 늘 열림, 기사 올려베기와 같은 자리)
      // 2026-11-08 형님: 날렵한 몸놀림(기사 · 법사 같음) = charges = 회피 연달아 2번(기본 1번), val = 두 번 다 쓴 뒤 쿨타임(ms, 기본 1800 → 1200), refillMs = 하나만 썼을 때 돌아오는 시간(470), dist = 회피 거리 +30%. maxLv 1 = 1점만 찍음(기술마다 최고 Lv, 없으면 skills.maxLv)
      { id: 'nimble', unlock: 7, maxLv: 1, short: '회피 2번 연달아 · 쿨타임이 줄고 더 멀리 빠져요', name: '날렵한 몸놀림', icon: '날',
        desc: '회피를 2번 연달아 쓸 수 있고, 쿨타임이 줄고(두 번 다 쓴 뒤 1.8초 → 1.2초) 더 멀리 빠져요 · 1번만 찍을 수 있어요',
        passive: { stat: 'nimble', charges: [2], val: [1200], refillMs: [470], dist: [0.3] } },
      { id: 'bolt', unlock: 8, short: '번개 세 줄기를 내리꽂아요' },
      { id: 'amp', unlock: 9, rec: 'a', short: '모든 마법이 세져요', name: '원소 증폭', icon: '증', desc: '모든 마법(지팡이 타·마법탄·기술)이 세져요',
        passive: { stat: 'magic', val: [0.08, 0.12, 0.16, 0.2, 0.25] } },
      { id: 'ice', unlock: 11, short: '얼음이 줄지어 솟고 끝에 큰 빙산이 적을 띄워요' },          // 2026-11-08 Lv13 → 11(초반 법사가 덜 답답하게)
      { id: 'flow', unlock: 12, rec: 'a', short: '마나가 더 빨리 차요', name: '마나 순환', icon: '순', desc: '마나가 더 빨리 차요',
        passive: { stat: 'mpRegen', val: [0.2, 0.35, 0.5, 0.65, 0.85] } },     // 2026-11-08 Lv11 → 12
      { id: 'blink', unlock: 14, short: '사라졌다 나타나며 피해요' },  // 2026-11-08 Lv17 → 14
      // 2026-11-08 새 늘 켜진 기술: passive.stat 'eshard' = 법사 마법(지팡이 · 완드 타 · 마법탄 · 터짐 · 기술)이 적에게 맞으면 작은 불 · 얼음 조각이 튀어
      //   둘레(r, 위아래 depth) 다른 적 n 마리에게 날아가 꽂힘(둘레에 다른 적이 없으면 맞은 적에게 한 조각). icdMs 에 한 번까지(몹 떼에 한꺼번에 맞아도 한 번)
      //   val = 조각 데미지 배율(ESHARD_HIT 에 곱함, 무기 데미지 · 지능 · 원소 증폭은 그대로 붙음)
      { id: 'eshard', unlock: 15, rec: 'a', short: '마법이 맞으면 불·얼음 조각이 튀어요', name: '원소 파편', icon: '파',
        desc: '마법(평타 지팡이 타 · 마법탄 · 기술)이 적에게 맞으면 작은 불 · 얼음 조각이 튀어 둘레의 다른 적을 때려요(둘레에 적이 없으면 맞은 적에게 한 조각)',
        passive: { stat: 'eshard', val: [0.3, 0.35, 0.4, 0.46, 0.52], n: [2, 3, 3, 4, 4], r: [80, 86, 92, 100, 110], depth: 34, icdMs: 280, hit: ESHARD_HIT } },
      { id: 'gravity', unlock: 17, short: '구체가 적을 끌어모아 터져요' },
      // 2026-11-08 새 늘 켜진 기술: passive.stat 'vortex' = val(ms) 마다 법사 둘레(find 안, 위아래 findDepth) 적이 있으면 그 적들 가운데에 작은 마력 소용돌이.
      //   소용돌이 = ms 동안 둘레 r 의 잡몹을 가운데로 끌어모으며 작게 ticks 번 → 끝에 톡 터짐. mul = 데미지 배율(VORTEX_TICK · VORTEX_POP 에 곱함). 보스 · 중간보스는 안 끌림
      { id: 'vortex', unlock: 18, rec: 'b', recInv: true, short: '가끔 소용돌이가 적을 모아요', name: '마력 소용돌이', icon: '소',
        desc: '몇 초마다 법사 둘레 적들 가운데에 작은 마력 소용돌이가 저절로 생겨, 둘레 적을 끌어모으며 여러 번 때리고 톡 터져요(보스 · 큰 적은 안 끌려옴)',
        passive: { stat: 'vortex', val: [6500, 6000, 5500, 5000, 4500], mul: [1, 1.15, 1.3, 1.45, 1.6], r: [70, 76, 82, 90, 100], find: 190, findDepth: 60,
                   depth: 40, ms: 900, ticks: 3, pullK: 4.5, tick: VORTEX_TICK, pop: VORTEX_POP } },
      // 2차(2026-11-06 넣음): passive.stat 'shield' = 받는 피해의 val 만큼을 마나가 대신 받음(마나 1 = 피해 1, 마나가 모자라면 있는 만큼)
      //   'brand' = 기술 마법에 맞은 적에게 ms 동안 낙인 → 그동안 그 적이 받는 모든 공격 +val
      { id: 'shield', unlock: 21, rec: 'b', short: '피해 일부를 마나가 대신 받아요', name: '마나 방패', icon: '방', desc: '받는 피해 일부를 마나가 대신 받아요. 막을 때 몸 둘레에 파란 방패가 번쩍해요',
        passive: { stat: 'shield', val: [0.2, 0.25, 0.3, 0.35, 0.4] } },        // 2026-11-08 Lv19 → 21
      { id: 'brand', unlock: 24, rec: 'b', short: '기술에 맞은 적이 더 아파요', name: '원소 낙인', icon: '낙', desc: '기술 마법에 맞은 적에게 4초 동안 낙인(머리 위 문양)이 찍혀, 그동안 모든 공격에 더 아프게 맞아요',
        passive: { stat: 'brand', val: [0.1, 0.13, 0.16, 0.19, 0.22], ms: 4000 } },   // 2026-11-08 Lv23 → 24
      // ---- 대마법사(2차 전직, 2026-11-08 형님 승인) ----
      // tier: 2 = 2차 전직(classes.mage.tier2, Lv25 = 대마법사)을 한 뒤에만 열림(기사와 같음). 공짜 Lv 없음(기술 점수로 배움)
      //   메테오(예전 Lv15) · 불기둥(예전 Lv21)을 1차에서 2차로 옮김
      { id: 'meteor', unlock: 25, tier: 2, branch: 'a', short: '큰 운석을 떨어뜨려요' },        // 2026-11-08 Lv15 → 2차 Lv25
      // passive.stat 'echain' = 법사 마법으로 쓰러진 적이 그 자리에서 터져 둘레(r, 위아래 depth) 적을 때림(ECHAIN_HIT x val).
      //   터짐으로 쓰러진 적도 chain 번까지 또 터짐(무한 반복 없음, 짧은 시간에 터지는 수도 상한). 예전 아이디어 「마나 가호」는 마나 순환과 겹쳐 이걸로 바꿈
      { id: 'echain', unlock: 28, tier: 2, branch: 'a', short: '쓰러진 적이 터져 둘레를 때려요', name: '원소 연쇄', icon: '연',
        desc: '마법으로 쓰러뜨린 적이 그 자리에서 터져 둘레 적을 때려요. 터짐으로 쓰러진 적도 또 터져요(세 번까지) — 몹 떼가 줄줄이 터져요',
        passive: { stat: 'echain', val: [0.7, 0.85, 1.0, 1.15, 1.3], r: [62, 68, 74, 82, 92], depth: 36, chain: 3, hit: ECHAIN_HIT } },
      { id: 'pillar', unlock: 31, tier: 2, branch: 'a', short: '큰 불기둥이 솟아 태워요' },     // 2026-11-08 Lv21 → 2차 Lv31
      { id: 'frost', unlock: 35, tier: 2, branch: 'a', short: '앞쪽 넓게 얼음 폭풍을 일으켜요' },
      { id: 'judgment', unlock: 39, tier: 2, branch: 'a', short: '거대한 번개 기둥 한 방' },
      // ---- 흑마법사(2차 전직 갈래 B, 2026-11-08) ----
      //   passive.stat 'leech' = 법사 마법으로 준 피해 x val 만큼 체력이 참(1초에 최대 체력 x capS 까지). 적 → 법사로 붉은 기운이 빨려 듦
      { id: 'darkorb', unlock: 25, tier: 2, branch: 'b', short: '검은 구체가 지나가며 깎고 터져요' },
      { id: 'leech', unlock: 28, tier: 2, branch: 'b', short: '마법 피해 일부만큼 체력이 차요', name: '생명 흡수', icon: '흡',
        desc: '마법으로 적에게 준 피해의 일부만큼 체력이 차요. 붉은 기운이 적에게서 법사에게 빨려 들어와요(1초에 최대 체력의 몇 %까지만)',
        passive: { stat: 'leech', val: [0.03, 0.035, 0.04, 0.045, 0.05], capS: [0.03, 0.035, 0.04, 0.045, 0.05] } },
      { id: 'swamp', unlock: 31, tier: 2, branch: 'b', short: '늪 안 적이 느려지고 더 아파요' },
      { id: 'wraith', unlock: 35, tier: 2, branch: 'b', short: '악령 떼가 화면 전체를 휩쓸어요' },
      { id: 'abyss', unlock: 39, tier: 2, branch: 'b', short: '검은 문이 빨아들이고 터져요' }
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
    if (outfit === 'archer') M = { stride: ARCHER[who].stride, attack1Prefix: 'attack1_', attack1Count: ARCHER[who].attack1Count,   // 궁수(2026-11-09)
                                   attack2Count: ARCHER[who].attack2Count, attack3Count: ARCHER[who].attack3Count, combo: ARCHER[who].combo };
    // 검 콤보: 기사 옷이면 knightCombo 에 있는 타만 바꿔 끼운다(나머지 타는 견습과 같은 수치)
    var swordCombo = M.combo;
    if (outfit === 'knight' && M.knightCombo) {
      swordCombo = M.combo.map(function (st, i) { return M.knightCombo[i] || st; });
    }
    var def = {
      label: who === 'male' ? '남' : '여',
      frameW: 176, frameH: 136,
      pivot: { x: 68, y: 130 },
      bakedWeapon: outfit === 'archer',   // 궁수 = 활이 그림에 박혀 있음(2026-11-09). 손 위치 json 은 활 가운데(화살 · 오라 자리 참고용)
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
      combos: outfit === 'mage' ? { magic: M.combo } : outfit === 'archer' ? { bow: M.combo } : { sword: swordCombo }
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

  // 성기사(남) 그림이 있는 묶음 = 기사 남과 같은 16개 전부(art\knight-t2\male, 82장). 여기 없는 묶음은 기사(1차) 그림을 씀
  var KNIGHT_T2_MALE_ANIMS = ['idle', 'walk', 'attack1', 'attack2', 'attack3', 'hurt', 'hurt2', 'knockdown', 'getup',
                              'run', 'jump', 'run_attack', 'jump_attack', 'motion_dash', 'motion_spin', 'motion_upper'];
  // 성기사(여) 그림이 있는 묶음 = 기사 여와 같은 16개 전부(art\knight-t2\female, 81장, 보라 망토 · 2026-11-07)
  var KNIGHT_T2_FEMALE_ANIMS = KNIGHT_T2_MALE_ANIMS;
  // 대마법사(남) 그림이 있는 묶음 = 법사 남과 같은 15개 전부(art\mage-t2\male, 70장, 흰색 + 금 · 2026-11-08). 여기 없는 묶음은 법사(1차) 그림을 씀
  var MAGE_T2_MALE_ANIMS = ['idle', 'walk', 'attack1', 'attack2', 'attack3', 'hurt', 'hurt2', 'knockdown', 'getup',
                            'run', 'jump', 'run_attack', 'jump_attack', 'motion_cast_forward', 'motion_cast_sky'];
  // 대마법사(여) 그림이 있는 묶음 = 법사 여와 같은 15개 전부(art\mage-t2\female, 74장, 흰색 + 금 · 2026-11-08)
  var MAGE_T2_FEMALE_ANIMS = MAGE_T2_MALE_ANIMS;
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
    // 기사 남 달리며 공격 새 그림(2026-11-07 어깨빵 v2, 성기사와 같은 동작): 2장 잠깐 → 3장 계속. 기사 여 슬라이딩은 그대로
    knightMale.raShow = { pushFirst: 1, pushFirstMs: 90, pushHold: 2 };
    // 법사 옷 (직업 「법사(지팡이)」): 걷기 보폭 남녀 모두 84 (MAGE.<성별>.stride)
    var mageMale = stage1('male', 'assets/chars/stage1/anchors_mage_male.json', 'mage');
    var mageFemale = stage1('female', 'assets/chars/stage1/anchors_mage_female.json', 'mage');
    // 궁수 옷 (2026-11-09, 직업 「궁수(활)」): Flow 그림 artrcher-t1 → assets/chars/stage1/archer_<성별>. 견습 그림을 포즈 참고로 다시 그려 장 수 · 발 위치가 견습과 같음
    var archerMale = stage1('male', 'assets/chars/stage1/anchors_archer_male.json', 'archer');
    var archerFemale = stage1('female', 'assets/chars/stage1/anchors_archer_female.json', 'archer');
  }
  // 성기사 옷 (2026-11-07, 기사 2차 · classes.knight.tier2): 남자(여자는 아래 knightT2Female). 그림 = assets/chars/stage1/knight_t2_male (art\knight-t2\male 에서 복사).
  //   파일 이름·장 수·발 위치가 기사(1차) 그림과 똑같아서 기사 남 묶음을 그대로 쓰고 그림 폴더·손 위치 json 만 바꾼다
  //   (콤보·보폭·달리기 수치 moveWho · 기술 동작 시간 = 기사 남 그대로. 그림이 없는 묶음이 생기면 그 묶음만 기사 그림을 씀)
  var knightT2Male = null;
  if (knightMale) {
    knightT2Male = stage1('male', 'assets/chars/stage1/anchors_knight_t2_male.json', 'knight');
    var T2DIR = 'assets/chars/stage1/knight_t2_male/', T2HAS = KNIGHT_T2_MALE_ANIMS;
    Object.keys(knightT2Male.anims).forEach(function (n) {
      var A = knightT2Male.anims[n];
      if (T2HAS.indexOf(n) >= 0) A.frames = A.frames.map(function (f) { return f.replace('assets/chars/stage1/knight_male/', T2DIR); });
    });
    knightT2Male.moveAnchors = 'assets/chars/stage1/anchors_move_knight_t2_male.json';
    knightT2Male.t2Dir = T2DIR;
    // 달리며 공격 새 그림(2026-11-07 어깨빵 v2): 미끄러지는 동안 = 2장(어깨 내밈)을 pushFirstMs 잠깐 → 3장(몸 틀어 등 · 망토가 보임) 계속.
    //   마무리 = 4장(어깨 충돌), 회복 = 5장. 보이는 그림만 바꿈(시간 · 판정 · 데미지는 기사 남 자료 그대로)
    knightT2Male.raShow = { pushFirst: 1, pushFirstMs: 90, pushHold: 2 };
  }
  // 성기사 여 옷 (2026-11-07, 기사 2차 · 여자): 그림 = assets/chars/stage1/knight_t2_female (art\knight-t2\female 에서 복사, 보라 + 금).
  //   기사 여 묶음을 그대로 쓰고 그림 폴더 · 손 위치 json 만 바꾼다(콤보 · 보폭 · 달리기 수치 · 기술 동작 시간 = 기사 여 그대로).
  //   달리며 공격은 기사 여처럼 미끄러지기 그대로 보여 줌(raShow 없음 → 슬라이딩 끝에 발이 땅에 붙어 있음)
  var knightT2Female = null;
  if (knightFemale) {
    knightT2Female = stage1('female', 'assets/chars/stage1/anchors_knight_t2_female.json', 'knight');
    var T2FDIR = 'assets/chars/stage1/knight_t2_female/';
    Object.keys(knightT2Female.anims).forEach(function (n) {
      var A = knightT2Female.anims[n];
      if (KNIGHT_T2_FEMALE_ANIMS.indexOf(n) >= 0) A.frames = A.frames.map(function (f) { return f.replace('assets/chars/stage1/knight_female/', T2FDIR); });
    });
    knightT2Female.moveAnchors = 'assets/chars/stage1/anchors_move_knight_t2_female.json';
    knightT2Female.t2Dir = T2FDIR;
  }
  // 대마법사 옷 (2026-11-08, 법사 2차 · classes.mage.tier2): 남자. 그림 = assets/chars/stage1/mage_t2_male (art\mage-t2\male 에서 복사, 흰색 + 금).
  //   법사 남 묶음을 그대로 쓰고 그림 폴더 · 손 위치 json 만 바꾼다(콤보 · 보폭 · 달리기 수치 moveWho · 기술 동작 시간 = 법사 남 그대로).
  //   여자 = 아래 mageT2Female
  var mageT2Male = null;
  if (mageMale) {
    mageT2Male = stage1('male', 'assets/chars/stage1/anchors_mage_t2_male.json', 'mage');
    var MT2DIR = 'assets/chars/stage1/mage_t2_male/';
    Object.keys(mageT2Male.anims).forEach(function (n) {
      var A = mageT2Male.anims[n];
      if (MAGE_T2_MALE_ANIMS.indexOf(n) >= 0) A.frames = A.frames.map(function (f) { return f.replace('assets/chars/stage1/mage_male/', MT2DIR); });
    });
    mageT2Male.moveAnchors = 'assets/chars/stage1/anchors_move_mage_t2_male.json';
    mageT2Male.t2Dir = MT2DIR;
  }
  // 대마법사 여 옷 (2026-11-08, 법사 2차 · 여자): 그림 = assets/chars/stage1/mage_t2_female (art\mage-t2\female 에서 복사, 흰색 + 금).
  //   법사 여 묶음을 그대로 쓰고 그림 폴더 · 손 위치 json 만 바꾼다(콤보 · 보폭 · 기술 동작 시간 · 무기 wand = 법사 여 그대로)
  var mageT2Female = null;
  if (mageFemale) {
    mageT2Female = stage1('female', 'assets/chars/stage1/anchors_mage_t2_female.json', 'mage');
    var MT2FDIR = 'assets/chars/stage1/mage_t2_female/';
    Object.keys(mageT2Female.anims).forEach(function (n) {
      var A = mageT2Female.anims[n];
      if (MAGE_T2_FEMALE_ANIMS.indexOf(n) >= 0) A.frames = A.frames.map(function (f) { return f.replace('assets/chars/stage1/mage_female/', MT2FDIR); });
    });
    mageT2Female.moveAnchors = 'assets/chars/stage1/anchors_move_mage_t2_female.json';
    mageT2Female.t2Dir = MT2FDIR;
  }
  // 2차 갈래 b 옷 (2026-11-09, 마검사 = knight_t2b · 흑마법사 = mage_t2b): 그림 = assets/chars/stage1/<옷>_t2b_<성별> (art\<직업>-t2b\<성별> 에서 복사).
  //   갈래 a(성기사 · 대마법사) 그림 위에 Flow 로 옷만 다시 그려 같은 실루엣에 맞춘 것 → 장 수 · 발 위치 · 손 위치가 갈래 a 와 같다.
  //   그래서 1차 옷 묶음을 그대로 쓰고 그림 폴더 · 손 위치 json 만 바꾼다(콤보 · 보폭 · 달리기 수치 · 기술 동작 시간 = 1차 옷 그대로).
  //   T2B_DONE 에 있는 것만 진짜 그림, 없는 것은 classes.<직업>.tier2.branches 의 look(1차 옷 물들임) 그대로
  var T2B_DONE = ['knight_male', 'knight_female', 'mage_male', 'mage_female'];
  var T2B_ANIMS = { knight: KNIGHT_T2_MALE_ANIMS, mage: MAGE_T2_MALE_ANIMS };
  var t2bSets = {};
  T2B_DONE.forEach(function (k) {
    var cls = k.split('_')[0], who = k.split('_')[1];
    if (artSet === 'novice') return;
    var d = stage1(who, 'assets/chars/stage1/anchors_' + cls + '_t2b_' + who + '.json', cls);
    var dir = 'assets/chars/stage1/' + cls + '_t2b_' + who + '/', from = 'assets/chars/stage1/' + cls + '_' + who + '/';
    Object.keys(d.anims).forEach(function (n) {
      var A = d.anims[n];
      if (T2B_ANIMS[cls].indexOf(n) >= 0) A.frames = A.frames.map(function (f) { return f.replace(from, dir); });
    });
    d.moveAnchors = 'assets/chars/stage1/anchors_move_' + cls + '_t2b_' + who + '.json';
    d.t2Dir = dir;
    if (cls === 'knight' && who === 'male') d.raShow = { pushFirst: 1, pushFirstMs: 90, pushHold: 2 };   // 성기사 남과 같은 어깨빵 그림
    t2bSets[cls + '_t2b_' + who] = d;
  });
  // 궁수 2차 옷(2026-11-09, 저격수 = archer_t2a · 레인저 = archer_t2b): 1차 궁수 그림 위에 Flow 로 옷만 다시 그려 같은 실루엣 · 장 수 · 발 위치.
  //   그래서 1차 궁수 묶음을 그대로 쓰고 그림 폴더 · 손 위치 json 만 바꾼다(콤보 · 보폭 · 달리기 수치 · 기술 동작 시간 = 1차 궁수 그대로).
  //   ARCHER_T2_DONE 에 있는 것만 진짜 그림, 없는 것은 classes.archer.tier2.branches 의 look(1차 옷 물들임) 그대로
  var ARCHER_T2_DONE = ['t2a_male', 't2a_female', 't2b_male'];
  var archerT2Sets = {};
  ARCHER_T2_DONE.forEach(function (k) {
    if (artSet === 'novice') return;
    var at = k.split('_')[0], who = k.split('_')[1], name = 'archer_' + at + '_' + who;
    var d = stage1(who, 'assets/chars/stage1/anchors_' + name + '.json', 'archer');
    var dir = 'assets/chars/stage1/' + name + '/', from = 'assets/chars/stage1/archer_' + who + '/';
    Object.keys(d.anims).forEach(function (n) { var A = d.anims[n]; A.frames = A.frames.map(function (f) { return f.replace(from, dir); }); });
    d.moveAnchors = 'assets/chars/stage1/anchors_move_' + name + '.json';
    d.t2Dir = dir;
    archerT2Sets[name] = d;
  });
  var characters = { male: male, female: female };
  if (knightMale) { characters.knight_male = knightMale; characters.knight_female = knightFemale; }
  if (knightT2Male) characters.knight_t2_male = knightT2Male;
  if (knightT2Female) characters.knight_t2_female = knightT2Female;
  if (mageMale) { characters.mage_male = mageMale; characters.mage_female = mageFemale; }
  if (archerMale) { characters.archer_male = archerMale; characters.archer_female = archerFemale; }   // 궁수(2026-11-09)
  if (mageT2Male) characters.mage_t2_male = mageT2Male;
  if (mageT2Female) characters.mage_t2_female = mageT2Female;
  Object.keys(t2bSets).forEach(function (k) { characters[k] = t2bSets[k]; });
  Object.keys(archerT2Sets).forEach(function (k) { characters[k] = archerT2Sets[k]; });   // 궁수 2차 옷(2026-11-09)

  // ---------- 적 그림 (art\stage1-enemies 에서 복사, 그림은 전부 「왼쪽을 봄」) ----------
  // playback = 그림 번호(1부터) 재생 순서, fps = 1초에 몇 칸. 순서를 늘리면 그 장면이 길어진다(예: 몽둥이 치켜든 장면 = 예고)
  var EN = 'assets/enemies/';
  var MIDV2 = { scale: 1, hpBoss: 0.5, tint: { hue: 0, sat: 1, bright: 1, colorK: 0 } };   // 11~20판 중간보스 덮어쓰기(midBoss.list)
  // 11~20단계 v2 기술 효과 그림(2026-11-09, AI 그림 · art/stages-11-20/v2/fx): 이름 → [장 수, 기준점 x, y]. FX2('thorn', 14) = fxArt 한 칸
  var FX2T = {aura: [4, 80, 222], beam: [4, 2, 15], bolt: [5, 67, 152], boulder: [4, 24, 26], cdust: [4, 22, 27], crescent: [4, 87, 112], cring: [5, 82, 39], cspike: [5, 42, 78], curseburst: [5, 52, 82], ering: [5, 82, 45], feather: [4, 17, 7], geyser: [5, 50, 92], gust: [4, 37, 21], harpoon: [4, 37, 14], holyhit: [5, 49, 82], ink: [4, 17, 9], javelin: [4, 42, 12], jet: [4, 2, 17], laser: [4, 21, 10], lightfall: [4, 11, 42], meteor: [4, 29, 37], pillar: [5, 36, 142], puddle: [6, 37, 42], rootspike: [5, 35, 72], shard: [4, 17, 5], shatter: [5, 59, 82], skull: [4, 22, 9], spark: [5, 54, 32], splash: [5, 53, 72], spore: [4, 19, 9], stalac: [4, 34, 34], tentacle: [5, 56, 92], thorn: [4, 25, 9], thornfall: [4, 10, 37], thornhit: [5, 53, 82], thunderhit: [5, 60, 82], tide: [4, 74, 82], vblast: [5, 66, 92], vorb: [4, 17, 10], vring: [5, 82, 50]};
  function FX2(n, fps) { var t = FX2T[n]; return { frames: seq(EN + 'fx2/' + n + '/' + n + '_', t[0]), pivot: { x: t[1], y: t[2] }, fps: fps || 12 }; }
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

  // ---------- 11~20단계 배경 (2026-11-09, art/stages-11-20/bg-<이름> 에서 복사. 크기·바닥·걷는 길은 1~10단계와 같음) ----------
  // 만드는 법 = art/stages-11-20/_scripts/bg_build.py (stage-10 방식 그대로: far 1장 · mid 2장 + 첫 장 뒤집은 것 · ground 1장 + 뒤집은 것 이어 붙임)
  function bgOf(name, farW, midW, groundW) {
    var d = 'assets/bg/' + name + '/';
    return {
      far:    { img: d + 'far.png',    w: farW,    tile: true,  parallax: 0.15 },
      mid:    { img: d + 'mid.png',    w: midW,    tile: false, parallax: 0.5 },
      ground: { img: d + 'ground.png', w: groundW, tile: true,  parallax: 1.0 },
      height: 240, floorY: 144, laneTop: 158, laneBottom: 230
    };
  }
  var BG_CURSED  = bgOf('cursed', 518, 949, 526);    // 11·12 저주받은 숲: 보랏빛 달 · 죽은 거목 · 비명 지르는 나무 얼굴 · 저주 토템
  var BG_CRYSTAL = bgOf('crystal', 518, 1036, 444);  // 13·14 수정 동굴: 빛나는 푸른·보라 수정 · 광산 비계 · 수정 아치
  var BG_SUNKEN  = bgOf('sunken', 518, 970, 540);    // 15·16 가라앉은 신전: 청록 물빛 · 산호 덮인 대리석 열주 · 바다 여신상 · 청동 종
  var BG_SKY     = bgOf('sky', 518, 953, 524);       // 17·18 하늘 폐허: 구름 위 금빛 노을 · 떠 있는 섬 · 흰 대리석 신전 · 날개 수호상
  var BG_ABYSS   = bgOf('abyss', 518, 1033, 612);    // 19·20 심연: 보랏빛 소용돌이 · 흑요석 조각 · 공허의 문

  // ---------- 던전 배경: 강화석 광산 (art\dungeon-bg\mine 에서 복사, 2026-11-07) ----------
  // 한 화면 싸움터(arena) 배경: mid = 가운데 큰 무지개 어미 결정 + 광차(싸움터 가운데에 한 장, 카메라와 같이 움직임 = parallax 1),
  //   far = 결정 박힌 바위벽 + 바닥(옆으로 이어 붙임), ground = 흙바닥(이어 붙임), ceil = 화면이 240보다 높을 때 배경 위를 채우는 천장(far 와 같은 흐름).
  //   ceil 보다 더 위 = voidColor(깜깜한 굴 천장). 크기·바닥·걷는 길은 판 배경과 같음
  var BG_DG_MINE = {
    arena: true,
    far:    { img: 'assets/bg/dungeon/mine/far.png',    w: 250, tile: true,  parallax: 0.5 },
    mid:    { img: 'assets/bg/dungeon/mine/mid.png',    w: 210, tile: false, parallax: 1 },
    ground: { img: 'assets/bg/dungeon/mine/ground.png', w: 250, tile: true,  parallax: 1.0 },
    ceil:   { img: 'assets/bg/dungeon/mine/ceil.png',   w: 250, h: 200, voidColor: '#07060b' },
    height: 240, floorY: 144, laneTop: 158, laneBottom: 230
  };
  // ---------- 레이드 배경: 불의 화산굴 (art\dungeon-bg\fire 에서 복사, 2026-11-07) ----------
  // 검은 현무암 전당 + 용암 폭포 · 사슬 기둥 · 화로, 가운데(mid) = 흑요석 제단 + 봉인된 뿔 달린 화염 마신 문. 바닥 = 금 간 현무암 + 빛나는 용암 줄
  //   광산 배경과 같은 방식(arena: mid 는 싸움터 가운데 한 장, far · ground 이어 붙임, ceil = 키 큰 화면 위 천장). 바닥 선만 조금 낮음(floorY 156)
  var BG_DG_FIRE = {
    arena: true,
    far:    { img: 'assets/bg/dungeon/fire/far.png',    w: 202, tile: true,  parallax: 0.5 },
    mid:    { img: 'assets/bg/dungeon/fire/mid.png',    w: 228, tile: false, parallax: 1 },
    ground: { img: 'assets/bg/dungeon/fire/ground.png', w: 202, tile: true,  parallax: 1.0 },
    ceil:   { img: 'assets/bg/dungeon/fire/ceil.png',   w: 202, h: 200, voidColor: '#090404' },
    height: 240, floorY: 156, laneTop: 158, laneBottom: 230
  };
  // ---------- 속성 시련 배경 6개 (art\dungeon-bg\{ice,thunder,poison,wind,dark,light} 에서 복사, 2026-11-07) ----------
  // 광산 · 화산굴과 같은 방식(arena: mid = 싸움터 가운데 한 장, far · ground 이어 붙임, ceil = 키 큰 화면 위 천장, 그 위 = voidColor).
  //   폭 · 바닥 선(floorY) = 그 폴더 layers.json 값. 바람은 다시 그린 것(v2, wind\old 아님)
  function dgBg(dir, w, midW, floorY, voidColor) {
    var P = 'assets/bg/dungeon/' + dir + '/';
    return { arena: true,
      far:    { img: P + 'far.png',    w: w,    tile: true,  parallax: 0.5 },
      mid:    { img: P + 'mid.png',    w: midW, tile: false, parallax: 1 },
      ground: { img: P + 'ground.png', w: w,    tile: true,  parallax: 1.0 },
      ceil:   { img: P + 'ceil.png',   w: w, h: 200, voidColor: voidColor },
      height: 240, floorY: floorY, laneTop: 158, laneBottom: 230 };
  }
  var BG_DG_ICE     = dgBg('ice',     232, 201, 146, '#070910');   // 얼음 동굴: 빙하 전당 · 큰 고드름 · 가운데 = 얼어붙은 제단 + 눈꽃 문장 얼음 문
  var BG_DG_THUNDER = dgBg('thunder', 221, 208, 144, '#05060b');   // 번개 첨탑: 쇠 · 돌 탑 · 구리 코일 기둥 · 가운데 = 거대한 테슬라 코일 + 번개 구슬
  var BG_DG_POISON  = dgBg('poison',  203, 222, 144, '#050706');   // 독 늪지: 이끼 굴 · 점액 · 빛나는 버섯 · 가운데 = 독 웅덩이 속 제단 + 뱀 머리 사당 문
  var BG_DG_WIND    = dgBg('wind',    172, 259, 151, '#0d1414');   // 바람 협곡(v2): 협곡 속 백옥 신전 · 바람 눈 천창 · 가운데 = 떠 있는 옥돌 고리 + 소용돌이 바람 기둥
  var BG_DG_DARK    = dgBg('dark',    225, 222, 145, '#030106');   // 어둠 신전: 흑요석 전당 · 사슬 · 보라 불 화로 · 가운데 = 사슬 묶인 가시 공허 문
  var BG_DG_LIGHT   = dgBg('light',   195, 228, 147, '#1c1814');   // 빛의 성소: 흰 대리석 · 금 대성당 · 장미창 · 가운데 = 빛 내리는 제단 + 칼 든 천사 석상 둘

  // ---------- 속성 시련(rule 'raid', trial) 공통 값 (2026-11-07, 형님 승인) ----------
  //   레이드 보스 그림이 아직 없어서(빙결의 여왕 등은 나중에) 지금은 「속성 시련」: 웨이브 1~5 = 그 속성 몹 큰 무리 + 대장 → 마지막 = 「OO 수호자」(크게 키운 대장, 속성 능력 강화)
  //   몹 · 대장 구성 = elMobs.dungeons[속성] 의 mobs · mids(맨 아래 trialFill 이 웨이브로 펼침). 다른 값은 이 틀 + 던전마다 적은 값(덮어씀)
  //   레이드 보스가 생기면: 그 던전에 boss = { … 불의 화산굴 boss 와 같은 모양 } 을 넣으면 수호자 대신 보스(champ 는 안 씀)
  function dgTrial(o) {
    var T = {
      rule: 'raid', trial: true, unlock: 'class', lockHint: '전직 후 열림', tag: '레이드 보스 준비 중',
      tier: 5, hpMul: 1.1, dmgMul: 1.1,      // 몹 세기 = 불의 화산굴과 같음(5판쯤). 난이도 배율 = modes(5판 값)
      arenaMin: 560, startMs: 1200,
      spawn: { maxAlive: [9, 13], cap: 30, firstMs: 300 },
      pack: { every: [1700, 1100], size: [4, 6], sizeJit: 1, minRoom: 3, dx: [10, 40], gapMs: 90,
              mix: { side: [4, 0], pincer: [3, 0], drop: [3, 0], front: [1, 0] }, dropH: 90, dropBack: 0.3, frontH: 34, avoid: 46 },
      // 웨이브 틀: n = 잡몹 수, mids = [[이 마리 수만큼 나온 뒤, 대장 번호]]. 몹 종류 · 무게 = elMobs.dungeons(마지막 웨이브는 맨 끝 종류 무게 x2)
      wavePlan: [
        { n: 16, mids: [] },
        { n: 20, mids: [[10, 0]] },
        { n: 22, mids: [[6, 1]] },
        { n: 24, mids: [[4, 0], [16, 1]] },
        { n: 28, mids: [[3, 1], [12, 0], [20, 1]] }
      ],
      restMs: 1500,
      mids: { hp: 560 },
      drop: { mob: 0.025, tough: 0.05, mid: [1.5, 2.5] },   // 2026-11-07 절반(예전 5% · 10% · 3~5개). 소수 = 그 확률로 하나 더
      // 난이도별: stones · crys = 마지막 보상 배율, spawn = 무리 빠르기, alive = 살아 있는 몹 한도, boss = 수호자(보스) 체력 배율(난이도 hpMul 위에 더)
      modes: { easy: { stones: 1, crys: 1, spawn: 1, alive: 1, boss: 1 }, normal: { stones: 1.5, crys: 1.5, spawn: 1.15, alive: 1.15, boss: 1.1 }, hard: { stones: 2, crys: 2, spawn: 1.3, alive: 1.3, boss: 1.2 } },
      magnet: { r: 48, depth: 28, delayMs: 400, ms: 520, turns: 1.25, shrink: 0.5 },
      boss: null,           // 레이드 보스(아직 없음) → 아래 수호자
      // ----- 수호자(champion): 대장(midMake)과 같은 방식으로 더 크게(scale) · 더 단단하게. 속성 능력 = elMobs.els[속성] 위에 amp 를 덮어씀(강화) -----
      //   L = [잡몹 종류, 이름, 색 변종(el_속성 = 속성 몹 색)], hp = 체력(판 배율 · 난이도 · modes.boss 곱하기 전), dmgMul = 공격력 더(대장 배율 위에)
      //   knockResist = 밀림 배율(대장 값 위에 곱함, 작을수록 덜 밀림), rim = 몸 둘레 빛나는 테두리(없으면 던전 color), tint = 색 덮어쓰기(속성 색을 더 진하게 · 밝게), noLaunch: false = 띄우기 기술에 뜸(없으면 안 뜸, 레이드 보스처럼)
      //   adds = 수호자가 있는 동안 everyMs 마다 그 속성 몹 n 마리 무리(살아 있는 잡몹이 max 마리 아래일 때만, 처음 firstMs 뒤)
      //   drop = 쓰러지면 그 속성 결정 crys · 강화석 stones 개 [최소, 최대](x 난이도 modes 배율)를 와르르 → 전부 빨려 듦(magnet), deathMs = 쓰러진 뒤 보상까지
      champ: { scale: 2, hp: 2600, dmgMul: 1.1, knockResist: 0.5, rim: null, tint: { bright: 1.02, colorK: 0.46 },
               adds: { firstMs: 6000, everyMs: 9000, n: 4, max: 8 },
               drop: { crys: [9, 12], stones: [3, 4.5], burstMs: 900 },   // 2026-11-07 절반(예전 결정 18~24 · 강화석 6~9)
               magnet: { r: 9999, depth: 9999, delayMs: 700, ms: 800, turns: 1.4, shrink: 0.45 },
               deathMs: 1400 }
    };
    var out = Object.assign({}, T, o);
    out.champ = Object.assign({}, T.champ, o.champ || {});
    if (!out.champ.rim) out.champ.rim = { color: o.color || '#ffb43a', px: 2, alpha: 0.85 };
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
      // 매끈한 2배(HD, 2026-11-03): 게임 계산은 전부 240줄 도트 그대로 두고, 캔버스는 이 배수로 크게 만들어 부드럽게 그린다.
      //   2 = 480줄(HD 그림 assets/hd, 그림 1점 = 0.5 도트, 테두리 매끈·원래 색). 1 = 예전 도트 화면(작은 도트 그림 assets/s055).
      //   주소 뒤 ?rs=1 로 예전 화면을 잠깐 볼 수 있다. HD 그림은 pipeline/ai-sprite/hd_bake.py 로 굽는다(art/stage1/README 「매끈한 2배 버전」)
      renderScale: 2,
      targetH: 240,        // 논리 화면 높이 목표(도트 기준). 실제 배율은 정수로만
      minLandW: 360,       // 가로 화면 최소 폭(도트). 폴드 펼친 화면처럼 정사각형에 가까우면 배율을 낮춰 옆을 넓게(캐릭터가 너무 커지지 않게, 남는 위쪽은 하늘)
      // 정사각형에 가까운 가로 화면(가로/세로 < squareAspect, 폴드 펼친 화면 834x752 = 1.11): 보이는 폭을 minSquareW 도트 이상으로(2026-11-07 형님 폴드 실측)
      //   834x752 배율 3배 화면 → 배율 4 → 626x564 도트(예전 6 → 417x376). 1.5 이상(보통 폰 · PC)은 안 바뀜
      squareAspect: 1.5,
      minSquareW: 560,
      // 그 화면(가로/세로 < squareAspect)에서 보이는 높이가 배경(240)보다 크면: 먼 배경(far · mid · 천장)을 바닥 선 기준으로 키워 위까지 채움(최대 maxZoom 배),
      //   키운 그림 맨 위 blendPx 도트는 하늘색으로 부드럽게(main.js drawStageBg · bgZoom). 바닥 · 걷는 길 · 캐릭터 크기는 그대로
      tallBg: { maxZoom: 2, blendPx: 24 },
      // 위아래 여백(2026-11-07 형님, 폴드 펼친 화면 = 캐릭터가 너무 작음): 손가락 화면에서 가로/세로 < aspect 이면 게임 화면을 aspect 비율(16:9 와 16:10 사이)로
      //   자르고 위아래를 비움(main.js resize). 보이는 높이 = targetH 도트 근처(정수 배율, 배경 240 이상) = 접은 폰(약 254~270)보다 조금 키 큼.
      //   위 여백 = 전체 여백의 topShare(최소 hudH css px: 체력판 · 단계 글자) = HUD 자리, 나머지 아래 여백 = 조작 버튼 자리. 보통 폰 · PC 는 그대로
      letterbox: { aspect: 1.7, targetH: 300, topShare: 0.4, hudH: 88 },

      // PC 아래 막대(2026-11-07): 막대만큼 게임 화면 아래를 비우고(캐릭터 크기 = 배율은 그대로) 하늘 위쪽을 잘라 냄.
      //   잘린 뒤 화면 높이가 minPcH 도트보다 낮아지면 배율을 한 단계 낮춤(아주 낮은 창)
      minPcH: 196,
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
        wand:  { label: '완드',   img: 'assets/weapons/wand.png',  grip: { x: 8, y: 4 },  baseAngle: 0, layer: 'back' },
        // 강화 등급 그림(2026-11-06, artweapons-v1, 형님 승인): +0 일반 · +3 희귀 · +6 영웅 · +9 전설 (config enchant.art 가 고름).
        //   2026-11-09 v2(art/weapons-v2, 형님): 검 +0~+9 = 강철 → 은청 → 백금 → 빛나는 금(검정 · 보라 없음), 지팡이 +3~+9 = 얼음 → 불·얼음 쌍수정 → 3속성 금빛 후광
        //   (나무 지팡이 +0 · 신화 +10 은 그대로). 예전 그림 = art/weapons-v1/old2
        //   그림 = 1배 assets/weapons/<이름>.png, HD = assets/hd/weapons/<이름>.webp(x1.4), 작은 화면 = assets/s055(x0.7). grip = 1배 그림 손잡이 점
        //   kind = 원소 오라(js/enchant.js)가 불티를 내는 곳(sword = 칼날, staff = 머리 쪽)
        sword_common:    { label: '검', img: 'assets/weapons/sword_common.png',    grip: { x: 6, y: 5 },  baseAngle: 0, layer: 'back', kind: 'sword' },
        sword_rare:      { label: '검', img: 'assets/weapons/sword_rare.png',      grip: { x: 6, y: 5 },  baseAngle: 0, layer: 'back', kind: 'sword' },
        sword_epic:      { label: '검', img: 'assets/weapons/sword_epic.png',      grip: { x: 6, y: 6 },  baseAngle: 0, layer: 'back', kind: 'sword' },
        sword_legendary: { label: '검', img: 'assets/weapons/sword_legendary.png', grip: { x: 10, y: 7 },  baseAngle: 0, layer: 'back', kind: 'sword' },
        staff_common:    { label: '지팡이', img: 'assets/weapons/staff_common.png',    grip: { x: 23, y: 7 }, baseAngle: 0, layer: 'back', kind: 'staff' },
        staff_rare:      { label: '지팡이', img: 'assets/weapons/staff_rare.png',      grip: { x: 23, y: 8 }, baseAngle: 0, layer: 'back', kind: 'staff' },
        staff_epic:      { label: '지팡이', img: 'assets/weapons/staff_epic.png',      grip: { x: 23, y: 13 }, baseAngle: 0, layer: 'back', kind: 'staff' },
        staff_legendary: { label: '지팡이', img: 'assets/weapons/staff_legendary.png', grip: { x: 23, y: 15 }, baseAngle: 0, layer: 'back', kind: 'staff' },
        // +10 신화(2026-11-06): mythic = 고유 효과(js/mythicfx.js) 켬
        sword_mythic:    { label: '검', img: 'assets/weapons/sword_mythic.png',    grip: { x: 6, y: 11 }, baseAngle: 0, layer: 'back', kind: 'sword', mythic: true },
        staff_mythic:    { label: '지팡이', img: 'assets/weapons/staff_mythic.png',    grip: { x: 23, y: 16 }, baseAngle: 0, layer: 'back', kind: 'staff', mythic: true },
        // 2차 갈래 전용 무기(2026-11-09, art/weapons-branch, pipeline/ai-sprite/weapons_branch.py): 마검사 = 검은 마검(sword_dark_*), 흑마법사 = 해골 지팡이(staff_dark_*)
        //   성기사 · 대마법사 = 위 기존 등급 그림 그대로(형님 2026-11-09). 고르는 곳 = enchant.artBranch. 크기 · 손잡이 규칙은 기존 묶음과 같음
        sword_dark_common:    { label: '마검', img: 'assets/weapons/sword_dark_common.png',    grip: { x: 6, y: 5 },  baseAngle: 0, layer: 'back', kind: 'sword' },
        sword_dark_rare:      { label: '마검', img: 'assets/weapons/sword_dark_rare.png',      grip: { x: 6, y: 5 },  baseAngle: 0, layer: 'back', kind: 'sword' },
        sword_dark_epic:      { label: '마검', img: 'assets/weapons/sword_dark_epic.png',      grip: { x: 7, y: 6 },  baseAngle: 0, layer: 'back', kind: 'sword' },
        sword_dark_legendary: { label: '마검', img: 'assets/weapons/sword_dark_legendary.png', grip: { x: 8, y: 7 },  baseAngle: 0, layer: 'back', kind: 'sword' },
        sword_dark_mythic:    { label: '마검', img: 'assets/weapons/sword_dark_mythic.png',    grip: { x: 10, y: 8 }, baseAngle: 0, layer: 'back', kind: 'sword', mythic: true },
        staff_dark_common:    { label: '해골 지팡이', img: 'assets/weapons/staff_dark_common.png',    grip: { x: 23, y: 5 },  baseAngle: 0, layer: 'back', kind: 'staff' },
        staff_dark_rare:      { label: '해골 지팡이', img: 'assets/weapons/staff_dark_rare.png',      grip: { x: 23, y: 5 },  baseAngle: 0, layer: 'back', kind: 'staff' },
        staff_dark_epic:      { label: '해골 지팡이', img: 'assets/weapons/staff_dark_epic.png',      grip: { x: 23, y: 9 },  baseAngle: 0, layer: 'back', kind: 'staff' },
        staff_dark_legendary: { label: '해골 지팡이', img: 'assets/weapons/staff_dark_legendary.png', grip: { x: 23, y: 14 },  baseAngle: 0, layer: 'back', kind: 'staff' },
        staff_dark_mythic:    { label: '해골 지팡이', img: 'assets/weapons/staff_dark_mythic.png',    grip: { x: 23, y: 15 }, baseAngle: 0, layer: 'back', kind: 'staff', mythic: true }
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
        // 2026-11-08 형님: 기본 = 회피 1번(charges 1) → 쓰면 cdMs 쿨타임(폰 버튼이 시계 방향으로 어두워졌다 밝아짐).
        //   늘 켜진 기술 「날렵한 몸놀림」(nimble) = 연속 passive.charges(2)번 · 다 쓴 뒤 쿨타임 passive.val(1200) · 하나만 썼을 때 passive.refillMs(470) 뒤 하나 돌아옴 ·
        //   거리 x (1 + passive.dist). 회피가 끝나자마자 두 번째 회피 바로 됨(첫 회피 중에 눌러 둔 것도 나감). 2번일 때만 버튼에 남은 수 점이 보임
        charges: 1,         // 연속으로 할 수 있는 회피 수(기본 1, 날렵한 몸놀림 = 2)
        cdMs: 1800,         // 다 쓴 뒤 쿨타임(끝나면 전부 참). 날렵한 몸놀림 = 1200
        refillMs: 700,      // 2번 중 하나만 썼을 때 그 하나가 돌아오는 시간(회피 안 하는 동안). 날렵한 몸놀림 = 470
        bufferMs: 150,      // 미리 눌러 둔 회피 기억 시간(공격 끝무렵에 눌러 두면 끊고 나감)
        endPose: 0.62,      // 이 비율부터 착지 웅크림 그림
        ghosts: 5,          // 잔상 개수(길 따라 고르게)
        ghostMs: 300,       // 잔상 하나가 사라지는 시간
        ghostAlpha: 0.6,    // 잔상 처음 진하기
        colors: { novice: '#fff0c0', knight: '#6ab8ff', mage: '#c890ff', archer: '#8affb8' },   // 잔상 색(직업별). 없는 직업 = novice
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
      // tier2 = 2차 옷(2026-11-07, 2026-11-08 기사 Lv30 → 25 = 성기사 전직 · 2차 기술도 이 Lv 부터): 레벨이 lv 이상이면 outfit 대신 이 옷(characters 의 「옷_성별」, 그 성별 그림이 없으면 1차 옷 그대로). 그림만 바뀜
      // 2차 전직 갈래(2026-11-08 형님): tier2.branches = Lv25 에 둘 중 하나를 고름(저장칸 tier2Branch, 한 번 고르면 못 바꿈). 갈래마다
      //   key = 'a' / 'b'(기술 책 SKILL_TREE 의 branch 와 같은 값), name = 2차 이름, outfit = 2차 옷(characters 의 「옷_성별」), desc = 고르기 카드 설명,
      //   look = 그 옷 그림이 아직 없을 때 임시: base(1차 옷)를 코드로 물들이고(tint = 색 · k = 세기) 몸 둘레 빛 테두리(outline) → 아래 addSkillArt 가 「옷_성별」을 만들어 줌.
      //     진짜 그림이 오면 characters 에 outfit_성별(예: knight_t2b_male)을 넣기만 하면 그 그림을 씀(look 은 무시됨)
      //   tier2.outfit · name = 예전 값(갈래 a 와 같음, 갈래가 없는 직업도 이것만 있으면 됨)
      //   앞으로 궁수(저격수 / 레인저) · 암살자(그림자 무사 / 독술사)도 여기 branches + SKILL_TREE 의 branch 만 적으면 됨(코드 그대로)
      knight: { label: '기사(검)',   weapon: 'sword', moves: 'sword', outfit: 'knight', tier2: { lv: 25, outfit: 'knight_t2', name: '성기사',
                branches: [
                  { key: 'a', name: '성기사', outfit: 'knight_t2', desc: '성스러운 금빛 힘. 회오리 · 번개 칼 · 빛의 십자로 넓게 쓸고, 체력이 저절로 차요' },
                  { key: 'b', name: '마검사', outfit: 'knight_t2b', desc: '칼에 마력을 실은 보라빛 검사. 검기 · 순간 돌진 · 마력 검으로 몰아치고, 평타가 마법으로 세져요',
                    look: { base: 'knight', tint: '#8a3aff', k: 0.2, outline: { color: '#b46aff', alpha: 0.55, glow: true } } }
                ] } },
      // 법사: 무기가 성별마다 다름(남 지팡이 staff / 여 짧은 지팡이 wand)
      //   법사 2차(2026-11-08) = Lv25 대마법사: 남 = mage_t2_male, 여 = mage_t2_female / 갈래 b 흑마법사 = 그림이 올 때까지 법사 옷을 어둡게 + 검보라 빛
      mage:   { label: '법사(지팡이)', weapon: { male: 'staff', female: 'wand' }, moves: 'magic', outfit: 'mage', tier2: { lv: 25, outfit: 'mage_t2', name: '대마법사',
                branches: [
                  { key: 'a', name: '대마법사', outfit: 'mage_t2', desc: '불 · 얼음 · 번개를 다루는 대마법사. 운석 · 불기둥 · 얼음 폭풍 · 천둥으로 화면을 덮어요' },
                  { key: 'b', name: '흑마법사', outfit: 'mage_t2b', desc: '어둠과 저주의 마법사. 구체 · 늪 · 악령 회오리 · 검은 문으로 적을 깎고, 준 피해로 체력을 빨아들여요',
                    look: { base: 'mage', tint: '#1a0626', k: 0.38, outline: { color: '#8a2ad0', alpha: 0.6, glow: true } } }
                ] } },
      // 궁수(2026-11-09): 활(그림에 박힘) · 평타 = 화살 3타(ARCHER) · 2차 Lv25 = 저격수 / 레인저. 2차 옷 그림은 아직 없음 → 1차 옷을 물들이고 빛 테두리(look, T2B_DONE 과 같은 방식)
      archer: { label: '궁수(활)', weapon: 'bow', moves: 'bow', outfit: 'archer', tier2: { lv: 25, outfit: 'archer_t2a', name: '저격수',
                branches: [
                  { key: 'a', name: '저격수', outfit: 'archer_t2a', desc: '은빛 저격수. 멀리서 가장 센 적을 노려 한 줄로 꿰뚫고, 거대한 화살 · 하늘의 일격으로 큰 적을 쓰러뜨려요',
                    look: { base: 'archer', tint: '#0c2a3a', k: 0.32, outline: { color: '#bfe6ff', alpha: 0.55, glow: true } } },
                  { key: 'b', name: '레인저', outfit: 'archer_t2b', desc: '숲의 레인저. 화살 폭풍 · 덫 · 회오리로 몹 떼를 쓸고, 매 동료가 저절로 적을 공격해요',
                    look: { base: 'archer', tint: '#5a3a08', k: 0.24, outline: { color: '#c8ff7a', alpha: 0.55, glow: true } } }
                ] } }
      // , axe: { label: '도끼', weapon: 'axe', moves: 'sword' }
    },
    defaultClass: 'novice',
    // 전직 화면 카드(2026-11-06): 고를 수 있는 직업(위 classes 이름) + 「준비 중」 회색 카드. desc = 카드 밑 짧은 설명
    classChange: [
      { key: 'knight', name: '기사', weapon: '검', desc: '튼튼한 갑옷과 검. 앞으로 파고들어 베는 근접 싸움꾼' },
      { key: 'mage',   name: '법사', weapon: '지팡이', desc: '마법탄과 폭발로 여러 적을 한꺼번에. 몸은 약하지만 멀리서 강함' },
      { key: 'archer', name: '궁수', weapon: '활', desc: '빠른 화살로 멀리서 꿰뚫는 사냥꾼. 화살비 · 폭발 화살로 몹 떼를 쓸어요' },
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
      wand:  { damage: [10, 14],  magic: true, hitstopMul: 0.95, shakeMul: 0.9, knockMul: 0.9, speed: 1.0, arcColor: '#e6d2ff', sparkColor: '#e0a8ff' },
      // 궁수 활(2026-11-09): 물리(힘). 한 발은 검보다 조금 약하고(10~14) 화살이 꿰뚫어 여러 마리를 맞힘
      bow:   { damage: [10, 14], hitstopMul: 0.85, shakeMul: 0.8, knockMul: 0.9, speed: 1.0, arcColor: '#d8ffe8', sparkColor: '#d8ffc0' }
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
                           captain: '검은 바다의 약탈자', wyvern: '화산을 나는 날개', vampire: '피에 굶주린 밤의 귀족', general: '마왕군 선봉장', demonking: '어둠의 왕좌', ignis: '불의 화산굴의 주인' } },

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
    //   mage 「마력 폭주」: 기술 마나 0 · 기술이 한 번 더 터짐(화염구 = 한 발 더, 빙산 솟구치기 = 마지막 빙산 한 번 더(60%), 번개 = 같은 자리에 한 번 더, 메테오·땅 융기 = 다른 적에게 하나 더, echoMs 뒤)
    //     2026-11-08: 중력 구체 = 같은 자리에서 한 번 더 터짐(70%) · 빙결 폭풍 = 한 번 더 깨짐(60%) · 천둥 심판 = 다음 센 적에게 기둥 하나 더(60%)
    //   novice(전직 전 견습): 공통만(금색)
    //   거리 값(pushR·push·end.r·end.depth)은 원래 그림 크기 기준(쓸 때 actorScale 곱함)
    awaken: {
      ms: 10000, introMs: 650, slowMs: 650, atkMul: 1.3, cdRate: 2, armorMs: 400, pushR: 150, push: 70,
      end: { r: 170, depth: 70, dmg: 4 },
      knight: { name: '광전사', color: '#ff3a1a', glow: '#ff8a3a', atkSpd: 0.25, spdCap: 1.5, lifesteal: 0.05,
                look: { hue: -18, sat: 1.25, bright: 0.72, color: '#8a0a0a', colorK: 0.38 } },
      mage:   { name: '마력 폭주', color: '#b46aff', glow: '#5ae6ff', echoMs: { fireball: 160, ice: 240, bolt: 200, meteor: 260, rise: 190, pillar: 200, gravity: 220, frost: 320, judgment: 300, darkorb: 240, abyss: 320, wraith: 260 },   // 2026-11-08 흑마법사: 어둠의 구체 · 심연의 문 = 한 번 더 터짐(60%), 악령 회오리 = 끝에 한 번 더 휩쓺
                  // 2026-11-08 + 불기둥 · 중력 구체(한 번 더 터짐) · 빙결 폭풍(한 번 더 깨짐) · 천둥 심판(다음 적에게 한 번 더, 60%)
                look: { hue: 12, sat: 1.35, bright: 0.72, color: '#3a0a6a', colorK: 0.3 } },
      // archer 「매의 눈」(2026-11-09): 화살마다 한 발 더 · 더 꿰뚫음(+2) · 금빛 두건
      archer: { name: '매의 눈', color: '#9dff8a', glow: '#fff2a0', look: { hue: 40, sat: 1.2, bright: 0.85, color: '#6a5a0a', colorK: 0.3 } },
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
                        skill_holy: ['#ffffff', '#fff6c8', '#ffd23f'], skill_arcane: ['#ffffff', '#e8d0ff', '#8ff0ff'],
                        skill_dark: ['#ffd8f4', '#c060d0', '#6a1a8a'],
                        skill_arrow: ['#ffffff', '#d8fff0', '#7affc0'], skill_snipe: ['#ffffff', '#e0f4ff', '#9fd8ff'], skill_wild: ['#ffffff', '#f0ffc0', '#b8ff6a'] } }   // 궁수(2026-11-09)   // skill_dark = 흑마법사(2026-11-08)
    },

    // ---------- 사냥 손맛 (2026-11-07, 형님 「우리 게임 = 사냥 중심, 몹 떼를 화려하게 쓸어버리는 맛, 던파처럼 화려한 연출」) ----------
    // 시험으로 1판에만 켬(stages = 켤 판 id 목록). 다른 판도 켜려면 stages 에 id 를 넣으면 끝(웨이브마다 horde: false 로 그 웨이브만 끔)
    // 아래 묶음마다 on: false 로 따로 끌 수 있음. 거리 값(도트)은 원래 그림 크기 기준(쓸 때 actorScale 곱함)
    hunt: {
      on: true,
      stages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],   // 눈맛 연출(숫자·KILL·펑·구슬·흔들림)은 전 판. 몹 수는 아래 horde.stageMul 로 판마다 서서히
      // 몹 떼: 잡몹(성장 경험치 종류 'mob' = 고블린·늑대·박쥐 …, 보스·단단한 잡몹은 그대로)을 mul 배로. 대신 한 마리는 약하게(hpMul),
      //   경험치는 xpMul 배(마리 수 x 배율 = 판 전체 경험치는 그대로 → 레벨 오르는 빠르기 그대로)
      //   늘어난 몹은 반대쪽 끝에서 같이 나옴(양옆에서 떼로) + gapMs 씩 조금 늦게, 화면 밖으로 xOff 도트씩 더 떨어져서(한 덩어리로 겹치지 않게)
      //   미리 서 있는 무리(placed)도 mul 배: 옆으로 placedDx 도트, 위아래 placedDy(길 폭 비율) 비켜 서서 같은 무리로
      //   동시에 때리러 오는 잡몹 수(maxAttackers)·공격 시작 간격(attackGapMs)은 따로 정함(몹이 많아도 한꺼번에 몰매 맞지 않게)
      //   웨이브에 hordeMul: 3 처럼 적으면 그 웨이브만 배수를 바꿈
      //   (2026-11-06 형님: 1판부터 많을 필요 없고 판이 올라갈수록 서서히 많이) stageMul = 판 번호별 배수(소수 OK = 몇 마리 중 일부만 하나 더).
      //   한 마리 체력 = 원래 x 배수^-hpExp (2배 → 0.4), 경험치 = 원래 / 배수 → 판 전체 경험치 그대로. 배수 1 이면 원래 그대로
      horde: { on: true, mul: 2, stageMul: { 1: 1, 2: 1.15, 3: 1.3, 4: 1.4, 5: 1.5, 6: 1.6, 7: 1.7, 8: 1.8, 9: 1.9, 10: 2, 11: 2.05, 12: 2.1, 13: 2.15, 14: 2.2, 15: 2.25, 16: 2.3, 17: 2.35, 18: 2.4, 19: 2.45, 20: 2.5 }, hpExp: 1.32, hpMul: 0.4, dmgMul: 1.0, xpMul: 0.5, bothSides: true, gapMs: 180, xOff: 34, placedDx: 30, placedDy: 0.2,
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
      //   zoom 1.2 = 기술 숫자 1.2배(2026-11-07 형님: 큰 피해 기술이니 숫자 더 크게). 각성 숫자는 그보다 큰 1.45
      //   기술 쪽에서 damageStyle 로 고른다(CFG.skills). 새 모양을 만들면 여기에 이름을 하나 더 적고 기술의 damageStyle 을 그 이름으로
      skill_knight: { font: 'giant', scale: 1, bold: true, zoom: 1.2, top: '#ffffff', bottom: '#9cc8ff', outline: '#1a2a4a', shadow: 'rgba(8,14,30,0.45)',
                      pop: { top: '#ffffff', bottom: '#ffffff' } },
      skill_fire:   { font: 'giant', scale: 1, bold: true, zoom: 1.2, top: '#ffd27a', bottom: '#ff5a1e', outline: '#4a1408', shadow: 'rgba(30,8,4,0.45)',
                      pop: { top: '#fff4d0', bottom: '#ffb040' } },
      skill_bolt:   { font: 'giant', scale: 1, bold: true, zoom: 1.2, top: '#fff6a0', bottom: '#5ae6ff', outline: '#14244a', shadow: 'rgba(6,12,30,0.45)',
                      pop: { top: '#ffffff', bottom: '#fff6a0' } },
      // 얼음창(2026-11-06): 흰색 → 얼음 파랑
      skill_ice:    { font: 'giant', scale: 1, bold: true, zoom: 1.2, top: '#ffffff', bottom: '#7fe0ff', outline: '#0e2a48', shadow: 'rgba(6,14,30,0.45)',
                      pop: { top: '#ffffff', bottom: '#d8f8ff' } },
      // 땅 융기(2026-11-06 밤): 흰색 → 보라(마법진 색)
      skill_earth:  { font: 'giant', scale: 1, bold: true, zoom: 1.2, top: '#ffffff', bottom: '#c8a0ff', outline: '#2a1048', shadow: 'rgba(14,6,30,0.45)',
                      pop: { top: '#ffffff', bottom: '#ead8ff' } },
      // 2차 기술(2026-11-06): 성검 낙뢰 = 흰색 → 금색 / 순간이동 = 흰색 → 보라
      skill_holy:   { font: 'giant', scale: 1, bold: true, zoom: 1.2, top: '#ffffff', bottom: '#ffd23f', outline: '#4a3004', shadow: 'rgba(30,20,4,0.45)',
                      pop: { top: '#ffffff', bottom: '#fff6c8' } },
      skill_arcane: { font: 'giant', scale: 1, bold: true, zoom: 1.2, top: '#ffffff', bottom: '#c890ff', outline: '#24083e', shadow: 'rgba(16,6,30,0.45)',
                      pop: { top: '#ffffff', bottom: '#e8d0ff' } },
      // 흑마법사(2026-11-08): 연분홍 → 검붉은 보라
      skill_dark:   { font: 'giant', scale: 1, bold: true, zoom: 1.2, top: '#ffe0f4', bottom: '#b03ad0', outline: '#1a0420', shadow: 'rgba(16,4,20,0.5)',
                      pop: { top: '#ffffff', bottom: '#f0b0ff' } },
      // 궁수(2026-11-09): 화살 = 흰색 → 민트 / 저격수 = 흰색 → 은빛 하늘 / 레인저 = 연두 → 숲 초록 · 매의 눈 각성 = 금빛 연두
      skill_arrow:  { font: 'giant', scale: 1, bold: true, zoom: 1.2, top: '#ffffff', bottom: '#6affb8', outline: '#0a3a24', shadow: 'rgba(4,24,14,0.45)',
                      pop: { top: '#ffffff', bottom: '#d8fff0' } },
      skill_snipe:  { font: 'giant', scale: 1, bold: true, zoom: 1.25, top: '#ffffff', bottom: '#8fd0ff', outline: '#0a2238', shadow: 'rgba(4,12,24,0.45)',
                      pop: { top: '#ffffff', bottom: '#e0f4ff' } },
      skill_wild:   { font: 'giant', scale: 1, bold: true, zoom: 1.2, top: '#f6ffd0', bottom: '#8ae040', outline: '#1e3408', shadow: 'rgba(10,20,4,0.45)',
                      pop: { top: '#ffffff', bottom: '#e0ffa0' } },
      awk_archer:   { font: 'giant', scale: 1, bold: true, zoom: 1.45, top: '#fffbe0', bottom: '#9dff8a', outline: '#1a3a08', shadow: 'rgba(10,24,4,0.5)',
                      pop: { top: '#ffffff', bottom: '#fff2a0' } },
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
      // 각성 중 데미지(2026-11-06 밤): 기술 숫자(giant)보다 zoom 배 크게(2026-11-07: 1.3 → 1.45, 기술 숫자 1.2 보다 크게) + 직업 색(광전사 = 붉은 불꽃 / 마력 폭주 = 보라·하늘 / 견습 = 금색)
      awk_knight: { font: 'giant', scale: 1, bold: true, zoom: 1.45, top: '#fff0d8', bottom: '#ff3a1a', outline: '#3a0404', shadow: 'rgba(40,4,4,0.5)',
                    pop: { top: '#ffffff', bottom: '#ffb040' } },
      awk_mage:   { font: 'giant', scale: 1, bold: true, zoom: 1.45, top: '#f6eaff', bottom: '#b46aff', outline: '#20083a', shadow: 'rgba(20,6,40,0.5)',
                    pop: { top: '#ffffff', bottom: '#8ff0ff' } },
      awk_novice: { font: 'giant', scale: 1, bold: true, zoom: 1.45, top: '#fffbe0', bottom: '#ffc030', outline: '#4a2a04', shadow: 'rgba(30,20,4,0.5)',
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
      // 던전 남은 시간(2026-11-07, main.js drawDgTimer): 위 가운데 큰 숫자(초). zoom = 크기 배율, Warn = 마지막 몇 초(빨강, 깜빡)
      dgTimer:     { font: 'giant', scale: 1, bold: true, zoom: 1.7, top: '#fff6d8', bottom: '#ffc23a', outline: '#2a1606', shadow: 'rgba(10,6,4,0.55)' },
      dgTimerWarn: { font: 'giant', scale: 1, bold: true, zoom: 1.9, top: '#ffb0a0', bottom: '#ff2a1a', outline: '#3a0404', shadow: 'rgba(30,4,4,0.6)' },
      multikill: { font: 'giant', scale: 1, bold: true, zoom: 1.3, top: '#fffbe0', bottom: '#ff7a1a', outline: '#4a0e04', shadow: 'rgba(30,6,4,0.5)',
                   pop: { top: '#ffffff', bottom: '#ffe066' } },
      // 치명타(2026-11-06, 민첩 AGI 로 확률이 오름, 데미지 x growth.stats.critMul): 기술 숫자만큼 큰 giant + 주황·빨강 → 마무리 「22!」(노랑)와 구분
      agicrit: { font: 'giant', scale: 1, bold: true, top: '#fff27a', bottom: '#ff5a1a', outline: '#5a0a08', shadow: 'rgba(40,6,4,0.5)',
                 pop: { top: '#ffffff', bottom: '#ffd040' } },
      // 무기 속성(2026-11-06, js/enchant.js): 화상(주황) · 독(초록) 지속 피해는 작은 숫자, 튀는 번개(하늘), 강화석·결정 주움 글자
      dot_fire:   { font: 'large', scale: 1, top: '#ffe0a0', bottom: '#ff7a1a', outline: '#4a1404', shadow: 'rgba(30,8,4,0.35)', pop: { top: '#ffffff', bottom: '#ffb040' } },
      dot_poison: { font: 'large', scale: 1, top: '#e0ffc0', bottom: '#4ed62a', outline: '#123a0a', shadow: 'rgba(6,30,6,0.35)', pop: { top: '#ffffff', bottom: '#a8ff7a' } },
      chain:      { font: 'mid', scale: 1, top: '#ffffff', bottom: '#6ac8ff', outline: '#0e2448', shadow: 'rgba(6,12,30,0.4)', pop: { top: '#ffffff', bottom: '#fff6a0' } },
      stone:      { font: 'large', scale: 1, bold: true, top: '#f2f8ff', bottom: '#8fb8e8', outline: '#1a2a4a', shadow: 'rgba(6,10,30,0.4)', pop: { top: '#ffffff', bottom: '#d8ecff' } },
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
      // 2026-11-07 형님(레벨이 너무 빨리 오름): 다음 레벨까지 = (needBase + needPerLv × Lv) × min(1, Lv / needRampLv) + needHiSq × max(0, Lv - needHiLv)²
      //   = (350 + 115 × Lv) × min(1, Lv / 8) + 10 × max(0, Lv - 30)²  (Lv1~7 은 싸게 → 1판에서 Lv6 · Lv30 부터 더 가파르게)
      //   → Lv1→2 = 58, Lv5→6 = 578, Lv8→9 = 1,270, Lv10→11 = 1,500, Lv20→21 = 2,650, Lv29→30 = 3,685, Lv59→60 = 15,545 (예전 10 + 40 × Lv)
      //   노말을 순서대로 안 죽고 깼을 때(지금 판 적 수 · 경험치로 셈): 1판 깸 ≈ Lv6(전직) · 5판 ≈ Lv12.5 · 10판 ≈ Lv20 → 하드 5판 ≈ Lv25.5 · 8판 ≈ Lv29.5 · 10판 ≈ Lv32.7
      //   Lv50 까지 합 ≈ 19만(하드 한 바퀴 ≈ 4.1만) = 후반, Lv60 ≈ 31만. 예전 저장은 레벨 그대로(쌓인 경험치도 그대로, 다음 레벨부터 새 곡선)
      needBase: 350, needPerLv: 115, needRampLv: 8, needHiLv: 30, needHiSq: 10,
      // 레벨마다 저절로 오르는 몫(2026-11-06 반으로 줄임: 예전 +5 / +2%). 나머지는 능력치 점수(아래 stats)로 고름
      hpPerLv: 2.5,
      atkPerLv: 0.01,
      stageMul: 0.18,
      xp: { mob: 10, tough: 15, elite: 40, mid: 40, boss: 150, king: 300 },   // mid = 중간보스(2026-11-06, config midBoss)
      toughHp: 75, eliteHp: 200,
      kind: { mage: 'tough', voidpriest: 'tough' },
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
        // 2026-11-07 형님: Lv1~9 = 0점, Lv10 부터 레벨마다 perLv 점(Lv10 = 1점 · Lv14 = 5점, 합 = Lv - 9). 예전 = 레벨마다 3점
        perLv: 1, fromLv: 10,
        str: 0.008, int: 0.008, vit: 4,
        agi: { atkSpd: 0.005, move: 0.004, crit: 0.003, spdCap: 0.25, critCap: 0.3 },
        wis: { mp: 5, regen: 0.1 },
        critMul: 1.5,
        auto: {
          novice: { str: 4, vit: 3, agi: 3 },
          knight: { str: 5, vit: 3, agi: 2 },
          mage:   { int: 5, wis: 3, vit: 2 },
          archer: { str: 4, agi: 4, vit: 2 }   // 궁수(2026-11-09): 힘 · 민첩(치명타 · 빠르기)
        }
      },
      // 직업마다 기본 몫: hp = 최대 체력에 더함(기사가 더 튼튼), mp = 기본 마나(법사가 더 많음)
      //   2026-11-06 법사 균형: 법사 hp 0 → 35 (멀리 서도 보스 공격 폭이 넓어 자주 맞음. 3판 보스 두꺼비 앞에서 너무 쉽게 쓰러짐. 기사는 체력 능력치를 더 찍어서 Lv 가 오르면 기사가 더 튼튼)
      classBase: { novice: { hp: 0, mp: 40 }, knight: { hp: 15, mp: 40 }, mage: { hp: 35, mp: 80 }, archer: { hp: 25, mp: 60 } },   // 궁수(2026-11-09): 기사와 법사 사이
      // 마나(MP, 2026-11-06): 체력 막대 밑 파란 막대. 지금은 쓰는 곳 없음(기술이 마나 + 쿨타임을 쓰는 건 다음 단계)
      //   최대 = classBase.mp + perLv × (Lv-1) + 지혜 × stats.wis.mp. 초당 regen + 지혜 × stats.wis.regen 씩 참,
      //   적·허수아비를 맞힐 때마다 onHit 만큼 더(소품은 안 셈). 새 판·다시 하기 = 가득, 레벨업 = 늘어난 만큼 참
      mp: { perLv: 2, regen: 1, onHit: 1 },
      // 전직(2026-11-06, 설계안 3번): 이 id 의 판 보스를 처음 깨면 전직 화면(main.js) → 기사/법사 중 하나, 한 번 고르면 이 저장칸에선 못 바꿈.
      //   이미 이 판을 깬 저장인데 직업이 없으면 다음 스테이지 고르기·시작 때 뜸. 고른 직업 = 저장칸(growth.js)의 class
      //   위쪽 견습/기사/법사 버튼은 시험 도구: stagesAllOpen 이 true 일 때만 보이고, 눌러도 저장된 직업은 안 바뀜(이번 창에서만 덮어씀)
      //   2026-11-07 형님: 2판 → 1판(1판 보스를 깨면 바로 전직). 난이도와 상관없이 어느 난이도든 이 판을 깼으면 뜸(main.js needClassChange)
      classChangeStage: 1,
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
      //   (콤보 마지막 타는 2026-11-07부터 넘어뜨리지 않고 finisherStagger) / 무거운 타(그 타 knock × 무기 knockMul ≥ heavyKnock) / juggleWindowMs 안에 juggleHits 번째 맞음
      //   넘어지면 down.slide 만큼 밀려나며 날아감 → lyingMs 더 누워 있음 → 일어남. 넘어짐~일어남 동안 무적(누운 적 때리기 없음)
      react: {
        heavyKnock: 2.0,
        juggleHits: 4, juggleWindowMs: 1500,
        // 평타 콤보 마지막 타(2026-11-07 형님): 넘어뜨리지 않고 크게 휘청 → 올려베기 · 올려치기 · 땅 융기로 바로 띄우기.
        //   stunMs = 맞은 자세로 멈춰 있는 시간, knockMul = 밀려나는 거리 배율(조금만). 불똥 · 흔들림 · 멈칫은 그대로
        finisherStagger: { stunMs: 520, knockMul: 0.35 },
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
      //   2026-11-07 형님(웨이브가 느림): 알아채는 거리 90 → 200(거의 화면 전체), 「!」 300 → 150ms, 무리 깨는 틈 150 → 80ms
      wake: { dist: 200, alertMs: 150, groupDelayMs: 80 },
      // 판 웨이브 빨리 붙기(2026-11-07 형님): 오른쪽에서 걸어 들어오던 잡몹 = 웨이브가 시작될 때 화면 오른쪽에 미리 서 있음(퍼져서 · 플레이어를 봄 · 「!」 뒤 바로 옴).
      //   왼쪽(뒤)에서 오는 몹 · 보스 · 중간보스는 그대로 걸어 들어옴. 던전은 안 함
      //   x = 보이는 화면(오른쪽 버튼 자리 뺀 폭)에서 서는 범위 [왼쪽 비율, 오른쪽 비율], maxAt = 늦게 나오던 몹도 이 ms 안에 다 섬(먼지 퐁), walkMul = 판 잡몹 걷기 빠르기 배율(보스 빼고)
      rightPlace: { on: true, x: [0.55, 0.95], maxAt: 400, walkMul: 1.2 }
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
          idle: [4, 5, true], walk: [12, 8, true],
          attack1: [5, 8, false, [1, 2, 2, 2, 2, 3, 4, 4, 4, 5]],   // 내려찍기: 2 치켜듦(예고 500ms) → 4 땅에 박힘
          attack2: [5, 9, false, [1, 1, 1, 2, 3, 4, 4, 5]],         // 가로 휘두르기: 1 뒤로 젖힘(예고) → 3 쭉 뻗음
          special: [5, 10, false, null],                             // 어깨 돌진: 코드에서 단계별로 재생(아래 charge)
          hit: [3, 8, false, [1, 2, 2, 3]],
          hit2: [3, 8, false, [1, 1, 2, 2, 3]],
          stagger: [4, 7, false, null],                              // 휘청: 장마다 시간은 아래 stagger.d
          death: [5, 6, false, [1, 1, 2, 2, 3, 4, 5]]
        }),
        walkAnim: 'walk',
        walkStride: 170,   // 보폭 걷기(enemies.js stepWalk): 걷기 12장 한 바퀴에 가는 그림 점(2026-11-06 새 걷기 그림 artoss-walk, 발 고정 보정 구움). 48도트/초에 4.6fps 쯤
        hp: 1000, speedX: 48, speedY: 26, radius: 40, height: 152,
        hurtbox: { x0: -27, x1: 50, yTop: -152, yBot: 0 },
        engage: 70, hover: [70, 90], range: [40, 160], alignY: 10, cooldown: [900, 1700], firstCooldown: [1200, 1500],
        knockResist: 0.25, deathKnock: 60,
        staggerCdMs: 2200,       // 한 번 움찔하면 이 시간 동안은 안 움찔함(계속 맞아도 번쩍이기만) → 무한 콤보 방지
        superArmor: true,        // 공격 동작 중에는 맞아도 안 끊김. 보스는 절대 안 넘어짐(knockdown 없음)
        // 휘청(stagger): 체력이 at 비율 아래로 내려갈 때(공격 중이어도 끊김) + 어깨 돌진이 헛치고 화면 끝(벽)에 박혔을 때(onWall).
        //   d = 그림 1~4 각각 시간(ms). 3번(도끼 짚고 무릎 꿇고 헐떡임) 800ms = 때릴 기회. 휘청 중 맞으면 번쩍이기만
        stagger: { at: [0.66, 0.33], onWall: true, d: [280, 140, 800, 280] },
        enrageAt: 0.5,           // 체력이 이 비율 아래로 떨어지면 화남: 빨라지고 고블린 부름
        enrage: { speedMul: 1.2, cooldownMul: 0.65, summon: ['goblin', 'goblin'] },   // 빠르기 1.3 → 1.2(2026-11-06 새 걷기로 기본 34 → 48: 화나도 58 = 플레이어 걷기 115 의 절반 쯤)
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
          idle: [4, 5, true], walk: [12, 8, true],
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
        walkStride: 155,   // 보폭 걷기(enemies.js stepWalk): 걷기 12장 한 바퀴에 가는 그림 점(2026-11-06 새 걷기 그림 artoss-walk). 42도트/초에 4.4fps 쯤
        // 체력·데미지: 자동 조종(?bot=1, 피하지 않음) 시험에서 오크(1단계)보다 한 단계 버겁게 맞춤(2026-11-04)
        hp: 1050, speedX: 42, speedY: 24, radius: 42, height: 150,
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
          idle: [4, 5, true], walk: [12, 8, true],
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
        walkStride: 156,   // 보폭 걷기(enemies.js stepWalk): 걷기 12장 한 바퀴에 가는 그림 점(2026-11-06 새 걷기 그림 artoss-walk). 39도트/초에 4fps 쯤
        // 체력·데미지: 자동 조종(?bot=1, 피하지 않음) 시험에서 4단계 전갈 왕과 6단계 선장 사이가 되게 맞춤(그림 자료 제안 hp 1100 · 내려찍기 19~23 · 휘두르기 14~17 보다 낮춤)
        hp: 1000, speedX: 39, speedY: 22, radius: 44, height: 158,
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
          idle: [4, 5, true], walk: [12, 8, true],
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
        walkStride: 155,   // 돌 골렘과 같은 걷기 그림 12장(2026-11-06) → 보폭 걷기. 빠르기는 그대로 30
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
          idle: [4, 5, true], walk: [12, 8, true],
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
        walkStride: 64,   // 보폭 걷기(enemies.js stepWalk): 걷기 12장 한 바퀴에 가는 그림 점(2026-11-06 새 네 발 걷기 그림 artoss-walk, 손으로 맞춘 값). 38도트/초에 9.6fps 쯤
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
        walkStride: 64,   // 보폭 걷기(enemies.js stepWalk): 걷기 6장(= 한 걸음, 같은 걸음을 되풀이) 한 바퀴에 가는 그림 점(2026-11-06 새 걷기 그림 artoss-walk, walkDy 없앰). 48도트/초에 6fps 쯤
        // 체력·데미지: 자동 조종(?bot=1) 시험에서 9단계 마왕군 장군보다 조금 버겁게 맞춤(그림 자료 제안 hp 1600 보다 낮춤, 판 배율 x1.7)
        hp: 1100, speedX: 48, speedY: 24, radius: 46, height: 178,
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
      },
      // ===== 11~20단계 새 적 v2 (2026-11-09 형님: 「11~20판은 새 몹 · 새 기술 · 새 보스」) =====
      //   그림 = art/stages-11-20/v2 (AI 그림 · cut2.py 로 자름, 수치 = v2/summary.json). 기술 효과 그림 = assets/enemies/fx2 (AI 그림, 위 FX2)
      //   땅마다 잡몹 3종(어제 1 + 새 2) + 중간보스 2(따로 그린 정예) + 보스 2. 예전 적을 물들여 쓰던 것은 전부 뺌
      // 가시나무 정령(11·12): 할퀴기 + 「가시 부채」(가시 셋이 세 줄로 날아옴, 바닥 빨간 줄 예고)
      thorn: {
        label: '가시나무 정령', frameW: 135, frameH: 114, pivot: { x: 60, y: 108 },
        anims: enemyAnims('thorn', { idle: [4, 6, true], walk: [6, 8, true], attack: [5, 10, false, [1, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [5, 10, false, [1, 2, 3, 4, 5, 5]], getup: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 8, false] }),
        fxArt: { thorn: FX2('thorn', 14), burst: FX2('curseburst', 14) },
        walkAnim: 'walk',
        down: { slide: 70, lyingFrames: [4, 5] },
        hp: 85, speedX: 42, speedY: 28, radius: 16, height: 92,
        hurtbox: { x0: -16, x1: 26, yTop: -90, yBot: 0 },
        engage: 55, hover: [100, 170], range: [24, 300], alignY: 8, cooldown: [1300, 2200], firstCooldown: [500, 1500],
        knockResist: 0.95, deathKnock: 210,
        attacks: {
          claw:  { anim: 'attack', active: [3, 4], reach: { x0: 14, x1: 88, yTop: -84, yBot: -20 }, depth: 13, dmg: [8, 11], knock: 15, telegraph: [2], when: [20, 90], weight: 3 },
          spit:  { type: 'shot', anim: 'attack', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 40, y: -60 }, aimH: 60, dropPx: 0, proj: 'thorn', impact: 'burst', impactAir: true, muzzle: null,
                   volley: { count: 3, lanes: [0, -18, 18], gapMs: 90 }, hitCols: ["#1a0a24", "#5a2a8a", "#b07aff", "#f0d8ff"], impactCols: ["#1a0a24", "#5a2a8a", "#b07aff", "#f0d8ff"],
                   speed: 230, range: 300, box: { w: 20, h: 10 }, depth: 9, dodgeZ: 22, dmg: [5, 7], knock: 10, flinchMs: 260, when: [110, 300], weight: 2, gapMs: 4500, maxShooters: 2 }
        }
      },
      // 뿌리 괴물(11·12): 물어뜯기 + 「뿌리 덫」(발밑에서 가시 뿌리가 줄지어 솟음 — 금 간 땅 그림이 예고)
      root: {
        label: '뿌리 괴물', frameW: 187, frameH: 116, pivot: { x: 68, y: 110 },
        anims: enemyAnims('root', { idle: [4, 6, true], walk: [6, 8, true], attack: [5, 10, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 10, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [5, 10, false, [1, 2, 3, 4, 5, 5]], getup: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 8, false] }),
        fxArt: { root: FX2('rootspike', 13) },
        walkAnim: 'walk',
        down: { slide: 70, lyingFrames: [4, 5] },
        hp: 60, speedX: 46, speedY: 30, radius: 20, height: 56,
        hurtbox: { x0: -28, x1: 28, yTop: -56, yBot: 0 },
        engage: 60, hover: [90, 160], range: [24, 260], alignY: 8, cooldown: [1400, 2400], firstCooldown: [600, 1500],
        knockResist: 1.0, deathKnock: 220,
        attacks: {
          bite:  { anim: 'attack', active: [3, 4], reach: { x0: 10, x1: 70, yTop: -50, yBot: -4 }, depth: 12, dmg: [6, 8], knock: 12, telegraph: [2], move: { frames: [3, 4], dist: 30 }, when: [20, 80], weight: 2 },
          roots: { type: 'spikes', anim: 'skill', telegraph: [1, 2], spawnFrame: 3, fx: 'root', aimMs: 350, count: 4, first: 50, step: 42, delayMs: 110, maxRange: 230,
                   spikeActive: [2, 3, 4], reach: { x0: -18, x1: 18, yTop: -64, yBot: 0 }, depth: 12, dodgeZ: 26, dmg: [6, 8], knock: 14, flinchMs: 360, when: [70, 260], weight: 2, gapMs: 6500, firstMs: 2000 }
        }
      },
      // 독버섯 괴물(11·12): 머리 박치기 + 「독 포자」(포물선으로 뱉음 → 떨어진 자리 독 웅덩이, 빨간 원 예고)
      shroom: {
        label: '독버섯 괴물', frameW: 118, frameH: 84, pivot: { x: 57, y: 78 },
        anims: enemyAnims('shroom', { idle: [4, 6, true], walk: [5, 8, true], attack: [5, 10, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 10, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [5, 10, false, [1, 2, 3, 4, 5, 5]], getup: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 8, false] }),
        fxArt: { spore: FX2('spore', 10), puddle: FX2('puddle', 10) },
        walkAnim: 'walk',
        down: { slide: 70, lyingFrames: [4, 5] },
        hp: 55, speedX: 40, speedY: 26, radius: 16, height: 70,
        hurtbox: { x0: -13, x1: 20, yTop: -70, yBot: 0 },
        engage: 55, hover: [120, 200], range: [20, 320], alignY: 8, cooldown: [2600, 3800], firstCooldown: [700, 1600],
        knockResist: 1.1, deathKnock: 220,
        ranged: { attack: 'spore', keep: [140, 230], tooClose: 70, backOffMul: 0.7, maxShooters: 2, alignMs: 600 },
        attacks: {
          bash:  { anim: 'attack', active: [3, 4], reach: { x0: 10, x1: 62, yTop: -66, yBot: -10 }, depth: 12, dmg: [6, 8], knock: 14, telegraph: [2], when: [10, 70], weight: 3 },
          spore: { type: 'throw', anim: 'skill', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 36, y: -56 }, flightMs: 750, arcPeak: 60, maxRange: 300, radius: 30, depth: 10, dodgeZ: 22,
                   proj: 'spore', burstArt: null, burstCols: ["#2a3a10", "#6a8a2a", "#c8e83a", "#f0ffb0"],
                   puddle: { ms: 3800, radius: 30, depth: 10, everyMs: 500, firstMs: 300, stayMs: 600, dmg: 2 },
                   dmg: [5, 7], knock: 10, flinchMs: 260, when: [90, 320], weight: 3, gapMs: 4000, maxShooters: 3 }
        }
      },
      // 11판 중간보스 가시나무 장로: 두 번 할퀴기 · 뿌리 덫 6줄 · 가시 부채 5발
      thornelder: {
        label: '가시나무 장로', frameW: 206, frameH: 168, pivot: { x: 94, y: 162 },
        anims: enemyAnims('thornelder', { idle: [4, 6, true], walk: [6, 8, true], attack: [5, 9, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 9, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [2, 8, false, [1, 2, 2, 2]], getup: [2, 8, false, [1, 2, 2]], death: [5, 7, false, [1, 1, 2, 2, 3, 4, 5]] }),
        fxArt: { thorn: FX2('thorn', 13), root: FX2('rootspike', 13), burst: FX2('curseburst', 13) },
        walkAnim: 'walk',
        down: { slide: 60, lyingFrames: [2] },
        hp: 600, speedX: 34, speedY: 22, radius: 30, height: 150,
        hurtbox: { x0: -27, x1: 42, yTop: -150, yBot: 0 },
        engage: 70, hover: [90, 150], range: [24, 340], alignY: 10, cooldown: [1100, 1900], firstCooldown: [900, 1400],
        knockResist: 0.6, deathKnock: 80,
        attacks: {
          claws: { anim: 'attack', active: [3, 4], multiHit: true, reach: { x0: 16, x1: 120, yTop: -140, yBot: -10 }, depth: 15, dmg: [10, 13], knock: 20, telegraph: [2], when: [20, 120], weight: 3 },
          roots: { type: 'spikes', anim: 'skill', telegraph: [1, 2], spawnFrame: 3, fx: 'root', aimMs: 400, count: 6, first: 50, step: 44, delayMs: 90, maxRange: 320,
                   spikeActive: [2, 3, 4], reach: { x0: -20, x1: 20, yTop: -70, yBot: 0 }, depth: 14, dodgeZ: 28, dmg: [9, 12], knock: 16, flinchMs: 400, when: [80, 340], weight: 2, gapMs: 4500 },
          fan:   { type: 'shot', anim: 'attack', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 60, y: -90 }, aimH: 90, dropPx: 0, proj: 'thorn', impact: 'burst', impactAir: true, muzzle: null,
                   volley: { count: 5, lanes: [0, -16, 16, -32, 32], gapMs: 70 }, hitCols: ["#1a0a24", "#5a2a8a", "#b07aff", "#f0d8ff"], impactCols: ["#1a0a24", "#5a2a8a", "#b07aff", "#f0d8ff"],
                   speed: 250, range: 340, box: { w: 20, h: 10 }, depth: 9, dodgeZ: 22, dmg: [7, 9], knock: 12, flinchMs: 300, when: [140, 340], weight: 2, gapMs: 5000 }
        }
      },
      // 12판 중간보스 독버섯 왕: 배치기 · 뛰어올라 깔아뭉개기 · 큰 독 포자(웅덩이)
      shroomking: {
        label: '독버섯 왕', frameW: 189, frameH: 170, pivot: { x: 89, y: 164 },
        anims: enemyAnims('shroomking', { idle: [4, 6, true], walk: [6, 8, true], attack: [5, 9, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 9, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [2, 8, false, [1, 2, 2, 2]], getup: [2, 8, false, [1, 2, 2]], death: [5, 7, false, [1, 1, 2, 2, 3, 4, 5]] }),
        fxArt: { spore: FX2('spore', 10), puddle: FX2('puddle', 10) },
        walkAnim: 'walk',
        down: { slide: 60, lyingFrames: [2] },
        hp: 600, speedX: 32, speedY: 22, radius: 30, height: 136,
        hurtbox: { x0: -41, x1: 48, yTop: -136, yBot: 0 },
        engage: 70, hover: [90, 150], range: [20, 340], alignY: 10, cooldown: [1200, 2000], firstCooldown: [900, 1400],
        knockResist: 0.6, deathKnock: 80,
        attacks: {
          slam:  { anim: 'attack', active: [3, 4], reach: { x0: 10, x1: 104, yTop: -120, yBot: 0 }, depth: 16, dmg: [11, 14], knock: 24, telegraph: [2], when: [10, 110], weight: 3 },
          jump:  { type: 'leap', anim: 'skill', active: [4], reach: { x0: -70, x1: 110, yTop: -60, yBot: 0 }, depth: 18, telegraph: [1], leap: { frames: [2, 3], max: 220, aimAt: 30 },
                   dmg: [12, 15], knock: 30, flinchMs: 420, shake: 2.4, when: [60, 280], weight: 2, heavy: true, gapMs: 4000 },
          spores: { type: 'throw', anim: 'attack', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 50, y: -110 }, flightMs: 800, arcPeak: 80, maxRange: 340, radius: 38, depth: 12, dodgeZ: 22,
                   proj: 'spore', burstArt: null, burstCols: ["#2a3a10", "#6a8a2a", "#c8e83a", "#f0ffb0"], puddle: { ms: 4500, radius: 38, depth: 12, everyMs: 450, firstMs: 250, stayMs: 700, dmg: 3 },
                   dmg: [7, 9], knock: 12, flinchMs: 300, when: [120, 340], weight: 2, gapMs: 3500 }
        }
      },
      // 11판 보스 저주받은 고목왕: 가지 두 번 쓸기 · 뿌리 덫 8줄 · 가시 비(하늘에서 가시창, 빨간 원) · 몸통 돌진 / 분노: 졸개(뿌리 괴물 · 독버섯 · 가시 정령) + 가시 비 10발
      treantking: {
        label: '저주받은 고목왕', frameW: 336, frameH: 247, pivot: { x: 154, y: 241 },
        boss: true,
        anims: Object.assign(enemyAnims('treantking', { idle: [4, 5, true], walk: [6, 7, true], attack1: [5, 9, false, [1, 2, 2, 2, 3, 3, 4, 4, 5]], attack2: [5, 9, false, [1, 2, 2, 2, 3, 3, 4, 4, 5]], special: [6, 8, false, [1, 2, 2, 2, 2, 3, 4, 5, 6]], hit: [3, 8, false, [1, 2, 2, 3]], hit2: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 6, false, [1, 1, 2, 3, 4, 5, 5]] })),
        fxArt: { root: FX2('rootspike', 13), fall: FX2('thornfall', 13), blast: FX2('thornhit', 13) },
        walkAnim: 'walk',
        staggerCdMs: 2300,   // 움찔한 뒤 2.3초는 안 끊김(예전 보스와 같음 — 계속 맞아도 공격함)
        hp: 1050, speedX: 30, speedY: 20, radius: 48, height: 230,
        hurtbox: { x0: -46, x1: 58, yTop: -230, yBot: 0 },
        engage: 90, hover: [90, 130], range: [30, 520], alignY: 12, cooldown: [1000, 1800], firstCooldown: [1300, 1700],
        knockResist: 0.15, deathKnock: 30, superArmor: true,
        enrageAt: 0.5, rageColor: '#b04aff',
        enrage: { speedMul: 1.2, cooldownMul: 0.72, summon: ['root', 'shroom', 'thorn'] },
        attacks: {
          sweep:  { anim: 'attack1', active: [3, 4], multiHit: true, telegraph: [2], depth: 18, reach: { x0: 10, x1: 180, yTop: -150, yBot: 0 },
                    dmg: [13, 17], knock: 28, flinchMs: 420, shake: 1.6, when: [20, 175], weight: 2 },
          roots:  { type: 'spikes', anim: 'attack2', telegraph: [1, 2], spawnFrame: 3, fx: 'root', aimMs: 400, count: 8, first: 60, step: 48, delayMs: 80, maxRange: 440,
                    spikeActive: [2, 3, 4], reach: { x0: -22, x1: 22, yTop: -72, yBot: 0 }, depth: 16, dodgeZ: 30, enraged: {},
                    dmg: [13, 16], knock: 18, flinchMs: 420, shake: 1.6, when: [0, 460], weight: 2, gapMs: 5000, firstMs: 2500 },
          rain:   { type: 'barrage', anim: 'special', telegraph: [1, 2], spawnFrame: 3, count: 6, intervalMs: 240, fallMs: 900, dropHeight: 300,
                    proj: 'fall', blast: 'blast', blastCols: ["#1a0a24", "#5a2a8a", "#b07aff", "#f0d8ff"], spread: { x: 70, y: 16 }, radius: 40, depth: 16, dodgeZ: 24, holdMs: 250, gapMs: 8000, firstMs: 4500,
                    enraged: { count: 10, intervalMs: 180 }, dmg: [13, 17], knock: 26, flinchMs: 420, heavy: true, shake: 2.0, when: [0, 600], weight: 2 },
          ram:    { type: 'charge', anim: 'attack1', frames: { wind: [1, 2], run: [3, 4], impact: [4], recover: [5] }, windMs: 750, stepMs: 110, speed: 420, dist: 420, impactMs: 260, recoverMs: 420,
                    bodyReach: { x0: -10, x1: 110, yTop: -200, yBot: 0 }, reach: { x0: 40, x1: 150, yTop: -180, yBot: 0 }, depth: 18,
                    dmg: [15, 19], knock: 40, flinchMs: 500, shake: 2.4, dustMs: 100, when: [90, 480], weight: 2, heavy: true, gapMs: 6000, firstMs: 6000 }
        }
      },
      // 12판 보스 가시덩굴 마녀: 지팡이 휘두르기 · 따라오는 해골불 3발 · 저주 문양(바닥이 보라로 터짐, 빨간 원) · 등 뒤 순간이동 / 분노: 졸개 + 해골불 5발 · 순간이동 자주
      witch: {
        label: '가시덩굴 마녀', frameW: 276, frameH: 206, pivot: { x: 114, y: 200 },
        boss: true,
        anims: Object.assign(enemyAnims('witch', { idle: [4, 5, true], walk: [6, 7, true], attack1: [5, 9, false, [1, 2, 2, 2, 3, 3, 4, 4, 5]], attack2: [5, 9, false, [1, 2, 2, 2, 3, 3, 4, 4, 5]], special: [6, 8, false, [1, 2, 2, 2, 2, 3, 4, 5, 6]], hit: [3, 8, false, [1, 2, 2, 3]], hit2: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 6, false, [1, 1, 2, 3, 4, 5, 5]] }), { vanish: { frames: [EN + 'witch/special_01.png', EN + 'witch/special_02.png'], fps: 7, loop: false, playback: [1, 1, 2, 2] }, appear: { frames: [EN + 'witch/special_05.png', EN + 'witch/special_01.png'], fps: 7, loop: false, playback: [1, 1, 2, 2] } }),
        fxArt: { skull: FX2('skull', 13), blast: FX2('curseburst', 13) },
        walkAnim: 'walk',
        staggerCdMs: 2300,   // 움찔한 뒤 2.3초는 안 끊김(예전 보스와 같음 — 계속 맞아도 공격함)
        hp: 1000, speedX: 34, speedY: 22, radius: 36, height: 190,
        hurtbox: { x0: -34, x1: 42, yTop: -190, yBot: 0 },
        engage: 80, hover: [140, 220], range: [30, 520], alignY: 12, cooldown: [950, 1700], firstCooldown: [1200, 1600],
        knockResist: 0.2, deathKnock: 30, superArmor: true,
        enrageAt: 0.5, rageColor: '#d04aff',
        enrage: { speedMul: 1.2, cooldownMul: 0.7, summon: ['root', 'shroom', 'root'] },
        attacks: {
          swipe:  { anim: 'attack1', active: [3, 4], telegraph: [2], depth: 16, reach: { x0: 10, x1: 140, yTop: -150, yBot: -10 },
                    dmg: [12, 15], knock: 24, flinchMs: 400, shake: 1.2, when: [20, 140], weight: 2 },
          skulls: { type: 'shot', anim: 'attack2', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 70, y: -150 }, aimH: 100, dropPx: 60, proj: 'skull', impact: 'blast', impactAir: true, muzzle: null,
                    volley: { count: 3, lanes: [0, -26, 26], gapMs: 160 }, homing: 50, homeAfterMs: 250, enraged: { count: 5, lanes: [0, -24, 24, -48, 48], gapMs: 120 },
                    hitCols: ["#1a0a24", "#5a2a8a", "#b07aff", "#f0d8ff"], impactCols: ["#1a0a24", "#5a2a8a", "#b07aff", "#f0d8ff"], speed: 190, range: 520, box: { w: 22, h: 18 }, depth: 12, dodgeZ: 24,
                    dmg: [11, 14], knock: 18, flinchMs: 360, when: [40, 520], weight: 3 },
          curse:  { type: 'barrage', anim: 'special', telegraph: [1, 2, 3], spawnFrame: 3, count: 5, intervalMs: 200, fallMs: 1000, dropHeight: 1, noProj: true,
                    blast: 'blast', blastCols: ["#1a0a24", "#5a2a8a", "#b07aff", "#f0d8ff"], spread: { x: 90, y: 22 }, radius: 42, depth: 16, dodgeZ: 24, holdMs: 400, gapMs: 7000, firstMs: 4000,
                    enraged: { count: 8, intervalMs: 160 }, dmg: [13, 16], knock: 24, flinchMs: 420, shake: 1.4, when: [0, 600], weight: 2 },
          blink:  { type: 'teleport', anim: 'vanish', appearAnim: 'appear', telegraph: [1], invuln: [2], hiddenMs: 350, gatherMs: 380, behind: 80, lunge: 0, depth: 16,
                    reach: { x0: 10, x1: 140, yTop: -150, yBot: -10 }, then: 'swipe', thenFrame: 2, smokeCols: ['#140a1e', '#3a1a4a', '#7a3aaa', '#c87aff'],
                    when: [0, 999], weight: 1, gapMs: 9000, firstMs: 6000, enraged: { useGapMs: 5500 } }
        }
      },
      // 수정 갑충(13·14): 뛰어들어 물기 + 「수정 구르기」(몸을 말아 굴러 돌진 — 땅 위 빨간 띠 예고)
      beetle: {
        label: '수정 갑충', frameW: 137, frameH: 80, pivot: { x: 78, y: 74 },
        anims: enemyAnims('beetle', { idle: [4, 6, true], run: [6, 14, true], attack: [5, 10, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 10, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [4, 10, false, [1, 2, 3, 4, 4]], getup: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 8, false] }),
        walkAnim: 'run',
        down: { slide: 70, lyingFrames: [3, 4] },
        hp: 55, speedX: 110, speedY: 60, radius: 26, height: 58,
        hurtbox: { x0: -44, x1: 46, yTop: -58, yBot: 0 },
        engage: 84, hover: [150, 220], range: [55, 360], alignY: 8, cooldown: [1300, 2300], firstCooldown: [300, 1200],
        retreatMs: 900, knockResist: 1.1, deathKnock: 230,
        attacks: {
          bite: { anim: 'attack', active: [2, 3], reach: { x0: 30, x1: 86, yTop: -56, yBot: -6 }, depth: 12, dmg: [6, 8], knock: 12, move: { frames: [2, 3], dist: 36 }, when: [40, 112], weight: 3 },
          roll: { type: 'charge', anim: 'skill', frames: { wind: [1, 2], run: [2, 3, 4, 3], impact: [4], recover: [5] }, windMs: 600, stepMs: 70, speed: 380, dist: 360, impactMs: 160, recoverMs: 300,
                  bodyReach: { x0: -30, x1: 40, yTop: -50, yBot: 0 }, reach: { x0: 0, x1: 50, yTop: -50, yBot: 0 }, depth: 12,
                  dmg: [7, 9], knock: 22, flinchMs: 320, shake: 0.8, dustMs: 90, when: [140, 360], weight: 2, gapMs: 5000, firstMs: 1500 }
        }
      },
      // 13·14 수정 갑충 구르기 그림(skill) = 어제 그림 칸(mob.json)에 맞춰 넣은 v2/old/beetle
      // 수정 파수꾼(13·14): 떠 있는 수정 덩어리. 가시 찌르기 + 「수정 파편」(파편 3발이 세 줄로)
      turret: {
        label: '수정 파수꾼', frameW: 149, frameH: 129, pivot: { x: 56, y: 123 },
        anims: enemyAnims('turret', { idle: [4, 6, true], walk: [6, 8, true], attack: [5, 10, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 10, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [5, 10, false, [1, 2, 3, 4, 5, 5]], getup: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 8, false] }),
        fxArt: { shard: FX2('shard', 14), burst: FX2('shatter', 14) },
        walkAnim: 'walk',
        down: { slide: 70, lyingFrames: [4, 5] },
        hp: 58, speedX: 30, speedY: 22, radius: 18, height: 84,
        hurtbox: { x0: -25, x1: 25, yTop: -98, yBot: -14 },
        engage: 50, hover: [170, 260], range: [0, 380], alignY: 8, cooldown: [2800, 3800], firstCooldown: [900, 1800],
        knockResist: 1.0, deathKnock: 200,
        ranged: { attack: 'shards', keep: [170, 260], tooClose: 80, backOffMul: 0.7, maxShooters: 2, alignMs: 600 },
        attacks: {
          bash:   { anim: 'attack', active: [3, 4], reach: { x0: 10, x1: 90, yTop: -70, yBot: -20 }, depth: 12, dmg: [6, 8], knock: 12, telegraph: [2], when: [0, 80], weight: 3 },
          shards: { type: 'shot', anim: 'skill', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 30, y: -60 }, aimH: 60, dropPx: 0, proj: 'shard', impact: 'burst', impactAir: true, muzzle: null,
                    volley: { count: 3, lanes: [0, -16, 16], gapMs: 120 }, hitCols: ["#0a1a3a", "#3a6ac8", "#8ad8ff", "#e8faff"], impactCols: ["#0a1a3a", "#3a6ac8", "#8ad8ff", "#e8faff"],
                    speed: 260, range: 380, box: { w: 18, h: 10 }, depth: 9, dodgeZ: 22, dmg: [5, 7], knock: 10, flinchMs: 260, when: [100, 380], weight: 3 }
        }
      },
      // 수정 거미(13·14): 독니 + 「덮치기」(높이 뛰어 플레이어 자리로 떨어짐, 빨간 원 예고)
      spider: {
        label: '수정 거미', frameW: 179, frameH: 100, pivot: { x: 95, y: 94 },
        anims: enemyAnims('spider', { idle: [4, 6, true], run: [6, 13, true], attack: [5, 10, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 10, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [5, 10, false, [1, 2, 3, 4, 5, 5]], getup: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 8, false] }),
        walkAnim: 'run',
        down: { slide: 70, lyingFrames: [4, 5] },
        hp: 50, speedX: 100, speedY: 56, radius: 22, height: 54,
        hurtbox: { x0: -32, x1: 32, yTop: -54, yBot: 0 },
        engage: 70, hover: [140, 200], range: [40, 260], alignY: 8, cooldown: [1300, 2200], firstCooldown: [400, 1200],
        retreatMs: 700, knockResist: 1.1, deathKnock: 220,
        attacks: {
          bite:   { anim: 'attack', active: [3, 4], reach: { x0: 20, x1: 76, yTop: -60, yBot: -4 }, depth: 12, dmg: [6, 8], knock: 12, telegraph: [2], when: [30, 90], weight: 2 },
          pounce: { type: 'leap', anim: 'skill', active: [4], reach: { x0: -30, x1: 60, yTop: -50, yBot: 0 }, depth: 14, telegraph: [1, 2], leap: { frames: [3], max: 200, aimAt: 20 },
                    dmg: [7, 9], knock: 18, flinchMs: 320, shake: 1.0, when: [80, 260], weight: 2, gapMs: 4000, firstMs: 1200 }
        }
      },
      // 13판 중간보스 수정 장수풍뎅이: 뿔 들이받기 · 뿔 돌진 · 수정 가시 줄
      rhinobeetle: {
        label: '수정 장수풍뎅이', frameW: 214, frameH: 126, pivot: { x: 85, y: 120 },
        anims: enemyAnims('rhinobeetle', { idle: [4, 6, true], walk: [6, 8, true], attack: [5, 9, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 9, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [2, 8, false, [1, 2, 2, 2]], getup: [2, 8, false, [1, 2, 2]], death: [5, 7, false, [1, 1, 2, 2, 3, 4, 5]] }),
        fxArt: { spike: FX2('cspike', 13) },
        walkAnim: 'walk',
        down: { slide: 60, lyingFrames: [2] },
        hp: 620, speedX: 40, speedY: 24, radius: 40, height: 104,
        hurtbox: { x0: -62, x1: 73, yTop: -104, yBot: 0 },
        engage: 80, hover: [110, 170], range: [30, 420], alignY: 10, cooldown: [1100, 1900], firstCooldown: [900, 1400],
        knockResist: 0.5, deathKnock: 60,
        attacks: {
          toss:   { anim: 'attack', active: [3], reach: { x0: 20, x1: 110, yTop: -100, yBot: 0 }, depth: 16, dmg: [11, 14], knock: 30, telegraph: [2], when: [20, 110], weight: 3 },
          charge: { type: 'charge', anim: 'skill', frames: { wind: [1, 2], run: [3, 4], impact: [5], recover: [5] }, windMs: 700, stepMs: 90, speed: 460, dist: 440, impactMs: 220, recoverMs: 380,
                    bodyReach: { x0: -20, x1: 90, yTop: -100, yBot: 0 }, reach: { x0: 30, x1: 120, yTop: -100, yBot: 0 }, depth: 16,
                    dmg: [12, 15], knock: 36, flinchMs: 450, shake: 2.0, dustMs: 90, when: [150, 440], weight: 2, heavy: true, gapMs: 4500 },
          spikes: { type: 'spikes', anim: 'attack', telegraph: [1, 2], spawnFrame: 3, fx: 'spike', aimMs: 350, count: 6, first: 60, step: 46, delayMs: 80, maxRange: 340,
                    spikeActive: [2, 3, 4], reach: { x0: -20, x1: 20, yTop: -72, yBot: 0 }, depth: 14, dodgeZ: 28, dmg: [10, 13], knock: 16, flinchMs: 400, when: [90, 340], weight: 2, gapMs: 5000 }
        }
      },
      // 14판 중간보스 수정 거미 여왕: 독니 · 수정 파편 5발 · 덮치기
      spiderqueen: {
        label: '수정 거미 여왕', frameW: 224, frameH: 120, pivot: { x: 95, y: 114 },
        anims: enemyAnims('spiderqueen', { idle: [4, 6, true], walk: [6, 8, true], attack: [5, 9, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 9, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [2, 8, false, [1, 2, 2, 2]], getup: [2, 8, false, [1, 2, 2]], death: [5, 7, false, [1, 1, 2, 2, 3, 4, 5]] }),
        fxArt: { shard: FX2('shard', 14), hit: FX2('shatter', 14) },
        walkAnim: 'walk',
        down: { slide: 60, lyingFrames: [2] },
        hp: 620, speedX: 44, speedY: 26, radius: 40, height: 100,
        hurtbox: { x0: -60, x1: 70, yTop: -100, yBot: 0 },
        engage: 80, hover: [130, 200], range: [30, 400], alignY: 10, cooldown: [1100, 1900], firstCooldown: [900, 1400],
        knockResist: 0.5, deathKnock: 60,
        attacks: {
          fang:   { anim: 'attack', active: [3, 4], reach: { x0: 20, x1: 110, yTop: -96, yBot: 0 }, depth: 16, dmg: [11, 14], knock: 22, telegraph: [2], when: [20, 110], weight: 3 },
          burst:  { type: 'shot', anim: 'skill', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 30, y: -60 }, aimH: 60, dropPx: 0, proj: 'shard', impact: 'hit', impactAir: true, muzzle: null,
                    volley: { count: 5, lanes: [0, -16, 16, -32, 32], gapMs: 60 }, hitCols: ["#0a1a3a", "#3a6ac8", "#8ad8ff", "#e8faff"], impactCols: ["#0a1a3a", "#3a6ac8", "#8ad8ff", "#e8faff"],
                    speed: 270, range: 400, box: { w: 18, h: 10 }, depth: 9, dodgeZ: 22, dmg: [8, 10], knock: 12, flinchMs: 300, when: [120, 400], weight: 2, gapMs: 3500 },
          pounce: { type: 'leap', anim: 'attack', active: [4], reach: { x0: -50, x1: 100, yTop: -60, yBot: 0 }, depth: 18, telegraph: [1], leap: { frames: [2, 3], max: 240, aimAt: 30 },
                    dmg: [12, 15], knock: 28, flinchMs: 420, shake: 2.2, when: [90, 300], weight: 2, heavy: true, gapMs: 5000 }
        }
      },
      // 13판 보스 수정 지네왕: 큰턱 물기 · 수정 파편 5발(분노 7발) · 머리 내려찍기 = 수정 가시 9줄 · 몸통 돌진 / 분노: 졸개(갑충 · 거미 · 파수꾼)
      centipede: {
        label: '수정 지네왕', frameW: 332, frameH: 202, pivot: { x: 166, y: 196 },
        boss: true,
        anims: Object.assign(enemyAnims('centipede', { idle: [4, 5, true], walk: [6, 7, true], attack1: [5, 9, false, [1, 2, 2, 2, 3, 3, 4, 4, 5]], attack2: [5, 9, false, [1, 2, 2, 2, 3, 3, 4, 4, 5]], special: [5, 8, false, [1, 2, 2, 2, 2, 3, 4, 5]], hit: [3, 8, false, [1, 2, 2, 3]], hit2: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 6, false, [1, 1, 2, 3, 4, 5, 5]] })),
        fxArt: { shard: FX2('shard', 13), spike: FX2('cspike', 13), hit: FX2('shatter', 13) },
        walkAnim: 'walk',
        staggerCdMs: 2300,   // 움찔한 뒤 2.3초는 안 끊김(예전 보스와 같음 — 계속 맞아도 공격함)
        hp: 1100, speedX: 40, speedY: 24, radius: 50, height: 190,
        hurtbox: { x0: -57, x1: 57, yTop: -190, yBot: 0 },
        engage: 90, hover: [100, 150], range: [30, 520], alignY: 12, cooldown: [950, 1700], firstCooldown: [1200, 1600],
        knockResist: 0.15, deathKnock: 30, superArmor: true,
        enrageAt: 0.5, rageColor: '#6ad8ff',
        enrage: { speedMul: 1.25, cooldownMul: 0.7, summon: ['beetle', 'spider', 'turret'] },
        attacks: {
          bite:   { anim: 'attack1', active: [3, 4], telegraph: [2], depth: 18, reach: { x0: 10, x1: 160, yTop: -170, yBot: 0 },
                    dmg: [13, 17], knock: 28, flinchMs: 420, shake: 1.6, when: [20, 160], weight: 2 },
          spit:   { type: 'shot', anim: 'attack2', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 90, y: -150 }, aimH: 70, dropPx: 80, proj: 'shard', impact: 'hit', impactAir: true, muzzle: null,
                    volley: { count: 5, lanes: [0, -20, 20, -40, 40], gapMs: 70 }, enraged: { count: 7, lanes: [0, -18, 18, -36, 36, -54, 54], gapMs: 60 },
                    hitCols: ["#0a1a3a", "#3a6ac8", "#8ad8ff", "#e8faff"], impactCols: ["#0a1a3a", "#3a6ac8", "#8ad8ff", "#e8faff"], speed: 280, range: 520, box: { w: 18, h: 10 }, depth: 9, dodgeZ: 22,
                    dmg: [11, 14], knock: 16, flinchMs: 340, when: [40, 520], weight: 2 },
          slam:   { type: 'spikes', anim: 'special', telegraph: [1, 2], spawnFrame: 3, fx: 'spike', aimMs: 400, count: 9, first: 60, step: 48, delayMs: 70, maxRange: 500,
                    spikeActive: [2, 3, 4], reach: { x0: -22, x1: 22, yTop: -76, yBot: 0 }, depth: 16, dodgeZ: 30,
                    dmg: [14, 17], knock: 18, flinchMs: 420, shake: 2.0, when: [0, 520], weight: 2, gapMs: 5000, firstMs: 2500 },
          lunge:  { type: 'charge', anim: 'attack1', frames: { wind: [1, 2], run: [3, 4], impact: [4], recover: [5] }, windMs: 700, stepMs: 90, speed: 480, dist: 460, impactMs: 240, recoverMs: 400,
                    bodyReach: { x0: -10, x1: 140, yTop: -170, yBot: 0 }, reach: { x0: 40, x1: 170, yTop: -170, yBot: 0 }, depth: 18,
                    dmg: [15, 19], knock: 40, flinchMs: 500, shake: 2.4, dustMs: 80, when: [90, 500], weight: 2, heavy: true, gapMs: 6000, firstMs: 5000 }
        }
      },
      // 14판 보스 수정 거신: 두 주먹 내려찍기 · 수정 덩어리 던지기 · 땅울림 수정 고리(뛰어넘기) · 종유석 비 / 분노: 졸개 + 고리 3겹 · 종유석 10개
      colossus: {
        label: '수정 거신', frameW: 322, frameH: 255, pivot: { x: 132, y: 249 },
        boss: true,
        anims: Object.assign(enemyAnims('colossus', { idle: [4, 5, true], walk: [6, 7, true], attack1: [5, 9, false, [1, 2, 2, 2, 3, 3, 4, 4, 5]], attack2: [5, 9, false, [1, 2, 2, 2, 3, 3, 4, 4, 5]], special: [6, 8, false, [1, 2, 2, 2, 2, 3, 4, 5, 6]], hit: [3, 8, false, [1, 2, 2, 3]], hit2: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 6, false, [1, 1, 2, 3, 4, 5, 5]] })),
        fxArt: { rock: FX2('boulder', 12), ring: FX2('cring', 12), fall: FX2('stalac', 12), hit: FX2('shatter', 12) },
        walkAnim: 'walk',
        staggerCdMs: 2300,   // 움찔한 뒤 2.3초는 안 끊김(예전 보스와 같음 — 계속 맞아도 공격함)
        hp: 1200, speedX: 28, speedY: 20, radius: 52, height: 230,
        hurtbox: { x0: -51, x1: 55, yTop: -230, yBot: 0 },
        engage: 90, hover: [90, 130], range: [30, 560], alignY: 12, cooldown: [1050, 1850], firstCooldown: [1300, 1700],
        knockResist: 0.1, deathKnock: 20, superArmor: true,
        enrageAt: 0.5, rageColor: '#8ad8ff',
        enrage: { speedMul: 1.2, cooldownMul: 0.7, summon: ['turret', 'beetle', 'turret'] },
        attacks: {
          slam:   { anim: 'attack1', active: [3, 4], telegraph: [2], depth: 20, reach: { x0: 20, x1: 170, yTop: -160, yBot: 0 }, burst: { x: 120, scale: 1, fx: 'hit', cols: ["#0a1a3a", "#3a6ac8", "#8ad8ff", "#e8faff"] },
                    dmg: [15, 19], knock: 32, flinchMs: 480, shake: 2.6, heavy: true, when: [20, 170], weight: 2 },
          hurl:   { type: 'throw', anim: 'attack2', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 100, y: -190 }, flightMs: 700, arcPeak: 80, maxRange: 420, radius: 46, depth: 18, dodgeZ: 24,
                    proj: 'rock', burstArt: 'hit', dmg: [15, 19], knock: 30, flinchMs: 460, shake: 2.4, when: [60, 440], weight: 2, heavy: true },
          quake:  { type: 'shockwave', anim: 'special', telegraph: [1, 2], spawnFrame: 3, holdFrame: 4, fx: 'ring', ringArt: true, spawn: { x: 10, y: 0 },
                    rings: { count: 2, gapMs: 700, r0: 24, rMax: 300, speed: 270, band: 16, ryMax: 26, ringRx: 80, flameScale: 0.9, dodgeZ: 22 }, enraged: { count: 3 },
                    dmg: [13, 16], knock: 30, flinchMs: 450, heavy: true, shake: 2.4, when: [0, 320], weight: 2, gapMs: 6000, firstMs: 4000 },
          stalac: { type: 'barrage', anim: 'special', telegraph: [1, 2], spawnFrame: 3, count: 6, intervalMs: 230, fallMs: 900, dropHeight: 300,
                    proj: 'fall', blast: 'hit', blastCols: ["#0a1a3a", "#3a6ac8", "#8ad8ff", "#e8faff"], spread: { x: 80, y: 18 }, radius: 40, depth: 16, dodgeZ: 24, holdMs: 250, gapMs: 8000, firstMs: 6000,
                    enraged: { count: 10, intervalMs: 170 }, dmg: [13, 17], knock: 26, flinchMs: 420, heavy: true, shake: 2.0, when: [0, 600], weight: 2 }
        }
      },
      // 심해 어인(15·16): 찌르기 + 「작살 던지기」(삼지창을 던짐, 바닥 줄 예고)
      fishman: {
        label: '심해 어인', frameW: 258, frameH: 112, pivot: { x: 109, y: 106 },
        anims: enemyAnims('fishman', { idle: [4, 6, true], walk: [6, 9, true], attack: [5, 10, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 10, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [5, 10, false, [1, 2, 3, 4, 5, 5]], getup: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 8, false] }),
        fxArt: { harpoon: FX2('harpoon', 14), splash: FX2('splash', 14) },
        walkAnim: 'walk',
        down: { slide: 70, lyingFrames: [4, 5] },
        hp: 80, speedX: 48, speedY: 30, radius: 15, height: 96,
        hurtbox: { x0: -14, x1: 26, yTop: -94, yBot: 0 },
        engage: 80, hover: [110, 180], range: [30, 330], alignY: 8, cooldown: [1300, 2300], firstCooldown: [600, 1600],
        knockResist: 1.0, deathKnock: 210,
        attacks: {
          thrust:  { anim: 'attack', active: [3, 4], reach: { x0: 20, x1: 120, yTop: -78, yBot: -40 }, depth: 12, dmg: [7, 10], knock: 16, telegraph: [2], showTelegraph: true, when: [30, 114], weight: 3 },
          harpoon: { type: 'shot', anim: 'skill', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 50, y: -70 }, aimH: 60, dropPx: 0, proj: 'harpoon', impact: 'splash', muzzle: null,
                     hitCols: ["#06303a", "#1a8a9a", "#6ae8f0", "#e8ffff"], impactCols: ["#06303a", "#1a8a9a", "#6ae8f0", "#e8ffff"], speed: 300, range: 330, box: { w: 30, h: 10 }, depth: 9, dodgeZ: 22,
                     dmg: [7, 9], knock: 18, flinchMs: 320, when: [120, 330], weight: 2, gapMs: 4500, maxShooters: 2 }
        }
      },
      // 전기 해파리(15·16): 촉수 채찍 + 「전기 파동」(몸에서 번개 고리가 퍼짐 — 뛰어넘으면 피함)
      jelly: {
        label: '전기 해파리', frameW: 173, frameH: 148, pivot: { x: 104, y: 142 },
        anims: enemyAnims('jelly', { idle: [4, 6, true], fly: [6, 8, true], attack: [5, 10, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 10, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [5, 10, false, [1, 2, 3, 4, 5, 5]], getup: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 8, false] }),
        fxArt: { ring: FX2('ering', 12) },
        walkAnim: 'fly',
        down: { slide: 70, lyingFrames: [4, 5] },
        hp: 48, speedX: 50, speedY: 34, radius: 18, height: 80,
        hurtbox: { x0: -24, x1: 24, yTop: -120, yBot: -40 },
        engage: 60, hover: [90, 160], range: [0, 200], alignY: 12, cooldown: [1800, 2800], firstCooldown: [800, 1600],
        knockResist: 1.2, deathKnock: 200,
        flying: { bob: 3, bobMs: 1100, jumpDmgMul: 1.0 },
        attacks: {
          lash:  { anim: 'attack', active: [3, 4], reach: { x0: 0, x1: 70, yTop: -100, yBot: -20 }, depth: 12, dmg: [5, 7], knock: 12, telegraph: [2], when: [0, 70], weight: 2 },
          pulse: { type: 'shockwave', anim: 'skill', telegraph: [1, 2], spawnFrame: 3, holdFrame: 4, fx: 'ring', ringArt: true, spawn: { x: 0, y: 0 },
                   rings: { count: 1, gapMs: 400, r0: 10, rMax: 120, speed: 180, band: 14, ryMax: 20, ringRx: 80, flameScale: 0.6, dodgeZ: 20 },
                   dmg: [6, 8], knock: 20, flinchMs: 360, shake: 0.6, when: [0, 140], weight: 2, gapMs: 6500, firstMs: 2000 }
        }
      },
      // 게 기사(15·16): 집게 내려찍기 + 「물기둥」(땅을 치면 물기둥이 줄지어 솟음)
      crab: {
        label: '게 기사', frameW: 171, frameH: 106, pivot: { x: 67, y: 100 },
        anims: enemyAnims('crab', { idle: [4, 6, true], walk: [6, 8, true], attack: [5, 10, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 10, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [5, 10, false, [1, 2, 3, 4, 5, 5]], getup: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 8, false] }),
        fxArt: { geyser: FX2('geyser', 13) },
        walkAnim: 'walk',
        down: { slide: 70, lyingFrames: [4, 5] },
        hp: 90, speedX: 36, speedY: 22, radius: 22, height: 78,
        hurtbox: { x0: -31, x1: 35, yTop: -78, yBot: 0 },
        engage: 66, hover: [100, 160], range: [20, 280], alignY: 8, cooldown: [1500, 2400], firstCooldown: [700, 1500],
        knockResist: 0.8, deathKnock: 190,
        attacks: {
          smash:  { anim: 'attack', active: [3, 4], reach: { x0: 20, x1: 96, yTop: -76, yBot: -10 }, depth: 13, dmg: [8, 11], knock: 18, telegraph: [2], showTelegraph: true, when: [20, 96], weight: 3 },
          geyser: { type: 'spikes', anim: 'skill', telegraph: [1, 2], spawnFrame: 3, fx: 'geyser', aimMs: 350, count: 3, first: 60, step: 56, delayMs: 140, maxRange: 240,
                    spikeActive: [2, 3, 4], reach: { x0: -22, x1: 22, yTop: -80, yBot: 0 }, depth: 13, dodgeZ: 26, dmg: [7, 9], knock: 20, flinchMs: 380, when: [80, 280], weight: 2, gapMs: 5000, firstMs: 1500 }
        }
      },
      // 15판 중간보스 어인 장군: 삼지창 쓸기 · 물줄기 뿜기 · 물기둥 줄
      fishlord: {
        label: '어인 장군', frameW: 239, frameH: 170, pivot: { x: 107, y: 164 },
        anims: enemyAnims('fishlord', { idle: [4, 6, true], walk: [6, 8, true], attack: [5, 9, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 9, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [2, 8, false, [1, 2, 2, 2]], getup: [2, 8, false, [1, 2, 2]], death: [5, 7, false, [1, 1, 2, 2, 3, 4, 5]] }),
        fxArt: { jet: FX2('jet', 13), geyser: FX2('geyser', 13) },
        walkAnim: 'walk',
        down: { slide: 60, lyingFrames: [2] },
        hp: 640, speedX: 36, speedY: 22, radius: 30, height: 150,
        hurtbox: { x0: -27, x1: 42, yTop: -150, yBot: 0 },
        engage: 80, hover: [100, 160], range: [30, 400], alignY: 10, cooldown: [1100, 1900], firstCooldown: [900, 1400],
        knockResist: 0.55, deathKnock: 70,
        attacks: {
          sweep:  { anim: 'attack', active: [3, 4], multiHit: true, reach: { x0: 20, x1: 150, yTop: -120, yBot: -20 }, depth: 16, dmg: [11, 14], knock: 22, telegraph: [2], when: [20, 150], weight: 3 },
          jet:    { type: 'breath', anim: 'skill', telegraph: [1, 2], active: [3, 4], depth: 14, reach: { x0: 50, x1: 280, yTop: -130, yBot: -90 }, tickMs: 180,
                    dmg: [5, 7], burn: [1, 2], knock: 14, flinchMs: 240, shake: 0.6, when: [70, 300], weight: 2, gapMs: 4000,
                    fx: { art: 'jet', attach: { x: 60, y: -112 }, segW: 58, segments: 4, growMs: 200 } },
          geyser: { type: 'spikes', anim: 'attack', telegraph: [1, 2], spawnFrame: 3, fx: 'geyser', aimMs: 350, count: 5, first: 60, step: 54, delayMs: 110, maxRange: 340,
                    spikeActive: [2, 3, 4], reach: { x0: -22, x1: 22, yTop: -80, yBot: 0 }, depth: 14, dodgeZ: 26, dmg: [10, 12], knock: 20, flinchMs: 400, when: [90, 340], weight: 2, gapMs: 5000 }
        }
      },
      // 16판 중간보스 해파리 여왕: 촉수 폭풍 · 번개 고리 2겹 · 낙뢰(빨간 원)
      jellyqueen: {
        label: '해파리 여왕', frameW: 222, frameH: 258, pivot: { x: 111, y: 252 },
        anims: enemyAnims('jellyqueen', { idle: [4, 6, true], fly: [7, 8, true], attack: [5, 9, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 9, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [2, 8, false, [1, 2, 2, 2]], getup: [2, 8, false, [1, 2, 2]], death: [5, 7, false, [1, 1, 2, 2, 3, 4, 5]] }),
        fxArt: { ring: FX2('ering', 13), bolt: FX2('bolt', 13) },
        walkAnim: 'fly',
        down: { slide: 60, lyingFrames: [2] },
        hp: 600, speedX: 40, speedY: 28, radius: 30, height: 130,
        hurtbox: { x0: -39, x1: 39, yTop: -170, yBot: -40 },
        engage: 70, hover: [90, 160], range: [0, 500], alignY: 14, cooldown: [1200, 2000], firstCooldown: [900, 1400],
        knockResist: 0.6, deathKnock: 60,
        flying: { bob: 3, bobMs: 1200, jumpDmgMul: 1.0 },
        attacks: {
          storm:  { anim: 'attack', active: [3, 4], multiHit: true, reach: { x0: 0, x1: 120, yTop: -150, yBot: -30 }, depth: 16, dmg: [10, 13], knock: 20, telegraph: [2], when: [0, 120], weight: 3 },
          pulse:  { type: 'shockwave', anim: 'skill', telegraph: [1, 2], spawnFrame: 3, holdFrame: 4, fx: 'ring', ringArt: true, spawn: { x: 0, y: 0 },
                    rings: { count: 2, gapMs: 600, r0: 16, rMax: 220, speed: 200, band: 14, ryMax: 22, ringRx: 80, flameScale: 0.7, dodgeZ: 20 },
                    dmg: [10, 12], knock: 26, flinchMs: 400, shake: 1.0, when: [0, 240], weight: 2, gapMs: 4500 },
          bolts:  { type: 'barrage', anim: 'skill', telegraph: [1, 2], spawnFrame: 3, count: 4, intervalMs: 260, fallMs: 800, dropHeight: 1, noProj: true,
                    blast: 'bolt', blastCols: ["#2a2a0a", "#c8a82a", "#fff08a", "#ffffff"], spread: { x: 70, y: 18 }, radius: 34, depth: 14, dodgeZ: 24, holdMs: 200, gapMs: 6000, firstMs: 3000,
                    dmg: [10, 12], knock: 22, flinchMs: 400, shake: 1.4, when: [80, 500], weight: 2 }
        }
      },
      // 15판 보스 심해 마녀: 촉수 쓸기 · 따라오는 먹물 구슬 3발 · 땅속 촉수 7줄 · 물기둥 비(빨간 원) / 분노: 졸개(어인 · 해파리 · 게) + 먹물 5발
      seawitch: {
        label: '심해 마녀', frameW: 264, frameH: 205, pivot: { x: 106, y: 199 },
        boss: true,
        anims: Object.assign(enemyAnims('seawitch', { idle: [4, 5, true], walk: [6, 7, true], attack1: [5, 9, false, [1, 2, 2, 2, 3, 3, 4, 4, 5]], attack2: [5, 9, false, [1, 2, 2, 2, 3, 3, 4, 4, 5]], special: [6, 8, false, [1, 2, 2, 2, 2, 3, 4, 5, 6]], hit: [3, 8, false, [1, 2, 2, 3]], hit2: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 6, false, [1, 1, 2, 3, 4, 5, 5]] })),
        fxArt: { ink: FX2('ink', 13), splash: FX2('splash', 13), tent: FX2('tentacle', 13), geyser: FX2('geyser', 13) },
        walkAnim: 'walk',
        staggerCdMs: 2300,   // 움찔한 뒤 2.3초는 안 끊김(예전 보스와 같음 — 계속 맞아도 공격함)
        hp: 1150, speedX: 32, speedY: 22, radius: 44, height: 190,
        hurtbox: { x0: -49, x1: 57, yTop: -190, yBot: 0 },
        engage: 85, hover: [140, 220], range: [30, 520], alignY: 12, cooldown: [950, 1700], firstCooldown: [1200, 1600],
        knockResist: 0.2, deathKnock: 30, superArmor: true,
        enrageAt: 0.5, rageColor: '#3ae8d8',
        enrage: { speedMul: 1.2, cooldownMul: 0.7, summon: ['fishman', 'jelly', 'crab'] },
        attacks: {
          sweep:  { anim: 'attack1', active: [3, 4], multiHit: true, telegraph: [2], depth: 18, reach: { x0: 0, x1: 170, yTop: -110, yBot: 0 },
                    dmg: [13, 17], knock: 26, flinchMs: 420, shake: 1.4, when: [10, 170], weight: 2 },
          ink:    { type: 'shot', anim: 'attack2', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 80, y: -130 }, aimH: 80, dropPx: 50, proj: 'ink', impact: 'splash', impactAir: true, muzzle: null,
                    volley: { count: 3, lanes: [0, -26, 26], gapMs: 150 }, homing: 55, homeAfterMs: 200, enraged: { count: 5, lanes: [0, -24, 24, -48, 48], gapMs: 110 },
                    hitCols: ["#06303a", "#1a8a9a", "#6ae8f0", "#e8ffff"], impactCols: ["#06303a", "#1a8a9a", "#6ae8f0", "#e8ffff"], speed: 200, range: 520, box: { w: 22, h: 18 }, depth: 12, dodgeZ: 24,
                    dmg: [11, 14], knock: 18, flinchMs: 360, when: [40, 520], weight: 3 },
          deep:   { type: 'spikes', anim: 'special', telegraph: [1, 2], spawnFrame: 3, fx: 'tent', aimMs: 400, count: 7, first: 60, step: 50, delayMs: 90, maxRange: 420,
                    spikeActive: [2, 3, 4], reach: { x0: -24, x1: 24, yTop: -84, yBot: 0 }, depth: 16, dodgeZ: 30,
                    dmg: [13, 16], knock: 20, flinchMs: 420, shake: 1.8, when: [0, 460], weight: 2, gapMs: 5000, firstMs: 2500 },
          geyser: { type: 'barrage', anim: 'special', telegraph: [1, 2], spawnFrame: 3, count: 5, intervalMs: 240, fallMs: 950, dropHeight: 1, noProj: true,
                    blast: 'geyser', blastCols: ["#06303a", "#1a8a9a", "#6ae8f0", "#e8ffff"], spread: { x: 80, y: 18 }, radius: 38, depth: 16, dodgeZ: 26, holdMs: 300, gapMs: 8000, firstMs: 5000,
                    enraged: { count: 8, intervalMs: 180 }, dmg: [13, 16], knock: 26, flinchMs: 420, shake: 1.6, when: [0, 600], weight: 2 }
        }
      },
      // 16판 보스 해신 나가: 삼지창 연타 · 물줄기 뿜기 · 해일(바닥을 따라 오는 큰 파도, 뛰어넘기) · 물속으로 사라져 등 뒤에서 / 분노: 졸개 + 해일 2번
      naga: {
        label: '해신 나가', frameW: 305, frameH: 211, pivot: { x: 120, y: 205 },
        boss: true,
        anims: Object.assign(enemyAnims('naga', { idle: [4, 5, true], walk: [6, 7, true], attack1: [5, 9, false, [1, 2, 2, 2, 3, 3, 4, 4, 5]], attack2: [5, 9, false, [1, 2, 2, 2, 3, 3, 4, 4, 5]], special: [6, 8, false, [1, 2, 2, 2, 2, 3, 4, 5, 6]], hit: [3, 8, false, [1, 2, 2, 3]], hit2: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 6, false, [1, 1, 2, 3, 4, 5, 5]] }), { vanish: { frames: [EN + 'naga/special_01.png', EN + 'naga/special_02.png'], fps: 7, loop: false, playback: [1, 1, 2, 2] }, appear: { frames: [EN + 'naga/special_04.png', EN + 'naga/special_03.png'], fps: 7, loop: false, playback: [1, 1, 2, 2] } }),
        fxArt: { jet: FX2('jet', 12), tide: FX2('tide', 12) },
        walkAnim: 'walk',
        staggerCdMs: 2300,   // 움찔한 뒤 2.3초는 안 끊김(예전 보스와 같음 — 계속 맞아도 공격함)
        hp: 1200, speedX: 38, speedY: 24, radius: 42, height: 200,
        hurtbox: { x0: -44, x1: 52, yTop: -200, yBot: 0 },
        engage: 85, hover: [100, 150], range: [30, 540], alignY: 12, cooldown: [950, 1700], firstCooldown: [1200, 1600],
        knockResist: 0.2, deathKnock: 30, superArmor: true,
        enrageAt: 0.5, rageColor: '#3af0ff',
        enrage: { speedMul: 1.25, cooldownMul: 0.7, summon: ['crab', 'fishman', 'jelly'] },
        attacks: {
          combo:  { anim: 'attack1', active: [3, 4], multiHit: true, telegraph: [2], depth: 18, reach: { x0: 10, x1: 180, yTop: -150, yBot: -20 },
                    dmg: [14, 18], knock: 28, flinchMs: 440, shake: 1.6, when: [20, 180], weight: 2 },
          breath: { type: 'breath', anim: 'attack2', telegraph: [1, 2], active: [3, 4], depth: 16, reach: { x0: 60, x1: 340, yTop: -180, yBot: -120 }, tickMs: 170,
                    dmg: [6, 8], burn: [1, 2], knock: 14, flinchMs: 240, shake: 0.8, when: [40, 360], weight: 2,
                    fx: { art: 'jet', attach: { x: 70, y: -150 }, segW: 58, segments: 5, growMs: 220 } },
          tide:   { type: 'shot', anim: 'special', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 90, y: 0 }, aimH: 0, dropPx: 0, proj: 'tide', impact: null, muzzle: null, pierce: true,
                    hitCols: ["#06303a", "#1a8a9a", "#6ae8f0", "#e8ffff"], speed: 260, range: 520, box: { w: 50, h: 80 }, depth: 16, dodgeZ: 26, enraged: { count: 2, lanes: [0, 0], gapMs: 500, scale: [1, 1] },
                    dmg: [14, 17], knock: 30, flinchMs: 420, shake: 1.6, when: [40, 520], weight: 2 },
          dive:   { type: 'teleport', anim: 'vanish', appearAnim: 'appear', telegraph: [1], invuln: [2], hiddenMs: 400, gatherMs: 380, behind: 90, lunge: 0, depth: 18,
                    reach: { x0: 10, x1: 180, yTop: -150, yBot: -20 }, then: 'combo', thenFrame: 2, smokeCols: ['#06303a', '#1a8a9a', '#6ae8f0', '#e8ffff'],
                    when: [0, 999], weight: 1, gapMs: 9000, firstMs: 7000, enraged: { useGapMs: 6000 } }
        }
      },
      // 폭풍 하피(17·18): 내리꽂아 할퀴기 + 「번개 깃털」(깃털 셋을 비스듬히 아래로 날림)
      harpy: {
        label: '폭풍 하피', frameW: 127, frameH: 161, pivot: { x: 51, y: 155 },
        anims: enemyAnims('harpy', { idle: [4, 6, true], fly: [6, 10, true], attack: [5, 10, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 10, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [4, 10, false, [1, 2, 3, 4, 4]], getup: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 8, false] }),
        fxArt: { feather: FX2('feather', 14) },
        walkAnim: 'fly',
        down: { slide: 70, lyingFrames: [3, 4] },
        hp: 45, speedX: 105, speedY: 66, radius: 22, height: 120,
        hurtbox: { x0: -18, x1: 30, yTop: -122, yBot: -50 },
        engage: 70, hover: [140, 230], range: [40, 320], alignY: 9, cooldown: [1400, 2400], firstCooldown: [400, 1300],
        retreatMs: 1000, knockResist: 1.3, deathKnock: 200,
        flying: { bob: 2, bobMs: 900, jumpDmgMul: 1.5 },
        attacks: {
          swoop:    { anim: 'attack', active: [2, 3], reach: { x0: 18, x1: 64, yTop: -76, yBot: -24 }, depth: 12, dmg: [6, 8], knock: 12, move: { frames: [2, 3], dist: 46 }, telegraph: [1], when: [40, 100], weight: 3 },
          feathers: { type: 'shot', anim: 'skill', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 30, y: -80 }, aimH: 40, dropPx: 120, proj: 'feather', impact: null, muzzle: null,
                      volley: { count: 3, lanes: [0, -16, 16], gapMs: 80 }, hitCols: ["#1a2a4a", "#5a8ad8", "#c8e8ff", "#ffffff"], speed: 270, range: 320, box: { w: 18, h: 10 }, depth: 9, dodgeZ: 22,
                      dmg: [5, 7], knock: 10, flinchMs: 260, when: [120, 320], weight: 2, gapMs: 4500, maxShooters: 2 }
        }
      },
      // 먹구름 정령(17·18): 구름 주먹 + 「돌풍」(바닥을 쓸고 오는 바람 — 맞으면 멀리 밀려남, 뛰어넘기)
      cloud: {
        label: '먹구름 정령', frameW: 144, frameH: 144, pivot: { x: 57, y: 138 },
        anims: enemyAnims('cloud', { idle: [4, 6, true], fly: [6, 8, true], attack: [5, 10, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 10, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [5, 10, false, [1, 2, 3, 4, 5, 5]], getup: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 8, false] }),
        fxArt: { gust: FX2('gust', 12) },
        walkAnim: 'fly',
        down: { slide: 70, lyingFrames: [4, 5] },
        hp: 52, speedX: 46, speedY: 32, radius: 20, height: 70,
        hurtbox: { x0: -28, x1: 28, yTop: -114, yBot: -44 },
        engage: 60, hover: [140, 220], range: [0, 320], alignY: 10, cooldown: [3200, 4500], firstCooldown: [900, 1700],
        knockResist: 1.2, deathKnock: 200,
        flying: { bob: 3, bobMs: 1300, jumpDmgMul: 1.0 },
        ranged: { attack: 'gust', keep: [140, 220], tooClose: 70, backOffMul: 0.7, maxShooters: 2, alignMs: 600 },
        attacks: {
          bash:  { anim: 'attack', active: [3, 4], reach: { x0: 10, x1: 76, yTop: -100, yBot: -40 }, depth: 12, dmg: [6, 8], knock: 14, telegraph: [2], when: [0, 80], weight: 2 },
          gust:  { type: 'shot', anim: 'skill', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 40, y: 0 }, aimH: 0, dropPx: 0, proj: 'gust', impact: null, muzzle: null, pierce: true,
                   hitCols: ["#1a2a4a", "#5a8ad8", "#c8e8ff", "#ffffff"], speed: 220, range: 320, box: { w: 40, h: 40 }, depth: 14, dodgeZ: 24, dmg: [4, 6], knock: 40, flinchMs: 380, when: [90, 320], weight: 3, gapMs: 4500, maxShooters: 2 }
        }
      },
      // 석상 가고일(17·18): 할퀴기 + 「낙하 강타」(날아올라 플레이어 자리로 내리꽂힘, 빨간 원)
      gargoyle: {
        label: '석상 가고일', frameW: 160, frameH: 104, pivot: { x: 82, y: 98 },
        anims: enemyAnims('gargoyle', { idle: [4, 6, true], walk: [6, 8, true], attack: [5, 10, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 10, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [4, 10, false, [1, 2, 3, 4, 4]], getup: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 8, false] }),
        walkAnim: 'walk',
        down: { slide: 70, lyingFrames: [3, 4] },
        hp: 92, speedX: 44, speedY: 26, radius: 20, height: 86,
        hurtbox: { x0: -22, x1: 26, yTop: -86, yBot: 0 },
        engage: 66, hover: [110, 180], range: [20, 300], alignY: 8, cooldown: [1500, 2400], firstCooldown: [700, 1500],
        knockResist: 0.8, deathKnock: 180,
        attacks: {
          claw: { anim: 'attack', active: [3, 4], reach: { x0: 14, x1: 90, yTop: -84, yBot: -10 }, depth: 13, dmg: [8, 11], knock: 16, telegraph: [2], when: [20, 90], weight: 3 },
          leap: { type: 'leap', anim: 'skill', active: [4], reach: { x0: -50, x1: 70, yTop: -50, yBot: 0 }, depth: 16, telegraph: [1], leap: { frames: [2, 3], max: 240, aimAt: 20 },
                  dmg: [9, 12], knock: 26, flinchMs: 380, shake: 1.6, when: [80, 300], weight: 2, gapMs: 4500, firstMs: 1500 }
        }
      },
      // 17판 중간보스 하피 여왕: 발톱 할퀴기 · 낙뢰 5번 · 번개 깃털 5발
      harpyqueen: {
        label: '하피 여왕', frameW: 282, frameH: 236, pivot: { x: 129, y: 230 },
        anims: enemyAnims('harpyqueen', { idle: [4, 6, true], fly: [6, 8, true], attack: [5, 9, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 9, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [2, 8, false, [1, 2, 2, 2]], getup: [2, 8, false, [1, 2, 2]], death: [5, 7, false, [1, 1, 2, 2, 3, 4, 5]] }),
        fxArt: { bolt: FX2('bolt', 13), feather: FX2('feather', 13) },
        walkAnim: 'fly',
        down: { slide: 60, lyingFrames: [2] },
        hp: 600, speedX: 70, speedY: 44, radius: 30, height: 130,
        hurtbox: { x0: -39, x1: 46, yTop: -180, yBot: -50 },
        engage: 80, hover: [120, 200], range: [30, 500], alignY: 12, cooldown: [1100, 1900], firstCooldown: [900, 1400],
        knockResist: 0.6, deathKnock: 60,
        flying: { bob: 3, bobMs: 1000, jumpDmgMul: 1.0 },
        attacks: {
          rake:     { anim: 'attack', active: [3], reach: { x0: 10, x1: 110, yTop: -130, yBot: -40 }, depth: 16, dmg: [10, 13], knock: 20, telegraph: [2], move: { frames: [2, 3], dist: 60 }, when: [20, 130], weight: 3 },
          thunder:  { type: 'barrage', anim: 'skill', telegraph: [1, 2], spawnFrame: 3, count: 5, intervalMs: 230, fallMs: 800, dropHeight: 1, noProj: true,
                      blast: 'bolt', blastCols: ["#2a2a0a", "#c8a82a", "#fff08a", "#ffffff"], spread: { x: 80, y: 18 }, radius: 34, depth: 14, dodgeZ: 24, holdMs: 200, gapMs: 6000, firstMs: 2500,
                      dmg: [10, 13], knock: 22, flinchMs: 400, shake: 1.4, when: [60, 500], weight: 2 },
          feathers: { type: 'shot', anim: 'skill', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 40, y: -110 }, aimH: 50, dropPx: 140, proj: 'feather', impact: null, muzzle: null,
                      volley: { count: 5, lanes: [0, -16, 16, -32, 32], gapMs: 60 }, hitCols: ["#1a2a4a", "#5a8ad8", "#c8e8ff", "#ffffff"], speed: 290, range: 420, box: { w: 18, h: 10 }, depth: 9, dodgeZ: 22,
                      dmg: [8, 10], knock: 12, flinchMs: 300, when: [120, 420], weight: 2, gapMs: 3500 }
        }
      },
      // 18판 중간보스 가고일 군주: 미늘창 내려찍기 · 낙하 강타 · 미늘창으로 땅 쳐서 번개 고리
      gargoylelord: {
        label: '가고일 군주', frameW: 272, frameH: 166, pivot: { x: 133, y: 160 },
        anims: enemyAnims('gargoylelord', { idle: [4, 6, true], walk: [6, 8, true], attack: [5, 9, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 9, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [2, 8, false, [1, 2, 2, 2]], getup: [2, 8, false, [1, 2, 2]], death: [5, 7, false, [1, 1, 2, 2, 3, 4, 5]] }),
        fxArt: { ring: FX2('ering', 12) },
        walkAnim: 'walk',
        down: { slide: 60, lyingFrames: [2] },
        hp: 660, speedX: 36, speedY: 22, radius: 32, height: 150,
        hurtbox: { x0: -30, x1: 38, yTop: -150, yBot: 0 },
        engage: 80, hover: [100, 160], range: [30, 420], alignY: 10, cooldown: [1100, 1900], firstCooldown: [900, 1400],
        knockResist: 0.5, deathKnock: 60,
        attacks: {
          chop:  { anim: 'attack', active: [3, 4], reach: { x0: 20, x1: 160, yTop: -150, yBot: 0 }, depth: 16, dmg: [12, 15], knock: 26, telegraph: [2], when: [20, 160], weight: 3 },
          slam:  { type: 'leap', anim: 'skill', active: [4], reach: { x0: -70, x1: 130, yTop: -70, yBot: 0 }, depth: 18, telegraph: [1], leap: { frames: [2, 3], max: 260, aimAt: 40 },
                   dmg: [13, 16], knock: 32, flinchMs: 440, shake: 2.6, when: [80, 320], weight: 2, heavy: true, gapMs: 4500 },
          ring:  { type: 'shockwave', anim: 'attack', telegraph: [1, 2], spawnFrame: 3, holdFrame: 4, fx: 'ring', ringArt: true, spawn: { x: 80, y: 0 },
                   rings: { count: 2, gapMs: 600, r0: 20, rMax: 260, speed: 240, band: 14, ryMax: 24, ringRx: 80, flameScale: 0.8, dodgeZ: 22 },
                   dmg: [11, 14], knock: 26, flinchMs: 420, heavy: true, shake: 1.8, when: [0, 300], weight: 2, gapMs: 5500 }
        }
      },
      // 17판 보스 뇌조 폭풍왕: 발톱 연타 · 번개 깃털 5발(분노 7발) · 낙뢰 · 큰 돌풍(밀어냄) · 활공 돌진 / 분노: 졸개(하피 · 먹구름)
      thunderbird: {
        label: '뇌조 폭풍왕', frameW: 398, frameH: 269, pivot: { x: 132, y: 263 },
        boss: true,
        anims: Object.assign(enemyAnims('thunderbird', { idle: [4, 5, true], walk: [6, 7, true], attack1: [5, 9, false, [1, 2, 2, 2, 3, 3, 4, 4, 5]], attack2: [5, 9, false, [1, 2, 2, 2, 3, 3, 4, 4, 5]], special: [5, 8, false, [1, 2, 2, 2, 2, 3, 4, 5]], hit: [3, 8, false, [1, 2, 2, 3]], hit2: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 6, false, [1, 1, 2, 3, 4, 5, 5]] })),
        fxArt: { feather: FX2('feather', 13), spark: FX2('spark', 13), bolt: FX2('bolt', 13), gust: FX2('gust', 13) },
        walkAnim: 'walk',
        staggerCdMs: 2300,   // 움찔한 뒤 2.3초는 안 끊김(예전 보스와 같음 — 계속 맞아도 공격함)
        hp: 1150, speedX: 60, speedY: 36, radius: 44, height: 170,
        hurtbox: { x0: -51, x1: 51, yTop: -230, yBot: -60 },
        engage: 90, hover: [110, 170], range: [30, 540], alignY: 14, cooldown: [950, 1700], firstCooldown: [1200, 1600],
        knockResist: 0.2, deathKnock: 30, superArmor: true,
        flying: { bob: 4, bobMs: 1100, jumpDmgMul: 1.0 },
        enrageAt: 0.5, rageColor: '#8ad8ff',
        enrage: { speedMul: 1.25, cooldownMul: 0.7, summon: ['harpy', 'cloud', 'harpy'] },
        attacks: {
          talon:    { anim: 'attack1', active: [2, 3], multiHit: true, telegraph: [1], depth: 18, reach: { x0: 10, x1: 170, yTop: -200, yBot: -40 }, move: { frames: [2, 3], dist: 80 },
                      dmg: [13, 17], knock: 28, flinchMs: 420, shake: 1.4, when: [20, 190], weight: 2 },
          feathers: { type: 'shot', anim: 'attack2', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 70, y: -170 }, aimH: 60, dropPx: 160, proj: 'feather', impact: 'spark', impactAir: true, muzzle: null,
                      volley: { count: 5, lanes: [0, -18, 18, -36, 36], gapMs: 60 }, enraged: { count: 7, lanes: [0, -16, 16, -32, 32, -48, 48], gapMs: 50 },
                      hitCols: ["#1a2a4a", "#5a8ad8", "#c8e8ff", "#ffffff"], impactCols: ["#2a2a0a", "#c8a82a", "#fff08a", "#ffffff"], speed: 300, range: 520, box: { w: 18, h: 10 }, depth: 9, dodgeZ: 22,
                      dmg: [11, 14], knock: 16, flinchMs: 340, when: [40, 520], weight: 2 },
          thunder:  { type: 'barrage', anim: 'special', telegraph: [1, 2], spawnFrame: 3, count: 6, intervalMs: 220, fallMs: 800, dropHeight: 1, noProj: true,
                      blast: 'bolt', blastCols: ["#2a2a0a", "#c8a82a", "#fff08a", "#ffffff"], spread: { x: 90, y: 20 }, radius: 38, depth: 16, dodgeZ: 24, holdMs: 250, gapMs: 7000, firstMs: 3500,
                      enraged: { count: 10, intervalMs: 160 }, dmg: [13, 16], knock: 24, flinchMs: 420, shake: 1.8, when: [0, 600], weight: 2 },
          gust:     { type: 'shot', anim: 'attack2', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 80, y: 0 }, aimH: 0, dropPx: 0, proj: 'gust', impact: null, muzzle: null, pierce: true,
                      hitCols: ["#1a2a4a", "#5a8ad8", "#c8e8ff", "#ffffff"], speed: 240, range: 520, box: { w: 60, h: 60 }, depth: 18, dodgeZ: 26, dmg: [9, 12], knock: 60, flinchMs: 420, when: [40, 520], weight: 2, gapMs: 6000 },
          swoop:    { type: 'charge', anim: 'attack1', frames: { wind: [1], run: [2, 3], impact: [4], recover: [5] }, windMs: 700, stepMs: 90, speed: 520, dist: 480, impactMs: 220, recoverMs: 380,
                      bodyReach: { x0: -20, x1: 140, yTop: -200, yBot: -40 }, reach: { x0: 30, x1: 160, yTop: -200, yBot: -40 }, depth: 18,
                      dmg: [15, 19], knock: 40, flinchMs: 500, shake: 2.2, dustMs: 120, when: [90, 500], weight: 2, heavy: true, gapMs: 6000, firstMs: 6000 }
        }
      },
      // 18판 보스 타락한 대천사: 대검 연타 · 빛의 투창(꿰뚫음, 분노 3발) · 심판(빛의 창 비) · 빛기둥 줄 · 빛으로 순간이동 / 분노: 졸개(가고일 · 하피)
      archangel: {
        label: '타락한 대천사', frameW: 338, frameH: 229, pivot: { x: 157, y: 223 },
        boss: true,
        anims: Object.assign(enemyAnims('archangel', { idle: [4, 5, true], walk: [6, 7, true], attack1: [5, 9, false, [1, 2, 2, 2, 3, 3, 4, 4, 5]], attack2: [5, 9, false, [1, 2, 2, 2, 3, 3, 4, 4, 5]], special: [6, 8, false, [1, 2, 2, 2, 2, 3, 4, 5, 6]], hit: [3, 8, false, [1, 2, 2, 3]], hit2: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 6, false, [1, 1, 2, 3, 4, 5, 5]] }), { vanish: { frames: [EN + 'archangel/special_01.png', EN + 'archangel/special_02.png'], fps: 7, loop: false, playback: [1, 1, 2, 2] }, appear: { frames: [EN + 'archangel/special_03.png', EN + 'archangel/special_05.png'], fps: 7, loop: false, playback: [1, 1, 2, 2] } }),
        fxArt: { javelin: FX2('javelin', 13), fall: FX2('lightfall', 13), hit: FX2('holyhit', 13), pillar: FX2('pillar', 13) },
        walkAnim: 'walk',
        staggerCdMs: 2300,   // 움찔한 뒤 2.3초는 안 끊김(예전 보스와 같음 — 계속 맞아도 공격함)
        hp: 1250, speedX: 34, speedY: 22, radius: 42, height: 210,
        hurtbox: { x0: -42, x1: 50, yTop: -210, yBot: 0 },
        engage: 85, hover: [100, 150], range: [30, 560], alignY: 12, cooldown: [950, 1700], firstCooldown: [1200, 1600],
        knockResist: 0.15, deathKnock: 30, superArmor: true,
        enrageAt: 0.5, rageColor: '#ffe08a',
        enrage: { speedMul: 1.25, cooldownMul: 0.7, summon: ['gargoyle', 'harpy', 'gargoyle'] },
        attacks: {
          combo:    { anim: 'attack1', active: [3, 4], multiHit: true, telegraph: [2], depth: 18, reach: { x0: 10, x1: 190, yTop: -190, yBot: 0 },
                      dmg: [14, 18], knock: 28, flinchMs: 440, shake: 1.8, when: [20, 190], weight: 2 },
          javelin:  { type: 'shot', anim: 'attack2', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 90, y: -140 }, aimH: 70, dropPx: 60, proj: 'javelin', impact: 'hit', impactAir: true, muzzle: null, pierce: true,
                      enraged: { count: 3, lanes: [0, -30, 30], gapMs: 140, scale: [1, 1, 1] }, hitCols: ["#3a2a0a", "#c8902a", "#ffe08a", "#ffffff"], impactCols: ["#3a2a0a", "#c8902a", "#ffe08a", "#ffffff"],
                      speed: 340, range: 560, box: { w: 40, h: 14 }, depth: 12, dodgeZ: 24, dmg: [14, 17], knock: 24, flinchMs: 400, shake: 1.0, when: [40, 560], weight: 2 },
          judgement:{ type: 'barrage', anim: 'special', telegraph: [1, 2], spawnFrame: 3, count: 6, intervalMs: 220, fallMs: 850, dropHeight: 320,
                      proj: 'fall', blast: 'hit', blastCols: ["#3a2a0a", "#c8902a", "#ffe08a", "#ffffff"], spread: { x: 80, y: 18 }, radius: 40, depth: 16, dodgeZ: 24, holdMs: 250, gapMs: 7500, firstMs: 4000,
                      enraged: { count: 10, intervalMs: 160 }, dmg: [14, 17], knock: 26, flinchMs: 420, heavy: true, shake: 2.0, when: [0, 600], weight: 2 },
          pillars:  { type: 'spikes', anim: 'special', telegraph: [1, 2], spawnFrame: 3, fx: 'pillar', aimMs: 400, count: 6, first: 70, step: 60, delayMs: 110, maxRange: 460,
                      spikeActive: [2, 3, 4], reach: { x0: -20, x1: 20, yTop: -140, yBot: 0 }, depth: 16, dodgeZ: 40,
                      dmg: [14, 17], knock: 20, flinchMs: 420, shake: 1.6, when: [0, 500], weight: 2, gapMs: 6000, firstMs: 6000 },
          blink:    { type: 'teleport', anim: 'vanish', appearAnim: 'appear', telegraph: [1], invuln: [2], hiddenMs: 380, gatherMs: 380, behind: 90, lunge: 0, depth: 18,
                      reach: { x0: 10, x1: 190, yTop: -190, yBot: 0 }, then: 'combo', thenFrame: 2, smokeCols: ['#fff8e0', '#ffe08a', '#c8902a', '#ffffff'],
                      when: [0, 999], weight: 1, gapMs: 9000, firstMs: 8000, enraged: { useGapMs: 6000 } }
        }
      },
      // 공허 사도(19·20): 「따라오는 공허 구체」 2발(플레이어 줄로 천천히 꺾임)
      voidpriest: {
        label: '공허 사도', frameW: 161, frameH: 137, pivot: { x: 89, y: 131 },
        anims: enemyAnims('voidpriest', { idle: [4, 6, true], walk: [6, 8, true], skill: [5, 10, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [5, 10, false, [1, 2, 3, 4, 5, 5]], getup: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 8, false] }),
        fxArt: { orb: FX2('vorb', 14), blast: FX2('vblast', 14) },
        walkAnim: 'walk',
        down: { slide: 70, lyingFrames: [4, 5] },
        hp: 62, speedX: 40, speedY: 28, radius: 15, height: 112,
        hurtbox: { x0: -14, x1: 26, yTop: -104, yBot: 0 },
        engage: 50, hover: [160, 260], range: [0, 380], alignY: 8, cooldown: [2600, 3600], firstCooldown: [1300, 2300],
        knockResist: 1.0, deathKnock: 210,
        rim: { color: '#d8b4ff', px: 1, alpha: 0.42 },
        ranged: { attack: 'orbs', keep: [160, 260], tooClose: 80, backOffMul: 0.8, maxShooters: 1, alignMs: 700 },
        attacks: {
          orbs: { type: 'shot', anim: 'skill', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 60, y: -80 }, aimH: 70, dropPx: 0, proj: 'orb', impact: 'blast', impactAir: true, muzzle: null,
                  volley: { count: 2, lanes: [-14, 14], gapMs: 220 }, homing: 45, homeAfterMs: 250,
                  hitCols: ["#0a0414", "#3a1460", "#a04ae8", "#ffb0ff"], impactCols: ["#0a0414", "#3a1460", "#a04ae8", "#ffb0ff"], speed: 190, range: 380, box: { w: 20, h: 18 }, depth: 12, dodgeZ: 22, dmg: [5, 7], knock: 14, flinchMs: 320, when: [60, 380] }
        }
      },
      // 공허 사냥개(19·20): 뛰어들어 물기 + 「그림자 도약」(연기로 사라져 등 뒤에서 나타나 물기 — 바닥 빨간 원 예고)
      hound: {
        label: '공허 사냥개', frameW: 190, frameH: 95, pivot: { x: 95, y: 89 },
        anims: Object.assign(enemyAnims('hound', { idle: [4, 6, true], run: [6, 14, true], attack: [5, 10, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 10, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [5, 10, false, [1, 2, 3, 4, 5, 5]], getup: [3, 8, false, [1, 1, 2, 2, 3]], death: [4, 8, false] }), { vanish: { frames: [EN + 'hound/skill_01.png', EN + 'hound/skill_02.png', EN + 'hound/skill_03.png'], fps: 9, loop: false, playback: [1, 1, 2, 2, 3] }, appear: { frames: [EN + 'hound/skill_04.png', EN + 'hound/skill_05.png'], fps: 9, loop: false, playback: [1, 1, 2, 2] } }),
        walkAnim: 'run',
        down: { slide: 70, lyingFrames: [4, 5] },
        hp: 58, speedX: 112, speedY: 62, radius: 24, height: 60,
        hurtbox: { x0: -36, x1: 42, yTop: -60, yBot: 0 },
        engage: 80, hover: [150, 220], range: [40, 400], alignY: 8, cooldown: [1300, 2200], firstCooldown: [400, 1200],
        retreatMs: 800, knockResist: 1.1, deathKnock: 230,
        attacks: {
          bite:  { anim: 'attack', active: [2, 3], reach: { x0: 20, x1: 90, yTop: -58, yBot: -4 }, depth: 12, dmg: [7, 9], knock: 14, move: { frames: [2, 3], dist: 40 }, telegraph: [1], when: [40, 110], weight: 3 },
          blink: { type: 'teleport', anim: 'vanish', appearAnim: 'appear', telegraph: [1], invuln: [2], hiddenMs: 300, gatherMs: 350, behind: 60, lunge: 0, depth: 14,
                   reach: { x0: 20, x1: 90, yTop: -58, yBot: -4 }, then: 'bite', thenFrame: 2, smokeCols: ['#0a0414', '#2a0a4a', '#7a2ad8', '#c87aff'],
                   when: [80, 400], weight: 1, gapMs: 9000, firstMs: 2500 }
        }
      },
      // 심연 촉수괴(19·20): 촉수 채찍 + 「땅속 촉수」(바닥 틈에서 촉수가 줄지어 솟음)
      horror: {
        label: '심연 촉수괴', frameW: 214, frameH: 147, pivot: { x: 89, y: 141 },
        anims: enemyAnims('horror', { idle: [4, 6, true], walk: [6, 8, true], attack: [5, 10, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 10, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [5, 10, false, [1, 2, 3, 4, 5, 5]], getup: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 8, false] }),
        fxArt: { tent: FX2('tentacle', 13) },
        walkAnim: 'walk',
        down: { slide: 70, lyingFrames: [4, 5] },
        hp: 95, speedX: 34, speedY: 22, radius: 24, height: 84,
        hurtbox: { x0: -29, x1: 34, yTop: -84, yBot: 0 },
        engage: 66, hover: [110, 180], range: [20, 320], alignY: 8, cooldown: [1600, 2500], firstCooldown: [800, 1600],
        knockResist: 0.8, deathKnock: 180,
        attacks: {
          whip:   { anim: 'attack', active: [3, 4], reach: { x0: 10, x1: 120, yTop: -70, yBot: -20 }, depth: 13, dmg: [8, 11], knock: 16, telegraph: [2], showTelegraph: true, when: [20, 120], weight: 3 },
          plunge: { type: 'spikes', anim: 'skill', telegraph: [1, 2], spawnFrame: 3, fx: 'tent', aimMs: 350, count: 4, first: 60, step: 50, delayMs: 110, maxRange: 280,
                    spikeActive: [2, 3, 4], reach: { x0: -22, x1: 22, yTop: -80, yBot: 0 }, depth: 13, dodgeZ: 26, dmg: [8, 10], knock: 18, flinchMs: 380, when: [80, 320], weight: 2, gapMs: 5000, firstMs: 1500 }
        }
      },
      // 19판 중간보스 쌍두 사냥개: 두 머리 물기 · 그림자 도약(등 뒤) · 돌진
      houndalpha: {
        label: '쌍두 사냥개', frameW: 240, frameH: 150, pivot: { x: 105, y: 144 },
        anims: Object.assign(enemyAnims('houndalpha', { idle: [4, 6, true], walk: [6, 8, true], attack: [5, 9, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 9, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [2, 8, false, [1, 2, 2, 2]], getup: [2, 8, false, [1, 2, 2]], death: [5, 7, false, [1, 1, 2, 2, 3, 4, 5]] }), { vanish: { frames: [EN + 'houndalpha/skill_01.png', EN + 'houndalpha/skill_02.png', EN + 'houndalpha/skill_03.png'], fps: 9, loop: false, playback: [1, 1, 2, 2, 3] }, appear: { frames: [EN + 'houndalpha/skill_04.png', EN + 'houndalpha/skill_05.png'], fps: 9, loop: false, playback: [1, 1, 2, 2] } }),
        walkAnim: 'walk',
        down: { slide: 60, lyingFrames: [2] },
        hp: 640, speedX: 70, speedY: 40, radius: 36, height: 104,
        hurtbox: { x0: -62, x1: 73, yTop: -104, yBot: 0 },
        engage: 80, hover: [120, 190], range: [30, 440], alignY: 10, cooldown: [1100, 1900], firstCooldown: [900, 1400],
        knockResist: 0.5, deathKnock: 60,
        attacks: {
          bite:   { anim: 'attack', active: [2, 3], multiHit: true, reach: { x0: 20, x1: 130, yTop: -100, yBot: 0 }, depth: 16, dmg: [11, 14], knock: 22, telegraph: [1], move: { frames: [2, 3], dist: 50 }, when: [20, 140], weight: 3 },
          blink:  { type: 'teleport', anim: 'vanish', appearAnim: 'appear', telegraph: [1], invuln: [2], hiddenMs: 300, gatherMs: 380, behind: 80, lunge: 0, depth: 16,
                    reach: { x0: 20, x1: 130, yTop: -100, yBot: 0 }, then: 'bite', thenFrame: 2, smokeCols: ['#0a0414', '#2a0a4a', '#7a2ad8', '#c87aff'],
                    when: [0, 999], weight: 2, gapMs: 5000 },
          charge: { type: 'charge', anim: 'attack', frames: { wind: [1], run: [2, 3], impact: [4], recover: [5] }, windMs: 650, stepMs: 90, speed: 500, dist: 460, impactMs: 220, recoverMs: 360,
                    bodyReach: { x0: -20, x1: 110, yTop: -100, yBot: 0 }, reach: { x0: 30, x1: 130, yTop: -100, yBot: 0 }, depth: 16,
                    dmg: [12, 15], knock: 34, flinchMs: 440, shake: 2.0, dustMs: 90, when: [150, 440], weight: 2, heavy: true, gapMs: 4500 }
        }
      },
      // 20판 중간보스 공허 대사제: 지팡이 내려치기 · 따라오는 구체 4발 · 땅속 촉수 6줄
      archpriest: {
        label: '공허 대사제', frameW: 221, frameH: 179, pivot: { x: 91, y: 173 },
        anims: enemyAnims('archpriest', { idle: [4, 6, true], walk: [4, 8, true], attack: [5, 9, false, [1, 2, 2, 2, 3, 4, 4, 5]], skill: [5, 9, false, [1, 2, 2, 2, 2, 3, 4, 4, 5]], hit: [3, 10, false, [1, 2, 2, 3]], hit2: [3, 10, false, [1, 1, 2, 2, 3]], knockdown: [2, 8, false, [1, 2, 2, 2]], getup: [2, 8, false, [1, 2, 2]], death: [5, 7, false, [1, 1, 2, 2, 3, 4, 5]] }),
        fxArt: { orb: FX2('vorb', 13), blast: FX2('vblast', 13), tent: FX2('tentacle', 13) },
        walkAnim: 'walk',
        down: { slide: 60, lyingFrames: [2] },
        hp: 620, speedX: 30, speedY: 20, radius: 28, height: 160,
        hurtbox: { x0: -24, x1: 32, yTop: -160, yBot: 0 },
        engage: 70, hover: [160, 240], range: [20, 480], alignY: 12, cooldown: [1100, 1900], firstCooldown: [900, 1400],
        knockResist: 0.6, deathKnock: 60,
        rim: { color: '#d8b4ff', px: 1, alpha: 0.5 },
        attacks: {
          smite: { anim: 'attack', active: [3, 4], reach: { x0: 10, x1: 130, yTop: -160, yBot: 0 }, depth: 16, dmg: [11, 14], knock: 22, telegraph: [2], when: [10, 130], weight: 2 },
          orbs:  { type: 'shot', anim: 'skill', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 70, y: -120 }, aimH: 80, dropPx: 40, proj: 'orb', impact: 'blast', impactAir: true, muzzle: null,
                   volley: { count: 4, lanes: [-30, -10, 10, 30], gapMs: 160 }, homing: 50, homeAfterMs: 250, hitCols: ["#0a0414", "#3a1460", "#a04ae8", "#ffb0ff"], impactCols: ["#0a0414", "#3a1460", "#a04ae8", "#ffb0ff"],
                   speed: 190, range: 480, box: { w: 20, h: 18 }, depth: 12, dodgeZ: 22, dmg: [8, 10], knock: 16, flinchMs: 340, when: [100, 480], weight: 3, gapMs: 3000 },
          rift:  { type: 'spikes', anim: 'skill', telegraph: [1, 2], spawnFrame: 3, fx: 'tent', aimMs: 400, count: 6, first: 60, step: 50, delayMs: 90, maxRange: 360,
                   spikeActive: [2, 3, 4], reach: { x0: -22, x1: 22, yTop: -84, yBot: 0 }, depth: 14, dodgeZ: 28, dmg: [10, 13], knock: 18, flinchMs: 400, when: [80, 380], weight: 2, gapMs: 5000 }
        }
      },
      // 19판 보스 심연의 눈: 촉수 연타 · 눈빛 광선 · 따라오는 구체 4발(분노 6발) · 땅속 촉수 8줄 · 공허 운석 비 / 분노: 졸개(사냥개 · 촉수괴 · 사도)
      abysseye: {
        label: '심연의 눈', frameW: 266, frameH: 256, pivot: { x: 94, y: 250 },
        boss: true,
        anims: Object.assign(enemyAnims('abysseye', { idle: [4, 5, true], walk: [6, 7, true], attack1: [5, 9, false, [1, 2, 2, 2, 3, 3, 4, 4, 5]], attack2: [6, 9, false, [1, 2, 2, 2, 3, 3, 4, 4, 5, 6]], special: [6, 8, false, [1, 2, 2, 2, 2, 3, 4, 5, 6]], hit: [3, 8, false, [1, 2, 2, 3]], hit2: [3, 8, false, [1, 1, 2, 2, 3]], death: [6, 6, false, [1, 1, 2, 3, 4, 5, 6, 6]] })),
        fxArt: { beam: FX2('beam', 13), orb: FX2('vorb', 13), blast: FX2('vblast', 13), tent: FX2('tentacle', 13), meteor: FX2('meteor', 13) },
        walkAnim: 'walk',
        staggerCdMs: 2300,   // 움찔한 뒤 2.3초는 안 끊김(예전 보스와 같음 — 계속 맞아도 공격함)
        hp: 1300, speedX: 36, speedY: 26, radius: 44, height: 180,
        hurtbox: { x0: -58, x1: 65, yTop: -230, yBot: -50 },
        engage: 85, hover: [130, 200], range: [30, 560], alignY: 14, cooldown: [950, 1700], firstCooldown: [1200, 1600],
        knockResist: 0.2, deathKnock: 20, superArmor: true,
        flying: { bob: 4, bobMs: 1300, jumpDmgMul: 1.0 },
        enrageAt: 0.5, rageColor: '#ff3a8c',
        enrage: { speedMul: 1.2, cooldownMul: 0.7, summon: ['hound', 'horror', 'voidpriest'] },
        attacks: {
          lash:    { anim: 'attack1', active: [3, 4], multiHit: true, telegraph: [2], depth: 18, reach: { x0: 0, x1: 170, yTop: -160, yBot: 0 },
                     dmg: [14, 18], knock: 28, flinchMs: 440, shake: 1.4, when: [10, 170], weight: 2 },
          beam:    { type: 'breath', anim: 'attack2', telegraph: [1, 2], active: [3, 4], depth: 16, reach: { x0: 40, x1: 420, yTop: -200, yBot: -150 }, tickMs: 160,
                     dmg: [7, 9], burn: [1, 2], knock: 14, flinchMs: 240, shake: 1.0, when: [40, 420], weight: 2,
                     fx: { art: 'beam', attach: { x: 40, y: -176 }, segW: 62, segments: 6, growMs: 240 } },
          orbs:    { type: 'shot', anim: 'attack2', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 50, y: -176 }, aimH: 80, dropPx: 60, proj: 'orb', impact: 'blast', impactAir: true, muzzle: null,
                     volley: { count: 4, lanes: [-30, -10, 10, 30], gapMs: 150 }, homing: 55, homeAfterMs: 200, enraged: { count: 6, lanes: [-40, -24, -8, 8, 24, 40], gapMs: 110 },
                     hitCols: ["#0a0414", "#3a1460", "#a04ae8", "#ffb0ff"], impactCols: ["#0a0414", "#3a1460", "#a04ae8", "#ffb0ff"], speed: 200, range: 540, box: { w: 20, h: 18 }, depth: 12, dodgeZ: 24, dmg: [12, 15], knock: 18, flinchMs: 360, when: [40, 540], weight: 2 },
          rite:    { type: 'spikes', anim: 'special', telegraph: [1, 2], spawnFrame: 3, fx: 'tent', aimMs: 400, count: 8, first: 60, step: 50, delayMs: 80, maxRange: 460,
                     spikeActive: [2, 3, 4], reach: { x0: -24, x1: 24, yTop: -90, yBot: 0 }, depth: 16, dodgeZ: 30,
                     dmg: [14, 17], knock: 20, flinchMs: 420, shake: 1.8, when: [0, 500], weight: 2, gapMs: 5000, firstMs: 2500 },
          meteors: { type: 'barrage', anim: 'special', telegraph: [1, 2], spawnFrame: 3, count: 6, intervalMs: 220, fallMs: 850, dropHeight: 320,
                     proj: 'meteor', blast: 'blast', blastCols: ["#0a0414", "#3a1460", "#a04ae8", "#ffb0ff"], spread: { x: 80, y: 18 }, radius: 40, depth: 16, dodgeZ: 24, holdMs: 250, gapMs: 8000, firstMs: 6000,
                     enraged: { count: 10, intervalMs: 160 }, dmg: [14, 17], knock: 26, flinchMs: 420, heavy: true, shake: 2.0, when: [0, 600], weight: 2 }
        }
      },
      // 20판 보스 공허의 마왕(마지막): 낫창 연타 · 공허 초승달(분노 3줄) · 공허 운석 비 · 땅속 촉수 10줄 · 공허 고리 · 등 뒤 순간이동 / 절반에서 각성(오라 + 밀어냄) + 졸개 4
      voidlord: {
        label: '공허의 마왕', frameW: 548, frameH: 270, pivot: { x: 274, y: 264 },
        boss: true,
        anims: Object.assign(enemyAnims('voidlord', { idle: [4, 5, true], walk: [6, 7, true], attack1: [5, 9, false, [1, 2, 2, 2, 3, 3, 4, 4, 5]], attack2: [5, 9, false, [1, 2, 2, 2, 3, 3, 4, 4, 5]], special: [6, 8, false, [1, 2, 2, 2, 2, 3, 4, 5, 6]], hit: [3, 8, false, [1, 2, 2, 3]], hit2: [3, 8, false, [1, 1, 2, 2, 3]], death: [5, 6, false, [1, 1, 2, 3, 4, 5, 5]], awaken: [4, 6, false, [1, 1, 2, 2, 3, 3, 3, 4, 4]], rift: [5, 8, false, [1, 2, 2, 2, 3, 4, 4, 4, 5]] }), { vanish: { frames: [EN + 'voidlord/vanish_01.png', EN + 'voidlord/vanish_02.png'], fps: 7, loop: false, playback: [1, 1, 1, 2, 2, 2] }, appear: { frames: [EN + 'voidlord/vanish_03.png', EN + 'voidlord/vanish_04.png'], fps: 7, loop: false, playback: [1, 1, 1, 2, 2, 2] } }),
        fxArt: { wave: FX2('crescent', 12), meteor: FX2('meteor', 12), blast: FX2('vblast', 12), tent: FX2('tentacle', 12), ring: FX2('vring', 12), aura: FX2('aura', 12) },
        walkAnim: 'walk',
        staggerCdMs: 2300,   // 움찔한 뒤 2.3초는 안 끊김(예전 보스와 같음 — 계속 맞아도 공격함)
        finalBoss: true,
        hp: 1500, speedX: 40, speedY: 24, radius: 50, height: 250,
        hurtbox: { x0: -40, x1: 45, yTop: -250, yBot: 0 },
        engage: 90, hover: [90, 130], range: [30, 600], alignY: 12, cooldown: [900, 1600], firstCooldown: [1300, 1600],
        knockResist: 0.1, deathKnock: 0, superArmor: true,
        enrageAt: 0.5,
        enrage: { speedMul: 1.25, cooldownMul: 0.68, summon: ['hound', 'horror', 'voidpriest', 'hound'] },
        awaken: { anim: 'awaken', pushFrame: 2, push: 70, shake: 4, flash: '#a04ae8',
                  aura: { art: 'aura', scale: 1.5, alpha: 0.8, fadeInMs: 300 }, rim: { color: '#c06aff', px: 1, alpha: 0.6 } },
        attacks: {
          combo:    { anim: 'attack1', active: [3, 4], multiHit: true, telegraph: [2], depth: 20, reach: { x0: 10, x1: 220, yTop: -220, yBot: 0 },
                      reachF: { 3: { x0: 10, x1: 200, yTop: -220, yBot: 0 }, 4: { x0: 20, x1: 240, yTop: -140, yBot: -40 } }, heavyOn: [4], heavyShake: 2.6,
                      dmg: [16, 20], knock: 30, flinchMs: 460, shake: 2.0, when: [20, 230], weight: 2 },
          crescent: { type: 'shot', anim: 'attack2', telegraph: [1, 2], spawnFrame: 3, spawn: { x: 110, y: 0 }, aimH: 0, dropPx: 0, proj: 'wave', impact: null, muzzle: null, pierce: true,
                      hitCols: ["#0a0414", "#3a1460", "#a04ae8", "#ffb0ff"], speed: 320, range: 560, box: { w: 40, h: 110 }, depth: 18, dodgeZ: 26, enraged: { count: 3, lanes: [0, -40, 40], gapMs: 160, scale: [1, 0.85, 0.85] },
                      dmg: [15, 19], knock: 28, flinchMs: 440, shake: 1.6, when: [40, 560], weight: 2 },
          rain:     { type: 'barrage', anim: 'special', telegraph: [1, 2], spawnFrame: 3, count: 7, intervalMs: 200, fallMs: 850, dropHeight: 320,
                      proj: 'meteor', blast: 'blast', blastCols: ["#0a0414", "#3a1460", "#a04ae8", "#ffb0ff"], spread: { x: 80, y: 18 }, radius: 44, depth: 16, dodgeZ: 24, holdMs: 250, gapMs: 8000, firstMs: 4500,
                      enraged: { count: 12, intervalMs: 150 }, dmg: [16, 20], knock: 30, flinchMs: 450, heavy: true, shake: 2.2, when: [0, 600], weight: 2 },
          rift:     { type: 'spikes', anim: 'rift', telegraph: [1, 2], spawnFrame: 3, fx: 'tent', aimMs: 400, count: 10, first: 60, step: 50, delayMs: 70, maxRange: 540,
                      spikeActive: [2, 3, 4], reach: { x0: -24, x1: 24, yTop: -92, yBot: 0 }, depth: 18, dodgeZ: 30,
                      dmg: [15, 19], knock: 22, flinchMs: 440, shake: 2.0, when: [0, 560], weight: 2, gapMs: 6000, firstMs: 3000 },
          nova:     { type: 'shockwave', anim: 'rift', telegraph: [1, 2], spawnFrame: 3, holdFrame: 4, fx: 'ring', ringArt: true, spawn: { x: 60, y: 0 },
                      rings: { count: 2, gapMs: 700, r0: 24, rMax: 320, speed: 280, band: 16, ryMax: 28, ringRx: 80, flameScale: 0.9, dodgeZ: 22 }, enraged: { count: 3 },
                      dmg: [14, 18], knock: 30, flinchMs: 450, heavy: true, shake: 2.4, when: [0, 340], weight: 2, gapMs: 7000, firstMs: 7000 },
          teleport: { type: 'teleport', anim: 'vanish', appearAnim: 'appear', telegraph: [1], invuln: [2], hiddenMs: 400, gatherMs: 360, behind: 100, lunge: 0, depth: 20,
                      reach: { x0: 10, x1: 200, yTop: -220, yBot: 0 }, then: 'combo', thenFrame: 2, smokeCols: ['#0a0414', '#2a0a4a', '#7a2ad8', '#ff6aff'],
                      enraged: { useGapMs: 5500 }, when: [0, 999], weight: 1, gapMs: 9000, firstMs: 8000 }
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
    // 2026-11-09 판 20개: [1판, 10판, 20판] 세 값 = knots 판 번호에서 그 값, 사이 판은 고르게(1~10판 값은 예전과 같음).
    //   unlockId = 다음 난이도가 열리는 판(앞 난이도에서 이 판을 깸). 예전처럼 10판(마왕) → 예전 저장에서 열린 하드가 그대로 열려 있음
    modeKnots: [1, 10, 20], modeUnlockId: 10,
    modes: {
      order: ['easy', 'normal', 'hard'],
      // 2026-11-07 형님: 이지 숨김(hidden = 고르는 탭에 안 나옴, 값은 남겨 둠 → hidden 만 지우면 돌아옴). 새 게임 = 노말, 이지에 있던 저장 = 노말로
      //   노말이 지루함 → 잡몹 1.5 → 2배 · 단단한 잡몹 1.3 → 1.6배, 판 보스 · 중간보스 = 체력 x bossHp · 공격 x bossDmg 더(위 배율 위에)
      //   하드 = 노말보다 확실히 많게 잡몹 2 → 2.5배 · 단단한 잡몹 1.6 → 2배(그 밖은 그대로). 하드의 「앞 난이도」 = 노말
      easy:   { name: '이지', hidden: true, hpMul: 1, dmgMul: 1, count: 1, countTough: 1, xp: 1, drop: 1 },
      // 2026-11-09 형님 「노말 하드 나누기보단 1~20판 한 줄에서 난이도 조절」: 하드도 숨김(hidden) → 고르는 탭 없음, 노말 하나로 1~20판.
      //   [1판, 10판, 20판] = 1~10판은 예전 노말 그대로, 11~20판은 예전 「하드 10판」 손맛까지 서서히(적 체력 판 배율 x 난이도 = 20판 2.9 x 1.65 ≈ 4.8 = 하드 10판 1.7 x 2.8)
      //   마리 수도 20판에 잡몹 2.5배 · 단단한 잡몹 2배(예전 하드), 경험치 x1.65 → x2.3 → x5(레벨 곡선이 Lv30 뒤 가파름):
      //   안 죽고 순서대로 깨면 10판 ≈ Lv22 · 12판 ≈ Lv26(2차 전직 Lv25) · 15판 ≈ Lv34 · 20판 ≈ Lv49(3차 Lv50). 자동 조종으로 11~20판 실제 경험치를 재서 맞춤
      normal: { name: '노말', hpMul: [2.1, 1.6, 1.65], dmgMul: [2.0, 1.55, 1.75], count: [2, 2, 2.5], countTough: [1.6, 1.6, 2], bossHp: 1.3, bossDmg: 1.2, xp: [1.65, 2.3, 5], drop: [1.25, 1.25, 1.5] },
      hard:   { name: '하드', hidden: true, hpMul: [3.0, 2.8, 2.6], dmgMul: [2.8, 2.6, 2.4], count: 2.5, countTough: 2, xp: 2.15, drop: 1.5 }
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
      },
      // ===================== 2부: 11~20단계 (2026-11-09) =====================
      // 마왕을 쓰러뜨린 뒤 마왕성 아래로 열린 땅들. 판 체력·공격 배율 1.8 → 2.9(10판 1.7), 몹 떼 2.05 → 2.5배, 중간보스는 midBoss.list
      //   새 그림 = 배경 5종(판 두 개씩, art/stages-11-20) + v2(2026-11-09 오후, 형님 「새 몹 · 새 기술 · 새 보스」): 땅마다 잡몹 3종 · 중간보스 2 · 보스 2 전부 새 AI 그림
      //   (예전 적을 물들여 쓰던 것은 다 뺌. 몹 · 보스 기술 효과도 AI 그림 = assets/enemies/fx2)
      //   소품 = 예전 판 소품을 그 땅에 맞게 다시 씀. bossTitle = 보스 등장 컷인 칭호(없으면 종류별 칭호)
      // 레벨(노말을 순서대로 안 죽고 깼을 때 셈): 10판 Lv20 → 13판 Lv25(2차 전직) → 15판 Lv28 → 20판 Lv36 → 하드 20판 Lv51(3차 Lv50 즈음)
      // ===== 11단계: 저주받은 숲 어귀 (새 적 가시나무 정령, 보스 = 저주 오크 족장) =====
      {
        id: 11,
        name: 'STAGE 11  저주받은 숲 어귀',
        width: 2880,
        healOnClear: 18,
        bgTop: '#2a1a40',
        bg: BG_CURSED,
        hpMul: 1.8, dmgMul: 1.75,
        bossName: '저주받은 고목왕',
        bossTitle: '저주받은 숲의 심장',
        waves: [
          { at: 120,  spawn: [['root', 'R', 0], ['shroom', 'R', 700], ['root', 'L', 2000]] },
          { at: 500,  placed: [['thorn', 288, 0.36, { group: 'camp1', dir: 1 }], ['root', 364, 0.58, { group: 'camp1' }]],
                      spawn: [['shroom', 'R', 700], ['root', 'L', 2400]] },
          { at: 880,  spawn: [['root', 'R', 0], ['shroom', 'L', 500], ['root', 'R', 1300, { el: 'poison' }], ['thorn', 'L', 3000], ['shroom', 'R', 3600]] },
          { at: 1260, placed: [['shroom', 292, 0.34, { group: 'camp2', dir: 1 }], ['thorn', 372, 0.44, { group: 'camp2' }], ['root', 340, 0.8, { group: 'camp2' }]],
                      spawn: [['root', 'R', 1200], ['shroom', 'L', 3400], ['root', 'R', 4200]] },
          { at: 1650, spawn: [['shroom', 'R', 0, { el: 'darkness' }], ['root', 'L', 400], ['thorn', 'R', 1000], ['root', 'L', 2800], ['shroom', 'R', 3400]] },
          { at: 2040, placed: [['thorn', 296, 0.3, { group: 'shrine', dir: 1 }], ['shroom', 368, 0.66, { group: 'shrine' }]],
                      spawn: [['root', 'R', 600], ['shroom', 'L', 1000], ['root', 'R', 2800]] },
          { at: 'end', boss: true, spawn: [['treantking', 'R', 0]] }
        ],
        props: [
          { type: 'stump',     x: 430,  y: 0.72 },
          { type: 'pot',       x: 700,  y: 0.22 },
          { type: 'ghostfire', x: 500 + 326, y: 0.47 },
          { type: 'stump',     x: 1150, y: 0.7, drop: 'bread' },
          { type: 'ghostfire', x: 1260 + 330, y: 0.56 },
          { type: 'pot',       x: 1860, y: 0.32 },
          { type: 'ghostfire', x: 2040 + 332, y: 0.48 },
          { type: 'stump',     x: 2250, y: 0.78, drop: 'meat' }
        ]
      },
      // ===== 12단계: 시든 영혼의 숲 (가시나무 정령 + 저주 유령 기사 · 미라, 보스 = 저주 거대 두꺼비) =====
      {
        id: 12,
        name: 'STAGE 12  시든 영혼의 숲',
        width: 2880,
        healOnClear: 18,
        bgTop: '#2a1a40',
        bg: BG_CURSED,
        hpMul: 1.9, dmgMul: 1.8,
        bossName: '가시덩굴 마녀',
        bossTitle: '시든 숲의 저주술사',
        waves: [
          { at: 120,  spawn: [['shroom', 'R', 0], ['root', 'R', 700], ['shroom', 'L', 2000], ['thorn', 'R', 2600]] },
          { at: 500,  placed: [['thorn', 288, 0.36, { group: 'camp1', dir: 1 }], ['shroom', 364, 0.58, { group: 'camp1' }]],
                      spawn: [['root', 'R', 700], ['shroom', 'L', 2400]] },
          { at: 880,  spawn: [['shroom', 'R', 0], ['root', 'L', 500], ['shroom', 'R', 1300, { el: 'darkness' }], ['thorn', 'L', 3000], ['root', 'R', 3600]] },
          { at: 1260, placed: [['root', 292, 0.34, { group: 'camp2', dir: 1 }], ['thorn', 372, 0.44, { group: 'camp2' }], ['shroom', 340, 0.8, { group: 'camp2' }]],
                      spawn: [['shroom', 'R', 1200], ['root', 'L', 3400], ['thorn', 'R', 4200]] },
          { at: 1650, spawn: [['root', 'R', 0, { el: 'poison' }], ['shroom', 'L', 400], ['thorn', 'R', 1000], ['shroom', 'L', 2800], ['root', 'R', 3400], ['thorn', 'L', 4200]] },
          { at: 2040, placed: [['thorn', 296, 0.3, { group: 'grave', dir: 1 }], ['root', 368, 0.66, { group: 'grave' }], ['shroom', 352, 0.86, { group: 'grave' }]],
                      spawn: [['shroom', 'R', 600], ['root', 'L', 1000], ['shroom', 'R', 2800]] },
          { at: 'end', boss: true, spawn: [['witch', 'R', 0]] }
        ],
        props: [
          { type: 'coffin',    x: 430,  y: 0.72 },
          { type: 'stump',     x: 700,  y: 0.22 },
          { type: 'ghostfire', x: 500 + 326, y: 0.47 },
          { type: 'coffin',    x: 1150, y: 0.7, drop: 'bread' },
          { type: 'ghostfire', x: 1260 + 330, y: 0.56 },
          { type: 'stump',     x: 1860, y: 0.32, drop: 'meat' },
          { type: 'ghostfire', x: 2040 + 332, y: 0.48 },
          { type: 'coffin',    x: 2250, y: 0.78, drop: 'meat' }
        ]
      },
      // ===== 13단계: 수정 동굴 (새 적 수정 갑충, 보스 = 수정 돌 골렘) =====
      {
        id: 13,
        name: 'STAGE 13  수정 동굴',
        width: 2880,
        healOnClear: 18,
        bgTop: '#151a3a',
        bg: BG_CRYSTAL,
        hpMul: 2.0, dmgMul: 1.85,
        bossName: '수정 지네왕',
        bossTitle: '수정 동굴의 포식자',
        waves: [
          { at: 120,  spawn: [['beetle', 'R', 0], ['spider', 'R', 700], ['beetle', 'L', 2000]] },
          { at: 500,  placed: [['turret', 288, 0.36, { group: 'roost', dir: 1 }], ['beetle', 364, 0.58, { group: 'roost' }]],
                      spawn: [['spider', 'R', 700], ['beetle', 'L', 2400]] },
          { at: 880,  spawn: [['beetle', 'R', 0], ['spider', 'L', 500], ['beetle', 'R', 1300, { el: 'lightning' }], ['turret', 'L', 3000], ['spider', 'R', 3600]] },
          { at: 1260, placed: [['spider', 292, 0.34, { group: 'camp2', dir: 1 }], ['turret', 372, 0.44, { group: 'camp2' }], ['beetle', 340, 0.8, { group: 'camp2' }]],
                      spawn: [['beetle', 'R', 1200], ['spider', 'L', 3400], ['beetle', 'R', 4200]] },
          { at: 1650, spawn: [['spider', 'R', 0, { el: 'ice' }], ['beetle', 'L', 400], ['turret', 'R', 1000], ['beetle', 'L', 2800], ['spider', 'R', 3400]] },
          { at: 2040, placed: [['turret', 296, 0.3, { group: 'vein', dir: 1 }], ['spider', 368, 0.66, { group: 'vein' }]],
                      spawn: [['beetle', 'R', 600], ['spider', 'L', 1000], ['beetle', 'R', 2800]] },
          { at: 'end', boss: true, spawn: [['centipede', 'R', 0]] }
        ],
        props: [
          { type: 'orecart',  x: 430,  y: 0.74 },
          { type: 'orecrate', x: 790,  y: 0.26 },
          { type: 'brazier',  x: 880 + 326, y: 0.47 },
          { type: 'orecart',  x: 1470, y: 0.28 },
          { type: 'stack',    x: 1530, y: 0.72, drop: 'bread' },
          { type: 'brazier',  x: 1650 + 330, y: 0.56 },
          { type: 'orecrate', x: 1860, y: 0.3 },
          { type: 'orecart',  x: 2330, y: 0.62, drop: 'meat' }
        ]
      },
      // ===== 14단계: 빛나는 광맥 (수정 갑충 + 수정 설인 · 도마뱀, 보스 = 수정 전갈 왕) =====
      {
        id: 14,
        name: 'STAGE 14  빛나는 광맥',
        width: 2880,
        healOnClear: 18,
        bgTop: '#151a3a',
        bg: BG_CRYSTAL,
        hpMul: 2.1, dmgMul: 1.9,
        bossName: '수정 거신',
        bossTitle: '광맥을 지키는 거인',
        waves: [
          { at: 120,  spawn: [['spider', 'R', 0], ['beetle', 'R', 700], ['spider', 'L', 2000], ['turret', 'R', 2600]] },
          { at: 500,  placed: [['turret', 288, 0.36, { group: 'camp1', dir: 1 }], ['spider', 364, 0.58, { group: 'camp1' }]],
                      spawn: [['beetle', 'R', 700], ['spider', 'L', 2400]] },
          { at: 880,  spawn: [['spider', 'R', 0], ['beetle', 'L', 500], ['spider', 'R', 1300, { el: 'ice' }], ['turret', 'L', 3000], ['beetle', 'R', 3600]] },
          { at: 1260, placed: [['beetle', 292, 0.34, { group: 'camp2', dir: 1 }], ['turret', 372, 0.44, { group: 'camp2' }], ['spider', 340, 0.8, { group: 'camp2' }]],
                      spawn: [['spider', 'R', 1200], ['beetle', 'L', 3400], ['turret', 'R', 4200]] },
          { at: 1650, spawn: [['beetle', 'R', 0, { el: 'lightning' }], ['spider', 'L', 400], ['turret', 'R', 1000], ['spider', 'L', 2800], ['beetle', 'R', 3400], ['turret', 'L', 4200]] },
          { at: 2040, placed: [['turret', 296, 0.3, { group: 'gate', dir: 1 }], ['beetle', 368, 0.66, { group: 'gate' }], ['spider', 352, 0.86, { group: 'gate' }]],
                      spawn: [['spider', 'R', 600], ['beetle', 'L', 1000], ['spider', 'R', 2800]] },
          { at: 'end', boss: true, spawn: [['colossus', 'R', 0]] }
        ],
        props: [
          { type: 'orecrate', x: 430,  y: 0.72 },
          { type: 'orecart',  x: 700,  y: 0.22 },
          { type: 'brazier',  x: 500 + 326, y: 0.47 },
          { type: 'stack',    x: 1150, y: 0.7, drop: 'bread' },
          { type: 'brazier',  x: 1260 + 330, y: 0.56 },
          { type: 'orecrate', x: 1860, y: 0.32 },
          { type: 'brazier',  x: 2040 + 332, y: 0.48 },
          { type: 'orecart',  x: 2250, y: 0.78, drop: 'meat' }
        ]
      },
      // ===== 15단계: 가라앉은 신전 (새 적 심해 어인, 보스 = 심해 해적 선장) =====
      {
        id: 15,
        name: 'STAGE 15  가라앉은 신전',
        width: 2880,
        healOnClear: 18,
        bgTop: '#0e3a44',
        bg: BG_SUNKEN,
        hpMul: 2.2, dmgMul: 1.95,
        bossName: '심해 마녀',
        bossTitle: '가라앉은 신전의 마녀',
        waves: [
          { at: 120,  spawn: [['jelly', 'R', 0], ['fishman', 'R', 700], ['jelly', 'L', 2000]] },
          { at: 500,  placed: [['crab', 288, 0.36, { group: 'camp1', dir: 1 }], ['jelly', 364, 0.58, { group: 'camp1' }]],
                      spawn: [['fishman', 'R', 700], ['jelly', 'L', 2400]] },
          { at: 880,  spawn: [['jelly', 'R', 0], ['fishman', 'L', 500], ['jelly', 'R', 1300, { el: 'ice' }], ['crab', 'L', 3000], ['fishman', 'R', 3600]] },
          { at: 1260, placed: [['fishman', 292, 0.34, { group: 'camp2', dir: 1 }], ['crab', 372, 0.44, { group: 'camp2' }], ['jelly', 340, 0.8, { group: 'camp2' }]],
                      spawn: [['jelly', 'R', 1200], ['fishman', 'L', 3400], ['jelly', 'R', 4200]] },
          { at: 1650, spawn: [['fishman', 'R', 0, { el: 'wind' }], ['jelly', 'L', 400], ['crab', 'R', 1000], ['jelly', 'L', 2800], ['fishman', 'R', 3400]] },
          { at: 2040, placed: [['crab', 296, 0.3, { group: 'altar', dir: 1 }], ['fishman', 368, 0.66, { group: 'altar' }]],
                      spawn: [['jelly', 'R', 600], ['fishman', 'L', 1000], ['jelly', 'R', 2800]] },
          { at: 'end', boss: true, spawn: [['seawitch', 'R', 0]] }
        ],
        props: [
          { type: 'amphora',  x: 430,  y: 0.72 },
          { type: 'netcrate', x: 700,  y: 0.22 },
          { type: 'firebowl', x: 500 + 326, y: 0.47 },
          { type: 'amphora',  x: 1150, y: 0.7, drop: 'bread' },
          { type: 'firebowl', x: 1260 + 330, y: 0.56 },
          { type: 'netcrate', x: 1860, y: 0.32 },
          { type: 'firebowl', x: 2040 + 332, y: 0.48 },
          { type: 'amphora',  x: 2250, y: 0.78, drop: 'meat' }
        ]
      },
      // ===== 16단계: 해신의 회랑 (심해 어인 + 심해 미라 · 마족 병사, 보스 = 심해 서리 거인) =====
      {
        id: 16,
        name: 'STAGE 16  해신의 회랑',
        width: 2880,
        healOnClear: 18,
        bgTop: '#0e3a44',
        bg: BG_SUNKEN,
        hpMul: 2.3, dmgMul: 2.0,
        bossName: '해신 나가',
        bossTitle: '깊은 바다의 여왕',
        waves: [
          { at: 120,  spawn: [['fishman', 'R', 0], ['jelly', 'R', 700], ['fishman', 'L', 2000], ['crab', 'R', 2600]] },
          { at: 500,  placed: [['crab', 288, 0.36, { group: 'camp1', dir: 1 }], ['fishman', 364, 0.58, { group: 'camp1' }]],
                      spawn: [['jelly', 'R', 700], ['fishman', 'L', 2400]] },
          { at: 880,  spawn: [['fishman', 'R', 0], ['jelly', 'L', 500], ['fishman', 'R', 1300, { el: 'wind' }], ['crab', 'L', 3000], ['jelly', 'R', 3600]] },
          { at: 1260, placed: [['jelly', 292, 0.34, { group: 'camp2', dir: 1 }], ['crab', 372, 0.44, { group: 'camp2' }], ['fishman', 340, 0.8, { group: 'camp2' }]],
                      spawn: [['fishman', 'R', 1200], ['jelly', 'L', 3400], ['crab', 'R', 4200]] },
          { at: 1650, spawn: [['jelly', 'R', 0, { el: 'ice' }], ['fishman', 'L', 400], ['crab', 'R', 1000], ['fishman', 'L', 2800], ['jelly', 'R', 3400], ['crab', 'L', 4200]] },
          { at: 2040, placed: [['crab', 296, 0.3, { group: 'gate', dir: 1 }], ['jelly', 368, 0.66, { group: 'gate' }], ['fishman', 352, 0.86, { group: 'gate' }]],
                      spawn: [['fishman', 'R', 600], ['jelly', 'L', 1000], ['fishman', 'R', 2800]] },
          { at: 'end', boss: true, spawn: [['naga', 'R', 0]] }
        ],
        props: [
          { type: 'netcrate',  x: 430,  y: 0.72 },
          { type: 'amphora',   x: 700,  y: 0.22 },
          { type: 'firebowl',  x: 500 + 326, y: 0.47 },
          { type: 'rumbarrel', x: 1150, y: 0.7, drop: 'bread' },
          { type: 'firebowl',  x: 1260 + 330, y: 0.56 },
          { type: 'amphora',   x: 1860, y: 0.32, drop: 'meat' },
          { type: 'firebowl',  x: 2040 + 332, y: 0.48 },
          { type: 'netcrate',  x: 2250, y: 0.78, drop: 'meat' }
        ]
      },
      // ===== 17단계: 구름 위 폐허 (새 적 폭풍 하피, 보스 = 폭풍 와이번) =====
      {
        id: 17,
        name: 'STAGE 17  구름 위 폐허',
        width: 2880,
        healOnClear: 18,
        bgTop: '#6aa8e8',
        bg: BG_SKY,
        hpMul: 2.45, dmgMul: 2.1,
        bossName: '뇌조 폭풍왕',
        bossTitle: '폭풍을 부르는 날개',
        waves: [
          { at: 120,  spawn: [['harpy', 'R', 0], ['cloud', 'R', 700], ['harpy', 'L', 2000]] },
          { at: 500,  placed: [['gargoyle', 288, 0.36, { group: 'nest', dir: 1 }], ['harpy', 364, 0.58, { group: 'nest' }]],
                      spawn: [['cloud', 'R', 700], ['harpy', 'L', 2400]] },
          { at: 880,  spawn: [['harpy', 'R', 0], ['cloud', 'L', 500], ['harpy', 'R', 1300, { el: 'wind' }], ['gargoyle', 'L', 3000], ['cloud', 'R', 3600]] },
          { at: 1260, placed: [['cloud', 292, 0.34, { group: 'camp2', dir: 1 }], ['gargoyle', 372, 0.44, { group: 'camp2' }], ['harpy', 340, 0.8, { group: 'camp2' }]],
                      spawn: [['harpy', 'R', 1200], ['cloud', 'L', 3400], ['harpy', 'R', 4200]] },
          { at: 1650, spawn: [['cloud', 'R', 0, { el: 'light' }], ['harpy', 'L', 400], ['gargoyle', 'R', 1000], ['harpy', 'L', 2800], ['cloud', 'R', 3400]] },
          { at: 2040, placed: [['gargoyle', 296, 0.3, { group: 'bell', dir: 1 }], ['cloud', 368, 0.66, { group: 'bell' }]],
                      spawn: [['harpy', 'R', 600], ['cloud', 'L', 1000], ['harpy', 'R', 2800]] },
          { at: 'end', boss: true, spawn: [['thunderbird', 'R', 0]] }
        ],
        props: [
          { type: 'bronzeurn', x: 430,  y: 0.72 },
          { type: 'amphora',   x: 700,  y: 0.22 },
          { type: 'firebowl',  x: 500 + 326, y: 0.47 },
          { type: 'bronzeurn', x: 1150, y: 0.7, drop: 'bread' },
          { type: 'firebowl',  x: 1260 + 330, y: 0.56 },
          { type: 'amphora',   x: 1860, y: 0.32 },
          { type: 'firebowl',  x: 2040 + 332, y: 0.48 },
          { type: 'bronzeurn', x: 2250, y: 0.78, drop: 'meat' }
        ]
      },
      // ===== 18단계: 천공의 첨탑 (폭풍 하피 + 천공 기사 · 유령 기사 · 사제, 보스 = 천공 마왕군 장군) =====
      {
        id: 18,
        name: 'STAGE 18  천공의 첨탑',
        width: 2880,
        healOnClear: 18,
        bgTop: '#6aa8e8',
        bg: BG_SKY,
        hpMul: 2.6, dmgMul: 2.2,
        bossName: '타락한 대천사',
        bossTitle: '무너진 천공의 심판자',
        waves: [
          { at: 120,  spawn: [['cloud', 'R', 0], ['harpy', 'R', 700], ['cloud', 'L', 2000], ['gargoyle', 'R', 2600]] },
          { at: 500,  placed: [['gargoyle', 288, 0.36, { group: 'camp1', dir: 1 }], ['cloud', 364, 0.58, { group: 'camp1' }]],
                      spawn: [['harpy', 'R', 700], ['cloud', 'L', 2400]] },
          { at: 880,  spawn: [['cloud', 'R', 0], ['harpy', 'L', 500], ['cloud', 'R', 1300, { el: 'light' }], ['gargoyle', 'L', 3000], ['harpy', 'R', 3600]] },
          { at: 1260, placed: [['harpy', 292, 0.34, { group: 'camp2', dir: 1 }], ['gargoyle', 372, 0.44, { group: 'camp2' }], ['cloud', 340, 0.8, { group: 'camp2' }]],
                      spawn: [['cloud', 'R', 1200], ['harpy', 'L', 3400], ['gargoyle', 'R', 4200]] },
          { at: 1650, spawn: [['harpy', 'R', 0, { el: 'wind' }], ['cloud', 'L', 400], ['gargoyle', 'R', 1000], ['cloud', 'L', 2800], ['harpy', 'R', 3400], ['gargoyle', 'L', 4200]] },
          { at: 2040, placed: [['gargoyle', 296, 0.3, { group: 'spire', dir: 1 }], ['harpy', 368, 0.66, { group: 'spire' }], ['cloud', 352, 0.86, { group: 'spire' }]],
                      spawn: [['cloud', 'R', 600], ['harpy', 'L', 1000], ['cloud', 'R', 2800]] },
          { at: 'end', boss: true, spawn: [['archangel', 'R', 0]] }
        ],
        props: [
          { type: 'goldurn',   x: 430,  y: 0.72 },
          { type: 'bronzeurn', x: 700,  y: 0.22 },
          { type: 'firebowl',  x: 500 + 326, y: 0.47 },
          { type: 'goldurn',   x: 1150, y: 0.7, drop: 'bread' },
          { type: 'firebowl',  x: 1260 + 330, y: 0.56 },
          { type: 'bronzeurn', x: 1860, y: 0.32, drop: 'meat' },
          { type: 'firebowl',  x: 2040 + 332, y: 0.48 },
          { type: 'goldurn',   x: 2250, y: 0.78, drop: 'meat' }
        ]
      },
      // ===== 19단계: 심연의 틈 (새 적 공허 사도, 보스 = 공허 흡혈 백작) =====
      {
        id: 19,
        name: 'STAGE 19  심연의 틈',
        width: 2880,
        healOnClear: 18,
        bgTop: '#140820',
        bg: BG_ABYSS,
        hpMul: 2.75, dmgMul: 2.3,
        bossName: '심연의 눈',
        bossTitle: '공허를 들여다보는 눈',
        waves: [
          { at: 120,  spawn: [['hound', 'R', 0], ['voidpriest', 'R', 700], ['hound', 'L', 2000]] },
          { at: 500,  placed: [['horror', 288, 0.36, { group: 'camp1', dir: 1 }], ['hound', 364, 0.58, { group: 'camp1' }]],
                      spawn: [['voidpriest', 'R', 700], ['hound', 'L', 2400]] },
          { at: 880,  spawn: [['hound', 'R', 0], ['voidpriest', 'L', 500], ['hound', 'R', 1300, { el: 'darkness' }], ['horror', 'L', 3000], ['voidpriest', 'R', 3600]] },
          { at: 1260, placed: [['voidpriest', 292, 0.34, { group: 'camp2', dir: 1 }], ['horror', 372, 0.44, { group: 'camp2' }], ['hound', 340, 0.8, { group: 'camp2' }]],
                      spawn: [['hound', 'R', 1200], ['voidpriest', 'L', 3400], ['hound', 'R', 4200]] },
          { at: 1650, spawn: [['voidpriest', 'R', 0, { el: 'fire' }], ['hound', 'L', 400], ['horror', 'R', 1000], ['hound', 'L', 2800], ['voidpriest', 'R', 3400]] },
          { at: 2040, placed: [['horror', 296, 0.3, { group: 'rift', dir: 1 }], ['voidpriest', 368, 0.66, { group: 'rift' }]],
                      spawn: [['hound', 'R', 600], ['voidpriest', 'L', 1000], ['hound', 'R', 2800]] },
          { at: 'end', boss: true, spawn: [['abysseye', 'R', 0]] }
        ],
        props: [
          { type: 'cursedchest', x: 430,  y: 0.72 },
          { type: 'goldurn',     x: 700,  y: 0.22 },
          { type: 'soulflame',   x: 500 + 326, y: 0.47 },
          { type: 'cursedchest', x: 1150, y: 0.7, drop: 'bread' },
          { type: 'soulflame',   x: 1260 + 330, y: 0.56 },
          { type: 'goldurn',     x: 1860, y: 0.32, drop: 'meat' },
          { type: 'soulflame',   x: 2040 + 332, y: 0.48 },
          { type: 'cursedchest', x: 2250, y: 0.78, drop: 'meat' }
        ]
      },
      // ===== 20단계: 공허의 왕좌 = 마지막 판 (새 적 5종 공허 색 총출동, 보스 = 공허 마왕) =====
      {
        id: 20,
        name: 'STAGE 20  공허의 왕좌',
        width: 2880,
        healOnClear: 20,
        bgTop: '#140820',
        bg: BG_ABYSS,
        hpMul: 2.9, dmgMul: 2.4,
        bossName: '공허의 마왕',
        bossTitle: '공허의 왕',
        endLine: '공허의 마왕을 쓰러뜨렸다!',
        waves: [
          { at: 120,  spawn: [['hound', 'R', 0], ['voidpriest', 'R', 700], ['hound', 'L', 2000], ['horror', 'R', 2600]] },
          { at: 500,  placed: [['horror', 288, 0.36, { group: 'camp1', dir: 1 }], ['hound', 364, 0.58, { group: 'camp1' }]],
                      spawn: [['voidpriest', 'R', 700], ['hound', 'L', 2400]] },
          { at: 880,  spawn: [['hound', 'R', 0], ['voidpriest', 'L', 500], ['hound', 'R', 1300, { el: 'darkness' }], ['horror', 'L', 3000], ['voidpriest', 'R', 3600]] },
          { at: 1260, placed: [['voidpriest', 292, 0.34, { group: 'camp2', dir: 1 }], ['horror', 372, 0.44, { group: 'camp2' }], ['hound', 340, 0.8, { group: 'camp2' }]],
                      spawn: [['hound', 'R', 1200], ['voidpriest', 'L', 3400], ['horror', 'R', 4200]] },
          { at: 1650, spawn: [['voidpriest', 'R', 0, { el: 'light' }], ['hound', 'L', 400], ['horror', 'R', 1000], ['hound', 'L', 2800], ['voidpriest', 'R', 3400], ['horror', 'L', 4200]] },
          { at: 2040, placed: [['horror', 296, 0.3, { group: 'throne', dir: 1 }], ['voidpriest', 368, 0.66, { group: 'throne' }], ['hound', 352, 0.86, { group: 'throne' }]],
                      spawn: [['hound', 'R', 600], ['voidpriest', 'L', 1000], ['hound', 'R', 2800]] },
          { at: 'end', boss: true, spawn: [['voidlord', 'R', 0]] }
        ],
        props: [
          { type: 'goldurn',     x: 430,  y: 0.72 },
          { type: 'cursedchest', x: 700,  y: 0.22 },
          { type: 'soulflame',   x: 500 + 326, y: 0.47 },
          { type: 'goldurn',     x: 1150, y: 0.7, drop: 'bread' },
          { type: 'cursedchest', x: 1480, y: 0.26 },
          { type: 'soulflame',   x: 1260 + 330, y: 0.56 },
          { type: 'goldurn',     x: 1860, y: 0.32, drop: 'meat' },
          { type: 'soulflame',   x: 2040 + 332, y: 0.48 },
          { type: 'cursedchest', x: 2250, y: 0.78, drop: 'meat' },
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
      abyss: { label: '심연', hue: 0, sat: 0.85, bright: 0.86, color: '#7a2ab0', colorK: 0.38, hpMul: 1.15 },
      // 11~20단계(2026-11-09): 예전 적 · 보스를 그 땅 빛으로 물들여 다시 씀(새 그림 없이). 보스 이름 = 「저주 오크 족장」처럼 label 이 앞에 붙음
      cursed:  { label: '저주', hue: 0, sat: 0.8, bright: 0.85, color: '#6a3a9a', colorK: 0.36, hpMul: 1.1 },        // 11·12 저주받은 숲: 칙칙한 보라
      crystal: { label: '수정', hue: 0, sat: 0.9, bright: 1.05, color: '#6aa8ff', colorK: 0.36, hpMul: 1.1 },        // 13·14 수정 동굴: 푸른 수정 빛
      deep:    { label: '심해', hue: 0, sat: 0.85, bright: 0.9, color: '#1f8a8a', colorK: 0.38, hpMul: 1.1 },         // 15·16 가라앉은 신전: 짙은 청록
      storm:   { label: '폭풍', hue: 0, sat: 0.7, bright: 1.0, color: '#7a9ac8', colorK: 0.34, hpMul: 1.12 },        // 17 하늘 폐허: 잿빛 푸름
      holy:    { label: '천공', hue: 0, sat: 0.6, bright: 1.12, color: '#f2d27a', colorK: 0.34, hpMul: 1.12 },       // 18 천공의 첨탑: 흰 금빛
      void:    { label: '공허', hue: 0, sat: 0.9, bright: 0.72, color: '#5a1ab0', colorK: 0.42, hpMul: 1.18, dmgMul: 1.05 }   // 19·20 심연: 검보라(가장 셈)
    },

    // ---------- 속성 몹 (2026-11-07, 형님 승인, js/elmobs.js) ----------
    // 있는 잡몹(어느 종류든)에 속성 하나를 얹음: 색(tint = variants 와 같은 값, el_<속성> 이름으로 variants 에 들어감) + 몸 둘레 오라 + 속성 능력.
    //   웨이브 · 던전에서 { el: 'fire' } 로 씀(던전 = dungeons.○○.el · elRand). 속성 이름 = 무기 속성과 같음(fire · ice · lightning · poison · wind · darkness · light, 'dark' 도 됨)
    //   거리 · 크기 값은 전부 화면 도트(actorScale 로 안 줄임). 오라 크기 = 몹 키(T.height) / auraRef 배(sizeK 범위 안), 바닥 자국 · 터짐 = 그 배의 제곱근(큰 몹 = 조금만 크게)
    //   플레이어가 받는 상태(불탐 · 얼어붙음 · 독 · 감전): 몸 색 + 머리 위 작은 표시. 불탐 · 독은 체력 1 아래로는 안 내려감(벗어나면 그만)
    //   성능: 오라는 플레이어에서 가까운 auraMax 마리만, 살아 있는 속성 몹이 lite 마리 넘으면 코드로 그리는 오라(번개 · 바람) 줄 수를 줄임. 바닥 자국은 hazMax 개까지
    elMobs: {
      on: true,
      auraRef: 34, sizeK: [0.75, 1.7], auraMax: 16, lite: 18, hazMax: 16,
      // 효과 그림(art\element-mobs\fx 에서 복사 → assets/fx/elmob/<이름>_01.png = 게임 도트 1배, HD = assets/hd/fx/elmob/…webp 2배)
      //   [장 수, 기준점 x, y(그림 속, 게임 도트), fps, 반복]. holy_glow_silver = 빛 몹용 은빛(같은 그림을 은색 · 흰빛으로 구움)
      fx: {
        fire_ground: [4, 38, 28, 10, true], fire_burst: [4, 36, 36, 14, false], ice_aura: [4, 28, 68, 8, true], ice_puddle: [4, 32, 18, 10, false],
        poison_puddle: [4, 38, 38, 8, true], poison_gas: [4, 40, 34, 10, false], spark_trail: [4, 125, 20, 16, true], shadow_smoke: [4, 26, 84, 8, true],
        holy_glow: [4, 26, 76, 8, true], holy_glow_silver: [4, 26, 76, 8, true]
      },
      // 플레이어 상태: burn = 불탐(everyMs 마다 dmg, ms 동안), chill = 얼어붙음(걷기 · 달리기 move 배, 휘두르기 atk 배), shock = 감전(짧은 번쩍 + 작은 데미지)
      //   poison = 독(원래 있는 독 p.poison 그대로: 초록 숫자). dmg 는 몹 공격력 배율(판 · 난이도)을 곱함
      status: {
        burn:   { ms: 2200, everyMs: 550, dmg: 2, color: '#ff7a2a' },
        chill:  { ms: 1800, move: 0.62, atk: 0.85, color: '#7fd8ff' },
        poison: { ms: 2400, everyMs: 600, dmg: 2, color: '#8cff3a' },
        shock:  { ms: 420, color: '#ffe14a' }
      },
      els: {
        // 불: 금빛 불기둥 오라(형님: 지금 금빛 빛기둥 = 불 몹) · 때리면 불탐 · 쓰러지면 화염 폭발 + 불타는 바닥(그 위에 서 있으면 불탐)
        fire: { name: '불', tint: { label: '불', hue: 0, sat: 1.15, bright: 1.02, color: '#ff6a2a', colorK: 0.3 },
                aura: { art: 'holy_glow', alpha: 0.8, add: true, k: 1 },
                hit: { burn: true },
                death: { burst: { art: 'fire_burst', k: 1.1 }, ground: { art: 'fire_ground', ms: 3400, r: 22, depth: 8, burn: true, k: 0.9 } } },
        // 얼음: 서리 오라 · 때리면 얼어붙음(느려짐) · 쓰러지면 빙결 장판(그 위에 서 있으면 얼어붙음)
        ice:  { name: '얼음', tint: { label: '얼음', hue: 0, sat: 0.75, bright: 1.12, color: '#8fd8ff', colorK: 0.36 },
                aura: { art: 'ice_aura', alpha: 0.85, add: false, k: 1 },
                hit: { chill: true },
                death: { ground: { art: 'ice_puddle', ms: 4200, r: 22, depth: 8, chill: true, k: 1 } } },
        // 번개(코드로 그림): 세로 일자 번개 bolts 줄이 몸을 둥글게 감싸고 돌며 지지직(spin = 한 바퀴 ms) · 가끔 빠르게 돌진(전기 잔상, 부딪히면 감전) · 때리면 감전
        //   dash: 플레이어가 가로 range 도트 · 위아래 depth 안이면 cd ms 마다 windMs 지지직(멈춤) → speedK x 걷기 빠르기로 ms 동안 돌진, dmg = 부딪히는 데미지
        lightning: { name: '번개', tint: { label: '번개', hue: 0, sat: 1.05, bright: 1.1, color: '#ffe14a', colorK: 0.28 },
                aura: { code: 'bolts', bolts: 3, spin: 1400, rx: 0.4, hK: 1.05, color: '#fff6b0', glow: '#ffd23a' },
                hit: { shock: { dmg: [2, 4] } },
                dash: { range: [46, 150], depth: 12, cd: [3200, 5200], firstCd: [1200, 2600], windMs: 320, ms: 380, speedK: 5.5, dmg: [5, 7], knock: 10, flinchMs: 200, trailMs: 60 } },
        // 독: 발밑 독 기운 · 걷다가 가끔 독 웅덩이(그 위에 서 있으면 독) · 때리면 독 · 쓰러지면 독가스(안에 있으면 독)
        poison: { name: '독', tint: { label: '독', hue: 0, sat: 1.05, bright: 0.95, color: '#8cff3a', colorK: 0.3 },
                aura: { art: 'poison_puddle', alpha: 0.5, add: false, k: 0.55, ground: true, bubbles: 3 },
                hit: { poison: true },
                walk: { art: 'poison_puddle', every: 70, chance: 0.55, cd: 2600, ms: 3200, r: 20, depth: 8, poison: true, k: 0.75 },
                death: { gas: { art: 'poison_gas', ms: 2600, r: 26, depth: 12, poison: true, k: 0.95 } } },
        // 바람(코드로 그림): 회오리 말고 몸 둘레를 밑에서 위로 꽈배기처럼 감아 올라가는 반투명 바람 줄기(strands 줄, turns 바퀴) · 걷기 빨라짐(speed 배) ·
        //   가까이 있으면 cd ms 마다 돌풍(플레이어를 push 도트 밀어냄, 데미지 없음) · 때리면 더 밀림(hitPush)
        wind: { name: '바람', tint: { label: '바람', hue: 0, sat: 0.8, bright: 1.12, color: '#bfffe6', colorK: 0.3 },
                aura: { code: 'braid', strands: 3, turns: 2.2, rise: 1100, rx: 0.42, hK: 1.12, color: '225,255,245', alpha: 0.5, show: 0.72 },
                speed: 1.3,
                gust: { range: 62, depth: 16, cd: [3400, 5200], firstCd: [1500, 3000], push: 34 },
                hit: { push: 18 } },
        // 어둠: 그림자 연기 오라 · 나올 때 스르르 나타남(fadeInMs) · 가끔 잠깐 흐려짐(stealth: alpha 까지, ms 동안, 맞기는 함) · 때리면 체력을 빨아 감(drain = 준 데미지 x 배)
        darkness: { name: '어둠', tint: { label: '어둠', hue: 0, sat: 0.85, bright: 0.78, color: '#a040ff', colorK: 0.34 },
                aura: { art: 'shadow_smoke', alpha: 0.8, add: false, k: 1 },
                fadeInMs: 700,
                stealth: { cd: [4500, 7000], ms: 1300, alpha: 0.28, fadeMs: 260 },
                hit: { drain: 0.6 } },
        // 빛: 은빛 · 흰빛 빛기둥 오라(같은 그림을 은색으로) · cd ms 마다 빛 퍼짐: 둘레 r 도트 안 몹 체력 heal(최대 체력 비율) + 자기는 shieldMs 동안 보호막(받는 데미지 x shield)
        //   midHeal = 대장 · 수호자는 최대 체력의 이만큼만(2026-11-07 시련 균형: 체력 많은 대장이 8% 씩 차면 안 끝남)
        light: { name: '빛', tint: { label: '빛', hue: 0, sat: 0.55, bright: 1.18, color: '#f2f6ff', colorK: 0.34 },
                aura: { art: 'holy_glow_silver', alpha: 0.62, add: true, k: 1 },
                pulse: { cd: [4200, 6200], firstCd: [1500, 3000], r: 70, depth: 26, heal: 0.08, midHeal: 0.012, shieldMs: 1600, shield: 0.5 } }
      },
      // 속성 던전 몹 구성(2026-11-07: 속성 시련 6개 dungeons.ice … light 가 씀, 맨 아래 trialFill 이 웨이브로 펼침): mobs = [종류, 무게], mids = 중간보스 [종류, 이름, 색 변종], el = 그 던전 몹 속성
      //   불(fire)은 이미 있는 dungeons.fire(불의 화산굴) 가 씀
      dungeons: {
        ice:       { el: 'ice',       mobs: [['wolf', 4], ['yeti', 2], ['skeleton', 3], ['bat', 2]],      mids: [['yeti', '얼음 설인 대장', null], ['wolf', '서리 늑대 대장', 'ice']] },
        lightning: { el: 'lightning', mobs: [['wolf', 4], ['goblin', 3], ['bat', 3], ['gunner', 1]],      mids: [['wolf', '번개 늑대 대장', null], ['goblin', '번개 고블린 대장', null]] },
        poison:    { el: 'poison',    mobs: [['lizard', 4], ['goblin', 3], ['bat', 2], ['mummy', 1]],     mids: [['lizard', '독 도마뱀 대장', 'bog'], ['mummy', '독 미라 대장', null]] },
        wind:      { el: 'wind',      mobs: [['bat', 4], ['wolf', 3], ['goblin', 3], ['imp', 1]],         mids: [['wolf', '바람 늑대 대장', null], ['goblin', '돌풍 고블린 대장', null]] },
        darkness:  { el: 'darkness',  mobs: [['ghost', 3], ['skeleton', 3], ['bat', 3], ['soldier', 1]],  mids: [['ghost', '그림자 기사 대장', 'spectral'], ['soldier', '어둠 병사 대장', 'abyss']] },
        light:     { el: 'light',     mobs: [['skeleton', 3], ['soldier', 3], ['mage', 2], ['ghost', 1]], mids: [['soldier', '빛의 기사 대장', null], ['mage', '빛의 사제 대장', null]] }
      }
    },

    // ---------- 중간보스 (2026-11-06, 형님 승인) ----------
    // 판마다 하나, 보스방 바로 앞 웨이브(wave = 끝에서 몇 번째: 2 = 보스 바로 앞)에 그 판 잡몹을 크게 키운 「OO 대장」이 나옴. 새 그림 없음(있는 그림을 키우고 물들임)
    //   list = 판 id: [잡몹 종류, 이름, 색 변종(variants, 없으면 null)]. 잡몹 그림을 scale 배로 그리고 판정(몸·공격 상자·그림자)도 같이 키움
    //   tint = 더 어둡고 진하게(variant 와 같은 값: hue·sat·bright·color·colorK, 변종이 있으면 그 위에 bright 를 곱함), rim = 몸 둘레 빛나는 테두리
    //   hpBoss = 체력 = 그 판 보스 기본 체력 x 이 값(그다음 판 배율·변종·난이도 배율 곱함 → 1판 고블린 대장 450)
    //   dmgMul = 공격력 더(판·난이도 배율 위에), knock = 플레이어 밀림 배율, speed = 걷기 빠르기 배율
    //   heavy = 근접 공격에 맞으면 플레이어가 넘어짐, windMs = 공격 예고(치켜든 그림)를 이만큼 더 길게 + 바닥 빨간 예고 표시
    //   버티기(knockdown 저항): armor = 공격 동작 중엔 맞아도 안 끊김, staggerCdMs = 한 번 움찔하면 이 시간 동안은 번쩍이기만,
    //     downCdMs = 넘어진 뒤 이 시간 동안은 다시 안 넘어짐(콤보 마무리·무거운 타로만 넘어짐, 연타로는 안 넘어짐). 띄우기 기술엔 뜸(원래 보스였던 적이 중간보스면 안 뜸)
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
        10: ['soldier', '심연 근위대장', 'abyss'],
        // 11~20단계 v2(2026-11-09): 따로 그린 정예(art/stages-11-20/v2). 네 번째 칸 = 덮어쓰기: scale 1(그림이 이미 큼) · 색 그대로(tint 끔) · 체력 = 그 판 보스 x hpBoss
        11: ['thornelder', '가시나무 장로', null, MIDV2],
        12: ['shroomking', '독버섯 왕', null, MIDV2],
        13: ['rhinobeetle', '수정 장수풍뎅이', null, MIDV2],
        14: ['spiderqueen', '수정 거미 여왕', null, MIDV2],
        15: ['fishlord', '어인 장군', null, MIDV2],
        16: ['jellyqueen', '해파리 여왕', null, MIDV2],
        17: ['harpyqueen', '하피 여왕', null, MIDV2],
        18: ['gargoylelord', '가고일 군주', null, MIDV2],
        19: ['houndalpha', '쌍두 사냥개', null, MIDV2],
        20: ['archpriest', '공허 대사제', null, MIDV2]
      }
    },

    // ---------- 던전 (2026-11-07, 형님 승인) ----------
    // 스테이지 고르기 화면 「던전」 탭에서 들어감. 던전 하나 = 한 화면 싸움터(arena) + 규칙(rule). 난이도(이지·노말·하드)는 고르기 화면에서 고른 난이도를 따름
    //   (적 체력·공격 = modes 의 hpMul · dmgMul, 판 순서 대신 tier 번째 판 값). 저장 = 저장칸마다 던전 · 난이도별 최고 기록(growth.js dgBest)
    //   order = 고르기 화면에 나오는 순서. 새 던전(레이드 등) = 아래 mine 과 같은 모양으로 하나 더 + order 에 이름 (rule 이 다르면 main.js 던전 칸에 그 규칙 추가)
    //   공통 값: name · desc(카드 한 줄) · unlock('class' = 전직 뒤 열림, 시험 기간 stagesAllOpen 이면 다 열림) · lockHint(잠긴 카드 글자)
    //     tier = 몇 번째 판만큼 센가(적 판 배율 hpMul·dmgMul 은 아래 값, 난이도 배율·경험치 판 배율은 이 판 순서로), arenaMin = 싸움터 최소 폭(도트, 화면이 더 넓으면 화면 폭)
    //     bg = 배경(arena 배경, 위 BG_DG_MINE), bgTop = 배경을 못 읽었을 때 위쪽 색
    //     magnet = 던전에서만(2026-11-07 형님): 떨어진 강화석·결정이 작은 블랙홀에 빨려 들듯 플레이어에게 들어옴(js/enchant.js setMagnet).
    //       떨어진 뒤 delayMs 지나고 플레이어 가로 r · 위아래 depth 도트 안에 있으면(밟아서 줍는 거리 enchant.pickup 18 · 13 보다 조금 넓게)
    //       ms 동안 turns 바퀴 빙글 돌며 다가가고 shrink 배까지 작아짐 → 들어가는 순간 작은 반짝. 판(스테이지)은 그대로 밟아서 주움
    //       레이드 보스처럼 한꺼번에 빨아들일 땐 r · depth 를 크게(9999). 다 끝나면 남은 것은 저절로 주움
    dungeons: {
      order: ['fire', 'ice', 'lightning', 'poison', 'wind', 'darkness', 'light', 'mine'],   // 던전 탭 카드 순서(2026-11-07: 레이드 · 속성 시련 6 · 광산)
      //   color = 카드 테두리 · 이름 색(속성 색), tag = 카드 위 작은 띠(속성 시련 = 「레이드 보스 준비 중」)
      // ===== 강화석 광산: 90초 버티기(rule 'timeAttack') =====
      //   양옆에서 몹이 끝없이 나옴(시간이 갈수록 더 자주 · 더 많이). 30초 = 「대장 출현!」 중간보스 2, 60초 = 중간보스 5 + 몹 몰려옴
      //   쓰러지면 끝(그때까지 모은 강화석은 남음), 0초까지 버티면 「버텼다!」 + 덤 강화석. 경험치는 보통처럼(적마다)
      mine: {
        name: '강화석 광산', desc: '90초 버티기 · 강화석 캐기', rule: 'timeAttack', color: '#c8a0ff',
        unlock: 'class', lockHint: '전직 후 열림',
        tier: 3, hpMul: 1.15, dmgMul: 1.15,    // 3판(늪지대)쯤 세기. 난이도 배율은 modes(이지 1 · 노말 2.0 · 하드 2.95쯤, 3판 값)
        arenaMin: 560,
        bg: BG_DG_MINE, bgTop: '#07060b',
        timeSec: 90,          // 시간(초). 위 가운데 큰 숫자
        warnSec: 10,          // 남은 시간이 이 초 이하면 빨갛게 깜빡
        startMs: 1200,        // 시작 글자(「시작!」) 뒤 시계가 가기 시작
        // 몹 종류: [적 종류, 뽑힐 무게, 이 초부터 나옴]. 무게가 클수록 자주
        //   2026-11-07 형님(광산이 쉬움): 총잡이(gunner, 멀리서 쏨) 30초부터 · 오크(orc, 어깨 돌진) 60초부터 섞음 → 가만히 서서 기술만 쓰면 위험
        mobs: [['goblin', 5, 0], ['bat', 3, 0], ['wolf', 3, 8], ['skeleton', 2, 15], ['gunner', 2, 30], ['lizard', 2, 35], ['imp', 2, 50], ['orc', 1, 60], ['mummy', 1, 65]],
        // 단계(2026-11-07 형님): 30초마다 세짐. at = 이 초부터, hp · atk = 새로 나오는 적 체력 · 공격 배율, spawn = 나오는 빠르기 배율. 단계 글자는 아래 events banner
        phases: [{ at: 0, hp: 1, atk: 1, spawn: 1 }, { at: 30, hp: 1.3, atk: 1.3, spawn: 1.25 }, { at: 60, hp: 1.7, atk: 1.7, spawn: 1.5 }],
        // 나오는 빠르기: 처음 → rampSec 초에 끝 값으로 고르게
        //   every = 몇 ms 마다 한 번 나옴 [처음, 끝], batch = 한 번에 몇 마리 [처음, 끝](소수 = 가끔 하나 더),
        //   maxAlive = 살아 있는 몹 최대 [처음, 끝](넘으면 쓰러질 때까지 기다림), cap = 어떤 경우에도 넘지 않는 살아 있는 적 수(중간보스 포함, 성능)
        spawn: { every: [1500, 550], batch: [1, 2.6], maxAlive: [6, 18], rampSec: 80, cap: 34, firstMs: 300 },
        // 몹 떼(2026-11-07 형님: 한 줄로 오는 느낌 → 무리로). 있으면 위 every · batch 대신 이것(maxAlive · cap · rampSec 는 그대로 지킴)
        //   every = 무리 사이 ms [처음, 끝], size = 무리 마리 수 [처음, 끝](sizeJit = ±흔들림), minRoom = 자리가 이만큼 나야 다음 무리
        //   dx = 무리 안 옆 간격(도트, 엇갈림 [최소, 최대]), gapMs = 한 마리씩 나오는 틈. 깊이(위아래)는 늘 걷는 길 전체에 고르게
        //   mix = 무리 종류 { 이름: [무게, 이 초부터] }: side = 한쪽 끝 · pincer = 양쪽 끝 동시 · drop = 뒤 벽 쪽에서 뛰어내림(dropH 높이, 뒤쪽 dropBack 만큼) ·
        //   front = 앞(화면 아래)에서 뛰어듦(frontH 높이). avoid = 플레이어 바로 옆(도트)에는 안 떨어짐. 시간 사건 rush 도 무리로(첫 무리 = 양쪽 동시)
        pack: { every: [2600, 1250], size: [3, 6], sizeJit: 1, minRoom: 3, dx: [10, 40], gapMs: 90,
                mix: { side: [4, 0], pincer: [2, 8], drop: [3, 4], front: [1, 15] }, dropH: 90, dropBack: 0.3, frontH: 34, avoid: 46 },
        // 중간보스(midBoss 와 같은 방식으로 키운 잡몹): list 를 돌아가며. hp = 체력(판 배율 · 난이도 곱하기 전, 2판 해골 대장 ≈ 470)
        mids: { hp: 470, list: [['goblin', '광산 고블린 대장', null], ['skeleton', '광부 해골 대장', null], ['lizard', '굴 도마뱀 대장', null]] },
        // 시간 사건: at = 지난 초. banner = 큰 글자, mids = 중간보스 수(양옆 번갈아 gapMs 씩), rush = 몹 n 마리 몰려옴(rushMs 동안, maxAlive 무시 · cap 은 지킴)
        events: [
          //   2026-11-07: 단계 글자(2단계! · 3단계!) + 마지막 30초 = 대장 둘이 동시에(gapMs 0) + 몰려옴
          { at: 30, banner: '2단계! 대장 출현!', mids: 2, gapMs: 600 },
          { at: 60, banner: '3단계! 대장 둘 동시!', mids: 2, gapMs: 0, rush: { n: 12, ms: 3000 } }
        ],
        // 강화석: 잡몹 mob 확률(단단한 잡몹 tough), 중간보스 mid = [최소, 최대] 개. 판(enchant.drop: 1.2% · 4% · 1개)보다 훨씬 많이
        drop: { mob: 0.035, tough: 0.06, mid: [2, 3] },   // 2026-11-07 절반(예전 7% · 12% · 4~6개)
        bonus: 4,             // 0초까지 버티면 덤 강화석(2026-11-07 절반, 예전 8)             // 0초까지 버티면 덤 강화석
        // 난이도별: stones = 강화석(떨어지는 확률·개수·덤) 배율, spawn = 나오는 빠르기 배율, alive = 살아 있는 몹 최대 배율(cap 은 그대로)
        modes: { easy: { stones: 1, spawn: 1, alive: 1 }, normal: { stones: 1.5, spawn: 1.15, alive: 1.2 }, hard: { stones: 2, spawn: 1.3, alive: 1.4 } },
        magnet: { r: 48, depth: 28, delayMs: 400, ms: 520, turns: 1.25, shrink: 0.5 },
        // 속성 몹 섞기(2026-11-07, config elMobs): 도전마다 els 에서 pick 개 속성을 뽑아 둠 → from 초부터 types 몹이 나올 때 chance 확률로 그 속성 몹
        elRand: { chance: 0.14, from: 12, pick: 2, types: ['goblin', 'wolf', 'skeleton', 'bat', 'lizard'], els: ['fire', 'ice', 'lightning', 'poison', 'wind', 'darkness', 'light'] }
      },
      // ===== 불의 화산굴: 레이드(rule 'raid', 2026-11-07 형님 승인) =====
      //   들어가면 웨이브 1~5 = 불 속성 몹 큰 무리(도깨비 · 도마뱀 · 박쥐 · 늑대 · 용암 골렘 정예) + 사이사이 중간보스
      //   → 다 잡으면 레이드 보스 「화염룡 이그니스」 등장(화면 흔들림 · 착지 · 포효 · 이름 컷인 · 여러 줄 체력 막대 + 파란 그로기 막대)
      //   보스 = 싸움터 오른쪽에 박힌 거대한 그림(안 걸음 · 안 밀림 · 안 뜸, 카메라 고정). 부위마다 데미지가 다름(머리 · 발톱 = 그대로, 몸 = 줄어듦, 약점 = 더)
      //   쓰러뜨리면 불 결정 · 강화석이 와르르 → 전부 빨려 들어옴(끌어당김 아주 크게) → 결과 + 난이도별 최고 클리어 시간. 쓰러지면 끝(모은 것은 남음)
      //   그림 · 부위 상자 · 입 위치 = assets/raid/fire/dragon.json(art\raid-dragon\fire 에서 복사, 1배 그림 점 → actorScale 0.55 배). 그리는 · 규칙 = js/raid.js
      fire: {
        name: '불의 화산굴', desc: '레이드 · 화염룡 이그니스', rule: 'raid', color: '#ff7a3a',
        unlock: 'class', lockHint: '전직 후 열림',
        tier: 5, hpMul: 1.1, dmgMul: 1.1,      // 몹 세기 = 5판(설산)쯤. 난이도 배율은 modes(이지 · 노말 · 하드, 5판 값)
        el: 'fire',           // 웨이브 몹 · 대장 · 보스가 부르는 졸개 = 전부 불 속성 몹(2026-11-07, config elMobs.els.fire: 금빛 불기둥 · 불탐 · 화염 폭발 · 불타는 바닥)
        arenaMin: 560,
        bg: BG_DG_FIRE, bgTop: '#090404',
        startMs: 1200,
        // 웨이브 몹 종류 전체(그림 불러오기용). 웨이브마다 뽑는 무게는 아래 waves[].mobs
        mobs: [['imp', 4, 0], ['lizard', 3, 0], ['bat', 2, 0], ['wolf', 2, 0], ['lavagolem', 1, 0]],
        // 살아 있는 몹 수 한도: maxAlive = 웨이브 1 → 5 로 고르게 [처음, 끝](난이도 alive 배율), cap = 어떤 경우에도(중간보스 포함, 성능)
        spawn: { maxAlive: [9, 13], cap: 30, firstMs: 300 },
        // 몹 떼(광산과 같은 모양): every = 무리 사이 ms [웨이브 1, 웨이브 5], size = 무리 마리 수 [처음, 끝]
        pack: { every: [1700, 1100], size: [4, 6], sizeJit: 1, minRoom: 3, dx: [10, 40], gapMs: 90,
                mix: { side: [4, 0], pincer: [3, 0], drop: [3, 0], front: [1, 0] }, dropH: 90, dropBack: 0.3, frontH: 34, avoid: 46 },
        // 웨이브: n = 잡몹 수(다 나오고 다 쓰러지면 다음 웨이브), mobs = [종류, 무게], mids = [[이 마리 수만큼 나온 뒤, 중간보스 번호(아래 mids.list)]]
        //   restMs = 웨이브를 깨고 다음 웨이브까지 쉬는 시간
        waves: [
          { n: 16, mobs: [['imp', 4], ['bat', 3], ['wolf', 2]], mids: [] },
          { n: 20, mobs: [['imp', 4], ['lizard', 3], ['bat', 2]], mids: [[10, 0]] },
          { n: 22, mobs: [['imp', 4], ['lizard', 3], ['wolf', 2], ['lavagolem', 1]], mids: [[6, 1]] },
          { n: 24, mobs: [['imp', 4], ['lizard', 3], ['bat', 2], ['lavagolem', 1]], mids: [[4, 2], [16, 0]] },
          { n: 28, mobs: [['imp', 5], ['lizard', 3], ['wolf', 2], ['lavagolem', 2]], mids: [[3, 1], [12, 2], [20, 0]] }
        ],
        restMs: 1500,
        // 중간보스(광산과 같은 방식): hp = 체력(판 배율 · 난이도 곱하기 전)
        mids: { hp: 560, list: [['imp', '불꽃 도깨비 대장', null], ['lizard', '용암 도마뱀 대장', 'lava'], ['lavagolem', '용암 골렘 대장', 'lava']] },
        // 강화석(웨이브 몹): 광산보다 조금 적게(보스가 와르르 줌)
        drop: { mob: 0.025, tough: 0.05, mid: [1.5, 2.5] },   // 2026-11-07 절반(예전 5% · 10% · 3~5개)
        // 난이도별: stones · crys = 보스 보상 배율, spawn = 무리 빠르기, alive = 살아 있는 몹 한도, boss = 보스 체력 배율(난이도 hpMul 위에 더)
        modes: { easy: { stones: 1, crys: 1, spawn: 1, alive: 1, boss: 1 }, normal: { stones: 1.5, crys: 1.5, spawn: 1.15, alive: 1.15, boss: 1.1 }, hard: { stones: 2, crys: 2, spawn: 1.3, alive: 1.3, boss: 1.2 } },
        magnet: { r: 48, depth: 28, delayMs: 400, ms: 520, turns: 1.25, shrink: 0.5 },
        // ----- 레이드 보스: 화염룡 이그니스 (js/raid.js) -----
        //   거리 값은 화면 도트(actorScale 로 안 줄임). 부위 상자 · 공격 상자 · 입 위치는 dragon.json(1배 그림 점 x actorScale)
        boss: {
          type: 'ignis', name: '화염룡 이그니스', title: '불의 화산굴의 주인',
          json: 'assets/raid/fire/dragon.json', dir: 'assets/raid/fire/',   // 그림 = dir + 장 이름.png, 효과 = dir + fx/이름.png (HD = assets/hd/raid/fire/…webp)
          hp: 6800,             // 체력(판 배율 hpMul · 난이도 hpMul · modes.boss 곱하기 전)
          lineHp: 200,          // 체력 막대 한 줄 = 이만큼(줄 수 = 체력 / lineHp, 「x34」)
          dmgMul: 1,            // 보스 공격력 배율(판 dmgMul · 난이도 dmgMul 위에)
          groundY: 212,         // 발 밑 바닥 줄(배경 240 줄 기준). 그림은 이 줄에 섬(깊이 순서도)
          viewK: 0.7, fromRight: 170,   // 서는 자리: 보이는 화면 왼쪽 끝 + max(화면 폭 x viewK, 화면 폭 - fromRight) (꼬리는 오른쪽 밖으로 조금)
          wall: 285,            // 플레이어 · 몹이 기준점(몸 가운데 아래)에서 이만큼(1배 그림 점, dragon.json 상자와 같은 단위) 앞까지만 = 앞발 가운데쯤(평타가 발톱에 닿음)
          // 부위 데미지 배율: 머리 · 발톱 = 그대로, 몸 = 줄어듦, 약점(예고 중 빛나는 가슴 · 박힌 머리 · 그로기 머리) = 더
          parts: { head: 1, claw: 1, body: 0.5, weak: 2 },
          // 그로기(파란 막대): 머리 맞으면 head, 약점 맞으면 weak 만큼 참(타 하나마다), 초당 decay 씩 줆. 다 차면 쓰러져 ms 동안 그로기(머리 전체 = 약점)
          groggy: { max: 100, head: 6, weak: 9, decay: 1, ms: 5000 },
          gap: [1000, 1600],    // 공격 사이 쉬는 시간 ms [최소, 최대]
          // 단계: 체력 비율이 skyAt 아래 = 포효 → 날아올라 운석 비 시작 + 도깨비 부름, rageAt 아래 = 격노(예고 x warnK · 쉬는 시간 x gapK · 불길이 쓸고 지나감)
          skyAt: 0.5, rageAt: 0.25, rage: { warnK: 0.8, gapK: 0.65, color: '#ff3a1a' },
          summon: { type: 'imp', n: 4 },
          // 포효(단계 바뀜): 머리에서 r 도트 안 플레이어를 밀어냄(데미지 없음)
          roar: { warnMs: 700, r: 260, push: 120 },
          // 공격(weight = 뽑힐 무게, near = 플레이어가 앞발 앞 near 도트 안이면 무게 x nearK, from = 체력 비율이 이 값 아래부터)
          //   dmg = [최소, 최대](보스 공격력 배율 곱함), heavy = 맞으면 넘어짐, warnMs = 예고(바닥 빨간 표시) 시간
          pats: {
            // 불 뿜기: 목 · 가슴이 달아오름(예고) → 걷는 길 앞쪽 반 또는 뒤쪽 반에 불길(위아래로 비켜서 피함, 점프로는 못 피함). 격노 = 뒤 → 앞으로 쓸고 지나감
            //   tickMs 마다 그 반 안이면 맞음(맞은 뒤 깜빡임 동안은 안 맞음), poolMs = 남는 불바다 그림(데미지 없음)
            breath: { weight: 3, warnMs: 700, fireMs: 1300, tickMs: 160, dmg: [12, 16], flinchMs: 260, knock: 10, poolMs: 2200, segK: 0.8 },
            // 발톱 내려찍기: 앞발 치켜듦(예고, 바닥 빨간 상자 = slam_03 reach) → 쾅(heavy) + 충격파 고리(점프로 피함) → 앞발이 박힌 채 plantMs(때릴 기회)
            slam:   { weight: 3, near: 150, nearK: 2, warnMs: 800, dmg: [24, 30], heavy: true, plantMs: 1500,
                      shock: { speed: 230, band: 9, ry: 0.4, maxR: 520, dmg: [12, 16], dodgeZ: 12, knock: 14 } },
            // 꼬리 쓸기: 오른쪽 끝에서 먼지(예고) → 바닥 낮게 앞으로 크게 쓸음(tail_03 reach, 걷는 길 전체) → 점프(dodgeZ 넘게) 또는 회피 무적으로 피함
            //   2026-11-07 형님(잘 안 보이고 너무 빠름): weight 2 → 3, activeMs 260 → 500 = 쓸기 앞끝이 용 쪽에서 바깥으로 이 시간 동안 걷는 길을 따라 지나감
            //   (앞끝이 지나갈 때 그 자리에서 맞음 → 앞끝이 오는 걸 보고 점프 · 회피). 예고 = 빨간 상자 대신 바닥을 따라 쓸 방향으로 길게 흐르는 노란 화살 줄
            tail:   { weight: 3, near: 260, nearK: 1.5, warnMs: 750, activeMs: 500, dmg: [18, 24], heavy: true, dodgeZ: 14 },
            // 머리 돌진: 플레이어가 선 줄(깊이)을 겨눔(예고 = 그 줄 빨간 띠) → 내리꽂음(bite_02 reach, 위아래 depth) → 빗나가면 stuckMs 동안 머리가 바닥에 박힘(약점),
            //   맞혔으면 hitStuckMs 만. 줄을 바꾸거나 물러나면 피함
            bite:   { weight: 3, near: 220, nearK: 1.5, warnMs: 650, lungeMs: 140, stuckMs: 2000, hitStuckMs: 900, depth: 14, dmg: [28, 34], heavy: true },
            // 용암 바닥: 걷는 길 앞쪽 반 · 뒤쪽 반이 번갈아 끓어오름(예고 warnMs → 분출 eruptMs, tickMs 마다), cycles 번. 낮게 웅크린 머리 = 때릴 기회
            lava:   { weight: 2, from: 0.8, warnMs: 900, eruptMs: 800, cycles: 3, tickMs: 220, dmg: [9, 12], flinchMs: 200 },
            // 날아올라 운석 비(체력 skyAt 아래부터): 날갯짓 돌풍(밀어냄 + 작은 데미지) → 화면 위로 → 운석 n 개(everyMs 마다, 떨어질 자리 빨간 원 warnMs,
            //   절반은 플레이어 자리) → 내려앉음(먼지 · 흔들림). 날아 있는 동안은 안 맞음
            sky:    { weight: 4, from: 0.5, gustMs: 500, gust: { dmg: [6, 8], push: 90, knock: 20 }, riseMs: 600, n: 9, everyMs: 380, warnMs: 950,
                      radius: 30, depth: 15, dmg: [20, 26], heavy: true, dodgeZ: 99, landMs: 700, aimK: 0.5 }
          },
          // 보상: 쓰러지면 불 결정 crys · 강화석 stones 개 [최소, 최대](x 난이도 modes 배율)를 머리 쪽에서 와르르. 바로 빨려 듦(magnet)
          drop: { el: 'fire', crys: [8, 11], stones: [5, 7], burstMs: 900 },   // 2026-11-07 절반(예전 결정 16~22 · 강화석 10~14)
          magnet: { r: 9999, depth: 9999, delayMs: 700, ms: 800, turns: 1.4, shrink: 0.45 },
          deathMs: 2600         // 쓰러지는 그림 뒤 결과까지
        }
      },
      // ===== 속성 시련 6개 (rule 'raid' + trial, 2026-11-07 형님 승인) — 공통 값 = 위 dgTrial, 몹 · 대장 = elMobs.dungeons =====
      //   웨이브 1~5 그 속성 몹 큰 무리 + 대장 → 「OO 수호자」(champ: L = 누구 · amp = 능력 강화). 레이드 보스가 생기면 boss 를 넣으면 됨
      //   amp = 그 속성 능력(elMobs.els)을 이 값으로 덮어씀: 얼음 = 걸으면 빙결 장판 · 번개 = 돌진 자주 · 세게 · 독 = 웅덩이 자주 · 크게 /
      //         바람 = 돌풍 자주 · 멀리 · 세게 · 어둠 = 체력 빨기 2배 · 자주 흐려짐 · 빛 = 빛 퍼짐 자주 · 넓게 · 보호막 길게(self: false = 자기는 안 고침, 둘레 몹만) + 심판의 빛(dmg: 금빛 예고 원 warnMs 뒤 둘레 데미지, 벗어나거나 뛰면 피함)
      // 얼음 동굴(2026-11-08): 웨이브 1~5(속성 시련 그대로) 뒤 레이드 보스 「빙결의 여왕」(js/raid.js Queen, 그림 · 부위 상자 = assets/raid/ice/queen.json, art\raid-ice-queen 에서 복사)
      //   boss 가 있으면 수호자(champ) 대신 보스. 수치 단위 = 화염룡과 같음(거리 = 화면 도트, 부위 상자 = 1배 그림 점 x actorScale)
      ice: dgTrial({ name: '얼음 동굴', desc: '레이드 · 빙결의 여왕', tag: null, el: 'ice', color: '#8fd8ff', bg: BG_DG_ICE, bgTop: '#070910',
        boss: {
          kind: 'queen', type: 'frostqueen', name: '빙결의 여왕', title: '얼음 동굴의 주인',
          json: 'assets/raid/ice/queen.json', dir: 'assets/raid/ice/',   // 그림 = dir + 장 이름.png, 효과 = dir + fx/, 졸개 = dir + minion/ (HD = assets/hd/raid/ice/…webp)
          hp: 6400, lineHp: 200, dmgMul: 1,
          groundY: 212, viewK: 0.7, fromRight: 170,
          wall: 175,            // 플레이어가 기준점(얼음 받침 가운데)에서 이만큼(1배 그림 점) 앞까지만 = 받침 앞쪽(평타가 몸 · 받침에 닿음)
          front: 240,           // 「가까이」 기준(near): 기준점 앞 이만큼(1배)
          // 부위: 머리 = 조금 더, 몸(드레스 · 몸통) = 그대로, 얼음 받침(서 있는 기사가 닿는 낮은 곳) = 절반, 약점(빛나는 손 · 쓰러진 머리) = 2배
          parts: { head: 1.2, body: 1, base: 0.5, weak: 2 },
          groggy: { max: 100, head: 7, weak: 10, decay: 1, ms: 4500 },
          gap: [1000, 1600],
          rageAt: 0.55, rage: { warnK: 0.82, gapK: 0.7, color: '#7fd8ff', cols: ['#ffffff', '#cfeeff', '#7fd8ff'] },   // 2단계(체력 55% 아래): 예고 x warnK · 쉬는 시간 x gapK
          summon: { type: 'wolf', n: 0 },   // (main.js 가 그림을 미리 부르는 값. 여왕은 conjure 로 얼음 정령을 부름)
          enter: { rumbleMs: 1000, formMs: 900, roarMs: 1400 },
          roar: { warnMs: 700, r: 300, push: 110, chillMs: 1500 },   // 포효: 입에서 r 도트 안 = 밀어냄 + 얼어붙음(데미지 없음)
          // 얼음 정령(conjure 로 2 마리): hp = 체력(여왕과 같은 배율), dmg = 할퀴기, 쓰러지면 경험치(단단한 잡몹)
          minion: { name: '얼음 정령', hp: 75, speedX: 46, speedY: 30, cooldown: [1300, 2100], dmg: [7, 9] },
          pats: {
            // 눈보라(cast, 2026-11-08 형님 3 · 4차): 손이 빛남(약점) → 팔 듦(예고 = 바닥 빨강) → 눈 그림은 화면 전체. 걷는 길 거의 전부가 위험,
            //   위 또는 아래 끝(매번 무작위) safe 도트 띠(≈ 한 줄)만 안전(점프로는 못 피함). tickMs 마다 그 띠 밖이면 맞음 + 얼어붙음(chillMs)
            //   그림(코드로 그림): feather = 안전 띠 경계 빨강이 흐려지는 폭(도트), haze = 흰 안개 진하기, wind = 바람 속도(도트/초), flakes = 눈송이 수, puffs = 안개 뭉치 수, wisps = 바람결 곡선 수
            blizzard: { weight: 3, warnMs: 1050, fireMs: 1400, tickMs: 200, dmg: [7, 9], flinchMs: 160, knock: 6, chillMs: 1600,
                        safe: 20, feather: 10, haze: 0.4, wind: 270, flakes: 560, puffs: 18, wisps: 26 },
            // (얼음 창 던지기 spear = 2026-11-08 형님: 이상한 화살 같아서 뺌. 코드는 raid.js 에 남아 있음 — 여기 spear 값을 다시 넣으면 다시 나옴)
            // 고드름 비(summon): 지팡이 듦(바닥 빨간 원) → 원마다 everyMs 씩 고드름이 fallMs 동안 떨어져 깨짐(점프로 못 피함). n = 1단계 수, n2 = 2단계 수, aimK = 플레이어를 노리는 비율
            icicle:   { weight: 3, warnMs: 850, fallMs: 340, fallH: 170, everyMs: 120, n: 6, n2: 8, aimK: 0.5, radius: 20, depth: 10, dodgeZ: 99, dmg: [14, 18], knock: 10, flinchMs: 320, k: 0.7 },
            // 지팡이 내려찍기(stomp): 지팡이 머리 위(예고 = 줄 빨간 자국) → 쾅 → 얼음 가시가 줄을 따라 gap 도트 · delayMs 씩 솟으며 왼쪽 끝까지(점프 dodgeZ 넘게 · 회피 · 줄 바꾸기로 피함)
            //   life = 가시 하나 [예고 · 솟음 · 다 솟음 · 들어감] ms(솟음 · 다 솟음 동안만 맞음), hitW = 가시 하나 맞는 가로 반폭, k = 가시 그림 크기
            stomp:    { weight: 3, near: 160, nearK: 1.6, warnMs: 750, holdMs: 700, gap: 24, delayMs: 70, life: [140, 90, 300, 180], hitW: 12, depth: 11, dodgeZ: 14, k: 0.42,
                        dmg: [18, 24], heavy: true, knock: 14 },
            // (2단계) 얼음 벽 + 정령(conjure): 예고 = 생길 자리 빨간 원 → 벽(받침 앞 dist 도트, hp · ms 뒤 저절로 깨짐, 길 · 마법을 막음, 때려서 부숨) + 정령 minions 마리(벽 앞 minionDx 간격)
            conjure:  { weight: 3, phase2: true, warnMs: 800, wall: { dist: 58, hp: 240, ms: 6500 }, minions: 2, minionDx: 34 },
            // (2단계) 순간이동(teleport, 2026-11-08 형님: 오른쪽에만 있으면 지루함): 플레이어 반대편(싸움터 오른쪽 ↔ 왼쪽, 왼쪽이면 그림 · 공격 방향 뒤집음)으로.
            //   ms = [부서짐, 눈기둥(무적 · 사라짐) = 도착할 곳 눈 소용돌이 예고, 다시 모임(무적), 나타남] → 바로 내려찍기 또는 눈보라(예고 + followMs)
            teleport: { weight: 2, phase2: true, near: 120, nearK: 2.2, warnMs: 300, ms: [300, 600, 380, 300], followMs: 220 }
          },
          drop: { el: 'ice', crys: [8, 11], stones: [5, 7], burstMs: 900 },
          magnet: { r: 9999, depth: 9999, delayMs: 700, ms: 800, turns: 1.4, shrink: 0.45 },
          deathMs: 3400
        },
        champ: { L: ['yeti', '얼음 수호자', 'el_ice'], scale: 1.75, hp: 3200, dmgMul: 3.8, adds: { firstMs: 5000, everyMs: 8000, n: 5, max: 9 },
                 amp: { walk: { art: 'ice_puddle', every: 50, chance: 0.75, cd: 1500, ms: 4200, r: 24, depth: 9, chill: true, k: 1.05 },
                        death: { ground: { art: 'ice_puddle', ms: 6000, r: 40, depth: 14, chill: true, k: 1.6 } } } } }),
      lightning: dgTrial({ name: '번개 첨탑', desc: '속성 시련 · 번개 수호자', el: 'lightning', color: '#ffe14a', bg: BG_DG_THUNDER, bgTop: '#05060b',
        champ: { L: ['wolf', '번개 수호자', 'el_lightning'], scale: 2.1, dmgMul: 1.5,
                 amp: { dash: { range: [40, 200], depth: 18, cd: [2400, 3600], firstCd: [1000, 1600], windMs: 400, ms: 420, speedK: 6, dmg: [7, 9], knock: 16, flinchMs: 260, trailMs: 50 } } } }),
      poison: dgTrial({ name: '독 늪지', desc: '속성 시련 · 독 수호자', el: 'poison', color: '#8cff3a', bg: BG_DG_POISON, bgTop: '#050706',
        champ: { L: ['lizard', '독 수호자', 'el_poison'], hp: 2200, dmgMul: 1,
                 amp: { walk: { art: 'poison_puddle', every: 50, chance: 0.65, cd: 1800, ms: 4200, r: 26, depth: 9, poison: true, k: 0.95 },
                        death: { gas: { art: 'poison_gas', ms: 4000, r: 44, depth: 18, poison: true, k: 1.5 } } } } }),
      wind: dgTrial({ name: '바람 협곡', desc: '속성 시련 · 바람 수호자', el: 'wind', color: '#9ff5d2', bg: BG_DG_WIND, bgTop: '#0d1414',
        champ: { L: ['wolf', '바람 수호자', 'el_wind'], scale: 2.1, dmgMul: 1.9,
                 amp: { speed: 1.2, gust: { range: 96, depth: 22, cd: [1900, 2900], firstCd: [900, 1600], push: 52 }, hit: { push: 28 } } } }),
      darkness: dgTrial({ name: '어둠 신전', desc: '속성 시련 · 어둠 수호자', el: 'darkness', color: '#b070ff', bg: BG_DG_DARK, bgTop: '#030106',
        champ: { L: ['soldier', '어둠 수호자', 'el_darkness'], scale: 1.9, hp: 3000, dmgMul: 2.6,
                 amp: { stealth: { cd: [2600, 4000], ms: 1500, alpha: 0.2, fadeMs: 260 }, hit: { drain: 1.2 } } } }),
      light: dgTrial({ name: '빛의 성소', desc: '속성 시련 · 빛의 수호자', el: 'light', hpMul: 0.78, color: '#f0c850', bg: BG_DG_LIGHT, bgTop: '#1c1814',
        champ: { L: ['ghost', '빛의 수호자', 'el_light'], scale: 1.9, hp: 2800, dmgMul: 3.6, adds: { firstMs: 5000, everyMs: 8000, n: 5, max: 9 }, tint: { bright: 1.12, colorK: 0.5 },
                 amp: { pulse: { cd: [3000, 4200], firstCd: [1500, 2500], r: 110, depth: 34, heal: 0.05, self: false, shieldMs: 1600, shield: 0.55,
                                 dmg: [3, 4], warnMs: 550, knock: 12, flinchMs: 220 } } } })
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

    // ---------- 첫 무기 몽둥이 (2026-11-06, 형님 승인): 견습(전직 전 맨손)이 1판에서 줍는 첫 무기 ----------
    //   나오는 때: 첫 판(판 목록 맨 앞, 난이도 상관없음)에서 아직 견습(전직 전 · 견습 옷) + 몽둥이가 없을 때 잡몹이 쓰러지면 chance 확률,
    //     그 판에서 sureAt 번째 잡몹이면 꼭(보스·중간보스·보스와 같이 쓰러진 졸개는 안 셈). 바닥에 하나 있으면 더 안 나옴, 사라지지 않음
    //   주움 = 물약처럼 밟으면 바로 → 「몽둥이 획득!」 + 저장칸에 기억(growth.js club). 그 뒤 견습 맨손 타(무기 fist)가 atk 만큼 더 셈(소품은 그대로)
    //   전직하면 상관없음(기사 검 · 법사 지팡이는 따로). 그림 = props.js 가 코드로 그리는 도트 몽둥이(바닥에서 둥실 + 둘레 빛 + 반짝)
    //   손에 든 그림은 아직 없음(그림은 나중에, 형님). HUD 얼굴 액자 옆 작은 몽둥이 + 능력치 창 「무기: 몽둥이 (공격 +35%)」
    //   자동 조종 시험(1·2판 견습 Lv1, 몽둥이 있음 / 없음)으로 확인: 쉬워지지만 너무 쉽지는 않게
    club: {
      atk: 0.35,                       // 맨손 공격 +35% (맨손 8~11 → 약 11~15, 기사 검과 비슷)
      chance: 0.3,                     // 잡몹 하나 쓰러질 때 나올 확률
      sureAt: 4,                       // 그 판에서 4번째 잡몹이면 꼭(3번째까지 나올 확률 약 66%)
      pickup: { r: 16, depth: 12 },    // 줍는 거리(가로 · 위아래, 물약과 같음)
      pickupDelayMs: 300,              // 떨어지고 이만큼 지나야 주움
      hop: 30,                         // 튀어 오르는 높이
      shadow: 8,                       // 그림자 폭
      glow: ['#fff2b0', '#ffb84a']     // 둘레 빛 [가운데, 바깥]
    },

    // ---------- 무기 강화 · 속성 부여 (2026-11-06, 형님 승인. 기획성장시스템-설계안.md 「무기 강화·속성」) ----------
    //   직업마다 무기 하나(기사 = 검, 법사 = 지팡이), 전직 때 받음. 줍기·바꾸기·빼기 없음. 견습(몽둥이)은 강화 없음
    //   계산·저장 = growth.js(Growth.weapon), 효과·오라·바닥 줍기 = js/enchant.js, 창 = main.js 「강화」
    //   강화 +0 → +10: 강화석(stones)을 cost 만큼 쓰고 rate 확률로 성공. 실패 = 강화석만 사라짐(깨짐·내려감 없음). 배열 = +1 ~ +10 으로 올릴 때
    //     기대 강화석(실패 포함): +3 = 5개, +6 = 약 18개, +9 = 약 48개, +10 = 약 72개
    //   perLv = 1 강화마다 기사 물리 · 법사 마법 공격 +6%
    //   bonus = 단계 덤(그 강화 이상이면 늘 켜짐): crit = 치명타 확률 +, atkSpd = 휘두르기 빠르기 +, cd = 기술 쿨타임 -, mp = 기술 마나 -,
    //     reach = 공격 범위(평타 판정 · 기술 크기) +, mpRegen = 마나 회복 +, castSpd = 기술 동작 빠르기 +, area = 마법 범위(기술 크기 · 마법탄 터짐) +
    //   slotLv = 속성 칸이 열리는 강화(+3 · +6 · +9)
    //   art = 강화 단계별 무기 그림(art.weapons 이름, +0 일반 · +3 희귀 · +6 영웅 · +9 전설 · +10 신화). 그림이 아직 없으면 한 단계 아래 그림.
    //     법사 여자(완드)도 등급 그림은 지팡이(그림이 지팡이만 있음)
    enchant: {
      maxLv: 10,
      rate: [1, 1, 1, 0.8, 0.8, 0.8, 0.6, 0.6, 0.6, 0.4],
      //   2026-11-07 형님(하룻저녁에 +10): +7 ~ +10 비싸게 5 6 7 10 → 8 10 12 18 (확률은 그대로)
      cost: [1, 2, 2, 3, 3, 4, 8, 10, 12, 18],
      perLv: 0.06,
      bonus: {
        knight: { 3: { crit: 0.05 }, 6: { atkSpd: 0.08 }, 9: { cd: 0.1, mp: 0.1 }, 10: { reach: 0.1 } },
        mage:   { 3: { mpRegen: 0.15 }, 6: { castSpd: 0.1 }, 9: { cd: 0.1, mp: 0.1 }, 10: { area: 0.1 } },
        archer: { 3: { crit: 0.05 }, 6: { atkSpd: 0.08 }, 9: { cd: 0.1, mp: 0.1 }, 10: { reach: 0.1 } }   // 궁수(2026-11-09): reach = 화살 사거리 +
      },
      slotLv: [3, 6, 9],
      art: {
        knight: [[0, 'sword_common'], [3, 'sword_rare'], [6, 'sword_epic'], [9, 'sword_legendary'], [10, 'sword_mythic']],
        mage:   [[0, 'staff_common'], [3, 'staff_rare'], [6, 'staff_epic'], [9, 'staff_legendary'], [10, 'staff_mythic']],
        archer: []   // 궁수 활은 그림에 박혀 있어 강화 단계 그림 없음(속성은 화살 빛으로, js/archer.js)
      },
      // 2차 갈래 전용 무기 그림(2026-11-09 형님 「전용무기 만들어보자」): artBranch[직업][갈래] 가 있으면 2차 Lv 뒤 그 갈래는 이 목록(없으면 위 art)
      //   기사 b 마검사 = 검은 마검 / 법사 b 흑마법사 = 해골 지팡이(여자도 지팡이 그림 — 위 art 와 같은 방식). 성기사(a) · 대마법사(a) = 위 기존 그림
      //   궁수 갈래 활 그림(art/weapons-branch/bow_*)은 미리 만들어만 둠(활이 몸 그림에 박혀 있어 아직 안 붙임)
      artBranch: {
        knight: { b: [[0, 'sword_dark_common'], [3, 'sword_dark_rare'], [6, 'sword_dark_epic'], [9, 'sword_dark_legendary'], [10, 'sword_dark_mythic']] },
        mage:   { b: [[0, 'staff_dark_common'], [3, 'staff_dark_rare'], [6, 'staff_dark_epic'], [9, 'staff_dark_legendary'], [10, 'staff_dark_mythic']] }
      },
      tierName: [[0, '일반'], [3, '희귀'], [6, '영웅'], [9, '전설'], [10, '신화']],
      // ---- 속성 7가지: 칸마다 하나(같은 속성 두 번 안 됨), 끼운 속성은 전부 함께 켜짐. 부여 · 바꾸기 = 그 속성 결정 setCost[칸] 개(언제든) ----
      //   2026-11-07 형님(하룻저녁에 속성 다 모음): 1개 → 1번 칸 5개 · 2번 칸 10개 · 3번 칸 20개
      setCost: [5, 10, 20],
      //   col = 오라 · 불티 · 결정 색, short = 고르는 창 한 줄 설명
      order: ['fire', 'ice', 'lightning', 'poison', 'wind', 'darkness', 'light'],
      el: {
        fire:      { name: '불',   col: '#ff6a10', col2: '#ffc23a', short: '맞으면 2초 동안 불타요(센 화상)' },
        ice:       { name: '얼음', col: '#7cc8ff', col2: '#e8f8ff', short: '맞으면 느려지고, 여러 번 맞으면 잠깐 얼어요' },
        lightning: { name: '번개', col: '#4aa8ff', col2: '#fff4a0', short: '가끔 번개가 옆 적 2마리에게 튀어요' },
        poison:    { name: '독',   col: '#5cff2a', col2: '#c8ff7a', short: '독이 5번까지 쌓이고, 쓰러지면 옆으로 퍼져요' },
        wind:      { name: '바람', col: '#6ff0cc', col2: '#e6fff8', short: '공격이 빨라지고 적이 더 멀리 밀려요' },
        darkness:  { name: '어둠', col: '#7a2cff', col2: '#c890ff', short: '치명타가 더 자주, 더 세게 터져요' },
        light:     { name: '빛',   col: '#ffcf55', col2: '#fffbe0', short: '준 피해의 일부만큼 체력이 차요' }
      },
      // 효과 수치(자동 조종 시험으로 맞춤). 데미지 % 는 「그 타의 데미지」 기준
      //   fire: 맞을 때마다 pct 만큼 화상 남은 양에 더함(최대 cap = 그 타의 몇 배), ms 동안 tick 마다 나눠서 깎음(새로 맞으면 시간 다시)
      //   poison: 한 번 맞을 때마다 독 1겹(최대 max), 겹마다 tick 마다 pct. ms 동안(새로 맞으면 다시). 독 걸린 적이 쓰러지면 r 안 적 spreadN 마리에 겹 절반 옮김
      //   ice: slow = 느려진 적의 시간 배율(0.7 = 30% 느려짐) ms 동안, 보스·중간보스는 bossSlow. freezeHits 번 맞으면 freezeMs 얼음(보스·중간보스 빼고), 그 뒤 freezeCdMs 동안 다시 안 얼음
      //   lightning: chance 확률로 r 안 다른 적 n 마리에게 pct 데미지(튄 번개는 다시 안 튐). capPerSec = 1초에 튀는 최대 수(몹 떼에서 화면이 번개로 뒤덮이지 않게)
      //   wind: atkSpd = 휘두르기 +, knock = 밀려나는 거리 배 / darkness: crit = 치명타 확률 +, critDmg = 치명타 배율 +
      //   light: pct = 준 데미지의 몇 %를 체력으로, capPerSec = 1초에 최대 체력의 몇 %까지만
      fx: {
        fire:      { pct: 0.2, cap: 0.6, ms: 2000, tick: 500 },
        poison:    { pct: 0.03, max: 5, ms: 4000, tick: 500, r: 80, spreadN: 3 },
        ice:       { slow: 0.7, ms: 1500, bossSlow: 0.88, freezeHits: 6, freezeMs: 900, freezeCdMs: 3000 },
        lightning: { chance: 0.25, n: 2, r: 85, pct: 0.5, capPerSec: 10 },
        wind:      { atkSpd: 0.1, knock: 1.3 },
        darkness:  { crit: 0.08, critDmg: 0.3 },
        light:     { pct: 0.03, capPerSec: 0.025 }
      },
      mageBasic: 0.5,       // 법사 지팡이 평타(마법탄 포함)는 원소 효과(화상·독·튀는 번개·흡혈 양)가 이만큼(기술이 주인공)
      // 원소 공명(법사): 기술 자체 속성(숫자 모양 damageStyle → 속성)이 끼운 속성과 같으면 그 기술 데미지 +resonance
      resonance: 0.2,
      skillEl: { skill_fire: 'fire', skill_ice: 'ice', skill_bolt: 'lightning' },
      // 지속 피해 숫자: 적마다 tick 한 번에 하나(합친 값), 화면 전체 gapMs 동안 max 개까지만(몹 떼에서 숫자가 뒤덮지 않게)
      dotNum: { gapMs: 250, max: 6 },
      // ---- 얻는 곳 ----
      //   강화석: 잡몹 쓰러질 때 mob 확률(단단한 잡몹 = tough), 중간보스 mid 개, 보스 boss 개(꼭). 확률·개수 x 난이도 modes.drop(노말 1.25 · 하드 1.5)
      //   속성 결정: 판을 깨면 그 판 속성(stageEl[판 id][0]) clear 개 + 보스가 둘째 속성(stageEl[판 id][1]) boss 개를 떨어뜨림. 개수 x 난이도 crys(노말 1.5 · 하드 2)
      //   판 속성(2026-11-06): 숲 = 바람 · 폐광 = 번개 · 늪 = 독 · 사막 유적 = 빛 · 설산 = 얼음 · 해적 항구 = 바람 · 화산 = 불 · 유령 고성 = 어둠 · 요새 = 불 · 마왕성 = 어둠
      //     둘째(보스) 속성으로 3판까지 7가지 중 6가지, 5판까지 전부 나옴
      //   2026-11-07 형님(너무 많이 모임): 강화석 잡몹 1.2% → 0.6% · 단단한 잡몹 4% → 2% · 중간보스 1개 → 50% 확률로 1개(mid 0.5) · 보스 2 → 1개,
      //     판 깸 결정 2 → 1개(보스 둘째 속성 1개 그대로). 난이도 배율(drop · crys)은 예전처럼 곱함(소수 = 그 확률로 하나 더)
      drop: { mob: 0.006, tough: 0.02, mid: 0.5, boss: 1, clear: 1, bossCrys: 1, crys: { easy: 1, normal: 1.5, hard: 2 } },
      stageEl: { 1: ['wind', 'light'], 2: ['lightning', 'fire'], 3: ['poison', 'darkness'], 4: ['light', 'poison'], 5: ['ice', 'wind'],
                 6: ['wind', 'ice'], 7: ['fire', 'darkness'], 8: ['darkness', 'ice'], 9: ['fire', 'lightning'], 10: ['darkness', 'light'],
                 11: ['poison', 'darkness'], 12: ['darkness', 'poison'], 13: ['lightning', 'ice'], 14: ['ice', 'lightning'], 15: ['ice', 'wind'],
                 16: ['wind', 'ice'], 17: ['wind', 'light'], 18: ['light', 'wind'], 19: ['darkness', 'fire'], 20: ['darkness', 'light'] },
      // 바닥에 떨어진 강화석·결정(코드로 그린 도트): 밟으면 주움(물약과 같음). 사라지지 않음, 판을 깨면 남은 것은 저절로 주움
      pickup: { r: 18, depth: 13 }, pickupDelayMs: 300, hop: 26, shadow: 6
    },

    // 먼지 효과(오크 돌진): 112x64, 바닥 가운데 기준
    dust: { frames: seq('assets/fx/dust_', 5), pivot: { x: 56, y: 60 }, fps: 12 },

    // ---------- 조작 ----------
    keys: {
      left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
      up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
      attack: ['KeyJ', 'KeyZ'],
      // 점프 (2026-11-03). 달리기 = 좌/우를 빠르게 두 번(CFG.move.doubleTapMs). 2026-11-07 PC 아래 막대: Space 가 대표(첫 키), K·X 도 그대로
      jump: ['Space', 'KeyK', 'KeyX'],
      // 기술 칸 1~10 (2026-11-07 PC 아래 막대, 형님 승인): 숫자 1~5 = 아래 줄 1~5번 칸, 6 7 8 9 0 = 위 줄 6~10번 칸. 첫 키 = 막대에 쓰는 글자
      //   예전 U I O P 는 1~4번 칸에 그대로(오른손). 예전 왼손 C V B N 은 뺌 → C · V · B 는 능력치 · 기술 · 강화 창(아래 stat · skill · enc)
      skillA: ['Digit1', 'Numpad1', 'KeyU'],
      skillB: ['Digit2', 'Numpad2', 'KeyI'],
      skillC: ['Digit3', 'Numpad3', 'KeyO'],
      skillD: ['Digit4', 'Numpad4', 'KeyP'],
      skillE: ['Digit5', 'Numpad5'],
      skillF: ['Digit6', 'Numpad6'],
      skillG: ['Digit7', 'Numpad7'],
      skillH: ['Digit8', 'Numpad8'],
      skillI: ['Digit9', 'Numpad9'],
      skillJ: ['Digit0', 'Numpad0'],
      // 각성(2026-11-06 밤, 분노 100%): 오른손 = J·K 옆 L, 왼손 = F
      awaken: ['KeyL', 'KeyF'],
      // 회피(2026-11-07): Shift(왼손·오른손 둘 다) + 오른손 J K L 옆 ; (K 는 이미 점프라 안 씀)
      dodge: ['ShiftLeft', 'ShiftRight', 'Semicolon'],
      // 창 열기(2026-11-07 PC 아래 막대 오른쪽 버튼): 능력치 C · 기술 V · 강화 B (왼손 Z·X 옆, 움직이기·싸우기 키와 안 겹침) · 설정 Esc.
      //   소리 끄기/켜기 = M (js/sfx.js). 같은 키를 다시 누르면 그 창이 닫힘
      stat: ['KeyC'], skill: ['KeyV'], enc: ['KeyB'], menu: ['Escape']
    },
    // PC 아래 도움말 글자(2026-11-07): 처음 plays 번 켤 때만 보임(× 로 닫으면 안 보임). 설정 창에서 다시 켬
    help: { plays: 3 },

    // ---------- 직업 기술 (위 SKILLS 설명 참고) ----------
    // bufferMs = 미리 눌러 둔 기술 입력 기억 시간, cancelAfterHit = 보통 콤보 타의 판정이 끝난 장부터 기술로 끊을 수 있음
    // 성장 4단계(2026-11-06): 기술 = 마나 + 쿨타임. 기술 창(main.js)에서 기술 점수로 Lv1 → 5, 칸에 끼움. 계산·저장 = growth.js 의 기술 책(Growth.book)
    //   tree = 직업마다 기술 10개(위 SKILL_TREE). 전직하면 unlock 0 기술이 Lv1, 레벨이 오르면 저절로 열림(Lv1), 점수로 Lv5 까지
    //   perLv = 전직 뒤 레벨마다 기술 점수(예전 저장 = 지금 Lv - 전직 Lv, 전직 Lv 를 모르면 classLv). maxLv = 기술 최고 Lv
    //   slots = 기술 칸 수 [처음, moreLv[0] 부터, moreLv[1] 부터, …] (폰 = 공격 둘레 반달 동그라미, PC = 아래 막대 아래 줄 1~5)
    //     2026-11-06 밤 콤보: Lv10 에 3번째 칸(띄우기 기술 올려베기·땅 융기가 열리면서 바로 끼워짐, 2026-11-06 Lv9 → 10), Lv13 에 4번째 칸
    //     2026-11-07(형님 승인): Lv15 에 5번째 칸(대지 내려찍기·메테오가 열리는 Lv). 폰 = 5칸까지
    //     2026-11-08 형님: 폰 = 7칸(6 · 7번 칸 = 반달 바깥 줄, PC 아래 막대 6 · 7번과 같은 칸). Lv15 에 5 → 7칸(slotsAllOpen 이면 전직하면 다 열림)
    //   pcSlots · pcLv = PC 아래 막대 위 줄(6~10번 칸): Lv15(5번째 칸과 같이)에 한꺼번에 열림 → PC 는 10칸.
    //     1~5번 칸은 폰과 같은 Lv 에 열림. 칸 순서는 PC · 폰이 하나(폰은 앞 7칸만 보임, 2026-11-08). PC 는 회피도 칸에 끼울 수 있음(Shift 는 늘 회피)
    //   cancel = 캔슬(콤보, 2026-11-06 밤): 평타 1·2·3타는 판정 장에 들어선 뒤(이미 맞힌 뒤)부터 기술로 끊고 나감(fromActive).
    //     기술 끝무렵(그 기술의 마지막 판정·발사 + padMs 부터, 기술마다 chainFrom = 장 번호로 바꿀 수 있음)에 다른 기술로 이어짐.
    //     한 번 이어지는 동안 같은 기술은 한 번만 → 같은 기술로 되돌아가는 무한 반복 없음(쿨타임도 있음). 점프 착지 웅크림에서도 기술 나감
    //   curve = 기술 Lv1~5 배율: dmg = 데미지(맞는 모든 판정에 곱함), cd = 쿨타임, mp = 마나 (마나는 반올림, 쿨타임은 0.1초 단위)
    //     Lv5 는 거기에 더해 기술마다 lv5(크기 +·두 번 날림 등, say = 기술 창에 쓰는 말)
    //   noMpMs = 마나가 모자랄 때 「MP 부족」 글자를 다시 띄우기까지 최소 간격
    //   test = 시험 버튼(견습/기사/법사)으로 저장된 직업과 다른 직업을 입었을 때: 이번 창에서만 이번에 만든 기술 전부 Lv1 + 칸 4개 +
    //     기술 점수 pts 점(Lv5 까지 올려 보기). 저장 안 함(저장된 직업의 기술 책은 그대로)
    //   botPlan = 시험용(GAME.test.skillSetup): 기술 점수를 이 순서로 돌아가며 1점씩
    skills: { bufferMs: 300, cancelAfterHit: true, knight: SKILLS.knight, mage: SKILLS.mage, archer: SKILLS.archer,
              cancel: { fromActive: true, padMs: 60 },
              // 2026-11-07 형님: 저절로 배우기 · 저절로 끼우기 없앰. 기술 점수 = 전직 때 firstPts(1) + 그 뒤 레벨마다 perLv(1).
              //   그 기술 Lv(unlock)가 되면 「배울 수 있음」 → 1점으로 배움(기술 Lv1) → 점수로 Lv5 까지. 늘 켜진 기술도 같음.
              //   처음 배운 쓰는 기술은 빈 칸이 있으면 그 칸에 끼움(배우기는 플레이어가 고른 것). 초기화 = 쓴 점수 전부 돌려받음(배운 것도 다 지움)
              //   slotsAllOpen = 전직하면 기술 칸 전부 열림(폰 7 · PC 10). 견습은 그대로 잠김. 아래 slots · moreLv · pcLv 는 false 로 되돌릴 때 쓰는 값
              // 2026-11-07 형님: 기술 무적 없앰 → 슈퍼아머(superArmor). 기술 쓰는 동안 맞으면 데미지는 그대로 받지만 움찔 · 밀림 · 넘어짐 · 잡힘 없이 기술이 끝까지 나감
              //   (무거운 보스 타도 데미지만). armorNoHitMs = 한 번 맞은 뒤 아주 잠깐 안 맞음(한 장면에 여러 번 겹쳐 맞지 않게). 완전 무적은 회피 · 각성만
              //   기술마다 적힌 iframes 는 남겨 둠(superArmor 를 false 로 하면 예전처럼 무적)
              superArmor: true, armorNoHitMs: 150,
              learn: true, firstPts: 1, slotsAllOpen: true,
              branchFx: BRANCH_FX, brBurst: BR_BURST,   // 갈래 맛(2026-11-08, 위 BRANCH_FX)
              // 2026-11-07 형님: 견습 기본기 noviceSkill(올려치기, 위 SKILLS.novice) → 전직하면 basic[직업](기사 올려베기 · 법사 땅 융기)으로 바뀜:
              //   전직 때 공짜 Lv1(기술 점수 안 씀, unlock Lv 무시) + 1번 칸. Lv2~5 는 보통처럼 점수. 초기화해도 Lv1 은 남음
              noviceSkill: 'nupper', basic: { knight: 'upper', mage: 'rise', archer: 'upshot' },
              novice: SKILLS.novice,
              tree: SKILL_TREE, perLv: 1, maxLv: 5, classLv: 7, slots: [2, 3, 4, 5, 7], moreLv: [10, 13, 15, 15], pcSlots: 10, pcLv: 15, noMpMs: 500,
              curve: { dmg: [1, 1.2, 1.4, 1.6, 1.85], cd: [1, 0.94, 0.88, 0.82, 0.75], mp: [1, 1.05, 1.1, 1.15, 1.2] },
              test: { pts: 24 },
              botPlan: { knight: ['dash', 'upper', 'nimble', 'wave', 'mastery', 'spin', 'skin', 'slam', 'shards', 'thrust', 'pressure', 'grit', 'counter', 'storm', 'aegis', 'holy', 'cross', 'charge', 'arcwave', 'infuse', 'rift', 'msword', 'unleash'],
                         archer: ['pshot', 'upshot', 'nimble', 'multi', 'aim', 'rain', 'focus', 'leap', 'split', 'burst', 'volley', 'gale', 'mark', 'snipe', 'deadeye', 'ballista', 'rapid', 'skyfall', 'tempest', 'hawk', 'trap', 'twister', 'barrage'],   // 궁수(2026-11-09)
                         mage: ['fireball', 'rise', 'nimble', 'bolt', 'amp', 'ice', 'flow', 'blink', 'eshard', 'gravity', 'vortex', 'shield', 'brand', 'meteor', 'echain', 'pillar', 'frost', 'judgment', 'darkorb', 'leech', 'swamp', 'wraith', 'abyss'] } },   // 2026-11-08 갈래 B 기술도(고른 갈래 것만 배워짐)   // 법사 다시 배치(2026-11-08)

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
    // 성기사(남, 2026-11-07): 기술 동작 = 기사 남과 같은 동작 · 시간, 그림만 성기사 폴더(없는 동작은 기사 그림), 손 위치 = anchors_motions_knight_t2_male.json
    var T2 = C.art.characters.knight_t2_male, K1 = C.motions.knight_male;
    if (T2 && K1) {
      Object.keys(K1).forEach(function (m) {
        if (!(K1[m].count > 0)) return;
        var dir = KNIGHT_T2_MALE_ANIMS.indexOf(m) >= 0 ? T2.t2Dir : 'assets/chars/stage1/knight_male/';
        T2.anims[m] = { frames: seq(dir + m + '_', K1[m].count), fps: 14, loop: false };
      });
      T2.motionAnchors = 'assets/chars/stage1/anchors_motions_knight_t2_male.json';
    }
    // 성기사(여, 2026-11-07): 같은 방식. 기술 동작 = 기사 여와 같은 동작 · 시간, 그림만 성기사 여 폴더
    var T2F = C.art.characters.knight_t2_female, K1F = C.motions.knight_female;
    if (T2F && K1F) {
      Object.keys(K1F).forEach(function (m) {
        if (!(K1F[m].count > 0)) return;
        var dir = KNIGHT_T2_FEMALE_ANIMS.indexOf(m) >= 0 ? T2F.t2Dir : 'assets/chars/stage1/knight_female/';
        T2F.anims[m] = { frames: seq(dir + m + '_', K1F[m].count), fps: 14, loop: false };
      });
      T2F.motionAnchors = 'assets/chars/stage1/anchors_motions_knight_t2_female.json';
    }
    // 대마법사(남, 2026-11-08): 같은 방식. 기술 동작 = 법사 남과 같은 동작 · 시간, 그림만 대마법사 폴더, 손 위치 = anchors_motions_mage_t2_male.json
    var MT2 = C.art.characters.mage_t2_male, M1 = C.motions.mage_male;
    if (MT2 && M1) {
      Object.keys(M1).forEach(function (m) {
        if (!(M1[m].count > 0)) return;
        var dir = MAGE_T2_MALE_ANIMS.indexOf(m) >= 0 ? MT2.t2Dir : 'assets/chars/stage1/mage_male/';
        MT2.anims[m] = { frames: seq(dir + m + '_', M1[m].count), fps: 14, loop: false };
      });
      MT2.motionAnchors = 'assets/chars/stage1/anchors_motions_mage_t2_male.json';
    }
    // 대마법사(여): 같은 방식(법사 여 동작 · 시간, 그림만 대마법사 여 폴더, 손 위치 = anchors_motions_mage_t2_female.json)
    var MT2F = C.art.characters.mage_t2_female, M1F = C.motions.mage_female;
    if (MT2F && M1F) {
      Object.keys(M1F).forEach(function (m) {
        if (!(M1F[m].count > 0)) return;
        var dir = MAGE_T2_FEMALE_ANIMS.indexOf(m) >= 0 ? MT2F.t2Dir : 'assets/chars/stage1/mage_female/';
        MT2F.anims[m] = { frames: seq(dir + m + '_', M1F[m].count), fps: 14, loop: false };
      });
      MT2F.motionAnchors = 'assets/chars/stage1/anchors_motions_mage_t2_female.json';
    }
    // 갈래 b(마검사 · 흑마법사, 2026-11-09): 같은 방식. 기술 동작 = 1차 옷과 같은 동작 · 시간, 그림만 갈래 b 폴더, 손 위치 = anchors_motions_<옷>_t2b_<성별>.json
    T2B_DONE.forEach(function (k) {
      var cls = k.split('_')[0], who = k.split('_')[1];
      var D = C.art.characters[cls + '_t2b_' + who], M1 = C.motions[cls + '_' + who];
      if (!D || !M1) return;
      Object.keys(M1).forEach(function (m) {
        if (!(M1[m].count > 0)) return;
        var dir = T2B_ANIMS[cls].indexOf(m) >= 0 ? D.t2Dir : 'assets/chars/stage1/' + cls + '_' + who + '/';
        D.anims[m] = { frames: seq(dir + m + '_', M1[m].count), fps: 14, loop: false };
      });
      D.motionAnchors = 'assets/chars/stage1/anchors_motions_' + cls + '_t2b_' + who + '.json';
    });
    // 궁수 2차 옷(2026-11-09): 기술 동작 = 1차 궁수와 같은 동작 · 시간, 그림만 2차 폴더, 손 위치 = anchors_motions_archer_<갈래>_<성별>.json
    ARCHER_T2_DONE.forEach(function (k) {
      var who = k.split('_')[1], name = 'archer_' + k, D = C.art.characters[name], M1 = C.motions['archer_' + who];
      if (!D || !M1) return;
      Object.keys(M1).forEach(function (m) { if (M1[m].count > 0) D.anims[m] = { frames: seq(D.t2Dir + m + '_', M1[m].count), fps: 14, loop: false }; });
      D.motionAnchors = 'assets/chars/stage1/anchors_motions_' + name + '.json';
    });
    // 2차 전직 갈래 임시 옷(2026-11-08, classes.<직업>.tier2.branches 의 look): 그 갈래 옷 그림(「옷_성별」)이 아직 없으면
    //   1차 옷(look.base) 묶음을 그대로 빌려 쓰고 그릴 때 물들임 + 빛 테두리(entities.js Player.draw 의 def.look). 그림 · 손 위치 · 동작 = 1차 옷과 똑같음
    //   anims 는 묶음마다 새로 복사(아래 scaleActors 가 걷기 보폭을 옷마다 한 번씩 줄이므로)
    Object.keys(C.classes).forEach(function (ck) {
      var T = C.classes[ck].tier2, BR = T && T.branches;
      (BR || []).forEach(function (b) {
        if (!b.look || !b.outfit) return;
        ['male', 'female'].forEach(function (g) {
          var key = b.outfit + '_' + g, base = C.art.characters[(b.look.base || C.classes[ck].outfit) + '_' + g];
          if (C.art.characters[key] || !base) return;
          var d = {}, k;
          for (k in base) d[k] = base[k];
          d.pivot = { x: base.pivot.x, y: base.pivot.y };
          d.anims = {};
          Object.keys(base.anims).forEach(function (n) { var a = {}, q; for (q in base.anims[n]) a[q] = base.anims[n][q]; d.anims[n] = a; });
          d.look = { tint: { color: b.look.tint, k: b.look.k }, outline: b.look.outline || null };
          d.lookOf = (b.look.base || C.classes[ck].outfit) + '_' + g;   // 빌린 1차 옷(참고용)
          C.art.characters[key] = d;
        });
      });
    });
  })(window.CFG);

  // ---------- 속성 시련 웨이브 펼치기(2026-11-07): trial 던전 = elMobs.dungeons[속성] 의 mobs · mids 를 wavePlan 웨이브로 ----------
  //   이미 적어 둔 값(mobs · waves · mids.list)이 있으면 그대로 둠(던전마다 따로 고치고 싶을 때)
  (function trialFill(C) {
    var DS = C.dungeons, EM = C.elMobs && C.elMobs.dungeons; if (!DS || !EM) return;
    Object.keys(DS).forEach(function (id) {
      var D = DS[id], M = D && D.trial && EM[D.el]; if (!M) return;
      if (!D.mobs) D.mobs = M.mobs.map(function (m) { return [m[0], m[1], 0]; });
      if (!D.waves) D.waves = D.wavePlan.map(function (w, i) {
        var mobs = M.mobs.map(function (m, j) { return [m[0], i === D.wavePlan.length - 1 && j === M.mobs.length - 1 ? m[1] * 2 : m[1]]; });
        return { n: w.n, mobs: mobs, mids: w.mids };
      });
      if (!D.mids.list) D.mids = Object.assign({}, D.mids, { list: M.mids });
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
    ['knight', 'mage', 'archer'].forEach(function (c) {
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
        if (a.volley && a.volley.lanes) arr(a.volley.lanes); mul(a, ['homing'], S);   // 2026-11-09 여러 발(줄 차이) · 따라오는 구체(초당 줄 이동)
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

  // ---------- 친구 시험 모드(2026-11-07, 형님 승인): 주소 ?demo=1 ----------
  //   한 번 들어오면 이 브라우저(localStorage 'pixelBrawler.demo')에 기억 → 주소 없이 새로고침해도 그대로. ?demo=0 = 끄기(형님 모드로 돌아감)
  //   켜지면: 시험 도구(시험 탭 · 남/여 · 견습/기사/법사 · 연습장) · ?debug 화면 숨김, 판 · 난이도는 1판부터 차례로 열림(stagesAllOpen 무시),
  //   저장은 따로(growth.js 'pixelBrawler.demo.save', main.js 도움말 'pixelBrawler.demo.help') → 형님 개발 저장과 절대 안 섞임
  (function (C) {
    var q = new URLSearchParams(location.search), on = false;
    try {
      if (q.get('demo') === '1') localStorage.setItem('pixelBrawler.demo', '1');
      else if (q.get('demo') === '0') localStorage.removeItem('pixelBrawler.demo');
      on = localStorage.getItem('pixelBrawler.demo') === '1';
    } catch (e) { on = q.get('demo') === '1'; }
    C.demo = on;
    if (on) { C.stagesAllOpen = false; document.documentElement.classList.add('demo'); }
  })(window.CFG);
})();
