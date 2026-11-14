# 单词花园 · 打包说明

本目录用于把「单词花园」的**单文件版**（`index_single.html`，零外部依赖）打包成 Windows 桌面程序（EXE）和 Android 应用（APK）。

## 目录结构

```
packaging/
├── webview2/            # Windows 桌面版（.NET + WebView2 方案，最终交付）
│   ├── Program.cs       # WinForms WebView2 壳
│   ├── WordGarden.csproj
│   ├── app.manifest
│   └── index.html       # 单文件版应用（运行时加载）
├── android/             # APK（Capacitor 套壳）
│   ├── www/index.html   # 单文件版应用
│   ├── capacitor.config.json
│   ├── package.json
│   └── android/         # 生成的安卓工程
└── release/             # 最终交付产物
    ├── WordGarden.exe   # Windows 精简版（约 2.6MB）
    ├── index.html       # 程序数据（必须与 exe 同目录）
    ├── WordGarden.apk   # 安卓版
    ├── dotnet-desktop-runtime-8.0.11-win-x64.exe  # .NET 8 运行库
    └── README.md        # 给老师的使用说明
```

## Windows 桌面版（WebView2/.NET）

**原理**：用 C# WinForms + WebView2 套壳加载本地 `index.html`。体积约 2.6MB（不打包浏览器内核，用系统自带的 WebView2），依赖 .NET 8 运行时。

**存储位置**：`%APPDATA%\单词花园`（localStorage 落在这里，不是缓存）。

**编译**：

```bash
cd webview2
dotnet publish -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o publish
```

编译后需把 `index.html` 复制到 publish 目录，与 exe 放一起。

## Android 版（Capacitor）

**原理**：Capacitor 把 `www/index.html` 塞进 Android WebView。

**存储位置**：`/data/data/com.wordgarden.app/`（应用私有目录，不是缓存）。

**打包**（需 Android SDK + JDK 17）：

```bash
cd android
npm install
npx cap copy android
cd android
gradle assembleDebug    # 用本机 ~/gradle-local/gradle-8.2.1 或 gradlew
```

## 踩坑记录

1. **工程路径含中文会失败**：Gradle / electron-builder 都报 non-ASCII 错误，需纯英文路径。
2. **Gradle 下载源 SSL 失败**：手动下载 Gradle 8.2.1 到 `~/gradle-local/`。
3. **JDK 用 17**：JDK 25 与 Gradle 8.2.1 不兼容。
4. **compileSdk 用 34**：android-37 的 package.xml 与工具版本不兼容。
