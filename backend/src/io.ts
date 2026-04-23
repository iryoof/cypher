import { Server as SocketIOServer, Socket } from 'socket.io'
import { GameManager } from './game/GameManager'
import { Lobby } from './game/Lobby'

// Window within which a disconnected player may reconnect before being
// evicted. 60s per product spec.
const RECONNECT_GRACE_MS = 60_000

// Map of playerId -> pending eviction timer. Stored at module scope so all
// sockets (reconnects) can find & cancel a timer that belongs to a prior
// session of the same player.
const evictionTimers = new Map<string, NodeJS.Timeout>()

function cancelEviction(playerId: string) {
  const timer = evictionTimers.get(playerId)
  if (timer) {
    clearTimeout(timer)
    evictionTimers.delete(playerId)
  }
}

function scheduleEviction(
  io: SocketIOServer,
  gameManager: GameManager,
  lobby: Lobby,
  playerId: string
) {
  cancelEviction(playerId)
  const code = lobby.getCode()
  const timer = setTimeout(() => {
    evictionTimers.delete(playerId)
    const current = gameManager.findLobbyByPlayerId(playerId)
    if (!current || current.getCode() !== code) return
    if (!current.isDisconnected(playerId)) return
    // removePlayer migrates host internally if the evicted player was host.
    gameManager.removePlayer(playerId)
    const remaining = gameManager.findLobbyByCode(code)
    if (!remaining) return
    io.to(code).emit('state-update', remaining.getState())
    console.log(`Evicted ${playerId} from ${code} after reconnect grace period`)
  }, RECONNECT_GRACE_MS)
  evictionTimers.set(playerId, timer)
}

export function setupSocketHandlers(io: SocketIOServer, gameManager: GameManager) {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`)
    socket.join(socket.id)

    // Join Lobby
    socket.on('join-lobby', (code: string, nickname: string, playerId?: string) => {
      try {
        const clientId = playerId || socket.id
        socket.data.playerId = clientId
        socket.join(clientId)
        const lobby = gameManager.joinLobby(clientId, code, nickname)
        socket.join(lobby.getCode())
        // If the player was in the reconnect grace window, cancel their pending
        // eviction and clear the disconnect marker so other clients stop
        // showing them as "getrennt".
        cancelEviction(clientId)
        lobby.markReconnected(clientId)
        socket.emit('lobby-joined', lobby.getState())
        io.to(lobby.getCode()).emit('state-update', lobby.getState())
        console.log(`${nickname} joined lobby ${code}`)
      } catch (error: any) {
        socket.emit('error', error.message)
      }
    })

    // Create Lobby
    socket.on('create-lobby', (settings: any, nickname: string, playerId?: string) => {
      try {
        const clientId = playerId || socket.id
        socket.data.playerId = clientId
        socket.join(clientId)
        const lobby = gameManager.createLobby(clientId, nickname, settings)
        const code = lobby.getCode()
        socket.join(code)
        socket.emit('lobby-created', code, lobby.getState())
        console.log(`New lobby created: ${code}`)
      } catch (error: any) {
        socket.emit('error', error.message)
      }
    })

    // Request current state (for late joiners / page transitions)
    socket.on('request-state', () => {
      try {
        const playerId = socket.data.playerId || socket.id
        const lobby = gameManager.findLobbyByPlayerId(playerId)
        if (!lobby) throw new Error('Lobby not found')

        const state = lobby.getState()
        socket.emit('state-update', state)
        if (state.votingActive) {
          socket.emit('voting-started', lobby.getPendingArchive()?.finalTexts || [])
        } else if (state.roundComplete) {
          socket.emit('round-complete', state.currentRound)
        } else if (state.gameStarted && !state.gameEnded && !lobby.hasPlayerSubmitted(playerId)) {
          const prompt = lobby.getPromptForPlayer(playerId)
          socket.emit('round-started', state.currentRound, prompt)
        }
      } catch (error: any) {
        socket.emit('error', error.message)
      }
    })

    // Submit Text
    socket.on('submit-text', (text: string) => {
      try {
        const playerId = socket.data.playerId || socket.id
        const lobby = gameManager.findLobbyByPlayerId(playerId)
        if (!lobby) throw new Error('Lobby not found')

        lobby.submitText(playerId, text)
        io.to(lobby.getCode()).emit('state-update', lobby.getState())

        if (lobby.haveAllPlayersSubmitted()) {
          const snapshot = lobby.buildArchiveSnapshot()
          io.to(lobby.getCode()).emit('round-archived', snapshot)
          gameManager.saveArchiveSnapshot(snapshot)
          io.to(lobby.getCode()).emit('round-complete', lobby.getState().currentRound)
        }
      } catch (error: any) {
        socket.emit('error', error.message)
      }
    })

    // Leave Lobby. Hosts are allowed to leave too — host role is transferred
    // to the next player in order. If the host is the last player, the lobby
    // is removed. `close-lobby` remains the explicit "shut everything down"
    // action.
    socket.on('leave-lobby', () => {
      try {
        const playerId = socket.data.playerId || socket.id
        const lobby = gameManager.findLobbyByPlayerId(playerId)
        if (!lobby) throw new Error('Lobby not found')

        const code = lobby.getCode()
        const wasLastPlayer = lobby.getPlayerCount() <= 1

        cancelEviction(playerId)
        // removePlayer migrates host internally if the leaving player was host.
        gameManager.removePlayer(playerId)
        socket.leave(code)
        socket.leave(playerId)

        if (wasLastPlayer) {
          // Lobby was removed by removePlayer because it became empty; nothing
          // else to broadcast.
          return
        }

        const remaining = gameManager.findLobbyByCode(code)
        if (!remaining) return
        io.to(code).emit('state-update', remaining.getState())
      } catch (error: any) {
        socket.emit('error', error.message)
      }
    })

    // Close Lobby (host)
    socket.on('close-lobby', () => {
      try {
        const playerId = socket.data.playerId || socket.id
        const lobby = gameManager.findLobbyByPlayerId(playerId)
        if (!lobby) throw new Error('Lobby not found')
        if (lobby.getHostId() !== playerId) {
          throw new Error('Nur der Host kann die Lobby schließen')
        }

        const code = lobby.getCode()
        io.to(code).emit('lobby-closed')
        lobby.getPlayers().forEach(p => cancelEviction(p.id))
        gameManager.removeLobby(code)
      } catch (error: any) {
        socket.emit('error', error.message)
      }
    })

    // Kick a specific player (host only).
    socket.on('kick-player', (targetId: string) => {
      try {
        const playerId = socket.data.playerId || socket.id
        const lobby = gameManager.findLobbyByPlayerId(playerId)
        if (!lobby) throw new Error('Lobby not found')
        if (lobby.getHostId() !== playerId) {
          throw new Error('Nur der Host kann Spieler entfernen')
        }
        if (!targetId || targetId === playerId) {
          throw new Error('Ungültiger Spieler')
        }
        if (!lobby.hasPlayer(targetId)) {
          throw new Error('Spieler nicht in der Lobby')
        }

        const code = lobby.getCode()
        cancelEviction(targetId)
        io.to(targetId).emit('kicked', 'Du wurdest aus der Lobby entfernt.')
        gameManager.removePlayer(targetId)
        const remaining = gameManager.findLobbyByCode(code)
        if (remaining) {
          io.to(code).emit('state-update', remaining.getState())
        }
      } catch (error: any) {
        socket.emit('error', error.message)
      }
    })

    // Transfer host to another player (host only).
    socket.on('transfer-host', (newHostId: string) => {
      try {
        const playerId = socket.data.playerId || socket.id
        const lobby = gameManager.findLobbyByPlayerId(playerId)
        if (!lobby) throw new Error('Lobby not found')
        if (lobby.getHostId() !== playerId) {
          throw new Error('Nur der Host kann die Host-Rolle übertragen')
        }
        if (!newHostId || newHostId === playerId) {
          throw new Error('Ungültiger Spieler')
        }
        if (!lobby.hasPlayer(newHostId)) {
          throw new Error('Spieler nicht in der Lobby')
        }
        lobby.transferHost(newHostId)
        io.to(lobby.getCode()).emit('state-update', lobby.getState())
      } catch (error: any) {
        socket.emit('error', error.message)
      }
    })

    // Ready Check
    socket.on('ready-check', (playerId: string) => {
      try {
        const resolvedId = playerId || socket.data.playerId || socket.id
        const lobby = gameManager.findLobbyByPlayerId(resolvedId)
        if (!lobby) throw new Error('Lobby not found')

        lobby.setPlayerReady(resolvedId)
        const allReady = lobby.getAllPlayersReady()

        io.to(lobby.getCode()).emit('state-update', lobby.getState())

        if (allReady) {
          io.to(lobby.getCode()).emit('round-complete', lobby.getState().currentRound)
        }
      } catch (error: any) {
        socket.emit('error', error.message)
      }
    })

    // Start Game
    socket.on('start-game', () => {
      try {
        const playerId = socket.data.playerId || socket.id
        const lobby = gameManager.findLobbyByPlayerId(playerId)
        if (!lobby) throw new Error('Lobby not found')
        if (lobby.getHostId() !== playerId) {
          throw new Error('Nur der Host kann das Spiel starten')
        }

        lobby.startGame()
        io.to(lobby.getCode()).emit('state-update', lobby.getState())

        lobby.getPlayers().forEach(player => {
          const prompt = lobby.getPromptForPlayer(player.id)
          io.to(player.id).emit('round-started', lobby.getState().currentRound, prompt)
        })

        console.log(`Game started: ${lobby.getCode()}`)
      } catch (error: any) {
        socket.emit('error', error.message)
      }
    })

    // Next Round
    socket.on('next-round', () => {
      try {
        const playerId = socket.data.playerId || socket.id
        const lobby = gameManager.findLobbyByPlayerId(playerId)
        if (!lobby) throw new Error('Lobby not found')
        if (lobby.getHostId() !== playerId) {
          throw new Error('Nur der Host kann die naechste Runde starten')
        }

        lobby.nextRound()
        io.to(lobby.getCode()).emit('state-update', lobby.getState())
        lobby.getPlayers().forEach(player => {
          const prompt = lobby.getPromptForPlayer(player.id)
          io.to(player.id).emit('round-started', lobby.getState().currentRound, prompt)
        })
      } catch (error: any) {
        socket.emit('error', error.message)
      }
    })

    // End Game
    socket.on('end-game', () => {
      try {
        const playerId = socket.data.playerId || socket.id
        const lobby = gameManager.findLobbyByPlayerId(playerId)
        if (!lobby) throw new Error('Lobby not found')
        if (lobby.getHostId() !== playerId) {
          throw new Error('Nur der Host kann das Spiel beenden')
        }

        const options = lobby.startVoting()
        io.to(lobby.getCode()).emit('state-update', lobby.getState())
        io.to(lobby.getCode()).emit('voting-started', options)
      } catch (error: any) {
        socket.emit('error', error.message)
      }
    })

    // Submit Vote
    socket.on('submit-vote', (textIndex: number) => {
      try {
        const playerId = socket.data.playerId || socket.id
        const lobby = gameManager.findLobbyByPlayerId(playerId)
        if (!lobby) throw new Error('Lobby not found')

        lobby.submitVote(playerId, textIndex)
        io.to(lobby.getCode()).emit('state-update', lobby.getState())

        if (lobby.haveAllPlayersVoted()) {
          const results = lobby.getVotingResults()
          const archive = lobby.getPendingArchive()
          if (!archive) throw new Error('Archive failed')
          io.to(lobby.getCode()).emit('voting-complete', archive, results)
          gameManager.storeArchive(archive, lobby.getCode())
        }
      } catch (error: any) {
        socket.emit('error', error.message)
      }
    })

    // Skip Voting (host)
    socket.on('skip-voting', () => {
      try {
        const playerId = socket.data.playerId || socket.id
        const lobby = gameManager.findLobbyByPlayerId(playerId)
        if (!lobby) throw new Error('Lobby not found')
        if (lobby.getHostId() !== playerId) {
          throw new Error('Nur der Host kann das Voting überspringen')
        }

        const archive = lobby.getOrCreatePendingArchive()
        const results = lobby.getVotingResults()
        io.to(lobby.getCode()).emit('voting-complete', archive, results)
        gameManager.storeArchive(archive, lobby.getCode())
      } catch (error: any) {
        socket.emit('error', error.message)
      }
    })

    // Disconnect: start the reconnect grace window for the disconnecting
    // player. If they do not reconnect within RECONNECT_GRACE_MS they are
    // evicted (and host is transferred if needed).
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`)
      const playerId = socket.data.playerId
      if (!playerId) return
      const lobby = gameManager.findLobbyByPlayerId(playerId)
      if (!lobby) return
      // Only mark as disconnected if no other live socket exists for this
      // player id (e.g. another tab of the same browser window could share
      // the id across sockets if the user uses the same session storage —
      // although the sessionStorage fix means this should no longer happen
      // for distinct tabs, we still guard to avoid spurious evictions).
      const room = io.sockets.adapter.rooms.get(playerId)
      if (room && room.size > 0) return

      const deadline = lobby.markDisconnected(playerId, RECONNECT_GRACE_MS)
      if (deadline === null) return
      scheduleEviction(io, gameManager, lobby, playerId)
      io.to(lobby.getCode()).emit('state-update', lobby.getState())
    })

    socket.on('error', (error) => {
      console.error('Socket error:', error)
    })
  })
}
