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
  used: Set<string>,
  allowReuse = false
): WordEntry | null {
  const candidates = byLen.get(len)
  if (!candidates) return null
  for (const w of candidates) {
    if (!allowReuse && used.has(w.answer)) continue
    let ok = true
    for (let i = 0; i < len; i++) {
      if (pattern[i] !== null && pattern[i] !== w.answer[i]) { ok = false; break }
    }
    if (ok) return w
  }
  if (!allowReuse) return findWord(byLen, len, pattern, used, true)
  return null
}

/**
 * Valid row partitions for N=11 word-grid columns.
 * k words with single-null separators between them.
 * Invariant: sum(lengths) + (k-1) = 11, every length in [3,9].
 *   k=2: sum=10 → (3,7),(4,6),(5,5),(6,4),(7,3)
 *   k=3: sum=9  → (3,3,3)
 */
const ROW_PARTITIONS: number[][] = [
  [4, 6], [5, 5], [6, 4],
  [3, 7], [7, 3],
  [3, 3, 3],
]

/**
 * Generates a dense German crossword.
 *
 * Phase 1: fill each row completely using a pre-validated partition of word lengths.
 *          Every null is a single-cell separator immediately before the next word →
 *          toGermanStyle converts ALL nulls to clue cells → no orphaned black cells.
 *
 * Phase 2: for every contiguous column run of answer cells (length ≥ 3)
 *          place a down word that matches the already-set letters.
 */
export function generateDensePuzzle(pool: WordEntry[], rng?: () => number): Puzzle {
  const random = rng ?? Math.random
  const N = 11 // word-grid size; toGermanStyle adds 1 row+col → 12×12

  const byLen = groupByLength(pool, random)

  const grid: (string | null)[][] = Array.from({ length: N }, () => Array(N).fill(null))
  const placements: { word: WordEntry; row: number; col: number; direction: Direction }[] = []
  const used = new Set<string>()

  // ── Phase 1: across words ──────────────────────────────────────────────────
  for (let r = 0; r < N; r++) {
    const shuffled = [...ROW_PARTITIONS].sort(() => random() - 0.5)

    for (const partition of shuffled) {
      // Dry-run: check if we can find words for each slot
      const tempUsed = new Set(used)
      const found: WordEntry[] = []
      let ok = true

      for (const len of partition) {
        const w = findWord(byLen, len, Array(len).fill(null), tempUsed)
        if (!w) { ok = false; break }
        found.push(w)
        tempUsed.add(w.answer)
      }

      if (!ok) continue

      // Commit: write words into the grid
      let col = 0
      for (let i = 0; i < partition.length; i++) {
        const w = found[i]
        for (let j = 0; j < w.answer.length; j++) grid[r][col + j] = w.answer[j]
        placements.push({ word: w, row: r, col, direction: 'across' })
        used.add(w.answer)
        col += w.answer.length
        if (i < partition.length - 1) col++ // single null separator
      }
      break
    }
    // Extremely unlikely: all partitions failed → row stays null
  }

  // ── Phase 2: down words ────────────────────────────────────────────────────
  for (let c = 0; c < N; c++) {
    let row = 0
    while (row < N) {
      while (row < N && grid[row][c] === null) row++
      if (row >= N) break
      const start = row
      while (row < N && grid[row][c] !== null) row++
      const len = row - start
      if (len < 3) continue

      const pattern = Array.from({ length: len }, (_, i) => grid[start + i][c])
      const w = findWord(byLen, len, pattern, used)
      if (!w) continue
      placements.push({ word: w, row: start, col: c, direction: 'down' })
      used.add(w.answer)
    }
  }

  // ── Build Puzzle ───────────────────────────────────────────────────────────
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
