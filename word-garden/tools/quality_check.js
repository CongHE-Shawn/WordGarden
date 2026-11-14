// 题库质量检查：题型数量 / 选项重复 / 答案缺失 / 空词条 / 字段完整
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'data', 'questions');
const NEED = ['zh2en', 'en2zh', 'listen', 'cloze', 'pos', 'syn'];

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort();
let issues = 0, words = 0, qs = 0;
files.forEach(f => {
  const code = fs.readFileSync(path.join(DIR, f), 'utf8');
  const sb = { window: {} }; vm.createContext(sb); vm.runInContext(code, sb);
  const bn = Object.keys(sb.window)[0];
  if (!bn) { console.log('!! ' + f + ' 未定义变量'); issues++; return; }
  const arr = sb.window[bn];
  words += arr.length;
  arr.forEach((e, i) => {
    const tag = bn + '[' + i + '] ' + (e.word || '<空word>');
    if (!e.word || !e.word.trim()) { console.log('!! ' + tag + ' 词条为空'); issues++; return; }
    if (!e.gloss || !e.phonetic || !e.pos) { console.log('!! ' + tag + ' 缺少 gloss/phonetic/pos'); issues++; }
    if (!e.questions || e.questions.length !== 6) { console.log('!! ' + tag + ' 题数=' + (e.questions ? e.questions.length : 0) + ' (应为6)'); issues++; }
    const types = (e.questions || []).map(q => q.type);
    NEED.forEach(t => { if (types.indexOf(t) < 0) { console.log('!! ' + tag + ' 缺题型 ' + t); issues++; } });
    (e.questions || []).forEach(q => {
      qs++;
      if (!q.options) { console.log('!! ' + tag + ' ' + q.type + ' 无 options'); issues++; return; }
      if (q.options.length !== 4) { console.log('!! ' + tag + ' ' + q.type + ' 选项数=' + q.options.length); issues++; }
      const seen = {};
      q.options.forEach(o => { if (seen[o]) { console.log('!! ' + tag + ' ' + q.type + ' 选项重复: ' + o); issues++; } seen[o] = 1; });
      if (q.options.indexOf(q.answer) < 0) { console.log('!! ' + tag + ' ' + q.type + ' 答案不在选项中: ' + q.answer); issues++; }
      if (q.type === 'cloze' || q.type === 'pos') {
        if (!q.sentence || q.sentence.indexOf('____') < 0) { console.log('!! ' + tag + ' ' + q.type + ' 句子缺少 ____'); issues++; }
      }
      if (q.type === 'pos' && !q.base) { console.log('!! ' + tag + ' pos 缺 base'); issues++; }
      if (q.type === 'syn' && (!q.stem || q.stem !== e.word)) { console.log('!! ' + tag + ' syn stem 与单词不符'); issues++; }
    });
  });
});
console.log('\n检查文件 ' + files.length + ' 个 | 词条 ' + words + ' | 题目 ' + qs + ' | 问题 ' + issues + ' 个');
