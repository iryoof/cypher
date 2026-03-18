import { Server as SocketIOServer, Socket } from 'socket.io'
import { GameManager } from './game/GameManager'

export function setupSocketHandlers(io: SocketIOServer, gameManager: GameManager) {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`)

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

    // Submit Text
    socket.on('submit-text', (playerId: string, text: string) => {
      try {
        const lobby = gameManager.findLobbyByPlayerId(playerId)
        if (!lobby) throw new Error('Lobby not found')

        const author = lobby.getPlayers().find(p => p.id === playerId)?.nickname || 'Unknown'
        lobby.submitText(playerId, text)
        io.to(lobby.getCode()).emit('text-received', text, author, playerId)

        if (lobby.haveAllPlayersSubmitted()) {
          lobby.resetReadyStatus()
          lobby.nextRound()
          io.to(lobby.getCode()).emit('state-update', lobby.getState())
          io.to(lobby.getCode()).emit('round-started', lobby.getState().currentRound)
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
          lobby.resetReadyStatus()
          lobby.nextRound()
          io.to(lobby.getCode()).emit('state-update', lobby.getState())
          io.to(lobby.getCode()).emit('round-started', lobby.getState().currentRound)
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

        lobby.startGame()
        io.to(lobby.getCode()).emit('state-update', lobby.getState())
        io.to(lobby.getCode()).emit('round-started', lobby.getState().currentRound)
        console.log(`Game started: ${lobby.getCode()}`)
      } catch (error: any) {
        socket.emit('error', error.message)
      }
    })

    // Next Round
    socket.on('next-round', () => {
      console.log('Next round')
    })

    // End Game
    socket.on('end-game', () => {
      console.log('Game ended')
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
