import { auth } from '../firebase';

// Client cho Web Node của Prompt Graph: gọi backend /api/fetch-url (chống CORS
// + SSRF ở server) để cào text từ một URL, kết quả được cache vào node.

export interface FetchedPage {
  title: string;
  text: string;
  truncated?: boolean;
}

export async function fetchUrlAsText(url: string): Promise<FetchedPage> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Bạn cần đăng nhập để cào dữ liệu web (endpoint được bảo vệ bằng tài khoản).');
  }
  const token = await user.getIdToken();

  const response = await fetch('/api/fetch-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url }),
  });

  let data: any = null;
  try { data = await response.json(); } catch { /* body không phải JSON */ }

  if (!response.ok) {
    throw new Error(data?.error || `Lỗi cào dữ liệu (HTTP ${response.status}).`);
  }
  if (!data?.text) {
    throw new Error('Không nhận được nội dung từ trang.');
  }
  return { title: data.title || '', text: data.text, truncated: !!data.truncated };
}
