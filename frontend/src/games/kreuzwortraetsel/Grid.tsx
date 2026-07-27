import { useEffect, useRef } from 'react'
import type { AnswerGridCell, Direction, GermanPuzzle, Position } from './types'

interface GridProps {
  puzzle: GermanPuzzle
  letters: Record<string, string>
  revealedCells: Set<string>
  wrongCells: Set<string>
  activeWordId: number | null
  cursor: Position | null
  onSelectCell: (cell: AnswerGridCell) => void
  onLetter: (cell: AnswerGridCell, letter: string) => Position | null
  onBackspace: (cell: AnswerGridCell) => Position | null
  onArrow: (cell: AnswerGridCell, direction: Direction, delta: -1 | 1) => Position | null
}

export const cellKey = (row: number, col: number) => `${row},${col}`

const MIN_CELL = '1.9rem'

export default function Grid({
  puzzle,
  letters,
  revealedCells,
  wrongCells,
  activeWordId,
  cursor,
  onSelectCell,
  onLetter,
  onBackspace,
  onArrow,
}: GridProps) {
  const inputs = useRef(new Map<string, HTMLInputElement>())

  const focusCell = (position: Position | null) => {
    if (!position) return
    inputs.current.get(cellKey(position.row, position.col))?.focus()
  }

  useEffect(() => {
    if (!cursor) return
    const input = inputs.current.get(cellKey(cursor.row, cursor.col))
    if (input && document.activeElement !== input) input.focus()
  }, [cursor])

  const activeCells = new Set<string>()
  const activeWord = puzzle.words.find((w) => w.id === activeWordId) ?? null
  if (activeWord) {
    const dr = activeWord.direction === 'down' ? 1 : 0
    const dc = activeWord.direction === 'across' ? 1 : 0
    for (let i = 0; i < activeWord.answer.length; i++) {
      activeCells.add(cellKey(activeWord.row + dr * i, activeWord.col + dc * i))
    }
  }

  return (
    <div style={{ overflowX: 'auto', margin: '0 -4px', padding: '0 4px' }}>
      <div
        role="grid"
        aria-label="Kreuzworträtsel"
        style={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: `repeat(${puzzle.cols}, minmax(${MIN_CELL}, 1fr))`,
          width: `min(100%, ${puzzle.cols * 2.8}rem)`,
          minWidth: `calc(${puzzle.cols} * (${MIN_CELL} + 2px))`,
          margin: '0 auto',
        }}
      >
        {puzzle.cells.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const id = cellKey(rowIndex, colIndex)

            if (!cell) {
              return (
                <div
                  key={id}
                  style={{ aspectRatio: '1', background: '#060606', borderRadius: 2 }}
                />
              )
            }

            if (cell.kind === 'clue') {
              const hasBoth = cell.entries.length >= 2
              const cellStyle: React.CSSProperties = {
                aspectRatio: '1',
                background: '#f0ede2',
                border: '2px solid #2a2a2a',
                borderRadius: 2,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                userSelect: 'none',
                cursor: 'default',
              }
              const entryStyle = (borderBottom: boolean): React.CSSProperties => ({
                flex: 1,
                padding: '2px 3px',
                borderBottom: borderBottom ? '1px solid #ccc9b5' : 'none',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                position: 'relative',
                fontSize: 'clamp(4.5px, 1.4vw, 7px)',
                fontWeight: 700,
                color: '#111',
                lineHeight: 1.2,
              })
              const arrowStyle: React.CSSProperties = {
                position: 'absolute',
                bottom: 2,
                right: 3,
                fontSize: 'clamp(6px, 1.8vw, 10px)',
                fontWeight: 900,
                lineHeight: 1,
              }

              return (
                <div key={id} style={cellStyle}>
                  {cell.entries.map((entry, i) => (
                    <div key={i} style={entryStyle(hasBoth && i === 0)}>
                      <span style={{ paddingRight: '0.8em' }}>{entry.clue}</span>
                      <span style={arrowStyle}>
                        {entry.direction === 'across' ? '▶' : '▼'}
                      </span>
                    </div>
                  ))}
                </div>
              )
            }

            // Answer cell
            const isActive = activeCells.has(id)
            const isCursor = cursor?.row === rowIndex && cursor?.col === colIndex
            const isRevealed = revealedCells.has(id)
            const isWrong = wrongCells.has(id)

            let bg = '#ffffff'
            let border = '2px solid #999'
            let color = '#111'

            if (isWrong) {
              bg = '#fff0f0'; border = '2px solid #f87171'; color = '#b91c1c'
            } else if (isRevealed) {
              bg = '#f0fdf4'; border = '2px solid #4ade80'; color = '#166534'
            } else if (isCursor) {
              bg = '#dbeafe'; border = '2px solid #3b82f6'
            } else if (isActive) {
              bg = '#f0f4ff'; border = '2px solid #93c5fd'
            }

            return (
              <div key={id} style={{ aspectRatio: '1', position: 'relative' }}>
                {cell.number !== null && (
                  <span
                    style={{
                      position: 'absolute',
                      left: 2,
                      top: 1,
                      zIndex: 10,
                      fontSize: 'clamp(4.5px, 1.3vw, 7.5px)',
                      fontWeight: 700,
                      color: '#555',
                      pointerEvents: 'none',
                      fontFamily: 'monospace',
                      lineHeight: 1,
                    }}
                  >
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
                  style={{
                    width: '100%',
                    height: '100%',
                    border,
                    background: bg,
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    textTransform: 'uppercase',
                    fontSize: 'clamp(0.65rem, 2.8vw, 1rem)',
                    fontWeight: 700,
                    color,
                    caretColor: 'transparent',
                    outline: 'none',
                    cursor: 'pointer',
                    borderRadius: 2,
                    transition: 'background 0.12s, border-color 0.12s',
                  }}
                  onMouseDown={() => onSelectCell(cell)}
                  onChange={(event) => {
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
