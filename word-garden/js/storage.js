/* storage.js — 本地文件存档层
 *
 * 【目标】防止浏览器清理数据后学习进度丢失
 *
 * 【策略：三级存储，按环境自动降级】
 *  1. localStorage  —— 同步、立即可用（主存储）
 *  2. IndexedDB     —— 异步、大容量、不易被清（备份存储）
 *  3. 本地文件      —— File System Access API 写入硬盘 .json（最终保险）
 *
 * 【PC / 手机自动识别】
 *  - 桌面 Chrome / Edge：支持 showSaveFilePicker()，可授权后自动写入硬盘文件
 *  - 桌面 Firefox / Safari：退化为「导出存档文件」（手动下载）
 *  - 手机 / 平板：无法直接写文件，退化为 IndexedDB + 导出分享
 *  - file:// 协议下 File System Access API 不可用，自动降级
 *
 * 【使用方式】
 *  Storage.init()             初始化，检测环境
 *  Storage.sync()             每次数据变化后调用（防抖写 IndexedDB）
 *  Storage.connectFile()      用户点击「连接到本地文件」时调用
 *  Storage.exportFile()       导出存档为 .json 下载
 *  Storage.importFile(file)   从 .json 文件恢复
 */
(function () {
  var IDB_NAME = 'wordgarden';
  var IDB_STORE = 'backup';
  var DB = null;
  var fileHandle = null;      // FileSystemFileHandle
  var _syncTimer = null;
  var _syncPending = false;

  function isDesktop() {
    var ua = navigator.userAgent || '';
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return false;
    if (/iPad|iPhone|iPod/.test(ua)) return false;
    return true;
  }

  /* 是否在 file:// 协议下（File System Access API 不可用） */
  function isFileProtocol() {
    return location.protocol === 'file:';
  }

  /* File System Access API 支持检测 */
  function hasFSA() {
    return !!(window.showSaveFilePicker && window.showOpenFilePicker);
  }

  /* ---------- IndexedDB ---------- */
  function openDB() {
    return new Promise(function (resolve) {
      if (DB) return resolve(DB);
      if (!window.indexedDB) return resolve(null);
      var req;
      try { req = indexedDB.open(IDB_NAME, 1); }
      catch (e) { return resolve(null); }
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = function () { DB = req.result; resolve(DB); };
      req.onerror = function () { resolve(null); };
    });
  }

  function idbSet(key, val) {
    return openDB().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).put(val, key);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    }).catch(function () { return false; });
  }

  function idbGet(key) {
    return openDB().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(IDB_STORE, 'readonly');
          var r = tx.objectStore(IDB_STORE).get(key);
          r.onsuccess = function () { resolve(r.result || null); };
          r.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    }).catch(function () { return null; });
  }

  function idbKeys() {
    return openDB().then(function (db) {
      if (!db) return [];
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(IDB_STORE, 'readonly');
          var r = tx.objectStore(IDB_STORE).getAllKeys();
          r.onsuccess = function () { resolve(r.result || []); };
          r.onerror = function () { resolve([]); };
        } catch (e) { resolve([]); }
      });
    }).catch(function () { return []; });
  }

  /* ---------- 存储层 ---------- */
  var Storage = {
    mode: 'local',            // local | idb | file
    platform: 'unknown',      // desktop | mobile
    fileConnected: false,
    fileName: '',
    lastSync: 0,
    supportsFile: false,

    init: function () {
      this.platform = isDesktop() ? 'desktop' : 'mobile';
      this.supportsFile = hasFSA() && !isFileProtocol();
      if (this.supportsFile) this.mode = 'file';
      else if (window.indexedDB) this.mode = 'idb';
      else this.mode = 'local';
      return this;
    },

    /* 环境描述（给设置页显示） */
    envText: function () {
      if (this.mode === 'file') return '🖥️ 电脑模式 · 已连接本地文件';
      if (this.mode === 'idb') return '📱 手机模式 · IndexedDB 备份';
      if (this.mode === 'local') return '⚠️ 基础模式 · 建议导出备份';
      return '未知';
    },

    /* 写入所有用户 + 元数据到 IndexedDB 与本地文件 */
    sync: function (force) {
      if (force) {
        if (_syncTimer) { clearTimeout(_syncTimer); _syncTimer = null; }
        return this._write();
      }
      if (_syncTimer) return Promise.resolve();
      _syncPending = true;
      _syncTimer = setTimeout(function () {
        _syncTimer = null;
        _syncPending = false;
        Storage._write();
      }, 800);   // 800ms 防抖，避免频繁写盘
      return Promise.resolve();
    },

    _write: function () {
      var self = this;
      if (!window.Store || !Store.activeId) return Promise.resolve(false);
      var payload = {
        v: 3,
        exportedAt: Date.now(),
        meta: Store._meta(),
        userId: Store.activeId,
        state: Store.state
      };
      var text = JSON.stringify(payload);
      var idbKey = 'user:' + Store.activeId;

      // 1) IndexedDB
      var p1 = idbSet(idbKey, payload).then(function (ok) {
        if (ok) idbSet('meta:last', { meta: Store._meta(), at: Date.now() });
        return ok;
      });

      // 2) 本地文件（若已授权）
      var p2 = Promise.resolve(false);
      if (fileHandle) {
        p2 = fileHandle.createWritable().then(function (w) {
          return w.write(text).then(function () { return w.close(); });
        }).then(function () { return true; })
          .catch(function (e) {
            console.warn('本地文件写入失败', e);
            self.fileConnected = false;
            fileHandle = null;
            return false;
          });
      }

      return Promise.all([p1, p2]).then(function (r) {
        self.lastSync = Date.now();
        return r[0] || r[1];
      });
    },

    /* 用户连接本地文件（PC 端 File System Access API） */
    connectFile: function () {
      var self = this;
      if (!this.supportsFile) {
        // 不支持则直接导出下载
        return this.exportFile();
      }
      return window.showSaveFilePicker({
        suggestedName: '单词花园存档_' + this._stamp() + '.json',
        types: [{
          description: '单词花园存档文件',
          accept: { 'application/json': ['.json'] }
        }]
      }).then(function (h) {
        fileHandle = h;
        self.fileConnected = true;
        self.fileName = h.name;
        self.mode = 'file';
        return self._write().then(function () {
          return { ok: true, name: h.name };
        });
      }).catch(function (e) {
        if (e && e.name === 'AbortError') return { ok: false, aborted: true };
        return { ok: false, error: e.message };
      });
    },

    /* 重新授权已有文件（浏览器重启后 handle 会丢失） */
    reconnectFile: function () {
      var self = this;
      if (!this.supportsFile) return Promise.resolve({ ok: false });
      return window.showOpenFilePicker({
        types: [{
          description: '单词花园存档文件',
          accept: { 'application/json': ['.json'] }
        }],
        multiple: false
      }).then(function (h) {
        fileHandle = h;
        self.fileConnected = true;
        self.fileName = h.name;
        self.mode = 'file';
        return h.getFile().then(function (f) { return f.text(); })
          .then(function (txt) {
            if (txt && txt.trim()) self._restore(txt);
            return { ok: true, name: h.name };
          });
      }).catch(function (e) {
        if (e && e.name === 'AbortError') return { ok: false, aborted: true };
        return { ok: false, error: e.message };
      });
    },

    /* 导出为下载文件（全平台可用） */
    exportFile: function () {
      if (!window.Store || !Store.activeId) return Promise.resolve({ ok: false });
      var payload = {
        v: 3,
        app: '单词花园',
        exportedAt: Date.now(),
        meta: Store._meta(),
        userId: Store.activeId,
        state: Store.state
      };
      var text = JSON.stringify(payload, null, 2);
      var blob = new Blob([text], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = '单词花园存档_' + this._stamp() + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      return Promise.resolve({ ok: true, name: a.download });
    },

    /* 从文件恢复（file:// 与移动端的主要恢复方式） */
    importFile: function (file) {
      var self = this;
      return file.text().then(function (txt) {
        self._restore(txt);
        return { ok: true };
      }).catch(function (e) {
        return { ok: false, error: e.message };
      });
    },

    /* 从文本恢复（内部） */
    _restore: function (txt) {
      var obj = JSON.parse(txt);
      if (!obj || !obj.state || !obj.state.settings) throw new Error('存档格式不正确');
      if (obj.meta && obj.meta.users) {
        try { localStorage.setItem('wordgarden.v2', JSON.stringify(obj.meta)); } catch (e) {}
        Store._meta();
        var uid = obj.userId || (obj.meta.users[0] && obj.meta.users[0].id);
        if (uid) {
          try { localStorage.setItem('wordgarden.user.' + uid, JSON.stringify(obj.state)); } catch (e) {}
          Store.activeId = uid;
          Store.state = obj.state;
        }
      } else if (obj.state) {
        Store.state = obj.state;
        Store.save();
      }
      // 恢复后同步到 IndexedDB
      this.sync(true);
      return true;
    },

    /* 从 IndexedDB 恢复（浏览器数据被清后但 IDB 还在时的兜底） */
    restoreFromBackup: function () {
      var self = this;
      if (!window.Store || !Store.activeId) return Promise.resolve({ ok: false });
      var idbKey = 'user:' + Store.activeId;
      return idbGet(idbKey).then(function (payload) {
        if (!payload || !payload.state) return { ok: false };
        self._restore(JSON.stringify(payload));
        return { ok: true };
      });
    },

    /* 列出 IndexedDB 中可恢复的用户 */
    listBackups: function () {
      return idbKeys().then(function (keys) {
        return keys.filter(function (k) { return k.indexOf('user:') === 0; });
      });
    },

    /* 备份是否存在 */
    hasBackup: function () {
      if (!window.Store || !Store.activeId) return Promise.resolve(false);
      return idbGet('user:' + Store.activeId).then(function (p) { return !!p; });
    },

    _stamp: function () {
      var d = new Date();
      function p(n) { return String(n).padStart(2, '0'); }
      return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes());
    }
  };

  window.Storage = Storage;
})();
