import type { Cell, Direction, PlacedWord, Puzzle, WordEntry } from './types'

const key = (r: number, c: number) => `${r},${c}`


function groupByLength(pool: WordEntry[], rng: () => number): Map<number, WordEntry[]> {
  const m = new Map<number, WordEntry[]>()
  for (const w of pool) {
    if (!m.has(w.answer.length)) m.set(w.answer.length, [])
    m.get(w.answer.length)!.push(w)
  }
  for (const arr of m.values()) arr.sort(() => rng() - 0.5)
  return m
}

function findWord(
  byLen: Map<number, WordEntry[]>,
  len: number,
  pattern: (string | null)[],
  used: Set<string>
): WordEntry | null {
  const candidates = byLen.get(len)
  if (!candidates) return null
  for (const w of candidates) {
    if (used.has(w.answer)) continue
    let ok = true
    for (let i = 0; i < len; i++) {
      if (pattern[i] !== null && pattern[i] !== w.answer[i]) { ok = false; break }
    }
    if (ok) return w
  }
  return null
}

/**
 * Generates a dense German crossword.
 *
 * Phase 1: fill each row completely with across words separated by null
 *          separators. Words always go to the last column — no trailing null.
 *
 * Phase 2: for every contiguous run of answer cells in each column (length ≥ 3)
 *          try to place a down word that matches the already-set letters.
 *
 * Because every null in phase 1 is immediately before the next word start it
 * becomes a right-pointing clue cell in toGermanStyle. There are no isolated
 * null cells, so the final German grid has no black cells.
 */
export function generateDensePuzzle(pool: WordEntry[], rng?: () => number): Puzzle {
  const random = rng ?? Math.random
  const N = 11 // word-grid size; toGermanStyle adds 1 row+col → 12×12

  const byLen = groupByLength(pool, random)

  // grid[r][c] = letter or null (null = separator / future clue cell)
  const grid: (string | null)[][] = Array.from({ length: N }, () => Array(N).fill(null))

  const placements: { word: WordEntry; row: number; col: number; direction: Direction }[] = []
  const used = new Set<string>()

  // ── Phase 1: across words ──────────────────────────────────────────────────
  for (let r = 0; r < N; r++) {
    let col = 0
    let safety = 0
    while (col < N && safety++ < 50) {
      const remaining = N - col

      // Determine which word lengths are valid here:
      // remaining = len  (word fills exactly to the end), OR
      // remaining = len + 1 + next, where next ≥ 3  →  remaining - len ≥ 4
      const validLengths: number[] = []
      for (let len = 3; len <= Math.min(remaining, 9); len++) {
        const after = remaining - len
        if (after === 0 || after >= 4) validLengths.push(len)
      }
      // prefer longer words first for density
      validLengths.sort((a, b) => b - a)

      let placed = false
      for (const len of validLengths) {
        const pat = Array.from({ length: len }, (_, i) => grid[r][col + i])
        const w = findWord(byLen, len, pat, used)
        if (!w) continue
        for (let i = 0; i < len; i++) grid[r][col + i] = w.answer[i]
        placements.push({ word: w, row: r, col, direction: 'across' })
        used.add(w.answer)
        col += len
        if (col < N) col++ // leave null separator
        placed = true
        break
      }

      if (!placed) {
        // can't place — advance past this cell
        col++
      }
    }
  }

  // ── Phase 2: down words ────────────────────────────────────────────────────
  for (let c = 0; c < N; c++) {
    let row = 0
    while (row < N) {
      // skip nulls
      while (row < N && grid[row][c] === null) row++
      if (row >= N) break
      const start = row
      // find end of answer run
      while (row < N && grid[row][c] !== null) row++
      const len = row - start
      if (len < 3) continue

      const pattern = Array.from({ length: len }, (_, i) => grid[start + i][c])
      const w = findWord(byLen, len, pattern, used)
      if (!w) continue
      // update any still-null cells in this column run (shouldn't happen
      // since phase 1 filled them, but just in case)
      for (let i = 0; i < len; i++) {
        if (grid[start + i][c] === null) grid[start + i][c] = w.answer[i]
      }
      placements.push({ word: w, row: start, col: c, direction: 'down' })
      used.add(w.answer)
    }
  }

  // ── Build Puzzle ───────────────────────────────────────────────────────────
  // Assign clue numbers (row-major)
  const numMap = new Map<string, number>()
  let counter = 0
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (placements.some(p => p.row === r && p.col === c))
        numMap.set(key(r, c), ++counter)

  const words: PlacedWord[] = placements
    .map((p, id) => ({ ...p.word, id, number: numMap.get(key(p.row, p.col)) ?? 0, row: p.row, col: p.col, direction: p.direction }))
    .sort((a, b) => a.number - b.number || (a.direction === 'across' ? -1 : 1))

  const step = (d: Direction): [number, number] => d === 'across' ? [0, 1] : [1, 0]

  const cells: (Cell | null)[][] = Array.from({ length: N }, (_, r) =>
    Array.from({ length: N }, (_, c): Cell | null => {
      if (grid[r][c] === null) return null
      const wordIds = words.filter(w => {
        const [dr, dc] = step(w.direction)
        for (let i = 0; i < w.answer.length; i++)
          if (w.row + dr * i === r && w.col + dc * i === c) return true
        return false
      }).map(w => w.id)
      if (!wordIds.length) return null
      const owner = words.find(w => w.id === wordIds[0])!
      const [dr] = step(owner.direction)
      const offset = dr === 0 ? c - owner.col : r - owner.row
      return { row: r, col: c, solution: owner.answer[offset], number: numMap.get(key(r, c)) ?? null, wordIds }
    })
  )

  return { rows: N, cols: N, cells, words }
}
