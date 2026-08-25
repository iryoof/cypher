export type Direction = 'across' | 'down'

/**
 * How a question reaches its word. The straight arrows point at the cell right
 * next to the question field, the bent ones go one cell further and turn — the
 * turn is what lets a question field sit anywhere in the grid.
 */
export type ArrowType =
  /** Question left of the word, arrow points right. */
  | 'right'
  /** Question above the word, arrow points down. */
  | 'down'
  /** Question above the first letter of an across word: down, then right. */
  | 'downRight'
  /** Question left of the first letter of a down word: right, then down. */
  | 'rightDown'

export interface Position {
  row: number
  col: number
}

/** A word as it comes out of the word pool, before it has a place in a grid. */
export interface WordEntry {
  /** Solution, uppercase, umlauts already expanded (AE/OE/UE/SS). */
  answer: string
  /** The question shown to the player. */
  clue: string
  category: string
}

/** A word after the generator has placed it. */
export interface PlacedWord extends WordEntry {
  id: number
  row: number
  col: number
  direction: Direction
  /** The question field this word is asked from. */
  clueRow: number
  clueCol: number
  arrow: ArrowType
}

export interface Cell {
  row: number
  col: number
  solution: string
  /** Ids of the words running through this cell (one or two). */
  wordIds: number[]
}

/** One question inside a question field, together with the arrow it points. */
export interface ClueSlot {
  wordId: number
  direction: Direction
  arrow: ArrowType
  clue: string
  answerLength: number
}

/**
 * A question field — a dark cell in the grid. It holds one or two questions;
 * two is the normal case in a printed Schwedenrätsel.
 */
export interface ClueCell {
  row: number
  col: number
  slots: ClueSlot[]
}

/**
 * A finished puzzle. Every cell is either a letter or a question field, there
 * are no empty cells: `cells[r][c]` and `clues[r][c]` are exactly one non-null.
 */
export interface Puzzle {
  rows: number
  cols: number
  cells: (Cell | null)[][]
  clues: (ClueCell | null)[][]
  words: PlacedWord[]
}

export type Difficulty = 'klein' | 'mittel' | 'gross'

export interface DifficultyPreset {
  label: string
  /** The grid is square; question fields are part of it. */
  size: number
}

/**
 * The grid stays small: a question has to be readable inside its field, and a
 * densely filled grid needs far more short words than a loose crossword — the
 * pool runs out before a large grid does.
 */
export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyPreset> = {
  klein: { label: 'Klein', size: 7 },
  mittel: { label: 'Mittel', size: 9 },
  gross: { label: 'Gross', size: 11 }
}
