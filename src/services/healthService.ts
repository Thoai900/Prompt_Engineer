import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { HealthRun, HealthSuite, HealthTestResult } from '../types';
import { runPromptOnModel, scoreOutputQuality } from './aiService';
import { ALL_MODEL_OPTIONS } from '../config/models';

// Prompt Health/CI (Lab · Tầng 1 #2): suite = prompt + bộ test, chạy "khám sức khoẻ"
// (run + chấm từng test) và lưu lịch sử để phát hiện hồi quy giữa các lần / khi đổi model.
// Đăng nhập → Firestore `healthSuites`; chưa đăng nhập → localStorage.

const LS = 'pb_health_suites';
const MAX_RUNS = 10;

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function readLocal(): HealthSuite[] {
  try { const r = localStorage.getItem(LS); return r ? (JSON.parse(r) as HealthSuite[]) : []; } catch { return []; }
}
function writeLocal(s: HealthSuite[]) {
  try { localStorage.setItem(LS, JSON.stringify(s)); } catch { /* no-op */ }
}
function toIso(v: any): string {
  try { if (v?.toDate) return v.toDate().toISOString(); if (typeof v === 'string') return v; } catch { /* no-op */ }
  return new Date().toISOString();
}

export function newHealthSuite(name: string, model: string): HealthSuite {
  return { id: genId('health'), name, prompt: '', model, testCases: [], runs: [] };
}

export async function loadHealthSuites(user: { uid: string } | null | undefined): Promise<HealthSuite[]> {
  if (!user) return readLocal();
  try {
    const snap = await getDocs(query(collection(db, 'healthSuites'), where('userId', '==', user.uid)));
    return snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        name: data.name,
        prompt: data.prompt || '',
        model: data.model || '',
        testCases: data.testCases || [],
        runs: data.runs || [],
        cronEnabled: data.cronEnabled === true,
        userId: data.userId,
        workspaceId: data.workspaceId,
        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt),
      } as HealthSuite;
    }).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  } catch (err) {
    try { handleFirestoreError(err, 'list'); } catch (e: any) { console.error('Load health suites failed:', e.message); }
    return readLocal();
  }
}

export async function saveHealthSuite(user: { uid: string } | null | undefined, suite: HealthSuite): Promise<void> {
  const trimmedRuns = suite.runs.slice(0, MAX_RUNS);
  if (!user) {
    const all = readLocal();
    const i = all.findIndex((s) => s.id === suite.id);
    const next = { ...suite, runs: trimmedRuns };
    if (i === -1) all.push(next); else all[i] = next;
    writeLocal(all);
    return;
  }

  const ref = doc(db, 'healthSuites', suite.id);
  const base: any = {
    userId: user.uid,
    name: suite.name,
    prompt: suite.prompt,
    model: suite.model,
    testCases: suite.testCases,
    runs: trimmedRuns,
    cronEnabled: suite.cronEnabled === true, // H3: cờ cho Vercel Cron quét
    updatedAt: serverTimestamp(),
  };
  if (suite.workspaceId) base.workspaceId = suite.workspaceId;

  try {
    const exists = (await getDoc(ref)).exists();
    if (exists) {
      await setDoc(ref, base, { merge: true }); // giữ createdAt bất biến
    } else {
      await setDoc(ref, { ...base, createdAt: serverTimestamp() });
    }
  } catch (err) {
    try { handleFirestoreError(err, 'write', `healthSuites/${suite.id}`); } catch (e: any) { console.error(e.message); }
    throw err;
  }
}

export async function deleteHealthSuite(user: { uid: string } | null | undefined, id: string): Promise<void> {
  if (!user) { writeLocal(readLocal().filter((s) => s.id !== id)); return; }
  try {
    await deleteDoc(doc(db, 'healthSuites', id));
  } catch (err) {
    try { handleFirestoreError(err, 'delete', `healthSuites/${id}`); } catch (e: any) { console.error(e.message); }
    throw err;
  }
}

/** Chạy toàn bộ test của suite (song song) và trả về một bản ghi run mới. */
export async function runHealthCheck(
  suite: HealthSuite,
  apiKeys?: { gemini?: string; groq?: string; openai?: string },
): Promise<HealthRun> {
  const provider = ALL_MODEL_OPTIONS.find((m) => m.value === suite.model)?.provider || 'gemini';

  const results: HealthTestResult[] = await Promise.all(suite.testCases.map(async (t) => {
    try {
      const { text } = await runPromptOnModel({
        model: suite.model,
        provider,
        systemInstruction: suite.prompt,
        userContent: t.input.trim() || 'Hãy thực hiện theo chỉ dẫn hệ thống ở trên.',
        apiKeys,
      });
      const q = await scoreOutputQuality(text, t.criteria);
      return { testId: t.id, score: q.score, feedback: q.feedback };
    } catch (e: any) {
      return { testId: t.id, score: 0, feedback: `Lỗi: ${e?.message || 'không xác định'}` };
    }
  }));

  const avgScore = results.length ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0;
  return { at: new Date().toISOString(), model: suite.model, avgScore, results };
}

/** So sánh run mới nhất với run trước đó: chênh lệch trung bình + theo từng test. */
export function compareRuns(latest?: HealthRun, prev?: HealthRun): { avgDelta: number | null; perTest: Record<string, number>; modelChanged: boolean } {
  if (!latest) return { avgDelta: null, perTest: {}, modelChanged: false };
  const perTest: Record<string, number> = {};
  if (prev) {
    const prevMap = Object.fromEntries(prev.results.map((r) => [r.testId, r.score]));
    for (const r of latest.results) {
      if (prevMap[r.testId] !== undefined) perTest[r.testId] = r.score - prevMap[r.testId];
    }
  }
  return {
    avgDelta: prev ? latest.avgScore - prev.avgScore : null,
    perTest,
    modelChanged: !!prev && prev.model !== latest.model,
  };
}
