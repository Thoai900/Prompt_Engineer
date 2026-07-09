import { User } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { RoutedImport } from '../utils/skillCatalog';

function readArr<T>(key: string): T[] {
  try {
    const r = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(r) ? (r as T[]) : [];
  } catch { return []; }
}

/**
 * Ghi mục nhập vào đúng kho theo target: localStorage (mọi trường hợp) + Firestore
 * (skills/rules khi đăng nhập). Profile (LLM config) hiện chỉ localStorage như tab.
 */
export async function persistImport(routed: RoutedImport, user: User | null): Promise<void> {
  if (routed.target === 'skill' && routed.skill) {
    const list = readArr<any>('custom_skills');
    list.push(routed.skill);
    localStorage.setItem('custom_skills', JSON.stringify(list));
    if (user) {
      await setDoc(doc(db, 'skills', routed.skill.id), {
        userId: user.uid,
        title: routed.skill.title,
        description: routed.skill.description,
        kind: routed.skill.kind ?? 'structured',
        inputs: routed.skill.inputs,
        steps: routed.skill.steps,
        instructions: routed.skill.instructions,
        source: routed.skill.source ?? null,
        updatedAt: serverTimestamp(),
        authorName: user.displayName || 'User',
      });
    }
  } else if (routed.target === 'rule' && routed.rule) {
    const list = readArr<any>('custom_rules');
    list.push(routed.rule);
    localStorage.setItem('custom_rules', JSON.stringify(list));
    if (user) {
      await setDoc(doc(db, 'rules', routed.rule.id), {
        userId: user.uid,
        title: routed.rule.title,
        description: routed.rule.description,
        content: routed.rule.content,
        type: routed.rule.type,
        tags: routed.rule.tags,
        source: routed.rule.source ?? null,
        updatedAt: serverTimestamp(),
        authorName: user.displayName || 'User',
      });
    }
  } else if (routed.target === 'config' && routed.profile) {
    const list = readArr<any>('llm_custom_profiles');
    list.push(routed.profile);
    localStorage.setItem('llm_custom_profiles', JSON.stringify(list));
  }
}
