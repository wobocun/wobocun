/* 跟诊录 · IndexedDB 数据层
   全部数据只存在本机浏览器里，不上传任何服务器。 */
(function (global) {
  'use strict';

  var DB_NAME = 'genzhenlu';
  var DB_VER = 1;

  // 对象仓库定义：keyPath 与索引
  var STORES = {
    teachers: { keyPath: 'id', indexes: [['updatedAt', 'updatedAt']] },
    patients: { keyPath: 'id', indexes: [['teacherId', 'teacherId'], ['updatedAt', 'updatedAt']] },
    records:  { keyPath: 'id', indexes: [['patientId', 'patientId'], ['visitedAt', 'visitedAt']] },
    templates:{ keyPath: 'id', indexes: [['updatedAt', 'updatedAt']] },
    settings: { keyPath: 'k', indexes: [] }
  };

  var _db = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (e) {
        var db = req.result;
        Object.keys(STORES).forEach(function (name) {
          var def = STORES[name];
          if (!db.objectStoreNames.contains(name)) {
            var os = db.createObjectStore(name, { keyPath: def.keyPath });
            def.indexes.forEach(function (ix) {
              os.createIndex(ix[0], ix[1], { unique: false });
            });
          }
        });
      };
      req.onsuccess = function () { _db = req.result; resolve(_db); };
      req.onerror = function () { reject(req.error); };
      req.onblocked = function () { reject(new Error('数据库被其它标签页占用，请关闭后重试')); };
    });
  }

  function tx(storeName, mode) {
    return open().then(function (db) {
      return db.transaction(storeName, mode).objectStore(storeName);
    });
  }

  function req2p(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  var api = {
    put: function (store, obj) {
      return tx(store, 'readwrite').then(function (os) { return req2p(os.put(obj)); }).then(function () { return obj; });
    },
    putMany: function (store, arr) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var t = db.transaction(store, 'readwrite');
          var os = t.objectStore(store);
          arr.forEach(function (o) { os.put(o); });
          t.oncomplete = function () { resolve(arr.length); };
          t.onerror = function () { reject(t.error); };
        });
      });
    },
    get: function (store, key) {
      return tx(store, 'readonly').then(function (os) { return req2p(os.get(key)); });
    },
    all: function (store) {
      return tx(store, 'readonly').then(function (os) { return req2p(os.getAll()); });
    },
    del: function (store, key) {
      return tx(store, 'readwrite').then(function (os) { return req2p(os.delete(key)); });
    },
    delMany: function (store, keys) {
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var t = db.transaction(store, 'readwrite');
          var os = t.objectStore(store);
          keys.forEach(function (k) { os.delete(k); });
          t.oncomplete = function () { resolve(keys.length); };
          t.onerror = function () { reject(t.error); };
        });
      });
    },
    clear: function (store) {
      return tx(store, 'readwrite').then(function (os) { return req2p(os.clear()); });
    },
    byIndex: function (store, index, value) {
      return tx(store, 'readonly').then(function (os) { return req2p(os.index(index).getAll(value)); });
    },
    /** 读出所有仓库的内容，用于备份 */
    dumpAll: function () {
      var names = Object.keys(STORES);
      return Promise.all(names.map(function (n) { return api.all(n).then(function (rows) { return [n, rows]; }); }))
        .then(function (pairs) {
          var out = {};
          pairs.forEach(function (p) { out[p[0]] = p[1]; });
          return out;
        });
    },
    /** 用备份内容整体替换 */
    restoreAll: function (data) {
      var names = Object.keys(STORES);
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var t = db.transaction(names, 'readwrite');
          t.oncomplete = function () { resolve(true); };
          t.onerror = function () { reject(t.error); };
          names.forEach(function (n) {
            var os = t.objectStore(n);
            os.clear();
            (data[n] || []).forEach(function (row) { os.put(row); });
          });
        });
      });
    },
    /** 合并导入（按 id 覆盖，不删除已有数据） */
    mergeAll: function (data) {
      var names = Object.keys(STORES);
      return open().then(function (db) {
        return new Promise(function (resolve, reject) {
          var t = db.transaction(names, 'readwrite');
          t.oncomplete = function () { resolve(true); };
          t.onerror = function () { reject(t.error); };
          names.forEach(function (n) {
            var os = t.objectStore(n);
            (data[n] || []).forEach(function (row) { os.put(row); });
          });
        });
      });
    }
  };

  global.DB = api;
})(window);
