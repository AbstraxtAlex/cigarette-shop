(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var data = { cats: [], products: [] };
  var dirty = false;
  var uploadFor = null;
  var active = null;

  function status(msg, kind) {
    var s = $('status');
    s.textContent = msg || '';
    s.className = 'status' + (kind ? ' ' + kind : '');
  }
  function markDirty() {
    dirty = true;
    status('有未保存的修改。', '');
  }
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  function load() {
    fetch('/api/products', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { data = d; render(); status(''); })
      .catch(function () { status('无法载入数据，请确认 start.bat 正在运行。', 'err'); });
  }

  function catOptions(sel) {
    return data.cats.filter(function (c) { return c.key !== 'all'; }).map(function (c) {
      return '<option value="' + c.key + '"' + (c.key === sel ? ' selected' : '') + '>' + c.label + '</option>';
    }).join('');
  }

  function render() {
    var ul = $('rows');
    ul.innerHTML = '';
    data.products.forEach(function (p, i) {
      var li = document.createElement('li');
      li.className = 'row';
      li.dataset.i = i;
      li.innerHTML =
        '<button type="button" class="thumb' + (p.image ? '' : ' empty') + '" data-act="photo" aria-label="更换照片">' +
          (p.image ? '<img alt="" src="/images/' + encodeURIComponent(p.image) + '?t=' + Date.now() + '">' : '无照片') +
          '<span>更换照片</span></button>' +
        '<label class="f-name"><span class="visually-hidden">名称</span><input data-f="name" type="text" maxlength="80"></label>' +
        '<label class="f-price"><span class="visually-hidden">价格</span><input data-f="price" type="number" min="0" step="1" inputmode="numeric"></label>' +
        '<label class="f-cat"><span class="visually-hidden">分类</span><select data-f="cat">' + catOptions(p.cat) + '</select></label>' +
        '<div class="acts"><button type="button" data-act="up" aria-label="上移">↑</button>' +
          '<button type="button" data-act="down" aria-label="下移">↓</button>' +
          '<button type="button" class="del" data-act="del">删除</button></div>';
      li.querySelector('[data-f="name"]').value = p.name;
      li.querySelector('[data-f="price"]').value = p.price;
      if (i === active) li.classList.add('active');
      ul.appendChild(li);
    });
  }

  $('rows').addEventListener('input', function (e) {
    var f = e.target.dataset.f;
    if (!f) return;
    var row = e.target.closest('.row');
    var p = data.products[+row.dataset.i];
    p[f] = f === 'price' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value;
    row.classList.add('dirty');
    markDirty();
  });

  $('rows').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var row = b.closest('.row'), i = +row.dataset.i, act = b.dataset.act, a = data.products;
    if (act === 'photo') { uploadFor = i; $('file').value = ''; $('file').click(); return; }
    if (act === 'up' && i > 0) { var t = a[i - 1]; a[i - 1] = a[i]; a[i] = t; }
    else if (act === 'down' && i < a.length - 1) { var u = a[i + 1]; a[i + 1] = a[i]; a[i] = u; }
    else if (act === 'del') {
      if (!confirm('删除「' + (a[i].name || '这个产品') + '」？保存后才会生效。')) return;
      a.splice(i, 1);
    } else return;
    markDirty(); render();
  });

  var EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  function uploadImage(f, idx) {
    var ext = EXT[f.type] || (/\.(jpe?g|png|webp)$/i.test(f.name || '') ? f.name.split('.').pop().toLowerCase() : '');
    if (!ext) { status('只支持 jpg、png、webp 图片。', 'err'); return; }
    status('正在上传照片…');
    fetch('/api/upload?name=' + encodeURIComponent('image.' + ext), { method: 'POST', body: f })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); })
      .then(function (j) {
        data.products[idx].image = j.file;
        markDirty(); render();
        status('照片已更新，别忘了点「保存修改」。', '');
      })
      .catch(function (e) { status('上传失败：' + e.message, 'err'); });
  }

  $('file').addEventListener('change', function () {
    var f = $('file').files[0];
    if (f && uploadFor !== null) uploadImage(f, uploadFor);
  });

  // Paste: click a row (or its name/price box), then Ctrl+V an image copied from anywhere (Canva, a web page, a screenshot).
  function setActive(i) {
    active = i;
    document.querySelectorAll('.row.active').forEach(function (r) { r.classList.remove('active'); });
    var r = document.querySelector('.row[data-i="' + i + '"]');
    if (r) r.classList.add('active');
  }
  $('rows').addEventListener('focusin', function (e) { var r = e.target.closest('.row'); if (r) setActive(+r.dataset.i); });
  $('rows').addEventListener('click', function (e) { var r = e.target.closest('.row'); if (r) setActive(+r.dataset.i); });

  document.addEventListener('paste', function (e) {
    var items = (e.clipboardData && e.clipboardData.items) || [];
    for (var k = 0; k < items.length; k++) {
      if (items[k].kind === 'file' && items[k].type.indexOf('image/') === 0) {
        e.preventDefault();
        if (active === null || !data.products[active]) { status('先点一下要换照片的那一行，再按 Ctrl+V 粘贴。', 'err'); return; }
        uploadImage(items[k].getAsFile(), active);
        return;
      }
    }
  });

  // Drag an image file onto a row.
  $('rows').addEventListener('dragover', function (e) { if (e.target.closest('.row')) e.preventDefault(); });
  $('rows').addEventListener('drop', function (e) {
    var r = e.target.closest('.row'), f = e.dataTransfer && e.dataTransfer.files[0];
    if (!r || !f) return;
    e.preventDefault();
    setActive(+r.dataset.i);
    uploadImage(f, +r.dataset.i);
  });

  $('add').addEventListener('click', function () {
    data.products.unshift({ id: 'p' + Date.now(), name: '', price: 0, cat: 'ot', image: '' });
    markDirty(); render();
    var first = document.querySelector('.row [data-f="name"]');
    if (first) first.focus();
  });

  $('save').addEventListener('click', function () {
    for (var i = 0; i < data.products.length; i++) {
      var p = data.products[i];
      if (!String(p.name).trim()) { status('第 ' + (i + 1) + ' 个产品还没有名称。', 'err'); return; }
      if (p.price === '' || isNaN(p.price) || p.price < 0) { status('「' + p.name + '」的价格不正确。', 'err'); return; }
    }
    $('save').disabled = true;
    status('正在保存…');
    fetch('/api/products', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); })
      .then(function (j) {
        dirty = false;
        document.querySelectorAll('.row.dirty').forEach(function (r) { r.classList.remove('dirty'); });
        status('已保存，共 ' + j.count + ' 个产品。网站已更新。', 'ok');
      })
      .catch(function (e) { status('保存失败：' + e.message, 'err'); })
      .then(function () { $('save').disabled = false; });
  });

  load();
})();
