import { AttrSlot, GraphEdge, GraphNode, PromptProject, PromptVariable } from '../types';
import { computeGraphLayout, LAYOUT } from './graphCompile';

// ─────────────────────────────────────────────────────────────────────────────
// 3 project mẫu cho Prompt Graph v3 — thay bộ mẫu "Gia sư" cũ. Mỗi mẫu minh hoạ
// mô hình "prompt gốc + thuộc tính cắm vào": người mới nhìn là hiểu cách chơi.
// ─────────────────────────────────────────────────────────────────────────────

interface AttrSpec {
  slot: AttrSlot;
  title: string;
  content: string;
  enabled?: boolean;
}

const buildSample = (
  id: string,
  name: string,
  description: string,
  rootContent: string,
  variables: PromptVariable[],
  attrs: AttrSpec[],
): PromptProject => {
  const root: GraphNode = {
    id: `${id}-root`,
    kind: 'root',
    attrType: 'custom',
    title: 'Prompt Gốc',
    content: rootContent,
    variables,
    position: { x: LAYOUT.rootX, y: LAYOUT.rootY },
    enabled: true,
  };
  const graphNodes: GraphNode[] = [root];
  const edges: GraphEdge[] = [];
  attrs.forEach((a, i) => {
    const node: GraphNode = {
      id: `${id}-attr-${i}`,
      kind: 'attribute',
      attrType: a.slot,
      title: a.title,
      content: a.content,
      variables: [],
      position: { x: 0, y: 0 },
      enabled: a.enabled !== false,
    };
    graphNodes.push(node);
    edges.push({ id: `${id}-edge-${i}`, source: node.id, target: root.id, targetSlot: a.slot });
  });

  const positions = computeGraphLayout(graphNodes, edges);
  const laidOut = graphNodes.map((n) => {
    const pos = positions.get(n.id);
    return pos ? { ...n, position: pos } : n;
  });

  const now = new Date().toISOString();
  return {
    id,
    name,
    description,
    globalEvalCriteria: [],
    nodes: [],
    schemaVersion: 3,
    graphNodes: laidOut,
    edges,
    testCases: [],
    versions: [],
    createdAt: now,
    updatedAt: now,
  };
};

export const GRAPH_SAMPLE_PROJECTS: PromptProject[] = [
  buildSample(
    'sample-seo-blog',
    'Viết blog chuẩn SEO',
    'Prompt gốc viết bài blog, các thuộc tính cắm vào để chỉnh giọng điệu, cấu trúc và ràng buộc SEO. Thử bật/tắt từng node để thấy prompt đổi ngay.',
    'Viết một bài blog hoàn chỉnh về chủ đề: "{{chu_de}}".\n\nĐộ dài mục tiêu: khoảng {{so_tu}} từ. Người đọc mục tiêu: {{doc_gia}}.',
    [
      { name: 'chu_de', type: 'text', description: 'Chủ đề bài viết', required: true, defaultValue: 'Cách xây dựng thói quen đọc sách' },
      { name: 'so_tu', type: 'text', description: 'Số từ mong muốn', required: true, defaultValue: '1200' },
      { name: 'doc_gia', type: 'text', description: 'Đối tượng độc giả', required: true, defaultValue: 'người đi làm bận rộn 25-35 tuổi' },
    ],
    [
      { slot: 'role', title: 'Cây bút content 10 năm', content: 'Bạn là một cây bút content marketing với 10 năm kinh nghiệm viết blog tiếng Việt, nổi tiếng với văn phong cuốn hút và khả năng giữ chân người đọc đến dòng cuối.' },
      { slot: 'format', title: 'Cấu trúc bài chuẩn', content: 'Cấu trúc bắt buộc:\n- Tiêu đề chính (H1) giật nhưng không câu view rẻ tiền\n- Sapo 2-3 câu nêu lợi ích người đọc nhận được\n- 3-5 phần thân bài với heading H2, mỗi phần có ví dụ thực tế\n- Kết bài kèm lời kêu gọi hành động (CTA)' },
      { slot: 'constraints', title: 'Ràng buộc SEO', content: 'Yêu cầu SEO:\n- Từ khóa chính xuất hiện trong tiêu đề, sapo và ít nhất 2 heading\n- Mật độ từ khóa tự nhiên, không nhồi nhét\n- Câu ngắn dưới 25 từ, đoạn văn tối đa 4 câu\n- Đề xuất 1 meta description (dưới 160 ký tự) ở cuối bài' },
      { slot: 'tone', title: 'Giọng gần gũi', content: 'Giọng điệu thân thiện như đang trò chuyện với bạn bè, xưng "bạn - mình". Tránh văn phong học thuật khô khan.', enabled: false },
    ],
  ),
  buildSample(
    'sample-translator',
    'Trợ lý dịch thuật',
    'Prompt dịch thuật với các thuộc tính kiểm soát chất lượng: giữ thuật ngữ, giọng điệu bản địa, định dạng song ngữ. Tắt node "Song ngữ đối chiếu" nếu chỉ cần bản dịch.',
    'Dịch văn bản sau từ {{ngon_ngu_nguon}} sang {{ngon_ngu_dich}}:\n\n"""\n{{van_ban}}\n"""',
    [
      { name: 'ngon_ngu_nguon', type: 'text', description: 'Ngôn ngữ nguồn', required: true, defaultValue: 'tiếng Anh' },
      { name: 'ngon_ngu_dich', type: 'text', description: 'Ngôn ngữ đích', required: true, defaultValue: 'tiếng Việt' },
      { name: 'van_ban', type: 'long-text', description: 'Văn bản cần dịch', required: true, defaultValue: '' },
    ],
    [
      { slot: 'role', title: 'Dịch giả chuyên nghiệp', content: 'Bạn là dịch giả chuyên nghiệp 15 năm kinh nghiệm, chuyên dịch tài liệu công nghệ và kinh doanh, am hiểu sâu văn hóa của cả hai ngôn ngữ.' },
      { slot: 'constraints', title: 'Giữ thuật ngữ chuyên ngành', content: 'Quy tắc thuật ngữ:\n- Thuật ngữ kỹ thuật phổ biến (API, deploy, framework...) giữ nguyên tiếng Anh\n- Tên riêng, tên sản phẩm không dịch\n- Nếu một thuật ngữ có nhiều cách dịch, chọn cách thông dụng nhất trong ngành và chú thích bản gốc trong ngoặc lần đầu xuất hiện' },
      { slot: 'tone', title: 'Bản địa hoá tự nhiên', content: 'Dịch thoát ý, ưu tiên cách diễn đạt tự nhiên của người bản xứ thay vì dịch word-by-word. Thành ngữ phải chuyển sang thành ngữ tương đương, không dịch nghĩa đen.' },
      { slot: 'format', title: 'Song ngữ đối chiếu', content: 'Trình bày dạng bảng 2 cột: cột trái là câu gốc, cột phải là câu dịch, mỗi hàng một câu hoặc một đoạn ngắn.', enabled: false },
    ],
  ),
  buildSample(
    'sample-code-reviewer',
    'Code Reviewer',
    'Prompt review code với thuộc tính quy định tiêu chí, định dạng báo cáo và ví dụ mẫu. Cắm thêm node Ràng buộc riêng cho stack của bạn.',
    'Review đoạn code sau (ngôn ngữ: {{ngon_ngu}}):\n\n```\n{{code}}\n```\n\nBối cảnh: {{boi_canh}}',
    [
      { name: 'ngon_ngu', type: 'text', description: 'Ngôn ngữ lập trình', required: true, defaultValue: 'TypeScript' },
      { name: 'code', type: 'long-text', description: 'Đoạn code cần review', required: true, defaultValue: '' },
      { name: 'boi_canh', type: 'text', description: 'Bối cảnh của đoạn code', required: false, defaultValue: 'component React trong ứng dụng web' },
    ],
    [
      { slot: 'role', title: 'Senior Engineer khó tính', content: 'Bạn là Senior Software Engineer chuyên review code, nổi tiếng kỹ tính nhưng công tâm: chỉ ra lỗi thẳng thắn kèm cách sửa cụ thể, không chê chung chung.' },
      { slot: 'constraints', title: 'Tiêu chí review', content: 'Thứ tự ưu tiên khi review:\n1. Bug và lỗi logic (nghiêm trọng nhất)\n2. Lỗ hổng bảo mật, rò rỉ dữ liệu\n3. Hiệu năng (chỉ khi ảnh hưởng thực tế)\n4. Khả năng đọc hiểu và bảo trì\n\nKHÔNG bắt lỗi phong cách cá nhân (dấu chấm phẩy, đặt tên biến hợp lệ...).' },
      { slot: 'format', title: 'Định dạng báo cáo', content: 'Báo cáo theo cấu trúc:\n- **Tổng quan**: 2-3 câu đánh giá chung\n- **Vấn đề**: danh sách đánh số, mỗi vấn đề gồm [mức độ] + vị trí + giải thích + code đã sửa\n- **Điểm tốt**: 1-2 điểm code làm tốt (nếu có)' },
      { slot: 'example', title: 'Ví dụ một finding chuẩn', content: 'Ví dụ một finding đúng chuẩn:\n"1. [NGHIÊM TRỌNG] Dòng 12: `useEffect` thiếu dependency `userId` — khi user đổi tài khoản, dữ liệu cũ vẫn hiển thị. Sửa: thêm `userId` vào mảng dependency."' },
    ],
  ),
];
