// 그림 불러오기 + 손 위치(anchor) json 읽기
(function () {
  var cache = {};

  function loadImage(src) {
    if (!src) return Promise.resolve(null);
    if (cache[src]) return cache[src];
    cache[src] = new Promise(function (res) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { console.warn('그림 못 읽음:', src); res(null); };
      im.src = src;
    });
    return cache[src];
  }
  function loadList(list) { return Promise.all((list || []).map(loadImage)); }

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
        return loadJSON(def.anchors).then(function (raw) {
          return { def: def, anims: anims, anchors: normalizeAnchors(raw, def.anims) };
        });
      });
  }

  window.Assets = {
    loadAll: function (cfg) {
      var art = cfg.art, out = { characters: {}, weapons: {}, dummy: null, fx: null };
      var jobs = [];
      Object.keys(art.characters).forEach(function (k) {
        jobs.push(loadCharacter(art.characters[k]).then(function (c) { out.characters[k] = c; }));
      });
      Object.keys(art.weapons).forEach(function (k) {
        jobs.push(loadImage(art.weapons[k].img).then(function (im) { out.weapons[k] = im; }));
      });
      if (art.dummy) {
        jobs.push(Promise.all([loadList(art.dummy.idle), loadList(art.dummy.hit)]).then(function (r) {
          out.dummy = { idle: r[0].filter(Boolean), hit: r[1].filter(Boolean) };
        }));
      }
      // 적 그림: { goblin: { idle: [img...], walk: [...] }, ... }
      out.enemies = {};
      Object.keys(cfg.enemies || {}).forEach(function (k) {
        var A = cfg.enemies[k].anims, names = Object.keys(A);
        jobs.push(Promise.all(names.map(function (n) { return loadList(A[n].frames); })).then(function (lists) {
          var o = {}; names.forEach(function (n, i) { o[n] = lists[i]; }); out.enemies[k] = o;
        }));
      });
      // 배경 3장 + 먼지 효과
      out.bg = {};
      if (cfg.bg) ['far', 'mid', 'ground'].forEach(function (k) {
        jobs.push(loadImage(cfg.bg[k].img).then(function (im) { out.bg[k] = im; }));
      });
      if (cfg.dust) jobs.push(loadList(cfg.dust.frames).then(function (l) { out.dust = l.filter(Boolean); }));
      if (art.fx) {
        // slash/impact + 그 밖의 그림 묶음(법사 magic_bolt 등): art.fx 안의 「경로 목록」은 전부 같은 이름으로 불러 둔다
        var fxKeys = Object.keys(art.fx).filter(function (k) { return Array.isArray(art.fx[k]); });
        out.fx = {};
        jobs.push(Promise.all(fxKeys.map(function (k) { return loadList(art.fx[k]); })).then(function (r) {
          fxKeys.forEach(function (k, i) { out.fx[k] = r[i].filter(Boolean); });
        }));
      }
      return Promise.all(jobs).then(function () { return out; });
    }
  };
})();
