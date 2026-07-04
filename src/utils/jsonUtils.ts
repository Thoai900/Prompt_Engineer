// Xử lý JSON "bẩn" từ đầu ra LLM (M3: tách THUẦN từ aiService.ts để test/tái dùng;
// aiService re-export lại nên mọi import cũ vẫn chạy).

/** Escape ký tự xuống dòng/tab nằm TRONG chuỗi JSON (LLM hay trả về JSON thô vỡ chuẩn). */
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

/** Cắt đúng khối JSON đầu tiên ({...} hoặc [...]) khỏi text lẫn lời dẫn/markdown. */
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

/** Bỏ fence markdown → cắt khối JSON → sanitize → parse. Ném lỗi nếu vẫn không hợp lệ. */
export function safeJsonParse(text: string): any {
  const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const extracted = extractJson(cleanedText);
  const sanitized = sanitizeJsonString(extracted);
  return JSON.parse(sanitized);
}
