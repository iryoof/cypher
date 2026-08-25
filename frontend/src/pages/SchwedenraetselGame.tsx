import { useCallback, useEffect, useMemo, useState } from 'react'
import MainMenu from '../games/schwedenraetsel/MainMenu'
import Game from '../games/schwedenraetsel/Game'
import { generatePuzzle } from '../games/schwedenraetsel/generator'
import { DIFFICULTY_PRESETS } from '../games/schwedenraetsel/types'
import type { Difficulty, Puzzle } from '../games/schwedenraetsel/types'
import { CATEGORIES, buildPool } from '../games/schwedenraetsel/words'
import '../styles/globals.css'

/**
 * Runs entirely in the browser — no lobby, no socket. That keeps the solo mode
 * playable even while the free-tier backend is asleep.
 */
export default function SchwedenraetselGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>('mittel')
  const [categoryIds, setCategoryIds] = useState<string[]>(
    CATEGORIES.map((category) => category.id)
  )
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    document.title = 'Schwedenrätsel'
  }, [])

  const pool = useMemo(() => buildPool(categoryIds), [categoryIds])

  const toggleCategory = useCallback((id: string) => {
    setCategoryIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    )
  }, [])

  /**
   * Filling a gapless grid is a search and can take a few seconds, and it runs
   * on the main thread — so the notice is painted first and the work handed to
   * the next frame, otherwise the button would simply freeze.
   */
  const start = useCallback(() => {
    const preset = DIFFICULTY_PRESETS[difficulty]
    setBusy(true)
    setFailed(false)
    window.setTimeout(() => {
      const next = generatePuzzle(pool, { size: preset.size })
      // The grid shapes were proven fillable against the whole pool. Narrowing
      // it down with the theme buttons can take away the words a shape needs,
      // and then there is nothing to show — say so instead of opening an empty
      // grid.
      if (next.words.length === 0) setFailed(true)
      else setPuzzle(next)
      setBusy(false)
    }, 30)
  }, [pool, difficulty])

  if (!puzzle) {
    return (
      <MainMenu
        difficulty={difficulty}
        onDifficulty={setDifficulty}
        categoryIds={categoryIds}
        onToggleCategory={toggleCategory}
        poolSize={pool.length}
        busy={busy}
        failed={failed}
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
