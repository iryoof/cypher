import { formatTime } from '../hooks/useTimer'

interface TimerProps {
  timeLeft: number
  isRunning: boolean
  timerEnabled: boolean
}

export default function Timer({ timeLeft, isRunning, timerEnabled }: TimerProps) {
  if (!timerEnabled) return null

  const isWarning = timeLeft <= 10
  const isCritical = timeLeft <= 5

  return (
    <div className={`text-center p-4 rounded-lg font-bold text-3xl transition ${
      isCritical
        ? 'bg-red-900/30 border border-red-500 text-red-400 animate-pulse'
        : isWarning
        ? 'bg-yellow-900/30 border border-yellow-500 text-yellow-400'
        : isRunning
        ? 'bg-purple-900/30 border border-purple-500 text-purple-400'
        : 'bg-gray-900/30 border border-gray-600 text-gray-400'
    }`}>
      {isRunning ? '⏱️' : '✓'} {formatTime(timeLeft)}
    </div>
  )
}
