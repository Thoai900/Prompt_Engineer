import React, { useState } from 'react';
import { Play, Loader2, Sparkles, Plus, Check, RefreshCw } from 'lucide-react';
import { toast } from '../common/Toaster';
import { PromptProject } from '../../types';
import { compileGraph, collectGraphVariables } from '../../utils/graphCompile';
import {
  runPlaygroundChatStream, runPromptOnModel, evaluateAndEnhancePrompt, withPersona, AIChainEvaluation,
} from '../../services/aiService';
import { ALL_MODEL_OPTIONS, DEFAULT_MODEL } from '../../config/models';
import AIResponseRenderer from '../common/AIResponseRenderer';

interface TestRunPanelProps {
  project: PromptProject;
  inputs: Record<string, string>;
  setInputs: (next: Record<string, string>) => void;
  personaInstructions?: string;
  onAddFixNode: (title: string, content: string) => void;
  onSaveTestRun: (inputs: Record<string, string>, output: string) => void;
}

/**
 * Nơi DUY NHẤT chạy thử prompt đã lắp ráp (thay simulator per-node cũ).
 * Chạy xong có thể "Đánh giá & gợi ý": mỗi gợi ý chấp nhận sẽ vật chất hoá
 * thành một node "Sửa lỗi" cắm thẳng vào Prompt Gốc.
 */
export function TestRunPanel({
  project, inputs, setInputs, personaInstructions, onAddFixNode, onSaveTestRun,
}: TestRunPanelProps) {
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [evaluation, setEvaluation] = useState<AIChainEvaluation | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [addedSuggestions, setAddedSuggestions] = useState<Record<number, boolean>>({});

  const variables = collectGraphVariables(project);

  const handleRun = async () => {
    if (isRunning) return;
    const { finalPrompt } = compileGraph(project, inputs);
    if (!finalPrompt.trim()) {
      toast('Prompt đang trống — hãy soạn nội dung trước khi chạy thử.');
      return;
    }

    setIsRunning(true);
    setOutput('');
    setEvaluation(null);
    setAddedSuggestions({});

    const option = ALL_MODEL_OPTIONS.find((m) => m.value === model);
    const provider = option?.provider || 'gemini';
    const systemInstruction = withPersona(finalPrompt, personaInstructions);

    try {
      let accumulated = '';
      if (provider === 'gemini') {
        // Gemini: stream cho trải nghiệm mượt.
        await runPlaygroundChatStream(
          'gemini',
          systemInstruction,
          [{ role: 'user', content: 'Hãy thực thi và phản hồi theo chỉ dẫn prompt hệ thống.' }],
          { model },
          (chunk) => {
            accumulated += chunk;
            setOutput(accumulated);
          },
        );
      } else {
        const { text } = await runPromptOnModel({
          model,
          provider,
          systemInstruction,
          userContent: 'Hãy thực thi và phản hồi theo chỉ dẫn prompt hệ thống.',
        });
        accumulated = text;
        setOutput(text);
      }
      onSaveTestRun({ ...inputs }, accumulated);
    } catch (err: any) {
      console.error(err);
      setOutput(`❌ Lỗi khi chạy thử: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleEvaluate = async () => {
    if (!output.trim() || isEvaluating) return;
    setIsEvaluating(true);
    setEvaluation(null);
    try {
      const { finalPrompt } = compileGraph(project, inputs);
      const res = await evaluateAndEnhancePrompt(finalPrompt, output);
      setEvaluation(res);
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi thẩm định AI: ' + err.message);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleAddSuggestion = (idx: number) => {
    if (!evaluation || addedSuggestions[idx]) return;
    const s = evaluation.suggestions[idx];
    onAddFixNode(s.title || 'Gợi ý AI', s.content);
    setAddedSuggestions((prev) => ({ ...prev, [idx]: true }));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar text-left">
      {/* Biến đầu vào */}
      <div className="p-3 border-b border-line/60 flex flex-col gap-2">
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-faint">
          Biến đầu vào ({variables.length})
        </div>
        {variables.length === 0 && (
          <p className="text-[11px] text-faint italic">Prompt không có biến {'{{...}}'} nào.</p>
        )}
        {variables.map((v) => (
          <div key={v.name}>
            <label className="text-[10px] font-bold text-muted block mb-1 font-mono">
              {`{{${v.name}}}`}{v.description ? <span className="text-faint font-sans"> — {v.description}</span> : null}
            </label>
            {v.type === 'long-text' ? (
              <textarea
                value={inputs[v.name] ?? ''}
                onChange={(e) => setInputs({ ...inputs, [v.name]: e.target.value })}
                placeholder={v.defaultValue || 'Nhập giá trị...'}
                rows={3}
                className="w-full bg-transparent border border-line/70 rounded-xl px-2.5 py-1.5 text-xs text-ink resize-y focus:outline-none focus:border-violet-500 transition-colors"
              />
            ) : (
              <input
                value={inputs[v.name] ?? ''}
                onChange={(e) => setInputs({ ...inputs, [v.name]: e.target.value })}
                placeholder={v.defaultValue || 'Nhập giá trị...'}
                className="w-full bg-transparent border border-line/70 rounded-xl px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-violet-500 transition-colors"
              />
            )}
          </div>
        ))}
      </div>

      {/* Model + Run */}
      <div className="p-3 border-b border-line/60 flex items-center gap-2">
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="flex-1 min-w-0 bg-transparent border border-line/70 rounded-xl px-2 py-2 text-[11px] font-bold text-ink focus:outline-none cursor-pointer"
        >
          {ALL_MODEL_OPTIONS.filter((m) => !m.requiresUserKey).map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <button
          onClick={handleRun}
          disabled={isRunning}
          className="flex items-center gap-1.5 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/20 cursor-pointer transition-all active:scale-95 disabled:opacity-60"
        >
          {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} fill="currentColor" />}
          {isRunning ? 'Đang chạy...' : 'Chạy thử'}
        </button>
      </div>

      {/* Kết quả */}
      <div className="flex-1 p-3 flex flex-col gap-3">
        {output ? (
          <>
            <div className="border border-line/60 rounded-xl p-3 bg-black/[0.02] dark:bg-white/[0.02]">
              <AIResponseRenderer content={output} className="text-xs" />
            </div>
            <button
              onClick={handleEvaluate}
              disabled={isEvaluating || isRunning}
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-violet-500/40 text-violet-500 text-xs font-bold hover:bg-violet-500/10 cursor-pointer transition-colors disabled:opacity-60"
            >
              {isEvaluating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {isEvaluating ? 'AI đang thẩm định...' : 'Đánh giá & gợi ý nâng cấp'}
            </button>
          </>
        ) : (
          !isRunning && (
            <p className="text-[11px] text-faint italic p-2 leading-relaxed">
              Điền biến (nếu có) rồi bấm <b>Chạy thử</b> — prompt hoàn chỉnh sẽ được gửi cho model và kết quả hiện ở đây.
            </p>
          )
        )}

        {/* Kết quả thẩm định */}
        {evaluation && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black" style={{ color: evaluation.score >= 75 ? '#10b981' : evaluation.score >= 50 ? '#f59e0b' : '#f43f5e' }}>
                {evaluation.score}
              </span>
              <span className="text-[10px] font-bold text-faint uppercase tracking-wider">/100 điểm chất lượng</span>
            </div>
            {evaluation.weaknesses.length > 0 && (
              <ul className="text-[11px] text-muted list-disc pl-4 flex flex-col gap-1">
                {evaluation.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-faint mt-1">
              Gợi ý — bấm để thêm thành node "Sửa lỗi"
            </div>
            {evaluation.suggestions.map((s, i) => (
              <div key={i} className="border border-line/60 rounded-xl p-2.5 flex flex-col gap-1.5">
                <div className="text-[11px] font-bold text-ink">{s.title}</div>
                <p className="text-[10px] text-muted leading-relaxed">{s.description}</p>
                <button
                  onClick={() => handleAddSuggestion(i)}
                  disabled={addedSuggestions[i]}
                  className={`self-start flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    addedSuggestions[i]
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20'
                  }`}
                >
                  {addedSuggestions[i] ? <Check size={11} /> : <Plus size={11} />}
                  {addedSuggestions[i] ? 'Đã thêm vào đồ thị' : 'Thêm node Sửa lỗi'}
                </button>
              </div>
            ))}
            <button
              onClick={handleRun}
              className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-line/70 text-muted text-[11px] font-bold hover:text-ink cursor-pointer transition-colors"
            >
              <RefreshCw size={11} /> Chạy lại với đồ thị mới
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
