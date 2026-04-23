import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import LobbyScreen from './pages/LobbyScreen'
import GameScreen from './pages/GameScreen'
import GameSetup from './pages/GameSetup'
import ArchiveScreen from './pages/ArchiveScreen'
import { useGameSocket } from './hooks/useGameSocket'
import './styles/globals.css'

export type PageType = 'menu' | 'lobby' | 'setup' | 'game' | 'archive'

interface AppState {
  currentPage: PageType
  socket: Socket | null
  sessionId: string | null
}

function App() {
  const [appState, setAppState] = useState<AppState>({
    currentPage: 'menu',
    socket: null,
    sessionId: null
  })
  const game = useGameSocket(appState.socket)
  const { gameState } = game

  useEffect(() => {
    // Initialize Socket.io connection
    const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling']
    })

    socket.on('connect', () => {
      console.log('✅ Connected to server')
      setAppState((prev: AppState) => ({ ...prev, socket, sessionId: socket.id ?? null }))
      const savedCode = localStorage.getItem('cypher-lobby-code')
      const savedNickname = localStorage.getItem('cypher-nickname')
      const savedPlayerId = localStorage.getItem('cypher-player-id')
      if (savedCode && savedNickname && savedPlayerId) {
        socket.emit('join-lobby', savedCode, savedNickname, savedPlayerId)
      }
    })

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from server')
    })

    const handleLobbyClosed = () => {
      localStorage.removeItem('cypher-lobby-code')
      localStorage.removeItem('cypher-game-state')
      localStorage.removeItem('cypher-round-prompt')
      localStorage.removeItem('cypher-nickname')
      localStorage.removeItem('cypher-player-id')
      setAppState((prev: AppState) => ({ ...prev, currentPage: 'menu' }))
    }

    socket.on('lobby-closed', handleLobbyClosed)

    return () => {
      socket.off('lobby-closed', handleLobbyClosed)
      socket.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!gameState) return
    if (appState.currentPage !== 'menu') return
    if ((gameState.gameStarted && !gameState.gameEnded) || gameState.votingActive) {
      setAppState((prev: AppState) => ({ ...prev, currentPage: 'game' }))
      return
    }
    setAppState((prev: AppState) => ({ ...prev, currentPage: 'setup' }))
  }, [appState.currentPage, gameState])

  const navigateTo = (page: PageType) => {
    setAppState((prev: AppState) => ({ ...prev, currentPage: page }))
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-black to-black pointer-events-none" />
      
      {/* Main content */}
      <div className="relative z-10">
        {appState.currentPage === 'menu' && (
          <LobbyScreen socket={appState.socket} onNavigate={navigateTo} game={game} />
        )}
        {appState.currentPage === 'setup' && (
          <GameSetup socket={appState.socket} onNavigate={navigateTo} game={game} />
        )}
        {appState.currentPage === 'game' && (
          <GameScreen socket={appState.socket} onNavigate={navigateTo} game={game} />
        )}
        {appState.currentPage === 'archive' && (
          <ArchiveScreen onNavigate={navigateTo} />
        )}
      </div>
    </div>
  )
}

export default App
