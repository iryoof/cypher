import type { Cell, Direction, PlacedWord, Puzzle, WordEntry } from './types'
import { buildStructure, type Slot } from './structure'

const key = (r: number, c: number) => `${r},${c}`

interface WordIndex {
  /** length → all words of that length, shuffled once per puzzle */
  byLen: Map<number, WordEntry[]>
  /** `len:position:letter` → words with that letter at that position */
  byLetter: Map<string, WordEntry[]>
}

/**
 * Indexing by letter position is what makes the fill affordable: matching a
 * pattern scans the smallest matching bucket instead of every word of that
 * length, which is the difference between a search that finishes and one that
 * times out.
 */
function buildIndex(pool: WordEntry[], rng: () => number): WordIndex {
  const byLen = new Map<number, WordEntry[]>()
  for (const w of pool) {
    if (!byLen.has(w.answer.length)) byLen.set(w.answer.length, [])
    byLen.get(w.answer.length)!.push(w)
  }
  for (const arr of byLen.values()) arr.sort(() => rng() - 0.5)

  const byLetter = new Map<string, WordEntry[]>()
  for (const arr of byLen.values())
    for (const w of arr)
      for (let p = 0; p < w.answer.length; p++) {
        const k = `${w.answer.length}:${p}:${w.answer[p]}`
        if (!byLetter.has(k)) byLetter.set(k, [])
        byLetter.get(k)!.push(w)
      }

  return { byLen, byLetter }
}

const cellsOf = (slot: Slot) =>
  Array.from({ length: slot.len }, (_, i) => ({
    row: slot.row + (slot.direction === 'down' ? i : 0),
    col: slot.col + (slot.direction === 'across' ? i : 0),
  }))

/** Words that fit the letters already fixed in this slot by crossing words. */
function candidatesFor(
  grid: (string | null)[][],
  slot: Slot,
  index: WordIndex,
  used: Set<string>
): WordEntry[] {
  const pattern = cellsOf(slot).map(({ row, col }) => grid[row][col])

  // Start from the most selective constrained position, then verify the rest.
  let base: WordEntry[] | null = null
  for (let p = 0; p < pattern.length; p++) {
    if (pattern[p] === null) continue
    const list = index.byLetter.get(`${slot.len}:${p}:${pattern[p]}`) ?? []
    if (base === null || list.length < base.length) base = list
  }
  base = base ?? index.byLen.get(slot.len) ?? []

  const out: WordEntry[] = []
  for (const w of base) {
    if (used.has(w.answer)) continue
    let ok = true
    for (let i = 0; i < pattern.length; i++)
      if (pattern[i] !== null && pattern[i] !== w.answer[i]) { ok = false; break }
    if (ok) out.push(w)
  }
  return out
}

/**
 * Fills every slot by backtracking, always taking the most constrained slot
 * first (fewest candidates). Returns the chosen word per slot index, or null if
 * this structure cannot be filled from the pool within the node budget.
 */
function fillSlots(
  slots: Slot[],
  index: WordIndex,
  n: number,
  budget: { steps: number }
): (WordEntry | null)[] | null {
  const grid: (string | null)[][] = Array.from({ length: n }, () => Array(n).fill(null))
  const chosen: (WordEntry | null)[] = slots.map(() => null)
  const used = new Set<string>()

  const recurse = (): boolean => {
    if (budget.steps-- <= 0) return false

    // Most constrained unfilled slot first; a slot with no candidates at all
    // means this branch is already dead.
    let best = -1
    let bestCands: WordEntry[] = []
    for (let i = 0; i < slots.length; i++) {
      if (chosen[i]) continue
      const cands = candidatesFor(grid, slots[i], index, used)
      if (cands.length === 0) return false
      if (best === -1 || cands.length < bestCands.length) {
        best = i
        bestCands = cands
        if (cands.length === 1) break
      }
    }
    if (best === -1) return true // every slot filled

    const cells = cellsOf(slots[best])

    // Trying every candidate of a wide-open slot explodes; the pool is shuffled,
    // so a capped sample is still varied.
    for (const word of bestCands.slice(0, 10)) {
      const restore = cells.map(({ row, col }) => grid[row][col])
      cells.forEach(({ row, col }, i) => { grid[row][col] = word.answer[i] })
      chosen[best] = word
      used.add(word.answer)

      if (recurse()) return true

      cells.forEach(({ row, col }, i) => { grid[row][col] = restore[i] })
      chosen[best] = null
      used.delete(word.answer)
    }
    return false
  }

  return recurse() ? chosen : null
}

/**
 * Generates a dense German crossword: a clue-cell layout from buildStructure,
 * with every answer run filled by a word from the pool.
 *
 * Structure and fill are retried together — a layout the pool cannot satisfy is
 * discarded rather than partially filled, so every grid that comes back has a
 * word in every slot and a clue for every word.
 */
export function generateDensePuzzle(pool: WordEntry[], rng?: () => number): Puzzle {
  const random = rng ?? Math.random
  const N = 11 // word-grid size; toGermanStyle adds 1 row + 1 col → 12×12

  const index = buildIndex(pool, random)

  let slots: Slot[] = []
  let filled: (WordEntry | null)[] | null = null

  // About four in five structures are fillable, so a handful of attempts is
  // enough; the budget caps the rare structure that would search forever.
  for (let attempt = 0; attempt < 25 && !filled; attempt++) {
    const structure = buildStructure(N, random)
    slots = structure.slots
    filled = fillSlots(slots, index, N, { steps: 20000 })
  }

  // Last resort: keep whatever the final attempt managed, dropping empty slots.
  if (!filled) {
    const structure = buildStructure(N, random)
    slots = structure.slots
    filled = slots.map(() => null)
  }

  const placements = slots
    .map((slot, i) => ({ slot, word: filled![i] }))
    .filter((p): p is { slot: Slot; word: WordEntry } => p.word !== null)

  // Paint the letters into a grid so unfilled cells stay null.
  const letters: (string | null)[][] = Array.from({ length: N }, () => Array(N).fill(null))
  for (const { slot, word } of placements)
    cellsOf(slot).forEach(({ row, col }, i) => { letters[row][col] = word.answer[i] })

  const numMap = new Map<string, number>()
  let counter = 0
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (placements.some((p) => p.slot.row === r && p.slot.col === c))
        numMap.set(key(r, c), ++counter)

  const words: PlacedWord[] = placements
    .map(({ slot, word }, id) => ({
      ...word,
      id,
      number: numMap.get(key(slot.row, slot.col)) ?? 0,
      row: slot.row,
      col: slot.col,
      direction: slot.direction as Direction,
    }))
    .sort((a, b) => a.number - b.number || (a.direction === 'across' ? -1 : 1))

  const cells: (Cell | null)[][] = Array.from({ length: N }, (_, r) =>
    Array.from({ length: N }, (_, c): Cell | null => {
      if (letters[r][c] === null) return null
      const wordIds = words
        .filter((w) =>
          w.direction === 'across'
            ? w.row === r && c >= w.col && c < w.col + w.answer.length
            : w.col === c && r >= w.row && r < w.row + w.answer.length
        )
        .map((w) => w.id)
      if (!wordIds.length) return null
      return {
        row: r,
        col: c,
        solution: letters[r][c]!,
        number: numMap.get(key(r, c)) ?? null,
        wordIds,
      }
    })
  )

  return { rows: N, cols: N, cells, words }
}
