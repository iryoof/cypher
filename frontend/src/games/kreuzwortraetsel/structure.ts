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

const MIN = 2
const MAX = 9

/** Contiguous false-runs along a row or column. */
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

/** A new clue at (r,c) must not leave a 1-cell answer run beside it. */
function okToPlaceClue(isClue: boolean[][], n: number, r: number, c: number) {
  for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    let len = 0
    let rr = r + dr
    let cc = c + dc
    while (rr >= 0 && rr < n && cc >= 0 && cc < n && !isClue[rr][cc]) {
      len++
      rr += dr
      cc += dc
    }
    if (len === 1) return false
  }
  return true
}

/**
 * Builds a German-crossword cell structure: a lattice of clue cells arranged so
 * every answer run (across and down) is between MIN and MAX cells long, and
 * every run has a clue cell immediately before it.
 *
 * The lattice period of 5 with a per-row shift of 3 gives runs of ~4 in both
 * directions; a repair pass fixes the runs the grid edges cut short or long.
 */
export function buildStructure(n: number, rng: () => number): Structure {
  const shift = 1 + Math.floor(rng() * 4) // 1..4, varies the diagonal
  const phase = Math.floor(rng() * 5)

  const isClue: boolean[][] = Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => (((c - shift * r - phase) % 5) + 5) % 5 === 0)
  )

  // Repair: short runs lose their leading clue, long runs gain a middle one.
  for (let pass = 0; pass < 6; pass++) {
    let changed = false

    for (const down of [false, true]) {
      for (let idx = 0; idx < n; idx++) {
        for (const run of runs(isClue, n, idx, down)) {
          if (run.len < MIN) {
            // Dissolve this run into its neighbour by clearing the clue before it.
            const before = run.start - 1
            if (before >= 0) {
              if (down) isClue[before][idx] = false
              else isClue[idx][before] = false
              changed = true
            } else {
              // Run touches the top/left edge — clear the clue after it instead.
              const after = run.start + run.len
              if (after < n) {
                if (down) isClue[after][idx] = false
                else isClue[idx][after] = false
                changed = true
              }
            }
          } else if (run.len > MAX) {
            // Split near the middle, but only where the new clue does not leave
            // a length-1 run perpendicular to it — that would oscillate with
            // the short-run repair above and never converge.
            const mid = run.start + Math.floor(run.len / 2)
            const order: number[] = []
            for (let d = 0; d < run.len; d++) {
              if (mid + d < run.start + run.len) order.push(mid + d)
              if (d > 0 && mid - d >= run.start) order.push(mid - d)
            }
            for (const p of order) {
              const r = down ? p : idx
              const c = down ? idx : p
              if (!okToPlaceClue(isClue, n, r, c)) continue
              isClue[r][c] = true
              changed = true
              break
            }
          }
        }
      }
    }

    if (!changed) break
  }

  // Collect the final slots. Runs starting at index 0 are fine: toGermanStyle
  // adds a border row and column that holds their clue cell.
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
