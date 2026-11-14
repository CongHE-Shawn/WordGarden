/* views.js — 首页(花园+学习区) / 词库管理 / 数据统计 / 设置 / 新手定级 */
(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $(id) { return document.getElementById(id); }

  /* 题型中文名（错题本显示"错在哪种题型"） */
  var TYPE_CN = {
    zh2en: '选词', en2zh: '选义', listen: '听音', spell: '拼写',
    cloze: '填空', pos: '词性变形', syn: '近义词'
  };

  var SVG_EMPTY =
    '<svg class="empty-svg" viewBox="0 0 200 140" fill="none">' +
    '<ellipse cx="100" cy="120" rx="80" ry="12" fill="var(--border)"/>' +
    '<path d="M100 118 C100 90 92 78 78 70 C96 74 100 86 100 100 C100 86 104 74 122 70 C108 78 100 90 100 118Z" fill="#7fb069"/>' +
    '<circle cx="78" cy="64" r="10" fill="#f2c14e"/><circle cx="122" cy="64" r="10" fill="#ef8354"/>' +
    '<circle cx="78" cy="64" r="4" fill="#fff"/><circle cx="122" cy="64" r="4" fill="#fff"/>' +
    '<path d="M60 40 q10 -14 20 0 M120 36 q10 -14 20 0" stroke="var(--fg-muted)" stroke-width="3" stroke-linecap="round"/>' +
    '</svg>';

  var Views = {
    SVG_EMPTY: SVG_EMPTY,
    current: 'home',
    manage: { page: 1, size: 50, deck: '', lv: '', theme: '', status: '', q: '', selected: {} },

    /* ================= 首页（多邻国式闯关地图） ================= */
    renderHome: function () {
      this.current = 'home';
      var deck = Store.state.settings.deck;
      var meta = Bank.manifest()[deck] || { name: deck };
      var li = Store.levelInfo();
      $('view').innerHTML =
        '<div class="home-wrap">' +
          '<div class="game-bar">' +
            '<div class="level-badge" id="level-badge" title="点击查看成就">' +
              '<span class="lv-num">Lv.' + li.level + '</span>' +
              '<span class="lv-xp">' + li.intoLevel + '/' + li.needForNext + ' XP</span>' +
              '<div class="lv-track"><div class="lv-fill" style="width:' + Math.min(100, li.intoLevel / li.needForNext * 100) + '%"></div></div>' +
            '</div>' +
            '<button class="game-btn" id="btn-missions">🎯 每日任务</button>' +
            '<button class="game-btn" id="btn-achievements">🏆 成就</button>' +
            '<button class="game-btn checkin-btn" id="btn-checkin">📅 签到</button>' +
          '</div>' +
          '<div class="mascot-welcome" id="mascot-welcome"></div>' +
          '<div id="garden-box" class="garden-box"></div>' +
          '<div class="path-card">' +
            '<div class="path-head">' +
              '<h3>🗺️ 闯关路径</h3>' +
              '<div class="deck-picker">词库：<b id="home-deck-name">' + esc(meta.name) + '</b> <button class="btn ghost sm" id="btn-switch-deck">切换</button></div>' +
            '</div>' +
            '<div class="unit-path" id="unit-path"><div class="loading">路径加载中…</div></div>' +
            '<div class="path-foot" id="path-foot"></div>' +
          '</div>' +
          '<div class="practice-card">' +
            '<div class="practice-head">📖 复习巩固</div>' +
            '<div class="mode-chips" id="mode-bar">' +
              '<button class="chip" data-mode="cards">🃏 卡片复习</button>' +
              '<button class="chip" data-mode="review">🔥 错词重练</button>' +
              '<button class="chip" data-mode="notebook">📒 生词本</button>' +
              '<button class="chip" data-mode="rank">🏆 排行榜</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      this.renderGarden($('garden-box'));
      this.renderWelcomeMascot($('mascot-welcome'));
      var self = this;
      $('btn-switch-deck').onclick = function () { Views.deckPickerDialog(); };
      $('btn-missions').onclick = function () { Views.showMissions(); };
      $('btn-achievements').onclick = function () { Views.showAchievements(); };
      $('btn-checkin').onclick = function () { Views.doCheckIn(); };
      $('level-badge').onclick = function () { Views.showAchievements(); };
      document.querySelectorAll('#mode-bar .chip').forEach(function (c) {
        c.onclick = function () {
          var mode = c.dataset.mode;
          if (mode === 'cards') Study.start(deck, 'cards');
          else if (mode === 'review') self.startReview(deck);
          else if (mode === 'notebook') self.startNotebook(deck);
          else if (mode === 'rank') self.showRanking();
        };
      });
      App.setNav('home');
      Bank.load(deck).then(function () { self.renderPath(); }).catch(function () {
        $('unit-path').innerHTML = '<div class="loading">该词库精写题库尚未就绪</div>';
      });
    },

    /* 错词重练：从已学且进重点池的词里取题 */
    startReview: function (deck) {
      var self = this;
      Bank.load(deck).then(function (bank) {
        var focusWords = {};
        for (var k in Store.state.words) {
          if (k.indexOf(deck + '|') === 0 && SRS.inFocusPool(Store.state.words[k])) {
            focusWords[k.split('|')[1]] = true;
          }
        }
        var entries = bank.words.filter(function (w) { return focusWords[w.word]; });
        if (!entries.length) { App.toast('暂无错词，先去闯关吧 🌱'); return; }
        self.runCustomLesson(deck, entries, '错词重练');
      });
    },

    startNotebook: function (deck) {
      var self = this;
      Bank.load(deck).then(function (bank) {
        var nb = {};
        for (var k in Store.state.words) {
          var p = Store.state.words[k];
          if (k.indexOf(deck + '|') === 0 && p.nb) nb[k.split('|')[1]] = true;
        }
        var entries = bank.words.filter(function (w) { return nb[w.word]; });
        if (!entries.length) { App.toast('生词本为空，答题时点 📒 收藏吧'); return; }
        self.runCustomLesson(deck, entries, '生词本');
      });
    },

    /* 用指定词条跑一节课（复用 Lesson 引擎；复习类直接考核，跳过教学） */
    runCustomLesson: function (deck, entries, title) {
      var unit = { idx: -1, words: entries, title: title };
      Lesson.deck = deck;
      Lesson.unitIdx = -1;
      Lesson.unit = unit;
      Lesson.custom = true;
      Lesson.flow = Bank.lessonFlow(unit);
      Lesson.pos = 0; Lesson.combo = 0; Lesson.bestCombo = 0;
      Lesson.right = 0; Lesson.wrong = 0; Lesson.judgedWord = {}; Lesson.showingFb = false;
      Lesson.phase = 'quiz'; // 复习类直接考核
      Lesson.active = true;
      Game.beginSession();
      Lesson.enterMode();
      Lesson.render();
    },

    renderPath: function () {
      var deck = Store.state.settings.deck;
      if (this.current !== 'home') return;
      var box = $('unit-path');
      if (!box) return;
      var bank = Bank.decks[deck];
      if (!bank || !bank.units.length) { box.innerHTML = '<div class="loading">该词库精写题库尚未就绪</div>'; return; }
      var units = bank.units;
      var st = Store.unitState(deck);
      var showCount = Math.min(units.length, st.unlocked + 1, 24);
      var nextUnit = null;
      var html = '';
      for (var i = 0; i < showCount; i++) {
        var u = units[i];
        var locked = i >= st.unlocked;
        var done = (st.done[i] || 0);
        var state = locked ? 'locked' : (done ? 'done' : 'open');
        if (!locked && !done && nextUnit === null) nextUnit = i;
        var crowns = Math.min(3, done);
        var first = u.words[0];
        // 课时名：课本原名（如 Unit 3 Family ties）+ 课时（如 课时1 Starting out & Reading）
        var unitTitle = u.title || ('第 ' + (i + 1) + ' 单元');
        var unitEn = u.en || '';
        var lessonName = u.lesson || '';
        // 节点数字：用课时序号（lessonIdx），无则用序号
        var nodeText = u.lessonIdx ? String(u.lessonIdx) : (i + 1);
        html +=
          '<div class="unit-row o' + (i % 5) + '">' +
            '<button class="unit-node ' + state + (state === 'open' ? ' pulse' : '') + '" data-i="' + i + '">' +
              (locked ? '<span class="u-lock">🔒</span>' : '<span class="u-num">' + esc(String(nodeText)) + '</span>') +
              (crowns ? '<span class="u-crown">' + '👑'.repeat(crowns) + '</span>' : '') +
            '</button>' +
            '<div class="u-label">' +
              '<b class="u-unit">' + esc(unitTitle) + '</b>' +
              (lessonName ? '<i class="u-unit-en">' + esc(lessonName) + '</i>' : (unitEn ? '<i class="u-unit-en">' + esc(unitEn) + '</i>' : '')) +
              '<span class="u-words">' + u.words.length + ' 词 · ' + (first ? esc(first.gloss.split('；')[0]) : '') + ' …</span>' +
            '</div>' +
          '</div>';
      }
      if (units.length > showCount) html += '<div class="unit-more">… 共 ' + units.length + ' 个课时</div>';
      box.innerHTML = html;
      box.querySelectorAll('.unit-node').forEach(function (b) {
        b.onclick = function () {
          var i = +b.dataset.i;
          if (i >= st.unlocked) {
            b.classList.add('shake');
            setTimeout(function () { b.classList.remove('shake'); }, 500);
            App.toast('完成前面的单元才能解锁哦 🌱');
            return;
          }
          Lesson.start(deck, i);
        };
      });
      var foot = $('path-foot');
      if (foot) {
        var nextName = nextUnit !== null ? (units[nextUnit].title || ('第 ' + (nextUnit + 1) + ' 单元')) : '';
        foot.innerHTML = nextUnit !== null
          ? '<button class="btn primary lg" id="btn-continue">▶ 继续 ' + esc(nextName) + '</button>'
          : '<button class="btn primary lg" id="btn-continue">🎓 本词库全部通关！换一个词库</button>';
        $('btn-continue').onclick = function () {
          if (nextUnit !== null) Lesson.start(deck, nextUnit);
          else Views.deckPickerDialog();
        };
      }
    },

    /* ---------- 首页吉祥物欢迎语 ---------- */
    renderWelcomeMascot: function (box) {
      if (!box) return;
      var u = Store.activeUser();
      var greeting = '';
      var h = new Date().getHours();
      if (h >= 5 && h < 12) greeting = '早上好';
      else if (h >= 12 && h < 18) greeting = '下午好';
      else greeting = '晚上好';
      var now = new Date();
      var hh = String(now.getHours()).padStart(2, '0');
      var mm = String(now.getMinutes()).padStart(2, '0');
      box.innerHTML =
        '<div class="mascot-stage" style="justify-content:flex-start">' +
          '<div id="welcome-mascot"></div>' +
          '<div class="mascot-speech">' + esc(greeting) + '，' + esc(u ? u.name : '同学') + '！' +
            '今天也要种下新的单词哦 🌱' +
            '<div class="mascot-time">🕐 北京时间 ' + hh + ':' + mm + '</div>' +
          '</div>' +
        '</div>';
      Mascot.render($('welcome-mascot'), 'happy', 96);
    },

    /* ---------- 排行榜（本机多用户） ---------- */
    showRanking: function () {
      var users = Store.listUsers();
      var me = Store.activeUser();
      users.sort(function (a, b) { return b.xp - a.xp; });
      var medals = ['🥇', '🥈', '🥉'];
      var html = '<div class="modal-mask" id="modal-mask"><div class="modal"><h3>🏆 花园排行榜</h3>' +
        '<p class="ob-sub">这台设备上所有同学的学习成绩比拼</p><div class="rank-list">';
      users.forEach(function (u, i) {
        var isMe = me && u.id === me.id;
        html += '<div class="rank-row' + (isMe ? ' me' : '') + '" style="--u-color:' + u.color + '">' +
          '<span class="rank-no' + (i < 3 ? ' top' + (i + 1) : '') + '">' + (i < 3 ? medals[i] : (i + 1)) + '</span>' +
          '<span class="rank-avatar">' + u.avatar + '</span>' +
          '<div class="rank-info"><b>' + esc(u.name) + (isMe ? '（我）' : '') + '</b><span>已学 ' + u.learned + ' 词 · 掌握 ' + u.mastered + ' · 🔥 ' + u.streak + ' 天</span></div>' +
          '<span class="rank-xp">' + u.xp + ' XP</span>' +
        '</div>';
      });
      if (!users.length) html += '<p class="ob-sub">暂无用户</p>';
      html += '</div><button class="btn ghost" id="modal-close">关闭</button></div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
      $('modal-close').onclick = function () { $('modal-mask').remove(); };
      $('modal-mask').onclick = function (e) { if (e.target.id === 'modal-mask') e.target.remove(); };
    },

    /* ---------- 花园 SVG ---------- */
    renderGarden: function (box) {
      if (!box) return;
      var words = Store.state.words;
      var plants = [];
      for (var k in words) {
        var p = words[k];
        if (p.last > 0) plants.push({ w: k.split('|')[1], m: p.m || 0, last: p.last });
      }
      plants.sort(function (a, b) { return b.last - a.last; });
      var totalLearned = plants.length;
      plants = plants.slice(0, 22);
      var COLORS = ['#ef8354', '#f778ba', '#b388eb', '#5aa9e6', '#f2c14e', '#e4572e'];
      function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
      var svg = '<svg viewBox="0 0 680 190" class="garden-svg">';
      // 天空装饰
      svg += '<circle cx="600" cy="34" r="22" fill="#ffd66b" class="sun"/><g class="clouds" fill="#ffffff" opacity="0.85">' +
        '<ellipse cx="90" cy="30" rx="26" ry="11"/><ellipse cx="112" cy="25" rx="18" ry="9"/>' +
        '<ellipse cx="330" cy="20" rx="22" ry="9"/><ellipse cx="348" cy="16" rx="14" ry="7"/></g>';
      // 地面
      svg += '<path d="M0 150 Q170 138 340 150 T680 150 V190 H0 Z" fill="#8fbf7f"/>' +
        '<path d="M0 158 Q170 148 340 158 T680 158 V190 H0 Z" fill="#7fb069"/>';
      if (!plants.length) {
        svg += '<g class="seed-packet"><rect x="300" y="96" width="80" height="58" rx="8" fill="#fff8e7" stroke="#e0c98f"/>' +
          '<text x="340" y="122" text-anchor="middle" font-size="13" fill="#8a6d3b">种子袋</text>' +
          '<text x="340" y="142" text-anchor="middle" font-size="11" fill="#8a6d3b">学完第 1 个词</text>' +
          '<text x="340" y="156" text-anchor="middle" font-size="11" fill="#8a6d3b">就会发芽 🌱</text></g>';
      }
      // 植物
      plants.forEach(function (pl, i) {
        var x = 40 + (i % 11) * 58 + (hash(pl.w) % 14);
        var row = Math.floor(i / 11);
        var gy = 150 + row * 18;
        var c = COLORS[hash(pl.w) % COLORS.length];
        var sway = 'class="plant p' + (i % 3) + '"';
        if (pl.m <= 1) {
          svg += '<g ' + sway + '><path d="M' + x + ' ' + gy + ' q-1 -12 -8 -16 M' + x + ' ' + gy + ' q1 -12 8 -16" stroke="#4e7a45" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
            '<ellipse cx="' + (x - 9) + '" cy="' + (gy - 17) + '" rx="5" ry="3" fill="#6aa35f" transform="rotate(-30 ' + (x - 9) + ' ' + (gy - 17) + ')"/>' +
            '<ellipse cx="' + (x + 9) + '" cy="' + (gy - 17) + '" rx="5" ry="3" fill="#6aa35f" transform="rotate(30 ' + (x + 9) + ' ' + (gy - 17) + ')"/></g>';
        } else if (pl.m <= 3) {
          svg += '<g ' + sway + '><path d="M' + x + ' ' + gy + ' V' + (gy - 30) + '" stroke="#4e7a45" stroke-width="3" stroke-linecap="round"/>' +
            '<path d="M' + x + ' ' + (gy - 12) + ' q-12 -4 -14 -14" stroke="#4e7a45" stroke-width="2" fill="none"/>' +
            '<ellipse cx="' + (x - 14) + '" cy="' + (gy - 26) + '" rx="6" ry="3.5" fill="#6aa35f" transform="rotate(-40 ' + (x - 14) + ' ' + (gy - 26) + ')"/>' +
            '<circle cx="' + x + '" cy="' + (gy - 33) + '" r="5.5" fill="' + c + '" opacity="0.8"/></g>';
        } else {
          var petals = '';
          for (var a = 0; a < 6; a++) {
            var ang = a * 60 * Math.PI / 180;
            petals += '<ellipse cx="' + (x + Math.cos(ang) * 8) + '" cy="' + (gy - 38 + Math.sin(ang) * 8) + '" rx="6" ry="4" fill="' + c + '" transform="rotate(' + (a * 60) + ' ' + (x + Math.cos(ang) * 8) + ' ' + (gy - 38 + Math.sin(ang) * 8) + ')"/>';
          }
          svg += '<g ' + sway + '><path d="M' + x + ' ' + gy + ' V' + (gy - 34) + '" stroke="#4e7a45" stroke-width="3" stroke-linecap="round"/>' +
            '<ellipse cx="' + (x - 8) + '" cy="' + (gy - 16) + '" rx="7" ry="3.5" fill="#6aa35f" transform="rotate(-35 ' + (x - 8) + ' ' + (gy - 16) + ')"/>' +
            petals + '<circle cx="' + x + '" cy="' + (gy - 38) + '" r="4.5" fill="#ffd66b"/></g>';
        }
      });
      // 蝴蝶（掌握数>=5解锁）
      var mastered = 0;
      for (var k2 in words) if (words[k2].status === 'mastered') mastered++;
      if (mastered >= 5) {
        svg += '<g class="butterfly"><path d="M200 60 q-10 -12 -2 -18 q8 6 2 18 q6 -12 14 -10 q2 10 -14 10Z" fill="#b388eb"/></g>';
      }
      svg += '</svg>';
      box.innerHTML = svg +
        '<div class="garden-caption">🌿 我的花园 · 已种下 <b>' + totalLearned + '</b> 株 · 盛开 <b>' + mastered + '</b> 朵 · 经验值 <b>' + Store.state.garden.xp + '</b></div>';
    },

    /* ---------- 每日任务弹窗 ---------- */
    showMissions: function () {
      var MISS = Store.MISSIONS;
      var prog = Store.missionProgress();
      var g = Store.gameState();
      var html = '<div class="modal-mask" id="modal-mask"><div class="modal"><h3>🎯 每日任务</h3>' +
        '<p class="ob-sub">完成每日任务可获得经验，升级更快哦</p><div class="mission-list">';
      Object.keys(MISS).forEach(function (id) {
        var m = MISS[id];
        var cur = Math.min(m.target, m.kind === 'unit' ? prog.units : prog.learn);
        var claimed = g.missions.claimed && g.missions.claimed[id];
        var done = cur >= m.target;
        html += '<div class="mission-row' + (done ? ' done' : '') + '">' +
          '<span class="m-ico">' + m.ico + '</span>' +
          '<div class="m-info"><b>' + esc(m.name) + '</b>' +
          '<div class="m-track"><div class="m-fill" style="width:' + (cur / m.target * 100) + '%"></div></div>' +
          '<span>' + cur + ' / ' + m.target + '</span></div>' +
          (claimed ? '<span class="m-claimed">已领取 ✓</span>'
            : done ? '<button class="btn sm primary m-claim" data-id="' + id + '">领取 +15</button>'
            : '<span class="m-locked">进行中</span>') +
          '</div>';
      });
      html += '</div><button class="btn ghost" id="modal-close">关闭</button></div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
      $('modal-close').onclick = function () { $('modal-mask').remove(); };
      $('modal-mask').onclick = function (e) { if (e.target.id === 'modal-mask') e.target.remove(); };
      document.querySelectorAll('.m-claim').forEach(function (b) {
        b.onclick = function () {
          var r = Game.claimMission(b.dataset.id);
          if (r) { App.toast('领取成功 +' + r + ' XP 🎉'); b.textContent = '已领取 ✓'; b.disabled = true; }
        };
      });
    },

    /* ---------- 成就弹窗 ---------- */
    showAchievements: function () {
      var ACH = Store.ACHIEVEMENTS;
      var unlocked = Store.gameState().achievements;
      var html = '<div class="modal-mask" id="modal-mask"><div class="modal"><h3>🏆 我的成就</h3>' +
        '<p class="ob-sub">已解锁 ' + Object.keys(unlocked).length + ' / ' + Object.keys(ACH).length + '</p>' +
        '<div class="ach-grid">';
      Object.keys(ACH).forEach(function (id) {
        var a = ACH[id];
        var on = !!unlocked[id];
        html += '<div class="ach-item' + (on ? '' : ' locked') + '">' +
          '<span class="ach-ico">' + a.ico + '</span>' +
          '<div class="ach-info"><b>' + esc(a.name) + '</b><span>' + esc(a.desc) + '</span></div>' +
          (on ? '<span class="ach-badge">✓</span>' : '<span class="ach-lock">🔒</span>') +
          '</div>';
      });
      html += '</div><button class="btn ghost" id="modal-close">关闭</button></div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
      $('modal-close').onclick = function () { $('modal-mask').remove(); };
      $('modal-mask').onclick = function (e) { if (e.target.id === 'modal-mask') e.target.remove(); };
    },

    /* ---------- 每日签到 ---------- */
    doCheckIn: function () {
      var r = Game.checkIn();
      if (r === null) {
        App.toast('今天已经签到过啦，明天再来 🌙');
        return;
      }
      App.toast('签到成功 +' + r + ' XP 🎉 连续 ' + Store.state.streak.count + ' 天');
      App.updateProgressPill();
    },

    /* ---------- 词库切换弹窗 ---------- */
    deckPickerDialog: function () {
      var man = Data.manifest();
      var customCount = Data.loadCustom().length;
      var html = '<div class="modal-mask" id="modal-mask"><div class="modal"><h3>选择词库</h3><div class="deck-grid">';
      Object.keys(man).forEach(function (id) {
        var m = man[id];
        html += '<button class="deck-card" data-deck="' + id + '" style="--deck-color:' + m.color + '">' +
          '<b>' + esc(m.name) + '</b><span>' + esc(m.en) + '</span><em>' + m.count + ' 词</em><i>' + esc(m.desc) + '</i></button>';
      });
      if (customCount) {
        html += '<button class="deck-card" data-deck="custom" style="--deck-color:#48c9b0"><b>自定义词库</b><span>Imported</span><em>' + customCount + ' 词</em><i>通过 CSV 导入的词库</i></button>';
      }
      html += '</div><button class="btn ghost" id="modal-close">取消</button></div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
      $('modal-close').onclick = function () { $('modal-mask').remove(); };
      $('modal-mask').onclick = function (e) { if (e.target.id === 'modal-mask') e.target.remove(); };
      document.querySelectorAll('.deck-card').forEach(function (b) {
        b.onclick = function () {
          Store.state.settings.deck = b.dataset.deck;
          Store.save();
          $('modal-mask').remove();
          Views.renderHome();
        };
      });
    },

    /* ================= 词库管理 ================= */
    renderManage: function () {
      this.current = 'manage';
      var self = this, M = this.manage;
      M.deck = M.deck || Store.state.settings.deck;
      var man = Data.manifest();
      $('view').innerHTML =
        '<div class="manage-wrap">' +
          '<div class="manage-toolbar">' +
            '<select id="m-deck" class="input">' + Object.keys(man).map(function (id) {
              return '<option value="' + id + '"' + (id === M.deck ? ' selected' : '') + '>' + esc(man[id].name) + '（' + man[id].count + '）</option>';
            }).join('') + (Data.loadCustom().length ? '<option value="custom"' + (M.deck === 'custom' ? ' selected' : '') + '>自定义词库（' + Data.loadCustom().length + '）</option>' : '') + '</select>' +
            '<select id="m-lv" class="input"><option value="">全部难度</option>' + [1, 2, 3, 4, 5].map(function (l) {
              return '<option value="' + l + '"' + (String(l) === M.lv ? ' selected' : '') + '>' + '★'.repeat(l) + ' 难度' + l + '</option>';
            }).join('') + '</select>' +
            '<select id="m-theme" class="input"><option value="">全部主题</option>' + Data.THEMES.map(function (t) {
              return '<option value="' + t.id + '"' + (t.id === M.theme ? ' selected' : '') + '>' + t.name + '</option>';
            }).join('') + '<option value="other"' + (M.theme === 'other' ? ' selected' : '') + '>其他</option></select>' +
            '<select id="m-status" class="input">' +
              [['', '全部状态'], ['fresh', '未学习'], ['learning', '学习中'], ['focus', '🔥 重点池'], ['mastered', '已掌握'], ['fav', '⭐ 已收藏'], ['nb', '📒 生词本']].map(function (o) {
                return '<option value="' + o[0] + '"' + (o[0] === M.status ? ' selected' : '') + '>' + o[1] + '</option>';
              }).join('') + '</select>' +
            '<input id="m-q" class="input search" placeholder="🔍 模糊搜索单词/释义…" value="' + esc(M.q) + '">' +
            '<label class="btn ghost sm file-label">导入CSV<input type="file" id="m-csv" accept=".csv" hidden></label>' +
          '</div>' +
          '<div class="manage-batch" id="m-batch" style="display:none">' +
            '<span id="m-sel-count">已选 0 词</span>' +
            '<button class="btn sm" id="b-nb">📒 加入生词本</button>' +
            '<button class="btn sm" id="b-fav">⭐ 收藏</button>' +
            '<button class="btn sm" id="b-master">🌸 标记掌握</button>' +
            '<button class="btn sm danger" id="b-reset">🗑 重置进度</button>' +
          '</div>' +
          '<div id="m-list" class="m-list"><div class="loading">词库加载中…</div></div>' +
          '<div class="pager" id="m-pager"></div>' +
        '</div>';
      App.setNav('manage');
      Data.loadDeck(M.deck).then(function () { self.renderManageList(); });
      $('m-deck').onchange = function () { M.deck = this.value; M.page = 1; M.selected = {}; Data.loadDeck(M.deck).then(function () { self.renderManageList(); }); };
      $('m-lv').onchange = function () { M.lv = this.value; M.page = 1; self.renderManageList(); };
      $('m-theme').onchange = function () { M.theme = this.value; M.page = 1; self.renderManageList(); };
      $('m-status').onchange = function () { M.status = this.value; M.page = 1; self.renderManageList(); };
      var deb;
      $('m-q').oninput = function () { clearTimeout(deb); var v = this.value; deb = setTimeout(function () { M.q = v; M.page = 1; self.renderManageList(); }, 250); };
      $('m-csv').onchange = function () {
        var f = this.files[0]; if (!f) return;
        var rd = new FileReader();
        rd.onload = function () {
          var n = Data.importCSV(String(rd.result));
          alert('成功导入 ' + n + ' 个单词到「自定义词库」');
          Views.renderManage();
        };
        rd.readAsText(f, 'utf-8');
      };
      // 批量操作
      $('b-nb').onclick = function () { self.batchApply(function (p) { p.nb = true; }); };
      $('b-fav').onclick = function () { self.batchApply(function (p) { p.fav = true; }); };
      $('b-master').onclick = function () {
        self.batchApply(function (p) { p.lvl = 7; p.m = 5; p.status = 'mastered'; p.streak = 2; p.last = Date.now(); p.next = Date.now() + 15 * 86400000; });
      };
      $('b-reset').onclick = function () {
        if (!confirm('确定重置所选单词的学习进度？此操作不可撤销。')) return;
        var deck = M.deck;
        Object.keys(M.selected).forEach(function (w) { if (M.selected[w]) delete Store.state.words[Store.key(deck, w)]; });
        Store.save(); M.selected = {}; self.renderManageList();
      };
    },

    manageFiltered: function () {
      var M = this.manage;
      var q = M.q.trim().toLowerCase();
      return Data.words(M.deck).filter(function (rec) {
        if (M.lv && String(rec.lv) !== M.lv) return false;
        if (M.theme && Data.classifyTheme(rec) !== M.theme) return false;
        var p = Store.peekWord(M.deck, rec.w);
        if (M.status) {
          if (M.status === 'fresh' && p) return false;
          if (M.status === 'learning' && !(p && (p.status === 'learning' || p.status === 'review'))) return false;
          if (M.status === 'focus' && !SRS.inFocusPool(p)) return false;
          if (M.status === 'mastered' && !(p && p.status === 'mastered')) return false;
          if (M.status === 'fav' && !(p && p.fav)) return false;
          if (M.status === 'nb' && !(p && p.nb)) return false;
        }
        if (q && rec.w.toLowerCase().indexOf(q) < 0 && (rec.t || '').toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
    },

    renderManageList: function () {
      var self = this, M = this.manage;
      var list = this.manageFiltered();
      var pages = Math.max(1, Math.ceil(list.length / M.size));
      if (M.page > pages) M.page = pages;
      var start = (M.page - 1) * M.size;
      var slice = list.slice(start, start + M.size);
      var html = '<div class="m-head"><label><input type="checkbox" id="m-all"> 全选</label><span>共 <b>' + list.length + '</b> 词</span></div>';
      if (!slice.length) {
        html += '<div class="empty-state">' + SVG_EMPTY + '<h3>没有符合条件的单词</h3><p>试试调整筛选条件或搜索关键词。</p></div>';
      }
      slice.forEach(function (rec) {
        var p = Store.peekWord(M.deck, rec.w);
        var badge = !p ? '<span class="st st-fresh">未学</span>'
          : p.status === 'mastered' ? '<span class="st st-mastered">已掌握</span>'
          : SRS.inFocusPool(p) ? '<span class="st st-focus">重点池</span>'
          : '<span class="st st-learning">学习中</span>';
        html += '<div class="m-row">' +
          '<input type="checkbox" class="m-check" data-w="' + esc(rec.w) + '"' + (M.selected[rec.w] ? ' checked' : '') + '>' +
          '<b class="m-word" data-wd="' + esc(rec.w) + '" title="点击查看详情">' + esc(rec.w) + '</b>' +
          '<span class="m-phon">' + (rec.p ? '/' + esc(rec.p) + '/' : '') + '</span>' +
          '<span class="m-trans" title="' + esc(rec.t) + '">' + esc(rec.t) + '</span>' +
          '<span class="m-lv">' + '★'.repeat(rec.lv || 3) + '</span>' + badge +
          '<span class="m-ops">' +
            '<button class="icon-btn' + (p && p.fav ? ' on' : '') + '" data-act="fav" data-w="' + esc(rec.w) + '" title="收藏">⭐</button>' +
            '<button class="icon-btn' + (p && p.nb ? ' on' : '') + '" data-act="nb" data-w="' + esc(rec.w) + '" title="生词本">📒</button>' +
            '<button class="icon-btn" data-act="play" data-w="' + esc(rec.w) + '" title="发音">🔊</button>' +
          '</span></div>';
      });
      $('m-list').innerHTML = html;
      // 分页
      var pg = '<button class="btn sm ghost" id="pg-prev"' + (M.page <= 1 ? ' disabled' : '') + '>← 上一页</button>' +
        '<span>第 ' + M.page + ' / ' + pages + ' 页</span>' +
        '<button class="btn sm ghost" id="pg-next"' + (M.page >= pages ? ' disabled' : '') + '>下一页 →</button>';
      $('m-pager').innerHTML = pg;
      $('pg-prev').onclick = function () { if (M.page > 1) { M.page--; self.renderManageList(); } };
      $('pg-next').onclick = function () { if (M.page < pages) { M.page++; self.renderManageList(); } };
      // 事件
      var allBox = $('m-all');
      if (allBox) allBox.onchange = function () {
        slice.forEach(function (rec) { M.selected[rec.w] = allBox.checked; });
        self.renderManageList();
      };
      document.querySelectorAll('.m-check').forEach(function (c) {
        c.onchange = function () {
          M.selected[c.dataset.w] = c.checked;
          var n = Object.keys(M.selected).filter(function (k) { return M.selected[k]; }).length;
          $('m-batch').style.display = n ? 'flex' : 'none';
          $('m-sel-count').textContent = '已选 ' + n + ' 词';
        };
      });
      document.querySelectorAll('.m-ops .icon-btn').forEach(function (b) {
        b.onclick = function () {
          var w = b.dataset.w, act = b.dataset.act;
          if (act === 'play') { TTS.speak(w); return; }
          var p = Store.getWord(M.deck, w);
          if (act === 'fav') p.fav = !p.fav; else p.nb = !p.nb;
          Store.save();
          b.classList.toggle('on');
        };
      });
      // 点击单词查看详情
      document.querySelectorAll('.m-word').forEach(function (b) {
        b.onclick = function (e) {
          if (e.target.closest('.m-check')) return;
          self.showWordDetail(M.deck, b.dataset.wd);
        };
      });
    },

    batchApply: function (fn) {
      var M = this.manage;
      Object.keys(M.selected).forEach(function (w) {
        if (M.selected[w]) fn(Store.getWord(M.deck, w));
      });
      Store.save();
      M.selected = {};
      $('m-batch').style.display = 'none';
      this.renderManageList();
    },

    /* ---------- 单词详情页 ---------- */
    showWordDetail: function (deck, word) {
      var self = this;
      Bank.load(deck).then(function (bank) {
        var entry = null;
        for (var i = 0; i < bank.words.length; i++) if (bank.words[i].word === word) { entry = bank.words[i]; break; }
        if (!entry) { App.toast('未找到该单词'); return; }
        var p = Store.peekWord(deck, word);
        // 例句：优先 cloze 题目句子
        var example = { en: '', cn: '' };
        var qs = entry.questions || [];
        for (var j = 0; j < qs.length; j++) if (qs[j].type === 'cloze' && qs[j].sentence) {
          example.en = qs[j].sentence.replace(/_{3,}/g, entry.word); break;
        }
        var statusText = !p ? '未学习' : (p.status === 'mastered' ? '已掌握' : (SRS.inFocusPool(p) ? '重点池' : '学习中'));
        var lvlText = p ? (p.lvl != null ? p.lvl : 0) : 0;
        var nextText = p && p.next ? SRS.nextText(p) : '';
        // 记忆曲线（真实遗忘曲线可视化）
        var curveHtml = '';
        if (p && p.last > 0) {
          curveHtml = this.renderCurve(p);
        }
        var html = '<div class="modal-mask" id="modal-mask"><div class="modal word-detail">' +
          '<div class="wd-head">' +
            '<div class="wd-word">' + esc(entry.word) + (entry.phonetic ? '<span class="wd-phon">/' + esc(entry.phonetic) + '/</span>' : '') + '</div>' +
            '<button class="teach-play" id="wd-play" title="发音">🔊</button>' +
          '</div>' +
          '<div class="wd-gloss">' + esc(entry.gloss) + (entry.pos ? ' <span class="teach-pos">' + esc(entry.pos) + '</span>' : '') + '</div>' +
          (example.en ? '<div class="teach-example">' + Data.highlight(esc(example.en), entry.word) + '</div>' : '') +
          '<div class="wd-status">学习状态：<b>' + statusText + '</b>' +
            (lvlText > 0 ? ' · 熟练度 Lv.' + lvlText : '') +
            (nextText ? ' · 下次复习 ' + nextText : '') + '</div>' +
          curveHtml +
          '<div class="wd-ops">' +
            '<button class="btn sm' + (p && p.fav ? ' primary' : '') + '" id="wd-fav">' + (p && p.fav ? '⭐ 已收藏' : '⭐ 收藏') + '</button>' +
            '<button class="btn sm' + (p && p.nb ? ' primary' : '') + '" id="wd-nb">' + (p && p.nb ? '📒 已在生词本' : '📒 加入生词本') + '</button>' +
            '<button class="btn sm ghost" id="wd-speak">🔊 听发音</button>' +
          '</div>' +
          '<button class="btn ghost" id="modal-close">关闭</button>' +
        '</div></div>';
        document.body.insertAdjacentHTML('beforeend', html);
        $('modal-close').onclick = function () { $('modal-mask').remove(); };
        $('modal-mask').onclick = function (e) { if (e.target.id === 'modal-mask') e.target.remove(); };
        $('wd-play').onclick = function () { TTS.speak(entry.word); };
        $('wd-speak').onclick = function () { TTS.speak(entry.word); };
        $('wd-fav').onclick = function () {
          var pp = Store.getWord(deck, word); pp.fav = !pp.fav; Store.save();
          self.showWordDetail(deck, word); $('modal-mask').remove();
        };
        $('wd-nb').onclick = function () {
          var pp = Store.getWord(deck, word); pp.nb = !pp.nb; Store.save();
          self.showWordDetail(deck, word); $('modal-mask').remove();
        };
      });
    },

    /* ================= 错题本 ================= */
    renderMistakes: function () {
      this.current = 'mistakes';
      var self = this;
      var deck = Store.state.settings.deck;
      var all = Store.mistakeList();
      var byDeck = {};
      all.forEach(function (m) { byDeck[m.deck] = (byDeck[m.deck] || 0) + 1; });

      var html =
        '<div class="mistakes-wrap">' +
          '<div class="mk-head">' +
            '<div class="mk-head-l">' +
              '<h2>📕 错题本</h2>' +
              '<p class="mk-sub">答错的词会自动收进来 · 连续答对 2 次自动移出</p>' +
            '</div>' +
            '<div class="mk-head-r">' +
              '<div class="mk-count"><b>' + all.length + '</b><span>总错题</span></div>' +
              '<div class="mk-count"><b>' + all.filter(function (m) { return (m.wrong || 0) >= 3; }).length + '</b><span>顽固错题</span></div>' +
            '</div>' +
          '</div>' +
          '<div class="mk-actions">' +
            '<button class="btn primary" id="mk-drill" ' + (all.length ? '' : 'disabled') + '>🔥 重练全部错题</button>' +
            '<button class="btn" id="mk-hard" ' + (all.length ? '' : 'disabled') + '>💪 只练错 3 次以上的</button>' +
            '<button class="btn ghost" id="mk-clear">🧹 清空</button>' +
          '</div>';

      if (!all.length) {
        html +=
          '<div class="mk-empty">' +
            '<div class="mk-empty-ico">🎉</div>' +
            '<h3>还没有错题！</h3>' +
            '<p>继续闯关吧，答错的词会自动出现在这里</p>' +
            '<button class="btn primary lg" id="mk-back">返回闯关</button>' +
          '</div>';
      } else {
        // 按词库分组
        var decks = Object.keys(byDeck);
        html += '<div class="mk-groups">';
        decks.forEach(function (dk) {
          var name = (Data.manifest()[dk] || {}).name || dk;
          var items = all.filter(function (m) { return m.deck === dk; });
          html += '<div class="mk-group">' +
            '<div class="mk-group-h"><b>' + esc(name) + '</b><span>' + items.length + ' 个错题</span></div>' +
            '<div class="mk-list">';
          items.forEach(function (m) {
            var p = Store.peekWord(m.deck, m.word);
            var st = SRS.strengthText(p || {});
            var ret = p ? Math.round(SRS.retention(p) * 100) : 0;
            var when = m.lastWrong ? this._ago(m.lastWrong) : '';
            html +=
              '<div class="mk-item" data-k="' + esc(m.deck + '|' + m.word) + '">' +
                '<div class="mk-item-main">' +
                  '<div class="mk-word">' + esc(m.word) +
                    (m.wrong >= 3 ? '<span class="mk-hot">🔥' + m.wrong + '</span>' : '<span class="mk-cnt">错' + m.wrong + '次</span>') +
                  '</div>' +
                  '<div class="mk-gloss">' + esc((p && p.gloss) || m.gloss || '') + '</div>' +
                  '<div class="mk-meta">' +
                    '<span class="mk-ret" style="color:' + st.color + '">记忆 ' + ret + '%</span>' +
                    (m.lastType ? '<span>错在 ' + esc(TYPE_CN[m.lastType] || m.lastType) + '</span>' : '') +
                    (when ? '<span>' + when + '</span>' : '') +
                  '</div>' +
                '</div>' +
                '<div class="mk-item-ops">' +
                  '<button class="mk-op" data-act="speak" title="发音">🔊</button>' +
                  '<button class="mk-op" data-act="detail" title="详情">📖</button>' +
                  '<button class="mk-op mk-del" data-act="del" title="移除">🗑</button>' +
                '</div>' +
              '</div>';
          }, this);
          html += '</div></div>';
        });
        html += '</div>';
      }

      $('view').innerHTML = html;

      // 事件
      if ($('mk-back')) $('mk-back').onclick = function () { App.go('home'); };
      if ($('mk-drill')) $('mk-drill').onclick = function () { self.startMistakeDrill(all); };
      if ($('mk-hard')) $('mk-hard').onclick = function () {
        var hard = all.filter(function (m) { return (m.wrong || 0) >= 3; });
        if (!hard.length) { App.toast('还没有错 3 次以上的词哦 🌱'); return; }
        self.startMistakeDrill(hard);
      };
      if ($('mk-clear')) $('mk-clear').onclick = function () {
        if (!confirm('确定清空全部错题吗？此操作不可撤销。')) return;
        Store.state.mistakes = {};
        Store.save();
        if (window.Storage) Storage.sync();
        App.toast('错题本已清空 🧹');
        self.renderMistakes();
      };

      // 词条操作
      document.querySelectorAll('.mk-item').forEach(function (it) {
        var k = it.dataset.k;
        var parts = k.split('|');
        var dk = parts[0], wd = parts[1];
        it.querySelectorAll('.mk-op').forEach(function (b) {
          b.onclick = function (e) {
            e.stopPropagation();
            var act = b.dataset.act;
            if (act === 'speak') { TTS.speak(wd); return; }
            if (act === 'detail') { self.showWordDetail(dk, wd); return; }
            if (act === 'del') {
              Store.removeMistake(dk, wd);
              Store.save();
              if (window.Storage) Storage.sync();
              App.toast('已移出错题本 🗑');
              self.renderMistakes();
            }
          };
        });
        it.onclick = function () { self.showWordDetail(dk, wd); };
      });
    },

    /* 重练错题：把错题词条组装成一个自定义课程 */
    startMistakeDrill: function (items) {
      var self = this;
      if (!items || !items.length) { App.toast('没有需要重练的错题 🌱'); return; }
      var decks = {};
      items.forEach(function (m) { (decks[m.deck] = decks[m.deck] || []).push(m.word); });
      var deckKeys = Object.keys(decks);
      var self2 = this;
      Promise.all(deckKeys.map(function (d) { return Bank.load(d); })).then(function () {
        var entries = [];
        deckKeys.forEach(function (d) {
          var byWord = {};
          Bank.decks[d].words.forEach(function (w) { byWord[w.word] = w; });
          decks[d].forEach(function (w) { if (byWord[w]) entries.push(byWord[w]); });
        });
        if (!entries.length) { App.toast('错题对应的词汇未找到 😢'); return; }
        // 复用自定义课程模式（复习类直接考核，跳过教学）
        self.runCustomLesson('mistakes', entries, '错题重练');
      }).catch(function (e) {
        App.toast('加载错题失败：' + e.message);
      });
    },

    /* 相对时间 */
    _ago: function (ts) {
      var diff = Date.now() - ts;
      var min = Math.floor(diff / 60000);
      if (min < 1) return '刚刚';
      if (min < 60) return min + ' 分钟前';
      var h = Math.floor(min / 60);
      if (h < 24) return h + ' 小时前';
      var d = Math.floor(h / 24);
      if (d < 30) return d + ' 天前';
      return Math.floor(d / 30) + ' 个月前';
    },

    /* ================= 记忆曲线可视化 ================= */
    /* 绘制真实的艾宾浩斯遗忘曲线 R(t)=e^(-t/S)
     * 横轴：距上次复习的天数；纵轴：记忆保持率 0-100%
     * 标出"当前保持率"与"下次复习点"
     */
    renderCurve: function (p) {
      if (!p || !p.last) return '';
      var DAYS = 30;
      var pts = SRS.curve(p, DAYS);
      var W = 320, H = 100, PADL = 26, PADR = 8, PADT = 8, PADB = 16;
      var iw = W - PADL - PADR, ih = H - PADT - PADB;
      var maxD = DAYS;
      function X(d) { return PADL + (d / maxD) * iw; }
      function Y(r) { return PADT + (1 - r) * ih; }

      var path = '';
      pts.forEach(function (pt, i) {
        path += (i ? 'L' : 'M') + X(pt.d).toFixed(1) + ' ' + Y(pt.r).toFixed(1) + ' ';
      });
      // 填充区域
      var fill = path + 'L' + X(maxD).toFixed(1) + ' ' + (PADT + ih) + ' L' + PADL + ' ' + (PADT + ih) + ' Z';

      // 当前点
      var daysPassed = (Date.now() - p.last) / 86400000;
      var curR = SRS.retention(p);
      var curX = X(Math.min(daysPassed, maxD));
      var curY = Y(curR);

      // 下次复习点
      var nextDays = p.next ? (p.next - p.last) / 86400000 : 0;
      var nextX = X(Math.min(nextDays, maxD));

      // 网格线
      var grid = '';
      [0, 0.5, 1].forEach(function (r) {
        grid += '<line x1="' + PADL + '" y1="' + Y(r).toFixed(1) + '" x2="' + (W - PADR) + '" y2="' + Y(r).toFixed(1) + '" stroke="var(--border)" stroke-width="1" stroke-dasharray="3 3"/>';
        grid += '<text x="4" y="' + (Y(r) + 3.5).toFixed(1) + '" font-size="8" fill="var(--fg-muted)">' + Math.round(r * 100) + '%</text>';
      });
      // x 轴刻度
      [0, 10, 20, 30].forEach(function (d) {
        grid += '<text x="' + (X(d) - 6).toFixed(1) + '" y="' + (H - 3) + '" font-size="8" fill="var(--fg-muted)">' + d + 'd</text>';
      });

      var st = SRS.strengthText(p);
      return '<div class="curve-box">' +
        '<h4>📈 记忆曲线（真实遗忘曲线 R=e<sup>-t/S</sup>）</h4>' +
        '<svg class="curve-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
          grid +
          '<path d="' + fill + '" fill="var(--accent)" opacity=".13"/>' +
          '<path d="' + path + '" fill="none" stroke="var(--accent-d)" stroke-width="2.2" stroke-linecap="round"/>' +
          // 当前点
          '<circle cx="' + curX.toFixed(1) + '" cy="' + curY.toFixed(1) + '" r="4" fill="' + st.color + '"/>' +
          // 下次复习线
          '<line x1="' + nextX.toFixed(1) + '" y1="' + PADT + '" x2="' + nextX.toFixed(1) + '" y2="' + (PADT + ih) + '" stroke="var(--yellow, #f2c14e)" stroke-width="1.4" stroke-dasharray="4 3" opacity=".8"/>' +
        '</svg>' +
        '<div class="curve-info">' +
          '<span>当前保持率 <b>' + Math.round(curR * 100) + '%</b></span>' +
          '<span>记忆强度 S=<b>' + (p.S || 0).toFixed(2) + ' 天</b></span>' +
          '<span>下次复习 <b>' + SRS.nextText(p) + '</b></span>' +
          '<span>状态 <b style="color:' + st.color + '">' + st.label + '</b></span>' +
        '</div>' +
      '</div>';
    },

    /* ================= 数据统计 ================= */
    renderStats: function () {
      this.current = 'stats';
      var words = Store.state.words;
      var deck = Store.state.settings.deck;
      var learned = 0, focus = 0, mastered = 0, lvlSum = 0, rSum = 0, wSum = 0;
      var dist = { fresh: 0, m01: 0, m23: 0, m4: 0, m5: 0 };
      for (var k in words) {
        var p = words[k];
        if (p.last > 0) {
          learned++; lvlSum += p.lvl;
          rSum += p.right || 0; wSum += p.wrong || 0;
          if (SRS.inFocusPool(p)) focus++;
          if (p.status === 'mastered') mastered++;
          if (p.m <= 1) dist.m01++; else if (p.m <= 3) dist.m23++; else if (p.m === 4) dist.m4++; else dist.m5++;
        }
      }
      var deckWords = Data.decks[deck] ? Data.decks[deck].length : (Data.manifest()[deck] || {}).count || 0;
      dist.fresh = Math.max(0, deckWords - learned);
      var acc = (rSum + wSum) ? Math.round(rSum / (rSum + wSum) * 100) : 0;
      var avgLvl = learned ? lvlSum / learned : 0;
      var li = Store.levelInfo();
      var g = Store.gameState();
      var achCount = Object.keys(g.achievements).length;
      $('view').innerHTML =
        '<div class="stats-wrap">' +
          '<div class="stat-cards">' +
            '<div class="stat-card"><b>' + Store.todayProgress() + '</b><span>今日学习</span></div>' +
            '<div class="stat-card"><b>' + Store.state.streak.count + ' 天</b><span>连续打卡</span></div>' +
            '<div class="stat-card"><b>' + learned + '</b><span>累计学词</span></div>' +
            '<div class="stat-card"><b>' + focus + '</b><span>重点池</span></div>' +
            '<div class="stat-card"><b>' + acc + '%</b><span>总正确率</span></div>' +
            '<div class="stat-card"><b>Lv.' + li.level + '</b><span>等级</span></div>' +
            '<div class="stat-card"><b>' + achCount + '</b><span>成就解锁</span></div>' +
            '<div class="stat-card"><b>' + Game.fmtDuration(g.studySeconds) + '</b><span>累计学习</span></div>' +
          '</div>' +
          '<div class="chart-grid">' +
            '<div class="chart-box"><h4>📈 记忆保持曲线（未来14天预测）</h4><canvas id="c-retention" height="220"></canvas></div>' +
            '<div class="chart-box"><h4>🍩 掌握度分布（当前词库）</h4><canvas id="c-pie" height="220"></canvas></div>' +
            '<div class="chart-box"><h4>📊 近14天学习量</h4><canvas id="c-bars" height="220"></canvas></div>' +
            '<div class="chart-box"><h4>🗓 连续打卡日历（近12周）</h4><div id="c-cal" class="cal-box"></div>' +
              '<div class="test-history" id="test-history"></div></div>' +
          '</div>' +
        '</div>';
      App.setNav('stats');
      Charts.retention($('c-retention'), avgLvl);
      Charts.pie($('c-pie'), dist);
      Charts.bars($('c-bars'), Store.state.daily);
      Charts.calendar($('c-cal'), Store.state.daily);
      var th = Store.state.tests.slice(-5).reverse();
      if (th.length) {
        $('test-history').innerHTML = '<h5>最近测试</h5>' + th.map(function (t) {
          var d = new Date(t.ts);
          return '<div class="th-row">' + (Data.manifest()[t.deck] ? Data.manifest()[t.deck].name : t.deck) +
            ' · ' + t.right + '/' + t.total + ' · ' + Math.round(t.right / t.total * 100) + '% · ' +
            (d.getMonth() + 1) + '/' + d.getDate() + '</div>';
        }).join('');
      }
    },

    /* ================= 设置 ================= */
    renderSettings: function () {
      this.current = 'settings';
      var s = Store.state.settings;
      var voices = TTS.voices();
      $('view').innerHTML =
        '<div class="settings-wrap">' +
          '<h2>⚙️ 设置</h2>' +
          '<div class="set-group"><h4>外观</h4>' +
            '<div class="set-row"><span>主题</span><div class="seg">' +
              '<button class="seg-btn' + (s.theme === 'light' ? ' on' : '') + '" data-theme="light">🌞 浅色</button>' +
              '<button class="seg-btn' + (s.theme === 'dark' ? ' on' : '') + '" data-theme="dark">🌙 深色</button></div></div></div>' +
          '<div class="set-group"><h4>学习</h4>' +
            '<div class="set-row"><span>每日目标（' + s.dailyGoal + ' 词）</span><input type="range" id="set-goal" min="10" max="200" step="10" value="' + s.dailyGoal + '"></div>' +
            '<div class="set-row"><span>翻卡自动发音</span><input type="checkbox" id="set-autoplay"' + (s.autoPlay ? ' checked' : '') + '></div>' +
            '<div class="set-row"><span>重新定级测试</span><button class="btn sm" id="set-replacement">开始 6 道测试题</button></div></div>' +
          '<div class="set-group"><h4>📁 学习进度存档</h4>' +
            '<div class="set-row"><span>当前环境</span><span id="set-env">' + (window.Storage ? esc(Storage.envText()) : '未知') + '</span></div>' +
            '<div class="set-row"><span>本地文件备份</span><button class="btn sm" id="set-connect">' + (Storage && Storage.fileConnected ? '重新连接' : '连接到本地文件') + '</button></div>' +
            '<div class="set-row"><span>浏览器内备份</span><span id="set-backup">检测中…</span></div>' +
            '<div class="set-row"><span>手动导出存档文件</span><button class="btn sm" id="set-export-file">导出 .json</button></div>' +
            '<div class="set-row"><span>从存档文件恢复</span><label class="btn sm file-label">选择存档<input type="file" id="set-restore" accept=".json" hidden></label></div>' +
            '<div class="set-row"><span>从浏览器备份恢复</span><button class="btn sm" id="set-restore-idb">恢复</button></div>' +
            '<div class="set-note" style="margin:2px 0 8px">💡 连上本地文件后，学习进度会<b>自动写入硬盘</b>，浏览器清缓存也不会丢。</div></div>' +
          '<div class="set-group"><h4>发音</h4>' +
            '<div class="set-row"><span>语速（' + s.ttsRate + 'x）</span><input type="range" id="set-rate" min="0.5" max="2" step="0.1" value="' + s.ttsRate + '"></div>' +
            '<div class="set-row"><span>语音</span><select id="set-voice" class="input"><option value="">自动选择</option>' +
              voices.map(function (v) { return '<option value="' + esc(v.name) + '"' + (v.name === s.ttsVoice ? ' selected' : '') + '>' + esc(v.name) + '</option>'; }).join('') + '</select></div>' +
            '<div class="set-row"><span>音效</span><input type="checkbox" id="set-fx"' + (s.soundFx ? ' checked' : '') + '></div></div>' +
          '<div class="set-group"><h4>账户</h4>' +
            '<div class="set-row"><span>切换用户</span><button class="btn sm" id="set-switch">切换 / 新建</button></div>' +
            '<div class="set-row"><span>当前用户</span><span id="set-cur-user">' + esc((Store.activeUser() || {}).name || '') + '</span></div></div>' +
          '<div class="set-group"><h4>数据</h4>' +
            '<div class="set-row"><span>导入词库（CSV: word,phonetic,translation）</span><label class="btn sm file-label">选择文件<input type="file" id="set-csv" accept=".csv" hidden></label></div>' +
            '<div class="set-row"><span>导出学习进度（JSON 备份）</span><button class="btn sm" id="set-export">导出</button></div>' +
            '<div class="set-row"><span>导入学习进度</span><label class="btn sm file-label">选择备份<input type="file" id="set-import" accept=".json" hidden></label></div>' +
            '<div class="set-row danger-row"><span>清空全部数据（不可恢复）</span><button class="btn sm danger" id="set-reset">重置</button></div></div>' +
          '<p class="set-note">所有数据仅保存在本机浏览器 localStorage 中，无需登录，离线可用。</p>' +
        '</div>';
      App.setNav('settings');
      document.querySelectorAll('.seg-btn').forEach(function (b) {
        b.onclick = function () {
          Store.state.settings.theme = b.dataset.theme; Store.save();
          App.applyTheme(); Views.renderSettings();
        };
      });
      $('set-goal').oninput = function () {
        Store.state.settings.dailyGoal = +this.value; Store.save();
        this.previousElementSibling.textContent = '每日目标（' + this.value + ' 词）';
        App.updateProgressPill();
      };
      $('set-rate').oninput = function () {
        Store.state.settings.ttsRate = +this.value; Store.save();
        this.previousElementSibling.textContent = '语速（' + this.value + 'x）';
      };
      $('set-autoplay').onchange = function () { Store.state.settings.autoPlay = this.checked; Store.save(); };
      $('set-fx').onchange = function () { Store.state.settings.soundFx = this.checked; Store.save(); };
      $('set-voice').onchange = function () { Store.state.settings.ttsVoice = this.value; Store.save(); };
      $('set-replacement').onclick = function () { Views.showOnboarding(true); };
      $('set-switch').onclick = function () { App.showUserGate(true); };

      /* ---- 存档管理 ---- */
      if (window.Storage) {
        Storage.hasBackup().then(function (has) {
          var el = $('set-backup');
          if (el) el.textContent = has ? '✅ 有备份' : '暂无';
        });
        $('set-connect').onclick = function () {
          var btn = this;
          btn.disabled = true;
          btn.textContent = '选择文件中…';
          Storage.connectFile().then(function (r) {
            btn.disabled = false;
            if (r.aborted) { btn.textContent = '连接到本地文件'; return; }
            if (!r.ok) {
              btn.textContent = '连接到本地文件';
              App.toast('无法连接文件：' + (r.error || '未知错误'));
              return;
            }
            App.toast('已连接：' + r.name + '，进度会自动保存 💾');
            Views.renderSettings();
          }).catch(function () {
            btn.disabled = false;
            btn.textContent = '连接到本地文件';
          });
        };
        $('set-export-file').onclick = function () {
          Storage.exportFile().then(function (r) {
            if (r.ok) App.toast('已导出：' + r.name + ' 📦');
          });
        };
        $('set-restore').onchange = function () {
          var f = this.files[0]; if (!f) return;
          Storage.importFile(f).then(function (r) {
            if (r.ok) {
              App.applyTheme(); App.updateProgressPill();
              App.toast('存档已恢复 ✅');
              Views.renderSettings();
            } else {
              App.toast('恢复失败：' + (r.error || '未知错误'));
            }
          });
        };
        $('set-restore-idb').onclick = function () {
          Storage.restoreFromBackup().then(function (r) {
            if (r.ok) {
              App.applyTheme(); App.updateProgressPill();
              App.toast('已从浏览器备份恢复 ✅');
              Views.renderSettings();
            } else {
              App.toast('没有找到可用的浏览器备份');
            }
          });
        };
      }
      $('set-csv').onchange = function () {
        var f = this.files[0]; if (!f) return;
        var rd = new FileReader();
        rd.onload = function () { alert('成功导入 ' + Data.importCSV(String(rd.result)) + ' 个单词到「自定义词库」'); };
        rd.readAsText(f, 'utf-8');
      };
      $('set-export').onclick = function () {
        var blob = new Blob([Store.exportJSON()], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'wordgarden-backup-' + Store.todayKey() + '.json';
        a.click();
      };
      $('set-import').onchange = function () {
        var f = this.files[0]; if (!f) return;
        var rd = new FileReader();
        rd.onload = function () {
          try { Store.importJSON(String(rd.result)); alert('进度导入成功'); App.applyTheme(); App.updateProgressPill(); }
          catch (e) { alert('导入失败：' + e.message); }
        };
        rd.readAsText(f, 'utf-8');
      };
      $('set-reset').onclick = function () {
        if (!confirm('⚠️ 将清空全部学习数据（进度/花园/统计/设置），且不可恢复。确定继续？')) return;
        if (!confirm('再次确认：真的要清空所有数据吗？')) return;
        Store.reset(); location.reload();
      };
    },

    /* ================= 新手定级 ================= */
    /* 定级题库见 data/placement_bank.js（window.PLACEMENT_BANK）
     * 题型：英文单词 → 选中文词义。干扰项均为同语义域的真实课本词，
     * 必须真的懂词义才能选对，凑词形/猜长度无效。
     */

    /* 构造定级题：读取精写定级题库，并校验每个词确实存在于对应词库 */
    buildPlacement: function () {
      var self = this;
      var bank = window.PLACEMENT_BANK || [];
      var need = bank.map(function (g) { return g.deck; });
      var uniq = need.filter(function (d, i) { return need.indexOf(d) === i; });
      return Promise.all(uniq.map(function (d) {
        return Bank.load(d).then(function () { return d; });
      })).then(function () {
        var out = [];
        bank.forEach(function (g) {
          var bk = Bank.decks[g.deck];
          if (!bk) return;
          var byWord = {};
          bk.words.forEach(function (w) { byWord[w.word] = w; });
          var entry = byWord[g.word];
          if (!entry) return;            // 词库里没有就跳过，绝不静默换词
          out.push({
            w: g.word,
            phonetic: entry.phonetic || g.phonetic,
            pos: entry.pos || g.pos,
            a: g.answer,
            opts: g.options.slice(),
            deck: g.deck,
            unit: g.unit,
            level: g.level
          });
        });
        return out;
      });
    },

    showOnboarding: function (isRedo) {
      var self = this;
      var qi = 0, score = 0;
      var QUESTIONS = [];
      var results = [];       // 逐题作答记录，用于结算页回顾
      var ready = false;
      var mask = null;        // 弹窗遮罩（finish 也要用）

      function renderQ() {
        if (!mask) {
          mask = $('modal-mask');
        }
        if (!mask) {
          document.body.insertAdjacentHTML('beforeend', '<div class="modal-mask" id="modal-mask"><div class="modal onboarding"></div></div>');
          mask = $('modal-mask');
        }
        if (!ready) {
          var box0 = mask.querySelector('.modal');
          box0.innerHTML = '<h3>🌱 定级小测试</h3><p class="ob-sub">正在准备题目…</p>';
          self.buildPlacement().then(function (qs) {
            QUESTIONS = qs;
            ready = true;
            renderQ();
          });
          return;
        }
        if (qi >= QUESTIONS.length) { finish(); return; }
        var q = QUESTIONS[qi];
        var opts = q.opts.slice().sort(function () { return Math.random() - 0.5; });
        var box = mask.querySelector('.modal');
        box.innerHTML =
          '<h3>🌱 水平定级（' + (qi + 1) + ' / ' + QUESTIONS.length + '）</h3>' +
          '<div class="pl-word">' + esc(q.w) + '</div>' +
          '<div class="pl-phon">/' + esc(q.phonetic || '') + '/ <span class="pl-pos">' + esc(q.pos || '') + '</span></div>' +
          '<p class="ob-sub">这个单词是什么意思？</p>' +
          '<div class="options">' + opts.map(function (o, i) {
            return '<button class="option ob-opt" data-v="' + esc(o) + '"><em>' + (i + 1) + '</em>' + esc(o) + '</button>';
          }).join('') + '</div>' +
          '<p class="ob-tip">💡 按 1-4 键也可以作答，不确定就选最接近的</p>';
        box.querySelectorAll('.ob-opt').forEach(function (b) {
          b.onclick = function () {
            var ok = (b.dataset.v === q.a);
            results.push({ q: q, ok: ok });
            if (ok) { score++; TTS.beep('correct'); } else TTS.beep('wrong');
            qi++; renderQ();
          };
        });
        // 数字键 1-4 快速作答
        if (box._keyHandler) document.removeEventListener('keydown', box._keyHandler);
        box._keyHandler = function (e) {
          if (qi >= QUESTIONS.length) return;
          var n = parseInt(e.key, 10);
          if (n >= 1 && n <= 4) {
            var btn = box.querySelectorAll('.ob-opt')[n - 1];
            if (btn) btn.click();
          }
        };
        document.addEventListener('keydown', box._keyHandler);
      }
      function finish() {
        var box = mask.querySelector('.modal');
        if (box._keyHandler) document.removeEventListener('keydown', box._keyHandler);
        var total = QUESTIONS.length || 6;
        // 定级逻辑（修复"蒙对最难一题就跳高级"的 bug）：
        // 不看"答对的最高难度题"，而看「连续答对到哪里」——从第1题开始连续答对的数量，
        // 才是真实水平的稳定反映。蒙对一题难题、前面基础题都错，不能说明水平高。
        var streak = 0;
        for (var i = 0; i < results.length; i++) {
          if (results[i].ok) streak++;
          else break;              // 一旦答错，连续中断
        }
        // 连续答对到第 N 题 → 水平 ≈ 第 N 题的难度
        var maxLv = streak;
        // 推荐词库：按连续答对层级映射（streak 越大起点越高）
        var DECK_BY_LV = { 0: 'qishang', 1: 'qishang', 2: 'qixia', 3: 'qixia', 4: 'bashang', 5: 'baxia', 6: 'jiushang' };
        var recDeck = DECK_BY_LV[maxLv] || 'qishang';
        var level = Math.max(1, Math.min(6, maxLv || 1));
        Store.state.user.startLevel = level;
        Store.state.onboarded = true;
        if (!isRedo) Store.state.settings.deck = recDeck;
        // 解锁：最高层级对应的课时数（前 N 课时开放）
        var targetDeck = Store.state.settings.deck;
        var unlockN = Math.max(1, Math.min(level, 4));
        Store.unlockUnit(targetDeck, unlockN);
        Store.save();
        var recName = (Data.manifest()[recDeck] || {}).name || recDeck;
        var msg = score === total ? '全对！你的起点直接拉满 🚀'
          : score >= total * 0.67 ? '基础很扎实，起点定在 ' + esc(recName) + ' 💪'
          : score >= total * 0.34 ? '底子还行，从 ' + esc(recName) + ' 稳扎稳打 🌱'
          : '别急，先从 ' + esc(recName) + ' 把基础打牢 🌿';
        // 逐题回顾
        var detail = '<div class="pl-review">' + results.map(function (r) {
          return '<div class="pl-row ' + (r.ok ? 'ok' : 'no') + '">' +
            '<span class="pl-ico">' + (r.ok ? '✓' : '✗') + '</span>' +
            '<span class="pl-w">' + esc(r.q.w) + '</span>' +
            '<span class="pl-a">' + esc(r.q.a) + '</span>' +
            '<span class="pl-lv">' + esc(r.q.unit || '') + '</span>' +
            '</div>';
        }).join('') + '</div>';
        box.innerHTML =
          '<h3>🎉 定级完成</h3>' +
          '<p class="ob-sub">答对 <b>' + score + ' / ' + total + '</b> · ' + msg + '</p>' +
          '<p class="ob-sub">推荐从 <b>' + esc(recName) + '</b> 开始，已为你开放前 ' + unlockN + ' 个课时</p>' +
          detail +
          '<button class="btn primary lg" id="ob-done">进入我的单词花园</button>';
        $('ob-done').onclick = function () { mask.remove(); Views.renderHome(); App.updateProgressPill(); };
      }
      renderQ();
    }
  };

  window.Views = Views;
})();
