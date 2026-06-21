import { TreeNode, PromptProject, PromptTemplate } from '../types';

export const DEFAULT_PROJECTS: PromptProject[] = [
  {
    id: 'proj-education-tutor',
    name: 'Gia sư Mentor AI chuyên sâu',
    description: 'Chuỗi prompt phân tích chủ đề, xây dựng bài học lý thuyết và tạo đề thi trắc nghiệm đi kèm giải thích.',
    globalEvalCriteria: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: 'node-root',
        parentId: null,
        title: '1. Phân tích Chủ đề',
        description: 'Phân tích chủ đề giảng dạy thành các nhánh bài học cốt lõi',
        status: 'idle',
        position: { x: 100, y: 220 },
        blocks: [
          {
            id: 'block-root-1',
            type: 'role',
            title: 'Vai trò (Role)',
            content: 'Bạn là một Mentor AI - chuyên gia phát triển nội dung giáo dục phổ thông theo phương pháp Socratic.'
          },
          {
            id: 'block-root-2',
            type: 'task',
            title: 'Nhiệm vụ (Task)',
            content: 'Hãy phân tích chủ đề: "{{subject}}" dành cho học sinh lớp {{grade}}.\n\nChia chủ đề thành 3 nội dung cốt lõi nhất cần nắm vững. Đối với mỗi nội dung, hãy nêu rõ mục tiêu học tập (Learning Objective) và từ khóa chính cần nhớ.\n\nLưu ý:\n- Sử dụng emoji thân thiện 😊\n- Trình bày dạng bullet points\n- Công thức nếu có hãy dùng LaTeX.'
          }
        ],
        variables: [
          { name: 'subject', type: 'text', description: 'Chủ đề bài học (vd: Quang hợp ở thực vật)', required: true, defaultValue: 'Chiến tranh thế giới thứ hai' },
          { name: 'grade', type: 'text', description: 'Lớp học (vd: 10, 11, 12)', required: true, defaultValue: '11' }
        ]
      },
      {
        id: 'node-child-lesson',
        parentId: 'node-root',
        title: '2. Soạn bài giảng',
        description: 'Tạo giáo án chi tiết và các ví dụ minh họa trực quan',
        status: 'idle',
        position: { x: 450, y: 100 },
        blocks: [
          {
            id: 'block-lesson-1',
            type: 'role',
            title: 'Vai trò (Role)',
            content: 'Bạn là một Mentor AI - gia sư thân thiện và ấm áp.'
          },
          {
            id: 'block-lesson-2',
            type: 'context',
            title: 'Ngữ cảnh (Context)',
            content: 'Dưới đây là phân tích chủ đề được thực hiện ở bước trước:\n\n{{1.Phân tíchChủđề.output}}'
          },
          {
            id: 'block-lesson-3',
            type: 'task',
            title: 'Nhiệm vụ (Task)',
            content: 'Hãy viết nội dung bài giảng chi tiết cho nhánh nội dung thứ nhất trong phần phân tích phía trên.\n\nKết cấu bài giảng gồm:\n1. Phần khởi động (Hook): đặt một câu hỏi khơi gợi tò mò theo phương pháp Socratic.\n2. Nội dung kiến thức: giải thích ngắn gọn, dễ hiểu.\n3. Ví dụ minh họa thực tế sinh động.'
          }
        ],
        variables: []
      },
      {
        id: 'node-child-quiz',
        parentId: 'node-root',
        title: '3. Bộ câu hỏi ôn tập',
        description: 'Thiết kế các câu hỏi trắc nghiệm kiểm tra mức độ thấu hiểu bài học',
        status: 'idle',
        position: { x: 450, y: 350 },
        blocks: [
          {
            id: 'block-quiz-1',
            type: 'role',
            title: 'Vai trò (Role)',
            content: 'Bạn là một giáo viên Mentor AI chuyên ra đề thi tương tác.'
          },
          {
            id: 'block-quiz-2',
            type: 'context',
            title: 'Ngữ cảnh (Context)',
            content: 'Tham khảo phân tích chủ đề:\n{{1.Phân tíchChủđề.output}}'
          },
          {
            id: 'block-quiz-3',
            type: 'task',
            title: 'Nhiệm vụ (Task)',
            content: 'Hãy tạo ra 2 câu hỏi trắc nghiệm (mỗi câu 4 phương án A, B, C, D) kiểm tra kiến thức về các từ khóa chính nêu trong đề cương.\n\nBẮT BUỘC: Không cung cấp đáp án trực tiếp. Với mỗi câu hỏi, hãy viết gợi ý (Hint) định hướng tư duy theo phong cách Socratic giúp học sinh tự suy nghĩ chọn đáp án đúng.'
          }
        ],
        variables: []
      }
    ]
  }
];

export const applyAutoLayoutToProject = (project: PromptProject): PromptProject => {
  if (!project || !project.nodes || project.nodes.length === 0) return project;

  const rootNode = project.nodes.find(n => n.parentId === null);
  if (!rootNode) return project;

  const childrenMap = new Map<string, TreeNode[]>();
  project.nodes.forEach(node => {
    if (node.parentId) {
      const list = childrenMap.get(node.parentId) || [];
      list.push(node);
      childrenMap.set(node.parentId, list);
    }
  });

  const nodeMap = new Map<string, TreeNode>();
  project.nodes.forEach(n => nodeMap.set(n.id, n));

  const levelSpacing = 280;
  const nodeSpacingY = 140;
  const startX = rootNode.position.x;
  const originalRootY = rootNode.position.y;
  
  const newPositions = new Map<string, { x: number; y: number }>();
  let currentY = 100;

  const layoutNode = (nodeId: string, depth: number) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;

    const rawChildren = childrenMap.get(nodeId) || [];
    const sortedChildren = [...rawChildren].sort((a, b) => {
      const valA = a.branchType === 'success' ? -1 : a.branchType === 'failure' ? 1 : 0;
      const valB = b.branchType === 'success' ? -1 : b.branchType === 'failure' ? 1 : 0;
      return valA - valB;
    });

    const x = startX + depth * levelSpacing;

    if (sortedChildren.length === 0) {
      newPositions.set(nodeId, { x, y: currentY });
      currentY += nodeSpacingY;
    } else {
      sortedChildren.forEach(child => {
        layoutNode(child.id, depth + 1);
      });

      const firstChildPos = newPositions.get(sortedChildren[0].id);
      const lastChildPos = newPositions.get(sortedChildren[sortedChildren.length - 1].id);
      
      const y = firstChildPos && lastChildPos 
        ? (firstChildPos.y + lastChildPos.y) / 2
        : currentY;
        
      newPositions.set(nodeId, { x, y });
    }
  };

  layoutNode(rootNode.id, 0);

  const calculatedRootY = newPositions.get(rootNode.id)?.y ?? originalRootY;
  const diffY = originalRootY - calculatedRootY;

  const updatedNodes = project.nodes.map(node => {
    const pos = newPositions.get(node.id);
    return pos ? { ...node, position: { x: pos.x, y: pos.y + diffY } } : node;
  });

  return {
    ...project,
    nodes: updatedNodes,
    updatedAt: new Date().toISOString()
  };
};

export const compileEvolutionPrompt = (node: TreeNode, project: PromptProject, inputs: Record<string, string>): string => {
  const path: TreeNode[] = [];
  let curr: TreeNode | undefined = node;
  while (curr) {
    path.unshift(curr);
    curr = curr.parentId ? project.nodes.find(n => n.id === curr.parentId) : undefined;
  }

  const rootNode = path[0];
  if (!rootNode) return '';

  const contextMode = node.contextMode || 'full';
  const contextLimit = node.contextLimit !== undefined ? node.contextLimit : 2;

  let pathToUse = [...path];

  if (contextMode === 'parent_only') {
    if (path.length > 2) {
      pathToUse = [rootNode, path[path.length - 2], node];
    }
  } else if (contextMode === 'limit') {
    if (path.length > contextLimit + 2) {
      const startIdx = path.length - 1 - contextLimit;
      pathToUse = [rootNode, ...path.slice(startIdx)];
    }
  }

  let compiledRoot = rootNode.blocks.map(b => `[${b.title}]\n${b.content}`).join('\n\n');
  let finalPrompt = compiledRoot;

  const uniquePath = pathToUse.filter((val, id, self) => self.findIndex(t => t.id === val.id) === id);

  uniquePath.slice(1).forEach((childNode) => {
    if (childNode.blocks && childNode.blocks.length > 0) {
      const childBlocksCompiled = childNode.blocks.map(b => `[${b.title}]\n${b.content}`).join('\n\n');
      finalPrompt += '\n\n' + childBlocksCompiled;
    }
    if (childNode.evolutionInstruction && childNode.evolutionInstruction.trim() !== '') {
      const typeStr = childNode.evolutionType ? ` (${childNode.evolutionType})` : '';
      finalPrompt += `\n\n[Chỉ thị tiến hóa${typeStr} của "${childNode.title}"]\n${childNode.evolutionInstruction}`;
    }
  });

  const varRegex = /\{\{([^}]+)\}\}/g;
  const replacements: Record<string, string> = {};

  const ancestors = path.slice(0, path.length - 1);
  const directParent = ancestors[ancestors.length - 1];

  if (directParent) {
    replacements['parent.output'] = directParent.output || `[LƯU Ý: Đầu ra của Node "${directParent.title}" chưa được thực thi. Vui lòng chạy Node cha trước!]`;
  }

  ancestors.forEach(anc => {
    const key = `${anc.title.replace(/\s+/g, '')}.output`;
    replacements[key] = anc.output || `[LƯU Ý: Đầu ra của Node "${anc.title}" chưa được thực thi. Vui lòng chạy Node này trước!]`;
  });

  return finalPrompt.replace(varRegex, (match, varName) => {
    const cleanedName = varName.trim();
    if (replacements[cleanedName] !== undefined) {
      return replacements[cleanedName];
    }
    if (inputs[cleanedName] !== undefined && inputs[cleanedName] !== '') {
      return inputs[cleanedName];
    }
    const defVar = project.nodes.flatMap(n => n.variables || []).find(v => v.name === cleanedName);
    if (defVar && defVar.defaultValue) {
      return defVar.defaultValue;
    }
    return match;
  });
};

export const extractVariablesInNode = (node: TreeNode): string[] => {
  const varRegex = /\{\{([^}]+)\}\}/g;
  const foundVars = new Set<string>();
  node.blocks.forEach(b => {
    let match;
    while ((match = varRegex.exec(b.content)) !== null) {
      foundVars.add(match[1].trim());
    }
  });
  return Array.from(foundVars);
};

export const getRequiredInputsForNode = (node: TreeNode, project: PromptProject): string[] => {
  const allVars = extractVariablesInNode(node);
  
  const ancestorTitles = new Set<string>();
  let currentParentId = node.parentId;
  while (currentParentId) {
    const parent = project.nodes.find(n => n.id === currentParentId);
    if (parent) {
      ancestorTitles.add(parent.title.replace(/\s+/g, ''));
      currentParentId = parent.parentId;
    } else {
      break;
    }
  }

  return allVars.filter(v => {
    const isParentOutput = v === 'parent.output';
    const isNamedOutput = v.endsWith('.output') && ancestorTitles.has(v.replace('.output', ''));
    return !isParentOutput && !isNamedOutput;
  });
};

