/**
 * Embedded chat flow: Guardrails → Router → IP path (VT + AI / append) or Free-text AI.
 * When user says "block" after an IP was discussed, add that IP to blocklist (or inform if already exists).
 */

const IP_REGEX = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

const VT_SYSTEM =
  'คุณคือผู้เชี่ยวชาญด้าน Cybersecurity ตอบคำถามเป็นภาษาไทย\nวิเคราะห์และสรุปผลข้อมูลที่ได้จาก virustotal ว่าควร block หรือไม่ควร block';
const CHAT_SYSTEM =
  'คุณคือผู้เชี่ยวชาญด้าน Cybersecurity ชื่อ SecBot ตอบคำถามเป็นภาษาไทย ให้ความรู้และคำแนะนำด้านความปลอดภัยทางไซเบอร์ หากคำถามไม่เกี่ยวกับ security ให้ปฏิเสธอย่างสุภาพ';

export type AiProvider = 'gemini' | 'groq' | 'gemini2.5';

async function guardrails(message: string): Promise<{ redacted: string }> {
  const urlEnv = process.env.GUARDRAILS_URL;
  // Allow disabling guardrails by setting GUARDRAILS_URL=off / disabled / none
  if (!urlEnv || ['off', 'disabled', 'none'].includes(urlEnv.toLowerCase())) {
    return { redacted: message };
  }
  const url = urlEnv || 'http://172.236.141.236:8169/redact';

  // Add a short timeout so chat doesn't hang if guardrails is unreachable
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Guardrails failed: ${res.status}`);
    const data = (await res.json()) as { redacted?: string };
    return { redacted: data.redacted ?? message };
  } catch {
    // On any failure or timeout, fall back to original message
    return { redacted: message };
  } finally {
    clearTimeout(timeout);
  }
}

function extractIps(text: string): string[] {
  const m = text.match(IP_REGEX);
  return m ? Array.from(new Set(m)) : [];
}

function getThreatFeedHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const user = process.env.THREATFEED_USER;
  const pass = process.env.THREATFEED_PASSWORD;
  if (user && pass) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
  }
  return headers;
}

export type HistoryEntry = { role: string; content: string };

function getLastIpFromHistory(history: HistoryEntry[]): string | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    const ips = extractIps(history[i].content);
    if (ips.length > 0) return ips[0];
  }
  return undefined;
}

function isBlockIntentOnly(text: string): boolean {
  const t = text.trim();
  if (t.length > 80) return false;
  if (IP_REGEX.test(t)) return false;
  IP_REGEX.lastIndex = 0;
  const lower = t.toLowerCase();
  return (
    /^\s*block\s*(it|this|the ip)?\s*$/i.test(t) ||
    /^\s*(yes\s+)?block\s*$/i.test(t) ||
    /add\s+to\s+blocklist/i.test(lower) ||
    (lower.includes('block') && t.length < 50) ||
    /บล็อก/.test(t)
  );
}

async function getBlocklistIps(): Promise<string[]> {
  const base = (process.env.THREATFEED_API_URL || '').replace(/\/$/, '');
  if (!base) throw new Error('THREATFEED_API_URL required');
  const res = await fetch(`${base}/ip/file`, {
    method: 'GET',
    headers: getThreatFeedHeaders(),
  });
  if (!res.ok) throw new Error(`Blocklist fetch failed: ${res.status}`);
  const text = await res.text();
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function appendIpToBlocklist(ip: string): Promise<{ message: string }> {
  const base = (process.env.THREATFEED_API_URL || '').replace(/\/$/, '');
  if (!base) throw new Error('THREATFEED_API_URL required');
  const existing = await getBlocklistIps();
  if (existing.includes(ip)) {
    return { message: 'IP นี้อยู่ใน blocklist แล้ว (already in blocklist).' };
  }
  const res = await fetch(`${base}/ip/add`, {
    method: 'POST',
    headers: getThreatFeedHeaders(),
    body: JSON.stringify({ ip }),
  });
  const data = (await res.json()) as {
    message?: string;
    detail?: string | { error?: string };
    error?: string;
    status?: string;
  };
  if (!res.ok) {
    const d = data.detail;
    const err =
      (typeof d === 'object' && d?.error) || data.error || (typeof d === 'string' ? d : null) || data.message;
    throw new Error(typeof err === 'string' ? err : `Append failed: ${res.status}`);
  }
  return { message: 'เพิ่ม IP เข้า blocklist แล้ว (added to blocklist).' };
}

async function virusTotalLookup(ip: string): Promise<unknown> {
  const key = process.env.VIRUSTOTAL_API_KEY;
  if (!key) throw new Error('VIRUSTOTAL_API_KEY required');
  const res = await fetch(`https://www.virustotal.com/api/v3/ip_addresses/${encodeURIComponent(ip)}`, {
    headers: { 'x-apikey': key },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`VirusTotal error: ${res.status} ${t.slice(0, 200)}`);
  }
  return res.json();
}

async function callGemini(systemInstruction: string, userContent: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY required');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ parts: [{ text: userContent }] }],
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };
  if (!res.ok || data.error)
    throw new Error(data.error?.message || `Gemini error: ${res.status}`);
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (text == null) throw new Error('Gemini returned no text');
  return text;
}

async function callGroq(systemPrompt: string, userContent: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY required');
  const model = process.env.GROQ_MODEL || 'llama-3.1-70b-versatile';
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.5,
    }),
  });
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!res.ok || data.error)
    throw new Error(data.error?.message || `Groq error: ${res.status}`);
  const text = data.choices?.[0]?.message?.content;
  if (text == null) throw new Error('Groq returned no text');
  return text;
}

async function callOpenRouter(systemPrompt: string, userContent: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY required');
  const model = process.env.OPENROUTER_GEMINI_MODEL || 'google/gemini-2.5-pro';
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
  });
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!res.ok || data.error)
    throw new Error(data.error?.message || `OpenRouter error: ${res.status}`);
  const text = data.choices?.[0]?.message?.content;
  if (text == null) throw new Error('OpenRouter returned no text');
  return text;
}

async function callAi(provider: AiProvider, systemPrompt: string, userContent: string): Promise<string> {
  if (provider === 'groq') return callGroq(systemPrompt, userContent);
  if (provider === 'gemini2.5') return callOpenRouter(systemPrompt, userContent);
  return callGemini(systemPrompt, userContent);
}

export type ChatFlowOptions = { history?: HistoryEntry[] };

/**
 * Run the full chat flow. When user says "block" (no IP in message), use last IP from history and add to blocklist (or inform if already exists).
 */
export async function runChatFlow(
  message: string,
  aiProvider: AiProvider = 'gemini',
  options?: ChatFlowOptions
): Promise<string> {
  const { redacted } = await guardrails(message);

  if (redacted.includes('MESSAGE BLOCKED')) {
    return 'MESSAGE BLOCKED';
  }

  const hasIp = IP_REGEX.test(redacted);
  IP_REGEX.lastIndex = 0;

  if (!hasIp && isBlockIntentOnly(redacted) && options?.history?.length) {
    const lastIp = getLastIpFromHistory(options.history);
    if (!lastIp) {
      return 'ไม่พบ IP ในข้อความก่อนหน้า กรุณาระบุ IP ที่ต้องการบล็อก (เช่น block 1.2.3.4)';
    }
    try {
      const result = await appendIpToBlocklist(lastIp);
      return result.message;
    } catch (e) {
      return (e instanceof Error ? e.message : 'Failed to add IP to blocklist.');
    }
  }

  if (hasIp) {
    const ips = extractIps(redacted);
    const wantsBlock = redacted.toLowerCase().includes('block');

    if (wantsBlock && ips.length > 0) {
      try {
        const result = await appendIpToBlocklist(ips[0]);
        return result.message;
      } catch (e) {
        return (e instanceof Error ? e.message : 'Failed to add IP to blocklist.');
      }
    }

    if (ips.length === 0) {
      return await callAi(aiProvider, CHAT_SYSTEM, redacted);
    }

    try {
      const vtData = await virusTotalLookup(ips[0]);
      const payload = JSON.stringify(vtData, null, 2);
      return await callAi(aiProvider, VT_SYSTEM, payload);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'VirusTotal or AI error';
      return `ไม่สามารถตรวจสอบ IP ได้: ${errMsg}`;
    }
  }

  return await callAi(aiProvider, CHAT_SYSTEM, redacted);
}
