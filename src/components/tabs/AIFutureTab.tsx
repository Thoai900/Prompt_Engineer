import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Bot, Code, Cpu, Globe, Image as ImageIcon, Video, 
  Workflow, Zap, Shield, Search, ChevronRight, Copy, Check, Lock, Unlock,
  Layers, BarChart3, Clock, Rocket, Smile, RefreshCw, Play, Pause, 
  RotateCcw, HelpCircle, Send, Plus, Sliders, X, Activity, Eye, BookOpen, TrendingUp, Newspaper, Info
} from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { generateLatestAiNews, AiNewsItem } from '../../services/aiService';

type TabType = 'big3' | 'opensource' | 'specialized' | 'trends';
type ThreeMode = 'transformer' | 'vector';

// Initial semantic vector space nodes
const initialVectorNodes = [
  { id: '1', word: 'Trí Tuệ Nhân Tạo', category: 'core', pos: [0, 0, 0], definition: 'Khái niệm bao trùm về hệ thống máy tính mô phỏng trí tuệ con người.' },
  { id: '2', word: 'Học Máy (Machine Learning)', category: 'tech', pos: [-3.5, 1.8, -0.8], definition: 'Phân ngành AI giúp máy tính học hỏi từ dữ liệu mà không cần lập trình cụ thể.' },
  { id: '3', word: 'Học Sâu (Deep Learning)', category: 'tech', pos: [-5, 0.5, 1.2], definition: 'Kỹ thuật học máy sử dụng mạng nơ-ron sâu nhiều tầng.' },
  { id: '4', word: 'Mạng Nơ-ron (Neural Network)', category: 'tech', pos: [-2.5, -1.5, 2.5], definition: 'Mô hình tính toán phỏng sinh từ mạng lưới nơ-ron sinh học.' },
  { id: '5', word: 'LLM (Mô hình ngôn ngữ lớn)', category: 'model', pos: [-1.5, 2.5, 2.2], definition: 'Các mô hình AI được huấn luyện trên hàng tỷ từ để hiểu và tạo ngôn ngữ.' },
  { id: '6', word: 'Gemini (Google)', category: 'model', pos: [1.8, 3.2, 2.5], definition: 'Dòng mô hình đa phương tiện thế hệ mới nhất của Google.' },
  { id: '7', word: 'GPT (OpenAI)', category: 'model', pos: [2.2, 1.5, -2.5], definition: 'Dòng mô hình ngôn ngữ đột phá của OpenAI khởi đầu trào lưu AI.' },
  { id: '8', word: 'Claude (Anthropic)', category: 'model', pos: [3.2, 0.5, -1.2], definition: 'Mô hình AI chú trọng sự an toàn, trung thực và viết lách tự nhiên.' },
  { id: '9', word: 'Robot tự trị', category: 'robotics', pos: [2.8, -2.2, -2], definition: 'Hệ thống vật lý có thể tự di chuyển và thực hiện hành động độc lập.' },
  { id: '10', word: 'Đạo đức AI (Ethics)', category: 'society', pos: [0.8, -3.2, 2.8], definition: 'Quy chuẩn hành vi và triết lý sử dụng AI an toàn cho nhân loại.' },
  { id: '11', word: 'Chính sách & Luật lệ', category: 'society', pos: [2.8, -3.5, 0.8], definition: 'Khung pháp lý do các quốc gia ban hành để kiểm soát sự phát triển AI.' },
  { id: '12', word: 'Sáng tạo nội dung', category: 'creativity', pos: [-3.8, -2.8, -2.2], definition: 'Khả năng AI tự sinh văn bản, nhạc, họa và kịch bản nghệ thuật.' },
  { id: '13', word: 'Phần cứng GPU (Nvidia)', category: 'hardware', pos: [-5.2, 3.2, -2.2], definition: 'Bộ vi xử lý đồ họa chuyên sâu cung cấp sức mạnh tính toán cho AI.' },
  { id: '14', word: 'Prompt Engineering', category: 'core', pos: [-1.2, -1.8, -2.8], definition: 'Kỹ thuật thiết kế câu lệnh tối ưu để điều khiển LLM hiệu quả.' }
];

export default function AIFutureTab({ theme = 'dark' }: { theme?: 'light' | 'dark' }) {
  // Navigation tabs at bottom
  const [activeTab, setActiveTab] = useState<TabType>('big3');
  
  // 3D Visualizer States
  const [active3DMode, setActive3DMode] = useState<ThreeMode>('transformer');
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [rotationSpeed, setRotationSpeed] = useState(0.8);
  const [newWord, setNewWord] = useState('');
  const [newWordCategory, setNewWordCategory] = useState('tech');
  const [vectorNodes, setVectorNodes] = useState<any[]>(initialVectorNodes);

  // News States
  const [newsItems, setNewsItems] = useState<AiNewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsSearch, setNewsSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'models' | 'technology' | 'policy' | 'society'>('all');
  const [selectedImpact, setSelectedImpact] = useState<'all' | 'High' | 'Medium' | 'Low'>('all');
  const [activeNewsDetail, setActiveNewsDetail] = useState<AiNewsItem | null>(null);
  const [newsCopied, setNewsCopied] = useState<string | null>(null);
  const [agentLogs, setAgentLogs] = useState<string[]>([]);

  // Three.js refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationIdRef = useRef<number>(0);

  // Synchronizers refs to interact with the animation loop
  const isPlayingRef = useRef(isPlaying);
  const rotationSpeedRef = useRef(rotationSpeed);
  const active3DModeRef = useRef(active3DMode);
  const drawConnectionsTriggerRef = useRef<((selected: any) => void) | null>(null);
  const syncVectorNodesTriggerRef = useRef<((nodes: any[]) => void) | null>(null);

  // Keep refs updated to prevent re-running full useEffect
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { rotationSpeedRef.current = rotationSpeed; }, [rotationSpeed]);
  useEffect(() => { active3DModeRef.current = active3DMode; }, [active3DMode]);

  // Load News on Mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem('mentor_ai_news_cache');
      if (cached) {
        setNewsItems(JSON.parse(cached));
      }
    } catch (e) {
      console.error("Failed to parse cached news:", e);
    }
    loadNews();
  }, []);

  const simulateLogs = async () => {
    const logs = [
      "📡 Đang kết nối tới trạm dữ liệu AI toàn cầu...",
      "🔍 Quét các trang tin công nghệ và AI Press Hub...",
      "⚙️ Đang xử lý dữ liệu qua mô hình gemini-2.5-flash...",
      "📝 Tổng hợp tóm tắt bản tin và đánh giá chỉ số ảnh hưởng...",
      "✅ Hoàn tất! Đã cập nhật bản tin AI mới nhất."
    ];
    setAgentLogs([]);
    for (let i = 0; i < logs.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      setAgentLogs(prev => [...prev, logs[i]]);
    }
  };

  const loadNews = async () => {
    setNewsLoading(true);
    setNewsError(null);
    const logPromise = simulateLogs();
    
    try {
      const items = await generateLatestAiNews();
      await logPromise;
      if (items && items.length > 0) {
        setNewsItems(items);
        localStorage.setItem('mentor_ai_news_cache', JSON.stringify(items));
      } else {
        const cached = localStorage.getItem('mentor_ai_news_cache');
        if (cached) {
          setNewsItems(JSON.parse(cached));
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch latest AI news:", err);
      setNewsError(err.message || String(err));
      const cached = localStorage.getItem('mentor_ai_news_cache');
      if (cached) {
        try {
          setNewsItems(JSON.parse(cached));
        } catch (e) {}
      }
    } finally {
      setNewsLoading(false);
    }
  };

  // Add word to Vector Space
  const handleAddWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;

    if (vectorNodes.some(n => n.word.toLowerCase() === newWord.trim().toLowerCase())) {
      alert("Từ vựng này đã có mặt trong mạng lưới!");
      return;
    }

    // Spawn randomly on a sphere radius of 3.5 to 5.5
    const r = 3.5 + Math.random() * 2;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);

    const newWordNode = {
      id: `custom-${Date.now()}`,
      word: newWord.trim(),
      category: newWordCategory,
      pos: [x, y, z],
      definition: `Thuật ngữ do bạn phóng chiếu vào không gian ngữ nghĩa 3D.`
    };

    const updatedNodes = [...vectorNodes, newWordNode];
    setVectorNodes(updatedNodes);
    setSelectedNode(newWordNode);
    setNewWord('');
  };

  // Sync vector nodes change with Three.js scene
  useEffect(() => {
    if (syncVectorNodesTriggerRef.current) {
      syncVectorNodesTriggerRef.current(vectorNodes);
    }
  }, [vectorNodes]);

  // Synchronize clicked vector node connection line updates
  useEffect(() => {
    if (drawConnectionsTriggerRef.current) {
      drawConnectionsTriggerRef.current(selectedNode);
    }
  }, [selectedNode]);

  // Three.js Initializer Effect
  useEffect(() => {
    if (!canvasRef.current) return;

    // 1. WebGLRenderer Setup
    const container = canvasRef.current.parentElement;
    const width = container ? container.clientWidth || 800 : 800;
    const height = container ? container.clientHeight || 600 : 600;
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    // 2. Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 3. Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 13);
    cameraRef.current = camera;

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 25;
    controls.minDistance = 4;
    controlsRef.current = controls;

    // 5. Lights setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x6366f1, 2.5, 15);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

    // 6. Main groups representing modes
    const transformerGroup = new THREE.Group();
    const vectorGroup = new THREE.Group();
    const starsGroup = new THREE.Group();
    scene.add(transformerGroup);
    scene.add(vectorGroup);
    scene.add(starsGroup);

    // Add GridHelper to bottom for depth
    const gridColor1 = theme === 'dark' ? 0x4f46e5 : 0x818cf8;
    const gridColor2 = theme === 'dark' ? 0x1e1b4b : 0xe2e8f0;
    const gridHelper = new THREE.GridHelper(30, 30, gridColor1, gridColor2);
    gridHelper.position.y = -4.5;
    gridHelper.material.opacity = theme === 'dark' ? 0.15 : 0.4;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // Visibility toggling based on mode state
    transformerGroup.visible = active3DMode === 'transformer';
    vectorGroup.visible = active3DMode === 'vector';

    // 7. Background Stars
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 450;
    const starPos = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i++) {
      starPos[i] = (Math.random() - 0.5) * 35;
    }
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starsColor = theme === 'dark' ? 0x818cf8 : 0x4f46e5;
    const starsOpacity = theme === 'dark' ? 0.6 : 0.2;
    const starsMaterial = new THREE.PointsMaterial({
      color: starsColor,
      size: 0.05,
      transparent: true,
      opacity: starsOpacity
    });
    const starsPoints = new THREE.Points(starsGeometry, starsMaterial);
    starsGroup.add(starsPoints);

    // Canvas Text Label Helper
    const createTextSprite = (text: string, color: string = '#818cf8') => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = 'bold 24px Outfit, Inter, sans-serif';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (theme === 'dark') {
          ctx.shadowColor = color;
          ctx.shadowBlur = 6;
        }
        ctx.fillText(text, canvas.width / 2, ctx.canvas.height / 2);
      }
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(3, 0.75, 1);
      return sprite;
    };

    // ==========================================
    // 8. CONSTRUCT TRANSFORMER VISUALIZER
    // ==========================================
    const inputWords = ["Tôi", "yêu", "trí", "tuệ", "nhân", "tạo"];
    const inputNodes: { pos: THREE.Vector3, mesh: THREE.Mesh }[] = [];
    const hiddenNodes: { pos: THREE.Vector3, mesh: THREE.Mesh }[][] = [[], [], []];
    let outputNode: { pos: THREE.Vector3, mesh: THREE.Mesh } | null = null;

    // Inputs
    inputWords.forEach((word, idx) => {
      const y = 2.5 - idx * 1.0;
      const pos = new THREE.Vector3(-5.5, y, 0);
      const sphereMat = new THREE.MeshPhongMaterial({
        color: 0x3b82f6,
        emissive: 0x1d4ed8,
        emissiveIntensity: 0.4,
        shininess: 30
      });
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), sphereMat);
      sphere.position.copy(pos);
      transformerGroup.add(sphere);
      inputNodes.push({ pos, mesh: sphere });

      const labelColor = theme === 'dark' ? '#93c5fd' : '#1e3a8a';
      const label = createTextSprite(word, labelColor);
      label.position.copy(pos).add(new THREE.Vector3(0, 0.35, 0));
      transformerGroup.add(label);
    });

    // Hidden Attention Columns
    const xCoordinates = [-2, 0.5, 3];
    const columnCount = 5;
    xCoordinates.forEach((x, colIdx) => {
      for (let i = 0; i < columnCount; i++) {
        const y = 2 - i * 1.0;
        const pos = new THREE.Vector3(x, y, (Math.random() - 0.5) * 0.6);
        const sphereMat = new THREE.MeshPhongMaterial({
          color: 0x8b5cf6,
          emissive: 0x5b21b6,
          emissiveIntensity: 0.4,
          shininess: 30
        });
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), sphereMat);
        sphere.position.copy(pos);
        transformerGroup.add(sphere);
        hiddenNodes[colIdx].push({ pos, mesh: sphere });
      }
    });

    // Output
    const outPos = new THREE.Vector3(5.5, 0, 0);
    const outSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 24, 24),
      new THREE.MeshPhongMaterial({
        color: 0x10b981,
        emissive: 0x065f46,
        emissiveIntensity: 0.5,
        shininess: 50
      })
    );
    outSphere.position.copy(outPos);
    transformerGroup.add(outSphere);
    outputNode = { pos: outPos, mesh: outSphere };

    const outLabelColor = theme === 'dark' ? '#34d399' : '#047857';
    const outLabel = createTextSprite("AI", outLabelColor);
    outLabel.position.copy(outPos).add(new THREE.Vector3(0, 0.45, 0));
    transformerGroup.add(outLabel);

    // Static low-opacity lines connecting nodes
    const transLineMat = new THREE.LineBasicMaterial({
      color: theme === 'dark' ? 0x6366f1 : 0x4f46e5,
      transparent: true,
      opacity: theme === 'dark' ? 0.12 : 0.22
    });

    // Input to Col 0
    inputNodes.forEach(inN => {
      hiddenNodes[0].forEach(h0 => {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([inN.pos, h0.pos]);
        transformerGroup.add(new THREE.Line(lineGeo, transLineMat));
      });
    });

    // Col 0 to Col 1
    hiddenNodes[0].forEach(h0 => {
      hiddenNodes[1].forEach(h1 => {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([h0.pos, h1.pos]);
        transformerGroup.add(new THREE.Line(lineGeo, transLineMat));
      });
    });

    // Col 1 to Col 2
    hiddenNodes[1].forEach(h1 => {
      hiddenNodes[2].forEach(h2 => {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([h1.pos, h2.pos]);
        transformerGroup.add(new THREE.Line(lineGeo, transLineMat));
      });
    });

    // Col 2 to Output
    hiddenNodes[2].forEach(h2 => {
      if (outputNode) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([h2.pos, outputNode.pos]);
        transformerGroup.add(new THREE.Line(lineGeo, transLineMat));
      }
    });

    // Attention Wave Pulses Animation Data
    interface TransformerPulse {
      mesh: THREE.Mesh;
      path: THREE.Vector3[];
      progress: number;
      speed: number;
    }
    const transPulses: TransformerPulse[] = [];
    const pulseCount = 18;

    const buildPath = (): THREE.Vector3[] => {
      const p: THREE.Vector3[] = [];
      p.push(inputNodes[Math.floor(Math.random() * inputNodes.length)].pos);
      p.push(hiddenNodes[0][Math.floor(Math.random() * hiddenNodes[0].length)].pos);
      p.push(hiddenNodes[1][Math.floor(Math.random() * hiddenNodes[1].length)].pos);
      p.push(hiddenNodes[2][Math.floor(Math.random() * hiddenNodes[2].length)].pos);
      if (outputNode) p.push(outputNode.pos);
      return p;
    };

    const pulseGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });

    for (let i = 0; i < pulseCount; i++) {
      const m = new THREE.Mesh(pulseGeo, pulseMat);
      transformerGroup.add(m);
      transPulses.push({
        mesh: m,
        path: buildPath(),
        progress: Math.random(), // scatter positions
        speed: 0.008 + Math.random() * 0.012
      });
    }

    // ==========================================
    // 9. CONSTRUCT VECTOR SPACE VISUALIZER
    // ==========================================
    const vecMeshes: THREE.Mesh[] = [];
    const vecSprites: THREE.Sprite[] = [];
    let vecLines: THREE.Line[] = [];

    const drawVectorNodes = (nodes: typeof initialVectorNodes) => {
      // Clean previous
      vecMeshes.forEach(m => vectorGroup.remove(m));
      vecSprites.forEach(s => vectorGroup.remove(s));
      vecMeshes.length = 0;
      vecSprites.length = 0;
      vecLines.forEach(l => vectorGroup.remove(l));
      vecLines.length = 0;

      nodes.forEach(node => {
        const vPos = new THREE.Vector3(node.pos[0], node.pos[1], node.pos[2]);
        
        let color = 0x818cf8;
        let fontColor = theme === 'dark' ? '#c7d2fe' : '#312e81';
        if (node.category === 'core') { 
          color = 0xf43f5e; 
          fontColor = theme === 'dark' ? '#fecdd3' : '#9f1239'; 
        } else if (node.category === 'model') { 
          color = 0x10b981; 
          fontColor = theme === 'dark' ? '#a7f3d0' : '#065f46'; 
        } else if (node.category === 'society') { 
          color = 0xf59e0b; 
          fontColor = theme === 'dark' ? '#fef3c7' : '#92400e'; 
        } else if (node.category === 'creativity') { 
          color = 0xd946ef; 
          fontColor = theme === 'dark' ? '#f5d0fe' : '#86198f'; 
        } else if (node.category === 'hardware') { 
          color = 0xf97316; 
          fontColor = theme === 'dark' ? '#ffedd5' : '#9a3412'; 
        }

        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 16, 16),
          new THREE.MeshPhongMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.35,
            shininess: 40
          })
        );
        sphere.position.copy(vPos);
        sphere.userData = node;
        vectorGroup.add(sphere);
        vecMeshes.push(sphere);

        const sprite = createTextSprite(node.word, fontColor);
        sprite.position.copy(vPos).add(new THREE.Vector3(0, 0.4, 0));
        vectorGroup.add(sprite);
        vecSprites.push(sprite);
      });
    };

    drawVectorNodes(vectorNodes);

    // Raycast intersection setup
    const raycaster = new THREE.Raycaster();
    const mouse2D = new THREE.Vector2();
    let prevHovered: THREE.Mesh | null = null;

    const onCanvasClick = (event: MouseEvent) => {
      if (active3DModeRef.current !== 'vector') return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse2D.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse2D.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse2D, camera);
      const hits = raycaster.intersectObjects(vecMeshes);
      if (hits.length > 0) {
        const hitSphere = hits[0].object as THREE.Mesh;
        setSelectedNode(hitSphere.userData);
      }
    };

    const onCanvasMouseMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse2D.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse2D.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      if (active3DModeRef.current === 'vector') {
        raycaster.setFromCamera(mouse2D, camera);
        const hits = raycaster.intersectObjects(vecMeshes);
        if (hits.length > 0) {
          const firstHit = hits[0].object as THREE.Mesh;
          if (prevHovered !== firstHit) {
            if (prevHovered) prevHovered.scale.set(1, 1, 1);
            prevHovered = firstHit;
            prevHovered.scale.set(1.35, 1.35, 1.35);
            document.body.style.cursor = 'pointer';
          }
        } else {
          if (prevHovered) {
            prevHovered.scale.set(1, 1, 1);
            prevHovered = null;
          }
          document.body.style.cursor = 'default';
        }
      }
    };

    renderer.domElement.addEventListener('click', onCanvasClick);
    renderer.domElement.addEventListener('mousemove', onCanvasMouseMove);

    // ==========================================
    // Selected Node Connections Drawing
    // ==========================================
    const renderNodeConnections = (selected: any) => {
      vecLines.forEach(l => vectorGroup.remove(l));
      vecLines.length = 0;
      
      // Reset scale of all meshes first
      vecMeshes.forEach(m => {
        if (m.userData.id !== selected?.id) m.scale.set(1, 1, 1);
      });

      if (!selected) return;

      const originMesh = vecMeshes.find(m => m.userData.id === selected.id);
      if (!originMesh) return;

      // Scale up chosen
      originMesh.scale.set(1.4, 1.4, 1.4);
      const originPos = originMesh.position;

      // Find 3 closest neighbors by distance
      const withDistance = vecMeshes
        .filter(m => m.userData.id !== selected.id)
        .map(m => ({
          mesh: m,
          dist: originPos.distanceTo(m.position)
        }))
        .sort((a, b) => a.dist - b.dist);

      const nearest = withDistance.slice(0, 3);
      const connectionLineMat = new THREE.LineBasicMaterial({
        color: theme === 'dark' ? 0x06b6d4 : 0x0891b2,
        linewidth: 2,
        transparent: true,
        opacity: 0.8
      });

      nearest.forEach(n => {
        const lineGeo = new THREE.BufferGeometry().setFromPoints([originPos, n.mesh.position]);
        const line = new THREE.Line(lineGeo, connectionLineMat);
        vectorGroup.add(line);
        vecLines.push(line);
        // Highlight neighbors too
        n.mesh.scale.set(1.18, 1.18, 1.18);
      });

      // Lerp camera controls target to center selected node
      controls.target.lerp(originPos, 0.1);
    };

    drawConnectionsTriggerRef.current = renderNodeConnections;
    syncVectorNodesTriggerRef.current = drawVectorNodes;

    // Trigger connections render if selectedNode state already exists when mode toggles
    if (selectedNode) {
      renderNodeConnections(selectedNode);
    }

    // ==========================================
    // ANIMATION & RESIZE LOOPS
    // ==========================================
    const clock = new THREE.Clock();

    const tick = () => {
      animationIdRef.current = requestAnimationFrame(tick);

      const delta = clock.getDelta();
      const speed = rotationSpeedRef.current;

      // Spin groups if isPlaying
      if (isPlayingRef.current) {
        transformerGroup.rotation.y += 0.04 * speed * delta;
        vectorGroup.rotation.y += 0.06 * speed * delta;
        starsGroup.rotation.y += 0.015 * speed * delta;
      }

      // Pulse flow animation in transformer
      if (active3DModeRef.current === 'transformer' && isPlayingRef.current) {
        transPulses.forEach(p => {
          p.progress += p.speed * speed;
          if (p.progress >= 1) {
            p.progress = 0;
            p.path = buildPath();
          }

          const segCount = p.path.length - 1;
          const routeProgress = p.progress * segCount;
          const currentSegIdx = Math.floor(routeProgress);
          const localPercent = routeProgress - currentSegIdx;

          if (currentSegIdx < segCount) {
            const start = p.path[currentSegIdx];
            const end = p.path[currentSegIdx + 1];
            p.mesh.position.lerpVectors(start, end, localPercent);
          }
        });
      }

      controls.update();
      renderer.render(scene, camera);
    };

    tick();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w === 0 || h === 0) continue;
        if (cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });

    if (container) {
      resizeObserver.observe(container);
    }

    return () => {
      cancelAnimationFrame(animationIdRef.current);
      if (container) {
        resizeObserver.unobserve(container);
      }
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('click', onCanvasClick);
      renderer.domElement.removeEventListener('mousemove', onCanvasMouseMove);
      renderer.dispose();
    };
  }, [active3DMode, theme]);

  // Utility copy helper for news item
  const handleCopyNews = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setNewsCopied(id);
    setTimeout(() => setNewsCopied(null), 2000);
  };

  // Filters calculation
  const filteredNews = newsItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(newsSearch.toLowerCase()) || 
                          item.summary.toLowerCase().includes(newsSearch.toLowerCase()) ||
                          item.source.toLowerCase().includes(newsSearch.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesImpact = selectedImpact === 'all' || item.impactLevel === selectedImpact;
    return matchesSearch && matchesCategory && matchesImpact;
  });

  return (
    <div className="h-full bg-[#FAFAFA] dark:bg-[#0a0a0f] text-slate-900 dark:text-slate-50 overflow-y-auto custom-scrollbar relative transition-colors duration-300">
      {/* Background radial glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 relative z-10">
        
        {/* HEADER */}
        <div className="text-center mb-10">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-semibold text-indigo-600 dark:text-indigo-300 mb-4 shadow-sm dark:shadow-none backdrop-blur-md"
          >
            <Sparkles size={13} className="text-indigo-500 dark:text-indigo-400 animate-pulse" />
            AI Labs 2026 Sandbox
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3"
          >
            Không Gian Tương Tác <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 dark:from-blue-400 dark:via-indigo-400 dark:to-emerald-400">3D & Tin Tức AI</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-sm md:text-base"
          >
            Khám phá mô hình suy luận 3D của các mạng thần kinh Transformer, du hành tinh vân ngữ nghĩa vector, và cập nhật tin tức AI trực tiếp từ tác nhân AI.
          </motion.p>
        </div>

        {/* SECTION 1: 3D AI VISUALIZATION ARENA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-12">
          
          {/* 3D Viewport Column */}
          <div className="lg:col-span-8 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-4 backdrop-blur-md flex flex-col h-[500px] md:h-[620px] relative overflow-hidden group shadow-sm dark:shadow-none">
            {/* Visualizer Header */}
            <div className="flex flex-wrap justify-between items-center gap-3 z-20 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping"></div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  3D Simulation Mode: {active3DMode === 'transformer' ? 'Transformer Token Flow' : 'Semantic Vector Space'}
                </span>
              </div>
              <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/5">
                <button
                  onClick={() => { setActive3DMode('transformer'); setSelectedNode(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    active3DMode === 'transformer' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Workflow size={13} /> Flow Token
                </button>
                <button
                  onClick={() => { setActive3DMode('vector'); setSelectedNode(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    active3DMode === 'vector' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Globe size={13} /> Không gian Vector
                </button>
              </div>
            </div>

            {/* Help tooltip */}
            <div className="absolute bottom-6 left-6 z-20 pointer-events-none bg-white/90 dark:bg-slate-950/80 border border-slate-250 dark:border-white/5 px-3 py-2 rounded-xl backdrop-blur-sm text-[10px] text-slate-500 dark:text-slate-400 space-y-1 shadow-md">
              <p className="flex items-center gap-1"><HelpCircle size={10} className="text-indigo-500 dark:text-indigo-400" /> Tương tác 3D:</p>
              <p>• Chuột trái & kéo: Xoay camera</p>
              <p>• Cuộn chuột: Thu phóng không gian</p>
              {active3DMode === 'vector' && <p>• Nhấp vào node: Xem độ tương đồng ngữ nghĩa</p>}
            </div>

            {/* WebGL Canvas */}
            <div className="flex-1 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-white/5 relative">
              <canvas ref={canvasRef} className="w-full h-full block rounded-xl outline-none" />
              
              {/* Reset view overlay */}
              <button 
                onClick={() => {
                  if (cameraRef.current && controlsRef.current) {
                     cameraRef.current.position.set(0, 0, 13);
                     controlsRef.current.target.set(0, 0, 0);
                     controlsRef.current.update();
                  }
                }}
                title="Đặt lại camera"
                className="absolute top-4 right-4 p-2 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 transition-colors shadow-sm cursor-pointer"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* Interactive Controls & Metadata Panel Column */}
          <div className="lg:col-span-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 backdrop-blur-md flex flex-col justify-between h-[500px] md:h-[620px] shadow-sm dark:shadow-none">
            
            {/* Upper Content - Controls & Mode descriptions */}
            <div className="space-y-6 overflow-y-auto custom-scrollbar flex-1 pr-1">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
                  <Sliders size={18} className="text-indigo-500 dark:text-indigo-400" /> Bảng Điều Khiển 3D
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Tùy chỉnh các thông số hiển thị và cơ chế giả lập của mô hình WebGL thời gian thực.
                </p>
              </div>

              {/* General physics controls */}
              <div className="space-y-4 bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-200 dark:border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Vận hành động lực học</span>
                  <button 
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      isPlaying ? 'bg-indigo-50 dark:bg-indigo-600/30 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5'
                    }`}
                  >
                    {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                    {isPlaying ? "Đang chạy" : "Tạm dừng"}
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Tốc độ tự quay tinh vân</span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-300">{rotationSpeed.toFixed(1)}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="2" 
                    step="0.1" 
                    value={rotationSpeed}
                    onChange={(e) => setRotationSpeed(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>

              {/* Mode-specific detail boxes */}
              <AnimatePresence mode="wait">
                {active3DMode === 'transformer' ? (
                  <motion.div
                    key="trans-panel"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    <div className="bg-blue-500/5 border border-blue-500/10 dark:border-blue-500/20 p-4 rounded-2xl">
                      <h4 className="text-sm font-bold text-blue-600 dark:text-blue-300 flex items-center gap-1.5 mb-2">
                        <Workflow size={15} /> Cơ Chế Tokenization Flow
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        Mô phỏng chuỗi từ ngữ đầu vào phân rã thành các <strong className="text-blue-600 dark:text-blue-300">Tokens</strong>. Các luồng hạt đại diện cho quá trình truyền tải giá trị tính toán Attention qua các lớp ẩn (Hidden Layers) để tính toán ma trận trọng số. Cuối cùng, hội tụ tại node kết quả để dự phóng Token kế tiếp.
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-white/5 space-y-2.5">
                      <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">TOKEN PIPELINE SIMULATOR</span>
                      <div className="space-y-1.5 font-mono text-[10px] text-slate-555 dark:text-slate-400">
                        <div className="flex justify-between">
                          <span>Input String:</span>
                          <span className="text-blue-600 dark:text-blue-300">"Tôi yêu trí tuệ nhân tạo"</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tokenizer:</span>
                          <span className="text-purple-600 dark:text-purple-300">BPE (Byte-Pair Encoding)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Tokens:</span>
                          <span className="text-slate-800 dark:text-slate-200">6 (IDs: [342, 1928, 481, 742, 92, 102])</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Attention Heads:</span>
                          <span className="text-amber-600 dark:text-amber-400">8 Heads Parallel</span>
                        </div>
                        <div className="flex justify-between">
                          <span>ArgMax Output:</span>
                          <span className="text-emerald-600 dark:text-emerald-400">"AI" (Score: 0.982)</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="vec-panel"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    {/* Add Word Form */}
                    <form onSubmit={handleAddWord} className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 p-4 rounded-2xl space-y-3">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Dự phóng từ mới vào Vector 3D</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Nhập từ vựng..."
                          value={newWord}
                          onChange={(e) => setNewWord(e.target.value)}
                          className="flex-1 bg-white dark:bg-slate-950 border border-slate-250 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white transition-colors flex items-center justify-center cursor-pointer"
                        >
                          <Plus size={14} /> Phóng
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { val: 'tech', label: 'Học thuật' },
                          { val: 'model', label: 'Mô hình' },
                          { val: 'creativity', label: 'Sáng tạo' }
                        ].map(c => (
                          <button
                            key={c.val}
                            type="button"
                            onClick={() => setNewWordCategory(c.val)}
                            className={`px-1.5 py-1 text-[9px] font-bold border rounded-lg transition-colors cursor-pointer ${
                              newWordCategory === c.val 
                                ? 'bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30 shadow-sm' 
                                : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5 hover:bg-slate-200 dark:hover:bg-slate-800'
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </form>

                    {/* Show selected node metadata */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-white/5 space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/5 pb-2">
                        <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">VECTOMETRIC DATA</span>
                        {selectedNode && (
                          <button 
                            onClick={() => setSelectedNode(null)}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-white/5 rounded text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      
                      {selectedNode ? (
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm font-bold text-indigo-700 dark:text-indigo-200">{selectedNode.word}</span>
                            <span className="inline-block text-[9px] uppercase px-1.5 py-0.5 ml-2 font-bold rounded bg-indigo-55 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 shadow-sm">
                              {selectedNode.category}
                            </span>
                          </div>
                          
                          <p className="text-[11px] text-slate-655 dark:text-slate-400 leading-relaxed font-sans">
                            {selectedNode.definition}
                          </p>

                          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 space-y-1 border-t border-slate-200 dark:border-white/5 pt-2">
                            <div className="flex justify-between">
                              <span>3D Coordinates:</span>
                              <span className="text-slate-800 dark:text-slate-200">[{selectedNode.pos[0].toFixed(2)}, {selectedNode.pos[1].toFixed(2)}, {selectedNode.pos[2].toFixed(2)}]</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Độ tương đồng lớn nhất:</span>
                              <span className="text-cyan-700 dark:text-cyan-400">Cosine Similarity (3 Nodes)</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 dark:text-slate-500 italic py-4 text-center">
                          Nhấp chuột vào bất kỳ khối tròn từ vựng nào trên màn hình 3D để quét dữ liệu ngữ nghĩa.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Lower Area - Quick Footer */}
            <div className="border-t border-white/5 pt-4 text-[10px] text-slate-500 flex justify-between">
              <span>Engine: Three.js WebGL</span>
              <span>Coordinates System: Cartesian 3D</span>
            </div>
          </div>
        </div>

        {/* SECTION 2: LIVE AI NEWS TERMINAL */}
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-md mb-12 shadow-sm dark:shadow-none">
          
          {/* Header Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/15 pb-6 mb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Newspaper className="text-emerald-500 dark:text-emerald-400" size={20} />
                <h2 className="text-2xl font-bold text-slate-850 dark:text-white">Bản Tin Trí Tuệ Nhân Tạo 2026</h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                AI Agent quét thông tin, dịch thuật và tổng hợp bản tin công nghệ thời gian thực bằng mô hình <strong className="text-indigo-650 dark:text-indigo-300">gemini-2.5-flash</strong>.
              </p>
            </div>
            
            <button
              onClick={loadNews}
              disabled={newsLoading}
              className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-2 shadow-md ${
                newsLoading 
                  ? 'bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-white/5 cursor-not-allowed text-slate-400 dark:text-slate-500' 
                  : 'bg-emerald-600 hover:bg-emerald-500 cursor-pointer shadow-emerald-950/20'
              }`}
            >
              <RefreshCw size={14} className={newsLoading ? 'animate-pulse text-emerald-500' : ''} />
              {newsLoading ? 'Đang nạp tin tức AI...' : 'Làm mới tin tức'}
            </button>
          </div>

          {newsError && (
            <div className="mb-6 p-4 rounded-2xl border border-amber-250 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-400 flex items-center gap-2 shadow-xs">
              <Info size={14} className="shrink-0 text-amber-600 dark:text-amber-500" />
              <span>Không thể kết nối đến máy chủ tin tức AI (mô hình đang quá tải hoặc hết lượt gọi). Đang hiển thị bản tin cũ được lưu từ bộ nhớ tạm.</span>
            </div>
          )}

          {/* Filtering and Searching Bar */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8 bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-200 dark:border-white/5">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-2.5 text-slate-400 dark:text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Tìm kiếm nội dung tin tức..."
                value={newsSearch}
                onChange={(e) => setNewsSearch(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/15 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="flex bg-white dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-white/5">
                {[
                  { id: 'all', name: 'Tất cả' },
                  { id: 'models', name: 'Mô hình AI' },
                  { id: 'technology', name: 'Công nghệ' },
                  { id: 'policy', name: 'Luật lệ' },
                  { id: 'society', name: 'Xã hội' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedCategory === cat.id ? 'bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              <div className="flex bg-white dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-white/5">
                {[
                  { id: 'all', name: 'Mức tác động' },
                  { id: 'High', name: 'Cao 🔥' },
                  { id: 'Medium', name: 'Trung bình' }
                ].map(imp => (
                  <button
                    key={imp.id}
                    onClick={() => setSelectedImpact(imp.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedImpact === imp.id ? 'bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {imp.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grid list display */}
          {newsLoading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
              {/* Futuristic logs printing loader */}
              <div className="w-full max-w-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-white/5 rounded-2xl p-5 font-mono text-[11px] text-emerald-650 dark:text-emerald-400/80 space-y-2 shadow-inner">
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/5 pb-2 text-slate-400 dark:text-slate-500 mb-2">
                  <Activity size={12} className="animate-pulse" />
                  <span>AI AGENT LIVE PARSING SHELL</span>
                </div>
                {agentLogs.map((log, index) => (
                  <motion.div 
                    key={index} 
                    initial={{ opacity: 0, x: -5 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    className="leading-relaxed"
                  >
                    {log}
                  </motion.div>
                ))}
                <div className="w-1.5 h-3.5 bg-emerald-650 dark:bg-emerald-400 animate-pulse inline-block mt-2"></div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">Mô hình AI đang tổng hợp các bài viết...</p>
            </div>
          ) : filteredNews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredNews.map((news) => {
                let categoryColor = "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-205 dark:border-blue-500/20";
                let categoryLabel = "Mô hình";
                if (news.category === 'technology') { categoryColor = "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-205 dark:border-purple-500/20"; categoryLabel = "Công nghệ"; }
                else if (news.category === 'policy') { categoryColor = "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-205 dark:border-amber-500/20"; categoryLabel = "Chính sách"; }
                else if (news.category === 'society') { categoryColor = "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-205 dark:border-rose-500/20"; categoryLabel = "Xã hội"; }

                const isHigh = news.impactLevel === 'High';

                return (
                  <motion.div
                    key={news.id}
                    layoutId={news.id}
                    className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15 rounded-2xl p-5 flex flex-col justify-between transition-all group hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-950/5 relative overflow-hidden"
                  >
                    {isHigh && (
                      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-red-500 to-amber-500"></div>
                    )}
                    
                    <div className="space-y-3">
                      {/* Top tags */}
                      <div className="flex justify-between items-center">
                        <span className={`text-[10px] uppercase px-2 py-0.5 font-bold rounded-lg border ${categoryColor}`}>
                          {categoryLabel}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">{news.date}</span>
                          <span className={`w-1.5 h-1.5 rounded-full ${isHigh ? 'bg-red-500 animate-pulse' : 'bg-slate-405 dark:bg-slate-500'}`}></span>
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="font-bold text-sm text-slate-850 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors leading-snug">
                        {news.title}
                      </h3>

                      {/* Summary snippet */}
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">
                        {news.summary}
                      </p>
                    </div>

                    {/* Card Footer action */}
                    <div className="border-t border-slate-150 dark:border-white/5 pt-4 mt-4 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-medium">Nguồn: {news.source}</span>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyNews(news.id, `${news.title}\n\n${news.summary}`)}
                          className="p-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                          title="Sao chép tóm tắt"
                        >
                          {newsCopied === news.id ? <Check size={12} className="text-emerald-500 dark:text-emerald-400" /> : <Copy size={12} />}
                        </button>
                        <button
                          onClick={() => setActiveNewsDetail(news)}
                          className="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-600/10 hover:bg-indigo-650 dark:hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 hover:text-white dark:hover:text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
                        >
                          Xem phân tích <ChevronRight size={10} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Newspaper className="mx-auto text-slate-400 dark:text-slate-600 mb-2" size={32} />
              <p className="text-xs text-slate-500 dark:text-slate-400">Không tìm thấy bản tin nào khớp với điều kiện lọc.</p>
            </div>
          )}
        </div>

        {/* SECTION 3: GLOBAL AI KNOWLEDGE BASE */}
        <div className="border-t border-slate-200 dark:border-white/10 pt-10">
          <div className="text-center mb-8">
            <h2 className="text-xl md:text-2xl font-bold flex items-center justify-center gap-2 mb-2 text-slate-800 dark:text-white">
              <BookOpen className="text-indigo-500 dark:text-indigo-400" size={20} /> Bản Đồ Kiến Thức AI Toàn Cầu
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
              Nắm bắt các thông tin lý thuyết cốt lõi về sự phát triển của hệ sinh thái trí tuệ nhân tạo hiện đại.
            </p>
          </div>

          {/* Navigation tabs */}
          <div className="flex justify-center mb-8">
            <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl backdrop-blur-md border border-slate-200 dark:border-white/10 overflow-x-auto max-w-full">
              <NavButton active={activeTab === 'big3'} onClick={() => setActiveTab('big3')} icon={<Lock size={12} />}>The Big Three</NavButton>
              <NavButton active={activeTab === 'opensource'} onClick={() => setActiveTab('opensource')} icon={<Unlock size={12} />}>Mã Nguồn Mở</NavButton>
              <NavButton active={activeTab === 'specialized'} onClick={() => setActiveTab('specialized')} icon={<Layers size={12} />}>Chuyên Dụng</NavButton>
              <NavButton active={activeTab === 'trends'} onClick={() => setActiveTab('trends')} icon={<Rocket size={12} />}>Xu Hướng 2026</NavButton>
            </div>
          </div>

          {/* Content tab area */}
          <div className="min-h-[300px]">
            <AnimatePresence mode="wait">
              {activeTab === 'big3' && <BigThreeSection key="big3" />}
              {activeTab === 'opensource' && <OpenSourceSection key="opensource" />}
              {activeTab === 'specialized' && <SpecializedSection key="specialized" />}
              {activeTab === 'trends' && <TrendsSection key="trends" />}
            </AnimatePresence>
          </div>
        </div>

      </div>

      {/* DETAIL OVERLAY MODAL */}
      <AnimatePresence>
        {activeNewsDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveNewsDetail(null)}
              className="absolute inset-0 bg-slate-950/40 dark:bg-slate-950/80 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl bg-white dark:bg-[#0d0e15] border border-slate-200 dark:border-white/10 rounded-3xl p-6 md:p-8 relative z-10 shadow-2xl flex flex-col max-h-[85vh] overflow-y-auto custom-scrollbar"
            >
              {/* Close Button */}
              <button 
                onClick={() => setActiveNewsDetail(null)}
                className="absolute top-6 right-6 p-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                <X size={16} />
              </button>

              {/* Category & Date */}
              <div className="flex items-center gap-2.5 mb-4">
                <span className="text-[10px] uppercase px-2 py-0.5 font-bold rounded-lg border bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20">
                  {activeNewsDetail.category}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{activeNewsDetail.date}</span>
                <span className="text-xs text-slate-500">• Nguồn: {activeNewsDetail.source}</span>
              </div>

              {/* Title */}
              <h2 className="text-xl md:text-2xl font-bold mb-4 text-slate-900 dark:text-white leading-snug">
                {activeNewsDetail.title}
              </h2>

              {/* Core Content */}
              <div className="space-y-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 space-y-1">
                  <h4 className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 uppercase">Tóm tắt nội dung</h4>
                  <p>{activeNewsDetail.summary}</p>
                </div>

                {/* AI Analysis section */}
                <div className="space-y-4 border-t border-slate-100 dark:border-white/5 pt-4">
                  <h3 className="text-base font-bold flex items-center gap-2 text-indigo-650 dark:text-indigo-300">
                    <Bot size={18} /> Phân Tích Độc Quyền bởi AI Agent
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-white/5 space-y-1">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Mức độ ảnh hưởng</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {activeNewsDetail.impactLevel === 'High' 
                          ? '🔥 Tác động cực kỳ lớn: Làm thay đổi lộ trình công nghệ hiện có, thúc đẩy nâng cấp hạ tầng mã nguồn rộng rãi.' 
                          : '⚡ Tác động trung bình: Cải tiến hiệu quả làm việc hiện tại, mở ra các tính năng bổ trợ hữu ích.'}
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-white/5 space-y-1">
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Khuyến nghị cho Prompt Engineer</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Nên thử nghiệm lập cấu hình bộ nhớ LLM (Memory) hoặc thiết lập System Instructions tương thích với cải tiến mới này để đón đầu hiệu năng.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-slate-100 dark:border-white/5 pt-6 mt-8 flex justify-end gap-3">
                <button
                  onClick={() => handleCopyNews(activeNewsDetail.id, `${activeNewsDetail.title}\n\n${activeNewsDetail.summary}`)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white transition-all flex items-center gap-1.5"
                >
                  {newsCopied === activeNewsDetail.id ? <Check size={14} className="text-emerald-500 dark:text-emerald-400" /> : <Copy size={14} />}
                  Sao chép bản tin
                </button>
                <button
                  onClick={() => setActiveNewsDetail(null)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white transition-all"
                >
                  Đóng phân tích
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

// -------------------------------------------------------------
// NAV BUTTON COMPONENT
// -------------------------------------------------------------
function NavButton({ children, active, onClick, icon }: { children: React.ReactNode, active: boolean, onClick: () => void, icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap flex-1 md:flex-auto justify-center ${
        active 
          ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-white shadow-md border border-slate-200 dark:border-white/5' 
          : 'text-slate-650 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// -------------------------------------------------------------
// EXISTING STATIC KNOWLEDGE SECTIONS (PRESERVED)
// -------------------------------------------------------------
function BigThreeSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col gap-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Gemini Card */}
        <div className="bg-white dark:bg-[#0d121f] rounded-3xl p-5 border border-slate-200 dark:border-[#4285F4]/20 relative overflow-hidden group hover:border-blue-400 dark:hover:border-[#4285F4]/50 transition-all flex flex-col justify-between shadow-sm dark:shadow-none">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-[#4285F4]"></div>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center border border-blue-200 dark:border-blue-500/30">
              <Sparkles className="text-blue-500 dark:text-blue-400" size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Google Gemini</h3>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-mono tracking-wider">GEMINI 3.5 PRO & FLASH</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                <Globe size={12} className="text-blue-555 dark:text-blue-400" /> Ngữ cảnh cực lớn (Multimodal)
              </h4>
              <p className="text-[11px] text-slate-555 dark:text-slate-400 leading-relaxed">Xử lý hàng triệu token, đọc toàn bộ tài liệu hoặc video dài trong chớp mắt.</p>
            </div>
            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                <Search size={12} className="text-blue-555 dark:text-blue-400" /> Deep Research
              </h4>
              <p className="text-[11px] text-slate-555 dark:text-slate-400 leading-relaxed">Hệ thống tác nhân tự động thực hiện nghiên cứu Internet sâu và viết báo cáo hoàn chỉnh.</p>
            </div>
          </div>
        </div>

        {/* OpenAI Card */}
        <div className="bg-white dark:bg-[#0d1411] rounded-3xl p-5 border border-slate-200 dark:border-[#10a37f]/20 relative overflow-hidden group hover:border-emerald-400 dark:hover:border-[#10a37f]/50 transition-all flex flex-col justify-between shadow-sm dark:shadow-none">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-[#10a37f]"></div>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-55 dark:bg-emerald-500/10 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/30">
              <Bot className="text-emerald-600 dark:text-emerald-400" size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">OpenAI</h3>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono tracking-wider">GPT-5 & o3</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                <Cpu size={12} className="text-emerald-555 dark:text-emerald-400" /> Lý thuyết O3 (Reasoning)
              </h4>
              <p className="text-[11px] text-slate-555 dark:text-slate-400 leading-relaxed">Phát triển các dòng mô hình suy nghĩ chậm, tối ưu tính toán cho Toán, Code và Khoa học.</p>
            </div>
            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                <Workflow size={12} className="text-emerald-555 dark:text-emerald-400" /> GPT Store & Canvas
              </h4>
              <p className="text-[11px] text-slate-555 dark:text-slate-400 leading-relaxed">Hỗ trợ Canvas giúp cùng sửa code và văn bản trực tiếp trên giao diện tương tác.</p>
            </div>
          </div>
        </div>

        {/* Claude Card */}
        <div className="bg-white dark:bg-[#140e0c] rounded-3xl p-5 border border-slate-200 dark:border-[#d97757]/20 relative overflow-hidden group hover:border-orange-400 dark:hover:border-[#d97757]/50 transition-all flex flex-col justify-between shadow-sm dark:shadow-none">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-[#d97757]"></div>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center border border-orange-200 dark:border-orange-500/30">
              <Bot className="text-orange-600 dark:text-orange-400" size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Anthropic Claude</h3>
              <p className="text-[10px] text-orange-650 dark:text-orange-400 font-mono tracking-wider">CLAUDE 4.5 & OPUS</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                <Smile size={12} className="text-orange-600 dark:text-orange-400" /> Hành văn xuất sắc nhất
              </h4>
              <p className="text-[11px] text-slate-555 dark:text-slate-400 leading-relaxed">Khả năng diễn đạt ngôn từ trôi chảy, viết học thuật đỉnh cao và an toàn thông tin vượt bậc.</p>
            </div>
            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                <Globe size={12} className="text-orange-600 dark:text-orange-400" /> Computer Use API
              </h4>
              <p className="text-[11px] text-slate-555 dark:text-slate-400 leading-relaxed">AI có thể tự click, gõ bàn phím và sử dụng máy tính như một nhân sự thực tế.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden backdrop-blur-sm shadow-sm dark:shadow-none">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
          <h3 className="text-sm font-bold flex items-center gap-2 text-indigo-650 dark:text-indigo-300">
            <BarChart3 size={16} /> Bảng Tổng Quan The Big Three
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                <th className="px-5 py-3 font-medium border-b border-slate-200 dark:border-white/10">Mô hình tiêu biểu</th>
                <th className="px-5 py-3 font-medium border-b border-slate-200 dark:border-white/10">Ưu thế nổi trội</th>
                <th className="px-5 py-3 font-medium border-b border-white/10">Tính năng Killer</th>
                <th className="px-5 py-3 font-medium border-b border-white/10">Chi phí & Tốc độ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-slate-700 dark:text-slate-300">
              <tr className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                <td className="px-5 py-3 font-semibold text-blue-650 dark:text-blue-400">Gemini 3.5</td>
                <td className="px-5 py-3">Cửa sổ ngữ cảnh khổng lồ 2M+</td>
                <td className="px-5 py-3">Deep Research, Tích hợp Drive</td>
                <td className="px-5 py-3">Tốc độ cực nhanh (Flash), Giá rất tốt</td>
              </tr>
              <tr className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                <td className="px-5 py-3 font-semibold text-emerald-600 dark:text-emerald-400">GPT-5 / o3</td>
                <td className="px-5 py-3">Suy luận logic (System 2 Thinking)</td>
                <td className="px-5 py-3">Canvas, GPT Store Agents</td>
                <td className="px-5 py-3">Chi phí trung bình, o-series suy nghĩ lâu</td>
              </tr>
              <tr className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                <td className="px-5 py-3 font-semibold text-orange-600 dark:text-orange-400">Claude 4.5</td>
                <td className="px-5 py-3">Khả năng Code và viết văn chân thực</td>
                <td className="px-5 py-3">Computer Use, Claude Artifacts</td>
                <td className="px-5 py-3">Opus có giá cao, Haiku cực kỳ tối ưu</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function OpenSourceSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="grid grid-cols-1 md:grid-cols-3 gap-6"
    >
      <div className="bg-white dark:bg-[#0b101e] rounded-2xl p-5 border border-slate-200 dark:border-[#0668E1]/20 hover:border-blue-400 dark:hover:border-[#0668E1]/40 transition-colors shadow-sm dark:shadow-none">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400">
            <Globe size={18} />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-white">Meta Llama 4</h3>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 h-16 leading-relaxed">
          Đầu tàu của thế giới mã nguồn Weights mở. Dòng Llama 4 đạt điểm hiệu suất vượt trội, sánh ngang với các giải pháp độc quyền hàng đầu hiện nay.
        </p>
        <div className="flex flex-wrap gap-2 text-[9px] font-mono">
          <span className="px-2 py-0.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 rounded text-slate-600 dark:text-slate-300">Llama 4 405B</span>
        </div>
      </div>

      <div className="bg-white dark:bg-[#120f0a] rounded-2xl p-5 border border-slate-200 dark:border-yellow-500/20 hover:border-yellow-450 dark:hover:border-yellow-500/40 transition-colors shadow-sm dark:shadow-none">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-yellow-50 dark:bg-yellow-500/10 flex items-center justify-center border border-yellow-200 dark:border-yellow-500/30 text-yellow-600 dark:text-yellow-400">
            <Zap size={18} />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-white">Mistral AI</h3>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 h-16 leading-relaxed">
          Công nghệ lõi tinh gọn từ Châu Âu. Phiên bản Mistral Large và các dòng MoE (Mixture of Experts) cho hiệu suất vận hành nhỏ gọn và tiết kiệm phần cứng.
        </p>
        <div className="flex flex-wrap gap-2 text-[9px] font-mono">
          <span className="px-2 py-0.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 rounded text-slate-600 dark:text-slate-300">Mistral Large 3</span>
        </div>
      </div>

      <div className="bg-white dark:bg-[#140b0b] rounded-2xl p-5 border border-slate-200 dark:border-rose-500/20 hover:border-rose-455 dark:hover:border-rose-500/40 transition-colors shadow-sm dark:shadow-none">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400">
            <Cpu size={18} />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-white">DeepSeek V4</h3>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 h-16 leading-relaxed">
          Hiện tượng công nghệ chuyên toán và lập trình mã nguồn mở. Thuật toán tối ưu hóa chi phí huấn luyện cực thấp, định hình lại kinh tế học AI.
        </p>
        <div className="flex flex-wrap gap-2 text-[9px] font-mono">
          <span className="px-2 py-0.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/15 rounded text-slate-600 dark:text-slate-300">DeepSeek-V4 MoE</span>
        </div>
      </div>
    </motion.div>
  );
}

function SpecializedSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="grid grid-cols-1 md:grid-cols-2 gap-6"
    >
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-3 shadow-sm dark:shadow-none">
        <h3 className="text-sm font-bold flex items-center gap-2 text-purple-700 dark:text-purple-300">
          <ImageIcon size={16} /> Sáng tạo Đa Phương Tiện (Multimodal Generation)
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Các mô hình Midjourney v7 thống trị thế giới nghệ thuật ảnh tĩnh siêu thực. Song song đó, Sora (OpenAI) và Veo 2 (Google) đang chuyển hóa kịch bản chữ viết thành các thước phim video dài mượt mà, chân thực chuẩn điện ảnh.
        </p>
      </div>

      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-3 shadow-sm dark:shadow-none">
        <h3 className="text-sm font-bold flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
          <Code size={16} /> Trợ Lý Lập Trình (AI Coding Copilots)
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          GitHub Copilot tiếp tục là trợ lý không thể thiếu trong các công ty lớn. Tuy nhiên, Cursor IDE đã trở thành hiện tượng đột phá khi cung cấp khả năng phân tích sâu toàn bộ Codebase, tự viết file mới và sửa lỗi trực tiếp.
        </p>
      </div>
    </motion.div>
  );
}

function TrendsSection() {
  const trends = [
    {
      icon: <Shield size={16} className="text-blue-500 dark:text-blue-400" />,
      title: "On-device AI",
      desc: "Các mô hình ngôn ngữ kích thước nhỏ chạy mượt mà ngay trên vi xử lý NPU của điện thoại và laptop mà không cần Internet, đảm bảo tính bảo mật và phản hồi tức thì."
    },
    {
      icon: <Workflow size={16} className="text-purple-555 dark:text-purple-400" />,
      title: "AI Agents Tự Trị",
      desc: "Chuyển dịch từ AI chỉ phản hồi sang AI thực thi hành động: tự động duyệt web, thanh toán tài chính, kết hợp chuỗi công việc và tự kiểm tra chất lượng kết quả."
    },
    {
      icon: <Clock size={16} className="text-emerald-600 dark:text-emerald-400" />,
      title: "Reasoning (Suy nghĩ chậm)",
      desc: "Các mô hình được huấn luyện để tự lập luận nội tâm trước khi xuất kết quả, tối ưu hóa tối đa các bài toán logic hóc búa và giảm thiểu hiện tượng ảo giác AI."
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="max-w-xl mx-auto space-y-4"
    >
      {trends.map((t, idx) => (
        <div key={idx} className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl p-4 flex gap-4 items-start shadow-sm dark:shadow-none">
          <div className="bg-slate-100 dark:bg-white/5 p-2 rounded-xl mt-0.5">
            {t.icon}
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-800 dark:text-white">{t.title}</h4>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{t.desc}</p>
          </div>
        </div>
      ))}
    </motion.div>
  );
}
