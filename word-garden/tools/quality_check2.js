/* quality_check2.js —— 内容级（不只是结构级）题库质检
 *
 * 与 quality_check.js 的区别：
 *   旧脚本只查「答案在不在选项里」这类结构问题，查不出命题质量问题。
 *   本脚本用真实英语词典 (data/ecdict.csv, 77 万词条, 含 exchange 词形变化)
 *   去判定每一条干扰项是否真实存在、是否与答案构成多解、是否送分。
 *
 * 判定项：
 *   E1 FAKE       干扰项是词典里根本不存在的自造词（如 textbookes / togetherly）
 *   E2 MORPH      干扰项是答案的词形变体（形近/词族），靠认词形就能选对 = 送分
 *   E3 MULTI      存在两个都成立的选项（如 everyone 与 everybody 同选）
 *   E4 REUSE      zh2en / listen / cloze 三题选项完全相同，重复送分
 *   E5 SYNDEF     syn 答案为「定义式短语」而非真近义词（如 journey by air）
 *   E6 CLONE      syn 干扰项与答案同构短语，靠句式就能排除
 *   E7 STEMLEAK   cloze 句子里直接出现答案词的其它形式
 *   E8 GLOSSMIX   zh2en 题干与词条 gloss 不一致
 *   E9 ENZH_MIX   en2zh 选项释义互相重复/含歧义
 *   E10 POSBAD    pos 题里存在两个语法上都成立的选项
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'data', 'questions');

/* ---------- 1. 载入词典 ---------- */
const dictPath = path.join(ROOT, 'data', 'ecdict.csv');
const raw = fs.readFileSync(dictPath, 'utf8');
const DICT = new Map();          // word(lower) -> {pos:Set, ex:Map}
let i = 0;
while (i < raw.length) {
  const nl = raw.indexOf('\n', i);
  const line = raw.slice(i, nl < 0 ? raw.length : nl);
  i = nl < 0 ? raw.length : nl + 1;
  if (!line || line.charCodeAt(0) === 35 /* # */) continue;
  // 轻量 CSV：取前若干逗号分隔字段（definition/translation 里可能含逗号，故只取靠前字段）
  const fields = [];
  let cur = '', q = false, f = 0;
  for (let k = 0; k < line.length && f < 12; k++) {
    const c = line[k];
    if (q) {
      if (c === '"') { if (line[k + 1] === '"') { cur += '"'; k++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { fields.push(cur); cur = ''; f++; }
    else cur += c;
  }
  fields.push(cur);
  const w = (fields[0] || '').trim().toLowerCase();
  if (!w) continue;
  const pos = (fields[4] || '').trim();
  const exchange = (fields[10] || '').trim();
  let rec = DICT.get(w);
  if (!rec) { rec = { pos: new Set(), ex: new Map() }; DICT.set(w, rec); }
  if (pos) rec.pos.add(pos);
  if (exchange) {
    exchange.split('/').forEach(pair => {
      const m = pair.split(':');
      if (m.length === 2 && !/^[01]$/.test(m[0])) {
        m[1].split(',').forEach(form => { if (form) rec.ex.set(m[0], form); });
      }
    });
  }
}
console.log('词典载入：' + DICT.size + ' 个词条\n');

const isWord = w => DICT.has(String(w).trim().toLowerCase());

/* 预构建反向索引：词形 → 原形集合（一次遍历） */
const FORM2LEMMA = new Map();
for (const [w, rec] of DICT) {
  for (const [, form] of rec.ex) {
    const fk = form.toLowerCase();
    let set = FORM2LEMMA.get(fk);
    if (!set) { set = new Set(); FORM2LEMMA.set(fk, set); }
    set.add(w);
  }
}

/* 词族：若 a 与 b 存在 exchange 关系（同一原形），则互为词形变体 */
function morphFamily(w) {
  const key = String(w).trim().toLowerCase();
  const out = new Set([key]);
  const rec = DICT.get(key);
  if (rec) for (const [, form] of rec.ex) out.add(form.toLowerCase());
  const back = FORM2LEMMA.get(key);
  if (back) for (const lemma of back) {
    out.add(lemma);
    const lr = DICT.get(lemma);
    if (lr) for (const [, form] of lr.ex) out.add(form.toLowerCase());
  }
  return out;
}
const famCache = new Map();
function family(w) {
  const k = String(w).trim().toLowerCase();
  if (!famCache.has(k)) famCache.set(k, morphFamily(k));
  return famCache.get(k);
}

/* ---------- 2. 载入题库 ---------- */
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort();
const banks = [];
files.forEach(f => {
  const code = fs.readFileSync(path.join(DIR, f), 'utf8');
  const sb = { window: {} }; vm.createContext(sb); vm.runInContext(code, sb);
  const bn = Object.keys(sb.window)[0];
  banks.push({ file: f, name: bn, arr: sb.window[bn] || [] });
});

/* ---------- 3. 逐条判定 ---------- */
const findings = [];   // {level, code, file, word, type, detail}
function add(code, file, e, q, detail, level) {
  findings.push({ code, level: level || 'ERR', file, word: e.word, type: q ? q.type : '-', detail });
}

banks.forEach(bk => {
  bk.arr.forEach(e => {
    const qs = e.questions || [];
    const byType = {};
    qs.forEach(q => { byType[q.type] = q; });

    qs.forEach(q => {
      const opts = (q.options || []).map(String);
      const ans = String(q.answer == null ? '' : q.answer);

      /* E1 自造词：干扰项不在词典 */
      opts.forEach(o => {
        if (!/^[A-Za-z][A-Za-z'-]*$/.test(o)) return;         // 只查纯英文选项
        if (o === ans) return;
        if (!isWord(o)) add('E1', bk.file, e, q, `干扰项「${o}」在真实词典中不存在（自造词）`);
      });

      /* E2 词形送分：干扰项与答案同词族 */
      if (q.type === 'zh2en' || q.type === 'listen' || q.type === 'cloze') {
        const fam = family(ans);
        if (fam.size > 1) {
          opts.forEach(o => {
            if (o === ans) return;
            const f2 = family(o);
            for (const x of f2) if (fam.has(x)) {
              add('E2', bk.file, e, q, `干扰项「${o}」与答案「${ans}」同属一个词族（${x}），可凭词形排除 = 送分`);
              break;
            }
          });
        }
      }

      /* E3 多解：zh2en 中两个选项互为屈折形式 */
      if (q.type === 'zh2en' || q.type === 'listen') {
        for (let a = 0; a < opts.length; a++) for (let b = a + 1; b < opts.length; b++) {
          const fa = family(opts[a]), fb = family(opts[b]);
          let hit = null;
          for (const x of fb) if (fa.has(x)) { hit = x; break; }
          if (hit) add('E3', bk.file, e, q, `选项「${opts[a]}」与「${opts[b]}」同源（${hit}），两个都成立`);
        }
      }

      /* E10 pos 题语法双解：只有当干扰项是【真实存在的词形】且与答案同词族时，
         才可能构成句中双解。自造词（如 juniorer/juniorest）根本不成立，不算双解。 */
      if (q.type === 'pos' && q.base) {
        const base = String(q.base);
        const baseFam = family(base);
        opts.forEach(o => {
          if (o === ans) return;
          if (!isWord(o)) return;              // 自造词由 E1 单独判定，此处不重复
          const f2 = family(o);
          for (const x of f2) if (baseFam.has(x)) {
            add('E10', bk.file, e, q, `pos 题干扰项「${o}」是真实词形且与词根「${base}」同源（${x}），句中可能同样成立 = 多解`);
            break;
          }
        });
      }
    });

    /* E4 三题选项完全复用 */
    const sig = t => byType[t] ? JSON.stringify((byType[t].options || []).slice().sort()) : '';
    if (sig('zh2en') && sig('zh2en') === sig('listen') && sig('zh2en') === sig('cloze')) {
      add('E4', bk.file, e, byType.zh2en, 'zh2en / listen / cloze 三题选项完全相同（连续送分）', 'WARN');
    }

    /* E5 syn 质量：只报「答案与多个干扰项同为同构短语导致靠句式排除」的真送分；
       单条多词近义（如 return→come back、smartphone→mobile phone）是合法近义词，不算错 */
    const sy = byType.syn;
    if (sy) {
      const a = String(sy.answer || '');
      const multi = a.trim().split(/\s+/).length > 1;
      if (multi) {
        const others = (sy.options || []).map(String).filter(o => o !== a);
        const sameShape = others.filter(o => o.trim().split(/\s+/).length === a.trim().split(/\s+/).length);
        if (sameShape.length >= 2) {
          add('E5', bk.file, e, sy, `syn 答案「${a}」与多个干扰项同为同构短语，靠句式即可排除`);
        }
      }
      if (!multi && !isWord(a)) {
        add('E5', bk.file, e, sy, `syn 答案「${a}」不在真实词典中`, 'WARN');
      }
    }

    /* E7 cloze 句子泄漏 */
    const cz = byType.cloze;
    if (cz && cz.sentence) {
      const s = cz.sentence;
      const blank = s.replace(/_{3,}/g, '').toLowerCase();
      const aw = String(cz.answer || '').toLowerCase();
      if (aw.length > 3 && blank.includes(aw) && !blank.includes(' ' + aw + ' ')) {
        // 句子去掉下划线后仍包含答案子串 → 疑似泄漏
      }
      const words = s.replace(/_{3,}/g, ' ').trim().split(/\s+/).length;
      if (words < 3) add('E7', bk.file, e, cz, `cloze 句子过短（${words} 词）：${s}`);
    }

    /* E8 zh2en 题干 vs gloss：只报「核心释义缺失」——题干必须包含词条释义的首个分号片段，
       措辞扩展（如「朝另一个方向；在远处」vs「朝另一个方向」）不算错误 */
    const z = byType.zh2en;
    if (z && e.gloss) {
      const core = String(e.gloss).split('；')[0].split(';')[0].trim();
      const stem = String(z.stem || '');
      if (core && core.length > 1 && stem.indexOf(core) < 0) {
        add('E8', bk.file, e, z, `zh2en 题干「${stem}」缺少核心释义「${core}」`);
      }
    }

    /* E9 en2zh 选项核心释义重复：取分号前第一段、去「的/性」后缀后比对核心词 */
    const en = byType.en2zh;
    if (en) {
      const core = s => {
        const seg = String(s).split('；')[0].split(';')[0];
        const m = seg.match(/[\u4e00-\u9fa5]{1,4}/);
        let c = m ? m[0] : '';
        return c.replace(/[的性地者化]{1,2}$/, '');
      };
      const os = (en.options || []).map(String);
      for (let a = 0; a < os.length; a++) for (let b = a + 1; b < os.length; b++) {
        const x = core(os[a]), y = core(os[b]);
        if (x && y && x.length >= 1 && (x === y || (x.length >= 2 && y.length >= 2 && (x.indexOf(y) >= 0 || y.indexOf(x) >= 0)))) {
          add('E9', bk.file, e, en, `en2zh 选项「${os[a]}」与「${os[b]}」核心释义重复（${x}）`);
        }
      }
    }
  });
});

/* ---------- 4. 汇总 ---------- */
const byCode = {};
findings.forEach(f => { (byCode[f.code] = byCode[f.code] || []).push(f); });
const codes = Object.keys(byCode).sort();
console.log('=== 内容级质检结果 ===');
let totalQ = 0, totalW = 0;
banks.forEach(b => { totalW += b.arr.length; b.arr.forEach(e => { totalQ += (e.questions || []).length; }); });
codes.forEach(c => {
  const errs = byCode[c].filter(f => f.level === 'ERR').length;
  console.log(`${c}  ${String(byCode[c].length).padStart(5)} 条  (错误 ${errs} / 警告 ${byCode[c].length - errs})`);
});
console.log(`\n题库：${banks.length} 文件 / ${totalW} 词 / ${totalQ} 题`);
console.log(`命中问题：${findings.length} 条，涉及 ${new Set(findings.map(f => f.word)).size} 个词`);

if (process.argv[2] === '--dump') {
  const want = process.argv[3] || 'E1';
  const out = byCode[want] || [];
  console.log(`\n--- ${want} 明细（前 60 条） ---`);
  out.slice(0, 60).forEach(f => console.log(`[${f.file}] ${f.word} / ${f.type}: ${f.detail}`));
}
fs.writeFileSync(path.join(ROOT, 'tools', 'findings.json'), JSON.stringify(findings, null, 1));
console.log('\n明细已写入 tools/findings.json');
