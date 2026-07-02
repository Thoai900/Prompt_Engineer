import { GoogleGenAI } from "@google/genai";
import { proxyGenerate, proxyGenerateStream } from "./aiProxy";
import { GEMINI_FLASH, GEMINI_FLASH_LATEST, GEMINI_PRO, GROQ_LLAMA_8B, GPT_MINI, TASK_DEFAULTS, type ModelProvider } from "../config/models";

// ─────────────────────────────────────────────────────────────────────────────
// Quản lý API key:
//  - Key MẶC ĐỊNH của ứng dụng (Gemini + Groq/Llama) KHÔNG còn nằm trong bundle
//    trình duyệt; chúng được giấu trong Firebase Cloud Functions (backend proxy).
//    Khi client không có key riêng, mọi lời gọi đi qua proxy (yêu cầu đăng nhập).
//  - Nếu người dùng tự nhập key riêng (Gemini qua options.apiKey, Groq qua
//    localStorage/tham số), client gọi thẳng provider bằng key của họ — không gửi
//    key cá nhân của họ cho backend.
// getGroqApiKey/isGroqConfigured chỉ phản ánh KEY RIÊNG của người dùng (không phải
// key mặc định, vì key mặc định giờ ở backend).
// ─────────────────────────────────────────────────────────────────────────────
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_API_KEY_STORAGE = 'mentor_ai_groq_key';

export function getGroqApiKey(explicitKey?: string): string {
  if (explicitKey && explicitKey.trim()) return explicitKey.trim();
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(GROQ_API_KEY_STORAGE);
      if (stored && stored.trim()) return stored.trim();
    }
  } catch {
    /* localStorage không khả dụng (môi trường test/SSR) — bỏ qua */
  }
  return '';
}

export function isGroqConfigured(explicitKey?: string): boolean {
  return !!getGroqApiKey(explicitKey);
}

interface GroqChatOptions {
  apiKey?: string;
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  json?: boolean;
}

function buildGroqBody(
  systemInstruction: string,
  userContent: string,
  opts: GroqChatOptions,
  stream: boolean
): Record<string, any> {
  const body: Record<string, any> = {
    model: opts.model || GROQ_LLAMA_8B,
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userContent },
    ],
    temperature: opts.temperature !== undefined ? opts.temperature : 0.7,
    top_p: opts.topP !== undefined ? opts.topP : 0.95,
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (stream) body.stream = true;
  // response_format chỉ áp dụng cho lời gọi không stream (Groq không kết hợp được với stream)
  if (opts.json && !stream) body.response_format = { type: 'json_object' };
  return body;
}

// Gọi Groq (Llama-3-8B) và trả về text thuần. Ném lỗi nếu thiếu key hoặc API lỗi.
async function callGroqChat(
  systemInstruction: string,
  userContent: string,
  opts: GroqChatOptions = {}
): Promise<string> {
  const apiKey = getGroqApiKey(opts.apiKey);
  if (!apiKey) {
    // Không có key Groq riêng → đi qua backend proxy (dùng key mặc định của app).
    return await proxyGenerate({
      provider: 'groq',
      model: opts.model,
      system: systemInstruction,
      user: userContent,
      temperature: opts.temperature,
      topP: opts.topP,
      maxTokens: opts.maxTokens,
      json: opts.json,
    });
  }

  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildGroqBody(systemInstruction, userContent, opts, false)),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
}

// Bản streaming cho các tác vụ sinh nội dung khối theo luồng (SSE tương thích OpenAI).
async function callGroqChatStream(
  systemInstruction: string,
  userContent: string,
  onChunk: (chunk: string) => void,
  opts: GroqChatOptions = {}
): Promise<void> {
  const apiKey = getGroqApiKey(opts.apiKey);
  if (!apiKey) {
    // Không có key Groq riêng → stream qua backend proxy (key mặc định của app).
    await proxyGenerateStream(
      {
        provider: 'groq',
        model: opts.model,
        system: systemInstruction,
        user: userContent,
        temperature: opts.temperature,
        topP: opts.topP,
        maxTokens: opts.maxTokens,
      },
      onChunk
    );
    return;
  }

  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(buildGroqBody(systemInstruction, userContent, opts, true)),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API Error: ${response.status} - ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Không thể khởi tạo luồng đọc dữ liệu từ Groq.');

  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const cleaned = line.trim();
      if (!cleaned || cleaned === 'data: [DONE]') continue;
      if (cleaned.startsWith('data: ')) {
        try {
          const json = JSON.parse(cleaned.substring(6));
          const text = json.choices?.[0]?.delta?.content || '';
          if (text) onChunk(text);
        } catch {
          /* bỏ qua dòng SSE lẻ không parse được */
        }
      }
    }
  }
}

// Sinh JSON cho tác vụ tạo prompt: Gemini trước, fallback Llama-3-8B (Groq).
// Llama 8B ở JSON mode hay lỗi `json_validate_failed` với JSON tiếng Việt dài
// (đứt trước khi hợp lệ → proxy trả 502) nên chỉ giữ làm dự phòng, kèm maxTokens
// chặn vòng lặp sinh vô hạn. callGroqChat tự định tuyến (key riêng → gọi thẳng;
// không có key → backend proxy).
async function generatePromptJson(
  systemInstruction: string,
  userContent: string,
  geminiModel: string,
  temperature: number,
  topP: number,
  options?: AiGenParams
): Promise<string> {
  try {
    return await geminiGenerate({
      model: options?.model || geminiModel,
      systemInstruction,
      userContent,
      temperature,
      topP,
      json: true,
      options,
    });
  } catch (geminiError) {
    console.warn('Gemini thất bại, chuyển về Groq (Llama-3-8B):', geminiError);
    return await callGroqChat(systemInstruction, userContent, {
      apiKey: options?.groqApiKey,
      model: options?.groqModel,
      temperature,
      topP,
      maxTokens: 4096,
      json: true,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lớp gọi Gemini, tự định tuyến theo key:
//  - Có key Gemini riêng (options.apiKey) → gọi thẳng SDK bằng key đó.
//  - Không có → đi qua backend proxy (key mặc định của app, yêu cầu đăng nhập).
// geminiGenerate/geminiStream KHÔNG tự fallback sang Groq (dùng cho nhánh fallback
// của tác vụ tạo prompt để tránh lặp vòng). geminiGenerateWithFallback/
// geminiStreamWithFallback = Gemini trước, lỗi thì tự động chuyển sang Groq.
// ─────────────────────────────────────────────────────────────────────────────
interface GeminiCallParams {
  model: string;
  systemInstruction: string;
  userContent: string;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  json?: boolean;
  options?: AiGenParams;
}

async function geminiGenerate(params: GeminiCallParams): Promise<string> {
  const {
    model, systemInstruction, userContent,
    temperature, topP, maxOutputTokens, json, options,
  } = params;
  if (options?.apiKey) {
    const client = new GoogleGenAI({ apiKey: options.apiKey });
    const response = await client.models.generateContent({
      model,
      contents: userContent,
      config: {
        systemInstruction,
        ...(temperature !== undefined ? { temperature } : {}),
        ...(topP !== undefined ? { topP } : {}),
        ...(maxOutputTokens ? { maxOutputTokens } : {}),
        ...(json ? { responseMimeType: 'application/json' } : {}),
      },
    });
    return response.text || (json ? '{}' : '');
  }
  return await proxyGenerate({
    provider: 'gemini',
    model,
    system: systemInstruction,
    user: userContent,
    temperature,
    topP,
    maxTokens: maxOutputTokens,
    json,
  });
}

async function geminiStream(
  params: GeminiCallParams,
  onChunk: (chunk: string) => void
): Promise<void> {
  const {
    model, systemInstruction, userContent,
    temperature, topP, maxOutputTokens, options,
  } = params;
  if (options?.apiKey) {
    const client = new GoogleGenAI({ apiKey: options.apiKey });
    const stream = await client.models.generateContentStream({
      model,
      contents: userContent,
      config: {
        systemInstruction,
        ...(temperature !== undefined ? { temperature } : {}),
        ...(topP !== undefined ? { topP } : {}),
        ...(maxOutputTokens ? { maxOutputTokens } : {}),
      },
    });
    for await (const chunk of stream) {
      if (chunk.text) onChunk(chunk.text);
    }
    return;
  }
  await proxyGenerateStream(
    {
      provider: 'gemini',
      model,
      system: systemInstruction,
      user: userContent,
      temperature,
      topP,
      maxTokens: maxOutputTokens,
    },
    onChunk
  );
}

async function geminiGenerateWithFallback(params: GeminiCallParams): Promise<string> {
  try {
    return await geminiGenerate(params);
  } catch (geminiError) {
    console.warn('Gemini lỗi — fallback tự động sang Groq (Llama-3-8B):', geminiError);
    try {
      return await callGroqChat(params.systemInstruction, params.userContent, {
        apiKey: params.options?.groqApiKey,
        model: params.options?.groqModel,
        temperature: params.temperature,
        topP: params.topP,
        maxTokens: params.maxOutputTokens,
        json: params.json,
      });
    } catch (groqError) {
      console.error('Groq fallback cũng thất bại:', groqError);
      throw geminiError;
    }
  }
}

async function geminiStreamWithFallback(
  params: GeminiCallParams,
  onChunk: (chunk: string) => void
): Promise<void> {
  let emitted = false;
  const tracked = (chunk: string) => {
    emitted = true;
    onChunk(chunk);
  };
  try {
    await geminiStream(params, tracked);
  } catch (geminiError) {
    // Chỉ fallback khi chưa phát ra chunk nào, tránh lặp/ghép nội dung sai.
    if (emitted) throw geminiError;
    console.warn('Gemini stream lỗi — fallback tự động sang Groq (Llama-3-8B):', geminiError);
    await callGroqChatStream(params.systemInstruction, params.userContent, onChunk, {
      apiKey: params.options?.groqApiKey,
      model: params.options?.groqModel,
      temperature: params.temperature,
      topP: params.topP,
      maxTokens: params.maxOutputTokens,
    });
  }
}

export function sanitizeJsonString(str: string): string {
  let result = '';
  let inString = false;
  let escaped = false;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (char === '"' && !escaped) {
      inString = !inString;
    }
    
    if (inString) {
      if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else {
        result += char;
      }
    } else {
      result += char;
    }
    
    if (char === '\\' && !escaped) {
      escaped = true;
    } else {
      escaped = false;
    }
  }
  return result;
}

export function extractJson(text: string): string {
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  
  if (firstBrace === -1 && firstBracket === -1) {
    return text;
  }
  
  let startIdx = -1;
  let startChar = '';
  let endChar = '';
  
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    startChar = '{';
    endChar = '}';
  } else {
    startIdx = firstBracket;
    startChar = '[';
    endChar = ']';
  }
  
  let count = 0;
  let inString = false;
  let escaped = false;
  
  for (let i = startIdx; i < text.length; i++) {
    const char = text[i];
    
    if (char === '"' && !escaped) {
      inString = !inString;
    }
    
    if (!inString) {
      if (char === startChar) {
        count++;
      } else if (char === endChar) {
        count--;
        if (count === 0) {
          return text.substring(startIdx, i + 1);
        }
      }
    }
    
    if (char === '\\' && !escaped) {
      escaped = true;
    } else {
      escaped = false;
    }
  }
  
  // Fallback to last index if matching failed
  if (startChar === '{') {
    const lastBrace = text.lastIndexOf('}');
    if (lastBrace > startIdx) {
      return text.substring(startIdx, lastBrace + 1);
    }
  } else {
    const lastBracket = text.lastIndexOf(']');
    if (lastBracket > startIdx) {
      return text.substring(startIdx, lastBracket + 1);
    }
  }
  
  return text;
}

export function safeJsonParse(text: string): any {
  const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const extracted = extractJson(cleanedText);
  const sanitized = sanitizeJsonString(extracted);
  return JSON.parse(sanitized);
}

export type AiActionType = 'auto' | 'longer' | 'shorter' | 'professional' | 'casual' | 'fix_contradiction';

export interface AiGenParams {
  model?: string;
  temperature?: number;
  topP?: number;
  useDeepReasoning?: boolean;
  customInstruction?: string;
  apiKey?: string;
  groqApiKey?: string; // Ghi đè key Groq (Llama-3-8B); nếu trống lấy từ UI/env
  groqModel?: string;  // Model Groq tùy chỉnh (mặc định llama-3.1-8b-instant)
  personaInstructions?: string; // Chỉ dẫn của Persona đang chọn — chèn lên đầu systemInstruction
}

/** Chèn chỉ dẫn Persona (nếu có) lên đầu một systemInstruction. */
export function withPersona(systemInstruction: string, personaInstructions?: string): string {
  const p = personaInstructions?.trim();
  if (!p) return systemInstruction;
  return `[PERSONA]\n${p}\n\n${systemInstruction}`;
}

export async function generateAutoBlockStream(
  blockType: string, 
  blockTitle: string, 
  currentText: string, 
  contextBlocks: {title: string, content: string}[],
  actionType: AiActionType | string,
  detailLevel: number,
  onChunk: (chunk: string) => void,
  options?: AiGenParams
) {
  try {
    let blockDirectives = "";
    switch (blockType) {
      case 'role':
      case 'task':
        blockDirectives = "NGUYÊN TẮC: Viết trực diện, đi vào trọng tâm, bám sát các yêu cầu từ kỹ thuật đóng vai.";
        break;
      case 'context':
      case 'example':
        blockDirectives = "NGUYÊN TẮC: Trình bày đủ ý, có cấu trúc nhưng súc tích, tránh lặp.";
        break;
      case 'constraints':
      case 'format':
        blockDirectives = "NGUYÊN TẮC: Kết xuất dưới dạng danh sách gạch đầu dòng ngắn gọn.";
        break;
      default:
        blockDirectives = "NGUYÊN TẮC: Trình bày với cấu trúc tiêu chuẩn và rõ nghĩa.";
    }

    // detailLevel điều khiển hướng dẫn độ dài. Trần token chỉ là "lưới an toàn" chống
    // sinh lan man — đặt rộng rãi để KHÔNG cắt ngang nội dung bình thường (tiếng Việt
    // tốn nhiều token/từ). Việc rút gọn do hướng dẫn trong prompt đảm nhiệm, không phải
    // do cắt cứng đầu ra.
    let detailInstruction = "";
    let maxOutputTokens = 1024;
    if (detailLevel === 1) { detailInstruction = "YÊU CẦU: RẤT NGẮN GỌN, chỉ 1-3 câu hoặc vài gạch đầu dòng."; maxOutputTokens = 768; }
    else if (detailLevel === 2) { detailInstruction = "YÊU CẦU: TIÊU CHUẨN, đủ ý nhưng cô đọng."; maxOutputTokens = 1536; }
    else if (detailLevel === 3) { detailInstruction = "YÊU CẦU: CHI TIẾT NHƯNG CÓ KIỂM SOÁT, không lan man, không lặp lại ý."; maxOutputTokens = 3072; }

    let actionInstruction = "";
    switch (actionType) {
      case 'longer': actionInstruction = "HÀNH ĐỘNG: Xẻ nhỏ vấn đề, viết dài và sâu sắc hơn."; break;
      case 'shorter': actionInstruction = "HÀNH ĐỘNG: Rút gọn tối đa, bỏ từ nối thừa."; break;
      case 'professional': actionInstruction = "HÀNH ĐỘNG: Đổi giọng văn trịnh trọng, chuyên nghiệp."; break;
      case 'casual': actionInstruction = "HÀNH ĐỘNG: Đổi giọng văn thân thiện, dễ gần."; break;
      case 'fix_contradiction': actionInstruction = "HÀNH ĐỘNG: Rà soát nội dung với ngữ cảnh các khối khác, phát hiện và sửa các lỗi mâu thuẫn logic, đảm bảo tính nhất quán chặt chẽ."; break;
      case 'auto': actionInstruction = "HÀNH ĐỘNG: Hoàn thiện thông tin tối ưu."; break;
      default: 
        actionInstruction = `HÀNH ĐỘNG: Biến đổi và cải thiện nội dung theo yêu cầu sau của người dùng: "${actionType}".`; 
        break;
    }

    if (options?.customInstruction) {
      actionInstruction += `\nYÊU CẦU BỔ SUNG CỦA NGƯỜI DÙNG: "${options.customInstruction}".`;
    }

    // Tối ưu Payload bằng cách chỉ lấy title và 60 ký tự đầu tiên của các block khác làm ngữ cảnh (Context Pruning)
    const optimizedContext = contextBlocks.map(b => `- [${b.title}]: ${b.content.substring(0, 60)}${b.content.length > 60 ? '...' : ''}`).join('\n');

    const systemInstruction = `Bạn là chuyên gia Prompt Engineering.
Phần cần xử lý: [${blockTitle}] (Loại: ${blockType}).
${blockDirectives}
${detailInstruction}
${actionInstruction}

Các phần khác trong Prompt (Ngữ cảnh):
${optimizedContext}

Nội dung hiện tại cho [${blockTitle}]: "${currentText}".
Sinh ra chính xác đoạn nội dung trực tiếp cần thiết để điền vào.
QUAN TRỌNG: Nội dung này là VĂN BẢN PROMPT THẬT — viết như đang RA LỆNH TRỰC TIẾP cho AI sẽ thực thi prompt (xưng "Bạn", dùng câu mệnh lệnh "Hãy...", "Bạn là..."). TUYỆT ĐỐI KHÔNG viết theo kiểu mô tả/khuyên người dùng nên điền gì (SAI: "Khai báo vai trò..."; ĐÚNG: "Bạn là...").
Ưu tiên súc tích, đi thẳng trọng tâm, không lặp ý, không thêm lời dẫn. KHÔNG GIẢI THÍCH, KHÔNG CHÀO HỎI.`;

    // Dynamic model routing for speed and reasoning
    let modelName = options?.model;
    if (!modelName) {
      const isSimpleBlock = ['tone', 'format', 'constraints'].includes(blockType);
      if (isSimpleBlock || !options?.useDeepReasoning) {
        modelName = GEMINI_FLASH_LATEST;
      } else {
        modelName = GEMINI_PRO;
      }
    }
    const temperature = options?.temperature !== undefined ? options.temperature : TASK_DEFAULTS.blockGeneration.temperature;
    const topP = options?.topP !== undefined ? options.topP : TASK_DEFAULTS.blockGeneration.topP;
    const userContent = currentText ? `Cải thiện đoạn: ${currentText}` : `Viết phần ${blockTitle}`;

    // Ưu tiên Llama-3-8B (Groq) cho việc tạo nội dung khối để tiết kiệm hạn mức Gemini;
    // nếu Groq lỗi thì fallback sang Gemini. Cả hai tự định tuyến key riêng/proxy.
    try {
      await callGroqChatStream(systemInstruction, userContent, onChunk, {
        apiKey: options?.groqApiKey,
        model: options?.groqModel,
        temperature,
        topP,
        maxTokens: maxOutputTokens,
      });
    } catch (groqError) {
      console.warn('Groq (Llama-3-8B) stream thất bại, chuyển về Gemini:', groqError);
      await geminiStream(
        {
          model: modelName,
          systemInstruction,
          userContent,
          temperature,
          topP,
          maxOutputTokens,
          options,
        },
        onChunk
      );
    }
  } catch (error) {
    console.error("AI Stream Generation failed:", error);
    throw error;
  }
}

export async function autoFillVariables(
  profileDescription: string,
  templateContent: string,
  variablesToFill: string[],
  options?: AiGenParams
): Promise<Record<string, string>> {
  try {
    const systemInstruction = `Bạn là chuyên gia điền biến số (variable filler).
Nhiệm vụ của bạn là dựa vào hồ sơ cá nhân của người dùng và nội dung dự kiến của Prompt, 
hãy suy luận và tự động điền các thông tin phù hợp nhất bằng tiếng Việt cho các biến số được yêu cầu.

[Hồ sơ cá nhân của người dùng]
${profileDescription || 'Chưa thiết lập (hãy tự suy diễn một cách thông thái cho người dùng chung)'}

[Nội dung Prompt tham khảo]
${templateContent}

Bạn phải trả lại **CHỈ MỘT OBJECT JSON**, có key là tên biến, value là giá trị điền. 
KHÔNG MỞ ĐẦU, KHÔNG GIẢI THÍCH, KHÔNG FORMAT MARKDOWN LOẠI BỎ (\`\`\`json). Chỉ thuần túy JSON object string.`;

    const prompt = `Điền các biến sau: ${variablesToFill.join(', ')}`;

    const modelName = options?.model || GEMINI_FLASH; // Flash is very fast for JSON fill
    const temperature = options?.temperature !== undefined ? options.temperature : TASK_DEFAULTS.jsonFill.temperature; // Extremely low creativity for JSON compliance
    const topP = options?.topP !== undefined ? options.topP : TASK_DEFAULTS.jsonFill.topP;

    const text = await geminiGenerateWithFallback({
      model: modelName,
      systemInstruction,
      userContent: prompt,
      temperature,
      topP,
      json: true,
      options,
    });
    try {
      return safeJsonParse(text);
    } catch(e) {
      console.error("Failed to parse JSON auto-fill", text);
      return {};
    }
  } catch (error) {
    console.error("AI Auto Fill failed:", error);
    throw error;
  }
}

export async function generateQuickResponse(
  shortInput: string,
  packBlocks?: { type: string, title: string, content: string }[],
  onChunk?: (chunk: string) => void,
  options?: AiGenParams
): Promise<string> {
  try {
    let systemInstruction = `Bạn là một AI Assistant cấp cao chuyên xử lý tác vụ nhanh gọn hiệu quả.
    
Người dùng vừa gửi một yêu cầu rất ngắn. Tuy nhiên, hệ thống đã ngầm (invisibly) bọc yêu cầu này trong một cấu trúc tinh vi để đảm bảo chất lượng.
`;

    if (packBlocks && packBlocks.length > 0) {
      systemInstruction += `\n[CÁC RÀNG BUỘC VÀ NGỮ CẢNH BỊ ẨN TỪ HỆ THỐNG]\n`;
      packBlocks.forEach(b => {
        systemInstruction += `- Thẻ <${b.type}>: ${b.content}\n`;
      });
      systemInstruction += `\nBẮT BUỘC TUÂN THỦ CÁC HƯỚNG DẪN TRÊN TRONG QUÁ TRÌNH TRẢ LỜI.\n`;
    } else {
      systemInstruction += `
[CẤU TRÚC NGẦM ĐỊNH TỪ HỆ THỐNG MẶC ĐỊNH]
- Thẻ <Role>: Ngươi là một chuyên gia thực tế, đi thẳng vào vấn đề.
- Thẻ <Constraints>: Trình bày trực tiếp, không vòng vo "Xin chào", "Dưới đây là", sử dụng format rõ ràng (bullet points, markdown table) nếu cần thiết. Không sử dụng các từ ngữ sáo rỗng.
`;
    }

    systemInstruction = withPersona(systemInstruction, options?.personaInstructions);

    const modelName = options?.model || GEMINI_FLASH_LATEST;
    const temperature = options?.temperature !== undefined ? options.temperature : TASK_DEFAULTS.blockGeneration.temperature;
    const topP = options?.topP !== undefined ? options.topP : TASK_DEFAULTS.blockGeneration.topP;

    let fullText = "";
    await geminiStreamWithFallback(
      {
        model: modelName,
        systemInstruction,
        userContent: shortInput,
        temperature,
        topP,
        options,
      },
      (chunk) => {
        fullText += chunk;
        if (onChunk) onChunk(chunk);
      }
    );
    return fullText;
  } catch (error) {
    console.error("AI Quick Generation failed:", error);
    throw error;
  }
}

export async function generateContentForExistingBlocks(
  topic: string,
  blocksInfo: { id: string, type: string, title: string }[],
  options?: AiGenParams
): Promise<Record<string, string>> {
  try {
    const systemInstruction = `Bạn là chuyên gia Prompt Engineering cấp cao.
Người dùng yêu cầu tự động điền nội dung cho một prompt framework về chủ đề/nhiệm vụ: "${topic}"

Các khối hiện tại đang có trong Prompt:
${blocksInfo.map(b => `- ID: ${b.id} | Phân loại: ${b.type} | Tiêu đề: ${b.title}`).join('\n')}

Bạn phải trả lại một JSON Object. Mỗi key là ID của khối (block ID), value là nội dung tương ứng của khối đó.

QUY TẮC VIẾT NỘI DUNG (QUAN TRỌNG NHẤT):
- Nội dung mỗi khối chính là VĂN BẢN PROMPT THẬT — viết như đang RA LỆNH TRỰC TIẾP cho AI sẽ thực thi prompt (xưng "Bạn", dùng câu mệnh lệnh "Hãy...", "Bạn là...").
- TUYỆT ĐỐI KHÔNG viết theo kiểu mô tả/khuyên người dùng nên điền gì (SAI: "Khai báo vai trò...", "Mô tả nhiệm vụ..."; ĐÚNG: "Bạn là...", "Hãy...").
Nội dung mỗi khối phải sát chủ đề "${topic}", súc tích và đi thẳng trọng tâm, không lan man, không lặp ý.
Với thẻ 'thinking', 'anchor', 'self_correction', 'input_data' hãy viết nội dung đặc thù phù hợp nội dung.

Trọng tâm: Cung cấp nội dung CHẤT LƯỢNG CAO, CÔ ĐỌNG, SẴN SÀNG SỬ DỤNG (tối ưu token).

BẮT BUỘC trả về ĐÚNG ĐỊNH DẠNG JSON.
KHÔNG MỞ ĐẦU, KHÔNG GIẢI THÍCH, KHÔNG FORMAT MARKDOWN.`;

    const geminiModel = options?.useDeepReasoning ? GEMINI_PRO : GEMINI_FLASH_LATEST;
    const temperature = options?.temperature !== undefined ? options.temperature : TASK_DEFAULTS.structured.temperature;
    const topP = options?.topP !== undefined ? options.topP : TASK_DEFAULTS.structured.topP;

    const text = await generatePromptJson(
      systemInstruction,
      `Hãy tạo nội dung cho các khối tương ứng để giải quyết nhiệm vụ: "${topic}"`,
      geminiModel,
      temperature,
      topP,
      options
    );
    return safeJsonParse(text);
  } catch (error) {
    console.error("AI Quick Fill failed:", error);
    throw error;
  }
}

export async function generateStructuredTemplateFromTopic(
  topic: string,
  options?: AiGenParams
): Promise<any> {
  try {
    const systemInstruction = `Bạn là một chuyên gia Prompt Engineering đẳng cấp quốc tế.
Nhiệm vụ của bạn là nhận vào chủ đề hoặc nhiệm vụ từ người dùng và xây dựng nên một cấu trúc Prompt chuyên nghiệp và tinh vi bậc nhất theo cấu trúc nhiều mảnh ghép (Multi-block Framework).

QUY TẮC VIẾT NỘI DUNG (QUAN TRỌNG NHẤT):
- Nội dung mỗi khối chính là VĂN BẢN PROMPT THẬT — hãy viết như đang RA LỆNH TRỰC TIẾP cho AI sẽ thực thi prompt.
- Xưng hô với AI đó bằng "Bạn" và dùng câu mệnh lệnh ("Hãy...", "Bạn là...", "Tuyệt đối không...").
- TUYỆT ĐỐI KHÔNG viết theo kiểu mô tả/hướng dẫn người dùng nên điền gì.
  · SAI (mô tả cho người dùng): "Khai báo vai trò chuyên gia phù hợp", "Mô tả chi tiết nhiệm vụ cần làm", "Cung cấp ngữ cảnh liên quan".
  · ĐÚNG (ra lệnh cho AI): "Bạn là một chuyên gia... với nhiều năm kinh nghiệm...", "Hãy viết một kịch bản...", "Bối cảnh: người dùng đang...".
- Điền nội dung cụ thể, sát chủ đề "${topic}", sẵn sàng dùng ngay — không để lại chỗ trống hay câu hướng dẫn chung chung.

Bạn phải chọn phân loại phù hợp nhất cho prompt này trong số: 'Học sinh/Sinh viên', 'Người đi làm', 'Sáng tạo nội dung', 'Phát triển cá nhân', 'Lập trình viên'.
Tạo từ 3 đến 5 tags liên quan. Khối blocks gồm: role, task, context, constraints, format.

Hãy trả về CHỈ MỘT JSON OBJECT khớp với định dạng cấu trúc sau (phần "content" bên dưới chỉ minh hoạ VĂN PHONG ra lệnh trực tiếp cho AI — hãy thay bằng nội dung thật, sát chủ đề):
{
  "title": "Tên Prompt ngắn gọn, thu hút (ví dụ: Chuyên gia sáng tạo kịch bản TikTok ngắn)",
  "description": "Mô tả mục đích và cách sử dụng cấu trúc prompt này",
  "category": "Chọn 1 trong các mục trên",
  "tags": ["tag1", "tag2", "tag3"],
  "blocks": [
    { "type": "role", "title": "🎭 Vai trò (Role)", "content": "Bạn là một [chuyên gia...] với chuyên môn sâu về [lĩnh vực] và khả năng [năng lực nổi bật]." },
    { "type": "task", "title": "🎯 Nhiệm vụ (Task)", "content": "Hãy [hành động cụ thể] cho [đối tượng], bao gồm [các bước/thành phần bắt buộc có]." },
    { "type": "context", "title": "📌 Bối cảnh (Context)", "content": "Bối cảnh: [tình huống thực tế, đối tượng người đọc, thông tin nền mà bạn cần biết để thực hiện]." },
    { "type": "constraints", "title": "⚠️ Ràng buộc (Constraints)", "content": "Tuyệt đối không dùng từ sáo rỗng, không dông dài. Chỉ tập trung vào [phạm vi]. Giữ giọng văn [phong cách]." },
    { "type": "format", "title": "📋 Định dạng cấu trúc (Format)", "content": "Trình bày kết quả theo [cấu trúc: các mục/bảng/gạch đầu dòng], mở đầu bằng [...], kết thúc bằng [...]." }
  ]
}

BẮT BUỘC trả về ĐÚNG GIÁ TRỊ JSON cấu trúc như trên. KHÔNG bình luận, KHÔNG giải thích, KHÔNG bọc trong các ký tự markdown dư thừa.`;

    const geminiModel = options?.useDeepReasoning ? GEMINI_PRO : GEMINI_FLASH_LATEST;
    const temperature = options?.temperature !== undefined ? options.temperature : TASK_DEFAULTS.structured.temperature;
    const topP = options?.topP !== undefined ? options.topP : TASK_DEFAULTS.structured.topP;

    const text = await generatePromptJson(
      systemInstruction,
      `Hãy tạo một Framework Prompt cấu trúc hoàn hảo cho nhiệm vụ: "${topic}"`,
      geminiModel,
      temperature,
      topP,
      options
    );
    const result = safeJsonParse(text);
    
    if (result.blocks && Array.isArray(result.blocks)) {
      result.blocks = result.blocks.map((b: any, idx: number) => ({
        ...b,
        id: `gen-block-${idx}-${Date.now()}`
      }));
    }
    
    result.id = `gen-tpl-${Date.now()}`;
    return result;
  } catch (error) {
    console.error("AI instant builder from topic failed:", error);
    throw error;
  }
}

export async function enhancePromptWithAi(
  inputPrompt: string,
  options?: AiGenParams
): Promise<any[]> {
  try {
    const geminiModel = options?.useDeepReasoning ? GEMINI_PRO : GEMINI_FLASH_LATEST;
    const temperature = options?.temperature !== undefined ? options.temperature : TASK_DEFAULTS.blockGeneration.temperature;
    const topP = options?.topP !== undefined ? options.topP : TASK_DEFAULTS.blockGeneration.topP;

    const systemInstruction = `Bạn là một chuyên gia Prompt Engineer đẳng cấp quốc tế.
Nhiệm vụ của bạn là nhận một prompt cơ bản từ người dùng và nâng cấp nó thành một prompt chuyên nghiệp, rõ ràng, và mang lại hiệu quả cao nhất.

QUY TẮC VIẾT NỘI DUNG (QUAN TRỌNG NHẤT):
- Nội dung "content" mỗi khối chính là VĂN BẢN PROMPT THẬT — viết như đang RA LỆNH TRỰC TIẾP cho AI sẽ thực thi prompt (xưng "Bạn", dùng câu mệnh lệnh "Hãy...", "Bạn là...").
- TUYỆT ĐỐI KHÔNG viết theo kiểu mô tả/khuyên người dùng nên điền gì.
  · SAI: "Khai báo vai trò chuyên gia phù hợp", "Bạn nên mô tả rõ nhiệm vụ".
  · ĐÚNG: "Bạn là một chuyên gia...", "Hãy thực hiện...".
- Bám sát ý định gốc trong prompt của người dùng, làm rõ và cụ thể hoá — không bịa thêm mục tiêu mới.

BẠN PHẢI TRẢ VỀ ĐÚNG MỘT CHUỖI JSON THEO CẤU TRÚC BÊN DƯỚI, KHÔNG ĐƯỢC CHỨA TEXT NÀO KHÁC BÊN NGOÀI JSON (Không dùng markdown \`\`\`json):
{
  "blocks": [
    {
      "type": "role",
      "title": "Vai trò (Role)",
      "content": "Bạn là một chuyên gia..."
    }
  ]
}
Chú ý, trường 'type' bắt buộc phải là MỘT TRONG CÁC GIÁ TRỊ SAU: 'role', 'task', 'context', 'format', 'tone', 'constraints', 'example'.
Cố gắng phân tích prompt của người dùng và chia nhỏ ra thành ít nhất 3 block trở lên để cấu trúc rõ ràng.`;

    const jsonStr = await generatePromptJson(
      withPersona(systemInstruction, options?.personaInstructions),
      `Hãy phân tích và tối ưu hoá prompt cơ bản sau:\n\n${inputPrompt}`,
      geminiModel,
      temperature,
      topP,
      options
    );
    const parsed = safeJsonParse(jsonStr);
    
    if (parsed && parsed.blocks && Array.isArray(parsed.blocks)) {
      return parsed.blocks;
    }
    throw new Error("Invalid output format from AI.");
  } catch (error) {
    console.error("AI Enhance Prompt failed:", error);
    throw error;
  }
}

// Biến thể STREAMING của enhancePromptWithAi: phát text thô theo token (onChunk) để
// hiển thị tiến trình "AI đang soạn" theo thời gian thực, rồi parse JSON ở cuối thành
// danh sách block. Dùng cho tab Enhancer.
export async function enhancePromptWithAiStream(
  inputPrompt: string,
  onChunk: (chunk: string) => void,
  options?: AiGenParams
): Promise<any[]> {
  const geminiModel = options?.useDeepReasoning ? GEMINI_PRO : GEMINI_FLASH_LATEST;
  const temperature = options?.temperature !== undefined ? options.temperature : TASK_DEFAULTS.blockGeneration.temperature;
  const topP = options?.topP !== undefined ? options.topP : TASK_DEFAULTS.blockGeneration.topP;

  const systemInstruction = `Bạn là một chuyên gia Prompt Engineer đẳng cấp quốc tế.
Nhiệm vụ của bạn là nhận một prompt cơ bản từ người dùng và nâng cấp nó thành một prompt chuyên nghiệp, rõ ràng, và mang lại hiệu quả cao nhất.

QUY TẮC VIẾT NỘI DUNG (QUAN TRỌNG NHẤT):
- Nội dung "content" mỗi khối chính là VĂN BẢN PROMPT THẬT — viết như đang RA LỆNH TRỰC TIẾP cho AI sẽ thực thi prompt (xưng "Bạn", dùng câu mệnh lệnh "Hãy...", "Bạn là...").
- TUYỆT ĐỐI KHÔNG viết theo kiểu mô tả/khuyên người dùng nên điền gì.
  · SAI: "Khai báo vai trò chuyên gia phù hợp", "Bạn nên mô tả rõ nhiệm vụ".
  · ĐÚNG: "Bạn là một chuyên gia...", "Hãy thực hiện...".
- Bám sát ý định gốc trong prompt của người dùng, làm rõ và cụ thể hoá — không bịa thêm mục tiêu mới.

BẠN PHẢI TRẢ VỀ ĐÚNG MỘT CHUỖI JSON THEO CẤU TRÚC BÊN DƯỚI, KHÔNG ĐƯỢC CHỨA TEXT NÀO KHÁC BÊN NGOÀI JSON (không bọc trong khối mã markdown):
{
  "blocks": [
    { "type": "role", "title": "Vai trò (Role)", "content": "Bạn là một chuyên gia..." }
  ]
}
Chú ý, trường 'type' bắt buộc phải là MỘT TRONG CÁC GIÁ TRỊ SAU: 'role', 'task', 'context', 'format', 'tone', 'constraints', 'example'.
Cố gắng phân tích prompt của người dùng và chia nhỏ ra thành ít nhất 3 block trở lên để cấu trúc rõ ràng.`;

  let fullText = '';
  await geminiStreamWithFallback(
    {
      model: options?.model || geminiModel,
      systemInstruction: withPersona(systemInstruction, options?.personaInstructions),
      userContent: `Hãy phân tích và tối ưu hoá prompt cơ bản sau:\n\n${inputPrompt}`,
      temperature,
      topP,
      maxOutputTokens: 4096,
      options,
    },
    (chunk) => {
      fullText += chunk;
      onChunk(chunk);
    }
  );

  const parsed = safeJsonParse(extractJson(fullText));
  if (parsed && parsed.blocks && Array.isArray(parsed.blocks)) {
    return parsed.blocks;
  }
  throw new Error('Invalid output format from AI.');
}

// ─────────────────────────────────────────────────────────────────────────────
// Model Bake-off (Lab · Tầng 1): chạy CÙNG một prompt trên nhiều model rồi đo
// chất lượng × chi phí × độ trễ. runPromptOnModel chạy đúng 1 model (KHÔNG fallback
// để so sánh công bằng); scoreOutputQuality là giám khảo LLM cố định chấm 0–100.
// ─────────────────────────────────────────────────────────────────────────────

/** Chạy một prompt trên đúng một model, trả về text + độ trễ (ms). Không tự fallback. */
export async function runPromptOnModel(params: {
  model: string;
  provider: ModelProvider;
  systemInstruction: string;
  userContent: string;
  temperature?: number;
  topP?: number;
  apiKeys?: { gemini?: string; groq?: string; openai?: string };
}): Promise<{ text: string; latencyMs: number }> {
  const { model, provider, systemInstruction, userContent } = params;
  const temperature = params.temperature ?? TASK_DEFAULTS.blockGeneration.temperature;
  const topP = params.topP ?? TASK_DEFAULTS.blockGeneration.topP;
  const started = Date.now();
  let text = '';

  if (provider === 'groq') {
    text = await callGroqChat(systemInstruction, userContent, {
      apiKey: params.apiKeys?.groq, model, temperature, topP,
    });
  } else if (provider === 'gemini') {
    text = await geminiGenerate({
      model, systemInstruction, userContent, temperature, topP,
      options: { apiKey: params.apiKeys?.gemini },
    });
  } else {
    // openai (và provider tương thích OpenAI khác): gom chunk từ stream.
    await runPlaygroundChatStream(
      'openai',
      systemInstruction,
      [{ role: 'user', content: userContent }],
      { apiKey: params.apiKeys?.openai, model, temperature },
      (c) => { text += c; },
    );
  }

  return { text, latencyMs: Date.now() - started };
}

export interface QualityScore {
  score: number; // 0–100 tổng
  perCriterion: { name: string; score: number; feedback: string }[];
  feedback: string;
}

/** Giám khảo LLM cố định: chấm chất lượng một đầu ra theo bộ tiêu chí (0–100). */
export async function scoreOutputQuality(
  output: string,
  criteria: string[],
  options?: AiGenParams,
): Promise<QualityScore> {
  const judgeModel = options?.model || GEMINI_PRO; // model giám khảo cố định → công bằng giữa các thí sinh
  const criteriaText = (criteria && criteria.length > 0)
    ? criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')
    : '1. Hữu ích, chính xác, đúng trọng tâm.\n2. Rõ ràng, mạch lạc, đúng định dạng yêu cầu.';

  const systemInstruction = `Bạn là giám khảo trung lập chấm CHẤT LƯỢNG đầu ra do một AI tạo ra, dựa trên bộ tiêu chí cho trước.
Chấm từng tiêu chí theo thang 0–100 và một điểm TỔNG 0–100 (cân nhắc tổng thể).
Chỉ chấm dựa trên đầu ra, không suy diễn ngoài lề. Khắt khe và nhất quán.
BẮT BUỘC chỉ trả về đúng một JSON, KHÔNG markdown, KHÔNG chữ thừa:
{"score": <0-100>, "perCriterion": [{"name": "<tên tiêu chí>", "score": <0-100>, "feedback": "<ngắn gọn>"}], "feedback": "<nhận xét tổng thể ngắn>"}`;

  const userContent = `[BỘ TIÊU CHÍ]\n${criteriaText}\n\n[ĐẦU RA CẦN CHẤM]\n${output}`;

  const text = await geminiGenerateWithFallback({
    model: judgeModel,
    systemInstruction,
    userContent,
    temperature: TASK_DEFAULTS.evaluation.temperature,
    json: true,
    options,
  });

  const parsed = safeJsonParse(text);
  if (parsed && typeof parsed.score === 'number') {
    return {
      score: Math.max(0, Math.min(100, Math.round(parsed.score))),
      perCriterion: Array.isArray(parsed.perCriterion) ? parsed.perCriterion : [],
      feedback: typeof parsed.feedback === 'string' ? parsed.feedback : '',
    };
  }
  return { score: 50, perCriterion: [], feedback: 'Không phân tích được điểm chấm.' };
}

// ── Prompt Linter (Lab · Tầng 2 #4) ─────────────────────────────────────────
// Phân tích TĨNH một prompt và chỉ ra điểm yếu TRƯỚC KHI chạy (như linter cho code).
export interface LintIssue {
  severity: 'high' | 'medium' | 'low';
  category: string;   // mâu thuẫn / mơ hồ / thiếu ngữ cảnh / ràng buộc thừa…
  message: string;
  suggestion: string;
}

export async function lintPrompt(prompt: string, options?: AiGenParams): Promise<LintIssue[]> {
  const model = options?.model || GEMINI_FLASH;
  const systemInstruction = `Bạn là "linter" cho prompt — phân tích TĨNH một prompt và chỉ ra điểm yếu TRƯỚC KHI nó được chạy.
Tìm các vấn đề: mâu thuẫn nội tại, chỗ mơ hồ/đa nghĩa, thiếu ngữ cảnh quan trọng, ràng buộc thừa hoặc xung đột định dạng, yêu cầu chung chung không đo lường được.
Mỗi vấn đề kèm: mức độ (high/medium/low), loại ngắn gọn, mô tả, và gợi ý sửa CỤ THỂ.
Chỉ trả về JSON, KHÔNG markdown: {"issues":[{"severity":"high|medium|low","category":"<loại>","message":"<mô tả>","suggestion":"<cách sửa>"}]}.
Nếu prompt đã tốt, trả {"issues":[]}.`;

  const text = await geminiGenerateWithFallback({
    model,
    systemInstruction,
    userContent: `Prompt cần phân tích:\n"""${prompt}"""`,
    temperature: TASK_DEFAULTS.evaluation.temperature,
    json: true,
    options,
  });

  const parsed = safeJsonParse(text);
  const issues = Array.isArray(parsed?.issues) ? parsed.issues : [];
  return issues
    .filter((i: any) => i && typeof i.message === 'string')
    .map((i: any) => ({
      severity: ['high', 'medium', 'low'].includes(i.severity) ? i.severity : 'medium',
      category: typeof i.category === 'string' && i.category ? i.category : 'khác',
      message: String(i.message),
      suggestion: typeof i.suggestion === 'string' ? i.suggestion : '',
    } as LintIssue));
}

// ── Gia sư thích ứng (Lab · Tầng 2 #6) ──────────────────────────────────────
// Chẩn đoán kỹ năng viết prompt từ CHÍNH prompt thật của người dùng → bài học nhắm đúng yếu.
export interface SkillGap {
  skill: string;
  level: 'yếu' | 'trung bình' | 'tốt';
  evidence: string;
}
export interface TutorLesson {
  title: string;
  why: string;
  tip: string;
  exercise: string;
}
export interface TutorDiagnosis {
  skills: SkillGap[];
  lessons: TutorLesson[];
}

export async function diagnosePromptSkills(prompts: string[], options?: AiGenParams): Promise<TutorDiagnosis> {
  const model = options?.model || GEMINI_FLASH;
  const sample = prompts
    .filter((p) => p && p.trim())
    .slice(0, 8)
    .map((p, i) => `--- Prompt ${i + 1} ---\n${p.slice(0, 800)}`)
    .join('\n\n');

  const systemInstruction = `Bạn là gia sư Prompt Engineering. Dựa trên CÁC PROMPT THẬT của người dùng, chẩn đoán kỹ năng viết prompt của họ rồi soạn bài học nhắm đúng điểm yếu.
Đánh giá các kỹ năng cốt lõi: xác định vai trò, mô tả nhiệm vụ rõ ràng, cung cấp ngữ cảnh, quy định định dạng đầu ra, dùng ví dụ/few-shot, đặt ràng buộc đo lường được.
Với mỗi kỹ năng: mức 'yếu' | 'trung bình' | 'tốt' + BẰNG CHỨNG ngắn trích từ chính prompt của họ.
Sau đó soạn 2–4 bài học nhắm vào điểm yếu nhất: tiêu đề, vì sao quan trọng, mẹo cụ thể, và một bài tập thực hành ngắn.
Chỉ trả về JSON, KHÔNG markdown: {"skills":[{"skill":"...","level":"yếu|trung bình|tốt","evidence":"..."}],"lessons":[{"title":"...","why":"...","tip":"...","exercise":"..."}]}`;

  const text = await geminiGenerateWithFallback({
    model,
    systemInstruction,
    userContent: `Các prompt của người dùng:\n\n${sample}`,
    temperature: TASK_DEFAULTS.evaluation.temperature,
    json: true,
    options,
  });

  const parsed = safeJsonParse(text);
  const levels = ['yếu', 'trung bình', 'tốt'];
  const skills: SkillGap[] = Array.isArray(parsed?.skills)
    ? parsed.skills.filter((s: any) => s?.skill).map((s: any) => ({
        skill: String(s.skill),
        level: levels.includes(s.level) ? s.level : 'trung bình',
        evidence: typeof s.evidence === 'string' ? s.evidence : '',
      }))
    : [];
  const lessons: TutorLesson[] = Array.isArray(parsed?.lessons)
    ? parsed.lessons.filter((l: any) => l?.title).map((l: any) => ({
        title: String(l.title),
        why: typeof l.why === 'string' ? l.why : '',
        tip: typeof l.tip === 'string' ? l.tip : '',
        exercise: typeof l.exercise === 'string' ? l.exercise : '',
      }))
    : [];
  return { skills, lessons };
}

export interface CustomInstructionsParams {
  role: string;
  context: string;
  constraints: string;
  outputFormat: string;
}

export async function optimizeCustomInstructions(
  params: CustomInstructionsParams,
  options?: AiGenParams
): Promise<CustomInstructionsParams> {
  try {
    const modelName = options?.model || GEMINI_FLASH;
    const temperature = options?.temperature !== undefined ? options.temperature : TASK_DEFAULTS.structured.temperature;
    const topP = options?.topP !== undefined ? options.topP : TASK_DEFAULTS.structured.topP;

    const systemInstruction = `Bạn là một chuyên gia hàng đầu về kỹ nghệ prompt (Prompt Engineering) và cấu hình mô hình ngôn ngữ lớn (LLM Custom Instructions).
Nhiệm vụ của bạn là nhận vào 4 trường thiết lập cấu hình của người dùng và viết lại, tối ưu hóa chúng để các LLM (như Gemini, ChatGPT, Claude) hiểu chuẩn xác, nhất quán nhất, không dông dài.

Yêu cầu cụ thể:
1. Làm cho câu lệnh súc tích, đi thẳng vào ý chính, loại bỏ các từ đệm không cần thiết.
2. Cấu trúc lại mạch lạc bằng gạch đầu dòng, danh sách nếu thích hợp.
3. Không tự tiện bịa ra dự án hay thông tin khác, chỉ làm sắc nét và nâng cấp hành văn dựa trên những gì người dùng cung cấp.
4. Trả về đúng định dạng JSON object với chính xác 4 trường: "role", "context", "constraints", "outputFormat".
KHÔNG mở đầu, KHÔNG kết luận, KHÔNG bọc trong markdown codeblock \`\`\`json.`;

    const contents = `Hãy tối ưu hóa bộ Custom Instructions sau đây:
- Vai trò (Role & Persona): "${params.role}"
- Ngữ cảnh (Context & Project Memory): "${params.context}"
- Ràng buộc (Rules & Constraints): "${params.constraints}"
- Định dạng kết quả (Output Preferences): "${params.outputFormat}"`;

    const text = await geminiGenerateWithFallback({
      model: modelName,
      systemInstruction,
      userContent: contents,
      temperature,
      topP,
      json: true,
      options,
    });
    const parsed = safeJsonParse(text);
    return {
      role: parsed.role || params.role,
      context: parsed.context || params.context,
      constraints: parsed.constraints || params.constraints,
      outputFormat: parsed.outputFormat || params.outputFormat
    };
  } catch (error) {
    console.error("Optimize Custom Instructions failed:", error);
    throw error;
  }
}

export interface AiNewsItem {
  id: string;
  title: string;
  summary: string;
  category: 'models' | 'technology' | 'policy' | 'society';
  impactLevel: 'High' | 'Medium' | 'Low';
  source: string;
  date: string;
}

export async function generateLatestAiNews(
  options?: AiGenParams
): Promise<AiNewsItem[]> {
  try {
    const modelName = options?.model || GEMINI_FLASH;
    const temperature = options?.temperature !== undefined ? options.temperature : TASK_DEFAULTS.news.temperature;
    const topP = options?.topP !== undefined ? options.topP : TASK_DEFAULTS.news.topP;

    const systemInstruction = `Bạn là một AI Agent cập nhật tin tức công nghệ hàng đầu, đặc biệt chuyên sâu về Trí Tuệ Nhân Tạo (AI).
Nhiệm vụ của bạn là tổng hợp và sinh ra danh sách gồm từ 6 đến 8 tin tức AI mới nhất, nóng hổi và mang tính thực tế cao nhất (phù hợp với bối cảnh năm 2026).
Các tin tức nên đa dạng về các chủ đề: mô hình ngôn ngữ lớn (LLM), ứng dụng thực tế, quy định chính sách AI toàn cầu, hoặc phần cứng AI (GPU, chip mới).

BẮT BUỘC trả về kết quả dưới dạng danh sách các tin tức trong một JSON Object với trường "news" là một mảng các đối tượng chứa các thuộc tính sau:
- id: Một chuỗi duy nhất tự sinh (ví dụ: news-1, news-2...)
- title: Tiêu đề bản tin ngắn gọn, hấp dẫn, bằng tiếng Việt.
- summary: Tóm tắt chi tiết nội dung bản tin (khoảng 3-4 câu), nêu bật công nghệ hoặc tác động, viết bằng tiếng Việt chuyên nghiệp, cuốn hút.
- category: Thể loại, bắt buộc phải là một trong các giá trị: "models", "technology", "policy", "society".
- impactLevel: Mức độ tác động đối với cộng đồng công nghệ, bắt buộc là một trong các giá trị: "High", "Medium", "Low".
- source: Nguồn tin uy tín giả định hoặc thực tế (ví dụ: TechCrunch, VentureBeat, Google AI Blog, OpenAI Press, Wired...).
- date: Ngày tháng tin tức (định dạng YYYY-MM-DD, hãy lấy xung quanh thời điểm hiện tại năm 2026).

KHÔNG mở đầu, KHÔNG giải thích, KHÔNG bọc trong markdown codeblock \`\`\`json.`;

    const contents = `Hãy tạo danh sách các tin tức AI mới nhất cho hôm nay.`;

    const text = await geminiGenerateWithFallback({
      model: modelName,
      systemInstruction,
      userContent: contents,
      temperature,
      topP,
      json: true,
      options,
    });
    const parsed = safeJsonParse(text);
    if (parsed && Array.isArray(parsed.news)) {
      return parsed.news;
    }
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (error) {
    console.error("Generate latest AI news failed:", error);
    return [
      {
        id: "news-mock-1",
        title: "Google công bố Gemini 3.5 Flash với tốc độ vượt trội và hỗ trợ cửa sổ ngữ cảnh 5 triệu token",
        summary: "Mô hình mới mang lại tốc độ phản hồi tính bằng mili-giây, hỗ trợ đắc lực cho các tác vụ thời gian thực và phân tích kho dữ liệu đa phương tiện khổng lồ. Mức phí API cũng giảm đáng kể, tối ưu chi phí cho các doanh nghiệp.",
        category: "models",
        impactLevel: "High",
        source: "Google AI Blog",
        date: "2026-05-20"
      },
      {
        id: "news-mock-2",
        title: "Anthropic mở rộng tính năng điều khiển máy tính tự trị 'Computer Use' cho các doanh nghiệp lớn",
        summary: "Sau nhiều vòng kiểm định an toàn nghiêm ngặt, Claude 4 đã chính thức được cấp quyền tương tác chuột, bàn phím và màn hình để tự thực hiện các luồng công việc hành chính phức tạp như nhập liệu, xuất báo cáo tài chính.",
        category: "technology",
        impactLevel: "High",
        source: "VentureBeat",
        date: "2026-05-19"
      },
      {
        id: "news-mock-3",
        title: "Các nước thuộc Liên minh Châu Âu nhất trí ban hành khung pháp lý kiểm soát rủi ro AI Agents tự trị",
        summary: "Bộ quy tắc mới bắt buộc các tác nhân AI thực hiện giao dịch phải có sự giám sát của con người ở các ngưỡng giá trị lớn và sở hữu mã định danh an toàn để truy xuất trách nhiệm khi có sự cố.",
        category: "policy",
        impactLevel: "Medium",
        source: "Reuters",
        date: "2026-05-18"
      }
    ];
  }
}

export async function runPlaygroundChatStream(
  provider: 'gemini' | 'openai',
  systemInstruction: string,
  messages: { role: 'user' | 'assistant' | 'model'; content: string }[],
  config: { apiKey?: string; model?: string; temperature?: number; maxTokens?: number },
  onChunk: (chunk: string) => void
) {
  if (provider === 'gemini') {
    const model = config.model || GEMINI_FLASH;

    // Có key Gemini riêng → gọi thẳng SDK; không có → đi qua backend proxy (key mặc định).
    if (config.apiKey) {
      const client = new GoogleGenAI({ apiKey: config.apiKey });
      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' as const : 'user' as const,
        parts: [{ text: m.content }]
      }));

      const responseStream = await client.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction,
          temperature: config.temperature !== undefined ? config.temperature : 0.7,
          maxOutputTokens: config.maxTokens,
        }
      });

      for await (const chunk of responseStream) {
        if (chunk.text) {
          onChunk(chunk.text);
        }
      }
    } else {
      await proxyGenerateStream(
        {
          provider: 'gemini',
          model,
          system: systemInstruction,
          messages,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
        },
        onChunk
      );
    }
  } else if (provider === 'openai') {
    const apiKey = config.apiKey;
    if (!apiKey) {
      throw new Error("Vui lòng cấu hình OpenAI API Key để sử dụng mô hình này.");
    }
    const model = config.model || GPT_MINI;

    const openAiMessages = [
      { role: 'system', content: systemInstruction },
      ...messages.map(m => ({
        role: m.role === 'model' ? 'assistant' : m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: openAiMessages,
        temperature: config.temperature !== undefined ? config.temperature : 0.7,
        max_tokens: config.maxTokens,
        stream: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API Error: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Không thể khởi tạo đọc dữ liệu luồng (ReadableStream Reader).");
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const cleanedLine = line.trim();
        if (cleanedLine === '') continue;
        if (cleanedLine === 'data: [DONE]') continue;

        if (cleanedLine.startsWith('data: ')) {
          try {
            const dataJson = JSON.parse(cleanedLine.substring(6));
            const textChunk = dataJson.choices?.[0]?.delta?.content || '';
            if (textChunk) {
              onChunk(textChunk);
            }
          } catch (e) {
            // Ignore parsing errors for individual SSE lines
          }
        }
      }
    }
  }
}

export async function optimizeAiRules(
  content: string,
  type: 'system-rules' | 'markdown-guide',
  options?: AiGenParams
): Promise<string> {
  try {
    const systemInstruction = `Bạn là một chuyên gia cao cấp về kỹ nghệ Prompt (Prompt Engineer) và xây dựng hệ thống Quy tắc cho AI (AI Rules & Guidelines).
Nhiệm vụ của bạn là phân tích nội dung quy tắc/cẩm nang được cung cấp, sau đó viết lại để tối ưu hóa hiệu quả thực thi của mô hình ngôn ngữ lớn (LLM).

Yêu cầu tối ưu hóa:
1. Sắp xếp cấu trúc mạch lạc sử dụng Markdown chuẩn (tiêu đề, danh sách, in đậm, bảng).
2. Tự động kiểm tra và bổ sung các quy tắc quan trọng nếu đây là hệ thống quy tắc cho gia sư AI (Tutor/Mentor AI):
   - Ép buộc sử dụng phương pháp Socratic (hỏi gợi mở để dẫn dắt, KHÔNG giải bài tập hộ hay cho đáp án trực tiếp).
   - Ép buộc sử dụng LaTeX bọc bằng $ hoặc $$ khi viết công thức toán học/khoa học.
   - Thêm giọng điệu thân thiện, ấm áp kèm theo emoji.
3. Làm rõ các điều khoản ràng buộc tiêu cực (Negative Constraints - những việc AI tuyệt đối KHÔNG được làm) để tránh ảo tưởng (hallucinations).
4. Giữ nguyên mục đích và ngữ cảnh cốt lõi của người dùng, làm sắc nét hành văn.

Chỉ trả về phần nội dung Markdown đã được tối ưu hóa. KHÔNG giải thích, KHÔNG chào hỏi, KHÔNG bọc trong block code \`\`\`markdown.`;

    const contents = `Hãy tối ưu hóa bộ quy tắc (Loại: ${type}) dưới đây:\n\n${content}`;
    const modelName = options?.model || GEMINI_FLASH;
    const temperature = options?.temperature !== undefined ? options.temperature : TASK_DEFAULTS.structured.temperature;
    const topP = options?.topP !== undefined ? options.topP : TASK_DEFAULTS.structured.topP;

    return await geminiGenerateWithFallback({
      model: modelName,
      systemInstruction,
      userContent: contents,
      temperature,
      topP,
      options,
    }) || content;
  } catch (error) {
    console.error("Optimize AI Rules failed:", error);
    throw error;
  }
}

export async function generateSkillInstructions(
  title: string,
  description: string,
  inputs: { name: string; type: string; description?: string }[],
  steps: { order: number; title: string; description: string }[],
  options?: AiGenParams
): Promise<string> {
  try {
    const systemInstruction = `Bạn là một chuyên gia Prompt Engineering chuyên thiết kế kỹ năng AI cấu trúc cao (Standard AI Skills).
Nhiệm vụ của bạn là nhận vào thông tin về một Kỹ năng AI và sinh ra tài liệu hướng dẫn Markdown chi tiết (System instructions) hướng dẫn mô hình ngôn ngữ lớn cách sử dụng các tham số đầu vào (inputs) và đi qua các bước (steps) để hoàn thành công việc.

Yêu cầu tài liệu Markdown được sinh ra:
1. Có tiêu đề lớn rõ ràng dựa trên tên Kỹ năng.
2. Hướng dẫn cụ thể cách đọc và chèn các biến đầu vào dưới dạng cú pháp {{tên_biến}}.
3. Định nghĩa chính xác quy trình xử lý tuần tự từng bước (Step-by-step Workflow) cho AI, giải thích AI phải làm gì ở mỗi bước.
4. Đưa ra các ví dụ đầu ra hoặc chuẩn định dạng kết quả cuối cùng (Format specification).
5. Sử dụng cấu trúc Markdown đẹp mắt, có cảnh báo hoặc lưu ý thích hợp.

Chỉ trả về nội dung Markdown hướng dẫn chi tiết của kỹ năng này. KHÔNG giải thích gì ngoài nội dung Markdown đó, KHÔNG bọc trong block code \`\`\`markdown.`;

    const contents = `Hãy thiết kế hướng dẫn chi tiết cho Kỹ năng:
- Tiêu đề: "${title}"
- Mô tả: "${description}"
- Các biến đầu vào (Inputs):
${inputs.map(i => `  + Tên: ${i.name} | Loại: ${i.type} | Mô tả: ${i.description || 'Không có'}`).join('\n')}
- Các bước thực thi (Steps):
${steps.map(s => `  + Bước ${s.order}: ${s.title} - ${s.description}`).join('\n')}`;

    const modelName = options?.model || GEMINI_FLASH;
    const temperature = options?.temperature !== undefined ? options.temperature : TASK_DEFAULTS.structured.temperature;
    const topP = options?.topP !== undefined ? options.topP : TASK_DEFAULTS.structured.topP;

    return await geminiGenerateWithFallback({
      model: modelName,
      systemInstruction,
      userContent: contents,
      temperature,
      topP,
      options,
    });
  } catch (error) {
    console.error("Generate Skill Instructions failed:", error);
    throw error;
  }
}

/**
 * Substitute {{variable}} tokens in a skill's instructions with concrete values.
 *
 * - Whole-token matching prevents partial-name collisions (e.g. `grade` vs `grade_level`).
 * - Whitespace inside the braces is tolerated: `{{ name }}` === `{{name}}`.
 * - Booleans render as "Có"/"Không"; strings (including empty) are inserted verbatim.
 * - Unknown variables are left untouched so the gap is visible in the rendered prompt.
 *
 * Pure & side-effect free — safe to unit test and to call synchronously from the UI.
 */
export function renderSkillPrompt(
  instructions: string,
  values: Record<string, string | boolean>
): string {
  if (!instructions) return '';
  return instructions.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (token, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, name)) return token;
    const value = values[name];
    if (typeof value === 'boolean') return value ? 'Có' : 'Không';
    // Use a function replacer (above) so `$` sequences in values are never treated
    // as regex replacement patterns — values are always inserted literally.
    return value;
  });
}

/**
 * Execute a fully-rendered skill prompt against the model and return the raw text output.
 * Mirrors the generateContent pattern used by the other skill helpers above.
 */
export async function executeSkill(
  renderedPrompt: string,
  options?: AiGenParams
): Promise<string> {
  try {
    const systemInstruction = `Bạn là một trợ lý AI thực thi kỹ năng được cấu trúc sẵn.
Người dùng cung cấp một bản đặc tả kỹ năng đã được điền đầy đủ biến đầu vào.
Hãy thực hiện chính xác nhiệm vụ theo chỉ dẫn và quy trình từng bước, trả về kết quả cuối cùng dưới dạng Markdown rõ ràng, mạch lạc.
KHÔNG nhắc lại đề bài, KHÔNG giải thích quy trình nội bộ trừ khi chỉ dẫn yêu cầu.`;

    const modelName = options?.model || GEMINI_FLASH;
    const temperature = options?.temperature !== undefined ? options.temperature : TASK_DEFAULTS.structured.temperature;
    const topP = options?.topP !== undefined ? options.topP : TASK_DEFAULTS.structured.topP;

    return await geminiGenerateWithFallback({
      model: modelName,
      systemInstruction,
      userContent: renderedPrompt,
      temperature,
      topP,
      options,
    });
  } catch (error) {
    console.error("Execute Skill failed:", error);
    throw error;
  }
}

export interface SandboxEvaluationResult {
  score: number;
  criteria: {
    name: string;
    score: number;
    feedback: string;
  }[];
  generalFeedback: string;
  xpEarned: number;
}

export async function evaluateSandboxPrompt(
  domainId: 'academic' | 'creative' | 'professional' | 'entertainment',
  systemInstruction: string,
  chatHistory: { role: 'user' | 'assistant' | 'model'; content: string }[],
  options?: AiGenParams
): Promise<SandboxEvaluationResult> {
  try {
    let domainName = "";
    let gradingGuidelines = "";

    switch (domainId) {
      case 'academic':
        domainName = "Học thuật (AI Gia sư Vật lý)";
        gradingGuidelines = `Hãy đánh giá theo 4 tiêu chí:
1. Phương pháp Socratic (Tính gợi mở / Không giải hộ): AI tuyệt đối không đưa đáp án trực tiếp, phải hỏi gợi mở để học sinh tự suy nghĩ.
2. Câu hỏi định hướng: Đặt câu hỏi kích thích tư duy, đi đúng trọng tâm kiến thức.
3. Sự đồng cảm & Động viên: Thái độ thân thiện, khuyến khích học sinh kiên nhẫn học tập (sử dụng emoji).
4. Định dạng LaTeX: Các công thức toán/lý phải được định dạng chuẩn bằng LaTeX bọc trong ký hiệu $ hoặc $$.`;
        break;
      case 'creative':
        domainName = "Sáng tạo (Đồng sáng tác Tiểu thuyết)";
        gradingGuidelines = `Hãy đánh giá theo 4 tiêu chí:
1. Giọng văn (Tone Gothic): Đúng phong cách ám ảnh, đen tối, cổ điển đúng yêu cầu.
2. Sự trôi chảy cốt truyện: Cách tiếp nối câu chuyện từ câu mớm của người dùng tự nhiên, lôi cuốn.
3. Kỹ thuật Prefill: Khả năng nhận diện và bám sát câu mớm lời (prefill) ở đầu ra.
4. Ràng buộc nghệ thuật: Tuân thủ các giới hạn bối cảnh và từ vựng để tạo không khí u tối.`;
        break;
      case 'professional':
        domainName = "Chuyên môn (Tự động hóa trích xuất JSON)";
        gradingGuidelines = `Hãy đánh giá theo 4 tiêu chí:
1. Định dạng đầu ra: Đầu ra có phải là CHỈ JSON hợp lệ hay không (không chứa văn bản giải thích thừa).
2. Độ chính xác dữ liệu: Trích xuất đúng số lượng, tên người và các trường dữ liệu từ văn bản thô.
3. Cấu trúc Schema: Sử dụng đúng định dạng JSON có cấu trúc rõ ràng, thuận tiện cho lập trình.
4. Ràng buộc Constraints: Không bịa đặt thông tin không có trong văn bản thô (chống ảo tưởng).`;
        break;
      case 'entertainment':
        domainName = "Giải trí (Quản trò Dungeon Master RPG)";
        gradingGuidelines = `Hãy đánh giá theo 4 tiêu chí:
1. Nhập vai Game Master: Khả năng dẫn chuyện cuốn hút, sinh động, đúng chất RPG cổ điển.
2. Tính thử thách & Đổ xúc xắc: Yêu cầu người chơi kiểm tra chỉ số (roll dice) khi thực hiện hành động khó, không cho thắng quá dễ dàng.
3. Sự công bằng luật chơi: Đưa ra hậu quả thực tế dựa trên hành động của nhân vật (gãy chân khi nhảy từ vách đá).
4. Kiểm soát tương tác: Khuyến khích người chơi đưa ra lựa chọn tiếp theo thay vì tự chơi thay người dùng.`;
        break;
    }

    const evaluatorSystemInstruction = `Bạn là một chuyên gia đánh giá AI (AI Evaluator) và chuyên gia Prompt Engineering.
Nhiệm vụ của bạn là đánh giá System Prompt của một ứng dụng AI (thuộc lĩnh vực: ${domainName}) được học sinh thiết kế (cung cấp ở phần [System Prompt cần đánh giá]) cùng với lịch sử chat thử nghiệm giữa người dùng và ứng dụng AI đó (cung cấp ở phần [Lịch sử Chat mẫu]).

Hãy đánh giá và cho điểm từ 0 đến 100 cho 4 tiêu chí sau dựa trên hướng dẫn chấm điểm:
${gradingGuidelines}

Hãy chấm điểm cho mỗi tiêu chí từ 0 đến 100, đồng thời đưa ra nhận xét phản hồi mang tính xây dựng ngắn gọn (bằng tiếng Việt) để cải thiện Prompt đó.
Điểm số tổng quan (overall score) là trung bình cộng làm tròn của 4 tiêu chí trên.
Tính toán số điểm kinh nghiệm (XP) kiếm được: điểm tổng quan >= 80 thì thưởng 50 XP, ngược lại thưởng 10 XP.

Bạn phải trả về DUY NHẤT một đối tượng JSON có cấu trúc sau:
{
  "score": <overall_score_integer>,
  "criteria": [
    { "name": "<tên_tiêu_chí_1>", "score": <integer>, "feedback": "<nhận xét bằng tiếng Việt>" },
    { "name": "<tên_tiêu_chí_2>", "score": <integer>, "feedback": "<nhận xét bằng tiếng Việt>" },
    { "name": "<tên_tiêu_chí_3>", "score": <integer>, "feedback": "<nhận xét bằng tiếng Việt>" },
    { "name": "<tên_tiêu_chí_4>", "score": <integer>, "feedback": "<nhận xét bằng tiếng Việt>" }
  ],
  "generalFeedback": "<string>",
  "xpEarned": <integer>
}

KHÔNG trả về bất kỳ văn bản nào khác ngoài JSON này. Không bọc trong block code \`\`\`json.`;

    const chatText = chatHistory.length > 0 
      ? chatHistory.map(m => `- ${m.role === 'user' ? 'Người dùng' : 'AI Ứng dụng'}: ${m.content}`).join('\n')
      : '- (Không có lịch sử chat. Người dùng chưa tiến hành hội thoại thử nghiệm với AI)';

    const contents = `Hãy đánh giá cấu trúc prompt và lịch sử hội thoại dưới đây:

[System Prompt cần đánh giá]
${systemInstruction}

[Lịch sử Chat mẫu]
${chatText}`;

    const modelName = options?.model || GEMINI_FLASH;
    const temperature = TASK_DEFAULTS.evaluation.temperature; // Độ sáng tạo thấp để chấm điểm nhất quán

    const text = await geminiGenerateWithFallback({
      model: modelName,
      systemInstruction: evaluatorSystemInstruction,
      userContent: contents,
      temperature,
      json: true,
      options,
    });
    try {
      return safeJsonParse(text);
    } catch (e) {
      console.error("Failed to parse Sandbox evaluation JSON:", text);
      // Trả về kết quả fallback
      return {
        score: 50,
        criteria: [
          { name: "Tiêu chí 1", score: 50, feedback: "Không thể phân tích điểm số do lỗi định dạng AI." },
          { name: "Tiêu chí 2", score: 50, feedback: "Không thể phân tích điểm số." },
          { name: "Tiêu chí 3", score: 50, feedback: "Không thể phân tích điểm số." },
          { name: "Tiêu chí 4", score: 50, feedback: "Không thể phân tích điểm số." }
        ],
        generalFeedback: "Có lỗi xảy ra khi chấm điểm tự động. Vui lòng thử lại.",
        xpEarned: 10
      };
    }
  } catch (error) {
    console.error("Evaluate Sandbox Prompt failed:", error);
    throw error;
  }
}

export async function evaluateOutputQualityWithAi(
  output: string,
  criteria: string[],
  options?: AiGenParams
): Promise<'effective' | 'ineffective'> {
  try {
    const model = options?.model || GEMINI_FLASH;

    const criteriaText = criteria && criteria.length > 0
      ? criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')
      : "1. Đảm bảo nội dung hữu ích, chính xác và chuyên nghiệp.";

    const systemInstruction = `Bạn là trợ lý thẩm định chất lượng Prompt của dự án Mentor AI.
Nhiệm vụ của bạn là kiểm tra xem đoạn văn bản đầu ra của LLM dưới đây có tuân thủ đầy đủ và chính xác tất cả các quy chuẩn chất lượng hay không.

[VĂN BẢN ĐẦU RA CẦN ĐÁNH GIÁ]
${output}

[QUY CHUẨN CHẤT LƯỢNG]
${criteriaText}

Yêu cầu:
- Nếu văn bản đầu ra ĐÁP ỨNG ĐẦY ĐỦ tất cả các quy chuẩn chất lượng ở trên, hãy trả về kết quả là "effective".
- Nếu văn bản đầu ra VI PHẠM hoặc CHƯA ĐẠT bất kỳ quy chuẩn nào ở trên, hãy trả về kết quả là "ineffective".
- Chỉ trả về từ duy nhất là "effective" hoặc "ineffective". KHÔNG giải thích, KHÔNG viết thêm từ nào khác.`;

    const responseText = await geminiGenerateWithFallback({
      model,
      systemInstruction,
      userContent: "Tiến hành đánh giá chất lượng văn bản đầu ra.",
      temperature: TASK_DEFAULTS.binaryEval.temperature,
      options,
    });

    const result = responseText.trim().toLowerCase() || "effective";
    if (result.includes("ineffective")) {
      return "ineffective";
    }
    return "effective";
  } catch (error) {
    console.error("AI Output Evaluation failed:", error);
    return "effective";
  }
}

export interface TestCaseEvaluationResult {
  score: number;
  feedback: string;
}

export async function runAutomatedTestEvaluation(
  output: string,
  criteria: string[],
  options?: AiGenParams
): Promise<TestCaseEvaluationResult> {
  try {
    const model = options?.model || GEMINI_FLASH;

    const criteriaText = criteria && criteria.length > 0
      ? criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')
      : "1. Đảm bảo nội dung hữu ích, chính xác và chuyên nghiệp.";

    const systemInstruction = `Bạn là chuyên gia kiểm thử tự động (QA Automated Evaluator) cho dự án Mentor AI.
Nhiệm vụ của bạn là chấm điểm và nhận xét văn bản phản hồi dưới đây dựa trên các quy chuẩn chất lượng được cung cấp.

[VĂN BẢN PHẢN HỒI CẦN ĐÁNH GIÁ]
${output}

[QUY CHUẨN ĐÁNH GIÁ]
${criteriaText}

Yêu cầu chấm điểm:
1. Đánh giá chi tiết từng quy chuẩn xem có được tuân thủ chính xác hay không (ví dụ: có sử dụng LaTeX bọc trong $ hay $$, có hỏi gợi mở Socratic hay giải bài hộ, giọng điệu...).
2. Cho điểm số tổng quan từ 0 đến 100 (trong đó 100 là hoàn hảo, 0 là vi phạm nghiêm trọng).
3. Đưa ra nhận xét ngắn gọn (1-2 câu) giải thích lý do trừ điểm nếu có.

BẮT BUỘC trả về kết quả dưới dạng JSON object duy nhất, không giải thích gì thêm bên ngoài:
{
  "score": <điểm_số_từ_0_đến_100>,
  "feedback": "<nhận xét bằng tiếng Việt>"
}

Chỉ trả về JSON object, không sử dụng markdown code block \`\`\`json.`;

    const text = await geminiGenerateWithFallback({
      model,
      systemInstruction,
      userContent: "Tiến hành đánh giá chất lượng phản hồi.",
      temperature: TASK_DEFAULTS.binaryEval.temperature,
      json: true,
      options,
    });
    try {
      return safeJsonParse(text);
    } catch (e) {
      console.error("Failed to parse automated test evaluation JSON:", text);
      return {
        score: text.toLowerCase().includes("effective") ? 90 : 40,
        feedback: "Lỗi phân tích cú pháp kết quả chấm điểm của AI. Nhận xét thô: " + text.substring(0, 100)
      };
    }
  } catch (error) {
    console.error("AI Automated Test Evaluation failed:", error);
    return {
      score: 50,
      feedback: "Lỗi kết nối dịch vụ thẩm định AI: " + (error as Error).message
    };
  }
}

export interface AIChainEvaluation {
  score: number;
  weaknesses: string[];
  suggestions: {
    title: string;
    description: string;
    content: string;
  }[];
}

export async function evaluateAndEnhancePrompt(
  basePrompt: string,
  simulationOutput: string,
  options?: AiGenParams
): Promise<AIChainEvaluation> {
  try {
    const model = options?.model || GEMINI_FLASH;

    const systemInstruction = `Bạn là chuyên gia thẩm định và cải tiến Prompt cho hệ thống Mentor AI.
Nhiệm vụ của bạn là phân tích prompt gốc của người dùng và kết quả phản hồi giả lập tương ứng của mô hình ngôn ngữ lớn để tìm ra các điểm yếu, lỗ hổng logic, lỗi định dạng, hoặc thiếu sót khác. Từ đó chấm điểm chất lượng và đề xuất các phần bổ sung ngắn gọn (ví dụ: bổ sung quy tắc, ví dụ cụ thể, các ràng buộc bổ sung) để nối vào cuối prompt gốc giúp cải thiện kết quả.

BẠN BẮT BUỘC PHẢI TRẢ VỀ KẾT QUẢ DẠNG MỘT ĐỐI TƯỢNG JSON ĐÚNG CẤU TRÚC SAU (không bọc trong markdown code block \`\`\`json):
{
  "score": <điểm số chất lượng từ 0 đến 100>,
  "weaknesses": [
    "<nhược điểm/điểm chưa tốt thứ 1 bằng tiếng Việt>",
    "<nhược điểm/điểm chưa tốt thứ 2 bằng tiếng Việt>"
  ],
  "suggestions": [
    {
      "title": "<tiêu đề ngắn gọn của đề xuất 1, ví dụ: Ràng buộc định dạng LaTeX>",
      "description": "<mô tả chi tiết nhược điểm và tại sao cần đề xuất này>",
      "content": "<nội dung cụ thể dạng text để nối thêm vào prompt gốc, ví dụ: \\n\\n[RÀNG BUỘC PHẢN HỒI]\\n- Luôn sử dụng LaTeX...>"
    }
  ]
}

Lưu ý: nội dung trong suggestions.content phải bắt đầu bằng 1 hoặc 2 dấu xuống dòng (\\n\\n) và được định dạng rõ ràng, sẵn sàng để nối trực tiếp vào prompt gốc của người dùng.`;

    const text = await geminiGenerateWithFallback({
      model,
      systemInstruction,
      userContent: `[PROMPT GỐC CỦA NGƯỜI DÙNG]\n${basePrompt}\n\n[KẾT QUẢ GIẢ LẬP ĐẦU RA CỦA AI]\n${simulationOutput}`,
      temperature: TASK_DEFAULTS.evaluation.temperature,
      json: true,
      options,
    });
    return safeJsonParse(text);
  } catch (error) {
    console.error("evaluateAndEnhancePrompt failed:", error);
    return {
      score: 70,
      weaknesses: ["Không thể thực hiện đánh giá tự động do lỗi kết nối AI."],
      suggestions: []
    };
  }
}


