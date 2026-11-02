// 등장인물: 플레이어(견습 모험가) + 허수아비
(function () {

  // ================= 플레이어 =================
  function Player(cfg) {
    this.cfg = cfg;
    this.x = cfg.player.startX; this.y = 0;
    this.dir = 1;
    this.state = 'idle';
    this.animT = 0;
    this.atk = null;          // 공격 중 정보
    this.comboStep = 0;       // 다음에 나갈 콤보 번호
    this.comboIdleT = 0;
    this.char = null;         // 불러온 캐릭터 그림 묶음
    this.weaponKey = 'sword';
  }

  Player.prototype.setCharacter = function (charAssets) { this.char = charAssets; this.animT = 0; };

  Player.prototype.currentFrame = function () {
    var def = this.char.def;
    if (this.state === 'attack') {
      var st = this.cfg.combo.steps[this.atk.step];
      return { anim: 'attack', idx: st.f[this.atk.i] };
    }
    var a = this.state === 'walk' ? 'walk' : 'idle';
    var A = def.anims[a];
    var n = A.frames.length;
    return { anim: a, idx: Math.floor(this.animT * A.fps) % n };
  };

  Player.prototype.startAttack = function (step) {
    this.state = 'attack';
    this.atk = { step: step, i: 0, t: 0, hitDone: false, slashed: false, queued: false };
    this.comboStep = (step + 1) % this.cfg.combo.steps.length;
  };

  // 돌려주는 값: 이번 프레임에 생긴 일 { slash, hitCheck }
  Player.prototype.update = function (dtMs, world) {
    var cfg = this.cfg, C = cfg.combo, ev = {};
    var W = cfg.weapons[this.weaponKey];
    this.animT += dtMs / 1000;

    if (this.state !== 'attack') {
      this.comboIdleT += dtMs;
      if (this.comboIdleT > C.resetMs) this.comboStep = 0;
      if (Input.takeAttack(C.bufferMs)) {
        this.startAttack(this.comboStep);
        this.comboIdleT = 0;
      } else {
        var ax = Input.axis(cfg);
        var dt = dtMs / 1000;
        this.x += ax.x * cfg.player.speedX * dt;
        this.y += ax.y * cfg.player.speedY * dt;
        if (ax.x > 0.1) this.dir = 1; else if (ax.x < -0.1) this.dir = -1;
        var moving = Math.abs(ax.x) > 0.05 || Math.abs(ax.y) > 0.05;
        if (moving && this.state !== 'walk') { this.state = 'walk'; this.animT = 0; }
        if (!moving && this.state !== 'idle') { this.state = 'idle'; this.animT = 0; }
      }
    }

    if (this.state === 'attack') {
      var st = C.steps[this.atk.step];
      var a = this.atk;
      a.t += dtMs * W.speed;
      // 미리 눌러 둔 다음 공격 기억
      if (!a.queued && a.i >= 1 && Input.peekAttack(C.bufferMs) && this.atk.step < C.steps.length - 1) {
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
          this.state = 'idle'; this.atk = null; this.animT = 0; this.comboIdleT = 0;
          break;
        }
        if (a.i === st.active[0]) {
          this.x += st.lunge * this.dir;          // 앞으로 살짝 내딛기
        }
      }
      if (this.atk) {
        var active = a.i >= st.active[0] && a.i <= st.active[st.active.length - 1];
        if (active && !a.slashed) { a.slashed = true; ev.slash = { step: st }; }
        if (active && !a.hitDone) ev.hitCheck = { step: st, stepIndex: a.step };
      }
    }

    // 무대 밖으로 못 나감
    this.x = Math.max(20, Math.min(world.width - 20, this.x));
    this.y = Math.max(world.laneTop, Math.min(world.laneBottom, this.y));
    return ev;
  };

  Player.prototype.hitbox = function () {
    var h = this.cfg.player.hitbox;
    var xa = this.x + h.x0 * this.dir, xb = this.x + h.x1 * this.dir;
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: this.y + h.yTop, y1: this.y + h.yBot, z: this.y, depth: h.depth };
  };

  Player.prototype.draw = function (ctx, camX, weaponImgs, debug) {
    var fr = this.currentFrame();
    var def = this.char.def;
    var img = this.char.anims[fr.anim][fr.idx];
    var x = Math.round(this.x - camX), y = Math.round(this.y);
    drawShadow(ctx, x, y, 22);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(this.dir, 1);

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
  window.Dummy = Dummy;
})();
