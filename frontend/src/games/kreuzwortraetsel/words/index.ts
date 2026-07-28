import type { WordEntry } from '../types'
import { geografie } from './geografie'
import { natur } from './natur'
import { alltag } from './alltag'
import { kulturSport } from './kulturSport'
import { wissenGeschichte } from './wissenGeschichte'
import { menschSprache } from './menschSprache'
import { kurz } from './kurz'
import { weitere } from './weitere'

/** A raw pool entry: [Lösung, Frage]. Umlauts are written normally here. */
export type RawEntry = [string, string]

export interface Category {
  id: string
  label: string
  entries: RawEntry[]
}

/**
 * Crossword grids only hold A-Z, so umlauts are expanded the way they are on a
 * German crossword: Ä -> AE, ß -> SS. Doing it here means the category files
 * can be written in plain German and stay readable.
 */
export const normaliseAnswer = (answer: string): string =>
  answer
    .toUpperCase()
    .replace(/Ä/g, 'AE')
    .replace(/Ö/g, 'OE')
    .replace(/Ü/g, 'UE')
    .replace(/ß/g, 'SS')
    .replace(/[^A-Z]/g, '')

export const CATEGORIES: Category[] = [
  geografie,
  natur,
  alltag,
  kulturSport,
  wissenGeschichte,
  menschSprache,
  kurz,
  weitere
]

/**
 * Builds the pool for the selected categories. Duplicate solutions are dropped
 * — the same answer twice in one grid reads like a mistake, and a duplicate
 * would also let the generator cross a word with itself.
 */
export const buildPool = (categoryIds?: string[]): WordEntry[] => {
  const selected = categoryIds?.length
    ? CATEGORIES.filter((category) => categoryIds.includes(category.id))
    : CATEGORIES

  const seen = new Set<string>()
  const pool: WordEntry[] = []

  for (const category of selected) {
    for (const [answer, clue] of category.entries) {
      const normalised = normaliseAnswer(answer)
      if (normalised.length < 2 || seen.has(normalised)) continue
      seen.add(normalised)
      pool.push({ answer: normalised, clue, category: category.label })
    }
  }

  return pool
}
