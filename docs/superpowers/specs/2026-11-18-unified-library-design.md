# Thiết kế: Gộp 3 tab Thư viện thành một (Library · Rules & Skills · LLM Config)

Ngày: 2026-11-18
Trạng thái: bản nháp — chờ duyệt các câu hỏi ở mục "Cần chốt"

## Vấn đề

Nhóm điều hướng "Thư viện" có 3 tab với cùng một khuôn: sidebar danh sách + lọc ngành + nút "Khám phá GitHub" + nút "Tạo bằng AI" + vùng chi tiết/editor.

| Tab | File | Dữ liệu | Lưu ở |
|---|---|---|---|
| Library | `LibraryTab.tsx` (644 dòng) | `PromptTemplate` (mẫu built-in + của tôi + cộng đồng), bookmark, bộ sưu tập, gần đây | Firestore `templates`, `bookmarks`; localStorage `pb_collections`, liked/recent |
| Rules & Skills | `RulesSkillsTab.tsx` (781) + `rulesskills/SkillsPanel.tsx` | `AiRule`, `AiSkill` | localStorage `custom_rules`/`custom_skills` + Firestore `rules`/`skills` |
| LLM Config | `UtilityBeltTab.tsx` (1006) | `CustomProfile` | **chỉ** localStorage `llm_custom_profiles` |

Hệ quả:
- Người dùng phải đoán một thứ nằm ở tab nào. Ví dụ: "persona viết blog" có thể là template, rule hay LLM Config.
- `LibraryExplorer`, `AuthoringWizard` và `DomainChips` mỗi thứ được gắn 2–3 lần, kèm 3 bản code "đọc lại localStorage sau khi import".
- `UtilityBeltTab` đang ôm cả **cài đặt app** không liên quan đến thư viện: nút bật/tắt gợi ý gõ nhanh (ghost-text), `BackupPanel`, `UsageStatsPanel`.
- `RulesSkillsTab` và `UtilityBeltTab` là 2 trong các God-component còn nợ (CLAUDE.md).

## Mục tiêu

- Một tab **Thư viện** (`#library`) chứa mọi loại tài sản tái sử dụng: Mẫu prompt · Rule · Skill · LLM Config.
- Một ô tìm kiếm và một bộ lọc dùng chung cho mọi loại. Mỗi loại vẫn giữ editor chuyên biệt của nó.
- Không đổi mô hình dữ liệu, không đổi nơi lưu, không cần deploy Firestore rules.
- Link cũ `#rulesskills`, `#utilitybelt` vẫn mở đúng chỗ.

## Không làm (ngoài phạm vi)

- Gộp 4 kiểu dữ liệu thành một kiểu chung, hoặc đổi collection Firestore.
- Đồng bộ Firestore cho LLM Config. Hiện chỉ có localStorage; ghi lại làm việc riêng sau.
- Viết lại editor Rule/Skill/Config. Đợt này chỉ di chuyển và tách file.

## Thiết kế

### A. Khung tab mới

`LibraryTab` thành **khung điều phối mỏng**:

```
┌ Thư viện ─────────────────────────────────────────────────────────┐
│ [🔍 Tìm trong thư viện…]   [Khám phá GitHub] [✨ Tạo bằng AI]       │
│ Loại: (Tất cả) (Mẫu prompt) (Rule) (Skill) (LLM Config)  Ngành: ▾  │
├───────────────────────────────────────────────────────────────────┤
│ Loại = Tất cả   → lưới kết quả hỗn hợp (thẻ có nhãn loại)          │
│ Loại = cụ thể   → giao diện hiện có của loại đó (sidebar+editor)   │
└───────────────────────────────────────────────────────────────────┘
```

- Loại đang chọn nằm trên URL: `#library?lib=templates|rules|skills|configs`. Mặc định là `templates`, để người đang quen Library không bị đổi màn hình.
- Chế độ "Tất cả" chỉ dùng để **tìm và mở**. Bấm một thẻ sẽ chuyển sang loại của thẻ đó, mở sẵn mục ấy (`&id=`).
- `LibraryExplorer` và `AuthoringWizard` chỉ gắn **một lần** ở khung. Loại đang chọn quyết định giá trị mặc định khi nhập hoặc tạo. Sau khi lưu, khung phát một sự kiện làm mới, thay cho 3 bản "đọc lại localStorage" như hiện nay.

### B. Tách file (đợt này giữ nguyên hành vi)

| Mới | Lấy từ |
|---|---|
| `components/library/TemplatesView.tsx` | thân `LibraryTab.tsx` hiện tại |
| `components/library/RulesView.tsx` | phần rules của `RulesSkillsTab.tsx` |
| `components/library/SkillsView.tsx` | `rulesskills/SkillsPanel.tsx` (đổi chỗ) |
| `components/library/ConfigsView.tsx` | phần profile của `UtilityBeltTab.tsx` |
| `components/library/AllResultsView.tsx` | mới — lưới kết quả hỗn hợp |

`RulesSkillsTab.tsx` và `UtilityBeltTab.tsx` bị xoá sau khi tách xong.

### C. Tìm kiếm hợp nhất (hàm thuần, có test)

`src/utils/libraryIndex.ts`:

```ts
type LibraryKind = 'template' | 'rule' | 'skill' | 'config';
interface LibraryItem { kind: LibraryKind; id: string; title: string; description?: string; domain?: string; tags?: string[]; isPreset?: boolean }

buildLibraryIndex({ templates, rules, skills, configs }): LibraryItem[]
searchLibrary(items, { query, kinds, domain }): LibraryItem[]   // không dấu, xếp hạng: tiêu đề > tag > mô tả
```

- Tái dùng logic bỏ dấu và xếp hạng sẵn có của `src/utils/globalSearch.ts` nếu được. Command Palette và Thư viện nên cho cùng một kết quả.
- `DomainChips` / `filterByDomain` dùng chung cho mọi loại. Template hiện chưa có `domain`; lọc theo ngành sẽ coi template là "Khác" cho đến khi được gắn nhãn.

### D. Đưa cài đặt app ra khỏi thư viện

Ghost-text, `BackupPanel` và `UsageStatsPanel` chuyển vào **modal Cài đặt** mở từ chân sidebar (cạnh Dark mode). Trên mobile, modal mở từ menu "Thêm". Modal mới: `components/common/SettingsModal.tsx`.

### E. Điều hướng và link cũ

- `navGroups.ts`: nhóm `library` chỉ còn `['library']`. Bỏ `rulesskills` và `utilitybelt` khỏi `TabType`, `VALID_TABS` và nav.
- `resolveLegacyTab` thêm hai dòng: `rulesskills → library?lib=rules`, `utilitybelt → library?lib=configs`.
- Cập nhật các nơi trỏ tới tab cũ:
  - `StepEnhance.tsx:163` (Studio → rulesskills)
  - `HomeTab` FEATURES (2 thẻ gộp thành 1)
  - `globalSearch.ts` (rule/skill → `library` + `lib=rules|skills`)
  - `App.tsx:421`
- Command Palette: "Mở Rules", "Mở Skills", "Mở LLM Config" thành lệnh deep-link, để người quen phím tắt vẫn đi thẳng được.

## Thứ tự làm (mỗi bước merge được, CI xanh)

1. **Tách file** (mục B), chưa đổi điều hướng. 3 tab cũ render các View mới → verify: hành vi y nguyên, test cũ xanh.
2. **Modal Cài đặt** (mục D) → verify: 3 cài đặt chạy như cũ, `UtilityBeltTab` không còn chúng.
3. **Khung tab + segment loại + `?lib=`** (mục A, chưa có "Tất cả") và chuyển hướng link cũ (mục E) → verify: test `navGroups`/`resolveLegacyTab` cho 2 hash mới, thử bằng trình duyệt.
4. **Explorer/Wizard gắn một lần** và sự kiện làm mới → verify: nhập 1 rule, 1 skill, 1 config, 1 template đều hiện ngay đúng loại.
5. **Tìm kiếm hợp nhất và chế độ "Tất cả"** (mục C) → verify: test `libraryIndex`, trình duyệt: tìm "SEO" ra cả template, rule và config.

## Kiểm thử

- Unit: `libraryIndex.test.ts` (bỏ dấu, lọc theo loại/ngành, xếp hạng), `navGroups.test.ts` (mục mới của `resolveLegacyTab`).
- Integrity: id không trùng giữa các loại khi trộn vào index (khoá là `kind:id`).
- Thủ công: mở `#rulesskills`, `#utilitybelt` từ link cũ; nhập từ GitHub cho từng loại; mobile (thanh tab đáy còn 4 nhóm, nhóm Thư viện không có hàng tab con).

## Rủi ro

- **Trạng thái editor bị mất khi đổi loại.** Hiện mỗi tab giữ state nhờ `visitedTabs`. Cách xử lý: khung giữ các View đã mở ở trạng thái mounted và ẩn bằng CSS, giống cách App làm với tab.
- **Diff lớn ở bước 1** dễ sinh lỗi hồi quy. Cách xử lý: bước 1 chỉ di chuyển code, không sửa logic, rồi review bằng `git diff -M`.

## Cần chốt

1. **Mặc định khi mở Thư viện:** `Mẫu prompt` (đề xuất, ít gây bất ngờ) hay `Tất cả`?
2. **Persona** hiện quản lý qua `PersonaManagerModal`. Có đưa thành loại thứ 5 trong Thư viện không? Đề xuất: chưa, để đợt sau.
3. **Tên tab:** giữ "Library" hay đổi thành "Thư viện" cho thống nhất tiếng Việt?
