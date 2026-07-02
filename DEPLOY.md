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

> ⚠️ **Env var chỉ áp cho deployment build SAU khi bạn thêm nó.** Set key xong PHẢI **redeploy** thì function mới đọc được.

Tùy chọn (khi frontend khác origin với backend — vd host frontend nơi khác): `VITE_AI_PROXY_URL`, `VITE_AI_OPTIMIZE_URL` trỏ tới URL đầy đủ của function trên Vercel. All-Vercel thì bỏ qua.

---

## 2. Deploy Firestore rules (Firebase) — BẮT BUỘC

Mỗi khi thêm/đổi collection hoặc `firestore.rules`, phải deploy lại, nếu không truy vấn sẽ báo `Missing or insufficient permissions`:

```bash
npx firebase-tools login          # 1 lần, đăng nhập tài khoản sở hữu eduai-nexus
npx firebase-tools deploy --only firestore:rules
```

`.firebaserc` (project mặc định) và `firebase.json` (đường dẫn rules + database `ai-studio-...`) đã cấu hình sẵn — không cần cờ thêm.

Các collection cần rules: `templates`, `projects`, `rules`, `skills`, `workspaces`, `personas`, `bookmarks`, `healthSuites`, `sharedApps`, `suggestionModels`.

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
