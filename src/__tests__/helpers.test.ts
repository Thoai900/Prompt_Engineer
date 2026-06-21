import { describe, it, expect } from 'vitest';
import { sanitizeJsonString, extractJson } from '../services/aiService';
import { compileEvolutionPrompt } from '../utils/chainUtils';
import { TreeNode, PromptProject } from '../types';

describe('JSON Helper Utilities', () => {
  describe('sanitizeJsonString', () => {
    it('should replace unescaped newlines inside JSON strings', () => {
      const badJson = '{"text": "Line 1\nLine 2"}';
      const sanitized = sanitizeJsonString(badJson);
      expect(sanitized).toBe('{"text": "Line 1\\nLine 2"}');
    });

    it('should ignore newlines outside strings', () => {
      const okJson = '{\n  "key": "val"\n}';
      const sanitized = sanitizeJsonString(okJson);
      expect(sanitized).toBe(okJson);
    });

    it('should not double-escape already escaped backslashes', () => {
      const goodJson = '{"text": "Line 1\\\\nLine 2"}';
      const sanitized = sanitizeJsonString(goodJson);
      expect(sanitized).toBe(goodJson);
    });
  });

  describe('extractJson', () => {
    it('should extract JSON object from markdown codeblock', () => {
      const markdown = 'Some text\n```json\n{"a": 1}\n```\nend';
      const extracted = extractJson(markdown);
      expect(extracted).toBe('{"a": 1}');
    });

    it('should extract JSON list', () => {
      const markdown = 'Pre [1, 2, 3] Post';
      const extracted = extractJson(markdown);
      expect(extracted).toBe('[1, 2, 3]');
    });

    it('should handle nested objects', () => {
      const text = 'Here is the result: {"outer": {"inner": "value"}}';
      const extracted = extractJson(text);
      expect(extracted).toBe('{"outer": {"inner": "value"}}');
    });
  });
});

describe('Prompt Evolution compiler', () => {
  const mockNodeRoot: TreeNode = {
    id: 'node-root',
    parentId: null,
    title: 'Root Node',
    description: 'Initial prompt step',
    status: 'success',
    position: { x: 100, y: 100 },
    blocks: [
      { id: 'b1', type: 'role', title: 'System', content: 'You are an educational AI tutor.' },
      { id: 'b2', type: 'task', title: 'Action', content: 'Explain {{subject}} for grade {{grade}}.' }
    ],
    variables: [
      { name: 'subject', type: 'text', required: true, defaultValue: 'Math' },
      { name: 'grade', type: 'text', required: true, defaultValue: '10' }
    ],
    output: 'Analyzed subject: Math for grade 10.'
  };

  const mockNodeChild: TreeNode = {
    id: 'node-child',
    parentId: 'node-root',
    title: 'Detail Node',
    description: 'Explain more',
    status: 'idle',
    position: { x: 400, y: 100 },
    blocks: [
      { id: 'b3', type: 'context', title: 'Parent Output', content: 'Here is the parent output:\n{{parent.output}}' },
      { id: 'b4', type: 'task', title: 'Refine Task', content: 'Add a LaTeX exercise for the topic.' }
    ],
    variables: [],
    evolutionType: 'expand',
    evolutionInstruction: 'Expand the explanation to include formulas.'
  };

  const mockProject: PromptProject = {
    id: 'p1',
    name: 'Test Project',
    description: 'A test project chain',
    globalEvalCriteria: ['Use LaTeX', 'No direct answer'],
    nodes: [mockNodeRoot, mockNodeChild],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  it('should compile root prompt with input variables', () => {
    const inputs = { subject: 'Physics', grade: '12' };
    const compiled = compileEvolutionPrompt(mockNodeRoot, mockProject, inputs);
    expect(compiled).toContain('[System]\nYou are an educational AI tutor.');
    expect(compiled).toContain('[Action]\nExplain Physics for grade 12.');
  });

  it('should fallback to default variables if inputs are missing', () => {
    const compiled = compileEvolutionPrompt(mockNodeRoot, mockProject, {});
    expect(compiled).toContain('[Action]\nExplain Math for grade 10.');
  });

  it('should accumulate parent context and substitute parent.output in child node', () => {
    const compiled = compileEvolutionPrompt(mockNodeChild, mockProject, {});
    expect(compiled).toContain('[Parent Output]\nHere is the parent output:\nAnalyzed subject: Math for grade 10.');
    expect(compiled).toContain('[Chỉ thị tiến hóa (expand) của "Detail Node"]\nExpand the explanation to include formulas.');
  });
});
