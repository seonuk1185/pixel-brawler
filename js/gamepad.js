// =====================================================================
//  게임패드(컨트롤러) (gamepad.js, 2026-11-08)
//  - 브라우저 게임패드 기능(navigator.getGamepads)으로 엑스박스 배치(표준 배치) 패드를 읽음. 플스 패드도 같은 자리(× = A, ○ = B, □ = X, △ = Y)
//  - 매 프레임 패드를 봄 → 게임 중 = input.js 로(이동 · 달리기 · 버튼), 창이 열려 있으면 = 창 고르기(키보드 화살표 · Enter · Esc 를 대신 눌러 줌)
//    → 창 고르기는 main.js 의 키보드 고르기(openMenu)를 그대로 씀. 키보드 · 손가락 조작은 안 건드림
//  - 꽂기 · 빼기: 「게임패드 연결됨」 작은 알림. 패드를 쓰면 PC 화면(pcui)으로 → 폰 버튼(조이스틱 등)은 숨음
//
//  버튼 배치(표준 배치 번호):
//    왼쪽 막대 / 십자키 = 이동 (막대 가운데 0.25 안은 무시)
//    달리기 = 왼쪽 막대를 옆으로 끝까지(0.85 넘게) 밀기 · 십자키는 키보드처럼 같은 쪽 두 번
//    A(0) = 점프 · X(2) = 평타 · B(1) = 회피 · Y(3) = 각성(분노 100%)
//    LB(4) = 기술 1번 칸 · RB(5) = 2번 · LT(6) = 3번 · RT(7) = 4번
//    오른쪽 막대 위 · 오른쪽 · 아래 · 왼쪽 = 5 · 6 · 7 · 8번 칸, 왼쪽 막대 누르기(L3, 10) = 9번 · 오른쪽 막대 누르기(R3, 11) = 10번 칸 (6~10번 = PC 칸)
//    Start(9) = 설정 창(멈춤) 열기 · 닫기 · Back/Select(8) = 기술 창(견습 = 능력치 창) 열기 · 닫기
//  창 안: 십자키 / 왼쪽 막대 = 고르기, A = 누르기, B = 닫기 · 뒤로(스테이지 고르기 · 결과 · 전직 화면은 닫을 창이 없어 B 는 그냥 둠)
//    설정 창의 키 설정 칸은 키보드 전용(A 로 안 눌림)
// =====================================================================
(function () {
  if (!navigator.getGamepads) return;
  var DZ = 0.25, RUN_AT = 0.85, RUN_KEEP = 0.6, NAV_AT = 0.5, RS_AT = 0.6;
  var REP_FIRST = 380, REP_NEXT = 140;   // 창 고르기: 누르고 있으면 0.38초 뒤부터 0.14초마다 다음 칸
  var SLOT_BTN = { 4: 'A', 5: 'B', 6: 'C', 7: 'D', 10: 'I', 11: 'J' };
  var prev = [], used = false, known = {}, padRun = 0, dTap = { dir: 0, t: 0 }, dRun = 0, rsDir = null;
  var nav = { dir: null, t: 0, next: 0 };

  // ---------- 알림(「게임패드 연결됨」) ----------
  var toastEl = null, toastT = null;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'padtoast'; toastEl.setAttribute('aria-live', 'polite'); (document.querySelector('.game') || document.body).appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.hidden = false;
    toastEl.classList.remove('show'); void toastEl.offsetWidth; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.hidden = true; }, 2200);
  }

  // ---------- 도움말(PC 아래 한 줄 · 설정 창 「게임패드」 줄) ----------
  function k(s) { return '<kbd>' + s + '</kbd>'; }
  var HINT = '패드: 이동 ' + k('막대') + '/' + k('십자키') + ' · 달리기 막대 끝까지 · 점프 ' + k('A') + ' · 평타 ' + k('X') + ' · 회피 ' + k('B') +
    ' · 각성 ' + k('Y') + ' · 기술 1~4 ' + k('LB') + ' ' + k('RB') + ' ' + k('LT') + ' ' + k('RT') + ' (5~8 = 오른쪽 막대, 9·10 = 막대 누르기)' + ' · 설정 ' + k('Start') + ' · 기술 창 ' + k('Back');
  var keyHintHtml = null;
  function anyPad() { var l = pads(); for (var i = 0; i < l.length; i++) if (l[i]) return true; return false; }
  function helpUi() {
    var on = anyPad();
    var ht = document.getElementById('keyHintTxt');
    if (ht) {
      if (on) { if (ht.dataset.pad !== '1') keyHintHtml = ht.innerHTML; ht.innerHTML = HINT; ht.dataset.pad = '1'; }
      else if (ht.dataset.pad === '1') { ht.innerHTML = keyHintHtml || ''; ht.dataset.pad = ''; }
    }
    var row = document.querySelector('.setpanel .setrow.padrow:not(.touchonly)');
    if (row) {
      var sp = row.querySelector('span');
      row.classList.toggle('padon', on);
      if (sp) sp.innerHTML = on ? '연결됨 · ' + HINT.replace(/^패드: /, '') : '패드를 꽂고 아무 버튼이나 누르세요';
    }
  }
  // 키 설정을 바꾸면 main.js 가 도움말 한 줄을 다시 그림 → 그 뒤 패드 글로 다시(이 파일이 main.js 뒤에 불려서 차례가 뒤)
  if (window.Keys && Keys.onChange) Keys.onChange(function () { var ht = document.getElementById('keyHintTxt'); if (ht) { ht.dataset.pad = ''; } helpUi(); });

  function pads() { try { return navigator.getGamepads() || []; } catch (e) { return []; } }
  window.addEventListener('gamepadconnected', function (e) { if (e.gamepad) { known[e.gamepad.index] = true; toast('게임패드 연결됨'); helpUi(); } });
  window.addEventListener('gamepaddisconnected', function (e) { if (e.gamepad) { delete known[e.gamepad.index]; prev[e.gamepad.index] = null; } toast('게임패드 연결 끊김'); Input.setPad(null); helpUi(); });

  // ---------- 지금 열린 창 ----------
  function vis(id) { var el = document.getElementById(id); return el && !el.hidden ? el : null; }
  // B = 닫기: Esc 로 닫히는 창들(맨 위에 뜨는 것부터). 폰 조작 도움말은 Esc 가 없어 「확인」을 누름
  var CLOSABLE = ['dgConfirm', 'phHelp', 'unlockPop', 'encPanel', 'skillPanel', 'statPanel', 'setPanel'];
  var ROOT = ['classSel', 'result', 'stageSel'];
  function openWin() {
    for (var i = 0; i < CLOSABLE.length; i++) if (vis(CLOSABLE[i])) return CLOSABLE[i];
    for (i = 0; i < ROOT.length; i++) if (vis(ROOT[i])) return ROOT[i];
    return null;
  }
  // 키보드 키를 대신 누름(누르고 바로 뗌 → input.js 에 눌린 채로 안 남음)
  function key(code) {
    var t = document.activeElement && document.activeElement !== document.body ? document.activeElement : document.body;
    var o = { code: code, key: code === 'Escape' ? 'Escape' : code === 'Enter' ? 'Enter' : code, bubbles: true, cancelable: true };
    t.dispatchEvent(new KeyboardEvent('keydown', o));
    t.dispatchEvent(new KeyboardEvent('keyup', o));
  }
  function first(l) { return l && l[0]; }

  function down(p, i) { var b = p.buttons[i]; return !!b && (b.pressed || b.value > 0.5); }

  function step() {
    requestAnimationFrame(step);
    var list = pads(), p = null;
    for (var i = 0; i < list.length; i++) {
      var q = list[i];
      if (!q || !q.connected) continue;
      if (!known[q.index]) { known[q.index] = true; toast('게임패드 연결됨'); helpUi(); }   // 꽂힘 알림이 안 오는 브라우저도
      if (!p) p = q;
    }
    if (!p) { if (used) { used = false; Input.setPad(null); } return; }
    var was = prev[p.index] || [], now = [];
    for (i = 0; i < p.buttons.length; i++) now[i] = down(p, i);
    prev[p.index] = now;
    function hit(n) { return now[n] && !was[n]; }   // 이번 프레임에 막 누름
    var ax = p.axes || [], lx = ax[0] || 0, ly = ax[1] || 0, rx = ax[2] || 0, ry = ax[3] || 0;
    if (Math.hypot(lx, ly) < DZ) { lx = 0; ly = 0; }
    var dx = (now[15] ? 1 : 0) - (now[14] ? 1 : 0), dy = (now[13] ? 1 : 0) - (now[12] ? 1 : 0);
    var active = now.some(Boolean) || lx || ly || Math.hypot(rx, ry) > RS_AT;
    if (active && !used) { used = true; }
    if (active && Input.mode() !== 'pc') Input.setMode('pc');   // 패드를 쓰면 PC 화면(폰 버튼 숨김)
    if (!used) return;

    var G = window.GAME, win = openWin(), lay = window.PadLayout && PadLayout.isOpen && PadLayout.isOpen();
    var loading = vis('loading'), rot = vis('rotOv');
    // Start = 설정 창 열기 · 닫기(키보드 Esc 와 같음)
    if (hit(9) && !lay && !loading) { key(first(CFG.keys.menu) || 'Escape'); return; }
    if (win || lay || loading || rot || (G && G.paused)) {
      // ----- 창 고르기 -----
      Input.setPad(null); padRun = 0; dRun = 0;
      if (lay || loading) return;
      // Back = 기술 창(견습 = 능력치 창) 닫기
      if (hit(8) && (win === 'skillPanel' || win === 'statPanel')) { key('Escape'); return; }
      var d = dy < 0 || ly < -NAV_AT ? 'ArrowUp' : dy > 0 || ly > NAV_AT ? 'ArrowDown' : dx < 0 || lx < -NAV_AT ? 'ArrowLeft' : dx > 0 || lx > NAV_AT ? 'ArrowRight' : null;
      var t = performance.now();
      if (d !== nav.dir) { nav = { dir: d, t: t, next: t + REP_FIRST }; if (d) key(d); }
      else if (d && t >= nav.next) { nav.next = t + REP_NEXT; key(d); }
      if (hit(0)) {
        var ae = document.activeElement;
        if (!(ae && ae.classList && ae.classList.contains('kc'))) key('Enter');   // 키 설정 칸은 키보드 전용
      }
      if (hit(1) && win && CLOSABLE.indexOf(win) >= 0) {
        if (win === 'phHelp') { var ok = document.getElementById('btnPhHelpOk'); if (ok) ok.click(); }
        else key('Escape');
      }
      return;
    }
    nav = { dir: null, t: 0, next: 0 };

    // ----- 게임 중 -----
    // 달리기: 막대를 옆으로 끝까지(RUN_AT) → 달림, RUN_KEEP 아래로 돌아오거나 반대로 밀면 걷기
    var sx = lx > 0 ? 1 : -1;
    if (padRun && (lx * padRun < RUN_KEEP)) padRun = 0;
    if (!padRun && Math.abs(lx) >= RUN_AT && Math.abs(lx) > Math.abs(ly)) padRun = sx;
    // 십자키: 같은 쪽을 빠르게 두 번(키보드와 같은 시간 = config move.doubleTapMs) → 누르고 있는 동안 달림
    var tn = performance.now(), dTapMs = (CFG.move && CFG.move.doubleTapMs) || 250;
    var dHit = hit(14) ? -1 : hit(15) ? 1 : 0;
    if (dHit) { if (dTap.dir === dHit && tn - dTap.t <= dTapMs) dRun = dHit; else if (dRun && dRun !== dHit) dRun = 0; dTap = { dir: dHit, t: tn }; }
    if (dRun && dx !== dRun) dRun = 0;
    var mx = dx || lx, my = dy || ly;
    Input.setPad({ x: mx, y: my, run: dx ? dRun : padRun });

    if (hit(0)) Input.pressJump();
    if (hit(2)) Input.pressAttack();
    if (hit(1)) Input.pressDodge();
    if (hit(3)) Input.pressAwaken();
    for (var b in SLOT_BTN) if (hit(+b)) Input.pressSlot(SLOT_BTN[b]);
    // 오른쪽 막대: 한 번 밀 때 한 번(가운데로 돌아와야 다시)
    var rd = null;
    if (Math.hypot(rx, ry) > RS_AT) rd = Math.abs(rx) > Math.abs(ry) ? (rx > 0 ? 'F' : 'H') : (ry < 0 ? 'E' : 'G');
    else if (Math.hypot(rx, ry) < 0.3) rsDir = null;
    if (rd && rd !== rsDir && rsDir === null) Input.pressSlot(rd);
    if (rd) rsDir = rd;
    // Back = 기술 창(견습 = 기술 버튼이 숨어 있음 → 능력치 창)
    if (hit(8)) {
      var skb = document.getElementById('btnSkill'), noSk = !skb || skb.hidden;
      key(first(noSk ? CFG.keys.stat : CFG.keys.skill) || (noSk ? 'KeyC' : 'KeyV'));
    }
  }
  helpUi();
  requestAnimationFrame(step);
  window.Gamepad_ = { help: helpUi, toast: toast };   // 시험용
})();
