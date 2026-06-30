// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import LibraryTab from '../components/tabs/LibraryTab';
import { PromptTemplate } from '../types';

beforeEach(() => {
  localStorage.clear();
  // clipboard không có sẵn trong jsdom — stub để nút Chia sẻ không ném lỗi.
  Object.assign(navigator, { clipboard: { writeText: () => Promise.resolve() } });
});

const noop = () => {};

function renderLibrary(customTemplates: PromptTemplate[] = []) {
  return render(
    <LibraryTab
      onSelectTemplate={noop}
      customTemplates={customTemplates}
      user={null}
      onNavigateToTab={noop}
    />,
  );
}

describe('LibraryTab — tab "Đã lưu"', () => {
  it('render được và có 3 tab social', () => {
    renderLibrary();
    expect(screen.getByText('Trending')).toBeTruthy();
    expect(screen.getByText('Mới nhất')).toBeTruthy();
    // Tab "Đã lưu" hiển thị (chưa lưu gì nên không có hậu tố số đếm).
    expect(screen.getByText('Đã lưu')).toBeTruthy();
  });

  it('lưu 1 template → tab "Đã lưu (1)" và lọc đúng còn 1 card', () => {
    renderLibrary();

    // Bấm nút "Lưu" đầu tiên trên một card.
    const saveButtons = screen.getAllByTitle('Lưu vào bộ sưu tập của bạn');
    expect(saveButtons.length).toBeGreaterThan(0);
    fireEvent.click(saveButtons[0]);

    // Nhãn tab cập nhật số đếm.
    const savedTab = screen.getByRole('button', { name: /Đã lưu \(1\)/ });
    expect(savedTab).toBeTruthy();

    // Chuyển sang tab "Đã lưu" → chỉ còn đúng 1 card (1 nút Remix).
    fireEvent.click(savedTab);
    const grid = document.querySelector('.grid.pb-20') as HTMLElement | null;
    const remixCount = (grid ?? document.body).querySelectorAll('button');
    const remixButtons = Array.from(remixCount).filter((b) => /Remix/.test(b.textContent || ''));
    expect(remixButtons.length).toBe(1);
  });

  it('bỏ lưu → tab quay về "Đã lưu" không số đếm', () => {
    renderLibrary();
    const saveButtons = screen.getAllByTitle('Lưu vào bộ sưu tập của bạn');
    fireEvent.click(saveButtons[0]);
    // Sau khi lưu, nút đó đổi title thành "Bỏ lưu".
    const unsave = screen.getAllByTitle('Bỏ lưu')[0];
    fireEvent.click(unsave);
    expect(screen.getByText('Đã lưu')).toBeTruthy();
    expect(screen.queryByText(/Đã lưu \(\d+\)/)).toBeNull();
  });
});

// Giữ vi tham chiếu để tránh cảnh báo unused nếu cây phụ thuộc thay đổi.
void vi;
void within;
