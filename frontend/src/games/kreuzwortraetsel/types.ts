export type Direction = 'across' | 'down'

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
  /** Number printed in the first cell, shared between an across and a down word. */
  number: number
  row: number
  col: number
  direction: Direction
}

export interface Cell {
  row: number
  col: number
  solution: string
  /** Printed in the top-left corner when this cell starts at least one word. */
  number: number | null
  /** Ids of the words running through this cell (one or two). */
  wordIds: number[]
}

export interface Puzzle {
  rows: number
  cols: number
  /** `null` marks a blocked cell. Indexed [row][col]. */
  cells: (Cell | null)[][]
  words: PlacedWord[]
}

// ── German-style grid (clues inside cells) ──────────────────────────────────

export interface ClueCellEntry {
  clue: string
  direction: Direction
  wordId: number
}

export interface ClueGridCell {
  kind: 'clue'
  row: number
  col: number
  entries: ClueCellEntry[]
}

export interface AnswerGridCell extends Cell {
  kind: 'answer'
}

export type GermanCell = ClueGridCell | AnswerGridCell | null

export interface GermanPuzzle {
  rows: number
  cols: number
  cells: GermanCell[][]
  words: PlacedWord[]
}

// ────────────────────────────────────────────────────────────────────────────

export type Difficulty = 'klein' | 'mittel' | 'gross'

export interface DifficultyPreset {
  label: string
  /** Upper bound for the grid, the generator stays inside it. */
  maxSize: number
  targetWords: number
}

export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyPreset> = {
  klein: { label: 'Klein', maxSize: 11, targetWords: 12 },
  mittel: { label: 'Mittel', maxSize: 15, targetWords: 22 },
  gross: { label: 'Gross', maxSize: 19, targetWords: 34 }
}
