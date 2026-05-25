import React, { useState, useMemo } from 'react';
import { TEMPLATES } from '../data';
import { PromptTemplate } from '../types';
import { Search, Filter, TrendingUp, Sparkles, Clock, History, Layout, FileText, Code2, Video, GitMerge, GraduationCap, Play, Eye, BookOpen, Brain, Briefcase } from 'lucide-react';
import PromptCard from './PromptCard';
import PromptDetailModal from './PromptDetailModal';
import ExamplePreviewModal from './ExamplePreviewModal';

const MOCK_RESULTS: PromptTemplate[] = [
  {
    id: 'res-code',
    title: 'Tối ưu hóa mảng Javascript',
    description: 'Tối ưu hóa hàm lọc trùng lặp và tăng tốc hiệu năng vòng lặp O(N^2) cũ.',
    category: 'Mẫu của tôi',
    blocks: [],
    tags: ['JavaScript', 'Performance'],
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago
    outputExample: {
      type: 'code',
      title: 'JavaScript code',
      description: 'Hàm tối ưu hóa mảng Javascript',
      input: 'Viết cho tôi hàm loại bỏ phần tử trùng lặp trong mảng JS có hiệu suất cao nhất và tối ưu hóa bộ nhớ.',
      content: `// Code JS Tối ưu bậc nhất: Sử dụng Set (O(N) time complexity)
function removeDuplicates(arr) {
  const uniqueSet = new Set(arr);
  return Array.from(uniqueSet);
}

// Thử nghiệm thực tế với 1M phần tử:
// Cách thông thường (filter + indexOf): ~1800ms
// Cách tối ưu (Set): ~12ms (Nhanh gấp 150 lần!)`
    }
  },
  {
    id: 'res-video',
    title: 'Kịch bản TikTok 30s: Thói quen 5 AM',
    description: 'Kịch bản thu hút triệu views về thói quen kỷ luật tự giác dậy từ 5 giờ sáng.',
    category: 'Mẫu của tôi',
    blocks: [],
    tags: ['Content', 'TikTok', 'Video Script'],
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
    outputExample: {
      type: 'video',
      title: 'Kịch bản TikTok Shorts',
      description: 'Video ngắn 30s phát triển bản thân',
      input: 'Hãy soạn kịch bản video TikTok 30 giây đầy đủ hook, body và call to action về thói quen dậy sớm 5AM.',
      content: `[00:00 - 00:05] Hook: *Tiếng chuông điện thoại reo bíp bíp* Bạn vẫn nghĩ dậy lúc 5 giờ sáng chỉ dành cho người già? Sai lầm lớn nhất đời bạn đấy!
[00:05 - 00:20] Body: *Cảnh pha cafe nghi ngút khói* Trong khi cả thế giới đang ngủ, bạn có thêm 2 giờ yên tĩnh tuyệt đối để tập trung vào bản thân. Không tin nhắn công việc, không drama mạng xã hội, không xao nhãng. Đây là lúc người thành công bứt phá!
[00:20 - 00:30] Call to action: Hãy thử thách bản thân thức dậy lúc 5AM trong 7 ngày tới. Nhấn theo dõi mình để nhận bộ lịch trình chi tiết nhé!`
    }
  },
  {
    id: 'res-mindmap',
    title: 'Sơ đồ Lịch sử VN: Thời phong kiến',
    description: 'Bản đồ khái quát các triều đại Độc lập tự chủ từ Ngô, Đinh, Tiền Lê, Lý, Trần.',
    category: 'Mẫu của tôi',
    blocks: [],
    tags: ['History', 'Education', 'Mindmap'],
    createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(), // 2 hours ago
    outputExample: {
      type: 'mindmap',
      title: 'Sơ đồ tư duy lịch sử Việt Nam',
      description: 'Cấu trúc tiến trình các triều đại tự chủ',
      input: 'Tạo sơ đồ tư duy tóm tắt các mốc sự kiện chính của các triều đại phong kiến liên kết Việt Nam.',
      content: `## SƠ ĐỒ TIẾN TRÌNH LỊCH SỬ PHONG KIẾN TỰ CHỦ (Thế kỷ X - XV)

* 👑 NHÀ NGÔ (939 - 965)
  * Người lập quốc: Ngô Quyền (Chiến thắng sông Bạch Đằng)
  * Đóng đô: Cổ Loa

* 🛡️ NHÀ ĐINH (968 - 980)
  * Người lập quốc: Đinh Tiên Hoàng (Dẹp loạn 12 sứ quân)
  * Quốc hiệu: Đại Cồ Việt
  * Đóng đô: Hoa Lư

* 🗡️ NHÀ TIỀN LÊ (980 - 1009)
  * Người lập quốc: Lê Hoàn (Kháng chiến chống Tống vĩ đại)

* 🌸 NHÀ LÝ (1009 - 1125)
  * Người lập quốc: Lý Công Uẩn (Lý Thái Tổ)
  * Sự kiện lớn: Dời đô về Thăng Long (1010)
  * Di sản: Chiếu dời đô, Chùa Một Cột, Nam Quốc Sơn Hà`
    }
  },
  {
    id: 'res-tutor',
    title: 'Gia sư: Phương trình bậc hai lớp 9',
    description: 'Phương pháp phân tích nhân tử và hằng đẳng thức siêu trực quan cho học sinh.',
    category: 'Mẫu của tôi',
    blocks: [],
    tags: ['Math', 'Education', 'Tutor'],
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
    outputExample: {
      type: 'tutor',
      title: 'Gia sư Toán AI',
      description: 'Hướng dẫn giải chi tiết phương trình bậc 2',
      input: 'Hãy làm gia sư giải thích phương trình bậc hai x^2 - 4x + 4 = 0 cho học sinh trung học cơ sở dễ hiểu nhất.',
      content: `### 👋 Chào bạn! Cùng thầy chinh phục phương trình này nhé: x² - 4x + 4 = 0

Thay vì vội vã dùng công thức biệt thức Delta (Δ) dài dòng, chúng mình hãy quan sát thật kỹ cấu trúc của phương trình nhé:

* Nhận xét:
  x² chính là bình phương của biểu thức: **(x)²**
  4 chính là bình phương của biểu thức: **(2)²**
  -4x chính là hai lần tích của biểu thức thứ nhất và biểu thức thứ hai: **-2 * (x) * (2)**

* Áp dụng Hằng Đẳng Thức Đáng Nhớ: (A - B)² = A² - 2AB + B²
  Chúng ta viết lại phương trình thành:
  **(x - 2)² = 0**

* Giải phương trình đơn giản:
  x - 2 = 0  =>  **x = 2**

* Kết luận: Phương trình có nghiệm kép duy nhất x = 2. Cực kỳ nhanh và đẹp mắt đúng không nào!`
    }
  }
];

interface LibraryTabProps {
  onSelectTemplate: (template: PromptTemplate) => void;
  customTemplates?: PromptTemplate[];
}

const CATEGORIES = ['Tất cả', 'Công thức Prompt', 'Học sinh/Sinh viên', 'Người đi làm', 'Sáng tạo nội dung', 'Phát triển cá nhân', 'Mẫu của tôi'];

export default function LibraryTab({ onSelectTemplate, customTemplates = [] }: LibraryTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [activeTab, setActiveTab] = useState<'trending' | 'new' | 'following'>('trending');
  
  const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);
  const [previewPrompt, setPreviewPrompt] = useState<PromptTemplate | null>(null);

  const [userResults, setUserResults] = useState<PromptTemplate[]>(() => {
    const saved = localStorage.getItem('my_prompt_results');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return MOCK_RESULTS;
      }
    }
    localStorage.setItem('my_prompt_results', JSON.stringify(MOCK_RESULTS));
    return MOCK_RESULTS;
  });

  // Process custom templates to always have a category
  const processedCustomTemplates = customTemplates.map(t => ({
    ...t,
    category: t.category || 'Mẫu của tôi',
    authorName: t.authorName || 'Tôi (Chính bạn)',
    authorAvatar: t.authorAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    isVerified: true,
    metrics: t.metrics || { usageCount: 0, upvotes: 0, likes: 0, saves: 0 },
    createdAt: t.createdAt || new Date().toISOString()
  }));

  // Mock social data for standard templates
  const enrichedTemplates = TEMPLATES.map((t, i) => ({
    ...t,
    authorName: ['Alex Nguyen', 'Sarah Ha', 'Prompt Wizard', 'Tech Guru'][i % 4],
    authorAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`,
    isVerified: i % 3 === 0,
    metrics: {
      usageCount: Math.floor(Math.random() * 5000),
      upvotes: Math.floor(Math.random() * 1000),
      likes: Math.floor(Math.random() * 800),
      saves: Math.floor(Math.random() * 300)
    },
    createdAt: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString()
  }));

  const allTemplates = [...processedCustomTemplates, ...enrichedTemplates];

  const filteredTemplates = useMemo(() => {
    let result = allTemplates.filter(template => {
      const matchesSearch = template.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            template.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === 'Tất cả' || template.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });

    if (activeTab === 'trending') {
      result = result.sort((a, b) => ((b.metrics?.usageCount || 0) + (b.metrics?.likes || 0)) - ((a.metrics?.usageCount || 0) + (a.metrics?.likes || 0)));
    } else if (activeTab === 'new') {
      result = result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }

    return result;
  }, [allTemplates, searchTerm, selectedCategory, activeTab]);

  return (
    <div className="flex-1 p-6 flex flex-col overflow-y-auto bg-[#fafafa]">
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Cộng đồng <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md text-sm">Beta</span>
            </h2>
            <p className="text-slate-500 mt-2 text-sm font-medium">Khám phá, chia sẻ và remix các prompt template từ cộng đồng sáng tạo.</p>
          </div>
          <div className="relative w-full md:w-80">
            <input 
              type="text" 
              placeholder="Tìm kiếm prompt, tác giả..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 text-sm font-medium border-2 border-slate-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400" 
            />
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
          </div>
        </div>

        {/* Phần Kết quả của bạn (My Results) */}
        <div className="mb-8 bg-white border border-slate-200/60 rounded-3xl p-5 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100/85">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-2">
                  Kết quả của bạn <span className="text-indigo-600 text-[10px] font-bold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">4 kết quả gần đây</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">Lưu trữ các kết quả tối ưu hoá AI và sơ đồ bạn đã tạo gần đây dưới dạng các ảnh Thumbnail.</p>
              </div>
            </div>
            <div className="text-[10px] font-bold bg-slate-50 text-slate-500 px-2.5 py-1 rounded-full border border-slate-100 uppercase tracking-widest cursor-default select-none">
              Workspace Live
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {userResults.map((result) => {
              const isCode = result.outputExample?.type === 'code';
              const isVideo = result.outputExample?.type === 'video';
              const isMindmap = result.outputExample?.type === 'mindmap';
              const isTutor = result.outputExample?.type === 'tutor';

              return (
                <div 
                  key={result.id}
                  onClick={() => setPreviewPrompt(result)}
                  className="group relative flex flex-col justify-between h-44 rounded-2xl border border-slate-200/80 overflow-hidden bg-white hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 cursor-pointer"
                >
                  {/* Visual Thumbnail */}
                  <div className="flex-1 w-full bg-slate-50 relative overflow-hidden flex items-center justify-center p-3 select-none">
                    
                    {isCode && (
                      <div className="w-full h-full bg-[#0B0E14] rounded-xl p-2.5 font-mono text-[8px] text-[#A9B2C3] leading-snug overflow-hidden border border-slate-800 shadow-inner group-hover:scale-[1.02] transition-transform duration-300">
                        <div className="flex gap-1.2 items-center mb-1.5 border-b border-slate-800/80 pb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span className="text-[7.5px] text-slate-500 ml-1">unique.js</span>
                        </div>
                        <span className="text-pink-500">const</span> <span className="text-indigo-400">removeDups</span> = <span className="text-emerald-400">arr</span> =&gt; &#123;<br/>
                        &nbsp;&nbsp;<span className="text-pink-500">return</span> <span className="text-amber-400">Array</span>.from(<span className="text-pink-500">new</span> <span className="text-amber-400">Set</span>(arr));<br/>
                        &#125;
                      </div>
                    )}

                    {isVideo && (
                      <div className="w-full h-full bg-gradient-to-tr from-rose-500 to-pink-600 rounded-xl p-2.5 text-white flex flex-col justify-between overflow-hidden shadow-md group-hover:scale-[1.02] transition-transform duration-300 relative">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent)] pointer-events-none"></div>
                        <div className="flex justify-between items-center relative z-10">
                          <span className="text-[7.5px] font-black uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded-md backdrop-blur-sm">TikTok Shorts</span>
                          <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                            <Play className="w-2.5 h-2.5 text-white fill-white" />
                          </div>
                        </div>
                        <div className="text-[8.5px] font-extrabold leading-tight line-clamp-2 bg-black/15 p-1.5 rounded-lg backdrop-blur-[2px] border border-white/10 relative z-10">
                          "Hook: Thức dậy từ 5 giờ sáng bứt phá..."
                        </div>
                      </div>
                    )}

                    {isMindmap && (
                      <div className="w-full h-full bg-gradient-to-tr from-blue-500 to-indigo-700 rounded-xl p-2.5 text-white flex flex-col justify-between overflow-hidden shadow-md group-hover:scale-[1.02] transition-transform duration-300 relative">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.1),transparent)] pointer-events-none"></div>
                        <div className="flex justify-between items-center mb-1 relative z-10">
                          <span className="text-[7.5px] font-black uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded-md backdrop-blur-sm">SƠ ĐỒ TƯ DUY</span>
                          <Brain className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex-1 flex flex-col justify-center gap-1.5 pl-1.5 relative z-10">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            <span className="text-[8px] font-bold">👑 Nhà Lý (1009)</span>
                          </div>
                          <div className="w-[1.5px] h-2.5 bg-white/40 ml-[3px]"></div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                            <span className="text-[8px] font-bold">🛡️ Nhà Đinh (968)</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {isTutor && (
                      <div className="w-full h-full bg-[#fcfaf4] rounded-xl p-2.5 text-amber-900 border border-amber-100 flex flex-col justify-between overflow-hidden shadow-sm group-hover:scale-[1.02] transition-transform duration-300">
                        <div className="flex justify-between items-center">
                          <span className="text-[7.5px] font-black uppercase tracking-wider bg-amber-100/80 text-amber-800 px-1.5 py-0.5 rounded-md">Toán 9 Gia Sư</span>
                          <span className="text-[8px] text-amber-600 font-bold font-mono">f(x)=0</span>
                        </div>
                        <div className="font-serif text-[8.5px] italic text-amber-800 leading-normal pl-0.5">
                          Thay ví đổi delta dài dòng,<br /> áp dụng hằng đẳng thức:<br />
                          <span className="font-bold text-amber-950">(x - 2)² = 0  →  x = 2</span>
                        </div>
                      </div>
                    )}

                    {/* View overlay */}
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center backdrop-blur-[1px]">
                      <div className="bg-white text-slate-900 text-[10px] font-extrabold px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1 transform translate-y-1.5 group-hover:translate-y-0 transition-transform duration-200">
                        <Eye className="w-3.5 h-3.5 text-indigo-600" /> Xem chi tiết
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="px-3.5 py-2 border-t border-slate-100 bg-white flex flex-col gap-0.5 shrink-0">
                    <span className="text-[10px] font-bold text-slate-700 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                      {result.title}
                    </span>
                    <div className="flex items-center justify-between text-[8px] text-slate-400 font-semibold uppercase tracking-wider">
                      <span className="flex items-center gap-0.5">
                        {isCode && <Code2 className="w-2.5 h-2.5 text-slate-400" />}
                        {isVideo && <Video className="w-2.5 h-2.5 text-slate-400" />}
                        {isMindmap && <Brain className="w-2.5 h-2.5 text-slate-400" />}
                        {isTutor && <GraduationCap className="w-2.5 h-2.5 text-slate-400" />}
                        {result.outputExample?.description || 'AI Output'}
                      </span>
                      <span>{result.id === 'res-code' ? '5m trước' : result.id === 'res-video' ? '30m trước' : result.id === 'res-mindmap' ? '2h trước' : 'Hôm qua'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Social Tabs */}
        <div className="flex gap-6 border-b border-slate-200 mb-6">
          <button 
            onClick={() => setActiveTab('trending')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 transition-colors relative ${activeTab === 'trending' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <TrendingUp className="w-4 h-4" /> Trending
            {activeTab === 'trending' && <span className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></span>}
          </button>
          <button 
            onClick={() => setActiveTab('new')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 transition-colors relative ${activeTab === 'new' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Sparkles className="w-4 h-4" /> Mới nhất
            {activeTab === 'new' && <span className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></span>}
          </button>
          <button 
            onClick={() => setActiveTab('following')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 transition-colors relative ${activeTab === 'following' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Clock className="w-4 h-4" /> Đang theo dõi
            {activeTab === 'following' && <span className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></span>}
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all ${
                selectedCategory === category
                  ? 'bg-slate-800 text-white shadow-md shadow-slate-200'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
        {filteredTemplates.map((template) => (
          <PromptCard 
            key={template.id} 
            template={template as PromptTemplate} 
            onSelect={(t) => setSelectedPrompt(t)}
            onRemix={(t) => {
              onSelectTemplate(t);
            }}
            onPreview={(t) => setPreviewPrompt(t)}
          />
        ))}
        
        {filteredTemplates.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border border-slate-100">
             <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-slate-300" />
             </div>
             <p className="text-sm font-bold text-slate-600">Opps! Trống ở đây.</p>
             <p className="text-xs mt-1">Không tìm thấy mẫu nào phù hợp với bộ lọc hiện tại.</p>
          </div>
        )}
      </div>

      {selectedPrompt && (
        <PromptDetailModal 
          template={selectedPrompt} 
          onClose={() => setSelectedPrompt(null)} 
          onRemix={(t) => {
            setSelectedPrompt(null);
            onSelectTemplate(t);
          }} 
        />
      )}

      {previewPrompt && (
        <ExamplePreviewModal 
          template={previewPrompt}
          onClose={() => setPreviewPrompt(null)}
        />
      )}
    </div>
  );
}
