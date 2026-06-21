import React from 'react';
import { 
  User, Briefcase, Pin, Upload, Brain, Layers, Smile, Shield, Copy, Plus 
} from 'lucide-react';

export const TYPE_STYLES: Record<string, { badge: string, border: string }> = {
  role: { badge: 'text-blue-300 bg-blue-500/10 ring-blue-500/20 border-blue-500/30', border: 'border-l-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.05)]' },
  task: { badge: 'text-violet-300 bg-violet-500/10 ring-violet-500/20 border-violet-500/30', border: 'border-l-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.05)]' },
  context: { badge: 'text-emerald-300 bg-emerald-500/10 ring-emerald-500/20 border-emerald-500/30', border: 'border-l-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.05)]' },
  input_data: { badge: 'text-indigo-300 bg-indigo-500/10 ring-indigo-500/20 border-indigo-500/30', border: 'border-l-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.05)]' },
  thinking: { badge: 'text-amber-300 bg-amber-500/10 ring-amber-500/20 border-amber-500/30', border: 'border-l-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.05)]' },
  format: { badge: 'text-purple-300 bg-purple-500/10 ring-purple-500/20 border-purple-500/30', border: 'border-l-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.05)]' },
  tone: { badge: 'text-pink-300 bg-pink-500/10 ring-pink-500/20 border-pink-500/30', border: 'border-l-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.05)]' },
  constraints: { badge: 'text-rose-300 bg-rose-500/10 ring-rose-500/20 border-rose-500/30', border: 'border-l-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.05)]' },
  example: { badge: 'text-cyan-300 bg-cyan-500/10 ring-cyan-500/20 border-cyan-500/30', border: 'border-l-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.05)]' },
  self_correction: { badge: 'text-teal-300 bg-teal-500/10 ring-teal-500/20 border-teal-500/30', border: 'border-l-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.05)]' },
  anchor: { badge: 'text-sky-300 bg-sky-500/10 ring-sky-500/20 border-sky-500/30', border: 'border-l-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.05)]' },
  objective: { badge: 'text-rose-300 bg-rose-500/10 ring-rose-500/20 border-rose-500/30', border: 'border-l-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.05)]' },
  audience: { badge: 'text-amber-300 bg-amber-500/10 ring-amber-500/20 border-amber-500/30', border: 'border-l-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.05)]' },
  experience: { badge: 'text-lime-300 bg-lime-500/10 ring-lime-500/20 border-lime-500/30', border: 'border-l-lime-500 shadow-[0_0_10px_rgba(132,204,22,0.05)]' },
  challenge: { badge: 'text-red-300 bg-red-500/10 ring-red-500/20 border-red-500/30', border: 'border-l-red-500 shadow-[0_0_10px_rgba(239,68,68,0.05)]' },
  steps: { badge: 'text-emerald-300 bg-emerald-500/10 ring-emerald-500/20 border-emerald-500/30', border: 'border-l-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.05)]' },
  custom: { badge: 'text-slate-300 bg-slate-500/10 ring-slate-500/20 border-slate-700/30', border: 'border-l-slate-400 shadow-[0_0_10px_rgba(100,116,139,0.05)]' },
};

export const BLOCK_ICONS: Record<string, React.ReactNode> = {
  role: React.createElement(User, { size: 16 }),
  task: React.createElement(Briefcase, { size: 16 }),
  context: React.createElement(Pin, { size: 16 }),
  input_data: React.createElement(Upload, { size: 16 }),
  thinking: React.createElement(Brain, { size: 16 }),
  format: React.createElement(Layers, { size: 16 }),
  tone: React.createElement(Smile, { size: 16 }),
  constraints: React.createElement(Shield, { size: 16 }),
  example: React.createElement(Copy, { size: 16 }),
  custom: React.createElement(Plus, { size: 16 }),
};

export const SMART_PRESETS: Record<string, { label: string; action: string }[]> = {
  role: [
    { label: "🎭 Tăng tính chuyên gia", action: "Đóng vai chuyên gia đầu ngành có tư duy sâu rộng, sử dụng thuật ngữ chuyên môn chính xác" },
    { label: "⚖️ Đóng vai phản biện", action: "Đóng vai một người phản biện nghiêm túc, luôn đặt ra các câu hỏi khó và thử thách giả định" },
    { label: "🍃 Giọng văn trung lập", action: "Đóng vai nhà nghiên cứu khách quan, trình bày thông tin không thiên vị" },
  ],
  task: [
    { label: "🎯 Chi tiết hóa hành động", action: "Mô tả chi tiết từng bước hành động cụ thể, làm rõ các công việc nhỏ cần làm" },
    { label: "🔍 Đơn giản hóa nhiệm vụ", action: "Tóm gọn nhiệm vụ cốt lõi, loại bỏ các chi tiết thừa thãi để tập trung vào mục tiêu chính" },
    { label: "📍 Bổ sung mục tiêu phụ", action: "Xác định và bổ sung thêm các mục tiêu phụ quan trọng giúp hoàn thành tốt nhiệm vụ chính" },
  ],
  context: [
    { label: "📌 Mở rộng bối cảnh", action: "Mở rộng và bổ sung thêm các giả định thực tế, môi trường xung quanh và thông tin nền phong phú" },
    { label: "🎓 Hướng tới học tập", action: "Tập trung bối cảnh vào giảng dạy, tự học, tiếp thu kiến thức cho học sinh cấp 3" },
    { label: "✂️ Lược bỏ chi tiết thừa", action: "Tinh lọc bối cảnh ngắn gọn, chỉ giữ lại những thông số ảnh hưởng trực tiếp đến kết quả" },
  ],
  constraints: [
    { label: "🚫 Quy tắc từ cấm", action: "Thêm danh sách các quy tắc cấm sử dụng từ ngữ sáo rỗng, rườm rà, lặp ý hoặc văn phong học thuật quá đà" },
    { label: "🛡️ Chống ảo giác (Anti-hallucination)", action: "Thêm ràng buộc yêu cầu AI chỉ trả lời dựa trên thông tin chính xác, nói 'không biết' nếu thiếu dữ liệu" },
    { label: "🇻🇳 Viết bằng Tiếng Việt", action: "Ràng buộc đầu ra bắt buộc phải viết hoàn toàn bằng tiếng Việt tự nhiên và chuẩn ngữ pháp" },
  ],
  format: [
    { label: "📊 Chuyển sang Markdown Table", action: "Chuyển cấu trúc kết quả đầu ra thành bảng Markdown có tiêu đề rõ ràng" },
    { label: "📋 Định dạng Bullet Points", action: "Định dạng kết quả đầu ra dưới dạng danh sách gạch đầu dòng phân lớp rõ ràng" },
    { label: "💻 Kết xuất dạng JSON", action: "Định dạng kết quả đầu ra dưới dạng JSON object có cấu trúc mẫu cụ thể" },
  ],
  example: [
    { label: "💡 Thêm ví dụ thực tế", action: "Thêm một ví dụ cụ thể, thực tế minh họa cho cách triển khai mong muốn" },
    { label: "❌ Thêm ví dụ phản diện", action: "Thêm một ví dụ không nên làm (Negative Example) để giúp AI tránh sai sót" },
  ],
  thinking: [
    { label: "🧠 Chain-of-Thought", action: "Yêu cầu suy nghĩ sâu sắc bằng cách phân tích lý do logic trước khi trả lời" },
    { label: "👣 Suy nghĩ từng bước", action: "Thêm hướng dẫn chi tiết yêu cầu giải quyết bài toán theo từng bước nhỏ độc lập" },
    { label: "⚙️ Tự kiểm lỗi logic", action: "Thêm bước tự kiểm tra và phản biện lại kết quả trước khi đưa ra câu trả lời cuối cùng" },
  ],
};

export const DEFAULT_SMART_PRESETS = [
  { label: "✨ Tối ưu hóa hành văn", action: "Chỉnh sửa lại câu từ cho mượt mà, lưu loát, chuyên nghiệp hơn mà không đổi ý nghĩa" },
  { label: "✍️ Sửa lỗi ngữ pháp", action: "Kiểm tra và khắc phục tất cả lỗi chính tả, ngữ pháp hoặc cấu trúc câu tiếng Việt" },
];

export const DEFAULT_FRAMEWORKS = [
  { 
    id: 'role', 
    name: 'R.O.L.E Framework', 
    blocks: [
      { type: 'role', title: 'Vai trò (Role)', content: 'Bạn là {{Chuyên gia/Vai trò cụ thể}}' },
      { type: 'objective', title: 'Mục tiêu (Objective)', content: 'Tôi cần {{Hành động cụ thể}}' },
      { type: 'constraints', title: 'Giới hạn (Limits)', content: 'Với các giới hạn hoặc ràng buộc: {{Các ràng buộc/giới hạn}}' },
      { type: 'format', title: 'Kỳ vọng (Expectation)', content: 'Kết quả cần {{Định dạng/Phong cách/Độ dài}}' }
    ] 
  },
  { 
    id: 'create', 
    name: 'C.R.E.A.T.E Framework', 
    blocks: [
      { type: 'context', title: 'Context (Ngữ cảnh)', content: '{{Mô tả tình huống/vấn đề}}' },
      { type: 'role', title: 'Role (Vai trò)', content: 'Hãy đóng vai {{Chuyên gia/nhân vật}}' },
      { type: 'example', title: 'Examples (Ví dụ)', content: 'Tham khảo phong cách {{Mẫu cụ thể}}' },
      { type: 'objective', title: 'Action (Hành động)', content: 'Hãy {{tạo/viết/phân tích/tối ưu}}' },
      { type: 'format', title: 'Type (Kiểu dáng)', content: 'Dưới dạng {{Format cụ thể}}' },
      { type: 'constraints', title: 'Extras (Thêm)', content: 'Lưu ý {{Ràng buộc/yêu cầu đặc biệt}}' }
    ] 
  },
  { 
    id: 'persona', 
    name: 'P.E.R.S.O.N.A Framework', 
    blocks: [
      { type: 'objective', title: 'Purpose (Mục đích)', content: 'Tôi muốn {{Kết quả cuối cùng}}' },
      { type: 'experience', title: 'Experience (Kinh nghiệm)', content: 'Trình độ của tôi là {{Level}}' },
      { type: 'example', title: 'Reference (Tham chiếu)', content: 'Tôi thích phong cách {{Mẫu/Tác giả}}' },
      { type: 'constraints', title: 'Specifics (Chi tiết)', content: 'Bao gồm {{Yêu cầu cụ thể}}' },
      { type: 'format', title: 'Output (Đầu ra)', content: 'Cho tôi {{Định dạng}}' },
      { type: 'tone', title: 'Nuance (Sắc thái)', content: 'Giọng điệu {{Tone mong muốn}}' },
      { type: 'audience', title: 'Audience (Đối tượng)', content: 'Người đọc/nghe là {{Ai}}' }
    ] 
  },
  { 
    id: 'task_fw', 
    name: 'T.A.S.K Framework', 
    blocks: [
      { type: 'task', title: 'Task (Nhiệm vụ)', content: 'Hãy thực hiện: {{Chi tiết công việc}}' },
      { type: 'context', title: 'Action Context (Bối cảnh)', content: 'Trong bối cảnh: {{Bối cảnh cụ thể}}' },
      { type: 'constraints', title: 'Standards (Tiêu chuẩn)', content: 'Tuân thủ tiêu chuẩn: {{Các tiêu chuẩn}}' },
      { type: 'input_data', title: 'Key Data (Dữ liệu đầu vào)', content: 'Dữ liệu sử dụng: {{Dữ liệu đầu vào}}' }
    ] 
  },
  { 
    id: 'race', 
    name: 'RACE Framework', 
    blocks: [
      { type: 'role', title: 'Role (Vai trò)', content: 'Hãy đóng vai {{Vai trò}}' },
      { type: 'task', title: 'Action (Nhiệm vụ)', content: 'Hãy thực hiện {{Hành động}}' },
      { type: 'context', title: 'Context (Ngữ cảnh)', content: 'Trong bối cảnh {{Bối cảnh}}' },
      { type: 'format', title: 'Expectation (Kỳ vọng)', content: 'Kết quả kỳ vọng {{Kết quả}}' }
    ] 
  },
];
