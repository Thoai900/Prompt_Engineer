import { useState } from 'react';
import { runPlaygroundChatStream } from '../services/aiService';
import { useWorkspace } from '../context/WorkspaceContext';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const usePlaygroundSession = () => {
  const { geminiApiKey, openaiApiKey, useSystemGeminiKey } = useWorkspace();

  const [playgroundMessages, setPlaygroundMessages] = useState<ChatMessage[]>([]);
  const [isChatGenerating, setIsChatGenerating] = useState(false);
  const [chatInput, setChatInput] = useState('');
  
  // Playground Config Parameters
  const [playgroundProvider, setPlaygroundProvider] = useState<'gemini' | 'openai'>('gemini');
  const [playgroundModel, setPlaygroundModel] = useState<string>('gemini-2.5-flash');
  const [playgroundTemp, setPlaygroundTemp] = useState<number>(0.7);
  const [playgroundMaxTokens, setPlaygroundMaxTokens] = useState<number>(2048);
  const [showPlaygroundConfig, setShowPlaygroundConfig] = useState(false);

  const handleSendPlaygroundMessage = async (e?: React.FormEvent, systemInstruction: string = '') => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatGenerating) return;

    const userMessageText = chatInput.trim();
    setChatInput('');

    const newUserMessage = { role: 'user' as const, content: userMessageText };
    const updatedMessages = [...playgroundMessages, newUserMessage];
    setPlaygroundMessages(updatedMessages);
    setIsChatGenerating(true);

    try {
      // Append Mentor AI guidelines to enforce Socratic method, empathetic tone and LaTeX math format
      const finalSystemInstruction = systemInstruction + 
        `\n\n[HƯỚNG DẪN BẮT BUỘC CHO MENTOR AI]\n` +
        `Bạn là Mentor AI - gia sư thân thiện, kiên nhẫn và khuyến khích cho học sinh trung học. Hãy tuân thủ nghiêm ngặt:\n` +
        `1. Tuyệt đối KHÔNG giải hộ bài tập hay đưa ra đáp án trực tiếp. Sử dụng phương pháp Socratic để đặt câu hỏi khơi gợi tư duy, dẫn dắt từng bước để học sinh tự tìm ra câu trả lời.\n` +
        `2. Giọng điệu thân thiện, kiên nhẫn, sử dụng emoji một cách ấm áp, khích lệ.\n` +
        `3. Khi viết các công thức toán học hoặc khoa học, hãy luôn sử dụng LaTeX (bọc bằng $ hoặc $$).`;
      
      const apiMessages = updatedMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' as const : 'user' as const,
        content: m.content
      }));

      let accumulatedResponse = '';
      
      setPlaygroundMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      const apiKey = playgroundProvider === 'gemini' 
        ? (useSystemGeminiKey ? undefined : geminiApiKey)
        : openaiApiKey;

      await runPlaygroundChatStream(
        playgroundProvider,
        finalSystemInstruction,
        apiMessages,
        {
          apiKey,
          model: playgroundModel,
          temperature: playgroundTemp,
          maxTokens: playgroundMaxTokens
        },
        (chunk) => {
          accumulatedResponse += chunk;
          setPlaygroundMessages(prev => {
            const next = [...prev];
            if (next.length > 0) {
              next[next.length - 1] = { role: 'assistant', content: accumulatedResponse };
            }
            return next;
          });
        }
      );
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.message || 'Đã xảy ra lỗi khi kết nối với AI.';
      setPlaygroundMessages(prev => {
        const next = [...prev];
        if (next.length > 0 && next[next.length - 1].role === 'assistant' && next[next.length - 1].content === '') {
          next[next.length - 1] = { role: 'assistant', content: `❌ Lỗi: ${errorMessage}` };
        } else {
          next.push({ role: 'assistant', content: `❌ Lỗi: ${errorMessage}` });
        }
        return next;
      });
    } finally {
      setIsChatGenerating(false);
    }
  };

  const handleResetPlayground = () => {
    setPlaygroundMessages([]);
  };

  return {
    playgroundMessages,
    setPlaygroundMessages,
    isChatGenerating,
    chatInput,
    setChatInput,
    playgroundProvider,
    setPlaygroundProvider,
    playgroundModel,
    setPlaygroundModel,
    playgroundTemp,
    setPlaygroundTemp,
    playgroundMaxTokens,
    setPlaygroundMaxTokens,
    showPlaygroundConfig,
    setShowPlaygroundConfig,
    handleSendPlaygroundMessage,
    handleResetPlayground,
  };
};
