# 🎤 CYPHER - Digitales Reimspiel

Ein modernes, mobiles Multiplayer-Spiel zum gemeinsamen Schreiben von Rap-Lyrics in Echtzeit.

## 🎮 Spielkonzept

Jeder Spieler schreibt 2 Zeilen mit Reim. Die erste Zeile wird verborgen - nur die zweite ist sichtbar. Der nächste Spieler reimt darauf und schreibt eine Zeile. So entsteht eine gemeinsame Lyrik-Kette mit verstecktem Kontext.

**Features:**
- ✅ 3-6 Spieler pro Spiel
- ✅ Lobby-Codes für einfaches Beitreten
- ✅ Optional: Timer (60-300 Sekunden pro Runde)
- ✅ Dark Mode Design (modern & schick)
- ✅ Automatische Archivierung mit Datum
- ✅ Ready-Check vor jeder Runde
- ✅ Mobile-first (100% Handy-kompatibel)
- ✅ Echtzeit-Sync über WebSockets

## 🚀 Live spielen

**Online:** https://cypher.vercel.app (kommt bald!)

## 🏗️ Projektstruktur

```
cypher/
├── frontend/          # React + Vite + TypeScript
├── backend/           # Express.js + WebSockets
├── shared/            # Geteilte Typen & Utilities
└── .github/           # GitHub Konfiguration
```

## 🎯 Schnellstart

### 0. Voraussetzungen
- Node.js >= 18
- npm >= 9

### 1. Abhängigkeiten installieren
```bash
npm install
```

### 2. Development Server starten
```bash
npm run dev
```
Frontend läuft auf: `http://localhost:5173`
Backend läuft auf: `http://localhost:3000`

### 3. Produktion bauen
```bash
npm run build
```

## 📱 Features im Detail

### Lobby-System
- Eindeutige Lobby-Codes (z.B. `ABC123`)
- Spieler können joinen bevor das Spiel startet
- Maximale Spielerzahl: 6

### Spielmechanik
1. **Setup**: Spielerzahl wählen (3-6)
2. **Round Preparation**: Alle Spieler schreiben gleichzeitig
3. **Timer** (Optional): 60-300 Sekunden pro Aktion
4. **Ready Check**: Alle müssen "Bereit" klicken
5. **Reveal & Archive**: Am Ende werden alle Texte mit Datum gespeichert

### Archivierung
- Texte werden lokal oder im Backend mit Timestamp gespeichert
- Format: `cypher_[YYYY-MM-DD_HH-MM-SS].json`

## 🎨 Design

- **Farben**: Schwarz + Dunkel (True Dark Mode)
- **Design Philosophy**: Minimal, Modern, Gaming-vibes
- **Responsive**: Vollständig mobil-optimiert

## 📚 Tech Stack

### Frontend
- **React 18**
- **Vite** (Ultra-schnell Build)
- **TypeScript**
- **Tailwind CSS** (Styling)
- **Socket.io Client** (Real-time)

### Backend
- **Express.js**
- **Socket.io** (WebSocket Server)
- **TypeScript**
- **Node.js**

## 🌍 Deployment

Siehe [DEPLOYMENT.md](./DEPLOYMENT.md) für vollständige Anleitung:
- **Frontend**: Vercel
- **Backend**: Render
- **CI/CD**: GitHub Actions

Siehe [GITHUB.md](./GITHUB.md) für GitHub Repository Setup.

## 🔧 GitHub Setup

- Repository: `github.com/[user]/cypher`
- Siehe [GITHUB.md](./GITHUB.md) für Setup

## 📝 Development Workflow

```bash
# Feature Development
git checkout -b feature/neue-feature
# ... Änderungen ...
git push origin feature/neue-feature

# PR erstellen, Review, Merge
```

## 🐛 Development Befehle

```bash
# Alle Features
npm run dev              # Frontend + Backend starten
npm run dev:frontend     # Nur Frontend
npm run dev:backend      # Nur Backend

npm run build            # Produktion bauen
npm run build:frontend   # Nur Frontend
npm run build:backend    # Nur Backend

npm run type-check       # TypeScript überprüfen
npm run start            # Backend starten
```

## 🐛 Bekannte Probleme / TODO

- [ ] Persistente Archivierung (Datenbank Integration)
- [ ] User Authentifizierung
- [ ] Mobile App (PWA)
- [ ] Sound Effects
- [ ] Persönliche Statistiken

## 📄 Lizenz

MIT License - Frei verwendbar

---

**Viel Spaß beim Spielen! 🎤✨**

