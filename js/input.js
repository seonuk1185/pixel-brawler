// 조작: PC 키보드 + 폰 가상 조이스틱 / 공격·점프·회피·기술 버튼
// 화면 갈래(2026-11-07 PC 아래 막대): body 에 pcui(PC 아래 막대) 또는 touchui(폰 조이스틱·버튼)를 붙임.
//   처음 = 손가락 화면(pointer: coarse)이면 touchui, 아니면 pcui. 그 뒤 손가락으로 누르면 touchui, 키보드·마우스를 쓰면 pcui (둘 다 되는 기기)
//   main.js 가 Input.onMode(fn) 로 바뀜을 받아 화면 크기를 다시 잼
// 달리기(2026-11-03): 키보드 = 같은 쪽(←/→)을 빠르게 두 번 → 누르고 있는 동안 달림.
//   폰 = 조이스틱을 가로로 같은 쪽으로 잠깐(CFG.move.joyHoldMs) 계속 밀거나, 손을 뗐다가 바로(joyFlickMs) 같은 쪽으로 다시 밀면 달림
(function () {
  var keysDown = {};
  var attackQueued = 0;   // 누른 순간 기록(시각)
  var jumpQueued = 0;     // 점프 누른 순간
  var awakenQueued = 0;   // 각성 누른 순간(2026-11-06 밤, 분노 100%)
  var dodgeQueued = 0;    // 회피 누른 순간(2026-11-07)
  // 기술 칸 A~J 누른 순간 (C·D = 2026-11-06 성장 4단계, E = 2026-11-07 폰 5번째 칸, F~J = 2026-11-07 PC 아래 막대 위 줄)
  var SLOTS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  var skillQueued = {}; SLOTS.forEach(function (k) { skillQueued[k] = 0; });
  // 칸에 회피를 끼웠나(main.js 가 넣는 함수, 칸 글자 → true/false): 그 칸을 누르면 기술 대신 회피(2026-11-07)
  var slotIsDodge = null;
  function pressSlot(k) {
    if (slotIsDodge && slotIsDodge(k)) dodgeQueued = performance.now();
    else skillQueued[k] = performance.now();
  }
  // ---------- 화면 갈래(pcui / touchui) ----------
  var uiMode = null, modeCbs = [];
  function setMode(m) {
    if (m === uiMode) return;
    uiMode = m;
    document.body.classList.toggle('touchui', m === 'touch');
    document.body.classList.toggle('pcui', m === 'pc');
    modeCbs.forEach(function (fn) { fn(m); });
  }
  var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  setMode(coarse || (!window.matchMedia && navigator.maxTouchPoints > 0) ? 'touch' : 'pc');
  // 손가락 = 폰 화면, 마우스(실제로 움직임)·펜·키보드 = PC 화면. 잡는 단계(capture)라 버튼이 먼저 막아도 받음
  window.addEventListener('pointerdown', function (e) { setMode(e.pointerType === 'touch' ? 'touch' : 'pc'); }, true);
  window.addEventListener('touchstart', function () { setMode('touch'); }, { capture: true, passive: true });
  window.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse' && (e.movementX || e.movementY)) setMode('pc'); }, true);
  window.addEventListener('keydown', function (e) { if (!e.isComposing && e.code) setMode('pc'); }, true);
  var joy = { x: 0, y: 0, active: false, id: null };
  var CF = null;
  // 달리기: runKey = 키보드로 정한 달리는 쪽(-1/1, 0 = 아님), tap = 마지막으로 누른 좌/우와 시각
  var runKey = 0, tap = { dir: 0, t: 0 };
  // 폰: joyRun = 조이스틱으로 정한 달리는 쪽, joyRel = 마지막으로 뗀 시각·쪽(빠르게 다시 밀기 = 달리기)
  var joyRun = 0, joyRel = { t: -1e9, dir: 0 }, joyFlick = false, joyHold = { dir: 0, t: 0 };   // joyHold = 같은 쪽으로 밀기 시작한 시각
  var joyRunTick = null;
  // 조이스틱이 안 생기는 곳(2026-11-07 버튼 위치 바꾸기, js/padlayout.js 가 넣음): fn(x, y) → true = 버튼 둘레라 조이스틱 안 만듦
  var joyBlock = null;   // 조이스틱 만들 때 joyRunCheck 를 넣어 둠 → runDir 가 매 프레임 부름

  function matches(code, list) { return list.indexOf(code) >= 0; }
  function anyHeld(list) { for (var i = 0; i < list.length; i++) if (keysDown[list[i]]) return true; return false; }
  function MV() { return (CF && CF.move) || {}; }

  function init(cfg) {
    CF = cfg;
    var K = cfg.keys;
    window.addEventListener('keydown', function (e) {
      var sk = [], jp = K.jump || [], aw = K.awaken || [], dg = K.dodge || [];
      SLOTS.forEach(function (k) { sk = sk.concat(K['skill' + k] || []); });
      if (e.repeat) { if (matches(e.code, K.attack) || matches(e.code, sk) || matches(e.code, jp) || matches(e.code, dg)) e.preventDefault(); return; }
      // 달리기: 같은 쪽을 doubleTapMs 안에 다시 누름(그 쪽 키를 모두 뗐다가). 반대쪽을 누르면 달리기 끝
      var d = matches(e.code, K.left) ? -1 : matches(e.code, K.right) ? 1 : 0;
      if (d) {
        var now = performance.now(), held = anyHeld(d < 0 ? K.left : K.right);
        if (!held && tap.dir === d && now - tap.t <= (MV().doubleTapMs || 250)) runKey = d;
        else if (runKey && runKey !== d) runKey = 0;
        if (!held) tap = { dir: d, t: now };
      }
      keysDown[e.code] = true;
      if (matches(e.code, K.attack)) attackQueued = performance.now();
      if (matches(e.code, jp)) jumpQueued = performance.now();
      if (matches(e.code, aw)) awakenQueued = performance.now();
      if (matches(e.code, dg)) dodgeQueued = performance.now();
      SLOTS.forEach(function (k) { if (matches(e.code, K['skill' + k] || [])) pressSlot(k); });   // 회피를 끼운 칸이면 회피
      if ([].concat(K.left, K.right, K.up, K.down, K.attack, jp, sk, aw, dg).indexOf(e.code) >= 0 && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) {
      keysDown[e.code] = false;
      if (runKey && !anyHeld(runKey < 0 ? K.left : K.right)) runKey = 0;
    });
    window.addEventListener('blur', function () { keysDown = {}; runKey = 0; });

    // ----- 조이스틱 (왼쪽 아래 영역 아무 데나 누르면 그 자리에 생김) -----
    var zone = document.getElementById('joyZone');
    var base = document.getElementById('joy');
    var knob = document.getElementById('joyKnob');
    var R = 44, cx = 0, cy = 0;
    function place(x, y) {
      cx = x; cy = y;
      base.style.left = (x - 60) + 'px'; base.style.top = (y - 60) + 'px';
    }
    function move(x, y) {
      var dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      joy.x = dx / R; joy.y = dy / R;
      joyRunCheck();
    }
    // 달리기 판정(조이스틱) (2026-11-03 형님 요청으로 변경): 가로로 같은 쪽을 joyHoldMs 동안 계속 밀고 있으면 → 달림
    //   (반쯤만 밀어도 됨, joyHoldAt 이상). 손 뗐다가 바로 같은 쪽으로 다시 밀기(joyFlick)도 그대로 달림
    //   달리다가 0.35 아래로 돌아오거나 반대로 밀면 → 걷기
    function joyRunCheck() {
      var M = MV(), ax = Math.abs(joy.x), s = joy.x > 0 ? 1 : -1, horiz = ax > Math.abs(joy.y) * 0.9, now = performance.now();
      if (joyRun) {
        // 2026-11-06 형님: 달리다 위·아래로 꺾어도 계속 달림. 반대쪽으로 밀거나 가운데로 돌아오면 걷기
        if ((joy.x * joyRun < -0.3) || Math.hypot(joy.x, joy.y) < 0.3) { joyRun = 0; joyFlick = false; }
      }
      if (horiz && ax >= (M.joyHoldAt || 0.5)) { if (joyHold.dir !== s) joyHold = { dir: s, t: now }; }
      else joyHold = { dir: 0, t: 0 };
      if (!joyRun && horiz) {
        if (joyHold.dir === s && now - joyHold.t >= (M.joyHoldMs || 450)) { joyRun = s; joyFlick = false; }
        else if (ax > 0.4 && joyRel.dir === s && now - joyRel.t <= (M.joyFlickMs || 280)) { joyRun = s; joyFlick = true; }
      }
    }
    joyRunTick = joyRunCheck;
    zone.addEventListener('pointerdown', function (e) {
      if (joy.id !== null) return;
      if (joyBlock && joyBlock(e.clientX, e.clientY)) { e.preventDefault(); return; }
      joy.id = e.pointerId; joy.active = true;
      zone.setPointerCapture(e.pointerId);
      var r = zone.getBoundingClientRect();
      place(e.clientX - r.left, e.clientY - r.top);
      base.classList.add('on');
      move(e.clientX - r.left, e.clientY - r.top);
      e.preventDefault();
    });
    zone.addEventListener('pointermove', function (e) {
      if (e.pointerId !== joy.id) return;
      var r = zone.getBoundingClientRect();
      move(e.clientX - r.left, e.clientY - r.top);
    });
    function end(e) {
      if (e.pointerId !== joy.id) return;
      // 가로로 꽤 민 채로 뗐으면 기억(바로 같은 쪽으로 다시 밀면 달리기)
      joyRel = Math.abs(joy.x) > 0.4 ? { t: performance.now(), dir: joy.x > 0 ? 1 : -1 } : { t: -1e9, dir: 0 };
      joy.id = null; joy.active = false; joy.x = joy.y = 0; joyRun = 0; joyFlick = false; joyHold = { dir: 0, t: 0 };
      knob.style.transform = '';
      base.classList.remove('on');
      base.style.left = ''; base.style.top = '';
    }
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);

    // ----- 공격·점프 버튼 + 기술 버튼 5개 -----
    function btn(id, onDown) {
      var b = document.getElementById(id);
      if (!b) return;
      b.addEventListener('pointerdown', function (e) { onDown(); b.classList.add('down'); e.preventDefault(); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) {
        b.addEventListener(t, function () { b.classList.remove('down'); });
      });
    }
    btn('btnAtk', function () { attackQueued = performance.now(); });
    btn('btnJump', function () { jumpQueued = performance.now(); });
    SLOTS.forEach(function (k) { btn('btnSk' + k, function () { pressSlot(k); }); });
    btn('btnAwk', function () { awakenQueued = performance.now(); });   // 각성 버튼(폰)
    btn('btnDodge', function () { dodgeQueued = performance.now(); });  // 회피 버튼(폰, 2026-11-07)
  }

  var override = null;   // 시험용 자동 조종(?bot=1)이 넣는 방향 { x, y, run }
  // 게임패드(2026-11-08, js/gamepad.js 가 매 프레임 넣음): { x, y, run } (막대 · 십자키, 달리기 쪽 -1/1/0). null = 안 씀
  var pad = null;
  function axis(cfg) {
    if (override) return { x: override.x, y: override.y };
    var K = cfg.keys, x = 0, y = 0;
    if (anyHeld(K.left)) x -= 1;
    if (anyHeld(K.right)) x += 1;
    if (anyHeld(K.up)) y -= 1;
    if (anyHeld(K.down)) y += 1;
    if (joy.active) {
      var dz = 0.25;
      x = Math.abs(joy.x) > dz ? joy.x : 0;
      y = Math.abs(joy.y) > dz ? joy.y : 0;
    }
    if (pad && !joy.active) { if (!x) x = pad.x || 0; if (!y) y = pad.y || 0; }   // 키보드를 안 누른 쪽만 게임패드로(2026-11-08)
    var len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x: x, y: y };
  }
  // 지금 달리는 쪽(-1/1), 아니면 0. 그 쪽을 누르고(밀고) 있을 때만
  function runDir(cfg) {
    if (override) return override.run || 0;
    if (joy.active) { if (joyRunTick) joyRunTick(); return joyRun; }   // 손가락이 멈춰 있어도 「계속 밀고 있는 시간」을 매 프레임 확인
    var K = cfg.keys;
    if (runKey && anyHeld(runKey < 0 ? K.left : K.right) && !anyHeld(runKey < 0 ? K.right : K.left)) return runKey;
    if (pad && pad.run && !anyHeld(K.left) && !anyHeld(K.right)) return pad.run;   // 게임패드 달리기(2026-11-08)
    return 0;
  }
  function fresh(t, bufferMs) { return !!t && performance.now() - t <= bufferMs; }

  window.Input = {
    init: init,
    axis: axis,
    runDir: runDir,
    // 버퍼 안에 눌린 공격이 있으면 꺼내 씀
    takeAttack: function (bufferMs) { if (fresh(attackQueued, bufferMs)) { attackQueued = 0; return true; } return false; },
    peekAttack: function (bufferMs) { return fresh(attackQueued, bufferMs); },
    pressAttack: function () { attackQueued = performance.now(); }, // 시험용
    takeJump: function (bufferMs) { if (fresh(jumpQueued, bufferMs)) { jumpQueued = 0; return true; } return false; },
    pressJump: function () { jumpQueued = performance.now(); },     // 시험용
    // 기술: slot = 'A' ~ 'J'. 버퍼 안에 눌린 기술이 있으면 꺼내 씀
    takeSkill: function (slot, bufferMs) {
      if (fresh(skillQueued[slot], bufferMs)) { skillQueued[slot] = 0; return true; }
      return false;
    },
    peekSkill: function (slot, bufferMs) { return fresh(skillQueued[slot], bufferMs); },
    clearSkill: function (slot) { skillQueued[slot] = 0; },
    pressSkill: function (slot) { skillQueued[slot] = performance.now(); },   // 시험용
    // 칸 누름(PC 아래 막대를 마우스로 누름 · 시험용): 회피를 끼운 칸이면 회피(2026-11-07)
    pressSlot: pressSlot,
    setSlotDodge: function (fn) { slotIsDodge = fn; },
    setJoyBlock: function (fn) { joyBlock = fn; },   // 버튼 둘레에서는 조이스틱 안 생김(2026-11-07)
    // 화면 갈래(2026-11-07): mode() = 'pc' / 'touch', setMode = 시험용, onMode(fn) = 바뀔 때 부름
    mode: function () { return uiMode; },
    setMode: setMode,
    onMode: function (fn) { modeCbs.push(fn); },
    // 각성(2026-11-06 밤): 버퍼 안에 눌렸으면 꺼내 씀
    takeAwaken: function (bufferMs) { if (fresh(awakenQueued, bufferMs)) { awakenQueued = 0; return true; } return false; },
    pressAwaken: function () { awakenQueued = performance.now(); },   // 시험용(자동 조종)
    // 회피(2026-11-07): 버퍼 안에 눌렸으면 꺼내 씀
    takeDodge: function (bufferMs) { if (fresh(dodgeQueued, bufferMs)) { dodgeQueued = 0; return true; } return false; },
    pressDodge: function () { dodgeQueued = performance.now(); },     // 시험용
    setPad: function (p) { pad = p; },                               // 게임패드(2026-11-08, js/gamepad.js). null 이면 안 씀
    setOverride: function (ax) { override = ax; },                   // 시험용(자동 조종). null 이면 원래대로
    state: function () { return { runKey: runKey, joyRun: joyRun, joyFlick: joyFlick, joy: { x: joy.x, y: joy.y, active: joy.active } }; }   // 시험용
  };
})();
