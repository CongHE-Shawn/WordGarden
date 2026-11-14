/* store.js — localStorage 持久化状态管理（v2 多用户）
 * 结构：
 *   wordgarden.v2 = {
 *     users: [ {id, name, avatar, color, joined, profile} , ... ],
 *     activeId: <id>
 *   }
 *   每个用户的完整状态存于 wordgarden.user.<id>（与"存档数据另存"一致，互不影响）
 * 这样一台设备多个用户各自独立进度，可切换、新建、删除、重命名。
 */
(function () {
  var META_KEY = 'wordgarden.v2';
  var USER_PREFIX = 'wordgarden.user.';

  function uid() { return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function defaults() {
    return {
      v: 2,
      onboarded: false,
      settings: {
        theme: 'light',        // light | dark
        dailyGoal: 50,
        deck: 'qishang',
        ttsRate: 1,
        ttsVoice: '',          // 语音名称，空=自动
        soundFx: true,
        autoPlay: true         // 翻卡自动发音
      },
      user: { startLevel: 1, joined: Date.now() },
      /* words: { 'deck|word': {m,lvl,s,streak,next,last,right,wrong,fav,nb,status} } */
      words: {},
      /* 错题本：{ 'deck|word': {deck, word, wrong, lastWrong, picked, pickedTimes, history:[], note} } */
      mistakes: {},
      daily: {},               // 'YYYY-MM-DD': {learned,reviewed,right,wrong}
      tests: [],               // 历史测试 {ts,deck,total,right,sec}
      streak: { count: 0, lastDay: '' },
      garden: { xp: 0 },
      /* 游戏化：等级、成就、每日任务、学习时长 */
      game: {
        level: 1,            // 用户等级（由总经验推算）
        achievements: {},    // achId -> {unlocked: ts}
        missions: { date: '', tasks: {} },  // 每日任务 {date, tasks:{taskId: count}}
        studySeconds: 0,     // 累计学习时长（秒）
        lastStudyTs: 0       // 上次学习时间戳（用于累计时长）
      },
      /* units: { deckId: { unlocked: N, done: {unitIdx: 次数} } } */
      units: {}
    };
  }

  /* 头像配色池 */
  var AVATAR_COLORS = ['#7fb069', '#5aa9e6', '#f2c14e', '#ef8354', '#b388eb', '#48c9b0', '#f778ba', '#e4572e'];
  var AVATAR_EMOJIS = ['🌱', '🌿', '🌸', '🌻', '🍀', '🌷', '🍃', '🌳'];

  var Store = {
    state: null,
    activeId: null,

    /* ---------- 用户元数据管理 ---------- */
    _meta: function () {
      var m = null;
      try { m = JSON.parse(localStorage.getItem(META_KEY)); } catch (e) {}
      if (!m || !m.users || !m.users.length) m = null;
      return m;
    },
    _saveMeta: function (m) { localStorage.setItem(META_KEY, JSON.stringify(m)); },

    /* 读取当前激活用户 */
    activeUser: function () {
      var m = this._meta();
      return m ? m.users.filter(function (u) { return u.id === m.activeId; })[0] || m.users[0] : null;
    },

    /* 列出所有用户（含简要统计，用于启动选人界面） */
    listUsers: function () {
      var m = this._meta();
      if (!m) return [];
      var self = this;
      return m.users.map(function (u) {
        var st = self._loadUser(u.id);
        var learned = 0, mastered = 0;
        for (var k in st.words) {
          if (st.words[k].last > 0) learned++;
          if (st.words[k].status === 'mastered') mastered++;
        }
        return {
          id: u.id, name: u.name, avatar: u.avatar, color: u.color,
          joined: u.joined, learned: learned, mastered: mastered,
          xp: st.garden.xp || 0, streak: (st.streak || {}).count || 0
        };
      });
    },

    /* 创建用户，返回用户对象 */
    createUser: function (name, avatar, color) {
      var m = this._meta() || { users: [], activeId: null };
      var u = {
        id: uid(), name: name || '新同学',
        avatar: avatar || AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)],
        color: color || AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        joined: Date.now()
      };
      m.users.push(u);
      m.activeId = u.id;
      this._saveMeta(m);
      // 初始化该用户状态
      var st = defaults();
      st.user.joined = Date.now();
      localStorage.setItem(USER_PREFIX + u.id, JSON.stringify(st));
      this.activeId = u.id;
      this.state = st;
      return u;
    },

    /* 切换激活用户 */
    switchUser: function (id) {
      var m = this._meta();
      if (!m) return null;
      var exists = m.users.some(function (u) { return u.id === id; });
      if (!exists) return null;
      m.activeId = id;
      this._saveMeta(m);
      this.activeId = id;
      this.state = this._loadUser(id);
      return this.activeUser();
    },

    /* 重命名用户 */
    renameUser: function (id, name) {
      var m = this._meta(); if (!m) return;
      m.users.forEach(function (u) { if (u.id === id) u.name = name; });
      this._saveMeta(m);
    },

    /* 删除用户（保留 localStorage 由浏览器管理，删除其数据） */
    deleteUser: function (id) {
      var m = this._meta(); if (!m) return;
      m.users = m.users.filter(function (u) { return u.id !== id; });
      if (m.activeId === id) m.activeId = m.users.length ? m.users[0].id : null;
      this._saveMeta(m);
      localStorage.removeItem(USER_PREFIX + id);
      if (m.users.length) { this.switchUser(m.activeId); }
      else { this.activeId = null; this.state = null; }
    },

    _loadUser: function (id) {
      var raw = null;
      try { raw = JSON.parse(localStorage.getItem(USER_PREFIX + id)); } catch (e) {}
      if (!raw) raw = defaults();
      var d = defaults();
      for (var k in d) if (!(k in raw)) raw[k] = d[k];
      for (var k2 in d.settings) if (!(k2 in raw.settings)) raw.settings[k2] = d.settings[k2];
      return raw;
    },

    /* ---------- 状态加载（应用启动时调用） ---------- */
    load: function () {
      var m = this._meta();
      if (!m) {
        // 迁移：旧版 wordgarden.v1 若存在，迁移到新结构
        var old = null;
        try { old = JSON.parse(localStorage.getItem('wordgarden.v1')); } catch (e) {}
        if (old && old.settings) {
          var u = this.createUser('我的花园', '🌱', '#7fb069');
          localStorage.setItem(USER_PREFIX + u.id, JSON.stringify(old));
          this.state = old;
          return this.state;
        }
        // 无任何数据：不自动创建，等待用户选择界面
        this.state = null;
        this.activeId = null;
        return null;
      }
      this.activeId = m.activeId;
      this.state = this._loadUser(m.activeId);
      return this.state;
    },

    save: function () {
      if (!this.activeId) return;
      try { localStorage.setItem(USER_PREFIX + this.activeId, JSON.stringify(this.state)); } catch (e) {}
      // 异步同步到 IndexedDB / 本地文件（防止浏览器清数据后丢失）
      if (window.Storage) { try { Storage.sync(); } catch (e) {} }
    },

    todayKey: function (offset) {
      var d = new Date();
      if (offset) d = new Date(d.getTime() + offset * 86400000);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },

    key: function (deck, word) { return deck + '|' + word; },

    /* 取词条进度（无则创建默认，不落库直到被修改） */
    getWord: function (deck, word) {
      var k = this.key(deck, word);
      if (!this.state.words[k]) {
        this.state.words[k] = { m: 0, lvl: 0, s: 0, streak: 0, next: 0, last: 0, right: 0, wrong: 0, fav: false, nb: false, status: 'new' };
      }
      return this.state.words[k];
    },

    peekWord: function (deck, word) {
      return this.state.words[this.key(deck, word)] || null;
    },

    /* ---------- 错题本 ---------- */
    mistakesMap: function () {
      if (!this.state.mistakes) this.state.mistakes = {};
      return this.state.mistakes;
    },

    /* 记录一次答错 → 自动写入错题本 */
    addMistake: function (deck, word, opts) {
      opts = opts || {};
      var map = this.mistakesMap();
      var k = this.key(deck, word);
      var it = map[k];
      if (!it) {
        it = map[k] = { deck: deck, word: word, wrong: 0, picked: 0, pickedTimes: 0, history: [], note: '' };
      }
      it.wrong = (it.wrong || 0) + 1;
      it.lastWrong = Date.now();
      it.lastType = opts.type || '';           // 记错在哪种题型上
      it.lastPicked = opts.picked || '';       // 记选了哪个错误选项
      it.history = it.history || [];
      it.history.push({ ts: Date.now(), type: opts.type || '', picked: opts.picked || '' });
      if (it.history.length > 20) it.history = it.history.slice(-20);
      return it;
    },

    /* 从错题本移除（连续答对 2 次后自动移除也走这里） */
    removeMistake: function (deck, word) {
      var map = this.mistakesMap();
      delete map[this.key(deck, word)];
    },

    /* 错题本列表（按错误次数 / 最近出错时间排序） */
    mistakeList: function (deck) {
      var map = this.mistakesMap();
      var out = [];
      for (var k in map) {
        var it = map[k];
        if (deck && it.deck !== deck) continue;
        out.push(it);
      }
      out.sort(function (a, b) {
        if ((b.wrong || 0) !== (a.wrong || 0)) return (b.wrong || 0) - (a.wrong || 0);
        return (b.lastWrong || 0) - (a.lastWrong || 0);
      });
      return out;
    },

    mistakeCount: function (deck) {
      return this.mistakeList(deck).length;
    },

    /* 标记错题已重做（连续答对时用来计数与自动移除） */
    markMistakeResolved: function (deck, word) {
      var map = this.mistakesMap();
      var it = map[this.key(deck, word)];
      if (!it) return;
      it.picked = (it.picked || 0) + 1;
      it.pickedTimes = (it.pickedTimes || 0) + 1;
      if (it.pickedTimes >= 2) this.removeMistake(deck, word);
    },

    /* 记录一次答题，并更新每日统计与连续打卡 */
    record: function (deck, word, isRight, isNew, opts) {
      opts = opts || {};
      var t = this.todayKey();
      var d = this.state.daily[t] || (this.state.daily[t] = { learned: 0, reviewed: 0, right: 0, wrong: 0 });
      if (isNew) d.learned++; else d.reviewed++;
      if (isRight) d.right++; else d.wrong++;
      // 连续打卡
      if (this.state.streak.lastDay !== t) {
        var yesterday = this.todayKey(-1);
        this.state.streak.count = (this.state.streak.lastDay === yesterday) ? this.state.streak.count + 1 : 1;
        this.state.streak.lastDay = t;
      }
      if (isNew) this.state.garden.xp += 10; else this.state.garden.xp += 3;
      // 错题本联动
      if (!isRight) {
        this.addMistake(deck, word, opts);
      } else if (this.mistakesMap()[this.key(deck, word)]) {
        this.markMistakeResolved(deck, word);
      }
      this.save();
    },

    todayProgress: function () {
      var d = this.state.daily[this.todayKey()];
      return d ? d.learned + d.reviewed : 0;
    },

    /* ---------- 游戏化：等级 / 成就 / 每日任务 ---------- */
    gameState: function () {
      if (!this.state.game) this.state.game = { level: 1, achievements: {}, missions: { date: '', tasks: {} }, studySeconds: 0, lastStudyTs: 0 };
      return this.state.game;
    },

    totalXp: function () {
      return this.state.garden.xp || 0;
    },

    /* 等级：经验每级递增（lv N 需要 lvSum 经验） */
    levelFromXp: function (xp) {
      var lv = 1, need = 50, acc = 0;
      while (acc + need <= xp) { acc += need; lv++; need += 30; }
      return lv;
    },
    levelInfo: function () {
      var xp = this.totalXp();
      var lv = this.levelFromXp(xp);
      var need = 50, acc = 0, prevAcc = 0;
      for (var i = 1; i < lv; i++) { acc += need; need += 30; }
      prevAcc = acc;
      var curNeed = need;
      return { level: lv, xp: xp, intoLevel: xp - prevAcc, needForNext: curNeed };
    },

    /* 成就定义 */
    ACHIEVEMENTS: {
      first_word:  { name: '破土而出',  desc: '学完第 1 个单词',  ico: '🌱' },
      ten_words:   { name: '茁壮成长',  desc: '累计学习 10 个词',  ico: '🌿' },
      fifty_words: { name: '枝繁叶茂',  desc: '累计学习 50 个词',  ico: '🌳' },
      hundred:     { name: '百词斩',    desc: '累计学习 100 个词', ico: '🏅' },
      five_hundred:{ name: '单词达人',  desc: '累计学习 500 个词', ico: '👑' },
      first_unit:  { name: '初试锋芒',  desc: '完成第 1 个单元',   ico: '🎖' },
      ten_units:   { name: '过关斩将',  desc: '完成 10 个单元',    ico: '⚔️' },
      combo_5:     { name: '连击达人',  desc: '答题连击 5 次',     ico: '🔥' },
      combo_10:    { name: '行云流水',  desc: '答题连击 10 次',    ico: '⚡' },
      streak_3:    { name: '三日之约',  desc: '连续打卡 3 天',     ico: '📅' },
      streak_7:    { name: '七日坚持',  desc: '连续打卡 7 天',     ico: '🏆' },
      perfect_unit:{ name: '完美通关',  desc: '一个单元 100% 正确', ico: '💯' },
      master_20:   { name: '融会贯通',  desc: '掌握 20 个单词',    ico: '🌸' },
      night_owl:   { name: '夜猫子',    desc: '晚间学习一次',      ico: '🦉' },
      early_bird:  { name: '早起的鸟',  desc: '清晨学习一次',      ico: '🐦' }
    },

    unlockAchievement: function (id) {
      var g = this.gameState();
      if (!g.achievements[id]) {
        g.achievements[id] = { unlocked: Date.now() };
        this.save();
        return true; // 新解锁
      }
      return false;
    },

    /* 每日任务定义与检查 */
    MISSIONS: {
      learn10:   { name: '学习 10 个词', ico: '📖', target: 10, kind: 'learn' },
      learn30:   { name: '学习 30 个词', ico: '🔥', target: 30, kind: 'learn' },
      one_unit:  { name: '完成 1 个单元', ico: '🗺️', target: 1, kind: 'unit' }
    },
    missionProgress: function () {
      var g = this.gameState();
      var t = this.todayKey();
      if (g.missions.date !== t) { g.missions = { date: t, tasks: {} }; this.save(); }
      var today = this.state.daily[t] || { learned: 0, reviewed: 0 };
      var doneUnits = this.totalUnitsDone();
      return {
        learn: today.learned + today.reviewed,
        units: doneUnits,
        tasks: g.missions.tasks || {}
      };
    },

    /* 累计学习时长：进入/离开学习时调用 */
    addStudyTime: function (seconds) {
      var g = this.gameState();
      g.studySeconds = (g.studySeconds || 0) + seconds;
      this.save();
    },

    /* 所有已学词数（跨库） */
    totalLearnedWords: function () {
      var n = 0;
      for (var k in this.state.words) if (this.state.words[k].last > 0) n++;
      return n;
    },

    /* 掌握词数 */
    totalMasteredWords: function () {
      var n = 0;
      for (var k in this.state.words) if (this.state.words[k].status === 'mastered') n++;
      return n;
    },

    /* 完成单元总数 */
    totalUnitsDone: function () {
      var n = 0;
      for (var d in this.state.units) {
        var u = this.state.units[d];
        for (var i in u.done) if (u.done[i] > 0) n++;
      }
      return n;
    },

    /* ---------- 学习路径（单元）状态 ---------- */
    unitState: function (deck) {
      if (!this.state) this.load();
      if (!this.state.units) this.state.units = {};
      if (!this.state.units[deck]) this.state.units[deck] = { unlocked: 1, done: {} };
      return this.state.units[deck];
    },

    unlockUnit: function (deck, n) {
      var u = this.unitState(deck);
      u.unlocked = Math.max(u.unlocked, n);
      this.save();
    },

    completeUnit: function (deck, idx) {
      if (idx < 0) { this.save(); return; } // 自定义课程（错词/生词本）不解锁单元
      var u = this.unitState(deck);
      u.done[idx] = (u.done[idx] || 0) + 1;
      u.unlocked = Math.max(u.unlocked, idx + 2);
      this.save();
    },

    exportJSON: function () {
      return JSON.stringify(this.state, null, 2);
    },

    importJSON: function (text) {
      var obj = JSON.parse(text);
      if (!obj || typeof obj !== 'object' || !obj.settings) throw new Error('进度文件格式不正确');
      this.state = obj;
      this.save();
    },

    reset: function () {
      if (this.activeId) localStorage.removeItem(USER_PREFIX + this.activeId);
      this.state = defaults();
      this.save();
    }
  };

  window.Store = Store;
})();
