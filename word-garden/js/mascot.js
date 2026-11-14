/* mascot.js — 「旺仔」吉祥物系统 v3
 *
 * 一只神气的柴犬小狗（橙色），纯 SVG + CSS 动画。
 * 面向初中生：表情更鲜活、动作更夸张、加了帽子/眼镜/书本等道具和彩带特效。
 *
 * 表情（14 种）：
 *   idle    待机（眨眼 + 呼吸）
 *   happy   开心（跳一下 + 眯眼笑）
 *   cheer   庆祝（大幅跳跃 + 撒花 + 彩带）
 *   sad     沮丧（蔫头 + 冒汗 + 泪滴）
 *   think   思考（歪头 + 问号）
 *   teach   讲解（举书本 + 眼镜反光）
 *   sleepy  困倦（打哈欠 + Zzz）
 *   proud   骄傲（挺胸 + 皇冠）
 *   wink    眨眼俏皮（单眼眨 + 手指比耶）
 *   wow     惊讶（瞪大眼 + 感叹号）
 *   focus   专注（严肃 + 汗珠）
 *   love    喜爱（爱心眼 + 冒爱心）
 *   dizzy   眩晕（螺旋眼）
 *   power   加油（握拳 + 火焰）
 */
(function () {
  /* ---------- 眼睛 ---------- */
  var EYES = {
    idle:   '<ellipse cx="0" cy="0" rx="8" ry="8" fill="#3a2a1e"/><circle cx="3" cy="-2.5" r="2.8" fill="#fff"/><circle cx="4" cy="-3.5" r="1.2" fill="#fff" opacity=".9"/>',
    happy:  '<path d="M-8 2 Q0 -7 8 2" stroke="#3a2a1e" stroke-width="4.5" fill="none" stroke-linecap="round"/>',
    cheer:  '<path d="M-8 2 Q0 -7 8 2" stroke="#3a2a1e" stroke-width="4.5" fill="none" stroke-linecap="round"/>',
    sad:    '<ellipse cx="0" cy="0" rx="6.5" ry="7.5" fill="#3a2a1e"/><circle cx="2.5" cy="-1.5" r="2.2" fill="#fff"/><path d="M-8 9 Q0 4 8 9" stroke="#3a2a1e" stroke-width="2" fill="none" opacity=".4"/>',
    think:  '<ellipse cx="0" cy="0" rx="6.5" ry="8" fill="#3a2a1e"/><circle cx="2.5" cy="-2.5" r="2.2" fill="#fff"/>',
    teach:  '<ellipse cx="0" cy="0" rx="7" ry="8" fill="#3a2a1e"/><circle cx="2.5" cy="-3" r="2.6" fill="#fff"/>',
    sleepy: '<path d="M-8 0 Q0 3 8 0" stroke="#3a2a1e" stroke-width="4" fill="none" stroke-linecap="round"/>',
    proud:  '<ellipse cx="0" cy="0" rx="8" ry="8" fill="#3a2a1e"/><circle cx="3" cy="-2.5" r="2.8" fill="#fff"/>',
    wink:   '<ellipse cx="0" cy="0" rx="8" ry="8" fill="#3a2a1e"/><circle cx="3" cy="-2.5" r="2.8" fill="#fff"/>',
    wow:    '<ellipse cx="0" cy="0" rx="9" ry="10" fill="#3a2a1e"/><circle cx="0" cy="0" r="3.6" fill="#fff"/><circle cx="-1.5" cy="-1.5" r="1.4" fill="#fff" opacity=".9"/>',
    focus:  '<ellipse cx="0" cy="0" rx="6.5" ry="7.5" fill="#3a2a1e"/><circle cx="2.5" cy="-2.5" r="2.3" fill="#fff"/><path d="M-8 -6 L-13 -9" stroke="#3a2a1e" stroke-width="3" stroke-linecap="round"/>',
    love:   '<path d="M0 7 C-9 0 -7 -7 -2 -6 C0 -5.5 0 -4 0 -4 C0 -4 0 -5.5 2 -6 C7 -7 9 0 0 7Z" fill="#f06070"/>',
    dizzy:  '<path d="M0 0 m-6 0 a6 3 0 1 1 12 0 a6 3 0 1 1 -12 0" fill="none" stroke="#3a2a1e" stroke-width="2.6"/><path d="M-4 4 Q0 7 4 4" fill="none" stroke="#3a2a1e" stroke-width="2.4" stroke-linecap="round"/>',
    power:  '<path d="M-8 0 L-1 1 L0 -8 L4 2 L9 0" stroke="#3a2a1e" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
  };

  /* wink 的眯眼弧线（与睁眼对齐同一水平线） */
  var winkClose = '<path d="M-8 1 Q0 -6 8 1" stroke="#3a2a1e" stroke-width="4" fill="none" stroke-linecap="round"/>';

  /* ---------- 嘴 ---------- */
  var MOUTHS = {
    idle:   '<path d="M-5 0 Q0 6 5 0" stroke="#2f3b2e" stroke-width="3" fill="none" stroke-linecap="round"/>',
    happy:  '<path d="M-8 0 Q0 10 8 0 Z" fill="#f06050"/><path d="M-3.5 3.5 Q0 7 3.5 3.5" fill="#fff" opacity=".75"/>',
    cheer:  '<ellipse cx="0" cy="2" rx="9" ry="7.5" fill="#f06050"/><path d="M-4 4 Q0 7.5 4 4" fill="#ff8a9b" opacity=".8"/>',
    sad:    '<path d="M-6 2 Q0 -6 6 2" stroke="#2f3b2e" stroke-width="3" fill="none" stroke-linecap="round"/>',
    think:  '<circle cx="-6" cy="0" r="2.6" fill="#2f3b2e"/><path d="M-3 -1 Q3 -1 6 2" stroke="#2f3b2e" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".6"/>',
    teach:  '<ellipse cx="0" cy="0" rx="5" ry="4" fill="#f06050"/><path d="M-5 -1 Q0 -4 5 -1" fill="#c9564a" opacity=".5"/>',
    sleepy: '<ellipse cx="0" cy="1" rx="4.5" ry="3.5" fill="#2f3b2e"/><ellipse cx="-1" cy="0" rx="2" ry="1.4" fill="#7a8a72"/>',
    proud:  '<path d="M-6 0 Q0 6 6 0" stroke="#2f3b2e" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
    wink:   '<path d="M-6 0 Q0 8 6 0 Z" fill="#f06050"/><path d="M-3 3 Q0 5.5 3 3" fill="#fff" opacity=".75"/>',
    wow:    '<ellipse cx="0" cy="1" rx="4.5" ry="5.5" fill="#f06050"/>',
    focus:  '<path d="M-5 0 Q0 4 5 0" stroke="#2f3b2e" stroke-width="3" fill="none" stroke-linecap="round"/>',
    love:   '<path d="M-6 0 Q0 8 6 0 Z" fill="#f06050"/>',
    dizzy:  '<path d="M-5 1 Q0 -3 5 1" stroke="#2f3b2e" stroke-width="2.8" fill="none" stroke-linecap="round"/>',
    power:  '<path d="M-7 0 Q0 9 7 0 Q0 3 -7 0Z" fill="#f06050"/>'
  };

  /* ---------- 腮红 ---------- */
  function blush(op) {
    if (!op) return '';
    return '<ellipse cx="0" cy="0" rx="6" ry="3.5" fill="#f5a082" opacity="' + op + '"/>';
  }

  /* ---------- 配件（按表情） ---------- */
  function accessories(mood) {
    var out = '';

    // 眼镜（讲解 / 专注）：translate 到两眼中心
    if (mood === 'teach' || mood === 'focus') {
      out += '<g class="mg-glasses" transform="translate(85 64)" stroke="#4a5a45" stroke-width="2.4" fill="none" opacity=".9">' +
        '<circle cx="-21" cy="0" r="11"/><circle cx="21" cy="0" r="11"/><path d="M-10 0 H10"/></g>';
      if (mood === 'teach') {
        out += '<path class="mg-glare" d="M59 58 l10 -6" stroke="#fff" stroke-width="3" opacity=".75" stroke-linecap="round"/>';
      }
    }

    // 皇冠（骄傲）
    if (mood === 'proud') {
      out += '<g class="mg-crown" fill="#ffc800" stroke="#e0a800" stroke-width="1.6">' +
        '<path d="M60 30 L66 14 L74 26 L84 10 L94 26 L102 14 L108 30 Z"/></g>' +
        '<circle cx="84" cy="12" r="3" fill="#f06050"/>';
    }

    // 学士帽（讲解）
    if (mood === 'teach') {
      out += '<g class="mg-cap"><path d="M52 30 L84 12 L116 30 L84 46 Z" fill="#3f5a8a"/>' +
        '<path d="M110 32 L110 48" stroke="#ffc800" stroke-width="3" fill="none"/>' +
        '<circle cx="110" cy="50" r="3.5" fill="#ffc800"/></g>';
    }

    // 问号（思考）
    if (mood === 'think') {
      out += '<g class="mg-question" fill="#58cc02" font-weight="900" font-size="34">' +
        '<text x="122" y="40">?</text></g>';
    }

    // 感叹号（惊讶）
    if (mood === 'wow') {
      out += '<g class="mg-bang" fill="#ffc800" font-weight="900" font-size="36">' +
        '<text x="122" y="38">!</text></g>';
    }

    // 汗珠（专注）：额头右侧
    if (mood === 'focus') {
      out += '<path class="mg-sweat" d="M120 44 q5 8 0 13 q-5 -5 0 -13Z" fill="#1cb0f6" opacity=".85"/>';
    }

    // 泪滴（沮丧）：左眼下方
    if (mood === 'sad') {
      out += '<path class="mg-tear" d="M58 82 q3 6 0 9 q-3 -3 0 -9Z" fill="#1cb0f6" opacity=".8"/>';
    }

    // 爱心（喜爱）
    if (mood === 'love') {
      out += '<g class="mg-hearts" fill="#f06070" opacity=".9">' +
        '<path d="M128 30 c-6 -7 -14 0 -8 6 c4 4 8 6 8 6 s4 -2 8 -6 c6 -6 -2 -13 -8 -6Z" transform="scale(.55) translate(100 10)"/>' +
        '<path d="M112 52 c-5 -6 -12 0 -7 5 c3 4 7 5 7 5 s4 -1 7 -5 c5 -5 -2 -11 -7 -5Z" transform="scale(.4) translate(120 30)"/></g>';
    }

    // Zzz（困倦）
    if (mood === 'sleepy') {
      out += '<g class="mg-zzz" fill="#9aa892" font-weight="900">' +
        '<text x="116" y="34" font-size="17">Z</text>' +
        '<text x="130" y="20" font-size="13">z</text>' +
        '<text x="141" y="9" font-size="10">z</text></g>';
    }

    // 书本（讲解时手持）
    if (mood === 'teach') {
      out += '<g class="mg-book"><path d="M96 108 L118 102 L118 124 L96 118 Z" fill="#ffc800" stroke="#e0a800" stroke-width="1.6"/>' +
        '<path d="M118 102 L136 108 L136 124 L118 118 Z" fill="#fff3c4" stroke="#e0a800" stroke-width="1.6"/>' +
        '<path d="M118 102 L118 118" stroke="#e0a800" stroke-width="1.4"/></g>';
    }

    // 火焰（加油）
    if (mood === 'power') {
      out += '<g class="mg-flame"><path d="M46 112 c-4 -10 4 -14 6 -22 c2 8 8 6 8 14 c0 8 -6 12 -9 12 c-3 0 -5 -2 -5 -4Z" fill="#ff9600"/>' +
        '<path d="M49 111 c-2 -5 3 -7 4 -11 c1 4 4 3 4 7 c0 4 -3 6 -5 6 c-2 0 -3 -1 -3 -2Z" fill="#ffc800"/></g>';
    }

    // 彩带（庆祝）
    if (mood === 'cheer') {
      out += '<g class="mg-confetti">' +
        '<rect x="14" y="18" width="6" height="10" rx="2" fill="#f06050" transform="rotate(-24 17 23)"/>' +
        '<rect x="130" y="30" width="6" height="10" rx="2" fill="#1cb0f6" transform="rotate(32 133 35)"/>' +
        '<rect x="30" y="4" width="5" height="9" rx="2" fill="#ffc800" transform="rotate(40 32 8)"/>' +
        '<rect x="146" y="8" width="5" height="9" rx="2" fill="#ce82ff" transform="rotate(-35 148 12)"/>' +
        '<circle cx="22" cy="48" r="3.5" fill="#17c8a3"/>' +
        '<circle cx="140" cy="62" r="3.5" fill="#ff9600"/></g>';
    }

    // 星星（开心 / 骄傲）
    if (mood === 'happy' || mood === 'proud' || mood === 'power') {
      out += '<g class="mg-spark" fill="#ffc800">' +
        '<path d="M122 22 l3.4 7.6 8 1 -6 5.6 1.6 8 -7 -4.2 -7 4.2 1.6 -8 -6 -5.6 8 -1Z"/>' +
        '<path d="M142 46 l2.4 5.4 5.6.8 -4.2 4 1.1 5.6 -4.9 -3 -4.9 3 1.1 -5.6 -4.2 -4 5.6-.8Z"/></g>';
    }

    return out;
  }

  /* ---------- 组合 SVG（小狗柴犬造型） ---------- */
  function build(mood, size) {
    var eyes = EYES[mood] || EYES.idle;
    var mouth = MOUTHS[mood] || MOUTHS.idle;
    var bl = mood === 'happy' || mood === 'cheer' || mood === 'proud' || mood === 'wink' || mood === 'love'
      ? '.6'
      : (mood === 'wow' ? '.4' : '');

    return '<svg class="mascot mascot-' + mood + '" viewBox="0 0 170 165" width="' + (size || 150) + '" height="' + (size || 150) + '" aria-label="旺仔吉祥物">' +
      '<g class="mg-whole">' +
      '<ellipse cx="85" cy="154" rx="46" ry="7" fill="rgba(0,0,0,.10)" class="mg-shadow"/>' +
      // 尾巴（卷尾，画在身体后面）
      '<g class="mg-tail">' +
        '<path d="M104 140 C124 134 134 120 124 110 C118 104 108 106 105 116" fill="none" stroke="#e8913f" stroke-width="10" stroke-linecap="round"/>' +
        '<path d="M124 110 C128 104 124 98 118 99 C113 100 111 105 114 109" fill="#fbe8d3" stroke="none"/>' +
      '</g>' +
      // 身体
      '<g class="mg-body">' +
        '<path d="M85 114 C58 114 50 128 50 146 C50 159 62 165 85 165 C108 165 120 159 120 146 C120 128 112 114 85 114 Z" fill="#e8913f" stroke="#c9712a" stroke-width="3"/>' +
        '<path d="M85 132 C69 132 62 142 62 151 C62 158 70 162 85 162 C100 162 108 158 108 151 C108 142 101 132 85 132 Z" fill="#fbe8d3"/>' +
      '</g>' +
      // 耳朵（两竖耳，在头后面）
      '<g class="mg-ears">' +
        '<path d="M54 44 L38 12 Q52 16 64 34 Z" fill="#d9822f" stroke="#c9712a" stroke-width="3"/>' +
        '<path d="M116 44 L132 12 Q118 16 106 34 Z" fill="#d9822f" stroke="#c9712a" stroke-width="3"/>' +
        '<path d="M52 40 L42 18 Q52 21 60 34 Z" fill="#f7c99a"/>' +
        '<path d="M118 40 L128 18 Q118 21 110 34 Z" fill="#f7c99a"/>' +
      '</g>' +
      // 头
      '<g class="mg-head">' +
        '<path class="mg-head-shape" d="M85 28 C48 28 34 56 34 82 C34 105 58 117 85 117 C112 117 136 105 136 82 C136 56 122 28 85 28 Z" fill="#e8913f" stroke="#c9712a" stroke-width="3.4"/>' +
        // 脸部白色口鼻区（简洁对称，覆盖下半脸）
        '<path d="M85 66 C66 66 52 76 52 92 C52 110 66 117 85 117 C104 117 118 110 118 92 C118 76 104 66 85 66 Z" fill="#fbe8d3"/>' +
        // 鼻梁一小块白色（从额头连到口鼻区）
        '<path d="M79 50 Q85 46 91 50 L91 68 Q85 72 79 68 Z" fill="#fbe8d3" opacity=".85"/>' +
        // 鼻子（倒三角，柴犬标志）
        '<path d="M85 74 C79 74 75 79 77 84 L93 84 C95 79 91 74 85 74 Z" fill="#4a3a30"/>' +
        '<ellipse cx="85" cy="78" rx="2.4" ry="1.8" fill="#8a6a55" opacity=".7"/>' +
        // 从鼻子向下的中缝
        '<path d="M85 84 L85 92" stroke="#c9712a" stroke-width="2.4" stroke-linecap="round"/>' +
        // 嘴（在中缝底部）
        '<g transform="translate(85 96)">' + mouth + '</g>' +
        // 眼睛（横椭圆，正常眼神，位置在白色区上方边界）
        // wink 特殊：左眼睁、右眼眯（单眼眨）
        '<g transform="translate(64 64)" class="mg-eye">' + (mood === 'wink' ? EYES.idle : eyes) + '</g>' +
        '<g transform="translate(106 64)" class="mg-eye">' + (mood === 'wink' ? winkClose : eyes) + '</g>' +
        // 腮红（脸两侧，眼睛斜下方）
        '<g transform="translate(58 80)">' + blush(bl) + '</g>' +
        '<g transform="translate(112 80)">' + blush(bl) + '</g>' +
      '</g>' +
      accessories(mood) +
      '</g>' +
    '</svg>';
  }

  var Mascot = {
    moods: Object.keys(EYES),

    render: function (container, mood, size) {
      if (!container) return;
      container.innerHTML = build(mood || 'idle', size);
    },

    /* 切换表情（带过渡动画） */
    setMood: function (mood) {
      var els = document.querySelectorAll('.mascot');
      Array.prototype.forEach.call(els, function (el) {
        var cur = Array.prototype.filter.call(el.classList, function (c) { return c.indexOf('mascot-') === 0; })[0];
        if (cur) el.classList.remove(cur);
        // 强制重排以重启动画
        void el.offsetWidth;
        el.classList.add('mascot-' + mood);
      });
    },

    /* 随机换一个同档位表情（让表现更生动） */
    randomMood: function (mood) {
      var pool = {
        idle: ['idle', 'idle', 'wink', 'think'],
        happy: ['happy', 'wink', 'proud', 'cheer'],
        cheer: ['cheer', 'proud', 'power'],
        sad: ['sad', 'dizzy', 'think'],
        think: ['think', 'dizzy', 'focus'],
        teach: ['teach', 'focus', 'happy'],
        sleepy: ['sleepy', 'idle'],
        wrong: ['sad', 'dizzy', 'think']
      };
      var arr = pool[mood] || [mood];
      return arr[Math.floor(Math.random() * arr.length)];
    },

    /* 语录：初中生口吻，更活泼 */
    say: function (mood) {
      var lines = {
        idle:   ['今天也要冲鸭！💪', '旺仔在花园里等你开卷啦～', '已就位，随时开练！', '今天的单词在向你招手哦 👋'],
        happy:  ['Nice！就是这感觉！', '答对啦！旺仔给你点赞 👍', '稳住，我们能赢！', '这波操作很可以诶 ✨'],
        cheer:  ['绝了！直接起飞 🚀', '全对！你是单词大神吧 🏆', '这也太强了！撒花撒花 🎉', '刷屏了刷屏了！'],
        sad:    ['没事儿，错一次就多记一分 📈', '别慌，旺仔陪你再来一遍～', '这词有点狡猾，记下来就好 🔒', '错题本已帮你记好啦 📕'],
        think:  ['嗯……让我想想这个词 🤔', '别急，多看两眼就记住了', '词根记不牢的话，我们拆开看～'],
        teach:  ['来，跟我念一遍这个音标 🗣️', '这个词藏在例句里哦 👀', '注意这里是个多音节词！', '学会它，你比同桌强一截 😎'],
        sleepy: ['困了？休息五分钟再战 ☕', '今天也辛苦啦，早点睡～', '打哈欠…明天继续也行啦 💤'],
        proud:  ['这个词你彻底拿下啦 👑', '旺仔对你刮目相看！', '继续保持，中考稳了 💪'],
        wink:   ['嘿嘿，被你发现我在偷看你 👀', '给你比个心心 ❤️', '低调低调，一般人我不夸 😏'],
        wow:    ['哇哦！这个词很厉害！', '记住这个，答对率飙升 📈'],
        focus:  ['集中注意力，你能行 💪', '这一题拿下它！'],
        love:   ['好词！我们一起记住它 ❤️', '这个词超好用，学会超加分！'],
        dizzy:  ['脑袋有点晕…再来一次吧 🌀', '有点绕，慢慢来～'],
        power:  ['冲刺！就差你这一下了 🔥', '这口气拿下，稳了！'],
        wrong:  ['这个我们记到小本本上啦 📕', '别灰心！错题是宝藏 💎']
      };
      var arr = lines[mood] || lines.idle;
      return arr[Math.floor(Math.random() * arr.length)];
    }
  };

  window.Mascot = Mascot;
})();
