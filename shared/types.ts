// Game Types & Interfaces

export interface Player {
  id: string;
  nickname: string;
  isReady: boolean;
}

export interface GameSettings {
  playerCount: number;
  timerEnabled: boolean;
  timerSeconds: number; // 60-300
}

export interface GameState {
  lobbyCode: string;
  players: Player[];
  currentRound: number;
  gameStarted: boolean;
  gameEnded: boolean;
  settings: GameSettings;
}

export interface TextEntry {
  lineNumber: number;
  text: string;
  author: string;
  timestamp: number;
}

export interface GameArchive {
  id: string;
  lobbyCode: string;
  date: string; // ISO timestamp
  players: string[];
  rounds: TextEntry[][];
  finalTexts: string[];
}

export interface SocketEvents {
  // Client -> Server
  'join-lobby': (code: string, nickname: string) => void;
  'create-lobby': (settings: GameSettings, nickname: string) => void;
  'ready-check': (playerId: string) => void;
  'submit-text': (playerId: string, text: string) => void;
  'start-game': () => void;
  'next-round': () => void;
  'end-game': () => void;
  'play-again': () => void;

  // Server -> Client
  'lobby-joined': (state: GameState) => void;
  'lobby-created': (code: string, state: GameState) => void;
  'state-update': (state: GameState) => void;
  'round-started': (roundNumber: number) => void;
  'text-received': (visibleText: string, previousAuthor: string, senderId: string) => void;
  'ready-check-needed': () => void;
  'game-ended': (archive: GameArchive) => void;
  'error': (message: string) => void;
}

export interface GameRound {
  roundNumber: number;
  texts: TextEntry[];
  isActive: boolean;
}
