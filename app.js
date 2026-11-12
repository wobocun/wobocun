/* 跟诊录 · 网页版主程序 */
(function () {
  'use strict';

  // ============================================================
  // 基础工具
  // ============================================================
  var root = document.getElementById('root');
  var layer = document.getElementById('layer');

  // ============================================================
  // 图标（内联 SVG，跟随文字颜色）
  // ============================================================
  var ICONS = {
    teachers: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 19.6c0-3.4 2.9-5.6 6.5-5.6s6.5 2.2 6.5 5.6"/>',
    records: '<rect x="5.5" y="3.5" width="13" height="17" rx="2.6"/><path d="M9 8.5h6M9 12h6M9 15.5h3.6"/>',
    dict: '<path d="M4 6.6c2.6-1.4 5.2-1.4 8 0 2.8-1.4 5.4-1.4 8 0v11.8c-2.6-1.4-5.2-1.4-8 0-2.8-1.4-5.4-1.4-8 0V6.6Z"/><path d="M12 6.6v11.8"/>',
    settings: '<path d="M4.5 8h15M4.5 16h15"/><circle cx="9.5" cy="8" r="2.1"/><circle cx="14.5" cy="16" r="2.1"/>',
    back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
    pencil: '<path d="M4.5 19.5h3.2L19 8.2a2.1 2.1 0 0 0 0-3l-.2-.2a2.1 2.1 0 0 0-3 0L4.5 16.3v3.2Z"/><path d="M14.6 6.4l3 3"/>',
    trash: '<path d="M4.8 7h14.4M9.2 7V4.9h5.6V7M6.6 7l.9 12.1h9l.9-12.1"/><path d="M10.2 10.8v5M13.8 10.8v5"/>',
    printer: '<path d="M7.5 9V4.5h9V9"/><rect x="4.5" y="9" width="15" height="7.5" rx="2"/><path d="M7.5 14.5h9v5h-9z"/>',
    close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'
  };

  function icon(name, size) {
    var s = size || 20;
    return '<svg class="ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" aria-hidden="true">' +
      (ICONS[name] || '') + '</svg>';
  }

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function startOfDay(ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }
  /** 去掉「舌：」「脉:」这类重复前缀 */
  function stripPrefix(s, ch) {
    return String(s || '').replace(new RegExp('^\\s*' + ch + '\\s*[:：]?\\s*'), '');
  }

  var D = { teachers: [], patients: [], records: [], templates: [] };
  var P = {
    theme: 'auto', fontScale: 1, dateFormat: 'cn', retention: 30, lastTab: 'teachers'
  };

  // ============================================================
  // 日期 / 文案
  // ============================================================
  function fmtDate(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    if (P.dateFormat === 'iso') return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    return d.getFullYear() + '年' + pad2(d.getMonth() + 1) + '月' + pad2(d.getDate()) + '日';
  }
  function fmtDateTime(ts) {
    var d = new Date(ts);
    return fmtDate(ts) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function relDay(ts) {
    if (!ts) return '';
    var diff = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / 86400000);
    if (diff === 0) return '今天';
    if (diff === 1) return '昨天';
    if (diff === 2) return '前天';
    if (diff > 2 && diff < 30) return diff + '天前';
    return '';
  }
  function toDateInput(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function fromDateInput(v) {
    if (!v) return Date.now();
    var p = v.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0, 0).getTime();
  }

  // ============================================================
  // 提示 / 弹层
  // ============================================================
  var toastTimer = null;
  function toast(msg) {
    var old = $('.toast', layer);
    if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    layer.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.remove(); }, 1900);
  }

  function sheet(title, bodyHTML, onMount) {
    closeSheet();
    var scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.innerHTML =
      '<div class="sheet" role="dialog" aria-modal="true">' +
      '<div class="grabber"></div>' +
      '<div class="sheet-head"><div class="t grow">' + esc(title) + '</div>' +
      '<button class="iconbtn" data-act="close-sheet" aria-label="关闭">' + icon('close', 18) + '</button></div>' +
      '<div class="sheet-body">' + bodyHTML + '</div>' +
      '</div>';
    scrim.addEventListener('click', function (e) { if (e.target === scrim) closeSheet(); });
    layer.appendChild(scrim);
    document.body.style.overflow = 'hidden';
    if (onMount) onMount(scrim);
    return scrim;
  }
  function closeSheet() {
    var s = $('.scrim', layer);
    if (s) s.remove();
    document.body.style.overflow = '';
  }

  function confirmBox(title, msg, okText, onOk) {
    sheet(title,
      '<p class="muted" style="margin:4px 0 18px;line-height:1.7">' + nl2br(msg) + '</p>' +
      '<div class="row" style="gap:10px">' +
      '<button class="btn grow" data-act="close-sheet">取消</button>' +
      '<button class="btn primary grow" data-act="confirm-ok">' + esc(okText || '确定') + '</button>' +
      '</div>',
      function (scrim) {
        $('[data-act="confirm-ok"]', scrim).addEventListener('click', function () {
          closeSheet();
          onOk();
        });
      });
  }

  /** 输入框弹层（iOS 独立模式下 prompt 不可靠，统一用这个） */
  function promptSheet(title, label, defVal, onOk) {
    var scrim = sheet(title,
      '<div class="field"><label>' + esc(label) + '</label>' +
      '<input class="input" id="pm" value="' + esc(defVal || '') + '"></div>' +
      '<div class="row" style="gap:10px;margin-top:6px">' +
      '<button class="btn grow" data-act="close-sheet">取消</button>' +
      '<button class="btn primary grow" id="pm-ok">确定</button></div>');
    var inp = $('#pm', scrim);
    setTimeout(function () { if (inp) { inp.focus(); inp.select(); } }, 150);
    $('#pm-ok', scrim).addEventListener('click', function () {
      var v = inp.value.trim();
      if (!v) return;
      closeSheet();
      onOk(v);
    });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $('#pm-ok', scrim).click(); }
    });
  }

  // ============================================================
  // 数据查询
  // ============================================================
  function teacherOf(id) {
    for (var i = 0; i < D.teachers.length; i++) if (D.teachers[i].id === id) return D.teachers[i];
    return null;
  }
  function patientOf(id) {
    for (var i = 0; i < D.patients.length; i++) if (D.patients[i].id === id) return D.patients[i];
    return null;
  }
  function recordOf(id) {
    for (var i = 0; i < D.records.length; i++) if (D.records[i].id === id) return D.records[i];
    return null;
  }
  function liveTeachers() { return D.teachers.filter(function (t) { return !t.deletedAt; }); }
  function livePatients(tid) {
    return D.patients.filter(function (p) { return !p.deletedAt && (!tid || p.teacherId === tid); });
  }
  function liveRecords(pid) {
    return D.records.filter(function (r) { return !r.deletedAt && (!pid || r.patientId === pid); })
      .sort(function (a, b) { return (b.visitedAt || 0) - (a.visitedAt || 0); });
  }
  function recordCountOf(pid) { return liveRecords(pid).length; }

  // ============================================================
  // 处方文本
  // ============================================================
  function rxHerbText(rx) {
    if (!rx || !rx.herbs || !rx.herbs.length) return '';
    return rx.herbs.map(function (h) { return h.name + ' ' + (h.dose || '') + (h.unit || 'g'); }).join('、');
  }

  /** 整份病历的纯文本，方便复制到微信或其它地方 */
  function recordPlainText(r) {
    var p = patientOf(r.patientId);
    var t = teacherOf(r.teacherId);
    var L = [];
    L.push(fmtDate(r.visitedAt) + '　' + (p ? p.name : ''));
    if (t) L.push('带教：' + t.name);
    if (r.chief) L.push('主诉：' + r.chief);
    if (r.history) L.push('现病史：' + r.history);
    if (r.past) L.push('既往史：' + r.past);
    if (r.tongue) L.push('舌：' + stripPrefix(r.tongue, '舌'));
    if (r.pulse) L.push('脉：' + stripPrefix(r.pulse, '脉'));
    if (r.tcmDx) L.push('中医诊断：' + r.tcmDx);
    if (r.wmDx) L.push('西医诊断：' + r.wmDx);
    if (r.method) L.push('治法：' + r.method);
    var rx = r.rx || {};
    if (rx.herbs && rx.herbs.length) {
      L.push('中药处方：' + rx.herbs.map(function (h) {
        return h.name + (h.dose || '') + (h.unit || '') + (h.dec ? '（' + h.dec + '）' : '');
      }).join('、') + '。共 ' + rx.herbs.length + ' 味。');
    }
    if (rx.patent && rx.patent.length) L.push('中成药：' + rx.patent.map(function (x) { return x.name + (x.amount ? ' ' + x.amount : ''); }).join('、'));
    if (rx.western && rx.western.length) L.push('西药：' + rx.western.map(function (x) { return x.name + (x.amount ? ' ' + x.amount : ''); }).join('、'));
    if (rx.acupoints && rx.acupoints.length) L.push('针灸腧穴：' + rx.acupoints.map(function (a) { return a.name; }).join('、'));
    if (r.advice) L.push('医嘱：' + r.advice);
    if (r.tags && r.tags.length) L.push('标签：' + r.tags.join('、'));
    return L.join('\n');
  }

  function rxHTML(rx) {
    if (!rx) return '';
    var out = [];
    if (rx.herbs && rx.herbs.length) {
      out.push('<div class="doc"><h3>中药处方</h3><div class="rx-summary">' + rx.herbs.map(function (h) {
        return '<span class="herb">' + esc(h.name) + '</span><span class="dose">' + esc(h.dose || '') + esc(h.unit || '') + '</span>' +
          (h.dec ? '<span class="dec">(' + esc(h.dec) + ')</span>' : '');
      }).join('，') + '　<span class="tiny">共 ' + rx.herbs.length + ' 味</span></div></div>');
    }
    if (rx.patent && rx.patent.length) {
      out.push('<div class="doc"><h3>中成药</h3><p>' + rx.patent.map(function (p) {
        return esc(p.name) + (p.amount ? ' ×' + esc(p.amount) : '');
      }).join('；') + '</p></div>');
    }
    if (rx.western && rx.western.length) {
      out.push('<div class="doc"><h3>西药</h3><p>' + rx.western.map(function (w) {
        return esc(w.name) + (w.amount ? ' ×' + esc(w.amount) : '');
      }).join('；') + '</p></div>');
    }
    if (rx.acupoints && rx.acupoints.length) {
      out.push('<div class="doc"><h3>针灸腧穴</h3><p>' + rx.acupoints.map(function (a) {
        return esc(a.name);
      }).join('、') + '</p></div>');
    }
    return out.join('');
  }

  // ============================================================
  // 界面骨架
  // ============================================================
  function topbar(title, opts) {
    opts = opts || {};
    var left = opts.back
      ? '<button class="iconbtn" data-act="back" aria-label="返回">' + icon('back', 22) + '</button>'
      : '';
    return '<header class="topbar">' + left +
      '<h1>' + esc(title) + (opts.sub ? '<span class="sub">' + esc(opts.sub) + '</span>' : '') + '</h1>' +
      '<div class="spacer"></div>' + (opts.actions || '') + '</header>';
  }

  function tabbar(active) {
    var tabs = [
      ['teachers', '跟诊', '#/teachers'],
      ['records', '病历', '#/records'],
      ['dict', '词典', '#/dict'],
      ['settings', '设置', '#/settings']
    ];
    return '<nav class="tabbar">' + tabs.map(function (t) {
      return '<button class="' + (active === t[0] ? 'on' : '') + '" data-act="go" data-href="' + t[2] + '">' +
        icon(t[0], 23) + '<span>' + t[1] + '</span></button>';
    }).join('') + '</nav>';
  }

  function shell(mainHTML, opts) {
    opts = opts || {};
    root.innerHTML = '<div class="app">' + (opts.topbar || '') + '<main class="main" id="main">' + mainHTML + '</main>' +
      (opts.tabbar || '') + '</div>';
    if (opts.fab) {
      var b = document.createElement('button');
      b.className = 'fab';
      b.setAttribute('data-act', opts.fab.act);
      if (opts.fab.data) Object.keys(opts.fab.data).forEach(function (k) { b.setAttribute('data-' + k, opts.fab.data[k]); });
      if (opts.fab.icon) b.innerHTML = icon(opts.fab.icon, 24);
      else b.textContent = opts.fab.label || '+';
      root.querySelector('.app').appendChild(b);
    }
  }

  function emptyState(gl, text, hint) {
    return '<div class="empty"><span class="gl">' + gl + '</span><p>' + esc(text) + '</p>' +
      (hint ? '<p class="tiny" style="margin-top:8px">' + esc(hint) + '</p>' : '') + '</div>';
  }

  // ============================================================
  // 视图：老师列表
  // ============================================================
  function viewTeachers() {
    var q = (S.search || '').trim();
    var list = liveTeachers().sort(function (a, b) {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    if (q) {
      list = list.filter(function (t) {
        return [t.name, t.title, t.department, t.schedule, t.location].join(' ').indexOf(q) !== -1;
      });
    }

    var body = '<div class="searchbar"><span class="gl">⌕</span>' +
      '<input id="q" placeholder="搜索老师、科室、出诊时间" value="' + esc(q) + '"></div>';

    if (!liveTeachers().length) {
      body += emptyState('录', '还没有老师', '先添加一位带教老师，再往下记录患者与病历');
    } else if (!list.length) {
      body += emptyState('录', '没有匹配的老师');
    } else {
      body += '<div class="section-label">老师 · ' + list.length + ' 位</div>';
      body += list.map(function (t) {
        var pc = livePatients(t.id).length;
        var rc = liveRecords().filter(function (r) { return r.teacherId === t.id; }).length;
        return '<a class="card cardlink teacher-card row" data-act="go" data-href="#/teacher/' + t.id + '">' +
          '<div class="avatar">' + esc((t.name || '师').slice(0, 1)) + '</div>' +
          '<div class="grow">' +
          '<div class="name">' + esc(t.name) + (t.title ? '<span class="tiny" style="margin-left:8px">' + esc(t.title) + '</span>' : '') + '</div>' +
          '<div class="meta ell">' + esc([t.department, t.schedule, t.location].filter(Boolean).join(' · ') || '未填写科室与出诊时间') + '</div>' +
          '<div class="tiny" style="margin-top:4px">' + pc + ' 位患者 · ' + rc + ' 份病历</div>' +
          '</div><div class="chev">›</div></a>';
      }).join('');
    }

    shell(body, {
      topbar: topbar('跟诊录', {
        sub: '中医跟诊笔记',
        actions: '<button class="iconbtn" data-act="go" data-href="#/settings" aria-label="设置">' + icon('settings', 21) + '</button>'
      }),
      tabbar: tabbar('teachers'),
      fab: { act: 'add-teacher', label: '+' }
    });
  }

  // ============================================================
  // 视图：老师详情
  // ============================================================
  function viewTeacher(id) {
    var t = teacherOf(id);
    if (!t) return go('#/teachers');
    var ps = livePatients(id).sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });

    var info = '<div class="card">' +
      '<div class="row" style="gap:12px;margin-bottom:' + (t.note ? '8px' : '0') + '">' +
      '<div class="avatar" style="width:48px;height:48px;font-size:1.3rem;border-radius:14px">' + esc((t.name || '师').slice(0, 1)) + '</div>' +
      '<div class="grow"><div class="title-lg">' + esc(t.name) + '</div>' +
      '<div class="tiny">' + esc([t.title, t.department].filter(Boolean).join(' · ') || '职称 / 科室未填') + '</div></div></div>' +
      (t.schedule ? '<div class="tiny" style="margin-top:6px">出诊时间：' + esc(t.schedule) + '</div>' : '') +
      (t.location ? '<div class="tiny">出诊地点：' + esc(t.location) + '</div>' : '') +
      (t.note ? '<div class="tiny" style="margin-top:6px;white-space:pre-wrap">' + esc(t.note) + '</div>' : '') +
      '</div>';

    var body = info + '<div class="section-label">患者 · ' + ps.length + ' 位</div>';
    if (!ps.length) {
      body += emptyState('患', '还没有患者', '点右下角添加这位老师的患者');
    } else {
      body += '<div class="list">' + ps.map(function (p) {
        var n = recordCountOf(p.id);
        var rs = liveRecords(p.id);
        return '<a class="item" data-act="go" data-href="#/patient/' + p.id + '">' +
          '<div class="grow"><div class="label">' + esc(p.name) +
          '<span class="tiny" style="margin-left:8px">' + esc([p.gender, p.age ? p.age + '岁' : ''].filter(Boolean).join(' · ')) + '</span></div>' +
          '<div class="tiny">' + (rs.length ? '最近 ' + fmtDate(rs[0].visitedAt) + (relDay(rs[0].visitedAt) ? ' · ' + relDay(rs[0].visitedAt) : '') : '暂无就诊记录') + '</div></div>' +
          '<span class="pill">' + n + ' 份</span><span class="chev">›</span></a>';
      }).join('') + '</div>';
    }

    shell(body, {
      topbar: topbar(t.name, {
        back: true,
        actions: '<button class="iconbtn" data-act="edit-teacher" data-id="' + t.id + '" aria-label="编辑">' + icon('pencil', 18) + '</button>' +
          '<button class="iconbtn" data-act="del-teacher" data-id="' + t.id + '" aria-label="删除">' + icon('trash', 18) + '</button>'
      }),
      tabbar: tabbar('teachers'),
      fab: { act: 'add-patient', data: { teacher: t.id }, label: '+' }
    });
  }

  // ============================================================
  // 视图：患者详情
  // ============================================================
  function viewPatient(id) {
    var p = patientOf(id);
    if (!p) return go('#/teachers');
    var t = teacherOf(p.teacherId);
    var rs = liveRecords(p.id);

    var info = '<div class="card">' +
      '<div class="row" style="gap:12px">' +
      '<div class="avatar" style="width:48px;height:48px;font-size:1.3rem;border-radius:14px">' + esc((p.name || '患').slice(0, 1)) + '</div>' +
      '<div class="grow"><div class="title-lg">' + esc(p.name) + '</div>' +
      '<div class="tiny">' + esc([p.gender, p.age ? p.age + '岁' : '', t ? t.name : ''].filter(Boolean).join(' · ')) + '</div></div></div>' +
      (p.phone ? '<div class="tiny" style="margin-top:8px">电话：' + esc(p.phone) + '</div>' : '') +
      (p.note ? '<div class="tiny" style="margin-top:4px;white-space:pre-wrap">' + esc(p.note) + '</div>' : '') +
      '</div>';

    var body = info + '<div class="section-label">病历 · ' + rs.length + ' 份</div>';
    if (!rs.length) {
      body += emptyState('案', '还没有病历', '点右下角新建一份跟诊记录');
    } else {
      body += rs.map(function (r) {
        return '<a class="card cardlink" data-act="go" data-href="#/record/' + r.id + '">' +
          '<div class="row between"><div class="title-lg" style="font-size:.98rem">' + fmtDate(r.visitedAt) + '</div>' +
          '<div class="tiny">' + relDay(r.visitedAt) + '</div></div>' +
          (r.chief ? '<div class="tiny" style="margin-top:6px">主诉：' + esc(r.chief) + '</div>' : '') +
          (r.tcmDx ? '<div class="tiny">诊断：' + esc(r.tcmDx) + '</div>' : '') +
          (rxHerbText(r.rx) ? '<div class="tiny ell" style="margin-top:4px;color:var(--accent)">' + esc(rxHerbText(r.rx)) + '</div>' : '') +
          '</a>';
      }).join('');
    }

    shell(body, {
      topbar: topbar(p.name, {
        back: true,
        actions: '<button class="iconbtn" data-act="edit-patient" data-id="' + p.id + '" aria-label="编辑">' + icon('pencil', 18) + '</button>' +
          '<button class="iconbtn" data-act="del-patient" data-id="' + p.id + '" aria-label="删除">' + icon('trash', 18) + '</button>'
      }),
      tabbar: tabbar('teachers'),
      fab: { act: 'new-record', data: { patient: p.id }, icon: 'pencil' }
    });
  }

  // ============================================================
  // 视图：全部病历
  // ============================================================
  function viewRecords() {
    var all = liveRecords();
    var body = '';
    if (!all.length) {
      body = emptyState('册', '还没有病历', '从患者页新建，或在跟诊页添加老师与患者');
    } else {
      var groups = {};
      var order = [];
      all.forEach(function (r) {
        var k = fmtDate(r.visitedAt);
        if (!groups[k]) { groups[k] = []; order.push(k); }
        groups[k].push(r);
      });
      body = order.map(function (k) {
        return '<div class="section-label">' + esc(k) + '</div><div class="list">' + groups[k].map(function (r) {
          var p = patientOf(r.patientId);
          var t = teacherOf(r.teacherId);
          return '<a class="item" data-act="go" data-href="#/record/' + r.id + '">' +
            '<div class="grow"><div class="label">' + esc(p ? p.name : '（已删除患者）') +
            (t ? '<span class="tiny" style="margin-left:8px">' + esc(t.name) + '</span>' : '') + '</div>' +
            '<div class="tiny ell">' + esc([r.chief, r.tcmDx].filter(Boolean).join(' · ') || '未填写主诉') + '</div></div>' +
            '<span class="chev">›</span></a>';
        }).join('') + '</div>';
      }).join('');
    }

    shell(body, {
      topbar: topbar('病历', { sub: all.length + ' 份' }),
      tabbar: tabbar('records')
    });
  }

  // ============================================================
  // 视图：病历查看
  // ============================================================
  function viewRecord(id) {
    var r = recordOf(id);
    if (!r) return go('#/records');
    var p = patientOf(r.patientId);
    var t = teacherOf(r.teacherId);

    function block(label, val) {
      if (!val) return '';
      return '<h3>' + esc(label) + '</h3><p>' + nl2br(val) + '</p>';
    }

    var doc = '<div class="card">' +
      '<div class="row between" style="margin-bottom:4px">' +
      '<div class="title-lg">' + fmtDate(r.visitedAt) + '</div>' +
      '<div class="tiny">' + relDay(r.visitedAt) + '</div></div>' +
      '<div class="tiny" style="margin-bottom:12px">' + esc([p ? p.name : '', t ? t.name : ''].filter(Boolean).join(' · ')) + '</div>' +
      '<div class="doc">' +
      block('主诉', r.chief) +
      block('现病史', r.history) +
      block('既往史', r.past) +
      ((r.tongue || r.pulse) ? '<h3>舌脉</h3><p>' + esc([
        r.tongue ? '舌：' + stripPrefix(r.tongue, '舌') : '',
        r.pulse ? '脉：' + stripPrefix(r.pulse, '脉') : ''
      ].filter(Boolean).join('　')) + '</p>' : '') +
      block('中医诊断', r.tcmDx) +
      block('西医诊断', r.wmDx) +
      block('治法', r.method) +
      (r.rx ? rxHTML(r.rx) : '') +
      block('医嘱', r.advice) +
      '</div>' +
      ((r.tags && r.tags.length) ? '<div class="chips" style="margin-top:14px">' + r.tags.map(function (x) {
        return '<span class="pill accent">' + esc(x) + '</span>';
      }).join('') + '</div>' : '') +
      '</div>';

    doc += '<div class="row no-print" style="gap:10px;margin:2px 0 6px">' +
      '<button class="btn grow" data-act="copy-record" data-id="' + r.id + '">复制病历文本</button>' +
      '<button class="btn grow" data-act="print">打印 / 存 PDF</button></div>';

    shell(doc, {
      topbar: topbar('病历', {
        back: true,
        actions: '<button class="iconbtn" data-act="print" aria-label="打印">' + icon('printer', 18) + '</button>' +
          '<button class="iconbtn" data-act="edit-record" data-id="' + r.id + '" aria-label="编辑">' + icon('pencil', 18) + '</button>' +
          '<button class="iconbtn" data-act="del-record" data-id="' + r.id + '" aria-label="删除">' + icon('trash', 18) + '</button>'
      }),
      tabbar: tabbar('records')
    });
  }

  // ============================================================
  // 视图：病历编辑
  // ============================================================
  var draft = null;

  function newDraft(patientId) {
    var p = patientOf(patientId);
    return {
      id: uid(), patientId: patientId, teacherId: p ? p.teacherId : '',
      visitedAt: Date.now(), chief: '', history: '', past: '', tongue: '', pulse: '',
      tcmDx: '', wmDx: '', method: '', advice: '', tags: [],
      rx: { herbs: [], patent: [], western: [], acupoints: [] },
      createdAt: Date.now(), updatedAt: Date.now(), _new: true
    };
  }

  function viewRecordEdit(patientId, recordId) {
    var p = patientOf(patientId);
    if (!p) return go('#/teachers');
    if (recordId) {
      var exist = recordOf(recordId);
      if (!exist) return go('#/patient/' + patientId);
      draft = JSON.parse(JSON.stringify(exist));
      delete draft._new;
      draft.rx = draft.rx || { herbs: [], patent: [], western: [], acupoints: [] };
      ['herbs', 'patent', 'western', 'acupoints'].forEach(function (k) { if (!draft.rx[k]) draft.rx[k] = []; });
    } else if (!draft || draft.patientId !== patientId || !draft._new) {
      draft = newDraft(patientId);
    }

    renderEditor(p);
  }

  function field(label, key, opts) {
    opts = opts || {};
    var v = draft[key] || '';
    if (opts.textarea) {
      return '<div class="field"><label>' + esc(label) + '</label>' +
        '<textarea class="textarea' + (opts.tall ? ' tall' : '') + '" data-field="' + key + '" ' +
        'placeholder="' + esc(opts.ph || '') + '">' + esc(v) + '</textarea></div>';
    }
    return '<div class="field"><label>' + esc(label) + '</label>' +
      '<input class="input" data-field="' + key + '" value="' + esc(v) + '" placeholder="' + esc(opts.ph || '') + '"></div>';
  }

  function rxEditor() {
    var html = '';
    // 中药
    html += '<div class="section-label">中药处方</div><div class="card tight">';
    if (!draft.rx.herbs.length) {
      html += '<div class="tiny" style="padding:4px 0 8px">还没有药材，点下面「添加药材」从内置 500 余味药里选，也可以直接手写。</div>';
    }
    html += draft.rx.herbs.map(function (h, i) {
      return '<div class="rx-row herb">' +
        '<input class="input inline name" data-rx="herbs" data-idx="' + i + '" data-f="name" value="' + esc(h.name) + '" placeholder="药名">' +
        '<input class="input inline dose" data-rx="herbs" data-idx="' + i + '" data-f="dose" value="' + esc(h.dose || '') + '" placeholder="剂量" inputmode="decimal">' +
        '<select class="select inline unit sm" data-rx="herbs" data-idx="' + i + '" data-f="unit">' +
        CATALOG.units.map(function (u) { return '<option value="' + esc(u) + '"' + ((h.unit || 'g') === u ? ' selected' : '') + '>' + esc(u) + '</option>'; }).join('') +
        '</select>' +
        '<button class="rx-del" data-act="rx-del" data-kind="herbs" data-idx="' + i + '" aria-label="删除">' + icon('close', 14) + '</button>' +
        '<select class="select inline dec sm" data-rx="herbs" data-idx="' + i + '" data-f="dec">' +
        '<option value="">常规煎法</option>' +
        CATALOG.decoctions.map(function (u) { return '<option value="' + esc(u) + '"' + (h.dec === u ? ' selected' : '') + '>' + esc(u) + '</option>'; }).join('') +
        '</select>' +
        '</div>';
    }).join('');
    html += '<button class="btn sm ghost" data-act="pick-herb" style="margin-top:6px">＋ 添加药材</button></div>';

    // 中成药
    html += '<div class="section-label">中成药</div><div class="card tight">';
    html += draft.rx.patent.map(function (x, i) {
      return '<div class="rx-row two">' +
        '<input class="input inline name" data-rx="patent" data-idx="' + i + '" data-f="name" value="' + esc(x.name) + '" placeholder="中成药名">' +
        '<input class="input inline dose" data-rx="patent" data-idx="' + i + '" data-f="amount" value="' + esc(x.amount || '') + '" placeholder="数量">' +
        '<button class="rx-del" data-act="rx-del" data-kind="patent" data-idx="' + i + '" aria-label="删除">' + icon('close', 14) + '</button></div>';
    }).join('');
    html += '<button class="btn sm ghost" data-act="pick-patent" style="margin-top:6px">＋ 添加中成药</button></div>';

    // 西药
    html += '<div class="section-label">西药</div><div class="card tight">';
    html += draft.rx.western.map(function (x, i) {
      return '<div class="rx-row two">' +
        '<input class="input inline name" data-rx="western" data-idx="' + i + '" data-f="name" value="' + esc(x.name) + '" placeholder="药名">' +
        '<input class="input inline dose" data-rx="western" data-idx="' + i + '" data-f="amount" value="' + esc(x.amount || '') + '" placeholder="数量">' +
        '<button class="rx-del" data-act="rx-del" data-kind="western" data-idx="' + i + '" aria-label="删除">' + icon('close', 14) + '</button></div>';
    }).join('');
    html += '<button class="btn sm ghost" data-act="pick-western" style="margin-top:6px">＋ 添加西药</button></div>';

    // 腧穴
    html += '<div class="section-label">针灸腧穴</div><div class="card tight">';
    if (draft.rx.acupoints.length) {
      html += '<div class="chips" style="margin-bottom:8px">' + draft.rx.acupoints.map(function (a, i) {
        return '<span class="pill accent">' + esc(a.name) +
          '<span data-act="rx-del" data-kind="acupoints" data-idx="' + i + '" style="margin-left:6px;cursor:pointer;display:inline-flex;vertical-align:middle">' + icon('close', 12) + '</span></span>';
      }).join('') + '</div>';
    }
    html += '<button class="btn sm ghost" data-act="pick-acupoint">＋ 添加腧穴</button></div>';

    return html;
  }

  function renderEditor(p) {
    var body =
      '<div class="field"><label>就诊时间</label>' +
      '<input class="input" type="date" id="visitedAt" value="' + toDateInput(draft.visitedAt) + '"></div>' +
      field('主诉', 'chief', { ph: '例如：头痛三日，伴恶风' }) +
      field('现病史', 'history', { textarea: true }) +
      field('既往史', 'past', { textarea: true }) +
      '<div class="row" style="gap:10px">' +
      '<div class="field grow"><label>舌象</label><input class="input" data-field="tongue" value="' + esc(draft.tongue) + '" placeholder="舌淡红"></div>' +
      '<div class="field grow"><label>脉象</label><input class="input" data-field="pulse" value="' + esc(draft.pulse) + '" placeholder="脉浮紧"></div></div>' +
      field('中医诊断', 'tcmDx', { ph: '例如：太阳伤寒' }) +
      field('西医诊断', 'wmDx') +
      field('治法', 'method', { ph: '例如：辛温解表' }) +
      rxEditor() +
      field('医嘱', 'advice', { textarea: true }) +
      '<div class="field"><label>标签（用中文逗号或空格分隔）</label>' +
      '<input class="input" id="tags" value="' + esc((draft.tags || []).join('，')) + '" placeholder="例如：初诊 感冒"></div>' +
      '<div class="row" style="gap:10px;margin:18px 0 10px">' +
      (D.templates.filter(function (t) { return !t.deletedAt; }).length
        ? '<button class="btn grow" data-act="apply-template">套用模板</button>' : '') +
      '<button class="btn grow" data-act="save-template">存为模板</button></div>' +
      '<button class="btn primary block" data-act="save-record" style="margin-bottom:10px">保存病历</button>';

    shell(body, {
      topbar: topbar(draft._new ? '新建病历' : '编辑病历', {
        back: true,
        sub: p.name,
        actions: '<button class="iconbtn" data-act="cancel-edit" aria-label="取消">' + icon('close', 18) + '</button>'
      }),
      tabbar: ''
    });
  }

  // ============================================================
  // 视图：词典
  // ============================================================
  var dictState = { tab: 'herbs', q: '' };

  function viewDict() {
    var tabs = [['herbs', '中药'], ['patent', '中成药'], ['western', '西药'], ['acupoints', '腧穴']];
    var q = dictState.q;
    var body = '<div class="dict-tabs">' + tabs.map(function (t) {
      return '<button class="chip' + (dictState.tab === t[0] ? ' on' : '') + '" data-act="dict-tab" data-tab="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>';

    body += '<div class="searchbar"><span class="gl">⌕</span>' +
      '<input id="dq" placeholder="输入药名、拼音或首字母" value="' + esc(q) + '"></div>';

    body += '<div id="dict-list">' + dictListHTML() + '</div>';

    shell(body, {
      topbar: topbar('词典', {
        sub: dictState.tab === 'herbs' ? '中药 ' + CATALOG.herbs.length + ' 味'
          : dictState.tab === 'patent' ? '中成药 ' + CATALOG.patent.length + ' 种'
            : dictState.tab === 'western' ? '西药 ' + CATALOG.western.length + ' 种'
              : '腧穴 ' + (CATALOG.acupointList || []).length + ' 穴',
        back: !S.tabMode
      }),
      tabbar: S.tabMode ? tabbar('dict') : ''
    });
    var input = $('#dq');
    if (input) {
      input.addEventListener('input', function () {
        dictState.q = input.value;
        var el = $('#dict-list');
        if (el) el.innerHTML = dictListHTML();
      });
      if (S.focusDict) { input.focus(); S.focusDict = false; }
    }
  }

  function dictListHTML() {
    var q = dictState.q.trim();
    var html = '';
    if (dictState.tab === 'herbs') {
      var list = CATALOG.searchHerbs(q);
      if (!list.length) return emptyState('药', '没有找到「' + esc(q) + '」');
      if (!q) {
        CATALOG.herbalCategories.forEach(function (cat) {
          var items = list.filter(function (h) { return h.category === cat; });
          if (!items.length) return;
          html += '<div class="cat-head">' + esc(cat) + ' · ' + items.length + '</div><div class="card tight">' +
            items.map(function (h) { return herbRow(h, false); }).join('') + '</div>';
        });
      } else {
        html += '<div class="tiny" style="margin:0 2px 6px">共 ' + list.length + ' 味</div><div class="card tight">' +
          list.map(function (h) { return herbRow(h, true); }).join('') + '</div>';
      }
    } else if (dictState.tab === 'patent') {
      var pl = CATALOG.searchPatent(q);
      if (!pl.length) return emptyState('成', '没有找到');
      html += '<div class="card tight">' + pl.map(function (x) {
        return '<div class="pick-item" data-act="copy" data-text="' + esc(x.name) + '">' +
          '<div class="grow"><div class="n">' + esc(x.name) + '</div>' +
          '<div class="m">' + esc([x.category, x.form, x.spec, x.amount].filter(Boolean).join(' · ')) + '</div></div>' +
          '<span class="tiny">点击复制</span></div>';
      }).join('') + '</div>';
    } else if (dictState.tab === 'western') {
      var wl = CATALOG.searchWestern(q);
      if (!wl.length) return emptyState('西', '没有找到');
      html += '<div class="card tight">' + wl.map(function (x) {
        return '<div class="pick-item" data-act="copy" data-text="' + esc(x.name) + '">' +
          '<div class="grow"><div class="n">' + esc(x.name) + '</div>' +
          '<div class="m">' + esc([x.english, x.brands, x.category, x.form, x.spec].filter(Boolean).join(' · ')) + '</div></div>' +
          '<span class="tiny">点击复制</span></div>';
      }).join('') + '</div>';
    } else {
      var al = CATALOG.searchAcupoints(q);
      if (!al.length) return emptyState('穴', '没有找到');
      var byMer = {};
      al.forEach(function (a) { (byMer[a.meridian] = byMer[a.meridian] || []).push(a); });
      Object.keys(byMer).forEach(function (m) {
        html += '<div class="cat-head">' + esc(m) + ' · ' + byMer[m].length + '</div><div class="card tight"><div class="chips">' +
          byMer[m].map(function (a) {
            return '<span class="chip" data-act="copy" data-text="' + esc(a.name) + '">' + esc(a.name) + '</span>';
          }).join('') + '</div></div>';
      });
    }
    return html;
  }

  function herbRow(h, showCat) {
    return '<div class="pick-item compact" data-act="copy" data-text="' + esc(h.name) + '">' +
      '<div class="grow row between" style="gap:8px">' +
      '<span class="n">' + esc(h.name) + '</span>' +
      '<span class="pinyin">' + esc(h.pinyin) + (showCat ? ' · ' + esc(h.category) : '') + '</span>' +
      '</div></div>';
  }

  // ============================================================
  // 视图：设置
  // ============================================================
  function viewSettings() {
    var themes = [['light', '浅色'], ['dark', '深色'], ['auto', '跟随系统']];
    var body =
      '<div class="section-label">外观</div><div class="card">' +
      '<div class="field"><label>主题</label><div class="chips">' + themes.map(function (t) {
        return '<button class="chip' + (P.theme === t[0] ? ' on' : '') + '" data-act="set-theme" data-v="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div></div>' +
      '<div class="row between" style="margin-top:4px"><div><div>字号</div><div class="tiny">当前 ' + Math.round(P.fontScale * 100) + '%</div></div>' +
      '<div class="row" style="gap:8px">' +
      '<button class="btn sm" data-act="font" data-v="-1">A－</button>' +
      '<button class="btn sm" data-act="font" data-v="1">A＋</button></div></div>' +
      '</div>' +

      '<div class="section-label">记录</div><div class="card">' +
      '<div class="field"><label>日期格式</label><div class="chips">' +
      '<button class="chip' + (P.dateFormat === 'cn' ? ' on' : '') + '" data-act="set-datefmt" data-v="cn">2026年11月07日</button>' +
      '<button class="chip' + (P.dateFormat === 'iso' ? ' on' : '') + '" data-act="set-datefmt" data-v="iso">2026-11-07</button>' +
      '</div></div>' +
      '<div class="field" style="margin-bottom:0"><label>回收站保留</label><div class="chips">' +
      [7, 15, 30, 90].map(function (d) {
        return '<button class="chip' + (P.retention === d ? ' on' : '') + '" data-act="set-retention" data-v="' + d + '">' + d + ' 天</button>';
      }).join('') + '</div><div class="tiny" style="margin-top:6px">删除的病历会先进入回收站，超过保留期自动清理</div></div>' +
      '</div>';

    body += '<div class="section-label">管理</div><div class="list">' +
      '<div class="item" data-act="go" data-href="#/trash"><div class="grow label">回收站</div><span class="tiny">' + trashCount() + ' 项</span><span class="chev">›</span></div>' +
      '<div class="item" data-act="go" data-href="#/templates"><div class="grow label">病历模板</div><span class="tiny">' + D.templates.filter(function (t) { return !t.deletedAt; }).length + ' 个</span><span class="chev">›</span></div>' +
      '</div>';

    body += '<div class="section-label">数据</div><div class="list">' +
      '<div class="item" data-act="export"><div class="grow label">导出备份</div><span class="tiny">JSON 文件</span><span class="chev">›</span></div>' +
      '<div class="item" data-act="import"><div class="grow label">导入备份</div><span class="tiny">合并或覆盖</span><span class="chev">›</span></div>' +
      '<div class="item" data-act="clear-all"><div class="grow label" style="color:var(--danger)">清空全部数据</div><span class="chev">›</span></div>' +
      '</div>' +
      '<input type="file" id="import-file" accept=".json,application/json" style="display:none">';

    body += '<div class="section-label">关于</div><div class="card">' +
      '<div class="title-lg" style="font-size:.98rem">跟诊录 · 网页版</div>' +
      '<div class="tiny" style="margin-top:6px;line-height:1.9">' +
      '由原 Android 版「跟诊录」v1.7.2 重写而来。数据全部保存在本机浏览器（IndexedDB），不上传服务器；' +
      '内置中药 ' + CATALOG.herbs.length + ' 味、中成药 ' + CATALOG.patent.length + ' 种、西药 ' + CATALOG.western.length + ' 种、腧穴 ' + (CATALOG.acupointList || []).length + ' 穴。' +
      '<br>在 iPhone Safari 里「分享 → 添加到主屏幕」，即可像 App 一样全屏使用。' +
      '</div></div>';

    shell(body, {
      topbar: topbar('设置', { back: !S.tabMode }),
      tabbar: S.tabMode ? tabbar('settings') : ''
    });

    var fi = $('#import-file');
    if (fi) fi.addEventListener('change', onImportFile);
  }

  // ============================================================
  // 视图：回收站 / 模板
  // ============================================================
  function trashCount() {
    return D.teachers.filter(function (x) { return x.deletedAt; }).length +
      D.patients.filter(function (x) { return x.deletedAt; }).length +
      D.records.filter(function (x) { return x.deletedAt; }).length;
  }

  function viewTrash() {
    var items = [];
    D.teachers.filter(function (x) { return x.deletedAt; }).forEach(function (x) { items.push(['teacher', x, x.name]); });
    D.patients.filter(function (x) { return x.deletedAt; }).forEach(function (x) { items.push(['patient', x, x.name]); });
    D.records.filter(function (x) { return x.deletedAt; }).forEach(function (x) {
      var p = patientOf(x.patientId);
      items.push(['record', x, fmtDate(x.visitedAt) + (p ? ' ' + p.name : '')]);
    });
    items.sort(function (a, b) { return (b[1].deletedAt || 0) - (a[1].deletedAt || 0); });

    var body = '';
    if (!items.length) {
      body = emptyState('净', '回收站是空的', '删除的老师、患者、病历会先放在这里');
    } else {
      body = '<div class="tiny" style="margin:0 2px 10px">保留 ' + P.retention + ' 天，到期自动清理</div>';
      body += items.map(function (it) {
        var kind = { teacher: '老师', patient: '患者', record: '病历' }[it[0]];
        return '<div class="card tight"><div class="row between" style="gap:8px">' +
          '<div class="grow"><div class="label">' + esc(it[2]) + '<span class="tiny" style="margin-left:8px">' + kind + '</span></div>' +
          '<div class="tiny">' + fmtDateTime(it[1].deletedAt) + ' 删除</div></div>' +
          '<button class="btn sm" data-act="restore" data-entity="' + it[0] + '" data-id="' + it[1].id + '">恢复</button>' +
          '<button class="btn sm danger" data-act="purge" data-entity="' + it[0] + '" data-id="' + it[1].id + '">彻底删除</button>' +
          '</div></div>';
      }).join('');
    }
    shell(body, { topbar: topbar('回收站', { back: true }), tabbar: '' });
  }

  function viewTemplates() {
    var list = D.templates.filter(function (t) { return !t.deletedAt; });
    var body = '';
    if (!list.length) {
      body = emptyState('模', '还没有模板', '在病历编辑页点「存为模板」，下次新建时可一键套用');
    } else {
      body = '<div class="list">' + list.map(function (t) {
        return '<div class="item"><div class="grow"><div class="label">' + esc(t.name) + '</div>' +
          '<div class="tiny ell">' + esc(t.chief || t.tcmDx || '空模板') + '</div></div>' +
          '<button class="btn sm danger" data-act="del-template" data-id="' + t.id + '">删除</button></div>';
      }).join('') + '</div>';
    }
    shell(body, { topbar: topbar('病历模板', { back: true }), tabbar: '' });
  }

  // ============================================================
  // 路由
  // ============================================================
  var S = { route: '', search: '', tabMode: true, focusDict: false };
  var lastRouteKey = '';

  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function parseRoute() {
    var h = (location.hash || '#/teachers').replace(/^#/, '');
    return h.split('/').filter(Boolean);
  }

  function render() {
    applyTheme();
    var parts = parseRoute();
    var view = parts[0] || 'teachers';

    S.tabMode = ['teachers', 'records', 'dict', 'settings'].indexOf(view) !== -1;

    if (view === 'teachers') viewTeachers();
    else if (view === 'teacher') viewTeacher(parts[1]);
    else if (view === 'patient') viewPatient(parts[1]);
    else if (view === 'record') viewRecord(parts[1]);
    else if (view === 'edit') viewRecordEdit(parts[1], parts[2]);
    else if (view === 'records') viewRecords();
    else if (view === 'dict') viewDict();
    else if (view === 'settings') viewSettings();
    else if (view === 'trash') viewTrash();
    else if (view === 'templates') viewTemplates();
    else go('#/teachers');

    // 切换页面时回到顶部（同页重绘不动，避免搜索时跳动）
    var key = parts.slice(0, 3).join('|');
    if (key !== lastRouteKey) {
      lastRouteKey = key;
      window.scrollTo(0, 0);
    }

    // 恢复搜索框焦点
    var q = $('#q');
    if (q) {
      q.addEventListener('input', function () {
        S.search = q.value;
        var pos = q.selectionStart;
        render();
        var q2 = $('#q');
        if (q2) { q2.focus(); q2.setSelectionRange(pos, pos); }
      });
    }
  }

  function applyTheme() {
    var t = P.theme;
    if (t === 'auto') {
      t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.style.setProperty('--font-scale', P.fontScale);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#17150f' : '#f6f1e7');
  }

  // ============================================================
  // 数据操作
  // ============================================================
  function saveTeacher(obj) {
    obj.updatedAt = Date.now();
    D.teachers.push(obj);
    return DB.put('teachers', obj);
  }
  function savePatient(obj) {
    obj.updatedAt = Date.now();
    D.patients.push(obj);
    return DB.put('patients', obj);
  }
  function saveRecord(obj) {
    obj.updatedAt = Date.now();
    var i = D.records.map(function (r) { return r.id; }).indexOf(obj.id);
    if (i >= 0) D.records[i] = obj; else D.records.push(obj);
    return DB.put('records', obj);
  }

  function teacherForm(t) {
    t = t || { id: uid(), name: '', title: '', department: '', schedule: '', location: '', note: '' };
    sheet(t.name ? '编辑老师' : '添加老师',
      '<div class="field"><label>姓名 *</label><input class="input" id="f-name" value="' + esc(t.name) + '" placeholder="例如：李可"></div>' +
      '<div class="field"><label>职称</label><input class="input" id="f-title" value="' + esc(t.title) + '" placeholder="主任医师 / 教授"></div>' +
      '<div class="field"><label>科室</label><input class="input" id="f-department" value="' + esc(t.department) + '" placeholder="例如：中医内科"></div>' +
      '<div class="field"><label>出诊时间</label><input class="input" id="f-schedule" value="' + esc(t.schedule) + '" placeholder="例如：周一、三上午"></div>' +
      '<div class="field"><label>出诊地点</label><input class="input" id="f-location" value="' + esc(t.location) + '" placeholder="例如：门诊二楼 3 诊室"></div>' +
      '<div class="field"><label>备注</label><textarea class="textarea" id="f-note" placeholder="擅长方向、带教要求等">' + esc(t.note) + '</textarea></div>' +
      '<button class="btn primary block" data-act="submit-teacher" data-id="' + t.id + '" style="margin-top:6px">保存</button>',
      function (scrim) {
        var el = $('#f-name', scrim);
        setTimeout(function () { el && el.focus(); }, 120);
      });
    SHEET_CTX.teacher = t;
  }

  function patientForm(p, teacherId) {
    p = p || { id: uid(), teacherId: teacherId, name: '', gender: '', age: '', phone: '', note: '' };
    sheet(p.name ? '编辑患者' : '添加患者',
      '<div class="field"><label>姓名 *</label><input class="input" id="f-name" value="' + esc(p.name) + '" placeholder="患者姓名"></div>' +
      '<div class="row" style="gap:10px">' +
      '<div class="field grow"><label>性别</label><div class="chips">' +
      ['女', '男'].map(function (g) {
        return '<button class="chip' + (p.gender === g ? ' on' : '') + '" data-act="pick-gender" data-v="' + g + '">' + g + '</button>';
      }).join('') + '</div></div>' +
      '<div class="field grow"><label>年龄</label><input class="input" id="f-age" value="' + esc(p.age) + '" inputmode="numeric" placeholder="45"></div></div>' +
      '<div class="field"><label>电话</label><input class="input" id="f-phone" value="' + esc(p.phone) + '" inputmode="tel"></div>' +
      '<div class="field"><label>备注</label><textarea class="textarea" id="f-note" placeholder="过敏史、体质、随访提醒等">' + esc(p.note) + '</textarea></div>' +
      '<button class="btn primary block" data-act="submit-patient" data-id="' + p.id + '" style="margin-top:6px">保存</button>');
    SHEET_CTX.patient = p;
  }

  var SHEET_CTX = {};

  // ============================================================
  // 选择器
  // ============================================================
  function pickerSheet(title, placeholder, searchFn, onPick, renderItem) {
    var scrim = sheet(title,
      '<div class="searchbar"><span class="gl">⌕</span><input id="pk" placeholder="' + esc(placeholder) + '"></div>' +
      '<div id="pk-list"></div>');

    function draw() {
      var q = $('#pk', scrim).value;
      var list = searchFn(q);
      var el = $('#pk-list', scrim);
      var shown = list.slice(0, 80);
      el.innerHTML = (list.length > 80 ? '<div class="tiny" style="margin-bottom:6px">共 ' + list.length + ' 项，仅显示前 80 项，可继续输入缩小范围</div>' : '') +
        '<div class="card tight">' + shown.map(function (it, i) {
          return '<div class="pick-item" data-pick="' + i + '">' + renderItem(it) + '</div>';
        }).join('') + '</div>';
      $$('[data-pick]', el).forEach(function (row) {
        row.addEventListener('click', function () {
          var idx = +row.getAttribute('data-pick');
          onPick(shown[idx]);
          closeSheet();
        });
      });
    }

    $('#pk', scrim).addEventListener('input', draw);
    draw();
    setTimeout(function () {
      var inp = $('#pk', scrim);
      if (inp) inp.focus();
    }, 150);
  }

  function pickHerb(idx) {
    pickerSheet('选择药材', '药名 / 拼音 / 首字母', function (q) { return CATALOG.searchHerbs(q); },
      function (h) {
        if (idx === null || idx === undefined) {
          draft.rx.herbs.push({ name: h.name, dose: '', unit: 'g', dec: '' });
        } else {
          draft.rx.herbs[idx].name = h.name;
        }
        renderEditor(patientOf(draft.patientId));
      },
      function (h) {
        return '<div class="grow"><div class="n">' + esc(h.name) + ' <span class="pinyin">' + esc(h.pinyin) + '</span></div>' +
          '<div class="m">' + esc(h.category) + '</div></div>';
      });
  }

  function pickPatent() {
    pickerSheet('选择中成药', '药名 / 分类', function (q) { return CATALOG.searchPatent(q); },
      function (x) {
        draft.rx.patent.push({ name: x.name, amount: x.amount || '1盒' });
        renderEditor(patientOf(draft.patientId));
      },
      function (x) {
        return '<div class="grow"><div class="n">' + esc(x.name) + '</div>' +
          '<div class="m">' + esc([x.category, x.form, x.spec].filter(Boolean).join(' · ')) + '</div></div>';
      });
  }

  function pickWestern() {
    pickerSheet('选择西药', '药名 / 英文 / 商品名', function (q) { return CATALOG.searchWestern(q); },
      function (x) {
        draft.rx.western.push({ name: x.name, amount: x.amount || '1盒' });
        renderEditor(patientOf(draft.patientId));
      },
      function (x) {
        return '<div class="grow"><div class="n">' + esc(x.name) + '</div>' +
          '<div class="m">' + esc([x.english, x.brands, x.form, x.spec].filter(Boolean).join(' · ')) + '</div></div>';
      });
  }

  function pickAcupoint() {
    pickerSheet('选择腧穴', '穴名 / 拼音 / 经络', function (q) { return CATALOG.searchAcupoints(q); },
      function (a) {
        if (!draft.rx.acupoints.some(function (x) { return x.name === a.name; })) {
          draft.rx.acupoints.push({ name: a.name });
        }
        renderEditor(patientOf(draft.patientId));
      },
      function (a) {
        return '<div class="grow"><div class="n">' + esc(a.name) + ' <span class="pinyin">' + esc(a.pinyin) + '</span></div>' +
          '<div class="m">' + esc(a.meridian) + '</div></div>';
      });
  }

  // ============================================================
  // 备份
  // ============================================================
  function exportBackup() {
    var payload = {
      app: 'genzhenlu', version: 1, exportedAt: Date.now(),
      data: { teachers: D.teachers, patients: D.patients, records: D.records, templates: D.templates }
    };
    var blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
    var d = new Date();
    var name = '跟诊录备份-' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' + pad2(d.getHours()) + pad2(d.getMinutes()) + '.json';
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast('已导出 ' + name);
  }

  function onImportFile(e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      var payload;
      try { payload = JSON.parse(reader.result); } catch (err) { toast('文件不是有效的 JSON'); return; }
      if (!payload || !payload.data) { toast('不是跟诊录的备份文件'); return; }
      var d = payload.data;
      var counts = ['teachers', 'patients', 'records'].map(function (k) { return (d[k] || []).length; }).join(' / ');
      confirmBox('导入备份', '文件包含 老师 / 患者 / 病历 = ' + counts + ' 条。\n\n「合并」保留现有数据并按 id 覆盖同一条记录；「覆盖」会先清空本机全部数据。', '合并导入', function () {
        DB.mergeAll(d).then(function () {
          return loadData();
        }).then(function () {
          toast('已合并导入');
          render();
        });
      });
    };
    reader.readAsText(f);
    e.target.value = '';
  }

  // ============================================================
  // 事件委托
  // ============================================================
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');
    var id = el.getAttribute('data-id');

    switch (act) {
      case 'go':
        go(el.getAttribute('data-href'));
        break;
      case 'back':
        if (history.length > 1) history.back(); else go('#/teachers');
        break;
      case 'close-sheet':
        closeSheet();
        break;
      case 'add-teacher':
        teacherForm(null);
        break;
      case 'edit-teacher':
        teacherForm(teacherOf(id));
        break;
      case 'submit-teacher': {
        var t = SHEET_CTX.teacher;
        var name = $('#f-name').value.trim();
        if (!name) { toast('请填写姓名'); return; }
        t.name = name;
        t.title = $('#f-title').value.trim();
        t.department = $('#f-department').value.trim();
        t.schedule = $('#f-schedule').value.trim();
        t.location = $('#f-location').value.trim();
        t.note = $('#f-note').value.trim();
        var isNew = !teacherOf(t.id);
        saveTeacher(t).then(function () {
          closeSheet();
          toast(isNew ? '已添加老师' : '已保存');
          go(isNew ? '#/teacher/' + t.id : '#/teacher/' + t.id);
        });
        break;
      }
      case 'del-teacher': {
        var tt = teacherOf(id);
        confirmBox('删除老师', '「' + (tt ? tt.name : '') + '」及其全部患者、病历会移入回收站，可在设定保留期内恢复。', '移入回收站', function () {
          var now = Date.now();
          if (tt) { tt.deletedAt = now; DB.put('teachers', tt); }
          D.patients.filter(function (p) { return p.teacherId === id && !p.deletedAt; }).forEach(function (p) {
            p.deletedAt = now; DB.put('patients', p);
          });
          D.records.filter(function (r) { return r.teacherId === id && !r.deletedAt; }).forEach(function (r) {
            r.deletedAt = now; DB.put('records', r);
          });
          toast('已移入回收站');
          go('#/teachers');
        });
        break;
      }
      case 'add-patient':
        patientForm(null, el.getAttribute('data-teacher'));
        break;
      case 'edit-patient':
        patientForm(patientOf(id), null);
        break;
      case 'submit-patient': {
        var p = SHEET_CTX.patient;
        var pn = $('#f-name').value.trim();
        if (!pn) { toast('请填写姓名'); return; }
        p.name = pn;
        p.age = $('#f-age').value.trim();
        p.phone = $('#f-phone').value.trim();
        p.note = $('#f-note').value.trim();
        var pIsNew = !patientOf(p.id);
        savePatient(p).then(function () {
          closeSheet();
          toast(pIsNew ? '已添加患者' : '已保存');
          go(pIsNew ? '#/patient/' + p.id : '#/patient/' + p.id);
        });
        break;
      }
      case 'pick-gender': {
        var v = el.getAttribute('data-v');
        SHEET_CTX.patient.gender = v;
        $$('[data-act="pick-gender"]').forEach(function (b) {
          b.classList.toggle('on', b.getAttribute('data-v') === v);
        });
        break;
      }
      case 'del-patient': {
        var pp = patientOf(id);
        confirmBox('删除患者', '「' + (pp ? pp.name : '') + '」及其全部病历会移入回收站，可在设定保留期内恢复。', '移入回收站', function () {
          var now = Date.now();
          if (pp) { pp.deletedAt = now; DB.put('patients', pp); }
          D.records.filter(function (r) { return r.patientId === id && !r.deletedAt; }).forEach(function (r) {
            r.deletedAt = now; DB.put('records', r);
          });
          toast('已移入回收站');
          go('#/teacher/' + (pp ? pp.teacherId : ''));
        });
        break;
      }
      case 'new-record':
        draft = newDraft(el.getAttribute('data-patient'));
        go('#/edit/' + draft.patientId);
        break;
      case 'edit-record': {
        var rr = recordOf(id);
        if (!rr) return;
        go('#/edit/' + rr.patientId + '/' + rr.id);
        break;
      }
      case 'cancel-edit':
        draft = null;
        go('#/records');
        break;
      case 'del-record': {
        var dr = recordOf(id);
        confirmBox('删除病历', '这份病历会移入回收站，可在设定保留期内恢复。', '移入回收站', function () {
          dr.deletedAt = Date.now();
          DB.put('records', dr);
          toast('已移入回收站');
          go('#/patient/' + dr.patientId);
        });
        break;
      }
      case 'save-record': {
        if (!draft) return;
        draft.visitedAt = fromDateInput($('#visitedAt').value);
        draft.tags = ($('#tags').value || '').split(/[，,\s]+/).filter(Boolean);
        delete draft._new;
        saveRecord(draft).then(function () {
          var savedId = draft.id;
          draft = null;
          toast('病历已保存');
          go('#/record/' + savedId);
        });
        break;
      }
      case 'save-template': {
        if (!draft) return;
        promptSheet('存为模板', '模板名称', draft.tcmDx || draft.chief || '常用处方', function (tname) {
          var tpl = {
            id: uid(), name: tname, chief: draft.chief, history: draft.history, past: draft.past,
            tongue: draft.tongue, pulse: draft.pulse, tcmDx: draft.tcmDx, wmDx: draft.wmDx,
            method: draft.method, advice: draft.advice,
            rx: JSON.parse(JSON.stringify(draft.rx)), updatedAt: Date.now()
          };
          D.templates.push(tpl);
          DB.put('templates', tpl).then(function () { toast('已存为模板'); renderEditor(patientOf(draft.patientId)); });
        });
        break;
      }
      case 'apply-template': {
        var tpls = D.templates.filter(function (t) { return !t.deletedAt; });
        sheet('套用模板', '<div class="list">' + tpls.map(function (t, i) {
          return '<div class="item" data-tpl="' + i + '"><div class="grow"><div class="label">' + esc(t.name) + '</div>' +
            '<div class="tiny ell">' + esc(t.chief || t.tcmDx || '空模板') + '</div></div><span class="chev">›</span></div>';
        }).join('') + '</div>', function (scrim) {
          $$('[data-tpl]', scrim).forEach(function (row) {
            row.addEventListener('click', function () {
              var t = tpls[+row.getAttribute('data-tpl')];
              ['chief', 'history', 'past', 'tongue', 'pulse', 'tcmDx', 'wmDx', 'method', 'advice'].forEach(function (k) {
                if (!draft[k] && t[k]) draft[k] = t[k];
              });
              if (t.rx) {
                ['herbs', 'patent', 'western', 'acupoints'].forEach(function (k) {
                  (t.rx[k] || []).forEach(function (item) {
                    var dup = draft.rx[k].some(function (x) { return x.name === item.name; });
                    if (!dup) draft.rx[k].push(JSON.parse(JSON.stringify(item)));
                  });
                });
              }
              closeSheet();
              renderEditor(patientOf(draft.patientId));
              toast('已套用，空白项已填充');
            });
          });
        });
        break;
      }
      case 'del-template':
        confirmBox('删除模板', '删除后模板可在回收站之外直接移除，确定？', '删除', function () {
          var i = D.templates.map(function (x) { return x.id; }).indexOf(id);
          if (i >= 0) D.templates.splice(i, 1);
          DB.del('templates', id).then(function () { toast('已删除'); render(); });
        });
        break;
      case 'rx-del': {
        var kind = el.getAttribute('data-kind');
        var idx = +el.getAttribute('data-idx');
        var arr = kind === 'herbs' ? draft.rx.herbs : kind === 'patent' ? draft.rx.patent : kind === 'western' ? draft.rx.western : draft.rx.acupoints;
        arr.splice(idx, 1);
        renderEditor(patientOf(draft.patientId));
        break;
      }
      case 'pick-herb':
        pickHerb(null);
        break;
      case 'pick-patent':
        pickPatent();
        break;
      case 'pick-western':
        pickWestern();
        break;
      case 'pick-acupoint':
        pickAcupoint();
        break;
      case 'dict-tab':
        dictState.tab = el.getAttribute('data-tab');
        dictState.q = '';
        render();
        break;
      case 'copy': {
        var txt = el.getAttribute('data-text');
        copyText(txt);
        break;
      }
      case 'set-theme':
        P.theme = el.getAttribute('data-v');
        savePref('theme', P.theme).then(function () { render(); });
        break;
      case 'font': {
        var d = +el.getAttribute('data-v');
        P.fontScale = Math.min(1.3, Math.max(0.85, Math.round((P.fontScale + d * 0.05) * 100) / 100));
        savePref('fontScale', P.fontScale).then(function () { render(); });
        break;
      }
      case 'set-datefmt':
        P.dateFormat = el.getAttribute('data-v');
        savePref('dateFormat', P.dateFormat).then(function () { render(); });
        break;
      case 'set-retention':
        P.retention = +el.getAttribute('data-v');
        savePref('retention', P.retention).then(function () { toast('保留 ' + P.retention + ' 天'); render(); });
        break;
      case 'export':
        exportBackup();
        break;
      case 'import':
        $('#import-file').click();
        break;
      case 'clear-all':
        confirmBox('清空全部数据', '本机的老师、患者、病历、模板会全部删除，无法恢复。建议先导出备份。', '确认清空', function () {
          Promise.all(['teachers', 'patients', 'records', 'templates'].map(function (s) { return DB.clear(s); })).then(function () {
            D.teachers = []; D.patients = []; D.records = []; D.templates = [];
            toast('已清空');
            go('#/teachers');
          });
        });
        break;
      case 'restore': {
        var ent = el.getAttribute('data-entity');
        var store = ent === 'teacher' ? 'teachers' : ent === 'patient' ? 'patients' : 'records';
        var obj = (store === 'teachers' ? teacherOf(id) : store === 'patients' ? patientOf(id) : recordOf(id));
        if (!obj) return;
        delete obj.deletedAt;
        DB.put(store, obj).then(function () { toast('已恢复'); render(); });
        break;
      }
      case 'purge': {
        var ent2 = el.getAttribute('data-entity');
        var store2 = ent2 === 'teacher' ? 'teachers' : ent2 === 'patient' ? 'patients' : 'records';
        var arr2 = store2 === 'teachers' ? D.teachers : store2 === 'patients' ? D.patients : D.records;
        var i2 = arr2.map(function (x) { return x.id; }).indexOf(id);
        if (i2 >= 0) arr2.splice(i2, 1);
        DB.del(store2, id).then(function () { toast('已彻底删除'); render(); });
        break;
      }
      case 'copy-record': {
        var crr = recordOf(id);
        if (crr) copyText(recordPlainText(crr));
        break;
      }
      case 'print':
        window.print();
        break;
    }
  });

  // 编辑页字段绑定
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!draft) return;
    if (el.hasAttribute('data-field')) {
      draft[el.getAttribute('data-field')] = el.value;
    } else if (el.hasAttribute('data-rx')) {
      var kind = el.getAttribute('data-rx');
      var idx = +el.getAttribute('data-idx');
      var f = el.getAttribute('data-f');
      var arr = draft.rx[kind];
      if (arr && arr[idx]) arr[idx][f] = el.value;
    }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!draft) return;
    if (el.hasAttribute('data-rx')) {
      var kind = el.getAttribute('data-rx');
      var idx = +el.getAttribute('data-idx');
      var f = el.getAttribute('data-f');
      var arr = draft.rx[kind];
      if (arr && arr[idx]) arr[idx][f] = el.value;
    }
  });

  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { toast('已复制 ' + txt); },
        function () { fallbackCopy(txt); });
    } else fallbackCopy(txt);
  }
  function fallbackCopy(txt) {
    var ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('已复制 ' + txt); } catch (e) { toast(txt); }
    ta.remove();
  }

  // ============================================================
  // 启动
  // ============================================================
  function savePref(k, v) {
    return DB.put('settings', { k: k, v: v });
  }

  function loadPrefs() {
    return DB.all('settings').then(function (rows) {
      rows.forEach(function (r) { P[r.k] = r.v; });
      // 兼容旧值
      P.fontScale = +P.fontScale || 1;
      P.retention = +P.retention || 30;
    });
  }

  function loadData() {
    return Promise.all([
      DB.all('teachers'), DB.all('patients'), DB.all('records'), DB.all('templates')
    ]).then(function (r) {
      D.teachers = r[0]; D.patients = r[1]; D.records = r[2]; D.templates = r[3];
      D.records.forEach(function (x) { delete x._new; });
    });
  }

  function purgeTrash() {
    var cutoff = Date.now() - P.retention * 86400000;
    var jobs = [];
    D.teachers.filter(function (x) { return x.deletedAt && x.deletedAt < cutoff; }).forEach(function (x) {
      D.teachers = D.teachers.filter(function (y) { return y.id !== x.id; });
      jobs.push(DB.del('teachers', x.id));
    });
    D.patients.filter(function (x) { return x.deletedAt && x.deletedAt < cutoff; }).forEach(function (x) {
      D.patients = D.patients.filter(function (y) { return y.id !== x.id; });
      jobs.push(DB.del('patients', x.id));
    });
    D.records.filter(function (x) { return x.deletedAt && x.deletedAt < cutoff; }).forEach(function (x) {
      D.records = D.records.filter(function (y) { return y.id !== x.id; });
      jobs.push(DB.del('records', x.id));
    });
    return Promise.all(jobs);
  }

  window.addEventListener('hashchange', function () { render(); });

  function boot() {
    root.innerHTML = '<div class="app"><div class="empty" style="padding-top:40vh">' +
      '<span class="gl">录</span><p>正在打开跟诊录…</p></div></div>';
    Promise.all([loadPrefs(), loadData(), CATALOG.init()]).then(function () {
      return purgeTrash();
    }).then(function () {
      applyTheme();
      if (!location.hash) location.hash = '#/teachers';
      render();
    }).catch(function (err) {
      root.innerHTML = '<div class="app"><div class="empty" style="padding-top:20vh">' +
        '<span class="gl">!</span><p>打开失败</p><p class="tiny">' + esc(err && err.message) + '</p>' +
        '<p class="tiny" style="margin-top:14px">如果是在微信里打开的，请点右上角「在浏览器中打开」，或用 Safari 访问。</p>' +
        '</div></div>';
    });
  }

  // 系统主题变化
  if (window.matchMedia) {
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
        if (P.theme === 'auto') render();
      });
    } catch (e) { /* 老浏览器忽略 */ }
  }

  boot();

  // Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { });
    });
  }
})();
