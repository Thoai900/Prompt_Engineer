import { toast } from '../common/Toaster';
import { confirmDialog } from '../common/ConfirmDialog';
import React, { useState, useEffect } from 'react';
import {
  Sparkles, Plus, Trash, Copy, Check, FileDown,
  RefreshCw, Sliders, ChevronUp, ChevronDown,
  HelpCircle, Eye, Edit3, CheckCircle2, AlertTriangle, Play, BookOpen, Compass
} from 'lucide-react';
import { User } from 'firebase/auth';
import { collection, doc, getDocs, query, setDoc, where, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError } from '../../firebase';
import { TabType, AiRule, AiSkill, SkillVariable, SkillStep, PromptTemplate, PromptBlock, SkillRunRecord } from '../../types';
import { PRESET_RULES, PRESET_SKILLS } from '../../presets';
import { optimizeAiRules } from '../../services/aiService';
import SkillsPanel from '../rulesskills/SkillsPanel';
import LibraryExplorer from '../library-explorer/LibraryExplorer';
import { GEMINI_FLASH, GEMINI_MODEL_OPTIONS } from '../../config/models';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface RulesSkillsTabProps {
  user: User | null;
  onApplyTemplate?: (template: PromptTemplate) => void;
}

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

export default function RulesSkillsTab({ user, onApplyTemplate }: RulesSkillsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'rules' | 'skills'>('rules');

  // --- rules state ---
  const [rules, setRules] = useState<AiRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [ruleTitle, setRuleTitle] = useState('');
  const [ruleDesc, setRuleDesc] = useState('');
  const [ruleContent, setRuleContent] = useState('');
  const [ruleType, setRuleType] = useState<'system-rules' | 'markdown-guide'>('system-rules');
  const [ruleTags, setRuleTags] = useState('');
  const [isRulePreset, setIsRulePreset] = useState(false);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [isDeletingRule, setIsDeletingRule] = useState(false);
  const [isOptimizingRule, setIsOptimizingRule] = useState(false);
  const [copiedRule, setCopiedRule] = useState(false);
  
  // Rule Optimization Comparison state
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [optimizedText, setOptimizedText] = useState('');
  // Model AI dùng chung cho mọi tác vụ AI trong tab (tối ưu rule, sinh skill, chạy skill).
  const [selectedModel, setSelectedModel] = useState<string>(GEMINI_FLASH);

  // M3: toàn bộ state/logic skills đã tách sang components/rulesskills/SkillsPanel.tsx.
  const [syncToken, setSyncToken] = useState(0);
  const [explorerOpen, setExplorerOpen] = useState(false);

    // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // --- INITIAL DATA LOAD & SYNC (rules; skills nằm trong SkillsPanel) ---
  useEffect(() => {
    let parsedRules = safeParseArray<AiRule>(localStorage.getItem('custom_rules'));
    const presetRuleIds = new Set(PRESET_RULES.map(r => r.id));
    parsedRules = parsedRules.filter(r => !r.isPreset && !presetRuleIds.has(r.id));
    setRules([...PRESET_RULES, ...parsedRules]);
    if (PRESET_RULES.length > 0) selectRule(PRESET_RULES[0]);
  }, []);

  // Sync with Firestore when user status is ready
  useEffect(() => {
    if (user) {
      syncDataWithFirestore();
    }
  }, [user]);

  const syncDataWithFirestore = async () => {
    if (!user) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      const rulesQuery = query(collection(db, 'rules'), where('userId', '==', user.uid));
      const rulesSnap = await getDocs(rulesQuery);
      const dbRules: AiRule[] = [];
      rulesSnap.forEach(docSnap => {
        const data = docSnap.data();
        dbRules.push({
          id: docSnap.id,
          title: data.title,
          description: data.description || '',
          content: data.content || '',
          type: data.type || 'system-rules',
          tags: data.tags || [],
          source: data.source || undefined,
          updatedAt: data.updatedAt || new Date().toISOString()
        });
      });

      const localRules = safeParseArray<AiRule>(localStorage.getItem('custom_rules')).filter(r => !r.isPreset);
      const presetRuleIds = new Set(PRESET_RULES.map(r => r.id));
      const mergedRulesMap = new Map<string, AiRule>();
      localRules.forEach(r => mergedRulesMap.set(r.id, r));
      dbRules.forEach(r => mergedRulesMap.set(r.id, r));
      const mergedRules = Array.from(mergedRulesMap.values()).filter(r => !presetRuleIds.has(r.id));

      localStorage.setItem('custom_rules', JSON.stringify(mergedRules));
      setRules([...PRESET_RULES, ...mergedRules]);
      if (mergedRules.length > 0 && !selectedRuleId) selectRule(mergedRules[0]);
    } catch (err) {
      console.error("Sync data failed:", err);
      setSyncError('Đồng bộ đám mây thất bại. Dữ liệu vẫn được giữ cục bộ trên thiết bị này.');
    } finally {
      setIsSyncing(false);
    }
  };

  // --- RULE MANAGEMENT ACTIONS ---
  const selectRule = (rule: AiRule) => {
    setSelectedRuleId(rule.id);
    setRuleTitle(rule.title);
    setRuleDesc(rule.description);
    setRuleContent(rule.content);
    setRuleType(rule.type);
    setRuleTags(rule.tags.join(', '));
    setIsRulePreset(!!rule.isPreset);
    setCompareModalOpen(false);
    setOptimizedText('');
  };

  const handleCreateNewRule = () => {
    const newRule: AiRule = {
      id: `rule-${Date.now()}`,
      title: 'Quy tắc mới không tên',
      description: 'Mô tả ngắn gọn về quy tắc này.',
      content: '# BỘ QUY TẮC MỚI\n\n- Quy tắc 1: AI luôn phản hồi rõ ràng.\n- Quy tắc 2: Phản hồi bằng Markdown.',
      type: 'system-rules',
      tags: ['new'],
      updatedAt: new Date().toISOString()
    };
    
    const updated = [...rules.filter(r => !r.isPreset), newRule];
    setRules([...PRESET_RULES, ...updated]);
    localStorage.setItem('custom_rules', JSON.stringify(updated));
    selectRule(newRule);
  };

  const handleSaveRule = async () => {
    if (isRulePreset) {
      toast('Không thể lưu đè lên quy tắc mặc định (Preset). Vui lòng tạo bản sao mới.');
      return;
    }
    if (!ruleTitle.trim()) {
      toast('Vui lòng nhập tiêu đề cho quy tắc.');
      return;
    }

    setIsSavingRule(true);
    const updatedRule: AiRule = {
      id: selectedRuleId,
      title: ruleTitle,
      description: ruleDesc,
      content: ruleContent,
      type: ruleType,
      tags: ruleTags.split(',').map(t => t.trim()).filter(Boolean),
      updatedAt: new Date().toISOString()
    };

    try {
      // 1. Save to local storage
      const customOnly = rules.filter(r => !r.isPreset && r.id !== selectedRuleId);
      const updatedList = [...customOnly, updatedRule];
      localStorage.setItem('custom_rules', JSON.stringify(updatedList));
      
      // Update state
      setRules([...PRESET_RULES, ...updatedList]);

      // 2. Save to Firestore if user logged in
      if (user) {
        const docRef = doc(db, 'rules', selectedRuleId);
        await setDoc(docRef, {
          userId: user.uid,
          title: ruleTitle,
          description: ruleDesc,
          content: ruleContent,
          type: ruleType,
          tags: updatedRule.tags,
          updatedAt: serverTimestamp(),
          authorName: user.displayName || 'User'
        });
      }
    } catch (err) {
      console.error(err);
      setSyncError('Không thể lưu quy tắc lên Cloud, đã lưu tạm cục bộ.');
      toast('Không thể lưu quy tắc lên Cloud, đã lưu tạm cục bộ.');
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleDeleteRule = async () => {
    if (isRulePreset) return;
    if (!(await confirmDialog({ message: 'Bạn có chắc chắn muốn xóa bộ quy tắc này không?', danger: true, confirmText: 'Xoá' }))) return;

    setIsDeletingRule(true);
    try {
      const customOnly = rules.filter(r => !r.isPreset && r.id !== selectedRuleId);
      localStorage.setItem('custom_rules', JSON.stringify(customOnly));
      
      // Update state
      const newRulesList = [...PRESET_RULES, ...customOnly];
      setRules(newRulesList);

      // Firestore delete
      if (user) {
        await deleteDoc(doc(db, 'rules', selectedRuleId));
      }

      // Select first preset
      if (PRESET_RULES.length > 0) selectRule(PRESET_RULES[0]);
    } catch (err) {
      console.error(err);
      toast('Xóa thất bại.');
    } finally {
      setIsDeletingRule(false);
    }
  };

  const handleDuplicateRule = () => {
    const dupRule: AiRule = {
      id: `rule-${Date.now()}`,
      title: `${ruleTitle} (Bản sao)`,
      description: ruleDesc,
      content: ruleContent,
      type: ruleType,
      tags: ruleTags.split(',').map(t => t.trim()).filter(Boolean),
      updatedAt: new Date().toISOString()
    };

    const customOnly = rules.filter(r => !r.isPreset);
    const updatedList = [...customOnly, dupRule];
    localStorage.setItem('custom_rules', JSON.stringify(updatedList));
    setRules([...PRESET_RULES, ...updatedList]);
    selectRule(dupRule);
  };

  // AI Rule Optimizer
  const handleAiOptimizeRule = async () => {
    if (!ruleContent.trim()) return;
    setIsOptimizingRule(true);
    try {
      const optResult = await optimizeAiRules(ruleContent, ruleType, {
        model: selectedModel,
        temperature: 0.5
      });
      setOptimizedText(optResult);
      setCompareModalOpen(true);
    } catch (error) {
      console.error("Optimize failed:", error);
      toast("Đã xảy ra lỗi khi gọi AI tối ưu. Vui lòng kiểm tra API Key.");
    } finally {
      setIsOptimizingRule(false);
    }
  };

  const handleApplyOptimization = () => {
    setRuleContent(optimizedText);
    setCompareModalOpen(false);
  };

  // Rule Copy & Export
  const handleCopyRuleContent = () => {
    navigator.clipboard.writeText(ruleContent);
    setCopiedRule(true);
    setTimeout(() => setCopiedRule(false), 2000);
  };

  const handleExportRuleFile = (filename: string, filetype: 'cursorrules' | 'markdown') => {
    let content = ruleContent;
    let name = filename;
    
    if (filetype === 'cursorrules') {
      // Build .cursorrules structure if needed
      name = '.cursorrules';
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', name);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePushRuleToPromptBuilder = () => {
    if (!onApplyTemplate) return;
    const template: PromptTemplate = {
      id: `rule-import-${Date.now()}`,
      title: ruleTitle,
      description: ruleDesc || 'Được nhập từ phân hệ Rules & Skills Builder',
      blocks: [
        {
          id: `role-${Date.now()}`,
          type: 'role',
          title: '🎭 Vai trò & Quy định',
          content: `Bạn tuân thủ nghiêm ngặt quy tắc sau:\n\n${ruleContent}`
        }
      ]
    };
    onApplyTemplate(template);
  };

  // --- SKILL MANAGEMENT ACTIONS ---
  // Seed run inputs from each variable's defaultValue (booleans honour 'true').
  // Bộ chọn model AI dùng chung cho mọi tác vụ AI trong tab.
  const renderModelSelect = () => (
    <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200/50 dark:border-slate-850">
      <span className="text-[10px] font-bold text-slate-400 px-1">AI Model:</span>
      <select
        value={selectedModel}
        onChange={(e) => setSelectedModel(e.target.value)}
        className="bg-transparent text-[10px] font-bold text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer"
      >
        {GEMINI_MODEL_OPTIONS.map(m => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="flex-1 p-4 md:p-6 flex flex-col overflow-y-auto w-full max-w-6xl mx-auto pb-safe">
      
      {/* Header tab */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
            <Sliders className="text-emerald-500 w-5 h-5" />
            <span>Rules & Skills Builder</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Thiết kế các tệp quy định hệ thống dài hạn, cẩm nang chỉ dẫn (SOPs) và cấu trúc kỹ năng hành vi chuyên sâu cho AI.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <button
              onClick={() => { syncDataWithFirestore(); setSyncToken(t => t + 1); }}
              disabled={isSyncing}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-350 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Đồng bộ hóa với đám mây Firestore"
            >
              <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
              <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ đám mây'}</span>
            </button>
          )}

          {activeSubTab === 'rules' && (
            <button
              onClick={() => setExplorerOpen(true)}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900/50 text-xs font-semibold text-indigo-700 dark:text-indigo-400 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
              title="Khám phá & nhập rule/skill/persona từ GitHub"
            >
              <Compass size={14} />
              <span>Khám phá GitHub</span>
            </button>
          )}

          <div className="flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200/50 dark:border-slate-800">
            <button
              onClick={() => setActiveSubTab('rules')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeSubTab === 'rules' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              ⚠️ Rules & Guides
            </button>
            <button
              onClick={() => setActiveSubTab('skills')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeSubTab === 'skills' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              ⚡ AI Skills
            </button>
          </div>
        </div>
      </div>

      {/* Sync error banner */}
      {syncError && (
        <div className="mb-4 flex items-start gap-2 px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span className="text-xs font-semibold flex-1">{syncError}</span>
          <button
            onClick={() => setSyncError(null)}
            className="text-amber-500 hover:text-amber-700 text-xs font-bold cursor-pointer"
            title="Đóng"
          >
            ✕
          </button>
        </div>
      )}

      {activeSubTab === 'skills' ? (
        <SkillsPanel
          user={user}
          onApplyTemplate={onApplyTemplate}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          syncToken={syncToken}
        />
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0 items-stretch">
        
        {/* Left column: Sidebar selector */}
        <div className="lg:col-span-3 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 p-4 shadow-sm h-fit max-h-[500px] lg:max-h-none overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Quy tắc & Cẩm nang
            </h3>
            <button
              onClick={handleCreateNewRule}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-500 hover:text-emerald-600 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200/50"
              title="Tạo quy tắc mới"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="space-y-1.5 overflow-y-auto max-h-[300px] lg:max-h-none pr-1">
            {rules.map(r => (
                <button
                  key={r.id}
                  onClick={() => selectRule(r)}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${selectedRuleId === r.id ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-900/60 shadow-sm' : 'bg-slate-50/30 dark:bg-slate-950/20 border-slate-100 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-850'}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-xs truncate max-w-[80%] text-slate-700 dark:text-slate-250">
                      {r.title}
                    </span>
                    {r.isPreset && (
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/30">
                        Preset
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate w-full">
                    {r.description || 'Không có mô tả'}
                  </span>
                </button>
              ))}
          </div>
        </div>

        {/* Right column: Editor Workstation */}
        <div className="lg:col-span-9 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800 p-4 shadow-sm min-h-[500px]">
          
                      /* ========================================================
               RULES & GUIDES WORKSTATION
               ======================================================== */
            <div className="flex-1 flex flex-col gap-4 h-full">
              {/* Rule Metadata Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tiêu đề</label>
                  <input
                    type="text"
                    disabled={isRulePreset}
                    value={ruleTitle}
                    onChange={(e) => setRuleTitle(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:border-emerald-500 text-slate-750 dark:text-slate-200 disabled:opacity-75 disabled:cursor-not-allowed"
                    placeholder="Nhập tiêu đề quy tắc..."
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Mô tả ngắn</label>
                  <input
                    type="text"
                    disabled={isRulePreset}
                    value={ruleDesc}
                    onChange={(e) => setRuleDesc(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:border-emerald-500 text-slate-750 dark:text-slate-200 disabled:opacity-75 disabled:cursor-not-allowed"
                    placeholder="Mô tả tóm tắt mục đích..."
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Loại quy tắc</label>
                  <select
                    disabled={isRulePreset}
                    value={ruleType}
                    onChange={(e) => setRuleType(e.target.value as any)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:border-emerald-500 text-slate-750 dark:text-slate-200 disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    <option value="system-rules">System Rules (Quy tắc hệ thống)</option>
                    <option value="markdown-guide">Markdown Guide (Cẩm nang HDSD)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Thẻ phân loại (Tags - Phân cách bằng dấu phẩy)</label>
                  <input
                    type="text"
                    disabled={isRulePreset}
                    value={ruleTags}
                    onChange={(e) => setRuleTags(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 focus:outline-none focus:border-emerald-500 text-slate-750 dark:text-slate-200 disabled:opacity-75 disabled:cursor-not-allowed"
                    placeholder="edu, socratic, physics..."
                  />
                </div>
              </div>

              {/* Action belt */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-b border-slate-100 dark:border-slate-800 py-3 mt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyRuleContent}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer dark:bg-slate-950 dark:border-slate-800 dark:text-slate-350"
                  >
                    {copiedRule ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                    <span>{copiedRule ? 'Đã sao chép' : 'Copy'}</span>
                  </button>
                  
                  <div className="relative group">
                    <button
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer dark:bg-slate-950 dark:border-slate-800 dark:text-slate-350"
                    >
                      <FileDown size={13} />
                      <span>Xuất tệp</span>
                    </button>
                    <div className="absolute left-0 mt-1 hidden group-focus-within:block group-hover:block bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 py-1 min-w-[150px]">
                      <button
                        onClick={() => handleExportRuleFile('.cursorrules', 'cursorrules')}
                        className="w-full text-left px-3.5 py-2 text-[11px] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                      >
                        Tải .cursorrules
                      </button>
                      <button
                        onClick={() => handleExportRuleFile(`${ruleTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}_rules.md`, 'markdown')}
                        className="w-full text-left px-3.5 py-2 text-[11px] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                      >
                        Tải rules.md
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handlePushRuleToPromptBuilder}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 rounded-lg text-xs font-semibold text-emerald-700 flex items-center gap-1.5 transition-colors cursor-pointer dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400"
                    title="Nạp quy tắc này thành một Role block trong Prompt Builder"
                  >
                    <Play size={12} />
                    <span>Nạp vào Builder</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {renderModelSelect()}

                  <button
                    onClick={handleAiOptimizeRule}
                    disabled={isOptimizingRule || !ruleContent.trim()}
                    className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isOptimizingRule ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    <span>Tối ưu bằng AI</span>
                  </button>
                </div>
              </div>

              {/* Split view: Editor + Live Preview */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[300px]">
                {/* Markdown Editor */}
                <div className="flex flex-col bg-slate-50/50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[250px] md:min-h-[400px]">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-100/50 dark:bg-slate-900/50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Edit3 size={11} /> Soạn thảo Quy tắc
                    </span>
                    {isRulePreset && (
                      <span className="text-[10px] text-amber-500 font-semibold italic">Không thể sửa Preset</span>
                    )}
                  </div>
                  <textarea
                    readOnly={isRulePreset}
                    value={ruleContent}
                    onChange={(e) => setRuleContent(e.target.value)}
                    className="flex-1 p-4 bg-transparent text-xs font-mono leading-relaxed resize-none focus:outline-none text-slate-850 dark:text-slate-100 custom-scrollbar disabled:opacity-80"
                    placeholder="# GHI CÁC QUY TẮC CỦA BẠN TẠI ĐÂY...&#10;- Ví dụ: Tuyệt đối không cho đáp án bài tập trực tiếp."
                  />
                </div>

                {/* Live Preview */}
                <div className="flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[250px] md:min-h-[400px]">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center bg-slate-50/50 dark:bg-slate-950/50">
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                      <Eye size={11} /> Live Preview Markdown
                    </span>
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto custom-scrollbar text-xs prose prose-slate dark:prose-invert max-w-none prose-sm leading-relaxed">
                    {ruleContent ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{ruleContent}</ReactMarkdown>
                    ) : (
                      <p className="text-slate-400 italic">Nhập nội dung quy tắc ở cột bên trái để hiển thị xem trước trực tiếp.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom save/delete belt */}
              {!isRulePreset && (
                <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-850 pt-4 mt-2">
                  <button
                    onClick={handleDeleteRule}
                    disabled={isDeletingRule}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-rose-650 hover:text-rose-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  >
                    Xóa quy tắc
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDuplicateRule}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer dark:bg-slate-800 dark:border-slate-750 dark:text-slate-250"
                    >
                      Nhân bản
                    </button>
                    <button
                      onClick={handleSaveRule}
                      disabled={isSavingRule}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      {isSavingRule && <RefreshCw size={13} className="animate-spin" />}
                      <span>{isSavingRule ? 'Đang lưu...' : 'Lưu quy tắc'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

        </div>
      </div>
      )}

      {/* --- COMPARISON MODAL FOR AI OPTIMIZATION --- */}
      {compareModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-250 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/40">
              <div className="flex items-center gap-2">
                <Sparkles className="text-indigo-650 w-5 h-5" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">Bảng so sánh tối ưu quy tắc bằng AI</h3>
              </div>
              <button
                onClick={() => setCompareModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Side-by-side comparison */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-6 overflow-y-auto">
              {/* Before */}
              <div className="flex flex-col bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  <AlertTriangle size={11} className="text-amber-500" /> Quy định hiện tại (Gốc)
                </span>
                <div className="flex-1 p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap overflow-y-auto select-all max-h-[400px] text-slate-700 dark:text-slate-300">
                  {ruleContent}
                </div>
              </div>

              {/* After */}
              <div className="flex flex-col bg-indigo-50/20 dark:bg-indigo-950/10 rounded-xl border border-indigo-200 dark:border-indigo-900/60 overflow-hidden">
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 px-4 py-2 border-b border-indigo-100 dark:border-indigo-900/40 uppercase tracking-widest flex items-center gap-1.5">
                  <CheckCircle2 size={11} className="text-green-500" /> Bản đề xuất tối ưu từ AI
                </span>
                <div className="flex-1 p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap overflow-y-auto select-all max-h-[400px] text-slate-750 dark:text-slate-200">
                  {optimizedText}
                </div>
              </div>
            </div>

            {/* Modal actions */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-950/20">
              <button
                onClick={() => setCompareModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-350 dark:hover:bg-slate-800 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleApplyOptimization}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                Áp dụng thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      <LibraryExplorer
        open={explorerOpen}
        onClose={() => setExplorerOpen(false)}
        user={user}
        defaultCategory="rule"
        categories={['skill', 'rule', 'guide']}
        onImported={(target) => {
          if (target === 'rule') {
            const parsed = safeParseArray<AiRule>(localStorage.getItem('custom_rules')).filter(r => !r.isPreset);
            setRules([...PRESET_RULES, ...parsed]);
          } else if (target === 'skill') {
            setSyncToken(t => t + 1); // SkillsPanel đọc lại
          }
          setExplorerOpen(false);
        }}
      />

    </div>
  );
}
