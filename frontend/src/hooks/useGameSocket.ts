import { useEffect, useState, useCallback } from 'react'
import { Socket } from 'socket.io-client'
import { GameState } from '../../../shared/types'

export function useGameSocket(socket: Socket | null) {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const clearSession = useCallback(() => {
    setGameState(null)
    setLoading(false)
    setError('')
    localStorage.removeItem('cypher-lobby-code')
    localStorage.removeItem('cypher-game-state')
    localStorage.removeItem('cypher-round-prompt')
  }, [])

  // Listen to socket events
  useEffect(() => {
    if (!socket) return

    const savedState = localStorage.getItem('cypher-game-state')
    if (savedState) {
      try {
        setGameState(JSON.parse(savedState))
      } catch {
        // ignore parse errors
      }
    }

    socket.on('lobby-joined', (state: GameState) => {
      setGameState(state)
      setLoading(false)
      if (state?.lobbyCode) {
        localStorage.setItem('cypher-lobby-code', state.lobbyCode)
      }
      localStorage.setItem('cypher-game-state', JSON.stringify(state))
    })

    socket.on('lobby-created', (code: string, state: GameState) => {
      console.log('Lobby created:', code)
      setGameState(state)
      setLoading(false)
      if (code) {
        localStorage.setItem('cypher-lobby-code', code)
      }
      localStorage.setItem('cypher-game-state', JSON.stringify(state))
    })

    socket.on('state-update', (state: GameState) => {
      setGameState(state)
      if (state?.lobbyCode) {
        localStorage.setItem('cypher-lobby-code', state.lobbyCode)
      }
      localStorage.setItem('cypher-game-state', JSON.stringify(state))
    })

    socket.on('lobby-closed', () => {
      clearSession()
    })

    socket.on('error', (message: string) => {
      setError(message)
      console.error('Socket error:', message)
      if (message.toLowerCase().includes('lobby not found') || message.toLowerCase().includes('lobby nicht gefunden')) {
        clearSession()
      }
    })

    socket.on('connect_error', (err: Error) => {
      setError('Verbindung zum Server fehlgeschlagen')
      console.error('Connection error:', err)
    })

    return () => {
      socket.off('lobby-joined')
      socket.off('lobby-created')
      socket.off('state-update')
      socket.off('lobby-closed')
      socket.off('error')
      socket.off('connect_error')
    }
  }, [socket, clearSession])

  const joinLobby = useCallback((code: string, nickname: string) => {
    if (!socket?.connected) {
      setError('Nicht mit Server verbunden')
      return
    }
    setLoading(true)
    socket.emit('join-lobby', code, nickname)
  }, [socket])

  const createLobby = useCallback((nickname: string, playerCount: number, timerEnabled: boolean, timerSeconds: number) => {
    if (!socket?.connected) {
      setError('Nicht mit Server verbunden')
      return
    }
    setLoading(true)
    socket.emit('create-lobby', { playerCount, timerEnabled, timerSeconds }, nickname)
  }, [socket])

  const submitText = useCallback((text: string) => {
    if (!socket?.connected) {
      setError('Nicht mit Server verbunden')
      return
    }
    socket.emit('submit-text', text)
  }, [socket])

  const leaveLobby = useCallback(() => {
    if (!socket?.connected) {
      setError('Nicht mit Server verbunden')
      return
    }
    socket.emit('leave-lobby')
  }, [socket])

  const closeLobby = useCallback(() => {
    if (!socket?.connected) {
      setError('Nicht mit Server verbunden')
      return
    }
    socket.emit('close-lobby')
  }, [socket])

  const startGame = useCallback(() => {
    if (!socket?.connected) {
      setError('Nicht mit Server verbunden')
      return
    }
    socket.emit('start-game')
  }, [socket])

  return {
    gameState,
    error,
    loading,
    joinLobby,
    createLobby,
    submitText,
    leaveLobby,
    closeLobby,
    clearSession,
    startGame,
    socket
  }
}
