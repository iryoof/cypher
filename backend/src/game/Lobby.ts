import { v4 as uuidv4 } from 'uuid'
import { Player, GameSettings, TextEntry, GameArchive } from 'shared/types'

export class Lobby {
  private code: string
  private players: Map<string, Player> = new Map()
  private playerOrder: string[] = []
  private hostId: string
  private gameStarted: boolean = false
  private gameEnded: boolean = false
  private currentRound: number = 0
  private settings: GameSettings
  private sheets: Map<string, TextEntry[]> = new Map() // ownerId -> Texts
  private submissionsByRound: Map<number, Set<string>> = new Map()
  private archiveId: string = uuidv4()

  constructor(code: string, hostId: string, hostNickname: string, settings: GameSettings) {
    this.code = code
    this.settings = settings
    this.hostId = hostId

    // Add host as first player
    const host: Player = {
      id: hostId,
      nickname: hostNickname,
      isReady: false
    }
    this.players.set(hostId, host)
    this.playerOrder.push(hostId)
    this.sheets.set(hostId, [])
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
    this.playerOrder.push(playerId)
    if (!this.sheets.has(playerId)) {
      this.sheets.set(playerId, [])
    }
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId)
    this.playerOrder = this.playerOrder.filter(id => id !== playerId)
    this.sheets.delete(playerId)
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
    this.submissionsByRound.set(this.currentRound, new Set())
  }

  submitText(playerId: string, text: string): void {
    if (!this.gameStarted) {
      throw new Error('Game not started')
    }

    const sheetOwner = this.getAssignedSheetOwner(playerId, this.currentRound)
    const sheet = this.sheets.get(sheetOwner)
    if (!sheet) {
      throw new Error('Sheet not found')
    }

    const author = this.players.get(playerId)?.nickname || 'Unknown'
    const lines = this.currentRound === 1
      ? text.split('\n').map(line => line.trim()).filter(Boolean)
      : [text.trim()]

    if (this.currentRound === 1 && lines.length < 2) {
      throw new Error('Need two lines in first round')
    }

    lines.slice(0, this.currentRound === 1 ? 2 : 1).forEach(lineText => {
      const entry: TextEntry = {
        lineNumber: sheet.length + 1,
        text: lineText,
        author,
        timestamp: Date.now()
      }
      sheet.push(entry)
    })

    if (!this.submissionsByRound.has(this.currentRound)) {
      this.submissionsByRound.set(this.currentRound, new Set())
    }
    this.submissionsByRound.get(this.currentRound)!.add(playerId)
  }

  nextRound(): void {
    if (this.currentRound >= this.getMaxRounds()) {
      throw new Error('Max rounds reached')
    }
    this.currentRound++
    this.submissionsByRound.set(this.currentRound, new Set())
  }

  haveAllPlayersSubmitted(): boolean {
    const submissions = this.submissionsByRound.get(this.currentRound)
    if (!submissions) return false
    return submissions.size >= this.players.size
  }

  getAssignedSheetOwner(playerId: string, roundNumber: number): string {
    const order = this.playerOrder
    const index = order.indexOf(playerId)
    if (index === -1 || order.length === 0) {
      throw new Error('Player not in lobby')
    }
    const offset = (roundNumber - 1) % order.length
    const ownerIndex = (index + offset) % order.length
    return order[ownerIndex]
  }

  getPromptForPlayer(playerId: string): string {
    if (this.currentRound <= 1) return ''
    const sheetOwner = this.getAssignedSheetOwner(playerId, this.currentRound)
    const sheet = this.sheets.get(sheetOwner) || []
    if (!sheet.length) return ''
    return sheet[sheet.length - 1].text
  }

  endGame(): GameArchive {
    this.gameEnded = true

    const finalTexts: string[] = []
    const rounds: TextEntry[][] = []
    this.playerOrder.forEach(ownerId => {
      const sheet = this.sheets.get(ownerId) || []
      rounds.push(sheet)
      sheet.forEach(entry => {
        finalTexts.push(`${entry.author}: ${entry.text}`)
      })
    })

    const archive: GameArchive = {
      id: this.archiveId,
      lobbyCode: this.code,
      date: new Date().toISOString(),
      players: Array.from(this.players.values()).map(p => p.nickname),
      rounds,
      finalTexts
    }

    return archive
  }

  getState() {
    return {
      lobbyCode: this.code,
      players: Array.from(this.players.values()),
      hostId: this.hostId,
      currentRound: this.currentRound,
      maxRounds: this.getMaxRounds(),
      gameStarted: this.gameStarted,
      gameEnded: this.gameEnded,
      settings: this.settings
    }
  }

  getHostId(): string {
    return this.hostId
  }

  getPlayers(): Player[] {
    return Array.from(this.players.values())
  }

  getPlayerCount(): number {
    return this.players.size
  }

  getMaxRounds(): number {
    return this.players.size
  }

  isLobbyFull(): boolean {
    return this.players.size >= this.settings.playerCount
  }

  isEmpty(): boolean {
    return this.players.size === 0
  }
}
