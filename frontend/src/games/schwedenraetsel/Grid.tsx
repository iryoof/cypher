import { useEffect, useRef } from 'react'
import type {
  ArrowType,
  Cell,
  ClueSlot,
  Direction,
  PlacedWord,
  Position,
  Puzzle
} from './types'

interface GridProps {
  puzzle: Puzzle
  letters: Record<string, string>
  revealedCells: Set<string>
  wrongCells: Set<string>
  activeWord: PlacedWord | null
  solvedWordIds: Set<number>
  cursor: Position | null
  onSelectCell: (cell: Cell) => void
  onSelectClue: (wordId: number) => void
  /** Handlers return the cell the caret should move to, or null to stay put. */
  onLetter: (cell: Cell, letter: string) => Position | null
  onBackspace: (cell: Cell) => Position | null
  onArrow: (cell: Cell, direction: Direction, delta: -1 | 1) => Position | null
}

export const cellKey = (row: number, col: number) => `${row},${col}`

/**
 * Smallest a cell may get before the grid starts scrolling instead. A
 * Schwedenrätsel needs more room than a numbered crossword: the question has to
 * be readable inside its field.
 */
const MIN_CELL = '2.6rem'
const MAX_CELL = '4.2rem'

/**
 * Questions are set as small as they have to be to fit their field. Two
 * questions share a field, so each gets half the height — the sizes are picked
 * per bucket rather than measured, which is enough because a field is always
 * square and the text always wraps.
 */
const clueFontSize = (clue: string, slotCount: number): string => {
  const budget = slotCount > 1 ? clue.length * 2 : clue.length
  if (budget <= 14) return '0.48rem'
  if (budget <= 22) return '0.42rem'
  if (budget <= 34) return '0.37rem'
  if (budget <= 48) return '0.33rem'
  return '0.29rem'
}

/**
 * The arrow glyphs. Straight arrows point at the cell next to the field, the
 * bent ones go one cell on and turn — that is what lets a question sit beside
 * its word instead of only before it.
 */
const ARROW_GLYPH: Record<ArrowType, string> = {
  right: '▶',
  down: '▼',
  downRight: '↳',
  rightDown: '⤵'
}

/** Which side of the field an arrow leaves from. */
const arrowEdge = (arrow: ArrowType): 'right' | 'bottom' =>
  arrow === 'right' || arrow === 'rightDown' ? 'right' : 'bottom'

export default function Grid({
  puzzle,
  letters,
  revealedCells,
  wrongCells,
  activeWord,
  solvedWordIds,
  cursor,
  onSelectCell,
  onSelectClue,
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

  // Covers the moves that do not originate from a letter cell, such as tapping
  // a question in the grid.
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

  /**
   * Arrows are drawn on the field, not inside the question, so a question in
   * the upper half can still point out of the bottom edge. Two arrows leaving
   * the same edge are pulled apart, otherwise they would sit on top of each
   * other.
   */
  const renderArrow = (slot: ClueSlot, siblings: ClueSlot[]) => {
    const edge = arrowEdge(slot.arrow)
    const sameEdge = siblings.filter((other) => arrowEdge(other.arrow) === edge)
    const offset =
      sameEdge.length > 1 ? `${30 + sameEdge.indexOf(slot) * 40}%` : '50%'
    const isActive = activeWord?.id === slot.wordId

    return (
      <span
        key={`arrow-${slot.wordId}`}
        aria-hidden
        className={[
          'pointer-events-none absolute z-10 text-[0.55rem] leading-none',
          isActive ? 'text-white' : 'text-white/60',
          edge === 'right' ? 'right-0 -translate-y-1/2' : 'bottom-0 -translate-x-1/2'
        ].join(' ')}
        style={edge === 'right' ? { top: offset } : { left: offset }}
      >
        {ARROW_GLYPH[slot.arrow]}
      </span>
    )
  }

  const renderClueSlot = (slot: ClueSlot, slotCount: number) => {
    const isActive = activeWord?.id === slot.wordId
    const isSolved = solvedWordIds.has(slot.wordId)

    return (
      <button
        key={slot.wordId}
        type="button"
        title={`${slot.clue} (${slot.answerLength})`}
        onClick={() => onSelectClue(slot.wordId)}
        className={[
          'relative min-h-0 flex-1 px-[2px] py-0 text-left leading-[1.08]',
          'transition-colors hyphens-auto break-words',
          slotCount > 1 ? 'first:border-b first:border-white/10' : '',
          isActive
            ? 'bg-white/[0.16] text-white'
            : isSolved
              ? 'text-white/35'
              : 'text-white/75 hover:bg-white/[0.06]'
        ].join(' ')}
        style={{ fontSize: clueFontSize(slot.clue, slotCount) }}
        lang="de"
      >
        {/* The question is clipped rather than allowed to spill into the
            neighbouring cells; the full text is repeated below the grid. */}
        <span
          className={[
            'block h-full overflow-hidden',
            isSolved ? 'line-through decoration-white/40' : ''
          ].join(' ')}
        >
          {slot.clue}
        </span>
      </button>
    )
  }

  return (
    // Cells never shrink below MIN_CELL so questions stay readable and cells
    // stay tappable; if the grid then no longer fits, it scrolls inside this
    // container rather than pushing the whole page sideways.
    <div className="-mx-1 overflow-x-auto px-1">
      <div
        className="mx-auto grid gap-[2px]"
        style={{
          gridTemplateColumns: `repeat(${puzzle.cols}, minmax(${MIN_CELL}, 1fr))`,
          width: `min(100%, calc(${puzzle.cols} * ${MAX_CELL}))`,
          minWidth: `calc(${puzzle.cols} * (${MIN_CELL} + 2px))`
        }}
        role="grid"
        aria-label="Schwedenrätsel"
      >
        {Array.from({ length: puzzle.rows }, (_, rowIndex) =>
          Array.from({ length: puzzle.cols }, (_, colIndex) => {
            const id = cellKey(rowIndex, colIndex)
            const clueCell = puzzle.clues[rowIndex][colIndex]

            if (clueCell) {
              return (
                <div
                  key={id}
                  className="relative flex aspect-square flex-col rounded-[3px] border border-white/[0.12] bg-white/[0.09]"
                >
                  {clueCell.slots.map((slot) => renderClueSlot(slot, clueCell.slots.length))}
                  {clueCell.slots.map((slot) => renderArrow(slot, clueCell.slots))}
                </div>
              )
            }

            const cell = puzzle.cells[rowIndex][colIndex]
            if (!cell) {
              // A field without a question: the pool is not rich enough to give
              // every dark cell a word, so it stays a plain block.
              return <div key={id} className="aspect-square rounded-[3px] bg-white/[0.05]" />
            }

            const isActive = activeCells.has(id)
            const isCursor = cursor?.row === rowIndex && cursor?.col === colIndex
            const isRevealed = revealedCells.has(id)
            const isWrong = wrongCells.has(id)

            return (
              <div key={id} className="relative aspect-square">
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
                    'text-[clamp(0.8rem,3.4vw,1.15rem)] leading-none caret-transparent',
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
