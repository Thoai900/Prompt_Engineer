import { AiSkill, AiRule, CustomProfile } from '../types';

// Soi lỗi chất lượng skill/rule/config — hàm thuần, KHÔNG gọi AI. Trả danh sách cảnh báo.

export interface LintFinding {
  level: 'error' | 'warn';
  message: string;
}

// Trích các biến {{name}} — khớp cú pháp của renderSkillPrompt.
function usedVars(text: string): Set<string> {
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text || '')) !== null) out.add(m[1]);
  return out;
}

export function lintSkill(skill: AiSkill): LintFinding[] {
  const f: LintFinding[] = [];
  if (!skill.title?.trim()) f.push({ level: 'error', message: 'Thiếu tên kỹ năng.' });
  if (!skill.instructions?.trim()) f.push({ level: 'error', message: 'Chỉ dẫn (instructions) đang trống.' });

  const declared = new Set((skill.inputs || []).map((v) => v.name));
  const used = usedVars(skill.instructions || '');
  for (const u of used) {
    if (!declared.has(u)) f.push({ level: 'error', message: `Biến {{${u}}} dùng trong chỉ dẫn nhưng chưa khai báo ở Inputs.` });
  }
  for (const d of declared) {
    if (!used.has(d)) f.push({ level: 'warn', message: `Input "${d}" đã khai nhưng chưa dùng {{${d}}} trong chỉ dẫn.` });
  }
  if ((skill.inputs?.length || 0) === 0 && (skill.steps?.length || 0) === 0) {
    f.push({ level: 'warn', message: 'Kỹ năng chưa có input hay step nào — cân nhắc bổ sung cấu trúc.' });
  }
  return f;
}

export function lintRule(rule: AiRule): LintFinding[] {
  const f: LintFinding[] = [];
  if (!rule.title?.trim()) f.push({ level: 'error', message: 'Thiếu tiêu đề quy tắc.' });
  const content = (rule.content || '').trim();
  if (!content) {
    f.push({ level: 'error', message: 'Nội dung quy tắc đang trống.' });
  } else {
    if (content.length < 40) f.push({ level: 'warn', message: 'Nội dung khá ngắn — cân nhắc chi tiết hơn.' });
    if (!/(^|\n)#/.test(rule.content || '')) f.push({ level: 'warn', message: 'Chưa có tiêu đề Markdown (#) — cấu trúc rõ giúp AI bám tốt hơn.' });
  }
  return f;
}

export function lintProfile(profile: CustomProfile): LintFinding[] {
  const f: LintFinding[] = [];
  const { role, context, constraints, outputFormat } = profile;
  if (![role, context, constraints, outputFormat].some((s) => (s || '').trim())) {
    f.push({ level: 'error', message: 'Cấu hình đang trống — hãy điền ít nhất một mục.' });
  } else if (!role?.trim()) {
    f.push({ level: 'warn', message: 'Chưa có Vai trò (role) — nên xác định AI là ai.' });
  }
  return f;
}
