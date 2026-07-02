import { PromptTemplate } from '../types';

// Helper thuần cho Lab (tách ra để unit-test được).

/**
 * Bọc một prompt dạng text thành PromptTemplate tối thiểu (1 block task) để
 * "Dùng ở Builder" hoặc "Lưu vào thư viện" từ các công cụ Lab.
 */
export function promptToTemplate(prompt: string, source: string): PromptTemplate {
  const firstLine = prompt.trim().split('\n')[0].slice(0, 60);
  return {
    id: `tpl_lab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    title: firstLine || `Prompt từ ${source}`,
    description: `Tạo bởi Lab · ${source}.`,
    category: 'Mẫu của tôi',
    blocks: [
      { id: 'b_lab_1', type: 'task', title: 'Prompt', content: prompt.trim() },
    ],
    tags: ['lab', source],
  };
}
