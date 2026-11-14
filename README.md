# 单词花园 (Word Garden)

一款面向**初中生**的英语背单词应用，覆盖**外研版（2024 新版）初中英语全六册**词汇。纯 HTML/CSS/原生 JS 实现，零外部依赖，`file://` 即可运行。

## 特性

- **1330 词 / 7980 题**：七上、七下、八上、八下、九上、九下全六册，每词 6 种题型
- **按课本课时分课**：146 个课时，每课 8~12 词，先教后考
- **六种题型**：中译英、英译中、听音选词、完形填空、词性变形、近义词
- **真实记忆曲线**：SM-2 变体 + 遗忘曲线，科学安排复习
- **自动错题本**：答错自动收录，连续答对 2 次移出
- **多用户管理**：一台设备可存多个学生账号
- **吉祥物陪伴**：小狗「旺仔」SVG 吉祥物，14 种表情
- **本地存档**：localStorage / IndexedDB / 本地文件，防浏览器清缓存丢失

## 目录结构

```
.
├── word-garden/          # 源码（多文件版 + 单文件版）
│   ├── index.html        # 多文件版入口
│   ├── index_single.html # 单文件版（零依赖，可直接交付）
│   ├── css/              # 样式
│   ├── js/               # 逻辑（store/srs/bank/lesson/mascot/...）
│   ├── data/             # 题库、词表、课时映射、词典
│   └── tools/            # 构建/质检脚本
├── packaging/            # 打包工程（EXE / APK）
│   ├── webview2/         # Windows 桌面版（.NET + WebView2）
│   ├── android/          # Android 版（Capacitor）
│   └── release/          # 最终交付产物
└── .gitignore
```

## 快速开始

直接双击打开 `word-garden/index_single.html` 即可运行（单文件版，零依赖）。

或启动一个本地服务器：

```bash
cd word-garden
python -m http.server 8000
# 浏览器访问 http://localhost:8000
```

## 打包与分发

详见 `packaging/README.md`。构建产物通过 **GitHub Release** 分发（不在仓库内提交二进制）：

| 文件 | 说明 |
|---|---|
| `WordGarden.exe` + `index.html` | Windows 桌面版（需 .NET 8 运行时） |
| `WordGarden.apk` | Android 版 |
| `dotnet-desktop-runtime-8.0.11-win-x64.exe` | .NET 8 运行库安装包 |

构建完成后，在仓库的 **Releases** 页面新建一个 Release，把 `packaging/release/` 下的这几个文件作为附件上传即可。

## 数据说明

- `data/words/*.txt`：六册词表（英文 | 音标 | 词性 | 释义）
- `data/questions/*.js`：六册精写题库（每词 6 题）
- `data/units/unit_map.js`：按课本课时划分
- `data/ecdict.csv`：英汉词典（77 万词条，用于题库质检与生成）
