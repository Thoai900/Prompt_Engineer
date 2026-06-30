import { GoogleGenAI } from '@google/genai';
import { createRemoteJWKSet, jwtVerify } from 'jose';

// ─────────────────────────────────────────────────────────────────────────────
// Lõi dùng chung cho các Vercel Serverless Function (tên bắt đầu bằng "_" nên KHÔNG
// được coi là route). Tách từ api/ai.ts: xác thực Firebase ID token + gọi nhà cung
// cấp AI bằng key trong biến môi trường server. Dùng cho api/optimize.ts.
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_ID = 'eduai-nexus';
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export async function verifyFirebaseToken(authHeader?: string): Promise<boolean> {
  if (!authHeader) return false;
  const m = authHeader.match(/^Bearer (.+)$/);
  if (!m) return false;
  try {
    await jwtVerify(m[1], JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });
    return true;
  } catch {
    return false;
  }
}

export interface GenCall {
  provider: 'gemini' | 'groq';
  model?: string;
  system?: string;
  user: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  json?: boolean;
}

/** Gọi một nhà cung cấp AI một lần, trả text. Dùng key trong env server. */
export async function callProvider(b: GenCall): Promise<string> {
  if (b.provider === 'groq') {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('Server thiếu GROQ_API_KEY.');
    const body: any = {
      model: b.model || DEFAULT_GROQ_MODEL,
      messages: [
        ...(b.system ? [{ role: 'system', content: b.system }] : []),
        { role: 'user', content: b.user },
      ],
      temperature: b.temperature !== undefined ? b.temperature : 0.7,
      top_p: b.topP !== undefined ? b.topP : 0.95,
    };
    if (b.maxTokens) body.max_tokens = b.maxTokens;
    if (b.json) body.response_format = { type: 'json_object' };

    const r = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Groq API ${r.status}: ${await r.text()}`);
    const data: any = await r.json();
    return data?.choices?.[0]?.message?.content || '';
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Server thiếu GEMINI_API_KEY.');
  const ai = new GoogleGenAI({ apiKey: key });
  const config: any = {};
  if (b.system) config.systemInstruction = b.system;
  if (b.temperature !== undefined) config.temperature = b.temperature;
  if (b.topP !== undefined) config.topP = b.topP;
  if (b.maxTokens) config.maxOutputTokens = b.maxTokens;
  if (b.json) config.responseMimeType = 'application/json';

  const resp = await ai.models.generateContent({
    model: b.model || DEFAULT_GEMINI_MODEL,
    contents: b.user,
    config,
  });
  return resp.text || (b.json ? '{}' : '');
}

/** Trích JSON từ text có thể lẫn markdown fence. */
export function extractJsonSafe<T = any>(text: string): T | null {
  if (!text) return null;
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const first = s.search(/[[{]/);
  if (first === -1) return null;
  const lastBrace = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (lastBrace === -1) return null;
  try {
    return JSON.parse(s.slice(first, lastBrace + 1)) as T;
  } catch {
    return null;
  }
}
