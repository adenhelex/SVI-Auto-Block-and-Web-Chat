# Deploy SOC SVI WebChat (same server as API)

This app runs alongside your Taxii/Threat Feed API on the **same server**. The web app calls the API at `http://127.0.0.1:8100` (or your API port).

## Prerequisites on server

- **Node.js 18+** (LTS recommended)
- Your **Taxii 2.x API** already running (e.g. on port 8100)

## 1. Clone / upload the project

```bash
# If using git
git clone <your-repo-url> soc-svi-webchat
cd soc-svi-webchat
```

Or upload the project folder to the server (e.g. `/opt/soc-svi-webchat`).

## 2. Environment variables

Create `.env.local` (or `.env.production`) on the server. Because the API is on the **same server**, point the URL to localhost:

```bash
# API on same server: use 127.0.0.1 and the port your Taxii server uses
THREATFEED_API_URL=http://127.0.0.1:8100
THREATFEED_USER=admin
THREATFEED_PASSWORD=admin123

# Required for chat
VIRUSTOTAL_API_KEY=your-actual-key
GEMINI_API_KEY=your-actual-key
GEMINI_MODEL=gemini-2.5-flash

# Optional: Guardrails (if you use it)
# GUARDRAILS_URL=http://172.236.141.236:8169/redact
```

Replace `8100` if your Taxii API runs on a different port.

## 3. Install and build

```bash
cd /path/to/soc-svi-webchat
npm ci
npm run build
```

## 4. Run in production

### Option A: Direct run (port 3000)

```bash
npm run start
```

The app will listen on **http://0.0.0.0:3000** (or set `PORT=3000` if needed). Keep this running (e.g. with `screen`, `tmux`, or a process manager).

### Option B: Standalone (smaller deploy)

After `npm run build`, use the standalone output:

```bash
# Copy static assets into standalone (required)
cp -r .next/static .next/standalone/.next/static
# If you have a public folder:
# cp -r public .next/standalone/public

cd .next/standalone
PORT=3000 node server.js
```

To use a different port: `PORT=3001 node server.js`

### Option C: PM2 (keep running after logout)

```bash
npm install -g pm2
cd /path/to/soc-svi-webchat
npm run build
pm2 start npm --name "soc-svi-webchat" -- start
pm2 save
pm2 startup   # enable start on boot (run the command it prints)
```

To use a specific port:

```bash
PORT=3001 pm2 start npm --name "soc-svi-webchat" -- start
```

### Option D: Systemd (start on boot)

Create `/etc/systemd/system/soc-svi-webchat.service`:

```ini
[Unit]
Description=SOC SVI WebChat
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/soc-svi-webchat
EnvironmentFile=/opt/soc-svi-webchat/.env.local
Environment=PORT=3000
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable soc-svi-webchat
sudo systemctl start soc-svi-webchat
sudo systemctl status soc-svi-webchat
```

Adjust `User` and `WorkingDirectory` to match your server. Use the path to `node` instead of `npm` if you prefer:

```ini
ExecStart=/usr/bin/node .next/standalone/server.js
```

## 5. Ports summary

| Service           | Default port | Notes                    |
|-------------------|-------------|---------------------------|
| Taxii 2.x API     | 8100        | Already on this server   |
| SOC SVI WebChat   | 3000        | Next.js app              |

If both run on the same server:

- Web app: **http://YOUR_SERVER_IP:3000**
- API: **http://YOUR_SERVER_IP:8100** (used by the web app server-side via `THREATFEED_API_URL=http://127.0.0.1:8100`)

## 6. Reverse proxy (optional)

To serve the app on port 80/443 (e.g. Nginx):

**Nginx** – serve Next.js on port 3000:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

The browser will talk to Nginx; Nginx forwards to the Next.js app. The app’s API routes call the Taxii API at `127.0.0.1:8100` on the server.

## 7. Quick checklist

- [ ] Node.js 18+ installed
- [ ] Taxii API running on same server (e.g. port 8100)
- [ ] `.env.local` (or `.env.production`) with `THREATFEED_API_URL=http://127.0.0.1:8100` and real keys
- [ ] `npm ci && npm run build`
- [ ] App running (npm start, PM2, or systemd)
- [ ] Firewall allows port 3000 (or 80/443 if using Nginx)
