import { useCallback, useEffect, useMemo, useState } from 'react'
import MainMenu from '../games/kreuzwortraetsel/MainMenu'
import Game from '../games/kreuzwortraetsel/Game'
import { generatePuzzle } from '../games/kreuzwortraetsel/generator'
import { DIFFICULTY_PRESETS } from '../games/kreuzwortraetsel/types'
import type { Difficulty, Puzzle } from '../games/kreuzwortraetsel/types'
import { CATEGORIES, buildPool } from '../games/kreuzwortraetsel/words'
import '../styles/globals.css'

/**
 * Runs entirely in the browser — no lobby, no socket. That keeps the solo mode
 * playable even while the free-tier backend is asleep.
 */
export default function KreuzwortraetselGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>('mittel')
  const [categoryIds, setCategoryIds] = useState<string[]>(
    CATEGORIES.map((category) => category.id)
  )
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)

  useEffect(() => {
    document.title = 'Kreuzworträtsel'
  }, [])

  const pool = useMemo(() => buildPool(categoryIds), [categoryIds])

  const toggleCategory = useCallback((id: string) => {
    setCategoryIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    )
  }, [])

  const start = useCallback(() => {
    const preset = DIFFICULTY_PRESETS[difficulty]
    setPuzzle(
      generatePuzzle(pool, {
        maxSize: preset.maxSize,
        targetWords: preset.targetWords
      })
    )
  }, [pool, difficulty])

  if (!puzzle) {
    return (
      <MainMenu
        difficulty={difficulty}
        onDifficulty={setDifficulty}
        categoryIds={categoryIds}
        onToggleCategory={toggleCategory}
        poolSize={pool.length}
        onStart={start}
      />
    )
  }

  return (
    <Game
      // Remounting on a new puzzle drops the previous letters and reveals,
      // which is exactly what "Neues Rätsel" should do.
      key={`${puzzle.rows}x${puzzle.cols}-${puzzle.words.map((word) => word.answer).join('')}`}
      puzzle={puzzle}
      onNewPuzzle={start}
      onBackToMenu={() => setPuzzle(null)}
    />
  )
}
