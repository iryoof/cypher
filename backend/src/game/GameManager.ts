import { Lobby } from './Lobby'
import { GameSettings, GameArchive } from 'shared/types'
import { generateLobbyCode } from '../utils/codeGenerator'

export class GameManager {
  private lobbies: Map<string, Lobby> = new Map()
  private playerLobbies: Map<string, string> = new Map() // playerId -> lobbyCode
  private archives: GameArchive[] = []
  private totalGamesPlayed: number = 0

  createLobby(hostId: string, hostNickname: string, settings: GameSettings): Lobby {
    const code = generateLobbyCode()
    
    // Make sure code is unique
    while (this.lobbies.has(code)) {
      this.generateLobbyCode()
    }

    const lobby = new Lobby(code, hostId, hostNickname, settings)
    this.lobbies.set(code, lobby)
    this.playerLobbies.set(hostId, code)

    console.log(`✨ Lobby created: ${code}`)
    return lobby
  }

  joinLobby(playerId: string, code: string, nickname: string): Lobby {
    const lobby = this.lobbies.get(code.toUpperCase())
    if (!lobby) {
      throw new Error(`Lobby ${code} not found`)
    }

    if (lobby.isLobbyFull()) {
      throw new Error('Lobby is full')
    }

    lobby.addPlayer(playerId, nickname)
    this.playerLobbies.set(playerId, code.toUpperCase())

    console.log(`📍 Player ${nickname} joined lobby ${code}`)
    return lobby
  }

  findLobbyByPlayerId(playerId: string): Lobby | null {
    const code = this.playerLobbies.get(playerId)
    if (!code) return null
    return this.lobbies.get(code) || null
  }

  removeLobby(code: string): void {
    const lobby = this.lobbies.get(code)
    if (lobby) {
      lobby.getPlayers().forEach(player => {
        this.playerLobbies.delete(player.id)
      })
      this.lobbies.delete(code)
    }
  }

  removePlayer(playerId: string): void {
    const code = this.playerLobbies.get(playerId)
    if (code) {
      const lobby = this.lobbies.get(code)
      if (lobby) {
        lobby.removePlayer(playerId)
        
        // Remove empty lobbies
        if (lobby.isEmpty()) {
          this.removeLobby(code)
        }
      }
    }
    this.playerLobbies.delete(playerId)
  }

  archiveGame(lobbyCode: string): GameArchive | null {
    const lobby = this.lobbies.get(lobbyCode)
    if (!lobby) return null

    const archive = lobby.endGame()
    this.archives.push(archive)
    this.totalGamesPlayed++

    this.removeLobby(lobbyCode)
    return archive
  }

  storeArchive(archive: GameArchive, lobbyCode: string): void {
    this.archives.push(archive)
    this.totalGamesPlayed++
    this.removeLobby(lobbyCode)
  }

  getArchives(): GameArchive[] {
    return this.archives
  }

  getActiveLobbyCount(): number {
    return this.lobbies.size
  }

  getTotalGamesPlayed(): number {
    return this.totalGamesPlayed
  }

  private generateLobbyCode(): string {
    // Helper to generate new codes
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }
}
