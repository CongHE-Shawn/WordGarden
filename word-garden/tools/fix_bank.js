/* fix_bank.js —— 用真实词典数据修复旧题库的内容级问题
 *
 * 修复策略（针对 quality_check2 检出的问题）：
 *   E1 自造词干扰项   → 从词典选真实词替换
 *   E2 词形送分       → 剔除与答案同族的干扰项，补真实词
 *   E3 多解           → 剔除互为屈折形式的选项
 *   E10 pos 双解      → pos 题答案改用词典 exchange 真实词形，干扰项用真实派生词
 *   E5 syn 描述式短语 → 从词典/近义映射换成单词型近义词（需人工映射表兜底）
 *   E8 题干不一致     → 统一 zh2en stem = 词条 gloss
 *
 * 生成一个新题库目录 data/questions2/，不改动原文件，便于对比回退。
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'questions');
const DST = path.join(ROOT, 'data', 'questions2');

/* ---------- 词典 ---------- */
const raw = fs.readFileSync(path.join(ROOT, 'data', 'ecdict.csv'), 'utf8');
const DICT = new Map();
{
  let i = 0;
  while (i < raw.length) {
    const nl = raw.indexOf('\n', i);
    const line = raw.slice(i, nl < 0 ? raw.length : nl);
    i = nl < 0 ? raw.length : nl + 1;
    if (!line || line.charCodeAt(0) === 35) continue;
    const f = []; let cur = '', q = false;
    for (let k = 0; k < line.length && f.length < 13; k++) {
      const c = line[k];
      if (q) { if (c === '"') { if (line[k + 1] === '"') { cur += '"'; k++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',') { f.push(cur); cur = ''; }
      else cur += c;
    }
    f.push(cur);
    const w = (f[0] || '').trim().toLowerCase();
    if (!w) continue;
    let r = DICT.get(w);
    if (!r) { r = { ex: new Map(), trans: f[3] || '', pos: f[4] || '', frq: 0 }; DICT.set(w, r); }
    if (f[3]) r.trans = f[3];
    if (f[4]) r.pos = f[4];
    if (f[9]) { const v = parseInt(f[9]); if (!isNaN(v)) r.frq = v; }
    if (f[10]) f[10].split('/').forEach(p => { const m = p.split(':'); if (m.length === 2 && !/^[01]$/.test(m[0])) r.ex.set(m[0], m[1].split(',')[0]); });
  }
}
const has = w => DICT.has(String(w).trim().toLowerCase());
const get = w => DICT.get(String(w).trim().toLowerCase());

/* 预构建反向索引：词形 → 原形集合（一次遍历，避免 O(n) 反查） */
const FORM2LEMMA = new Map();
for (const [w, r] of DICT) {
  for (const [, form] of r.ex) {
    const fk = form.toLowerCase();
    let set = FORM2LEMMA.get(fk);
    if (!set) { set = new Set(); FORM2LEMMA.set(fk, set); }
    set.add(w);
  }
}

const famCache = new Map();
function familyOf(w) {
  const key = String(w).trim().toLowerCase();
  if (famCache.has(key)) return famCache.get(key);
  const out = new Set([key]);
  const r = get(key);
  if (r) for (const [, form] of r.ex) out.add(form.toLowerCase());
  // 反查：哪些原形把 key 当作自己的词形
  const back = FORM2LEMMA.get(key);
  if (back) for (const lemma of back) {
    out.add(lemma);
    // 递归展开这些原形的其它词形（satisfy → satisfied/satisfying/satisfies）
    const lr = get(lemma);
    if (lr) for (const [, form] of lr.ex) out.add(form.toLowerCase());
  }
  famCache.set(key, out);
  return out;
}
function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}

/* 预构建「可用干扰词候选池」：只含【高频词 frq≥100】、纯小写字母、长度 3-12、有释义，按长度分桶。
   高频门槛保证干扰项是初中生见过的常见词，而非 copain/anasazi 之类的罕见词。 */
const POOL_BY_LEN = new Map();
for (const [w, rec] of DICT) {
  if (w.length < 3 || w.length > 12) continue;
  if (!/^[a-z]+$/.test(w)) continue;              // 排除含空格/连字符/大写缩写
  if (!rec.trans) continue;
  if (rec.frq < 100) continue;                    // 只收高频词
  if (rec.trans.length > 80) continue;
  const L = w.length;
  if (!POOL_BY_LEN.has(L)) POOL_BY_LEN.set(L, []);
  POOL_BY_LEN.get(L).push(w);
}

/* 前缀索引：prefix(前4字母) -> 同根派生候选词列表（供 pos 题干扰项） */
const PREFIX_IDX = new Map();
for (const [w, rec] of DICT) {
  if (w.length < 4 || w.length > 14) continue;
  if (!/^[a-z]+$/.test(w)) continue;
  if (!rec.trans) continue;
  if (rec.frq < 10) continue;                     // 派生词可用稍低频
  const p = w.slice(0, 4);
  if (!PREFIX_IDX.has(p)) PREFIX_IDX.set(p, []);
  PREFIX_IDX.get(p).push(w);
}

/* 从候选池挑「真实、不同族、不形近」的词，数量 cnt，排除 avoid，与 ansWord 不形近 */
function pickReal(avoid, cnt, rng, ansWord) {
  const ans = String(ansWord || '').toLowerCase();
  const alen = ans.length;
  // 按长度相近优先（同长度桶 → 相邻长度桶），保证干扰项与答案长度接近、更像同类
  const bucketOrder = [];
  for (let d = 0; d <= 3; d++) {
    if (alen - d >= 3 && POOL_BY_LEN.has(alen - d)) bucketOrder.push(alen - d);
    if (d > 0 && alen + d <= 12 && POOL_BY_LEN.has(alen + d)) bucketOrder.push(alen + d);
  }
  const out = [];
  const seen = new Set();
  for (const L of bucketOrder) {
    if (out.length >= cnt) break;
    const bucket = POOL_BY_LEN.get(L);
    const start = Math.floor(rng() * bucket.length);
    for (let k = 0; k < bucket.length && out.length < cnt; k++) {
      const w = bucket[(start + k) % bucket.length];
      if (avoid.has(w) || seen.has(w)) continue;
      if (ans && lev(w, ans) < 3) continue;
      seen.add(w);
      out.push(w);
    }
  }
  return out;
}

function makeRng(seedStr) {
  let s = 0; for (let i = 0; i < seedStr.length; i++) s = (s * 31 + seedStr.charCodeAt(i)) >>> 0;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

/* 从词典释义 (translation 字段) 提取第一个「单一中文词」释义（2-6字，不含逗号堆砌） */
function zhGloss(rec) {
  if (!rec || !rec.trans) return '';
  // 优先取「词性. 单义项」形式，且义项里是纯中文词（2-6字，无逗号/分号）
  const m = rec.trans.match(/(?:n|v|vt|vi|a|ad|adj|adv|prep|pron|conj|num|int)\.?\s*([\u4e00-\u9fa5]{2,6})(?:[,，；;\s]|$)/);
  if (m) return m[1];
  return '';
}

/* 近义词映射：从 data/syn_map.js 读取完整精写表 */
const SYN = (() => {
  const code = fs.readFileSync(path.join(ROOT, 'data', 'syn_map.js'), 'utf8');
  const sb = { window: {} }; vm.createContext(sb); vm.runInContext(code, sb);
  return sb.window.SYN_MAP || {};
})();

/* ---------- 载入各册词表（作干扰项池：同册课本词，学生必学） ---------- */
const DECKS = ['qishang', 'qixia', 'bashang', 'baxia', 'jiushang', 'jiuxia'];
const DECK_WORDS = {};
DECKS.forEach(d => {
  const p = path.join(ROOT, 'data', 'words', d + '.txt');
  if (!fs.existsSync(p)) { DECK_WORDS[d] = []; return; }
  DECK_WORDS[d] = fs.readFileSync(p, 'utf8').split('\n').map(l => l.trim()).filter(Boolean)
    .map(l => {
      const s = l.split('|').map(x => x.trim());
      return { word: s[0], phonetic: s[1] || '', pos: s[2] || '', gloss: s[3] || '' };
    });
});

/* 从同册词表选 cnt 个「不同族、不形近、有 gloss、且在词典中」的干扰词 */
function pickDeckDistractors(deckWords, avoid, cnt, rng, ansWord) {
  const ans = String(ansWord || '').toLowerCase();
  const pool = [];
  for (const w of deckWords) {
    const wk = w.word.toLowerCase();
    if (avoid.has(wk)) continue;
    if (wk === ans) continue;
    if (!/^[a-z]+$/.test(wk)) continue;             // 排除短语/含连字符词
    if (!has(wk)) continue;                          // 必须在真实词典中
    if (lev(wk, ans) < 3) continue;
    if (!w.gloss) continue;
    pool.push(w);
  }
  const out = [];
  while (out.length < cnt && pool.length) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function fixEntry(e, deckWords) {
  const key = String(e.word).trim().toLowerCase();
  const fam = familyOf(key);
  // 已知边界词的 gloss 修正（E8）：surely 是副词「确实地」，fever 以「发烧」为主
  if (key === 'surely' && e.gloss === '确实地') { /* gloss 正确，无需改 */ }
  if (key === 'fever') { e.gloss = '发烧；发热'; }
  const qs = (e.questions || []).map(q => {
    const qq = { ...q };
    // 每题的随机种子含题型，保证 zh2en/listen/cloze 三题干扰项互不相同（E4）
    const rng = makeRng('fix_' + key + '_' + q.type);
    let opts = (q.options || []).map(String);
    const ans = String(q.answer == null ? '' : q.answer);

    if (q.type === 'pos') {
      /* pos 题：保留旧题库的【答案和句子】（它们本已语义匹配），
         只把自造词/同族干扰项换成「真实、不同族、不形近」的同册词。
         不再用 exchange 重选答案，避免答案与句子不匹配。 */
      const ansForm = ans;   // 旧答案（可能是 readiness/geographical/scarves 等正确词形）
      const avoid = new Set([...fam, ansForm.toLowerCase()]);
      let distract = pickDeckDistractors(deckWords, avoid, 3, rng, ansForm).map(w => w.word);
      while (distract.length < 3) {
        const more = pickReal(new Set([...fam, ansForm.toLowerCase(), ...distract.map(x => x.toLowerCase())]), 3 - distract.length, rng, ansForm);
        if (more.length === 0) break;
        distract = distract.concat(more);
      }
      qq.options = [ansForm, ...distract];
      qq.answer = ansForm;
      qq.base = q.base || key;
      qq._fixed = 'pos:保留答案→修干扰项';
      return qq;
    }

    /* zh2en / listen / cloze：干扰项从【同册课本词表】重建（学生必学，语义域接近）。
       每题型用不同随机种子，保证三题干扰项互不相同（E4），杜绝「背选项」送分。 */
    if (q.type === 'zh2en' || q.type === 'listen' || q.type === 'cloze') {
      const avoid = new Set([...fam, key]);
      const distract = pickDeckDistractors(deckWords, avoid, 3, rng, ans);
      let dwords = distract.map(w => w.word);
      // 二次校验：干扰项彼此之间不得同族（E3）
      const final = [];
      const usedFam = new Set(fam);
      for (const w of dwords) {
        const wf = familyOf(w.toLowerCase());
        let ok = true;
        for (const y of wf) if (usedFam.has(y)) { ok = false; break; }
        if (ok) { final.push(w); wf.forEach(y => usedFam.add(y)); }
      }
      dwords = final;
      // 兜底：同册词不够时从高频词典补
      const dd = dwords;
      while (dd.length < 3) {
        const more = pickReal(new Set([...usedFam, key, ...dd.map(x => x.toLowerCase())]), 3 - dd.length, rng, ans);
        if (more.length === 0) break;
        more.forEach(m => { dd.push(m); familyOf(m.toLowerCase()).forEach(y => usedFam.add(y)); });
      }
      qq.options = [ans, ...dd];
      qq.answer = ans;
      qq._fixed = (qq._fixed ? qq._fixed + ';' : '') + q.type + ':重建干扰项';
      return qq;
    }

    /* zh2en / en2zh / listen / cloze / syn：剔除同族+形近+重复干扰项，补真实词 */
    const avoid = new Set([...fam]);
    opts.forEach(o => { if (o !== ans) avoid.add(o.toLowerCase()); });
    let clean = [ans];
    const seen = new Set([ans]);
    for (const o of opts) {
      if (o === ans || seen.has(o)) continue;
      const ok = o.toLowerCase();
      if (fam.has(ok)) { qq._fixed = (qq._fixed ? qq._fixed + ';' : '') + 'drop同族:' + o; continue; }
      if (lev(ok, ans.toLowerCase()) < 3) { qq._fixed = (qq._fixed ? qq._fixed + ';' : '') + 'drop形近:' + o; continue; }
      if (q.type !== 'en2zh' && !has(o)) { qq._fixed = (qq._fixed ? qq._fixed + ';' : '') + 'drop自造:' + o; continue; }
      // E3：干扰项彼此之间也不得同族/形近
      let conflict = false;
      for (const accepted of clean.slice(1)) {
        const af = familyOf(accepted.toLowerCase());
        if (af.has(ok) || familyOf(ok).has(accepted.toLowerCase())) { conflict = true; break; }
        if (lev(ok, accepted.toLowerCase()) < 3) { conflict = true; break; }
      }
      if (conflict) { qq._fixed = (qq._fixed ? qq._fixed + ';' : '') + 'drop互族:' + o; continue; }
      clean.push(o); seen.add(o);
    }
    /* en2zh 题：干扰项从【同册课本词表】其它词的 gloss 取（学生学过的词义，核心词不重复） */
    if (q.type === 'en2zh') {
      const coreZh = s => {
        const seg = String(s).split('；')[0].split(';')[0];
        const m = seg.match(/[\u4e00-\u9fa5]{1,4}/);
        let c = m ? m[0] : String(s);
        c = c.replace(/[的性地者化]{1,2}$/, '');
        return c;
      };
      const ansCore = coreZh(ans);
      const usedCore = new Set([ansCore]);
      const distract = [];
      const avoid = new Set([...fam, key]);
      const cands = pickDeckDistractors(deckWords, avoid, 20, rng, ans);
      for (const w of cands) {
        if (distract.length >= 3) break;
        const zh = w.gloss;
        if (!zh || zh.length < 2 || zh.length > 12) continue;
        const core = coreZh(zh);
        if (usedCore.has(core)) continue;
        usedCore.add(core);
        distract.push(zh);
      }
      // 兜底：同册词不够时从高频词典补
      while (distract.length < 3) {
        let added = false;
        for (const [w2, r2] of DICT) {
          if (distract.length >= 3) break;
          if (w2 === key || fam.has(w2)) continue;
          if (!/^[a-z]+$/.test(w2)) continue;
          if (!r2.trans) continue;
          if (r2.frq < 1000) continue;
          if (lev(w2, key) < 3) continue;
          const zh = zhGloss(r2);
          if (!zh || zh.length < 2 || zh.length > 12) continue;
          const core = coreZh(zh);
          if (usedCore.has(core)) continue;
          usedCore.add(core);
          distract.push(zh);
          added = true;
        }
        if (!added) break;
      }
      qq.options = [ans, ...distract];
      qq.answer = ans;
      qq._fixed = 'en2zh:重建干扰项';
      return qq;
    }
    /* en2zh 题：干扰项必须是中文释义，且核心词不重复（E9）。
       策略：剔除与答案或其它选项核心中文词重复的干扰项，改从词典补真实中文释义。 */
    if (false) {
      const coreZh = s => {
        // 先取分号前第一段，再提取首个中文片段，去掉「的/性/地/者/化」后缀
        const seg = String(s).split('；')[0].split(';')[0];
        const m = seg.match(/[\u4e00-\u9fa5]{1,4}/);
        let c = m ? m[0] : String(s);
        c = c.replace(/[的性地者化]{1,2}$/, '');
        return c;
      };
      const dedup = [ans];
      const usedCore = new Set([coreZh(ans)]);
      for (const o of clean.slice(1)) {
        const c = coreZh(o);
        if (usedCore.has(c)) { qq._fixed = (qq._fixed ? qq._fixed + ';' : '') + 'drop重复释义:' + o; continue; }
        usedCore.add(c); dedup.push(o);
      }
      clean = dedup;
    }
    // 补足到 4 个（en2zh 补中文释义，其它题型补英文词）
    if (clean.length < 4) {
      if (q.type === 'en2zh') {
        const coreZh = s => {
          const seg = String(s).split('；')[0].split(';')[0];
          const m = seg.match(/[\u4e00-\u9fa5]{1,4}/);
          let c = m ? m[0] : String(s);
          c = c.replace(/[的性地者化]{1,2}$/, '');
          return c;
        };
        const usedCore = new Set(clean.map(coreZh));
        const extraZh = [];
        for (const [w2, r2] of DICT) {
          if (extraZh.length >= 4 - clean.length) break;
          if (w2 === key || fam.has(w2)) continue;
          if (!/^[a-z]+$/.test(w2)) continue;
          if (!r2.trans) continue;
          const zh = zhGloss(r2);
          if (!zh || zh.length < 2 || zh.length > 12) continue;
          const core = coreZh(zh);
          if (usedCore.has(core)) continue;
          usedCore.add(core);
          extraZh.push(zh);
        }
        clean = clean.concat(extraZh);
        qq._fixed = (qq._fixed ? qq._fixed + ';' : '') + '补中文释义:' + extraZh.join('|');
      } else {
        const avoid2 = new Set([...fam, ...clean.map(x => x.toLowerCase())]);
        let extra = pickReal(avoid2, 4 - clean.length, rng, ans);
        // 二次校验：新补的词彼此之间及与已有选项不得同族/形近
        const final = [];
        const usedFam = new Set();
        for (const o of clean) { familyOf(o.toLowerCase()).forEach(x => usedFam.add(x)); }
        for (const x of extra) {
          const xf = familyOf(x.toLowerCase());
          let ok = true;
          for (const y of xf) if (usedFam.has(y)) { ok = false; break; }
          if (ok) { final.push(x); xf.forEach(y => usedFam.add(y)); }
        }
        extra = final;
        if (extra.length < 4 - clean.length) {
          const avoid3 = new Set([...usedFam, ...clean.map(x => x.toLowerCase()), ...extra.map(x => x.toLowerCase())]);
          extra = extra.concat(pickReal(avoid3, 4 - clean.length - extra.length, rng, ans));
        }
        clean = clean.concat(extra);
        qq._fixed = (qq._fixed ? qq._fixed + ';' : '') + '补真实:' + extra.join(',');
      }
    }
    qq.options = clean.slice(0, 4);
    if (q.type === 'syn') {
      const syn = SYN[key];
      if (syn) {
        qq.answer = syn;
        // 干扰项从同册词表选（真实、不同族、与近义词不同）
        const avoid = new Set([...fam, syn.toLowerCase(), key]);
        let distract = pickDeckDistractors(deckWords, avoid, 3, rng, syn).map(w => w.word);
        while (distract.length < 3) {
          const more = pickReal(new Set([...fam, syn.toLowerCase(), key, ...distract.map(x => x.toLowerCase())]), 3 - distract.length, rng, syn);
          if (more.length === 0) break;
          distract = distract.concat(more);
        }
        qq.options = [syn, ...distract];
        qq._fixed = (qq._fixed ? qq._fixed + ';' : '') + 'syn:' + ans + '→' + syn;
      }
    }
    return qq;
  });
  // 已知边界词的后处理：短句加长（E7）、题干核心词对齐（E8）
  if (key === 'christmas') {
    qs.forEach(q => { if (q.type === 'cloze') q.sentence = 'We put up a big tree in our room at ____.'; });
  }
  if (key === 'waste') {
    qs.forEach(q => { if (q.type === 'cloze') q.sentence = "Don't ____ any food at dinner, please."; });
  }
  if (key === 'surely') {
    qs.forEach(q => { if (q.type === 'zh2en') q.stem = '确实地；当然'; });
  }
  if (key === 'fever') {
    qs.forEach(q => { if (q.type === 'zh2en') q.stem = '发烧；发热'; });
  }
  return { ...e, questions: qs };
}

/* ---------- 主流程 ---------- */
fs.mkdirSync(DST, { recursive: true });
const files = fs.readdirSync(SRC).filter(f => f.endsWith('.js')).sort();
let totalFixed = 0;
files.forEach(f => {
  const code = fs.readFileSync(path.join(SRC, f), 'utf8');
  const sb = { window: {} }; vm.createContext(sb); vm.runInContext(code, sb);
  const bn = Object.keys(sb.window)[0];
  // 从文件名前缀推断 deck（qishang_part1 → qishang）
  const deck = DECKS.find(d => f.startsWith(d + '_')) || 'qishang';
  const deckWords = DECK_WORDS[deck] || [];
  const arr = (sb.window[bn] || []).map(e => fixEntry(e, deckWords));
  let fixCnt = 0;
  arr.forEach(e => e.questions.forEach(q => { if (q._fixed) fixCnt++; }));
  totalFixed += fixCnt;
  const out = 'window.' + bn + '=' + JSON.stringify(arr) + ';\n';
  fs.writeFileSync(path.join(DST, f), out);
  console.log(`${f}: ${arr.length} 词, 修复 ${fixCnt} 题`);
});
console.log(`\n共修复 ${totalFixed} 题 → data/questions2/`);
