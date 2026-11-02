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

  // 새 그림(art\stage1): 빈손 남/여 + 손 위치 json → 무기를 코드로 손에 붙인다
  function stage1(who, anchors) {
    var p = 'assets/chars/stage1/' + who + '/';
    return {
      label: who === 'male' ? '남' : '여',
      frameW: 176, frameH: 136,
      pivot: { x: 68, y: 130 },
      bakedWeapon: false,
      anchors: anchors,
      anims: {
        idle:   { frames: seq(p + 'idle_', 4),   fps: 6,  loop: true },
        walk:   { frames: seq(p + 'walk_', 8),   fps: 12, loop: true },
        attack: { frames: seq(p + 'attack_', 5), fps: 14, loop: false },
        hurt:   { frames: seq(p + 'hurt_', 3),   fps: 10, loop: false }
      }
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

    // ---------- 무기별 손맛 (검 = 스윽 빠르게, 도끼 = 쾅 무겁게) ----------
    weapons: {
      sword: { damage: [11, 15], hitstopMul: 1.0, shakeMul: 1.0, knockMul: 1.0, speed: 1.0,  arcColor: '#cfe8ff', sparkColor: '#fff3b0' },
      axe:   { damage: [19, 26], hitstopMul: 1.6, shakeMul: 1.8, knockMul: 1.6, speed: 0.78, arcColor: '#ffc27a', sparkColor: '#ffb347' }
    },

    // ---------- 3타 콤보 (같은 공격 그림을 순서·속도 바꿔 재사용) ----------
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
