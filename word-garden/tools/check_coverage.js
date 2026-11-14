// 覆盖度检查：对比 data/words/{deck}.txt 目标词表 vs 已生成题库
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const decks = ['qishang', 'qixia', 'bashang', 'baxia', 'jiushang', 'jiuxia'];
const DIR = path.join(ROOT, 'data', 'questions');

function loadDeck(deck) {
  const out = [];
  const files = fs.readdirSync(DIR)
    .filter(f => f.startsWith(deck + '_part') && f.endsWith('.js'))
    .sort((a, b) => parseInt(a.match(/part(\d+)/)[1]) - parseInt(b.match(/part(\d+)/)[1]));
  files.forEach(f => {
    const code = fs.readFileSync(path.join(DIR, f), 'utf8');
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    const bn = 'BANK_' + deck + '_part' + f.match(/part(\d+)/)[1];
    if (sandbox.window[bn]) out.push(...sandbox.window[bn]);
    else console.log('  ! 未找到变量', bn, 'in', f);
  });
  return out;
}

decks.forEach(deck => {
  const target = fs.readFileSync(path.join(ROOT, 'data', 'words', deck + '.txt'), 'utf8')
    .split('\n').map(l => l.trim()).filter(Boolean)
    .map(l => l.split('|')[0].trim());
  const entries = loadDeck(deck);
  const done = entries.map(e => e.word);
  const doneSet = new Set(done);
  const missing = target.filter(w => !doneSet.has(w));
  const extra = done.filter(w => !target.includes(w));
  const seen = {}; const dup = [];
  done.forEach(w => { if (seen[w]) dup.push(w); seen[w] = 1; });
  console.log(`\n=== ${deck} ===`);
  console.log(`目标 ${target.length} | 已写 ${done.length} | 缺 ${missing.length} | 多余 ${extra.length} | 重复 ${dup.length}`);
  if (missing.length) console.log('缺失: ' + missing.join(' '));
  if (extra.length) console.log('多余: ' + extra.join(' '));
  if (dup.length) console.log('重复: ' + [...new Set(dup)].join(' '));
});
