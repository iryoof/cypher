import { useEffect, useRef, useState } from 'react'
import { Socket } from 'socket.io-client'
import { PageType } from '../App'
import type { GameSocketApi } from '../hooks/useGameSocket'
import { useTimer } from '../hooks/useTimer'
import TextInput from '../components/TextInput'
import TwoLineInput from '../components/TwoLineInput'
import Timer from '../components/Timer'
import { saveArchive } from '../services/archiveService'

interface GameScreenProps {
  socket: Socket | null
  onNavigate: (page: PageType) => void
  game: GameSocketApi
}

type GamePhase = 'waiting' | 'writing' | 'round-complete' | 'finished'

export default function GameScreen({ socket, onNavigate, game }: GameScreenProps) {
  const { gameState, submitText, startGame } = game
  const [phase, setPhase] = useState<GamePhase>('waiting')
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [promptText, setPromptText] = useState<string>('')
  const hasRequestedState = useRef(false)

  const shouldRunTimer = phase === 'writing' && (gameState?.settings?.timerEnabled ?? false)

  const { timeLeft, isRunning, reset, stop } = useTimer(
    gameState?.settings?.timerSeconds || 60,
    shouldRunTimer,
    () => {
      // Auto-submit when time is up
      setPhase('waiting')
    }
  )

  useEffect(() => {
    if (!socket) return

    const savedPrompt = localStorage.getItem('cypher-round-prompt')
    if (savedPrompt) {
      try {
        const parsed = JSON.parse(savedPrompt)
        if (parsed?.prompt && !promptText) {
          setPromptText(parsed.prompt)
        }
      } catch {
        // ignore parse errors
      }
    }

    socket.on('game-ended', (archive) => {
      console.log('Game ended:', archive)
      saveArchive(archive)
      setPhase('finished')
      onNavigate('menu')
    })

    socket.on('round-started', (roundNumber, prompt) => {
      setPhase('writing')
      setHasSubmitted(false)
      setPromptText(prompt || '')
      localStorage.setItem('cypher-round-prompt', JSON.stringify({ roundNumber, prompt: prompt || '' }))
      if (gameState?.settings?.timerEnabled) {
        reset(gameState.settings.timerSeconds || 60)
      } else {
        stop()
      }
      console.log('Round started:', roundNumber)
    })

    socket.on('round-complete', () => {
      setPhase('round-complete')
    })

    return () => {
      socket.off('game-ended')
      socket.off('round-started')
      socket.off('round-complete')
    }
  }, [socket, gameState?.settings?.timerEnabled, gameState?.settings?.timerSeconds, onNavigate, reset, stop])

  useEffect(() => {
    if (!socket?.connected) return
    if (hasRequestedState.current) return
    hasRequestedState.current = true
    socket.emit('request-state')
  }, [socket])

  const handleTextSubmit = (text: string) => {
    submitText(text)
    setHasSubmitted(true)
    setPhase('waiting')
  }

  const handleNextRound = () => {
    if (!socket?.connected) return
    socket.emit('next-round')
  }

  const handlePlayAgain = () => {
    setPhase('writing')
    setHasSubmitted(false)
    setPromptText('')
    startGame()
  }

  const handleEndGame = () => {
    if (!socket?.connected) return
    socket.emit('end-game')
  }

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-400">Warte auf Spiel...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">🎤 CYPHER</h1>
          <p className="text-gray-400">
            Lobby: <span className="text-purple-400 font-bold">{gameState.lobbyCode}</span>
          </p>
          <p className="text-gray-500 text-sm">Runde {gameState.currentRound}</p>
        </div>

        {/* Timer */}
        {gameState.settings.timerEnabled && (
          <Timer
            timeLeft={timeLeft}
            isRunning={isRunning}
            timerEnabled={gameState.settings.timerEnabled}
          />
        )}

        {/* Game Phases */}
        <div className="bg-gray-900 rounded-lg p-8 border border-gray-800 space-y-6">
          {phase === 'writing' && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">✍️ Schreibe deine Zeilen</h2>
                {promptText && (
                  <p className="text-gray-400">
                    Du reimst auf: "<span className="text-purple-400">{promptText}</span>"
                  </p>
                )}
              </div>

              {gameState.currentRound === 1 ? (
                <TwoLineInput
                  onSubmit={handleTextSubmit}
                  isDisabled={hasSubmitted}
                  placeholder1="Zeile 1..."
                  placeholder2="Zeile 2..."
                />
              ) : (
                <TextInput
                  onSubmit={handleTextSubmit}
                  maxLines={1}
                  placeholder="Schreibe eine Zeile..."
                  isDisabled={hasSubmitted}
                />
              )}

              {hasSubmitted && (
                <div className="p-3 bg-green-900/30 border border-green-500 rounded-lg text-center font-semibold text-green-400">
                  ✅ Text eingereicht! Warte auf die anderen...
                </div>
              )}
            </div>
          )}

          {phase === 'round-complete' && (
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold text-purple-400">Runde beendet</h2>
              {gameState.currentRound >= gameState.maxRounds ? (
                <p className="text-gray-400">Letzte Runde abgeschlossen.</p>
              ) : (
                <p className="text-gray-400">Bereit für die nächste Runde?</p>
              )}

              {gameState.hostId === socket?.id ? (
                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleEndGame}
                    className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition"
                  >
                    Beenden und Archivieren
                  </button>
                  <button
                    onClick={handleNextRound}
                    disabled={gameState.currentRound >= gameState.maxRounds}
                    className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold transition"
                  >
                    Weiterspielen
                  </button>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Warte auf den Host...</div>
              )}
            </div>
          )}

          {phase === 'waiting' && (
            <div className="text-center space-y-4">
              <p className="text-lg text-gray-400">Warte auf die anderen Spieler...</p>
              <div className="flex justify-center space-x-2">
                {gameState.players.map((_, i) => (
                  <div
                    key={i}
                    className="w-3 h-3 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {phase === 'finished' && (
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold text-purple-400">🎉 Spiel vorbei!</h2>
              <p className="text-gray-400">Das Spiel wurde archiviert.</p>
              <div className="space-y-2 pt-4">
                <button
                  onClick={handlePlayAgain}
                  className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-bold transition transform hover:scale-105"
                >
                  🎮 Nochmal spielen
                </button>
                <button
                  onClick={handleEndGame}
                  className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold transition"
                >
                  ← Zum Menü
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Player List */}
        <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
          <h3 className="text-sm font-bold text-gray-400 mb-3">👥 Spieler im Spiel</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {gameState.players.map(player => (
              <div
                key={player.id}
                className={`p-2 rounded text-center text-sm font-semibold transition ${
                  player.isReady
                    ? 'bg-green-900/30 text-green-400 border border-green-500'
                    : 'bg-gray-800/50 text-gray-400'
                }`}
              >
                {player.nickname}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
