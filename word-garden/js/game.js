/* game.js — 游戏化模块：成就解锁、每日任务、等级、学习时长、签到奖励 */
(function () {
  var Game = {
    /* 记录进入学习（用于累计时长与时段成就） */
    sessionStartTs: 0,

    /* 成就解锁时弹提示 */
    _notify: function (id) {
      var ACH = Store.ACHIEVEMENTS;
      if (!ACH[id]) return;
      if (window.App && App.toast) {
        App.toast('🏆 解锁成就「' + ACH[id].name + '」' + ACH[id].ico);
      }
    },

    beginSession: function () {
      this.sessionStartTs = Date.now();
      // 时段成就：清晨(5-9点) / 晚间(22-2点)
      var h = new Date().getHours();
      if (h >= 5 && h < 9) Store.unlockAchievement('early_bird');
      else if (h >= 22 || h < 2) Store.unlockAchievement('night_owl');
    },

    endSession: function () {
      if (this.sessionStartTs) {
        var sec = Math.round((Date.now() - this.sessionStartTs) / 1000);
        if (sec > 0) Store.addStudyTime(sec);
        this.sessionStartTs = 0;
      }
    },

    /* 每次答对后检查进度型成就 */
    checkProgress: function () {
      var learned = Store.totalLearnedWords();
      var mastered = Store.totalMasteredWords();
      var self = this;
      var checks = [
        [learned >= 1, 'first_word'],
        [learned >= 10, 'ten_words'],
        [learned >= 50, 'fifty_words'],
        [learned >= 100, 'hundred'],
        [learned >= 500, 'five_hundred'],
        [mastered >= 20, 'master_20'],
        [Store.state.streak.count >= 3, 'streak_3'],
        [Store.state.streak.count >= 7, 'streak_7']
      ];
      checks.forEach(function (c) {
        if (c[0] && Store.unlockAchievement(c[1])) self._notify(c[1]);
      });
    },

    /* 连击成就 */
    checkCombo: function (combo) {
      if (combo >= 5 && Store.unlockAchievement('combo_5')) this._notify('combo_5');
      if (combo >= 10 && Store.unlockAchievement('combo_10')) this._notify('combo_10');
    },

    /* 单元完成成就 */
    checkUnitDone: function (deck, acc) {
      var self = this;
      var units = Store.totalUnitsDone();
      if (units >= 1 && Store.unlockAchievement('first_unit')) self._notify('first_unit');
      if (units >= 10 && Store.unlockAchievement('ten_units')) self._notify('ten_units');
      if (acc >= 100 && Store.unlockAchievement('perfect_unit')) self._notify('perfect_unit');
      this.checkProgress();
    },

    /* 完成任务计数（每日任务） */
    bumpMission: function (taskId) {
      var g = Store.gameState();
      var t = Store.todayKey();
      if (g.missions.date !== t) { g.missions = { date: t, tasks: {} }; }
      g.missions.tasks[taskId] = (g.missions.tasks[taskId] || 0) + 1;
      Store.save();
    },

    /* 每日任务奖励（经验）：领取任务奖励 */
    claimMission: function (taskId) {
      var MISS = Store.MISSIONS;
      if (!MISS[taskId]) return false;
      var g = Store.gameState();
      var t = Store.todayKey();
      if (g.missions.date !== t) { g.missions = { date: t, tasks: {} }; }
      if (g.missions.claimed && g.missions.claimed[taskId]) return false;
      var m = MISS[taskId];
      var prog = Store.missionProgress();
      var cur = m.kind === 'unit' ? prog.units : prog.learn;
      if (cur < m.target) return false;
      // 发放奖励
      var reward = 15;
      Store.state.garden.xp += reward;
      if (!g.missions.claimed) g.missions.claimed = {};
      g.missions.claimed[taskId] = true;
      Store.save();
      return reward;
    },

    /* 每日签到奖励 */
    checkIn: function () {
      var t = Store.todayKey();
      var g = Store.gameState();
      if (g.lastCheckIn === t) return null; // 今天已签到
      g.lastCheckIn = t;
      // 连续签到奖励递增
      var streak = Store.state.streak.count;
      var reward = 10 + Math.min(streak, 7) * 5;
      Store.state.garden.xp += reward;
      Store.save();
      return reward;
    },

    /* 学习时长格式化 */
    fmtDuration: function (sec) {
      sec = sec || 0;
      var m = Math.floor(sec / 60);
      var h = Math.floor(m / 60);
      if (h > 0) return h + ' 小时 ' + (m % 60) + ' 分';
      if (m > 0) return m + ' 分钟';
      return sec + ' 秒';
    }
  };

  window.Game = Game;
})();
