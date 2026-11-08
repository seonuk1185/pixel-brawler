// 성장: 레벨·경험치 계산 + 능력치 점수 + 저장 (2026-11-05, 기획\성장시스템-설계안.md 1·2단계 / 2026-11-06 전직·능력치). 수치는 config.js 의 growth
//   main.js 가 쓰는 것: Growth.lv / xp / need() / maxHp(직업) / atkMul(마법?) / enemyXp(적, 판 순서) / gain(경험치) / isMax()
//     능력치(2026-11-06): stats { str, agi, vit, int, wis } / pts(안 쓴 점수) / add(이름) / reset() / auto(직업) / atkSpd() / moveMul() / critChance()
//     마나(2026-11-06): maxMp(직업) / mpRegen(직업) (초당)
//     기술 책(2026-11-06 성장 4단계): book(직업) → { lv(id), pts(), add(id), reset(), slots(), at(칸), put(칸, id), bonus(stat), … } (아래 makeBook)
//   저장 = 이 브라우저 localStorage 'pixelBrawler.save' = { v: 2, slot: 1, slots: { 1: { lv, xp, class, stats, pts, skills } } }
//     skills = 기술 책 { clsLv, lv: { id: 올린 수 }, bar: [칸에 끼운 id] } (직업이 있을 때만)
//     class = 전직한 직업('knight' / 'mage', 2026-11-06). 없으면 견습(맨손). 한 번 정하면 setClass 가 안 바꿈(새 저장칸에서 다른 직업)
//     club = 첫 무기 몽둥이를 주웠으면 true(2026-11-06, config club). 없으면(예전 저장) 안 주운 것 → 견습이면 1판에서 다시 나옴
//     stats = 올린 능력치, pts = 안 쓴 점수. 예전 저장(능력치 없음, v1)은 지금 레벨만큼 점수를 한꺼번에 줌(ptsFor = 2026-11-07부터 Lv - 9, 안 쓴 채로)
//     지금은 1번 칸만 씀(저장칸 고르기 화면은 나중). 깬 판 목록은 예전엔 따로(pixelBrawler.clearedIds) → 2026-11-06 부터 저장칸의 modes(아래)
//     난이도(2026-11-06, config modes): 저장칸의 modes = { cur: 지금 난이도('easy'·'normal'·'hard'), cleared: { easy: [깬 판 id], normal: [...], hard: [...] } }
//       modes 가 없는 예전 저장 = 예전 깬 판 목록(pixelBrawler.clearedIds, 더 예전 pixelBrawler.cleared)을 이지로 옮김(예전 값은 그대로 둠)
//       열림 = 앞 난이도에서 마지막 판(stages 맨 끝)을 깸. stagesAllOpen 이면 다 열림. 주소 ?diff=normal = 이번 창에서만 그 난이도(저장 안 함)
//       main.js 가 쓰는 것: mode() / modeOpen(k) / setMode(k) / cleared() / isCleared(id) / markCleared(id) / M() (지금 난이도 config 값)
//     무기 강화·속성(2026-11-06, config enchant): 저장칸의 wpn = { lv: 강화 0~10, ench: [칸 1~3 의 속성 또는 null] } (전직한 직업의 무기 하나),
//       stones = 가진 강화석, crys = { 속성: 가진 결정 수 }. 견습 때 주운 것도 모아 둠(전직하면 바로 씀). 예전 저장 = +0 · 강화석 0 · 결정 0
//       main.js 가 쓰는 것: weapon(직업) → 무기 묶음(아래 makeWeapon) / stones / crys / gainStone(n) / gainCrys(속성, n)
//       시험 무기(GAME.test.enhance · enchant, 시험 버튼으로 입은 다른 직업): 이번 창에서만, 강화석·결정 안 씀, 저장 안 함
//     던전 최고 기록(2026-11-07, config dungeons): 저장칸의 dg = { 던전 이름: { 난이도: { kills: 최고 처치 수, stones: 최고 강화석, clears: 끝까지 버틴 횟수 } } }
//       main.js 가 쓰는 것: dgBest(던전, 난이도) / dgRecord(던전, 난이도, { kills, stones, clear, time }) → 새 기록이면 { kills: true, stones: true, time: true }
//       레이드(2026-11-07): time = 가장 빠른 클리어 시간(ms, 클리어했을 때만)
//     저장이 막혀 있어도(사생활 보호 창 등) 게임은 됨: 이번에 연 동안만 기억
//   시험: 주소 뒤 ?lv=N = 이번 창에서만 LvN(경험치 0, 능력치 0 + 그 레벨 점수)으로 시작, 저장 안 함(저장된 레벨·능력치는 그대로)
(function () {
  var CFG = window.CFG, GR = CFG.growth, ST = GR.stats;
  var SAVE_KEY = CFG.demo ? 'pixelBrawler.demo.save' : 'pixelBrawler.save';   // 친구 시험 모드(?demo=1, config.js) = 따로 저장
  var KEYS = ['str', 'agi', 'vit', 'int', 'wis'];
  var params = new URLSearchParams(location.search);

  function clampLv(n) { return Math.max(1, Math.min(GR.maxLv, n | 0)); }
  // lv 에서 다음 레벨까지 필요한 경험치 (최고 레벨이면 0)
  //   2026-11-07: x min(1, Lv / needRampLv)(낮은 Lv 싸게) + needHiSq × (Lv - needHiLv)² (Lv30 부터 더 가파르게, config growth 설명)
  function need(lv) {
    if (lv >= GR.maxLv) return 0;
    var h = Math.max(0, lv - (GR.needHiLv || GR.maxLv)), r = GR.needRampLv ? Math.min(1, lv / GR.needRampLv) : 1;
    return Math.round((GR.needBase + GR.needPerLv * lv) * r + (GR.needHiSq || 0) * h * h);
  }
  // 그 레벨까지 받은 능력치 점수 합. 2026-11-07 형님: Lv1~9 = 0점, Lv10 부터 레벨마다 perLv(1)점 → 합 = Lv - 9 (fromLv 없으면 예전처럼 Lv2 부터)
  function ptsFor(lv) { return ST.perLv * Math.max(0, lv - (ST.fromLv || 2) + 1); }
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
  //   저장되는 것 sk = { clsLv = 전직한 Lv, lv = { 기술 id: 기술 점수로 올린 수 }, bar = [칸 1~10 에 끼운 기술 id] }
  //     칸(2026-11-07 PC 아래 막대): PC · 폰이 같은 순서 하나. 폰 = 앞 7칸(slots(), 2026-11-08), PC = 10칸(slots(true), 위 줄 6~10 은 pcLv 에 열림)
  //     'dodge' = 회피(PC 기술 창에서 아무 칸에나 끼움, 누르면 회피). 예전 저장(칸 4개) = 그대로 1~4번 칸
  //   기술 Lv = 열렸으면 1 + 올린 수(최고 maxLv), 안 열렸으면 0. 기술 점수 = (지금 Lv - 전직 Lv) x perLv - 쓴 점수
  //   2026-11-07 배우기(config skills.learn, 형님): 저절로 배우기 없음. 저장 sk.v = 2 → lv = { id: 배운 Lv 1~5 }(0 = 안 배움).
  //     unlocked(id) = 그 기술 Lv(unlock)가 됨(= 「배울 수 있음」 또는 배움), learned(id) = 배움, learnable(id) = 열렸는데 아직 안 배움
  //     기술 점수 = firstPts(전직 때 1) + (지금 Lv - 전직 Lv) x perLv - 쓴 점수(배운 Lv 합). 시험 책(test)은 예전 그대로(전부 Lv1 + 시험 점수)
  var SK = CFG.skills || {};
  var realBook = null, testBooks = {};
  function treeOf(cls) { return (SK.tree && SK.tree[cls]) || null; }
  var LEARN = !!SK.learn;
  // 2차 전직 기술(2026-11-08, config SKILL_TREE 의 tier: 2): 그 직업 2차 Lv(config classes.<직업>.tier2.lv, 기사 = 30) 이 돼야 2차 전직(성기사)
  //   tier2Lv(직업) = 2차 전직 Lv(없으면 0) / openLv(직업, 기술) = 그 기술이 열리는 Lv = unlock 과 2차 Lv 중 큰 것(2차 기술만)
  function tier2Lv(cls) { var c = CFG.classes && CFG.classes[cls], t = c && c.tier2; return t ? t.lv || 0 : 0; }
  function openLv(cls, e) { var u = e.unlock || 0; return e.tier === 2 ? Math.max(u, tier2Lv(cls)) : u; }
  // ---------- 2차 전직 갈래 (2026-11-08, config classes.<직업>.tier2.branches · SKILL_TREE 의 branch) ----------
  //   저장칸 tier2Branch = 고른 갈래 key('a' / 'b'). 2차 Lv(25)이 되면 고르기 화면(main.js openBranchChoice) → chooseBranch(key), 한 번 고르면 못 바꿈
  //   branchOf(직업) = 지금 갈래: 고른 것 > (2차 Lv 이 됐는데 아직 안 고름 = 예전 저장 · 고르기 화면이 뜨기 전) 첫 갈래(a) > 2차 전 = null
  //   갈래 기술(branch 붙은 것)은 그 갈래일 때만 기술 창에 보이고 배울 수 있음. 2차 전(null) = 두 갈래 다 자물쇠로 보임
  //   ?lv=N 시험 · 기술 미리보기 액자 = 주소 ?branch=a|b 로 이번 창에서만(저장 안 함)
  function branchList(cls) { var c = CFG.classes && CFG.classes[cls], t = c && c.tier2; return t && t.branches && t.branches.length ? t.branches : null; }
  function branchDef(cls, k) { var L = branchList(cls) || []; for (var i = 0; i < L.length; i++) if (L[i].key === k) return L[i]; return null; }
  function validBranch(cls, k) { return k && branchDef(cls, k) ? k : null; }
  var urlBranch = !CFG.demo && /^[a-z]$/.test(params.get('branch') || '') ? params.get('branch') : null;
  function branchOf(cls) {
    if (!branchList(cls)) return null;
    var k = validBranch(cls, cls === G.cls ? G.branch : urlBranch);
    if (k) return k;
    return G.lv >= tier2Lv(cls) ? branchList(cls)[0].key : null;
  }
  // 갈래 기술이 지금 갈래에 맞나: vis = 기술 창에 보임(2차 전 = 다 보임), ok = 배울 수 있는 갈래
  //   test = 시험 책(시험 버튼으로 입은 다른 직업): 2차 전이어도 첫 갈래(a)로 봄(예전처럼 2차 기술을 다 써 볼 수 있게)
  // 갈래 맛(2026-11-08): config skills.branchFx[직업][갈래].names[기술] → { name, twist, tag, br, color, tw }
  //   brOn = 갈래 맛이 켜졌나: 2차 Lv(tier2) 이 된 뒤의 지금 갈래(그 전 = null — ?lv=20&branch=a 시험처럼 갈래가 정해져 있어도 2차 전엔 원래대로)
  function brOn(cls) { var t = tier2Lv(cls); return t && G.lv >= t ? branchOf(cls) : null; }
  function brSkillOf(cls, id) {
    var F = SK.branchFx && SK.branchFx[cls], b = brOn(cls), G2 = F && b && F[b], n = G2 && G2.names && G2.names[id];
    return n ? { name: n[0], twist: n[1], tag: G2.tag, br: b, color: G2.color, tw: G2.tw } : null;
  }
  function recK0() { return (SK.branchFx && SK.branchFx.recK) || 1.25; }
  // 늘 켜진 기술 추천 갈래 배율: 지금 갈래 = e.rec 이면 recK(값 x 1.25), 아니면 1
  function recMul(cls, e) { return e && e.rec && brOn(cls) === e.rec ? recK0() : 1; }
  function brKey(cls, test) { var b = branchOf(cls); return b || (test && branchList(cls) ? branchList(cls)[0].key : null); }
  function brVis(cls, e, test) { if (!e || !e.branch) return true; var b = brKey(cls, test); return !b || b === e.branch; }
  function brOk(cls, e, test) { return !e || !e.branch || brKey(cls, test) === e.branch; }
  // 2차 정보(이름 · 옷 · Lv): 지금 갈래 값을 tier2 위에 덮음. 2차 전(갈래 없음)이면 이름 = 「성기사 / 마검사」
  function tier2Info(cls) {
    var c = CFG.classes && CFG.classes[cls], t = c && c.tier2;
    if (!t) return null;
    var o = { lv: t.lv || 0, name: t.name, outfit: t.outfit, key: null }, L = branchList(cls), b = L && branchDef(cls, branchOf(cls));
    if (b) { o.key = b.key; o.name = b.name || o.name; o.outfit = b.outfit || o.outfit; o.br = b; }
    else if (L) o.name = L.map(function (q) { return q.name; }).join(' / ');
    return o;
  }
  function skMax(e) { return (e && e.maxLv) || SK.maxLv || 5; }   // 기술마다 최고 Lv(2026-11-08, config SKILL_TREE 의 maxLv)
  function newSk(clsLv) { var o = { clsLv: clsLv, lv: {}, bar: [] }; if (LEARN) o.v = 2; return o; }
  // 기술 미리보기 책(2026-11-08, index.html window.PV = 기술 창 「▶ 미리보기」 액자 안에서만): 미리 보는 기술(PV.id) 하나만 PV.lv,
  //   도우미 기술(PV.help, 원소 낙인처럼 「기술에 맞으면」 늘 켜진 기술을 보일 때 쓰는 화염구) = Lv1, 나머지는 전부 안 배움(다른 늘 켜진 기술이 안 섞이게).
  //   쓰는 기술은 1번 칸부터. 저장 안 함
  var pvBooks = {};
  function makePvBook(cls) {
    var Q = window.PV, ids = [Q.id].concat(Q.help ? [Q.help] : []), st = newSk(1), B = makeBook(cls, st, true);
    B.lv = function (id) { return id === Q.id ? Q.lv : ids.indexOf(id) >= 0 ? 1 : 0; };
    st.bar = ids.filter(function (id) { return B.isActive(id); });
    B.save = function () {};
    return B;
  }
  // 견습 책(2026-11-07): 기본기 올려치기(config skills.noviceSkill) 하나만, 1번 칸만 열림. 점수 · 기술 창 없음(main.js 가 novice 를 보고 숨김)
  var noviceBook = null;
  function makeNoviceBook() {
    var id = SK.noviceSkill, S = SK.slots || [2, 4], is = function (x) { return x === id; };
    return { cls: 'novice', novice: true, test: false,
      list: function () { return []; }, entry: function () { return null; },
      isActive: is, unlocked: is, learned: is, learnable: function () { return false; }, lv: function (x) { return is(x) ? 1 : 0; }, maxLv: function () { return 1; },
      total: function () { return 0; }, used: function () { return 0; }, pts: function () { return 0; }, add: function () { return false; }, reset: function () {},
      slots: function () { return 1; }, maxSlots: function (pc) { return pc && SK.pcSlots ? SK.pcSlots : S[S.length - 1]; }, slotLv: function () { return 0; },
      canPut: is, at: function (i) { return i === 0 ? id : null; }, bar: function () { return [id]; }, put: function () { return false; },
      fill: function () {}, bonus: function () { return 0; }, save: function () {} };
  }
  function makeBook(cls, st, test) {
    var L = treeOf(cls), byId = {};
    var BASIC = !test && LEARN && SK.basic ? SK.basic[cls] || null : null;   // 직업 기본기(2026-11-07): 늘 열림 · 공짜 Lv1
    L.forEach(function (e) { byId[e.id] = e; });
    var B = {
      cls: cls, test: !!test,
      list: function () { return L.filter(function (e) { return brVis(cls, e, test); }); },   // 2차 갈래(2026-11-08): 다른 갈래 기술은 안 보임
      entry: function (id) { return byId[id] || null; },
      // 그 기술 최고 Lv(2026-11-08): 기술마다 maxLv(날렵한 몸놀림 = 1), 없으면 config skills.maxLv(5)
      maxLv: function (id) { return skMax(byId[id]); },
      // 쓰는 기술(칸에 끼우는 것)인가: 준비 중·늘 켜진 기술이 아니고 SKILLS 에 동작이 있음
      isActive: function (id) { var e = byId[id]; return !!(e && !e.soon && !e.passive && SK[cls] && SK[cls][id]); },
      // 열렸나: 시험 책 = 준비 중 빼고 전부, 저장 책 = 그 레벨이 됨(unlock 0 = 전직 즉시)
      //   2차 기술(tier 2, 2026-11-08) = 2차 전직 Lv 도 돼야 함(openLv). 2차 전 기술 창 = 「2차 전직 후 LvN」(main.js)
      unlocked: function (id) { var e = byId[id]; return !!e && !e.soon && brOk(cls, e, test) && (test || id === BASIC || G.lv >= openLv(cls, e)); },
      // 2차 전직 갈래(2026-11-08): 지금 갈래 key(2차 전 = null) · 그 기술 갈래 이름(갈래 기술 아니면 null)
      branch: function () { return branchOf(cls); },
      // 갈래 맛(2026-11-08, config skills.branchFx): 지금 갈래에서 바뀐 1차 기술 { name, twist, tag, br } (2차 전 · 해당 없음 = null)
      brSkill: function (id) { return brSkillOf(cls, id); },
      // 늘 켜진 기술 추천 갈래(rec): { br, name(갈래 이름), on(지금 그 갈래), k(배율) } 또는 null
      rec: function (id) { var e = byId[id], b = e && e.rec ? branchDef(cls, e.rec) : null; return b ? { br: e.rec, name: b.name, on: brOn(cls) === e.rec, k: recK0() } : null; },
      recK: function (id) { return recMul(cls, byId[id]); },
      branchName: function (id) { var e = byId[id], b = e && e.branch ? branchDef(cls, e.branch) : null; return b ? b.name : null; },
      openLv: function (id) { var e = byId[id]; return e ? openLv(cls, e) : 0; },
      // 2차 전직을 했나(2026-11-08): 이 직업에 2차가 있고 그 Lv 가 됨
      tier2: function () { var t = tier2Lv(cls); return !!t && G.lv >= t; },
      tier2Lv: function () { return tier2Lv(cls); },
      lv: function (id) {
        if (!B.unlocked(id)) return 0;
        if (id === BASIC) return Math.max(1, Math.min(B.maxLv(id), st.lv[id] || 1));   // 기본기 = 늘 Lv1 이상
        if (LEARN && !test) return Math.min(B.maxLv(id), st.lv[id] || 0);   // 배운 Lv(0 = 안 배움)
        return Math.min(B.maxLv(id), 1 + (st.lv[id] || 0));
      },
      learned: function (id) { return B.lv(id) > 0; },
      learnable: function (id) { return B.unlocked(id) && !B.learned(id); },
      total: function () {
        if (test) return (SK.test && SK.test.pts) || 0;
        return (LEARN ? (SK.firstPts || 0) : 0) + Math.max(0, G.lv - st.clsLv) * (SK.perLv || 1);
      },
      used: function () { var n = 0; Object.keys(st.lv).forEach(function (k) { if (byId[k] && !brOk(cls, byId[k], test)) return; n += k === BASIC ? Math.max(0, B.lv(k) - 1) : st.lv[k]; }); return n; },   // 기본기 Lv1 = 공짜 · 다른 갈래에 써 둔 점수는 안 셈(2026-11-08)
      pts: function () { return Math.max(0, B.total() - B.used()); },
      // 기술 점수 1점 → 그 기술 Lv +1 (열려 있고 최고 Lv 아님)
      //   배우기(2026-11-07): 안 배운 기술 + 1점 = 배움(Lv1). 처음 배운 쓰는 기술은 빈 칸(PC 기준 열린 칸 앞에서부터)이 있으면 그 칸에 끼움
      add: function (id) {
        if (!B.pts() || !B.unlocked(id) || B.lv(id) >= B.maxLv(id)) return false;
        var first = LEARN && !test && !B.learned(id);
        st.lv[id] = LEARN && !test ? B.lv(id) + 1 : (st.lv[id] || 0) + 1;
        if (first && B.isActive(id) && B.bar(true).indexOf(id) < 0) {
          for (var i = 0; i < B.slots(true); i++) if (!B.at(i)) { var j = st.bar.indexOf(id); if (j >= 0) st.bar[j] = null; st.bar[i] = id; break; }
        }
        B.save();
        return true;
      },
      // 초기화(공짜): 쓴 기술 점수 전부 돌려받음 → 열린 기술은 모두 Lv1 (2026-11-07 배우기: 배운 기술도 전부 지움 = 다시 배움, 칸 자리는 기억)
      reset: function () { st.lv = {}; B.save(); },
      // 칸 수: 시험 책 = 늘 가장 많이, 저장 책 = moreLv 마다 하나씩 늘어남(2026-11-06 밤: [2, 3, 4] / Lv10 · Lv13, 2026-11-06 Lv9 → 10,
      //   2026-11-07: [2, 3, 4, 5] / Lv10 · Lv13 · Lv15). pc = PC 아래 막대: pcLv 부터 pcSlots(10)칸, 그 전엔 폰과 같음
      //   2026-11-07 형님(slotsAllOpen): 전직하면 칸 전부 열림 = 폰 5칸 · PC 10칸 (기술 책은 전직한 뒤에만 있음 → 견습은 그대로 잠김)
      slots: function (pc) {
        var S = SK.slots || [2, 4], M = [].concat(SK.moreLv || 13), n = S[0];
        if (SK.slotsAllOpen) return pc && SK.pcSlots ? SK.pcSlots : S[S.length - 1];
        if (pc && SK.pcSlots && (test || G.lv >= (SK.pcLv || 0))) return SK.pcSlots;
        if (test) return S[S.length - 1];
        M.forEach(function (lv, k) { if (G.lv >= lv && S[k + 1] != null) n = S[k + 1]; });
        return n;
      },
      // 칸이 가장 많을 때 수(잠긴 칸까지 그리는 곳): 폰 = slots 끝, PC = pcSlots
      maxSlots: function (pc) { var S = SK.slots || [2, 4]; return pc && SK.pcSlots ? SK.pcSlots : S[S.length - 1]; },
      // i 번째 칸(0부터)이 열리는 레벨(처음부터 있으면 0) — 기술 창 「LvN에 열림」. 폰 칸(앞 5칸)을 넘으면 PC 위 줄 = pcLv
      slotLv: function (i) {
        var S = SK.slots || [2, 4], M = [].concat(SK.moreLv || 13);
        if (SK.slotsAllOpen) return 0;
        if (i < S[0]) return 0;
        if (i >= S[S.length - 1]) return SK.pcLv || M[M.length - 1];
        for (var k = 0; k < M.length; k++) if (i < S[k + 1]) return M[k];
        return M[M.length - 1];
      },
      // 칸에 끼울 수 있나: 쓰는 기술(열림) 또는 회피('dodge')
      canPut: function (id) { return id === 'dodge' || (B.isActive(id) && B.learned(id)); },
      // i 번째 칸(0부터)에 끼운 기술 id 또는 'dodge' (열린 칸(PC 기준)이 아니거나 안 열린 기술이면 null)
      at: function (i) { var id = i < B.slots(true) ? st.bar[i] : null; return id && B.canPut(id) ? id : null; },
      bar: function (pc) { var a = []; for (var i = 0; i < B.slots(pc); i++) a.push(B.at(i)); return a; },
      // i 번째 칸에 끼우기. 다른 칸에 이미 있으면 서로 자리 바꿈
      put: function (i, id) {
        if (i < 0 || i >= B.slots(true) || !B.canPut(id)) return false;
        var j = st.bar.indexOf(id);
        if (j === i) return true;
        if (j >= 0) st.bar[j] = st.bar[i] || null;
        st.bar[i] = id; B.save();
        return true;
      },
      // 빈 칸에 배운 쓰는 기술을 순서대로 끼움. 2026-11-07: 레벨업 · 전직 때는 안 부름(저절로 끼우기 없음) → 시험 책 · 시험 자동 조종(testSetup)만
      fill: function () {
        var changed = false;
        L.forEach(function (e) {
          if (!B.isActive(e.id) || !B.learned(e.id) || B.bar(true).indexOf(e.id) >= 0) return;
          for (var i = 0; i < B.slots(true); i++) if (!B.at(i)) { var j = st.bar.indexOf(e.id); if (j >= 0) st.bar[j] = null; st.bar[i] = e.id; changed = true; return; }
        });
        if (changed) B.save();
      },
      // 늘 켜진 기술 합: stat('phys' / 'magic' / 'guard' / 'mpRegen') → 0.12 = +12%
      bonus: function (stat) {
        var n = 0;
        L.forEach(function (e) { var P = e.passive; if (P && P.val && P.stat === stat && B.learned(e.id)) n += (P.val[B.lv(e.id) - 1] || 0) * recMul(cls, e); });   // 추천 갈래 +25%(2026-11-08)
        return n;
      },
      save: function () { if (!test) G.save(); }
    };
    return B;
  }

  // ---------- 무기 강화 · 속성 (2026-11-06, 수치 = config enchant) ----------
  //   W = 저장되는 것 { lv, ench: [3칸] }. test = 시험 무기(강화석·결정 안 씀, 저장 안 함)
  var EN = CFG.enchant || null, testW = {};
  function newW() { return { lv: 0, ench: [null, null, null] }; }
  function cleanW(w) {
    var o = newW();
    if (!w || typeof w !== 'object') return o;
    o.lv = Math.max(0, Math.min(EN ? EN.maxLv : 10, w.lv | 0));
    if (Array.isArray(w.ench)) for (var i = 0; i < 3; i++) { var e = w.ench[i]; if (EN && EN.el[e] && o.ench.indexOf(e) < 0) o.ench[i] = e; }
    return o;
  }
  function makeWeapon(cls, W, test) {
    var BN = (EN.bonus && EN.bonus[cls]) || {};
    var A = {
      cls: cls, test: !!test, st: W,
      lv: function () { return W.lv; },
      isMax: function () { return W.lv >= EN.maxLv; },
      // 다음 강화(+lv+1) 성공 확률 · 드는 강화석 (최고면 0)
      rate: function () { return A.isMax() ? 0 : EN.rate[W.lv]; },
      cost: function () { return A.isMax() ? 0 : EN.cost[W.lv]; },
      canEnhance: function () { return !A.isMax() && (test || G.stones >= A.cost()); },
      // 강화 한 번: 강화석 cost 개 → rate 확률로 +1. 돌려주는 값 { ok, lv, cost } (못 하면 null). roll = 시험용 고정 주사위(0~1)
      enhance: function (roll) {
        if (!A.canEnhance()) return null;
        var c = A.cost(), ok = (roll != null ? roll : Math.random()) < A.rate();
        if (!test) G.stones -= c;
        if (ok) W.lv++;
        A.save();
        return { ok: ok, lv: W.lv, cost: c };
      },
      slotOpen: function (i) { return W.lv >= EN.slotLv[i]; },
      slotLv: function (i) { return EN.slotLv[i]; },
      // 칸 i 의 속성(열린 칸만)
      at: function (i) { return A.slotOpen(i) ? W.ench[i] : null; },
      // 켜진 속성 목록(칸 순서, 첫째 = 오라 주인공)
      els: function () { var a = []; for (var i = 0; i < 3; i++) { var e = A.at(i); if (e) a.push(e); } return a; },
      has: function (e) { return A.els().indexOf(e) >= 0; },
      // 칸 i 에 속성 e 끼우기(바꾸기): 칸이 열림 + 다른 칸에 없음 + 지금과 다름 + 그 속성 결정 setCost(i)개(시험 = 공짜)
      //   2026-11-07 형님: 1개 → 칸마다 config enchant.setCost(1번 5 · 2번 10 · 3번 20개)
      setCost: function (i) { return (EN.setCost && EN.setCost[i]) || 1; },
      canSet: function (i, e) { return !!EN.el[e] && A.slotOpen(i) && W.ench[i] !== e && A.els().indexOf(e) < 0 && (test || (G.crys[e] || 0) >= A.setCost(i)); },
      set: function (i, e) {
        if (!A.canSet(i, e)) return false;
        if (!test) G.crys[e] -= A.setCost(i);
        W.ench[i] = e; A.save();
        return true;
      },
      // 공격 배율(기사 물리 · 법사 마법): 1 + perLv x 강화
      atkMul: function () { return 1 + EN.perLv * W.lv; },
      // 단계 덤 합: k = 'crit' / 'atkSpd' / 'cd' / 'mp' / 'reach' / 'mpRegen' / 'castSpd' / 'area'
      bonus: function (k) { var n = 0; Object.keys(BN).forEach(function (l) { if (W.lv >= +l && BN[l][k]) n += BN[l][k]; }); return n; },
      milestones: function () { return Object.keys(BN).map(function (l) { return { lv: +l, val: BN[l], on: W.lv >= +l }; }); },
      // 강화 단계 그림 이름(config art.weapons) · 등급 이름
      //   has = 그 그림이 불러와졌나(없으면 한 단계 아래 그림, 예: +10 신화 그림이 아직 없으면 전설)
      art: function (has) { var k = null; (EN.art[cls] || []).forEach(function (q) { if (W.lv >= q[0] && (!has || has(q[1]))) k = q[1]; }); return k; },
      tier: function () { var k = ''; EN.tierName.forEach(function (q) { if (W.lv >= q[0]) k = q[1]; }); return k; },
      save: function () { if (!test) G.save(); }
    };
    return A;
  }

  var data = readSave();
  var cur = data.slots[data.slot] || {};

  // ---------- 난이도 저장 (2026-11-06, config modes) ----------
  //   MS = 저장되는 것 { cur, cleared: { 난이도: [판 id] } }. 예전 깬 판 목록(아래 legacyCleared)은 처음 한 번 이지로 옮김
  var MO = CFG.modes || { order: ['easy'], easy: { name: '이지' } }, ORDER = MO.order;
  // 고를 수 있는 난이도(2026-11-07 형님: 이지 숨김 = config hidden). 열림 순서 · 「앞 난이도」도 이 목록 기준(하드의 앞 = 노말)
  var VIS = ORDER.filter(function (k) { return MO[k] && !MO[k].hidden; });
  if (!VIS.length) VIS = ORDER.slice();
  // 다음 난이도가 열리는 판(2026-11-09 판 20개: config modeUnlockId = 10 → 예전처럼 10판 마왕을 깨면 열림, 예전 저장도 그대로)
  function lastId() { return CFG.modeUnlockId || CFG.stages[CFG.stages.length - 1].id; }
  // 예전 저장(난이도 전): 깬 판 id 목록 'pixelBrawler.clearedIds' JSON, 더 예전 = 깬 판 「수」 N 'pixelBrawler.cleared'(그때 판 순서 1 2 3 4 6 의 앞 N개)
  function legacyCleared() {
    var out = [];
    if (CFG.demo) return out;   // 친구 시험 모드: 형님 예전 기록을 안 가져옴
    try {
      var raw = localStorage.getItem('pixelBrawler.clearedIds');
      if (raw) JSON.parse(raw).forEach(function (id) { if (typeof id === 'number' && out.indexOf(id) < 0) out.push(id); });
      else {
        var n = parseInt(localStorage.getItem('pixelBrawler.cleared'), 10) || 0;
        out = [1, 2, 3, 4, 6].slice(0, Math.max(0, n));
      }
    } catch (e) {}
    return out.sort(function (a, b) { return a - b; });
  }
  var MSsaved = { cur: VIS[0], cleared: {} }, cm = cur.modes, modeMoved = false;
  ORDER.forEach(function (k) {
    var L = cm && cm.cleared && Array.isArray(cm.cleared[k]) ? cm.cleared[k] : (!cm && k === ORDER[0] ? legacyCleared() : []);
    MSsaved.cleared[k] = L.filter(function (id) { return typeof id === 'number'; });
  });
  if (cm && VIS.indexOf(cm.cur) >= 0) MSsaved.cur = cm.cur;
  else if (cm && cm.cur) modeMoved = true;   // 숨긴 난이도(이지)에 있던 저장 → 첫 난이도(노말)로, 아래에서 한 번 저장
  // ?diff=normal (시험): 이번 창에서만 그 난이도, 잠금 무시. 그동안 깬 판은 이번 창에서만 기억(저장된 목록은 그대로)
  var urlDiff = !CFG.demo && VIS.indexOf(params.get('diff')) >= 0 ? params.get('diff') : null;   // 친구 시험 모드(?demo=1) = 무시
  var MS = urlDiff ? JSON.parse(JSON.stringify(MSsaved)) : MSsaved;
  if (!MO[MSsaved.cur] || (VIS.indexOf(MSsaved.cur) > 0 && !CFG.stagesAllOpen && MSsaved.cleared[VIS[VIS.indexOf(MSsaved.cur) - 1]].indexOf(lastId()) < 0)) MSsaved.cur = VIS[0];   // 잠긴 난이도에 있던 저장(시험 기간이 끝남) → 첫 난이도로
  // 난이도만 저장: ?lv=N 시험 중(noSave)에도 깬 판은 예전처럼 저장(레벨·능력치는 저장된 그대로 둠). ?diff 시험 중이면 저장 안 함
  function saveModes() {
    if (MS !== MSsaved) return;
    if (!G.noSave) { G.save(); return; }
    var s = data.slots[data.slot] || (data.slots[data.slot] = cur);
    s.modes = MSsaved;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {}
  }
  var G = {
    lv: clampLv(cur.lv || 1),
    xp: 0,
    cls: CFG.classes[cur['class']] && cur['class'] !== 'novice' ? cur['class'] : null,   // 전직한 직업(없으면 null = 견습)
    branch: null,       // 2차 전직 갈래(2026-11-08, 저장칸 tier2Branch). 아래에서 읽음
    stats: zero(),      // 올린 능력치
    pts: 0,             // 안 쓴 점수
    noSave: false,      // ?lv=N 시험 중이면 true(저장 안 함)
    club: !!cur.club,   // 첫 무기 몽둥이를 주웠나(2026-11-06, config club). 견습 맨손 공격 +
    // 무기 강화 · 속성(2026-11-06, config enchant): wpn = 저장되는 무기(전직한 직업), stones = 강화석, crys = { 속성: 결정 수 }
    wpn: cleanW(cur.wpn),
    stones: Math.max(0, cur.stones | 0),
    crys: (function () { var o = {}; if (EN) EN.order.forEach(function (k) { o[k] = Math.max(0, (cur.crys && cur.crys[k]) | 0); }); return o; })(),
    gainStone: function (n) { n = n | 0; if (n > 0) { G.stones += n; G.save(); } return G.stones; },
    gainCrys: function (e, n) { n = n | 0; if (n > 0 && G.crys[e] != null) { G.crys[e] += n; G.save(); } return G.crys[e] || 0; },
    // 무기 묶음(아래 makeWeapon): 저장된 직업 = 저장되는 무기, 다른 직업(시험 버튼) · GAME.test 로 바꾼 무기 = 시험 무기. 견습·강화 없음 = null
    weapon: function (cls) {
      cls = cls || G.cls;
      if (!EN || !cls || !EN.bonus[cls]) return null;
      if (testW[cls]) return testW[cls];
      if (cls === G.cls) return G._realW || (G._realW = makeWeapon(cls, G.wpn, false));
      return (testW[cls] = makeWeapon(cls, newW(), true));
    },
    // 시험용(GAME.test.enhance · enchant): 이 직업 무기를 이번 창에서만 lv · ench 로(저장된 무기는 그대로). lv = null → 시험 무기 지움(원래대로)
    testWeapon: function (cls, lv, ench) {
      if (!EN || !EN.bonus[cls]) return null;
      if (lv === null) { delete testW[cls]; return G.weapon(cls); }
      var w = testW[cls] || makeWeapon(cls, cleanW(G.weapon(cls) ? G.weapon(cls).st : null), true);
      testW[cls] = w;
      if (lv != null) w.st.lv = Math.max(0, Math.min(EN.maxLv, lv | 0));
      if (ench) { w.st.ench = [null, null, null]; ench.slice(0, 3).forEach(function (e, i) { if (EN.el[e] && w.st.ench.indexOf(e) < 0) w.st.ench[i] = e; }); }
      return w;
    },
    // 몽둥이 주움 → 저장. 이미 있으면 false
    // 던전 최고 기록(2026-11-07): 없으면 null
    dg: (function () { var o = {}, d = cur.dg; if (d && typeof d === 'object') Object.keys(d).forEach(function (k) { var m = d[k]; if (!m || typeof m !== 'object') return; o[k] = {}; Object.keys(m).forEach(function (md) { var r = m[md]; if (r && typeof r === 'object') o[k][md] = { kills: Math.max(0, r.kills | 0), stones: Math.max(0, r.stones | 0), clears: Math.max(0, r.clears | 0) }; }); }); return o; })(),
    dgBest: function (id, md) { var r = G.dg[id] && G.dg[id][md || G.mode()]; return r ? { kills: r.kills, stones: r.stones, clears: r.clears, time: r.time || 0 } : null; },
    // 한 번 끝남 → 처치 수 · 강화석 각각 최고면 바꿈(+ 버티면 clears + 1) 그리고 저장. 돌려주는 값 = 이번에 새로 세운 기록
    dgRecord: function (id, md, run) {
      md = md || G.mode();
      var m = G.dg[id] || (G.dg[id] = {}), r = m[md] || (m[md] = { kills: 0, stones: 0, clears: 0 }), out = { kills: false, stones: false, first: !r.kills && !r.stones && !r.clears };
      if ((run.kills | 0) > r.kills) { r.kills = run.kills | 0; out.kills = true; }
      if ((run.stones | 0) > r.stones) { r.stones = run.stones | 0; out.stones = true; }
      if (run.clear) r.clears++;
      if (run.clear && run.time > 0 && (!r.time || run.time < r.time)) { r.time = Math.round(run.time); out.time = true; }   // 레이드(2026-11-07): 가장 빠른 클리어 시간(ms)
      G.save();
      return out;
    },
    getClub: function () { if (G.club) return false; G.club = true; G.save(); return true; },
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
      if (T.midBoss) return 'mid';   // 중간보스(2026-11-06, main.js 가 잡몹 T 를 키워 만든 것)
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
      G.pts += ptsFor(G.lv) - ptsFor(G.lv - up);   // 2026-11-07: Lv10 부터 레벨마다 1점
      // 2026-11-07: 새로 열린 기술은 저절로 안 배우고 안 끼움(기술 창에 「배울 수 있음」) — 예전엔 여기서 fill()
      G.save();
      return up;
    },
    // 전직: 이 저장칸에 직업을 한 번만 정함(이미 있으면 안 바꿈 → false). 기술 책은 이 레벨부터(첫 기술 Lv1, 기술 점수는 다음 레벨부터)
    setClass: function (k) {
      if (G.cls || !CFG.classes[k] || k === 'novice') return false;
      G.cls = k; G.sk = newSk(G.lv); realBook = null;   // 2026-11-07: 기술 점수 firstPts(1)점으로 첫 기술을 바로 배움(저절로 배우지는 않음)
      basicOn(k, true);   // 견습 올려치기 → 직업 기본기(올려베기 · 땅 융기) 공짜 Lv1, 1번 칸
      G.wpn = newW(); G._realW = null; delete testW[k];   // 전직 = 그 직업 무기를 +0 으로 받음(2026-11-06 강화)
      G.save();
      return true;
    },
    // 기술 책(2026-11-06): 그 직업의 기술 열림·기술 Lv·기술 점수·기술 칸 (아래 makeBook). 기술이 없는 직업(견습)은 null
    //   저장된 직업 = 저장되는 책, 시험 버튼으로 입은 다른 직업 = 시험 책(이번 창에서만, config skills.test)
    book: function (cls) {
      if (cls === 'novice') return SK.noviceSkill && SK.novice && SK.novice[SK.noviceSkill] ? (noviceBook || (noviceBook = makeNoviceBook())) : null;   // 견습 기본기(2026-11-07)
      cls = cls || G.cls;
      if (!cls || !treeOf(cls)) return null;
      if (window.PV) return pvBooks[cls] || (pvBooks[cls] = makePvBook(cls));   // 기술 미리보기 액자(2026-11-08): 그 기술 하나만
      if (cls === G.cls) return realBook || (realBook = makeBook(cls, G.sk, false));
      if (!testBooks[cls]) { testBooks[cls] = makeBook(cls, newSk(1), true); testBooks[cls].fill(); }
      return testBooks[cls];
    },
    // 시험용(GAME.test.skillSetup, ?lv=N 일 때만): 이번 창에서만 「전직한 저장」처럼 — 직업 cls, 전직 Lv clsLv, 기술 점수를 plan 순서로 돌아가며 씀
    testSetup: function (cls, clsLv, plan) {
      if (!G.noSave || !treeOf(cls)) return null;
      G.cls = cls; G.sk = newSk(Math.min(G.lv, clsLv || SK.classLv)); realBook = null; G._realW = null;
      G.branch = validBranch(cls, urlBranch);   // 2차 갈래(2026-11-08): 시험 = 주소 ?branch 만(없으면 고르기 화면이 뜰 수 있음)
      var b = G.book(cls);
      var ids = plan || (SK.botPlan && SK.botPlan[cls]) || [], guard = 0;
      while (b.pts() > 0 && guard++ < 200) {
        var any = false;
        ids.forEach(function (id) { if (b.pts() > 0 && b.add(id)) any = true; });
        if (!any) break;
      }
      b.fill();   // 배운 쓰는 기술을 빈 칸에(시험 자동 조종)
      var o = {}; treeOf(cls).forEach(function (e) { if (b.learned(e.id)) o[e.id] = b.lv(e.id); });
      return { lv: o, pts: b.pts(), bar: b.bar(true) };
    },
    // ---------- 2차 전직 갈래 (2026-11-08) ----------
    branches: function (cls) { return branchList(cls || G.cls); },
    branchOf: function (cls) { return branchOf(cls || G.cls); },
    brSkill: function (cls, id) { return brSkillOf(cls || G.cls, id); },
    brOn: function (cls) { return brOn(cls || G.cls); },                      // 갈래 맛이 켜진 갈래(2차 Lv 뒤만)   // 갈래 맛(2026-11-08): 바뀐 1차 기술 이름 · 덤
    recMul: function (cls, e) { return recMul(cls || G.cls, e); },        // 추천 갈래 늘 켜진 기술 배율
    tier2Info: function (cls) { return tier2Info(cls || G.cls); },
    // 고르기 화면을 띄워야 하나: 갈래가 있는 직업 + 2차 Lv 이 됨 + 아직 안 고름(?lv 시험에 ?branch 를 붙였으면 고른 것으로 봄)
    needBranch: function () { return !!(G.cls && branchList(G.cls) && !G.branch && G.lv >= tier2Lv(G.cls)); },
    // 갈래 고르기(한 번만): 다른 갈래 기술에 써 둔 점수는 돌려받고(예전 저장의 성기사 기술 등) 칸에서도 뺌 → 저장
    chooseBranch: function (k) {
      if (!G.cls || G.branch || !validBranch(G.cls, k)) return false;
      G.branch = k;
      (treeOf(G.cls) || []).forEach(function (e) {
        if (!e.branch || e.branch === k) return;
        delete G.sk.lv[e.id];
        var j = G.sk.bar.indexOf(e.id); if (j >= 0) G.sk.bar[j] = null;
      });
      G.save();
      return true;
    },
    save: function () {
      if (G.noSave) return;
      data.slots[data.slot] = { lv: G.lv, xp: G.xp, 'class': G.cls, tier2Branch: G.cls && G.branch ? G.branch : undefined, stats: G.stats, pts: G.pts, skills: G.cls ? G.sk : undefined, club: G.club || undefined, modes: MSsaved,
        wpn: G.cls ? G.wpn : undefined, stones: G.stones, crys: G.crys, dg: G.dg };
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {}
    },
    // ---------- 난이도 (2026-11-06, config modes) ----------
    mode: function () { return urlDiff || MS.cur; },
    M: function () { return MO[G.mode()] || MO.easy; },
    // 열렸나: 첫 난이도는 늘, 나머지는 앞 난이도에서 마지막 판을 깸(시험 기간 stagesAllOpen 이면 다)
    modeOpen: function (k) {
      var i = VIS.indexOf(k);
      if (i < 0) return false;   // 숨긴 난이도(이지) = 못 고름
      if (i === 0 || CFG.stagesAllOpen) return true;
      return MS.cleared[VIS[i - 1]].indexOf(lastId()) >= 0;
    },
    // 고르는 탭에 나오는 난이도 목록(숨긴 것 빼고, 2026-11-07)
    modeList: function () { return VIS.slice(); },
    setMode: function (k) {
      if (!G.modeOpen(k)) return false;
      if (urlDiff) { urlDiff = null; MS = MSsaved; }
      MS.cur = k; saveModes();
      return true;
    },
    // 지금 난이도에서 깬 판 { id: true }
    cleared: function (k) { var o = {}; (MS.cleared[k || G.mode()] || []).forEach(function (id) { o[id] = true; }); return o; },
    isCleared: function (id) { return (MS.cleared[G.mode()] || []).indexOf(id) >= 0; },
    // 어느 난이도에서든 깼나(전직 판 확인용, 2026-11-07: 이지에서 깬 예전 저장도 셈)
    clearedAny: function (id) { return ORDER.some(function (k) { return (MS.cleared[k] || []).indexOf(id) >= 0; }); },
    // 판을 깸 → 지금 난이도 목록에 저장. 다음 난이도가 새로 열렸으면 그 난이도 key 를 돌려줌(결과 화면 알림)
    markCleared: function (id) {
      var k = G.mode(), L = MS.cleared[k], i = VIS.indexOf(k), nx = i >= 0 ? VIS[i + 1] : null, was = nx ? G.modeOpen(nx) : true;
      if (L.indexOf(id) < 0) { L.push(id); L.sort(function (a, b) { return a - b; }); }
      saveModes();
      return nx && !was && G.modeOpen(nx) ? nx : null;
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
  var dbgLv = CFG.demo ? 0 : parseInt(params.get('lv'), 10);   // 친구 시험 모드(?demo=1) = 무시
  if (dbgLv > 0) { G.lv = clampLv(dbgLv); G.xp = 0; G.stats = zero(); G.pts = ptsFor(G.lv); G.noSave = true; }
  // 2차 전직 갈래(2026-11-08): 저장된 것. ?lv 시험 · 미리보기 액자는 주소 ?branch 가 있으면 그것(이번 창만)
  G.branch = G.cls ? validBranch(G.cls, cur.tier2Branch) : null;
  if ((dbgLv > 0 || window.PV) && G.cls && validBranch(G.cls, urlBranch)) G.branch = urlBranch;
  // 기술 책(2026-11-06): 저장에 있으면 그대로(이상한 값은 버림). 직업은 있는데 기술 책이 없는 예전 저장 = 전직 Lv 를 classLv(7)로 보고
  //   (지금 Lv - 전직 Lv) 점을 안 쓴 채로 줌. 쓴 점수가 받은 점수보다 많으면(저장이 꼬임 · ?lv 로 낮춤) 초기화
  // 직업 기본기(2026-11-07, config skills.basic): 기술 책에 Lv1 이상으로 + 칸에 없으면 끼움(first = 전직 순간 → 1번 칸, 아니면 1번 칸이 비었으면 거기, 아니면 빈 칸)
  //   바꿨으면 true
  function basicOn(cls, first) {
    var id = LEARN && SK.basic ? SK.basic[cls] : null;
    if (!id || !G.sk) return false;
    var ch = false;
    if (!(G.sk.lv[id] > 0)) { G.sk.lv[id] = 1; ch = true; }
    if (G.sk.bar.indexOf(id) < 0) {
      var n = SK.pcSlots || 10, i = first || !G.sk.bar[0] ? 0 : -1;
      if (i < 0) for (var k = 0; k < n; k++) if (!G.sk.bar[k]) { i = k; break; }
      if (i >= 0) { G.sk.bar[i] = id; ch = true; }
    }
    return ch;
  }
  G.sk = newSk(G.lv);
  var skConverted = false;
  if (G.cls) {
    var cs = cur.skills, L0 = treeOf(G.cls) || [];
    if (cs && typeof cs === 'object') {
      G.sk.clsLv = clampLv(cs.clsLv || 1);
      // 아직 안 열린 기술에 올려 둔 점수는 돌려받음(2026-11-06 열림 순서 바꿈: 예전 Lv9 저장의 올려베기·땅 융기는 이제 Lv10 에 열림)
      // 칸(2026-11-07 10칸): 예전 저장(4칸) = 그대로 1~4번 칸
      if (Array.isArray(cs.bar)) G.sk.bar = cs.bar.slice(0, SK.pcSlots || 10).map(function (id) { return typeof id === 'string' ? id : null; });
      var newFmt = cs.v === 2 || !LEARN;
      if (cs.lv && typeof cs.lv === 'object') L0.forEach(function (e) {
        var n = cs.lv[e.id] | 0;
        // 2026-11-08: 2차 기술(칼날 폭풍 · 성검 낙뢰를 1차 Lv19 · 23 에서 2차 Lv25 · 31 로 옮김)도 2차 전직 Lv 로 봄(openLv) + 1차 기사 다시 배치(반격 21 → 24 등) →
        //   예전 저장에서 미리 배워 둔 2차 기술 · 지금 Lv 보다 늦게 열리게 바뀐 기술은 여기서 빠짐 = 그 기술 점수는 안 쓴 점수로 돌아옴(기술 칸에 끼운 것도 저절로 빈 칸)
        if (e.soon || G.lv < openLv(G.cls, e) || !brOk(G.cls, e)) return;   // 2026-11-08: 고른 갈래가 아닌 2차 기술도 빠짐(점수 돌려받음)
        if (newFmt) { if (n > 0) G.sk.lv[e.id] = Math.min(LEARN ? skMax(e) : skMax(e) - 1, n); }
        else G.sk.lv[e.id] = 1 + Math.max(0, Math.min(skMax(e) - 1, n));   // 예전(저절로 배움) = 열린 기술은 Lv1 + 올린 수
      });
      else if (!newFmt) L0.forEach(function (e) { if (!e.soon && G.lv >= openLv(G.cls, e) && brOk(G.cls, e)) G.sk.lv[e.id] = 1; });
    } else G.sk.clsLv = Math.min(G.lv, SK.classLv || 7);
    var bk = G.book(G.cls);
    // 예전 저장 바꾸기(2026-11-07 배우기): 배운 Lv 합이 새 점수(전직 1 + 레벨마다 1)보다 많으면
    //   → 칸에 끼워 둔 쓰는 기술만 Lv1 로 남기고(단축키가 그대로 됨) 나머지 점수는 돌려받음. 그것도 넘치면 전부 초기화(공짜)
    if (bk.used() > bk.total()) {
      var keep = {};
      if (cs && cs.v !== 2 && LEARN) G.sk.bar.forEach(function (id) { if (id && G.sk.lv[id] && bk.isActive(id)) keep[id] = 1; });
      G.sk.lv = Object.keys(keep).length <= bk.total() ? keep : {};
    }
    if (LEARN && cs && cs.v !== 2) skConverted = true;
    if (basicOn(G.cls, false)) skConverted = true;   // 예전 저장: 기본기가 없으면 공짜 Lv1 + 빈 칸(있던 Lv 는 그대로)
  }
  // 예전 저장을 바꿨으면(이지 → 노말 · 기술 배우기 방식) 한 번 저장(?lv 시험 중이면 저장 안 함)
  if ((modeMoved || skConverted) && !G.noSave) G.save();
  window.Growth = G;
})();
