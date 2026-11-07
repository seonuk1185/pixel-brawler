// =====================================================================
//  폰 버튼 위치 바꾸기 (padlayout.js, 2026-11-07 폰 설정, 형님 승인)
//  - 설정 창 「버튼 위치 · 바꾸기」 → 멈춘 게임 위에 폰 버튼 9개(공격 · 점프 · 회피 · 각성 · 기술 1~5)를 전부 보여 주고 끌어서 옮김
//    끌면 작은 칸(GRID 8px)에 맞춰 붙음 · 화면 안(노치 등 안전 영역 + 위 TOP 줄은 비움) · 다른 버튼과 안 겹침(겹치면 그 자리로 안 감)
//    고른 버튼 크기(작게 0.8 · 보통 1 · 크게 1.25) + 전체 크기(80~130%, 모서리 기준으로 같이 커짐) · 기본 배치로 · 취소 · 저장
//  - 저장 = 화면 모양마다 따로(가로/세로 비율: 넓은 ≥ 1.9 · 보통 1.5~1.9 · 네모난 < 1.5 → 폴드 접음 · 펼침이 각자 배치)
//    localStorage 'pixelBrawler.pad' (친구 시험 모드 ?demo=1 = 'pixelBrawler.demo.pad'). 저장이 없으면 원래 CSS 배치(style.css .touchui .btn…)
//  - 자리 = 가까운 옆(왼/오른쪽) · 위아래 끝에서 버튼 가운데까지 거리 ÷ 화면 폭·높이(%) → 화면 크기가 조금 바뀌어도 같은 느낌
//    크기 = 그 화면의 원래 버튼 크기 x 버튼 크기 x 전체 크기
//  - 폰 화면(body.touchui) 가로일 때만. 세로(가로로 돌려 주세요) · PC 화면은 원래대로
//  - 기술 1~5 칸(2026-11-07 폴드 펼침 고침): 화면 % 가 아니라 「공격 버튼 가운데에서 얼마나」(공격 원래 폭 x 전체 크기 단위)로 저장
//    → 넓은 화면 · 네모난 화면 · 주소창 있고 없고 어디서나 반달이 공격 버튼에 똑같이 붙음. 예전(화면 %) 저장의 기술 칸 자리는 원래 반달로(크기 고른 건 그대로)
//  - 조이스틱: 버튼이 조이스틱 칸보다 위(누름 먼저) + 버튼 둘레 JOYGAP 안에서 누르면 조이스틱이 안 생김(Input.setJoyBlock)
// =====================================================================
(function () {
  var CFG = window.CFG;
  var SAVE = CFG.demo ? 'pixelBrawler.demo.pad' : 'pixelBrawler.pad';
  var IDS = ['btnAtk', 'btnJump', 'btnDodge', 'btnAwk', 'btnSkA', 'btnSkB', 'btnSkC', 'btnSkD', 'btnSkE'];
  var SKS = ['btnSkA', 'btnSkB', 'btnSkC', 'btnSkD', 'btnSkE'];
  function isSk(id) { return SKS.indexOf(id) >= 0; }
  var SIZES = [0.8, 1, 1.25], GS = [0.8, 0.9, 1, 1.1, 1.2, 1.3];
  var GRID = 8, GAP = 2, TOP = 48, JOYGAP = 8;
  var SHAPE = { wide: '넓은 화면', normal: '보통 화면', square: '네모난 화면' };
  var box = null, ed = null, bar = null, msgEl = null;
  var data = {};          // 저장: { wide: rec, normal: rec, square: rec }, rec = { g, b: { id: { ax, ay, x, y, s } } }
  var work = null, workDef = false, sel = 'btnAtk', drag = null, done = null, msgT = 0;
  try { var d0 = JSON.parse(localStorage.getItem(SAVE) || 'null'); if (d0 && typeof d0 === 'object' && d0.v === 1) data = d0.d || {}; } catch (e) { data = {}; }
  function persist() { try { localStorage.setItem(SAVE, JSON.stringify({ v: 1, d: data })); } catch (e) {} }

  function el(id) { return document.getElementById(id); }
  function W() { return window.innerWidth; }
  function H() { return window.innerHeight; }
  function bucket() { var a = W() / Math.max(1, H()); return a >= 1.9 ? 'wide' : a >= 1.5 ? 'normal' : 'square'; }
  function active() { var b = document.body; return b.classList.contains('touchui') && !b.classList.contains('portrait'); }
  // 안전 영역(노치): env() 를 작은 숨은 상자로 읽음
  var probe = null;
  function safe() {
    if (!probe) {
      probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
      document.body.appendChild(probe);
    }
    var cs = getComputedStyle(probe);
    return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  }

  // ---------- 원래 배치(CSS) 재기: 숨은 버튼도 잠깐 보이게(.measure) 해서 가운데 · 크기 ----------
  function defaults() {
    var had = box.classList.contains('custom'), keep = {};
    IDS.forEach(function (id) { keep[id] = el(id).getAttribute('style'); el(id).removeAttribute('style'); });
    box.classList.remove('custom'); box.classList.add('measure');
    var out = {};
    IDS.forEach(function (id) { var r = el(id).getBoundingClientRect(); out[id] = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height }; });
    box.classList.remove('measure'); if (had) box.classList.add('custom');
    IDS.forEach(function (id) { if (keep[id] != null) el(id).setAttribute('style', keep[id]); });
    return out;
  }
  // 원래 배치 → 저장 모양(전체 크기 100%, 버튼 크기 보통)
  function fromDefaults(D) {
    var rec = { g: 1, b: {} };
    IDS.forEach(function (id) { rec.b[id] = isSk(id) ? skDef(id, D, 1) : toRel(D[id].cx, D[id].cy, 1, 1); });
    return rec;
  }
  // 기술 칸 = 공격 가운데에서 떨어진 거리 ÷ (공격 원래 폭 x 전체 크기). 원래 반달(CSS)은 화면 모양과 상관없이 같은 값
  function skDef(id, D, s) { var A = D.btnAtk, u = A.w || 1; return { a: 1, rx: (D[id].cx - A.cx) / u, ry: (D[id].cy - A.cy) / u, s: s || 1 }; }
  function skRel(id, b, atk, D, g, s) { var u = (D.btnAtk.w || 1) * g; return { a: 1, rx: (b.cx - atk.cx) / u, ry: (b.cy - atk.cy) / u, s: s || 1 }; }
  function toRel(cx, cy, g, s) {
    var ax = cx > W() / 2 ? 'r' : 'l', ay = cy > H() / 2 ? 'b' : 't';
    return { ax: ax, ay: ay, x: (ax === 'r' ? W() - cx : cx) / W() / g, y: (ay === 'b' ? H() - cy : cy) / H() / g, s: s };
  }
  // 저장 모양 → 화면 자리(px): { id: { cx, cy, w, h } } (화면 안으로 맞춤)
  function layout(rec, D) {
    var out = {}, S = safe(), g = rec.g || 1, u = (D.btnAtk.w || 1) * g;
    IDS.forEach(function (id) {
      if (isSk(id)) return;
      var q = rec.b[id] || toRel(D[id].cx, D[id].cy, g, 1), k = (q.s || 1) * g;
      var w = D[id].w * k, h = D[id].h * k;
      var cx = q.ax === 'r' ? W() - q.x * W() * g : q.x * W() * g, cy = q.ay === 'b' ? H() - q.y * H() * g : q.y * H() * g;
      out[id] = clampBox({ cx: cx, cy: cy, w: w, h: h }, S);
    });
    // 기술 칸: 그려진 공격 버튼 가운데 기준(예전 화면 % 저장이면 원래 반달 자리, 크기는 그대로)
    var A = out.btnAtk;
    SKS.forEach(function (id) {
      var q = rec.b[id]; if (!q || !q.a) q = skDef(id, D, q && q.s);
      var k = (q.s || 1) * g;
      out[id] = clampBox({ cx: A.cx + q.rx * u, cy: A.cy + q.ry * u, w: D[id].w * k, h: D[id].h * k }, S);
    });
    return out;
  }
  function clampBox(b, S) {
    S = S || safe();
    var x0 = S.l + b.w / 2, x1 = W() - S.r - b.w / 2, y0 = Math.max(S.t, TOP) + b.h / 2, y1 = H() - S.b - b.h / 2;
    b.cx = Math.max(x0, Math.min(x1, b.cx)); b.cy = Math.max(y0, Math.min(y1, b.cy));
    return b;
  }
  // 겹침: 동그라미로 봄(반지름 = 짧은 변 / 2) + 틈 GAP
  function hit(a, b) { var r = Math.min(a.w, a.h) / 2 + Math.min(b.w, b.h) / 2 + GAP; return Math.hypot(a.cx - b.cx, a.cy - b.cy) < r - 0.5; }
  function overlapsAny(L, id, b) { for (var i = 0; i < IDS.length; i++) { var o = IDS[i]; if (o !== id && hit(b, L[o])) return true; } return false; }
  function anyOverlap(L) { for (var i = 0; i < IDS.length; i++) for (var j = i + 1; j < IDS.length; j++) if (hit(L[IDS[i]], L[IDS[j]])) return true; return false; }

  function paint(L) {
    box.classList.add('custom');
    IDS.forEach(function (id) {
      var b = L[id], s = el(id).style;
      s.left = Math.round(b.cx - b.w / 2) + 'px'; s.top = Math.round(b.cy - b.h / 2) + 'px'; s.right = 'auto'; s.bottom = 'auto';
      s.width = Math.round(b.w) + 'px'; s.height = Math.round(b.h) + 'px';
    });
  }
  function unpaint() { box.classList.remove('custom'); IDS.forEach(function (id) { el(id).removeAttribute('style'); }); }

  // ---------- 게임 중: 지금 화면 모양의 저장 배치 (없으면 원래 CSS) ----------
  function apply() {
    if (!box) return;
    if (ed && !ed.hidden) { if (active()) render(); return; }
    var rec = data[bucket()];
    if (!active() || !rec) { unpaint(); return; }
    paint(layout(rec, defaults()));
  }

  // ---------- 바꾸기 화면 ----------
  var DEF = null, CUR = null;   // 원래 배치 · 지금 그려진 자리
  function render() { DEF = defaults(); CUR = layout(work, DEF); paint(CUR); ui(); }
  function msg(s) { msgEl.textContent = s || ''; clearTimeout(msgT); if (s) msgT = setTimeout(function () { msgEl.textContent = hintTxt(); }, 2200); }
  function hintTxt() { return '버튼을 끌어서 옮겨요 · 누르면 고름'; }
  function ui() {
    IDS.forEach(function (id) { el(id).classList.toggle('lesel', id === sel); });
    el('leSel').textContent = el(sel).getAttribute('data-lab') || '';
    var s = (work.b[sel] && work.b[sel].s) || 1;
    ed.querySelectorAll('[data-s]').forEach(function (b) { b.classList.toggle('on', +b.dataset.s === s); });
    el('leG').textContent = Math.round((work.g || 1) * 100) + '%';
    el('leGDn').disabled = (work.g || 1) <= GS[0] + 1e-6; el('leGUp').disabled = (work.g || 1) >= GS[GS.length - 1] - 1e-6;
    el('leShape').textContent = SHAPE[bucket()] + ' 배치';
    // 띠가 버튼을 가리면 아래쪽으로(그래도 가리면 위)
    bar.classList.remove('bot');
    if (CUR && coversAny()) { bar.classList.add('bot'); if (coversAny()) bar.classList.remove('bot'); }
  }
  function coversAny() {
    var r = bar.getBoundingClientRect();
    return IDS.some(function (id) { var b = CUR[id]; return b.cx + b.w / 2 > r.left && b.cx - b.w / 2 < r.right && b.cy + b.h / 2 > r.top && b.cy - b.h / 2 < r.bottom; });
  }
  function open(cb) {
    if (!box || !active()) return false;
    done = cb || null;
    DEF = defaults();
    var rec = data[bucket()];
    work = rec ? JSON.parse(JSON.stringify(rec)) : fromDefaults(DEF);
    IDS.forEach(function (id) {
      var q = work.b[id];
      if (isSk(id)) { if (!q || !q.a) work.b[id] = skDef(id, DEF, q && q.s); }
      else if (!q) work.b[id] = toRel(DEF[id].cx, DEF[id].cy, work.g || 1, 1);
    });
    workDef = !rec; sel = 'btnAtk';
    document.body.classList.add('layedit');
    ed.hidden = false;
    msgEl.textContent = hintTxt();
    render();
    return true;
  }
  function close(saveIt) {
    if (!ed || ed.hidden) return;
    var bk = bucket();
    if (saveIt) {
      if (workDef) delete data[bk]; else data[bk] = work;
      persist();
    }
    drag = null; work = null;
    ed.hidden = true; bar.classList.remove('drag');
    document.body.classList.remove('layedit');
    IDS.forEach(function (id) { el(id).classList.remove('lesel', 'down'); });
    apply();
    window.dispatchEvent(new Event('resize'));   // main.js 가 버튼 자리(오른쪽 비우는 폭) 다시 잼
    var f = done; done = null; if (f) f(!!saveIt);
  }
  function setRel(id, b) {
    var s = (work.b[id] && work.b[id].s) || 1, g = work.g || 1;
    if (isSk(id)) work.b[id] = skRel(id, b, CUR.btnAtk, DEF, g, s);
    else {
      work.b[id] = toRel(b.cx, b.cy, g, s);
      // 공격을 옮기면 기술 칸은 지금 자리 그대로(끈 버튼만 움직임) → 새 공격 자리 기준으로 다시 잼
      if (id === 'btnAtk') SKS.forEach(function (k) { work.b[k] = skRel(k, CUR[k], b, DEF, g, (work.b[k] && work.b[k].s) || 1); });
    }
    workDef = false;
  }

  // 끌기: 바꾸기 화면에서만. 버튼 쪽 누름(input.js)은 잡는 단계에서 막음
  function onDown(e) {
    if (!ed || ed.hidden) return;
    var t = e.target.closest && e.target.closest('.btn');
    e.stopPropagation(); e.preventDefault();
    if (!t || IDS.indexOf(t.id) < 0 || drag) return;
    sel = t.id; ui();
    drag = { id: t.id, pid: e.pointerId, x: e.clientX, y: e.clientY, cx: CUR[t.id].cx, cy: CUR[t.id].cy, moved: false };
    try { t.setPointerCapture(e.pointerId); } catch (x) {}
  }
  function snap(v) { return Math.round(v / GRID) * GRID; }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    var id = drag.id, b0 = CUR[id], dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    if (!drag.moved) { drag.moved = true; bar.classList.add('drag'); }
    var S = safe();
    function cand(nx, ny) { return clampBox({ cx: snap(nx), cy: snap(ny), w: b0.w, h: b0.h }, S); }
    // 겹치면: 가로만 · 세로만 옮겨 봄(벽 따라 미끄러짐) → 다 안 되면 그대로
    var tries = [cand(drag.cx + dx, drag.cy + dy), cand(drag.cx + dx, b0.cy), cand(b0.cx, drag.cy + dy)];
    for (var i = 0; i < tries.length; i++) {
      if (!overlapsAny(CUR, id, tries[i])) { CUR[id] = tries[i]; paint(CUR); break; }
      if (i === 0) msg('다른 버튼과 겹쳐요');
    }
    e.preventDefault();
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    var id = drag.id;
    if (drag.moved) { setRel(id, CUR[id]); msg(''); msgEl.textContent = hintTxt(); }
    drag = null; bar.classList.remove('drag');
    render();
  }
  function setSize(s) {
    var old = work.b[sel].s || 1; if (old === s) return;
    work.b[sel].s = s;
    var L = layout(work, DEF);
    if (anyOverlap(L) && !anyOverlap(CUR)) { work.b[sel].s = old; msg('다른 버튼과 겹쳐서 못 바꿔요'); return; }
    workDef = false; render();
  }
  function setG(dir) {
    var g = work.g || 1, i = GS.indexOf(Math.round(g * 10) / 10); if (i < 0) i = 2;
    var j = Math.max(0, Math.min(GS.length - 1, i + dir)); if (j === i) return;
    var old = work.g; work.g = GS[j];
    var L = layout(work, DEF);
    if (anyOverlap(L) && !anyOverlap(CUR)) { work.g = old; msg('다른 버튼과 겹쳐서 못 바꿔요'); return; }
    workDef = false; render();
  }
  function reset() { work = fromDefaults(DEF || defaults()); workDef = true; msg('기본 배치로 돌렸어요 (저장을 눌러야 남아요)'); render(); }

  // 조이스틱이 안 생기는 곳 = 보이는 버튼 둘레 JOYGAP 안
  function blocked(x, y) {
    if (!box) return false;
    for (var i = 0; i < IDS.length; i++) {
      var b = el(IDS[i]); if (!b || b.hidden || !b.offsetParent) continue;
      var r = b.getBoundingClientRect();
      if (r.width && x >= r.left - JOYGAP && x <= r.right + JOYGAP && y >= r.top - JOYGAP && y <= r.bottom + JOYGAP) return true;
    }
    return false;
  }

  function init() {
    box = document.querySelector('.btns'); ed = el('layEd'); bar = el('leBar'); msgEl = el('leMsg');
    if (!box || !ed) { box = null; return; }
    box.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    ed.addEventListener('pointerdown', function (e) { if (e.target === ed) e.preventDefault(); });   // 빈 곳 = 아무것도 안 함(밑의 조이스틱 칸으로 안 감)
    ed.querySelectorAll('[data-s]').forEach(function (b) { b.addEventListener('click', function () { setSize(+b.dataset.s); }); });
    el('leGDn').addEventListener('click', function () { setG(-1); });
    el('leGUp').addEventListener('click', function () { setG(1); });
    el('leReset').addEventListener('click', reset);
    el('leCancel').addEventListener('click', function () { close(false); });
    el('leSave').addEventListener('click', function () { close(true); });
    window.addEventListener('resize', function () { if (ed.hidden) apply(); else if (!drag) { if (!active()) close(false); else render(); } });
    if (window.Input && Input.setJoyBlock) Input.setJoyBlock(blocked);
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.PadLayout = {
    open: open, close: close, apply: apply, bucket: bucket, blocked: blocked, isOpen: function () { return !!ed && !ed.hidden; },
    // 시험용: 저장된 배치(화면 모양별) · 지금 그려진 자리
    saved: function () { return JSON.parse(JSON.stringify(data)); },
    rects: function () { var o = {}; IDS.forEach(function (id) { var r = el(id).getBoundingClientRect(); o[id] = { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) }; }); return o; }
  };
})();
