import { TreeNode, PromptProject } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// LƯU Ý (v3): Project Chain đã chuyển sang mô hình Prompt Graph
// (src/utils/graphCompile.ts + graphMigration.ts). File này chỉ còn giữ:
//  - compileEvolutionPrompt / getRequiredInputsForNode: đường TƯƠNG THÍCH cho
//    các Shared App legacy (chainAppService) chưa migrate sang v3.
//  - computeUnifiedDiff: dùng chung cho VersionDrawer & PromptDetailModal.
// Đã xoá: DEFAULT_PROJECTS, applyAutoLayoutToProject, markDescendantsStale
// (chỉ phục vụ canvas/wizard cũ).
// ─────────────────────────────────────────────────────────────────────────────

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

export type DiffLine = { type: 'added' | 'removed' | 'unchanged'; text: string };

/**
 * Diff hợp nhất theo dòng (line-by-line), có nhìn trước tối đa 4 dòng để bắt cặp
 * thêm/xóa. Hàm thuần — tách từ ProjectChainTab để dùng lại & test được.
 */
export const computeUnifiedDiff = (oldText: string, newText: string): DiffLine[] => {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const diffResult: DiffLine[] = [];

  let i = 0, j = 0;
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length) {
      if (oldLines[i] === newLines[j]) {
        diffResult.push({ type: 'unchanged', text: oldLines[i] });
        i++;
        j++;
      } else {
        let foundMatch = false;
        for (let k = 1; k < 5; k++) {
          if (i + k < oldLines.length && oldLines[i + k] === newLines[j]) {
            for (let m = 0; m < k; m++) {
              diffResult.push({ type: 'removed', text: oldLines[i + m] });
            }
            i += k;
            foundMatch = true;
            break;
          }
          if (j + k < newLines.length && oldLines[i] === newLines[j + k]) {
            for (let m = 0; m < k; m++) {
              diffResult.push({ type: 'added', text: newLines[j + m] });
            }
            j += k;
            foundMatch = true;
            break;
          }
        }
        if (!foundMatch) {
          diffResult.push({ type: 'removed', text: oldLines[i] });
          diffResult.push({ type: 'added', text: newLines[j] });
          i++;
          j++;
        }
      }
    } else if (i < oldLines.length) {
      diffResult.push({ type: 'removed', text: oldLines[i] });
      i++;
    } else if (j < newLines.length) {
      diffResult.push({ type: 'added', text: newLines[j] });
      j++;
    }
  }
  return diffResult;
};
