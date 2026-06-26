# Thiết kế: Gợi ý gõ nhanh Ghost-Text (Inline Autocomplete)

- **Ngày:** 2026-06-26
- **Trạng thái:** Đã duyệt thiết kế, sẵn sàng lập kế hoạch triển khai
- **Phạm vi:** Tính năng gợi ý nội bộ kiểu "ghost text / tab-to-complete" cho các ô nhập liệu tạo prompt trong Prompt Builder.

---

## 1. Mục tiêu & Bối cảnh

Khi người dùng gõ vào một ô nhập liệu, hệ thống dựa trên nội dung hiện tại đề xuất phần tiếp theo và hiển thị mờ (ghost text) ngay phía sau con trỏ. Nhấn **Tab** để điền nhanh. Mục tiêu là tăng tốc độ soạn prompt mà **không phát sinh chi phí API** — đúng triết lý tiết kiệm của ứng dụng (xem `promptRouter.ts` / `algorithmEngine.ts`).

**Trọng tâm đặc biệt:** áp dụng cho **ô nhập biến số** để người dùng điền nhanh giá trị biến (autofill theo tên biến, giống autofill biểu mẫu trình duyệt).

### Quyết định cốt lõi (đã chốt)

| Hạng mục | Quyết định |
|---|---|
| Nguồn gợi ý | Thuật toán cục bộ thuần (corpus + lịch sử), **không gọi AI** |
| Độ dài gợi ý | Linh hoạt theo ngữ cảnh: ô trống → cả câu/dòng; gõ giữa chừng → phần còn lại. Tab điền hết dòng, Ctrl+→ nhận 1 từ |
| Phạm vi áp dụng | Tất cả các ô nhập: nội dung khối (Builder), Topic (Home), node ProjectChain, Enhancer, chỉ thị riêng, **và ô biến số** |
| Lưu lịch sử | Firebase (đồng bộ đám mây theo `uid`), kiến trúc model tổng hợp 1 doc/người dùng |

---

## 2. Kiến trúc & Module

```
src/services/suggestionEngine.ts          ← engine thuần (không React/Firebase, dễ unit-test)
src/services/suggestionStore.ts           ← nạp/ghi model Firebase + localStorage
src/hooks/useGhostText.ts                  ← hook nối engine vào 1 ô input
src/components/common/GhostTextArea.tsx    ← wrapper <textarea> có overlay ghost
src/components/common/GhostTextInput.tsx   ← wrapper <input> có overlay ghost (cả ô biến số)
```

**Nguyên tắc tách bạch:**
- `suggestionEngine` không biết gì về React/Firebase — chỉ nhận/trả dữ liệu thuần → unit-test dễ.
- `suggestionStore` lo I/O (Firebase + localStorage) và vòng đời model.
- `useGhostText` lo vòng đời React + phím tắt.
- Component lo render overlay. Mỗi ô input chỉ cần đổi `<textarea>`→`<GhostTextArea>`, `<input>`→`<GhostTextInput>`.

**Luồng dữ liệu:**
1. Khởi động: `suggestionStore` gộp **corpus tĩnh** (TEMPLATES + DAILY_PACKS + BLOCK_SUGGESTIONS) → model nền đặt vào RAM ngay (chạy được khi chưa đăng nhập).
2. Đăng nhập (`onAuthStateChanged` có `uid`): đọc `suggestionModels/{uid}` **1 lần**, merge bảng đếm của người dùng vào model RAM.
3. Khi gõ: component gọi `engine.suggest(context)` **đồng bộ, trong RAM (~0ms)** → chuỗi ghost.
4. Khi chấp nhận gợi ý / lưu khối / xác nhận biến: cập nhật model RAM + đánh dấu "dirty" → **debounce ~10s / khi blur** ghi lại 1 doc Firestore.

---

## 3. Ba chế độ của Engine

Tất cả dùng lại `normalizeVietnamese` trong `algorithmEngine.ts` để khớp không phân biệt dấu/hoa-thường.

### Model trong RAM

```ts
interface SuggestionModel {
  phrases: string[];                          // câu/dòng đầy đủ từ corpus + lịch sử (cho prefix)
  bigrams: Map<string, Map<string, number>>;  // w1 -> {w2: count}
  trigrams: Map<string, Map<string, number>>; // "w1 w2" -> {w3: count}
  varValues: Map<string, Map<string, number>>;// tên biến chuẩn hóa -> {giá trị: count}
}
```

### ① prefix — ô trống / con trỏ ở đầu dòng
- Lấy text dòng hiện tại làm `prefix`. Lọc `phrases` có `normalize(phrase)` bắt đầu bằng `normalize(prefix)`. Prefix rỗng → ưu tiên `BLOCK_SUGGESTIONS[blockType][theme]`.
- Xếp hạng: cụm từ lịch sử người dùng > corpus đúng `blockType`/`theme` > còn lại. Trả về `phrase.slice(prefix.length)`.
- Prefix ≥ 2 ký tự mà không khớp dòng nào → rơi xuống chế độ ②.

### ② ngram — đang gõ giữa câu
- Lấy 1–2 từ cuối trước con trỏ. Tra `trigrams["w1 w2"]`, trống thì tra `bigrams["w2"]`; chọn từ kế tiếp count cao nhất.
- **Mở rộng nhiều từ** (Tab điền hết dòng): lặp dự đoán, nối từ vừa đoán vào ngữ cảnh, dừng khi gặp dấu kết câu / hết ứng viên / đủ **12 từ**. Ctrl+→ chỉ nhận từ đầu tiên.
- Ngưỡng tin cậy: count < **2** → không hiện ghost (tránh nhiễu).

### ③ varValue — ô biến số (trọng tâm)
- Khóa = `normalize(tên biến)`. Lấy `varValues[name]`, lọc giá trị khớp prefix đang gõ, sắp theo count giảm dần.
- Bổ sung ứng viên từ `defaultValue` (định nghĩa biến) và giá trị cùng tên biến gặp trong corpus (count khởi tạo = 1).
- Ô **text** → `GhostTextInput` hiện ghost giá trị top khớp prefix + (tùy chọn) dropdown nhỏ top giá trị cũ. Ô rỗng → vẫn gợi ý giá trị hay dùng nhất (chính là "điền nhanh").
- Ô **select** (có `options`) → không ghost-text, chỉ preselect giá trị hay dùng nhất (phần nhỏ, optional).
- Khi xác nhận giá trị → tăng count trong `varValues`, debounce ghi Firebase.

### Xây model (khởi tạo 1 lần)
Duyệt corpus tách câu → đẩy `phrases`; tokenize → cộng bigram/trigram. Lịch sử người dùng từ Firebase **cộng dồn** vào cùng các map (giá trị người dùng tự nhiên được ưu tiên do count cao hơn).

### Hiệu năng
Mọi truy vấn = tra Map + lọc mảng ngắn → đồng bộ ~0ms. Tách câu/tokenize chỉ chạy lúc khởi tạo, không chạy mỗi phím gõ.

---

## 4. Data model & Firebase

**Collection mới:** `suggestionModels/{uid}` — 1 doc/người dùng. Firestore không lưu `Map` → serialize sang object thường, và **cắt gọn** để tránh phình doc (giới hạn 1MB/doc).

```ts
interface SuggestionModelDoc {
  userId: string;                                     // == uid (rule kiểm tra)
  bigrams:  Record<string, Record<string, number>>;   // chỉ count >= 2
  trigrams: Record<string, Record<string, number>>;   // chỉ count >= 2
  varValues: Record<string, Record<string, number>>;  // theo tên biến
  phrases: string[];                                  // tối đa 200 câu lịch sử gần nhất (FIFO)
  updatedAt: Timestamp;
  createdAt: Timestamp;
}
```

**Chống phình (cap):**
- `phrases`: tối đa **200** câu mới nhất (FIFO).
- mỗi map: tối đa **50** ứng viên/khóa (count cao nhất); tổng khóa cap ~**2000**, loại khóa count thấp khi vượt.
- chỉ ghi n-gram có count ≥ **2**.

**Vòng đời ghi/đọc (`suggestionStore.ts`):**
- **Đọc:** `onAuthStateChanged` có `uid` → `getDoc` 1 lần → merge vào model RAM. Lỗi/permission → bỏ qua, vẫn chạy bằng corpus + localStorage.
- **Ghi:** mọi cập nhật chỉ sửa **RAM + cache localStorage** rồi đánh dấu "dirty". Flush bằng `setDoc(..., {merge:true})` khi: **debounce 10s** sau thay đổi cuối, **hoặc** `beforeunload`/blur cửa sổ. Không ghi mỗi phím.
- **Chưa đăng nhập:** dùng localStorage key `ghostModel:anon`; khi đăng nhập lần đầu, **merge** anon vào doc người dùng rồi xóa key anon.

**firestore.rules — thêm khối mới** (theo pattern owner sẵn có, dùng `uid` làm document id):
```
match /suggestionModels/{uid} {
  allow get:    if isOwner(uid);
  allow create: if isOwner(uid)
                && incoming().userId == uid
                && incoming().createdAt == request.time;
  allow update: if isOwner(uid)
                && incoming().userId == uid
                && incoming().createdAt == existing().createdAt
                && incoming().updatedAt == request.time;
  allow delete: if isOwner(uid);
}
```

**Chi phí:** mỗi phiên ≈ **1 read** (lúc đăng nhập) + **vài write thưa** (debounce).

---

## 5. UX, render Ghost-Text & Phím tắt

**Kỹ thuật render** (textarea/input không hiển thị ghost-text inline được):
- Bọc input trong container `position: relative`. Phía sau đặt 1 **div "soi gương"** cùng font/size/padding/line-height/letter-spacing, render: `text đã gõ` (trong suốt) + `phần ghost` (mờ). Input thật nằm trên, nền trong suốt, caret bình thường.
- Đồng bộ **scroll** giữa input và overlay (textarea nhiều dòng). Overlay `pointer-events: none`.
- Ghost chỉ hiện khi: input đang focus, con trỏ ở **cuối text** (không hiện khi sửa giữa câu / có selection), engine trả gợi ý đạt ngưỡng.
- **Màu ghost:** dùng class riêng / `text-[var(--color-...)]` hoặc hex trực tiếp — **không** dùng utility slate/white trần vì có lớp `!important` trong `index.css` remap chúng theo theme.

**Phím tắt** (xử lý trong `useGhostText` qua `onKeyDown`):

| Phím | Hành vi |
|---|---|
| **Tab** | Chấp nhận **toàn bộ** ghost (cả dòng/câu). `preventDefault` để không nhảy focus. |
| **Ctrl + →** | Chấp nhận **1 từ** đầu của ghost. |
| **Esc** | Ẩn gợi ý hiện tại (tới lần gõ tiếp theo). |
| Gõ trùng ký tự đầu ghost | "Ăn" ký tự đó, ghost tự rút ngắn. |
| Phím khác / di chuyển con trỏ | Tính lại hoặc ẩn ghost. |

**Xung đột Tab:** chỉ chặn Tab **khi đang có ghost hiển thị**; không có ghost → Tab giữ chức năng chuyển focus (giữ khả năng truy cập bàn phím).

**Mobile:** không có Tab → khi có ghost hiện nút "⇥ Điền" (chip nhỏ) cạnh ô, hoặc vuốt phải để chấp nhận. Đặt sau cờ cấu hình, có thể tối giản ở bản đầu.

**Chống nhiễu/giật:** debounce tính gợi ý ~**60–80ms** sau phím gõ; không hiện ghost khi vừa backspace hoặc text quá ngắn (< 2 ký tự ở chế độ ngram).

**Tắt/bật:** toggle "Gợi ý gõ nhanh" trong UtilityBeltTab (mặc định bật), lưu cùng cấu hình hiện có.

---

## 6. Edge cases

- **Con trỏ giữa câu / có selection:** không hiện ghost.
- **Biến `{{...}}` trong văn xuôi:** không gợi ý cắt ngang cú pháp biến.
- **IME tiếng Việt (Telex/VNI):** trong `compositionstart`→`compositionend` tạm ẩn ghost, tính lại sau khi gõ xong.
- **Engine chưa nạp xong / offline:** trả rỗng, ô hoạt động bình thường.
- **Doc Firebase lỗi/permission:** nuốt lỗi qua `handleFirestoreError` sẵn có, tiếp tục bằng corpus + localStorage.
- **Dán văn bản (paste) / undo-redo:** ẩn ghost, không can thiệp.
- **Doc chạm cap:** cắt gọn FIFO/theo count trước khi ghi.

---

## 7. Testing

**Unit (Vitest, theo `src/__tests__/`)** cho `suggestionEngine` (phần thuần):
- prefix: ô trống trả gợi ý theo blockType/theme; prefix khớp/không khớp.
- ngram: mở rộng nhiều từ, dừng đúng ở dấu câu / giới hạn 12 từ; chặn count < 2.
- varValue: xếp hạng theo count, hòa corpus + defaultValue, lọc theo prefix.
- cap & merge: cộng dồn lịch sử người dùng vượt corpus; cắt gọn đúng giới hạn.
- serialize/deserialize Map↔object khứ hồi.

**Hook/UI:** test `useGhostText` xử lý Tab/Ctrl+→/Esc và quy tắc "chỉ hiện ở cuối dòng".

**Bằng chứng chạy:** `npm test` xanh trước khi coi là xong.

---

## 8. Thứ tự triển khai

Mỗi bước build & test được độc lập:

1. `suggestionEngine.ts` + unit test (chưa đụng UI/Firebase).
2. `suggestionStore.ts`: dựng model từ corpus + localStorage (chưa Firebase).
3. `useGhostText.ts` + `GhostTextArea`/`GhostTextInput` + render overlay & phím tắt.
4. Gắn vào **ô biến số** trước (trọng tâm) → rồi ô nội dung khối Builder.
5. Lan ra Topic, Enhancer, chỉ thị riêng, ProjectChain.
6. Nối Firebase: rule mới + đọc lúc đăng nhập + ghi debounce + merge anon→user.
7. Toggle bật/tắt trong UtilityBeltTab.

---

## 9. Ngoài phạm vi (YAGNI)

- Không AI, không phân tích thống kê đám mây.
- Không reorder `<select>` phức tạp (chỉ preselect giá trị hay dùng).
- Không gợi ý đa ngôn ngữ ngoài vi/en.
