export interface Slot {
  row: number
  col: number
  len: number
  direction: 'across' | 'down'
}

export interface Structure {
  /** true = clue cell (holds the question text), false = answer cell */
  isClue: boolean[][]
  slots: Slot[]
}

const MIN = 3
const MAX = 5

/**
 * Extra clue cells sprinkled in after the split pass. Splitting alone leaves a
 * grid where ~85% of cells carry both an across and a down word, which no pool
 * this size can fill. These thin the crossing to ~69% and take the fill rate
 * from roughly 1-in-10 structures to 4-in-5.
 */
const EXTRA_CLUES = 24

/** Contiguous answer-cell runs along one row (down=false) or column (down=true). */
function runs(isClue: boolean[][], n: number, index: number, down: boolean) {
  const out: { start: number; len: number }[] = []
  let i = 0
  while (i < n) {
    while (i < n && (down ? isClue[i][index] : isClue[index][i])) i++
    if (i >= n) break
    const start = i
    while (i < n && !(down ? isClue[i][index] : isClue[index][i])) i++
    out.push({ start, len: i - start })
  }
  return out
}

/** Length of the answer-cell run through (r,c) in the given orientation. */
function runLenAt(isClue: boolean[][], n: number, r: number, c: number, down: boolean) {
  if (isClue[r][c]) return 0
  let len = 1
  for (const sign of [1, -1]) {
    let rr = r + (down ? sign : 0)
    let cc = c + (down ? 0 : sign)
    while (rr >= 0 && rr < n && cc >= 0 && cc < n && !isClue[rr][cc]) {
      len++
      rr += down ? sign : 0
      cc += down ? 0 : sign
    }
  }
  return len
}

function oversizedRuns(isClue: boolean[][], n: number) {
  const out: { index: number; down: boolean; start: number; len: number }[] = []
  for (let i = 0; i < n; i++)
    for (const down of [false, true])
      for (const run of runs(isClue, n, i, down))
        if (run.len > MAX) out.push({ index: i, down, ...run })
  return out
}

/**
 * Builds the clue-cell layout for a German crossword.
 *
 * Starts from an empty grid (one huge run per line) and repeatedly splits a
 * randomly chosen oversized run. Randomising which run gets split — rather than
 * walking a fixed lattice — is what makes each puzzle's shape different.
 *
 * Splitting is deliberately unconstrained perpendicular to the run: refusing
 * splits that leave a stub beside them deadlocks rows 1 and n-2 (any clue there
 * strands a single cell against the edge), which leaves whole lines unsplit.
 * The stubs are cleaned up afterwards instead.
 */
export function buildStructure(n: number, rng: () => number): Structure {
  const isClue: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false))

  for (let guard = 0; guard < n * n * 4; guard++) {
    const over = oversizedRuns(isClue, n)
    if (over.length === 0) break

    // Try the oversized runs in random order; only give up once none of them
    // can be split at all.
    const order = [...over].sort(() => rng() - 0.5)
    let placed = false

    for (const run of order) {
      const candidates: [number, number][] = []
      // A clue at p leaves sub-runs [start, p) and (p, start+len); both must
      // reach MIN, so p ranges over start+MIN .. start+len-MIN-1.
      for (let p = run.start + MIN; p <= run.start + run.len - MIN - 1; p++)
        candidates.push(run.down ? [p, run.index] : [run.index, p])
      if (candidates.length === 0) continue

      const [r, c] = candidates[Math.floor(rng() * candidates.length)]
      isClue[r][c] = true
      placed = true
      break
    }

    if (!placed) break
  }

  // Thin out the crossing density. A clue is only kept if it leaves every
  // across run in its row still long enough to hold a word, so the extra cells
  // break up down runs without stranding across ones.
  for (let tries = 0; tries < EXTRA_CLUES * 4; tries++) {
    const r = Math.floor(rng() * n)
    const c = Math.floor(rng() * n)
    if (isClue[r][c]) continue
    isClue[r][c] = true
    if (!runs(isClue, n, r, false).every((run) => run.len >= MIN)) isClue[r][c] = false
  }

  // A cell is orphaned when neither its across nor its down run can hold a
  // word. Turn those into clue cells — that can orphan a neighbour, so repeat
  // until the layout settles.
  for (let pass = 0; pass < n * n; pass++) {
    let changed = false
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        if (isClue[r][c]) continue
        if (runLenAt(isClue, n, r, c, false) < MIN && runLenAt(isClue, n, r, c, true) < MIN) {
          isClue[r][c] = true
          changed = true
        }
      }
    if (!changed) break
  }

  // Runs starting at index 0 are fine: toGermanStyle adds a border row and
  // column that holds their clue cell.
  const slots: Slot[] = []
  for (let r = 0; r < n; r++)
    for (const run of runs(isClue, n, r, false))
      if (run.len >= MIN)
        slots.push({ row: r, col: run.start, len: run.len, direction: 'across' })

  for (let c = 0; c < n; c++)
    for (const run of runs(isClue, n, c, true))
      if (run.len >= MIN)
        slots.push({ row: run.start, col: c, len: run.len, direction: 'down' })

  return { isClue, slots }
}
