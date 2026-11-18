import { HealthRun, HealthSuite, PromptRevision } from '../types';

// Prompt Git (Đợt 1 — spec 2026-11-18-prompt-flywheel-versioning-design.md):
// Health suite giữ lịch sử REVISION của prompt; mỗi run trỏ tới revision đã chạy
// → so điểm giữa các bản, biết bản tốt nhất, biết test nào tụt khi đổi bản.
// Tách THUẦN để unit-test; healthService/HealthPanel gọi.

export const MAX_REVISIONS = 20;
/** Tổng nội dung vượt ngưỡng → cắt còn MAX_REVISIONS_WHEN_LARGE (giữ doc Firestore < 1 MiB). */
export const LARGE_REVISIONS_CHARS = 400_000;
export const MAX_REVISIONS_WHEN_LARGE = 10;

/** Hash FNV-1a 32-bit (hex) của nội dung đã trim — đủ để phát hiện trùng, không dùng cho bảo mật. */
export function hashPrompt(text: string): string {
  const s = (text || '').trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function headRevision(suite: HealthSuite): PromptRevision | null {
  const revs = suite.revisions || [];
  return revs.find((r) => r.id === suite.headRevisionId) || null;
}

/**
 * Cắt danh sách revision (mới nhất ở đầu) còn `cap` bản. Bỏ bản CŨ NHẤT trước, nhưng ưu tiên
 * giữ head và các revision còn được run tham chiếu; chỉ khi vẫn thừa mới bỏ cả những bản đó.
 */
export function trimRevisions(revisions: PromptRevision[], runs: HealthRun[], headId?: string, cap = MAX_REVISIONS): PromptRevision[] {
  const totalChars = revisions.reduce((n, r) => n + r.content.length, 0);
  const limit = totalChars > LARGE_REVISIONS_CHARS ? Math.min(cap, MAX_REVISIONS_WHEN_LARGE) : cap;
  if (revisions.length <= limit) return revisions;

  const referenced = new Set(runs.map((r) => r.revisionId).filter(Boolean) as string[]);
  const keep = new Set(revisions.map((r) => r.id));
  const dropOrder = [
    ...revisions.filter((r) => r.id !== headId && !referenced.has(r.id)).reverse(),
    ...revisions.filter((r) => r.id !== headId && referenced.has(r.id)).reverse(),
  ];
  for (const r of dropOrder) {
    if (keep.size <= limit) break;
    keep.delete(r.id);
  }
  return revisions.filter((r) => keep.has(r.id));
}

/**
 * Ghi nội dung thành revision mới và đặt làm head. Nội dung trùng head → trả nguyên suite.
 * Nội dung trùng một revision CŨ → không tạo bản sao, chỉ chuyển head về bản đó.
 */
export function commitRevision(
  suite: HealthSuite,
  content: string,
  origin: PromptRevision['origin'],
  note?: string,
  now: Date = new Date(),
): HealthSuite {
  const hash = hashPrompt(content);
  const head = headRevision(suite);
  if (head && head.hash === hash) return suite;

  const revisions = suite.revisions || [];
  const existing = revisions.find((r) => r.hash === hash);
  if (existing) return { ...suite, prompt: existing.content, headRevisionId: existing.id };

  const rev: PromptRevision = {
    id: `rev_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    at: now.toISOString(),
    content,
    hash,
    origin,
    ...(note ? { note } : {}),
    ...(head ? { parentId: head.id } : {}),
  };
  return {
    ...suite,
    prompt: content,
    headRevisionId: rev.id,
    revisions: trimRevisions([rev, ...revisions], suite.runs || [], rev.id),
  };
}

/** Đưa một revision cũ lên làm hiện hành (không tạo bản sao vì nội dung đã có). */
export function restoreRevision(suite: HealthSuite, revisionId: string): HealthSuite {
  const rev = (suite.revisions || []).find((r) => r.id === revisionId);
  if (!rev) return suite;
  return { ...suite, prompt: rev.content, headRevisionId: rev.id };
}

/** Suite có thay đổi prompt chưa ghi thành revision (prompt khác head, hoặc chưa có head). */
export function hasUncommittedPrompt(suite: HealthSuite): boolean {
  if (!suite.prompt.trim()) return false;
  const head = headRevision(suite);
  return !head || head.hash !== hashPrompt(suite.prompt);
}

export interface RevisionScore {
  revision: PromptRevision;
  runs: HealthRun[];          // run của revision này (mới nhất ở đầu), đã lọc theo model nếu truyền
  lastScore: number | null;
  bestScore: number | null;
  deltaVsParent: number | null; // lastScore - lastScore của revision cha
}

export function scoreByRevision(suite: HealthSuite, model?: string): RevisionScore[] {
  const runs = (suite.runs || []).filter((r) => !model || r.model === model);
  const base = (suite.revisions || []).map((revision) => {
    const own = runs.filter((r) => r.revisionId === revision.id);
    return {
      revision,
      runs: own,
      lastScore: own.length ? own[0].avgScore : null,
      bestScore: own.length ? Math.max(...own.map((r) => r.avgScore)) : null,
    };
  });
  const byId = new Map(base.map((b) => [b.revision.id, b]));
  return base.map((b) => {
    const parent = b.revision.parentId ? byId.get(b.revision.parentId) : undefined;
    const deltaVsParent = b.lastScore !== null && parent && parent.lastScore !== null ? b.lastScore - parent.lastScore : null;
    return { ...b, deltaVsParent };
  });
}

/** Revision có điểm (lần chạy gần nhất) cao nhất; hoà → bản mới hơn. null nếu chưa revision nào có run. */
export function bestRevision(suite: HealthSuite, model?: string): PromptRevision | null {
  let best: RevisionScore | null = null;
  for (const s of scoreByRevision(suite, model)) {
    if (s.lastScore === null) continue;
    if (!best || s.lastScore > (best.lastScore as number)) best = s;
  }
  return best ? best.revision : null;
}

export interface TestBlame {
  testId: string;
  scoreA: number | null;
  scoreB: number | null;
  delta: number | null; // scoreB - scoreA
}

/**
 * So điểm TỪNG test giữa run gần nhất của revision A và của revision B (B là bản "sau").
 * Sắp tụt nhiều nhất lên đầu; test thiếu điểm ở một bên để cuối.
 */
export function blameByTest(suite: HealthSuite, revA: string, revB: string, model?: string): TestBlame[] {
  const runs = (suite.runs || []).filter((r) => !model || r.model === model);
  const runA = runs.find((r) => r.revisionId === revA);
  const runB = runs.find((r) => r.revisionId === revB);
  const scoreOf = (run: HealthRun | undefined, testId: string) =>
    run?.results.find((x) => x.testId === testId)?.score ?? null;

  const rows: TestBlame[] = suite.testCases.map((t) => {
    const a = scoreOf(runA, t.id);
    const b = scoreOf(runB, t.id);
    return { testId: t.id, scoreA: a, scoreB: b, delta: a !== null && b !== null ? b - a : null };
  });
  return rows.sort((x, y) => {
    if (x.delta === null) return y.delta === null ? 0 : 1;
    if (y.delta === null) return -1;
    return x.delta - y.delta;
  });
}

/**
 * Suite cũ (chưa có revisions): tạo 1 revision 'manual' từ prompt hiện hành làm head.
 * Run cũ GIỮ revisionId trống (UI hiển thị "trước khi có lịch sử") — không gán bừa.
 */
export function migrateSuite(suite: HealthSuite, now: Date = new Date()): HealthSuite {
  if ((suite.revisions && suite.revisions.length > 0) || !suite.prompt.trim()) return suite;
  return commitRevision(suite, suite.prompt, 'manual', 'Phiên bản đầu (tạo khi bật lịch sử)', now);
}
