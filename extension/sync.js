// Content script trên trang PromptBuilder: nhận thư viện prompt app gửi qua window.postMessage
// (src/utils/extensionBridge.ts), hỏi xác nhận LẦN ĐẦU với mỗi trang, lưu chrome.storage, trả ACK.
(function () {
  'use strict';
  var core = globalThis.PBCore;

  // Đánh dấu "đã cài" để app biết ngay (không phải chờ hết thời gian chờ ACK).
  document.documentElement.setAttribute('data-promptbuilder-ext', '1');

  function ack(ok, extra) {
    var msg = { type: core.SYNC_ACK, ok: ok };
    for (var k in extra || {}) msg[k] = extra[k];
    window.postMessage(msg, window.location.origin);
  }

  window.addEventListener('message', function (e) {
    // Chỉ nhận tin do chính trang này gửi (không nhận từ iframe / cửa sổ khác).
    if (e.source !== window || e.origin !== window.location.origin) return;
    var d = e.data;
    if (!d || d.type !== core.SYNC_MESSAGE) return;

    var origin = window.location.origin;
    if (!core.isAllowedSyncOrigin(origin)) { ack(false, { error: 'Trang không dùng https.' }); return; }
    var checked = core.validatePayload(d.payload);
    if (!checked.ok) { ack(false, { error: checked.error }); return; }

    chrome.storage.local.get(['trustedOrigins'], function (res) {
      var trusted = Array.isArray(res.trustedOrigins) ? res.trustedOrigins : [];
      if (trusted.indexOf(origin) === -1) {
        // Trang lạ có thể cố nhét prompt độc hại → người dùng phải đồng ý một lần cho mỗi trang.
        var yes = window.confirm(
          'Tiện ích PromptBuilder: trang ' + origin + ' muốn đồng bộ ' + checked.prompts.length +
          ' prompt vào tiện ích (thay danh sách hiện có).\n\nChỉ đồng ý nếu đây là trang PromptBuilder của bạn.'
        );
        if (!yes) { ack(false, { error: 'Người dùng từ chối.' }); return; }
        trusted.push(origin);
      }
      chrome.storage.local.set({
        prompts: checked.prompts,
        syncedAt: new Date().toISOString(),
        syncedFrom: origin,
        trustedOrigins: trusted,
      }, function () {
        ack(true, { count: checked.prompts.length });
      });
    });
  });
})();
