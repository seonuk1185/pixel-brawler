// 그림 불러오기 + 손 위치(anchor) json 읽기
(function () {
  var cache = {};

  // 미리 구운 작은 그림(pipeline/ai-sprite/shrink.js → assets/s055/...): manifest 의 scale 이 actorScale 과 같을 때만 쓴다
  var baked = null;   // { dir: 'assets/s055/', files: { 원래 경로: true } }
  function loadImage(src) {
    if (!src) return Promise.resolve(null);
    if (cache[src]) return cache[src];
    var bk = baked && baked.files[src] ? baked.dir + src.replace(/^assets\//, '') : null;
    cache[src] = new Promise(function (res) {
      function load(url, isBaked) {
        var im = new Image();
        im.onload = function () { im._baked = isBaked; res(im); };
        im.onerror = function () {
          if (isBaked) { load(src, false); return; }   // 구운 그림이 없으면 원래 그림(불러올 때 줄임)
          console.warn('그림 못 읽음:', src); res(null);
        };
        im.src = url;
      }
      load(bk || src, !!bk);
    });
    return cache[src];
  }
  function loadList(list) { return Promise.all((list || []).map(loadImage)); }

  // ---------- 작게 줄이기 (CFG.actorScale, 예: 0.7) ----------
  // 도트 그림을 0.7배처럼 딱 떨어지지 않는 배율로 그냥 줄이면(가장 가까운 점 고르기) 30% 줄·칸이 통째로 빠져서
  // 윤곽선이 끊기고 들쭉날쭉해진다. 그래서 불러올 때 한 번만 미리 줄여 둔다(게임 중에는 1:1 로 그림 → 선명함 그대로):
  //   새 점 하나가 덮는 원래 점들을 「덮은 면적」만큼 따져서 색을 섞고(면적 평균),
  //   투명도는 절반 넘게 덮였으면 불투명, 아니면 투명 → 가장자리가 흐려지지 않고 또렷하다
  //   (2026-11-03 비교: 그냥 줄이기(nearest)는 윤곽선이 끊김, 가장 넓은 색 고르기(dominant)는 점이 지저분하게 튐,
  //    브라우저 부드럽게 줄이기+투명도 자르기는 머리카락 끝에 하얀 점이 생김 → 면적 평균(area)이 가장 깔끔. mode 로 바꿔 볼 수 있음)
  // pivot(발 기준점·손잡이 등)이 줄인 그림에서도 정확히 정수 점에 오도록 살짝 밀어서 줄인다(off = 민 양)
  //   → 좌우 뒤집어 그려도 발 위치가 1도트도 안 어긋나고, 손 위치(anchor)도 같은 양만큼 밀면 딱 맞는다
  function shrinkPlan(s, p) {
    var o = Math.round(p * s) - p * s;
    return { o: o, pv: Math.round(p * s) };
  }
  // 한 축(가로 또는 세로)의 「새 점 → 덮는 원래 점과 면적」 목록
  function axisCover(n, s, o) {
    var m = Math.ceil(n * s + o) + 1, out = [];
    for (var X = 0; X < m; X++) {
      var a = (X - o) / s, b = (X + 1 - o) / s, list = [];
      for (var i = Math.max(0, Math.floor(a)); i < Math.min(n, Math.ceil(b)); i++) {
        var w = Math.min(b, i + 1) - Math.max(a, i);
        if (w > 1e-6) list.push(i, w * s);           // w*s = 새 점 면적 중 이 원래 점이 차지하는 비율
      }
      out.push(list);
    }
    return out;
  }
  function shrink(img, s, pivot, mode) {
    mode = mode || 'area';
    if (!img || s === 1) return { img: img, off: { x: 0, y: 0 } };
    var w = img.width, h = img.height;
    var px = shrinkPlan(s, pivot ? pivot.x : 0), py = shrinkPlan(s, pivot ? pivot.y : 0);
    var cx = axisCover(w, s, px.o), cy = axisCover(h, s, py.o);
    var src = document.createElement('canvas'); src.width = w; src.height = h;
    var sg = src.getContext('2d'); sg.drawImage(img, 0, 0);
    var sd = sg.getImageData(0, 0, w, h).data;
    var W = cx.length, H = cy.length;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'), od = g.createImageData(W, H), d = od.data;
    var thr = 0.5;
    for (var Y = 0; Y < H; Y++) {
      var ly = cy[Y];
      for (var X = 0; X < W; X++) {
        var lx = cx[X], k = (Y * W + X) * 4;
        if (mode === 'nearest') {   // 비교용(예전 방식)
          var nx = Math.floor((X + 0.5 - px.o) / s), ny = Math.floor((Y + 0.5 - py.o) / s);
          if (nx >= 0 && ny >= 0 && nx < w && ny < h) { var q = (ny * w + nx) * 4; d[k] = sd[q]; d[k + 1] = sd[q + 1]; d[k + 2] = sd[q + 2]; d[k + 3] = sd[q + 3]; }
          continue;
        }
        var cov = 0, r = 0, gg = 0, b = 0, best = -1, bestW = 0, cols = null;
        for (var j = 0; j < ly.length; j += 2) {
          var row = ly[j] * w, wy = ly[j + 1];
          for (var i = 0; i < lx.length; i += 2) {
            var p = (row + lx[i]) * 4, a = sd[p + 3] / 255;
            if (!a) continue;
            var ww = wy * lx[i + 1] * a;
            cov += ww;
            if (mode === 'area') { r += sd[p] * ww; gg += sd[p + 1] * ww; b += sd[p + 2] * ww; continue; }
            // dominant: 같은 색끼리 면적을 더해서 가장 넓은 색
            var key = (sd[p] << 16) | (sd[p + 1] << 8) | sd[p + 2];
            cols = cols || {};
            var t = (cols[key] || 0) + ww; cols[key] = t;
            if (t > bestW) { bestW = t; best = key; }
          }
        }
        if (cov < thr) continue;
        if (mode === 'area') { d[k] = Math.round(r / cov); d[k + 1] = Math.round(gg / cov); d[k + 2] = Math.round(b / cov); }
        else { d[k] = (best >> 16) & 255; d[k + 1] = (best >> 8) & 255; d[k + 2] = best & 255; }
        d[k + 3] = 255;
      }
    }
    g.putImageData(od, 0, 0);
    return { img: c, off: { x: px.o, y: py.o } };
  }

  function loadJSON(src) {
    if (!src) return Promise.resolve(null);
    if (typeof src === 'object') return Promise.resolve(src); // 설정에 바로 적어 둔 경우
    return fetch(src).then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { console.warn('json 못 읽음(파일로 열면 안 됨, 서버로 열 것):', src); return null; });
  }

  // 여러 모양의 anchor json 을 { anim: [ {x,y,angle(라디안),layer}, ... ] } 로 통일
  function normalizeAnchors(raw, anims) {
    if (!raw) return null;
    var src = raw.anchors || raw.frames || raw;
    var out = {};
    function fix(a) {
      if (!a) return null;
      var ang = +a.angle || 0;
      var deg = raw.angleUnit !== 'rad';   // 기본: 도(degree), 시계방향 +
      var x = a.hand ? a.hand[0] : a.x, y = a.hand ? a.hand[1] : a.y;   // {hand:[x,y]} 또는 {x,y}
      // hide = 이 장에서는 무기를 안 그림(넘어져서 손에서 놓침)
      return { x: +x, y: +y, angle: deg ? ang * Math.PI / 180 : ang, layer: a.layer || a.z || null, hide: !!a.hide };
    }
    Object.keys(anims).forEach(function (name) {
      var v = src[name];
      if (Array.isArray(v)) { out[name] = v.map(fix); return; }
      // 파일 이름 키 형식: { "attack_01.png": {...} }
      out[name] = anims[name].frames.map(function (path) {
        var file = path.split('/').pop();
        var base = file.replace(/\.png$/i, '');
        return fix(src[file] || src[base] || null);
      });
    });
    return out;
  }

  function loadCharacter(def) {
    var names = Object.keys(def.anims);
    return Promise.all(names.map(function (n) { return loadList(def.anims[n].frames); }))
      .then(function (lists) {
        var anims = {};
        names.forEach(function (n, i) { anims[n] = lists[i]; });
        // 기술 동작 손 위치(anchors_motions_<옷>_<성별>.json, config addSkillArt 가 채움):
        //   같은 모양의 json. 그 안에 있는 그림 묶음(motion_dash … )만 기본 손 위치에 덮어씀
        return Promise.all([loadJSON(def.anchors), loadJSON(def.motionAnchors)]).then(function (r) {
          var anchors = normalizeAnchors(r[0], def.anims);
          if (r[1]) {
            var sk = normalizeAnchors(r[1], def.anims);
            anchors = anchors || {};
            Object.keys(sk).forEach(function (n) {
              if (sk[n].some(function (a) { return !!a; })) anchors[n] = sk[n];
            });
          }
          return { def: def, anims: anims, anchors: anchors };
        });
      });
  }

  // 그림 묶음 전체를 같은 기준점으로 줄임. pivot 객체는 줄인 그림 기준(정수)으로 바꿔 둔다. 돌려주는 값 = 민 양(off)
  function shrinkList(list, s, pivot) {
    var off = { x: 0, y: 0 };
    if (s === 1) return off;
    var p0 = pivot ? { x: pivot.x, y: pivot.y } : null;
    for (var i = 0; i < list.length; i++) {
      if (!list[i]) continue;
      if (list[i]._baked) {   // 이미 구운 그림: 줄이지 않고 민 양만 같은 계산으로
        off = { x: shrinkPlan(s, p0 ? p0.x : 0).o, y: shrinkPlan(s, p0 ? p0.y : 0).o };
        continue;
      }
      var r = shrink(list[i], s, p0);
      list[i] = r.img; off = r.off;
    }
    if (pivot) { pivot.x = shrinkPlan(s, p0.x).pv; pivot.y = shrinkPlan(s, p0.y).pv; }
    return off;
  }

  window.Assets = {
    shrink: shrink,
    loadAll: function (cfg) {
      var S = cfg.actorScale || 1;   // 캐릭터 크기(배경은 안 줄임)
      if (S === 1) return loadAllNow(cfg, S);
      var dir = 'assets/s' + ('00' + Math.round(S * 100)).slice(-3) + '/';   // 0.55 → assets/s055/
      return loadJSON(dir + 'manifest.json').then(function (m) {
        if (m && m.scale === S && m.files) {
          baked = { dir: dir, files: {} };
          m.files.forEach(function (f) { baked.files[f] = true; });
          // 무기는 따로 굽는 배율(weaponScale)이 다르면 구운 무기 그림은 안 씀
          if (m.weaponScale !== (cfg.weaponScale || S)) Object.keys(cfg.art.weapons).forEach(function (k) { delete baked.files[cfg.art.weapons[k].img]; });
        }
        return loadAllNow(cfg, S);
      });
    }
  };

  function loadAllNow(cfg, S) {
      var art = cfg.art, out = { characters: {}, weapons: {}, dummy: null, fx: null };
      var jobs = [];
      Object.keys(art.characters).forEach(function (k) {
        jobs.push(loadCharacter(art.characters[k]).then(function (c) {
          // 캐릭터 크기: 모든 그림을 발 기준점으로 줄이고, 손 위치도 같은 배율 + 같은 민 양으로 옮긴다
          var p0 = { x: c.def.pivot.x, y: c.def.pivot.y }, off = { x: 0, y: 0 };
          Object.keys(c.anims).forEach(function (n) { off = shrinkList(c.anims[n], S, { x: p0.x, y: p0.y }); });
          if (S !== 1) { c.def.pivot = { x: shrinkPlan(S, p0.x).pv, y: shrinkPlan(S, p0.y).pv }; }
          if (c.anchors && S !== 1) Object.keys(c.anchors).forEach(function (n) {
            c.anchors[n].forEach(function (a) { if (a) { a.x = a.x * S + off.x; a.y = a.y * S + off.y; } });
          });
          out.characters[k] = c;
        }));
      });
      Object.keys(art.weapons).forEach(function (k) {
        jobs.push(loadImage(art.weapons[k].img).then(function (im) {   // 무기: 손잡이 점을 기준으로 weaponScale 배율로 줄임
          var l = [im]; shrinkList(l, cfg.weaponScale || S, art.weapons[k].grip); out.weapons[k] = l[0];
        }));
      });
      if (art.dummy) {
        jobs.push(Promise.all([loadList(art.dummy.idle), loadList(art.dummy.hit)]).then(function (r) {
          out.dummy = { idle: r[0].filter(Boolean), hit: r[1].filter(Boolean) };
          var pv = { x: art.dummy.pivot.x, y: art.dummy.pivot.y };
          shrinkList(out.dummy.idle, S, { x: pv.x, y: pv.y }); shrinkList(out.dummy.hit, S, art.dummy.pivot);
        }));
      }
      // 적 그림: { goblin: { idle: [img...], walk: [...] }, ... }
      out.enemies = {};
      Object.keys(cfg.enemies || {}).forEach(function (k) {
        var A = cfg.enemies[k].anims, names = Object.keys(A);
        jobs.push(Promise.all(names.map(function (n) { return loadList(A[n].frames); })).then(function (lists) {
          var o = {}, T = cfg.enemies[k], p0 = { x: T.pivot.x, y: T.pivot.y };
          names.forEach(function (n, i) { o[n] = lists[i]; shrinkList(o[n], S, { x: p0.x, y: p0.y }); });
          if (S !== 1) { T.pivot = { x: shrinkPlan(S, p0.x).pv, y: shrinkPlan(S, p0.y).pv }; }
          out.enemies[k] = o;
        }));
      });
      // 배경 3장 + 먼지 효과
      out.bg = {};
      if (cfg.bg) ['far', 'mid', 'ground'].forEach(function (k) {
        jobs.push(loadImage(cfg.bg[k].img).then(function (im) { out.bg[k] = im; }));
      });
      if (cfg.dust) jobs.push(loadList(cfg.dust.frames).then(function (l) { out.dust = l.filter(Boolean); shrinkList(out.dust, S, cfg.dust.pivot); }));
      if (art.fx) {
        // slash/impact + 그 밖의 그림 묶음(법사 magic_bolt 등): art.fx 안의 「경로 목록」은 전부 같은 이름으로 불러 둔다
        var fxKeys = Object.keys(art.fx).filter(function (k) { return Array.isArray(art.fx[k]); });
        out.fx = {};
        jobs.push(Promise.all(fxKeys.map(function (k) { return loadList(art.fx[k]); })).then(function (r) {
          fxKeys.forEach(function (k, i) {
            out.fx[k] = r[i].filter(Boolean);
            // 효과 그림도 줄임: 법사 마법은 CFG.magic 의 pivot(그림 가운데) 기준, 베기·불똥은 그림 가운데에 그리므로 기준점 없음
            var M = null;
            Object.keys(cfg.magic || {}).forEach(function (m) { if (cfg.magic[m].frames === k) M = cfg.magic[m]; });
            if (M && M.pivot) {
              var p0 = { x: M.pivot.x, y: M.pivot.y };
              shrinkList(out.fx[k], S, p0);
              Object.keys(cfg.magic).forEach(function (m) { if (cfg.magic[m].frames === k) cfg.magic[m].pivot = { x: p0.x, y: p0.y }; });
            } else shrinkList(out.fx[k], S, null);
          });
        }));
      }
      return Promise.all(jobs).then(function () { return out; });
  }
})();
