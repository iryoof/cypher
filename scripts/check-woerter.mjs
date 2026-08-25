// Prüft den Wortpool: Dubletten, Längenverteilung, zu lange Fragen.
//
// Der Generator füllt ein lückenloses Gitter, deshalb entscheidet vor allem der
// Vorrat an kurzen Wörtern, wie gut die Rätsel werden — die Verteilung hier ist
// die Kennzahl, an der jede Erweiterung des Pools gemessen wird.
import { CATEGORIES, buildPool, normaliseAnswer } from '../frontend/src/games/schwedenraetsel/words/index.ts'

const pool = buildPool()
const MAX_CLUE = 38

console.log('Kategorien:')
for (const category of CATEGORIES) {
  console.log(
    `  ${category.label.padEnd(20)} ${String(category.entries.length).padStart(5)} Einträge` +
    (category.always ? ' (immer dabei)' : '')
  )
}

// Dubletten: innerhalb einer Kategorie und über Kategorien hinweg.
const seen = new Map()
const duplicates = []
for (const category of CATEGORIES) {
  for (const [answer] of category.entries) {
    const normalised = normaliseAnswer(answer)
    if (seen.has(normalised)) duplicates.push(`${normalised} (${seen.get(normalised)} / ${category.label})`)
    else seen.set(normalised, category.label)
  }
}

console.log(`\nEinträge gesamt: ${[...CATEGORIES].reduce((n, c) => n + c.entries.length, 0)} | im Pool: ${pool.length}`)
console.log(`Dubletten (fallen raus): ${duplicates.length}`)
if (duplicates.length) console.log('  ' + duplicates.slice(0, 15).join('\n  '))

const badAnswers = pool.filter((e) => !/^[A-Z]{3,}$/.test(e.answer))
console.log('Lösungen mit Fremdzeichen oder zu kurz:', badAnswers.length)
if (badAnswers.length) console.log('  ' + badAnswers.slice(0, 10).map((e) => e.answer).join(', '))

const longClues = pool.filter((e) => e.clue.length > MAX_CLUE)
console.log(`Fragen über ${MAX_CLUE} Zeichen (fürs Gitter unbrauchbar): ${longClues.length}`)
if (longClues.length) console.log('  ' + longClues.slice(0, 5).map((e) => `${e.answer}: ${e.clue}`).join('\n  '))

// Der Generator nutzt nur Längen 3 bis 8.
console.log('\nLänge  Anzahl  nutzbar (Frage kurz genug)')
const byLength = new Map()
for (const entry of pool) {
  const stats = byLength.get(entry.answer.length) ?? { total: 0, usable: 0 }
  stats.total++
  if (entry.clue.length <= MAX_CLUE) stats.usable++
  byLength.set(entry.answer.length, stats)
}
for (const length of [...byLength.keys()].sort((a, b) => a - b)) {
  const { total, usable } = byLength.get(length)
  const bar = '█'.repeat(Math.round(usable / 20))
  console.log(`${String(length).padStart(4)}  ${String(total).padStart(6)}  ${String(usable).padStart(6)} ${bar}`)
}

const usableShort = [3, 4, 5, 6].reduce((n, l) => n + (byLength.get(l)?.usable ?? 0), 0)
console.log(`\nKurze Wörter (3-6 Buchstaben), nutzbar: ${usableShort}`)
