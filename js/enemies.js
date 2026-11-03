// 적: 고블린 · 늑대 · 오크 족장(보스). 수치는 전부 config.js 의 enemies.
// 그림은 전부 「왼쪽을 봄」 → 그릴 때 ctx.scale(-dir, 1)  (dir = 1 이면 오른쪽을 봄)
(function () {
  var uid = 0;
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randi(a) { return Math.round(rand(a[0], a[1])); }
  function inList(list, n) { return !!list && list.indexOf(n) >= 0; }

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
  }

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

  // 플레이어에게 맞음. dir = 밀려나는 방향. 돌려주는 값: 'dead' / 'stagger' / 'armor'
  Enemy.prototype.takeHit = function (dmg, dir, knockPx, finisher) {
    if (!this.alive()) return null;
    var T = this.T, AI = this.cfg.ai;
    this.hp = Math.max(0, this.hp - dmg);
    this.flashT = this.cfg.juice.flashMs;
    var kv = dir * knockPx * AI.enemyKnockMul * (T.knockResist != null ? T.knockResist : 1) * 10;
    if (this.hp <= 0) {
      this.state = 'dead'; this.animT = 0; this.deadT = 0; this.atk = null;
      this.vx = dir * T.deathKnock;
      this.dir = -dir;
      return 'dead';
    }
    // 보스: 공격 중이거나 방금 움찔했으면 안 끊김(번쩍이기만)
    var armored = (T.superArmor && this.state === 'attack') || this.staggerCd > 0;
    if (armored) { this.vx += kv * 0.15; return 'armor'; }
    this.state = 'hit'; this.animT = 0; this.atk = null;
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
      if (this.frameAt('hit', this.animT).done) { this.state = 'idle'; this.animT = 0; }
      this.keepInView(ctx);
      return;
    }
    if (this.cool > 0) this.cool -= dtMs * (this.enraged ? 1 / this.T.enrage.cooldownMul : 1);

    if (this.state === 'attack') { this.updateAttack(dtMs, ctx); this.keepInView(ctx); return; }

    // ----- 생각하기: 플레이어 쪽으로 가서 차례가 되면 공격 -----
    var dx = p.x - this.x, dy = p.y - this.y, adx = Math.abs(dx);
    if (p.state === 'dead') { this.setMove(0, 0); this.keepInView(ctx); return; }
    if (adx > 2) this.dir = dx > 0 ? 1 : -1;
    if (!this.side || adx > 30) this.side = this.x < p.x ? -1 : 1;

    var pick = this.cool <= 0 && this.retreatT <= 0 && this.entered ? this.chooseAttack(adx, Math.abs(dy), ctx) : null;
    if (pick) { this.startAttack(pick, ctx); this.keepInView(ctx); return; }

    var wantAttack = this.cool <= 0 && this.retreatT <= 0 && (T.boss || this.mayAttack(ctx));
    var tx, ty;
    if (wantAttack) { tx = p.x + this.side * T.engage; ty = p.y; }
    else { tx = p.x + this.side * this.hoverD; ty = p.y + this.yOff; }
    if (this.retreatT > 0) { tx = p.x + this.side * (T.engage + 90); ty = p.y + this.yOff; }
    ty = Math.max(ctx.world.laneTop, Math.min(ctx.world.laneBottom, ty));
    var mx = tx - this.x, my = ty - this.y;
    var vx = Math.abs(mx) > 4 ? Math.sign(mx) * T.speedX * this.speedMul() : 0;
    var vy = Math.abs(my) > 3 ? Math.sign(my) * T.speedY * this.speedMul() : 0;
    // 목표 근처에서는 천천히
    if (Math.abs(mx) < 14) vx *= Math.abs(mx) / 14;
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
      var yOk = a.type === 'charge' ? ady <= 40 : ady <= T.alignY;
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
      if (a.dustT <= 0) { a.dustT = s.dustMs; ctx.dust(this.x - this.dir * 34, this.y, this.dir); }
      this.tryHitPlayer(s, s.bodyReach, ctx);
      var edge = this.dir > 0 ? this.x >= ctx.view.x1 - 40 : this.x <= ctx.view.x0 + 40;
      if (a.ran >= s.dist || edge) { a.phase = 'impact'; a.t = 0; ctx.shake(s.shake * 0.6); ctx.dust(this.x + this.dir * 30, this.y, this.dir); }
      return;
    }
    if (a.phase === 'impact') {
      this.x += this.dir * 40 * dt;
      this.tryHitPlayer(s, s.reach, ctx);
      if (a.t >= s.impactMs) { a.phase = 'recover'; a.t = 0; }
      return;
    }
    if (a.t >= s.recoverMs) this.endAttack();
  };

  // 지금 보여줄 그림
  Enemy.prototype.currentImg = function () {
    var T = this.T;
    if (this.state === 'dead') return this.frameAt('death', this.deadT).img;
    if (this.state === 'hit') return this.frameAt('hit', this.animT).img;
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
    var x0 = ctx.view.x0 + 12, x1 = ctx.view.x1 - 12;
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
      r = { x0: 0, x1: s.dist + 90 }; k = a.t / s.windMs;
    } else if (s.telegraph && this.T.boss) {
      // 공격 시작 ~ 첫 판정 그림 직전까지
      var A = this.T.anims[s.anim], firstMs = A.playback.indexOf(s.active[0]) * 1000 / A.fps;
      if (a.t >= firstMs) return;
      r = s.reach; k = a.t / firstMs;
    }
    if (!r) return;
    var xa = this.x + r.x0 * this.dir, xb = this.x + r.x1 * this.dir;
    var x0 = Math.round(Math.min(xa, xb) - camX), w = Math.round(Math.abs(xb - xa));
    var d = s.depth || 12, y0 = Math.round(this.y - d / 2), h = d;
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
      g.fillStyle = '#ff4a3a'; g.fillRect(x - 2 + this.dir * 14, y - T.height - 6, 3, 3); g.fillRect(x + 4 + this.dir * 14, y - T.height - 10, 2, 2);
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
