import { doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { PromptProject } from '../types';
import { LOCAL_PROJECTS_KEY, loadLocalProjects } from './chainAppService';

// ─────────────────────────────────────────────────────────────────────────────
// Đường "bơm" prompt từ MỌI trang (Builder, Enhancer, Studio, Library...) vào
// Prompt Graph: lưu project (local + cloud nếu đăng nhập) rồi phát sự kiện để
// ProjectChainTab (có thể đã mount giữ-state) nhận ngay. Nơi gọi tự điều hướng
// sang tab (`onNavigateToTab('projectchain')` hoặc `window.location.hash`).
// ─────────────────────────────────────────────────────────────────────────────

export async function openProjectInGraph(
  project: PromptProject,
  user?: { uid: string } | null,
): Promise<void> {
  try {
    const next = [...loadLocalProjects().filter((p) => p.id !== project.id), project];
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(next));
    localStorage.setItem('active_project_id', project.id);
  } catch (e) {
    console.error('Lưu project cục bộ lỗi:', e);
  }

  if (user) {
    try {
      await setDoc(doc(db, 'projects', project.id), { ...project, userId: user.uid });
    } catch (err) {
      try { handleFirestoreError(err, 'create', `projects/${project.id}`); } catch (e: any) { console.error(e.message); }
    }
  }

  window.dispatchEvent(new CustomEvent('pb:project-added', { detail: project }));
}
