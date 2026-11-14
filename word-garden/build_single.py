# -*- coding: utf-8 -*-
"""build_single.py — 将单词花园合并为单文件 index_single.html
将 CSS + 8 个 JS 模块 + 38 个题库 part + manifest + curated 例句内联进一个 HTML。
- 完整词表 deck_*.js（5.5MB，仅供词库管理浏览）不内联；词库管理改为基于精写题库浏览。
- 学习进度存档数据仍在 localStorage（"存档数据另存"）。
用法：python build_single.py
"""
import re, os, json

ROOT = os.path.dirname(os.path.abspath(__file__))

def read(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()

# ── 1. 收集题库 part 数据（内联为 JSON 对象） ──
DECKS = ['qishang','qixia','bashang','baxia','jiushang','jiuxia']
bank_parts = {}   # deck -> [ [ ... ], [ ... ] ]
for d in DECKS:
    lst = []
    i = 1
    while True:
        p = 'data/questions/%s_part%d.js' % (d, i)
        fp = os.path.join(ROOT, p)
        if not os.path.exists(fp):
            break
        code = read(p)
        s = code.index('=[') + 1
        e = code.rindex(']')
        arr = json.loads(code[s:e+1])
        lst.append(arr)
        i += 1
    bank_parts[d] = lst

# 统计
total_words = sum(sum(len(p) for p in lst) for lst in bank_parts.values())

# ── 2. manifest（从 bank.js 内提取，保证一致） ──
MANIFEST = {
    "qishang": {"name": "七年级上册", "en": "Grade 7A", "color": "#7fb069", "unit": 8, "desc": "外研版七上 · 入门词汇"},
    "qixia":   {"name": "七年级下册", "en": "Grade 7B", "color": "#5aa9e6", "unit": 8, "desc": "外研版七下 · 基础词汇"},
    "bashang": {"name": "八年级上册", "en": "Grade 8A", "color": "#f2c14e", "unit": 8, "desc": "外研版八上 · 进阶词汇"},
    "baxia":   {"name": "八年级下册", "en": "Grade 8B", "color": "#ef8354", "unit": 8, "desc": "外研版八下 · 进阶词汇"},
    "jiushang":{"name": "九年级上册", "en": "Grade 9A", "color": "#b388eb", "unit": 8, "desc": "外研版九上 · 中考核心"},
    "jiuxia":  {"name": "九年级下册", "en": "Grade 9B", "color": "#48c9b0", "unit": 8, "desc": "外研版九下 · 中考冲刺"},
}
# 为 manifest 补 count
for d, lst in bank_parts.items():
    MANIFEST[d]['count'] = sum(len(p) for p in lst)

# ── 3. curated 例句（JS 对象字面量，直接内联原始 JS） ──
curated_js = read('js/data/examples_curated.js')
# 去掉可能的注释首行，保留 window.CURATED={...}; 主体
curated_js = re.sub(r'//[^\n]*\n', '\n', curated_js).strip()

# ── 4. JS 模块源码 ──
mods = ['store','storage','srs','tts','mascot','game','data','bank','charts','lesson','study','views','app']
js_mods = {}
for m in mods:
    js_mods[m] = read('js/%s.js' % m)

# ── 5. CSS ──
css = read('css/style.css')

# ── 6. 组装 HTML ──
bank_json = json.dumps(bank_parts, ensure_ascii=False, separators=(',', ':'))
manifest_json = json.dumps(MANIFEST, ensure_ascii=False, separators=(',', ':'))

# ── 2b. 课本单元划分（unit_map.js） ──
unit_map_js = read('data/units/unit_map.js')

# ── 2c. 定级题库（placement_bank.js） ──
placement_bank_js = read('data/placement_bank.js')

html = '''<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#7fb069">
<title>单词花园 · 清新治愈背单词</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌿</text></svg>">
<style>
__CSS__
</style>
</head>
<body>

<!-- ═══ 顶部导航 ═══ -->
<header id="topbar">
  <div class="logo" onclick="App.goHome()">🌿<span>单词花园</span></div>
  <nav class="main-nav">
    <button class="nav-btn on" data-view="home">🏠 闯关</button>
    <button class="nav-btn" data-view="manage">📚 词库</button>
    <button class="nav-btn" data-view="stats">📊 统计</button>
    <button class="nav-btn" data-view="settings">⚙️ 设置</button>
  </nav>
  <div class="top-right">
    <span id="streak-pill" class="pill streak">🔥 0 天</span>
    <div class="pill progress-pill" title="今日学习进度">
      <span id="today-pill">🌿 今日 <b>0</b> / 50</span>
      <div class="pill-track"><div id="today-fill"></div></div>
    </div>
    <button id="user-pill" class="user-pill" style="display:none"></button>
  </div>
</header>

<!-- ═══ 中部沉浸区 ═══ -->
<main id="view"></main>

<!-- ═══ 底部 Tab 导航（移动端显示） ═══ -->
<nav id="tabbar" class="tabbar">
  <button class="tab-btn on" data-view="home"><span class="tab-ico">🏠</span><span class="tab-label">闯关</span></button>
  <button class="tab-btn" data-view="manage"><span class="tab-ico">📚</span><span class="tab-label">词库</span></button>
  <button class="tab-btn" data-view="stats"><span class="tab-ico">📊</span><span class="tab-label">统计</span></button>
  <button class="tab-btn" data-view="settings"><span class="tab-ico">⚙️</span><span class="tab-label">设置</span></button>
</nav>

<!-- ═══ 底部操作栏（卡片学习时显示） ═══ -->
<footer id="actionbar" class="hidden">
  <div class="act-side">
    <button id="act-fav" class="icon-btn lg" title="收藏（F）">⭐</button>
    <button id="act-nb" class="icon-btn lg" title="加入生词本（B）">📒</button>
    <button id="act-prev" class="icon-btn lg" title="上一个（←）">⬅</button>
  </div>
  <div class="act-judge">
    <button id="act-know" class="judge-btn know"><b>认识</b><span>快捷键 1</span></button>
    <button id="act-vague" class="judge-btn vague"><b>模糊</b><span>快捷键 2</span></button>
    <button id="act-unknown" class="judge-btn unknown"><b>不认识</b><span>快捷键 3</span></button>
  </div>
  <div class="act-side">
    <button id="act-next" class="icon-btn lg" title="下一个（→）">➡</button>
  </div>
</footer>

<script>
/* ============ 内联数据：精写题库（8 库 {deck:[[...],[...]]}） ============ */
window.BANK_PARTS = __BANK_JSON__;

/* ============ 内联数据：词库 manifest ============ */
/* 课本单元划分 */
__UNIT_MAP_JS__

/* 定级题库 */
__PLACEMENT_BANK_JS__

window.BANK_MANIFEST = __MANIFEST_JSON__;

/* ============ 内联数据：精配例句/近义词 ============ */
__CURATED_JS__
</script>
<script>
__MOD_STORE__
</script>
<script>
__MOD_STORAGE__
__MOD_SRS__
</script>
<script>
__MOD_TTS__
</script>
<script>
__MOD_MASCOT__
</script>
<script>
__MOD_GAME__
</script>
<script>
__MOD_DATA__
</script>
<script>
__MOD_BANK__
</script>
<script>
__MOD_CHARTS__
</script>
<script>
__MOD_LESSON__
</script>
<script>
__MOD_STUDY__
</script>
<script>
__MOD_VIEWS__
</script>
<script>
__MOD_APP__
</script>
</body>
</html>
'''

html = html.replace('__CSS__', css)
html = html.replace('__BANK_JSON__', bank_json)
html = html.replace('__MANIFEST_JSON__', manifest_json)
html = html.replace('__UNIT_MAP_JS__', unit_map_js)
html = html.replace('__PLACEMENT_BANK_JS__', placement_bank_js)
html = html.replace('__CURATED_JS__', curated_js)
html = html.replace('__MOD_STORE__', js_mods['store'])
html = html.replace('__MOD_STORAGE__', js_mods['storage'])
html = html.replace('__MOD_SRS__', js_mods['srs'])
html = html.replace('__MOD_TTS__', js_mods['tts'])
html = html.replace('__MOD_MASCOT__', js_mods['mascot'])
html = html.replace('__MOD_GAME__', js_mods['game'])
html = html.replace('__MOD_DATA__', js_mods['data'])
html = html.replace('__MOD_BANK__', js_mods['bank'])
html = html.replace('__MOD_CHARTS__', js_mods['charts'])
html = html.replace('__MOD_LESSON__', js_mods['lesson'])
html = html.replace('__MOD_STUDY__', js_mods['study'])
html = html.replace('__MOD_VIEWS__', js_mods['views'])
html = html.replace('__MOD_APP__', js_mods['app'])

out = os.path.join(ROOT, 'index_single.html')
with open(out, 'w', encoding='utf-8') as f:
    f.write(html)

print('生成完成: index_single.html')
print('题库词条总数:', total_words, '| 题数:', total_words * 6)
print('文件大小: %.2f MB' % (os.path.getsize(out) / 1024 / 1024))
