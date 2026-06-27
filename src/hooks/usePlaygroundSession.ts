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
      // Dùng trực tiếp prompt mà người dùng đang dựng trong Builder làm System Prompt,
      // không ép thêm bất kỳ persona cố định nào để giả lập phản ánh đúng prompt thực tế.
      const finalSystemInstruction = systemInstruction.trim()
        ? systemInstruction
        : 'Bạn là một trợ lý AI hữu ích. Hãy trả lời trực tiếp, rõ ràng và đúng trọng tâm.';

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

  const handleGenerateSampleResult = async (systemInstruction: string) => {
    setIsChatGenerating(true);
    setPlaygroundMessages([
      { role: 'assistant', content: '' }
    ]);

    try {
      // Lấy đúng prompt người dùng đang dựng làm System Prompt, không ép persona gia sư.
      const finalSystemInstruction = systemInstruction.trim()
        ? systemInstruction
        : 'Bạn là một trợ lý AI hữu ích. Hãy trả lời trực tiếp, rõ ràng và đúng trọng tâm.';

      const apiMessages = [{
        role: 'user' as const,
        content: 'Hãy tạo một phản hồi mẫu ngắn gọn, súc tích (khoảng 2-3 câu) thể hiện đúng vai trò, tính cách và định hướng nhiệm vụ mà bạn được cấu hình ở trên để minh họa cách bạn sẽ phản hồi người dùng.'
      }];

      let accumulatedResponse = '';
      
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
          maxTokens: 300
        },
        (chunk) => {
          accumulatedResponse += chunk;
          setPlaygroundMessages([{ role: 'assistant', content: accumulatedResponse }]);
        }
      );
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.message || 'Đã xảy ra lỗi khi tạo kết quả mẫu.';
      setPlaygroundMessages([{ role: 'assistant', content: `❌ Lỗi: ${errorMessage}` }]);
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
    handleGenerateSampleResult,
    handleResetPlayground,
  };
};
