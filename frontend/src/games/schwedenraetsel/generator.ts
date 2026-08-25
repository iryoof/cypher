import type { Cell, ClueCell, PlacedWord, Puzzle, WordEntry } from './types'
import {
  MAX_WORD,
  MIN_WORD,
  assignFields,
  cellsOf,
  findSlots,
  type ClueField,
  type Pattern,
  type Slot
} from './pattern'
import { PATTERNS } from './patterns'

/**
 * Schwedenraetsel generator.
 *
 * A Schwedenraetsel is a gapless grid: every cell is either a letter or a dark
 * question field, every run of letters - across and down - is a word, and every
 * dark cell asks a question. The shapes that satisfy all of this are searched
 * ahead of time and shipped in patterns.ts, each one proven fillable; what is
 * left to do here is to pick one and fill it with words, which is what makes
 * every puzzle different.
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

/**
 * The pool, indexed for the filling.
 *
 * The search asks the same question over and over — "how many words of this
 * length still fit these letters?" — and it asks it for every open slot at
 * every step. Walking the word list each time is what limited the search
 * depth, so each length keeps one bitset per letter and position: the words
 * that fit are the bitwise AND of the letters already placed, and counting them
 * is a popcount instead of a scan.
 */
interface LengthIndex {
  words: WordEntry[]
  /** `masks[position][letter]` — bitset of the words with that letter there. */
  masks: Uint32Array[][]
  all: Uint32Array
  /** Words already used elsewhere in the grid, bit set. */
  used: Uint32Array
}

const LETTERS = 26
const codeOf = (letter: string) => letter.charCodeAt(0) - 65

const buildIndex = (words: WordEntry[], length: number): LengthIndex => {
  const size = Math.ceil(words.length / 32) || 1
  const masks: Uint32Array[][] = Array.from({ length }, () =>
    Array.from({ length: LETTERS }, () => new Uint32Array(size))
  )
  const all = new Uint32Array(size)

  words.forEach((entry, index) => {
    all[index >>> 5] |= 1 << (index & 31)
    for (let position = 0; position < length; position++) {
      const letter = codeOf(entry.answer[position])
      if (letter >= 0 && letter < LETTERS) {
        masks[position][letter][index >>> 5] |= 1 << (index & 31)
      }
    }
  })

  return { words, masks, all, used: new Uint32Array(size) }
}

const popcount = (value: number): number => {
  let v = value - ((value >>> 1) & 0x55555555)
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333)
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24
}

interface FillState {
  /** Letters by cell, empty where still unknown. */
  letters: Map<string, string>
  chosen: Map<number, WordEntry>
  index: Map<number, LengthIndex>
}

/** The words that still fit a slot, as a bitset. */
const fittingWords = (slot: Slot, state: FillState): Uint32Array | null => {
  const index = state.index.get(slot.length)
  if (!index) return null

  const result = new Uint32Array(index.all.length)
  for (let i = 0; i < result.length; i++) result[i] = index.all[i] & ~index.used[i]

  cellsOf(slot).forEach(([row, col], position) => {
    const letter = state.letters.get(key(row, col))
    if (!letter) return
    const mask = index.masks[position][codeOf(letter)]
    for (let i = 0; i < result.length; i++) result[i] &= mask[i]
  })

  return result
}

const countBits = (bits: Uint32Array): number => {
  let total = 0
  for (let i = 0; i < bits.length; i++) total += popcount(bits[i])
  return total
}

const wordsFrom = (bits: Uint32Array, index: LengthIndex, limit = Infinity): WordEntry[] => {
  const found: WordEntry[] = []
  for (let block = 0; block < bits.length && found.length < limit; block++) {
    let value = bits[block]
    while (value !== 0 && found.length < limit) {
      const bit = value & -value
      const position = 31 - Math.clz32(bit)
      found.push(index.words[(block << 5) + position])
      value ^= bit
    }
  }
  return found
}

/**
 * Fills every slot with a word, letters shared where slots cross.
 *
 * Plain backtracking with the two standard crossword tricks: always work on the
 * slot with the fewest candidates left, and after each choice check that no
 * crossing slot has run out of words — that catches a dead end one step
 * earlier, which matters a lot with a pool this small.
 */
/** Only for `scripts/build-muster.mjs`: proves a shape can be filled. */
export const fillForBuild = (
  slots: Slot[],
  byLength: Map<number, WordEntry[]>,
  random: () => number,
  budget: number
) => fillSlots(slots, byLength, random, budget)

const fillSlots = (
  slots: Slot[],
  byLength: Map<number, WordEntry[]>,
  random: () => number,
  budget: number,
  deadline = Infinity
): Map<number, WordEntry> | null => {
  const index = new Map<number, LengthIndex>()
  for (const slot of slots) {
    if (index.has(slot.length)) continue
    const words = byLength.get(slot.length)
    if (!words || words.length === 0) return null
    index.set(slot.length, buildIndex(words, slot.length))
  }

  const positionOf = new Map<string, number>()
  for (const [length, entry] of index) {
    entry.words.forEach((word, i) => positionOf.set(`${length}:${word.answer}`, i))
  }

  const state: FillState = { letters: new Map(), chosen: new Map(), index }

  const crossing = new Map<number, Slot[]>()
  for (const slot of slots) {
    const cells = new Set(cellsOf(slot).map(([row, col]) => key(row, col)))
    crossing.set(
      slot.id,
      slots.filter(
        (other) =>
          other.id !== slot.id &&
          cellsOf(other).some(([row, col]) => cells.has(key(row, col)))
      )
    )
  }

  const take = (slot: Slot, entry: WordEntry) => {
    const bit = positionOf.get(`${slot.length}:${entry.answer}`)!
    index.get(slot.length)!.used[bit >>> 5] |= 1 << (bit & 31)
  }
  const release = (slot: Slot, entry: WordEntry) => {
    const bit = positionOf.get(`${slot.length}:${entry.answer}`)!
    index.get(slot.length)!.used[bit >>> 5] &= ~(1 << (bit & 31))
  }

  let steps = 0

  const solve = (): boolean => {
    if (state.chosen.size === slots.length) return true
    if (steps++ > budget) return false
    // The clock is only read now and then: a puzzle is generated on a click,
    // so the wait has to stay short, but `Date.now()` in the inner loop would
    // cost more than it saves.
    if ((steps & 0x3ff) === 0 && Date.now() > deadline) return false

    // Work on the slot with the fewest words left — the standard crossword
    // heuristic, and cheap now that counting is a popcount.
    let target: Slot | null = null
    let targetBits: Uint32Array | null = null
    let fewest = Infinity
    for (const slot of slots) {
      if (state.chosen.has(slot.id)) continue
      const bits = fittingWords(slot, state)
      if (!bits) return false
      const count = countBits(bits)
      if (count === 0) return false
      if (count < fewest) {
        fewest = count
        target = slot
        targetBits = bits
      }
    }
    if (!target || !targetBits) return true

    const pool = state.index.get(target.length)!
    // Short questions first — those stay readable inside a field — but from a
    // shuffled pool, so puzzles stay different.
    // Short questions are the ones that stay readable inside a field, so the
    // candidates are cut down to the shortest ones — but then shuffled again,
    // because trying them in a fixed order would make the same shape come out
    // as nearly the same puzzle every time.
    const ordered = shuffle(
      wordsFrom(targetBits, pool, 60)
        .sort((a, b) => a.clue.length - b.clue.length)
        .slice(0, 25),
      random
    )

    for (const entry of ordered) {
      const cells = cellsOf(target)
      const restore: [string, string | undefined][] = cells.map(([row, col]) => [
        key(row, col),
        state.letters.get(key(row, col))
      ])

      cells.forEach(([row, col], i) => state.letters.set(key(row, col), entry.answer[i]))
      state.chosen.set(target.id, entry)
      take(target, entry)

      // Look one step ahead: a crossing slot left without a single word means
      // this choice is already lost.
      const stillOpen = crossing.get(target.id)!.every((other) => {
        if (state.chosen.has(other.id)) return true
        const bits = fittingWords(other, state)
        return bits !== null && countBits(bits) > 0
      })

      if (stillOpen && solve()) return true

      for (const [id, letter] of restore) {
        if (letter === undefined) state.letters.delete(id)
        else state.letters.set(id, letter)
      }
      state.chosen.delete(target.id)
      release(target, entry)
    }

    return false
  }

  return solve() ? new Map(state.chosen) : null
}

export interface GenerateOptions {
  /** Edge length of the square grid — see `DIFFICULTY_PRESETS`. */
  size: number
  seed?: number
}

/** Longer questions no longer fit legibly into a single field. */
const MAX_CLUE_LENGTH = 38

/**
 * Builds a puzzle from `pool`. Every run draws new patterns and a new filling,
 * so no two puzzles come out the same.
 */
export const generatePuzzle = (pool: WordEntry[], options: GenerateOptions): Puzzle => {
  const { size } = options
  const seed = options.seed ?? Math.floor(Math.random() * 0xffffffff)
  const random = createRandom(seed)

  const byLength = new Map<number, WordEntry[]>()
  for (const entry of pool) {
    if (entry.answer.length < MIN_WORD || entry.answer.length > MAX_WORD) continue
    if (entry.clue.length > MAX_CLUE_LENGTH) continue
    if (!byLength.has(entry.answer.length)) byLength.set(entry.answer.length, [])
    byLength.get(entry.answer.length)!.push(entry)
  }
  // Shuffled once per puzzle: the filling walks the words in this order, so the
  // same shape gives a different puzzle every time.
  for (const [length, entries] of byLength) byLength.set(length, shuffle(entries, random))

  const shapes = shuffle(PATTERNS[size] ?? [], random).map((rows) => {
    const pattern: Pattern = rows.map((row) => [...row].map((cell) => cell === '#'))
    const slots = findSlots(pattern, size)
    return { slots, assignment: assignFields(slots, pattern, size) }
  })

  // Every stored shape was proven fillable when it was built — but against a
  // different word order, and the order is what decides how long the search
  // digs. So the shapes are first skimmed with a small budget, which usually
  // finds one that falls into place straight away, and only then worked
  // through properly. That keeps the wait short without giving up a shape.
  for (const budget of [6000, 80000]) {
    for (const shape of shapes) {
      if (!shape.assignment || shape.assignment.idle > 0) continue
      const filled = fillSlots(shape.slots, byLength, random, budget)
      if (filled) return buildPuzzle(size, shape.slots, filled, shape.assignment.fields)
    }
  }

  return { rows: 0, cols: 0, cells: [], clues: [], words: [] }
}

const buildPuzzle = (
  size: number,
  slots: Slot[],
  filled: Map<number, WordEntry>,
  fields: Map<number, ClueField>
): Puzzle => {
  const words: PlacedWord[] = slots.map((slot) => {
    const field = fields.get(slot.id)!
    return {
      ...filled.get(slot.id)!,
      id: slot.id,
      row: slot.row,
      col: slot.col,
      direction: slot.direction,
      clueRow: field.row,
      clueCol: field.col,
      arrow: field.arrow
    }
  })

  const solutions = new Map<string, string>()
  const wordIdsByCell = new Map<string, number[]>()
  for (const slot of slots) {
    const answer = filled.get(slot.id)!.answer
    cellsOf(slot).forEach(([row, col], index) => {
      const id = key(row, col)
      solutions.set(id, answer[index])
      wordIdsByCell.set(id, [...(wordIdsByCell.get(id) ?? []), slot.id])
    })
  }

  const cells: (Cell | null)[][] = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col): Cell | null => {
      const solution = solutions.get(key(row, col))
      if (solution === undefined) return null
      return { row, col, solution, wordIds: wordIdsByCell.get(key(row, col))! }
    })
  )

  const clues: (ClueCell | null)[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, (): ClueCell | null => null)
  )
  for (const word of words) {
    const field = clues[word.clueRow][word.clueCol] ?? {
      row: word.clueRow,
      col: word.clueCol,
      slots: []
    }
    field.slots.push({
      wordId: word.id,
      direction: word.direction,
      arrow: word.arrow,
      clue: word.clue,
      answerLength: word.answer.length
    })
    clues[word.clueRow][word.clueCol] = field
  }

  return { rows: size, cols: size, cells, clues, words }
}
