import { Player } from '../../../shared/types'

interface PlayerStatusListProps {
  players: Player[]
  submittedPlayerIds: string[]
  disconnectedPlayerIds: string[]
  selfId?: string
  title?: string
}

/**
 * Compact list of players with a per-player status badge. Rendered during the
 * writing and waiting phases so that players know who still needs to submit.
 */
export default function PlayerStatusList({
  players,
  submittedPlayerIds,
  disconnectedPlayerIds,
  selfId,
  title = 'Abgabestatus'
}: PlayerStatusListProps) {
  if (!players.length) return null
  const submitted = new Set(submittedPlayerIds)
  const disconnected = new Set(disconnectedPlayerIds)

  return (
    <div className="w-full max-w-md mx-auto bg-gray-900/60 rounded-lg p-4 border border-gray-800 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wide text-gray-400">{title}</h3>
        <span className="text-xs text-gray-500">
          {submitted.size}/{players.length} eingereicht
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-1.5">
        {players.map(player => {
          const isSelf = player.id === selfId
          const isDisconnected = disconnected.has(player.id)
          const hasSubmitted = submitted.has(player.id)
          let status: { icon: string; label: string; tone: string }
          if (isDisconnected) {
            status = { icon: '🔌', label: 'Getrennt', tone: 'text-yellow-400' }
          } else if (hasSubmitted) {
            status = { icon: '✅', label: 'Eingereicht', tone: 'text-green-400' }
          } else {
            status = { icon: '✏️', label: 'Schreibt noch', tone: 'text-gray-400' }
          }
          return (
            <li
              key={player.id}
              className={`flex items-center justify-between px-3 py-1.5 rounded bg-gray-800/60 text-sm ${isDisconnected ? 'opacity-60' : ''}`}
            >
              <span className="text-gray-200 truncate">
                {player.nickname}
                {isSelf && <span className="text-xs text-gray-500 ml-1">(du)</span>}
              </span>
              <span className={`text-xs ${status.tone}`}>
                {status.icon} {status.label}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
