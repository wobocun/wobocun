/* 跟诊录 · 内置词典
   数据来自原 App 的 assets/catalog/*.json，原样复用。 */
(function (global) {
  'use strict';

  var C = {
    herbs: [], herbalCategories: [],
    western: [], patent: [],
    acupoints: [], acupointPinyin: {},
    units: [], decoctions: [],
    ready: null
  };

  function getJSON(url) {
    return fetch(url, { cache: 'force-cache' }).then(function (r) {
      if (!r.ok) throw new Error('读取失败: ' + url);
      return r.json();
    });
  }

  /** 去掉空格、声调，统一小写，便于拼音检索 */
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[\s'·]/g, '');
  }

  /** 从拼音取首字母：ma huang -> mh */
  function initialsOf(pinyin) {
    return String(pinyin || '').split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).join('');
  }

  function match(item, q, keys) {
    if (!q) return true;
    var nq = norm(q);
    for (var i = 0; i < keys.length; i++) {
      var v = item[keys[i]];
      if (!v) continue;
      if (norm(v).indexOf(nq) !== -1) return true;
    }
    return false;
  }

  C.init = function () {
    if (C.ready) return C.ready;
    C.ready = Promise.all([
      getJSON('data/herbs.json'),
      getJSON('data/western.json'),
      getJSON('data/patent.json'),
      getJSON('data/acupoints.json'),
      getJSON('data/acupoints_pinyin.json'),
      getJSON('data/units.json'),
      getJSON('data/decoctions.json')
    ]).then(function (res) {
      C.herbs = res[0].map(function (h) {
        return {
          name: h.name, pinyin: h.pinyin || '', category: h.category || '未分类',
          initials: h.initials || initialsOf(h.pinyin)
        };
      });
      C.western = res[1];
      C.patent = res[2].map(function (p) {
        return { name: p.name, form: p.form || '', spec: p.spec || '', amount: p.amount || '1盒', category: p.category || '未分类' };
      });
      C.acupoints = res[3];
      C.acupointPinyin = res[4] || {};
      C.units = res[5];
      C.decoctions = res[6];

      // 药材分类（保留原始顺序）
      var seen = {}, cats = [];
      C.herbs.forEach(function (h) {
        if (!seen[h.category]) { seen[h.category] = 1; cats.push(h.category); }
      });
      C.herbalCategories = cats;

      // 腧穴扁平化，附经络与拼音
      C.acupointList = [];
      C.acupoints.forEach(function (m) {
        (m.points || []).forEach(function (p) {
          C.acupointList.push({ name: p, meridian: m.meridian, pinyin: C.acupointPinyin[p] || '' });
        });
      });
      return C;
    });
    return C.ready;
  };

  C.searchHerbs = function (q) {
    return C.herbs.filter(function (h) { return match(h, q, ['name', 'pinyin', 'initials']); });
  };
  C.searchPatent = function (q) {
    return C.patent.filter(function (p) { return match(p, q, ['name', 'category', 'form']); });
  };
  C.searchWestern = function (q) {
    return C.western.filter(function (w) { return match(w, q, ['name', 'english', 'brands', 'category']); });
  };
  C.searchAcupoints = function (q) {
    return C.acupointList.filter(function (a) { return match(a, q, ['name', 'pinyin', 'meridian']); });
  };

  C.herbByName = function (name) {
    for (var i = 0; i < C.herbs.length; i++) if (C.herbs[i].name === name) return C.herbs[i];
    return null;
  };

  global.CATALOG = C;
})(window);
