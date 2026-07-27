import { useCallback, useMemo, useState } from 'react'
import type { AnswerGridCell, Direction, PlacedWord, Position, Puzzle } from './types'
import Grid, { cellKey } from './Grid'
import { toGermanStyle } from './german'

interface GameProps {
  puzzle: Puzzle
  onNewPuzzle: () => void
  onBackToMenu: () => void
}

const wordCells = (word: PlacedWord): { row: number; col: number }[] => {
  const dr = word.direction === 'down' ? 1 : 0
  const dc = word.direction === 'across' ? 1 : 0
  return Array.from({ length: word.answer.length }, (_, i) => ({
    row: word.row + dr * i,
    col: word.col + dc * i,
  }))
}

export default function Game({ puzzle: rawPuzzle, onNewPuzzle, onBackToMenu }: GameProps) {
  const puzzle = useMemo(() => toGermanStyle(rawPuzzle), [rawPuzzle])

  const [letters, setLetters] = useState<Record<string, string>>({})
  const [revealedCells, setRevealedCells] = useState<Set<string>>(new Set())
  const [wrongCells, setWrongCells] = useState<Set<string>>(new Set())
  const [activeWordId, setActiveWordId] = useState<number | null>(
    puzzle.words[0]?.id ?? null
  )
  const [cursor, setCursor] = useState<Position | null>(
    puzzle.words[0] ? { row: puzzle.words[0].row, col: puzzle.words[0].col } : null
  )

  const activeWord = useMemo(
    () => puzzle.words.find((w) => w.id === activeWordId) ?? null,
    [puzzle.words, activeWordId]
  )

  const solvedWordIds = useMemo(() => {
    const solved = new Set<number>()
    for (const word of puzzle.words) {
      const correct = wordCells(word).every(
        (pos, i) => letters[cellKey(pos.row, pos.col)] === word.answer[i]
      )
      if (correct) solved.add(word.id)
    }
    return solved
  }, [puzzle.words, letters])

  const totalCells = useMemo(() => {
    let count = 0
    for (const row of puzzle.cells) {
      for (const cell of row) {
        if (cell?.kind === 'answer') count++
      }
    }
    return count
  }, [puzzle.cells])

  const filledCount = Object.values(letters).filter(Boolean).length
  const isComplete = solvedWordIds.size === puzzle.words.length && puzzle.words.length > 0

  const selectWord = useCallback((word: PlacedWord, position?: Position) => {
    setActiveWordId(word.id)
    setCursor(position ?? { row: word.row, col: word.col })
  }, [])

  const handleSelectCell = useCallback(
    (cell: AnswerGridCell) => {
      const candidates = cell.wordIds
        .map((id) => puzzle.words.find((w) => w.id === id))
        .filter((w): w is PlacedWord => Boolean(w))
      if (candidates.length === 0) return

      const alreadyOnCell = cursor?.row === cell.row && cursor?.col === cell.col
      const crossing = candidates.find((w) => w.id !== activeWordId)
      const next =
        alreadyOnCell && crossing
          ? crossing
          : candidates.find((w) => w.id === activeWordId) ?? candidates[0]

      selectWord(next, { row: cell.row, col: cell.col })
    },
    [puzzle.words, cursor, activeWordId, selectWord]
  )

  const moveWithinWord = useCallback(
    (from: Position, delta: -1 | 1) => {
      if (!activeWord) return null
      const cells = wordCells(activeWord)
      const index = cells.findIndex((p) => p.row === from.row && p.col === from.col)
      const target = cells[index + delta] ?? null
      if (target) setCursor(target)
      return target
    },
    [activeWord]
  )

  const handleLetter = useCallback(
    (cell: AnswerGridCell, raw: string): Position | null => {
      const typed = raw
        .toUpperCase()
        .replace(/Ä/g, 'A')
        .replace(/Ö/g, 'O')
        .replace(/Ü/g, 'U')
        .replace(/[^A-Z]/g, '')
      if (!typed) return null

      const cells = activeWord ? wordCells(activeWord) : [{ row: cell.row, col: cell.col }]
      const start = cells.findIndex((p) => p.row === cell.row && p.col === cell.col)
      if (start === -1) return null

      const updates: Record<string, string> = {}
      const touched: string[] = []
      let index = start

      for (const letter of typed) {
        const pos = cells[index]
        if (!pos) break
        const id = cellKey(pos.row, pos.col)
        index++
        if (revealedCells.has(id)) continue
        updates[id] = letter
        touched.push(id)
      }

      if (touched.length === 0) return cells[index] ?? null

      setLetters((current) => ({ ...current, ...updates }))
      setWrongCells((current) => {
        if (!touched.some((id) => current.has(id))) return current
        const next = new Set(current)
        touched.forEach((id) => next.delete(id))
        return next
      })

      const target = cells[index] ?? null
      if (target) setCursor(target)
      return target
    },
    [activeWord, revealedCells]
  )

  const handleBackspace = useCallback(
    (cell: AnswerGridCell): Position | null => {
      const id = cellKey(cell.row, cell.col)
      if (revealedCells.has(id)) return null

      setWrongCells((current) => {
        if (!current.has(id)) return current
        const next = new Set(current)
        next.delete(id)
        return next
      })

      if (letters[id]) {
        setLetters((current) => {
          const next = { ...current }
          delete next[id]
          return next
        })
        return null
      }
      return moveWithinWord({ row: cell.row, col: cell.col }, -1)
    },
    [letters, revealedCells, moveWithinWord]
  )

  const handleArrow = useCallback(
    (cell: AnswerGridCell, direction: Direction, delta: -1 | 1): Position | null => {
      let row = cell.row + (direction === 'down' ? delta : 0)
      let col = cell.col + (direction === 'across' ? delta : 0)

      while (row >= 0 && row < puzzle.rows && col >= 0 && col < puzzle.cols) {
        const target = puzzle.cells[row]?.[col]
        if (!target) break
        if (target.kind === 'answer') {
          const matching = target.wordIds
            .map((id) => puzzle.words.find((w) => w.id === id))
            .find((w) => w?.direction === direction)
          if (matching) setActiveWordId(matching.id)
          setCursor({ row, col })
          return { row, col }
        }
        // Skip clue cells
        row += direction === 'down' ? delta : 0
        col += direction === 'across' ? delta : 0
      }
      return null
    },
    [puzzle]
  )

  const revealWord = useCallback((word: PlacedWord) => {
    const updates: Record<string, string> = {}
    const ids: string[] = []
    wordCells(word).forEach((pos, i) => {
      const id = cellKey(pos.row, pos.col)
      updates[id] = word.answer[i]
      ids.push(id)
    })
    setLetters((current) => ({ ...current, ...updates }))
    setRevealedCells((current) => new Set([...current, ...ids]))
    setWrongCells((current) => {
      const next = new Set(current)
      ids.forEach((id) => next.delete(id))
      return next
    })
  }, [])

  const revealAll = useCallback(() => {
    const updates: Record<string, string> = {}
    const ids: string[] = []
    for (const row of puzzle.cells) {
      for (const cell of row) {
        if (cell?.kind !== 'answer') continue
        const id = cellKey(cell.row, cell.col)
        updates[id] = cell.solution
        ids.push(id)
      }
    }
    setLetters(updates)
    setRevealedCells(new Set(ids))
    setWrongCells(new Set())
  }, [puzzle])

  const check = useCallback(() => {
    const wrong = new Set<string>()
    for (const row of puzzle.cells) {
      for (const cell of row) {
        if (cell?.kind !== 'answer') continue
        const id = cellKey(cell.row, cell.col)
        const value = letters[id]
        if (value && value !== cell.solution) wrong.add(id)
      }
    }
    setWrongCells(wrong)
  }, [puzzle, letters])

  const clearAll = useCallback(() => {
    setLetters({})
    setRevealedCells(new Set())
    setWrongCells(new Set())
  }, [])

  return (
    <div className="min-h-screen px-4 py-6">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Kreuzworträtsel</p>
            <h1 className="hero-title text-[clamp(1.4rem,5vw,2.2rem)] leading-none mt-1">
              {isComplete ? 'Gelöst' : 'Rätsel'}
            </h1>
          </div>
          <div className="metric-strip flex items-center gap-3 rounded-lg px-3 py-2">
            <span className="font-mono-ui text-xs text-white/60">
              {solvedWordIds.size}/{puzzle.words.length} Wörter
            </span>
            <span className="font-mono-ui text-xs text-white/40">
              {filledCount}/{totalCells} Felder
            </span>
          </div>
        </header>

        {isComplete && (
          <div className="alert-surface rounded-lg px-4 py-3 text-sm text-emerald-200">
            Alle Wörter stehen. Glückwunsch!
          </div>
        )}

        <div className="surface-panel rounded-xl p-3 sm:p-5">
          <Grid
            puzzle={puzzle}
            letters={letters}
            revealedCells={revealedCells}
            wrongCells={wrongCells}
            activeWordId={activeWordId}
            cursor={cursor}
            onSelectCell={handleSelectCell}
            onLetter={handleLetter}
            onBackspace={handleBackspace}
            onArrow={handleArrow}
          />
        </div>

        {activeWord && (
          <div className="surface-panel-strong rounded-xl px-4 py-3">
            <p className="section-kicker mb-1">
              {activeWord.number} {activeWord.direction === 'across' ? 'waagerecht' : 'senkrecht'}
              {' · '}
              {activeWord.answer.length} Buchstaben
            </p>
            <p className="text-white/90">{activeWord.clue}</p>
            <button
              type="button"
              onClick={() => revealWord(activeWord)}
              className="action-secondary mt-3 rounded-lg px-3 py-1.5 text-xs"
            >
              Dieses Wort lösen
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={check} className="action-secondary rounded-lg px-4 py-2 text-sm">
            Prüfen
          </button>
          <button type="button" onClick={revealAll} className="action-danger rounded-lg px-4 py-2 text-sm">
            Gesamtlösung
          </button>
          <button type="button" onClick={clearAll} className="action-ghost rounded-lg px-4 py-2 text-sm">
            Leeren
          </button>
          <button type="button" onClick={onNewPuzzle} className="action-primary rounded-lg px-4 py-2 text-sm">
            Neues Rätsel
          </button>
          <button type="button" onClick={onBackToMenu} className="action-ghost rounded-lg px-4 py-2 text-sm">
            Menü
          </button>
        </div>
      </div>
    </div>
  )
}
