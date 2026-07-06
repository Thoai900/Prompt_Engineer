import { AttrSlot, FewShotExample } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// v3.2 — Thư viện Modifier node (Meta-Prompt / Instruction Modifiers).
// Mỗi preset = một node "hành động": người dùng chỉnh dropdown/slider trên node,
// text chỉ dẫn được SINH RA khi compile (render) — không phải gõ tay.
// Hàm thuần, không đụng UI — unit-test được.
// ─────────────────────────────────────────────────────────────────────────────

export interface PresetParamOption {
  value: string;
  label: string;
}

export interface PresetParam {
  key: string;
  label: string;
  type: 'select' | 'slider';
  options?: PresetParamOption[]; // cho select
  min?: number;                  // cho slider
  max?: number;
  defaultValue: string;
}

export interface NodePreset {
  id: string;
  slot: AttrSlot;       // cổng mặc định cắm vào Prompt Gốc
  icon: string;         // emoji hiển thị trong palette & node card
  title: string;
  description: string;  // 1 dòng trong menu Thêm node
  params: PresetParam[];
  render: (params: Record<string, string>) => string;
}

const pick = (params: Record<string, string>, key: string, fallback: string) =>
  params[key] !== undefined && params[key] !== '' ? params[key] : fallback;

// ── Định nghĩa các preset ────────────────────────────────────────────────────

const CREATIVITY_LEVELS: Record<string, string> = {
  '1': 'Bám sát tuyệt đối dữ kiện và yêu cầu. Không suy diễn, không thêm ý tưởng ngoài phạm vi được giao.',
  '2': 'Ưu tiên cách diễn đạt an toàn, rõ ràng, kinh điển. Hạn chế ví von và liên tưởng.',
  '3': 'Cân bằng giữa chính xác và sáng tạo: được phép dùng ví dụ, phép so sánh khi chúng giúp nội dung dễ hiểu hơn.',
  '4': 'Khuyến khích góc nhìn mới lạ: dùng phép ẩn dụ độc đáo, cách tiếp cận ít người nghĩ tới, miễn là vẫn đúng trọng tâm.',
  '5': 'Tư duy thoát ly lối mòn (out-of-the-box) tối đa: ẩn dụ táo bạo, kết nối ý tưởng liên ngành bất ngờ, thách thức các giả định thông thường — miễn vẫn phục vụ đúng mục tiêu cuối cùng.',
};

const TONE_VIBES: Record<string, { label: string; text: string }> = {
  humorous: {
    label: 'Hài hước',
    text: 'Giọng điệu hài hước, thông minh: dùng cách chơi chữ và tình huống dí dỏm đúng lúc để nội dung sinh động, nhưng không lố, không mỉa mai người đọc.',
  },
  contemplative: {
    label: 'Trầm ngâm',
    text: 'Giọng điệu trầm ngâm, sâu sắc: nhịp chậm, câu văn giàu suy tưởng, đặt câu hỏi gợi mở để người đọc tự chiêm nghiệm.',
  },
  assertive: {
    label: 'Đanh thép',
    text: 'Giọng điệu đanh thép, quyết đoán: khẳng định trực diện, lập luận sắc bén có dẫn chứng, không vòng vo, không rào đón thừa.',
  },
  friendly: {
    label: 'Thân thiện',
    text: 'Giọng điệu thân thiện như trò chuyện với bạn bè: xưng hô gần gũi, câu ngắn tự nhiên, khích lệ người đọc.',
  },
  formal: {
    label: 'Trang trọng',
    text: 'Giọng điệu trang trọng, chuyên nghiệp: từ ngữ chuẩn mực, cấu trúc chặt chẽ, phù hợp văn bản công việc và học thuật.',
  },
  inspiring: {
    label: 'Truyền cảm hứng',
    text: 'Giọng điệu truyền cảm hứng: nhấn vào ý nghĩa và khả năng hành động, kết thúc các phần bằng thông điệp tích cực có sức đẩy.',
  },
};

const FORMAT_MODES: Record<string, { label: string; text: string }> = {
  markdown: {
    label: 'Markdown',
    text: 'Trình bày kết quả bằng Markdown chuẩn: heading phân cấp rõ ràng, danh sách khi liệt kê, **in đậm** ý then chốt, code block cho mã nguồn.',
  },
  json: {
    label: 'JSON',
    text: 'CHỈ trả về một đối tượng JSON hợp lệ. Không bọc trong code block markdown, không thêm bất kỳ văn bản giải thích nào trước hoặc sau JSON.',
  },
  table: {
    label: 'Bảng',
    text: 'Trình bày kết quả chính dưới dạng bảng Markdown với tiêu đề cột rõ ràng. Ngoài bảng chỉ thêm tối đa 2 câu dẫn nhập.',
  },
  bullets: {
    label: 'Gạch đầu dòng',
    text: 'Trình bày toàn bộ bằng gạch đầu dòng ngắn gọn: mỗi ý một dòng, tối đa 2 cấp lồng nhau, không viết đoạn văn dài.',
  },
};

const HALLUCINATION_MODES: Record<string, { label: string; text: string }> = {
  warn: {
    label: 'Cảnh báo khi không chắc',
    text: 'Khi không chắc chắn về một thông tin, hãy nói rõ mức độ chắc chắn thay vì đoán bừa. Tuyệt đối không bịa số liệu, trích dẫn hay tên nguồn không có thật.',
  },
  strict: {
    label: 'Chỉ dùng dữ kiện được cấp',
    text: 'CHỈ sử dụng dữ kiện được cung cấp trong prompt này. Nếu thông tin cần thiết không có trong dữ liệu đầu vào, trả lời "Không đủ dữ kiện để kết luận" thay vì suy đoán.',
  },
};

const LENGTH_MODES: Record<string, { label: string; text: string }> = {
  xs: { label: 'Siêu ngắn', text: 'Trả lời siêu ngắn: tối đa 3 câu, đi thẳng vào kết luận, bỏ mọi phần dẫn nhập.' },
  s: { label: 'Ngắn gọn', text: 'Trả lời ngắn gọn trong khoảng 100–150 từ, chỉ giữ những ý quan trọng nhất.' },
  m: { label: 'Vừa phải', text: 'Độ dài vừa phải, khoảng 300–500 từ: đủ ý, có dẫn giải nhưng không lan man.' },
  l: { label: 'Chi tiết', text: 'Trả lời chi tiết, khoảng 800–1200 từ, có ví dụ minh hoạ cho các ý chính.' },
  xl: { label: 'Toàn diện', text: 'Phân tích sâu và toàn diện nhất có thể: bao quát mọi khía cạnh quan trọng, nhiều ví dụ và phản ví dụ, không giới hạn độ dài.' },
};

export const NODE_PRESETS: readonly NodePreset[] = [
  {
    id: 'creativity',
    slot: 'tone',
    icon: '🎨',
    title: 'Mức sáng tạo',
    description: 'Slider 1–5: từ bám sát dữ kiện đến tư duy out-of-the-box',
    params: [{ key: 'level', label: 'Mức sáng tạo', type: 'slider', min: 1, max: 5, defaultValue: '3' }],
    render: (p) => {
      const level = pick(p, 'level', '3');
      return `[Mức sáng tạo ${level}/5] ${CREATIVITY_LEVELS[level] || CREATIVITY_LEVELS['3']}`;
    },
  },
  {
    id: 'tone-vibe',
    slot: 'tone',
    icon: '🎙️',
    title: 'Giọng điệu nhanh',
    description: 'Chọn nhanh: Hài hước · Trầm ngâm · Đanh thép · Thân thiện…',
    params: [{
      key: 'vibe', label: 'Giọng điệu', type: 'select', defaultValue: 'friendly',
      options: Object.entries(TONE_VIBES).map(([value, v]) => ({ value, label: v.label })),
    }],
    render: (p) => (TONE_VIBES[pick(p, 'vibe', 'friendly')] || TONE_VIBES.friendly).text,
  },
  {
    id: 'socratic-critic',
    slot: 'constraints',
    icon: '🔁',
    title: 'Phản biện ngược',
    description: 'AI tự phản biện giải pháp N lần trước khi trả lời',
    params: [{
      key: 'rounds', label: 'Số vòng phản biện', type: 'select', defaultValue: '2',
      options: [
        { value: '1', label: '1 vòng' },
        { value: '2', label: '2 vòng' },
        { value: '3', label: '3 vòng' },
      ],
    }],
    render: (p) => {
      const rounds = pick(p, 'rounds', '2');
      return `Trước khi đưa ra câu trả lời cuối cùng, hãy tự phản biện giải pháp của chính mình ${rounds} lần: mỗi vòng tìm ra ít nhất một điểm yếu, lỗ hổng hoặc phản ví dụ, rồi sửa lại giải pháp. Chỉ trình bày phiên bản cuối cùng đã vượt qua phản biện (không hiển thị quá trình).`;
    },
  },
  {
    id: 'output-format',
    slot: 'format',
    icon: '📋',
    title: 'Ép định dạng',
    description: 'Buộc kết quả ra Markdown / JSON / Bảng / Bullet',
    params: [{
      key: 'mode', label: 'Định dạng', type: 'select', defaultValue: 'markdown',
      options: Object.entries(FORMAT_MODES).map(([value, v]) => ({ value, label: v.label })),
    }],
    render: (p) => (FORMAT_MODES[pick(p, 'mode', 'markdown')] || FORMAT_MODES.markdown).text,
  },
  {
    id: 'anti-hallucination',
    slot: 'constraints',
    icon: '🛡️',
    title: 'Chống bịa đặt',
    description: 'Không bịa số liệu/nguồn; tuỳ chọn chỉ dùng dữ kiện được cấp',
    params: [{
      key: 'mode', label: 'Mức nghiêm ngặt', type: 'select', defaultValue: 'warn',
      options: Object.entries(HALLUCINATION_MODES).map(([value, v]) => ({ value, label: v.label })),
    }],
    render: (p) => (HALLUCINATION_MODES[pick(p, 'mode', 'warn')] || HALLUCINATION_MODES.warn).text,
  },
  {
    id: 'length-control',
    slot: 'constraints',
    icon: '📏',
    title: 'Kiểm soát độ dài',
    description: 'Từ siêu ngắn 3 câu đến phân tích toàn diện',
    params: [{
      key: 'mode', label: 'Độ dài', type: 'select', defaultValue: 'm',
      options: Object.entries(LENGTH_MODES).map(([value, v]) => ({ value, label: v.label })),
    }],
    render: (p) => (LENGTH_MODES[pick(p, 'mode', 'm')] || LENGTH_MODES.m).text,
  },
];

export const getPreset = (id?: string): NodePreset | undefined =>
  NODE_PRESETS.find((p) => p.id === id);

/** Giá trị mặc định cho params của một preset (dùng khi tạo node mới). */
export const defaultPresetParams = (preset: NodePreset): Record<string, string> =>
  Object.fromEntries(preset.params.map((p) => [p.key, p.defaultValue]));

// ── Few-Shot render ──────────────────────────────────────────────────────────

/** Sinh text chuẩn few-shot từ các cặp Input→Output (bỏ cặp trống cả hai vế). */
export const renderFewShotText = (examples: FewShotExample[]): string => {
  const pairs = (examples || []).filter((e) => (e.input || '').trim() || (e.output || '').trim());
  if (pairs.length === 0) return '';
  const body = pairs
    .map((e, i) => `── Ví dụ ${i + 1} ──\nĐầu vào:\n${(e.input || '').trim()}\n\nĐầu ra mong muốn:\n${(e.output || '').trim()}`)
    .join('\n\n');
  return `Học theo các ví dụ mẫu sau (bám sát phong cách và cấu trúc của phần "Đầu ra mong muốn"):\n\n${body}`;
};
