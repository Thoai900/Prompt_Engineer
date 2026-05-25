import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function sanitizeJsonString(str: string): string {
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

function extractJson(text: string): string {
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

function safeJsonParse(text: string): any {
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
        blockDirectives = "NGUYÊN TẮC: Trình bày chi tiết, phân rã thông tin thành nhiều lớp.";
        break;
      case 'constraints':
      case 'format':
        blockDirectives = "NGUYÊN TẮC: Kết xuất dưới dạng danh sách gạch đầu dòng ngắn gọn.";
        break;
      default:
        blockDirectives = "NGUYÊN TẮC: Trình bày với cấu trúc tiêu chuẩn và rõ nghĩa.";
    }

    let detailInstruction = "";
    if (detailLevel === 1) detailInstruction = "YÊU CẦU: RẤT NGẮN GỌN.";
    else if (detailLevel === 2) detailInstruction = "YÊU CẦU: TIÊU CHUẨN.";
    else if (detailLevel === 3) detailInstruction = "YÊU CẦU: CỰC KỲ CHI TIẾT.";

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
Sinh ra chính xác đoạn nội dung trực tiếp cần thiết để điền vào. KHÔNG GIẢI THÍCH, KHÔNG CHÀO HỎI.`;

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

export async function generatePromptFromImage(
  imageBase64: string,
  mimeType: string,
  blocksInfo: { id: string, type: string, title: string }[],
  options?: AiGenParams
): Promise<Record<string, string>> {
  try {
    const systemInstruction = `Bạn là một "máy quét cấu trúc" cấp cao và Chuyên gia Prompt Engineering.
Nhiệm vụ của bạn là nhận xét, phân tích hình ảnh đầu vào thông qua 3 lớp:
1. Lớp Vision: Nhận diện đối tượng, văn bản, bố cục, sơ đồ, các thành phần giao diện (UI/UX) và các thực thể.
2. Lớp Structuring: Ánh xạ dữ liệu vào các thẻ của Prompt Framework hiện tại.
3. Lớp Refining: Suy luận chuyên sâu về bối cảnh hình ảnh để xuất ra cấu trúc prompt tối ưu nhất.

Dịch ngược các thiết kế (Reverse Engineering) thành cấu trúc <Role>, <Constraints>.
Trích xuất Logic (Logic Extraction) từ Sơ đồ/Flowchart thành <Task>, <Process>.
Ánh xạ ràng buộc (Constraint Mapping): Phân tích màu sắc, không gian để tạo ràng buộc <Constraints>.
Tham chiếu dữ liệu đầu vào: Thiết lập tự động thẻ <Input> nếu hình ảnh là tài liệu, bảng biểu.

Các khối (blocks) hiện tại đang có trong hệ thống Prompt:
${blocksInfo.map(b => `- ID: ${b.id} | Phân loại: ${b.type} | Tiêu đề: ${b.title}`).join('\n')}

Dựa vào phân tích hình ảnh, bạn phải tạo ra nội dung phù hợp cho CÁC KHỐI ĐANG CÓ.
Bạn trả về một JSON Object duy nhất:
{
  "block_id_1": "Nội dung cho khối 1",
  "block_id_2": "Nội dung cho khối 2"
}

KHÔNG TRẢ VỀ BẤT KỲ GÌ KHÁC NGOÀI JSON OBJECT.
Chỉ trả về các key tương ứng với ID của khối (block ID), nội dung được format dưới dạng Markdown hoặc văn bản cực kỳ chất lượng.`;

    const modelName = options?.model || 'gemini-3.5-flash'; // Flash is optimized for vision tasks
    const temperature = options?.temperature !== undefined ? options.temperature : 0.4;
    const topP = options?.topP !== undefined ? options.topP : 0.9;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          text: `Hãy phân tích hình ảnh này và tạo nội dung cho các khối (blocks) tương ứng chuyên nghiệp nhất.`
        },
        {
          inlineData: {
            data: imageBase64,
            mimeType: mimeType
          }
        }
      ],
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
    console.error("AI Image to Prompt failed:", error);
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
Nội dung của mỗi khối phải chi tiết, sát với chủ đề "${topic}", tuân theo quy tắc của chuyên gia Prompt Engineering.
Với thẻ 'thinking', 'anchor', 'self_correction', 'input_data' hãy viết nội dung đặc thù phù hợp nội dung.

Trọng tâm: Cung cấp nội dung CHẤT LƯỢNG CAO, SẴN SÀNG SỬ DỤNG.

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

    const response = await ai.models.generateContent({
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

