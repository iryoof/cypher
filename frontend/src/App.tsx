import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import LobbyScreen from './pages/LobbyScreen'
import GameScreen from './pages/GameScreen'
import GameSetup from './pages/GameSetup'
import ArchiveScreen from './pages/ArchiveScreen'
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
    })

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from server')
    })

    return () => {
      socket.disconnect()
    }
  }, [])

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
          <LobbyScreen socket={appState.socket} onNavigate={navigateTo} />
        )}
        {appState.currentPage === 'setup' && (
          <GameSetup socket={appState.socket} onNavigate={navigateTo} />
        )}
        {appState.currentPage === 'game' && (
          <GameScreen socket={appState.socket} onNavigate={navigateTo} />
        )}
        {appState.currentPage === 'archive' && (
          <ArchiveScreen onNavigate={navigateTo} />
        )}
      </div>
    </div>
  )
}

export default App
