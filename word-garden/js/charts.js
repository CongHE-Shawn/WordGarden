/* charts.js — 原生 Canvas 图表（记忆曲线 / 柱状图 / 饼图 / 打卡日历），零依赖 */
(function () {
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function setup(canvas) {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth || canvas.parentElement.clientWidth || 600;
    var h = canvas.clientHeight || 240;
    canvas.width = w * dpr; canvas.height = h * dpr;
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  var Charts = {
    /* 记忆保持率曲线（未来14天，基于当前已学单词的平均SRS等级） */
    retention: function (canvas, avgLvl) {
      var s = setup(canvas), ctx = s.ctx, W = s.w, H = s.h;
      var pad = { l: 44, r: 16, t: 20, b: 32 };
      var days = 14;
      var pts = [];
      for (var d = 0; d <= days; d++) pts.push({ x: d, y: SRS.retention(avgLvl, d) });
      var fg = cssVar('--fg-muted'), accent = cssVar('--accent');
      ctx.font = '11px sans-serif'; ctx.fillStyle = fg; ctx.strokeStyle = cssVar('--border');
      ctx.lineWidth = 1;
      for (var g = 0; g <= 4; g++) {
        var y = pad.t + (H - pad.t - pad.b) * g / 4;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
        ctx.fillText((100 - g * 25) + '%', 6, y + 4);
      }
      for (var d2 = 0; d2 <= days; d2 += 2) {
        var x = pad.l + (W - pad.l - pad.r) * d2 / days;
        ctx.fillText(d2 + '天', x - 8, H - 10);
      }
      // 面积填充
      ctx.beginPath();
      pts.forEach(function (p, i) {
        var x = pad.l + (W - pad.l - pad.r) * p.x / days;
        var y = pad.t + (H - pad.t - pad.b) * (1 - p.y);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.lineWidth = 2.5; ctx.strokeStyle = accent; ctx.stroke();
      ctx.lineTo(pad.l + (W - pad.l - pad.r), H - pad.b);
      ctx.lineTo(pad.l, H - pad.b); ctx.closePath();
      var grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
      grad.addColorStop(0, 'rgba(127,176,105,.30)');
      grad.addColorStop(1, 'rgba(127,176,105,.02)');
      ctx.fillStyle = grad; ctx.fill();
      // 数据点
      pts.forEach(function (p, i) {
        if (i % 2) return;
        var x = pad.l + (W - pad.l - pad.r) * p.x / days;
        var y = pad.t + (H - pad.t - pad.b) * (1 - p.y);
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fillStyle = accent; ctx.fill();
      });
    },

    /* 近14天学习量柱状图 */
    bars: function (canvas, daily) {
      var s = setup(canvas), ctx = s.ctx, W = s.w, H = s.h;
      var pad = { l: 34, r: 10, t: 16, b: 30 };
      var data = [];
      for (var i = 13; i >= 0; i--) {
        var k = Store.todayKey(-i);
        var d = daily[k] || { learned: 0, reviewed: 0 };
        data.push({ label: k.slice(5), learned: d.learned, reviewed: d.reviewed, total: d.learned + d.reviewed });
      }
      var max = Math.max(5, Math.max.apply(null, data.map(function (x) { return x.total; })));
      var bw = (W - pad.l - pad.r) / data.length;
      var fg = cssVar('--fg-muted');
      ctx.font = '10px sans-serif';
      data.forEach(function (d, i) {
        var x = pad.l + i * bw + bw * 0.18;
        var hL = (H - pad.t - pad.b) * d.learned / max;
        var hR = (H - pad.t - pad.b) * d.reviewed / max;
        var y = H - pad.b;
        ctx.fillStyle = '#7fb069';
        if (hL > 0) { rr(ctx, x, y - hL, bw * 0.64, hL, 3); ctx.fill(); }
        ctx.fillStyle = '#f2c14e';
        if (hR > 0) { rr(ctx, x, y - hL - hR, bw * 0.64, hR, 3); ctx.fill(); }
        ctx.fillStyle = fg;
        if (i % 2 === 0) ctx.fillText(d.label, x - 2, H - 10);
      });
      // 图例
      ctx.fillStyle = '#7fb069'; ctx.fillRect(pad.l, 2, 10, 10);
      ctx.fillStyle = fg; ctx.fillText('新学', pad.l + 14, 11);
      ctx.fillStyle = '#f2c14e'; ctx.fillRect(pad.l + 52, 2, 10, 10);
      ctx.fillStyle = fg; ctx.fillText('复习', pad.l + 66, 11);
    },

    /* 掌握度分布甜甜圈图 */
    pie: function (canvas, dist) {
      var s = setup(canvas), ctx = s.ctx, W = s.w, H = s.h;
      var items = [
        { label: '未学习', v: dist.fresh, c: '#c9d4c5' },
        { label: '初见', v: dist.m01, c: '#a8d5a2' },
        { label: '学习中', v: dist.m23, c: '#f2c14e' },
        { label: '熟练', v: dist.m4, c: '#ef8354' },
        { label: '已掌握', v: dist.m5, c: '#5aa9e6' }
      ];
      var total = items.reduce(function (a, b) { return a + b.v; }, 0) || 1;
      var cx = Math.min(W * 0.32, H / 2 + 10), cy = H / 2, R = Math.min(H / 2 - 14, 90), r = R * 0.58;
      var ang = -Math.PI / 2;
      items.forEach(function (it) {
        var sweep = Math.PI * 2 * it.v / total;
        ctx.beginPath();
        ctx.arc(cx, cy, R, ang, ang + sweep);
        ctx.arc(cx, cy, r, ang + sweep, ang, true);
        ctx.closePath();
        ctx.fillStyle = it.c; ctx.fill();
        ang += sweep;
      });
      ctx.fillStyle = cssVar('--fg');
      ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(Math.round((dist.m5 + dist.m4) / total * 100) + '%', cx, cy + 2);
      ctx.font = '11px sans-serif'; ctx.fillStyle = cssVar('--fg-muted');
      ctx.fillText('掌握+熟练', cx, cy + 20);
      ctx.textAlign = 'left';
      // 图例
      var lx = cx + R + 24, ly = cy - items.length * 13 + 8;
      items.forEach(function (it) {
        ctx.fillStyle = it.c; rr(ctx, lx, ly - 9, 12, 12, 3); ctx.fill();
        ctx.fillStyle = cssVar('--fg'); ctx.font = '12px sans-serif';
        ctx.fillText(it.label + '  ' + it.v, lx + 20, ly + 2);
        ly += 26;
      });
    },

    /* GitHub 风格打卡日历（近12周） */
    calendar: function (container, daily) {
      container.innerHTML = '';
      var weeks = 12, today = new Date();
      var goal = Math.max(1, Store.state.settings.dailyGoal);
      var wrap = document.createElement('div');
      wrap.className = 'cal-grid';
      for (var w = weeks - 1; w >= 0; w--) {
        var col = document.createElement('div');
        col.className = 'cal-col';
        for (var d = 0; d < 7; d++) {
          var day = new Date(today.getTime() - (w * 7 + (6 - d)) * 86400000);
          var k = day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0');
          var rec = daily[k];
          var n = rec ? rec.learned + rec.reviewed : 0;
          var cell = document.createElement('div');
          cell.className = 'cal-cell';
          var ratio = Math.min(1, n / goal);
          cell.style.background = n === 0 ? 'var(--border)' :
            'rgba(127,176,105,' + (0.25 + ratio * 0.75).toFixed(2) + ')';
          cell.title = k + '：学习 ' + (rec ? rec.learned : 0) + '，复习 ' + (rec ? rec.reviewed : 0) + '，正确 ' + (rec ? rec.right : 0);
          if (k === Store.todayKey()) cell.classList.add('today');
          col.appendChild(cell);
        }
        wrap.appendChild(col);
      }
      container.appendChild(wrap);
    }
  };

  window.Charts = Charts;
})();
