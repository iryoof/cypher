export interface Slot {
  row: number
  col: number
  len: number
  direction: 'across' | 'down'
}

export interface Structure {
  /** true = clue cell (carries the question text), false = answer cell */
  isClue: boolean[][]
  slots: Slot[]
}

const MIN = 2
const MAX = 8

export const cellsOfSlot = (slot: Slot): [number, number][] =>
  Array.from({ length: slot.len }, (_, i) => [
    slot.row + (slot.direction === 'down' ? i : 0),
    slot.col + (slot.direction === 'across' ? i : 0),
  ])

/**
 * Answer runs long enough to hold a word. A run only counts if a clue cell sits
 * immediately before it — that cell is where its arrow goes — so runs hard
 * against the top or left edge are not slots.
 */
export function slotsOf(isClue: boolean[][], n: number): Slot[] {
  const slots: Slot[] = []

  for (let r = 0; r < n; r++) {
    let c = 0
    while (c < n) {
      while (c < n && isClue[r][c]) c++
      if (c >= n) break
      const start = c
      while (c < n && !isClue[r][c]) c++
      if (start >= 1 && c - start >= MIN)
        slots.push({ row: r, col: start, len: c - start, direction: 'across' })
    }
  }

  for (let c = 0; c < n; c++) {
    let r = 0
    while (r < n) {
      while (r < n && isClue[r][c]) r++
      if (r >= n) break
      const start = r
      while (r < n && !isClue[r][c]) r++
      if (start >= 1 && r - start >= MIN)
        slots.push({ row: start, col: c, len: r - start, direction: 'down' })
    }
  }

  return slots
}

/** Answer runs that exceed MAX, in both orientations. */
function oversizedRuns(isClue: boolean[][], n: number) {
  const out: { down: boolean; index: number; start: number; len: number }[] = []

  for (let r = 0; r < n; r++) {
    let c = 0
    while (c < n) {
      while (c < n && isClue[r][c]) c++
      if (c >= n) break
      const s = c
      while (c < n && !isClue[r][c]) c++
      if (c - s > MAX) out.push({ down: false, index: r, start: s, len: c - s })
    }
  }

  for (let c = 0; c < n; c++) {
    let r = 0
    while (r < n) {
      while (r < n && isClue[r][c]) r++
      if (r >= n) break
      const s = r
      while (r < n && !isClue[r][c]) r++
      if (r - s > MAX) out.push({ down: true, index: c, start: s, len: r - s })
    }
  }

  return out
}

interface Faults {
  slots: Slot[]
  /** answer cells that belong to no slot — they would render blank */
  orphans: [number, number][]
  /** clue cells with no word starting right of or below them — they would render empty */
  deadClues: [number, number][]
  oversized: ReturnType<typeof oversizedRuns>
}

function analyse(isClue: boolean[][], n: number): Faults {
  const slots = slotsOf(isClue, n)
  const covered = new Set<string>()
  const startsAcross = new Set<string>()
  const startsDown = new Set<string>()

  for (const slot of slots) {
    for (const [r, c] of cellsOfSlot(slot)) covered.add(`${r},${c}`)
    ;(slot.direction === 'across' ? startsAcross : startsDown).add(`${slot.row},${slot.col}`)
  }

  const orphans: [number, number][] = []
  const deadClues: [number, number][] = []

  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (isClue[r][c]) {
        if (!startsAcross.has(`${r},${c + 1}`) && !startsDown.has(`${r + 1},${c}`))
          deadClues.push([r, c])
      } else if (!covered.has(`${r},${c}`)) {
        orphans.push([r, c])
      }
    }

  return { slots, orphans, deadClues, oversized: oversizedRuns(isClue, n) }
}

/**
 * Builds a clue-cell layout in which every cell earns its place: no answer cell
 * without a word through it, and no clue cell without a word to point at. Those
 * two faults are what used to leave blank cells in the rendered grid.
 *
 * Starts from a jittered diagonal lattice, then repairs one randomly chosen
 * fault per round. Fixing faults one at a time rather than sweeping them keeps
 * the repairs from locking into a cycle, where closing a gap reopens the one
 * that caused it.
 */
export function buildStructure(n: number, rng: () => number): Structure & { ok: boolean } {
  const isClue: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false))

  const period = 5 + Math.floor(rng() * 3) // 5..7
  const shift = 1 + Math.floor(rng() * 3)
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if ((((c - shift * r) % period) + period) % period === 0) isClue[r][c] = true

  // The bare lattice reads as diagonal stripes and only has a handful of shapes.
  // Flipping a few cells breaks the pattern up; the repair loop below restores
  // validity, so the jitter costs variety nothing in correctness.
  const jitter = 6 + Math.floor(rng() * 7)
  for (let i = 0; i < jitter; i++) {
    const r = Math.floor(rng() * n)
    const c = Math.floor(rng() * n)
    isClue[r][c] = !isClue[r][c]
  }

  for (let round = 0; round < 500; round++) {
    const { orphans, deadClues, oversized } = analyse(isClue, n)
    if (!orphans.length && !deadClues.length && !oversized.length)
      return { isClue, slots: slotsOf(isClue, n), ok: true }

    const jobs: [string, unknown][] = [
      ...orphans.map((o) => ['orphan', o] as [string, unknown]),
      ...deadClues.map((d) => ['dead', d] as [string, unknown]),
      ...oversized.map((s) => ['big', s] as [string, unknown]),
    ]
    const [kind, payload] = jobs[Math.floor(rng() * jobs.length)]

    if (kind === 'orphan') {
      const [r, c] = payload as [number, number]
      isClue[r][c] = true
    } else if (kind === 'dead') {
      const [r, c] = payload as [number, number]
      // Prefer opening the cell right of or below it, so the clue gains a word
      // to point at; failing that, give up the clue cell itself.
      const opts: [number, number][] = []
      if (c + 1 < n && isClue[r][c + 1]) opts.push([r, c + 1])
      if (r + 1 < n && isClue[r + 1][c]) opts.push([r + 1, c])
      if (opts.length && rng() < 0.7) {
        const [rr, cc] = opts[Math.floor(rng() * opts.length)]
        isClue[rr][cc] = false
      } else {
        isClue[r][c] = false
      }
    } else {
      const run = payload as { down: boolean; index: number; start: number; len: number }
      const cand: [number, number][] = []
      for (let p = run.start + MIN; p <= run.start + run.len - MIN - 1; p++)
        cand.push(run.down ? [p, run.index] : [run.index, p])
      if (cand.length) {
        const [r, c] = cand[Math.floor(rng() * cand.length)]
        isClue[r][c] = true
      }
    }
  }

  return { isClue, slots: slotsOf(isClue, n), ok: false }
}
