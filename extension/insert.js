// Content script trên trang chat (ChatGPT, Claude, Gemini…): nhận lệnh chèn từ popup và đưa
// văn bản vào ô soạn tin. Ưu tiên ô đang focus; không có thì thử bộ chọn phổ biến theo trang.
(function () {
  'use strict';

  // Ô soạn tin thường gặp — thứ tự ưu tiên. Giao diện các trang hay đổi: không khớp thì popup
  // sẽ chép vào clipboard để người dùng tự dán.
  var SELECTORS = [
    '#prompt-textarea',                        // ChatGPT
    'div.ProseMirror[contenteditable="true"]', // Claude và nhiều trình soạn ProseMirror
    'rich-textarea [contenteditable="true"]',  // Gemini
    'textarea:not([disabled]):not([readonly])',
    '[contenteditable="true"]',
  ];

  var lastFocused = null;
  document.addEventListener('focusin', function (e) {
    if (isEditable(e.target)) lastFocused = e.target;
  }, true);

  function isEditable(el) {
    if (!el || !el.isConnected) return false;
    if (el.tagName === 'TEXTAREA') return !el.disabled && !el.readOnly;
    if (el.tagName === 'INPUT') return /^(text|search)$/i.test(el.type) && !el.disabled && !el.readOnly;
    return el.isContentEditable === true;
  }

  function findTarget() {
    if (isEditable(document.activeElement)) return document.activeElement;
    if (isEditable(lastFocused)) return lastFocused;
    for (var i = 0; i < SELECTORS.length; i++) {
      var el = document.querySelector(SELECTORS[i]);
      if (isEditable(el)) return el;
    }
    return null;
  }

  function insertInto(el, text) {
    el.focus();
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      // Gán qua setter gốc để React/Vue nhận thay đổi, rồi phát sự kiện input.
      var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      var start = el.selectionStart != null ? el.selectionStart : el.value.length;
      var end = el.selectionEnd != null ? el.selectionEnd : el.value.length;
      setter.call(el, el.value.slice(0, start) + text + el.value.slice(end));
      el.selectionStart = el.selectionEnd = start + text.length;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    // contenteditable (ProseMirror, Quill…): insertText đi qua trình soạn nên giữ đúng trạng thái.
    if (document.execCommand && document.execCommand('insertText', false, text)) return true;
    el.textContent = (el.textContent || '') + text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
    return true;
  }

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (!msg || msg.type !== 'PB_INSERT' || typeof msg.text !== 'string') return;
    var el = findTarget();
    if (!el) { sendResponse({ ok: false, error: 'Không tìm thấy ô soạn tin trên trang.' }); return; }
    try {
      sendResponse({ ok: insertInto(el, msg.text) });
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message || e) });
    }
  });
})();
