import { Link } from 'react-router-dom'
import { DIFFICULTY_PRESETS } from './types'
import type { Difficulty } from './types'
import { CATEGORIES } from './words'

interface MainMenuProps {
  difficulty: Difficulty
  onDifficulty: (difficulty: Difficulty) => void
  categoryIds: string[]
  onToggleCategory: (id: string) => void
  poolSize: number
  onStart: () => void
}

export default function MainMenu({
  difficulty,
  onDifficulty,
  categoryIds,
  onToggleCategory,
  poolSize,
  onStart
}: MainMenuProps) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="screen-shell w-full max-w-2xl rounded-2xl p-6 sm:p-10 space-y-8">
        <div className="text-center space-y-3">
          <span className="splash-tag">Solo · ohne Server</span>
          <h1 className="hero-title text-[clamp(2.2rem,9vw,3.6rem)] leading-none">
            Kreuzworträtsel
          </h1>
          <p className="text-white/60 text-sm">
            Jedes Rätsel wird neu aus {poolSize.toLocaleString('de-DE')} Begriffen gewürfelt.
          </p>
        </div>

        <div className="space-y-3">
          <p className="section-kicker">Grösse</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(DIFFICULTY_PRESETS) as Difficulty[]).map((key) => {
              const preset = DIFFICULTY_PRESETS[key]
              const isActive = key === difficulty
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onDifficulty(key)}
                  className={[
                    'rounded-lg border px-3 py-3 text-sm transition-colors',
                    isActive
                      ? 'border-white/50 bg-white/[0.12] text-white'
                      : 'border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.06]'
                  ].join(' ')}
                >
                  <span className="block">{preset.label}</span>
                  <span className="block font-mono-ui text-[0.65rem] text-white/40 mt-1">
                    bis {preset.maxSize}×{preset.maxSize}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-3">
          <p className="section-kicker">Themen</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((category) => {
              const isActive = categoryIds.includes(category.id)
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onToggleCategory(category.id)}
                  className={[
                    'rounded-full border px-4 py-2 text-xs transition-colors',
                    isActive
                      ? 'border-white/45 bg-white/[0.12] text-white'
                      : 'border-white/10 bg-white/[0.02] text-white/50 hover:bg-white/[0.05]'
                  ].join(' ')}
                >
                  {category.label}
                </button>
              )
            })}
          </div>
          {categoryIds.length === 0 && (
            <p className="alert-warning rounded-lg px-3 py-2 text-xs">
              Mindestens ein Thema auswählen.
            </p>
          )}
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={onStart}
            disabled={categoryIds.length === 0}
            className="action-primary w-full rounded-xl px-6 py-4 text-base disabled:opacity-40"
          >
            Rätsel starten
          </button>
          <Link
            to="/"
            className="action-ghost block w-full rounded-xl px-6 py-3 text-center text-sm no-underline"
          >
            Zurück zum Portal
          </Link>
        </div>
      </div>
    </div>
  )
}
