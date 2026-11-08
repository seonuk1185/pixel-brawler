// 레이드 보스(2026-11-07, 형님 승인): 불의 화산굴 「화염룡 이그니스」 (수치 = config dungeons.fire.boss, 그림 · 부위 상자 = assets/raid/fire/dragon.json)
//   한 마리 거대한 그림. 싸움터 오른쪽에 박혀 있음(안 걸음 · 안 밀림 · 안 뜸 · 안 넘어짐). 그림은 왼쪽을 봄
//   Enemy 를 이어받아(Object.create) 적 목록(G.enemies)에 들어감 → 플레이어 평타 · 기술 · 마법탄 · 속성 효과 · 경험치는 보통 적과 같은 길.
//     다른 점: 맞는 상자(hurtbox) = 지금 그림의 부위 상자(머리 · 발톱 · 몸 · 약점)를 다 덮는 큰 상자, 높이는 「때린 사람 발 줄」 기준(깊이 상관없이 맞음 = 거대한 몸)
//              어느 부위를 맞았는지는 main.js onHit 가 Raid.part(맞은 곳 x, 높이)로 물어서 데미지 배율(parts)을 곱함
//   공격(pats): 불 뿜기 · 발톱 내려찍기(+ 충격파) · 꼬리 쓸기 · 머리 돌진(빗나가면 박힘) · 용암 바닥 · 날아올라 운석 비. 전부 바닥 빨간 예고
//   단계: 체력 skyAt 아래 = 포효(밀어냄 + 도깨비 부름) → 운석 비 시작, rageAt 아래 = 격노(빨라짐 · 불길이 쓸고 지나감)
//   그로기: 머리 · 약점을 맞히면 파란 막대가 참 → 다 차면 쓰러져 ms 동안 머리 전체 = 약점
//   그림 메모리(HD 36장 ≈ 42MB): 레이드에 들어갈 때만 불러오고(Raid.load), 다른 판 · 던전으로 가면 놓아줌(Raid.free → Assets.forget)
//   main.js 가 쓰는 것: init(도구) · load(boss 값) · ready() · free() · reset() · spawn() · boss() · part(e, x, h) · wallX() · addDraw(ents) · drawOver()
//                       bar()(체력 막대 값) · bot(플레이어)(시험 자동 조종) · debug
(function () {
  var H = null;          // main.js 가 넘겨 준 도구(init)
  var B = null;          // config boss 값
  var J = null;          // dragon.json
  var ART = null;        // { frames: { 장 이름: 그림 }, pv: 기준점(그림 점), fx: { 이름: { img, pv } }, paths: 불러온 경로 }
  var job = null, gen = 0;
  var boss = null;
  // 바닥 · 공중 위험: strips 는 안 씀(예고는 공격마다 그림), pools = 불바다 자국, rings = 충격파 고리, meteors = 운석, puffs = 그림 효과 한 번(먼지 · 터짐)
  //   빙결의 여왕(2026-11-08): spikes = 얼음 가시 줄, spears = 날아가는 얼음 창, icicles = 고드름(빨간 원 → 떨어짐), chunks = 얼음 조각(튀는 그림)
  var hz = { pools: [], rings: [], meteors: [], puffs: [], spikes: [], spears: [], icicles: [], chunks: [] };
  function clearHz() { Object.keys(hz).forEach(function (k) { hz[k].length = 0; }); }
  var LINE_COLS = ['#d81a3a', '#e8642a', '#e0b02a', '#6ab83a', '#2a9ad8', '#8a4ad8'];

  function CFGv() { return window.CFG; }
  function AS() { return CFGv().actorScale || 1; }
  function rr(a) { return a[0] + Math.random() * (a[1] - a[0]); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function ease(u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }
  function W() { return H.world; }
  function P() { return H.G().player; }

  // ---------- 불러오기 · 놓아주기 ----------
  function frameNames() { var out = []; Object.keys(J.anims).forEach(function (a) { J.anims[a].frames.forEach(function (f) { if (out.indexOf(f) < 0) out.push(f); }); }); return out; }
  function load(BC) {
    B = BC;
    if (job) return job;
    var my = ++gen;
    job = fetch(BC.json).then(function (r) { return r.json(); }).then(function (j) {
      if (my !== gen) return null;
      J = j;
      var names = frameNames(), paths = names.map(function (n) { return BC.dir + n + '.png'; }), pv = { x: J.pivot1x[0], y: J.pivot1x[1] };
      var FXD = fxDefs(), fxN = Object.keys(FXD), fxP = fxN.map(function (k) { return BC.dir + 'fx/' + k + '.png'; });
      // 빙결의 여왕(2026-11-08): 졸개(얼음 정령) 그림 = dir + minion/이름.png (queen.json minion.frames)
      var MND = (J.minion && J.minion.frames) || {}, mnN = Object.keys(MND), mnP = mnN.map(function (k) { return BC.dir + 'minion/' + k + '.png'; });
      // 그림 한 장씩(loadSet 은 못 읽은 그림을 빼서 순서가 밀리므로 한 장 묶음으로)
      return Promise.all([
        Promise.all(paths.map(function (src) { var q = { x: pv.x, y: pv.y }; return Assets.loadSet([src], AS(), q).then(function (l) { return { img: l[0] || null, pv: q }; }); })),
        Promise.all(fxN.map(function (k, i) { var F = FXD[k], q = { x: F.pivot[0], y: F.pivot[1] }; return Assets.loadSet([fxP[i]], AS(), q).then(function (l) { return { img: l[0] || null, pv: q }; }); })),
        Promise.all(mnN.map(function (k, i) { var F = MND[k], q = { x: F.pivot[0], y: F.pivot[1] }; return Assets.loadSet([mnP[i]], AS(), q).then(function (l) { return { img: l[0] || null, pv: q }; }); }))
      ]).then(function (r) {
        if (my !== gen) { Assets.forget(paths.concat(fxP, mnP)); return null; }
        var fr = {}, fx = {}, miss = 0;
        names.forEach(function (n, i) { fr[n] = r[0][i].img; if (!fr[n]) miss++; });
        fxN.forEach(function (k, i) { fx[k] = r[1][i]; });
        if (miss) console.warn('레이드 그림 못 읽음:', miss);
        var mn = {}; mnN.forEach(function (k, i) { mn[k] = r[2][i]; });
        ART = { frames: fr, pv: r[0][0].pv, fx: fx, mn: mn, paths: paths.concat(fxP, mnP) };
        registerT();
        // 미리 풀어 두기(decode): 처음 그릴 때(불 뿜기 · 운석 첫 장면) 멈칫하지 않게. 레이드 동안만 메모리에 둠
        var all = names.map(function (n) { return fr[n]; }).concat(fxN.map(function (k) { return fx[k].img; }), mnN.map(function (k) { return mn[k].img; })).filter(function (im) { return im && im.decode; });
        return Promise.all(all.map(function (im) { return im.decode().catch(function () {}); })).then(function () { return my === gen ? ART : null; });
      });
    }).catch(function (e) { console.warn('레이드 불러오기 실패', e); job = null; return null; });
    return job;
  }
  function fxDefs() { return (J && J.fx && (J.fx.frames || J.fx)) || {}; }   // 화염룡 = fx 에 바로, 빙결의 여왕 = fx.frames
  function ready() { return !!ART; }
  function free() {
    gen++; job = null; reset();
    if (ART) Assets.forget(ART.paths);
    ART = null; J = null;
  }
  // 적 목록에 들어갈 「종류」 값(config enemies 에 없던 것을 만들어 둠): Enemy 가 쓰는 기본 값 + 보스 표시(T.boss = 보스 쓰러짐 길 · 경험치 · 안 뜸)
  function registerT() {
    var E = CFGv().enemies;
    if (E[B.type] && E[B.type].raid) return;
    E[B.type] = { label: B.name, boss: true, raid: true, noLaunch: true, superArmor: true, hp: B.hp, radius: 60, height: 150,
      hurtbox: { x0: -100, x1: 100, yTop: -150, yBot: 0 }, hover: [0, 0], range: [0, 0], engage: 0, cooldown: [1000, 1000],
      speedX: 0, speedY: 0, anims: {}, attacks: {}, pivot: { x: ART.pv.x, y: ART.pv.y }, rageColor: (B.rage && B.rage.color) || '#ff5a1a', drawScale: 0.6 };   // pivot · drawScale = 등장 컷인 얼굴판(main.js drawIntro)
    if (B.minion && ART.mn.walk_01) registerMinion(E);
    if (B.pats && B.pats.conjure) registerWall(E);
  }

  // ---------- 자리 · 크기 ----------
  // 크기 k: 키 작은 화면(PC 아래 막대 = 보이는 높이 196)에서 머리가 화면 위로 안 잘리게 조금 줄임(0.75 ~ 1)
  function fitK() {
    var w = W(), gy = w.bgOff + B.groundY, top = (J.worldHeight || 195);
    return clamp((gy - (B.fitTop != null ? B.fitTop : 8)) / top, 0.75, 1);
  }
  function S() { return AS() * (boss ? boss.k : 1); }
  // 부위 상자 [x0, x1, yTop, yBot](1배, 앞 = +) → 화면 x 범위 · 땅에서 높이 범위
  //   빙결의 여왕(2026-11-08): e.fd = 보는 쪽(-1 = 왼쪽 = 그림 그대로, +1 = 오른쪽 = 뒤집음 · 싸움터 왼쪽에 섬). 화염룡은 늘 -1
  function wbox(b, e) { var s = AS() * e.k; return e.fd > 0 ? { x0: e.x + b[0] * s, x1: e.x + b[1] * s, h0: -b[3] * s, h1: -b[2] * s } : { x0: e.x - b[1] * s, x1: e.x - b[0] * s, h0: -b[3] * s, h1: -b[2] * s }; }
  function frameBoxes(e) { return (J && J.frames[e.fr]) || {}; }
  function wallX() {   // 오른쪽 벽 = 기준점에서 wall(1배 그림 점) 앞(플레이어는 이 왼쪽). 빙결의 여왕 얼음 벽이 서 있으면 그 앞면. 여왕이 왼쪽에 있으면 없음(null)
    if (!boss || !boss.alive() || boss.fd > 0) return null;
    var w = boss.x - B.wall * S();
    adds.forEach(function (m) { if (m.iceWall && m.up() && !(m.fd > 0)) w = Math.min(w, m.x - m.halfW); });
    return w;
  }
  function wallL() {   // 왼쪽 벽(빙결의 여왕이 순간이동으로 싸움터 왼쪽에 섰을 때만): 플레이어는 이 오른쪽
    if (!boss || !boss.alive() || !(boss.fd > 0)) return null;
    var w = boss.x + B.wall * S();
    adds.forEach(function (m) { if (m.iceWall && m.up() && m.fd > 0) w = Math.max(w, m.x + m.halfW); });
    return w;
  }
  function arena() {   // 플레이어가 설 수 있는 가로 범위(보이는 화면 안, 보스 · 얼음 벽 앞까지)
    var c = H.G().camX, LW = H.LW(), wl = wallL(), wr = wallX();
    return { lo: wl != null ? wl + 6 : c + 24, hi: wr != null ? wr - 6 : c + LW - 24 };
  }
  function lane() { var w = W(), L0 = w.laneTop, L1 = w.laneBottom; return { L0: L0, L1: L1, mid: (L0 + L1) / 2, h: L1 - L0 }; }
  function halfOf(y) { return y > lane().mid ? 1 : 0; }   // 0 = 뒤쪽 반, 1 = 앞쪽 반
  function halfY(hf) { var L = lane(); return hf ? [L.mid - 2, L.L1 + 4] : [L.L0 - 4, L.mid + 2]; }

  // ---------- 용 ----------
  function Dragon(x, y) {
    Enemy.call(this, B.type, CFGv(), { idle: [ART.frames.roar_03 || ART.frames.idle_01] }, x, y);   // art.idle = 등장 컷인 얼굴판 그림(포효)
    this.raid = true; this.entered = true; this.dir = -1; this.state = 'idle';
    this.homeX = x; this.homeY = y; this.k = fitK();
    this.label = B.name; this.noDrop = true;
    this.st = 'enter'; this.t = 0; this.fr = 'takeoff_04';
    this.lift = -9999; this.lean = 0; this.leanTo = 0;
    this.gauge = 0; this.weakOpen = false; this.pat = null; this.gapT = 900; this.last = null;
    this.skyOn = false; this.rageOn = false; this.pend = null; this.lagHp = 0; this.barOn = false; this.deadT = 0; this.burst = false;
    this.log = [];        // 시험용: 쓴 공격 · 맞힌 부위
    this.hitLog = { head: 0, claw: 0, body: 0, weak: 0 }; this.taken = {}; this.dmgLog = { head: 0, claw: 0, body: 0, weak: 0 };
  }
  Dragon.prototype = Object.create(Enemy.prototype);
  Dragon.prototype.constructor = Dragon;
  Dragon.prototype.canLaunch = function () { return false; };
  Dragon.prototype.airborne = function () { return false; };
  Dragon.prototype.faded = function () { return true; };     // 밀어내기(separate)에서 뺌 — 거대한 몸은 벽(wallX)으로 막음
  Dragon.prototype.tryGuard = function () { return false; };
  Dragon.prototype.keepInView = function () {};
  Dragon.prototype.flyZ = function () { return 0; };
  Dragon.prototype.speedMul = function () { return 1; };
  Dragon.prototype.rageK = function () { return 0; };
  Dragon.prototype.canBeHit = function () { return this.alive() && this.st !== 'enter' && !(this.lift < -2) && !!(J && J.frames[this.fr] && J.frames[this.fr].body); };
  Dragon.prototype.canBeHitBy = function () { return this.canBeHit(); };
  Dragon.prototype.currentImg = function () { return ART && ART.frames[this.fr]; };
  // 맞는 상자: 부위 상자를 다 덮는 큰 상자. 높이 = 플레이어 발 줄 기준, 깊이(z) = 플레이어 줄(거대한 몸 = 어느 줄에서나 맞음)
  Dragon.prototype.hurtbox = function () {
    var p = P(), Fb = frameBoxes(this), x0 = 1e9, x1 = -1e9, h1 = 0, any = false, self = this;
    ['head', 'claw', 'body', 'base', 'weak'].forEach(function (k) { if (!Fb[k]) return; var b = wbox(Fb[k], self); any = true; x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1); h1 = Math.max(h1, b.h1); });
    var y = p ? p.y : this.y;
    if (!any || this.lift < -2) return { x0: this.x, x1: this.x + 1, y0: -9999, y1: -9998, z: y };
    return { x0: x0, x1: x1, y0: y - h1, y1: y, z: y };
  };
  // 맞은 곳(x, 땅에서 높이 h) → 부위. 약점은 열려 있을 때만(아니면 몸). 상자 안이 없으면 가장 가까운 부위
  function part(e, x, h) {
    if (e.iceWall) return { part: 'wall', mul: 1 };   // 얼음 벽(빙결의 여왕 소환): 부위 없음
    var Fb = frameBoxes(e), order = ['weak', 'head', 'claw', 'body', 'base'], best = null, bd = 1e9;
    for (var i = 0; i < order.length; i++) {
      var k = order[i]; if (!Fb[k] || (k === 'weak' && !e.weakOpen)) continue;
      var b = wbox(Fb[k], e), dx = x < b.x0 ? b.x0 - x : x > b.x1 ? x - b.x1 : 0, dh = h < b.h0 ? b.h0 - h : h > b.h1 ? h - b.h1 : 0, d = dx + dh;
      if (d === 0) { best = k; break; }
      if (d < bd) { bd = d; best = k; }
    }
    best = best || 'body';
    return { part: best, mul: (B.parts && B.parts[best]) || 1 };
  }
  Dragon.prototype.takeHit = function (dmg, dir, knock, fin, opts) {
    opts = opts || {};
    if (!this.alive() || (!opts.force && !this.canBeHit())) return null;
    this.hp = Math.max(0, this.hp - dmg);
    this.flashT = 90;
    var pt = opts.part;
    if (pt) { this.hitLog[pt] = (this.hitLog[pt] || 0) + 1; this.dmgLog[pt] = (this.dmgLog[pt] || 0) + dmg; }
    if (pt && this.st !== 'groggy' && (pt === 'head' || pt === 'weak')) {
      this.gauge = Math.min(B.groggy.max, this.gauge + B.groggy[pt]);
      if (this.gauge >= B.groggy.max && this.hp > 0) this.startGroggy();
    }
    if (this.hp <= 0) { this.die(); return 'dead'; }
    return 'armor';
  };
  Dragon.prototype.die = function () {
    this.state = 'dead'; this.st = 'dead'; this.t = 0; this.deadT = 0; this.pat = null; this.weakOpen = false; this.lean = 0; this.leanTo = 0;
    if (this.lift < 0) this.lift = 0;
    hz.meteors.length = 0; hz.rings.length = 0;
    this.log.push('dead');
  };
  Dragon.prototype.startGroggy = function () {
    this.pat = null; this.st = 'groggy'; this.t = 0; this.gauge = B.groggy.max; this.leanTo = 0;
    if (this.lift < 0) this.lift = 0;
    H.banner('그로기!', 'boss'); H.snd('bossDown', { k: 1.5, v: 0.7 }); H.shake(2.4, 420);
    H.G().hitstop = Math.max(H.G().hitstop, 160);
    this.log.push('groggy');
  };
  function hpK(e) { return e.hp / e.maxHp; }
  function wk(e) { return e.rageOn ? B.rage.warnK : 1; }
  // 플레이어를 때림(main.js onPlayerHit). 막혔으면(무적 · 회피) false
  function hitP(e, spec) {
    var ok = H.hit({ x: e.x, dmgMul: e.dmgMul, T: e.T }, spec), k = (e.pat && e.pat.name) || 'shock';
    if (ok) e.taken[k] = (e.taken[k] || 0) + 1;   // 시험용: 공격마다 맞힌 수
    return ok;
  }

  // ---------- 매 장면 ----------
  Dragon.prototype.update = function (dt, E) {
    var p = P();
    this.x = this.homeX; this.y = this.homeY; this.vx = 0;   // 박혀 있음(달리며 공격 · 밀어내기 · 포효 밀림에 안 움직임)
    this.k = fitK();
    this.clock += dt; this.t += dt;
    if (this.flashT > 0) this.flashT -= dt;
    this.lean += (this.leanTo - this.lean) * Math.min(1, dt / 90);
    stepHz(this, dt, p);
    if (this.st === 'dead') { this.deadStep(dt); return; }
    if (this.st !== 'groggy' && this.gauge > 0) this.gauge = Math.max(0, this.gauge - B.groggy.decay * dt / 1000);
    if (!this.skyOn && hpK(this) <= B.skyAt) { this.skyOn = true; this.pend = 'sky'; }
    if (!this.rageQ && hpK(this) <= B.rageAt && !this.pend) { this.rageQ = true; this.pend = 'rage'; }
    if (this.st === 'enter') this.enterStep(dt, p);
    else if (this.st === 'groggy') this.groggyStep(dt);
    else if (this.st === 'roar') this.roarStep(dt, p);
    else if (this.st === 'pat') this.patStep(dt, p);
    else this.idleStep(dt, p);
    if (this.rageOn && this.alive() && Math.random() < dt / 260 && H.Skills.debris)   // 격노: 몸에서 불티가 계속 날림(빙결의 여왕 = 눈송이, rage.cols)
      H.Skills.debris(this.x - rr([-40, 120]) * this.k, this.y - rr([40, 150]) * this.k + this.lift, this.y, 2, { cols: B.rage.cols || ['#fff2a0', '#ff9a2a', '#ff3a1a'], glow: true, sp: 60, size: 1.4, ms: 700, g: -60 });
  };
  // 등장: 땅울림(rumble) → 위에서 떨어져 쿵(drop) → 내려앉음(land) → 포효 + 이름 컷인(main.js startIntro) → 싸움
  Dragon.prototype.enterStep = function (dt, p) {
    var t = this.t, R = B.enter || { rumbleMs: 1100, dropMs: 520, landMs: 420, roarMs: 1400 }, top = -(W().bgOff + B.groundY + 40);
    if (t < R.rumbleMs) {
      this.lift = -9999; this.fr = 'takeoff_04';
      if (Math.floor(t / 180) !== Math.floor((t - dt) / 180)) { H.shake(0.5 + t / R.rumbleMs * 1.2, 200); H.snd('land', { v: 0.6 }); }
      if (Math.random() < dt / 70 && H.Skills.debris) H.Skills.debris(H.G().camX + Math.random() * H.LW(), W().bgOff + 30 + Math.random() * 40, lane().L0 + Math.random() * lane().h, 1, { cols: ['#5a4a46', '#3a2a2a', '#ff8a3a'], sp: 30, size: 1.6, ms: 700 });
      return;
    }
    t -= R.rumbleMs;
    if (t < R.dropMs) {
      if (!this.dropSnd) { this.dropSnd = true; H.snd('meteorFall', { k: 0.6 }); }
      var u = t / R.dropMs; this.lift = top * (1 - u * u); this.fr = Math.floor(t / 110) % 2 ? 'takeoff_03' : 'takeoff_04'; return;
    }
    t -= R.dropMs;
    if (!this.landed) { this.landed = true; this.lift = 0; landFx(this, true); H.G().hitstop = Math.max(H.G().hitstop, 140); }
    if (t < R.landMs) { this.fr = t < R.landMs * 0.5 ? 'takeoff_02' : 'takeoff_01'; return; }
    t -= R.landMs;
    if (t < R.roarMs) {
      this.fr = t < 300 ? 'roar_02' : t < R.roarMs - 300 ? 'roar_03' : 'roar_04';
      if (t >= 300 && !this.roared) {
        this.roared = true; this.barOn = true;
        H.snd('bossRoar', { k: 0.7, v: 1 }); H.shake(3.2, 900); H.flash({ color: '#ff5a1a', alpha: 0.35, ms: 380 });
        H.intro(this);
      }
      return;
    }
    this.st = 'idle'; this.t = 0; this.gapT = 700; this.fr = 'idle_01';
  };
  Dragon.prototype.idleStep = function (dt, p) {
    this.weakOpen = false; this.leanTo = 0;
    this.fr = frameOf('idle', this.clock, true);
    if (this.pend) { this.startRoar(this.pend); this.pend = null; return; }
    this.gapT -= dt;
    if (this.gapT > 0 || !p || p.state === 'dead') return;
    this.startPat(this.pick(p));
  };
  // 다음 공격 고르기: 무게(weight) x 가까우면 nearK, from(체력 비율) 아래부터, 같은 것 연달아는 무게 1/4
  Dragon.prototype.pick = function (p) {
    var fd = this.fd > 0 ? 1 : -1, L = [], tot = 0, hk = hpK(this), front = this.x + fd * (B.front || 325) * S(), self = this;
    Object.keys(B.pats).forEach(function (n) {
      var q = B.pats[n], w = q.weight || 1;
      if (q.from != null && hk > q.from) return;
      if (q.phase2 && !self.rageOn) return;   // 빙결의 여왕: 격노(2단계) 뒤에만(얼음 벽 · 정령 소환 · 순간이동)
      if (n === 'conjure' && liveAdds() > 0) w *= 0.15;   // 정령 · 벽이 아직 있으면 거의 안 함
      if (n === 'teleport' && iceWallUp()) return;        // 얼음 벽이 서 있으면 순간이동 안 함(벽과 겹침)
      if (q.near && (front - p.x) * -fd < q.near) w *= q.nearK || 1;
      if (n === self.last) w *= 0.25;
      if (n === 'sky' && self.lastSkyT != null && self.clock - self.lastSkyT < 14000) w *= 0.15;   // 운석 비는 너무 자주 안 나옴
      L.push([n, w]); tot += w;
    });
    var r = Math.random() * tot;
    for (var i = 0; i < L.length; i++) { r -= L[i][1]; if (r < 0) return L[i][0]; }
    return L[0][0];
  };
  Dragon.prototype.startPat = function (name) {
    var p = P(), Q = B.pats[name];
    this.st = 'pat'; this.t = 0; this.last = name;
    this.pat = { name: name, Q: Q, ph: 'warn', t: 0, wMs: Q.warnMs * wk(this) };
    var a = this.pat;
    if (name === 'breath') { a.half = halfOf(p.y); a.sweep = this.rageOn; a.tick = 0; a.pool = 0; }
    if (name === 'bite') { a.lineY = p.y; }
    if (name === 'lava') { a.half = halfOf(p.y); a.cyc = 0; a.tick = 0; }
    if (name === 'sky') { this.lastSkyT = this.clock; a.n = 0; a.next = 0; }
    this.log.push(name);
  };
  Dragon.prototype.endPat = function () {
    this.pat = null; this.st = 'idle'; this.t = 0; this.weakOpen = false; this.leanTo = 0;
    this.gapT = rr(B.gap) * (this.rageOn ? B.rage.gapK : 1);
  };
  // 공격 진행: 단계(ph)마다 그림 · 판정
  Dragon.prototype.patStep = function (dt, p) {
    var a = this.pat, Q = a.Q, s = S(), Fj = J.frames, self = this;
    a.t += dt;
    function next(ph) { a.ph = ph; a.t = 0; }
    switch (a.name) {
      case 'breath': {
        var ys = halfY(a.half);
        if (a.ph === 'warn') {
          this.fr = 'breath_01'; this.weakOpen = true;
          if (a.t >= a.wMs) { next('fire'); H.snd('fireball', { k: 0.5, v: 1.2 }); H.snd('firePillar', { v: 0.8 }); }
        } else if (a.ph === 'fire') {
          this.weakOpen = false;
          this.fr = a.t < 100 ? 'breath_02' : a.t < 220 ? 'breath_03' : 'breath_04';
          var u = clamp(a.t / Q.fireMs, 0, 1), band = this.breathBand();
          a.tick -= dt;
          if (a.tick <= 0 && a.t > 120) {
            a.tick = Q.tickMs;
            var m = this.mouth();
            if (p.state !== 'dead' && p.x < m.x + 6 && p.y >= band[0] && p.y <= band[1]) hitP(this, Q);
          }
          a.pool -= dt;
          if (a.pool <= 0 && a.t > 200) { a.pool = 150; var mx = this.mouth().x; hz.pools.push({ x: H.G().camX + Math.random() * Math.max(20, mx - H.G().camX - 10), y: lerp(band[0], band[1], 0.25 + Math.random() * 0.5), t: 0, ms: Q.poolMs }); if (hz.pools.length > 18) hz.pools.shift(); }
          if (Math.floor(a.t / 220) !== Math.floor((a.t - dt) / 220)) H.shake(0.6, 160);
          if (u >= 1) next('rec');
        } else { this.fr = 'idle_01'; if (a.t >= 380) this.endPat(); }
        break;
      }
      case 'slam': {
        if (a.ph === 'warn') {
          this.fr = 'slam_01'; this.weakOpen = true;
          if (a.t >= a.wMs) next('swing');
        } else if (a.ph === 'swing') {
          this.weakOpen = false; this.fr = 'slam_02';
          if (a.t >= 90) {
            next('hold'); this.fr = 'slam_03';
            var R0 = wbox(Fj.slam_03.reach, this), fx = Fj.slam_03.fxAt, ix = this.x - fx[0] * s, L = lane();
            if (p.state !== 'dead' && p.x >= R0.x0 && p.x <= R0.x1 && (p.z || 0) <= R0.h1) hitP(this, Q);
            hz.rings.push({ x: ix, y: L.mid, t: 0, Q: Q.shock, e: this, hit: false, harm: true });
            puff('meteor_impact_01', ix, L.mid + 2, 480, 0.5, 0.62, 1, false);
            puff('dust_01', ix - 30 * this.k, L.mid + 8, 520, 0.45, 0.7, 0.9, false);
            puff('dust_01', ix + 30 * this.k, L.mid - 6, 520, 0.45, 0.7, 0.9, true);
            if (H.Skills.debris) H.Skills.debris(ix, L.mid - 6, L.mid, 14, { cols: ['#fff2a0', '#ff9a2a', '#3a2a2a', '#6a5a56'], glow: true, sp: 220, size: 2, ms: 600 });
            H.shake(3.4, 520); H.snd('skSlam', { k: 0.6, v: 1.3 }); H.snd('meteorBoom', { k: 0.8 });
            H.G().hitstop = Math.max(H.G().hitstop, 90);
          }
        } else if (a.ph === 'hold') {
          this.fr = 'slam_03';
          if (a.t >= Q.plantMs) next('rec');
        } else { this.fr = 'slam_04'; if (a.t >= 350) this.endPat(); }
        break;
      }
      case 'tail': {
        if (a.ph === 'warn') {
          this.fr = a.t < a.wMs - 130 ? 'tail_01' : 'tail_02'; this.weakOpen = true;
          if (Math.floor(a.t / 190) !== Math.floor((a.t - dt) / 190)) { var L1 = lane(); puff('dust_01', this.x + rr([150, 210]) * s, L1.L0 + Math.random() * L1.h, 520, 0.35, 0.55, 0.85, Math.random() < 0.5); }
          if (a.t >= a.wMs) { next('act'); H.snd('swingHeavy', { k: 0.5, v: 1.4 }); a.hit = false; a.dustX = null; H.shake(2.4, 420); }
        } else if (a.ph === 'act') {
          // 2026-11-07: 쓸기 앞끝(front)이 용 쪽(R1.x1)에서 바깥(R1.x0)으로 activeMs 동안 지나감. 앞끝이 지나간 자리(front ~ 용)에 있으면 맞음(점프 dodgeZ · 회피 무적으로 피함)
          this.weakOpen = false; this.fr = 'tail_03';
          var R1 = wbox(Fj.tail_03.reach, this), u1 = clamp(a.t / Q.activeMs, 0, 1), front = lerp(R1.x1, R1.x0, 1 - (1 - u1) * (1 - u1) * 0.35 - (1 - u1) * 0.65);
          a.front = front; a.R1 = R1;
          if (!a.hit && p.state !== 'dead' && p.x >= front && p.x <= R1.x1 && (p.z || 0) <= Q.dodgeZ) a.hit = hitP(this, Q) || a.hit;
          if (a.dustX == null || a.dustX - front > 35 * s) {   // 앞끝을 따라 먼지 · 돌 튐 + 흔들림
            a.dustX = front; var L2 = lane();
            puff('dust_01', front, L2.L0 + Math.random() * L2.h * 0.5, 480, 0.45, 0.8, 0.9, Math.random() < 0.5);
            puff('dust_01', front + 20 * s, L2.mid + Math.random() * L2.h * 0.5, 480, 0.45, 0.8, 0.9, Math.random() < 0.5);
            if (H.Skills.debris) H.Skills.debris(front, L2.mid, L2.L1, 6, { cols: ['#6a5a4a', '#8a7258', '#c8b08a', '#fff2c0'], sp: 200, size: 2, ms: 500 });
            H.shake(1.2, 160);
          }
          if (a.t >= Q.activeMs) next('rec');
        } else { this.fr = 'tail_04'; if (a.t >= 350) this.endPat(); }
        break;
      }
      case 'bite': {
        if (a.ph === 'warn') {
          this.fr = 'bite_01'; this.weakOpen = true;
          if (a.t < a.wMs - 220) a.lineY = clamp(p.y, lane().L0, lane().L1);   // 마지막 0.22초 전까지 플레이어 줄을 따라감 → 고정
          if (a.t >= a.wMs) { next('lunge'); H.snd('swingHeavy', { k: 0.6 }); a.hit = false; }
        } else if (a.ph === 'lunge') {
          this.weakOpen = false; this.fr = 'bite_02'; this.leanTo = (a.lineY - this.homeY) * 0.75;
          var R2 = wbox(Fj.bite_02.reach, this), bx1 = Math.max(R2.x1, wbox(Fj.bite_03.head, this).x1);   // 앞 = 물기 상자, 뒤 = 박힌 머리 끝(앞발 위에 선 플레이어도)
          if (!a.hit && p.state !== 'dead' && p.x >= R2.x0 - 6 && p.x <= bx1 && Math.abs(p.y - a.lineY) <= Q.depth && (p.z || 0) <= R2.h1) a.hit = hitP(this, Q) || a.hit;
          if (a.t >= Q.lungeMs) {
            next('stuck'); a.stuckMs = a.hit ? Q.hitStuckMs : Q.stuckMs;
            var hx = this.x - 330 * s;
            puff('dust_01', hx, a.lineY + 3, 560, 0.45, 0.75, 0.9, false); puff('meteor_impact_01', hx, a.lineY + 2, 380, 0.3, 0.4, 0.8, false);
            H.shake(2.6, 360); H.snd('hitHeavy', { k: 0.6, v: 1.3 });
            if (!a.hit) { H.banner('지금이다! 머리를 쳐라!', 'small'); }
          }
        } else if (a.ph === 'stuck') {
          this.fr = 'bite_03'; this.weakOpen = true;
          if (a.t >= a.stuckMs) next('rec');
        } else { this.fr = 'bite_04'; this.weakOpen = false; this.leanTo = 0; if (a.t >= 320) this.endPat(); }
        break;
      }
      case 'lava': {
        // 한 바퀴 = warn(끓음 예고) → erupt(분출). 다음 바퀴는 반대쪽 반
        this.fr = 'roar_01';
        var hf = (a.half + a.cyc) % 2;
        a.cur = hf;
        if (a.ph === 'warn') {
          if (a.t < 30 && a.cyc === 0) H.snd('earthRise', { k: 0.6 });
          if (a.t >= a.wMs) { next('erupt'); a.tick = 0; H.snd('fireBoom', { k: 0.6, v: 1.2 }); H.shake(1.8, 300); }
        } else if (a.ph === 'erupt') {
          var ys2 = halfY(hf);
          a.tick -= dt;
          if (a.tick <= 0) {
            a.tick = Q.tickMs;
            if (p.state !== 'dead' && p.y >= ys2[0] && p.y <= ys2[1] && (p.z || 0) <= 10 && p.x < wallX() + 20) hitP(this, Q);
            if (H.Skills.debris) for (var j = 0; j < 3; j++) H.Skills.debris(H.G().camX + Math.random() * (wallX() - H.G().camX), lerp(ys2[0], ys2[1], Math.random()), lerp(ys2[0], ys2[1], 0.5), 3, { cols: ['#fff2a0', '#ffb43a', '#ff5a1a'], glow: true, sp: 90, size: 1.8, ms: 520, g: -120 });
          }
          if (a.t >= Q.eruptMs) { a.cyc++; if (a.cyc >= Q.cycles) next('rec'); else next('warn'); a.wMs = Q.warnMs * wk(this) * 0.8; }
        } else { this.fr = 'idle_01'; if (a.t >= 300) this.endPat(); }
        break;
      }
      case 'sky': {
        var top2 = -(W().bgOff + B.groundY + 60);
        if (a.ph === 'warn') {   // 날갯짓 돌풍
          this.fr = a.t < 220 ? 'takeoff_01' : 'takeoff_02'; this.weakOpen = false;
          if (a.t >= 220 && !a.gust) {
            a.gust = true; H.snd('skSpin', { k: 0.5, v: 1.2 }); H.shake(1.4, 300);
            var R3 = wbox(Fj.takeoff_02.reach, this);
            if (p.state !== 'dead' && p.x >= R3.x0 - 40) { hitP(this, Q.gust); pushP(Q.gust.push, 320); }
            for (var g = 0; g < 3; g++) puff('dust_01', this.x - (140 + g * 70) * s, lerp(lane().L0, lane().L1, Math.random()), 500, 0.4, 0.8, 0.8, true);
          }
          if (a.t >= Q.gustMs) next('rise');
        } else if (a.ph === 'rise') {
          var u2 = clamp(a.t / Q.riseMs, 0, 1); this.lift = top2 * u2 * u2;
          this.fr = Math.floor(a.t / 110) % 2 ? 'takeoff_03' : 'takeoff_04';
          if (u2 >= 1) { next('rain'); H.banner('운석이 떨어진다!', 'small'); }
        } else if (a.ph === 'rain') {
          this.lift = top2; this.fr = 'takeoff_04';
          a.next -= dt;
          if (a.n < Q.n && a.next <= 0) {
            a.next = Q.everyMs * (this.rageOn ? 0.8 : 1); a.n++;
            var L3 = lane(), aim = Math.random() < Q.aimK && p.state !== 'dead';
            var mxA = this.x - 150 * s, tx = aim ? p.x : H.G().camX + 24 + Math.random() * (mxA - H.G().camX - 24), ty = aim ? p.y : L3.L0 + 4 + Math.random() * (L3.h - 8);
            hz.meteors.push({ x: clamp(tx, H.G().camX + 16, mxA), y: clamp(ty, L3.L0, L3.L1), t: 0, warn: Q.warnMs * wk(this), Q: Q, e: this });
            H.snd('meteorFall', { v: 0.7 });
          }
          if (a.n >= Q.n && !hz.meteors.length) next('land');
        } else if (a.ph === 'land') {
          var u3 = clamp(a.t / Q.landMs, 0, 1); this.lift = top2 * (1 - u3) * (1 - u3);
          this.fr = u3 < 0.6 ? (Math.floor(a.t / 110) % 2 ? 'takeoff_03' : 'takeoff_04') : 'takeoff_02';
          if (u3 >= 1) { this.lift = 0; landFx(this, false); next('rec'); }
        } else { this.lift = 0; this.fr = 'takeoff_01'; if (a.t >= 300) this.endPat(); }
        break;
      }
    }
  };
  // 포효(단계 바뀜): 'sky' = 절반(운석 비 시작 + 도깨비), 'rage' = 격노
  Dragon.prototype.startRoar = function (kind) {
    this.st = 'roar'; this.t = 0; this.roarKind = kind; this.roared = false; this.pat = null; this.leanTo = 0;
    this.log.push('roar:' + kind);
  };
  Dragon.prototype.roarStep = function (dt, p) {
    var R = B.roar, t = this.t;
    if (t < R.warnMs) { this.fr = t < R.warnMs * 0.45 ? 'roar_01' : 'roar_02'; this.weakOpen = t >= R.warnMs * 0.45; return; }
    t -= R.warnMs; this.weakOpen = false;
    if (!this.roared) {
      this.roared = true;
      H.snd('bossRoar', { k: this.roarKind === 'rage' ? 0.6 : 0.75, v: 1 }); H.shake(3.6, 1000);
      H.flash({ color: this.roarKind === 'rage' ? B.rage.color : '#ffb04a', alpha: 0.45, ms: 420 });
      var hx = this.x - 190 * S(), hy = this.y - 300 * S();
      if (H.Skills.wave) H.Skills.wave(hx, this.y - 2, 160 * this.k, { flat: 0.32, w: 3, ms: 520, color: '#ffe2a0', glow: '#ff7a2a', ground: true, noMax: true });
      if (p.state !== 'dead' && Math.abs(p.x - hx) < R.r) pushP(R.push, 380);
      if (this.roarKind === 'rage') { this.rageOn = true; H.banner(H.josa(B.name, '이', '가') + ' 격노했다!', 'boss'); }
      else {
        H.banner(H.josa(B.name, '이', '가') + ' 날개를 펼쳤다!', 'boss');
        H.summon(B.summon.type, B.summon.n, this);
      }
    }
    if (t < 900) { this.fr = 'roar_03'; return; }
    if (t < 1400) { this.fr = 'roar_04'; return; }
    this.st = 'idle'; this.t = 0; this.gapT = 500;
    if (this.roarKind === 'sky') this.startPat('sky');   // 절반: 바로 날아올라 운석 비
  };
  Dragon.prototype.groggyStep = function (dt) {
    var t = this.t, G2 = B.groggy;
    this.weakOpen = t > 120;
    if (t < 120) this.fr = 'hurt_01';
    else if (t < 340) this.fr = 'hurt_02';
    else if (t < 340 + G2.ms) { this.fr = frameOf('groggy', t, true); if (Math.random() < dt / 300 && H.Skills.debris) H.Skills.debris(this.x - 270 * S(), this.y - 70 * S(), this.y, 1, { cols: ['#bfe8ff', '#ffffff'], glow: true, sp: 30, size: 1.4, ms: 600, g: -50 }); }
    else if (t < 340 + G2.ms + 260) { this.fr = 'hurt_01'; this.weakOpen = false; }
    else { this.gauge = 0; this.st = 'idle'; this.t = 0; this.gapT = 600; this.weakOpen = false; }
    if (this.st === 'groggy') this.gauge = G2.max * (1 - clamp((t - 340) / G2.ms, 0, 1));   // 막대가 줄며 남은 시간
  };
  Dragon.prototype.deadStep = function (dt) {
    this.deadT += dt; this.lift = 0;
    this.fr = frameOf('death', this.deadT, false);
    var A = J.anims.death, animMs = A.playback.length * 1000 / A.fps;
    if (Math.random() < dt / 90 && this.deadT < animMs + 600 && H.Skills.debris) H.Skills.debris(this.x - rr([-60, 220]) * S(), this.y - rr([20, 160]) * S(), this.y, 2, { cols: ['#fff2a0', '#ff9a2a', '#5a4a46'], glow: true, sp: 80, size: 1.6, ms: 700, g: -40 });
    if (!this.burst && this.deadT >= animMs) { this.burst = true; H.loot(this, this.x - 200 * S(), this.y); H.shake(2.6, 500); }
  };
  // 입 위치(불길 시작): 지금 그림의 mouth(없으면 breath_04)
  Dragon.prototype.mouth = function () {
    var m = (J.frames[this.fr] && J.frames[this.fr].mouth) || J.frames.breath_04.mouth, s = S();
    return { x: this.x - m[0] * s, y: this.y + m[1] * s + this.lean * 0.5 };
  };
  // 불길이 닿는 위아래 띠(지금): 보통 = 고른 반, 격노 = 그 반에서 반대쪽 반으로 쓸고 감
  Dragon.prototype.breathBand = function () {
    var a = this.pat, L = lane();
    if (!a.sweep) return halfY(a.half);
    var u = clamp((a.t - 120) / (a.Q.fireMs - 120), 0, 1), from = a.half ? L.L1 + 4 : L.L0 - 4, to = a.half ? L.L0 - 4 : L.L1 + 4, hh = L.h * 0.5, c = lerp(from + (a.half ? -hh / 2 : hh / 2), to - (a.half ? -hh / 2 : hh / 2), u);
    return [c - hh / 2, c + hh / 2];
  };
  function frameOf(anim, t, loop) {
    var A = J.anims[anim], pb = A.playback, i = Math.floor(t * A.fps / 1000);
    i = loop ? i % pb.length : Math.min(pb.length - 1, i);
    return A.frames[pb[i] - 1];
  }
  // 플레이어 밀어내기(돌풍 · 포효): ms 동안 왼쪽으로 dist 도트
  var push = null;
  function pushP(dist, ms, dir) { push = { left: dist, ms: ms, t: 0, dir: dir || -1 }; }   // dir = 미는 쪽(-1 왼쪽, +1 오른쪽)
  function landFx(e, big) {
    var L = lane(), s = S();
    H.shake(big ? 4 : 2.8, big ? 700 : 480); H.snd('meteorBoom', { k: big ? 0.6 : 0.75, v: 1.2 });
    puff('dust_01', e.x - 230 * s, L.mid + 10, 700, 0.6, 1.1, 0.95, false);
    puff('dust_01', e.x + 40 * s, L.mid - 4, 700, 0.6, 1.1, 0.95, true);
    puff('shock_ring_01', e.x - 120 * s, L.mid, 600, 0.4, 1.5, 0.8, false);
    if (H.Skills.debris) H.Skills.debris(e.x - 120 * s, L.mid - 10, L.mid, 18, { cols: ['#fff2a0', '#ff9a2a', '#3a2a2a', '#6a5a56'], glow: true, sp: 240, size: 2, ms: 700 });
  }

  // ---------- 위험(고리 · 운석 · 자국 · 효과) ----------
  // 그림 효과 한 번: s0 → s1 배로 커지며(그림 배율 위에) a0 에서 사라짐
  //   gnd = 바닥에 그림(캐릭터 아래, 빙결의 여왕 서리 고리 · 고드름 깨짐)
  function puff(name, x, y, ms, s0, s1, a0, flip, gnd) { hz.puffs.push({ n: name, x: x, y: y, t: 0, ms: ms, s0: s0, s1: s1, a0: a0, flip: !!flip, gnd: !!gnd }); if (hz.puffs.length > 40) hz.puffs.shift(); }
  function ringR(q) { return q.Q.speed * q.t / 1000; }
  function stepHz(e, dt, p) {
    var i, L = lane();
    if (push && p) {   // 밀어내기: 남은 거리를 ms 동안 고르게(벽 · 화면 끝은 main.js 가 막음)
      var d = push.left * Math.min(1, dt / Math.max(1, push.ms - push.t)); push.t += dt; push.left -= d; p.x += push.dir * d;
      if (push.t >= push.ms || push.left <= 0.2) push = null;
    }
    for (i = hz.pools.length - 1; i >= 0; i--) { hz.pools[i].t += dt; if (hz.pools[i].t >= hz.pools[i].ms) hz.pools.splice(i, 1); }
    for (i = hz.puffs.length - 1; i >= 0; i--) { hz.puffs[i].t += dt; if (hz.puffs[i].t >= hz.puffs[i].ms) hz.puffs.splice(i, 1); }
    // 충격파 고리: 반지름이 speed 로 커짐. 테두리(band) 위에 서 있고 dodgeZ 아래면 맞음(한 번)
    for (i = hz.rings.length - 1; i >= 0; i--) {
      var q = hz.rings[i]; q.t += dt;
      var r = ringR(q);
      if (r > q.Q.maxR) { hz.rings.splice(i, 1); continue; }
      if (!q.harm || q.hit || !p || p.state === 'dead' || (p.z || 0) > q.Q.dodgeZ) continue;
      var ry = Math.max(4, r * q.Q.ry), dx = p.x - q.x, dy = p.y - q.y, k = Math.sqrt((dx / r) * (dx / r) + (dy / ry) * (dy / ry));
      if (Math.abs(k - 1) * r <= q.Q.band) q.hit = hitP(e, q.Q);
    }
    // 운석: warn 동안 빨간 원 → 떨어짐(radius · depth 안, dodgeZ 아래면 맞음)
    for (i = hz.meteors.length - 1; i >= 0; i--) {
      var m = hz.meteors[i]; m.t += dt;
      if (m.t < m.warn) continue;
      hz.meteors.splice(i, 1);
      puff('meteor_impact_01', m.x, m.y + 2, 520, 0.42, 0.55, 1, Math.random() < 0.5);
      puff('shock_ring_01', m.x, m.y, 420, 0.12, 0.32, 0.8, false);
      if (H.Skills.debris) H.Skills.debris(m.x, m.y - 6, m.y, 10, { cols: ['#fff2a0', '#ff9a2a', '#ff3a1a', '#3a2a2a'], glow: true, sp: 200, size: 1.8, ms: 520 });
      H.shake(1.8, 300); H.snd('meteorBoom', { v: 0.8 });
      if (p && p.state !== 'dead' && Math.abs(p.x - m.x) <= m.Q.radius && Math.abs(p.y - m.y) <= m.Q.depth && (p.z || 0) <= m.Q.dodgeZ) hitP(m.e, m.Q);
    }
    if (e.queen) stepIce(dt, p);   // 빙결의 여왕: 얼음 가시 · 창 · 고드름 · 얼음 조각
  }

  // ---------- 그림 ----------
  function fxImg(n) { return ART && ART.fx[n]; }
  // 효과 그림 하나: (x, y) = 기준점 자리, k = 그림 배율 위에 더 곱함, rot = 돌림
  function drawFx(g, n, x, y, k, a, flip, rot, sy) {
    var F = fxImg(n); if (!F || !F.img) return;
    g.save(); g.globalAlpha *= a; g.translate(x, y); if (rot) g.rotate(rot); g.scale(flip ? -k : k, k * (sy || 1));
    Assets.blit(g, F.img, F.pv.x, F.pv.y); g.restore();
  }
  function snapv(v) { return window.snapPx ? window.snapPx(v) : Math.round(v); }
  // 꼬리 쓸기 예고(2026-11-07): 걷는 길 가운데 긴 노란 줄 + 용 쪽에서 바깥(왼쪽)으로 흘러가는 화살(<) 여러 개. k = 0~1(진해짐)
  function tailWarn(g, camX, x0, x1, L, k) {
    var now = performance.now(), y = Math.round(L.mid), X0 = x0 - camX, X1 = x1 - camX, a = 0.35 + 0.55 * clamp(k, 0, 1), hh = L.h * 0.5;
    g.save();
    var gr = g.createLinearGradient(X1, 0, X0, 0);
    gr.addColorStop(0, 'rgba(255,200,60,' + (0.28 * a) + ')'); gr.addColorStop(1, 'rgba(255,200,60,0)');
    g.fillStyle = gr; g.fillRect(X0, y - hh, X1 - X0, hh * 2);
    g.fillStyle = 'rgba(255,230,120,' + a + ')'; g.fillRect(X0, y - 2, X1 - X0, 4);
    g.strokeStyle = 'rgba(255,214,80,' + Math.min(1, a + 0.15) + ')'; g.lineWidth = 5;
    var gap = 46, off = (now / 4) % gap;
    for (var x = X1 - off; x > X0 + 10; x -= gap) {
      g.beginPath(); g.moveTo(x + 14, y - hh * 0.55); g.lineTo(x, y); g.lineTo(x + 14, y + hh * 0.55); g.stroke();
    }
    g.restore();
  }
  // 꼬리 쓸기 중(2026-11-07): 앞끝(front) ~ 용 쪽까지 바닥을 따라 흙바람 띠 + 앞끝에 큰 호(휘몰아치는 바람). u = 0~1 진행
  function tailSweep(g, camX, front, x1, L, u) {
    var F = front - camX, X1 = x1 - camX, y = L.mid, hh = L.h * 0.6, fade = 1 - Math.max(0, u - 0.8) / 0.2;
    g.save();
    var gr = g.createLinearGradient(F, 0, X1, 0);
    gr.addColorStop(0, 'rgba(240,215,165,' + (0.85 * fade) + ')'); gr.addColorStop(0.4, 'rgba(210,180,130,' + (0.4 * fade) + ')'); gr.addColorStop(1, 'rgba(200,170,120,0)');
    g.fillStyle = gr; g.fillRect(F, y - hh, X1 - F, hh * 2);
    g.lineCap = 'round';
    for (var i = 0; i < 4; i++) {
      var yy = y - hh * 0.75 + i * hh * 0.5, len = (X1 - F) * (0.35 + 0.15 * i);
      g.strokeStyle = 'rgba(255,245,220,' + (0.7 * fade) + ')'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(F + 6, yy); g.lineTo(F + len, yy + (i - 1.5) * 2); g.stroke();
    }
    g.strokeStyle = 'rgba(255,240,200,' + (0.95 * fade) + ')'; g.lineWidth = 7;
    g.beginPath(); g.ellipse(F + hh * 0.5, y, hh * 0.6, hh * 1.05, 0, Math.PI * 0.55, Math.PI * 1.45); g.stroke();
    g.strokeStyle = 'rgba(255,190,90,' + (0.7 * fade) + ')'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(F + hh * 0.8, y, hh * 0.5, hh * 0.85, 0, Math.PI * 0.6, Math.PI * 1.4); g.stroke();
    g.restore();
  }
  // 빨간 예고 상자(바닥): x0~x1, y0~y1, k = 0~1(진해짐)
  function warnRect(g, camX, x0, x1, y0, y1, k) {
    var blink = Math.floor(performance.now() / 90) % 2;
    var X0 = Math.round(x0 - camX), Wd = Math.round(x1 - x0), Y0 = Math.round(y0), Hh = Math.round(y1 - y0);
    g.fillStyle = 'rgba(255,40,30,' + (0.16 + 0.24 * clamp(k, 0, 1) + (blink ? 0.07 : 0)) + ')';
    g.fillRect(X0, Y0, Wd, Hh);
    g.fillStyle = 'rgba(255,110,70,0.85)';
    g.fillRect(X0, Y0, Wd, 1); g.fillRect(X0, Y0 + Hh - 1, Wd, 1);
  }
  // 바닥 위(적 그림 전에, main.js 가 e.drawTelegraph 로 부름): 불바다 자국 · 용암 바닥 · 공격 예고 · 충격파 고리 · 운석 자리 · 바닥 효과
  Dragon.prototype.drawTelegraph = function (g, camX) {
    var e = this, a = e.pat, L = lane(), Fj = J.frames, s = S(), now = performance.now(), i;
    // 불바다 자국
    hz.pools.forEach(function (q) {
      var u = q.t / q.ms, al = u < 0.1 ? u / 0.1 : u > 0.6 ? (1 - u) / 0.4 : 1;
      drawFx(g, 'lava_pool_01', q.x - camX, q.y, 0.42, al * 0.85, false);
    });
    if (a && e.st === 'pat') {
      var wu = a.ph === 'warn' ? a.t / a.wMs : 1;
      if (a.name === 'breath' && a.ph === 'warn') {
        var m = e.mouth(), xl = H.G().camX - 4;
        if (a.sweep) { var y0 = halfY(a.half), y1 = halfY(1 - a.half); warnRect(g, camX, xl, m.x, y0[0], y0[1], wu); warnRect(g, camX, xl, m.x, y1[0], y1[1], wu * 0.5); arrows(g, camX, (xl + m.x) / 2, a.half ? L.L1 - 6 : L.L0 + 6, a.half ? -1 : 1, wu); }
        else { var yy = halfY(a.half); warnRect(g, camX, xl, m.x, yy[0], yy[1], wu); }
      }
      if (a.name === 'slam' && a.ph === 'warn') { var R0 = wbox(Fj.slam_03.reach, e); warnRect(g, camX, R0.x0, R0.x1, L.L0 - 4, L.L1 + 4, wu); }
      // 꼬리 쓸기(2026-11-07): 예고 = 바닥을 따라 쓸 방향(용 → 바깥)으로 흐르는 노란 화살 줄(빨간 상자 아님), 쓸 때 = 앞끝까지 바람 · 먼지 띠
      if (a.name === 'tail' && a.ph === 'warn') { var R1 = wbox(Fj.tail_03.reach, e); tailWarn(g, camX, R1.x0, R1.x1, L, wu); }
      if (a.name === 'tail' && a.ph === 'act' && a.R1) tailSweep(g, camX, a.front, a.R1.x1, L, a.t / a.Q.activeMs);
      if (a.name === 'bite' && a.ph === 'warn') { var R2 = wbox(Fj.bite_02.reach, e), R3 = wbox(Fj.bite_03.reach, e); warnRect(g, camX, Math.min(R2.x0, R3.x0) - 6, Math.max(R2.x1, R3.x1), a.lineY - a.Q.depth, a.lineY + a.Q.depth, wu); }
      if (a.name === 'lava' && (a.ph === 'warn' || a.ph === 'erupt')) {
        var yh = halfY(a.cur), x1 = wallX() + 30, x0 = H.G().camX - 8, erupt = a.ph === 'erupt';
        if (!erupt) warnRect(g, camX, x0, x1, yh[0], yh[1], wu);
        var cols = Math.ceil((x1 - x0) / 70), rows = 2;
        for (var c = 0; c < cols; c++) for (var r = 0; r < rows; r++) {
          var px = x0 + (c + 0.5 + (r % 2) * 0.4) * (x1 - x0) / cols, py = lerp(yh[0] + 6, yh[1] - 6, (r + 0.5) / rows), fl = 0.5 + 0.5 * Math.sin(now / 90 + c * 1.7 + r);
          drawFx(g, 'lava_pool_01', px - camX, py, erupt ? 0.36 : 0.26 + 0.06 * wu, erupt ? 0.85 + 0.15 * fl : 0.25 + 0.35 * wu * fl, (c + r) % 2 === 1);
        }
      }
    }
    // 충격파 고리(바닥): 그림을 반지름에 맞춰 늘림 + 밝은 테두리
    hz.rings.forEach(function (q) {
      var r = ringR(q), ry = Math.max(4, r * q.Q.ry), u = r / q.Q.maxR, F = fxImg('shock_ring_01');
      var al = q.harm ? (1 - u) * 0.95 : (1 - u) * 0.6;
      if (F && F.img) { var kx = r / (165 * AS()), ky = ry / (42 * AS()); g.save(); g.globalAlpha = al; g.translate(q.x - camX, q.y); g.scale(kx, ky); Assets.blit(g, F.img, F.pv.x, F.pv.y); g.restore(); }
      if (q.harm) { g.save(); g.globalAlpha = al * 0.9; g.strokeStyle = '#ffd28a'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(q.x - camX, q.y, r, ry, 0, 0, Math.PI * 2); g.stroke(); g.restore(); }
    });
    // 운석 떨어질 자리
    for (i = 0; i < hz.meteors.length; i++) { var mm = hz.meteors[i]; Enemy.drawRing(g, camX, mm.x, mm.y, mm.Q.radius, mm.Q.depth, mm.t / mm.warn, false); }
    // 바닥 효과(먼지 · 고리 그림)
    hz.puffs.forEach(function (q) { if (!q.gnd && (q.n === 'shock_ring_01' || q.n === 'lava_pool_01')) drawPuff(g, camX, q); });
  };
  function arrows(g, camX, x, y, dir, k) {   // 쓸고 가는 방향 화살표(격노 불 뿜기 예고)
    g.save(); g.fillStyle = 'rgba(255,220,160,' + (0.5 + 0.4 * k) + ')';
    for (var i = -2; i <= 2; i++) { var cx = Math.round(x - camX + i * 34), cy = Math.round(y + dir * ((performance.now() / 12) % 10)); g.beginPath(); g.moveTo(cx - 6, cy); g.lineTo(cx + 6, cy); g.lineTo(cx, cy + dir * 7); g.closePath(); g.fill(); }
    g.restore();
  }
  function drawPuff(g, camX, q) {
    var u = q.t / q.ms, k = lerp(q.s0, q.s1, 1 - Math.pow(1 - u, 2)), al = q.a0 * (u < 0.15 ? 1 : 1 - (u - 0.15) / 0.85);
    drawFx(g, q.n, q.x - camX, q.y, k, al, q.flip);
  }
  // 용 그림: 그림자 → 몸(기울기 lean · 떠오름 lift) → 맞은 번쩍(밝게 한 번 더) → 약점 빛 · 목 빛 · 격노 빛
  Dragon.prototype.draw = function (g, camX, debug) {
    var im = this.currentImg(), e = this;
    if (!im) return;
    var x = snapv(this.x - camX), gy = this.y, y = gy + this.lift + this.lean, k = this.k, s = S();
    if (this.lift > -2000) {   // 그림자(떠오르면 작고 옅게)
      var fl = clamp(1 + this.lift / 300, 0.2, 1);
      g.save(); g.globalAlpha = 0.38 * fl; g.fillStyle = '#000'; g.beginPath(); g.ellipse(x - 40 * s * 1.8, gy + this.lean * 0.3, 300 * s * fl, 16 * k * fl, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    if (this.lift < -1000) return;
    g.save(); g.translate(x, y); if (k !== 1) g.scale(k, k);
    Assets.blit(g, im, ART.pv.x, ART.pv.y);
    var lite = this.flashT > 0 ? 0.35 : 0;
    if (lite) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = lite; Assets.blit(g, im, ART.pv.x, ART.pv.y); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    g.restore();
    var Fb = frameBoxes(this), now = performance.now();
    g.save(); g.globalCompositeOperation = 'lighter';
    if (this.weakOpen && Fb.weak) {   // 약점: 주황 · 하얀 빛이 맥박처럼
      var b = wbox(Fb.weak, this), cx = (b.x0 + b.x1) / 2 - camX, cy = gy + this.lift + this.lean - (b.h0 + b.h1) / 2, r = Math.max(14, (b.x1 - b.x0) * 0.7), pu = 0.55 + 0.45 * Math.sin(now / 110);
      var gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, 'rgba(255,250,210,' + (0.55 * pu) + ')'); gr.addColorStop(0.5, 'rgba(255,150,40,' + (0.35 * pu) + ')'); gr.addColorStop(1, 'rgba(255,60,0,0)');
      g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    if (this.pat && this.pat.name === 'breath') {   // 목 · 입 빛(예고 = 점점, 뿜는 중 = 강하게)
      var m = this.mouth(), a = this.pat, kk = a.ph === 'warn' ? a.t / a.wMs : a.ph === 'fire' ? 1 : 0;
      if (kk > 0) { var mr = 26 * k * (0.7 + 0.5 * kk), mx = m.x - camX + 8 * k, my = m.y + this.lift, g2 = g.createRadialGradient(mx, my, 0, mx, my, mr); g2.addColorStop(0, 'rgba(255,240,170,' + 0.7 * kk + ')'); g2.addColorStop(1, 'rgba(255,80,0,0)'); g.fillStyle = g2; g.fillRect(mx - mr, my - mr, mr * 2, mr * 2); }
    }
    if (this.rageOn && this.alive()) {   // 격노: 몸 둘레 붉은 빛(맥박)
      var rx = x - 40 * s, ry = y - 130 * s, rr2 = 210 * s, pu2 = 0.5 + 0.5 * Math.sin(now / 180), g3 = g.createRadialGradient(rx, ry, rr2 * 0.2, rx, ry, rr2);
      g3.addColorStop(0, 'rgba(255,60,20,' + 0.16 * pu2 + ')'); g3.addColorStop(1, 'rgba(255,40,0,0)'); g.fillStyle = g3; g.fillRect(rx - rr2, ry - rr2, rr2 * 2, rr2 * 2);
    }
    g.restore();
    if (debug || Raid.debug) {   // 부위 상자(시험): 머리 노랑 · 발톱 초록 · 몸 파랑 · 약점 빨강(열렸을 때 진하게)
      var C = { head: '#ff0', claw: '#3f6', body: '#39f', weak: this.weakOpen ? '#f33' : 'rgba(255,60,60,0.35)' };
      ['body', 'claw', 'head', 'weak'].forEach(function (n) { if (!Fb[n]) return; var bb = wbox(Fb[n], e); g.strokeStyle = C[n]; g.lineWidth = 1; g.strokeRect(Math.round(bb.x0 - camX) + 0.5, Math.round(gy + e.lift - bb.h1) + 0.5, Math.round(bb.x1 - bb.x0), Math.round(bb.h1 - bb.h0)); });
    }
  };
  // 깊이 순서에 들어가는 것(main.js ents): 불길(그 띠 앞쪽 끝 깊이 = 앞에 선 캐릭터가 불길 위에 보임)
  function addDraw(ents, g, camX) {
    if (boss && boss.queen) { addDrawIce(ents, g, camX); return; }
    var e = boss; if (!e || !e.alive() || !e.pat || e.pat.name !== 'breath' || e.pat.ph !== 'fire') return;
    var band = e.breathBand();
    ents.push({ y: band[1], d: function () { drawBreath(g, camX, e, band); } });
  }
  // 불길: 입 → 싸움터 왼쪽 끝(띠 가운데 바닥)까지 breath_seg 를 이어 붙여 돌려 그림(01/02 번갈아 = 일렁임) + 끝에 breath_tip
  function drawBreath(g, camX, e, band) {
    var a = e.pat, m = e.mouth(), Q = a.Q, s = e.k * (Q.segK || 0.8), cy = (band[0] + band[1]) / 2 + 6;
    var x1 = H.G().camX - 30, dx = x1 - m.x, dy = cy - m.y, len = Math.hypot(dx, dy) * clamp((a.t - 60) / 260, 0, 1), ang = Math.atan2(dy, dx);
    if (len < 4) return;
    var F1 = fxImg('breath_seg_01'), F2 = fxImg('breath_seg_02'), T = fxImg('breath_tip_01');
    if (!F1 || !F1.img) return;
    var seg = (J.fx.breath_seg_01.size[0] - 6) * AS() * s, n = Math.ceil(len / seg), fl = Math.floor(performance.now() / 83) % 2;
    g.save(); g.translate(m.x - camX, m.y); g.rotate(ang - Math.PI);
    for (var i = 0; i < n; i++) {
      var F = (i + fl) % 2 ? F2 : F1; if (!F || !F.img) F = F1;
      g.save(); g.translate(-i * seg, 0); g.scale(s, s * (0.85 + 0.15 * ((i + fl) % 2))); Assets.blit(g, F.img, F.pv.x, F.pv.y); g.restore();
    }
    g.restore();
    if (T && T.img && len > seg) {   // 바닥에 닿는 끝 불꽃(띠 가운데)
      var tx = m.x + Math.cos(ang) * len, ty = m.y + Math.sin(ang) * len + 10;
      drawFx(g, 'breath_tip_01', tx - camX + 120 * AS() * s, ty, (Q.segK || 0.8) * 0.9, 0.9, false);
    }
  }
  // 맨 위(캐릭터 위): 떨어지는 운석 · 터짐 · 먼지 효과
  function drawOver(g, camX) {
    hz.meteors.forEach(function (m) {
      var fall = Math.min(700, m.warn * 0.6), u = (m.t - (m.warn - fall)) / fall;
      if (u <= 0) return;
      var sx = m.x + 170 * (1 - u), sy = m.y - 300 * (1 - u) - 8;
      drawFx(g, 'meteor_01', sx - camX, sy, 0.5, 1, false);
    });
    if (boss && boss.queen) drawOverIce(g, camX);
    hz.puffs.forEach(function (q) { if (!q.gnd && q.n !== 'shock_ring_01' && q.n !== 'lava_pool_01') drawPuff(g, camX, q); });
  }

  // ======================= 빙결의 여왕 (2026-11-08, 얼음 동굴 레이드 · config dungeons.ice.boss · 그림 = assets/raid/ice/queen.json) =======================
  //   화염룡과 같은 틀(Dragon 을 이어받음: 체력 · 부위 · 그로기 · 막대 · 벽). 다른 것만 여기:
  //   1단계 = 눈보라(cast) · 얼음 창 던지기(spear) · 고드름 비(summon) · 지팡이 내려찍기(stomp = 얼음 가시 줄)
  //   체력 rageAt 아래 = 포효(서리 고리 · 밀어냄 · 얼어붙음) → 2단계: + 얼음 벽 · 얼음 정령 2 소환(conjure) · 순간이동(teleport, 눈기둥 동안 무적), 예고 짧아짐
  //   쓰러짐 = death 1~4(얼어붙어 금 감 → 산산이) + 얼음 조각(chunk01~09)이 튐 → 흐려짐 → 보상
  var adds = [];          // 여왕이 부른 것(얼음 정령 · 얼음 벽): 여왕이 쓰러지면 같이 정리
  function liveAdds() { var n = 0; adds.forEach(function (m) { if (m.alive()) n++; }); return n; }
  function iceWallUp() { return adds.some(function (m) { return m.iceWall && m.alive(); }); }
  function ptOf(e, a) { var s = S(); return { x: e.x + (e.fd > 0 ? 1 : -1) * a[0] * s, h: -a[1] * s }; }   // 그림 점(앞 +, 위 -) → 화면 x · 땅에서 높이
  function snow(x, y, gy, n, sp, o) {
    if (!H.Skills.debris) return;
    H.Skills.debris(x, y, gy, n, Object.assign({ cols: ['#ffffff', '#d8f4ff', '#9fdcff', '#bfe8ff'], glow: true, sp: sp || 90, size: 1.5, ms: 800, g: -30 }, o || {}));
  }
  function chillP(p, ms) { if (!p || p.state === 'dead' || !ms) return; if (!p.elChill) p.elChill = { t: ms }; else p.elChill.t = Math.max(p.elChill.t, ms); }   // 얼어붙음(js/elmobs.js 와 같은 상태: 걷기 · 휘두르기 느려짐)

  function Queen(x, y) {
    Dragon.call(this, x, y);
    this.queen = true; this.fr = 'teleport_02'; this.fade = 1; this.home0 = x; this.fd = -1;   // 처음 = 싸움터 오른쪽, 왼쪽을 봄
    this.hitLog = { head: 0, body: 0, base: 0, weak: 0 }; this.dmgLog = { head: 0, body: 0, base: 0, weak: 0 };
  }
  Queen.prototype = Object.create(Dragon.prototype);
  Queen.prototype.constructor = Queen;
  // 맞음: 부위 상자가 있는 그림만(teleport_02 · 03 = 눈기둥 = 무적, death = 상자 없음)
  Queen.prototype.canBeHit = function () {
    var F = J && J.frames[this.fr];
    return this.alive() && this.st !== 'enter' && !(this.lift < -2) && !!(F && (F.body || F.base || F.head));
  };
  Queen.prototype.die = function () {
    Dragon.prototype.die.call(this);
    this.fade = 1; hz.spikes.length = 0; hz.icicles.length = 0; hz.spears.length = 0;
    adds.forEach(function (m) { if (m.alive()) { m.noDrop = true; m.takeHit(9999, -1, 10, true, { force: true }); } });
  };
  Queen.prototype.startGroggy = function () { Dragon.prototype.startGroggy.call(this); this.fade = 1; };
  // 등장: 땅울림 + 눈보라 → 눈기둥이 모여 여왕이 됨(teleport 2 → 3 → 4) → 포효 + 이름 컷인
  Queen.prototype.enterStep = function (dt, p) {
    var t = this.t, R = B.enter, L = lane();
    if (t < R.rumbleMs) {
      this.lift = -9999; this.fr = 'teleport_02';
      if (Math.floor(t / 200) !== Math.floor((t - dt) / 200)) { H.shake(0.4 + t / R.rumbleMs, 200); H.snd('land', { v: 0.5 }); }
      if (Math.random() < dt / 40) snow(H.G().camX + Math.random() * H.LW(), W().bgOff + 30 + Math.random() * 60, L.L0 + Math.random() * L.h, 1, 40, { g: 40, ms: 1200 });
      return;
    }
    t -= R.rumbleMs;
    if (t < R.formMs) {
      this.lift = 0;
      if (!this.formed) { this.formed = true; H.snd('blink', { k: 0.6, v: 1.2 }); H.shake(1.6, 400); snow(this.x - 40 * S(), this.y - 120 * S(), this.y, 26, 160); }
      var u = t / R.formMs; this.fr = u < 0.35 ? 'teleport_02' : u < 0.7 ? 'teleport_03' : 'teleport_04';
      this.fade = Math.min(1, 0.3 + u * 1.2);
      return;
    }
    t -= R.formMs; this.fade = 1;
    if (t < R.roarMs) {
      this.fr = t < 300 ? 'roar_02' : t < R.roarMs - 300 ? 'roar_03' : 'roar_04';
      if (t >= 300 && !this.roared) {
        this.roared = true; this.barOn = true;
        H.snd('bossRoar', { k: 0.85, v: 1 }); H.shake(3, 900); H.flash({ color: '#bfe8ff', alpha: 0.35, ms: 380 });
        var m = ptOf(this, J.frames.roar_03.mouth);
        puff('frostring_01', m.x, this.y - m.h, 700, 0.4, 1.6, 0.95, false);
        H.intro(this);
      }
      return;
    }
    this.st = 'idle'; this.t = 0; this.gapT = 700; this.fr = 'idle_01';
  };
  Queen.prototype.startPat = function (name) {
    var p = P(), Q = B.pats[name], L = lane();
    this.st = 'pat'; this.t = 0; this.last = name; this.fade = 1;
    var a = this.pat = { name: name, Q: Q, ph: 'warn', t: 0, wMs: Q.warnMs * wk(this) };
    if (name === 'blizzard') { a.top = Math.random() < 0.5; a.tick = 0; }   // 위 또는 아래 2/3 를 덮음(무작위)
    if (name === 'spear' || name === 'stomp') a.lineY = clamp(p.y, L.L0, L.L1);
    if (name === 'icicle') icicleRain(this, a, p);
    if (name === 'conjure') {
      var wx = this.x + this.fd * (B.wall * S() + Q.wall.dist);
      a.wallX = wx; a.spots = [];
      for (var i = 0; i < Q.minions; i++) a.spots.push({ x: wx + this.fd * Q.minionDx * (i + 1), y: lerp(L.L0 + 8, L.L1 - 8, Q.minions > 1 ? i / (Q.minions - 1) : 0.5) });
    }
    if (name === 'teleport') { a.wMs = Q.ms[0]; a.to = this.nextSpot(); a.toFd = a.to < H.G().camX + H.LW() / 2 ? 1 : -1; }
    this.log.push(name);
  };
  // 순간이동 자리(2026-11-08 형님: 오른쪽에만 있으면 지루함): 플레이어 반대편 = 싸움터 오른쪽 자리(home0) ↔ 왼쪽 자리(화면 가운데를 기준으로 뒤집은 곳)
  Queen.prototype.nextSpot = function () {
    var right = this.home0, left = 2 * H.G().camX + H.LW() - this.home0;
    return Math.abs(this.homeX - right) < 4 ? left : right;
  };
  function icicleRain(e, a, p) {
    var Q = a.Q, L = lane(), n = e.rageOn ? Q.n2 : Q.n, AR = arena(), x0 = AR.lo, x1 = AR.hi;
    for (var i = 0; i < n; i++) {
      var aim = i < Math.round(n * Q.aimK) && p.state !== 'dead';
      var tx = aim ? p.x + (i === 0 ? 0 : rr([-1.6, 1.6]) * Q.radius) : lerp(x0, x1, (i + Math.random()) / n);
      var ty = aim ? p.y + (i === 0 ? 0 : rr([-1, 1]) * Q.depth) : L.L0 + 4 + Math.random() * (L.h - 8);
      hz.icicles.push({ x: clamp(tx, x0, x1), y: clamp(ty, L.L0, L.L1), t: 0, warn: a.wMs + Q.fallMs + i * Q.everyMs, Q: Q, e: e });
    }
  }
  // 얼음 가시 줄: 지팡이 찍은 곳(x0)에서 줄(y)을 따라 왼쪽으로 gap 도트마다, delayMs 씩 늦게 솟음
  function spikeRow(e, x0, y, Q) {
    var fd = e.fd > 0 ? 1 : -1, row = { hit: false }, xEnd = fd < 0 ? H.G().camX + 8 : H.G().camX + H.LW() - 8, n = Math.max(1, Math.ceil(Math.abs(x0 - xEnd) / Q.gap));   // 여왕이 보는 쪽으로
    for (var i = 0; i < n; i++) hz.spikes.push({ x: x0 + fd * i * Q.gap, y: y + (i % 2 ? 1.5 : -1.5), t: -i * Q.delayMs, row: row, Q: Q, e: e, flip: i % 2 === 1 });
  }
  function spikeLen(Q) { return Q.life[0] + Q.life[1] + Q.life[2] + Q.life[3]; }
  // 얼음 벽 + 정령 부르기(conjure_02)
  function conjure(e, a) {
    var Q = a.Q, p = P(), L = lane(), hpK2 = e.maxHp / B.hp;   // 체력 배율(판 · 난이도 · modes) = 여왕과 같게
    var w = new IceWall(a.wallX, L.L0 - 1, Math.round(Q.wall.hp * hpK2), Q.wall.ms);
    w.fd = e.fd; adds.push(w); H.G().enemies.push(w);
    var front = a.wallX + e.fd * w.halfW;   // 벽이 솟는 자리에 있으면 여왕 반대쪽으로 밀려남
    if (p && p.state !== 'dead') { if (e.fd < 0 && p.x > front - 6) pushP(p.x - (front - 10), 300, -1); else if (e.fd > 0 && p.x < front + 6) pushP(front + 10 - p.x, 300, 1); }
    snow(a.wallX, L.mid - 20, L.mid, 22, 170);
    puff('frostring_01', a.wallX, L.mid, 520, 0.35, 1.1, 0.85, false, true);
    a.spots.forEach(function (q, i) {
      var m = new Minion(q.x, q.y, e);
      m.hp = m.maxHp = Math.max(1, Math.round(B.minion.hp * hpK2)); m.dmgMul = e.dmgMul;
      m.cool = 500 + i * 300;
      adds.push(m); H.G().enemies.push(m);
      snow(q.x, q.y - 20, q.y, 12, 120);
      puff('icicleshatter_01', q.x, q.y, 420, 0.4, 0.7, 0.9, false, true);
    });
    H.snd('earthRise', { k: 1.4, v: 1 }); H.snd('iceHit', { k: 0.7 }); H.shake(2, 360);
  }
  Queen.prototype.patStep = function (dt, p) {
    var a = this.pat, Q = a.Q, Fj = J.frames, L = lane(), u;
    a.t += dt;
    function next(ph) { a.ph = ph; a.t = 0; }
    switch (a.name) {
      case 'blizzard': {   // 눈보라: 손이 빛남(약점) → 팔 듦(폭풍이 모임, 예고 = 덮일 곳 붉게) → 화면 전체 · 걷는 길 위 또는 아래 2/3 에 눈보라(남은 좁은 띠로 피함)
        if (a.ph === 'warn') {
          u = a.t / a.wMs; this.fr = u < 0.42 ? 'cast_01' : u < 0.72 ? 'cast_02' : 'cast_03'; this.weakOpen = u < 0.42;
          if (u > 0.42 && Math.random() < dt / 45) { var c0 = ptOf(this, Fj.cast_04.castAt); snow(this.x - rr([-60, 120]) * S(), this.y - rr([200, 330]) * S(), this.y, 1, 50, { g: 0 }); snow(c0.x, this.y - c0.h, this.y, 1, 30, { g: 0 }); }
          if (a.t >= a.wMs) { next('fire'); a.tick = 0; H.snd('skSpin', { k: 0.55, v: 1.3 }); H.snd('iceSpear', { k: 0.5 }); H.shake(1.4, 320); }
        } else if (a.ph === 'fire') {
          this.fr = 'cast_04'; this.weakOpen = false;
          var band = blizBand(a);
          a.tick -= dt;
          if (a.tick <= 0 && a.t > 80) {
            a.tick = Q.tickMs;
            if (p.state !== 'dead' && p.y >= band[0] && p.y <= band[1] && hitP(this, Q)) chillP(p, Q.chillMs);
          }
          if (Math.floor(a.t / 240) !== Math.floor((a.t - dt) / 240)) H.shake(0.5, 140);
          if (a.t >= Q.fireMs) next('rec');
        } else { this.fr = 'idle_01'; if (a.t >= 380) this.endPat(); }
        break;
      }
      case 'spear': {      // 얼음 창 던지기: 창을 뒤로 당김(예고 = 플레이어 줄 빨간 띠, 마지막 0.22초 고정) → 던짐(가슴 높이로 줄을 따라 날아감)
        if (a.ph === 'warn') {
          this.fr = 'spear_01';
          if (a.t < a.wMs - 220) a.lineY = clamp(p.y, L.L0, L.L1);
          if (a.t >= a.wMs) {
            next('throw');
            var tp = ptOf(this, Fj.spear_02.tip);
            hz.spears.push({ x: tp.x, y: a.lineY, h0: tp.h, h: tp.h, d: 0, Q: Q, e: this });
            H.snd('iceSpear', { k: 0.7, v: 1.3 }); H.snd('swingHeavy', { k: 0.8 });
          }
        } else if (a.ph === 'throw') { this.fr = 'spear_02'; if (a.t >= 420) next('rec'); }
        else { this.fr = 'idle_01'; if (a.t >= 300) this.endPat(); }
        break;
      }
      case 'icicle': {     // 고드름 비: 지팡이 듦(바닥 빨간 원) → 내리침 → 원마다 고드름이 떨어져 깨짐(점프로 못 피함, 원 밖으로)
        if (a.ph === 'warn') { this.fr = 'summon_01'; if (a.t >= a.wMs) { next('drop'); H.snd('swingHeavy', { k: 0.7 }); } }
        else if (a.ph === 'drop') { this.fr = 'summon_02'; if (a.t >= 500 && !hz.icicles.length) next('rec'); else if (a.t >= 2600) next('rec'); }
        else { this.fr = 'idle_01'; if (a.t >= 300) this.endPat(); }
        break;
      }
      case 'stomp': {      // 지팡이 내려찍기: 지팡이 머리 위(예고 = 줄을 따라 빨간 자국) → 쾅 → 얼음 가시 줄이 앞으로(점프 · 회피 · 줄 바꾸기로 피함)
        if (a.ph === 'warn') {
          this.fr = 'stomp_01';
          if (a.t < a.wMs - 220) a.lineY = clamp(p.y, L.L0, L.L1);
          if (a.t >= a.wMs) next('slam');
        } else if (a.ph === 'slam') {
          this.fr = 'stomp_02';
          if (!a.fired) {
            a.fired = true;
            var ip = ptOf(this, Fj.stomp_02.impactAt);
            spikeRow(this, ip.x, a.lineY, Q);
            puff('frostring_01', ip.x, this.y, 520, 0.3, 1.0, 0.9, false, true);
            snow(ip.x, this.y - 6, this.y, 14, 200, { g: 200, ms: 600 });
            H.shake(3, 460); H.snd('skSlam', { k: 0.75, v: 1.2 }); H.snd('iceHit', { k: 0.6, v: 1.1 });
            H.G().hitstop = Math.max(H.G().hitstop, 70);
          }
          if (a.t >= 140) next('hold');
        } else if (a.ph === 'hold') { this.fr = 'stomp_03'; if (a.t >= Q.holdMs) next('rec'); }
        else { this.fr = 'stomp_04'; if (a.t >= 320) this.endPat(); }
        break;
      }
      case 'conjure': {    // (2단계) 얼음 벽 + 얼음 정령: 손을 앞으로(예고 = 생길 자리 빨간 원) → 지팡이 휘두름 → 벽 · 정령
        if (a.ph === 'warn') { this.fr = 'conjure_01'; if (a.t >= a.wMs) next('cast'); }
        else if (a.ph === 'cast') { this.fr = 'conjure_02'; if (!a.fired) { a.fired = true; conjure(this, a); } if (a.t >= 650) next('rec'); }
        else { this.fr = 'idle_01'; if (a.t >= 300) this.endPat(); }
        break;
      }
      case 'teleport': {   // (2단계) 순간이동: 눈으로 부서짐 → 눈기둥(무적, 사라짐) + 도착할 곳 눈 소용돌이 예고 → 플레이어 반대편에서 다시 모임(무적, 방향 뒤집음) → 나타남 → 바로 내려찍기 · 눈보라
        var TM = Q.ms;
        if (a.ph === 'warn') {
          this.fr = 'teleport_01';
          if (!a.s0) { a.s0 = true; H.snd('blink', { k: 0.8, v: 1.1 }); }
          if (a.t >= TM[0]) {
            next('hide'); snow(this.x - 30 * S(), this.y - 120 * S(), this.y, 24, 150);
            var nw = a.to + a.toFd * B.wall * S();   // 새 자리 앞까지 밀려남(몸에 안 끼게)
            if (p.state !== 'dead') { if (a.toFd < 0 && p.x > nw - 6) pushP(p.x - (nw - 10), TM[1], -1); else if (a.toFd > 0 && p.x < nw + 6) pushP(nw + 10 - p.x, TM[1], 1); }
          }
        } else if (a.ph === 'hide') {
          this.fr = 'teleport_02'; this.fade = 1 - clamp(a.t / TM[1], 0, 1);
          if (Math.random() < dt / 30) snow(a.to + rr([-40, 40]) * S(), this.y - rr([0, 160]) * S(), this.y, 1, 70, { g: -40 });   // 도착할 곳에 눈이 모임
          if (a.t >= TM[1]) { next('form'); this.homeX = this.x = a.to; this.fd = this.dir = a.toFd; this.fade = 0.15; H.snd('blink', { k: 1.1 }); snow(this.x, this.y - 120 * S(), this.y, 24, 150); }
        } else if (a.ph === 'form') { this.fr = 'teleport_03'; this.fade = 0.15 + 0.85 * clamp(a.t / TM[2], 0, 1); if (a.t >= TM[2]) next('back'); }
        else {
          this.fade = 1; this.fr = 'teleport_04';
          if (a.t >= TM[3]) {   // 바로 이어서 내려찍기 또는 눈보라(예고 followMs 더 = 공평하게)
            this.endPat(); var f2 = Math.random() < 0.5 ? 'stomp' : 'blizzard';
            this.startPat(f2); this.pat.wMs += Q.followMs;
          }
        }
        break;
      }
    }
  };
  // 포효(2단계 시작): 입에서 서리 고리 → 둘레 플레이어 밀어냄 + 얼어붙음 → 격노(예고 짧게 · 쉬는 시간 짧게) → 바로 얼음 벽 · 정령
  Queen.prototype.roarStep = function (dt, p) {
    var R = B.roar, t = this.t;
    if (t < R.warnMs) { this.fr = t < R.warnMs * 0.5 ? 'roar_01' : 'roar_02'; return; }
    t -= R.warnMs;
    if (!this.roared) {
      this.roared = true;
      H.snd('bossRoar', { k: 0.8, v: 1 }); H.shake(3.6, 1000); H.flash({ color: B.rage.color, alpha: 0.45, ms: 420 });
      var m = ptOf(this, J.frames.roar_03.mouth), L = lane();
      puff('frostring_01', m.x, this.y - m.h, 800, 0.4, 1.6, 1, false);
      puff('frostring_01', m.x, L.mid, 800, 0.5, 2.4, 0.9, false, true);
      snow(m.x, this.y - m.h, this.y, 30, 260, { g: 60 });
      if (p.state !== 'dead' && Math.abs(p.x - m.x) < R.r) { pushP(R.push, 380, this.fd); chillP(p, R.chillMs); }
      this.rageOn = true; H.banner(H.josa(B.name, '이', '가') + ' 분노했다!', 'boss');
    }
    if (t < 900) { this.fr = 'roar_03'; return; }
    if (t < 1400) { this.fr = 'roar_04'; return; }
    this.st = 'idle'; this.t = 0; this.gapT = 400;
    this.startPat('conjure');
  };
  // 그로기: 움찔 → 무릎 → 바닥에 쓰러짐(down_01, 머리 = 약점, 서서 칠 수 있는 높이) → 일어남
  Queen.prototype.groggyStep = function (dt) {
    var t = this.t, G2 = B.groggy;
    this.weakOpen = t > 340 && t < 340 + G2.ms;
    if (t < 140) this.fr = 'hurt_01';
    else if (t < 340) this.fr = 'groggy_01';
    else if (t < 340 + G2.ms) { this.fr = 'down_01'; if (Math.random() < dt / 260) snow(this.x - 200 * S(), this.y - 40 * S(), this.y, 1, 30, { g: -50 }); }
    else if (t < 340 + G2.ms + 320) this.fr = 'groggy_01';
    else { this.gauge = 0; this.st = 'idle'; this.t = 0; this.gapT = 600; this.weakOpen = false; }
    if (this.st === 'groggy') this.gauge = G2.max * (1 - clamp((t - 340) / G2.ms, 0, 1));
  };
  // 쓰러짐: death 1(치명타) → 2(얼어붙음) → 3(금 간 얼음 조각상, 하얀 번쩍) → 4(산산이 + 얼음 조각) → 흐려짐 → 보상
  Queen.prototype.deadStep = function (dt) {
    this.deadT += dt; this.lift = 0;
    this.fr = frameOf('death', this.deadT, false);
    var A = J.anims.death, f = 1000 / A.fps, animMs = A.playback.length * f, t3 = A.playback.indexOf(3) * f, t4 = A.playback.indexOf(4) * f;
    if (!this.froze && this.deadT >= t3) { this.froze = true; H.flash({ color: '#eaf8ff', alpha: 0.55, ms: 320 }); H.snd('iceHit', { k: 0.5, v: 1.3 }); H.shake(1.6, 300); }
    if (!this.chunked && this.deadT >= t4) {
      this.chunked = true; chunks(this.x + this.fd * 40 * S(), this.y, 200 * S(), 2, 1);
      H.shake(3.8, 700); H.snd('meteorBoom', { k: 0.9 }); H.snd('iceHit', { k: 0.7, v: 1.4 }); H.G().hitstop = Math.max(H.G().hitstop, 120);
      snow(this.x - 40 * S(), this.y - 120 * S(), this.y, 30, 240, { g: 120 });
    }
    this.fade = clamp(1 - (this.deadT - t4 - 350) / 900, 0, 1);
    if (this.deadT < t4 && Math.random() < dt / 120) snow(this.x - rr([-60, 160]) * S(), this.y - rr([20, 300]) * S(), this.y, 1, 40, { g: -30 });
    if (!this.burst && this.deadT >= animMs + 300) { this.burst = true; H.loot(this, this.x + this.fd * 120 * S(), this.y); }
  };
  // 얼음 조각(chunk01~09): (x, 땅 y) 둘레 높이 0~hMax 에서 튀어 나감 → 땅에 튕기며 멈춤 → 흐려짐. copies = 같은 조각 몇 번, ks = 크기 배율
  function chunks(x, y, hMax, copies, ks, only) {
    var names = only || ['chunk01_01', 'chunk02_01', 'chunk03_01', 'chunk04_01', 'chunk05_01', 'chunk06_01', 'chunk07_01', 'chunk08_01', 'chunk09_01'], L = lane();
    for (var c = 0; c < copies; c++) names.forEach(function (n) {
      hz.chunks.push({ n: n, x: x + rr([-0.5, 0.5]) * hMax, y: clamp(y + rr([-14, 14]), L.L0, L.L1 + 4), h: rr([0.15, 1]) * hMax, vx: rr([-190, 110]), vh: rr([60, 240]),
        rot: Math.random() * 6.28, vr: rr([-9, 9]), t: 0, ms: rr([1400, 2000]), k: ks * rr([0.8, 1.1]) * (c ? 0.75 : 1), flip: Math.random() < 0.5 });
    });
    while (hz.chunks.length > 60) hz.chunks.shift();
  }

  // ---------- 얼음 정령(졸개): 보통 적처럼(Enemy) 플레이어를 쫓아가 할큄. 체력 낮음 · 경험치 = 단단한 잡몹. 쓰러지면 얼음 조각 ----------
  function registerMinion(E) {
    var M = B.minion, s = AS(), mp = ART.mn.walk_01.pv;
    if (E.icespirit) return;
    E.icespirit = { label: M.name, hp: M.hp, frameW: 157, frameH: 106, pivot: { x: mp.x, y: mp.y }, radius: 26 * s, height: 98 * s,
      anims: { idle: { fps: 4, loop: true }, walk: { fps: 6, loop: true }, attack: { fps: 10, loop: false, playback: [1, 1, 1, 1, 1, 2, 2, 2, 2] },
               hit: { fps: 10, loop: false, playback: [1, 1, 1] }, knockdown: { fps: 10, loop: false, playback: [1, 1, 1, 1, 1, 1] },
               getup: { fps: 8, loop: false, playback: [1, 1, 1] }, death: { fps: 6, loop: false, playback: [1, 1, 1, 1] } },
      walkAnim: 'walk', down: { slide: 60 * s, lyingFrames: [1] },
      speedX: M.speedX, speedY: M.speedY, hurtbox: { x0: -36 * s, x1: 40 * s, yTop: -96 * s, yBot: 0 },
      engage: 40 * s, hover: [100 * s, 160 * s], range: [16 * s, 66 * s], alignY: 12 * s, cooldown: M.cooldown, firstCooldown: [300, 800],
      knockResist: 1.1, deathKnock: 150,
      attacks: { claw: { anim: 'attack', active: [2], telegraph: [1], reach: { x0: 10 * s, x1: 74 * s, yTop: -84 * s, yBot: -14 * s }, depth: 12 * s, dmg: M.dmg, knock: 12, flinchMs: 260 } } };
  }
  function Minion(x, y, q) {
    var F = ART.mn;
    Enemy.call(this, 'icespirit', CFGv(), { idle: [F.walk_01.img], walk: [F.walk_01.img, F.walk_02.img], attack: [F.walk_01.img, F.attack_01.img],
      hit: [F.walk_01.img], knockdown: [F.death_01.img], getup: [F.walk_01.img], death: [F.death_01.img] }, x, y);
    this.entered = true; this.dir = -1; this.state = 'idle'; this.queenAdd = true; this.noDrop = true;
  }
  Minion.prototype = Object.create(Enemy.prototype);
  Minion.prototype.constructor = Minion;
  Minion.prototype.update = function (dt, ctx) {
    Enemy.prototype.update.call(this, dt, ctx);
    if (this.state === 'dead' && !this.shattered) {
      this.shattered = true;
      chunks(this.x, this.y, 50 * AS(), 2, 0.8, ['chunk07_01', 'chunk08_01', 'chunk09_01']);
      snow(this.x, this.y - 30 * AS(), this.y, 10, 120);
      H.snd('iceHit', { k: 1.2, v: 0.8 });
    }
  };

  // ---------- 얼음 벽: 여왕 앞에 솟아 길을 막음(플레이어 · 마법이 막힘) · 때려서 부술 수 있음 · ms 뒤 저절로 깨짐 ----------
  function registerWall(E) {
    if (E.icewall) return;
    E.icewall = { label: '얼음 벽', hp: 100, radius: 40, height: 70, pivot: { x: 0, y: 0 }, hurtbox: { x0: -30, x1: 30, yTop: -70, yBot: 0 }, hover: [0, 0], range: [0, 0],
      engage: 0, cooldown: [1000, 1000], speedX: 0, speedY: 0, anims: {}, attacks: {}, noLaunch: true, superArmor: true };
  }
  function IceWall(x, y, hp, ms) {
    Enemy.call(this, 'icewall', CFGv(), { idle: [null] }, x, y);
    this.hp = this.maxHp = hp; this.ms = ms; this.t = 0; this.iceWall = true; this.raid = true;
    this.entered = true; this.state = 'idle'; this.noDrop = true; this.xpDone = true;   // 경험치 · 처치 수 없음
    this.halfW = 30 * AS() / 0.55;
  }
  IceWall.prototype = Object.create(Enemy.prototype);
  IceWall.prototype.constructor = IceWall;
  IceWall.prototype.up = function () { return this.alive() && this.t >= 260; };   // 다 솟았나(그 뒤부터 길을 막음)
  IceWall.prototype.canLaunch = function () { return false; };
  IceWall.prototype.airborne = function () { return false; };
  IceWall.prototype.faded = function () { return true; };
  IceWall.prototype.tryGuard = function () { return false; };
  IceWall.prototype.keepInView = function () {};
  IceWall.prototype.flyZ = function () { return 0; };
  IceWall.prototype.canBeHit = function () { return this.up(); };
  IceWall.prototype.canBeHitBy = function () { return this.up(); };
  IceWall.prototype.currentImg = function () { var F = fxImg('icewall_01'); return F && F.img; };
  IceWall.prototype.hurtbox = function () { var p = P(), y = p ? p.y : this.y; return { x0: this.x - this.halfW, x1: this.x + this.halfW, y0: y - 70 * AS() / 0.55, y1: y, z: y }; };
  IceWall.prototype.takeHit = function (dmg, dir, knock, fin, opts) {
    if (!this.alive() || (!(opts && opts.force) && !this.up())) return null;
    this.hp = Math.max(0, this.hp - dmg); this.flashT = 90;
    if (this.hp <= 0) { this.shatter(); return 'dead'; }
    if (Math.random() < 0.5) snow(this.x - this.halfW, lane().mid - 20, lane().mid, 3, 90);
    return 'armor';
  };
  IceWall.prototype.shatter = function () {
    var L = lane();
    this.state = 'dead'; this.deadT = 0; this.remove = true;
    chunks(this.x, L.mid, 50 * AS(), 2, 0.9, ['chunk03_01', 'chunk04_01', 'chunk05_01', 'chunk06_01', 'chunk07_01', 'chunk08_01']);
    snow(this.x, L.mid - 20, L.mid, 20, 180);
    H.snd('iceHit', { k: 0.8, v: 1.2 }); H.shake(1.6, 300);
  };
  IceWall.prototype.update = function (dt) {
    this.t += dt; this.clock += dt;
    if (this.flashT > 0) this.flashT -= dt;
    if (this.alive() && this.t >= this.ms) this.shatter();
  };
  IceWall.prototype.drawTelegraph = function () {};
  IceWall.prototype.draw = function (g, camX, debug) {
    var L = lane(), u = ease(this.t / 260), cr = 1 - this.hp / this.maxHp, rows = [L.L0 + 4, L.mid + 2, L.L1], self = this;
    rows.forEach(function (yy, i) {
      var x = self.x - camX + (i - 1) * 5;
      g.save(); g.globalAlpha = 0.3; g.fillStyle = '#000'; g.beginPath(); g.ellipse(x, yy, self.halfW * 1.05, 5, 0, 0, Math.PI * 2); g.fill(); g.restore();
      drawFx(g, 'icewall_01', x, yy, 0.6, 0.95, i === 1, 0, u * (1 - cr * 0.12));
      if (self.flashT > 0) { g.save(); g.globalCompositeOperation = 'lighter'; drawFx(g, 'icewall_01', x, yy, 0.6, 0.35, i === 1, 0, u); g.restore(); }
    });
    if (this.ms - this.t < 800 && Math.floor(this.t / 90) % 2) { g.save(); g.globalCompositeOperation = 'lighter'; rows.forEach(function (yy, i) { drawFx(g, 'icewall_01', self.x - camX + (i - 1) * 5, yy, 0.6, 0.25, i === 1, 0, u); }); g.restore(); }   // 곧 깨짐: 깜빡
    if (debug || Raid.debug) { var hb = this.hurtbox(); g.strokeStyle = '#3cf'; g.strokeRect(Math.round(hb.x0 - camX) + 0.5, Math.round(L.L0) + 0.5, Math.round(hb.x1 - hb.x0), Math.round(L.h)); }
  };

  // ---------- 여왕 위험물 갱신(stepHz 가 부름): 얼음 가시 · 창 · 고드름 · 얼음 조각 ----------
  function stepIce(dt, p) {
    var i, L = lane(), s1 = dt / 1000;
    for (i = hz.spikes.length - 1; i >= 0; i--) {
      var k = hz.spikes[i], Q = k.Q, lf = Q.life; k.t += dt;
      if (k.t >= spikeLen(Q)) { hz.spikes.splice(i, 1); continue; }
      if (k.t >= lf[0] && !k.pop) { k.pop = true; if (i % 3 === 0) { snow(k.x, k.y - 4, k.y, 3, 110, { g: 260, ms: 420 }); H.snd('iceHit', { k: 1.3, v: 0.35 }); } if (i % 4 === 0) H.shake(0.6, 100); }
      var act = k.t >= lf[0] && k.t < lf[0] + lf[1] + lf[2];
      if (act && !k.row.hit && p && p.state !== 'dead' && Math.abs(p.x - k.x) <= Q.hitW && Math.abs(p.y - k.y) <= Q.depth && (p.z || 0) <= Q.dodgeZ) k.row.hit = hitP(k.e, Q) || k.row.hit;
    }
    for (i = hz.spears.length - 1; i >= 0; i--) {
      var q = hz.spears[i], SQ = q.Q, mv = SQ.speed * s1;
      q.d += mv; q.x -= mv; q.h = Math.max(SQ.flyH, q.h0 - q.d * (q.h0 - SQ.flyH) / SQ.dropD);
      if (p && p.state !== 'dead' && Math.abs(p.x - q.x) <= 9 + mv && Math.abs(p.y - q.y) <= SQ.depth && q.h >= (p.z || 0) - 4 && q.h <= (p.z || 0) + 54 * AS() / 0.55) {
        if (hitP(q.e, SQ)) { puff('spark_01', p.x + 4, q.y - q.h, 300, 0.6, 1.2, 1, false); snow(p.x, q.y - q.h, q.y, 8, 140); H.snd('iceHit', { v: 1 }); hz.spears.splice(i, 1); continue; }
      }
      if (q.x < H.G().camX - 80) hz.spears.splice(i, 1);
    }
    for (i = hz.icicles.length - 1; i >= 0; i--) {
      var c = hz.icicles[i]; c.t += dt;
      if (c.t < c.warn) continue;
      hz.icicles.splice(i, 1);
      puff('icicleshatter_01', c.x, c.y, 460, 0.55, 0.75, 1, Math.random() < 0.5, true);
      snow(c.x, c.y - 6, c.y, 8, 150, { g: 260, ms: 500 });
      H.shake(1.1, 200); H.snd('iceHit', { k: 1.1, v: 0.7 });
      if (p && p.state !== 'dead' && Math.abs(p.x - c.x) <= c.Q.radius && Math.abs(p.y - c.y) <= c.Q.depth && (p.z || 0) <= c.Q.dodgeZ) hitP(c.e, c.Q);
    }
    for (i = hz.chunks.length - 1; i >= 0; i--) {
      var o = hz.chunks[i]; o.t += dt;
      if (o.t >= o.ms) { hz.chunks.splice(i, 1); continue; }
      o.vh -= 620 * s1; o.h += o.vh * s1; o.x += o.vx * s1; o.rot += o.vr * s1;
      if (o.h <= 0) { o.h = 0; o.vh = Math.abs(o.vh) > 60 ? -o.vh * 0.32 : 0; o.vx *= 0.55; o.vr *= 0.5; }
    }
  }

  // ---------- 여왕 그림 ----------
  Queen.prototype.draw = function (g, camX, debug) {
    var im = this.currentImg(), e = this;
    if (!im || this.lift < -1000 || this.fade <= 0.01) return;
    var x = snapv(this.x - camX), gy = this.y, k = this.k, s = S(), bob = this.st === 'idle' ? Math.round(Math.sin(this.clock / 520) * 1.2) : 0, now = performance.now();
    g.save(); g.globalAlpha = 0.34 * this.fade; g.fillStyle = '#000'; g.beginPath(); g.ellipse(x, gy, 175 * s, 13 * k, 0, 0, Math.PI * 2); g.fill(); g.restore();
    if (this.rageOn && this.alive()) {   // 격노: 몸 둘레 차가운 빛(맥박)
      var rx = x, ry = gy - 150 * s, rr2 = 230 * s, pu2 = 0.5 + 0.5 * Math.sin(now / 200), g3 = g.createRadialGradient(rx, ry, rr2 * 0.2, rx, ry, rr2);
      g3.addColorStop(0, 'rgba(120,210,255,' + 0.18 * pu2 + ')'); g3.addColorStop(1, 'rgba(60,140,255,0)');
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = g3; g.fillRect(rx - rr2, ry - rr2, rr2 * 2, rr2 * 2); g.restore();
    }
    g.save(); g.globalAlpha = this.fade; g.translate(x, gy + bob); g.scale(this.fd > 0 ? -k : k, k);   // fd +1 = 뒤집음(오른쪽을 봄)
    Assets.blit(g, im, ART.pv.x, ART.pv.y);
    if (this.flashT > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35 * this.fade; Assets.blit(g, im, ART.pv.x, ART.pv.y); }
    g.restore();
    var Fb = frameBoxes(this), a = this.pat;
    g.save(); g.globalCompositeOperation = 'lighter';
    if (this.weakOpen && Fb.weak) {   // 약점: 하얀 · 하늘 빛 맥박
      var b = wbox(Fb.weak, this), cx = (b.x0 + b.x1) / 2 - camX, cy = gy - (b.h0 + b.h1) / 2, r = Math.max(14, (b.x1 - b.x0) * 0.7), pu = 0.55 + 0.45 * Math.sin(now / 110);
      var gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, 'rgba(255,255,255,' + (0.6 * pu) + ')'); gr.addColorStop(0.5, 'rgba(120,220,255,' + (0.4 * pu) + ')'); gr.addColorStop(1, 'rgba(40,120,255,0)');
      g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    if (a && this.st === 'pat' && (a.name === 'blizzard' || a.name === 'icicle' || a.name === 'conjure') && a.ph === 'warn') {   // 지팡이 수정 빛(모이는 중)
      var kk = clamp(a.t / a.wMs, 0, 1), cp = ptOf(this, (Fj0(this.fr).castAt) || J.frames.summon_01.castAt), mr = (10 + 18 * kk) * k, mx = cp.x - camX, my = gy - cp.h, g2 = g.createRadialGradient(mx, my, 0, mx, my, mr);
      g2.addColorStop(0, 'rgba(255,255,255,' + 0.75 * kk + ')'); g2.addColorStop(1, 'rgba(90,190,255,0)'); g.fillStyle = g2; g.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    }
    g.restore();
    if (debug || Raid.debug) {
      var C = { head: '#ff0', body: '#39f', base: '#3f6', weak: this.weakOpen ? '#f33' : 'rgba(255,60,60,0.35)' };
      ['base', 'body', 'head', 'weak'].forEach(function (n) { if (!Fb[n]) return; var bb = wbox(Fb[n], e); g.strokeStyle = C[n]; g.lineWidth = 1; g.strokeRect(Math.round(bb.x0 - camX) + 0.5, Math.round(gy - bb.h1) + 0.5, Math.round(bb.x1 - bb.x0), Math.round(bb.h1 - bb.h0)); });
    }
  };
  function Fj0(n) { return (J && J.frames[n]) || {}; }
  // 바닥 위(캐릭터 전에): 공격 예고 · 고드름 자리 · 바닥 고리
  Queen.prototype.drawTelegraph = function (g, camX) {
    var e = this, a = e.pat, L = lane(), Fj = J.frames, i;
    if (a && e.st === 'pat' && a.ph === 'warn') {
      var wu = a.t / a.wMs;
      if (a.name === 'blizzard') blizWarn(g, camX, a, wu);
      if (a.name === 'spear') { var tp = ptOf(e, Fj.spear_02.tip); warnRect(g, camX, H.G().camX - 4, tp.x, a.lineY - a.Q.depth, a.lineY + a.Q.depth, wu); }
      if (a.name === 'stomp') {   // 가시가 솟을 줄: 빨간 띠 + 가시 자리마다 빨간 자국(점점 진하게)
        var ip = ptOf(e, Fj.stomp_02.impactAt), Q = a.Q, sfd = e.fd > 0 ? 1 : -1, xe = sfd < 0 ? H.G().camX - 4 : H.G().camX + H.LW() + 4, n = Math.ceil((Math.abs(ip.x - xe) - 12) / Q.gap);
        warnRect(g, camX, Math.min(xe, ip.x - sfd * 8), Math.max(xe, ip.x - sfd * 8), a.lineY - Q.depth, a.lineY + Q.depth, wu * 0.6);
        for (i = 0; i < n; i++) { var sx = ip.x + sfd * i * Q.gap; Enemy.drawRing(g, camX, sx, a.lineY, Q.hitW, 3.5, wu, i * 0.06 > wu); }
      }
      if (a.name === 'conjure') { Enemy.drawRing(g, camX, a.wallX, L.mid, 30, L.h * 0.5, wu, false); a.spots.forEach(function (q) { Enemy.drawRing(g, camX, q.x, q.y, 16, 7, wu, false); }); }
    }
    if (a && e.st === 'pat' && a.name === 'blizzard' && a.ph === 'fire') blizWarn(g, camX, a, 0.15);
    if (a && e.st === 'pat' && a.name === 'teleport' && (a.ph === 'warn' || a.ph === 'hide')) tpMark(g, camX, a.to, e.y, a.ph === 'hide' ? 0.4 + 0.6 * a.t / a.Q.ms[1] : 0.3 * a.t / a.Q.ms[0]);
    for (i = 0; i < hz.icicles.length; i++) { var c = hz.icicles[i]; Enemy.drawRing(g, camX, c.x, c.y, c.Q.radius, c.Q.depth, c.t / c.warn, false); }
    hz.puffs.forEach(function (q) { if (q.gnd) drawPuff(g, camX, q); });
  };
  // 깊이 순서(캐릭터와): 눈보라 띠(그 띠 앞쪽 끝 깊이) · 얼음 가시(가시마다)
  function addDrawIce(ents, g, camX) {
    var e = boss;
    hz.spikes.forEach(function (k) { if (k.t > 0) ents.push({ y: k.y, d: function () { drawSpike(g, camX, k); } }); });
  }
  function drawSpike(g, camX, k) {
    var lf = k.Q.life, t = k.t, n, al = 1;
    if (t < lf[0]) { n = 'spikes_01'; al = 0.5 + 0.5 * t / lf[0]; }
    else if (t < lf[0] + lf[1]) n = 'spikes_02';
    else if (t < lf[0] + lf[1] + lf[2]) n = 'spikes_03';
    else { var u = (t - lf[0] - lf[1] - lf[2]) / lf[3]; n = u < 0.5 ? 'spikes_02' : 'spikes_01'; al = u < 0.5 ? 1 : 1 - (u - 0.5) * 2; }
    drawFx(g, n, k.x - camX, k.y + 2, k.Q.k, al, k.flip);
  }
  // 눈보라(2026-11-08 형님 3 · 4차): 눈 그림 = 화면 전체(가로 · 세로 다, 캐릭터 위). 위험한 곳 = 바닥 빨간 예고로만 보여 줌:
  //   걷는 길 거의 전부가 위험, 위 또는 아래 끝(매번 무작위)에 좁은 띠(safe 도트 ≈ 한 줄)만 안전. 그 띠 밖이면 어디서나 맞음
  //   그림 = 코드로 그린 진짜 눈보라: 크기 다른 눈송이(1~3 도트, 작은 뭉치) · 사선으로 흩날리며 출렁임 · 옅은 바람결 곡선 · 흔들리는 흰 안개(가장자리 부드럽게)
  //   a.top = 위험이 위쪽부터(안전 띠 = 맨 아래), 아니면 안전 띠 = 맨 위
  function blizBand(a) {
    var L = lane(), sf = a.Q.safe;
    return a.top ? [L.L0 - 6, L.L1 - sf] : [L.L0 + sf, L.L1 + 6];
  }
  function smooth01(u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }
  // 그 높이(y)의 눈보라 진하기: 화면 전체, 아래(바닥 쪽)로 갈수록 조금 더 진함(y0 ~ y1 = 화면 위 ~ 아래)
  function blizDens(y, y0, y1) { return 0.6 + 0.4 * smooth01((y - y0) / (y1 - y0)); }
  function drawBlizzard(g, camX, e, k) {
    var a = e.pat, Q = a.Q, now = performance.now(), t = now / 1000, LW = H.LW(), x0 = H.G().camX - 20, Wd = LW + 40;
    if (k <= 0.01) return;
    var y0 = -8, y1 = W().bgOff + 252, b = [y0, y1], i;   // 화면 전체
    g.save();
    if (e.fd > 0) { g.translate(LW, 0); g.scale(-1, 1); }   // 여왕이 왼쪽 = 바람이 오른쪽으로(화면을 좌우로 뒤집어 그림)
    // 1) 흰 안개: 세로 = 진하기 따라(위아래 부드럽게), 가로 = 6 도트 줄마다 진하기가 천천히 출렁(노이즈처럼)
    var gr = g.createLinearGradient(0, y0, 0, y1), n = 8;
    for (i = 0; i <= n; i++) { var yy = lerp(y0, y1, i / n); gr.addColorStop(i / n, 'rgba(232,246,255,' + (Q.haze * blizDens(yy, y0, y1)).toFixed(3) + ')'); }
    g.fillStyle = gr;
    for (var sx = 0; sx < Wd; sx += 6) {
      var wx = x0 + sx, nz = 0.62 + 0.22 * Math.sin(wx * 0.045 + t * 2.1) + 0.16 * Math.sin(wx * 0.017 - t * 1.3 + 1.7);
      g.globalAlpha = k * nz; g.fillRect(Math.floor(wx - camX), y0, 6, y1 - y0);
    }
    // 2) 안개 뭉치: 바람 따라 빠르게 흘러가는 둥근 흰 덩어리(가장자리 흐림)
    for (i = 0; i < Q.puffs; i++) {
      var h1 = (i * 0.618034) % 1, h2 = (i * 0.414214 + 0.3) % 1, sp = Q.wind * (0.55 + 0.5 * h2);
      var px = x0 + Wd - ((h1 * Wd + t * sp) % Wd), py = lerp(b[0] + 4, b[1] - 4, h2) + Math.sin(t * 1.7 + i) * 5, r = 16 + 18 * h1;
      var dn = blizDens(py, y0, y1);
      var rg = g.createRadialGradient(px - camX, py, 0, px - camX, py, r);
      rg.addColorStop(0, 'rgba(255,255,255,' + (0.3 * dn) + ')'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.globalAlpha = k; g.fillStyle = rg; g.fillRect(px - camX - r, py - r * 0.6, r * 2, r * 1.2);
    }
    // 3) 바람결: 옅은 반투명 곡선(빠르게 왼쪽으로, 출렁)
    g.lineWidth = 1;
    for (i = 0; i < Q.wisps; i++) {
      var w1 = (i * 0.754877) % 1, w2 = (i * 0.569840 + 0.1) % 1, ws = Q.wind * (1.4 + w2);
      var qx = x0 + Wd - ((w1 * Wd + t * ws) % Wd) - camX, qy = lerp(b[0], b[1], w2) + Math.sin(t * 2.3 + i * 1.9) * 4, ln = 26 + 30 * w1, bend = Math.sin(t * 3 + i) * 5;
      var dw = blizDens(qy, y0, y1);
      g.globalAlpha = k * dw * (0.28 + 0.22 * w2); g.strokeStyle = '#ffffff';
      g.beginPath(); g.moveTo(qx, qy); g.quadraticCurveTo(qx + ln * 0.5, qy - 4 + bend, qx + ln, qy - 7); g.stroke();
    }
    // 4) 눈송이: 크기 1~3(3 = 가운데 진하고 둘레 옅은 부드러운 점), 가끔 작은 뭉치. 사선으로 흩날리며 출렁(속도 · 흔들림 제각각)
    for (i = 0; i < Q.flakes; i++) {
      var f1 = (i * 0.618034) % 1, f2 = (i * 0.414214) % 1, f3 = (i * 0.732051) % 1;
      var fy0 = y0, fh = y1 - y0, spd = Q.wind * (0.45 + 0.9 * f3);
      var fx = x0 + Wd - ((f1 * Wd + t * spd) % Wd), fy = fy0 + ((f2 * fh + t * spd * 0.42) % fh) + Math.sin(t * (1.4 + f3 * 2.6) + i) * (2 + 4 * f2);
      var df = blizDens(fy, y0, y1);
      var X = Math.round(fx - camX), Y = Math.round(fy), al = k * df * (0.62 + 0.38 * f2);
      g.fillStyle = f1 > 0.3 ? '#ffffff' : '#dff3ff';
      if (f3 < 0.55) { g.globalAlpha = al; g.fillRect(X, Y, 1, 1); }
      else if (f3 < 0.86) { g.globalAlpha = al; g.fillRect(X, Y, 2, 2); }
      else { g.globalAlpha = al; g.fillRect(X, Y, 2, 2); g.globalAlpha = al * 0.45; g.fillRect(X - 1, Y, 1, 2); g.fillRect(X + 2, Y, 1, 2); g.fillRect(X, Y - 1, 2, 1); g.fillRect(X, Y + 2, 2, 1); }
      if (i % 13 === 0) { g.globalAlpha = al * 0.8; g.fillRect(X + 3, Y + 1, 1, 1); g.fillRect(X + 1, Y + 3, 1, 1); }   // 작은 뭉치
    }
    g.restore();
  }
  // 순간이동 도착 예고: 바닥에 빛나는 눈 소용돌이(돌아가는 고리 · 눈송이) — 곧 여왕이 여기 나타남(몸에 안 끼게 비켜서기)
  function tpMark(g, camX, x, y, k) {
    var now = performance.now() / 1000, s = S(), rx = 120 * s, ry = 16 * s, cx = x - camX;
    g.save(); g.globalCompositeOperation = 'lighter';
    var gr = g.createRadialGradient(cx, y, 0, cx, y, rx); gr.addColorStop(0, 'rgba(210,244,255,' + 0.8 * k + ')'); gr.addColorStop(1, 'rgba(120,200,255,0)');
    g.fillStyle = gr; g.save(); g.translate(cx, y); g.scale(1, ry / rx); g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
    g.strokeStyle = '#ffffff'; g.lineWidth = 1;
    for (var j = 0; j < 3; j++) { var r0 = (0.45 + j * 0.25) * (1 - 0.15 * Math.sin(now * 4 + j)), a0 = now * (3 - j) + j * 2.1; g.globalAlpha = Math.min(1, k * (1.2 - j * 0.2)); g.lineWidth = j ? 1 : 2; g.beginPath(); g.ellipse(cx, y, rx * r0, ry * r0, 0, a0, a0 + 2.6); g.stroke(); g.beginPath(); g.ellipse(cx, y, rx * r0, ry * r0, 0, a0 + Math.PI, a0 + Math.PI + 1.6); g.stroke(); }
    for (var i = 0; i < 30; i++) { var aa = now * 2.6 + i * 0.35, rr3 = rx * (0.25 + (i % 6) * 0.13), hh = ((now * 60 + i * 23) % 120) * s; g.globalAlpha = k * (1 - hh / (120 * s)); g.fillStyle = '#ffffff'; g.fillRect(Math.round(cx + Math.cos(aa) * rr3), Math.round(y + Math.sin(aa) * rr3 * ry / rx - hh), i % 4 ? 1 : 2, i % 4 ? 1 : 2); }
    g.restore();
  }
  // 눈보라 예고(바닥): 위험한 곳(걷는 길 거의 전부)만 붉게(안전 띠 쪽 경계는 부드럽게 흐려짐), 안전 띠는 아무것도 없음 — 휩쓰는 동안에도 옅게 남김
  function blizWarn(g, camX, a, wu) {
    var b = blizBand(a), F = a.Q.feather, blink = 0.85 + 0.15 * Math.sin(performance.now() / 70), A = (0.14 + 0.26 * clamp(wu, 0, 1)) * blink;
    var ya = a.top ? b[0] : b[0] - F * 0.5, yb = a.top ? b[1] + F * 0.5 : b[1];
    var gr = g.createLinearGradient(0, ya, 0, yb);
    if (a.top) { gr.addColorStop(0, 'rgba(255,40,30,' + A + ')'); gr.addColorStop(0.8, 'rgba(255,40,30,' + A + ')'); gr.addColorStop(1, 'rgba(255,40,30,0)'); }
    else { gr.addColorStop(0, 'rgba(255,40,30,0)'); gr.addColorStop(0.2, 'rgba(255,40,30,' + A + ')'); gr.addColorStop(1, 'rgba(255,40,30,' + A + ')'); }
    g.save(); g.fillStyle = gr; g.fillRect(-2, ya, H.LW() + 4, yb - ya); g.restore();
  }
  // 맨 위(캐릭터 위): 날아가는 얼음 창 · 떨어지는 고드름 · 얼음 조각
  function drawOverIce(g, camX) {
    var e = boss, a = e && e.alive() && e.pat && e.pat.name === 'blizzard' ? e.pat : null;
    if (a && a.ph !== 'rec') {   // 눈보라(화면 전체, 캐릭터 위): 예고 끝무렵부터 눈이 조금씩 → 휩쓸 때 가득(시작 · 끝 부드럽게)
      var kk = a.ph === 'warn' ? 0.3 * smooth01((a.t / a.wMs - 0.45) / 0.55) : smooth01(a.t / 160) * (1 - smooth01((a.t - a.Q.fireMs + 260) / 260));
      drawBlizzard(g, camX, e, kk);
    }
    hz.spears.forEach(function (q) {
      var SQ = q.Q, ang = q.h > SQ.flyH + 0.5 ? Math.atan((q.h0 - SQ.flyH) / SQ.dropD) : 0;   // 내려오는 동안 앞끝이 아래로
      drawFx(g, 'spear_01', q.x - camX, q.y - q.h, SQ.k, 1, false, -ang);
      g.save(); g.globalAlpha = 0.25; g.fillStyle = '#000'; g.beginPath(); g.ellipse(q.x - camX + 30 * SQ.k, q.y, 30 * SQ.k, 2, 0, 0, Math.PI * 2); g.fill(); g.restore();
    });
    hz.icicles.forEach(function (c) {
      var fall = c.Q.fallMs, u = (c.t - (c.warn - fall)) / fall;
      if (u <= 0) return;
      drawFx(g, 'icicle_01', c.x - camX, c.y - c.Q.fallH * (1 - u * u), c.Q.k, Math.min(1, u * 3), false);
    });
    hz.chunks.forEach(function (o) {
      var al = o.t > o.ms - 400 ? (o.ms - o.t) / 400 : 1;
      drawFx(g, o.n, o.x - camX, o.y - o.h - 6, o.k, al, o.flip, o.rot);
    });
  }
  // 시험 자동 조종(빙결의 여왕): 예고를 보고 피함(위아래 · 점프 · 회피) · 얼음 벽 · 정령 먼저
  function botIce(p, out) {
    var e = boss, a = e.pat, L = lane(), Fj = J.frames, wx = wallX();
    function avoidY(y0, y1, margin) { var up = y0 - margin, dn = y1 + margin; out.y = (p.y - up < dn - p.y && up >= L.L0) || dn > L.L1 ? up : dn; out.threat = true; }
    if (a && e.st === 'pat') {
      var left = a.wMs - a.t;
      if (a.name === 'blizzard' && a.ph !== 'rec') { var hb = blizBand(a); avoidY(hb[0], hb[1], 4); }
      if (a.name === 'spear' && (a.ph === 'warn' || hz.spears.length)) { avoidY(a.lineY - a.Q.depth, a.lineY + a.Q.depth, 8); if (a.ph === 'warn' && left < 140 && Math.abs(p.y - a.lineY) <= a.Q.depth + 2) out.dodge = { x: 0, y: p.y < L.mid ? 1 : -1 }; }
      if (a.name === 'stomp' && a.ph === 'warn' && left < 120 && Math.abs(p.y - a.lineY) <= a.Q.depth + 4) out.jump = true;
      if (a.name === 'teleport') out.threat = true;
    }
    hz.spikes.forEach(function (k) { var lf = k.Q.life; if (k.t > -60 && k.t < lf[0] + 30 && Math.abs(p.x - k.x) < k.Q.gap * 1.4 && Math.abs(p.y - k.y) <= k.Q.depth + 2) out.jump = true; });
    hz.icicles.forEach(function (c) {
      if (Math.abs(p.x - c.x) <= c.Q.radius + 10 && Math.abs(p.y - c.y) <= c.Q.depth + 8) { out.threat = true; out.x = p.x + (p.x < c.x ? -1 : 1) * (c.Q.radius + 18); out.y = p.y + (p.y < c.y ? -1 : 1) * (c.Q.depth + 12); if (c.warn - c.t < 200) out.dodge = { x: p.x < c.x ? -1 : 1, y: 0 }; }
    });
    var wl = adds.filter(function (m) { return m.iceWall && m.up(); })[0];
    if (wl && !out.threat) out.x = wl.fd > 0 ? wl.x + wl.halfW + 4 : wl.x - wl.halfW - 4;
    return out;
  }

  // ---------- 내보내기 · 상태 ----------
  // 보스 등장: 싸움터 오른쪽(보이는 화면 왼쪽 끝 camL + max(화면 폭 x viewK, 화면 폭 - fromRight)), 발 = 배경 groundY 줄
  function spawn(camL) {
    var LW = H.LW(), x = camL + Math.max(LW * B.viewK, LW - B.fromRight), y = W().bgOff + B.groundY;
    clearHz(); push = null; adds = [];
    boss = B.kind === 'queen' ? new Queen(Math.round(x), Math.round(y)) : new Dragon(Math.round(x), Math.round(y));
    return boss;
  }
  function reset() { boss = null; push = null; clearHz(); adds = []; }
  // 체력 막대 값(main.js updateHud): 줄 수 x · 지금 줄 채움 · 색 · 다음 줄 색 · 늦게 따라오는 막대 · 그로기 · 격노
  function bar() {
    var e = boss; if (!e || !e.barOn) return null;
    var Lh = B.lineHp, hp = Math.max(0, e.hp), lines = Math.max(0, Math.ceil(hp / Lh)), frac = lines ? (hp - (lines - 1) * Lh) / Lh : 0;
    e.lagHp = e.lagHp > hp ? Math.max(hp, e.lagHp - Math.max(Lh * 0.02, (e.lagHp - hp) * 0.06)) : hp;
    var lagLines = Math.ceil(e.lagHp / Lh), lag = lagLines > lines ? 1 : lines ? (e.lagHp - (lines - 1) * Lh) / Lh : 0;
    var ci = Math.max(0, lines - 1) % LINE_COLS.length, ni = Math.max(0, lines - 2) % LINE_COLS.length;
    return { name: B.name, lines: lines, frac: frac, lag: lag, col: LINE_COLS[ci], next: lines > 1 ? LINE_COLS[ni] : '#2a0a10', gauge: e.gauge / B.groggy.max, groggy: e.st === 'groggy', rage: e.rageOn, dead: !e.alive() };
  }

  // ---------- 시험 자동 조종(main.js botThink 가 부름): 어디로 갈지 · 점프 · 회피 ----------
  //   돌려주는 값 { x, y(가고 싶은 자리), jump, dodge: {x, y}(회피 방향) 또는 null, threat(피하는 중 = 때리러 안 감), jumpAtk(머리가 낮음 = 점프 공격) }
  function bot(p) {
    var e = boss; if (!e || !e.alive() || e.st === 'enter') return null;
    var wx = wallX(), L = lane(), a = e.pat, out = { x: wx - 4, y: p.y, jump: false, dodge: null, threat: false, jumpAtk: false };
    if (e.queen) {
      var AR = arena(); if (e.fd > 0) out.x = AR.lo + 2; else out.x = AR.hi + 2;   // 기본 = 여왕 바로 앞
      if (e.st === 'pat' && e.pat && e.pat.name === 'teleport' && e.pat.ph !== 'back') out.x = (AR.lo + AR.hi) / 2;   // 순간이동 중 = 가운데에서 기다림
      botIce(p, out); if (e.weakOpen && !out.threat) out.jumpAtk = true; out.x = clamp(out.x, AR.lo - 4, AR.hi + 4); out.y = clamp(out.y, L.L0, L.L1); return out;
    }
    function avoidY(y0, y1, margin) {   // 위아래 띠 [y0, y1] 밖으로(가까운 쪽, 막히면 반대쪽)
      var up = y0 - margin, dn = y1 + margin;
      out.y = (p.y - up < dn - p.y && up >= L.L0) || dn > L.L1 ? up : dn; out.threat = true;
    }
    if (a && e.st === 'pat') {
      var left = a.wMs - a.t, Fj = J.frames;
      if (a.name === 'breath') {
        if (a.sweep && a.ph === 'fire') { var b = e.breathBand(), inB = p.y >= b[0] - 4 && p.y <= b[1] + 4; out.threat = true; out.y = a.half ? L.L1 : L.L0; if (inB || Math.abs(p.y - (a.half ? b[0] : b[1])) < 10) out.dodge = { x: 0, y: a.half ? 1 : -1 }; }
        else if (a.ph !== 'rec') { var h = halfY(a.sweep ? a.half : a.half); avoidY(h[0], h[1], 6); if (a.sweep) out.y = a.half ? L.L0 + 2 : L.L1 - 2; }
      }
      if (a.name === 'slam') {
        var R0 = wbox(Fj.slam_03.reach, e);
        if (a.ph === 'warn' && p.x >= R0.x0 - 10) { out.x = R0.x0 - 22; out.threat = true; if (left < 180 && p.x >= R0.x0 - 2) out.dodge = { x: -1, y: 0 }; }
      }
      if (a.name === 'tail' && a.ph === 'warn') { var R1 = wbox(Fj.tail_03.reach, e); if (p.x >= R1.x0 - 6) { out.threat = true; if (left < 140) out.jump = true; } }
      if (a.name === 'bite' && a.ph === 'warn') {
        var R2 = wbox(Fj.bite_02.reach, e);
        if (p.x >= R2.x0 - 20) { avoidY(a.lineY - a.Q.depth, a.lineY + a.Q.depth, 10); if (left < 160 && Math.abs(p.y - a.lineY) <= a.Q.depth + 2) out.dodge = { x: -1, y: p.y < L.mid ? 1 : -1 }; }
      }
      if (a.name === 'bite' && a.ph === 'stuck') { out.x = wx - 4; out.y = a.lineY; }
      if (a.name === 'slam' && a.ph === 'hold') out.jumpAtk = true;
      if (a.name === 'lava' && (a.ph === 'warn' || a.ph === 'erupt')) { var hh = halfY(a.cur); avoidY(hh[0], hh[1], 8); }
      if (a.name === 'sky') { out.threat = a.ph !== 'rec'; out.x = H.G().camX + (wx - H.G().camX) * 0.45; }
    }
    if (e.st === 'groggy') out.y = p.y;
    if (e.weakOpen && !out.threat) out.jumpAtk = true;
    // 운석: 떨어질 자리 안이면 밖으로
    hz.meteors.forEach(function (m) {
      if (Math.abs(p.x - m.x) <= m.Q.radius + 10 && Math.abs(p.y - m.y) <= m.Q.depth + 8) { out.threat = true; out.x = p.x + (p.x < m.x ? -1 : 1) * (m.Q.radius + 18); out.y = p.y + (p.y < m.y ? -1 : 1) * (m.Q.depth + 12); if (m.warn - m.t < 200) out.dodge = { x: p.x < m.x ? -1 : 1, y: 0 }; }
    });
    // 충격파: 테두리가 곧 닿으면 점프
    hz.rings.forEach(function (q) {
      if (!q.harm || q.hit) return;
      var r = ringR(q), ry = Math.max(4, r * q.Q.ry), dx = p.x - q.x, dy = p.y - q.y, k = Math.sqrt((dx / r) * (dx / r) + (dy / ry) * (dy / ry)), gap = (k - 1) * r;
      if (gap > 0 && gap < q.Q.speed * 0.16) out.jump = true;
    });
    out.x = clamp(out.x, H.G().camX + 20, wx - 2); out.y = clamp(out.y, L.L0, L.L1);
    return out;
  }

  window.Raid = {
    init: function (h) { H = h; },
    load: load, ready: ready, free: free, reset: reset, spawn: spawn,
    boss: function () { return boss; },
    part: function (e, x, h) { return part(e, x, h); },
    wallX: wallX, wallL: wallL, addDraw: addDraw, drawOver: drawOver, bar: bar, bot: bot,
    hz: hz, debug: false,
    // 시험: 공격 바로 쓰기 · 그로기 · 체력
    test: {
      pat: function (n) { if (boss && boss.alive() && B.pats[n]) { boss.pend = null; boss.startPat(n); } },
      groggy: function () { if (boss) boss.startGroggy(); },
      hp: function (k) { if (boss) boss.hp = Math.max(1, Math.round(boss.maxHp * k)); },
      state: function () { var e = boss; return e ? { st: e.st, pat: e.pat ? e.pat.name + ':' + e.pat.ph : null, fr: e.fr, hp: e.hp, max: e.maxHp, gauge: Math.round(e.gauge), weak: e.weakOpen, sky: e.skyOn, rage: e.rageOn, lift: Math.round(e.lift), x: e.x, y: e.y, k: +e.k.toFixed(3), wall: Math.round(wallX() || 0), hits: e.hitLog, dmg: e.dmgLog, taken: e.taken, log: e.log.slice(-40), rings: hz.rings.length, meteors: hz.meteors.length, pools: hz.pools.length, bar: !!e.barOn,
        queen: !!e.queen, fade: e.fade, spikes: hz.spikes.length, spears: hz.spears.length, icicles: hz.icicles.length, chunks: hz.chunks.length,
        adds: adds.filter(function (m) { return m.alive(); }).map(function (m) { return (m.iceWall ? 'wall' : 'spirit') + ':' + m.hp; }), canHit: e.canBeHit() } : null; }
    }
  };
})();
