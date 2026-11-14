/* data.js — 词库加载 / 主题分类 / 例句生成 / 近义词 / CSV导入 */
(function () {
  var THEMES = [
    { id: 'nature',  name: '自然植物', re: /植物|树|花|草|叶|森林|自然|天气|气候|雨|雪|风|山|河|海|季节/ },
    { id: 'animal',  name: '动物',     re: /动物|兽|鸟|鱼|虫|犬|猫|马|牛|羊|猪|鸡|蛇|昆虫/ },
    { id: 'body',    name: '人体医学', re: /身体|手|脚|头|心|眼|耳|口|疾病|医|药|健康|疼痛/ },
    { id: 'food',    name: '饮食',     re: /食物|饭|菜|果|饮|吃|喝|味|甜|酸|苦|辣|餐/ },
    { id: 'emotion', name: '情感心理', re: /感情|情感|爱|恨|喜|怒|悲|恐|惊|忧|焦虑|高兴|伤心|害怕/ },
    { id: 'time',    name: '时间空间', re: /时间|年|月|日|小时|分钟|空间|地点|方向|位置/ },
    { id: 'society', name: '社会政经', re: /社会|政治|法律|政府|经济|市场|商业|贸易|战争|国家|城市/ },
    { id: 'tech',    name: '科技教育', re: /科学|技术|机器|电子|计算机|网络|教育|学习|学校|考试|实验/ },
    { id: 'action',  name: '动作行为', re: null, pos: /v/ },
    { id: 'desc',    name: '性质状态', re: null, pos: /a|adj|ad/ }
  ];

  var Data = {
    THEMES: THEMES,
    decks: {},        // id -> 词数组（已加载）
    loading: {},      // id -> Promise

    /* manifest：优先用精写题库 manifest（单文件内联），回退到旧 DECK_MANIFEST */
    manifest: function () {
      if (window.BANK_MANIFEST) return window.BANK_MANIFEST;
      return window.DECK_MANIFEST || {};
    },

    /* 从精写题库词条映射为可浏览词记录 {w,p,t,pos,lv}
     * 精写题库字段：word/phonetic/pos/gloss/difficulty */
    _entryToRec: function (entry) {
      return {
        w: entry.word,
        p: entry.phonetic || '',
        t: entry.gloss || '',
        pos: entry.pos || '',
        lv: entry.difficulty || 3
      };
    },

    /* 加载词库：优先读内联精写题库（单文件模式），
     * 否则回退到动态加载 deck_*.js（开发模式完整词表） */
    loadDeck: function (id) {
      if (this.decks[id]) return Promise.resolve(this.decks[id]);
      if (id === 'custom') { this.decks.custom = this.loadCustom(); return Promise.resolve(this.decks.custom); }
      if (this.loading[id]) return this.loading[id];
      var self = this;
      this.loading[id] = new Promise(function (resolve, reject) {
        // 单文件模式：精写题库在 window.BANK_PARTS 里，直接用
        if (window.BANK_PARTS && window.BANK_PARTS[id]) {
          var parts = window.BANK_PARTS[id];
          var words = [];
          parts.forEach(function (part) {
            part.forEach(function (entry) { words.push(self._entryToRec(entry)); });
          });
          self.decks[id] = words;
          resolve(words);
          return;
        }
        // 开发模式：动态加载 deck_*.js
        var s = document.createElement('script');
        s.src = 'js/data/deck_' + id + '.js';
        s.onload = function () {
          self.decks[id] = window['DECK_' + id] || [];
          resolve(self.decks[id]);
        };
        s.onerror = function () { reject(new Error('词库文件加载失败: ' + id)); };
        document.head.appendChild(s);
      });
      return this.loading[id];
    },

    words: function (id) { return this.decks[id] || []; },

    /* 自定义词库（localStorage 中的导入词库） */
    loadCustom: function () {
      try { return JSON.parse(localStorage.getItem('wordgarden.customdeck') || '[]'); }
      catch (e) { return []; }
    },
    saveCustom: function (arr) {
      localStorage.setItem('wordgarden.customdeck', JSON.stringify(arr));
      this.decks.custom = arr;
    },

    /* 主题分类：先按释义关键词，再按词性兜底 */
    classifyTheme: function (rec) {
      var t = rec.t || '';
      for (var i = 0; i < THEMES.length; i++) {
        if (THEMES[i].re && THEMES[i].re.test(t)) return THEMES[i].id;
      }
      var pos = rec.pos || '';
      if (/v/.test(pos)) return 'action';
      if (/a|adj|ad/.test(pos)) return 'desc';
      return 'other';
    },
    themeName: function (id) {
      var m = THEMES.filter(function (x) { return x.id === id; })[0];
      return m ? m.name : '其他';
    },

    /* 提取释义中的第一个词义（去掉词性前缀） */
    gloss: function (t) {
      var s = (t || '').split('；')[0].replace(/^[a-z]{1,4}\.\s*/i, '').trim();
      return s.split('，')[0].split('、')[0].split('；')[0] || s;
    },

    /* 例句：精配优先，否则按词性模板生成；返回 {en, cn, curated} */
    exampleFor: function (rec) {
      var cur = (window.CURATED || {})[rec.w.toLowerCase()];
      if (cur) return { en: cur.en, cn: cur.cn, curated: true };
      var w = rec.w, gloss = this.gloss(rec.t), pos = rec.pos || '';
      var en, cn;
      if (/(^|,)v/.test(pos) || /^v[ti]?\./.test(rec.t)) {
        en = 'They ' + w + ' together in the garden every weekend.';
        cn = '他们每个周末都在花园里一起' + gloss + '。';
      } else if (/ad/.test(pos) && !/a:|adj/.test(pos)) {
        en = 'She spoke so ' + w + ' that everyone listened carefully.';
        cn = '她说得如此' + gloss + '，大家都认真听着。';
      } else if (/a|adj/.test(pos)) {
        en = 'It was such a ' + w + ' morning that everyone felt cheerful.';
        cn = '那是一个如此' + gloss + '的早晨，每个人都心情愉悦。';
      } else {
        en = 'The ' + w + ' plays an important role in our daily life.';
        cn = '这个' + gloss + '在我们的日常生活中扮演着重要角色。';
      }
      return { en: en, cn: cn, curated: false };
    },

    /* 例句中高亮目标词 */
    highlight: function (sentence, word) {
      try {
        var re = new RegExp('(' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
        return sentence.replace(re, '<b class="hl">$1</b>');
      } catch (e) { return sentence; }
    },

    synonyms: function (rec) {
      var cur = (window.CURATED || {})[rec.w.toLowerCase()];
      return cur && cur.syn ? cur.syn : [];
    },

    /* 词形变化：exchange 字段解析为人类可读 */
    exchangeText: function (ex) {
      if (!ex) return '';
      var MAP = { p: '过去式', d: '过去分词', i: '现在分词', 3: '第三人称', r: '比较级', t: '最高级', s: '复数', 0: '原型', 1: '变换' };
      return ex.split('/').map(function (pair) {
        var kv = pair.split(':');
        return kv.length === 2 && MAP[kv[0]] ? MAP[kv[0]] + ' ' + kv[1] : '';
      }).filter(Boolean).slice(0, 4).join(' · ');
    },

    /* CSV 解析（支持引号） */
    parseCSV: function (text) {
      var rows = [], row = [], cur = '', inQ = false;
      for (var i = 0; i < text.length; i++) {
        var c = text[i];
        if (inQ) {
          if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
          else cur += c;
        } else if (c === '"') inQ = true;
        else if (c === ',') { row.push(cur); cur = ''; }
        else if (c === '\n' || c === '\r') {
          if (c === '\r' && text[i + 1] === '\n') i++;
          row.push(cur); cur = '';
          if (row.length > 1 || row[0]) rows.push(row);
          row = [];
        } else cur += c;
      }
      if (cur || row.length) { row.push(cur); rows.push(row); }
      return rows;
    },

    /* 导入 CSV 为自定义词库；格式: word,phonetic,translation[,pos]（可带表头） */
    importCSV: function (text) {
      var rows = this.parseCSV(text);
      var out = [], start = 0;
      if (rows.length && /word|单词/i.test(rows[0][0] || '')) start = 1;
      for (var i = start; i < rows.length; i++) {
        var r = rows[i], w = (r[0] || '').trim();
        if (!w || !/^[A-Za-z][A-Za-z\-' ]*$/.test(w)) continue;
        out.push({ w: w, p: (r[1] || '').trim(), t: (r[2] || '').trim().replace(/\n/g, '；'), pos: (r[3] || '').trim(), lv: 3 });
      }
      this.saveCustom(out);
      return out.length;
    },

    /* 从词库随机抽取干扰项（同难度优先） */
    distractors: function (deckId, rec, n, field) {
      var pool = this.words(deckId);
      var res = [], seen = {};
      seen[rec.w] = true;
      var tries = 0;
      while (res.length < n && tries < 200 && pool.length > n) {
        tries++;
        var c = pool[Math.floor(Math.random() * pool.length)];
        if (seen[c.w]) continue;
        if (Math.abs((c.lv || 3) - (rec.lv || 3)) > 2 && tries < 100) continue;
        seen[c.w] = true;
        res.push(c);
      }
      return res;
    }
  };

  window.Data = Data;
})();
