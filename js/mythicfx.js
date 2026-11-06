// +10 신화 무기 고유 효과(2026-11-06, 우리 시안 art-mythic\mythicFx.js 그대로): 무기 뒤 금빛 후광 + 무지개 테 / 앞 무지개 빛줄기 + 도는 별.
//   js/enchant.js 의 Enchant.mythic 이 단위를 맞춰 부름(entities.js drawWeapon · 강화 창). config art.weapons 의 mythic: true 그림만
/* mythicFx.js - "+10 signature" effect for the MYTHIC weapons (sword_mythic / staff_mythic), pixel-brawler,
 * SAMPLE 2026-11-06. Pure code, no extra art. Same calling style as weaponAura.js.
 *
 * Look (owner brief: "so cool players want to push to +10", clearly above the plain gold +9):
 *   1. CELESTIAL HALO (back)   - soft white-gold glow hugging the silhouette + a thin prismatic rim
 *                                 (pink -> cyan -> violet along the weapon) that slowly breathes.
 *   2. PRISM SWEEP (front)     - a slanted rainbow-white shine band runs from grip to tip every ~1.6 s,
 *                                 clipped to the weapon pixels (it only lights the metal/crystal itself),
 *                                 ending in a short 4-ray star flare at the tip (sword) / core (staff).
 *   3. ORBITING STARS (both)   - 4 tiny pixel stars circle the blade (sword: spiralling guard -> tip) or the
 *                                 staff head (two tilted orbits, like an orrery). Stars behind the weapon are
 *                                 drawn in the back pass and smaller, so they really go AROUND it.
 * Combines with WeaponAura (element enchants): call MythicFx first in each pass, WeaponAura after.
 *
 * Cost: per weapon image one cached silhouette + 2 blurred/tinted halos (built once), one small work canvas
 * for the sweep; per frame ~4 drawImage + ~20 fillRect. Everything is a pure function of time (no state).
 *
 *   MythicFx.draw(ctx, wDef, img, t, angle, opts)
 *     ctx  : transformed like drawWeapon() (translate to hand, rotate by angle), 1 unit = 1 px of the 1x sprite.
 *            It shifts by the grip itself, like Assets.blit(ctx, wImg, grip.x, grip.y).
 *     wDef : { grip:{x,y} | [x,y], size:[w,h] (1x size), kind:'sword'|'staff' }
 *     img  : the weapon image actually drawn (1x or HD; scaled to size)
 *     t    : seconds;  angle: total rotation (unused for now, kept for API parity with WeaponAura)
 *     opts : { pass:'back'|'front', loop: seconds (preview only: seamless loop), power: 0..1 (default 1) }
 *
 * Game hook (entities.js drawWeapon, after ctx.rotate(...)), only when the weapon is +10:
 *     if (mythic) MythicFx.draw(ctx, wDef, wImg, now / 1000, ang, { pass: 'back' });
 *     Assets.blit(ctx, wImg, wDef.grip.x, wDef.grip.y);
 *     if (mythic) MythicFx.draw(ctx, wDef, wImg, now / 1000, ang, { pass: 'front' });
 */
(function (root) {
  'use strict';
  var TAU = Math.PI * 2, S = 3, PAD = 8;
  var STAR_COL = ['#ffffff', '#9fe8ff', '#ffb8f0', '#fff0a8', '#c9b0ff'];

  function hash(a, b) { var v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); }
  // period P seconds; with a preview loop it is snapped so the loop is seamless
  function per(P, loop) { return loop ? loop / Math.max(1, Math.round(loop / P)) : P; }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }

  // ---------------------------------------------------------------- per-image cache
  var cache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function prep(img, w, h, kind) {
    var m = cache && cache.get(img);
    if (m && m.w === w && m.h === h) return m;
    var W = (w + PAD * 2) * S, H = (h + PAD * 2) * S;
    var sil = mk(W, H), g = sil.getContext('2d');
    g.drawImage(img, PAD * S, PAD * S, w * S, h * S);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    function halo(r, boost, fill) {          // blurred silhouette, recoloured by fill(ctx) (colour or gradient)
      var c = mk(W, H), q = c.getContext('2d');
      q.filter = 'blur(' + (r * S) + 'px)';
      for (var i = 0; i < boost; i++) q.drawImage(sil, 0, 0);
      q.filter = 'none'; q.globalCompositeOperation = 'source-in'; q.fillStyle = fill(q); q.fillRect(0, 0, W, H);
      return c;
    }
    var gold = halo(2.2, 3, function () { return '#fff1c4'; });
    var prism = halo(1.1, 4, function (q) {
      var gr = q.createLinearGradient(PAD * S, 0, (PAD + w) * S, 0);
      gr.addColorStop(0, '#ff9ee6'); gr.addColorStop(0.3, '#9fe8ff'); gr.addColorStop(0.55, '#ffffff');
      gr.addColorStop(0.75, '#c3a6ff'); gr.addColorStop(1, '#ff9ee6'); return gr;
    });
    // profile of the 1x sprite: top/bottom opaque row per column
    var pc = mk(w, h), pg = pc.getContext('2d'); pg.drawImage(img, 0, 0, w, h);
    var d = pg.getImageData(0, 0, w, h).data, prof = [], x0 = -1, x1 = -1;
    for (var x = 0; x < w; x++) {
      var top = -1, bot = -1;
      for (var y = 0; y < h; y++) if (d[(y * w + x) * 4 + 3] > 110) { if (top < 0) top = y; bot = y; }
      prof.push(top < 0 ? null : [top, bot + 1]);
      if (top >= 0) { if (x0 < 0) x0 = x; x1 = x; }
    }
    // head (staff) = tallest part in the last 40 %; blade (sword) = after the guard (tallest column in the first 35 %)
    var span = x1 - x0, hx = 0, hn = 0, hmax = 0, gx = x0, gmax = 0, i;
    for (i = x0; i <= x1; i++) if (prof[i]) {
      var hh = prof[i][1] - prof[i][0];
      if (i > x0 + span * 0.6 && hh > hmax) hmax = hh;
      if (i < x0 + span * 0.35 && hh >= gmax) { gmax = hh; gx = i; }
    }
    var cyS = 0;
    for (i = Math.round(x0 + span * 0.6); i <= x1; i++) if (prof[i] && prof[i][1] - prof[i][0] >= hmax * 0.7) { hx += i; cyS += (prof[i][0] + prof[i][1]) / 2; hn++; }
    var head = hn ? { x: hx / hn + 0.5, y: cyS / hn, r: hmax / 2 } : { x: x1 - 6, y: h / 2, r: 6 };
    var work = mk(W, H);
    m = { w: w, h: h, W: W, H: H, sil: sil, gold: gold, prism: prism, prof: prof, x0: x0, x1: x1, head: head, guard: gx + 2, work: work };
    if (cache) cache.set(img, m);
    return m;
  }

  function blitFx(ctx, m, c, a, grow) {
    if (a <= 0.01) return;
    var ww = m.w + PAD * 2, hh = m.h + PAD * 2, cx = m.w / 2, cy = m.h / 2;
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(c, cx - ww * grow / 2, cy - hh * grow / 2, ww * grow, hh * grow);
  }

  // ---------------------------------------------------------------- pixel star
  function star(ctx, x, y, s, col, a) {
    if (a <= 0.02) return;
    ctx.globalAlpha = Math.min(1, a); ctx.fillStyle = col;
    ctx.fillRect(x - s / 2, y - s / 2, s, s);                     // core
    var arm = s * 1.6;
    ctx.globalAlpha = Math.min(1, a * 0.75);
    ctx.fillRect(x - s / 2 - arm, y - s * 0.2, arm, s * 0.4);     // 4 thin rays
    ctx.fillRect(x + s / 2, y - s * 0.2, arm, s * 0.4);
    ctx.fillRect(x - s * 0.2, y - s / 2 - arm, s * 0.4, arm);
    ctx.fillRect(x - s * 0.2, y + s / 2, s * 0.4, arm);
  }
  function flare(ctx, x, y, r, a) {                               // bigger 4-ray glint (sweep end)
    if (a <= 0.02) return;
    ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 0.9, y - 0.9, 1.8, 1.8);
    ctx.globalAlpha = Math.min(1, a * 0.8); ctx.fillStyle = '#e8fbff';
    ctx.fillRect(x - r, y - 0.35, r * 2, 0.7); ctx.fillRect(x - 0.35, y - r, 0.7, r * 2);
    ctx.globalAlpha = Math.min(1, a * 0.5); ctx.fillStyle = '#ffc8f4';   // short pink diagonals
    var d = r * 0.4; for (var k = 1; k <= 2; k++) { var o = d * k / 2; ctx.fillRect(x - o - 0.3, y - o - 0.3, 0.6, 0.6); ctx.fillRect(x + o - 0.3, y - o - 0.3, 0.6, 0.6); ctx.fillRect(x - o - 0.3, y + o - 0.3, 0.6, 0.6); ctx.fillRect(x + o - 0.3, y + o - 0.3, 0.6, 0.6); }
  }

  // ---------------------------------------------------------------- orbiting stars
  // returns [{x,y,z,s,col}] ; z<0 = behind the weapon
  function stars(m, kind, t, loop) {
    var out = [], i, n = 4;
    if (kind === 'staff') {
      var H = m.head, R = H.r + 3.5;
      for (i = 0; i < n; i++) {
        var P = per(i < 2 ? 2.0 : 2.6, loop), a = (t / P + i / 2 + (i < 2 ? 0 : 0.25)) * TAU * (i < 2 ? 1 : -1);
        var tilt = i < 2 ? 0.5 : -0.5, ca = Math.cos(a), sa = Math.sin(a);
        // ellipse in a tilted plane: wide across the head, flat in depth
        var ex = ca * R * 0.55, ey = sa * R;
        out.push({ x: H.x + ex + ey * tilt * 0.35, y: H.y + ey * 0.92, z: ca * (i % 2 ? 1 : -1), col: STAR_COL[i % STAR_COL.length], s: 1.0 });
      }
    } else {
      var bx0 = m.guard + 1, bx1 = m.x1;
      for (i = 0; i < n; i++) {
        var P2 = per(1.6, loop), u = ((t / P2 + i / n) % 1 + 1) % 1;   // guard -> tip
        var x = bx0 + (bx1 - bx0) * u, p = m.prof[Math.round(x)] || [m.h / 2 - 2, m.h / 2 + 2];
        var mid = (p[0] + p[1]) / 2, hh = (p[1] - p[0]) / 2 + 2.2;
        var a2 = u * TAU * 1.5 + i * 1.3, c = Math.cos(a2);
        var fade = Math.sin(Math.PI * u);                                 // appear at the guard, vanish at the tip
        out.push({ x: x, y: mid + Math.sin(a2) * hh, z: c, col: STAR_COL[(i + 1) % STAR_COL.length], s: 1.0, f: fade });
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- prism sweep
  function sweep(ctx, m, kind, t, loop, pw) {
    var P = per(1.6, loop), ph = ((t / P) % 1 + 1) % 1;
    var travel = 0.62;                          // band runs during the first 62 % of the period, then rests
    var x0 = (kind === 'staff' ? m.x0 + (m.x1 - m.x0) * 0.25 : m.guard), x1 = m.x1 + 2;
    var k = ph / travel;
    if (k <= 1) {
      var bx = x0 - 4 + (x1 - x0 + 8) * k, bw = 5;
      var g = m.work.getContext('2d'), W = m.W, H = m.H;
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.clearRect(0, 0, W, H);
      var X = (bx + PAD) * S, Y = H / 2, dx = bw * S, dy = bw * S * 0.45;
      var gr = g.createLinearGradient(X - dx, Y + dy, X + dx, Y - dy);   // narrow band, leaning forward
      gr.addColorStop(0, 'rgba(255,160,230,0)'); gr.addColorStop(0.3, 'rgba(255,160,230,0.55)');
      gr.addColorStop(0.45, 'rgba(150,235,255,0.85)'); gr.addColorStop(0.52, 'rgba(255,255,255,1)');
      gr.addColorStop(0.62, 'rgba(195,166,255,0.7)'); gr.addColorStop(1, 'rgba(195,166,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'destination-in'; g.drawImage(m.sil, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      blitFx(ctx, m, m.work, 0.8 * pw * Math.sin(Math.PI * Math.min(1, k * 1.15)), 1);
    }
    // flare at the end of the run: sword tip / staff core
    var fk = (ph - travel * 0.92) / 0.16;
    if (fk > 0 && fk < 1) {
      var fx = kind === 'staff' ? m.head.x : m.x1 - 2.5, p = m.prof[Math.round(fx)] || [m.h / 2, m.h / 2];
      var fy = kind === 'staff' ? m.head.y : (p[0] + p[1]) / 2;
      ctx.globalCompositeOperation = 'lighter';
      flare(ctx, fx, fy, (kind === 'staff' ? 6 : 4.5) * Math.sin(Math.PI * fk), pw * Math.sin(Math.PI * fk));
    }
  }

  // ---------------------------------------------------------------- entry point
  function draw(ctx, wDef, img, t, angle, opts) {
    if (!img) return;
    opts = opts || {};
    var pass = opts.pass || 'back', loop = opts.loop || 0, pw = opts.power === undefined ? 1 : opts.power;
    var gx = wDef.grip.x !== undefined ? wDef.grip.x : wDef.grip[0], gy = wDef.grip.y !== undefined ? wDef.grip.y : wDef.grip[1];
    var w = wDef.size ? wDef.size[0] : img.width, h = wDef.size ? wDef.size[1] : img.height;
    var kind = wDef.kind || (w > 70 ? 'staff' : 'sword');
    var m = prep(img, w, h, kind);
    ctx.save();
    ctx.translate(-gx, -gy);
    var st = stars(m, kind, t, loop), i, s;
    if (pass === 'back') {
      var Pb = per(2.0, loop), br = 0.5 + 0.5 * Math.sin(t * TAU / Pb);          // slow breathing
      ctx.globalCompositeOperation = 'lighter';
      blitFx(ctx, m, m.gold, (0.42 + 0.18 * br) * pw, 1.0 + 0.02 * br);
      blitFx(ctx, m, m.prism, (0.55 + 0.25 * (1 - br)) * pw, 1.0);
      for (i = 0; i < st.length; i++) { s = st[i]; if (s.z < 0) star(ctx, s.x, s.y, s.s * 0.75, s.col, pw * 0.55 * (s.f === undefined ? 1 : s.f) * (0.5 - s.z * 0.5)); }
    } else {
      sweep(ctx, m, kind, t, loop, pw);
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < st.length; i++) { s = st[i]; if (s.z >= 0) star(ctx, s.x, s.y, s.s * (0.85 + 0.3 * s.z), s.col, pw * (s.f === undefined ? 1 : s.f) * (0.6 + 0.4 * s.z)); }
    }
    ctx.restore();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  root.MythicFx = { draw: draw };
})(typeof window !== 'undefined' ? window : this);
