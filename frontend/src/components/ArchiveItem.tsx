import { GameArchive } from '../../../shared/types'

interface ArchiveItemProps {
  archive: GameArchive
}

export default function ArchiveItem({ archive }: ArchiveItemProps) {
  const date = new Date(archive.date)
  const dateStr = date.toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 hover:border-purple-500 transition cursor-pointer">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-bold text-white">Code: {archive.lobbyCode}</h4>
          <p className="text-sm text-gray-400">{dateStr}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-purple-400">{archive.players.length}</p>
          <p className="text-xs text-gray-400">Spieler</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400">Spieler: {archive.players.join(', ')}</p>
        <div className="bg-black/50 rounded p-2 max-h-32 overflow-y-auto">
          <div className="text-xs text-gray-300 space-y-1">
            {archive.finalTexts.slice(0, 5).map((text, i) => (
              <p key={i} className="truncate">
                {text}
              </p>
            ))}
            {archive.finalTexts.length > 5 && (
              <p className="text-gray-500">... und {archive.finalTexts.length - 5} weitere Zeilen</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
