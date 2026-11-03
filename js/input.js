// 조작: PC 키보드 + 폰 가상 조이스틱 / 공격 버튼
(function () {
  var keysDown = {};
  var attackQueued = 0;   // 누른 순간 기록(시각)
  var skillQueued = { A: 0, B: 0 };   // 기술 A/B 누른 순간
  var joy = { x: 0, y: 0, active: false, id: null };

  function matches(code, list) { return list.indexOf(code) >= 0; }

  function init(cfg) {
    var K = cfg.keys;
    window.addEventListener('keydown', function (e) {
      var skA = K.skillA || [], skB = K.skillB || [];
      if (e.repeat) { if (matches(e.code, K.attack) || matches(e.code, skA) || matches(e.code, skB)) e.preventDefault(); return; }
      keysDown[e.code] = true;
      if (matches(e.code, K.attack)) attackQueued = performance.now();
      if (matches(e.code, skA)) skillQueued.A = performance.now();
      if (matches(e.code, skB)) skillQueued.B = performance.now();
      if ([].concat(K.left, K.right, K.up, K.down, K.attack, K.jump, skA, skB).indexOf(e.code) >= 0) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { keysDown[e.code] = false; });
    window.addEventListener('blur', function () { keysDown = {}; });

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
    }
    zone.addEventListener('pointerdown', function (e) {
      if (joy.id !== null) return;
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
      joy.id = null; joy.active = false; joy.x = joy.y = 0;
      knob.style.transform = '';
      base.classList.remove('on');
      base.style.left = ''; base.style.top = '';
    }
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);

    // ----- 공격 버튼 -----
    var atk = document.getElementById('btnAtk');
    atk.addEventListener('pointerdown', function (e) {
      attackQueued = performance.now();
      atk.classList.add('down');
      e.preventDefault();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) {
      atk.addEventListener(t, function () { atk.classList.remove('down'); });
    });

    // ----- 기술 버튼 2개 (공격 버튼 위) -----
    [['A', 'btnSkA'], ['B', 'btnSkB']].forEach(function (s) {
      var b = document.getElementById(s[1]);
      if (!b) return;
      b.addEventListener('pointerdown', function (e) {
        skillQueued[s[0]] = performance.now();
        b.classList.add('down');
        e.preventDefault();
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) {
        b.addEventListener(t, function () { b.classList.remove('down'); });
      });
    });
  }

  var override = null;   // 시험용 자동 조종(?bot=1)이 넣는 방향
  function axis(cfg) {
    if (override) return { x: override.x, y: override.y };
    var K = cfg.keys, x = 0, y = 0;
    function any(list) { for (var i = 0; i < list.length; i++) if (keysDown[list[i]]) return true; return false; }
    if (any(K.left)) x -= 1;
    if (any(K.right)) x += 1;
    if (any(K.up)) y -= 1;
    if (any(K.down)) y += 1;
    if (joy.active) {
      var dz = 0.25;
      x = Math.abs(joy.x) > dz ? joy.x : 0;
      y = Math.abs(joy.y) > dz ? joy.y : 0;
    }
    var len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x: x, y: y };
  }

  window.Input = {
    init: init,
    axis: axis,
    // 버퍼 안에 눌린 공격이 있으면 꺼내 씀
    takeAttack: function (bufferMs) {
      if (attackQueued && performance.now() - attackQueued <= bufferMs) { attackQueued = 0; return true; }
      return false;
    },
    peekAttack: function (bufferMs) { return attackQueued && performance.now() - attackQueued <= bufferMs; },
    pressAttack: function () { attackQueued = performance.now(); }, // 시험용
    // 기술: slot = 'A' / 'B'. 버퍼 안에 눌린 기술이 있으면 꺼내 씀
    takeSkill: function (slot, bufferMs) {
      var t = skillQueued[slot];
      if (t && performance.now() - t <= bufferMs) { skillQueued[slot] = 0; return true; }
      return false;
    },
    peekSkill: function (slot, bufferMs) { var t = skillQueued[slot]; return !!t && performance.now() - t <= bufferMs; },
    clearSkill: function (slot) { skillQueued[slot] = 0; },
    pressSkill: function (slot) { skillQueued[slot] = performance.now(); },   // 시험용
    setOverride: function (ax) { override = ax; }                    // 시험용(자동 조종). null 이면 원래대로
  };
})();
