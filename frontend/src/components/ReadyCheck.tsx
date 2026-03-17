import { Player } from '../../shared/types'

interface ReadyCheckProps {
  players: Player[]
  currentPlayerId: string
  onToggleReady: () => void
}

export default function ReadyCheck({ players, currentPlayerId, onToggleReady }: ReadyCheckProps) {
  const currentPlayer = players.find(p => p.id === currentPlayerId)
  const allReady = players.every(p => p.isReady)

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">👥 Spieler-Status</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {players.map(player => (
          <div
            key={player.id}
            className={`p-3 rounded-lg border transition ${
              player.isReady
                ? 'bg-green-900/30 border-green-500'
                : 'bg-gray-900/30 border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">{player.nickname}</div>
                <div className="text-xs text-gray-400">
                  {player.isReady ? '✅ Bereit' : '⏳ Wartet...'}
                </div>
              </div>
              {player.id === currentPlayerId && (
                <div className="text-xl">👈</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {currentPlayer?.id === currentPlayerId && (
        <button
          onClick={onToggleReady}
          className={`w-full py-3 rounded-lg font-bold transition transform hover:scale-105 ${
            currentPlayer?.isReady
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
          }`}
        >
          {currentPlayer?.isReady ? '❌ Nicht Bereit' : '✅ Bereit!'}
        </button>
      )}

      {allReady && players.length > 0 && (
        <div className="p-3 bg-green-900/30 border border-green-500 rounded-lg text-center font-bold text-green-400">
          🎉 Alle bereit! Runde startet bald...
        </div>
      )}
    </div>
  )
}
