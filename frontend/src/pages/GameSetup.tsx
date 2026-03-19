import { useEffect, useRef, useState } from 'react'
import { Socket } from 'socket.io-client'
import { PageType } from '../App'
import type { GameSocketApi } from '../hooks/useGameSocket'

interface GameSetupProps {
  socket: Socket | null
  onNavigate: (page: PageType) => void
  game: GameSocketApi
}

export default function GameSetup({ socket, onNavigate, game }: GameSetupProps) {
  const { gameState, error, loading, leaveLobby, closeLobby, clearSession, startGame } = game
  const [playerCount, setPlayerCount] = useState(3)
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(60)
  const [lobbyCode, setLobbyCode] = useState('')
  const isHost = gameState?.hostId === socket?.id
  const hasRequestedState = useRef(false)

  useEffect(() => {
    const storedCode = localStorage.getItem('cypher-lobby-code') || ''
    setLobbyCode(gameState?.lobbyCode || storedCode)
  }, [gameState?.lobbyCode])

  // If there's no active lobby, show a simple fallback instead of auto-redirecting
  useEffect(() => {
    if (!socket?.connected) return
    if (gameState) return
    if (hasRequestedState.current) return
    hasRequestedState.current = true
    socket.emit('request-state')
  }, [socket, gameState])

  useEffect(() => {
    if (!socket) return

    const handleRoundStarted = (roundNumber: number, prompt: string) => {
      localStorage.setItem('cypher-round-prompt', JSON.stringify({ roundNumber, prompt }))
      onNavigate('game')
    }

    socket.on('round-started', handleRoundStarted)

    return () => {
      socket.off('round-started', handleRoundStarted)
    }
  }, [socket, onNavigate])

  const handleStartGame = () => {
    startGame()
    onNavigate('game')
  }

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8">
        <div className="w-full max-w-md text-center space-y-4 bg-gray-900 rounded-lg p-8 border border-gray-800">
          <h1 className="text-2xl font-bold">
            {loading ? 'Lobby wird geladen...' : 'Keine aktive Lobby'}
          </h1>
          <p className="text-gray-400 text-sm">
            {loading
              ? 'Einen Moment bitte â€“ wir holen den Status vom Server.'
              : 'Bitte trete einer Lobby bei oder erstelle eine neue.'}
          </p>
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-400 text-sm">
              ðŸš« {error}
            </div>
          )}
          <button
            onClick={() => {
              clearSession()
              onNavigate('menu')
            }}
            className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold transition"
          >
            Zurück zum Menü
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">🎮 Spiel Setup</h1>
          <p className="text-gray-400">Passe die Einstellungen an</p>
        </div>

        <div className="bg-gray-900 rounded-lg p-8 space-y-6 border border-gray-800">
          {/* Lobby Code */}
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-400">Lobby-Code</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-black tracking-widest text-purple-400">
                {lobbyCode || '-'}
              </span>
              {lobbyCode && (
                <button
                  onClick={() => navigator.clipboard.writeText(lobbyCode)}
                  className="px-3 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 transition"
                >
                  Kopieren
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500">Teile den Code mit deinen Freunden</p>
          </div>

          {/* Player List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-300">Spielerliste</h3>
              <span className="text-xs text-gray-500">
                {gameState?.players?.length || 0}/{gameState?.settings?.playerCount || playerCount}
              </span>
            </div>
            {gameState?.players?.length ? (
              <div className="grid grid-cols-1 gap-2">
                {gameState.players.map(player => (
                  <div
                    key={player.id}
                    className="px-3 py-2 rounded bg-gray-800 text-sm text-gray-200"
                  >
                    {player.nickname}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">Noch keine Spieler beigetreten.</div>
            )}
          </div>
          {/* Player Count */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-4">
              👥 Anzahl Spieler: <span className="text-purple-400 text-lg">{playerCount}</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[3, 4, 5, 6].map(num => (
                <button
                  key={num}
                  onClick={() => setPlayerCount(num)}
                  className={`py-3 rounded-lg font-bold transition transform hover:scale-105 ${
                    playerCount === num
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600'
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Timer Toggle */}
          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={timerEnabled}
                onChange={(e) => setTimerEnabled(e.target.checked)}
                className="w-5 h-5 rounded bg-gray-800 border-gray-600"
              />
              <span className="text-gray-300 font-semibold">⏱️ Timer aktivieren</span>
            </label>
          </div>

          {/* Timer Display */}
          {timerEnabled && (
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-3">
                ⏰ Zeit pro Runde: <span className="text-purple-400">{timerSeconds}s</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[60, 120, 180, 240, 300].map(seconds => (
                  <button
                    key={seconds}
                    onClick={() => setTimerSeconds(seconds)}
                    className={`py-2 text-sm rounded-lg font-bold transition ${
                      timerSeconds === seconds
                        ? 'bg-purple-600'
                        : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-black/30 rounded p-4 text-sm text-gray-400 space-y-1">
            <p>✓ {playerCount} Spieler</p>
            <p>{timerEnabled ? `✓ Timer: ${timerSeconds}s` : '✓ Ohne Timer'}</p>
          </div>

          {/* Buttons */}
          <div className="space-y-3 pt-4">
            {error && (
              <div className="p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-400 text-sm">
                🚫 {error}
              </div>
            )}
            <button
              onClick={handleStartGame}
              disabled={!gameState || !isHost || (gameState?.players?.length || 0) < 3}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold transition transform hover:scale-105"
            >
              ▶️ Spiel starten
            </button>
            {!isHost && (
              <div className="text-xs text-gray-500 text-center">
                Nur der Host kann das Spiel starten.
              </div>
            )}
            {isHost ? (
              <button
                onClick={() => {
                  closeLobby()
                  clearSession()
                  onNavigate('menu')
                }}
                className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition"
              >
                Lobby schließen
              </button>
            ) : (
              <button
                onClick={() => {
                  leaveLobby()
                  clearSession()
                  onNavigate('menu')
                }}
                className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold transition"
              >
                Lobby verlassen
              </button>
            )}
            <button
              onClick={() => onNavigate('menu')}
              className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold transition"
            >
              ← Zurück
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
