// 把 lesson_map.js 转换成新的扁平化 unit_map.js
// 每个课时变成一个独立 unit 条目，title 含课时名
const fs = require('fs'), vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// 载入 lesson_map
const lmCode = fs.readFileSync(path.join(ROOT, 'data/units/lesson_map.js'), 'utf8');
const sb = { window: {} }; vm.createContext(sb); vm.runInContext(lmCode, sb);
const LESSON_MAP = sb.window.LESSON_MAP;

// 课时标题模板（2024新版外研版标准；词多的 Unit 用第5课时 Presenting ideas）
const LESSON_TITLES = [
  '课时1 Starting out & Reading',
  '课时2 Grammar',
  '课时3 Listening & Speaking',
  '课时4 Reading for Writing',
  '课时5 Presenting ideas'
];

// Unit 元信息（title + en），从旧 unit_map 提取，硬编码防止丢失
const UNIT_META = {
  qishang: {
    starter: { title: 'Starter', en: 'Welcome to junior high!' },
    u1: { title: 'Unit 1', en: 'A new start' },
    u2: { title: 'Unit 2', en: 'More than fun' },
    u3: { title: 'Unit 3', en: 'Family ties' },
    u4: { title: 'Unit 4', en: 'Time to celebrate' },
    u5: { title: 'Unit 5', en: 'Nature in our lives' },
    u6: { title: 'Unit 6', en: 'Fantastic friends' }
  },
  qixia: {
    u1: { title: 'Unit 1', en: 'The secrets of happiness' },
    u2: { title: 'Unit 2', en: 'Go for it!' },
    u3: { title: 'Unit 3', en: 'Food matters' },
    u4: { title: 'Unit 4', en: 'The art of having fun' },
    u5: { title: 'Unit 5', en: 'Amazing nature' },
    u6: { title: 'Unit 6', en: 'Hitting the road' }
  },
  bashang: {
    u1: { title: 'Unit 1', en: 'This is me' },
    u2: { title: 'Unit 2', en: 'Getting along' },
    u3: { title: 'Unit 3', en: 'Make it happen!' },
    u4: { title: 'Unit 4', en: 'Digital life' },
    u5: { title: 'Unit 5', en: 'Play by the rules?' },
    u6: { title: 'Unit 6', en: 'When disaster strikes' }
  },
  baxia: {
    u1: { title: 'Unit 1', en: 'Career talks' },
    u2: { title: 'Unit 2', en: 'Growing pains and gains' },
    u3: { title: 'Unit 3', en: 'What makes a great team?' },
    u4: { title: 'Unit 4', en: 'Helping out' },
    u5: { title: 'Unit 5', en: 'Looking into nature' },
    u6: { title: 'Unit 6', en: 'Living with nature' }
  },
  jiushang: {
    u1: { title: 'Unit 1', en: 'How we learn' },
    u2: { title: 'Unit 2', en: 'Saving money' },
    u3: { title: 'Unit 3', en: 'Curiosity' },
    u4: { title: 'Unit 4', en: 'Heroes' },
    u5: { title: 'Unit 5', en: 'Protecting our environment' },
    u6: { title: 'Unit 6', en: 'Materials and life' },
    u7: { title: 'Unit 7', en: 'Great books' }
  },
  jiuxia: {
    m1: { title: 'Module 1', en: 'How can we become good learners' },
    m2: { title: 'Module 2', en: 'Students of today, students of tomorrow' },
    m3: { title: 'Module 3', en: 'The teenage brain' },
    m4: { title: 'Module 4', en: 'Making a difference' },
    m5: { title: 'Module 5', en: 'Health care' },
    m6: { title: 'Module 6', en: 'Food and lifestyle' },
    m7: { title: 'Module 7', en: 'Great books' },
    m8: { title: 'Module 8', en: 'Time off' }
  }
};

// 载入词表，用于校验
const DECKS = Object.keys(LESSON_MAP);

const newMap = {};
let totalLessons = 0;
let problems = [];

DECKS.forEach(deck => {
  const unitMap = LESSON_MAP[deck];
  const units = [];

  for (const unitId of Object.keys(unitMap)) {
    const lessons = unitMap[unitId];
    const meta = (UNIT_META[deck] && UNIT_META[deck][unitId]) || {};
    const title = meta.title || 'Unit';
    const en = meta.en || '';

    lessons.forEach((words, i) => {
      if (!words || !words.length) return;
      units.push({
        id: unitId + '_' + (i + 1),
        title: title,
        en: en,
        lesson: LESSON_TITLES[i] || ('课时' + (i + 1)),
        lessonIdx: i + 1,
        words: words
      });
      totalLessons++;
    });
  }
  newMap[deck] = { units };
});

// ===== 校验 =====
// 1. 每册词表词是否都被覆盖、无丢失、无重复
DECKS.forEach(deck => {
  const wordFile = path.join(ROOT, 'data/words', deck + '.txt');
  if (!fs.existsSync(wordFile)) return;
  const target = fs.readFileSync(wordFile, 'utf8').split('\n').map(l => l.trim()).filter(Boolean)
    .map(l => l.split('|')[0].trim());
  const inMap = [];
  newMap[deck].units.forEach(u => inMap.push(...u.words));
  const missing = target.filter(w => !inMap.includes(w));
  const extra = inMap.filter(w => !target.includes(w));
  const seen = {}; const dup = [];
  inMap.forEach(w => { if (seen[w]) dup.push(w); seen[w] = 1; });
  if (missing.length || extra.length || dup.length) {
    problems.push(`${deck}: 缺${missing.length}[${missing.join(',')}] 多${extra.length}[${extra.join(',')}] 重复${dup.length}[${[...new Set(dup)].join(',')}]`);
  }
});

// 输出新 unit_map
const header = `/* unit_map.js — 外研版（2024新版）初中英语课本单元·课时划分
 * 每个 Unit 按课本真实课时切成 2-4 课（扁平化，每课时一个 unit 条目）：
 *   课时1 Starting out & Understanding ideas (Reading)
 *   课时2 Understanding ideas (Grammar)
 *   课时3 Developing ideas (Listening & Speaking)
 *   课时4 Developing ideas (Reading for Writing)
 * 词来自既有词库，不新增、不丢失。
 */
window.UNIT_MAP = ${JSON.stringify(newMap, null, 2)};
`;

const outPath = path.join(ROOT, 'data/units/unit_map.js');
fs.writeFileSync(outPath, header);
console.log('已生成新的 unit_map.js，共', totalLessons, '个课时');

if (problems.length) {
  console.log('\n⚠️ 校验发现问题：');
  problems.forEach(p => console.log('  ' + p));
} else {
  console.log('\n✅ 校验通过：所有词表词均被覆盖，无丢失、无重复');
}
