'use client';

import '../globals.css';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Message = { id: string; role: 'user' | 'assistant'; content: string };

// Safari and some older browsers don't support crypto.randomUUID.
// Use a small fallback that still gives unique-enough IDs for React lists.
function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random
  return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const IP_REGEX = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

function getLastIpFromMessages(messages: { content: string }[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i].content.match(IP_REGEX);
    if (m && m.length) return m[m.length - 1];
  }
  return undefined;
}

function isBlockAddedReply(content: string): boolean {
  return (
    content.includes('added to blocklist') ||
    content.includes('เพิ่ม IP เข้า blocklist')
  );
}

const AI_PROVIDERS = [
  { key: 'gemini', name: 'Gemini' },
  { key: 'groq', name: 'Groq' },
  { key: 'gemini2.5', name: 'Gemini 2.5' },
] as const;

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiProvider, setAiProvider] = useState<string>('gemini');
  const [lastBlockedIp, setLastBlockedIp] = useState<string | null>(null);
  const [undoLoading, setUndoLoading] = useState(false);
  const [ipPanelOpen, setIpPanelOpen] = useState(false);
  const [ipList, setIpList] = useState<string[]>([]);
  const [ipListLoading, setIpListLoading] = useState(false);
  const [ipListError, setIpListError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchIpList = async () => {
    setIpListLoading(true);
    setIpListError(null);
    try {
      const res = await fetch('/api/ip/list', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setIpList(Array.isArray(data.ips) ? data.ips : []);
    } catch (e) {
      setIpListError(e instanceof Error ? e.message : 'Failed to load');
      setIpList([]);
    } finally {
      setIpListLoading(false);
    }
  };

  useEffect(() => {
    if (ipPanelOpen) fetchIpList();
  }, [ipPanelOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    setLastBlockedIp(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const userMsg: Message = {
      id: createId(),
      role: 'user',
      content: userMessage,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          aiProvider: aiProvider || 'gemini',
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      const responseBody =
        typeof data.responseBody === 'string'
          ? data.responseBody
          : JSON.stringify(data.responseBody ?? data);

      const assistantMsg: Message = {
        id: createId(),
        role: 'assistant',
        content: responseBody,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (isBlockAddedReply(responseBody)) {
        const ip = getLastIpFromMessages([...messages, userMsg]);
        if (ip) setLastBlockedIp(ip);
      }
    } catch (err) {
      const errMsg: Message = {
        id: createId(),
        role: 'assistant',
        content:
          'Sorry, an error occurred. ' +
          (err instanceof Error ? err.message : 'Please try again.'),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleUndoBlock = async () => {
    if (!lastBlockedIp || undoLoading) return;
    setUndoLoading(true);
    try {
      const res = await fetch(
        `/api/ip/delete?ip=${encodeURIComponent(lastBlockedIp)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Undo failed');
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: 'assistant',
          content: `Removed ${lastBlockedIp} from blocklist (undone).`,
        },
      ]);
      setLastBlockedIp(null);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: 'assistant',
          content: 'Undo failed: ' + (e instanceof Error ? e.message : 'Unknown error'),
        },
      ]);
    } finally {
      setUndoLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="app-wrap chat-gpt-wrap">
      <nav className="top-nav chat-gpt-nav">
        <div className="top-nav-inner">
          <Link href="/" className="top-nav-link">
            SVI IP blocklist manager
          </Link>
          <Link href="/chat" className="top-nav-link active">Chat</Link>
          <Link href="/logout" className="top-nav-link">Logout</Link>
          <div className="chat-gpt-model-wrap">
            <label htmlFor="ai-provider" className="chat-gpt-model-label">Model</label>
            <select
              id="ai-provider"
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
              disabled={loading}
              className="chat-gpt-select"
            >
              {AI_PROVIDERS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </nav>

      <div className="chat-gpt-body">
        {ipPanelOpen && (
          <aside className="chat-gpt-sidebar">
            <div className="chat-gpt-sidebar-header">
              <h2 className="chat-gpt-sidebar-title">IP blocklist</h2>
              <button
                type="button"
                className="chat-gpt-sidebar-close"
                onClick={() => setIpPanelOpen(false)}
                aria-label="Close IP list"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="chat-gpt-sidebar-actions">
              <button
                type="button"
                className="chat-gpt-sidebar-refresh"
                onClick={fetchIpList}
                disabled={ipListLoading}
              >
                {ipListLoading ? 'Loading…' : 'Refresh'}
              </button>
              <Link href="/" className="chat-gpt-sidebar-manage">Manage list</Link>
            </div>
            {ipListError && (
              <p className="chat-gpt-sidebar-error" role="alert">{ipListError}</p>
            )}
            <div className="chat-gpt-sidebar-list">
              {ipListLoading && ipList.length === 0 ? (
                <p className="chat-gpt-sidebar-empty">Loading…</p>
              ) : ipList.length === 0 ? (
                <p className="chat-gpt-sidebar-empty">No IPs in blocklist.</p>
              ) : (
                <ul className="chat-gpt-ip-ul">
                  {ipList.map((ip) => (
                    <li key={ip} className="chat-gpt-ip-li">
                      <code className="chat-gpt-ip-code">{ip}</code>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        )}
        <button
          type="button"
          className={`chat-gpt-ribbon ${ipPanelOpen ? 'open' : ''}`}
          onClick={() => setIpPanelOpen((o) => !o)}
          title={ipPanelOpen ? 'Hide IP list' : 'Show IP list'}
          aria-expanded={ipPanelOpen}
        >
          <span className="chat-gpt-ribbon-text">IP list</span>
          {ipList.length > 0 && <span className="chat-gpt-ribbon-badge">{ipList.length}</span>}
        </button>
      <div className="chat-gpt-main">
        <div className="chat-gpt-messages">
          {messages.length === 0 && (
            <div className="chat-gpt-welcome">
              <h1 className="chat-gpt-welcome-title">SecBot</h1>
              <p className="chat-gpt-welcome-sub">Cybersecurity assistant · IP lookup &amp; blocklist</p>
              <div className="chat-gpt-suggestions">
                <button type="button" className="chat-gpt-suggestion" onClick={() => setInput('Check IP 1.2.3.4')}>
                  Check IP 1.2.3.4
                </button>
                <button type="button" className="chat-gpt-suggestion" onClick={() => setInput('What is phishing?')}>
                  What is phishing?
                </button>
                <button type="button" className="chat-gpt-suggestion" onClick={() => setInput('How do I block an IP?')}>
                  How do I block an IP?
                </button>
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`chat-gpt-msg ${m.role === 'user' ? 'user' : 'assistant'}`}
            >
              {m.role === 'assistant' && (
                <div className="chat-gpt-avatar assistant">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z"/><path d="M12 6v6l4 2"/></svg>
                </div>
              )}
              <div className="chat-gpt-msg-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
              </div>
              {m.role === 'user' && (
                <div className="chat-gpt-avatar user">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="chat-gpt-msg assistant">
              <div className="chat-gpt-avatar assistant">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z"/><path d="M12 6v6l4 2"/></svg>
              </div>
              <div className="chat-gpt-msg-content chat-gpt-typing">
                <span className="chat-gpt-dot" /><span className="chat-gpt-dot" /><span className="chat-gpt-dot" />
              </div>
            </div>
          )}
          {lastBlockedIp && (
            <div className="chat-gpt-undo-wrap">
              <button
                type="button"
                onClick={handleUndoBlock}
                disabled={undoLoading}
                className="chat-gpt-undo-btn"
              >
                {undoLoading ? 'Undoing…' : `Undo block (remove ${lastBlockedIp})`}
              </button>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-gpt-input-wrap">
          <form onSubmit={handleSubmit} className="chat-gpt-form">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message SecBot…"
              disabled={loading}
              rows={1}
              className="chat-gpt-input"
              aria-label="Message"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="chat-gpt-send"
              aria-label="Send"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9 22 2z"/></svg>
            </button>
          </form>
          <p className="chat-gpt-disclaimer">SecBot can make mistakes. Check IPs and blocklist changes.</p>
        </div>
      </div>
      </div>
    </div>
  );
}
