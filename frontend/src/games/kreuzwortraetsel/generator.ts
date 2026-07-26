import type { Cell, Direction, PlacedWord, Puzzle, WordEntry } from './types'

/**
 * Crossword layout generator.
 *
 * Words are placed on a sparse, unbounded map of cells and the grid is cropped
 * to its bounding box at the very end. That avoids having to guess a good grid
 * size up front: the puzzle is only as large as the words that actually fit,
 * and `maxSize` is enforced by rejecting placements that would grow the
 * bounding box beyond it.
 */

const key = (row: number, col: number) => `${row},${col}`

/** Mulberry32 — small seeded PRNG so a puzzle can be reproduced from its seed. */
const createRandom = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const shuffle = <T,>(items: T[], random: () => number): T[] => {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

interface Placement {
  word: WordEntry
  row: number
  col: number
  direction: Direction
}

interface Bounds {
  minRow: number
  maxRow: number
  minCol: number
  maxCol: number
}

const step = (direction: Direction): [number, number] =>
  direction === 'across' ? [0, 1] : [1, 0]

/** The two cells to either side of a cell, perpendicular to the word. */
const sideCells = (row: number, col: number, direction: Direction): [number, number][] =>
  direction === 'across'
    ? [
        [row - 1, col],
        [row + 1, col]
      ]
    : [
        [row, col - 1],
        [row, col + 1]
      ]

/**
 * A placement is legal when it does not contradict letters already on the
 * board and does not accidentally create a second word by running alongside
 * an existing one. Concretely:
 *
 * - every overlapping cell must carry the same letter;
 * - a cell we newly fill must have empty neighbours to its sides, otherwise it
 *   would extend a perpendicular word;
 * - the cells just before and just after the word must be empty, otherwise it
 *   would merge with a neighbouring word.
 */
const canPlace = (
  occupied: Map<string, string>,
  placement: Placement,
  maxSize: number,
  bounds: Bounds
): boolean => {
  const { word, row, col, direction } = placement
  const [dr, dc] = step(direction)
  const length = word.answer.length

  const endRow = row + dr * (length - 1)
  const endCol = col + dc * (length - 1)

  // Reject anything that would push the puzzle past the size limit.
  const height = Math.max(bounds.maxRow, endRow, row) - Math.min(bounds.minRow, row, endRow) + 1
  const width = Math.max(bounds.maxCol, endCol, col) - Math.min(bounds.minCol, col, endCol) + 1
  if (height > maxSize || width > maxSize) return false

  // The cell before the start and after the end must stay empty.
  if (occupied.has(key(row - dr, col - dc))) return false
  if (occupied.has(key(endRow + dr, endCol + dc))) return false

  let intersections = 0

  for (let i = 0; i < length; i++) {
    const r = row + dr * i
    const c = col + dc * i
    const existing = occupied.get(key(r, c))

    if (existing !== undefined) {
      if (existing !== word.answer[i]) return false
      intersections++
      continue
    }

    for (const [sr, sc] of sideCells(r, c, direction)) {
      if (occupied.has(key(sr, sc))) return false
    }
  }

  return intersections > 0
}

/** Every way `word` could cross one of the letters already on the board. */
const candidatePlacements = (
  letterPositions: Map<string, [number, number, Direction][]>,
  word: WordEntry
): Placement[] => {
  const placements: Placement[] = []

  for (let i = 0; i < word.answer.length; i++) {
    const positions = letterPositions.get(word.answer[i])
    if (!positions) continue

    for (const [row, col, existingDirection] of positions) {
      // Cross the existing word, so run perpendicular to it.
      const direction: Direction = existingDirection === 'across' ? 'down' : 'across'
      const [dr, dc] = step(direction)
      placements.push({ word, row: row - dr * i, col: col - dc * i, direction })
    }
  }

  return placements
}

export interface GenerateOptions {
  maxSize: number
  targetWords: number
  seed?: number
}

/**
 * Builds a puzzle from `pool`. The pool is expected to be far larger than
 * `targetWords`; the generator walks it in random order and keeps whatever
 * fits, so every run produces a different puzzle.
 */
export const generatePuzzle = (pool: WordEntry[], options: GenerateOptions): Puzzle => {
  const { maxSize, targetWords } = options
  const seed = options.seed ?? Math.floor(Math.random() * 0xffffffff)
  const random = createRandom(seed)

  const usable = pool.filter(
    (entry) => entry.answer.length >= 3 && entry.answer.length <= maxSize
  )

  // Longer words first: they create more crossing opportunities, which keeps
  // the grid dense instead of stringing short words into a chain.
  const candidates = shuffle(usable, random).sort((a, b) => {
    const lengthDelta = b.answer.length - a.answer.length
    return lengthDelta !== 0 ? lengthDelta : random() - 0.5
  })

  const occupied = new Map<string, string>()
  const letterPositions = new Map<string, [number, number, Direction][]>()
  const placed: Placement[] = []
  const usedAnswers = new Set<string>()
  let bounds: Bounds = { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 }

  const commit = (placement: Placement) => {
    const { word, row, col, direction } = placement
    const [dr, dc] = step(direction)

    for (let i = 0; i < word.answer.length; i++) {
      const r = row + dr * i
      const c = col + dc * i
      occupied.set(key(r, c), word.answer[i])
      const letter = word.answer[i]
      if (!letterPositions.has(letter)) letterPositions.set(letter, [])
      letterPositions.get(letter)!.push([r, c, direction])
      bounds = {
        minRow: Math.min(bounds.minRow, r),
        maxRow: Math.max(bounds.maxRow, r),
        minCol: Math.min(bounds.minCol, c),
        maxCol: Math.max(bounds.maxCol, c)
      }
    }

    placed.push(placement)
    usedAnswers.add(word.answer)
  }

  // Seed the grid with the first usable word, laid out horizontally.
  const first = candidates.find((entry) => entry.answer.length <= maxSize)
  if (!first) {
    return { rows: 0, cols: 0, cells: [], words: [] }
  }
  bounds = { minRow: 0, maxRow: 0, minCol: 0, maxCol: first.answer.length - 1 }
  commit({ word: first, row: 0, col: 0, direction: 'across' })

  for (const entry of candidates) {
    if (placed.length >= targetWords) break
    if (usedAnswers.has(entry.answer)) continue

    const options = shuffle(candidatePlacements(letterPositions, entry), random)
    const legal = options.find((placement) => canPlace(occupied, placement, maxSize, bounds))
    if (legal) commit(legal)
  }

  return buildPuzzle(placed, bounds)
}

/** Crops to the bounding box and assigns the printed clue numbers. */
const buildPuzzle = (placed: Placement[], bounds: Bounds): Puzzle => {
  const rows = bounds.maxRow - bounds.minRow + 1
  const cols = bounds.maxCol - bounds.minCol + 1

  const normalised = placed.map((placement) => ({
    ...placement,
    row: placement.row - bounds.minRow,
    col: placement.col - bounds.minCol
  }))

  // Standard crossword numbering: scan row by row, and every cell that starts
  // a word gets the next number. An across and a down word starting on the
  // same cell share it.
  const startNumbers = new Map<string, number>()
  let counter = 0
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const startsHere = normalised.some(
        (placement) => placement.row === row && placement.col === col
      )
      if (startsHere) startNumbers.set(key(row, col), ++counter)
    }
  }

  const words: PlacedWord[] = normalised
    .map((placement, index) => ({
      answer: placement.word.answer,
      clue: placement.word.clue,
      category: placement.word.category,
      id: index,
      number: startNumbers.get(key(placement.row, placement.col))!,
      row: placement.row,
      col: placement.col,
      direction: placement.direction
    }))
    .sort((a, b) => a.number - b.number || (a.direction === 'across' ? -1 : 1))

  const cells: (Cell | null)[][] = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col): Cell | null => {
      const wordIds = words
        .filter((word) => {
          const [dr, dc] = step(word.direction)
          for (let i = 0; i < word.answer.length; i++) {
            if (word.row + dr * i === row && word.col + dc * i === col) return true
          }
          return false
        })
        .map((word) => word.id)

      if (wordIds.length === 0) return null

      const owner = words.find((word) => word.id === wordIds[0])!
      const [dr, dc] = step(owner.direction)
      const offset = dr === 0 ? col - owner.col : row - owner.row
      void dc

      return {
        row,
        col,
        solution: owner.answer[offset],
        number: startNumbers.get(key(row, col)) ?? null,
        wordIds
      }
    })
  )

  return { rows, cols, cells, words }
}
