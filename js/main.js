// 게임 본체: 화면 크기, 배경, 매 장면 갱신, 타격 처리
(function () {
  var CFG = window.CFG, J = CFG.juice;
  var params = new URLSearchParams(location.search);
  var DEBUG = params.get('debug') === '1';
  if (params.get('slow')) J.timeScale = +params.get('slow') || 1;

  var canvas = document.getElementById('screen');
  var ctx = canvas.getContext('2d');
  var LW = 480, LH = 240, SCALE = 1;
  var world = { width: CFG.world.width, laneTop: 0, laneBottom: 0, floorY: 0 };
  var bgCache = null;

  // ---------- 화면 크기: 정수 배율로만 키운다(도트 선명) ----------
  function resize() {
    var dpr = window.devicePixelRatio || 1;
    var cw = window.innerWidth, ch = window.innerHeight;
    var pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
    SCALE = Math.max(1, Math.floor(ph / CFG.view.targetH));
    LW = Math.ceil(pw / SCALE); LH = Math.ceil(ph / SCALE);
    canvas.width = LW; canvas.height = LH;
    canvas.style.width = (LW * SCALE / dpr) + 'px';
    canvas.style.height = (LH * SCALE / dpr) + 'px';
    ctx.imageSmoothingEnabled = false;
    world.width = Math.max(CFG.world.width, LW);
    world.floorY = Math.round(LH * CFG.world.floorTopRatio);
    world.laneTop = world.floorY + 14;
    world.laneBottom = LH - CFG.world.floorBottomPad;
    bgCache = null;
    if (G.player) {
      G.player.y = Math.max(world.laneTop, Math.min(world.laneBottom, G.player.y));
      G.dummy.y = Math.round((world.laneTop + world.laneBottom) / 2);
    }
  }

  // ---------- 임시 배경 (코드로 그린 돌벽 + 바닥 타일) ----------
  function buildBackground() {
    var c = document.createElement('canvas');
    c.width = world.width; c.height = LH;
    var g = c.getContext('2d');
    function r(col, x, y, w, h) { g.fillStyle = col; g.fillRect(x, y, w, h); }
    var fy = world.floorY;
    // 하늘/어둠
    r('#1b1830', 0, 0, c.width, fy);
    r('#221d3a', 0, 0, c.width, Math.round(fy * 0.35));
    // 돌벽
    var wallTop = Math.round(fy * 0.28);
    r('#3a3350', 0, wallTop, c.width, fy - wallTop);
    for (var row = 0; wallTop + row * 12 < fy; row++) {
      var y = wallTop + row * 12, off = (row % 2) * 12;
      for (var x = -off; x < c.width; x += 24) {
        r('#463e60', x + 1, y + 1, 22, 10);
        r('#524a6e', x + 1, y + 1, 22, 2);
        r('#2c2640', x + 1, y + 10, 22, 1);
      }
    }
    // 벽 위 테두리
    r('#2a2440', 0, wallTop - 4, c.width, 4); r('#5e5680', 0, wallTop - 4, c.width, 1);
    // 기둥 + 횃불
    for (var px = 60; px < c.width; px += 180) {
      r('#2c2640', px - 9, wallTop - 8, 18, fy - wallTop + 8);
      r('#5a5278', px - 7, wallTop - 8, 14, fy - wallTop + 8);
      r('#6c6490', px - 7, wallTop - 8, 3, fy - wallTop + 8);
      r('#2a2440', px - 10, wallTop - 10, 20, 4);
      var ty = wallTop + Math.round((fy - wallTop) * 0.35);
      r('#3b2b20', px - 2, ty, 4, 8); r('#ff9b3d', px - 3, ty - 6, 6, 6); r('#ffe08a', px - 1, ty - 5, 2, 4);
      g.fillStyle = 'rgba(255,160,70,0.08)'; g.fillRect(px - 26, ty - 22, 52, 40);
    }
    // 바닥 경계 그늘
    r('#151225', 0, fy - 2, c.width, 4);
    // 바닥 타일
    r('#4b4058', 0, fy + 2, c.width, LH - fy);
    for (var ry = 0; fy + 2 + ry * 10 < LH; ry++) {
      var yy = fy + 2 + ry * 10, o2 = (ry % 2) * 16, shade = ry % 2 ? '#544864' : '#5a4e6a';
      for (var tx = -o2; tx < c.width; tx += 32) {
        r(shade, tx + 1, yy + 1, 30, 8);
        r('#6a5e7c', tx + 1, yy + 1, 30, 1);
      }
    }
    // 바닥 가까운 쪽 어둡게
    g.fillStyle = 'rgba(10,8,20,0.25)'; g.fillRect(0, LH - 8, c.width, 8);
    return c;
  }

  // ---------- 상태 ----------
  var G = window.GAME = {
    cfg: CFG, assets: null, player: null, dummy: null,
    hitstop: 0, hits: 0, comboHits: 0, comboT: 0, totalDmg: 0, camX: 0,
    charKey: 'male', weaponKey: 'sword', debug: DEBUG
  };

  function rand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  function overlap(h, b) {
    return h.x0 < b.x1 && h.x1 > b.x0 && h.y0 < b.y1 && h.y1 > b.y0 && Math.abs(h.z - b.z) <= h.depth;
  }

  function onHit(st, stepIndex) {
    var p = G.player, d = G.dummy;
    var W = CFG.weapons[p.weaponKey];
    var dmg = Math.round(rand(W.damage[0], W.damage[1]) * st.dmg);
    G.hitstop = J.hitstopMs * W.hitstopMul * st.hitstop;
    FX.shake(J.shakePx * W.shakeMul * st.shake, J.shakeMs * (st.finisher ? 1.5 : 1));
    d.hit(p.dir, J.knockback * W.knockMul * st.knock, J.wobble * (st.finisher ? 1.4 : 1), J.flashMs);
    var hx = d.x - p.dir * 6, hy = p.y - 52;
    FX.impact(hx, hy, p.dir, W.sparkColor, Math.round(J.sparkCount * (st.finisher ? 1.6 : 1)), !!st.finisher, G.assets.fx && G.assets.fx.impact);
    FX.damage(d.x, d.y - 96, dmg, !!st.finisher, J);
    if (J.vibrateMs > 0 && navigator.vibrate) { try { navigator.vibrate(Math.round(J.vibrateMs * (st.finisher ? 2 : 1))); } catch (e) {} }
    G.hits++; G.totalDmg += dmg;
    G.comboHits = G.comboT > 0 ? G.comboHits + 1 : 1;
    G.comboT = 1200;
    showCombo();
  }

  // ---------- 화면 위 글자 ----------
  var comboEl = document.getElementById('combo');
  function showCombo() {
    comboEl.innerHTML = '<b>' + G.comboHits + '</b> HIT';
    comboEl.classList.remove('pop'); void comboEl.offsetWidth; comboEl.classList.add('pop');
    comboEl.hidden = false;
  }

  // ---------- 갱신 ----------
  function step(realMs) {
    FX.updateShake(realMs);
    if (G.hitstop > 0) { G.hitstop -= realMs; return; }   // 멈춤: 아무것도 안 움직임
    var dt = realMs * J.timeScale;
    if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) comboEl.hidden = true; }
    var p = G.player;
    p.weaponKey = G.weaponKey;
    var ev = p.update(dt, world);
    if (ev.slash) {
      var W = CFG.weapons[p.weaponKey], st0 = ev.slash.step, a = st0.arc, sfx = st0.fx;
      var fxs = G.assets.fx && G.assets.fx.slash && G.assets.fx.slash.length ? G.assets.fx.slash : null;
      var ms = J.slashMs * (st0.finisher ? 1.5 : 1);
      if (sfx && sfx.type === 'thrust') {   // 찌르기: 짧은 직선 궤적(코드로 그림)
        FX.thrust(p.x + p.dir * sfx.x, p.y + sfx.y, p.dir, sfx.len || 40, W.arcColor, ms);
      } else if (fxs) {   // 그림 효과: 캐릭터 앞에 놓기 (타마다 위치·회전·뒤집기 다름)
        var off = sfx || CFG.art.fx.slashOffset;
        FX.slash(p.x + p.dir * off.x, p.y + off.y, p.dir, a, W.arcColor, ms, fxs, sfx);
      } else {     // 코드로 그린 궤적
        FX.slash(p.x + p.dir * 18, p.y - 56, p.dir, a, W.arcColor, J.slashMs, null);
      }
    }
    if (ev.hitCheck && overlap(p.hitbox(), G.dummy.hurtbox())) {
      p.atk.hitDone[ev.hitCheck.win] = true;   // 판정 구간마다 한 번씩 맞음
      onHit(ev.hitCheck.step, ev.hitCheck.stepIndex);
    }
    G.dummy.update(dt);
    FX.update(dt);
    // 카메라: 플레이어 따라감
    var target = p.x - LW * 0.42;
    G.camX += (target - G.camX) * Math.min(1, dt / 120);
    G.camX = Math.max(0, Math.min(world.width - LW, G.camX));
  }

  // ---------- 그리기 ----------
  function render() {
    var sh = FX.updateShake(0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CFG.view.bg; ctx.fillRect(0, 0, LW, LH);
    ctx.translate(sh.x, sh.y);
    var camX = Math.round(G.camX);
    if (!bgCache) bgCache = buildBackground();
    ctx.drawImage(bgCache, -camX, 0);

    // 깊이 순서(아래쪽 = 앞쪽)
    var ents = [
      { y: G.player.y, d: function () { G.player.draw(ctx, camX, G.assets.weapons, DEBUG); } },
      { y: G.dummy.y, d: function () { G.dummy.draw(ctx, camX, DEBUG); } }
    ].sort(function (a, b) { return a.y - b.y; });
    ents.forEach(function (e) { e.d(); });
    FX.draw(ctx, camX);

    if (DEBUG) drawDebug(camX);
  }

  function rectStroke(b, camX, col) {
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(b.x0 - camX) + 0.5, Math.round(b.y0) + 0.5, Math.round(b.x1 - b.x0), Math.round(b.y1 - b.y0));
  }
  function drawDebug(camX) {
    var p = G.player;
    rectStroke(G.dummy.hurtbox(), camX, '#3cf');
    var active = p.activeWindow() >= 0;
    rectStroke(p.hitbox(), camX, active ? '#f33' : 'rgba(255,80,80,0.35)');
    ctx.fillStyle = 'rgba(255,255,0,0.25)';
    ctx.fillRect(0, world.laneTop, LW, 1); ctx.fillRect(0, world.laneBottom, LW, 1);
  }

  // ---------- 고르기 버튼 ----------
  function bindToggles() {
    document.querySelectorAll('[data-char]').forEach(function (b) {
      b.addEventListener('click', function () { setChar(b.dataset.char); b.blur(); });
    });
    document.querySelectorAll('[data-weapon]').forEach(function (b) {
      b.addEventListener('click', function () { setWeapon(b.dataset.weapon); b.blur(); });
    });
  }
  function setChar(k) {
    if (!G.assets.characters[k]) return;
    G.charKey = k; G.player.setCharacter(G.assets.characters[k]);
    document.querySelectorAll('[data-char]').forEach(function (b) { b.classList.toggle('on', b.dataset.char === k); });
  }
  function setWeapon(k) {
    G.weaponKey = k;
    document.querySelectorAll('[data-weapon]').forEach(function (b) { b.classList.toggle('on', b.dataset.weapon === k); });
  }
  G.setChar = function (k) { setChar(k); };
  G.setWeapon = function (k) { setWeapon(k); };

  // 여자 그림이 오기 전: 남자 그림 색만 바꿔 임시로 씀 (한 번만 미리 구워 둠)
  // 머리카락(위쪽 진한 갈색) → 자주색, 옷(연한 베이지) → 하늘색. 서버로 열었을 때만 가능,
  // 파일로 직접 열면(보안상 픽셀을 못 읽음) 전체 색돌리기로 대신한다.
  function recolorPixels(g, w, h, pivotY) {
    var d = g.getImageData(0, 0, w, h), p = d.data;
    for (var i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 10) continue;
      var r = p[i] / 255, gg = p[i + 1] / 255, b = p[i + 2] / 255;
      var mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2, s = 0, hue = 0, dd = mx - mn;
      if (dd > 0) {
        s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
        hue = mx === r ? ((gg - b) / dd + (gg < b ? 6 : 0)) : mx === gg ? ((b - r) / dd + 2) : ((r - gg) / dd + 4);
        hue *= 60;
      }
      var y = (i / 4 / w) | 0;
      var nh = null;
      if (y < pivotY - 72 && hue >= 5 && hue <= 38 && l < 0.5 && s > 0.3) nh = 325;           // 머리카락
      else if (hue >= 28 && hue <= 60 && l > 0.5 && s < 0.6 && y < pivotY - 25) nh = 195;     // 옷
      if (nh === null) continue;
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s, pp = 2 * l - q, hk = nh / 360;
      [hk + 1 / 3, hk, hk - 1 / 3].forEach(function (t, j) {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        var v = t < 1 / 6 ? pp + (q - pp) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp;
        p[i + j] = Math.round(v * 255);
      });
    }
    g.putImageData(d, 0, 0);
  }
  function bakeFilter(charAssets) {
    var def = charAssets.def;
    if (!def.placeholderFilter) return;
    Object.keys(charAssets.anims).forEach(function (n) {
      charAssets.anims[n] = charAssets.anims[n].map(function (img) {
        if (!img) return img;
        var c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        var g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        g.drawImage(img, 0, 0);
        try { recolorPixels(g, c.width, c.height, def.pivot.y); }
        catch (e) {
          if (!('filter' in g)) return img;
          g.clearRect(0, 0, c.width, c.height); g.filter = def.placeholderFilter; g.drawImage(img, 0, 0);
        }
        return c;
      });
    });
  }

  // ---------- 시작 ----------
  var last = 0, acc = 0, STEP = 1000 / 60;
  function frame(now) {
    var real = Math.min(100, now - (last || now)); last = now;
    acc += real;
    var n = 0;
    while (acc >= STEP && n < 5) { step(STEP); acc -= STEP; n++; }
    if (n === 5) acc = 0;
    render();
    if (DEBUG && window.Debug) Debug.tick(real, G);
    requestAnimationFrame(frame);
  }

  Assets.loadAll(CFG).then(function (assets) {
    G.assets = assets;
    Object.keys(assets.characters).forEach(function (k) { bakeFilter(assets.characters[k]); });
    G.player = new Player(CFG);
    G.dummy = new Dummy(CFG, assets.dummy);
    resize();
    G.player.y = Math.round((world.laneTop + world.laneBottom) / 2);
    G.dummy.y = G.player.y;
    G.camX = Math.max(0, G.player.x - LW * 0.42);
    setChar('male'); setWeapon('sword');
    bindToggles();
    Input.init(CFG);
    if (DEBUG && window.Debug) Debug.init(G);
    document.body.classList.add('ready');
    requestAnimationFrame(frame);
  });
  window.addEventListener('resize', function () { if (G.player) resize(); });
})();
