import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadPuzzle } from '../games/kreuzwortraetsel/loadPuzzle'
import { PUZZLES } from '../games/kreuzwortraetsel/puzzles'
import type { GermanPuzzle, AnswerGridCell, Direction, Position } from '../games/kreuzwortraetsel/types'
import { buildPool } from '../games/kreuzwortraetsel/words'

const pool = buildPool()

const cellKey = (r: number, c: number) => `${r},${c}`

/**
 * Picks a puzzle from the shipped set, avoiding an immediate repeat. The layouts
 * are pre-generated: filling a grid with no empty cells takes seconds of search,
 * which would stall the page if done here.
 */
let lastIndex = -1
function newPuzzle(): GermanPuzzle {
  let i = Math.floor(Math.random() * PUZZLES.length)
  if (PUZZLES.length > 1 && i === lastIndex) i = (i + 1) % PUZZLES.length
  lastIndex = i
  return loadPuzzle(PUZZLES[i], pool)
}

/**
 * Type size for a question, stepped down as it gets longer so it still fits its
 * cell — the same trick printed puzzles use. A half cell has roughly half the
 * height, so it drops a tier earlier.
 */
function clueFontSize(clue: string, split: boolean): string {
  const n = clue.length
  if (split) {
    if (n <= 15) return 'clamp(5.5px, 1.28vw, 9px)'
    if (n <= 25) return 'clamp(4.9px, 1.12vw, 7.9px)'
    if (n <= 36) return 'clamp(4.4px, 1vw, 7px)'
    return 'clamp(3.9px, 0.9vw, 6.2px)'
  }
  if (n <= 24) return 'clamp(6.4px, 1.45vw, 10.5px)'
  if (n <= 36) return 'clamp(5.7px, 1.3vw, 9.4px)'
  if (n <= 50) return 'clamp(5px, 1.15vw, 8.3px)'
  return 'clamp(4.5px, 1.03vw, 7.4px)'
}

/** Paper palette. The puzzle reads as a printed sheet laid on the dark page. */
const PAPER = {
  sheet: '#f2efe4',
  clue: '#e4dfca',
  clueLine: '#c9c3a8',
  rule: '#2c2a24',
  ink: '#1a1815',
  answer: '#fffefa',
  active: '#fdf1c8',
  cursor: '#f6d97a',
  wrong: '#f8cfc9',
  wrongInk: '#8f1d12',
  solved: '#d8e9d2',
  solvedInk: '#2f5d29',
}

export default function KreuzwortraetselGame() {
  const [puzzle, setPuzzle] = useState<GermanPuzzle>(() => newPuzzle())
  const [letters, setLetters] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [wrong, setWrong] = useState<Set<string>>(new Set())
  const [checked, setChecked] = useState<{ wrong: number; blank: number } | null>(null)
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

  const answerCells = useMemo(() => {
    const out: AnswerGridCell[] = []
    for (const row of puzzle.cells)
      for (const cell of row)
        if (cell?.kind === 'answer') out.push(cell)
    return out
  }, [puzzle])

  const filledCount = answerCells.filter(c => letters[cellKey(c.row, c.col)]).length
  const isComplete =
    answerCells.length > 0 &&
    answerCells.every(c => letters[cellKey(c.row, c.col)] === c.solution)

  const reset = useCallback((next: GermanPuzzle | null) => {
    if (next) setPuzzle(next)
    setLetters({})
    setRevealed(new Set())
    setWrong(new Set())
    setChecked(null)
    setCursor(null)
    setActiveWordId(null)
  }, [])

  const generate = useCallback(() => reset(newPuzzle()), [reset])
  const clearAll = useCallback(() => reset(null), [reset])

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
    // Solutions spell umlauts out (AE/OE/UE), so a typed 'Ä' becomes the 'A' it
    // starts with rather than a letter that could never match.
    const ch = raw
      .toUpperCase()
      .replace(/Ä/g, 'A').replace(/Ö/g, 'O').replace(/Ü/g, 'U').replace(/ß/g, 'S')
      .replace(/[^A-Z]/g, '')
      .slice(0, 1)
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
      if (t?.kind === 'answer') {
        const match = t.wordIds
          .map(id => puzzle.words.find(w => w.id === id))
          .find(w => w?.direction === dir)
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
    const bad = new Set<string>()
    let blank = 0
    for (const cell of answerCells) {
      const id = cellKey(cell.row, cell.col)
      const value = letters[id]
      if (!value) blank++
      else if (value !== cell.solution) bad.add(id)
    }
    setWrong(bad)
    setChecked({ wrong: bad.size, blank })
  }, [answerCells, letters])

  const revealAll = useCallback(() => {
    const all: Record<string, string> = {}
    const ids: string[] = []
    for (const cell of answerCells) {
      const id = cellKey(cell.row, cell.col)
      all[id] = cell.solution
      ids.push(id)
    }
    setLetters(all)
    setRevealed(new Set(ids))
    setWrong(new Set())
    setChecked(null)
  }, [answerCells])

  // The questions are the smallest text on the page and set the floor for the
  // grid. Twelve columns of readable German clue text do not fit a phone, so
  // below the floor the sheet scrolls sideways rather than shrinking the type
  // into illegibility.
  const CS = 'clamp(48px, 7.9vw, 66px)'

  return (
    <div className="min-h-screen overflow-x-hidden text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.05),transparent_28%)]" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/5 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">

        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="section-kicker mb-2">Rätsel</p>
            <h1 className="hero-title text-xl sm:text-2xl">Kreuzworträtsel</h1>
          </div>
          <Link
            to="/"
            className="action-ghost shrink-0 px-4 py-2 text-xs"
          >
            Zurück
          </Link>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={check} className="action-secondary px-5 py-2.5 text-xs">
            Prüfen
          </button>
          <button type="button" onClick={clearAll} className="action-ghost px-5 py-2.5 text-xs">
            Leeren
          </button>
          <button type="button" onClick={revealAll} className="action-danger px-5 py-2.5 text-xs">
            Lösung
          </button>
          <button type="button" onClick={generate} className="action-primary ml-auto px-5 py-2.5 text-xs">
            Neues Rätsel
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono-ui text-[0.7rem] uppercase tracking-[0.16em] text-zinc-400">
          <span>
            <span className="text-zinc-100">{filledCount}</span>
            <span className="text-zinc-500"> / {answerCells.length}</span> Felder
          </span>
          <span>
            <span className="text-zinc-100">{puzzle.words.length}</span> Wörter
          </span>
          {checked && checked.wrong > 0 && (
            <span className="text-[#ff8f8f]">{checked.wrong} falsch</span>
          )}
          {checked && checked.wrong === 0 && checked.blank > 0 && (
            <span className="text-[#f5d372]">Bisher alles richtig</span>
          )}
          {isComplete && <span className="text-[#8fe0a0]">Gelöst</span>}
        </div>

        {/* The puzzle itself is drawn as a printed sheet resting on the dark page. */}
        <div
          className="overflow-x-auto rounded-2xl p-2.5 sm:p-4"
          style={{
            background: PAPER.sheet,
            border: '1px solid rgba(255,255,255,0.16)',
            boxShadow: '0 26px 70px rgba(0,0,0,0.55)',
          }}
        >
          <div
            style={{
              display: 'inline-grid',
              gridTemplateColumns: `repeat(${puzzle.cols}, ${CS})`,
              gap: 0,
              border: `1.5px solid ${PAPER.rule}`,
              margin: '0 auto',
            }}
          >
            {puzzle.cells.map((row, r) =>
              row.map((cell, c) => {
                const id = cellKey(r, c)
                const border = `0.5px solid ${PAPER.rule}`

                // Should not occur: every generated cell is a clue or an answer.
                if (!cell) return (
                  <div key={id} style={{ width: CS, height: CS, background: PAPER.clue, border, boxSizing: 'border-box' }} />
                )

                if (cell.kind === 'clue') {
                  const split = cell.entries.length > 1
                  return (
                    <div
                      key={id}
                      style={{
                        width: CS, height: CS, boxSizing: 'border-box',
                        background: PAPER.clue,
                        border,
                        position: 'relative',
                        display: 'flex', flexDirection: 'column',
                        overflow: 'hidden',
                        userSelect: 'none',
                      }}
                    >
                      {/* Each half carries its own arrow, on the edge its word
                          runs off: ▶ right of the across clue, ▼ under the down
                          clue. Anchoring the arrows to the half rather than to
                          the whole cell is what keeps a split cell readable. */}
                      {cell.entries.map((entry, i) => (
                        <div
                          key={i}
                          style={{
                            flex: 1,
                            minHeight: 0,
                            position: 'relative',
                            display: 'flex', alignItems: 'center',
                            // Just enough room for the arrow; in a split cell
                            // each half is barely taller than three lines, so
                            // padding is the difference between fitting and not.
                            padding: entry.direction === 'across'
                              ? '1px 9px 1px 3px'
                              : `${split ? 0 : 1}px 3px 5px 3px`,
                            borderBottom: split && i === 0 ? `0.5px solid ${PAPER.clueLine}` : 'none',
                            fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif",
                            fontSize: clueFontSize(entry.clue, split),
                            fontWeight: 600,
                            lineHeight: 1.1,
                            letterSpacing: '-0.015em',
                            color: PAPER.ink,
                            hyphens: 'auto',
                            overflow: 'hidden',
                          }}
                          lang="de"
                        >
                          <span style={{ overflow: 'hidden' }}>{entry.clue}</span>
                          <span
                            aria-hidden
                            style={entry.direction === 'across'
                              ? {
                                  position: 'absolute', right: 0, top: '50%',
                                  transform: 'translateY(-50%)',
                                  fontSize: 'clamp(6px, 1.7vw, 12px)', lineHeight: 1, color: PAPER.ink,
                                }
                              : {
                                  position: 'absolute', bottom: -1, left: '50%',
                                  transform: 'translateX(-50%)',
                                  fontSize: 'clamp(6px, 1.7vw, 12px)', lineHeight: 1, color: PAPER.ink,
                                }}
                          >
                            {entry.direction === 'across' ? '▶' : '▼'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                }

                const isCursor = cursor?.row === r && cursor?.col === c
                const isActive = activeCells.has(id)
                const isRevealed = revealed.has(id)
                const isWrong = wrong.has(id)

                let bg = PAPER.answer
                let ink = PAPER.ink
                if (isWrong) { bg = PAPER.wrong; ink = PAPER.wrongInk }
                else if (isRevealed) { bg = PAPER.solved; ink = PAPER.solvedInk }
                else if (isCursor) bg = PAPER.cursor
                else if (isActive) bg = PAPER.active

                return (
                  <div key={id} style={{ width: CS, height: CS, position: 'relative', boxSizing: 'border-box' }}>
                    <input
                      ref={el => { if (el) inputs.current.set(id, el); else inputs.current.delete(id) }}
                      type="text" inputMode="text" autoComplete="off" autoCorrect="off"
                      autoCapitalize="characters" spellCheck={false}
                      aria-label={`Zeile ${r + 1}, Spalte ${c + 1}`}
                      value={letters[id] ?? ''}
                      readOnly={isRevealed}
                      onMouseDown={() => handleSelectCell(cell)}
                      onChange={e => {
                        const before = letters[id] ?? ''
                        const raw = e.target.value
                        const added = raw.startsWith(before) ? raw.slice(before.length) : raw
                        focus(handleLetter(cell, added))
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Backspace') { e.preventDefault(); focus(handleBackspace(cell)) }
                        else if (e.key === 'ArrowRight') { e.preventDefault(); focus(handleArrow(cell, 'across', 1)) }
                        else if (e.key === 'ArrowLeft') { e.preventDefault(); focus(handleArrow(cell, 'across', -1)) }
                        else if (e.key === 'ArrowDown') { e.preventDefault(); focus(handleArrow(cell, 'down', 1)) }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); focus(handleArrow(cell, 'down', -1)) }
                      }}
                      style={{
                        width: '100%', height: '100%', boxSizing: 'border-box',
                        border,
                        borderRadius: 0,
                        background: bg,
                        color: ink,
                        textAlign: 'center',
                        fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif",
                        textTransform: 'uppercase',
                        fontSize: 'clamp(13px, 4vw, 27px)',
                        fontWeight: 700,
                        caretColor: 'transparent',
                        outline: 'none',
                        cursor: 'pointer',
                        // globals.css fades input backgrounds; the check result
                        // has to land the instant the button is pressed.
                        transition: 'none',
                      }}
                    />
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="mt-4 min-h-[3.5rem] rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          {activeWord ? (
            <>
              <p className="font-mono-ui text-[0.65rem] uppercase tracking-[0.2em] text-zinc-500">
                {activeWord.direction === 'across' ? 'Waagerecht' : 'Senkrecht'} · {activeWord.answer.length} Buchstaben
              </p>
              <p className="mt-1 text-sm text-zinc-100">{activeWord.clue}</p>
            </>
          ) : (
            <p className="text-sm text-zinc-500">Feld antippen, um die Frage zu lesen.</p>
          )}
        </div>

        <p className="mt-4 text-center font-mono-ui text-[0.62rem] uppercase tracking-[0.18em] text-zinc-600">
          Pfeiltasten wechseln das Feld · Feld erneut antippen dreht die Richtung
        </p>
      </div>
    </div>
  )
}
