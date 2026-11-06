// 날아가는 공격(법사 마법탄 등): 목록에 넣고 → 매 장면 앞으로 이동 → 맞을 대상과 겹치면 onImpact 로 알림
// 맞았을 때 무엇을 할지(데미지·터짐)는 main.js 가 정한다. 여기는 「날아가기 + 처음 맞은 대상 찾기 + 그리기」만.
(function () {
  var list = [];

  // o = { x, y(화면 높이, 발 기준이 아닌 실제 y), z(걷는 줄 = 쏜 사람 발 y), dir(1/-1), speed(도트/초), range(도트),
  //       box: { w, h } 탄 크기, depth = 위아래(줄) 판정 폭, frames = 그림 목록, fps, pivot, burstAtEnd,
  //       backReach = 처음 한 번은 나온 곳에서 이만큼 뒤(쏜 사람 쪽)까지도 확인 → 바로 앞에 붙은 적을 탄이 건너뛰지 않게,
  //       skip(대상) = true 면 그 대상은 안 맞음(꿰뚫는 기술 탄: 이미 맞은 적·누운 적, 2026-11-06),
  //       drawFn(ctx) = 그림 대신 코드로 그리기, fade = 끝나기 전 이 거리(도트) 동안 흐려짐, loop = [첫, 끝] 장만 반복(앞 장은 한 번),
  //       ...아무 값(main 이 씀) }
  //   onImpact 안에서 p.dead = false 로 되돌리면 꿰뚫고 계속 날아감(검기·Lv5 얼음창)
  function spawn(o) {
    o.trav = 0; o.t = 0; o.dead = false;
    list.push(o);
    return o;
  }

  function box(p) {
    var w = (p.box && p.box.w) || 16, h = (p.box && p.box.h) || 16;
    return { x0: p.x - w / 2, x1: p.x + w / 2, y0: p.y - h / 2, y1: p.y + h / 2, z: p.z, depth: p.depth || 14 };
  }

  function overlap(h, b) {
    return h.x0 < b.x1 && h.x1 > b.x0 && h.y0 < b.y1 && h.y1 > b.y0 && Math.abs(h.z - b.z) <= h.depth;
  }

  // targets = 맞을 수 있는 대상 목록(hurtbox(), canBeHit() 있으면 확인), onImpact(p, target 또는 null(끝까지 날아감))
  function update(dtMs, targets, onImpact) {
    for (var i = list.length - 1; i >= 0; i--) {
      var p = list[i];
      if (!p.dead) {
        // 빠른 탄이 얇은 몸을 건너뛰지 않게 한 번에 최대 8도트씩 나눠 움직이며 확인
        var move = p.speed * dtMs / 1000, steps = Math.max(1, Math.ceil(move / 8));
        for (var s = 0; s < steps && !p.dead; s++) {
          var m = Math.min(move / steps, p.range - p.trav);
          p.x += p.dir * m; p.trav += m;
          var b = box(p), hit = null, best = 1e9;
          if (p.backReach && !p.checkedBack) {   // 첫 확인: 쏜 사람 앞 ~ 나온 곳까지 넓혀서
            p.checkedBack = true;
            if (p.dir > 0) b.x0 -= p.backReach; else b.x1 += p.backReach;
          }
          targets.forEach(function (t) {
            // skip 이 있으면 그것이 맞을 수 있나까지 정함(기술 탄: H.canHit → 검기는 누운 적도, 2026-11-06)
            if (!t || (p.skip ? p.skip(t) : (t.canBeHit && !t.canBeHit()))) return;
            if (!overlap(b, t.hurtbox())) return;
            var d = (t.x - p.x) * p.dir;          // 앞쪽으로 가장 가까운 대상 먼저
            if (d < best) { best = d; hit = t; }
          });
          // 탄마다 자기 onImpact 가 있으면 그것(기술 화염구), 없으면 공통(법사 3타 마법탄)
          if (hit) {   // 터지는 곳 = 맞은 몸 안(뒤쪽 확인으로 맞았으면 몸 쪽으로 당김)
            var hb = hit.hurtbox();
            p.x = Math.max(hb.x0, Math.min(hb.x1, p.x));
            p.dead = true; (p.onImpact || onImpact)(p, hit);
          }
          else if (p.trav >= p.range - 0.01) { p.dead = true; if (p.burstAtEnd) (p.onImpact || onImpact)(p, null); }
        }
        p.t += dtMs;
      }
      if (p.dead) list.splice(i, 1);
    }
  }

  // 몇 번째 장: loop = [첫, 끝] 이 있으면 앞 장(나가는 순간)은 한 번 → 그 구간만 반복(2026-11-06 우리 검기), 없으면 전부 반복
  function frameIdx(p) {
    var n = Math.floor(p.t / 1000 * (p.fps || 12)), L = p.loop;
    if (!L) return n % p.frames.length;
    return n < L[0] ? n : L[0] + (n - L[0]) % (L[1] - L[0] + 1);
  }
  function draw(ctx, camX) {
    list.forEach(function (p) {
      var fr = p.frames && p.frames.length ? p.frames[frameIdx(p)] : null;
      var x = snapPx(p.x - camX), y = snapPx(p.y);
      var fa = p.fade ? Math.max(0, Math.min(1, (p.range - p.trav) / p.fade)) : 1;
      if (!fr && p.drawFn) {   // 코드로 그린 탄(그림이 없을 때 검기 등)
        ctx.save(); ctx.translate(x, y); if (p.dir < 0) ctx.scale(-1, 1); ctx.globalAlpha = fa;
        if (p.glow) p.glow(ctx);
        p.drawFn(ctx); ctx.restore();
        return;
      }
      if (!fr) {   // 그림이 없으면 보라색 동그라미
        ctx.fillStyle = '#c99bff'; ctx.fillRect(x - 5, y - 4, 10, 8);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 2, 4, 4);
        return;
      }
      var pv = p.pivot || Assets.centerOf(fr);
      ctx.save(); ctx.translate(x, y); if (p.dir < 0) ctx.scale(-1, 1);   // 그림은 오른쪽으로 날아감
      if (fa < 1) ctx.globalAlpha = fa;
      if (p.scale && p.scale !== 1) ctx.scale(p.scale, p.scale);        // 크기 배율(기술 화염구 = 마법탄 그림을 크게)
      if (p.glow) p.glow(ctx);                                           // 그림 뒤 빛(화염구)
      Assets.blit(ctx, fr, pv.x, pv.y);
      ctx.restore();

    });
  }

  window.Projectiles = {
    list: list, spawn: spawn, update: update, draw: draw,
    clear: function () { list.length = 0; }
  };
})();
