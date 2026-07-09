import { toast } from '../common/Toaster';
import { confirmDialog } from '../common/ConfirmDialog';
import React, { useState, useEffect } from 'react';
import {
  Sparkles, Plus, Trash, Copy, Check, FileDown,
  RefreshCw, Sliders, ChevronUp, ChevronDown,
  HelpCircle, Eye, Edit3, CheckCircle2, AlertTriangle, Play, BookOpen
} from 'lucide-react';
import { User } from 'firebase/auth';
import { collection, doc, getDocs, query, setDoc, where, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { AiSkill, SkillVariable, SkillStep, PromptTemplate, SkillRunRecord } from '../../types';
import { PRESET_SKILLS } from '../../presets';
import { generateSkillInstructions, renderSkillPrompt, executeSkill } from '../../services/aiService';
import { GEMINI_MODEL_OPTIONS } from '../../config/models';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import LibraryExplorer from '../library-explorer/LibraryExplorer';
import { ExternalLink, Compass } from 'lucide-react';

// Safely parse a localStorage JSON array; corrupt/legacy data returns [] instead of crashing the tab.
function safeParseArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (err) {
    console.warn('Bỏ qua dữ liệu localStorage hỏng:', err);
    return [];
  }
}

// M3: toàn bộ phân hệ AI SKILLS tách từ RulesSkillsTab (state + CRUD + sync + run).
// Hành vi giữ NGUYÊN; selectedModel dùng chung với tab Rules qua props.
interface SkillsPanelProps {
  user: User | null;
  onApplyTemplate?: (template: PromptTemplate) => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  /** Shell tăng số này khi bấm "Đồng bộ đám mây" → panel re-sync skills. */
  syncToken?: number;
}

export default function SkillsPanel({ user, onApplyTemplate, selectedModel, onSelectModel, syncToken = 0 }: SkillsPanelProps) {
  // --- skills state ---
  const [skills, setSkills] = useState<AiSkill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string>('');
  const [skillTitle, setSkillTitle] = useState('');
  const [skillDesc, setSkillDesc] = useState('');
  const [skillInputs, setSkillInputs] = useState<SkillVariable[]>([]);
  const [skillSteps, setSkillSteps] = useState<SkillStep[]>([]);
  const [skillInstructions, setSkillInstructions] = useState('');
  const [isSkillPreset, setIsSkillPreset] = useState(false);
  const [isSavingSkill, setIsSavingSkill] = useState(false);
  const [isDeletingSkill, setIsDeletingSkill] = useState(false);
  const [isCompilingSkill, setIsCompilingSkill] = useState(false);
  const [copiedSkill, setCopiedSkill] = useState(false);
  
  // State for variables manager
  const [newVarName, setNewVarName] = useState('');
  const [newVarType, setNewVarType] = useState<SkillVariable['type']>('text');
  const [newVarDesc, setNewVarDesc] = useState('');
  const [newVarRequired, setNewVarRequired] = useState(true);
  const [newVarOptions, setNewVarOptions] = useState('');

  // State for steps manager
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepDesc, setNewStepDesc] = useState('');

  // Combined compiled markdown display
  const [compiledSkillSpec, setCompiledSkillSpec] = useState('');

  // --- Skill RUN mode state ---
  const [skillMode, setSkillMode] = useState<'edit' | 'run'>('edit');
  const [runValues, setRunValues] = useState<Record<string, string | boolean>>({});
  const [renderedPrompt, setRenderedPrompt] = useState('');
  const [runOutput, setRunOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [missingVars, setMissingVars] = useState<string[]>([]);
  const [copiedRun, setCopiedRun] = useState(false);
  const [runHistory, setRunHistory] = useState<SkillRunRecord[]>([]);

  const [syncError, setSyncError] = useState<string | null>(null);
  const [skillKind, setSkillKind] = useState<'structured' | 'document'>('structured');
  const [explorerOpen, setExplorerOpen] = useState(false);

  // Nạp localStorage + presets khi mount (nửa skills của effect cũ trong tab).
  useEffect(() => {
    let parsedSkills = safeParseArray<AiSkill>(localStorage.getItem('custom_skills'));
    const presetSkillIds = new Set(PRESET_SKILLS.map(sk => sk.id));
    parsedSkills = parsedSkills.filter(sk => !sk.isPreset && !presetSkillIds.has(sk.id));
    setSkills([...PRESET_SKILLS, ...parsedSkills]);
    if (PRESET_SKILLS.length > 0) selectSkill(PRESET_SKILLS[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync Firestore (nửa skills của syncDataWithFirestore cũ) — chạy khi đăng nhập
  // hoặc khi shell bấm nút đồng bộ (syncToken tăng).
  useEffect(() => {
    if (user) syncSkills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, syncToken]);

  const syncSkills = async () => {
    if (!user) return;
    try {
      const skillsQuery = query(collection(db, 'skills'), where('userId', '==', user.uid));
      const skillsSnap = await getDocs(skillsQuery);
      const dbSkills: AiSkill[] = [];
      skillsSnap.forEach(docSnap => {
        const data = docSnap.data();
        dbSkills.push({
          id: docSnap.id,
          title: data.title,
          description: data.description || '',
          kind: data.kind === 'document' ? 'document' : 'structured',
          inputs: data.inputs || [],
          steps: data.steps || [],
          instructions: data.instructions || '',
          source: data.source || undefined,
          updatedAt: data.updatedAt || new Date().toISOString()
        });
      });

      const localSkills = safeParseArray<AiSkill>(localStorage.getItem('custom_skills')).filter(sk => !sk.isPreset);
      const presetSkillIds = new Set(PRESET_SKILLS.map(sk => sk.id));
      const mergedSkillsMap = new Map<string, AiSkill>();
      localSkills.forEach(sk => mergedSkillsMap.set(sk.id, sk));
      dbSkills.forEach(sk => mergedSkillsMap.set(sk.id, sk));
      const mergedSkills = Array.from(mergedSkillsMap.values()).filter(sk => !presetSkillIds.has(sk.id));

      localStorage.setItem('custom_skills', JSON.stringify(mergedSkills));
      setSkills([...PRESET_SKILLS, ...mergedSkills]);
      if (mergedSkills.length > 0 && !selectedSkillId) selectSkill(mergedSkills[0]);
    } catch (err) {
      console.error('Sync skills failed:', err);
      setSyncError('Đồng bộ kỹ năng thất bại. Dữ liệu vẫn được giữ cục bộ trên thiết bị này.');
    }
  };

  const buildInitialRunValues = (inputs: SkillVariable[]): Record<string, string | boolean> => {
    const seed: Record<string, string | boolean> = {};
    inputs.forEach(v => {
      if (v.type === 'boolean') {
        seed[v.name] = v.defaultValue === 'true';
      } else {
        seed[v.name] = v.defaultValue ?? '';
      }
    });
    return seed;
  };

  const loadRunHistory = (skillId: string): SkillRunRecord[] => {
    const records = safeParseArray<SkillRunRecord>(localStorage.getItem(`skill_runs_${skillId}`));
    return records.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  };

  const selectSkill = (skill: AiSkill) => {
    setSelectedSkillId(skill.id);
    setSkillTitle(skill.title);
    setSkillDesc(skill.description);
    setSkillInputs(skill.inputs || []);
    setSkillSteps(skill.steps || []);
    setSkillInstructions(skill.instructions || '');
    setSkillKind(skill.kind === 'document' ? 'document' : 'structured');
    setIsSkillPreset(!!skill.isPreset);
    setCompiledSkillSpec('');
    // Reset run mode for the newly selected skill
    setRunValues(buildInitialRunValues(skill.inputs || []));
    setRenderedPrompt('');
    setRunOutput('');
    setRunError(null);
    setMissingVars([]);
    setRunHistory(loadRunHistory(skill.id));
  };

  const handleCreateNewSkill = () => {
    const newSkill: AiSkill = {
      id: `skill-${Date.now()}`,
      title: 'Kỹ năng mới không tên',
      description: 'Mô tả ngắn gọn về kỹ năng này.',
      inputs: [],
      steps: [],
      instructions: '### CHỈ DẪN KỸ NĂNG\n\nAI sử dụng các biến đầu vào để thực hiện nhiệm vụ.',
      updatedAt: new Date().toISOString()
    };

    const customOnly = skills.filter(s => !s.isPreset);
    const updatedList = [...customOnly, newSkill];
    localStorage.setItem('custom_skills', JSON.stringify(updatedList));
    setSkills([...PRESET_SKILLS, ...updatedList]);
    selectSkill(newSkill);
  };

  const handleSaveSkill = async () => {
    if (isSkillPreset) {
      toast('Không thể lưu đè lên kỹ năng mặc định (Preset). Vui lòng tạo bản sao mới.');
      return;
    }
    if (!skillTitle.trim()) {
      toast('Vui lòng nhập tiêu đề cho kỹ năng.');
      return;
    }

    setIsSavingSkill(true);
    const existing = skills.find(s => s.id === selectedSkillId);
    const updatedSkill: AiSkill = {
      id: selectedSkillId,
      title: skillTitle,
      description: skillDesc,
      kind: skillKind,
      inputs: skillInputs,
      steps: skillSteps,
      instructions: skillInstructions,
      source: existing?.source,
      updatedAt: new Date().toISOString()
    };

    try {
      const customOnly = skills.filter(s => !s.isPreset && s.id !== selectedSkillId);
      const updatedList = [...customOnly, updatedSkill];
      localStorage.setItem('custom_skills', JSON.stringify(updatedList));
      setSkills([...PRESET_SKILLS, ...updatedList]);

      if (user) {
        const docRef = doc(db, 'skills', selectedSkillId);
        await setDoc(docRef, {
          userId: user.uid,
          title: skillTitle,
          description: skillDesc,
          kind: skillKind,
          inputs: skillInputs,
          steps: skillSteps,
          instructions: skillInstructions,
          source: updatedSkill.source ?? null,
          updatedAt: serverTimestamp(),
          authorName: user.displayName || 'User'
        });
      }
    } catch (err) {
      console.error(err);
      setSyncError('Không thể lưu kỹ năng lên Cloud, đã lưu tạm cục bộ.');
      toast('Không thể lưu kỹ năng lên Cloud, đã lưu tạm cục bộ.');
    } finally {
      setIsSavingSkill(false);
    }
  };

  const handleDeleteSkill = async () => {
    if (isSkillPreset) return;
    if (!(await confirmDialog({ message: 'Bạn có chắc chắn muốn xóa kỹ năng này không?', danger: true, confirmText: 'Xoá' }))) return;

    setIsDeletingSkill(true);
    try {
      const customOnly = skills.filter(s => !s.isPreset && s.id !== selectedSkillId);
      localStorage.setItem('custom_skills', JSON.stringify(customOnly));
      
      const newSkillsList = [...PRESET_SKILLS, ...customOnly];
      setSkills(newSkillsList);

      if (user) {
        await deleteDoc(doc(db, 'skills', selectedSkillId));
      }

      if (PRESET_SKILLS.length > 0) selectSkill(PRESET_SKILLS[0]);
    } catch (err) {
      console.error(err);
      toast('Xóa thất bại.');
    } finally {
      setIsDeletingSkill(false);
    }
  };

  const handleDuplicateSkill = () => {
    const dupSkill: AiSkill = {
      id: `skill-${Date.now()}`,
      title: `${skillTitle} (Bản sao)`,
      description: skillDesc,
      inputs: JSON.parse(JSON.stringify(skillInputs)),
      steps: JSON.parse(JSON.stringify(skillSteps)),
      instructions: skillInstructions,
      updatedAt: new Date().toISOString()
    };

    const customOnly = skills.filter(s => !s.isPreset);
    const updatedList = [...customOnly, dupSkill];
    localStorage.setItem('custom_skills', JSON.stringify(updatedList));
    setSkills([...PRESET_SKILLS, ...updatedList]);
    selectSkill(dupSkill);
  };

  // --- VARIABLES MANAGER ---
  const handleAddVariable = () => {
    if (!newVarName.trim()) return;
    
    // Check duplicate
    if (skillInputs.some(v => v.name === newVarName.trim())) {
      toast('Biến số này đã tồn tại!');
      return;
    }

    const newVar: SkillVariable = {
      name: newVarName.trim(),
      type: newVarType,
      description: newVarDesc.trim() || undefined,
      required: newVarRequired,
      options: newVarType === 'dropdown' ? newVarOptions.split(',').map(o => o.trim()).filter(Boolean) : undefined
    };

    setSkillInputs([...skillInputs, newVar]);
    setNewVarName('');
    setNewVarDesc('');
    setNewVarOptions('');
  };

  const handleRemoveVariable = (name: string) => {
    setSkillInputs(skillInputs.filter(v => v.name !== name));
  };

  // --- STEPS MANAGER ---
  const handleAddStep = () => {
    if (!newStepTitle.trim()) return;

    const newStep: SkillStep = {
      id: `step-${Date.now()}`,
      order: skillSteps.length + 1,
      title: newStepTitle.trim(),
      description: newStepDesc.trim()
    };

    setSkillSteps([...skillSteps, newStep]);
    setNewStepTitle('');
    setNewStepDesc('');
  };

  const handleRemoveStep = (id: string) => {
    const filtered = skillSteps.filter(s => s.id !== id);
    // Re-index orders
    const reordered = filtered.map((s, idx) => ({
      ...s,
      order: idx + 1
    }));
    setSkillSteps(reordered);
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === skillSteps.length - 1) return;

    const newSteps = [...skillSteps];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    
    // Swap
    const temp = newSteps[index];
    newSteps[index] = newSteps[targetIdx];
    newSteps[targetIdx] = temp;

    // Re-assign orders
    const reordered = newSteps.map((s, idx) => ({
      ...s,
      order: idx + 1
    }));
    setSkillSteps(reordered);
  };

  // --- SKILL SPEC COMPILER ---
  // Pure builder: derive the Markdown spec from the current skill state.
  // Kept side-effect free so callers (compile button, push-to-builder) can use
  // the value synchronously instead of reading stale `compiledSkillSpec` state.
  const buildSkillSpec = (): string => {
    if (skillKind === 'document') {
      return skillInstructions || `# ${skillTitle}\n\n(Skill nhập từ GitHub — chưa có nội dung.)`;
    }
    let md = `# KỸ NĂNG: ${skillTitle.toUpperCase()}\n`;
    md += `> ${skillDesc || 'Không có mô tả.'}\n\n`;

    if (skillInputs.length > 0) {
      md += `### 📥 BIẾN ĐẦU VÀO (INPUT VARIABLES)\n`;
      skillInputs.forEach(v => {
        md += `- **\`${v.name}\`** (${v.type}${v.required ? ', Bắt buộc' : ', Tự chọn'}): ${v.description || 'Không mô tả.'}\n`;
        if (v.options && v.options.length > 0) {
          md += `  * Tùy chọn: [ ${v.options.join(' | ')} ]\n`;
        }
      });
      md += `\n`;
    }

    if (skillSteps.length > 0) {
      md += `### 🔄 QUY TRÌNH THỰC HIỆN TUẦN TỰ (WORKFLOW STEPS)\n`;
      skillSteps.forEach(s => {
        md += `#### Bước ${s.order}: ${s.title}\n`;
        md += `${s.description}\n\n`;
      });
    }

    md += `---\n\n`;
    md += `### 📜 CHỈ DẪN THỰC THI (INSTRUCTIONS)\n`;
    md += `${skillInstructions || 'Không có chỉ dẫn thêm.'}\n`;

    return md;
  };

  const handleCompileSkill = () => {
    setCompiledSkillSpec(buildSkillSpec());
  };

  // AI assistant to auto write instructions based on inputs/steps
  const handleAiAutoInstructions = async () => {
    if (!skillTitle.trim()) {
      toast('Vui lòng nhập tên kỹ năng trước.');
      return;
    }
    setIsCompilingSkill(true);
    try {
      const compiledInst = await generateSkillInstructions(
        skillTitle,
        skillDesc,
        skillInputs,
        skillSteps,
        { model: selectedModel }
      );
      setSkillInstructions(compiledInst);
    } catch (e) {
      console.error(e);
      toast('Sinh chỉ dẫn bằng AI thất bại. Vui lòng thử lại sau.');
    } finally {
      setIsCompilingSkill(false);
    }
  };

  const handleCopyCompiledSkill = () => {
    if (!compiledSkillSpec) return;
    navigator.clipboard.writeText(compiledSkillSpec);
    setCopiedSkill(true);
    setTimeout(() => setCopiedSkill(false), 2000);
  };

  const handlePushSkillToPromptBuilder = () => {
    if (!onApplyTemplate || !skillTitle) return;
    // Build synchronously so we push the freshly compiled spec, not stale state.
    const spec = buildSkillSpec();
    setCompiledSkillSpec(spec);

    const template: PromptTemplate = {
      id: `skill-import-${Date.now()}`,
      title: `Kỹ năng: ${skillTitle}`,
      description: skillDesc || 'Được nhập từ phân hệ Rules & Skills Builder',
      blocks: [
        {
          id: `task-${Date.now()}`,
          type: 'task',
          title: `🎯 Kịch bản ${skillTitle}`,
          content: spec || `Sử dụng kỹ năng này để giải quyết công việc:\n\n${skillInstructions}`
        }
      ]
    };
    onApplyTemplate(template);
  };

  // --- SKILL RUN ACTIONS ---
  const handleRunValueChange = (name: string, value: string | boolean) => {
    setRunValues(prev => ({ ...prev, [name]: value }));
    if (missingVars.includes(name)) {
      setMissingVars(prev => prev.filter(n => n !== name));
    }
  };

  // Required text/dropdown inputs must be non-empty; booleans are always valid.
  const validateRun = (): string[] => {
    const missing = skillInputs
      .filter(v => v.required && v.type !== 'boolean')
      .filter(v => {
        const val = runValues[v.name];
        return typeof val !== 'string' || val.trim() === '';
      })
      .map(v => v.name);
    setMissingVars(missing);
    return missing;
  };

  const handleRenderPrompt = (): string | null => {
    if (validateRun().length > 0) {
      setRunError('Vui lòng điền đầy đủ các biến bắt buộc trước khi chạy.');
      return null;
    }
    setRunError(null);
    const rendered = renderSkillPrompt(skillInstructions, runValues);
    setRenderedPrompt(rendered);
    return rendered;
  };

  const persistRunRecord = (record: SkillRunRecord) => {
    const next = [record, ...loadRunHistory(record.skillId)].slice(0, 20); // keep last 20
    localStorage.setItem(`skill_runs_${record.skillId}`, JSON.stringify(next));
    setRunHistory(next);
  };

  const handleRunSkill = async () => {
    const rendered = handleRenderPrompt();
    if (rendered === null) return;

    setIsRunning(true);
    setRunError(null);
    setRunOutput('');
    try {
      const output = await executeSkill(rendered, { model: selectedModel });
      setRunOutput(output);
      persistRunRecord({
        id: `run-${Date.now()}`,
        skillId: selectedSkillId,
        values: runValues,
        renderedPrompt: rendered,
        output,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Run skill failed:', err);
      setRunError('Chạy kỹ năng thất bại. Vui lòng kiểm tra API Key / kết nối và thử lại.');
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopyRunOutput = () => {
    if (!runOutput) return;
    navigator.clipboard.writeText(runOutput);
    setCopiedRun(true);
    setTimeout(() => setCopiedRun(false), 2000);
  };

  const handlePushRunToBuilder = () => {
    if (!onApplyTemplate || !runOutput) return;
    const template: PromptTemplate = {
      id: `skill-run-${Date.now()}`,
      title: `Kết quả: ${skillTitle}`,
      description: skillDesc || 'Kết quả chạy kỹ năng từ Rules & Skills Builder',
      blocks: [
        {
          id: `output-${Date.now()}`,
          type: 'context',
          title: `📤 Kết quả ${skillTitle}`,
          content: runOutput
        }
      ]
    };
    onApplyTemplate(template);
  };

  const handleRestoreRun = (record: SkillRunRecord) => {
    setRunValues(record.values);
    setRenderedPrompt(record.renderedPrompt);
    setRunOutput(record.output);
    setMissingVars([]);
    setRunError(null);
  };

  const handleClearRunHistory = async () => {
    if (!(await confirmDialog({ message: 'Xóa toàn bộ lịch sử chạy của kỹ năng này?', danger: true, confirmText: 'Xoá' }))) return;
    localStorage.removeItem(`skill_runs_${selectedSkillId}`);
    setRunHistory([]);
  };


  // Bộ chọn model AI (dùng chung state với tab Rules qua props).
  const renderModelSelect = () => (
    <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200/50 dark:border-slate-850">
      <span className="text-[10px] font-bold text-slate-400 px-1">AI Model:</span>
      <select
        value={selectedModel}
        onChange={(e) => onSelectModel(e.target.value)}
        className="bg-transparent text-[10px] font-bold text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer"
      >
        {GEMINI_MODEL_OPTIONS.map(m => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      {syncError && (
        <div className="mb-4 flex items-start gap-2 px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span className="text-xs font-semibold flex-1">{syncError}</span>
          <button onClick={() => setSyncError(null)} className="text-amber-500 hover:text-amber-700 text-xs font-bold cursor-pointer" title="Đóng">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0 items-stretch">
        {/* Left column: Sidebar selector */}
        <div className="lg:col-span-3 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 p-4 shadow-sm h-fit max-h-[500px] lg:max-h-none overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kỹ năng AI</h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setExplorerOpen(true)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-500 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200/50"
                title="Khám phá & nhập skill từ GitHub"
              >
                <Compass size={16} />
              </button>
              <button
                onClick={handleCreateNewSkill}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-500 hover:text-emerald-600 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200/50"
                title="Tạo kỹ năng mới"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="space-y-1.5 overflow-y-auto max-h-[300px] lg:max-h-none pr-1">
            {skills.map(s => (
                <button
                  key={s.id}
                  onClick={() => selectSkill(s)}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${selectedSkillId === s.id ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-900/60 shadow-sm' : 'bg-slate-50/30 dark:bg-slate-950/20 border-slate-100 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-850'}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-xs truncate max-w-[80%] text-slate-700 dark:text-slate-250">
                      {s.title}
                    </span>
                    {s.isPreset && (
                      <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/30">
                        Preset
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate w-full">
                    {s.description || 'Không có mô tả'}
                  </span>
                </button>
              ))}
          </div>
        </div>

        {/* Right column: Editor Workstation */}
        <div className="lg:col-span-9 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800 p-4 shadow-sm min-h-[500px]">
          <div className="flex-1 flex flex-col gap-4 h-full">
              {/* Skill Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tên Kỹ năng (Skill Name)</label>
                  <input
                    type="text"
                    disabled={isSkillPreset}
                    value={skillTitle}
                    onChange={(e) => setSkillTitle(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:border-indigo-500 text-slate-750 dark:text-slate-200 disabled:opacity-75 disabled:cursor-not-allowed"
                    placeholder="Ví dụ: Đánh giá mã nguồn TypeScript"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Mô tả mục tiêu</label>
                  <input
                    type="text"
                    disabled={isSkillPreset}
                    value={skillDesc}
                    onChange={(e) => setSkillDesc(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:border-indigo-500 text-slate-750 dark:text-slate-200 disabled:opacity-75 disabled:cursor-not-allowed"
                    placeholder="Mô tả nhiệm vụ mà kỹ năng này giải quyết..."
                  />
                </div>
              </div>

              {skillKind === 'document' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 text-[11px] text-indigo-700 dark:text-indigo-300">
                  <span className="font-bold">📥 Skill dạng tài liệu (nhập từ GitHub)</span>
                  {(() => { const s = skills.find(x => x.id === selectedSkillId); return s?.source?.htmlUrl ? (
                    <a href={s.source.htmlUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 font-semibold hover:underline">
                      <ExternalLink size={11} /> Nguồn{s.source.license ? ` · ${s.source.license}` : ''}
                    </a>
                  ) : null; })()}
                </div>
              )}

              {/* Edit / Run mode toggle */}
              <div className="flex items-center justify-center mt-1">
                <div className="flex bg-slate-100 dark:bg-slate-950 p-0.5 rounded-xl border border-slate-200/50 dark:border-slate-800">
                  <button
                    onClick={() => setSkillMode('edit')}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${skillMode === 'edit' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <Edit3 size={12} /> Soạn thảo
                  </button>
                  <button
                    onClick={() => setSkillMode('run')}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${skillMode === 'run' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <Play size={12} /> Chạy thử
                  </button>
                </div>
              </div>

              {skillMode === 'edit' && (
              <>
              {/* Dynamic Variables and Workflow Steps Manager */}
              {skillKind === 'structured' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-2">

                {/* A. Inputs Manager */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/30 dark:bg-slate-950/10">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-350 mb-3 flex items-center gap-1.5">
                    <span>📥 1. Khai báo biến đầu vào (Inputs)</span>
                    <span title="Khai báo các biến sẽ được điền động khi gọi kỹ năng này.">
                      <HelpCircle size={13} className="text-slate-400" />
                    </span>
                  </h4>
                  
                  {/* Variables list */}
                  <div className="space-y-2 max-h-[140px] overflow-y-auto mb-4 custom-scrollbar">
                    {skillInputs.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">Chưa khai báo biến số nào cho kỹ năng này.</p>
                    ) : (
                      skillInputs.map(v => (
                        <div key={v.name} className="flex items-center justify-between p-2 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-lg shadow-2xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                              {v.name} <span className="text-[9px] font-medium text-slate-400">({v.type}{v.required && ', required'})</span>
                            </span>
                            {v.description && (
                              <span className="text-[9px] text-slate-400 max-w-[200px] truncate">{v.description}</span>
                            )}
                          </div>
                          {!isSkillPreset && (
                            <button
                              onClick={() => handleRemoveVariable(v.name)}
                              className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="Xóa biến"
                            >
                              <Trash size={12} />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add variable form */}
                  {!isSkillPreset && (
                    <div className="space-y-2 border-t border-slate-100 dark:border-slate-850 pt-3">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Tên biến (Ví dụ: grade)"
                          value={newVarName}
                          onChange={(e) => setNewVarName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                          className="px-2.5 py-1.5 text-[10px] border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:border-indigo-500"
                        />
                        <select
                          value={newVarType}
                          onChange={(e) => setNewVarType(e.target.value as any)}
                          className="px-2 py-1.5 text-[10px] border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="text">Text (Dòng ngắn)</option>
                          <option value="long-text">Long Text (Văn bản dài)</option>
                          <option value="dropdown">Dropdown (Danh sách)</option>
                          <option value="boolean">Boolean (Đúng/Sai)</option>
                        </select>
                      </div>
                      
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Mô tả biến..."
                          value={newVarDesc}
                          onChange={(e) => setNewVarDesc(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 text-[10px] border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:border-indigo-500"
                        />
                        
                        {newVarType === 'dropdown' && (
                          <input
                            type="text"
                            placeholder="Options: A, B, C..."
                            value={newVarOptions}
                            onChange={(e) => setNewVarOptions(e.target.value)}
                            className="w-1/3 px-2.5 py-1.5 text-[10px] border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:border-indigo-500"
                          />
                        )}
                        
                        <button
                          onClick={handleAddVariable}
                          className="px-3 bg-indigo-600 hover:bg-indigo-755 text-white rounded-lg text-[10px] font-bold shadow-xs cursor-pointer flex items-center gap-1"
                        >
                          <Plus size={10} />
                          <span>Thêm</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* B. Steps Manager */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/30 dark:bg-slate-950/10">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-350 mb-3 flex items-center gap-1.5">
                    <span>🔄 2. Định nghĩa Quy trình xử lý (Steps)</span>
                    <span title="Cấu trúc quy trình thực thi tuần tự của AI để giải quyết nhiệm vụ.">
                      <HelpCircle size={13} className="text-slate-400" />
                    </span>
                  </h4>

                  {/* Steps list */}
                  <div className="space-y-2 max-h-[140px] overflow-y-auto mb-4 custom-scrollbar pr-1">
                    {skillSteps.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">Chưa định nghĩa bước xử lý nào.</p>
                    ) : (
                      skillSteps.map((s, idx) => (
                        <div key={s.id} className="flex items-center justify-between p-2 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-lg shadow-2xs">
                          <div className="flex-1 flex gap-2 items-start">
                            <span className="w-4 h-4 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-650 dark:text-indigo-400 flex items-center justify-center font-bold text-[9px] mt-0.5">
                              {s.order}
                            </span>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-250">{s.title}</span>
                              {s.description && (
                                <span className="text-[9px] text-slate-400 leading-normal">{s.description}</span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            {!isSkillPreset && (
                              <>
                                <button
                                  onClick={() => moveStep(idx, 'up')}
                                  disabled={idx === 0}
                                  className="text-slate-400 hover:text-slate-600 disabled:opacity-30 p-1 hover:bg-slate-50 rounded"
                                >
                                  <ChevronUp size={11} />
                                </button>
                                <button
                                  onClick={() => moveStep(idx, 'down')}
                                  disabled={idx === skillSteps.length - 1}
                                  className="text-slate-400 hover:text-slate-600 disabled:opacity-30 p-1 hover:bg-slate-50 rounded"
                                >
                                  <ChevronDown size={11} />
                                </button>
                                <button
                                  onClick={() => handleRemoveStep(s.id)}
                                  className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 p-1.5 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add step form */}
                  {!isSkillPreset && (
                    <div className="space-y-2 border-t border-slate-100 dark:border-slate-850 pt-3 flex flex-col">
                      <input
                        type="text"
                        placeholder="Tiêu đề bước (Ví dụ: Đánh giá nỗ lực của học sinh)"
                        value={newStepTitle}
                        onChange={(e) => setNewStepTitle(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-[10px] border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Mô tả chi tiết bước..."
                          value={newStepDesc}
                          onChange={(e) => setNewStepDesc(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 text-[10px] border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={handleAddStep}
                          className="px-3 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold shadow-xs cursor-pointer flex items-center gap-1"
                        >
                          <Plus size={10} />
                          <span>Thêm</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
              )}

              {/* Instructions Markdown Editor */}
              <div className="flex flex-col bg-slate-50/50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 mt-2 overflow-hidden">
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-100/50 dark:bg-slate-900/50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Edit3 size={11} /> 3. Chỉ dẫn chi tiết Kỹ năng (Markdown Instructions)
                  </span>
                  
                  <div className="flex items-center gap-2">
                    {renderModelSelect()}
                    <button
                      onClick={handleAiAutoInstructions}
                      disabled={isCompilingSkill || isSkillPreset || skillKind === 'document'}
                      className="text-[9px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 px-2 py-1 rounded-md shadow-2xs flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    >
                      {isCompilingSkill ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />}
                      <span>Sinh hướng dẫn tự động bằng AI</span>
                    </button>
                  </div>
                </div>
                <textarea
                  readOnly={isSkillPreset}
                  value={skillInstructions}
                  onChange={(e) => setSkillInstructions(e.target.value)}
                  className="w-full h-[150px] p-4 bg-transparent text-xs font-mono leading-relaxed resize-none focus:outline-none text-slate-850 dark:text-slate-100 custom-scrollbar"
                  placeholder="### CHỈ DẪN THỰC THI...&#10;Viết rõ các bước AI sẽ sử dụng biến số để làm việc dưới dạng {{biến}}."
                />
              </div>

              {/* Skill Spec Compiler Preview */}
              <div className="flex flex-col bg-white dark:bg-slate-950 rounded-xl border border-indigo-100 dark:border-indigo-950/30 overflow-hidden mt-1">
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/30">
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                    <CheckCircle2 size={12} /> Biên dịch kỹ năng AI chuẩn hoá (Standard AI Skill Specification)
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCompileSkill}
                      className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-md text-[10px] font-semibold text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-350 cursor-pointer"
                    >
                      Biên dịch Markdown
                    </button>
                    {compiledSkillSpec && (
                      <>
                        <button
                          onClick={handleCopyCompiledSkill}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-md text-[10px] font-semibold text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-350 flex items-center gap-1 cursor-pointer"
                        >
                          {copiedSkill ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                          <span>{copiedSkill ? 'Đã sao chép' : 'Copy'}</span>
                        </button>
                        <button
                          onClick={handlePushSkillToPromptBuilder}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-900/50 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
                        >
                          <Play size={10} />
                          <span>Đẩy vào Builder</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-4 max-h-[220px] overflow-y-auto custom-scrollbar bg-slate-50/20 dark:bg-slate-900/10 text-xs leading-relaxed prose prose-indigo dark:prose-invert prose-sm max-w-none border-t border-slate-50 dark:border-slate-900">
                  {compiledSkillSpec ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{compiledSkillSpec}</ReactMarkdown>
                  ) : (
                    <p className="text-slate-400 italic">Nhấp nút "Biên dịch Markdown" ở trên để sinh ra mã đặc tả kỹ năng AI hoàn chỉnh.</p>
                  )}
                </div>
              </div>

              {/* Bottom control belt */}
              {!isSkillPreset && (
                <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-850 pt-4 mt-2">
                  <button
                    onClick={handleDeleteSkill}
                    disabled={isDeletingSkill}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-rose-650 hover:text-rose-700 rounded-lg text-xs font-semibold transition-all cursor-pointer animate-fade-in"
                  >
                    Xóa kỹ năng
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDuplicateSkill}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer dark:bg-slate-800 dark:border-slate-750 dark:text-slate-250"
                    >
                      Nhân bản
                    </button>
                    <button
                      onClick={handleSaveSkill}
                      disabled={isSavingSkill}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      {isSavingSkill && <RefreshCw size={13} className="animate-spin" />}
                      <span>{isSavingSkill ? 'Đang lưu...' : 'Lưu kỹ năng'}</span>
                    </button>
                  </div>
                </div>
              )}
              </>
              )}

              {skillMode === 'run' && (
                <div className="flex-1 flex flex-col gap-4 mt-2">
                  {/* Run error banner */}
                  {runError && (
                    <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span className="text-xs font-semibold flex-1">{runError}</span>
                    </div>
                  )}

                  {/* Input form generated from variables */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/30 dark:bg-slate-950/10">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-350 mb-3 flex items-center gap-1.5">
                      <span>📝 Điền biến đầu vào</span>
                    </h4>
                    {skillInputs.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">Kỹ năng này không khai báo biến nào — có thể chạy trực tiếp.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {skillInputs.map(v => {
                          const isMissing = missingVars.includes(v.name);
                          // The global `input,textarea,select { border-color: !important }` rule (index.css) overrides
                          // any border class, so signal the error with a ring (box-shadow, untouched by that rule) instead.
                          const baseCls = `w-full text-[11px] px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:border-indigo-500 ${isMissing ? 'ring-2 ring-[#fb7185]' : ''}`;
                          return (
                            <div key={v.name} className={v.type === 'long-text' ? 'md:col-span-2' : ''}>
                              <label className={`text-[10px] font-bold block mb-1 ${isMissing ? 'text-rose-600' : 'text-slate-500 dark:text-slate-400'}`}>
                                {v.name}
                                {v.required && v.type !== 'boolean' && <span className="text-rose-500 ml-0.5">*</span>}
                                {v.description && <span className="font-normal text-slate-400 ml-1.5">— {v.description}</span>}
                              </label>
                              {v.type === 'long-text' ? (
                                <textarea
                                  value={(runValues[v.name] as string) ?? ''}
                                  onChange={(e) => handleRunValueChange(v.name, e.target.value)}
                                  className={`${baseCls} h-20 resize-none font-mono leading-relaxed`}
                                  placeholder={`Nhập ${v.name}...`}
                                />
                              ) : v.type === 'dropdown' ? (
                                <select
                                  value={(runValues[v.name] as string) ?? ''}
                                  onChange={(e) => handleRunValueChange(v.name, e.target.value)}
                                  className={baseCls}
                                >
                                  <option value="">-- Chọn --</option>
                                  {(v.options || []).map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : v.type === 'boolean' ? (
                                <label className="flex items-center gap-2 cursor-pointer mt-1">
                                  <input
                                    type="checkbox"
                                    checked={!!runValues[v.name]}
                                    onChange={(e) => handleRunValueChange(v.name, e.target.checked)}
                                    className="w-4 h-4 accent-indigo-600 cursor-pointer"
                                  />
                                  <span className="text-[11px] text-slate-600 dark:text-slate-300">{runValues[v.name] ? 'Có' : 'Không'}</span>
                                </label>
                              ) : (
                                <input
                                  type="text"
                                  value={(runValues[v.name] as string) ?? ''}
                                  onChange={(e) => handleRunValueChange(v.name, e.target.value)}
                                  className={baseCls}
                                  placeholder={`Nhập ${v.name}...`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Run controls */}
                    <div className="flex items-center justify-between gap-2 mt-4 border-t border-slate-100 dark:border-slate-850 pt-3">
                      {renderModelSelect()}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleRenderPrompt}
                          className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-350 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye size={12} /> Render prompt
                        </button>
                        <button
                          onClick={handleRunSkill}
                          disabled={isRunning}
                          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                        >
                          {isRunning ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                          <span>{isRunning ? 'Đang chạy...' : 'Chạy với AI'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Rendered prompt preview */}
                  {renderedPrompt && (
                    <div className="flex flex-col bg-slate-50/50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Eye size={11} /> Prompt sau khi render
                        </span>
                      </div>
                      <div className="p-4 max-h-[160px] overflow-y-auto custom-scrollbar text-[11px] font-mono whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                        {renderedPrompt}
                      </div>
                    </div>
                  )}

                  {/* Run output */}
                  {(runOutput || isRunning) && (
                    <div className="flex flex-col bg-white dark:bg-slate-950 rounded-xl border border-indigo-100 dark:border-indigo-950/30 overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/30">
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                          <CheckCircle2 size={12} /> Kết quả thực thi
                        </span>
                        {runOutput && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleCopyRunOutput}
                              className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-md text-[10px] font-semibold text-slate-600 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-350 flex items-center gap-1 cursor-pointer"
                            >
                              {copiedRun ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                              <span>{copiedRun ? 'Đã sao chép' : 'Copy'}</span>
                            </button>
                            <button
                              onClick={handlePushRunToBuilder}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-900/50 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
                            >
                              <Play size={10} /> Đẩy vào Builder
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="p-4 max-h-[300px] overflow-y-auto custom-scrollbar text-xs leading-relaxed prose prose-indigo dark:prose-invert prose-sm max-w-none">
                        {isRunning && !runOutput ? (
                          <p className="text-slate-400 italic flex items-center gap-2"><RefreshCw size={12} className="animate-spin" /> AI đang xử lý kỹ năng...</p>
                        ) : (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{runOutput}</ReactMarkdown>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Run history */}
                  {runHistory.length > 0 && (
                    <div className="flex flex-col bg-slate-50/30 dark:bg-slate-950/10 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between bg-slate-100/30 dark:bg-slate-900/30">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">🕘 Lịch sử chạy ({runHistory.length})</span>
                        <button
                          onClick={handleClearRunHistory}
                          className="text-[10px] font-semibold text-rose-500 hover:text-rose-600 cursor-pointer"
                        >
                          Xóa lịch sử
                        </button>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-850 max-h-[160px] overflow-y-auto custom-scrollbar">
                        {runHistory.map(rec => (
                          <button
                            key={rec.id}
                            onClick={() => handleRestoreRun(rec)}
                            className="w-full text-left px-4 py-2 hover:bg-slate-100/50 dark:hover:bg-slate-900/40 transition-colors cursor-pointer flex items-center justify-between gap-2"
                            title="Khôi phục lần chạy này"
                          >
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex-1">
                              {rec.output.slice(0, 80) || '(trống)'}
                            </span>
                            <span className="text-[9px] text-slate-400 shrink-0">
                              {new Date(rec.createdAt).toLocaleString('vi-VN')}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
        </div>
      </div>

      <LibraryExplorer
        open={explorerOpen}
        onClose={() => setExplorerOpen(false)}
        user={user}
        defaultCategory="skill"
        categories={['skill']}
        onImported={() => {
          // Đọc lại localStorage (không phụ thuộc đăng nhập) để skill mới xuất hiện.
          const parsed = safeParseArray<AiSkill>(localStorage.getItem('custom_skills')).filter(sk => !sk.isPreset);
          setSkills([...PRESET_SKILLS, ...parsed]);
          setExplorerOpen(false);
          if (user) syncSkills();
        }}
      />
    </>
  );
}
