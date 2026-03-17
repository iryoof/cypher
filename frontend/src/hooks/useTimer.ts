import { useEffect, useState } from 'react'

export function useTimer(initialSeconds: number, isActive: boolean, onTimeUp?: () => void) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds)
  const [isRunning, setIsRunning] = useState(isActive)

  useEffect(() => {
    setIsRunning(isActive)
  }, [isActive])

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsRunning(false)
          onTimeUp?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, timeLeft, onTimeUp])

  const reset = (seconds: number) => {
    setTimeLeft(seconds)
    setIsRunning(true)
  }

  const stop = () => {
    setIsRunning(false)
  }

  return { timeLeft, isRunning, reset, stop }
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
