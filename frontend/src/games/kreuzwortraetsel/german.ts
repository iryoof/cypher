import type {
  AnswerGridCell,
  ClueCellEntry,
  ClueGridCell,
  GermanCell,
  GermanPuzzle,
  Puzzle,
} from './types'

/**
 * Converts a standard crossword puzzle to the German Kreuzworträtsel style
 * where clue text lives inside dedicated grid cells (with directional arrows)
 * rather than in a separate numbered list.
 *
 * The grid grows by one row on top and one column on the left so that words
 * that start at the original border still have room for their clue cell.
 */
export function toGermanStyle(puzzle: Puzzle): GermanPuzzle {
  const rows = puzzle.rows + 1
  const cols = puzzle.cols + 1

  // All words shift by (+1 row, +1 col) to make room for the new border.
  const words = puzzle.words.map((word) => ({
    ...word,
    row: word.row + 1,
    col: word.col + 1,
  }))

  const cells: GermanCell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, (): GermanCell => null)
  )

  // Copy answer cells, shifted by (1, 1).
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      const cell = puzzle.cells[r][c]
      if (!cell) continue
      const answerCell: AnswerGridCell = {
        kind: 'answer',
        row: r + 1,
        col: c + 1,
        solution: cell.solution,
        number: cell.number,
        wordIds: cell.wordIds,
      }
      cells[r + 1][c + 1] = answerCell
    }
  }

  // Inject clue cells.  In a valid crossword the cell immediately before a
  // word's start (in the word's direction) is always null or out-of-bounds, so
  // converting it to a clue cell is always safe.  Two words can share a clue
  // cell (double-clue) when an across word and a down word happen to point at
  // the same position.
  for (const word of words) {
    const clueRow = word.direction === 'down' ? word.row - 1 : word.row
    const clueCol = word.direction === 'across' ? word.col - 1 : word.col

    const entry: ClueCellEntry = {
      clue: word.clue,
      direction: word.direction,
      wordId: word.id,
    }

    const existing = cells[clueRow]?.[clueCol]
    if (existing === null || existing === undefined) {
      const clueCell: ClueGridCell = {
        kind: 'clue',
        row: clueRow,
        col: clueCol,
        entries: [entry],
      }
      cells[clueRow][clueCol] = clueCell
    } else if (existing.kind === 'clue') {
      existing.entries.push(entry)
    }
    // If existing is an answer cell the generator produced an unusual layout;
    // we leave the answer cell in place and skip this clue — the word will
    // still be playable.
  }

  // Sort double-clue entries: down first (top half), across second (bottom).
  for (const row of cells) {
    for (const cell of row) {
      if (cell?.kind === 'clue' && cell.entries.length > 1) {
        cell.entries.sort((a) => (a.direction === 'down' ? -1 : 1))
      }
    }
  }

  return { rows, cols, cells, words }
}
