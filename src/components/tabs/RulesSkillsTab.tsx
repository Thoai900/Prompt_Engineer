import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Plus, Trash, Copy, Check, FileDown, 
  RefreshCw, Sliders, ChevronUp, ChevronDown, 
  HelpCircle, Eye, Edit3, CheckCircle2, AlertTriangle, Play, BookOpen
} from 'lucide-react';
import { User } from 'firebase/auth';
import { collection, doc, getDocs, query, setDoc, where, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError } from '../../firebase';
import { TabType, AiRule, AiSkill, SkillVariable, SkillStep, PromptTemplate, PromptBlock } from '../../types';
import { PRESET_RULES, PRESET_SKILLS } from '../../presets';
import { optimizeAiRules, generateSkillInstructions } from '../../services/aiService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface RulesSkillsTabProps {
  user: User | null;
  onApplyTemplate?: (template: PromptTemplate) => void;
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
  const [ruleOptModel, setRuleOptModel] = useState('gemini-3.5-flash');

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

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);

  // --- INITIAL DATA LOAD & SYNC ---
  useEffect(() => {
    // Load local storage first
    const localRules = localStorage.getItem('custom_rules');
    const localSkills = localStorage.getItem('custom_skills');
    
    let parsedRules: AiRule[] = localRules ? JSON.parse(localRules) : [];
    let parsedSkills: AiSkill[] = localSkills ? JSON.parse(localSkills) : [];

    // Filter out preset duplicates from legacy saves
    parsedRules = parsedRules.filter(r => !r.isPreset);
    parsedSkills = parsedSkills.filter(s => !s.isPreset);

    // Merge presets
    setRules([...PRESET_RULES, ...parsedRules]);
    setSkills([...PRESET_SKILLS, ...parsedSkills]);

    // Select first item as default
    if (PRESET_RULES.length > 0) selectRule(PRESET_RULES[0]);
    if (PRESET_SKILLS.length > 0) selectSkill(PRESET_SKILLS[0]);
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
    try {
      // 1. Fetch custom rules
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
          updatedAt: data.updatedAt || new Date().toISOString()
        });
      });

      // 2. Fetch custom skills
      const skillsQuery = query(collection(db, 'skills'), where('userId', '==', user.uid));
      const skillsSnap = await getDocs(skillsQuery);
      const dbSkills: AiSkill[] = [];
      skillsSnap.forEach(docSnap => {
        const data = docSnap.data();
        dbSkills.push({
          id: docSnap.id,
          title: data.title,
          description: data.description || '',
          inputs: data.inputs || [],
          steps: data.steps || [],
          instructions: data.instructions || '',
          updatedAt: data.updatedAt || new Date().toISOString()
        });
      });

      // Merge local with DB
      const localRulesStr = localStorage.getItem('custom_rules');
      const localSkillsStr = localStorage.getItem('custom_skills');
      const localRules: AiRule[] = localRulesStr ? JSON.parse(localRulesStr).filter((r: any) => !r.isPreset) : [];
      const localSkills: AiSkill[] = localSkillsStr ? JSON.parse(localSkillsStr).filter((s: any) => !s.isPreset) : [];

      // Deduplicate rules by ID (DB takes priority)
      const mergedRulesMap = new Map<string, AiRule>();
      localRules.forEach(r => mergedRulesMap.set(r.id, r));
      dbRules.forEach(r => mergedRulesMap.set(r.id, r));
      const mergedRules = Array.from(mergedRulesMap.values());

      // Deduplicate skills by ID (DB takes priority)
      const mergedSkillsMap = new Map<string, AiSkill>();
      localSkills.forEach(s => mergedSkillsMap.set(s.id, s));
      dbSkills.forEach(s => mergedSkillsMap.set(s.id, s));
      const mergedSkills = Array.from(mergedSkillsMap.values());

      // Save back to local storage
      localStorage.setItem('custom_rules', JSON.stringify(mergedRules));
      localStorage.setItem('custom_skills', JSON.stringify(mergedSkills));

      // Update state
      setRules([...PRESET_RULES, ...mergedRules]);
      setSkills([...PRESET_SKILLS, ...mergedSkills]);

      // If nothing selected or selected was lost, select first preset
      if (mergedRules.length > 0 && !selectedRuleId) selectRule(mergedRules[0]);
      if (mergedSkills.length > 0 && !selectedSkillId) selectSkill(mergedSkills[0]);

    } catch (err) {
      console.error("Sync data failed:", err);
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
      alert('Không thể lưu đè lên quy tắc mặc định (Preset). Vui lòng tạo bản sao mới.');
      return;
    }
    if (!ruleTitle.trim()) {
      alert('Vui lòng nhập tiêu đề cho quy tắc.');
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
      alert('Không thể lưu quy tắc lên Cloud, đã lưu tạm cục bộ.');
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleDeleteRule = async () => {
    if (isRulePreset) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa bộ quy tắc này không?')) return;

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
      alert('Xóa thất bại.');
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
        model: ruleOptModel,
        temperature: 0.5
      });
      setOptimizedText(optResult);
      setCompareModalOpen(true);
    } catch (error) {
      console.error("Optimize failed:", error);
      alert("Đã xảy ra lỗi khi gọi AI tối ưu. Vui lòng kiểm tra API Key.");
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
  const selectSkill = (skill: AiSkill) => {
    setSelectedSkillId(skill.id);
    setSkillTitle(skill.title);
    setSkillDesc(skill.description);
    setSkillInputs(skill.inputs || []);
    setSkillSteps(skill.steps || []);
    setSkillInstructions(skill.instructions || '');
    setIsSkillPreset(!!skill.isPreset);
    setCompiledSkillSpec('');
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
      alert('Không thể lưu đè lên kỹ năng mặc định (Preset). Vui lòng tạo bản sao mới.');
      return;
    }
    if (!skillTitle.trim()) {
      alert('Vui lòng nhập tiêu đề cho kỹ năng.');
      return;
    }

    setIsSavingSkill(true);
    const updatedSkill: AiSkill = {
      id: selectedSkillId,
      title: skillTitle,
      description: skillDesc,
      inputs: skillInputs,
      steps: skillSteps,
      instructions: skillInstructions,
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
          inputs: skillInputs,
          steps: skillSteps,
          instructions: skillInstructions,
          updatedAt: serverTimestamp(),
          authorName: user.displayName || 'User'
        });
      }
    } catch (err) {
      console.error(err);
      alert('Không thể lưu kỹ năng lên Cloud, đã lưu tạm cục bộ.');
    } finally {
      setIsSavingSkill(false);
    }
  };

  const handleDeleteSkill = async () => {
    if (isSkillPreset) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa kỹ năng này không?')) return;

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
      alert('Xóa thất bại.');
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
      alert('Biến số này đã tồn tại!');
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
  const handleCompileSkill = () => {
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

    setCompiledSkillSpec(md);
  };

  // AI assistant to auto write instructions based on inputs/steps
  const handleAiAutoInstructions = async () => {
    if (!skillTitle.trim()) {
      alert('Vui lòng nhập tên kỹ năng trước.');
      return;
    }
    setIsCompilingSkill(true);
    try {
      const compiledInst = await generateSkillInstructions(
        skillTitle,
        skillDesc,
        skillInputs,
        skillSteps
      );
      setSkillInstructions(compiledInst);
    } catch (e) {
      console.error(e);
      alert('Sinh chỉ dẫn bằng AI thất bại. Vui lòng thử lại sau.');
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
    handleCompileSkill();
    
    const template: PromptTemplate = {
      id: `skill-import-${Date.now()}`,
      title: `Kỹ năng: ${skillTitle}`,
      description: skillDesc || 'Được nhập từ phân hệ Rules & Skills Builder',
      blocks: [
        {
          id: `task-${Date.now()}`,
          type: 'task',
          title: `🎯 Kịch bản ${skillTitle}`,
          content: compiledSkillSpec || `Sử dụng kỹ năng này để giải quyết công việc:\n\n${skillInstructions}`
        }
      ]
    };
    onApplyTemplate(template);
  };

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
              onClick={syncDataWithFirestore}
              disabled={isSyncing}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-350 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Đồng bộ hóa với đám mây Firestore"
            >
              <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
              <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ đám mây'}</span>
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

      {/* Main split grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0 items-stretch">
        
        {/* Left column: Sidebar selector */}
        <div className="lg:col-span-3 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 p-4 shadow-sm h-fit max-h-[500px] lg:max-h-none overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {activeSubTab === 'rules' ? 'Quy tắc & Cẩm nang' : 'Kỹ năng AI'}
            </h3>
            <button
              onClick={activeSubTab === 'rules' ? handleCreateNewRule : handleCreateNewSkill}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-500 hover:text-emerald-600 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200/50"
              title={activeSubTab === 'rules' ? 'Tạo quy tắc mới' : 'Tạo kỹ năng mới'}
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="space-y-1.5 overflow-y-auto max-h-[300px] lg:max-h-none pr-1">
            {activeSubTab === 'rules' ? (
              rules.map(r => (
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
              ))
            ) : (
              skills.map(s => (
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
              ))
            )}
          </div>
        </div>

        {/* Right column: Editor Workstation */}
        <div className="lg:col-span-9 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800 p-4 shadow-sm min-h-[500px]">
          
          {activeSubTab === 'rules' ? (
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
                  <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200/50 dark:border-slate-850">
                    <span className="text-[10px] font-bold text-slate-400 px-1">AI Model:</span>
                    <select
                      value={ruleOptModel}
                      onChange={(e) => setRuleOptModel(e.target.value)}
                      className="bg-transparent text-[10px] font-bold text-slate-600 dark:text-slate-300 focus:outline-none"
                    >
                      <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                    </select>
                  </div>

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
          ) : (
            /* ========================================================
               AI SKILLS WORKSTATION
               ======================================================== */
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

              {/* Dynamic Variables and Workflow Steps Manager */}
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

              {/* Instructions Markdown Editor */}
              <div className="flex flex-col bg-slate-50/50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 mt-2 overflow-hidden">
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-100/50 dark:bg-slate-900/50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Edit3 size={11} /> 3. Chỉ dẫn chi tiết Kỹ năng (Markdown Instructions)
                  </span>
                  
                  <button
                    onClick={handleAiAutoInstructions}
                    disabled={isCompilingSkill || isSkillPreset}
                    className="text-[9px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 px-2 py-1 rounded-md shadow-2xs flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  >
                    {isCompilingSkill ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />}
                    <span>Sinh hướng dẫn tự động bằng AI</span>
                  </button>
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

            </div>
          )}

        </div>
      </div>

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

    </div>
  );
}
