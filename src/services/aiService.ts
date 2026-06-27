import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
Sinh ra chính xác đoạn nội dung trực tiếp cần thiết để điền vào. Ưu tiên súc tích, đi thẳng trọng tâm, không lặp ý, không thêm lời dẫn. KHÔNG GIẢI THÍCH, KHÔNG CHÀO HỎI.`;

    // Dynamic model routing for speed and reasoning
    let modelName = options?.model;
    if (!modelName) {
      const isSimpleBlock = ['tone', 'format', 'constraints'].includes(blockType);
      if (isSimpleBlock || !options?.useDeepReasoning) {
        modelName = 'gemini-3.5-flash';
      } else {
        modelName = 'gemini-2.5-pro';
      }
    }
    const temperature = options?.temperature !== undefined ? options.temperature : 0.7;
    const topP = options?.topP !== undefined ? options.topP : 0.95;

    const responseStream = await ai.models.generateContentStream({
      model: modelName,
      contents: currentText ? `Cải thiện đoạn: ${currentText}` : `Viết phần ${blockTitle}`,
      config: {
        systemInstruction,
        temperature,
        topP,
        maxOutputTokens,
      }
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        onChunk(chunk.text);
      }
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

    const modelName = options?.model || 'gemini-3.5-flash'; // Flash is very fast for JSON fill
    const temperature = options?.temperature !== undefined ? options.temperature : 0.1; // Extremely low creativity for JSON compliance
    const topP = options?.topP !== undefined ? options.topP : 0.1;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction,
        temperature,
        topP,
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "{}";
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

    const modelName = options?.model || 'gemini-3.5-flash';
    const temperature = options?.temperature !== undefined ? options.temperature : 0.7;
    const topP = options?.topP !== undefined ? options.topP : 0.95;

    const responseStream = await ai.models.generateContentStream({
      model: modelName,
      contents: shortInput,
      config: {
        systemInstruction,
        temperature,
        topP,
      }
    });

    let fullText = "";
    for await (const chunk of responseStream) {
      if (chunk.text) {
        fullText += chunk.text;
        if (onChunk) {
          onChunk(chunk.text);
        }
      }
    }
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
Nội dung mỗi khối phải sát chủ đề "${topic}", súc tích và đi thẳng trọng tâm, không lan man, không lặp ý.
Với thẻ 'thinking', 'anchor', 'self_correction', 'input_data' hãy viết nội dung đặc thù phù hợp nội dung.

Trọng tâm: Cung cấp nội dung CHẤT LƯỢNG CAO, CÔ ĐỌNG, SẴN SÀNG SỬ DỤNG (tối ưu token).

BẮT BUỘC trả về ĐÚNG ĐỊNH DẠNG JSON.
KHÔNG MỞ ĐẦU, KHÔNG GIẢI THÍCH, KHÔNG FORMAT MARKDOWN.`;

    const modelName = options?.model || (options?.useDeepReasoning ? 'gemini-2.5-pro' : 'gemini-3.5-flash');
    const temperature = options?.temperature !== undefined ? options.temperature : 0.6;
    const topP = options?.topP !== undefined ? options.topP : 0.9;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: `Hãy tạo nội dung cho các khối tương ứng để giải quyết nhiệm vụ: "${topic}"`,
      config: {
        systemInstruction,
        temperature,
        topP,
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "{}";
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

Bạn phải chọn phân loại phù hợp nhất cho prompt này trong số: 'Học sinh/Sinh viên', 'Người đi làm', 'Sáng tạo nội dung', 'Phát triển cá nhân', 'Lập trình viên'.
Tạo từ 3 đến 5 tags liên quan. Khối blocks gồm: role, task, context, constraints, format.

Hãy trả về CHỈ MỘT JSON OBJECT khớp với định dạng cấu trúc sau:
{
  "title": "Tên Prompt ngắn gọn, thu hút (ví dụ: Chuyên gia sáng tạo kịch bản TikTok ngắn)",
  "description": "Mô tả mục đích và cách sử dụng cấu trúc prompt này",
  "category": "Chọn 1 trong các mục trên",
  "tags": ["tag1", "tag2", "tag3"],
  "blocks": [
    { "type": "role", "title": "🎭 Vai trò (Role)", "content": "Khai báo vai trò chuyên gia có năng lực vượt trội phù hợp..." },
    { "type": "task", "title": "🎯 Nhiệm vụ (Task)", "content": "Mô tả chi tiết và chính xác hành động cần thực hiện đối với chủ đề..." },
    { "type": "context", "title": "📌 Bối cảnh (Context)", "content": "Cung cấp ngữ cảnh, tình huống thực tế hoặc thông tin nền..." },
    { "type": "constraints", "title": "⚠️ Ràng buộc (Constraints)", "content": "Quy định quy chuẩn chặt chẽ, các điều cấm kỵ (ví dụ: Không dùng từ sáo rỗng, không dông dài)..." },
    { "type": "format", "title": "📋 Định dạng cấu trúc (Format)", "content": "Cấu trúc hiển thị kết quả đầu ra rõ ràng, sắp xếp khoa học..." }
  ]
}

BẮT BUỘC trả về ĐÚNG GIÁ TRỊ JSON cấu trúc như trên. KHÔNG bình luận, KHÔNG giải thích, KHÔNG bọc trong các ký tự markdown dư thừa.`;

    const modelName = options?.model || (options?.useDeepReasoning ? 'gemini-2.5-pro' : 'gemini-3.5-flash');
    const temperature = options?.temperature !== undefined ? options.temperature : 0.6;
    const topP = options?.topP !== undefined ? options.topP : 0.9;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: `Hãy tạo một Framework Prompt cấu trúc hoàn hảo cho nhiệm vụ: "${topic}"`,
      config: {
        systemInstruction,
        temperature,
        topP,
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "{}";
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
    const modelName = options?.model || (options?.useDeepReasoning ? 'gemini-2.5-pro' : 'gemini-3.5-flash');
    const temperature = options?.temperature !== undefined ? options.temperature : 0.7;
    const topP = options?.topP !== undefined ? options.topP : 0.95;

    const systemInstruction = `Bạn là một chuyên gia Prompt Engineer đẳng cấp quốc tế.
Nhiệm vụ của bạn là nhận một prompt cơ bản từ người dùng và nâng cấp nó thành một prompt chuyên nghiệp, rõ ràng, và mang lại hiệu quả cao nhất.
BẠN PHẢI TRẢ VỀ ĐÚNG MỘT CHUỖI JSON THEO CẤU TRÚC BÊN DƯỚI, KHÔNG ĐƯỢC CHỨA TEXT NÀO KHÁC BÊN NGOÀI JSON (Không dùng markdown \`\`\`json):
{
  "blocks": [
    {
      "type": "role", 
      "title": "Vai trò (Role)",
      "content": "Nội dung..."
    }
  ]
}
Chú ý, trường 'type' bắt buộc phải là MỘT TRONG CÁC GIÁ TRỊ SAU: 'role', 'task', 'context', 'format', 'tone', 'constraints', 'example'.
Cố gắng phân tích prompt của người dùng và chia nhỏ ra thành ít nhất 3 block trở lên để cấu trúc rõ ràng.`;

    const client = options?.apiKey ? new GoogleGenAI({ apiKey: options.apiKey }) : ai;
    const response = await client.models.generateContent({
      model: modelName,
      contents: `Hãy phân tích và tối ưu hoá prompt cơ bản sau:\n\n${inputPrompt}`,
      config: {
        systemInstruction,
        temperature,
        topP,
        responseMimeType: "application/json",
      }
    });

    const jsonStr = response.text || "{}";
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
    const modelName = options?.model || 'gemini-3.5-flash';
    const temperature = options?.temperature !== undefined ? options.temperature : 0.6;
    const topP = options?.topP !== undefined ? options.topP : 0.9;

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

    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction,
        temperature,
        topP,
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "{}";
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
    const modelName = options?.model || 'gemini-3.5-flash';
    const temperature = options?.temperature !== undefined ? options.temperature : 0.8;
    const topP = options?.topP !== undefined ? options.topP : 0.9;

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

    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction,
        temperature,
        topP,
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "{}";
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
    const client = config.apiKey ? new GoogleGenAI({ apiKey: config.apiKey }) : ai;
    const model = config.model || 'gemini-2.5-flash';
    
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
  } else if (provider === 'openai') {
    const apiKey = config.apiKey;
    if (!apiKey) {
      throw new Error("Vui lòng cấu hình OpenAI API Key để sử dụng mô hình này.");
    }
    const model = config.model || 'gpt-4o-mini';

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
    const modelName = options?.model || 'gemini-3.5-flash';
    const temperature = options?.temperature !== undefined ? options.temperature : 0.6;
    const topP = options?.topP !== undefined ? options.topP : 0.9;

    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction,
        temperature,
        topP,
      }
    });

    return response.text || content;
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

    const modelName = options?.model || 'gemini-3.5-flash';
    const temperature = options?.temperature !== undefined ? options.temperature : 0.6;
    const topP = options?.topP !== undefined ? options.topP : 0.9;

    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction,
        temperature,
        topP,
      }
    });

    return response.text || "";
  } catch (error) {
    console.error("Generate Skill Instructions failed:", error);
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

    const modelName = options?.model || 'gemini-3.5-flash';
    const temperature = 0.2; // Độ sáng tạo thấp để chấm điểm nhất quán

    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction: evaluatorSystemInstruction,
        temperature,
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "{}";
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
    const client = options?.apiKey ? new GoogleGenAI({ apiKey: options.apiKey }) : ai;
    const model = options?.model || 'gemini-3.5-flash';
    
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

    const response = await client.models.generateContent({
      model,
      contents: "Tiến hành đánh giá chất lượng văn bản đầu ra.",
      config: {
        systemInstruction,
        temperature: 0.1,
      }
    });

    const result = response.text?.trim().toLowerCase() || "effective";
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
    const client = options?.apiKey ? new GoogleGenAI({ apiKey: options.apiKey }) : ai;
    const model = options?.model || 'gemini-3.5-flash';
    
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

    const response = await client.models.generateContent({
      model,
      contents: "Tiến hành đánh giá chất lượng phản hồi.",
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "{}";
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
    const client = options?.apiKey ? new GoogleGenAI({ apiKey: options.apiKey }) : ai;
    const model = options?.model || 'gemini-3.5-flash';
    
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

    const response = await client.models.generateContent({
      model,
      contents: `[PROMPT GỐC CỦA NGƯỜI DÙNG]\n${basePrompt}\n\n[KẾT QUẢ GIẢ LẬP ĐẦU RA CỦA AI]\n${simulationOutput}`,
      config: {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "{}";
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


