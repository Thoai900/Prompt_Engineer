import { deleteField, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { TemplateQuality } from '../types';

// Ghi / gỡ điểm Prompt Health tác giả công bố lên template của mình (bảng xếp hạng Thư viện).
// Rule: chỉ chủ template được đổi field `quality` (đường update của chủ sở hữu).
export async function setTemplateQuality(templateId: string, quality: TemplateQuality | null): Promise<void> {
  try {
    await updateDoc(doc(db, 'templates', templateId), {
      quality: quality ?? deleteField(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    try { handleFirestoreError(err, 'update', `templates/${templateId}`); } catch (e: any) { console.error(e.message); }
    throw err;
  }
}
