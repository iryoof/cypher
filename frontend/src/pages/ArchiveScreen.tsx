import { useEffect, useState } from 'react'
import { PageType } from '../App'
import { GameArchive } from '../../../shared/types'
import ArchiveItem from '../components/ArchiveItem'

interface ArchiveScreenProps {
  onNavigate: (page: PageType) => void
}

export default function ArchiveScreen({ onNavigate }: ArchiveScreenProps) {
  const [archives, setArchives] = useState<GameArchive[]>([])
  const [selectedArchive, setSelectedArchive] = useState<GameArchive | null>(null)

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('cypher-archives')
    if (saved) {
      try {
        setArchives(JSON.parse(saved))
      } catch (error) {
        console.error('Error loading archives:', error)
      }
    }
  }, [])

  const handleDeleteArchive = (id: string) => {
    const filtered = archives.filter(a => a.id !== id)
    setArchives(filtered)
    localStorage.setItem('cypher-archives', JSON.stringify(filtered))
    setSelectedArchive(null)
  }

  const handleClearAll = () => {
    if (!archives.length) return
    const confirmed = window.confirm('Willst du wirklich alle gespeicherten Spiele löschen?')
    if (!confirmed) return
    setArchives([])
    localStorage.removeItem('cypher-archives')
    setSelectedArchive(null)
  }

  if (selectedArchive) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8">
        <div className="w-full max-w-2xl">
          <button
            onClick={() => setSelectedArchive(null)}
            className="mb-6 text-purple-400 hover:text-purple-300 font-bold flex items-center"
          >
            ← Zurück zum Archiv
          </button>

          <div className="bg-gray-900 rounded-lg p-8 border border-gray-800 space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-2">🎤 Spiel Details</h1>
              <p className="text-gray-400">Code: {selectedArchive.lobbyCode}</p>
              <p className="text-sm text-gray-500">
                {new Date(selectedArchive.date).toLocaleString('de-DE')}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-purple-400 mb-2">👥 Spieler:</h3>
                <p className="text-gray-300">{selectedArchive.players.join(', ')}</p>
              </div>

              <div>
                <h3 className="font-bold text-purple-400 mb-3">📝 Texte:</h3>
                <div className="bg-black/50 rounded-lg p-4 space-y-2 max-h-96 overflow-y-auto">
                  {selectedArchive.finalTexts.map((text, i) => (
                    <div key={i} className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                      <span className="text-purple-400 font-semibold">{i + 1}.</span> {text}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                const lines = [
                  'CYPHER Archiv',
                  `Code: ${selectedArchive.lobbyCode}`,
                  `Datum: ${new Date(selectedArchive.date).toLocaleString('de-DE')}`,
                  `Spieler: ${selectedArchive.players.join(', ')}`,
                  '',
                  'Texte:',
                  ...selectedArchive.finalTexts.map((text, i) => `${i + 1}. ${text}`)
                ]
                const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
                const url = URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = `cypher-archiv-${selectedArchive.lobbyCode}.txt`
                document.body.appendChild(link)
                link.click()
                link.remove()
                URL.revokeObjectURL(url)
              }}
              className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold transition"
            >
              Als TXT herunterladen
            </button>
            <button
              onClick={() => handleDeleteArchive(selectedArchive.id)}
              className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition"
            >
              🗑️ Löschen
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">📻 Archiv</h1>
          <p className="text-gray-400">{archives.length} gespeicherte Spiele</p>
        </div>

        {archives.length === 0 ? (
          <div className="text-center space-y-6">
            <div className="bg-gray-900 rounded-lg p-12 border border-gray-800">
              <p className="text-gray-400 mb-4">Noch keine Spiele archiviert.</p>
              <p className="text-sm text-gray-500">
                Wenn du ein Spiel beendest, werden deine Ergebnisse hier gespeichert.
              </p>
            </div>

            <button
              onClick={() => onNavigate('menu')}
              className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold transition"
            >
              ← Zurück zum Menü
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={handleClearAll}
              className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition"
            >
              🗑️ Alle löschen
            </button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {archives.map(archive => (
                <div
                  key={archive.id}
                  onClick={() => setSelectedArchive(archive)}
                  className="cursor-pointer transform hover:scale-105 transition"
                >
                  <ArchiveItem archive={archive} />
                </div>
              ))}
            </div>

            <button
              onClick={() => onNavigate('menu')}
              className="w-full mt-6 px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold transition"
            >
              ← Zurück zum Menü
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
