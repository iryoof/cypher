// Validates generator output: every run must produce a grid where each maximal
// run of >=2 letters is exactly one of the placed words, every word crosses at
// least one other, and the size limit holds.
import { generatePuzzle } from '../frontend/src/games/kreuzwortraetsel/generator.ts'
import { buildPool } from '../frontend/src/games/kreuzwortraetsel/words/index.ts'

const pool = buildPool()
console.log('Poolgrösse nach Dedup:', pool.length)

const dupes = new Map()
for (const entry of pool) dupes.set(entry.answer, (dupes.get(entry.answer) ?? 0) + 1)
console.log('Doppelte Lösungen:', [...dupes.values()].filter((n) => n > 1).length)

const tooShort = pool.filter((e) => e.answer.length < 3)
const nonAZ = pool.filter((e) => !/^[A-Z]+$/.test(e.answer))
console.log('Zu kurz:', tooShort.length, '| Nicht A-Z:', nonAZ.length)
if (nonAZ.length) console.log('  Beispiele:', nonAZ.slice(0, 5).map((e) => e.answer))

const presets = [
  { name: 'klein', maxSize: 11, targetWords: 12 },
  { name: 'mittel', maxSize: 15, targetWords: 22 },
  { name: 'gross', maxSize: 19, targetWords: 34 }
]

let failures = 0
const signatures = new Set()

for (const preset of presets) {
  const sizes = []
  const wordCounts = []

  for (let run = 0; run < 200; run++) {
    const puzzle = generatePuzzle(pool, preset)
    sizes.push(Math.max(puzzle.rows, puzzle.cols))
    wordCounts.push(puzzle.words.length)
    signatures.add(puzzle.words.map((w) => w.answer).join('|'))

    const fail = (msg) => {
      if (failures < 5) console.log(`  FEHLER [${preset.name} run ${run}]: ${msg}`)
      failures++
    }

    if (puzzle.rows > preset.maxSize || puzzle.cols > preset.maxSize) {
      fail(`Gitter ${puzzle.rows}x${puzzle.cols} > ${preset.maxSize}`)
    }

    // Grid letters must match every word's answer.
    for (const word of puzzle.words) {
      for (let i = 0; i < word.answer.length; i++) {
        const r = word.row + (word.direction === 'down' ? i : 0)
        const c = word.col + (word.direction === 'across' ? i : 0)
        const cell = puzzle.cells[r]?.[c]
        if (!cell) { fail(`${word.answer}: Zelle ${r},${c} fehlt`); break }
        if (cell.solution !== word.answer[i]) {
          fail(`${word.answer}: Zelle ${r},${c} ist ${cell.solution}, erwartet ${word.answer[i]}`)
          break
        }
      }
    }

    // Every maximal horizontal/vertical run of >=2 letters must be a real word.
    const placed = new Set(puzzle.words.map((w) => `${w.row},${w.col},${w.direction}`))
    const scan = (direction) => {
      const outer = direction === 'across' ? puzzle.rows : puzzle.cols
      const inner = direction === 'across' ? puzzle.cols : puzzle.rows
      for (let a = 0; a < outer; a++) {
        let run = []
        for (let b = 0; b <= inner; b++) {
          const r = direction === 'across' ? a : b
          const c = direction === 'across' ? b : a
          const cell = b < inner ? puzzle.cells[r]?.[c] : null
          if (cell) { run.push([r, c]); continue }
          if (run.length >= 2) {
            const [sr, sc] = run[0]
            if (!placed.has(`${sr},${sc},${direction}`)) {
              const text = run.map(([rr, cc]) => puzzle.cells[rr][cc].solution).join('')
              fail(`Geisterwort ${direction} "${text}" bei ${sr},${sc}`)
            }
          }
          run = []
        }
      }
    }
    scan('across')
    scan('down')

    // Every word must cross at least one other (no floating islands).
    for (const word of puzzle.words) {
      let crosses = false
      for (let i = 0; i < word.answer.length; i++) {
        const r = word.row + (word.direction === 'down' ? i : 0)
        const c = word.col + (word.direction === 'across' ? i : 0)
        if (puzzle.cells[r][c].wordIds.length > 1) { crosses = true; break }
      }
      if (!crosses && puzzle.words.length > 1) fail(`${word.answer} kreuzt nichts`)
    }

    // Clue numbers must be unique per starting cell and ascending.
    const numbersByCell = new Map()
    for (const word of puzzle.words) {
      const k = `${word.row},${word.col}`
      if (numbersByCell.has(k) && numbersByCell.get(k) !== word.number) {
        fail(`Nummern uneinheitlich bei ${k}`)
      }
      numbersByCell.set(k, word.number)
    }
  }

  const avg = (xs) => (xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(1)
  console.log(
    `${preset.name.padEnd(7)} Gitter Ø${avg(sizes)} (max ${Math.max(...sizes)}/${preset.maxSize}) | ` +
    `Wörter Ø${avg(wordCounts)} (Ziel ${preset.targetWords}, min ${Math.min(...wordCounts)})`
  )
}

console.log('Verschiedene Rätsel aus 600 Läufen:', signatures.size)
console.log(failures === 0 ? '\nALLE PRÜFUNGEN BESTANDEN' : `\n${failures} FEHLER`)
process.exit(failures === 0 ? 0 : 1)
