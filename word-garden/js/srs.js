/* srs.js — 真实记忆曲线引擎（SM-2 间隔重复 + 艾宾浩斯遗忘模型）
 *
 * 【为什么不用简单的固定间隔】
 * 艾宾浩斯遗忘曲线 R(t) = e^(-t/S)：记忆保持率随时间指数衰减，
 * S（记忆强度）越大衰减越慢。SM-2 算法的核心正是：
 * 每复习一次就抬高 S，从而拉长下次复习间隔，逼近真实遗忘规律。
 *
 * 【本引擎实现】
 *  - 每个词维护独立的记忆状态：
 *      ef     记忆强度因子（Ease Factor），初始 2.5，随表现调整 1.3~3.0
 *      rep    连续答对次数
 *      lapses 遗忘次数（答错次数）
 *      S      记忆强度（天），由 ef 与表现共同决定
 *      next   下次复习时间戳
 *  - 复习间隔按真实遗忘曲线反推：找到 R(t)=90% 的 t 作为复习点
 *      t = -S × ln(0.9)，保证"到期复习时恰好处于遗忘临界点"
 *  - 三档反馈（认识/模糊/不认识）映射到 SM-2 的 quality(0-5)
 *  - 答题表现实时影响 ef：越轻松 → ef 越高 → 间隔越长
 *
 * 【等级与状态】
 *  - lvl 由 rep 决定（0-7），用于 UI 分级展示
 *  - status: learning（学习中）→ review（复习中）→ mastered（已掌握）
 */
(function () {
  var DAY = 86400000;           // 一天（毫秒）
  var MIN = 60000;             // 一分钟
  var HOUR = 3600000;          // 一小时

  /* 复习间隔阶梯（分钟）——用于离散化真实曲线，避免出现奇怪的秒数 */
  var LADDER_MIN = [
    1,          // <1 分钟（即时重做）
    10,         // 10 分钟
    60,         // 1 小时
    6 * 60,     // 6 小时
    24 * 60,    // 1 天
    2 * 1440,   // 2 天
    4 * 1440,   // 4 天
    7 * 1440,   // 7 天
    15 * 1440,  // 15 天
    30 * 1440,  // 30 天
    60 * 1440   // 60 天
  ];

  var SRS = {
    LADDER: LADDER_MIN,

    /* 初始状态 */
    init: function () {
      return {
        ef: 2.5,       // 记忆强度因子
        rep: 0,        // 连续答对
        lapses: 0,     // 遗忘次数
        S: 0.35,       // 记忆强度（天）
        last: 0,
        next: 0,
        right: 0,
        wrong: 0,
        lvl: 0,
        streak: 0,
        s: 0,          // 生疏度（保留旧字段兼容）
        status: 'learning'
      };
    },

    /* 三档反馈 → SM-2 quality(0-5)
     * know(认识)=5  vague(模糊)=3  unknown(不认识)=1
     */
    qualityOf: function (grade) {
      if (grade === 'unknown') return 1;
      if (grade === 'vague') return 3;
      return 5;
    },

    /* 核心：评分并更新记忆状态
     * p 为词条状态对象（原地修改并返回）
     */
    judge: function (p, grade) {
      var now = Date.now();
      var q = this.qualityOf(grade);

      // 补齐旧版字段（兼容 v2 存档）
      if (p.ef == null) p.ef = 2.5;
      if (p.rep == null) p.rep = 0;
      if (p.lapses == null) p.lapses = 0;
      if (p.S == null) p.S = 0.35;
      if (p.streak == null) p.streak = 0;

      // ---- 1. 更新记忆强度因子 ef（SM-2 标准公式） ----
      // ef' = ef + (0.1 - (5-q)*(0.08 + (5-q)*0.02))
      var d = 5 - q;
      p.ef = p.ef + (0.1 - d * (0.08 + d * 0.02));
      if (p.ef < 1.3) p.ef = 1.3;
      if (p.ef > 3.0) p.ef = 3.0;

      // ---- 2. 更新连续次数与遗忘次数 ----
      if (grade === 'unknown') {
        p.rep = 0;
        p.lapses = (p.lapses || 0) + 1;
        p.streak = 0;
        p.wrong = (p.wrong || 0) + 1;
        p.s = (p.s || 0) + 2;         // 生疏度（兼容旧逻辑）
      } else if (grade === 'vague') {
        // 模糊：不算失败，但连续次数退回一档
        p.rep = Math.max(0, (p.rep || 0) - 1);
        p.streak = 0;
        p.wrong = (p.wrong || 0) + 1;
        p.s = (p.s || 0) + 1;
      } else {
        p.rep = (p.rep || 0) + 1;
        p.streak = (p.streak || 0) + 1;
        p.right = (p.right || 0) + 1;
        p.s = Math.max(0, (p.s || 0) - 1);
      }

      // ---- 3. 更新记忆强度 S（天） ----
      // 答对：S 显著增长（巩固记忆）；答错：S 大幅衰减（几乎清零）
      if (grade === 'unknown') {
        p.S = Math.max(0.12, p.S * 0.25);
      } else if (grade === 'vague') {
        p.S = Math.max(0.25, p.S * 0.6);
      } else {
        // 记忆强度随连续答对次数增长，增幅受 ef 调节
        p.S = Math.max(0.35, p.S * (1.35 + (p.ef - 1.3) * 0.45));
      }
      // 上限 60 天（超过后边际收益很低）
      if (p.S > 60) p.S = 60;

      // ---- 4. 由遗忘曲线反推复习间隔 ----
      // R(t) = e^(-t/S)，取 R = 0.9（尚在记忆边缘）时 t = -S·ln(0.9) ≈ 0.105·S 天
      // 再叠加 SM-2 的 rep 阶梯（低次复习用短间隔验证，高次用长间隔巩固）
      var curveDays = p.S * 0.105;               // 曲线给出的"最早该复习"时间
      var ladderIdx = this.ladderIndex(p);       // 阶梯位置
      var ladderMin = LADDER_MIN[ladderIdx];
      var curveMin = curveDays * 1440;
      // 取两者较大值：既不违背遗忘规律，也不低于该阶段的最小间隔
      var intervalMin = Math.max(ladderMin, curveMin);
      // 上限 60 天
      if (intervalMin > LADDER_MIN[LADDER_MIN.length - 1]) {
        intervalMin = LADDER_MIN[LADDER_MIN.length - 1];
      }

      // ---- 5. 写入时间与状态 ----
      p.last = now;
      p.next = now + intervalMin * MIN;
      p.lvl = Math.min(LADDER_MIN.length - 1, ladderIdx);
      p.status = this.statusOf(p);

      return p;
    },

    /* 阶梯位置：连续答对次数决定基础档位 */
    ladderIndex: function (p) {
      var rep = p.rep || 0;
      if (rep <= 0) return 0;
      if (rep === 1) return 2;   // 1 小时
      if (rep === 2) return 3;   // 6 小时
      if (rep === 3) return 4;   // 1 天
      if (rep === 4) return 5;   // 2 天
      if (rep === 5) return 6;   // 4 天
      if (rep === 6) return 7;   // 7 天
      if (rep === 7) return 8;   // 15 天
      return 9;                  // 30 天以上
    },

    /* 状态判定 */
    statusOf: function (p) {
      var rep = p.rep || 0;
      var S = p.S || 0;
      if (rep >= 5 && S >= 12) return 'mastered';
      if (rep >= 2) return 'review';
      return 'learning';
    },

    /* 是否在重点池（错过且未连续答对2次） */
    inFocusPool: function (p) {
      return !!p && (p.wrong || 0) > 0 && (p.rep || 0) < 2;
    },

    /* 到期需要复习 */
    isDue: function (p) {
      return !!p && p.last > 0 && p.status !== 'mastered' && p.next <= Date.now();
    },

    /* 下次复习时间的人性化描述 */
    nextText: function (p) {
      if (!p || !p.next) return '';
      var diff = p.next - Date.now();
      if (diff <= 0) return '现在';
      var min = Math.round(diff / MIN);
      if (min < 60) return min + ' 分钟后';
      var h = Math.round(min / 60);
      if (h < 24) return h + ' 小时后';
      var d = Math.round(h / 24);
      if (d < 30) return d + ' 天后';
      return Math.round(d / 30) + ' 个月后';
    },

    /* 预估保持率 R = e^(-t/S)
     * t 为距上次复习的天数；S 为记忆强度（天）
     * 曲线可视化用：横轴天数，纵轴保持率
     */
    retention: function (p, days) {
      if (!p) return 0;
      var S = p.S || 0.35;
      var t = days == null ? (p.last ? (Date.now() - p.last) / DAY : 0) : days;
      return Math.exp(-t / S);
    },

    /* 未来 N 天的保持率曲线（供图表使用）
     * 返回 [{d: 天数, r: 保持率0-1}, ...]
     */
    curve: function (p, days) {
      days = days || 30;
      var out = [];
      var S = p.S || 0.35;
      var step = days > 60 ? 5 : (days > 14 ? 2 : 1);
      for (var d = 0; d <= days; d += step) {
        out.push({ d: d, r: Math.exp(-d / S) });
      }
      return out;
    },

    /* 记忆强度描述（给 UI 用） */
    strengthText: function (p) {
      if (!p) return { label: '未学', color: '#9aa892' };
      var S = p.S || 0;
      if (S < 0.5) return { label: '很模糊', color: '#e4572e' };
      if (S < 2) return { label: '记不牢', color: '#ef8354' };
      if (S < 8) return { label: '还不错', color: '#f2c14e' };
      if (S < 25) return { label: '挺牢固', color: '#5aa9e6' };
      return { label: '很牢固', color: '#7fb069' };
    },

    /* 保留率文字 */
    retentionText: function (p) {
      var r = this.retention(p);
      var pct = Math.round(r * 100);
      if (pct >= 90) return '记忆很牢';
      if (pct >= 70) return '记得清楚';
      if (pct >= 40) return '有点模糊';
      if (pct >= 15) return '快忘了';
      return '已经忘了';
    },

    /* 迁移旧版存档：v2 的 lvl/s/streak 映射到新的 ef/rep/S */
    migrate: function (p) {
      if (p.ef != null) return p;   // 已是新版
      var lvl = p.lvl || 0;
      var streak = p.streak || 0;
      p.ef = 2.5;
      p.rep = streak;
      p.lapses = p.wrong || 0;
      // 由旧等级估算记忆强度
      var Smap = [0.2, 0.4, 0.8, 1.8, 3.5, 7, 14, 30, 45, 60, 60, 60];
      p.S = Smap[Math.min(Smap.length - 1, lvl)] || 0.35;
      p.streak = streak;
      p.status = this.statusOf(p);
      return p;
    }
  };

  window.SRS = SRS;
})();
