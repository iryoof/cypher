import { useEffect, useState } from 'react'
import { Socket } from 'socket.io-client'
import { PageType } from '../App'

interface GameSetupProps {
  socket: Socket | null
  onNavigate: (page: PageType) => void
}

export default function GameSetup({ socket, onNavigate }: GameSetupProps) {
  const [playerCount, setPlayerCount] = useState(3)
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(60)
  const [lobbyCode, setLobbyCode] = useState('')

  useEffect(() => {
    const storedCode = localStorage.getItem('cypher-lobby-code') || ''
    setLobbyCode(storedCode)
  }, [])

  const handleStartGame = () => {
    if (socket?.connected) {
      socket.emit('start-game')
      onNavigate('game')
    }
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
                {lobbyCode || '—'}
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
            <button
              onClick={handleStartGame}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-bold transition transform hover:scale-105"
            >
              ▶️ Spiel starten
            </button>
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
