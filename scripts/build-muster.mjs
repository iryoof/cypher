// Sucht Gitterformen für das Schwedenrätsel und schreibt die brauchbaren nach
// frontend/src/games/schwedenraetsel/patterns.ts.
//
// Warum vorab und nicht im Spiel: eine Form, in der jede dunkle Zelle eine
// Frage trägt, ist voll verzahnt - fast jeder Buchstabe gehört zu zwei Wörtern.
// Solche Formen zu finden dauert Sekunden, und ob sie sich mit dem Wortpool
// überhaupt füllen lassen, weiss man erst nach dem Versuch. Beides gehört nicht
// hinter einen Knopfdruck. Hier wird gesucht, jede Form mehrfach probeweise
// gefüllt und nur behalten, was zuverlässig aufgeht.
//
// Aufruf:  node_modules/.bin/jiti scripts/build-muster.mjs [--pro-groesse 40]
import { writeFileSync } from 'fs'
import { buildPool } from '../frontend/src/games/schwedenraetsel/words/index.ts'
import { generatePuzzle } from '../frontend/src/games/schwedenraetsel/generator.ts'
import {
  MAX_WORD,
  MIN_WORD,
  assignFields,
  findSlots,
  searchPattern
} from '../frontend/src/games/schwedenraetsel/pattern.ts'
import { fillForBuild } from '../frontend/src/games/schwedenraetsel/generator.ts'
import { DIFFICULTY_PRESETS } from '../frontend/src/games/schwedenraetsel/types.ts'

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : Number(process.argv[index + 1])
}

const perSize = arg('--pro-groesse', 40)
const attempts = arg('--versuche', 400)
/** So oft muss sich eine Form füllen lassen, bevor sie ins Spiel darf. */
const PROOFS = 3

const pool = buildPool()
const byLength = new Map()
for (const entry of pool) {
  if (entry.answer.length < MIN_WORD || entry.answer.length > MAX_WORD) continue
  if (entry.clue.length > 38) continue
  if (!byLength.has(entry.answer.length)) byLength.set(entry.answer.length, [])
  byLength.get(entry.answer.length).push(entry)
}

console.log('Pool:', pool.length, 'Wörter |', [...byLength.entries()].sort((a, b) => a[0] - b[0]).map(([l, w]) => `${l}:${w.length}`).join(' '))

const createRandom = (seed) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const sizes = [...new Set(Object.values(DIFFICULTY_PRESETS).map((preset) => preset.size))]
const found = {}

for (const size of sizes) {
  const accepted = []
  const seen = new Set()
  const started = Date.now()
  let searched = 0, unfillable = 0

  for (let attempt = 0; attempt < attempts && accepted.length < perSize; attempt++) {
    const random = createRandom(size * 1_000_003 + attempt * 7919 + 13)
    const result = searchPattern(size, 0.12 + random() * 0.16, random, byLength)
    if (!result) continue
    searched++

    const { pattern } = result
    const rows = pattern.map((row) => row.map((dark) => (dark ? '#' : '.')).join(''))
    const id = rows.join('/')
    if (seen.has(id)) continue
    seen.add(id)

    const slots = findSlots(pattern, size)
    const assignment = assignFields(slots, pattern, size)
    if (!assignment || assignment.idle > 0) continue

    // Der Beweis: die Form muss sich mehrfach und aus verschiedenen Startlagen
    // füllen lassen, sonst hängt das Spiel später beim Neu-Würfeln.
    let proofs = 0
    for (let round = 0; round < PROOFS + 2 && proofs < PROOFS; round++) {
      if (fillForBuild(slots, byLength, createRandom(attempt * 31 + round * 7 + 1), 60000)) proofs++
    }
    if (proofs < PROOFS) { unfillable++; continue }

    const dark = rows.join('').split('#').length - 1
    accepted.push({ rows, dark, words: slots.length })
    process.stdout.write(`\r  ${size}x${size}: ${accepted.length}/${perSize} Formen  `)
  }

  found[size] = accepted
  const avg = (pick) => (accepted.reduce((sum, entry) => sum + pick(entry), 0) / Math.max(accepted.length, 1)).toFixed(1)
  console.log(
    `\r  ${size}x${size}: ${accepted.length} Formen | Ø ${avg((e) => e.words)} Wörter, Ø ${avg((e) => e.dark)} dunkle Zellen ` +
    `(${Math.round(100 * avg((e) => e.dark) / (size * size))}%) | ${searched} gesucht, ${unfillable} nicht füllbar | ${Math.round((Date.now() - started) / 1000)}s`
  )
}

const body = Object.entries(found)
  .map(([size, entries]) =>
    `  ${size}: [\n` +
    entries.map((entry) => `    // ${entry.words} Wörter, ${entry.dark} Fragefelder\n    [${entry.rows.map((row) => `'${row}'`).join(', ')}]`).join(',\n') +
    '\n  ]'
  )
  .join(',\n')

writeFileSync(
  'frontend/src/games/schwedenraetsel/patterns.ts',
  `/**
 * Gitterformen fürs Schwedenrätsel — erzeugt von \`scripts/build-muster.mjs\`,
 * nicht von Hand pflegen.
 *
 * \`#\` ist ein Fragefeld, \`.\` ein Buchstabe. Jede Form hier erfüllt alles, was
 * ein Schwedenrätsel ausmacht: keine Lücken, jede Buchstabenreihe ab zwei
 * Zeichen ist waagerecht wie senkrecht ein Wort, und jedes dunkle Feld trägt
 * eine Frage. Ausserdem wurde jede Form beim Erzeugen mehrfach probeweise mit
 * dem Wortpool gefüllt — sie geht also auf.
 */
export const PATTERNS: Record<number, string[][]> = {
${body}
}
`
)

const total = Object.values(found).reduce((sum, entries) => sum + entries.length, 0)
console.log(`\npatterns.ts geschrieben: ${total} Formen`)
if (Object.values(found).some((entries) => entries.length === 0)) {
  console.log('WARNUNG: für mindestens eine Grösse wurde keine Form gefunden')
  process.exit(1)
}

// Gegenprobe über den echten Generator.
for (const size of sizes) {
  const puzzle = generatePuzzle(pool, { size })
  console.log(`  Gegenprobe ${size}x${size}: ${puzzle.words.length} Wörter`)
}
