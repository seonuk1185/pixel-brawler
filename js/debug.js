// ?debug=1 일 때만: 판정 상자 + 손맛 수치 실시간 조절판
(function () {
  var RANGES = {
    hitstopMs: [0, 250, 5], shakePx: [0, 12, 1], shakeMs: [0, 400, 10], flashMs: [0, 200, 5],
    knockback: [0, 40, 1], knockReturn: [2, 30, 1], wobble: [0, 1, 0.05], dmgRise: [0, 60, 2],
    dmgMs: [200, 1500, 50], sparkCount: [0, 30, 1], slashMs: [40, 400, 10], vibrateMs: [0, 80, 2],
    timeScale: [0.05, 1.5, 0.05]
  };
  var info, fpsAcc = 0, fpsN = 0, fps = 0;

  window.Debug = {
    init: function (G) {
      var J = G.cfg.juice;
      var box = document.createElement('div');
      box.className = 'debug';
      var html = '<div class="dbg-head">DEBUG <button id="dbgToggle">접기</button> <button id="dbgCopy">값 복사</button></div><div class="dbg-body">';
      Object.keys(RANGES).forEach(function (k) {
        var r = RANGES[k];
        html += '<label>' + k + ' <input type="range" data-k="' + k + '" min="' + r[0] + '" max="' + r[1] + '" step="' + r[2] + '" value="' + J[k] + '"><span>' + J[k] + '</span></label>';
      });
      html += '<pre id="dbgInfo"></pre></div>';
      box.innerHTML = html;
      document.body.appendChild(box);
      box.querySelectorAll('input[type=range]').forEach(function (inp) {
        inp.addEventListener('input', function () {
          J[inp.dataset.k] = +inp.value;
          inp.nextElementSibling.textContent = inp.value;
        });
      });
      box.querySelector('#dbgToggle').onclick = function () { box.classList.toggle('min'); };
      box.querySelector('#dbgCopy').onclick = function () {
        var s = JSON.stringify(J, null, 2);
        if (navigator.clipboard) navigator.clipboard.writeText(s).catch(function () {});
        console.log('juice =', s);
      };
      info = box.querySelector('#dbgInfo');
    },
    tick: function (ms, G) {
      fpsAcc += ms; fpsN++;
      if (fpsAcc >= 500) {
        fps = Math.round(1000 * fpsN / fpsAcc); fpsAcc = 0; fpsN = 0;
        var p = G.player;
        info.textContent = 'fps ' + fps + '\nstate ' + p.state + (p.atk ? ' (콤보 ' + (p.atk.step + 1) + '타, 장 ' + p.atk.i + ')' : '') +
          '\npos ' + Math.round(p.x) + ',' + Math.round(p.y) + '\n캐릭 ' + G.charKey + ' / 무기 ' + G.weaponKey +
          '\n맞힌 수 ' + G.hits + ' / 총 데미지 ' + G.totalDmg +
          (G.stage ? '\nHP ' + p.hp + '/' + p.maxHp + ' · 웨이브 ' + G.stage.next + (G.stage.locked ? ' (고정)' : '') +
            ' · 적 ' + G.enemies.filter(function (e) { return e.alive(); }).length + ' · ' + Math.round(G.stage.time / 1000) + '초' : '');
      }
    }
  };
})();
