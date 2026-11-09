// 테스트 모드 창(2026-11-10, 형님: 「렙업하면서 테스트하면 너무 오래 걸리니까」). config testPanel = true 일 때만.
//   여는 곳: 설정 창(톱니 · Esc) 「테스트 · 열기」, 스테이지 고르기 아래 「테스트」 버튼
//   하는 것: 레벨 · 1 / 2 / 3차 전직 · 남녀 · 기술 점수 · 모든 기술 최대 · 무기 강화 단계 · 속성 · 판 열기 · 판 바로가기 · 무적 · 한 방 · 몹 구경(11~20판) · 되돌리기
//   저장을 바꾸는 단추 = 저장(localStorage)을 고친 뒤 새로고침(게임이 저장을 처음부터 다시 읽어 맞춤). 새로고침 뒤 이 창이 다시 열림
//   처음 바꾸기 전에 원래 저장을 'pixelBrawler.save.testBackup' 에 한 번 보관 → 「원래 저장으로 되돌리기」
//   시험 설정(3차 켬 · 더 준 기술 점수 · 무적 · 한 방 · 성별) = growth.js 가 읽는 'pixelBrawler.test'(config testPanel = false 면 아무도 안 읽음)
(function () {
  var CFG = window.CFG, GR = window.Growth, GM = window.GAME;
  if (!CFG || !CFG.testPanel || CFG.demo || window.PV || !GR || !GM) return;
  var API = GM.testApi;
  if (!API) return;
  var TP = GR.tp, SAVE_KEY = GR.saveKey, BAK_KEY = SAVE_KEY + '.testBackup';
  var SS_OPEN = 'pixelBrawler.tp.open', SS_MSG = 'pixelBrawler.tp.msg', SS_TOP = 'pixelBrawler.tp.top';
  var EN = CFG.enchant;
  var CLS = [['knight', '기사'], ['mage', '법사'], ['archer', '궁수'], ['assassin', '암살자']];
  var LVS = [1, 6, 25, 30, 50, 60];

  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  // ---------- 저장 보관 · 고치기 ----------
  function hasBackup() { return lsGet(BAK_KEY) != null; }
  function backup() {
    if (hasBackup()) return;
    try { localStorage.setItem(BAK_KEY, JSON.stringify({ raw: localStorage.getItem(SAVE_KEY), at: new Date().toISOString() })); } catch (e) {}
  }
  // fn(slot, data) 으로 저장칸을 고치고 새로고침(창 다시 열림 + 알림 msg)
  function editSave(fn, msg) {
    backup();
    if (!GR.noSave) GR.save();   // 지금 상태를 먼저 저장칸에(저장칸이 아직 없으면 만들어짐)
    var d = null;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || !d.slots) d = { v: 2, slot: 1, slots: {} };
    var s = d.slots[d.slot || 1] || (d.slots[d.slot || 1] = { lv: 1, xp: 0 });
    fn(s, d);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch (e) { say('저장이 막혀 있어요(사생활 보호 창?)'); return; }
    reload(msg);
  }
  function tpSet(k, v) { if (v == null || v === false || v === 0) delete TP[k]; else TP[k] = v; GR.tpSave(); }
  function reload(msg) {
    ssSet(SS_OPEN, '1'); ssSet(SS_MSG, msg || '바꿨어요'); ssSet(SS_TOP, String(body ? body.scrollTop : 0));
    location.reload();
  }
  function clampLv(n) { return Math.max(1, Math.min(CFG.growth.maxLv, n | 0)); }
  function t2Lv(cls) { var c = CFG.classes[cls]; return c && c.tier2 ? c.tier2.lv || 25 : 999; }
  function branches(cls) { var c = CFG.classes[cls]; return (c && c.tier2 && c.tier2.branches) || []; }
  function t3Of(cls, b) { var L = branches(cls); for (var i = 0; i < L.length; i++) if (L[i].key === b) return L[i].tier3 && !L[i].tier3.soon ? L[i].tier3 : null; return null; }
  function newSkills(clsLv) { return { clsLv: clsLv, lv: {}, bar: [], v: 2 }; }

  // ---------- 하는 것들 ----------
  function setLv(n) {
    n = clampLv(n);
    editSave(function (s) { s.lv = n; s.xp = 0; }, 'Lv ' + n + ' 로 바꿨어요');
  }
  function job1(cls) {
    editSave(function (s) {
      var lv = s.lv || 1;
      s['class'] = cls; s.skills = newSkills(1); s.tier3 = undefined;
      s.tier2Branch = lv >= t2Lv(cls) && branches(cls).length ? branches(cls)[0].key : undefined;   // 2차 Lv 이 넘었으면 첫 갈래로(고르기 화면 없이)
      if (!s.wpn) s.wpn = { lv: 0, ench: [null, null, null] };
    }, nameOf(cls) + '(으)로 1차 전직했어요');
  }
  function job2(b) {
    var cls = GR.cls; if (!cls) return say('먼저 1차 전직을 하세요');
    var B = branches(cls).filter(function (q) { return q.key === b; })[0]; if (!B) return;
    editSave(function (s) {
      if ((s.lv || 1) < t2Lv(cls)) { s.lv = t2Lv(cls); s.xp = 0; }
      s.tier2Branch = b; s.tier3 = undefined;
    }, B.name + '(으)로 2차 전직했어요');
  }
  function job3(cls, b) {
    var T = t3Of(cls, b); if (!T) return;
    tpSet('t3', 1);
    editSave(function (s) {
      if (s['class'] !== cls) { s['class'] = cls; s.skills = newSkills(1); }
      if (!s.wpn) s.wpn = { lv: 0, ench: [null, null, null] };
      if ((s.lv || 1) < (T.lv || 50)) { s.lv = T.lv || 50; s.xp = 0; }
      s.tier2Branch = b; s.tier3 = 1;
    }, T.name + '(으)로 3차 전직했어요 (시험)');
  }
  function addPts(n) {
    if (!GR.cls) return say('먼저 1차 전직을 하세요');
    backup(); tpSet('pts', Math.max(0, (TP.pts | 0) + n)); reload('기술 점수 +' + n);
  }
  function learnAll() {
    var bk = GR.book(GR.cls); if (!GR.cls || !bk) return say('먼저 1차 전직을 하세요');
    backup();
    var need = 0;
    bk.list().forEach(function (e) { if (bk.unlocked(e.id)) need += Math.max(0, bk.maxLv(e.id) - bk.lv(e.id)); });
    if (need > bk.pts()) tpSet('pts', (TP.pts | 0) + need - bk.pts());
    var guard = 0, any = true;
    while (any && guard++ < 50) { any = false; bk.list().forEach(function (e) { if (bk.unlocked(e.id) && bk.lv(e.id) < bk.maxLv(e.id) && bk.add(e.id)) any = true; }); }
    bk.fill();
    if (!GR.noSave) GR.save();
    reload('지금 열린 기술을 전부 최대로 배웠어요');
  }
  function setWpn(lv) {
    if (!GR.cls) return say('먼저 1차 전직을 하세요');
    editSave(function (s) { s.wpn = s.wpn || { lv: 0, ench: [null, null, null] }; s.wpn.lv = lv; }, '무기 +' + lv + ' 로 바꿨어요');
  }
  function setEls(list) {
    if (!GR.cls) return say('먼저 1차 전직을 하세요');
    editSave(function (s) { s.wpn = s.wpn || { lv: 0, ench: [null, null, null] }; s.wpn.ench = [list[0] || null, list[1] || null, list[2] || null]; },
      list.length ? '속성: ' + list.map(function (k) { return EN.el[k].name; }).join(' · ') : '속성을 비웠어요');
  }
  function giveStones() {
    editSave(function (s) { s.stones = 9999; s.crys = {}; EN.order.forEach(function (k) { s.crys[k] = 9999; }); }, '강화석 · 결정 9999개씩 받았어요');
  }
  function openStages() {
    editSave(function (s) {
      var ids = CFG.stages.map(function (q) { return q.id; });
      s.modes = s.modes || { cur: 'normal', cleared: {} }; s.modes.cleared = s.modes.cleared || {};
      (CFG.modes.order || []).forEach(function (k) { var L = s.modes.cleared[k] || []; ids.forEach(function (id) { if (L.indexOf(id) < 0) L.push(id); }); s.modes.cleared[k] = L.sort(function (a, b) { return a - b; }); });
    }, '1~' + CFG.stages.length + '판을 전부 깬 것으로 했어요');
  }
  function resetTest() {
    Object.keys(TP).forEach(function (k) { delete TP[k]; }); GR.tpSave();
    reload('테스트 설정(3차 · 추가 기술 점수 · 무적 · 한 방 · 성별)을 껐어요');
  }
  function restoreSave() {
    var b = null; try { b = JSON.parse(lsGet(BAK_KEY) || 'null'); } catch (e) { b = null; }
    if (!b) return say('보관된 원래 저장이 없어요 (아직 아무것도 안 바꿨어요)');
    if (!window.confirm('테스트 전 원래 저장으로 되돌릴까요?\n(테스트로 바꾼 레벨 · 직업 · 강화 · 판이 전부 원래대로 돌아가요)')) return;
    try {
      if (b.raw == null) localStorage.removeItem(SAVE_KEY); else localStorage.setItem(SAVE_KEY, b.raw);
      localStorage.removeItem(BAK_KEY);
    } catch (e) {}
    Object.keys(TP).forEach(function (k) { delete TP[k]; }); GR.tpSave();
    // 게임이 닫히면서 지금 상태를 다시 저장하지 않게 바로 새로고침
    reload('원래 저장으로 되돌렸어요');
  }
  function nameOf(cls) { for (var i = 0; i < CLS.length; i++) if (CLS[i][0] === cls) return CLS[i][1]; return cls; }

  // ---------- 화면 ----------
  var css = [
    '.tpov{position:fixed;inset:0;z-index:9000;background:rgba(10,8,18,.86);display:flex;flex-direction:column;font:700 14px/1.3 var(--ui,sans-serif);color:#f3ead2;touch-action:pan-y}',
    '.tpov[hidden]{display:none}',
    '.tphead{display:flex;align-items:center;gap:8px;padding:6px max(10px,env(safe-area-inset-right)) 6px max(10px,env(safe-area-inset-left));background:#2a1f3a;border-bottom:3px solid #ffd23f}',
    '.tphead b{font-size:17px;color:#ffd23f;white-space:nowrap}.tphead .tpnow{flex:1;min-width:0;font-size:12px;color:#d8cfe8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.tpbody{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:8px max(10px,env(safe-area-inset-right)) 24px max(10px,env(safe-area-inset-left))}',
    '.tpsec{margin:0 0 10px;padding:8px;border:2px solid #5a4a78;background:#1c1628;border-radius:4px}',
    '.tpsec h3{margin:0 0 6px;font-size:14px;color:#ffd23f}.tpsec h3 small{color:#bfb3d6;font-weight:400;font-size:12px;margin-left:6px}',
    '.tprow{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 6px}.tprow>em{font-style:normal;color:#bfb3d6;min-width:44px;font-size:12px}',
    '.tpb{min-height:40px;min-width:52px;padding:6px 12px;border:2px solid #ffd23f;background:#3a2c52;color:#fff6d8;font:700 14px/1.1 var(--ui,sans-serif);border-radius:4px;cursor:pointer}',
    '.tpb:active{transform:translateY(1px);background:#55417a}.tpb.on{background:#ffd23f;color:#2a1f3a}.tpb.warn{border-color:#ff7a6a;background:#4a2430}',
    '.tpb[disabled]{opacity:.4}.tpb.sm{min-width:40px;padding:6px 8px}',
    '.tpx{min-height:40px;padding:6px 16px;border:2px solid #fff;background:#c0392b;color:#fff;font:700 15px/1 var(--ui,sans-serif);border-radius:4px}',
    '.tpmsg{position:fixed;left:50%;top:56px;transform:translateX(-50%);z-index:9100;background:#ffd23f;color:#2a1f3a;padding:8px 14px;border-radius:4px;font:700 14px/1.2 var(--ui,sans-serif);pointer-events:none;max-width:90vw;text-align:center}',
    '.tpmsg[hidden]{display:none}.tpnote{font-size:12px;color:#bfb3d6;font-weight:400;margin:2px 0 0}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var ov = document.createElement('div'); ov.className = 'tpov'; ov.id = 'tpPanel'; ov.hidden = true;
  ov.innerHTML = '<div class="tphead"><b>테스트 모드</b><span class="tpnow" id="tpNow"></span><button type="button" class="tpx" id="tpClose">닫기</button></div><div class="tpbody" id="tpBody"></div>';
  document.querySelector('.game').appendChild(ov);
  var msgEl = document.createElement('div'); msgEl.className = 'tpmsg'; msgEl.hidden = true; document.body.appendChild(msgEl);
  var body = ov.querySelector('#tpBody'), msgT = 0;
  function say(t) { msgEl.textContent = t; msgEl.hidden = false; clearTimeout(msgT); msgT = setTimeout(function () { msgEl.hidden = true; }, 2200); }

  function btn(label, fn, cls) { var b = document.createElement('button'); b.type = 'button'; b.className = 'tpb' + (cls ? ' ' + cls : ''); b.innerHTML = label; b.addEventListener('click', function (e) { e.stopPropagation(); fn(); }); return b; }
  function row(sec, label, list) { var r = document.createElement('div'); r.className = 'tprow'; if (label) { var em = document.createElement('em'); em.textContent = label; r.appendChild(em); } list.forEach(function (b) { r.appendChild(b); }); sec.appendChild(r); return r; }
  function sec(title, note) { var s = document.createElement('div'); s.className = 'tpsec'; s.innerHTML = '<h3>' + title + (note ? '<small>' + note + '</small>' : '') + '</h3>'; body.appendChild(s); return s; }
  function nowTxt() {
    var c = GR.cls, t = c ? (GR.tier3Info && GR.t3On(c) ? GR.tier3Info(c).name : GR.tier2Info(c) && GR.lv >= t2Lv(c) ? GR.tier2Info(c).name : nameOf(c)) : '견습';
    var w = c && GR.weapon(c), bk = c && GR.book(c);
    return 'Lv ' + GR.lv + ' · ' + t + ' · ' + (API.charKey() === 'female' ? '여' : '남') + (w ? ' · 무기 +' + w.lv() : '') + (bk ? ' · 기술 점수 ' + bk.pts() : '') + (TP.t3 ? ' · 3차 켬' : '') + (TP.god ? ' · 무적' : '') + (TP.oneHit ? ' · 한 방' : '');
  }
  var viewStage = 11, trainType = API.trainType() || 'goblin';

  function build() {
    body.innerHTML = '';
    document.getElementById('tpNow').textContent = nowTxt();
    var c = GR.cls;
    // 1. 레벨
    var s1 = sec('레벨', '바꾸면 화면이 한 번 새로 열려요');
    row(s1, '', LVS.map(function (n) { return btn('Lv ' + n, function () { setLv(n); }, GR.lv === n ? 'on' : ''); })
      .concat([btn('-5', function () { setLv(GR.lv - 5); }, 'sm'), btn('+5', function () { setLv(GR.lv + 5); }, 'sm')]));
    // 2. 전직
    var s2 = sec('전직');
    row(s2, '1차', CLS.map(function (q) { return btn(q[1], function () { job1(q[0]); }, c === q[0] ? 'on' : ''); }));
    if (c && branches(c).length) row(s2, '2차', branches(c).map(function (b) {
      return btn(b.key.toUpperCase() + ' ' + b.name, function () { job2(b.key); }, GR.branch === b.key && GR.lv >= t2Lv(c) ? 'on' : '');
    }));
    else row(s2, '2차', []).insertAdjacentHTML('beforeend', '<span class="tpnote">1차 전직(기사 · 법사 · 궁수 · 암살자)을 먼저 고르세요</span>');
    var t3b = [];
    CLS.forEach(function (q) { branches(q[0]).forEach(function (b) { var T = t3Of(q[0], b.key); if (T) t3b.push(btn(T.name + ' <small>(' + q[1] + ' ' + b.key.toUpperCase() + ' ' + b.name + ')</small>', function () { job3(q[0], b.key); }, c === q[0] && GR.branch === b.key && GR.t3On(c) ? 'on' : '')); }); });
    var r3 = row(s2, '3차', t3b);
    r3.insertAdjacentHTML('beforeend', '<span class="tpnote">3차 (검성·현자만, 만드는 중) · 이 테스트에서만 켜져요</span>');
    if (TP.t3) r3.appendChild(btn('3차 끄기', function () { tpSet('t3', null); reload('3차를 껐어요(2차로 보임)'); }, 'warn'));
    row(s2, '성별', [['male', '남'], ['female', '여']].map(function (g) {
      return btn(g[1], function () { tpSet('chr', g[0] === 'male' ? null : g[0]); API.setChar(g[0]); build(); say(g[1] + '자 옷으로 바꿨어요'); }, API.charKey() === g[0] ? 'on' : '');
    }));
    // 3. 기술
    var s3 = sec('기술 점수', c ? '' : '1차 전직 뒤에 써요');
    row(s3, '', [btn('기술 점수 +50', function () { addPts(50); }), btn('모든 기술 최대로 배우기', learnAll)]);
    s3.insertAdjacentHTML('beforeend', '<p class="tpnote">「모든 기술 최대로」 = 지금 레벨에서 열린 기술 전부. 높은 기술까지 보려면 먼저 Lv 60 으로</p>');
    // 4. 무기
    var s4 = sec('무기 강화', '강화석 없이 바로');
    var w = c && GR.weapon(c), wl = w ? w.lv() : -1;
    row(s4, '단계', [0, 3, 6, 9, 10].map(function (n) { return btn('+' + n, function () { setWpn(n); }, wl === n ? 'on' : ''); }));
    var cur = w ? w.st.ench.filter(Boolean) : [], pick = cur.slice();
    var elBtns = EN.order.map(function (k) {
      var b = btn(EN.el[k].name, function () {
        var i = pick.indexOf(k); if (i >= 0) pick.splice(i, 1); else if (pick.length < 3) pick.push(k); else return say('속성은 3개까지');
        b.classList.toggle('on', pick.indexOf(k) >= 0); apply.disabled = pick.join() === cur.join();
      }, cur.indexOf(k) >= 0 ? 'on' : '');
      b.style.borderColor = EN.el[k].col2 || ''; return b;
    });
    row(s4, '속성', elBtns);
    var apply = btn('속성 넣기', function () { setEls(pick); }); apply.disabled = true;
    row(s4, '', [apply, btn('속성 비우기', function () { setEls([]); }), btn('강화석 · 결정 9999개', giveStones)]);
    s4.insertAdjacentHTML('beforeend', '<p class="tpnote">속성 칸은 +' + EN.slotLv.join(' · +') + ' 에 하나씩 열려요(고른 순서대로 1 · 2 · 3번 칸). 강화석을 받으면 강화 창 「강화」 단추도 마음껏</p>');
    // 5. 판
    var s5 = sec('판 · 싸움');
    row(s5, '', [btn('1~' + CFG.stages.length + '판 전부 열기', openStages),
      btn('무적 ' + (TP.god ? '켜짐' : '꺼짐'), function () { tpSet('god', TP.god ? null : 1); API.setGod(!!TP.god); build(); say(TP.god ? '무적 켜짐' : '무적 꺼짐'); }, TP.god ? 'on' : ''),
      btn('한 방에 쓰러뜨리기 ' + (TP.oneHit ? '켜짐' : '꺼짐'), function () { tpSet('oneHit', TP.oneHit ? null : 1); API.setOneHit(!!TP.oneHit); build(); say(TP.oneHit ? '한 방 켜짐' : '한 방 꺼짐'); }, TP.oneHit ? 'on' : '')]);
    var jumps = API.stages.map(function (q, i) { return btn(String(q.id), function () { close(true); API.go(i + 1); }, 'sm' + (API.stageNo() === i + 1 ? ' on' : '')); });
    row(s5, '판 가기', jumps);
    // 5-2. 테스트 맵(허수아비 몹: 안 움직이고 · 안 때리고 · 안 쓰러짐)
    var sT = sec('테스트 맵', '몹 5마리가 가만히 서서 맞기만 해요 · 안 쓰러짐 · 데미지 숫자 비교');
    var inT = API.inTrain();
    row(sT, '', [btn(inT ? '테스트 맵 다시 열기' : '테스트 맵 열기', function () { close(true); API.train(trainType); }, 'on'),
      btn('몹 제자리', function () { if (!API.inTrain()) return say('테스트 맵에서 써요'); close(true); API.trainReset(); say('몹을 제자리에 다시 세웠어요'); }),
      btn('스테이지 고르기로 나가기', function () { close(true); API.select(); })]);
    var seen = {}, types = [];
    API.stages.forEach(function (q, i) { API.enemiesOf(i + 1).forEach(function (t) { if (!seen[t]) { seen[t] = 1; types.push(t); } }); });
    var tr = row(sT, '몹 종류', types.map(function (t) {
      return btn(CFG.enemies[t].label || t, function () { trainType = t; tr.querySelectorAll('.tpb').forEach(function (b) { b.classList.toggle('on', b.dataset.t === t); }); }, 'sm' + (trainType === t ? ' on' : ''));
    }));
    tr.querySelectorAll('.tpb').forEach(function (b, i) { b.dataset.t = types[i]; });
    sT.insertAdjacentHTML('beforeend', '<p class="tpnote">몹 종류를 고른 뒤 「테스트 맵 열기」. 밀려난 몹은 잠깐 뒤 제자리로 돌아와요. 클리어 · 시간 제한 없음 → 나갈 땐 위 「판 가기」나 「스테이지 고르기로 나가기」</p>');
    // 6. 몹 구경
    var s6 = sec('몹 구경', '11~20판 · 누르면 그 판에서 다른 적을 치우고 그 적 하나만 나와요');
    var idx = [];
    API.stages.forEach(function (q, i) { if (q.id >= 11 && q.id <= 20) idx.push(i + 1); });
    row(s6, '판', idx.map(function (n) { return btn(String(API.stages[n - 1].id), function () { viewStage = n; build(); body.scrollTop = body.scrollHeight; }, 'sm' + (viewStage === n ? ' on' : '')); }));
    if (idx.indexOf(viewStage) < 0) viewStage = idx[0];
    if (viewStage) {
      var n = viewStage, L = API.enemiesOf(n).map(function (t) { var E = CFG.enemies[t]; return btn((E.label || t), function () { close(true); API.spawn(n, t); }); });
      if (API.hasMid(n)) L.push(btn('중간보스 ' + API.midName(n), function () { close(true); API.spawn(n, 'mid'); }, 'warn'));
      var bt = API.bossOf(n); if (bt) L.push(btn('보스 ' + (API.stages[n - 1].bossName || CFG.enemies[bt].label || bt), function () { close(true); API.spawn(n, 'boss'); }, 'warn'));
      row(s6, API.stages[n - 1].name.replace(/^STAGE\s*\d+\s*/, ''), L);
    }
    // 7. 되돌리기
    var s7 = sec('되돌리기');
    row(s7, '', [btn('테스트 설정 끄기', resetTest), btn('원래 저장으로 되돌리기', restoreSave, 'warn')]);
    s7.insertAdjacentHTML('beforeend', '<p class="tpnote">' + (hasBackup() ? '테스트 전 저장이 보관돼 있어요(' + (function () { try { return JSON.parse(lsGet(BAK_KEY)).at.slice(0, 16).replace('T', ' '); } catch (e) { return ''; } })() + ')' : '아직 바꾼 것이 없어요. 처음 바꿀 때 원래 저장을 자동으로 보관해요') +
      ' · 「테스트 설정 끄기」 = 3차 · 추가 기술 점수 · 무적 · 한 방 · 성별만 끔(레벨 · 직업 · 강화는 그대로)</p>');
  }

  var wasPaused = false;
  function open() {
    if (!ov.hidden) return;
    wasPaused = !!GM.paused; GM.paused = true;
    if (window.Input && Input.setOverride) Input.setOverride(null);
    build(); ov.hidden = false;
  }
  // keepGo = 판 가기 · 몹 구경(그쪽이 멈춤을 풂)
  function close(keepGo) { if (ov.hidden) return; ov.hidden = true; if (!keepGo) GM.paused = wasPaused; }
  ov.querySelector('#tpClose').addEventListener('click', function () { close(false); });
  // 창이 열린 동안 키 · 터치가 뒤 게임 · 메뉴로 안 넘어가게(닫기 = Esc)
  window.addEventListener('keydown', function (e) { if (ov.hidden) return; if (e.code === 'Escape') close(false); e.stopPropagation(); }, true);
  ['pointerdown', 'touchstart'].forEach(function (t) { ov.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true }); });

  [['tpSetRow', null], ['btnTpSel', null]].forEach(function (q) { var el = document.getElementById(q[0]); if (el) el.hidden = false; });
  var bs = document.getElementById('btnTpSet'); if (bs) bs.addEventListener('click', function () { this.blur(); open(); });
  var bl = document.getElementById('btnTpSel'); if (bl) bl.addEventListener('click', function () { this.blur(); open(); });
  window.TestPanel = { open: open, close: close };

  // 새로고침 뒤: 게임이 다 뜨면 창을 다시 열고 알림
  if (ssGet(SS_OPEN)) {
    var m = ssGet(SS_MSG), top = +ssGet(SS_TOP) || 0;
    ssSet(SS_OPEN, null); ssSet(SS_MSG, null); ssSet(SS_TOP, null);
    (function wait() {
      if (!document.body.classList.contains('ready')) return setTimeout(wait, 150);
      setTimeout(function () { open(); body.scrollTop = top; if (m) say(m); }, 200);
    })();
  }
})();
