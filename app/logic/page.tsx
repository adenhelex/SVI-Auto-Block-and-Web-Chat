'use client';

import Link from 'next/link';

export default function LogicPage() {
  return (
    <div className="app-wrap">
      <nav className="top-nav">
        <div className="top-nav-inner">
          <Link href="/" className="top-nav-link">
            SVI IP blocklist manager
          </Link>
          <Link href="/chat" className="top-nav-link">
            Chat
          </Link>
          <Link href="/logic" className="top-nav-link active">
            Logic
          </Link>
        </div>
      </nav>

      <main className="ip-page">
        <header className="ip-page-header">
          <h1>System logic overview</h1>
          <p className="ip-page-desc">
            High-level logic for the IP blocklist manager, CloudSEK integrations, and SecBot chat.
          </p>
        </header>

        <section className="ip-page-list-wrap" style={{ marginBottom: '1rem' }}>
          <h2 className="ip-page-list-title">1. IP blocklist manager (`/`)</h2>
          <ul className="ip-page-list" style={{ maxHeight: 'none' }}>
            <li className="ip-page-list-item">
              <div>
                <strong>Add IP</strong>
                <p className="ip-page-desc">
                  Sends <code>POST /api/ip/add</code> → proxies to ThreatFeed <code>POST /ip/add</code> with
                  JSON body <code>{'{ ip: \"1.2.3.4\" }'}</code>. The backend appends the IP to <code>ip.txt</code>
                  if it does not already exist.
                </p>
              </div>
            </li>
            <li className="ip-page-list-item">
              <div>
                <strong>List IPs</strong>
                <p className="ip-page-desc">
                  The UI calls <code>GET /api/ip/list</code> which proxies to ThreatFeed <code>GET /ip/file</code>.
                  This always reads the current <code>ip.txt</code> on the server (one IP per line).
                </p>
              </div>
            </li>
            <li className="ip-page-list-item">
              <div>
                <strong>Delete IP</strong>
                <p className="ip-page-desc">
                  Clicking “Remove” sends <code>DELETE /api/ip/delete?ip=...</code> which proxies to
                  <code>POST /ip/delete</code> with JSON body <code>{'{ ip: \"...\" }'}</code>.
                </p>
              </div>
            </li>
            <li className="ip-page-list-item">
              <div>
                <strong>Upload .txt</strong>
                <p className="ip-page-desc">
                  The uploaded file is parsed in the browser, IPv4 lines are validated and de-duplicated, then each IP
                  is sent via <code>POST /api/ip/add</code>. After processing, the UI reloads the list from the server.
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section className="ip-page-list-wrap" style={{ marginBottom: '1rem' }}>
          <h2 className="ip-page-list-title">2. CloudSEK integrations</h2>
          <ul className="ip-page-list" style={{ maxHeight: 'none' }}>
            <li className="ip-page-list-item">
              <div>
                <strong>Quick fetch</strong>
                <p className="ip-page-desc">
                  Button calls <code>POST /api/ip/refresh-cloudsek</code> → ThreatFeed <code>POST /ip/refresh-from-cloudsek</code>.
                  Backend polls CloudSEK TAXII for recent IPv4 IOCs (e.g. last 7 days), merges only new IPs into
                  <code>ip.txt</code> (no duplicates).
                </p>
              </div>
            </li>
            <li className="ip-page-list-item">
              <div>
                <strong>Fetch daily</strong>
                <p className="ip-page-desc">
                  Button calls <code>POST /api/ip/fetch-daily</code> → ThreatFeed <code>POST /fetch/daily</code>.
                  This runs <code>cloudsek_daily_fetch.py</code> on the ThreatFeed server, fetching yesterday&apos;s
                  IOCs (IPv4, IPv6, file hashes) and writing/merging into files like <code>ipv4.txt</code>, <code>ipv6.txt</code>,
                  <code>md5.txt</code>, <code>sha1.txt</code>, <code>sha256.txt</code>.
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section className="ip-page-list-wrap">
          <h2 className="ip-page-list-title">3. SecBot chat logic (`/chat`)</h2>
          <ul className="ip-page-list" style={{ maxHeight: 'none' }}>
            <li className="ip-page-list-item">
              <div>
                <strong>Guardrails</strong>
                <p className="ip-page-desc">
                  Incoming message is optionally passed through a redaction service (<code>GUARDRAILS_URL</code>).
                  If <code>GUARDRAILS_URL=off</code> or the service is unreachable/slow, the original message is used.
                </p>
              </div>
            </li>
            <li className="ip-page-list-item">
              <div>
                <strong>IP detection &amp; VirusTotal</strong>
                <p className="ip-page-desc">
                  If the (redacted) message contains an IP, the system calls VirusTotal
                  (<code>VIRUSTOTAL_API_KEY</code>) to fetch IP reputation and analysis data, then asks Gemini/Groq
                  (depending on selected model) to summarize and recommend whether to block.
                </p>
              </div>
            </li>
            <li className="ip-page-list-item">
              <div>
                <strong>“Block” intent from chat</strong>
                <p className="ip-page-desc">
                  If the user message contains the word “block” plus an IP (e.g. <code>block 1.2.3.4</code>), the
                  system calls ThreatFeed <code>/ip/add</code> via <code>appendIpToBlocklist</code>. If the IP is already
                  in the blocklist, the response tells the user it is already present.
                </p>
              </div>
            </li>
            <li className="ip-page-list-item">
              <div>
                <strong>“Block” after analysis (no IP in message)</strong>
                <p className="ip-page-desc">
                  When the user sends a short follow-up like “block”, “block it”, or “add to blocklist” **without** an
                  IP, the backend looks at the recent chat history and uses the last mentioned IP, then calls ThreatFeed
                  <code>/ip/add</code>. The chat UI shows an Undo button that uses <code>/api/ip/delete</code> to remove
                  the IP again.
                </p>
              </div>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}

