/* bank.js — 精写题库加载器：只读内联数据 window.BANK_PARTS，绝不现场生成题目 */
(function () {
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  var MANIFEST = window.BANK_MANIFEST || {
    qishang: { name: '七年级上册', en: 'Grade 7A', color: '#7fb069', unit: 8 },
    qixia:   { name: '七年级下册', en: 'Grade 7B', color: '#5aa9e6', unit: 8 },
    bashang: { name: '八年级上册', en: 'Grade 8A', color: '#f2c14e', unit: 8 },
    baxia:   { name: '八年级下册', en: 'Grade 8B', color: '#ef8354', unit: 8 },
    jiushang:{ name: '九年级上册', en: 'Grade 9A', color: '#b388eb', unit: 8 },
    jiuxia:  { name: '九年级下册', en: 'Grade 9B', color: '#48c9b0', unit: 8 }
  };

  var Bank = {
    manifest: function () { return MANIFEST; },
    decks: {},     // deck -> { words: [...], units: [...] }
    loading: {},   // deck -> Promise

    /* 加载一个词库的精写题库。
     * 优先读内联数据 window.BANK_PARTS（单文件模式）；
     * 若不存在（开发模式），回退到 <script> 动态加载 data/questions/*.js */
    load: function (deck) {
      if (this.decks[deck]) return Promise.resolve(this.decks[deck]);
      if (this.loading[deck]) return this.loading[deck];
      var self = this;
      this.loading[deck] = new Promise(function (resolve, reject) {
        var parts = [];
        if (window.BANK_PARTS && window.BANK_PARTS[deck]) {
          // 内联数据为 {deck: [[part1], [part2], ...]}，需 flatten 成扁平词条数组
          var flat = [];
          window.BANK_PARTS[deck].forEach(function (part) {
            part.forEach(function (entry) { flat.push(entry); });
          });
          self.decks[deck] = self.build(deck, flat);
          resolve(self.decks[deck]);
          return;
        }
        // 开发模式：优先使用 index.html 已静态 <script src> 加载的全局变量
        // （file:// 协议下动态插入 <script> 会被 CORS 阻止，静态加载才可靠）
        var pre = [];
        var preIdx = 1;
        while (window['BANK_' + deck + '_part' + preIdx]) {
          pre = pre.concat(window['BANK_' + deck + '_part' + preIdx]);
          preIdx++;
        }
        if (pre.length) {
          self.decks[deck] = self.build(deck, pre);
          resolve(self.decks[deck]);
          return;
        }
        // 退化路径：动态加载 part 文件（需 http(s) 环境）
        var idx = 1;
        function tryNext() {
          var url = 'data/questions/' + deck + '_part' + idx + '.js';
          var s = document.createElement('script');
          s.src = url;
          s.onload = function () {
            var g = window['BANK_' + deck + '_part' + idx];
            if (g) { parts = parts.concat(g); idx++; tryNext(); }
            else finish();
          };
          s.onerror = function () {
            if (idx === 1) reject(new Error('该词库的精写题库尚未就绪'));
            else finish();
          };
          document.head.appendChild(s);
        }
        function finish() {
          self.decks[deck] = self.build(deck, parts);
          resolve(self.decks[deck]);
        }
        tryNext();
      });
      return this.loading[deck];
    },

    /* 从扁平词条列表构建单元
     * 【按课本课时切分】
     * 优先使用 window.UNIT_MAP（课本真实单元划分 + 课本原名单元标题）。
     * 若该册无单元映射，则退化为固定 N 词一切。
     */
    build: function (deck, words) {
      var N = MANIFEST[deck] ? MANIFEST[deck].unit : 8;
      var byWord = {};
      words.forEach(function (w) { byWord[w.word] = w; });

      var map = window.UNIT_MAP && window.UNIT_MAP[deck];
      if (map && map.units && map.units.length) {
        var units = [];
        var used = {};
        map.units.forEach(function (u, i) {
          var slice = [];
          (u.words || []).forEach(function (w) {
            var entry = byWord[w];
            if (entry) { slice.push(entry); used[w] = 1; }
          });
          if (!slice.length) return;
          units.push({
            idx: units.length,
            id: u.id,
            title: u.title,           // 课本单元名，如 "Unit 3"
            en: u.en,                 // 课本单元英文标题，如 "Family ties"
            lesson: u.lesson || '',   // 课时名，如 "课时1 Starting out & Reading"
            lessonIdx: u.lessonIdx || 0,
            words: slice
          });
        });
        // 兜底：映射外的词按 N 词补一个"补充词汇"单元
        var rest = words.filter(function (w) { return !used[w.word]; });
        for (var i = 0; i < rest.length; i += N) {
          var extra = rest.slice(i, i + N);
          units.push({
            idx: units.length,
            id: 'extra' + units.length,
            title: '补充词汇',
            en: 'Extra Words',
            words: extra
          });
        }
        if (units.length) {
          return { deck: deck, words: words, units: units, groups: Bank._groupUnits(units), byUnit: true };
        }
      }

      // 退化路径：固定 N 词一切
      var units2 = [];
      for (var j = 0; j < words.length; j += N) {
        var slice2 = words.slice(j, j + N);
        units2.push({ idx: units2.length, id: 'u' + (units2.length + 1), title: '第 ' + (units2.length + 1) + ' 单元', en: '', words: slice2 });
      }
      return { deck: deck, words: words, units: units2, byUnit: false };
    },

    /* 把课时列表按「单元」分组：册 → Unit → 课时
     * 同一 title+en 的连续课时归为一组（e.g. Unit 1 A new start 的 4 个课时） */
    _groupUnits: function (units) {
      var groups = [], map = {};
      units.forEach(function (u) {
        var key = (u.title || '') + '\u0001' + (u.en || '');
        if (!map[key]) {
          map[key] = { id: 'g' + groups.length, title: u.title || '', en: u.en || '', lessons: [] };
          groups.push(map[key]);
        }
        map[key].lessons.push(u);
      });
      groups.forEach(function (g) {
        g.words = 0;
        g.lessons.forEach(function (l) { g.words += l.words.length; });
      });
      return groups;
    },

    /* 单元显示名：Unit 1 A new start */
    groupName: function (g) {
      if (!g) return '';
      return g.en ? (g.title + ' ' + g.en) : g.title;
    },

    /* 单元显示名：优先课本原名（含课时名） */
    unitName: function (unit) {
      if (!unit) return '';
      var base = unit.en ? (unit.title + ' ' + unit.en) : unit.title;
      if (unit.lesson) return base + ' · ' + unit.lesson;
      return base;
    },

    /* 从某个词条展开为该词的全部题目（每词5题） */
    questionsOf: function (entry) {
      return entry.questions || [];
    },

    /* 一个单元展开为题目流：交错编排
     * 目标：同一单词的几道题分散开来，且不同题型交叉出现，
     * 避免"词1五题连考→词2五题连考"这种一眼看穿、过于简单的节奏。
     * 做法：按题型分轮次，轮内跨词混排；一轮放每个词一道题。 */
    lessonFlow: function (unit) {
      var words = unit.words;
      if (!words.length) return [];
      // 题型轮次：确保出现顺序稳定（每词题型序一致），但轮次之间题型自然不同
      var maxQ = 0;
      words.forEach(function (e) { maxQ = Math.max(maxQ, (e.questions || []).length); });
      var flow = [];
      // 轮 0..maxQ-1：每轮取每个词的第 i 题，组成一"批"，批内按词顺序，批间题型交叉
      for (var i = 0; i < maxQ; i++) {
        var batch = [];
        words.forEach(function (entry) {
          var qs = entry.questions || [];
          if (qs[i]) batch.push({ entry: entry, q: qs[i] });
        });
        // 批内随机打乱，进一步弱化"同一批全是同一题型"的单调感
        shuffle(batch);
        flow = flow.concat(batch);
      }
      // 交错平滑：相邻两题尽量不来自同一单词（把紧挨着的同词题后移）
      for (var k = 1; k < flow.length; k++) {
        if (flow[k].entry.word === flow[k - 1].entry.word) {
          var j = k + 1;
          while (j < flow.length && flow[j].entry.word === flow[k].entry.word) j++;
          if (j < flow.length) {
            var t = flow[k]; flow[k] = flow[j]; flow[j] = t;
          }
        }
      }
      // 题型穿插：每个词内部先打乱题型顺序，再跨词交错，
      // 让题型真正交叉出现，而不是"先全考选词、再全考听力"
      var byWord = {};
      flow.forEach(function (f) { (byWord[f.entry.word] = byWord[f.entry.word] || []).push(f); });
      var keys = Object.keys(byWord);
      keys.forEach(function (w) { shuffle(byWord[w]); }); // 词内题型随机化
      var ordered = [];
      var remain = true;
      while (remain) {
        remain = false;
        shuffle(keys);
        keys.forEach(function (w) {
          var arr = byWord[w];
          if (arr.length) { ordered.push(arr.shift()); remain = true; }
        });
      }
      flow = ordered;
      // 最后一道平滑：消掉相邻同题型（向后找一个不同题型且不同词的题换位）
      for (var k = 1; k < flow.length - 1; k++) {
        if (flow[k].q.type === flow[k - 1].q.type) {
          var j = k + 1;
          while (j < flow.length && (flow[j].q.type === flow[k].q.type || flow[j].entry.word === flow[k].entry.word)) j++;
          if (j < flow.length) { var t = flow[k]; flow[k] = flow[j]; flow[j] = t; }
        }
      }
      return flow;
    }
  };

  window.Bank = Bank;
})();
