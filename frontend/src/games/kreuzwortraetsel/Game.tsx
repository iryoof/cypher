import { useCallback, useMemo, useState } from 'react'
import type { Cell, Direction, PlacedWord, Position, Puzzle } from './types'
import Grid, { cellKey } from './Grid'

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
    col: word.col + dc * i
  }))
}

export default function Game({ puzzle, onNewPuzzle, onBackToMenu }: GameProps) {
  const [letters, setLetters] = useState<Record<string, string>>({})
  const [revealedCells, setRevealedCells] = useState<Set<string>>(new Set())
  const [wrongCells, setWrongCells] = useState<Set<string>>(new Set())
  const [activeWordId, setActiveWordId] = useState<number | null>(
    puzzle.words[0]?.id ?? null
  )
  const [cursor, setCursor] = useState<{ row: number; col: number } | null>(
    puzzle.words[0] ? { row: puzzle.words[0].row, col: puzzle.words[0].col } : null
  )

  const activeWord = useMemo(
    () => puzzle.words.find((word) => word.id === activeWordId) ?? null,
    [puzzle.words, activeWordId]
  )

  const across = useMemo(
    () => puzzle.words.filter((word) => word.direction === 'across'),
    [puzzle.words]
  )
  const down = useMemo(
    () => puzzle.words.filter((word) => word.direction === 'down'),
    [puzzle.words]
  )

  const solvedWordIds = useMemo(() => {
    const solved = new Set<number>()
    for (const word of puzzle.words) {
      const correct = wordCells(word).every(
        (position, index) => letters[cellKey(position.row, position.col)] === word.answer[index]
      )
      if (correct) solved.add(word.id)
    }
    return solved
  }, [puzzle.words, letters])

  const filledCount = Object.values(letters).filter(Boolean).length
  const totalCells = puzzle.cells.flat().filter(Boolean).length
  const isComplete = solvedWordIds.size === puzzle.words.length && puzzle.words.length > 0

  const selectWord = useCallback(
    (word: PlacedWord, position?: { row: number; col: number }) => {
      setActiveWordId(word.id)
      setCursor(position ?? { row: word.row, col: word.col })
    },
    []
  )

  /**
   * Clicking a cell selects a word through it. Clicking the cell again while
   * it already belongs to the active word switches to the crossing word, which
   * is how the direction is toggled without a separate control.
   */
  const handleSelectCell = useCallback(
    (cell: Cell) => {
      const candidates = cell.wordIds
        .map((id) => puzzle.words.find((word) => word.id === id))
        .filter((word): word is PlacedWord => Boolean(word))
      if (candidates.length === 0) return

      const alreadyOnCell = cursor?.row === cell.row && cursor?.col === cell.col
      const crossing = candidates.find((word) => word.id !== activeWordId)

      const next =
        alreadyOnCell && crossing
          ? crossing
          : candidates.find((word) => word.id === activeWordId) ?? candidates[0]

      selectWord(next, { row: cell.row, col: cell.col })
    },
    [puzzle.words, cursor, activeWordId, selectWord]
  )

  const moveWithinWord = useCallback(
    (from: { row: number; col: number }, delta: -1 | 1) => {
      if (!activeWord) return null
      const cells = wordCells(activeWord)
      const index = cells.findIndex(
        (position) => position.row === from.row && position.col === from.col
      )
      const target = cells[index + delta] ?? null
      if (target) setCursor(target)
      return target
    },
    [activeWord]
  )

  // The handlers return where the caret should go next. Grid moves the DOM
  // focus there synchronously, because waiting for the state update would let
  // the next keystroke land in the cell that was just filled.
  //
  // More than one character can arrive at once — from a paste, a phone's word
  // suggestion, or simply typing faster than the browser fires events — so the
  // input is spread over the following cells instead of only keeping the last
  // character.
  const handleLetter = useCallback(
    (cell: Cell, raw: string): Position | null => {
      const typed = raw
        .toUpperCase()
        .replace(/Ä/g, 'A')
        .replace(/Ö/g, 'O')
        .replace(/Ü/g, 'U')
        .replace(/[^A-Z]/g, '')
      if (!typed) return null

      const cells = activeWord ? wordCells(activeWord) : [{ row: cell.row, col: cell.col }]
      const start = cells.findIndex(
        (position) => position.row === cell.row && position.col === cell.col
      )
      if (start === -1) return null

      const updates: Record<string, string> = {}
      const touched: string[] = []
      let index = start

      for (const letter of typed) {
        const position = cells[index]
        if (!position) break
        const id = cellKey(position.row, position.col)
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
    (cell: Cell): Position | null => {
      const id = cellKey(cell.row, cell.col)
      if (revealedCells.has(id)) return null

      setWrongCells((current) => {
        if (!current.has(id)) return current
        const next = new Set(current)
        next.delete(id)
        return next
      })

      // Delete in place if there is something to delete, otherwise step back —
      // the behaviour people expect from a text field.
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
    (cell: Cell, direction: Direction, delta: -1 | 1): Position | null => {
      const row = cell.row + (direction === 'down' ? delta : 0)
      const col = cell.col + (direction === 'across' ? delta : 0)
      const target = puzzle.cells[row]?.[col]
      if (!target) return null

      // Follow the word that runs in the direction the player is moving.
      const matching = target.wordIds
        .map((id) => puzzle.words.find((word) => word.id === id))
        .find((word) => word?.direction === direction)

      if (matching) setActiveWordId(matching.id)
      setCursor({ row, col })
      return { row, col }
    },
    [puzzle]
  )

  const revealWord = useCallback(
    (word: PlacedWord) => {
      const updates: Record<string, string> = {}
      const ids: string[] = []
      wordCells(word).forEach((position, index) => {
        const id = cellKey(position.row, position.col)
        updates[id] = word.answer[index]
        ids.push(id)
      })
      setLetters((current) => ({ ...current, ...updates }))
      setRevealedCells((current) => new Set([...current, ...ids]))
      setWrongCells((current) => {
        const next = new Set(current)
        ids.forEach((id) => next.delete(id))
        return next
      })
    },
    []
  )

  const revealAll = useCallback(() => {
    const updates: Record<string, string> = {}
    const ids: string[] = []
    for (const row of puzzle.cells) {
      for (const cell of row) {
        if (!cell) continue
        const id = cellKey(cell.row, cell.col)
        updates[id] = cell.solution
        ids.push(id)
      }
    }
    setLetters(updates)
    setRevealedCells(new Set(ids))
    setWrongCells(new Set())
  }, [puzzle])

  /** Marks every filled cell that does not match the solution. */
  const check = useCallback(() => {
    const wrong = new Set<string>()
    for (const row of puzzle.cells) {
      for (const cell of row) {
        if (!cell) continue
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

  const renderClueList = (title: string, words: PlacedWord[]) => (
    <div className="flex-1 min-w-0">
      <p className="section-kicker mb-3">{title}</p>
      <ul className="space-y-1">
        {words.map((word) => {
          const isActive = word.id === activeWordId
          const isSolved = solvedWordIds.has(word.id)
          return (
            <li key={word.id}>
              <button
                type="button"
                onClick={() => selectWord(word)}
                className={[
                  'flex w-full gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                  isActive ? 'bg-white/[0.10] text-white' : 'text-white/70 hover:bg-white/[0.05]'
                ].join(' ')}
              >
                <span className="font-mono-ui text-xs text-white/45 pt-0.5 w-5 shrink-0 text-right">
                  {word.number}
                </span>
                <span className={isSolved ? 'line-through text-white/40' : ''}>{word.clue}</span>
                <span className="ml-auto font-mono-ui text-[0.65rem] text-white/30 shrink-0 pt-0.5">
                  {word.answer.length}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )

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
            activeWord={activeWord}
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
            Gesamtlösung anzeigen
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

        <div className="surface-panel flex flex-col gap-6 rounded-xl p-4 sm:flex-row sm:gap-8">
          {renderClueList('Waagerecht', across)}
          {renderClueList('Senkrecht', down)}
        </div>
      </div>
    </div>
  )
}
