/* app.js — 路由 / 主题 / 快捷键 / 用户管理 / 启动引导 */
(function () {
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var App = {
    go: function (view) {
      clearInterval(Test.timer);
      if (window.Lesson) { Lesson.active = false; Lesson.exitMode(); }
      if (view === 'home') Views.renderHome();
      else if (view === 'mistakes') Views.renderMistakes();
      else if (view === 'manage') Views.renderManage();
      else if (view === 'stats') Views.renderStats();
      else if (view === 'settings') Views.renderSettings();
      if (view !== 'home') {
        var bar = document.getElementById('actionbar');
        if (bar) bar.classList.add('hidden');
      }
      App.setNav(view);
    },

    goHome: function () { this.go('home'); },

    setNav: function (name) {
      document.querySelectorAll('.nav-btn').forEach(function (b) {
        b.classList.toggle('on', b.dataset.view === name);
      });
      document.querySelectorAll('.tab-btn').forEach(function (b) {
        b.classList.toggle('on', b.dataset.view === name);
      });
    },

    applyTheme: function () {
      if (!Store.state) return;
      document.documentElement.dataset.theme = Store.state.settings.theme;
    },

    /* 更新顶部用户头像/进度 */
    updateUserPill: function () {
      var u = Store.activeUser();
      var el = $('user-pill');
      if (!el) return;
      if (u) {
        el.style.display = 'flex';
        el.innerHTML = '<span class="ua" style="--u-color:' + u.color + '">' + u.avatar + '</span><span class="un">' + u.name + '</span>';
        el.onclick = function () { App.showUserGate(true); };
      } else {
        el.style.display = 'none';
      }
    },

    updateProgressPill: function () {
      if (!Store.state) return;
      var done = Store.todayProgress();
      var goal = Store.state.settings.dailyGoal;
      $('today-pill').innerHTML = '🌿 今日 <b>' + done + '</b> / ' + goal;
      $('today-fill').style.width = Math.min(100, done / goal * 100) + '%';
      var st = $('streak-pill');
      if (st) st.textContent = '🔥 ' + Store.state.streak.count + ' 天';
    },

    bindKeys: function () {
      document.addEventListener('keydown', function (e) {
        // 输入框聚焦时跳过
        var tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        // 课程（多邻国式）优先处理
        if (window.Lesson && Lesson.active) {
          if (Lesson.onKey(e)) e.preventDefault();
          return;
        }
        if (e.key === ' ') {
          if (Study.mode === 'cards' && Study.queue.length) { e.preventDefault(); Study.flip(); }
          return;
        }
        if (e.key === 'p' || e.key === 'P') {
          var rec = Study.current && Study.current();
          if (rec) TTS.speak(rec.w);
          return;
        }
        if (Study.onKey(e)) { e.preventDefault(); return; }
        // 测验/定级选项 1-4
        if (/^[1-4]$/.test(e.key)) {
          var opts = document.querySelectorAll('#study-area .option:not([disabled])');
          var i = +e.key - 1;
          if (opts[i]) opts[i].click();
        }
      });
    },

    toast: function (msg) {
      var t = document.getElementById('app-toast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'app-toast';
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(this._toastT);
      this._toastT = setTimeout(function () { t.classList.remove('show'); }, 2200);
    },

    /* ---------- 用户选择 / 新建界面 ---------- */
    showUserGate: function (isSwitch) {
      var self = this;
      var users = Store.listUsers();
      var html =
        '<div class="modal-mask" id="user-gate-mask"><div class="modal">' +
          '<h3>' + (isSwitch ? '👥 切换用户' : '👋 欢迎来到单词花园') + '</h3>' +
          (isSwitch ? '<p class="ob-sub">选择要进入花园的同学</p>' : '<p class="ob-sub">选择你的账户，或创建一个新同学开始学习</p>') +
          '<div class="user-list">';
      users.forEach(function (u) {
        html += '<div class="user-card" data-id="' + u.id + '" style="--u-color:' + u.color + '">' +
          '<span class="user-avatar">' + u.avatar + '</span>' +
          '<div class="user-info"><b>' + esc(u.name) + '</b><span>已学 ' + u.learned + ' 词 · 掌握 ' + u.mastered + ' 词</span></div>' +
          '<div class="user-meta"><span class="u-xp">' + u.xp + ' XP</span><span class="u-streak">🔥 ' + u.streak + ' 天</span></div>' +
          '<button class="u-del" data-del="' + u.id + '" title="删除该用户">🗑</button>' +
        '</div>';
      });
      html += '<div class="user-card add-user-card" id="add-user">＋ 新建同学</div>';
      html += '</div>' + (isSwitch ? '<button class="btn ghost" id="gate-close">取消</button>' : '') + '</div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
      $('user-gate-mask').onclick = function (e) { if (e.target.id === 'user-gate-mask') e.target.remove(); };
      var close = $('gate-close');
      if (close) close.onclick = function () { $('user-gate-mask').remove(); };
      // 点击用户进入
      document.querySelectorAll('.user-card[data-id]').forEach(function (c) {
        c.onclick = function (e) {
          if (e.target.dataset.del) return;
          Store.switchUser(c.dataset.id);
          $('user-gate-mask').remove();
          self.enterApp();
        };
      });
      // 删除用户
      document.querySelectorAll('.u-del').forEach(function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          var id = b.dataset.del;
          var name = (Store.listUsers().filter(function (u) { return u.id === id; })[0] || {}).name || '';
          if (!confirm('确定删除用户「' + name + '」？其全部学习数据将被清除，且不可恢复。')) return;
          Store.deleteUser(id);
          $('user-gate-mask').remove();
          self.showUserGate(isSwitch);
        };
      });
      // 新建用户
      $('add-user').onclick = function () {
        $('user-gate-mask').remove();
        self.showCreateUser();
      };
    },

    showCreateUser: function () {
      var self = this;
      var name = '', avatar = '🌱', color = '#7fb069';
      var emojis = ['🌱', '🌿', '🌸', '🌻', '🍀', '🌷', '🍃', '🌳'];
      var colors = ['#7fb069', '#5aa9e6', '#f2c14e', '#ef8354', '#b388eb', '#48c9b0', '#f778ba', '#e4572e'];
      var html =
        '<div class="modal-mask" id="create-mask"><div class="modal">' +
          '<h3>✨ 创建新同学</h3>' +
          '<div class="set-row"><span>名字</span><input id="new-name" class="input" placeholder="输入昵称" value=""></div>' +
          '<div class="set-row" style="flex-direction:column;align-items:flex-start"><span>选择头像</span>' +
            '<div class="avatar-picker">' + emojis.map(function (e) { return '<button class="avatar-opt" data-av="' + e + '">' + e + '</button>'; }).join('') + '</div></div>' +
          '<div class="set-row" style="flex-direction:column;align-items:flex-start"><span>选择颜色</span>' +
            '<div class="color-picker">' + colors.map(function (c) { return '<button class="color-opt" data-c="' + c + '" style="background:' + c + '"></button>'; }).join('') + '</div></div>' +
          '<div class="empty-actions"><button class="btn ghost" id="create-cancel">取消</button><button class="btn primary lg" id="create-ok">开始学习 🌱</button></div>' +
        '</div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
      // 默认选中第一个
      document.querySelector('.avatar-opt').classList.add('on');
      document.querySelector('.color-opt').classList.add('on');
      $('create-mask').onclick = function (e) { if (e.target.id === 'create-mask') e.target.remove(); };
      $('create-cancel').onclick = function () { $('create-mask').remove(); self.showUserGate(false); };
      $('new-name').oninput = function () { name = this.value.trim(); };
      document.querySelectorAll('.avatar-opt').forEach(function (b) {
        b.onclick = function () {
          document.querySelectorAll('.avatar-opt').forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on'); avatar = b.dataset.av;
        };
      });
      document.querySelectorAll('.color-opt').forEach(function (b) {
        b.onclick = function () {
          document.querySelectorAll('.color-opt').forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on'); color = b.dataset.c;
        };
      });
      $('create-ok').onclick = function () {
        var n = name || '新同学';
        Store.createUser(n, avatar, color);
        $('create-mask').remove();
        self.enterApp();
      };
    },

    /* 进入主应用（用户已确定） */
    enterApp: function () {
      this.applyTheme();
      this.updateUserPill();
      this.updateProgressPill();
      // 预载默认词库精写题库
      Bank.load(Store.state.settings.deck).catch(function () {});
      // 新手定级
      if (!Store.state.onboarded) Views.showOnboarding(false);
      Views.renderHome();
    },

    boot: function () {
      Store.load();
      this.applyTheme();
      this.updateProgressPill();
      // 存储层初始化（PC/手机自动识别 + 本地文件支持）
      if (window.Storage) Storage.init();
      // 顶部导航
      document.querySelectorAll('.nav-btn').forEach(function (b) {
        b.onclick = function () { App.go(b.dataset.view); };
      });
      // 底部 Tab 导航（移动端）
      document.querySelectorAll('.tab-btn').forEach(function (b) {
        b.onclick = function () { App.go(b.dataset.view); };
      });
      // 底部操作栏
      $('act-know').onclick = function () { Study.judge('know'); };
      $('act-vague').onclick = function () { Study.judge('vague'); };
      $('act-unknown').onclick = function () { Study.judge('unknown'); };
      $('act-fav').onclick = function () { Study.toggleFav(); };
      $('act-nb').onclick = function () { Study.toggleNotebook(); };
      $('act-prev').onclick = function () { Study.prev(); };
      $('act-next').onclick = function () { Study.next(); };
      this.bindKeys();
      this.updateUserPill();
      // 判断是否已有用户
      if (!Store.activeUser()) {
        this.showUserGate(false);
        return;
      }
      this.enterApp();
    }
  };

  window.App = App;
  document.addEventListener('DOMContentLoaded', function () { App.boot(); });
})();
