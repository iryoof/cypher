# 🚀 CYPHER Deployment Guide

## Quick Start für GitHub + Vercel + Render

### Schritt 1: GitHub Repository erstellen

```bash
# Repository initialisieren
cd C:\Users\david\Pictures\cypher\Cypher
git init
git add .
git commit -m "Initial commit: Cypher Game Setup"

# GitHub Repository erstellen unter github.com/david/cypher
# Dann:
git remote add origin https://github.com/DEIN_USERNAME/cypher.git
git branch -M main
git push -u origin main
```

### Schritt 2: Frontend auf Vercel deployen

1. Gehe zu https://vercel.com
2. Logge dich ein (oder melde dich an)
3. Klicke "New Project"
4. Wähle dein GitHub Repository "cypher"
5. Framework: **Vite**
6. Root Directory: **frontend**
7. Environment Variables:
   - `VITE_BACKEND_URL` = `https://cypher-backend.onrender.com`
8. Deploy!

**Fertig!** Frontend läuft auf: `https://cypher-XXXXX.vercel.app`

### Schritt 3: Backend auf Render deployen

1. Gehe zu https://render.com
2. Logge dich ein (oder melde dich an)
3. Klicke "New +" → "Web Service"
4. Wähle GitHub Repository "cypher"
5. **Settings:**
   - Name: `cypher-backend`
   - Environment: `Node`
   - Build Command: `npm install && npm run build --workspace=backend`
   - Start Command: `npm start --workspace=backend`
   - Region: `Frankfurt` (oder nächste)
   - Plan: `Free`
6. **Environment Variables:**
   - `NODE_ENV` = `production`
   - `FRONTEND_URL` = `https://cypher-XXXXX.vercel.app` (deine Vercel URL)
   - `PORT` = `3000`
7. Deploy!

**Fertig!** Backend läuft auf: `https://cypher-backend.onrender.com`

### Schritt 4: Frontend Environment vorbereiten

Erstelle `frontend/.env.production`:
```env
VITE_BACKEND_URL=https://cypher-backend.onrender.com
```

Erstelle `.env.example` für Backend:
```env
NODE_ENV=production
FRONTEND_URL=https://cypher-XXXXX.vercel.app
PORT=3000
```

### Schritt 5: GitHub Secrets setzen (Optional für Auto-Deploy)

In GitHub Repository Settings → Secrets and variables:
```
VERCEL_TOKEN = (von Vercel Account Settings)
VERCEL_ORG_ID = (von Vercel)
VERCEL_PROJECT_ID = (von Vercel Project)
RENDER_SERVICE_ID = (von Render Service)
RENDER_DEPLOY_KEY = (von Render Account)
```

### Schritt 6: Domain & Branding

**Vercel Custom Domain:**
1. Vercel Project → Settings → Domains
2. Füge `cypher.yourdomain.com` hinzu (optional)

**Render Custom Domain:**
1. Render Service → Settings → Custom Domain
2. Gleich wie Vercel

### Nach dem Deployment

✅ **Frontend**: https://cypher-XXXXX.vercel.app (Deine Spieler)
✅ **Backend**: https://cypher-backend.onrender.com (Echtzeit Server)
✅ **Archiv**: Speichert automatisch auf Backend

### Development & Updates

Nach jeder Änderung:
```bash
git add .
git commit -m "feat: description"
git push origin main
```

**Automatisch:**
- ✅ GitHub Actions testet Code
- ✅ Vercel deployed Frontend neu
- ✅ Render deployed Backend neu
- ✅ Spieler sehen Updates live!

### Troubleshooting

**WebSocket verbindet nicht?**
- Check: `FRONTEND_URL` im Backend .env
- Check: CORS Settings
- Render Logs: https://render.com/dashboard

**Vercel build fehlgeschlagen?**
- Vercel Logs überprüfen
- Local testen: `npm run build --workspace=frontend`

**Render service nicht erreichbar?**
- Free Plan: Service startet nach 15 Min inaktiv neu
- Solution: Premium Plan oder Uptime Monitor

## Mobile Spielen

Deine Freunde öffnen einfach:
```
https://cypher-XXXXX.vercel.app
```

Das wars! 🎉

---

## Keine Lust auf Setup?

Alternativ kannst du auch:
- **Replit.com** - Kostenlos, alles inklusive
- **Railway.app** - Einfach, Render-Alternative
- **Heroku** - (bezahlt, aber einfach)

**Empfehlung:** Vercel + Render (Free Tier, beste Performance)
