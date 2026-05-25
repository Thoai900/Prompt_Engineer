import React, { useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, FilePlus2, FlaskConical, Plus, Trash2 } from 'lucide-react';
import { FewShotExample, PromptTemplate } from '../types';

interface InteractiveFewShotPanelProps {
  template: PromptTemplate;
  onRemixWithFewShots: (template: PromptTemplate) => void;
}

const emptyExample = (): FewShotExample => ({
  input: '',
  output: '',
  explanation: '',
});

function seedExamples(template: PromptTemplate): FewShotExample[] {
  if (template.fewShots && template.fewShots.length > 0) {
    return template.fewShots.map((example) => ({
      input: example.input || '',
      output: example.output || '',
      explanation: example.explanation || '',
    }));
  }

  if (template.outputExample) {
    return [{
      input: template.outputExample.input || 'Nhap yeu cau mau cua ban tai day.',
      output: template.outputExample.content || template.outputExample.description || 'Mo ta ket qua mong muon cua AI tai day.',
      explanation: 'Vi du nay giup AI hieu cach anh xa dau vao thanh ket qua dung dinh dang.',
    }];
  }

  const exampleBlock = template.blocks.find((block) => block.type === 'example');
  if (exampleBlock) {
    return [{
      input: 'Tinh huong dau vao mau',
      output: exampleBlock.content,
      explanation: 'Duoc tao tu khoi Example san co cua prompt.',
    }];
  }

  return [{
    input: 'Nhap mot tinh huong dai dien cho cach ban se dung prompt nay.',
    output: 'Mo ta cau tra loi mau ma ban muon AI bat chuoc.',
    explanation: 'Dung case nay de neo phong cach, muc do chi tiet va format dau ra.',
  }];
}

function compileExamples(examples: FewShotExample[]) {
  return examples
    .filter((example) => example.input.trim() || example.output.trim())
    .map((example, index) => {
      const parts = [
        `### Example ${index + 1}`,
        `Input:\n${example.input.trim() || '[Nhap input mau]'}`,
        `Expected output:\n${example.output.trim() || '[Nhap output mau]'}`,
      ];
      if (example.explanation?.trim()) {
        parts.push(`Why this works:\n${example.explanation.trim()}`);
      }
      return parts.join('\n\n');
    })
    .join('\n\n');
}

function buildTemplateWithFewShots(template: PromptTemplate, examples: FewShotExample[]): PromptTemplate {
  const cleanedExamples = examples.filter((example) => example.input.trim() || example.output.trim());
  const compiledExamples = compileExamples(cleanedExamples);
  const hasExampleBlock = template.blocks.some((block) => block.type === 'example');

  const blocks = hasExampleBlock
    ? template.blocks.map((block) => block.type === 'example'
      ? { ...block, title: 'Interactive Few-Shot Examples', content: compiledExamples || block.content }
      : block)
    : [
      ...template.blocks,
      {
        id: `few-shot-${Date.now()}`,
        type: 'example' as const,
        title: 'Interactive Few-Shot Examples',
        content: compiledExamples,
      },
    ];

  return {
    ...template,
    id: `${template.id}-fewshot-${Date.now()}`,
    title: `${template.title} + Few-Shot`,
    description: `${template.description} Few-shot examples were customized from the library.`,
    fewShots: cleanedExamples,
    blocks,
  };
}

export default function InteractiveFewShotPanel({ template, onRemixWithFewShots }: InteractiveFewShotPanelProps) {
  const [examples, setExamples] = useState<FewShotExample[]>(() => seedExamples(template));
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const activeExample = examples[activeIndex] || emptyExample();
  const compiledPrompt = useMemo(() => compileExamples(examples), [examples]);
  const completeness = useMemo(() => {
    if (examples.length === 0) return 0;
    const filledFields = examples.reduce((total, example) => {
      return total + Number(Boolean(example.input.trim())) + Number(Boolean(example.output.trim())) + Number(Boolean(example.explanation?.trim()));
    }, 0);
    return Math.round((filledFields / (examples.length * 3)) * 100);
  }, [examples]);

  const updateActiveExample = (field: keyof FewShotExample, value: string) => {
    setExamples((current) => current.map((example, index) => index === activeIndex ? { ...example, [field]: value } : example));
  };

  const addExample = () => {
    setExamples((current) => [...current, emptyExample()]);
    setActiveIndex(examples.length);
  };

  const removeExample = (indexToRemove: number) => {
    setExamples((current) => {
      const next = current.filter((_, index) => index !== indexToRemove);
      return next.length > 0 ? next : [emptyExample()];
    });
    setActiveIndex((current) => Math.max(0, Math.min(current, examples.length - 2)));
  };

  const copyCompiled = async () => {
    await navigator.clipboard.writeText(compiledPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-indigo-100 bg-indigo-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-white text-indigo-600 shadow-sm">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">Interactive Few-Shot</h3>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
              Chinh input/output mau de AI bat dung format, giong van va muc do chi tiet truoc khi remix vao Builder.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-indigo-100 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-600">
            {examples.length} shots
          </span>
          <span className="rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600">
            {completeness}% ready
          </span>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[220px_1fr]">
        <div className="border-b border-slate-100 bg-slate-50/70 p-3 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Example set</span>
            <button
              onClick={addExample}
              className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-indigo-600 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-indigo-50"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-x-visible">
            {examples.map((example, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className={`min-w-[160px] rounded-xl border p-3 text-left transition-all lg:min-w-0 ${
                  activeIndex === index
                    ? 'border-indigo-200 bg-white shadow-sm'
                    : 'border-transparent bg-white/60 hover:border-slate-200 hover:bg-white'
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-slate-800">Shot {index + 1}</span>
                  <span className={`h-2 w-2 rounded-full ${example.input.trim() && example.output.trim() ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                </div>
                <p className="line-clamp-2 text-[11px] font-medium leading-relaxed text-slate-500">
                  {example.input || 'Chua co input mau'}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 p-4 xl:grid-cols-2">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">Input mau</span>
              <textarea
                value={activeExample.input}
                onChange={(event) => updateActiveExample('input', event.target.value)}
                rows={5}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium leading-relaxed text-slate-700 shadow-inner outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
                placeholder="VD: Viet email xin viec cho vi tri frontend..."
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">Output mong muon</span>
              <textarea
                value={activeExample.output}
                onChange={(event) => updateActiveExample('output', event.target.value)}
                rows={6}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium leading-relaxed text-slate-700 shadow-inner outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
                placeholder="VD: Email co subject, loi chao ngan, 3 y chinh va CTA..."
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">Ly do / pattern can hoc</span>
              <textarea
                value={activeExample.explanation || ''}
                onChange={(event) => updateActiveExample('explanation', event.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium leading-relaxed text-slate-700 shadow-inner outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
                placeholder="VD: Giu giong van chuyen nghiep, moi doan toi da 2 cau..."
              />
            </label>
          </div>

          <div className="flex min-h-[360px] flex-col rounded-xl border border-slate-200 bg-slate-950 text-slate-100 shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-indigo-300" />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">Compiled few-shot block</span>
              </div>
              <button
                onClick={copyCompiled}
                disabled={!compiledPrompt.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 ring-1 ring-slate-800 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="custom-scrollbar flex-1 overflow-auto whitespace-pre-wrap p-4 text-[11px] leading-relaxed text-slate-300">
              {compiledPrompt || 'Them input/output mau de bien dich thanh khoi few-shot.'}
            </pre>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => removeExample(activeIndex)}
          className="flex items-center justify-center gap-2 rounded-xl border border-rose-100 bg-white px-4 py-2 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-50"
        >
          <Trash2 className="h-4 w-4" />
          Remove current shot
        </button>
        <button
          onClick={() => onRemixWithFewShots(buildTemplateWithFewShots(template, examples))}
          disabled={!compiledPrompt.trim()}
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-indigo-600/20 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FilePlus2 className="h-4 w-4" />
          Remix voi Few-Shot
        </button>
      </div>
    </div>
  );
}
