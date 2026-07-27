import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { generateDensePuzzle } from '../games/kreuzwortraetsel/denseGenerator'
import { toGermanStyle } from '../games/kreuzwortraetsel/german'
import type { GermanPuzzle, AnswerGridCell, Direction, Position } from '../games/kreuzwortraetsel/types'
import { buildPool } from '../games/kreuzwortraetsel/words'

const pool = buildPool()

const cellKey = (r: number, c: number) => `${r},${c}`

function newPuzzle(): GermanPuzzle {
  return toGermanStyle(generateDensePuzzle(pool))
}

export default function KreuzwortraetselGame() {
  const [puzzle, setPuzzle] = useState<GermanPuzzle>(() => newPuzzle())
  const [letters, setLetters] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [wrong, setWrong] = useState<Set<string>>(new Set())
  const [cursor, setCursor] = useState<Position | null>(null)
  const [activeWordId, setActiveWordId] = useState<number | null>(null)
  const inputs = useRef(new Map<string, HTMLInputElement>())

  useEffect(() => { document.title = 'Kreuzworträtsel' }, [])

  const focus = (pos: Position | null) => {
    if (!pos) return
    inputs.current.get(cellKey(pos.row, pos.col))?.focus()
  }

  useEffect(() => {
    if (cursor) inputs.current.get(cellKey(cursor.row, cursor.col))?.focus()
  }, [cursor])

  const generate = useCallback(() => {
    setPuzzle(newPuzzle())
    setLetters({})
    setRevealed(new Set())
    setWrong(new Set())
    setCursor(null)
    setActiveWordId(null)
  }, [])

  const activeWord = useMemo(
    () => puzzle.words.find(w => w.id === activeWordId) ?? null,
    [puzzle, activeWordId]
  )

  const activeCells = useMemo(() => {
    if (!activeWord) return new Set<string>()
    const dr = activeWord.direction === 'down' ? 1 : 0
    const dc = activeWord.direction === 'across' ? 1 : 0
    const s = new Set<string>()
    for (let i = 0; i < activeWord.answer.length; i++)
      s.add(cellKey(activeWord.row + dr * i, activeWord.col + dc * i))
    return s
  }, [activeWord])

  const handleSelectCell = useCallback((cell: AnswerGridCell) => {
    const candidates = cell.wordIds
      .map(id => puzzle.words.find(w => w.id === id))
      .filter(Boolean) as typeof puzzle.words
    if (!candidates.length) return
    const alreadyHere = cursor?.row === cell.row && cursor?.col === cell.col
    const cross = candidates.find(w => w.id !== activeWordId)
    const next = alreadyHere && cross ? cross : (candidates.find(w => w.id === activeWordId) ?? candidates[0])
    setActiveWordId(next.id)
    setCursor({ row: cell.row, col: cell.col })
  }, [puzzle, cursor, activeWordId])

  const moveInWord = useCallback((from: Position, delta: -1 | 1): Position | null => {
    if (!activeWord) return null
    const dr = activeWord.direction === 'down' ? 1 : 0
    const dc = activeWord.direction === 'across' ? 1 : 0
    const cells = Array.from({ length: activeWord.answer.length }, (_, i) => ({
      row: activeWord.row + dr * i, col: activeWord.col + dc * i
    }))
    const idx = cells.findIndex(p => p.row === from.row && p.col === from.col)
    const target = cells[idx + delta] ?? null
    if (target) setCursor(target)
    return target
  }, [activeWord])

  const handleLetter = useCallback((cell: AnswerGridCell, raw: string): Position | null => {
    const ch = raw.toUpperCase().replace(/Ä/g, 'A').replace(/Ö/g, 'O').replace(/Ü/g, 'U').replace(/[^A-Z]/g, '').slice(0, 1)
    if (!ch) return null
    const id = cellKey(cell.row, cell.col)
    if (!revealed.has(id)) {
      setLetters(p => ({ ...p, [id]: ch }))
      setWrong(p => { const n = new Set(p); n.delete(id); return n })
    }
    if (!activeWord) return null
    const dr = activeWord.direction === 'down' ? 1 : 0
    const dc = activeWord.direction === 'across' ? 1 : 0
    const cells = Array.from({ length: activeWord.answer.length }, (_, i) => ({
      row: activeWord.row + dr * i, col: activeWord.col + dc * i
    }))
    const idx = cells.findIndex(p => p.row === cell.row && p.col === cell.col)
    const next = cells[idx + 1] ?? null
    if (next) setCursor(next)
    return next
  }, [revealed, activeWord])

  const handleBackspace = useCallback((cell: AnswerGridCell): Position | null => {
    const id = cellKey(cell.row, cell.col)
    if (revealed.has(id)) return null
    if (letters[id]) {
      setLetters(p => { const n = { ...p }; delete n[id]; return n })
      setWrong(p => { const n = new Set(p); n.delete(id); return n })
      return null
    }
    return moveInWord({ row: cell.row, col: cell.col }, -1)
  }, [letters, revealed, moveInWord])

  const handleArrow = useCallback((cell: AnswerGridCell, dir: Direction, delta: -1 | 1): Position | null => {
    let row = cell.row + (dir === 'down' ? delta : 0)
    let col = cell.col + (dir === 'across' ? delta : 0)
    while (row >= 0 && row < puzzle.rows && col >= 0 && col < puzzle.cols) {
      const t = puzzle.cells[row]?.[col]
      if (!t) break
      if (t.kind === 'answer') {
        const match = (t as AnswerGridCell).wordIds.map(id => puzzle.words.find(w => w.id === id)).find(w => w?.direction === dir)
        if (match) setActiveWordId(match.id)
        setCursor({ row, col })
        return { row, col }
      }
      row += dir === 'down' ? delta : 0
      col += dir === 'across' ? delta : 0
    }
    return null
  }, [puzzle])

  const check = useCallback(() => {
    const w = new Set<string>()
    for (const row of puzzle.cells)
      for (const cell of row)
        if (cell?.kind === 'answer') {
          const c = cell as AnswerGridCell
          const id = cellKey(c.row, c.col)
          if (letters[id] && letters[id] !== c.solution) w.add(id)
        }
    setWrong(w)
  }, [puzzle, letters])

  const revealAll = useCallback(() => {
    const u: Record<string, string> = {}
    const ids: string[] = []
    for (const row of puzzle.cells)
      for (const cell of row)
        if (cell?.kind === 'answer') {
          const c = cell as AnswerGridCell
          const id = cellKey(c.row, c.col)
          u[id] = c.solution
          ids.push(id)
        }
    setLetters(u)
    setRevealed(new Set(ids))
    setWrong(new Set())
  }, [puzzle])

  const CS = 'min(7.5vw, 58px)'
  const btn = (label: string, onClick: () => void, variant: 'normal' | 'danger' = 'normal') => (
    <button type="button" onClick={onClick} style={{
      background: variant === 'danger' ? '#fee2e2' : '#fff',
      border: `1px solid ${variant === 'danger' ? '#fca5a5' : '#ccc'}`,
      color: variant === 'danger' ? '#b91c1c' : '#333',
      borderRadius: 4, padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'sans-serif',
    }}>{label}</button>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f0', fontFamily: 'Georgia, serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 12px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Link to="/" style={{ color: '#777', textDecoration: 'none', fontSize: 13, fontFamily: 'sans-serif' }}>← Zurück</Link>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#111' }}>Kreuzworträtsel</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            {btn('Prüfen', check)}
            {btn('Lösung', revealAll, 'danger')}
            {btn('Neu', generate)}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <div style={{
            display: 'inline-grid',
            gridTemplateColumns: `repeat(${puzzle.cols}, ${CS})`,
            border: '2px solid #222',
            gap: 0,
          }}>
            {puzzle.cells.map((row, r) =>
              row.map((cell, c) => {
                const id = cellKey(r, c)

                if (!cell) return (
                  <div key={id} style={{ width: CS, height: CS, background: '#1a1a1a' }} />
                )

                if (cell.kind === 'clue') {
                  const hasBoth = cell.entries.length >= 2
                  const sorted = [...cell.entries].sort(a => a.direction === 'down' ? -1 : 1)
                  return (
                    <div key={id} style={{
                      width: CS, height: CS,
                      background: '#e8e4d0',
                      border: '1px solid #666',
                      display: 'flex', flexDirection: 'column', overflow: 'hidden',
                      userSelect: 'none', boxSizing: 'border-box',
                    }}>
                      {sorted.map((entry, i) => (
                        <div key={i} style={{
                          flex: 1,
                          borderBottom: hasBoth && i === 0 ? '1px solid #bbb' : 'none',
                          padding: '1px 2px',
                          display: 'flex', flexDirection: 'column', justifyContent: 'center',
                          position: 'relative',
                          fontSize: 'clamp(4px, 1.1vw, 6.5px)',
                          fontWeight: 700, color: '#111', lineHeight: 1.15,
                          fontFamily: 'Arial, sans-serif',
                        }}>
                          <span style={{ paddingRight: '0.7em' }}>{entry.clue}</span>
                          <span style={{
                            position: 'absolute', bottom: 1, right: 2,
                            fontSize: 'clamp(5px, 1.4vw, 9px)', fontWeight: 900,
                          }}>
                            {entry.direction === 'across' ? '▶' : '▼'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                }

                // answer cell
                const ansCell = cell as AnswerGridCell
                const isCursor = cursor?.row === r && cursor?.col === c
                const isActive = activeCells.has(id)
                const isRevealed = revealed.has(id)
                const isWrong = wrong.has(id)

                let bg = '#fff'
                let borderColor = '#666'
                let color = '#111'
                if (isWrong) { bg = '#fff0f0'; borderColor = '#f87171'; color = '#b91c1c' }
                else if (isRevealed) { bg = '#f0fdf4'; borderColor = '#4ade80'; color = '#166534' }
                else if (isCursor) { bg = '#dbeafe'; borderColor = '#2563eb' }
                else if (isActive) { bg = '#eff6ff'; borderColor = '#93c5fd' }

                return (
                  <div key={id} style={{ width: CS, height: CS, position: 'relative', boxSizing: 'border-box' }}>
                    {ansCell.number !== null && (
                      <span style={{
                        position: 'absolute', top: 1, left: 2, zIndex: 10,
                        fontSize: 'clamp(4px, 1vw, 6px)', fontWeight: 700, color: '#555',
                        pointerEvents: 'none', lineHeight: 1, fontFamily: 'monospace',
                      }}>{ansCell.number}</span>
                    )}
                    <input
                      ref={el => { if (el) inputs.current.set(id, el); else inputs.current.delete(id) }}
                      type="text" inputMode="text" autoComplete="off" autoCorrect="off"
                      autoCapitalize="characters" spellCheck={false}
                      value={letters[id] ?? ''}
                      readOnly={isRevealed}
                      onMouseDown={() => handleSelectCell(ansCell)}
                      onChange={e => {
                        const before = letters[id] ?? ''
                        const added = e.target.value.startsWith(before) ? e.target.value.slice(before.length) : e.target.value
                        focus(handleLetter(ansCell, added))
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Backspace') { e.preventDefault(); focus(handleBackspace(ansCell)) }
                        else if (e.key === 'ArrowRight') { e.preventDefault(); focus(handleArrow(ansCell, 'across', 1)) }
                        else if (e.key === 'ArrowLeft') { e.preventDefault(); focus(handleArrow(ansCell, 'across', -1)) }
                        else if (e.key === 'ArrowDown') { e.preventDefault(); focus(handleArrow(ansCell, 'down', 1)) }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); focus(handleArrow(ansCell, 'down', -1)) }
                      }}
                      style={{
                        width: '100%', height: '100%', boxSizing: 'border-box',
                        border: `1px solid ${borderColor}`,
                        background: bg, color,
                        textAlign: 'center', fontFamily: 'Arial, sans-serif',
                        textTransform: 'uppercase',
                        fontSize: 'clamp(10px, 3vw, 18px)', fontWeight: 700,
                        caretColor: 'transparent', outline: 'none', cursor: 'pointer',
                      }}
                    />
                  </div>
                )
              })
            )}
          </div>
        </div>

        {activeWord && (
          <div style={{ marginTop: 12, background: '#fff', border: '1px solid #ccc', borderRadius: 5, padding: '8px 12px' }}>
            <span style={{ fontSize: 11, color: '#888', fontFamily: 'sans-serif', marginRight: 8 }}>
              {activeWord.number} {activeWord.direction === 'across' ? 'waagerecht' : 'senkrecht'} · {activeWord.answer.length} Buchst.
            </span>
            <span style={{ fontSize: 14, color: '#111' }}>{activeWord.clue}</span>
          </div>
        )}

        <p style={{ marginTop: 10, color: '#aaa', fontSize: 11, fontFamily: 'sans-serif', textAlign: 'center' }}>
          Pfeiltasten · Backspace · Buchstaben
        </p>
      </div>
    </div>
  )
}
