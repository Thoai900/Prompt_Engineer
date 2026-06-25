import { TEMPLATES, DAILY_PACKS, BLOCK_SUGGESTIONS } from '../data';
import type { PromptTemplate, PromptBlock } from '../types';

export type ContextTheme = 'math' | 'writing' | 'coding' | 'self_dev' | 'roadmap';

export interface ClassificationResult {
  theme: ContextTheme;
  confidence: number;
  matchedKeywords: string[];
}

export interface TemplateMatch {
  template: PromptTemplate;
  score: number;
  matchedBlocks: Map<string, PromptBlock>;
}

const SIMPLE_BLOCK_TYPES = [
  'format', 'constraints', 'tone', 'anchor',
  'self_correction', 'thinking', 'input_data'
];

const THEME_KEYWORDS: Record<ContextTheme, string[]> = {
  math: [
    'toán', 'toan', 'phương trình', 'phuong trinh', 'đại số', 'dai so',
    'hình học', 'hinh hoc', 'tích phân', 'tich phan', 'đạo hàm', 'dao ham',
    'xác suất', 'xac suat', 'thống kê', 'thong ke', 'giải bài', 'giai bai',
    'math', 'equation', 'algorithm', 'số học', 'so hoc', 'lượng giác',
    'luong giac', 'ma trận', 'ma tran', 'vector', 'calculus', 'geometry',
    'trigonometry', 'logarit', 'hàm số', 'ham so', 'bất phương trình',
    'bat phuong trinh', 'vật lý', 'vat ly', 'physics', 'hóa học', 'hoa hoc',
    'chemistry', 'gia sư', 'gia su', 'tutor', 'bài tập', 'bai tap'
  ],
  writing: [
    'viết', 'viet', 'bài viết', 'bai viet', 'content', 'blog', 'seo',
    'copywriting', 'storytelling', 'biên tập', 'bien tap', 'báo chí',
    'bao chi', 'sáng tạo nội dung', 'sang tao noi dung', 'tiêu đề',
    'tieu de', 'marketing', 'quảng cáo', 'quang cao', 'email', 'thư',
    'thu', 'kịch bản', 'kich ban', 'script', 'caption', 'social media',
    'tiktok', 'reels', 'shorts', 'video', 'dịch', 'dich', 'translate',
    'translation', 'biên dịch', 'bien dich', 'pr', 'sales', 'article'
  ],
  coding: [
    'code', 'lập trình', 'lap trinh', 'programming', 'javascript', 'python',
    'typescript', 'react', 'api', 'database', 'sql', 'bug', 'debug',
    'function', 'class', 'component', 'backend', 'frontend', 'devops',
    'git', 'deploy', 'phần mềm', 'phan mem', 'software', 'web', 'app',
    'mobile', 'html', 'css', 'node', 'java', 'c++', 'rust', 'go',
    'docker', 'server', 'hook', 'state', 'redux', 'vue', 'angular',
    'nextjs', 'tailwind', 'firebase', 'mongodb', 'postgresql'
  ],
  self_dev: [
    'phát triển bản thân', 'phat trien ban than', 'self', 'tâm lý', 'tam ly',
    'motivation', 'thói quen', 'thoi quen', 'habit', 'stress', 'lo lắng',
    'lo lang', 'tự tin', 'tu tin', 'giao tiếp', 'giao tiep', 'đàm phán',
    'dam phan', 'lãnh đạo', 'lanh dao', 'leadership', 'mindset', 'tư duy',
    'tu duy', 'thiền', 'thien', 'meditation', 'cảm xúc', 'cam xuc',
    'kỹ năng mềm', 'ky nang mem', 'tập gym', 'tap gym', 'sức khỏe',
    'suc khoe', 'fitness', 'yoga', 'chữa lành', 'chua lanh', 'healing'
  ],
  roadmap: [
    'lộ trình', 'lo trinh', 'roadmap', 'học', 'hoc', 'kế hoạch', 'ke hoach',
    'plan', 'ôn thi', 'on thi', 'tự học', 'tu hoc', 'khóa học', 'khoa hoc',
    'course', 'timeline', 'mục tiêu', 'muc tieu', 'career', 'nghề nghiệp',
    'nghe nghiep', 'chứng chỉ', 'chung chi', 'certificate', 'tutorial',
    'từ zero', 'tu zero', 'beginner', 'nền tảng', 'nen tang', 'foundation',
    'ielts', 'toeic', 'lịch', 'lich', 'schedule', 'pomodoro'
  ]
};

const FILLER_PHRASES = [
  'nói cách khác', 'hay nói một cách đơn giản', 'về cơ bản thì',
  'trên thực tế', 'nhìn chung', 'một cách tổng quát',
  'có thể nói rằng', 'nói chung là', 'cơ bản là',
  'thực ra thì', 'nói một cách khác', 'điều đáng nói là',
  'cần phải nhấn mạnh rằng', 'không thể phủ nhận rằng',
  'đáng chú ý là', 'một điều quan trọng là',
  'theo như đã biết', 'như đã đề cập',
  'rõ ràng là', 'hiển nhiên là'
];

const FILLER_WORDS = [
  'một cách', 'về cơ bản', 'thực ra', 'nói chung',
  'cơ bản là', 'trên thực tế', 'nhìn chung', 'rất là',
  'thật sự', 'quả thật', 'đương nhiên', 'dĩ nhiên',
  'chắc chắn rằng', 'hoàn toàn'
];

const INFORMAL_TO_FORMAL: [RegExp, string][] = [
  [/\bok\b/gi, 'đồng ý'],
  [/\bOK\b/g, 'Đồng ý'],
  [/\bnha\b/gi, ''],
  [/\bnhé\b/gi, ''],
  [/\bnghen\b/gi, ''],
  [/\bhaha\b/gi, ''],
  [/\bhihi\b/gi, ''],
  [/\bđược rồi\b/gi, 'đã hoàn tất'],
  [/\bxịn\b/gi, 'chất lượng cao'],
  [/\bchill\b/gi, 'thư giãn'],
  [/\bpro\b/gi, 'chuyên nghiệp'],
  [/\bnoob\b/gi, 'người mới'],
  [/\btrẩu\b/gi, 'thú vị'],
];

const FORMAL_TO_CASUAL: [RegExp, string][] = [
  [/\bQuý vị\b/g, 'bạn'],
  [/\bquý vị\b/g, 'bạn'],
  [/\bxin vui lòng\b/gi, 'nhớ'],
  [/\bvui lòng\b/gi, 'nhớ'],
  [/\btrân trọng\b/gi, 'cảm ơn nhiều'],
  [/\bkính gửi\b/gi, 'gửi'],
  [/\bxin chào\b/gi, 'hey'],
  [/\bchúng tôi\b/gi, 'mình'],
  [/\bđề nghị\b/gi, 'gợi ý'],
  [/\bthực hiện\b/gi, 'làm'],
];

const CASUAL_EMOJIS = ['😊', '✨', '💡', '👍', '🎯', '🚀', '💪'];

// ─── Utilities ───

export function normalizeVietnamese(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^\w\s+#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractKeywords(text: string): string[] {
  const normalized = normalizeVietnamese(text);
  const words = normalized.split(/\s+/).filter(w => w.length >= 2);
  return [...new Set(words)];
}

// ─── Topic Classifier ───

export function classifyTopic(topic: string): ClassificationResult | null {
  const normalizedTopic = normalizeVietnamese(topic);
  const topicWords = normalizedTopic.split(/\s+/);

  let bestTheme: ContextTheme = 'writing';
  let bestScore = 0;
  let bestMatched: string[] = [];

  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS) as [ContextTheme, string[]][]) {
    const matched: string[] = [];

    for (const keyword of keywords) {
      const normalizedKw = normalizeVietnamese(keyword);
      if (normalizedKw.includes(' ')) {
        if (normalizedTopic.includes(normalizedKw)) {
          matched.push(keyword);
        }
      } else {
        if (topicWords.includes(normalizedKw)) {
          matched.push(keyword);
        }
      }
    }

    const score = topicWords.length > 0 ? matched.length / topicWords.length : 0;
    if (score > bestScore) {
      bestScore = score;
      bestTheme = theme;
      bestMatched = matched;
    }
  }

  if (bestScore < 0.15 || bestMatched.length === 0) {
    return null;
  }

  return {
    theme: bestTheme,
    confidence: Math.min(bestScore, 1.0),
    matchedKeywords: bestMatched
  };
}

// ─── Template Matcher ───

export function findMatchingTemplate(
  topic: string,
  requestedBlockTypes: string[]
): TemplateMatch | null {
  const topicKeywords = extractKeywords(topic);
  if (topicKeywords.length === 0) return null;

  const allTemplates: PromptTemplate[] = [...TEMPLATES, ...DAILY_PACKS];
  let bestMatch: TemplateMatch | null = null;
  let bestScore = 0;

  for (const template of allTemplates) {
    const templateText = [
      template.title || '',
      template.description || '',
      ...(template.blocks || []).map(b => `${b.title} ${b.content}`)
    ].join(' ');

    const templateKeywords = extractKeywords(templateText);
    const intersection = topicKeywords.filter(kw => templateKeywords.includes(kw));
    let score = intersection.length / topicKeywords.length;

    const normalizedTitle = normalizeVietnamese(template.title || '');
    const normalizedDesc = normalizeVietnamese(template.description || '');
    const normalizedTopic = normalizeVietnamese(topic);
    if (normalizedTitle.includes(normalizedTopic) || normalizedDesc.includes(normalizedTopic)) {
      score = Math.min(score + 0.2, 1.0);
    }

    if (score > bestScore && template.blocks) {
      bestScore = score;
      const matchedBlocks = new Map<string, PromptBlock>();
      for (const block of template.blocks) {
        if (requestedBlockTypes.includes(block.type)) {
          matchedBlocks.set(block.type, block);
        }
      }
      bestMatch = { template, score, matchedBlocks };
    }
  }

  if (bestMatch && bestScore >= 0.6) {
    return bestMatch;
  }

  return null;
}

// ─── Block Content Generator ───

export function generateBlockContent(
  blockType: string,
  theme: ContextTheme
): string | null {
  const themeMap = BLOCK_SUGGESTIONS[blockType];
  if (!themeMap) return null;
  return themeMap[theme] || null;
}

export function isSimpleBlockType(blockType: string): boolean {
  return SIMPLE_BLOCK_TYPES.includes(blockType);
}

// ─── Text Transformations ───

export function shortenText(text: string): string {
  if (text.length <= 50) return text;

  let result = text;

  for (const phrase of FILLER_PHRASES) {
    const regex = new RegExp(phrase, 'gi');
    result = result.replace(regex, '');
  }

  for (const word of FILLER_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    result = result.replace(regex, '');
  }

  result = result.replace(/\s{2,}/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();

  if (result.length > text.length * 0.7) {
    const sentences = result.split(/(?<=[.!?\n])\s+/);
    const targetCount = Math.max(1, Math.ceil(sentences.length * 0.6));
    result = sentences.slice(0, targetCount).join(' ').trim();
  }

  return result || text;
}

export function toProfessionalTone(text: string): string {
  if (text.length <= 20) return text;

  let result = text;

  for (const [pattern, replacement] of INFORMAL_TO_FORMAL) {
    result = result.replace(pattern, replacement);
  }

  result = result.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu,
    ''
  );

  result = result.replace(/\s{2,}/g, ' ').trim();

  return result || text;
}

export function toCasualTone(text: string): string {
  if (text.length <= 20) return text;

  let result = text;

  for (const [pattern, replacement] of FORMAL_TO_CASUAL) {
    result = result.replace(pattern, replacement);
  }

  const sentences = result.split(/(?<=[.!?])\s+/);
  let emojiIdx = 0;
  result = sentences.map(s => {
    const trimmed = s.trim();
    if (trimmed.length > 15 && Math.random() > 0.5) {
      const emoji = CASUAL_EMOJIS[emojiIdx % CASUAL_EMOJIS.length];
      emojiIdx++;
      return trimmed.replace(/[.!?]$/, '') + ' ' + emoji;
    }
    return trimmed;
  }).join(' ');

  return result.trim() || text;
}

// ─── Theme from Context Blocks ───

export function classifyThemeFromContext(
  contextBlocks: { title: string; content: string }[]
): ContextTheme | null {
  const combinedText = contextBlocks
    .map(b => `${b.title} ${b.content}`)
    .join(' ');

  const result = classifyTopic(combinedText);
  return result ? result.theme : null;
}
