# SOC SVI WebChat

Chat-style web app with **all logic embedded** (no n8n):

- **Chat**: Send a message (e.g. an IP or a question). Flow: Guardrails (redact) → if message contains an IP: VirusTotal lookup → Gemini/Groq/OpenRouter for block recommendation; if message contains “block” + IP: append that IP to `ip.txt`. Otherwise: free-text SecBot (Cybersecurity Q&A in Thai).
- **IP lists**: Use “Manage IP lists” to view **ip.txt** (blocklist; add/remove IPs) and **ipv4.txt** (feed from Taxii 2.x / CloudSEK; refresh from API).

## Setup

1. Copy env example and set variables:

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with at least:

   - `GUARDRAILS_URL` – Redact service (e.g. `http://172.236.141.236:8169/redact`).
   - `VIRUSTOTAL_API_KEY` – For IP lookups.
   - `THREATFEED_API_URL`, `THREATFEED_USER`, `THREATFEED_PASSWORD` – For ip.txt and ipv4.txt (e.g. `http://172.104.185.43:8100`). Used for list/add/delete and “block” from chat.
   - For **Gemini**: `GEMINI_API_KEY` (optional: `GEMINI_MODEL`, default `gemini-2.5-flash`).
   - For **Groq**: `GROQ_API_KEY` (optional: `GROQ_MODEL`, default `llama-3.1-70b-versatile`).
   - For **Gemini 2.5 Pro** (aiProvider=gemini2.5): `OPENROUTER_API_KEY` (optional: `OPENROUTER_GEMINI_MODEL=google/gemini-2.5-pro`).

2. Install and run:

   ```bash
   npm install
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Embedded flow

- User message → **Guardrails** (POST to redact service) → **Router**:
  - If response is “MESSAGE BLOCKED” → return that.
  - If text contains an IP:
    - If text contains “block” → append first IP to ip.txt via Threat Feed API → return API message.
    - Else → **VirusTotal** (GET IP) → **AI** (Gemini/Groq/OpenRouter by selection) with VT JSON → return recommendation (Thai).
  - Else → **AI** (SecBot) with redacted message → return answer (Thai).
