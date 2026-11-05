// 성장: 레벨·경험치 계산 + 능력치 점수 + 저장 (2026-11-05, 기획\성장시스템-설계안.md 1·2단계 / 2026-11-06 전직·능력치). 수치는 config.js 의 growth
//   main.js 가 쓰는 것: Growth.lv / xp / need() / maxHp(직업) / atkMul(마법?) / enemyXp(적, 판 순서) / gain(경험치) / isMax()
//     능력치(2026-11-06): stats { str, agi, vit, int, wis } / pts(안 쓴 점수) / add(이름) / reset() / auto(직업) / atkSpd() / moveMul() / critChance()
//   저장 = 이 브라우저 localStorage 'pixelBrawler.save' = { v: 2, slot: 1, slots: { 1: { lv, xp, class, stats, pts } } }
//     class = 전직한 직업('knight' / 'mage', 2026-11-06). 없으면 견습(맨손). 한 번 정하면 setClass 가 안 바꿈(새 저장칸에서 다른 직업)
//     stats = 올린 능력치, pts = 안 쓴 점수. 예전 저장(능력치 없음, v1)은 지금 레벨만큼 점수를 한꺼번에 줌(3 × (Lv-1), 안 쓴 채로)
//     지금은 1번 칸만 씀(저장칸 고르기 화면은 나중). 깬 판 목록(pixelBrawler.clearedIds)은 예전 그대로 따로 둠 → 예전 저장 안 깨짐
//     저장이 막혀 있어도(사생활 보호 창 등) 게임은 됨: 이번에 연 동안만 기억
//   시험: 주소 뒤 ?lv=N = 이번 창에서만 LvN(경험치 0, 능력치 0 + 그 레벨 점수)으로 시작, 저장 안 함(저장된 레벨·능력치는 그대로)
(function () {
  var CFG = window.CFG, GR = CFG.growth, ST = GR.stats;
  var SAVE_KEY = 'pixelBrawler.save';
  var KEYS = ['str', 'agi', 'vit', 'int', 'wis'];
  var params = new URLSearchParams(location.search);

  function clampLv(n) { return Math.max(1, Math.min(GR.maxLv, n | 0)); }
  // lv 에서 다음 레벨까지 필요한 경험치 (최고 레벨이면 0)
  function need(lv) { return lv >= GR.maxLv ? 0 : GR.needBase + GR.needPerLv * lv; }
  // 그 레벨까지 받은 능력치 점수 합
  function ptsFor(lv) { return ST.perLv * (lv - 1); }
  function zero() { var o = {}; KEYS.forEach(function (k) { o[k] = 0; }); return o; }

  // 저장 읽기: 없거나 깨졌으면 Lv1. 숫자는 범위 안으로 맞춤
  function readSave() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || !d.slots || typeof d.slots !== 'object') d = { v: 2, slot: 1, slots: {} };
    if (!d.slot) d.slot = 1;
    d.v = 2;
    return d;
  }
  var data = readSave();
  var cur = data.slots[data.slot] || {};
  var G = {
    lv: clampLv(cur.lv || 1),
    xp: 0,
    cls: CFG.classes[cur['class']] && cur['class'] !== 'novice' ? cur['class'] : null,   // 전직한 직업(없으면 null = 견습)
    stats: zero(),      // 올린 능력치
    pts: 0,             // 안 쓴 점수
    noSave: false,      // ?lv=N 시험 중이면 true(저장 안 함)
    keys: KEYS,
    need: function (lv) { return need(lv == null ? G.lv : lv); },
    isMax: function () { return G.lv >= GR.maxLv; },
    // 최대 체력: 기본 + 레벨 몫 + 체력(VIT) + 직업 몫(기사가 더 튼튼). 직업 = 지금 입은 직업(시험 버튼 포함), 없으면 저장된 직업
    maxHp: function (cls) {
      var cb = GR.classBase && GR.classBase[cls || G.cls || 'novice'];
      return Math.round(CFG.hero.hp + GR.hpPerLv * (G.lv - 1) + ST.vit * G.stats.vit + ((cb && cb.hp) || 0));
    },
    // 공격 배율: 레벨 몫 + 힘(물리) 또는 지능(마법). magic = 법사 지팡이·완드(config weapons 의 magic)
    atkMul: function (magic) { return 1 + GR.atkPerLv * (G.lv - 1) + (magic ? ST.int * G.stats.int : ST.str * G.stats.str); },
    // 민첩: 콤보 휘두르는 빠르기 · 이동 빠르기(둘 다 spdCap 까지) · 치명타 확률(critCap 까지)
    atkSpd: function () { return 1 + Math.min(ST.agi.spdCap, ST.agi.atkSpd * G.stats.agi); },
    moveMul: function () { return 1 + Math.min(ST.agi.spdCap, ST.agi.move * G.stats.agi); },
    critChance: function () { return Math.min(ST.agi.critCap, ST.agi.crit * G.stats.agi); },
    // 능력치 한 점 올리기(점수가 있으면). 올렸으면 true
    add: function (k, n) {
      n = Math.min(n || 1, G.pts);
      if (KEYS.indexOf(k) < 0 || n <= 0) return false;
      G.stats[k] += n; G.pts -= n; G.save();
      return true;
    },
    // 초기화: 올린 점수 전부 돌려받음(공짜)
    reset: function () {
      KEYS.forEach(function (k) { G.pts += G.stats[k]; G.stats[k] = 0; });
      G.save();
    },
    // 자동 배분: 남은 점수를 직업 비율(config growth.stats.auto)대로. 한 점씩 「목표보다 가장 모자란」 능력치에(같으면 비율 큰 쪽)
    auto: function (cls) {
      var W = ST.auto[cls] || ST.auto.novice, wk = Object.keys(W), wsum = 0;
      wk.forEach(function (k) { wsum += W[k]; });
      if (!G.pts) return false;
      while (G.pts > 0) {
        var tot = 0, best = null, bd = -1e9;
        wk.forEach(function (k) { tot += G.stats[k]; });
        wk.forEach(function (k) { var d = W[k] * (tot + 1) / wsum - G.stats[k] + W[k] * 1e-6; if (d > bd) { bd = d; best = k; } });
        G.stats[best]++; G.pts--;
      }
      G.save();
      return true;
    },
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
    // 경험치 얻기 → 오른 레벨 수(0이면 안 오름). 최고 레벨이면 더 안 쌓임. 레벨마다 능력치 점수 perLv
    gain: function (n) {
      if (!(n > 0) || G.isMax()) return 0;
      var up = 0;
      G.xp += n;
      while (!G.isMax() && G.xp >= need(G.lv)) { G.xp -= need(G.lv); G.lv++; up++; }
      if (G.isMax()) G.xp = 0;
      G.pts += ST.perLv * up;
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
      data.slots[data.slot] = { lv: G.lv, xp: G.xp, 'class': G.cls, stats: G.stats, pts: G.pts };
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {}
    },
    // 시험용: 지금 저장 내용 그대로
    saved: function () { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; } }
  };
  G.xp = Math.max(0, Math.min(need(G.lv) - 1, (cur.xp | 0)));
  if (G.isMax()) G.xp = 0;
  // 능력치: 저장에 있으면 그대로(음수·이상한 값은 0). 예전 저장(stats 없음)은 지금 레벨만큼 점수를 줌
  //   올린 점수 + 남은 점수가 레벨 몫과 다르면(저장이 꼬임) 레벨 몫에 맞춰 남은 점수를 고침(모자라면 채우고, 넘치면 초기화)
  if (cur.stats && typeof cur.stats === 'object') {
    KEYS.forEach(function (k) { G.stats[k] = Math.max(0, cur.stats[k] | 0); });
    G.pts = Math.max(0, cur.pts | 0);
  } else G.pts = ptsFor(G.lv);
  var used = 0;
  KEYS.forEach(function (k) { used += G.stats[k]; });
  if (used > ptsFor(G.lv)) { G.stats = zero(); used = 0; }
  G.pts = ptsFor(G.lv) - used;
  // ?lv=N 시험: 이번 창에서만
  var dbgLv = parseInt(params.get('lv'), 10);
  if (dbgLv > 0) { G.lv = clampLv(dbgLv); G.xp = 0; G.stats = zero(); G.pts = ptsFor(G.lv); G.noSave = true; }
  window.Growth = G;
})();
