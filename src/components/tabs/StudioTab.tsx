/**
 * Prompt Studio — màn hình chính mới: lớp ĐIỀU PHỐI mỏng nối các tính năng
 * sẵn có thành một dây chuyền 5 bước (ý tưởng → nháp → tăng cường → kiểm tra
 * → hoàn tất). Chỉ gọi service + deep-link; KHÔNG render lại UI tab khác.
 * Spec: docs/superpowers/specs/2026-07-05-prompt-studio-design.md
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { User } from 'firebase/auth';
import { ArrowLeft, ArrowRight, Bot, Home, ListOrdered, Loader2, LogIn, RotateCcw } from 'lucide-react';
import { AiRule, AiSkill, PromptTemplate, TabType } from '../../types';
import { useWorkspace } from '../../context/WorkspaceContext';
import { confirmDialog } from '../common/ConfirmDialog';
import { toast } from '../common/Toaster';
import { PRESET_RULES, PRESET_SKILLS } from '../../presets';
import { openProjectInGraph } from '../../services/graphExportService';
import { templateToGraphProject } from '../../utils/graphMigration';
import {
  STUDIO_STEPS, StudioDraft, assembleStudioPrompt, clampStep, computeQualityScore,
  createEmptyDraft, draftStorageKey, draftToTemplate, parseDraft, serializeDraft,
} from '../../utils/studioFlow';
import { StepRailHorizontal, StepRailVertical } from '../studio/StepRail';
import LivePreview from '../studio/LivePreview';
import CopilotPanel from '../studio/CopilotPanel';
import StepIdea from '../studio/StepIdea';
import StepDraft from '../studio/StepDraft';
import StepEnhance from '../studio/StepEnhance';
import StepCheck from '../studio/StepCheck';
import StepPolish from '../studio/StepPolish';
import StepFinish from '../studio/StepFinish';

interface StudioTabProps {
  user: User | null;
  authReady: boolean;
  onSaveTemplate: (t: PromptTemplate) => Promise<void>;
  onOpenInBuilder: (t: PromptTemplate) => void;
  onNavigateToTab: (tab: TabType) => void;
  onLogin: () => void;
}

/** Đọc kho Rules/Skills như BuilderTab: bản custom trong localStorage + preset (custom thắng khi trùng id). */
function loadStore(): { rules: AiRule[]; skills: AiSkill[] } {
  const readList = <T extends { id: string }>(key: string, presets: T[]): T[] => {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      const custom: T[] = Array.isArray(parsed) ? parsed : [];
      const ids = new Set(custom.map((x) => x.id));
      return [...custom, ...presets.filter((p) => !ids.has(p.id))];
    } catch {
      return [...presets];
    }
  };
  return {
    rules: readList<AiRule>('custom_rules', PRESET_RULES),
    skills: readList<AiSkill>('custom_skills', PRESET_SKILLS),
  };
}

// Spec phần 1: Studio yêu cầu đăng nhập (kho Rules/Library gắn với uid).
// Đặt false CHỈ khi cần kiểm thử nhanh không tài khoản (draft khách lưu khoá 'guest').
const STUDIO_REQUIRE_LOGIN: boolean = true;

/** Chế độ cột trái (đợt 3): thanh bước cổ điển hoặc copilot điều phối. */
type StudioUiMode = 'rail' | 'copilot';
const UI_MODE_KEY = 'studio_ui_mode';

export default function StudioTab({ user, authReady, onSaveTemplate, onOpenInBuilder, onNavigateToTab, onLogin }: StudioTabProps) {
  const { personas, activeWorkspaceId } = useWorkspace();
  const [draft, setDraft] = useState<StudioDraft>(() => createEmptyDraft());
  const [store, setStore] = useState<{ rules: AiRule[]; skills: AiSkill[] }>(() => loadStore());
  const [uiMode, setUiMode] = useState<StudioUiMode>(() =>
    localStorage.getItem(UI_MODE_KEY) === 'copilot' ? 'copilot' : 'rail');

  const switchUiMode = (mode: StudioUiMode) => {
    setUiMode(mode);
    localStorage.setItem(UI_MODE_KEY, mode);
  };

  const uid = user?.uid || (STUDIO_REQUIRE_LOGIN ? undefined : 'guest');

  // Nạp draft đã lưu của user này (mỗi uid một draft).
  useEffect(() => {
    if (!uid) return;
    setDraft(parseDraft(localStorage.getItem(draftStorageKey(uid))) || createEmptyDraft());
  }, [uid]);

  // Tự lưu draft (debounce nhẹ — object nhỏ nên không cần phức tạp hơn).
  useEffect(() => {
    if (!uid) return;
    const t = setTimeout(() => localStorage.setItem(draftStorageKey(uid), serializeDraft(draft)), 300);
    return () => clearTimeout(t);
  }, [draft, uid]);

  const patch = useCallback((p: Partial<StudioDraft>) => {
    setDraft((d) => ({ ...d, ...p, updatedAt: new Date().toISOString() }));
  }, []);

  const goToStep = useCallback((index: number) => {
    const next = clampStep(index);
    setDraft((d) => (d.currentStep === next ? d : { ...d, currentStep: next }));
    // Kho Rules/Skills có thể đã đổi ở tab khác → làm mới khi vào bước Tăng cường.
    if (STUDIO_STEPS[next]?.key === 'enhance') setStore(loadStore());
  }, []);

  const persona = useMemo(
    () => personas.find((p) => p.id === draft.personaId) || null,
    [personas, draft.personaId],
  );

  // Prompt lắp ráp: bản không persona cho linter, bản đầy đủ cho preview/copy.
  const assembledNoPersona = useMemo(
    () => assembleStudioPrompt(draft, store.rules, store.skills, null),
    [draft, store],
  );
  const finalText = useMemo(
    () => assembleStudioPrompt(draft, store.rules, store.skills, persona),
    [draft, store, persona],
  );
  const mergedTemplate = useMemo(
    () => draftToTemplate(draft, store.rules, store.skills),
    [draft, store],
  );
  const quality = useMemo(() => computeQualityScore(draft), [draft]);

  /** Đợt 2: template → project Prompt Graph v3, lưu + báo tab qua graphExportService. */
  const handleExportGraph = useCallback(async (template: PromptTemplate) => {
    const project = templateToGraphProject(template, activeWorkspaceId);
    await openProjectInGraph(project, user);
    toast.success('Đã xuất thành Prompt Graph — mở trong Project Chain.');
    onNavigateToTab('projectchain');
  }, [activeWorkspaceId, user, onNavigateToTab]);

  const handleReset = async () => {
    const ok = await confirmDialog({
      message: 'Bắt đầu lại từ đầu? Bản nháp hiện tại sẽ bị xoá.',
      danger: true,
      confirmText: 'Bắt đầu lại',
    });
    if (ok) setDraft(createEmptyDraft());
  };

  // ── Cổng đăng nhập (Studio yêu cầu tài khoản — kho Rules/Library gắn với uid) ──
  if (STUDIO_REQUIRE_LOGIN && !authReady) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 size={28} className="animate-spin text-violet-500" />
      </div>
    );
  }
  if (STUDIO_REQUIRE_LOGIN && !user) {
    return (
      <div className="flex h-full w-full items-center justify-center overflow-y-auto p-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 text-xl font-bold text-white shadow-lg shadow-violet-500/25">
            P
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-ink">Prompt Studio</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Từ ý tưởng thô đến prompt hoàn chỉnh — một dây chuyền sáu bước:
            nháp, tăng cường, kiểm tra, nâng cấp, hoàn tất.
          </p>
          {/* Rail thu nhỏ làm hình minh hoạ */}
          <div className="mt-6 flex items-center justify-center gap-1.5">
            {STUDIO_STEPS.map((s, i) => (
              <React.Fragment key={s.key}>
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-panel text-[10px] font-bold text-faint" title={s.title}>
                  {i + 1}
                </span>
                {i < STUDIO_STEPS.length - 1 && <span className="h-px w-4 bg-gradient-to-r from-violet-500/50 to-cyan-500/50" />}
              </React.Fragment>
            ))}
          </div>
          <button
            onClick={onLogin}
            className="mt-8 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
          >
            <LogIn size={16} /> Đăng nhập Google để bắt đầu
          </button>
          <button
            onClick={() => onNavigateToTab('home')}
            className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-muted transition-colors hover:bg-hover hover:text-ink"
          >
            <Home size={13} /> Xem giao diện cũ trước
          </button>
        </div>
      </div>
    );
  }

  const stepKey = STUDIO_STEPS[draft.currentStep]?.key || 'idea';
  const isFirst = draft.currentStep === 0;
  const isLast = draft.currentStep === STUDIO_STEPS.length - 1;

  return (
    <div className="custom-scrollbar h-full w-full overflow-y-auto">
      {/* Header của Studio */}
      <div className="sticky top-0 z-20 border-b border-line/60 bg-glass/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-cyan-500">
              Prompt Studio
            </div>
            <div className="truncate text-sm font-bold tracking-tight text-ink">
              {draft.template?.title || 'Bản nháp mới'}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Đợt 3: toggle thanh bước ↔ copilot (chỉ đổi cột trái, draft giữ nguyên) */}
            <div className="hidden items-center rounded-lg border border-line bg-panel/60 p-0.5 md:flex">
              <button
                onClick={() => switchUiMode('rail')}
                title="Thanh bước cổ điển"
                className={`flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                  uiMode === 'rail' ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                <ListOrdered size={12} /> Các bước
              </button>
              <button
                onClick={() => switchUiMode('copilot')}
                title="Copilot điều phối"
                className={`flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                  uiMode === 'copilot' ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                <Bot size={12} /> Copilot
              </button>
            </div>
            <button
              onClick={handleReset}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-muted transition-colors hover:bg-hover hover:text-ink"
            >
              <RotateCcw size={13} /> Bắt đầu lại
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl items-start gap-8 px-4 pb-16 pt-6 lg:px-8">
        {/* Cột trái (desktop): thanh bước hoặc copilot — đợt 3 */}
        <div className={`sticky top-20 hidden shrink-0 md:block ${uiMode === 'copilot' ? 'w-72' : 'w-52'}`}>
          {uiMode === 'copilot' ? (
            <CopilotPanel draft={draft} quality={quality} onGoToStep={goToStep} />
          ) : (
            <StepRailVertical draft={draft} onSelect={goToStep} />
          )}
        </div>

        {/* Nội dung bước */}
        <main className="min-w-0 flex-1">
          <div className="mb-4 md:hidden">
            <StepRailHorizontal draft={draft} onSelect={goToStep} />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={stepKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              {stepKey === 'idea' && (
                <StepIdea draft={draft} personas={personas} onPatch={patch} onNext={() => goToStep(1)} />
              )}
              {stepKey === 'draft' && <StepDraft draft={draft} onPatch={patch} />}
              {stepKey === 'enhance' && (
                <StepEnhance draft={draft} rules={store.rules} skills={store.skills} onPatch={patch} onNavigateToTab={onNavigateToTab} />
              )}
              {stepKey === 'check' && (
                <StepCheck draft={draft} assembledText={assembledNoPersona} onPatch={patch} />
              )}
              {stepKey === 'polish' && (
                <StepPolish draft={draft} assembledText={assembledNoPersona} onPatch={patch} />
              )}
              {stepKey === 'finish' && (
                <StepFinish
                  finalText={finalText}
                  mergedTemplate={mergedTemplate}
                  personaName={persona?.name || null}
                  onSaveTemplate={onSaveTemplate}
                  onOpenInBuilder={onOpenInBuilder}
                  onExportGraph={handleExportGraph}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Điều hướng bước — mọi bước đều skip được */}
          <div className="mt-8 flex items-center justify-between border-t border-line/60 pt-4">
            <button
              onClick={() => goToStep(draft.currentStep - 1)}
              disabled={isFirst}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-muted transition-colors hover:bg-hover hover:text-ink disabled:invisible"
            >
              <ArrowLeft size={13} /> {isFirst ? '' : STUDIO_STEPS[draft.currentStep - 1].title}
            </button>
            <button
              onClick={() => goToStep(draft.currentStep + 1)}
              disabled={isLast}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-panel px-4 py-2 text-xs font-bold text-ink transition-colors hover:bg-hover disabled:invisible"
            >
              {isLast ? '' : STUDIO_STEPS[draft.currentStep + 1].title} <ArrowRight size={13} />
            </button>
          </div>
        </main>

        {/* Prompt đang thành hình (màn rộng) */}
        <div className="sticky top-20 hidden w-80 shrink-0 xl:block">
          <LivePreview
            text={finalText}
            blockCount={draft.template?.blocks.length || 0}
            ruleCount={draft.selectedRuleIds.length}
            skillCount={draft.appliedSkillIds.length}
            personaName={persona?.name || null}
            quality={quality}
          />
        </div>
      </div>
    </div>
  );
}
