# Cypher auf GitHub veröffentlichen

## 🎯 Ziel: Auf github.com/DEIN_USERNAME/cypher

### Step 1️⃣: Git initialisieren & ersten Commit

```bash
cd C:\Users\david\Pictures\cypher\Cypher

# Initialisieren
git init
git add .
git commit -m "🎤 Initial commit: Cypher Reimspiel - Full Stack Setup"
```

### Step 2️⃣: GitHub Repository erstellen

1. Gehe zu https://github.com/new
2. **Repository name**: `cypher` (klein, keine Leerzeichen)
3. **Description**: "🎤 Digitales Reimspiel - Collaborative rap lyrics game"
4. **Public** (damit es jeder spielen kann!)
5. ✅ "Create repository"

### Step 3️⃣: Mit GitHub verbinden

Nach dem Erstellen auf GitHub siehst du Befehle:

```bash
git remote add origin https://github.com/iryoof/cypher.git
git branch -M main
git push -u origin main
```

**ACHTUNG:** Ersetze `DEIN_USERNAME` mit deinem echten GitHub Username!

```bash
# Beispiel:
git remote add origin https://github.com/david123/cypher.git
git branch -M main
git push -u origin main
```

### Step 4️⃣: Überprüfen

Gehe zu https://github.com/DEIN_USERNAME/cypher

Du solltest sehen:
- ✅ Alle deine Files
- ✅ README.md mit Projekt-Info
- ✅ Source Code

### Jetzt: Deployment Setup

Siehe [DEPLOYMENT.md](./DEPLOYMENT.md) für komplette Anleitung:
1. Frontend auf **Vercel** deployen
2. Backend auf **Render** deployen
3. Automatisches Deployment mit GitHub Actions

### Weitere Updates pushen

Nach Änderungen:
```bash
git add .
git commit -m "feat: description der änderung"
git push
```

✅ Vercel & Render deployen automatisch neu!

---

**Fragen?** Siehe [README.md](./README.md) oder [copilot-instructions.md](./.github/copilot-instructions.md)
