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

  const btn = (label: string, onClick: () => void, danger = false) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: danger ? '#fee2e2' : '#fff',
        border: `1px solid ${danger ? '#fca5a5' : '#ccc'}`,
        color: danger ? '#b91c1c' : '#333',
        borderRadius: 4, padding: '6px 14px', fontSize: 13,
        cursor: 'pointer', fontFamily: 'sans-serif',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f0', fontFamily: 'Georgia, serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#111' }}>
            {isComplete ? 'Gelöst! 🎉' : 'Kreuzworträtsel'}
          </h1>
          <span style={{ fontSize: 13, color: '#888', fontFamily: 'sans-serif' }}>
            {solvedWordIds.size}/{puzzle.words.length} Wörter · {filledCount}/{totalCells} Felder
          </span>
        </div>

        {isComplete && (
          <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 6, padding: '10px 16px', marginBottom: 16, color: '#166534', fontSize: 14, fontFamily: 'sans-serif' }}>
            Alle Wörter stehen. Glückwunsch!
          </div>
        )}

        <div style={{ overflowX: 'auto', marginBottom: 16 }}>
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
          <div style={{ background: '#fff', border: '1px solid #ccc', borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#888', fontFamily: 'sans-serif', marginBottom: 4 }}>
              {activeWord.number} {activeWord.direction === 'across' ? 'waagerecht' : 'senkrecht'} · {activeWord.answer.length} Buchstaben
            </div>
            <div style={{ fontSize: 15, color: '#111' }}>{activeWord.clue}</div>
            <button
              type="button"
              onClick={() => revealWord(activeWord)}
              style={{ marginTop: 8, background: '#f0f0f0', border: '1px solid #ccc', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'sans-serif', color: '#444' }}
            >
              Wort lösen
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {btn('Prüfen', check)}
          {btn('Gesamtlösung', revealAll, true)}
          {btn('Leeren', clearAll)}
          {btn('Neues Rätsel', onNewPuzzle)}
          {btn('Menü', onBackToMenu)}
        </div>
      </div>
    </div>
  )
}
