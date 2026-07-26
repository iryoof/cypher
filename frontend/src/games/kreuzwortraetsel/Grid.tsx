import { useEffect, useRef } from 'react'
import type { Cell, Direction, PlacedWord, Position, Puzzle } from './types'

interface GridProps {
  puzzle: Puzzle
  letters: Record<string, string>
  revealedCells: Set<string>
  wrongCells: Set<string>
  activeWord: PlacedWord | null
  cursor: Position | null
  onSelectCell: (cell: Cell) => void
  /** Handlers return the cell the caret should move to, or null to stay put. */
  onLetter: (cell: Cell, letter: string) => Position | null
  onBackspace: (cell: Cell) => Position | null
  onArrow: (cell: Cell, direction: Direction, delta: -1 | 1) => Position | null
}

export const cellKey = (row: number, col: number) => `${row},${col}`

/** Smallest a cell may get before the grid starts scrolling instead. */
const MIN_CELL = '1.6rem'

export default function Grid({
  puzzle,
  letters,
  revealedCells,
  wrongCells,
  activeWord,
  cursor,
  onSelectCell,
  onLetter,
  onBackspace,
  onArrow
}: GridProps) {
  const inputs = useRef(new Map<string, HTMLInputElement>())

  /**
   * Moves the DOM focus immediately rather than waiting for the cursor state to
   * come back through a render. Fast typists — and phone keyboards, which fire
   * several inputs in a row — would otherwise keep hitting the previous cell.
   */
  const focusCell = (position: Position | null) => {
    if (!position) return
    inputs.current.get(cellKey(position.row, position.col))?.focus()
  }

  // Covers the moves that do not originate from the grid itself, such as
  // picking a clue from the list.
  useEffect(() => {
    if (!cursor) return
    const input = inputs.current.get(cellKey(cursor.row, cursor.col))
    if (input && document.activeElement !== input) input.focus()
  }, [cursor])

  const activeCells = new Set<string>()
  if (activeWord) {
    const dr = activeWord.direction === 'down' ? 1 : 0
    const dc = activeWord.direction === 'across' ? 1 : 0
    for (let i = 0; i < activeWord.answer.length; i++) {
      activeCells.add(cellKey(activeWord.row + dr * i, activeWord.col + dc * i))
    }
  }

  return (
    // Cells never shrink below MIN_CELL so they stay tappable on a phone; if
    // the grid then no longer fits, it scrolls inside this container rather
    // than pushing the whole page sideways.
    <div className="-mx-1 overflow-x-auto px-1">
      <div
        className="grid gap-[2px] mx-auto"
        style={{
          gridTemplateColumns: `repeat(${puzzle.cols}, minmax(${MIN_CELL}, 1fr))`,
          width: `min(100%, ${puzzle.cols * 2.6}rem)`,
          minWidth: `calc(${puzzle.cols} * (${MIN_CELL} + 2px))`
        }}
        role="grid"
        aria-label="Kreuzworträtsel"
      >
      {puzzle.cells.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const id = cellKey(rowIndex, colIndex)

          if (!cell) {
            return <div key={id} className="aspect-square rounded-[2px] bg-white/[0.02]" />
          }

          const isActive = activeCells.has(id)
          const isCursor = cursor?.row === rowIndex && cursor?.col === colIndex
          const isRevealed = revealedCells.has(id)
          const isWrong = wrongCells.has(id)

          return (
            <div key={id} className="relative aspect-square">
              {cell.number !== null && (
                <span className="pointer-events-none absolute left-[2px] top-[1px] z-10 font-mono-ui text-[0.5rem] leading-none text-white/45">
                  {cell.number}
                </span>
              )}
              <input
                ref={(node) => {
                  if (node) inputs.current.set(id, node)
                  else inputs.current.delete(id)
                }}
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-label={`Zeile ${rowIndex + 1}, Spalte ${colIndex + 1}`}
                value={letters[id] ?? ''}
                readOnly={isRevealed}
                className={[
                  'h-full w-full rounded-[3px] border text-center font-mono-ui uppercase',
                  'text-[clamp(0.7rem,3.2vw,1.05rem)] leading-none caret-transparent',
                  'transition-colors duration-150 focus:outline-none',
                  isWrong
                    ? 'border-red-400/60 bg-red-500/15 text-red-200'
                    : isRevealed
                      ? 'border-emerald-300/40 bg-emerald-400/10 text-emerald-200'
                      : isCursor
                        ? 'border-white/70 bg-white/[0.14] text-white'
                        : isActive
                          ? 'border-white/25 bg-white/[0.08] text-white'
                          : 'border-white/10 bg-white/[0.03] text-white/90'
                ].join(' ')}
                // Selection is driven from the click rather than from focus:
                // clicking an already focused cell fires no focus event, but it
                // must still toggle between the across and the down word. The
                // native focus is deliberately left alone (no preventDefault)
                // so that tapping a cell opens the keyboard on a phone.
                onMouseDown={() => onSelectCell(cell)}
                onChange={(event) => {
                  // The field is controlled and already holds a letter, so only
                  // the part the player actually added is passed on.
                  const before = letters[id] ?? ''
                  const raw = event.target.value
                  const added = raw.startsWith(before) ? raw.slice(before.length) : raw
                  const typed = added.replace(/[^a-zA-ZäöüÄÖÜß]/g, '')
                  if (!typed) return
                  focusCell(onLetter(cell, typed))
                }}
                onKeyDown={(event) => {
                  switch (event.key) {
                    case 'Backspace':
                      event.preventDefault()
                      focusCell(onBackspace(cell))
                      break
                    case 'ArrowRight':
                      event.preventDefault()
                      focusCell(onArrow(cell, 'across', 1))
                      break
                    case 'ArrowLeft':
                      event.preventDefault()
                      focusCell(onArrow(cell, 'across', -1))
                      break
                    case 'ArrowDown':
                      event.preventDefault()
                      focusCell(onArrow(cell, 'down', 1))
                      break
                    case 'ArrowUp':
                      event.preventDefault()
                      focusCell(onArrow(cell, 'down', -1))
                      break
                    default:
                      break
                  }
                }}
              />
            </div>
          )
        })
      )}
      </div>
    </div>
  )
}
