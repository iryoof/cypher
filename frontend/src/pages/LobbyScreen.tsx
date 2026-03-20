import { useState, useEffect } from 'react'
import { Socket } from 'socket.io-client'
import { PageType } from '../App'
import type { GameSocketApi } from '../hooks/useGameSocket'

const SPLASH_MESSAGES = [
  'Ey Nico kennst du jemanden der Tin heißt?',
  'Bdonis',
  'Warum liegt auf Antons Kopf Stroh?',
  'Noah wie steht der Hunger'
]

const getLocalDateKey = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const hashString = (input: string) => {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const seededRandom = (seed: number) => {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

const getDailySplashMessages = (count: number) => {
  const seed = hashString(getLocalDateKey())
  const rng = seededRandom(seed)
  const shuffled = [...SPLASH_MESSAGES]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

interface LobbyScreenProps {
  socket: Socket | null
  onNavigate: (page: PageType) => void
  game: GameSocketApi
}

export default function LobbyScreen({ socket, onNavigate, game }: LobbyScreenProps) {
  const { gameState, error, loading, joinLobby, createLobby } = game
  const [nickname, setNickname] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [step, setStep] = useState<'menu' | 'join' | 'create'>('menu')
  const [localError, setLocalError] = useState('')
  const [pendingNavigation, setPendingNavigation] = useState(false)
  const splashMessages = getDailySplashMessages(3)

  useEffect(() => {
    if (gameState && pendingNavigation) {
      // Successfully joined or created lobby
      setStep('menu')
      setPendingNavigation(false)
      onNavigate('setup')
    }
  }, [gameState, pendingNavigation, onNavigate])

  const handleCreateLobby = () => {
    if (!nickname.trim()) {
      setLocalError('Nickname erforderlich!')
      return
    }
    if (!socket?.connected) {
      setLocalError('Keine Verbindung zum Server!')
      return
    }
    setLocalError('')
    setPendingNavigation(true)
    createLobby(nickname, 3, false, 60)
  }

  const handleJoinLobby = () => {
    if (!nickname.trim()) {
      setLocalError('Nickname erforderlich!')
      return
    }
    if (!joinCode.trim()) {
      setLocalError('Lobby-Code erforderlich!')
      return
    }
    if (!socket?.connected) {
      setLocalError('Keine Verbindung zum Server!')
      return
    }
    setLocalError('')
    setPendingNavigation(true)
    joinLobby(joinCode.toUpperCase(), nickname)
  }

  const displayError = localError || error

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-12">
          <h1 className="text-7xl font-bold mb-3 tracking-widest">🎤</h1>
          <h2 className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500">
            CYPHER
          </h2>
          <p className="text-gray-400 mb-2">Digitales Reimspiel</p>
          <div className="mb-3 space-y-1">
            {splashMessages.map((message, index) => (
              <p key={index} className="text-xs text-yellow-300 italic">
                {message}
              </p>
            ))}
          </div>
          {!socket?.connected && (
            <p className="text-red-400 text-sm">⚠️ Server-Verbindung wird hergestellt...</p>
          )}
        </div>

        {/* Menu */}
        {step === 'menu' && (
          <div className="space-y-4">
            <button
              onClick={() => {
                setStep('create')
                setLocalError('')
              }}
              disabled={!socket?.connected || loading}
              className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold transition transform hover:scale-105 text-lg"
            >
              🎮 Neues Spiel erstellen
            </button>
            <button
              onClick={() => {
                setStep('join')
                setLocalError('')
              }}
              disabled={!socket?.connected || loading}
              className="w-full px-6 py-4 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold transition text-lg"
            >
              👥 Spiel beitreten
            </button>
            <button
              onClick={() => onNavigate('archive')}
              className="w-full px-6 py-4 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold transition text-lg"
            >
              📻 Archiv anschauen
            </button>
          </div>
        )}

        {/* Create Lobby */}
        {step === 'create' && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold">Neues Spiel erstellen</h3>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Dein Nickname</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 20))}
                maxLength={20}
                placeholder="z.B. Bob123"
                autoFocus
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 text-white placeholder-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">{nickname.length}/20</p>
            </div>

            {displayError && (
              <div className="p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-400 text-sm">
                ❌ {displayError}
              </div>
            )}

            <button
              onClick={handleCreateLobby}
              disabled={loading || !socket?.connected}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold transition transform hover:scale-105"
            >
              {loading ? '⏳ Erstelle...' : '✓ Spiel erstellen'}
            </button>

            <button
              onClick={() => {
                setStep('menu')
                setNickname('')
                setLocalError('')
              }}
              className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold transition"
            >
              ← Zurück
            </button>
          </div>
        )}

        {/* Join Lobby */}
        {step === 'join' && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold">Spiel beitreten</h3>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Dein Nickname</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 20))}
                maxLength={20}
                placeholder="z.B. Bob123"
                autoFocus
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 text-white placeholder-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">{nickname.length}/20</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Lobby-Code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="z.B. ABC123"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 uppercase tracking-widest font-bold text-white placeholder-gray-500"
              />
            </div>

            {displayError && (
              <div className="p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-400 text-sm">
                ❌ {displayError}
              </div>
            )}

            <button
              onClick={handleJoinLobby}
              disabled={loading || !socket?.connected}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold transition transform hover:scale-105"
            >
              {loading ? '⏳ Trete bei...' : '✓ Beitreten'}
            </button>

            <button
              onClick={() => {
                setStep('menu')
                setNickname('')
                setJoinCode('')
                setLocalError('')
              }}
              className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold transition"
            >
              ← Zurück
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-gray-600">
          <p>🎤 Made with ❤️ for your friends</p>
        </div>
      </div>
    </div>
  )
}
