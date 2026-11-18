# Thiết kế: Prompt Flywheel (#1) + Prompt Git (#2)

Ngày: 2026-11-18
Trạng thái: ĐÃ DUYỆT (2026-11-18, chấp nhận cả 4 đề xuất ở mục "Câu hỏi mở") · Đợt 1 đã build

## Mục tiêu

Nối các công cụ đang rời rạc (Shared App · Health · Optimizer · lịch sử phiên bản) thành một vòng:

```
Shared App (người dùng thật)
  → 👍/👎 + góp ý  ─────────────►  Hộp phản hồi (chủ app duyệt)
                                      → "Biến thành test"  ─►  Health suite
Health suite chạy  ─►  điểm gắn vào REVISION cụ thể của prompt  (Prompt Git)
Đủ test trượt      ─►  gợi ý chạy Optimizer trên CẢ bộ test
Optimizer ra bản mới ─► lưu thành revision mới, chạy Health, so điểm với bản cũ
Chủ app chấp nhận  ─►  xuất bản lại Shared App với revision đó
```

Kết quả người dùng thấy: "prompt của tôi tốt lên nhờ được dùng, và tôi biết chắc bản nào tốt hơn bản nào".

## Hiện trạng (đã kiểm tra trong code)

- **Ba hệ phiên bản tách rời, không cái nào gắn điểm số**:
  - Template: `TemplateVersion` (snapshot blocks, tối đa 10) — `src/utils/templateVersionUtils.ts`.
  - Project Graph: `PromptVersion` (chuỗi prompt đã compile, tối đa 50) — `GraphWorkspace.handleSaveVersion` + `VersionDrawer` (diff bằng `computeUnifiedDiff` trong `chainUtils.ts`).
  - Health suite: chỉ có `prompt: string` hiện hành; `HealthRun` ghi `model` nhưng KHÔNG ghi prompt nào đã chạy → đổi prompt là mất khả năng so sánh.
- **Health suite không liên kết nguồn**: không biết suite đang test template/project nào.
- **Optimizer chỉ nhận 1 `testInput`** + `criteria` (`api/optimize.ts`, `OptimizeBody`) → không tối ưu được theo cả bộ test.
- **Shared App** (`sharedApps`, `chainAppService.ts`): người xem chạy bằng auth của chính họ, ở client. Không có kênh phản hồi nào về chủ app.
- `api/health-cron.ts` đã chạy suite `cronEnabled` hằng ngày bằng service account.

## Quyết định thiết kế (đề xuất)

1. **Health suite là trục chính** của cả hai tính năng. Không hợp nhất 3 hệ version cũ (rủi ro migrate cao, ngoài phạm vi). Suite có lịch sử revision RIÊNG, và mỗi run trỏ tới revision đã chạy.
2. **Người trong vòng lặp, không tự động hoàn toàn**: phản hồi KHÔNG tự thành test, Optimizer KHÔNG tự chạy, kết quả KHÔNG tự xuất bản. Lý do: chi phí gọi model, phản hồi rác/spam, và người dùng phải tin được thay đổi.
3. **Phản hồi chỉ từ người xem đã đăng nhập** (khớp với việc Shared App vốn đã yêu cầu auth để chạy) và phải tích đồng ý gửi input/output cho chủ app.

## Phần A — Prompt Git: revision gắn điểm (`src/utils/promptRevisions.ts`, thuần)

Kiểu mới trong `src/types.ts`:

```ts
export interface PromptRevision {
  id: string;            // 'rev_…'
  at: string;            // ISO
  content: string;       // prompt đầy đủ tại revision này
  hash: string;          // hash nội dung (djb2/FNV, thuần) — phát hiện trùng
  origin: 'manual' | 'optimizer' | 'source-sync' | 'restore';
  note?: string;
  parentId?: string;     // revision trước đó (dựng dòng thời gian)
}
```

Sửa kiểu cũ (tất cả trường mới đều TUỲ CHỌN → dữ liệu cũ vẫn hợp lệ):

```ts
HealthRun     += revisionId?: string
HealthSuite   += revisions?: PromptRevision[]   // mới nhất ở đầu, tối đa 20
              += headRevisionId?: string        // revision đang là "prompt hiện hành"
              += source?: { kind: 'template' | 'project' | 'sharedApp'; id: string; title?: string }
```

Hàm thuần (TDD):

```ts
hashPrompt(text): string
commitRevision(suite, content, origin, note?, now?): HealthSuite
  // trùng hash với head → trả nguyên suite; ngược lại đẩy revision mới, đặt head, cắt còn 20
  // KHÔNG xoá revision đang được run nào tham chiếu trong 10 run gần nhất (ưu tiên giữ)
scoreByRevision(suite): Array<{ revision; runs: HealthRun[]; bestScore; lastScore; deltaVsParent }>
bestRevision(suite, model?): PromptRevision | null   // điểm TB cao nhất, cùng model nếu truyền
diffRevisions(a, b): string                           // tái dùng computeUnifiedDiff
blameByTest(suite, revA, revB): Array<{ testId; scoreA; scoreB; delta }>  // test nào tụt/tăng
migrateSuite(suite): HealthSuite
  // suite cũ chưa có revisions → tạo 1 revision 'manual' từ suite.prompt, gán cho các run cũ? KHÔNG:
  // run cũ để revisionId trống, hiển thị nhãn "trước khi có lịch sử".
```

Luồng ghi:
- `healthService.runHealthCheck` (hoặc nơi gọi run hiện tại): trước khi chạy, `commitRevision(suite, suite.prompt, 'manual')`, rồi gắn `revisionId = headRevisionId` vào run mới.
- Sửa prompt trong HealthPanel KHÔNG tự tạo revision (tránh rác khi gõ) — revision chỉ sinh khi **chạy** hoặc bấm **"Lưu phiên bản"**.
- `api/health-cron.ts`: chạy theo `suite.prompt`, ghi `revisionId: suite.headRevisionId` nếu có (chỉ đọc, không tạo revision — cron tự chứa, giữ đơn giản).

"Blame theo khối" (theo block template / node graph) để **đợt sau**: đợt này blame theo TEST (test nào tụt khi đổi revision) — đủ để trả lời "thay đổi này làm hỏng cái gì".

### UI (`src/components/lab/health/RevisionTimeline.tsx`, mới; gắn vào `HealthPanel`)

- Dòng thời gian revision: nhãn origin, ghi chú, điểm TB lần chạy gần nhất, mũi tên delta so với revision cha, huy hiệu ★ cho `bestRevision`.
- Chọn 2 revision → diff văn bản + bảng `blameByTest`.
- Nút: "Đặt làm hiện hành" (`commitRevision(..., 'restore')`), "Chạy lại revision này".
- Nếu suite có `source`: nút "Đồng bộ từ nguồn" (kéo prompt mới nhất của template/project → revision `source-sync`) và "Áp dụng về nguồn" (ghi ngược head vào template/project qua đường lưu sẵn có — template thì đi qua `pushVersion` để lịch sử template cũng có bản cũ).

## Phần B — Flywheel: phản hồi từ Shared App

### B1. Collection mới `appFeedback` (Firestore)

```
appFeedback/{id}
  appId: string         // sharedApps id
  ownerId: string       // userId của app (chép lúc tạo, để query + rule)
  userId: string        // người gửi
  rating: 'up' | 'down'
  comment?: string      // ≤ 1000
  inputs: map<string,string>  // biến đã nhập, mỗi giá trị cắt ≤ 2000, tối đa 20 key
  output: string        // ≤ 8000 (cắt bớt ở client)
  revisionHash?: string // hash prompt app lúc chạy → biết phản hồi thuộc bản nào
  status: 'new' | 'converted' | 'dismissed'
  createdAt: timestamp
```

Rule:
- `create`: đã đăng nhập, `userId == auth.uid`, `ownerId == get(sharedApps/appId).userId`, `status == 'new'`, kiểm kích thước như trên, `createdAt == request.time`.
- `get/list`: chỉ `ownerId == auth.uid` (người gửi không đọc lại được — tránh lộ dữ liệu người khác).
- `update`: chỉ owner, chỉ đổi `status`.
- `delete`: owner.
- Chống spam: rule không đếm được tần suất → đợt này dựa vào bắt buộc đăng nhập + giới hạn kích thước + nút "Chặn người gửi" phía owner (lọc client). Nếu bị lạm dụng thật → chuyển ghi qua `api/` có rate-limit (đợt sau).

Bắt buộc `firebase deploy --only firestore:rules` sau khi merge (xem `DEPLOY.md`).

### B2. UI phía người xem (Shared App runner, `AppPanel` / trang app chia sẻ)

Sau khi có output: 👍 / 👎 + ô góp ý tuỳ chọn + checkbox "Cho phép chủ app xem input & output của lần chạy này" (BẮT BUỘC tích mới gửi). Gửi xong → toast, ẩn nút cho lần chạy đó. Chủ app tự chạy app của mình thì ẩn khối này.

### B3. Hộp phản hồi phía chủ app (`src/components/lab/health/FeedbackInbox.tsx`)

- Mở từ HealthPanel khi suite có `source.kind === 'sharedApp'`, hoặc từ danh sách app đã chia sẻ.
- Lọc theo 👎 / mới / revision. Mỗi mục: input, output, góp ý.
- **"Biến thành test"** → hàm thuần `feedbackToTest(fb, suite): HealthTest`:
  - `input` = các biến render thành văn bản `ten_bien: giá trị` (cùng định dạng app dùng khi chạy).
  - `criteria` = góp ý của người dùng (nếu có) + tiêu chí mặc định của suite; owner sửa được trước khi lưu.
  - Nút phụ "AI gợi ý tiêu chí" (một lời gọi `aiService`, có fallback) — tuỳ chọn, không bắt buộc.
  - Đánh dấu `status: 'converted'`. Chặn vượt giới hạn 50 test/suite của rule hiện có.
- "Bỏ qua" → `dismissed`.

Liên kết app ↔ suite: nút "Tạo suite kiểm thử cho app này" trong danh sách app đã chia sẻ → suite mới với `source = { kind: 'sharedApp', id: appId }`, `prompt` = prompt compile của app.

## Phần C — Optimizer theo cả bộ test

### C1. `api/optimize.ts`

Mở rộng `OptimizeBody` (tương thích ngược — `testInput` cũ vẫn chạy):

```ts
tests?: Array<{ input: string; criteria?: string[] }>   // tối đa 5, mỗi input ≤ 50k
```

- Có `tests` → điểm của một ứng viên = trung bình điểm trên các test (criteria test gộp với `criteria` chung).
- Chi phí tăng tuyến tính theo số test: giữ `populationN ≤ 5`, `rounds ≤ 3`, và **giảm trần mặc định**: nếu `tests.length > 2` thì `populationN` mặc định 2, `rounds` mặc định 1. Ghi ước tính số lời gọi model trong phản hồi để UI hiển thị.
- `maxDuration` hiện tại phải đủ: ước lượng 5 test × (2 ứng viên + baseline) × 2 lời gọi (chạy + chấm) ≈ 30 lời gọi/vòng. Nếu vượt 60s → chọn 3 test trượt nặng nhất (client chọn, xem C2).

### C2. Gợi ý từ HealthPanel

- Hàm thuần `pickFailingTests(suite, revisionId, threshold = 70, max = 5)`: test có điểm < ngưỡng ở run gần nhất của revision, sắp theo điểm tăng dần.
- Khi ≥ 2 test trượt → banner "Có N test trượt — Tối ưu prompt theo các test này?" → mở Optimizer với `basePrompt = head`, `tests = pickFailingTests(...)`.
- Kết quả Optimizer → nút **"Lưu thành revision"** (`origin: 'optimizer'`, note = điểm trước/sau) → tự chạy Health trên TOÀN suite (không chỉ test trượt) để bắt hồi quy ở test đang đạt.
- Chỉ khi revision mới có điểm TB ≥ head cũ VÀ không test nào tụt > 15 điểm → hiện nút "Đặt làm hiện hành & xuất bản lại app" (gọi `publishApp` với prompt mới). Ngược lại hiện cảnh báo kèm `blameByTest`.

Ghi chú: Optimizer hiện trả `bestPrompt` dạng chuỗi; Shared App v3 lưu cả graph. "Xuất bản lại" với prompt chuỗi → cần quyết định (xem Câu hỏi mở #2).

## Phần D — Test & CI

Thuần (vitest, `src/__tests__/`):
- `promptRevisions`: hash ổn định; commit trùng hash bỏ qua; cắt 20 nhưng giữ revision đang được run tham chiếu; `scoreByRevision`/`bestRevision` theo model; `blameByTest` delta đúng; `migrateSuite` không đụng run cũ.
- `feedbackToTest`: render biến, gộp criteria, cắt độ dài.
- `pickFailingTests`: ngưỡng, sắp xếp, giới hạn.
- `api/optimize.ts`: tách hàm chấm trung bình đa-test thành hàm nội bộ thuần trong file (function tự chứa — không import helper) và type-check bằng lệnh tsc riêng cho `api/`.
- Rule `appFeedback`: test bằng emulator nếu repo đã có; nếu chưa, kiểm thủ công theo checklist trong PR.

CI 4 bước xanh; không phá test cũ.

## Chia đợt

1. **Đợt 1 — Prompt Git trong Health** (Phần A): giá trị độc lập, không cần collection mới, không đổi rule ngoài trường tuỳ chọn. Kiểm `isValidHealthSuite` vẫn chấp nhận (`runs ≤ 50` — revisions là trường mới, cần thêm giới hạn `revisions is list && size() <= 20` + kích thước doc Firestore 1 MiB: 20 revision × 50k ký tự có thể vượt → xem Câu hỏi mở #3).
2. **Đợt 2 — Optimizer đa test + banner gợi ý** (Phần C, trừ "xuất bản lại").
3. **Đợt 3 — Phản hồi Shared App** (Phần B + nút xuất bản lại ở C2). Cần deploy rules.

## Ngoài phạm vi

Hợp nhất 3 hệ version cũ; blame theo khối/node; tự động hoá hoàn toàn (auto-convert, auto-optimize, auto-publish); A/B traffic thật giữa 2 revision trên Shared App; phản hồi ẩn danh; dashboard tổng hợp nhiều app.

## Câu hỏi mở — ĐÃ CHỐT theo đề xuất (đăng nhập · (b) · lưu trong doc tối đa 20/cắt 10 · ngưỡng cố định 70/15)

1. **Phản hồi có cần đăng nhập?** Đề xuất: có (đơn giản, chống spam, khớp cách Shared App chạy). Ẩn danh sẽ phải ghi qua `api/` có rate-limit.
2. **Xuất bản lại app khi prompt đã tối ưu là chuỗi phẳng**: (a) thay graph của app bằng 1 node text chứa prompt mới — đơn giản nhưng mất cấu trúc graph; (b) chỉ cho "Áp dụng về nguồn" dạng revision và để chủ app tự sửa graph — an toàn hơn. Đề xuất (b) ở đợt 3, (a) để sau.
3. **Giới hạn kích thước doc Firestore**: lưu `revisions` trong doc suite (đơn giản, có thể chạm 1 MiB với prompt dài) hay subcollection `healthSuites/{id}/revisions` (an toàn, thêm rule + lượt đọc)? Đề xuất: trong doc, tối đa 20, và cắt còn 10 nếu tổng nội dung > 400k ký tự.
4. **Ngưỡng "trượt"** mặc định 70/100 và "tụt" 15 điểm — chấp nhận hay để chủ suite chỉnh?

## Ghi chú triển khai Đợt 1 (khác/thu hẹp so với Phần A)

- **Revision sinh khi "Chạy kiểm tra" hoặc bấm "Lưu"** (không có nút "Lưu phiên bản" riêng): cron chạy theo prompt
  ĐÃ LƯU và gắn `headRevisionId`, nên Lưu phải ghi revision để run cron không bị gắn nhầm bản.
- Commit nội dung trùng một revision CŨ → không nhân bản, chỉ chuyển head về bản đó.
- **Nguồn chỉ hỗ trợ template** (`source.kind = 'template'`): chọn template → lấy `blocksToText(blocks)` thành
  revision `source-sync`; "Đồng bộ từ nguồn" kéo bản mới nhất. Project/sharedApp để Đợt 3.
- **"Áp dụng về nguồn" = "Mở trong Builder"** (bọc prompt bằng `promptToTemplate`) để người dùng tự lưu — KHÔNG ghi
  đè thẳng blocks template bằng văn bản phẳng (mất cấu trúc), nhất quán với quyết định (b).
- Điểm trên dòng thời gian lọc theo model hiện tại của suite.
- Rules: thêm kiểm `revisions ≤ 20`, `headRevisionId`, `source` vào `isValidHealthSuite` → cần
  `firebase deploy --only firestore:rules`. (Rule cũ không dùng `hasOnly` nên trước khi deploy vẫn ghi được.)

## Ghi chú triển khai Đợt 2

- `api/optimize.ts` nhận `tests` (≤ 5); hàm thuần `normalizeTests`/`combineEvals`/`estimateCalls` export từ chính file
  (vẫn tự chứa) và có test `src/__tests__/optimizeMultiTest.test.ts`. Nhiều hơn 2 test → quần thể 2–3 (mặc định 2),
  1–2 vòng (mặc định 1). Biến thể nhắm vào hợp tiêu chí của mọi test; output/feedback lấy từ test yếu nhất.
- Optimizer chạy **ngay trong Prompt Health** (banner `OptimizeSuggestion`), không chuyển sang panel Auto-Optimizer.
  Tối ưu trên nội dung **revision hiện hành** (không phải chỗ đang sửa dở).
- "Lưu thành phiên bản" → revision `optimizer` thành hiện hành NGAY, chạy lại toàn suite, rồi `judgeRevision` so với
  bản trước: đạt → báo xanh; chưa đạt → liệt kê test tụt + nút "Quay lại bản trước" (thay cho "Đặt làm hiện hành"
  có điều kiện trong Phần C2 — kết quả tương đương, ít bước hơn). Xuất bản lại Shared App để Đợt 3.
- Lưu ý: Optimizer chấm bằng chuỗi model của backend, Health chấm bằng model của suite → điểm hai bên không so
  trực tiếp được; quyết định cuối luôn dựa trên lần chạy lại Health.
