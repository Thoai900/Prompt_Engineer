# Thiết kế: Hệ thống animation "kể chuyện theo bước" cho các luồng sinh nội dung AI

- **Ngày:** 2026-06-26
- **Trạng thái:** Đã duyệt thiết kế, chờ lập kế hoạch thực thi
- **Phạm vi:** Builder + các tab dùng AI, **trừ** loader trang chủ (HomeTab)

## 1. Bối cảnh & Vấn đề

Các luồng sinh nội dung bằng AI hiện tại chỉ hiển thị spinner + "Đang..." rời rạc, đơn điệu:

- **Per-block AI assist / Doctor fix** (`PromptBlockCard`): viền tím + pulse + badge "Đang viết...".
- **Hoàn thiện AI / Quick fill** (`QuickPromptModal`): spinner.
- **Điền nhanh biến số** (`BuilderTab`): nút "Đang điền..." + spinner.
- **Giả lập AI** (`PlaygroundPanel`): "Đang suy nghĩ..." + spinner.
- **AI Enhancer**, **Project Chain (giả lập/đánh giá)**, **AI Future (sinh tin)**: spinner/loader đơn giản.

Mục tiêu: một hệ thống animation **nhất quán nhưng tùy biến theo từng mục đích**, dạng "kể chuyện theo bước" (step narration), để người dùng hiểu AI đang làm gì và không cảm thấy nhàm chán khi chờ.

Loader 5 bước ở trang chủ (`HomeTab`) **giữ nguyên**, không nằm trong phạm vi.

## 2. Định hướng đã chốt

- **Phong cách:** Kể chuyện theo bước — mỗi luồng hiện một chuỗi bước có tường thuật, thiết kế đẹp, mỗi mục đích có nội dung/icon/màu riêng.
- **Kiến trúc:** Hướng A mở rộng C — một component trình bày dùng chung + một hook timing + một registry kịch bản, có prop `placement` để dùng được ở nhiều vị trí.
- **Cơ chế timing:** Narrator chạy theo nhịp thời gian cho pha "đang xử lý". Với luồng có streaming sẵn (per-block AI), narrator lấp khoảng trống tới khi chunk đầu về rồi nhường cho text chạy thật. Với luồng JSON (quick fill, điền biến, enhancer, đánh giá), narrator chạy tới khi promise xong + 1 nhịp "hoàn tất".

## 3. Kiến trúc

```
src/utils/generationNarratives.ts        ← registry kịch bản (data thuần)
src/hooks/useStepNarration.ts             ← hook timing (đếm bước, reduced-motion, done-beat)
src/components/common/StepNarrator.tsx    ← component trình bày (3 placement)
src/index.css                             ← keyframes dùng chung (shimmer, orb pulse)
```

State cục bộ mỗi luồng — tái dùng các boolean sẵn có (`isGenerating`, `isAutoFilling`, `isGeneratingQuickPrompt`, `isChatGenerating`, ...). **Không** cần global state.

### 3.1 Registry kịch bản — `src/utils/generationNarratives.ts`

```ts
import type { LucideIcon } from 'lucide-react';

export type GenerationFlowKey =
  | 'block-assist' | 'doctor-fix' | 'quick-fill' | 'variable-fill'
  | 'playground-sim' | 'enhancer' | 'chain-sim' | 'ai-news';

export type NarrativeAccent = 'violet' | 'emerald' | 'cyan' | 'blue' | 'indigo' | 'amber' | 'rose' | 'teal';

export interface NarrationStep {
  icon: LucideIcon;
  label: string;
  hint?: string;
  durationMs?: number; // mặc định ~1500
}

export interface NarrativeScript {
  accent: NarrativeAccent;
  steps: NarrationStep[];
}

export const GENERATION_NARRATIVES: Record<GenerationFlowKey, NarrativeScript>;
```

Lời thoại / icon / accent mỗi luồng (bản nháp, có thể tinh chỉnh khi code):

| FlowKey | Accent | Các bước (ví dụ) |
|---|---|---|
| `block-assist` | violet | Đọc ngữ cảnh các khối → Soạn nội dung → Tinh chỉnh câu chữ |
| `doctor-fix` | rose | Chẩn đoán khối thiếu → Kê đơn nội dung → Hoàn thiện |
| `quick-fill` | violet | Phân tích chủ đề → Phân bổ vào từng khối → Đồng bộ hóa |
| `variable-fill` | emerald | Đọc hồ sơ → Suy luận giá trị → Điền biến |
| `playground-sim` | indigo | Nạp System Prompt → Nhập vai → Soạn phản hồi |
| `enhancer` | teal | Mổ xẻ prompt thô → Tái cấu trúc khối → Nâng cấp |
| `chain-sim` | cyan | Gom ngữ cảnh chuỗi → Chạy node → Tổng hợp |
| `ai-news` | blue | Quét xu hướng → Lọc tin nóng → Biên tập |

Accent ánh xạ sang class Tailwind tĩnh (an toàn với JIT — không nội suy chuỗi class động): một bảng `ACCENT_CLASSES: Record<NarrativeAccent, { text; bg; border; bar }>`.

### 3.2 Hook timing — `src/hooks/useStepNarration.ts`

```ts
interface UseStepNarrationOpts { streamStarted?: boolean }
interface StepNarrationState {
  stepIndex: number;
  step: NarrationStep | null;
  progress: number;     // 0..1 ước lượng theo bước
  isComplete: boolean;  // true trong nhịp "done"
  reducedMotion: boolean;
}
function useStepNarration(
  script: NarrativeScript,
  isActive: boolean,
  opts?: UseStepNarrationOpts
): StepNarrationState;
```

Hành vi:

- Khi `isActive` bật: bắt đầu từ bước 0, tăng `stepIndex` theo `durationMs` của từng bước (fallback ~1500ms).
- Tới bước cuối mà vẫn `isActive`: **giữ bước cuối + pulse nhẹ** (không nhảy quá cuối mảng, không "đứng hình").
- `opts.streamStarted === true`: coi như pha "đang xử lý" kết thúc — consumer dùng tín hiệu này để ẩn narrator nhường cho text stream.
- `isActive` chuyển `false`: phát 1 nhịp `isComplete=true` ngắn (~700ms) rồi về idle (`step=null`).
- `reducedMotion`: đọc `window.matchMedia('(prefers-reduced-motion: reduce)')`. Khi bật, vẫn đổi nhãn bước nhưng consumer tắt các hiệu ứng nặng (sweep/particle/orb spin).
- Dọn dẹp toàn bộ timer khi unmount / khi `isActive` đổi.

### 3.3 Component trình bày — `src/components/common/StepNarrator.tsx`

```ts
interface StepNarratorProps {
  flowKey: GenerationFlowKey;
  isActive: boolean;
  placement: 'overlay' | 'inline' | 'compact';
  streamStarted?: boolean;
  className?: string;
}
```

- Tự tra `GENERATION_NARRATIVES[flowKey]`, gọi `useStepNarration`, render theo `placement`:
  - **`overlay`**: thẻ đầy đủ — orb icon (xoay/pulse), nhãn bước đổi mượt qua `AnimatePresence`, thanh progress theo accent, danh sách bước kế tiếp mờ phía dưới. Dùng cho modal Quick fill, Enhancer, Project Chain, AI Future.
  - **`inline`**: dải mảnh (icon + nhãn + shimmer line) — per-block AI khi chờ chunk đầu; Giả lập AI thay "Đang suy nghĩ...".
  - **`compact`**: siêu nhỏ (icon + nhãn xoay) — thay nhãn nút "Điền nhanh AI".
- Khi `!isActive && !isComplete` → render `null` (qua `AnimatePresence` để có exit).
- Dựng bằng `motion/react` (đã có trong dự án). Màu lấy từ `ACCENT_CLASSES[script.accent]`.

### 3.4 Keyframes dùng chung — `src/index.css`

Bổ sung (nếu chưa có): `shimmer-sweep` (dải sáng quét ngang), `orb-breathe` (phóng/thu nhẹ). Tái dùng `animate-fade-in`, `animate-pulse` sẵn có. Giữ tối thiểu.

## 4. Điểm tích hợp (wiring)

| Vị trí | File | Cách dùng |
|---|---|---|
| Per-block AI assist / Doctor fix | `PromptBlockCard.tsx` | `isGenerating && !block.content` → `inline`, `flowKey='block-assist'` (hoặc `doctor-fix`); có chunk đầu (`block.content` ≠ rỗng) → `streamStarted`, ẩn narrator, text stream tiếp. Cần truyền flowKey/biến phân biệt doctor-fix nếu muốn tách màu. |
| Hoàn thiện AI (Quick fill) | `QuickPromptModal.tsx` | `overlay`, `flowKey='quick-fill'`, `isActive=isGeneratingQuickPrompt`. |
| Điền nhanh biến số | `BuilderTab.tsx` (panel biến) | `compact`, `flowKey='variable-fill'`, `isActive=isAutoFilling` (thay nhãn nút). |
| Giả lập AI | `PlaygroundPanel.tsx` | `inline`, `flowKey='playground-sim'`, kích hoạt khi message assistant cuối có `content === ''`. |
| AI Enhancer | `EnhancerTab.tsx` | `overlay`, `flowKey='enhancer'`, theo boolean generating sẵn có. |
| Project Chain (giả lập/đánh giá) | `SimulatorPanel.tsx` (+ nơi đánh giá) | `overlay`, `flowKey='chain-sim'`. |
| AI Future (sinh tin) | `AIFutureTab.tsx` | `overlay`, `flowKey='ai-news'`. |

Ghi chú per-block (quyết định rõ ràng): KHÔNG suy ra `streamStarted` từ `block.content` (vì khối có thể đã có nội dung cũ trước khi chạy → nhập nhằng). Thay vào đó, trong `handleAiAssist`/`handleDoctorFix` (`BuilderTab.tsx`) đặt một cờ per-block khi **chunk đầu tiên** về: thêm state `streamedBlocks: Record<string, boolean>`, set `true` trong callback `onChunk` lần đầu, reset khi bắt đầu/khi kết thúc. Truyền `streamedBlocks[block.id]` xuống `PromptBlockCard` làm `streamStarted`. Đây là tín hiệu xác định, không phụ thuộc nội dung sẵn có.

## 5. Luồng dữ liệu

- Hoàn toàn cục bộ theo component. Hook nhận `script` + `isActive` (+ `streamStarted`) và tự quản timer nội bộ.
- Không thêm context/store. Không gọi API mới. Không đổi chữ ký các service AI.

## 6. Phạm vi / YAGNI

- **Không** đụng loader trang chủ (`HomeTab`).
- Không âm thanh, không 3D, không particle nặng.
- Narration là trang trí theo nhịp thời gian (API không cung cấp tiến độ thật) — chấp nhận được, không cố parse pha thật của model.
- Không refactor ngoài phạm vi; chỉ chèn `<StepNarrator>` và thay thế các loader cũ tại điểm tích hợp.

## 7. Xử lý lỗi & trường hợp biên

- Luồng AI lỗi (promise reject): `isActive` về false → narrator phát nhịp done rồi ẩn; thông báo lỗi do luồng hiện hữu xử lý (giữ nguyên). Narrator không nuốt lỗi.
- Tác vụ xong rất nhanh (< 1 bước): vẫn hiện thoáng bước 0 rồi nhịp done; chấp nhận.
- `prefers-reduced-motion`: nhãn tĩnh, tắt hiệu ứng nặng.
- Unmount giữa chừng (đổi tab, đóng modal): hook dọn timer, không leak.

## 8. Kiểm thử

- **Unit test** `useStepNarration` (vitest, đã có hạ tầng — xem `src/__tests__/usePromptBlocks.test.ts`):
  - Tăng bước theo thời gian (dùng fake timers).
  - Giữ bước cuối khi vượt số bước mà vẫn active.
  - `streamStarted` báo đúng trạng thái.
  - `isActive` false → có nhịp `isComplete` rồi idle.
  - reduced-motion được phản ánh trong state.
- Kiểm thử trực quan thủ công các điểm tích hợp (cần API key để chạy luồng thật).

## 9. Tiêu chí hoàn thành

- 8 luồng (mục 4) thay loader cũ bằng `<StepNarrator>` đúng `placement`.
- Mỗi luồng có màu nhấn + lời thoại riêng theo registry.
- `tsc --noEmit` sạch; unit test hook xanh.
- Tôn trọng reduced-motion; không leak timer.
- Loader trang chủ giữ nguyên.
