# Thiết kế: Xuất Prompt Graph thành Agent Skill · HTTP API · MCP server (#4)

Ngày: 2026-11-19
Trạng thái: ĐÃ DUYỆT (2026-11-19, chấp nhận cả 4 đề xuất ở "Câu hỏi mở": (c) · tất cả app · (a) · SDK) · Đợt 1–2 đã build

## Mục tiêu

Hôm nay một Prompt Graph chỉ chạy được BÊN TRONG PromptBuilder (Chain → App, người xem tự đăng nhập). Hướng này đưa
nó ra ngoài, theo 3 mức tăng dần về độ phức tạp và rủi ro:

1. **Agent Skill** — tải `SKILL.md` (kèm lệnh cài) để Claude Code / Codex / agent khác dùng prompt như một skill.
   Thuần client, không chi phí server.
2. **HTTP API** — `POST /api/run` gọi một app đã xuất bản bằng API key, trả output. Dùng từ code/no-code (Zapier, n8n…).
3. **MCP server** — `/api/mcp`: mỗi app bật API là một **tool** có `inputSchema` sinh từ biến; agent gọi trực tiếp.

Kết quả người dùng thấy: "prompt tôi dựng bằng graph trở thành một công cụ mà agent và hệ thống khác gọi được".

## Hiện trạng (đã kiểm tra trong code)

- **Snapshot app**: `publishApp` (`src/services/chainAppService.ts`) ghi `sharedApps/{projectId}` gồm `graphNodes`/`edges`
  thô. Server KHÔNG compile được graph: `api/*` phải tự chứa (không import `src/utils/graphCompile.ts`).
- **Prompt mẫu đã có sẵn**: `compileAppTemplate(project)` + `collectGraphVariables` (`src/utils/feedbackUtils.ts`,
  `graphCompile.ts`) compile graph nhưng GIỮ chỗ `{{biến}}`; `renderVars` điền biến — đã có bản trùng có chủ đích
  trong `api/optimize.ts` và `api/health-cron.ts`.
- **App chạy thế nào**: `runChainApp` → `systemInstruction = prompt đã điền biến`, `userContent = câu kích hoạt cố định`,
  model `GEMINI_FLASH` (`src/config/models.ts`). App legacy (cây v2) chạy nhiều bước — không quy về 1 prompt.
- **Xuất file**: `src/utils/exporters.ts` (SKILL.md / AGENTS.md… cho `AiSkill`/`AiRule`) và
  `src/utils/agentInstall.ts` (`slugifySkill`, bảng thư mục skills theo agent) — chưa nhận `PromptProject`.
- **Backend**: `api/ai.ts` có allowlist model, rate-limit theo uid trong bộ nhớ (mỗi instance), xác thực Firebase ID
  token bằng `jose`. `api/health-cron.ts` có mẫu đọc/ghi Firestore REST bằng service account (`FIREBASE_SERVICE_ACCOUNT`).
- **Nguyên tắc hiện tại**: Shared App cố ý "không mở API công khai" — người xem chạy bằng auth của chính họ. Mức 2–3
  phá nguyên tắc đó có chủ đích, nên phải có key, quota và nút tắt.

## Quyết định thiết kế (đề xuất)

1. **Server không compile graph.** Lúc xuất bản, client tính sẵn và lưu vào snapshot: `promptTemplate` (từ
   `compileAppTemplate`), `variables` (tên/mô tả/bắt buộc/mặc định), `model`. Server chỉ còn `renderVars` + gọi model.
   App legacy không bật được API/MCP (giống giới hạn của Flywheel).
2. **Opt-in từng app**: thêm `apiEnabled` vào snapshot. App chưa bật → API/MCP trả 404 như không tồn tại.
3. **Một lõi chạy dùng chung** cho API và MCP (trong cùng file hoặc trùng có chủ đích giữa 2 function — xem Câu hỏi mở #3):
   xác thực key → nạp snapshot → kiểm biến → điền biến → gọi model (chuỗi dự phòng như `api/optimize.ts`) → ghi lượt dùng.
4. **API key do chủ app tạo**, chỉ hiện MỘT lần; lưu **SHA-256** (không lưu key gốc). Key gắn với chủ, phạm vi = danh
   sách app hoặc tất cả app đã bật API của chủ. Thu hồi được.
5. **Agent Skill làm trước** (Đợt 1): giá trị ngay, không đụng backend, không rủi ro chi phí.

## Phần A — Agent Skill (Đợt 1, thuần client)

Hàm thuần mới trong `src/utils/exporters.ts` (test được):

```ts
graphToSkillMd(project: PromptProject): string | null   // null nếu app legacy
```

- Frontmatter `name` (từ `slugifySkill(project.name)`) + `description` (mô tả project; trống → câu sinh từ tên).
- Body: `## Inputs` (mỗi biến: tên, bắt buộc, mô tả, mặc định) → `## Instructions` = `promptTemplate`, kèm một dòng
  hướng dẫn agent "thay `{{tên_biến}}` bằng giá trị người dùng cung cấp; hỏi lại nếu thiếu biến bắt buộc".
- `graphSkillInstallCommands(project)`: lệnh dán-là-chạy tạo `~/.claude/skills/<slug>/SKILL.md` (heredoc, không cần
  host file) cho Claude Code (user/project) và Codex — tái dùng bảng `DOWNLOAD_TARGETS` của `agentInstall.ts`
  (tách ra export dùng chung, không nhân đôi).

UI: nút **"Xuất"** trong thanh công cụ của `GraphWorkspace` (cạnh lưu phiên bản) → menu: Tải `SKILL.md` · Sao chép lệnh
cài cho agent · (Đợt 2+) "Bật API / MCP…". App legacy: mục bị vô hiệu kèm lý do.

## Phần B — Snapshot xuất bản mở rộng (Đợt 2)

`publishApp` ghi thêm (chỉ với app Prompt Graph):

```
sharedApps/{appId}
  promptTemplate: string        // ≤ 50k ký tự
  variables: [{ name, description?, required, defaultValue? }]   // ≤ 30
  model: string                 // giá trị từ src/config/models.ts; server kiểm allowlist
  apiEnabled: bool              // mặc định false
```

Rule `isValidSharedApp`: thêm kiểm kiểu/kích thước các trường mới. Lưu ý: `sharedApps` đang **public read** → prompt
mẫu vốn đã lộ qua `graphNodes`; không làm tệ hơn, nhưng ghi rõ trong UI "API không giấu được prompt".

## Phần C — API key (Đợt 2)

Collection mới:

```
apiKeys/{sha256(key)}           // id = hash → server tra trực tiếp, không cần query
  ownerId: string
  name: string                  // nhãn do chủ đặt
  prefix: string                // 8 ký tự đầu để nhận diện trong UI ("pb_live_ab12…")
  appIds: string[] | ['*']      // phạm vi
  dailyQuota: number            // mặc định — xem Câu hỏi mở #1
  usage: { day: 'YYYY-MM-DD', count: number }
  createdAt, revokedAt?: timestamp
```

- Key = `pb_live_` + 32 byte ngẫu nhiên (base64url), sinh ở client bằng `crypto.getRandomValues`, hash bằng
  `crypto.subtle.digest('SHA-256')`, hiện 1 lần kèm nút sao chép.
- Rule: chủ tạo (`ownerId == auth.uid`, `usage.count == 0`), list/get của mình, chỉ được đổi `name`/`appIds`/`revokedAt`;
  **client không được sửa `usage`/`dailyQuota`**. Server ghi `usage` bằng service account (bỏ qua rule).
- UI quản lý key: trong Lab → Chain → App (mục "API & MCP"): tạo, đặt tên, chọn app, thu hồi, xem lượt dùng hôm nay.

## Phần D — HTTP API `api/run.ts` (Đợt 2)

```
POST /api/run
Authorization: Bearer pb_live_…
{ "app": "<appId>", "inputs": { "chude": "mèo" } }
→ 200 { "output": "…", "model": "…", "usage": { "today": 12, "quota": 100 } }
```

Luồng (function tự chứa, mẫu Firestore REST từ `api/health-cron.ts`):
1. Hash key → GET `apiKeys/{hash}`; thiếu/thu hồi → 401. App ngoài phạm vi → 404.
2. GET `sharedApps/{app}`; `apiEnabled != true` hoặc thiếu `promptTemplate` → 404. `ownerId` của key phải trùng `userId`
   của app (key của người khác không gọi được app không phải của họ).
3. Kiểm `inputs`: chỉ nhận biến khai báo; thiếu biến bắt buộc (sau khi áp mặc định) → 400 kèm danh sách; mỗi giá trị
   ≤ 10k ký tự, tổng ≤ 50k.
4. Quota: tăng `usage` bằng Firestore `commit` có transform `increment` + precondition theo ngày; vượt → 429.
   Rate-limit theo key trong bộ nhớ (như `api/ai.ts`) để chặn burst.
5. `renderVars(promptTemplate, inputs)` → gọi model của app (allowlist + chuỗi dự phòng Gemini→Groq) với cùng câu
   kích hoạt cố định như `runChainApp` → trả output.
6. Không lưu input/output (quyền riêng tư); chỉ đếm lượt.

CORS: mặc định **không** mở cho trình duyệt (key không được nằm trong code front-end của bên thứ ba); gọi từ server.

## Phần E — MCP server `api/mcp.ts` (Đợt 3)

- Giao thức MCP qua **Streamable HTTP, chế độ stateless** (mỗi POST một JSON-RPC, không phiên) — hợp với serverless.
- Xác thực bằng cùng API key (`Authorization: Bearer`). Server = "các app đã bật API trong phạm vi key".
- `tools/list`: mỗi app → một tool `name` = slug app, `description` = mô tả app, `inputSchema` = JSON Schema object từ
  `variables` (`type: string`, `description`, `required[]`, `default`).
- `tools/call`: chạy lõi của Phần D, trả `content: [{ type: 'text', text: output }]`; lỗi nghiệp vụ trả `isError: true`.
- UI: hiện URL + lệnh thêm vào agent, ví dụ Claude Code:
  `claude mcp add --transport http promptbuilder https://<domain>/api/mcp --header "Authorization: Bearer <key>"`
  (cú pháp từng agent cần xác minh lại khi build).

## Phần F — Test & CI

Thuần (vitest):
- `graphToSkillMd`: frontmatter, liệt kê biến, giữ `{{biến}}`, legacy → null; lệnh cài dùng đúng slug/thư mục.
- Snapshot: hàm `buildPublishSnapshot(project)` (thuần) — template/variables/model đúng, legacy → không có trường API.
- `api/run.ts`: export các hàm thuần trong file (như `api/optimize.ts`): kiểm `inputs` (thiếu bắt buộc, biến lạ,
  quá dài), áp mặc định, `variablesToJsonSchema` (dùng chung ý cho MCP), tính ngày quota.
- `api/mcp.ts`: test `tools/list`/`tools/call` với Firestore + model giả lập.
- Rules mới chưa có emulator → checklist kiểm tay trong PR (key người khác, key thu hồi, sửa `usage` từ client bị chặn).

## Chia đợt

1. **Đợt 1 — Agent Skill** (Phần A). Không backend, không rule.
2. **Đợt 2 — Snapshot + API key + `/api/run`** (B, C, D). Cần deploy rules (workflow tự deploy khi merge) và env
   `FIREBASE_SERVICE_ACCOUNT` trên Vercel (cron đã dùng).
3. **Đợt 3 — MCP** (E), dựa trên lõi của Đợt 2.

## Ngoài phạm vi

Streaming qua API; app legacy nhiều bước; giấu prompt khỏi người xem; thanh toán/thu phí; webhook; OAuth cho MCP
(dùng API key tĩnh); dashboard thống kê chi tiết; gọi trực tiếp từ trình duyệt bên thứ ba.

## Câu hỏi mở — ĐÃ CHỐT theo đề xuất

1. **Ai trả tiền gọi model?** (a) Key server của app + quota/ngày cho mỗi API key (đề xuất mặc định 100 lượt/ngày,
   chủ hạ được, KHÔNG tự nâng quá trần env `RUN_MAX_DAILY_QUOTA`); (b) bắt buộc người gọi gửi key Gemini/Groq của họ
   (BYOK) — không tốn tiền server nhưng khó dùng hơn; (c) cả hai: mặc định (a), có header BYOK thì bỏ qua quota.
   Đề xuất **(c)**.
2. **Phạm vi key mặc định**: một app (an toàn) hay tất cả app đã bật API (tiện cho MCP)? Đề xuất: UI mặc định chọn
   tất cả, cho bỏ chọn.
3. **Chia sẻ lõi giữa `/api/run` và `/api/mcp`**: (a) một function `api/run.ts` xử lý cả hai qua path
   (`/api/run` và rewrite `/api/mcp` → `/api/run?mode=mcp`) — một chỗ code; (b) hai file, trùng có chủ đích như các
   function hiện tại. Đề xuất **(a)**.
4. **MCP SDK hay tự viết JSON-RPC?** SDK chính thức đúng giao thức hơn nhưng thêm dependency và cần thử chạy trên
   Vercel; tự viết chỉ cần `initialize`/`tools/list`/`tools/call`. Đề xuất **SDK**, rơi về tự viết nếu không chạy ổn
   ở chế độ stateless trên Vercel.

## Ghi chú triển khai Đợt 1

- `graphToSkillMd` / `graphSkillInstallCommands` ở `src/utils/exporters.ts`; tái dùng `compileAppTemplate`
  (giữ `{{biến}}`, KHÔNG điền mặc định — mặc định ghi trong mục Inputs) và `collectGraphVariables`.
- `description` frontmatter đặt trong nháy kép (chuỗi JSON) để không vỡ YAML khi có dấu ":".
- Lệnh cài dùng heredoc với delimiter trong nháy đơn (`<<'PB_SKILL_EOF'`) → shell không khai triển `$`, backtick;
  nội dung có dòng trùng delimiter thì tự đổi sang `PB_SKILL_EOF_2`… Đã chạy thật lệnh sinh ra trong bash: file tạo
  ra giống hệt SKILL.md. Chỉ hỗ trợ macOS/Linux/WSL; Windows thuần dùng nút "Tải SKILL.md".
- `slugifySkill` bỏ dấu tiếng Việt ("Viết thơ" → `viet-tho`); `DOWNLOAD_TARGETS` export dùng chung với
  `buildInstallCommands`.
- UI: nút "Xuất skill" trên thanh công cụ panel xem trước prompt của Prompt Graph → `ExportSkillModal`
  (xem trước, sao chép, tải, lệnh cài theo agent). Mục "Bật API / MCP…" để Đợt 2.

## Ghi chú triển khai Đợt 2

- `src/utils/apiAccess.ts` (thuần): `buildPublishSnapshot`, `generateApiKey` (`pb_live_` + 43 ký tự base64url),
  `hashApiKey` (WebCrypto, khớp `hashKey` node crypto ở server — có test), `buildCurlExample`, `quotaToday`.
- `publishApp(user, project, { apiEnabled? })`: app Prompt Graph luôn ghi snapshot; bật API = xuất bản lại để snapshot
  khớp graph hiện tại. App mới tạo có `apiEnabled: false`. Bật API cần xác nhận (nhắc chi phí + prompt vẫn công khai).
- `api/run.ts` theo Phần D; quota đếm TRƯỚC khi gọi model (lượt gọi model lỗi vẫn bị tính — chặn dò lỗi tốn tiền).
  Quota dùng read-modify-write có precondition `updateTime` (thử lại 4 lần), không dùng transform `increment` vì
  cần reset theo ngày. Không phân biệt "không tồn tại / chưa bật / ngoài phạm vi" (đều 404) để tránh dò app.
- BYOK: `X-Gemini-Api-Key` hoặc `X-Groq-Api-Key` → gọi đúng nhà cung cấp đó, không rơi về key server, không tính quota
  (vẫn qua rate-limit theo key).
- Rules `apiKeys`: id phải là SHA-256 hex; client không sửa được `usage`, chỉ hạ `dailyQuota` (1–100), thu hồi một
  chiều (không bỏ `revokedAt` được). `isValidSharedApp` kiểm thêm `promptTemplate`/`variables`/`model`/`apiEnabled`.
- UI: khu "Gọi app qua API" trong Chain → App (chủ app, đã đăng nhập): bật/tắt API, ví dụ curl, tạo key (mặc định
  mọi app, tuỳ chọn "Chỉ app này"), key hiện một lần, danh sách key + lượt hôm nay, thu hồi.
- Test: hàm thuần client/server + chạy cả handler với Firestore/OAuth/Groq giả lập qua `fetch` (quota, BYOK, 401/404/400/
  405/429, tranh chấp ghi). Chưa kiểm với Firestore/Vercel thật; rules chưa có emulator.
