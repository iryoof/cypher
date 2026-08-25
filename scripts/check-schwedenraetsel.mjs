// Prüft den Generator über viele Läufe. Ein Schwedenrätsel ist erst richtig,
// wenn das Gitter lückenlos ist, jede Buchstabenreihe in beiden Richtungen ein
// echtes Wort ist und jede Frage über ihren Pfeil beim ersten Buchstaben ihres
// Wortes ankommt.
import { generatePuzzle } from '../frontend/src/games/schwedenraetsel/generator.ts'
import { buildPool } from '../frontend/src/games/schwedenraetsel/words/index.ts'
import { DIFFICULTY_PRESETS } from '../frontend/src/games/schwedenraetsel/types.ts'

const pool = buildPool()
console.log('Poolgrösse:', pool.length)

// Wohin ein Pfeil zeigt: Feld -> erster Buchstabe.
const ARROW_TARGET = {
  right: { row: 0, col: 1, direction: 'across' },
  down: { row: 1, col: 0, direction: 'down' },
  downRight: { row: 1, col: 0, direction: 'across' },
  rightDown: { row: 0, col: 1, direction: 'down' }
}

let failures = 0
const signatures = new Set()

for (const [name, preset] of Object.entries(DIFFICULTY_PRESETS)) {
  const size = preset.size
  const runs = Number(process.env.RUNS ?? 60)
  const stats = { ok: 0, words: [], dark: [], idle: [], crossed: [], clue: [], ms: [] }

  for (let run = 0; run < runs; run++) {
    const started = Date.now()
    const puzzle = generatePuzzle(pool, { size })
    stats.ms.push(Date.now() - started)

    const fail = (msg) => {
      if (failures < 8) console.log(`  FEHLER [${name} Lauf ${run}]: ${msg}`)
      failures++
    }

    if (puzzle.words.length === 0) {
      fail('kein Rätsel erzeugt')
      continue
    }
    stats.ok++
    signatures.add(puzzle.words.map((w) => w.answer).join('|'))

    if (puzzle.rows !== size || puzzle.cols !== size) fail(`Gitter ${puzzle.rows}x${puzzle.cols}, erwartet ${size}`)

    // Keine Zelle darf Buchstabe und Frage zugleich sein.
    let letters = 0, dark = 0, fields = 0
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        const cell = puzzle.cells[r][c]
        const field = puzzle.clues[r][c]
        if (cell && field) fail(`Zelle ${r},${c} ist Buchstabe und Fragefeld`)
        if (cell) letters++
        else dark++
        if (field) fields++
      }
    }
    stats.dark.push(dark)
    stats.idle.push(dark - fields)

    // Jede Reihe aus mindestens zwei Buchstaben muss ein gesetztes Wort sein -
    // sonst stünde im Gitter eine Buchstabenfolge, die niemand erraten kann.
    const placed = new Set(puzzle.words.map((w) => `${w.row},${w.col},${w.direction}`))
    for (const direction of ['across', 'down']) {
      for (let a = 0; a < size; a++) {
        let run_ = []
        for (let b = 0; b <= size; b++) {
          const r = direction === 'across' ? a : b
          const c = direction === 'across' ? b : a
          const cell = b < size ? puzzle.cells[r][c] : null
          if (cell) { run_.push([r, c]); continue }
          if (run_.length >= 2) {
            const [sr, sc] = run_[0]
            if (!placed.has(`${sr},${sc},${direction}`)) {
              const text = run_.map(([rr, cc]) => puzzle.cells[rr][cc].solution).join('')
              fail(`Geisterwort ${direction} "${text}" bei ${sr},${sc}`)
            }
          }
          run_ = []
        }
      }
    }

    // Jeder Buchstabe gehört zu mindestens einem Wort, und die Gitterbuchstaben
    // stimmen mit den Lösungen überein.
    let crossed = 0
    for (const row of puzzle.cells) {
      for (const cell of row) {
        if (!cell) continue
        if (cell.wordIds.length === 0) fail(`Buchstabe ${cell.row},${cell.col} gehört zu keinem Wort`)
        if (cell.wordIds.length > 1) crossed++
      }
    }
    stats.crossed.push(letters ? crossed / letters : 0)

    for (const word of puzzle.words) {
      for (let i = 0; i < word.answer.length; i++) {
        const r = word.row + (word.direction === 'down' ? i : 0)
        const c = word.col + (word.direction === 'across' ? i : 0)
        const cell = puzzle.cells[r]?.[c]
        if (!cell) { fail(`${word.answer}: Zelle ${r},${c} fehlt`); break }
        if (cell.solution !== word.answer[i]) {
          fail(`${word.answer}: Zelle ${r},${c} ist ${cell.solution}`)
          break
        }
      }
      if (word.answer.length < 3) fail(`${word.answer} ist zu kurz`)
    }

    // Doppelte Lösungen in einem Rätsel lesen sich wie ein Fehler.
    const answers = puzzle.words.map((w) => w.answer)
    if (new Set(answers).size !== answers.length) fail('dieselbe Lösung zweimal im Gitter')

    // Jede Frage sitzt in einem Fragefeld und ihr Pfeil kommt beim ersten
    // Buchstaben ihres Wortes an.
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const field = puzzle.clues[r][c]
        if (!field) continue
        if (field.slots.length > 2) fail(`Feld ${r},${c} hat ${field.slots.length} Fragen`)
        const arrows = field.slots.map((s) => s.arrow)
        if (new Set(arrows).size !== arrows.length) fail(`Feld ${r},${c} hat zweimal denselben Pfeil`)

        for (const slot of field.slots) {
          stats.clue.push(slot.clue.length)
          const target = ARROW_TARGET[slot.arrow]
          if (!target) { fail(`Feld ${r},${c}: unbekannter Pfeil ${slot.arrow}`); continue }
          const word = puzzle.words.find((w) => w.id === slot.wordId)
          if (!word) { fail(`Feld ${r},${c}: Frage ohne Wort`); continue }
          if (
            word.row !== r + target.row ||
            word.col !== c + target.col ||
            word.direction !== target.direction
          ) {
            fail(`Feld ${r},${c}: Pfeil ${slot.arrow} kommt nicht bei ${word.answer} an`)
          }
          if (word.clue !== slot.clue) fail(`Feld ${r},${c}: Frage passt nicht zu ${word.answer}`)
        }
      }
    }

    // Jedes Wort wird genau einmal gefragt.
    const asked = puzzle.clues.flat().filter(Boolean).flatMap((f) => f.slots.map((s) => s.wordId))
    if (new Set(asked).size !== puzzle.words.length) fail('nicht jedes Wort wird genau einmal gefragt')

    stats.words.push(puzzle.words.length)
  }

  const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
  console.log(
    `${name.padEnd(7)} ${size}x${size} | erzeugt ${stats.ok}/${runs} | Wörter Ø${avg(stats.words).toFixed(1)} | ` +
    `dunkel Ø${avg(stats.dark).toFixed(1)} (${Math.round(100 * avg(stats.dark) / (size * size))}%), davon ohne Frage Ø${avg(stats.idle).toFixed(1)} | ` +
    `gekreuzt ${Math.round(100 * avg(stats.crossed))}% | Frage Ø${avg(stats.clue).toFixed(0)} Zeichen | Ø${avg(stats.ms).toFixed(0)}ms, max ${Math.max(...stats.ms)}ms`
  )
}

console.log('Verschiedene Rätsel:', signatures.size)
console.log(failures === 0 ? '\nALLE PRÜFUNGEN BESTANDEN' : `\n${failures} FEHLER`)
process.exit(failures === 0 ? 0 : 1)
