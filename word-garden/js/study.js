/* study.js — 学习会话：卡片记忆 / 拼写练习 / 听力辨词 / 语境选词 / 模拟测试 */
(function () {
  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function area() { return document.getElementById('study-area'); }
  function actionbar() { return document.getElementById('actionbar'); }

  var Study = {
    deck: 'qishang', mode: 'cards', queue: [], idx: 0,
    flipped: false, answered: false, startTime: 0, results: { right: 0, wrong: 0 },
    sessionStats: { right: 0, wrong: 0 },

    /* ---------- 队列构建 ---------- */
    buildQueue: function (deckId, size) {
      var words = Data.words(deckId);
      var due = [], focus = [], fresh = [];
      var lvl = Store.state.user.startLevel || 1;
      words.forEach(function (rec) {
        var p = Store.peekWord(deckId, rec.w);
        if (!p) { if (Math.abs((rec.lv || 3) - lvl) <= 1 || fresh.length < 400) fresh.push(rec); }
        else if (SRS.isDue(p)) due.push(rec);
        else if (SRS.inFocusPool(p)) focus.push(rec);
      });
      due.sort(function (a, b) { return Store.peekWord(deckId, a.w).next - Store.peekWord(deckId, b.w).next; });
      fresh.sort(function (a, b) { return (a.lv - b.lv); });
      var remaining = Math.max(0, Store.state.settings.dailyGoal - Store.todayProgress());
      var q = due.slice(0, 30).concat(focus.slice(0, 10)).concat(fresh.slice(0, Math.min(20, Math.max(10, remaining))));
      return q.slice(0, size || 40);
    },

    start: function (deckId, mode) {
      var self = this;
      if (window.Lesson) Lesson.active = false;
      Data.loadDeck(deckId).then(function () {
        self.deck = deckId; self.mode = mode;
        self.queue = self.buildQueue(deckId);
        self.idx = 0; self.flipped = false; self.answered = false;
        self.results = { right: 0, wrong: 0 };
        self.startTime = Date.now();
        var sbar = document.getElementById('session-bar');
        if (sbar) sbar.classList.remove('hidden');
        if (!self.queue.length) { self.renderEmpty(); return; }
        self.render();
        self.syncActionbar();
      });
    },

    current: function () { return this.queue[this.idx]; },

    /* ---------- 渲染分发 ---------- */
    render: function () {
      this.flipped = false; this.answered = false;
      if (this.idx >= this.queue.length) { this.renderSummary(); return; }
      var rec = this.current();
      if (this.mode === 'cards') this.renderCard(rec);
      else if (this.mode === 'spelling') this.renderSpelling(rec);
      else if (this.mode === 'listening') this.renderListening(rec);
      else if (this.mode === 'cloze') this.renderCloze(rec);
      this.syncActionbar();
      this.renderProgress();
    },

    renderProgress: function () {
      var bar = document.getElementById('session-progress');
      if (bar) {
        bar.style.width = (this.idx / this.queue.length * 100) + '%';
        bar.parentElement.title = (this.idx + 1) + ' / ' + this.queue.length;
      }
      var label = document.getElementById('session-label');
      if (label) label.textContent = Math.min(this.idx + 1, this.queue.length) + ' / ' + this.queue.length;
    },

    /* ---------- 模式1：卡片记忆 ---------- */
    renderCard: function (rec) {
      var p = Store.peekWord(this.deck, rec.w);
      var ex = Data.exampleFor(rec);
      var syn = Data.synonyms(rec);
      var exchange = Data.exchangeText(rec.ex);
      var html =
        '<div class="flip-card" id="flipcard" title="点击翻转（空格）">' +
          '<div class="flip-inner">' +
            '<div class="flip-face flip-front">' +
              '<div class="card-word">' + esc(rec.w) + '</div>' +
              '<button class="pronounce-btn" id="btn-pron" title="发音（P）">🔊</button>' +
              '<div class="card-hint">点击卡片查看释义</div>' +
              (p && p.status !== 'new' ? '<div class="card-badge">' + this.statusBadge(p) + '</div>' : '') +
            '</div>' +
            '<div class="flip-face flip-back">' +
              '<div class="card-word small">' + esc(rec.w) + ' <button class="pronounce-btn sm" id="btn-pron2">🔊</button></div>' +
              (rec.p ? '<div class="card-phonetic">/' + esc(rec.p) + '/</div>' : '') +
              '<div class="card-meaning">' + esc(rec.t) + '</div>' +
              '<div class="card-example">' + Data.highlight(esc(ex.en), rec.w) + '</div>' +
              (ex.cn ? '<div class="card-example-cn">' + esc(ex.cn) + '</div>' : '') +
              (syn.length ? '<div class="card-syn"><span class="tag">近义词</span>' + syn.map(function (s) { return '<i>' + esc(s) + '</i>'; }).join('') + '</div>' : '') +
              (exchange ? '<div class="card-exchange">' + esc(exchange) + '</div>' : '') +
              (p && p.last ? '<div class="card-next">下次复习：' + SRS.nextText(p) + '</div>' : '') +
            '</div>' +
          '</div>' +
        '</div>';
      var a = area(); a.innerHTML = ''; a.appendChild(el(html));
      var card = document.getElementById('flipcard');
      card.addEventListener('click', function (e) {
        if (e.target.classList.contains('pronounce-btn')) return;
        Study.flip();
      });
      var pron = document.getElementById('btn-pron');
      if (pron) pron.onclick = function () { TTS.speak(rec.w); };
      var pron2 = document.getElementById('btn-pron2');
      if (pron2) pron2.onclick = function () { TTS.speak(rec.w); };
      if (Store.state.settings.autoPlay) setTimeout(function () { TTS.speak(rec.w); }, 350);
    },

    statusBadge: function (p) {
      var map = { learning: '🌱 学习中', review: '🌿 复习中', mastered: '🌸 已掌握' };
      return map[p.status] || '';
    },

    flip: function () {
      var card = document.getElementById('flipcard');
      if (!card) return;
      if (!this.flipped) TTS.beep('flip');
      this.flipped = !this.flipped;
      card.classList.toggle('flipped', this.flipped);
      this.syncActionbar();
    },

    /* ---------- 模式2：拼写练习 ---------- */
    renderSpelling: function (rec) {
      var hint = rec.w[0] + rec.w.slice(1).replace(/[a-z]/gi, ' _');
      var html =
        '<div class="quiz-card">' +
          '<div class="quiz-type">✏️ 拼写练习</div>' +
          '<div class="quiz-meaning">' + esc(rec.t) + '</div>' +
          (rec.p ? '<div class="card-phonetic">/' + esc(rec.p) + '/ <button class="pronounce-btn sm" id="q-pron">🔊</button></div>' : '<button class="pronounce-btn sm" id="q-pron">🔊 听发音</button>') +
          '<div class="spell-hint">' + esc(hint) + '</div>' +
          '<input id="spell-input" class="spell-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="输入完整单词，回车提交">' +
          '<div class="quiz-actions"><button class="btn ghost" id="spell-skip">不会 →</button></div>' +
          '<div class="quiz-feedback" id="quiz-fb"></div>' +
        '</div>';
      var a = area(); a.innerHTML = ''; a.appendChild(el(html));
      document.getElementById('q-pron').onclick = function () { TTS.speak(rec.w); };
      var input = document.getElementById('spell-input');
      setTimeout(function () { input.focus(); }, 50);
      var submit = function () {
        if (Study.answered) return;
        var v = input.value.trim().toLowerCase();
        if (!v) return;
        var ok = v === rec.w.toLowerCase();
        Study.answerQuiz(ok, ok ? '拼写正确！' : '正确拼写：<b>' + esc(rec.w) + '</b>', ok);
        input.disabled = true;
      };
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
      document.getElementById('spell-skip').onclick = function () {
        if (Study.answered) return;
        Study.answerQuiz(false, '正确拼写：<b>' + esc(rec.w) + '</b>', false);
        input.disabled = true;
      };
    },

    /* ---------- 模式3：听力辨词 ---------- */
    renderListening: function (rec) {
      var opts = shuffle([rec].concat(Data.distractors(this.deck, rec, 3)));
      var html =
        '<div class="quiz-card">' +
          '<div class="quiz-type">🎧 听力辨词</div>' +
          '<button class="listen-big" id="listen-play">▶<span>播放发音</span></button>' +
          '<div class="options" id="opts">' +
          opts.map(function (o, i) {
            return '<button class="option" data-w="' + esc(o.w) + '" data-i="' + i + '"><em>' + (i + 1) + '</em>' + esc(o.w) + '</button>';
          }).join('') +
          '</div>' +
          '<div class="quiz-feedback" id="quiz-fb"></div>' +
        '</div>';
      var a = area(); a.innerHTML = ''; a.appendChild(el(html));
      document.getElementById('listen-play').onclick = function () { TTS.speak(rec.w); };
      setTimeout(function () { TTS.speak(rec.w); }, 400);
      this._options = opts;
      this._answer = rec.w;
      this.bindOptions();
    },

    /* ---------- 模式4：语境选词 ---------- */
    renderCloze: function (rec) {
      var ex = Data.exampleFor(rec);
      var blanked;
      try {
        blanked = ex.en.replace(new RegExp(rec.w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '＿＿＿');
      } catch (e) { blanked = ex.en; }
      if (blanked === ex.en) blanked = '＿＿＿ — ' + ex.en;
      var opts = shuffle([rec].concat(Data.distractors(this.deck, rec, 3)));
      var html =
        '<div class="quiz-card">' +
          '<div class="quiz-type">📖 语境选词</div>' +
          '<div class="cloze-sentence">' + esc(blanked) + '</div>' +
          '<div class="cloze-cn">' + esc(ex.cn) + '</div>' +
          '<div class="options" id="opts">' +
          opts.map(function (o, i) {
            return '<button class="option" data-w="' + esc(o.w) + '" data-i="' + i + '"><em>' + (i + 1) + '</em>' + esc(o.w) + '</button>';
          }).join('') +
          '</div>' +
          '<div class="quiz-feedback" id="quiz-fb"></div>' +
        '</div>';
      var a = area(); a.innerHTML = ''; a.appendChild(el(html));
      this._options = opts;
      this._answer = rec.w;
      this.bindOptions();
    },

    bindOptions: function () {
      var btns = area().querySelectorAll('.option');
      btns.forEach(function (b) {
        b.onclick = function () {
          if (Study.answered) return;
          var ok = b.dataset.w === Study._answer;
          Study.answerQuiz(ok, ok ? '回答正确！' : '正确答案：<b>' + esc(Study._answer) + '</b>', ok, b);
        };
      });
    },

    /* ---------- 统一作答处理（测验模式） ---------- */
    answerQuiz: function (ok, fbHtml, isRight, btn) {
      this.answered = true;
      var rec = this.current();
      var isNew = !Store.peekWord(this.deck, rec.w);
      var p = Store.getWord(this.deck, rec.w);
      SRS.judge(p, ok ? 'know' : 'unknown');
      Store.record(this.deck, rec.w, ok, isNew);
      if (ok) { this.results.right++; TTS.beep('correct'); } else { this.results.wrong++; TTS.beep('wrong'); }
      var fb = document.getElementById('quiz-fb');
      if (fb) { fb.innerHTML = (ok ? '✅ ' : '❌ ') + fbHtml; fb.className = 'quiz-feedback show ' + (ok ? 'ok' : 'no'); }
      var opts = area().querySelectorAll('.option');
      opts.forEach(function (o) {
        o.disabled = true;
        if (o.dataset.w === Study._answer) o.classList.add('right');
        else if (btn && o === btn) o.classList.add('wrong');
      });
      App.updateProgressPill();
      var self = this;
      setTimeout(function () { self.next(); }, ok ? 900 : 1800);
    },

    /* ---------- 卡片模式评判 ---------- */
    judge: function (grade) {
      if (this.mode !== 'cards' || this.answered) return;
      if (!this.flipped) { this.flip(); return; }
      this.answered = true;
      var rec = this.current();
      var isNew = !Store.peekWord(this.deck, rec.w);
      var p = Store.getWord(this.deck, rec.w);
      SRS.judge(p, grade);
      var ok = grade === 'know';
      Store.record(this.deck, rec.w, ok, isNew);
      if (ok) { this.results.right++; TTS.beep('correct'); } else { this.results.wrong++; TTS.beep('wrong'); }
      var card = document.getElementById('flipcard');
      if (card) card.classList.add(grade === 'know' ? 'judge-ok' : (grade === 'vague' ? 'judge-mid' : 'judge-no'));
      App.updateProgressPill();
      var self = this;
      setTimeout(function () { self.next(); }, 450);
    },

    toggleFav: function () {
      var rec = this.current(); if (!rec) return;
      var p = Store.getWord(this.deck, rec.w);
      p.fav = !p.fav; Store.save(); this.syncActionbar();
      TTS.beep('flip');
    },
    toggleNotebook: function () {
      var rec = this.current(); if (!rec) return;
      var p = Store.getWord(this.deck, rec.w);
      p.nb = !p.nb; Store.save(); this.syncActionbar();
      TTS.beep('flip');
    },

    prev: function () {
      if (this.mode !== 'cards' || this.idx <= 0) return;
      this.idx--; this.render();
    },
    next: function () {
      this.idx++;
      if (this.idx >= this.queue.length) { this.renderSummary(); return; }
      this.render();
    },

    /* ---------- 底部操作栏状态 ---------- */
    syncActionbar: function () {
      var bar = actionbar();
      if (!bar) return;
      var active = this.queue.length > 0 && this.idx < this.queue.length;
      bar.classList.toggle('hidden', !(active && this.mode === 'cards'));
      if (!active || this.mode !== 'cards') return;
      var rec = this.current();
      var p = Store.peekWord(this.deck, rec.w);
      document.getElementById('act-fav').classList.toggle('on', !!(p && p.fav));
      document.getElementById('act-nb').classList.toggle('on', !!(p && p.nb));
      document.getElementById('act-prev').disabled = this.idx === 0;
      document.getElementById('act-next').disabled = false;
      var flipped = this.flipped;
      ['act-know', 'act-vague', 'act-unknown'].forEach(function (id) {
        var b = document.getElementById(id);
        b.classList.toggle('ready', flipped);
        b.title = flipped ? '' : '先点击卡片查看释义再评判';
      });
    },

    /* ---------- 空状态 ---------- */
    renderEmpty: function () {
      actionbar().classList.add('hidden');
      var sbar = document.getElementById('session-bar');
      if (sbar) sbar.classList.add('hidden');
      area().innerHTML =
        '<div class="empty-state">' +
          Views.SVG_EMPTY +
          '<h3>今天的花园一片祥和 🌿</h3>' +
          '<p>当前词库没有待复习的单词，新词额度也已用完。</p>' +
          '<div class="empty-actions">' +
            '<button class="btn primary" onclick="Study.forceNew()">继续学新词</button>' +
            '<button class="btn ghost" onclick="App.go(\'manage\')">去词库看看</button>' +
          '</div>' +
        '</div>';
    },

    forceNew: function () {
      var words = Data.words(this.deck);
      var self = this;
      var fresh = words.filter(function (rec) { return !Store.peekWord(self.deck, rec.w); });
      this.queue = fresh.slice(0, 20);
      this.idx = 0;
      if (!this.queue.length) {
        area().innerHTML = '<div class="empty-state">' + Views.SVG_EMPTY + '<h3>整个词库都学完了，恭喜！🎉</h3><p>可以在设置中切换其他词库继续挑战。</p></div>';
        return;
      }
      this.render();
    },

    /* ---------- 会话总结 ---------- */
    renderSummary: function () {
      actionbar().classList.add('hidden');
      var sbar = document.getElementById('session-bar');
      if (sbar) sbar.classList.add('hidden');
      var total = this.results.right + this.results.wrong;
      var acc = total ? Math.round(this.results.right / total * 100) : 0;
      var mins = Math.max(1, Math.round((Date.now() - this.startTime) / 60000));
      TTS.beep('done');
      area().innerHTML =
        '<div class="summary-card">' +
          '<div class="summary-emoji">🌸</div>' +
          '<h2>本组学习完成！</h2>' +
          '<div class="summary-stats">' +
            '<div><b>' + total + '</b><span>学习单词</span></div>' +
            '<div><b>' + acc + '%</b><span>正确率</span></div>' +
            '<div><b>' + mins + '</b><span>分钟</span></div>' +
          '</div>' +
          '<p class="summary-note">' + (acc >= 80 ? '花园又茂盛了一些，继续保持！' : '错词已放入重点池，明天记得回来复习。') + '</p>' +
          '<div class="empty-actions">' +
            '<button class="btn primary" onclick="Study.start(Study.deck, Study.mode)">再来一组</button>' +
            '<button class="btn ghost" onclick="Views.renderHome()">返回花园</button>' +
          '</div>' +
        '</div>';
      Views.renderGarden(document.getElementById('garden-box'));
    },

    onKey: function (e) {
      if (this.mode !== 'cards' || !this.queue.length) return false;
      if (e.key === '1') { this.judge('know'); return true; }
      if (e.key === '2') { this.judge('vague'); return true; }
      if (e.key === '3') { this.judge('unknown'); return true; }
      if (e.key === 'ArrowLeft') { this.prev(); return true; }
      if (e.key === 'ArrowRight') { this.next(); return true; }
      if (e.key === 'f' || e.key === 'F') { this.toggleFav(); return true; }
      if (e.key === 'b' || e.key === 'B') { this.toggleNotebook(); return true; }
      return false;
    }
  };

  /* ==================== 模拟测试 ==================== */
  var Test = {
    deck: 'qishang', questions: [], idx: 0, right: 0, timer: null, remain: 0, startTime: 0,

    start: function (deckId, n) {
      n = n || 20;
      var self = this;
      if (window.Lesson) Lesson.active = false;
      Data.loadDeck(deckId).then(function () {
        var words = Data.words(deckId);
        var seen = [], fresh = [];
        words.forEach(function (rec) {
          var p = Store.peekWord(deckId, rec.w);
          if (p && p.last > 0) seen.push(rec); else fresh.push(rec);
        });
        shuffle(seen); shuffle(fresh);
        var picked = seen.slice(0, Math.ceil(n / 2)).concat(fresh.slice(0, n - Math.ceil(n / 2))).slice(0, n);
        if (picked.length < 4) { picked = words.slice(0, Math.min(n, words.length)); }
        self.deck = deckId;
        self.questions = shuffle(picked).map(function (rec, i) {
          var type = ['meaning', 'zh2en', 'spelling', 'listen'][i % 4];
          return { rec: rec, type: type, answer: null, correct: null };
        });
        self.idx = 0; self.right = 0;
        self.remain = self.questions.length * 15;
        self.startTime = Date.now();
        self.render();
        self.tick();
      });
    },

    tick: function () {
      var self = this;
      clearInterval(this.timer);
      this.timer = setInterval(function () {
        self.remain--;
        var t = document.getElementById('test-timer');
        if (t) {
          var m = Math.floor(Math.max(0, self.remain) / 60), s = Math.max(0, self.remain) % 60;
          t.textContent = '⏱ ' + m + ':' + String(s).padStart(2, '0');
          t.classList.toggle('danger', self.remain <= 30);
        }
        if (self.remain <= 0) self.finish();
      }, 1000);
    },

    render: function () {
      if (this.idx >= this.questions.length) { this.finish(); return; }
      var q = this.questions[this.idx], rec = q.rec;
      var optsHtml = '';
      if (q.type === 'meaning' || q.type === 'listen') {
        var opts = shuffle([rec].concat(Data.distractors(this.deck, rec, 3)));
        q._options = opts.map(function (o) { return o.w; });
        var stem = q.type === 'listen'
          ? '<button class="listen-big" id="t-listen">▶<span>播放发音</span></button>'
          : '<div class="test-word">' + esc(rec.w) + '</div>';
        optsHtml = '<div class="options">' + opts.map(function (o, i) {
          return '<button class="option t-opt" data-v="' + esc(o.w) + '"><em>' + (i + 1) + '</em>' + esc(Data.gloss(o.t)) + '</button>';
        }).join('') + '</div>';
        q.stemHtml = stem;
        q.check = function (v) { return v === rec.w; };
      } else if (q.type === 'zh2en') {
        var opts2 = shuffle([rec].concat(Data.distractors(this.deck, rec, 3)));
        optsHtml = '<div class="options">' + opts2.map(function (o, i) {
          return '<button class="option t-opt" data-v="' + esc(o.w) + '"><em>' + (i + 1) + '</em>' + esc(o.w) + '</button>';
        }).join('') + '</div>';
        q.stemHtml = '<div class="test-word zh">' + esc(Data.gloss(rec.t)) + '</div>';
        q.check = function (v) { return v === rec.w; };
      } else {
        optsHtml = '<input id="t-spell" class="spell-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="输入单词后回车">';
        q.stemHtml = '<div class="test-word zh">' + esc(Data.gloss(rec.t)) + '</div>' + (rec.p ? '<div class="card-phonetic">/' + esc(rec.p) + '/</div>' : '');
        q.check = function (v) { return v.trim().toLowerCase() === rec.w.toLowerCase(); };
      }
      area().innerHTML =
        '<div class="quiz-card test">' +
          '<div class="test-head"><span id="test-timer">⏱</span><span>第 ' + (this.idx + 1) + ' / ' + this.questions.length + ' 题</span>' +
          '<button class="btn ghost sm" id="t-quit">交卷</button></div>' +
          q.stemHtml + optsHtml +
        '</div>';
      actionbar().classList.add('hidden');
      var self = this;
      if (q.type === 'listen') {
        document.getElementById('t-listen').onclick = function () { TTS.speak(rec.w); };
        setTimeout(function () { TTS.speak(rec.w); }, 400);
      }
      document.getElementById('t-quit').onclick = function () { self.finish(); };
      var opts2 = area().querySelectorAll('.t-opt');
      opts2.forEach(function (b) {
        b.onclick = function () { self.answer(b.dataset.v); };
      });
      var sp = document.getElementById('t-spell');
      if (sp) {
        setTimeout(function () { sp.focus(); }, 50);
        sp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && sp.value.trim()) self.answer(sp.value); });
      }
    },

    answer: function (v) {
      var q = this.questions[this.idx];
      q.answer = v;
      q.correct = q.check(v);
      if (q.correct) this.right++;
      this.idx++;
      this.render();
    },

    finish: function () {
      clearInterval(this.timer);
      var total = this.questions.length;
      var sec = Math.round((Date.now() - this.startTime) / 1000);
      var acc = total ? Math.round(this.right / total * 100) : 0;
      // 错题入生词本 + SRS 记录
      var self = this;
      this.questions.forEach(function (q) {
        var p = Store.getWord(self.deck, q.rec.w);
        SRS.judge(p, q.correct ? 'know' : 'unknown');
        if (!q.correct) p.nb = true;
      });
      Store.state.tests.push({ ts: Date.now(), deck: this.deck, total: total, right: this.right, sec: sec });
      Store.save();
      App.updateProgressPill();
      var rows = this.questions.map(function (q, i) {
        return '<div class="test-row ' + (q.correct ? 'ok' : 'no') + '">' +
          '<span class="t-no">' + (i + 1) + '</span>' +
          '<b>' + esc(q.rec.w) + '</b>' +
          '<span class="t-gloss">' + esc(Data.gloss(q.rec.t)) + '</span>' +
          '<span class="t-mark">' + (q.correct ? '✓' : '✗') + '</span></div>';
      }).join('');
      area().innerHTML =
        '<div class="summary-card test-result">' +
          '<div class="summary-emoji">' + (acc >= 80 ? '🏆' : acc >= 60 ? '🌷' : '🌱') + '</div>' +
          '<h2>测试结算</h2>' +
          '<div class="summary-stats">' +
            '<div><b>' + this.right + '/' + total + '</b><span>答对</span></div>' +
            '<div><b>' + acc + '%</b><span>正确率</span></div>' +
            '<div><b>' + Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0') + '</b><span>用时</span></div>' +
          '</div>' +
          '<p class="summary-note">错题已自动加入生词本，可在词库管理中查看。</p>' +
          '<div class="test-rows">' + rows + '</div>' +
          '<div class="empty-actions">' +
            '<button class="btn primary" onclick="Test.start(Test.deck)">再测一次</button>' +
            '<button class="btn ghost" onclick="Views.renderHome()">返回花园</button>' +
          '</div>' +
        '</div>';
    }
  };

  window.Study = Study;
  window.Test = Test;
})();
