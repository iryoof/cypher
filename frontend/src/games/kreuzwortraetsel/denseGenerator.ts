import type { Cell, Direction, PlacedWord, Puzzle, WordEntry } from './types'

const key = (r: number, c: number) => `${r},${c}`

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function isValidBlacks(blacks: Set<string>, n: number): boolean {
  for (let r = 0; r < n; r++) {
    let run = 0
    for (let c = 0; c <= n; c++) {
      if (c === n || blacks.has(key(r, c))) { if (run === 1 || run === 2) return false; run = 0 }
      else run++
    }
  }
  for (let c = 0; c < n; c++) {
    let run = 0
    for (let r = 0; r <= n; r++) {
      if (r === n || blacks.has(key(r, c))) { if (run === 1 || run === 2) return false; run = 0 }
      else run++
    }
  }
  return true
}

function buildBlacks(n: number, target: number, rng: () => number): Set<string> {
  const all = shuffle(
    Array.from({ length: n * n }, (_, i) => key(Math.floor(i / n), i % n)),
    rng
  )
  const blacks = new Set<string>()
  for (const pos of all) {
    if (blacks.size >= target) break
    blacks.add(pos)
    if (!isValidBlacks(blacks, n)) blacks.delete(pos)
  }
  return blacks
}

interface Slot {
  direction: Direction
  row: number
  col: number
  length: number
  cells: string[]
}

function getSlots(n: number, blacks: Set<string>): Slot[] {
  const slots: Slot[] = []
  for (let r = 0; r < n; r++) {
    let s = -1
    for (let c = 0; c <= n; c++) {
      const blk = c === n || blacks.has(key(r, c))
      if (!blk && s === -1) s = c
      else if (blk && s !== -1) {
        const len = c - s
        if (len >= 3) slots.push({ direction: 'across', row: r, col: s, length: len, cells: Array.from({ length: len }, (_, i) => key(r, s + i)) })
        s = -1
      }
    }
  }
  for (let c = 0; c < n; c++) {
    let s = -1
    for (let r = 0; r <= n; r++) {
      const blk = r === n || blacks.has(key(r, c))
      if (!blk && s === -1) s = r
      else if (blk && s !== -1) {
        const len = r - s
        if (len >= 3) slots.push({ direction: 'down', row: s, col: c, length: len, cells: Array.from({ length: len }, (_, i) => key(s + i, c)) })
        s = -1
      }
    }
  }
  return slots
}

export function generateDensePuzzle(pool: WordEntry[], rng?: () => number): Puzzle {
  const random = rng ?? Math.random
  const N = 11 // word grid; toGermanStyle adds 1 row+col → 12x12

  // Group pool by word length, shuffled
  const byLen = new Map<number, WordEntry[]>()
  for (const w of pool) {
    if (w.answer.length >= 3 && w.answer.length <= N) {
      if (!byLen.has(w.answer.length)) byLen.set(w.answer.length, [])
      byLen.get(w.answer.length)!.push(w)
    }
  }
  for (const arr of byLen.values()) arr.sort(() => random() - 0.5)

  const blacks = buildBlacks(N, Math.round(N * N * 0.14), random)
  const slots = getSlots(N, blacks)

  // Sort: shorter slots first (harder constraint — fewer matching words)
  slots.sort((a, b) => a.length - b.length)

  const filled = new Map<string, string>()
  const placed: (PlacedWord & { _idx: number })[] = []
  const used = new Set<string>()
  let idCounter = 0

  for (const slot of slots) {
    const pattern = slot.cells.map(k => filled.get(k) ?? null)
    const candidates = byLen.get(slot.length)
    if (!candidates) continue

    for (const word of candidates) {
      if (used.has(word.answer)) continue
      let ok = true
      for (let i = 0; i < word.answer.length; i++) {
        if (pattern[i] !== null && pattern[i] !== word.answer[i]) { ok = false; break }
      }
      if (!ok) continue

      slot.cells.forEach((k, i) => { if (!filled.has(k)) filled.set(k, word.answer[i]) })
      placed.push({ ...word, id: idCounter++, number: 0, row: slot.row, col: slot.col, direction: slot.direction, _idx: placed.length })
      used.add(word.answer)
      break
    }
  }

  // Assign clue numbers (row-major scan)
  const numMap = new Map<string, number>()
  let counter = 0
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (placed.some(p => p.row === r && p.col === c))
        numMap.set(key(r, c), ++counter)

  const words: PlacedWord[] = placed.map(p => ({ ...p, number: numMap.get(key(p.row, p.col)) ?? 0 }))
    .sort((a, b) => a.number - b.number || (a.direction === 'across' ? -1 : 1))

  const cells: (Cell | null)[][] = Array.from({ length: N }, (_, r) =>
    Array.from({ length: N }, (_, c): Cell | null => {
      if (blacks.has(key(r, c)) || !filled.has(key(r, c))) return null
      const wordIds = words.filter(w => {
        const dr = w.direction === 'down' ? 1 : 0
        const dc = w.direction === 'across' ? 1 : 0
        for (let i = 0; i < w.answer.length; i++)
          if (w.row + dr * i === r && w.col + dc * i === c) return true
        return false
      }).map(w => w.id)
      if (!wordIds.length) return null
      const owner = words.find(w => w.id === wordIds[0])!
      const offset = owner.direction === 'across' ? c - owner.col : r - owner.row
      return { row: r, col: c, solution: owner.answer[offset], number: numMap.get(key(r, c)) ?? null, wordIds }
    })
  )

  return { rows: N, cols: N, cells, words }
}
