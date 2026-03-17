import { v4 as uuidv4 } from 'uuid'
import { Player, GameSettings, TextEntry, GameArchive } from 'shared/types'

export class Lobby {
  private code: string
  private players: Map<string, Player> = new Map()
  private gameStarted: boolean = false
  private gameEnded: boolean = false
  private currentRound: number = 0
  private settings: GameSettings
  private texts: Map<number, TextEntry[]> = new Map() // Round -> Texts
  private archiveId: string = uuidv4()

  constructor(code: string, hostId: string, hostNickname: string, settings: GameSettings) {
    this.code = code
    this.settings = settings

    // Add host as first player
    const host: Player = {
      id: hostId,
      nickname: hostNickname,
      isReady: false
    }
    this.players.set(hostId, host)
  }

  // Public Methods
  getCode(): string {
    return this.code
  }

  getId(): string {
    return this.archiveId
  }

  addPlayer(playerId: string, nickname: string): void {
    if (this.players.size >= this.settings.playerCount) {
      throw new Error('Lobby is full')
    }
    if (this.gameStarted) {
      throw new Error('Game already started')
    }

    const player: Player = {
      id: playerId,
      nickname,
      isReady: false
    }
    this.players.set(playerId, player)
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId)
  }

  setPlayerReady(playerId: string): void {
    const player = this.players.get(playerId)
    if (player) {
      player.isReady = !player.isReady // Toggle ready status
    }
  }

  getAllPlayersReady(): boolean {
    if (this.players.size === 0) return false
    return Array.from(this.players.values()).every(p => p.isReady)
  }

  resetReadyStatus(): void {
    this.players.forEach(player => {
      player.isReady = false
    })
  }

  startGame(): void {
    if (this.players.size < 3) {
      throw new Error('Need at least 3 players')
    }
    this.gameStarted = true
    this.currentRound = 1
  }

  submitText(playerId: string, text: string): void {
    if (!this.gameStarted) {
      throw new Error('Game not started')
    }

    const entry: TextEntry = {
      lineNumber: this.currentRound,
      text,
      author: this.players.get(playerId)?.nickname || 'Unknown',
      timestamp: Date.now()
    }

    if (!this.texts.has(this.currentRound)) {
      this.texts.set(this.currentRound, [])
    }
    this.texts.get(this.currentRound)!.push(entry)
  }

  nextRound(): void {
    this.currentRound++
  }

  endGame(): GameArchive {
    this.gameEnded = true

    const finalTexts: string[] = []
    this.texts.forEach((entries) => {
      entries.forEach(entry => {
        finalTexts.push(`${entry.author}: ${entry.text}`)
      })
    })

    const archive: GameArchive = {
      id: this.archiveId,
      lobbyCode: this.code,
      date: new Date().toISOString(),
      players: Array.from(this.players.values()).map(p => p.nickname),
      rounds: Array.from(this.texts.values()),
      finalTexts
    }

    return archive
  }

  getState() {
    return {
      lobbyCode: this.code,
      players: Array.from(this.players.values()),
      currentRound: this.currentRound,
      gameStarted: this.gameStarted,
      gameEnded: this.gameEnded,
      settings: this.settings
    }
  }

  getPlayers(): Player[] {
    return Array.from(this.players.values())
  }

  getPlayerCount(): number {
    return this.players.size
  }

  isLobbyFull(): boolean {
    return this.players.size >= this.settings.playerCount
  }

  isEmpty(): boolean {
    return this.players.size === 0
  }
}
