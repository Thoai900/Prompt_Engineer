# Hướng dẫn Deploy — PromptBuilder

Kiến trúc gồm **2 nền tảng**, deploy **độc lập** nhau:

| Thành phần | Chạy ở | Deploy bằng |
|---|---|---|
| Frontend (React/Vite) + Serverless `api/*` | **Vercel** | `git push` (auto-build) hoặc `vercel --prod` |
| Auth (Google) + Firestore + **rules** | **Firebase** (`eduai-nexus`) | `firebase deploy --only firestore:rules` |

> Frontend và `/api` cùng nằm trên Vercel ⇒ cùng origin, gọi `/api/ai` và `/api/optimize` không cần CORS. Firebase chỉ lo Auth + database (không "deploy server", nhưng **rules bắt buộc phải deploy**).

---

## 1. Deploy frontend + serverless (Vercel)

Nếu repo đã nối GitHub với Vercel (thường vậy):

```bash
git add -A
git commit -m "..."
git push
```

Vercel tự build (`vite build` → `dist`, và mỗi file trong `api/` thành một serverless function). Chờ Deployment mới nhất báo **Ready**.

Hoặc CLI: `npx vercel --prod`.

### Biến môi trường (Vercel → Settings → Environment Variables)
Bắt buộc, Environment = **Production**:
- `GEMINI_API_KEY` — key Gemini mặc định của server.
- `GROQ_API_KEY` — key **Groq** (hãng inference, *không phải* "Grok"). Lấy free tại https://console.groq.com

Tuỳ chọn:
- `ANTHROPIC_API_KEY` — bật 2 model Claude (Opus 4.8, Haiku 4.5) trong dropdown/Bake-off. Thiếu key thì chọn Claude sẽ báo lỗi rõ ràng, các provider khác không ảnh hưởng. Lấy tại https://platform.claude.com
- `VITE_RECAPTCHA_SITE_KEY` — bật **Firebase App Check** (chặn client giả mạo). Quy trình: (1) tạo site key reCAPTCHA v3, (2) Firebase Console → App Check → đăng ký app với key đó, (3) set env này + redeploy, (4) theo dõi ở chế độ **Monitor** vài ngày rồi mới bấm **Enforce** cho Firestore. Không set env = App Check tắt, app chạy như cũ.

> ⚠️ **Env var chỉ áp cho deployment build SAU khi bạn thêm nó.** Set key xong PHẢI **redeploy** thì function mới đọc được.

Tùy chọn (khi frontend khác origin với backend — vd host frontend nơi khác): `VITE_AI_PROXY_URL`, `VITE_AI_OPTIMIZE_URL` trỏ tới URL đầy đủ của function trên Vercel. All-Vercel thì bỏ qua. Nếu frontend khác origin, thêm origin đó vào `ALLOWED_ORIGINS` (phân tách dấu phẩy) — proxy chỉ cho phép origin cùng host, localhost và danh sách này.

Tùy chọn (giới hạn tần suất — có default hợp lý): `AI_RATE_LIMIT_PER_MIN` (20), `AI_RATE_LIMIT_PER_HOUR` (240), `OPTIMIZE_RATE_LIMIT_PER_MIN` (3), `OPTIMIZE_RATE_LIMIT_PER_HOUR` (20).

### Cron health-check tự động (`/api/health-cron`, chạy 21:00 UTC hằng ngày)
Bắt buộc nếu muốn bật (thiếu thì endpoint từ chối chạy, KHÔNG ảnh hưởng phần khác):
- `CRON_SECRET` — chuỗi ngẫu nhiên bất kỳ; Vercel Cron tự đính kèm khi gọi endpoint.
- `FIREBASE_SERVICE_ACCOUNT` — TOÀN BỘ file JSON service account (Firebase Console → Project Settings → Service accounts → Generate new private key), dán nguyên văn làm giá trị env. Cần role mặc định (Editor) hoặc tối thiểu **Cloud Datastore User**.

Sau khi set 2 env này + redeploy, các Health suite bật "Tự động chạy hằng ngày" (Lab → Prompt Health) sẽ được server tự chạy và ghi kết quả vào lịch sử run.

---

## 2. Deploy Firestore rules (Firebase) — BẮT BUỘC

Mỗi khi thêm/đổi collection hoặc `firestore.rules`, phải deploy lại, nếu không truy vấn sẽ báo `Missing or insufficient permissions`:

```bash
npx firebase-tools login          # 1 lần, đăng nhập tài khoản sở hữu eduai-nexus
npx firebase-tools deploy --only firestore:rules
```

`.firebaserc` (project mặc định) và `firebase.json` (đường dẫn rules + database `ai-studio-...`) đã cấu hình sẵn — không cần cờ thêm.

Các collection cần rules: `templates`, `projects`, `rules`, `skills`, `workspaces`, `personas`, `bookmarks`, `healthSuites`, `sharedApps`, `suggestionModels`, `reports`.

### Cấp quyền admin (moderation — M5)
Nút "Gỡ (Admin)" và việc đọc collection `reports` yêu cầu custom claim `admin: true` trên tài khoản. Đặt một lần bằng Admin SDK (chạy local với service account, hoặc Cloud Shell):

```js
// node set-admin.mjs (cần GOOGLE_APPLICATION_CREDENTIALS trỏ tới service account JSON)
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
initializeApp({ credential: applicationDefault(), projectId: 'eduai-nexus' });
const user = await getAuth().getUserByEmail('email-admin@gmail.com');
await getAuth().setCustomUserClaims(user.uid, { admin: true });
console.log('OK — đăng xuất/đăng nhập lại để token mới có claim.');
```

---

## 3. Checklist mỗi lần phát hành

- [ ] `npm run lint && npm test && npm run build` xanh (CI cũng chạy — `.github/workflows/ci.yml`).
- [ ] Commit + push → Vercel build Ready.
- [ ] Nếu vừa đổi `firestore.rules`: `firebase deploy --only firestore:rules`.
- [ ] Nếu vừa thêm/đổi env: đã **redeploy** Vercel sau khi set.

---

## Sự cố thường gặp (đã gặp thật)

- **`/api/*` trả `500 FUNCTION_INVOCATION_FAILED`** (mù, không JSON): function crash lúc nạp module. Nguyên nhân từng gặp: import file phụ `_`-prefix mà Vercel không bundle → **giữ mỗi serverless function TỰ CHỨA** (không import file helper cục bộ), giống `api/ai.ts`, `api/optimize.ts`. Luôn bọc cả handler trong `try/catch` trả JSON.
- **`429 / RESOURCE_EXHAUSTED`**: Gemini free-tier chỉ **5 request/phút MỖI model**. `api/optimize.ts` đã **xoay vòng model** (gemini-2.5-flash → 3.5-flash → 2.5-pro → Groq) khi chạm giới hạn. Nếu vẫn hết: giảm số biến thể/vòng, hoặc nâng key Gemini trả phí.
- **`Missing or insufficient permissions`**: chưa deploy `firestore.rules` (xem mục 2).
- **Đổi env mà không thấy tác dụng**: chưa redeploy Vercel sau khi set env.
