import { useEffect, useState, useCallback } from 'react'
import { Socket } from 'socket.io-client'
import { GameState } from '../../../shared/types'

export function useGameSocket(socket: Socket | null) {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Listen to socket events
  useEffect(() => {
    if (!socket?.connected) return

    socket.on('lobby-joined', (state: GameState) => {
      setGameState(state)
      setLoading(false)
    })

    socket.on('lobby-created', (code: string, state: GameState) => {
      console.log('Lobby created:', code)
      setGameState(state)
      setLoading(false)
    })

    socket.on('state-update', (state: GameState) => {
      setGameState(state)
    })

    socket.on('error', (message: string) => {
      setError(message)
      console.error('Socket error:', message)
    })

    return () => {
      socket.off('lobby-joined')
      socket.off('lobby-created')
      socket.off('state-update')
      socket.off('error')
    }
  }, [socket])

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
    socket.emit('submit-text', socket.id, text)
  }, [socket])

  const setReady = useCallback(() => {
    if (!socket?.connected) {
      setError('Nicht mit Server verbunden')
      return
    }
    socket.emit('ready-check', socket.id)
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
    setReady,
    startGame,
    socket
  }
}
