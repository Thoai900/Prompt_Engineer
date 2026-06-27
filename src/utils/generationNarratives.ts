import type { LucideIcon } from 'lucide-react';
import {
  BookOpen, PencilLine, Wand2, Stethoscope, ClipboardList, CheckCircle2,
  Search, LayoutGrid, RefreshCw, UserCog, Lightbulb, ListChecks,
  ScrollText, Drama, MessageSquareText, Scissors, Layers, ArrowUpCircle,
  Network, Play, Combine, Radar, Filter, Newspaper,
} from 'lucide-react';

export type GenerationFlowKey =
  | 'block-assist'
  | 'doctor-fix'
  | 'quick-fill'
  | 'variable-fill'
  | 'playground-sim'
  | 'enhancer'
  | 'chain-sim'
  | 'ai-news';

export type NarrativeAccent =
  | 'violet' | 'emerald' | 'cyan' | 'blue' | 'indigo' | 'amber' | 'rose' | 'teal';

export interface NarrationStep {
  icon: LucideIcon;
  label: string;
  hint?: string;
  /** Thời lượng hiển thị bước (ms). Mặc định ~1500ms khi không khai báo. */
  durationMs?: number;
}

export interface NarrativeScript {
  accent: NarrativeAccent;
  steps: NarrationStep[];
}

/** Lớp class Tailwind tĩnh theo accent (an toàn với JIT — không nội suy chuỗi class động). */
export interface AccentClasses {
  text: string;
  bg: string;
  border: string;
  bar: string;
  glow: string;
}

export const ACCENT_CLASSES: Record<NarrativeAccent, AccentClasses> = {
  violet:  { text: 'text-violet-600 dark:text-violet-400',   bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  bar: 'bg-violet-500',  glow: 'shadow-violet-500/20' },
  emerald: { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', bar: 'bg-emerald-500', glow: 'shadow-emerald-500/20' },
  cyan:    { text: 'text-cyan-600 dark:text-cyan-400',       bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20',    bar: 'bg-cyan-500',    glow: 'shadow-cyan-500/20' },
  blue:    { text: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    bar: 'bg-blue-500',    glow: 'shadow-blue-500/20' },
  indigo:  { text: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  bar: 'bg-indigo-500',  glow: 'shadow-indigo-500/20' },
  amber:   { text: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   bar: 'bg-amber-500',   glow: 'shadow-amber-500/20' },
  rose:    { text: 'text-rose-600 dark:text-rose-400',       bg: 'bg-rose-500/10',    border: 'border-rose-500/20',    bar: 'bg-rose-500',    glow: 'shadow-rose-500/20' },
  teal:    { text: 'text-teal-600 dark:text-teal-400',       bg: 'bg-teal-500/10',    border: 'border-teal-500/20',    bar: 'bg-teal-500',    glow: 'shadow-teal-500/20' },
};

export const GENERATION_NARRATIVES: Record<GenerationFlowKey, NarrativeScript> = {
  'block-assist': {
    accent: 'violet',
    steps: [
      { icon: BookOpen,   label: 'Đọc ngữ cảnh các khối',  hint: 'Phân tích những khối xung quanh' },
      { icon: PencilLine, label: 'Soạn nội dung',          hint: 'Bám sát vai trò & nhiệm vụ' },
      { icon: Wand2,      label: 'Tinh chỉnh câu chữ',     hint: 'Cô đọng, đúng trọng tâm' },
    ],
  },
  'doctor-fix': {
    accent: 'rose',
    steps: [
      { icon: Stethoscope,  label: 'Chẩn đoán khối thiếu', hint: 'Soi lỗ hổng cấu trúc prompt' },
      { icon: ClipboardList, label: 'Kê đơn nội dung',      hint: 'Bổ sung phần còn khuyết' },
      { icon: CheckCircle2,  label: 'Hoàn thiện',           hint: 'Khâu vá mạch lạc' },
    ],
  },
  'quick-fill': {
    accent: 'violet',
    steps: [
      { icon: Search,     label: 'Phân tích chủ đề',        hint: 'Hiểu yêu cầu của bạn' },
      { icon: LayoutGrid, label: 'Phân bổ vào từng khối',   hint: 'Khớp nội dung với cấu trúc' },
      { icon: RefreshCw,  label: 'Đồng bộ hóa',             hint: 'Đảm bảo nhất quán toàn cục' },
    ],
  },
  'variable-fill': {
    accent: 'emerald',
    steps: [
      { icon: UserCog,   label: 'Đọc hồ sơ',     hint: 'Tận dụng thông tin cá nhân' },
      { icon: Lightbulb, label: 'Suy luận giá trị', hint: 'Chọn giá trị phù hợp nhất' },
      { icon: ListChecks, label: 'Điền biến',     hint: 'Ghép vào từng biến số' },
    ],
  },
  'playground-sim': {
    accent: 'indigo',
    steps: [
      { icon: ScrollText,       label: 'Nạp System Prompt', hint: 'Đưa prompt vào thử nghiệm' },
      { icon: Drama,            label: 'Nhập vai',          hint: 'Khớp tính cách & ràng buộc' },
      { icon: MessageSquareText, label: 'Soạn phản hồi',    hint: 'Trả lời như cấu hình' },
    ],
  },
  'enhancer': {
    accent: 'teal',
    steps: [
      { icon: Scissors,      label: 'Mổ xẻ prompt thô',  hint: 'Tách ý chính & mục tiêu' },
      { icon: Layers,        label: 'Tái cấu trúc khối', hint: 'Sắp xếp theo Multi-block' },
      { icon: ArrowUpCircle, label: 'Nâng cấp',          hint: 'Làm sắc nét & chuyên nghiệp' },
    ],
  },
  'chain-sim': {
    accent: 'cyan',
    steps: [
      { icon: Network, label: 'Gom ngữ cảnh chuỗi', hint: 'Thu thập đầu ra các node trước' },
      { icon: Play,    label: 'Chạy node',          hint: 'Gọi LLM cho mắt xích này' },
      { icon: Combine, label: 'Tổng hợp',           hint: 'Kết nối kết quả vào luồng' },
    ],
  },
  'ai-news': {
    accent: 'blue',
    steps: [
      { icon: Radar,    label: 'Quét xu hướng', hint: 'Dò các diễn biến AI mới' },
      { icon: Filter,   label: 'Lọc tin nóng',  hint: 'Chọn tin tác động cao' },
      { icon: Newspaper, label: 'Biên tập',     hint: 'Viết lại súc tích, cuốn hút' },
    ],
  },
};
