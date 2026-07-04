# Project Chain v3 — "Xưởng lắp ráp Prompt" (Prompt Graph)

**Ngày:** 2026-07-04
**Trạng thái:** Đã duyệt design, chờ kế hoạch triển khai
**Phạm vi:** Viết lại tính năng Project Chain thành node-graph kiểu Blender Shader Editor trên React Flow.

## 1. Bối cảnh & vấn đề

Project Chain hiện tại là 2 sản phẩm dán vào 1 tab:

- **Wizard** (tuyến tính 3 bước) tham chiếu output bước trước bằng `{{output_N}}`.
- **Canvas** (cây tiến hoá) tham chiếu bằng `{{parent.output}}` / `{{TênNodeKhôngDấuCách.output}}` — dễ gõ sai, đổi tên node là gãy.
- Compile ngầm nối toàn bộ blocks của node tổ tiên vào prompt node con — người dùng không thấy nên không hiểu.
- Canvas tự viết: node con đặt toạ độ cố định nên chồng nhau; `applyAutoLayoutToProject` tồn tại nhưng không được gọi; không kéo được dây nối; zoom kẹp 0.5–1.5 không hướng con trỏ; node gốc bị khoá kéo.
- Mô hình dữ liệu là cây 1 cha (`parentId`) — không diễn tả được "nhiều node ảnh hưởng 1 node".

**Quyết định của người dùng (đã chốt qua Q&A):**

1. Mục đích: từ một prompt gốc, cắm các "thuộc tính" vào để nâng cấp/sửa chữa nó. Sản phẩm cuối = 1 prompt hoàn chỉnh.
2. Mô hình nối: đồ thị nhiều input (DAG), kéo dây giữa socket như Blender.
3. Công nghệ: React Flow (`@xyflow/react`).
4. Bỏ chế độ Wizard, canvas là duy nhất.
5. Node thuộc tính thuần văn bản; chỉ có 1 panel Chạy thử cho prompt đã compile (không còn nút Play per-node).

## 2. Khái niệm mới (mental model)

Giống Blender Shader Editor:

- Mỗi dự án có đúng **1 Node Prompt Gốc** (`kind: 'root'`) — tương đương *Material Output* — chứa nội dung lõi (nhiệm vụ chính) và các **cổng input đặt tên cố định** theo thứ tự compile:
  `Vai trò` → `Ngữ cảnh` → *(nội dung lõi)* → `Định dạng` → `Giọng điệu` → `Ràng buộc` → `Ví dụ` → `Sửa lỗi` → `Khác`.
- **Node Thuộc Tính** (`kind: 'attribute'`): 1 node = 1 mảnh văn bản (tiêu đề + nội dung + biến `{{ten_bien}}` tuỳ chọn). Có 1 cổng output (phải) và 1 cổng input `Ghép thêm` (trái) để gom node con — compile đệ quy, thoả mãn DAG nhiều input.
- Một cổng của Prompt Gốc nhận **nhiều dây**; các node cùng cắm 1 cổng được nối tiếp theo thứ tự vị trí Y trên canvas (trên → dưới).
- **Bật/tắt node (mute)**: node tắt → phần văn bản biến mất khỏi prompt cuối ngay, dây mờ đi. Node tắt kéo theo toàn bộ node cắm vào nó (nhánh upstream) bị loại khỏi compile.
- **Preview realtime**: panel hiển thị prompt cuối được lắp ráp, mỗi đoạn tô màu theo node nguồn. Cắm/rút/bật/tắt là preview đổi ngay.

## 3. Mô hình dữ liệu (types.ts)

```ts
export type AttrSlot = 'role' | 'context' | 'format' | 'tone'
  | 'constraints' | 'example' | 'fix' | 'custom';

export interface GraphNode {
  id: string;
  kind: 'root' | 'attribute';
  attrType: AttrSlot;          // với root: bỏ qua
  title: string;
  content: string;             // văn bản thuộc tính / nội dung lõi (root)
  variables: PromptVariable[]; // tái dùng PromptVariable hiện có
  position: { x: number; y: number };
  enabled: boolean;            // mute/unmute
}

export interface GraphEdge {
  id: string;
  source: string;              // id node nguồn (output)
  target: string;              // id node đích
  targetSlot: AttrSlot | 'append'; // cổng trên root, hoặc 'append' = cổng Ghép thêm của attribute
}

// PromptProject (v3) thêm:
//   schemaVersion: 3;
//   graphNodes: GraphNode[];
//   edges: GraphEdge[];
// Giữ nguyên: versions, testCases, workspaceId, globalEvalCriteria.
// Trường `nodes: TreeNode[]` cũ giữ optional để đọc project legacy trước khi migrate.
```

Ràng buộc đồ thị:

- Đúng 1 node `root`, không xoá được.
- Không cho tạo chu trình (kiểm tra khi kéo dây, từ chối + toast).
- Mỗi cặp (source, target, targetSlot) chỉ có 1 edge.

## 4. Migration project cũ → v3

Hàm thuần `migrateProjectToGraph(project): PromptProject` trong `src/utils/graphMigration.ts`:

1. Chạy khi mở project không có `schemaVersion: 3`. Backup nguyên bản vào localStorage key `mentor_ai_projects_backup_v2` trước khi ghi đè.
2. Node gốc cũ (`parentId === null`):
   - Block `task` đầu tiên → `content` của Prompt Gốc.
   - Các block còn lại (role/context/…) → mỗi block thành 1 node thuộc tính **đã nối dây** vào cổng tương ứng.
   - `variables` của node gốc → chuyển sang Prompt Gốc.
3. Mỗi node con/cháu cũ → 1 node thuộc tính loại `fix` (branchType failure) hoặc `custom` (còn lại); các block của nó gộp thành `content` (định dạng `[Tiêu đề block]\n nội dung`). Đặt trên canvas theo vị trí cũ, **chưa nối dây**, `enabled: false`.
4. Sau migrate lần đầu hiển thị toast giải thích: "Dự án đã chuyển sang mô hình đồ thị. Các nhánh cũ nằm trên canvas ở trạng thái tắt — cắm dây để dùng lại."
5. Cú pháp cũ `{{output_N}}`, `{{parent.output}}`, `{{X.output}}` trong nội dung được thay bằng ghi chú `[Tham chiếu cũ: …]` để người dùng thấy và tự xử lý (không còn ngữ nghĩa trong v3).

Unit test cho migration trong `src/__tests__/`.

## 5. Compile (graphCompile.ts)

Hàm thuần `compileGraph(project, inputs): { finalPrompt: string; sections: CompiledSection[] }` trong `src/utils/graphCompile.ts`:

1. Từ Prompt Gốc, với mỗi cổng theo thứ tự cố định (mục 2): lấy các edge trỏ vào cổng, lọc node `enabled`, sắp theo `position.y` tăng dần.
2. Mỗi node thuộc tính compile đệ quy: các node cắm vào cổng `Ghép thêm` của nó (đã sort theo Y) được nối phía sau nội dung của nó, thụt cùng section.
3. Section có tiêu đề: `[Vai trò]`, `[Ngữ cảnh]`, … Nội dung lõi của root đứng sau `Ngữ cảnh` với tiêu đề `[Nhiệm vụ]` — thống nhất mọi section đều có tiêu đề để preview tô màu đối xứng.
4. Biến `{{ten_bien}}` thay bằng `inputs[name]` → `defaultValue` → giữ nguyên placeholder. **Chỉ còn một cú pháp biến duy nhất.**
5. `sections` trả về kèm `nodeId` + màu để preview tô màu theo node nguồn.

`CompiledSection = { nodeId, slot, title, text }`.

## 6. Giao diện (React Flow)

Dependency mới: `@xyflow/react` (+ `dagre` cho auto-layout). Viết lại `src/components/project-chain/`:

| Thành phần | Vai trò |
|---|---|
| `GraphCanvas.tsx` | React Flow instance: kéo dây socket-to-socket, zoom về con trỏ, minimap, fit-view, chọn nhiều node, Delete xoá node/dây, chặn chu trình khi connect. |
| `RootPromptNode.tsx` | Custom node: hiển thị nội dung lõi rút gọn + các Handle input đặt tên theo cổng. Không xoá được. |
| `AttributeNode.tsx` | Custom node: màu theo `attrType`, công tắc bật/tắt, Handle output + Handle `Ghép thêm`. |
| `NodeInspector.tsx` | Sidebar phải (kế thừa NodeDetailSidebar): sửa tiêu đề/nội dung/loại/biến; import/export template Library giữ nguyên. |
| `CompiledPreviewPanel.tsx` | Panel prompt cuối realtime, section tô màu theo node, nút Copy. |
| `TestRunPanel.tsx` | Thay Simulator: form điền biến → chạy prompt compile qua `aiService` (stream, model từ `src/config/models.ts`) → nút "Đánh giá & gợi ý". |
| `NodePalette.tsx` | Thanh thêm node theo loại thuộc tính + từ template Library. |

Hành vi chính:

- Nút **"Sắp xếp lại"** chạy dagre layout (trái→phải, root bên phải cùng) — thay thế `applyAutoLayoutToProject` (xoá code chết).
- Node mới từ palette đặt tại vị trí không chồng lấp (tìm ô trống gần tâm nhìn).
- Styling: token ngữ nghĩa / class riêng, tránh lớp override slate trong `index.css`.
- `ProjectChainTab.tsx` gọn thành shell: sidebar danh sách dự án + `GraphWorkspace`. Toàn bộ code Wizard (~1.500 dòng) bị xoá. `useCanvasInteraction` xoá (React Flow thay thế).

## 7. Chạy thử & nâng cấp bằng AI

- **Chạy thử**: một nơi duy nhất (TestRunPanel). Kết quả lưu vào `testCases` (giữ 10 bản gần nhất) như hiện tại.
- **Nâng cấp/sửa chữa**: sau khi có kết quả chạy thử, nút "Đánh giá & gợi ý" gọi `evaluateAndEnhancePrompt(promptCompile, output)`. Mỗi gợi ý được chấp nhận → sinh **node thuộc tính mới loại `fix`, tự nối vào cổng `Sửa lỗi`**, đặt cạnh root. Người dùng bật/tắt/xoá từng gợi ý như thuộc tính thường.
- **Lịch sử phiên bản**: VersionDrawer giữ nguyên; mỗi version snapshot `finalPrompt` compile tại thời điểm lưu (thay vì text 1 node).

## 8. Ảnh hưởng hệ thống

- **Chain→App (Lab / chainAppService)**: đang duyệt cây `parentId`. Với project v3: app chia sẻ chạy **1 bước** = prompt compile + form biến (`compileGraph` dùng chung). Project legacy chưa migrate vẫn đi đường cũ (giữ hàm cũ cho tới khi legacy hết).
- **Firestore**: vẫn collection `projects`, chỉ thêm field (`schemaVersion`, `graphNodes`, `edges`) — không đổi rules, không cần `firebase deploy`.
- **Project mẫu**: thay mẫu "Gia sư" bằng 3 mẫu đồ thị: *Viết blog chuẩn SEO*, *Trợ lý dịch thuật*, *Code reviewer*. Empty-state hướng dẫn 3 bước: "Chọn mẫu → Cắm dây → Chạy thử".

## 9. Bị loại bỏ (chủ đích)

- Chế độ Wizard + step indicator + cú pháp `{{output_N}}`.
- Nhánh tiến hoá success/failure, `evolutionInstruction/evolutionType`, chạy nháp per-node (`draftOutput`, status `drafting/drafted`), `userEvaluation`.
- `contextMode`/`contextLimit`, cờ `isStale` + `markDescendantsStale` (không còn output per-node nên không còn khái niệm lỗi thời).
- `compileEvolutionPrompt`, `compilePromptTextCanvas`, `useCanvasInteraction`, `applyAutoLayoutToProject`.

## 10. Kiểm thử & nghiệm thu

- Vitest: `graphCompile` (thứ tự cổng, sort theo Y, mute, đệ quy Ghép thêm, biến, chặn chu trình), `graphMigration` (root blocks, node con, thay cú pháp cũ).
- `npm run lint` · `npm test` · `npm run build` xanh; type-check riêng cho `api/` không bị ảnh hưởng.
- Kiểm tra thủ công bằng preview server: kéo dây, mute, auto-layout, preview realtime, chạy thử, gợi ý AI thành node, migration project cũ.

## 11. Ngoài phạm vi

- Node AI biến đổi (AI Rewrite/Critique node) — có thể là v3.1 sau khi mô hình thuộc tính ổn định.
- Undo/redo trên canvas; realtime collaboration; i18n.
