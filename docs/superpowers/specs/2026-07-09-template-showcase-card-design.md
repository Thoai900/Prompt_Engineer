# Thiết kế: Template Showcase — card "bán được giá trị"

Ngày: 2026-07-09
Trạng thái: đã duyệt hướng, chờ viết plan

## Bối cảnh & Mục tiêu

Sau 3 đợt nâng cấp thư viện (khám phá+trung thực · bộ sưu tập · cộng đồng thật), card
template ([PromptCard.tsx](../../../src/components/common/PromptCard.tsx)) đã giàu thông tin
nhưng **chưa "bán" được giá trị**: header 160px hiện thumbnail **cách điệu/giả** (thanh màu,
code giả), không cho thấy thành phẩm thật; mô tả thiên kỹ thuật thay vì lợi ích.

Mục tiêu: người dùng nhìn card là **muốn thử ngay**, qua 2 đòn bẩy đã chốt:
1. **Kết quả THẬT (before→after)** — hiện input mẫu → output đại diện thật, thay thumbnail giả.
2. **Câu chốt lợi ích (hook)** — 1 dòng outcome ngắn thay/bổ trợ mô tả kỹ thuật.

## Quyết định đã chốt

- **Nguồn nội dung**: AI (trong phiên làm việc) sinh input mẫu + output + hook cho từng
  template built-in → người dùng **duyệt theo lô** → **bake tĩnh**. Không script/API runtime.
- **Nơi lưu**: file companion `src/data/templateShowcase.ts` (tách khỏi định nghĩa lõi).
- **Hướng card**: Phương án A — **trước → sau** (hiện cả input lẫn output), hook là dòng phụ.
- **Degrade**: chưa có showcase → chỉ hook (từ `description`) + cấu trúc + "kết quả mẫu sẽ
  bổ sung sau"; **không bao giờ mock giả** (giữ tinh thần trung thực Đợt 1).

## Phần A — Mô hình dữ liệu

### File `src/data/templateShowcase.ts`
```ts
export interface TemplateShowcase {
  hook: string;              // ≤ ~12 từ, thiên outcome, sentence case, không "unlock/seamless"
  input: string;            // ví dụ người dùng điền (đã thay {{biến}})
  output: string;           // kết quả AI ĐẠI DIỆN ("kết quả mẫu")
  outputType?: 'text' | 'code' | 'ui' | 'video' | 'mindmap' | 'tutor';
}
export const TEMPLATE_SHOWCASE: Record<string, TemplateShowcase> = { /* id → showcase */ };
```

### Helper thuần `getShowcase(template)` (unit-test được, đặt TRONG `templateShowcase.ts` — co-located với dữ liệu)
Trả về `{ hook?, input?, output?, outputType, hasResult }` theo thứ tự ưu tiên:
- `hook`  = `TEMPLATE_SHOWCASE[id].hook` (nếu không có → `undefined`; card degrade sẽ dùng `description`).
- `input` = `showcase.input` ?? `template.outputExample?.input`.
- `output`= `showcase.output` ?? `template.outputExample?.content`.
- `outputType` = `showcase.outputType` ?? `template.outputExample?.type` ?? `'text'`.
- `hasResult` = `!!(input || output)`.

Community/của-tôi chưa có showcase → tự động degrade (sinh cho chúng để sau, có thể on-demand).

## Phần B — Quy trình sinh & duyệt

1. Với mỗi template built-in: đọc `blocks` → tạo **input mẫu thực tế** (điền biến hợp lý),
   **output đại diện** (đúng domain/kiểu: kịch bản, code, mindmap, hội thoại gia sư…),
   **hook ≤12 từ** (outcome, sentence case).
2. Trình theo lô ~6–8 template dưới dạng bảng để người dùng **duyệt/sửa** trước khi ghi file.
3. Ghi vào `TEMPLATE_SHOWCASE`. Ưu tiên các template có `outputExample` sẵn + template hay xem.
4. Trung thực: card gắn nhãn **"Kết quả mẫu"** — đại diện, không phải cam kết.

## Phần C — Card UI (Phương án A)

Thay **header 160px thumbnail giả** bằng khối **trước → sau** khi có showcase.

**Khi CÓ kết quả (`hasResult`):**
- Hàng tác giả (avatar + tên + verified) · pill category — *giữ nguyên*.
- Tiêu đề (`line-clamp-1`) — *giữ*.
- **Hook** (mới): dòng accent + icon mục tiêu; ẩn nếu không có hook.
- **Khối trước→sau** (mới):
  - Nhãn "Bạn nhập" + ô input (`input`, ~1–2 dòng).
  - Mũi tên xuống.
  - Nhãn "Kết quả mẫu" + ô output (`output`, ~3–4 dòng, style theo `outputType`: mono cho code).
  - Bấm vào → mở `ExamplePreviewModal` với input+output ĐẦY ĐỦ.
- Tags (ít) + **badge framework gọn** (vd "Khung R-T-F") thay stepper lớn (stepper rời để ở modal).
- Footer: social (lượt dùng/thích) · lưu/bộ sưu tập/share · nút Remix — *giữ*.

**Khi KHÔNG có kết quả (degrade):**
- Như card hiện tại: hook-từ-`description` / stepper framework / tags; thêm dòng mờ
  "Kết quả mẫu sẽ bổ sung sau". Không mock giả.

Giữ `min-height` nhất quán để grid thẳng hàng.

## Thay đổi mã dự kiến

- **Mới**: `src/data/templateShowcase.ts` (dữ liệu + `getShowcase`).
- **Sửa**: `PromptCard.tsx` (bỏ thumbnail cách điệu; thêm hook + khối trước→sau + badge framework;
  nhánh degrade). `ExamplePreviewModal.tsx` (đọc showcase để hiện input+output thật).
- **Test**: `getShowcase` (ưu tiên/fallback) trong `src/__tests__/`; giữ test PromptCard/LibraryTab
  (bảo toàn tiêu đề nút "Remix", title "Lưu vào bộ sưu tập của bạn", class `.grid.pb-20`).

## Phạm vi

- **Trong phạm vi**: showcase cho template built-in + UI card Phương án A + degrade + preview modal.
- **Ngoài phạm vi (sau)**: sinh showcase cho template cộng đồng/của-tôi (on-demand hoặc script
  độc lập gọi Gemini/Groq — cần env key); rating/review (rules chặn `averageRating`, việc riêng).

## Rủi ro / lưu ý

- Output do AI sinh là **mẫu đại diện**, gắn nhãn rõ để không hiểu nhầm là cam kết.
- Chi phí: nội dung sinh trong phiên → tốn công duyệt; chấp nhận cho ~32 built-in.
- Không phá test hiện có: PromptCard vẫn phải giữ các điểm neo test (nút Remix, title lưu, grid).
