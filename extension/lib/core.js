// Logic thuần dùng chung cho popup và content script của tiện ích PromptBuilder.
// Script thường (không ES module — content script MV3 không nạp module): gắn vào globalThis.PBCore.
// Test: src/__tests__/extensionCore.test.ts nạp file này trong vm.
// Định dạng gói PHẢI khớp src/utils/extensionBridge.ts (buildExtensionPayload).
(function (root) {
  'use strict';

  var SYNC_MESSAGE = 'PROMPTBUILDER_SYNC';
  var SYNC_ACK = 'PROMPTBUILDER_SYNC_ACK';
  var PAYLOAD_VERSION = 1;
  var MAX_PROMPTS = 200;
  var MAX_TEXT = 20000;
  // Cú pháp biến của template PromptBuilder (Builder): {{tên}} hoặc {{tên: lựa chọn 1, lựa chọn 2}};
  // tên có thể có dấu và khoảng trắng. Bỏ trống biến có lựa chọn → dùng lựa chọn đầu (như Builder).
  var VAR_RE = /\{\{([^}]+)\}\}/g;

  function parseVar(inner) {
    var parts = String(inner).split(':');
    var name = parts[0].trim();
    var options = parts.length > 1
      ? parts.slice(1).join(':').split(',').map(function (o) { return o.trim(); }).filter(Boolean)
      : [];
    return { name: name, options: options };
  }

  function isStr(v, max) {
    return typeof v === 'string' && v.length <= max;
  }

  /**
   * Kiểm gói đồng bộ từ trang PromptBuilder. Trả { ok: true, prompts } hoặc { ok: false, error }.
   * Chỉ giữ các trường đã biết (dữ liệu đến từ một trang web — không tin tuỳ tiện).
   */
  function validatePayload(p) {
    if (!p || typeof p !== 'object') return { ok: false, error: 'Gói rỗng.' };
    if (p.version !== PAYLOAD_VERSION) return { ok: false, error: 'Phiên bản gói không hỗ trợ.' };
    if (!Array.isArray(p.prompts)) return { ok: false, error: 'Thiếu danh sách prompt.' };
    if (p.prompts.length > MAX_PROMPTS) return { ok: false, error: 'Quá nhiều prompt.' };
    var out = [];
    for (var i = 0; i < p.prompts.length; i++) {
      var x = p.prompts[i];
      if (!x || !isStr(x.id, 200) || !isStr(x.title, 200) || !isStr(x.text, MAX_TEXT) || !x.text.trim()) {
        return { ok: false, error: 'Prompt thứ ' + (i + 1) + ' không hợp lệ.' };
      }
      out.push({
        id: x.id,
        title: x.title,
        description: isStr(x.description, 500) ? x.description : '',
        category: isStr(x.category, 100) ? x.category : '',
        text: x.text,
        variables: extractVariables(x.text),
      });
    }
    return { ok: true, prompts: out };
  }

  /** Biến trong văn bản: [{ name, options }], không trùng tên, theo thứ tự xuất hiện. */
  function extractVariables(text) {
    var out = [];
    var seen = {};
    String(text || '').replace(VAR_RE, function (m, inner) {
      var v = parseVar(inner);
      if (v.name && !seen[v.name]) { seen[v.name] = true; out.push(v); }
      return m;
    });
    return out;
  }

  function filled(values, name) {
    var v = values && values[name];
    return typeof v === 'string' && v.trim() ? v : '';
  }

  /** Điền biến; trống → lựa chọn đầu (nếu có), không thì giữ nguyên {{…}} để thấy còn thiếu. */
  function renderTemplate(text, values) {
    return String(text || '').replace(VAR_RE, function (m, inner) {
      var v = parseVar(inner);
      return filled(values, v.name) || v.options[0] || m;
    });
  }

  /** Tên các biến chưa có giá trị và không có lựa chọn mặc định. */
  function missingVariables(text, values) {
    return extractVariables(text)
      .filter(function (v) { return !filled(values, v.name) && v.options.length === 0; })
      .map(function (v) { return v.name; });
  }

  function fold(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  }

  /** Tìm theo tiêu đề / mô tả / nhóm / nội dung, không phân biệt dấu; tiêu đề khớp xếp trước. */
  function searchPrompts(prompts, query) {
    var q = fold(query).trim();
    if (!q) return prompts.slice();
    var terms = q.split(/\s+/);
    var scored = [];
    prompts.forEach(function (p, idx) {
      var title = fold(p.title);
      var rest = fold([p.description, p.category, p.text].join(' '));
      var ok = terms.every(function (t) { return title.indexOf(t) !== -1 || rest.indexOf(t) !== -1; });
      if (!ok) return;
      var score = terms.filter(function (t) { return title.indexOf(t) !== -1; }).length;
      scored.push({ p: p, score: score, idx: idx });
    });
    scored.sort(function (a, b) { return b.score - a.score || a.idx - b.idx; });
    return scored.map(function (s) { return s.p; });
  }

  /** Origin hợp lệ để hỏi xác nhận đồng bộ (https, hoặc http://localhost khi phát triển). */
  function isAllowedSyncOrigin(origin) {
    try {
      var u = new URL(origin);
      if (u.protocol === 'https:') return true;
      return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
    } catch (e) {
      return false;
    }
  }

  root.PBCore = {
    SYNC_MESSAGE: SYNC_MESSAGE,
    SYNC_ACK: SYNC_ACK,
    PAYLOAD_VERSION: PAYLOAD_VERSION,
    validatePayload: validatePayload,
    extractVariables: extractVariables,
    renderTemplate: renderTemplate,
    missingVariables: missingVariables,
    searchPrompts: searchPrompts,
    isAllowedSyncOrigin: isAllowedSyncOrigin,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
