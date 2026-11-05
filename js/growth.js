// 성장: 레벨·경험치 계산 + 저장 (2026-11-05, 기획\성장시스템-설계안.md 1·2단계). 수치는 config.js 의 growth
//   main.js 가 쓰는 것: Growth.lv / xp / need() / maxHp() / atkMul() / enemyXp(적, 판 순서) / gain(경험치) / isMax()
//   저장 = 이 브라우저 localStorage 'pixelBrawler.save' = { v: 1, slot: 1, slots: { 1: { lv, xp, class } } }
//     class = 전직한 직업('knight' / 'mage', 2026-11-06). 없으면 견습(맨손). 한 번 정하면 setClass 가 안 바꿈(새 저장칸에서 다른 직업)
//     지금은 1번 칸만 씀(저장칸 고르기 화면은 나중). 깬 판 목록(pixelBrawler.clearedIds)은 예전 그대로 따로 둠 → 예전 저장 안 깨짐
//     저장이 막혀 있어도(사생활 보호 창 등) 게임은 됨: 이번에 연 동안만 기억
//   시험: 주소 뒤 ?lv=N = 이번 창에서만 LvN(경험치 0)으로 시작, 저장 안 함(저장된 레벨은 그대로)
(function () {
  var CFG = window.CFG, GR = CFG.growth;
  var SAVE_KEY = 'pixelBrawler.save';
  var params = new URLSearchParams(location.search);

  function clampLv(n) { return Math.max(1, Math.min(GR.maxLv, n | 0)); }
  // lv 에서 다음 레벨까지 필요한 경험치 (최고 레벨이면 0)
  function need(lv) { return lv >= GR.maxLv ? 0 : GR.needBase + GR.needPerLv * lv; }

  // 저장 읽기: 없거나 깨졌으면 Lv1. 숫자는 범위 안으로 맞춤
  function readSave() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || !d.slots || typeof d.slots !== 'object') d = { v: 1, slot: 1, slots: {} };
    if (!d.slot) d.slot = 1;
    return d;
  }
  var data = readSave();
  var cur = data.slots[data.slot] || {};
  var G = {
    lv: clampLv(cur.lv || 1),
    cls: CFG.classes[cur['class']] && cur['class'] !== 'novice' ? cur['class'] : null,   // 전직한 직업(없으면 null = 견습)
    xp: 0,
    noSave: false,      // ?lv=N 시험 중이면 true(저장 안 함)
    need: function (lv) { return need(lv == null ? G.lv : lv); },
    isMax: function () { return G.lv >= GR.maxLv; },
    maxHp: function () { return CFG.hero.hp + GR.hpPerLv * (G.lv - 1); },
    atkMul: function () { return 1 + GR.atkPerLv * (G.lv - 1); },
    // 적 종류(config growth 위 설명): 'king' / 'boss' / 'elite' / 'tough' / 'mob'
    kindOf: function (type, T) {
      if (T.finalBoss) return 'king';
      if (T.boss) return 'boss';
      if (GR.kind && GR.kind[type]) return GR.kind[type];
      if (T.hp >= GR.eliteHp) return 'elite';
      if (T.hp >= GR.toughHp) return 'tough';
      return 'mob';
    },
    // 판 배율: idx = 판 목록 순서(0부터)
    stageMul: function (idx) { return 1 + GR.stageMul * Math.max(0, idx || 0); },
    enemyXp: function (type, T, idx) { return Math.round((GR.xp[G.kindOf(type, T)] || 0) * G.stageMul(idx)); },
    // 경험치 얻기 → 오른 레벨 수(0이면 안 오름). 최고 레벨이면 더 안 쌓임
    gain: function (n) {
      if (!(n > 0) || G.isMax()) return 0;
      var up = 0;
      G.xp += n;
      while (!G.isMax() && G.xp >= need(G.lv)) { G.xp -= need(G.lv); G.lv++; up++; }
      if (G.isMax()) G.xp = 0;
      G.save();
      return up;
    },
    // 전직: 이 저장칸에 직업을 한 번만 정함(이미 있으면 안 바꿈 → false)
    setClass: function (k) {
      if (G.cls || !CFG.classes[k] || k === 'novice') return false;
      G.cls = k; G.save();
      return true;
    },
    save: function () {
      if (G.noSave) return;
      data.slots[data.slot] = { lv: G.lv, xp: G.xp, 'class': G.cls };
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {}
    },
    // 시험용: 지금 저장 내용 그대로
    saved: function () { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; } }
  };
  G.xp = Math.max(0, Math.min(need(G.lv) - 1, (cur.xp | 0)));
  if (G.isMax()) G.xp = 0;
  // ?lv=N 시험: 이번 창에서만
  var dbgLv = parseInt(params.get('lv'), 10);
  if (dbgLv > 0) { G.lv = clampLv(dbgLv); G.xp = 0; G.noSave = true; }
  window.Growth = G;
})();
