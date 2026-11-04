// 등장인물: 플레이어(견습 모험가) + 허수아비
(function () {
  // 캐릭터 크기(config actorScale): 코드에 바로 적힌 거리(그림자 폭 등)에 곱한다
  function AS() { return (window.CFG && window.CFG.actorScale) || 1; }

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
    // 기술 (skills.js): sk = 지금 쓰는 기술 진행, skillCd = 기술별 남은 쿨타임(ms, 키 = '직업.A'),
    // classKey/gender = 지금 직업·성별(main.js 가 매 장면 넣음)
    this.sk = null; this.skillCd = {};
    this.classKey = null; this.gender = 'male';
    // 달리기·점프 (2026-11-03): z = 땅에서 뜬 높이(도트, 그림자는 땅에 남음), vz = 위로 가는 속도, gz = 중력
    //   runDist = 달린 거리(그림을 거리로 넘김), jp = 점프 진행, ratk = 달리며 공격 진행
    this.z = 0; this.vz = 0; this.gz = 600;
    this.runDist = 0; this.jp = null; this.ratk = null;
    // 붙잡힘(4단계 미라 잡기, 2026-11-04): state 'held' 동안 조작 안 됨. heldBy = 잡은 적(main.js grabPlayer / releaseGrab 이 넣고 뺌)
    //   poison = 독(전갈 왕 독침) { t = 남은 시간, tick = 다음에 깎기까지, every, dmg } (main.js 가 깎음)
    this.heldBy = null; this.poison = null;
  }

  // ---------- 달리기·점프 도구 ----------
  // 이 캐릭터의 달리기·점프 자료(motions_move.json 의 한 사람 몫, 원래 크기 기준)
  Player.prototype.mv = function () { return this.char && this.char.move; };
  Player.prototype.hasMove = function () {
    var m = this.mv(), A = this.char && this.char.anims;
    return !!(m && A && A.run && A.run[0] && A.jump && A.jump[0] && this.cfg.move);
  };
  Player.prototype.runSpeed = function () { return this.cfg.player.speedX * ((this.cfg.move && this.cfg.move.runMul) || 2.3); };
  Player.prototype.airborne = function () { return this.z > 0.01 || this.vz > 0; };
  // 공중에서 떨어지기(맞아서 점프가 끊겼을 때 등). 땅에 닿으면 true
  Player.prototype.fall = function (dtMs) {
    if (!this.airborne()) return false;
    var dt = dtMs / 1000;
    this.vz -= this.gz * dt; this.z += this.vz * dt;
    if (this.z <= 0) { this.z = 0; this.vz = 0; return true; }
    return false;
  };
  // 달리기 그림 번호: 달린 거리로. 장 i 동안 몸이 travelPerFrame[i] 만큼 가야 디딘 발이 땅에 붙어 있다
  Player.prototype.runFrame = function () {
    var tr = this.mv().run.travelPerFrame, S = AS(), tot = 0, i;
    for (i = 0; i < tr.length; i++) tot += tr[i] * S;
    var d = ((this.runDist % tot) + tot) % tot;
    for (i = 0; i < tr.length; i++) { var w = tr[i] * S; if (d < w) return i; d -= w; }
    return tr.length - 1;
  };
  Player.prototype.clearMove = function () {
    if (this.state === 'jump' || this.state === 'runatk' || this.state === 'run') { this.state = 'idle'; this.animT = 0; }
    this.jp = null; this.ratk = null; this.z = 0; this.vz = 0;
  };

  // 점프 시작: vx = 뛰는 순간 좌우 속도(달리면 달리기 속도 → 멀리), run = 달리다 뜀
  Player.prototype.startJump = function (vx, run) {
    var J = this.mv().jump, C = this.cfg.move.jump, S = AS();
    var H = J.suggested.jumpHeight * S * (C.heightMul || 1), T = J.suggested.airTimeMs * (C.airMul || 1) / 1000;
    this.state = 'jump'; this.atk = null; this.animT = 0; this.ratk = null;
    this.gz = 8 * H / (T * T);
    this.jp = { phase: 'takeoff', t: 0, H: H, v0: 4 * H / T, vx: vx, run: !!run, atk: null, attacked: false };
    this.z = 0; this.vz = 0;
  };
  // 공중 공격 판정 값(config move.jumpAttack). 불똥은 맞은 몸 안쪽에(atTarget)
  Player.prototype.jumpAttackStep = function () {
    if (this._jaSt && this._jaSt.src === this.cfg.move.jumpAttack) return this._jaSt;
    var st = {}, k, C = this.cfg.move.jumpAttack;
    for (k in C) st[k] = C[k];
    st.src = C; st.hitY = -40 * AS(); st.atTarget = true;
    return (this._jaSt = st);
  };
  Player.prototype.updateJump = function (dtMs, ev) {
    var jp = this.jp, C = this.cfg.move, J = this.mv().jump, dt = dtMs / 1000, ax = Input.axis(this.cfg);
    jp.t += dtMs;
    if (jp.phase === 'takeoff') {            // 웅크림(땅): 뛴 속도의 일부만 계속
      this.x += jp.vx * dt * 0.6;
      if (jp.t >= J.ms.takeoff) { jp.phase = 'air'; jp.t = 0; this.vz = jp.v0; }
      return;
    }
    if (jp.phase === 'air') {
      // 좌우: 누르면 그쪽으로 천천히 바뀜(steer), 안 누르면 뛴 속도 그대로
      var top = jp.run ? this.runSpeed() : this.cfg.player.speedX;
      if (Math.abs(ax.x) > 0.1) {
        jp.vx += (ax.x * top - jp.vx) * Math.min(1, dt * (C.jump.steer || 5));
        if (!jp.atk) this.dir = ax.x > 0 ? 1 : -1;
      }
      this.x += jp.vx * dt;
      this.y += ax.y * this.cfg.player.speedY * (C.jump.depthMul || 0.5) * dt;
      this.vz -= this.gz * dt; this.z += this.vz * dt;
      // 공중 공격(한 번 뛸 때 한 번): 1·2장이 판정
      if (!jp.attacked && this.char.anims.jump_attack && this.char.anims.jump_attack[0] && Input.takeAttack(this.cfg.combo.bufferMs)) {
        jp.attacked = true; jp.atk = { t: 0, i: 0, done: {}, active: false };
      }
      var a = jp.atk;
      if (a) {
        var JA = this.mv().jump_attack, last = JA.ms.length - 1;
        a.t += dtMs;
        while (a.i < last && a.t >= JA.ms[a.i]) { a.t -= JA.ms[a.i]; a.i++; }
        a.active = JA.active.indexOf(a.i) >= 0;
        if (a.active) {
          if (!a.swung) { a.swung = true; ev.moveSwing = { kind: 'jump' }; }
          ev.hitCheck = { step: this.jumpAttackStep(), done: a.done, move: 'jump' };
        }
      }
      if (this.z <= 0 && this.vz < 0) {      // 땅에 닿음 → 착지(공중 공격 도중이면 끊김)
        this.z = 0; this.vz = 0; jp.phase = 'land'; jp.t = 0;
        if (a) a.active = false;
        ev.land = true;
      }
      return;
    }
    if (jp.t >= J.ms.land) { this.state = 'idle'; this.jp = null; this.animT = 0; }   // 착지 웅크림 끝
  };
  Player.prototype.jumpFrame = function () {
    var jp = this.jp;
    if (jp.phase === 'takeoff') return { anim: 'jump', idx: 0 };
    if (jp.phase === 'land') return { anim: 'jump', idx: 4 };
    if (jp.atk) return { anim: 'jump_attack', idx: Math.min(3, jp.atk.i) };
    if (this.z >= jp.H * 0.7 || Math.abs(this.vz) < jp.v0 * 0.2) return { anim: 'jump', idx: 2 };   // 꼭대기 근처
    return { anim: 'jump', idx: this.vz > 0 ? 1 : 3 };
  };

  // 달리며 공격: entry → 밀고 가는 반복(1·2장) → finish → recover (config move.runAttack, 자료 run_attack)
  Player.prototype.startRunAttack = function () {
    this.state = 'runatk'; this.animT = 0; this.atk = null; this.jp = null;
    this.ratk = { phase: 'entry', t: 0, pt: 0, tickT: 0, ids: {}, had: false, contact: false, finHit: false, fdone: {}, v: this.runSpeed() };
  };
  Player.prototype.runAttackStep = function (which) {
    var R = this.mv().run_attack, C = this.cfg.move.runAttack;
    var src = which === 'tick' ? C.tick : (R.kind === 'slide' ? C.slide : C.charge);
    this._raSt = this._raSt || {};
    var key = which + '|' + R.kind;
    if (this._raSt[key] && this._raSt[key].src === src) return this._raSt[key];
    var st = {}, k;
    for (k in src) st[k] = src[k];
    st.src = src; st.hitY = (src.hitY || -50) * AS();
    if (which !== 'tick') st.finisherText = true;
    return (this._raSt[key] = st);
  };
  Player.prototype.updateRunAttack = function (dtMs, ev) {
    var R = this.mv().run_attack, C = this.cfg.move.runAttack, a = this.ratk, dt = dtMs / 1000;
    var push = R.bodyTravel.pushLoopSpeed * AS() * (C.speedMul || 1), dx = 0;
    a.t += dtMs;
    if (a.phase === 'entry') {
      dx = a.v * dt;                                  // 달리던 속도 그대로 들어감
      if (a.t >= R.ms.entry) { a.phase = 'push'; a.t = 0; a.tickT = 0; }
    } else if (a.phase === 'push') {
      dx = push * dt; a.pt += dtMs;
      a.tickT -= dtMs;
      if (a.tickT <= 0) { a.tickT += C.tickMs; ev.hitCheck = { step: this.runAttackStep('tick'), done: {}, push: true, move: 'run' }; }
      // 최소 시간이 지났고 닿았던 적이 떨어졌으면 / 최대 시간이면 → 마무리
      if (a.pt >= C.maxLoopMs || (a.pt >= C.minLoopMs && a.had && !a.contact)) { a.phase = 'finish'; a.t = 0; }
    } else if (a.phase === 'finish') {
      dx = push * dt * Math.max(0, 1 - a.t / R.ms.finish);   // 마무리하며 멈춤
      if (!a.finHit) { a.finHit = true; ev.hitCheck = { step: this.runAttackStep('finish'), done: a.fdone, finish: true, move: 'run' }; ev.moveSwing = { kind: R.kind }; }
      if (a.t >= R.ms.finish) { a.phase = 'recover'; a.t = 0; }
    } else if (a.t >= R.ms.recover) {
      this.state = 'idle'; this.ratk = null; this.animT = 0; this.comboIdleT = 0; this.comboStep = 0;
      return;
    }
    if (dx) { this.x += dx * this.dir; ev.push = { dx: dx * this.dir }; }
  };
  Player.prototype.runAttackFrame = function () {
    var a = this.ratk, R = this.mv().run_attack;
    if (a.phase === 'entry') return 0;
    if (a.phase === 'push') return 1 + (Math.floor(a.pt / R.ms.pushLoop) % 2);
    return a.phase === 'finish' ? 3 : 4;
  };
  // 달리며 공격·공중 공격의 지금 판정 상자(원래 크기 reach → 줄임). 판정 안 나는 장이면 null
  Player.prototype.moveReach = function () {
    var S = AS(), r = null, C = this.cfg.move;
    if (this.state === 'runatk' && this.ratk && (this.ratk.phase === 'push' || this.ratk.phase === 'finish')) {
      r = this.mv().run_attack.reach[this.runAttackFrame()];
      if (!r) return null;
      return { x0: Math.max(r.x0, -8) * S, x1: r.x1 * S, yTop: r.yTop * S, yBot: r.yBot * S, depth: C.runAttack.depth || 10 };
    }
    if (this.state === 'jump' && this.jp && this.jp.atk && this.jp.atk.active) {
      r = this.mv().jump_attack.reach[this.jp.atk.i];
      if (!r) return null;
      return { x0: r.x0 * S, x1: r.x1 * S, yTop: r.yTop * S, yBot: (r.yBot + (C.jumpAttack.reachDown || 0)) * S, depth: C.jumpAttack.depth || 10 };
    }
    return null;
  };
  Player.prototype.moveActive = function () { return !!this.moveReach() && (this.state === 'jump' || (this.ratk && (this.ratk.phase === 'push' || (this.ratk.phase === 'finish' && this.ratk.t < 60)))); };

  // 장마다 시간(d, ms) 목록에서 t 일 때 몇 번째 장인지. 마지막 장을 넘기면 마지막 장(done = true)
  function seqAt(d, t) {
    for (var i = 0; i < d.length; i++) { if (t < d[i]) return { idx: i, done: false }; t -= d[i]; }
    return { idx: d.length, done: true };
  }
  function sum(d) { var s = 0; for (var i = 0; i < d.length; i++) s += d[i]; return s; }

  // 넘어짐 그림(knockdown/getup)이 있는 캐릭터인지 (예전 견습 그림 ?art=novice 에는 없음)
  Player.prototype.hasDownArt = function () {
    var A = this.char && this.char.def.anims;
    return !!(A && A.knockdown && A.getup && this.char.anims.knockdown && this.char.anims.knockdown[0]);
  };
  Player.prototype.hasHurt2 = function () {
    var A = this.char && this.char.def.anims;
    return !!(A && A.hurt2 && this.char.anims.hurt2 && this.char.anims.hurt2[0]);
  };

  // 적에게 맞음. dir = 밀려나는 방향(1 = 오른쪽). heavy = 무거운 공격(넘어짐). 맞았으면 true
  Player.prototype.takeHit = function (dmg, dir, knock, flinchMs, heavy) {
    if (this.state === 'dead' || this.state === 'down' || this.invulnT > 0) return false;
    if (this.state === 'held') return false;   // 붙잡혀 있는 동안은 다른 적에게 안 맞음(놓을 때 main.js 가 상태를 풀고 때림)
    if (this.state === 'skill' && window.Skills && Skills.invulnerable(this)) return false;   // 기술 무적 구간
    this.sk = null;                          // 기술 도중(무적 구간 밖)에 맞으면 기술은 끊김
    this.jp = null; this.ratk = null;        // 점프·달리며 공격도 끊김(공중이면 그대로 떨어짐: fall)
    var H = this.cfg.hero;
    if (!this.god) this.hp = Math.max(0, this.hp - dmg);
    this.atk = null;
    this.vx = dir * (knock || 0) * (H.knockMul || 1) * 9;
    this.dir = -dir;                         // 때린 쪽을 본다
    this.animT = 0;
    this.comboStep = 0;
    var downArt = this.hasDownArt();
    if (this.hp <= 0) {                      // 쓰러짐: 넘어짐 그림 → 누운 채로
      this.state = 'dead'; this.deadT = 0; this.invulnT = 0; this.downT = 0;
      if (downArt) this.vx = 0;              // 밀림은 넘어짐 그림에 맞춰(slide)
      return true;
    }
    if (heavy && downArt) {                  // 무거운 공격: 넘어짐 → 누움 → 일어남 (내내 무적)
      this.state = 'down'; this.downT = 0; this.vx = 0; this.invulnT = 0;
      return true;
    }
    this.state = 'hurt';
    this.hurtT = this.hurtDur = flinchMs || H.flinchMs;
    this.hurtAnim = this.hurtAlt && this.hasHurt2() ? 'hurt2' : 'hurt';   // 움찔 그림 번갈아
    this.hurtAlt = !this.hurtAlt;
    this.invulnT = H.invulnMs;
    return true;
  };

  // 넘어짐 그림 동안 뒤로 밀리기: slide = 장 1~4 시작 때의 거리, 그 사이는 고르게. t0 → t1 사이에 움직일 거리
  Player.prototype.slideBetween = function (t0, t1) {
    var D = this.cfg.hero.down, d = this.char.def.anims.knockdown.d, s = D.slide;
    function off(t) {
      var st = 0;
      for (var i = 0; i < s.length - 1; i++) {
        var len = d[i] || 1;
        if (t < st + len) return s[i] + (s[i + 1] - s[i]) * (t - st) / len;
        st += len;
      }
      return s[s.length - 1];
    }
    return (off(t1) - off(t0)) * (D.slideMul || 1);
  };
  Player.prototype.hurtbox = function () {
    var h = this.cfg.hero.hurtbox;
    var xa = this.x + h.x0 * this.dir, xb = this.x + h.x1 * this.dir, z = this.z || 0;   // 공중이면 몸 판정도 그만큼 위로
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: this.y - z + h.yTop, y1: this.y - z + h.yBot, z: this.y };
  };

  Player.prototype.setCharacter = function (charAssets) {
    this.char = charAssets; this.animT = 0;
    if (this.state === 'attack' || this.state === 'skill') { this.state = 'idle'; this.atk = null; this.sk = null; }   // 공격·기술 도중 캐릭터를 바꾸면 끊는다
    this.clearMove();
    this.comboStep = 0;
  };

  // 직업(견습/기사)이 바뀌면 콤보 묶음도 바뀐다. 공격 도중이면 그 공격은 끊는다
  Player.prototype.setMoveSet = function (k) {
    if (this.moveSet === k) return;
    this.moveSet = k;
    if (this.state === 'attack' || this.state === 'skill') { this.state = 'idle'; this.atk = null; this.sk = null; this.animT = 0; }
    this.clearMove();
    this.comboStep = 0;
  };

  // 보통 콤보 타에서 기술로 끊을 수 있나: 판정 장 도중은 안 됨, 그 타의 (첫) 판정이 시작된 뒤의 장(회복)부터 됨
  Player.prototype.canSkillCancel = function () {
    var S = this.cfg.skills;
    if (this.state !== 'attack' || !this.atk || !S || !S.cancelAfterHit) return false;
    if (this.activeWindow() >= 0) return false;
    var ws = hitWindows(this.comboSteps()[this.atk.step]);
    return this.atk.i > ws[0].active[0];
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
    // 넘어짐/쓰러짐: knockdown 그림(마지막 장 = 누움) → (넘어짐이면) getup 그림
    if ((this.state === 'down' || this.state === 'dead') && this.hasDownArt()) {
      var KD = def.anims.knockdown.d, t = this.state === 'dead' ? this.deadT : this.downT;
      var kdEnd = sum(KD) + (this.state === 'down' ? this.cfg.hero.down.lyingMs : 1e12);
      if (t < kdEnd) return { anim: 'knockdown', idx: Math.min(def.anims.knockdown.frames.length - 1, seqAt(KD, t).idx) };
      return { anim: 'getup', idx: Math.min(def.anims.getup.frames.length - 1, seqAt(def.anims.getup.d, t - kdEnd).idx) };
    }
    if (this.state === 'hurt' && this.hurtAnim === 'hurt2') {
      // 두 번째 움찔: 그림 시간(d)을 움찔 시간에 맞춰 늘이거나 줄여서 끝까지 보여 줌
      var H2 = def.anims.hurt2, k = sum(H2.d) / Math.max(1, this.hurtDur);
      return { anim: 'hurt2', idx: Math.min(H2.frames.length - 1, seqAt(H2.d, (this.hurtDur - this.hurtT) * k).idx) };
    }
    if (this.state === 'held') {   // 붙잡힘: 움찔 그림 1·2장을 번갈아(버둥거림)
      var HH = def.anims.hurt;
      return { anim: 'hurt', idx: Math.min(HH.frames.length - 1, Math.floor(this.animT * 7) % 2) };
    }
    if (this.state === 'hurt' || this.state === 'dead' || this.state === 'down') {
      var HA = def.anims.hurt, hn = HA.frames.length;
      return { anim: 'hurt', idx: Math.min(hn - 1, Math.floor(this.animT * HA.fps)) };
    }
    if (this.state === 'attack') {
      var st = this.comboSteps()[this.atk.step];
      return { anim: st.anim || 'attack', idx: st.f[this.atk.i] };
    }
    if (this.state === 'skill' && this.sk && window.Skills) return Skills.frame(this);   // 기술 그림(없으면 placeholder)
    if (this.state === 'jump' && this.jp) return this.jumpFrame();
    if (this.state === 'runatk' && this.ratk) return { anim: 'run_attack', idx: this.runAttackFrame() };
    if (this.state === 'run' && this.hasMove()) return { anim: 'run', idx: this.runFrame() };
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
    for (var ck in this.skillCd) if (this.skillCd[ck] > 0) this.skillCd[ck] -= dtMs;   // 기술 쿨타임

    // 맞고 움찔 / 넘어짐 / 쓰러짐: 조작 안 됨, 밀려나기만
    if (this.state === 'hurt' || this.state === 'dead' || this.state === 'down') {
      this.fall(dtMs);                       // 공중에서 맞았으면 떨어짐
      this.x += this.vx * dtMs / 1000;
      this.vx *= Math.exp(-dtMs / 1000 * 9);
      var downArt = this.hasDownArt();
      if (this.state === 'dead') {
        if (downArt) this.x -= this.dir * this.slideBetween(this.deadT, this.deadT + dtMs);
        this.deadT += dtMs;
      } else if (this.state === 'down') {
        var D = cfg.hero.down, A = this.char.def.anims;
        this.x -= this.dir * this.slideBetween(this.downT, this.downT + dtMs);   // 뒤(바라보는 반대쪽)로 밀림
        this.downT += dtMs;
        if (this.downT >= sum(A.knockdown.d) + D.lyingMs + sum(A.getup.d)) {     // 다 일어남 → 잠깐 깜빡이며 무적
          this.state = 'idle'; this.animT = 0; this.vx = 0; this.invulnT = D.getupBlinkMs;
        }
      } else if ((this.hurtT -= dtMs) <= 0) { this.state = 'idle'; this.animT = 0; this.vx = 0; }
      this.clamp(world);
      return ev;
    }

    // 붙잡힘(미라): 조작 안 됨. 자리는 main.js 가 잡은 적 앞에 붙여 둠
    if (this.state === 'held') { this.vx = 0; this.clamp(world); return ev; }
    // 기술 쓰는 중: 조작 안 됨(이동·판정·효과는 skills.js)
    if (this.state === 'skill') {
      if (!this.sk || Skills.advance(this, dtMs)) {
        this.state = 'idle'; this.sk = null; this.animT = 0; this.comboIdleT = 0; this.comboStep = 0;
      }
      this.clamp(world);
      return ev;
    }
    // 점프 중(공중 공격 포함) / 달리며 공격 중: 기술·콤보 안 됨
    if (this.state === 'jump' && this.jp) { this.updateJump(dtMs, ev); this.clamp(world); return ev; }
    if (this.state === 'runatk' && this.ratk) { this.updateRunAttack(dtMs, ev); this.clamp(world); return ev; }
    if (this.airborne()) this.fall(dtMs);    // 혹시 남은 높이(점프가 끊김)는 떨어뜨림

    // 기술 시작: 서 있거나 걷거나 달리는 중, 또는 공격의 회복 장(canSkillCancel)
    if (window.Skills && this.cfg.skills && !this.airborne() && (this.state !== 'attack' || this.canSkillCancel())) {
      var sd = Skills.pick(this);
      if (sd) { Skills.start(this, sd); return this.update(0, world); }
    }

    if (this.state !== 'attack') {
      this.comboIdleT += dtMs;
      if (this.comboIdleT > C.resetMs) this.comboStep = 0;
      var ax = Input.axis(cfg), canMove = this.hasMove() && !this.airborne();
      // 달리기: 입력(Input.runDir)이 달리는 쪽이고 그 쪽을 누르고 있을 때
      var rd = canMove ? Input.runDir(cfg) : 0, running = rd !== 0 && ax.x * rd > 0.3;
      if (canMove && Input.takeJump(cfg.move.jump.bufferMs || 150)) {
        // 점프: 지금 좌우 속도를 가지고 뜸(달리던 중이면 달리기 속도 → 멀리)
        this.startJump(running ? rd * this.runSpeed() : ax.x * cfg.player.speedX, running);
        return this.update(0, world);
      }
      if (Input.takeAttack(C.bufferMs)) {
        if (running && this.state === 'run' && this.char.anims.run_attack && this.char.anims.run_attack[0]) {
          this.dir = rd; this.startRunAttack();            // 달리며 공격(남 어깨 돌진 / 여 슬라이딩)
          return this.update(0, world);
        }
        this.startAttack(this.comboStep);
        this.comboIdleT = 0;
      } else {
        var dt = dtMs / 1000;
        var spX = running ? this.runSpeed() : cfg.player.speedX;
        var spY = cfg.player.speedY * (running ? (cfg.move.runDepthMul || 0.55) : 1);
        var mx = (running ? rd : ax.x) * spX * dt, my = ax.y * spY * dt;
        this.x += mx;
        this.y += my;
        if (running) {
          // 달리기 그림은 「달린 거리」로 넘김(motions_move.json travelPerFrame) → 발이 안 미끄러짐
          if (this.state !== 'run') { this.state = 'run'; this.animT = 0; this.runDist = 0; }
          this.runDist += Math.hypot(mx, my);
          this.dir = rd;
        } else {
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
        // 미리 눌러 둔 기술이 있으면 회복 장에 들어서는 순간 바로 끊고 나감
        if (window.Skills && this.canSkillCancel()) {
          var sd2 = Skills.pick(this);
          if (sd2) { Skills.start(this, sd2); return this.update(0, world); }
        }
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
          // cast = 마법(법사): 판정 상자 대신 그 구간 처음에 한 번 마법을 내보낸다(main.js 가 탄·터짐을 만든다)
          if (!a.slashed[wi]) { a.slashed[wi] = true; ev.slash = { step: w }; if (w.cast) ev.cast = { step: w }; }
          // 판정 구간마다 맞은 대상 기록(같은 대상은 한 구간에 한 번만, 여러 적은 한꺼번에 맞음)
          if (!w.cast) ev.hitCheck = { step: w, stepIndex: a.step, win: wi, done: a.hitDone[wi] || (a.hitDone[wi] = {}) };
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
    var mr = this.moveReach();   // 달리며 공격·공중 공격 (motions_move.json reach, 이미 줄인 값)
    if (mr) h = mr;
    var xa = this.x + h.x0 * this.dir, xb = this.x + h.x1 * this.dir, z = this.z || 0;   // 공중이면 그만큼 위로
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: this.y - z + h.yTop, y1: this.y - z + h.yBot, z: this.y, depth: h.depth };
  };

  Player.prototype.draw = function (ctx, camX, weaponImgs, debug) {
    var fr = this.currentFrame();
    var def = this.char.def;
    var img = this.char.anims[fr.anim][fr.idx];
    var x = snapPx(this.x - camX), z = this.z || 0;
    // 그림자는 땅(y)에 남고, 몸은 뜬 높이(z)만큼 위에. 높이 뜰수록 그림자가 작아짐
    drawShadow(ctx, x, snapPx(this.y), 22 * AS() * (1 - Math.min(0.45, z / (90 * AS()))));
    var y = snapPx(this.y - z);
    // 맞은 뒤 무적: 깜빡임
    if (this.invulnT > 0 && this.state !== 'hurt' && this.state !== 'down' && this.state !== 'dead' && Math.floor(this.invulnT / 70) % 2 === 0) return;
    ctx.save();
    ctx.translate(x, y);
    // 기술 중에는 skills.js 가 정한 방향(회전베기 placeholder = 좌우를 번갈아 뒤집어 도는 것처럼)
    ctx.scale(this.state === 'skill' && window.Skills ? Skills.facing(this) : this.dir, 1);
    // 쓰러짐(넘어짐 그림이 없는 예전 견습 그림만): 움찔 그림을 잠깐 보인 뒤 뒤로 눕힌다(발을 축으로 90도)
    if (this.state === 'dead' && this.deadT > 300 && !this.hasDownArt()) {
      ctx.rotate(-Math.PI / 2);
      ctx.globalAlpha = Math.max(0.35, 1 - (this.deadT - 300) / 2500);
    }
    var hurtFlash = img && ((this.state === 'hurt' && this.animT < 0.08) ||
      ((this.state === 'down' || this.state === 'dead') && this.animT < 0.08));

    // 무기 붙이기 (그림에 칼이 박혀 있지 않은 캐릭터만). hide = 넘어져서 손에서 놓친 장 → 안 그림
    var anc = null, wDef = null, wImg = null;
    if (!def.bakedWeapon && this.char.anchors && this.char.anchors[fr.anim]) {
      anc = this.char.anchors[fr.anim][fr.idx];
      if (anc && anc.hide) anc = null;
      wDef = this.cfg.art.weapons[this.weaponKey];
      wImg = weaponImgs[this.weaponKey];
    }
    var back = anc && wImg && (anc.layer ? anc.layer === 'back' : wDef.layer === 'back');
    var k = (img && img._k) || 1;   // 그림 점 → 도트 (HD 0.5, 예전 도트 그림 1). 손 위치·기준점은 그림 점 단위
    if (back) drawWeapon(ctx, def, anc, wDef, wImg, k);
    if (img) Assets.blit(ctx, img, def.pivot.x, def.pivot.y);
    if (anc && wImg && !back) drawWeapon(ctx, def, anc, wDef, wImg, k);
    if (hurtFlash) {   // 맞는 순간 하얗게 번쩍
      var sil = FX.whiteSilhouette(img, 0, 0, img.width, img.height, 1);
      ctx.globalAlpha = 0.7; Assets.blit(ctx, img, def.pivot.x, def.pivot.y, sil);
      ctx.globalAlpha = 1;
    }

    if (debug) {
      ctx.fillStyle = '#0f0'; ctx.fillRect(-1, -1, 3, 3); // 발 기준점
      if (anc) { ctx.fillStyle = '#f0f'; ctx.fillRect((anc.x - def.pivot.x) * k - 1, (anc.y - def.pivot.y) * k - 1, 3, 3); }
    }
    ctx.restore();
  };

  // k = 몸 그림 점 → 도트 (손 위치를 도트로 바꿈). 무기 그림은 자기 배율(Assets.blit)
  function drawWeapon(ctx, def, anc, wDef, wImg, k) {
    if (!anc) return;
    k = k || 1;
    ctx.save();
    ctx.translate((anc.x - def.pivot.x) * k, (anc.y - def.pivot.y) * k);
    ctx.rotate(anc.angle - (wDef.baseAngle || 0) * Math.PI / 180);
    Assets.blit(ctx, wImg, wDef.grip.x, wDef.grip.y);
    ctx.restore();
  }

  // 발밑 그림자: 매끈한 화면(renderScale > 1)이면 가장자리가 흐린 타원, 예전 도트 화면이면 도트 두 줄
  var shadowCache = null;
  function drawShadow(ctx, x, y, w) {
    if ((window.CFG && CFG.view.renderScale || 1) > 1) {
      if (!shadowCache) {   // 한 번만 만든 부드러운 타원(64x16) 을 늘려 그림
        var c = document.createElement('canvas'); c.width = 64; c.height = 16;
        var g = c.getContext('2d'), gr = g.createRadialGradient(32, 8, 0, 32, 8, 32);
        gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.36)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.setTransform(1, 0, 0, 0.25, 0, 6); g.fillStyle = gr; g.fillRect(0, -24, 64, 64);
        shadowCache = c;
      }
      ctx.drawImage(shadowCache, x - w * 1.15, y - w * 0.29, w * 2.3, w * 0.58);
      return;
    }
    w = Math.round(w); x = Math.round(x); y = Math.round(y);
    var e = Math.max(2, Math.round(w * 0.18));   // 가운데 두꺼운 부분이 양 끝에서 들어간 정도(원래 크기 22 → 4)
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x - w, y - 1, w * 2, 3);
    ctx.fillRect(x - w + e, y - 2, w * 2 - e * 2, 5);
  }
  // 캔버스 점 단위 반올림(renderScale 2 면 0.5 도트까지)
  function snapPx(v) { var R = (window.CFG && CFG.view.renderScale) || 1; return Math.round(v * R) / R; }
  window.snapPx = snapPx;

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
    this.homeX = cfg.player.startX + Math.round(110 * AS()); this.x = this.homeX; this.y = 0;
    this.offV = 0; this.ang = 0; this.angV = 0;
    this.flashT = 0; this.hitT = 0;
    this.art = art;          // 그림 있으면 { idle:[], hit:[] }
    this.placeholder = makeDummyArt();
    if (window.Assets && AS() !== 1) {   // 코드로 그린 허수아비도 같은 배율로 줄임
      var sh = Assets.shrink(this.placeholder.img, AS(), this.placeholder.pivot);
      this.placeholder = { img: sh.img, pivot: { x: Math.round(22 * AS()), y: Math.round(98 * AS()) } };
    }
    this.animT = 0;
  }
  Dummy.prototype.hurtbox = function () {
    var s = AS();
    return { x0: this.x - 12 * s, x1: this.x + 12 * s, y0: this.y - 88 * s, y1: this.y - 4 * s, z: this.y };
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
    var x = snapPx(this.x - camX), y = snapPx(this.y);
    drawShadow(ctx, snapPx(this.homeX - camX), y, 14 * AS());
    ctx.save();
    ctx.translate(x, y);
    // 각도를 몇 단계로만 → 도트가 덜 뭉개짐
    var step = Math.PI / 90;
    ctx.rotate(Math.round(this.ang / step) * step);
    if (f.mirror) ctx.scale(-1, 1);
    Assets.blit(ctx, f.img, f.pivot.x, f.pivot.y);
    if (this.flashT > 0) {
      var alpha = Math.min(1, this.flashT / (this.cfg.juice.flashMs * 0.5));
      var s = FX.whiteSilhouette(f.img, 0, 0, f.img.width, f.img.height, 1);
      ctx.globalAlpha = alpha;
      Assets.blit(ctx, f.img, f.pivot.x, f.pivot.y, s);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  };

  window.Player = Player;
  window.drawShadow = drawShadow;
  window.Dummy = Dummy;
})();
