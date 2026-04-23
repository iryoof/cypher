import { Server as SocketIOServer, Socket } from 'socket.io'
import { GameManager } from './game/GameManager'

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
        socket.join(code)
        socket.emit('lobby-joined', lobby.getState())
        io.to(code).emit('state-update', lobby.getState())
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

    // Leave Lobby (non-host)
    socket.on('leave-lobby', () => {
      try {
        const playerId = socket.data.playerId || socket.id
        const lobby = gameManager.findLobbyByPlayerId(playerId)
        if (!lobby) throw new Error('Lobby not found')
        if (lobby.getHostId() === playerId) {
          throw new Error('Host muss die Lobby schließen')
        }

        const code = lobby.getCode()
        gameManager.removePlayer(playerId)
        socket.leave(code)
        socket.leave(playerId)

        if (lobby.getPlayerCount() > 0) {
          io.to(code).emit('state-update', lobby.getState())
        }
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
        gameManager.removeLobby(code)
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

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`)
    })

    socket.on('error', (error) => {
      console.error('Socket error:', error)
    })
  })
}
