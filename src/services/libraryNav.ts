/**
 * Điều hướng trong tab Thư viện (gộp Library · Rules & Skills · LLM Config —
 * spec docs/superpowers/specs/2026-11-18-unified-library-design.md).
 *
 * - `openLibrary(kind, id?)`: mở tab Thư viện ở đúng loại (và mục) — URL `?lib=<kind>&id=<id>#library`,
 *   kèm sự kiện để LibraryHub đang mount chuyển ngay.
 * - `notifyLibraryChanged(kind)`: báo các view đọc lại dữ liệu sau khi nhập từ GitHub / tạo bằng AI.
 */
export type LibraryKind = 'templates' | 'rules' | 'skills' | 'configs';
export const LIBRARY_KINDS: LibraryKind[] = ['templates', 'rules', 'skills', 'configs'];

export const LIBRARY_OPEN_EVENT = 'pb:library-open';
export const LIBRARY_CHANGED_EVENT = 'pb:library-changed';

export interface LibraryOpenDetail { kind: LibraryKind; id?: string }
/** Loại dữ liệu vừa đổi — trùng ImportTarget của Explorer/Wizard. */
export type LibraryChangedKind = 'rule' | 'skill' | 'config';

/** Đọc loại từ query-param (thuần, có test). Giá trị lạ → null. */
export function parseLibraryKind(v: string | null | undefined): LibraryKind | null {
  return v && (LIBRARY_KINDS as string[]).includes(v) ? (v as LibraryKind) : null;
}

/** Ghi loại/mục hiện tại lên URL (không tạo entry lịch sử mới). */
export function writeLibraryParams(kind: LibraryKind, id?: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('lib', kind);
  if (id) url.searchParams.set('id', id); else url.searchParams.delete('id');
  window.history.replaceState(window.history.state, '', url);
}

export function openLibrary(kind: LibraryKind, id?: string): void {
  writeLibraryParams(kind, id);
  window.dispatchEvent(new CustomEvent<LibraryOpenDetail>(LIBRARY_OPEN_EVENT, { detail: { kind, id } }));
  window.location.hash = '#library';
}

export function notifyLibraryChanged(kind: LibraryChangedKind): void {
  window.dispatchEvent(new CustomEvent<LibraryChangedKind>(LIBRARY_CHANGED_EVENT, { detail: kind }));
}
