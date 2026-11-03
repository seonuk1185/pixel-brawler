// 등장인물: 플레이어(견습 모험가) + 허수아비
(function () {

  // ================= 플레이어 =================
  function Player(cfg) {
    this.cfg = cfg;
    this.x = cfg.player.startX; this.y = 0;
    this.dir = 1;
    this.state = 'idle';
    this.animT = 0;
    this.walkPhase = 0;       // 걷기 진행도(0~1 = 한 사이클). 시간이 아니라 「걸은 거리」로 넘김 → 발이 미끄러지지 않음
    this.atk = null;          // 공격 중 정보
    this.comboStep = 0;       // 다음에 나갈 콤보 번호
    this.comboIdleT = 0;
    this.char = null;         // 불러온 캐릭터 그림 묶음
    this.weaponKey = 'sword';
    this.moveSet = 'sword';   // 콤보 묶음: 'fist'(견습 맨손) / 'sword'(기사)
    // 체력·맞음 (1단계 판)
    var H = cfg.hero || { hp: 100 };
    this.maxHp = H.hp; this.hp = H.hp;
    this.invulnT = 0;         // 맞은 뒤 무적(깜빡임) 남은 시간
    this.hurtT = 0;           // 움찔 남은 시간
    this.vx = 0;              // 밀려나는 속도
    this.deadT = 0;           // 쓰러진 뒤 지난 시간
    this.god = false;         // 시험용 무적
  }

  // 적에게 맞음. dir = 밀려나는 방향(1 = 오른쪽). 맞았으면 true
  Player.prototype.takeHit = function (dmg, dir, knock, flinchMs) {
    if (this.state === 'dead' || this.invulnT > 0) return false;
    var H = this.cfg.hero;
    if (!this.god) this.hp = Math.max(0, this.hp - dmg);
    this.atk = null;
    this.vx = dir * (knock || 0) * (H.knockMul || 1) * 9;
    this.dir = -dir;                         // 때린 쪽을 본다
    this.animT = 0;
    if (this.hp <= 0) { this.state = 'dead'; this.deadT = 0; this.invulnT = 0; return true; }
    this.state = 'hurt';
    this.hurtT = flinchMs || H.flinchMs;
    this.invulnT = H.invulnMs;
    this.comboStep = 0;
    return true;
  };
  Player.prototype.hurtbox = function () {
    var h = this.cfg.hero.hurtbox;
    var xa = this.x + h.x0 * this.dir, xb = this.x + h.x1 * this.dir;
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: this.y + h.yTop, y1: this.y + h.yBot, z: this.y };
  };

  Player.prototype.setCharacter = function (charAssets) {
    this.char = charAssets; this.animT = 0;
    if (this.state === 'attack') { this.state = 'idle'; this.atk = null; }   // 공격 도중 캐릭터를 바꾸면 그 공격은 끊는다
    this.comboStep = 0;
  };

  // 직업(견습/기사)이 바뀌면 콤보 묶음도 바뀐다. 공격 도중이면 그 공격은 끊는다
  Player.prototype.setMoveSet = function (k) {
    if (this.moveSet === k) return;
    this.moveSet = k;
    if (this.state === 'attack') { this.state = 'idle'; this.atk = null; this.animT = 0; }
    this.comboStep = 0;
  };

  // 지금 캐릭터의 콤보 목록: stage1 캐릭터는 직업에 맞는 자기 것(def.combos[moveSet]),
  // 없으면 def.combo(검), 예전 견습 그림은 공통(cfg.combo.steps)
  Player.prototype.comboSteps = function () {
    var def = this.char && this.char.def;
    if (def && def.combos && def.combos[this.moveSet]) return def.combos[this.moveSet];
    return (def && def.combo) || this.cfg.combo.steps;
  };

  // 한 타 안의 판정 구간 목록. 보통은 1개(그 타 자체), hits 가 있으면 여러 번 벤다(예: 여자 3타 X자 베기 = 2번).
  // hits 의 각 항목은 그 타의 값(reach·fx·dmg 등)을 덮어쓴다.
  function hitWindows(st) {
    if (!st.hits) return [st];
    if (!st._win) st._win = st.hits.map(function (h) {
      var w = {}, k;
      for (k in st) if (k !== 'hits' && k !== '_win') w[k] = st[k];
      for (k in h) w[k] = h[k];
      return w;
    });
    return st._win;
  }

  // 지금 판정이 나는 구간 번호(없으면 -1)
  Player.prototype.activeWindow = function () {
    if (this.state !== 'attack' || !this.atk) return -1;
    var ws = hitWindows(this.comboSteps()[this.atk.step]), i = this.atk.i;
    for (var k = 0; k < ws.length; k++) if (i >= ws[k].active[0] && i <= ws[k].active[ws[k].active.length - 1]) return k;
    return -1;
  };

  Player.prototype.currentFrame = function () {
    var def = this.char.def;
    if (this.state === 'hurt' || this.state === 'dead') {
      var HA = def.anims.hurt, hn = HA.frames.length;
      return { anim: 'hurt', idx: Math.min(hn - 1, Math.floor(this.animT * HA.fps)) };
    }
    if (this.state === 'attack') {
      var st = this.comboSteps()[this.atk.step];
      return { anim: st.anim || 'attack', idx: st.f[this.atk.i] };
    }
    var a = this.state === 'walk' ? 'walk' : 'idle';
    var A = def.anims[a];
    var n = A.frames.length;
    if (a === 'walk' && A.stride) return { anim: a, idx: Math.floor(this.walkPhase * n) % n };
    return { anim: a, idx: Math.floor(this.animT * A.fps) % n };
  };

  Player.prototype.startAttack = function (step) {
    this.state = 'attack';
    this.atk = { step: step, i: 0, t: 0, hitDone: {}, slashed: {}, queued: false };   // hitDone/slashed = 판정 구간별
    this.comboStep = (step + 1) % this.comboSteps().length;
  };

  // 돌려주는 값: 이번 프레임에 생긴 일 { slash, hitCheck }
  Player.prototype.update = function (dtMs, world) {
    var cfg = this.cfg, C = cfg.combo, ev = {};
    var W = cfg.weapons[this.weaponKey];
    this.animT += dtMs / 1000;
    if (this.invulnT > 0) this.invulnT -= dtMs;

    // 맞고 움찔 / 쓰러짐: 조작 안 됨, 밀려나기만
    if (this.state === 'hurt' || this.state === 'dead') {
      this.x += this.vx * dtMs / 1000;
      this.vx *= Math.exp(-dtMs / 1000 * 9);
      if (this.state === 'dead') this.deadT += dtMs;
      else if ((this.hurtT -= dtMs) <= 0) { this.state = 'idle'; this.animT = 0; this.vx = 0; }
      this.clamp(world);
      return ev;
    }

    if (this.state !== 'attack') {
      this.comboIdleT += dtMs;
      if (this.comboIdleT > C.resetMs) this.comboStep = 0;
      if (Input.takeAttack(C.bufferMs)) {
        this.startAttack(this.comboStep);
        this.comboIdleT = 0;
      } else {
        var ax = Input.axis(cfg);
        var dt = dtMs / 1000;
        var mx = ax.x * cfg.player.speedX * dt, my = ax.y * cfg.player.speedY * dt;
        this.x += mx;
        this.y += my;
        // 걷기 그림은 걸은 거리만큼 넘긴다(stride = 한 사이클(8장) 동안 가는 도트 수).
        // 위아래(안쪽) 이동은 화면상 짧게 보이므로 depthStrideMul 배로 쳐서 다리가 너무 느리게 움직이지 않게 함
        var wA = this.char && this.char.def.anims.walk;
        if (wA && wA.stride) this.walkPhase = (this.walkPhase + Math.hypot(mx, my * (wA.depthStrideMul || 1)) / wA.stride) % 1;
        if (ax.x > 0.1) this.dir = 1; else if (ax.x < -0.1) this.dir = -1;
        var moving = Math.abs(ax.x) > 0.05 || Math.abs(ax.y) > 0.05;
        if (moving && this.state !== 'walk') { this.state = 'walk'; this.animT = 0; this.walkPhase = 0; }
        if (!moving && this.state !== 'idle') { this.state = 'idle'; this.animT = 0; }
      }
    }

    if (this.state === 'attack') {
      var steps = this.comboSteps();
      var st = steps[this.atk.step];
      var a = this.atk;
      a.t += dtMs * W.speed;
      // 미리 눌러 둔 다음 공격 기억
      if (!a.queued && a.i >= 1 && Input.peekAttack(C.bufferMs) && this.atk.step < steps.length - 1) {
        Input.takeAttack(C.bufferMs); a.queued = true;
      }
      while (a.t >= st.d[a.i]) {
        a.t -= st.d[a.i]; a.i++;
        if (a.queued && a.i >= st.cancel) {   // 다음 타로 끊고 이어감
          var nx = Input.axis(cfg).x;
          if (nx > 0.3) this.dir = 1; else if (nx < -0.3) this.dir = -1;
          this.startAttack(this.atk.step + 1);
          this.comboIdleT = 0;
          return this.update(0, world);
        }
        if (a.i >= st.f.length) {               // 공격 끝
          if (st.endAdvance) this.x += st.endAdvance * this.dir;   // 그림 속에서 앞으로 나간 만큼 몸 위치를 옮김
          this.state = 'idle'; this.atk = null; this.animT = 0; this.comboIdleT = 0;
          break;
        }
        hitWindows(st).forEach(function (w) {
          if (a.i === w.active[0]) this.x += (w.lunge || 0) * this.dir;   // 판정 시작 때 앞으로 살짝 내딛기
        }, this);
      }
      if (this.atk) {
        var wi = this.activeWindow();
        if (wi >= 0) {
          var w = hitWindows(st)[wi];
          if (!a.slashed[wi]) { a.slashed[wi] = true; ev.slash = { step: w }; }
          // 판정 구간마다 맞은 대상 기록(같은 대상은 한 구간에 한 번만, 여러 적은 한꺼번에 맞음)
          ev.hitCheck = { step: w, stepIndex: a.step, win: wi, done: a.hitDone[wi] || (a.hitDone[wi] = {}) };
        }
      }
    }

    this.clamp(world);
    return ev;
  };

  // 무대 밖으로 못 나감 (1단계 판에서는 지금 보이는 화면 밖으로도 못 나감: world.minX/maxX)
  Player.prototype.clamp = function (world) {
    var x0 = world.minX != null ? world.minX : 20, x1 = world.maxX != null ? world.maxX : world.width - 20;
    this.x = Math.max(x0, Math.min(x1, this.x));
    this.y = Math.max(world.laneTop, Math.min(world.laneBottom, this.y));
  };

  Player.prototype.hitbox = function () {
    var h = this.cfg.player.hitbox;
    if (this.state === 'attack' && this.atk) {      // 타마다 판정 범위가 다름(config MOVES 의 reach)
      var st = this.comboSteps()[this.atk.step], wi = this.activeWindow();
      var r = (wi >= 0 ? hitWindows(st)[wi] : st).reach;
      if (r) h = { x0: r.x0, x1: r.x1, yTop: r.yTop, yBot: r.yBot, depth: r.depth || h.depth };
    }
    var xa = this.x + h.x0 * this.dir, xb = this.x + h.x1 * this.dir;
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: this.y + h.yTop, y1: this.y + h.yBot, z: this.y, depth: h.depth };
  };

  Player.prototype.draw = function (ctx, camX, weaponImgs, debug) {
    var fr = this.currentFrame();
    var def = this.char.def;
    var img = this.char.anims[fr.anim][fr.idx];
    var x = Math.round(this.x - camX), y = Math.round(this.y);
    drawShadow(ctx, x, y, 22);
    // 맞은 뒤 무적: 깜빡임
    if (this.invulnT > 0 && this.state !== 'hurt' && Math.floor(this.invulnT / 70) % 2 === 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(this.dir, 1);
    // 쓰러짐: 움찔 그림을 잠깐 보인 뒤 뒤로 눕힌다(발을 축으로 90도)
    if (this.state === 'dead' && this.deadT > 300) {
      ctx.rotate(-Math.PI / 2);
      ctx.globalAlpha = Math.max(0.35, 1 - (this.deadT - 300) / 2500);
    }
    var hurtFlash = this.state === 'hurt' && img && this.animT < 0.08;

    // 무기 붙이기 (그림에 칼이 박혀 있지 않은 캐릭터만)
    var anc = null, wDef = null, wImg = null;
    if (!def.bakedWeapon && this.char.anchors && this.char.anchors[fr.anim]) {
      anc = this.char.anchors[fr.anim][fr.idx];
      wDef = this.cfg.art.weapons[this.weaponKey];
      wImg = weaponImgs[this.weaponKey];
    }
    var back = anc && wImg && (anc.layer ? anc.layer === 'back' : wDef.layer === 'back');
    if (back) drawWeapon(ctx, def, anc, wDef, wImg);
    if (img) ctx.drawImage(img, -def.pivot.x, -def.pivot.y);
    if (anc && wImg && !back) drawWeapon(ctx, def, anc, wDef, wImg);
    if (hurtFlash) {   // 맞는 순간 하얗게 번쩍
      var sil = FX.whiteSilhouette(img, 0, 0, img.width, img.height, 1);
      ctx.globalAlpha = 0.7; ctx.drawImage(sil, 0, 0, img.width, img.height, -def.pivot.x, -def.pivot.y, img.width, img.height);
      ctx.globalAlpha = 1;
    }

    if (debug) {
      ctx.fillStyle = '#0f0'; ctx.fillRect(-1, -1, 3, 3); // 발 기준점
      if (anc) { ctx.fillStyle = '#f0f'; ctx.fillRect(anc.x - def.pivot.x - 1, anc.y - def.pivot.y - 1, 3, 3); }
    }
    ctx.restore();
  };

  function drawWeapon(ctx, def, anc, wDef, wImg) {
    if (!anc) return;
    ctx.save();
    ctx.translate(anc.x - def.pivot.x, anc.y - def.pivot.y);
    ctx.rotate(anc.angle - (wDef.baseAngle || 0) * Math.PI / 180);
    ctx.drawImage(wImg, -wDef.grip.x, -wDef.grip.y);
    ctx.restore();
  }

  function drawShadow(ctx, x, y, w) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x - w, y - 1, w * 2, 3);
    ctx.fillRect(x - w + 4, y - 2, w * 2 - 8, 5);
  }

  // ================= 허수아비 =================
  function makeDummyArt() {
    // 그림이 아직 없을 때 쓰는 나무 기둥 + 짚 허수아비 (도트로 직접 찍음)
    var c = document.createElement('canvas'); c.width = 44; c.height = 100;
    var g = c.getContext('2d');
    function r(col, x, y, w, h) { g.fillStyle = col; g.fillRect(x, y, w, h); }
    // 받침
    r('#4a2f1e', 10, 92, 24, 6); r('#6b4430', 12, 91, 20, 3);
    // 기둥
    r('#5a3a26', 19, 30, 7, 64); r('#7a5236', 20, 30, 3, 64); r('#3e271a', 25, 30, 1, 64);
    // 가로 팔
    r('#5a3a26', 3, 40, 38, 5); r('#7a5236', 3, 40, 38, 2);
    // 짚 몸통
    r('#a8873f', 11, 38, 23, 32); r('#c9a54f', 12, 39, 18, 29); r('#e0c46a', 14, 41, 6, 24);
    r('#7c6128', 11, 69, 23, 2);
    // 밧줄
    r('#6e3b2a', 11, 46, 23, 2); r('#6e3b2a', 11, 60, 23, 2);
    // 짚 끝
    for (var i = 0; i < 8; i++) r(i % 2 ? '#c9a54f' : '#a8873f', 12 + i * 3, 70, 2, 3 + (i % 3));
    // 머리 자루
    r('#9a7a48', 13, 12, 19, 20); r('#bfa06a', 14, 13, 15, 17); r('#d8bd84', 16, 15, 5, 8);
    r('#6e3b2a', 13, 29, 19, 3);
    // 과녁 표시
    r('#b23a3a', 18, 18, 9, 9); r('#f2e6c8', 20, 20, 5, 5); r('#b23a3a', 22, 22, 1, 1);
    // 윤곽선
    g.globalCompositeOperation = 'destination-over';
    r('#2a1a12', 12, 11, 21, 22); r('#2a1a12', 10, 37, 25, 37); r('#2a1a12', 2, 39, 40, 7); r('#2a1a12', 18, 29, 9, 66);
    r('#2a1a12', 9, 90, 26, 9);
    return { img: c, pivot: { x: 22, y: 98 } };
  }

  function Dummy(cfg, art) {
    this.cfg = cfg;
    this.homeX = cfg.player.startX + 110; this.x = this.homeX; this.y = 0;
    this.offV = 0; this.ang = 0; this.angV = 0;
    this.flashT = 0; this.hitT = 0;
    this.art = art;          // 그림 있으면 { idle:[], hit:[] }
    this.placeholder = makeDummyArt();
    this.animT = 0;
  }
  Dummy.prototype.hurtbox = function () {
    return { x0: this.x - 12, x1: this.x + 12, y0: this.y - 88, y1: this.y - 4, z: this.y };
  };
  Dummy.prototype.hit = function (dir, knock, wobble, flashMs) {
    this.offV += dir * knock * 14;           // 밀려나는 속도
    this.angV += dir * wobble * 28;          // 흔들림
    this.flashT = flashMs;
    this.hitT = 260;
    this.hitDir = dir;                       // 그림 hit 은 「왼쪽에서 맞음」 기준
  };
  Dummy.prototype.update = function (dtMs) {
    var dt = dtMs / 1000, J = this.cfg.juice;
    this.animT += dt;
    var k = J.knockReturn;
    // 밀림 → 용수철처럼 제자리로
    var off = this.x - this.homeX;
    this.offV += (-k * k * off - 2 * k * 0.55 * this.offV) * dt;
    this.x += this.offV * dt;
    // 기울기 → 흔들흔들 멈춤
    this.angV += (-260 * this.ang - 9 * this.angV) * dt;
    this.ang += this.angV * dt;
    this.ang = Math.max(-0.6, Math.min(0.6, this.ang));
    if (this.flashT > 0) this.flashT -= dtMs;
    if (this.hitT > 0) this.hitT -= dtMs;
  };
  Dummy.prototype.frame = function () {
    if (this.art) {
      var fps = (this.cfg.art.dummy && this.cfg.art.dummy.fps) || 10;
      if (this.hitT > 0 && this.art.hit.length) {
        var i = Math.min(this.art.hit.length - 1, Math.floor((260 - this.hitT) / 1000 * fps));
        return { img: this.art.hit[i], pivot: this.cfg.art.dummy.pivot, mirror: this.hitDir < 0 };
      }
      if (this.art.idle.length) return { img: this.art.idle[Math.floor(this.animT * fps) % this.art.idle.length], pivot: this.cfg.art.dummy.pivot };
    }
    return this.placeholder;
  };
  Dummy.prototype.draw = function (ctx, camX, debug) {
    var f = this.frame();
    var x = Math.round(this.x - camX), y = Math.round(this.y);
    drawShadow(ctx, Math.round(this.homeX - camX), y, 14);
    ctx.save();
    ctx.translate(x, y);
    // 각도를 몇 단계로만 → 도트가 덜 뭉개짐
    var step = Math.PI / 90;
    ctx.rotate(Math.round(this.ang / step) * step);
    if (f.mirror) ctx.scale(-1, 1);
    ctx.drawImage(f.img, -f.pivot.x, -f.pivot.y);
    if (this.flashT > 0) {
      var alpha = Math.min(1, this.flashT / (this.cfg.juice.flashMs * 0.5));
      var s = FX.whiteSilhouette(f.img, 0, 0, f.img.width, f.img.height, 1);
      ctx.globalAlpha = alpha;
      ctx.drawImage(s, 0, 0, f.img.width, f.img.height, -f.pivot.x, -f.pivot.y, f.img.width, f.img.height);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  };

  window.Player = Player;
  window.drawShadow = drawShadow;
  window.Dummy = Dummy;
})();
