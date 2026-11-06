// 성장: 레벨·경험치 계산 + 능력치 점수 + 저장 (2026-11-05, 기획\성장시스템-설계안.md 1·2단계 / 2026-11-06 전직·능력치). 수치는 config.js 의 growth
//   main.js 가 쓰는 것: Growth.lv / xp / need() / maxHp(직업) / atkMul(마법?) / enemyXp(적, 판 순서) / gain(경험치) / isMax()
//     능력치(2026-11-06): stats { str, agi, vit, int, wis } / pts(안 쓴 점수) / add(이름) / reset() / auto(직업) / atkSpd() / moveMul() / critChance()
//     마나(2026-11-06): maxMp(직업) / mpRegen(직업) (초당)
//     기술 책(2026-11-06 성장 4단계): book(직업) → { lv(id), pts(), add(id), reset(), slots(), at(칸), put(칸, id), bonus(stat), … } (아래 makeBook)
//   저장 = 이 브라우저 localStorage 'pixelBrawler.save' = { v: 2, slot: 1, slots: { 1: { lv, xp, class, stats, pts, skills } } }
//     skills = 기술 책 { clsLv, lv: { id: 올린 수 }, bar: [칸에 끼운 id] } (직업이 있을 때만)
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
  // ---------- 기술 책 (2026-11-06, 성장 4단계. 수치 = config skills: tree·perLv·maxLv·slots·moreLv·test) ----------
  //   저장되는 것 sk = { clsLv = 전직한 Lv, lv = { 기술 id: 기술 점수로 올린 수 }, bar = [칸 1~4 에 끼운 기술 id] }
  //   기술 Lv = 열렸으면 1 + 올린 수(최고 maxLv), 안 열렸으면 0. 기술 점수 = (지금 Lv - 전직 Lv) x perLv - 쓴 점수
  var SK = CFG.skills || {};
  var realBook = null, testBooks = {};
  function treeOf(cls) { return (SK.tree && SK.tree[cls]) || null; }
  function newSk(clsLv) { return { clsLv: clsLv, lv: {}, bar: [] }; }
  function makeBook(cls, st, test) {
    var L = treeOf(cls), byId = {};
    L.forEach(function (e) { byId[e.id] = e; });
    var B = {
      cls: cls, test: !!test,
      list: function () { return L; },
      entry: function (id) { return byId[id] || null; },
      // 쓰는 기술(칸에 끼우는 것)인가: 준비 중·늘 켜진 기술이 아니고 SKILLS 에 동작이 있음
      isActive: function (id) { var e = byId[id]; return !!(e && !e.soon && !e.passive && SK[cls] && SK[cls][id]); },
      // 열렸나: 시험 책 = 준비 중 빼고 전부, 저장 책 = 그 레벨이 됨(unlock 0 = 전직 즉시)
      unlocked: function (id) { var e = byId[id]; return !!e && !e.soon && (test || G.lv >= (e.unlock || 0)); },
      lv: function (id) { return B.unlocked(id) ? 1 + (st.lv[id] || 0) : 0; },
      total: function () { return test ? ((SK.test && SK.test.pts) || 0) : Math.max(0, G.lv - st.clsLv) * (SK.perLv || 1); },
      used: function () { var n = 0; Object.keys(st.lv).forEach(function (k) { n += st.lv[k]; }); return n; },
      pts: function () { return Math.max(0, B.total() - B.used()); },
      // 기술 점수 1점 → 그 기술 Lv +1 (열려 있고 최고 Lv 아님)
      add: function (id) {
        if (!B.pts() || !B.unlocked(id) || B.lv(id) >= (SK.maxLv || 5)) return false;
        st.lv[id] = (st.lv[id] || 0) + 1; B.save();
        return true;
      },
      // 초기화(공짜): 쓴 기술 점수 전부 돌려받음 → 열린 기술은 모두 Lv1
      reset: function () { st.lv = {}; B.save(); },
      // 칸 수: 시험 책 = 늘 가장 많이, 저장 책 = moreLv 마다 하나씩 늘어남(2026-11-06 밤: [2, 3, 4] / Lv10 · Lv13, 2026-11-06 Lv9 → 10)
      slots: function () {
        var S = SK.slots || [2, 4], M = [].concat(SK.moreLv || 13), n = S[0];
        if (test) return S[S.length - 1];
        M.forEach(function (lv, k) { if (G.lv >= lv && S[k + 1] != null) n = S[k + 1]; });
        return n;
      },
      // i 번째 칸(0부터)이 열리는 레벨(처음부터 있으면 0) — 기술 창 「LvN에 열림」
      slotLv: function (i) {
        var S = SK.slots || [2, 4], M = [].concat(SK.moreLv || 13);
        if (i < S[0]) return 0;
        for (var k = 0; k < M.length; k++) if (i < S[k + 1]) return M[k];
        return M[M.length - 1];
      },
      // i 번째 칸(0부터)에 끼운 기술 id (안 보이는 칸·안 열린 기술이면 null)
      at: function (i) { var id = i < B.slots() ? st.bar[i] : null; return id && B.unlocked(id) && B.isActive(id) ? id : null; },
      bar: function () { var a = []; for (var i = 0; i < B.slots(); i++) a.push(B.at(i)); return a; },
      // i 번째 칸에 끼우기. 다른 칸에 이미 있으면 서로 자리 바꿈
      put: function (i, id) {
        if (i < 0 || i >= B.slots() || !B.isActive(id) || !B.unlocked(id)) return false;
        var j = st.bar.indexOf(id);
        if (j === i) return true;
        if (j >= 0) st.bar[j] = st.bar[i] || null;
        st.bar[i] = id; B.save();
        return true;
      },
      // 빈 칸에 열린 쓰는 기술을 순서대로 저절로 끼움(전직·레벨업·불러오기 때)
      fill: function () {
        var changed = false;
        L.forEach(function (e) {
          if (!B.isActive(e.id) || !B.unlocked(e.id) || B.bar().indexOf(e.id) >= 0) return;
          for (var i = 0; i < B.slots(); i++) if (!B.at(i)) { var j = st.bar.indexOf(e.id); if (j >= 0) st.bar[j] = null; st.bar[i] = e.id; changed = true; return; }
        });
        if (changed) B.save();
      },
      // 늘 켜진 기술 합: stat('phys' / 'magic' / 'guard' / 'mpRegen') → 0.12 = +12%
      bonus: function (stat) {
        var n = 0;
        L.forEach(function (e) { var P = e.passive; if (P && P.val && P.stat === stat && B.unlocked(e.id)) n += P.val[B.lv(e.id) - 1] || 0; });
        return n;
      },
      save: function () { if (!test) G.save(); }
    };
    return B;
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
    // 최대 마나: 직업 기본(법사가 많음) + 레벨 몫 + 지혜(WIS)
    maxMp: function (cls) {
      var cb = GR.classBase && GR.classBase[cls || G.cls || 'novice'];
      return Math.round(((cb && cb.mp) || 0) + GR.mp.perLv * (G.lv - 1) + ST.wis.mp * G.stats.wis);
    },
    // 마나 회복(초당): 기본 + 지혜. cls = 지금 입은 직업(늘 켜진 기술 「마나 순환」이 있으면 그만큼 더)
    mpRegen: function (cls) { var b = G.book(cls); return (GR.mp.regen + ST.wis.regen * G.stats.wis) * (1 + (b ? b.bonus('mpRegen') : 0)); },
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
      if (up && G.cls) G.book(G.cls).fill();   // 새로 열린 기술 · 늘어난 칸(Lv13)에 저절로 끼움
      G.save();
      return up;
    },
    // 전직: 이 저장칸에 직업을 한 번만 정함(이미 있으면 안 바꿈 → false). 기술 책은 이 레벨부터(첫 기술 Lv1, 기술 점수는 다음 레벨부터)
    setClass: function (k) {
      if (G.cls || !CFG.classes[k] || k === 'novice') return false;
      G.cls = k; G.sk = newSk(G.lv); realBook = null;
      G.book(k).fill();
      G.save();
      return true;
    },
    // 기술 책(2026-11-06): 그 직업의 기술 열림·기술 Lv·기술 점수·기술 칸 (아래 makeBook). 기술이 없는 직업(견습)은 null
    //   저장된 직업 = 저장되는 책, 시험 버튼으로 입은 다른 직업 = 시험 책(이번 창에서만, config skills.test)
    book: function (cls) {
      cls = cls || G.cls;
      if (!cls || !treeOf(cls)) return null;
      if (cls === G.cls) return realBook || (realBook = makeBook(cls, G.sk, false));
      if (!testBooks[cls]) { testBooks[cls] = makeBook(cls, newSk(1), true); testBooks[cls].fill(); }
      return testBooks[cls];
    },
    // 시험용(GAME.test.skillSetup, ?lv=N 일 때만): 이번 창에서만 「전직한 저장」처럼 — 직업 cls, 전직 Lv clsLv, 기술 점수를 plan 순서로 돌아가며 씀
    testSetup: function (cls, clsLv, plan) {
      if (!G.noSave || !treeOf(cls)) return null;
      G.cls = cls; G.sk = newSk(Math.min(G.lv, clsLv || SK.classLv)); realBook = null;
      var b = G.book(cls); b.fill();
      var ids = plan || (SK.botPlan && SK.botPlan[cls]) || [], guard = 0;
      while (b.pts() > 0 && guard++ < 200) {
        var any = false;
        ids.forEach(function (id) { if (b.pts() > 0 && b.add(id)) any = true; });
        if (!any) break;
      }
      var o = {}; treeOf(cls).forEach(function (e) { if (b.unlocked(e.id)) o[e.id] = b.lv(e.id); });
      return { lv: o, pts: b.pts(), bar: b.bar() };
    },
    save: function () {
      if (G.noSave) return;
      data.slots[data.slot] = { lv: G.lv, xp: G.xp, 'class': G.cls, stats: G.stats, pts: G.pts, skills: G.cls ? G.sk : undefined };
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
  // 기술 책(2026-11-06): 저장에 있으면 그대로(이상한 값은 버림). 직업은 있는데 기술 책이 없는 예전 저장 = 전직 Lv 를 classLv(7)로 보고
  //   (지금 Lv - 전직 Lv) 점을 안 쓴 채로 줌. 쓴 점수가 받은 점수보다 많으면(저장이 꼬임 · ?lv 로 낮춤) 초기화
  G.sk = newSk(G.lv);
  if (G.cls) {
    var cs = cur.skills, L0 = treeOf(G.cls) || [];
    if (cs && typeof cs === 'object') {
      G.sk.clsLv = clampLv(cs.clsLv || 1);
      // 아직 안 열린 기술에 올려 둔 점수는 돌려받음(2026-11-06 열림 순서 바꿈: 예전 Lv9 저장의 올려베기·땅 융기는 이제 Lv10 에 열림)
      if (cs.lv && typeof cs.lv === 'object') L0.forEach(function (e) { var n = cs.lv[e.id] | 0; if (n > 0 && G.lv >= (e.unlock || 0)) G.sk.lv[e.id] = Math.min((SK.maxLv || 5) - 1, n); });
      if (Array.isArray(cs.bar)) G.sk.bar = cs.bar.slice(0, 4).map(function (id) { return typeof id === 'string' ? id : null; });
    } else G.sk.clsLv = Math.min(G.lv, SK.classLv || 7);
    var bk = G.book(G.cls);
    if (bk.used() > bk.total()) G.sk.lv = {};
    bk.fill();
  }
  window.Growth = G;
})();
