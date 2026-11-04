// 적: 고블린 · 늑대 · 오크 족장(보스) + 2단계 박쥐(나는 적) · 해골 병사(방패 막기) · 돌 골렘(보스, 바위 던지기)
//   + 3단계 도마뱀 전사(찌르기·달려들기) · 거대 두꺼비(보스, 배치기·혀·독 뱉기) + 4단계 미라(잡기) · 전갈 왕(보스, 땅속 숨기). 수치는 전부 config.js 의 enemies.
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
  Enemy.prototype.wake = function (alertMs) {
    if (!this.asleep) return;
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
  Enemy.prototype.canBeHit = function () { return this.alive() && this.state !== 'down' && !this.hidden && !this.burrowInvuln() && !this.airborne(); };
  // 공중(두꺼비 배치기 leap 의 뛰는 그림 2·3장): 안 맞고, 몸끼리 안 밀림(main.js separate)
  Enemy.prototype.airborne = function () {
    var a = this.atk;
    if (this.state !== 'attack' || !a || a.spec.type !== 'leap') return false;
    return inList(a.spec.leap.frames, this.frameAt(a.spec.anim, a.t).no);
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
    return { kd: kd, slide: Math.max(step, (k < 0 ? 3 : k) * step), lying: this.cfg.ai.react.lyingMs, getup: gl };
  };

  Enemy.prototype.startStagger = function () {
    this.state = 'stagger'; this.stagT = 0; this.animT = 0; this.atk = null; this.vx = 0; this.hidden = false;
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
  Enemy.prototype.speedMul = function () { return this.enraged ? this.T.enrage.speedMul : 1; };

  // 몸 판정 (앞 = 바라보는 쪽 +)
  Enemy.prototype.hurtbox = function () {
    var h = this.T.hurtbox, SG = this.T.stagger;
    if (this.state === 'stagger' && SG && SG.hurtbox && this.staggerIdx() === 2) h = SG.hurtbox;   // 휘청 3장(전갈 뒤집힘) = 몸이 더 넓게 누움
    var xa = this.x + h.x0 * this.dir, xb = this.x + h.x1 * this.dir;
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: this.y + h.yTop, y1: this.y + h.yBot, z: this.y };
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
    if (this.state === 'down' && !opts.force) return null;
    if (this.hidden && !opts.force) return null;   // 땅속(전갈 왕)
    this.asleep = false; this.alertT = 0;   // 자다가 맞으면 바로 깸(「!」 없이)
    var T = this.T, AI = this.cfg.ai, R = AI.react;
    var before = this.hp / this.maxHp;
    this.hp = Math.max(0, this.hp - dmg);
    this.flashT = this.cfg.juice.flashMs * (opts.flashK != null ? opts.flashK : 1);   // flashK = 하얀 번쩍 길이 배율(밀고 가는 작은 타는 짧게)
    var kv = dir * knockPx * AI.enemyKnockMul * (T.knockResist != null ? T.knockResist : 1) * 10;
    if (this.hp <= 0) {
      if (this.state === 'down') {     // 누워 있다가 죽음: 일어나지 않고 그 자리에 누운 채로
        this.deadImg = this.currentImg();
        this.state = 'dead'; this.deadT = 0; this.atk = null; this.vx = 0;
        return 'dead';
      }
      this.state = 'dead'; this.animT = 0; this.deadT = 0; this.atk = null;
      this.vx = dir * T.deathKnock;
      this.dir = -dir;
      return 'dead';
    }
    if (T.boss) {
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
      if (this.hasAnim('knockdown') && (finisher || opts.heavy || (!opts.noJuggle && this.recentHits.length >= R.juggleHits))) {
        this.state = 'down'; this.downT = 0; this.animT = 0; this.atk = null; this.vx = 0;
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
    var T = this.T, dt = dtMs / 1000, p = ctx.player;
    this.animT += dtMs;
    this.clock += dtMs;
    if (this.flashT > 0) this.flashT -= dtMs;
    if (this.staggerCd > 0) this.staggerCd -= dtMs;
    if (this.retreatT > 0) this.retreatT -= dtMs;
    if (this.guardCd > 0) this.guardCd -= dtMs;

    // 밀려남(감속)
    if (this.vx) {
      this.x += this.vx * dt;
      this.vx *= Math.exp(-dt * 10);
      if (Math.abs(this.vx) < 2) this.vx = 0;
    }

    if (this.state === 'dead') {
      this.deadT += dtMs;
      var fr = this.frameAt('death', this.deadT);
      var AI = this.cfg.ai;
      if (this.deadT > fr.len + AI.deathHoldMs + AI.deathFadeMs) this.remove = true;
      this.keepInView(ctx);
      return;
    }
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

    var pick = this.cool <= 0 && this.retreatT <= 0 && this.entered ? this.chooseAttack(adx, Math.abs(dy), ctx) : null;
    if (pick) { this.startAttack(pick, ctx); this.keepInView(ctx); return; }

    var wantAttack = this.cool <= 0 && this.retreatT <= 0 && (T.boss || this.mayAttack(ctx));
    var tx, ty;
    if (wantAttack) { tx = p.x + this.side * T.engage; ty = p.y; }
    else { tx = p.x + this.side * this.hoverD; ty = p.y + this.yOff; }
    if (this.retreatT > 0) { tx = p.x + this.side * (T.engage + 90 * AS()); ty = p.y + this.yOff; }
    ty = Math.max(ctx.world.laneTop, Math.min(ctx.world.laneBottom, ty));
    if (ctx.steer && !T.flying) { var sv = ctx.steer(this, tx, ty); tx = sv.x; ty = sv.y; }   // 나는 적(박쥐)은 소품 위로 지나감   // 막는 소품(상자·통): 목표가 그 안이면 옆으로, 앞에 있으면 위나 아래로 돌아감 (props.js)
    var mx = tx - this.x, my = ty - this.y;
    var vx = Math.abs(mx) > 4 ? Math.sign(mx) * T.speedX * this.speedMul() : 0;
    var vy = Math.abs(my) > 3 ? Math.sign(my) * T.speedY * this.speedMul() : 0;
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
    var s = moving ? 'walk' : 'idle';
    if (this.state !== s) { this.state = s; this.animT = 0; }
  };

  // 잡몹: 공격 차례가 있는지 (동시에 너무 많이 때리지 않게)
  Enemy.prototype.mayAttack = function (ctx) {
    var AI = this.cfg.ai, n = 0;
    ctx.enemies.forEach(function (e) { if (e.state === 'attack' && !e.T.boss) n++; });
    return n < AI.maxAttackers && ctx.now - (ctx.lastAttackAt || -1e9) > AI.attackGapMs;
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
      var self = this, ok = keys.filter(function (k) { var A = T.attacks[k], w = A.when;
        if (A.gapMs && self.clock - (self.usedAt[k] != null ? self.usedAt[k] : -1e9) < A.gapMs) return false;
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
      var yOk = a.type === 'charge' ? ady <= 40 * AS() : (a.type === 'throw' || a.type === 'burrow') ? true : ady <= T.alignY;   // 바위 던지기·땅속 숨기는 줄 상관없음
      if (a.type === 'burrow' && self.clock - self.lastBurrowAt < (a.gapMs || 0)) return;   // 한 번 숨은 뒤 gapMs 동안은 안 숨음
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
    var fr = this.frameAt(spec.anim, a.t);
    if (fr.done) { this.endAttack(); return; }
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
    // reachF = 장마다 다른 판정 상자(전갈 집게: 3장 멀리 → 4장 가까이 조임)
    if (inList(spec.active, fr.no)) this.tryHitPlayer(spec, (spec.reachF && spec.reachF[fr.no]) || spec.reach, ctx);
    // 땅을 찍는 순간 화면 흔들림 (보스)
    if (spec.shake && !a.shook && fr.no === spec.active[spec.active.length - 1]) {
      a.shook = true; ctx.shake(spec.shake);
      if (spec.burst && ctx.burst) ctx.burst(this, this.x + this.dir * spec.burst.x, this.y, spec.burst.scale);   // 골렘 내려찍기: 주먹 자리에 바위 터짐
    }
  };

  // 미라 잡기: 붙잡은 동안(holdT) 그림 멈춤. 플레이어가 버튼을 누를 때마다(ctx.grabMash) mashMs 만큼 빨리 풀림(그래도 minMs 는 잡혀 있음)
  //   다 되면 놓으면서 데미지 + 내던짐(ctx.releaseGrab) → 남은 그림(5장 복귀)부터 이어서
  Enemy.prototype.updateHold = function (dtMs, ctx) {
    var a = this.atk, G = a.spec.grab, p = ctx.player;
    a.heldT += dtMs; a.holdT -= dtMs;
    var n = ctx.grabMash ? ctx.grabMash() : 0;
    if (n) a.holdT -= n * G.mashMs;
    if (p.state !== 'held' || p.heldBy !== this) { a.held = false; this.endAttack(); return; }   // 어쩌다 풀려 버림
    if (a.holdT <= 0 && a.heldT >= G.minMs) {
      a.held = false;
      if (ctx.releaseGrab) ctx.releaseGrab(this, a.spec);
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
    if (this.state === 'hit') return this.frameAt(this.hitAnim, this.animT).img;
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
        if (a.phase === 'wind') return imgs[a.t < s.windMs ? 0 : 1];
        if (a.phase === 'run') return imgs[2 + (Math.floor(a.t / s.stepMs) % 2)];
        if (a.phase === 'impact') return imgs[4];
        return imgs[0];
      }
      if (a.held) return imgs[s.grab.holdFrame - 1] || imgs[imgs.length - 1];   // 미라: 붙잡고 있는 동안(움켜쥔 손)
      if (s.type === 'burrow') {
        if (a.phase === 'erupt') return this.frameAt(s.eruptAnim, a.t).img;
        if (a.phase === 'dig' || a.phase === 'wind') return this.frameAt(s.anim, a.t).img;
        return null;   // 땅속: 몸 대신 모래 둔덕(drawMound)
      }
      return this.frameAt(s.anim, a.t).img;
    }
    if (this.state === 'walk') return this.frameAt(T.walkAnim, this.animT).img;
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
    if (!this.entered && this.x > x0 && this.x < x1) this.entered = true;
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

  Enemy.prototype.draw = function (g, camX, debug) {
    var T = this.T, img = this.currentImg();
    var x = snapPx(this.x - camX), y = snapPx(this.y);
    var AI = this.cfg.ai;
    if (this.hidden) { this.drawMound(g, x, y); return; }   // 땅속(전갈 왕): 모래 둔덕만
    var alpha = 1;
    if (this.state === 'dead') {
      var len = this.frameAt('death', 0).len, t = this.deadT - len - AI.deathHoldMs;
      if (t > 0) { if (Math.floor(t / 70) % 2 === 0) return; alpha = Math.max(0.2, 1 - t / AI.deathFadeMs); }
    }
    window.drawShadow(g, x, y, T.radius * 1.1);
    if (!img) return;
    // 나는 적: 떠 있는 동안(서 있기·날기) 위아래로 살짝 흔들림(그림자는 그대로 땅에)
    var by = 0;
    if (T.flying && T.flying.bob && (this.state === 'idle' || this.state === 'walk')) by = snapPx(Math.sin(this.clock / T.flying.bobMs * Math.PI * 2) * T.flying.bob);
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y + by);
    g.scale(-this.dir, 1);        // 그림이 왼쪽을 보므로 반대로
    Assets.blit(g, img, T.pivot.x, T.pivot.y);
    if (this.flashT > 0) {
      var s = FX.whiteSilhouette(img, 0, 0, img.width, img.height, 1);
      g.globalAlpha = alpha * Math.min(1, this.flashT / (this.cfg.juice.flashMs * 0.5));
      Assets.blit(g, img, T.pivot.x, T.pivot.y, s);
    }

    g.restore();
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
    // 보스 화남: 머리 위 빨간 김
    if (this.enraged && this.alive() && Math.floor(performance.now() / 160) % 2) {
      var hx = Math.round(this.dir * 14 * AS());
      g.fillStyle = '#ff4a3a'; g.fillRect(x - 2 + hx, y - Math.round(T.height) - 6, 3, 3); g.fillRect(x + 4 + hx, y - Math.round(T.height) - 10, 2, 2);
    }
    if (debug) {
      var hb = this.hurtbox();
      g.strokeStyle = '#3cf'; g.strokeRect(Math.round(hb.x0 - camX) + 0.5, Math.round(hb.y0) + 0.5, Math.round(hb.x1 - hb.x0), Math.round(hb.y1 - hb.y0));
      if (this.state === 'attack') {
        var s2 = this.atk.spec, rr = s2.type === 'charge' ? (this.atk.phase === 'impact' ? s2.reach : s2.bodyReach) : s2.reach;
        var ab = this.attackBox(rr, s2.depth);
        g.strokeStyle = 'rgba(255,60,60,0.8)'; g.strokeRect(Math.round(ab.x0 - camX) + 0.5, Math.round(ab.y0) + 0.5, Math.round(ab.x1 - ab.x0), Math.round(ab.y1 - ab.y0));
      }
      g.fillStyle = '#0f0'; g.fillRect(x - 1, y - 1, 3, 3);
    }
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
