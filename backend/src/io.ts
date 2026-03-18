import { Server as SocketIOServer, Socket } from 'socket.io'
import { GameManager } from './game/GameManager'

export function setupSocketHandlers(io: SocketIOServer, gameManager: GameManager) {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`)
    socket.join(socket.id)

    // Join Lobby
    socket.on('join-lobby', (code: string, nickname: string) => {
      try {
        const lobby = gameManager.joinLobby(socket.id, code, nickname)
        socket.join(code)
        socket.emit('lobby-joined', lobby.getState())
        io.to(code).emit('state-update', lobby.getState())
        console.log(`${nickname} joined lobby ${code}`)
      } catch (error: any) {
        socket.emit('error', error.message)
      }
    })

    // Create Lobby
    socket.on('create-lobby', (settings: any, nickname: string) => {
      try {
        const lobby = gameManager.createLobby(socket.id, nickname, settings)
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
        const lobby = gameManager.findLobbyByPlayerId(socket.id)
        if (!lobby) throw new Error('Lobby not found')

        const state = lobby.getState()
        socket.emit('state-update', state)
        if (state.gameStarted && !state.gameEnded) {
          const prompt = lobby.getPromptForPlayer(socket.id)
          socket.emit('round-started', state.currentRound, prompt)
        }
      } catch (error: any) {
        socket.emit('error', error.message)
      }
    })

    // Submit Text
    socket.on('submit-text', (text: string) => {
      try {
        const lobby = gameManager.findLobbyByPlayerId(socket.id)
        if (!lobby) throw new Error('Lobby not found')

        lobby.submitText(socket.id, text)

        if (lobby.haveAllPlayersSubmitted()) {
          io.to(lobby.getCode()).emit('round-complete', lobby.getState().currentRound)
        }
      } catch (error: any) {
        socket.emit('error', error.message)
      }
    })

    // Ready Check
    socket.on('ready-check', (playerId: string) => {
      try {
        const lobby = gameManager.findLobbyByPlayerId(playerId)
        if (!lobby) throw new Error('Lobby not found')

        lobby.setPlayerReady(playerId)
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
        const lobby = gameManager.findLobbyByPlayerId(socket.id)
        if (!lobby) throw new Error('Lobby not found')
        if (lobby.getHostId() !== socket.id) {
          throw new Error('Nur der Host kann das Spiel starten')
        }

        lobby.startGame()
        io.to(lobby.getCode()).emit('state-update', lobby.getState())

        lobby.getPlayers().forEach(player => {
          const prompt = lobby.getPromptForPlayer(player.id)
          socket.to(player.id).emit('round-started', lobby.getState().currentRound, prompt)
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
        const lobby = gameManager.findLobbyByPlayerId(socket.id)
        if (!lobby) throw new Error('Lobby not found')
        if (lobby.getHostId() !== socket.id) {
          throw new Error('Nur der Host kann die naechste Runde starten')
        }

        lobby.nextRound()
        io.to(lobby.getCode()).emit('state-update', lobby.getState())
        lobby.getPlayers().forEach(player => {
          const prompt = lobby.getPromptForPlayer(player.id)
          socket.to(player.id).emit('round-started', lobby.getState().currentRound, prompt)
          io.to(player.id).emit('round-started', lobby.getState().currentRound, prompt)
        })
      } catch (error: any) {
        socket.emit('error', error.message)
      }
    })

    // End Game
    socket.on('end-game', () => {
      try {
        const lobby = gameManager.findLobbyByPlayerId(socket.id)
        if (!lobby) throw new Error('Lobby not found')
        if (lobby.getHostId() !== socket.id) {
          throw new Error('Nur der Host kann das Spiel beenden')
        }

        const archive = gameManager.archiveGame(lobby.getCode())
        if (!archive) throw new Error('Archive failed')
        io.to(lobby.getCode()).emit('game-ended', archive)
      } catch (error: any) {
        socket.emit('error', error.message)
      }
    })

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`)
      gameManager.removePlayer(socket.id)
    })

    socket.on('error', (error) => {
      console.error('Socket error:', error)
    })
  })
}
