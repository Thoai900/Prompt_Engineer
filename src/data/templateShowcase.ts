// Template Showcase — nội dung "bán giá trị" cho card thư viện (Phương án A: trước→sau).
// Tách khỏi định nghĩa lõi template. Nội dung do AI sinh + duyệt, bake tĩnh.
// output là KẾT QUẢ MẪU (đại diện), KHÔNG phải cam kết — card gắn nhãn rõ.
// Xem spec: docs/superpowers/specs/2026-07-09-template-showcase-card-design.md

import type { PromptTemplate } from '../types';

export type ShowcaseOutputType = 'text' | 'code' | 'ui' | 'video' | 'mindmap' | 'tutor';

export interface TemplateShowcase {
  hook: string; // câu chốt lợi ích, ≤ ~12 từ, thiên outcome
  input: string; // ví dụ người dùng điền (đã thay {{biến}})
  output: string; // kết quả AI đại diện
  outputType?: ShowcaseOutputType;
}

export const TEMPLATE_SHOWCASE: Record<string, TemplateShowcase> = {
  'student-tutor': {
    hook: 'Hiểu bài nhờ tự nghĩ ra, không bị giải hộ',
    input: 'Môn: Toán · Lớp 9 · Đề: Giải phương trình x² − 4x + 4 = 0',
    output:
      'Mình chưa giải vội nhé. Quan sát: x² là (x)², số 4 là (2)², còn −4x = −2·x·2.\nCả ba gợi cho em hằng đẳng thức nào đã học?\n👉 Thử viết vế trái về dạng (a − b)² xem sao, rồi cho mình biết em thấy gì.',
    outputType: 'tutor',
  },
  'student-ielts-speaking': {
    hook: 'Luyện Speaking, nhận nhận xét band ngay mỗi câu',
    input: 'Band mục tiêu: 7.0 · Part 2 · Chủ đề: Describe a book you enjoyed',
    output:
      "Examiner: Let's begin Part 2. Describe a book you recently enjoyed. You have 1 minute to prepare.\n\n(Sau khi bạn trả lời)\n✅ Ưu điểm: từ vựng “page-turner”, ý mạch lạc.\n⚠️ Cần sửa: “I very like it” → “I really enjoyed it”.\n💡 Ăn điểm: thử “it resonated with me”. Sẵn sàng câu tiếp?",
    outputType: 'text',
  },
  'student-mindmap': {
    hook: 'Biến trang sách dài thành sơ đồ dễ nhớ',
    input: 'Môn: Lịch sử · Nội dung: Các triều đại phong kiến tự chủ (Ngô, Đinh, Tiền Lê, Lý)',
    output:
      '🧠 PHONG KIẾN TỰ CHỦ (TK X–XI)\n• 👑 Ngô (939): Ngô Quyền — Bạch Đằng — đô Cổ Loa\n• 🛡️ Đinh (968): Đinh Bộ Lĩnh — Đại Cồ Việt — Hoa Lư\n• 🗡️ Tiền Lê (980): Lê Hoàn — chống Tống\n• 🌸 Lý (1009): Lý Công Uẩn — dời đô Thăng Long\n📝 Nhớ nhanh: “Ngô Đinh Lê Lý” — Ngồi Đây Lặng Yên.',
    outputType: 'mindmap',
  },
  'student-planner': {
    hook: 'Thời gian biểu ôn thi khả thi, không quá tải',
    input: 'Kỳ thi: THPT Quốc gia sau 6 tuần · Giỏi: Văn · Yếu: Toán · Rảnh: 3 giờ/ngày',
    output:
      '🎯 Ưu tiên kéo Toán, giữ phong độ Văn.\n\nMỗi ngày (3 Pomodoro):\n• 25′ Toán lý thuyết → nghỉ 5′\n• 25′ Toán giải đề → nghỉ 5′\n• 25′ Văn ôn nhẹ / đọc đề\n\nChủ nhật: thi thử 1 đề Toán, chấm điểm, ghi lỗi hay sai. Ngủ tối thiểu 7 giờ.',
    outputType: 'text',
  },
  'master-content-creator': {
    hook: 'Bài blog chuẩn SEO, mở bài không sáo rỗng',
    input: 'Chủ đề: Làm việc sâu (deep work) · Từ khóa SEO: tập trung làm việc · Độc giả: freelancer',
    output:
      '# Deep work: thứ tách freelancer giỏi khỏi phần còn lại\n\nBạn mở laptop lúc 9h, ngẩng lên đã 12h mà việc chính vẫn dang dở. Quen chứ?\n\n## Vì sao “bận” không phải là “hiệu quả”\n…\n## 3 khối tập trung bạn áp dụng ngay hôm nay\n…',
    outputType: 'text',
  },
  'master-coding-helper': {
    hook: 'Review code, chỉ Big-O và bản refactor an toàn',
    input: 'Ngôn ngữ: JavaScript · Yêu cầu: hàm lọc phần tử trùng, đang chậm với 1M phần tử',
    output:
      '// [PHÂN TÍCH] filter + indexOf là O(N²) → chậm với mảng lớn.\n// [MÃ NGUỒN] Dùng Set: O(N) time, O(N) space.\nfunction removeDuplicates(arr) {\n  return Array.from(new Set(arr));\n}\n// [GIẢI THÍCH] Set khử trùng chỉ trong 1 lần duyệt.\n// 1M phần tử: ~1800ms → ~12ms.',
    outputType: 'code',
  },
  'master-marketing-planner': {
    hook: 'Kế hoạch marketing đủ giai đoạn, kênh và ngân sách',
    input: 'Sản phẩm: app học tiếng Anh · KPI: 10k lượt tải/tháng · Khách: sinh viên 18–24',
    output:
      '| Giai đoạn | Concept | Kênh | Ngân sách |\n|---|---|---|---|\n| Nhận biết | “Học Anh 15′/ngày” | TikTok, KOL sinh viên | 40% |\n| Cân nhắc | Dùng thử 7 ngày | Facebook Ads, landing | 35% |\n| Chuyển đổi | Ưu đãi năm học | Email, retarget | 25% |',
    outputType: 'text',
  },
  'master-personal-roadmap': {
    hook: 'Lộ trình từng tuần cho mục tiêu bạn theo đuổi',
    input: 'Mục tiêu: học vẽ digital từ số 0 · Thời gian: 1 giờ/ngày',
    output:
      'Tuần 1: làm quen phần mềm + luyện nét cơ bản (30′/ngày).\nTuần 2: hình khối & ánh sáng — vẽ lại 5 vật thể.\nTuần 3: màu sắc cơ bản, tô hoàn chỉnh 1 tranh đơn giản.\nTuần 4: vẽ 1 nhân vật chibi → đăng nhận góp ý.\n🎯 Cuối tháng: có 1 sản phẩm để khoe.',
    outputType: 'text',
  },
  'master-video-script': {
    hook: 'Kịch bản 60s có hook giữ chân ngay 3 giây',
    input: 'Ý tưởng: làm sao học code nhanh mà không nản?',
    output:
      '[00:00–00:03] Hình: gõ phím dồn dập. Thoại: “Học 3 tháng vẫn thấy mình gà? Không phải do bạn dốt.”\n[00:03–00:20] Thoại: “Sai lầm là học dàn trải. Chọn 1 dự án nhỏ và code mỗi ngày…”\n[00:20–00:30] CTA: “Lưu lại, bắt đầu hôm nay. Theo dõi để nhận lộ trình 30 ngày.”',
    outputType: 'video',
  },
  'master-translator': {
    hook: 'Dịch tự nhiên như bản xứ, hết mùi máy dịch',
    input: 'Ngôn ngữ đích: Tiếng Anh · Câu: “Trời hôm nay đẹp quá, đi cà phê không?”',
    output:
      '“What a lovely day — fancy grabbing a coffee?”\n\n(Thay vì bản cứng nhắc “The weather is very beautiful today, do you want to go coffee?”, bản này dùng “fancy” rất đời thường của người Anh.)',
    outputType: 'text',
  },
  'formula-role': {
    hook: 'Khung 4 bước ra prompt rõ vai trò, kỳ vọng',
    input: 'Vai trò: chuyên gia dinh dưỡng · Cần: thực đơn 7 ngày · Giới hạn: chay, < 1500 kcal/ngày',
    output:
      'Bạn là chuyên gia dinh dưỡng.\nTôi cần một thực đơn ăn chay 7 ngày.\nGiới hạn: dưới 1500 kcal/ngày, nguyên liệu dễ mua ở Việt Nam.\nKết quả: bảng theo ngày (sáng/trưa/tối) kèm calo ước tính.',
    outputType: 'text',
  },
  'formula-create': {
    hook: 'Khung sáng tạo có ví dụ mẫu để AI bám sát',
    input: 'Ngữ cảnh: ra mắt tai nghe mới · Vai: copywriter · Ví dụ: giọng Apple · Hành động: viết caption',
    output:
      'Bối cảnh: ra mắt tai nghe không dây X.\nĐóng vai copywriter cao cấp, giọng tối giản như Apple.\nViết 3 caption Instagram, mỗi caption ≤ 20 từ, kèm 1 CTA.\nTông: tinh tế, gợi cảm giác “im lặng là xa xỉ”.',
    outputType: 'text',
  },
  'formula-persona': {
    hook: 'Nội dung hợp giọng và khán giả bạn nhắm tới',
    input: 'Mục đích: bài LinkedIn kể chuyển ngành · Trình độ: mới vào nghề data · Khán giả: nhà tuyển dụng',
    output:
      'Mục đích: 1 bài LinkedIn kể hành trình chuyển sang data.\nGiọng: chân thành, không khoe mẽ.\nKhán giả: nhà tuyển dụng data junior.\nĐầu ra: bài ~150 từ, mở đầu bằng 1 câu hook, kết bằng bài học rút ra.',
    outputType: 'text',
  },
  'formula-task': {
    hook: 'Khung ngắn gọn nhất cho email, yêu cầu nhanh',
    input: 'Nhiệm vụ: viết email xin nghỉ phép · Đối tượng: quản lý · Phong cách: lịch sự, ngắn',
    output:
      'Viết email xin nghỉ phép 2 ngày gửi quản lý.\nPhong cách: lịch sự, chuyên nghiệp, dưới 120 từ.\nPhải có: lý do ngắn gọn, ngày cụ thể, phương án bàn giao công việc.',
    outputType: 'text',
  },
  'formula-chain': {
    hook: 'Chia nhỏ vấn đề để AI suy luận từng bước',
    input: 'Thách thức: doanh số shop giảm 30% · Cần: tìm nguyên nhân và cách khắc phục',
    output:
      'Thách thức: doanh số shop online giảm 30% trong 2 tháng.\nHãy làm theo:\n1) Phân tích: liệt kê nguyên nhân khả dĩ (traffic, giá, đối thủ…).\n2) Đề xuất: 3 giải pháp ưu tiên theo tác động/công sức.\n3) Tối ưu: chọn 1 giải pháp, vạch kế hoạch 2 tuần.',
    outputType: 'text',
  },
};

export interface ResolvedShowcase {
  hook?: string;
  input?: string;
  output?: string;
  outputType: ShowcaseOutputType;
  hasResult: boolean;
}

/**
 * Gộp nguồn hiển thị theo thứ tự ưu tiên: showcase tuyển chọn → outputExample sẵn có →
 * degrade (hasResult=false). Thuần để unit-test.
 */
export function getShowcase(template: Pick<PromptTemplate, 'id' | 'outputExample'>): ResolvedShowcase {
  const s = TEMPLATE_SHOWCASE[template.id];
  const oe = template.outputExample;
  const input = s?.input ?? oe?.input ?? undefined;
  const output = s?.output ?? (oe?.content ? oe.content : undefined);
  const outputType = s?.outputType ?? oe?.type ?? 'text';
  return {
    hook: s?.hook,
    input,
    output,
    outputType,
    hasResult: !!(input || output),
  };
}
