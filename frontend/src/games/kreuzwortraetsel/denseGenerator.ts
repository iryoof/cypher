import type {
  AnswerGridCell,
  ClueCellEntry,
  ClueGridCell,
  GermanCell,
  GermanPuzzle,
  PlacedWord,
  WordEntry,
} from './types'
import { buildStructure, cellsOfSlot, slotsOf, type Slot } from './structure'

const buildSlotsFrom = (isClue: boolean[][]) => slotsOf(isClue, N)

/** Final grid size. The structure is built at this size directly. */
const N = 12

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

/** Words that fit the letters already fixed in this slot by crossing words. */
function candidatesFor(
  grid: (string | null)[][],
  slot: Slot,
  index: WordIndex,
  used: Set<string>
): WordEntry[] {
  const pattern = cellsOfSlot(slot).map(([r, c]) => grid[r][c])

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
 * first. Returns a word per slot, or null if this layout cannot be filled from
 * the pool within the node budget — a partly filled grid would leave blanks, so
 * it is discarded rather than used.
 */
function fillSlots(
  slots: Slot[],
  index: WordIndex,
  budget: { steps: number }
): WordEntry[] | null {
  const grid: (string | null)[][] = Array.from({ length: N }, () => Array(N).fill(null))
  const chosen: (WordEntry | null)[] = slots.map(() => null)
  const used = new Set<string>()

  const recurse = (): boolean => {
    if (budget.steps-- <= 0) return false

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
    if (best === -1) return true

    const cells = cellsOfSlot(slots[best])
    for (const word of bestCands.slice(0, 10)) {
      const restore = cells.map(([r, c]) => grid[r][c])
      cells.forEach(([r, c], i) => { grid[r][c] = word.answer[i] })
      chosen[best] = word
      used.add(word.answer)

      if (recurse()) return true

      cells.forEach(([r, c], i) => { grid[r][c] = restore[i] })
      chosen[best] = null
      used.delete(word.answer)
    }
    return false
  }

  return recurse() ? (chosen as WordEntry[]) : null
}

/**
 * Searches for one fully filled 12×12 layout. Returns the clue-cell grid and one
 * answer per slot, or null if no layout worked within `attempts`.
 *
 * This is the expensive half — a grid with no empty cells has an across and a
 * down word through nearly every cell, and finding a fill takes seconds. It runs
 * offline (see scripts/generatePuzzles.ts), never in the browser.
 */
export function searchFilledLayout(
  pool: WordEntry[],
  rng: () => number,
  attempts = 250,
  steps = 4000
): { isClue: boolean[][]; answers: string[] } | null {
  const index = buildIndex(pool, rng)

  // Most layouts cannot be filled from a pool this size, and the ones that can
  // usually fall out quickly. A small step budget over many layouts finds a fill
  // far sooner than a large budget over few.
  for (let attempt = 0; attempt < attempts; attempt++) {
    const structure = buildStructure(N, rng)
    if (!structure.ok) continue
    const filled = fillSlots(structure.slots, index, { steps })
    if (filled) return { isClue: structure.isClue, answers: filled.map((w) => w.answer) }
  }
  return null
}

/**
 * Generates a complete 12×12 German crossword: clue cells carrying the
 * questions, answer cells carrying the letters, and nothing else. Every cell is
 * one or the other, so the rendered grid has no blanks.
 */
export function generateGermanPuzzle(pool: WordEntry[], rng?: () => number): GermanPuzzle {
  const random = rng ?? Math.random

  let slots: Slot[] = []
  let filled: WordEntry[] | null = null

  const found = searchFilledLayout(pool, random)
  if (found) {
    const byAnswer = new Map(pool.map((w) => [w.answer, w]))
    slots = buildSlotsFrom(found.isClue)
    filled = found.answers.map((a) => byAnswer.get(a)!)
  }

  if (!filled) {
    // No layout the pool could satisfy; fall back to an empty grid rather than a
    // half-filled one so the failure is obvious instead of subtle.
    return { rows: N, cols: N, cells: Array.from({ length: N }, () => Array(N).fill(null)), words: [] }
  }

  // Number the cells that start a word, in reading order.
  const numMap = new Map<string, number>()
  let counter = 0
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (slots.some((s) => s.row === r && s.col === c)) numMap.set(`${r},${c}`, ++counter)

  const words: PlacedWord[] = slots
    .map((slot, i) => ({
      ...filled![i],
      id: i,
      number: numMap.get(`${slot.row},${slot.col}`) ?? 0,
      row: slot.row,
      col: slot.col,
      direction: slot.direction,
    }))
    .sort((a, b) => a.number - b.number || (a.direction === 'across' ? -1 : 1))

  const cells: GermanCell[][] = Array.from({ length: N }, () => Array(N).fill(null))

  // Answer cells.
  for (const word of words) {
    const dr = word.direction === 'down' ? 1 : 0
    const dc = word.direction === 'across' ? 1 : 0
    for (let i = 0; i < word.answer.length; i++) {
      const r = word.row + dr * i
      const c = word.col + dc * i
      const existing = cells[r][c] as AnswerGridCell | null
      if (existing?.kind === 'answer') {
        existing.wordIds.push(word.id)
      } else {
        cells[r][c] = {
          kind: 'answer',
          row: r,
          col: c,
          solution: word.answer[i],
          number: numMap.get(`${r},${c}`) ?? null,
          wordIds: [word.id],
        }
      }
    }
  }

  // Clue cells: the cell before each word start, which the structure guarantees
  // is not an answer cell. Two words can share one, giving a split cell with a
  // ▼ clue on top and a ▶ clue below.
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

  for (const row of cells)
    for (const cell of row)
      if (cell?.kind === 'clue' && cell.entries.length > 1)
        cell.entries.sort((a) => (a.direction === 'down' ? -1 : 1))

  return { rows: N, cols: N, cells, words }
}
