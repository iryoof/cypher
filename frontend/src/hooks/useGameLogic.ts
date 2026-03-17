import { useState } from 'react'

interface TextEntry {
  text: string
  isVisible: boolean
}

export function useGameLogic() {
  const [playerTexts, setPlayerTexts] = useState<TextEntry[]>([])
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [roundNumber, setRoundNumber] = useState(1)

  const addText = (text: string, isVisible: boolean = false) => {
    setPlayerTexts(prev => [...prev, { text, isVisible }])
  }

  const toggleTextVisibility = (index: number) => {
    setPlayerTexts(prev =>
      prev.map((entry, i) =>
        i === index ? { ...entry, isVisible: !entry.isVisible } : entry
      )
    )
  }

  const nextRound = () => {
    setRoundNumber(prev => prev + 1)
    setCurrentPlayerIndex(0)
  }

  const reset = () => {
    setPlayerTexts([])
    setCurrentPlayerIndex(0)
    setRoundNumber(1)
  }

  return {
    playerTexts,
    currentPlayerIndex,
    roundNumber,
    addText,
    toggleTextVisibility,
    nextRound,
    reset,
    setCurrentPlayerIndex
  }
}
