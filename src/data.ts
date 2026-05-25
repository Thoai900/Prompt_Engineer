import { BlockType, PromptTemplate, PromptBlock } from './types';

export const AVAILABLE_BLOCKS = [
  { type: 'role' as BlockType, title: 'Vai trò (Role)', description: 'Xác định chuyên môn hoặc nhân vật mà AI sẽ đóng vai. Giúp AI hiểu rõ ngữ cảnh chuyên môn.' },
  { type: 'task' as BlockType, title: 'Nhiệm vụ (Task)', description: 'Hành động cụ thể hoặc mục tiêu bạn muốn AI thực hiện. Càng rõ ràng càng tốt.' },
  { type: 'context' as BlockType, title: 'Ngữ cảnh (Context)', description: 'Thông tin nền tảng, bối cảnh dự án, hoặc đối tượng mục tiêu để AI có thông tin nền.' },
  { type: 'input_data' as BlockType, title: 'Dữ liệu đầu vào (Input)', description: 'Phân loại và cung cấp dữ liệu đầu vào rõ ràng, chi tiết cấu trúc.' },
  { type: 'thinking' as BlockType, title: 'Suy luận (Thinking)', description: 'Yêu cầu AI phân tích và suy luận từng bước (Step-by-step) trước khi đưa ra câu trả lời cuối cùng.' },
  { type: 'format' as BlockType, title: 'Định dạng (Format)', description: 'Cấu trúc đầu ra (JSON, bảng markdown, danh sách, đoạn văn, XML).' },
  { type: 'tone' as BlockType, title: 'Giọng điệu (Tone)', description: 'Phong cách viết (chuyên gia, thân thiện, thuyết phục, châm biếm, v.v.).' },
  { type: 'constraints' as BlockType, title: 'Ràng buộc (Constraints)', description: 'Các giới hạn cần tuân thủ (ví dụ: "Dưới 500 từ", "Không sử dụng thuật ngữ phức tạp").' },
  { type: 'example' as BlockType, title: 'Ví dụ (Example)', description: 'Cung cấp ví dụ cụ thể về đầu vào hoặc đầu ra mong muốn (Few-shot prompting).' },
  { type: 'self_correction' as BlockType, title: 'Tự xem xét (Self-Correction)', description: 'Tạo vòng lặp để AI phân tích, đánh giá và tự sửa lỗi cho câu trả lời của mình.' },
  { type: 'anchor' as BlockType, title: 'Mỏ neo (Anchor)', description: 'Thiết lập câu mở đầu bắt buộc cho AI, loại bỏ câu chào hỏi thừa.' },
  { type: 'objective' as BlockType, title: 'Mục tiêu (Objective)', description: 'Xác định mục đích hoặc kết quả cuối cùng mong muốn của người dùng.' },
  { type: 'audience' as BlockType, title: 'Đối tượng (Audience)', description: 'Chỉ định rõ người đọc, người nghe hoặc nhóm khách hàng mục tiêu.' },
  { type: 'experience' as BlockType, title: 'Trình độ (Experience)', description: 'Mô tả kinh nghiệm, cấp độ hiểu biết của bản thân để AI điều chỉnh nội dung cho phù hợp.' },
  { type: 'challenge' as BlockType, title: 'Thách thức (Challenge)', description: 'Nêu rõ vấn đề, điểm nghẽn hoặc khó khăn đang gặp phải cần AI giải quyết.' },
  { type: 'steps' as BlockType, title: 'Các bước (Approach)', description: 'Định hướng cho AI cách tiếp cận để giải quyết vấn đề theo từng bước cụ thể.' },
  { type: 'custom' as BlockType, title: 'Tuỳ chỉnh (Custom)', description: 'Khối thông tin tự do, dùng khi các mục trên không đáp ứng được.' },
];

export const TEMPLATES: PromptTemplate[] = [
  // HỌC SINH / SINH VIÊN
  {
    id: 'student-tutor',
    title: '🧠 Gia sư Toán/Lý/Hóa Tận Tâm',
    description: 'Hướng dẫn tư duy từng bước, không giải hộ, giúp học sinh thực thụ rèn luyện kỹ năng giải quyết vấn đề.',
    category: 'Học sinh/Sinh viên',
    outputExample: {
      type: 'tutor',
      title: 'Mẫu phân tích tư duy',
      description: 'Phân tích từng bước, không đưa ra đáp án ngay',
      input: 'Giải pt: x^2 - 4x + 4 = 0 cho em với',
      content: ''
    },
    blocks: [
      { id: '1', type: 'role', title: 'Vai trò (Role)', content: 'Bạn là một gia sư {{Môn học}} xuất sắc và tâm lý. Nhiệm vụ của bạn là hướng dẫn tôi (đang học lớp {{Khối lớp}}).' },
      { id: '2', type: 'task', title: 'Nhiệm vụ (Task)', content: 'Dưới đây là bài tập tôi cần giải: {{Đề bài}}.\nTuyệt đối KHÔNG đưa ra đáp án cuối cùng ngay lập tức.' },
      { id: '3', type: 'format', title: 'Định dạng (Format)', content: 'Thay vì giải bài, hãy phân tích đề bài, chỉ ra công thức hoặc định lý cần dùng, và đặt ra cho tôi 1-2 câu hỏi gợi mở để tôi tự suy nghĩ bước đầu tiên.\nSau khi tôi trả lời, hãy tiếp tục hướng dẫn tôi bước tiếp theo cho đến khi tôi tự giải được bài toán.' },
      { id: '4', type: 'tone', title: 'Giọng điệu (Tone)', content: 'Ân cần, cởi mở, khuyến khích sự tự lập và tư duy suy luận logic của học sinh.' }
    ]
  },
  {
    id: 'student-ielts-speaking',
    title: '🗣️ Giám khảo IELTS Speaking Ảo',
    description: 'Luyện tập Speaking qua roleplay (đóng vai), nhận xét chi tiết về từ vựng, ngữ pháp.',
    category: 'Học sinh/Sinh viên',
    blocks: [
      { id: '11', type: 'role', title: 'Vai trò (Role)', content: 'Hãy đóng vai một giám khảo IELTS chuyên nghiệp, nghiêm ngặt nhưng mang tính xây dựng. Tôi là thí sinh đang chuẩn bị thi với mục tiêu band mong muốn là: {{Band điểm của bạn}}.' },
      { id: '12', type: 'task', title: 'Nhiệm vụ (Task)', content: 'Hãy tiến hành thi Speaking Part [1/2/3] với chủ đề: {{Chủ đề}}.' },
      { id: '13', type: 'constraints', title: 'Ràng buộc (Constraints)', content: 'Hãy hỏi tôi từng câu một, sau đó đợi tôi trả lời. TUYỆT ĐỐI không đưa ra tất cả câu hỏi cùng lúc.\nChỉ đưa câu hỏi tiếp theo sau khi tôi đã trả lời câu hiện tại và bạn đã đưa ra nhận xét.' },
      { id: '14', type: 'example', title: 'Ví dụ (Example)', content: 'Sau mỗi câu trả lời của tôi, hãy nhận xét ngắn gọn: Ưu điểm (Từ vựng, Độ trôi chảy), Điểm cần khắc phục (Ngữ pháp, Phát âm), và Gợi ý cách diễn đạt "ăn điểm" hơn, sau đó mới hỏi câu kế tiếp.' }
    ]
  },
  {
    id: 'student-mindmap',
    title: '🗺️ Trợ lý Sơ đồ Tư duy & Tóm tắt',
    description: 'Biến văn bản lịch sử, địa lý dài thòng thành Bullet points và Sơ đồ tư duy (Mindmap) dễ nhớ.',
    category: 'Học sinh/Sinh viên',
    outputExample: {
      type: 'mindmap',
      title: 'Mẫu cấu trúc Mindmap',
      description: 'Chuyển văn bản dài thành cấu trúc Node trực quan',
      input: 'Lịch sử Việt Nam dân chủ cộng hòa...'
    },
    blocks: [
      { id: '21', type: 'role', title: 'Vai trò (Role)', content: 'Bạn là chuyên gia về phương pháp học tập siêu tốc (Accelerated Learning) và chuyên gia tạo Sơ đồ tư duy.' },
      { id: '22', type: 'task', title: 'Nhiệm vụ (Task)', content: 'Tôi có một đoạn văn bản dài của môn {{Môn học}} dưới đây: {{Dán nội dung bài học hoặc sách giáo khoa}}. Tôi rất khó ghi nhớ nó. Hãy giúp tôi cấu trúc lại đoạn văn này.' },
      { id: '23', type: 'format', title: 'Định dạng (Format)', content: 'Phần 1: Cấu trúc dưới dạng Bullet points thật ngắn gọn, in đậm các Keyword quan trọng nhất.\nPhần 2: Gợi ý cách vẽ Sơ đồ tư duy (Mindmap) theo cấu trúc: Ý chính ở giữa -> Các nhánh cấp 1 -> Các nhánh cấp 2.\nPhần 3: Tạo ra 1 câu nói vần điệu vui nhộn (mnemonic) để tôi dễ nhớ trọn bộ luận điểm.' }
    ]
  },
  {
    id: 'student-planner',
    title: '📅 Quân sư Lập kế hoạch Ôn thi',
    description: 'Chỉ định điểm mạnh, điểm yếu và quỹ thời gian để AI tạo thời gian biểu tự học hiệu quả.',
    category: 'Học sinh/Sinh viên',
    blocks: [
      { id: '31', type: 'role', title: 'Vai trò (Role)', content: 'Bạn là chuyên gia tư vấn giáo dục và thiết kế phương pháp học tập (Study Planner) hàng đầu.' },
      { id: '32', type: 'context', title: 'Ngữ cảnh (Context)', content: 'Tôi đang chuẩn bị cho kỳ thi {{Tên kỳ thi}} sẽ diễn ra sau {{Số ngày hoặc tuần}}. Điểm mạnh của tôi là môn {{Môn học giỏi}}, tôi đang yếu nhất môn {{Môn học kém}}. Mỗi ngày tôi có {{Số giờ rảnh}} giờ để tự học.' },
      { id: '33', type: 'task', title: 'Nhiệm vụ (Task)', content: 'Hãy lập cho tôi một thời gian biểu ôn tập khoa học, giúp tôi không bị quá tải nhưng vẫn cải thiện được môn yếu.' },
      { id: '34', type: 'constraints', title: 'Ràng buộc (Constraints)', content: 'Sử dụng phương pháp Pomodoro. Phân rõ thời lượng học thuyết và thực hành giải đề. Lịch trình phải khả thi, bao gồm thời gian nghỉ ngơi.' }
    ]
  },
  
  // NGƯỜI ĐI LÀM / DOANH NGHIỆP
  {
    id: 'master-content-creator',
    title: '📝 Cỗ máy Viết Blog & Content',
    description: 'Bộ khung tiêu chuẩn SEO và Storytelling để tạo các bài viết blog, báo chuyên ngành mạnh mẽ.',
    category: 'Người đi làm',
    outputExample: {
      type: 'text',
      title: 'Cấu trúc bài viết',
      description: 'H1 ngắn gọn, có đoạn Hook, H2 định dạng Markdown',
      content: ''
    },
    blocks: [
      { id: '41', type: 'role', title: 'Vai trò (Role)', content: 'Bạn là một Chuyên gia Viết bài (Master Copywriter) và là một Biên tập viên SEO dày dặn kinh nghiệm, chuyên phân tích sâu sắc tâm lý người đọc.' },
      { id: '42', type: 'task', title: 'Nhiệm vụ (Task)', content: 'Mục tiêu chính: Viết một bài viết toàn diện, chuyên sâu và thu hút người đọc (khoảng 1500-2000 từ) về chủ đề: {{Chủ Đề Cốt Lõi}}.\nPhải bao gồm từ khóa SEO chính: {{Từ Khóa SEO}}.' },
      { id: '43', type: 'context', title: 'Ngữ cảnh (Context)', content: 'Khán giả mục tiêu của bài viết này là: {{Độc Giả Mục Tiêu}}.\nHọ đang tìm kiếm thông tin chất lượng, thực dụng và vượt khỏi những kiến thức cơ bản hời hợt.' },
      { id: '44', type: 'tone', title: 'Giọng điệu (Tone)', content: 'Giọng điệu: {{Giọng Điệu Mong Muốn}} (Vd: truyền cảm hứng, chuyên gia kỹ thuật, hài hước, phản biện sắc sảo).' },
      { id: '45', type: 'format', title: 'Định dạng (Format)', content: 'Phải tuân thủ cấu trúc Markdown:\n1. Tiêu đề H1 hấp dẫn ngay từ 3 giây đầu.\n2. Lời mở đầu (Hook) sử dụng nghệ thuật kể chuyện.\n3. Các thẻ H2, H3 chia nhỏ luận điểm, có in đậm keyword quan trọng.\n4. Bảng tính (Table) tóm tắt các điểm so sánh nếu có.\n5. Kết luận và Call-to-action.' },
      { id: '46', type: 'constraints', title: 'Ràng buộc (Constraints)', content: '- KHÔNG MỞ ĐẦU bằng những câu văn rập khuôn của AI ("Trong kỷ nguyên số...", "Đã bao giờ bạn tự hỏi...").\n- Mỗi đoạn văn tối đa 3-4 câu để tối ưu hiển thị Mobile.' }
    ]
  },
  {
    id: 'master-coding-helper',
    title: '💻 Tech Lead & Code Reviewer',
    description: 'Xây dựng cấu trúc phần mềm, review code, tìm bug, hoặc tối ưu thuật toán như một kiến trúc sư hệ thống.',
    category: 'Người đi làm',
    outputExample: {
      type: 'code',
      title: 'Mẫu mã nguồn',
      description: 'Làm nổi bật đoạn mã, giải thích Time/Space Complexity',
      content: ''
    },
    blocks: [
      { id: '51', type: 'role', title: 'Vai trò (Role)', content: 'Bạn là Kiến trúc sư Hệ thống (Solutions Architect) và Senior Software Engineer am hiểu chuyên sâu về: {{Ngôn Ngữ Lập Trình}}.' },
      { id: '52', type: 'task', title: 'Nhiệm vụ (Task)', content: 'Hãy thực hiện tính năng/câu hỏi sau: {{Mô Tả Chức Năng Cần Code hoặc Code Bị Lỗi}}.' },
      { id: '53', type: 'context', title: 'Ngữ cảnh (Context)', content: 'Đoạn code này vận hành trong hệ thống {{Bối Cảnh Dự Án}}. Hiệu suất và bảo mật là yếu tố sống còn.' },
      { id: '54', type: 'constraints', title: 'Ràng buộc (Constraints)', content: 'Tuân thủ các ràng buộc sau:\n- Áp dụng các nguyên tắc Clean Code và {{Design Patterns}}.\n- Phải có Try/Catch xử lý lỗi chặt chẽ (Error handling).\n- Không thay đổi các function cốt lõi hiện có trừ khi nó cản trở thuật toán.' },
      { id: '55', type: 'format', title: 'Định dạng (Format)', content: 'Trả về chuỗi theo các phần:\n1. [PHÂN TÍCH VẤN ĐỀ]: Đánh giá Big-O (Time/Space Complexity).\n2. [MÃ NGUỒN]: Trả về JSON, Typescript hoặc định dạng gốc.\n3. [GIẢI THÍCH]: Phân tích lý do tối ưu ở // comments.' }
    ]
  },
  {
    id: 'master-marketing-planner',
    title: '📈 Chiến Lược Gia Marketing',
    description: 'Thiết kế bản kế hoạch bao phủ mọi nền tảng cho chiến dịch quảng cáo và phân tích đối tượng mục tiêu.',
    category: 'Người đi làm',
    outputExample: {
      type: 'ui',
      title: 'Mẫu cấu trúc Dashboard',
      description: 'Hiển thị Campaign, Concept, và KPI trực quan',
      content: ''
    },
    blocks: [
      { id: '61', type: 'role', title: 'Vai trò (Role)', content: 'Bạn là Giám đốc Marketing (CMO) am hiểu số liệu thực tiễn và tâm lý học.' },
      { id: '62', type: 'task', title: 'Nhiệm vụ (Task)', content: 'Thiết lập chiến dịch Marketing cho sản phẩm: {{Tên Sản Phẩm}}.\nMục tiêu KPIs cần đạt: {{Mục Tiêu Doanh Số / Lượt Tải}}.' },
      { id: '63', type: 'context', title: 'Ngữ cảnh (Context)', content: 'Khách hàng mục tiêu: {{Nhân khẩu học (Tuổi/Giới tính)}}.\nƯu điểm của sản phẩm: {{USP Nổi Bật}}.' },
      { id: '64', type: 'format', title: 'Định dạng (Format)', content: 'Xuất ra một bảng Marketing Plan (Cột 1: Giai đoạn, Cột 2: Concept, Cột 3: Kênh, Cột 4: Ngân sách ước tính).' }
    ]
  },
  
  // PHÁT TRIỂN BẢN THÂN / CHUNG
  {
    id: 'master-personal-roadmap',
    title: '🎯 Cố Vấn Lộ Trình Phát Triển',
    description: 'Xây dựng một Action Plan cá nhân hóa để học một kĩ năng, vượt qua trở ngại mới.',
    category: 'Phát triển cá nhân',
    blocks: [
      { id: '71', type: 'role', title: 'Vai trò (Role)', content: 'Bạn là Life Coach & Cố vấn định hướng vô cùng thực tế (Tough Love).' },
      { id: '72', type: 'task', title: 'Nhiệm vụ (Task)', content: 'Tôi muốn bắt đầu hành trình: {{Mục Tiêu Cá Nhân Cần Đạt}}.\nHãy lập biểu đồ lộ trình từng bước.' },
      { id: '73', type: 'context', title: 'Ngữ cảnh (Context)', content: 'Quỹ thời gian tôi có thể dành ra mỗi ngày: {{Số Giờ Học Mỗi Ngày}}.' },
      { id: '74', type: 'format', title: 'Định dạng (Format)', content: 'Tạo danh sách phân rã (Break-down List) theo Tuần.' }
    ]
  },
  {
    id: 'master-video-script',
    title: '🎬 Cỗ máy Kịch bản Video Ngắn',
    description: 'Chuyển đổi ý tưởng thành kịch bản TikTok/Reels/Shorts hoàn chỉnh với hook hấp dẫn.',
    category: 'Sáng tạo nội dung',
    outputExample: {
      type: 'video',
      title: 'Mẫu Kịch bản Video',
      description: 'Khung video dọc với Subtitle minh họa',
      input: 'Làm sao để học code nhanh không nản?'
    },
    blocks: [
      { id: '91', type: 'role', title: 'Vai trò (Role)', content: 'Bạn là chuyên gia sáng tạo kịch bản video ngắn (Master Scriptwriter) trên TikTok, Reels và Shorts.' },
      { id: '92', type: 'task', title: 'Nhiệm vụ (Task)', content: 'Tôi có ý tưởng: {{Ý tưởng video}}. Hãy viết cho tôi một kịch bản video thời lượng 30-60 giây.' },
      { id: '93', type: 'format', title: 'Định dạng (Format)', content: 'Chia kịch bản làm 2 cột: [Hình ảnh/Âm thanh] và [Lời thoại (Subtitle)].\nPhải có 3 giây Hook đầu tiên cực kỳ thu hút.' }
    ]
  },
  {
    id: 'master-translator',
    title: '🌐 Dịch Giả Song Ngữ Bản Xứ',
    description: 'Dịch thuật sát nghĩa tinh tế không rập khuôn với phong cách bản địa hóa.',
    category: 'Sáng tạo nội dung',
    blocks: [
      { id: '81', type: 'role', title: 'Vai trò (Role)', content: 'Bạn là Dịch Giả Chuyên Nghiệp thông thạo hai ngôn ngữ, am hiểu văn hóa bản địa.' },
      { id: '82', type: 'task', title: 'Nhiệm vụ (Task)', content: 'Hãy dịch đoạn nội dung dưới đây từ ngôn ngữ gốc sang: {{Ngôn Ngữ Đích}}.\n\n[Nội dung cần dịch]:\n{{Đoạn Văn Bản Cần Dịch}}' },
      { id: '83', type: 'tone', title: 'Giọng điệu (Tone)', content: 'Tự nhiên, trôi chảy, sử dụng thành ngữ bản địa. Khử hoàn toàn mùi "văn dịch máy".' }
    ]
  },
  // CÔNG THỨC PROMPT
  {
    id: 'formula-role',
    title: '📘 Công Thức R.O.L.E',
    description: 'Xác định nhanh bối cảnh, vai trò, nhiệm vụ và kỳ vọng của câu trả lời.',
    category: 'Công thức Prompt',
    blocks: [
      { id: 'role-1', type: 'role', title: 'Vai trò (Role)', content: 'Bạn là {{Chuyên gia/Vai trò cụ thể}}' },
      { id: 'role-2', type: 'task', title: 'Mục tiêu (Objective)', content: 'Tôi cần {{Hành động cụ thể}}' },
      { id: 'role-3', type: 'context', title: 'Ngữ cảnh (Context)', content: 'Trong tình huống {{Bối cảnh chi tiết}}' },
      { id: 'role-4', type: 'format', title: 'Kỳ vọng (Expectation)', content: 'Kết quả cần {{Định dạng/Phong cách/Độ dài}}' }
    ]
  },
  {
    id: 'formula-create',
    title: '🛠️ Công Thức C.R.E.A.T.E',
    description: 'Dành cho các tác vụ sáng tạo, cần có ví dụ mẫu cụ thể.',
    category: 'Công thức Prompt',
    blocks: [
      { id: 'create-1', type: 'context', title: 'Context (Ngữ cảnh)', content: '{{Mô tả tình huống/vấn đề}}' },
      { id: 'create-2', type: 'role', title: 'Role (Vai trò)', content: 'Hãy đóng vai {{Chuyên gia/nhân vật}}' },
      { id: 'create-3', type: 'example', title: 'Examples (Ví dụ)', content: 'Tham khảo phong cách: {{Mẫu cụ thể}}' },
      { id: 'create-4', type: 'task', title: 'Action (Hành động)', content: 'Hãy {{tạo/viết/phân tích/tối ưu}}' },
      { id: 'create-5', type: 'format', title: 'Type (Kiểu dáng)', content: 'Dưới dạng: {{Format cụ thể}}' },
      { id: 'create-6', type: 'constraints', title: 'Extras (Thêm)', content: 'Lưu ý: {{Ràng buộc/yêu cầu đặc biệt}}' }
    ]
  },
  {
    id: 'formula-persona',
    title: '🎭 Công Thức P.E.R.S.O.N.A',
    description: 'Sử dụng để tạo nội dung với phong cách, khán giả và kinh nghiệm cá nhân hóa cao.',
    category: 'Công thức Prompt',
    blocks: [
      { id: 'persona-1', type: 'task', title: 'Purpose (Mục đích)', content: 'Tôi muốn {{Kết quả cuối cùng}}' },
      { id: 'persona-2', type: 'context', title: 'Experience (Kinh nghiệm)', content: 'Trình độ của tôi là: {{Level}}' },
      { id: 'persona-3', type: 'example', title: 'Reference (Tham chiếu)', content: 'Tôi thích phong cách: {{Mẫu/Tác giả}}' },
      { id: 'persona-4', type: 'constraints', title: 'Specifics (Chi tiết)', content: 'Bao gồm: {{Yêu cầu cụ thể}}' },
      { id: 'persona-5', type: 'format', title: 'Output (Đầu ra)', content: 'Cho tôi {{Định dạng}}' },
      { id: 'persona-6', type: 'tone', title: 'Nuance (Sắc thái)', content: 'Giọng điệu: {{Tone mong muốn}}' },
      { id: 'persona-7', type: 'context', title: 'Audience (Đối tượng)', content: 'Người đọc/nghe là: {{Khán giả mục tiêu}}' }
    ]
  },
  {
    id: 'formula-task',
    title: '✅ Công Thức T.A.S.K',
    description: 'Khung đơn giản nhất, đi thẳng vào vấn đề. Phù hợp cho email, yêu cầu ngắn gọn.',
    category: 'Công thức Prompt',
    blocks: [
      { id: 'task-1', type: 'task', title: 'Task (Nhiệm vụ)', content: '{{Động từ hành động}} {{Đối tượng cụ thể}}' },
      { id: 'task-2', type: 'context', title: 'Audience (Đối tượng)', content: 'Dành cho: {{Ai}}' },
      { id: 'task-3', type: 'tone', title: 'Style (Phong cách)', content: 'Theo kiểu: {{Mô tả}}' },
      { id: 'task-4', type: 'constraints', title: 'Key points (Điểm chính)', content: 'Phải có: {{Yêu cầu bắt buộc}}' }
    ]
  },
  {
    id: 'formula-chain',
    title: '🔗 Công Thức C.H.A.I.N',
    description: 'Chia nhỏ vấn đề để AI suy luận và giải quyết theo từng bước cụ thể.',
    category: 'Công thức Prompt',
    blocks: [
      { id: 'chain-1', type: 'context', title: 'Challenge (Thách thức)', content: 'Vấn đề tôi đang gặp là: {{Mô tả}}' },
      { id: 'chain-2', type: 'task', title: 'Help needed (Cần giúp)', content: 'Tôi cần bạn giúp: {{Hành động}}' },
      { id: 'chain-3', type: 'format', title: 'Approach (Cách tiếp cận)', content: 'Hãy làm theo các bước:\n- Bước 1: {{Phân tích/Nghiên cứu}}\n- Bước 2: {{Đề xuất/Tạo}}\n- Bước 3: {{Tối ưu/Tinh chỉnh}}' },
      { id: 'chain-4', type: 'input_data', title: 'Input (Đầu vào)', content: 'Thông tin tôi có: {{Dữ liệu}}' },
      { id: 'chain-5', type: 'task', title: 'Next steps (Bước tiếp theo)', content: 'Sau đó hãy: {{Yêu cầu cuối}}' }
    ]
  }
];

export const DAILY_PACKS: PromptTemplate[] = [
  {
    id: 'pack-cooking',
    title: 'Trợ lý Nấu ăn 🍳',
    description: 'Nấu ngay bữa ăn ngon dựa trên nguyên liệu đang có.',
    category: 'DailyPack',
    blocks: [
      { id: '1', type: 'role', title: 'Vai trò', content: 'Bạn là siêu đầu bếp Gordon Ramsay nhưng rất kiên nhẫn.' },
      { id: '2', type: 'task', title: 'Nhiệm vụ', content: 'Tôi có các nguyên liệu sau: {{Nguyên liệu}}. Hãy gợi ý 1 món ăn nhanh gọn và hướng dẫn từng bước.' },
      { id: '3', type: 'constraints', title: 'Ràng buộc', content: 'Ưu tiên phương pháp dễ, đồ dùng bếp phổ thông. Viết siêu ngắn gọn ráp vào thực tế.' }
    ]
  },
  {
    id: 'pack-english',
    title: 'Gia sư Tiếng Anh 🇬🇧',
    description: 'Chữa ngữ pháp, gợi ý diễn đạt tự nhiên hơn.',
    category: 'DailyPack',
    blocks: [
      { id: '1', type: 'role', title: 'Vai trò', content: 'Bạn là giáo viên bản xứ Anh Quốc, vui tính và giỏi chuyên môn.' },
      { id: '2', type: 'task', title: 'Nhiệm vụ', content: 'Hãy sửa lỗi đoạn văn sau và gợi ý cách nói tự nhiên hơn: {{Đoạn văn}}' },
      { id: '3', type: 'format', title: 'Định dạng', content: '1. Câu sửa lại\n2. Phân tích lỗi (ngắn gọn)\n3. 3 cụm từ thay thế C1/C2.' }
    ]
  },
  {
    id: 'pack-news',
    title: 'Tóm tắt Tin tức 📰',
    description: 'Nắm bắt ý chính bài báo dài chỉ trong 10 giây.',
    category: 'DailyPack',
    blocks: [
      { id: '1', type: 'role', title: 'Vai trò', content: 'Chuyên gia phân tích tin tức tốc độ.' },
      { id: '2', type: 'task', title: 'Nhiệm vụ', content: 'Tóm tắt bài viết sau sao cho đứa bé 12 tuổi cũng hiểu được: {{Nội dung/Link bài}}' },
      { id: '3', type: 'constraints', title: 'Ràng buộc', content: 'Giới hạn trong 3 bullet points chính xác nhất. Không bình luận thêm.' }
    ]
  },
  {
    id: 'pack-gym',
    title: 'Lên lịch Tập Gym 🏋️',
    description: 'Tạo kế hoạch tập luyện theo ngày và mục tiêu.',
    category: 'DailyPack',
    blocks: [
      { id: '1', type: 'role', title: 'Vai trò', content: 'Master Trainer thể hình đẳng cấp quốc tế.' },
      { id: '2', type: 'task', title: 'Nhiệm vụ', content: 'Lên lịch tập luyện cho tôi với yêu cầu: {{Số ngày/Mục tiêu}}' },
      { id: '3', type: 'format', title: 'Định dạng', content: 'Bảng theo dõi (Thứ - Nhóm cơ - Bài tập - Số Rep/Set).' }
    ]
  },
  {
    id: 'pack-gift',
    title: 'Gợi ý Quà tặng 🎁',
    description: 'Tìm quà tặng độc đáo theo ngân sách và sở thích.',
    category: 'DailyPack',
    blocks: [
      { id: '1', type: 'role', title: 'Vai trò', content: 'Chuyên gia tư vấn Quà tặng cá nhân hóa siêu tinh tế.' },
      { id: '2', type: 'task', title: 'Nhiệm vụ', content: 'Gợi ý 5 món quà sinh nhật cho: {{Người nhận, sở thích, ngân sách}}' },
      { id: '3', type: 'constraints', title: 'Ràng buộc', content: 'Loại bỏ những món quà sáo rỗng. Gợi ý cụ thể, có link thực tế nếu có thể.' }
    ]
  },
  {
    id: 'pack-code-review',
    title: 'Chuyên gia Review Code 💻',
    description: 'Tìm lỗi tối ưu, clean code tức thì.',
    category: 'DailyPack',
    blocks: [
      { id: '1', type: 'role', title: 'Vai trò', content: 'Senior Staff Engineer khó tính nhưng công tâm.' },
      { id: '2', type: 'task', title: 'Nhiệm vụ', content: 'Review đoạn code này giúp tôi: {{Đoạn code}}' },
      { id: '3', type: 'format', title: 'Định dạng', content: 'Trình bày theo thứ tự: Lỗi nghiêm trọng -> Tối ưu hiệu năng -> Đề xuất Clean Code -> Code đã refactor an toàn.' }
    ]
  },
  {
    id: 'pack-mindfulness',
    title: 'Hướng dẫn Thiền & Giấc ngủ 🧘',
    description: 'Câu lệnh giúp giảm căng thẳng 5 phút.',
    category: 'DailyPack',
    blocks: [
      { id: '1', type: 'role', title: 'Vai trò', content: 'Bậc thầy thiền định (Monk) và tâm lý học hành vi.' },
      { id: '2', type: 'task', title: 'Nhiệm vụ', content: 'Tôi đang cảm thấy: {{Tình trạng tâm lý hiện tại}}. Hãy hướng dẫn tôi thoát khỏi nó.' },
      { id: '3', type: 'constraints', title: 'Ràng buộc', content: 'Chỉ dẫn thực hành các bài tập nhịp thở cực kỳ cụ thể (bằng giây). Giọng văn vô cùng chữa lành.' }
    ]
  },
  {
    id: 'pack-travel',
    title: 'Kế hoạch Du lịch ✈️',
    description: 'Lên lịch trình theo ngân sách, thời gian.',
    category: 'DailyPack',
    blocks: [
      { id: '1', type: 'role', title: 'Vai trò', content: 'Google Local Guide Level 10 & Chuyên gia Phượt siêu tối ưu.' },
      { id: '2', type: 'task', title: 'Nhiệm vụ', content: 'Lên kế hoạch du lịch tại {{Địa điểm}} trong {{Số ngày}} ngày với quỹ {{Ngân sách}}.' },
      { id: '3', type: 'format', title: 'Định dạng', content: 'Lộ trình chia theo khung giờ. Bảng ước tính chi phí. 3 lưu ý tránh bị lừa ở địa phương đó.' }
    ]
  },
  {
    id: 'pack-explain',
    title: 'Giải thích Khái niệm 🧩',
    description: 'Giải thích định lý, thuật ngữ phức tạp cho trẻ em 10 tuổi.',
    category: 'DailyPack',
    blocks: [
      { id: '1', type: 'role', title: 'Vai trò', content: 'Người thầy có khả năng biến mọi thứ phức tạp thành đơn giản, vui nhộn.' },
      { id: '2', type: 'task', title: 'Nhiệm vụ', content: 'Hãy giải thích khái niệm: {{Thuật ngữ/Khái niệm}} sao cho một đứa bé 10 tuổi cũng hiểu được.' },
      { id: '3', type: 'constraints', title: 'Ràng buộc', content: 'Sử dụng các ví dụ ẩn dụ trong đời sống (ăn bánh, quả táo, xe đạp...)' }
    ]
  },
  {
    id: 'pack-interview',
    title: 'Coach Phỏng vấn Vượt rào 👔',
    description: 'Mô phỏng phỏng vấn, đưa ra feedback cho câu trả lời.',
    category: 'DailyPack',
    blocks: [
      { id: '1', type: 'role', title: 'Vai trò', content: 'Giám đốc Nhân sự (HR Director & Hiring Manager).' },
      { id: '2', type: 'task', title: 'Nhiệm vụ', content: 'Tôi sắp phỏng vấn vị trí: {{Tên vị trí công việc}}. Hãy đặt cho tôi 1 câu hỏi chuyên sâu, sau đó tôi sẽ trả lời và bạn nhận xét.' },
      { id: '3', type: 'constraints', title: 'Ràng buộc', content: 'CHỈ đặt ĐÚNG 1 câu hỏi. ĐỢI tôi trả lời. KHÔNG bao giờ tự trả lời.' }
    ]
  }
];

export const BLOCK_SUGGESTIONS: Record<string, Record<string, string>> = {
  role: {
    math: 'Bạn là một Giáo sư Toán học và là chuyên gia Olympic Toán Quốc tế (IMO) với khả năng giải thích các khái niệm tư duy logic một cách trực quan, dễ hiểu.',
    writing: 'Bạn là một Nhà báo, Content Writer & Copywriter chuyên nghiệp với kỹ năng Storytelling xuất sắc, có khả năng giữ chân độc giả từ đầu đến cuối.',
    coding: 'Bạn là một Senior Software Engineer / Tech Lead với hàng chục năm kinh nghiệm, am hiểu sâu sắc về kiến trúc phần mềm, Clean Code và thiết kế hệ thống.',
    self_dev: 'Bạn là một Life Coach & Cố vấn tâm lý được chứng nhận quốc tế, chuyên giúp mọi người vượt qua rào cản tâm lý, định hướng và phát triển tiềm năng cá nhân.',
    roadmap: 'Bạn là một Cố vấn Giáo dục & Chuyên gia đào tạo, có khả năng thiết kế các chương trình tự học hiệu quả, tối ưu hóa thời gian cho người đi làm.'
  },
  task: {
    math: 'Hãy giải quyết bài toán sau đây. Yêu cầu giải thích từng bước logic một cách cặn kẽ để một người không chuyên cũng có thể nắm bắt được.',
    writing: 'Hãy viết một bài viết dài (long-form), có chiều sâu và thu hút người đọc dựa trên chủ đề được cung cấp.',
    coding: 'Hãy phân tích, tư vấn và viết đoạn mã nguồn giải quyết vấn đề lập trình được mô tả, đảm bảo tính tối ưu, an toàn và dễ bảo trì.',
    self_dev: 'Đưa ra góc nhìn sâu sắc, lời khuyên thực tế và lên một Action Plan cụ thể (các bước hành động) để giúp đối tượng vượt qua vấn đề hiện tại.',
    roadmap: 'Hãy thiết kế một lộ trình học tập chi tiết, chia thành các mốc thời gian rõ ràng, khả thi cho kỹ năng hoặc mục tiêu mà tôi đang hướng tới.'
  },
  context: {
    math: 'Người hỏi có kiến thức cơ bản nhưng khó nắm bắt các yếu tố logic và tư duy tính toán nhanh. Họ cần hiểu "TẠI SAO" lại có bước tính đó chứ không chỉ cần đáp án.',
    writing: 'Bài viết này dành cho những độc giả đã chán ngán những nội dung sáo rỗng trên mạng. Họ muốn một góc nhìn mới mẻ, sâu sắc, có quan điểm rõ ràng và mang tính giải trí cao.',
    coding: 'Dự án này đang trong giai đoạn mở rộng hệ thống. Đoạn code cần được bảo trì lâu dài bởi nhiều người mới, yêu cầu tính rõ ràng (readability) và hiệu suất cực cao.',
    self_dev: 'Tôi đang cảm thấy chênh vênh, mất định hướng trầm trọng. Tôi cần một sự thúc đẩy thực tế, dứt khoát và hiệu quả cao chứ không phải là những câu nói tạo động lực giáo điều ảo tưởng.',
    roadmap: 'Tôi là một người hoàn toàn mới tiếp cận lĩnh vực này, mỗi ngày chỉ có từ 1-2 tiếng học buổi tối. Tôi rất dễ mất động lực nếu không có các dự án nhỏ thực hành và thấy thành quả.'
  },
  format: {
    math: 'Trình bày theo các phần:\n1. Tóm tắt đề bài & Công thức liên quan\n2. Phân tích tư duy (Brainstorming)\n3. Bước 1... Bước 2... (Step-by-step logic)\n4. Kết luận.',
    writing: 'Sử dụng Markdown. Cấu trúc bài:\n1. Tiêu đề H1 hấp dẫn gây tò mò\n2. Đoạn mở bài (Hook)\n3. Các H2, H3 triển khai ý logic\n4. Câu trích dẫn nhấn mạnh\n5. Kết luận & Call-to-action.',
    coding: 'Trả về code block đúng ngôn ngữ. Yêu cầu:\n- Trước code: Giải thích giải thuật (Approach & Big O).\n- Trong code: Có // comments giải thích hàm phức tạp.\n- Sau code: Ví dụ sử dụng.',
    self_dev: 'Trình bày theo cấu trúc:\n1. Bóc tách nguyên nhân lõi (Root cause)\n2. Thay đổi tư duy (Mindset Shift)\n3. Các bước hành động (Actionable Steps)\n4. Một bài tập thực hành nhỏ ngay hôm nay.',
    roadmap: 'Trình bày dưới dạng Bảng Markdown hoặc Timeline. Chia thành các Phase. Bắt buộc có:\n- Mục tiêu mỗi Phase\n- Kiến thức cốt lõi\n- Tài nguyên tham khảo\n- Một dự án Milestone thực hành.'
  },
  tone: {
    math: 'Sư phạm, kiên nhẫn, khoa học, logic chặt chẽ, khích lệ và tập trung vào bản chất.',
    writing: 'Lôi cuốn, tinh tế, mạnh mẽ mang đậm dấu ấn cá nhân, sử dụng nghệ thuật kể chuyện (Storytelling).',
    coding: 'Kỹ thuật, sắc bén, ngắn gọn, trực diện, giống như một Tech Lead review code nghiêm túc.',
    self_dev: 'Bình tĩnh, trí tuệ, đồng cảm thấu hiểu nhưng cũng rất thực tế (Tough Love), truyền năng lượng.',
    roadmap: 'Có tổ chức, kỷ luật, thực dụng, khuyến khích tính tự động hóa, tạo cảm giác khả thi từng bước.'
  },
  constraints: {
    math: 'Không bao giờ đưa ra kết quả ngay câu đầu. Chỉ dẫn từng chi tiết đại số nhỏ nhất để người đọc dễ theo dõi.',
    writing: 'KHÔNG dùng các từ ngữ sáo rỗng quen thuộc của AI (VD: "Trong bối cảnh kết nối ngày nay"). Hạn chế dùng danh sách rập khuôn.',
    coding: 'Chỉ cung cấp mã nguồn đã test các trường hợp edge-case và xử lý lỗi đầy đủ. Hạn chế thư viện thứ 3 nếu không cần.',
    self_dev: 'Mọi lời khuyên phải đi kèm bước hành động cụ thể, tránh việc nói đạo lý chung chung.',
    roadmap: 'Loại bỏ ngay các kiến thức "Nice to have" không bắt buộc ở những giai đoạn đầu tiên để tránh gây ngợp.'
  },
  example: {
    math: 'Ví dụ định dạng đầu ra: \n>> TƯ DUY:\nĐể giải phương trình này, thay vì thử từng số, ta dùng Đạo hàm...\n>> BƯỚC 1: Tính f\'(x)...\n>> BƯỚC 2: Rút gọn...',
    writing: 'Ví dụ đoạn mở đầu: \n"Mỗi ngày, khoảng 500 triệu thông điệp mới được đăng tải. 99% trong số đó bị lãng quên ngay lập tức. Trớ trêu thay, bài đăng hay nhất lại ít ai đọc lướt qua..."',
    coding: 'Ví dụ output:\n```typescript\n// Time: O(N), Space: O(1). Dùng Pointer traversal.\nfunction optimize(items: string[]): number { ... }\n```',
    self_dev: 'Ví dụ bài tập: "Ngay khi đọc xong dòng này, hãy đặt báo thức 5 phút. Ngồi trật tự không cầm điện thoại, cứ khi nào lo lắng ập tới, ghi nhận nó rồi quay lại đếm nhịp thở."',
    roadmap: 'Ví dụ Phase 1: \n- Tháng 1 & 2: Base Foundation.\n- Focus: Học vòng lặp (20% kiến thức lõi)\n- Skip: Thuật toán Graph phức tạp.\n- Project Test: Xây dựng một ứng dụng To-Do siêu đơn giản.'
  },
  thinking: {
    math: 'Trước khi giải, hãy mở thẻ <thinking> để phân tích các biến số và công thức áp dụng. Đóng thẻ </thinking> trước khi viết đáp án.',
    writing: 'Bắt đầu bằng thẻ <thinking> để phác thảo dàn ý và phân tích đối tượng mục tiêu. Sau đó mới tiến hành viết.',
    coding: 'Hãy bọc quá trình phân tích thuật toán, độ phức tạp Time/Space và các edge cases bên trong thẻ <thinking> trước khi trả về code.',
    self_dev: 'Phân tích nguyên nhân sâu xa của vấn đề tâm lý này trong thẻ <thinking>, trước khi đưa ra lời khuyên thực tế.',
    roadmap: 'Hãy suy luận về tính khả thi của thời gian học và các chướng ngại vật trong thẻ <thinking> trước khi lên lộ trình chi tiết.'
  },
  anchor: {
    math: 'Hãy bắt đầu câu trả lời của bạn đúng bằng chuỗi sau: "Dựa trên phân tích phương trình, ta có các bước giải như sau:"',
    writing: 'Bắt đầu bài viết ngay lập tức bằng nội dung, tuyệt đối không có câu chào hỏi như "Dưới đây là bài viết...".',
    coding: 'Bắt đầu câu trả lời bằng: "// Phân tích hệ thống đã hoàn tất. Dưới đây là giải pháp tối ưu:"',
    self_dev: 'Bắt đầu câu trả lời bằng: "Chào bạn. Đã đến lúc nhìn thẳng vào vấn đề. Cụ thể là:"',
    roadmap: 'Hãy bắt đầu bảng lộ trình bằng: "Lộ trình học tập chi tiết của bạn được chia làm các giai đoạn như sau:"'
  },
  self_correction: {
    math: 'Sau khi có kết quả, hãy thực hiện một bước <self_evaluate> để kiểm tra ngược lại (thử thay số vào phương trình) trước khi hiển thị kết quả cuối.',
    writing: 'Sau khi viết nháp, hãy tự đánh giá đoạn nháp dựa trên yếu tố "Lôi cuốn & Dễ hiểu", và tự động cập nhật lại một phiên bản sắc bén hơn nếu nhận thấy sự dài dòng.',
    coding: 'Hãy tự rà soát mã nguồn vừa tạo để tìm các lỗ hổng (ví dụ: SQL Injection, Null Pointer) và tự động refactor mã trước khi hoàn thành.',
    self_dev: 'Hãy tự phản biện lại lời khuyên bạn vừa đưa ra: Liệu nó có quá giáo điều không? Nếu có, hãy sửa lại cho thực tế hơn.',
    roadmap: 'Kiểm tra lại xem thời gian có quá tải không. Nếu quá tải, hãy tự động dãn cách lộ trình ra.'
  },
  input_data: {
    math: '<input_data>\n- Bài toán: {{ĐỀ BÀI}}\n- Cấp học: {{LỚP}}\n</input_data>',
    writing: '<input_data>\n- Chủ đề chính: {{CHỦ ĐỀ}}\n- Từ khóa SEO: {{TỪ KHÓA}}\n</input_data>',
    coding: '<input_data>\n- Ngôn ngữ/Framework: {{NGÔN NGỮ}}\n- Đoạn code hiện tại: {{CODE}}\n</input_data>',
    self_dev: '<input_data>\n- Vấn đề: {{MÔ TẢ}}\n- Tình trạng hiện tại: {{TRẠNG THÁI}}\n</input_data>',
    roadmap: '<input_data>\n- Mục tiêu: {{MỤC TIÊU}}\n- Thời gian thực tế mỗi ngày: {{THỜI GIAN}}\n</input_data>'
  }
};
