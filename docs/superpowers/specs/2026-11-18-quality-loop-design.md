# Thiết kế: Vòng chất lượng Viết → Đo → Tối ưu → Lưu

Ngày: 2026-11-18
Trạng thái: đã duyệt (theo cả 3 đề xuất ở "Cần chốt"), đã build

## Vấn đề

Các mảnh của vòng chất lượng đã có nhưng **không nối với nhau**:

| Mảnh | Có sẵn | Thiếu |
|---|---|---|
| Viết | Studio / Builder / Graph → `PromptTemplate` (lưu Firestore `templates`) | — |
| Lịch sử | Template: `versions` (H2, tối đa 10, `templateVersionUtils.ts`, hiện trong `PromptDetailModal`). Graph: `VersionDrawer` | — |
| Đo | Prompt Health: `HealthSuite { prompt, testCases, runs }`, so sánh lần chạy bằng `compareRuns`, chạy hằng ngày qua `api/health-cron.ts` | Suite **không biết** nó đo template nào. Test case phải gõ tay. |
| Soi | Prompt Inspector (linter + "So tài model" / "Tối ưu" sang Lab qua `sendToLab`) | — |
| Tối ưu | Auto-Optimizer → `bestPrompt` (chuỗi phẳng) | Nút "Lưu" tạo một template **mới** (`promptToTemplate`, id mới, 1 block), không thành phiên bản của prompt gốc. Không quay lại Health để xác nhận. |

Kết quả là người dùng tối ưu xong thì có hai template rời nhau, và không có bằng chứng bản mới tốt hơn trên chính bộ test của mình.

## Mục tiêu

Một vòng khép kín, bắt đầu và kết thúc ở **cùng một template**:

```
Template ──"Tạo bộ test"──▶ Health suite (gắn templateId)
   ▲                           │ chạy → điểm thấp
   │                           ▼
   └─"Lưu thành phiên bản"── Auto-Optimizer (mồi prompt + test + tiêu chí)
         + chạy lại Health → so điểm trước/sau
```

Tiêu chí thành công: từ một template đã lưu, người dùng đi hết vòng mà không phải copy/paste lần nào. Kết thúc vòng có bản mới nằm trong `versions` của template gốc, kèm điểm Health trước/sau.

## Không làm (ngoài phạm vi)

- Lịch sử phiên bản cho bản nháp Studio chưa lưu, hoặc cho Builder chưa lưu. Vòng chỉ áp cho template đã lưu.
- Tự động tối ưu khi cron Health báo đỏ. Có thể làm sau, khi vòng thủ công đã ổn.
- Vòng cho Prompt Graph. Graph có hệ phiên bản riêng; nối vào sau, dùng cùng các mảnh ở đây.

## Thiết kế

### A. Liên kết dữ liệu

- `HealthSuite` thêm `templateId?: string` (optional, tương thích ngược).
- `healthService.saveHealthSuite` liệt kê từng trường khi ghi (object `base`), nên phải thêm `templateId` vào đó. Nếu không, trường này bị bỏ khi lưu lên Firestore.
- `firestore.rules` → `isValidHealthSuite` thêm điều kiện `templateId` là string và không quá 128 ký tự, rồi `firebase deploy --only firestore:rules`. Rules hiện không dùng `hasOnly`, nên trước khi deploy trường mới vẫn được ghi, chỉ là chưa được kiểm tra.
- Một template có thể có nhiều suite. UI hiển thị suite mới nhất trước.
- `LabSeed` (`src/services/labSeed.ts`) mở rộng thành:

```ts
{ mode, prompt, templateId?, testInputs?: string[], criteria?: string[] }
```

### B. Bước 1 — "Tạo bộ test" từ template

- **Lối vào:** `PromptDetailModal` (template của tôi), `StepFinish` của Studio sau khi lưu, và Prompt Inspector khi đang soi một template đã lưu.
- **AI sinh test:** hàm mới `draftHealthTests(prompt): Promise<HealthTest[]>` trong `aiService.ts`. Hàm trả JSON gồm 3–5 test, mỗi test có `input` và 2–3 `criteria`, có fallback Gemini→Groq như các hàm khác.
- **Duyệt trước khi tạo:** người dùng xem, sửa, xoá từng test. Tạo xong suite có `prompt` lấy từ template (dùng `blocksToText`), `templateId`, rồi mở Lab › Prompt Health ở đúng suite đó.
- Hàm thuần `normalizeDraftTests(raw)` (lọc test rỗng, cắt tối đa 10, sinh id) đặt ở `src/utils/healthUtils.ts` và có test.

### C. Bước 2 — Health báo yếu → "Tối ưu với bộ test này"

- Trong HealthPanel, sau một lần chạy có `avgScore` dưới ngưỡng (mặc định 70) hoặc có test dưới 60, hiện nút **"Tối ưu với bộ test này"**.
- Nút gọi `sendToLab` với mode `optimizer`:
  - `prompt` = prompt của suite
  - `templateId` = templateId của suite
  - `testInputs` = input của các test điểm thấp nhất (tối đa 3)
  - `criteria` = hợp nhất criteria của các test đó (bỏ trùng)
- Hàm thuần `pickOptimizerSeedFromRun(suite, run)` đặt ở `healthUtils.ts` và có test.
- Auto-Optimizer nhận seed và điền sẵn prompt, đầu vào thử, tiêu chí. Hiện tại `OptimizerPanel` chỉ nhận `initialPrompt` → mở rộng để nhận cả seed. Backend `api/optimize.ts` hiện nhận **một** đầu vào thử, xem Cần chốt #2.

### D. Bước 3 — "Lưu thành phiên bản mới" và chạy lại Health

Kết quả Optimizer có `templateId` (đến từ vòng) thì đổi các nút kết quả thành:

1. **Xem khác biệt.** Diff giữa prompt gốc và `bestPrompt` bằng `blocksToText`. Có thể tái dùng component diff của `VersionDrawer` hoặc `PromptDetailModal` nếu tách ra được.
2. **Lưu thành phiên bản mới.** Đặt prompt tối ưu vào template gốc (cùng id) rồi gọi `handleSaveTemplate`. Snapshot bản cũ vào `versions` là việc H2 vốn đã làm.
   - Vấn đề: template gốc có nhiều block, còn `bestPrompt` là chuỗi phẳng. Đề xuất: gọi `enhancePromptWithAi` để **chia lại thành block** theo đúng loại block cũ. Thất bại thì gộp thành 1 block `task` và báo cho người dùng. Xem Cần chốt #1.
3. **Chạy lại Health.** Sau khi lưu: cập nhật `suite.prompt`, chạy `runHealthCheck`, hiện điểm trước/sau bằng `compareRuns`. Nếu điểm **giảm** thì hiện nút "Khôi phục phiên bản trước" (đưa `versions[0]` trở lại).

Không có `templateId` (người dùng dán prompt tay vào Optimizer) thì giữ nguyên hành vi hiện tại: lưu thành template mới.

### E. Hiển thị trạng thái vòng

- `PromptDetailModal` của template thêm dòng "Sức khoẻ": điểm của lần chạy Health gần nhất và số phiên bản. Bấm vào thì mở suite.
- Không thêm màn hình mới. Mọi bước dùng màn hình sẵn có (Lab, modal chi tiết).

## Thứ tự làm (mỗi bước merge được, CI xanh)

1. **Liên kết dữ liệu** (mục A): `templateId` vào type, `healthService` và rules; mở rộng `LabSeed`, có test → verify: suite cũ không có `templateId` vẫn nạp được; rules deploy được.
2. **Tạo bộ test** (mục B) → verify: test `normalizeDraftTests`; trình duyệt: template → tạo suite có 3–5 test → mở đúng suite trong Lab.
3. **Health → Optimizer** (mục C) → verify: test `pickOptimizerSeedFromRun`; Optimizer mở ra đã điền đủ 3 ô.
4. **Lưu phiên bản và chạy lại** (mục D) → verify: template gốc có thêm 1 mục trong `versions`, id không đổi; điểm trước/sau hiện ra; nút khôi phục chạy được.
5. **Trạng thái trong modal** (mục E).

## Kiểm thử

- Unit: `healthUtils.test.ts` (`normalizeDraftTests`, `pickOptimizerSeedFromRun`: chọn test điểm thấp, bỏ trùng criteria, suite chưa chạy lần nào), `labSeed` (parse seed mở rộng, seed cũ chỉ có prompt vẫn đọc được).
- Rules: suite có `templateId` hợp lệ hoặc quá dài (nếu repo có emulator test; không có thì kiểm tra thủ công sau deploy).
- Thủ công: đi hết vòng trên một template mẫu, cả khi đăng nhập lẫn khi Optimizer báo lỗi (chưa đăng nhập, backend lỗi).

## Rủi ro

- **Chi phí AI.** Một vòng gồm sinh test, chạy Health (N test × chấm điểm), Optimizer (nhiều vòng) rồi chạy lại Health. Cách xử lý: hiện ước tính số lượt gọi trước khi chạy lại Health; giữ giới hạn 10 test mỗi suite.
- **Chia lại block không trung thực** (AI thêm hoặc bớt ý). Cách xử lý: luôn qua bước "Xem khác biệt" trước khi lưu, không bao giờ tự lưu.
- **Quên thêm `templateId` vào `base`** của `saveHealthSuite` thì liên kết mất âm thầm sau lần tải lại. Cách xử lý: có test cho dữ liệu ghi đi (tách hàm thuần dựng `base`), và kiểm tra thủ công bằng cách tải lại trang.

## Đã chốt

1. Lưu bản tối ưu vào template nhiều khối: **AI chia lại khối, giữ nguyên câu chữ** (`splitPromptIntoBlocks`), bắt buộc qua bước xem khác biệt. AI lỗi hoặc không chia được thì gộp thành 1 khối `task` và báo cho người dùng.
2. Optimizer dùng **một** đầu vào thử (của test điểm thấp nhất); chưa sửa `api/optimize.ts`.
3. Nút "Tối ưu với bộ test này" hiện khi điểm trung bình dưới 70 **hoặc** có test dưới 60.

## Ghi chú khi build

- Duyệt test do AI soạn diễn ra ngay trong danh sách test của HealthPanel (sửa/xoá rồi mới Lưu hoặc Chạy), không làm modal riêng.
- Bước E đặt thành dải "Sức khoẻ prompt" trong `PromptDetailModal`, chỉ hiện với template của tôi; Studio có thêm nút "Kiểm thử chất lượng" sau khi lưu.
- `customTemplates` trong App gộp cả template công khai của người khác, nên Lab chỉ nhận các template có `userId` là của mình.
