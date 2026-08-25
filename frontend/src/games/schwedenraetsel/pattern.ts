import type { ArrowType, Direction, WordEntry } from './types'

/**
 * The shape of a Schwedenrätsel: which cells are dark, which words run where,
 * and which question field asks about which word.
 *
 * Shapes are expensive to search and cheap to store, so they are not built when
 * a player presses start. `scripts/build-muster.mjs` searches them ahead of
 * time, proves every one of them can really be filled from the word pool, and
 * writes the survivors to `patterns.ts`; at runtime the generator only picks
 * one and fills it. That is what makes "no empty question field" a property of
 * the data rather than a hope about a search that has to finish in a second.
 */

const key = (row: number, col: number) => `${row},${col}`

export interface Slot {
  id: number
  row: number
  col: number
  direction: Direction
  length: number
}

/** `true` marks a dark cell — a question field, never a letter. */
export type Pattern = boolean[][]

export const step = (direction: Direction): [number, number] =>
  direction === 'across' ? [0, 1] : [1, 0]

export const cellsOf = (slot: Slot): [number, number][] => {
  const [dr, dc] = step(slot.direction)
  return Array.from({ length: slot.length }, (_, i) => [slot.row + dr * i, slot.col + dc * i])
}

/**
 * Words shorter than this are too rare in the pool to fill a dense grid, longer
 * ones leave too little room for question fields.
 */
export const MIN_WORD = 3
export const MAX_WORD = 6

/**
 * What is wrong with a pattern, as a number to minimise.
 *
 * These are the rules a Schwedenrätsel has to obey, and they pull against each
 * other — darkening a cell to break a too long word can strand its neighbour —
 * so they are not applied as repairs one after another but weighed together and
 * searched down to zero:
 *
 * - a run of exactly two letters is no word, the pool starts at three;
 * - a run longer than the longest word available cannot be filled;
 * - a letter that lies in no word at all can never be guessed;
 * - a dark cell nobody asks a question from is a hole in the puzzle: every dark
 *   cell must have a word starting to its right or below it, straight or around
 *   a bend.
 */
export const violations = (pattern: Pattern, size: number, slots: Slot[]): number => {
  let total = 0
  const covered = new Set<string>()
  const starts = new Set<string>()

  for (const slot of slots) {
    starts.add(`${slot.row},${slot.col},${slot.direction}`)
    for (const [row, col] of cellsOf(slot)) covered.add(key(row, col))
  }

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!pattern[row][col]) {
        if (!covered.has(key(row, col))) total += 3
        continue
      }
      const asks =
        starts.has(`${row},${col + 1},across`) ||
        starts.has(`${row + 1},${col},down`) ||
        starts.has(`${row + 1},${col},across`) ||
        starts.has(`${row},${col + 1},down`)
      if (!asks) total += 3
    }
  }

  return total
}

/** Runs that are neither a word nor allowed to exist. */
export const badRuns = (pattern: Pattern, size: number): number => {
  let total = 0
  for (const run of allRuns(pattern, size)) {
    if (run.length === 2) total += 3
    else if (run.length > MAX_WORD) total += (run.length - MAX_WORD) * 3
  }
  return total
}

/**
 * How hard a slot is to fill, from what the pool holds: three letter words are
 * rare, and so are long ones. A pattern full of them will not fill, however
 * pretty it looks, so this is weighed against the empty fields.
 */
export const slotPenalty = (length: number, byLength: Map<number, WordEntry[]>): number => {
  const available = byLength.get(length)?.length ?? 0
  if (available === 0) return 1000
  return Math.max(0, 300 - available) / 30
}

/**
 * Searches a pattern that breaks none of the rules.
 *
 * Hill climbing on single cells: flip one, keep the flip when nothing got
 * worse. Equal-cost moves are kept as well, which lets the search drift along
 * a plateau instead of stalling on it — that is what makes a zero-violation
 * pattern reachable from almost any starting point.
 *
 * Once the pattern is clean, a second phase keeps it clean and trades the word
 * lengths towards what the pool actually holds: three letter words are rare, so
 * a pattern full of three letter slots is correct but unfillable.
 */
export const searchPattern = (
  size: number,
  density: number,
  random: () => number,
  byLength: Map<number, WordEntry[]>
): { pattern: Pattern; slots: Slot[] } | null => {
  const pattern: Pattern = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) =>
      // No arrow can ever reach the top left corner, so no word may start there.
      row === 0 && col === 0 ? true : random() < density
    )
  )

  const rate = () => {
    const slots = findSlots(pattern, size)
    let cost = badRuns(pattern, size) + violations(pattern, size, slots)
    // A field holds at most two questions, and every field has to end up with
    // one. Without this the search happily builds corners where three words
    // would have to be asked from a single cell, or where a dark cell has a
    // word beside it but that word is needed by its other neighbour.
    if (cost === 0) {
      const assignment = assignFields(slots, pattern, size)
      cost += assignment ? assignment.idle * 3 : 3
    }
    return { slots, cost }
  }

  let current = rate()

  for (let step = 0; step < size * size * 40 && current.cost > 0; step++) {
    const row = Math.floor(random() * size)
    const col = Math.floor(random() * size)
    if (row === 0 && col === 0) continue

    pattern[row][col] = !pattern[row][col]
    const next = rate()
    if (next.cost <= current.cost) current = next
    else pattern[row][col] = !pattern[row][col]
  }

  if (current.cost > 0) return null

  const hardness = (slots: Slot[]) =>
    slots.reduce((sum, slot) => sum + slotPenalty(slot.length, byLength) + slot.length * 0.6, 0)
  let best = hardness(current.slots)

  for (let step = 0; step < size * size * 20; step++) {
    const row = Math.floor(random() * size)
    const col = Math.floor(random() * size)
    if (row === 0 && col === 0) continue

    pattern[row][col] = !pattern[row][col]
    const next = rate()
    const score = hardness(next.slots)
    if (next.cost === 0 && score <= best) {
      best = score
      current = next
    } else {
      pattern[row][col] = !pattern[row][col]
    }
  }

  return { pattern, slots: current.slots }
}

/** Every maximal run of letters, however short. */
export const allRuns = (pattern: Pattern, size: number): Slot[] => {
  const runs: Slot[] = []

  for (const direction of ['across', 'down'] as Direction[]) {
    for (let outer = 0; outer < size; outer++) {
      let start = -1
      for (let inner = 0; inner <= size; inner++) {
        const row = direction === 'across' ? outer : inner
        const col = direction === 'across' ? inner : outer
        const isLetter = inner < size && !pattern[row][col]

        if (isLetter) {
          if (start === -1) start = inner
          continue
        }

        if (start !== -1) {
          runs.push({
            id: runs.length,
            row: direction === 'across' ? outer : start,
            col: direction === 'across' ? start : outer,
            direction,
            length: inner - start
          })
          start = -1
        }
      }
    }
  }

  return runs
}

/** The runs long enough to hold a word — the slots the filling works on. */
export const findSlots = (pattern: Pattern, size: number): Slot[] =>
  allRuns(pattern, size)
    .filter((run) => run.length >= MIN_WORD)
    .map((run, id) => ({ ...run, id }))

export interface ClueField {
  row: number
  col: number
  arrow: ArrowType
}

/**
 * The two fields a word can be asked from: the one directly before it, and the
 * one beside its first letter, reached by an arrow that bends. The bent one is
 * what lets a word start at the top or left edge, where there is no cell before
 * it at all.
 */
export const fieldOptions = (slot: Slot, pattern: Pattern, size: number): ClueField[] => {
  const isField = (row: number, col: number) =>
    row >= 0 && col >= 0 && row < size && col < size && pattern[row][col]

  const before: ClueField =
    slot.direction === 'across'
      ? { row: slot.row, col: slot.col - 1, arrow: 'right' }
      : { row: slot.row - 1, col: slot.col, arrow: 'down' }
  const beside: ClueField =
    slot.direction === 'across'
      ? { row: slot.row - 1, col: slot.col, arrow: 'downRight' }
      : { row: slot.row, col: slot.col - 1, arrow: 'rightDown' }

  return [before, beside].filter((option) => isField(option.row, option.col))
}

export interface Assignment {
  fields: Map<number, ClueField>
  /** Dark cells that ended up without a question. */
  idle: number
}

/**
 * Hands every word a question field, at most two questions per field.
 *
 * Words with only one possible field go first — they are the ones that get
 * stranded — and among equal options the emptier field wins, so questions
 * spread over the grid instead of piling up and leaving dark cells blank.
 */
export const assignFields = (slots: Slot[], pattern: Pattern, size: number): Assignment | null => {
  const fields = new Map<number, ClueField>()
  const load = new Map<string, number>()

  const occupants = new Map<string, number[]>()

  /**
   * Places one word, and when both of its fields are full, tries to move a
   * question that already sits there to its own alternative — the augmenting
   * step of a matching. Pure greed strands words whose only field was taken by
   * a word that had somewhere else to go.
   */
  const place = (slot: Slot, seen: Set<string>): boolean => {
    const options = fieldOptions(slot, pattern, size).sort(
      (a, b) => (load.get(key(a.row, a.col)) ?? 0) - (load.get(key(b.row, b.col)) ?? 0)
    )

    for (const option of options) {
      const id = key(option.row, option.col)
      if (seen.has(id)) continue
      seen.add(id)

      const current = occupants.get(id) ?? []
      if (current.length < 2) {
        occupants.set(id, [...current, slot.id])
        load.set(id, current.length + 1)
        fields.set(slot.id, option)
        return true
      }

      for (const occupantId of current) {
        const occupant = slots.find((entry) => entry.id === occupantId)!
        const previous = fields.get(occupantId)!
        occupants.set(id, current.filter((entry) => entry !== occupantId))
        fields.delete(occupantId)

        if (place(occupant, seen)) {
          const now = occupants.get(id) ?? []
          occupants.set(id, [...now, slot.id])
          load.set(id, now.length + 1)
          fields.set(slot.id, option)
          return true
        }

        occupants.set(id, current)
        fields.set(occupantId, previous)
      }
    }

    return false
  }

  const order = [...slots].sort(
    (a, b) => fieldOptions(a, pattern, size).length - fieldOptions(b, pattern, size).length
  )

  for (const slot of order) {
    if (!place(slot, new Set())) return null
  }

  /**
   * A field can end up empty although a word beside it could have been asked
   * from there — the word went to its other option. Move such a word over, as
   * long as the field it leaves keeps a question of its own.
   */
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!pattern[row][col] || (load.get(key(row, col)) ?? 0) > 0) continue

      for (const slot of slots) {
        const option = fieldOptions(slot, pattern, size).find(
          (candidate) => candidate.row === row && candidate.col === col
        )
        if (!option) continue

        const from = key(fields.get(slot.id)!.row, fields.get(slot.id)!.col)
        if ((load.get(from) ?? 0) < 2) continue

        load.set(from, load.get(from)! - 1)
        load.set(key(row, col), 1)
        occupants.set(from, (occupants.get(from) ?? []).filter((id) => id !== slot.id))
        occupants.set(key(row, col), [slot.id])
        fields.set(slot.id, option)
        break
      }
    }
  }

  let idle = 0
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (pattern[row][col] && !(load.get(key(row, col)) ?? 0)) idle++
    }
  }

  return { fields, idle }
}

