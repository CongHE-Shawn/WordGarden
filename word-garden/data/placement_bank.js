/* placement_bank.js — 初中生水平定级题库
 *
 * 设计原则（修复旧版三大硬伤）：
 *   1) 题型统一为「英文 → 中文词义」，题干是英文单词，选项是中文释义。
 *      旧版题干问「正确释义」却给英文选项，且答案就出现在题干里 —— 送分。
 *   2) 每个干扰项都来自【同一语义域】的真实课本词（不是答案的词形变体），
 *      所以必须真的懂词义才能选对，认词形/凑长度都没用。
 *   3) 六题难度严格递增，且每一题都能在题库中查到原文（含音标词性）。
 *
 * 难度梯度（对齐外研版课本单元）：
 *   Q1 七上 Unit2 → Q2 七下 Unit2 → Q3 七下 Unit5
 *   → Q4 八上 Unit3 → Q5 八下 Unit4 → Q6 九上 Unit3
 */
window.PLACEMENT_BANK = [
  {
    level: 1,
    deck: 'qishang',
    unit: 'Unit 2 More than fun',
    word: 'volleyball',
    phonetic: 'ˈvɒlibɔːl',
    pos: 'n.',
    gloss: '排球',
    options: ['排球', '篮球', '足球', '乒乓球'],
    answer: '排球'
  },
  {
    level: 2,
    deck: 'qixia',
    unit: 'Unit 2 Go for it!',
    word: 'marathon',
    phonetic: 'ˈmærəθən',
    pos: 'n.',
    gloss: '马拉松赛跑',
    options: ['马拉松赛跑', '短跑比赛', '接力比赛', '跳高比赛'],
    answer: '马拉松赛跑'
  },
  {
    level: 3,
    deck: 'qixia',
    unit: 'Unit 5 Amazing nature',
    word: 'plateau',
    phonetic: 'ˈplætəʊ',
    pos: 'n.',
    gloss: '高原',
    options: ['高原', '山谷', '平原', '盆地'],
    answer: '高原'
  },
  {
    level: 4,
    deck: 'bashang',
    unit: 'Unit 3 Make it happen!',
    word: 'download',
    phonetic: 'ˌdaʊnˈləʊd',
    pos: 'v.',
    gloss: '下载',
    options: ['下载', '上传', '安装', '删除'],
    answer: '下载'
  },
  {
    level: 5,
    deck: 'baxia',
    unit: 'Unit 4 Helping out',
    word: 'wheelchair',
    phonetic: 'ˈwiːltʃeə',
    pos: 'n.',
    gloss: '轮椅',
    options: ['轮椅', '拐杖', '担架', '病床'],
    answer: '轮椅'
  },
  {
    level: 6,
    deck: 'jiushang',
    unit: 'Unit 3 Curiosity',
    word: 'archaeologist',
    phonetic: 'ˌɑːkiˈɒlədʒɪst',
    pos: 'n.',
    gloss: '考古学家',
    options: ['考古学家', '历史学家', '地理学家', '生物学家'],
    answer: '考古学家'
  }
];
