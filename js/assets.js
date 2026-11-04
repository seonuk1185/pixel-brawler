// 그림 불러오기 + 손 위치(anchor) json 읽기
// 2026-11-03 매끈한 2배(HD) 버전: assets/hd/manifest.json 이 있으면 HD 그림(WebP, 부드러운 테두리, 원래 색)을 쓴다.
//   HD 그림 한 점 = 화면 0.5 도트(CFG.view.renderScale 2). 그림마다 _k(그림 점 → 도트), _ox/_oy(잘라낸 여백 위치)를 붙여 두고
//   그릴 때 Assets.blit 로 그린다. 기준점(발·손잡이)·손 위치는 「그림 점」 단위로 바꿔 둔다(원래 좌표 x f).
//   HD 가 없거나(?hd=0) 못 읽으면 예전 작은 도트 그림(assets/s055, 없으면 불러올 때 줄임)을 쓴다 → 그때는 _k = 1.
(function () {
  var cache = {};

  // 미리 구운 작은 그림(pipeline/ai-sprite/shrink.js → assets/s055/...): manifest 의 scale 이 actorScale 과 같을 때만 쓴다
  var baked = null;   // { dir: 'assets/s055/', files: { 원래 경로: true } }
  // HD 그림(pipeline/ai-sprite/hd_bake.py → assets/hd/...): { dir, files: { 원래 경로: [w, h, ox, oy, f] } }
  var hd = null;
  // 불러오기 진행(로딩 막대): 받을 그림 수 / 받은 그림 수
  var prog = { want: 0, got: 0, onChange: null };
  function bump(dw, dg) { prog.want += dw; prog.got += dg; if (prog.onChange) prog.onChange(prog.got, prog.want); }

  function loadImage(src) {
    if (!src) return Promise.resolve(null);
    if (cache[src]) return cache[src];
    var H = hd && hd.files[src];
    var bk = baked && baked.files[src] ? baked.dir + src.replace(/^assets\//, '') : null;
    bump(1, 0);
    cache[src] = new Promise(function (res) {
      function load(url, kind) {
        var im = new Image();
        im.onload = function () {
          im._baked = kind === 'baked';
          if (kind === 'hd') { im._hd = true; im._f = H[4]; im._ox = H[2]; im._oy = H[3]; im._full = H[5] ? [H[5], H[6]] : null; }
          bump(0, 1); res(im);
        };
        im.onerror = function () {
          if (kind === 'hd') { load(bk || src, bk ? 'baked' : 'src'); return; }   // HD 가 없으면 예전 그림
          if (kind === 'baked') { load(src, 'src'); return; }                       // 구운 그림이 없으면 원래 그림(불러올 때 줄임)
          console.warn('그림 못 읽음:', src); bump(0, 1); res(null);
        };
        im.src = url;
      }
      if (H) load(hd.dir + src.replace(/^assets\//, '').replace(/\.png$/i, '.webp'), 'hd');
      else load(bk || src, bk ? 'baked' : 'src');
    });
    return cache[src];
  }
  function loadList(list) { return Promise.all((list || []).map(loadImage)); }

  // ---------- HD 그림 다루기 ----------
  // 그림 묶음이 전부 HD 인지. 섞여 있으면(일부만 HD) HD 를 안 쓴 것처럼 다룰 수 없으므로 경고만
  function isHD(list) {
    var any = false, all = true;
    (list || []).forEach(function (im) { if (!im) return; if (im._hd) any = true; else all = false; });
    if (any && !all) console.warn('HD 그림과 예전 그림이 섞임(그 묶음만 크기가 다를 수 있음)');
    return any;
  }
  // 그림 점 → 도트 배율: base = 원래 그림을 그리는 배율(캐릭터 actorScale, 무기 weaponScale, 배경 1)
  function setK(list, base) { (list || []).forEach(function (im) { if (im && im._hd) im._k = base / im._f; }); }
  function fOf(list) { for (var i = 0; i < (list || []).length; i++) if (list[i] && list[i]._hd) return list[i]._f; return 1; }

  // 그림 한 장을 「기준점(px,py, 그림 점 단위)이 지금 원점(0,0)에 오게」 그림. alt = 같은 크기의 다른 그림(하얀 번쩍 캔버스)
  //   HD 그림이면 _k 배율로 줄이고, 잘라낸 여백(_ox,_oy)만큼 옮겨서 그린다
  function blit(ctx, img, px, py, alt) {
    if (!img) return;
    var k = img._k || 1, ox = img._ox || 0, oy = img._oy || 0;
    if (k !== 1) { ctx.save(); ctx.scale(k, k); }
    if (alt) ctx.drawImage(alt, 0, 0, img.width, img.height, ox - px, oy - py, img.width, img.height);
    else ctx.drawImage(img, ox - px, oy - py);
    if (k !== 1) ctx.restore();
  }
  // 그림을 복사한 캔버스(물들이기·잔상)에 HD 정보(_k, 잘라낸 위치)를 그대로 옮김
  function copyMeta(src, dst) {
    if (src && dst) ['_hd', '_k', '_f', '_ox', '_oy', '_full'].forEach(function (k) { if (src[k] != null) dst[k] = src[k]; });
    return dst;
  }
  // 그림 가운데 기준점(그림 점 단위, 잘라낸 여백 포함한 원래 캔버스 기준)
  function centerOf(img) {
    if (!img) return { x: 0, y: 0 };
    if (img._hd && img._full) return { x: img._full[0] / 2, y: img._full[1] / 2 };
    return { x: Math.round(img.width / 2), y: Math.round(img.height / 2) };
  }

  // ---------- 작게 줄이기 (CFG.actorScale, 예: 0.7) — 예전 도트 그림(HD 없을 때)만 ----------
  // 도트 그림을 0.7배처럼 딱 떨어지지 않는 배율로 그냥 줄이면(가장 가까운 점 고르기) 30% 줄·칸이 통째로 빠져서
  // 윤곽선이 끊기고 들쭉날쭉해진다. 그래서 불러올 때 한 번만 미리 줄여 둔다(게임 중에는 1:1 로 그림 → 선명함 그대로):
  //   새 점 하나가 덮는 원래 점들을 「덮은 면적」만큼 따져서 색을 섞고(면적 평균),
  //   투명도는 절반 넘게 덮였으면 불투명, 아니면 투명 → 가장자리가 흐려지지 않고 또렷하다
  // pivot(발 기준점·손잡이 등)이 줄인 그림에서도 정확히 정수 점에 오도록 살짝 밀어서 줄인다(off = 민 양)
  function shrinkPlan(s, p) {
    var o = Math.round(p * s) - p * s;
    return { o: o, pv: Math.round(p * s) };
  }
  function axisCover(n, s, o) {
    var m = Math.ceil(n * s + o) + 1, out = [];
    for (var X = 0; X < m; X++) {
      var a = (X - o) / s, b = (X + 1 - o) / s, list = [];
      for (var i = Math.max(0, Math.floor(a)); i < Math.min(n, Math.ceil(b)); i++) {
        var w = Math.min(b, i + 1) - Math.max(a, i);
        if (w > 1e-6) list.push(i, w * s);
      }
      out.push(list);
    }
    return out;
  }
  function shrink(img, s, pivot) {
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
    for (var Y = 0; Y < H; Y++) {
      var ly = cy[Y];
      for (var X = 0; X < W; X++) {
        var lx = cx[X], k = (Y * W + X) * 4, cov = 0, r = 0, gg = 0, b = 0;
        for (var j = 0; j < ly.length; j += 2) {
          var row = ly[j] * w, wy = ly[j + 1];
          for (var i = 0; i < lx.length; i += 2) {
            var p = (row + lx[i]) * 4, a = sd[p + 3] / 255;
            if (!a) continue;
            var ww = wy * lx[i + 1] * a;
            cov += ww; r += sd[p] * ww; gg += sd[p + 1] * ww; b += sd[p + 2] * ww;
          }
        }
        if (cov < 0.5) continue;
        d[k] = Math.round(r / cov); d[k + 1] = Math.round(gg / cov); d[k + 2] = Math.round(b / cov); d[k + 3] = 255;
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

  // 여러 캐릭터가 같이 쓰는 json(motions_move.json)은 한 번만 받음
  var jsonOnce = {};
  function loadJSONOnce(src) { return jsonOnce[src] || (jsonOnce[src] = loadJSON(src)); }

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
      out[name] = anims[name].frames.map(function (path) {
        var file = path.split('/').pop();
        var base = file.replace(/\.png$/i, '');
        return fix(src[file] || src[base] || null);
      });
    });
    return out;
  }

  // 그림 묶음 전체를 같은 기준점으로 줄임(예전 도트 그림만). pivot 객체는 줄인 그림 기준(정수)으로 바꿔 둔다. 돌려주는 값 = 민 양(off)
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
  // 그림 묶음 하나 준비: HD 면 배율(_k)만 붙이고 기준점을 그림 점 단위(x f)로, 아니면 예전처럼 줄임.
  //   pivot 객체를 바꿔 쓰고, 손 위치 등 다른 점을 옮길 함수 map(x, y) → [x', y'] 를 돌려준다
  function prepList(list, base, pivot) {
    if (isHD(list)) {
      var f = fOf(list);
      setK(list, base);
      if (pivot) { pivot.x *= f; pivot.y *= f; }
      return function (x, y) { return [x * f, y * f]; };
    }
    var off = shrinkList(list, base, pivot);
    return function (x, y) { return [x * base + off.x, y * base + off.y]; };
  }

  // ---------- 캐릭터(옷_성별)마다 따로 불러오기: 처음엔 지금 고른 옷만, 나머지는 뒤에서 ----------
  var CFGR = null, OUT = null, charJobs = {};
  function loadCharacter(def) {
    var names = Object.keys(def.anims);
    return Promise.all(names.map(function (n) { return loadList(def.anims[n].frames); }))
      .then(function (lists) {
        var anims = {};
        names.forEach(function (n, i) { anims[n] = lists[i]; });
        // 기술 동작 손 위치(anchors_motions_<옷>_<성별>.json): 그 안에 있는 그림 묶음(motion_dash … )만 기본 손 위치에 덮어씀
        // 달리기·점프 손 위치(anchors_move_<옷>_<성별>.json)도 같은 방식. motions_move.json = 달리기 보폭·점프 높이·판정(def.moveWho 항목)
        var mvData = CFGR && CFGR.move && CFGR.move.data;
        return Promise.all([loadJSON(def.anchors), loadJSON(def.motionAnchors), loadJSON(def.moveAnchors),
                            mvData && def.moveWho ? loadJSONOnce(mvData) : null]).then(function (r) {
          var anchors = normalizeAnchors(r[0], def.anims);
          [r[1], r[2]].forEach(function (extra) {
            if (!extra) return;
            var sk = normalizeAnchors(extra, def.anims);
            anchors = anchors || {};
            Object.keys(sk).forEach(function (n) {
              if (sk[n].some(function (a) { return !!a; })) anchors[n] = sk[n];
            });
          });
          var move = r[3] && r[3].characters ? r[3].characters[def.moveWho] || null : null;
          return { def: def, anims: anims, anchors: anchors, move: move };
        });
      });
  }
  // 캐릭터 그림 묶음 하나(k = 'male', 'knight_female' …)를 불러와서 OUT.characters[k] 에 넣음
  function ensureChar(k) {
    if (charJobs[k]) return charJobs[k];
    var def = CFGR.art.characters[k];
    if (!def) return Promise.resolve(null);
    var S = CFGR.actorScale || 1;
    charJobs[k] = loadCharacter(def).then(function (c) {
      // 모든 그림을 발 기준점으로 맞추고(HD = 배율만, 예전 그림 = 줄임), 손 위치도 같은 방식으로 옮긴다
      var p0 = { x: c.def.pivot.x, y: c.def.pivot.y }, map = null;
      Object.keys(c.anims).forEach(function (n) { var pv = { x: p0.x, y: p0.y }; map = prepList(c.anims[n], S, pv); c.def.pivot = pv; });
      if (c.anchors && map) Object.keys(c.anchors).forEach(function (n) {
        c.anchors[n].forEach(function (a) { if (a) { var q = map(a.x, a.y); a.x = q[0]; a.y = q[1]; } });
      });
      OUT.characters[k] = c;
      return c;
    });
    return charJobs[k];
  }

  // ---------- 판 배경 3장 (2026-11-04 여러 판): 판을 고를 때 그 판 배경만 불러옴. 같은 배경은 한 번만 ----------
  // bg = 판의 bg { far, mid, ground }. 돌려주는 값 = { far: 그림, mid: 그림, ground: 그림 }. 배경 HD 는 _k = 0.5 (1 도트 = 2 점)
  var bgJobs = {};
  function ensureBg(bg) {
    if (!bg) return Promise.resolve({});
    var key = ['far', 'mid', 'ground'].map(function (k) { return bg[k] ? bg[k].img : ''; }).join('|');
    if (bgJobs[key]) return bgJobs[key];
    var out = {};
    bgJobs[key] = Promise.all(['far', 'mid', 'ground'].map(function (k) {
      if (!bg[k]) return null;
      return loadImage(bg[k].img).then(function (im) { if (im) prepList([im], 1, null); out[k] = im; });
    })).then(function () { return out; });
    return bgJobs[key];
  }
  // 그림 묶음 하나(장식 소품 등): frames = 경로 목록, base = 그리는 배율, pivot = 기준점(그림 점 단위로 바꿔 둠). 같은 목록은 한 번만
  var setJobs = {};
  function loadSet(frames, base, pivot) {
    var key = (frames || []).join('|');
    if (!setJobs[key]) setJobs[key] = loadList(frames).then(function (l) {
      l = l.filter(Boolean);
      if (l.length) prepList(l, base, pivot);
      return l;
    });
    return setJobs[key];
  }

  window.Assets = {
    shrink: shrink, blit: blit, centerOf: centerOf, copyMeta: copyMeta, ensureChar: ensureChar, ensureBg: ensureBg, loadSet: loadSet,
    progress: prog,
    isHD: function () { return !!hd; },
    // first = 처음에 꼭 있어야 하는 캐릭터 묶음 이름들(나머지는 Assets.loadRest 로 나중에)
    loadAll: function (cfg, first) {
      var S = cfg.actorScale || 1;
      var R = (cfg.view && cfg.view.renderScale) || 1;
      var noHD = /[?&]hd=0/.test(location.search) || R < 1.5;
      var dir = 'assets/s' + ('00' + Math.round(S * 100)).slice(-3) + '/';   // 0.55 → assets/s055/
      return Promise.all([noHD ? null : loadJSON('assets/hd/manifest.json'), S === 1 ? null : loadJSON(dir + 'manifest.json')]).then(function (r) {
        var m = r[0], b = r[1];
        if (m && m.files && m.actorScale === S) {
          hd = { dir: 'assets/hd/', files: m.files };
          // 무기 HD 를 구운 배율(weaponScale)이 다르면 무기는 HD 안 씀
          if (m.weaponScale !== (cfg.weaponScale || S)) Object.keys(cfg.art.weapons).forEach(function (k) { delete hd.files[cfg.art.weapons[k].img]; });
        }
        if (b && b.scale === S && b.files) {
          baked = { dir: dir, files: {} };
          b.files.forEach(function (f) { baked.files[f] = true; });
          if (b.weaponScale !== (cfg.weaponScale || S)) Object.keys(cfg.art.weapons).forEach(function (k) { delete baked.files[cfg.art.weapons[k].img]; });
        }
        return loadAllNow(cfg, S, first);
      });
    },
    // 나머지 캐릭터 묶음을 하나씩 뒤에서 불러옴(옷 바꿀 때 바로 보이게)
    loadRest: function () {
      var keys = Object.keys(CFGR.art.characters).filter(function (k) { return !charJobs[k]; });
      var i = 0;
      (function next() { if (i < keys.length) ensureChar(keys[i++]).then(function () { setTimeout(next, 50); }); })();
    }
  };

  function loadAllNow(cfg, S, first) {
      var art = cfg.art, out = { characters: {}, weapons: {}, dummy: null, fx: null };
      CFGR = cfg; OUT = out;
      var jobs = [];
      (first || Object.keys(art.characters)).forEach(function (k) { jobs.push(ensureChar(k)); });
      Object.keys(art.weapons).forEach(function (k) {
        jobs.push(loadImage(art.weapons[k].img).then(function (im) {   // 무기: 손잡이 점을 기준으로 weaponScale 배율
          var l = [im]; prepList(l, cfg.weaponScale || S, art.weapons[k].grip); out.weapons[k] = l[0];
        }));
      });
      if (art.dummy) {
        jobs.push(Promise.all([loadList(art.dummy.idle), loadList(art.dummy.hit)]).then(function (r) {
          out.dummy = { idle: r[0].filter(Boolean), hit: r[1].filter(Boolean) };
          var pv = { x: art.dummy.pivot.x, y: art.dummy.pivot.y };
          prepList(out.dummy.idle, S, { x: pv.x, y: pv.y }); prepList(out.dummy.hit, S, art.dummy.pivot);
        }));
      }
      // 적 그림: { goblin: { idle: [img...], walk: [...] }, ... }
      out.enemies = {};
      Object.keys(cfg.enemies || {}).forEach(function (k) {
        var A = cfg.enemies[k].anims, names = Object.keys(A);
        jobs.push(Promise.all(names.map(function (n) { return loadList(A[n].frames); })).then(function (lists) {
          var o = {}, T = cfg.enemies[k], p0 = { x: T.pivot.x, y: T.pivot.y }, pv = null;
          names.forEach(function (n, i) { o[n] = lists[i]; pv = { x: p0.x, y: p0.y }; prepList(o[n], S, pv); });
          if (pv) T.pivot = pv;
          out.enemies[k] = o;
        }));
      });
      // 배경 3장(지금 판 = CFG.bg) + 먼지 효과. 다른 판 배경은 판을 고를 때 Assets.ensureBg 로
      out.bg = {};
      if (cfg.bg) jobs.push(ensureBg(cfg.bg).then(function (b) { out.bg = b; }));
      if (cfg.dust) jobs.push(loadList(cfg.dust.frames).then(function (l) { out.dust = l.filter(Boolean); prepList(out.dust, S, cfg.dust.pivot); }));
      if (art.fx) {
        // slash/impact + 그 밖의 그림 묶음(법사 magic_bolt, 기술 효과 skill_*): art.fx 안의 「경로 목록」은 전부 같은 이름으로 불러 둔다
        var fxKeys = Object.keys(art.fx).filter(function (k) { return Array.isArray(art.fx[k]); });
        out.fx = {};
        jobs.push(Promise.all(fxKeys.map(function (k) { return loadList(art.fx[k]); })).then(function (r) {
          fxKeys.forEach(function (k, i) {
            out.fx[k] = r[i].filter(Boolean);
            // 효과 그림 기준점: 법사 마법·기술 효과는 CFG.magic 의 pivot, 베기·불똥은 그림 가운데(Assets.centerOf)
            var M = null;
            Object.keys(cfg.magic || {}).forEach(function (m) { if (cfg.magic[m].frames === k) M = cfg.magic[m]; });
            var p0 = M && M.pivot ? { x: M.pivot.x, y: M.pivot.y } : null;
            prepList(out.fx[k], S, p0);
            // 기술 효과(skill_*)는 CFG.skillFxScale 배 크게 그린다(HD 는 그만큼 큰 해상도로 구워 둠)
            if (/^skill_/.test(k)) {
              var fxs = cfg.skillFxScale || 1;
              out.fx[k].forEach(function (im) { if (im) im._k = im._hd ? S * fxs / im._f : fxs; });
            }

            if (p0) Object.keys(cfg.magic).forEach(function (m) { if (cfg.magic[m].frames === k) cfg.magic[m].pivot = { x: p0.x, y: p0.y }; });
          });
        }));
      }
      return Promise.all(jobs).then(function () { return out; });
  }
})();
