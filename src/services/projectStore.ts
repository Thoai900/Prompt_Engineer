import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { PromptProject } from '../types';
import { toProjectPayload } from '../utils/projectDoc';

// Đường ghi DUY NHẤT cho `projects/{id}` — khớp firestore.rules:
// tạo mới cần createdAt = updatedAt = serverTimestamp(); cập nhật giữ nguyên
// createdAt (merge) và đặt lại updatedAt.

/** Id đã biết là có document trên cloud — tránh getDoc lặp lại mỗi lần lưu. */
const knownInCloud = new Set<string>();

/** Đánh dấu các project vừa đọc được từ Firestore (bỏ qua bước kiểm tra tồn tại). */
export function markProjectsInCloud(ids: string[]): void {
  ids.forEach((id) => knownInCloud.add(id));
}

export async function saveProjectToCloud(project: PromptProject, uid: string): Promise<void> {
  const ref = doc(db, 'projects', project.id);
  const exists = knownInCloud.has(project.id) || (await getDoc(ref)).exists();
  await setDoc(ref, {
    ...toProjectPayload(project, uid),
    updatedAt: serverTimestamp(),
    ...(exists ? {} : { createdAt: serverTimestamp() }),
  }, { merge: true });
  knownInCloud.add(project.id);
}

export async function deleteProjectFromCloud(id: string): Promise<void> {
  await deleteDoc(doc(db, 'projects', id));
  knownInCloud.delete(id);
}
