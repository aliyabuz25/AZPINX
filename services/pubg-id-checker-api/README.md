# 🎯 PUBG ID Checker API

A high-performance internal API service designed to fetch PUBG Mobile player names using their Player IDs. Built with Node.js and Puppeteer (Extreme Performance Mode), optimized for Docker and Traefik stacks.

## ✨ Features
- **Fast Query:** Optimized browser engine for rapid data retrieval.
- **Web UI:** Minimalist, user-friendly web interface for manual checks.
- **Docker & Traefik Ready:** Pre-configured for reverse proxy environments.
- **Performance:** Headless Chromium with resource interception to save bandwidth.

## 🛠 Docker Stack & Traefik Deployment
To deploy this as part of your existing Traefik stack:

1. Ensure you have an external network named `web-stack` (or update `docker-compose.yml` to match yours).
2. Configure your domain in the `Host` rule labels.

```bash
# Build and deploy
docker-compose up -d --build
```

### Traefik Labels (Included)
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.pubapi.rule=Host(`pubg.octotech.az`)"
  - "traefik.http.routers.pubapi.entrypoints=web"
  - "traefik.http.services.pubapi.loadbalancer.server.port=3000"
```

## 🚀 Manual VPS Start
If you are NOT using Docker:
```bash
# Install dependencies
npm install

# Install Chromium for Puppeteer
npx puppeteer browsers install chrome

# Start with PM2 or Node
PORT=3000 npm start
```

## 🤝 Credits
- **API Coded by:** [Octotech.az](https://octotech.az)
- **Developer:** Ali Yabuz
- **Service Hosting:** Ali Valizada
- **Infrastructure:** Traefik Proxy Stack

---
*Disclaimer: This tool is for educational purposes and internal use only.*
