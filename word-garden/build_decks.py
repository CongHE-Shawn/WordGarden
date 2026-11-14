# -*- coding: utf-8 -*-
"""从 ecdict.csv 抽取 8 个考试词库，输出为 file:// 可直接加载的 JS 数据文件。"""
import csv, json, os, re

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, 'data', 'ecdict.csv')
OUT = os.path.join(BASE, 'js', 'data')
os.makedirs(OUT, exist_ok=True)

DECKS = {
    'zk':    {'name': '中考词汇',   'en': 'Junior High',  'color': '#7fb069', 'desc': '初中课标核心词，零基础起步'},
    'gk':    {'name': '高考词汇',   'en': 'Senior High',  'color': '#5aa9e6', 'desc': '高中课标+高考考纲词汇'},
    'cet4':  {'name': '四级词汇',   'en': 'CET-4',        'color': '#f2c14e', 'desc': '大学英语四级考纲词汇'},
    'cet6':  {'name': '六级词汇',   'en': 'CET-6',        'color': '#ef8354', 'desc': '大学英语六级考纲词汇'},
    'ky':    {'name': '考研词汇',   'en': 'Postgraduate', 'color': '#b388eb', 'desc': '考研英语大纲词汇'},
    'ielts': {'name': '雅思词汇',   'en': 'IELTS',        'color': '#48c9b0', 'desc': '雅思考试高频核心词'},
    'toefl': {'name': '托福词汇',   'en': 'TOEFL',        'color': '#f778ba', 'desc': '托福考试高频核心词'},
    'gre':   {'name': 'GRE词汇',    'en': 'GRE',          'color': '#95a5a6', 'desc': 'GRE红宝书核心词，难度最高'},
}

# 功能词（冠词/代词/系动词/助动词/基础虚词）不适合做单词卡，全部剔除
STOP = set('''a an the and or but if so as of at by for with to from in on into onto up down out off
is am are was were be been being do does did doing have has had having
he him his she her hers it its they them their we us our you your i me my mine this that these those
what which who whom whose when where why how
all any both each few more most other some such no nor not only own same than too very
can could will would shall should may might must just now then once here there again s t don
its it's they're i'm don't didn't doesn't isn't aren't wasn't weren't
ok okay yes no oh ah eh uh mm hmm mr mrs ms st dr
'''.split())

def is_function_word(w):
    return w.lower() in STOP

def clean_translation(t):
    if not t:
        return ''
    lines = []
    for ln in t.split('\n'):
        ln = ln.strip()
        if not ln or ln.startswith('['):  # 去掉 [网络]/[医] 等杂项
            continue
        lines.append(ln)
        if len(lines) >= 3:
            break
    s = '；'.join(lines)
    return s[:120]

def clean_pos(pos):
    if not pos:
        return ''
    # pos 形如 "n:100,v:20" -> 取词性缩写
    parts = [p.split(':')[0] for p in pos.split(',') if p]
    return ','.join(parts[:3])

def main():
    buckets = {k: {} for k in DECKS}  # deck -> {word: record} 去重
    n = 0
    with open(SRC, encoding='utf-8', newline='') as f:
        for row in csv.DictReader(f):
            n += 1
            w = (row.get('word') or '').strip()
            tag = (row.get('tag') or '').strip()
            trans = clean_translation(row.get('translation') or '')
            if not w or not tag or not trans:
                continue
            if any(c in w for c in ' \'"') or w.startswith('-') or w.endswith('-'):
                continue  # 跳过词组、撇号词、词缀
            if not re.fullmatch(r"[A-Za-z][A-Za-z\-]*", w):
                continue
            if is_function_word(w):
                continue  # 剔除冠词/代词/助动词等功能词
            try:
                frq = int(row.get('frq') or 0)
            except ValueError:
                frq = 0
            try:
                collins = int(row.get('collins') or 0)
            except ValueError:
                collins = 0
            rec = {
                'w': w,
                'p': (row.get('phonetic') or '').strip(),
                't': trans,
                'pos': clean_pos(row.get('pos') or ''),
                'frq': frq,
                'c': collins,
                'ex': (row.get('exchange') or '').strip(),
            }
            for d in tag.split():
                if d in buckets and w not in buckets[d]:
                    buckets[d][w] = rec
    print('扫描行数:', n)

    manifest = {}
    for dk, meta in DECKS.items():
        words = list(buckets[dk].values())
        # 排序：有词频的按 frq 升序，frq=0 的排最后（按 collins 降序、字母序）
        words.sort(key=lambda r: (r['frq'] == 0, r['frq'] if r['frq'] else 999999, -r['c'], r['w']))
        # 难度分档：按排序位次 5 档；同时剥离排序用字段，生成最终记录
        total = len(words)
        final = []
        for i, r in enumerate(words):
            rec = {'w': r['w'], 'p': r['p'], 't': r['t'], 'pos': r['pos'],
                   'lv': min(5, i * 5 // max(1, total) + 1)}
            if r['ex']:
                rec['ex'] = r['ex']
            final.append(rec)
        words = final
        path = os.path.join(OUT, 'deck_%s.js' % dk)
        with open(path, 'w', encoding='utf-8') as f:
            f.write('window.DECK_%s=' % dk)
            json.dump(words, f, ensure_ascii=False, separators=(',', ':'))
            f.write(';')
        size = os.path.getsize(path)
        manifest[dk] = dict(meta, count=total)
        print('%-6s %6d 词  %.1f KB' % (dk, total, size / 1024))

    with open(os.path.join(OUT, 'deck_manifest.js'), 'w', encoding='utf-8') as f:
        f.write('window.DECK_MANIFEST=')
        json.dump(manifest, f, ensure_ascii=False, indent=1)
        f.write(';')
    print('manifest 完成')

if __name__ == '__main__':
    main()
