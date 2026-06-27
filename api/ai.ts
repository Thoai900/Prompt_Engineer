import { GoogleGenAI } from '@google/genai';
import { createRemoteJWKSet, jwtVerify } from 'jose';

// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless Function: proxy AI giấu API key mặc định (Gemini + Groq/Llama).
// Client gọi POST /api/ai kèm Firebase ID token; hàm này xác thực token (bằng jose,
// không cần service account) rồi gọi nhà cung cấp bằng key trong biến môi trường
// (GEMINI_API_KEY / GROQ_API_KEY đặt ở Vercel → Project Settings → Environment).
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_ID = 'eduai-nexus';
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

type Role = 'user' | 'assistant' | 'model' | 'system';
interface ProxyMessage { role: Role; content: string }
interface ProxyBody {
  provider: 'gemini' | 'groq';
  model?: string;
  system?: string;
  user?: string;
  messages?: ProxyMessage[];
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  json?: boolean;
  stream?: boolean;
}

async function verifyFirebaseToken(authHeader?: string): Promise<boolean> {
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

function groqMessages(b: ProxyBody): { role: string; content: string }[] {
  const msgs: { role: string; content: string }[] = [];
  if (b.system) msgs.push({ role: 'system', content: b.system });
  if (b.messages && b.messages.length) {
    for (const m of b.messages) {
      msgs.push({ role: m.role === 'model' ? 'assistant' : m.role, content: m.content });
    }
  } else if (b.user) {
    msgs.push({ role: 'user', content: b.user });
  }
  return msgs;
}

function geminiContents(b: ProxyBody): any {
  if (b.messages && b.messages.length) {
    return b.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
  }
  return b.user || '';
}

function geminiConfig(b: ProxyBody): any {
  const config: any = {};
  if (b.system) config.systemInstruction = b.system;
  if (b.temperature !== undefined) config.temperature = b.temperature;
  if (b.topP !== undefined) config.topP = b.topP;
  if (b.maxTokens) config.maxOutputTokens = b.maxTokens;
  if (b.json) config.responseMimeType = 'application/json';
  return config;
}

async function callProvider(b: ProxyBody): Promise<string> {
  if (b.provider === 'groq') {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('Server thiếu GROQ_API_KEY.');
    const body: any = {
      model: b.model || DEFAULT_GROQ_MODEL,
      messages: groqMessages(b),
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
  const resp = await ai.models.generateContent({
    model: b.model || DEFAULT_GEMINI_MODEL,
    contents: geminiContents(b),
    config: geminiConfig(b),
  });
  return resp.text || (b.json ? '{}' : '');
}

async function streamProvider(b: ProxyBody, onChunk: (t: string) => void): Promise<void> {
  if (b.provider === 'groq') {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('Server thiếu GROQ_API_KEY.');
    const body: any = {
      model: b.model || DEFAULT_GROQ_MODEL,
      messages: groqMessages(b),
      temperature: b.temperature !== undefined ? b.temperature : 0.7,
      top_p: b.topP !== undefined ? b.topP : 0.95,
      stream: true,
    };
    if (b.maxTokens) body.max_tokens = b.maxTokens;

    const r = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Groq API ${r.status}: ${await r.text()}`);

    const reader = (r.body as any)?.getReader();
    if (!reader) throw new Error('Groq stream không khả dụng.');
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const c = line.trim();
        if (!c || c === 'data: [DONE]') continue;
        if (!c.startsWith('data: ')) continue;
        try {
          const j = JSON.parse(c.substring(6));
          const t = j.choices?.[0]?.delta?.content || '';
          if (t) onChunk(t);
        } catch {
          /* bỏ qua dòng SSE lẻ */
        }
      }
    }
    return;
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Server thiếu GEMINI_API_KEY.');
  const ai = new GoogleGenAI({ apiKey: key });
  const stream = await ai.models.generateContentStream({
    model: b.model || DEFAULT_GEMINI_MODEL,
    contents: geminiContents(b),
    config: geminiConfig(b),
  });
  for await (const chunk of stream) {
    if (chunk.text) onChunk(chunk.text);
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Chỉ hỗ trợ POST.' }); return; }

  const ok = await verifyFirebaseToken(req.headers.authorization);
  if (!ok) { res.status(401).json({ error: 'Chưa xác thực: vui lòng đăng nhập để dùng AI.' }); return; }

  let body: ProxyBody = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { res.status(400).json({ error: 'Body JSON không hợp lệ.' }); return; }
  }
  if (!body || !body.provider) { res.status(400).json({ error: 'Thiếu tham số bắt buộc (provider).' }); return; }
  if (!body.user && !(body.messages && body.messages.length)) {
    res.status(400).json({ error: 'Thiếu nội dung (user hoặc messages).' });
    return;
  }

  try {
    if (body.stream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();
      await streamProvider(body, (chunk) => {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      });
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      const text = await callProvider(body);
      res.status(200).json({ text });
    }
  } catch (err: any) {
    const message = err?.message || 'Lỗi gọi nhà cung cấp AI.';
    if (body.stream && res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    } else {
      res.status(502).json({ error: message });
    }
  }
}
