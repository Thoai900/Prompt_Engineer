import { User } from 'firebase/auth';
import { RoutedImport } from '../utils/skillCatalog';
import { rulesStore, skillsStore } from './collectionStore';

function readArr<T>(key: string): T[] {
  try {
    const r = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(r) ? (r as T[]) : [];
  } catch { return []; }
}

/**
 * Ghi mục nhập vào đúng kho theo target. Skill/rule đi qua collectionStore (Firestore
 * khi đăng nhập, localStorage khi là khách); profile (LLM config) vẫn chỉ localStorage.
 * `user` giữ trong chữ ký cho nơi gọi — store tự biết trạng thái đăng nhập.
 */
export async function persistImport(routed: RoutedImport, _user: User | null): Promise<void> {
  if (routed.target === 'skill' && routed.skill) {
    await skillsStore.save(routed.skill);
  } else if (routed.target === 'rule' && routed.rule) {
    await rulesStore.save(routed.rule);
  } else if (routed.target === 'config' && routed.profile) {
    const list = readArr<any>('llm_custom_profiles');
    list.push(routed.profile);
    localStorage.setItem('llm_custom_profiles', JSON.stringify(list));
  }
}
