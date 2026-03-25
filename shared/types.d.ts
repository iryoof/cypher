export interface Player {
    id: string;
    nickname: string;
    isReady: boolean;
}
export interface GameSettings {
    playerCount: number;
    timerEnabled: boolean;
    timerSeconds: number;
}
export interface GameState {
    lobbyCode: string;
    players: Player[];
    hostId: string;
    currentRound: number;
    maxRounds: number;
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
    date: string;
    players: string[];
    rounds: TextEntry[][];
    finalTexts: string[];
}
export interface SocketEvents {
    'join-lobby': (code: string, nickname: string, playerId?: string) => void;
    'create-lobby': (settings: GameSettings, nickname: string, playerId?: string) => void;
    'ready-check': (playerId: string) => void;
    'submit-text': (text: string) => void;
    'submit-vote': (textIndex: number) => void;
    'skip-voting': () => void;
    'request-state': () => void;
    'leave-lobby': () => void;
    'close-lobby': () => void;
    'start-game': () => void;
    'next-round': () => void;
    'end-game': () => void;
    'play-again': () => void;
    'lobby-joined': (state: GameState) => void;
    'lobby-created': (code: string, state: GameState) => void;
    'state-update': (state: GameState) => void;
    'round-started': (roundNumber: number, promptText: string) => void;
    'round-complete': (roundNumber: number) => void;
    'round-archived': (archive: GameArchive) => void;
    'voting-started': (options: string[]) => void;
    'voting-complete': (archive: GameArchive, results: number[]) => void;
    'lobby-closed': () => void;
    'game-ended': (archive: GameArchive) => void;
    'error': (message: string) => void;
}
export interface GameRound {
    roundNumber: number;
    texts: TextEntry[];
    isActive: boolean;
}
