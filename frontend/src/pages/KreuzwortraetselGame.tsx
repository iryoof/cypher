import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import '../styles/globals.css'

// ── Grid data ────────────────────────────────────────────────────────────────
// null  = schwarzes Feld
// clue  = Hinweis-Feld (creme, mit Text + Pfeil)
// answer = Eingabe-Feld

type ClueEntry = { text: string; dir: 'right' | 'down' }
type CellDef =
  | null
  | { type: 'clue'; entries: ClueEntry[] }
  | { type: 'answer'; num?: number; flag?: boolean }

const B = null

const G: CellDef[][] = [
  // Row 0
  [
    { type: 'clue', entries: [{ text: 'Duplikat', dir: 'right' }] },
    B,
    { type: 'clue', entries: [{ text: 'Fluss in Bayern', dir: 'down' }, { text: 'Nutztier d. Lappen', dir: 'right' }] },
    B,
    { type: 'clue', entries: [{ text: 'Auskunft', dir: 'down' }] },
    B,
    { type: 'clue', entries: [{ text: 'lateinisch: ich liebe', dir: 'down' }] },
    { type: 'answer', num: 7 },
    { type: 'clue', entries: [{ text: 'deutsche Spielkarte', dir: 'down' }] },
  ],
  // Row 1
  [
    { type: 'clue', entries: [{ text: 'Verzierung an Bauwerken', dir: 'down' }] },
    B,
    { type: 'answer' },
    { type: 'answer', num: 8 },
    { type: 'answer' },
    B,
    { type: 'clue', entries: [{ text: 'ab jetzt', dir: 'right' }] },
    { type: 'answer' },
    { type: 'clue', entries: [{ text: 'Raumtonverfahren', dir: 'down' }] },
  ],
  // Row 2
  [
    { type: 'clue', entries: [{ text: 'japanischer Kaisertitel', dir: 'down' }] },
    B,
    { type: 'answer', num: 2 },
    { type: 'clue', entries: [{ text: 'weibliche Verwandte', dir: 'right' }] },
    { type: 'answer' },
    { type: 'answer', num: 9 },
    { type: 'clue', entries: [{ text: 'rote Filzkappe', dir: 'right' }] },
    { type: 'answer' },
    { type: 'answer', num: 5 },
  ],
  // Row 3
  [
    { type: 'answer', num: 3, flag: true },
    B,
    { type: 'clue', entries: [{ text: 'italienischer Priestertitel', dir: 'right' }] },
    { type: 'clue', entries: [{ text: 'Stelle eines Verbrechens', dir: 'right' }] },
    { type: 'answer' },
    { type: 'answer' },
    { type: 'clue', entries: [{ text: 'Düsseldorfer Flaniermeile', dir: 'right' }] },
    { type: 'answer' },
    { type: 'clue', entries: [{ text: 'hohe Spielkarte', dir: 'down' }] },
  ],
  // Row 4
  [
    { type: 'answer' },
    { type: 'answer' },
    { type: 'answer' },
    { type: 'answer' },
    { type: 'answer', num: 1 },
    { type: 'answer' },
    { type: 'answer' },
    { type: 'answer' },
    { type: 'answer' },
  ],
  // Row 5
  [
    { type: 'clue', entries: [{ text: 'zunächst', dir: 'right' }] },
    B,
    { type: 'clue', entries: [{ text: 'Göttertrank', dir: 'right' }] },
    { type: 'answer' },
    { type: 'answer' },
    { type: 'answer' },
    { type: 'answer' },
    { type: 'answer' },
    { type: 'answer' },
  ],
  // Row 6
  [
    { type: 'answer', num: 4, flag: true },
    B,
    { type: 'answer' },
    { type: 'clue', entries: [{ text: 'Wasserstelle in der Wüste', dir: 'right' }] },
    { type: 'answer' },
    { type: 'answer' },
    { type: 'answer' },
    { type: 'answer' },
    { type: 'answer' },
  ],
  // Row 7
  [
    { type: 'clue', entries: [{ text: 'tropisches Gewürz', dir: 'right' }] },
    B,
    { type: 'clue', entries: [{ text: 'auch', dir: 'right' }] },
    { type: 'answer' },
    { type: 'answer' },
    { type: 'answer' },
    { type: 'answer', num: 6 },
    { type: 'answer' },
    { type: 'answer' },
  ],
  // Row 8
  [
    { type: 'answer' },
    { type: 'answer' },
    { type: 'answer' },
    { type: 'answer' },
    { type: 'answer' },
    { type: 'answer' },
    { type: 'answer' },
    { type: 'answer' },
    { type: 'answer' },
  ],
]

const ROWS = G.length
const COLS = G[0].length

const key = (r: number, c: number) => `${r},${c}`

// ── Component ────────────────────────────────────────────────────────────────

export default function KreuzwortraetselGame() {
  const [letters, setLetters] = useState<Record<string, string>>({})
  const [cursor, setCursor] = useState<[number, number] | null>(null)
  const inputsRef = useRef<Map<string, HTMLInputElement>>(new Map())

  useEffect(() => {
    document.title = 'Kreuzworträtsel'
  }, [])

  const focusCell = useCallback((r: number, c: number) => {
    const el = inputsRef.current.get(key(r, c))
    if (el) { el.focus(); el.select() }
  }, [])

  const isAnswer = (r: number, c: number) => G[r]?.[c]?.type === 'answer'

  const nextAnswer = useCallback((r: number, c: number): [number, number] | null => {
    for (let cc = c + 1; cc < COLS; cc++) if (isAnswer(r, cc)) return [r, cc]
    for (let rr = r + 1; rr < ROWS; rr++)
      for (let cc = 0; cc < COLS; cc++) if (isAnswer(rr, cc)) return [rr, cc]
    return null
  }, [])

  const prevAnswer = useCallback((r: number, c: number): [number, number] | null => {
    for (let cc = c - 1; cc >= 0; cc--) if (isAnswer(r, cc)) return [r, cc]
    for (let rr = r - 1; rr >= 0; rr--)
      for (let cc = COLS - 1; cc >= 0; cc--) if (isAnswer(rr, cc)) return [rr, cc]
    return null
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, r: number, c: number) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const id = key(r, c)
      if (letters[id]) {
        setLetters(prev => { const n = { ...prev }; delete n[id]; return n })
      } else {
        const prev = prevAnswer(r, c)
        if (prev) focusCell(...prev)
      }
      return
    }
    const moves: Record<string, [number, number]> = {
      ArrowRight: [r, c + 1], ArrowLeft: [r, c - 1],
      ArrowDown: [r + 1, c], ArrowUp: [r - 1, c],
    }
    if (e.key in moves) {
      e.preventDefault()
      let [nr, nc] = moves[e.key]
      while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        if (isAnswer(nr, nc)) { focusCell(nr, nc); return }
        if (e.key === 'ArrowRight') nc++
        else if (e.key === 'ArrowLeft') nc--
        else if (e.key === 'ArrowDown') nr++
        else nr--
      }
    }
  }, [letters, focusCell, prevAnswer])

  const handleInput = useCallback((e: React.FormEvent<HTMLInputElement>, r: number, c: number) => {
    const inp = e.currentTarget
    const val = inp.value.replace(/[^a-zA-ZäöüÄÖÜ]/g, '').slice(-1).toUpperCase()
    inp.value = val
    setLetters(prev => val ? { ...prev, [key(r, c)]: val } : prev)
    if (val) {
      const next = nextAnswer(r, c)
      if (next) focusCell(...next)
    }
  }, [focusCell, nextAnswer])

  const clearAll = () => setLetters({})

  // ── Cell renderers ──────────────────────────────────────────────────────

  const CELL_SIZE = 'min(9vw, 62px)'

  const renderCell = (cell: CellDef, r: number, c: number) => {
    const id = key(r, c)

    if (cell === null) {
      return (
        <div key={id} style={{ width: CELL_SIZE, height: CELL_SIZE, background: '#050505', flexShrink: 0 }} />
      )
    }

    if (cell.type === 'clue') {
      const hasBoth = cell.entries.length >= 2
      const sorted = [...cell.entries].sort((a) => a.dir === 'down' ? -1 : 1)
      return (
        <div key={id} style={{
          width: CELL_SIZE, height: CELL_SIZE, flexShrink: 0,
          background: '#f0ede2', border: '2px solid #1a1a1a',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          userSelect: 'none', cursor: 'default',
        }}>
          {sorted.map((entry, i) => (
            <div key={i} style={{
              flex: 1,
              borderBottom: hasBoth && i === 0 ? '1px solid #ccc9b5' : 'none',
              padding: '2px 3px',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              position: 'relative',
              fontSize: 'min(1.3vw, 7px)',
              fontWeight: 700, color: '#111', lineHeight: 1.2,
            }}>
              <span style={{ paddingRight: '10px' }}>{entry.text}</span>
              <span style={{
                position: 'absolute', bottom: 2, right: 3,
                fontSize: 'min(1.8vw, 10px)', fontWeight: 900,
              }}>
                {entry.dir === 'right' ? '▶' : '▼'}
              </span>
            </div>
          ))}
        </div>
      )
    }

    // answer cell
    const isCursor = cursor?.[0] === r && cursor?.[1] === c
    return (
      <div key={id} style={{ width: CELL_SIZE, height: CELL_SIZE, flexShrink: 0, position: 'relative' }}>
        {(cell.flag || cell.num !== undefined) && (
          <span style={{
            position: 'absolute', top: 2, left: 3, zIndex: 10,
            fontSize: 'min(1.2vw, 7px)', fontWeight: 700, color: '#444',
            pointerEvents: 'none', lineHeight: 1,
          }}>
            {cell.flag ? `⚑${cell.num}` : cell.num}
          </span>
        )}
        <input
          ref={el => {
            if (el) inputsRef.current.set(id, el)
            else inputsRef.current.delete(id)
          }}
          maxLength={2}
          value={letters[id] ?? ''}
          onFocus={() => setCursor([r, c])}
          onBlur={() => setCursor(null)}
          onKeyDown={e => handleKeyDown(e, r, c)}
          onInput={e => handleInput(e, r, c)}
          onChange={() => {}}
          style={{
            width: '100%', height: '100%',
            border: `2px solid ${isCursor ? '#3b82f6' : '#aaa'}`,
            background: isCursor ? '#dbeafe' : '#fff',
            textAlign: 'center',
            fontSize: 'min(4vw, 20px)', fontWeight: 700,
            color: '#111', textTransform: 'uppercase',
            outline: 'none', caretColor: 'transparent', cursor: 'pointer',
            transition: 'background 0.1s, border-color 0.1s',
          }}
        />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111', color: '#fff', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Link to="/" style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'none', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            ← Zurück
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Kreuzworträtsel</h1>
          <button
            onClick={clearAll}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            Leeren
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <div style={{
            display: 'inline-flex', flexDirection: 'column',
            gap: 2, border: '2px solid #1a1a1a', background: '#1a1a1a',
          }}>
            {G.map((row, r) => (
              <div key={r} style={{ display: 'flex', gap: 2 }}>
                {row.map((cell, c) => renderCell(cell, r, c))}
              </div>
            ))}
          </div>
        </div>

        <p style={{ marginTop: 20, color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center' }}>
          Pfeiltasten zum Navigieren · Buchstaben zum Ausfüllen
        </p>
      </div>
    </div>
  )
}
