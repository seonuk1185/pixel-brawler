// =====================================================================
//  키 설정 (keys.js, 2026-11-07 설정 창 「키 설정」, 형님 승인)
//  - 키 바꾸기의 한 곳(single source): 기본값 = config.js keys, 바꾼 키 = 브라우저 저장(localStorage 'pixelBrawler.keys',
//    친구 시험 모드(?demo=1) = 'pixelBrawler.demo.keys' → 형님 저장과 안 섞임)
//  - 바꾸면 CFG.keys 의 목록을 그 자리에서 고쳐 씀(CFG.keys 통째로 바꾸지 않음) → input.js · main.js 는 늘 CFG.keys 만 봄
//  - 행동마다 키 = [기본 키, 보조 키, (기본값에만 있는 덤 키 …)]. 덤 키 = 점프 X 처럼 기본값의 셋째 키(보조 키를 바꾸면 없어짐)
//  - 같은 키로 치는 짝: 숫자 1 = 키패드 1, Shift 왼쪽 = 오른쪽, Ctrl 왼쪽 = 오른쪽 (저장은 앞의 것 하나, 쓸 때 둘 다)
//  - 못 쓰는 키: Esc(설정 · 창 닫기 전용) · Tab · F1~F12 · Alt · Win · 메뉴 키 · CapsLock · NumLock
//  - 소리 끄기/켜기 키: js/sfx.js 가 M 키를 직접 받음(고치면 안 되는 파일) → 여기서 M 을 sfx.js 가 안 받게
//    「입력칸에서 누른 것」으로 다시 보냄(sfx.js 는 입력칸 키를 무시). 소리 키는 main.js 가 Keys 로 받아 SFX.toggle
// =====================================================================
(function () {
  var CFG = window.CFG, K = CFG.keys;
  var SAVE = CFG.demo ? 'pixelBrawler.demo.keys' : 'pixelBrawler.keys';
  // 행동 목록(설정 창 표 순서): id = CFG.keys 이름, name = 보이는 이름, fixed0 = 기본 키를 못 바꿈(설정 창 = Esc)
  var ACT = [
    { id: 'up', name: '위로' }, { id: 'down', name: '아래로' }, { id: 'left', name: '왼쪽' }, { id: 'right', name: '오른쪽' },
    { id: 'attack', name: '평타' }, { id: 'jump', name: '점프' }, { id: 'dodge', name: '회피' }, { id: 'awaken', name: '각성' },
    { id: 'stat', name: '능력치 창' }, { id: 'skill', name: '기술 창' }, { id: 'enc', name: '강화 창' },
    { id: 'menu', name: '설정 창', fixed0: true }, { id: 'sound', name: '소리 켜기·끄기' }
  ];
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].forEach(function (k, i) { ACT.push({ id: 'skill' + k, name: '기술 ' + (i + 1) + '번 칸', slot: true }); });
  var BY = {}; ACT.forEach(function (a) { BY[a.id] = a; });
  if (!K.sound) K.sound = ['KeyM'];   // 소리 = M (sfx.js 와 같음)

  // ---------- 같은 키로 치는 짝 ----------
  function canon(c) {
    if (!c) return c;
    var m = /^Numpad(\d)$/.exec(c);
    if (m) return 'Digit' + m[1];
    if (c === 'ShiftRight') return 'ShiftLeft';
    if (c === 'ControlRight') return 'ControlLeft';
    return c;
  }
  function expand(c) {
    var m = /^Digit(\d)$/.exec(c);
    if (m) return [c, 'Numpad' + m[1]];
    if (c === 'ShiftLeft') return [c, 'ShiftRight'];
    if (c === 'ControlLeft') return [c, 'ControlRight'];
    return [c];
  }
  function allowed(c) {
    return !!c && !/^(Escape|Tab|F\d+|AltLeft|AltRight|MetaLeft|MetaRight|OSLeft|OSRight|ContextMenu|CapsLock|NumLock|ScrollLock|Pause|PrintScreen|Unidentified)$/.test(c);
  }
  // 기본값(config.js 그대로를 짝 하나로 줄임)
  var DEF = {};
  ACT.forEach(function (a) {
    var out = [];
    (K[a.id] || []).forEach(function (c) { c = canon(c); if (out.indexOf(c) < 0) out.push(c); });
    DEF[a.id] = out;
  });
  var B = {};   // 지금 키: 행동 → [기본, 보조, 덤…] (null = 비어 있음)
  function copyDef() { var o = {}; ACT.forEach(function (a) { o[a.id] = DEF[a.id].slice(); }); return o; }

  // ---------- 저장 · 불러오기 ----------
  function load() {
    B = copyDef();
    var s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE) || 'null'); } catch (e) { s = null; }
    if (!s || typeof s !== 'object' || !s.b) return;
    var used = {};
    ACT.forEach(function (a) {
      var v = s.b[a.id];
      if (!Array.isArray(v)) return;
      var l = v.map(function (c) { c = typeof c === 'string' ? canon(c) : null; return c && (allowed(c) || (a.fixed0 && c === 'Escape')) ? c : null; });
      if (a.fixed0) l[0] = DEF[a.id][0];
      B[a.id] = l;
    });
    // 저장이 깨져 같은 키가 두 곳에 있으면 뒤의 것을 비움
    ACT.forEach(function (a) { B[a.id] = B[a.id].map(function (c) { if (!c) return c; if (used[c]) return null; used[c] = 1; return c; }); tidy(a.id); });
  }
  function save() {
    try { localStorage.setItem(SAVE, JSON.stringify({ v: 1, b: B })); } catch (e) {}
  }
  // 빈 기본 키에 보조 키를 올림, 끝의 빈 자리 · 덤 자리의 빈 것 정리
  function tidy(id) {
    var l = B[id], a = BY[id];
    if (!a.fixed0 && !l[0] && l[1]) { l[0] = l[1]; l[1] = null; }
    var extra = l.slice(2).filter(Boolean);
    B[id] = [l[0] || null, l[1] || null].concat(extra);
  }
  // CFG.keys 를 지금 키로 고쳐 씀(목록 자리만 바꿈)
  var cbs = [];
  function apply() {
    ACT.forEach(function (a) {
      var out = [];
      B[a.id].forEach(function (c) { if (c) expand(c).forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); }); });
      K[a.id] = out;
    });
    cbs.forEach(function (fn) { try { fn(); } catch (e) { setTimeout(function () { throw e; }); } });
  }

  // ---------- 키 이름(화면에 보이는 글자) ----------
  var NAMES = { Escape: 'Esc', Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl',
    ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
    Backslash: '\\', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`', Enter: 'Enter', NumpadEnter: 'Enter',
    Backspace: 'Back', Delete: 'Del', Insert: 'Ins', PageUp: 'PgUp', PageDown: 'PgDn', Home: 'Home', End: 'End',
    NumpadAdd: 'Num+', NumpadSubtract: 'Num-', NumpadMultiply: 'Num*', NumpadDivide: 'Num/', NumpadDecimal: 'Num.', IntlBackslash: '\\', IntlRo: '\\', IntlYen: '\\' };
  function label(c) {
    if (!c) return '';
    if (NAMES[c]) return NAMES[c];
    var m = /^(?:Key|Digit)(.)$/.exec(c) || /^Numpad(\d)$/.exec(c);
    if (m) return m[1];
    return c.replace(/^Numpad/, 'Num').replace(/^(Lang\d|Convert|NonConvert|KanaMode)$/, '한/영');
  }

  // ---------- 바꾸기 ----------
  // 행동 id 의 i 번째(0 = 기본, 1 = 보조) 자리에 code. 다른 곳에 있던 키면 서로 바꿈(그쪽에 내 옛 키를 줌)
  //   돌려주는 값 = { ok, msg, other(바뀐 행동 id), why('esc' · 'bad' · 'same' · 'fixed') }
  function where(code) {
    for (var n = 0; n < ACT.length; n++) { var l = B[ACT[n].id]; for (var j = 0; j < l.length; j++) if (l[j] === code) return { id: ACT[n].id, i: j }; }
    return null;
  }
  function set(id, i, code) {
    var a = BY[id];
    if (!a) return { ok: false, why: 'bad' };
    if (a.fixed0 && i === 0) return { ok: false, why: 'fixed', msg: '설정 창 기본 키 Esc 는 바꿀 수 없어요' };
    code = canon(code);
    if (code === 'Escape') return { ok: false, why: 'esc', msg: 'Esc 는 설정 · 창 닫기 전용이에요' };
    if (!allowed(code)) return { ok: false, why: 'bad', msg: label(code) + ' 키는 쓸 수 없어요' };
    var l = B[id], old = l[i] || null, at = where(code), msg = '', other = null;
    if (at && at.id === id && at.i === i) return { ok: true, why: 'same', msg: '' };
    if (i === 1) B[id] = l = l.slice(0, 2);   // 보조 키를 바꾸면 덤 키(기본값의 셋째 키)는 없어짐
    if (at) {
      other = at.id;
      var ol = B[at.id];
      if (at.i >= 2) ol.splice(at.i, 1);             // 덤 키 → 그냥 빼 옴
      else ol[at.i] = old && !(BY[at.id].fixed0 && at.i === 0) ? old : null;
      msg = at.id === id ? '' : '이미 ' + BY[at.id].name + '에 쓰는 키입니다' + (old && at.i < 2 ? ' · 서로 바꿨어요' : ' · 거기서 뺐어요');
      if (msg && !B[at.id].filter(Boolean).length) msg +=' (' + BY[at.id].name + ' 키가 비었어요)';
    }
    B[id][i] = code;
    tidy(id); if (other && other !== id) tidy(other);
    save(); apply();
    return { ok: true, msg: msg, other: other };
  }
  // i 번째 자리 비우기(설정 창 Backspace · Delete). 기본 키를 비우면 보조 키가 올라감, 마지막 하나는 못 비움
  function clear(id, i) {
    var a = BY[id], l = B[id];
    if (!a || (a.fixed0 && i === 0)) return { ok: false };
    if (l.filter(Boolean).length <= 1 && l[i]) return { ok: false, msg: '키가 하나는 있어야 해요' };
    if (i === 1) B[id] = l = l.slice(0, 2);
    l[i] = null; tidy(id); save(); apply();
    return { ok: true };
  }
  function reset() { B = copyDef(); try { localStorage.removeItem(SAVE); } catch (e) {} apply(); }
  function isDefault() { return JSON.stringify(B) === JSON.stringify(copyDef()); }

  // ---------- M 키를 sfx.js 가 안 받게(소리 키는 main.js 가 Keys 로 받음) ----------
  //   맨 먼저(잡는 단계) 받아 멈추고, 똑같은 키를 숨은 입력칸에서 다시 보냄 → 다른 곳(input.js · main.js)은 그대로 받고 sfx.js 만 무시
  var fake = null;
  window.addEventListener('keydown', function (e) {
    if (e.code !== 'KeyM' || (fake && e.target === fake)) return;
    var tg = e.target && e.target.tagName;
    if (tg === 'INPUT' || tg === 'TEXTAREA') return;
    if (!fake) {
      fake = document.createElement('input');
      fake.type = 'text'; fake.tabIndex = -1; fake.hidden = true; fake.setAttribute('aria-hidden', 'true'); fake.id = 'keysRelay';
      document.body.appendChild(fake);
    }
    e.stopImmediatePropagation(); e.stopPropagation();
    var c = new KeyboardEvent('keydown', { key: e.key, code: e.code, repeat: e.repeat, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey, bubbles: true, cancelable: true });
    fake.dispatchEvent(c);
    if (c.defaultPrevented) e.preventDefault();
  }, true);

  load(); apply();

  window.Keys = {
    ACT: ACT, name: function (id) { return BY[id] ? BY[id].name : id; },
    // 행동의 키들(저장 모양: [기본, 보조, 덤…]), 첫 키 이름, 키 이름
    get: function (id) { return (B[id] || []).slice(); },
    lab: function (id) { var l = B[id] || []; return label(l[0] || l[1] || ''); },
    label: label,
    // 이 키(e.code)가 그 행동인가
    is: function (id, code) { return (K[id] || []).indexOf(code) >= 0; },
    set: set, clear: clear, reset: reset, isDefault: isDefault, allowed: allowed,
    isDefaultSlots: function () { return ACT.every(function (a) { return !a.slot || B[a.id][0] === DEF[a.id][0]; }); },
    onChange: function (fn) { cbs.push(fn); },
    saveKey: SAVE
  };
})();
