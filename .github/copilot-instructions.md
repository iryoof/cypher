# CYPHER Project - Development Instructions

## Project Overview
Full-stack Multiplayer Reimspiel (Rap Lyrics Game) - React Frontend + Express Backend with WebSockets.

## Tech Stack
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: Express.js + Socket.io + TypeScript
- **Shared**: TypeScript Types & Utilities

## Development Setup

### Environment
1. Node.js >= 18, npm >= 9
2. TypeScript globally installed recommended

### Installation & Running
```bash
# Install all dependencies
npm install

# Start dev servers (frontend + backend)
npm run dev

# Build for production
npm run build
```

## Project Structure Guidelines

```
cypher/
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # API/Socket services
│   │   ├── styles/         # CSS/Tailwind
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── server.ts       # Express app setup
│   │   ├── io.ts           # Socket.io handlers
│   │   ├── game/           # Game logic
│   │   │   ├── GameManager.ts
│   │   │   ├── Lobby.ts
│   │   │   └── Archive.ts
│   │   ├── types/          # TypeScript types
│   │   └── utils/
│   ├── tsconfig.json
│   └── package.json
├── shared/
│   └── types.ts            # Shared type definitions
└── .github/
    └── copilot-instructions.md
```

## Key Features to Implement

### Phase 1: Core Gameplay
- [ ] Lobby creation & joining with codes
- [ ] Player management (3-6 players)
- [ ] Game state synchronization
- [ ] Text submission & hiding
- [ ] Ready check system

### Phase 2: Game Mechanics
- [ ] Timer system (60-300s, optional)
- [ ] Round management
- [ ] Text visibility (hide first line, show second)
- [ ] Round progression

### Phase 3: Polish & Archive
- [ ] Dark mode design (black + modern)
- [ ] Mobile optimization
- [ ] Game archive with timestamps
- [ ] Play again / Return to menu

### Phase 4: Deployment
- [ ] GitHub repository setup
- [ ] Vercel/Render deployment
- [ ] Production env vars

## Frontend Development

### Component Structure
- `LobbyScreen`: Join/Create lobby
- `GameSetup`: Player count & settings
- `GameScreen`: Main game interface
- `TextInput`: Player text submission
- `ReadyCheck`: Player ready status
- `Archive`: View past games

### Styling
- Tailwind CSS for utility classes
- Dark mode: Black backgrounds, light text
- Mobile-first responsive design
- No external UI libraries (keep it lean)

## Backend Development

### Game Logic
- **Lobby**: 4-char alphanumeric codes
- **GameManager**: State management
- **Archive**: JSON storage with date
- **Validation**: Input sanitization

### WebSocket Events
See `shared/types.ts` for complete event definitions.

Key flows:
1. Create/Join Lobby → GameState update
2. Start Game → Round 1 begins
3. Player submits text → Next player gets text 2
4. Ready check → All players must confirm
5. Game ends → Archive created

## Coding Standards

### TypeScript
- Strict mode enabled
- Interface for all object shapes
- No `any` types unless justified

### Naming
- Components: PascalCase (MyComponent.tsx)
- Functions/Variables: camelCase
- Constants: UPPER_SNAKE_CASE
- Event handlers: onActionName

### Best Practices
- Keep components small & focused
- Use custom hooks for logic
- Separate concerns (UI / Logic / API)
- Error handling on all async operations
- Clean up Socket listeners

## Deployment Checklist

- [ ] Environment variables set up
- [ ] GitHub repo public
- [ ] Frontend deployed to Vercel
- [ ] Backend deployed to Render/Railway
- [ ] WebSocket connection working
- [ ] Archive storage configured
- [ ] Mobile tested on device

## Testing

Manual testing checklist:
- [ ] Create lobby works
- [ ] Join lobby with code works
- [ ] Timer counts down correctly
- [ ] Text visibility rules correct
- [ ] Archive saves with timestamp
- [ ] Mobile responsive on 3+ devices
- [ ] Dark mode works
- [ ] Reconnection handling

## Common Issues & Solutions

### WebSocket connection fails
- Check CORS settings in backend
- Verify Socket.io versions match
- Check firewall/proxy settings

### Text not syncing
- Ensure ready-check completed
- Verify all players submitted text
- Check game state consistency

### Timer not working
- Verify timer enabled in settings
- Check client/server time sync
- Test on different devices

## Notes
- Keep game logic deterministic
- Archive format: JSON with ISO timestamp
- No external databases required initially
