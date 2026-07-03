import { PromptBlock, PromptTemplate, TemplateVersion } from '../types';

// H2: lịch sử phiên bản template. Chiến lược: TRƯỚC mỗi lần ghi đè template đã có,
// chụp snapshot blocks hiện hành (bản sắp bị thay) đẩy vào đầu mảng versions.
// Tách THUẦN để unit-test; App.handleSaveTemplate gọi khi lưu.

export const MAX_TEMPLATE_VERSIONS = 10;

/** Ghép blocks thành văn bản để diff/so sánh (tiêu đề + nội dung từng khối). */
export function blocksToText(blocks: PromptBlock[] | undefined | null): string {
  return (blocks || [])
    .map((b) => `### ${b.title || b.type}\n${b.content || ''}`)
    .join('\n\n');
}

/** Hai bộ blocks có khác nhau về nội dung không (bỏ qua id/pin). */
export function blocksChanged(a: PromptBlock[] | undefined, b: PromptBlock[] | undefined): boolean {
  return blocksToText(a) !== blocksToText(b);
}

/** Chụp snapshot phiên bản từ template hiện hành (deep-copy blocks). */
export function snapshotVersion(template: Pick<PromptTemplate, 'blocks' | 'version'>, now: Date = new Date()): TemplateVersion {
  return {
    id: `ver_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    at: now.toISOString(),
    version: template.version,
    blocks: (template.blocks || []).map((b) => ({ ...b })),
  };
}

/**
 * Đẩy snapshot vào ĐẦU danh sách. Bỏ qua nếu nội dung trùng bản snapshot gần nhất
 * (tránh rác khi bấm lưu liên tục không đổi gì). Cắt còn tối đa `cap` bản.
 */
export function pushVersion(
  versions: TemplateVersion[] | undefined,
  snapshot: TemplateVersion,
  cap: number = MAX_TEMPLATE_VERSIONS,
): TemplateVersion[] {
  const current = versions || [];
  if (current.length > 0 && !blocksChanged(current[0].blocks, snapshot.blocks)) {
    return current.slice(0, cap);
  }
  return [snapshot, ...current].slice(0, cap);
}
