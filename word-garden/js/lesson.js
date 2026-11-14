/* lesson.js — 多邻国式课程引擎（v3）
 * 「先教后考」：每节课先逐个教学本单元的新单词（教学卡 + 吉祥物讲解 + 发音），
 * 用户确认后再进入题目考核。复习已学词直接进入考核。
 * 读精写题库 data/questions/*.json，每题一个全屏页面，
 * 底部进度条 + 即时对错反馈 + 吉祥物表情，答完结算页。程序零公式出题。
 */
(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function $(id) { return document.getElementById(id); }

  var TYPE_LABEL = {
    zh2en: '选择正确单词',
    en2zh: '选择正确释义',
    listen: '听发音，选择单词',
    spell: '拼写这个单词',
    cloze: '选择填入空格的单词',
    pos: '词性变形填空',
    syn: '近义词辨析'
  };

  var Lesson = {
    active: false,
    deck: '', unitIdx: 0, unit: null,
    flow: [], pos: 0,
    combo: 0, bestCombo: 0, right: 0, wrong: 0,
    judgedWord: {},       // 每词本课首次正确时记录，用于 SRS
    showingFb: false,
    phase: 'teach',       // 'teach' 教学阶段 | 'quiz' 考核阶段
    teachQueue: [],       // 待教学的新词
    teachPos: 0,

    /* 进入一个单元：先教学新词，再展开题目流 */
    start: function (deck, unitIdx) {
      var self = this;
      Game.beginSession();
      Bank.load(deck).then(function (bank) {
        var units = bank.units;
        self.deck = deck;
        self.unitIdx = Math.max(0, Math.min(unitIdx, units.length - 1));
        self.unit = units[self.unitIdx];
        self.flow = Bank.lessonFlow(self.unit);
        self.pos = 0;
        self.combo = 0; self.bestCombo = 0; self.right = 0; self.wrong = 0;
        self.judgedWord = {}; self.showingFb = false;
        self.active = true;
        self.enterMode();
        self.beginTeach();
      }).catch(function (e) {
        alert(e.message);
        Lesson.quit();
      });
    },

    /* ---------- 教学阶段：逐个教新词 ---------- */
    beginTeach: function () {
      this.phase = 'teach';
      // 找出本单元尚未学过的词（重点教学）
      var self = this;
      this.teachQueue = this.unit.words.filter(function (e) {
        return !Store.peekWord(self.deck, e.word);
      });
      // 如果全是新词，也可用已学但生疏的补足教学
      this.teachPos = 0;
      if (!this.teachQueue.length) {
        // 没有新词，直接进入考核
        this.phase = 'quiz';
        this.render();
        return;
      }
      this.renderTeach();
    },

    renderTeach: function () {
      if (this.teachPos >= this.teachQueue.length) {
        this.phase = 'quiz';
        this.render();
        return;
      }
      var entry = this.teachQueue[this.teachPos];
      var total = this.teachQueue.length;
      var idx = this.teachPos + 1;
      // 例句：优先精配例句，否则用精写题库 cloze 题目的例句
      var example = this.exampleFor(entry);
      var view = $('view');
      view.innerHTML =
        '<div class="screen">' +
          this.renderHeader() +
          '<div class="screen-body">' +
            '<div class="teach-card">' +
              '<span class="teach-badge">📖 单词教学 · ' + idx + ' / ' + total + '</span>' +
              '<div class="mascot-stage">' +
                '<div id="teach-mascot"></div>' +
                '<div class="mascot-speech" id="teach-speech">' + esc(Mascot.say('teach')) + '</div>' +
              '</div>' +
              '<div class="teach-word-row">' +
                '<div style="flex:1"><div class="teach-word">' + esc(entry.word) + '</div>' +
                (entry.phonetic ? '<div class="teach-pron">/' + esc(entry.phonetic) + '/</div>' : '') + '</div>' +
                '<button class="teach-play" id="teach-play" title="发音">🔊</button>' +
              '</div>' +
              '<div class="teach-gloss">' + esc(entry.gloss) + (entry.pos ? ' <span class="teach-pos">(' + esc(entry.pos) + ')</span>' : '') + '</div>' +
              (example.en ? '<div class="teach-example">' + Data.highlight(esc(example.en), entry.word) + (example.cn ? '<span class="cn">' + esc(example.cn) + '</span>' : '') + '</div>' : '') +
              '<div class="teach-actions">' +
                '<button class="btn ghost" id="teach-skip">跳过</button>' +
                '<button class="btn primary lg" id="teach-next">学会了，继续 →</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      var self = this;
      Mascot.render($('teach-mascot'), 'teach', 120);
      $('teach-play').onclick = function () { TTS.speak(entry.word); };
      // 教学阶段也要能退出（否则 ✕ 按钮点了没反应）
      var teachX = $('lesson-x');
      if (teachX) teachX.onclick = function () { if (confirm('退出课程？本课进度将不会保存。')) self.quit(); };
      $('teach-skip').onclick = function () { self.teachPos++; self.renderTeach(); };
      $('teach-next').onclick = function () {
        // 教学确认：首次学习记录为"已认识"的初识状态（轻量，不进入重点池）
        var p = Store.getWord(self.deck, entry.word);
        if (!p.last) { p.last = Date.now(); p.status = 'learning'; p.lvl = 0; p.next = Date.now(); Store.save(); }
        self.teachPos++;
        self.renderTeach();
      };
      // 教学阶段自动发音
      setTimeout(function () { TTS.speak(entry.word); }, 450);
    },

    /* 从精写题库提取例句（优先 cloze 题目的 sentence） */
    exampleFor: function (entry) {
      var qs = entry.questions || [];
      var cloze = null;
      for (var i = 0; i < qs.length; i++) if (qs[i].type === 'cloze' && qs[i].sentence) { cloze = qs[i]; break; }
      if (cloze) {
        var en = cloze.sentence.replace(/_{3,}/g, entry.word);
        return { en: en, cn: '' };
      }
      return { en: '', cn: '' };
    },

    enterMode: function () {
      document.body.classList.add('in-lesson');
      var bar = $('actionbar'); if (bar) bar.classList.add('hidden');
    },
    exitMode: function () {
      document.body.classList.remove('in-lesson');
    },

    current: function () { return this.flow[this.pos]; },

    render: function () {
      this.showingFb = false;
      if (this.phase === 'teach') { this.renderTeach(); return; }
      if (this.pos >= this.flow.length) { this.finish(); return; }
      var item = this.current(), q = item.q, entry = item.entry;
      var total = this.flow.length;
      var view = $('view');
      view.innerHTML =
        '<div class="screen">' +
          this.renderHeader() +
          '<div class="screen-body">' + this.renderQuestion(item, q, entry) + '</div>' +
          '<div class="screen-foot" id="screen-foot"></div>' +
        '</div>';
      this.bindQuestion(item, q, entry);
      var fill = $('lesson-fill');
      if (fill) fill.style.width = (this.pos / total * 100) + '%';
      var comboEl = $('lesson-combo');
      if (comboEl) { comboEl.textContent = this.combo >= 2 ? '🔥x' + this.combo : '🔥'; comboEl.classList.toggle('fire', this.combo >= 2); }
    },

    renderHeader: function () {
      return '<div class="lesson-bar">' +
        '<button class="lesson-x" id="lesson-x" title="退出">✕</button>' +
        '<div class="lesson-progress"><div class="lesson-fill" id="lesson-fill"></div></div>' +
        '<span class="lesson-combo" id="lesson-combo">🔥</span>' +
      '</div>';
    },

    renderQuestion: function (item, q, entry) {
      var label = '<div class="q-label">' + (TYPE_LABEL[q.type] || '') + '</div>';
      if (q.type === 'zh2en') {
        return label + '<div class="q-stem zh">' + esc(q.stem) + '</div>' + this.optionsHtml(q);
      }
      if (q.type === 'en2zh') {
        return label +
          '<div class="q-stem en">' + esc(q.stem) +
          ' <button class="mini-pron" id="q-pron">🔊</button></div>' +
          (entry.phonetic ? '<div class="q-phon">/' + esc(entry.phonetic) + '/</div>' : '') +
          this.optionsHtml(q);
      }
      if (q.type === 'listen') {
        return label +
          '<div class="q-stem listen-stem"><button class="listen-big" id="q-listen">▶<span>播放</span></button></div>' +
          this.optionsHtml(q);
      }
      if (q.type === 'spell') {
        return label +
          '<div class="q-stem zh">' + esc(q.stem) + '</div>' +
          (entry.phonetic ? '<div class="q-phon">/' + esc(entry.phonetic) + '/ <button class="mini-pron" id="q-pron">🔊</button></div>' : '') +
          '<input id="lesson-spell" class="spell-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="输入单词，回车提交">';
      }
      if (q.type === 'pos') {
        return label +
          '<div class="q-stem cloze">' + esc(q.sentence) + '</div>' +
          (q.base ? '<div class="q-pos-hint">词根：<b>' + esc(q.base) + '</b></div>' : '') +
          this.optionsHtml(q);
      }
      if (q.type === 'syn') {
        return label +
          '<div class="q-stem en">' + esc(q.stem) +
          ' <button class="mini-pron" id="q-pron">🔊</button></div>' +
          '<div class="q-syn-hint">选出与它意思最接近的一项</div>' +
          this.optionsHtml(q);
      }
      return label + '<div class="q-stem cloze">' + esc(q.sentence) + '</div>' + this.optionsHtml(q);
    },

    optionsHtml: function (q) {
      var opts = shuffle(q.options.slice());
      return '<div class="options">' + opts.map(function (o, i) {
        var isEn = /^[A-Za-z]/.test(o);
        return '<button class="option' + (isEn ? ' en' : '') + '" data-v="' + esc(o) + '"><em>' + (i + 1) + '</em><span>' + esc(o) + '</span></button>';
      }).join('') + '</div>';
    },

    bindQuestion: function (item, q, entry) {
      var self = this;
      var x = $('lesson-x');
      if (x) x.onclick = function () { if (confirm('退出课程？本课进度将不会保存。')) self.quit(); };
      var pron = $('q-pron');
      if (pron) pron.onclick = function () { TTS.speak(entry.word); };
      var listen = $('q-listen');
      if (listen) {
        listen.onclick = function () { TTS.speak(entry.word); };
        setTimeout(function () { TTS.speak(entry.word); }, 350);
      }
      var opts = document.querySelectorAll('#view .option');
      opts.forEach(function (b) { b.onclick = function () { self.answer(b.dataset.v, b); }; });
      var input = $('lesson-spell');
      if (input) {
        setTimeout(function () { input.focus(); }, 60);
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && input.value.trim()) self.answer(input.value.trim());
        });
      }
    },

    answer: function (v, btn) {
      if (this.showingFb) return;
      var item = this.current(), q = item.q, entry = item.entry;
      var ok = q.type === 'spell' ? v.trim().toLowerCase() === q.answer.toLowerCase() : v === q.answer;
      if (ok) {
        this.right++;
        this.combo++;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        if (!this.judgedWord[entry.word]) {
          this.judgedWord[entry.word] = true;
          var isNew = !Store.peekWord(this.deck, entry.word);
          var p = Store.getWord(this.deck, entry.word);
          SRS.judge(p, 'know');
          Store.record(this.deck, entry.word, true, isNew);
          // 游戏化：成就检查（首次/累计）
          Game.checkProgress();
        }
        TTS.beep('correct');
      } else {
        this.wrong++;
        this.combo = 0;
        if (!item._retried) {
          this.flow.push({ entry: item.entry, q: item.q, _retried: true });
        }
        // 答错 → 写入错题本（记录题型与所选错误选项），并走遗忘曲线回落
        if (!this.judgedWord[entry.word]) {
          this.judgedWord[entry.word] = true;
          var isNewBad = !Store.peekWord(this.deck, entry.word);
          var pBad = Store.getWord(this.deck, entry.word);
          SRS.judge(pBad, 'unknown');
          Store.record(this.deck, entry.word, false, isNewBad, { type: q.type, picked: v });
        }
        TTS.beep('wrong');
      }
      // 连击成就即时检查
      Game.checkCombo(this.combo);
      App.updateProgressPill();
      this.showFeedback(ok, item, btn);
    },

    showFeedback: function (ok, item, btn) {
      this.showingFb = true;
      var q = item.q, entry = item.entry;
      var opts = document.querySelectorAll('#view .option');
      opts.forEach(function (o) {
        o.disabled = true;
        if (o.dataset.v === q.answer) o.classList.add('right');
        else if (btn && o === btn) o.classList.add('wrong');
      });
      var input = $('lesson-spell');
      if (input) input.disabled = true;
      var foot = $('screen-foot');
      var answerWord = /[A-Za-z]/.test(q.answer) ? q.answer : entry.word;
      var mood = ok ? (this.combo >= 5 ? 'power' : this.combo >= 3 ? 'cheer' : 'happy') : (this.combo >= 0 ? 'sad' : 'sad');
      // 同档位随机表情，让反馈更鲜活
      mood = Mascot.randomMood(mood);
      foot.className = 'screen-foot show ' + (ok ? 'ok' : 'no');
      foot.innerHTML =
        '<div class="fb-info">' +
          '<div class="mascot-stage"><div id="fb-mascot"></div></div>' +
          '<div class="fb-text">' +
            '<b>' + esc(answerWord) + '</b>' + (entry.phonetic ? ' <i>/' + esc(entry.phonetic) + '/</i>' : '') +
            '<span>' + esc(entry.gloss) + '</span>' +
            (ok ? (this.combo >= 3 ? '<em>连击 x' + this.combo + '！</em>' : '<em>太棒了！</em>') : '<em>再记一次就会了</em>') +
            '<span class="mascot-line">' + esc(Mascot.say(mood)) + '</span>' +
          '</div>' +
          '<button class="btn ' + (ok ? 'primary' : 'danger') + ' fb-btn" id="fb-next">继续 →</button>' +
        '</div>';
      var self = this;
      Mascot.render($('fb-mascot'), mood, 84);
      $('fb-next').onclick = function () { self.next(); };
      if (ok) TTS.speak(entry.word);
    },

    next: function () { this.pos++; this.render(); },

    quit: function () {
      this.active = false;
      this.exitMode();
      Game.endSession();
      Views.renderHome();
    },

    finish: function () {
      this.active = false;
      this.exitMode();
      Game.endSession();
      var unit = this.unit;
      var total = unit.words.length;
      var acc = total ? Math.round(this.right / Math.max(1, this.right + this.wrong) * 100) : 0;
      var xp = 10 + this.right * 2 + (this.bestCombo >= 5 ? this.bestCombo : 0);
      Store.state.garden.xp += xp;
      Store.completeUnit(this.deck, this.unitIdx);
      // 游戏化：单元完成成就 + 完美通关
      Game.checkUnitDone(this.deck, acc);
      TTS.beep('done');
      var crowns = Store.unitState(this.deck).done[this.unitIdx] || 1;
      var hasNext = this.unitIdx + 1 < (Bank.decks[this.deck] ? Bank.decks[this.deck].units.length : 0);
      var view = $('view');
      var mood = acc >= 90 ? 'power' : (acc >= 60 ? 'cheer' : 'sad');
      mood = Mascot.randomMood(mood);
      // 课时名（课本单元原名）
      var unitInfo = this.unit || {};
      var unitLabel = unitInfo.title || ('单元 ' + (this.unitIdx + 1));
      var unitEn = unitInfo.en || '';
      var nextUnit = this.unitIdx + 1 < (Bank.decks[this.deck] ? Bank.decks[this.deck].units.length : 0)
        ? (Bank.decks[this.deck].units[this.unitIdx + 1] || {}) : null;
      var nextLabel = nextUnit ? (nextUnit.title || ('单元 ' + (this.unitIdx + 2))) : '';
      view.innerHTML =
        '<div class="screen result-screen">' +
          '<div id="result-mascot"></div>' +
          '<h2>' + esc(unitLabel) + (unitEn ? ' <span class="rs-unit-en">' + esc(unitEn) + '</span>' : '') + ' 完成！</h2>' +
          '<div class="crown-row">' + '👑'.repeat(Math.min(3, crowns)) + (crowns > 3 ? ' x' + crowns : '') + '</div>' +
          '<div class="summary-stats">' +
            '<div><b>+' + xp + '</b><span>经验值</span></div>' +
            '<div><b>' + acc + '%</b><span>正确率</span></div>' +
            '<div><b>🔥 x' + this.bestCombo + '</b><span>最高连击</span></div>' +
            '<div><b>' + total + '</b><span>单词</span></div>' +
          '</div>' +
          '<p class="summary-note">' + esc(Mascot.say(mood)) + '</p>' +
          '<div class="empty-actions">' +
            (hasNext ? '<button class="btn primary lg" id="lesson-next">开始 ' + esc(nextLabel) + ' →</button>' : '<button class="btn ghost" id="lesson-next">词库全部通关 🎉</button>') +
            '<button class="btn ghost" id="lesson-home">返回闯关地图</button>' +
          '</div>' +
        '</div>';
      var self = this;
      Mascot.render($('result-mascot'), mood, 130);
      $('lesson-next').onclick = function () {
        if (hasNext) self.start(self.deck, self.unitIdx + 1);
        else self.quit();
      };
      $('lesson-home').onclick = function () { self.quit(); };
    },

    onKey: function (e) {
      if (!this.active) return false;
      if (this.phase === 'teach') {
        if (e.key === 'Enter' || e.key === ' ') {
          var n = $('teach-next');
          if (n) { n.click(); return true; }
        }
        return false;
      }
      if (this.showingFb) {
        if (e.key === 'Enter' || e.key === ' ') { this.next(); return true; }
        return false;
      }
      if (/^[1-4]$/.test(e.key)) {
        var opts = document.querySelectorAll('#view .option:not([disabled])');
        var i = +e.key - 1;
        if (opts[i]) { opts[i].click(); return true; }
      }
      if (e.key === 'p' || e.key === 'P') {
        var item = this.current();
        if (item) TTS.speak(item.entry.word);
        return true;
      }
      return false;
    }
  };

  window.Lesson = Lesson;
})();
