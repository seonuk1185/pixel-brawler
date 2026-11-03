// 적: 고블린 · 늑대 · 오크 족장(보스). 수치는 전부 config.js 의 enemies.
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
  }

  function sum(d) { var s = 0; for (var i = 0; i < d.length; i++) s += d[i]; return s; }

  // 지금 맞을 수 있나 (넘어짐~일어남 동안은 무적)
  Enemy.prototype.canBeHit = function () { return this.alive() && this.state !== 'down'; };
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
    this.state = 'stagger'; this.stagT = 0; this.animT = 0; this.atk = null; this.vx = 0;
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
    var h = this.T.hurtbox;
    var xa = this.x + h.x0 * this.dir, xb = this.x + h.x1 * this.dir;
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: this.y + h.yTop, y1: this.y + h.yBot, z: this.y };
  };
  // 공격 판정 상자
  Enemy.prototype.attackBox = function (r, depth) {
    var xa = this.x + r.x0 * this.dir, xb = this.x + r.x1 * this.dir;
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: this.y + r.yTop, y1: this.y + r.yBot, z: this.y, depth: depth };
  };

  // 플레이어에게 맞음. dir = 밀려나는 방향. opts = { heavy: 무거운 타, force: 넘어져 있어도 맞음(보스 쓰러질 때 졸개 정리),
  //   stunMs: 맞은 그림이 끝나도 이만큼 더 멈춰 있음(번개 기술) }
  // 돌려주는 값: 'dead' / 'down'(넘어짐) / 'stagger'(움찔·휘청) / 'armor'(번쩍이기만) / null(무적이라 안 맞음)
  Enemy.prototype.takeHit = function (dmg, dir, knockPx, finisher, opts) {
    opts = opts || {};
    if (!this.alive()) return null;
    if (this.state === 'down' && !opts.force) return null;
    var T = this.T, AI = this.cfg.ai, R = AI.react;
    var before = this.hp / this.maxHp;
    this.hp = Math.max(0, this.hp - dmg);
    this.flashT = this.cfg.juice.flashMs;
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
      this.recentHits.push(now);
      if (this.hasAnim('knockdown') && (finisher || opts.heavy || this.recentHits.length >= R.juggleHits)) {
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
      if (adx >= T.range[0] && adx <= T.range[1] && ady <= T.alignY) return Object.keys(T.attacks)[0];
      return null;
    }
    // 보스: 거리에 맞는 공격 중 무게(weight)로 고르기
    var opts = [], sum = 0;
    Object.keys(T.attacks).forEach(function (k) {
      var a = T.attacks[k];
      var yOk = a.type === 'charge' ? ady <= 40 * AS() : ady <= T.alignY;
      if (yOk && adx >= a.when[0] && adx <= a.when[1]) { opts.push(k); sum += a.weight; }
    });
    if (!opts.length) return null;
    var r = Math.random() * sum;
    for (var i = 0; i < opts.length; i++) { r -= T.attacks[opts[i]].weight; if (r <= 0) return opts[i]; }
    return opts[opts.length - 1];
  };

  Enemy.prototype.endAttack = function () {
    var T = this.T;
    this.state = 'idle'; this.animT = 0; this.atk = null;
    this.cool = randi(T.cooldown);
    if (T.retreatMs) this.retreatT = T.retreatMs;
  };

  Enemy.prototype.tryHitPlayer = function (spec, reach, ctx) {
    if (this.atk.hit) return;
    var p = ctx.player, b = this.attackBox(reach, spec.depth), h = p.hurtbox();
    if (b.x0 < h.x1 && b.x1 > h.x0 && b.y0 < h.y1 && b.y1 > h.y0 && Math.abs(b.z - h.z) <= b.depth) {
      this.atk.hit = true;
      ctx.onPlayerHit(this, spec);
    }
  };

  Enemy.prototype.updateAttack = function (dtMs, ctx) {
    var a = this.atk, spec = a.spec, dt = dtMs / 1000;
    a.t += dtMs;
    if (spec.type === 'charge') return this.updateCharge(dtMs, ctx);
    var fr = this.frameAt(spec.anim, a.t);
    if (fr.done) { this.endAttack(); return; }
    // 공격 중 앞으로 이동(늑대 도약): 그 그림들이 보이는 시간 동안 dist 만큼 고르게
    if (spec.move && inList(spec.move.frames, fr.no)) {
      var pb = this.T.anims[spec.anim].playback, cnt = 0;
      pb.forEach(function (n) { if (inList(spec.move.frames, n)) cnt++; });
      var sp = spec.move.dist / (cnt * fr.step / 1000);
      this.x += this.dir * sp * dt;
    }
    if (inList(spec.active, fr.no)) this.tryHitPlayer(spec, spec.reach, ctx);
    // 땅을 찍는 순간 화면 흔들림 (보스)
    if (spec.shake && !a.shook && fr.no === spec.active[spec.active.length - 1]) { a.shook = true; ctx.shake(spec.shake); }
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
    if (this.state === 'down') {
      var DT = this.downTimes();
      if (this.downT < DT.kd + DT.lying) return this.frameAt('knockdown', this.downT).img;   // 마지막 장(누움)에서 멈춤
      return this.frameAt('getup', this.downT - DT.kd - DT.lying).img;
    }
    if (this.state === 'stagger') {
      var d = T.stagger.d, t = this.stagT, i = 0;
      while (i < d.length - 1 && t >= d[i]) { t -= d[i]; i++; }
      return this.art.stagger[i];
    }
    if (this.state === 'attack') {
      var a = this.atk, s = a.spec, imgs = this.art[s.anim];
      if (s.type === 'charge') {
        if (a.phase === 'wind') return imgs[a.t < s.windMs ? 0 : 1];
        if (a.phase === 'run') return imgs[2 + (Math.floor(a.t / s.stepMs) % 2)];
        if (a.phase === 'impact') return imgs[4];
        return imgs[0];
      }
      return this.frameAt(s.anim, a.t).img;
    }
    if (this.state === 'walk') return this.frameAt(T.walkAnim, this.animT).img;
    return this.frameAt('idle', this.animT).img;
  };

  // 화면 밖으로 못 나감(들어온 뒤로)
  Enemy.prototype.keepInView = function (ctx) {
    var w = ctx.world;
    var x0 = ctx.view.x0 + 12 * AS(), x1 = ctx.view.x1 - 12 * AS();
    if (!this.entered && this.x > x0 && this.x < x1) this.entered = true;
    if (this.entered) this.x = Math.max(x0, Math.min(x1, this.x));
    this.y = Math.max(w.laneTop, Math.min(w.laneBottom, this.y));
  };

  // 바닥 예고 표시(빨간 띠): 보스 공격 예고 장면 동안
  Enemy.prototype.drawTelegraph = function (g, camX) {
    if (this.state !== 'attack') return;
    var a = this.atk, s = a.spec, r = null, k = 0;
    if (s.type === 'charge') {
      if (a.phase !== 'wind') return;
      r = { x0: 0, x1: s.dist + 90 * AS() }; k = a.t / s.windMs;
    } else if (s.telegraph && this.T.boss) {
      // 공격 시작 ~ 첫 판정 그림 직전까지
      var A = this.T.anims[s.anim], firstMs = A.playback.indexOf(s.active[0]) * 1000 / A.fps;
      if (a.t >= firstMs) return;
      r = s.reach; k = a.t / firstMs;
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
    var x = Math.round(this.x - camX), y = Math.round(this.y);
    var AI = this.cfg.ai;
    var alpha = 1;
    if (this.state === 'dead') {
      var len = this.frameAt('death', 0).len, t = this.deadT - len - AI.deathHoldMs;
      if (t > 0) { if (Math.floor(t / 70) % 2 === 0) return; alpha = Math.max(0.2, 1 - t / AI.deathFadeMs); }
    }
    window.drawShadow(g, x, y, Math.round(T.radius * 1.1));
    if (!img) return;
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    g.scale(-this.dir, 1);        // 그림이 왼쪽을 보므로 반대로
    g.drawImage(img, -T.pivot.x, -T.pivot.y);
    if (this.flashT > 0) {
      var s = FX.whiteSilhouette(img, 0, 0, img.width, img.height, 1);
      g.globalAlpha = alpha * Math.min(1, this.flashT / (this.cfg.juice.flashMs * 0.5));
      g.drawImage(s, 0, 0, img.width, img.height, -T.pivot.x, -T.pivot.y, img.width, img.height);
    }
    g.restore();
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

  window.Enemy = Enemy;
})();
