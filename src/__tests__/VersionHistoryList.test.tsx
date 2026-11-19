// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VersionHistoryList from '../components/common/VersionHistoryList';
import type { TemplateVersion } from '../types';

const versions: TemplateVersion[] = [
  { id: 'v1', at: '2026-11-01T00:00:00Z', version: 'v1.0', blocks: [{ id: 'b', type: 'task', title: 'Task', content: 'câu cũ' }] },
];

describe('VersionHistoryList', () => {
  it('không có phiên bản thì không hiện gì', () => {
    const { container } = render(<VersionHistoryList versions={[]} currentBlocks={[]} onRestore={() => {}} restoreHint="" />);
    expect(container.innerHTML).toBe('');
  });

  it('mở diff so với bản hiện tại và gọi onRestore đúng phiên bản', () => {
    const onRestore = vi.fn();
    render(
      <VersionHistoryList
        versions={versions}
        currentBlocks={[{ id: 'b', type: 'task', title: 'Task', content: 'câu mới' }]}
        currentLabel="trình soạn"
        onRestore={onRestore}
        restoreHint="gợi ý"
      />,
    );
    expect(screen.getByText('Lịch sử phiên bản (1)')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Xem khác biệt so với trình soạn'));
    expect(screen.getByText('− câu cũ')).toBeTruthy();
    expect(screen.getByText('+ câu mới')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Khôi phục/ }));
    expect(onRestore).toHaveBeenCalledWith(versions[0]);
  });
});
