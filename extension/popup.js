// Popup: tìm prompt đã đồng bộ, điền {{biến}}, chèn vào tab đang mở (insert.js) hoặc sao chép.
(function () {
  'use strict';
  var core = globalThis.PBCore;
  var $ = function (id) { return document.getElementById(id); };

  var prompts = [];
  var filtered = [];
  var selected = 0;
  var current = null;
  var values = {};

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text; // luôn textContent — nội dung prompt là dữ liệu, không phải HTML
    return n;
  }

  function setStatus(msg, kind) {
    var s = $('status');
    s.textContent = msg || '';
    s.className = kind || '';
  }

  function renderList() {
    var list = $('list');
    list.textContent = '';
    filtered = core.searchPrompts(prompts, $('search').value);
    selected = Math.min(selected, Math.max(0, filtered.length - 1));
    filtered.forEach(function (p, i) {
      var li = el('li', { role: 'option', tabindex: '-1', 'aria-selected': String(i === selected) });
      li.appendChild(el('div', { class: 't' }, p.title));
      li.appendChild(el('div', { class: 'd' }, p.description || p.text.slice(0, 120)));
      li.addEventListener('click', function () { openDetail(p); });
      list.appendChild(li);
    });
    var empty = $('empty');
    if (prompts.length === 0) {
      empty.hidden = false;
      empty.textContent = 'Chưa có prompt. Mở PromptBuilder → Thư viện → "Đồng bộ sang tiện ích".';
    } else if (filtered.length === 0) {
      empty.hidden = false;
      empty.textContent = 'Không có prompt khớp.';
    } else {
      empty.hidden = true;
    }
  }

  function preview() {
    $('preview').textContent = core.renderTemplate(current.text, values);
    var missing = core.missingVariables(current.text, values);
    if (missing.length) setStatus('Còn thiếu: ' + missing.join(', '), 'warn');
    else setStatus('', '');
  }

  function openDetail(p) {
    current = p;
    values = {};
    $('title').textContent = p.title;
    $('desc').textContent = p.description || '';
    var form = $('vars');
    form.textContent = '';
    p.variables.forEach(function (v, i) {
      var id = 'v_' + i;
      form.appendChild(el('label', { for: id }, v.name));
      var input;
      if (v.options && v.options.length) {
        // {{tên: a, b}} → ô chọn; mặc định lựa chọn đầu (như Builder).
        input = el('select', { id: id });
        v.options.forEach(function (o) { input.appendChild(el('option', { value: o }, o)); });
        values[v.name] = v.options[0];
      } else {
        input = el('textarea', { id: id, rows: '2' });
      }
      input.addEventListener('input', function () { values[v.name] = input.value; preview(); });
      input.addEventListener('change', function () { values[v.name] = input.value; preview(); });
      form.appendChild(input);
    });
    $('list-view').hidden = true;
    $('detail-view').hidden = false;
    preview();
    var first = form.querySelector('textarea');
    (first || $('insert')).focus();
  }

  function backToList() {
    current = null;
    $('detail-view').hidden = true;
    $('list-view').hidden = false;
    $('search').focus();
  }

  function finalText() {
    return core.renderTemplate(current.text, values);
  }

  function copy() {
    return navigator.clipboard.writeText(finalText()).then(
      function () { setStatus('Đã sao chép — dán (Ctrl/⌘+V) vào ô soạn tin.', 'ok'); },
      function () { setStatus('Không sao chép được.', 'warn'); }
    );
  }

  function insert() {
    var missing = core.missingVariables(current.text, values);
    if (missing.length) { setStatus('Điền đủ biến trước khi chèn: ' + missing.join(', '), 'warn'); return; }
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab || tab.id == null) { copy(); return; }
      chrome.tabs.sendMessage(tab.id, { type: 'PB_INSERT', text: finalText() }, function (res) {
        // Trang không hỗ trợ (không có insert.js) hoặc không tìm thấy ô soạn tin → chép vào clipboard.
        if (chrome.runtime.lastError || !res || !res.ok) {
          copy().then(function () {
            setStatus('Không chèn trực tiếp được trên trang này — đã sao chép, hãy dán vào ô soạn tin.', 'warn');
          });
          return;
        }
        window.close();
      });
    });
  }

  $('search').addEventListener('input', function () { selected = 0; renderList(); });
  $('search').addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { selected = Math.min(selected + 1, filtered.length - 1); renderList(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { selected = Math.max(selected - 1, 0); renderList(); e.preventDefault(); }
    else if (e.key === 'Enter' && filtered[selected]) { openDetail(filtered[selected]); e.preventDefault(); }
  });
  $('back').addEventListener('click', backToList);
  $('insert').addEventListener('click', insert);
  $('copy').addEventListener('click', copy);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && current) { backToList(); e.preventDefault(); }
  });

  chrome.storage.local.get(['prompts', 'syncedAt', 'syncedFrom'], function (res) {
    prompts = Array.isArray(res.prompts) ? res.prompts : [];
    if (res.syncedAt) {
      $('meta').textContent = prompts.length + ' prompt · đồng bộ ' + new Date(res.syncedAt).toLocaleDateString('vi-VN');
      $('meta').title = 'Từ ' + (res.syncedFrom || '');
    }
    renderList();
    $('search').focus();
  });
})();
