import { describe, expect, it } from 'vitest';
import {
  MAX_TEMPLATE_VERSIONS, blocksChanged, blocksToText, pushVersion, snapshotVersion,
} from '../utils/templateVersionUtils';
import { PromptBlock, TemplateVersion } from '../types';

const block = (title: string, content: string): PromptBlock => ({
  id: `b_${title}`, type: 'task', title, content,
});

describe('blocksToText / blocksChanged', () => {
  it('ghép tiêu đề + nội dung; phát hiện thay đổi nội dung', () => {
    const a = [block('Vai trò', 'Bạn là chuyên gia')];
    const b = [block('Vai trò', 'Bạn là chuyên gia SEO')];
    expect(blocksToText(a)).toContain('### Vai trò');
    expect(blocksChanged(a, b)).toBe(true);
    expect(blocksChanged(a, [{ ...a[0], id: 'khac', isPinned: true }])).toBe(false); // id/pin không tính
    expect(blocksChanged(undefined, [])).toBe(false);
  });
});

describe('snapshotVersion', () => {
  it('deep-copy blocks và giữ nhãn version', () => {
    const blocks = [block('Task', 'Nội dung')];
    const snap = snapshotVersion({ blocks, version: 'v1.2' }, new Date('2026-07-03T00:00:00Z'));
    expect(snap.version).toBe('v1.2');
    expect(snap.at).toBe('2026-07-03T00:00:00.000Z');
    expect(snap.blocks).toEqual(blocks);
    expect(snap.blocks[0]).not.toBe(blocks[0]); // bản sao, không tham chiếu
  });
});

describe('pushVersion', () => {
  const snapOf = (content: string): TemplateVersion =>
    snapshotVersion({ blocks: [block('Task', content)], version: 'v1' });

  it('thêm vào đầu danh sách, mới nhất trước', () => {
    const v1 = snapOf('một');
    const v2 = snapOf('hai');
    const result = pushVersion(pushVersion(undefined, v1), v2);
    expect(result.map((v) => v.id)).toEqual([v2.id, v1.id]);
  });

  it('bỏ qua snapshot trùng nội dung với bản gần nhất', () => {
    const v1 = snapOf('giống nhau');
    const v2 = snapOf('giống nhau');
    expect(pushVersion([v1], v2)).toHaveLength(1);
  });

  it('cắt còn tối đa cap bản', () => {
    let versions: TemplateVersion[] = [];
    for (let i = 0; i < MAX_TEMPLATE_VERSIONS + 5; i++) {
      versions = pushVersion(versions, snapOf(`bản ${i}`));
    }
    expect(versions).toHaveLength(MAX_TEMPLATE_VERSIONS);
    expect(versions[0].blocks[0].content).toBe(`bản ${MAX_TEMPLATE_VERSIONS + 4}`);
  });
});
