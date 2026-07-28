import type {
  AnswerGridCell,
  ClueCellEntry,
  ClueGridCell,
  GermanCell,
  GermanPuzzle,
  PlacedWord,
  WordEntry,
} from './types'
import { cellsOfSlot, slotsOf } from './structure'

/**
 * A pre-generated layout. `grid` is 144 characters, row-major, '#' for a clue
 * cell and '.' for an answer cell; `answers` holds one solution per slot in the
 * order slotsOf() returns them.
 *
 * Puzzles are generated ahead of time because filling a grid with no empty cells
 * means nearly every cell carries both an across and a down word, and searching
 * for such a fill takes seconds — far too slow to do while the page loads. The
 * clue text is not stored: it is looked up from the word pool by answer.
 */
export interface StoredPuzzle {
  grid: string
  answers: string[]
}

const SIZE = 12

export function parseGrid(grid: string): boolean[][] {
  return Array.from({ length: SIZE }, (_, r) =>
    Array.from({ length: SIZE }, (_, c) => grid[r * SIZE + c] === '#')
  )
}

export function serialiseGrid(isClue: boolean[][]): string {
  return isClue.map((row) => row.map((x) => (x ? '#' : '.')).join('')).join('')
}

/** Rebuilds a playable puzzle from a stored layout plus the word pool. */
export function loadPuzzle(stored: StoredPuzzle, pool: WordEntry[]): GermanPuzzle {
  const clueOf = new Map(pool.map((w) => [w.answer, w.clue]))
  const categoryOf = new Map(pool.map((w) => [w.answer, w.category]))

  const isClue = parseGrid(stored.grid)
  const slots = slotsOf(isClue, SIZE)

  const numMap = new Map<string, number>()
  let counter = 0
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (slots.some((s) => s.row === r && s.col === c)) numMap.set(`${r},${c}`, ++counter)

  const words: PlacedWord[] = slots
    .map((slot, i) => {
      const answer = stored.answers[i]
      return {
        answer,
        clue: clueOf.get(answer) ?? answer,
        category: categoryOf.get(answer) ?? '',
        id: i,
        number: numMap.get(`${slot.row},${slot.col}`) ?? 0,
        row: slot.row,
        col: slot.col,
        direction: slot.direction,
      }
    })
    .sort((a, b) => a.number - b.number || (a.direction === 'across' ? -1 : 1))

  const cells: GermanCell[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(null))

  for (const word of words) {
    const dr = word.direction === 'down' ? 1 : 0
    const dc = word.direction === 'across' ? 1 : 0
    for (let i = 0; i < word.answer.length; i++) {
      const r = word.row + dr * i
      const c = word.col + dc * i
      const existing = cells[r][c]
      if (existing?.kind === 'answer') {
        existing.wordIds.push(word.id)
      } else {
        const answerCell: AnswerGridCell = {
          kind: 'answer',
          row: r,
          col: c,
          solution: word.answer[i],
          number: numMap.get(`${r},${c}`) ?? null,
          wordIds: [word.id],
        }
        cells[r][c] = answerCell
      }
    }
  }

  for (const word of words) {
    const r = word.direction === 'down' ? word.row - 1 : word.row
    const c = word.direction === 'across' ? word.col - 1 : word.col
    const entry: ClueCellEntry = { clue: word.clue, direction: word.direction, wordId: word.id }
    const existing = cells[r][c]
    if (existing === null) {
      const clueCell: ClueGridCell = { kind: 'clue', row: r, col: c, entries: [entry] }
      cells[r][c] = clueCell
    } else if (existing.kind === 'clue') {
      existing.entries.push(entry)
    }
  }

  // Across clue on top, down clue below — each half must sit next to its own
  // arrow. The ▶ is on the right edge beside the top half, the ▼ on the bottom
  // edge beneath the lower half; the other order pairs every question with the
  // wrong arrow.
  for (const row of cells)
    for (const cell of row)
      if (cell?.kind === 'clue' && cell.entries.length > 1)
        cell.entries.sort((a) => (a.direction === 'across' ? -1 : 1))

  return { rows: SIZE, cols: SIZE, cells, words }
}

/** Unused cells never happen in a generated puzzle; this proves it at load time. */
export function countEmptyCells(puzzle: GermanPuzzle): number {
  let empty = 0
  for (const row of puzzle.cells)
    for (const cell of row)
      if (!cell || (cell.kind === 'clue' && cell.entries.length === 0)) empty++
  return empty
}

export { cellsOfSlot }
