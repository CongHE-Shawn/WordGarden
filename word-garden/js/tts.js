/* tts.js — 发音：优先 Capacitor 原生 TTS（安卓），回退浏览器 speechSynthesis + WebAudio 音效 */
(function () {
  var voiceCache = null;

  /* Capacitor 原生 TTS（安卓 APK 环境）：window.Capacitor.Plugins.TextToSpeech */
  function capTTS() {
    try {
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TextToSpeech) {
        return window.Capacitor.Plugins.TextToSpeech;
      }
    } catch (e) {}
    return null;
  }

  function pickVoice() {
    if (voiceCache !== null) return voiceCache;
    var wanted = (Store.state && Store.state.settings.ttsVoice) || '';
    var voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    var v = null;
    if (wanted) v = voices.filter(function (x) { return x.name === wanted; })[0] || null;
    if (!v) v = voices.filter(function (x) { return /^en[-_]/i.test(x.lang) && /US/i.test(x.lang); })[0]
      || voices.filter(function (x) { return /^en[-_]/i.test(x.lang); })[0] || null;
    voiceCache = v;
    return v;
  }
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = function () { voiceCache = null; };

  var TTS = {
    /* available：安卓用原生 TTS，浏览器用 speechSynthesis */
    available: function () {
      return !!(capTTS() || window.speechSynthesis);
    },

    speak: function (text, rate) {
      var cap = capTTS();
      if (cap) {
        /* 安卓：调用系统 TTS 引擎 */
        try {
          cap.stop();
          cap.speak({
            text: text,
            lang: 'en-US',
            rate: rate || (Store.state ? Store.state.settings.ttsRate : 1),
            pitch: 1.0
          }).catch(function () {});
        } catch (e) {}
        return;
      }
      if (!window.speechSynthesis) return;
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = rate || (Store.state ? Store.state.settings.ttsRate : 1);
      var v = pickVoice();
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    },

    voices: function () {
      return (window.speechSynthesis ? speechSynthesis.getVoices() : []).filter(function (v) {
        return /^en[-_]/i.test(v.lang);
      });
    },

    /* 轻量音效：correct / wrong / flip / done */
    beep: function (type) {
      if (!Store.state || !Store.state.settings.soundFx) return;
      try {
        var ctx = TTS._ctx || (TTS._ctx = new (window.AudioContext || window.webkitAudioContext)());
        if (ctx.state === 'suspended') ctx.resume();
        var seqs = {
          correct: [[523, 0, 0.09], [659, 0.09, 0.09], [784, 0.18, 0.14]],
          wrong:   [[220, 0, 0.15], [174, 0.15, 0.22]],
          flip:    [[440, 0, 0.05]],
          done:    [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1047, 0.3, 0.25]]
        };
        (seqs[type] || []).forEach(function (s) {
          var o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'sine'; o.frequency.value = s[0];
          g.gain.setValueAtTime(0.0001, ctx.currentTime + s[1]);
          g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + s[1] + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + s[1] + s[2]);
          o.connect(g); g.connect(ctx.destination);
          o.start(ctx.currentTime + s[1]); o.stop(ctx.currentTime + s[1] + s[2] + 0.05);
        });
      } catch (e) {}
    }
  };

  window.TTS = TTS;
})();
