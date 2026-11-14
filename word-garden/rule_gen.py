# -*- coding: utf-8 -*-
"""
rule_gen.py — 规则引擎题库生成器
从 deck_*.js 抽取词表，为每个词生成多道结构化题目，输出 data/bank_*.json。
题目格式与"大模型精写"完全一致，程序统一读取，不再运行时公式生成。

题型（type）：
  meaning  选出正确释义（题干=英文单词，选项=中文释义，answer=中文）
  reverse  释义选单词（题干=中文释义，选项=英文单词，answer=英文）
  spell    拼写（题干=中文释义，answer=英文，audio 可读）
  listen   听力辨词（题干=发音，选项=英文形近词，answer=英文）
  cloze    语境填空（题干=英文例句挖空，选项=英文单词，answer=英文）
  exchange 词形变化（题干=中文+词性提示，选项=词形，answer=变化形）
"""
import json, os, re, random

BASE = os.path.dirname(os.path.abspath(__file__))
DECKS = ['zk', 'gk', 'cet4', 'cet6', 'ky', 'ielts', 'toefl', 'gre']
OUT = os.path.join(BASE, 'data')
os.makedirs(OUT, exist_ok=True)

# 动词原型 -> 不规则变化 (过去式, 过去分词, 现在分词, 三单)
IRREG = {
    'go': ('went', 'gone', 'going', 'goes'),
    'come': ('came', 'come', 'coming', 'comes'),
    'take': ('took', 'taken', 'taking', 'takes'),
    'make': ('made', 'made', 'making', 'makes'),
    'see': ('saw', 'seen', 'seeing', 'sees'),
    'get': ('got', 'gotten', 'getting', 'gets'),
    'give': ('gave', 'given', 'giving', 'gives'),
    'know': ('knew', 'known', 'knowing', 'knows'),
    'think': ('thought', 'thought', 'thinking', 'thinks'),
    'find': ('found', 'found', 'finding', 'finds'),
    'tell': ('told', 'told', 'telling', 'tells'),
    'say': ('said', 'said', 'saying', 'says'),
    'become': ('became', 'become', 'becoming', 'becomes'),
    'begin': ('began', 'begun', 'beginning', 'begins'),
    'bring': ('brought', 'brought', 'bringing', 'brings'),
    'buy': ('bought', 'bought', 'buying', 'buys'),
    'choose': ('chose', 'chosen', 'choosing', 'chooses'),
    'do': ('did', 'done', 'doing', 'does'),
    'draw': ('drew', 'drawn', 'drawing', 'draws'),
    'drink': ('drank', 'drunk', 'drinking', 'drinks'),
    'drive': ('drove', 'driven', 'driving', 'drives'),
    'eat': ('ate', 'eaten', 'eating', 'eats'),
    'fall': ('fell', 'fallen', 'falling', 'falls'),
    'feel': ('felt', 'felt', 'feeling', 'feels'),
    'forget': ('forgot', 'forgotten', 'forgetting', 'forgets'),
    'grow': ('grew', 'grown', 'growing', 'grows'),
    'have': ('had', 'had', 'having', 'has'),
    'hear': ('heard', 'heard', 'hearing', 'hears'),
    'hold': ('held', 'held', 'holding', 'holds'),
    'keep': ('kept', 'kept', 'keeping', 'keeps'),
    'leave': ('left', 'left', 'leaving', 'leaves'),
    'lose': ('lost', 'lost', 'losing', 'loses'),
    'meet': ('met', 'met', 'meeting', 'meets'),
    'pay': ('paid', 'paid', 'paying', 'pays'),
    'put': ('put', 'put', 'putting', 'puts'),
    'read': ('read', 'read', 'reading', 'reads'),
    'run': ('ran', 'run', 'running', 'runs'),
    'sit': ('sat', 'sat', 'sitting', 'sits'),
    'sleep': ('slept', 'slept', 'sleeping', 'sleeps'),
    'speak': ('spoke', 'spoken', 'speaking', 'speaks'),
    'spend': ('spent', 'spent', 'spending', 'spends'),
    'stand': ('stood', 'stood', 'standing', 'stands'),
    'teach': ('taught', 'taught', 'teaching', 'teaches'),
    'wear': ('wore', 'worn', 'wearing', 'wears'),
    'win': ('won', 'won', 'winning', 'wins'),
    'write': ('wrote', 'written', 'writing', 'writes'),
    'build': ('built', 'built', 'building', 'builds'),
    'break': ('broke', 'broken', 'breaking', 'breaks'),
    'catch': ('caught', 'caught', 'catching', 'catches'),
    'cut': ('cut', 'cut', 'cutting', 'cuts'),
    'fight': ('fought', 'fought', 'fighting', 'fights'),
    'fly': ('flew', 'flown', 'flying', 'flies'),
    'hide': ('hid', 'hidden', 'hiding', 'hides'),
    'hit': ('hit', 'hit', 'hitting', 'hits'),
    'lead': ('led', 'led', 'leading', 'leads'),
    'lie': ('lay', 'lain', 'lying', 'lies'),
    'ride': ('rode', 'ridden', 'riding', 'rides'),
    'rise': ('rose', 'risen', 'rising', 'rises'),
    'sell': ('sold', 'sold', 'selling', 'sells'),
    'send': ('sent', 'sent', 'sending', 'sends'),
    'sing': ('sang', 'sung', 'singing', 'sings'),
    'swim': ('swam', 'swum', 'swimming', 'swims'),
    'throw': ('threw', 'thrown', 'throwing', 'throws'),
    'understand': ('understood', 'understood', 'understanding', 'understands'),
    'wake': ('woke', 'woken', 'waking', 'wakes'),
    'mean': ('meant', 'meant', 'meaning', 'means'),
    'let': ('let', 'let', 'letting', 'lets'),
    'set': ('set', 'set', 'setting', 'sets'),
    'show': ('showed', 'shown', 'showing', 'shows'),
    'shut': ('shut', 'shut', 'shutting', 'shuts'),
}

# 名词不规则复数
IRREG_PLURAL = {
    'man': 'men', 'woman': 'women', 'child': 'children', 'foot': 'feet',
    'tooth': 'teeth', 'mouse': 'mice', 'person': 'people', 'goose': 'geese',
    'leaf': 'leaves', 'knife': 'knives', 'wife': 'wives', 'life': 'lives',
    'half': 'halves', 'wolf': 'wolves', 'shelf': 'shelves',
}

# 形容词比较级/最高级不规则
IRREG_ADJ = {
    'good': ('better', 'best'), 'bad': ('worse', 'worst'),
    'far': ('farther', 'farthest'), 'little': ('less', 'least'),
    'many': ('more', 'most'), 'much': ('more', 'most'),
}


def load_deck(deck):
    txt = open(os.path.join(BASE, 'js', 'data', 'deck_%s.js' % deck), encoding='utf-8').read()
    txt = txt[txt.index('=') + 1:].rstrip().rstrip(';')
    return json.loads(txt)


def gloss(word):
    """取第一义，去掉词性前缀，截断到第一个分隔符"""
    t = word.get('t', '')
    # 取第一个词性段（换行分隔的多词性）
    first = t.split('\n')[0].strip()
    first = re.sub(r'^[a-z]{1,4}\.\s*', '', first).strip()
    for sep in '，、；':
        if sep in first:
            first = first.split(sep)[0]
    # 去掉可能残留的词性前缀（vt./n. 等）
    first = re.sub(r'^[a-z]{1,4}\.\s*', '', first).strip()
    return first or t.split('\n')[0]


def pos_of(word):
    t = word.get('t', '')
    p = word.get('pos', '') or ''
    if p:
        return p.split(',')[0].split(':')[0]
    m = re.match(r'^([a-z]{1,4})\.', t)
    return m.group(1) if m else ''


def is_verb(word):
    p = pos_of(word)
    return 'v' == p[:1] or (p and p[0] in 'vt')


def is_noun(word):
    p = pos_of(word)
    return p and p[0] == 'n'


def is_adj(word):
    p = pos_of(word)
    return p and p[0] == 'a'


def is_adv(word):
    p = pos_of(word)
    return p and 'ad' == p[:2]


def verb_forms(base):
    if base in IRREG:
        return IRREG[base]
    if base.endswith('e'):
        ing = base[:-1] + 'ing'
        past = base + 'd'
    elif base.endswith(('y',)) and base[-2:-1] and base[-2] not in 'aeiou' and len(base) > 2:
        ing = base + 'ing'
        past = base[:-1] + 'ied'
    elif len(base) >= 3 and base[-1] not in 'aeiouwx' and base[-2] in 'aeiou' and base[-3] not in 'aeiou':
        ing = base + base[-1] + 'ing'
        past = base + base[-1] + 'ed'
    else:
        ing = base + 'ing'
        past = base + 'ed'
    pp = past
    s3 = base + ('es' if base.endswith(('s', 'x', 'ch', 'sh', 'o')) else 's')
    return (past, pp, ing, s3)


def plural(base):
    if base in IRREG_PLURAL:
        return IRREG_PLURAL[base]
    if base.endswith(('s', 'x', 'ch', 'sh')):
        return base + 'es'
    if base.endswith('y') and len(base) > 1 and base[-2] not in 'aeiou':
        return base[:-1] + 'ies'
    if base.endswith('f'):
        return base[:-1] + 'ves'
    if base.endswith('fe'):
        return base[:-2] + 'ves'
    return base + 's'


def adj_forms(base):
    if base in IRREG_ADJ:
        return IRREG_ADJ[base]
    if len(base) <= 6:
        if base.endswith('e'):
            return (base + 'r', base + 'st')
        if base.endswith('y') and base[-2] not in 'aeiou':
            return (base[:-1] + 'ier', base[:-1] + 'iest')
        if base.endswith(('t', 'd', 'n', 'g')):
            return (base + base[-1] + 'er', base + base[-1] + 'est')
        return (base + 'er', base + 'est')
    return ('more ' + base, 'most ' + base)


def build_questions(word, all_words):
    """为一个词生成题目列表（按难度决定题量）"""
    w = word['w']
    g = gloss(word)
    phonetic = word.get('p', '')
    lv = word.get('lv', 3)
    # 难度决定题量：难度越高题越多，但题型覆盖固定
    qs = []

    # 1) meaning —— 选义（必须有）
    qs.append({'type': 'meaning', 'stem': w, 'answer': g,
               'options': [g] + distract_gloss(word, all_words, 3)})

    # 2) reverse —— 释义选词（难度2+）
    if lv >= 2:
        qs.append({'type': 'reverse', 'stem': g, 'answer': w,
                   'options': [w] + distract_word(word, all_words, 3)})

    # 3) spell —— 拼写
    qs.append({'type': 'spell', 'stem': g, 'answer': w, 'audio': True})

    # 4) listen —— 听力辨词（形近干扰）
    qs.append({'type': 'listen', 'stem': w, 'answer': w,
               'options': [w] + distract_similar(word, all_words, 3)})

    # 5) cloze —— 语境填空（难度2+）
    if lv >= 2:
        ex = cloze_sentence(word)
        if ex:
            qs.append({'type': 'cloze', 'stem': ex, 'answer': w,
                       'options': [w] + distract_word(word, all_words, 3)})

    # 6) exchange —— 词形变化（动词/名词/形容词，难度3+，且是易错变化才出）
    if lv >= 3:
        exch = exchange_question(word)
        if exch:
            qs.append(exch)

    # 难词额外重复核心题型（体现"难词多出"）
    if lv >= 4:
        qs.append({'type': 'meaning', 'stem': w, 'answer': g,
                   'options': [g] + distract_gloss(word, all_words, 3)})
    if lv >= 5:
        qs.append({'type': 'reverse', 'stem': g, 'answer': w,
                   'options': [w] + distract_word(word, all_words, 3)})

    return qs


def cloze_sentence(word):
    w = word['w']
    g = gloss(word)
    if is_verb(word):
        return 'They often %s together after school.' % w
    if is_adj(word):
        return 'It was a very %s day for everyone.' % w
    if is_adv(word):
        return 'She spoke so %s that everyone listened.' % w
    if is_noun(word):
        return 'The %s plays an important role in our life.' % w
    return 'This is related to the word "%s".' % w


def exchange_question(word):
    w = word['w']
    if is_verb(word) and w in IRREG:
        past, pp, ing, s3 = IRREG[w]
        return {'type': 'exchange', 'stem': '写出动词 "%s" 的过去式' % w,
                'answer': past, 'options': [past, pp, ing, s3]}
    if is_noun(word) and w in IRREG_PLURAL:
        pl = IRREG_PLURAL[w]
        return {'type': 'exchange', 'stem': '写出名词 "%s" 的复数形式' % w,
                'answer': pl, 'options': [pl, w + 's', w + 'es', w]}
    if is_adj(word) and w in IRREG_ADJ:
        cp, sp = IRREG_ADJ[w]
        return {'type': 'exchange', 'stem': '写出形容词 "%s" 的比较级' % w,
                'answer': cp, 'options': [cp, sp, 'more ' + w, w + 'er']}
    return None


def distract_gloss(target, all_words, n):
    seen = {gloss(target)}
    out = []
    pool = [w for w in all_words if w['w'] != target['w']]
    random.shuffle(pool)
    for w in pool:
        g = gloss(w)
        if g and g not in seen and len(g) <= 6:
            seen.add(g); out.append(g)
        if len(out) >= n:
            break
    while len(out) < n:
        out.append('（无意义项）')
    return out


def distract_word(target, all_words, n):
    seen = {target['w']}
    out = []
    pool = [w for w in all_words if abs((w.get('lv', 3)) - (target.get('lv', 3))) <= 1 and w['w'] != target['w']]
    if len(pool) < n:
        pool = [w for w in all_words if w['w'] != target['w']]
    random.shuffle(pool)
    for w in pool:
        if w['w'] not in seen and len(w['w']) >= 3:
            seen.add(w['w']); out.append(w['w'])
        if len(out) >= n:
            break
    return out


def distract_similar(target, all_words, n):
    """形近/音近干扰"""
    w = target['w']
    seen = {w}
    out = []
    # 优先选相同开头/长度接近的词
    pool = [x['w'] for x in all_words if x['w'] != w and abs(len(x['w']) - len(w)) <= 2]
    random.shuffle(pool)
    for c in pool:
        if c not in seen:
            # 至少共享一个首字母或相似
            if c[0] == w[0] or _edit_distance(c, w) <= 3:
                seen.add(c); out.append(c)
        if len(out) >= n:
            break
    # 补：同首字母任意词
    if len(out) < n:
        for c in pool:
            if c not in seen and c[0] == w[0]:
                seen.add(c); out.append(c)
            if len(out) >= n:
                break
    # 兜底：任意词
    if len(out) < n:
        for c in pool:
            if c not in seen:
                seen.add(c); out.append(c)
            if len(out) >= n:
                break
    return out


def _edit_distance(a, b):
    m, n = len(a), len(b)
    dp = list(range(n + 1))
    for i in range(1, m + 1):
        prev = dp[0]; dp[0] = i
        for j in range(1, n + 1):
            tmp = dp[j]
            dp[j] = min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] != b[j - 1]))
            prev = tmp
    return dp[n]


def main():
    random.seed(42)
    for deck in DECKS:
        words = load_deck(deck)
        bank = {'deck': deck, 'generator': 'rule-v1', 'words': {}}
        for w in words:
            entry = {
                'phonetic': w.get('p', ''),
                'gloss': gloss(w),
                'pos': pos_of(w),
                'difficulty': w.get('lv', 3),
                'questions': build_questions(w, words),
            }
            bank['words'][w['w']] = entry
        path = os.path.join(OUT, 'bank_%s.json' % deck)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(bank, f, ensure_ascii=False, separators=(',', ':'))
        nq = sum(len(e['questions']) for e in bank['words'].values())
        print('%-6s %5d 词 %6d 题  %.1f KB' % (deck, len(bank['words']), nq, os.path.getsize(path) / 1024))


if __name__ == '__main__':
    main()
