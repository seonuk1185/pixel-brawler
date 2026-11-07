// 적: 고블린 · 늑대 · 오크 족장(보스) + 2단계 박쥐(나는 적) · 해골 병사(방패 막기) · 돌 골렘(보스, 바위 던지기)
//   + 3단계 도마뱀 전사(찌르기·달려들기) · 거대 두꺼비(보스, 배치기·혀·독 뱉기) + 4단계 미라(잡기) · 전갈 왕(보스, 땅속 숨기)
//   + 5단계 설인(느리고 단단, 두 주먹 내려찍기) · 서리 거인(보스, 몽둥이 내려찍기·휘두르기·얼음 가시 줄)
//   + 6단계 해적 총잡이(멀리서 쏨, 거리 두기) · 해적 선장(보스, 칼 두 번·권총·대포 일제 사격)
//   + 7단계 불 도깨비(치고 빠지기·불덩이) · 용암 골렘(정예, 골렘 색 바꿈) · 붉은 와이번(보스, 물기·불 뿜기·날아올라 내리꽂기)
//   + 8단계 유령 기사(내려베기·옅어져 돌진 찌르기) · 흡혈 백작(보스, 발톱·박쥐 떼·안개 순간이동 물어 빨기)
//   + 9단계 마족 병사(방패 막기·미늘창) · 흑마법사(멀리서 암흑 구체) · 마왕군 장군(보스, 대검 두 번·돌진 찌르기·칼 꽂기 화염 충격파)
//   + 10단계 마왕(마지막 보스, 대검 세 번·초승달 파동·암흑 구슬 비·어둠 순간이동, 절반에서 각성 + 오라). 수치는 전부 config.js 의 enemies.
// 그림은 전부 「왼쪽을 봄」 → 그릴 때 ctx.scale(-dir, 1)  (dir = 1 이면 오른쪽을 봄)
(function () {
  var uid = 0;
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randi(a) { return Math.round(rand(a[0], a[1])); }
  function inList(list, n) { return !!list && list.indexOf(n) >= 0; }
  // 캐릭터 크기(config actorScale): 코드에 바로 적힌 거리에 곱한다 (config 수치는 scaleActors 가 이미 줄여 둠)
  function AS() { return (window.CFG && window.CFG.actorScale) || 1; }

  function Enemy(type, cfg, art, x, y) {
    this.id = 'e' + (++uid);
    this.type = type;
    this.cfg = cfg;
    this.T = cfg.enemies[type];
    this.art = art;
    this.x = x; this.y = y;
    this.dir = -1;
    this.hp = this.maxHp = this.T.hp;
    this.state = 'walk'; this.animT = 0;
    this.vx = 0;                       // 밀려나는 속도
    this.flashT = 0;
    this.cool = randi(this.T.firstCooldown || this.T.cooldown);
    this.atk = null;
    this.deadT = 0; this.remove = false;
    this.entered = false;              // 화면 안으로 들어왔는지(들어온 뒤로는 화면 밖으로 못 나감)
    this.side = 0;                     // 플레이어의 어느 쪽에 서 있나(-1 왼쪽, 1 오른쪽)
    this.yOff = rand(-22, 22);         // 차례 기다릴 때 위아래로 흩어지는 정도
    this.hoverD = rand(this.T.hover[0], this.T.hover[1]);
    this.retreatT = 0;
    this.staggerCd = 0;
    this.enraged = false;
    // 보폭으로 걷기(T.walkStride 가 있는 보스만): walkPh = 걷기 한 바퀴 중 어디(0~1), mvx·mvy = 지난번 걸은 속도, walkHold = 멈춰도 걷기 그림을 잠깐 더 유지하는 남은 시간
    this.walkPh = 0; this.mvx = 0; this.mvy = 0; this.walkHold = 0;
    this.wave = -1;
    // 맞음 반응
    this.clock = 0;                    // 이 적의 시계(ms, 멈춤·슬로모션 반영)
    this.hitAlt = false;               // hit / hit2 번갈아
    this.hitAnim = 'hit';
    this.recentHits = [];              // 최근 맞은 시각(연속으로 맞으면 넘어짐)
    this.downT = 0;                    // 넘어진 뒤 지난 시간
    this.stagT = 0;                    // 휘청 지난 시간 (보스)
    this.stagDone = {};                // 이미 휘청한 체력 문턱
    // 판마다 강하게 / 색만 바꾼 적 (main.js 가 만든 뒤 넣음): dmgMul = 플레이어에게 주는 데미지 배율, label = 보스 막대 이름
    this.dmgMul = 1; this.variant = null; this.label = this.T.label || type;
    // 미리 서 있는 적(판 waves 의 placed): asleep = 아직 못 알아챔(제자리에 가만히), alertT = 깬 뒤 「!」 보이며 멈춰 있는 시간
    this.asleep = false; this.alertT = 0; this.pose = 'idle'; this.group = null;
    // 방패 막기(해골 병사, T.guard): guardT = 방패 들고 있는 남은 시간, guardCd = 다시 막기까지, guardFlash = 막는 순간 그림(block 2), blocks = 이번에 막은 수
    this.guardT = 0; this.guardCd = 0; this.guardFlash = 0; this.blocks = 0; this.guardBroken = false;
    // 땅속 숨기(전갈 왕 burrow): hidden = 땅속(안 보이고 안 맞음, 모래 둔덕만 그림), lastBurrowAt = 마지막으로 숨은 시각(this.clock)
    this.hidden = false; this.lastBurrowAt = 0;   // 0 = 나타나자마자 숨지는 않음(gapMs 뒤부터)
    this.usedAt = {};                             // 잡몹 공격마다 마지막으로 쓴 시각(this.clock, 공격 gapMs 용)
  }

  // 미리 세워 두기: pose = 쉬는 그림 이름(없으면 idle), group = 같이 깨는 무리 이름
  Enemy.prototype.sleep = function (pose, group) {
    this.asleep = true; this.pose = pose || 'idle'; this.group = group || null;
    this.state = 'idle'; this.animT = rand(0, 1000);   // 여럿이 똑같이 숨 쉬지 않게
  };
  // 알아챔: alertMs 동안 「!」 보이며 멈춰 있다가 싸움
  Enemy.prototype.wake = function (alertMs, force) {
    if (!this.asleep && !force) return;   // force = 미리 서서 나온 몹(2026-11-07): 안 자도 「!」
    this.asleep = false; this.alertT = alertMs || 0; this.animT = 0;
  };

  function sum(d) { var s = 0; for (var i = 0; i < d.length; i++) s += d[i]; return s; }

  // 방패 막기(해골 병사): 플레이어 타가 닿기 직전에 main.js onHit 가 묻는다. true = 막음(데미지 없음)
  //   dir = 밀려나는 방향(앞에서 맞으면 = 바라보는 반대쪽), breaker = 방패 깨는 타(기술·달리며 공격·점프 공격·마무리 타)
  //   방패를 들고 있으면 앞에서 오는 보통 타는 다 막음(maxBlocks 까지). 안 들고 있으면 서 있거나 걷는 중에만 chance 확률로 막기 시작
  //   (확률에 안 걸리면 잠깐 다시 안 굴림 → 콤보 한 번에 한 번만 굴림). 공격 중·맞는 중·넘어짐·자는 중에는 안 막음
  Enemy.prototype.tryGuard = function (dir, breaker) {
    var G = this.T.guard;
    if (!G || !this.alive() || this.asleep || this.alertT > 0 || !this.hasAnim(G.anim)) return false;
    var front = dir === -this.dir;
    if (this.state === 'guard') {
      if (breaker || !front) {   // 방패 깨짐: 방패 내리고 그대로 맞음
        this.state = 'idle'; this.guardT = 0; this.guardCd = G.cdMs; this.guardBroken = true;
        return false;
      }
    } else {
      if (breaker || !front || this.guardCd > 0 || (this.state !== 'idle' && this.state !== 'walk')) return false;
      if (Math.random() >= G.chance) { this.guardCd = 700; return false; }
      this.state = 'guard'; this.animT = 0; this.guardT = G.holdMs; this.blocks = 0; this.atk = null;
    }
    this.blocks++;
    this.guardFlash = G.flashMs;
    this.vx = dir * G.push * 10;   // 조금 뒤로 밀림(밀려남 속도는 1초에 10배로 줄어듦 → 거리 = push)
    if (this.blocks >= G.maxBlocks) this.guardT = Math.min(this.guardT, 160);   // 많이 막았으면 곧 방패 내림
    return true;
  };

  // 지금 맞을 수 있나 (넘어짐~일어남 동안은 무적)
  //   7단계 와이번이 날아 있는 동안(diveAir)은 땅에서 하는 공격은 안 맞고, 플레이어가 jumpZ 넘게 떠 있을 때(점프 공격)만 맞음
  Enemy.prototype.canBeHit = function () {
    if (!this.alive() || this.state === 'down' || this.state === 'awaken' || this.hidden || this.burrowInvuln() || this.faded() || this.teleInvuln()) return false;
    if (this.state === 'air') return true;   // 띄워진 잡몹(콤보, 2026-11-06): 평타·기술 다 맞음
    if (this.diveAir()) return !!(this.lastP && (this.lastP.z || 0) > this.atk.spec.jumpZ);
    return !this.airborne();
  };

  // ---------- 띄우기·공중 콤보 (2026-11-06 밤, config ai.air) ----------
  // 띄우기 기술(올려베기·땅 융기, 판정 값 launch)에 맞은 잡몹은 공중으로 떠오름(state 'air', az = 땅에서 높이).
  //   떠 있는 동안 모든 공격(평타·기술·공중 공격)에 맞고, 맞을 때마다 살짝 다시 뜸. 오래 뜰수록·많이 맞을수록 빨리 떨어짐(중력 배율)
  //   → 땅에 닿으면 넘어짐(down)의 바닥에 닿는 장부터 = 누운 적 때리기(ai.otg) 그대로.
  //   보스·큰 적(canLaunch 가 false)은 안 뜸 → 잡몹은 휘청(맞은 그림에 잠깐 멈춤), 보스는 보통 맞음
  Enemy.prototype.canLaunch = function () {
    var A = this.cfg.ai.air, T = this.T;
    if (T.midBoss) return !!A && !T.noLaunch && this.hasAnim('knockdown');   // 중간보스: 체력이 커도 뜸(원래 보스였던 적은 noLaunch)
    return !!A && !T.boss && !T.noLaunch && T.hp < A.heavyHp && this.hasAnim('knockdown');
  };
  // 위로 쳐 올리기: h = 이번에 올라갈 높이(도트, 지금 위치에서). 이미 더 빠르게 오르는 중이면 그대로
  Enemy.prototype.airKick = function (h) {
    var A = this.cfg.ai.air, g = A.g * AS(), v = Math.sqrt(2 * g * Math.max(0, h));
    if (v > (this.avz || 0)) this.avz = v;
  };
  // 띄우기 시작(땅 → 공중). k = 띄우는 세기(판정 값 launch, 1 = 보통)
  Enemy.prototype.startAir = function (k) {
    var A = this.cfg.ai.air;
    this.state = 'air'; this.animT = 0; this.atk = null; this.hidden = false; this.stunT = 0;
    this.az = 0; this.avz = 0; this.airT = 0; this.airHits = 0; this.recentHits = [];
    this.airKick(A.launchH * AS() * k);
  };
  // 공중에서 또 맞음: 많이 맞을수록·오래 떠 있을수록 덜 뜸(refloatCut 번째부터 0, maxAirMs 넘으면 0)
  Enemy.prototype.airHit = function (launch) {
    var A = this.cfg.ai.air;
    this.airHits++;
    var cut = Math.max(0, 1 - this.airHits / A.refloatCut) * (this.airT < A.maxAirMs ? 1 : 0);
    // 공중에서 다시 띄우기 기술에 맞으면 더 크게(그래도 줄어듦)
    this.airKick((launch ? A.relaunchH * launch : A.refloatH) * AS() * cut);
  };
  // 지금 중력(도트/초²): 맞은 수·뜬 시간만큼 커짐, maxAirMs 넘으면 크게
  Enemy.prototype.airG = function () {
    var A = this.cfg.ai.air, k = 1 + A.gravHit * this.airHits + A.gravSec * this.airT / 1000;
    if (this.airT >= A.maxAirMs) k *= A.capGravMul;
    return A.g * AS() * k;
  };
  // 공중 갱신. 땅에 닿으면 넘어짐(바닥에 닿는 장 바로 앞부터 → 곧 누움 = 누운 적 때리기 됨)
  Enemy.prototype.updateAir = function (dtMs, ctx) {
    var dt = dtMs / 1000;
    this.airT += dtMs;
    this.avz -= this.airG() * dt;
    this.az = Math.max(0, this.az + this.avz * dt);
    if (this.az > 0 || this.avz > 0) return;
    this.lastAirMs = this.airT; this.lastAirHits = this.airHits;
    var DT = this.downTimes(), step = 1000 / this.T.anims.knockdown.fps;
    this.state = 'down'; this.downT = Math.max(0, DT.slide - step); this.animT = 0; this.atk = null;
    this.downExtra = 0; this.otgHits = 0; this.recentHits = []; this.avz = 0; this.az = 0;
    this.landed = true;   // main.js 가 보고 먼지·흔들림(한 번)
    if (ctx && ctx.dust) { ctx.dust(this.x - 8 * AS(), this.y, -1); ctx.dust(this.x + 8 * AS(), this.y, 1); }
    if (ctx && ctx.shake) ctx.shake(this.cfg.ai.air.landShake || 0.4);
  };
  // 누운 적 때리기(OTG, config ai.otg): 땅까지 닿는 공격(hitsDown)이면 누워 있는 동안도 맞음
  //   맞는 때 = 쓰러지며 밀려나는 그림이 끝난 뒤(바닥에 닿음) ~ 일어나는 그림 전. 한 번 넘어질 때 maxHits 번까지
  Enemy.prototype.canBeHitDown = function () {
    if (this.state !== 'down' || this.hidden) return false;   // 띄워진 적(air)은 canBeHit 로 다 맞음
    var O = this.cfg.ai.otg; if (!O) return false;
    var DT = this.downTimes();
    return this.downT >= DT.slide && this.downT < DT.kd + DT.lying && (this.otgHits || 0) < O.maxHits;
  };
  // 이 공격(st)에 맞을 수 있나: 보통은 canBeHit, 땅까지 닿는 공격은 누운 적도
  Enemy.prototype.canBeHitBy = function (st) {
    return this.canBeHit() || !!(st && st.hitsDown && this.canBeHitDown());
  };
  // 공중(두꺼비 배치기 leap 의 뛰는 그림 2·3장 / 와이번 날아오름~떨어짐): 안 맞고, 몸끼리 안 밀림(main.js separate)
  Enemy.prototype.airborne = function () {
    var a = this.atk;
    if (this.state === 'air') return true;   // 띄워짐(콤보): 몸끼리 안 밀림·소품 위로 지나감 (맞는 것은 canBeHit 가 따로 허락)
    if (this.state !== 'attack' || !a) return false;
    if (a.spec.type === 'dive') return this.diveAir();
    if (a.spec.type !== 'leap') return false;
    return inList(a.spec.leap.frames, this.frameAt(a.spec.anim, a.t).no);
  };
  // 와이번 날아오르기(dive): 땅을 떠난 단계(떠오름 2·3장 · 맴돌기 · 경고 · 떨어짐)
  Enemy.prototype.diveAir = function () {
    var a = this.atk;
    return this.state === 'attack' && !!a && a.spec.type === 'dive' && (a.phase === 'hover' || a.phase === 'warn' || a.phase === 'fall' || (a.phase === 'takeoff' && a.z > 0));
  };
  // 8단계 유령 기사 돌진(공격 fade 장): 몸이 옅어진 동안 = 안 맞음, 몸끼리 안 밀림(main.js separate), 반투명으로 그림
  Enemy.prototype.faded = function () {
    var a = this.atk;
    return this.state === 'attack' && !!a && !!a.spec.fade && inList(a.spec.fade, this.frameAt(a.spec.anim, a.t).no);
  };
  // 8단계 흡혈 백작 안개 순간이동(teleport): 사라지는 그림 invuln 장(2·3) · 숨음(hidden, 안개 모임) · 나타나는 그림 1장 = 안 맞음
  Enemy.prototype.teleInvuln = function () {
    var a = this.atk;
    if (this.state !== 'attack' || !a || a.spec.type !== 'teleport') return false;
    if (a.phase === 'vanish') return inList(a.spec.invuln, this.frameAt(a.spec.anim, a.t).no);
    if (a.phase === 'appear') return this.frameAt(a.spec.appearAnim, a.t).no === 1;
    return a.phase === 'hidden' || a.phase === 'gather';
  };
  // 지금 땅에서 떠 있는 높이(그림·몸 판정을 그만큼 위로, 그림자는 땅에)
  //   띄워진 잡몹(state 'air')·공중에서 쓰러진 잡몹(떨어지는 중)은 az
  Enemy.prototype.flyZ = function () {
    if (this.dropZ > 0) { if (this.state === 'walk' || this.state === 'idle') return this.dropZ; this.dropZ = 0; }   // 뛰어내리는 중(던전 몹 떼). 맞으면 바로 땅
    if (this.az > 0 && (this.state === 'air' || this.state === 'dead')) return this.az;
    var a = this.atk; return this.state === 'attack' && a && a.spec.type === 'dive' ? a.z || 0 : 0;
  };
  // 땅속 숨기 무적 장: 파고드는 그림 invuln(3·4장) / 솟구치는 그림 eruptInvuln(1장) / 땅속(둔덕·떨림)
  Enemy.prototype.burrowInvuln = function () {
    var a = this.atk;
    if (this.state !== 'attack' || !a || a.spec.type !== 'burrow') return false;
    if (a.phase === 'dig') return inList(a.spec.invuln, this.frameAt(a.spec.anim, a.t).no);
    if (a.phase === 'erupt') return inList(a.spec.eruptInvuln, this.frameAt(a.spec.eruptAnim, a.t).no);
    return a.phase === 'mound' || a.phase === 'warn';
  };
  Enemy.prototype.hasAnim = function (name) { return !!(this.T.anims[name] && this.art[name] && this.art[name][0]); };

  // 넘어짐 그림 길이 / 그중 밀려나는 시간(첫 누운 그림 전까지)
  Enemy.prototype.downTimes = function () {
    var A = this.T.anims.knockdown, step = 1000 / A.fps, pb = A.playback || null;
    var kd = (pb ? pb.length : this.art.knockdown.length) * step;
    var lie = (this.T.down && this.T.down.lyingFrames) ? this.T.down.lyingFrames[0] : 3;
    var k = pb ? pb.indexOf(lie) : lie - 1;
    var G = this.T.anims.getup, gl = ((G.playback ? G.playback.length : this.art.getup.length) * 1000 / G.fps);
    // lying 에 누운 채 맞아서 늘어난 시간(downExtra, 최대 넘어짐 전체 x ai.otg.maxExtendK)을 더함
    return { kd: kd, slide: Math.max(step, (k < 0 ? 3 : k) * step), lying: this.cfg.ai.react.lyingMs + (this.downExtra || 0), getup: gl };
  };

  Enemy.prototype.startStagger = function () {
    this.state = 'stagger'; this.stagT = 0; this.animT = 0; this.atk = null; this.vx = 0; this.hidden = false;
  };

  // 10단계 마왕 각성: awaken 그림을 한 번(안 맞음). awakened = 각성 시작함(다시 안 함), awT = 지난 시간. 화남(enraged)은 그림이 끝날 때 켬
  //   main.js stageStep 이 state 'awaken' 을 보고 글자·번쩍·흔들림·졸개 부름
  Enemy.prototype.startAwaken = function () {
    this.state = 'awaken'; this.awakened = true; this.awT = 0; this.animT = 0; this.atk = null; this.vx = 0; this.hidden = false; this.awPushed = false;
  };
  // 오라 진하기(0~1): 각성 3장(거대한 불꽃)부터 fadeInMs 동안 진해짐 → 그 뒤 계속. 쓰러지면 400ms 동안 꺼짐
  Enemy.prototype.auraK = function () {
    var AW = this.T.awaken;
    if (!AW || !AW.aura || !this.awakened) return 0;
    if (this.state === 'dead') return Math.max(0, 1 - this.deadT / 400);
    if (this.state === 'awaken') {
      var A = this.T.anims[AW.anim], t3 = A.playback.indexOf(3) * 1000 / A.fps;
      return Math.max(0, Math.min(1, (this.awT - t3) / (AW.aura.fadeInMs || 1)));
    }
    return 1;
  };

  // 그림 한 장 고르기: playback(1부터 번호) + fps
  Enemy.prototype.frameAt = function (name, tMs) {
    var A = this.T.anims[name], imgs = this.art[name];
    var pb = A.playback || null, n = pb ? pb.length : imgs.length;
    var step = 1000 / A.fps, i = Math.floor(tMs / step);
    var done = i >= n;
    i = A.loop ? i % n : Math.min(n - 1, i);
    var no = pb ? pb[i] : i + 1;
    return { img: imgs[no - 1], no: no, done: done, len: n * step, step: step };
  };

  Enemy.prototype.alive = function () { return this.state !== 'dead'; };
  Enemy.prototype.speedMul = function () { return (this.enraged ? this.T.enrage.speedMul : 1) * (this.elSpd || 1); };   // elSpd = 바람 속성 몹(2026-11-07 js/elmobs.js)

  // 몸 판정 (앞 = 바라보는 쪽 +)
  Enemy.prototype.hurtbox = function () {
    var h = this.T.hurtbox, SG = this.T.stagger;
    if (this.state === 'stagger' && SG && SG.hurtbox && this.staggerIdx() === 2) h = SG.hurtbox;   // 휘청 3장(전갈 뒤집힘) = 몸이 더 넓게 누움
    var xa = this.x + h.x0 * this.dir, xb = this.x + h.x1 * this.dir, z = this.flyZ();   // 날아 있으면 그만큼 위로(점프 공격 판정과 맞춤)
    // 띄워진 잡몹: 떠 있는 몸 꼭대기 ~ 땅까지 (땅에서 휘두르는 평타·기술도 닿게. 공중 공격은 떠 있는 몸에)
    if (this.state === 'air') return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: this.y - z + h.yTop, y1: this.y + h.yBot, z: this.y };
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: this.y - z + h.yTop, y1: this.y - z + h.yBot, z: this.y };
  };
  // 공격 판정 상자
  Enemy.prototype.attackBox = function (r, depth) {
    var xa = this.x + r.x0 * this.dir, xb = this.x + r.x1 * this.dir;
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: this.y + r.yTop, y1: this.y + r.yBot, z: this.y, depth: depth };
  };

  // 플레이어에게 맞음. dir = 밀려나는 방향. opts = { heavy: 무거운 타, force: 넘어져 있어도 맞음(보스 쓰러질 때 졸개 정리), noJuggle: 연속 맞음으로 안 넘어짐,
  //   stunMs: 맞은 그림이 끝나도 이만큼 더 멈춰 있음(번개 기술) }
  // 돌려주는 값: 'dead' / 'down'(넘어짐) / 'stagger'(움찔·휘청) / 'armor'(번쩍이기만) / null(무적이라 안 맞음)
  Enemy.prototype.takeHit = function (dmg, dir, knockPx, finisher, opts) {
    opts = opts || {};
    if (!this.alive()) return null;
    if (this.state === 'down' && !opts.force) {
      // 누운 적 때리기(opts.otg = 땅까지 닿는 공격, config ai.otg): 데미지만, 다시 날아가거나 일어나지 않음. 누워 있는 시간은 조금만 늘림
      if (!opts.otg || !this.canBeHitDown()) return null;
      var O = this.cfg.ai.otg, D0 = this.downTimes(), base = D0.kd + D0.lying - (this.downExtra || 0) + D0.getup;
      this.otgHits = (this.otgHits || 0) + 1;
      this.hp = Math.max(0, this.hp - dmg);
      this.flashT = this.cfg.juice.flashMs * 0.6;
      this.downExtra = Math.min(base * O.maxExtendK, (this.downExtra || 0) + O.extendMs);
      if (this.hp <= 0) {   // 누운 채로 죽음(아래 죽음 길과 같음: 일어나지 않고 그 자리에 누운 채로)
        this.deadImg = this.currentImg();
        this.state = 'dead'; this.deadT = 0; this.atk = null; this.vx = 0;
        return 'dead';
      }
      return 'otg';
    }
    if (this.hidden && !opts.force) return null;   // 땅속(전갈 왕)
    if (this.state === 'awaken' && !opts.force) return null;   // 각성 중(10단계 마왕)
    this.asleep = false; this.alertT = 0;   // 자다가 맞으면 바로 깸(「!」 없이)
    this.hitOut = true;                     // 맞음 = 화면에 보임 → keepInView 가 띠 안으로(2026-11-06 밤)
    var T = this.T, AI = this.cfg.ai, R = AI.react;
    var before = this.hp / this.maxHp;
    this.hp = Math.max(0, this.hp - dmg);
    this.flashT = this.cfg.juice.flashMs * (opts.flashK != null ? opts.flashK : 1);   // flashK = 하얀 번쩍 길이 배율(밀고 가는 작은 타는 짧게)
    var kv = dir * knockPx * AI.enemyKnockMul * (T.knockResist != null ? T.knockResist : 1) * 10;
    // 공중(띄워진 잡몹, ai.air): 넘어지지 않고 살짝 다시 뜸 + 조금만 밀림. 쓰러지면 그 높이에서 떨어지며 쓰러짐(dead 도 az 로 떨어짐)
    if (this.state === 'air' && !opts.force) {
      this.vx = kv * AI.air.knockMul; this.dir = -dir;
      if (this.hp <= 0) { this.state = 'dead'; this.animT = 0; this.deadT = 0; this.atk = null; this.vx = dir * T.deathKnock * 0.5; return 'dead'; }
      this.airHit(opts.launch || 0);
      return 'air';
    }
    // 띄우기(opts.launch): 뜰 수 있는 잡몹 = 공중으로 / 큰 잡몹 = 휘청(맞은 그림에 launchStunMs 멈춤) / 보스 = 아래 보통 맞음
    if (opts.launch && this.hp > 0 && this.state !== 'down') {
      if (this.canLaunch()) { this.startAir(opts.launch); this.vx = kv * AI.air.knockMul; this.dir = -dir; return 'launch'; }
      if (!T.boss) opts.stunMs = Math.max(opts.stunMs || 0, AI.air.launchStunMs);
    }
    if (this.hp <= 0) {
      if (this.state === 'down') {     // 누워 있다가 죽음: 일어나지 않고 그 자리에 누운 채로
        this.deadImg = this.currentImg();
        this.state = 'dead'; this.deadT = 0; this.atk = null; this.vx = 0;
        return 'dead';
      }
      this.state = 'dead'; this.animT = 0; this.deadT = 0; this.atk = null;
      this.vx = dir * T.deathKnock;
      this.dir = -dir;
      // 사냥 손맛(config hunt.death, main.js 가 huntDeath 를 넣음): 잡몹이 붕 떠서 멀리 날아감 → 떨어지면 펑(update)
      var HD = this.huntDeath;
      if (HD) { this.flyDead = true; this.az = Math.max(this.az || 0, 0.5); this.avz = HD.up * AS(); this.vx = dir * T.deathKnock * (HD.vx || 1); }
      return 'dead';
    }
    if (T.boss) {
      // 10단계 마왕: 체력이 enrageAt(절반) 아래로 처음 내려가면 하던 일(공격·휘청)을 멈추고 각성(그동안 안 맞음)
      if (T.awaken && !this.awakened && this.hp / this.maxHp < T.enrageAt) { this.startAwaken(); return 'armor'; }
      // 체력 문턱(66%·33%)을 지나면 휘청: 공격 중이어도 끊긴다(때릴 기회)
      var S = T.stagger, after = this.hp / this.maxHp, crossed = false;
      if (S && this.hasAnim('stagger')) S.at.forEach(function (a) {
        if (!this.stagDone[a] && before >= a && after < a) { this.stagDone[a] = true; crossed = true; }
      }, this);
      if (crossed) { this.startStagger(); return 'stagger'; }
      if (this.state === 'stagger') return 'armor';
    } else {
      // 잡몹: 콤보 마지막 타 / 무거운 타 / 짧은 시간에 여러 번 맞으면 넘어짐
      var now = this.clock;
      this.recentHits = this.recentHits.filter(function (t) { return now - t <= R.juggleWindowMs; });
      // noJuggle = 달리며 공격의 밀고 가는 작은 타: 여러 번 맞아도 넘어지지 않음(밀려가야 하므로)
      if (!opts.noJuggle) this.recentHits.push(now);
      // 중간보스(2026-11-06, T.poise): 연타로는 안 넘어지고(마무리·무거운 타만), 한 번 넘어지면 downCdMs 동안 다시 안 넘어짐
      var PZ = T.poise, canDown = !PZ || now - (this.lastDownAt != null ? this.lastDownAt : -1e9) >= PZ.downCdMs;
      if (this.hasAnim('knockdown') && canDown && (finisher || opts.heavy || (!PZ && !opts.noJuggle && this.recentHits.length >= R.juggleHits))) {
        this.lastDownAt = now;
        this.state = 'down'; this.downT = 0; this.animT = 0; this.atk = null; this.vx = 0;
        this.downExtra = 0; this.otgHits = 0;   // 누운 채 맞은 횟수·늘어난 시간은 넘어질 때마다 새로
        this.dir = -dir; this.recentHits = [];
        return 'down';
      }
    }
    // 보스: 공격 중이거나 방금 움찔했으면 안 끊김(번쩍이기만)
    var armored = (T.superArmor && this.state === 'attack') || this.staggerCd > 0;
    if (armored) { this.vx += kv * 0.15; return 'armor'; }
    this.state = 'hit'; this.animT = 0; this.atk = null;
    this.hitAnim = this.hitAlt && this.hasAnim('hit2') ? 'hit2' : 'hit';   // 맞는 그림 번갈아
    this.hitAlt = !this.hitAlt;
    this.stunT = opts.stunMs || 0;
    this.vx = kv;
    this.dir = -dir;
    if (T.staggerCdMs) this.staggerCd = T.staggerCdMs;
    // 맞으면 바로 반격하지 않게 쉬는 시간을 조금 더함
    this.cool = Math.max(this.cool, 350);
    return 'stagger';
  };

  // 공격 시작
  Enemy.prototype.startAttack = function (name, ctx) {
    var spec = this.T.attacks[name];
    this.state = 'attack'; this.animT = 0;
    this.atk = { name: name, spec: spec, t: 0, hit: false, phase: 'wind', ran: 0, dustT: 0, moved: 0 };
    this.usedAt[name] = this.clock;
    if (!this.T.boss) ctx.lastAttackAt = ctx.now;
  };

  // 매 장면 갱신. ctx = { player, now, enemies, view: {x0,x1}, world, fx(dust 등), onPlayerHit(fn) }
  Enemy.prototype.update = function (dtMs, ctx) {
    // 느려짐(법사 얼음창, 2026-11-06 skills.js): slowT 동안 이 적의 시간이 slowK 배로 흐름 → 걷기·공격·맞는 동작·쿨타임 전부 느려짐
    if (this.slowT > 0) { this.slowT -= dtMs; dtMs *= this.slowK || 1; }
    var T = this.T, dt = dtMs / 1000, p = ctx.player;
    this.lastP = p;                    // 날아 있을 때 점프 공격만 맞게(canBeHit)
    this.animT += dtMs;
    this.clock += dtMs;
    if (this.rageT != null) this.rageT += dtMs;   // 분노 연출 시계(2026-11-06 밤, main.js 가 화날 때 0)
    // 뒤 벽에서 뛰어내림(2026-11-07 던전 몹 떼, main.js dgPack): dropZ 높이에서 중력으로 떨어짐 → 땅에 닿으면 먼지 + 살짝 흔들림.
    //   떨어지는 동안은 걷기 · 공격 안 함(맞으면 flyZ 가 바로 땅으로 내림)
    if (this.dropZ > 0 && (this.state === 'walk' || this.state === 'idle')) {
      this.dropV = (this.dropV || 0) + this.cfg.ai.air.g * AS() * dt;
      this.dropZ = Math.max(0, this.dropZ - this.dropV * dt);
      if (this.dropZ <= 0) {
        this.dropV = 0;
        if (ctx.dust) { ctx.dust(this.x - 8 * AS(), this.y, -1); ctx.dust(this.x + 8 * AS(), this.y, 1); }
        if (ctx.shake) ctx.shake(0.25);
      }
      return;
    }
    if (T.walkStride) this.stepWalk(dtMs);
    if (this.flashT > 0) this.flashT -= dtMs;
    if (this.staggerCd > 0) this.staggerCd -= dtMs;
    if (this.retreatT > 0) this.retreatT -= dtMs;
    if (this.guardCd > 0) this.guardCd -= dtMs;

    // 밀려남(감속)
    if (this.vx) {
      this.x += this.vx * dt;
      this.vx *= Math.exp(-dt * (this.flyDead && this.az > 0 ? 2.5 : 10));   // 날아가며 쓰러짐(사냥 손맛): 공중에서는 덜 줄어듦
      if (Math.abs(this.vx) < 2) this.vx = 0;
    }

    if (this.state === 'dead') {
      if (this.az > 0) {   // 공중에서 쓰러짐: 땅까지 떨어짐(콤보). 날아가며 쓰러짐(사냥 손맛 flyDead)은 위로 솟았다가 떨어짐
        this.avz = (this.flyDead ? this.avz || 0 : Math.min(this.avz || 0, 0)) - this.cfg.ai.air.g * AS() * 1.5 * dt;
        this.az = Math.max(0, this.az + this.avz * dt);
        if (this.az <= 0) this.landedAt = this.deadT;
      }
      this.deadT += dtMs;
      // 사냥 손맛(hunt.death): 땅에 떨어지면(날아간 적) 또는 popMs 가 지나면 코드로 그린 작은 펑과 함께 사라짐(main.js deathPop → 경험치 구슬)
      var HD = this.huntDeath;
      if (HD && !this.popped && !T.boss && ((this.flyDead && this.landedAt != null && this.deadT >= this.landedAt + 60) || this.deadT >= HD.popMs)) {
        this.popped = true; this.remove = true;
        if (ctx.deathPop) ctx.deathPop(this);
        return;
      }
      var fr = this.frameAt('death', this.deadT);
      var AI = this.cfg.ai;
      if (this.deadT > fr.len + AI.deathHoldMs + AI.deathFadeMs && !T.finalBoss) this.remove = true;   // 마지막 보스(마왕)는 재 + 왕관 + 대검이 남음
      this.keepInView(ctx);
      return;
    }
    if (this.state === 'air') { this.updateAir(dtMs, ctx); this.keepInView(ctx); return; }   // 띄워짐(콤보)
    if (this.state === 'hit') {
      if (this.stunT > 0) this.stunT -= dtMs;   // 번개 기술: 맞은 그림 마지막 장에서 더 멈춰 있음
      if (this.frameAt(this.hitAnim, this.animT).done && !(this.stunT > 0)) { this.state = 'idle'; this.animT = 0; }
      this.keepInView(ctx);
      return;
    }
    // 방패 들고 있음: 제자리에서 플레이어 쪽을 봄 → 시간이 다 되면 방패 내리고 곧 반격(counterMs)
    if (this.state === 'guard') {
      var GD = T.guard;
      this.guardT -= dtMs;
      if (this.guardFlash > 0) this.guardFlash -= dtMs;
      if (Math.abs(p.x - this.x) > 2) this.dir = p.x > this.x ? 1 : -1;
      if (this.guardT <= 0) {
        this.state = 'idle'; this.animT = 0; this.guardCd = GD.cdMs;
        this.cool = Math.min(Math.max(0, this.cool), GD.counterMs);
      }
      this.keepInView(ctx);
      return;
    }
    // 넘어짐: 날아가며 밀려남(처음엔 빠르게, 첫 누운 그림에서 멈춤) → 누워 있음 → 일어남
    if (this.state === 'down') {
      var DT = this.downTimes(), slide = (T.down && T.down.slide) || 75;
      var u0 = Math.min(1, this.downT / DT.slide), u1 = Math.min(1, (this.downT + dtMs) / DT.slide);
      var ease = function (u) { return 1 - (1 - u) * (1 - u); };
      this.x -= this.dir * slide * (ease(u1) - ease(u0));     // 바라보는 반대쪽(맞은 방향)으로
      this.downT += dtMs;
      if (this.downT >= DT.kd + DT.lying + DT.getup) {
        this.state = 'idle'; this.animT = 0;
        this.cool = Math.max(this.cool, this.cfg.ai.react.getupCoolMs);
      }
      this.keepInView(ctx);
      return;
    }
    // 보스 휘청: 정해진 시간 동안 무릎 꿇고 있음(맞아도 번쩍이기만)
    if (this.state === 'stagger') {
      this.stagT += dtMs;
      if (this.stagT >= sum(T.stagger.d)) {
        this.state = 'idle'; this.animT = 0;
        if (T.staggerCdMs) this.staggerCd = T.staggerCdMs;
        this.cool = Math.max(this.cool, 400);
      }
      this.keepInView(ctx);
      return;
    }
    // 각성(10단계 마왕): 제자리에서 awaken 그림 한 번(안 맞음). pushFrame(2장 팔 벌려 포효)에서 플레이어를 push 만큼 밀어냄(main.js ctx.pushPlayer)
    //   → 끝나면 화남(빨라짐·자주 공격) + 오라. 곧 공격하지 않게 조금 쉼
    if (this.state === 'awaken') {
      var AW = T.awaken, fa = this.frameAt(AW.anim, this.awT);
      this.awT += dtMs;
      if (!this.awPushed && fa.no >= AW.pushFrame) { this.awPushed = true; if (ctx.pushPlayer) ctx.pushPlayer(this, AW.push); ctx.shake(AW.shake * 0.5); }
      if (fa.done) {
        this.state = 'idle'; this.animT = 0; this.enraged = true;
        this.cool = Math.max(this.cool, 500);
        if (T.staggerCdMs) this.staggerCd = T.staggerCdMs;
      }
      this.keepInView(ctx);
      return;
    }
    // 미리 서 있는 적: 깰 때까지 제자리(화면 안으로 붙잡지도 않음). 깬 뒤 잠깐 「!」 보이며 플레이어 쪽을 봄
    if (this.asleep) { this.setMove(0, 0); return; }
    if (this.alertT > 0) {
      this.alertT -= dtMs;
      if (Math.abs(p.x - this.x) > 2) this.dir = p.x > this.x ? 1 : -1;
      this.setMove(0, 0); this.keepInView(ctx); return;
    }
    if (this.cool > 0) this.cool -= dtMs * (this.enraged ? 1 / this.T.enrage.cooldownMul : 1);

    if (this.state === 'attack') { this.updateAttack(dtMs, ctx); this.keepInView(ctx); return; }

    // ----- 생각하기: 플레이어 쪽으로 가서 차례가 되면 공격 -----
    var dx = p.x - this.x, dy = p.y - this.y, adx = Math.abs(dx);
    if (p.state === 'dead') { this.setMove(0, 0); this.keepInView(ctx); return; }
    if (adx > 2) this.dir = dx > 0 ? 1 : -1;
    if (!this.side || adx > 30 * AS()) this.side = this.x < p.x ? -1 : 1;

    if (T.ranged) { this.thinkRanged(dt, ctx, dx, dy); this.keepInView(ctx); return; }   // 총잡이: 거리 두고 쏨(아래 thinkRanged)

    var pick = this.cool <= 0 && this.retreatT <= 0 && this.entered ? this.chooseAttack(adx, Math.abs(dy), ctx) : null;
    if (pick) { this.startAttack(pick, ctx); this.keepInView(ctx); return; }

    var wantAttack = this.cool <= 0 && this.retreatT <= 0 && (T.boss || this.mayAttack(ctx));
    var tx, ty;
    if (wantAttack) { tx = p.x + this.side * T.engage; ty = p.y; }
    else { tx = p.x + this.side * this.hoverD; ty = p.y + this.yOff; }
    if (this.retreatT > 0) { tx = p.x + this.side * (T.engage + 90 * AS()); ty = p.y + this.yOff; }
    // 아직 화면 밖(들어오기 전): 목표를 화면 안으로(2026-11-04 막힘 고침). 플레이어가 화면 끝에 붙어 있으면 「플레이어 옆」 목표가 화면 밖이라
    //   거기 멈춰 서서 영영 안 들어오고(entered 가 안 되면 공격도 안 함) 웨이브가 안 끝났음
    // 2026-11-06 밤 버그 고침(오른쪽 안 보이는 벽): 들어온 뒤에도 목표(기다리는 자리 포함)를 플레이어가 갈 수 있는 띠 안으로.
    //   예전엔 들어오기 전만 → 플레이어 오른쪽에서 차례를 기다리는 적이 화면 끝(버튼 밑 바로 앞)에 붙어 서 있었음
    tx = Math.max(ctx.view.x0 + 20 * AS(), Math.min(ctx.view.x1 - 20 * AS(), tx));
    ty = Math.max(ctx.world.laneTop, Math.min(ctx.world.laneBottom, ty));
    if (ctx.steer && !T.flying) { var sv = ctx.steer(this, tx, ty); tx = sv.x; ty = sv.y; }   // 나는 적(박쥐)은 소품 위로 지나감   // 막는 소품(상자·통): 목표가 그 안이면 옆으로, 앞에 있으면 위나 아래로 돌아감 (props.js)
    var mx = tx - this.x, my = ty - this.y;
    var wm = this.walkMul || 1;   // 판 잡몹 걷기 +20%(2026-11-07, config ai.rightPlace.walkMul, main.js makeEnemy)
    var vx = Math.abs(mx) > 4 ? Math.sign(mx) * T.speedX * this.speedMul() * wm : 0;
    var vy = Math.abs(my) > 3 ? Math.sign(my) * T.speedY * this.speedMul() * wm : 0;
    // 목표 근처에서는 천천히
    var slowD = 14 * AS();
    if (Math.abs(mx) < slowD) vx *= Math.abs(mx) / slowD;
    this.setMove(vx, vy);
    this.x += vx * dt; this.y += vy * dt;
    // 뒤로 물러날 때도 플레이어 쪽을 본다
    if (adx > 2) this.dir = dx > 0 ? 1 : -1;
    this.keepInView(ctx);
  };

  Enemy.prototype.setMove = function (vx, vy) {
    var moving = Math.abs(vx) > 4 || Math.abs(vy) > 4;
    if (this.T.walkStride) {
      // 보폭으로 걷는 보스: 걷기 그림은 걸은 거리로 넘기고(stepWalk), 잠깐 멈췄다 다시 걸어도 처음 장으로 돌아가지 않음.
      //   멈춰도 WALK_HOLD_MS 동안은 걷기 그림(그 장 그대로)을 유지 → 목표 근처에서 섰다 걸었다 할 때 idle↔walk 그림이 번갈아 튀지 않음
      this.mvx = moving ? vx : 0; this.mvy = moving ? vy : 0;
      if (moving) this.walkHold = WALK_HOLD_MS;
      else if (this.state === 'walk' && this.walkHold > 0) return;
      var w = moving ? 'walk' : 'idle';
      if (this.state !== w) { this.state = w; if (w === 'idle') this.animT = 0; }
      return;
    }
    var s = moving ? 'walk' : 'idle';
    if (this.state !== s) { this.state = s; this.animT = 0; }
  };

  // 보폭 걷기(2026-11-05): 보스 걷기 그림을 시간 대신 「걸은 거리」로 넘긴다(플레이어 걷기와 같은 방식).
  //   T.walkStride = 걷기 그림 한 바퀴 동안 가는 도트 수(config, scaleActors 가 그림 크기에 맞춰 줄임).
  //   바라보는 쪽과 반대로 움직이면(플레이어를 보며 뒤로 물러남) 그림을 거꾸로 넘김. 느려지면(목표 근처·화남) 그림도 그만큼 느려지거나 빨라짐
  var WALK_HOLD_MS = 140;
  Enemy.prototype.stepWalk = function (dtMs) {
    if (this.state !== 'walk') { this.walkHold = 0; this.mvx = this.mvy = 0; return; }
    var d = Math.hypot(this.mvx, this.mvy * 1.6) * dtMs / 1000;   // 위아래로 걸을 때는 화면에서 덜 움직여 보이므로 1.6배(플레이어 depthStrideMul 과 같음)
    var sg = this.mvx * this.dir < 0 ? -1 : 1;
    this.walkPh = ((this.walkPh + sg * d / this.T.walkStride) % 1 + 1) % 1;
    if (this.walkHold > 0) this.walkHold -= dtMs;
  };
  Enemy.prototype.walkIdx = function () {
    var n = this.art[this.T.walkAnim].length;
    return Math.floor(this.walkPh * n) % n;
  };

  // 해적 총잡이(T.ranged, 6단계): 플레이어와 keep 사이 거리에 서서(가까우면 플레이어를 보며 뒤로 물러남, 멀면 다가감) 차례가 되면 쏨.
  //   공격 차례가 alignMs 안으로 남으면 플레이어 줄로 맞춤(그 전엔 yOff 만큼 흩어져 섬 → 늘 같은 줄에서 겨누지 않음)
  //   tooClose 안으로 붙으면 개머리판(bash). 겨누는 총잡이는 maxShooters 까지만(잡몹 공격 차례 maxAttackers 도 같이 따름)
  Enemy.prototype.thinkRanged = function (dt, ctx, dx, dy) {
    var T = this.T, R = T.ranged, p = ctx.player, adx = Math.abs(dx), ady = Math.abs(dy);
    if (this.cool <= 0 && this.entered && this.mayAttack(ctx)) {
      // 9단계 흑마법사: 근접 공격(bash)이 없음 → 붙으면 쏘지도 때리지도 않고 뒤로 물러나기만. 쏘는 공격 이름 = R.attack(없으면 shot)
      if (adx < R.tooClose && ady <= T.alignY && T.attacks.bash) { this.startAttack('bash', ctx); return; }
      var shk = R.attack || 'shot', sh = T.attacks[shk];
      if (adx >= sh.when[0] && adx <= sh.when[1] && ady <= T.alignY && shooters(ctx) < (R.maxShooters || 2)) { this.startAttack(shk, ctx); return; }
    }
    var want = Math.max(R.keep[0], Math.min(R.keep[1], adx));
    var tx = p.x + this.side * want;
    // 뒤가 화면 끝이라 더 물러날 수 없으면 그 자리(붙으면 bash)
    var x0 = ctx.view.x0 + 16 * AS(), x1 = ctx.view.x1 - 16 * AS();
    tx = Math.max(x0, Math.min(x1, tx));   // 들어오기 전에도 화면 안을 목표로(안 그러면 화면 밖에서 거리만 두고 영영 안 들어올 수 있음)
    var ready = this.cool <= (R.alignMs || 0);
    var ty = ready ? p.y : p.y + this.yOff * 1.4;
    ty = Math.max(ctx.world.laneTop, Math.min(ctx.world.laneBottom, ty));
    if (ctx.steer) { var sv = ctx.steer(this, tx, ty); tx = sv.x; ty = sv.y; }
    var mx = tx - this.x, my = ty - this.y;
    var away = Math.sign(mx) === Math.sign(this.x - p.x);   // 플레이어에게서 멀어지는 쪽 = 뒷걸음질(느리게)
    var vx = Math.abs(mx) > 4 ? Math.sign(mx) * T.speedX * (away ? R.backOffMul || 1 : 1) * (this.walkMul || 1) : 0;
    var vy = Math.abs(my) > 2 ? Math.sign(my) * T.speedY * (this.walkMul || 1) : 0;
    var slowD = 14 * AS();
    if (Math.abs(mx) < slowD) vx *= Math.abs(mx) / slowD;
    this.setMove(vx, vy);
    this.x += vx * dt; this.y += vy * dt;
    if (Math.abs(p.x - this.x) > 2) this.dir = p.x > this.x ? 1 : -1;   // 뒷걸음질 때도 플레이어 쪽을 봄
  };
  // 지금 총을 겨누고 있는 잡몹 수 (type = 그 종류만 셈: 7단계 불 도깨비는 도깨비끼리만)
  function shooters(ctx, type) {
    var n = 0;
    ctx.enemies.forEach(function (e) { if (e.state === 'attack' && e.atk && e.atk.spec.type === 'shot' && !e.T.boss && (!type || e.type === type)) n++; });
    return n;
  }

  // 잡몹: 공격 차례가 있는지 (동시에 너무 많이 때리지 않게)
  Enemy.prototype.mayAttack = function (ctx) {
    var AI = this.cfg.ai, n = 0;
    ctx.enemies.forEach(function (e) { if (e.state === 'attack' && !e.T.boss) n++; });
    // 몹 떼(사냥 손맛, main.js makeEnemyCtx): 그 판만 따로 정한 수·간격(ctx.maxAttackers / attackGapMs)이 있으면 그것
    return n < (ctx.maxAttackers || AI.maxAttackers) && ctx.now - (ctx.lastAttackAt || -1e9) > (ctx.attackGapMs || AI.attackGapMs);
  };

  Enemy.prototype.chooseAttack = function (adx, ady, ctx) {
    var T = this.T;
    if (!T.boss) {
      if (!this.mayAttack(ctx)) return null;
      if (!(adx >= T.range[0] && adx <= T.range[1] && ady <= T.alignY)) return null;
      var keys = Object.keys(T.attacks);
      if (keys.length === 1) return keys[0];
      // 공격이 여럿(3단계 도마뱀 찌르기·달려들기): 거리가 when 안인 것 중 무게(weight)로
      //   gapMs = 그 공격을 한 번 쓰면 이 시간 동안은 안 씀(달려들기가 다가올 때마다 나오지 않게)
      //   maxShooters = 던지기(type 'shot')는 같은 종류가 이만큼 이미 던지고 있으면 안 씀, firstMs = 나타나서 처음 쓸 수 있을 때까지(7단계 불 도깨비)
      var self = this, ok = keys.filter(function (k) { var A = T.attacks[k], w = A.when;
        if (A.gapMs && self.clock - (self.usedAt[k] != null ? self.usedAt[k] : (A.firstMs != null ? A.firstMs - A.gapMs : -1e9)) < A.gapMs) return false;
        if (A.type === 'shot' && A.maxShooters && shooters(ctx, self.type) >= A.maxShooters) return false;
        return !w || (adx >= w[0] && adx <= w[1]); }), tot = 0;
      if (!ok.length) return null;
      ok.forEach(function (k) { tot += T.attacks[k].weight || 1; });
      var q = Math.random() * tot;
      for (var j = 0; j < ok.length; j++) { q -= T.attacks[ok[j]].weight || 1; if (q <= 0) return ok[j]; }
      return ok[ok.length - 1];
    }
    // 보스: 거리에 맞는 공격 중 무게(weight)로 고르기
    var opts = [], sum = 0, self = this;
    Object.keys(T.attacks).forEach(function (k) {
      var a = T.attacks[k];
      var yOk = a.type === 'charge' ? ady <= 40 * AS() : (a.type === 'throw' || a.type === 'burrow' || a.type === 'barrage' || a.type === 'dive' || a.type === 'spikes' || a.type === 'teleport') ? true : ady <= T.alignY;   // 바위 던지기·땅속 숨기·대포 사격·날아올라 내리꽂기·얼음 가시 줄·순간이동은 줄 상관없음
      if (a.type === 'burrow' && self.clock - self.lastBurrowAt < (a.gapMs || 0)) return;   // 한 번 숨은 뒤 gapMs 동안은 안 숨음
      // 화염 충격파(9단계 마왕군 장군): 고리는 위아래로 납작함 → 플레이어가 고리 위아래 폭(ryMax)의 1.5배 안 줄에 있을 때만 씀
      if (a.type === 'shockwave') yOk = ady <= a.rings.ryMax * 1.5;
      // 안개 순간이동 물기(8단계 흡혈 백작): 플레이어가 공중·넘어짐·이미 잡힘이면 안 씀
      if (a.type === 'teleport') { var pp = ctx.player; if ((pp.z || 0) > 4 || pp.state === 'down' || pp.state === 'held' || pp.state === 'dead') return; }
      // 그 밖의 gapMs(선장 대포 사격): 한 번 쓰면 이 시간 동안 안 씀. firstMs = 나타난 뒤 처음 쓸 수 있을 때까지
      //   10단계 마왕: 각성 뒤(enraged)에는 enraged.useGapMs 로 더 자주(순간이동)
      if (a.type !== 'burrow' && a.gapMs) {
        var gap = (self.enraged && a.enraged && a.enraged.useGapMs) || a.gapMs;
        var last = self.usedAt[k] != null ? self.usedAt[k] : (a.firstMs != null ? a.firstMs - a.gapMs : -1e9);
        if (self.clock - last < gap) return;
      }
      if (yOk && adx >= a.when[0] && adx <= a.when[1]) { opts.push(k); sum += a.weight; }
    });
    if (!opts.length) return null;
    var r = Math.random() * sum;
    for (var i = 0; i < opts.length; i++) { r -= T.attacks[opts[i]].weight; if (r <= 0) return opts[i]; }
    return opts[opts.length - 1];
  };

  Enemy.prototype.endAttack = function () {
    var T = this.T;
    this.state = 'idle'; this.animT = 0; this.atk = null; this.hidden = false;
    this.cool = randi(T.cooldown);
    if (T.retreatMs) this.retreatT = T.retreatMs;
  };

  Enemy.prototype.tryHitPlayer = function (spec, reach, ctx) {
    if (this.atk.hit) return;
    var p = ctx.player, b = this.attackBox(reach, spec.depth), h = p.hurtbox();
    if (b.x0 < h.x1 && b.x1 > h.x0 && b.y0 < h.y1 && b.y1 > h.y0 && Math.abs(b.z - h.z) <= b.depth) {
      this.atk.hit = true;
      // 미라 잡기: 닿으면 데미지 대신 붙잡음(main.js grabPlayer). 못 잡으면(무적·공중) 헛손질
      if (spec.grab) { if (ctx.grabPlayer && ctx.grabPlayer(this, spec)) { this.atk.held = true; this.atk.holdT = spec.grab.ms; this.atk.heldT = 0; } return; }
      ctx.onPlayerHit(this, spec);
    }
  };

  Enemy.prototype.updateAttack = function (dtMs, ctx) {
    var a = this.atk, spec = a.spec, dt = dtMs / 1000;
    if (a.held) return this.updateHold(dtMs, ctx);   // 미라: 붙잡고 있는 동안은 그림을 멈춤(4장)
    a.t += dtMs;
    if (spec.type === 'charge') return this.updateCharge(dtMs, ctx);
    if (spec.type === 'burrow') return this.updateBurrow(dtMs, ctx);
    if (spec.type === 'leap') return this.updateLeap(dtMs, ctx);
    if (spec.type === 'barrage') return this.updateBarrage(dtMs, ctx);
    if (spec.type === 'dive') return this.updateDive(dtMs, ctx);
    if (spec.type === 'teleport') return this.updateTeleport(dtMs, ctx);
    var fr = this.frameAt(spec.anim, a.t);
    if (fr.done) { this.endAttack(); return; }
    // 불 뿜기(7단계 와이번): 불길 장(active) 동안 tickMs 마다 입 앞 긴 상자 확인 → 처음 닿으면 보통 맞음, 그 뒤엔 타는 데미지(main.js ctx.burnPlayer)
    if (spec.type === 'breath') {
      if (!inList(spec.active, fr.no)) return;
      if (a.fireT == null) { a.fireT = 0; a.tickT = 0; ctx.shake(spec.shake || 0.6); }
      a.fireT += dtMs; a.tickT -= dtMs;
      if (a.tickT <= 0) { a.tickT += spec.tickMs; this.breathTick(spec, ctx); }
      return;
    }
    // 총 쏘기(6단계 총잡이·선장 권총): 겨누는 동안 방향·줄 고정 → spawnFrame 그림에서 총알 하나(main.js ctx.fireShot)
    if (spec.type === 'shot') {
      if (!a.fired && fr.no >= spec.spawnFrame) {
        a.fired = true;
        // 화난 흡혈 백작 박쥐 떼(spec.enraged): count 무리를 lanes 줄마다 gapMs 씩 늦게(양옆은 scale 만큼 작게)
        var EG = this.enraged && spec.enraged;
        if (ctx.fireShot) {
          if (EG) for (var q = 0; q < EG.count; q++) ctx.fireShot(this, spec, { dz: EG.lanes[q] || 0, wait: q * (EG.gapMs || 0), scale: (EG.scale && EG.scale[q]) || 1 });
          else ctx.fireShot(this, spec);
        }
        if (spec.shake && this.T.boss) ctx.shake(spec.shake);
      }
      return;
    }
    // 얼음 가시 줄(5단계 서리 거인): aimMs 동안 플레이어 쪽을 겨눔(줄이 따라감) → 그다음 고정 → spawnFrame 그림(손바닥으로 땅 침)에서
    //   가시 자리들을 main.js ctx.spikeLine 에 넘김(가시마다 delayMs 씩 늦게 솟음)
    if (spec.type === 'spikes') {
      if (a.t <= spec.aimMs || !a.pts) { a.pts = this.spikePoints(spec, ctx); if (a.t <= spec.aimMs && Math.abs(ctx.player.x - this.x) > 4) this.dir = ctx.player.x > this.x ? 1 : -1; }
      if (!a.fired && fr.no >= spec.spawnFrame) {
        a.fired = true; ctx.shake(spec.shake || 1);
        if (ctx.spikeLine) ctx.spikeLine(this, spec, a.pts);
      }
      return;
    }
    // 화염 충격파(9단계 마왕군 장군): spawnFrame(3장 칼을 발 앞에 꽂음)에서 꽂은 자리(spawn)를 가운데로 불꽃 고리 rings.count 개(화나면 enraged.count, gapMs 씩 늦게, main.js ctx.shockwave)
    //   → holdFrame(4장 무릎 꿇고 칼 짚음)에서 고리가 거의 다 퍼질 때까지 멈춤(그동안 = 고리를 넘은 플레이어가 때릴 기회) → 5장 칼 뽑음
    if (spec.type === 'shockwave') {
      // 2026-11-06 기 모으기(디아블로처럼): 꽂기 전까지 가볍게 땅이 울림(점점 세게). 그림은 draw 의 drawCharge
      if (!a.fired) { a.rumT = (a.rumT || 0) - dtMs; if (a.rumT <= 0) { a.rumT = 120; ctx.shake(0.15 + 0.35 * Math.max(0, this.chargeK())); } }
      if (!a.fired && fr.no >= spec.spawnFrame) {
        a.fired = true; ctx.shake(spec.shake || 1);
        this.releaseFx(this.x + this.dir * spec.spawn.x, this.y);   // 꽂는 순간 번쩍 + 빛기둥(우리 그림 demon_release)
        var RG = spec.rings, cnt = (this.enraged && spec.enraged && spec.enraged.count) || RG.count;
        if (ctx.shockwave) ctx.shockwave(this, spec, this.x + this.dir * spec.spawn.x, this.y, cnt);
        if (ctx.debris) ctx.debris(this.x + this.dir * spec.spawn.x, this.y, 10, ['#ffd060', '#ff8a2a', '#3a2a2a', '#5a4a44']);   // 돌 조각 + 불씨
        a.holdLeft = (cnt - 1) * RG.gapMs + (RG.rMax - RG.r0) / RG.speed * 1000 * 0.5;   // 마지막 고리가 반쯤 퍼질 때까지
      }
      if (a.fired && fr.no === spec.holdFrame && a.holdLeft > 0) {   // 4장에 들어선 그 시각에 멈춰 둠(4장 그대로 보임)
        if (a.holdAt == null) a.holdAt = a.t;
        a.holdLeft -= dtMs; a.t = a.holdAt;
      }
      return;
    }
    // 바위 던지기: 던지기 전까지 플레이어 자리를 겨눔(앞쪽, maxRange 까지) → spawnFrame 그림에서 그 자리로 던짐(main.js ctx.throwRock)
    if (spec.type === 'throw') {
      if (!a.thrown) {
        var p = ctx.player, ax = p.x, minF = 40 * AS();
        if ((ax - this.x) * this.dir < minF) ax = this.x + this.dir * minF;
        ax = this.x + this.dir * Math.min(spec.maxRange, Math.abs(ax - this.x));
        a.aimX = ax; a.aimY = p.y;
        if (fr.no >= spec.spawnFrame) { a.thrown = true; ctx.throwRock(this, spec, a.aimX, a.aimY); }
      }
      return;
    }
    // 공격 중 앞으로 이동(늑대 도약): 그 그림들이 보이는 시간 동안 dist 만큼 고르게
    if (spec.move && inList(spec.move.frames, fr.no)) {
      var pb = this.T.anims[spec.anim].playback, cnt = 0;
      pb.forEach(function (n) { if (inList(spec.move.frames, n)) cnt++; });
      var sp = spec.move.dist / (cnt * fr.step / 1000);
      this.x += this.dir * sp * dt; a.moved += sp * dt;
    }
    // multiHit = 판정 장마다 따로 한 번씩 맞을 수 있음(선장 칼 두 번: 2장 대각선 · 3장 가로)
    if (spec.multiHit && inList(spec.active, fr.no) && a.hitNo !== fr.no) { a.hitNo = fr.no; a.hit = false; }
    // reachF = 장마다 다른 판정 상자(전갈 집게: 3장 멀리 → 4장 가까이 조임)
    //   heavyOn = 이 장의 타만 무거움(넘어짐, 흔들림 heavyShake) — 10단계 마왕 대검 세 번째(땅에 꽂음)
    if (inList(spec.active, fr.no)) {
      var hs = spec;
      if (spec.heavyOn && inList(spec.heavyOn, fr.no)) hs = spec._heavy || (spec._heavy = Object.assign({}, spec, { heavy: true, shake: spec.heavyShake || spec.shake }));
      this.tryHitPlayer(hs, (spec.reachF && spec.reachF[fr.no]) || spec.reach, ctx);
    }
    // 땅을 찍는 순간 화면 흔들림 (보스)
    if (spec.shake && !a.shook && fr.no === spec.active[spec.active.length - 1]) {
      a.shook = true; ctx.shake(spec.shake);
      if (spec.burst && ctx.burst) ctx.burst(this, this.x + this.dir * spec.burst.x, this.y, spec.burst.scale, spec.burst);   // 골렘 내려찍기: 주먹 자리에 바위 터짐(서리 거인: 얼음 가시)
    }
  };

  // 얼음 가시 자리: 거인 발(기준점)에서 플레이어 쪽(가로·위아래 = 걷는 길 위) 방향으로 first + i x step 도트마다, maxRange 까지.
  //   플레이어가 바로 앞(가로 30 안)이면 바라보는 쪽 앞으로 곧게. 위아래는 걷는 길 안, 가로는 화면 안에서 멈춤
  Enemy.prototype.spikePoints = function (s, ctx) {
    var p = ctx.player, w = ctx.world, dx = p.x - this.x, dy = p.y - this.y, out = [];
    if (dx * this.dir < 30 * AS()) { dx = this.dir * Math.max(30 * AS(), Math.abs(dx)); }
    var d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    var x0 = ctx.view.x0 + 8 * AS(), x1 = ctx.view.x1 - 8 * AS();
    for (var i = 0; i < s.count; i++) {
      var r = s.first + i * s.step;
      if (r > s.maxRange) break;
      var x = this.x + ux * r, y = this.y + uy * r;
      if (x < x0 || x > x1) break;
      out.push({ x: x, y: Math.max(w.laneTop, Math.min(w.laneBottom, y)) });
    }
    return out;
  };

  // 미라 잡기: 붙잡은 동안(holdT) 그림 멈춤. 플레이어가 버튼을 누를 때마다(ctx.grabMash) mashMs 만큼 빨리 풀림(그래도 minMs 는 잡혀 있음)
  //   다 되면 놓으면서 데미지 + 내던짐(ctx.releaseGrab) → 남은 그림(5장 복귀)부터 이어서
  Enemy.prototype.updateHold = function (dtMs, ctx) {
    var a = this.atk, G = a.spec.grab, p = ctx.player;
    a.heldT += dtMs; a.holdT -= dtMs;
    var n = ctx.grabMash ? ctx.grabMash() : 0;
    if (n) a.holdT -= n * G.mashMs;
    if (p.state !== 'held' || p.heldBy !== this) { a.held = false; this.endAttack(); return; }   // 어쩌다 풀려 버림
    // 피 빨기(8단계 흡혈 백작 drain): 잡고 있는 동안 everyMs 마다 플레이어 체력을 빨고 자기 체력을 채움(main.js ctx.drainPlayer)
    var D = a.spec.drain;
    if (D) { a.drainT = (a.drainT || 0) + dtMs; while (a.drainT >= D.everyMs) { a.drainT -= D.everyMs; if (ctx.drainPlayer) ctx.drainPlayer(this, a.spec); } }
    if (a.holdT <= 0 && a.heldT >= G.minMs) {
      a.held = false;
      if (ctx.releaseGrab) ctx.releaseGrab(this, a.spec);
      if (a.spec.type === 'teleport') { a.phase = 'recover'; a.t = 0; return; }   // 흡혈 백작: 물기 3장 자세로 잠깐 → 끝
      var A = this.T.anims[a.spec.anim], k = A.playback.indexOf(G.holdFrame + 1);
      a.t = (k < 0 ? A.playback.length : k) * 1000 / A.fps;   // 다음 장(5 복귀)부터
    }
  };

  // 전갈 왕 땅속 숨기: dig(burrow 그림, 3장부터 무적) → mound(안 보임, 모래 둔덕이 플레이어를 쫓아감) → warn(둔덕 떨림 + 빨간 원)
  //   → erupt(그 자리에서 솟구침, 1~2장 판정) → 끝. 둔덕 = 이 적의 x, y 그대로(땅속에서 움직임)
  Enemy.prototype.updateBurrow = function (dtMs, ctx) {
    var a = this.atk, s = a.spec, dt = dtMs / 1000, p = ctx.player, fr;
    if (a.phase === 'wind') { a.phase = 'dig'; a.t = dtMs; if (Math.abs(p.x - this.x) > 4) this.dir = p.x > this.x ? 1 : -1; }
    if (a.phase === 'dig') {
      fr = this.frameAt(s.anim, a.t);
      if (fr.done) {
        a.phase = 'mound'; a.t = 0; this.hidden = true; this.lastBurrowAt = this.clock;
        ctx.dust(this.x, this.y, this.dir);
      }
      return;
    }
    if (a.phase === 'mound') {
      var dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy), sp = s.speed * this.speedMul() * dt;
      if (d > 0.5) { this.x += dx / d * Math.min(d, sp); this.y += dy / d * Math.min(d, sp); }
      if (Math.abs(dx) > 2) this.dir = dx > 0 ? 1 : -1;
      a.dustT -= dtMs;
      if (a.dustT <= 0) { a.dustT = 260; ctx.dust(this.x - this.dir * 20 * AS(), this.y, this.dir); }
      if ((Math.abs(dx) <= s.catchR && Math.abs(dy) <= s.catchR) || a.t >= s.maxMs || p.state === 'dead') {
        a.phase = 'warn'; a.t = 0; a.tx = p.x; a.ty = p.y; a.fx = this.x; a.fy = this.y;   // 플레이어가 있던 자리에서 솟구침
      }
      return;
    }
    if (a.phase === 'warn') {
      var u = Math.min(1, a.t / 150);   // 둔덕이 그 자리로 마저 미끄러져 감
      this.x = a.fx + (a.tx - a.fx) * u; this.y = a.fy + (a.ty - a.fy) * u;
      if (a.t >= s.warnMs) {
        a.phase = 'erupt'; a.t = 0; this.hidden = false; this.x = a.tx; this.y = a.ty;
        if (Math.abs(p.x - this.x) > 4) this.dir = p.x > this.x ? 1 : -1;
        ctx.shake(s.shake * 0.5); ctx.dust(this.x, this.y, this.dir); ctx.dust(this.x, this.y, -this.dir);
      }
      return;
    }
    // erupt: 1~2장 판정(앞뒤 다 맞음), 2장에서 크게 흔들림
    fr = this.frameAt(s.eruptAnim, a.t);
    if (fr.done) { this.endAttack(); return; }
    if (inList(s.active, fr.no)) this.tryHitPlayer(s, s.reach, ctx);
    if (!a.shook && fr.no === s.active[s.active.length - 1]) { a.shook = true; ctx.shake(s.shake); }
  };

  // 두꺼비 배치기(leap): 예고 그림(1장) 동안 플레이어 자리를 겨눔(그 자리 = 빨간 원 가운데, 플레이어가 몸 앞 aimAt 에 오게 떨어질 곳을 정함, 최대 max)
  //   → 공중 그림(2·3장)이 보이는 동안 그 자리로 날아감(안 맞음) → 4장 배로 쿵: 판정 + 크게 흔들림 + 양쪽 먼지 + 흙탕물 → 5장 복귀
  Enemy.prototype.updateLeap = function (dtMs, ctx) {
    var a = this.atk, s = a.spec, L = s.leap, p = ctx.player;
    var A = this.T.anims[s.anim], step = 1000 / A.fps, pb = A.playback;
    var fr = this.frameAt(s.anim, a.t);
    if (fr.done) { this.endAttack(); return; }
    var i0 = pb.indexOf(L.frames[0]), n = 0;
    pb.forEach(function (k) { if (inList(L.frames, k)) n++; });
    var upAt = i0 * step, airMs = n * step;
    if (a.t < upAt) {   // 겨누기: 플레이어 쪽을 보고, 떨어질 자리를 계속 맞춤
      if (Math.abs(p.x - this.x) > 4) this.dir = p.x > this.x ? 1 : -1;
      var d = Math.max(0, Math.min(L.max, (p.x - this.x) * this.dir - L.aimAt));
      a.lx = this.x + this.dir * d; a.ly = Math.max(ctx.world.laneTop, Math.min(ctx.world.laneBottom, p.y));
      a.rx = a.lx + this.dir * (s.reach.x0 + s.reach.x1) / 2;   // 빨간 원 가운데 = 판정 상자 가운데
      return;
    }
    if (!a.jumped) { a.jumped = true; a.sx = this.x; a.sy = this.y; ctx.dust(this.x, this.y, -this.dir); }
    if (a.t < upAt + airMs) {   // 공중: 고르게 날아감(끝으로 갈수록 살짝 빨리 = 내리꽂힘)
      var u = (a.t - upAt) / airMs; u = u * u * 0.4 + u * 0.6;
      this.x = a.sx + (a.lx - a.sx) * u; this.y = a.sy + (a.ly - a.sy) * u;
      return;
    }
    if (!a.landed) {
      a.landed = true; this.x = a.lx; this.y = a.ly;
      ctx.shake(s.shake); ctx.dust(this.x - this.dir * 30 * AS(), this.y, -this.dir); ctx.dust(this.x + this.dir * 60 * AS(), this.y, this.dir);
      if (ctx.debris) ctx.debris(a.rx, this.y, 12, ['#5a4a2e', '#7a6a3e', '#4a5a2e', '#9aa86a']);   // 흙탕물 튐
    }
    // 판정은 쿵 한 순간(hitMs)만: 엎드려 있는 동안 걸어 들어온 플레이어까지 맞히지 않게
    if (inList(s.active, fr.no) && a.t - upAt - airMs <= (s.hitMs || 160)) this.tryHitPlayer(s, s.reach, ctx);
  };

  // 선장 대포 일제 사격(barrage): 1~3장 호령(예고) → spawnFrame(4장)부터 intervalMs 마다 대포알 하나(main.js ctx.dropCannon, 떨어질 자리 = 그때 플레이어 자리)
  //   첫 알 = 발밑 그대로, 다음부터 spread 만큼 흩어서. 다 떨어뜨리고 holdMs 지나면 끝(그동안 마지막 장 5 = 가리키는 자세 그대로)
  Enemy.prototype.updateBarrage = function (dtMs, ctx) {
    var a = this.atk, s = a.spec, p = ctx.player, w = ctx.world;
    var fr = this.frameAt(s.anim, a.t);
    if (fr.no < s.spawnFrame && !fr.done) return;
    // 10단계 마왕 구슬 비: 각성 뒤(enraged)에는 enraged 의 count·intervalMs
    var EB = this.enraged && s.enraged, cnt = (EB && EB.count) || s.count, iv = (EB && EB.intervalMs) || s.intervalMs;
    if (a.dropped == null) { a.dropped = 0; a.dropT = 0; ctx.shake(s.shake * 0.4); }
    a.dropT -= dtMs;
    while (a.dropped < cnt && a.dropT <= 0) {
      var tx = p.x, ty = p.y;
      if (a.dropped > 0) { tx += rand(-s.spread.x, s.spread.x); ty += rand(-s.spread.y, s.spread.y); }
      tx = Math.max(ctx.view.x0 + 10 * AS(), Math.min(ctx.view.x1 - 10 * AS(), tx));
      ty = Math.max(w.laneTop, Math.min(w.laneBottom, ty));
      if (ctx.dropCannon && p.state !== 'dead') ctx.dropCannon(this, s, tx, ty);
      a.dropped++; a.dropT += iv; a.lastDrop = a.t;
    }
    if (fr.done && a.dropped >= cnt && a.t - a.lastDrop >= (s.holdMs || 0)) this.endAttack();
  };

  // 불 뿜기 한 번 확인: 상자(reach, 위아래 depth)에 플레이어 몸이 닿으면 → 맞을 수 있으면 보통 맞음(onPlayerHit),
  //   맞은 뒤 깜빡임(무적) 중이면 타는 데미지(burnPlayer: 작게, 체력 1 아래로는 안 내려감)
  Enemy.prototype.breathTick = function (spec, ctx) {
    var p = ctx.player, b = this.attackBox(spec.reach, spec.depth), h = p.hurtbox();
    if (!(b.x0 < h.x1 && b.x1 > h.x0 && b.y0 < h.y1 && b.y1 > h.y0 && Math.abs(b.z - h.z) <= b.depth)) return;
    if (ctx.onPlayerHit(this, spec)) { this.atk.hit = true; return; }
    if (ctx.burnPlayer) ctx.burnPlayer(this, spec);
  };

  // 와이번 날아올라 내리꽂기(dive): takeoff(fly 1장 예고 → 2·3장 떠오름 z 0→높이) → hover(fly 4·5장, 플레이어 쪽으로 날아감, 최대 maxMs)
  //   → warn(그 자리에 멈춰 빨간 원이 진해짐) → fall(dive 1장, z 높이→0) → slam(dive 2장 쾅: 판정 한 번 + 크게 흔들림 + 양쪽 먼지·돌)
  //   → recover(dive 3장) → 끝. a.z = 지금 높이(그림·몸 판정·그림자 크기)
  Enemy.prototype.updateDive = function (dtMs, ctx) {
    var a = this.atk, s = a.spec, dt = dtMs / 1000, p = ctx.player, HV = s.hover, w = ctx.world;
    if (a.phase === 'wind') { a.phase = 'takeoff'; a.t = dtMs; a.z = 0; if (Math.abs(p.x - this.x) > 4) this.dir = p.x > this.x ? 1 : -1; }
    if (a.phase === 'takeoff') {
      var t0 = s.takeoffMs[0], up = s.takeoffMs[1] + s.takeoffMs[2];
      if (a.t >= t0) {
        if (!a.lifted) { a.lifted = true; ctx.dust(this.x - 30 * AS(), this.y, -1); ctx.dust(this.x + 30 * AS(), this.y, 1); ctx.shake(0.8); }
        var u = Math.min(1, (a.t - t0) / up);
        a.z = s.z * (1 - (1 - u) * (1 - u));   // 처음 빠르게 → 위에서 느리게
      }
      if (a.t >= t0 + up) { a.phase = 'hover'; a.t = 0; a.z = s.z; }
      return;
    }
    if (a.phase === 'hover') {
      var dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy), sp = HV.speed * this.speedMul() * dt;
      if (p.state !== 'dead' && d > 0.5) { this.x += dx / d * Math.min(d, sp); this.y += dy / d * Math.min(d, sp); }
      this.y = Math.max(w.laneTop, Math.min(w.laneBottom, this.y));
      if (Math.abs(dx) > 2) this.dir = dx > 0 ? 1 : -1;
      a.z = s.z + Math.sin(a.t / 140) * 2 * AS();   // 날갯짓에 맞춰 살짝 오르내림
      if ((Math.abs(dx) <= HV.catchR && Math.abs(dy) <= HV.catchR) || a.t >= HV.maxMs || p.state === 'dead') { a.phase = 'warn'; a.t = 0; a.tx = this.x; a.ty = this.y; }
      return;
    }
    if (a.phase === 'warn') {
      a.z = s.z + Math.sin(a.t / 70) * 1.5 * AS();
      if (a.t >= s.warnMs) { a.phase = 'fall'; a.t = 0; }
      return;
    }
    if (a.phase === 'fall') {
      var f = Math.min(1, a.t / s.fallMs);
      a.z = s.z * (1 - f * f);   // 점점 빨리
      if (a.t >= s.fallMs) {
        a.phase = 'slam'; a.t = 0; a.z = 0;
        ctx.shake(s.shake); ctx.dust(this.x - 40 * AS(), this.y, -1); ctx.dust(this.x + 40 * AS(), this.y, 1);
        if (ctx.debris) ctx.debris(this.x, this.y, 14, ['#3a2a2a', '#5a4a44', '#ff8a2a', '#ffd060', '#2a2224']);   // 현무암 조각 + 불씨
        // 판정 한 번: 가로 radius · 위아래 depth 안 + 높이 dodgeZ 아래(점프로 피함)
        if (p.state !== 'dead' && Math.abs(p.x - this.x) <= s.radius && Math.abs(p.y - this.y) <= s.depth && (p.z || 0) <= s.dodgeZ) {
          a.hit = true; ctx.onPlayerHit(this, s);
        }
      }
      return;
    }
    if (a.phase === 'slam') { if (a.t >= s.slamMs) { a.phase = 'recover'; a.t = 0; } return; }
    if (a.t >= s.recoverMs) this.endAttack();
  };

  // 흡혈 백작 안개 순간이동 물기(teleport, 8단계): vanish(망토로 감쌈 → 연기로 흩어짐, invuln 장부터 안 맞음) → hidden(안 보임, 옛 자리에 안개 퍼짐, hiddenMs)
  //   → 자리 고름 = 플레이어 등 뒤 behind(바라보는 반대쪽. 화면 밖이면 앞쪽), 같은 줄, 플레이어 쪽을 봄 → gather(그 자리에 안개가 모임 + 바닥 빨간 원, gatherMs. 자리 고정)
  //   → appear(1 빚어짐 = 안 맞음 · 2 덤빔 = lunge 만큼 앞으로) → bite 1장 잡기 한 번(reach, 미라 잡기와 같은 tryHitPlayer → grabPlayer)
  //   → 잡으면 updateHold(피 빨기 drain, 연타로 빨리 풀림 → 놓으면서 내던짐 → recover) / 못 잡으면 miss(헛물기 missMs = 때릴 기회) → 끝
  //   숨어 있는 동안도 state = 'attack' → main.js 막힘 지킴이(rescueStuck)가 옮기지 않음
  Enemy.prototype.updateTeleport = function (dtMs, ctx) {
    var a = this.atk, s = a.spec, p = ctx.player, w = ctx.world, fr;
    if (a.phase === 'wind') { a.phase = 'vanish'; a.t = dtMs; if (Math.abs(p.x - this.x) > 4) this.dir = p.x > this.x ? 1 : -1; }
    if (a.phase === 'vanish') {
      fr = this.frameAt(s.anim, a.t);
      if (!a.puffed && fr.no >= s.invuln[0]) { a.puffed = true; if (ctx.mist) ctx.mist(this, this.x, this.y); }   // 연기로 흩어지기 시작: 옛 자리에 안개
      if (fr.done) { a.phase = 'hidden'; a.t = 0; this.hidden = true; }
      return;
    }
    if (a.phase === 'hidden') {
      if (a.t < s.hiddenMs) return;
      var V = ctx.view, m = 30 * AS(), face = p.dir || 1, x = p.x - face * s.behind;
      if (x < V.x0 + m || x > V.x1 - m) x = p.x + face * s.behind;   // 등 뒤가 화면 끝 밖이면 앞쪽에서
      this.x = Math.max(V.x0 + m, Math.min(V.x1 - m, x));
      this.y = Math.max(w.laneTop, Math.min(w.laneBottom, p.y));
      this.dir = p.x >= this.x ? 1 : -1;
      this.vx = 0;
      a.phase = 'gather'; a.t = 0;
      return;
    }
    if (a.phase === 'gather') {   // 안개가 모임(예고): 자리는 고정
      if (a.t >= s.gatherMs) { a.phase = 'appear'; a.t = 0; this.hidden = false; if (ctx.mist) ctx.mist(this, this.x, this.y); }
      return;
    }
    //   10단계 마왕(then): appear 가 끝나면 물기 대신 then 공격(대검 세 번)을 thenFrame 그림부터 이어서(appear 2장 = 칼 치켜든 예고)
    if (a.phase === 'appear' && s.then && this.frameAt(s.appearAnim, a.t).done) {
      this.startAttack(s.then, ctx);
      var TA = this.T.anims[this.atk.spec.anim], k0 = TA.playback.indexOf(s.thenFrame || 1);
      this.atk.t = Math.max(0, k0) * 1000 / TA.fps;
      return;
    }
    if (a.phase === 'appear') {
      fr = this.frameAt(s.appearAnim, a.t);
      if (fr.no === 2 && s.lunge) {   // 덤빔: 2장이 보이는 동안 lunge 만큼 고르게 앞으로
        var A = this.T.anims[s.appearAnim], n2 = A.playback.filter(function (k) { return k === 2; }).length;
        this.x += this.dir * s.lunge * dtMs / (n2 * fr.step);
      }
      if (fr.done) { a.phase = 'bite'; a.t = 0; }
      return;
    }
    if (a.phase === 'bite') {     // 물기 1장: 잡기 한 번. 잡으면 다음 장면부터 updateHold
      if (!a.tried) { a.tried = true; this.tryHitPlayer(s, s.reach, ctx); if (!a.held) { a.phase = 'miss'; a.t = 0; } }
      return;
    }
    if (a.phase === 'miss') { if (a.t >= s.missMs) this.endAttack(); return; }
    if (a.t >= 380) this.endAttack();   // recover: 놓은 뒤 물기 3장 자세로 잠깐
  };

  // 오크 어깨 돌진: 웅크림(예고) → 돌진(미끄러짐 + 먼지) → 부딪힘 → 복귀
  Enemy.prototype.updateCharge = function (dtMs, ctx) {
    var a = this.atk, s = a.spec, dt = dtMs / 1000, p = ctx.player;
    if (a.phase === 'wind') {
      // 예고 동안 플레이어 줄로 천천히 맞추고 방향 고정
      var dy = p.y - this.y;
      this.y += Math.sign(dy) * Math.min(Math.abs(dy), this.T.speedY * 1.6 * dt);
      if (Math.abs(p.x - this.x) > 4) this.dir = p.x > this.x ? 1 : -1;
      if (a.t >= s.windMs + s.stepMs) { a.phase = 'run'; a.t = 0; a.ran = 0; }
      return;
    }
    if (a.phase === 'run') {
      var step = s.speed * dt * this.speedMul();
      this.x += this.dir * step; a.ran += step;
      a.dustT -= dtMs;
      if (a.dustT <= 0) { a.dustT = s.dustMs; ctx.dust(this.x - this.dir * 34 * AS(), this.y, this.dir); }
      this.tryHitPlayer(s, s.bodyReach, ctx);
      var wallD = 40 * AS(), edge = this.dir > 0 ? this.x >= ctx.view.x1 - wallD : this.x <= ctx.view.x0 + wallD;
      if (a.ran >= s.dist || edge) { a.phase = 'impact'; a.t = 0; a.wall = edge; ctx.shake(s.shake * 0.6); ctx.dust(this.x + this.dir * 30 * AS(), this.y, this.dir); }
      return;
    }
    if (a.phase === 'impact') {
      this.x += this.dir * 40 * AS() * dt;
      this.tryHitPlayer(s, s.reach, ctx);
      if (a.t >= s.impactMs) {
        // 헛치고 벽(화면 끝)에 박혔으면 휘청 = 때릴 기회
        var S = this.T.stagger;
        if (a.wall && !a.hit && S && S.onWall && this.hasAnim('stagger')) { this.startStagger(); this.cool = randi(this.T.cooldown); return; }
        a.phase = 'recover'; a.t = 0;
      }
      return;
    }
    if (a.t >= s.recoverMs) this.endAttack();
  };

  // 지금 보여줄 그림
  Enemy.prototype.currentImg = function () {
    var T = this.T;
    if (this.state === 'dead') return this.deadImg || this.frameAt('death', this.deadT).img;
    if (this.state === 'awaken') return this.frameAt(T.awaken.anim, this.awT).img;   // 10단계 마왕 각성
    if (this.state === 'hit') return this.frameAt(this.hitAnim, this.animT).img;
    if (this.state === 'air') { var KA = this.art.knockdown; return KA[this.avz > 0 ? 0 : Math.min(1, KA.length - 1)]; }   // 띄워짐: 오를 때 넘어짐 1장(날아감), 떨어질 때 2장
    if (this.state === 'guard') { var gi = this.art[T.guard.anim]; return gi[this.guardFlash > 0 && gi[1] ? 1 : 0]; }   // 방패 들기(1) / 막는 순간(2)
    if (this.state === 'down') {
      var DT = this.downTimes();
      if (this.downT < DT.kd + DT.lying) return this.frameAt('knockdown', this.downT).img;   // 마지막 장(누움)에서 멈춤
      return this.frameAt('getup', this.downT - DT.kd - DT.lying).img;
    }
    if (this.state === 'stagger') return this.art.stagger[this.staggerIdx()];
    if (this.state === 'attack') {
      var a = this.atk, s = a.spec, imgs = this.art[s.anim];
      if (s.type === 'charge') {
        // 9단계 마왕군 장군: frames = 그림 번호 지도(1 웅크림 / 2·3 달리며 찌름 반복 / 4 미끄러지며 멈춤 / 5 복귀). 없으면 오크(1·2 / 3·4 / 5)
        var CF = s.frames;
        if (CF) {
          if (a.phase === 'wind') return imgs[CF.wind[Math.min(CF.wind.length - 1, a.t < s.windMs ? 0 : 1)] - 1];
          if (a.phase === 'run') return imgs[CF.run[Math.floor(a.t / s.stepMs) % CF.run.length] - 1];
          if (a.phase === 'impact') return imgs[CF.impact[0] - 1];
          return imgs[CF.recover[0] - 1];
        }
        if (a.phase === 'wind') return imgs[a.t < s.windMs ? 0 : 1];
        if (a.phase === 'run') return imgs[2 + (Math.floor(a.t / s.stepMs) % 2)];
        if (a.phase === 'impact') return imgs[4];
        return imgs[0];
      }
      if (s.type === 'teleport') {   // 흡혈 백작: vanish → (숨음 = 안 그림) → appear → bite 1(잡기·헛물기) / 잡고 있는 동안 bite 2·3 반복(피 빨기) / 놓은 뒤 3
        var bt = this.art[s.biteAnim];
        if (a.held) return bt[[1, 1, 2, 2, 2, 2][Math.floor(a.heldT / 125) % 6]];
        if (a.phase === 'wind' || a.phase === 'vanish') return this.frameAt(s.anim, a.t).img;
        if (a.phase === 'appear') return this.frameAt(s.appearAnim, a.t).img;
        if (a.phase === 'bite' || a.phase === 'miss') return bt[0];
        if (a.phase === 'recover') return bt[2];
        return null;
      }
      if (a.held) return imgs[s.grab.holdFrame - 1] || imgs[imgs.length - 1];   // 미라: 붙잡고 있는 동안(움켜쥔 손)
      if (s.type === 'dive') {   // 와이번: fly 1→2→3(떠오름) → 4·5 반복(맴돌기) / dive 1(떨어짐) · 2(쾅) · 3(일어남)
        var dv = this.art[s.diveAnim];
        if (a.phase === 'wind') return imgs[0];
        if (a.phase === 'takeoff') { var tm = s.takeoffMs; return imgs[a.t < tm[0] ? 0 : a.t < tm[0] + tm[1] ? 1 : 2]; }
        if (a.phase === 'hover' || a.phase === 'warn') return imgs[3 + Math.floor(this.clock * s.hover.fps / 1000) % 2];
        return dv[a.phase === 'fall' ? 0 : a.phase === 'slam' ? 1 : 2];
      }
      if (s.type === 'burrow') {
        if (a.phase === 'erupt') return this.frameAt(s.eruptAnim, a.t).img;
        if (a.phase === 'dig' || a.phase === 'wind') return this.frameAt(s.anim, a.t).img;
        return null;   // 땅속: 몸 대신 모래 둔덕(drawMound)
      }
      return this.frameAt(s.anim, a.t).img;
    }
    if (this.state === 'walk') return T.walkStride ? this.art[T.walkAnim][this.walkIdx()] : this.frameAt(T.walkAnim, this.animT).img;
    if (this.asleep && this.pose !== 'idle' && this.hasAnim(this.pose)) return this.frameAt(this.pose, this.animT).img;   // 쉬는 그림(있을 때만)
    return this.frameAt('idle', this.animT).img;
  };

  // 휘청 그림 번호(0부터): stagger.d 의 장마다 시간으로
  Enemy.prototype.staggerIdx = function () {
    var d = this.T.stagger.d, t = this.stagT, i = 0;
    while (i < d.length - 1 && t >= d[i]) { t -= d[i]; i++; }
    return i;
  };

  // 화면 밖으로 못 나감(들어온 뒤로)
  Enemy.prototype.keepInView = function (ctx) {
    var w = ctx.world;
    var x0 = ctx.view.x0 + 12 * AS(), x1 = ctx.view.x1 - 12 * AS();
    // 들어오기 전이라도 화면에 보여 맞았으면(hitOut, 마법탄·검기 등) 들어온 것으로 → 아래에서 띠 안으로 당김(밀려서 버튼 밑에 남지 않게)
    if (!this.entered && ((this.x > x0 && this.x < x1) || this.hitOut)) this.entered = true;
    if (this.entered) this.x = Math.max(x0, Math.min(x1, this.x));
    this.y = Math.max(w.laneTop, Math.min(w.laneBottom, this.y));
  };

  // 바닥 빨간 원(바위 떨어질 자리): x, y = 바닥 가운데, rx = 가로 반지름, ry = 위아래 반지름, k = 0~1(다 와 갈수록 진하게), faint = 겨누는 중(옅게)
  function drawRing(g, camX, x, y, rx, ry, k, faint) {
    var blink = Math.floor(performance.now() / 90) % 2, cx = x - camX;
    g.save();
    g.fillStyle = 'rgba(255,40,30,' + ((faint ? 0.08 : 0.16 + 0.24 * Math.min(1, k)) + (blink && !faint ? 0.08 : 0)) + ')';
    g.beginPath(); g.ellipse(cx, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = faint ? 'rgba(255,90,60,0.45)' : 'rgba(255,90,60,0.9)'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(cx, y, rx, ry, 0, 0, Math.PI * 2); g.stroke();
    if (!faint) {   // 가운데로 좁혀 드는 안쪽 원 = 곧 떨어짐
      var u = Math.max(0.1, 1 - Math.min(1, k));
      g.beginPath(); g.ellipse(cx, y, rx * u, ry * u, 0, 0, Math.PI * 2); g.stroke();
    }
    g.restore();
  }
  Enemy.drawRing = drawRing;

  // 바닥 예고 표시(빨간 띠): 보스 공격 예고 장면 동안
  Enemy.prototype.drawTelegraph = function (g, camX) {
    if (this.state !== 'attack') return;
    var a = this.atk, s = a.spec, r = null, k = 0;
    if (s.type === 'throw') {   // 바위 던지기: 던지기 전까지 겨누는 자리(옅은 원, 플레이어를 따라감). 던진 뒤는 main.js 가 떨어질 자리를 그림
      if (!a.thrown && a.aimX != null) drawRing(g, camX, a.aimX, a.aimY, s.radius, Math.max(s.depth, s.radius * 0.34), 0, true);
      return;
    }
    if (s.type === 'burrow') {   // 땅속 숨기: 둔덕이 멈춘 뒤 솟구칠 자리(플레이어가 있던 곳)
      if (a.phase === 'warn') drawRing(g, camX, a.tx, a.ty, s.radius, s.depth, a.t / s.warnMs, false);
      return;
    }
    if (s.type === 'leap') {     // 배치기: 떨어질 자리(겨누는 동안 플레이어를 따라감 → 뛴 뒤엔 고정) ~ 쿵 할 때까지
      var LA = this.T.anims[s.anim], landMs = LA.playback.indexOf(s.active[0]) * 1000 / LA.fps;
      if (a.rx != null && a.t < landMs) drawRing(g, camX, a.rx, a.ly, (s.reach.x1 - s.reach.x0) / 2, s.depth, a.t / landMs, false);
      return;
    }
    if (s.type === 'shot') { this.drawAim(g, camX); return; }   // 총: 겨누는 동안 빨간 겨눔 선
    if (s.type === 'barrage') return;                            // 대포 사격: 떨어질 자리는 main.js 가 그림(그림자 + 빨간 원)
    if (s.type === 'shockwave') {   // 화염 충격파: 칼을 꽂기 전까지 꽂을 자리 둘레에 고리가 닿는 끝(rMax)까지 빨간 원이 진해짐 → 그 밖 = 안전
      if (a.fired) return;
      var WA = this.T.anims[s.anim], plantMs = WA.playback.indexOf(s.spawnFrame) * 1000 / WA.fps;
      drawRing(g, camX, this.x + this.dir * s.spawn.x, this.y, s.rings.rMax, s.rings.ryMax, a.t / plantMs, false);
      return;
    }
    if (s.type === 'spikes') {   // 얼음 가시 줄: 땅을 치기 전까지 가시 나올 자리마다 빨간 원(겨누는 동안 옅게 따라감 → 고정되면 진하게)
      if (a.fired || !a.pts) return;
      var SA = this.T.anims[s.anim], hitMs = SA.playback.indexOf(s.spawnFrame) * 1000 / SA.fps, aiming = a.t <= s.aimMs;
      var rx = (s.reach.x1 - s.reach.x0) / 2;
      a.pts.forEach(function (q, i) { drawRing(g, camX, q.x, q.y, rx, s.depth, aiming ? 0 : (a.t - s.aimMs) / Math.max(1, hitMs - s.aimMs) - i * 0.08, aiming); });
      return;
    }
    if (s.type === 'dive') {     // 와이번 내리꽂기: 날아 있는 동안 몸 밑(떨어질 자리)에 빨간 원. 맴도는 동안 옅게 따라가다가 경고·떨어짐에서 진하게
      var ry = Math.max(s.depth, s.radius * 0.3);
      if (a.phase === 'hover' || (a.phase === 'takeoff' && a.z > 0)) drawRing(g, camX, this.x, this.y, s.radius, ry, 0, true);
      else if (a.phase === 'warn') drawRing(g, camX, a.tx, a.ty, s.radius, ry, a.t / (s.warnMs + s.fallMs), false);
      else if (a.phase === 'fall') drawRing(g, camX, a.tx, a.ty, s.radius, ry, (s.warnMs + a.t) / (s.warnMs + s.fallMs), false);
      return;
    }
    if (s.type === 'teleport') {   // 안개 순간이동 물기: 안개가 모이는 동안 ~ 잡기 직전까지 잡힐 자리(물기 판정 가운데)에 빨간 원이 진해짐
      if (a.phase !== 'gather' && a.phase !== 'appear') return;
      var TA = this.T.anims[s.appearAnim], apMs = TA.playback.length * 1000 / TA.fps, tk = (a.phase === 'gather' ? a.t : s.gatherMs + a.t) / (s.gatherMs + apMs);
      var cxr = a.phase === 'gather' ? (s.reach.x0 + s.reach.x1) / 2 + (s.lunge || 0) : (s.reach.x0 + s.reach.x1) / 2 + (s.lunge || 0) * (1 - Math.min(1, a.t / apMs));
      drawRing(g, camX, this.x + this.dir * cxr, this.y, (s.reach.x1 - s.reach.x0) / 2 + 8 * AS(), s.depth, tk, false);
      return;
    }
    if (a.held) return;
    if (s.type === 'charge') {
      if (a.phase !== 'wind') return;
      r = { x0: 0, x1: s.dist + 90 * AS() }; k = a.t / s.windMs;
    } else if (s.telegraph && (this.T.boss || s.showTelegraph)) {
      // 공격 시작 ~ 첫 판정 그림 직전까지 (showTelegraph = 잡몹이어도 그림: 미라 잡기)
      var A = this.T.anims[s.anim], firstMs = A.playback.indexOf(s.active[0]) * 1000 / A.fps;
      if (a.t >= firstMs) return;
      r = s.reach; k = a.t / firstMs;
      if (s.move) r = { x0: r.x0, x1: r.x1 + s.move.dist - (a.moved || 0) };   // 앞으로 내딛는 공격(전갈 독침): 내딛는 만큼 길게
    }
    if (!r) return;
    var xa = this.x + r.x0 * this.dir, xb = this.x + r.x1 * this.dir;
    var x0 = Math.round(Math.min(xa, xb) - camX), w = Math.round(Math.abs(xb - xa));
    var d = s.depth || 12 * AS(), y0 = Math.round(this.y - d / 2), h = Math.round(d);
    var blink = Math.floor(performance.now() / 90) % 2;
    g.fillStyle = 'rgba(255,40,30,' + (0.18 + 0.22 * Math.min(1, k) + (blink ? 0.08 : 0)) + ')';
    g.fillRect(x0, y0, w, h);
    g.fillStyle = 'rgba(255,90,60,0.8)';
    g.fillRect(x0, y0, w, 1); g.fillRect(x0, y0 + h - 1, w, 1);
  };

  // 총 겨눔 예고(6단계 총잡이·선장 권총): spawnFrame 전까지(겨누는 그림) 총구에서 앞으로 range 까지
  //   ① 바닥 줄 표시 = 총알이 지나갈 줄(쏜 사람 발 y ± depth, 옅게) → 이 줄 밖으로 비키면 안 맞음
  //   ② 총알 높이의 가는 빨간 선(겨눌수록 진하게, 깜빡임) + 총구 반짝임. 1장(총 드는 그림) 동안은 바닥 줄만 아주 옅게
  Enemy.prototype.drawAim = function (g, camX) {
    var a = this.atk, s = a.spec, A = this.T.anims[s.anim];
    var fireMs = A.playback.indexOf(s.spawnFrame) * 1000 / A.fps;
    if (a.fired || a.t >= fireMs) return;
    var aimMs = A.playback.indexOf(s.telegraph[0]) * 1000 / A.fps, k = a.t < aimMs ? 0 : (a.t - aimMs) / Math.max(1, fireMs - aimMs);
    var x0 = this.x + this.dir * s.spawn.x - camX, x1 = this.x + this.dir * (s.spawn.x + s.range) - camX;
    var xa = Math.round(Math.min(x0, x1)), w = Math.round(Math.abs(x1 - x0));
    var blink = Math.floor(performance.now() / 80) % 2;
    var d = s.depth, y0 = Math.round(this.y - d), h = Math.round(d * 2);
    // 화난 흡혈 백작 박쥐 떼(세 줄): 바닥 줄 표시를 위아래 줄까지 넓게
    var EG = this.enraged && s.enraged;
    if (EG) { var lo = Math.min.apply(null, EG.lanes), hi = Math.max.apply(null, EG.lanes); y0 = Math.round(this.y + lo - d); h = Math.round(hi - lo + d * 2); }
    g.fillStyle = 'rgba(255,40,30,' + (a.t < aimMs ? 0.05 : 0.08 + 0.1 * k) + ')';
    g.fillRect(xa, y0, w, h);
    if (a.t < aimMs) return;
    var ly = Math.round(this.y - s.aimH) + 0.5, my = this.y + s.spawn.y;
    g.save();
    g.globalAlpha = Math.min(1, 0.35 + 0.5 * k + (blink ? 0.15 : 0));
    g.strokeStyle = '#ff3a2a'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x0, my); g.lineTo(x0 + this.dir * Math.max(1, s.dropPx || 0), ly); g.lineTo(x1, ly); g.stroke();   // 총구가 높으면(권총) 비스듬히 내려와 총알 높이로
    g.fillStyle = blink ? '#fff2a0' : '#ff6a3a';
    g.fillRect(Math.round(x0) - 1, Math.round(my) - 1, 2, 2);
    g.restore();
  };

  Enemy.prototype.draw = function (g, camX, debug) {
    var T = this.T, img = this.currentImg();
    var x = snapPx(this.x - camX), y = snapPx(this.y);
    var AI = this.cfg.ai;
    if (this.hidden) {   // 땅속(전갈 왕): 모래 둔덕만 / 안개 속(흡혈 백작 순간이동): 몸은 안 보이고, 모이는 동안 안개만
      if (this.atk && this.atk.spec.type === 'teleport') { this.drawGather(g, x, y); return; }
      this.drawMound(g, x, y); return;
    }
    var alpha = 1;
    if (this.state === 'dead' && !T.finalBoss) {   // 마지막 보스(마왕)는 쓰러진 그림이 그대로 남음(엔딩)
      var len = this.frameAt('death', 0).len, t = this.deadT - len - AI.deathHoldMs;
      if (t > 0) { if (Math.floor(t / 70) % 2 === 0) return; alpha = Math.max(0.2, 1 - t / AI.deathFadeMs); }
    }
    var fz = this.flyZ();   // 7단계 와이번: 날아 있는 높이(그림만 위로, 그림자는 땅에서 작아짐)
    window.drawShadow(g, x, y, T.radius * 1.1 * (fz > 0 ? Math.max(0.55, 1 - fz / (120 * AS())) : 1));
    if (!img) return;
    // 나는 적: 떠 있는 동안(서 있기·날기) 위아래로 살짝 흔들림(그림자는 그대로 땅에)
    var by = 0;
    if (T.flying && T.flying.bob && (this.state === 'idle' || this.state === 'walk')) by = snapPx(Math.sin(this.clock / T.flying.bobMs * Math.PI * 2) * T.flying.bob);
    // 8단계 유령 기사: 서 있거나 미끄러질 때 둥실(땅의 적, 그림자는 그대로)
    if (T.glide && (this.state === 'idle' || this.state === 'walk')) by = snapPx(Math.sin(this.clock / T.glide.bobMs * Math.PI * 2) * T.glide.bob);
    var faded = this.faded();   // 유령 기사 돌진 중 옅어진 장: 반투명
    if (faded) alpha *= 0.6;
    if (this.elA != null) alpha *= this.elA;   // 어둠 속성 몹: 스르르 나타남 · 잠깐 흐려짐(js/elmobs.js)
    var elm = this.elm && window.ElMob, ely = y + by - snapPx(fz);   // 속성 몹 오라(2026-11-07): 몸 뒤 · 몸 앞
    var auk = this.auraK();       // 10단계 마왕 각성 오라: 몸 뒤에(먼저) 그림
    if (auk > 0) this.drawAura(g, x, y, auk);
    var chk = this.chargeK();     // 9단계 장군 기 모으기(0~1, 아니면 -1): 몸 뒤 땅 금·불꽃
    if (chk >= 0) this.drawCharge(g, x, y, chk, 'ground');
    if (elm) ElMob.draw(this, g, x, ely, y, 'back', alpha);
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y + by - snapPx(fz));
    var ds = T.drawScale || 1;    // 6단계 선장: 그림만 조금 크게(판정은 config 에서 같이 키움)
    // 걷기 그림 장마다 높이 맞춤(T.walkDy = 그림 점, + 아래로): 발이 땅에서 뜬 장을 바닥에 붙임(마왕 1장·전갈 2~6장)
    if (T.walkDy && T.walkStride && this.state === 'walk') { var wdy = T.walkDy[this.walkIdx()] || 0; if (wdy) g.translate(0, snapPx(wdy * AS() * ds)); }
    g.scale(-this.dir * ds, ds);  // 그림이 왼쪽을 보므로 반대로
    var rage = this.rageK();      // 보스 분노(마왕 각성 빼고): 몸 뒤 일렁이는 불꽃 테두리
    if (rage > 0) drawRageAura(g, img, T.pivot, rage, this.clock, this.rageColor());
    var rim = (auk > 0 && T.awaken.rim) || T.rim;   // 마왕은 각성 뒤 붉은 보랏빛 테두리
    if (rim) drawRim(g, img, T.pivot, rim);   // 7단계 와이번: 붉은 하늘에 안 묻히게 어두운 테두리
    Assets.blit(g, img, T.pivot.x, T.pivot.y);
    if (this.flashT > 0 && !faded) {
      var s = FX.whiteSilhouette(img, 0, 0, img.width, img.height, 1);
      g.globalAlpha = alpha * Math.min(1, this.flashT / (this.cfg.juice.flashMs * 0.5));
      Assets.blit(g, img, T.pivot.x, T.pivot.y, s);
    }
    if (rage > 0) {   // 분노: 몸이 조금 붉게(깜빡임 없이 은은하게)
      g.globalAlpha = alpha * this.cfg.ai.rage.tint * rage;
      Assets.blit(g, img, T.pivot.x, T.pivot.y, redSilhouette(img));
      g.globalAlpha = alpha;
    }
    if (this.state === 'attack' && this.atk.spec.type === 'breath') this.drawBreath(g);   // 불 뿜기: 입 앞 불길(몸과 같은 좌표 = 왼쪽을 보는 그림 기준)
    if (chk > 0) {   // 기 모으기: 몸이 점점 붉게 물듦(실루엣을 붉게 칠해 겹침)
      g.globalAlpha = alpha * 0.5 * chk * (0.85 + 0.15 * Math.sin(this.clock / 50));
      Assets.blit(g, img, T.pivot.x, T.pivot.y, redSilhouette(img));
    }

    g.restore();
    if (elm) ElMob.draw(this, g, x, ely, y, 'front', alpha);
    if (chk >= 0) this.drawCharge(g, x, y, chk, 'body');
    // 보스 휘청: 가슴 핵 주황 빛(1·2·4 장, 3장 = 핵 꺼짐 = 때릴 기회). core.x = 앞 +
    var CO = T.stagger && T.stagger.core;
    if (CO && this.state === 'stagger' && this.staggerIdx() !== 2) {
      var cx = x + this.dir * CO.x, cy = y + CO.y, cr = CO.r * (0.85 + 0.15 * Math.sin(this.clock / 60));
      var gr = g.createRadialGradient(cx, cy, 0, cx, cy, cr);
      gr.addColorStop(0, CO.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.75; g.fillStyle = gr; g.fillRect(cx - cr, cy - cr, cr * 2, cr * 2); g.restore();
    }
    // 알아챔: 머리 위 노란 「!」 (깨고 alertT 동안). 처음 조금은 위로 튀어 오름
    if (this.alertT > 0 && this.alive()) {
      var ay = y - Math.round(T.height) - 12 - (this.alertT > (this.cfg.ai.wake.alertMs || 300) - 80 ? 3 : 0);
      g.fillStyle = '#2a1020'; g.fillRect(x - 3, ay - 1, 6, 10); g.fillRect(x - 3, ay + 10, 6, 5);
      g.fillStyle = '#ffd23f'; g.fillRect(x - 2, ay, 4, 8); g.fillRect(x - 2, ay + 11, 4, 3);
    }
    // 보스 분노 터짐(2026-11-06 밤, 예전 머리 위 빨간 점 2개 대신): 화난 순간 발밑에서 퍼지는 불꽃 고리 + 몸 둘레 큰 빛
    if (this.rageT != null && this.rageT < this.cfg.ai.rage.burstMs && !T.awaken) this.drawRageBurst(g, x, y);
    if (debug) {
      var hb = this.hurtbox();
      g.strokeStyle = '#3cf'; g.strokeRect(Math.round(hb.x0 - camX) + 0.5, Math.round(hb.y0) + 0.5, Math.round(hb.x1 - hb.x0), Math.round(hb.y1 - hb.y0));
      if (this.state === 'attack') {
        var s2 = this.atk.spec, rr = s2.type === 'charge' ? (this.atk.phase === 'impact' ? s2.reach : s2.bodyReach) : s2.type === 'spikes' ? null : s2.reach;   // 얼음 가시 판정은 가시 자리(main.js)
        if (rr) {   // 판정 상자가 없는 공격(바위 던지기·총·대포)은 안 그림
          var ab = this.attackBox(rr, s2.depth);
          g.strokeStyle = 'rgba(255,60,60,0.8)'; g.strokeRect(Math.round(ab.x0 - camX) + 0.5, Math.round(ab.y0) + 0.5, Math.round(ab.x1 - ab.x0), Math.round(ab.y1 - ab.y0));
        }
      }
      g.fillStyle = '#0f0'; g.fillRect(x - 1, y - 1, 3, 3);
    }
  };

  // ---------- 9단계 장군 기 모으기·터뜨림 (2026-11-06, 우리가 그린 그림 skillFx demon_charge_* / demon_release) ----------
  // 기 모으기 정도: 화염 충격파 공격에서 칼을 꽂기 전(spawnFrame 전)이면 0~1, 아니면 -1
  Enemy.prototype.chargeK = function () {
    var a = this.atk;
    if (this.state !== 'attack' || !a || a.spec.type !== 'shockwave' || a.fired) return -1;
    var WA = this.T.anims[a.spec.anim], plantMs = WA.playback.indexOf(a.spec.spawnFrame) * 1000 / WA.fps;
    return Math.max(0, Math.min(1, a.t / Math.max(1, plantMs)));
  };
  function ourFx(name) {
    var F = window.GAME && GAME.assets && GAME.assets.fx, fr = F && F['skill_' + name], M = window.CFG && CFG.magic['skill_' + name];
    return fr && fr.length && M ? { fr: fr, pivot: M.pivot, fps: M.fps } : null;
  }
  // layer 'ground' = 땅 금 + 몸 뒤 솟는 불꽃(몸보다 먼저), 'body' = 발 앞 낮은 불꽃 + 모여드는 불씨(몸 다음). 기준점 = 발
  //   그림은 장군 그림처럼 왼쪽을 보는 기준 → 오른쪽을 보면(dir +1) 뒤집음
  Enemy.prototype.drawCharge = function (g, x, y, k, layer) {
    var A = ourFx('demon_charge_' + layer);
    if (!A) return;
    var im = A.fr[Math.min(A.fr.length - 1, Math.floor(k * A.fr.length))];
    g.save(); g.translate(x, y); g.scale(this.dir > 0 ? -1 : 1, 1);
    Assets.blit(g, im, A.pivot.x, A.pivot.y); g.restore();
  };
  // 칼 꽂는 순간: 꽂은 자리(px = 바닥)에 번쩍 + 빛기둥. 그림 속 빛기둥은 기준점 오른쪽 6 → 그만큼 옮겨서 꽂은 자리에 맞춤
  Enemy.prototype.releaseFx = function (px, py) {
    var A = ourFx('demon_release');
    if (!A || !window.FX) return;
    var flip = this.dir > 0;
    FX.sprite(px - (flip ? -6 : 6), py, A.fr, A.fps, A.pivot, flip, false, 1);
  };
  // 그림 한 장의 붉은 실루엣(기 모으기 물듦, 그림마다 한 번만 만듦)
  function redSilhouette(img) {
    if (img._red) return img._red;
    var c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    var cg = c.getContext('2d'); cg.drawImage(img, 0, 0);
    cg.globalCompositeOperation = 'source-in'; cg.fillStyle = '#ff2a10'; cg.fillRect(0, 0, c.width, c.height);
    img._red = c;
    return c;
  }

  // 불 뿜기 불길(fxArt[fx.art], 7단계 와이번): 불길 장(active) 동안 입 앞 attach(앞 +)에 그림 기준점(오른쪽 잘린 면)을 붙이고
  //   앞으로 segW 마다 segments 개 이어 그림. 처음 growMs 동안 입에서 앞으로 뻗어 나감(가로로 늘어남). 지금 좌표 = 왼쪽을 보는 그림 기준(앞 = -x)
  Enemy.prototype.drawBreath = function (g) {
    var a = this.atk, s = a.spec, B = s.fx, F = window.GAME && GAME.assets && GAME.assets.enemyFx && GAME.assets.enemyFx[this.type], A = F && F[B.art];
    if (a.fireT == null || !inList(s.active, this.frameAt(s.anim, a.t).no) || !A || !A.frames.length) return;
    var im = A.frames[Math.floor(a.fireT * A.fps / 1000) % A.frames.length];
    var grow = Math.min(1, (a.fireT + 16) / (B.growMs || 1));
    g.save();
    g.translate(-B.attach.x, B.attach.y);
    g.scale(grow, 1);
    for (var i = 0; i < (B.segments || 1); i++) { Assets.blit(g, im, A.pivot.x, A.pivot.y); g.translate(-B.segW, 0); }
    g.restore();
  };

  // 어두운 테두리(rim): 그림 실루엣을 어두운 색으로 칠해 위·아래·왼·오른쪽으로 px(캔버스 점)씩 밀어 그림 → 그 위에 원래 그림.
  //   실루엣은 그림마다 한 번만 만들어 둠(img._rim). 지금 좌표는 Enemy.draw 의 그림 좌표(blit 와 같음)
  function drawRim(g, img, pv, R) {
    if (!img) return;
    if (!img._rim) {
      var c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      var cg = c.getContext('2d'); cg.drawImage(img, 0, 0);
      cg.globalCompositeOperation = 'source-in'; cg.fillStyle = R.color; cg.fillRect(0, 0, c.width, c.height);
      img._rim = c;
    }
    var k = img._k || 1, ox = img._ox || 0, oy = img._oy || 0, d = (R.px || 1) / ((window.CFG && CFG.view.renderScale) || 1) / k;   // 캔버스 점 → 그림 점
    g.save(); g.scale(k, k); g.globalAlpha *= R.alpha != null ? R.alpha : 1;
    [[-d, 0], [d, 0], [0, -d], [0, d]].forEach(function (o) { g.drawImage(img._rim, ox - pv.x + o[0], oy - pv.y + o[1]); });
    g.restore();
  }

  // ---------- 보스 분노(2026-11-06 밤, 형님: 「화났다」 빨간 점 2개 → 보스 각성 연출). 마왕(각성 그림 있음)은 자기 각성 그대로 ----------
  //   수치 = config ai.rage. 색 = 보스마다 T.rageColor(없으면 ai.rage.color)
  Enemy.prototype.rageColor = function () { return this.T.rageColor || this.cfg.ai.rage.color; };
  // 분노 세기 0~1: 화난 뒤 fadeInMs 동안 차오름. 마왕·죽음 = 0
  Enemy.prototype.rageK = function () {
    if (!this.enraged || this.T.awaken || !this.T.boss || this.state === 'dead' || this.rageT == null) return 0;
    return Math.min(1, this.rageT / this.cfg.ai.rage.fadeInMs);
  };
  // 몸 실루엣을 불꽃 색으로 칠해(그림마다 한 번) 위로 1~3점씩 밀어 겹침 → 몸 테두리에서 불꽃이 위로 일렁이는 모양. 'lighter'(더하기)
  function drawRageAura(g, img, pv, k, clock, color) {
    if (!img) return;
    var key = '_rage' + color;
    if (!img[key]) {
      var c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      var cg = c.getContext('2d'); cg.drawImage(img, 0, 0);
      cg.globalCompositeOperation = 'source-in'; cg.fillStyle = color; cg.fillRect(0, 0, c.width, c.height);
      img[key] = c;
    }
    var s = img._k || 1, ox = img._ox || 0, oy = img._oy || 0, RS = (window.CFG && CFG.view.renderScale) || 1, u = 1 / RS / s;   // u = 캔버스 1점 → 그림 점
    var t = clock / 1000, sm = g.imageSmoothingEnabled;
    g.save(); g.scale(s, s); g.imageSmoothingEnabled = false; g.globalCompositeOperation = 'lighter';
    // 위로 올라갈수록 옅게(불꽃 끝), 장마다 조금씩 흔들림(일렁임)
    [[0, 2, 0.6], [1, 5, 0.45], [-1, 9, 0.3], [0, 14, 0.18]].forEach(function (o, i) {
      var fl = 0.75 + 0.25 * Math.sin(t * 13 + i * 1.9), sx = o[0] * Math.round(Math.sin(t * 9 + i) * 1.5);
      g.globalAlpha = k * o[2] * fl;
      g.drawImage(img[key], ox - pv.x + sx * u * 2, oy - pv.y - o[1] * u * 2);
    });
    [[-2, 0], [2, 0]].forEach(function (o) { g.globalAlpha = k * 0.35; g.drawImage(img[key], ox - pv.x + o[0] * u * 2, oy - pv.y); });   // 옆 테두리
    g.imageSmoothingEnabled = sm; g.restore();
  }
  // 화난 순간(burstMs): 발밑 불꽃 고리 2개가 퍼지고(땅 = 납작한 타원) 몸 둘레 큰 빛이 번쩍였다 사라짐 + 위로 솟는 불티
  Enemy.prototype.drawRageBurst = function (g, x, y) {
    var RG = this.cfg.ai.rage, u = this.rageT / RG.burstMs, col = this.rageColor(), T = this.T, H = T.height, R = T.radius * 3.2;
    g.save(); g.globalCompositeOperation = 'lighter';
    var gr = g.createRadialGradient(x, y - H * 0.5, 0, x, y - H * 0.5, H * (0.7 + 0.5 * u));
    gr.addColorStop(0, 'rgba(255,240,200,' + (0.55 * (1 - u)).toFixed(3) + ')'); gr.addColorStop(0.4, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.6 * (1 - u); g.fillStyle = gr; g.fillRect(x - H * 1.3, y - H * 1.3, H * 2.6, H * 2);
    [0, 0.25].forEach(function (d) {
      var v = Math.max(0, Math.min(1, (u - d) / 0.75)); if (v <= 0 || v >= 1) return;
      var r = R * (0.3 + 1.7 * (1 - (1 - v) * (1 - v)));
      g.globalAlpha = (1 - v) * 0.9; g.strokeStyle = col; g.lineWidth = 4 * (1 - v) + 1;
      g.beginPath(); g.ellipse(x, y, r, r * 0.28, 0, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = (1 - v); g.strokeStyle = '#fff2c0'; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(x, y, r, r * 0.28, 0, 0, Math.PI * 2); g.stroke();
    });
    for (var i = 0; i < 14; i++) {   // 솟는 불티
      var a = i * 2.39, px = x + Math.cos(a) * R * (0.3 + 0.5 * ((i * 37) % 10) / 10), py = y - (H * 1.1) * u * (0.5 + ((i * 53) % 10) / 20);
      g.globalAlpha = 1 - u; g.fillStyle = i % 3 ? col : '#fff2c0'; g.fillRect(Math.round(px), Math.round(py), 2, 2);
    }
    g.restore();
  };

  // 10단계 마왕 각성 오라(fxArt[awaken.aura.art]): 발(기준점)에 오라 기준점을 맞춰 scale 배로, 'lighter'(더하기)로 → 붉은 배경에서도 보랏빛으로 빛남.
  //   k = 진하기(auraK). 먼저 옅게 보통으로 한 번 깔아서 어두운 불꽃 테두리도 보이게
  Enemy.prototype.drawAura = function (g, x, y, k) {
    var AU = this.T.awaken.aura, F = window.GAME && GAME.assets && GAME.assets.enemyFx && GAME.assets.enemyFx[this.type], A = F && F[AU.art];
    if (!A || !A.frames.length) return;
    var im = A.frames[Math.floor(this.clock * A.fps / 1000) % A.frames.length], sc = AU.scale || 1;
    g.save(); g.translate(x, y); g.scale(-this.dir * sc, sc);
    g.globalAlpha = 0.35 * k; Assets.blit(g, im, A.pivot.x, A.pivot.y);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = (AU.alpha || 0.8) * k; Assets.blit(g, im, A.pivot.x, A.pivot.y);
    g.restore();
  };

  // 흡혈 백작 순간이동: 나타날 자리에 안개가 모임(gather) = 안개 그림(fxArt.mist)을 거꾸로(흩어진 끝 → 큰 소용돌이) 재생, 처음엔 옅게
  //   안개 그림이 없으면(10단계 마왕) 검은 연기 기둥(점점 진하고 높아짐) + 붉은 두 눈
  Enemy.prototype.drawGather = function (g, x, y) {
    var a = this.atk, s = a.spec, F = window.GAME && GAME.assets && GAME.assets.enemyFx && GAME.assets.enemyFx[this.type], M = F && F.mist;
    if (a.phase !== 'gather') return;
    if (!M || !M.frames.length) { this.drawSmoke(g, x, y, Math.min(1, a.t / s.gatherMs)); return; }
    var u = Math.min(1, a.t / s.gatherMs), n = M.frames.length, i = Math.max(1, n - 1 - Math.floor(u * (n - 1)));   // 5 → 2장
    g.save(); g.globalAlpha = 0.35 + 0.65 * u; g.translate(x, y); g.scale(-this.dir, 1);
    Assets.blit(g, M.frames[Math.min(n - 1, i)], M.pivot.x, M.pivot.y);
    g.restore();
  };

  // 검은 연기 기둥(10단계 마왕 순간이동 예고): u = 0~1(모이는 정도). 위로 갈수록 가늘어지는 타원 몇 겹이 흔들림 + 눈 높이에 붉은 두 눈
  Enemy.prototype.drawSmoke = function (g, x, y, u) {
    var H = this.T.height * (0.45 + 0.55 * u), W = this.T.radius * (0.7 + 0.3 * u), t = this.clock / 1000, cols = (this.atk && this.atk.spec.smokeCols) || ['#140814', '#3a1440', '#6a2a6a'];
    g.save();
    for (var i = 0; i < 5; i++) {
      var f = i / 4, cy = y - H * (0.15 + 0.7 * f), rx = W * (1 - 0.55 * f) * (0.9 + 0.1 * Math.sin(t * 7 + i)), ry = H * 0.22;
      g.globalAlpha = (0.25 + 0.5 * u) * (1 - 0.3 * f);
      g.fillStyle = cols[i % 3];
      g.beginPath(); g.ellipse(x + Math.sin(t * 5 + i * 1.7) * 2, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
    }
    if (u > 0.35) {   // 붉은 두 눈
      var ey = Math.round(y - this.T.height * 0.82), ex = Math.round(this.dir * 3);
      g.globalAlpha = Math.min(1, (u - 0.35) * 2.5); g.fillStyle = cols[3] || '#ff3a6a';
      g.fillRect(x + ex - 4, ey, 3, 2); g.fillRect(x + ex + 2, ey, 3, 2);
    }
    g.restore();
  };

  // 땅속으로 다가오는 모래 둔덕(fxArt.mound, 오른쪽으로 가면 뒤집기). 처음 100ms 는 파고든 둔덕(burrow 4장)보다 좁아서 조금 크게,
  //   warn(곧 솟구침) 동안 좌우로 떨림. 그림이 없으면 모래색 반원
  Enemy.prototype.drawMound = function (g, x, y) {
    var a = this.atk, F = window.GAME && GAME.assets && GAME.assets.enemyFx && GAME.assets.enemyFx[this.type], M = F && F.mound;
    var sc = a && a.phase === 'mound' && a.t < 100 ? 1.15 : 1;
    if (a && a.phase === 'warn') x += (Math.floor(a.t / 40) % 2 ? 1 : -1) * (0.6 + a.t / a.spec.warnMs);
    window.drawShadow(g, x, y, this.T.radius * 0.9);
    if (!M || !M.frames.length) { g.fillStyle = '#c8a46a'; g.beginPath(); g.ellipse(x, y, 30 * AS(), 12 * AS(), 0, Math.PI, 0); g.fill(); return; }
    var im = M.frames[Math.floor(this.clock * M.fps / 1000) % M.frames.length];
    g.save(); g.translate(x, y); g.scale(-this.dir * sc, sc);
    Assets.blit(g, im, M.pivot.x, M.pivot.y);
    g.restore();
  };

  window.Enemy = Enemy;
})();
